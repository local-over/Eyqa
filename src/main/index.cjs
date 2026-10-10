/**
 * Eyqa Electron Main Process
 * Manages native window lifecycle, IPC communications, and agent execution.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const { ConfigStore } = require('./storage/config-store.cjs');
const { SessionStore } = require('./storage/session-store.cjs');
const { ProviderManager } = require('./agent/providers/provider-manager.cjs');
const { AgentOrchestrator } = require('./agent/orchestrator.cjs');
const { searchWeb } = require('./agent/tools/web-search.cjs');
const { fetchWebpage } = require('./agent/tools/web-fetch.cjs');
const {
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile
} = require('./agent/tools/workspace.cjs');

let mainWindow = null;
let currentTurnAbortController = null;

// Initialize Storage and Engines
const configStore = new ConfigStore();
const sessionStore = new SessionStore();
const providerManager = new ProviderManager(configStore);
const orchestrator = new AgentOrchestrator(providerManager, configStore);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'Eyqa - The AI Coworker',
    backgroundColor: '#111111',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // Config & Settings
  ipcMain.handle('store:getSettings', () => {
    return configStore.get();
  });

  ipcMain.handle('store:saveSettings', (_, partial) => {
    return configStore.update(partial);
  });

  ipcMain.handle('store:updateProvider', (_, id, data) => {
    return configStore.updateProvider(id, data);
  });

  ipcMain.handle('tools:testProvider', async (_, id, customConfig) => {
    return await providerManager.testProvider(id, customConfig);
  });

  // Sessions
  ipcMain.handle('store:getSessions', () => {
    return sessionStore.listSessions();
  });

  ipcMain.handle('store:getSession', (_, id) => {
    return sessionStore.getSession(id);
  });

  ipcMain.handle('store:createSession', (_, title, mode, folder) => {
    return sessionStore.createSession(title, mode, folder);
  });

  ipcMain.handle('store:saveSession', (_, session) => {
    return sessionStore.saveSession(session);
  });

  ipcMain.handle('store:deleteSession', (_, id) => {
    return sessionStore.deleteSession(id);
  });

  // Native Dialogs
  ipcMain.handle('dialog:selectWorkspaceFolder', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Project Folder for Eyqa',
      properties: ['openDirectory', 'createDirectory']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      const selected = res.filePaths[0];
      return {
        path: selected,
        name: path.basename(selected)
      };
    }
    return null;
  });

  ipcMain.handle('dialog:selectAttachmentFile', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Attach File for Eyqa Coworker',
      properties: ['openFile']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      const filePath = res.filePaths[0];
      try {
        const stats = fs.statSync(filePath);
        let content = '';
        if (stats.size < 2 * 1024 * 1024) {
          content = fs.readFileSync(filePath, 'utf8');
        } else {
          content = 'File is larger than 2MB; only metadata attached.';
        }
        return {
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          content
        };
      } catch (err) {
        return { error: err.message };
      }
    }
    return null;
  });

  // Workspace Tools
  ipcMain.handle('tools:listWorkspace', (_, subDir) => {
    const ws = configStore.get().workspacePath;
    return listWorkspace(ws, subDir);
  });

  ipcMain.handle('tools:readWorkspaceFile', (_, relPath) => {
    const ws = configStore.get().workspacePath;
    return readWorkspaceFile(ws, relPath);
  });

  ipcMain.handle('tools:writeWorkspaceFile', (_, relPath, content) => {
    const ws = configStore.get().workspacePath;
    return writeWorkspaceFile(ws, relPath, content);
  });

  // Direct Web Tools
  ipcMain.handle('tools:searchWeb', async (_, query, maxResults) => {
    return await searchWeb(query, maxResults);
  });

  ipcMain.handle('tools:fetchWebpage', async (_, url) => {
    return await fetchWebpage(url);
  });

  // Agent Streaming Execution
  ipcMain.handle('agent:startTurn', async (event, payload) => {
    if (currentTurnAbortController) {
      currentTurnAbortController.abort();
    }
    currentTurnAbortController = new AbortController();

    const sender = event.sender;

    try {
      const result = await orchestrator.runTurn({
        sessionId: payload.sessionId,
        messages: payload.messages,
        userMessage: payload.userMessage,
        folderPath: payload.folderPath,
        modeId: payload.modeId,
        providerId: payload.providerId,
        enableTools: payload.enableTools !== false,
        forceWebSearch: payload.forceWebSearch === true,
        onToken: (tok) => {
          sender.send('agent:stream-token', tok);
        },
        onThought: (th) => {
          sender.send('agent:stream-thought', th);
        },
        onToolStart: (toolInfo) => {
          sender.send('agent:tool-start', toolInfo);
        },
        onToolResult: (resInfo) => {
          sender.send('agent:tool-result', resInfo);
        },
        onFallback: (fbInfo) => {
          sender.send('agent:fallback', fbInfo);
        },
        signal: currentTurnAbortController.signal
      });

      return {
        success: true,
        result
      };
    } catch (err) {
      if (currentTurnAbortController.signal.aborted) {
        return {
          success: false,
          aborted: true,
          error: 'Generation stopped by user.'
        };
      }
      return {
        success: false,
        error: err.message
      };
    } finally {
      currentTurnAbortController = null;
    }
  });

  ipcMain.handle('agent:stopTurn', () => {
    if (currentTurnAbortController) {
      currentTurnAbortController.abort();
      currentTurnAbortController = null;
      return true;
    }
    return false;
  });

  // Window Controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });
}

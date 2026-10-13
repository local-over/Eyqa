/**
 * Eyqa Electron Main Process
 * Manages native window lifecycle, IPC communications, and agent execution.
 */

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, Notification, nativeImage } = require('electron');
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
  writeWorkspaceFile,
  replaceFileContent,
  viewFile,
  getSnapshots,
  revertSnapshot,
  getFileContent,
  getProjectMemory,
  saveProjectMemory,
  getProjectChangelog
} = require('./agent/tools/workspace.cjs');
const { runCommand, manageTask, cleanupAllTasks } = require('./agent/tools/terminal.cjs');
const {
  browserNavigate,
  browserAction,
  readBrowserPage,
  requestBrowserTakeover,
  handBackBrowser,
  closeBrowser,
  getDefaultBrowser
} = require('./agent/tools/browser.cjs');
const { generateImage } = require('./agent/tools/image-gen.cjs');
const { getMemoryStore } = require('./storage/memory-store.cjs');
const { getYouMeStore } = require('./storage/you-me-store.cjs');
const { getSkillsManager } = require('./agent/tools/skills.cjs');
const { fccService } = require('./fcc-service.cjs');

let mainWindow = null;
let appTray = null;
let isQuitting = false;
const activeTurnControllers = new Map();
const activeTaskMeta = new Map(); // sessionId -> { title, startTime }

// Initialize Storage and Engines
const configStore = new ConfigStore();
const sessionStore = new SessionStore();
const providerManager = new ProviderManager(configStore);
const orchestrator = new AgentOrchestrator(providerManager, configStore);

function formatElapsed(startTime) {
  const sec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : `${s}s`;
}

function dispatchNativeNotification(title, body, sessionId = null) {
  try {
    if (Notification.isSupported()) {
      const iconPath = path.join(__dirname, '../renderer/assets/eyqa-logo.png');
      const notif = new Notification({
        title,
        body,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        silent: false
      });
      notif.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          if (sessionId) {
            mainWindow.webContents.send('app:focus-session', sessionId);
          }
        }
      });
      notif.show();
    }
  } catch (err) {
    console.warn('[Notification] Failed to show native notification:', err.message);
  }
}

function updateTrayMenu() {
  if (!appTray) return;

  const menuItems = [
    {
      label: 'Eyqa - The AI Coworker',
      enabled: false
    },
    {
      label: mainWindow && mainWindow.isVisible() ? 'Hide Window' : 'Open Eyqa',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' }
  ];

  if (activeTaskMeta.size === 0) {
    menuItems.push({
      label: 'No active chat tasks running',
      enabled: false
    });
  } else {
    menuItems.push({
      label: `Active Chats Working (${activeTaskMeta.size}):`,
      enabled: false
    });
    for (const [sId, meta] of activeTaskMeta.entries()) {
      menuItems.push({
        label: `  ⚡ ${meta.title} (${formatElapsed(meta.startTime)})`,
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('app:focus-session', sId);
          }
        }
      });
    }
  }

  menuItems.push(
    { type: 'separator' },
    {
      label: 'Quit Eyqa',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  );

  appTray.setContextMenu(Menu.buildFromTemplate(menuItems));

  if (activeTaskMeta.size > 0) {
    appTray.setToolTip(`Eyqa: ${activeTaskMeta.size} active chat(s) running in background`);
  } else {
    appTray.setToolTip('Eyqa - The AI Coworker');
  }
}

function createTray() {
  if (appTray) return;

  const iconPath = path.join(__dirname, '../renderer/assets/eyqa-logo.png');
  let icon = null;
  try {
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
    }
  } catch (_) {}

  if (!icon || icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }

  appTray = new Tray(icon);
  appTray.setToolTip('Eyqa - The AI Coworker');
  updateTrayMenu();

  appTray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Ticker to update elapsed time every 2 seconds when tasks are running
  setInterval(() => {
    if (activeTaskMeta.size > 0) {
      updateTrayMenu();
    }
  }, 2000);
}

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

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.endsWith('index.html')) {
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  createTray();

  // Automatically start embedded FCC background library in background
  fccService.start().then(res => {
    console.log('[Main] Embedded FCC background service initialized:', res.status, 'Port:', res.port);
  }).catch(err => {
    console.warn('[Main] FCC background service warning:', err.message);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (isQuitting) {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});

app.on('will-quit', async () => {
  cleanupAllTasks();
  closeBrowser();
  try {
    await fccService.stop();
  } catch (_) {}
});

process.on('SIGINT', async () => {
  try {
    await fccService.stop();
  } catch (_) {}
  process.exit(0);
});

function getWorkspaceRootForProject(projectId) {
  // If projectId is provided, look it up in session store to get its folder.
  if (projectId) {
    const projects = sessionStore.listProjects();
    const proj = projects.find(p => p.id === projectId);
    if (proj && proj.folderPath) {
      return proj.folderPath;
    }
    // Pure chat without folder should not bleed into unrelated workspace directory
    return null;
  }
  return configStore.get().workspacePath || null;
}

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

  
  // Projects
  ipcMain.handle('store:listProjects', () => {
    return sessionStore.listProjects();
  });

  ipcMain.handle('store:createProject', (_, name, folderPath, folderName, extraProps) => {
    return sessionStore.createProject(name, folderPath, folderName, extraProps);
  });

  ipcMain.handle('store:updateProject', (_, id, updates) => {
    return sessionStore.updateProject(id, updates);
  });

  ipcMain.handle('store:deleteProject', (_, id) => {
    return sessionStore.deleteProject(id);
  });

  // Sessions
  ipcMain.handle('store:getSessions', () => {
    return sessionStore.listSessions();
  });

  ipcMain.handle('store:getSession', (_, id) => {
    return sessionStore.getSession(id);
  });

  ipcMain.handle('store:createSession', (_, title, projectId) => {
    return sessionStore.createSession(title, projectId);
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

  ipcMain.handle('tools:replaceFileContent', (_, relPath, oldContent, newContent, startLine, endLine, allowMultiple) => {
    const ws = configStore.get().workspacePath;
    return replaceFileContent(ws, {
      TargetFile: relPath,
      TargetContent: oldContent,
      ReplacementContent: newContent,
      StartLine: startLine,
      EndLine: endLine,
      AllowMultiple: allowMultiple
    });
  });

  ipcMain.handle('tools:viewFile', (_, relPath, startLine, endLine, offset) => {
    const ws = configStore.get().workspacePath;
    return viewFile(ws, {
      AbsolutePath: relPath,
      StartLine: startLine,
      EndLine: endLine,
      ContentOffset: offset
    });
  });

  // Terminal Execution & Task Management
  ipcMain.handle('terminal:runCommand', async (_, payload) => {
    const ws = payload?.projectId ? getWorkspaceRootForProject(payload.projectId) : configStore.get().workspacePath;
    return await runCommand({
      CommandLine: payload.CommandLine,
      Cwd: payload.Cwd,
      IsDaemon: payload.IsDaemon,
      WaitMsBeforeAsync: payload.WaitMsBeforeAsync,
      workspaceRoot: ws
    });
  });

  ipcMain.handle('terminal:manageTask', async (_, payload) => {
    return await manageTask({
      Action: payload.Action,
      TaskId: payload.TaskId,
      Input: payload.Input
    });
  });

  // Browser Engine IPC
  ipcMain.handle('browser:navigate', async (_, url, timeoutMs) => {
    return await browserNavigate({ url, timeoutMs });
  });

  ipcMain.handle('browser:action', async (_, payload) => {
    return await browserAction(payload);
  });

  ipcMain.handle('browser:readPage', async (_, payload) => {
    return await readBrowserPage(payload);
  });

  // Image Generation IPC
  ipcMain.handle('image:generate', async (_, payload) => {
    const ws = payload?.projectId ? getWorkspaceRootForProject(payload.projectId) : configStore.get().workspacePath;
    return await generateImage({
      prompt: payload.prompt,
      imageName: payload.imageName,
      size: payload.size,
      style: payload.style,
      configStore,
      workspacePath: ws
    });
  });

  // Question / Decision Human-in-the-loop IPC
  ipcMain.handle('agent:submitQuestionAnswer', (_, questionId, answers) => {
    return orchestrator.resolveQuestion(questionId, answers);
  });

  // Browser Takeover & Human Assistance IPC
  ipcMain.handle('browser:takeControl', async () => {
    const browser = getDefaultBrowser();
    const win = await browser.getOrCreateWindow();
    win.show();
    win.focus();
    return { success: true };
  });

  ipcMain.handle('browser:handBack', (_, notes) => {
    return handBackBrowser(notes);
  });

  ipcMain.handle('agent:resolveBrowserTakeover', (_, takeoverId, notes) => {
    return orchestrator.resolveBrowserTakeover(takeoverId, notes);
  });

  // you.me User Profile Memory IPC
  ipcMain.handle('memory:getYouMe', () => {
    return getYouMeStore().get();
  });

  ipcMain.handle('memory:saveYouMeRaw', (_, content) => {
    return getYouMeStore().saveRaw(content);
  });

  ipcMain.handle('memory:updateYouMe', (_, fields) => {
    return getYouMeStore().update(fields);
  });

  ipcMain.handle('memory:getAll', () => {
    return getMemoryStore().getAll();
  });

  ipcMain.handle('memory:updateProfile', (_, profile) => {
    return getMemoryStore().updateProfile(profile);
  });

  ipcMain.handle('memory:addFact', (_, fact) => {
    return getMemoryStore().addFact(fact);
  });

  ipcMain.handle('memory:deleteFact', (_, id) => {
    return getMemoryStore().deleteFact(id);
  });

  // AI Skills Framework IPC
  ipcMain.handle('skills:list', (_, projectId) => {
    const ws = projectId ? getWorkspaceRootForProject(projectId) : null;
    return getSkillsManager().listSkills(ws);
  });

  ipcMain.handle('skills:searchHub', async (_, query) => {
    return await getSkillsManager().searchSkillsHub(query);
  });

  ipcMain.handle('skills:install', async (_, payload) => {
    return await getSkillsManager().installSkill(payload);
  });

  ipcMain.handle('skills:uninstall', async (_, payload) => {
    return await getSkillsManager().uninstallSkill(payload);
  });

  // Snapshot Management
  ipcMain.handle('workspace:getSnapshots', (_, projectId, fileRelPath) => {
    const ws = getWorkspaceRootForProject(projectId);
    return getSnapshots(ws, fileRelPath);
  });

  ipcMain.handle('workspace:revertSnapshot', (_, snapshotId, projectId) => {
    const ws = getWorkspaceRootForProject(projectId);
    return revertSnapshot(ws, snapshotId);
  });

  ipcMain.handle('workspace:getFileContent', (_, projectId, fileRelPath) => {
    const ws = getWorkspaceRootForProject(projectId);
    return getFileContent(ws, fileRelPath);
  });

  ipcMain.handle('workspace:getMemory', (_, projectId) => {
    const ws = getWorkspaceRootForProject(projectId);
    return getProjectMemory(ws);
  });

  ipcMain.handle('workspace:saveMemory', (_, projectId, memoryData) => {
    const ws = getWorkspaceRootForProject(projectId);
    return saveProjectMemory(ws, memoryData);
  });

  ipcMain.handle('workspace:getChangelog', (_, projectId) => {
    const ws = getWorkspaceRootForProject(projectId);
    return getProjectChangelog(ws);
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
    const turnKey = payload.sessionId || 'default';
    if (activeTurnControllers.has(turnKey)) {
      try {
        activeTurnControllers.get(turnKey).abort();
      } catch (_) {}
    }
    const ac = new AbortController();
    activeTurnControllers.set(turnKey, ac);

    const taskTitle = payload.sessionTitle || payload.title || (payload.userMessage ? payload.userMessage.slice(0, 28) : 'Chat Task');
    activeTaskMeta.set(turnKey, {
      title: taskTitle,
      startTime: Date.now()
    });
    updateTrayMenu();

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
        customPrompt: payload.customPrompt,
        onToken: (tok) => {
          if (!ac.signal.aborted) sender.send('agent:stream-token', { sessionId: turnKey, token: tok });
        },
        onThought: (th) => {
          if (!ac.signal.aborted) sender.send('agent:stream-thought', { sessionId: turnKey, thought: th });
        },
        onToolStart: (toolInfo) => {
          if (!ac.signal.aborted) sender.send('agent:tool-start', { sessionId: turnKey, tool: toolInfo });
        },
        onToolResult: (resInfo) => {
          if (!ac.signal.aborted) sender.send('agent:tool-result', { sessionId: turnKey, result: resInfo });
        },
        onFallback: (fbInfo) => {
          if (!ac.signal.aborted) sender.send('agent:fallback', { sessionId: turnKey, fallback: fbInfo });
        },
        onAskQuestion: (qData) => {
          if (!ac.signal.aborted) sender.send('agent:ask-question', { sessionId: turnKey, question: qData });
        },
        onBrowserTakeover: (takeoverData) => {
          if (!ac.signal.aborted) sender.send('agent:browser-takeover', { sessionId: turnKey, takeover: takeoverData });
        },
        signal: ac.signal
      });

      // Dispatch desktop notification if window is minimized, hidden, or not focused
      if (result && !ac.signal.aborted) {
        if (!mainWindow || !mainWindow.isVisible() || mainWindow.isMinimized() || !mainWindow.isFocused()) {
          dispatchNativeNotification('Eyqa: Task Complete', `Finished response in "${taskTitle}"`, turnKey);
        }
      }

      return {
        success: true,
        result
      };
    } catch (err) {
      if (ac.signal.aborted) {
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
      if (activeTurnControllers.get(turnKey) === ac) {
        activeTurnControllers.delete(turnKey);
      }
      activeTaskMeta.delete(turnKey);
      updateTrayMenu();
    }
  });

  ipcMain.handle('agent:stopTurn', (_, sessionId) => {
    let stopped = false;
    if (sessionId && activeTurnControllers.has(sessionId)) {
      activeTurnControllers.get(sessionId).abort();
      activeTurnControllers.delete(sessionId);
      activeTaskMeta.delete(sessionId);
      updateTrayMenu();
      stopped = true;
    } else {
      for (const [, controller] of activeTurnControllers.entries()) {
        controller.abort();
        stopped = true;
      }
      activeTurnControllers.clear();
      activeTaskMeta.clear();
      updateTrayMenu();
    }
    return stopped;
  });

  // Native Notification IPC
  ipcMain.handle('notification:show', (_, title, body, sessionId) => {
    dispatchNativeNotification(title, body, sessionId);
    return true;
  });

  // Embedded FCC Background Service IPC
  ipcMain.handle('fcc:getStatus', () => fccService.getStatus());
  ipcMain.handle('fcc:getLogs', () => fccService.getLogs());
  ipcMain.handle('fcc:restart', async () => await fccService.restart());
  ipcMain.handle('fcc:stop', async () => await fccService.stop());
  ipcMain.handle('fcc:start', async () => await fccService.start());

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
    if (mainWindow) {
      if (!isQuitting) {
        mainWindow.hide();
      } else {
        mainWindow.close();
      }
    }
  });
}

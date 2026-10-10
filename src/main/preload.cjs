/**
 * Eyqa Electron Preload Script
 * Safely bridges Electron Main IPC methods to Renderer via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyqaApi', {
  // Config & Settings
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  saveSettings: (partial) => ipcRenderer.invoke('store:saveSettings', partial),
  updateProvider: (id, data) => ipcRenderer.invoke('store:updateProvider', id, data),
  testProvider: (id, customConfig) => ipcRenderer.invoke('tools:testProvider', id, customConfig),

  // Session & Conversations
  getSessions: () => ipcRenderer.invoke('store:getSessions'),
  getSession: (id) => ipcRenderer.invoke('store:getSession', id),
  createSession: (title, mode) => ipcRenderer.invoke('store:createSession', title, mode),
  saveSession: (session) => ipcRenderer.invoke('store:saveSession', session),
  deleteSession: (id) => ipcRenderer.invoke('store:deleteSession', id),

  // File Dialogs & Workspace
  selectWorkspaceFolder: () => ipcRenderer.invoke('dialog:selectWorkspaceFolder'),
  selectAttachmentFile: () => ipcRenderer.invoke('dialog:selectAttachmentFile'),
  listWorkspace: (subDir) => ipcRenderer.invoke('tools:listWorkspace', subDir),
  readWorkspaceFile: (relPath) => ipcRenderer.invoke('tools:readWorkspaceFile', relPath),
  writeWorkspaceFile: (relPath, content) => ipcRenderer.invoke('tools:writeWorkspaceFile', relPath, content),

  // Direct Tools
  searchWeb: (query, maxResults) => ipcRenderer.invoke('tools:searchWeb', query, maxResults),
  fetchWebpage: (url) => ipcRenderer.invoke('tools:fetchWebpage', url),

  // Agent Streaming Execution
  startTurn: (turnPayload) => ipcRenderer.invoke('agent:startTurn', turnPayload),
  stopTurn: () => ipcRenderer.invoke('agent:stopTurn'),

  // Stream Event Listeners
  onStreamToken: (callback) => {
    const handler = (_, token) => callback(token);
    ipcRenderer.on('agent:stream-token', handler);
    return () => ipcRenderer.removeListener('agent:stream-token', handler);
  },
  onStreamThought: (callback) => {
    const handler = (_, thought) => callback(thought);
    ipcRenderer.on('agent:stream-thought', handler);
    return () => ipcRenderer.removeListener('agent:stream-thought', handler);
  },
  onToolStart: (callback) => {
    const handler = (_, toolInfo) => callback(toolInfo);
    ipcRenderer.on('agent:tool-start', handler);
    return () => ipcRenderer.removeListener('agent:tool-start', handler);
  },
  onToolResult: (callback) => {
    const handler = (_, resultInfo) => callback(resultInfo);
    ipcRenderer.on('agent:tool-result', handler);
    return () => ipcRenderer.removeListener('agent:tool-result', handler);
  },
  onFallback: (callback) => {
    const handler = (_, fallbackInfo) => callback(fallbackInfo);
    ipcRenderer.on('agent:fallback', handler);
    return () => ipcRenderer.removeListener('agent:fallback', handler);
  },

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // App Metadata
  platform: process.platform,
  version: '1.0.0'
});

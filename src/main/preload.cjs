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
  listProjects: () => ipcRenderer.invoke('store:listProjects'),
  createProject: (name, folderPath, folderName, extraProps) => ipcRenderer.invoke('store:createProject', name, folderPath, folderName, extraProps),
  updateProject: (id, updates) => ipcRenderer.invoke('store:updateProject', id, updates),
  deleteProject: (id) => ipcRenderer.invoke('store:deleteProject', id),
  getSessions: () => ipcRenderer.invoke('store:getSessions'),
  getSession: (id) => ipcRenderer.invoke('store:getSession', id),
  createSession: (title, projectId) => ipcRenderer.invoke('store:createSession', title, projectId),
  saveSession: (session) => ipcRenderer.invoke('store:saveSession', session),
  deleteSession: (id) => ipcRenderer.invoke('store:deleteSession', id),

  // File Dialogs & Workspace
  selectWorkspaceFolder: () => ipcRenderer.invoke('dialog:selectWorkspaceFolder'),
  selectAttachmentFile: () => ipcRenderer.invoke('dialog:selectAttachmentFile'),
  listWorkspace: (subDir) => ipcRenderer.invoke('tools:listWorkspace', subDir),
  readWorkspaceFile: (relPath) => ipcRenderer.invoke('tools:readWorkspaceFile', relPath),
  writeWorkspaceFile: (relPath, content) => ipcRenderer.invoke('tools:writeWorkspaceFile', relPath, content),
  replaceFileContent: (relPath, oldContent, newContent, startLine, endLine, allowMultiple) => ipcRenderer.invoke('tools:replaceFileContent', relPath, oldContent, newContent, startLine, endLine, allowMultiple),
  viewFile: (relPath, startLine, endLine, offset) => ipcRenderer.invoke('tools:viewFile', relPath, startLine, endLine, offset),

  // Terminal & Process Management
  runCommand: (options) => ipcRenderer.invoke('terminal:runCommand', options),
  manageTask: (options) => ipcRenderer.invoke('terminal:manageTask', options),

  // Browser Engine
  browserNavigate: (url, timeoutMs) => ipcRenderer.invoke('browser:navigate', url, timeoutMs),
  browserAction: (payload) => ipcRenderer.invoke('browser:action', payload),
  readBrowserPage: (payload) => ipcRenderer.invoke('browser:readPage', payload),

  // Image Generation
  generateImage: (payload) => ipcRenderer.invoke('image:generate', payload),

  // Interactive Decisions (ask_question)
  submitQuestionAnswer: (questionId, answers) => ipcRenderer.invoke('agent:submitQuestionAnswer', questionId, answers),

  // Snapshot Management
  getSnapshots: (projectId, fileRelPath) => ipcRenderer.invoke('workspace:getSnapshots', projectId, fileRelPath),
  revertSnapshot: (snapshotId, projectId) => ipcRenderer.invoke('workspace:revertSnapshot', snapshotId, projectId),
  getFileContent: (projectId, fileRelPath) => ipcRenderer.invoke('workspace:getFileContent', projectId, fileRelPath),
  getProjectMemory: (projectId) => ipcRenderer.invoke('workspace:getMemory', projectId),
  saveProjectMemory: (projectId, memoryData) => ipcRenderer.invoke('workspace:saveMemory', projectId, memoryData),
  getProjectChangelog: (projectId) => ipcRenderer.invoke('workspace:getChangelog', projectId),

  // Direct Tools
  searchWeb: (query, maxResults) => ipcRenderer.invoke('tools:searchWeb', query, maxResults),
  fetchWebpage: (url) => ipcRenderer.invoke('tools:fetchWebpage', url),

  // Agent Streaming Execution
  startTurn: (turnPayload) => ipcRenderer.invoke('agent:startTurn', turnPayload),
  stopTurn: (sessionId = null) => ipcRenderer.invoke('agent:stopTurn', sessionId),

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
  onAskQuestion: (callback) => {
    const handler = (_, qData) => callback(qData);
    ipcRenderer.on('agent:ask-question', handler);
    return () => ipcRenderer.removeListener('agent:ask-question', handler);
  },
  onBrowserTakeover: (callback) => {
    const handler = (_, takeoverData) => callback(takeoverData);
    ipcRenderer.on('agent:browser-takeover', handler);
    return () => ipcRenderer.removeListener('agent:browser-takeover', handler);
  },

  // Browser Takeover & Human Assistance
  takeBrowserControl: () => ipcRenderer.invoke('browser:takeControl'),
  handBackBrowserControl: (notes) => ipcRenderer.invoke('browser:handBack', notes),
  resolveBrowserTakeover: (takeoverId, notes) => ipcRenderer.invoke('agent:resolveBrowserTakeover', takeoverId, notes),

  // you.me User Profile Memory
  getYouMe: () => ipcRenderer.invoke('memory:getYouMe'),
  saveYouMeRaw: (content) => ipcRenderer.invoke('memory:saveYouMeRaw', content),
  updateYouMe: (fields) => ipcRenderer.invoke('memory:updateYouMe', fields),
  getUniversalMemory: () => ipcRenderer.invoke('memory:getAll'),
  updateUniversalProfile: (profile) => ipcRenderer.invoke('memory:updateProfile', profile),
  addUniversalFact: (fact) => ipcRenderer.invoke('memory:addFact', fact),
  deleteUniversalFact: (id) => ipcRenderer.invoke('memory:deleteFact', id),

  // AI Skills Framework
  listSkills: (projectId) => ipcRenderer.invoke('skills:list', projectId),
  searchSkillsHub: (query) => ipcRenderer.invoke('skills:searchHub', query),
  installSkill: (payload) => ipcRenderer.invoke('skills:install', payload),

  // Embedded FCC Background Service
  getFCCStatus: () => ipcRenderer.invoke('fcc:getStatus'),
  getFCCLogs: () => ipcRenderer.invoke('fcc:getLogs'),
  restartFCCService: () => ipcRenderer.invoke('fcc:restart'),
  stopFCCService: () => ipcRenderer.invoke('fcc:stop'),
  startFCCService: () => ipcRenderer.invoke('fcc:start'),

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // App Metadata
  platform: process.platform,
  version: '1.0.0'
});

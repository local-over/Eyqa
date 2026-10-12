/**
 * Eyqa Universal Client API
 * Seamlessly interfaces with Electron native IPC via window.eyqaApi
 * when running as a desktop app, or REST/SSE endpoints in browser mode.
 */

const isElectron = Boolean(window.eyqaApi);

export const api = {
  isElectron,

  // Settings
  async getSettings() {
    if (isElectron) return await window.eyqaApi.getSettings();
    const res = await fetch('/api/settings');
    return await res.json();
  },

  async saveSettings(partial) {
    if (isElectron) return await window.eyqaApi.saveSettings(partial);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial)
    });
    return await res.json();
  },

  async updateProvider(id, data) {
    if (isElectron) return await window.eyqaApi.updateProvider(id, data);
    const settings = await this.getSettings();
    if (!settings.providers) settings.providers = {};
    if (settings.providers[id]) {
      settings.providers[id] = { ...settings.providers[id], ...data };
    } else {
      settings.providers[id] = data;
    }
    return await this.saveSettings(settings);
  },

  async testProvider(id, customConfig = null) {
    if (isElectron) return await window.eyqaApi.testProvider(id, customConfig);
    const res = await fetch('/api/provider/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, config: customConfig })
    });
    return await res.json();
  },

  // Projects
  async listProjects() {
    if (isElectron) return await window.eyqaApi.listProjects();
    const res = await fetch('/api/projects');
    return await res.json();
  },

  async createProject(name, folderPath = null, folderName = null, extraProps = {}) {
    if (isElectron) return await window.eyqaApi.createProject(name, folderPath, folderName, extraProps);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, folderPath, folderName, ...extraProps })
    });
    return await res.json();
  },

  async updateProject(id, updates) {
    if (isElectron) return await window.eyqaApi.updateProject(id, updates);
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await res.json();
  },

  async deleteProject(id) {
    if (isElectron) return await window.eyqaApi.deleteProject(id);
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  // Sessions (Chats)
  async getSessions() {
    if (isElectron) return await window.eyqaApi.getSessions();
    const res = await fetch('/api/sessions');
    return await res.json();
  },

  async getSession(id) {
    if (isElectron) return await window.eyqaApi.getSession(id);
    const res = await fetch(`/api/sessions/${id}`);
    return await res.json();
  },

  async createSession(title, projectId = null) {
    if (isElectron) return await window.eyqaApi.createSession(title, projectId);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, projectId })
    });
    return await res.json();
  },

  async saveSession(session) {
    if (isElectron) return await window.eyqaApi.saveSession(session);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session)
    });
    return await res.json();
  },

  async deleteSession(id) {
    if (isElectron) return await window.eyqaApi.deleteSession(id);
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    return await res.json();
  },

  // File & Workspace Dialogs
  async selectWorkspaceFolder() {
    if (isElectron) return await window.eyqaApi.selectWorkspaceFolder();
    return null;
  },

  async selectAttachmentFile() {
    if (isElectron) return await window.eyqaApi.selectAttachmentFile();
    return null;
  },

  async listWorkspace(subDir = '') {
    if (isElectron) return await window.eyqaApi.listWorkspace(subDir);
    return { count: 0, items: [] };
  },

  async readWorkspaceFile(relPath) {
    if (isElectron) return await window.eyqaApi.readWorkspaceFile(relPath);
    return { error: 'Workspace direct file reading requires native desktop app' };
  },

  async writeWorkspaceFile(relPath, content) {
    if (isElectron) return await window.eyqaApi.writeWorkspaceFile(relPath, content);
    return { error: 'Workspace file writing requires native desktop app' };
  },

  // Snapshot Management
  async getSnapshots(projectId, fileRelPath) {
    if (isElectron) return await window.eyqaApi.getSnapshots(projectId, fileRelPath);
    const res = await fetch(`/api/workspace/snapshots?projectId=${projectId}&fileRelPath=${encodeURIComponent(fileRelPath)}`);
    return await res.json();
  },

  async revertSnapshot(snapshotId, projectId) {
    if (isElectron) return await window.eyqaApi.revertSnapshot(snapshotId, projectId);
    const res = await fetch(`/api/workspace/snapshots/${snapshotId}/revert`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    return await res.json();
  },

  async getFileContent(projectId, fileRelPath) {
    if (isElectron) return await window.eyqaApi.getFileContent(projectId, fileRelPath);
    const res = await fetch(`/api/workspace/file?projectId=${projectId}&fileRelPath=${encodeURIComponent(fileRelPath)}`);
    return await res.json();
  },

  async getProjectMemory(projectId) {
    if (isElectron && window.eyqaApi.getProjectMemory) return await window.eyqaApi.getProjectMemory(projectId);
    return { notes: '', architecture: '' };
  },

  async saveProjectMemory(projectId, memoryData) {
    if (isElectron && window.eyqaApi.saveProjectMemory) return await window.eyqaApi.saveProjectMemory(projectId, memoryData);
    return { success: false };
  },

  async getProjectChangelog(projectId) {
    if (isElectron && window.eyqaApi.getProjectChangelog) return await window.eyqaApi.getProjectChangelog(projectId);
    return [];
  },

  // Tools
  async searchWeb(query, maxResults = 5) {
    if (isElectron) return await window.eyqaApi.searchWeb(query, maxResults);
    return { error: 'Direct search API' };
  },

  async fetchWebpage(url) {
    if (isElectron) return await window.eyqaApi.fetchWebpage(url);
    return { error: 'Direct fetch API' };
  },

  async replaceFileContent(relPath, oldContent, newContent, startLine, endLine, allowMultiple) {
    if (isElectron && window.eyqaApi.replaceFileContent) {
      return await window.eyqaApi.replaceFileContent(relPath, oldContent, newContent, startLine, endLine, allowMultiple);
    }
    return { error: 'Precision file replacement requires native desktop app' };
  },

  async viewFile(relPath, startLine, endLine, offset) {
    if (isElectron && window.eyqaApi.viewFile) {
      return await window.eyqaApi.viewFile(relPath, startLine, endLine, offset);
    }
    return { error: 'Sliced file viewer requires native desktop app' };
  },

  // Terminal Execution
  async runCommand(options) {
    if (isElectron && window.eyqaApi.runCommand) {
      return await window.eyqaApi.runCommand(options);
    }
    return { error: 'Terminal execution requires native desktop app' };
  },

  async manageTask(options) {
    if (isElectron && window.eyqaApi.manageTask) {
      return await window.eyqaApi.manageTask(options);
    }
    return { error: 'Task management requires native desktop app' };
  },

  // Browser Engine
  async browserNavigate(url, timeoutMs) {
    if (isElectron && window.eyqaApi.browserNavigate) {
      return await window.eyqaApi.browserNavigate(url, timeoutMs);
    }
    return { error: 'Browser navigation requires native desktop app' };
  },

  async browserAction(payload) {
    if (isElectron && window.eyqaApi.browserAction) {
      return await window.eyqaApi.browserAction(payload);
    }
    return { error: 'Browser actions require native desktop app' };
  },

  async readBrowserPage(payload) {
    if (isElectron && window.eyqaApi.readBrowserPage) {
      return await window.eyqaApi.readBrowserPage(payload);
    }
    return { error: 'Browser reading requires native desktop app' };
  },

  // Image Generation
  async generateImage(payload) {
    if (isElectron && window.eyqaApi.generateImage) {
      return await window.eyqaApi.generateImage(payload);
    }
    return { error: 'Image generation requires native desktop app' };
  },

  // Interactive Decisions
  async submitQuestionAnswer(questionId, answers) {
    if (isElectron && window.eyqaApi.submitQuestionAnswer) {
      return await window.eyqaApi.submitQuestionAnswer(questionId, answers);
    }
    return { success: false };
  },

  // Browser Takeover & Human Assistance
  async takeBrowserControl() {
    if (isElectron && window.eyqaApi.takeBrowserControl) {
      return await window.eyqaApi.takeBrowserControl();
    }
    return { success: false };
  },

  async handBackBrowserControl(notes = null) {
    if (isElectron && window.eyqaApi.handBackBrowserControl) {
      return await window.eyqaApi.handBackBrowserControl(notes);
    }
    return { success: false };
  },

  async resolveBrowserTakeover(takeoverId, notes = null) {
    if (isElectron && window.eyqaApi.resolveBrowserTakeover) {
      return await window.eyqaApi.resolveBrowserTakeover(takeoverId, notes);
    }
    return { success: false };
  },

  // Universal Dynamic Memory
  async getUniversalMemory() {
    if (isElectron && window.eyqaApi.getUniversalMemory) {
      return await window.eyqaApi.getUniversalMemory();
    }
    return { userProfile: {}, learnedFacts: [] };
  },

  async updateUniversalProfile(profile) {
    if (isElectron && window.eyqaApi.updateUniversalProfile) {
      return await window.eyqaApi.updateUniversalProfile(profile);
    }
    return {};
  },

  async addUniversalFact(fact) {
    if (isElectron && window.eyqaApi.addUniversalFact) {
      return await window.eyqaApi.addUniversalFact(fact);
    }
    return {};
  },

  async deleteUniversalFact(id) {
    if (isElectron && window.eyqaApi.deleteUniversalFact) {
      return await window.eyqaApi.deleteUniversalFact(id);
    }
    return false;
  },

  // AI Skills Framework
  async listSkills(projectId = null) {
    if (isElectron && window.eyqaApi.listSkills) {
      return await window.eyqaApi.listSkills(projectId);
    }
    return [];
  },

  async searchSkillsHub(query) {
    if (isElectron && window.eyqaApi.searchSkillsHub) {
      return await window.eyqaApi.searchSkillsHub(query);
    }
    return { success: false };
  },

  async installSkill(payload) {
    if (isElectron && window.eyqaApi.installSkill) {
      return await window.eyqaApi.installSkill(payload);
    }
    return { success: false };
  },

  // Turn Execution
  async startTurn(payload, handlers = {}) {
    if (isElectron) {
      const unsubs = [];
      if (handlers.onToken) unsubs.push(window.eyqaApi.onStreamToken(handlers.onToken));
      if (handlers.onThought) unsubs.push(window.eyqaApi.onStreamThought(handlers.onThought));
      if (handlers.onToolStart) unsubs.push(window.eyqaApi.onToolStart(handlers.onToolStart));
      if (handlers.onToolResult) unsubs.push(window.eyqaApi.onToolResult(handlers.onToolResult));
      if (handlers.onFallback) unsubs.push(window.eyqaApi.onFallback(handlers.onFallback));
      if (handlers.onAskQuestion) unsubs.push(window.eyqaApi.onAskQuestion(handlers.onAskQuestion));
      if (handlers.onBrowserTakeover && window.eyqaApi.onBrowserTakeover) {
        unsubs.push(window.eyqaApi.onBrowserTakeover(handlers.onBrowserTakeover));
      }

      try {
        const res = await window.eyqaApi.startTurn(payload);
        return res;
      } finally {
        unsubs.forEach(unsub => unsub());
      }
    } else {
      // Browser SSE mode
      const res = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        let doneResult = null;
        let errorMessage = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'token' && handlers.onToken) handlers.onToken(data);
              else if (currentEvent === 'thought' && handlers.onThought) handlers.onThought(data);
              else if (currentEvent === 'tool-start' && handlers.onToolStart) handlers.onToolStart(data);
              else if (currentEvent === 'tool-result' && handlers.onToolResult) handlers.onToolResult(data);
              else if (currentEvent === 'fallback' && handlers.onFallback) handlers.onFallback(data);
              else if (currentEvent === 'done') doneResult = data;
              else if (currentEvent === 'error') errorMessage = data;
            } catch (e) {
              // Ignore non-json chunk
            }
          }
        }
      }

      if (errorMessage) {
        return { success: false, error: errorMessage };
      }
      return { success: true, result: doneResult };
    }
  },

  async stopTurn() {
    if (isElectron) return await window.eyqaApi.stopTurn();
    return false;
  },

  // Embedded FCC Background Service
  async getFCCStatus() {
    if (isElectron) return await window.eyqaApi.getFCCStatus();
    return { running: false, status: 'stopped', port: 8082, isEmbedded: true };
  },

  async getFCCLogs() {
    if (isElectron) return await window.eyqaApi.getFCCLogs();
    return [];
  },

  async restartFCCService() {
    if (isElectron) return await window.eyqaApi.restartFCCService();
    return { success: false };
  },

  async stopFCCService() {
    if (isElectron) return await window.eyqaApi.stopFCCService();
    return { success: false };
  },

  async startFCCService() {
    if (isElectron) return await window.eyqaApi.startFCCService();
    return { success: false };
  }
};

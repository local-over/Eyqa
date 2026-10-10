/**
 * Eyqa Universal Client API
 * Seamlessly interfaces with Electron native IPC when running as a desktop app,
 * or standard REST/SSE endpoints when running in a web browser.
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
    if (settings.providers[id]) {
      settings.providers[id] = { ...settings.providers[id], ...data };
      return await this.saveSettings(settings);
    }
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

  // Sessions
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

  async createSession(title, mode) {
    if (isElectron) return await window.eyqaApi.createSession(title, mode);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, mode })
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

  // Tools
  async searchWeb(query, maxResults = 5) {
    if (isElectron) return await window.eyqaApi.searchWeb(query, maxResults);
    return { error: 'Direct search API' };
  },

  async fetchWebpage(url) {
    if (isElectron) return await window.eyqaApi.fetchWebpage(url);
    return { error: 'Direct fetch API' };
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
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === 'token' && handlers.onToken) handlers.onToken(data);
            if (currentEvent === 'thought' && handlers.onThought) handlers.onThought(data);
            if (currentEvent === 'tool-start' && handlers.onToolStart) handlers.onToolStart(data);
            if (currentEvent === 'tool-result' && handlers.onToolResult) handlers.onToolResult(data);
            if (currentEvent === 'fallback' && handlers.onFallback) handlers.onFallback(data);
          }
        }
      }

      return { success: true };
    }
  },

  async stopTurn() {
    if (isElectron) return await window.eyqaApi.stopTurn();
    return false;
  }
};

/**
 * Eyqa Project & Chat Store
 * Persists projects, chat threads, and messages.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

class SessionStore {
  constructor(customPath = null) {
    const baseDir = customPath || path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      'eyqa'
    );
    this.dataDir = path.join(baseDir, 'data');
    this.projectsFile = path.join(this.dataDir, 'projects.json');
    this.chatsFile = path.join(this.dataDir, 'chats.json');
    this.chatsDir = path.join(this.dataDir, 'chat_files');
    
    this.projects = [];
    this.chats = [];
    
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      if (!fs.existsSync(this.chatsDir)) fs.mkdirSync(this.chatsDir, { recursive: true });

      if (fs.existsSync(this.projectsFile)) {
        this.projects = JSON.parse(fs.readFileSync(this.projectsFile, 'utf8'));
      } else {
        this.projects = [];
        this.saveProjects();
      }

      if (fs.existsSync(this.chatsFile)) {
        this.chats = JSON.parse(fs.readFileSync(this.chatsFile, 'utf8'));
      } else {
        this.chats = [];
        this.saveChats();
      }
    } catch (err) {
      console.error('[SessionStore] Init failed:', err);
    }
  }

  _atomicWrite(filePath, data) {
    try {
      const tmpPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      console.error(`[SessionStore] Atomic write failed for ${filePath}:`, err);
      try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      } catch (_) {}
    }
  }

  saveProjects() {
    this._atomicWrite(this.projectsFile, this.projects);
  }

  saveChats() {
    this._atomicWrite(this.chatsFile, this.chats);
  }

  // --- PROJECTS API ---

  listProjects() {
    return this.projects.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  createProject(name, folderPath = null, folderName = null, extraProps = {}) {
    const id = 'proj_' + crypto.randomUUID().slice(0, 8);
    const now = Date.now();
    const proj = {
      id,
      name,
      folderPath,
      folderName,
      customPrompt: extraProps.customPrompt || '',
      modelConfig: extraProps.modelConfig || { mode: 'inherit' },
      createdAt: now,
      updatedAt: now,
      ...extraProps
    };
    this.projects.unshift(proj);
    this.saveProjects();
    return proj;
  }

  updateProject(id, updates) {
    const idx = this.projects.findIndex(p => p.id === id);
    if (idx >= 0) {
      this.projects[idx] = { ...this.projects[idx], ...updates, updatedAt: Date.now() };
      this.saveProjects();
      return this.projects[idx];
    }
    return null;
  }

  deleteProject(id) {
    this.projects = this.projects.filter(p => p.id !== id);
    this.saveProjects();
    
    // Batch cascading delete chats
    const toDelete = this.chats.filter(c => c.projectId === id);
    for (const chat of toDelete) {
      try {
        const filePath = path.join(this.chatsDir, `${chat.id}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (_) {}
    }
    this.chats = this.chats.filter(c => c.projectId !== id);
    this.saveChats();
    return true;
  }

  // --- CHATS API (Legacy 'Session' methods mapped to Chat) ---

  listSessions() {
    // UI expects flat list of chats, but we can group them by project on frontend
    return this.chats.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  createSession(title = 'New Thread', projectId = null) {
    // If no projectId, create a default project
    if (!projectId) {
      let defProj = this.projects.find(p => p.name === 'General');
      if (!defProj) {
        defProj = this.createProject('General');
      }
      projectId = defProj.id;
    }

    const id = 'chat_' + crypto.randomUUID().slice(0, 8);
    const now = Date.now();
    
    const chatInfo = {
      id,
      projectId,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      preview: 'Start a new conversation'
    };

    const chatData = {
      ...chatInfo,
      messages: []
    };

    // Save individual chat file
    fs.writeFileSync(path.join(this.chatsDir, `${id}.json`), JSON.stringify(chatData, null, 2), 'utf8');

    // Update index
    this.chats.unshift(chatInfo);
    this.saveChats();
    
    // Touch project
    this.updateProject(projectId, {});

    const proj = this.projects.find(p => p.id === projectId);
    if (proj) {
      chatData.folderPath = proj.folderPath || null;
      chatData.folderName = proj.folderName || null;
    }

    return chatData;
  }

  getSession(id) {
    try {
      const filePath = path.join(this.chatsDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        const chat = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (chat.projectId) {
          const proj = this.projects.find(p => p.id === chat.projectId);
          if (proj) {
            chat.folderPath = proj.folderPath;
            chat.folderName = proj.folderName;
          }
        }
        return chat;
      }
    } catch (err) {
      console.error(`[SessionStore] Failed to load chat ${id}:`, err);
    }
    return null;
  }

  saveSession(session) {
    if (!session || !session.id) return;
    try {
      session.updatedAt = Date.now();
      fs.writeFileSync(path.join(this.chatsDir, `${session.id}.json`), JSON.stringify(session, null, 2), 'utf8');

      // Update index entry
      const lastMsg = session.messages && session.messages.length > 0 
        ? session.messages[session.messages.length - 1] 
        : null;

      const preview = lastMsg 
        ? (lastMsg.content || '').slice(0, 90).replace(/\n/g, ' ') 
        : 'Empty session';

      const idx = this.chats.findIndex(c => c.id === session.id);
      if (idx >= 0) {
        this.chats[idx].title = session.title || 'Untitled';
        this.chats[idx].updatedAt = session.updatedAt;
        this.chats[idx].messageCount = (session.messages || []).length;
        this.chats[idx].preview = preview;
      }
      this.saveChats();
      
      if (session.projectId) {
        this.updateProject(session.projectId, {});
      }
    } catch (err) {
      console.error(`[SessionStore] Failed to save chat ${session.id}:`, err);
    }
  }

  deleteSession(id) {
    try {
      const filePath = path.join(this.chatsDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.chats = this.chats.filter(c => c.id !== id);
      this.saveChats();
      return true;
    } catch (err) {
      console.error(`[SessionStore] Failed to delete chat ${id}:`, err);
      return false;
    }
  }
}

module.exports = {
  SessionStore
};

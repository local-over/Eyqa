/**
 * Eyqa Chat Sessions Store
 * Persists conversations, messages, thinking blocks, and coworker artifacts.
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
    this.sessionsDir = path.join(baseDir, 'sessions');
    this.indexFile = path.join(baseDir, 'sessions_index.json');
    this.index = [];
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }

      if (fs.existsSync(this.indexFile)) {
        const raw = fs.readFileSync(this.indexFile, 'utf8');
        this.index = JSON.parse(raw);
      } else {
        this.index = [];
        this.saveIndex();
      }
    } catch (err) {
      console.error('[SessionStore] Init failed:', err);
      this.index = [];
    }
  }

  saveIndex() {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(this.index, null, 2), 'utf8');
    } catch (err) {
      console.error('[SessionStore] Failed to write index:', err);
    }
  }

  listSessions() {
    return this.index.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  createSession(initialTitle = 'New Conversation', mode = 'chat', folder = null) {
    const id = 'sess_' + crypto.randomUUID().slice(0, 8);
    const now = Date.now();
    const session = {
      id,
      title: initialTitle,
      mode,
      folderPath: folder?.path || null,
      folderName: folder?.name || null,
      createdAt: now,
      updatedAt: now,
      messages: [],
      artifacts: []
    };

    // Save individual session file
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');

    // Update index
    this.index.unshift({
      id,
      title: initialTitle,
      mode,
      folderPath: session.folderPath,
      folderName: session.folderName,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      preview: 'Start a new conversation'
    });
    this.saveIndex();

    return session;
  }

  getSession(id) {
    try {
      const filePath = path.join(this.sessionsDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error(`[SessionStore] Failed to load session ${id}:`, err);
    }
    return null;
  }

  saveSession(session) {
    if (!session || !session.id) return;
    try {
      session.updatedAt = Date.now();
      const filePath = path.join(this.sessionsDir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');

      // Update index entry
      const lastMsg = session.messages && session.messages.length > 0 
        ? session.messages[session.messages.length - 1] 
        : null;

      const preview = lastMsg 
        ? (lastMsg.content || '').slice(0, 90).replace(/\n/g, ' ') 
        : 'Empty session';

      const idx = this.index.findIndex(s => s.id === session.id);
      const summary = {
        id: session.id,
        title: session.title || 'Untitled',
        mode: session.mode || 'chat',
        folderPath: session.folderPath || null,
        folderName: session.folderName || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: (session.messages || []).length,
        preview
      };

      if (idx >= 0) {
        this.index[idx] = summary;
      } else {
        this.index.unshift(summary);
      }
      this.saveIndex();
    } catch (err) {
      console.error(`[SessionStore] Failed to save session ${session.id}:`, err);
    }
  }

  deleteSession(id) {
    try {
      const filePath = path.join(this.sessionsDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.index = this.index.filter(s => s.id !== id);
      this.saveIndex();
      return true;
    } catch (err) {
      console.error(`[SessionStore] Failed to delete session ${id}:`, err);
      return false;
    }
  }
}

module.exports = {
  SessionStore
};

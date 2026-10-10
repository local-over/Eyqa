/**
 * Eyqa Main Application Controller
 * Clean ChatGPT & Claude Desktop UI wrapper.
 * Pure conversation mode vs Project/Folder mode.
 */

import { icons } from './icons.js';
import { api } from './api.js';
import { ChatView } from './chat-view.js';
import { SettingsView } from './settings-view.js';

class EyqaApp {
  constructor() {
    this.settings = null;
    this.sessions = [];
    this.currentSession = null;
    this.attachedFile = null;
    this.isGenerating = false;
    this.forceWebSearch = false;
    this.sidebarCollapsed = false;

    // View Components
    this.chatView = null;
    this.settingsView = null;
  }

  async init() {
    // 1. Load initial settings
    this.settings = await api.getSettings();
    document.body.className = `theme-${this.settings.appearance?.theme || 'dark'}`;

    // 2. Initialize Views
    const chatContainer = document.getElementById('chatMessagesContainer');
    const settingsModal = document.getElementById('settingsModal');

    this.chatView = new ChatView(
      chatContainer,
      (msg, type) => this.showToast(msg, type)
    );

    this.settingsView = new SettingsView(
      settingsModal,
      (msg, type) => this.showToast(msg, type),
      (newSettings) => this.onSettingsUpdated(newSettings)
    );

    // 3. Setup UI Controls
    this.setupSidebar();
    this.setupTopBar();
    this.setupDockInput();
    this.setupShortcuts();

    // 4. Load Sessions
    await this.loadSessions();

    // 5. Select or create session
    if (this.sessions.length > 0) {
      await this.selectSession(this.sessions[0].id);
    } else {
      await this.createNewChat();
    }

    this.updateModelLabels();
  }

  async loadSessions() {
    this.sessions = await api.getSessions();
    this.renderSidebarLists();
  }

  renderSidebarLists() {
    const chatsListEl = document.getElementById('sidebarChatsList');
    const foldersListEl = document.getElementById('sidebarFoldersList');

    if (!chatsListEl || !foldersListEl) return;

    const chats = this.sessions.filter(s => !s.folderPath);
    const folderProjects = this.sessions.filter(s => Boolean(s.folderPath));

    // Render Standard Chats (When we just chat)
    if (chats.length === 0) {
      chatsListEl.innerHTML = `<div class="sidebar-empty-state">No conversations yet</div>`;
    } else {
      chatsListEl.innerHTML = chats.map(s => this._renderSidebarItem(s, false)).join('');
    }

    // Render Folder Projects (When working in a folder)
    if (folderProjects.length === 0) {
      foldersListEl.innerHTML = `<div class="sidebar-empty-state">No linked folders yet. Click &ldquo;Open Folder&rdquo; to work with local files.</div>`;
    } else {
      foldersListEl.innerHTML = folderProjects.map(s => this._renderSidebarItem(s, true)).join('');
    }

    // Attach item events
    const allItems = [...chatsListEl.querySelectorAll('.sidebar-item'), ...foldersListEl.querySelectorAll('.sidebar-item')];
    allItems.forEach(el => {
      el.onclick = async () => {
        const id = el.dataset.id;
        if (id && (!this.currentSession || this.currentSession.id !== id)) {
          await this.selectSession(id);
        }
      };

      const delBtn = el.querySelector('.sidebar-item-delete');
      if (delBtn) {
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          const id = el.dataset.id;
          await api.deleteSession(id);
          await this.loadSessions();
          if (this.currentSession && this.currentSession.id === id) {
            if (this.sessions.length > 0) {
              await this.selectSession(this.sessions[0].id);
            } else {
              await this.createNewChat();
            }
          }
        };
      }
    });
  }

  _renderSidebarItem(session, isFolder) {
    const isActive = this.currentSession && this.currentSession.id === session.id;
    const icon = isFolder ? icons.folder : icons.messageSquare;
    const title = session.folderName || session.title || 'Conversation';

    return `
      <div class="sidebar-item ${isActive ? 'active' : ''}" data-id="${session.id}" title="${this._escape(session.folderPath || session.title)}">
        <div class="sidebar-item-body">
          <span class="sidebar-item-icon">${icon}</span>
          <span class="sidebar-item-title">${this._escape(title)}</span>
        </div>
        <button class="sidebar-item-delete" title="Delete conversation">${icons.trash}</button>
      </div>
    `;
  }

  async selectSession(id) {
    const fullSession = await api.getSession(id);
    if (!fullSession) return;

    this.currentSession = fullSession;
    this.chatView.setSession(this.currentSession);
    this.renderSidebarLists();
    this.updateTopBar();
    this.updateDockMeta();
  }

  async createNewChat() {
    const newSess = await api.createSession('New Chat', 'chat', null);
    this.currentSession = newSess;
    await this.loadSessions();
    this.chatView.setSession(this.currentSession);
    this.updateTopBar();
    this.updateDockMeta();

    const input = document.getElementById('chatInputTextarea');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  async openProjectFolder() {
    const folder = await api.selectWorkspaceFolder();
    if (!folder || !folder.path) return;

    const newSess = await api.createSession(folder.name || 'Project', 'project', folder);
    this.currentSession = newSess;
    await this.loadSessions();
    this.chatView.setSession(this.currentSession);
    this.updateTopBar();
    this.updateDockMeta();
    this.showToast(`Opened project folder: ${folder.name}`, 'success');

    const input = document.getElementById('chatInputTextarea');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  async linkFolderToCurrentChat() {
    const folder = await api.selectWorkspaceFolder();
    if (!folder || !folder.path) return;

    if (!this.currentSession) {
      await this.openProjectFolder();
      return;
    }

    this.currentSession.folderPath = folder.path;
    this.currentSession.folderName = folder.name;
    if (this.currentSession.title === 'New Chat' || this.currentSession.title === 'New Conversation') {
      this.currentSession.title = folder.name;
    }

    await api.saveSession(this.currentSession);
    await this.loadSessions();
    this.chatView.setSession(this.currentSession);
    this.updateTopBar();
    this.updateDockMeta();
    this.showToast(`Linked folder: ${folder.name}`, 'success');
  }

  async unlinkFolderFromCurrentChat() {
    if (!this.currentSession) return;

    this.currentSession.folderPath = null;
    this.currentSession.folderName = null;
    await api.saveSession(this.currentSession);
    await this.loadSessions();
    this.chatView.setSession(this.currentSession);
    this.updateTopBar();
    this.updateDockMeta();
    this.showToast('Unlinked folder. Back to general chat.', 'info');
  }

  setupSidebar() {
    // New Chat Action Button
    document.getElementById('btnNewChat')?.addEventListener('click', () => {
      this.createNewChat();
    });

    // Brand Home Click
    document.getElementById('brandHomeLink')?.addEventListener('click', () => {
      this.createNewChat();
    });

    // Open Folder in Sidebar
    document.getElementById('btnSidebarOpenFolder')?.addEventListener('click', () => {
      this.openProjectFolder();
    });

    // Open Settings Button
    document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
      this.settingsView.open();
    });
  }

  setupTopBar() {
    // Toggle Sidebar
    document.getElementById('btnToggleSidebar')?.addEventListener('click', () => {
      const sidebar = document.getElementById('appSidebar');
      if (sidebar) {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
      }
    });

    // Topbar Model Selector Button
    document.getElementById('topbarModelSelectorBtn')?.addEventListener('click', () => {
      this.settingsView.open();
    });

    // Topbar Unlink Folder Button
    document.getElementById('btnUnlinkFolder')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.unlinkFolderFromCurrentChat();
    });
  }

  updateTopBar() {
    const titleEl = document.getElementById('topbarSessionTitle');
    const folderBadgeEl = document.getElementById('topbarFolderBadge');
    const folderNameEl = document.getElementById('topbarFolderName');

    if (!this.currentSession) return;

    if (titleEl) {
      titleEl.textContent = this.currentSession.title || 'New Chat';
    }

    if (folderBadgeEl && folderNameEl) {
      if (this.currentSession.folderPath) {
        folderBadgeEl.hidden = false;
        folderNameEl.textContent = this.currentSession.folderName || 'Folder';
        folderBadgeEl.title = this.currentSession.folderPath;
      } else {
        folderBadgeEl.hidden = true;
      }
    }
  }

  updateDockMeta() {
    const metaBar = document.getElementById('dockMetaBar');
    const folderPill = document.getElementById('dockFolderPill');
    const folderName = document.getElementById('dockFolderName');
    const attachPill = document.getElementById('dockAttachmentPill');
    const attachName = document.getElementById('dockAttachmentName');
    const linkFolderBtn = document.getElementById('btnLinkFolder');
    const linkFolderLabel = document.getElementById('btnLinkFolderLabel');

    const hasFolder = Boolean(this.currentSession?.folderPath);
    const hasAttach = Boolean(this.attachedFile);

    if (metaBar) {
      metaBar.hidden = !hasFolder && !hasAttach;
    }

    if (folderPill && folderName) {
      if (hasFolder) {
        folderPill.hidden = false;
        folderName.textContent = `Folder: ${this.currentSession.folderName}`;
        folderPill.title = this.currentSession.folderPath;
      } else {
        folderPill.hidden = true;
      }
    }

    if (attachPill && attachName) {
      if (hasAttach) {
        attachPill.hidden = false;
        attachName.textContent = this.attachedFile.name;
      } else {
        attachPill.hidden = true;
      }
    }

    if (linkFolderBtn && linkFolderLabel) {
      linkFolderBtn.classList.toggle('active', hasFolder);
      linkFolderLabel.textContent = hasFolder ? this.currentSession.folderName : 'Folder';
    }
  }

  setupDockInput() {
    const textarea = document.getElementById('chatInputTextarea');
    const sendBtn = document.getElementById('btnSendMessage');
    const stopBtn = document.getElementById('btnStopGeneration');
    const attachBtn = document.getElementById('btnAttachFile');
    const webToggleBtn = document.getElementById('btnToggleWebSearch');
    const linkFolderBtn = document.getElementById('btnLinkFolder');
    const dockUnlinkFolderBtn = document.getElementById('btnDockUnlinkFolder');
    const dockRemoveAttachBtn = document.getElementById('btnDockRemoveAttachment');

    // Auto-resizing textarea
    textarea?.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    });

    // Enter to send
    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submitMessage();
      }
    });

    // Send button
    sendBtn?.addEventListener('click', () => {
      this.submitMessage();
    });

    // Stop button
    stopBtn?.addEventListener('click', async () => {
      await api.stopTurn();
      this.isGenerating = false;
      this._updateGeneratingState();
    });

    // Attach File
    attachBtn?.addEventListener('click', async () => {
      const file = await api.selectAttachmentFile();
      if (file && !file.error) {
        this.attachedFile = file;
        this.updateDockMeta();
      }
    });

    // Remove Attachment Pill
    dockRemoveAttachBtn?.addEventListener('click', () => {
      this.attachedFile = null;
      this.updateDockMeta();
    });

    // Web Search Toggle
    webToggleBtn?.addEventListener('click', () => {
      this.forceWebSearch = !this.forceWebSearch;
      webToggleBtn.classList.toggle('active', this.forceWebSearch);
      this.showToast(this.forceWebSearch ? 'Live Web Search: Enabled (DuckDuckGo)' : 'Live Web Search: Auto', 'info');
    });

    // Link Folder Button
    linkFolderBtn?.addEventListener('click', () => {
      this.linkFolderToCurrentChat();
    });

    // Dock Unlink Folder Button
    dockUnlinkFolderBtn?.addEventListener('click', () => {
      this.unlinkFolderFromCurrentChat();
    });
  }

  async submitMessage() {
    if (this.isGenerating) return;

    const textarea = document.getElementById('chatInputTextarea');
    const content = textarea.value.trim();
    if (!content && !this.attachedFile) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    const userMessage = {
      role: 'user',
      content,
      attachment: this.attachedFile,
      timestamp: Date.now()
    };

    this.attachedFile = null;
    this.updateDockMeta();

    // Set first message title
    if (this.currentSession.messages.length === 0 && !this.currentSession.folderPath) {
      this.currentSession.title = content.slice(0, 32) || 'Conversation';
    }

    this.currentSession.messages.push(userMessage);

    // Start streaming in ChatView
    this.chatView.startStream(userMessage);
    this.isGenerating = true;
    this._updateGeneratingState();

    try {
      const response = await api.startTurn({
        sessionId: this.currentSession.id,
        messages: this.currentSession.messages,
        userMessage: content,
        folderPath: this.currentSession.folderPath || null,
        modeId: this.currentSession.mode || 'chat',
        providerId: this.settings.activeProviderId,
        forceWebSearch: this.forceWebSearch
      }, {
        onToken: (tok) => this.chatView.appendToken(tok),
        onThought: (th) => this.chatView.appendThought(th),
        onToolStart: (ti) => this.chatView.addToolBadge(ti),
        onToolResult: () => {},
        onFallback: (fb) => this.chatView.addFallbackNotice(fb)
      });

      if (response && response.result) {
        const assistantMessage = {
          role: 'assistant',
          content: response.result.content || this.chatView.accumulatedContent,
          thought: response.result.thought || this.chatView.accumulatedThought,
          tools: response.result.tools || [],
          provider: response.result.provider,
          timestamp: Date.now()
        };

        this.currentSession.messages.push(assistantMessage);
        await api.saveSession(this.currentSession);
        await this.loadSessions();

        this.chatView.finishStream(response.result);
      } else if (response && response.error) {
        if (this.chatView.streamingAssistantEl && !this.chatView.accumulatedContent) {
          this.chatView.streamingAssistantEl.remove();
        } else {
          this.chatView.finishStream({});
        }
        this.showToast(response.error, 'error');
      }
    } catch (err) {
      if (this.chatView.streamingAssistantEl && !this.chatView.accumulatedContent) {
        this.chatView.streamingAssistantEl.remove();
      } else {
        this.chatView.finishStream({});
      }
      this.showToast(`Generation failed: ${err.message}`, 'error');
    } finally {
      this.isGenerating = false;
      this._updateGeneratingState();
    }
  }

  _updateGeneratingState() {
    const sendBtn = document.getElementById('btnSendMessage');
    const stopBtn = document.getElementById('btnStopGeneration');
    if (sendBtn) sendBtn.hidden = this.isGenerating;
    if (stopBtn) stopBtn.hidden = !this.isGenerating;
  }

  updateModelLabels() {
    const activeProvider = this.settings?.providers?.[this.settings?.activeProviderId];
    const name = activeProvider?.name || 'AI Engine';

    const sidebarLabel = document.getElementById('sidebarModelLabel');
    if (sidebarLabel) sidebarLabel.textContent = name;

    const topbarModelName = document.getElementById('topbarModelName');
    if (topbarModelName) topbarModelName.textContent = name;
  }

  onSettingsUpdated(newSettings) {
    this.settings = newSettings;
    document.body.className = `theme-${this.settings.appearance?.theme || 'dark'}`;
    this.updateModelLabels();
    this.showToast('Settings saved successfully.', 'success');
  }

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+N or Cmd+N: New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.createNewChat();
      }
      // Ctrl+, or Cmd+,: Open Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        this.settingsView.open();
      }
      // Escape: Close Settings Modal
      if (e.key === 'Escape') {
        this.settingsView?.close();
      }
    });
  }

  showToast(message, type = 'info') {
    let toast = document.querySelector('.toast-banner');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast-banner';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast-banner visible ${type}`;

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3200);
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Initialize Application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new EyqaApp();
  app.init().catch(err => {
    console.error('[EyqaApp] Initialization failed:', err);
  });
});

/**
 * Eyqa Main Application Controller
 * Features the floating Antigravity prompt dock, slash command menu,
 * model switcher pill, and coworker canvas orchestrator.
 */

import { icons } from './icons.js';
import { api } from './api.js';
import { ChatView } from './chat-view.js';
import { CanvasView } from './canvas-view.js';
import { SettingsView } from './settings-view.js';
import { WizardView } from './wizard-view.js';

class EyqaApp {
  constructor() {
    this.settings = null;
    this.sessions = [];
    this.currentSession = null;
    this.attachedFile = null;
    this.isGenerating = false;
    this.forceWebSearch = false;

    // View Components
    this.chatView = null;
    this.canvasView = null;
    this.settingsView = null;
    this.wizardView = null;
  }

  async init() {
    // 1. Load initial settings
    this.settings = await api.getSettings();
    document.body.className = `theme-${this.settings.appearance?.theme || 'dark'}`;

    // 2. Initialize Views
    const chatContainer = document.getElementById('chatMessagesContainer');
    const canvasContainer = document.getElementById('coworkerCanvasContainer');
    const settingsModal = document.getElementById('settingsModal');

    const wizardModal = document.getElementById('wizardModal');

    this.canvasView = new CanvasView(canvasContainer, (msg, type) => this.showToast(msg, type));
    this.chatView = new ChatView(
      chatContainer,
      (title, content, lang) => this.canvasView.openWithDoc(title, content, lang),
      (msg, type) => this.showToast(msg, type)
    );
    this.settingsView = new SettingsView(
      settingsModal,
      (msg, type) => this.showToast(msg, type),
      (newSettings) => this.onSettingsUpdated(newSettings)
    );
    this.wizardView = new WizardView(
      wizardModal,
      (msg, type) => this.showToast(msg, type),
      (newSettings, starterPrompt) => this.onWizardCompleted(newSettings, starterPrompt)
    );

    // 3. Load Sessions
    await this.loadSessions();

    // 4. Setup Controls & Floating Dock
    this.setupSidebar();
    this.setupTopBar();
    this.setupDockInput();
    this.setupSlashCommands();
    this.setupShortcuts();

    // 5. Select or create session
    if (this.sessions.length > 0) {
      await this.selectSession(this.sessions[0].id);
    } else {
      await this.createNewSession();
    }

    this.updateStatusPills();

    // 6. Auto-launch Setup Wizard if first run
    const hasAnyKey = Object.values(this.settings.providers || {}).some(p => p.apiKey && p.enabled && p.id !== 'ollama' && p.id !== 'fcc_proxy');
    if (!this.settings.hasCompletedWizard && !hasAnyKey) {
      setTimeout(() => {
        this.wizardView.open();
      }, 400);
    }
  }

  async loadSessions() {
    this.sessions = await api.getSessions();
    this.renderSessionsList();
  }

  renderSessionsList() {
    const listEl = document.getElementById('sidebarSessionsList');
    if (!listEl) return;

    if (this.sessions.length === 0) {
      listEl.innerHTML = `<div class="sidebar-empty">No conversations yet</div>`;
      return;
    }

    listEl.innerHTML = this.sessions.map(s => {
      const isSelected = this.currentSession && this.currentSession.id === s.id;
      return `
        <div class="session-item ${isSelected ? 'active' : ''}" data-id="${s.id}">
          <div class="session-item-body">
            <span class="session-title">${this._escape(s.title || 'Untitled')}</span>
            <span class="session-preview">${this._escape(s.preview || 'Empty')}</span>
          </div>
          <button class="session-delete-btn" data-id="${s.id}" title="Delete Conversation">${icons.trash}</button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.session-item').forEach(item => {
      item.onclick = async (e) => {
        if (e.target.closest('.session-delete-btn')) return;
        const id = e.currentTarget.dataset.id;
        await this.selectSession(id);
      };
    });

    listEl.querySelectorAll('.session-delete-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        await api.deleteSession(id);
        await this.loadSessions();
        if (this.currentSession && this.currentSession.id === id) {
          if (this.sessions.length > 0) {
            await this.selectSession(this.sessions[0].id);
          } else {
            await this.createNewSession();
          }
        }
      };
    });
  }

  async selectSession(id) {
    const fullSession = await api.getSession(id);
    if (!fullSession) return;

    this.currentSession = fullSession;
    this.chatView.setSession(this.currentSession);
    this.renderSessionsList();
    this.updateTopBar();
  }

  async createNewSession() {
    const mode = this.settings.activeAgentMode || 'coworker';
    const newSess = await api.createSession('New Conversation', mode);
    this.currentSession = newSess;
    await this.loadSessions();
    this.chatView.setSession(this.currentSession);
    this.updateTopBar();

    const input = document.getElementById('chatInputTextarea');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  setupSidebar() {
    document.getElementById('btnNewChat')?.addEventListener('click', () => {
      this.createNewSession();
    });

    const modeSelect = document.getElementById('sidebarModeSelect');
    if (modeSelect) {
      modeSelect.value = this.settings.activeAgentMode || 'coworker';
      modeSelect.addEventListener('change', async (e) => {
        const newMode = e.target.value;
        this.settings.activeAgentMode = newMode;
        await api.saveSettings({ activeAgentMode: newMode });
        if (this.currentSession) {
          this.currentSession.mode = newMode;
          await api.saveSession(this.currentSession);
        }
        this.updateTopBar();
        this.showToast(`Switched mode: ${newMode}`, 'info');
      });
    }

    const wsBtn = document.getElementById('sidebarWorkspaceBtn');
    if (wsBtn) {
      this._updateWorkspaceLabel();
      wsBtn.addEventListener('click', async () => {
        const folder = await api.selectWorkspaceFolder();
        if (folder) {
          this.settings.workspacePath = folder;
          this._updateWorkspaceLabel();
          this.showToast(`Active workspace: ${folder}`, 'success');
        }
      });
    }

    document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
      this.settingsView.open();
    });

    document.getElementById('btnFreeAiGuide')?.addEventListener('click', () => {
      this.wizardView.open();
    });
  }

  _updateWorkspaceLabel() {
    const label = document.getElementById('sidebarWorkspaceLabel');
    if (label) {
      const p = this.settings.workspacePath || 'No folder selected';
      const parts = p.split(/[\\/]/);
      label.textContent = parts[parts.length - 1] || p;
      label.title = p;
    }
  }

  setupTopBar() {
    document.getElementById('btnOpenWizard')?.addEventListener('click', () => {
      this.wizardView.open();
    });

    document.getElementById('btnToggleCanvas')?.addEventListener('click', () => {
      const open = this.canvasView.toggle();
      const btn = document.getElementById('btnToggleCanvas');
      if (btn) btn.classList.toggle('active', open);
    });

    document.getElementById('btnClearChat')?.addEventListener('click', async () => {
      if (this.currentSession) {
        this.currentSession.messages = [];
        await api.saveSession(this.currentSession);
        this.chatView.setSession(this.currentSession);
        await this.loadSessions();
      }
    });

    document.getElementById('btnExportChat')?.addEventListener('click', () => {
      if (!this.currentSession || !this.currentSession.messages) return;
      let md = `# ${this.currentSession.title}\n\n`;
      for (const m of this.currentSession.messages) {
        const speaker = m.role === 'user' ? '### 👤 User' : '### ✨ eyqa';
        md += `${speaker}\n\n${m.content}\n\n---\n\n`;
      }
      this.canvasView.openWithDoc(`Export - ${this.currentSession.title}`, md, 'markdown');
      this.showToast('Conversation exported to Canvas!', 'success');
    });

    this.updateTopBar();
  }

  updateTopBar() {
    const modelPill = document.getElementById('topbarModelBadge');
    if (modelPill) {
      const p = this.settings.providers[this.settings.activeProviderId];
      if (p) {
        modelPill.innerHTML = `<span class="dot green"></span> <span>${this._escape(p.name)} (${this._escape(p.model)})</span>`;
      }
    }

    const modePill = document.getElementById('topbarModeBadge');
    if (modePill) {
      const mode = this.currentSession?.mode || this.settings.activeAgentMode || 'coworker';
      modePill.textContent = mode.replace('_', ' ').toUpperCase();
    }
  }

  updateStatusPills() {
    const p = this.settings.providers[this.settings.activeProviderId];
    if (!p) return;

    // Sidebar status
    const statusEl = document.getElementById('sidebarEngineStatus');
    if (statusEl) {
      statusEl.innerHTML = `<span class="dot ${p.apiKey || p.id === 'ollama' ? 'green' : 'amber'}"></span> <span>${p.name} · ${p.badge}</span>`;
    }

    // Dock model pill
    const dockModelLabel = document.getElementById('dockModelSelectorLabel');
    if (dockModelLabel) {
      dockModelLabel.textContent = `${p.name} (${p.model})`;
    }
  }

  setupDockInput() {
    const textarea = document.getElementById('chatInputTextarea');
    const sendBtn = document.getElementById('btnSendMessage');
    const stopBtn = document.getElementById('btnStopGeneration');
    const attachBtn = document.getElementById('btnAttachFile');
    const webToggleBtn = document.getElementById('btnToggleWebSearch');
    const dockModelPill = document.getElementById('dockModelSelectorPill');

    // Clicking dock model pill opens Settings
    dockModelPill?.addEventListener('click', () => {
      this.settingsView.open();
    });

    // Auto-resizing textarea
    textarea?.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
      this.checkSlashCommand(textarea.value);
    });

    // Enter to send
    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const popover = document.getElementById('slashMenuPopover');
        if (popover && !popover.hidden) {
          popover.hidden = true;
        }
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
        this._renderAttachmentPill();
      }
    });

    // Web Search Toggle
    webToggleBtn?.addEventListener('click', () => {
      this.forceWebSearch = !this.forceWebSearch;
      webToggleBtn.classList.toggle('active', this.forceWebSearch);
      this.showToast(this.forceWebSearch ? 'Web Grounding: Enabled (Live DuckDuckGo)' : 'Web Grounding: Auto', 'info');
    });
  }

  setupSlashCommands() {
    const popover = document.getElementById('slashMenuPopover');
    const textarea = document.getElementById('chatInputTextarea');

    popover?.querySelectorAll('.slash-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const cmd = e.currentTarget.dataset.command;
        popover.hidden = true;

        if (cmd === '/free-setup' || cmd === '/wizard') {
          this.wizardView.open();
          textarea.value = '';
          return;
        }

        if (cmd === '/draft') {
          textarea.value = 'Draft a complete proposal for: ';
        } else if (cmd === '/research') {
          textarea.value = 'Research the live web and summarize: ';
          this.forceWebSearch = true;
          document.getElementById('btnToggleWebSearch')?.classList.add('active');
        } else if (cmd === '/summarize') {
          textarea.value = 'Summarize the attached document or current workspace overview.';
        } else if (cmd === '/plan') {
          textarea.value = 'Create a step-by-step action plan to accomplish: ';
        } else if (cmd === '/code') {
          textarea.value = 'Write a clean script to automate: ';
        }

        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      });
    });
  }

  checkSlashCommand(text) {
    const popover = document.getElementById('slashMenuPopover');
    if (!popover) return;

    if (text.trim() === '/') {
      popover.hidden = false;
    } else {
      popover.hidden = true;
    }
  }

  _renderAttachmentPill() {
    const container = document.getElementById('chatAttachmentPreview');
    if (!container) return;

    if (!this.attachedFile) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    container.hidden = false;
    container.innerHTML = `
      <div class="input-attached-pill">
        ${icons.attach}
        <span>${this._escape(this.attachedFile.name)}</span>
        <button class="btn-remove-attachment" title="Remove Attachment">${icons.close}</button>
      </div>
    `;

    container.querySelector('.btn-remove-attachment')?.addEventListener('click', () => {
      this.attachedFile = null;
      this._renderAttachmentPill();
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
    this._renderAttachmentPill();

    // Set first message title
    if (this.currentSession.messages.length === 0) {
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
        modeId: this.currentSession.mode || this.settings.activeAgentMode,
        providerId: this.settings.activeProviderId,
        forceWebSearch: this.forceWebSearch
      }, {
        onToken: (tok) => this.chatView.appendToken(tok),
        onThought: (th) => this.chatView.appendThought(th),
        onToolStart: (ti) => this.chatView.addToolBadge(ti),
        onToolResult: (ri) => {
          if (ri.name === 'web_search' && ri.output?.results) {
            this.canvasView.openWithWeb(ri.output.results);
          }
        },
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
        this.chatView.finishStream({});
        this.showToast(response.error, 'error');
      }
    } catch (err) {
      this.chatView.finishStream({});
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

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+N or Cmd+N: New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.createNewSession();
      }
      // Ctrl+, or Cmd+,: Open Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        this.settingsView.open();
      }
      // Escape: close modals & popovers
      if (e.key === 'Escape') {
        this.settingsView.close();
        this.wizardView?.close();
        const popover = document.getElementById('slashMenuPopover');
        if (popover) popover.hidden = true;
      }
    });
  }

  onSettingsUpdated(newSettings) {
    this.settings = newSettings;
    this.updateTopBar();
    this.updateStatusPills();
    this._updateWorkspaceLabel();
  }

  onWizardCompleted(newSettings, starterPrompt = null) {
    this.settings = newSettings;
    this.updateTopBar();
    this.updateStatusPills();
    this._updateWorkspaceLabel();
    this.showToast('✨ Eyqa is configured and ready!', 'success');

    if (starterPrompt) {
      const input = document.getElementById('chatInputTextarea');
      if (input) {
        input.value = starterPrompt;
        setTimeout(() => this.submitMessage(), 250);
      }
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-banner ${type}`;
    toast.innerHTML = `<span>${this._escape(message)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Bootstrap application on window load
window.addEventListener('DOMContentLoaded', () => {
  const app = new EyqaApp();
  app.init();
});

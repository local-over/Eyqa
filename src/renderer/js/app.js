/**
 * Eyqa Main Application Controller
 * Clean ChatGPT & Claude Desktop UI wrapper.
 * Pure conversation mode vs Project/Folder mode.
 */

import { icons } from './icons.js';
import { api } from './api.js';
import { ChatView } from './chat-view.js';
import { SettingsView } from './settings-view.js';
import { mascotAnimator } from './mascot-animator.js';

class EyqaApp {
  constructor() {
    this.settings = null;
    this.sessions = [];
    this.projects = [];
    this.currentSession = null;
    this.attachedFile = null;
    this.runningTurns = new Map(); // sessionId -> { session, startTime, accumulatedContent, accumulatedThought, tools: [] }
    this.forceWebSearch = false;
    this.sidebarCollapsed = false;
    this.collapsedProjects = new Set();

    // View Components
    this.chatView = null;
    this.settingsView = null;
  }

  get isGenerating() {
    return this.runningTurns ? this.runningTurns.has(this.currentSession?.id) : false;
  }

  set isGenerating(_) {
    // Backwards-compatible setter
  }

  async init() {
    // STARTUP SPLASH SCREEN WITH MULTI-FRAME LIVING MASCOT
    const splash = document.getElementById('splashScreen');
    const splashImg = document.getElementById('splashMascotImg');
    const splashStage = document.getElementById('splashMascotStage');

    if (splash && splashImg) {
      mascotAnimator.playSplashSequence(splashImg, splashStage, () => {
        setTimeout(() => {
          splash.style.opacity = '0';
          splash.style.pointerEvents = 'none';
          setTimeout(() => splash.remove(), 450);
        }, 600);
      });
    }

    // Attach Living Mascot Interactivity (blinking/winking on hover, idle, click)
    mascotAnimator.attachInteractivity();

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
    this.chatView.onRollbackTurn = (data) => this.handleRollbackTurn(data);

    this.settingsView = new SettingsView(
      settingsModal,
      (msg, type) => this.showToast(msg, type),
      (newSettings) => this.onSettingsUpdated(newSettings)
    );

    // 3. Native Tray Focus Listener
    api.onFocusSession((sessionId) => {
      if (sessionId) {
        this.selectSession(sessionId);
      }
    });

    // 4. Live Sidebar Elapsed Timer Ticker
    setInterval(() => {
      if (this.runningTurns && this.runningTurns.size > 0) {
        for (const [sId, turn] of this.runningTurns.entries()) {
          const badge = document.querySelector(`.sidebar-running-badge[data-session-id="${sId}"]`);
          if (badge) {
            badge.textContent = `⚡ ${this._formatElapsed(turn.startTime)}`;
          }
        }
      }
    }, 1000);

    // 5. Setup UI Controls
    this.setupSidebar();
    this.setupTopBar();
    this.setupDockInput();
    this.setupShortcuts();
    this.setupFileLinks();
    this.setupImageLightbox();

    // 6. Load Projects and Sessions
    await this.loadSessions();
    await this.checkSetupRequired();

    // 7. Select or create session
    if (this.sessions.length > 0) {
      await this.selectSession(this.sessions[0].id);
    } else if (this.projects.length > 0) {
      await this.createNewChat();
    }

    this.updateModelLabels();
  }

  async checkSetupRequired() {
    const overlay = document.getElementById('setupOverlay');
    const noProjectsScreen = document.getElementById('noProjectsScreen');
    const chatContainer = document.getElementById('chatMessagesContainer');
    const dockSection = document.querySelector('.app-dock-section');

    const hasCompletedWizard = Boolean(this.settings?.hasCompletedWizard);

    if (!hasCompletedWizard) {
      if (overlay) overlay.style.display = 'flex';
      if (noProjectsScreen) noProjectsScreen.style.display = 'none';
      if (chatContainer) chatContainer.style.display = 'none';
      if (dockSection) dockSection.style.display = 'none';
      this.initSetupFlow();
    } else {
      if (overlay) overlay.style.display = 'none';

      if (!this.projects || this.projects.length === 0) {
        // Dedicated Empty State Screen when 0 projects exist
        if (noProjectsScreen) noProjectsScreen.style.display = 'flex';
        if (chatContainer) chatContainer.style.display = 'none';
        if (dockSection) dockSection.style.display = 'none';
      } else {
        // Active workspace with projects
        if (noProjectsScreen) noProjectsScreen.style.display = 'none';
        if (chatContainer) chatContainer.style.display = 'flex';
        if (dockSection) dockSection.style.display = 'flex';
      }
    }
  }

  initSetupFlow() {
    const overlay = document.getElementById('setupOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';

    const stepPathSelection = document.getElementById('setupStepPathSelection');
    const stepPathA = document.getElementById('setupStepPathA');
    const stepPathB = document.getElementById('setupStepPathB');
    const stepWorkspace = document.getElementById('setupStepWorkspace');

    const showStep = (step) => {
      [stepPathSelection, stepPathA, stepPathB, stepWorkspace].forEach(el => {
        if (el) el.style.display = 'none';
      });
      if (step) step.style.display = 'block';
    };

    showStep(stepPathSelection);

    let currentPath = null;

    // Path Selection Actions
    const btnPathA = document.getElementById('btnPathA');
    if (btnPathA) {
      btnPathA.onclick = () => { currentPath = 'A'; showStep(stepPathA); };
    }
    const btnPathB = document.getElementById('btnPathB');
    if (btnPathB) {
      btnPathB.onclick = () => { currentPath = 'B'; showStep(stepPathB); };
    }
    const btnPathC = document.getElementById('btnPathC');
    if (btnPathC) {
      btnPathC.onclick = async () => { 
        currentPath = 'C'; 
        await api.saveSettings({ engineMode: 'free_pool' });
        this.settings = await api.getSettings();
        this.updateModelLabels();
        showStep(stepWorkspace); 
      };
    }

    // Path A: Free Route Actions
    const btnBackA = document.getElementById('btnBackFromPathA');
    if (btnBackA) btnBackA.onclick = () => showStep(stepPathSelection);

    const btnNextA = document.getElementById('btnNextFromPathA');
    if (btnNextA) {
      btnNextA.onclick = async () => {
        const orKey = document.getElementById('setupKeyOpenRouterFree')?.value?.trim();
        const geminiKey = document.getElementById('setupKeyGemini')?.value?.trim();
        const groqKey = document.getElementById('setupKeyGroq')?.value?.trim();
        const nvidiaKey = document.getElementById('setupKeyNvidia')?.value?.trim();
        const qwenKey = document.getElementById('setupKeyQwen')?.value?.trim();

        const updates = {};
        if (orKey) updates.openrouter = { apiKey: orKey, enabled: true };
        if (geminiKey) updates.gemini = { apiKey: geminiKey, enabled: true };
        if (groqKey) updates.groq = { apiKey: groqKey, enabled: true };
        if (nvidiaKey) updates.nvidia_nim = { apiKey: nvidiaKey, enabled: true };
        if (qwenKey) updates.qwen = { apiKey: qwenKey, enabled: true };

        for (const [providerId, data] of Object.entries(updates)) {
          await api.updateProvider(providerId, data);
        }

        await api.saveSettings({ engineMode: 'free_pool' });
        
        this.settings = await api.getSettings();
        this.updateModelLabels();

        showStep(stepWorkspace);
      };
    }

    // Path B: Paid Route Actions
    const btnBackB = document.getElementById('btnBackFromPathB');
    if (btnBackB) btnBackB.onclick = () => showStep(stepPathSelection);

    const btnNextB = document.getElementById('btnNextFromPathB');
    if (btnNextB) {
      btnNextB.onclick = async () => {
        const providerId = document.getElementById('setupPaidProvider')?.value;
        const key = document.getElementById('setupPaidKey')?.value?.trim();

        if (providerId && key) {
          await api.updateProvider(providerId, { apiKey: key, enabled: true });
          await api.saveSettings({ 
            engineMode: 'paid',
            activeProviderId: providerId,
            activeModelRef: `${providerId}/${this.settings?.providers?.[providerId]?.model || 'default'}`
          });
          
          this.settings = await api.getSettings();
          this.updateModelLabels();
        }

        showStep(stepWorkspace);
      };
    }

    // Workspace Back Button
    const btnBackWorkspace = document.getElementById('btnSetupBackWorkspace');
    if (btnBackWorkspace) {
      btnBackWorkspace.onclick = () => {
        if (currentPath === 'A') showStep(stepPathA);
        else if (currentPath === 'B') showStep(stepPathB);
        else showStep(stepPathSelection);
      };
    }

    let selectedFolderPath = null;
    let selectedFolderName = null;

    const btnFolder = document.getElementById('btnSetupSelectFolder');
    if (btnFolder) {
      btnFolder.onclick = async () => {
        const folder = await api.selectWorkspaceFolder();
        if (folder) {
          selectedFolderPath = folder.path;
          selectedFolderName = folder.name;
          const inputPath = document.getElementById('setupProjPath');
          if (inputPath) inputPath.value = folder.path;
        }
      };
    }

    const btnFinish = document.getElementById('btnSetupFinish');
    if (btnFinish) {
      btnFinish.onclick = async () => {
        if (!selectedFolderPath) {
          this.showToast('Please select a project folder to link your workspace.', 'error');
          return;
        }

        const nameInput = document.getElementById('setupProjName');
        const name = nameInput?.value?.trim() || 'My First Workspace';
        const proj = await api.createProject(name, selectedFolderPath, selectedFolderName);
        
        await api.saveSettings({ hasCompletedWizard: true });
        this.settings = await api.getSettings();

        overlay.style.display = 'none';

        await this.loadSessions();
        if (proj && proj.id) {
          const firstChat = await api.createSession('Welcome Chat', proj.id);
          await this.loadSessions();
          if (firstChat && firstChat.id) {
            await this.selectSession(firstChat.id);
          }
        }
        await this.checkSetupRequired();
        this.showToast('Workspace initialized successfully!', 'success');
      };
    }
  }

  async loadSessions() {
    this.projects = (await api.listProjects()) || [];
    this.sessions = (await api.getSessions()) || [];
    this.renderSidebarLists();
  }

  renderSidebarLists() {
    const projListEl = document.getElementById('sidebarProjectsList');
    if (!projListEl) return;

    if ((!this.projects || this.projects.length === 0) && (!this.sessions || this.sessions.length === 0)) {
      projListEl.innerHTML = `<div class="sidebar-empty-state">No projects yet. Click "+ Project" to create one.</div>`;
      return;
    }

    let html = '';
    for (const proj of this.projects) {
      const projChats = this.sessions.filter(c => c.projectId === proj.id);
      const isCollapsed = this.collapsedProjects.has(proj.id);
      const chevron = isCollapsed ? '▸' : '▾';

      html += `
        <div class="sidebar-project-group" data-proj-id="${proj.id}">
          <div class="sidebar-project-header">
            <div class="proj-header-left" title="${this._escape(proj.folderPath || proj.name)}">
              <span class="proj-chevron">${chevron}</span>
              <span class="proj-name">${this._escape(proj.name)}</span>
            </div>
            <div class="proj-header-actions">
              <button class="btn-project-settings-gear" title="Project Settings (${this._escape(proj.name)})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>
              <button class="btn-new-chat-proj" title="New Chat in this project">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button class="btn-delete-proj" title="Delete Project">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
          <div class="sidebar-project-chats" style="${isCollapsed ? 'display: none;' : ''}">
            ${projChats.length === 0 ? `<div class="sidebar-empty-state" style="padding-left:24px; font-size:11px;">No chats yet</div>` : ''}
            ${projChats.map(s => this._renderSidebarItem(s, true)).join('')}
          </div>
        </div>
      `;
    }

    // Unassigned / General Chats (if any exist without a project)
    const unassignedChats = this.sessions.filter(c => !c.projectId);
    if (unassignedChats.length > 0) {
      html += `
        <div class="sidebar-project-group" data-proj-id="unassigned">
          <div class="sidebar-project-header">
            <div class="proj-header-left">
              <span class="proj-chevron">▾</span>
              <span class="proj-name">General</span>
            </div>
          </div>
          <div class="sidebar-project-chats">
            ${unassignedChats.map(s => this._renderSidebarItem(s, false)).join('')}
          </div>
        </div>
      `;
    }

    projListEl.innerHTML = html;

    // Attach item selection and delete events
    projListEl.querySelectorAll('.sidebar-item').forEach(el => {
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
              this.currentSession = null;
              this.chatView.setSession(null);
              this.updateTopBar();
              this.updateDockMeta();
            }
          }
        };
      }
    });

    // Project header click (collapse / expand toggle)
    projListEl.querySelectorAll('.proj-header-left').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const group = el.closest('.sidebar-project-group');
        const projId = group?.dataset?.projId;
        if (!projId || projId === 'unassigned') return;

        if (this.collapsedProjects.has(projId)) {
          this.collapsedProjects.delete(projId);
        } else {
          this.collapsedProjects.add(projId);
        }
        this.renderSidebarLists();
      };
    });

    // Add chat to specific project
    projListEl.querySelectorAll('.btn-new-chat-proj').forEach(el => {
      el.onclick = async (e) => {
        e.stopPropagation();
        const projId = el.closest('.sidebar-project-group')?.dataset?.projId;
        if (!projId) return;

        await this.createNewChat(projId);
      };
    });

    // Project settings gear click
    projListEl.querySelectorAll('.btn-project-settings-gear').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const projId = el.closest('.sidebar-project-group')?.dataset?.projId;
        if (!projId || projId === 'unassigned') return;
        if (this.settingsView) {
          this.settingsView.open('project', projId);
        }
      };
    });

    // Delete project
    projListEl.querySelectorAll('.btn-delete-proj').forEach(el => {
      el.onclick = async (e) => {
        e.stopPropagation();
        const projId = el.closest('.sidebar-project-group')?.dataset?.projId;
        if (!projId) return;

        const confirmed = confirm('Are you sure you want to delete this project and all its chats?');
        if (!confirmed) return;

        await api.deleteProject(projId);
        await this.loadSessions();
        await this.checkSetupRequired();
        if (this.sessions.length > 0) {
          await this.selectSession(this.sessions[0].id);
        } else {
          this.currentSession = null;
          this.chatView.setSession(null);
          this.updateTopBar();
          this.updateDockMeta();
        }
      };
    });
  }

  _formatElapsed(startTime) {
    const sec = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : `${s}s`;
  }

  _renderSidebarItem(session, isProjectChild) {
    const isActive = this.currentSession && this.currentSession.id === session.id;
    const isRunning = this.runningTurns && this.runningTurns.has(session.id);
    const title = session.title || 'New Chat';

    let runningBadgeHtml = '';
    if (isRunning) {
      const turn = this.runningTurns.get(session.id);
      const elapsed = this._formatElapsed(turn.startTime);
      runningBadgeHtml = `<span class="sidebar-running-badge" data-session-id="${session.id}">⚡ ${elapsed}</span>`;
    }

    return `
      <div class="sidebar-item ${isActive ? 'active' : ''} ${isRunning ? 'sidebar-item-running' : ''}" data-id="${session.id}" style="${isProjectChild ? 'padding-left: 28px;' : 'padding-left: 16px;'}">
        <div class="sidebar-item-body">
          <span class="sidebar-item-icon">${isRunning ? (icons.sparkles || icons.messageSquare) : icons.messageSquare}</span>
          <span class="sidebar-item-title">${this._escape(title)}</span>
        </div>
        ${runningBadgeHtml}
        <button class="sidebar-item-delete" title="Delete conversation">${icons.trash}</button>
      </div>
    `;
  }

  async selectSession(id) {
    // 1. Save draft from current session before switching, and cleanup ghost empty sessions
    if (this.currentSession && this.currentSession.id !== id) {
      const textarea = document.getElementById('chatInputTextarea');
      const currentDraft = textarea ? textarea.value : (this.currentSession.draft || '');
      this.currentSession.draft = currentDraft;

      // Check if current session was completely empty (no messages and no draft)
      const hasMessages = Array.isArray(this.currentSession.messages) && this.currentSession.messages.length > 0;
      const hasDraft = typeof currentDraft === 'string' && currentDraft.trim().length > 0;
      const isCurrentlyRunning = this.runningTurns && this.runningTurns.has(this.currentSession.id);

      if (!hasMessages && !hasDraft && !isCurrentlyRunning) {
        // Remove empty ghost chat that was never used
        try {
          await api.deleteSession(this.currentSession.id);
          this.sessions = this.sessions.filter(s => s.id !== this.currentSession.id);
        } catch (_) {}
      } else {
        // Persist draft
        try {
          await api.saveSession(this.currentSession);
        } catch (_) {}
      }
    }

    // If target session is running in memory, keep the live reference
    let fullSession = null;
    if (this.runningTurns && this.runningTurns.has(id)) {
      fullSession = this.runningTurns.get(id).session;
    } else {
      fullSession = await api.getSession(id);
    }
    if (!fullSession) return;

    this.currentSession = fullSession;
    this.chatView.setSession(this.currentSession);

    // If target session is currently running, reconnect streaming view!
    if (this.runningTurns && this.runningTurns.has(id)) {
      const turn = this.runningTurns.get(id);
      this.chatView.startStream(null);
      if (turn.accumulatedThought) {
        this.chatView.appendThought(turn.accumulatedThought);
      }
      if (turn.tools && turn.tools.length > 0) {
        for (const t of turn.tools) {
          this.chatView.addToolBadge(t);
        }
      }
      if (turn.accumulatedContent) {
        this.chatView.appendToken(turn.accumulatedContent);
      }
    }

    this.renderSidebarLists();
    this.updateTopBar();
    this.updateDockMeta();
    this._updateGeneratingState();

    // Restore draft text into the textarea
    const input = document.getElementById('chatInputTextarea');
    if (input) {
      input.value = this.currentSession.draft || '';
      input.style.height = 'auto';
      input.focus();
    }
  }

  _isSessionEmpty(session) {
    if (!session) return true;
    // If it's the current active session in memory, check live messages & live input draft
    if (this.currentSession && session.id === this.currentSession.id) {
      const textarea = document.getElementById('chatInputTextarea');
      const liveDraft = textarea ? textarea.value : (this.currentSession.draft || '');
      const hasLiveMessages = Array.isArray(this.currentSession.messages) && this.currentSession.messages.length > 0;
      const hasLiveDraft = Boolean(liveDraft && liveDraft.trim());
      return !hasLiveMessages && !hasLiveDraft;
    }
    // For other sessions in this.sessions list, check messageCount and stored state
    if (typeof session.messageCount === 'number' && session.messageCount > 0) {
      return false;
    }
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      return false;
    }
    if (session.draft && session.draft.trim()) {
      return false;
    }
    if (session.preview && session.preview !== 'Empty session' && session.preview !== 'Start a new conversation') {
      return false;
    }
    return true;
  }

  async createNewChat(targetProjId = null) {
    let projId = targetProjId;
    if (!projId) {
      if (this.currentSession?.projectId) {
        projId = this.currentSession.projectId;
      } else if (this.projects && this.projects.length > 0) {
        projId = this.projects[0].id;
      }
    }

    if (!projId) {
      this.createNewProjectDialog();
      return;
    }

    // Uncollapse this project so the user sees their chats
    this.collapsedProjects.delete(projId);

    // If user is already on a fresh empty chat in this project, refocus input
    const currentIsThisProj = this.currentSession?.projectId === projId;
    if (currentIsThisProj && this._isSessionEmpty(this.currentSession)) {
      const input = document.getElementById('chatInputTextarea');
      if (input) {
        input.focus();
        input.classList.add('pulse-focus');
        setTimeout(() => input.classList.remove('pulse-focus'), 500);
      }
      this.renderSidebarLists();
      return;
    }

    // Check if there is already an unused empty chat in this project
    const projectSessions = this.sessions.filter(s => s.projectId === projId);
    const existingEmptyChat = projectSessions.find(s => this._isSessionEmpty(s));

    if (existingEmptyChat) {
      // Switch to the existing empty chat
      await this.selectSession(existingEmptyChat.id);
      return;
    }

    // Create a brand new chat in this project
    const newSess = await api.createSession('New Chat', projId);
    await this.loadSessions();
    if (newSess && newSess.id) {
      await this.selectSession(newSess.id);
    }
  }

  async createNewProjectDialog() {
    const modal = document.getElementById('newProjectModal');
    if (!modal) return;

    modal.style.display = 'flex';
    const nameInput = document.getElementById('newProjectName');
    const pathInput = document.getElementById('newProjectPath');

    if (nameInput) nameInput.value = 'New Project';
    if (pathInput) pathInput.value = '';

    let selectedFolderPath = null;
    let selectedFolderName = null;

    const cleanup = () => {
      document.getElementById('btnNewProjectCancel')?.removeEventListener('click', cancelHandler);
      document.getElementById('btnNewProjectSelectFolder')?.removeEventListener('click', folderHandler);
      document.getElementById('btnNewProjectCreate')?.removeEventListener('click', createHandler);
    };

    const cancelHandler = () => {
      modal.style.display = 'none';
      cleanup();
    };

    const folderHandler = async () => {
      const folder = await api.selectWorkspaceFolder();
      if (folder) {
        selectedFolderPath = folder.path;
        selectedFolderName = folder.name;
        if (pathInput) pathInput.value = folder.path;
      }
    };

    const createHandler = async () => {
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        this.showToast('Project name cannot be empty', 'error');
        return;
      }
      if (!selectedFolderPath) {
        this.showToast('Project directory is required. Please browse and select a folder.', 'error');
        return;
      }

      const proj = await api.createProject(name, selectedFolderPath, selectedFolderName);
      await this.loadSessions();

      if (proj && proj.id) {
        const newChat = await api.createSession('Initial Chat', proj.id);
        await this.loadSessions();
        if (newChat && newChat.id) {
          await this.selectSession(newChat.id);
        }
      }
      await this.checkSetupRequired();
      this.showToast(`Project created: ${name}`, 'success');
      modal.style.display = 'none';
      cleanup();
    };

    document.getElementById('btnNewProjectCancel')?.addEventListener('click', cancelHandler);
    document.getElementById('btnNewProjectSelectFolder')?.addEventListener('click', folderHandler);
    document.getElementById('btnNewProjectCreate')?.addEventListener('click', createHandler);
  }

  async linkFolderToCurrentChat() {
    const folder = await api.selectWorkspaceFolder();
    if (!folder || !folder.path) return;

    if (!this.currentSession) {
      await this.createNewProjectDialog();
      return;
    }

    // Temporary scoped context for this specific conversation
    this.currentSession.folderPath = folder.path;
    this.currentSession.folderName = folder.name;
    this.currentSession.scopedFolder = folder.path;

    await api.saveSession(this.currentSession);
    this.chatView.setSession(this.currentSession);
    this.updateTopBar();
    this.updateDockMeta();
    this.showToast(`Scoped context to: ${folder.name}`, 'success');
  }

  async unlinkFolderFromCurrentChat() {
    if (!this.currentSession) return;

    const proj = this.projects.find(p => p.id === this.currentSession.projectId);
    if (proj && proj.folderPath) {
      // Revert back to the project root folder without touching the project definition
      this.currentSession.folderPath = proj.folderPath;
      this.currentSession.folderName = proj.folderName;
      this.currentSession.scopedFolder = null;

      await api.saveSession(this.currentSession);
      this.chatView.setSession(this.currentSession);
      this.updateTopBar();
      this.updateDockMeta();
      this.showToast(`Reset context scope back to project root: ${proj.folderName}`, 'info');
      return;
    }

    // For scratchpad / quick chats without a parent project:
    this.currentSession.folderPath = null;
    this.currentSession.folderName = null;
    this.currentSession.scopedFolder = null;

    await api.saveSession(this.currentSession);
    await this.loadSessions();
    this.chatView.setSession(this.currentSession);
    this.updateTopBar();
    this.updateDockMeta();
    this.showToast('Cleared temporary context scope.', 'info');
  }

  setupSidebar() {
    // Quick Chat Action Button
    document.getElementById('btnQuickChat')?.addEventListener('click', async () => {
      await this.startQuickChat();
    });

    // Header New Project Action Button (The '+' button in sidebar header)
    document.getElementById('btnHeaderNewProject')?.addEventListener('click', () => {
      this.createNewProjectDialog();
    });

    // New Project Button (deck or empty state)
    document.getElementById('btnNewProject')?.addEventListener('click', () => {
      this.createNewProjectDialog();
    });

    // Dedicated No Projects Button (Empty state)
    document.getElementById('btnNoProjectsCreate')?.addEventListener('click', () => {
      this.createNewProjectDialog();
    });

    // Brand Home Click
    document.getElementById('brandHomeLink')?.addEventListener('click', () => {
      this.createNewChat();
    });

    // Open Settings Button
    document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
      this.settingsView.open();
    });
  }

  async startQuickChat() {
    let quickProj = this.projects.find(p => p.id === 'quick_chat' || p.name === 'Quick Chats');
    if (!quickProj) {
      quickProj = await api.createProject('Quick Chats', null, 'Scratchpad', { isQuickChat: true });
      await this.loadSessions();
    }
    await this.createNewChat(quickProj.id);
    this.showToast('Quick scratchpad chat active.', 'info');
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

    // Topbar Fast Engine Switcher
    const btnFree = document.getElementById('btnSwitchFreePool');
    const btnPaid = document.getElementById('btnSwitchPaidEngine');

    if (btnFree) {
      btnFree.addEventListener('click', async () => {
        const currentProj = this.projects.find(p => p.id === this.currentSession?.projectId);
        if (currentProj && currentProj.modelConfig?.mode === 'custom') {
          currentProj.modelConfig.engineMode = 'free_pool';
          await api.updateProject(currentProj.id, { modelConfig: currentProj.modelConfig });
        }
        await api.saveSettings({ engineMode: 'free_pool' });
        this.settings = await api.getSettings();
        this.updateModelLabels();
        this.showToast('Switched to Free AI Pool.', 'info');
      });
    }

    if (btnPaid) {
      btnPaid.addEventListener('click', async () => {
        const currentProj = this.projects.find(p => p.id === this.currentSession?.projectId);
        if (currentProj && currentProj.modelConfig?.mode === 'custom') {
          currentProj.modelConfig.engineMode = 'paid';
          await api.updateProject(currentProj.id, { modelConfig: currentProj.modelConfig });
        }
        await api.saveSettings({ engineMode: 'paid' });
        this.settings = await api.getSettings();
        this.updateModelLabels();
        this.showToast('Switched to Paid Frontier Engine.', 'info');
      });
    }

    // Topbar Settings Button
    document.getElementById('btnTopbarSettings')?.addEventListener('click', () => {
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

    if (!this.currentSession) {
      if (titleEl) titleEl.textContent = 'Eyqa';
      if (folderBadgeEl) folderBadgeEl.hidden = true;
      return;
    }

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

    const hasScopedFolder = Boolean(this.currentSession?.scopedFolder);
    const hasAttach = Boolean(this.attachedFile);

    if (metaBar) {
      metaBar.hidden = !hasScopedFolder && !hasAttach;
    }

    if (folderPill && folderName) {
      if (hasScopedFolder) {
        folderPill.hidden = false;
        const base = this.currentSession.scopedFolder.split(/[\\/]/).pop() || 'Context';
        folderName.textContent = `Scope: ${base}`;
        folderPill.title = `Temporarily scoped to: ${this.currentSession.scopedFolder}. Click × to reset to project root.`;
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
      linkFolderBtn.classList.toggle('active', hasScopedFolder);
      linkFolderLabel.textContent = hasScopedFolder ? 'Scoped Context' : 'Scope Context';
    }
  }

  setupDockInput() {
    const textarea = document.getElementById('chatInputTextarea');
    const sendBtn = document.getElementById('btnSendMessage');
    const stopBtn = document.getElementById('btnStopGeneration');
    const attachBtn = document.getElementById('btnAttachFile');
    const webToggleBtn = document.getElementById('btnToggleWebSearch');
    const linkFolderBtn = document.getElementById('btnLinkFolder');
    const mentionBtn = document.getElementById('btnMentionContext');
    const dockUnlinkFolderBtn = document.getElementById('btnDockUnlinkFolder');
    const dockRemoveAttachBtn = document.getElementById('btnDockRemoveAttachment');

    this.updateSendBtnState();

    // Auto-resizing textarea & draft sync (enforcing single-row baseline)
    textarea?.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(38, Math.min(textarea.scrollHeight, 180)) + 'px';
      if (this.currentSession) {
        this.currentSession.draft = textarea.value;
      }
      this.updateSendBtnState();
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
      const sId = this.currentSession?.id;
      if (sId) {
        await api.stopTurn(sId);
        this.runningTurns.delete(sId);
        this._updateGeneratingState();
        this.renderSidebarLists();
      }
    });

    // Attach File
    attachBtn?.addEventListener('click', async () => {
      const file = await api.selectAttachmentFile();
      if (file && !file.error) {
        this.attachedFile = file;
        this.updateDockMeta();
        this.updateSendBtnState();
      }
    });

    // Mention Context (@) button
    mentionBtn?.addEventListener('click', async () => {
      if (this.currentSession?.folderPath) {
        const files = await api.listWorkspace();
        if (files && files.items && files.items.length > 0) {
          const fileNames = files.items.slice(0, 8).map(f => f.name).join(', ');
          if (textarea) {
            textarea.value += (textarea.value ? ' ' : '') + `@context [Files: ${fileNames}] `;
            textarea.focus();
            this.updateSendBtnState();
          }
        } else {
          this.showToast('Workspace is empty or has no files.', 'info');
        }
      } else {
        this.showToast('Link a project folder first to mention context files.', 'info');
      }
    });

    // Remove Attachment Pill
    dockRemoveAttachBtn?.addEventListener('click', () => {
      this.attachedFile = null;
      this.updateDockMeta();
      this.updateSendBtnState();
    });

    // Web Search Toggle
    webToggleBtn?.addEventListener('click', () => {
      this.forceWebSearch = !this.forceWebSearch;
      webToggleBtn.classList.toggle('active', this.forceWebSearch);
      this.showToast(this.forceWebSearch ? 'Live Web Search: Force Grounding Enabled' : 'Live Web Search: Auto', 'info');
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

  updateSendBtnState() {
    const textarea = document.getElementById('chatInputTextarea');
    const sendBtn = document.getElementById('btnSendMessage');
    const hasContent = Boolean(textarea?.value?.trim() || this.attachedFile);
    sendBtn?.classList.toggle('active', hasContent);
  }

  async submitMessage() {
    if (this.isGenerating) return;

    const textarea = document.getElementById('chatInputTextarea');
    const content = textarea.value.trim();
    if (!content && !this.attachedFile) return;

    // Ensure we have a current session
    if (!this.currentSession) {
      await this.createNewChat();
      if (!this.currentSession) return;
    }

    textarea.value = '';
    textarea.style.height = 'auto';
    if (this.currentSession) {
      this.currentSession.draft = '';
    }

    const attachment = this.attachedFile;
    this.attachedFile = null;
    this.updateDockMeta();
    this.updateSendBtnState();

    // Set first message title
    if ((!this.currentSession.messages || this.currentSession.messages.length === 0) && !this.currentSession.folderPath) {
      this.currentSession.title = content.slice(0, 32) || 'Conversation';
    }

    await this._runTurn(content, attachment, true);
  }

  async regenerateTurn(idx) {
    if (this.isGenerating || !this.currentSession || !this.currentSession.messages?.length) return;

    let targetIdx = typeof idx === 'number' && !isNaN(idx) ? idx : -1;
    if (targetIdx < 0 || targetIdx >= this.currentSession.messages.length) {
      // Find the last assistant message
      for (let i = this.currentSession.messages.length - 1; i >= 0; i--) {
        if (this.currentSession.messages[i].role === 'assistant') {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx < 0) return;

    // The preceding user message is at targetIdx - 1
    const userMsgIdx = targetIdx - 1;
    if (userMsgIdx < 0 || this.currentSession.messages[userMsgIdx].role !== 'user') return;

    const userMsg = this.currentSession.messages[userMsgIdx];
    const userPrompt = userMsg.content;
    const userAttachment = userMsg.attachment || null;

    // Truncate messages to preserve history up to the user prompt
    this.currentSession.messages = this.currentSession.messages.slice(0, userMsgIdx + 1);
    await api.saveSession(this.currentSession);
    this.chatView.render(this.currentSession.messages);

    await this._runTurn(userPrompt, userAttachment, false);
  }

  async _runTurn(content, attachment = null, shouldAddUserMessage = true) {
    if (!this.currentSession) return;

    const targetSession = this.currentSession;
    const targetSessionId = targetSession.id;

    if (shouldAddUserMessage) {
      const userMessage = {
        role: 'user',
        content,
        attachment,
        timestamp: Date.now()
      };

      if (!targetSession.messages) {
        targetSession.messages = [];
      }
      targetSession.messages.push(userMessage);

      // Save title immediately so sidebar reflects it
      await api.saveSession(targetSession);
      await this.loadSessions();
      this.updateTopBar();

      // If user is currently looking at this session, stream into view
      if (this.currentSession?.id === targetSessionId) {
        this.chatView.startStream(userMessage);
      }
    } else {
      // Regenerate
      if (this.currentSession?.id === targetSessionId) {
        this.chatView.startStream(null);
      }
    }

    // Register active running turn in memory
    const turnState = {
      session: targetSession,
      startTime: Date.now(),
      accumulatedContent: '',
      accumulatedThought: '',
      tools: []
    };
    this.runningTurns.set(targetSessionId, turnState);
    this.renderSidebarLists();
    this._updateGeneratingState();

    // Determine effective provider and models (Global Default vs Project Override)
    const currentProj = this.projects.find(p => p.id === targetSession?.projectId);
    let effectiveProviderId = this.settings?.engineMode === 'free_pool' ? 'free_pool' : this.settings?.activeProviderId;
    let customPrompt = currentProj?.customPrompt || '';

    if (currentProj?.modelConfig?.mode === 'custom') {
      if (currentProj.modelConfig.engineMode === 'free_pool') {
        effectiveProviderId = 'free_pool';
      } else if (currentProj.modelConfig.engineMode === 'paid') {
        const activeRef = currentProj.modelConfig.activeModelRef;
        if (activeRef) {
          effectiveProviderId = activeRef.split('/')[0];
        }
      }
    }

    try {
      const response = await api.startTurn({
        sessionId: targetSessionId,
        sessionTitle: targetSession.title || 'Chat Task',
        messages: targetSession.messages,
        userMessage: content,
        folderPath: targetSession.folderPath || null,
        modeId: 'chat',
        providerId: effectiveProviderId,
        customPrompt,
        forceWebSearch: this.forceWebSearch
      }, {
        onToken: (tokData) => {
          const sId = (typeof tokData === 'object' && tokData?.sessionId) ? tokData.sessionId : targetSessionId;
          const token = (typeof tokData === 'object' && tokData?.token !== undefined) ? tokData.token : tokData;
          const t = this.runningTurns.get(sId);
          if (t) t.accumulatedContent += token;
          if (this.currentSession?.id === sId) {
            this.chatView.appendToken(token);
          }
        },
        onThought: (thData) => {
          const sId = (typeof thData === 'object' && thData?.sessionId) ? thData.sessionId : targetSessionId;
          const thought = (typeof thData === 'object' && thData?.thought !== undefined) ? thData.thought : thData;
          const t = this.runningTurns.get(sId);
          if (t) t.accumulatedThought += thought;
          if (this.currentSession?.id === sId) {
            this.chatView.appendThought(thought);
          }
        },
        onToolStart: (toolData) => {
          const sId = (typeof toolData === 'object' && toolData?.sessionId) ? toolData.sessionId : targetSessionId;
          const tool = (typeof toolData === 'object' && toolData?.tool !== undefined) ? toolData.tool : toolData;
          const t = this.runningTurns.get(sId);
          if (t) t.tools.push(tool);
          if (this.currentSession?.id === sId) {
            this.chatView.addToolBadge(tool);
          }
        },
        onToolResult: (resData) => {
          const sId = (typeof resData === 'object' && resData?.sessionId) ? resData.sessionId : targetSessionId;
          const result = (typeof resData === 'object' && resData?.result !== undefined) ? resData.result : resData;
          if (this.currentSession?.id === sId) {
            this.chatView.updateToolResult(result);
          }
        },
        onAskQuestion: (qData) => {
          const sId = (typeof qData === 'object' && qData?.sessionId) ? qData.sessionId : targetSessionId;
          const question = (typeof qData === 'object' && qData?.question !== undefined) ? qData.question : qData;
          if (this.currentSession?.id === sId) {
            this.chatView.renderQuestionCard(question);
          }
        },
        onBrowserTakeover: (takeoverData) => {
          const sId = (typeof takeoverData === 'object' && takeoverData?.sessionId) ? takeoverData.sessionId : targetSessionId;
          const takeover = (typeof takeoverData === 'object' && takeoverData?.takeover !== undefined) ? takeoverData.takeover : takeoverData;
          if (this.currentSession?.id === sId) {
            this.chatView.renderBrowserTakeoverCard(takeover);
          }
        },
        onFallback: () => {
          // Silent background failover without disrupting chat
        }
      });

      const t = this.runningTurns.get(targetSessionId);
      const finalContent = response?.result?.content || t?.accumulatedContent || '';
      const finalThought = response?.result?.thought || t?.accumulatedThought || '';
      const finalTools = response?.result?.tools || t?.tools || [];

      if (response && response.result) {
        const assistantMessage = {
          role: 'assistant',
          content: finalContent,
          thought: finalThought,
          tools: finalTools,
          provider: response.result.provider,
          timestamp: Date.now()
        };

        targetSession.messages.push(assistantMessage);
        await api.saveSession(targetSession);
        await this.loadSessions();

        if (this.currentSession?.id === targetSessionId) {
          this.chatView.finishStream(response.result);
        } else {
          // Completed in background while user was viewing another chat!
          this.showToast(`Completed response in "${targetSession.title}".`, 'success');
          api.showNotification('Eyqa: Task Complete', `Finished response in "${targetSession.title}"`, targetSessionId);
        }
      } else if (response && response.error) {
        if (this.currentSession?.id === targetSessionId) {
          this.chatView.showStreamError(response.error);
        }
        this.showToast(response.error, 'error');
      }
    } catch (err) {
      if (this.currentSession?.id === targetSessionId) {
        this.chatView.showStreamError(err.message);
      }
      this.showToast(`Generation failed: ${err.message}`, 'error');
    } finally {
      this.runningTurns.delete(targetSessionId);
      this._updateGeneratingState();
      this.renderSidebarLists();
    }
  }

  async handleRollbackTurn({ msgIndex, newContent, shouldSend, shouldRevertFiles, subsequentSnapshots }) {
    if (!this.currentSession) return;

    // 1. Revert snapshots if requested
    if (shouldRevertFiles && subsequentSnapshots && subsequentSnapshots.length > 0) {
      for (const snap of subsequentSnapshots) {
        try {
          await api.revertSnapshot(snap.id, this.currentSession.projectId);
        } catch (e) {
          console.warn('[Rollback] Could not revert snapshot', snap.id, e);
        }
      }
      this.showToast(`Reverted ${subsequentSnapshots.length} file snapshot(s).`, 'info');
    }

    // 2. Truncate session messages to msgIndex
    this.currentSession.messages = this.currentSession.messages.slice(0, msgIndex);
    await api.saveSession(this.currentSession);

    if (shouldSend) {
      await this._runTurn(newContent, null, true);
    } else {
      const textarea = document.getElementById('chatInputTextarea');
      if (textarea) {
        textarea.value = newContent;
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(38, Math.min(textarea.scrollHeight, 180)) + 'px';
        this.updateSendBtnState();
      }
      this.chatView.render();
      this.showToast(`Rolled back conversation to message #${msgIndex + 1}.`, 'info');
    }
  }

  _updateGeneratingState() {
    const isCurrentBusy = Boolean(this.runningTurns && this.runningTurns.has(this.currentSession?.id));
    const sendBtn = document.getElementById('btnSendMessage');
    const stopBtn = document.getElementById('btnStopGeneration');
    if (sendBtn) sendBtn.hidden = isCurrentBusy;
    if (stopBtn) stopBtn.hidden = !isCurrentBusy;
  }

  updateModelLabels() {
    const currentProj = this.projects?.find(p => p.id === this.currentSession?.projectId);
    const hasProjectOverride = currentProj?.modelConfig?.mode === 'custom';
    const isFree = hasProjectOverride
      ? currentProj.modelConfig.engineMode === 'free_pool'
      : (this.settings?.engineMode || 'free_pool') === 'free_pool';

    const activeRef = this.settings?.activeModelRef;
    const activeProvider = this.settings?.providers?.[this.settings?.activeProviderId];
    
    let displayName = '';
    if (isFree) {
      displayName = 'Free Auto Pool';
    } else {
      if (hasProjectOverride && currentProj?.modelConfig?.customModel) {
        displayName = currentProj.modelConfig.customModel;
      } else {
        displayName = activeRef ? activeRef.split('/').pop() : (activeProvider?.name || 'Paid Engine');
      }
    }

    const btnFree = document.getElementById('btnSwitchFreePool');
    const btnPaid = document.getElementById('btnSwitchPaidEngine');
    if (btnFree && btnPaid) {
      btnFree.classList.toggle('active', isFree);
      btnPaid.classList.toggle('active', !isFree);
    }

    const sidebarLabel = document.getElementById('sidebarModelLabel');
    if (sidebarLabel) {
      sidebarLabel.textContent = displayName;
      sidebarLabel.title = isFree ? 'Free Auto Pool: Powered by Free Claude Code' : displayName;
    }

    const topbarModelName = document.getElementById('topbarModelName');
    if (topbarModelName) {
      topbarModelName.textContent = displayName;
      topbarModelName.title = isFree ? 'Free AI Pool: 19 Providers with Auto-Failover' : displayName;
    }
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
      // Escape: Dismiss active overlays, lightbox, modals, drawer, settings
      if (e.key === 'Escape') {
        const lightbox = document.getElementById('imageLightboxOverlay');
        if (lightbox && lightbox.classList.contains('visible')) {
          this.closeImageLightbox();
          return;
        }
        const modal = document.getElementById('newProjectModal');
        if (modal && modal.style.display !== 'none') {
          modal.style.display = 'none';
          return;
        }
        const drawer = document.getElementById('inspectorDrawer');
        if (drawer && drawer.classList.contains('open')) {
          this.closeInspector();
          return;
        }
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

  setupFileLinks() {
    // Listen for link clicks in chat
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="file:"]');
      if (link) {
        e.preventDefault();
        const filePath = decodeURIComponent(link.getAttribute('href').replace(/^file:\/\//, '').replace(/^file:/, ''));
        this.openInspector(filePath);
        return;
      }
      const eyqaLink = e.target.closest('.eyqa-file-link');
      if (eyqaLink) {
        e.preventDefault();
        const filePath = eyqaLink.dataset.filepath || eyqaLink.textContent;
        this.openInspector(filePath);
        return;
      }
    });

    document.getElementById('closeInspectorBtn')?.addEventListener('click', () => {
      this.closeInspector();
    });
  }

  setupImageLightbox() {
    document.addEventListener('click', (e) => {
      const img = e.target.closest('.md-zoomable-image');
      if (img && !img.closest('.image-load-error')) {
        this.openImageLightbox(img.src, img.alt);
      }
    });
  }

  openImageLightbox(src, alt = '') {
    let overlay = document.getElementById('imageLightboxOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'imageLightboxOverlay';
      overlay.className = 'image-lightbox-overlay';
      overlay.innerHTML = `
        <div class="image-lightbox-backdrop"></div>
        <div class="image-lightbox-container">
          <button class="image-lightbox-close" id="btnCloseImageLightbox" title="Close (Esc)">✕</button>
          <img class="image-lightbox-content" src="" alt="" />
          <div class="image-lightbox-caption"></div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('.image-lightbox-backdrop')?.addEventListener('click', () => {
        this.closeImageLightbox();
      });
      overlay.querySelector('#btnCloseImageLightbox')?.addEventListener('click', () => {
        this.closeImageLightbox();
      });
    }

    const imgEl = overlay.querySelector('.image-lightbox-content');
    const capEl = overlay.querySelector('.image-lightbox-caption');
    if (imgEl) {
      imgEl.src = src;
      imgEl.alt = alt;
    }
    if (capEl) {
      capEl.textContent = alt;
      capEl.hidden = !alt;
    }
    overlay.classList.add('visible');
  }

  closeImageLightbox() {
    const overlay = document.getElementById('imageLightboxOverlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
  }

  async openInspector(filePath) {
    const drawer = document.getElementById('inspectorDrawer');
    if (!drawer) return;

    const projectId = this.currentSession?.projectId || null;
    const pathLabel = document.getElementById('inspectorFilePath');
    const badge = document.getElementById('inspectorSnapshotBadge');
    const viewer = document.getElementById('inspectorFileViewer');
    const timeline = document.getElementById('inspectorSnapshotTimeline');

    if (pathLabel) pathLabel.textContent = filePath;
    if (badge) badge.textContent = 'loading...';
    if (viewer) viewer.innerHTML = '<div style="color:var(--text-muted); padding:10px;">Loading file content...</div>';
    if (timeline) timeline.innerHTML = '<div class="timeline-header">Snapshot History</div><div style="color:var(--text-muted); font-size:11px; padding:4px 0;">Loading history...</div>';

    drawer.classList.add('open');

    try {
      const [contentRes, snapshotsRes] = await Promise.all([
        api.getFileContent(projectId, filePath),
        api.getSnapshots(projectId, filePath)
      ]);

      const snapshots = Array.isArray(snapshotsRes) ? snapshotsRes : [];
      if (badge) badge.textContent = snapshots.length > 0 ? `v${snapshots.length}` : 'vLatest';

      // Render File Viewer
      if (contentRes && contentRes.success && typeof contentRes.content === 'string') {
        const lines = contentRes.content.split('\n');
        viewer.innerHTML = lines.map((line, idx) => {
          let lineClass = 'line';
          if (line.trim().startsWith('+') && !line.trim().startsWith('+++')) lineClass += ' diff-add';
          else if (line.trim().startsWith('-') && !line.trim().startsWith('---')) lineClass += ' diff-del';
          return `<div class="${lineClass}"><span class="line-num">${idx + 1}</span><span class="line-content">${this._escape(line)}</span></div>`;
        }).join('');
      } else if (contentRes && contentRes.error) {
        viewer.innerHTML = `<div style="color:var(--error); padding:10px; display:flex; align-items:center; gap:8px;">${icons.xCircle} <span>${this._escape(contentRes.error)}</span></div>`;
      } else {
        viewer.innerHTML = `<div style="color:var(--text-muted); padding:10px;">Empty file or not found in workspace.</div>`;
      }

      // Render Snapshot Timeline
      if (snapshots.length === 0) {
        timeline.innerHTML = `
          <div class="timeline-header">Snapshot History (Git-Style Rollback)</div>
          <div style="font-size:12px; color:var(--text-muted); padding:8px 0;">No prior snapshots yet for this file. Edits made by Eyqa will automatically generate rollback points.</div>
        `;
      } else {
        timeline.innerHTML = `
          <div class="timeline-header">Snapshot History (${snapshots.length} versions)</div>
          ${snapshots.map((snap) => {
            const dateStr = new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return `
              <div class="timeline-item">
                <div class="timeline-info">
                  <span class="timeline-version">${snap.messageSummary || `Revision ${snap.id.slice(-6)}`}</span>
                  <span class="timeline-time">${dateStr}</span>
                </div>
                <button class="btn-revert" data-snapshot-id="${snap.id}">Revert</button>
              </div>
            `;
          }).join('')}
        `;

        timeline.querySelectorAll('.btn-revert').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const snapId = e.currentTarget.dataset.snapshotId;
            const res = await api.revertSnapshot(snapId, projectId);
            if (res && res.success) {
              this.showToast(`Reverted ${filePath} successfully`, 'success');
              await this.openInspector(filePath);
            } else {
              this.showToast(`Failed to revert: ${res?.error || 'Unknown error'}`, 'error');
            }
          });
        });
      }
    } catch (err) {
      if (viewer) viewer.innerHTML = `<div style="color:var(--error); padding:10px;">Error: ${this._escape(err.message)}</div>`;
    }
  }

  closeInspector() {
    const drawer = document.getElementById('inspectorDrawer');
    if (drawer) drawer.classList.remove('open');
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Initialize Application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new EyqaApp();
  window.app = app;
  app.init().catch(err => {
    console.error('[EyqaApp] Initialization failed:', err);
  });
});

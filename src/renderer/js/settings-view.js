/**
 * Eyqa Dedicated Settings Desktop Workspace
 * High-performance, unconstrained settings view styled after Linear, ChatGPT, and macOS.
 * Implements the complete Free Claude Code (FCC) model architecture:
 * - Automated Free AI Pool with 19 providers, direct 1-click links, and FCC cascading priority logic.
 *   (Zero model picking for free tier; auto-routes and cascades on rate limits).
 * - Paid Frontier Models with manual model selection (Claude 3.7 Sonnet, GPT-4o, DeepSeek-V3/R1, Grok 2)
 *   and granular reasoning effort picker (from_client, off, low, medium, high, max).
 * - Project Settings (workspace folder, project name, custom rules).
 * - Preferences (Onyx obsidian dark theme, web search grounding, keyboard shortcuts).
 */

import { icons } from './icons.js';
import { api } from './api.js';

// The 19 Free Claude Code Providers in Priority Sequence
export const FCC_FREE_PROVIDERS = [
  'groq',
  'cerebras',
  'sambanova',
  'nvidia_nim',
  'gemini',
  'openrouter',
  'together',
  'deepinfra',
  'siliconflow',
  'qwen',
  'kilo',
  'zenmux',
  'huggingface',
  'mistral',
  'cohere',
  'cloudflare',
  'ollama',
  'lmstudio',
  'fcc_proxy'
];

// Paid Frontier Providers
export const PAID_PROVIDERS = [
  'anthropic',
  'openai',
  'deepseek',
  'xai'
];

// Paid Model Catalog for explicit model selection
export const PAID_MODEL_CATALOG = [
  {
    slug: 'anthropic/claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    providerId: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    desc: 'State-of-the-art hybrid reasoning model from Anthropic. Adjust thinking budget via Reasoning Effort.',
    reasoning: true,
    context: '200k'
  },
  {
    slug: 'anthropic/claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    providerId: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    desc: 'Industry benchmark for code generation, architectural design, and complex problem solving.',
    reasoning: false,
    context: '200k'
  },
  {
    slug: 'anthropic/claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    providerId: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    desc: 'Rapid inference with near-Sonnet intelligence. Excellent for fast agent iterations.',
    reasoning: false,
    context: '200k'
  },
  {
    slug: 'openai/gpt-4o',
    name: 'OpenAI GPT-4o',
    providerId: 'openai',
    modelId: 'gpt-4o',
    desc: 'OpenAI flagship multimodal intelligence with high speed and broad domain knowledge.',
    reasoning: false,
    context: '128k'
  },
  {
    slug: 'openai/o3-mini',
    name: 'OpenAI o3-mini',
    providerId: 'openai',
    modelId: 'o3-mini',
    desc: 'STEM and coding reasoning model with configurable reasoning effort.',
    reasoning: true,
    context: '128k'
  },
  {
    slug: 'deepseek/deepseek-chat',
    name: 'DeepSeek-V3',
    providerId: 'deepseek',
    modelId: 'deepseek-chat',
    desc: 'Direct DeepSeek API for 671B MoE chat at official API rates.',
    reasoning: false,
    context: '64k'
  },
  {
    slug: 'deepseek/deepseek-reasoner',
    name: 'DeepSeek-R1',
    providerId: 'deepseek',
    modelId: 'deepseek-reasoner',
    desc: 'Open-weights reasoning frontier model with transparent chain-of-thought.',
    reasoning: true,
    context: '64k'
  },
  {
    slug: 'xai/grok-2',
    name: 'xAI Grok 2',
    providerId: 'xai',
    modelId: 'grok-2',
    desc: 'Official xAI platform model with real-time world knowledge.',
    reasoning: false,
    context: '128k'
  }
];

export class SettingsView {
  constructor(containerEl, onNotification, onSettingsChanged) {
    this.container = containerEl;
    this.onNotification = onNotification;
    this.onSettingsChanged = onSettingsChanged;
    this.settings = null;
    this.projects = [];
    this.activeProjectId = null;
    this.activeTab = 'free'; // 'free' | 'paid' | 'project' | 'general'
    this.paidMode = 'simple'; // 'simple' | 'advanced'
    this.testResults = {};
    this.filterFreeProviderQuery = '';
    this.fccStatus = null;
    this.showFccLogs = false;
    this.fccLogs = [];
  }

  async open(initialTab = null, initialProjectId = null) {
    this.settings = await api.getSettings();
    try {
      this.projects = await api.listProjects();
    } catch (_) {
      this.projects = [];
    }
    if (initialProjectId) {
      this.activeProjectId = initialProjectId;
    } else if (!this.activeProjectId && this.projects.length > 0) {
      this.activeProjectId = this.projects[0].id;
    }
    this.paidMode = this.settings?.paidMode || 'simple';

    try {
      this.sessions = await api.getSessions();
    } catch (_) {
      this.sessions = [];
    }

    if (this.activeProjectId) {
      try {
        this.currentProjectMemory = await api.getProjectMemory(this.activeProjectId);
        this.currentProjectChangelog = await api.getProjectChangelog(this.activeProjectId);
      } catch (_) {
        this.currentProjectMemory = { notes: '', architecture: '' };
        this.currentProjectChangelog = [];
      }
    }

    try {
      this.fccStatus = await api.getFCCStatus();
    } catch (_) {
      this.fccStatus = { running: false, status: 'stopped', port: 8082 };
    }

    try {
      this.youMe = await api.getYouMe();
    } catch (_) {
      this.youMe = { name: '', background: '', likes: [], notes: [], raw: '' };
    }

    try {
      this.installedSkills = await api.listSkills(this.activeProjectId);
    } catch (_) {
      this.installedSkills = [];
    }

    if (initialTab) {
      this.activeTab = initialTab;
    } else if (this.settings.engineMode === 'paid') {
      this.activeTab = 'paid';
    } else {
      this.activeTab = 'free';
    }
    this.container.classList.add('open');
    this.container.removeAttribute('hidden');
    this.render();
  }

  close() {
    this.container.classList.remove('open');
    this.container.setAttribute('hidden', '');
  }

  render() {
    if (!this.settings) return;

    const isFreeMode = (this.settings.engineMode || 'free_pool') === 'free_pool';
    const activeModelRef = this.settings.activeModelRef || 'anthropic/claude-3-7-sonnet-20250219';

    this.container.innerHTML = `
      <div class="settings-nav-rail">
        <div class="settings-rail-header">
          <button class="settings-back-btn" id="btnSettingsBack" title="Back to Chat (Esc)">
            <span>← Back to Chat</span>
            <kbd>Esc</kbd>
          </button>
          <div class="settings-brand-header">
            <img class="settings-brand-logo" src="assets/frames/eyqa_far.png" alt="Eyqa Mascot" />
            <div class="settings-brand-text">
              <h2>Eyqa Settings</h2>
              <span>Desktop Workspace</span>
            </div>
          </div>
        </div>

        <nav class="settings-rail-nav">
          <button class="settings-rail-item ${this.activeTab === 'free' ? 'active' : ''}" data-tab="free">
            ${icons.sparkles}
            <span>Free AI Pool</span>
            <span class="rail-item-badge ${isFreeMode ? 'badge-active' : ''}">${isFreeMode ? 'Active Pool' : '1.75B Auto'}</span>
          </button>

          <button class="settings-rail-item ${this.activeTab === 'paid' ? 'active' : ''}" data-tab="paid">
            ${icons.briefcase}
            <span>Paid Frontier Models</span>
            <span class="rail-item-badge ${!isFreeMode ? 'badge-active' : ''}">${!isFreeMode ? 'Active Engine' : 'Manual'}</span>
          </button>

          <button class="settings-rail-item ${this.activeTab === 'project' ? 'active' : ''}" data-tab="project">
            ${icons.folder}
            <span>Project Settings</span>
          </button>

          <button class="settings-rail-item ${this.activeTab === 'memory' ? 'active' : ''}" data-tab="memory">
            ${icons.sparkles}
            <span>Dynamic Memory</span>
            <span class="rail-item-badge badge-active">Universal</span>
          </button>

          <button class="settings-rail-item ${this.activeTab === 'skills' ? 'active' : ''}" data-tab="skills">
            ${icons.code || icons.briefcase}
            <span>AI Skills Hub</span>
            <span class="rail-item-badge">hub.ai</span>
          </button>

          <button class="settings-rail-item ${this.activeTab === 'general' ? 'active' : ''}" data-tab="general">
            ${icons.settings}
            <span>Preferences</span>
          </button>
        </nav>

        <div class="settings-rail-footer">
          <div class="settings-status-widget">
            <div class="status-widget-label">Active Engine Mode</div>
            <div class="status-widget-value" title="${isFreeMode ? 'Free AI Pool (Auto-Cascade)' : activeModelRef}">
              ${isFreeMode ? 'Free AI Pool (Auto)' : this._escape(activeModelRef)}
            </div>
          </div>
          <div class="settings-rail-version">Eyqa v1.2.0 • 19 FCC Providers</div>
        </div>
      </div>

      <div class="settings-content-workspace">
        <header class="settings-workspace-header">
          <div class="workspace-title-box">
            <h1>${this._getTabTitle()}</h1>
            <p>${this._getTabSubtitle()}</p>
          </div>
          <div class="workspace-header-actions">
            <button class="secondary-btn btn-settings-cancel">Close</button>
            <button class="primary-button btn-save-settings">Save Changes</button>
          </div>
        </header>

        <div class="settings-workspace-body">
          ${this._renderTabContent()}
        </div>
      </div>
    `;

    this._attachEvents();
  }

  _getTabTitle() {
    switch (this.activeTab) {
      case 'free': return 'Free AI Pool & 1.75B Token Capacity';
      case 'paid': return 'Paid Frontier Models & Reasoning';
      case 'project': return 'Active Project Configuration';
      case 'memory': return 'User Profile & Preferences (you.me)';
      case 'skills': return 'AI Skills & Skills Hub Integration';
      case 'general': return 'Preferences & Customization';
      default: return 'Settings';
    }
  }

  _getTabSubtitle() {
    switch (this.activeTab) {
      case 'free': return '100% Automated pool. No manual model selection needed—Eyqa automatically routes through all 19 Free Claude Code providers with instant HTTP 429 failover.';
      case 'paid': return 'Official paid API keys for Anthropic Claude 3.7 Sonnet, OpenAI GPT-4o, DeepSeek-V3/R1, and xAI Grok with manual model selection and reasoning effort controls.';
      case 'project': return 'Configure workspace folder permissions and custom system prompt rules for the current project.';
      case 'memory': return 'Information about you (your name, background, what you like, and preferences). Project and codebase memory is kept strictly per project in Project Settings.';
      case 'skills': return 'Modular skills catalog and live discovery from https://skills-hub.ai. Enhance Eyqa with domain-specific workflows.';
      case 'general': return 'Theme appearance, DuckDuckGo web search grounding defaults, and keyboard shortcuts.';
      default: return '';
    }
  }

  _renderTabContent() {
    if (this.activeTab === 'free') {
      return this._renderFreePoolTab();
    }
    if (this.activeTab === 'paid') {
      return this._renderPaidTab();
    }
    if (this.activeTab === 'project') {
      return this._renderProjectTab();
    }
    if (this.activeTab === 'memory') {
      return this._renderMemoryTab();
    }
    if (this.activeTab === 'skills') {
      return this._renderSkillsTab();
    }
    if (this.activeTab === 'general') {
      return this._renderGeneralTab();
    }
    return '';
  }

  /**
   * Tab 1: Free AI Pool (100% Automated)
   * Explains that users do NOT select models here; handles all 19 FCC providers.
   */
  _renderFreePoolTab() {
    const isFreeActive = (this.settings.engineMode || 'free_pool') === 'free_pool';
    const freePriorityList = this.settings.freePoolPriority || FCC_FREE_PROVIDERS;

    // Count configured providers
    let configuredCount = 0;
    freePriorityList.forEach(id => {
      const p = this.settings.providers[id];
      if (p && (p.apiKey?.trim() || id === 'ollama' || id === 'lmstudio' || id === 'fcc_proxy')) {
        configuredCount++;
      }
    });

    // Filter providers by search
    const filteredProviders = freePriorityList.filter(id => {
      const p = this.settings.providers[id];
      if (!p) return false;
      if (!this.filterFreeProviderQuery) return true;
      const q = this.filterFreeProviderQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || id.includes(q);
    });

    return `
      <!-- Engine Mode Banner & Switcher -->
      <div class="engine-mode-switcher-card ${isFreeActive ? 'is-active-mode' : ''}">
        <div class="engine-mode-info">
          <div class="engine-mode-badge-row">
            <span class="engine-mode-pill ${isFreeActive ? 'pill-active' : ''}">
              <span class="status-indicator-dot ${isFreeActive ? 'online' : 'offline'}"></span>
              <span>${isFreeActive ? 'Active Engine' : 'Inactive'}</span>
            </span>
            <span class="engine-mode-tag">100% Automated Cascading Pool</span>
          </div>
          <h3 class="engine-mode-title">${icons.sparkles} Free Claude Code AI Pool</h3>
          <p class="engine-mode-desc">
            <strong>No model selection required.</strong> Free tier quotas fluctuate rapidly. Eyqa eliminates provider fragmentation by automatically routing across all your configured free providers according to FCC priority. If an HTTP 429 rate limit or outage occurs, Eyqa cascades seamlessly to the next provider without interruption.
          </p>
        </div>
        <div class="engine-mode-action">
          ${!isFreeActive ? `
            <button class="primary-button btn-activate-free-pool">
              Activate Free AI Pool
            </button>
          ` : `
            <button class="secondary-btn btn-switch-to-paid-tab">
              Switch to Paid Engine →
            </button>
          `}
        </div>
      </div>

      <!-- FCC 1.75B+ Free Token Dashboard -->
      <div class="fcc-dashboard">
        <div class="fcc-dashboard-header">
          ${icons.bolt}
          <div>
            <strong>1.75B+ Monthly Free Token Capacity Dashboard</strong>
            <p>Aggregated monthly free tier quota: <span class="highlight-tokens">1,750,000,000+ Free Tokens/mo</span> • <span style="color:#ffffff; font-weight:600;">${configuredCount} of 19 Providers Active</span></p>
          </div>
        </div>
        <div class="fcc-metrics">
          ${freePriorityList.map(id => {
            const p = this.settings.providers[id];
            if (!p) return '';
            const hasKey = Boolean(p.apiKey && p.apiKey.trim() && p.apiKey !== 'fcc');
            const isLocal = id === 'ollama' || id === 'lmstudio';
            const isOnline = hasKey || isLocal || (id === 'fcc_proxy' && p.apiKey === 'fcc');
            return `
              <div class="fcc-metric-row">
                <span class="status-dot ${isOnline ? 'online' : 'offline'}" title="${isOnline ? 'Active in Pool' : 'Key Needed'}"></span>
                <span class="fcc-metric-name">${this._escape(p.name)}</span>
                <span class="fcc-metric-capacity">${this._escape(p.badge || p.capacity || 'Free Tier')}</span>
              </div>
            `;
          }).join('')}
        </div>
        <p class="fcc-dashboard-sub">
          Add free API keys below using direct 1-click links (zero credit card required). Once added, they are instantly part of your automated cascade pool.
        </p>
      </div>

      <!-- Visual FCC Priority Cascading Chain -->
      <div class="settings-section-card">
        <div class="section-card-title">FCC Cascading Failover Sequence</div>
        <div class="section-card-desc">
          When rate limits (HTTP 429) occur, Eyqa automatically cascades from left to right through this prioritized chain:
        </div>
        <div class="fcc-chain-flow">
          ${freePriorityList.map((id, index) => {
            const p = this.settings.providers[id];
            if (!p) return '';
            const hasKey = Boolean(p.apiKey && p.apiKey.trim()) || id === 'ollama' || id === 'lmstudio' || id === 'fcc_proxy';
            return `
              <div class="chain-step ${hasKey ? 'step-ready' : 'step-empty'}">
                <span class="chain-step-num">${index + 1}</span>
                <span class="chain-step-name">${this._escape(p.name)}</span>
                <span class="chain-step-dot ${hasKey ? 'online' : 'offline'}"></span>
              </div>
              ${index < freePriorityList.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
            `;
          }).join('')}
        </div>
      </div>

      <!-- Search & Filter Bar for 19 Providers -->
      <div class="catalog-toolbar" style="margin-top: 24px;">
        <input 
          type="text" 
          class="catalog-search-input" 
          id="freeProviderSearchInput" 
          placeholder="Filter 19 free providers by name (Groq, Cerebras, NVIDIA, Gemini, SambaNova...)" 
          value="${this._escape(this.filterFreeProviderQuery)}" 
        />
        <span style="font-size: 12px; color: #888;">Showing ${filteredProviders.length} of 19 Providers</span>
      </div>

      <!-- All 19 Free Provider Setup Cards -->
      <div class="settings-provider-list">
        ${filteredProviders.map(id => this._renderFreeProviderCard(id)).join('')}
      </div>
    `;
  }

  /**
   * Render individual Free Provider Card (NO model dropdown, auto-managed model)
   */
  _renderFreeProviderCard(id) {
    const p = this.settings.providers[id];
    if (!p) return '';

    if (id === 'fcc_proxy') {
      const isRunning = this.fccStatus?.running || false;
      const test = this.testResults[id];
      return `
        <div class="provider-setup-card pool-active embedded-fcc-card" data-id="fcc_proxy">
          <div class="provider-card-header">
            <div class="provider-card-title-group">
              <h4>${icons.server} Embedded Free Claude Code Background Service</h4>
              <span class="badge free">Port 8082</span>
              <span class="badge active-badge"><span class="status-indicator-dot ${isRunning ? 'online' : 'offline'}"></span> ${isRunning ? 'Service Running' : 'Service Stopped'}</span>
              <span class="badge" style="background:rgba(255,255,255,0.08); color:#fff;">src/fcc/ in codebase</span>
            </div>
            <div class="provider-header-actions">
              <span class="auto-model-indicator" title="Model managed by Embedded FCC Service">
                Auto Model: <code>nemotron-3-super-120b</code>
              </span>
            </div>
          </div>

          <p class="provider-card-desc">
            Free Claude Code is included directly as an internal background library in <code>src/fcc/</code>. Eyqa boots and supervises this service automatically on port 8082. You can inspect and edit the Python library code directly in the repository and restart below.
          </p>

          <div class="fcc-embedded-status-bar">
            <div class="status-meta-item">
              <span class="meta-label">Service Health</span>
              <span class="meta-val ${isRunning ? 'online' : 'offline'}">${isRunning ? 'Active & Serving' : 'Stopped / Starting'}</span>
            </div>
            <div class="status-meta-item">
              <span class="meta-label">Local Endpoint</span>
              <span class="meta-val">http://127.0.0.1:8082/v1</span>
            </div>
            <div class="status-meta-item">
              <span class="meta-label">Process PID</span>
              <span class="meta-val">${this.fccStatus?.pid || 'Auto-Managed'}</span>
            </div>
            <div class="status-meta-item">
              <span class="meta-label">Library Location</span>
              <span class="meta-val">eyqa/src/fcc/</span>
            </div>
          </div>

          <div class="provider-card-footer" style="margin-top: 14px; gap: 10px; flex-wrap: wrap;">
            <button class="secondary-btn btn-restart-fcc">
              ${icons.rotateCcw} <span>Restart Background Service</span>
            </button>
            <button class="secondary-btn btn-toggle-fcc-logs">
              ${icons.terminal} <span>${this.showFccLogs ? 'Hide Live Logs' : 'View Live Logs'}</span>
            </button>
            <button class="secondary-btn btn-test-connection" data-id="fcc_proxy">
              ${icons.bolt} <span>Test Local Endpoint</span>
            </button>

            <div class="test-result-indicator" id="testResult_fcc_proxy">
              ${test ? (test.success 
                ? `<span class="test-badge success"><span class="status-indicator-dot online"></span> ${test.latency}ms · Connected to embedded service</span>`
                : `<span class="test-badge error"><span class="status-indicator-dot offline"></span> ${this._escape(test.error || 'Failed')}</span>`
              ) : ''}
            </div>
          </div>

          ${this.showFccLogs ? `
            <div class="fcc-logs-viewer" style="margin-top: 14px; background: #000; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; font-family: var(--font-mono); font-size: 11px; max-height: 220px; overflow-y: auto; color: #39ff14; white-space: pre-wrap;">
              <div style="color: #888; margin-bottom: 6px; font-weight: 600; text-transform: uppercase;">Real-Time Embedded FCC Server Output:</div>
              ${(this.fccLogs && this.fccLogs.length > 0) ? this.fccLogs.join('\n') : 'No output recorded yet. Service is warming up.'}
            </div>
          ` : ''}
        </div>
      `;
    }

    const hasKey = Boolean(p.apiKey && p.apiKey.trim()) || id === 'ollama' || id === 'lmstudio' || id === 'fcc_proxy';
    const test = this.testResults[id];

    return `
      <div class="provider-setup-card ${hasKey ? 'pool-active' : ''}" data-id="${id}">
        <div class="provider-card-header">
          <div class="provider-card-title-group">
            <h4>${this._escape(p.name)}</h4>
            <span class="badge ${p.badgeType || 'free'}">${this._escape(p.badge || 'Free')}</span>
            ${hasKey ? '<span class="badge active-badge"><span class="status-indicator-dot online"></span> Ready in Pool</span>' : '<span class="badge" style="background:rgba(255,255,255,0.05); color:#888;"><span class="status-indicator-dot offline"></span> Needs Key</span>'}
          </div>
          <div class="provider-header-actions">
            <span class="auto-model-indicator" title="Model managed automatically by Free Auto-Pool">
              Auto Model: <code>${this._escape(p.model || 'default')}</code>
            </span>
          </div>
        </div>

        <p class="provider-card-desc">${this._escape(p.description)}</p>

        ${p.setupGuide ? `
          <div class="provider-guide-box">
            <div class="guide-title">${this._escape(p.setupGuide.title)}:</div>
            <ol class="guide-steps">
              ${p.setupGuide.steps.map(s => `<li>${this._linkify(this._escape(s))}</li>`).join('')}
            </ol>
            ${p.setupGuide.link ? `
              <a href="${p.setupGuide.link}" target="_blank" rel="noopener noreferrer" class="guide-link-btn">
                <span>1-Click Acquire Free Key</span> ${icons.link}
              </a>
            ` : ''}
          </div>
        ` : ''}

        <div class="provider-form-grid" style="grid-template-columns: 1fr;">
          <div class="form-field">
            <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">
              ${id === 'ollama' || id === 'lmstudio' ? 'Local Endpoint URL' : (id === 'fcc_proxy' ? 'FCC Proxy Port' : 'API Key')}
            </label>
            <div class="input-password-wrapper">
              <input 
                type="${id === 'ollama' || id === 'lmstudio' || id === 'fcc_proxy' ? 'text' : 'password'}" 
                class="input-text provider-key-input" 
                data-id="${id}" 
                value="${this._escape(p.apiKey || '')}" 
                placeholder="${id === 'ollama' ? 'http://localhost:11434 (Auto-detected)' : (id === 'lmstudio' ? 'http://localhost:1234 (Auto-detected)' : 'Paste API Key here...')}" 
              />
              ${id !== 'ollama' && id !== 'lmstudio' && id !== 'fcc_proxy' ? `
                <button class="btn-toggle-eye" type="button" title="Show/Hide">${icons.eye}</button>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="provider-card-footer">
          <button class="secondary-btn btn-test-connection" data-id="${id}">
            ${icons.bolt} <span>Test Connection</span>
          </button>

          <div class="test-result-indicator" id="testResult_${id}">
            ${test ? (test.success 
              ? `<span class="test-badge success"><span class="status-indicator-dot online"></span> ${test.latency}ms · ${this._escape(test.reply || 'Connected')}</span>`
              : `<span class="test-badge error"><span class="status-indicator-dot offline"></span> ${this._escape(test.error || 'Failed')}</span>`
            ) : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tab 2: Paid Frontier Models (Manual Selection Allowed)
   * Explicit model picking for paid users with Simple (single model) and Advanced (multi-role) options.
   */
  _renderPaidTab() {
    const isPaidActive = this.settings.engineMode === 'paid';
    const paidMode = this.paidMode || this.settings.paidMode || 'simple';
    const activeModelRef = this.settings.activeModelRef || 'anthropic/claude-3-7-sonnet-20250219';
    const thinkingModelRef = this.settings.thinkingModelRef || 'deepseek/deepseek-reasoner';
    const fallbackModelRef = this.settings.fallbackModelRef || 'anthropic/claude-3-5-haiku-20241022';
    const reasoningEffort = this.settings.reasoningEffort || 'from_client';

    const reasoningOptions = [
      { id: 'from_client', label: 'From client', sub: 'Auto / Default' },
      { id: 'off', label: 'Off', sub: 'Zero thinking' },
      { id: 'low', label: 'Low', sub: '~1k tokens' },
      { id: 'medium', label: 'Medium', sub: '~4k tokens' },
      { id: 'high', label: 'High', sub: '~16k tokens' },
      { id: 'max', label: 'Max', sub: '~32k tokens' }
    ];

    return `
      <!-- Engine Mode Banner & Switcher -->
      <div class="engine-mode-switcher-card ${isPaidActive ? 'is-active-mode' : ''}">
        <div class="engine-mode-info">
          <div class="engine-mode-badge-row">
            <span class="engine-mode-pill ${isPaidActive ? 'pill-active' : ''}">
              <span class="status-indicator-dot ${isPaidActive ? 'online' : 'offline'}"></span>
              <span>${isPaidActive ? 'Active Engine' : 'Inactive'}</span>
            </span>
            <span class="engine-mode-tag">Direct Paid Frontier Models</span>
          </div>
          <h3 class="engine-mode-title">${icons.diamond} Paid Frontier Model Engine</h3>
          <p class="engine-mode-desc">
            Direct API keys with official providers (Anthropic Claude 3.7 Sonnet, OpenAI GPT-4o, DeepSeek Official, xAI Grok). In paid mode, you choose your exact model and control reasoning effort parameters directly.
          </p>
        </div>
        <div class="engine-mode-action">
          ${!isPaidActive ? `
            <button class="primary-button btn-activate-paid-engine">
              Activate Paid Engine
            </button>
          ` : `
            <button class="secondary-btn btn-switch-to-free-tab">
              ← Switch to Free AI Pool
            </button>
          `}
        </div>
      </div>

      <!-- Simple vs Advanced Paid Sub-Mode Selector -->
      <div class="settings-section-card paid-mode-selector-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div class="section-card-title">Paid Configuration Mode</div>
            <div class="section-card-desc">Choose between quick single model selection or advanced role-specific multi-model routing.</div>
          </div>
          <div class="pill-segmented-control" style="display: flex; gap: 6px; background: #141414; padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <button class="secondary-btn btn-paid-submode ${paidMode === 'simple' ? 'active-primary' : ''}" data-submode="simple" style="height: 28px; font-size: 11.5px;">
              Simple (Single Model)
            </button>
            <button class="secondary-btn btn-paid-submode ${paidMode === 'advanced' ? 'active-primary' : ''}" data-submode="advanced" style="height: 28px; font-size: 11.5px;">
              Advanced (Multi-Role)
            </button>
          </div>
        </div>
      </div>

      ${paidMode === 'simple' ? `
        <!-- Active Paid Model Selection Card (Simple Mode) -->
        <div class="settings-section-card">
          <div class="section-card-title">Select Active Paid Model</div>
          <div class="section-card-desc">
            Choose the single frontier model to power your Eyqa conversations and coding turns:
          </div>
          <div class="paid-model-grid">
            ${PAID_MODEL_CATALOG.map(m => {
              const isSelected = activeModelRef === m.slug;
              return `
                <div class="paid-model-card ${isSelected ? 'selected' : ''}" data-slug="${this._escape(m.slug)}" data-provider="${m.providerId}" data-model="${m.modelId}">
                  <div class="paid-card-top">
                    <strong>${this._escape(m.name)}</strong>
                    ${isSelected ? `<span class="status-badge ready">${icons.star} Active</span>` : ''}
                  </div>
                  <div class="paid-card-slug">${this._escape(m.slug)}</div>
                  <div class="paid-card-meta">
                    <span class="model-tag context">${m.context} context</span>
                    ${m.reasoning ? '<span class="model-tag reasoning">Hybrid Reasoning</span>' : ''}
                  </div>
                  <p class="paid-card-desc">${this._escape(m.desc)}</p>
                  <button class="secondary-btn btn-select-paid-model ${isSelected ? 'active-primary' : ''}">
                    ${isSelected ? 'Active Model' : 'Select This Model'}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : `
        <!-- Advanced Multi-Model Role Routing Card -->
        <div class="settings-section-card">
          <div class="section-card-title">Advanced Multi-Model Role Specification</div>
          <div class="section-card-desc">
            Assign specialized frontier models for different aspects of conversation, deep reasoning, and fast execution:
          </div>

          <div class="advanced-role-grid" style="display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 16px;">
            <div class="role-config-card" style="background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                  <strong style="font-size: 13px; color: #fff;">1. Primary Chat & Coding Model</strong>
                  <p style="margin: 2px 0 0; font-size: 11.5px; color: #888;">Main turn driver for conversation, coding, and file synthesis.</p>
                </div>
                <span class="badge" style="background: rgba(255,255,255,0.1); color: #fff;">Primary</span>
              </div>
              <select class="input-select input-advanced-model" data-role="activeModelRef" style="width: 100%; padding: 8px; background: #1c1c1c; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff;">
                ${PAID_MODEL_CATALOG.map(m => `
                  <option value="${m.slug}" ${activeModelRef === m.slug ? 'selected' : ''}>
                    ${this._escape(m.name)} • ${m.slug} (${m.context})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="role-config-card" style="background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                  <strong style="font-size: 13px; color: #fff;">2. Deep Thinking & Reasoning Model</strong>
                  <p style="margin: 2px 0 0; font-size: 11.5px; color: #888;">Dispatched for complex algorithmic reasoning, architecture planning, and math.</p>
                </div>
                <span class="badge" style="background: rgba(59,130,246,0.15); color: #60a5fa;">Reasoning</span>
              </div>
              <select class="input-select input-advanced-model" data-role="thinkingModelRef" style="width: 100%; padding: 8px; background: #1c1c1c; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff;">
                ${PAID_MODEL_CATALOG.map(m => `
                  <option value="${m.slug}" ${thinkingModelRef === m.slug ? 'selected' : ''}>
                    ${this._escape(m.name)} • ${m.slug} ${m.reasoning ? '(Hybrid Reasoning)' : ''}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="role-config-card" style="background: #141414; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div>
                  <strong style="font-size: 13px; color: #fff;">3. Fast Fallback & Auxiliary Model</strong>
                  <p style="margin: 2px 0 0; font-size: 11.5px; color: #888;">Low-latency model used for tool summarization, fast drafts, and recovery.</p>
                </div>
                <span class="badge" style="background: rgba(16,185,129,0.15); color: #34d399;">Fallback</span>
              </div>
              <select class="input-select input-advanced-model" data-role="fallbackModelRef" style="width: 100%; padding: 8px; background: #1c1c1c; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff;">
                ${PAID_MODEL_CATALOG.map(m => `
                  <option value="${m.slug}" ${fallbackModelRef === m.slug ? 'selected' : ''}>
                    ${this._escape(m.name)} • ${m.slug}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      `}

      <!-- Reasoning Effort Selector -->
      <div class="settings-section-card">
        <div class="section-card-title">Thinking & Reasoning Effort</div>
        <div class="section-card-desc">
          Controls how many reasoning tokens models like Claude 3.7 Sonnet, DeepSeek-R1, and OpenAI o3-mini spend before responding:
        </div>
        <div class="reasoning-picker-grid">
          ${reasoningOptions.map(opt => `
            <button class="reasoning-option-btn ${reasoningEffort === opt.id ? 'active' : ''}" data-effort="${opt.id}">
              <span class="reasoning-btn-name">${opt.label}</span>
              <span class="reasoning-btn-sub">${opt.sub}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Paid Provider API Key Cards -->
      <div class="section-card-title" style="margin: 24px 0 12px;">Paid Provider API Keys</div>
      <div class="settings-provider-list">
        ${PAID_PROVIDERS.map(id => this._renderPaidProviderCard(id)).join('')}
      </div>
    `;
  }

  /**
   * Render individual Paid Provider Card (WITH model dropdown & API key)
   */
  _renderPaidProviderCard(id) {
    const p = this.settings.providers[id];
    if (!p) return '';

    const hasKey = Boolean(p.apiKey && p.apiKey.trim());
    const isPrimary = this.settings.activeProviderId === id;
    const test = this.testResults[id];

    return `
      <div class="provider-setup-card ${isPrimary ? 'primary-active' : ''}" data-id="${id}">
        <div class="provider-card-header">
          <div class="provider-card-title-group">
            <h4>${this._escape(p.name)}</h4>
            <span class="badge ${p.badgeType || 'paid'}">${this._escape(p.badge || 'Paid Key')}</span>
            ${hasKey ? '<span class="badge active-badge"><span class="status-indicator-dot online"></span> Key Configured</span>' : '<span class="badge" style="background:rgba(255,255,255,0.05); color:#888;"><span class="status-indicator-dot offline"></span> Key Needed</span>'}
          </div>
          <div class="provider-header-actions">
            ${!isPrimary ? `
              <button class="secondary-btn btn-make-primary-paid" data-id="${id}">Set as Active Provider</button>
            ` : `
              <span class="primary-badge">${icons.star} Active Provider</span>
            `}
          </div>
        </div>

        <p class="provider-card-desc">${this._escape(p.description)}</p>

        ${p.setupGuide ? `
          <div class="provider-guide-box">
            <div class="guide-title">${this._escape(p.setupGuide.title)}:</div>
            <ol class="guide-steps">
              ${p.setupGuide.steps.map(s => `<li>${this._linkify(this._escape(s))}</li>`).join('')}
            </ol>
            ${p.setupGuide.link ? `
              <a href="${p.setupGuide.link}" target="_blank" rel="noopener noreferrer" class="guide-link-btn">
                <span>Acquire Key from Console</span> ${icons.link}
              </a>
            ` : ''}
          </div>
        ` : ''}

        <div class="provider-form-grid">
          <div class="form-field">
            <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">API Key</label>
            <div class="input-password-wrapper">
              <input type="password" class="input-text provider-key-input" data-id="${id}" value="${this._escape(p.apiKey || '')}" placeholder="Paste API Key here..." />
              <button class="btn-toggle-eye" type="button" title="Show/Hide">${icons.eye}</button>
            </div>
          </div>

          <div class="form-field">
            <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">Model Selection</label>
            <select class="input-select provider-model-select" data-id="${id}" style="width: 100%; padding: 8px; background: #181818; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff;">
              ${(p.availableModels || []).map(m => `
                <option value="${m.id}" ${p.model === m.id ? 'selected' : ''}>
                  ${this._escape(m.name)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="provider-card-footer">
          <button class="secondary-btn btn-test-connection" data-id="${id}">
            ${icons.bolt} <span>Test Connection</span>
          </button>

          <div class="test-result-indicator" id="testResult_${id}">
            ${test ? (test.success 
              ? `<span class="test-badge success"><span class="status-indicator-dot online"></span> ${test.latency}ms · ${this._escape(test.reply || 'Connected')}</span>`
              : `<span class="test-badge error"><span class="status-indicator-dot offline"></span> ${this._escape(test.error || 'Failed')}</span>`
            ) : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tab 3: Project Settings
   */
  /**
   * Tab 3: Project Settings
   */
  _renderProjectTab() {
    if (!this.projects || this.projects.length === 0) {
      return `
        <div class="settings-section-card">
          <div class="section-card-title">Project Settings</div>
          <div class="section-card-desc">
            No projects found. Create a project first to configure project-specific workspace, custom prompts, and model routing.
          </div>
        </div>
      `;
    }

    const currentProj = this.projects.find(p => p.id === this.activeProjectId) || this.projects[0];
    this.activeProjectId = currentProj.id;
    currentProj.modelConfig = currentProj.modelConfig || { mode: 'inherit' };

    const projModelMode = currentProj.modelConfig.mode || 'inherit';
    const projEngineMode = currentProj.modelConfig.engineMode || 'paid';
    const projPaidMode = currentProj.modelConfig.paidMode || 'simple';
    const projActiveModel = currentProj.modelConfig.activeModelRef || this.settings.activeModelRef || 'anthropic/claude-3-7-sonnet-20250219';
    const projThinkingModel = currentProj.modelConfig.thinkingModelRef || 'deepseek/deepseek-reasoner';
    const projFallbackModel = currentProj.modelConfig.fallbackModelRef || 'anthropic/claude-3-5-haiku-20241022';

    const globalDefaultDesc = this.settings.engineMode === 'free_pool'
      ? 'Free AI Pool (Auto-Cascade across 19 providers via FCC)'
      : `Paid Frontier Engine (${this.settings.activeModelRef || 'Claude 3.7 Sonnet'})`;

    return `
      <!-- Project Selection Visual Gallery Deck -->
      <div class="settings-section-card project-selection-deck-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <div class="section-card-title">Project Selection Deck</div>
            <div class="section-card-desc">Click any project to inspect its workspace, shared architecture memory, and model routing:</div>
          </div>
          <button class="primary-button btn-deck-create-project" type="button" style="height: 30px; font-size: 12px; padding: 0 12px;">
            ${icons.plus} New Project
          </button>
        </div>

        <div class="project-deck-grid">
          ${this.projects.map(p => {
            const isSelected = p.id === currentProj.id;
            const chatCount = (this.sessions || []).filter(s => s.projectId === p.id).length;
            const engineLabel = p.modelConfig?.mode === 'custom'
              ? (p.modelConfig.engineMode === 'free_pool' ? 'Free Pool' : 'Paid Frontier')
              : 'Inherit Default';
            return `
              <div class="project-card-tile ${isSelected ? 'is-selected' : ''}" data-project-id="${p.id}">
                <div class="project-tile-top">
                  <div class="project-tile-badges">
                    <span class="project-tile-status-tag ${isSelected ? 'tag-selected' : ''}">
                      ${isSelected ? 'Active Selection' : 'Workspace'}
                    </span>
                    <span class="project-tile-engine-badge">${engineLabel}</span>
                  </div>
                  <h4 class="project-tile-title">${this._escape(p.name)}</h4>
                  <div class="project-tile-folder" title="${this._escape(p.folderPath || 'Pure Chat')}">
                    ${icons.folder}
                    <span>${this._escape(p.folderName || (p.folderPath ? p.folderPath.split('/').pop() : 'Pure Chat'))}</span>
                  </div>
                </div>
                <div class="project-tile-bottom">
                  <span class="project-tile-chats">${chatCount} ${chatCount === 1 ? 'chat' : 'chats'}</span>
                  <span class="project-tile-action-btn ${isSelected ? 'btn-active' : ''}">
                    ${isSelected ? 'Selected' : 'Select'}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Project Name & Mandatory Folder -->
      <div class="settings-section-card">
        <div class="section-card-title">Project Name & Workspace Directory</div>
        <div class="section-card-desc">Every project is tied to a local codebase or directory where chats, versioned changelogs, and shared memory are stored.</div>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">
          <div>
            <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">Project Name</label>
            <input type="text" class="input-text" id="projectSettingsName" value="${this._escape(currentProj.name || '')}" placeholder="Project Name" style="width: 100%;" />
          </div>

          <div>
            <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">Linked Directory (Mandatory)</label>
            <div class="workspace-picker-row" style="display: flex; gap: 8px;">
              <input type="text" class="input-text" id="projectSettingsFolderInput" value="${this._escape(currentProj.folderPath || '')}" placeholder="Select project directory..." readonly style="flex: 1;" />
              <button class="secondary-btn btn-browse-project-folder">${icons.folder} Browse...</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Project Shared Architecture Memory (.eyqa/memory.json) -->
      <div class="settings-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div class="section-card-title" style="display: flex; align-items: center; gap: 8px;">${icons.brain} <span>Shared Project Memory (.eyqa/memory.json)</span></div>
          <span class="badge" style="background: rgba(59,130,246,0.15); color: #60a5fa;">Active Across All Chats</span>
        </div>
        <div class="section-card-desc">
          Architecture overview, stack summary, key conventions, and repo rules. Automatically injected into Eyqa's system prompt context for every chat thread in this project.
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
          <div>
            <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">Architecture & Stack Overview</label>
            <input type="text" class="input-text" id="projectMemoryArchitecture" value="${this._escape(this.currentProjectMemory?.architecture || '')}" placeholder="e.g. Electron + Vanilla ES Modules + SQLite Session Store" style="width: 100%;" />
          </div>
          <div>
            <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">Shared Memory Notes & Key Guidelines</label>
            <textarea class="input-text" id="projectMemoryNotes" rows="4" placeholder="e.g. Pure obsidian dark theme, strict 32px height buttons, no programmatic spinners, always test via Electron test harness." style="width: 100%;">${this._escape(this.currentProjectMemory?.notes || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- Project Versioned Changelog (.eyqa/changelog.json) -->
      <div class="settings-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div class="section-card-title" style="display: flex; align-items: center; gap: 8px;">${icons.history} <span>Project Changelog & Snapshots (.eyqa/changelog.json)</span></div>
          <span class="badge" style="background: rgba(255,255,255,0.08); color: #aaa;">
            ${(this.currentProjectChangelog || []).length} Recorded Changes
          </span>
        </div>
        <div class="section-card-desc">
          Automated versioned history of all file changes and agent edits made in this project with timestamps and diff tracking.
        </div>
        <div class="project-changelog-list" style="margin-top: 12px; max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${(this.currentProjectChangelog && this.currentProjectChangelog.length > 0) ? this.currentProjectChangelog.map(entry => `
            <div class="changelog-entry-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #141414; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="badge ${entry.action === 'create' ? 'success' : 'ready'}" style="font-size: 10px; text-transform: uppercase;">
                  ${this._escape(entry.action || 'edit')}
                </span>
                <span style="font-family: monospace; font-size: 12px; color: #fff;">${this._escape(entry.file)}</span>
                <span style="font-size: 11.5px; color: #888;">${this._escape(entry.summary || '')}</span>
              </div>
              <span style="font-size: 11px; color: #555;">${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          `).join('') : `
            <div style="padding: 16px; text-align: center; color: #666; font-size: 12px; background: #141414; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.06);">
              No changes recorded in changelog yet. Edits made by Eyqa will automatically populate here.
            </div>
          `}
        </div>
      </div>

      <!-- Project Model Hierarchy (Inherit vs Custom Override) -->
      <div class="settings-section-card">
        <div class="section-card-title">Model & AI Engine Routing</div>
        <div class="section-card-desc">
          Configure whether this project inherits your general settings default or uses dedicated custom models:
        </div>

        <div class="project-mode-selection" style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;">
          <!-- Inherit Global Default Radio Card -->
          <label class="project-mode-radio-card ${projModelMode === 'inherit' ? 'selected' : ''}" style="display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: #141414; border: 1px solid ${projModelMode === 'inherit' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; cursor: pointer;">
            <input type="radio" name="projModelMode" value="inherit" ${projModelMode === 'inherit' ? 'checked' : ''} style="margin-top: 3px;" />
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 13.5px; color: #fff;">Inherit Global Default (Recommended)</strong>
                <span class="badge" style="background: rgba(255,255,255,0.1); color: #aaa;">Default</span>
              </div>
              <p style="margin: 4px 0 0; font-size: 12px; color: #888;">
                Currently using: <span style="color: #60a5fa; font-weight: 500;">${this._escape(globalDefaultDesc)}</span>
              </p>
            </div>
          </label>

          <!-- Custom Project Override Radio Card -->
          <label class="project-mode-radio-card ${projModelMode === 'custom' ? 'selected' : ''}" style="display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: #141414; border: 1px solid ${projModelMode === 'custom' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; cursor: pointer;">
            <input type="radio" name="projModelMode" value="custom" ${projModelMode === 'custom' ? 'checked' : ''} style="margin-top: 3px;" />
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 13.5px; color: #fff;">Custom Project Override</strong>
                <span class="badge" style="background: rgba(59,130,246,0.15); color: #60a5fa;">Project-Specific</span>
              </div>
              <p style="margin: 4px 0 0; font-size: 12px; color: #888;">
                Override AI engine and specify unique models dedicated strictly to this project.
              </p>
            </div>
          </label>
        </div>

        ${projModelMode === 'custom' ? `
          <!-- Custom Engine Controls for this Project -->
          <div class="project-custom-engine-box" style="margin-top: 16px; padding: 14px; background: #161616; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 12.5px; font-weight: 600; color: #ccc;">Select Engine for this Project:</span>
              <div style="display: flex; gap: 6px; background: #111; padding: 3px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
                <button class="secondary-btn btn-proj-engine ${projEngineMode === 'free_pool' ? 'active-primary' : ''}" data-engine="free_pool" style="height: 26px; font-size: 11px;">
                  Free AI Pool
                </button>
                <button class="secondary-btn btn-proj-engine ${projEngineMode === 'paid' ? 'active-primary' : ''}" data-engine="paid" style="height: 26px; font-size: 11px;">
                  Paid Frontier
                </button>
              </div>
            </div>

            ${projEngineMode === 'free_pool' ? `
              <div style="font-size: 12px; color: #888; line-height: 1.5; padding: 10px; background: #1a1a1a; border-radius: 6px;">
                <strong style="color: #34d399;">Free AI Pool Enabled</strong>: Automatically cascades across all configured free providers (Groq, Gemini, OpenRouter, Cerebras, NVIDIA NIM) with automatic rate limit failover via Free Claude Code.
              </div>
            ` : `
              <div style="margin-top: 8px;">
                <!-- Simple vs Advanced Submode for this Project -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span style="font-size: 12px; color: #888;">Configuration Type:</span>
                  <div style="display: flex; gap: 6px;">
                    <button class="secondary-btn btn-proj-paid-submode ${projPaidMode === 'simple' ? 'active-primary' : ''}" data-submode="simple" style="height: 24px; font-size: 11px;">
                      Simple
                    </button>
                    <button class="secondary-btn btn-proj-paid-submode ${projPaidMode === 'advanced' ? 'active-primary' : ''}" data-submode="advanced" style="height: 24px; font-size: 11px;">
                      Advanced (Multi-Role)
                    </button>
                  </div>
                </div>

                ${projPaidMode === 'simple' ? `
                  <div class="form-field">
                    <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">Primary Model</label>
                    <select class="input-select input-proj-model" data-role="activeModelRef" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff;">
                      ${PAID_MODEL_CATALOG.map(m => `
                        <option value="${m.slug}" ${projActiveModel === m.slug ? 'selected' : ''}>
                          ${this._escape(m.name)} • ${m.slug} (${m.context})
                        </option>
                      `).join('')}
                    </select>
                  </div>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div class="form-field">
                      <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">1. Primary Chat & Coding Model</label>
                      <select class="input-select input-proj-model" data-role="activeModelRef" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff;">
                        ${PAID_MODEL_CATALOG.map(m => `
                          <option value="${m.slug}" ${projActiveModel === m.slug ? 'selected' : ''}>
                            ${this._escape(m.name)} • ${m.slug}
                          </option>
                        `).join('')}
                      </select>
                    </div>

                    <div class="form-field">
                      <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">2. Deep Thinking & Reasoning Model</label>
                      <select class="input-select input-proj-model" data-role="thinkingModelRef" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff;">
                        ${PAID_MODEL_CATALOG.map(m => `
                          <option value="${m.slug}" ${projThinkingModel === m.slug ? 'selected' : ''}>
                            ${this._escape(m.name)} • ${m.slug}
                          </option>
                        `).join('')}
                      </select>
                    </div>

                    <div class="form-field">
                      <label style="font-size: 11.5px; font-weight: 600; color: #888; display: block; margin-bottom: 4px;">3. Fast Fallback & Auxiliary Model</label>
                      <select class="input-select input-proj-model" data-role="fallbackModelRef" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff;">
                        ${PAID_MODEL_CATALOG.map(m => `
                          <option value="${m.slug}" ${projFallbackModel === m.slug ? 'selected' : ''}>
                            ${this._escape(m.name)} • ${m.slug}
                          </option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                `}
              </div>
            `}
          </div>
        ` : ''}
      </div>

      <!-- Project System Instructions -->
      <div class="settings-section-card">
        <div class="section-card-title">Project System Instructions</div>
        <div class="section-card-desc">Specify coding standards, tone, architectural patterns, or repo-specific rules.</div>
        <textarea class="input-text" id="projectSettingsPrompt" rows="4" placeholder="e.g. Use strict TypeScript, write atomic functions, and format with 2-space indentation." style="margin-top: 8px; width: 100%;">${this._escape(currentProj.customPrompt || '')}</textarea>
      </div>

      <!-- Project Actions -->
      <div class="settings-section-card" style="display: flex; justify-content: space-between; align-items: center; border-color: rgba(255,255,255,0.06);">
        <button class="secondary-btn btn-delete-current-project" style="color: #ef4444; border-color: rgba(239,68,68,0.2);">
          ${icons.trash} Delete Project
        </button>
        <button class="primary-btn btn-save-project-settings">
          ${icons.check} Save Project Settings
        </button>
      </div>
    `;
  }

  /**
   * Tab: Universal Dynamic Memory
   */
  /**
   * Tab: User Profile Memory (you.me)
   */
  _renderMemoryTab() {
    const data = this.youMe || { name: '', background: '', likes: [], notes: [], raw: '' };
    const likesText = (data.likes || []).join('\n');
    const notesText = (data.notes || []).join('\n');

    return `
      <!-- you.me Header Card -->
      <div class="settings-section-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
          <div>
            <div class="section-card-title" style="display: flex; align-items: center; gap: 8px;">
              <span>User Profile & Personal Preferences</span>
              <span style="font-size: 11px; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 8px; font-weight: normal; color: var(--text-secondary); font-family: var(--font-mono);">~/.config/eyqa/you.me</span>
            </div>
            <div class="section-card-desc" style="margin-top: 4px;">
              Stores strictly who you are (name, background, what you like, and preferences). Eyqa remembers this across all chats. Workspace architecture and coding conventions are stored per project in Project Settings.
            </div>
          </div>
          <button id="btnToggleYouMeMode" class="secondary-btn" style="padding: 6px 14px; font-size: 12px; white-space: nowrap;">
            Raw Markdown Editor
          </button>
        </div>
      </div>

      <!-- Structured Form View -->
      <div id="youMeFormView" class="settings-section-card">
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="font-size: 12px; font-weight: 500; color: #fff; display: block; margin-bottom: 6px;">Your Name</label>
              <input type="text" id="youMeNameInput" class="input-text" placeholder="e.g. Hassan" value="${this._escape(data.name || '')}" style="width: 100%;" />
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">How Eyqa should address you.</div>
            </div>
            <div>
              <label style="font-size: 12px; font-weight: 500; color: #fff; display: block; margin-bottom: 6px;">Background / Role</label>
              <input type="text" id="youMeBgInput" class="input-text" placeholder="e.g. Full-Stack Engineer & AI Researcher" value="${this._escape(data.background || '')}" style="width: 100%;" />
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Your profession, skills, or experience level.</div>
            </div>
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 500; color: #fff; display: block; margin-bottom: 6px;">What You Like & Personal Preferences</label>
            <textarea id="youMeLikesInput" class="input-text" rows="5" placeholder="e.g. Prefers direct answers without conversational filler&#10;Likes TypeScript, Rust, and Go&#10;Prefers surgical diffs over full rewrites" style="width: 100%; resize: vertical; line-height: 1.5;">${this._escape(likesText)}</textarea>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">One preference per line. Eyqa automatically respects these across your conversations.</div>
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 500; color: #fff; display: block; margin-bottom: 6px;">Personal Notes & Extra Context</label>
            <textarea id="youMeNotesInput" class="input-text" rows="3" placeholder="Any personal notes or additional facts about you..." style="width: 100%; resize: vertical; line-height: 1.5;">${this._escape(notesText)}</textarea>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Extra personal context preserved in you.me.</div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button id="btnSaveYouMeForm" class="primary-btn" style="padding: 8px 24px; font-size: 12.5px;">Save Profile to you.me</button>
          </div>
        </div>
      </div>

      <!-- Raw Markdown Editor View (Hidden by default) -->
      <div id="youMeRawView" class="settings-section-card" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 12px; color: var(--text-secondary);">Directly edit <code>you.me</code> markdown file:</div>
        </div>
        <textarea id="youMeRawTextarea" class="input-text" rows="14" style="width: 100%; font-family: var(--font-mono); font-size: 12.5px; resize: vertical; line-height: 1.5;">${this._escape(data.raw || '')}</textarea>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px;">
          <button id="btnSaveYouMeRaw" class="primary-btn" style="padding: 8px 24px; font-size: 12.5px;">Save you.me</button>
        </div>
      </div>
    `;
  }

  /**
   * Tab: AI Skills Hub
   */
  _renderSkillsTab() {
    const skills = this.installedSkills || [];

    return `
      <!-- Installed Skills -->
      <div class="settings-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="section-card-title">Installed AI Skills</div>
            <div class="section-card-desc">Domain-specific workflows following the standard SKILL.md specification.</div>
          </div>
          <span style="font-size: 12px; color: var(--text-secondary); background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 12px;">${skills.length} Available</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 14px;">
          ${skills.map(s => {
            const isBuiltin = Boolean(s.isBuiltin);
            return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong style="color: #fff; font-size: 14px;">${this._escape(s.name)}</strong>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    ${isBuiltin
                      ? `<span style="font-size: 10px; font-weight: 500; text-transform: uppercase; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 7px; border-radius: 8px;">Built-in</span>`
                      : `<span style="font-size: 10px; font-weight: 500; text-transform: uppercase; background: rgba(34, 197, 94, 0.12); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.25); padding: 2px 7px; border-radius: 8px;">Installed</span>`
                    }
                    <span style="font-size: 10px; text-transform: uppercase; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 6px; color: var(--text-secondary);">${this._escape(s.scope || 'global')}</span>
                  </div>
                </div>
                <p style="font-size: 12.5px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${this._escape(s.description)}</p>
              </div>

              ${!isBuiltin ? `
                <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                  <button type="button" class="btn-uninstall-skill" data-name="${this._escape(s.name)}" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); color: #f87171; border-radius: 6px; padding: 4px 10px; font-size: 11.5px; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s ease;">
                    ${icons.trash || '🗑️'} <span>Uninstall</span>
                  </button>
                </div>
              ` : ''}
            </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Skills Hub Online Registry Search -->
      <div class="settings-section-card">
        <div class="section-card-title">Explore Skills Hub (https://skills-hub.ai)</div>
        <div class="section-card-desc">Discover and install specialized AI skills for document generation, analysis, or devops.</div>

        <div style="display: flex; gap: 10px; margin-top: 14px;">
          <input type="text" class="input-text" id="skillsHubSearchInput" placeholder="Search skills (e.g. pdf, seo, git, sql, ui, latex)..." style="flex: 1;" />
          <button class="primary-btn btn-search-skills-hub" style="white-space: nowrap;">
            ${icons.globe} Search Hub
          </button>
        </div>

        <div id="skillsHubResultsContainer" style="margin-top: 16px;"></div>
      </div>
    `;
  }

  /**
   * Tab 4: General Preferences
   */
  _renderGeneralTab() {
    return `
      <div class="settings-section-card">
        <div class="section-card-title">Appearance & Color Theme</div>
        <div class="appearance-options" style="display: flex; gap: 20px; margin-top: 12px;">
          <label class="radio-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="eyqaTheme" value="dark" ${this.settings.appearance?.theme === 'dark' ? 'checked' : ''} />
            <span>Onyx Dark (Obsidian)</span>
          </label>
          <label class="radio-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="eyqaTheme" value="midnight" ${this.settings.appearance?.theme === 'midnight' ? 'checked' : ''} />
            <span>Midnight Blue</span>
          </label>
          <label class="radio-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="eyqaTheme" value="light" ${this.settings.appearance?.theme === 'light' ? 'checked' : ''} />
            <span>Clean Light</span>
          </label>
        </div>
      </div>

      <div class="settings-section-card">
        <div class="section-card-title">Web Search Grounding</div>
        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; margin-top: 10px; cursor: pointer;">
          <input type="checkbox" id="settingsAutoWeb" ${this.settings.autoWebSearch ? 'checked' : ''} />
          <span>Allow Eyqa to automatically invoke DuckDuckGo web search when real-time information or verification is required</span>
        </label>
      </div>

      <div class="settings-section-card">
        <div class="section-card-title" style="display:flex; justify-content:space-between; align-items:center;">
          <span>Image Generation Engine</span>
          <span style="font-size:11px; padding:2px 8px; border-radius:12px; background:rgba(16,185,129,0.15); color:#10b981;">Free Pollinations Flux Included</span>
        </div>
        <div style="font-size:12px; color:var(--text-sec); margin-top:4px;">
          Configure visual mockup and art generation for Eyqa. Free mode generates studio-grade Flux/SDXL images with zero API key.
        </div>
        
        <div style="margin-top:14px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:6px;">Generation Provider</label>
            <select id="settingsImageProvider" class="form-input" style="width:100%; padding:8px 12px; background:var(--bg-main); border:1px solid var(--border); border-radius:6px; color:var(--text-main);">
              <option value="pollinations" ${(this.settings.imageGeneration?.provider || 'pollinations') === 'pollinations' ? 'selected' : ''}>Pollinations.ai (Flux - 100% Free, Zero Key)</option>
              <option value="openai" ${(this.settings.imageGeneration?.provider || '') === 'openai' ? 'selected' : ''}>OpenAI DALL-E 3 (Paid Key)</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:600; margin-bottom:6px;">Default Image Size</label>
            <select id="settingsImageSize" class="form-input" style="width:100%; padding:8px 12px; background:var(--bg-main); border:1px solid var(--border); border-radius:6px; color:var(--text-main);">
              <option value="1024x1024" ${(this.settings.imageGeneration?.size || '1024x1024') === '1024x1024' ? 'selected' : ''}>Square (1024 x 1024)</option>
              <option value="1792x1024" ${(this.settings.imageGeneration?.size || '') === '1792x1024' ? 'selected' : ''}>Landscape (1792 x 1024)</option>
              <option value="1024x1792" ${(this.settings.imageGeneration?.size || '') === '1024x1792' ? 'selected' : ''}>Portrait (1024 x 1792)</option>
            </select>
          </div>
        </div>

        <div id="openaiImageKeyContainer" style="margin-top:12px; ${(this.settings.imageGeneration?.provider || 'pollinations') === 'openai' ? '' : 'display:none;'}">
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:6px;">OpenAI API Key (for DALL-E 3)</label>
          <input type="password" id="settingsImageOpenAIKey" placeholder="sk-proj-..." value="${this._escape(this.settings.imageGeneration?.apiKey || '')}" style="width:100%; padding:8px 12px; background:var(--bg-main); border:1px solid var(--border); border-radius:6px; color:var(--text-main); font-family:var(--font-mono); font-size:12px;" />
        </div>

        <label class="checkbox-label" style="display: flex; align-items: center; gap: 10px; margin-top: 14px; cursor: pointer;">
          <input type="checkbox" id="settingsImageFallback" ${this.settings.imageGeneration?.fallbackToFree !== false ? 'checked' : ''} />
          <span>Graceful Fallback: Auto-fallback to Free Pollinations Flux if paid key fails or exhausts quota</span>
        </label>
      </div>

      <div class="settings-section-card">
        <div class="section-card-title">Keyboard Shortcuts</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; font-size: 13px;">
          <div><kbd style="padding: 2px 6px; background: #222; border-radius: 4px; border: 1px solid #333;">Ctrl+N</kbd> : New Chat Thread</div>
          <div><kbd style="padding: 2px 6px; background: #222; border-radius: 4px; border: 1px solid #333;">Ctrl+,</kbd> : Open Settings</div>
          <div><kbd style="padding: 2px 6px; background: #222; border-radius: 4px; border: 1px solid #333;">Esc</kbd> : Close Settings / Drawer</div>
          <div><kbd style="padding: 2px 6px; background: #222; border-radius: 4px; border: 1px solid #333;">Enter</kbd> : Send Message</div>
          <div><kbd style="padding: 2px 6px; background: #222; border-radius: 4px; border: 1px solid #333;">Shift+Enter</kbd> : New Line</div>
          <div><kbd style="padding: 2px 6px; background: #222; border-radius: 4px; border: 1px solid #333;">Ctrl+B</kbd> : Toggle Sidebar</div>
        </div>
      </div>
    `;
  }

  _attachEvents() {
    // Back button and Cancel button
    this.container.querySelector('#btnSettingsBack')?.addEventListener('click', () => this.close());
    this.container.querySelector('.btn-settings-cancel')?.addEventListener('click', () => this.close());

    // Save All button
    this.container.querySelector('.btn-save-settings')?.addEventListener('click', async () => {
      await this._saveAll();
      this.close();
      if (this.onNotification) this.onNotification('Settings saved successfully.', 'success');
    });

    // Rail Navigation Items
    this.container.querySelectorAll('.settings-rail-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.currentTarget.dataset.tab;
        this.render();
      });
    });

    // --- Free Pool Tab Events ---
    this.container.querySelector('.btn-activate-free-pool')?.addEventListener('click', async () => {
      this.settings.engineMode = 'free_pool';
      await api.saveSettings({ engineMode: 'free_pool' });
      if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
      this.render();
      if (this.onNotification) this.onNotification('Free AI Pool (Auto-Cascade) activated as Primary Engine.', 'success');
    });

    this.container.querySelector('.btn-switch-to-paid-tab')?.addEventListener('click', () => {
      this.activeTab = 'paid';
      this.render();
    });

    const freeSearch = this.container.querySelector('#freeProviderSearchInput');
    if (freeSearch) {
      freeSearch.addEventListener('input', (e) => {
        this.filterFreeProviderQuery = e.target.value;
        const list = this.container.querySelector('.settings-provider-list');
        if (list) {
          const q = this.filterFreeProviderQuery.toLowerCase();
          const priority = this.settings.freePoolPriority || FCC_FREE_PROVIDERS;
          const matched = priority.filter(id => {
            const p = this.settings.providers[id];
            if (!p) return false;
            return !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || id.includes(q);
          });
          list.innerHTML = matched.map(id => this._renderFreeProviderCard(id)).join('');
          this._attachProviderCardEvents();
        }
      });
    }

    // Restart Embedded FCC Background Service
    this.container.querySelector('.btn-restart-fcc')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('.btn-restart-fcc');
      if (btn) btn.innerHTML = `${icons.rotateCcw} <span>Restarting service...</span>`;
      await api.restartFCCService();
      try {
        this.fccStatus = await api.getFCCStatus();
      } catch (_) {}
      this.render();
      if (this.onNotification) this.onNotification('Embedded FCC background service restarted on port 8082.', 'success');
    });

    // Toggle Embedded FCC Logs
    this.container.querySelector('.btn-toggle-fcc-logs')?.addEventListener('click', async () => {
      this.showFccLogs = !this.showFccLogs;
      if (this.showFccLogs) {
        this.fccLogs = await api.getFCCLogs();
      }
      this.render();
    });

    // --- Paid Tab Events ---
    this.container.querySelector('.btn-activate-paid-engine')?.addEventListener('click', async () => {
      this.settings.engineMode = 'paid';
      await api.saveSettings({ engineMode: 'paid' });
      if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
      this.render();
      if (this.onNotification) this.onNotification('Paid Frontier Model Engine activated.', 'success');
    });

    this.container.querySelector('.btn-switch-to-free-tab')?.addEventListener('click', () => {
      this.activeTab = 'free';
      this.render();
    });

    // Select Paid Model Cards
    this.container.querySelectorAll('.paid-model-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        const slug = card.dataset.slug;
        const providerId = card.dataset.provider;
        const modelId = card.dataset.model;

        this.settings.activeModelRef = slug;
        this.settings.activeProviderId = providerId;
        this.settings.engineMode = 'paid';
        if (this.settings.providers[providerId]) {
          this.settings.providers[providerId].model = modelId;
          this.settings.providers[providerId].enabled = true;
        }

        await api.saveSettings({
          activeModelRef: slug,
          activeProviderId: providerId,
          engineMode: 'paid',
          providers: this.settings.providers
        });

        if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
        this.render();
        if (this.onNotification) this.onNotification(`Active model set to ${slug}.`, 'success');
      });
    });

    // Reasoning Effort Buttons
    this.container.querySelectorAll('.reasoning-option-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const effort = e.currentTarget.dataset.effort;
        this.settings.reasoningEffort = effort;
        await api.saveSettings({ reasoningEffort: effort });
        if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
        this.render();
        if (this.onNotification) this.onNotification(`Reasoning effort set to ${effort}.`, 'info');
      });
    });

    // Paid Submode Toggle (Simple vs Advanced)
    this.container.querySelectorAll('.btn-paid-submode').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const submode = e.currentTarget.dataset.submode;
        this.paidMode = submode;
        this.settings.paidMode = submode;
        await api.saveSettings({ paidMode: submode });
        this.render();
      });
    });

    // Advanced Multi-Model Role Selectors (Paid Tab)
    this.container.querySelectorAll('.input-advanced-model').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const role = e.currentTarget.dataset.role;
        this.settings[role] = e.currentTarget.value;
        await api.saveSettings({ [role]: e.currentTarget.value });
        if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
      });
    });

    // Make Paid Provider Primary
    this.container.querySelectorAll('.btn-make-primary-paid').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        this.settings.activeProviderId = id;
        this.settings.engineMode = 'paid';
        const p = this.settings.providers[id];
        if (p) {
          this.settings.activeModelRef = `${id}/${p.model}`;
        }
        await api.saveSettings({
          activeProviderId: id,
          activeModelRef: this.settings.activeModelRef,
          engineMode: 'paid'
        });
        if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
        this.render();
        if (this.onNotification) this.onNotification(`Primary paid provider set to ${id}.`, 'success');
      });
    });

    this._attachProviderCardEvents();

    // --- Project Tab Events ---
    this.container.querySelectorAll('.project-card-tile').forEach(tile => {
      tile.addEventListener('click', async () => {
        const projId = tile.dataset.projectId;
        if (projId && projId !== this.activeProjectId) {
          this.activeProjectId = projId;
          try {
            const [mem, chg] = await Promise.all([
              api.getProjectMemory(projId),
              api.getProjectChangelog(projId)
            ]);
            if (this.activeProjectId === projId) {
              this.currentProjectMemory = mem || { notes: '', architecture: '' };
              this.currentProjectChangelog = chg || [];
              this.render();
            }
          } catch (_) {
            if (this.activeProjectId === projId) {
              this.currentProjectMemory = { notes: '', architecture: '' };
              this.currentProjectChangelog = [];
              this.render();
            }
          }
        }
      });
    });

    this.container.querySelector('.btn-deck-create-project')?.addEventListener('click', () => {
      if (window.app && window.app.openNewProjectModal) {
        window.app.openNewProjectModal();
      } else {
        const modal = document.getElementById('newProjectModal');
        if (modal) modal.style.display = 'flex';
      }
    });

    const projNameInput = this.container.querySelector('#projectSettingsName');
    if (projNameInput) {
      projNameInput.addEventListener('input', (e) => {
        const currentProj = this.projects.find(p => p.id === this.activeProjectId);
        if (currentProj) currentProj.name = e.target.value;
      });
    }

    this.container.querySelector('.btn-browse-project-folder')?.addEventListener('click', async () => {
      const selected = await api.selectWorkspaceFolder();
      const folderPath = selected && typeof selected === 'object' ? selected.path : selected;
      const folderName = selected && typeof selected === 'object' ? selected.name : null;
      const currentProj = this.projects.find(p => p.id === this.activeProjectId);
      if (folderPath && currentProj) {
        currentProj.folderPath = folderPath;
        currentProj.folderName = folderName;
        this.render();
      }
    });

    this.container.querySelector('.btn-unlink-project-folder')?.addEventListener('click', () => {
      const currentProj = this.projects.find(p => p.id === this.activeProjectId);
      if (currentProj) {
        currentProj.folderPath = null;
        currentProj.folderName = null;
        this.render();
      }
    });

    this.container.querySelectorAll('input[name="projModelMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const currentProj = this.projects.find(p => p.id === this.activeProjectId);
        if (currentProj) {
          if (!currentProj.modelConfig) currentProj.modelConfig = {};
          currentProj.modelConfig.mode = e.target.value;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.btn-proj-engine').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const currentProj = this.projects.find(p => p.id === this.activeProjectId);
        if (currentProj) {
          if (!currentProj.modelConfig) currentProj.modelConfig = {};
          currentProj.modelConfig.engineMode = e.currentTarget.dataset.engine;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.btn-proj-paid-submode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const currentProj = this.projects.find(p => p.id === this.activeProjectId);
        if (currentProj) {
          if (!currentProj.modelConfig) currentProj.modelConfig = {};
          currentProj.modelConfig.paidMode = e.currentTarget.dataset.submode;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.input-proj-model').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const currentProj = this.projects.find(p => p.id === this.activeProjectId);
        if (currentProj) {
          if (!currentProj.modelConfig) currentProj.modelConfig = {};
          currentProj.modelConfig[e.currentTarget.dataset.role] = e.currentTarget.value;
        }
      });
    });

    const projPromptInput = this.container.querySelector('#projectSettingsPrompt');
    if (projPromptInput) {
      projPromptInput.addEventListener('input', (e) => {
        const currentProj = this.projects.find(p => p.id === this.activeProjectId);
        if (currentProj) currentProj.customPrompt = e.target.value;
      });
    }

    this.container.querySelector('.btn-save-project-settings')?.addEventListener('click', async () => {
      await this._saveProjectSettings(this.activeProjectId);
    });

    this.container.querySelector('.btn-delete-current-project')?.addEventListener('click', async () => {
      const currentProj = this.projects.find(p => p.id === this.activeProjectId);
      if (!currentProj) return;
      if (confirm(`Delete project "${currentProj.name}" and all its chats?`)) {
        await api.deleteProject(currentProj.id);
        this.projects = await api.listProjects();
        this.activeProjectId = this.projects.length > 0 ? this.projects[0].id : null;
        if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
        if (this.onNotification) this.onNotification(`Project "${currentProj.name}" deleted.`, 'info');
        this.render();
      }
    });

    // --- User Profile (you.me) Tab Events ---
    // 1. Toggle between Form View and Raw Markdown View
    this.container.querySelector('#btnToggleYouMeMode')?.addEventListener('click', (e) => {
      const formView = this.container.querySelector('#youMeFormView');
      const rawView = this.container.querySelector('#youMeRawView');
      if (!formView || !rawView) return;

      const isRawVisible = rawView.style.display !== 'none';
      if (isRawVisible) {
        rawView.style.display = 'none';
        formView.style.display = 'block';
        e.currentTarget.textContent = 'Raw Markdown Editor';
      } else {
        const name = this.container.querySelector('#youMeNameInput')?.value?.trim() || '';
        const bg = this.container.querySelector('#youMeBgInput')?.value?.trim() || '';
        const likes = (this.container.querySelector('#youMeLikesInput')?.value || '')
          .split('\n').map(l => l.trim()).filter(Boolean);
        const notes = (this.container.querySelector('#youMeNotesInput')?.value || '')
          .split('\n').map(l => l.trim()).filter(Boolean);

        let syncMarkdown = `# you.me - User Profile\n\nName: ${name}\nBackground: ${bg}\nLikes & Preferences:\n`;
        if (likes.length > 0) {
          syncMarkdown += likes.map(l => `- ${l.replace(/^-\s*/, '')}`).join('\n') + '\n';
        }
        syncMarkdown += '\nNotes:\n';
        if (notes.length > 0) {
          syncMarkdown += notes.map(n => `- ${n.replace(/^-\s*/, '')}`).join('\n') + '\n';
        }

        const rawTextarea = this.container.querySelector('#youMeRawTextarea');
        if (rawTextarea) rawTextarea.value = syncMarkdown;

        formView.style.display = 'none';
        rawView.style.display = 'block';
        e.currentTarget.textContent = 'Form Editor';
      }
    });

    // 2. Save Profile Form
    this.container.querySelector('#btnSaveYouMeForm')?.addEventListener('click', async () => {
      const name = this.container.querySelector('#youMeNameInput')?.value?.trim() || '';
      const background = this.container.querySelector('#youMeBgInput')?.value?.trim() || '';
      const likesRaw = this.container.querySelector('#youMeLikesInput')?.value || '';
      const notesRaw = this.container.querySelector('#youMeNotesInput')?.value || '';

      const likes = likesRaw.split('\n').map(l => l.trim()).filter(Boolean);
      const notes = notesRaw.split('\n').map(l => l.trim()).filter(Boolean);

      let markdown = `# you.me - User Profile\n\nName: ${name}\nBackground: ${background}\nLikes & Preferences:\n`;
      if (likes.length > 0) {
        markdown += likes.map(l => `- ${l.replace(/^-\s*/, '')}`).join('\n') + '\n';
      }
      markdown += '\nNotes:\n';
      if (notes.length > 0) {
        markdown += notes.map(n => `- ${n.replace(/^-\s*/, '')}`).join('\n') + '\n';
      }

      const res = await api.saveYouMeRaw(markdown);
      if (res && res.success) {
        this.youMe = await api.getYouMe();
        if (this.onNotification) this.onNotification('User profile saved to you.me!', 'success');
        this.render();
      } else {
        if (this.onNotification) this.onNotification(res?.error || 'Failed to save you.me.', 'error');
      }
    });

    // 3. Save Raw Markdown
    this.container.querySelector('#btnSaveYouMeRaw')?.addEventListener('click', async () => {
      const content = this.container.querySelector('#youMeRawTextarea')?.value;
      if (content === undefined) return;

      const res = await api.saveYouMeRaw(content);
      if (res && res.success) {
        this.youMe = await api.getYouMe();
        if (this.onNotification) this.onNotification('Saved you.me successfully!', 'success');
        this.render();
      } else {
        if (this.onNotification) this.onNotification(res?.error || 'Failed to save you.me.', 'error');
      }
    });

    // --- AI Skills Tab Events ---
    const searchHubBtn = this.container.querySelector('.btn-search-skills-hub');
    const searchHubInput = this.container.querySelector('#skillsHubSearchInput');
    const resultsContainer = this.container.querySelector('#skillsHubResultsContainer');

    const executeHubSearch = async () => {
      const query = searchHubInput?.value?.trim();
      if (!query) return;
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div style="color:var(--text-secondary);font-size:13px;padding:12px;">Searching Skills Hub for "${query}"...</div>`;
      }
      const res = await api.searchSkillsHub(query);
      if (!res || !res.success) {
        if (resultsContainer) resultsContainer.innerHTML = `<div style="color:#ef4444;font-size:13px;padding:12px;">Failed to query Skills Hub: ${res?.error || 'Unknown error'}</div>`;
        return;
      }

      const results = res.hubResults || [];
      if (results.length === 0) {
        if (resultsContainer) resultsContainer.innerHTML = `<div style="color:var(--text-secondary);font-size:13px;padding:12px;">No skills matching "${query}". You can create one custom in ~/.config/eyqa/skills/.</div>`;
        return;
      }

      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;">
            ${results.map(r => `
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:12px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="color:#fff;font-size:13.5px;">${r.name}</strong>
                    <span style="font-size:10.5px;color:var(--text-secondary);background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:6px;">skills-hub.ai</span>
                  </div>
                  <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.4;">${r.description}</p>
                </div>
                <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
                  <a href="${r.source}" target="_blank" style="font-size:11.5px;color:#3b82f6;text-decoration:none;">View Spec ↗</a>
                  <button class="primary-btn btn-install-hub-skill" data-name="${r.name}" style="padding:4px 10px;font-size:11.5px;">
                    Install Skill
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;

        resultsContainer.querySelectorAll('.btn-install-hub-skill').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const skillName = e.currentTarget.dataset.name;
            e.currentTarget.disabled = true;
            e.currentTarget.textContent = 'Installing...';
            const instRes = await api.installSkill({ skillName });
            if (instRes && instRes.success) {
              if (this.onNotification) this.onNotification(`Skill "${skillName}" installed!`, 'success');
              this.installedSkills = await api.listSkills(this.activeProjectId);
              this.render();
            } else {
              e.currentTarget.disabled = false;
              e.currentTarget.textContent = 'Retry Install';
            }
          });
        });
      }
    };

    searchHubBtn?.addEventListener('click', executeHubSearch);
    searchHubInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeHubSearch();
    });

    this.container.querySelectorAll('.btn-uninstall-skill').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const skillName = e.currentTarget.dataset.name;
        if (!skillName) return;
        btn.disabled = true;
        btn.innerHTML = `<span>Uninstalling...</span>`;

        try {
          const res = await api.uninstallSkill(skillName, this.activeProjectId);
          if (res && res.success) {
            if (this.onNotification) this.onNotification(`Skill "${skillName}" uninstalled successfully.`, 'success');
            this.installedSkills = await api.listSkills(this.activeProjectId);
            this.render();
          } else {
            btn.disabled = false;
            btn.innerHTML = `${icons.trash || '🗑️'} <span>Uninstall</span>`;
            if (this.onNotification) this.onNotification(res?.error || 'Failed to uninstall skill.', 'error');
          }
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = `${icons.trash || '🗑️'} <span>Uninstall</span>`;
          if (this.onNotification) this.onNotification(`Error: ${err.message}`, 'error');
        }
      });
    });

    // --- Preferences Tab Events ---
    this.container.querySelectorAll('input[name="eyqaTheme"]').forEach(r => {
      r.addEventListener('change', (e) => {
        if (!this.settings.appearance) this.settings.appearance = {};
        this.settings.appearance.theme = e.target.value;
        document.body.className = `theme-${e.target.value}`;
      });
    });

    const autoWeb = this.container.querySelector('#settingsAutoWeb');
    if (autoWeb) {
      autoWeb.addEventListener('change', (e) => {
        this.settings.autoWebSearch = e.target.checked;
      });
    }

    const imgProviderSelect = this.container.querySelector('#settingsImageProvider');
    if (imgProviderSelect) {
      imgProviderSelect.addEventListener('change', (e) => {
        const keyContainer = this.container.querySelector('#openaiImageKeyContainer');
        if (keyContainer) {
          keyContainer.style.display = e.target.value === 'openai' ? 'block' : 'none';
        }
      });
    }
  }

  _attachProviderCardEvents() {
    // Provider Key Inputs
    this.container.querySelectorAll('.provider-key-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (this.settings.providers[id]) {
          this.settings.providers[id].apiKey = e.target.value.trim();
        }
      });
    });

    // Provider Model Dropdown Selects (in Paid tab)
    this.container.querySelectorAll('.provider-model-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (this.settings.providers[id]) {
          this.settings.providers[id].model = e.target.value;
          if (this.settings.activeProviderId === id) {
            this.settings.activeModelRef = `${id}/${e.target.value}`;
          }
        }
      });
    });

    // Toggle Password Eye
    this.container.querySelectorAll('.btn-toggle-eye').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const input = e.currentTarget.previousElementSibling;
        if (input.type === 'password') {
          input.type = 'text';
          e.currentTarget.innerHTML = icons.eyeOff;
        } else {
          input.type = 'password';
          e.currentTarget.innerHTML = icons.eye;
        }
      });
    });

    // Toggle Embedded FCC Logs
    this.container.querySelector('.btn-toggle-fcc-logs')?.addEventListener('click', async () => {
      this.showFccLogs = !this.showFccLogs;
      if (this.showFccLogs) {
        this.fccLogs = await api.getFCCLogs();
      }
      this.render();
    });

    // Test Connection Button
    this.container.querySelectorAll('.btn-test-connection').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const resEl = this.container.querySelector(`#testResult_${id}`);
        if (resEl) resEl.innerHTML = '<span class="test-badge testing">Testing connection...</span>';

        const p = this.settings.providers[id];
        const keyInput = this.container.querySelector(`.provider-key-input[data-id="${id}"]`);
        if (keyInput) p.apiKey = keyInput.value.trim();

        try {
          const result = await api.testProvider(id, p);
          this.testResults[id] = result;
          this.render();
        } catch (err) {
          console.error('[SETTINGS] testProvider error:', err);
        }
      });
    });
  }

  async _saveAll() {
    // Read pending key inputs
    this.container.querySelectorAll('.provider-key-input').forEach(input => {
      const id = input.dataset.id;
      if (this.settings.providers[id]) {
        this.settings.providers[id].apiKey = input.value.trim();
      }
    });

    this.container.querySelectorAll('.provider-model-select').forEach(select => {
      const id = select.dataset.id;
      if (this.settings.providers[id]) {
        this.settings.providers[id].model = select.value;
      }
    });

    const projNameInput = this.container.querySelector('#projectSettingsName') || this.container.querySelector('#settingsProjectName');
    const projPromptInput = this.container.querySelector('#projectSettingsPrompt') || this.container.querySelector('#settingsProjectPrompt');

    if (this.activeProjectId && (projNameInput || projPromptInput)) {
      await this._saveProjectSettings(this.activeProjectId);
    }

    const imgProvider = this.container.querySelector('#settingsImageProvider')?.value || this.settings.imageGeneration?.provider || 'pollinations';
    const imgSize = this.container.querySelector('#settingsImageSize')?.value || this.settings.imageGeneration?.size || '1024x1024';
    const imgKey = this.container.querySelector('#settingsImageOpenAIKey')?.value?.trim() || this.settings.imageGeneration?.apiKey || '';
    const imgFallback = this.container.querySelector('#settingsImageFallback')
      ? this.container.querySelector('#settingsImageFallback').checked
      : (this.settings.imageGeneration?.fallbackToFree !== false);

    this.settings.imageGeneration = {
      provider: imgProvider,
      model: imgProvider === 'openai' ? 'dall-e-3' : 'flux',
      apiKey: imgKey,
      size: imgSize,
      quality: 'standard',
      fallbackToFree: imgFallback
    };

    await api.saveSettings(this.settings);
    if (this.onSettingsChanged) {
      this.onSettingsChanged(this.settings);
    }
  }

  async _saveProjectSettings(projId) {
    if (!projId) return;
    const currentProj = this.projects.find(p => p.id === projId);
    if (!currentProj) return;

    const nameInput = this.container.querySelector('#projectSettingsName');
    const promptInput = this.container.querySelector('#projectSettingsPrompt');

    const updates = {
      name: nameInput ? nameInput.value.trim() || currentProj.name : currentProj.name,
      customPrompt: promptInput ? promptInput.value : currentProj.customPrompt,
      folderPath: currentProj.folderPath || null,
      folderName: currentProj.folderName || null,
      modelConfig: currentProj.modelConfig || { mode: 'inherit' }
    };

    await api.updateProject(projId, updates);

    const memArch = this.container.querySelector('#projectMemoryArchitecture')?.value || '';
    const memNotes = this.container.querySelector('#projectMemoryNotes')?.value || '';
    try {
      await api.saveProjectMemory(projId, { architecture: memArch, notes: memNotes });
      this.currentProjectMemory = { architecture: memArch, notes: memNotes };
    } catch (_) {}

    this.projects = await api.listProjects();
    if (this.onSettingsChanged) this.onSettingsChanged(this.settings);
    if (this.onNotification) this.onNotification(`Project "${updates.name}" settings and memory saved.`, 'success');
    this.render();
  }

  _linkify(text) {
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

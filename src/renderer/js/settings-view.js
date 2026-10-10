/**
 * Eyqa Settings View
 * Clear, user-friendly onboarding for free AI tiers and paid providers.
 * Interactive latency testing, step-by-step guides, and automatic fallback order.
 */

import { icons } from './icons.js';
import { api } from './api.js';

export class SettingsView {
  constructor(modalEl, onNotification, onSettingsChanged) {
    this.modal = modalEl;
    this.onNotification = onNotification;
    this.onSettingsChanged = onSettingsChanged;
    this.settings = null;
    this.activeTab = 'free'; // 'free' | 'paid' | 'fallback' | 'general'
    this.testResults = {};
  }

  async open() {
    this.settings = await api.getSettings();
    this.modal.classList.add('open');
    this.render();
  }

  close() {
    this.modal.classList.remove('open');
  }

  render() {
    if (!this.settings) return;

    this.modal.innerHTML = `
      <div class="settings-modal-dialog">
        <div class="settings-header">
          <div class="settings-title-group">
            <span class="settings-logo-pill">${icons.sparkles}</span>
            <div>
              <h3>Settings & AI Engines</h3>
              <p>Configure free or paid AI models, web tools, and active workspace.</p>
            </div>
          </div>
          <button class="settings-close-btn" title="Close Settings">${icons.close}</button>
        </div>

        <div class="settings-nav-tabs">
          <button class="settings-nav-tab ${this.activeTab === 'free' ? 'active' : ''}" data-tab="free">
            ${icons.bolt} <span>Free AI Models (Zero Cost)</span>
          </button>
          <button class="settings-nav-tab ${this.activeTab === 'paid' ? 'active' : ''}" data-tab="paid">
            ${icons.briefcase} <span>Paid & Custom Keys</span>
          </button>
          <button class="settings-nav-tab ${this.activeTab === 'fallback' ? 'active' : ''}" data-tab="fallback">
            ${icons.sparkles} <span>Automatic Failover</span>
          </button>
          <button class="settings-nav-tab ${this.activeTab === 'general' ? 'active' : ''}" data-tab="general">
            ${icons.settings} <span>Preferences</span>
          </button>
        </div>

        <div class="settings-content-area">
          ${this._renderTabContent()}
        </div>

        <div class="settings-footer">
          <div class="settings-active-pill">
            <span>Active Model:</span>
            <strong>${this._escape(this.settings.providers[this.settings.activeProviderId]?.name || 'None')}</strong>
          </div>
          <button class="primary-button btn-save-settings">Save & Close</button>
        </div>
      </div>
    `;

    this._attachEvents();
  }

  _renderTabContent() {
    if (this.activeTab === 'free') {
      const freeProviders = ['gemini', 'groq', 'openrouter', 'nvidia_nim', 'ollama'];
      return `
        <div class="settings-provider-list">
          <div class="settings-banner">
            ${icons.bolt}
            <div>
              <strong>Multiple Free API Solutions</strong>
              <p>Eyqa connects directly to high-capacity free model tiers. Follow the 1-minute steps below to get your free keys.</p>
            </div>
          </div>
          ${freeProviders.map(id => this._renderProviderCard(id)).join('')}
        </div>
      `;
    }

    if (this.activeTab === 'paid') {
      const paidProviders = ['anthropic', 'openai', 'deepseek'];
      return `
        <div class="settings-provider-list">
          <div class="settings-banner">
            ${icons.briefcase}
            <div>
              <strong>Direct Paid Keys</strong>
              <p>Add your official Anthropic Claude, OpenAI, or DeepSeek keys for maximum intelligence.</p>
            </div>
          </div>
          ${paidProviders.map(id => this._renderProviderCard(id)).join('')}
        </div>
      `;
    }

    if (this.activeTab === 'fallback') {
      const order = this.settings.fallbackOrder || [];
      return `
        <div class="settings-fallback-view">
          <div class="settings-banner">
            ${icons.sparkles}
            <div>
              <strong>Outage & Rate-Limit Protection</strong>
              <p>When a provider hits a quota limit (429) or has an outage, Eyqa seamlessly switches to your next configured provider without interrupting your chat.</p>
            </div>
          </div>
          <div class="fallback-order-list">
            ${order.map((id, index) => {
              const p = this.settings.providers[id];
              if (!p) return '';
              const isPrimary = id === this.settings.activeProviderId;
              const hasKey = Boolean(p.apiKey && p.apiKey.trim()) || id === 'ollama';
              return `
                <div class="fallback-row ${isPrimary ? 'is-primary' : ''}">
                  <span class="fallback-rank">${index + 1}</span>
                  <div class="fallback-info">
                    <strong>${this._escape(p.name)}</strong>
                    <span class="fallback-meta">${this._escape(p.model)} · ${p.badge}</span>
                  </div>
                  <div class="fallback-status">
                    ${hasKey ? '<span class="status-badge ready">🟢 Ready</span>' : '<span class="status-badge empty">⚪ Needs Key</span>'}
                  </div>
                  ${!isPrimary ? `
                    <button class="secondary-btn btn-make-primary" data-id="${id}">Set as Primary</button>
                  ` : `
                    <span class="primary-badge">★ Primary Engine</span>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'general') {
      return `
        <div class="settings-general-view">
          <div class="settings-group">
            <h4>Active Workspace Folder</h4>
            <p>The local directory Eyqa has permission to inspect, read, and write files in.</p>
            <div class="workspace-picker-row">
              <input type="text" class="input-text" id="settingsWorkspaceInput" value="${this._escape(this.settings.workspacePath || '')}" readonly />
              <button class="secondary-btn btn-browse-workspace">${icons.folder} Browse...</button>
            </div>
          </div>

          <div class="settings-group">
            <h4>Appearance</h4>
            <div class="appearance-options">
              <label class="radio-label">
                <input type="radio" name="eyqaTheme" value="dark" ${this.settings.appearance?.theme === 'dark' ? 'checked' : ''} />
                <span>Onyx Dark</span>
              </label>
              <label class="radio-label">
                <input type="radio" name="eyqaTheme" value="midnight" ${this.settings.appearance?.theme === 'midnight' ? 'checked' : ''} />
                <span>Midnight Blue</span>
              </label>
              <label class="radio-label">
                <input type="radio" name="eyqaTheme" value="light" ${this.settings.appearance?.theme === 'light' ? 'checked' : ''} />
                <span>Clean Light</span>
              </label>
            </div>
          </div>

          <div class="settings-group">
            <h4>Web Search Grounding</h4>
            <label class="checkbox-label">
              <input type="checkbox" id="settingsAutoWeb" ${this.settings.autoWebSearch ? 'checked' : ''} />
              <span>Allow Eyqa to automatically use DuckDuckGo web search when real-time information is needed</span>
            </label>
          </div>
        </div>
      `;
    }
  }

  _renderProviderCard(id) {
    const p = this.settings.providers[id];
    if (!p) return '';

    const isPrimary = this.settings.activeProviderId === id;
    const test = this.testResults[id];

    return `
      <div class="provider-setup-card ${isPrimary ? 'primary-active' : ''}" data-id="${id}">
        <div class="provider-card-header">
          <div class="provider-card-title-group">
            <h4>${this._escape(p.name)}</h4>
            <span class="badge ${p.badgeType}">${this._escape(p.badge)}</span>
            ${isPrimary ? '<span class="badge active-badge">Active Engine</span>' : ''}
          </div>
          <div class="provider-header-actions">
            ${!isPrimary ? `
              <button class="btn-text btn-make-primary" data-id="${id}">Use this model</button>
            ` : ''}
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
                <span>Open ${this._escape(p.name)} Portal</span> ${icons.link}
              </a>
            ` : ''}
          </div>
        ` : ''}

        <div class="provider-form-grid">
          <div class="form-field">
            <label>API Key</label>
            <div class="input-password-wrapper">
              <input type="password" class="input-text provider-key-input" data-id="${id}" value="${this._escape(p.apiKey || '')}" placeholder="Paste API Key here..." />
              <button class="btn-toggle-eye" type="button" title="Show/Hide">👁️</button>
            </div>
          </div>

          <div class="form-field">
            <label>Model</label>
            <select class="input-select provider-model-select" data-id="${id}">
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
              ? `<span class="test-badge success">⚡ ${test.latency}ms · ${this._escape(test.reply || 'Connected')}</span>`
              : `<span class="test-badge error">❌ ${this._escape(test.error || 'Failed')}</span>`
            ) : ''}
          </div>
        </div>
      </div>
    `;
  }

  _attachEvents() {
    // Close button
    this.modal.querySelector('.settings-close-btn')?.addEventListener('click', () => this.close());
    this.modal.querySelector('.btn-save-settings')?.addEventListener('click', async () => {
      await this._saveAll();
      this.close();
      if (this.onNotification) this.onNotification('Settings saved successfully!', 'success');
    });

    // Tab buttons
    this.modal.querySelectorAll('.settings-nav-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.currentTarget.dataset.tab;
        this.render();
      });
    });

    // Toggle password eye
    this.modal.querySelectorAll('.btn-toggle-eye').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const input = e.currentTarget.previousElementSibling;
        if (input.type === 'password') {
          input.type = 'text';
          e.currentTarget.textContent = '🔒';
        } else {
          input.type = 'password';
          e.currentTarget.textContent = '👁️';
        }
      });
    });

    // Key changes
    this.modal.querySelectorAll('.provider-key-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (this.settings.providers[id]) {
          this.settings.providers[id].apiKey = e.target.value.trim();
        }
      });
    });

    // Model select changes
    this.modal.querySelectorAll('.provider-model-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (this.settings.providers[id]) {
          this.settings.providers[id].model = e.target.value;
        }
      });
    });

    // Make primary
    this.modal.querySelectorAll('.btn-make-primary').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.settings.activeProviderId = id;
        this.render();
      });
    });

    // Test connection
    this.modal.querySelectorAll('.btn-test-connection').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const resEl = this.modal.querySelector(`#testResult_${id}`);
        if (resEl) resEl.innerHTML = '<span class="test-badge testing">Testing connection...</span>';

        const p = this.settings.providers[id];
        // Read key directly from input in case not saved yet
        const keyInput = this.modal.querySelector(`.provider-key-input[data-id="${id}"]`);
        if (keyInput) p.apiKey = keyInput.value.trim();

        const result = await api.testProvider(id, p);
        this.testResults[id] = result;
        this.render();
      });
    });

    // Browse workspace
    this.modal.querySelector('.btn-browse-workspace')?.addEventListener('click', async () => {
      const selected = await api.selectWorkspaceFolder();
      if (selected) {
        this.settings.workspacePath = selected;
        const input = this.modal.querySelector('#settingsWorkspaceInput');
        if (input) input.value = selected;
      }
    });

    // Theme radio
    this.modal.querySelectorAll('input[name="eyqaTheme"]').forEach(r => {
      r.addEventListener('change', (e) => {
        if (!this.settings.appearance) this.settings.appearance = {};
        this.settings.appearance.theme = e.target.value;
        document.body.className = `theme-${e.target.value}`;
      });
    });

    // Auto web search checkbox
    const autoWeb = this.modal.querySelector('#settingsAutoWeb');
    if (autoWeb) {
      autoWeb.addEventListener('change', (e) => {
        this.settings.autoWebSearch = e.target.checked;
      });
    }
  }

  async _saveAll() {
    // Read any pending inputs
    this.modal.querySelectorAll('.provider-key-input').forEach(input => {
      const id = input.dataset.id;
      if (this.settings.providers[id]) {
        this.settings.providers[id].apiKey = input.value.trim();
      }
    });
    this.modal.querySelectorAll('.provider-model-select').forEach(select => {
      const id = select.dataset.id;
      if (this.settings.providers[id]) {
        this.settings.providers[id].model = select.value;
      }
    });

    await api.saveSettings(this.settings);
    if (this.onSettingsChanged) {
      this.onSettingsChanged(this.settings);
    }
  }

  _linkify(text) {
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

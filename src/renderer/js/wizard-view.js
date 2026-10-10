/**
 * Eyqa Setup Wizard View
 * Ultra-simple, high-speed onboarding experience ("Next Next Next") designed for everyday users.
 * Guides users through 100% free AI models, FCC proxy connection, paid keys, personas, and tools.
 */

import { icons } from './icons.js';
import { api } from './api.js';

export class WizardView {
  constructor(modalEl, onNotification, onWizardCompleted) {
    this.modal = modalEl;
    this.onNotification = onNotification;
    this.onWizardCompleted = onWizardCompleted;

    this.currentStep = 1; // 1 to 6
    this.totalSteps = 6;
    this.selectedPath = 'free'; // 'free' | 'fcc' | 'paid' | 'local'
    this.selectedFreeProvider = 'gemini'; // 'gemini' | 'groq' | 'nvidia_nim' | 'openrouter'
    this.selectedPersona = 'coworker';
    this.webGrounding = true;
    this.testState = { testing: false, success: null, latency: 0, error: null };
    this.settings = null;
  }

  async open() {
    this.settings = await api.getSettings();
    this.currentStep = 1;
    this.testState = { testing: false, success: null, latency: 0, error: null };
    this.modal.classList.add('open');
    this.render();
  }

  close() {
    this.modal.classList.remove('open');
  }

  render() {
    this.modal.innerHTML = `
      <div class="wizard-modal-dialog">
        <!-- Wizard Header Bar -->
        <div class="wizard-top-bar">
          <div class="wizard-brand-pill">
            <img src="assets/eyqa-logo.png" alt="Eyqa" class="wizard-logo-img" />
            <span class="wizard-brand-name">eyqa setup</span>
          </div>

          <!-- Step Progress Dots -->
          <div class="wizard-progress-dots">
            ${Array.from({ length: this.totalSteps }).map((_, idx) => {
              const stepNum = idx + 1;
              let dotClass = '';
              if (stepNum === this.currentStep) dotClass = 'active';
              else if (stepNum < this.currentStep) dotClass = 'completed';
              return `<span class="wizard-dot ${dotClass}" title="Step ${stepNum}"></span>`;
            }).join('')}
          </div>

          <button class="wizard-skip-btn" title="Skip Wizard and go to chat">Skip Setup</button>
        </div>

        <!-- Dynamic Step Content -->
        <div class="wizard-body">
          ${this._renderCurrentStep()}
        </div>

        <!-- Wizard Navigation Footer -->
        <div class="wizard-footer">
          <div class="wizard-footer-left">
            ${this.currentStep > 1 ? `
              <button class="wizard-btn-secondary btn-wizard-back">
                ${icons.arrowLeft || '←'} Back
              </button>
            ` : `<div></div>`}
          </div>

          <div class="wizard-footer-right">
            ${this.currentStep < this.totalSteps ? `
              <button class="primary-button btn-wizard-next">
                <span>Continue</span> ${icons.arrowRight || '→'}
              </button>
            ` : `
              <button class="primary-button btn-wizard-finish">
                <span>Start Chatting with Eyqa</span> ${icons.sparkles}
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    this._attachEvents();
  }

  _renderCurrentStep() {
    switch (this.currentStep) {
      case 1:
        return this._renderStep1Welcome();
      case 2:
        return this._renderStep2ChoosePath();
      case 3:
        return this._renderStep3ConfigureProvider();
      case 4:
        return this._renderStep4ChoosePersona();
      case 5:
        return this._renderStep5Superpowers();
      case 6:
        return this._renderStep6Ready();
      default:
        return '';
    }
  }

  // STEP 1: WELCOME
  _renderStep1Welcome() {
    return `
      <div class="wizard-step-container welcome-step">
        <div class="wizard-mascot-hero">
          <img src="assets/eyqa-logo.png" alt="Eyqa Coworker" class="wizard-hero-logo" />
        </div>
        <h2 class="wizard-title">Meet Eyqa, Your AI Coworker</h2>
        <p class="wizard-subtitle">
          Designed for everyday people—students, writers, creators, professionals, and founders.<br/>
          Get set up in 60 seconds with <strong>100% free AI models</strong>. Zero coding required.
        </p>

        <div class="wizard-feature-grid">
          <div class="wizard-feature-item">
            <div class="feature-icon-badge">${icons.bolt}</div>
            <div>
              <strong>100% Free AI Solutions</strong>
              <p>Connect to Google Gemini, Groq, NVIDIA, and OpenRouter without paying a dime.</p>
            </div>
          </div>

          <div class="wizard-feature-item">
            <div class="feature-icon-badge">${icons.globe}</div>
            <div>
              <strong>Live DuckDuckGo Web Grounding</strong>
              <p>Live internet searches and instant article reader built directly in.</p>
            </div>
          </div>

          <div class="wizard-feature-item">
            <div class="feature-icon-badge">${icons.sparkles}</div>
            <div>
              <strong>Resilient Failover Engine</strong>
              <p>Automatically switches models if one hits a temporary rate limit or outage.</p>
            </div>
          </div>

          <div class="wizard-feature-item">
            <div class="feature-icon-badge">${icons.folder}</div>
            <div>
              <strong>Private Local Workspace</strong>
              <p>Keep your conversations and files safely on your laptop.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // STEP 2: CHOOSE PATH
  _renderStep2ChoosePath() {
    return `
      <div class="wizard-step-container">
        <h2 class="wizard-title">How would you like to connect Eyqa?</h2>
        <p class="wizard-subtitle">Choose the AI source that best matches what you want:</p>

        <div class="wizard-path-cards">
          <!-- Option 1: Free AI -->
          <div class="wizard-path-card ${this.selectedPath === 'free' ? 'selected' : ''}" data-path="free">
            <div class="path-card-radio">
              <span class="radio-circle"></span>
            </div>
            <div class="path-card-content">
              <div class="path-card-title-row">
                <span class="path-badge free">Recommended</span>
                <h3>🆓 100% Free AI Models</h3>
              </div>
              <p>Instant high-capacity free tiers from Google Gemini (1M context), Groq LPU (500 tok/s), NVIDIA NIM, or OpenRouter. Zero cost, no credit card required.</p>
            </div>
          </div>

          <!-- Option 2: Free Claude Code Proxy -->
          <div class="wizard-path-card ${this.selectedPath === 'fcc' ? 'selected' : ''}" data-path="fcc">
            <div class="path-card-radio">
              <span class="radio-circle"></span>
            </div>
            <div class="path-card-content">
              <div class="path-card-title-row">
                <span class="path-badge fcc">Power Engine</span>
                <h3>⚡ Free Claude Code (FCC) Proxy</h3>
              </div>
              <p>Connect directly to your local FCC server (fcc-server) on port 8082 for 60+ providers and 1.3B+ monthly tokens.</p>
            </div>
          </div>

          <!-- Option 3: Bring Your Own Paid Key -->
          <div class="wizard-path-card ${this.selectedPath === 'paid' ? 'selected' : ''}" data-path="paid">
            <div class="path-card-radio">
              <span class="radio-circle"></span>
            </div>
            <div class="path-card-content">
              <div class="path-card-title-row">
                <span class="path-badge paid">Official APIs</span>
                <h3>🔑 Bring Your Own Key</h3>
              </div>
              <p>Use your existing developer API keys from OpenAI (GPT-4o), Anthropic (Claude 3.7 Sonnet), or DeepSeek.</p>
            </div>
          </div>

          <!-- Option 4: Local Offline -->
          <div class="wizard-path-card ${this.selectedPath === 'local' ? 'selected' : ''}" data-path="local">
            <div class="path-card-radio">
              <span class="radio-circle"></span>
            </div>
            <div class="path-card-content">
              <div class="path-card-title-row">
                <span class="path-badge local">Private</span>
                <h3>🖥️ Local Offline AI (Ollama)</h3>
              </div>
              <p>Runs 100% privately on your own computer hardware with zero internet usage.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // STEP 3: CONFIGURE PROVIDER & TEST
  _renderStep3ConfigureProvider() {
    if (this.selectedPath === 'free') {
      const currentProviderId = this.selectedFreeProvider;
      const prov = this.settings?.providers[currentProviderId];
      const guide = prov?.setupGuide;

      return `
        <div class="wizard-step-container">
          <h2 class="wizard-title">Connect Your Free AI Provider</h2>
          <p class="wizard-subtitle">Pick any free provider below. We provide clean, 1-minute setup links:</p>

          <!-- Provider Tabs -->
          <div class="wizard-prov-selector-tabs">
            <button class="prov-pill-tab ${currentProviderId === 'gemini' ? 'active' : ''}" data-prov="gemini">
              Google Gemini (Top Pick)
            </button>
            <button class="prov-pill-tab ${currentProviderId === 'groq' ? 'active' : ''}" data-prov="groq">
              Groq (Ultra-Fast)
            </button>
            <button class="prov-pill-tab ${currentProviderId === 'nvidia_nim' ? 'active' : ''}" data-prov="nvidia_nim">
              NVIDIA NIM
            </button>
            <button class="prov-pill-tab ${currentProviderId === 'openrouter' ? 'active' : ''}" data-prov="openrouter">
              OpenRouter Free Pool
            </button>
          </div>

          <!-- Guide & Input Box -->
          <div class="wizard-provider-setup-card">
            <div class="setup-guide-header">
              <h4>${this._escape(guide?.title || 'Setup Guide')}</h4>
              ${guide?.link ? `
                <a href="${guide.link}" target="_blank" class="guide-external-link">
                  Open ${prov?.name} Website ${icons.external || '↗'}
                </a>
              ` : ''}
            </div>

            <ol class="setup-steps-list">
              ${(guide?.steps || []).map((step, idx) => `
                <li>
                  <span class="step-num">${idx + 1}</span>
                  <span>${this._escape(step)}</span>
                </li>
              `).join('')}
            </ol>

            <div class="wizard-key-input-group">
              <label>PASTE YOUR ${prov?.name?.toUpperCase()} API KEY</label>
              <div class="input-with-action">
                <input
                  type="password"
                  id="wizardApiKeyInput"
                  class="wizard-text-input"
                  placeholder="Paste your API key here..."
                  value="${this._escape(prov?.apiKey || '')}"
                />
                <button id="btnWizardTestKey" class="wizard-btn-test" title="Verify connection">
                  ${this.testState.testing ? 'Testing...' : '⚡ Test Connection'}
                </button>
              </div>

              ${this._renderTestFeedback()}
            </div>
          </div>
        </div>
      `;
    }

    if (this.selectedPath === 'fcc') {
      const fccProv = this.settings?.providers['fcc_proxy'];
      return `
        <div class="wizard-step-container">
          <h2 class="wizard-title">Connect to Free Claude Code (FCC)</h2>
          <p class="wizard-subtitle">Eyqa routes requests directly through your local FCC server proxy.</p>

          <div class="wizard-provider-setup-card">
            <div class="setup-guide-header">
              <h4>Local FCC Server Status</h4>
              <span class="path-badge fcc">localhost:8082</span>
            </div>

            <ol class="setup-steps-list">
              <li>
                <span class="step-num">1</span>
                <span>Open your terminal and start the server with: <code>fcc-server</code> (or open the FCC Desktop app).</span>
              </li>
              <li>
                <span class="step-num">2</span>
                <span>Ensure the server is running on the default port <strong>8082</strong>.</span>
              </li>
              <li>
                <span class="step-num">3</span>
                <span>Click "Verify FCC Server" below to confirm the proxy connection.</span>
              </li>
            </ol>

            <div class="wizard-key-input-group">
              <div class="input-with-action">
                <input
                  type="text"
                  id="wizardFccUrlInput"
                  class="wizard-text-input"
                  value="${this._escape(fccProv?.baseUrl || 'http://localhost:8082/v1')}"
                />
                <button id="btnWizardTestKey" class="wizard-btn-test">
                  ${this.testState.testing ? 'Testing...' : '⚡ Verify FCC Server'}
                </button>
              </div>

              ${this._renderTestFeedback()}
            </div>
          </div>
        </div>
      `;
    }

    if (this.selectedPath === 'paid') {
      const prov = this.settings?.providers['openai'];
      return `
        <div class="wizard-step-container">
          <h2 class="wizard-title">Enter Your API Key</h2>
          <p class="wizard-subtitle">Add your OpenAI or Anthropic Claude developer API key:</p>

          <div class="wizard-provider-setup-card">
            <div class="wizard-key-input-group">
              <label>OPENAI / CLAUDE API KEY</label>
              <div class="input-with-action">
                <input
                  type="password"
                  id="wizardApiKeyInput"
                  class="wizard-text-input"
                  placeholder="sk-..."
                  value="${this._escape(prov?.apiKey || '')}"
                />
                <button id="btnWizardTestKey" class="wizard-btn-test">
                  ${this.testState.testing ? 'Testing...' : '⚡ Test Connection'}
                </button>
              </div>

              ${this._renderTestFeedback()}
            </div>
          </div>
        </div>
      `;
    }

    if (this.selectedPath === 'local') {
      const ollama = this.settings?.providers['ollama'];
      return `
        <div class="wizard-step-container">
          <h2 class="wizard-title">Local Offline AI (Ollama)</h2>
          <p class="wizard-subtitle">Eyqa connects automatically to Ollama on http://localhost:11434.</p>

          <div class="wizard-provider-setup-card">
            <p>Make sure you have Ollama installed and a model pulled (e.g. <code>ollama run llama3.2</code>).</p>
            <div style="margin-top: 16px;">
              <button id="btnWizardTestKey" class="wizard-btn-test">
                ${this.testState.testing ? 'Checking Ollama...' : '⚡ Check Local Connection'}
              </button>
            </div>
            ${this._renderTestFeedback()}
          </div>
        </div>
      `;
    }

    return '';
  }

  _renderTestFeedback() {
    if (this.testState.success === true) {
      return `
        <div class="wizard-test-result success">
          <span class="dot green"></span>
          <span>Verified! Connection latency: <strong>${this.testState.latency}ms</strong>. Ready to chat!</span>
        </div>
      `;
    }

    if (this.testState.success === false) {
      return `
        <div class="wizard-test-result error">
          <span class="dot red"></span>
          <span>Connection test failed: ${this._escape(this.testState.error || 'Check key and internet')}</span>
        </div>
      `;
    }

    return '';
  }

  // STEP 4: CHOOSE PERSONA
  _renderStep4ChoosePersona() {
    const personas = [
      {
        id: 'coworker',
        title: '✨ Everyday Coworker',
        badge: 'Recommended',
        desc: 'Thoughtful, executive partner for drafting emails, proposals, creative brainstorming, and answering everyday questions.'
      },
      {
        id: 'web_researcher',
        title: '🌐 Deep Web Explorer',
        badge: 'Live Grounding',
        desc: 'Specialized in searching the web, fact-checking information, analyzing live news, and synthesizing multiple sources.'
      },
      {
        id: 'file_manager',
        title: '📁 Workspace & Docs Assistant',
        badge: 'Productivity',
        desc: 'Focuses on reviewing local documents, organizing project notes, and drafting formal documentation.'
      },
      {
        id: 'coder',
        title: '⚡ Code & Automation',
        badge: 'Technical',
        desc: 'Assists with scripts, debugging, shell commands, HTML/CSS generation, and digital automation.'
      }
    ];

    return `
      <div class="wizard-step-container">
        <h2 class="wizard-title">Choose Your Coworker Persona</h2>
        <p class="wizard-subtitle">How would you like Eyqa to prioritize its assistance? (You can change this anytime):</p>

        <div class="wizard-persona-grid">
          ${personas.map(p => `
            <div class="wizard-persona-card ${this.selectedPersona === p.id ? 'selected' : ''}" data-persona="${p.id}">
              <div class="persona-card-header">
                <h3>${p.title}</h3>
                <span class="path-badge free">${p.badge}</span>
              </div>
              <p>${p.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // STEP 5: SUPERPOWERS & WORKSPACE
  _renderStep5Superpowers() {
    return `
      <div class="wizard-step-container">
        <h2 class="wizard-title">Configure Superpowers</h2>
        <p class="wizard-subtitle">Turn on instant web access and select your local documents folder:</p>

        <div class="wizard-superpowers-list">
          <div class="superpower-card">
            <div class="superpower-info">
              <div class="superpower-icon">${icons.globe}</div>
              <div>
                <h4>Live DuckDuckGo Web Grounding</h4>
                <p>Allow Eyqa to search the internet in real-time when answering news, facts, or research queries.</p>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="wizardToggleWebGrounding" ${this.webGrounding ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="superpower-card">
            <div class="superpower-info">
              <div class="superpower-icon">${icons.folder}</div>
              <div>
                <h4>Local Workspace Folder</h4>
                <p>Eyqa's private local directory for saving drafted proposals, reports, and reading documents.</p>
                <div class="workspace-current-path" id="wizardWorkspaceDisplay">
                  ${this._escape(this.settings?.workspacePath || '~/Eyqa_Workspace')}
                </div>
              </div>
            </div>
            <button class="wizard-btn-secondary" id="btnWizardChooseFolder">Browse Folder...</button>
          </div>
        </div>
      </div>
    `;
  }

  // STEP 6: READY!
  _renderStep6Ready() {
    let provName = 'Google Gemini (Free)';
    if (this.selectedPath === 'fcc') provName = 'Free Claude Code (FCC Proxy)';
    else if (this.selectedPath === 'paid') provName = 'OpenAI Official';
    else if (this.selectedPath === 'local') provName = 'Ollama (Local Offline)';
    else if (this.settings?.providers[this.selectedFreeProvider]) {
      provName = this.settings.providers[this.selectedFreeProvider].name;
    }

    return `
      <div class="wizard-step-container ready-step">
        <div class="wizard-mascot-hero">
          <img src="assets/eyqa-logo.png" alt="Eyqa Coworker" class="wizard-hero-logo" />
        </div>
        <h2 class="wizard-title">You are completely ready! 🎉</h2>
        <p class="wizard-subtitle">
          Your native AI coworker is configured and ready to supercharge your workflow.
        </p>

        <div class="wizard-summary-card">
          <div class="summary-row">
            <span>Active AI Brain:</span>
            <strong>${this._escape(provName)}</strong>
          </div>
          <div class="summary-row">
            <span>Persona:</span>
            <strong>${this.selectedPersona.replace('_', ' ').toUpperCase()}</strong>
          </div>
          <div class="summary-row">
            <span>Live Web Search:</span>
            <strong>${this.webGrounding ? 'Enabled (DuckDuckGo)' : 'Manual'}</strong>
          </div>
          <div class="summary-row">
            <span>Status:</span>
            <span class="dot green"></span> <strong>Ready & Connected</strong>
          </div>
        </div>

        <div class="wizard-starter-prompts">
          <p class="starter-label">Try asking Eyqa right away:</p>
          <div class="starter-chips-row">
            <button class="starter-chip" data-prompt="Draft a professional project proposal for an AI assistant application">
              📝 "Draft a project proposal"
            </button>
            <button class="starter-chip" data-prompt="Search the latest breakthroughs in artificial intelligence today and summarize them">
              🔍 "Search latest AI news"
            </button>
            <button class="starter-chip" data-prompt="Help me brainstorm 5 unique ideas for a creative product launch">
              💡 "Brainstorm product ideas"
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _attachEvents() {
    // Navigation Buttons
    this.modal.querySelector('.btn-wizard-next')?.addEventListener('click', async () => {
      await this._saveIntermediateState();
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
        this.testState = { testing: false, success: null, latency: 0, error: null };
        this.render();
      }
    });

    this.modal.querySelector('.btn-wizard-back')?.addEventListener('click', () => {
      if (this.currentStep > 1) {
        this.currentStep--;
        this.testState = { testing: false, success: null, latency: 0, error: null };
        this.render();
      }
    });

    this.modal.querySelector('.wizard-skip-btn')?.addEventListener('click', async () => {
      await this._completeWizard();
    });

    this.modal.querySelector('.btn-wizard-finish')?.addEventListener('click', async () => {
      await this._completeWizard();
    });

    // Step 2 Path Selection
    this.modal.querySelectorAll('.wizard-path-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedPath = card.dataset.path;
        this.modal.querySelectorAll('.wizard-path-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // Step 3 Provider Selector Tabs (Free Path)
    this.modal.querySelectorAll('.prov-pill-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.selectedFreeProvider = tab.dataset.prov;
        this.testState = { testing: false, success: null, latency: 0, error: null };
        this.render();
      });
    });

    // Step 3 Test Connection Button
    this.modal.querySelector('#btnWizardTestKey')?.addEventListener('click', async () => {
      await this._testActiveKey();
    });

    // Step 4 Persona Selection
    this.modal.querySelectorAll('.wizard-persona-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedPersona = card.dataset.persona;
        this.modal.querySelectorAll('.wizard-persona-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // Step 5 Toggles
    const webToggle = this.modal.querySelector('#wizardToggleWebGrounding');
    if (webToggle) {
      webToggle.addEventListener('change', (e) => {
        this.webGrounding = e.target.checked;
      });
    }

    const folderBtn = this.modal.querySelector('#btnWizardChooseFolder');
    if (folderBtn) {
      folderBtn.addEventListener('click', async () => {
        const folder = await api.selectWorkspaceFolder();
        if (folder) {
          if (!this.settings) this.settings = {};
          this.settings.workspacePath = folder;
          const display = this.modal.querySelector('#wizardWorkspaceDisplay');
          if (display) display.textContent = folder;
        }
      });
    }

    // Step 6 Starter Chips
    this.modal.querySelectorAll('.starter-chip').forEach(chip => {
      chip.addEventListener('click', async (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        await this._completeWizard(prompt);
      });
    });
  }

  async _testActiveKey() {
    let provId = 'gemini';
    let apiKey = '';
    let baseUrl = undefined;

    if (this.selectedPath === 'free') {
      provId = this.selectedFreeProvider;
      const input = this.modal.querySelector('#wizardApiKeyInput');
      apiKey = input ? input.value.trim() : '';
    } else if (this.selectedPath === 'fcc') {
      provId = 'fcc_proxy';
      apiKey = 'fcc';
      const input = this.modal.querySelector('#wizardFccUrlInput');
      baseUrl = input ? input.value.trim() : 'http://localhost:8082/v1';
    } else if (this.selectedPath === 'paid') {
      provId = 'openai';
      const input = this.modal.querySelector('#wizardApiKeyInput');
      apiKey = input ? input.value.trim() : '';
    } else if (this.selectedPath === 'local') {
      provId = 'ollama';
      apiKey = 'ollama';
    }

    this.testState = { testing: true, success: null, latency: 0, error: null };
    this.render();

    try {
      const configOverride = {
        ...this.settings.providers[provId],
        apiKey,
        ...(baseUrl ? { baseUrl } : {})
      };

      const result = await api.testProvider(provId, configOverride);
      this.testState = {
        testing: false,
        success: Boolean(result.success),
        latency: result.latency || 0,
        error: result.error || null
      };

      // If test succeeded, immediately persist to settings
      if (result.success) {
        if (!this.settings.providers[provId]) this.settings.providers[provId] = {};
        this.settings.providers[provId].apiKey = apiKey;
        this.settings.providers[provId].enabled = true;
        if (baseUrl) this.settings.providers[provId].baseUrl = baseUrl;
        this.settings.activeProviderId = provId;
        await api.saveSettings(this.settings);
      }
    } catch (err) {
      this.testState = {
        testing: false,
        success: false,
        latency: 0,
        error: err.message
      };
    }

    this.render();
  }

  async _saveIntermediateState() {
    if (this.currentStep === 3) {
      let provId = this.selectedFreeProvider;
      if (this.selectedPath === 'fcc') provId = 'fcc_proxy';
      else if (this.selectedPath === 'paid') provId = 'openai';
      else if (this.selectedPath === 'local') provId = 'ollama';

      const keyInput = this.modal.querySelector('#wizardApiKeyInput');
      if (keyInput && this.settings.providers[provId]) {
        this.settings.providers[provId].apiKey = keyInput.value.trim();
        this.settings.providers[provId].enabled = true;
        this.settings.activeProviderId = provId;
        await api.saveSettings(this.settings);
      }
    }
  }

  async _completeWizard(starterPrompt = null) {
    if (!this.settings) this.settings = await api.getSettings();

    // Mark completed
    this.settings.hasCompletedWizard = true;
    this.settings.activeAgentMode = this.selectedPersona;
    this.settings.autoWebSearch = this.webGrounding;

    if (this.selectedPath === 'fcc') {
      this.settings.activeProviderId = 'fcc_proxy';
    } else if (this.selectedPath === 'local') {
      this.settings.activeProviderId = 'ollama';
    } else if (this.selectedPath === 'free') {
      this.settings.activeProviderId = this.selectedFreeProvider;
    }

    await api.saveSettings(this.settings);
    this.close();

    if (this.onWizardCompleted) {
      this.onWizardCompleted(this.settings, starterPrompt);
    }
  }

  _escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

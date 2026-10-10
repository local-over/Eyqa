/**
 * Eyqa Configuration Store
 * Handles persistent settings for AI providers, free tier presets, agent behaviors, and UI preferences.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Default Provider Presets with clean metadata for everyday users
const DEFAULT_PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Free Tier',
    badgeType: 'free',
    type: 'gemini',
    description: 'Ultra-fast, 1M token context, 15 free requests/min from Google AI Studio.',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash',
    availableModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fastest, Multimodal)', free: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Reliable)', free: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)', free: true }
    ],
    setupGuide: {
      title: 'Get Free Google Gemini Key',
      steps: [
        'Visit Google AI Studio: https://aistudio.google.com/app/apikey',
        'Sign in with your Google account and click "Create API key".',
        'Paste the key here and click "Test Connection". Zero billing required.'
      ],
      link: 'https://aistudio.google.com/app/apikey'
    },
    enabled: true
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Lightning Free',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Blazingly fast LPU inference (500+ tok/s). Free daily tier.',
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    availableModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Recommended)', free: true },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Large Context)', free: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Fastest)', free: true }
    ],
    setupGuide: {
      title: 'Get Free Groq API Key',
      steps: [
        'Visit Groq Console: https://console.groq.com/keys',
        'Sign up for free and click "Create API Key".',
        'Paste the key here and test.'
      ],
      link: 'https://console.groq.com/keys'
    },
    enabled: true
  },
  nvidia_nim: {
    id: 'nvidia_nim',
    name: 'NVIDIA NIM',
    badge: '1,000 Free Credits',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Enterprise models hosted by NVIDIA. 1,000 free tokens/credits per account.',
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.3-70b-instruct',
    availableModels: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', free: true },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B (High Reasoning)', free: true },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (NVIDIA hosted)', free: true }
    ],
    setupGuide: {
      title: 'Get Free NVIDIA NIM Key',
      steps: [
        'Visit NVIDIA Build: https://build.nvidia.com/settings/api-keys',
        'Create an account to automatically receive 1,000 free inference credits.',
        'Generate an API Key, paste here, and enjoy.'
      ],
      link: 'https://build.nvidia.com/settings/api-keys'
    },
    enabled: true
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (Free Pool)',
    badge: 'Free Models Pool',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Unified router with dozens of completely free models (DeepSeek, Llama, Gemma, Nemotron).',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/free',
    availableModels: [
      { id: 'openrouter/free', name: 'OpenRouter Free Pool (Auto-Routed)', free: true },
      { id: 'nvidia/nemotron-3.5-lightning:free', name: 'NVIDIA Nemotron 3.5 Lightning (Free)', free: true },
      { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots 3 Note Preview (Free)', free: true }
    ],
    setupGuide: {
      title: 'Get Free OpenRouter Key',
      steps: [
        'Visit OpenRouter: https://openrouter.ai/keys',
        'Create a free key. Free models have no cost and require no credit card deposit.',
        'Paste the key here.'
      ],
      link: 'https://openrouter.ai/keys'
    },
    enabled: true
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen Cloud (Alibaba)',
    badge: 'High Speed',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Leading global Qwen model suite via international endpoint.',
    apiKey: '',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    availableModels: [
      { id: 'qwen-plus', name: 'Qwen Plus (Fast & Intelligent)', free: true },
      { id: 'qwen-turbo', name: 'Qwen Turbo (Instant)', free: true },
      { id: 'qwen-max', name: 'Qwen Max (Deep Reasoning)', free: true }
    ],
    setupGuide: {
      title: 'Qwen Model Studio Key',
      steps: [
        'Visit Alibaba Model Studio: https://dashscope-intl.aliyuncs.com',
        'Create a free API key with complimentary welcome tokens.',
        'Paste here and test.'
      ],
      link: 'https://dashscope-intl.aliyuncs.com'
    },
    enabled: true
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local Offline)',
    badge: '100% Offline & Private',
    badgeType: 'local',
    type: 'openai_compatible',
    description: 'Runs on your own hardware. Zero internet required, completely free & private.',
    apiKey: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    availableModels: [
      { id: 'llama3.2', name: 'Llama 3.2 (Default)', free: true },
      { id: 'deepseek-r1:7b', name: 'DeepSeek R1 7B (Reasoning)', free: true },
      { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder', free: true },
      { id: 'mistral', name: 'Mistral 7B', free: true }
    ],
    setupGuide: {
      title: 'Setup Local Ollama',
      steps: [
        'Download and install Ollama from https://ollama.com',
        'Open terminal and run: ollama run llama3.2',
        'Eyqa automatically connects to http://localhost:11434 with zero configuration.'
      ],
      link: 'https://ollama.com'
    },
    enabled: false
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Paid Key',
    badgeType: 'paid',
    type: 'anthropic',
    description: 'Direct Anthropic API for Claude 3.7 Sonnet and Haiku.',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-7-sonnet-20250219',
    availableModels: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' }
    ],
    setupGuide: {
      title: 'Anthropic Console Key',
      steps: [
        'Visit https://console.anthropic.com/settings/keys',
        'Create an API key with standard account credits.',
        'Paste here.'
      ],
      link: 'https://console.anthropic.com/settings/keys'
    },
    enabled: false
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    badge: 'Paid Key',
    badgeType: 'paid',
    type: 'openai_compatible',
    description: 'Direct OpenAI API for GPT-4o, o3-mini, and ChatGPT models.',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    availableModels: [
      { id: 'gpt-4o', name: 'GPT-4o (Flagship Multimodal)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Affordable)' },
      { id: 'o3-mini', name: 'o3-mini (STEM Reasoning)' }
    ],
    setupGuide: {
      title: 'OpenAI Platform Key',
      steps: [
        'Visit https://platform.openai.com/api-keys',
        'Generate a secret key and paste here.'
      ],
      link: 'https://platform.openai.com/api-keys'
    },
    enabled: false
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek Official',
    badge: 'Paid Key',
    badgeType: 'paid',
    type: 'openai_compatible',
    description: 'DeepSeek V3 and R1 reasoning at ultra-low official rates.',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    availableModels: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3 (Chat)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Thinking)' }
    ],
    setupGuide: {
      title: 'DeepSeek Platform Key',
      steps: [
        'Visit https://platform.deepseek.com/api_keys',
        'Generate an API key and paste here.'
      ],
      link: 'https://platform.deepseek.com/api_keys'
    },
    enabled: false
  },
  fcc_proxy: {
    id: 'fcc_proxy',
    name: 'Free Claude Code (FCC)',
    badge: 'FCC Engine Proxy',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Connects directly to your local Free Claude Code proxy server (fcc-server) on port 8082.',
    apiKey: 'fcc',
    baseUrl: 'http://localhost:8082/v1',
    model: 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b',
    availableModels: [
      { id: 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b', name: 'NVIDIA Nemotron 3 Super 120B (FCC Free)', free: true },
      { id: 'open_router/openrouter/free', name: 'OpenRouter Free Pool (FCC Free)', free: true },
      { id: 'groq/llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B (FCC Free)', free: true },
      { id: 'gemini/gemini-2.0-flash', name: 'Google Gemini 2.0 Flash (FCC Free)', free: true },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (FCC)', free: true }
    ],
    setupGuide: {
      title: 'Connect to Free Claude Code (FCC)',
      steps: [
        'Run fcc-server in your terminal (or start the FCC Desktop tray app).',
        'Eyqa connects to the FCC translation proxy at http://localhost:8082.',
        'Enjoy 1.3B+ monthly tokens and 60 provider integrations.'
      ],
      link: 'https://github.com/alishahryar1/free-claude-code'
    },
    enabled: true
  }
};

const DEFAULT_CONFIG = {
  version: 1,
  hasCompletedWizard: true,
  activeProviderId: 'openrouter',
  fallbackOrder: ['openrouter', 'qwen', 'groq', 'nvidia_nim', 'gemini', 'fcc_proxy', 'ollama'],
  activeAgentMode: 'coworker', // coworker | web_researcher | file_manager | coder
  workspacePath: path.join(os.homedir(), 'Eyqa_Workspace'),
  autoWebSearch: true,
  maxWebSearchResults: 5,
  appearance: {
    theme: 'dark', // 'dark' | 'light' | 'midnight'
    fontSize: 'normal', // 'compact' | 'normal' | 'relaxed'
    showCanvasOnStart: false
  },
  providers: DEFAULT_PROVIDERS
};

class ConfigStore {
  constructor(customPath = null) {
    const configDir = customPath || path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      'eyqa'
    );
    this.filePath = path.join(configDir, 'settings.json');
    this.config = null;
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        // Deep merge with defaults so new providers/keys appear cleanly
        this.config = this._mergeDefaults(parsed, DEFAULT_CONFIG);
      } else {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        this.save();
      }

      // Auto-import preconfigured keys from local machine (.fcc/.env, .hermes/.env)
      this.importLocalConfigs();

      // Ensure workspace folder exists
      if (!fs.existsSync(this.config.workspacePath)) {
        fs.mkdirSync(this.config.workspacePath, { recursive: true });
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to initialize config, using defaults:', err);
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }

  importLocalConfigs() {
    try {
      const candidates = [
        path.join(os.homedir(), '.fcc', '.env'),
        path.join(os.homedir(), '.hermes', '.env'),
        path.join(process.cwd(), '.env')
      ];

      for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

            if (!val) continue;

            if (key === 'OPENROUTER_API_KEY' && this.config.providers.openrouter) {
              this.config.providers.openrouter.apiKey = val;
              this.config.providers.openrouter.enabled = true;
              this.config.providers.openrouter.model = 'openrouter/free';
            }
            if (key === 'QWENCLOUD_API_KEY' && this.config.providers.qwen) {
              this.config.providers.qwen.apiKey = val;
              this.config.providers.qwen.enabled = true;
            }
            if (key === 'GROQ_API_KEY' && this.config.providers.groq) {
              this.config.providers.groq.apiKey = val;
              this.config.providers.groq.enabled = true;
            }
            if (key === 'NVIDIA_NIM_API_KEY' && this.config.providers.nvidia_nim) {
              this.config.providers.nvidia_nim.apiKey = val;
              this.config.providers.nvidia_nim.enabled = true;
            }
            if ((key === 'GEMINI_API_KEY' || key === 'GOOGLE_API_KEY') && this.config.providers.gemini) {
              this.config.providers.gemini.apiKey = val;
              this.config.providers.gemini.enabled = true;
            }
          }
        }
      }

      // If current active provider has an empty or invalid key, auto-switch to a verified working one
      const currentActive = this.config.providers[this.config.activeProviderId];
      if (!currentActive || !currentActive.apiKey?.trim()) {
        const workingProvider = ['openrouter', 'qwen', 'groq', 'nvidia_nim', 'gemini'].find(
          id => this.config.providers[id] && this.config.providers[id].apiKey?.trim()
        );
        if (workingProvider) {
          this.config.activeProviderId = workingProvider;
        }
      }

      // Ensure openrouter default model is openrouter/free
      if (this.config.providers.openrouter) {
        if (!this.config.providers.openrouter.model || this.config.providers.openrouter.model.includes('llama-3.3-70b-instruct:free')) {
          this.config.providers.openrouter.model = 'openrouter/free';
        }
      }

      this.save();
    } catch (err) {
      console.warn('[ConfigStore] Note: Could not import local env configs:', err.message);
    }
  }

  _mergeDefaults(user, def) {
    const result = { ...def, ...user };
    result.providers = { ...def.providers };
    if (user.providers) {
      for (const [k, p] of Object.entries(user.providers)) {
        if (result.providers[k]) {
          result.providers[k] = { ...result.providers[k], ...p };
        } else {
          result.providers[k] = p;
        }
      }
    }
    return result;
  }

  get() {
    return this.config;
  }

  update(partial) {
    this.config = { ...this.config, ...partial };
    this.save();
    return this.config;
  }

  updateProvider(providerId, updateData) {
    if (this.config.providers[providerId]) {
      this.config.providers[providerId] = {
        ...this.config.providers[providerId],
        ...updateData
      };
      this.save();
    }
    return this.config;
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[ConfigStore] Failed to write settings:', err);
    }
  }
}

module.exports = {
  ConfigStore,
  DEFAULT_PROVIDERS,
  DEFAULT_CONFIG
};

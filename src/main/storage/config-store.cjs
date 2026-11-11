/**
 * Eyqa Configuration Store
 * Full Free Claude Code (FCC) provider catalog with 19 free providers,
 * automated free pool cascade routing, paid engines, and local env importer.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Comprehensive FCC Provider Catalog
const DEFAULT_PROVIDERS = {
  // 1. Groq Cloud (Ultra-Fast LPUs)
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    badge: '300M Tokens/mo',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Ultra-fast inference (500+ tok/s). 14,400 requests/day free on Llama 3.3 70B.',
    apiKey: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    availableModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Recommended)', free: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Ultra-Fast)', free: true }
    ],
    setupGuide: {
      title: 'Get Free Groq Cloud Key',
      steps: [
        'Visit Groq Console: https://console.groq.com/keys',
        'Sign up for free and click "Create API Key". Zero credit card required.',
        'Paste key here. Automatically added to your Free Auto-Pool.'
      ],
      link: 'https://console.groq.com/keys'
    },
    enabled: true,
    capacity: '300 Million tokens/mo'
  },

  // 2. Cerebras Inference (Wafer Scale Engine)
  cerebras: {
    id: 'cerebras',
    name: 'Cerebras Inference',
    badge: '2,000+ tok/s Fast',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'World-record wafer scale engine with 2,000+ tokens/sec throughput on Llama 3.3 70B.',
    apiKey: '',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama3.3-70b',
    availableModels: [
      { id: 'llama3.3-70b', name: 'Llama 3.3 70B (Wafer Scale)', free: true },
      { id: 'llama3.1-8b', name: 'Llama 3.1 8B', free: true }
    ],
    setupGuide: {
      title: 'Get Free Cerebras Key',
      steps: [
        'Visit Cerebras Cloud: https://cloud.cerebras.ai/',
        'Sign in and generate your free developer API key.',
        'Paste key here for instant wafer-scale inference.'
      ],
      link: 'https://cloud.cerebras.ai/'
    },
    enabled: true,
    capacity: '1M+ tokens/day'
  },

  // 3. SambaNova Cloud (SN40L AI Processors)
  sambanova: {
    id: 'sambanova',
    name: 'SambaNova Cloud',
    badge: 'High Speed SN40L',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'High-speed open source models powered by SambaNova SN40L Reconfigurable Dataflow Units.',
    apiKey: '',
    baseUrl: 'https://api.sambanova.ai/v1',
    model: 'Meta-Llama-3.3-70B-Instruct',
    availableModels: [
      { id: 'Meta-Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B Instruct', free: true }
    ],
    setupGuide: {
      title: 'Get Free SambaNova Key',
      steps: [
        'Visit SambaNova Cloud: https://cloud.sambanova.ai/apis',
        'Sign up for the free developer tier and generate an API key.',
        'Paste key here.'
      ],
      link: 'https://cloud.sambanova.ai/apis'
    },
    enabled: true,
    capacity: 'Free developer tier'
  },

  // 4. NVIDIA NIM (Nemotron 120B Reasoning)
  nvidia_nim: {
    id: 'nvidia_nim',
    name: 'NVIDIA NIM',
    badge: '1,000 Free Credits',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'NVIDIA 120B reasoning powerhouse and DeepSeek R1 with 1,000 free inference credits on registration.',
    apiKey: '',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'nvidia/nemotron-3-super-120b-a12b',
    availableModels: [
      { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 3 Super 120B (Reasoning)', free: true },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', free: true },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (NVIDIA hosted)', free: true }
    ],
    setupGuide: {
      title: 'Get Free NVIDIA NIM Key',
      steps: [
        'Visit NVIDIA Build: https://build.nvidia.com/settings/api-keys',
        'Sign up to receive 1,000 complimentary credits automatically.',
        'Generate an API key and paste here.'
      ],
      link: 'https://build.nvidia.com/settings/api-keys'
    },
    enabled: true,
    capacity: '50 Million tokens'
  },

  // 5. Google Gemini (Google AI Studio)
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: '1 Billion Tokens/mo',
    badgeType: 'free',
    type: 'gemini',
    description: 'Next-gen multimodal intelligence with massive 1M context window and 15 RPM free tier.',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash',
    availableModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast, Multimodal, 1M context)', free: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', free: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning, 2M context)', free: true }
    ],
    setupGuide: {
      title: 'Get Free Google AI Studio Key',
      steps: [
        'Visit Google AI Studio: https://aistudio.google.com/app/apikey',
        'Click "Create API key" with your standard Google account.',
        'Paste key here. Zero credit card or billing setup required.'
      ],
      link: 'https://aistudio.google.com/app/apikey'
    },
    enabled: true,
    capacity: '1 Billion tokens/mo'
  },

  // 6. OpenRouter Free Pool
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter Free Pool',
    badge: '100M Tokens/mo',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Auto-routes requests through high-capacity community free models (DeepSeek V3, Gemma 2, Llama 3.3).',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/free',
    availableModels: [
      { id: 'openrouter/free', name: 'OpenRouter Free Auto-Router', free: true }
    ],
    setupGuide: {
      title: 'Get Free OpenRouter Key',
      steps: [
        'Visit OpenRouter: https://openrouter.ai/keys',
        'Create a free key. Free models have zero cost and require no deposit.',
        'Paste key here.'
      ],
      link: 'https://openrouter.ai/keys'
    },
    enabled: true,
    capacity: '100 Million tokens/mo'
  },

  // 7. Together AI
  together: {
    id: 'together',
    name: 'Together AI',
    badge: '$5 Free Credit',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Fast cloud inference on Llama 3.3 70B with $5.00 free credit upon registration.',
    apiKey: '',
    baseUrl: 'https://api.together.ai/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    availableModels: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', free: true }
    ],
    setupGuide: {
      title: 'Get Free Together AI Key',
      steps: [
        'Visit Together AI: https://api.together.ai/settings/api-keys',
        'Sign up to receive $5.00 in welcome inference credits.',
        'Paste key here.'
      ],
      link: 'https://api.together.ai/settings/api-keys'
    },
    enabled: true,
    capacity: '$5.00 credits'
  },

  // 8. DeepInfra
  deepinfra: {
    id: 'deepinfra',
    name: 'DeepInfra',
    badge: 'Free Welcome Credit',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Ultra-low latency hosting for DeepSeek V3 and Llama models with free starting credits.',
    apiKey: '',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    model: 'deepseek-ai/DeepSeek-V3',
    availableModels: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', free: true }
    ],
    setupGuide: {
      title: 'Get Free DeepInfra Key',
      steps: [
        'Visit DeepInfra: https://deepinfra.com/dash/api_keys',
        'Create an account and generate an API key.',
        'Paste key here.'
      ],
      link: 'https://deepinfra.com/dash/api_keys'
    },
    enabled: true,
    capacity: 'Free credits'
  },

  // 9. SiliconFlow
  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow',
    badge: '20M Free Tokens',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'High-speed inference on Qwen 2.5 72B and DeepSeek with 20M free tokens on signup.',
    apiKey: '',
    baseUrl: 'https://api.siliconflow.com/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    availableModels: [
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B Instruct', free: true }
    ],
    setupGuide: {
      title: 'Get Free SiliconFlow Key',
      steps: [
        'Visit SiliconFlow: https://cloud.siliconflow.com/account/ak',
        'Sign up to automatically get 20 Million free tokens.',
        'Paste key here.'
      ],
      link: 'https://cloud.siliconflow.com/account/ak'
    },
    enabled: true,
    capacity: '20 Million tokens'
  },

  // 10. Qwen Cloud (Alibaba Model Studio)
  qwen: {
    id: 'qwen',
    name: 'Qwen Cloud (Alibaba)',
    badge: '1 Million Tokens',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Alibaba Cloud high-intelligence flagship model with complimentary developer credits.',
    apiKey: '',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    availableModels: [
      { id: 'qwen-plus', name: 'Qwen Plus (Fast & Intelligent)', free: true }
    ],
    setupGuide: {
      title: 'Get Qwen Model Studio Key',
      steps: [
        'Visit Alibaba Model Studio: https://home.qwencloud.com/api-keys',
        'Create a free API key with welcome quota.',
        'Paste key here.'
      ],
      link: 'https://home.qwencloud.com/api-keys'
    },
    enabled: true,
    capacity: '1 Million tokens'
  },

  // 11. Kilo.ai
  kilo: {
    id: 'kilo',
    name: 'Kilo.ai',
    badge: 'Free Gateway Pool',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Community multi-model gateway with automated free tier routing.',
    apiKey: '',
    baseUrl: 'https://api.kilo.ai/api/gateway',
    model: 'kilo-auto/free',
    availableModels: [
      { id: 'kilo-auto/free', name: 'Kilo Auto Free Pool', free: true }
    ],
    setupGuide: {
      title: 'Get Kilo.ai Key',
      steps: [
        'Visit Kilo.ai: https://kilo.ai',
        'Sign up for community access and grab your gateway key.',
        'Paste key here.'
      ],
      link: 'https://kilo.ai'
    },
    enabled: true,
    capacity: 'Community free pool'
  },

  // 12. ZenMux
  zenmux: {
    id: 'zenmux',
    name: 'ZenMux',
    badge: 'DeepSeek Free Tier',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Free community routing endpoints for DeepSeek models.',
    apiKey: '',
    baseUrl: 'https://zenmux.ai/api/v1',
    model: 'deepseek/deepseek-v3-free',
    availableModels: [
      { id: 'deepseek/deepseek-v3-free', name: 'DeepSeek V3 Free Route', free: true }
    ],
    setupGuide: {
      title: 'Get ZenMux Key',
      steps: [
        'Visit ZenMux: https://zenmux.ai/platform/pay-as-you-go',
        'Register for the free community access tier.',
        'Paste key here.'
      ],
      link: 'https://zenmux.ai/platform/pay-as-you-go'
    },
    enabled: true,
    capacity: 'Free community tier'
  },

  // 13. Hugging Face Inference
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face Inference',
    badge: 'Serverless Community',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Community serverless inference API hosting open-source coding models.',
    apiKey: '',
    baseUrl: 'https://router.huggingface.co/v1',
    model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    availableModels: [
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B Instruct', free: true }
    ],
    setupGuide: {
      title: 'Get Free Hugging Face Token',
      steps: [
        'Visit Hugging Face: https://huggingface.co/settings/tokens',
        'Create a free user access token with Read permissions.',
        'Paste token here.'
      ],
      link: 'https://huggingface.co/settings/tokens'
    },
    enabled: true,
    capacity: 'Free community calls'
  },

  // 14. Mistral AI
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    badge: 'Free Experiment Tier',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Mistral Small and Devstral available on the free developer experiment tier.',
    apiKey: '',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    availableModels: [
      { id: 'mistral-small-latest', name: 'Mistral Small Latest', free: true }
    ],
    setupGuide: {
      title: 'Get Free Mistral Key',
      steps: [
        'Visit Mistral Console: https://console.mistral.ai/',
        'Sign up for the developer experiment tier.',
        'Paste key here.'
      ],
      link: 'https://console.mistral.ai/'
    },
    enabled: true,
    capacity: 'Free experiment tier'
  },

  // 15. Cohere
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    badge: '1,000 Calls/mo Free',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Trial key with 1,000 free monthly calls on Command R+.',
    apiKey: '',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    model: 'command-r-plus',
    availableModels: [
      { id: 'command-r-plus', name: 'Command R+', free: true }
    ],
    setupGuide: {
      title: 'Get Free Cohere Trial Key',
      steps: [
        'Visit Cohere Dashboard: https://dashboard.cohere.com/api-keys',
        'Create a free Trial API key.',
        'Paste key here.'
      ],
      link: 'https://dashboard.cohere.com/api-keys'
    },
    enabled: true,
    capacity: '1,000 calls/mo'
  },

  // 16. Cloudflare Workers AI
  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    badge: '10k Neurons/day Free',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Serverless global edge inference with 10,000 free neurons every day.',
    apiKey: '',
    baseUrl: 'https://api.cloudflare.com/client/v4',
    model: '@cf/meta/llama-3.3-70b-instruct',
    availableModels: [
      { id: '@cf/meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (Edge)', free: true }
    ],
    setupGuide: {
      title: 'Get Cloudflare AI Token',
      steps: [
        'Visit Cloudflare: https://developers.cloudflare.com/workers-ai/',
        'Generate an API token with Workers AI Read/Write permissions.',
        'Paste token here.'
      ],
      link: 'https://developers.cloudflare.com/workers-ai/'
    },
    enabled: true,
    capacity: '10,000 neurons/day'
  },

  // 17. Ollama (Local Offline)
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local Offline)',
    badge: '100% Private Offline',
    badgeType: 'local',
    type: 'openai_compatible',
    description: 'Runs on your own GPU/CPU. Zero internet required, completely free & private.',
    apiKey: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    availableModels: [
      { id: 'llama3.2', name: 'Llama 3.2', free: true },
      { id: 'deepseek-r1:7b', name: 'DeepSeek R1 7B', free: true },
      { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder', free: true }
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
    enabled: false,
    capacity: 'Unlimited local'
  },

  // 18. LM Studio (Local GPU Server)
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio (Local Server)',
    badge: 'Local GPU Server',
    badgeType: 'local',
    type: 'openai_compatible',
    description: 'Connects to your local LM Studio instance on port 1234.',
    apiKey: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    model: 'default',
    availableModels: [
      { id: 'default', name: 'Active LM Studio Loaded Model', free: true }
    ],
    setupGuide: {
      title: 'Connect Local LM Studio',
      steps: [
        'Open LM Studio -> Developer Tab.',
        'Start Local Server on port 1234.',
        'Eyqa connects automatically with zero setup.'
      ],
      link: 'https://lmstudio.ai/'
    },
    enabled: false,
    capacity: 'Unlimited local'
  },

  // 19. Embedded Free Claude Code Background Service (src/fcc/ on port 8082)
  fcc_proxy: {
    id: 'fcc_proxy',
    name: 'Embedded FCC Service',
    badge: 'Embedded Port 8082',
    badgeType: 'free',
    type: 'openai_compatible',
    description: 'Embedded Free Claude Code library running in the background from src/fcc/ on port 8082. Auto-boots with Eyqa, editable in repository.',
    apiKey: 'fcc',
    baseUrl: 'http://127.0.0.1:8082/v1',
    model: 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b',
    availableModels: [
      { id: 'nvidia_nim/nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 120B (Embedded FCC)', free: true }
    ],
    setupGuide: {
      title: 'Embedded FCC Background Library (src/fcc/)',
      steps: [
        'Runs automatically in the background from src/fcc/ on port 8082 when Eyqa starts.',
        'You can edit the Python library code directly in src/fcc/ inside the repository.',
        'Use the controls in Settings to Restart the service or view live logs.'
      ],
      link: 'http://127.0.0.1:8082/admin'
    },
    enabled: true,
    capacity: 'Embedded Local Engine'
  },

  // --- Paid Frontier Providers ---
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Paid Key',
    badgeType: 'paid',
    type: 'anthropic',
    description: 'Direct Anthropic API for Claude 3.7 Sonnet (hybrid thinking) and Claude 3.5 Sonnet.',
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
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
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
    description: 'DeepSeek V3 and R1 reasoning at official direct platform rates.',
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

  xai: {
    id: 'xai',
    name: 'xAI (Grok)',
    badge: 'Paid Key',
    badgeType: 'paid',
    type: 'openai_compatible',
    description: 'xAI Grok models via official console.',
    apiKey: '',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-2',
    availableModels: [
      { id: 'grok-2', name: 'Grok 2' }
    ],
    setupGuide: {
      title: 'xAI Console Key',
      steps: [
        'Visit https://console.x.ai/team/default/api-keys',
        'Generate an API key and paste here.'
      ],
      link: 'https://console.x.ai/team/default/api-keys'
    },
    enabled: false
  }
};

// FCC Default Priority Sequence for the Free Pool
const FCC_FREE_POOL_PRIORITY = [
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

const DEFAULT_CONFIG = {
  version: 2,
  hasCompletedWizard: true,
  engineMode: 'free_pool', // 'free_pool' | 'paid'
  activeProviderId: 'groq',
  activeModelRef: 'groq/llama-3.3-70b-versatile',
  fastModelRef: 'groq/llama-3.1-8b-instant',
  fallbackModelRef: 'gemini/gemini-2.0-flash',
  reasoningEffort: 'from_client', // 'from_client' | 'off' | 'low' | 'medium' | 'high' | 'max'
  freePoolPriority: FCC_FREE_POOL_PRIORITY,
  fallbackOrder: FCC_FREE_POOL_PRIORITY,
  activeAgentMode: 'coworker', // coworker | web_researcher | file_manager | coder
  workspacePath: path.join(os.homedir(), 'Eyqa_Workspace'),
  projectName: 'My Project',
  projectPrompt: 'You are an intelligent assistant. Follow coding standards and give clean responses.',
  autoWebSearch: true,
  maxWebSearchResults: 5,
  appearance: {
    theme: 'dark', // 'dark' | 'light' | 'midnight'
    fontSize: 'normal', // 'compact' | 'normal' | 'relaxed'
    showCanvasOnStart: false
  },
  imageGeneration: {
    provider: 'pollinations', // 'pollinations' | 'openai'
    model: 'flux',           // 'flux' | 'flux-realism' | 'flux-anime' | 'dall-e-3'
    apiKey: '',
    size: '1024x1024',
    quality: 'standard',
    fallbackToFree: true
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
        this.config = this._mergeDefaults(parsed, DEFAULT_CONFIG);
      } else {
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        this.save();
      }

      // Auto-import preconfigured keys from local machine (.fcc/.env, .hermes/.env)
      this.importLocalConfigs();
      this.checkForModelUpdates();

      if (!fs.existsSync(this.config.workspacePath)) {
        fs.mkdirSync(this.config.workspacePath, { recursive: true });
      }
    } catch (err) {
      console.error('[ConfigStore] Failed to initialize config, using defaults:', err);
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }

  async checkForModelUpdates() {
    try {
      const url = 'https://raw.githubusercontent.com/alishahryar1/free-claude-code/main/models-registry.json';
      const https = require('node:https');
      https.get(url, (res) => {
        if (res.statusCode !== 200) return;
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const registry = JSON.parse(data);
            if (registry.providers) {
              let updated = false;
              for (const [providerId, providerData] of Object.entries(registry.providers)) {
                if (this.config.providers[providerId] && providerData.models) {
                  this.config.providers[providerId].availableModels = providerData.models;
                  updated = true;
                }
              }
              if (updated) this.save();
            }
          } catch (e) {
            // Ignore parse errors from OTA
          }
        });
      }).on('error', () => {});
    } catch (err) {}
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

            const map = {
              'GROQ_API_KEY': 'groq',
              'CEREBRAS_API_KEY': 'cerebras',
              'SAMBANOVA_API_KEY': 'sambanova',
              'NVIDIA_NIM_API_KEY': 'nvidia_nim',
              'GEMINI_API_KEY': 'gemini',
              'GOOGLE_API_KEY': 'gemini',
              'OPENROUTER_API_KEY': 'openrouter',
              'TOGETHER_API_KEY': 'together',
              'DEEPINFRA_API_KEY': 'deepinfra',
              'SILICONFLOW_API_KEY': 'siliconflow',
              'QWENCLOUD_API_KEY': 'qwen',
              'ALIBABA_CLOUD_API_KEY': 'qwen',
              'KILO_API_KEY': 'kilo',
              'ZENMUX_API_KEY': 'zenmux',
              'HUGGINGFACE_API_KEY': 'huggingface',
              'MISTRAL_API_KEY': 'mistral',
              'COHERE_API_KEY': 'cohere',
              'CLOUDFLARE_API_TOKEN': 'cloudflare',
              'ANTHROPIC_API_KEY': 'anthropic',
              'OPENAI_API_KEY': 'openai',
              'DEEPSEEK_API_KEY': 'deepseek',
              'XAI_API_KEY': 'xai'
            };

            const targetProviderId = map[key];
            if (targetProviderId && this.config.providers[targetProviderId]) {
              this.config.providers[targetProviderId].apiKey = val;
              this.config.providers[targetProviderId].enabled = true;
              this.config.hasCompletedWizard = true;
            }
          }
        }
      }

      // Default to free_pool mode
      if (!this.config.engineMode) {
        this.config.engineMode = 'free_pool';
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
          result.providers[k] = {
            ...result.providers[k],
            ...p,
            availableModels: def.providers[k]?.availableModels || p.availableModels,
            baseUrl: def.providers[k]?.baseUrl || p.baseUrl
          };
        } else {
          result.providers[k] = p;
        }
      }
    }
    // Ensure all 19 providers from def.providers exist
    for (const [k, p] of Object.entries(def.providers)) {
      if (!result.providers[k]) {
        result.providers[k] = p;
      }
    }
    // Ensure freePoolPriority exists
    if (!result.freePoolPriority || result.freePoolPriority.length < def.freePoolPriority.length) {
      result.freePoolPriority = def.freePoolPriority;
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
  DEFAULT_CONFIG,
  FCC_FREE_POOL_PRIORITY
};

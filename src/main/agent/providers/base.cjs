/**
 * Eyqa Base Provider Definitions & Tool Schemas
 * Full suite of Eyqa native agent tools:
 * - Web search & HTTP fetch
 * - Chromium agentic browser navigation, action, and full page extraction
 * - Sandboxed workspace listing, reading, and full writing
 * - Precision surgical code editing (replace_file_content) and sliced viewer (view_file)
 * - Process execution (run_command) and background task management (manage_task)
 * - Image generation (generate_image via Pollinations Flux & OpenAI DALL-E 3)
 * - Human-in-the-loop decision modals (ask_question)
 * - Subagent swarm delegation (invoke_subagent)
 * - Background task scheduler & timers (schedule)
 */

const WEB_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the live web using DuckDuckGo to find real-time information, news, documentation, or facts.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search keywords or query.'
          },
          maxResults: {
            type: 'integer',
            description: 'Maximum number of results to retrieve (default: 5).'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch and extract clean readable text from a specific public webpage URL.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The full HTTP or HTTPS URL to read.'
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: 'Navigate the headless Chromium browser to any web page URL and wait for DOM and network idle.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The full HTTP or HTTPS URL to load.'
          },
          timeoutMs: {
            type: 'integer',
            description: 'Optional navigation timeout in milliseconds (default: 20000).'
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_action',
      description: 'Interact with the currently loaded webpage: click elements, type into inputs, scroll the viewport, execute JavaScript, or capture screenshots.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['click', 'type', 'scroll', 'evaluate', 'screenshot'],
            description: 'The browser interaction to execute.'
          },
          selector: {
            type: 'string',
            description: 'CSS selector of the target element (required for "click" and "type").'
          },
          text: {
            type: 'string',
            description: 'The text to type into the target element (required for "type").'
          },
          script: {
            type: 'string',
            description: 'JavaScript code snippet to execute on the page (required for "evaluate").'
          },
          scrollDeltaY: {
            type: 'integer',
            description: 'Number of vertical pixels to scroll (positive for down, negative for up; default: 500).'
          }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_browser_page',
      description: 'Load a web page inside Chromium, execute client-side JavaScript/SPAs, and return readable markdown, interactive form controls, and an optional high-resolution screenshot.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to navigate to and inspect (optional if already on the desired page).'
          },
          extractMarkdown: {
            type: 'boolean',
            description: 'Whether to convert page DOM into clean markdown (default: true).'
          },
          takeScreenshot: {
            type: 'boolean',
            description: 'Whether to capture an offscreen visual screenshot (default: true).'
          },
          maxChars: {
            type: 'integer',
            description: 'Maximum characters of text to return (default: 20000).'
          }
        }
      }
    }
  }
];

const WORKSPACE_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'workspace_list',
      description: 'List files and directories inside the active project folder.',
      parameters: {
        type: 'object',
        properties: {
          subDirectory: {
            type: 'string',
            description: 'Optional subfolder inside the project folder to inspect (leave empty for root).'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'workspace_read_file',
      description: 'Read the complete contents of a text file inside the active project folder.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Relative path of the file to read.'
          }
        },
        required: ['filePath']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'workspace_write_file',
      description: 'Create or completely overwrite a file inside the active project folder.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Relative path where the file should be saved.'
          },
          content: {
            type: 'string',
            description: 'The complete file contents to write.'
          }
        },
        required: ['filePath', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'replace_file_content',
      description: 'Precision search-and-replace for file content without rewriting the whole file. Validates unique occurrence within the range or entire file, produces a unified diff, and automatically generates a timestamped revertible snapshot in .eyqa/snapshots.',
      parameters: {
        type: 'object',
        properties: {
          TargetFile: {
            type: 'string',
            description: 'Relative path of the target file in the project workspace.'
          },
          TargetContent: {
            type: 'string',
            description: 'The exact string snippet to be replaced. Must match indentation, whitespace, and newlines exactly.'
          },
          ReplacementContent: {
            type: 'string',
            description: 'The new string snippet to replace TargetContent with.'
          },
          StartLine: {
            type: 'integer',
            description: 'Optional 1-indexed start line to restrict the search region.'
          },
          EndLine: {
            type: 'integer',
            description: 'Optional 1-indexed end line to restrict the search region.'
          },
          AllowMultiple: {
            type: 'boolean',
            description: 'Set to true only if all identical occurrences in the file or range should be replaced. Defaults to false.'
          }
        },
        required: ['TargetFile', 'TargetContent', 'ReplacementContent']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'view_file',
      description: 'Read and inspect file contents with line slicing, byte offset pagination for large files, and automatic image/media detection with base64 data URIs.',
      parameters: {
        type: 'object',
        properties: {
          AbsolutePath: {
            type: 'string',
            description: 'Relative or absolute path of the file to view within the workspace.'
          },
          StartLine: {
            type: 'integer',
            description: 'Optional 1-indexed start line to slice file output.'
          },
          EndLine: {
            type: 'integer',
            description: 'Optional 1-indexed end line to slice file output.'
          },
          ContentOffset: {
            type: 'integer',
            description: 'Optional byte offset to paginate through large files.'
          }
        },
        required: ['AbsolutePath']
      }
    }
  }
];

const TERMINAL_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a terminal command directly in the active project workspace. Supports synchronous build/test/lint commands, git inspections, package installation, and long-running background daemons (e.g., dev servers, watchers).',
      parameters: {
        type: 'object',
        properties: {
          CommandLine: {
            type: 'string',
            description: 'The exact command-line string to execute in the system shell.'
          },
          Cwd: {
            type: 'string',
            description: 'Optional current working directory for command execution. Defaults to the active project root directory.'
          },
          IsDaemon: {
            type: 'boolean',
            description: 'Set to true for long-running processes (e.g. dev servers, watch processes, file watchers) that should continue running in the background. Leave false (default) for standard commands expected to finish.'
          },
          WaitMsBeforeAsync: {
            type: 'integer',
            description: 'Number of milliseconds to wait synchronously for output before transitioning to a background task (default: 30000ms for commands, 1500ms for daemons). Maximum: 60000ms.'
          }
        },
        required: ['CommandLine']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_task',
      description: 'Inspect, manage, or terminate running background processes and daemons initiated via run_command.',
      parameters: {
        type: 'object',
        properties: {
          Action: {
            type: 'string',
            enum: ['list', 'status', 'kill', 'send_input'],
            description: 'The management operation to perform: "list" (show all tasks), "status" (inspect task status and recent logs), "kill" (gracefully terminate task), or "send_input" (pipe interactive text to stdin).'
          },
          TaskId: {
            type: 'string',
            description: 'The unique Task ID returned by run_command. Required for "status", "kill", and "send_input".'
          },
          Input: {
            type: 'string',
            description: 'The text input to pipe into the stdin of the running task. Required when Action is "send_input".'
          }
        },
        required: ['Action']
      }
    }
  }
];

const IMAGE_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate high-resolution visual art, mockups, or diagrams from text prompts using Free Pollinations Flux (zero keys required) or OpenAI DALL-E 3.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of the image to create.'
          },
          imageName: {
            type: 'string',
            description: 'Short file name identifier (e.g. "hero_landing", "logo_minimal").'
          },
          size: {
            type: 'string',
            enum: ['1024x1024', '1024x1792', '1792x1024', '512x512'],
            description: 'Resolution of generated image (default: 1024x1024).'
          },
          style: {
            type: 'string',
            enum: ['natural', 'vivid', 'photorealistic', 'anime', '3d'],
            description: 'Visual artistic style.'
          }
        },
        required: ['prompt']
      }
    }
  }
];

const INTERACTIVE_DECISION_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'ask_question',
      description: 'Present an interactive decision card with selectable option buttons and write-in feedback to the user, pausing until they submit their choice.',
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description: 'List of decisions/questions to pose to the user.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique question key (e.g. "arch_choice")' },
                question: { type: 'string', description: 'The question prompt text' },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of choices the user can click'
                },
                is_multi_select: {
                  type: 'boolean',
                  description: 'Whether multiple options can be checked (default false)'
                },
                allow_custom: {
                  type: 'boolean',
                  description: 'Whether to provide a write-in input field (default true)'
                }
              },
              required: ['question', 'options']
            }
          }
        },
        required: ['questions']
      }
    }
  }
];

const SUBAGENT_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'invoke_subagent',
      description: 'Spawn one or more specialized background worker subagents (e.g. researcher, code_auditor, designer) with targeted instructions and receive structured findings.',
      parameters: {
        type: 'object',
        properties: {
          Subagents: {
            type: 'array',
            description: 'List of subagent workers to instantiate and run in parallel.',
            items: {
              type: 'object',
              properties: {
                Role: {
                  type: 'string',
                  enum: ['researcher', 'code_auditor', 'designer', 'tester', 'analyst'],
                  description: 'Specialized role for this subagent.'
                },
                TypeName: {
                  type: 'string',
                  description: 'Human-readable title (e.g. "Security Audit Specialist")'
                },
                Prompt: {
                  type: 'string',
                  description: 'Detailed instructions and task assignment for the subagent.'
                }
              },
              required: ['Role', 'Prompt']
            }
          }
        },
        required: ['Subagents']
      }
    }
  }
];

const SCHEDULE_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'schedule',
      description: 'Schedule a one-shot countdown timer or recurring cron job in the background.',
      parameters: {
        type: 'object',
        properties: {
          DurationSeconds: {
            type: 'integer',
            description: 'Seconds to wait before triggering (for one-shot reminders).'
          },
          CronExpression: {
            type: 'string',
            description: '5-field cron expression for recurring tasks (e.g. "*/5 * * * *").'
          },
          Prompt: {
            type: 'string',
            description: 'The notification message or agent prompt to trigger.'
          },
          IsDaemon: {
            type: 'boolean',
            description: 'Whether the schedule runs independently as a background daemon.'
          }
        },
        required: ['Prompt']
      }
    }
  }
];

// Unified TOOL_SCHEMAS
const TOOL_SCHEMAS = [
  ...WEB_TOOL_SCHEMAS,
  ...WORKSPACE_TOOL_SCHEMAS,
  ...TERMINAL_TOOL_SCHEMAS,
  ...IMAGE_TOOL_SCHEMAS,
  ...INTERACTIVE_DECISION_SCHEMAS,
  ...SUBAGENT_SCHEMAS,
  ...SCHEDULE_SCHEMAS
];

// Gemini function declaration format
const GEMINI_FUNCTION_DECLARATIONS = TOOL_SCHEMAS.map(tool => ({
  name: tool.function.name,
  description: tool.function.description,
  parameters: tool.function.parameters
}));

// Anthropic tool definition format
const ANTHROPIC_TOOL_DEFINITIONS = TOOL_SCHEMAS.map(tool => ({
  name: tool.function.name,
  description: tool.function.description,
  input_schema: tool.function.parameters
}));

module.exports = {
  WEB_TOOL_SCHEMAS,
  WORKSPACE_TOOL_SCHEMAS,
  TERMINAL_TOOL_SCHEMAS,
  IMAGE_TOOL_SCHEMAS,
  INTERACTIVE_DECISION_SCHEMAS,
  SUBAGENT_SCHEMAS,
  SCHEDULE_SCHEMAS,
  TOOL_SCHEMAS,
  GEMINI_FUNCTION_DECLARATIONS,
  ANTHROPIC_TOOL_DEFINITIONS
};

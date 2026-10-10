/**
 * Eyqa Base Provider Definitions & Tool Schemas
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
      description: 'Read the contents of a text file inside the active project folder.',
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
      description: 'Create or overwrite a file inside the active project folder.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Relative path where the file should be saved.'
          },
          content: {
            type: 'string',
            description: 'The file contents to write.'
          }
        },
        required: ['filePath', 'content']
      }
    }
  }
];

const TOOL_SCHEMAS = [...WEB_TOOL_SCHEMAS, ...WORKSPACE_TOOL_SCHEMAS];

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
  TOOL_SCHEMAS,
  GEMINI_FUNCTION_DECLARATIONS,
  ANTHROPIC_TOOL_DEFINITIONS
};

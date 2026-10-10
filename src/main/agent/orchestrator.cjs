/**
 * Eyqa Agent Orchestrator
 * Coordinates multi-turn conversations, live tool execution loops,
 * streaming thought & content tokens, and error handling.
 */

const { WEB_TOOL_SCHEMAS, TOOL_SCHEMAS } = require('./providers/base.cjs');
const { searchWeb } = require('./tools/web-search.cjs');
const { fetchWebpage } = require('./tools/web-fetch.cjs');
const {
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile
} = require('./tools/workspace.cjs');

class AgentOrchestrator {
  constructor(providerManager, configStore) {
    this.providerManager = providerManager;
    this.configStore = configStore;
  }

  async runTurn({
    sessionId,
    messages,
    userMessage,
    folderPath = null,
    modeId = 'chat',
    providerId = null,
    enableTools = true,
    forceWebSearch = false,
    onToken,
    onThought,
    onToolStart,
    onToolResult,
    onFallback,
    signal
  }) {
    const config = this.configStore.get();
    const effectiveProviderId = providerId || config.activeProviderId || 'openrouter';

    // Mental Model: Pure Chat vs Folder Project
    const effectiveFolder = folderPath && folderPath.trim() ? folderPath.trim() : null;
    let systemPrompt = '';
    let customTools = WEB_TOOL_SCHEMAS;

    if (effectiveFolder) {
      systemPrompt = `You are Eyqa, an exceptionally capable, fast AI coworker assisting with files and projects.
You are working directly inside the local project directory: "${effectiveFolder}".
You have tools to list files, read code/docs, and create/update files in this directory.
When creating or modifying files, make sure your changes are clean and complete.`;
      customTools = TOOL_SCHEMAS;
    } else {
      systemPrompt = `You are Eyqa, an extraordinarily capable, fast, and helpful AI assistant built for everyday users.
You speak with clarity, intelligence, and natural human tone. Never use unnecessary AI fluff or patronizing language.
You have real-time web search tools to look up facts, documentation, current events, and live information when needed.`;
      customTools = WEB_TOOL_SCHEMAS;
    }

    if (forceWebSearch) {
      systemPrompt += '\n\nIMPORTANT: Web Grounding is active. You MUST call web_search to find up-to-date and verified information before answering.';
    }

    const conversationHistory = [...(messages || [])];
    if (userMessage && !conversationHistory.some(m => m.role === 'user' && m.content === userMessage)) {
      conversationHistory.push({ role: 'user', content: userMessage });
    }
    const MAX_TOOL_STEPS = 4;
    let toolStep = 0;

    let accumulatedContent = '';
    let accumulatedThought = '';
    const executedToolsLog = [];
    let usedProvider = null;

    while (toolStep < MAX_TOOL_STEPS) {
      if (signal?.aborted) break;

      const streamResult = await this.providerManager.streamWithFallback({
        preferredProviderId: effectiveProviderId,
        messages: conversationHistory,
        systemPrompt,
        enableTools,
        customTools,
        onToken: (tok) => {
          accumulatedContent += tok;
          if (onToken) onToken(tok);
        },
        onThought: (th) => {
          accumulatedThought += th;
          if (onThought) onThought(th);
        },
        onFallback,
        signal
      });

      usedProvider = streamResult.usedProvider;

      // Check if model called any tools
      const toolCalls = streamResult.toolCalls || [];

      if (toolCalls.length === 0) {
        // No tools requested; turn is complete!
        break;
      }

      toolStep++;

      // Record assistant's turn with tool calls in history
      conversationHistory.push({
        role: 'assistant',
        content: streamResult.content || '',
        tool_calls: toolCalls
      });

      // Execute each tool
      for (const call of toolCalls) {
        if (signal?.aborted) break;

        if (onToolStart) {
          onToolStart({
            id: call.id,
            name: call.name,
            arguments: call.arguments
          });
        }

        let output;
        try {
          output = await this._executeTool(call.name, call.arguments, effectiveFolder);
        } catch (err) {
          output = { error: err.message };
        }

        executedToolsLog.push({
          id: call.id,
          name: call.name,
          arguments: call.arguments,
          output
        });

        if (onToolResult) {
          onToolResult({
            id: call.id,
            name: call.name,
            arguments: call.arguments,
            output
          });
        }

        // Add tool result to conversation history
        conversationHistory.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: typeof output === 'string' ? output : JSON.stringify(output)
        });
      }

      // Next iteration will ask model to synthesize the tool results into an answer
    }

    return {
      content: accumulatedContent,
      thought: accumulatedThought,
      tools: executedToolsLog,
      provider: {
        id: usedProvider?.id,
        name: usedProvider?.name,
        model: usedProvider?.model
      }
    };
  }

  async _executeTool(name, args, workspacePath) {
    switch (name) {
      case 'web_search': {
        const query = args?.query || '';
        const limit = args?.maxResults || 5;
        return await searchWeb(query, limit);
      }

      case 'web_fetch': {
        const url = args?.url || '';
        return await fetchWebpage(url);
      }

      case 'workspace_list': {
        if (!workspacePath) return { error: 'No project folder linked to this chat. Link a folder to inspect files.' };
        const sub = args?.subDirectory || '';
        return listWorkspace(workspacePath, sub);
      }

      case 'workspace_read_file': {
        if (!workspacePath) return { error: 'No project folder linked to this chat. Link a folder to read files.' };
        const fp = args?.filePath || '';
        return readWorkspaceFile(workspacePath, fp);
      }

      case 'workspace_write_file': {
        if (!workspacePath) return { error: 'No project folder linked to this chat. Link a folder to save files.' };
        const fp = args?.filePath || '';
        const content = args?.content || '';
        return writeWorkspaceFile(workspacePath, fp, content);
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}

module.exports = {
  AgentOrchestrator
};

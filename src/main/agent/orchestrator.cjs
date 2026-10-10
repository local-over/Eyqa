/**
 * Eyqa Agent Orchestrator
 * Coordinates multi-turn conversations, live tool execution loops,
 * streaming thought & content tokens, and error handling.
 */

const { getSystemPrompt } = require('./prompts.cjs');
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
    modeId = 'coworker',
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
    const effectiveProviderId = providerId || config.activeProviderId || 'gemini';
    const workspace = config.workspacePath;

    let systemPrompt = getSystemPrompt(modeId, workspace);
    if (forceWebSearch) {
      systemPrompt += '\n\nIMPORTANT: The user has explicitly enabled Web Grounding for this request. You MUST perform a web search to provide up-to-date and verified information before answering.';
    }

    const conversationHistory = [...messages];
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
          output = await this._executeTool(call.name, call.arguments, workspace);
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
        const sub = args?.subDirectory || '';
        return listWorkspace(workspacePath, sub);
      }

      case 'workspace_read_file': {
        const fp = args?.filePath || '';
        return readWorkspaceFile(workspacePath, fp);
      }

      case 'workspace_write_file': {
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

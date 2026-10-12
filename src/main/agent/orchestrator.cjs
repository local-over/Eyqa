/**
 * Eyqa Agent Orchestrator
 * Coordinates multi-turn conversations, live tool execution loops,
 * streaming thought & content tokens, and error handling.
 * Supports full Eyqa Agent tool suite:
 * - Live web search & HTTP fetching
 * - Chromium agentic browser navigation, action, and full page extraction
 * - Sandboxed workspace listing, reading, and full writing
 * - Precision surgical code editing (replace_file_content) and sliced viewer (view_file)
 * - Process execution (run_command) and background task management (manage_task)
 * - Image generation (generate_image via Pollinations Flux & OpenAI DALL-E 3)
 * - Human-in-the-loop decision modals (ask_question)
 * - Subagent swarm delegation (invoke_subagent)
 * - Background task scheduler & timers (schedule)
 */

const fs = require('node:fs');
const path = require('node:path');
const { WEB_TOOL_SCHEMAS, TOOL_SCHEMAS } = require('./providers/base.cjs');
const { searchWeb } = require('./tools/web-search.cjs');
const { fetchWebpage } = require('./tools/web-fetch.cjs');
const { browserNavigate, browserAction, readBrowserPage } = require('./tools/browser.cjs');
const {
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile,
  replaceFileContent,
  viewFile,
  getProjectMemory
} = require('./tools/workspace.cjs');
const { runCommand, manageTask } = require('./tools/terminal.cjs');
const { generateImage } = require('./tools/image-gen.cjs');

class AgentOrchestrator {
  constructor(providerManager, configStore) {
    this.providerManager = providerManager;
    this.configStore = configStore;
    this.pendingQuestions = new Map(); // questionId -> { resolve, reject }
    this.activeSchedules = new Map();  // scheduleId -> timer / cron interval
  }

  /**
   * Resumes a paused turn when the user submits an interactive decision answer
   */
  resolveQuestion(questionId, answers) {
    if (this.pendingQuestions.has(questionId)) {
      const { resolve } = this.pendingQuestions.get(questionId);
      this.pendingQuestions.delete(questionId);
      resolve(answers);
      return true;
    }
    return false;
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
    customPrompt = null,
    onToken,
    onThought,
    onToolStart,
    onToolResult,
    onAskQuestion,
    onFallback,
    signal
  }) {
    const config = this.configStore.get();
    const effectiveProviderId = providerId || config.activeProviderId || 'groq';
    const effectiveFolder = folderPath && folderPath.trim() ? folderPath.trim() : null;

    let systemPrompt = '';
    let customTools = TOOL_SCHEMAS;

    if (effectiveFolder) {
      systemPrompt = `You are Eyqa, an exceptionally capable, fast AI coworker assisting with files, codebases, and projects.
You are working directly inside the local project directory: "${effectiveFolder}".

You have a complete suite of specialized tools:
- workspace_list, workspace_read_file, workspace_write_file: Basic file operations.
- replace_file_content: Surgical precision search-and-replace for code changes without rewriting entire files. Creates automatic versioned snapshots.
- view_file: View lines or chunks with line numbers, byte offsets, or inspect images/media.
- run_command: Run terminal commands (e.g. tests, linters, git status, builds, package managers). For servers/watchers, set IsDaemon: true.
- manage_task: Inspect or terminate background tasks started with run_command.
- browser_navigate, browser_action, read_browser_page: Browse live websites with Chromium, execute JavaScript, click, fill forms, and take screenshots.
- generate_image: Create images using Free Pollinations Flux (zero keys needed) or OpenAI DALL-E 3.
- ask_question: If requirements are ambiguous or you need the user to make an architectural choice, ask them via an interactive decision modal.
- invoke_subagent: Spawn specialized subagents (researcher, code_auditor, designer) in parallel.
- schedule: Set one-shot timers or recurring cron triggers.`;

      const mem = getProjectMemory(effectiveFolder);
      if (mem && (mem.notes || mem.architecture)) {
        systemPrompt += `\n\n[Project Shared Memory & Architecture Notes]:\n`;
        if (mem.architecture) systemPrompt += `Architecture: ${mem.architecture}\n`;
        if (mem.notes) systemPrompt += `Notes: ${mem.notes}\n`;
      }
    } else {
      systemPrompt = `You are Eyqa, an extraordinarily capable, fast, and helpful AI coworker built for everyday users.
You speak with clarity, intelligence, and natural human tone. Never use unnecessary AI fluff or patronizing language.
You have real-time web search tools, an offscreen Chromium browser, image generation tools (Pollinations Flux & OpenAI DALL-E 3), interactive decision modals (ask_question), and subagent swarm delegation.`;
    }

    if (forceWebSearch) {
      systemPrompt += '\n\nIMPORTANT: Web Grounding is active. You MUST call web_search or read_browser_page to find verified live information before answering.';
    }

    if (customPrompt && customPrompt.trim()) {
      systemPrompt += `\n\nProject Instructions & Guidelines:\n${customPrompt.trim()}`;
    }

    systemPrompt += `\n\n[Interactive Visuals, HTML & Widgets]:
When asked to create an interactive widget, UI mockup, chart, diagram, quiz, calculator, game, or rich visual component:
Output the complete, self-contained HTML/CSS/JavaScript inside a \`\`\`widget (or \`\`\`html) code block. Eyqa renders this directly inline in the chat as an interactive live sandbox component with live preview and code inspection.`;

    const conversationHistory = [...(messages || [])];
    if (userMessage && !conversationHistory.some(m => m.role === 'user' && m.content === userMessage)) {
      conversationHistory.push({ role: 'user', content: userMessage });
    }

    const MAX_TOOL_STEPS = 10;
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
      const toolCalls = streamResult.toolCalls || [];

      if (toolCalls.length === 0) {
        break;
      }

      toolStep++;

      conversationHistory.push({
        role: 'assistant',
        content: streamResult.content || '',
        tool_calls: toolCalls
      });

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
          output = await this._executeTool(call.name, call.arguments, {
            workspacePath: effectiveFolder,
            sessionId,
            signal,
            onAskQuestion
          });
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

        conversationHistory.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: typeof output === 'string' ? output : JSON.stringify(output)
        });
      }
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

  async _executeTool(name, args, ctx) {
    const { workspacePath, sessionId, signal, onAskQuestion } = ctx;

    switch (name) {
      // 1. Web & Browser Tools
      case 'web_search': {
        const query = args?.query || '';
        const limit = args?.maxResults || 5;
        return await searchWeb(query, limit);
      }

      case 'web_fetch': {
        const url = args?.url || '';
        return await fetchWebpage(url);
      }

      case 'browser_navigate': {
        return await browserNavigate({
          url: args?.url,
          timeoutMs: args?.timeoutMs || 20000
        });
      }

      case 'browser_action': {
        return await browserAction({
          action: args?.action,
          selector: args?.selector,
          text: args?.text,
          script: args?.script,
          scrollDeltaY: args?.scrollDeltaY
        });
      }

      case 'read_browser_page': {
        return await readBrowserPage({
          url: args?.url,
          extractMarkdown: args?.extractMarkdown !== false,
          takeScreenshot: args?.takeScreenshot !== false,
          maxChars: args?.maxChars || 20000
        });
      }

      // 2. Workspace File Tools
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

      case 'replace_file_content': {
        if (!workspacePath) return { error: 'No project folder linked to this chat. Link a folder to edit files.' };
        return replaceFileContent(workspacePath, {
          TargetFile: args?.TargetFile || args?.filePath,
          TargetContent: args?.TargetContent || args?.oldContent,
          ReplacementContent: args?.ReplacementContent || args?.newContent,
          StartLine: args?.StartLine,
          EndLine: args?.EndLine,
          AllowMultiple: args?.AllowMultiple
        });
      }

      case 'view_file': {
        if (!workspacePath) return { error: 'No project folder linked to this chat. Link a folder to view files.' };
        return viewFile(workspacePath, {
          AbsolutePath: args?.AbsolutePath || args?.filePath,
          StartLine: args?.StartLine,
          EndLine: args?.EndLine,
          ContentOffset: args?.ContentOffset
        });
      }

      // 3. Terminal & Task Management
      case 'run_command': {
        return await runCommand({
          CommandLine: args?.CommandLine,
          Cwd: args?.Cwd,
          IsDaemon: Boolean(args?.IsDaemon),
          WaitMsBeforeAsync: args?.WaitMsBeforeAsync,
          workspaceRoot: workspacePath
        });
      }

      case 'manage_task': {
        return await manageTask({
          Action: args?.Action,
          TaskId: args?.TaskId,
          Input: args?.Input
        });
      }

      // 4. Image Generation
      case 'generate_image': {
        return await generateImage({
          prompt: args?.prompt,
          imageName: args?.imageName,
          size: args?.size || '1024x1024',
          style: args?.style || 'natural',
          configStore: this.configStore,
          workspacePath
        });
      }

      // 5. Human-in-the-loop Interactive Questions
      case 'ask_question': {
        const questions = args?.questions || [];
        if (questions.length === 0) return { error: 'No questions provided.' };

        const questionId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        return new Promise((resolve, reject) => {
          const onAbort = () => {
            this.pendingQuestions.delete(questionId);
            reject(new Error('Question cancelled by user abort.'));
          };

          if (signal) signal.addEventListener('abort', onAbort, { once: true });

          this.pendingQuestions.set(questionId, {
            resolve: (answers) => {
              if (signal) signal.removeEventListener('abort', onAbort);
              resolve({
                status: 'answered',
                questionId,
                answers
              });
            },
            reject
          });

          if (onAskQuestion) {
            onAskQuestion({
              questionId,
              questions
            });
          }
        });
      }

      // 6. Subagent Swarms
      case 'invoke_subagent': {
        const subagents = args?.Subagents || [];
        if (subagents.length === 0) return { error: 'No Subagents specified.' };

        const results = await Promise.all(
          subagents.map(async (sa) => {
            const startTime = Date.now();
            try {
              const subPrompt = `[Subagent: ${sa.Role} - ${sa.TypeName || sa.Role}]\n${sa.Prompt}`;
              const subResult = await this.providerManager.streamWithFallback({
                preferredProviderId: this.configStore.get().activeProviderId || 'groq',
                messages: [{ role: 'user', content: subPrompt }],
                systemPrompt: `You are an elite, specialized ${sa.Role} subagent for Eyqa. Provide exhaustive, rigorous, un-truncated findings.`,
                enableTools: false,
                signal
              });

              return {
                role: sa.Role,
                typeName: sa.TypeName || sa.Role,
                status: 'completed',
                findings: subResult.content,
                executionTimeMs: Date.now() - startTime
              };
            } catch (err) {
              return {
                role: sa.Role,
                typeName: sa.TypeName || sa.Role,
                status: 'error',
                error: err.message,
                executionTimeMs: Date.now() - startTime
              };
            }
          })
        );

        return {
          subagentsCount: results.length,
          results
        };
      }

      // 7. Background Scheduler
      case 'schedule': {
        const duration = args?.DurationSeconds;
        const cron = args?.CronExpression;
        const prompt = args?.Prompt;
        const id = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        if (duration && duration > 0) {
          const timeout = setTimeout(() => {
            console.log(`[Scheduler] Timer fired (${id}):`, prompt);
            this.activeSchedules.delete(id);
          }, duration * 1000);

          this.activeSchedules.set(id, { type: 'timer', timeout, prompt });

          return {
            scheduled: true,
            scheduleId: id,
            type: 'one_shot_timer',
            firesInSeconds: duration,
            prompt
          };
        }

        if (cron) {
          return {
            scheduled: true,
            scheduleId: id,
            type: 'recurring_cron',
            cronExpression: cron,
            prompt
          };
        }

        return { error: 'Provide either DurationSeconds or CronExpression.' };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}

module.exports = {
  AgentOrchestrator
};

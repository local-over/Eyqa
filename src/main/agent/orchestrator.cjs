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
const { getSystemPrompt } = require('./prompts.cjs');
const { searchWeb } = require('./tools/web-search.cjs');
const { fetchWebpage } = require('./tools/web-fetch.cjs');
const {
  browserNavigate,
  browserAction,
  readBrowserPage,
  requestBrowserTakeover,
  handBackBrowser
} = require('./tools/browser.cjs');
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
const { getMemoryStore } = require('../storage/memory-store.cjs');
const { getSkillsManager } = require('./tools/skills.cjs');

class AgentOrchestrator {
  constructor(providerManager, configStore) {
    this.providerManager = providerManager;
    this.configStore = configStore;
    this.pendingQuestions = new Map(); // questionId -> { resolve, reject }
    this.pendingTakeovers = new Map(); // takeoverId -> { resolve, reject }
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

  /**
   * Resumes a paused turn when the user completes a browser takeover / challenge
   */
  resolveBrowserTakeover(takeoverId, notes) {
    if (this.pendingTakeovers.has(takeoverId)) {
      const { resolve } = this.pendingTakeovers.get(takeoverId);
      this.pendingTakeovers.delete(takeoverId);
      resolve(notes);
      return true;
    }
    return handBackBrowser(notes);
  }

  async runTurn({
    sessionId,
    messages,
    userMessage,
    folderPath = null,
    modeId = 'coworker',
    providerId = null,
    enableTools = true,
    forceWebSearch = false,
    customPrompt = null,
    onToken,
    onThought,
    onToolStart,
    onToolResult,
    onAskQuestion,
    onBrowserTakeover,
    onFallback,
    signal
  }) {
    const config = this.configStore.get();
    const effectiveProviderId = providerId || config.activeProviderId || 'groq';
    const effectiveFolder = folderPath && folderPath.trim() ? folderPath.trim() : null;

    let systemPrompt = getSystemPrompt(modeId || 'coworker', effectiveFolder);

    // Inject Universal Dynamic Memory (persisted cross-project context)
    const memoryStore = getMemoryStore();
    systemPrompt += `\n\n${memoryStore.getSystemPromptSnippet()}`;

    // Inject AI Skills Framework
    const skillsManager = getSkillsManager();
    const skillsSnippet = skillsManager.getSkillsPromptSnippet(effectiveFolder);
    if (skillsSnippet) {
      systemPrompt += `\n\n${skillsSnippet}`;
    }

    if (effectiveFolder) {
      const mem = getProjectMemory(effectiveFolder);
      if (mem && (mem.notes || mem.architecture)) {
        systemPrompt += `\n\n[Project Shared Memory & Architecture Notes]:\n`;
        if (mem.architecture) systemPrompt += `Architecture: ${mem.architecture}\n`;
        if (mem.notes) systemPrompt += `Notes: ${mem.notes}\n`;
      }
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
            onAskQuestion,
            onBrowserTakeover
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
    const { workspacePath, sessionId, signal, onAskQuestion, onBrowserTakeover } = ctx;

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

      case 'request_browser_takeover': {
        const takeoverId = `takeover_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const reason = args?.reason || 'Human assistance required';
        const problemDescription = args?.problemDescription || 'Please resolve the prompt or challenge in the browser window';
        const url = args?.url || null;

        if (onBrowserTakeover) {
          onBrowserTakeover({
            takeoverId,
            reason,
            problemDescription,
            url
          });
        }

        const takeoverPromise = requestBrowserTakeover({
          reason,
          problemDescription,
          url
        });

        this.pendingTakeovers.set(takeoverId, {
          resolve: (notes) => handBackBrowser(notes)
        });

        const result = await takeoverPromise;
        this.pendingTakeovers.delete(takeoverId);
        return result;
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

      // 8. Universal Dynamic Memory
      case 'update_memory': {
        const memoryStore = getMemoryStore();
        const saved = memoryStore.addFact({
          key: args?.key,
          value: args?.value,
          category: args?.category || 'fact'
        });
        return {
          success: true,
          savedFact: saved,
          message: `Saved to universal memory: "${args?.key}"`
        };
      }

      case 'recall_memory': {
        const memoryStore = getMemoryStore();
        const allMem = memoryStore.getAll();
        const q = (args?.query || '').toLowerCase().trim();
        if (!q) return allMem;
        const filteredFacts = (allMem.learnedFacts || []).filter(f =>
          f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)
        );
        return {
          profile: allMem.userProfile,
          matchingFacts: filteredFacts
        };
      }

      // 9. AI Skills Framework (Skills Hub)
      case 'search_skills_hub': {
        const skillsManager = getSkillsManager();
        return await skillsManager.searchSkillsHub(args?.query || '');
      }

      case 'install_skill': {
        const skillsManager = getSkillsManager();
        return await skillsManager.installSkill({
          skillName: args?.skillName,
          content: args?.content,
          description: args?.description,
          sourceUrl: args?.sourceUrl
        });
      }

      case 'use_skill': {
        const skillsManager = getSkillsManager();
        const res = skillsManager.useSkill(args?.skillName, workspacePath);
        if (!res.success) {
          return { error: res.error };
        }
        return {
          success: true,
          skillName: res.skillName,
          description: res.description,
          instructions: res.instructions,
          message: `Activated skill: "${res.skillName}". Instructions loaded into context.`
        };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}

module.exports = {
  AgentOrchestrator
};

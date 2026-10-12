/**
 * Eyqa Chat View
 * Pure monochromatic message flow (ChatGPT & Claude style).
 * Renders interleaved thought accordions, inline tool status badges,
 * and clean copy actions with zero intrusive sliding drawers.
 */

import { api } from './api.js';
import { icons } from './icons.js';
import { renderMarkdown } from './markdown-renderer.js';
import { mascotAnimator } from './mascot-animator.js';

export class ChatView {
  constructor(containerEl, onNotification) {
    this.container = containerEl;
    this.onNotification = onNotification;
    this.currentSession = null;
    this.streamingAssistantEl = null;
    this.streamingProcessWrapper = null;
    this.streamingProcessBody = null;
    this.streamingThoughtStep = null;
    this.streamingToolsList = null;
    this.streamingContentEl = null;
    this.accumulatedContent = '';
    this.accumulatedThought = '';
    this.isStreaming = false;
    this._processHasAutoFolded = false;
    this._activeDecisionSummary = '';
    this._stepCount = 0;
  }

  setSession(session) {
    this.currentSession = session;
    this.render();
  }

  clear() {
    if (this.currentSession) {
      this.currentSession.messages = [];
    }
    this.render();
  }

  addMessage(msg) {
    if (!this.currentSession) {
      this.currentSession = { id: 'chat_temp', messages: [] };
    }
    if (!this.currentSession.messages) {
      this.currentSession.messages = [];
    }
    this.currentSession.messages.push(msg);
    this.render();
  }

  render() {
    if (!this.currentSession || !this.currentSession.messages || this.currentSession.messages.length === 0) {
      this._renderWelcomeHero();
      return;
    }

    this.container.innerHTML = `
      <div class="chat-messages-scroll" id="chatMessagesScroll">
        <div class="chat-messages-list">
          ${this.currentSession.messages.map((m, idx) => this._renderMessage(m, idx)).join('')}
        </div>
      </div>
    `;

    this._attachMessageEvents();
    this.setupScrollListener();
    this.scrollToBottom();
  }

  _renderWelcomeHero() {
    const hasFolder = Boolean(this.currentSession?.folderPath);
    const folderName = this.currentSession?.folderName || 'Project Folder';
    const folderPath = this.currentSession?.folderPath || '';

    const categories = hasFolder ? [
      { id: 'all', label: 'All Suggestions' },
      { id: 'code', label: 'Code & Structure' },
      { id: 'research', label: 'Live Research' },
      { id: 'docs', label: 'Documentation' }
    ] : [
      { id: 'all', label: 'All Suggestions' },
      { id: 'code', label: 'Code & Automate' },
      { id: 'research', label: 'Live Research' },
      { id: 'write', label: 'Writing & Analysis' }
    ];

    const cards = hasFolder ? [
      {
        cat: 'code',
        icon: icons.folder,
        title: 'Project Structure',
        desc: 'Inspect and outline all files and directories in this folder.',
        prompt: 'Summarize the structure of this project folder and outline what files and directories exist.'
      },
      {
        cat: 'research',
        icon: icons.globe,
        title: 'Live Web Research',
        desc: 'Verify packages, documentation, and industry standards online.',
        prompt: 'Search the web and compare the tech stack or implementation in this project with modern 2026 best practices.'
      },
      {
        cat: 'code',
        icon: icons.code,
        title: 'Code Audit & Cleanup',
        desc: 'Find bugs, clean up scripts, and propose concrete improvements.',
        prompt: 'Review the code files in this project and identify areas for optimization, security, or cleanup.'
      },
      {
        cat: 'docs',
        icon: icons.briefcase,
        title: 'Write Project Docs',
        desc: 'Generate clear, step-by-step documentation for this folder.',
        prompt: 'Draft complete documentation and a README guide for this project folder.'
      }
    ] : [
      {
        cat: 'write',
        icon: icons.briefcase,
        title: 'Draft a Proposal or Plan',
        desc: 'Create clean, professional proposals, emails, or plans.',
        prompt: 'Draft a clear, executive-ready proposal with objectives, milestones, and deliverables.'
      },
      {
        cat: 'research',
        icon: icons.globe,
        title: 'Deep Live Web Research',
        desc: 'Explore real-time internet news, market reports, and facts.',
        prompt: 'Search the web for the latest artificial intelligence developments in 2026 and summarize key breakthroughs with sources.'
      },
      {
        cat: 'write',
        icon: icons.sparkles,
        title: 'Explain & Brainstorm',
        desc: 'Break down difficult concepts into plain, accessible insights.',
        prompt: 'Explain a complex topic in simple, intuitive terms with practical examples.'
      },
      {
        cat: 'code',
        icon: icons.code,
        title: 'Code & Automate',
        desc: 'Generate clean scripts, fix errors, or automate tasks.',
        prompt: 'Write a clean automation script and explain step-by-step how to run it.'
      }
    ];

    this.container.innerHTML = `
      <div class="welcome-hero-container">
        <div class="welcome-mascot-box">
          <img src="assets/frames/eyqa_close.png" alt="Eyqa" class="welcome-mascot-img animated-mascot" id="heroMascotImg" />
        </div>
        <h2 class="welcome-hero-title">What can Eyqa help with today?</h2>
        <p class="welcome-hero-subtitle">
          ${hasFolder 
            ? `Working inside <strong>${this._escape(folderName)}</strong> (<span style="font-family: var(--font-mono); font-size: 11px;">${this._escape(folderPath)}</span>). Eyqa can read, write, and explore files here.` 
            : 'Your everyday AI coworker. Clean, fast, and grounded with live web search.'}
        </p>

        <div class="welcome-categories-bar">
          ${categories.map((c, i) => `
            <button class="welcome-cat-pill ${i === 0 ? 'active' : ''}" data-cat="${c.id}">
              ${c.label}
            </button>
          `).join('')}
        </div>

        <div class="starter-cards-grid" id="welcomeCardsGrid">
          ${cards.map(c => `
            <div class="starter-card" data-cat="${c.cat}" data-prompt="${this._escape(c.prompt)}">
              <span class="starter-icon">${c.icon}</span>
              <div class="starter-card-body">
                <strong>${c.title}</strong>
                <p>${c.desc}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Category filter interactions
    this.container.querySelectorAll('.welcome-cat-pill').forEach(pill => {
      pill.onclick = (e) => {
        const cat = e.currentTarget.dataset.cat;
        this.container.querySelectorAll('.welcome-cat-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');

        this.container.querySelectorAll('.starter-card').forEach(card => {
          if (cat === 'all' || card.dataset.cat === cat) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      };
    });

    // Card click: animate into textarea and focus
    this.container.querySelectorAll('.starter-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        const input = document.getElementById('chatInputTextarea');
        if (input) {
          input.value = prompt;
          input.focus();
          input.style.height = 'auto';
          input.style.height = Math.max(38, Math.min(input.scrollHeight, 180)) + 'px';
          document.getElementById('btnSendMessage')?.classList.add('active');
        }
      });
    });
  }

  _renderMessage(msg, idx) {
    const timeStr = this._formatTime(msg.timestamp);

    if (msg.role === 'user') {
      return `
        <div class="message-row user-row" data-index="${idx}">
          <div class="message-bubble user-bubble">
            ${msg.attachment ? `
              <div class="attachment-pill">
                ${icons.attach} <span>${this._escape(msg.attachment.name)}</span>
              </div>
            ` : ''}
            <div class="message-text">${this._escape(msg.content).replace(/\n/g, '<br/>')}</div>
            <div class="user-bubble-actions">
              <button class="user-action-btn btn-copy-msg" data-content="${encodeURIComponent(msg.content)}" title="Copy prompt">
                ${icons.copy}
              </button>
              <button class="user-action-btn btn-edit-prompt" data-content="${encodeURIComponent(msg.content)}" title="Edit in message box">
                ${icons.edit}
              </button>
              ${timeStr ? `<span class="message-time-pill">${timeStr}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    if (msg.role === 'assistant') {
      const hasThought = Boolean(msg.thought && msg.thought.trim());
      const hasTools = Boolean(msg.tools && msg.tools.length > 0);
      const hasProcess = hasThought || hasTools;

      let decisionSummary = '';
      if (hasTools) {
        const questionTool = msg.tools.find(t => (t.name || t.tool) === 'ask_question');
        if (questionTool) {
          const answers = questionTool.output?.answers || questionTool.output;
          if (answers) {
            decisionSummary = typeof answers === 'object'
              ? Object.values(answers).map(v => Array.isArray(v) ? v.join(', ') : v).join(' | ')
              : String(answers);
          }
        }
      }

      const stepCount = (hasThought ? 1 : 0) + (hasTools ? msg.tools.length : 0);
      const summaryText = `${stepCount} ${stepCount === 1 ? 'action' : 'actions'}${decisionSummary ? ` • Decided: ${this._escape(decisionSummary)}` : ''}`;

      return `
        <div class="message-row assistant-row" data-index="${idx}">
          <div class="assistant-avatar-box">
            <img src="assets/frames/eyqa_close.png" alt="Eyqa" class="assistant-avatar-img animated-mascot" />
          </div>
          <div class="assistant-card">
            <div class="assistant-card-header">
              <div class="assistant-name">
                <span>eyqa</span>
              </div>
              ${msg.provider ? `
                <span class="assistant-provider-pill">${this._escape(msg.provider.name || '')}</span>
              ` : ''}
              ${timeStr ? `
                <span class="message-time-pill">${timeStr}</span>
              ` : ''}
            </div>

            ${hasProcess ? `
              <div class="turn-process-wrapper is-folded">
                <button class="turn-process-header" type="button" title="Click to view actions and decisions">
                  <div class="process-header-left">
                    <span class="process-chevron">${icons.chevronRight || ''}</span>
                    <span class="process-title">Process &amp; Actions</span>
                    <span class="process-summary-pill">${summaryText}</span>
                  </div>
                  <span class="process-status-tag status-completed">Completed</span>
                </button>
                <div class="turn-process-body" hidden>
                  ${hasThought ? `
                    <div class="process-step-item step-thought">
                      <div class="process-step-badge">
                        ${icons.brain} <span>Thinking Process</span>
                      </div>
                      <div class="process-step-content mono-text">${this._escape(msg.thought)}</div>
                    </div>
                  ` : ''}
                  ${hasTools ? msg.tools.map(t => this._renderToolStep(t)).join('') : ''}
                </div>
              </div>
            ` : ''}

            <div class="assistant-card-body md-body">
              ${renderMarkdown(msg.content)}
            </div>

            <div class="assistant-card-actions">
              <button class="msg-action-btn btn-copy-msg" data-content="${encodeURIComponent(msg.content)}" title="Copy message">
                ${icons.copy} <span>Copy</span>
              </button>
              <button class="msg-action-btn btn-retry-msg" data-index="${idx}" title="Regenerate this response">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  _renderToolStep(tool) {
    const toolName = tool.name || tool.tool || 'workspace';
    const isSearch = toolName === 'web_search';
    const isFetch = toolName === 'web_fetch';
    const isQuestion = toolName === 'ask_question';
    const isBrowser = toolName.startsWith('browser_') || toolName === 'read_browser_page';
    const isTerminal = toolName === 'run_command' || toolName === 'manage_task';
    const isCode = toolName === 'replace_file_content';
    const isFile = toolName === 'view_file' || toolName.startsWith('workspace_');
    const isImage = toolName === 'generate_image';
    
    if (isQuestion) {
      const answers = tool.output?.answers || tool.output;
      let choiceStr = '';
      if (answers) {
        choiceStr = typeof answers === 'object'
          ? Object.values(answers).map(v => Array.isArray(v) ? v.join(', ') : v).join(' | ')
          : String(answers);
      }
      const qText = tool.arguments?.questions?.[0]?.question || tool.arguments?.question || 'Interactive Decision';

      return `
        <div class="process-step-item step-decision confirmed">
          <div class="decision-step-badge">
            <span class="decision-step-icon">✓</span>
            <span class="decision-step-title">Decision Confirmed</span>
            ${choiceStr ? `<span class="decision-choice-pill" title="${this._escape(choiceStr)}">${this._escape(choiceStr)}</span>` : ''}
          </div>
          <div class="decision-step-details">
            <div class="decision-step-q">
              <span class="decision-step-label">Question</span>
              <span class="decision-step-val">${this._escape(qText)}</span>
            </div>
            ${choiceStr ? `
              <div class="decision-step-a">
                <span class="decision-step-label">Choice Confirmed</span>
                <span class="decision-step-val choice-highlight">${this._escape(choiceStr)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    const icon = (isSearch || isFetch || isBrowser) ? icons.globe
               : isTerminal ? (icons.terminal || icons.code)
               : isCode ? icons.code
               : isImage ? (icons.image || icons.sparkles)
               : isFile ? icons.folder
               : icons.sparkles;

    const target = tool.arguments?.query || tool.arguments?.filePath || tool.arguments?.CommandLine || tool.arguments?.TargetFile || tool.arguments?.AbsolutePath || tool.arguments?.url || tool.query || tool.target || '';
    
    let label = isSearch ? `Web Search: "${target}"`
              : isFetch ? `Web Fetch: ${target}`
              : isBrowser ? `Chromium: ${toolName} ${target}`
              : isTerminal ? `Terminal: ${target || tool.arguments?.Action || ''}`
              : isCode ? `Precision Edit: ${target}`
              : isFile ? `Workspace: ${toolName} (${target})`
              : isImage ? `Generate Image: "${(tool.arguments?.prompt || '').slice(0, 40)}..."`
              : `Tool: ${toolName}${target ? ` (${target})` : ''}`;

    let detailsHtml = '';
    if (tool.output?.diff) {
      detailsHtml = `<pre style="color: #38bdf8; margin: 4px 0 0 0;">${this._escape(tool.output.diff)}</pre>`;
    } else if (tool.output?.dataUrl) {
      detailsHtml = `<div style="margin-top:6px;"><img src="${tool.output.dataUrl}" style="max-width:100%; border-radius:6px; border:1px solid rgba(255,255,255,0.1);" /></div>`;
    }

    return `
      <div class="process-step-item step-tool">
        <div class="tool-step-header">
          <div class="tool-step-left">
            <span class="tool-step-icon">${icon}</span>
            <span class="tool-step-label">${this._escape(label)}</span>
          </div>
          <span class="process-status-tag status-completed">Completed</span>
        </div>
        ${detailsHtml ? `<div class="tool-step-details">${detailsHtml}</div>` : ''}
      </div>
    `;
  }

  startStream(userMessage = null) {
    this.isStreaming = true;
    this.accumulatedContent = '';
    this.accumulatedThought = '';
    this._processHasAutoFolded = false;
    this._activeDecisionSummary = '';
    this._stepCount = 0;

    let scrollEl = document.getElementById('chatMessagesScroll');
    if (!scrollEl) {
      this.container.innerHTML = `
        <div class="chat-messages-scroll" id="chatMessagesScroll">
          <div class="chat-messages-list"></div>
        </div>
      `;
      scrollEl = document.getElementById('chatMessagesScroll');
    }

    const listEl = scrollEl.querySelector('.chat-messages-list');
    if (userMessage) {
      const timeStr = this._formatTime(userMessage.timestamp || Date.now());
      const userRow = document.createElement('div');
      userRow.className = 'message-row user-row';
      userRow.innerHTML = `
        <div class="message-bubble user-bubble">
          ${userMessage.attachment ? `
            <div class="attachment-pill">
              ${icons.attach} <span>${this._escape(userMessage.attachment.name)}</span>
            </div>
          ` : ''}
          <div class="message-text">${this._escape(userMessage.content).replace(/\n/g, '<br/>')}</div>
          <div class="user-bubble-actions">
            <button class="user-action-btn btn-copy-msg" data-content="${encodeURIComponent(userMessage.content)}" title="Copy prompt">
              ${icons.copy}
            </button>
            <button class="user-action-btn btn-edit-prompt" data-content="${encodeURIComponent(userMessage.content)}" title="Edit in message box">
              ${icons.edit}
            </button>
            ${timeStr ? `<span class="message-time-pill">${timeStr}</span>` : ''}
          </div>
        </div>
      `;
      listEl.appendChild(userRow);
    }

    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant-row streaming';
    assistantRow.innerHTML = `
      <div class="assistant-avatar-box">
        <img src="assets/frames/eyqa_close.png" alt="Eyqa" class="assistant-avatar-img animated-mascot" />
      </div>
      <div class="assistant-card">
        <div class="assistant-card-header">
          <div class="assistant-name"><span>eyqa</span></div>
          <div class="streaming-pulse-indicator">
            <span class="streaming-wave-bars">
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
            </span>
            <span class="streaming-status-label">Eyqa is working...</span>
          </div>
        </div>

        <div class="turn-process-wrapper" id="streamProcessWrapper" hidden>
          <button class="turn-process-header" id="streamProcessHeader" type="button" title="Click to expand/fold actions">
            <div class="process-header-left">
              <span class="process-chevron">${icons.chevronDown || '▾'}</span>
              <span class="process-title">Process &amp; Actions</span>
              <span class="process-summary-pill" id="streamProcessSummary">Working...</span>
            </div>
            <span class="process-status-tag status-running" id="streamProcessStatus">Running...</span>
          </button>
          <div class="turn-process-body" id="streamProcessBody">
            <div class="process-step-item step-thought" id="streamThoughtStep" hidden>
              <div class="process-step-badge">
                ${icons.brain} <span>Thinking Process</span>
              </div>
              <div class="process-step-content mono-text" id="streamThoughtContent"></div>
            </div>
            <div class="stream-tools-list" id="streamToolsList"></div>
          </div>
        </div>

        <div class="assistant-card-body md-body" id="streamContentBox">
          <span class="typing-cursor"></span>
        </div>
      </div>
    `;
    listEl.appendChild(assistantRow);

    this.streamingAssistantEl = assistantRow;
    this.streamingProcessWrapper = assistantRow.querySelector('#streamProcessWrapper');
    this.streamingProcessBody = assistantRow.querySelector('#streamProcessBody');
    this.streamingThoughtStep = assistantRow.querySelector('#streamThoughtStep');
    this.streamingToolsList = assistantRow.querySelector('#streamToolsList');
    this.streamingContentEl = assistantRow.querySelector('#streamContentBox');

    // Attach stream header toggle
    const streamHeader = assistantRow.querySelector('#streamProcessHeader');
    if (streamHeader) {
      streamHeader.onclick = () => {
        if (!this.streamingProcessBody || !this.streamingProcessWrapper) return;
        const isHidden = this.streamingProcessBody.hidden;
        this.streamingProcessBody.hidden = !isHidden;
        this.streamingProcessWrapper.classList.toggle('is-folded', !isHidden);
        const chevron = streamHeader.querySelector('.process-chevron');
        if (chevron) {
          chevron.innerHTML = isHidden ? icons.chevronDown || '▾' : icons.chevronRight || '▸';
        }
      };
    }

    this.scrollToBottom();
  }

  _updateProcessHeaderSummary() {
    if (!this.streamingProcessWrapper) return;
    const summaryEl = this.streamingProcessWrapper.querySelector('#streamProcessSummary');
    if (!summaryEl) return;
    
    let totalActions = this._stepCount;
    if (this.accumulatedThought && this.accumulatedThought.trim()) {
      totalActions += 1;
    }
    
    let summaryText = `${totalActions} ${totalActions === 1 ? 'action' : 'actions'}`;
    if (this._activeDecisionSummary) {
      summaryText += ` • Decided: ${this._activeDecisionSummary}`;
    }
    summaryEl.textContent = summaryText;
  }

  appendThought(thought) {
    this.accumulatedThought += thought;
    if (this.streamingProcessWrapper && this.streamingThoughtStep) {
      this.streamingProcessWrapper.hidden = false;
      this.streamingThoughtStep.hidden = false;
      const contentEl = this.streamingThoughtStep.querySelector('#streamThoughtContent');
      if (contentEl) {
        contentEl.textContent = this.accumulatedThought;
      }
      this._updateProcessHeaderSummary();
      this.scrollToBottom();
    }
  }

  addToolBadge(toolInfo) {
    if (!this.streamingProcessWrapper || !this.streamingToolsList) return;
    this.streamingProcessWrapper.hidden = false;
    this._stepCount += 1;

    const toolName = toolInfo.name || 'tool';
    const isSearch = toolName === 'web_search';
    const isFetch = toolName === 'web_fetch';
    const isBrowser = toolName.startsWith('browser_') || toolName === 'read_browser_page';
    const isTerminal = toolName === 'run_command' || toolName === 'manage_task';
    const isCode = toolName === 'replace_file_content';
    const isFile = toolName === 'view_file' || toolName.startsWith('workspace_');
    const isImage = toolName === 'generate_image';
    const isQuestion = toolName === 'ask_question';

    const icon = (isSearch || isFetch || isBrowser) ? icons.globe
               : isTerminal ? (icons.terminal || icons.code)
               : isCode ? icons.code
               : isImage ? (icons.image || icons.sparkles)
               : isFile ? icons.folder
               : icons.sparkles;

    const target = toolInfo.arguments?.query || toolInfo.arguments?.filePath || toolInfo.arguments?.CommandLine || toolInfo.arguments?.TargetFile || toolInfo.arguments?.AbsolutePath || toolInfo.arguments?.url || '';

    let label = isSearch ? `Web Search: "${target}"`
              : isFetch ? `Web Fetch: ${target}`
              : isBrowser ? `Chromium: ${toolName}`
              : isTerminal ? `Terminal: ${target}`
              : isCode ? `Precision Edit: ${target}`
              : isFile ? `Workspace: ${toolName} (${target})`
              : isImage ? `Generate Image: "${(toolInfo.arguments?.prompt || '').slice(0, 40)}..."`
              : isQuestion ? `Interactive Decision Required`
              : `Tool: ${toolName}`;

    const stepEl = document.createElement('div');
    stepEl.className = 'process-step-item step-tool';
    stepEl.dataset.toolId = toolInfo.id || '';
    stepEl.innerHTML = `
      <div class="tool-step-header">
        <div class="tool-step-left">
          <span class="tool-step-icon">${icon}</span>
          <span class="tool-step-label">${this._escape(label)}</span>
        </div>
        <span class="process-status-tag status-running tool-status-pill">Running...</span>
      </div>
      <div class="tool-step-details" hidden>
        <pre>${this._escape(JSON.stringify(toolInfo.arguments, null, 2))}</pre>
      </div>
    `;

    this.streamingToolsList.appendChild(stepEl);
    this._updateProcessHeaderSummary();
    this.scrollToBottom();
  }

  updateToolResult(resInfo) {
    if (!this.streamingToolsList) return;
    const stepEl = this.streamingToolsList.querySelector(`.step-tool[data-tool-id="${resInfo.id}"]`);
    if (stepEl) {
      const pill = stepEl.querySelector('.tool-status-pill');
      if (pill) {
        if (resInfo.output?.error) {
          pill.textContent = 'Failed';
          pill.className = 'process-status-tag status-failed';
          pill.style.color = '#ef4444';
        } else {
          pill.textContent = 'Completed';
          pill.className = 'process-status-tag status-completed';
        }
      }

      const detailsEl = stepEl.querySelector('.tool-step-details');
      if (detailsEl && resInfo.output) {
        if (resInfo.output.dataUrl) {
          detailsEl.hidden = false;
          detailsEl.innerHTML = `<img src="${resInfo.output.dataUrl}" style="max-width:100%; border-radius:6px; margin-top:6px; border:1px solid rgba(255,255,255,0.1);" />`;
        } else if (resInfo.output.diff) {
          detailsEl.hidden = false;
          detailsEl.innerHTML = `<pre style="color: #38bdf8; margin: 4px 0 0 0;">${this._escape(resInfo.output.diff)}</pre>`;
        }
      }
    }
  }

  _autoFoldProcess() {
    if (this._processHasAutoFolded) return;
    this._processHasAutoFolded = true;

    if (this.streamingProcessWrapper && !this.streamingProcessWrapper.hidden) {
      if (this.streamingProcessBody) {
        this.streamingProcessBody.hidden = true;
      }
      this.streamingProcessWrapper.classList.add('is-folded');
      const chevron = this.streamingProcessWrapper.querySelector('.process-chevron');
      if (chevron) {
        chevron.innerHTML = icons.chevronRight || '▸';
      }
      const statusTag = this.streamingProcessWrapper.querySelector('#streamProcessStatus');
      if (statusTag) {
        statusTag.textContent = 'Completed';
        statusTag.className = 'process-status-tag status-completed';
      }
      this._updateProcessHeaderSummary();
    }
  }

  appendToken(token) {
    this.accumulatedContent += token;
    this._autoFoldProcess();
    if (this.streamingContentEl) {
      this.streamingContentEl.innerHTML = renderMarkdown(this.accumulatedContent, { isStreaming: true }) + '<span class="typing-cursor"></span>';
      
      const loopingMascot = this.streamingContentEl.querySelector('.widget-looping-mascot');
      if (loopingMascot && !loopingMascot._mascotLoopInterval) {
        mascotAnimator.startWidgetLoop(loopingMascot);
      }

      this.scrollToBottom();
    }
  }

  renderQuestionCard({ questionId, questions }) {
    if (!this.streamingAssistantEl) {
      this.startStream(null);
    }

    if (this.streamingProcessWrapper) {
      this.streamingProcessWrapper.hidden = false;
    }
    if (this.streamingProcessBody) {
      this.streamingProcessBody.hidden = false;
    }
    if (this.streamingProcessWrapper) {
      this.streamingProcessWrapper.classList.remove('is-folded');
      const chevron = this.streamingProcessWrapper.querySelector('.process-chevron');
      if (chevron) {
        chevron.innerHTML = icons.chevronDown || '▾';
      }
      const statusTag = this.streamingProcessWrapper.querySelector('#streamProcessStatus');
      if (statusTag) {
        statusTag.textContent = 'Decision Required';
        statusTag.className = 'process-status-tag status-decision';
      }
      const summaryEl = this.streamingProcessWrapper.querySelector('#streamProcessSummary');
      if (summaryEl) {
        summaryEl.textContent = 'Interactive decision required';
      }
    }

    const targetContainer = this.streamingToolsList || this.streamingAssistantEl.querySelector('.assistant-card');

    const card = document.createElement('div');
    card.className = 'question-interactive-card interactive-decision-card';
    card.dataset.questionId = questionId;

    card.innerHTML = `
      <div class="decision-card-header">
        <span class="decision-header-icon">${icons.sparkles}</span>
        <strong class="decision-header-title">Interactive Decision Required</strong>
      </div>
      
      <form class="question-form" id="form_${questionId}">
        ${(questions || []).map((q, qIdx) => `
          <div class="question-item" data-qid="${q.id || `q_${qIdx}`}">
            <p class="question-prompt-text">${this._escape(q.question)}</p>
            <div class="options-pills-grid">
              ${(q.options || []).map((opt) => `
                <label class="option-pill" data-val="${this._escape(opt)}">
                  <input type="${q.is_multi_select ? 'checkbox' : 'radio'}" name="q_${qIdx}" value="${this._escape(opt)}" />
                  <span class="option-label-text">${this._escape(opt)}</span>
                </label>
              `).join('')}
            </div>
            ${q.allow_custom !== false ? `
              <input type="text" class="custom-answer-input" placeholder="Or write custom specification..." />
            ` : ''}
          </div>
        `).join('')}

        <div class="decision-card-footer">
          <button type="submit" class="primary-btn submit-decision-btn">
            <span>Submit Decision</span> →
          </button>
        </div>
      </form>
    `;

    targetContainer.appendChild(card);

    // Pill Toggle: deselect / unchoose on repeated click!
    card.querySelectorAll('.option-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const input = pill.querySelector('input');
        if (!input) return;

        const isRadio = input.type === 'radio';
        const wasChecked = input.checked;

        if (isRadio) {
          if (wasChecked) {
            // Already checked: unchoose / deselect!
            input.checked = false;
            pill.classList.remove('selected');
          } else {
            // Uncheck other options in this question group
            const groupName = input.name;
            card.querySelectorAll(`input[name="${groupName}"]`).forEach(other => {
              other.checked = false;
              other.closest('.option-pill')?.classList.remove('selected');
            });
            input.checked = true;
            pill.classList.add('selected');
          }
        } else {
          // Checkbox toggle
          input.checked = !wasChecked;
          pill.classList.toggle('selected', input.checked);
        }
      });
    });

    this.scrollToBottom();

    // Form submission
    const form = card.querySelector(`#form_${questionId}`);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.submit-decision-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Submitting...</span>`;

      const collectedAnswers = {};
      const answerSummaries = [];

      const items = form.querySelectorAll('.question-item');
      items.forEach((item, idx) => {
        const qKey = item.dataset.qid || `q_${idx}`;
        const checkedBoxes = item.querySelectorAll('input:checked');
        const selectedVals = Array.from(checkedBoxes).map(cb => cb.value);
        const customInput = item.querySelector('.custom-answer-input')?.value?.trim();

        let finalAnswer;
        if (selectedVals.length > 0 && customInput) {
          finalAnswer = `${selectedVals.join(', ')} — Note: ${customInput}`;
        } else if (customInput) {
          finalAnswer = customInput;
        } else if (selectedVals.length > 0) {
          finalAnswer = selectedVals.length === 1 && !item.querySelector('input[type="checkbox"]')
            ? selectedVals[0]
            : selectedVals;
        } else {
          finalAnswer = 'No choice specified';
        }

        collectedAnswers[qKey] = finalAnswer;
        answerSummaries.push(typeof finalAnswer === 'string' ? finalAnswer : (Array.isArray(finalAnswer) ? finalAnswer.join(', ') : JSON.stringify(finalAnswer)));
      });

      try {
        await api.submitQuestionAnswer(questionId, collectedAnswers);
        
        const summaryText = answerSummaries.join(' | ') || 'Decision submitted';
        const firstQ = questions?.[0]?.question || 'Interactive Decision';

        // Replace card with sleek confirmed decision step
        const confirmedStep = document.createElement('div');
        confirmedStep.className = 'process-step-item step-decision confirmed';
        confirmedStep.innerHTML = `
          <div class="decision-step-badge">
            <span class="decision-step-icon">✓</span>
            <span class="decision-step-title">Decision Confirmed</span>
            <span class="decision-choice-pill" title="${this._escape(summaryText)}">${this._escape(summaryText)}</span>
          </div>
          <div class="decision-step-details">
            <div class="decision-step-q">
              <span class="decision-step-label">Question</span>
              <span class="decision-step-val">${this._escape(firstQ)}</span>
            </div>
            <div class="decision-step-a">
              <span class="decision-step-label">Choice Confirmed</span>
              <span class="decision-step-val choice-highlight">${this._escape(summaryText)}</span>
            </div>
          </div>
        `;

        card.replaceWith(confirmedStep);
        this._activeDecisionSummary = summaryText;
        this._updateProcessHeaderSummary();
        
        const statusTag = document.getElementById('streamProcessStatus');
        if (statusTag) {
          statusTag.textContent = 'Processing...';
          statusTag.className = 'process-status-tag status-running';
        }
        this.scrollToBottom();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Retry Submission`;
        console.error('Failed to submit question answer:', err);
      }
    });
  }

  addFallbackNotice(info) {
    // No-op: Removed redundant chat message spam for background model rotation
  }

  finishStream(finalResult) {
    this.isStreaming = false;
    this._autoFoldProcess();

    if (this.streamingAssistantEl) {
      this.streamingAssistantEl.classList.remove('streaming');
      const pulse = this.streamingAssistantEl.querySelector('.streaming-pulse-indicator');
      if (pulse) pulse.remove();

      const loopingMascots = this.container.querySelectorAll('.widget-looping-mascot');
      loopingMascots.forEach(m => mascotAnimator.stopWidgetLoop(m));

      if (this.streamingContentEl) {
        this.streamingContentEl.innerHTML = renderMarkdown(this.accumulatedContent);
      }

      const card = this.streamingAssistantEl.querySelector('.assistant-card');
      if (card && this.accumulatedContent) {
        const lastIdx = (window.app?.currentSession?.messages?.length || 1) - 1;
        const actions = document.createElement('div');
        actions.className = 'assistant-card-actions';
        actions.innerHTML = `
          <button class="msg-action-btn btn-copy-msg" data-content="${encodeURIComponent(this.accumulatedContent)}" title="Copy text">
            ${icons.copy} <span>Copy</span>
          </button>
          <button class="msg-action-btn btn-retry-msg" data-index="${lastIdx}" title="Regenerate this response">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            <span>Regenerate</span>
          </button>
        `;
        card.appendChild(actions);
      }
    }

    this._attachMessageEvents();
    this.setupScrollListener();
    this.scrollToBottom();
  }

  setupScrollListener() {
    const scrollEl = document.getElementById('chatMessagesScroll');
    const scrollBtn = document.getElementById('btnScrollToBottom');
    if (!scrollEl || !scrollBtn) return;

    if (!scrollEl._hasScrollListener) {
      scrollEl._hasScrollListener = true;
      scrollEl.addEventListener('scroll', () => {
        const distanceToBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
        if (distanceToBottom > 140) {
          scrollBtn.hidden = false;
          scrollBtn.classList.add('visible');
        } else {
          scrollBtn.hidden = true;
          scrollBtn.classList.remove('visible');
        }
      });

      scrollBtn.onclick = () => {
        this.scrollToBottom(true);
      };
    }
  }

  scrollToBottom(smooth = false) {
    const scrollEl = document.getElementById('chatMessagesScroll');
    const scrollBtn = document.getElementById('btnScrollToBottom');
    if (scrollEl) {
      if (smooth) {
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      } else {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    }
    if (scrollBtn) {
      scrollBtn.hidden = true;
      scrollBtn.classList.remove('visible');
    }
  }

  _attachMessageEvents() {
    // Unified Process & Actions accordion toggles
    this.container.querySelectorAll('.turn-process-header').forEach(btn => {
      btn.onclick = (e) => {
        const wrapper = e.currentTarget.closest('.turn-process-wrapper');
        const body = wrapper?.querySelector('.turn-process-body');
        const chevron = e.currentTarget.querySelector('.process-chevron');
        if (body && wrapper) {
          const isHidden = body.hidden;
          body.hidden = !isHidden;
          wrapper.classList.toggle('is-folded', !isHidden);
          if (chevron) {
            chevron.innerHTML = isHidden ? icons.chevronDown || '▾' : icons.chevronRight || '▸';
          }
        }
      };
    });

    // Tool item details toggle
    this.container.querySelectorAll('.tool-step-header').forEach(hdr => {
      hdr.onclick = (e) => {
        const step = e.currentTarget.closest('.process-step-item');
        const details = step?.querySelector('.tool-step-details');
        if (details) {
          details.hidden = !details.hidden;
        }
      };
    });

    // Legacy process accordion toggles
    this.container.querySelectorAll('.process-header-toggle').forEach(btn => {
      btn.onclick = (e) => {
        const accordion = e.currentTarget.closest('.process-accordion');
        const contentBox = accordion.querySelector('.process-content-box');
        const chevron = e.currentTarget.querySelector('.chevron-icon');
        if (contentBox) {
          const isHidden = contentBox.hidden;
          contentBox.hidden = !isHidden;
          if (chevron) {
            chevron.innerHTML = isHidden ? icons.chevronDown || '▼' : icons.chevronRight || '▶';
          }
        }
      };
    });

    // Initialize Live Sandbox iframes safely via JS property
    this.container.querySelectorAll('.html-canvas-card').forEach(card => {
      const iframe = card.querySelector('.html-live-preview');
      const rawCode = decodeURIComponent(card.dataset.code || '');
      if (iframe && rawCode && !iframe._initialized) {
        iframe._initialized = true;
        const isFullDoc = /<!doctype/i.test(rawCode) || /<html/i.test(rawCode);
        const fullHtml = isFullDoc ? rawCode : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #111111;
      color: #f4f4f5;
      min-height: 100%;
    }
  </style>
</head>
<body>
  ${rawCode}
</body>
</html>`;
        iframe.srcdoc = fullHtml;
      }
    });

    // Toggle Preview/Code in Canvas
    this.container.querySelectorAll('.btn-toggle-preview').forEach(btn => {
      btn.onclick = (e) => {
        const card = e.currentTarget.closest('.html-canvas-card');
        const previewBox = card.querySelector('.live-preview-box');
        const sourceBox = card.querySelector('.source-code-box');
        const isPreviewing = previewBox.style.display !== 'none';

        if (isPreviewing) {
          previewBox.style.display = 'none';
          sourceBox.style.display = 'block';
          e.currentTarget.innerHTML = '<span>Code</span>';
          e.currentTarget.classList.remove('active');
        } else {
          previewBox.style.display = 'block';
          sourceBox.style.display = 'none';
          e.currentTarget.innerHTML = '<span>Preview</span>';
          e.currentTarget.classList.add('active');
        }
      };
    });

    // Popout Canvas (isolated sandbox via Blob URL)
    this.container.querySelectorAll('.btn-fullscreen-canvas').forEach(btn => {
      btn.onclick = (e) => {
        const card = e.currentTarget.closest('.html-canvas-card');
        const rawCode = decodeURIComponent(card?.dataset?.code || '');
        const isFullDoc = /<!doctype/i.test(rawCode) || /<html/i.test(rawCode);
        const fullHtml = isFullDoc ? rawCode : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>*{box-sizing:border-box;}body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#111111;color:#f4f4f5;}</style></head><body>${rawCode}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer,width=960,height=700');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      };
    });
    // Copy message text with dynamic checkmark feedback
    this.container.querySelectorAll('.btn-copy-msg').forEach(btn => {
      btn.onclick = async (e) => {
        const content = decodeURIComponent(e.currentTarget.dataset.content || '');
        try {
          await navigator.clipboard.writeText(content);
          const origHtml = e.currentTarget.innerHTML;
          e.currentTarget.innerHTML = `${icons.check} <span>Copied!</span>`;
          e.currentTarget.classList.add('copied');
          setTimeout(() => {
            e.currentTarget.innerHTML = origHtml;
            e.currentTarget.classList.remove('copied');
          }, 2000);
          if (this.onNotification) this.onNotification('Copied message to clipboard!', 'success');
        } catch {
          if (this.onNotification) this.onNotification('Failed to copy', 'error');
        }
      };
    });

    // Edit prompt into input box
    this.container.querySelectorAll('.btn-edit-prompt').forEach(btn => {
      btn.onclick = (e) => {
        const content = decodeURIComponent(e.currentTarget.dataset.content || '');
        const textarea = document.getElementById('chatInputTextarea');
        if (textarea) {
          textarea.value = content;
          textarea.focus();
          textarea.style.height = 'auto';
          textarea.style.height = Math.max(38, Math.min(textarea.scrollHeight, 180)) + 'px';
          document.getElementById('btnSendMessage')?.classList.add('active');
        }
      };
    });

    // Regenerate message
    this.container.querySelectorAll('.btn-retry-msg').forEach(btn => {
      btn.onclick = async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        if (window.app && typeof window.app.regenerateTurn === 'function') {
          await window.app.regenerateTurn(idx);
        }
      };
    });

    // Code block copy
    this.container.querySelectorAll('.btn-copy-code').forEach(btn => {
      btn.onclick = async (e) => {
        const card = e.currentTarget.closest('.code-block-card');
        const code = decodeURIComponent(card?.dataset?.code || '');
        try {
          await navigator.clipboard.writeText(code);
          e.currentTarget.innerHTML = `<span>Copied!</span>`;
          setTimeout(() => {
            e.currentTarget.innerHTML = `<span>Copy</span>`;
          }, 2000);
        } catch {
          // ignore
        }
      };
    });

    // File Link Click -> open Inspector Drawer
    this.container.querySelectorAll('.eyqa-file-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const filePath = e.currentTarget.dataset.filepath || e.currentTarget.textContent?.trim();
        if (filePath && window.app) {
          if (typeof window.app.openInspector === 'function') {
            window.app.openInspector(filePath);
          } else if (typeof window.app.openFileInInspector === 'function') {
            window.app.openFileInInspector(filePath);
          }
        }
      };
    });
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  _formatTime(ts) {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}

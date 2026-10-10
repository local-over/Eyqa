/**
 * Eyqa Chat View
 * Pure monochromatic message flow (ChatGPT & Claude style).
 * Renders interleaved thought accordions, inline tool status badges,
 * and clean copy actions with zero intrusive sliding drawers.
 */

import { icons } from './icons.js';
import { renderMarkdown } from './markdown-renderer.js';

export class ChatView {
  constructor(containerEl, onNotification) {
    this.container = containerEl;
    this.onNotification = onNotification;
    this.currentSession = null;
    this.streamingAssistantEl = null;
    this.streamingThoughtEl = null;
    this.streamingContentEl = null;
    this.accumulatedContent = '';
    this.accumulatedThought = '';
    this.isStreaming = false;
  }

  setSession(session) {
    this.currentSession = session;
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
    this.scrollToBottom();
  }

  _renderWelcomeHero() {
    const hasFolder = Boolean(this.currentSession?.folderPath);
    const folderName = this.currentSession?.folderName || 'Project Folder';
    const folderPath = this.currentSession?.folderPath || '';

    this.container.innerHTML = `
      <div class="welcome-hero-container">
        <div class="welcome-mascot-box">
          <img src="assets/eyqa-logo.png" alt="Eyqa" class="welcome-mascot-img" />
        </div>
        <h2 class="welcome-hero-title">What can Eyqa help with today?</h2>
        <p class="welcome-hero-subtitle">
          ${hasFolder 
            ? `Working inside <strong>${this._escape(folderName)}</strong> (<span style="font-family: var(--font-mono); font-size: 11px;">${this._escape(folderPath)}</span>). Eyqa can read, write, and explore files here.` 
            : 'Your everyday AI coworker. Clean, fast, and grounded with live web search.'}
        </p>

        <div class="starter-cards-grid">
          ${hasFolder ? `
            <div class="starter-card" data-prompt="Summarize the structure of this project folder and outline what files exist.">
              <span class="starter-icon">${icons.folder}</span>
              <div class="starter-card-body">
                <strong>Project Overview</strong>
                <p>Inspect and outline all files and directories in this folder.</p>
              </div>
            </div>

            <div class="starter-card" data-prompt="Search the web and compare the tech stack or implementation in this project with modern 2026 best practices.">
              <span class="starter-icon">${icons.globe}</span>
              <div class="starter-card-body">
                <strong>Live Web Research</strong>
                <p>Verify packages, documentation, and industry standards online.</p>
              </div>
            </div>

            <div class="starter-card" data-prompt="Review the code files in this project and identify areas for optimization or cleanup.">
              <span class="starter-icon">${icons.code}</span>
              <div class="starter-card-body">
                <strong>Code Review & Optimization</strong>
                <p>Find bugs, clean up scripts, and propose concrete improvements.</p>
              </div>
            </div>

            <div class="starter-card" data-prompt="Draft complete documentation and a README guide for this project folder.">
              <span class="starter-icon">${icons.briefcase}</span>
              <div class="starter-card-body">
                <strong>Write Project Docs</strong>
                <p>Generate clear, step-by-step documentation for this folder.</p>
              </div>
            </div>
          ` : `
            <div class="starter-card" data-prompt="Draft a clear, executive-ready proposal with objectives, milestones, and deliverables.">
              <span class="starter-icon">${icons.briefcase}</span>
              <div class="starter-card-body">
                <strong>Draft a Proposal or Document</strong>
                <p>Create clean, professional proposals, emails, or plans.</p>
              </div>
            </div>

            <div class="starter-card" data-prompt="Search the web for the latest artificial intelligence developments in 2026 and summarize key breakthroughs with sources.">
              <span class="starter-icon">${icons.globe}</span>
              <div class="starter-card-body">
                <strong>Deep Live Web Research</strong>
                <p>Explore real-time internet news, market reports, and facts.</p>
              </div>
            </div>

            <div class="starter-card" data-prompt="Explain a complex topic in simple, intuitive terms with practical examples.">
              <span class="starter-icon">${icons.sparkles}</span>
              <div class="starter-card-body">
                <strong>Explain & Brainstorm</strong>
                <p>Break down difficult concepts into plain, accessible insights.</p>
              </div>
            </div>

            <div class="starter-card" data-prompt="Write a clean automation script and explain step-by-step how to run it.">
              <span class="starter-icon">${icons.code}</span>
              <div class="starter-card-body">
                <strong>Code & Automate</strong>
                <p>Generate clean scripts, fix errors, or automate repetitive tasks.</p>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    this.container.querySelectorAll('.starter-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        const input = document.getElementById('chatInputTextarea');
        if (input) {
          input.value = prompt;
          input.focus();
        }
      });
    });
  }

  _renderMessage(msg, idx) {
    if (msg.role === 'user') {
      return `
        <div class="message-row user-row">
          <div class="message-bubble user-bubble">
            ${msg.attachment ? `
              <div class="attachment-pill">
                ${icons.attach} <span>${this._escape(msg.attachment.name)}</span>
              </div>
            ` : ''}
            <div class="message-text">${this._escape(msg.content).replace(/\n/g, '<br/>')}</div>
          </div>
        </div>
      `;
    }

    if (msg.role === 'assistant') {
      const hasThought = Boolean(msg.thought && msg.thought.trim());
      const hasTools = Boolean(msg.tools && msg.tools.length > 0);

      return `
        <div class="message-row assistant-row" data-index="${idx}">
          <div class="assistant-avatar-box">
            <img src="assets/eyqa-logo.png" alt="Eyqa" class="assistant-avatar-img" />
          </div>
          <div class="assistant-card">
            <div class="assistant-card-header">
              <div class="assistant-name">
                <span>eyqa</span>
              </div>
              ${msg.provider ? `
                <span class="assistant-provider-pill">${this._escape(msg.provider.name || '')}</span>
              ` : ''}
            </div>

            ${hasThought ? `
              <div class="thought-accordion">
                <button class="thought-header-toggle">
                  ${icons.chevronRight} <span>Thought Process</span>
                </button>
                <div class="thought-content-box" hidden>${this._escape(msg.thought)}</div>
              </div>
            ` : ''}

            ${hasTools ? `
              <div class="tools-badges-list">
                ${msg.tools.map(t => this._renderToolBadge(t)).join('')}
              </div>
            ` : ''}

            <div class="assistant-card-body md-body">
              ${renderMarkdown(msg.content)}
            </div>

            <div class="assistant-card-actions">
              <button class="msg-action-btn btn-copy-msg" data-content="${encodeURIComponent(msg.content)}" title="Copy text">
                ${icons.copy} <span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  _renderToolBadge(tool) {
    const isSearch = tool.name === 'web_search';
    const isFetch = tool.name === 'web_fetch';
    const label = isSearch ? `DuckDuckGo Search: "${tool.arguments?.query || ''}"`
                : isFetch ? `Read Webpage: ${tool.arguments?.url || ''}`
                : `Workspace File: ${tool.arguments?.filePath || tool.name}`;

    return `
      <div class="tool-badge-card">
        <div class="tool-left">
          ${isSearch ? icons.search : isFetch ? icons.globe : icons.folder}
          <span>${this._escape(label)}</span>
        </div>
        <span class="tool-status-pill">Completed</span>
      </div>
    `;
  }

  startStream(userMessage) {
    this.isStreaming = true;
    this.accumulatedContent = '';
    this.accumulatedThought = '';

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
      </div>
    `;
    listEl.appendChild(userRow);

    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant-row streaming';
    assistantRow.innerHTML = `
      <div class="assistant-avatar-box">
        <img src="assets/eyqa-logo.png" alt="Eyqa" class="assistant-avatar-img" />
      </div>
      <div class="assistant-card">
        <div class="assistant-card-header">
          <div class="assistant-name"><span>eyqa</span></div>
          <span class="streaming-pulse-indicator">Typing...</span>
        </div>
        <div class="thought-accordion" id="streamThoughtBox" hidden>
          <button class="thought-header-toggle">
            ${icons.chevronRight} <span>Thought Process</span>
          </button>
          <div class="thought-content-box">${this._escape(this.accumulatedThought)}</div>
        </div>
        <div class="tools-badges-list" id="streamToolsBox"></div>
        <div class="assistant-card-body md-body" id="streamContentBox">
          <span class="typing-cursor"></span>
        </div>
      </div>
    `;
    listEl.appendChild(assistantRow);

    this.streamingAssistantEl = assistantRow;
    this.streamingThoughtEl = assistantRow.querySelector('#streamThoughtBox');
    this.streamingContentEl = assistantRow.querySelector('#streamContentBox');

    this.scrollToBottom();
  }

  appendToken(token) {
    this.accumulatedContent += token;
    if (this.streamingContentEl) {
      this.streamingContentEl.innerHTML = renderMarkdown(this.accumulatedContent) + '<span class="typing-cursor"></span>';
      this.scrollToBottom();
    }
  }

  appendThought(thought) {
    this.accumulatedThought += thought;
    if (this.streamingThoughtEl) {
      this.streamingThoughtEl.hidden = false;
      const contentBox = this.streamingThoughtEl.querySelector('.thought-content-box');
      if (contentBox) {
        contentBox.textContent = this.accumulatedThought;
      }
      this.scrollToBottom();
    }
  }

  addToolBadge(toolInfo) {
    const toolsBox = this.streamingAssistantEl?.querySelector('#streamToolsBox');
    if (toolsBox) {
      const badge = document.createElement('div');
      badge.className = 'tool-badge-card';
      const isSearch = toolInfo.name === 'web_search';
      const isFetch = toolInfo.name === 'web_fetch';
      const label = isSearch ? `DuckDuckGo Search: "${toolInfo.arguments?.query || ''}"`
                  : isFetch ? `Read Webpage: ${toolInfo.arguments?.url || ''}`
                  : `Workspace: ${toolInfo.arguments?.filePath || toolInfo.name}`;

      badge.innerHTML = `
        <div class="tool-left">
          ${isSearch ? icons.search : isFetch ? icons.globe : icons.folder}
          <span>${this._escape(label)}</span>
        </div>
        <span class="tool-status-pill" style="color: var(--warning); background: rgba(245, 158, 11, 0.15);">Running...</span>
      `;
      toolsBox.appendChild(badge);
      this.scrollToBottom();
    }
  }

  addFallbackNotice(info) {
    const toolsBox = this.streamingAssistantEl?.querySelector('#streamToolsBox');
    if (toolsBox) {
      const notice = document.createElement('div');
      notice.className = 'fallback-notice-banner';
      notice.innerHTML = `
        <span>🛡️ Rate limit on ${this._escape(info.previousProvider)}. Seamlessly continuing turn with ${this._escape(info.currentProvider)}...</span>
      `;
      toolsBox.appendChild(notice);
      this.scrollToBottom();
    }
  }

  finishStream(finalResult) {
    this.isStreaming = false;
    if (this.streamingAssistantEl) {
      this.streamingAssistantEl.classList.remove('streaming');
      const pulse = this.streamingAssistantEl.querySelector('.streaming-pulse-indicator');
      if (pulse) pulse.remove();

      this.streamingAssistantEl.querySelectorAll('.tool-status-pill').forEach(pill => {
        pill.textContent = 'Completed';
        pill.style.color = 'var(--success)';
        pill.style.background = 'rgba(16, 185, 129, 0.15)';
      });

      if (this.streamingContentEl) {
        this.streamingContentEl.innerHTML = renderMarkdown(this.accumulatedContent);
      }

      const card = this.streamingAssistantEl.querySelector('.assistant-card');
      if (card && this.accumulatedContent) {
        const actions = document.createElement('div');
        actions.className = 'assistant-card-actions';
        actions.innerHTML = `
          <button class="msg-action-btn btn-copy-msg" data-content="${encodeURIComponent(this.accumulatedContent)}" title="Copy text">
            ${icons.copy} <span>Copy</span>
          </button>
        `;
        card.appendChild(actions);
      }
    }

    this._attachMessageEvents();
    this.scrollToBottom();
  }

  scrollToBottom() {
    const scrollEl = document.getElementById('chatMessagesScroll');
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }

  _attachMessageEvents() {
    // Thought accordion toggles
    this.container.querySelectorAll('.thought-header-toggle').forEach(btn => {
      btn.onclick = (e) => {
        const accordion = e.currentTarget.closest('.thought-accordion');
        const contentBox = accordion.querySelector('.thought-content-box');
        if (contentBox) {
          const isHidden = contentBox.hidden;
          contentBox.hidden = !isHidden;
          e.currentTarget.innerHTML = `${isHidden ? icons.chevronDown : icons.chevronRight} <span>Thought Process</span>`;
        }
      };
    });

    // Copy message text
    this.container.querySelectorAll('.btn-copy-msg').forEach(btn => {
      btn.onclick = async (e) => {
        const content = decodeURIComponent(e.currentTarget.dataset.content || '');
        try {
          await navigator.clipboard.writeText(content);
          if (this.onNotification) this.onNotification('Copied message to clipboard!', 'success');
        } catch {
          if (this.onNotification) this.onNotification('Failed to copy', 'error');
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
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

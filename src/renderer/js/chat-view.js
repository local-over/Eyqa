/**
 * Eyqa Chat View
 * Handles real-time message stream rendering, thought accordions, tool badges, and user input.
 */

import { icons } from './icons.js';
import { renderMarkdown } from './markdown-renderer.js';

export class ChatView {
  constructor(containerEl, onCanvasOpen, onNotification) {
    this.container = containerEl;
    this.onCanvasOpen = onCanvasOpen;
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
    this.container.innerHTML = `
      <div class="welcome-hero-container">
        <div class="welcome-hero-mark">${icons.eyqaLogo}</div>
        <h2 class="welcome-hero-title">Meet Eyqa, your AI coworker.</h2>
        <p class="welcome-hero-subtitle">
          Designed for everyday work. Ask questions, research the live web, analyze documents, and draft proposals without writing a line of code.
        </p>

        <div class="starter-cards-grid">
          <div class="starter-card" data-prompt="Draft a clear, professional project proposal with goals, milestones, and deliverables.">
            <span class="starter-icon">${icons.briefcase}</span>
            <div class="starter-card-body">
              <strong>Draft a Proposal or Document</strong>
              <p>Create clean, executive-ready proposals, emails, or plans.</p>
            </div>
          </div>

          <div class="starter-card" data-prompt="Search the web for the latest artificial intelligence breakthroughs and summarize the top 3 developments with sources.">
            <span class="starter-icon">${icons.globe}</span>
            <div class="starter-card-body">
              <strong>Live Web Research</strong>
              <p>Explore real-time internet news, market reports, and facts.</p>
            </div>
          </div>

          <div class="starter-card" data-prompt="Scan my workspace directory and create a structured README and overview document.">
            <span class="starter-icon">${icons.folder}</span>
            <div class="starter-card-body">
              <strong>Explore Workspace Files</strong>
              <p>Organize, read, and summarize documents on your computer.</p>
            </div>
          </div>

          <div class="starter-card" data-prompt="Write a lightweight automation script in Python or Node.js to organize downloaded files by date and type.">
            <span class="starter-icon">${icons.code}</span>
            <div class="starter-card-body">
              <strong>Code & Automate</strong>
              <p>Create automation scripts, fix bugs, or build tools.</p>
            </div>
          </div>
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
          <div class="assistant-avatar">${icons.eyqaLogo}</div>
          <div class="assistant-card">
            <div class="assistant-card-header">
              <span class="assistant-name">Eyqa Coworker</span>
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
              <button class="msg-action-btn btn-open-canvas" data-content="${encodeURIComponent(msg.content)}" title="Open in Canvas">
                ${icons.canvas} <span>Open in Canvas</span>
              </button>
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
    const isWorkspace = tool.name.startsWith('workspace_');

    const label = isSearch ? `Searched: "${tool.arguments?.query || ''}"`
                : isFetch ? `Read page: ${tool.arguments?.url || ''}`
                : `Workspace: ${tool.arguments?.filePath || tool.name}`;

    return `
      <div class="tool-badge-card">
        <span class="tool-icon">${isSearch ? icons.search : isFetch ? icons.globe : icons.folder}</span>
        <span class="tool-label">${this._escape(label)}</span>
      </div>
    `;
  }

  startStream(userMessage) {
    this.isStreaming = true;
    this.accumulatedContent = '';
    this.accumulatedThought = '';

    // If empty welcome hero was showing, initialize messages container
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

    // Append User Bubble
    const userRow = document.createElement('div');
    userRow.className = 'message-row user-row';
    userRow.innerHTML = `
      <div class="message-bubble user-bubble">
        ${userMessage.attachment ? `
          <div class="attachment-pill">${icons.attach} <span>${this._escape(userMessage.attachment.name)}</span></div>
        ` : ''}
        <div class="message-text">${this._escape(userMessage.content).replace(/\n/g, '<br/>')}</div>
      </div>
    `;
    listEl.appendChild(userRow);

    // Append Assistant Placeholder
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant-row streaming';
    assistantRow.innerHTML = `
      <div class="assistant-avatar">${icons.eyqaLogo}</div>
      <div class="assistant-card">
        <div class="assistant-card-header">
          <span class="assistant-name">Eyqa Coworker</span>
          <span class="streaming-pulse-indicator">Generating…</span>
        </div>
        <div class="thought-accordion" id="streamThoughtBox" hidden>
          <button class="thought-header-toggle">
            ${icons.chevronDown} <span>Thought Process</span>
          </button>
          <div class="thought-content-box"></div>
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
      const label = isSearch ? `Searching: "${toolInfo.arguments?.query || ''}"...`
                  : isFetch ? `Reading: ${toolInfo.arguments?.url || ''}...`
                  : `Scanning: ${toolInfo.arguments?.filePath || toolInfo.name}...`;

      badge.innerHTML = `
        <span class="tool-icon">${isSearch ? icons.search : isFetch ? icons.globe : icons.folder}</span>
        <span class="tool-label">${this._escape(label)}</span>
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
        <span>🛡️ Rate limit reached on ${this._escape(info.previousProvider)}. Automatically continuing with ${this._escape(info.currentProvider)}...</span>
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

      // Remove typing cursor
      if (this.streamingContentEl) {
        this.streamingContentEl.innerHTML = renderMarkdown(this.accumulatedContent);
      }

      // Add actions
      const card = this.streamingAssistantEl.querySelector('.assistant-card');
      if (card) {
        const actions = document.createElement('div');
        actions.className = 'assistant-card-actions';
        actions.innerHTML = `
          <button class="msg-action-btn btn-open-canvas" data-content="${encodeURIComponent(this.accumulatedContent)}" title="Open in Canvas">
            ${icons.canvas} <span>Open in Canvas</span>
          </button>
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

    // Copy message button
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

    // Open in canvas
    this.container.querySelectorAll('.btn-open-canvas').forEach(btn => {
      btn.onclick = (e) => {
        const content = decodeURIComponent(e.currentTarget.dataset.content || '');
        if (this.onCanvasOpen) {
          this.onCanvasOpen('Generated Document', content, 'markdown');
        }
      };
    });

    // Code block canvas inserts
    this.container.querySelectorAll('.btn-canvas-insert').forEach(btn => {
      btn.onclick = (e) => {
        const card = e.currentTarget.closest('.code-block-card');
        const code = decodeURIComponent(card?.dataset?.code || '');
        const lang = card?.dataset?.lang || 'text';
        if (this.onCanvasOpen) {
          this.onCanvasOpen(`Snippet (${lang})`, code, lang);
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
          e.currentTarget.innerHTML = `<span>${icons.check} Copied!</span>`;
          setTimeout(() => {
            e.currentTarget.innerHTML = '<span>📋 Copy</span>';
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

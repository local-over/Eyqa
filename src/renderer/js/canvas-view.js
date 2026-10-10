/**
 * Eyqa Coworker Canvas & Side-by-Side Panel
 * Displays live generated documents, code files, web previews, and workspace files.
 */

import { icons } from './icons.js';
import { renderMarkdown } from './markdown-renderer.js';
import { api } from './api.js';

export class CanvasView {
  constructor(containerEl, onNotification) {
    this.container = containerEl;
    this.onNotification = onNotification;
    this.isOpen = false;
    this.activeTab = 'doc'; // 'doc' | 'web' | 'workspace'
    this.currentDoc = {
      title: 'Untitled Document',
      content: '# Welcome to Coworker Canvas\n\nWhen Eyqa drafts full documents, proposals, plans, or code for you, they appear here side-by-side so you can read, edit, or save them directly to your computer.\n\n### Quick Features:\n- **Edit Mode**: tweak any document directly\n- **Save to Workspace**: 1-click save to your local folder\n- **Copy All**: grab the entire text in one tap',
      language: 'markdown',
      isEditing: false
    };
    this.webItems = [];
    this.render();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.container.classList.add('open');
    } else {
      this.container.classList.remove('open');
    }
    return this.isOpen;
  }

  openWithDoc(title, content, language = 'markdown') {
    this.currentDoc = {
      title: title || 'Generated Document',
      content: content || '',
      language: language || 'markdown',
      isEditing: false
    };
    this.activeTab = 'doc';
    if (!this.isOpen) this.toggle();
    this.render();
  }

  openWithWeb(items) {
    this.webItems = items || [];
    this.activeTab = 'web';
    if (!this.isOpen) this.toggle();
    this.render();
  }

  setTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="canvas-header">
        <div class="canvas-tabs">
          <button class="canvas-tab-btn ${this.activeTab === 'doc' ? 'active' : ''}" data-tab="doc">
            ${icons.canvas} <span>Document</span>
          </button>
          <button class="canvas-tab-btn ${this.activeTab === 'web' ? 'active' : ''}" data-tab="web">
            ${icons.globe} <span>Web Insights</span>
          </button>
          <button class="canvas-tab-btn ${this.activeTab === 'workspace' ? 'active' : ''}" data-tab="workspace">
            ${icons.folder} <span>Workspace</span>
          </button>
        </div>
        <div class="canvas-header-actions">
          <button class="canvas-close-btn" title="Close Canvas">${icons.close}</button>
        </div>
      </div>
      <div class="canvas-body">
        ${this._renderActiveTab()}
      </div>
    `;

    this._attachEvents();
  }

  _renderActiveTab() {
    if (this.activeTab === 'doc') {
      return `
        <div class="canvas-doc-view">
          <div class="canvas-doc-toolbar">
            <input type="text" class="canvas-doc-title-input" value="${this._escape(this.currentDoc.title)}" placeholder="Document Title..." />
            <div class="canvas-doc-actions">
              <button class="canvas-action-btn btn-toggle-edit" title="${this.currentDoc.isEditing ? 'View Preview' : 'Edit Markdown'}">
                ${icons.edit} <span>${this.currentDoc.isEditing ? 'Preview' : 'Edit'}</span>
              </button>
              <button class="canvas-action-btn btn-copy-doc" title="Copy Content">
                ${icons.copy} <span>Copy</span>
              </button>
              <button class="canvas-action-btn btn-save-workspace" title="Save to Workspace Folder">
                ${icons.download} <span>Save to Workspace</span>
              </button>
            </div>
          </div>
          <div class="canvas-doc-content">
            ${this.currentDoc.isEditing ? `
              <textarea class="canvas-doc-editor" placeholder="Write or edit content...">${this._escape(this.currentDoc.content)}</textarea>
            ` : `
              <div class="canvas-doc-preview md-body">${renderMarkdown(this.currentDoc.content)}</div>
            `}
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'web') {
      return `
        <div class="canvas-web-view">
          <div class="canvas-web-header">
            <h4>Live Web & Research Sources</h4>
            <p>Recent search queries and retrieved webpage information</p>
          </div>
          <div class="canvas-web-list">
            ${this.webItems.length === 0 ? `
              <div class="canvas-empty-state">
                ${icons.globe}
                <p>No web searches performed yet in this session.</p>
                <small>Ask Eyqa to search for news, companies, or facts with Web Grounding enabled.</small>
              </div>
            ` : this.webItems.map(item => `
              <div class="canvas-web-card">
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="canvas-web-title">
                  ${this._escape(item.title || item.url)} ${icons.link}
                </a>
                <span class="canvas-web-url">${this._escape(item.url)}</span>
                <p class="canvas-web-snippet">${this._escape(item.snippet || item.content || '')}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'workspace') {
      return `
        <div class="canvas-workspace-view">
          <div class="canvas-workspace-header">
            <h4>Workspace Explorer</h4>
            <button class="canvas-action-btn btn-refresh-workspace">${icons.sparkles} Refresh</button>
          </div>
          <div id="canvasWorkspaceFileList" class="canvas-workspace-files">
            <div class="loading-spinner">Loading workspace files...</div>
          </div>
        </div>
      `;
    }
  }

  _attachEvents() {
    // Tab switching
    this.container.querySelectorAll('.canvas-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.setTab(tab);
        if (tab === 'workspace') this._loadWorkspaceFiles();
      });
    });

    // Close button
    const closeBtn = this.container.querySelector('.canvas-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.toggle());

    // Title editing
    const titleInput = this.container.querySelector('.canvas-doc-title-input');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.currentDoc.title = e.target.value;
      });
    }

    // Toggle Edit / Preview
    const toggleEditBtn = this.container.querySelector('.btn-toggle-edit');
    if (toggleEditBtn) {
      toggleEditBtn.addEventListener('click', () => {
        if (this.currentDoc.isEditing) {
          const editor = this.container.querySelector('.canvas-doc-editor');
          if (editor) this.currentDoc.content = editor.value;
        }
        this.currentDoc.isEditing = !this.currentDoc.isEditing;
        this.render();
      });
    }

    // Copy Content
    const copyBtn = this.container.querySelector('.btn-copy-doc');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(this.currentDoc.content);
          if (this.onNotification) this.onNotification('Copied document to clipboard!', 'success');
        } catch {
          if (this.onNotification) this.onNotification('Failed to copy', 'error');
        }
      });
    }

    // Save to Workspace
    const saveBtn = this.container.querySelector('.btn-save-workspace');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        let filename = this.currentDoc.title.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        if (!filename.includes('.')) {
          filename += this.currentDoc.language === 'python' ? '.py' :
                      this.currentDoc.language === 'javascript' ? '.js' :
                      this.currentDoc.language === 'html' ? '.html' : '.md';
        }
        const res = await api.writeWorkspaceFile(filename, this.currentDoc.content);
        if (res && res.success) {
          if (this.onNotification) this.onNotification(`Saved to workspace: ${filename}`, 'success');
        } else {
          if (this.onNotification) this.onNotification(res?.error || 'Failed to save', 'error');
        }
      });
    }

    // Refresh workspace
    const refreshBtn = this.container.querySelector('.btn-refresh-workspace');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._loadWorkspaceFiles());
    }
  }

  async _loadWorkspaceFiles() {
    const listEl = this.container.querySelector('#canvasWorkspaceFileList');
    if (!listEl) return;

    try {
      const res = await api.listWorkspace();
      if (res && res.items) {
        if (res.items.length === 0) {
          listEl.innerHTML = `
            <div class="canvas-empty-state">
              ${icons.folder}
              <p>Workspace folder is empty.</p>
              <small>${this._escape(res.workspace || '')}</small>
            </div>
          `;
          return;
        }

        listEl.innerHTML = res.items.map(item => `
          <div class="workspace-file-row ${item.isDirectory ? 'is-dir' : 'is-file'}" data-path="${this._escape(item.path)}">
            <span class="file-icon">${item.isDirectory ? icons.folder : icons.code}</span>
            <span class="file-name">${this._escape(item.name)}</span>
            <span class="file-size">${item.isDirectory ? '' : this._formatSize(item.size)}</span>
          </div>
        `).join('');

        listEl.querySelectorAll('.workspace-file-row.is-file').forEach(row => {
          row.addEventListener('click', async (e) => {
            const relPath = e.currentTarget.dataset.path;
            const fileRes = await api.readWorkspaceFile(relPath);
            if (fileRes && fileRes.content) {
              this.openWithDoc(relPath, fileRes.content);
            }
          });
        });
      }
    } catch (err) {
      listEl.innerHTML = `<p class="error">Failed to load files: ${err.message}</p>`;
    }
  }

  _formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

import { icons } from './icons.js';

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderMarkdown(rawText, options = {}) {
  if (!rawText) return '';

  let text = rawText;
  const isStreaming = options.isStreaming || false;

  // 1. Detect and handle in-progress streaming interactive widget block
  if (isStreaming) {
    const unclosedWidgetRegex = /```(widget|chart|quiz|html:preview|interactive|eyqa-widget|sandbox|draw|html)\n?([\s\S]*)$/i;
    if (unclosedWidgetRegex.test(text)) {
      text = text.replace(unclosedWidgetRegex, () => {
        return `\n__WIDGET_INDEXER_SKELETON__\n`;
      });
    }
  }

  // 2. Extract and preserve completed code blocks
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_\-\.:]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang.toLowerCase().trim() || 'text', code: code.trim() });
    return id;
  });

  // 3. Escape remaining HTML
  text = escapeHtml(text);

  // 4. Headers
  text = text.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // 5. Blockquotes
  text = text.replace(/^\> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>');

  // 6. Bold & Italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // 7. Inline code
  text = text.replace(/`([^`]+)`/gim, '<code class="md-inline-code">$1</code>');

  // 7b. Images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, (m, alt, src) => {
    const cleanSrc = src.trim().replace(/^<|>$/g, '');
    const safeSrc = escapeHtml(cleanSrc);
    const safeAlt = escapeHtml(alt || 'Generated visual');
    return `<div class="md-image-card">
      <img src="${safeSrc}" alt="${safeAlt}" class="md-zoomable-image" loading="lazy" onerror="this.onerror=null; this.parentElement.classList.add('image-load-error'); this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'320\\' height=\\'160\\' viewBox=\\'0 0 320 160\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23141414\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%23888888\\' font-family=\\'monospace\\' font-size=\\'12\\' text-anchor=\\'middle\\'>Failed to load image</text></svg>';" />
      ${alt ? `<div class="md-image-caption">${safeAlt}</div>` : ''}
    </div>`;
  });

  // 8. Markdown Links [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');
  
  // 8b. Category 3: File Links & Snapshots [text](file:path) or [text](file://path)
  text = text.replace(/\[([^\]]+)\]\((file:[^\)]+)\)/gim, (m, label, link) => {
    const rawPath = link.replace(/^file:\/\//, '').replace(/^file:/, '');
    return `<a href="javascript:void(0)" class="md-link eyqa-file-link" data-filepath="${rawPath}">${icons.fileText} <span>${label}</span></a>`;
  });

  // 9. Horizontal rules
  text = text.replace(/^---$/gim, '<hr class="md-hr" />');

  // 10. Unordered Lists
  text = text.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="md-li">$1</li>');
  text = text.replace(/(<li class="md-li">[\s\S]*?<\/li>)/gim, '<ul class="md-ul">$1</ul>');
  text = text.replace(/<\/ul>\s*<ul class="md-ul">/gim, '');

  // 11. Numbered Lists
  text = text.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="md-oli" value="$1">$2</li>');
  text = text.replace(/(<li class="md-oli"[^>]*>[\s\S]*?<\/li>)/gim, '<ol class="md-ol">$1</ol>');
  text = text.replace(/<\/ol>\s*<ol class="md-ol">/gim, '');

  // 12. Tables
  text = renderTables(text);

  // 13. Paragraphs
  const paragraphs = text.split(/\n\n+/);
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h1') || p.startsWith('<h2') || p.startsWith('<h3') ||
        p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<blockquote') ||
        p.startsWith('<hr') || p.startsWith('<table') || p.startsWith('__CODE_BLOCK_') ||
        p.startsWith('__WIDGET_INDEXER_SKELETON__') || p.startsWith('<div')) {
      return p;
    }
    return `<p class="md-p">${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  // 14. Replace Streaming Widget Indexer Skeleton with animated Eyqa pulse
  if (text.includes('__WIDGET_INDEXER_SKELETON__')) {
    const skeletonHtml = `
      <div class="code-block-card widget-indexer-card">
        <div class="code-block-header">
          <span class="code-lang-label" style="display:flex; align-items:center; gap:6px;">
            ${icons.palette} <span>Interactive Component</span>
          </span>
          <span class="widget-indexer-pill">
            <span class="status-indicator-dot online"></span> Indexing Live Sandbox...
          </span>
        </div>
        <div class="widget-indexer-stage">
          <div class="widget-indexer-mascot-box">
            <img src="assets/frames/eyqa_far.png" alt="Eyqa Indexer" class="widget-indexer-mascot widget-looping-mascot" />
          </div>
          <div class="widget-indexer-text">
            <strong>Eyqa is building interactive component</strong>
            <p>Indexing live code and preparing interactive view...</p>
          </div>
        </div>
      </div>
    `;
    text = text.replace('__WIDGET_INDEXER_SKELETON__', skeletonHtml);
  }

  // 15. Reinsert formatted code blocks with clean 3-way separation:
  // - Category 1: Interactive Widget / Embed (explicit widget, quiz, chart, html:preview)
  // - Category 2: Ready-to-copy code snippet (html, js, ts, py, bash, css etc.)
  codeBlocks.forEach((block, idx) => {
    const id = `__CODE_BLOCK_${idx}__`;
    const escapedCode = escapeHtml(block.code);
    
    const widgetLangs = ['widget', 'chart', 'quiz', 'html:preview', 'interactive', 'eyqa-widget', 'sandbox', 'draw'];
    const isExplicitWidget = widgetLangs.includes(block.lang);
    const isInteractiveHtml = (block.lang === 'html' || block.lang === 'htm' || block.lang === 'svg') &&
      (/<(!doctype|html|head|body|script|style|svg|canvas|button|form|input|table|ul|ol|main|article|section)/i.test(block.code) ||
       block.code.includes('eyqa-draw-canvas') ||
       block.code.includes('agent-embed') ||
       block.code.includes('eyqa-widget'));

    const isInteractiveWidget = isExplicitWidget || isInteractiveHtml;

    if (isInteractiveWidget) {
      // Category 1: Interactive Component Sandbox Card
      const widgetTitle = block.lang === 'chart' ? 'Interactive Chart' :
                          block.lang === 'quiz' ? 'Interactive Quiz' :
                          'Interactive Component';

      const codeCard = `
        <div class="code-block-card html-canvas-card" data-code="${encodeURIComponent(block.code)}" data-lang="${block.lang}">
          <div class="code-block-header" style="background: var(--bg-sec); border-bottom: 1px solid var(--border);">
            <span class="code-lang-label" style="display:flex; align-items:center; gap:6px;">
              ${icons.palette} <span>${widgetTitle}</span>
              <span class="widget-type-badge">Live Sandbox</span>
            </span>
            <div class="code-block-actions" style="display:flex; gap:6px;">
              <button class="code-action-btn btn-toggle-preview active" title="Toggle Preview / Source Code">
                <span>Preview</span>
              </button>
              <button class="code-action-btn btn-fullscreen-canvas" title="Popout Fullscreen">
                <span>Popout</span>
              </button>
              <button class="code-action-btn btn-copy-code" title="Copy code to clipboard">
                <span>Copy</span>
              </button>
            </div>
          </div>
          <div class="canvas-container live-preview-box" style="display: block; width:100%; height:340px; background:#111111; border-bottom-left-radius:8px; border-bottom-right-radius:8px; overflow:hidden;">
            <iframe class="html-live-preview" sandbox="allow-scripts allow-forms allow-modals allow-popups" style="width:100%; height:100%; border:none; background:#111111;" data-code="${encodeURIComponent(block.code)}"></iframe>
          </div>
          <pre class="code-block-pre source-code-box" style="display: none; margin:0;"><code class="code-block-code language-${block.lang}">${escapedCode}</code></pre>
        </div>
      `;
      text = text.replace(id, codeCard);
    } else {
      // Category 2: Ready-to-Copy Standard Code Block (regular html, js, py, bash, etc.)
      // Crucial: Standard HTML code blocks are clean code to copy, NOT an iframe!
      const langDisplay = block.lang.toUpperCase();
      const codeCard = `
        <div class="code-block-card standard-code-card" data-code="${encodeURIComponent(block.code)}" data-lang="${block.lang}">
          <div class="code-block-header">
            <span class="code-lang-label">${langDisplay}</span>
            <div class="code-block-actions">
              <button class="code-action-btn btn-copy-code" title="Copy code to clipboard">
                <span>Copy Code</span>
              </button>
            </div>
          </div>
          <pre class="code-block-pre"><code class="code-block-code language-${block.lang}">${escapedCode}</code></pre>
        </div>
      `;
      text = text.replace(id, codeCard);
    }
  });
  return text;
}

function renderTables(text) {
  const tableRegex = /\|(.+)\|[\r\n]+\|([-:\s|]+)\|[\r\n]+((?:\|.*\|[\r\n]*)+)/g;
  return text.replace(tableRegex, (match, headerRow, alignRow, bodyRows) => {
    const headers = headerRow.split('|').map(h => h.trim()).filter(Boolean);
    const ths = headers.map(h => `<th>${h}</th>`).join('');

    const rows = bodyRows.trim().split('\n').map(row => {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      const tds = cells.map(c => `<td>${c}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    return `
      <div class="table-container">
        <table class="md-table">
          <thead><tr>${ths}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  });
}

/**
 * Eyqa High-Speed Markdown & Code Renderer
 * Lightweight, safe, zero-dependency parser designed for instant streaming.
 */

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderMarkdown(rawText) {
  if (!rawText) return '';

  let text = rawText;

  // 1. Extract and preserve code blocks
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang.toLowerCase().trim() || 'text', code: code.trim() });
    return id;
  });

  // 2. Escape remaining HTML
  text = escapeHtml(text);

  // 3. Headers
  text = text.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // 4. Blockquotes
  text = text.replace(/^\> (.*$)/gim, '<blockquote class="md-blockquote">$1</blockquote>');

  // 5. Bold & Italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // 6. Inline code
  text = text.replace(/`([^`]+)`/gim, '<code class="md-inline-code">$1</code>');

  // 7. Markdown Links [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>');

  // 8. Horizontal rules
  text = text.replace(/^---$/gim, '<hr class="md-hr" />');

  // 9. Unordered Lists
  text = text.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="md-li">$1</li>');
  text = text.replace(/(<li class="md-li">[\s\S]*?<\/li>)/gim, '<ul class="md-ul">$1</ul>');
  // Clean duplicate uls
  text = text.replace(/<\/ul>\s*<ul class="md-ul">/gim, '');

  // 10. Numbered Lists
  text = text.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="md-oli" value="$1">$2</li>');
  text = text.replace(/(<li class="md-oli"[^>]*>[\s\S]*?<\/li>)/gim, '<ol class="md-ol">$1</ol>');
  text = text.replace(/<\/ol>\s*<ol class="md-ol">/gim, '');

  // 11. Tables
  text = renderTables(text);

  // 12. Paragraphs (lines separated by double newlines)
  const paragraphs = text.split(/\n\n+/);
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    // Skip wrapping tags that are already blocks
    if (p.startsWith('<h1') || p.startsWith('<h2') || p.startsWith('<h3') ||
        p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<blockquote') ||
        p.startsWith('<hr') || p.startsWith('<table') || p.startsWith('__CODE_BLOCK_')) {
      return p;
    }
    return `<p class="md-p">${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  // 13. Reinsert formatted code blocks with Copy & Canvas buttons
  codeBlocks.forEach((block, idx) => {
    const id = `__CODE_BLOCK_${idx}__`;
    const escapedCode = escapeHtml(block.code);
    const codeCard = `
      <div class="code-block-card" data-code="${encodeURIComponent(block.code)}" data-lang="${block.lang}">
        <div class="code-block-header">
          <span class="code-lang-label">${block.lang}</span>
          <div class="code-block-actions">
            <button class="code-action-btn btn-copy-code" title="Copy code to clipboard">
              <span>Copy</span>
            </button>
          </div>
        </div>
        <pre class="code-block-pre"><code class="code-block-code language-${block.lang}">${escapedCode}</code></pre>
      </div>
    `;
    text = text.replace(id, codeCard);
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

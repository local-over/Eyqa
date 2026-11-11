/**
 * Eyqa Web Fetch Tool
 * Fetches any public URL, strips noise (scripts, stylesheets, ads, nav),
 * and converts the content into clean, readable text/markdown for the AI coworker.
 */

async function fetchWebpage(targetUrl, maxChars = 20000) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { error: 'Target URL must be a non-empty string' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { error: 'Only http and https protocols are supported' };
    }
  } catch (err) {
    return { error: `Invalid URL format: ${targetUrl}` };
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(parsedUrl.href, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        url: targetUrl,
        error: `HTTP Error: ${response.status} ${response.statusText}`
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/') && !contentType.includes('html') && !contentType.includes('json')) {
      return {
        url: targetUrl,
        error: `Unsupported content-type: ${contentType}. Only text and HTML pages can be read.`
      };
    }

    const raw = await response.text();

    // Extract title
    let title = '';
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Strip scripts, styles, svg, canvas, forms, headers, footers, navs
    let clean = raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '');

    // Convert headings to markdown
    clean = clean.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    clean = clean.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    clean = clean.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    clean = clean.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n#### $1\n');

    // Convert list items
    clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');

    // Convert paragraphs & linebreaks
    clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
    clean = clean.replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining tags
    clean = clean.replace(/<[^>]+>/g, ' ');

    // Normalize whitespaces & decode entities
    clean = clean
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    if (clean.length > maxChars) {
      clean = clean.slice(0, maxChars) + '\n\n... [Content truncated due to length]';
    }

    return {
      url: targetUrl,
      finalUrl: response.url,
      title: title || targetUrl,
      charCount: clean.length,
      content: clean
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { url: targetUrl, error: 'Webpage fetch timed out after 10 seconds' };
    }
    return { url: targetUrl, error: `Failed to fetch webpage: ${err.message}` };
  }
}

module.exports = {
  fetchWebpage
};

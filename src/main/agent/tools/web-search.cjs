/**
 * Eyqa Web Search Tool
 * Fast, free, instant live web searches using privacy-first DuckDuckGo HTML parsing.
 * No API key required, zero billing, zero rate limits under normal usage.
 */

async function searchWeb(query, maxResults = 5) {
  if (!query || typeof query !== 'string') {
    return { error: 'Search query must be a non-empty string' };
  }

  const encodedQuery = encodeURIComponent(query.trim());
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://html.duckduckgo.com/'
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { error: `Search engine returned HTTP ${response.status}` };
    }

    const html = await response.text();
    const results = [];

    // Extract search result links containing uddg redirects
    // Standard DuckDuckGo HTML formats result items with links to //duckduckgo.com/l/?uddg=...
    const linkRegex = /<a\s+[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    const seenUrls = new Set();

    while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const rawHref = match[1];
      const rawText = match[2].replace(/<[^>]+>/g, '').trim();

      // Check for uddg query parameter (the actual destination URL)
      let destinationUrl = null;
      if (rawHref.includes('uddg=')) {
        try {
          const parsed = new URL(rawHref, 'https://duckduckgo.com');
          const uddg = parsed.searchParams.get('uddg');
          if (uddg) destinationUrl = decodeURIComponent(uddg);
        } catch {
          // ignore parsing error
        }
      } else if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
        if (!rawHref.includes('duckduckgo.com')) {
          destinationUrl = rawHref;
        }
      }

      if (destinationUrl && !seenUrls.has(destinationUrl) && rawText.length > 3) {
        // Skip DuckDuckGo internal navigation links
        if (destinationUrl.includes('duckduckgo.com') || destinationUrl.includes('spreadprivacy.com')) {
          continue;
        }

        seenUrls.add(destinationUrl);

        // Find surrounding snippet if available
        let snippet = '';
        const snippetIndex = html.indexOf(rawHref);
        if (snippetIndex !== -1) {
          const snippetChunk = html.slice(snippetIndex, snippetIndex + 800);
          const snippetMatch = snippetChunk.match(/<a\s+class=\"result__snippet\"[^>]*>([\s\S]*?)<\/a>/i);
          if (snippetMatch) {
            snippet = snippetMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        }

        results.push({
          title: rawText,
          url: destinationUrl,
          snippet: snippet || rawText
        });
      }
    }

    return {
      query,
      count: results.length,
      results
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { error: 'Search request timed out after 8 seconds' };
    }
    return { error: `Failed to perform web search: ${err.message}` };
  }
}

module.exports = {
  searchWeb
};

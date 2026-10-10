/**
 * Eyqa Web Standalone Server
 * Allows running Eyqa in any web browser without Electron if desired.
 * Runs on http://localhost:4321
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { ConfigStore } = require('./main/storage/config-store.cjs');
const { SessionStore } = require('./main/storage/session-store.cjs');
const { ProviderManager } = require('./main/agent/providers/provider-manager.cjs');
const { AgentOrchestrator } = require('./main/agent/orchestrator.cjs');
const { searchWeb } = require('./main/agent/tools/web-search.cjs');
const { fetchWebpage } = require('./main/agent/tools/web-fetch.cjs');
const {
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile
} = require('./main/agent/tools/workspace.cjs');

const configStore = new ConfigStore();
const sessionStore = new SessionStore();
const providerManager = new ProviderManager(configStore);
const orchestrator = new AgentOrchestrator(providerManager, configStore);

const PORT = process.env.PORT || 4321;
const RENDERER_DIR = path.join(__dirname, 'renderer');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS headers for local access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, parsedUrl);
    return;
  }

  // Static File Serving
  let filePath = path.join(RENDERER_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check
  if (!filePath.startsWith(RENDERER_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Default to index.html for SPA
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(path.join(RENDERER_DIR, 'index.html')).pipe(res);
  }
});

async function handleApi(req, res, pathname, parsedUrl) {
  const jsonResponse = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const getBody = () => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });

  try {
    if (pathname === '/api/settings' && req.method === 'GET') {
      return jsonResponse(configStore.get());
    }

    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await getBody();
      return jsonResponse(configStore.update(body));
    }

    if (pathname === '/api/provider/test' && req.method === 'POST') {
      const body = await getBody();
      const result = await providerManager.testProvider(body.id, body.config);
      return jsonResponse(result);
    }

    if (pathname === '/api/sessions' && req.method === 'GET') {
      return jsonResponse(sessionStore.listSessions());
    }

    if (pathname === '/api/sessions' && req.method === 'POST') {
      const body = await getBody();
      return jsonResponse(sessionStore.createSession(body.title, body.mode, body.folder));
    }

    if (pathname.startsWith('/api/sessions/') && req.method === 'GET') {
      const id = pathname.split('/')[3];
      return jsonResponse(sessionStore.getSession(id));
    }

    if (pathname.startsWith('/api/sessions/') && req.method === 'PUT') {
      const body = await getBody();
      sessionStore.saveSession(body);
      return jsonResponse({ success: true });
    }

    if (pathname.startsWith('/api/sessions/') && req.method === 'DELETE') {
      const id = pathname.split('/')[3];
      return jsonResponse({ success: sessionStore.deleteSession(id) });
    }

    // Agent Streaming Turn (SSE)
    if (pathname === '/api/agent/stream' && req.method === 'POST') {
      const payload = await getBody();

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await orchestrator.runTurn({
          sessionId: payload.sessionId,
          messages: payload.messages,
          userMessage: payload.userMessage,
          folderPath: payload.folderPath,
          modeId: payload.modeId,
          providerId: payload.providerId,
          enableTools: payload.enableTools !== false,
          forceWebSearch: payload.forceWebSearch === true,
          onToken: (tok) => sendEvent('token', tok),
          onThought: (th) => sendEvent('thought', th),
          onToolStart: (ti) => sendEvent('tool-start', ti),
          onToolResult: (ri) => sendEvent('tool-result', ri),
          onFallback: (fb) => sendEvent('fallback', fb)
        });

        sendEvent('done', result);
      } catch (err) {
        sendEvent('error', err.message);
      } finally {
        res.end();
      }
      return;
    }

    jsonResponse({ error: 'Endpoint not found' }, 404);
  } catch (err) {
    jsonResponse({ error: err.message }, 500);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✨ Eyqa Web Server is running on http://localhost:${PORT}`);
  console.log(`🌐 Ready for any browser on Linux, Mac, Windows, or Mobile!\n`);
});

/**
 * server.cjs
 * ❄️ ICE Crawler — Dashboard Server (CommonJS)
 * Express + WebSocket + AGNT integration
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 8765;
const AGNT_API = process.env.AGNT_API || 'http://localhost:3333/api';

// ─── AGNT API helper ──────────────────────────────────────────────────
function agntFetch(apiPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(AGNT_API + apiPath);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    const token = process.env.AGNT_AUTH_TOKEN;
    if (token) reqOptions.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// ─── In-memory state ──────────────────────────────────────────────────
const state = {
  currentRun: null,
  artifacts: [],
  events: [],
  submissions: [],
  lastResult: null,
};

// ─── Serve static files from ui/ ──────────────────────────────────────
function serveStatic(filePath, contentType) {
  const fullPath = path.join(__dirname, '..', 'ui', filePath);
  try {
    const data = fs.readFileSync(fullPath);
    return { status: 200, body: data, contentType };
  } catch {
    return { status: 404, body: 'Not Found', contentType: 'text/plain' };
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Static files
  if (req.url === '/dashboard.css') {
    const s = serveStatic('dashboard.css', 'text/css');
    res.writeHead(s.status, { 'Content-Type': s.contentType });
    res.end(s.body);
    return;
  }
  if (req.url === '/dashboard.js') {
    const s = serveStatic('dashboard.js', 'application/javascript');
    res.writeHead(s.status, { 'Content-Type': s.contentType });
    res.end(s.body);
    return;
  }

  // Dashboard HTML
  if (req.url === '/' || req.url === '/dashboard') {
    const s = serveStatic('dashboard.html', 'text/html');
    res.writeHead(s.status, { 'Content-Type': s.contentType });
    res.end(s.body);
    return;
  }

  // API: artifacts
  if (req.url === '/api/artifacts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state.artifacts));
    return;
  }

  // API: status
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: state.currentRun ? 'running' : 'idle',
      lastResult: state.lastResult,
      artifacts: state.artifacts.length,
      events: state.events.length,
    }));
    return;
  }

  // API: AGNT URL
  if (req.url === '/api/agnt-url') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: 'http://localhost:3333' }));
    return;
  }

  // API: run (start pipeline)
  if (req.url === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'started', params }));

        // Run pipeline asynchronously
        const { runPipeline } = await import('./engine/orchestrator.js');
        const result = await runPipeline({
          ...params,
          on_event: (event) => {
            state.events.push(event);
            // Broadcast to WebSocket clients
            const msg = JSON.stringify(event);
            wss.clients.forEach(client => {
              if (client.readyState === 1) {
                try { client.send(msg); } catch {}
              }
            });
          },
        });

        state.lastResult = result;
        state.artifacts = result.artifacts?.manifest?.map(f => ({
          name: f.path, type: 'crystal', size: f.size_kb + ' KB', sha256: f.sha256,
        })) || [];

        // Broadcast final result
        const finalMsg = JSON.stringify({ type: 'RUN_COMPLETE', ...result });
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            try { client.send(finalMsg); } catch {}
          }
        });

      } catch (err) {
        console.error('Pipeline error:', err.message);
      }
    });
    return;
  }

  // API: submit to AGNT
  if (req.url === '/api/submit' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });

    const lastRun = state.lastResult;
    if (!lastRun || lastRun.error) {
      res.end(JSON.stringify({ success: false, error: 'No completed run to submit' }));
      return;
    }

    // Build submission payload
    const submission = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      source: 'ice-crawler',
      run_id: lastRun.run_id,
      repo_url: lastRun.repo_url,
      files_crystallized: lastRun.phases?.crystal?.files_crystallized || 0,
      root_seal: lastRun.artifacts?.root_seal,
      run_state_dir: lastRun.run_state_dir,
      description: `ICE Crawler ingestion: ${lastRun.phases?.crystal?.files_crystallized || 0} files crystallized. Seal: ${lastRun.artifacts?.root_seal?.slice(0, 16)}...`,
    };

    state.submissions.push(submission);

    // Try to create AGNT conversation via API
    agntFetch('/conversations', {
      method: 'POST',
      body: {
        title: 'ICE Crawler: ' + lastRun.repo_url,
        message: `ICE Crawler ingestion complete.\n\nRepository: ${lastRun.repo_url}\nFiles crystallized: ${lastRun.phases?.crystal?.files_crystallized || 0}\nRoot seal: ${lastRun.artifacts?.root_seal}\nArtifacts: ${lastRun.run_state_dir}\n\nPlease analyze the crystallized artifacts.`,
      },
    })
      .then(agntResult => {
        console.log('AGNT conversation created:', agntResult.body);
        // Broadcast to clients
        const msg = JSON.stringify({
          type: 'SUBMIT_SUCCESS',
          submission,
          agnt: agntResult.body,
          agntUrl: 'http://localhost:3333',
        });
        wss.clients.forEach(client => {
          if (client.readyState === 1) {
            try { client.send(msg); } catch {}
          }
        });
      })
      .catch(err => {
        console.log('AGNT API unavailable (expected if not running):', err.message);
        // Still return success — user can open AGNT manually
      });

    res.end(JSON.stringify({
      success: true,
      submissionId: submission.id,
      description: submission.description,
      agntUrl: 'http://localhost:3333',
      message: 'Submission ready. Open AGNT to continue analysis.',
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ─── WebSocket ────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Dashboard client connected');

  // Send existing events to new client
  state.events.forEach(event => {
    try { ws.send(JSON.stringify(event)); } catch {}
  });

  ws.on('close', () => {
    console.log('Dashboard client disconnected');
  });
});

// ─── Start ───────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n  ❄️  ICE Crawler Dashboard → http://localhost:${PORT}\n`);
});

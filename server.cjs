/**
 * server.cjs
 * ❄️ ICE Crawler — Dashboard Server v2.0 (CommonJS)
 * Express + WebSocket + AGNT API integration
 * 
 * Features:
 * - Persistent background server
 * - Real-time WebSocket event streaming
 * - AGNT chat thread creation with artifact delivery
 * - Run history and artifact registry
 * - Incremental mode (git fetch vs re-clone)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 8765;
const AGNT_API = process.env.AGNT_API || 'http://localhost:3333/api';
const WORKSPACE = process.env.ICE_CRAWLER_WORKSPACE || path.join(process.cwd(), 'state');

// ─── State ──────────────────────────────────────────────────────────────
const state = {
  currentRun: null,
  latestResult: null,
  artifacts: [],
  events: [],
  runs: [],
  submissions: [],
};

// ─── AGNT API ───────────────────────────────────────────────────────────
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
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

// ─── Broadcast to WebSocket clients ─────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      try { client.send(msg); } catch {}
    }
  });
}

// ─── Dashboard HTML ─────────────────────────────────────────────────────
function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>❄️ ICE Crawler — Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;600;700;900&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/dashboard.css">
</head>
<body>
<div class="header">
  <h1><span class="icon">❄️</span> ICE Crawler</h1>
  <div class="header-right">
    <span id="connectionStatus" class="conn-dot disconnected"></span>
    <span class="status-badge" id="runStatusBadge">Idle</span>
  </div>
</div>

<div class="phase-ladder" id="phaseLadder">
  <div class="phase"><div class="phase-dot" id="dot-frost">❄</div><div class="phase-label" id="label-frost">Frost</div></div>
  <div class="phase-connector" id="conn-frost"></div>
  <div class="phase"><div class="phase-dot" id="dot-glacier">🧊</div><div class="phase-label" id="label-glacier">Glacier</div></div>
  <div class="phase-connector" id="conn-glacier"></div>
  <div class="phase"><div class="phase-dot" id="dot-crystal">💎</div><div class="phase-label" id="label-crystal">Crystal</div></div>
  <div class="phase-connector" id="conn-crystal"></div>
  <div class="phase"><div class="phase-dot" id="dot-residue">🔒</div><div class="phase-label" id="label-residue">Residue</div></div>
</div>

<div class="progress-section">
  <div class="progress-bar-container"><div class="progress-bar" id="progressBar" style="width:0%"></div></div>
  <div class="progress-text"><span id="progressLabel">Ready</span><span id="progressPercent">0%</span></div>
</div>

<div class="stats-grid">
  <div class="stat-card"><div class="stat-value pink" id="statFiles">0</div><div class="stat-label">Files</div></div>
  <div class="stat-card"><div class="stat-value green" id="statSeal">—</div><div class="stat-label">Root Seal</div></div>
  <div class="stat-card"><div class="stat-value yellow" id="statAgents">0/4</div><div class="stat-label">Agents</div></div>
  <div class="stat-card"><div class="stat-value" id="statDuration">0s</div><div class="stat-label">Duration</div></div>
</div>

<div class="main-grid">
  <div class="panel">
    <div class="panel-header"><div class="panel-title">📡 Event Stream</div><span class="event-count" id="eventCount">0 events</span></div>
    <div class="panel-body" id="eventStream"><div class="event-row placeholder"><span class="event-msg">Waiting for pipeline to start...</span></div></div>
  </div>
  <div class="panel">
    <div class="panel-header"><div class="panel-title">📦 Artifacts</div></div>
    <div class="panel-body" id="artifactList"><div class="artifact-row placeholder"><span class="artifact-name">No artifacts yet</span></div></div>
  </div>
</div>

<div class="run-panel">
  <div class="panel">
    <div class="panel-header"><div class="panel-title">🚀 New Run</div></div>
    <div class="panel-body">
      <div class="form-group"><label class="form-label">Repository URL</label><input class="form-input" id="repoUrl" type="text" placeholder="https://github.com/owner/repo"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Max Files</label><input class="form-input" id="maxFiles" type="number" value="60" min="1" max="500"></div>
        <div class="form-group"><label class="form-label">Max KB</label><input class="form-input" id="maxKb" type="number" value="256" min="1" max="2048"></div>
      </div>
      <div class="form-group"><label class="form-label">Mode</label><select class="form-input" id="runMode"><option value="full">Full Ingest</option><option value="incremental">Incremental (git fetch)</option><option value="estimate">Estimate Only</option></select></div>
      <button class="btn btn-run" id="runBtn" onclick="startRun()">❄️ Start Ingestion</button>
    </div>
  </div>
</div>

<!-- Submit Panel (hidden until run completes) -->
<div class="submit-panel" id="submitPanel" style="display:none">
  <h3>✅ Ingestion Complete</h3>
  <p id="submitSummary">Pipeline finished. Submit to AGNT to open an analysis thread with your artifacts.</p>
  <div class="submit-status" id="submitStatus"></div>
  <button class="btn btn-submit" id="submitBtn" onclick="submitToAgnt()">📤 Submit to AGNT Thread</button>
  <button class="btn btn-open" onclick="window.open('http://localhost:3333','_blank')">💬 Open AGNT Chat</button>
</div>

<!-- Run History -->
<div class="run-history" id="runHistory" style="display:none">
  <div class="panel">
    <div class="panel-header"><div class="panel-title">📜 Run History</div></div>
    <div class="panel-body" id="historyList"></div>
  </div>
</div>

<div class="footer">ICE Crawler v2.0 — Triadic Zero-Trace Repository Ingestion — <a href="https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin">GitHub</a></div>
<script src="/dashboard.js"></script>
</body>
</html>`;
}

// ─── HTTP Server ────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  switch (req.url) {
    case '/':
    case '/dashboard':
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getDashboardHtml());
      break;

    case '/dashboard.css':
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(getDashboardCSS());
      break;

    case '/dashboard.js':
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(getDashboardJS());
      break;

    case '/api/status':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: state.currentRun ? 'running' : 'idle',
        latestResult: state.latestResult,
        totalRuns: state.runs.length,
        totalSubmissions: state.submissions.length,
      }));
      break;

    case '/api/artifacts':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state.artifacts));
      break;

    case '/api/runs':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state.runs));
      break;

    case '/api/run':
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const params = JSON.parse(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'started', params }));
            await runPipeline(params);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      } else {
        res.writeHead(405);
        res.end('Method Not Allowed');
      }
      break;

    case '/api/submit':
      if (req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        try {
          const result = state.latestResult;
          if (!result || result.error) {
            res.end(JSON.stringify({ success: false, error: 'No completed run to submit' }));
            return;
          }

          const submission = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            source: 'ice-crawler',
            result: {
              run_id: result.run_id,
              repo_url: result.repo_url,
              files_crystallized: result.phases?.crystal?.files_crystallized || 0,
              root_seal: result.artifacts?.root_seal,
              run_state_dir: result.run_state_dir,
            },
          };
          state.submissions.push(submission);

          // Try to create AGNT thread
          agntCreateThread(result)
            .then(threadResult => {
              broadcast({ type: 'SUBMIT_SUCCESS', submission, thread: threadResult });
            })
            .catch(err => {
              console.log('AGNT thread creation failed:', err.message);
              broadcast({ type: 'SUBMIT_FALLBACK', submission, agntUrl: 'http://localhost:3333' });
            });

          res.end(JSON.stringify({
            success: true,
            submissionId: submission.id,
            message: 'Submitting to AGNT...',
          }));
        } catch (err) {
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      }
      break;

    default:
      res.writeHead(404);
      res.end('Not Found');
  }
});

// ─── AGNT Thread Creation ───────────────────────────────────────────────
async function agntCreateThread(result) {
  const seal = result.artifacts?.root_seal || 'N/A';
  const fileCount = result.phases?.crystal?.files_crystallized || 0;
  const repoUrl = result.repo_url;

  const message = `❄️ ICE Crawler — Repository Ingestion Complete

**Repository:** ${repoUrl}
**Files Crystallized:** ${fileCount}
**Root Seal:** ${seal}

**Artifact Location:** ${result.run_state_dir}

**Next Steps:**
- Review crystallized artifacts in the run directory
- Use analysis tools to examine the codebase
- Ask questions about the repository structure

*This thread was auto-created by ICE Crawler. The artifact bundle is ready for analysis.*`;

  try {
    // Try to create a new conversation via AGNT API
    const convResult = await agntFetch('/conversations', {
      method: 'POST',
      body: {
        title: `ICE Crawler: ${repoUrl.split('/').pop()}`,
        message: message,
      },
    });

    if (convResult.status === 200 || convResult.status === 201) {
      return { conversationId: convResult.body?.id, url: `http://localhost:3333` };
    }

    // Fallback: try the chat endpoint
    const chatResult = await agntFetch('/chat', {
      method: 'POST',
      body: {
        message: message,
        provider: 'orchestrator',
      },
    });

    return { conversationId: chatResult.body?.conversationId, url: 'http://localhost:3333' };
  } catch (err) {
    // Fallback: just return the AGNT URL
    return { conversationId: null, url: 'http://localhost:3333', error: err.message };
  }
}

// ─── Pipeline Runner ────────────────────────────────────────────────────
async function runPipeline(options) {
  const { repo_url, max_files = 60, max_kb = 256, mode = 'full' } = options;
  const runId = generateRunId();
  const runStateDir = path.join(WORKSPACE, 'runs', runId);
  const tempDir = path.join(WORKSPACE, 'temp', runId);

  fs.mkdirSync(runStateDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  state.currentRun = { run_id: runId, repo_url, status: 'running', started_at: nowIso() };
  state.events = [];

  const emit = (type, phase, data = {}) => {
    const event = { ts: nowIso(), type, phase, run_id: runId, ...data };
    state.events.push(event);
    broadcast(event);
    return event;
  };

  const result = {
    run_id: runId, repo_url, run_state_dir: runStateDir,
    phases: {}, artifacts: {}, events: [],
  };

  try {
    // ═══ PHASE 1: FROST ═══
    emit('FROST_PENDING', 'frost', { message: 'Resolving repository HEAD...' });

    const { frostTelemetry } = await import('./engine/orchestrator.js').catch(() => ({}));
    let frostResult;
    if (frostTelemetry) {
      frostResult = frostTelemetry(repo_url);
    } else {
      // Inline frost
      const { execSync } = require('child_process');
      const { normalizeRepositoryUrl } = await import('./engine/repo-url.js');
      const normalized = normalizeRepositoryUrl(repo_url);
      let head = 'unknown';
      try {
        const out = execSync(`git ls-remote "${normalized}" HEAD`, { encoding: 'utf-8', timeout: 30000 });
        if (out.trim()) head = out.trim().split(/\s+/)[0];
      } catch {}
      frostResult = { ts: nowIso(), repo: repo_url, head, mode: 'telemetry_only' };
    }

    fs.writeFileSync(path.join(runStateDir, 'frost_summary.json'), JSON.stringify(frostResult, null, 2));
    result.phases.frost = frostResult;
    emit('FROST_VERIFIED', 'frost', { head: frostResult.head, repo: frostResult.repo });

    if (mode === 'estimate') {
      result.status = 'complete';
      result.finished_at = nowIso();
      state.currentRun = null;
      state.latestResult = result;
      state.runs.push(result);
      emit('RUN_COMPLETE', 'complete', { run_id: runId, total_files: 0, root_seal: '', message: 'Estimate complete' });
      return result;
    }

    // ═══ PHASE 2: GLACIER ═══
    emit('GLACIER_PENDING', 'glacier', { message: 'Shallow cloning repository...' });

    const { execSync } = require('child_process');
    const { normalizeRepositoryUrl } = await import('./engine/repo-url.js');
    const normalizedUrl = normalizeRepositoryUrl(repo_url);

    // Check for existing clone (incremental mode)
    const cacheDir = path.join(WORKSPACE, 'cache', repo_url.replace(/[^a-zA-Z0-9]/g, '_'));
    if (mode === 'incremental' && fs.existsSync(path.join(cacheDir, '.git'))) {
      emit('GLACIER_CACHE', 'glacier', { message: 'Using cached clone, fetching updates...' });
      execSync(`git -C "${cacheDir}" fetch --depth=1 --force`, { encoding: 'utf-8', timeout: 60000 });
      execSync(`git -C "${cacheDir}" checkout --detach FETCH_HEAD`, { encoding: 'utf-8', timeout: 30000 });
      // Copy to temp
      execSync(`xcopy /E /I /Y "${cacheDir}" "${tempDir}"`, { encoding: 'utf-8', timeout: 30000 });
    } else {
      execSync(`git clone --depth=1 --single-branch "${normalizedUrl}" "${tempDir}"`, { encoding: 'utf-8', timeout: 120000 });
      // Cache the clone
      fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
      if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.cpSync(tempDir, cacheDir, { recursive: true });
    }

    emit('GLACIER_CLONED', 'glacier', { message: 'Clone complete, selecting files...' });

    // Walk files
    const allFiles = walkDir(tempDir);
    const { glacierSelect } = await import('./engine/glacier.js');
    const selectionResult = glacierSelect(allFiles, max_files);
    fs.writeFileSync(path.join(runStateDir, 'glacier_ref.json'), JSON.stringify(selectionResult, null, 2));
    fs.writeFileSync(path.join(runStateDir, 'tree_snapshot.txt'), selectionResult.picked.join('\n'));

    result.phases.glacier = {
      total_files_found: allFiles.length,
      selected_files: selectionResult.picked.length,
      buckets: selectionResult.buckets,
    };
    emit('GLACIER_VERIFIED', 'glacier', {
      selected: selectionResult.picked.length,
      total: allFiles.length,
      message: `${selectionResult.picked.length} files selected via triadic balanced interleave`,
    });

    // ═══ PHASE 3: CRYSTAL ═══
    emit('CRYSTAL_PENDING', 'crystal', { message: 'Crystallizing artifact bundle...' });

    const { crystalCrystallize, sha256Text } = await import('./engine/crystal.js');
    const crystalResult = crystalCrystallize(tempDir, runStateDir, { max_files, max_kb, max_file_bytes: max_kb * 1024 });

    emit('CRYSTAL_COPIED', 'crystal', { files_copied: crystalResult.manifest.length });

    // Run Crystal++ agents
    const { AgentContext } = await import('./engine/agents/agent-base.js');
    const ctx = new AgentContext({
      repo_root: tempDir, run_state_dir: runStateDir,
      synthesis_dir: crystalResult.synthesisDir, max_files: 600, max_kb,
    });

    const agentResults = {};
    const agents = [
      ['filetype_stats', './engine/agents/filetype-stats.js'],
      ['imports_index', './engine/agents/imports-index.js'],
      ['hotspots', './engine/agents/hotspots.js'],
      ['readme_synthesis', './engine/agents/readme-synthesis.js'],
    ];

    for (const [name, agentPath] of agents) {
      try {
        const agent = await import(agentPath);
        agent.run(ctx);
        emit('CRYSTAL_AGENT', 'crystal', { agent: name, status: 'done' });
        agentResults[name] = true;
      } catch (e) {
        agentResults[name] = { error: e.message };
      }
    }

    result.phases.crystal = {
      files_crystallized: crystalResult.manifest.length,
      total_skipped: crystalResult.copyReport.skipped,
      agents: agentResults,
    };

    const agentsComplete = Object.values(agentResults).filter(v => v === true).length;
    emit('CRYSTAL_VERIFIED', 'crystal', {
      files: crystalResult.manifest.length,
      skipped: crystalResult.copyReport.skipped,
      agents_completed: agentsComplete,
      message: `${crystalResult.manifest.length} files sealed with SHA-256`,
    });

    // ═══ PHASE 4: RESIDUE ═══
    emit('RESIDUE_PENDING', 'residue', { message: 'Purging temporary workspace...' });

    fs.rmSync(tempDir, { recursive: true, force: true });
    const purged = !fs.existsSync(tempDir);

    const residueTruth = { ts: nowIso(), temp_dir: tempDir, purged, residue_empty: purged, proof: purged ? 'ρ = ∅' : 'PURGE_INCOMPLETE' };
    fs.writeFileSync(path.join(runStateDir, 'residue_truth.json'), JSON.stringify(residueTruth, null, 2));
    result.phases.residue = residueTruth;
    emit('RESIDUE_EMPTY_LOCK', 'residue', { purged, proof: residueTruth.proof });

    // ═══ AI HANDOFF ═══
    const manifestCompact = crystalResult.manifest.map(f => ({ path: f.path, sha256: f.sha256, size_kb: f.size_kb }));
    const manifestCompactHash = sha256Text(JSON.stringify(manifestCompact));
    const rootSeal = sha256Text(frostResult.head + manifestCompactHash + 'ICE_CRAWLER_V4_0P');

    const handoffDir = path.join(runStateDir, 'ai_handoff');
    fs.mkdirSync(handoffDir, { recursive: true });
    fs.writeFileSync(path.join(handoffDir, 'manifest_compact.json'), JSON.stringify(manifestCompact, null, 2));
    fs.writeFileSync(path.join(handoffDir, 'root_seal.txt'), rootSeal);

    const promptReady = `# ICE Crawler — AI Handoff

## Repository: ${repo_url}
## HEAD: ${frostResult.head}
## Run ID: ${runId}
## Root Seal: ${rootSeal}

## Artifact Manifest
${manifestCompact.map(f => `- ${f.path} (${f.size_kb} KB) [${f.sha256.slice(0, 8)}]`).join('\n')}

## Synthesis Artifacts
- filetype_stats.json — language/extension breakdown
- imports_index.json — dependency graph
- hotspots.json — largest files
- readme_synthesis.json — README extraction

## Determinism Contract
For identical (repo, revision, config) inputs, output artifacts are stable in file set and hash structure.
All files sealed with SHA-256. Root seal = SHA256(head + manifest_hash + "ICE_CRAWLER_V4_0P").
`;
    fs.writeFileSync(path.join(handoffDir, 'PROMPT_READY.md'), promptReady);

    result.artifacts = {
      manifest: crystalResult.manifest, root_seal: rootSeal,
      manifest_compact: manifestCompact, synthesis_dir: crystalResult.synthesisDir,
      handoff_dir: handoffDir, prompt_ready: path.join(handoffDir, 'PROMPT_READY.md'),
    };

    emit('HANDOFF_READY', 'handoff', { root_seal: rootSeal, manifest_files: manifestCompact.length });

    // ═══ COMPLETE ═══
    result.status = 'complete';
    result.finished_at = nowIso();
    state.currentRun = null;
    state.latestResult = result;
    state.runs.push(result);

    state.artifacts = crystalResult.manifest.map(f => ({
      name: f.path, type: 'crystal', size: f.size_kb + ' KB', sha256: f.sha256,
    }));

    emit('RUN_COMPLETE', 'complete', {
      run_id: runId,
      total_files: crystalResult.manifest.length,
      root_seal: rootSeal,
      message: 'Pipeline complete — ready for AGNT submission',
    });

    return result;

  } catch (err) {
    result.status = 'error';
    result.error = err.message;
    result.stack = err.stack;
    state.currentRun = null;
    state.latestResult = result;
    state.runs.push(result);
    emit('RUN_ERROR', 'error', { error: err.message });
    return result;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────
function generateRunId() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z/, 'Z');
}

function walkDir(root, prefix = '') {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name !== '.git' && entry.name !== 'node_modules') {
        results.push(...walkDir(path.join(root, entry.name), relPath));
      }
    } else {
      results.push(relPath);
    }
  }
  return results;
}

// ─── CSS ────────────────────────────────────────────────────────────────
function getDashboardCSS() {
  return `:root{--bg:#070710;--surface-deep:#0b0b17;--surface:#10101f;--surface-raised:#131322;--surface-muted:#1f1f2f;--duller:#3e405a;--medium:#7f8193;--light:#d1d1db;--bright:#ebebeb;--white:#f1f0f5;--pink:#e53d8f;--cyan:#12e0ff;--green:#19ef83;--yellow:#ffd700;--red:#fe4e4e;--purple:#7d3de5;--indigo:#7d3de5;--violet:#d13de5;--font-display:'League Spartan',system-ui,sans-serif;--font-mono:'Fira Code','Cascadia Code',monospace}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--light);font-family:var(--font-mono);min-height:100vh;overflow-x:hidden}
.header{background:var(--surface-deep);border-bottom:1px solid var(--surface-muted);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.header h1{font-family:var(--font-display);font-size:24px;font-weight:900;letter-spacing:-0.5px}
.header h1 .icon{margin-right:8px}
.header-right{display:flex;align-items:center;gap:12px}
.conn-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.conn-dot.connected{background:var(--green);box-shadow:0 0 8px rgba(25,239,131,.5)}
.conn-dot.disconnected{background:var(--red)}
.status-badge{background:var(--surface-muted);color:var(--medium);padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;font-family:var(--font-display);letter-spacing:.5px;text-transform:uppercase}
.status-badge.running{background:rgba(18,224,255,.15);color:var(--cyan)}
.status-badge.complete{background:rgba(25,239,131,.15);color:var(--green)}
.status-badge.error{background:rgba(254,78,78,.15);color:var(--red)}
.phase-ladder{display:flex;gap:0;padding:24px;justify-content:center;background:linear-gradient(180deg,var(--surface-deep) 0%,var(--bg) 100%)}
.phase{display:flex;align-items:center;gap:0}
.phase-node{display:flex;flex-direction:column;align-items:center;gap:8px}
.phase-dot{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;border:2px solid var(--duller);background:var(--surface);color:var(--medium);transition:all .4s ease}
.phase-dot.active{border-color:var(--cyan);box-shadow:0 0 20px rgba(18,224,255,.3),inset 0 0 20px rgba(18,224,255,.1);color:var(--cyan);animation:pulse-glow 2s ease-in-out infinite}
.phase-dot.complete{border-color:var(--green);background:rgba(25,239,131,.1);color:var(--green);box-shadow:0 0 15px rgba(25,239,131,.2)}
.phase-dot.error{border-color:var(--red);background:rgba(254,78,78,.1);color:var(--red);animation:pulse-red 1s ease-in-out infinite}
@keyframes pulse-glow{0%,100%{box-shadow:0 0 20px rgba(18,224,255,.3),inset 0 0 20px rgba(18,224,255,.1)}50%{box-shadow:0 0 35px rgba(18,224,255,.5),inset 0 0 30px rgba(18,224,255,.15)}}
@keyframes pulse-red{0%,100%{box-shadow:0 0 20px rgba(254,78,78,.3)}50%{box-shadow:0 0 35px rgba(254,78,78,.6)}}
.phase-label{font-family:var(--font-display);font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--medium);transition:color .3s}
.phase-label.active{color:var(--cyan)}.phase-label.complete{color:var(--green)}.phase-label.error{color:var(--red)}
.phase-connector{width:60px;height:2px;background:var(--duller);margin-top:-24px;transition:background .3s}
.phase-connector.active{background:linear-gradient(90deg,var(--green),var(--cyan))}.phase-connector.complete{background:var(--green)}
.progress-section{padding:0 24px 24px}
.progress-bar-container{background:var(--surface);border-radius:8px;height:8px;overflow:hidden}
.progress-bar{height:100%;background:linear-gradient(90deg,var(--pink),var(--cyan));border-radius:8px;transition:width .5s ease}
.progress-text{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--medium)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:0 24px 24px}
.stat-card{background:var(--surface);border:1px solid var(--surface-muted);border-radius:12px;padding:16px;text-align:center;transition:all .3s}
.stat-card:hover{border-color:var(--cyan);transform:translateY(-2px)}
.stat-value{font-family:var(--font-display);font-size:28px;font-weight:900;color:var(--cyan);line-height:1;margin-bottom:4px}
.stat-value.pink{color:var(--pink)}.stat-value.green{color:var(--green)}.stat-value.yellow{color:var(--yellow)}
.stat-label{font-family:var(--font-display);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--medium)}
.main-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:0 24px 24px}
@media(max-width:900px){.main-grid{grid-template-columns:1fr}.stats-grid{grid-template-columns:1fr 1fr}}
.panel{background:var(--surface);border:1px solid var(--surface-muted);border-radius:12px;overflow:hidden;transition:border-color .3s}
.panel:hover{border-color:var(--duller)}
.panel-header{background:var(--surface-raised);padding:12px 16px;border-bottom:1px solid var(--surface-muted);display:flex;align-items:center;justify-content:space-between}
.panel-title{font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:.5px;color:var(--bright)}
.panel-body{padding:16px;max-height:400px;overflow-y:auto}
.event-count{font-size:11px;color:var(--duller)}
.event-row{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:6px;transition:background .2s;font-size:13px}
.event-row:hover{background:var(--surface-muted)}
.event-row.placeholder{color:var(--duller)}
.event-ts{color:var(--duller);flex-shrink:0;width:60px;font-size:11px}
.event-type{font-weight:600;flex-shrink:0;min-width:120px}
.event-type.frost{color:var(--cyan)}.event-type.glacier{color:var(--purple)}.event-type.crystal{color:var(--pink)}
.event-type.residue{color:var(--green)}.event-type.complete{color:var(--green)}.event-type.error{color:var(--red)}
.event-type.agent{color:var(.yellow)}
.event-msg{color:var(--light);flex:1}
.artifact-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:6px;font-size:13px;transition:background .2s}
.artifact-row:hover{background:var(--surface-muted)}
.artifact-row.placeholder{color:var(--duller)}
.artifact-name{color:var(--light)}
.artifact-size{color:var(--cyan);font-size:12px}
.run-panel{padding:0 24px 24px}
.form-group{margin-bottom:16px}
.form-label{display:block;font-family:var(--font-display);font-size:12px;font-weight:600;color:var(--medium);margin-bottom:6px;letter-spacing:.5px;text-transform:uppercase}
.form-input{width:100%;padding:10px 14px;background:var(--surface-raised);border:1px solid var(--surface-muted);border-radius:8px;color:var(--bright);font-family:var(--font-mono);font-size:14px;transition:border-color .2s;outline:none}
.form-input:focus{border-color:var(--cyan);box-shadow:0 0 10px rgba(18,224,255,.2)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border:none;border-radius:8px;font-family:var(--font-display);font-size:14px;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:all .2s;text-transform:uppercase}
.btn-run{width:100%;justify-content:center;padding:14px;font-size:16px;background:linear-gradient(135deg,var(--pink),var(--purple))}
.btn-run:hover{box-shadow:0 4px 30px rgba(229,61,143,.4)}
.btn-run:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-submit{width:100%;justify-content:center;padding:14px;font-size:16px;background:linear-gradient(135deg,var(--cyan),var(--green));margin-top:12px;color:#070710}
.btn-submit:hover{box-shadow:0 4px 30px rgba(18,224,255,.4)}
.btn-submit:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-open{width:100%;justify-content:center;padding:12px;font-size:14px;background:var(--surface-muted);color:var(--light);margin-top:8px}
.btn-open:hover{background:var(--duller)}
.submit-panel{background:rgba(18,224,255,.05);border:1px solid rgba(18,224,255,.2);border-radius:12px;padding:24px;margin:0 24px 24px;text-align:center}
.submit-panel h3{font-family:var(--font-display);font-size:20px;color:var(--cyan);margin-bottom:8px}
.submit-panel p{font-size:14px;color:var(--medium);margin-bottom:16px}
.submit-status{margin-top:12px;padding:10px;border-radius:8px;font-size:13px;display:none}
.submit-status.success{display:block;background:rgba(25,239,131,.1);border:1px solid rgba(25,239,131,.3);color:var(--green)}
.submit-status.error{display:block;background:rgba(254,78,78,.1);border:1px solid rgba(254,78,78,.3);color:var(--red)}
.submit-status.loading{display:block;background:rgba(18,224,255,.1);border:1px solid rgba(18,224,255,.3);color:var(--cyan)}
.run-history{padding:0 24px 24px}
.history-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:6px;font-size:13px;transition:background .2s;cursor:pointer}
.history-row:hover{background:var(--surface-muted)}
.history-row .repo{color:var(--light);font-weight:500}
.history-row .meta{color:var(--duller);font-size:11px}
.history-row .seal{color:var(--cyan);font-size:11px;font-family:var(--font-mono)}
.footer{padding:16px 24px;border-top:1px solid var(--surface-muted);text-align:center;font-size:12px;color:var(--duller)}
.footer a{color:var(--cyan);text-decoration:none}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--surface-deep)}::-webkit-scrollbar-thumb{background:var(--duller);border-radius:3px}`;
}

// ─── Dashboard JS ───────────────────────────────────────────────────────
function getDashboardJS() {
  return `let ws,events=[],startTime=null,runActive=false;
function connect(){
  const p=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(p+'//'+location.host+'/ws');
  ws.onopen=()=>{document.getElementById('connectionStatus').className='conn-dot connected'};
  ws.onclose=()=>{document.getElementById('connectionStatus').className='conn-dot disconnected';setTimeout(connect,2000)};
  ws.onerror=()=>ws.close();
  ws.onmessage=e=>{try{handleEvent(JSON.parse(e.data))}catch(x){}};
}
function handleEvent(ev){
  events.push(ev);
  document.getElementById('eventCount').textContent=events.length+' events';
  const s=document.getElementById('eventStream');
  if(s.querySelector('.placeholder'))s.innerHTML='';
  const r=document.createElement('div');r.className='event-row';
  const t=ev.ts?ev.ts.split('T')[1]?.slice(0,8):'—';
  r.innerHTML='<span class="event-ts">'+t+'</span><span class="event-type '+(ev.phase||'complete')+'">'+(ev.type||'EVENT')+'</span><span class="event-msg">'+(ev.message||'')+'</span>';
  s.appendChild(r);s.scrollTop=s.scrollHeight;
  updatePhase(ev);updateStats(ev);
  if(ev.type==='CRYSTAL_VERIFIED'||ev.type==='HANDOFF_READY'||ev.type==='RUN_COMPLETE')updateArtifacts();
  if(ev.type==='RUN_COMPLETE')showSubmitPanel(ev);
  if(ev.type==='SUBMIT_SUCCESS')showSubmitSuccess(ev);
  if(ev.type==='SUBMIT_FALLBACK')showSubmitFallback(ev);
}
function updatePhase(ev){
  const po=['frost','glacier','crystal','residue'],ph=ev.phase,idx=po.indexOf(ph);
  if(ev.type&&ev.type.endsWith('_PENDING')){sd(ph,'active');sl(ph,'active');sp(idx*25,ev.message||ph+'...')}
  else if(ev.type==='GLACIER_CACHE'){sd('glacier','active');sl('glacier','active');sp(25,'Using cached clone...')}
  else if(ev.type&&(ev.type.endsWith('_VERIFIED')||ev.type==='RESIDUE_EMPTY_LOCK')){sd(ph,'complete');sl(ph,'complete');if(idx>0)sc(po[idx-1],'complete');sp((idx+1)*25,ev.message||ph+' complete')}
  else if(ev.type==='RUN_COMPLETE'){['frost','glacier','crystal','residue'].forEach(p=>{sd(p,'complete');sl(p,'complete')});['frost','glacier','crystal'].forEach(p=>sc(p,'complete'));sp(100,'Pipeline complete');sb('complete','Complete');runActive=false;document.getElementById('runBtn').disabled=false}
  else if(ev.type==='RUN_ERROR'){if(ph)sd(ph,'error');sb('error','Error');runActive=false;document.getElementById('runBtn').disabled=false}
}
function sd(p,s){const d=document.getElementById('dot-'+p);if(d)d.className='phase-dot '+s}
function sl(p,s){const l=document.getElementById('label-'+p);if(l)l.className='phase-label '+s}
function sc(p,s){const c=document.getElementById('conn-'+p);if(c)c.className='phase-connector '+s}
function sb(s,t){const b=document.getElementById('runStatusBadge');b.className='status-badge '+s;b.textContent=t}
function sp(p,l){document.getElementById('progressBar').style.width=p+'%';document.getElementById('progressPercent').textContent=p+'%';document.getElementById('progressLabel').textContent=l}
function updateStats(ev){
  if(ev.type==='CRYSTAL_COPIED')document.getElementById('statFiles').textContent=ev.files_copied||0;
  if(ev.type==='HANDOFF_READY')document.getElementById('statSeal').textContent=(ev.root_seal||'').slice(0,8)+'...';
  if(ev.type==='CRYSTAL_VERIFIED')document.getElementById('statAgents').textContent=(ev.agents_completed||0)+'/4';
  if(ev.type==='RUN_COMPLETE'&&startTime)document.getElementById('statDuration').textContent=Math.round((Date.now()-startTime)/1000)+'s';
}
function updateArtifacts(){
  fetch('/api/artifacts').then(r=>r.json()).then(d=>{
    const l=document.getElementById('artifactList');
    if(!d||d.length===0){l.innerHTML='<div class="artifact-row placeholder"><span class="artifact-name">No artifacts yet</span></div>';return}
    l.innerHTML=d.map(a=>'<div class="artifact-row"><span class="artifact-name">'+a.name+'</span><span class="artifact-size">'+(a.size||'')+'</span></div>').join('');
  }).catch(()=>{});
}
function showSubmitPanel(ev){
  const panel=document.getElementById('submitPanel');
  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth'});
  const files=ev.total_files||0;
  const seal=(ev.root_seal||'').slice(0,16);
  document.getElementById('submitSummary').textContent=files+' files crystallized. Seal: '+seal+'... Submit to open an AGNT analysis thread.';
  const status=document.getElementById('submitStatus');status.style.display='none';
  const btn=document.getElementById('submitBtn');btn.disabled=false;btn.textContent='📤 Submit to AGNT Thread';btn.style.background='';
}
function showSubmitSuccess(ev){
  const status=document.getElementById('submitStatus');
  status.className='submit-status success';
  status.style.display='block';
  status.textContent='✅ Submitted to AGNT! Thread opened.';
  const btn=document.getElementById('submitBtn');
  btn.textContent='✅ Submitted!';
  btn.style.background='var(--green)';
  btn.disabled=true;
}
function showSubmitFallback(ev){
  const status=document.getElementById('submitStatus');
  status.className='submit-status error';
  status.style.display='block';
  status.textContent='⚠️ AGNT thread creation returned a response. Click "Open AGNT Chat" to continue.';
  const btn=document.getElementById('submitBtn');
  btn.textContent='⚠️ Open AGNT Manually';
  btn.disabled=false;
  btn.onclick=()=>window.open('http://localhost:3333','_blank');
}
function startRun(){
  if(runActive)return;
  const repoUrl=document.getElementById('repoUrl').value.trim();
  if(!repoUrl){alert('Please enter a repository URL');return}
  const maxFiles=parseInt(document.getElementById('maxFiles').value)||60;
  const maxKb=parseInt(document.getElementById('maxKb').value)||256;
  const mode=document.getElementById('runMode').value||'full';
  runActive=true;startTime=Date.now();
  document.getElementById('runBtn').disabled=true;
  document.getElementById('submitPanel').style.display='none';
  sb('running','Running');
  ['frost','glacier','crystal','residue'].forEach(p=>{sd(p,'');sl(p,'')});
  ['frost','glacier','crystal'].forEach(p=>sc(p,''));sp(0,'Starting...');
  fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repo_url:repoUrl,max_files:maxFiles,max_kb:maxKb,mode})})
    .then(r=>r.json()).then(d=>{if(d.error){sb('error','Error');runActive=false;document.getElementById('runBtn').disabled=false}})
    .catch(()=>{sb('error','Error');runActive=false;document.getElementById('runBtn').disabled=false});
}
function submitToAgnt(){
  const btn=document.getElementById('submitBtn');
  const status=document.getElementById('submitStatus');
  btn.disabled=true;btn.textContent='⏳ Submitting...';
  status.className='submit-status loading';
  status.style.display='block';
  status.textContent='Creating AGNT thread with artifact analysis...';
  fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})})
    .then(r=>r.json()).then(d=>{
      if(d.success){btn.textContent='✅ Submitted!';btn.style.background='var(--green)';status.className='submit-status success';status.textContent=d.message||'Submitted to AGNT!';}
      else{throw new Error(d.error||'Unknown error')}
    }).catch(err=>{btn.textContent='❌ Failed — Open Manually';btn.disabled=false;status.className='submit-status error';status.textContent='Failed: '+err.message+' Click Open AGNT Chat to continue.';btn.onclick=()=>window.open('http://localhost:3333','_blank');});
}
connect();`;
}

// ─── WebSocket ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  console.log('Dashboard client connected');
  // Send existing events
  state.events.forEach(event => {
    try { ws.send(JSON.stringify(event)); } catch {}
  });
});

// ─── Start ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n  ❄️  ICE Crawler Dashboard → http://localhost:${PORT}\n`);
});`;
}

// ─── Start Server ───────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n  ❄️  ICE Crawler Dashboard v2.0 → http://localhost:${PORT}\n`);
});

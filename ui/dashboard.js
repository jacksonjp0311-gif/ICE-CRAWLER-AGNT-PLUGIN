/**
 * dashboard.js
 * ❄️ ICE Crawler — Dashboard Frontend Logic
 * Event-driven WebSocket client with AGNT integration
 */

// ─── State ─────────────────────────────────────
let ws = null;
let events = [];
let startTime = null;
let runActive = false;
let lastRunResult = null;
let runHistory = JSON.parse(localStorage.getItem('ice-crawler-history') || '[]');
let repoHistory = JSON.parse(localStorage.getItem('ice-crawler-repos') || '[]');

// ─── Persistence ────────────────────────────────
function saveHistory() {
  localStorage.setItem('ice-crawler-history', JSON.stringify(runHistory.slice(-50)));
}
function saveRepoHistory() {
  localStorage.setItem('ice-crawler-repos', JSON.stringify(repoHistory.slice(-20)));
}
function clearHistory() {
  runHistory = [];
  saveHistory();
  renderHistory();
}

// ─── WebSocket ──────────────────────────────────
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(protocol + '//' + location.host + '/ws');

  ws.onopen = () => {
    updateConnectionStatus(true);
  };

  ws.onclose = () => {
    updateConnectionStatus(false);
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = (msg) => {
    try {
      handleEvent(JSON.parse(msg.data));
    } catch (e) {
      console.error('Bad message:', e);
    }
  };
}

function updateConnectionStatus(connected) {
  const el = document.getElementById('connectionStatus');
  if (!el) return;
  el.innerHTML = connected
    ? '<span class="conn-dot connected"></span> Connected'
    : '<span class="conn-dot disconnected"></span> Disconnected';
}

// ─── Event Handling ────────────────────────────
function handleEvent(ev) {
  events.push(ev);
  document.getElementById('eventCount').textContent = events.length + ' events';

  // Append to event stream
  const stream = document.getElementById('eventStream');
  const row = document.createElement('div');
  row.className = 'event-row';

  const typeClass = ev.phase || 'complete';
  const timeStr = ev.ts ? ev.ts.split('T')[1]?.slice(0, 8) : '—';

  row.innerHTML =
    '<span class="event-ts">' + timeStr + '</span>' +
    '<span class="event-type ' + typeClass + '">' + (ev.type || 'EVENT') + '</span>' +
    '<span class="event-msg">' + (ev.message || '') + '</span>';

  stream.appendChild(row);
  stream.scrollTop = stream.scrollHeight;

  updatePhase(ev);
  updateStats(ev);

  if (ev.type === 'CRYSTAL_VERIFIED' || ev.type === 'HANDOFF_READY' || ev.type === 'RUN_COMPLETE') {
    updateArtifacts();
  }

  if (ev.type === 'RUN_COMPLETE') {
    lastRunResult = ev;
    showSubmitPanel(ev);
    addToHistory(ev);
  }

  if (ev.type === 'DIFF_RESULT') {
    showDiff(ev);
  }
}

// ─── Phase Ladder ──────────────────────────────
const PHASES = ['frost', 'glacier', 'crystal', 'residue'];

function updatePhase(ev) {
  const phase = ev.phase;
  const idx = PHASES.indexOf(phase);

  if (ev.type && ev.type.endsWith('_PENDING')) {
    setDot(phase, 'active');
    setLabel(phase, 'active');
    setProgress((idx) * 25, ev.message || phase + '...');
  } else if (ev.type && (ev.type.endsWith('_VERIFIED') || ev.type === 'RESIDUE_EMPTY_LOCK')) {
    setDot(phase, 'complete');
    setLabel(phase, 'complete');
    if (idx > 0) setConnector(PHASES[idx - 1], 'complete');
    setProgress((idx + 1) * 25, ev.message || phase + ' complete');
  } else if (ev.type === 'RUN_COMPLETE') {
    PHASES.forEach(p => { setDot(p, 'complete'); setLabel(p, 'complete'); });
    PHASES.slice(0, -1).forEach(p => setConnector(p, 'complete'));
    setProgress(100, 'Pipeline complete');
    setBadge('complete', 'Complete');
    runActive = false;
    const btn = document.getElementById('runBtn');
    if (btn) btn.disabled = false;
  } else if (ev.type === 'RUN_ERROR') {
    if (phase) setDot(phase, 'error');
    setBadge('error', 'Error');
    runActive = false;
    const btn = document.getElementById('runBtn');
    if (btn) btn.disabled = false;
  }
}

function setDot(phase, state) {
  const el = document.getElementById('dot-' + phase);
  if (el) el.className = 'phase-dot ' + state;
}

function setLabel(phase, state) {
  const el = document.getElementById('label-' + phase);
  if (el) el.className = 'phase-label ' + state;
}

function setConnector(phase, state) {
  const el = document.getElementById('conn-' + phase);
  if (el) el.className = 'phase-connector ' + state;
}

function setBadge(state, text) {
  const el = document.getElementById('runStatusBadge');
  if (el) { el.className = 'status-badge ' + state; el.textContent = text; }
}

function setProgress(pct, label) {
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';
  document.getElementById('progressLabel').textContent = label;
}

// ─── Stats ─────────────────────────────────────
function updateStats(ev) {
  if (ev.type === 'CRYSTAL_COPIED') {
    document.getElementById('statFiles').textContent = ev.files_copied || 0;
  }
  if (ev.type === 'HANDOFF_READY') {
    document.getElementById('statSeal').textContent = (ev.root_seal || '').slice(0, 8) + '...';
  }
  if (ev.type === 'CRYSTAL_VERIFIED') {
    document.getElementById('statAgents').textContent = (ev.agents_completed || 0) + '/4';
  }
  if (ev.type === 'RUN_COMPLETE' && startTime) {
    document.getElementById('statDuration').textContent = Math.round((Date.now() - startTime) / 1000) + 's';
  }
}

// ─── Artifacts ─────────────────────────────────
function updateArtifacts() {
  fetch('/api/artifacts')
    .then(r => r.json())
    .then(data => {
      const list = document.getElementById('artifactList');
      document.getElementById('artifactCount').textContent = data.length;
      if (!data || data.length === 0) {
        list.innerHTML = '<div class="artifact-row placeholder"><span class="artifact-name" style="color:var(--duller)">No artifacts yet</span></div>';
        return;
      }
      list.innerHTML = data.map(a =>
        '<div class="artifact-row">' +
          '<span class="artifact-name">' + a.name + '</span>' +
          '<span class="artifact-meta">' + (a.type || '') + '</span>' +
          '<span class="artifact-size">' + (a.size || '') + '</span>' +
        '</div>'
      ).join('');
    })
    .catch(() => {});
}

// ─── Run History ───────────────────────────────
function addToHistory(ev) {
  const entry = {
    ts: ev.ts || new Date().toISOString(),
    run_id: ev.run_id,
    repo_url: ev.repo_url,
    files: ev.total_files || 0,
    seal: (ev.root_seal || '').slice(0, 16),
    duration: ev.duration_ms || 0,
  };
  runHistory.push(entry);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (runHistory.length === 0) {
    list.innerHTML = '<div class="artifact-row placeholder"><span class="artifact-name" style="color:var(--duller)">No previous runs</span></div>';
    return;
  }
  list.innerHTML = runHistory.slice().reverse().map(r =>
    '<div class="artifact-row" onclick="loadFromHistory(\'' + r.repo_url + '\')" style="cursor:pointer">' +
      '<span class="artifact-name">' + r.repo_url.replace('https://', '').replace('.git', '') + '</span>' +
      '<span class="artifact-meta">' + r.files + ' files &middot; ' + (r.duration / 1000).toFixed(0) + 's</span>' +
      '<span class="artifact-size">' + r.seal + '...</span>' +
    '</div>'
  ).join('');
}

function loadFromHistory(url) {
  const input = document.getElementById('repoUrl');
  if (input) input.value = url;
}

// ─── Diff Panel ────────────────────────────────
function showDiff(ev) {
  const panel = document.getElementById('diffPanel');
  const content = document.getElementById('diffContent');
  if (!panel || !content) return;
  panel.style.display = 'block';

  const diff = ev.diff || [];
  if (diff.length === 0) {
    content.innerHTML = '<div style="color:var(--green);padding:12px">No changes detected — artifacts identical to last run.</div>';
    return;
  }

  content.innerHTML = diff.map(d => {
    const cls = d.type === 'add' ? 'diff-add' : d.type === 'rem' ? 'diff-rem' : 'diff-mod';
    const icon = d.type === 'add' ? '+' : d.type === 'rem' ? '−' : '~';
    return '<div class="' + cls + '">' + icon + ' ' + d.path + '</div>';
  }).join('');
}

// ─── Submit Panel ──────────────────────────────
function showSubmitPanel(ev) {
  const panel = document.getElementById('submitPanel');
  if (!panel) return;
  panel.style.display = 'block';

  const files = ev.total_files || 0;
  const seal = (ev.root_seal || '').slice(0, 16);
  const summary = document.getElementById('submitSummary');
  if (summary) {
    summary.textContent = files + ' files crystallized. Seal: ' + seal + '... Submit to open an AGNT analysis thread.';
  }
  panel.scrollIntoView({ behavior: 'smooth' });
}

// ─── Start Run ─────────────────────────────────
function startRun() {
  if (runActive) return;

  const repoUrl = document.getElementById('repoUrl').value.trim();
  if (!repoUrl) { alert('Please enter a repository URL'); return; }

  const maxFiles = parseInt(document.getElementById('maxFiles').value) || 60;
  const maxKb = parseInt(document.getElementById('maxKb').value) || 256;
  const incremental = document.getElementById('incrementalMode')?.checked || false;

  // Save repo to history
  if (!repoHistory.includes(repoUrl)) {
    repoHistory.push(repoUrl);
    saveRepoHistory();
    updateRepoDatalist();
  }

  runActive = true;
  startTime = Date.now();

  const btn = document.getElementById('runBtn');
  if (btn) btn.disabled = true;

  const submitPanel = document.getElementById('submitPanel');
  if (submitPanel) submitPanel.style.display = 'none';

  const diffPanel = document.getElementById('diffPanel');
  if (diffPanel) diffPanel.style.display = 'none';

  setProgress(0, 'Starting pipeline...');
  setBadge('running', 'Running');

  // Reset phase dots
  PHASES.forEach(p => { setDot(p, ''); setLabel(p, ''); });
  PHASES.slice(0, -1).forEach(p => setConnector(p, ''));

  const body = { repo_url: repoUrl, max_files: maxFiles, max_kb: maxKb, incremental };

  fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        setBadge('error', 'Error');
        runActive = false;
        if (btn) btn.disabled = false;
      }
    })
    .catch(() => {
      setBadge('error', 'Connection Error');
      runActive = false;
      if (btn) btn.disabled = false;
    });
}

// ─── Submit to AGNT ────────────────────────────
function submitToAgnt() {
  const btn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('submitStatus');
  if (!btn || !statusEl) return;

  btn.disabled = true;
  btn.textContent = '⏳ Submitting...';
  statusEl.style.display = 'block';
  statusEl.className = 'status-indicator';
  statusEl.textContent = 'Submitting to AGNT...';

  fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        btn.textContent = '✅ Submitted!';
        btn.style.background = 'var(--green)';
        btn.style.color = 'white';
        statusEl.className = 'status-indicator success';
        statusEl.textContent = 'AGNT thread opened! Click "Open AGNT Chat" to view.';
        console.log('✅ Submitted to AGNT:', data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    })
    .catch(err => {
      console.error('❌ Submit failed:', err);
      btn.textContent = '❌ Failed — Retry';
      btn.disabled = false;
      statusEl.className = 'status-indicator error';
      statusEl.textContent = 'Failed: ' + err.message + '. Click to retry.';
    });
}

// ─── Open AGNT Chat ────────────────────────────
function openAgntChat() {
  // Try to find the AGNT web UI port
  fetch('/api/agnt-url')
    .then(r => r.json())
    .then(data => {
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        window.open('http://localhost:3333', '_blank');
      }
    })
    .catch(() => {
      window.open('http://localhost:3333', '_blank');
    });
}

// ─── Repo Datalist ─────────────────────────────
function updateRepoDatalist() {
  const dl = document.getElementById('repoHistory');
  if (!dl) return;
  dl.innerHTML = repoHistory.map(r => '<option value="' + r + '">').join('');
}

// ─── Init ──────────────────────────────────────
window.onload = function() {
  connect();
  renderHistory();
  updateRepoDatalist();
};

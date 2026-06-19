/**
 * ice-crawler.js
 * ❄️ ICE Crawler — AGNT Plugin Entry Point
 * Main tool interface for the AGNT plugin system
 *
 * Exposes: ingest, estimate, dashboard commands
 * Default export: IceCrawler instance (for AGNT plugin system)
 */

import { runPipeline } from './engine/orchestrator.js';
import { frostTelemetry } from './engine/frost.js';
import { normalizeRepositoryUrl } from './engine/repo-url.js';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { WebSocketServer } from 'ws';

// ─── Dashboard HTML (inlined for single-file deployment) ───────────────
function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>❄️ ICE Crawler — Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;600;700;900&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #070710;
  --surface-deep: #0b0b17;
  --surface: #10101f;
  --surface-raised: #131322;
  --surface-muted: #1f1f2f;
  --duller: #3e405a;
  --medium: #7f8193;
  --light: #d1d1db;
  --bright: #ebebeb;
  --white: #f1f0f5;
  --pink: #e53d8f;
  --cyan: #12e0ff;
  --green: #19ef83;
  --yellow: #ffd700;
  --red: #fe4e4e;
  --purple: #7d3de5;
  --orange: #ff9500;
  --font-display: 'League Spartan', system-ui, sans-serif;
  --font-mono: 'Fira Code', 'Cascadia Code', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: var(--bg);
  color: var(--light);
  font-family: var(--font-mono);
  min-height: 100vh;
  overflow-x: hidden;
}

/* ── Header ──────────────────────────────── */
.header {
  background: var(--surface-deep);
  border-bottom: 1px solid var(--surface-muted);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header h1 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.header h1 .icon { margin-right: 8px; }

.header .status-badge {
  background: var(--surface-muted);
  color: var(--medium);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-display);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.header .status-badge.running { background: rgba(18,224,255,0.15); color: var(--cyan); }
.header .status-badge.complete { background: rgba(25,239,131,0.15); color: var(--green); }
.header .status-badge.error { background: rgba(254,78,78,0.15); color: var(--red); }

/* ── Phase Ladder ──────────────────────── */
.phase-ladder {
  display: flex;
  gap: 0;
  padding: 24px;
  justify-content: center;
  background: linear-gradient(180deg, var(--surface-deep) 0%, var(--bg) 100%);
}

.phase {
  display: flex;
  align-items: center;
  gap: 0;
}

.phase-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
}

.phase-dot {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  border: 2px solid var(--duller);
  background: var(--surface);
  color: var(--medium);
  transition: all 0.4s ease;
  position: relative;
  z-index: 2;
}

.phase-dot.active {
  border-color: var(--cyan);
  box-shadow: 0 0 20px rgba(18,224,255,0.3), inset 0 0 20px rgba(18,224,255,0.1);
  color: var(--cyan);
  animation: pulse-glow 2s ease-in-out infinite;
}

.phase-dot.complete {
  border-color: var(--green);
  background: rgba(25,239,131,0.1);
  color: var(--green);
  box-shadow: 0 0 15px rgba(25,239,131,0.2);
}

.phase-dot.error {
  border-color: var(--red);
  background: rgba(254,78,78,0.1);
  color: var(--red);
  animation: pulse-red 1s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(18,224,255,0.3), inset 0 0 20px rgba(18,224,255,0.1); }
  50% { box-shadow: 0 0 35px rgba(18,224,255,0.5), inset 0 0 30px rgba(18,224,255,0.15); }
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 20px rgba(254,78,78,0.3); }
  50% { box-shadow: 0 0 35px rgba(254,78,78,0.6); }
}

.phase-label {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--medium);
  transition: color 0.3s;
}

.phase-label.active { color: var(--cyan); }
.phase-label.complete { color: var(--green); }
.phase-label.error { color: var(--red); }

.phase-connector {
  width: 60px;
  height: 2px;
  background: var(--duller);
  margin-top: -24px;
  transition: background 0.3s;
}

.phase-connector.active { background: linear-gradient(90deg, var(--green), var(--cyan)); }
.phase-connector.complete { background: var(--green); }

/* ── Progress Bar ──────────────────────── */
.progress-section {
  padding: 0 24px 24px;
}

.progress-bar-container {
  background: var(--surface);
  border-radius: 8px;
  height: 8px;
  overflow: hidden;
  position: relative;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--pink), var(--cyan));
  border-radius: 8px;
  transition: width 0.5s ease;
  position: relative;
}

.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 40px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3));
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-40px); }
  100% { transform: translateX(40px); }
}

.progress-text {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--medium);
}

/* ── Main Grid ──────────────────────────── */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 0 24px 24px;
}

@media (max-width: 900px) {
  .main-grid { grid-template-columns: 1fr; }
}

/* ── Panels ─────────────────────────────── */
.panel {
  background: var(--surface);
  border: 1px solid var(--surface-muted);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.3s;
}

.panel:hover {
  border-color: var(--duller);
}

.panel-header {
  background: var(--surface-raised);
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--bright);
}

.panel-body {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

/* ── Event Stream ──────────────────────── */
.event-stream {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
}

.event-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: transparent;
  animation: fadeIn 0.3s ease;
  transition: background 0.2s;
}

.event-row:hover {
  background: var(--surface-muted);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.event-ts {
  color: var(--duller);
  flex-shrink: 0;
  width: 60px;
  font-size: 11px;
}

.event-type {
  font-weight: 600;
  flex-shrink: 0;
  min-width: 140px;
}

.event-type.frost { color: var(--cyan); }
.event-type.glacier { color: var(--purple); }
.event-type.crystal { color: var(--pink); }
.event-type.residue { color: var(--green); }
.event-type.complete { color: var(--green); }
.event-type.error { color: var(--red); }
.event-type.agent { color: var(--yellow); }

.event-msg {
  color: var(--light);
  flex: 1;
}

/* ── Artifact Browser ───────────────────── */
.artifact-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.artifact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 13px;
  transition: background 0.2s;
  cursor: default;
}

.artifact-row:hover {
  background: var(--surface-muted);
}

.artifact-name {
  color: var(--light);
}

.artifact-meta {
  color: var(--duller);
  font-size: 11px;
  font-family: var(--font-mono);
}

.artifact-size {
  color: var(--cyan);
  font-size: 12px;
}

/* ── Stats Cards ───────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 0 24px 24px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--surface-muted);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  transition: all 0.3s;
}

.stat-card:hover {
  border-color: var(--cyan);
  transform: translateY(-2px);
}

.stat-value {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 900;
  color: var(--cyan);
  line-height: 1;
  margin-bottom: 4px;
}

.stat-value.pink { color: var(--pink); }
.stat-value.green { color: var(--green); }
.stat-value.yellow { color: var(--yellow); }

.stat-label {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--medium);
}

/* ── Forms ──────────────────────────────── */
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  color: var(--medium);
  margin-bottom: 6px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--surface-raised);
  border: 1px solid var(--surface-muted);
  border-radius: 8px;
  color: var(--bright);
  font-family: var(--font-mono);
  font-size: 14px;
  transition: border-color 0.2s;
  outline: none;
}

.form-input:focus {
  border-color: var(--cyan);
  box-shadow: 0 0 10px rgba(18,224,255,0.2);
}

.form-input::placeholder {
  color: var(--duller);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
}

.btn-primary {
  background: var(--pink);
  color: white;
}

.btn-primary:hover {
  background: #d0347f;
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(229,61,143,0.3);
}

.btn-secondary {
  background: var(--surface-muted);
  color: var(--light);
}

.btn-secondary:hover {
  background: var(--duller);
}

.btn-run {
  width: 100%;
  justify-content: center;
  padding: 14px;
  font-size: 16px;
  background: linear-gradient(135deg, var(--pink), var(--purple));
}

.btn-run:hover {
  box-shadow: 0 4px 30px rgba(229,61,143,0.4);
}

.btn-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* ── Scrollbar ──────────────────────────── */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--surface-deep); }
::-webkit-scrollbar-thumb { background: var(--duller); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--medium); }

/* ── Connection Status ──────────────────── */
.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}

.connection-dot.connected { background: var(--green); box-shadow: 0 0 8px rgba(25,239,131,0.5); }
.connection-dot.disconnected { background: var(--red); }

/* ── Footer ─────────────────────────────── */
.footer {
  padding: 16px 24px;
  border-top: 1px solid var(--surface-muted);
  text-align: center;
  font-size: 12px;
  color: var(--duller);
  font-family: var(--font-mono);
}

.footer a {
  color: var(--cyan);
  text-decoration: none;
}
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <h1><span class="icon">❄️</span> ICE Crawler</h1>
  <div style="display:flex;align-items:center;gap:12px;">
    <span id="connectionStatus"><span class="connection-dot disconnected"></span>Disconnected</span>
    <span class="status-badge" id="runStatusBadge">Idle</span>
  </div>
</div>

<!-- Phase Ladder -->
<div class="phase-ladder" id="phaseLadder">
  <div class="phase">
    <div class="phase-node">
      <div class="phase-dot" id="dot-frost">❄</div>
      <div class="phase-label" id="label-frost">Frost</div>
    </div>
  </div>
  <div class="phase-connector" id="conn-frost"></div>
  <div class="phase">
    <div class="phase-node">
      <div class="phase-dot" id="dot-glacier">🧊</div>
      <div class="phase-label" id="label-glacier">Glacier</div>
    </div>
  </div>
  <div class="phase-connector" id="conn-glacier"></div>
  <div class="phase">
    <div class="phase-node">
      <div class="phase-dot" id="dot-crystal">💎</div>
      <div class="phase-label" id="label-crystal">Crystal</div>
    </div>
  </div>
  <div class="phase-connector" id="conn-crystal"></div>
  <div class="phase">
    <div class="phase-node">
      <div class="phase-dot" id="dot-residue">🔒</div>
      <div class="phase-label" id="label-residue">Residue</div>
    </div>
  </div>
</div>

<!-- Progress -->
<div class="progress-section">
  <div class="progress-bar-container">
    <div class="progress-bar" id="progressBar" style="width: 0%"></div>
  </div>
  <div class="progress-text">
    <span id="progressLabel">Ready</span>
    <span id="progressPercent">0%</span>
  </div>
</div>

<!-- Stats -->
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-value pink" id="statFiles">0</div>
    <div class="stat-label">Files Crystallized</div>
  </div>
  <div class="stat-card">
    <div class="stat-value green" id="statSeal">—</div>
    <div class="stat-label">Root Seal</div>
  </div>
  <div class="stat-card">
    <div class="stat-value yellow" id="statAgents">0/4</div>
    <div class="stat-label">Agents Complete</div>
  </div>
  <div class="stat-card">
    <div class="stat-value" id="statDuration">0s</div>
    <div class="stat-label">Duration</div>
  </div>
</div>

<!-- Main Grid -->
<div class="main-grid">
  <!-- Event Stream -->
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title">📡 Event Stream</div>
      <span style="font-size:11px;color:var(--duller)" id="eventCount">0 events</span>
    </div>
    <div class="panel-body" id="eventStream">
      <div class="event-row" style="color:var(--duller)">
        <span class="event-ts">—</span>
        <span class="event-type">—</span>
        <span class="event-msg">Waiting for pipeline to start...</span>
      </div>
    </div>
  </div>

  <!-- Artifacts -->
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title">📦 Artifacts</div>
    </div>
    <div class="panel-body" id="artifactList">
      <div class="artifact-row">
        <span class="artifact-name" style="color:var(--duller)">No artifacts yet</span>
      </div>
    </div>
  </div>
</div>

<!-- Run Panel -->
<div style="padding:0 24px 24px;">
  <div class="panel">
    <div class="panel-header">
      <div class="panel-title">🚀 New Run</div>
    </div>
    <div class="panel-body">
      <div class="form-group">
        <label class="form-label">Repository URL</label>
        <input class="form-input" id="repoUrl" type="text" placeholder="https://github.com/owner/repo" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">Max Files</label>
          <input class="form-input" id="maxFiles" type="number" value="60" min="1" max="500" />
        </div>
        <div class="form-group">
          <label class="form-label">Max KB</label>
          <input class="form-input" id="maxKb" type="number" value="256" min="1" max="2048" />
        </div>
      </div>
      <button class="btn btn-run" id="runBtn" onclick="startRun()">
        ❄️ Start Ingestion
      </button>
    </div>
  </div>
</div>

<div class="footer">
  ICE Crawler v1.0.0 — Triadic Zero-Trace Repository Ingestion — <a href="https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin">GitHub</a>
</div>

<script>
// ─── State ────────────────────────────────
let ws = null;
let events = [];
let startTime = null;
let runActive = false;

// ─── WebSocket Connection ────────────────
function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(protocol + '//' + location.host + '/ws');

  ws.onopen = () => {
    document.getElementById('connectionStatus').innerHTML = '<span class="connection-dot connected"></span>Connected';
  };

  ws.onclose = () => {
    document.getElementById('connectionStatus').innerHTML = '<span class="connection-dot disconnected"></span>Disconnected';
    setTimeout(connect, 2000);
  };

  ws.onerror = () => { ws.close(); };

  ws.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data);
      handleEvent(event);
    } catch(e) { /* ignore bad messages */ }
  };
}

// ─── Event Handling ──────────────────────
function handleEvent(event) {
  events.push(event);
  document.getElementById('eventCount').textContent = events.length + ' events';

  // Add to event stream
  const stream = document.getElementById('eventStream');
  const row = document.createElement('div');
  row.className = 'event-row';

  const typeClass = event.phase || 'complete';
  const timeStr = event.ts ? event.ts.split('T')[1]?.slice(0,8) : '—';

  row.innerHTML =
    '<span class="event-ts">' + timeStr + '</span>' +
    '<span class="event-type ' + typeClass + '">' + (event.type || 'EVENT') + '</span>' +
    '<span class="event-msg">' + (event.message || JSON.stringify(event).slice(0,100)) + '</span>';

  stream.appendChild(row);
  stream.scrollTop = stream.scrollHeight;

  // Update phase dots
  updatePhase(event);

  // Update stats
  updateStats(event);

  // Update artifacts
  if (event.type === 'CRYSTAL_VERIFIED' || event.type === 'HANDOFF_READY' || event.type === 'RUN_COMPLETE') {
    updateArtifacts();
  }
}

function updatePhase(event) {
  const phaseOrder = ['frost', 'glacier', 'crystal', 'residue'];
  const phase = event.phase;
  const idx = phaseOrder.indexOf(phase);

  if (event.type && event.type.endsWith('_PENDING')) {
    setDot(phase, 'active');
    setLabel(phase, 'active');
    setProgress((idx) * 25, event.message || phase + '...');
  } else if (event.type && (event.type.endsWith('_VERIFIED') || event.type === 'RESIDUE_EMPTY_LOCK')) {
    setDot(phase, 'complete');
    setLabel(phase, 'complete');
    if (idx > 0) setConnector(phaseOrder[idx-1], 'complete');
    setProgress((idx + 1) * 25, event.message || phase + ' complete');
  } else if (event.type === 'RUN_COMPLETE') {
    setProgress(100, 'Pipeline complete');
    setBadge('complete', 'Complete');
    runActive = false;
    document.getElementById('runBtn').disabled = false;
  } else if (event.type === 'RUN_ERROR') {
    if (phase) setDot(phase, 'error');
    setBadge('error', 'Error');
    runActive = false;
    document.getElementById('runBtn').disabled = false;
  }
}

function setDot(phase, state) {
  const dot = document.getElementById('dot-' + phase);
  if (dot) { dot.className = 'phase-dot ' + state; }
}

function setLabel(phase, state) {
  const label = document.getElementById('label-' + phase);
  if (label) { label.className = 'phase-label ' + state; }
}

function setConnector(phase, state) {
  const conn = document.getElementById('conn-' + phase);
  if (conn) { conn.className = 'phase-connector ' + state; }
}

function setBadge(state, text) {
  const badge = document.getElementById('runStatusBadge');
  badge.className = 'status-badge ' + state;
  badge.textContent = text;
}

function setProgress(pct, label) {
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';
  document.getElementById('progressLabel').textContent = label;
}

function updateStats(event) {
  if (event.type === 'CRYSTAL_COPIED') {
    document.getElementById('statFiles').textContent = event.files_copied || 0;
  }
  if (event.type === 'HANDOFF_READY') {
    document.getElementById('statSeal').textContent = (event.root_seal || '').slice(0, 8) + '...';
  }
  if (event.type === 'CRYSTAL_VERIFIED') {
    const done = event.agents_completed || 0;
    document.getElementById('statAgents').textContent = done + '/4';
  }
  if (event.type === 'RUN_COMPLETE' && startTime) {
    const dur = Math.round((Date.now() - startTime) / 1000);
    document.getElementById('statDuration').textContent = dur + 's';
  }
}

function updateArtifacts() {
  fetch('/api/artifacts')
    .then(r => r.json())
    .then(data => {
      const list = document.getElementById('artifactList');
      if (!data || data.length === 0) {
        list.innerHTML = '<div class="artifact-row"><span class="artifact-name" style="color:var(--duller)">No artifacts yet</span></div>';
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

// ─── Start Run ───────────────────────────
function startRun() {
  if (runActive) return;

  const repoUrl = document.getElementById('repoUrl').value.trim();
  if (!repoUrl) { alert('Please enter a repository URL'); return; }

  const maxFiles = parseInt(document.getElementById('maxFiles').value) || 60;
  const maxKb = parseInt(document.getElementById('maxKb').value) || 256;

  runActive = true;
  startTime = Date.now();
  document.getElementById('runBtn').disabled = true;
  setBadge('running', 'Running');

  // Reset phases
  ['frost','glacier','crystal','residue'].forEach(p => {
    setDot(p, '');
    setLabel(p, '');
  });
  ['frost','glacier','crystal'].forEach(p => setConnector(p, ''));
  setProgress(0, 'Starting...');

  fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl, max_files: maxFiles, max_kb: maxKb }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        setBadge('error', 'Error');
        runActive = false;
        document.getElementById('runBtn').disabled = false;
      }
    })
    .catch(err => {
      setBadge('error', 'Connection Error');
      runActive = false;
      document.getElementById('runBtn').disabled = false;
    });
}

// ─── Init ────────────────────────────────
connect();
</script>
</body>
</html>`;
}

// ─── Dashboard Server ──────────────────────────────────────────────────
function startDashboardServer(port = 8765) {
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const { WebSocketServer } = require('ws');
  const { runPipeline } = require('./engine/orchestrator.js');

  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getDashboardHtml());
    } else if (req.url === '/api/artifacts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(global._iceCrawlerArtifacts || []));
    } else if (req.url === '/api/run' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const params = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'started', params }));

          // Run pipeline in background
          const result = await runPipeline({
            ...params,
            on_event: (event) => {
              // Broadcast to all WebSocket clients
              wss.clients.forEach(client => {
                if (client.readyState === 1) {
                  client.send(JSON.stringify(event));
                }
              });
            },
          });

          global._iceCrawlerArtifacts = result.artifacts?.manifest?.map(f => ({
            name: f.path,
            type: 'crystal',
            size: f.size_kb + ' KB',
            sha256: f.sha256,
          })) || [];

        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    // Send existing events on connect
    if (global._iceCrawlerEvents) {
      global._iceCrawlerEvents.forEach(event => {
        ws.send(JSON.stringify(event));
      });
    }
  });

  server.listen(port, () => {
    console.log(`\n  ❄️  ICE Crawler Dashboard running at http://localhost:${port}\n`);
  });

  return server;
}

// ─── CLI Commands ──────────────────────────────────────────────────────
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'ingest') {
    const repoUrl = args[1] || process.env.REPO_URL;
    if (!repoUrl) {
      console.error('Usage: node ice-crawler.js ingest <repo_url> [--max-files N] [--max-kb N]');
      process.exit(1);
    }

    const options = { repo_url: repoUrl };
    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--max-files' && args[i+1]) options.max_files = parseInt(args[++i]);
      if (args[i] === '--max-kb' && args[i+1]) options.max_kb = parseInt(args[++i]);
      if (args[i] === '--agentics') options.enable_agentics = true;
    }

    console.log('❄️ ICE Crawler — Starting ingestion...\n');

    const result = await runPipeline({
      ...options,
      on_event: (event) => {
        const icon = {
          frost: '❄️', glacier: '🧊', crystal: '💎', residue: '🔒',
          complete: '✅', error: '❌', handoff: '🤖', agent: '🔍',
        }[event.phase] || '📡';
        console.log(`  ${icon} [${event.type}] ${event.message || ''}`);
      },
    });

    if (result.error) {
      console.error(`\n❌ Error: ${result.error}`);
      process.exit(1);
    }

    console.log(`\n✅ Complete! ${result.phases?.crystal?.files_crystallized || 0} files crystallized`);
    console.log(`   Root seal: ${result.artifacts?.root_seal || 'N/A'}`);
    console.log(`   Artifacts: ${result.run_state_dir}`);

  } else if (command === 'estimate') {
    const repoUrl = args[1] || process.env.REPO_URL;
    if (!repoUrl) {
      console.error('Usage: node ice-crawler.js estimate <repo_url>');
      process.exit(1);
    }

    const normalized = normalizeRepositoryUrl(repoUrl);
    console.log('❄️ ICE Crawler — Frost Telemetry\n');
    const result = frostTelemetry(normalized);
    console.log(`  Repo: ${result.repo}`);
    console.log(`  HEAD: ${result.head}`);
    console.log(`  Mode: ${result.mode}`);

  } else if (command === 'dashboard') {
    const port = parseInt(args[1]) || parseInt(process.env.PORT) || 8765;
    startDashboardServer(port);

  } else {
    console.log(`
❄️ ICE Crawler — Triadic Zero-Trace Repository Ingestion

Usage:
  node ice-crawler.js ingest <url> [--max-files N] [--max-kb N] [--agentics]
  node ice-crawler.js estimate <url>
  node ice-crawler.js dashboard [port]

Commands:
  ingest     Run full Frost→Glacier→Crystal→Residue pipeline
  estimate   Run Frost-only telemetry scan
  dashboard  Launch real-time monitoring dashboard

Options:
  --max-files N   Max files to crystallize (default: 60)
  --max-kb N      Max file size in KB (default: 256)
  --agentics      Enable φ-extremal agentic partitioning
  --port N        Dashboard port (default: 8765)

Examples:
  node ice-crawler.js ingest https://github.com/owner/repo
  node ice-crawler.js estimate https://github.com/owner/repo
  node ice-crawler.js dashboard 8765
`);
  }
}

// ─── AGNT Plugin Interface ─────────────────────────────────────────────
class IceCrawler {
  constructor() {
    this.name = 'ice-crawler';
    this.version = '1.0.0';
    this.description = 'Triadic zero-trace repository ingestion engine';
  }

  async execute(params) {
    const { repo_url, max_files, max_kb, output_dir, enable_agentics } = params;

    if (!repo_url) {
      return { error: 'repo_url is required' };
    }

    try {
      const result = await runPipeline({
        repo_url,
        max_files: max_files || 60,
        max_kb: max_kb || 256,
        output_dir,
        enable_agentics: enable_agentics || false,
      });

      if (result.error) {
        return { error: result.error };
      }

      return {
        status: 'complete',
        run_id: result.run_id,
        files_crystallized: result.phases?.crystal?.files_crystallized || 0,
        root_seal: result.artifacts?.root_seal,
        run_state_dir: result.run_state_dir,
        duration_ms: result.duration_ms,
        phases: result.phases,
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async estimate(params) {
    const { repo_url } = params;
    if (!repo_url) return { error: 'repo_url is required' };

    try {
      const normalized = normalizeRepositoryUrl(repo_url);
      return frostTelemetry(normalized);
    } catch (err) {
      return { error: err.message };
    }
  }

  async dashboard(params) {
    const port = params?.port || 8765;
    startDashboardServer(port);
    return { status: 'dashboard_started', port, url: `http://localhost:${port}` };
  }
}

// ─── Exports ───────────────────────────────────────────────────────────
export default new IceCrawler();
export { IceCrawler, runPipeline, frostTelemetry, normalizeRepositoryUrl, startDashboardServer };

// ─── CLI Entry Point ───────────────────────────────────────────────────
if (process.argv[1] && (process.argv[1].endsWith('ice-crawler.js') || process.argv[1].endsWith('ice-crawler'))) {
  cli();
}

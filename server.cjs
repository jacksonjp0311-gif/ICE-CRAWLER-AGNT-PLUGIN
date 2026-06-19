/**
 * server.cjs
 * ❄️ ICE Crawler — Dashboard Server (CommonJS)
 * Express + WebSocket server for the real-time monitoring dashboard.
 *
 * Usage: node server.cjs [port]
 * Default port: 8765
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 8765;

// ─── Inline Dashboard HTML ─────────────────────────────────────────────
function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>❄️ ICE Crawler — Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;600;700;900&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#070710;--surface-deep:#0b0b17;--surface:#10101f;--surface-raised:#131322;--surface-muted:#1f1f2f;--duller:#3e405a;--medium:#7f8193;--light:#d1d1db;--bright:#ebebeb;--white:#f1f0f5;--pink:#e53d8f;--cyan:#12e0ff;--green:#19ef83;--yellow:#ffd700;--red:#fe4e4e;--purple:#7d3de5;--orange:#ff9500;--font-display:'League Spartan',system-ui,sans-serif;--font-mono:'Fira Code','Cascadia Code',monospace}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--light);font-family:var(--font-mono);min-height:100vh;overflow-x:hidden}
.header{background:var(--surface-deep);border-bottom:1px solid var(--surface-muted);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.header h1{font-family:var(--font-display);font-size:24px;font-weight:900;letter-spacing:-0.5px}
.header h1 .icon{margin-right:8px}
.status-badge{background:var(--surface-muted);color:var(--medium);padding:6px 16px;border-radius:20px;font-size:13px;font-weight:500;font-family:var(--font-display);letter-spacing:.5px;text-transform:uppercase}
.status-badge.running{background:rgba(18,224,255,.15);color:var(--cyan)}
.status-badge.complete{background:rgba(25,239,131,.15);color:var(--green)}
.status-badge.error{background:rgba(254,78,78,.15);color:var(--red)}
.phase-ladder{display:flex;gap:0;padding:24px;justify-content:center;background:linear-gradient(180deg,var(--surface-deep) 0%,var(--bg) 100%)}
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
.main-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:0 24px 24px}
@media(max-width:900px){.main-grid{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--surface-muted);border-radius:12px;overflow:hidden;transition:border-color .3s}
.panel:hover{border-color:var(--duller)}
.panel-header{background:var(--surface-raised);padding:12px 16px;border-bottom:1px solid var(--surface-muted);display:flex;align-items:center;justify-content:space-between}
.panel-title{font-family:var(--font-display);font-size:16px;font-weight:700;letter-spacing:.5px;color:var(--bright)}
.panel-body{padding:16px;max-height:400px;overflow-y:auto}
.event-row{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:6px;transition:background .2s;font-size:13px}
.event-row:hover{background:var(--surface-muted)}
.event-ts{color:var(--duller);flex-shrink:0;width:60px;font-size:11px}
.event-type{font-weight:600;flex-shrink:0;min-width:140px}
.event-type.frost{color:var(--cyan)}.event-type.glacier{color:var(--purple)}.event-type.crystal{color:var(--pink)}
.event-type.residue{color:var(--green)}.event-type.complete{color:var(--green)}.event-type.error{color:var(--red)}
.event-type.agent{color:var(--yellow)}
.event-msg{color:var(--light);flex:1}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 24px 24px}
.stat-card{background:var(--surface);border:1px solid var(--surface-muted);border-radius:12px;padding:16px;text-align:center;transition:all .3s}
.stat-card:hover{border-color:var(--cyan);transform:translateY(-2px)}
.stat-value{font-family:var(--font-display);font-size:32px;font-weight:900;color:var(--cyan);line-height:1;margin-bottom:4px}
.stat-value.pink{color:var(--pink)}.stat-value.green{color:var(--green)}.stat-value.yellow{color:var(--yellow)}
.stat-label{font-family:var(--font-display);font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--medium)}
.form-group{margin-bottom:16px}
.form-label{display:block;font-family:var(--font-display);font-size:13px;font-weight:600;color:var(--medium);margin-bottom:6px;letter-spacing:.5px;text-transform:uppercase}
.form-input{width:100%;padding:10px 14px;background:var(--surface-raised);border:1px solid var(--surface-muted);border-radius:8px;color:var(--bright);font-family:var(--font-mono);font-size:14px;transition:border-color .2s;outline:none}
.form-input:focus{border-color:var(--cyan);box-shadow:0 0 10px rgba(18,224,255,.2)}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;border:none;border-radius:8px;font-family:var(--font-display);font-size:14px;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:all .2s;text-transform:uppercase}
.btn-run{width:100%;justify-content:center;padding:14px;font-size:16px;background:linear-gradient(135deg,var(--pink),var(--purple))}
.btn-run:hover{box-shadow:0 4px 30px rgba(229,61,143,.4)}
.btn-run:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-submit{width:100%;justify-content:center;padding:14px;font-size:16px;background:linear-gradient(135deg,var(--cyan),var(--green));margin-top:12px}
.btn-submit:hover{box-shadow:0 4px 30px rgba(18,224,255,.4)}
.btn-submit:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-open{width:100%;justify-content:center;padding:12px;font-size:14px;background:var(--surface-muted);margin-top:8px}
.btn-open:hover{background:var(--duller)}
.artifact-row{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:6px;font-size:13px;transition:background .2s}
.artifact-row:hover{background:var(--surface-muted)}
.footer{padding:16px 24px;border-top:1px solid var(--surface-muted);text-align:center;font-size:12px;color:var(--duller)}
.footer a{color:var(--cyan);text-decoration:none}
.submit-panel{background:rgba(18,224,255,.05);border:1px solid rgba(18,224,255,.2);border-radius:12px;padding:20px;margin:0 24px 24px;text-align:center}
.submit-panel h3{font-family:var(--font-display);font-size:18px;color:var(--cyan);margin-bottom:8px}
.submit-panel p{font-size:13px;color:var(--medium);margin-bottom:16px}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--surface-deep)}::-webkit-scrollbar-thumb{background:var(--duller);border-radius:3px}
</style>
</head>
<body>
<div class="header">
  <h1><span class="icon">❄️</span> ICE Crawler</h1>
  <div style="display:flex;align-items:center;gap:12px">
    <span id="connectionStatus" style="font-size:13px;color:var(--medium)"><span style="color:var(--red)">●</span> Disconnected</span>
    <span class="status-badge" id="runStatusBadge">Idle</span>
  </div>
</div>
<div class="phase-ladder">
  <div class="phase-node"><div class="phase-dot" id="dot-frost">❄</div><div class="phase-label" id="label-frost">Frost</div></div>
  <div class="phase-connector" id="conn-frost"></div>
  <div class="phase-node"><div class="phase-dot" id="dot-glacier">🧊</div><div class="phase-label" id="label-glacier">Glacier</div></div>
  <div class="phase-connector" id="conn-glacier"></div>
  <div class="phase-node"><div class="phase-dot" id="dot-crystal">💎</div><div class="phase-label" id="label-crystal">Crystal</div></div>
  <div class="phase-connector" id="conn-crystal"></div>
  <div class="phase-node"><div class="phase-dot" id="dot-residue">🔒</div><div class="phase-label" id="label-residue">Residue</div></div>
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
  <div class="panel"><div class="panel-header"><div class="panel-title">📡 Event Stream</div><span style="font-size:11px;color:var(--duller)" id="eventCount">0 events</span></div><div class="panel-body" id="eventStream"><div class="event-row" style="color:var(--duller)"><span class="event-ts">—</span><span class="event-type">—</span><span class="event-msg">Waiting for pipeline to start...</span></div></div></div>
  <div class="panel"><div class="panel-header"><div class="panel-title">📦 Artifacts</div></div><div class="panel-body" id="artifactList"><div class="artifact-row"><span class="artifact-name" style="color:var(--duller)">No artifacts yet</span></div></div></div>
</div>
<div style="padding:0 24px 24px">
  <div class="panel"><div class="panel-header"><div class="panel-title">🚀 New Run</div></div><div class="panel-body">
    <div class="form-group"><label class="form-label">Repository URL</label><input class="form-input" id="repoUrl" type="text" placeholder="https://github.com/owner/repo"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label class="form-label">Max Files</label><input class="form-input" id="maxFiles" type="number" value="60" min="1" max="500"></div>
      <div class="form-group"><label class="form-label">Max KB</label><input class="form-input" id="maxKb" type="number" value="256" min="1" max="2048"></div>
    </div>
    <button class="btn btn-run" id="runBtn" onclick="startRun()">❄️ Start Ingestion</button>
  </div></div>
</div>
<!-- Submit to AGNT Panel (hidden until run completes) -->
<div class="submit-panel" id="submitPanel" style="display:none">
  <h3>✅ Ingestion Complete</h3>
  <p id="submitSummary">Your artifacts are ready. Submit them to AGNT to open a new analysis thread.</p>
  <button class="btn btn-submit" id="submitBtn" onclick="submitToAgnt()">📤 Submit to AGNT</button>
  <button class="btn btn-open" id="openAgntBtn" onclick="openAgntChat()">💬 Open AGNT Chat</button>
</div>
<div class="footer">ICE Crawler v1.0.0 — <a href="https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin">GitHub</a></div>
<script>
let ws,events=[],startTime=null,runActive=false,lastResult=null;
function connect(){
  const p=location.protocol==='https:'?'wss:':'ws:';
  ws=new WebSocket(p+'//'+location.host+'/ws');
  ws.onopen=()=>{document.getElementById('connectionStatus').innerHTML='<span style="color:var(--green)">●</span> Connected'};
  ws.onclose=()=>{document.getElementById('connectionStatus').innerHTML='<span style="color:var(--red)">●</span> Disconnected';setTimeout(connect,2000)};
  ws.onerror=()=>ws.close();
  ws.onmessage=e=>{try{handleEvent(JSON.parse(e.data))}catch(x){}};
}
function handleEvent(ev){
  events.push(ev);
  document.getElementById('eventCount').textContent=events.length+' events';
  const s=document.getElementById('eventStream');
  const r=document.createElement('div');r.className='event-row';
  const t=ev.ts?ev.ts.split('T')[1]?.slice(0,8):'—';
  r.innerHTML='<span class="event-ts">'+t+'</span><span class="event-type '+(ev.phase||'complete')+'\">'+(ev.type||'EVENT')+'</span><span class="event-msg">'+(ev.message||'')+'</span>';
  s.appendChild(r);s.scrollTop=s.scrollHeight;
  updatePhase(ev);updateStats(ev);
  if(ev.type==='CRYSTAL_VERIFIED'||ev.type==='HANDOFF_READY'||ev.type==='RUN_COMPLETE')updateArtifacts();
  if(ev.type==='RUN_COMPLETE')showSubmitPanel(ev);
}
function updatePhase(ev){
  const po=['frost','glacier','crystal','residue'],ph=ev.phase,idx=po.indexOf(ph);
  if(ev.type&&ev.type.endsWith('_PENDING')){sd(ph,'active');sl(ph,'active');sp(idx*25,ev.message||ph+'...')}
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
  if(ev.type==='RUN_COMPLETE'&&startTime){document.getElementById('statDuration').textContent=Math.round((Date.now()-startTime)/1000)+'s'}
}
function updateArtifacts(){
  fetch('/api/artifacts').then(r=>r.json()).then(d=>{
    const l=document.getElementById('artifactList');
    if(!d||d.length===0){l.innerHTML='<div class="artifact-row"><span class="artifact-name" style="color:var(--duller)">No artifacts yet</span></div>';return}
    l.innerHTML=d.map(a=>'<div class="artifact-row"><span class="artifact-name">'+a.name+'</span><span class="artifact-meta">'+(a.type||'')+'</span><span style="color:var(--cyan);font-size:12px">'+(a.size||'')+'</span></div>').join('');
  }).catch(()=>{});
}
function showSubmitPanel(ev){
  lastResult=ev;
  const panel=document.getElementById('submitPanel');
  panel.style.display='block';
  const files=ev.total_files||0;
  const seal=(ev.root_seal||'').slice(0,16);
  document.getElementById('submitSummary').textContent=files+' files crystallized. Seal: '+seal+'... Submit to open an AGNT analysis thread.';
  panel.scrollIntoView({behavior:'smooth'});
}
function startRun(){
  if(runActive)return;
  const repoUrl=document.getElementById('repoUrl').value.trim();
  if(!repoUrl){alert('Please enter a repository URL');return}
  const maxFiles=parseInt(document.getElementById('maxFiles').value)||60;
  const maxKb=parseInt(document.getElementById('maxKb').value)||256;
  runActive=true;startTime=Date.now();
  document.getElementById('runBtn').disabled=true;
  document.getElementById('submitPanel').style.display='none';
  sb('running','Running');
  ['frost','glacier','crystal','residue'].forEach(p=>{sd(p,'');sl(p,'')});
  ['frost','glacier','crystal'].forEach(p=>sc(p,''));sp(0,'Starting...');
  fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({repo_url:repoUrl,max_files:maxFiles,max_kb:maxKb})})
    .then(r=>r.json()).then(d=>{if(d.error){sb('error','Error');runActive=false;document.getElementById('runBtn').disabled=false}})
    .catch(()=>{sb('error','Error');runActive=false;document.getElementById('runBtn').disabled=false});
}
function submitToAgnt(){
  const btn=document.getElementById('submitBtn');
  btn.disabled=true;btn.textContent='⏳ Submitting...';
  fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})})
    .then(r=>r.json()).then(d=>{
      if(d.success){btn.textContent='✅ Submitted!';btn.style.background='var(--green)';setTimeout(()=>{btn.textContent='📤 Submit to AGNT';btn.style.background='';btn.disabled=false;},3000)}
      else{btn.textContent='❌ Failed — Try Again';btn.disabled=false}
    }).catch(()=>{btn.textContent='❌ Error — Try Again';btn.disabled=false});
}
function openAgntChat(){
  const agntUrl=window.location.origin.replace(/:\\d+/,'')+':3333';
  window.open(agntUrl,'_blank');
}
connect();
</script>
</body>
</html>`;
}

// ─── HTTP Server ────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getDashboardHtml());
  } else if (req.url === '/api/artifacts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(global._iceCrawlerArtifacts || []));
  } else if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(global._iceCrawlerRunStatus || { status: 'idle' }));
  } else if (req.url === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'started', params }));

        const { runPipeline } = await import('./engine/orchestrator.js');
        const result = await runPipeline({
          ...params,
          on_event: (event) => {
            wss.clients.forEach(client => {
              if (client.readyState === 1) {
                try { client.send(JSON.stringify(event)); } catch {}
              }
            });
          },
        });

        global._iceCrawlerArtifacts = result.artifacts?.manifest?.map(f => ({
          name: f.path, type: 'crystal', size: f.size_kb + ' KB', sha256: f.sha256,
        })) || [];
        global._iceCrawlerLastResult = result;

      } catch (err) {
        console.error('Pipeline error:', err.message);
      }
    });
  } else if (req.url === '/api/submit' && req.method === 'POST') {
    // Submit to AGNT — opens the AGNT web UI with the handoff bundle
    res.writeHead(200, { 'Content-Type': 'application/json' });
    try {
      const result = global._iceCrawlerLastResult;
      if (!result || result.error) {
        res.end(JSON.stringify({ success: false, error: 'No completed run to submit' }));
        return;
      }
      // Build the AGNT URL with the handoff data
      const seal = result.artifacts?.root_seal || '';
      const fileCount = result.phases?.crystal?.files_crystallized || 0;
      const agntUrl = `http://localhost:3333`;
      res.end(JSON.stringify({
        success: true,
        agntUrl,
        seal,
        fileCount,
        message: `Open AGNT at ${agntUrl} to continue analysis`,
      }));
    } catch (err) {
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ─── WebSocket ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  if (global._iceCrawlerEvents) {
    global._iceCrawlerEvents.forEach(event => {
      try { ws.send(JSON.stringify(event)); } catch {}
    });
  }
});

server.listen(PORT, () => {
  console.log(`\n  ❄️  ICE Crawler Dashboard → http://localhost:${PORT}\n`);
});

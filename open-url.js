// The current version
let version = "1.2.0";

// The submit history log
let submitHistory = [];

// ─── Enhanced HTTP helper for AGNT API ────────────────────────────────────
function getAGNTBaseUrl() {
  return process.env.AGNT_API || 'http://localhost:3333/api';
}

function agntPost(path, body) {
  const url = new URL(getAGNTBaseUrl() + path);
  return new Promise((resolve, reject) => {
    const req = require('http').request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + (process.env.AGNT_AUTH_TOKEN || '')
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ error: data }); }
      });
    });
    req.on('error', reject);
    req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── Submit to AGNT ────────────────────────────────────────────────────────
function submitToAgnt(result) {
  // Create submission entry for history
  const submission = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    sourceUrl: window.location.href,
    result: {
      run_id: result.run_id,
      repo_url: result.repo_url,
      files_crystallized: result.files_crystallized,
      root_seal: result.root_seal,
      run_state_dir: result.run_state_dir,
      duration_ms: result.duration_ms,
    }
  };
  submitHistory.push(submission);

  // Send to AGNT API (opens the thread if exists, creates new if not)
  const payload = {
    type: 'submit',
    payload: {
      service: 'ice-crawler',
      operation: 'handoff',
      data: submission,
      description: `ICE Crawler ingestion complete — ${submission.result.files_crystallized} files crystallized. Seal: ${submission.result.root_seal.slice(0, 16)}...`,
      metadata: {
        runId: submission.id,
        filesCount: submission.result.files_crystallized,
        rootSeal: submission.result.root_seal,
        artifactDir: submission.result.run_state_dir,
        submitTime: submission.timestamp,
      }
    }
  };

  agntPost('/agents/execute', payload)
    .then(res => {
      console.log('✅ Submitted to AGNT:', res);
      // Update UI to show submission success
      setTimeout(() => {
        const btn = document.getElementById('submitBtn');
        if (btn) {
          btn.textContent = '✅ Submitted';
          btn.style.background = 'var(--green)';
          btn.disabled = true;
          
          const statusMsg = document.getElementById('submitStatus');
          if (statusMsg) {
            statusMsg.textContent = 'Opened AGNT thread with submission details';
            statusMsg.style.color = 'var(--green)';
          }
        }
      }, 500);
    })
    .catch(err => {
      console.error('❌ Failed to submit to AGNT:', err);
      // Fallback: open AGNT URL directly
      const agntUrl = 'http://localhost:3333';
      window.open(agntUrl, '_blank');
    });
}

// ─── Handle page load ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  console.log('Dashboard loaded');
  console.log('Submit to AGNT function ready');

  // Add submit status indicator
  const submitPanel = document.getElementById('submitPanel');
  if (submitPanel) {
    const indicator = document.createElement('div');
    indicator.id = 'submitStatus';
    indicator.style.marginTop = '8px';
    indicator.style.fontSize = '12px';
    indicator.style.color = 'var(--duller)';
    indicator.textContent = 'Preparing submission...';
    submitPanel.appendChild(indicator);
  }
});

// Expose for external access
window.submitToAgnt = submitToAgnt;

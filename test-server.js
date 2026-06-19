const { execSync, spawn } = require('child_process');
const http = require('http');
const path = 'C:\\Users\\jacks\\OneDrive\\Desktop\\Ice-Crawler-AGNT-Plugin';

function log(msg) { console.log('[TEST] ' + msg); }

// Kill existing server
try {
  const out = execSync('netstat -ano | findstr ":8765"', { encoding: 'utf-8' });
  out.trim().split('\n').forEach(line => {
    const pid = line.trim().split(/\s+/).pop();
    if (pid) execSync('taskkill /PID ' + pid + ' /F', { encoding: 'utf-8' });
  });
  log('Cleaned up old server');
} catch(e) {}

execSync('ping -n 2 127.0.0.1 > nul', { timeout: 3000 });

// Start server
const server = spawn('node', ['server.cjs', '8765'], {
  cwd: path, detached: true, stdio: 'ignore', windowsHide: true,
});
server.unref();
log('Server started, PID: ' + server.pid);

// Wait for server
execSync('ping -n 4 127.0.0.1 > nul', { timeout: 5000 });

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

async function runTests() {
  try {
    const s = await get('http://localhost:8765/api/status');
    log('GET /api/status -> ' + s.status + ' ' + s.body.trim());
    
    const a = await get('http://localhost:8765/api/artifacts');
    log('GET /api/artifacts -> ' + a.status + ' ' + a.body.trim());
    
    const h = await get('http://localhost:8765/');
    log('GET / -> ' + h.status + ' ' + h.body.length + ' bytes');
    
    const checks = [
      ['Submit to AGNT', h.body.includes('Submit to AGNT')],
      ['submitToAgnt()', h.body.includes('submitToAgnt')],
      ['openAgntChat()', h.body.includes('openAgntChat')],
      ['Auto-open', h.body.includes('Auto-open')],
      ['phase-ladder', h.body.includes('phase-ladder')],
      ['WebSocket', h.body.includes('WebSocket')],
      ['btn-submit', h.body.includes('btn-submit')],
      ['submitPanel', h.body.includes('submitPanel')],
    ];
    
    let allPass = true;
    checks.forEach(([name, pass]) => {
      log((pass ? 'PASS' : 'FAIL') + ': ' + name);
      if (!pass) allPass = false;
    });
    
    if (allPass) {
      log('\nAll tests PASSED!');
    } else {
      log('\nSome tests FAILED!');
      process.exit(1);
    }
  } catch(e) {
    log('Error: ' + e.message);
    process.exit(1);
  }
}

runTests();

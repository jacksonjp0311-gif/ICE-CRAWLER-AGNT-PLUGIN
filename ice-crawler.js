/**
 * ice-crawler.js
 * ❄️ ICE Crawler — AGNT Plugin Entry Point (Pure ESM)
 * Default export: IceCrawler instance
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Dynamic imports (ESM-safe) ──────────────────────────────────────
async function runPipelineFn(options) {
  const { runPipeline } = await import('./engine/orchestrator.js');
  return runPipeline(options);
}

async function frostTelemetryFn(repoUrl) {
  const { frostTelemetry } = await import('./engine/frost.js');
  return frostTelemetry(repoUrl);
}

async function normalizeRepoUrlFn(raw) {
  const { normalizeRepositoryUrl } = await import('./engine/repo-url.js');
  return normalizeRepositoryUrl(raw);
}

// ─── Start dashboard server (detached) ───────────────────────────────
function startDashboardServer(port = 8765) {
  const serverPath = join(__dirname, 'ui', 'server.cjs');
  const child = spawn(process.execPath, [serverPath, String(port)], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return { pid: child.pid, port, url: `http://localhost:${port}` };
}

// ─── CLI ─────────────────────────────────────────────────────────────
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'ingest') {
    const repoUrl = args[1] || process.env.REPO_URL;
    if (!repoUrl) {
      console.error('Usage: node ice-crawler.js ingest <repo_url> [--max-files N] [--max-kb N] [--incremental]');
      process.exit(1);
    }

    const options = { repo_url: repoUrl };
    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--max-files' && args[i + 1]) options.max_files = parseInt(args[++i]);
      if (args[i] === '--max-kb' && args[i + 1]) options.max_kb = parseInt(args[++i]);
      if (args[i] === '--agentics') options.enable_agentics = true;
      if (args[i] === '--incremental') options.incremental = true;
    }

    console.log('❄️ ICE Crawler — Starting ingestion...\n');
    if (options.incremental) console.log('  📦 Incremental mode enabled\n');

    const result = await runPipelineFn({
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

    const normalized = await normalizeRepoUrlFn(repoUrl);
    console.log('❄️ ICE Crawler — Frost Telemetry\n');
    const result = await frostTelemetryFn(normalized);
    console.log(`  Repo: ${result.repo}`);
    console.log(`  HEAD: ${result.head}`);
    console.log(`  Mode: ${result.mode}`);

  } else if (command === 'dashboard') {
    const port = parseInt(args[1]) || parseInt(process.env.PORT) || 8765;
    console.log(`❄️ ICE Crawler — Starting dashboard on port ${port}...`);
    const server = startDashboardServer(port);
    console.log(`  Dashboard: ${server.url}`);
    console.log(`  PID: ${server.pid}`);
    console.log('\n  Server running in background.');

    process.on('SIGINT', () => {
      console.log('\n  Exiting CLI (dashboard stays running)...');
      process.exit(0);
    });

  } else {
    console.log(`
❄️ ICE Crawler — Triadic Zero-Trace Repository Ingestion

Usage:
  node ice-crawler.js ingest <url> [--max-files N] [--max-kb N] [--incremental] [--agentics]
  node ice-crawler.js estimate <url>
  node ice-crawler.js dashboard [port]

Commands:
  ingest     Run full Frost→Glacier→Crystal→Residue pipeline
  estimate   Run Frost-only telemetry scan
  dashboard  Launch real-time monitoring dashboard (persistent)

Options:
  --max-files N    Max files to crystallize (default: 60)
  --max-kb N       Max file size in KB (default: 256)
  --incremental    Skip unchanged files from previous run
  --agentics       Enable φ-extremal agentic partitioning

Examples:
  node ice-crawler.js ingest https://github.com/owner/repo
  node ice-crawler.js ingest https://github.com/owner/repo --incremental
  node ice-crawler.js estimate https://github.com/owner/repo
  node ice-crawler.js dashboard 8765
`);
  }
}

// ─── AGNT Plugin Interface ───────────────────────────────────────────
class IceCrawler {
  constructor() {
    this.name = 'ice-crawler';
    this.version = '1.5.0';
    this.description = 'Triadic zero-trace repository ingestion engine';
  }

  async execute(params) {
    const { repo_url, max_files, max_kb, output_dir, enable_agentics, incremental } = params;
    if (!repo_url) return { error: 'repo_url is required' };

    try {
      const result = await runPipelineFn({
        repo_url,
        max_files: max_files || 60,
        max_kb: max_kb || 256,
        output_dir,
        enable_agentics: enable_agentics || false,
        incremental: incremental || false,
      });

      if (result.error) return { error: result.error };

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
      const normalized = await normalizeRepoUrlFn(repo_url);
      return await frostTelemetryFn(normalized);
    } catch (err) {
      return { error: err.message };
    }
  }

  async dashboard(params) {
    const port = params?.port || 8765;
    const server = startDashboardServer(port);
    return { status: 'dashboard_started', ...server };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────
export default new IceCrawler();
export { IceCrawler };

// ─── CLI Entry Point ─────────────────────────────────────────────────
const isDirectRun = process.argv[1] &&
  (process.argv[1].endsWith('ice-crawler.js') || process.argv[1].endsWith('ice-crawler'));

if (isDirectRun) {
  cli().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

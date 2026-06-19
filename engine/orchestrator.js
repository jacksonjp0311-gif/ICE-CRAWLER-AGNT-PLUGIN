/**
 * engine/orchestrator.js
 * ❄️ Master Pipeline — Frost → Glacier → Crystal → Residue
 * Coordinates all phases, emits events, handles AI handoff
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, rmSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { frostTelemetry } from './frost.js';
import { glacierClone, glacierSelect, glacierPurge, glacierEmit } from './glacier.js';
import { crystalCrystallize, sha256Text } from './crystal.js';
import { phiPartition } from './phi-partition.js';
import { AgentContext, writeJson, nowIso } from './agents/agent-base.js';
import { run as runFiletypeStats } from './agents/filetype-stats.js';
import { run as runImportsIndex } from './agents/imports-index.js';
import { run as runHotspots } from './agents/hotspots.js';
import { run as runReadmeSynthesis } from './agents/readme-synthesis.js';
import { normalizeRepositoryUrl } from './repo-url.js';

function generateRunId() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function emitEvent(runStateDir, event) {
  const eventFile = join(runStateDir, 'ui_events.jsonl');
  writeFileSync(eventFile, JSON.stringify(event) + '\n', { encoding: 'utf-8', flag: 'a' });
  if (global._iceCrawlerEvents) {
    global._iceCrawlerEvents.push(event);
    if (global._iceCrawlerEvents.length > 500) {
      global._iceCrawlerEvents = global._iceCrawlerEvents.slice(-500);
    }
  }
}

function purgeDirStrict(path, tries = 40) {
  try {
    execSync(`git -C "${path}" clean -fdx`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000,
    });
  } catch { /* ignore */ }

  for (let i = 0; i < tries; i++) {
    if (!existsSync(path)) return true;
    try { rmSync(path, { recursive: true, force: true, maxRetries: 3 }); } catch { /* retry */ }
    if (!existsSync(path)) return true;
    const start = Date.now();
    while (Date.now() - start < 250) { /* busy wait */ }
  }
  return !existsSync(path);
}

/**
 * Run the full Ice-Crawler pipeline
 */
export async function runPipeline(options = {}) {
  const {
    repo_url,
    max_files = 60,
    max_kb = 256,
    output_dir,
    enable_agentics = false,
    on_event = null,
  } = options;

  const runId = generateRunId();
  const runStateDir = output_dir || join('state', 'runs', runId);
  const tempDir = join('state', 'temp', runId);
  ensureDir(runStateDir);
  ensureDir(tempDir);

  global._iceCrawlerEvents = [];
  global._iceCrawlerRunStatus = {
    run_id: runId, repo_url, status: 'running',
    current_phase: null, phases: {},
    started_at: nowIso(), finished_at: null, error: null,
  };

  const result = {
    run_id: runId, repo_url, run_state_dir: runStateDir,
    phases: {}, artifacts: {}, error: null,
  };

  const emit = (type, phase, data = {}) => {
    const event = { ts: nowIso(), type, phase, run_id: runId, ...data };
    emitEvent(runStateDir, event);
    if (on_event) on_event(event);
    return event;
  };

  try {
    // ═══ PHASE 1: FROST ═══
    emit('FROST_PENDING', 'frost', { message: 'Resolving repository HEAD...' });
    global._iceCrawlerRunStatus.current_phase = 'frost';

    const normalizedUrl = normalizeRepositoryUrl(repo_url);
    const frostResult = frostTelemetry(normalizedUrl);
    writeJson(join(runStateDir, 'frost_summary.json'), frostResult);
    result.phases.frost = frostResult;
    emit('FROST_VERIFIED', 'frost', { head: frostResult.head, repo: frostResult.repo });

    // ═══ PHASE 2: GLACIER ═══
    emit('GLACIER_PENDING', 'glacier', { message: 'Shallow cloning repository...' });
    global._iceCrawlerRunStatus.current_phase = 'glacier';

    glacierClone(repo_url, tempDir);
    emit('GLACIER_CLONED', 'glacier', { temp_dir: tempDir, message: 'Clone complete, selecting files...' });

    const allFiles = [];
    function walkDir(root, prefix = '') {
      let entries;
      try { entries = readdirSync(root, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (entry.name !== '.git' && entry.name !== 'node_modules') {
            walkDir(join(root, entry.name), relPath);
          }
        } else {
          allFiles.push(relPath);
        }
      }
    }
    walkDir(tempDir);

    const selectionResult = glacierSelect(allFiles, max_files);
    glacierEmit(runStateDir, selectionResult);
    writeFileSync(join(runStateDir, 'tree_snapshot.txt'), selectionResult.picked.join('\n'));

    result.phases.glacier = {
      total_files_found: allFiles.length,
      selected_files: selectionResult.picked.length,
      buckets: selectionResult.buckets,
    };
    emit('GLACIER_VERIFIED', 'glacier', {
      selected: selectionResult.picked.length, total: allFiles.length,
      message: `${selectionResult.picked.length} files selected via triadic balanced interleave`,
    });

    // ═══ PHASE 3: CRYSTAL ═══
    emit('CRYSTAL_PENDING', 'crystal', { message: 'Crystallizing artifact bundle...' });
    global._iceCrawlerRunStatus.current_phase = 'crystal';

    const crystalResult = crystalCrystallize(tempDir, runStateDir, {
      max_files, max_kb, max_file_bytes: max_kb * 1024,
    });

    emit('CRYSTAL_COPIED', 'crystal', {
      files_copied: crystalResult.manifest.length,
      message: `${crystalResult.manifest.length} files crystallized`,
    });

    // Crystal++ agents
    const ctx = new AgentContext({
      repo_root: tempDir, run_state_dir: runStateDir,
      synthesis_dir: crystalResult.synthesisDir, max_files: 600, max_kb,
    });

    const agentResults = {};
    const agents = [
      ['filetype_stats', runFiletypeStats],
      ['imports_index', runImportsIndex],
      ['hotspots', runHotspots],
      ['readme_synthesis', runReadmeSynthesis],
    ];

    for (const [name, fn] of agents) {
      try {
        fn(ctx);
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

    // ═══ PHASE 4: RESIDUE LOCK ═══
    emit('RESIDUE_PENDING', 'residue', { message: 'Purging temporary workspace...' });
    global._iceCrawlerRunStatus.current_phase = 'residue';

    const purged = glacierPurge(tempDir);

    const residueTruth = {
      ts: nowIso(), temp_dir: tempDir, purged, residue_empty: purged,
      proof: purged ? 'ρ = ∅' : 'PURGE_INCOMPLETE',
      message: purged
        ? 'Temporary workspace fully purged. Zero residual trace.'
        : 'WARNING: Purge incomplete — manual cleanup may be required.',
    };
    writeJson(join(runStateDir, 'residue_truth.json'), residueTruth);
    result.phases.residue = residueTruth;
    emit('RESIDUE_EMPTY_LOCK', 'residue', { purged, proof: residueTruth.proof, message: residueTruth.message });

    // ═══ AI HANDOFF ═══
    const manifestCompact = crystalResult.manifest.map(f => ({
      path: f.path, sha256: f.sha256, size_kb: f.size_kb,
    }));
    const manifestCompactHash = sha256Text(JSON.stringify(manifestCompact));
    const rootSeal = sha256Text(frostResult.head + manifestCompactHash + 'ICE_CRAWLER_V4_0P');

    const handoffDir = join(runStateDir, 'ai_handoff');
    ensureDir(handoffDir);
    writeJson(join(handoffDir, 'manifest_compact.json'), manifestCompact);
    writeFileSync(join(handoffDir, 'root_seal.txt'), rootSeal);

    const promptReady = `# ICE Crawler — AI Handoff

## Repository: ${repo_url}
## HEAD: ${frostResult.head}
## Run ID: ${runId}
## Root Seal: ${rootSeal}

## Artifact Manifest
${manifestCompact.map(f => `- ${f.path} (${f.size_kb} KB) [${f.sha256.slice(0, 8)}]`).join('\n')}

## Synthesis Artifacts
- See artifact/crystal/synthesis/ for analysis results
- filetype_stats.json — language/extension breakdown
- imports_index.json — dependency graph
- hotspots.json — largest files
- readme_synthesis.json — README extraction

## Determinism Contract
For identical (repo, revision, config) inputs, output artifacts are stable in file set and hash structure.
All files sealed with SHA-256. Root seal = SHA256(head + manifest_hash + "ICE_CRAWLER_V4_0P").
`;
    writeFileSync(join(handoffDir, 'PROMPT_READY.md'), promptReady);

    result.artifacts = {
      manifest: crystalResult.manifest, root_seal: rootSeal,
      manifest_compact: manifestCompact, synthesis_dir: crystalResult.synthesisDir,
      handoff_dir: handoffDir, prompt_ready: join(handoffDir, 'PROMPT_READY.md'),
    };

    emit('HANDOFF_READY', 'handoff', {
      root_seal: rootSeal, manifest_files: manifestCompact.length,
      message: 'AI handoff bundle complete',
    });

    // ═══ COMPLETE ═══
    const finishedAt = nowIso();
    global._iceCrawlerRunStatus.status = 'complete';
    global._iceCrawlerRunStatus.finished_at = finishedAt;
    result.status = 'complete';
    result.finished_at = finishedAt;

    emit('RUN_COMPLETE', 'complete', {
      run_id: runId,
      total_files: crystalResult.manifest.length,
      root_seal: rootSeal,
      message: 'Pipeline complete',
    });

    return result;

  } catch (err) {
    const errorResult = {
      status: 'error', error: err.message, stack: err.stack,
      phase: global._iceCrawlerRunStatus?.current_phase,
    };
    global._iceCrawlerRunStatus.status = 'error';
    global._iceCrawlerRunStatus.error = err.message;
    global._iceCrawlerRunStatus.finished_at = nowIso();
    emit('RUN_ERROR', 'error', { phase: errorResult.phase, error: err.message });
    return errorResult;
  }
}

export default { runPipeline };

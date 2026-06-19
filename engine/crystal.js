/**
 * engine/crystal.js
 * 💎 CRYSTAL — Deterministic Crystallization
 * Bounded file copy → SHA-256 seal → structural synthesis
 * Ported from Python: engine/roles/crystal_engine.py
 */

import { createHash } from 'crypto';
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname, relative } from 'path';

const TEXT_EXT = new Set([
  '.py', '.ps1', '.md', '.txt', '.json', '.jsonl', '.yml', '.yaml',
  '.ini', '.cfg', '.html', '.css', '.js', '.ts', '.tsx', '.toml',
  '.sh', '.bat', '.psm1', '.psd1', '.c', '.h', '.xml', '.svg',
]);

const DEFAULT_CONFIG = {
  max_files: 60,
  max_kb: 256,
  max_file_bytes: 256 * 1024,
  text_ext: TEXT_EXT,
};

/**
 * SHA-256 hash of a file
 */
export function sha256File(filePath) {
  const hash = createHash('sha256');
  const data = readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

/**
 * SHA-256 hash of text
 */
export function sha256Text(text) {
  const hash = createHash('sha256');
  hash.update(typeof text === 'string' ? text : String(text));
  return hash.digest('hex');
}

/**
 * Check if a file is a text file by extension
 */
function isTextFile(filePath) {
  const low = filePath.toLowerCase();
  for (const ext of TEXT_EXT) {
    if (low.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Ensure directory exists
 */
function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

/**
 * Safe relative path (normalize backslashes)
 */
function safeRelpath(fullPath, repoRoot) {
  return relative(repoRoot, fullPath).replace(/\\/g, '/');
}

/**
 * Walk directory and collect files
 */
function walkFiles(root, skipDirs = []) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || skipDirs.includes(entry.name)) {
        continue;
      }
      results.push(...walkFiles(fullPath, skipDirs));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Crystal crystallization — deterministic file walk, copy, hash, synthesis
 * @param {string} repoRoot - Root of the cloned repository
 * @param {string} runStateDir - Run state directory for artifacts
 * @param {Object} config - CrystalConfig overrides
 * @returns {Object} Crystallization result with manifest and report
 */
export function crystalCrystallize(repoRoot, runStateDir, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const artifactDir = join(runStateDir, 'artifact', 'crystal', 'files');
  const synthesisDir = join(runStateDir, 'artifact', 'crystal', 'synthesis');

  ensureDir(artifactDir);
  ensureDir(synthesisDir);

  // Walk all files in the repo
  const allFiles = walkFiles(repoRoot, ['state', 'node_modules']);

  // Select files: text files within size limit
  const selected = [];
  const skipped = [];

  for (const filePath of allFiles) {
    const relPath = safeRelpath(filePath, repoRoot);
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.')) || '';

    if (!TEXT_EXT.has(ext)) {
      skipped.push({ path: relPath, reason: 'not_text_ext' });
      continue;
    }

    let size;
    try {
      size = statSync(filePath).size;
    } catch {
      skipped.push({ path: relPath, reason: 'stat_failed' });
      continue;
    }

    if (size > cfg.max_file_bytes) {
      skipped.push({ path: relPath, reason: 'oversize', size });
      continue;
    }

    selected.push({ filePath, relPath, size });
  }

  // Sort for determinism, then limit
  selected.sort((a, b) => a.relPath.localeCompare(b.relPath));
  const picked = selected.slice(0, cfg.max_files);

  // Copy files and compute hashes
  const manifest = [];
  const hashes = {};

  for (const { filePath, relPath, size } of picked) {
    const destPath = join(artifactDir, relPath);
    ensureDir(dirname(destPath));

    try {
      copyFileSync(filePath, destPath);
      const hash = sha256File(destPath);
      manifest.push({
        path: relPath,
        sha256: hash,
        size_kb: Math.round((size / 1024) * 1000) / 1000,
      });
      hashes[relPath] = hash;
    } catch (e) {
      skipped.push({ path: relPath, reason: 'copy_failed', error: e.message });
    }
  }

  // Write manifest
  writeFileSync(
    join(runStateDir, 'artifact_manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Write hashes
  writeFileSync(
    join(runStateDir, 'artifact_hashes.json'),
    JSON.stringify(hashes, null, 2)
  );

  // Write crystal copy report
  const copyReport = {
    ts: new Date().toISOString().replace(/\.\d{3}Z/, 'Z'),
    picked: manifest.length,
    skipped: skipped.length,
    total_considered: selected.length,
    skipped_details: skipped.slice(0, 100),
  };
  writeFileSync(
    join(runStateDir, 'crystal_copy_report.json'),
    JSON.stringify(copyReport, null, 2)
  );

  // Write crystal index
  const crystalIndex = {
    ts: new Date().toISOString().replace(/\.\d{3}Z/, 'Z'),
    repo_root: repoRoot,
    run_state_dir: runStateDir,
    artifact_dir: artifactDir,
    total_files: manifest.length,
    total_skipped: skipped.length,
    config: {
      max_files: cfg.max_files,
      max_kb: cfg.max_kb,
    },
  };
  writeFileSync(
    join(runStateDir, 'crystal_index.json'),
    JSON.stringify(crystalIndex, null, 2)
  );

  return {
    manifest,
    hashes,
    copyReport,
    crystalIndex,
    artifactDir,
    synthesisDir,
  };
}

/**
 * Crystal seal — thin wrapper for simple usage
 */
export function crystalSeal(repoRoot = '.', runStateDir = 'state/runs/latest') {
  console.log('[CRYSTAL] starting analysis');
  ensureDir(runStateDir);
  const result = crystalCrystallize(repoRoot, runStateDir);
  console.log(`[CRYSTAL] done — ${result.manifest.length} files crystallized`);
  return result;
}

export const CrystalConfig = () => ({ ...DEFAULT_CONFIG });

export default { sha256File, sha256Text, crystalCrystallize, crystalSeal, CrystalConfig };

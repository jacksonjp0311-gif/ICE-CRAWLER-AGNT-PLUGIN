/**
 * engine/glacier.js
 * 🧊 GLACIER — Ephemeral Materialization
 * Shallow clone + triadic-balanced file selection + purge clone
 * Ported from Python: engine/glacier.py
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import { normalizeRepositoryUrl } from './repo-url.js';

const ALLOW_EXT = new Set(['.py', '.ps1', '.c', '.h', '.md', '.txt', '.json', '.yml', '.yaml', '.js', '.ts', '.tsx', '.toml', '.html', '.css', '.sh', '.bat', '.psm1', '.psd1']);

/**
 * Triadic boundary-oriented projection buckets:
 *   frost:   source-like payloads (.py, .c, .h, .js, .ts)
 *   glacier: operational/config payloads (.json, .yml, .yaml, .ps1, .toml)
 *   crystal: docs/meta payloads (.md, .txt, .html, .css)
 */
function triadicBucket(filePath) {
  const p = filePath.toLowerCase();
  const ext = p.slice(p.lastIndexOf('.')) || '';

  if (['.py', '.c', '.h', '.js', '.ts', '.tsx', '.sh', '.bat'].includes(ext)) return 'frost';
  if (['.json', '.yml', '.yaml', '.ps1', '.psm1', '.psd1', '.toml'].includes(ext)) return 'glacier';
  return 'crystal';
}

/**
 * Shallow clone a repository into a temp directory
 * @param {string} repoUrl - Git repository URL
 * @param {string} tempDir - Temporary directory path
 */
export function glacierClone(repoUrl, tempDir) {
  const normalized = normalizeRepositoryUrl(repoUrl);
  execSync(`git clone --depth=1 --single-branch "${normalized}" "${tempDir}"`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 120000,
  });
}

/**
 * Walk directory tree and collect all file paths
 */
function walkDir(root, prefix = '') {
  const results = [];
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      // Skip .git, node_modules, state directories
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...walkDir(fullPath, relPath));
    } else if (entry.isFile()) {
      results.push(relPath);
    }
  }
  return results;
}

/**
 * Select files using triadic-balanced interleave
 * @param {string[]} paths - All file paths found in the repo
 * @param {number} maxFiles - Maximum files to select
 * @returns {Object} Selection result with picked files and metadata
 */
export function glacierSelect(paths, maxFiles = 60) {
  // Filter to allowed extensions
  const allowed = paths
    .filter(p => ALLOW_EXT.has(p.toLowerCase().slice(p.lastIndexOf('.')) || ''))
    .map(p => p.trim())
    .filter(Boolean);

  const sorted = [...new Set(allowed)].sort();

  // Bucket into triadic categories
  const buckets = { frost: [], glacier: [], crystal: [] };
  for (const p of sorted) {
    buckets[triadicBucket(p)].push(p);
  }

  // Triadic-balanced interleave: round-robin across buckets
  const picked = [];
  const indices = { frost: 0, glacier: 0, crystal: 0 };
  const bucketOrder = ['frost', 'glacier', 'crystal'];

  while (picked.length < maxFiles) {
    let added = false;
    for (const bucket of bucketOrder) {
      if (indices[bucket] < buckets[bucket].length) {
        picked.push(buckets[bucket][indices[bucket]]);
        indices[bucket]++;
        added = true;
        if (picked.length >= maxFiles) break;
      }
    }
    if (!added) break; // All buckets exhausted
  }

  return {
    picked,
    total_scanned: sorted.length,
    buckets: {
      frost: buckets.frost.length,
      glacier: buckets.glacier.length,
      crystal: buckets.crystal.length,
    },
    selection_method: 'triadic_balanced_interleave',
  };
}

/**
 * Purge a directory strictly — git clean + rm -rf with retries
 * @param {string} path - Directory to purge
 * @param {number} tries - Number of retry attempts
 * @returns {boolean} True if directory was successfully purged
 */
export function glacierPurge(path, tries = 40) {
  // Try git clean first
  try {
    execSync(`git -C "${path}" clean -fdx`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
  } catch {
    // git clean may fail if not a git repo — that's fine
  }

  for (let i = 0; i < tries; i++) {
    if (!existsSync(path)) return true;
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      // retry
    }
    if (!existsSync(path)) return true;

    // Small delay between retries
    execSync('ping -n 1 127.0.0.1 > nul 2>&1', { timeout: 1000 });
  }

  return !existsSync(path);
}

/**
 * Emit glacier reference artifact
 */
export function glacierEmit(runStateDir, selectionResult) {
  const ref = {
    ts: new Date().toISOString().replace(/\.\d{3}Z/, 'Z'),
    ...selectionResult,
  };
  writeFileSync(
    join(runStateDir, 'glacier_ref.json'),
    JSON.stringify(ref, null, 2)
  );
  return ref;
}

export default { glacierClone, glacierSelect, glacierPurge, glacierEmit };

/**
 * engine/frost.js
 * ❄ FROST — Telemetry Scout
 * Resolves HEAD hash via git ls-remote. No clone.
 * Ported from Python: engine/frost.js
 */

import { execSync } from 'child_process';

/**
 * Get current UTC ISO timestamp (no microseconds)
 */
function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z/, 'Z');
}

/**
 * Run a command silently (suppress stderr on Windows)
 */
function runSilent(cmd, args) {
  try {
    const output = execSync(`${cmd} ${args.join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return { rc: 0, output };
  } catch (e) {
    return { rc: e.status || 1, output: (e.stdout || '') + (e.stderr || '') };
  }
}

/**
 * Frost telemetry — resolve HEAD hash without cloning
 * @param {string} repoUrl - Git repository URL
 * @returns {Object} Frost telemetry result
 */
export function frostTelemetry(repoUrl) {
  const { rc, output } = runSilent('git', ['ls-remote', repoUrl, 'HEAD']);

  let head = 'unknown';
  if (rc === 0 && output.trim()) {
    head = output.trim().split(/\s+/)[0];
  }

  return {
    ts: utcNow(),
    repo: repoUrl,
    head,
    mode: 'telemetry_only',
    clone_permitted: false,
  };
}

export default { frostTelemetry };

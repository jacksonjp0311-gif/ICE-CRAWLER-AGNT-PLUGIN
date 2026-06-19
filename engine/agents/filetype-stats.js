/**
 * engine/agents/filetype-stats.js
 * Count files by extension + bytes per extension
 * Ported from Python: engine/agents/crystal_agents/agent_filetype_stats.py
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { AgentContext, writeJson, nowIso } from './agent-base.js';

export function run(ctx) {
  const counts = {};
  const bytesByExt = {};
  let scanned = 0;

  function walk(root) {
    if (scanned > ctx.max_files) return;
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (scanned > ctx.max_files) break;

      const fullPath = join(root, entry.name);

      if (entry.isDirectory()) {
        // Skip state directory to avoid scanning our own artifacts
        const absRoot = root.replace(/\\/g, '/');
        if (absRoot.includes('/state') || absRoot.includes('/node_modules')) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        scanned++;
        const ext = (entry.name.match(/\.[^.]+$/) || ['<noext>'])[0].toLowerCase();
        let sz = 0;
        try { sz = statSync(fullPath).size; } catch { /* ignore */ }
        counts[ext] = (counts[ext] || 0) + 1;
        bytesByExt[ext] = (bytesByExt[ext] || 0) + sz;
      }
    }
  }

  walk(ctx.repo_root);

  // Sort by count descending, then name
  const sortedCounts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sortedBytes = Object.entries(bytesByExt)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const out = {
    agent: 'filetype_stats',
    ts: nowIso(),
    repo_root: ctx.repo_root,
    max_files: ctx.max_files,
    scanned_files: scanned,
    counts: Object.fromEntries(sortedCounts),
    bytes_by_ext: Object.fromEntries(sortedBytes),
  };

  const path = join(ctx.synthesis_dir, 'filetype_stats.json');
  writeJson(path, out);
  return path;
}

export default { run };

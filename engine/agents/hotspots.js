/**
 * engine/agents/hotspots.js
 * Identify largest files (top 100 by bytes) — complexity/change hotspots
 * Ported from Python: engine/agents/crystal_agents/agent_hotspots.py
 */

import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { AgentContext, writeJson, nowIso } from './agent-base.js';

export function run(ctx) {
  const rows = [];
  let filesScanned = 0;

  function walk(root) {
    if (filesScanned > ctx.max_files) return;
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (filesScanned > ctx.max_files) break;
      const fullPath = join(root, entry.name);

      if (entry.isDirectory()) {
        const absRoot = root.replace(/\\/g, '/');
        if (absRoot.includes('/state') || absRoot.includes('/node_modules')) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        filesScanned++;
        let sz = 0;
        try { sz = statSync(fullPath).size; } catch { continue; }
        const relPath = relative(ctx.repo_root, fullPath).replace(/\\/g, '/');
        rows.push({ sz, relPath });
      }
    }
  }

  walk(ctx.repo_root);

  // Sort by size descending
  rows.sort((a, b) => b.sz - a.sz);
  const top = rows.slice(0, 100);

  const out = {
    agent: 'hotspots',
    ts: nowIso(),
    repo_root: ctx.repo_root,
    max_files: ctx.max_files,
    files_scanned: filesScanned,
    largest_files: top.map(r => ({ bytes: r.sz, path: r.relPath })),
  };

  const path = join(ctx.synthesis_dir, 'hotspots.json');
  writeJson(path, out);
  return path;
}

export default { run };

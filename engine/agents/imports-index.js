/**
 * engine/agents/imports-index.js
 * Regex-based Python import extraction + frequency ranking
 * Ported from Python: engine/agents/crystal_agents/agent_imports_index.py
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { AgentContext, writeJson, readText, nowIso } from './agent-base.js';

const IMPORT_RE = /^\s*(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/gm;

export function run(ctx) {
  const imports = {};
  let filesScanned = 0;
  const maxBytes = ctx.max_kb * 1024;

  function walk(root) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(root, entry.name);

      if (entry.isDirectory()) {
        const absRoot = root.replace(/\\/g, '/');
        if (absRoot.includes('/state') || absRoot.includes('/node_modules')) continue;
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.py')) {
        filesScanned++;
        if (filesScanned > ctx.max_files) break;

        try {
          if (statSync(fullPath).size > maxBytes) continue;
        } catch { continue; }

        const txt = readText(fullPath, maxBytes);
        // Reset regex state
        IMPORT_RE.lastIndex = 0;
        let match;
        while ((match = IMPORT_RE.exec(txt)) !== null) {
          const mod = (match[1] || match[2] || '').trim();
          if (mod) {
            imports[mod] = (imports[mod] || 0) + 1;
          }
        }
      }
    }
  }

  walk(ctx.repo_root);

  const top = Object.entries(imports)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 500);

  const out = {
    agent: 'imports_index',
    ts: nowIso(),
    repo_root: ctx.repo_root,
    max_files: ctx.max_files,
    max_kb: ctx.max_kb,
    py_files_scanned: filesScanned,
    top_imports: top.map(([module, count]) => ({ module, count })),
  };

  const path = join(ctx.synthesis_dir, 'imports_index.json');
  writeJson(path, out);
  return path;
}

export default { run };

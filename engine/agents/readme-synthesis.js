/**
 * engine/agents/readme-synthesis.js
 * Extract README.md head snippets for AI handoff
 * Ported from Python: engine/agents/crystal_agents/agent_readme_synthesis.py
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { writeJson, nowIso } from './agent-base.js';

export function run(ctx) {
  const readmePaths = [];
  const candidates = ['README.md', 'README.MD', 'readme.md', 'Readme.md'];

  for (const cand of candidates) {
    const p = join(ctx.repo_root, cand);
    if (existsSync(p)) readmePaths.push(p);
  }

  const snippets = [];
  for (const p of readmePaths.slice(0, 3)) {
    const buf = readFileSync(p);
    const slice = buf.slice(0, Math.min(4000, buf.length));
    snippets.push({
      path: relative(ctx.repo_root, p).replace(/\\/g, '/'),
      head: slice.toString('utf-8'),
    });
  }

  const out = {
    agent: 'readme_synthesis',
    ts: nowIso(),
    repo_root: ctx.repo_root,
    readmes_found: readmePaths.map(p => relative(ctx.repo_root, p).replace(/\\/g, '/')),
    snippets,
    note: 'Lightweight head extraction for AI handoff; full synthesis assembled by Crystal++ orchestrator.',
  };

  const path = join(ctx.synthesis_dir, 'readme_synthesis.json');
  writeJson(path, out);
  return path;
}

export default { run };

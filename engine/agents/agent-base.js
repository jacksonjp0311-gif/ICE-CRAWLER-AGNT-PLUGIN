/**
 * engine/agents/agent-base.js
 * Shared utilities for Crystal analysis agents
 * Ported from Python: engine/agents/crystal_agents/agent_base.js
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

export function writeJson(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

export function readText(path, maxBytes = 200_000) {
  try {
    const buf = readFileSync(path);
    const slice = buf.slice(0, Math.min(maxBytes, buf.length));
    return slice.toString('utf-8');
  } catch {
    return '';
  }
}

export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z/, 'Z');
}

export class AgentContext {
  constructor({ repoRoot, runStateDir, synthesisDir, maxFiles = 600, maxKb = 256 }) {
    this.repo_root = repoRoot;
    this.run_state_dir = runStateDir;
    this.synthesis_dir = synthesisDir;
    this.max_files = maxFiles;
    this.max_kb = maxKb;
  }
}

export default { ensureDir, writeJson, readText, nowIso, AgentContext };

/**
 * engine/repo-url.js
 * URL normalizer — converts GitHub browse URLs to cloneable .git URLs
 * Ported from Python: engine/repo_url.py
 */

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

/**
 * Normalize user-provided repository references into cloneable targets.
 * Supports passthrough for local paths and non-HTTP git remotes.
 * For GitHub web URLs, trims non-clone path segments like /tree/<ref>/...
 */
export function normalizeRepositoryUrl(raw) {
  const value = (raw || '').trim();
  if (!value) return value;

  const lowered = value.toLowerCase();
  if (!lowered.startsWith('http://') && !lowered.startsWith('https://')) {
    return value; // local path or non-HTTP git remote — pass through
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return value;
  }

  const host = (parsed.hostname || '').toLowerCase();
  if (!GITHUB_HOSTS.has(host)) {
    return value; // non-GitHub HTTP URL — pass through
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return value;

  let [owner, repo] = parts;
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  return `https://github.com/${owner}/${repo}.git`;
}

export default { normalizeRepositoryUrl };

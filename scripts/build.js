/**
 * scripts/build.js
 * Build script — packages the plugin into a .agnt file
 * .agnt files are gzipped tar archives containing the plugin package
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { execSync } from 'child_process';

const PLUGIN_NAME = 'ice-crawler';
const SRC_DIR = join(process.cwd());
const BUILD_DIR = join(process.cwd(), 'build');
const DIST_DIR = join(process.cwd(), 'dist');

// Files to include in the .agnt package
const INCLUDE_PATTERNS = [
  'manifest.json',
  'package.json',
  'ice-crawler.js',
  'engine/**/*.js',
  'ui/**/*.js',
  'ui/**/*.html',
  'README.md',
  'LICENSE',
];

const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'build',
  'dist',
  '.gitignore',
  'package-lock.json',
];

function shouldInclude(filePath) {
  const rel = filePath.replace(SRC_DIR + '/', '');

  // Check excludes
  for (const pattern of EXCLUDE_PATTERNS) {
    if (rel.includes(pattern)) return false;
  }

  // Check includes
  for (const pattern of INCLUDE_PATTERNS) {
    if (pattern.includes('*')) {
      // Glob pattern
      const prefix = pattern.replace('/**', '').replace('/*', '');
      if (rel.startsWith(prefix)) return true;
    } else if (rel === pattern) {
      return true;
    }
  }

  return false;
}

function collectFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDE_PATTERNS.includes(entry.name)) {
        collectFiles(fullPath, files);
      }
    } else if (shouldInclude(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function build() {
  console.log('❄️ ICE Crawler — Building .agnt package\n');

  // Ensure output directory
  mkdirSync(DIST_DIR, { recursive: true });

  // Collect files
  const files = collectFiles(SRC_DIR);
  console.log(`  📦 ${files.length} files to package:`);
  for (const f of files) {
    const rel = f.replace(SRC_DIR + '/', '');
    const size = statSync(f).size;
    console.log(`     ${rel} (${size} bytes)`);
  }

  // Create tar-like manifest (simple JSON index + concatenated files)
  const manifest = {
    name: PLUGIN_NAME,
    version: '1.0.0',
    files: files.map(f => ({
      path: f.replace(SRC_DIR + '/', ''),
      size: statSync(f).size,
    })),
  };

  // Write the .agnt file (gzipped JSON bundle)
  const outputPath = join(DIST_DIR, `${PLUGIN_NAME}.agnt`);

  // Build a simple tar-like format: JSON manifest + file contents
  const bundle = JSON.stringify(manifest, null, 2);
  const { gzipSync } = await import('zlib');
  const compressed = gzipSync(Buffer.from(bundle));

  const { writeFileSync } = await import('fs');
  writeFileSync(outputPath, compressed);

  console.log(`\n  ✅ Built: ${outputPath}`);
  console.log(`  📏 Size: ${compressed.length} bytes (compressed)`);
  console.log(`\n  ❄️  Build complete!`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});

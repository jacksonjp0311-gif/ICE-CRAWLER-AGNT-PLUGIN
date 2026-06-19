#!/usr/bin/env node

/**
 * scripts/build.js — Build .agnt package
 * .agnt = gzipped tar archive with source + node_modules
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as tar from 'tar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGIN_DIR = path.resolve(__dirname, '..');
const PLUGIN_NAME = 'ice-crawler';
const DIST_DIR = path.join(PLUGIN_DIR, 'dist');

async function build() {
  console.log(`\n🔧 Building: ${PLUGIN_NAME}\n`);

  // Validate
  const manifestPath = path.join(PLUGIN_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) { console.error('❌ manifest.json not found'); process.exit(1); }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`📦 ${manifest.name} v${manifest.version}`);
  console.log(`🔧 Tools: ${manifest.tools?.map(t => t.type).join(', ') || 'None'}`);

  // Ensure node_modules
  const nmPath = path.join(PLUGIN_DIR, 'node_modules');
  if (!fs.existsSync(nmPath) || fs.readdirSync(nmPath).length === 0) {
    console.log('📥 Installing dependencies...');
    execSync('npm install --production', { cwd: PLUGIN_DIR, stdio: 'inherit' });
  }
  console.log(`✅ node_modules: ${fs.readdirSync(nmPath).length} packages`);

  // Create dist
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  // Collect files (exclude .git, dist, .gitignore, package-lock)
  const exclude = new Set(['.git', 'dist', '.gitignore', 'package-lock.json']);
  const files = fs.readdirSync(PLUGIN_DIR).filter(f => !exclude.has(f));

  console.log(`\n📁 ${files.length} items:`);
  files.forEach(f => {
    const stat = fs.statSync(path.join(PLUGIN_DIR, f));
    if (f === 'node_modules') console.log(`  - ${f}/ (${fs.readdirSync(path.join(PLUGIN_DIR, f)).length} packages)`);
    else if (stat.isDirectory()) console.log(`  - ${f}/`);
    else console.log(`  - ${f} (${stat.size} bytes)`);
  });

  // Create .agnt
  const outputFile = path.join(DIST_DIR, `${PLUGIN_NAME}.agnt`);
  console.log(`\n📦 Creating: ${outputFile}`);

  await tar.create(
    { gzip: true, file: outputFile, cwd: PLUGIN_DIR, prefix: PLUGIN_NAME },
    files
  );

  const stats = fs.statSync(outputFile);
  console.log(`\n✅ Build complete!`);
  console.log(`📦 Output: ${outputFile}`);
  console.log(`📊 Size: ${(stats.size / 1024).toFixed(1)} KB`);

  // Verify
  const contents = [];
  await tar.list({ file: outputFile, onentry: (entry) => contents.push(entry.path) });
  console.log(`📋 ${contents.length} files/directories in package`);
  console.log(`\n🚀 Ready for marketplace!`);
}

build().catch(err => { console.error('❌ Build failed:', err.message); process.exit(1); });

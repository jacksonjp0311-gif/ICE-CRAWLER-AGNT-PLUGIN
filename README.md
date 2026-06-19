# ❄️ ICE Crawler — AGNT Plugin

**Triadic zero-trace repository ingestion engine for AGNT.**

Ingest any Git repository through three isolated phases — **Frost → Glacier → Crystal** — then emit deterministic sealed artifacts and a cryptographic root seal for AI analysis. Zero residual trace. Real-time dashboard. AGNT thread submission.

[![AGNT](https://img.shields.io/badge/AGNT-Plugin-blueviolet?style=for-the-badge)](https://agnt.gg)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-e53d8f?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/v1.5.0-12e0ff?style=for-the-badge)](https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin)

---

## 🏗️ Architecture

```
Repo URL
  │
  ├─ ❄️ FROST   ──→ frost_summary.json        (telemetry: git ls-remote HEAD)
  │
  ├─ 🧊 GLACIER ──→ glacier_ref.json + tree_snapshot.txt
  │                   (shallow clone → triadic-balanced file selection → purge)
  │
  ├─ 💎 CRYSTAL ──→ artifact/ + manifests + hashes
  │                   (bounded copy → SHA-256 seal → structural synthesis)
  │                   ├─ filetype_stats.json
  │                   ├─ imports_index.json
  │                   ├─ hotspots.json
  │                   └─ readme_synthesis.json
  │
  ├─ 🔒 RESIDUE  ──→ residue_truth.json        (ρ = ∅ proof)
  │
  ├─ 🤖 HANDOFF  ──→ ai_handoff/
  │                   ├─ manifest_compact.json
  │                   ├─ root_seal.txt
  │                   └─ PROMPT_READY.md
  │
  └─ 📤 SUBMIT   ──→ AGNT analysis thread      (opens conversation with results)
```

### Determinism Contract

For identical `(repo, revision, config)` inputs, output artifacts are stable in file set and hash structure. All files sealed with SHA-256.

**Root Seal** = `SHA256(repo_head + manifest_compact_hash + "ICE_CRAWLER_V4_0P")`

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Triadic Pipeline** | Frost → Glacier → Crystal → Residue — four isolated phases |
| **Zero-Trace** | Temporary clone purged with 40 retries + git clean -fdx |
| **Deterministic** | Sorted walks, sorted outputs — same input = same artifacts |
| **SHA-256 Sealed** | Every file hashed, root seal anchors the entire bundle |
| **Crystal Agents** | Filetype stats, import index, hotspots, README synthesis |
| **AI Handoff** | Compact manifest + root seal + PROMPT_READY.md |
| **Real-Time Dashboard** | WebSocket-powered live monitoring UI |
| **Run History** | Persistent history with localStorage — click to re-run |
| **Incremental Mode** | Skip unchanged files from previous run |
| **Diff Panel** | Visualize changes between runs |
| **AGNT Submit** | One-click submit to open AGNT analysis thread |
| **φ-Partitioning** | Golden-ratio task splitting for multi-agent workflows |

---

## 📦 Installation

### As AGNT Plugin

```bash
# Clone and install
git clone https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin.git
cd ICE-CRAWLER-AGNT-Plugin
npm install
npm run build

# Install into AGNT via API
curl -X POST http://localhost:3333/api/plugins/install-file \
  -H "Content-Type: application/json" \
  -d '{"name":"ice-crawler","fileData":"<base64 of dist/ice-crawler.agnt>"}'
```

### As CLI Tool

```bash
git clone https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin.git
cd ICE-CRAWLER-AGNT-Plugin
npm install
```

---

## 🚀 Usage

### CLI — Ingest a Repository

```bash
# Full pipeline
node ice-crawler.js ingest https://github.com/owner/repo

# With options
node ice-crawler.js ingest https://github.com/owner/repo --max-files 100 --max-kb 512

# Incremental mode (skip unchanged files)
node ice-crawler.js ingest https://github.com/owner/repo --incremental

# Enable φ-extremal agentics
node ice-crawler.js ingest https://github.com/owner/repo --agentics
```

### CLI — Telemetry Estimate

```bash
# Frost-only scan (no clone)
node ice-crawler.js estimate https://github.com/owner/repo
```

### CLI — Dashboard

```bash
# Launch real-time monitoring dashboard
node ice-crawler.js dashboard 8765
# → Open http://localhost:8765
```

### AGNT Tool — Programmatic

```javascript
import IceCrawler from 'ice-crawler';

const crawler = new IceCrawler();

// Full ingestion
const result = await crawler.execute({
  repo_url: 'https://github.com/owner/repo',
  max_files: 60,
  max_kb: 256,
  incremental: true,
});

console.log(result.root_seal);
console.log(result.files_crystallized);

// Telemetry only
const estimate = await crawler.estimate({
  repo_url: 'https://github.com/owner/repo',
});
```

---

## 🖥️ Dashboard

The real-time dashboard provides live monitoring of pipeline execution:

- **Phase Ladder** — Visual progress through Frost → Glacier → Crystal → Residue
- **Event Stream** — Live WebSocket-fed event log
- **Stats Cards** — Files crystallized, root seal, agents complete, duration
- **Artifact Browser** — Browse crystallized artifacts as they're produced
- **Run History** — Click any previous run to re-run with same URL
- **Incremental Mode** — Checkbox to skip unchanged files
- **Diff Panel** — Shows added/modified/removed files between runs
- **Run Panel** — Configure and launch new ingestion runs
- **Submit to AGNT** — Appears after completion, opens AGNT analysis thread
- **Open AGNT Chat** — Direct link to AGNT web UI

### Dashboard Files

```
ui/
├── dashboard.html   ← Main HTML structure
├── dashboard.css    ← AGNT design system styles
├── dashboard.js     ← WebSocket client + UI logic
└── server.cjs       ← Express + WebSocket server (also at root for AGNT)
```

---

## ⚙️ Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `repo_url` | *(required)* | Git repository URL (GitHub browse, .git, or local path) |
| `max_files` | `60` | Maximum files to crystallize |
| `max_kb` | `256` | Maximum individual file size in KB |
| `output_dir` | `state/runs/<id>` | Custom output directory |
| `incremental` | `false` | Skip unchanged files from previous run |
| `enable_agentics` | `false` | Enable φ-extremal multi-agent partitioning |

---

## 📁 Output Structure

```
state/runs/<run-id>/
├── ui_events.jsonl                  ← Event stream (truth surface)
├── frost_summary.json               ← HEAD hash + telemetry
├── glacier_ref.json                 ← Selection metadata
├── tree_snapshot.txt                ← Selected file list
├── artifact_manifest.json           ← Crystallized files + SHA-256
├── artifact_hashes.json             ← Hash manifest
├── crystal_index.json               ← Crystal metadata
├── crystal_copy_report.json         ← Picked vs skipped audit
├── residue_truth.json               ← ρ = ∅ proof
├── artifact/
│   └── crystal/
│       ├── files/                   ← Crystallized repo files
│       └── synthesis/
│           ├── filetype_stats.json
│           ├── imports_index.json
│           ├── hotspots.json
│           └── readme_synthesis.json
└── ai_handoff/
    ├── manifest_compact.json        ← Compact file list for AI
    ├── root_seal.txt                ← Cryptographic seal
    └── PROMPT_READY.md              ← AI instructions
```

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Build .agnt package
npm run build

# Run tests
node ice-crawler.js estimate https://github.com/agnt-gg/agnt
node ice-crawler.js ingest https://github.com/agnt-gg/agnt --max-files 30

# Start dashboard for development
node ice-crawler.js dashboard 8765
```

### Project Structure

```
Ice-Crawler-AGNT-Plugin/
├── manifest.json              ← AGNT plugin manifest (3 tool schemas)
├── package.json               ← ES module, dependencies
├── ice-crawler.js             ← Main entry point (CLI + AGNT class)
├── server.cjs                 ← Dashboard server (also at root for AGNT)
├── open-url.js                ← Browser opening utility
├── engine/
│   ├── repo-url.js            ← URL normalizer
│   ├── frost.js               ← ❄ Telemetry scout
│   ├── glacier.js             ← 🧊 Shallow clone + triadic selection
│   ├── crystal.js             ← 💎 Bounded copy + SHA-256 seal
│   ├── orchestrator.js        ← Master pipeline coordinator
│   ├── phi-partition.js       ← φ golden-ratio partitioner
│   └── agents/
│       ├── agent-base.js      ← Shared agent utilities
│       ├── filetype-stats.js  ← Language/extension analysis
│       ├── imports-index.js  ← Dependency graph
│       ├── hotspots.js        ← Largest files
│       └── readme-synthesis.js ← README extraction
├── ui/
│   ├── dashboard.html         ← Dashboard HTML structure
│   ├── dashboard.css          ← AGNT design system styles
│   ├── dashboard.js           ← WebSocket client + UI logic
│   └── server.cjs             ← Express + WebSocket server
├── scripts/
│   └── build.js               ← .agnt package builder
└── README.md                  ← This file
```

---

## 🔐 Security Model

- **Containment-first**: Shallow clone into temp directory, purged after run
- **Zero-trace residue**: `purge_dir_strict()` does `git clean -fdx` + `rm -rf` with 40 retries
- **Deterministic artifacts**: Same input = same output (verified by hash structure)
- **Observational UI**: Dashboard reads event stream only — never performs git operations
- **No third-party API calls**: Engine is fully offline after clone

---

## 🧬 Evolution Roadmap

| Version | Features |
|---------|----------|
| **v1.0.0** | Core triadic pipeline, basic dashboard, AGNT plugin manifest |
| **v1.1.0** | Submit to AGNT button, persistent dashboard server |
| **v1.2.0** | open-url.js tool, enhanced AGNT integration |
| **v1.3.0** | ice-crawler-submit tool, AGNT thread submission |
| **v1.4.0** | Fixed AGNT install, proper ESM/CJS separation |
| **v1.5.0** | Extracted UI files, incremental mode, run history, diff panel |

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **GitHub**: [jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin](https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin)
- **AGNT**: [agnt.gg](https://agnt.gg)
- **Original Python Engine**: [jacksonjp0311-gif/Ice-Crawler](https://github.com/jacksonjp0311-gif/Ice-Crawler)

---

> *"Ingest any repository. Produce deterministic artifacts. Leave zero trace. Submit to AGNT."*

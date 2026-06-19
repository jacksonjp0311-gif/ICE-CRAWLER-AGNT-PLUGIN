# ❄️ ICE Crawler — AGNT Plugin

**Triadic zero-trace repository ingestion engine for AGNT.**

Ingest any Git repository through three isolated phases — **Frost → Glacier → Crystal** — then emit deterministic sealed artifacts and a cryptographic root seal for AI analysis. Zero residual trace.

[![AGNT](https://img.shields.io/badge/AGNT-Plugin-blueviolet?style=for-the-badge&logo=data:image/svg+xml;base64,)](https://agnt.gg)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-e53d8f?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/v1.0.0-12e0ff?style=for-the-badge)](https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin)

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
  └─ 🤖 HANDOFF  ──→ ai_handoff/
                      ├─ manifest_compact.json
                      ├─ root_seal.txt
                      └─ PROMPT_READY.md
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
| **φ-Partitioning** | Golden-ratio task splitting for multi-agent workflows |
| **AGNT Native** | Full plugin manifest, tool schemas, error handling |

---

## 📦 Installation

### As AGNT Plugin

```bash
# Clone the repo
git clone https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin.git
cd ICE-CRAWLER-AGNT-Plugin

# Install dependencies
npm install

# Build the .agnt package
npm run build

# Install into AGNT
# (via AGNT plugin installer or manual copy)
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
});

console.log(result.root_seal);
console.log(result.files_crystallized);

// Telemetry only
const estimate = await crawler.estimate({
  repo_url: 'https://github.com/owner/repo',
});
```

---

## 📊 Dashboard

The real-time dashboard provides live monitoring of pipeline execution:

- **Phase Ladder** — Visual progress through Frost → Glacier → Crystal → Residue
- **Event Stream** — Live WebSocket-fed event log
- **Stats Cards** — Files crystallized, root seal, agents complete, duration
- **Artifact Browser** — Browse crystallized artifacts as they're produced
- **Run Panel** — Configure and launch new ingestion runs

```
┌─────────────────────────────────────────────────────┐
│ ❄️ ICE Crawler                    ● Connected  Idle │
├─────────────────────────────────────────────────────┤
│                                                      │
│    ❄ ─── 🧊 ─── 💎 ─── 🔒                          │
│  Frost  Glacier Crystal Residue                     │
│                                                      │
│  ████████████████░░░░░░░░░░  60%                    │
│  Crystal sealing...                                  │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │    42    │ │  a3f7... │ │   3/4    │ │  12s   │ │
│  │  Files   │ │   Seal   │ │  Agents  │ │Duration│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
│  ┌─── 📡 Event Stream ──────────┐ ┌── 📦 Artifacts ┐ │
│  │ 12:01:03 FROST_VERIFIED      │ │ src/main.py    │ │
│  │ 12:01:05 GLACIER_CLONED      │ │ lib/utils.ts   │ │
│  │ 12:01:08 GLACIER_VERIFIED    │ │ README.md      │ │
│  │ 12:01:10 CRYSTAL_COPIED      │ │ ...            │ │
│  └──────────────────────────────┘ └────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `repo_url` | *(required)* | Git repository URL (GitHub browse, .git, or local path) |
| `max_files` | `60` | Maximum files to crystallize |
| `max_kb` | `256` | Maximum individual file size in KB |
| `output_dir` | `state/runs/<id>` | Custom output directory |
| `enable_agentics` | `false` | Enable φ-extremal multi-agent partitioning |
| `dashboard` | `false` | Launch dashboard after ingestion |

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
├── ui_contract.json                 ← UI reads-only contract
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

# Run tests (when added)
npm test

# Build .agnt package
npm run build

# Start dashboard for development
npm run dashboard
```

### Project Structure

```
Ice-Crawler-AGNT-Plugin/
├── manifest.json              ← AGNT plugin manifest + tool schemas
├── package.json               ← ES module, dependencies
├── ice-crawler.js             ← Main entry point (CLI + AGNT interface)
├── engine/
│   ├── repo-url.js            ← URL normalizer
│   ├── frost.js               ← Telemetry scout
│   ├── glacier.js             ← Ephemeral materialization
│   ├── crystal.js             ← Deterministic crystallization
│   ├── orchestrator.js        ← Master pipeline coordinator
│   ├── phi-partition.js       ← Golden-ratio partitioner
│   └── agents/
│       ├── agent-base.js      ← Shared agent utilities
│       ├── filetype-stats.js  ← Language/extension analysis
│       ├── imports-index.js  ← Dependency graph
│       ├── hotspots.js        ← Largest files
│       └── readme-synthesis.js ← README extraction
├── ui/
│   └── (dashboard is inlined in ice-crawler.js)
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

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **GitHub**: [jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin](https://github.com/jacksonjp0311-gif/ICE-CRAWLER-AGNT-Plugin)
- **AGNT**: [agnt.gg](https://agnt.gg)
- **Original Python Engine**: [jacksonjp0311-gif/Ice-Crawler](https://github.com/jacksonjp0311-gif/Ice-Crawler)

---

> *"Ingest any repository. Produce deterministic artifacts. Leave zero trace."*

# ✨ Eyqa - The Everyday AI Coworker

<div align="center">
  <img src="src/renderer/assets/icon.svg" width="96" height="96" alt="Eyqa Brandmark" />
  <h3>The Fast, Snappy, Everyday AI Coworker with Antigravity-Grade Agentic Superpowers</h3>
  <p><strong>Linux · macOS · Windows · Web</strong></p>
  <p><em>Obsidian monochromatic dark design · Free Multi-Provider AI Pool · Antigravity &amp; Manus Process Folding · Full Agentic Tooling</em></p>
</div>

---

## 🌟 What is Eyqa?

**Eyqa** is an ultra-responsive native desktop workspace engineered for everyday creators, engineers, researchers, and builders. It bridges the gap between everyday simplicity and publication-grade agentic rigor.

Inspired by Antigravity and Manus, Eyqa delivers a unified process timeline with automatic folding, human-in-the-loop decision cards, interactive widgets, native Chromium browser grounding, terminal execution, precision file surgery, and resilient multi-provider free tiers.

---

## ⚡ Key Capabilities

### 1. ▾ Manus & Antigravity Process Auto-Folding
- **Unified Process Timeline**: Reasoning steps, tool executions, and interactive questions fold into a sleek summary header (`▸ PROCESS & ACTIONS N actions • Decided: ... [Completed]`).
- **Prompt & Response Prominence**: When the final answer streams, the process automatically folds so the clean, unboxed markdown response is displayed front-and-center.
- **On-Demand Inspection**: Click the folded header at any time to inspect full reasoning, diffs, screenshots, and confirmed choices.

### 2. 🎛️ Interactive Human-in-the-Loop Decision Cards (`ask_question`)
- **Interactive Prompts**: The assistant pauses execution to request structured user feedback (single choice, multi-select, or custom text specification).
- **Deselect & Unchoose**: Full toggle ergonomics—click an active option to unchoose/deselect.
- **Clean Note Preservation**: Custom notes and specifications are never overwritten or corrupted.
- **Immediate State Transition**: Compresses cleanly into a verified decision step upon submission.

### 3. 🛠️ Antigravity-Grade Agentic Tools
- **Terminal Execution & Daemons (`run_command`, `manage_task`)**: Execute shell commands, launch long-running watchers/servers, and feed stdin interactively.
- **Precision File Surgery (`replace_file_content`, `view_file`)**: Surgical block replacements with unified diff previews and automated revertible snapshot versioning (`.eyqa/snapshots/`).
- **Native Chromium Browser Engine (`read_browser_page`, `browser_navigate`, `browser_action`)**: Built on Electron's Chromium runtime to navigate SPAs, execute JavaScript, fill forms, and capture screenshots.
- **Image Generation (`generate_image`)**: Instant high-resolution image creation using 100% free Pollinations.ai (Flux / SDXL) with fallback to OpenAI DALL-E 3.
- **Subagent Swarms (`invoke_subagent`)**: Delegate deep analytical or testing work to concurrent background subagents.

### 4. 🎁 1.45 Billion Free Tokens/mo Multi-Provider Engine
- **FCC Auto Pool Routing**: Integrated Free Claude Code background proxy on port 8082 with automatic failover across 5 free providers:
  - **Google Gemini 2.0 Flash**: 1 Billion free tokens/mo (15 RPM free tier via Google AI Studio).
  - **Groq Cloud (Llama 3.3 70B)**: 300 Million free tokens/mo (14.4k requests/day at 500+ tokens/sec).
  - **OpenRouter Free Pool**: 100 Million free tokens/mo (DeepSeek R1, Llama 3.3, Gemma 2).
  - **NVIDIA NIM**: 50 Million free tokens (Nemotron 70B / 120B credits).
  - **Qwen Cloud**: 1 Million tokens.
- **Fast Engine Switcher**: 1-click toggle between the **Free Auto Pool** and **Paid Frontier Engine** (Claude 3.7 Sonnet, GPT-4o, DeepSeek V3).

### 5. 📁 Workspaces & Project Memory
- **Project $\rightarrow$ Multi-Thread Hierarchy**: Organize threads under dedicated projects with folder binding.
- **Shared Project Memory (`.eyqa/memory.json`)**: Persistent project memory and changelog auto-injected into turns so context is preserved across threads.
- **Contextual Right-Hand Inspector Drawer**: Slide-in diff viewer and snapshot timeline with 1-click version rollback.

### 6. 🖤 Obsidian Monochromatic Design System
- Pure Apple / Linear / Vercel grade dark mode palette (`#0D0D0D`, `#121212`, `#181818`, white accents, zero AI slop).
- Fluid animations, live SVG avatars, and interactive Generative UI sandboxes with live iframe previews.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- Python 3.10+ (for embedded FCC free-tier router)

### Installation & Launch
```bash
# Clone the repository
git clone https://github.com/local-over/Eyqa.git
cd Eyqa

# Install dependencies
npm install

# Launch the native desktop application
npm start
```

### Or Run in Web / Headless Mode
```bash
npm run web
# Access the web UI at http://localhost:4321
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` / `Cmd + N` | Start a fresh chat thread in active project |
| `Ctrl + ,` / `Cmd + ,` | Open Settings & Engine Capacity Dashboard |
| `Enter` | Send message / prompt |
| `Shift + Enter` | Insert newline |
| `Escape` | Close active modals & Contextual Inspector Drawer |

---

## 📂 Project Structure

```
eyqa/
├── package.json               # Desktop scripts, build configuration & dependencies
├── README.md                  # Comprehensive user guide & architecture specs
├── src/
│   ├── main/                  # Electron Main Process & Native Node Services
│   │   ├── index.cjs          # Lifecycle, window management & IPC channels
│   │   ├── preload.cjs        # Secure ContextBridge API exposure
│   │   ├── fcc-service.cjs    # Embedded FCC proxy service manager
│   │   ├── agent/
│   │   │   ├── orchestrator.cjs # Multi-step agentic loop, tool runner & decision coordinator
│   │   │   ├── prompts.cjs    # Personas & system prompt builders
│   │   │   ├── providers/     # Provider manager, fallback router & client wrappers
│   │   │   └── tools/         # Browser, terminal, workspace surgery, images & web fetch
│   │   └── storage/           # SQLite session store, config store & snapshot manager
│   ├── renderer/              # High-performance desktop UI
│   │   ├── index.html         # Application shell & modular modals
│   │   ├── css/               # Obsidian Design System (app, markdown, widgets)
│   │   ├── assets/            # Crisp SVG vectors & living mascot frames
│   │   └── js/                # ChatView, App Controller, SettingsView, API Bridge, Icons
│   └── fcc/                   # Embedded Python Free-Tier Proxy Service
```

---

## ⚖️ License
Released under the **AGPL-3.0** License.

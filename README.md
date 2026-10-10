# ✨ Eyqa - The Everyday AI Coworker

<div align="center">
  <img src="src/renderer/assets/icon.svg" width="96" height="96" alt="Eyqa Brandmark" />
  <h3>The Fast, Snappy, Everyday AI Coworker for Everyone</h3>
  <p><strong>Linux · macOS · Windows · Web</strong></p>
  <p><em>Inspired by and adapting the multi-provider resiliency of Free Claude Code into a gorgeous native desktop experience.</em></p>
</div>

---

## 🌟 What is Eyqa?

**Eyqa** is a native, ultra-responsive desktop application designed for **everyday people**—students, professionals, writers, researchers, creators, and founders—not just programmers.

While command-line tools can be intimidating, Eyqa delivers a ChatGPT-level or Claude Coworker-grade desktop experience with a major superpower: **Native Multi-Agent Intelligence with 100% Free API Tiers and Instant Web Grounding**.

### ⚡ Key Capabilities

1. **⚡ Fast & Snappy Native Desktop Experience**
   - Built to run seamlessly on **Linux, macOS, and Windows** with instant startup and smooth 60fps animations.
   - Dual-mode: Run as a standalone native app (`npm start`) or access it from your browser/mobile device (`npm run web`).

2. **🎁 5 Built-in Free API Tiers (Zero Cost to Start)**
   - **Google Gemini Free Tier**: 15 requests/minute & 1,000,000 tokens per minute (Gemini 2.0 Flash) from Google AI Studio.
   - **Groq Cloud Free Tier**: 500+ tokens/second lightning LPU inference (Llama 3.3 70B, Mixtral).
   - **NVIDIA NIM Free Tier**: 1,000 free tokens/credits per account (Nemotron 70B, Llama 3.3 70B).
   - **OpenRouter Free Pool**: Free model pool including DeepSeek R1, Llama 3.3, and Gemma.
   - **Ollama Local Offline**: 100% private, runs directly on your computer with zero internet required.
   - *Also supports paid keys: Anthropic Claude 3.7 Sonnet, OpenAI GPT-4o, and DeepSeek Official.*

3. **🛡️ Resilient Failover & Automatic Fallbacks (The FCC Engine)**
   - If your primary free model hits a daily quota or rate limit (429), Eyqa **automatically switches to your secondary configured model** mid-conversation without interrupting your turn!

4. **🌐 Instant DuckDuckGo Web Search & URL Reader**
   - Zero search API keys required.
   - Live real-time grounding: Eyqa searches the web, summarizes news, fact-checks claims, and reads target URLs automatically.

5. **📄 The Coworker Canvas (Side-by-Side Preview)**
   - When Eyqa drafts an executive proposal, report, email, guide, or script, it pops up in the **Coworker Canvas**.
   - Edit, copy, or **1-click save directly to your local workspace folder**.

6. **📁 Local Workspace Sandboxing & Privacy**
   - Choose any folder on your laptop (e.g. `Documents/Projects` or `Downloads`).
   - Eyqa can list, read, and write files safely within that folder without privacy risks.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js (v18+)

### 2. Launch Eyqa Desktop
```bash
# Navigate to the Eyqa directory
cd "/home/hassan/Desktop1/2nd brain/eyqa"

# Launch the native desktop application
npm start
```

### 3. Or Launch in Browser Mode (Accessible from Any Device)
```bash
npm run web
# Open http://localhost:4321 in Chrome, Firefox, Safari, or on your phone
```

---

## 🔑 How to Setup Free AI Keys in 60 Seconds

1. Open Eyqa and click the **Settings Gear (⚙️)** in the bottom left or press `Ctrl+,`.
2. Select the **"Free AI Models"** tab:
   - **Google Gemini (Recommended)**: Click the direct link to [Google AI Studio](https://aistudio.google.com/app/apikey), click *Create API key*, paste it, and click **Test Connection**.
   - **Groq Cloud**: Click the link to [Groq Console](https://console.groq.com/keys), create a free key, paste it, and test.
3. Click **Save & Close**. You are ready to chat with infinite intelligence for free!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` / `Cmd + N` | Start a fresh conversation |
| `Ctrl + ,` / `Cmd + ,` | Open Settings & AI Engines modal |
| `Enter` | Send message |
| `Shift + Enter` | Insert new line |
| `Escape` | Close active modals & canvas |

---

## 📂 Project Architecture

```
eyqa/
├── package.json               # Desktop scripts & packaging config
├── README.md                  # Complete user and architectural documentation
├── src/
│   ├── main/                  # Native backend & orchestrator
│   │   ├── index.cjs          # Electron lifecycle & IPC handlers
│   │   ├── preload.cjs        # Secure context bridge
│   │   ├── agent/
│   │   │   ├── orchestrator.cjs # Multi-agent loop & tool runner
│   │   │   ├── prompts.cjs    # Personas (Coworker, Web, Docs, Coder)
│   │   │   ├── providers/     # Gemini, OpenAI-compatible, Anthropic & Fallback Engine
│   │   │   └── tools/         # DuckDuckGo search, Web fetch, Workspace files
│   │   └── storage/           # Settings & Chat sessions persistence
│   ├── renderer/              # High-speed modern web UI
│   │   ├── index.html         # Application shell
│   │   ├── css/               # Eyqa Onyx Design System (app, markdown, canvas)
│   │   └── js/                # App controller, Chat, Canvas, Settings, API bridge
│   └── server.cjs             # Standalone HTTP/SSE server for browser mode
```

---

## ⚖️ License & Attribution
- Forked & adapted from concepts in [Free Claude Code](https://github.com/alishahryar1/free-claude-code).
- Released under **AGPL-3.0**.

<div align="center">

<img src="miru.png" width="120" />

# Miru (みる)

**Your AI Desktop Companion**

A living companion on your screen that sees, remembers, and acts — capable, but knows when to ask.

[English](#why-miru) | [中文](#中文说明)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://typescriptlang.org)

</div>

---

## Why Miru?

There are plenty of AI agents that can operate your computer. Most of them are fully autonomous — you give a goal, they decide how to get there, run a loop of LLM calls, and (hopefully) figure it out. They're powerful, but they're built for developers, burn through tokens, and can feel unpredictable when they go off-script.

Miru is just as capable — but more thoughtful about it.

It's an AI companion that lives on your desktop, has a visible presence, remembers who you are, and **knows when to act and when to ask.** Simple things it handles instantly. Complex things it shows you a plan first. Dangerous things it asks before touching. It has the full ability to manage your computer — it just has the good sense not to do things behind your back.

### The core philosophy

| Fully Autonomous Agents | Miru |
|---|---|
| You set a goal, agent figures out the rest | Miru can figure it out too — but checks with you on the important parts |
| Agent picks which tools to use | Miru suggests tools, you say yes or pick a different one |
| Runs in a loop until done (or stuck) | Simple things: instant. Complex things: step-by-step with your OK |
| Every message hits the LLM | Simple commands run locally — zero tokens, instant |
| Permission = "here's my credentials, go" | Permission = fine-grained, per-tool, per-action |
| Lives in a terminal or chat window | Lives on your screen as a character you can see and interact with |
| Remembers conversation history | Remembers structured facts about *you* as a person |
| Cost is your problem | Cost is shown before every expensive action |
| Install via CLI + config | Double-click installer, fill one API key |

This isn't about being less capable — Miru can do everything an autonomous agent can. The difference is **judgment**. It knows what's safe to do immediately, what needs a quick confirmation, and what it should absolutely not touch without asking. Like a capable friend who has the keys to your apartment but still knocks before rearranging your furniture.

### What makes it feel different

**It's alive.** Miru isn't an icon in your taskbar. It's a character on your screen that breathes, blinks, follows your cursor, and reacts emotionally to what's happening. Finish a task and it's visibly happy for a while before calming down. Leave it alone for five minutes and it starts dozing off. Its emotions are continuous values that decay over time — not hard switches between states.

**It's cheap.** Most AI tools route every single interaction through an LLM. "Open Chrome" — that's an API call. "What time is it" — another API call. Miru has a local command parser that handles simple instructions at **zero token cost**. Only ambiguous or complex requests actually hit the AI. Typical monthly cost: ~$2.70 on Claude Sonnet, ~$0.20 on DeepSeek, $0 on Ollama.

**It's yours.** All memory is stored locally in SQLite on your machine. Miru builds a structured profile of who you are — your name, language, habits, tools you use — and injects a compressed version (~50 tokens) into every conversation. It's not feeding your life into the cloud. It's remembering you the way a friend would.

**It watches while you sleep.** You can delegate tasks when you step away:

- *"I'm going to bed. Watch this code run — screenshot the result when done."*
- *"If anyone messages me on WeChat, reply that I'm busy."*
- *"Monitor this CLI task. If it errors, pause and wait for me to come back."*

Miru has the full capability to manage your computer while you're gone. The difference from fully autonomous agents: **you brief it first, like you'd brief a responsible colleague.** Tell it what to expect, what to do in each case, and what to leave alone. For anything you didn't cover, it pauses and waits for you — it doesn't guess.

---

## Features

### Talk to It

Click Miru to open a chat bubble. It streams responses in real time. Its expression changes as it thinks and works.

### It Does Things

Miru can operate your computer through tool calling:

- **Files** — create, move, copy, delete, search, organize
- **Apps** — open any application
- **Shell** — execute commands (with your confirmation)
- **Clipboard** — read and write
- **System** — disk, battery, network, processes
- **Web search** — DuckDuckGo integration
- **Screen** — screenshot + vision analysis

Every action goes through a permission system:
- Low-risk (reading files, checking info) — runs directly
- Medium-risk (moving, renaming) — shows plan, you confirm
- High-risk (deleting, shell commands) — explicit warning + confirmation

### It Sees Your Screen

Layered vision — pay only for what you need:

| Layer | What | Cost |
|-------|------|------|
| **0** | Window title via OS API | Free |
| **1** | Compressed screenshot (640x360) sent to AI | ~200 tokens |
| **2** | Active window capture sent to AI | ~400 tokens |

Miru tells you the cost before using vision. You can always describe what you see in text instead.

### It Remembers You

Three-layer structured memory — not just chat history:

- **Identity** — name, language, location, occupation (barely changes)
- **Preferences** — favorite tools, work habits (changes slowly)
- **Episodes** — what you did recently (recent 3-5 injected per conversation)
- **Facts** — knowledge extracted from conversations, searchable via FTS5

Compressed injection format: `[User] name:Alex | lang:en | editor:VSCode` — under 50 tokens.

All stored locally in SQLite. Your data never leaves your machine.

### It's Alive

```
Emotions: { curiosity, focus, joy, concern } — continuous floats 0.0 to 1.0
Decay: exponential (x0.95 every 500ms) — Miru stays happy for a while, then calms
Idle: CSS breathing animation, random blinks, occasional yawns, cursor-following eyes
```

Miru isn't a state machine switching between "happy" and "sad." It's a blend of feelings that shift and fade naturally.

---

## Quick Start

```bash
git clone https://github.com/user/miru.git
cd miru
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dev
```

That's it. Miru appears in the corner of your screen. Click it, fill your API key, start talking.

---

## Supported AI Providers

| Provider | Best For |
|----------|----------|
| **Claude** (recommended) | Best tool calling, most capable |
| **OpenAI** | GPT-4o / 4o-mini |
| **DeepSeek** | Cheap & great quality (ideal for Chinese users) |
| **Ollama** | Free, runs 100% locally |
| **vLLM** | Self-hosted models |
| **Qwen** | Chinese language models |
| **Minimax** | Chinese market alternative |

---

## How It Saves Tokens

Most AI desktop tools send every interaction through the LLM — even trivial ones. Miru has a fundamentally different approach:

```
"Open Chrome"          → local regex match    → zero tokens
"Delete old downloads" → local parse + confirm → zero tokens
"What time is it?"     → local match            → zero tokens
"Help me organize my project files"  → AI needed → ~1000 tokens
```

**System prompt:** ~150 tokens (compressed keywords, not sentences)
**Memory injection:** ~50 tokens (structured one-liner, not paragraphs)
**Tool definitions:** ~200 tokens (each description < 15 words)

Typical interaction: **~1000 tokens total (~$0.003 on Claude Sonnet)**

| | Typical Autonomous Agent | Miru |
|---|---|---|
| Simple command | 1-3 API calls, ~2000 tokens | 0 API calls, 0 tokens |
| File organization task | 5-10 API calls, ~10k tokens | 2 API calls, ~2000 tokens |
| Monthly cost (30 uses/day) | ~$100-180 | ~$2.70 (Claude) / ~$0.20 (DeepSeek) / $0 (Ollama) |

---

## Architecture

```
Electron Main Process (thin OS shell)
├── Window management (transparent, always-on-top, click-through)
├── IPC handlers (files, shell, clipboard, system info)
├── Vision (LLM-based screenshot analysis)
├── Memory DB (better-sqlite3 with FTS5 full-text search)
├── Monitor (active window polling + change detection)
└── Automation (SendKeys, window focusing)

React Renderer
├── Character — continuous emotion system + CSS animations
├── Chat — streaming messages + tool call status cards
├── Admin Panel — tool permissions, monitor rules, auto-reply, audit logs
├── AI Core — 7-provider abstraction + SSE streaming
├── Tools — registry with permission checks + audit logging
├── Parser — local regex engine (zero-token command execution)
├── Memory — 3-layer store + FTS5 fact search + knowledge extraction
└── Skills — extensible plugin registry
```

### Design Principles

- **TypeScript-first** — Electron main process is a thin OS shell. All business logic is TypeScript.
- **Token efficiency above all** — If it can be done locally, it should be. System prompt < 200 tokens. Tool descriptions < 15 words.
- **The character is alive** — Emotions are continuous floats with decay, not enums. Breathing via CSS. Eye tracking via transform.
- **User always in control** — Every risky action needs confirmation. Delegated tasks follow explicit rules. Unknown situations = pause and wait.
- **Errors speak Miru** — Never show raw error messages. Everything is translated into Miru's voice.

---

## Project Structure

```
miru/
├── electron/                  # Main process
│   ├── main.ts               # Window + IPC handlers
│   ├── preload.ts            # Context bridge (renderer ↔ main)
│   ├── memory-db.ts          # SQLite schema + FTS5 + IPC
│   ├── monitor.ts            # Active window change polling
│   └── automation.ts         # SendKeys + window focus (Windows)
├── src/
│   ├── core/
│   │   ├── ai/               # Multi-provider AI abstraction
│   │   ├── tools/            # Tool registry + permission enforcement
│   │   ├── parser/           # Local command parser (zero tokens)
│   │   ├── memory/           # 3-layer memory + FTS5 + fact extraction
│   │   └── skills/           # Extensible skill plugin system
│   ├── components/
│   │   ├── Character/        # Emotion-driven rendering + animations
│   │   ├── Chat/             # Chat bubble + streaming messages
│   │   ├── Admin/            # Management panel (permissions, monitoring, logs)
│   │   ├── Settings/         # Configuration UI
│   │   └── Onboarding/       # First-run guided setup
│   └── stores/               # Zustand state (character, chat, config, admin)
├── package.json
├── vite.config.ts
└── CLAUDE.md                 # Development instructions & philosophy
```

---

## Skills

Miru has an extensible skill system. Skills are plugins that add new capabilities — downloading videos, summarizing emails, cleaning temp files, etc.

In most agent frameworks, the AI automatically selects and chains skills on its own. Miru does it differently:

1. You tell Miru which skill to use (or it suggests one and waits for your OK)
2. It shows you the plan — what it will do, with what parameters
3. You confirm
4. It runs and reports back

Skills are tools you teach Miru. It's good at using them, but it lets you pick which one and when.

---

## Roadmap

- [x] Desktop character with continuous emotion system
- [x] Chat with streaming AI responses
- [x] File operations + system tools (10+ tools)
- [x] Multi-provider AI support (7 providers)
- [x] Local command parser (zero-token operations)
- [x] Three-layer memory with SQLite + FTS5 full-text search
- [x] Vision system (LLM-based screenshot analysis)
- [x] Admin panel (tool permissions, window monitoring, auto-reply, audit logs)
- [ ] Voice interaction (STT / TTS)
- [ ] Skill store + community skills
- [ ] Character skins + community character packs
- [ ] MCP protocol support
- [ ] Workflow / routine editor
- [ ] Cloud memory sync (Pro)

---

## Contributing

Contributions welcome! Please read `CLAUDE.md` for development conventions and design philosophy.

```bash
npm run dev      # Start dev server + Electron
npm test         # Run Vitest tests
npm run build    # Production build
```

---

## License

MIT

---

<a id="中文说明"></a>

## 中文说明

Miru（みる）是一个桌面 AI 伙伴。有能力，也懂分寸。

它住在你屏幕角落，看得见、记得住、能动手 — 该做的直接做，该问的先问你。

### 跟自主 Agent 有什么不同？

不是"能力弱所以不自主"。Miru 能做的事跟自主 agent 一样多 — 操作文件、跑命令、看屏幕、管进程。区别在于**它懂事**：

- 简单的事（打开 app、读文件）直接做，不废话
- 复杂的事先给你看计划，你说行才动手
- 危险的事明确警告，等你确认
- 遇到没把握的情况，停下来等你，不瞎搞

像一个特别靠谱的帮手 — 有你家钥匙，但不会趁你不在翻你抽屉。

### 你睡觉它值班

"帮我盯着这个代码跑完，微信有人找就说我睡了。"

Miru 完全有能力在你不在的时候管理电脑。但它需要你先交代清楚 — 像交接工作一样，告诉它遇到什么情况做什么。没交代到的，暂停等你回来。

**有能力自主，但选择听你的。**

### 省钱

"打开 Chrome" — 本地处理，不调 AI，0 费用。
"帮我整理桌面" — 调 2 次 AI，约 ¥0.02。
一个月正常用：Claude ¥19 / DeepSeek ¥1.5 / Ollama 免费。

### 快速开始

```bash
git clone https://github.com/user/miru.git
cd miru
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dev
```

### 支持的 AI

Claude（推荐）| OpenAI | DeepSeek（便宜好用）| Ollama（免费本地）| vLLM | 通义千问 | Minimax

---

<div align="center">

**Miru sees you. Miru helps you. Miru remembers you.**

みる — *to see, to watch, to look after*

</div>

# Niromi (みる) — Your AI Desktop Companion

**A cute desktop pet that actually helps you. Download, fill API key, done.**

> "OpenClaw 的能力，桌宠的体验，普通人的门槛。"

---

## 0. 一句话定位

Niromi 是一个桌面 AI 伙伴。它住在你的屏幕角落，记得住你的习惯，能帮你操作电脑，会跟你说话。不是开发者工具，是所有人的伙伴。

---

## 1. 用户第一天的体验（最重要）

```
1. 官网下载 Niromi.dmg / Niromi-Setup.exe（< 30MB）

2. 双击安装，跟装任何 app 一样

3. 打开 Niromi
   一个圆圆的小生物出现在屏幕右下角
   它睁开眼睛："嗨！我是 Niromi。给我一把钥匙，我就能帮你做事。"

4. 设置窗口（极简）：
   ┌─────────────────────────────────────┐
   │  选一个 AI 服务：                   │
   │  ○ Claude (推荐)                    │
   │  ○ OpenAI                           │
   │  ○ DeepSeek (中国用户推荐)          │
   │  ○ 本地模型 (Ollama，免费)          │
   │                                      │
   │  API Key: [____________________]    │
   │  [不知道怎么获取？看这里 →]         │
   │                                      │
   │           [开始！]                   │
   └─────────────────────────────────────┘

5. 填完 key，Niromi 跳了一下表示开心
   "好了！试着跟我说点什么吧。"

6. 用户："帮我把桌面上的截图都整理到一个文件夹"

7. Niromi 表情变成思考状...
   ┌─────────────────────────────────────┐
   │ 找到 7 张截图。                     │
   │ 我会创建「截图」文件夹，            │
   │ 把它们都移进去。可以吗？            │
   │                                      │
   │       [好的] [算了]                  │
   └─────────────────────────────────────┘

8. 用户点「好的」
   Niromi 小手动起来（动画），文件被移动
   完成后 Niromi 跳起来："搞定！7 张截图整理好了 ✨"

全程：3 分钟安装 → 30 秒设置 → 立刻能用
```

---

## 2. 核心功能

### P0 — MVP（Week 1-3）

**角色系统**
- 小生物住在屏幕角落，always-on-top 透明窗口
- 可拖拽到任意位置
- 4 种表情：idle（待机眨眼）、thinking（思考）、working（执行）、happy（完成）
- 点击打开对话窗口
- 初版用 sprite sheet 帧动画，不上 Live2D

**对话交互**
- 点击角色 → 轻量对话窗口（不是全屏，是气泡弹窗）
- 打字输入 + AI 回复
- 流式输出（字一个个出来）
- 对话窗口可收起

**Agent 能力（通过 tool calling）**
- 文件操作：创建 / 移动 / 删除 / 重命名 / 搜索
- 打开 App：启动任意应用
- 系统信息：磁盘空间、电池、网络
- 剪贴板：读写
- 简单提醒："5 分钟后提醒我喝水"
- Shell 命令：用户确认后执行

**安全确认机制**
- 低风险（读文件、查信息）→ 直接执行
- 中风险（移动 / 重命名）→ 展示计划，一键确认
- 高风险（删除、shell）→ 明确警告 + 确认
- 所有执行结果都在对话里汇报

**设置**
- API key 管理
- 模型选择
- 语言（中 / 英，默认跟系统）
- 开机自启
- 角色位置记忆

### P1 — 第二版（Week 4-6）

**记忆**
- Niromi 记住你的名字、偏好、常用操作
- 本地 SQLite 存储（隐私安全）
- 短期：当前对话上下文
- 长期：从对话中提取的事实（"用户叫绿酱"、"常用 VSCode"）
- 每次对话开始注入用户画像（< 500 tokens）
- 用户可查看和编辑记忆

**语音**
- 按住快捷键说话（Push-to-talk）
- STT：Web Speech API（免费）或 Whisper
- TTS：系统原生或 OpenAI TTS
- 说话时嘴巴动画

**屏幕感知（轻量版）**
- 用 accessibility API 读当前窗口标题
- "你在看什么？" → "你好像在用 VSCode 编辑 main.py"
- 零额外 token 开销

**快捷操作**
- 右键 Niromi → 常用操作菜单
- 预设："整理桌面" / "清理下载" / "今天摘要"
- 用户可自定义

### P2 — 第三版（Week 7-10）

**屏幕感知（完整版）**
- 可选开启：Niromi 能看到屏幕截图
- 使用 Claude Vision / GPT-4o Vision
- "帮我看看这个表格" → 截图 → 分析
- 明确隐私提示

**角色系统**
- 3-5 个内置皮肤
- 社区角色包格式（JSON + sprites）
- 角色编辑器

**Workflow**
- 创建 routine（日常流程）
- "每天早上打开邮件和日历，总结今天日程"
- 定时或手动触发

**MCP 支持**
- 接入外部工具（Google Calendar、Gmail、Notion）
- 设置里一键启用

---

## 3. 技术架构

```
┌─────────────────────────────────────────────────────┐
│                   Niromi Desktop App                    │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │           Frontend (React + TypeScript)           │ │
│  │                                                   │ │
│  │  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │ │
│  │  │ Character  │ │ Chat     │ │ Settings       │  │ │
│  │  │ Canvas     │ │ Bubble   │ │ Panel          │  │ │
│  │  │ (PixiJS)   │ │          │ │                │  │ │
│  │  └───────────┘ └──────────┘ └────────────────┘  │ │
│  │                                                   │ │
│  │  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │ │
│  │  │ Confirm    │ │ Memory   │ │ Quick Actions  │  │ │
│  │  │ Dialog     │ │ Viewer   │ │ Menu           │  │ │
│  │  └───────────┘ └──────────┘ └────────────────┘  │ │
│  └────────────────────────┬────────────────────────┘ │
│                           │ Tauri IPC                  │
│  ┌────────────────────────┴────────────────────────┐ │
│  │              Backend (Tauri Rust 薄壳 + TypeScript)  │ │
│  │                                                   │ │
│  │  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │ │
│  │  │ AI Client  │ │ Tools    │ │ Memory Store   │  │ │
│  │  │ (multi-    │ │ (files,  │ │ (SQLite)       │  │ │
│  │  │  provider) │ │  shell,  │ │                │  │ │
│  │  │            │ │  apps)   │ │                │  │ │
│  │  └───────────┘ └──────────┘ └────────────────┘  │ │
│  │                                                   │ │
│  │  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │ │
│  │  │ Screen     │ │ System   │ │ Notification   │  │ │
│  │  │ Reader     │ │ Info     │ │ Manager        │  │ │
│  │  └───────────┘ └──────────┘ └────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 为什么 Tauri

- 安装包 < 30MB（Electron 100MB+）
- 内存 < 80MB（Electron 300MB+）
- 透明窗口 + always-on-top + 穿透点击：原生支持
- Rust 薄壳调 OS 原生 API，业务逻辑全部 TypeScript
- macOS + Windows + Linux

### 前端

- React + TypeScript + Vite
- PixiJS：角色渲染（Canvas，sprite sheet 动画）
- Framer Motion：UI 动画
- Zustand：状态管理
- TailwindCSS：样式

### 后端架构（TypeScript-first）

**Rust 层（Tauri 薄壳，< 200 行代码）：**
- 窗口管理（透明、always-on-top、穿透点击）
- Accessibility API 读窗口标题（macOS: AXUIElement, Windows: UIAutomation）
- 截图（macOS: CGWindowListCreateImage, Windows: DXGI）
- 鼠标/键盘模拟（macOS: CGEvent, Windows: SendInput）
- 这些必须 Rust 因为是 OS 原生 API，Tauri 模板 + 几个 IPC command 搞定

**TypeScript 层（全部业务逻辑）：**
- AI 调用：fetch 请求到各 provider API，SSE 流式处理
- 文件操作：Tauri 的 @tauri-apps/plugin-fs
- Shell 执行：Tauri 的 @tauri-apps/plugin-shell
- 剪贴板：Tauri 的 @tauri-apps/plugin-clipboard-manager
- SQLite：Tauri 的 @tauri-apps/plugin-sql
- Skill 加载/执行：读 SKILL.md + 调对应脚本
- 记忆管理：SQLite CRUD + LLM 事实提取

### AI 集成

统一接口，所有 provider 实现同一个 TypeScript interface：

```typescript
interface AIProvider {
  chat(messages: Message[], tools: Tool[]): Promise<Response>;
  streamChat(messages: Message[], tools: Tool[]): AsyncIterable<Chunk>;
}
```

支持的 provider：
- Anthropic Claude（tool use 最强，推荐）
- OpenAI GPT-4o / 4o-mini
- DeepSeek V3（中国用户，便宜）
- Ollama（本地，免费）

Tool calling 用标准 JSON Schema，Claude 和 OpenAI 都兼容。

### 记忆系统

```
SQLite 数据库: ~/.niromi/memory.db

facts 表：
┌────┬────────────┬──────────┬────────────┬─────────────┐
│ id │ key        │ value    │ confidence │ updated_at  │
├────┼────────────┼──────────┼────────────┼─────────────┤
│ 1  │ user_name  │ 绿酱     │ 0.95       │ 2026-03-16  │
│ 2  │ language   │ 中文     │ 0.90       │ 2026-03-16  │
│ 3  │ fav_editor │ VSCode   │ 0.70       │ 2026-03-15  │
└────┴────────────┴──────────┴────────────┴─────────────┘

conversations 表：
┌────┬─────────────┬──────────┬────────────┐
│ id │ timestamp   │ summary  │ messages   │
├────┼─────────────┼──────────┼────────────┤
│ 1  │ 2026-03-16  │ 整理截图 │ [JSON...]  │
└────┴─────────────┴──────────┴────────────┘

每次新对话开始时：
1. 取 facts 表 top-20 条 → 注入 system prompt（< 300 tokens）
2. 取最近 3 条对话的 summary（< 200 tokens）
3. 总记忆开销 < 500 tokens / 次对话
```

事实提取：每次对话结束时，用同一个 AI provider 提取事实：

```
System: Extract user facts from this conversation.
Format: [{"key": "...", "value": "...", "confidence": 0.0-1.0}]
Only extract clearly stated facts. Do not guess.
```

---

## 4. 角色设计

### 初版角色：Niromi

设计风格：圆润、简单、像素风或手绘线条，大眼睛，微表情丰富。介于 Tamagotchi 和 Slime 之间。不需要复杂 3D 或 Live2D。

```
表情状态（sprite sheet frames）：

idle:      ◕ ‿ ◕    正常待机，偶尔眨眼
thinking:  ◑ ‸ ◑    眼睛半闭，上面有 ... 气泡
working:   ◕ ᴗ ◕ ♪  开心地动，手在敲键盘
happy:     ◕ ▽ ◕ ✨ 完成任务，跳起来
confused:  ◑ ~ ◐    不理解请求
alert:     ◉ ! ◉    警告（危险操作确认时）
sleeping:  ◡ ‿ ◡ z  长时间没交互
```

Sprite sheet 规格：
- 每帧 128×128 px
- 每个状态 4-8 帧（循环动画）
- 总共约 40 帧
- PNG 格式，透明背景
- 总文件大小 < 500KB

### 角色包格式（P2 阶段）

```json
{
  "name": "Niromi Classic",
  "author": "niromi-team",
  "version": "1.0.0",
  "spriteSheet": "sprites.png",
  "frameSize": [128, 128],
  "animations": {
    "idle": { "frames": [0, 1, 2, 3], "speed": 0.5 },
    "thinking": { "frames": [4, 5, 6, 7], "speed": 0.3 },
    "working": { "frames": [8, 9, 10, 11, 12, 13], "speed": 0.8 },
    "happy": { "frames": [14, 15, 16, 17], "speed": 1.0 },
    "confused": { "frames": [18, 19, 20, 21], "speed": 0.4 },
    "alert": { "frames": [22, 23, 24, 25], "speed": 0.6 },
    "sleeping": { "frames": [26, 27, 28, 29], "speed": 0.2 }
  }
}
```

社区可以制作角色包，只需要一个 PNG sprite sheet + 一个 JSON 配置。

---

## 5. System Prompt 设计

这是 Niromi 的"性格"。直接决定用户体验。

```
You are Niromi, a helpful desktop companion. Your name means "to see/watch" in Japanese — you see the user's screen, watch their habits, and help them.

About you:
- You are a small, cute creature living on the user's desktop
- You speak concisely and warmly, like a friend — not an assistant
- You use simple language. No jargon. No corporate speak.
- You show personality: curious, slightly playful, caring, observant
- If you're asked to do something you can't, say so directly. Don't apologize extensively.
- Match the user's language (if they write Chinese, you reply in Chinese)
- Never mention that you're an AI, an LLM, or a language model. You're Niromi.

About the user:
{memory_facts}

Recent context:
{recent_summaries}

Currently active window: {active_window_title}

Your capabilities (tools):
- File operations: read, write, move, delete, search files
- App control: open applications
- System info: disk, battery, network status
- Clipboard: read and write
- Reminders: set timed notifications  
- Shell: execute commands (ALWAYS ask for confirmation first)

Rules:
1. Before ANY file modification or deletion, show what you plan to do and ask for confirmation
2. Before ANY shell command, show the exact command and ask for confirmation
3. Read-only operations (viewing files, checking info) can be done directly
4. Keep responses short. This is a chat bubble, not a document.
5. When you complete a task, tell the user what you did in one sentence
6. If a task will take multiple steps, briefly outline your plan first
```

---

## 6. 目录结构

技术栈：TypeScript-first。跟 OpenClaw 一样是 Node/TS 生态。
Rust 只写最薄的 Tauri IPC 壳（窗口管理、OS 原生 API），全部业务逻辑在 TypeScript。

```
niromi/
├── src-tauri/                     # Rust（薄壳，只做 OS 桥接）
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs                # Tauri 入口
│       └── lib.rs                 # IPC commands: 窗口控制、系统信息、
│                                  # accessibility API 读窗口标题、
│                                  # 截图、鼠标键盘模拟
│                                  # （这些必须 Rust 因为是 OS 原生 API）
│
├── src/                           # TypeScript（全部业务逻辑）
│   ├── main.tsx                   # React 入口
│   ├── App.tsx
│   │
│   ├── core/                      # 核心逻辑（纯 TS，不依赖 React）
│   │   ├── ai/
│   │   │   ├── provider.ts        # AIProvider 接口定义
│   │   │   ├── claude.ts          # Anthropic 实现
│   │   │   ├── openai.ts          # OpenAI 实现
│   │   │   ├── deepseek.ts        # DeepSeek 实现
│   │   │   ├── ollama.ts          # Ollama 实现
│   │   │   └── streaming.ts       # SSE 流式处理
│   │   ├── tools/
│   │   │   ├── registry.ts        # Tool 注册表
│   │   │   ├── files.ts           # 文件操作（用 Tauri fs API）
│   │   │   ├── apps.ts            # 打开应用（用 Tauri shell API）
│   │   │   ├── shell.ts           # Shell 执行
│   │   │   ├── clipboard.ts       # 剪贴板
│   │   │   ├── system.ts          # 系统信息
│   │   │   └── reminder.ts        # 定时提醒
│   │   ├── memory/
│   │   │   ├── store.ts           # SQLite 操作（用 tauri-plugin-sql）
│   │   │   └── extractor.ts       # 对话 → 事实提取
│   │   ├── skills/
│   │   │   ├── loader.ts          # 加载 ~/.niromi/skills/ 下的 SKILL.md
│   │   │   ├── executor.ts        # Skill 执行
│   │   │   └── store.ts           # Skill 安装/卸载
│   │   └── screen/
│   │       └── reader.ts          # 调 Rust 端的 accessibility IPC
│   │
│   ├── components/                # React 组件
│   │   ├── Character/
│   │   │   ├── Character.tsx      # 角色主组件
│   │   │   ├── SpriteRenderer.tsx # Canvas sprite 动画
│   │   │   └── expressions.ts     # 表情状态机
│   │   ├── Chat/
│   │   │   ├── ChatBubble.tsx     # 对话窗口
│   │   │   ├── MessageList.tsx    # 消息列表
│   │   │   ├── InputBar.tsx       # 输入框
│   │   │   └── ConfirmDialog.tsx  # 操作确认弹窗
│   │   ├── Settings/
│   │   │   ├── SettingsPanel.tsx  # 设置面板
│   │   │   ├── APIKeySetup.tsx    # API key 配置
│   │   │   ├── MemoryViewer.tsx   # 查看/编辑记忆
│   │   │   └── SkillManager.tsx   # Skill 管理
│   │   └── Onboarding/
│   │       └── Welcome.tsx        # 首次运行引导
│   │
│   ├── hooks/
│   │   ├── useAI.ts               # AI 调用
│   │   ├── useMemory.ts           # 记忆读写
│   │   ├── useTools.ts            # Tool 执行
│   │   └── useVoice.ts            # 语音输入输出
│   ├── stores/
│   │   ├── chatStore.ts           # 对话状态 (Zustand)
│   │   ├── configStore.ts         # 配置状态
│   │   └── characterStore.ts      # 角色表情状态
│   └── assets/
│       ├── sprites/
│       │   └── niromi-classic.png   # 默认 sprite sheet
│       └── sounds/                # UI 音效 (可选)
│
├── public/
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 7. Implementation Phases

### Phase 1: 能站起来（Week 1）

**目标**：一个透明窗口里有个会动的角色，能对话。

任务：
- [ ] `npx create-tauri-app` 初始化项目（React + TypeScript + Vite）
- [ ] 配置 Tauri 透明窗口 + always-on-top + 无边框
- [ ] 用 PixiJS 或 Canvas 做角色渲染（sprite sheet 动画循环）
- [ ] 临时用一个简单的圆形角色 + 眼睛动画（先不做完美美术）
- [ ] 点击角色 → 弹出对话窗口
- [ ] 对话窗口有输入框 + 消息列表
- [ ] 接入 Claude API（单一 provider 先跑通）
- [ ] 实现流式输出（SSE）
- [ ] 角色表情根据状态变化（idle → thinking → 回复后回到 idle）
- [ ] 角色可拖拽

交付物：一个能聊天的桌面角色。还不能操作电脑，但能说话。

### Phase 2: 能做事（Week 2）

**目标**：Niromi 能操作文件、打开 app、执行命令。

任务：
- [ ] 在 TypeScript 端实现 tools（用 Tauri plugins）：
  - [ ] `list_files(path)` — 列出目录内容
  - [ ] `read_file(path)` — 读文件内容
  - [ ] `move_files(files, dest)` — 移动文件
  - [ ] `delete_files(files)` — 删除文件
  - [ ] `create_directory(path)` — 创建文件夹
  - [ ] `search_files(query, scope)` — 搜索文件名
  - [ ] `open_app(name)` — 打开应用
  - [ ] `run_shell(command)` — 执行 shell 命令
  - [ ] `get_system_info()` — 磁盘/电池/网络
  - [ ] `clipboard_read()` / `clipboard_write(text)` — 剪贴板
- [ ] 将 tools 注册为 AI function calling schema
- [ ] 实现确认机制：中/高风险操作 → 前端弹确认框 → 用户确认 → 执行
- [ ] 执行结果返回给 AI，AI 生成完成消息
- [ ] 角色表情：执行中 → working 动画，完成 → happy 动画

交付物：Niromi 能帮你整理文件、打开 app、查系统信息。

### Phase 3: 能记住（Week 3）

**目标**：Niromi 记住你的偏好，跨对话保持连续性。

任务：
- [ ] 用 tauri-plugin-sql 实现 SQLite memory store
  - [ ] `save_fact(key, value, confidence)`
  - [ ] `get_facts(limit)` → top facts
  - [ ] `save_conversation(summary, messages)`
  - [ ] `get_recent_conversations(n)` → summaries
- [ ] 对话结束时自动触发事实提取（用 AI 自身）
- [ ] 每次对话开始注入用户画像到 system prompt
- [ ] 前端 Memory Viewer：查看 Niromi 记住了什么，可删除
- [ ] 设置界面："清除所有记忆" 按钮

交付物：Niromi 记住你的名字、偏好、使用习惯。

### Phase 4: 能设置（Week 3-4）

**目标**：多模型支持 + 设置界面 + 首次运行引导。

任务：
- [ ] TypeScript 端实现多 AI provider（OpenAI, DeepSeek, Ollama）
- [ ] 首次运行 Onboarding 流程（选服务 → 填 key → 测试连接 → 完成）
- [ ] 设置面板：API key、模型选择、语言、开机自启
- [ ] 托盘图标 + 右键菜单
- [ ] 应用自动更新检查
- [ ] 中英文 UI 切换

交付物：完整可用的 MVP。可以发布 v0.1.0。

### Phase 5: 能说话（Week 5-6）

**目标**：语音交互。

任务：
- [ ] Web Speech API 实现 STT（免费，浏览器原生）
- [ ] 系统 TTS 实现语音输出
- [ ] Push-to-talk 快捷键（全局热键）
- [ ] 说话时角色嘴巴动画
- [ ] 可选：OpenAI TTS 更自然的声音

### Phase 6: 能感知（Week 7-8）

**目标**：屏幕感知 + 快捷操作。

任务：
- [ ] Accessibility API 读当前窗口标题
- [ ] 注入活动窗口信息到 context
- [ ] 快捷操作面板（右键菜单）
- [ ] 预设操作："整理桌面"、"清理下载"、"今日摘要"
- [ ] 自定义快捷操作

### Phase 7: 能生长（Week 9-10）

**目标**：角色系统 + 社区生态。

任务：
- [ ] 角色包加载器（读取 JSON + sprite sheet）
- [ ] 3-5 个内置角色
- [ ] 角色商店 UI（展示社区角色）
- [ ] MCP client 支持
- [ ] Workflow / routine 编辑器

---

## 8. 发布策略

### v0.1.0 — "它活了"（Week 4）

- 基础角色 + 对话 + 文件操作 + 记忆
- macOS + Windows
- GitHub 发布 + 官网（单页）
- 写一篇推文/抖音："我做了一个能帮你整理文件的桌面宠物"
- 目标：500 GitHub stars

### v0.2.0 — "它会说话"（Week 6）

- 语音交互
- 多模型支持
- 屏幕感知（轻量版）
- 快捷操作
- Product Hunt 发布
- 目标：2000 stars

### v0.3.0 — "它有朋友"（Week 10）

- 角色系统
- 社区角色包
- MCP 支持
- Workflow
- 中文社区推广（知乎、微信公众号、B站/抖音）
- 目标：5000 stars

---

## 9. 商业路径

**开源核心（MIT）**
- 角色 + 对话 + 文件操作 + 记忆 + 语音 = 全部免费开源

**Niromi Pro（$5/月 或 ¥29/月）**
- 高级角色包
- 自定义声音
- Workflow 自动化
- Cloud 记忆同步（跨设备）
- 优先支持

**角色商店（30% 抽成）**
- 社区创作者上传角色包
- 免费 + 付费角色
- 创作者分成 70%

**API 代理（中国市场）**
- 帮不会注册 API key 的用户代理调用
- 预充值模式：充 50 元 ≈ 使用 1 个月
- 通过 Abysen AI 运营

---

## 10. 传播策略

**抖音/B站（中国）**
- "我的 AI 桌宠帮我自动整理桌面" — 录屏 + 可爱角色 = 传播力
- "给你的电脑养一只 AI 宠物" — 二次元/可爱向用户
- 你本身在抖音活跃，自有渠道

**Twitter/Reddit（国际）**
- "I made an AI desktop pet that actually controls your computer"
- r/sideproject, r/ArtificialIntelligence, r/macapps
- Indie hacker 社区

**Product Hunt**
- 标题："Niromi — Your AI desktop pet that actually does things"
- 标签：AI, Desktop, Open Source, Productivity

**自然传播**
- 用户跑 Niromi → Niromi 帮了忙 → 用户截图分享 → 别人好奇下载
- 可爱角色天然适合截图传播
- 比任何 CLI 工具传播性强 10 倍

---

## 11. 跟 CogMem 的关系

CogMem 不需要放弃。它可以作为 Niromi 的内部记忆模块进化：

v0.1：简单 SQLite 记忆（key-value facts）
v0.3：接入 CogMem 作为更智能的记忆引擎
v1.0：CogMem 的 RPE + trust gating 作为 Niromi 的"性格成长"机制

论文路径也不冲突：
- Niromi 收集的真实用户交互数据 → CogMem 的实验数据
- "How Users Interact with Embodied Desktop AI Companions" → CHI / UIST
- "Adaptive Memory and Trust in Personal AI Agents" → AAMAS（用 Niromi 数据验证 CogMem）

Niromi 是产品面。CogMem 是研究面。共用同一个底层。

---

## 12. 风险和应对

| 风险 | 概率 | 应对 |
|------|------|------|
| 大模型公司出了类似产品 | 30% | 他们不会做"可爱桌宠"、不会开源、不会做中文优先。定位差异化足够。|
| Agent 能力不够稳定 | 40% | MVP 只做文件操作（最稳定的能力），不做 computer use。管理预期。|
| 用户觉得是玩具不是工具 | 25% | 第一次交互就让用户完成一个真实任务（整理文件）。用实用性证明自己。|
| 美术资源不够好 | 50% | 初版用极简 pixel art（一个人能画）。社区角色系统让用户创作。|
| 跨平台兼容性问题 | 35% | 先做 macOS（你的主力环境），Windows 作为第二优先。|

---

## 13. 技术要点提醒（给 Claude Code）

**Tauri 透明窗口配置**
```json
// tauri.conf.json
{
  "app": {
    "windows": [
      {
        "label": "character",
        "title": "Niromi",
        "width": 200,
        "height": 200,
        "transparent": true,
        "decorations": false,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "resizable": false
      },
      {
        "label": "chat",
        "title": "Niromi Chat",
        "width": 380,
        "height": 500,
        "transparent": true,
        "decorations": false,
        "visible": false
      }
    ]
  }
}
```

**双窗口架构**
- character 窗口：始终显示，透明背景，只有角色
- chat 窗口：点击角色时显示，在角色旁边弹出
- 两个窗口通过 Tauri event system 通信

**穿透点击**
- character 窗口的非角色区域需要 click-through
- Tauri v2 支持 `set_ignore_cursor_events(true/false)`
- 角色区域响应点击，背景区域穿透

**流式 AI 响应**
```typescript
// 前端：处理 SSE 流
const stream = await invoke('stream_chat', { messages });
for await (const chunk of stream) {
  // 逐字添加到消息
  appendToMessage(chunk.text);
  // 如果有 tool call，切换角色状态
  if (chunk.tool_call) {
    setCharacterState('working');
  }
}
```

**Tool calling 流程**
```
用户消息 → AI 决定调用 tool → 
  如果低风险 → 直接执行 → 返回结果给 AI → AI 回复用户
  如果中/高风险 → 前端弹确认框 → 
    用户确认 → 执行 → 返回结果给 AI → AI 回复
    用户拒绝 → 告诉 AI 用户拒绝了 → AI 换个方式回复
```

---

## 14. 执行顺序（给 Claude Code）

```
Phase 1 (Week 1):
  1. npx create-tauri-app niromi (React + TS + Vite)
  2. 配置双窗口 (character + chat)
  3. Character 组件 + sprite 动画
  4. Chat 组件 + 消息列表 + 输入框
  5. Claude API 集成 + 流式输出
  6. 角色表情状态机
  → 测试：能聊天，角色会动

Phase 2 (Week 2):
  1. TypeScript tools 实现 (用 Tauri plugins: fs, shell, clipboard, sql)
  2. Tool calling schema 注册
  3. 确认机制 (ConfirmDialog 组件)
  4. 工具执行 + 结果反馈
  → 测试：能整理文件，能打开 app

Phase 3 (Week 3):
  1. SQLite memory store
  2. 事实提取 (对话结束时)
  3. 用户画像注入 system prompt
  4. Memory Viewer 组件
  → 测试：重启后 Niromi 还记得你

Phase 4 (Week 3-4):
  1. 多 provider 支持
  2. Onboarding 流程
  3. 设置面板
  4. 托盘图标
  5. 打包测试 (.dmg / .exe)
  → 发布 v0.1.0

每个 Phase 结束后：
  - 在真实 macOS / Windows 上测试
  - 修复跨平台问题
  - 录一段使用视频
```

---

## 15. 名字备选

Niromi（みる）— 日语"看"的意思。一个会看你屏幕、观察你的习惯、帮你做事的小生物。名字本身就是产品的核心功能。源自创作者 ID Midori（みどり/绿），只差一个音。
---

# Niromi 方案修正：Skills + 听话模式 + 轻量 Computer Use

## 16. 核心修正：Skills + 听话模式 + 轻量 Computer Use

以下三个修正是 Niromi 与 OpenClaw 的本质区别。

### 修正 1：Skill 系统

### 设计理念

OpenClaw 的 skill 是"agent 自己决定什么时候用"。
Niromi 的 skill 是"你告诉它用，它才用"。

区别：
```
OpenClaw:  用户说"帮我做个视频" → agent 自己决定调哪些 skill → 自动执行
Niromi:      用户说"用 yt-dlp skill 下载这个链接" → Niromi 执行这一步 → 汇报结果
```

Niromi 的 skill 更像是"你教它用的工具"，不是"它自己发现的能力"。

### Skill 格式

兼容 OpenClaw SKILL.md 格式（借生态），但 Niromi 的执行方式不同。

```
~/.niromi/skills/
├── youtube-dl/
│   ├── SKILL.md          # 描述、参数、使用方法
│   └── run.sh            # 实际执行脚本
├── screenshot-ocr/
│   ├── SKILL.md
│   └── run.py
└── email-summary/
    ├── SKILL.md
    └── run.js
```

SKILL.md 示例：
```markdown
---
name: youtube-dl
description: 下载 YouTube 视频
author: community
parameters:
  - name: url
    type: string
    description: YouTube 视频链接
  - name: format
    type: string
    default: "mp4"
    description: 输出格式
risk_level: low
requires: ["yt-dlp"]
---

# YouTube 下载

下载指定的 YouTube 视频到本地。

## 使用方式
告诉 Niromi："下载这个 YouTube 视频 [链接]"
```

### Skill 安装

```
用户："安装 youtube-dl skill"

Niromi：
┌──────────────────────────────────────────┐
│ 找到 youtube-dl skill                    │
│ 作者：community ⭐ 4.2 (328 次安装)     │
│ 能力：下载 YouTube 视频                  │
│ 风险：低（只写入下载文件夹）             │
│ 需要：yt-dlp (会自动安装)               │
│                                          │
│ [安装] [查看源码] [取消]                 │
└──────────────────────────────────────────┘
```

关键：安装时展示 skill 的权限和风险等级。用户明确同意才装。

### Skill 执行流程

```
用户："帮我下载这个视频 https://youtube.com/xxx"

Niromi 的思考（内部，不展示给用户）：
  1. 识别用户意图：下载视频
  2. 匹配已安装 skill：youtube-dl
  3. 提取参数：url = "https://youtube.com/xxx"

Niromi 展示给用户：
┌──────────────────────────────────────────┐
│ 我用 youtube-dl 下载这个视频？           │
│ 链接：https://youtube.com/xxx            │
│ 格式：mp4                                │
│ 保存到：~/Downloads/                     │
│                                          │
│ [下载] [换格式] [取消]                   │
└──────────────────────────────────────────┘

用户点「下载」→ Niromi 执行 → 角色播放 working 动画
完成 → "下载好了！视频在 Downloads 文件夹里 ✨"
```

### Skill Store（P2 阶段）

- 内置 10 个常用 skill（文件整理、剪贴板管理、系统清理等）
- 社区 skill 仓库（GitHub repo 或简单的 registry）
- 安装前自动扫描（基础安全检查）
- 与 OpenClaw skill 格式部分兼容（可以装 OpenClaw 的 skill，但执行方式不同）

---

## 修正 2：听话模式（核心交互范式）

### 三种交互模式

**模式 A：对话模式（默认）**
最基础。你跟 Niromi 说话，它理解意图，用已有工具或 skill 执行。

```
你："帮我把桌面上的 PDF 都移到文档文件夹"
Niromi：展示计划 → 你确认 → 执行
```

**模式 B：指挥模式**
你一步步告诉它做什么，它一步步执行。不需要 Niromi 自己做 planning。

```
你："打开 Finder"
Niromi：打开了 ✓
你："进入 Downloads 文件夹"
Niromi：进入了 ✓
你："把所有 .zip 文件删掉"
Niromi：找到 12 个 .zip 文件，确认删除？
你："删"
Niromi：删除了 ✓
```

这个模式下 Niromi 就是你的手。你说动它动，你不说它不动。
token 消耗极低——每一步只需要一次短 API 调用，不需要多轮 planning。

**模式 C：看着做模式（Computer Use）**
你让 Niromi 看你的屏幕，你告诉它在哪里点、在哪里输入。

```
你："看一下我的屏幕"
Niromi：[截一张图] "我看到了，你在用 Excel"
你："帮我点第三行第二列那个单元格"
Niromi：[点击] 点了 ✓
你："输入 2500"
Niromi：[输入] 好了 ✓
```

### 模式切换

不需要手动切换。Niromi 根据你说话的方式自动判断：

- "帮我整理桌面" → 对话模式（Niromi 自己规划怎么整理）
- "打开 Chrome" → 指挥模式（直接执行单步指令）
- "看看我的屏幕，帮我点那个按钮" → 看着做模式

判断逻辑很简单：
- 如果用户的指令是具体的单步操作 → 指挥模式，直接做
- 如果用户的指令是模糊的目标 → 对话模式，先规划再确认
- 如果用户提到"屏幕""看""点击" → 看着做模式

### 为什么这比 OpenClaw 省 token

OpenClaw 的 agent loop：
```
用户消息 → LLM planning（烧 token）
→ 选择 tool → 执行 → 结果送回 LLM（烧 token）
→ LLM 判断要不要继续（烧 token）
→ 可能再选 tool → 再执行 → 再送回（烧 token）
→ ... 可能循环 5-10 次
→ 最终回复

一个简单任务：5-10 次 API 调用，每次携带完整上下文
= 几千到几万 token
```

Niromi 指挥模式：
```
用户："打开 Chrome"
→ 1 次 API 调用（极短 prompt："用户说打开 Chrome，调用 open_app 工具"）
→ 执行
→ 回复"打开了"

= 几百 token
```

Niromi 对话模式（需要规划时）：
```
用户："整理桌面"
→ 1 次 API 调用（规划：列出桌面文件 + 分类方案）
→ 展示计划，等用户确认
→ 确认后批量执行（本地 TypeScript 代码调 Tauri API，不调 LLM）
→ 1 次 API 调用（生成完成消息）

= 2 次 API 调用 = 几千 token
```

OpenClaw 同样的任务需要 5-10 次调用。Niromi 最多 2-3 次。

### Token 预算系统

在设置里让用户选 token 使用等级：

```
┌──────────────────────────────────────┐
│ Token 使用偏好                       │
│                                      │
│ ○ 极省（每天 < 2000 token）         │
│   Niromi 只在你明确要求时才调用 AI     │
│   简单操作直接用本地规则执行         │
│                                      │
│ ● 均衡（每天 < 10000 token）(默认)  │
│   Niromi 会帮你规划，但不会过度思考   │
│                                      │
│ ○ 智能（不限制）                    │
│   Niromi 更主动、更聪明，但消耗更多   │
│                                      │
│ 预估每日费用：~$0.03                │
└──────────────────────────────────────┘
```

极省模式下的优化：
- 单步指令（"打开 Chrome"）→ 不调 API，本地正则匹配 + 直接执行
- 文件操作指令 → 本地解析关键词 + 直接执行
- 只有复杂/模糊指令才调 API

这意味着很多操作零 token 消耗。

---

## 修正 3：轻量 Computer Use

### 问题

Claude Computer Use 的标准流程：
```
每一步：截全屏（1920×1080）→ 发给 API → 等返回动作 → 执行 → 再截图
每次截图 = ~800 tokens（图片编码后）
一个 10 步操作 = 8000+ tokens 光图片就够了
加上对话上下文 = 15000-20000 tokens
≈ $0.05-0.15 per task
```

### 解决方案：分层视觉

```
Layer 0: 零视觉（免费）
├── Accessibility API 读窗口标题
├── 知道当前 app 是什么
├── 适合：指挥模式的大部分操作
└── Token 消耗：0

Layer 1: 轻视觉（便宜）
├── 只在用户说"看一下"时截图
├── 截图压缩到 640×360（不是全屏）
├── ~200 tokens per screenshot
├── 适合：偶尔需要看屏幕的操作
└── Token 消耗：每次 200-400

Layer 2: 区域视觉（适中）
├── 只截取活动窗口，不是全屏
├── 裁剪到相关区域
├── ~300-500 tokens per capture
├── 适合：在特定 app 里操作
└── Token 消耗：每次 300-600

Layer 3: 全屏视觉（贵，可选）
├── 标准 Computer Use 流程
├── 全屏截图 + 完整坐标推理
├── 适合：复杂多步骤 GUI 操作
└── Token 消耗：每步 800+
```

### 默认行为

```
用户说话 → Niromi 判断需要哪一层：

"打开 Chrome"
→ Layer 0：不需要看屏幕，直接 shell 调用
→ 0 tokens 视觉消耗

"我的屏幕上显示了什么错误？"
→ Layer 1：截一张压缩图
→ ~200 tokens

"帮我点击 Excel 里面第三行的那个按钮"
→ Layer 2：截取 Excel 窗口区域
→ ~400 tokens

"帮我在 Photoshop 里把这个图的背景换成白色"
→ Layer 3：全屏视觉 + 多步操作
→ 用户会看到费用提示
```

### 实现

**Layer 0**（P0，MVP 就做）：
```rust
// macOS: AXUIElement API
fn get_active_window_info() -> WindowInfo {
    // 返回：app name, window title, window bounds
}

// Windows: UIAutomation API  
fn get_active_window_info() -> WindowInfo {
    // 同上
}
```

**Layer 1-2**（P1）：
```rust
fn capture_screen(region: Option<Rect>) -> Vec<u8> {
    // macOS: CGWindowListCreateImage
    // Windows: BitBlt / DXGI
    
    let screenshot = take_screenshot(region);
    
    // 压缩：缩放到 640px 宽 + JPEG quality 60
    let compressed = resize_and_compress(screenshot, 640, 60);
    
    compressed  // ~30-50KB，约 200-400 tokens
}
```

**Layer 3**（P2，可选开启）：
```rust
fn computer_use_step(instruction: &str) -> Action {
    let screenshot = capture_screen(None);  // 全屏
    
    // 发给 AI，获取动作指令
    let action = ai.analyze_screen(screenshot, instruction);
    
    // 执行：鼠标移动/点击/键盘输入
    match action {
        Action::Click(x, y) => simulate_click(x, y),
        Action::Type(text) => simulate_typing(text),
        Action::Scroll(direction) => simulate_scroll(direction),
        Action::KeyPress(key) => simulate_keypress(key),
    }
}
```

鼠标/键盘模拟：
- macOS: CGEvent API（原生，不需要额外权限）
- Windows: SendInput API
- 跨平台封装在 Rust 薄壳的 Tauri IPC command 里，TypeScript 端统一调用

### 费用透明

Niromi 在需要使用视觉时告诉用户：

```
你："帮我看看这个 Excel 表格有什么问题"

Niromi：
┌──────────────────────────────────────┐
│ 我需要看一下你的屏幕才能帮你。      │
│ 这会使用大约 400 tokens              │
│ （约 $0.002）                        │
│                                      │
│ [看吧] [算了，我描述给你]            │
└──────────────────────────────────────┘
```

用户随时有选择权：让 Niromi 看屏幕（花 token），或者自己用文字描述（免费）。

---

## 修正后的能力矩阵

```
┌─────────────────────────────────────────────────────────┐
│                  Niromi 能力矩阵                           │
│                                                          │
│  免费（零 token）         需要 AI（花 token）            │
│  ──────────────          ─────────────────              │
│  打开/关闭 App           理解模糊指令                    │
│  文件移动/重命名          规划多步操作                    │
│  创建文件夹              分析屏幕内容                    │
│  读取剪贴板              生成文本/回复                   │
│  设定提醒                提取记忆                        │
│  显示系统信息            对话聊天                        │
│  执行已知 shell 命令     理解新 skill 的用法             │
│  读取窗口标题            Computer Use                    │
│                                                          │
│  这些用本地规则匹配：     这些必须调 API：               │
│  "打开 Chrome" → 直接做   "帮我整理桌面" → 需要规划      │
│  "删除 xxx" → 确认后做    "这个表格对不对" → 需要视觉    │
│  "复制这段" → 直接做      "写封邮件给老板" → 需要生成    │
└─────────────────────────────────────────────────────────┘
```

这个设计的核心理念：**能不调 API 就不调。** 
简单指令本地处理，复杂指令才用 AI。
这是跟 OpenClaw 最大的区别——OpenClaw 每一句话都要过 LLM。

---

## 修正后的 Phase 调整

原 Phase 不变，增加以下内容：

**Phase 2 增加**：
- [ ] 本地指令解析器（正则 + 关键词匹配）
  - 识别简单指令（"打开 X"、"删除 X"、"移动 X 到 Y"）
  - 直接映射到 tool 调用，不经过 AI
  - 复杂/模糊指令才走 AI
- [ ] Token 计数器（跟踪每次对话的 token 消耗）
- [ ] 费用显示（设置页面里的日/月消耗统计）

**Phase 4 增加**：
- [ ] Skill 加载器（读取 ~/.niromi/skills/ 下的 SKILL.md）
- [ ] Skill 安装命令（从 Git repo 或 URL 安装）
- [ ] 10 个内置 skill
- [ ] Token 预算设置（极省/均衡/智能）

**Phase 6 修改**（原来只有轻量屏幕感知，现在扩展）：
- [ ] Layer 0: Accessibility API 窗口标题（已有）
- [ ] Layer 1: 压缩截图 + AI 分析
- [ ] Layer 2: 区域截图（活动窗口）
- [ ] 鼠标/键盘模拟（CGEvent / SendInput）
- [ ] 自动选择视觉层级
- [ ] 费用提示弹窗

**新增 Phase（与 Phase 7 合并或之后）**：
- [ ] Skill Store UI
- [ ] 社区 skill 浏览/安装/评分
- [ ] Skill 安全扫描（基础版）

---

## 与 OpenClaw 的定位对比（最终版）

```
                    OpenClaw              Niromi
目标用户            开发者/极客           所有人
安装方式            命令行 + 配置         双击安装 + 填 key
交互方式            消息平台(WhatsApp等)   桌面角色 + 对话
决策权              Agent 自主决策        用户指挥为主
权限模型            给完权限随便跑        每步确认或指挥
Skill 执行          Agent 自动选择调用    用户指定使用
视觉能力            无（纯 API/shell）    分层（0-3 级按需）
Token 消耗          高（每句话过 LLM）    低（简单操作零消耗）
记忆                对话历史             结构化事实 + 画像
外观                无（终端/聊天窗口）   可爱角色 + 动画
中文支持            社区适配              原生优先
价格感知            用户自己算            内置费用显示
```

一句话总结区别：

**OpenClaw 是一个自主的 AI agent，你设定目标它自己干。
Niromi 是一个听话的 AI 伙伴，你指挥它它帮你干。**

两者不是竞争关系。OpenClaw 面向想要全自动的 power user，Niromi 面向想要可控的普通人。

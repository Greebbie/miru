# Miru (みる) — AI Desktop Companion

## 项目定位

Miru 是一个桌面 AI 伙伴。住在屏幕角落，记得住你的习惯，能帮你操作电脑，会跟你说话。**不是开发者工具，是所有人的伙伴。**

> "OpenClaw 的能力，桌宠的体验，普通人的门槛。"

双击安装 + 填 API key，3 分钟能用。

## Miru vs OpenClaw — 核心区别

这不是竞品，是完全不同的东西。开发时必须时刻记住这些区别：

```
                    OpenClaw              Miru
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

**一句话总结：OpenClaw 是自主 AI agent，你设定目标它自己干。Miru 是听话的 AI 伙伴，你指挥它它帮你干。**

### 三种交互模式（自动切换，不需用户手动选）

1. **对话模式**：模糊目标 → Miru 规划 → 用户确认 → 执行（最多 2-3 次 API 调用）
2. **指挥模式**：用户一步步说，Miru 一步步做，不自作主张（极短 API 调用或零 token）
3. **看着做模式**：用户让 Miru 看屏幕，指哪打哪（分层视觉按需消耗）

### 委托值守模式

Miru 可以被"委托"在用户不在时管理电脑，但**核心原则不变：用户主动授权 + 预先交代怎么做，Miru 不自作主张。**

典型场景：
- "我去睡了，帮我盯着这个代码跑完，跑完截个图告诉我结果"
- "我不在的时候如果微信有人找我，就回复说我在忙稍后回复"
- "帮我盯着 Claude CLI 跑这个任务，如果报错了先暂停，等我回来"
- "每 10 分钟看一下这个网页有没有更新，有的话通知我"

和 OpenClaw 的区别：
- **OpenClaw**：给个目标就自己跑，agent 自主决定所有步骤
- **Miru**：用户必须先说清楚"遇到什么情况做什么"，Miru 按规则执行。没预料到的情况 → 暂停等用户回来，不自己瞎搞

实现方式：用户通过对话或管理面板创建监控规则 + 自动回复规则，本质是"把指挥模式的指令预先录好"，不是给 agent 自主权。

### Token 效率是核心竞争力

**能不调 API 就不调。** 这是跟 OpenClaw 最大的区别 — OpenClaw 每句话都过 LLM。
- 简单指令（"打开 Chrome"）→ 本地正则匹配，零 token
- 文件操作 → 本地解析关键词直接执行
- 典型交互 ~1000 tokens (~$0.003)，月均 ~$2.70
- OpenClaw 日均 ~200k tokens (~$6/天)，Miru 效率 6-7 倍

### Skill 系统

兼容 OpenClaw SKILL.md 格式（借生态），但执行方式不同：
- OpenClaw：agent 自动选择调用
- Miru：用户指定使用，展示计划等确认后才执行
- Skill 是"你教它用的工具"，不是"它自己发现的能力"

### 分层视觉（0-3 级）

- **Layer 0**: 零视觉 — 读窗口标题（Accessibility API），0 token
- **Layer 0.5**: 本地 OCR — 用 Tesseract 提取屏幕文字（类似 OpenClaw 的文字提取方式），不调 Vision API，token 消耗极低/零
- **Layer 1**: 轻视觉 — 压缩截图 640x360 发 AI，~200 tokens，用户说"看一下"才触发
- **Layer 2**: 区域视觉 — 只截活动窗口，~400 tokens
- **Layer 3**: 全屏 Computer Use — 完整截图 + 坐标推理，~800+ tokens/步，可选开启

费用透明：视觉操作前告知用户 token 消耗，用户可选择文字描述代替截图。

### 价格感知内建

- 内置 token 预算系统（极省/均衡/智能）
- 内置费用显示（日/月消耗）
- 不像 OpenClaw 让用户自己算

## 技术栈

- **Electron** (主进程只做 OS 原生 API) + **TypeScript** (全部业务逻辑)
- **React + Vite** | **Zustand** (状态) | **Framer Motion** (动画) | **TailwindCSS**
- **CSS-based** 角色渲染 (img + transform + animation)
- **better-sqlite3** 本地记忆 (FTS5 全文搜索)
- **YOLO + Tesseract** 本地视觉 (worker_threads 隔离)
- AI: Claude / OpenAI / DeepSeek / Ollama / vLLM / Qwen / Minimax (统一 AIProvider 接口)

## 架构原则

- **TypeScript-first**: Electron 主进程只做 OS 原生 API，业务逻辑全 TS
- **Token 效率至上**: 简单命令本地正则解析（零 token），system prompt < 200 tokens，tool 描述 < 15 words
- **角色要"活"**: 情绪用 float 数值 + 衰减，不用 enum 硬切换。呼吸用 CSS，眼球跟踪用 transform
- **用户永远有控制权**: 低风险直接做，中风险展示计划确认，高风险明确警告
- **错误要人性化**: 永远不显示技术 error message，翻译为 Miru 的话

## 目录结构

- `electron/` — Electron 主进程 (IPC: 窗口、系统、视觉、记忆DB、监控、自动化)
- `src/core/ai/` — AI Provider 抽象 + 各实现 + SSE 流式解析
- `src/core/tools/` — Tool 注册表 + 权限检查 + 审计日志
- `src/core/parser/` — 本地命令解析器 (零 token 操作)
- `src/core/memory/` — SQLite 三层记忆 (identity/preferences/episodes) + FTS5 事实搜索
- `src/core/skills/` — Skill 注册/发现/执行 (兼容 OpenClaw SKILL.md)
- `src/components/Character/` — 角色渲染 + 情绪系统
- `src/components/Chat/` — 聊天 UI + 确认弹窗 + 费用显示 (CostBadge)
- `src/components/Admin/` — 管理面板 (工具权限、监控规则、自动回复、日志)
- `src/hooks/` — useAI (AI 交互), useMonitor (监控值守), useVoiceInput (STT)
- `src/core/tts.ts` — TTS 语音合成 (Web Speech API)
- `src/stores/` — Zustand stores (character, chat, config, admin, cost)

## 开发规范

- **中国大陆兼容是硬要求**：所有外部服务必须在中国大陆可访问。禁止使用 Google、DuckDuckGo、Twitter 等被墙服务。搜索用 Bing，DNS/CDN 选国内可达的。如果某个功能依赖外部服务，必须确认国内能用
- **Renderer 进程 CORS 问题**：某些 AI API（如 Minimax）不支持浏览器 CORS preflight，必须走主进程 IPC 代理（`proxy-fetch`/`proxy-stream`）。如果新增 AI provider 遇到 CORS 问题，走同样的 IPC 代理模式
- Tool 描述不超过 15 个 word
- Tool 结果必须有 `summary` 字段（压缩版，给 LLM 看）
- 错误消息翻译为 Miru 的话，永远不显示原始 error
- 所有路径用 `normalizePath()` 处理 Windows 反斜杠
- 情绪值 0-1 浮点，500ms 衰减周期 (×0.95)
- native 模块 (better-sqlite3, onnxruntime-node, sharp) 用 `createRequire` 兼容 ESM

## 常用命令

- `npm run dev` — 启动 Vite 开发服务器 + Electron
- `npm run build` — 构建生产版本
- `npm run package` — 打包安装包
- `npm test` — 运行 Vitest 单元测试
- `npx electron-rebuild -f -w better-sqlite3` — 重建 native 模块

## 关键接口

```ts
// AI Provider (src/core/ai/provider.ts)
interface AIProvider {
  streamChat(messages: Message[], tools?: ToolDef[]): AsyncIterable<StreamChunk>;
}

// Tool (src/core/tools/registry.ts)
interface ToolDefinition {
  name: string;
  description: string;  // MAX 15 words
  riskLevel: 'low' | 'medium' | 'high';
  execute: (params) => Promise<{ success, data, summary }>;
}

// Emotions (src/stores/characterStore.ts)
{ curiosity: 0-1, focus: 0-1, joy: 0-1, concern: 0-1 }
```

## 记忆系统

三层结构化记忆（不是对话历史）：
- **Identity** (~30 tokens): 名字、语言、位置、职业 — 几乎不变
- **Preferences** (~50 tokens): 常用工具、工作习惯 — 缓慢变化
- **Episodes** (~100 tokens): 最近操作摘要 — 只注入最近 3-5 条
- **Facts** (FTS5 搜索): 从对话中提取的事实，按用户消息关键词语义匹配注入

压缩格式注入：`[User] 绿酱 | lang:zh | editor:Cursor`，不是完整句子。总注入 < 200 tokens。

## Token 预算参考

- System prompt: ~45 tokens
- 用户画像注入: ~50 tokens
- 最近摘要: ~100 tokens
- Tool 定义 (10个): ~200 tokens
- 典型单次交互: ~1000 tokens total (~$0.003 Claude Sonnet)
- 月均 30 次/天: ~$2.70 (Claude Sonnet) / ~¥2 (DeepSeek) / ¥0 (Ollama)

## 开发进度

- Round 1-2: 基础框架 (Electron + React + Vite + TypeScript)
- Round 3-4: AI 对话 (7 provider + 流式 + 本地解析器 + tool 系统)
- Round 5-6: 角色 + 情绪 + 记忆 (CSS 动画 + SQLite + FTS5 + 事实提取)
- Round 7: 管理后台 (权限 + 监控规则 + 自动回复 + 审计日志)
- Round 8: 委托值守激活 + 费用显示 + TTS/STT
- Round 9: 代码清理 + UX 闭环 + 文档更新

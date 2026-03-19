# Niromi 优化层：六个视角的终极审视

本文档是 niromi-final-plan.md 的补充，不替代主文档，而是从六个专家视角优化关键细节。

---

## 视角 1：最强设计师 — 让 Niromi 活着

### 主文档的问题

角色只有 7 个表情状态，切换是硬编码的（AI 回复时 → thinking，执行时 → working）。这会让 Niromi 感觉像一个状态机，不像一个活物。

### 优化：微状态 + 呼吸感

```
核心原则：Niromi 在没有任何交互时也应该看起来"活着"。

idle 不是一个状态，而是一组微行为：
- 眨眼（随机间隔 3-8 秒）
- 偶尔歪头
- 偶尔打哈欠（如果 > 5 分钟没交互）
- 轻微的上下浮动（呼吸感，CSS animation，2s 周期）
- 偶尔看向鼠标方向（跟随鼠标，但有延迟和阻尼）

实现：不需要更多 sprite 帧。
呼吸 = CSS transform: translateY() 的 ease-in-out 循环
看向鼠标 = 眼睛部分（单独一个小 sprite）的 CSS transform: translate()
这两个效果零额外帧数，只用 CSS。
```

### 优化：情绪渐变而非跳变

```
不是：idle → 突然变成 thinking → 突然变成 happy
而是：idle → 缓慢过渡到 thinking（0.3s fade）→ 缓慢过渡到 happy

实现：
characterStore 里不存 enum state，存 emotion 数值：

{
  curiosity: 0.0 - 1.0,   // 好奇（收到新消息时升高）
  focus: 0.0 - 1.0,       // 专注（执行任务时升高）
  joy: 0.0 - 1.0,         // 开心（完成任务时升高）
  concern: 0.0 - 1.0,     // 担心（危险操作时升高）
}

sprite 选择基于最高 emotion 值。
数值在一段时间后缓慢衰减回 0（exponential decay）。
这样 Niromi 完成任务后会"开心一会儿"再慢慢回到平静，而不是瞬间切换。
```

### 优化：对话窗口的物理感

```
对话窗口不是"弹出"，而是从 Niromi 身体里"长出来"：
- 点击 Niromi → 气泡从 Niromi 头顶冒出，先小后大（spring animation）
- 关闭 → 气泡缩回 Niromi 身体里
- Framer Motion 的 spring physics: stiffness=300, damping=20

消息不是"出现"，而是"浮上来"：
- 新消息从底部滑入 + fade in，duration=200ms
- AI 打字中 → Niromi 的表情是 thinking + 气泡里有三个跳动的点

确认弹窗不是模态框，而是 Niromi 举着的卡片：
- 确认内容显示为 Niromi 身边的小卡片
- 按钮在卡片上
- 视觉上像 Niromi 在"展示给你看"
```

### 优化：声音设计（微小但关键）

```
可选的 UI 音效（默认开启，可关闭）：
- 点击 Niromi：软软的 "po" 声（像按到棉花糖）
- 收到回复：轻微的叮声
- 完成任务：清脆的 ✨ 音效
- 危险操作确认：略低沉的提示音

音效文件总计 < 100KB（8bit 风格，与 pixel art 一致）

不要用任何系统默认通知声。Niromi 有自己的声音。
```

---

## 视角 2：最强 UX — 零摩擦

### 优化：Onboarding 的每一步都要有即时反馈

```
当前 plan 的 onboarding：选服务 → 填 key → 开始

优化后：

Step 1: "你好！我是 Niromi 🌿"
  只有一个按钮：[认识一下]
  （不要一上来就要 API key）

Step 2: Niromi 做自我介绍（动画 + 文字）
  "我可以帮你整理文件、打开 app、记住你的习惯。
   不过我需要一把钥匙才能思考。"
  [给你钥匙]

Step 3: 选 AI 服务
  大卡片选择（不是 radio button）：
  ┌─────────────┐ ┌─────────────┐
  │  Claude ⭐   │ │  OpenAI      │
  │  推荐，最聪明 │ │  也很好      │
  └─────────────┘ └─────────────┘
  ┌─────────────┐ ┌─────────────┐
  │  DeepSeek    │ │  Ollama 🏠   │
  │  便宜好用    │ │  免费本地    │
  └─────────────┘ └─────────────┘

Step 4: 填 API key
  输入框下方有动态图文教程：
  "① 打开 console.anthropic.com
   ② 点击 API Keys
   ③ 创建新 key
   ④ 复制粘贴到这里"
  [我填好了，试试连接]

Step 5: 连接测试（关键！）
  Niromi 试着调 API → 
  成功：Niromi 跳起来 "太好了，我能思考了！"
  失败：Niromi 歪头 "好像连不上...key 对吗？"
  不是冷冰冰的 error message，是 Niromi 的反应。

Step 6: 第一个任务引导
  "试着跟我说点什么吧！比如..."
  下面有 3 个可点击的示例：
  💬 "帮我整理桌面"
  💬 "你能做什么？"
  💬 "你好，我叫..."
  
  用户说完第一句 → Niromi 执行 → 完成 → 
  "🎉 我们配合得不错！以后随时叫我。"
  引导结束。
```

### 优化：Niromi 在你不说话时也存在

```
不交互时的 Niromi 行为（所有都是可选的，在设置里控制）：

空闲 1 分钟后：
  Niromi 偶尔看一眼你的活动窗口标题，但不说话
  （只是眼睛方向变化，暗示它在关注你）

空闲 5 分钟后：
  Niromi 开始"打盹"（sleeping 动画）

空闲 30 分钟后：
  Niromi 可以冒出一个小气泡（不是弹窗，是角色旁的小文字）：
  "你已经看了 2 小时屏幕了...要不要休息一下？"
  （这个功能可开关，默认关闭）

用户切换到新 app 时：
  Niromi 眼睛跟着新窗口方向看一下
  （视觉暗示：它注意到了你在做什么）
```

### 优化：错误处理也是体验

```
API 调用失败 → 不是弹 error，是 Niromi 的表情变困惑 + 气泡说话
  "我没听清...网络好像不太好。再说一次？"

Token 不够 → Niromi 的表情变有点为难
  "我的能量快用完了（今天的 token 快到了）。
   要不先做这些，其他明天再说？"

操作失败（比如文件被占用）→ Niromi 歪头
  "没能移动这个文件...好像有其他程序在用它。
   要不要我等一下再试？"

永远不显示技术性 error message 给用户。
所有错误都翻译成 Niromi 的话。
技术详情藏在点击 "详情" 才展开的折叠区。
```

---

## 视角 3：最强 Token 经济学

### 每种交互的 Token 预算

```
交互类型                     Input tokens    Output tokens    总花费(Claude Sonnet)
─────────────────────────    ───────────     ─────────────    ──────────────────
简单指令 "打开Chrome"        ~300            ~50              ~$0.001
文件整理任务                 ~800            ~200             ~$0.004
带记忆的对话                 ~1000           ~300             ~$0.006
屏幕截图分析 (Layer 1)       ~1200           ~200             ~$0.005
每日记忆提取                 ~600            ~200             ~$0.004

对比 OpenClaw 同样任务：     ~5000-15000     ~1000-3000       ~$0.03-0.06
```

### System Prompt 压缩

```
当前 plan 的 system prompt 大约 400 tokens。优化到 200：

不要这样（啰嗦）：
  "You are Niromi, a helpful desktop companion. Your name means 'to see/watch'
   in Japanese. You see the user's screen, watch their habits..."

要这样（精炼）：
  "You are Niromi (みる), a desktop companion. Concise, warm, playful.
   Reply in user's language. Never say you're an AI."

把性格特征编码为几个关键词，不要用句子描述。
LLM 从几个关键词就能推断出完整的行为模式。

记忆注入也压缩：
不要：
  "The user's name is 绿酱. The user prefers Chinese language.
   The user frequently uses VSCode."
  
要：
  "[User] 绿酱 | lang:zh | editor:VSCode | skin:oily | location:武汉"

一行搞定，< 30 tokens。LLM 完全能理解这种压缩格式。
```

### Tool 描述压缩

```
不要这样：
{
  "name": "move_files",
  "description": "Move one or more files from their current location 
   to a new destination directory. Creates the destination directory 
   if it doesn't exist. Returns the list of files that were successfully moved."
  ...
}

要这样：
{
  "name": "move_files",
  "description": "Move files to dest dir. Creates dir if needed.",
  ...
}

每个 tool 描述控制在 10-15 个 word。
10 个 tools × 15 words = 150 words ≈ 200 tokens
而不是 10 tools × 50 words = 500 words ≈ 650 tokens

省 450 tokens / 每次调用。一天 50 次调用 = 省 22,500 tokens/天。
```

### 智能上下文窗口管理

```
不是简单的"保留最近 N 条消息"。

策略：
1. System prompt（固定）: ~200 tokens
2. 用户画像（固定）: ~50 tokens
3. 最近对话摘要（固定）: ~100 tokens
4. 当前对话历史（动态）: 目标 < 1500 tokens
5. Tool 定义（固定）: ~200 tokens

总计目标：< 2100 tokens input / 次调用

当对话历史超过 1500 tokens 时：
- 保留第一条消息（用户的初始意图）
- 保留最近 3 轮
- 中间的消息压缩为一句摘要
- 这个压缩在本地做（字符串截断 + 模板），不调 API

示例：
  原本 10 轮对话 = 3000 tokens
  压缩后：
  "[Earlier: user asked to organize desktop files. 
    Niromi moved 7 screenshots to 截图/ folder.]
   User: 还有别的要整理的吗？
   Niromi: 我看到 Downloads 里有 23 个旧文件...
   User: 那些也整理一下"
  = 约 400 tokens
```

---

## 视角 4：最强记忆系统

### 主文档的问题

当前 memory 设计只有 facts 表（key-value）。这太扁平了，会丢失重要的时间和关联信息。

### 优化：三层记忆

```
Layer 1: Identity（身份信息，几乎不变）
  存储：名字、语言、位置、职业
  更新频率：极低
  注入方式：每次对话都注入
  Token 开销：~30

Layer 2: Preferences（偏好，缓慢变化）
  存储：喜欢的 app、常用文件夹、工作习惯、沟通风格偏好
  更新频率：每周可能更新几次
  注入方式：每次对话都注入
  Token 开销：~50

Layer 3: Episodes（事件记忆，快速增长）
  存储：最近做过的重要操作、对话摘要
  更新频率：每次对话后
  注入方式：只注入最近 3 条摘要
  Token 开销：~100
  保留策略：最近 100 条，超过的自动删除最旧的

总注入开销：~180 tokens / 次对话
```

### 优化：记忆提取 prompt

```
当前 plan 用一个通用 prompt 提取所有类型的事实。
优化为分类提取：

对话结束时的提取 prompt：

"From this conversation, extract ONLY:
1. identity: name, language, location, job (if mentioned)
2. preferences: tools, habits, likes/dislikes (if clearly stated)
3. episode: one-sentence summary of what was done

Format STRICTLY as JSON:
{"identity":{...},"preferences":{...},"episode":"..."}
Empty objects for categories with nothing new.
Do NOT guess. Only extract explicitly stated information."

这个 prompt ~80 tokens。
回复通常 < 100 tokens。
总提取开销 ~180 tokens / 次对话。

关键：不是每次对话都提取。
只有当对话 >= 3 轮时才触发提取。
1-2 轮的简短对话（如 "打开Chrome" → "好了"）不值得提取。
```

### 优化：记忆冲突处理

```
用户上周说"我用 VSCode"，今天说"我最近换了 Cursor"。

处理方式：
1. 新事实覆盖旧事实（不是并存）
2. 但保留历史记录供用户查看

SQLite 设计：
facts 表加 previous_value 和 updated_at 字段。

用户在 Memory Viewer 里能看到：
  编辑器: Cursor
  (之前: VSCode, 更新于 2026-03-17)

用户可以点击恢复旧值。
```

---

## 视角 5：最强个性配置

### 主文档的问题

当前没有任何个性化配置。所有用户的 Niromi 性格完全一样。

### 优化：性格滑块

```
设置 → Niromi 的性格

┌─────────────────────────────────────────┐
│ 说话风格                                │
│                                         │
│ 简洁 ●────────○──────── 话多            │
│                                         │
│ 正式 ──────●─────────── 可爱            │
│                                         │
│ 谨慎 ────────────●───── 主动            │
│                                         │
│ 语言: [中文 ▾]                          │
│                                         │
│ 称呼我: [绿酱___]                       │
└─────────────────────────────────────────┘

这三个滑块映射为 system prompt 的几个关键词：

简洁 = "ultra-concise, max 1-2 sentences"
话多 = "conversational, can elaborate"

正式 = "professional tone"
可爱 = "cute, uses emoticons occasionally, playful"

谨慎 = "always ask before acting, show detailed plans"
主动 = "execute low-risk tasks directly, suggest next steps"

实现：三个滑块值（0-100）→ 映射为 system prompt 里的 3 个短语
额外 token 开销：< 20 tokens
```

### 优化：称呼系统

```
Niromi 怎么称呼用户：
- 默认：不用称呼（直接说事）
- 如果用户在设置里填了名字：用名字
- 如果用户在对话里说了"叫我 XX"：自动更新

Niromi 怎么称呼自己：
- 默认：不自称（直接说"我"）
- 可选：用第三人称说"Niromi 来帮你看看"（日式可爱）
- 在设置里开关：[Niromi 用第三人称说话 ○]
```

### 优化：预设性格模板

```
对于不想自己调的用户，提供预设：

🤖 助手模式 — 简洁、正式、高效。像一个干练的秘书。
🐱 伙伴模式 — 平衡、亲切、偶尔可爱。（默认）
🌸 可爱模式 — 话多、可爱、用颜文字。像一个黏人的小动物。
⚡ 极简模式 — 极度简洁、只说必要信息。像 Unix 命令。

选择模板后，三个滑块自动调到对应位置。用户可以在此基础上微调。
```

---

## 视角 6：最强 AI Research — Tool Calling 策略

### 优化：Tool 分层注入

```
当前 plan：把所有 tool 定义都放在每次请求里。
10 个 tools = ~200 tokens。如果有 30 个 skills = ~600 tokens。每次都注入很浪费。

优化：两阶段 tool 调用

第一阶段（理解意图）：
  只注入 3 个元工具：
  - do_action: 执行一个已知操作（文件、app、shell 等）
  - use_skill: 调用一个已安装的 skill
  - just_chat: 纯聊天，不需要任何工具

  LLM 判断用户意图属于哪类：
  "帮我整理桌面" → do_action
  "用 yt-dlp 下载视频" → use_skill
  "今天天气怎么样" → just_chat

  Token 开销：~100（3 个元工具 + 用户消息）

第二阶段（执行）：
  只在需要时注入具体 tools。
  如果第一阶段返回 do_action → 注入文件/shell/app 相关 tools
  如果第一阶段返回 use_skill → 注入对应 skill 的参数定义
  如果第一阶段返回 just_chat → 不注入任何 tools

  Token 开销：按需，通常 ~50-100

总开销：~150-200 tokens
vs 全部注入：~600 tokens
省 60-70%。

权衡：增加了一次轻量 API 调用（第一阶段）。
但第一阶段的 input 极短（< 200 tokens），output 极短（< 30 tokens），
成本几乎可以忽略。

如果用户的消息明显是单步指令（检测到 tool 关键词如"打开""删除""移动"），
可以跳过第一阶段直接进第二阶段。
```

### 优化：Tool Calling 的结果压缩

```
Tool 执行返回的结果经常很长。
比如 list_files 返回 50 个文件名 = 很多 tokens。

优化：工具结果在注入 LLM 前先压缩。

files.ts 里的 list_files 返回原始数据。
注入 LLM 前，在 TypeScript 端先压缩：

原始：["Screenshot 2026-03-01.png", "Screenshot 2026-03-02.png", 
       "Screenshot 2026-03-03.png", ... 50 个]

压缩后："50 files found. Types: 32 .png, 12 .pdf, 6 .zip. 
        Sample: Screenshot 2026-03-01.png, ..."

这个压缩在本地做，不调 API。
让 LLM 只看摘要，不看全部列表。
需要具体操作时再取完整列表（在 TypeScript 端处理，不经过 LLM）。
```

### 优化：流式 Tool Calling 的用户体验

```
Claude 的 tool calling 是流式的：
  LLM 输出文字 → 突然输出 tool_use → 等待执行 → 再继续输出

在前端的表现应该是：

1. LLM 开始回复 → Niromi thinking 动画 + 文字逐字出现
2. LLM 发出 tool_use → 
   文字停止，Niromi 切换到 working 动画
   同时在对话里显示一个执行中的状态卡片：
   ┌──────────────────────┐
   │ 🔄 正在移动文件...    │
   │ ██████░░░░ 60%       │
   └──────────────────────┘
3. Tool 执行完成 → 
   状态卡片更新为完成：
   ┌──────────────────────┐
   │ ✅ 已移动 7 个文件    │
   └──────────────────────┘
   Niromi 切换到 happy 动画
4. LLM 继续输出总结文字

关键：用户永远能看到"Niromi 正在做什么"。
不是黑箱等待，而是实时反馈。
```

---

## 整合进 Plan 的具体改动清单

以下改动需要更新到 niromi-final-plan.md：

### Phase 1 增加
- [ ] 角色呼吸动画（CSS transform 循环）
- [ ] 角色眼睛跟随鼠标（带延迟阻尼）
- [ ] 情绪数值系统（替代 enum 状态）
- [ ] 对话窗口 spring 动画
- [ ] UI 音效（4 个 8bit 音效文件，< 100KB 总计）
- [ ] 优化后的 Onboarding（6 步引导，带连接测试）

### Phase 2 增加
- [ ] Tool 结果压缩（list_files 等返回值在注入前压缩）
- [ ] 流式 Tool Calling 的状态卡片 UI
- [ ] 错误消息翻译为 Niromi 的话（不显示技术 error）
- [ ] 两阶段 tool 调用（元工具 → 具体工具）

### Phase 3 修改
- [ ] 三层记忆替代单表（identity / preferences / episodes）
- [ ] 条件触发提取（>= 3 轮才提取）
- [ ] 记忆冲突处理（新值覆盖 + 保留历史）
- [ ] 压缩格式注入（"[User] 绿酱 | lang:zh" 而不是完整句子）

### Phase 4 增加
- [ ] 性格配置（三个滑块 + 四个预设模板）
- [ ] 称呼系统
- [ ] Token 使用统计面板（日/月消耗，按交互类型分类）

### System Prompt 替换为

```
You are Niromi (みる), desktop companion. {personality_keywords}
Reply in user's language. Never mention AI/LLM.

[User] {compressed_identity_and_preferences}

[Recent] {last_3_episode_summaries}

[Screen] {active_window_title}
```

总计：~150-200 tokens（vs 之前的 400）。

---

## 最终 Token 经济学

```
一次典型交互的 token 分解：

System prompt:          150 tokens
用户画像:               50 tokens  
最近摘要:              100 tokens
当前对话 (3轮):         400 tokens
Tool 定义 (按需):       100 tokens
用户消息:               50 tokens
────────────────────────────────
Input total:           ~850 tokens
Output:                ~150 tokens
────────────────────────────────
Total:                ~1000 tokens/次交互
Cost (Claude Sonnet):  ~$0.003

一天 30 次交互：
  ~30,000 tokens
  ~$0.09 ≈ ¥0.65

一个月：
  ~$2.70 ≈ ¥19.50

这是 Claude Sonnet 价格。
DeepSeek V3 约为 Claude 的 1/10 → ~¥2/月
Ollama 本地 → ¥0/月

对比 OpenClaw：
  每天 ~200,000 tokens（社区报告）
  ~$6/天 = ~$180/月

Niromi 的 token 效率是 OpenClaw 的约 6-7 倍。
```

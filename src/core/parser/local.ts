/**
 * Local command parser — zero token consumption for simple commands.
 * Matches simple Chinese/English patterns and returns tool/skill calls directly.
 */

export interface LocalMatch {
  tool?: string
  skill?: string
  params: Record<string, unknown>
  /** Direct response — no tool/skill needed, return this text immediately */
  directResponse?: string
}

interface Pattern {
  regex: RegExp
  tool?: string
  skill?: string
  extract: (match: RegExpMatchArray) => Record<string, unknown>
  /** If set, returns a direct response instead of a tool/skill call */
  direct?: (match: RegExpMatchArray) => string
  /** Additional validation — if returns false, skip this pattern */
  guard?: (match: RegExpMatchArray) => boolean
}

// Known local apps — only these get matched by the local parser.
// Anything else (websites, ambiguous names) falls through to the LLM.
const KNOWN_APPS = new Set([
  // Browsers
  'chrome', 'firefox', 'edge', 'safari', 'brave', 'opera', 'arc',
  // Dev tools
  'vs code', 'vscode', 'cursor', 'notepad', 'notepad++', 'sublime', 'terminal',
  'cmd', 'powershell', 'git bash', 'warp', 'iterm',
  // Office
  'word', 'excel', 'powerpoint', 'ppt', 'onenote', 'outlook', 'teams',
  'wps', '记事本',
  // Communication
  'wechat', '微信', 'qq', 'discord', 'slack', 'telegram', 'zoom', 'dingtalk', '钉钉',
  'feishu', '飞书',
  // Media
  'spotify', '网易云', '网易云音乐', 'vlc', 'potplayer',
  // Utilities
  'calculator', '计算器', 'explorer', '文件管理器', 'finder',
  'settings', '设置', 'control panel', '控制面板',
  'task manager', '任务管理器', 'snipping tool', '截图工具',
  // Games & others
  'steam', 'epic', 'obs', 'photoshop', 'figma', 'blender',
])

// Common website names → URLs (zero token, open directly in browser)
const KNOWN_WEBSITES: Record<string, string> = {
  'bilibili': 'https://www.bilibili.com',
  'b站': 'https://www.bilibili.com',
  'youtube': 'https://www.youtube.com',
  'twitter': 'https://twitter.com',
  'x': 'https://twitter.com',
  'github': 'https://github.com',
  'google': 'https://www.google.com',
  'baidu': 'https://www.baidu.com',
  '百度': 'https://www.baidu.com',
  'taobao': 'https://www.taobao.com',
  '淘宝': 'https://www.taobao.com',
  'jd': 'https://www.jd.com',
  '京东': 'https://www.jd.com',
  'zhihu': 'https://www.zhihu.com',
  '知乎': 'https://www.zhihu.com',
  'weibo': 'https://weibo.com',
  '微博': 'https://weibo.com',
  'douyin': 'https://www.douyin.com',
  '抖音': 'https://www.douyin.com',
  'xiaohongshu': 'https://www.xiaohongshu.com',
  '小红书': 'https://www.xiaohongshu.com',
  'netflix': 'https://www.netflix.com',
  'spotify': 'https://open.spotify.com',
  'reddit': 'https://www.reddit.com',
  'wikipedia': 'https://www.wikipedia.org',
  'chatgpt': 'https://chatgpt.com',
  'claude': 'https://claude.ai',
  'gmail': 'https://mail.google.com',
  'notion': 'https://www.notion.so',
  'figma': 'https://www.figma.com',
}

function isKnownApp(name: string): boolean {
  const lower = name.toLowerCase().trim()
  if (KNOWN_APPS.has(lower)) return true
  // Allow if it looks like a file path or has .exe
  if (/[/\\]|\.exe$/i.test(lower)) return true
  return false
}

/** Check if name is a website name or URL, return the full URL or null */
function resolveWebsite(name: string): string | null {
  const lower = name.toLowerCase().trim()
  // Known website name
  if (KNOWN_WEBSITES[lower]) return KNOWN_WEBSITES[lower]
  // Already a URL (has protocol or common TLD)
  if (/^https?:\/\//i.test(lower)) return lower
  if (/\.(com|org|net|io|dev|cn|co|me|app|ai|tv)$/i.test(lower)) return `https://${lower}`
  // Looks like a domain (word.word)
  if (/^[\w-]+\.\w{2,}$/.test(lower)) return `https://${lower}`
  return null
}

const patterns: Pattern[] = [
  // Open website — Chinese (detected before app matching)
  {
    regex: /^(?:打开|启动|运行|上|去|看)\s*(.+)$/i,
    tool: 'open_app',
    extract: (m) => {
      const url = resolveWebsite(m[1].trim())
      return { name: url! }
    },
    guard: (m) => resolveWebsite(m[1].trim()) !== null,
  },
  // Open website — English
  {
    regex: /^(?:open|launch|start|go to|visit)\s+(.+)$/i,
    tool: 'open_app',
    extract: (m) => {
      const url = resolveWebsite(m[1].trim())
      return { name: url! }
    },
    guard: (m) => resolveWebsite(m[1].trim()) !== null,
  },
  // Open app — Chinese (only known apps)
  {
    regex: /^(?:打开|启动|运行)\s*(.+)$/i,
    tool: 'open_app',
    extract: (m) => ({ name: m[1].trim() }),
    guard: (m) => isKnownApp(m[1]),
  },
  // Open app — English
  {
    regex: /^(?:open|launch|start|run)\s+(.+)$/i,
    tool: 'open_app',
    extract: (m) => ({ name: m[1].trim() }),
    guard: (m) => isKnownApp(m[1]),
  },
  // Delete — Chinese
  {
    regex: /^(?:删除|移除)\s*(.+)$/i,
    tool: 'delete_files',
    extract: (m) => ({ path: m[1].trim() }),
  },
  // Delete — English
  {
    regex: /^(?:delete|remove)\s+(.+)$/i,
    tool: 'delete_files',
    extract: (m) => ({ path: m[1].trim() }),
  },
  // Move — Chinese
  {
    regex: /^(?:移动|搬)\s*(.+?)\s*(?:到|至)\s*(.+)$/i,
    tool: 'move_files',
    extract: (m) => ({ from: m[1].trim(), to: m[2].trim() }),
  },
  // Move — English
  {
    regex: /^move\s+(.+?)\s+to\s+(.+)$/i,
    tool: 'move_files',
    extract: (m) => ({ from: m[1].trim(), to: m[2].trim() }),
  },
  // Copy — Chinese
  {
    regex: /^(?:复制|拷贝)\s*(.+?)\s*(?:到|至|to)\s*(.+)$/i,
    tool: 'copy_files',
    extract: (m) => ({ from: m[1].trim(), to: m[2].trim() }),
  },
  // Copy — English
  {
    regex: /^copy\s+(.+?)\s+to\s+(.+)$/i,
    tool: 'copy_files',
    extract: (m) => ({ from: m[1].trim(), to: m[2].trim() }),
  },
  // Create directory — Chinese
  {
    regex: /^(?:创建文件夹|新建文件夹|创建目录|新建目录)\s*(.+)$/i,
    tool: 'create_directory',
    extract: (m) => ({ path: m[1].trim() }),
  },
  // Create directory — English
  {
    regex: /^(?:mkdir|create folder|create directory|new folder)\s+(.+)$/i,
    tool: 'create_directory',
    extract: (m) => ({ path: m[1].trim() }),
  },
  // Write file — Chinese
  {
    regex: /^(?:写入|写)\s+(.+?)\s+(?:内容|content)\s+(.+)$/i,
    tool: 'write_file',
    extract: (m) => ({ path: m[1].trim(), content: m[2].trim() }),
  },
  // Write file — English
  {
    regex: /^write\s+(.+?)\s+content\s+(.+)$/i,
    tool: 'write_file',
    extract: (m) => ({ path: m[1].trim(), content: m[2].trim() }),
  },
  // List files — Chinese (path must contain / \ : or known directory words to avoid matching "查看天气")
  {
    regex: /^(?:列出|显示|查看)\s*(.+?)\s*(?:的文件|文件|下的|里的)$/i,
    tool: 'list_files',
    extract: (m) => ({ path: m[1].trim() }),
  },
  {
    regex: /^(?:列出|显示|查看)\s*(.+?)\s*$/i,
    tool: 'list_files',
    extract: (m) => ({ path: m[1].trim() }),
    // Only match if captured text looks like a path
    guard: (m) => /[/\\:]|桌面|下载|文档|Desktop|Downloads|Documents/.test(m[1]),
  },
  // List files — English
  {
    regex: /^(?:list|show|ls)\s+(?:files\s+(?:in|at)\s+)?(.+)$/i,
    tool: 'list_files',
    extract: (m) => ({ path: m[1].trim() }),
  },
  // System info
  {
    regex: /^(?:系统信息|电脑信息|system info|sysinfo)$/i,
    tool: 'get_system_info',
    extract: () => ({}),
  },
  // Clipboard read
  {
    regex: /^(?:读取剪贴板|粘贴板内容|clipboard|paste|read clipboard)$/i,
    tool: 'clipboard_read',
    extract: () => ({}),
  },
  // Current time — direct response, zero token
  {
    regex: /^(?:现在几点|几点了|什么时间|what time|current time|now|时间)$/i,
    extract: () => ({}),
    direct: () => new Date().toLocaleString(),
  },
  // Reminder — minutes — Chinese
  {
    regex: /^(\d+)\s*(?:分钟|min)后?(?:提醒我?|remind)\s*(.+)$/i,
    tool: 'set_reminder',
    extract: (m) => ({ minutes: parseInt(m[1]), message: m[2].trim() }),
  },
  // Reminder — minutes — English
  {
    regex: /^remind\s+(?:me\s+)?(?:in\s+)?(\d+)\s*min(?:utes?)?\s+(.+)$/i,
    tool: 'set_reminder',
    extract: (m) => ({ minutes: parseInt(m[1]), message: m[2].trim() }),
  },
  // Reminder — hours — Chinese
  {
    regex: /^(\d+)\s*(?:小时|hour)后?(?:提醒我?)\s*(.+)$/i,
    tool: 'set_reminder',
    extract: (m) => ({ minutes: parseInt(m[1]) * 60, message: m[2].trim() }),
  },
  // Reminder — hours — English
  {
    regex: /^remind\s+(?:me\s+)?(?:in\s+)?(\d+)\s*hours?\s+(.+)$/i,
    tool: 'set_reminder',
    extract: (m) => ({ minutes: parseInt(m[1]) * 60, message: m[2].trim() }),
  },
  // Real-time queries — weather, news, prices → auto web search
  {
    regex: /^(.{1,20}?)(?:的|什么|啥)?(?:天气|气温|温度)(?:怎么样|如何|预报)?[？?]?$/i,
    tool: 'web_search',
    extract: (m) => ({ query: m[0].replace(/[？?]$/, '').trim() }),
  },
  {
    regex: /^(?:天气|今天天气|明天天气|后天天气)(?:怎么样|如何|预报)?[？?]?$/i,
    tool: 'web_search',
    extract: (m) => ({ query: m[0].replace(/[？?]$/, '').trim() }),
  },
  {
    regex: /^(.{1,20}?)(?:的)?(?:新闻|最新消息|热搜)[？?]?$/i,
    tool: 'web_search',
    extract: (m) => ({ query: m[0].replace(/[？?]$/, '').trim() }),
  },
  {
    regex: /^(.{1,20}?)(?:多少钱|价格|股价|汇率)[？?]?$/i,
    tool: 'web_search',
    extract: (m) => ({ query: m[0].replace(/[？?]$/, '').trim() }),
  },
  // Web search — Chinese (with "查一查", "搜" variants)
  {
    regex: /^(?:搜索|搜一下|搜一搜|查一下|查一查|查询|搜)\s*(.+)$/i,
    tool: 'web_search',
    extract: (m) => ({ query: m[1].trim() }),
  },
  // "查" + non-file content → web search (guard: not file-related words)
  {
    regex: /^查\s*(.+)$/i,
    tool: 'web_search',
    extract: (m) => ({ query: m[1].trim() }),
    guard: (m) => !/文件|文件夹|目录|桌面|下载|文档|看/.test(m[1]),
  },
  // Web search — English
  {
    regex: /^(?:search|look up|google)\s+(.+)$/i,
    tool: 'web_search',
    extract: (m) => ({ query: m[1].trim() }),
  },

  // --- Screen & Process patterns ---

  // Active window
  {
    regex: /^(?:当前窗口|活动窗口|我在看什么|active window|what's? (?:the )?(?:current|active) window)$/i,
    tool: 'get_active_window',
    extract: () => ({}),
  },
  // Process list
  {
    regex: /^(?:进程列表|运行的程序|running apps|what's running|list processes|process list)$/i,
    tool: 'list_processes',
    extract: () => ({}),
  },
  // Battery
  {
    regex: /^(?:电池|电量|battery)$/i,
    tool: 'get_system_info',
    extract: () => ({}),
  },
  // Disk space
  {
    regex: /^(?:磁盘空间|磁盘|硬盘|disk space|disk usage)$/i,
    tool: 'get_system_info',
    extract: () => ({}),
  },
  // Screenshot
  {
    regex: /^(?:截图|截屏|screenshot|capture screen)$/i,
    tool: 'capture_screenshot',
    extract: () => ({}),
  },
  // Describe screen (AI vision)
  {
    regex: /^(?:分析屏幕|看屏幕|看看屏幕|看一下屏幕|屏幕上有什么|我的屏幕有什么|看看我的屏幕|屏幕上是什么|你看到了什么|屏幕有什么|帮我看屏幕|帮我看看屏幕|analyze screen|what do you see|what's on (?:my )?screen|describe (?:my )?screen|look at (?:my )?screen)$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },
  // "你看得见/能看到/能看见...屏幕" variants
  {
    regex: /^你(?:看得见|能看到|能看见|看得到).*(?:屏幕|桌面)[吗嘛？?]*$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },
  // "看看我屏幕上..." / "帮我看看屏幕上..."
  {
    regex: /^(?:帮我)?看看(?:我的?)?屏幕上.*$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },
  // Describe specific window — "看我的微信窗口" / "看看Chrome" / "look at WeChat window"
  {
    regex: /^(?:看看?|帮我看看?|分析|look at|check|show me)\s*(?:我的)?(.+?)(?:窗口|的窗口|window)?$/i,
    tool: 'describe_window',
    extract: (m: RegExpMatchArray) => ({ window_name: m[1].trim() }),
    // Only match if the captured text is a known app or looks like a window name
    // Avoid matching generic phrases like "看看天气"
    guard: (m) => {
      const name = m[1].trim().toLowerCase()
      // Must not be already handled by other patterns (screen/desktop variants)
      if (/屏幕|桌面|screen|desktop/.test(name)) return false
      // Must look like an app name (known app or short name)
      return KNOWN_APPS.has(name) || name.length <= 10
    },
  },
  // Bare "看看" / "你看看" / "看一下" — when vision target is set, user expects Niromi to look
  {
    regex: /^(?:你)?(?:看看|看一下|看一眼|帮我看|帮我看看)[？?]?$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },
  // "你看到什么" / "看到了什么" / "能看到什么"
  {
    regex: /^(?:你)?(?:看到|能看到|能看见|看得到|看得见)(?:什么|了什么|啥)[？?]?$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },
  // Looser Chinese screen queries
  {
    regex: /^(?:我的)?屏幕(?:上)?(?:有什么|是什么|显示什么|在显示什么|内容|怎么了)[？?]?$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },
  // English: "can you see my screen", "what's on my screen"
  {
    regex: /^can you see (?:my )?(?:screen|desktop)[?]?$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },
  {
    regex: /^what(?:'s| is) on (?:my )?(?:screen|desktop)[?]?$/i,
    tool: 'describe_screen',
    extract: () => ({}),
  },

  // --- Navigation shortcuts ---

  // Open Downloads
  {
    regex: /^(?:打开下载|下载文件夹|open downloads)$/i,
    tool: 'open_app',
    extract: () => ({ name: 'Downloads' }),
  },
  // Open Documents
  {
    regex: /^(?:打开文档|文档文件夹|open documents)$/i,
    tool: 'open_app',
    extract: () => ({ name: 'Documents' }),
  },
  // Open Desktop
  {
    regex: /^(?:打开桌面|桌面文件夹|open desktop)$/i,
    tool: 'open_app',
    extract: () => ({ name: 'Desktop' }),
  },

  // --- Showcase Skills ---

  // Quick Note
  {
    regex: /^(?:\/note|记一下|笔记)\s+(.+)/i,
    skill: 'quick_note',
    extract: (m) => ({ content: m[1].trim() }),
  },
  // View Notes
  {
    regex: /^(?:\/notes|查笔记|看笔记)$/i,
    skill: 'quick_note_search',
    extract: () => ({}),
  },
  // Clipboard History
  {
    regex: /^(?:\/clipboard|剪贴板历史)$/i,
    skill: 'clipboard_history',
    extract: () => ({}),
  },
  // Screen Reader
  {
    regex: /^(?:\/看屏幕|看一下屏幕|read.?screen)$/i,
    skill: 'screen_reader',
    extract: () => ({}),
  },

  // --- Automation: Send message to app ---

  // "回复微信 xxx" / "在微信里说 xxx" / "帮我回微信 xxx"
  {
    regex: /^(?:回复|回|在|给)\s*(.+?)(?:说|发|回复|发送)\s+(.+)$/i,
    tool: 'send_message_to_app',
    extract: (m) => ({ app: m[1].trim(), message: m[2].trim() }),
    guard: (m) => isKnownApp(m[1].trim()),
  },
  // "send xxx to WeChat" / "reply xxx in WeChat"
  {
    regex: /^(?:send|reply|type)\s+(.+?)\s+(?:to|in)\s+(.+)$/i,
    tool: 'send_message_to_app',
    extract: (m) => ({ app: m[2].trim(), message: m[1].trim() }),
    guard: (m) => isKnownApp(m[2].trim()),
  },

  // --- Help ---

  // Help
  {
    regex: /^(?:帮助|能做什么|你能干什么|help|what can you do)$/i,
    skill: 'help',
    extract: () => ({}),
  },

  // --- Composite Skill patterns ---

  // Organize desktop
  {
    regex: /^(?:整理桌面|收拾桌面|organize desktop|tidy desktop|clean desktop)$/i,
    skill: 'organize_desktop',
    extract: () => ({}),
  },
  // Clean downloads
  {
    regex: /^(?:清理下载|整理下载|clean downloads|organize downloads)$/i,
    skill: 'clean_downloads',
    extract: () => ({}),
  },
  // Daily summary
  {
    regex: /^(?:每日摘要|今日摘要|日报|daily summary|status)$/i,
    skill: 'daily_summary',
    extract: () => ({}),
  },
]

/**
 * Try to match user input against local patterns.
 * Returns a match if found, null if the message should go to AI.
 */
export function parseLocal(input: string): LocalMatch | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Strip common request prefixes that don't change the intent
  // e.g. "帮我打开Chrome" → "打开Chrome", "请搜索xxx" → "搜索xxx"
  const stripped = trimmed.replace(/^(?:请帮我|你帮我|能不能帮我|可以帮我|帮我|请|麻烦|帮忙)\s*/i, '')

  for (const pattern of patterns) {
    // Try stripped version first, fall back to original
    const match = stripped.match(pattern.regex) || trimmed.match(pattern.regex)
    if (match) {
      if (pattern.guard && !pattern.guard(match)) continue
      if (pattern.direct) {
        return {
          params: pattern.extract(match),
          directResponse: pattern.direct(match),
        }
      }
      return {
        tool: pattern.tool,
        skill: pattern.skill,
        params: pattern.extract(match),
      }
    }
  }

  return null
}

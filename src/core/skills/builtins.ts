import { skillRegistry } from './registry'
import { toolRegistry } from '@/core/tools'
import { useChatStore } from '@/stores/chatStore'
import { registerWeChatDelegateSkill } from './wechat-delegate'

const toolCategoryMap: Record<string, 'files' | 'apps' | 'search' | 'create' | 'system' | 'custom'> = {
  list_files: 'files',
  read_file: 'files',
  create_directory: 'files',
  move_files: 'files',
  delete_files: 'files',
  write_file: 'files',
  copy_files: 'files',
  search_files: 'files',
  open_app: 'apps',
  run_shell: 'system',
  clipboard_read: 'system',
  clipboard_write: 'system',
  get_system_info: 'system',
  set_reminder: 'system',
  web_search: 'search',
  get_active_window: 'system',
  list_processes: 'system',
  capture_screenshot: 'system',
}

const toolIconMap: Record<string, string> = {
  list_files: '\uD83D\uDCC2',
  read_file: '\uD83D\uDCC4',
  create_directory: '\uD83D\uDCC1',
  move_files: '\u27A1\uFE0F',
  delete_files: '\uD83D\uDDD1\uFE0F',
  write_file: '\u270D\uFE0F',
  copy_files: '\uD83D\uDCCB',
  search_files: '\uD83D\uDD0D',
  open_app: '\uD83D\uDE80',
  run_shell: '\uD83D\uDCBB',
  clipboard_read: '\uD83D\uDCCB',
  clipboard_write: '\u270D\uFE0F',
  get_system_info: '\uD83D\uDCCA',
  set_reminder: '\u23F0',
  web_search: '\uD83C\uDF10',
  get_active_window: '\uD83D\uDD6E',
  list_processes: '\uD83D\uDCCB',
  capture_screenshot: '\uD83D\uDCF7',
}

const toolNameMap: Record<string, { name: string; nameEn: string; keywords: string[] }> = {
  list_files: { name: '\u5217\u51FA\u6587\u4EF6', nameEn: 'List Files', keywords: ['\u6587\u4EF6', '\u76EE\u5F55', 'files', 'ls', 'dir'] },
  read_file: { name: '\u8BFB\u53D6\u6587\u4EF6', nameEn: 'Read File', keywords: ['\u8BFB\u53D6', '\u67E5\u770B', 'read', 'cat'] },
  create_directory: { name: '\u521B\u5EFA\u6587\u4EF6\u5939', nameEn: 'Create Folder', keywords: ['\u521B\u5EFA', '\u6587\u4EF6\u5939', 'mkdir'] },
  move_files: { name: '\u79FB\u52A8\u6587\u4EF6', nameEn: 'Move Files', keywords: ['\u79FB\u52A8', '\u642C', 'move', 'mv'] },
  delete_files: { name: '\u5220\u9664\u6587\u4EF6', nameEn: 'Delete Files', keywords: ['\u5220\u9664', '\u79FB\u9664', 'delete', 'rm'] },
  write_file: { name: '\u5199\u5165\u6587\u4EF6', nameEn: 'Write File', keywords: ['\u5199\u5165', '\u4FDD\u5B58', 'write', 'save'] },
  copy_files: { name: '\u590D\u5236\u6587\u4EF6', nameEn: 'Copy Files', keywords: ['\u590D\u5236', '\u62F7\u8D1D', 'copy', 'cp'] },
  search_files: { name: '\u641C\u7D22\u6587\u4EF6', nameEn: 'Search Files', keywords: ['\u641C\u7D22', '\u67E5\u627E', 'find', 'search'] },
  open_app: { name: '\u6253\u5F00\u5E94\u7528', nameEn: 'Open App', keywords: ['\u6253\u5F00', '\u542F\u52A8', 'open', 'launch'] },
  run_shell: { name: '\u8FD0\u884C\u547D\u4EE4', nameEn: 'Run Command', keywords: ['\u547D\u4EE4', '\u7EC8\u7AEF', 'shell', 'cmd', 'terminal'] },
  clipboard_read: { name: '\u8BFB\u53D6\u526A\u8D34\u677F', nameEn: 'Read Clipboard', keywords: ['\u526A\u8D34\u677F', '\u7C98\u8D34', 'clipboard', 'paste'] },
  clipboard_write: { name: '\u5199\u5165\u526A\u8D34\u677F', nameEn: 'Write Clipboard', keywords: ['\u526A\u8D34\u677F', '\u590D\u5236', 'clipboard', 'copy'] },
  get_system_info: { name: '\u7CFB\u7EDF\u4FE1\u606F', nameEn: 'System Info', keywords: ['\u7CFB\u7EDF', '\u7535\u8111', 'system', 'info'] },
  set_reminder: { name: '\u8BBE\u7F6E\u63D0\u9192', nameEn: 'Set Reminder', keywords: ['\u63D0\u9192', '\u95F9\u949F', 'remind', 'timer'] },
  web_search: { name: '\u7F51\u9875\u641C\u7D22', nameEn: 'Web Search', keywords: ['\u641C\u7D22', '\u67E5\u8BE2', 'search', 'google'] },
  get_active_window: { name: '\u5F53\u524D\u7A97\u53E3', nameEn: 'Active Window', keywords: ['\u7A97\u53E3', '\u524D\u53F0', 'window', 'active', 'focus'] },
  list_processes: { name: '\u8FDB\u7A0B\u5217\u8868', nameEn: 'Process List', keywords: ['\u8FDB\u7A0B', '\u8FD0\u884C', 'process', 'running'] },
  capture_screenshot: { name: '\u622A\u56FE', nameEn: 'Screenshot', keywords: ['\u622A\u56FE', '\u5C4F\u5E55', 'screenshot', 'capture'] },
}

async function getDesktopPath(): Promise<string> {
  const home = await window.electronAPI.getHomeDir()
  return `${home}/Desktop`
}

async function getDownloadsPath(): Promise<string> {
  const home = await window.electronAPI.getHomeDir()
  return `${home}/Downloads`
}

export function registerBuiltinSkills() {
  // Auto-register from tool registry
  for (const tool of toolRegistry.getAll()) {
    const meta = toolNameMap[tool.name]
    if (!meta) continue
    skillRegistry.register({
      id: tool.name,
      name: meta.name,
      nameEn: meta.nameEn,
      icon: toolIconMap[tool.name] || '\u2699\uFE0F',
      category: toolCategoryMap[tool.name] || 'custom',
      description: tool.description,
      tool: tool.name,
      keywords: meta.keywords,
    })
  }

  // ---- Composite Skills ----

  skillRegistry.register({
    id: 'organize_desktop',
    name: '\u6574\u7406\u684C\u9762',
    nameEn: 'Organize Desktop',
    icon: '\uD83E\uDDF9',
    category: 'files',
    description: 'Sort desktop files into folders by type',
    keywords: ['\u6574\u7406', '\u684C\u9762', 'organize', 'desktop', 'tidy'],
    aiInvocable: true,
    execute: async () => {
      // Full organize logic — list, group by extension, create dirs, move
      const desktopPath = await getDesktopPath()
      const listResult = await toolRegistry.execute('list_files', { path: desktopPath })
      if (!listResult.success) {
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: `\u5594...没能读取桌面文件: ${listResult.summary}`,
        })
        return
      }

      const files = listResult.data as { name: string; isDir: boolean }[]
      const filesByExt: Record<string, string[]> = {}
      const extMap: Record<string, string> = {
        '.png': '\u56FE\u7247', '.jpg': '\u56FE\u7247', '.jpeg': '\u56FE\u7247', '.gif': '\u56FE\u7247', '.bmp': '\u56FE\u7247', '.webp': '\u56FE\u7247', '.svg': '\u56FE\u7247',
        '.pdf': '\u6587\u6863', '.doc': '\u6587\u6863', '.docx': '\u6587\u6863', '.txt': '\u6587\u6863', '.md': '\u6587\u6863', '.xlsx': '\u6587\u6863', '.pptx': '\u6587\u6863',
        '.zip': '\u538B\u7F29\u5305', '.rar': '\u538B\u7F29\u5305', '.7z': '\u538B\u7F29\u5305', '.tar': '\u538B\u7F29\u5305', '.gz': '\u538B\u7F29\u5305',
        '.exe': '\u7A0B\u5E8F', '.msi': '\u7A0B\u5E8F', '.lnk': '\u5FEB\u6377\u65B9\u5F0F',
      }

      for (const f of files) {
        if (f.isDir) continue
        const ext = f.name.includes('.') ? '.' + f.name.split('.').pop()!.toLowerCase() : ''
        const folder = extMap[ext] || '\u5176\u4ED6'
        if (!filesByExt[folder]) filesByExt[folder] = []
        filesByExt[folder].push(f.name)
      }

      let movedCount = 0
      for (const [folder, names] of Object.entries(filesByExt)) {
        if (names.length === 0) continue
        const folderPath = `${desktopPath}/${folder}`
        await toolRegistry.execute('create_directory', { path: folderPath })
        for (const name of names) {
          await toolRegistry.execute('move_files', {
            from: `${desktopPath}/${name}`,
            to: `${folderPath}/${name}`,
          })
          movedCount++
        }
      }

      useChatStore.getState().addMessage({
        role: 'assistant',
        content: `\u2728 桌面整理完成！移动了 ${movedCount} 个文件到 ${Object.keys(filesByExt).length} 个分类文件夹`,
      })
    },
  })

  skillRegistry.register({
    id: 'clean_downloads',
    name: '\u6E05\u7406\u4E0B\u8F7D',
    nameEn: 'Clean Downloads',
    icon: '\uD83D\uDDD1\uFE0F',
    category: 'files',
    description: 'Find old files in Downloads folder',
    keywords: ['\u6E05\u7406', '\u4E0B\u8F7D', 'clean', 'downloads'],
    aiInvocable: true,
    execute: async () => {
      const downloadsPath = await getDownloadsPath()
      const listResult = await toolRegistry.execute('list_files', { path: downloadsPath })
      if (!listResult.success) {
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: `\u5594...没能读取下载文件夹: ${listResult.summary}`,
        })
        return
      }

      const files = listResult.data as { name: string; isDir: boolean }[]
      const fileCount = files.filter((f) => !f.isDir).length
      useChatStore.getState().addMessage({
        role: 'assistant',
        content: `\uD83D\uDCC2 下载文件夹有 ${fileCount} 个文件。要我帮你按类型整理吗？`,
      })
    },
  })

  skillRegistry.register({
    id: 'daily_summary',
    name: '\u6BCF\u65E5\u6458\u8981',
    nameEn: 'Daily Summary',
    icon: '\uD83D\uDCCB',
    category: 'system',
    description: 'System status and recent activity summary',
    keywords: ['\u6458\u8981', '\u603B\u7ED3', 'summary', 'daily', 'status'],
    aiInvocable: true,
    execute: async () => {
      const parts: string[] = []

      // System info
      const sysResult = await toolRegistry.execute('get_system_info', {})
      if (sysResult.success) {
        parts.push(`\uD83D\uDCCA 系统: ${sysResult.summary}`)
      }

      // Active window
      try {
        const winResult = await toolRegistry.execute('get_active_window', {})
        if (winResult.success) {
          parts.push(`\uD83D\uDD6E 当前窗口: ${winResult.summary}`)
        }
      } catch { /* ignore */ }

      // Recent episodes from memory
      const { memoryStore } = await import('@/core/memory/store')
      const episodes = memoryStore.getEpisodes(5)
      if (episodes.length > 0) {
        parts.push('\uD83D\uDCDD 最近活动:')
        for (const ep of episodes) {
          parts.push(`  - ${ep.summary}`)
        }
      }

      useChatStore.getState().addMessage({
        role: 'assistant',
        content: parts.join('\n') || '\u6682\u65F6\u6CA1\u6709\u6458\u8981\u4FE1\u606F~',
      })
    },
  })

  // ---- Showcase Skills ----

  // Quick Note
  skillRegistry.register({
    id: 'quick_note',
    name: '\u5FEB\u901F\u7B14\u8BB0',
    nameEn: 'Quick Note',
    icon: '\uD83D\uDCDD',
    category: 'create',
    description: 'Quick capture to local markdown',
    keywords: ['\u7B14\u8BB0', '\u8BB0\u5F55', 'note', 'memo', '\u8BB0\u4E00\u4E0B'],
    execute: async (input: string) => {
      const content = input.replace(/^(?:\/note|记一下|笔记)\s*/i, '').trim()
      if (!content) {
        useChatStore.getState().addMessage({ role: 'assistant', content: '\u8981\u8BB0\u4EC0\u4E48\u5462\uFF1F\u8BF7\u544A\u8BC9\u6211\u5185\u5BB9~' })
        return
      }
      const home = await window.electronAPI.getHomeDir()
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const notePath = `${home}/.niromi/notes/${dateStr}.md`

      // Read existing content or start fresh
      let existing = ''
      try {
        existing = await window.electronAPI.readFile(notePath)
      } catch { /* file doesn't exist yet */ }

      const entry = `\n- ${timeStr} ${content}`
      const newContent = existing
        ? existing + entry
        : `# ${dateStr}\n${entry}`

      await toolRegistry.execute('write_file', { path: notePath, content: newContent })
      useChatStore.getState().addMessage({
        role: 'assistant',
        content: `\uD83D\uDCDD \u5DF2\u8BB0\u5F55\uFF01\u4FDD\u5B58\u5230 ${dateStr}.md`,
      })
    },
  })

  // Quick Note Search
  skillRegistry.register({
    id: 'quick_note_search',
    name: '\u67E5\u770B\u7B14\u8BB0',
    nameEn: 'View Notes',
    icon: '\uD83D\uDCDD',
    category: 'create',
    description: 'Search and view saved notes',
    keywords: ['\u67E5\u7B14\u8BB0', '\u770B\u7B14\u8BB0', 'notes', 'view notes'],
    execute: async () => {
      const home = await window.electronAPI.getHomeDir()
      const notesDir = `${home}/.niromi/notes`
      try {
        const files = await window.electronAPI.listFiles(notesDir)
        const mdFiles = files.filter((f: { name: string; isDir: boolean }) => !f.isDir && f.name.endsWith('.md'))
        if (mdFiles.length === 0) {
          useChatStore.getState().addMessage({ role: 'assistant', content: '\u8FD8\u6CA1\u6709\u7B14\u8BB0\u5462\uFF0C\u7528 /note \u8BB0\u5F55\u4E00\u4E0B\u5427~' })
          return
        }
        // Show latest note
        const latest = mdFiles.sort((a: { name: string }, b: { name: string }) => b.name.localeCompare(a.name))[0]
        const content = await window.electronAPI.readFile(`${notesDir}/${latest.name}`)
        const preview = content.length > 500 ? content.slice(0, 500) + '...' : content
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: `\uD83D\uDCDD **${latest.name}** (共 ${mdFiles.length} 个笔记文件)\n\n${preview}`,
        })
      } catch {
        useChatStore.getState().addMessage({ role: 'assistant', content: '\u8FD8\u6CA1\u6709\u7B14\u8BB0\u5462\uFF0C\u7528 /note \u8BB0\u5F55\u4E00\u4E0B\u5427~' })
      }
    },
  })

  // Clipboard History
  const clipboardHistory: { text: string; time: number }[] = []
  let clipboardTimer: ReturnType<typeof setInterval> | null = null

  skillRegistry.register({
    id: 'clipboard_history',
    name: '\u526A\u8D34\u677F\u5386\u53F2',
    nameEn: 'Clipboard History',
    icon: '\uD83D\uDCCB',
    category: 'system',
    description: 'Track and view clipboard history',
    keywords: ['\u526A\u8D34\u677F', '\u5386\u53F2', 'clipboard', 'history', '\u590D\u5236\u5386\u53F2'],
    execute: async () => {
      // Start tracking if not already
      if (!clipboardTimer) {
        let lastText = ''
        clipboardTimer = setInterval(async () => {
          try {
            const text = await window.electronAPI.clipboardRead()
            if (text && text !== lastText) {
              lastText = text
              clipboardHistory.unshift({ text: text.slice(0, 200), time: Date.now() })
              if (clipboardHistory.length > 30) clipboardHistory.pop()
            }
          } catch { /* ignore */ }
        }, 5000)
      }

      if (clipboardHistory.length === 0) {
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: '\uD83D\uDCCB \u526A\u8D34\u677F\u5386\u53F2\u5DF2\u5F00\u59CB\u8BB0\u5F55\uFF01\u590D\u5236\u4E00\u4E9B\u5185\u5BB9\u540E\u518D\u67E5\u770B~',
        })
        return
      }

      const lines = clipboardHistory.slice(0, 10).map((item, i) => {
        const time = new Date(item.time).toLocaleTimeString()
        const preview = item.text.length > 60 ? item.text.slice(0, 60) + '...' : item.text
        return `${i + 1}. \`${time}\` ${preview}`
      })

      useChatStore.getState().addMessage({
        role: 'assistant',
        content: `\uD83D\uDCCB **\u526A\u8D34\u677F\u5386\u53F2** (\u6700\u8FD1 ${clipboardHistory.length} \u6761)\n\n${lines.join('\n')}`,
      })
    },
  })

  // Screen Reader — now uses LLM Vision via describe_screen tool
  skillRegistry.register({
    id: 'screen_reader',
    name: '\u5C4F\u5E55\u9605\u8BFB',
    nameEn: 'Screen Reader',
    icon: '\uD83D\uDC41\uFE0F',
    category: 'system',
    description: 'Capture screen for AI to describe',
    keywords: ['\u770B\u5C4F\u5E55', '\u8BFB\u5C4F\u5E55', 'screen', 'read', '\u5C4F\u5E55\u9605\u8BFB'],
    aiInvocable: true,
    execute: async () => {
      useChatStore.getState().addMessage({
        role: 'assistant',
        content: '\uD83D\uDC41\uFE0F \u6B63\u5728\u770B\u5C4F\u5E55...',
      })

      try {
        await window.electronAPI.captureScreenshot()
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: '\uD83D\uDC41\uFE0F \u5DF2\u622A\u53D6\u5C4F\u5E55\uFF0C\u8BF7\u7528 describe_screen \u5DE5\u5177\u8BA9 AI \u5206\u6790',
        })
      } catch {
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: '\u5594...\u6CA1\u80FD\u622A\u53D6\u5C4F\u5E55',
        })
      }
    },
  })

  // Non-tool skills
  skillRegistry.register({
    id: 'clear_chat',
    name: '\u6E05\u7A7A\u804A\u5929',
    nameEn: 'Clear Chat',
    icon: '\uD83E\uDDF9',
    category: 'system',
    description: 'Clear all chat messages',
    keywords: ['\u6E05\u7A7A', '\u6E05\u9664', 'clear', 'clean'],
    execute: async () => {
      useChatStore.getState().clearMessages()
    },
  })

  skillRegistry.register({
    id: 'help',
    name: '\u5E2E\u52A9',
    nameEn: 'Help',
    icon: '\u2753',
    category: 'system',
    description: 'Show all capabilities',
    keywords: ['\u5E2E\u52A9', '\u80FD\u529B', 'help', 'what can you do'],
    execute: async () => {
      const skills = skillRegistry.getAll()
      const lines = skills.map((s) => `${s.icon} **${s.name}** (${s.nameEn}) - ${s.description}`)
      useChatStore.getState().addMessage({
        role: 'assistant',
        content: `Niromi \u53EF\u4EE5\u5E2E\u4F60\u505A\u8FD9\u4E9B\u4E8B\uFF1A\n\n${lines.join('\n')}`,
      })
    },
  })

  // Register configurable skills
  registerWeChatDelegateSkill()

  // Initialize marketplace skills (load from ~/.niromi/skills/)
  import('./loader').then(({ initMarketplaceSkills }) => {
    initMarketplaceSkills().catch(err => {
      console.warn('[Niromi] Marketplace skills init:', err)
    })
  })
}

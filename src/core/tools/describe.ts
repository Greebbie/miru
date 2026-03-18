/**
 * Generate human-readable descriptions for tool actions.
 * Used in confirmation dialogs so non-technical users understand what will happen.
 */

type Lang = 'zh' | 'en' | 'auto'

function resolveLang(lang: Lang): 'zh' | 'en' {
  if (lang === 'zh' || lang === 'en') return lang
  return 'zh'
}

function truncPath(p: string, max = 60): string {
  if (!p || p.length <= max) return p
  return '...' + p.slice(-max + 3)
}

const descriptions: Record<string, (params: Record<string, unknown>, l: 'zh' | 'en') => string> = {
  'delete-files': (p, l) => {
    const path = truncPath(String(p.path || p.filePath || ''))
    return l === 'zh' ? `删除: ${path}` : `Delete: ${path}`
  },
  'move-files': (p, l) => {
    const from = truncPath(String(p.from || ''))
    const to = truncPath(String(p.to || ''))
    return l === 'zh' ? `移动 ${from} → ${to}` : `Move ${from} → ${to}`
  },
  'write-file': (p, l) => {
    const path = truncPath(String(p.filePath || p.path || ''))
    return l === 'zh' ? `写入文件: ${path}` : `Write file: ${path}`
  },
  'copy-files': (p, l) => {
    const from = truncPath(String(p.from || ''))
    const to = truncPath(String(p.to || ''))
    return l === 'zh' ? `复制 ${from} → ${to}` : `Copy ${from} → ${to}`
  },
  'run-shell': (p, l) => {
    const cmd = String(p.command || '').slice(0, 80)
    return l === 'zh' ? `执行命令: ${cmd}` : `Run command: ${cmd}`
  },
  'create-directory': (p, l) => {
    const path = truncPath(String(p.dirPath || p.path || ''))
    return l === 'zh' ? `创建文件夹: ${path}` : `Create folder: ${path}`
  },
  'open-app': (p, l) => {
    const name = String(p.name || '')
    return l === 'zh' ? `打开应用: ${name}` : `Open app: ${name}`
  },
  'clipboard-write': (_p, l) => {
    return l === 'zh' ? '写入剪贴板' : 'Write to clipboard'
  },
}

export function describeToolAction(
  toolName: string,
  params: Record<string, unknown>,
  lang: Lang = 'zh'
): string {
  const l = resolveLang(lang)
  const descFn = descriptions[toolName]
  if (descFn) return descFn(params, l)

  // Fallback: just show the tool name
  return l === 'zh' ? `执行: ${toolName}` : `Execute: ${toolName}`
}

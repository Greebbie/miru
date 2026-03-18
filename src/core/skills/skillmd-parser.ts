import type { SkillDefinition } from './registry'
import type { MarketplaceSkillMeta } from './marketplace'

interface ParsedSkillMd {
  meta: Partial<SkillDefinition & MarketplaceSkillMeta>
  stepsRaw?: string[]
}

/**
 * Parse SKILL.md frontmatter (no YAML library needed).
 * Extracts `---` delimited key: value pairs.
 */
export function parseSkillMd(content: string, files?: string[]): ParsedSkillMd {
  const meta: Partial<SkillDefinition & MarketplaceSkillMeta> = {}

  // Extract frontmatter
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const lines = fmMatch[1].split('\n')
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const val = line.slice(colonIdx + 1).trim()
      if (!key || !val) continue

      switch (key) {
        case 'name': meta.name = val; break
        case 'nameEn': meta.nameEn = val; break
        case 'description': meta.description = val; break
        case 'icon': meta.icon = val; break
        case 'category':
          if (['files', 'apps', 'search', 'create', 'system', 'custom'].includes(val)) {
            meta.category = val as SkillDefinition['category']
          }
          break
        case 'author': meta.author = val; break
        case 'version': meta.version = val; break
        case 'riskLevel':
          if (['low', 'medium', 'high'].includes(val)) {
            meta.riskLevel = val as 'low' | 'medium' | 'high'
          }
          break
        case 'tags':
          // tags: tag1, tag2, tag3
          break
        case 'requires':
          // requires: tool1, tool2
          break
        case 'executionMode':
          if (val === 'steps' || val === 'shell') {
            meta.executionMode = val
          }
          break
        case 'aiInvocable':
          meta.aiInvocable = val === 'true'
          break
      }

      // Parse tags into keywords
      if (key === 'tags') {
        meta.keywords = val.split(',').map(t => t.trim()).filter(Boolean)
      }
    }
  }

  // Auto-detect script interpreter from files in directory
  if (files) {
    if (files.includes('run.ps1')) {
      meta.scriptInterpreter = 'powershell'
      meta.scriptPath = 'run.ps1'
      if (!meta.executionMode) meta.executionMode = 'shell'
    } else if (files.includes('run.js')) {
      meta.scriptInterpreter = 'node'
      meta.scriptPath = 'run.js'
      if (!meta.executionMode) meta.executionMode = 'shell'
    } else if (files.includes('run.py')) {
      meta.scriptInterpreter = 'python'
      meta.scriptPath = 'run.py'
      if (!meta.executionMode) meta.executionMode = 'shell'
    } else if (files.includes('run.sh')) {
      meta.scriptInterpreter = 'bash'
      meta.scriptPath = 'run.sh'
      if (!meta.executionMode) meta.executionMode = 'shell'
    }
  }

  // Default execution mode
  if (!meta.executionMode) meta.executionMode = 'steps'

  // Auto-generate keywords from name + description if not set
  if (!meta.keywords) {
    const parts: string[] = []
    if (meta.name) parts.push(...meta.name.split(/\s+/))
    if (meta.nameEn) parts.push(...meta.nameEn.toLowerCase().split(/\s+/))
    if (meta.description) {
      // Take first few meaningful words
      parts.push(...meta.description.split(/\s+/).slice(0, 5))
    }
    meta.keywords = [...new Set(parts.filter(p => p.length > 1))]
  }

  // Extract steps section (lines starting with - after ## Steps)
  const stepsRaw: string[] = []
  const stepsMatch = content.match(/##\s*Steps\s*\n([\s\S]*?)(?:\n##|\n---|\z)/i)
  if (stepsMatch) {
    const stepLines = stepsMatch[1].split('\n')
    for (const line of stepLines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        stepsRaw.push(trimmed.slice(1).trim())
      }
    }
  }

  return { meta, stepsRaw: stepsRaw.length > 0 ? stepsRaw : undefined }
}

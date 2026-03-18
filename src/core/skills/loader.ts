import { skillRegistry } from './registry'
import { parseSkillMd } from './skillmd-parser'
import type { InstalledSkillRecord, MarketplaceIndex, MarketplaceIndexEntry } from './marketplace'
import { useChatStore } from '@/stores/chatStore'
import { humanizeError } from '@/core/errors/humanize'

const MARKETPLACE_INDEX_URL = '/skill-index.json'

/**
 * Load installed marketplace skills at startup.
 */
export async function initMarketplaceSkills(): Promise<void> {
  try {
    // Get installed list from persistent store
    const installed = (await window.electronAPI.storeGet('marketplace-installed')) as InstalledSkillRecord[] | null

    // Scan local skill folders
    const localSkills = await window.electronAPI.skillScanLocal()

    // Process local skills
    for (const local of localSkills) {
      // Skip if already registered (e.g. builtin)
      if (skillRegistry.get(local.id)) continue

      const { meta } = parseSkillMd(local.skillMdContent, local.files)
      if (!meta.name) continue

      const skillDir = await window.electronAPI.skillGetDir()

      skillRegistry.register({
        id: local.id,
        name: meta.name || local.id,
        nameEn: meta.nameEn || local.id,
        icon: meta.icon || '\u2699\uFE0F',
        category: meta.category || 'custom',
        description: meta.description || '',
        keywords: meta.keywords || [],
        aiInvocable: meta.aiInvocable,
        execute: meta.executionMode === 'shell' && meta.scriptInterpreter
          ? createShellExecutor(`${skillDir}/${local.id}`, meta.scriptInterpreter)
          : undefined,
      })
    }

    // Re-register installed skills that weren't found locally
    if (installed) {
      for (const record of installed) {
        if (skillRegistry.get(record.id)) continue
        // Skill directory might have been deleted — skip
      }
    }
  } catch (err) {
    console.warn('[Miru] Failed to init marketplace skills:', err)
  }
}

function createShellExecutor(skillDir: string, interpreter: string) {
  return async (input: string) => {
    const result = await window.electronAPI.skillExecScript({
      skillDir,
      interpreter,
      params: { INPUT: input },
    })

    const output = result.stdout || result.stderr || '(no output)'
    useChatStore.getState().addMessage({
      role: 'assistant',
      content: result.exitCode === 0 ? output : humanizeError(output, 'auto'),
    })
  }
}

/**
 * Install a skill from the marketplace.
 */
export async function installSkill(entry: MarketplaceIndexEntry): Promise<boolean> {
  try {
    const filesToDownload = ['SKILL.md']
    // Try to download common script files
    for (const f of ['run.js', 'run.py', 'run.sh', 'run.ps1']) {
      filesToDownload.push(f)
    }

    const result = await window.electronAPI.skillInstall({
      repoUrl: entry.repoUrl,
      skillId: entry.id,
      files: filesToDownload,
    })

    if (!result.success) return false

    // Read the installed SKILL.md and register
    const localSkills = await window.electronAPI.skillScanLocal()
    const local = localSkills.find(s => s.id === entry.id)
    if (local) {
      const { meta } = parseSkillMd(local.skillMdContent, local.files)

      skillRegistry.register({
        id: entry.id,
        name: meta.name || entry.name,
        nameEn: meta.nameEn || entry.nameEn,
        icon: meta.icon || entry.icon,
        category: meta.category || entry.category,
        description: meta.description || entry.description,
        keywords: meta.keywords || entry.tags,
        aiInvocable: meta.aiInvocable,
        execute: meta.executionMode === 'shell' && meta.scriptInterpreter
          ? createShellExecutor(result.skillDir, meta.scriptInterpreter)
          : undefined,
      })
    }

    // Update installed list
    const installed = ((await window.electronAPI.storeGet('marketplace-installed')) as InstalledSkillRecord[] | null) || []
    const record: InstalledSkillRecord = {
      id: entry.id,
      name: entry.name,
      version: entry.version,
      source: entry.source,
      installedAt: Date.now(),
      repoUrl: entry.repoUrl,
      skillDir: result.skillDir,
    }
    const updated = installed.filter(r => r.id !== entry.id)
    updated.push(record)
    await window.electronAPI.storeSet('marketplace-installed', updated)

    return true
  } catch (err) {
    console.error('[Miru] Install skill failed:', err)
    return false
  }
}

/**
 * Uninstall a marketplace skill.
 */
export async function uninstallSkill(skillId: string): Promise<void> {
  skillRegistry.unregister(skillId)
  await window.electronAPI.skillUninstall(skillId)

  const installed = ((await window.electronAPI.storeGet('marketplace-installed')) as InstalledSkillRecord[] | null) || []
  const updated = installed.filter(r => r.id !== skillId)
  await window.electronAPI.storeSet('marketplace-installed', updated)
}

/**
 * Fetch the remote marketplace index.
 */
export async function fetchMarketplaceIndex(): Promise<MarketplaceIndex> {
  try {
    const res = await fetch(MARKETPLACE_INDEX_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch {
    return { version: 0, updatedAt: '', skills: [] }
  }
}

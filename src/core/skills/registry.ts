import type { ToolResult } from '@/core/tools/registry'

export interface SkillStep {
  tool: string
  paramMap: Record<string, string | ((ctx: StepContext) => unknown)>
  condition?: (ctx: StepContext) => boolean
}

export interface StepContext {
  input: string
  previousResults: ToolResult[]
}

export interface SkillDefinition {
  id: string
  name: string
  nameEn: string
  icon: string
  category: 'files' | 'apps' | 'search' | 'create' | 'system' | 'custom'
  description: string
  tool?: string
  keywords: string[]
  execute?: (input: string) => Promise<void>
  steps?: SkillStep[]
  aiInvocable?: boolean
}

class SkillRegistry {
  private skills = new Map<string, SkillDefinition>()

  register(skill: SkillDefinition) {
    this.skills.set(skill.id, skill)
  }

  unregister(id: string): void {
    this.skills.delete(id)
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id)
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  getByCategory(category: SkillDefinition['category']): SkillDefinition[] {
    return this.getAll().filter((s) => s.category === category)
  }

  search(query: string): SkillDefinition[] {
    if (!query.trim()) return this.getAll()
    const q = query.toLowerCase()
    return this.getAll().filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.toLowerCase().includes(q))
    )
  }
}

export const skillRegistry = new SkillRegistry()

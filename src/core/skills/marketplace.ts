import type { SkillDefinition } from './registry'

// Marketplace skill metadata (extends SkillDefinition)
export interface MarketplaceSkillMeta {
  source: 'builtin' | 'openclaw' | 'miru-registry' | 'local'
  version: string
  author: string
  repoUrl?: string
  installedAt?: number
  riskLevel: 'low' | 'medium' | 'high'
  executionMode: 'steps' | 'shell'
  scriptPath?: string
  scriptInterpreter?: 'bash' | 'node' | 'python' | 'powershell'
}

// Remote index entry
export interface MarketplaceIndexEntry {
  id: string
  name: string
  nameEn: string
  icon: string
  category: SkillDefinition['category']
  description: string
  descriptionEn?: string
  author: string
  version: string
  source: 'openclaw' | 'miru-registry'
  repoUrl: string
  riskLevel: 'low' | 'medium' | 'high'
  tags: string[]
}

// Remote index
export interface MarketplaceIndex {
  version: number
  updatedAt: string
  skills: MarketplaceIndexEntry[]
}

// Local installed record
export interface InstalledSkillRecord {
  id: string
  name: string
  version: string
  source: MarketplaceSkillMeta['source']
  installedAt: number
  repoUrl?: string
  skillDir: string
}

import { describe, it, expect } from 'vitest'
import { parseLocal } from '../local'

describe('parseLocal', () => {
  describe('calculator', () => {
    it('evaluates simple arithmetic', () => {
      const match = parseLocal('计算 123+456')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toContain('579')
    })

    it('evaluates multiplication', () => {
      const match = parseLocal('计算 12*34')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toContain('408')
    })

    it('rejects non-arithmetic expressions', () => {
      const match = parseLocal('计算 alert(1)')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toContain('只支持数字计算')
    })

    it('handles English calc', () => {
      const match = parseLocal('calculate 100/4')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toContain('25')
    })
  })

  describe('new apps', () => {
    it('matches notion (resolves as website URL since notion is in KNOWN_WEBSITES)', () => {
      const match = parseLocal('打开 notion')
      expect(match).toBeTruthy()
      expect(match!.tool).toBe('open_app')
      expect(String(match!.params.name)).toContain('notion')
    })

    it('matches obsidian', () => {
      const match = parseLocal('打开 obsidian')
      expect(match).toBeTruthy()
      expect(match!.tool).toBe('open_app')
    })

    it('matches 腾讯会议', () => {
      const match = parseLocal('打开 腾讯会议')
      expect(match).toBeTruthy()
      expect(match!.tool).toBe('open_app')
    })
  })

  describe('new websites', () => {
    it('matches 豆瓣', () => {
      const match = parseLocal('去豆瓣')
      expect(match).toBeTruthy()
      expect(match!.tool).toBe('open_app')
      expect(match!.params.name).toContain('douban')
    })

    it('matches leetcode', () => {
      const match = parseLocal('去 leetcode')
      expect(match).toBeTruthy()
      expect(match!.params.name).toContain('leetcode')
    })

    it('matches stackoverflow', () => {
      const match = parseLocal('go to stackoverflow')
      expect(match).toBeTruthy()
      expect(match!.params.name).toContain('stackoverflow')
    })
  })

  describe('fuzzy matching', () => {
    it('fuzzy matches app with typo (notoin → notion)', () => {
      const match = parseLocal('打开 notoin')
      expect(match).toBeTruthy()
      expect(match!.tool).toBe('open_app')
      // May resolve as website URL or app name
      expect(String(match!.params.name)).toContain('notion')
    })

    it('fuzzy matches website with typo (githb → github)', () => {
      const match = parseLocal('去 githb')
      expect(match).toBeTruthy()
      expect(match!.params.name).toContain('github')
    })

    it('does not fuzzy match with too many errors', () => {
      const match = parseLocal('打开 xxxxxxx')
      expect(match).toBeNull()
    })
  })

  describe('system controls', () => {
    it('lock screen', () => {
      const match = parseLocal('锁屏')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toContain('锁屏')
    })

    it('mute', () => {
      const match = parseLocal('静音')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toContain('静音')
    })

    it('minimize', () => {
      const match = parseLocal('最小化')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toContain('最小化')
    })
  })

  describe('existing patterns still work', () => {
    it('time query', () => {
      const match = parseLocal('现在几点')
      expect(match).toBeTruthy()
      expect(match!.directResponse).toBeTruthy()
    })

    it('open Chrome', () => {
      const match = parseLocal('打开 Chrome')
      expect(match).toBeTruthy()
      expect(match!.tool).toBe('open_app')
    })

    it('go to GitHub', () => {
      const match = parseLocal('去 GitHub')
      expect(match).toBeTruthy()
      expect(match!.params.name).toContain('github')
    })
  })
})

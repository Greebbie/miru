import { toolRegistry } from './registry'
import { humanizeError } from '@/core/errors/humanize'

toolRegistry.register({
  name: 'list_files',
  description: 'List files and folders in a directory',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path' },
    },
    required: ['path'],
  },
  riskLevel: 'low',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const files = await window.electronAPI.listFiles(params.path as string)
      const dirs = files.filter((f) => f.isDir).length
      const regular = files.length - dirs
      return {
        success: true,
        data: files,
        summary: `${files.length} items: ${dirs} folders, ${regular} files`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'read_file',
  description: 'Read text content of a file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
    },
    required: ['path'],
  },
  riskLevel: 'low',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const content = await window.electronAPI.readFile(params.path as string)
      const lines = content.split('\n').length
      return {
        success: true,
        data: content.slice(0, 2000),
        summary: `${lines} lines, ${content.length} chars`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'create_directory',
  description: 'Create a new directory',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to create' },
    },
    required: ['path'],
  },
  riskLevel: 'low',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      await window.electronAPI.createDirectory(params.path as string)
      return { success: true, data: null, summary: 'Directory created' }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'move_files',
  description: 'Move or rename a file/folder',
  parameters: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Source path' },
      to: { type: 'string', description: 'Destination path' },
    },
    required: ['from', 'to'],
  },
  riskLevel: 'medium',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      await window.electronAPI.moveFiles(params.from as string, params.to as string)
      return { success: true, data: null, summary: `Moved to ${params.to}` }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'delete_files',
  description: 'Delete a file or folder permanently',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to delete' },
    },
    required: ['path'],
  },
  riskLevel: 'high',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      await window.electronAPI.deleteFiles(params.path as string)
      return { success: true, data: null, summary: 'Deleted' }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'write_file',
  description: 'Write text content to a file path',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['path', 'content'],
  },
  riskLevel: 'medium',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      await window.electronAPI.writeFile(params.path as string, params.content as string)
      return { success: true, data: null, summary: `Written to ${params.path}` }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'copy_files',
  description: 'Copy a file or folder to destination',
  parameters: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Source path' },
      to: { type: 'string', description: 'Destination path' },
    },
    required: ['from', 'to'],
  },
  riskLevel: 'medium',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      await window.electronAPI.copyFiles(params.from as string, params.to as string)
      return { success: true, data: null, summary: `Copied to ${params.to}` }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

toolRegistry.register({
  name: 'search_files',
  description: 'Search for files by name pattern in directory',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory to search' },
      pattern: { type: 'string', description: 'Filename pattern (substring match)' },
    },
    required: ['path', 'pattern'],
  },
  riskLevel: 'low',
  category: 'files',
  execute: async (params) => {
    if (!window.electronAPI) {
      return { success: false, data: null, summary: 'Miru 的系统接口还没准备好，请稍后再试' }
    }
    try {
      const results = await window.electronAPI.searchFiles(params.path as string, params.pattern as string)
      return {
        success: true,
        data: results,
        summary: `Found ${results.length} matches`,
      }
    } catch (err) {
      return { success: false, data: null, summary: humanizeError(err, 'auto') }
    }
  },
})

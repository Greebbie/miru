import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAdminStore } from '@/stores/adminStore'
import { useI18n } from '@/i18n/useI18n'
import AdminTools from './AdminTools'
import AdminMonitor from './AdminMonitor'
import AdminAutoReply from './AdminAutoReply'
import AdminLogs from './AdminLogs'
import AdminMarketplace from './AdminMarketplace'

type Tab = 'tools' | 'monitor' | 'autoreply' | 'logs' | 'skills'

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('tools')
  const setAdminOpen = useAdminStore((s) => s.setAdminOpen)
  const { t } = useI18n()

  const TABS: { id: Tab; label: string }[] = [
    { id: 'tools', label: t('admin.tab.tools') },
    { id: 'monitor', label: t('admin.tab.monitor') },
    { id: 'autoreply', label: t('admin.tab.autoreply') },
    { id: 'logs', label: t('admin.tab.logs') },
    { id: 'skills', label: t('admin.tab.skills') },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setAdminOpen(false)
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="w-[680px] max-h-[600px] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(30, 30, 40, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-white text-sm font-medium">{t('admin.title')}</span>
          <button
            onClick={() => setAdminOpen(false)}
            className="text-white/40 hover:text-white/80 text-lg transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-white/10"
          >
            x
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/10 overflow-x-auto">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex-shrink-0 px-3 py-2.5 text-xs transition-colors relative ${
                tab === tabItem.id ? 'text-white' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tabItem.label}
              {tab === tabItem.id && (
                <motion.div
                  layoutId="admin-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
                />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4"
            >
              {tab === 'tools' && <AdminTools />}
              {tab === 'monitor' && <AdminMonitor />}
              {tab === 'autoreply' && <AdminAutoReply />}
              {tab === 'logs' && <AdminLogs />}
              {tab === 'skills' && <AdminMarketplace />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

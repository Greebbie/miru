import React from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { t } from '@/i18n/useI18n'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Miru] Component crash:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <FallbackUI onRetry={() => this.setState({ hasError: false })} />
      )
    }
    return this.props.children
  }
}

function FallbackUI({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="text-3xl mb-3">{'😵‍💫'}</div>
      <p className="text-white/70 text-sm mb-1">{t('error.title')}</p>
      <p className="text-white/40 text-xs mb-4">{t('error.desc')}</p>
      <button
        onClick={onRetry}
        className="px-4 py-1.5 rounded-lg text-xs bg-blue-500/80 text-white hover:bg-blue-500 transition-colors"
      >
        {t('error.retry')}
      </button>
    </div>
  )
}

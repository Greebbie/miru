import type { ToolCall } from '@/stores/chatStore'

const statusStyles: Record<ToolCall['status'], string> = {
  pending: 'bg-white/10 text-white/50',
  running: 'bg-blue-500/20 text-blue-300',
  confirm: 'bg-yellow-500/20 text-yellow-300',
  done: 'bg-green-500/20 text-green-300',
  error: 'bg-red-500/20 text-red-300',
}

interface ToolCallBadgeProps {
  toolCall: ToolCall
  onRetry?: () => void
}

export default function ToolCallBadge({ toolCall, onRetry }: ToolCallBadgeProps) {
  const style = statusStyles[toolCall.status]
  const isRunning = toolCall.status === 'running'

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${style}`}>
      {isRunning && (
        <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
      )}
      <span className="font-mono">{toolCall.name}</span>
      {toolCall.status === 'done' && toolCall.result && (
        <span className="max-w-[120px] truncate opacity-70">{toolCall.result.summary}</span>
      )}
      {toolCall.status === 'error' && toolCall.result && (
        <span className="max-w-[120px] truncate opacity-70">{toolCall.result.summary}</span>
      )}
      {toolCall.status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-0.5 hover:opacity-100 opacity-70 transition-opacity"
          title="重试"
        >
          {'\u21BB'}
        </button>
      )}
    </div>
  )
}

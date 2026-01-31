import { useEffect, useRef } from 'react'
import { useGameStore } from '../../stores/gameStore'

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function ActionLogPanel() {
  const { actionLogs } = useGameStore()
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [actionLogs])

  return (
    <div
      ref={logRef}
      className="h-12 max-h-12 overflow-y-auto bg-[#FAFAFA] border border-[#E0E0E0] rounded p-1 text-[10px] space-y-0.5"
    >
      {actionLogs.length === 0 && (
        <p className="text-[#757575]">액션 로그가 여기 표시됩니다.</p>
      )}
      {actionLogs.map((log, i) => (
        <div
          key={i}
          className={`flex gap-2 ${log.isCorrect ? 'text-green-700' : 'text-red-600'}`}
        >
          <span className="font-mono shrink-0">{formatTime(log.elapsedSeconds)}</span>
          <span>{log.isCorrect ? '✅' : '❌'} {log.message}</span>
        </div>
      ))}
    </div>
  )
}

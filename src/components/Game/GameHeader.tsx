import { useGameStore } from '../../stores/gameStore'
import { LEVEL_LABELS } from '../../types/database.types'

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function GameHeader() {
  const { elapsedSeconds, level, completedMenus, targetMenus } = useGameStore()
  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b-2 border-[#E0E0E0] shrink-0">
      <span className="font-mono text-lg font-semibold text-[#333]">
        타이머: {formatTime(elapsedSeconds)}
      </span>
      <span className="text-[#757575]">
        레벨: <strong className="text-[#333]">{LEVEL_LABELS[level]}</strong>
      </span>
      <span className="font-semibold text-[#333]">
        완료: {completedMenus}/{targetMenus}
      </span>
    </header>
  )
}

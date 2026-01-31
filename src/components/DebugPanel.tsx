import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import { LEVEL_LABELS } from '../types/database.types'

export default function DebugPanel() {
  const [showDebug, setShowDebug] = useState(false)
  const location = useLocation()
  const currentStore = useGameStore((s) => s.currentStore)
  const currentUser = useGameStore((s) => s.currentUser)
  const level = useGameStore((s) => s.level)

  const selectedLevelLabel = level ? LEVEL_LABELS[level] : null

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDebug((v) => !v)}
        className="fixed top-20 left-4 bg-gray-800 text-white px-2 py-1 rounded text-xs z-50 hover:bg-gray-700"
      >
        🔧 {showDebug ? '숨기기' : '디버그'}
      </button>

      {showDebug && (
        <div className="fixed top-32 left-4 bg-black/90 text-white p-4 rounded-lg text-sm z-50 max-w-xs shadow-lg">
          <div className="font-bold mb-2">디버그 정보</div>
          <div>매장: {currentStore?.store_name || '미선택'}</div>
          <div>사용자: {currentUser?.avatar_name || '미로그인'}</div>
          <div>레벨: {selectedLevelLabel || '미선택'}</div>
          <div>페이지: {location.pathname}</div>
        </div>
      )}
    </>
  )
}

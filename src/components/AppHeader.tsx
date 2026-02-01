import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../stores/gameStore'
import { LEVEL_LABELS } from '../types/database.types'

const CURRENT_USER_ID_KEY = 'currentUserId'

export default function AppHeader() {
  const navigate = useNavigate()
  const currentStore = useGameStore((s) => s.currentStore)
  const currentUser = useGameStore((s) => s.currentUser)
  const level = useGameStore((s) => s.level)
  const setCurrentUser = useGameStore((s) => s.setCurrentUser)
  const setLevel = useGameStore((s) => s.setLevel)
  const reset = useGameStore((s) => s.reset)

  const selectedLevelLabel = level ? LEVEL_LABELS[level] : null

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await supabase.auth.signOut()
    setCurrentUser(null)
    setLevel('BEGINNER')
    try {
      localStorage.removeItem(CURRENT_USER_ID_KEY)
    } catch (_) {}
    console.log('🔓 로그아웃 완료')
    navigate('/user-login')
  }

  const handleReset = async () => {
    if (!confirm('모든 데이터를 초기화하고 처음으로 돌아가시겠습니까?')) return
    await supabase.auth.signOut()
    reset()
    try {
      localStorage.clear()
    } catch (_) {}
    console.log('🏠 초기화 완료')
    navigate('/')
  }

  return (
    <>
      {/* Desktop Header - 기존 코드 유지 */}
      <header className="hidden lg:flex h-16 bg-gray-800 text-white px-4 shrink-0 items-center">
        <div className="flex justify-between items-center flex-wrap gap-2 w-full">
          <div className="flex gap-4 flex-wrap">
            <div>🏪 {currentStore?.store_name || '매장 미선택'}</div>
            <div>👤 {currentUser?.avatar_name || '로그인 필요'}</div>
            <div>⭐ {selectedLevelLabel || '레벨 미선택'}</div>
          </div>

          <div className="flex gap-2">
            {currentUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded font-medium transition"
              >
                🔓 로그아웃
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium transition"
            >
              🏠 처음으로
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Header - 새로운 모바일 전용 */}
      <header className="flex lg:hidden h-10 px-4 shrink-0 items-center justify-between">
        {/* 처음으로 버튼 */}
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-gray-600 hover:text-gray-900"
        >
          ← 처음으로
        </button>
        
        {/* 아바타/이름 */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
            👤
          </div>
          <span className="text-xs font-medium text-gray-700">
            {currentUser?.avatar_name || '플레이어'}
          </span>
        </div>
        
        {/* 난이도 */}
        <div className="text-xs font-medium text-gray-700">
          {selectedLevelLabel || '신입'}
        </div>
      </header>
    </>
  )
}

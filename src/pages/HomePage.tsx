import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../stores/gameStore'
import { LEVEL_LABELS } from '../types/database.types'

const CURRENT_USER_ID_KEY = 'currentUserId'

interface GameHistoryItem {
  date: string
  level: string
  totalScore: number
}

export default function HomePage() {
  const navigate = useNavigate()
  const currentStore = useGameStore((s) => s.currentStore)
  const currentUser = useGameStore((s) => s.currentUser)
  const setCurrentUser = useGameStore((s) => s.setCurrentUser)
  const setStore = useGameStore((s) => s.setStore)
  const reset = useGameStore((s) => s.reset)

  const [showAdmin, setShowAdmin] = useState(false)
  const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // 가드: 로그인되지 않았으면 / 로 리다이렉트
  useEffect(() => {
    if (!currentStore || !currentUser) {
      navigate('/', { replace: true })
    }
  }, [currentStore, currentUser, navigate])

  // 최근 게임 기록 조회
  useEffect(() => {
    if (!currentUser?.id) {
      setHistoryLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const { data: sessions } = await supabase
          .from('game_sessions')
          .select('id, start_time, level, status')
          .eq('user_id', currentUser.id)
          .eq('status', 'COMPLETED')
          .order('start_time', { ascending: false })
          .limit(5)

        if (cancelled) return

        if (!sessions || sessions.length === 0) {
          setGameHistory([])
          setHistoryLoading(false)
          return
        }

        const ids = sessions.map(s => s.id)
        const { data: scores } = await supabase
          .from('game_scores')
          .select('session_id, total_score')
          .in('session_id', ids)

        if (cancelled) return

        const scoreMap = new Map(scores?.map(s => [s.session_id, s.total_score]) ?? [])
        setGameHistory(sessions.map(s => ({
          date: new Date(s.start_time).toLocaleDateString('ko-KR'),
          level: s.level || 'BEGINNER',
          totalScore: scoreMap.get(s.id) ?? 0,
        })))
      } catch (err) {
        console.error('게임 기록 조회 오류:', err)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [currentUser?.id])

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await supabase.auth.signOut()
    setCurrentUser(null)
    setStore(null)
    reset()
    try {
      localStorage.removeItem(CURRENT_USER_ID_KEY)
    } catch (_) {}
    navigate('/')
  }

  if (!currentStore || !currentUser) return null

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center p-6">
      {/* 상단: 환영 메시지 + 로그아웃 */}
      <motion.div
        className="w-full max-w-lg flex items-center justify-between mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-[#333]">
            {currentUser.avatar_name}님
          </h1>
          <p className="text-sm text-[#757575]">{currentStore.store_name}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-[#757575] hover:text-red-500 transition font-medium px-3 py-2 rounded-lg hover:bg-red-50"
        >
          로그아웃
        </button>
      </motion.div>

      <div className="w-full max-w-lg space-y-4">
        {/* 훈련 시작 CTA */}
        <motion.button
          type="button"
          onClick={() => navigate('/level-select')}
          className="w-full bg-primary text-white rounded-2xl p-8 shadow-lg hover:bg-primary-dark transition cursor-pointer text-left"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="text-2xl font-bold mb-2">훈련 시작</div>
          <p className="text-white/80 text-sm">난이도를 선택하고 훈련을 시작하세요</p>
        </motion.button>

        {/* 매장 관리 */}
        <motion.div
          className="bg-white rounded-xl border border-[#E0E0E0] shadow-md overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            type="button"
            onClick={() => setShowAdmin(!showAdmin)}
            className="w-full p-5 text-left flex items-center justify-between hover:bg-gray-50 transition"
          >
            <div>
              <div className="text-lg font-bold text-[#333]">매장 관리</div>
              <p className="text-sm text-[#757575]">주방 레이아웃, 레시피, 식자재 설정</p>
            </div>
            <span className={`text-[#757575] transition-transform ${showAdmin ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {showAdmin && (
            <div className="border-t border-[#E0E0E0] p-4 space-y-2">
              <button
                type="button"
                onClick={() => navigate('/admin/kitchen')}
                className="w-full py-3 px-4 text-left rounded-lg hover:bg-primary/5 hover:text-primary transition text-[#333] font-medium"
              >
                주방 레이아웃
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/recipe')}
                className="w-full py-3 px-4 text-left rounded-lg hover:bg-primary/5 hover:text-primary transition text-[#333] font-medium"
              >
                레시피 관리
              </button>
              <button
                type="button"
                disabled
                className="w-full py-3 px-4 text-left rounded-lg text-[#BDBDBD] cursor-not-allowed font-medium"
              >
                식자재 관리 <span className="text-xs">(준비 중)</span>
              </button>
            </div>
          )}
        </motion.div>

        {/* 최근 훈련 기록 */}
        <motion.div
          className="bg-white rounded-xl border border-[#E0E0E0] shadow-md p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-bold text-[#333] mb-3">최근 훈련 기록</h2>

          {historyLoading && (
            <p className="text-[#757575] text-sm py-2">불러오는 중...</p>
          )}

          {!historyLoading && gameHistory.length === 0 && (
            <p className="text-[#757575] text-sm py-2">
              아직 훈련 기록이 없습니다. 첫 번째 훈련을 시작해보세요!
            </p>
          )}

          {!historyLoading && gameHistory.length > 0 && (
            <div className="space-y-2">
              {gameHistory.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#757575]">{item.date}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {LEVEL_LABELS[item.level as keyof typeof LEVEL_LABELS] || item.level}
                    </span>
                  </div>
                  <span className="font-bold text-[#333]">{item.totalScore}점</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

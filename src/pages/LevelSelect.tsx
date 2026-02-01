import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useGameStore } from '../stores/gameStore'
import { LEVEL_LABELS, type GameLevel } from '../types/database.types'

const LEVELS: { key: GameLevel; icon: string; desc: string }[] = [
  { key: 'BEGINNER', icon: '🔰', desc: '메뉴 1개씩 들어옴 · 천천히 연습' },
  { key: 'INTERMEDIATE', icon: '👨‍🍳', desc: '메뉴 2개씩 들어옴 · 멀티태스킹 필요' },
  { key: 'ADVANCED', icon: '⭐', desc: '메뉴 3개씩 들어옴 · 화구 3개 풀가동' },
]

export default function LevelSelect() {
  const navigate = useNavigate()
  const { currentUser, currentStore, level, setLevel, startGame, preloadStorageData } = useGameStore()
  const [isLoading, setIsLoading] = useState(false)

  // 사용자가 로그인되지 않았거나 매장이 없으면 /user-login으로 리다이렉트
  useEffect(() => {
    if (!currentUser || !currentStore) {
      navigate('/user-login', { replace: true })
    }
  }, [currentUser, currentStore, navigate])

  const handleStart = async () => {
    if (!currentStore) return
    
    setIsLoading(true)
    
    try {
      // 식자재 데이터 미리 로드
      await preloadStorageData(currentStore.id)
      
      // 게임 시작
      const session = await startGame()
      if (session) navigate('/game')
      else alert('게임 시작에 실패했습니다.')
    } catch (error) {
      console.error('게임 시작 오류:', error)
      alert('게임 시작에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!currentUser || !currentStore) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6">
      <motion.h1
        className="text-3xl font-bold text-[#333] mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        레벨을 선택하세요
      </motion.h1>

      <div className="flex flex-col gap-4 w-full max-w-md mb-8">
        {LEVELS.map(({ key, icon, desc }, i) => (
          <motion.button
            key={key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => setLevel(key)}
            disabled={isLoading}
            className={`flex items-center gap-4 py-4 px-6 rounded-xl text-left border-2 transition ${
              level === key
                ? 'bg-primary/15 border-primary text-primary-dark'
                : 'bg-white border-[#E0E0E0] text-[#333] hover:border-primary/50'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="text-3xl">{icon}</span>
            <div>
              <div className="font-semibold">{LEVEL_LABELS[key]}</div>
              <div className="text-sm text-[#757575]">{desc}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <motion.button
        whileHover={!isLoading ? { scale: 1.02 } : {}}
        whileTap={!isLoading ? { scale: 0.98 } : {}}
        onClick={handleStart}
        disabled={isLoading}
        className={`py-4 px-10 rounded-xl bg-primary text-white font-bold text-lg shadow-lg hover:bg-primary-dark ${
          isLoading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isLoading ? '식자재 데이터 로딩 중...' : '시작하기'}
      </motion.button>
    </div>
  )
}

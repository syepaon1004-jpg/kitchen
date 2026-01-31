import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../stores/gameStore'
import type { GameScore } from '../types/database.types'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}시간 ${m % 60}분`
  }
  return `${m}분 ${s}초`
}

export default function GameResult() {
  const navigate = useNavigate()
  const {
    currentUser,
    completedMenus,
    targetMenus,
    elapsedSeconds,
    actionLogs,
    burnerUsageHistory,
  } = useGameStore()

  const [scores, setScores] = useState<{
    recipeAccuracyScore: number
    speedScore: number
    burnerUsageScore: number
    totalScore: number
  } | null>(null)
  const [scoreHistory, setScoreHistory] = useState<{ game: number; totalScore: number; recipeAccuracy: number; speed: number; burnerUsage: number }[]>([])
  const [showChart, setShowChart] = useState(false)

  useEffect(() => {
    const totalActions = actionLogs.length
    const correctActions = actionLogs.filter((l) => l.isCorrect).length
    const recipeAccuracyScore =
      totalActions > 0 ? Math.round((correctActions / totalActions) * 100) : 0

    const targetTime = completedMenus * 120
    const speedScore =
      elapsedSeconds > 0
        ? Math.round(Math.min(100, Math.max(0, (targetTime / elapsedSeconds) * 100)))
        : 0

    const totalPossible = burnerUsageHistory.length * 3
    const actualBurnerSeconds = burnerUsageHistory.reduce(
      (sum, log) => sum + log.activeBurners.length,
      0
    )
    const burnerUsageScore =
      totalPossible > 0 ? Math.round((actualBurnerSeconds / totalPossible) * 100) : 0

    const totalScore = Math.round(
      recipeAccuracyScore * 0.5 + speedScore * 0.3 + burnerUsageScore * 0.2
    )

    setScores({
      recipeAccuracyScore,
      speedScore,
      burnerUsageScore,
      totalScore,
    })
  }, [actionLogs, burnerUsageHistory, completedMenus, elapsedSeconds])

  useEffect(() => {
    if (!currentUser?.id) return
    supabase
      .from('game_sessions')
      .select('id')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: true })
      .then(({ data: sessions }) => {
        const ids = (sessions ?? []).map((s: { id: string }) => s.id)
        if (ids.length === 0) {
          setScoreHistory([])
          return
        }
        return supabase
          .from('game_scores')
          .select('*')
          .in('session_id', ids)
          .order('created_at', { ascending: true })
      })
      .then((res) => {
        if (!res?.data) return
        const list = (res.data as GameScore[]).map((row, i) => ({
          game: i + 1,
          totalScore: row.total_score,
          recipeAccuracy: row.recipe_accuracy_score,
          speed: row.speed_score,
          burnerUsage: row.burner_usage_score,
        }))
        setScoreHistory(list)
      })
  }, [currentUser?.id])

  if (!scores) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-[#757575]">결과 계산 중...</p>
      </div>
    )
  }

  const bars = [
    { label: '레시피 정확도', value: scores.recipeAccuracyScore, color: 'bg-green-500' },
    { label: '속도 점수', value: scores.speedScore, color: 'bg-amber-500' },
    { label: '화구 사용율', value: scores.burnerUsageScore, color: 'bg-red-500' },
    { label: '총점', value: scores.totalScore, color: 'bg-primary' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6">
      <motion.h1
        className="text-3xl font-bold text-[#333] mb-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        게임 종료!
      </motion.h1>
      <p className="text-[#757575] mb-6">
        완료 메뉴: {completedMenus}/{targetMenus} · 총 소요 시간: {formatTime(elapsedSeconds)}
      </p>

      <motion.div
        className="w-full max-w-md bg-white rounded-xl shadow-lg border border-[#E0E0E0] p-6 mb-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        {bars.map((bar, i) => (
          <div key={bar.label} className="mb-4 last:mb-0">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[#333] font-medium">{bar.label}</span>
              <span className="font-bold text-[#333]">{bar.value}점</span>
            </div>
            <div className="h-4 bg-[#E0E0E0] rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${bar.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, bar.value)}%` }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              />
            </div>
          </div>
        ))}
      </motion.div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setShowChart(!showChart)}
          className="py-3 px-5 rounded-xl bg-white border border-[#E0E0E0] font-medium text-[#333] hover:bg-primary/10"
        >
          {showChart ? '그래프 숨기기' : '실력 상승 그래프 보기'}
        </button>
        <button
          onClick={() => navigate('/level-select')}
          className="py-3 px-5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark"
        >
          다시 하기
        </button>
        <button
          onClick={() => navigate('/')}
          className="py-3 px-5 rounded-xl bg-[#E0E0E0] text-[#333] font-medium"
        >
          홈으로
        </button>
      </div>

      {showChart && scoreHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl h-80 bg-white rounded-xl shadow border border-[#E0E0E0] p-4"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="game" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="totalScore" stroke="#FF6B35" name="총점" />
              <Line type="monotone" dataKey="recipeAccuracy" stroke="#4CAF50" name="정확도" />
              <Line type="monotone" dataKey="speed" stroke="#FFC107" name="속도" />
              <Line type="monotone" dataKey="burnerUsage" stroke="#F44336" name="화구 사용" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  )
}

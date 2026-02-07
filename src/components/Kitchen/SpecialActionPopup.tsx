import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { IngredientSpecialAction } from '../../types/database.types'
import { useSound } from '../../hooks/useSound'

interface SpecialActionPopupProps {
  action: IngredientSpecialAction
  currentIndex: number
  totalCount: number
  onComplete: (actionId: string) => void
  onCancel: () => void
}

const ACTION_ICONS: Record<string, string> = {
  MICROWAVE: '📡',
  DEFROST: '🧊',
  MARINATE: '🥩',
  SOAK: '💧',
  TORCH: '🔥',
  CUSTOM: '⚡',
}

export default function SpecialActionPopup({
  action,
  currentIndex,
  totalCount,
  onComplete,
  onCancel,
}: SpecialActionPopupProps) {
  const { playSound } = useSound()
  const [timerState, setTimerState] = useState<'IDLE' | 'RUNNING' | 'DONE'>('IDLE')
  const [elapsed, setElapsed] = useState(0)
  const [torchHeld, setTorchHeld] = useState(false)
  const [torchProgress, setTorchProgress] = useState(0)

  const durationSeconds = (action.action_params?.duration_seconds as number) ?? 10
  const needsTimer = ['MICROWAVE', 'DEFROST', 'MARINATE', 'SOAK'].includes(action.action_type)

  // 타이머 실행
  useEffect(() => {
    if (timerState !== 'RUNNING') return
    if (action.action_type === 'TORCH') return

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        if (next >= durationSeconds) {
          clearInterval(interval)
          setTimerState('DONE')
          playSound('complete')
          return durationSeconds
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerState, action.action_type, durationSeconds, playSound])

  // DONE 상태 → 0.5초 후 onComplete 자동 호출
  useEffect(() => {
    if (timerState !== 'DONE') return

    const timeout = setTimeout(() => {
      onComplete(action.id)
    }, 500)

    return () => clearTimeout(timeout)
  }, [timerState, action.id, onComplete])

  // 토치 홀드 처리
  useEffect(() => {
    if (!torchHeld || timerState !== 'RUNNING') return

    const interval = setInterval(() => {
      setTorchProgress((prev) => {
        const next = prev + 2
        if (next >= 100) {
          clearInterval(interval)
          setTimerState('DONE')
          playSound('complete')
          return 100
        }
        return next
      })
    }, 100)

    return () => clearInterval(interval)
  }, [torchHeld, timerState, playSound])

  // 시작 버튼 핸들러
  const handleStart = useCallback(() => {
    playSound('confirm')
    setTimerState('RUNNING')
    setElapsed(0)
  }, [playSound])

  // CUSTOM 완료 버튼 핸들러
  const handleCustomComplete = useCallback(() => {
    playSound('complete')
    setTimerState('DONE')
  }, [playSound])

  // 진행률 계산
  const progress = action.action_type === 'TORCH'
    ? torchProgress
    : durationSeconds > 0
      ? (elapsed / durationSeconds) * 100
      : 0

  // 시간 포맷
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}초`
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={action.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 - 진행률 표시 */}
          <div className="p-4 border-b bg-gradient-to-r from-amber-500 to-orange-500">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                ⚡ 특수 액션
              </h3>
              <span className="px-3 py-1 bg-white/20 rounded-full text-white text-sm font-medium">
                {currentIndex + 1}/{totalCount}
              </span>
            </div>
          </div>

          {/* 컨텐츠 */}
          <div className="p-6">
            {/* 아이콘 + 액션명 */}
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">
                {ACTION_ICONS[action.action_type] ?? '⚡'}
              </div>
              <h4 className="text-xl font-bold text-gray-800">
                {action.action_name}
              </h4>
            </div>

            {/* 안내 텍스트 */}
            {action.instruction && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-600 text-center">{action.instruction}</p>
              </div>
            )}

            {/* 상태별 컨텐츠 */}
            {timerState === 'IDLE' && (
              <div className="space-y-4">
                {/* 소요 시간 표시 */}
                {needsTimer && durationSeconds > 0 && (
                  <div className="text-center">
                    <span className="text-2xl font-bold text-orange-600">
                      {formatTime(durationSeconds)}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">소요</span>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                  >
                    취소
                  </button>
                  {action.action_type === 'CUSTOM' ? (
                    <button
                      type="button"
                      onClick={handleCustomComplete}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-colors shadow-lg"
                    >
                      ✓ 완료
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStart}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-amber-600 hover:to-orange-600 transition-colors shadow-lg"
                    >
                      ▶ 시작
                    </button>
                  )}
                </div>
              </div>
            )}

            {timerState === 'RUNNING' && (
              <div className="space-y-4">
                {/* 프로그레스 바 */}
                {action.action_type !== 'TORCH' && (
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="text-center text-gray-600 font-medium">
                      {elapsed}/{durationSeconds}초
                    </div>
                  </div>
                )}

                {/* 토치 홀드 버튼 */}
                {action.action_type === 'TORCH' && (
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${torchProgress}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    <button
                      type="button"
                      onMouseDown={() => setTorchHeld(true)}
                      onMouseUp={() => setTorchHeld(false)}
                      onMouseLeave={() => setTorchHeld(false)}
                      onTouchStart={() => setTorchHeld(true)}
                      onTouchEnd={() => setTorchHeld(false)}
                      className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all ${
                        torchHeld
                          ? 'bg-gradient-to-r from-red-600 to-orange-600 scale-95'
                          : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                      }`}
                    >
                      {torchHeld ? '🔥 토치 중...' : '🔥 길게 누르세요'}
                    </button>
                  </div>
                )}

                {/* 진행 중 메시지 */}
                {action.action_type !== 'TORCH' && (
                  <p className="text-center text-gray-500 text-sm animate-pulse">
                    {action.action_type === 'MICROWAVE' && '📡 전자레인지 작동 중...'}
                    {action.action_type === 'DEFROST' && '🧊 해동 중...'}
                    {action.action_type === 'MARINATE' && '🥩 재우는 중...'}
                    {action.action_type === 'SOAK' && '💧 불리는 중...'}
                  </p>
                )}
              </div>
            )}

            {timerState === 'DONE' && (
              <div className="text-center py-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="text-6xl mb-3"
                >
                  ✅
                </motion.div>
                <p className="text-lg font-bold text-green-600">완료!</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

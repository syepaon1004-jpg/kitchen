import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { EquipmentComponentProps } from '../PlaceholderEquipment'
import type { BundleInstance } from '../../../types/database.types'

/**
 * 전자레인지 장비 컴포넌트
 * v3.1 Complete: BundleInstance 기반 완전 전환
 */
export default function MicrowaveEquipment({
  displayName,
}: EquipmentComponentProps) {
  const [showPopup, setShowPopup] = useState(false)
  const {
    getMicrowaveBundles,
    completeBundle,
    discardBundle,
  } = useGameStore()

  // v3.1: BundleInstance 기반 데이터
  const microwaveBundles = getMicrowaveBundles()
  const currentBundle = microwaveBundles[0]
  const waitingBundles = microwaveBundles.slice(1)

  // 상태 판별 (BundleInstance 기반)
  const timerSeconds = currentBundle?.cooking.timerSeconds ?? 0
  const elapsedSeconds = currentBundle?.cooking.elapsedSeconds ?? 0
  const isEmpty = microwaveBundles.length === 0
  const isCooking = currentBundle && elapsedSeconds < timerSeconds
  const isDone = currentBundle && elapsedSeconds >= timerSeconds

  // 완료 시 깜빡임 효과
  const [blinkDone, setBlinkDone] = useState(false)
  useEffect(() => {
    if (isDone) {
      const interval = setInterval(() => setBlinkDone((p) => !p), 500)
      return () => clearInterval(interval)
    }
    setBlinkDone(false)
  }, [isDone])

  // 진행률 계산
  const getProgress = () => {
    if (!currentBundle || timerSeconds === 0) return 0
    return Math.min(100, (elapsedSeconds / timerSeconds) * 100)
  }

  // 남은 시간 포맷
  const formatRemaining = () => {
    if (!currentBundle) return '0:00'
    const remaining = Math.max(0, timerSeconds - elapsedSeconds)
    const min = Math.floor(remaining / 60)
    const sec = remaining % 60
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}초`
  }

  // 파워 레벨 텍스트
  const getPowerText = (power?: string) => {
    switch (power) {
      case 'LOW': return '약'
      case 'MEDIUM': return '중'
      case 'HIGH': return '강'
      default: return '-'
    }
  }

  // 파워 레벨 이모지
  const getPowerEmoji = (power?: string) => {
    switch (power) {
      case 'LOW': return '🔥'
      case 'MEDIUM': return '🔥🔥'
      case 'HIGH': return '🔥🔥🔥'
      default: return '🔥'
    }
  }

  // 재료 이름 포맷 (BundleInstance 기반)
  const formatIngredientNames = (bundle: BundleInstance) => {
    if (bundle.ingredients?.length > 0) {
      return bundle.ingredients.map((i) => `${i.name} ${i.amount}${i.unit}`).join(', ')
    }
    return bundle.menuName
  }

  // 짧은 재료 이름 (헤더용)
  const formatShortIngredientNames = (bundle: BundleInstance) => {
    if (bundle.ingredients?.length > 0) {
      if (bundle.ingredients.length === 1) {
        const i = bundle.ingredients[0]
        return `${i.name} ${i.amount}${i.unit}`
      }
      return `${bundle.ingredients[0].name} 외 ${bundle.ingredients.length - 1}개`
    }
    return bundle.menuName
  }

  // 꺼내기 처리 - v3.1: completeBundle 사용 + instanceId 기반 PlateSelectPopup
  const handleTakeOut = () => {
    if (!currentBundle) return

    // v3.1 Fix: completeBundle은 BundleInstance | null 반환
    const completedInstance = completeBundle(currentBundle.id)
    if (completedInstance) {
      console.log(`📡 전자레인지 꺼내기: ${currentBundle.menuName} → PlateSelectPopup 열기`)

      // v3.1: instanceId 기반 PlateSelectPopup 이벤트 발생
      const event = new CustomEvent('openPlateSelectPopup', {
        detail: {
          instanceId: currentBundle.id,
        },
      })
      window.dispatchEvent(event)

      setShowPopup(false)
    } else {
      console.warn(`📡 꺼내기 실패: 인스턴스를 찾을 수 없습니다`)
    }
  }

  // 취소 처리 - discardBundle로 완전 제거 (주문은 WAITING으로 복귀)
  const handleCancel = () => {
    if (!currentBundle) return
    discardBundle(currentBundle.id)
  }

  return (
    <>
      {/* 메인 장비 버튼 - 전자레인지 실제 모양 */}
      <div
        onClick={() => setShowPopup(true)}
        className={`w-full h-full rounded-lg overflow-hidden
                    flex flex-col cursor-pointer transition-all duration-200
                    ${isDone
                      ? (blinkDone ? 'bg-green-50 border border-green-400 shadow-md' : 'bg-white border border-green-400 shadow-md')
                      : isCooking
                        ? 'bg-white border border-yellow-300 shadow-md'
                        : 'bg-white border border-gray-200 shadow-sm hover:border-gray-300'}`}
      >
        {/* 상단: 전자레인지 이름 + 아이콘 */}
        <div className="flex items-center justify-center gap-1 py-1 bg-indigo-50 border-b border-gray-100">
          <span className="text-lg">📡</span>
          <span className="text-xs text-gray-600 font-medium">{displayName}</span>
        </div>

        {/* 중앙: 타이머 또는 상태 */}
        <div className="flex-1 flex items-center justify-center relative">
          {/* 조리 중 내부 조명 효과 */}
          {isCooking && (
            <div className="absolute inset-0 bg-yellow-400/10 animate-pulse" />
          )}

          {isCooking && currentBundle ? (
            <div className="text-center z-10">
              <div className="text-xl font-mono font-bold text-gray-800">
                {formatRemaining()}
              </div>
              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1 mx-auto">
                <div
                  className="h-full bg-yellow-400 transition-all duration-1000"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {getPowerText(currentBundle.cooking.powerLevel)}
              </div>
            </div>
          ) : isDone ? (
            <div className="text-center animate-bounce">
              <div className="text-2xl">✅</div>
              <div className="text-xs text-green-600 font-bold">완료!</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-2xl opacity-50">🍽️</div>
              <div className="text-xs text-gray-400">대기중</div>
            </div>
          )}
        </div>

        {/* 하단: 상태 표시 */}
        <div className={`py-1.5 text-center text-xs font-medium ${
          isDone ? 'bg-green-50 border-t border-green-200 text-green-700' :
          isCooking ? 'bg-indigo-50 border-t border-gray-100 text-yellow-600' :
          'bg-indigo-50 border-t border-gray-100 text-gray-500'
        }`}>
          {isDone ? '꺼내세요!' : isCooking ? '조리중...' : '비어있음'}
        </div>
      </div>

      {/* 팝업 - Portal로 document.body에 렌더링 */}
      {createPortal(
        <AnimatePresence>
          {showPopup && (
            <>
              {/* 배경 오버레이 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-[9998]"
                onClick={() => setShowPopup(false)}
              />

              {/* 팝업 컨테이너 - 뷰포트 정중앙 */}
              <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-[calc(100vw-2rem)] max-w-md max-h-[80vh] overflow-hidden
                             bg-white
                             rounded-2xl shadow-2xl pointer-events-auto flex flex-col"
                >
                  {/* 헤더 */}
                  <div className="flex flex-col border-b border-gray-200 bg-gray-700 rounded-t-2xl">
                    {/* 상단: 제목 + 닫기 버튼 */}
                    <div className="flex items-center justify-between p-4 pb-2">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">📡</span>
                        전자레인지
                      </h3>
                      <button
                        onClick={() => setShowPopup(false)}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30
                                   flex items-center justify-center text-white font-bold"
                      >
                        ✕
                      </button>
                    </div>
                    {/* 하단: 조리중/대기열 정보 */}
                    <div className="px-4 pb-3 text-sm">
                      {currentBundle ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isDone ? 'bg-green-500 text-white' : 'bg-yellow-500 text-yellow-900'
                          }`}>
                            {isDone ? '완료' : '조리중'}
                          </span>
                          <span className="font-medium text-white">{formatShortIngredientNames(currentBundle)}</span>
                        </div>
                      ) : (
                        <div className="text-gray-300 text-xs">현재 조리 중인 재료 없음</div>
                      )}
                      {waitingBundles.length > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-300">
                          <span className="text-gray-400">대기:</span>
                          {waitingBundles.slice(0, 3).map((bundle) => (
                            <span key={bundle.id} className="px-1.5 py-0.5 bg-white/20 rounded">
                              {formatShortIngredientNames(bundle)}
                            </span>
                          ))}
                          {waitingBundles.length > 3 && (
                            <span className="text-gray-400">+{waitingBundles.length - 3}개</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 현재 상태 */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {isEmpty ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="text-5xl mb-3 opacity-50">📡</div>
                        <div className="font-bold text-lg text-gray-700">전자레인지가 비어있습니다</div>
                        <div className="text-sm mt-2 text-gray-500">
                          냉동고/냉장고에서 재료를 선택 후<br />
                          전자레인지 모드를 선택하세요
                        </div>
                      </div>
                    ) : currentBundle && (
                      <div className={`p-4 rounded-xl border transition-all ${
                        isDone
                          ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400 shadow-lg'
                          : 'bg-indigo-50 border-gray-200'
                      }`}>
                        {/* 재료 정보 */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">
                              {isDone ? '✅' : '🔄'}
                            </span>
                            <div>
                              <div className="font-bold text-lg text-gray-800">{formatIngredientNames(currentBundle)}</div>
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                {getPowerEmoji(currentBundle.cooking.powerLevel)} 파워: {getPowerText(currentBundle.cooking.powerLevel)}
                              </div>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            isDone
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-500 text-white animate-pulse'
                          }`}>
                            {isDone ? '완료!' : '조리중'}
                          </span>
                        </div>

                        {/* 진행 바 */}
                        <div className="mb-4">
                          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ${
                                isDone ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-gray-400 to-gray-600'
                              }`}
                              style={{ width: `${isDone ? 100 : getProgress()}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-600 mt-2 font-mono">
                            <span>{elapsedSeconds}초 경과</span>
                            <span className="font-bold text-lg text-gray-800">
                              {formatRemaining()}
                            </span>
                            <span>{timerSeconds}초 목표</span>
                          </div>
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex gap-2">
                          {isDone ? (
                            <button
                              onClick={handleTakeOut}
                              className="flex-1 py-3 px-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500
                                         hover:from-green-600 hover:to-emerald-600
                                         text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
                            >
                              <span className="text-lg">✅</span> 꺼내기
                            </button>
                          ) : (
                            <button
                              onClick={handleCancel}
                              className="py-2 px-4 rounded-lg bg-red-400 hover:bg-red-500
                                         text-white font-bold text-sm shadow-md"
                            >
                              🗑️ 비우기
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 대기열 */}
                    {waitingBundles.length > 0 && (
                      <div className="mt-4">
                        <div className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <span>📋</span> 대기열 ({waitingBundles.length})
                        </div>
                        <div className="space-y-2">
                          {waitingBundles.map((bundle, idx) => (
                            <div
                              key={bundle.id}
                              className="p-3 bg-indigo-50 rounded-lg border border-gray-200 flex items-center gap-3"
                            >
                              <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <div className="font-medium text-gray-700">{formatIngredientNames(bundle)}</div>
                                <div className="text-xs text-gray-500">
                                  {bundle.cooking.timerSeconds ?? 0}초 · {getPowerText(bundle.cooking.powerLevel)}
                                </div>
                              </div>
                              <button
                                onClick={() => discardBundle(bundle.id)}
                                className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold transition-colors"
                              >
                                비우기
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

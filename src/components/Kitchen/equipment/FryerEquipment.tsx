import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { EquipmentComponentProps } from '../PlaceholderEquipment'
import type { BundleInstance } from '../../../types/database.types'

/**
 * 튀김기 장비 컴포넌트
 * v3.3 리팩토링: isSubmerged 기반 물리 모델
 * - 바스켓 올리기/내리기는 물리 조작 (레시피 스텝 아님)
 * - DEEP_FRY 스텝은 타이머 완료 시 tickBundleTimers에서 자동 진행
 */
export default function FryerEquipment({
  displayName,
}: EquipmentComponentProps) {
  const [showPopup, setShowPopup] = useState(false)
  const {
    fryerState, // 물리 상태: isSubmerged, status (EMPTY|ASSIGNED|BURNED)
    getFryerBundle,
    completeBundle,
    // v3.3 리팩토링: 올리기/내리기 (장비 물리만)
    lowerBundle,
    liftBundle,
    discardBundle,
    // v3.3: executeAction 제거 - 올리기/내리기는 레시피 스텝이 아님
    getRecipeSteps,
    getRecipeByMenuName,
  } = useGameStore()

  // v3.1: BundleInstance 기반 데이터
  const bundle1 = getFryerBundle(1)
  const bundle2 = getFryerBundle(2)
  const bundle3 = getFryerBundle(3)

  // 물리적 바스켓 상태
  const physicalBasket1 = fryerState.baskets.find((b) => b.basketNumber === 1)
  const physicalBasket2 = fryerState.baskets.find((b) => b.basketNumber === 2)
  const physicalBasket3 = fryerState.baskets.find((b) => b.basketNumber === 3)

  // v3.3: 바스켓 상태 도출 (isSubmerged 기반)
  // 상태: EMPTY | ASSIGNED | FRYING | BURNED | LIFTED (올라와있음)
  const deriveBasketStatus = (bundle: BundleInstance | undefined, basket: typeof physicalBasket1): string => {
    // 물리적 상태 우선 (BURNED)
    if (basket?.status === 'BURNED') {
      return 'BURNED'
    }

    if (!bundle) return 'EMPTY'

    // isSubmerged 기반 상태 판정
    if (basket?.isSubmerged) {
      // 기름에 잠겨있음 = 튀기는 중
      return 'FRYING'
    }

    // 올라와있음 = LIFTED (다음 액션 대기)
    return 'LIFTED'
  }

  const status1 = deriveBasketStatus(bundle1, physicalBasket1)
  const status2 = deriveBasketStatus(bundle2, physicalBasket2)
  const status3 = deriveBasketStatus(bundle3, physicalBasket3)

  // 튀김 진행 중인 바스켓 찾기
  const fryingBundle = status1 === 'FRYING' ? bundle1 : status2 === 'FRYING' ? bundle2 : status3 === 'FRYING' ? bundle3 : undefined
  const burnedStatus = status1 === 'BURNED' || status2 === 'BURNED' || status3 === 'BURNED'

  // v3.3: 완료된 번들 찾기 (LIFTED 상태 + 모든 스텝 완료)
  const findDoneBundle = () => {
    if (status1 === 'LIFTED' && bundle1 && bundle1.cooking.currentStep >= bundle1.cooking.totalSteps) return bundle1
    if (status2 === 'LIFTED' && bundle2 && bundle2.cooking.currentStep >= bundle2.cooking.totalSteps) return bundle2
    if (status3 === 'LIFTED' && bundle3 && bundle3.cooking.currentStep >= bundle3.cooking.totalSteps) return bundle3
    return undefined
  }
  const doneBundle = findDoneBundle()

  // 완료 시 깜빡임 효과
  const [blinkDone, setBlinkDone] = useState(false)
  useEffect(() => {
    if (doneBundle) {
      const interval = setInterval(() => setBlinkDone((p) => !p), 500)
      return () => clearInterval(interval)
    }
    setBlinkDone(false)
  }, [doneBundle])

  // v3.3: 현재 스텝 정보 가져오기 (UI 표시용)
  const getCurrentStepInfo = (bundle: BundleInstance) => {
    const recipe = getRecipeByMenuName(bundle.menuName)
    const steps = getRecipeSteps(recipe, bundle.bundleId)
    const currentStep = steps[bundle.cooking.currentStep]
    return {
      stepType: currentStep?.step_type ?? null,
      actionType: currentStep?.action_type ?? null,
      isComplete: bundle.cooking.currentStep >= bundle.cooking.totalSteps,
    }
  }

  // 활성 바스켓 수
  const activeBaskets = (bundle1 ? 1 : 0) + (bundle2 ? 1 : 0) + (bundle3 ? 1 : 0)

  // v3.3: 바스켓 상태별 색상 (isSubmerged 기반 단순화)
  const getBasketStatusColor = (status: string, bundle?: BundleInstance) => {
    switch (status) {
      case 'EMPTY': return 'bg-gray-300'
      case 'FRYING': return 'bg-amber-500 animate-pulse'
      case 'LIFTED': {
        // 올라와있을 때: 현재 스텝에 따라 색상 결정
        if (!bundle) return 'bg-green-300'
        const { isComplete, stepType, actionType } = getCurrentStepInfo(bundle)
        if (isComplete) return 'bg-blue-400' // 완료 → 접시에 담기
        if (stepType === 'ACTION' && actionType === 'DEEP_FRY') return 'bg-cyan-400' // 내리기 대기
        return 'bg-green-300' // 재료 투입 대기
      }
      case 'BURNED': return 'bg-red-600 animate-pulse'
      default: return 'bg-gray-300'
    }
  }

  // v3.3: 바스켓 상태 텍스트 (현재 스텝 기반)
  const getBasketStatusText = (status: string, bundle?: BundleInstance) => {
    switch (status) {
      case 'EMPTY': return '비어있음'
      case 'FRYING': return '튀기는중'
      case 'LIFTED': {
        if (!bundle) return '올라와있음'
        const { isComplete, stepType, actionType } = getCurrentStepInfo(bundle)
        if (isComplete) return '완료!'
        if (stepType === 'ACTION' && actionType === 'DEEP_FRY') return '내리기 대기'
        return '재료 대기'
      }
      case 'BURNED': return '타버림!'
      default: return status
    }
  }

  // 진행률 계산 (BundleInstance 기반)
  const getProgress = (bundle: BundleInstance) => {
    const timer = bundle.cooking.timerSeconds ?? 0
    const elapsed = bundle.cooking.elapsedSeconds ?? 0
    if (timer === 0) return 0
    return Math.min(100, (elapsed / timer) * 100)
  }

  // 남은 시간 포맷
  const formatRemainingTime = (bundle: BundleInstance) => {
    const timer = bundle.cooking.timerSeconds ?? 0
    const elapsed = bundle.cooking.elapsedSeconds ?? 0
    const remaining = Math.max(0, timer - elapsed)
    const min = Math.floor(remaining / 60)
    const sec = remaining % 60
    return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}초`
  }

  // 묶음 완성 여부 확인 (BundleInstance 기반)
  const isBundleComplete = (bundle: BundleInstance, status: string) => {
    if (status !== 'LIFTED') return false
    return bundle.cooking.currentStep >= bundle.cooking.totalSteps
  }

  // 접시 선택 팝업 열기 - v3.1: instanceId 기반
  const handlePlateSelect = (bundle: BundleInstance) => {
    // completeBundle 호출 → PLATE_SELECT로 이동 (BundleInstance | null 반환)
    const completedInstance = completeBundle(bundle.id)
    if (completedInstance) {
      console.log(`🍟 튀김기 꺼내기: ${bundle.menuName} → PlateSelectPopup 열기`)

      // v3.1: instanceId 기반 PlateSelectPopup 이벤트 발생
      const event = new CustomEvent('openPlateSelectPopup', {
        detail: {
          instanceId: bundle.id,
        },
      })
      window.dispatchEvent(event)

      setShowPopup(false)
    } else {
      console.warn(`🍟 꺼내기 실패: 인스턴스를 찾을 수 없습니다`)
    }
  }

  // 바스켓별 데이터 구성
  const baskets = [
    { number: 1, bundle: bundle1, status: status1 },
    { number: 2, bundle: bundle2, status: status2 },
    { number: 3, bundle: bundle3, status: status3 },
  ]

  return (
    <>
      {/* 메인 장비 버튼 - 튀김기 실제 모양 */}
      <div
        onClick={() => setShowPopup(true)}
        className={`w-full h-full rounded-lg border-2 overflow-hidden
                    flex flex-col cursor-pointer transition-all duration-200
                    ${burnedStatus
                      ? 'bg-red-800 border-red-500 shadow-lg shadow-red-500/50 animate-pulse'
                      : doneBundle
                        ? (blinkDone ? 'bg-green-600 border-green-400' : 'bg-green-700 border-green-500')
                        : fryingBundle
                          ? 'bg-amber-800 border-amber-500 shadow-lg shadow-amber-500/30'
                          : 'bg-amber-900/80 border-amber-700 hover:border-amber-400'}`}
      >
        {/* 상단: 튀김기 이름 + 아이콘 */}
        <div className="flex items-center justify-center gap-1 py-1 bg-amber-950/50">
          <span className="text-lg">🍟</span>
          <span className="text-xs text-amber-200 font-medium">{displayName}</span>
        </div>

        {/* 중앙: 타이머 또는 상태 */}
        <div className="flex-1 flex items-center justify-center">
          {burnedStatus ? (
            <div className="text-center animate-bounce">
              <div className="text-2xl">🔥💀</div>
              <div className="text-xs text-red-100 font-bold">타버림!</div>
            </div>
          ) : fryingBundle ? (
            <div className="text-center">
              <div className="text-xl font-mono font-bold text-amber-100">
                {formatRemainingTime(fryingBundle)}
              </div>
              <div className="w-12 h-1.5 bg-amber-900 rounded-full overflow-hidden mt-1 mx-auto">
                <div
                  className="h-full bg-amber-400 transition-all duration-1000"
                  style={{ width: `${getProgress(fryingBundle)}%` }}
                />
              </div>
            </div>
          ) : doneBundle ? (
            <div className="text-center animate-pulse">
              <div className="text-2xl">✅</div>
              <div className="text-xs text-green-100 font-bold">완료!</div>
            </div>
          ) : activeBaskets > 0 ? (
            <div className="text-center">
              <div className="text-2xl">🧺</div>
              <div className="text-xs text-amber-200">{activeBaskets}개 활성</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-2xl opacity-50">🍳</div>
              <div className="text-xs text-amber-300/60">대기중</div>
            </div>
          )}
        </div>

        {/* 하단: 바스켓 인디케이터 */}
        <div className="flex justify-center gap-1 py-1.5 bg-amber-950/30">
          {baskets.map((b) => (
            <div
              key={b.number}
              className={`w-3 h-3 rounded-full border border-amber-400/50 ${getBasketStatusColor(b.status, b.bundle)}`}
              title={`바스켓 ${b.number}: ${getBasketStatusText(b.status, b.bundle)}`}
            />
          ))}
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
                  className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-hidden
                             bg-gradient-to-br from-amber-100 to-amber-200
                             rounded-xl shadow-2xl border-4 border-amber-500 pointer-events-auto flex flex-col"
                >
                  {/* 헤더 */}
                  <div className="flex items-center justify-between p-4 border-b border-amber-300 bg-gradient-to-r from-amber-600 to-orange-600">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="text-2xl">🍟</span>
                      튀김기
                    </h3>
                    <button
                      onClick={() => setShowPopup(false)}
                      className="w-8 h-8 rounded-full bg-amber-400/30 hover:bg-amber-400/50
                                 flex items-center justify-center text-white font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 기름 온도 (물리 상태) */}
                  <div className="p-3 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <span>🌡️</span> 기름 온도
                      </span>
                      <span className={`font-bold ${
                        fryerState.oilTemperature >= 180
                          ? 'text-green-600'
                          : fryerState.oilTemperature >= 160
                            ? 'text-amber-600'
                            : 'text-red-600'
                      }`}>
                        {fryerState.oilTemperature}°C
                        {fryerState.oilTemperature >= 180 && ' ✅'}
                        {fryerState.oilTemperature >= 160 && fryerState.oilTemperature < 180 && ' ⚠️ 예열중'}
                        {fryerState.oilTemperature < 160 && ' ❄️ 차가움'}
                      </span>
                    </div>
                  </div>

                  {/* 바스켓 목록 */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {baskets.map(({ number, bundle, status }) => {
                      const isComplete = bundle ? isBundleComplete(bundle, status) : false
                      const currentStep = bundle?.cooking.currentStep ?? 0
                      const totalSteps = bundle?.cooking.totalSteps ?? 0
                      const elapsedSec = bundle?.cooking.elapsedSeconds ?? 0
                      // timerSeconds는 BundleInstance.cooking에서 직접 사용

                      return (
                        <div
                          key={number}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            status === 'EMPTY'
                              ? 'bg-gray-50 border-gray-200'
                              : status === 'BURNED'
                                ? 'bg-gradient-to-r from-red-100 to-red-200 border-red-500 shadow-lg'
                                : status === 'FRYING'
                                  ? 'bg-gradient-to-r from-amber-100 to-orange-100 border-amber-400 shadow-lg'
                                  : status === 'LIFTED' && isComplete
                                    ? 'bg-gradient-to-r from-blue-100 to-cyan-100 border-blue-400'
                                    : 'bg-green-50 border-green-300'
                          }`}
                        >
                          {/* v3.3: 바스켓 헤더 (isSubmerged 기반) */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">
                                {status === 'EMPTY' ? '🧺' :
                                 status === 'BURNED' ? '🔥💀' :
                                 status === 'FRYING' ? '🔥' :
                                 bundle && getCurrentStepInfo(bundle).isComplete ? '🎉' : '⬆️'}
                              </span>
                              <span className="font-bold text-gray-800">
                                바스켓 {number}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getBasketStatusColor(status, bundle)
                                .replace('animate-pulse', '')
                                .replace('animate-bounce', '')} ${
                                status === 'FRYING' || status === 'BURNED' ? 'text-white' : 'text-gray-800'
                              }`}>
                                {getBasketStatusText(status, bundle)}
                              </span>
                            </div>
                          </div>

                          {/* 메뉴 정보 (BundleInstance 기반) */}
                          {bundle && (
                            <div className="text-sm text-gray-700 mb-3 flex items-center gap-2">
                              <span className="font-bold text-gray-900">{bundle.menuName}</span>
                              <span className="text-gray-500 text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                                스텝 {currentStep + 1}/{totalSteps}
                              </span>
                            </div>
                          )}

                          {/* 진행 바 (FRYING 상태일 때) */}
                          {status === 'FRYING' && bundle && (
                            <div className="mb-3">
                              <div className="h-3 bg-amber-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                                  style={{ width: `${getProgress(bundle)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-amber-700 mt-1 font-mono">
                                <span>{elapsedSec}초 경과</span>
                                <span className="font-bold">{formatRemainingTime(bundle)} 남음</span>
                              </div>
                            </div>
                          )}

                          {/* v3.3: 액션 버튼 (isSubmerged 기반 단순화) */}
                          <div className="flex gap-2">
                            {/* BURNED 상태: 폐기만 가능 */}
                            {status === 'BURNED' && bundle && (
                              <>
                                <div className="flex-1 py-2.5 px-3 rounded-lg bg-red-100 border-2 border-red-300
                                                text-red-700 text-sm text-center font-bold">
                                  재료가 타버렸습니다! 폐기 후 다시 시작하세요.
                                </div>
                                <button
                                  onClick={() => discardBundle(bundle.id)}
                                  className="py-2.5 px-4 rounded-lg bg-red-500 hover:bg-red-600
                                             text-white font-bold text-sm shadow-md flex items-center gap-1"
                                >
                                  <span>🗑️</span> 폐기
                                </button>
                              </>
                            )}

                            {/* FRYING 상태: 올리기 버튼 */}
                            {status === 'FRYING' && bundle && (
                              <>
                                <button
                                  onClick={() => liftBundle(bundle.id)}
                                  className="flex-1 py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500
                                             hover:from-cyan-600 hover:to-blue-600
                                             text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
                                >
                                  <span>⬆️</span> 올리기 ({formatRemainingTime(bundle)} 남음)
                                </button>
                                <button
                                  onClick={() => discardBundle(bundle.id)}
                                  className="py-2.5 px-3 rounded-lg bg-red-400/70 hover:bg-red-500
                                             text-white font-bold text-xs shadow-md opacity-70"
                                  title="취소"
                                >
                                  🗑️
                                </button>
                              </>
                            )}

                            {/* LIFTED 상태: 현재 스텝에 따라 다른 버튼 */}
                            {status === 'LIFTED' && bundle && (() => {
                              const stepInfo = getCurrentStepInfo(bundle)

                              // 모든 스텝 완료 → 접시 선택
                              if (stepInfo.isComplete) {
                                return (
                                  <>
                                    <button
                                      onClick={() => handlePlateSelect(bundle)}
                                      className="flex-1 py-2.5 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500
                                                 hover:from-blue-600 hover:to-cyan-600
                                                 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
                                    >
                                      <span>🍽️</span> 접시에 담기
                                    </button>
                                    <button
                                      onClick={() => discardBundle(bundle.id)}
                                      className="py-2.5 px-3 rounded-lg bg-red-400 hover:bg-red-500
                                                 text-white font-bold text-sm shadow-md"
                                      title="폐기"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )
                              }

                              // 현재 스텝이 DEEP_FRY → 내리기 버튼
                              if (stepInfo.stepType === 'ACTION' && stepInfo.actionType === 'DEEP_FRY') {
                                return (
                                  <>
                                    <button
                                      onClick={() => lowerBundle(bundle.id)}
                                      className="flex-1 py-2.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500
                                                 hover:from-amber-600 hover:to-orange-600
                                                 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
                                    >
                                      <span>⬇️</span> 기름에 내리기
                                    </button>
                                    <button
                                      onClick={() => discardBundle(bundle.id)}
                                      className="py-2.5 px-3 rounded-lg bg-gray-400 hover:bg-gray-500
                                                 text-white font-bold text-sm shadow-md"
                                      title="취소"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )
                              }

                              // 현재 스텝이 INGREDIENT → 재료 투입 대기
                              if (stepInfo.stepType === 'INGREDIENT') {
                                return (
                                  <>
                                    <div className="flex-1 py-2.5 px-3 rounded-lg bg-green-100 border-2 border-green-300
                                                    text-green-700 text-sm text-center font-medium">
                                      📦 재료를 투입하세요
                                    </div>
                                    <button
                                      onClick={() => discardBundle(bundle.id)}
                                      className="py-2.5 px-3 rounded-lg bg-red-400 hover:bg-red-500
                                                 text-white font-bold text-sm shadow-md"
                                      title="폐기"
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )
                              }

                              // 기타 상태 → 폐기만 가능
                              return (
                                <button
                                  onClick={() => discardBundle(bundle.id)}
                                  className="py-2 px-3 rounded-lg bg-gray-400 hover:bg-gray-500
                                             text-white font-bold text-xs shadow-md"
                                >
                                  🗑️ 취소
                                </button>
                              )
                            })()}
                          </div>
                        </div>
                      )
                    })}
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

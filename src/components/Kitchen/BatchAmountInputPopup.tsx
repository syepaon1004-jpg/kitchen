import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useSound } from '../../hooks/useSound'

interface SelectedIngredient {
  id: string
  name: string
  sku: string
  standardAmount: number
  standardUnit: string
  raw: any
}

// v3.1: 웍 또는 튀김기 바스켓 투입 지원
type TargetType = 'wok' | 'fryer'

interface BatchAmountInputPopupProps {
  ingredients: SelectedIngredient[]
  targetType?: TargetType  // v3.1: 기본값 'wok'
  onConfirm: (assignments: Array<{ sku: string; burnerNumber: number; amount: number; raw: any }>) => void
  onConfirmFryer?: (assignments: Array<{ sku: string; basketNumber: number; amount: number; raw: any; timerSeconds: number }>) => void  // v3.1: 튀김기용 (타이머 포함)
  onCancel: () => void
}

export default function BatchAmountInputPopup({
  ingredients,
  targetType = 'wok',
  onConfirm,
  onConfirmFryer,
  onCancel,
}: BatchAmountInputPopupProps) {
  const woks = useGameStore((s) => s.woks)
  const fryerState = useGameStore((s) => s.fryerState)
  const getFryerBundle = useGameStore((s) => s.getFryerBundle)
  const recipeBundles = useGameStore((s) => s.recipeBundles)

  // v3.3: 대상에 따라 필터링
  const woksWithMenu = woks.filter((w) => w.currentMenu)
  // 배정된 바스켓 중 기름에 잠겨있지 않은 바스켓만 (재료 투입 가능 상태)
  const activeFryerBaskets = fryerState.baskets.filter(
    (b) => b.orderId && b.status === 'ASSIGNED' && !b.isSubmerged
  )

  // v3.1: 대상 목록 (웍 또는 바스켓)
  const targets = targetType === 'wok'
    ? woksWithMenu.map((w) => ({ id: w.burnerNumber, label: `화구 ${w.burnerNumber}`, menuName: w.currentMenu }))
    : activeFryerBaskets.map((b) => ({ id: b.basketNumber, label: `바스켓 ${b.basketNumber}`, menuName: b.menuName }))
  const { playSound } = useSound()

  // 각 식재료별 대상별 입력값: { ingredientId: { targetId: amount } }
  const [amounts, setAmounts] = useState<Record<string, Record<number, number>>>(() => {
    const initial: Record<string, Record<number, number>> = {}
    ingredients.forEach((ing) => {
      initial[ing.id] = {}
      targets.forEach((target) => {
        initial[ing.id][target.id] = 0
      })
    })
    return initial
  })

  // v3.1: 튀김기 바스켓별 타이머 (초) - 레시피의 required_duration 사용
  const [basketTimers, setBasketTimers] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {}
    if (targetType === 'fryer') {
      activeFryerBaskets.forEach((b) => {
        // v3.1 Fix: BundleInstance에서 레시피의 required_duration 가져오기
        const bundle = getFryerBundle(b.basketNumber)
        let defaultTimer = 180 // fallback

        if (bundle) {
          const recipeBundle = recipeBundles.find((rb) => rb.id === bundle.bundleId)
          const deepFryStep = recipeBundle?.recipe_steps?.find(
            (step: any) => step.step_type === 'ACTION' && step.action_type === 'DEEP_FRY'
          )
          const requiredDuration = (deepFryStep?.action_params as any)?.required_duration
          if (requiredDuration !== undefined) {
            defaultTimer = requiredDuration
          }
        }

        initial[b.basketNumber] = defaultTimer
      })
    }
    return initial
  })

  // input refs (모든 input 관리)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // 첫 input에 자동 포커스
  useEffect(() => {
    const firstKey = getInputKey(ingredients[0]?.id, targets[0]?.id)
    if (firstKey && inputRefs.current[firstKey]) {
      inputRefs.current[firstKey]?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getInputKey = (ingredientId: string | undefined, targetId: number | undefined) => {
    if (!ingredientId || targetId === undefined) return null
    return `${ingredientId}-${targetId}`
  }

  // ESC 키로 닫기, Enter 키로 제출
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleAmountChange = (ingredientId: string, targetId: number, value: string) => {
    const num = parseInt(value) || 0
    setAmounts((prev) => ({
      ...prev,
      [ingredientId]: {
        ...prev[ingredientId],
        [targetId]: num,
      },
    }))
  }

  const handleQuickFill = (ingredientId: string, targetId: number, standardAmount: number) => {
    playSound('add')
    setAmounts((prev) => ({
      ...prev,
      [ingredientId]: {
        ...prev[ingredientId],
        [targetId]: standardAmount,
      },
    }))
  }

  const handleConfirm = () => {
    if (targetType === 'fryer' && onConfirmFryer) {
      // v3.1: 튀김기용 (타이머 포함)
      const assignments: Array<{ sku: string; basketNumber: number; amount: number; raw: any; timerSeconds: number }> = []

      ingredients.forEach((ing) => {
        Object.entries(amounts[ing.id] || {}).forEach(([targetStr, amount]) => {
          const basketNumber = Number(targetStr)
          if (amount > 0) {
            assignments.push({
              sku: ing.sku,
              basketNumber,
              amount,
              raw: ing.raw,
              timerSeconds: basketTimers[basketNumber] ?? 180,  // v3.1: 바스켓별 타이머
            })
          }
        })
      })

      if (assignments.length === 0) {
        alert('최소 1개 이상의 식재료를 투입해야 합니다.')
        return
      }

      onConfirmFryer(assignments)
    } else {
      // 웍용 (기존)
      const assignments: Array<{ sku: string; burnerNumber: number; amount: number; raw: any }> = []

      ingredients.forEach((ing) => {
        Object.entries(amounts[ing.id] || {}).forEach(([targetStr, amount]) => {
          const burnerNumber = Number(targetStr)
          if (amount > 0) {
            assignments.push({
              sku: ing.sku,
              burnerNumber,
              amount,
              raw: ing.raw,
            })
          }
        })
      })

      if (assignments.length === 0) {
        alert('최소 1개 이상의 식재료를 투입해야 합니다.')
        return
      }

      onConfirm(assignments)
    }
  }

  const handleKeyDown = (ingredientId: string, targetId: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const isMobile = window.innerWidth < 1024

    if (isMobile) {
      // 모바일: 다음 input으로 이동, 마지막이면 투입
      const allInputKeys: string[] = []
      ingredients.forEach((ing) => {
        targets.forEach((target) => {
          const key = getInputKey(ing.id, target.id)
          if (key) allInputKeys.push(key)
        })
      })

      const currentKey = getInputKey(ingredientId, targetId)
      const currentIndex = currentKey ? allInputKeys.indexOf(currentKey) : -1
      const nextIndex = currentIndex + 1

      if (nextIndex < allInputKeys.length) {
        // 다음 input으로 이동
        const nextKey = allInputKeys[nextIndex]
        inputRefs.current[nextKey]?.focus()
      } else {
        // 마지막 input: 투입 실행
        playSound('confirm')
        handleConfirm()
      }
    } else {
      // 데스크탑: 기존 동작 유지 (Enter 누르면 바로 투입)
      playSound('confirm')
      handleConfirm()
    }
  }

  // v3.1: 대상이 없으면 안내 메시지
  if (targets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full p-6 text-center"
        >
          <div className="text-5xl mb-4">{targetType === 'wok' ? '🍳' : '🍟'}</div>
          <div className="text-lg font-bold text-gray-800 mb-2">
            {targetType === 'wok' ? '배정된 화구가 없습니다' : '배정된 바스켓이 없습니다'}
          </div>
          <div className="text-sm text-gray-500 mb-4">
            {targetType === 'wok'
              ? '먼저 메뉴를 화구에 배정해주세요'
              : '먼저 메뉴를 튀김기 바스켓에 배정해주세요'}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm"
          >
            닫기
          </button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[80vh] flex flex-col"
      >
        {/* 헤더 - v3.1: 웍/튀김기 구분 */}
        <div className={`p-4 border-b flex justify-between items-center ${
          targetType === 'wok'
            ? 'bg-gradient-to-r from-blue-500 to-blue-600'
            : 'bg-gradient-to-r from-amber-500 to-orange-500'
        }`}>
          <div>
            <h3 className="font-bold text-white text-lg">
              {targetType === 'wok' ? '🔥 식재료 배치 투입' : '🍟 튀김기 재료 투입'}
            </h3>
            <p className={`text-xs mt-1 ${targetType === 'wok' ? 'text-blue-100' : 'text-amber-100'}`}>
              선택한 {ingredients.length}개 식재료를 각 {targetType === 'wok' ? '화구' : '바스켓'}에 투입하세요
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound('cancel')
              onCancel()
            }}
            className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium text-sm"
          >
            ✕
          </button>
        </div>

        {/* 식재료 목록 */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="space-y-3">
            {ingredients.map((ing) => (
              <div
                key={ing.id}
                className="bg-white rounded-lg border-2 border-gray-200 p-4 shadow-sm"
              >
                {/* 식재료 정보 */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                  <div>
                    <div className="font-bold text-gray-800 text-base">{ing.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      기준량: {ing.standardAmount}{ing.standardUnit}
                    </div>
                  </div>
                </div>

                {/* 대상별 입력 (모바일: 세로 / 데스크탑: 가로) */}
                <div className="flex flex-col lg:grid lg:grid-cols-3 gap-3">
                  {targets.map((target) => {
                    const inputKey = getInputKey(ing.id, target.id)
                    return (
                      <div key={target.id} className="flex flex-col gap-1">
                        <label className={`text-xs font-bold ${targetType === 'wok' ? 'text-gray-600' : 'text-amber-700'}`}>
                          {target.label}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            ref={(el) => {
                              if (inputKey) inputRefs.current[inputKey] = el
                            }}
                            type="number"
                            min="0"
                            value={amounts[ing.id]?.[target.id] || 0}
                            onChange={(e) => handleAmountChange(ing.id, target.id, e.target.value)}
                            onKeyDown={handleKeyDown(ing.id, target.id)}
                            className={`flex-1 px-2 py-2 border-2 border-gray-300 rounded text-center font-bold text-gray-800 focus:outline-none ${
                              targetType === 'wok' ? 'focus:border-blue-500' : 'focus:border-amber-500'
                            }`}
                          />
                          <span className="text-xs text-gray-600 font-medium">{ing.standardUnit}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickFill(ing.id, target.id, ing.standardAmount)}
                          className={`text-[10px] font-medium ${
                            targetType === 'wok' ? 'text-blue-600 hover:text-blue-700' : 'text-amber-600 hover:text-amber-700'
                          }`}
                          tabIndex={-1}
                        >
                          기준량
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* 현재 메뉴 표시 */}
                <div className="mt-2 text-[10px] text-gray-500 flex items-center gap-2 flex-wrap">
                  {targets.map((target) => (
                    <span key={target.id}>
                      {target.label}: {target.menuName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* v3.1: 튀김기 타이머 입력 섹션 */}
        {targetType === 'fryer' && (
          <div className="p-4 border-t border-amber-200 bg-amber-50">
            <div className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
              <span>⏱️</span> 튀김 시간 설정 (초)
            </div>
            <div className="grid grid-cols-3 gap-4">
              {targets.map((target) => (
                <div key={target.id} className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-amber-700">
                    {target.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click')
                        setBasketTimers((prev) => ({
                          ...prev,
                          [target.id]: Math.max(1, (prev[target.id] ?? 180) - 15),
                        }))
                      }}
                      className="w-8 h-8 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 font-bold flex items-center justify-center"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="600"
                      value={basketTimers[target.id] ?? 180}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setBasketTimers((prev) => ({
                          ...prev,
                          [target.id]: Math.max(1, Math.min(600, val)),
                        }))
                      }}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 px-2 py-2 border-2 border-amber-300 rounded text-center font-bold text-amber-900
                                 focus:border-amber-500 focus:outline-none
                                 [&::-webkit-inner-spin-button]:appearance-none
                                 [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click')
                        setBasketTimers((prev) => ({
                          ...prev,
                          [target.id]: Math.min(600, (prev[target.id] ?? 180) + 15),
                        }))
                      }}
                      className="w-8 h-8 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-800 font-bold flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-[10px] text-amber-600 text-center">
                    {Math.floor((basketTimers[target.id] ?? 180) / 60)}분 {(basketTimers[target.id] ?? 180) % 60}초
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              playSound('cancel')
              onCancel()
            }}
            className="px-6 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold text-sm"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              playSound('confirm')
              handleConfirm()
            }}
            className="px-6 py-2 rounded bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm shadow-lg"
          >
            ✓ 모두 투입하기
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

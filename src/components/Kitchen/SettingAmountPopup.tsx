import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useSound } from '../../hooks/useSound'

interface SelectedIngredientItem {
  id: string
  name: string
  sku: string
  amount: number // 기준량
  unit: string
  raw: any
  ingredientMasterId?: string
}

interface SettingAmountPopupProps {
  ingredients: SelectedIngredientItem[]
  onComplete: () => void // 닫기 선택
  onCancel: () => void
}

type Phase = 'INPUT' | 'COMPLETE'

/**
 * 세팅존 양 입력 팝업
 * 1단계: 각 재료별 양 입력
 * 2단계: 완료 후 [닫기 / 이동] 버튼 표시
 */
export default function SettingAmountPopup({
  ingredients,
  onComplete,
  onCancel,
}: SettingAmountPopupProps) {
  const { addSettingItem, openDecoZone } = useGameStore()
  const { playSound } = useSound()

  const [phase, setPhase] = useState<Phase>('INPUT')
  const [amounts, setAmounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    ingredients.forEach((ing) => {
      initial[ing.id] = ing.amount // 기준량으로 초기화
    })
    return initial
  })

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // 첫 input에 자동 포커스
  useEffect(() => {
    if (phase === 'INPUT' && ingredients.length > 0) {
      const firstId = ingredients[0].id
      inputRefs.current[firstId]?.focus()
    }
  }, [phase, ingredients])

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleAmountChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0
    setAmounts((prev) => ({ ...prev, [id]: num }))
  }

  const handleQuickFill = (id: string, standardAmount: number) => {
    playSound('add')
    setAmounts((prev) => ({ ...prev, [id]: standardAmount }))
  }

  const handleConfirmAmounts = () => {
    // 최소 1개 이상의 재료가 0보다 커야 함
    const hasValidAmount = Object.values(amounts).some((amt) => amt > 0)
    if (!hasValidAmount) {
      alert('최소 1개 이상의 재료를 선택해야 합니다.')
      return
    }

    // 세팅존에 재료 추가
    ingredients.forEach((ing) => {
      const amount = amounts[ing.id]
      if (amount > 0) {
        addSettingItem({
          ingredientName: ing.name,
          ingredientMasterId: ing.ingredientMasterId || ing.raw?.ingredient_master_id || ing.id,
          inventoryId: ing.raw?.id || ing.id, // v3: inventoryId 추가
          amount,
          unit: ing.unit,
        })
      }
    })

    playSound('confirm')
    setPhase('COMPLETE')
  }

  const handleClose = () => {
    playSound('cancel')
    onComplete()
  }

  const handleMoveToDecoZone = () => {
    playSound('confirm')
    onComplete()
    // 데코존으로 이동
    openDecoZone()
  }

  const handleKeyDown = (_id: string, index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()

    if (index < ingredients.length - 1) {
      // 다음 input으로 이동
      const nextId = ingredients[index + 1].id
      inputRefs.current[nextId]?.focus()
    } else {
      // 마지막 input: 확인 실행
      handleConfirmAmounts()
    }
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
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full max-h-[80vh] flex flex-col"
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-purple-500 rounded-t-2xl flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white text-lg">
              {phase === 'INPUT' ? '세팅존에 꺼내놓기' : '재료 준비 완료'}
            </h3>
            <p className="text-white/80 text-xs mt-1">
              {phase === 'INPUT'
                ? `${ingredients.length}개 재료의 양을 입력하세요`
                : '데코존으로 이동하거나 계속 조리하세요'}
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

        <AnimatePresence mode="wait">
          {phase === 'INPUT' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 overflow-y-auto"
            >
              {/* 재료 목록 */}
              <div className="p-4 bg-indigo-50 space-y-3">
                {ingredients.map((ing, index) => (
                  <div
                    key={ing.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-gray-800">{ing.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          기준량: {ing.amount}{ing.unit}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => {
                          inputRefs.current[ing.id] = el
                        }}
                        type="number"
                        min="0"
                        step="any"
                        value={amounts[ing.id] || 0}
                        onChange={(e) => handleAmountChange(ing.id, e.target.value)}
                        onKeyDown={handleKeyDown(ing.id, index)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold text-gray-800 text-lg focus:border-purple-500 focus:outline-none"
                      />
                      <span className="text-sm text-gray-600 font-medium min-w-[40px]">
                        {ing.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickFill(ing.id, ing.amount)}
                        className="px-3 py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium text-sm"
                        tabIndex={-1}
                      >
                        기준량
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 확인 버튼 */}
              <div className="p-4 border-t bg-white flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playSound('cancel')
                    onCancel()
                  }}
                  className="px-6 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAmounts}
                  className="px-6 py-2 rounded bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm"
                >
                  ✓ 선택 완료
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="complete"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              {/* 완료 표시 */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-500 flex items-center justify-center text-4xl shadow-lg mb-4">
                  ✓
                </div>
                <div className="text-gray-800 font-bold text-lg">재료가 준비되었습니다!</div>
                <div className="text-gray-500 text-sm mt-1">
                  데코존에서 플레이팅에 사용할 수 있습니다
                </div>
              </div>

              {/* 추가된 재료 요약 */}
              <div className="bg-indigo-50 rounded-lg p-3 mb-6">
                <div className="text-xs font-medium text-gray-500 mb-2">꺼내놓은 재료</div>
                <div className="flex flex-wrap gap-2">
                  {ingredients.map((ing) => {
                    const amount = amounts[ing.id]
                    if (amount <= 0) return null
                    return (
                      <span
                        key={ing.id}
                        className="px-2 py-1 bg-white border border-purple-200 rounded text-sm font-medium text-purple-700"
                      >
                        {ing.name} {amount}{ing.unit}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* 닫기 / 이동 버튼 */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleMoveToDecoZone}
                  className="flex-1 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  <span>🎨</span>
                  <span>데코존으로 이동</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'

interface SelectedIngredient {
  id: string
  name: string
  sku: string
  standardAmount: number
  standardUnit: string
  raw: any
}

interface BatchAmountInputPopupProps {
  ingredients: SelectedIngredient[]
  onConfirm: (assignments: Array<{ sku: string; burnerNumber: number; amount: number; raw: any }>) => void
  onCancel: () => void
}

export default function BatchAmountInputPopup({
  ingredients,
  onConfirm,
  onCancel,
}: BatchAmountInputPopupProps) {
  const woks = useGameStore((s) => s.woks)
  const woksWithMenu = woks.filter((w) => w.currentMenu)

  // 각 식재료별 웍별 입력값: { ingredientId: { burnerNumber: amount } }
  const [amounts, setAmounts] = useState<Record<string, Record<number, number>>>(() => {
    const initial: Record<string, Record<number, number>> = {}
    ingredients.forEach((ing) => {
      initial[ing.id] = {}
      woksWithMenu.forEach((wok) => {
        initial[ing.id][wok.burnerNumber] = 0
      })
    })
    return initial
  })

  // input refs (첫 번째 식재료의 첫 번째 웍)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // 첫 input에 자동 포커스
  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

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

  const handleAmountChange = (ingredientId: string, burnerNumber: number, value: string) => {
    const num = parseInt(value) || 0
    setAmounts((prev) => ({
      ...prev,
      [ingredientId]: {
        ...prev[ingredientId],
        [burnerNumber]: num,
      },
    }))
  }

  const handleQuickFill = (ingredientId: string, burnerNumber: number, standardAmount: number) => {
    setAmounts((prev) => ({
      ...prev,
      [ingredientId]: {
        ...prev[ingredientId],
        [burnerNumber]: standardAmount,
      },
    }))
  }

  const handleConfirm = () => {
    const assignments: Array<{ sku: string; burnerNumber: number; amount: number; raw: any }> = []

    ingredients.forEach((ing) => {
      Object.entries(amounts[ing.id] || {}).forEach(([burnerStr, amount]) => {
        const burnerNumber = Number(burnerStr)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
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
        className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[80vh] flex flex-col"
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white text-lg">식재료 배치 투입</h3>
            <p className="text-blue-100 text-xs mt-1">선택한 {ingredients.length}개 식재료를 각 화구에 투입하세요</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
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

                {/* 화구별 입력 */}
                <div className="grid grid-cols-3 gap-3">
                  {woksWithMenu.map((wok, wokIndex) => {
                    const isFirstInput = ingredients.indexOf(ing) === 0 && wokIndex === 0
                    return (
                      <div key={wok.burnerNumber} className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600">
                          화구 {wok.burnerNumber}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            ref={isFirstInput ? firstInputRef : undefined}
                            type="number"
                            min="0"
                            value={amounts[ing.id]?.[wok.burnerNumber] || 0}
                            onChange={(e) => handleAmountChange(ing.id, wok.burnerNumber, e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 px-2 py-2 border-2 border-gray-300 rounded text-center font-bold text-gray-800 focus:border-blue-500 focus:outline-none"
                          />
                          <span className="text-xs text-gray-600 font-medium">{ing.standardUnit}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickFill(ing.id, wok.burnerNumber, ing.standardAmount)}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                          tabIndex={-1}
                        >
                          기준량
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* 현재 메뉴 표시 */}
                <div className="mt-2 text-[10px] text-gray-500 flex items-center gap-2">
                  {woksWithMenu.map((wok) => (
                    <span key={wok.burnerNumber}>
                      화구{wok.burnerNumber}: {wok.currentMenu}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold text-sm"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2 rounded bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm shadow-lg"
          >
            ✓ 모두 투입하기
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

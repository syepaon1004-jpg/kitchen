import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import type { EquipmentComponentProps } from '../PlaceholderEquipment'
import type { IngredientInventory } from '../../../types/database.types'

/**
 * 냉동고 장비 컴포넌트
 * v3.1: Phase 2 - 클릭 시 냉동고 재료 선택 팝업
 * v3.1 Fix: storageCache 대신 ingredients 필드에서 storage_location.location_code로 필터링
 * v3.1 Bug Fix: 수량 지정 기능 추가
 */
export default function FreezerEquipment({
  displayName,
  storageLocationIds,
}: EquipmentComponentProps) {
  const [showPopup, setShowPopup] = useState(false)
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set())
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const onMultipleIngredientsSelected = useGameStore((s) => s.onMultipleIngredientsSelected)

  // v3.1 Fix: gameStore의 ingredients에서 storage_location.location_code로 필터링
  const allIngredients = useGameStore((s) => s.ingredients)

  // 냉동고 재료 목록 가져오기 - storage_location.location_code로 필터링
  const ingredients: IngredientInventory[] = allIngredients.filter((item: any) =>
    storageLocationIds.includes(item.storage_location?.location_code)
  )

  // 재료 선택 토글
  const toggleSelect = (ingredientId: string, defaultAmount: number) => {
    setSelectedIngredients((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(ingredientId)) {
        newSet.delete(ingredientId)
        // 수량도 제거
        setQuantities((q) => {
          const newQ = { ...q }
          delete newQ[ingredientId]
          return newQ
        })
      } else {
        newSet.add(ingredientId)
        // 기본 수량 설정
        setQuantities((q) => ({ ...q, [ingredientId]: defaultAmount }))
      }
      return newSet
    })
  }

  // 수량 변경
  const handleQuantityChange = (ingredientId: string, value: number) => {
    if (value >= 1) {
      setQuantities((q) => ({ ...q, [ingredientId]: value }))
    }
  }

  // 선택 초기화
  const handleReset = () => {
    setSelectedIngredients(new Set())
    setQuantities({})
  }

  // 담기 완료
  const handleConfirm = () => {
    if (selectedIngredients.size === 0) return

    const selectedItems = ingredients
      .filter((ing) => selectedIngredients.has(ing.id))
      .map((ing) => ({
        id: ing.id,
        name: ing.ingredient_master?.ingredient_name ?? '알 수 없음',
        sku: ing.sku_full ?? '',
        amount: quantities[ing.id] ?? ing.standard_amount,
        unit: ing.standard_unit,
        raw: ing,
        ingredientMasterId: ing.ingredient_master_id,
      }))

    if (onMultipleIngredientsSelected) {
      onMultipleIngredientsSelected(selectedItems)
    }

    setSelectedIngredients(new Set())
    setQuantities({})
    setShowPopup(false)
  }

  // 팝업 닫기
  const handleClose = () => {
    setSelectedIngredients(new Set())
    setQuantities({})
    setShowPopup(false)
  }

  return (
    <>
      {/* 메인 장비 버튼 */}
      <div
        onClick={() => setShowPopup(true)}
        className="w-full h-full bg-blue-900/80 rounded-lg border-2 border-blue-600
                   flex flex-col items-center justify-center cursor-pointer
                   hover:border-blue-400 transition-colors"
      >
        <span className="text-2xl">🧊</span>
        <span className="text-xs text-blue-200 mt-1">{displayName}</span>
        {ingredients.length > 0 && (
          <span className="text-[10px] text-blue-300 mt-0.5">
            {ingredients.length}개 재료
          </span>
        )}
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
                onClick={handleClose}
              />

              {/* 팝업 컨테이너 - 뷰포트 정중앙 */}
              <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-[calc(100vw-2rem)] max-w-lg max-h-[80vh] overflow-hidden
                             bg-gradient-to-br from-blue-100 to-blue-200
                             rounded-xl shadow-2xl border-4 border-blue-500 flex flex-col pointer-events-auto"
                >
                  {/* 헤더 */}
                  <div className="flex items-center justify-between p-4 border-b border-blue-300">
                    <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                      <span className="text-2xl">🧊</span>
                      냉동고
                    </h3>
                    <button
                      onClick={handleClose}
                      className="w-8 h-8 rounded-full bg-blue-300 hover:bg-blue-400
                                 flex items-center justify-center text-blue-900 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 재료 목록 */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {ingredients.length === 0 ? (
                      <div className="text-center text-blue-700 py-8">
                        냉동고에 재료가 없습니다
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ingredients.map((ing) => {
                          const isSelected = selectedIngredients.has(ing.id)
                          const name = ing.ingredient_master?.ingredient_name ?? ing.sku_full ?? '알 수 없음'
                          const currentQty = quantities[ing.id] ?? ing.standard_amount

                          return (
                            <div
                              key={ing.id}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? 'bg-blue-500 border-blue-700 shadow-lg'
                                  : 'bg-white border-blue-200 hover:border-blue-400'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                {/* 재료 정보 + 선택 토글 */}
                                <button
                                  type="button"
                                  onClick={() => toggleSelect(ing.id, ing.standard_amount)}
                                  className="flex-1 text-left flex items-center gap-2"
                                >
                                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-white border-white text-blue-500'
                                      : 'border-blue-300 text-transparent'
                                  }`}>
                                    ✓
                                  </div>
                                  <div>
                                    <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                      {name}
                                    </div>
                                    <div className={`text-xs ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                      기본: {ing.standard_amount}{ing.standard_unit}
                                    </div>
                                  </div>
                                </button>

                                {/* 수량 입력 (선택 시에만 표시) */}
                                {isSelected && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleQuantityChange(ing.id, currentQty - 1)
                                      }}
                                      className="w-8 h-8 rounded-full bg-blue-400 hover:bg-blue-300
                                                 text-white font-bold flex items-center justify-center"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      value={currentQty}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        handleQuantityChange(ing.id, parseInt(e.target.value, 10) || 1)
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      onFocus={(e) => e.target.select()}
                                      className="w-16 text-center bg-white text-blue-900 font-bold
                                                 rounded border-2 border-blue-300 py-1
                                                 [&::-webkit-inner-spin-button]:appearance-none
                                                 [&::-webkit-outer-spin-button]:appearance-none"
                                      min={1}
                                    />
                                    <span className="text-white text-xs font-medium">
                                      {ing.standard_unit}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleQuantityChange(ing.id, currentQty + 1)
                                      }}
                                      className="w-8 h-8 rounded-full bg-blue-400 hover:bg-blue-300
                                                 text-white font-bold flex items-center justify-center"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* 하단 버튼 */}
                  <div className="p-4 border-t border-blue-300 bg-blue-50 flex gap-3">
                    <button
                      onClick={handleReset}
                      disabled={selectedIngredients.size === 0}
                      className="flex-1 py-3 rounded-lg bg-gray-200 hover:bg-gray-300
                                 text-gray-700 font-bold text-sm disabled:opacity-50"
                    >
                      선택 초기화
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={selectedIngredients.size === 0}
                      className="flex-1 py-3 rounded-lg bg-blue-500 hover:bg-blue-600
                                 text-white font-bold text-sm disabled:opacity-50 shadow-md"
                    >
                      담기 완료 ({selectedIngredients.size}개)
                    </button>
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

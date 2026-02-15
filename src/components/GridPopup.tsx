import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { calculateGridArea } from '../utils/grid'

interface GridIngredient {
  id: string
  name: string
  amount: number
  unit: string
  gridPositions: string
  gridSize: string
  sku: string
  raw?: any
}

interface GridPopupProps {
  title: string
  gridRows: number
  gridCols: number
  ingredients: GridIngredient[]
  onSelect: (ingredient: GridIngredient) => void
  onSelectMultiple?: (ingredients: GridIngredient[]) => void // 다중 선택 콜백
  onClose: () => void
  enableMultiSelect?: boolean // 다중 선택 모드 활성화
}

export default function GridPopup({
  title,
  gridRows,
  gridCols,
  ingredients,
  onSelect,
  onSelectMultiple,
  onClose,
  enableMultiSelect = false,
}: GridPopupProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && enableMultiSelect && selectedItems.size > 0) {
        handleConfirmSelection()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, enableMultiSelect, selectedItems])

  const handleItemClick = (ing: GridIngredient) => {
    if (enableMultiSelect) {
      // 다중 선택 모드
      setSelectedItems((prev) => {
        const next = new Set(prev)
        if (next.has(ing.id)) {
          next.delete(ing.id)
        } else {
          next.add(ing.id)
        }
        return next
      })
    } else {
      // 단일 선택 모드 (기존)
      onSelect(ing)
    }
  }

  const handleConfirmSelection = () => {
    console.log('📋 [GridPopup] 담기 완료 클릭! selectedItems:', selectedItems.size, '| onSelectMultiple:', !!onSelectMultiple)
    if (selectedItems.size === 0) {
      alert('최소 1개 이상의 식재료를 선택하세요.')
      return
    }
    const selected = ingredients.filter((ing) => selectedItems.has(ing.id))
    console.log('📋 [GridPopup] 선택된 재료:', selected.map(s => s.name))
    if (onSelectMultiple) {
      onSelectMultiple(selected)
    } else {
      console.error('❌ [GridPopup] onSelectMultiple 콜백이 없음!')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-4xl"
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
          <h3 className="font-bold text-[#333] text-lg">{title}</h3>
          <div className="flex items-center gap-2">
            {enableMultiSelect && selectedItems.size > 0 && (
              <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-sm font-bold">
                {selectedItems.size}개 선택됨
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 그리드 영역 */}
        <div className="p-6 bg-indigo-50 overflow-auto max-h-[70vh]">
          <div
            className="grid gap-2 mx-auto"
            style={{
              gridTemplateRows: `repeat(${gridRows}, 100px)`,
              gridTemplateColumns: `repeat(${gridCols}, 100px)`,
            }}
          >
            {ingredients.map((ing) => {
              const area = calculateGridArea(ing.gridPositions, gridCols)
              const isSelected = selectedItems.has(ing.id)
              
              return (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => handleItemClick(ing)}
                  className={`border rounded-lg hover:shadow-lg transition p-2 flex flex-col items-center justify-center relative ${
                    isSelected
                      ? 'bg-blue-100 border-blue-500 shadow-lg'
                      : 'bg-white border-gray-200 hover:border-primary hover:bg-primary/5'
                  }`}
                  style={{
                    gridRowStart: area.rowStart,
                    gridRowEnd: area.rowEnd,
                    gridColumnStart: area.colStart,
                    gridColumnEnd: area.colEnd,
                  }}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}
                  <div className="font-semibold text-gray-800 text-sm text-center">
                    {ing.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {ing.amount}
                    {ing.unit}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 다중 선택 모드일 때 하단 버튼 */}
        {enableMultiSelect && (
          <div className="p-4 border-t border-gray-200 bg-indigo-50 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setSelectedItems(new Set())}
              className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm"
            >
              선택 초기화
            </button>
            <button
              type="button"
              onClick={handleConfirmSelection}
              disabled={selectedItems.size === 0}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                selectedItems.size > 0
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              담기 완료 ({selectedItems.size}개)
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

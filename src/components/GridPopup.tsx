import { motion } from 'framer-motion'
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
  onClose: () => void
}

export default function GridPopup({
  title,
  gridRows,
  gridCols,
  ingredients,
  onSelect,
  onClose,
}: GridPopupProps) {
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
        className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-4xl"
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-blue-50 flex justify-between items-center">
          <h3 className="font-bold text-[#333] text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#E0E0E0] hover:bg-[#d0d0d0] font-medium text-sm"
          >
            닫기
          </button>
        </div>

        {/* 그리드 영역 */}
        <div className="p-6 bg-gray-50 overflow-auto max-h-[70vh]">
          <div
            className="grid gap-2 mx-auto"
            style={{
              gridTemplateRows: `repeat(${gridRows}, 100px)`,
              gridTemplateColumns: `repeat(${gridCols}, 100px)`,
            }}
          >
            {ingredients.map((ing) => {
              const area = calculateGridArea(ing.gridPositions, gridCols)
              return (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => onSelect(ing)}
                  className="bg-white border-2 border-blue-300 rounded-lg hover:border-primary hover:bg-primary/5 hover:shadow-lg transition p-2 flex flex-col items-center justify-center"
                  style={{
                    gridRowStart: area.rowStart,
                    gridRowEnd: area.rowEnd,
                    gridColumnStart: area.colStart,
                    gridColumnEnd: area.colEnd,
                  }}
                >
                  <div className="font-semibold text-[#333] text-sm text-center">
                    {ing.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {ing.amount}
                    {ing.unit}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

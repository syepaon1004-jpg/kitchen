import { motion } from 'framer-motion'
import { useSound } from '../../hooks/useSound'

interface SelectedIngredientItem {
  id: string
  name: string
  sku: string
  amount: number
  unit: string
  raw: any
}

interface IngredientModeSelectorProps {
  ingredients: SelectedIngredientItem[]
  onSelectInput: () => void // 투입 선택
  onSelectSetting: () => void // 세팅존 선택
  onCancel: () => void
}

/**
 * 재료 선택 후 투입/세팅존 선택 UI
 * - 투입: 기존 웍 투입 흐름
 * - 세팅존: 데코존에 재료 꺼내놓기
 */
export default function IngredientModeSelector({
  ingredients,
  onSelectInput,
  onSelectSetting,
  onCancel,
}: IngredientModeSelectorProps) {
  const { playSound } = useSound()

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
        className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full"
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-gradient-to-r from-indigo-500 to-purple-600">
          <h3 className="font-bold text-white text-lg">재료 사용 방법 선택</h3>
          <p className="text-indigo-100 text-xs mt-1">
            선택한 {ingredients.length}개 재료를 어디에 사용할까요?
          </p>
        </div>

        {/* 선택된 재료 목록 */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="text-xs font-medium text-gray-500 mb-2">선택한 재료</div>
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ing) => (
              <span
                key={ing.id}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-sm font-medium text-gray-700"
              >
                {ing.name}
              </span>
            ))}
          </div>
        </div>

        {/* 선택 버튼들 */}
        <div className="p-4 space-y-3">
          {/* 투입 버튼 */}
          <button
            type="button"
            onClick={() => {
              playSound('confirm')
              onSelectInput()
            }}
            className="w-full p-4 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                🍳
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-blue-800 text-lg">투입</div>
                <div className="text-xs text-blue-600 mt-0.5">
                  웍에 직접 재료를 넣어 조리합니다
                </div>
              </div>
              <div className="text-blue-400 text-2xl">→</div>
            </div>
          </button>

          {/* 세팅존 버튼 */}
          <button
            type="button"
            onClick={() => {
              playSound('confirm')
              onSelectSetting()
            }}
            className="w-full p-4 rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                🎨
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-purple-800 text-lg">세팅존</div>
                <div className="text-xs text-purple-600 mt-0.5">
                  데코존에 재료를 꺼내놓습니다
                </div>
              </div>
              <div className="text-purple-400 text-2xl">→</div>
            </div>
          </button>
        </div>

        {/* 취소 버튼 */}
        <div className="p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={() => {
              playSound('cancel')
              onCancel()
            }}
            className="w-full py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-sm"
          >
            취소
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

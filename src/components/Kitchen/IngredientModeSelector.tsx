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
  onSelectSpecialAction: () => void // 특수액션 선택
  hasSpecialActions: boolean // 특수액션 존재 여부
  hasPendingPrerequisites: boolean // 미완료 필수 특수액션 존재 여부
  onCancel: () => void
}

/**
 * 재료 선택 후 투입/세팅존/특수액션 선택 UI
 * - 투입: 기존 웍 투입 흐름
 * - 세팅존: 데코존에 재료 꺼내놓기
 * - 특수액션: 전자레인지, 해동, 재우기 등 특수 처리
 */
export default function IngredientModeSelector({
  ingredients,
  onSelectInput,
  onSelectSetting,
  onSelectSpecialAction,
  hasSpecialActions,
  hasPendingPrerequisites,
  onCancel,
}: IngredientModeSelectorProps) {
  const { playSound } = useSound()

  // 필수 특수액션 미완료 시 투입/세팅존 비활성화
  const isInputDisabled = hasPendingPrerequisites
  const isSettingDisabled = hasPendingPrerequisites

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

        {/* 필수 특수액션 안내 */}
        {hasPendingPrerequisites && (
          <div className="px-4 pt-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700 font-medium flex items-center gap-2">
                ⚠️ 특수 액션을 먼저 완료해야 합니다
              </p>
            </div>
          </div>
        )}

        {/* 선택 버튼들 */}
        <div className="p-4 space-y-3">
          {/* 특수액션 버튼 (hasSpecialActions=true일 때만) */}
          {hasSpecialActions && (
            <button
              type="button"
              onClick={() => {
                playSound('confirm')
                onSelectSpecialAction()
              }}
              className="w-full p-4 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                  ⚡
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-amber-800 text-lg">특수 액션</div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    전자레인지, 해동, 재우기 등 특수 처리
                  </div>
                </div>
                <div className="text-amber-400 text-2xl">→</div>
              </div>
            </button>
          )}

          {/* 투입 버튼 */}
          <button
            type="button"
            disabled={isInputDisabled}
            onClick={() => {
              if (isInputDisabled) return
              playSound('confirm')
              onSelectInput()
            }}
            className={`w-full p-4 rounded-xl border-2 transition-all group ${
              isInputDisabled
                ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                : 'border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform ${
                isInputDisabled ? 'bg-gray-400' : 'bg-blue-500 group-hover:scale-110'
              }`}>
                🍳
              </div>
              <div className="text-left flex-1">
                <div className={`font-bold text-lg ${isInputDisabled ? 'text-gray-500' : 'text-blue-800'}`}>
                  투입
                </div>
                <div className={`text-xs mt-0.5 ${isInputDisabled ? 'text-gray-400' : 'text-blue-600'}`}>
                  웍에 직접 재료를 넣어 조리합니다
                </div>
              </div>
              <div className={`text-2xl ${isInputDisabled ? 'text-gray-300' : 'text-blue-400'}`}>→</div>
            </div>
          </button>

          {/* 세팅존 버튼 */}
          <button
            type="button"
            disabled={isSettingDisabled}
            onClick={() => {
              if (isSettingDisabled) return
              playSound('confirm')
              onSelectSetting()
            }}
            className={`w-full p-4 rounded-xl border-2 transition-all group ${
              isSettingDisabled
                ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                : 'border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform ${
                isSettingDisabled ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-500 to-pink-500 group-hover:scale-110'
              }`}>
                🎨
              </div>
              <div className="text-left flex-1">
                <div className={`font-bold text-lg ${isSettingDisabled ? 'text-gray-500' : 'text-purple-800'}`}>
                  세팅존
                </div>
                <div className={`text-xs mt-0.5 ${isSettingDisabled ? 'text-gray-400' : 'text-purple-600'}`}>
                  데코존에 재료를 꺼내놓습니다
                </div>
              </div>
              <div className={`text-2xl ${isSettingDisabled ? 'text-gray-300' : 'text-purple-400'}`}>→</div>
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

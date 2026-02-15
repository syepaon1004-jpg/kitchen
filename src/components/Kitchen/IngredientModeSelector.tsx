import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSound } from '../../hooks/useSound'

interface SelectedIngredientItem {
  id: string
  name: string
  sku: string
  amount: number
  unit: string
  raw: any
  ingredientMasterId?: string
}

interface IngredientModeSelectorProps {
  ingredients: SelectedIngredientItem[]
  onSelectInput: () => void       // 웍에 투입
  onSelectSetting: () => void     // 데코존 (꺼내놓기)
  onSelectMicrowave: () => void   // 전자레인지
  onSelectFryer: () => void       // 튀김기
  onCancel: () => void
}

/**
 * 재료 선택 후 4가지 사용 방법 선택 UI
 * v3.1: 2단계 → 1단계로 변경 (4개 버튼 직접 표시)
 */
export default function IngredientModeSelector({
  ingredients,
  onSelectInput,
  onSelectSetting,
  onSelectMicrowave,
  onSelectFryer,
  onCancel,
}: IngredientModeSelectorProps) {
  const { playSound } = useSound()
  const firstBtnRef = useRef<HTMLButtonElement>(null)

  // 마운트 시 첫 번째 버튼 자동 포커스 (1회만)
  // 300ms 지연: GridPopup에서 Enter로 확정 시 keyboard repeat가
  // 새로 포커스된 버튼을 활성화하는 것을 방지
  useEffect(() => {
    const timer = setTimeout(() => firstBtnRef.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [])

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        playSound('cancel')
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, playSound])

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
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full"
      >
        {/* 헤더 */}
        <div className="p-4 border-b bg-indigo-500 rounded-t-2xl">
          <h3 className="font-bold text-white text-lg">재료 사용 방법 선택</h3>
          <p className="text-white/80 text-xs mt-1">
            선택한 {ingredients.length}개 재료를 어디에 사용할까요?
          </p>
        </div>

        {/* 선택된 재료 목록 */}
        <div className="p-4 bg-indigo-50 border-b">
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

        {/* 4개 선택 버튼 */}
        <div className="p-4 space-y-3">
          {/* 1. 웍에 투입 */}
          <button
            ref={firstBtnRef}
            type="button"
            onClick={() => {
              playSound('confirm')
              onSelectInput()
            }}
            className="w-full p-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                🔥
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-blue-800 text-lg">웍에 투입</div>
                <div className="text-xs text-blue-600 mt-0.5">
                  웍에 직접 재료를 넣어 조리합니다
                </div>
              </div>
              <div className="text-blue-400 text-2xl">→</div>
            </div>
          </button>

          {/* 2. 데코존에 꺼내놓기 */}
          <button
            type="button"
            onClick={() => {
              playSound('confirm')
              onSelectSetting()
            }}
            className="w-full p-4 rounded-xl border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                📦
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-cyan-800 text-lg">데코존에 꺼내놓기</div>
                <div className="text-xs text-cyan-600 mt-0.5">
                  세팅존에 재료를 꺼내놓습니다
                </div>
              </div>
              <div className="text-cyan-400 text-2xl">→</div>
            </div>
          </button>

          {/* 3. 전자레인지로 이동 */}
          <button
            type="button"
            onClick={() => {
              playSound('confirm')
              onSelectMicrowave()
            }}
            className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                📡
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-gray-800 text-lg">전자레인지로 이동</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  전자레인지로 데우거나 조리합니다
                </div>
              </div>
              <div className="text-gray-400 text-2xl">→</div>
            </div>
          </button>

          {/* 4. 튀김기로 이동 */}
          <button
            type="button"
            onClick={() => {
              playSound('confirm')
              onSelectFryer()
            }}
            className="w-full p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                🍟
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-amber-800 text-lg">튀김기로 이동</div>
                <div className="text-xs text-amber-600 mt-0.5">
                  튀김기에 넣어 튀깁니다
                </div>
              </div>
              <div className="text-amber-400 text-2xl">→</div>
            </div>
          </button>
        </div>

        {/* 취소 버튼 */}
        <div className="p-4 border-t bg-indigo-50">
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

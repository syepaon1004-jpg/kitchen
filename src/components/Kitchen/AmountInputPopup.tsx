import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'

interface AmountInputPopupProps {
  title: string
  requiredAmount: number
  requiredUnit: string
  onConfirm: (amountsByWok: Record<number, number>) => void
  onCancel: () => void
}

const STEPS = [50, 20, 10, 5, 1]

export default function AmountInputPopup({
  title,
  requiredAmount,
  requiredUnit,
  onConfirm,
  onCancel,
}: AmountInputPopupProps) {
  const woks = useGameStore((s) => s.woks)
  
  const [amounts, setAmounts] = useState<Record<number, number>>({
    1: 0,
    2: 0,
    3: 0,
  })

  const input1Ref = useRef<HTMLInputElement>(null)
  const input2Ref = useRef<HTMLInputElement>(null)
  const input3Ref = useRef<HTMLInputElement>(null)

  // 첫 번째 메뉴 있는 웍 input에 자동 포커스
  useEffect(() => {
    const firstWokWithMenu = woks.find((w) => w.currentMenu)
    if (firstWokWithMenu?.burnerNumber === 1) input1Ref.current?.focus()
    else if (firstWokWithMenu?.burnerNumber === 2) input2Ref.current?.focus()
    else if (firstWokWithMenu?.burnerNumber === 3) input3Ref.current?.focus()
    else input1Ref.current?.focus()
  }, [woks])

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

  const updateAmount = (burnerNumber: number, delta: number) => {
    setAmounts((prev) => ({
      ...prev,
      [burnerNumber]: Math.max(0, (prev[burnerNumber] ?? 0) + delta),
    }))
  }

  const setDirectAmount = (burnerNumber: number, value: string) => {
    const num = parseInt(value, 10)
    setAmounts((prev) => ({
      ...prev,
      [burnerNumber]: isNaN(num) ? 0 : Math.max(0, num),
    }))
  }

  const resetAll = () => {
    setAmounts({ 1: 0, 2: 0, 3: 0 })
  }

  const totalAmount = amounts[1] + amounts[2] + amounts[3]

  const refs = { 1: input1Ref, 2: input2Ref, 3: input3Ref }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && totalAmount > 0) {
      e.preventDefault()
      onConfirm(amounts)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 lg:p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full p-3 lg:p-6 shadow-xl flex flex-col max-h-[95vh]">
        <h3 className="font-bold text-[#333] mb-1 text-sm lg:text-xl">{title} 투입량</h3>
        <p className="text-[10px] lg:text-sm text-[#757575] mb-2 lg:mb-4">
          각 화구별로 투입할 양을 지정하세요 (목표: {requiredAmount}{requiredUnit})
        </p>

        {/* Desktop: 3열 | Mobile: 세로 배치 */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-2 lg:gap-4 mb-2 lg:mb-6 overflow-y-auto flex-shrink-1">
          {[1, 2, 3].map((burnerNumber) => {
            const wok = woks.find((w) => w.burnerNumber === burnerNumber)
            const hasMenu = !!wok?.currentMenu
            return (
              <div
                key={burnerNumber}
                className={`border-2 rounded-lg p-2 lg:p-4 ${
                  hasMenu ? 'border-primary bg-primary/5' : 'border-[#E0E0E0] bg-gray-50'
                }`}
              >
                <div className="text-center mb-1.5 lg:mb-3">
                  <div className="font-semibold text-[#333] text-xs lg:text-base">화구{burnerNumber}</div>
                  <div className="text-[9px] lg:text-xs text-[#757575]">
                    {wok?.currentMenu ?? '메뉴 없음'}
                  </div>
                </div>

                {/* 키보드 입력 */}
                <div className="mb-1.5 lg:mb-3">
                  <input
                    ref={refs[burnerNumber as 1 | 2 | 3]}
                    type="number"
                    min="0"
                    value={amounts[burnerNumber] ?? 0}
                    onChange={(e) => setDirectAmount(burnerNumber, e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!hasMenu}
                    className="w-full text-center text-lg lg:text-2xl font-bold text-primary py-0 lg:py-2 border-2 border-primary/30 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                    placeholder={`0${requiredUnit}`}
                  />
                </div>

                {/* +/- 버튼들 (가로 배치: -50 ~ +50) */}
                <div className="flex flex-wrap gap-0.5 lg:gap-1 justify-between">
                  {/* - 버튼들: -50, -20, -10, -5, -1 */}
                  {STEPS.map((s) => (
                    <button
                      key={`minus-${s}`}
                      type="button"
                      onClick={() => updateAmount(burnerNumber, -s)}
                      disabled={!hasMenu}
                      className="flex-1 py-4 lg:py-1.5 px-1 lg:px-2 rounded text-[10px] lg:text-xs font-medium bg-red-100 hover:bg-red-200 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                      tabIndex={-1}
                    >
                      -{s}
                    </button>
                  ))}
                  {/* + 버튼들: +1, +5, +10, +20, +50 */}
                  {[...STEPS].reverse().map((s) => (
                    <button
                      key={`plus-${s}`}
                      type="button"
                      onClick={() => updateAmount(burnerNumber, s)}
                      disabled={!hasMenu}
                      className="flex-1 py-4 lg:py-1.5 px-1 lg:px-2 rounded text-[10px] lg:text-xs font-medium bg-green-100 hover:bg-green-200 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                      tabIndex={-1}
                    >
                      +{s}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* 총합 표시 */}
        <div className="text-center mb-2 lg:mb-4 p-1.5 lg:p-3 bg-gray-100 rounded-lg flex-shrink-0">
          <span className="text-[10px] lg:text-sm text-[#757575]">총 투입량: </span>
          <span className="font-bold text-[#333] text-sm lg:text-lg">
            {totalAmount}{requiredUnit}
          </span>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-2 lg:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={resetAll}
            className="flex-1 py-2 lg:py-3 rounded-lg bg-[#E0E0E0] hover:bg-[#d0d0d0] font-medium text-xs lg:text-base"
            tabIndex={-1}
          >
            초기화
          </button>
          <button
            type="button"
            onClick={() => onConfirm(amounts)}
            disabled={totalAmount === 0}
            className="flex-1 py-2 lg:py-3 rounded-lg bg-primary text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark text-xs lg:text-base"
          >
            투입 ({totalAmount}{requiredUnit})
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 lg:py-3 rounded-lg border-2 border-[#E0E0E0] hover:bg-gray-50 font-medium text-xs lg:text-base"
            tabIndex={-1}
          >
            취소
          </button>
        </div>

        <p className="text-[10px] lg:text-xs text-[#757575] mt-2 lg:mt-3 text-center hidden lg:block">
          💡 Tab 키로 화구 이동, 숫자 입력 후 Enter로 투입
        </p>
      </div>
    </div>
  )
}

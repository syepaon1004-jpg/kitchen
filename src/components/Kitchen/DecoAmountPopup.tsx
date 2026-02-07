import { useState, useRef, useEffect } from 'react'
import { useSound } from '../../hooks/useSound'

interface DecoAmountPopupProps {
  ingredientName: string
  minAmount: number
  maxAmount: number
  unit: string
  onConfirm: (amount: number) => void
  onCancel: () => void
}

const STEPS = [10, 5, 1]

/**
 * 데코 수량 입력 팝업
 * AmountInputPopup의 단순화 버전 - 단일 수량 입력용
 */
export default function DecoAmountPopup({
  ingredientName,
  minAmount,
  maxAmount,
  unit,
  onConfirm,
  onCancel,
}: DecoAmountPopupProps) {
  const { playSound } = useSound()
  const [amount, setAmount] = useState(minAmount)
  const inputRef = useRef<HTMLInputElement>(null)

  // 자동 포커스
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

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

  const updateAmount = (delta: number) => {
    playSound(delta > 0 ? 'add' : 'remove')
    setAmount((prev) => Math.max(minAmount, Math.min(maxAmount, prev + delta)))
  }

  const setDirectAmount = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      setAmount(Math.max(minAmount, Math.min(maxAmount, num)))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      playSound('confirm')
      onConfirm(amount)
    }
  }

  const isValidAmount = amount >= minAmount && amount <= maxAmount

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="text-center mb-4">
          <h3 className="font-bold text-gray-800 text-lg">{ingredientName}</h3>
          <p className="text-sm text-gray-500 mt-1">
            수량을 입력하세요 ({minAmount}~{maxAmount}{unit})
          </p>
        </div>

        {/* 수량 입력 */}
        <div className="mb-4">
          <input
            ref={inputRef}
            type="number"
            min={minAmount}
            max={maxAmount}
            value={amount}
            onChange={(e) => setDirectAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-center text-3xl font-bold text-purple-600 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
        </div>

        {/* +/- 버튼들 */}
        <div className="flex gap-2 mb-4">
          {/* - 버튼들 */}
          {STEPS.map((s) => (
            <button
              key={`minus-${s}`}
              type="button"
              onClick={() => updateAmount(-s)}
              disabled={amount - s < minAmount}
              className="flex-1 py-3 rounded-lg text-sm font-medium bg-red-100 hover:bg-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              -{s}
            </button>
          ))}
          {/* + 버튼들 */}
          {[...STEPS].reverse().map((s) => (
            <button
              key={`plus-${s}`}
              type="button"
              onClick={() => updateAmount(s)}
              disabled={amount + s > maxAmount}
              className="flex-1 py-3 rounded-lg text-sm font-medium bg-green-100 hover:bg-green-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +{s}
            </button>
          ))}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              playSound('cancel')
              onCancel()
            }}
            className="flex-1 py-3 rounded-lg border-2 border-gray-200 hover:bg-gray-50 font-medium text-gray-600"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              playSound('confirm')
              onConfirm(amount)
            }}
            disabled={!isValidAmount}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-pink-600 shadow-lg"
          >
            적용 ({amount}{unit})
          </button>
        </div>
      </div>
    </div>
  )
}

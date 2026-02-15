import { useState } from 'react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useSound } from '../../hooks/useSound'
import { useGameStore } from '../../stores/gameStore'
import type { FryerBasket } from '../../types/database.types'

interface SelectedIngredientItem {
  id: string
  name: string
  sku: string
  amount: number
  unit: string
  raw: any
  ingredientMasterId?: string
}

interface FryerSetupPopupProps {
  ingredients: SelectedIngredientItem[]
  onConfirm: (basketNumber: number, timerSeconds: number) => void
  onCancel: () => void
}

const MIN_SECONDS = 1  // v3.1: 테스트를 위해 1초부터 허용
const MAX_SECONDS = 600
const STEP_SECONDS = 15  // v3.1: 15초 단위로 변경

/**
 * 튀김기 설정 팝업
 * - 바스켓 선택: 1~3번 (EMPTY 상태만)
 * - 타이머: 30초 ~ 600초 (30초 단위)
 */
export default function FryerSetupPopup({
  ingredients,
  onConfirm,
  onCancel,
}: FryerSetupPopupProps) {
  const { playSound } = useSound()
  const { fryerState } = useGameStore()
  const [selectedBasket, setSelectedBasket] = useState<number | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(180)

  // v3.3: 선택 가능한 바스켓: orderId 있고 ASSIGNED + isSubmerged === false
  // isSubmerged가 false면 바스켓이 올라와 있어서 재료 투입 가능
  const selectableBaskets = fryerState.baskets.filter(
    (b) => b.orderId && b.status === 'ASSIGNED' && !b.isSubmerged
  )

  const handleDecrease = () => {
    playSound('click')
    setTimerSeconds((prev) => Math.max(MIN_SECONDS, prev - STEP_SECONDS))
  }

  const handleIncrease = () => {
    playSound('click')
    setTimerSeconds((prev) => Math.min(MAX_SECONDS, prev + STEP_SECONDS))
  }

  const handleConfirm = () => {
    if (selectedBasket === null) return
    playSound('confirm')
    onConfirm(selectedBasket, timerSeconds)
  }

  const handleCancel = () => {
    playSound('cancel')
    onCancel()
  }

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  // v3.3: 바스켓 선택 가능 여부 판단
  const isBasketSelectable = (basket: FryerBasket) => {
    // orderId가 없으면 선택 불가 (묶음 미배정)
    if (!basket.orderId) return false
    // ASSIGNED 상태 + 올라와 있어야 선택 가능
    return basket.status === 'ASSIGNED' && !basket.isSubmerged
  }

  // v3.3: 바스켓 상태에 따른 UI 정보 (isSubmerged 기반)
  const getBasketStatusInfo = (basket: FryerBasket) => {
    // orderId 없음 → 비어있음
    if (!basket.orderId) {
      return { label: '비어있음', color: 'bg-indigo-100 border-gray-300', emoji: '🧺', selectable: false }
    }

    // BURNED 상태
    if (basket.status === 'BURNED') {
      return { label: '탐 — 청소 필요', color: 'bg-red-100 border-red-400', emoji: '🔥', selectable: false }
    }

    // ASSIGNED 상태 → isSubmerged로 세분화
    if (basket.isSubmerged) {
      // 기름에 잠김 → 튀기는 중
      return { label: '튀기는 중', color: 'bg-amber-100 border-amber-400', emoji: '🔥', selectable: false }
    } else {
      // 올라와 있음 → 재료 투입 가능
      return { label: '대기 중 — 재료 투입 가능', color: 'bg-blue-100 border-blue-400', emoji: '📦', selectable: true }
    }
  }

  return createPortal(
    <>
      {/* 배경 오버레이 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[9998]"
        onClick={handleCancel}
      />

      {/* 팝업 컨테이너 - 뷰포트 정중앙 (flex 패턴) */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto
                     bg-gradient-to-br from-amber-100 to-orange-100
                     rounded-xl shadow-2xl border-4 border-amber-500 pointer-events-auto"
        >
        {/* 헤더 */}
        <div className="p-4 border-b border-amber-300 bg-gradient-to-r from-amber-500 to-orange-500">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <span className="text-2xl">🍟</span>
            튀김기 설정
          </h3>
          <p className="text-amber-100 text-xs mt-1">
            바스켓과 타이머를 설정하세요
          </p>
        </div>

        {/* 선택된 재료 */}
        <div className="p-4 bg-amber-50 border-b border-amber-200">
          <div className="text-xs font-medium text-amber-700 mb-2">튀길 재료</div>
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ing) => (
              <span
                key={ing.id}
                className="px-2 py-1 bg-white border border-amber-200 rounded text-sm font-medium text-amber-800"
              >
                {ing.name}
              </span>
            ))}
          </div>
        </div>

        {/* 바스켓 선택 */}
        <div className="p-4 border-b border-amber-200">
          <div className="text-sm font-bold text-amber-800 mb-3">바스켓 선택</div>
          {selectableBaskets.length === 0 ? (
            <div className="text-center text-amber-600 py-4">
              <div className="text-lg mb-1">사용 가능한 바스켓이 없습니다</div>
              <div className="text-xs text-amber-500">
                먼저 메뉴를 튀김기에 배정해주세요
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {fryerState.baskets.map((basket) => {
                const info = getBasketStatusInfo(basket)
                const canSelect = isBasketSelectable(basket)
                const isSelected = selectedBasket === basket.basketNumber

                return (
                  <button
                    key={basket.basketNumber}
                    type="button"
                    onClick={() => {
                      if (canSelect) {
                        playSound('click')
                        setSelectedBasket(basket.basketNumber)
                      }
                    }}
                    disabled={!canSelect}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-400 to-orange-400 border-amber-600 text-white shadow-lg scale-105'
                        : canSelect
                        ? 'bg-white border-amber-200 text-amber-800 hover:border-amber-400'
                        : `${info.color} opacity-60 cursor-not-allowed`
                    }`}
                  >
                    <div className="text-2xl text-center">{info.emoji}</div>
                    <div className="text-sm font-bold text-center mt-1">
                      {basket.basketNumber}번
                    </div>
                    <div className={`text-xs text-center mt-0.5 leading-tight ${isSelected ? 'text-amber-100' : ''}`}>
                      {info.label}
                    </div>
                    {/* 메뉴명 표시 (배정된 경우) */}
                    {basket.menuName && (
                      <div className={`text-[10px] text-center mt-1 truncate ${isSelected ? 'text-amber-200' : 'text-gray-500'}`}>
                        {basket.menuName}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 타이머 설정 */}
        <div className="p-4">
          <div className="text-sm font-bold text-amber-800 mb-3">타이머</div>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleDecrease}
              disabled={timerSeconds <= MIN_SECONDS}
              className="w-12 h-12 rounded-full bg-amber-200 hover:bg-amber-300
                         text-amber-800 font-bold text-2xl
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors flex items-center justify-center"
            >
              −
            </button>

            <div className="w-32 text-center">
              <input
                type="number"
                value={timerSeconds}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val)) {
                    setTimerSeconds(Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, val)))
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full text-4xl font-bold text-amber-900 font-mono text-center
                           bg-transparent border-b-2 border-amber-300 focus:border-amber-500
                           outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none
                           [&::-webkit-outer-spin-button]:appearance-none"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
              />
              <div className="text-xs text-amber-600 mt-1">
                초 ({formatTime(timerSeconds)})
              </div>
            </div>

            <button
              type="button"
              onClick={handleIncrease}
              disabled={timerSeconds >= MAX_SECONDS}
              className="w-12 h-12 rounded-full bg-amber-200 hover:bg-amber-300
                         text-amber-800 font-bold text-2xl
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>

          {/* 빠른 선택 버튼 */}
          <div className="flex justify-center gap-2 mt-3">
            {[60, 120, 180, 240, 300].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  playSound('click')
                  setTimerSeconds(sec)
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  timerSeconds === sec
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-200 text-amber-700 hover:bg-amber-300'
                }`}
              >
                {sec / 60}분
              </button>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t border-amber-300 bg-amber-50 flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-3 rounded-lg bg-gray-200 hover:bg-gray-300
                       text-gray-700 font-bold text-sm"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedBasket === null || selectableBaskets.length === 0}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500
                       hover:from-amber-600 hover:to-orange-600
                       text-white font-bold text-sm shadow-md
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            재료 투입
          </button>
        </div>
        </motion.div>
      </div>
    </>,
    document.body
  )
}

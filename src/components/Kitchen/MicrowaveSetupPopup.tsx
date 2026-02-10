import { useState } from 'react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useSound } from '../../hooks/useSound'
import { useGameStore } from '../../stores/gameStore'
import type { MenuOrder } from '../../types/database.types'

interface SelectedIngredientItem {
  id: string
  name: string
  sku: string
  amount: number
  unit: string
  raw: any
  ingredientMasterId?: string
}

type PowerLevel = 'LOW' | 'MEDIUM' | 'HIGH'

interface MicrowaveSetupPopupProps {
  ingredients: SelectedIngredientItem[]
  onConfirm: (timerSeconds: number, power: PowerLevel, orderId: string, bundleId: string, ingredientAmounts: Array<{ name: string; amount: number; unit: string }>) => void
  onCancel: () => void
}

const POWER_OPTIONS: { value: PowerLevel; label: string; emoji: string; color: string }[] = [
  { value: 'LOW', label: '약', emoji: '🔥', color: 'from-green-400 to-green-500' },
  { value: 'MEDIUM', label: '중', emoji: '🔥🔥', color: 'from-yellow-400 to-orange-500' },
  { value: 'HIGH', label: '강', emoji: '🔥🔥🔥', color: 'from-orange-500 to-red-500' },
]

const MIN_SECONDS = 1  // v3.1: 테스트를 위해 1초부터 허용
const MAX_SECONDS = 300
const STEP_SECONDS = 10

/**
 * 전자레인지 설정 팝업
 * - 주문 선택: WAITING 상태 + MICROWAVE 묶음이 있는 메뉴만
 * - 복수 선택 가능
 * - 타이머: 1초 ~ 300초 (10초 단위)
 * - 파워: 약/중/강
 * v3.1 Fix: MICROWAVE 묶음 필터링 + 복수 선택
 */
export default function MicrowaveSetupPopup({
  ingredients,
  onConfirm,
  onCancel,
}: MicrowaveSetupPopupProps) {
  const { playSound } = useSound()
  const { menuQueue, microwaveState, recipeBundles, getRecipeByMenuName } = useGameStore()
  const [timerSeconds, setTimerSeconds] = useState(60)
  const [power, setPower] = useState<PowerLevel>('MEDIUM')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => {
    // 기본값: 전자레인지에 배정된 주문이 있으면 그것 선택
    if (microwaveState.currentItem?.orderId) {
      return new Set([microwaveState.currentItem.orderId])
    }
    return new Set()
  })
  // v3.1: 각 재료별 수량 입력
  const [ingredientAmounts, setIngredientAmounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    ingredients.forEach((ing) => {
      initial[ing.id] = ing.amount
    })
    return initial
  })

  // MICROWAVE 묶음이 있는 메뉴인지 확인
  const hasMicrowaveBundle = (menuName: string): boolean => {
    const recipe = getRecipeByMenuName(menuName)
    if (!recipe) {
      console.log(`🔍 hasMicrowaveBundle: 레시피 없음 - menuName="${menuName}"`)
      return false
    }

    // 해당 레시피의 묶음 중 MICROWAVE cooking_type이 있는지 확인
    const bundles = recipeBundles.filter((b) => b.recipe_id === recipe.id)
    const hasMicrowave = bundles.some((b) => b.cooking_type === 'MICROWAVE')

    console.log(`🔍 hasMicrowaveBundle: menuName="${menuName}", recipeId=${recipe.id}, bundlesCount=${bundles.length}, cookingTypes=${bundles.map(b => b.cooking_type).join(',')}, hasMicrowave=${hasMicrowave}`)

    return hasMicrowave
  }

  // MICROWAVE 묶음의 bundleId 찾기 - v3.1 Fix: 선택한 재료 기반으로 올바른 묶음 찾기
  const getMicrowaveBundleIdForIngredients = (menuName: string, selectedIngredients: SelectedIngredientItem[]): string => {
    const recipe = getRecipeByMenuName(menuName)
    if (!recipe) return ''

    // 해당 레시피의 모든 MICROWAVE 묶음 조회
    const microwaveBundles = recipeBundles.filter(
      (b) => b.recipe_id === recipe.id && b.cooking_type === 'MICROWAVE'
    )

    if (microwaveBundles.length === 0) return ''
    if (microwaveBundles.length === 1) return microwaveBundles[0].id

    // 여러 MICROWAVE 묶음이 있을 때: 선택한 재료가 속한 묶음 찾기
    // v3.1 Fix: ingredient_master_id 추출 경로 다양화
    const selectedIngredientMasterIds = selectedIngredients
      .map((ing) => {
        // 1. 직접 설정된 ingredientMasterId
        if (ing.ingredientMasterId) return ing.ingredientMasterId
        // 2. raw 객체의 ingredient_master_id (IngredientInventory 구조)
        if (ing.raw?.ingredient_master_id) return ing.raw.ingredient_master_id
        // 3. raw.ingredient_master?.id (중첩 구조)
        if (ing.raw?.ingredient_master?.id) return ing.raw.ingredient_master.id
        return null
      })
      .filter(Boolean) as string[]

    console.log('🔍 전자레인지 묶음 검색:', {
      menuName,
      microwaveBundlesCount: microwaveBundles.length,
      selectedIngredientMasterIds,
      selectedIngredientsRaw: selectedIngredients.map((ing) => ({
        name: ing.name,
        ingredientMasterId: ing.ingredientMasterId,
        rawIngredientMasterId: ing.raw?.ingredient_master_id,
        rawIngredientMasterNestedId: ing.raw?.ingredient_master?.id,
      })),
    })

    for (const bundle of microwaveBundles) {
      // 묶음의 recipe_steps에서 모든 ingredient_master_id 추출
      const bundleIngredientMasterIds = new Set<string>()
      const steps = (bundle as any).recipe_steps ?? []
      for (const step of steps) {
        const ingredients = step.recipe_ingredients ?? []
        for (const ing of ingredients) {
          if (ing.ingredient_master_id) {
            bundleIngredientMasterIds.add(ing.ingredient_master_id)
          }
        }
      }

      console.log(`🔍 묶음 "${bundle.bundle_name}" (${bundle.id}):`, {
        stepsCount: steps.length,
        bundleIngredientMasterIds: Array.from(bundleIngredientMasterIds),
        actionParams: steps.find((s: any) => s.action_type === 'MICROWAVE')?.action_params,
      })

      // 선택한 재료 중 하나라도 이 묶음에 속하면 해당 bundleId 반환
      const matchFound = selectedIngredientMasterIds.some((id) => bundleIngredientMasterIds.has(id))
      if (matchFound) {
        console.log(`✅ 전자레인지 묶음 매칭: ${bundle.bundle_name} (${bundle.id})`)
        return bundle.id
      }
    }

    // 매칭 안 되면 첫 번째 MICROWAVE 묶음 반환 (fallback)
    console.log(`⚠️ 전자레인지 묶음 매칭 실패, 첫 번째 묶음 사용: ${microwaveBundles[0].bundle_name}`)
    return microwaveBundles[0].id
  }

  // 선택 가능한 주문: MICROWAVE 묶음이 있는 메뉴 + (전자레인지 배정됨 또는 WAITING/IN_PROGRESS)
  const selectableOrders = menuQueue.filter((o) => {
    // MICROWAVE 묶음이 있는 메뉴인지 확인
    if (!hasMicrowaveBundle(o.menuName)) return false

    // 전자레인지에 배정된 주문
    if (microwaveState.currentItem?.orderId === o.id) return true
    // WAITING 또는 COOKING 상태 주문 (v3.1 Fix: MIXED 메뉴의 다른 묶음이 조리 중일 때도 전자레인지 사용 가능)
    if (o.status === 'WAITING' || o.status === 'COOKING') return true
    return false
  })

  // 디버깅 로그
  console.log('🔍 전자레인지 주문 필터링:', {
    menuQueueCount: menuQueue.length,
    menuQueueOrders: menuQueue.map(o => ({ id: o.id, menuName: o.menuName, status: o.status })),
    selectableOrdersCount: selectableOrders.length,
    selectableOrders: selectableOrders.map(o => ({ id: o.id, menuName: o.menuName, status: o.status })),
    microwaveCurrentOrderId: microwaveState.currentItem?.orderId,
  })

  // 주문 토글
  const toggleOrder = (orderId: string) => {
    playSound('click')
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const handleDecrease = () => {
    playSound('click')
    setTimerSeconds((prev) => Math.max(MIN_SECONDS, prev - STEP_SECONDS))
  }

  const handleIncrease = () => {
    playSound('click')
    setTimerSeconds((prev) => Math.min(MAX_SECONDS, prev + STEP_SECONDS))
  }

  const handleConfirm = () => {
    if (selectedOrderIds.size === 0) return
    playSound('confirm')

    // v3.3 Fix: 모든 선택된 주문에 대해 처리 (복수 선택 지원)
    const orderIds = Array.from(selectedOrderIds)

    // v3.1: 재료 정보 생성 (모든 주문에 동일하게 적용)
    const ingredientList = ingredients.map((ing) => ({
      name: ing.name,
      amount: ingredientAmounts[ing.id] || ing.amount,
      unit: ing.unit,
    }))

    // 각 주문에 대해 onConfirm 호출
    orderIds.forEach((orderId) => {
      const order = menuQueue.find((o) => o.id === orderId)
      if (!order) return

      // v3.1 Fix: 항상 선택한 재료 기반으로 bundleId 찾기
      const bundleId = getMicrowaveBundleIdForIngredients(order.menuName, ingredients)

      console.log(`📡 전자레인지 시작: ${order.menuName} (orderId=${orderId}, bundleId=${bundleId})`)
      onConfirm(timerSeconds, power, orderId, bundleId, ingredientList)
    })
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

  // 주문 상태에 따른 UI 정보
  const getOrderStatusInfo = (order: MenuOrder) => {
    // 전자레인지에 배정된 주문
    if (microwaveState.currentItem?.orderId === order.id) {
      return { label: '전자레인지 배정됨', color: 'bg-slate-100 border-slate-400', emoji: '📡', selectable: true }
    }
    // WAITING 상태
    if (order.status === 'WAITING') {
      return { label: '대기 중', color: 'bg-blue-100 border-blue-400', emoji: '⏳', selectable: true }
    }
    // COOKING 상태 (v3.1 Fix: MIXED 메뉴의 다른 묶음이 조리 중일 때도 선택 가능)
    if (order.status === 'COOKING') {
      return { label: '다른 묶음 조리 중', color: 'bg-amber-100 border-amber-400', emoji: '🔥', selectable: true }
    }
    return { label: '사용 불가', color: 'bg-gray-100 border-gray-300', emoji: '❌', selectable: false }
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
                     bg-gradient-to-br from-slate-100 to-slate-200
                     rounded-xl shadow-2xl border-4 border-slate-500 pointer-events-auto"
        >
        {/* 헤더 */}
        <div className="p-4 border-b border-slate-300 bg-gradient-to-r from-slate-600 to-slate-700">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <span className="text-2xl">📡</span>
            전자레인지 설정
          </h3>
          <p className="text-slate-200 text-xs mt-1">
            주문을 선택하고 타이머와 파워를 설정하세요
          </p>
        </div>

        {/* 선택된 재료 + 수량 입력 */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="text-xs font-medium text-slate-500 mb-3">조리할 재료 (수량을 입력하세요)</div>
          <div className="space-y-2">
            {ingredients.map((ing) => (
              <div
                key={ing.id}
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-bold text-slate-800 text-sm">{ing.name}</div>
                  <div className="text-xs text-slate-500">기본: {ing.amount}{ing.unit}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click')
                      setIngredientAmounts((prev) => ({
                        ...prev,
                        [ing.id]: Math.max(1, (prev[ing.id] || ing.amount) - 1)
                      }))
                    }}
                    className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={ingredientAmounts[ing.id] || ing.amount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val) && val >= 1) {
                        setIngredientAmounts((prev) => ({ ...prev, [ing.id]: val }))
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-16 text-center bg-white border-2 border-slate-300 rounded py-1 font-bold text-slate-800
                               focus:border-slate-500 outline-none
                               [&::-webkit-inner-spin-button]:appearance-none
                               [&::-webkit-outer-spin-button]:appearance-none"
                    min={1}
                  />
                  <span className="text-xs text-slate-600 font-medium w-8">{ing.unit}</span>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click')
                      setIngredientAmounts((prev) => ({
                        ...prev,
                        [ing.id]: (prev[ing.id] || ing.amount) + 1
                      }))
                    }}
                    className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 주문 선택 (복수 선택 가능) */}
        <div className="p-4 border-b border-slate-200">
          <div className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
            <span>주문 선택</span>
            <span className="text-xs font-normal text-slate-500">
              {selectedOrderIds.size > 0 && `${selectedOrderIds.size}개 선택됨`}
            </span>
          </div>
          {selectableOrders.length === 0 ? (
            <div className="text-center text-slate-500 py-4">
              <div className="text-lg mb-1">전자레인지 조리가 필요한 주문이 없습니다</div>
              <div className="text-xs text-slate-400">
                MICROWAVE 묶음이 포함된 주문을 기다려주세요
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {selectableOrders.map((order) => {
                const info = getOrderStatusInfo(order)
                const isSelected = selectedOrderIds.has(order.id)

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => toggleOrder(order.id)}
                    disabled={!info.selectable}
                    className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-gradient-to-r from-slate-500 to-slate-600 border-slate-700 text-white shadow-lg'
                        : info.selectable
                        ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                        : `${info.color} opacity-60 cursor-not-allowed`
                    }`}
                  >
                    {/* 체크박스 */}
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      isSelected
                        ? 'bg-white border-white text-slate-600'
                        : 'border-slate-300 text-transparent'
                    }`}>
                      ✓
                    </div>
                    <div className="text-2xl">{info.emoji}</div>
                    <div className="flex-1 text-left">
                      <div className={`font-bold ${isSelected ? 'text-white' : ''}`}>
                        {order.menuName}
                      </div>
                      <div className={`text-xs ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                        {info.label}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 타이머 설정 */}
        <div className="p-4 border-b border-slate-200">
          <div className="text-sm font-bold text-slate-700 mb-3">타이머</div>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleDecrease}
              disabled={timerSeconds <= MIN_SECONDS}
              className="w-12 h-12 rounded-full bg-slate-200 hover:bg-slate-300
                         text-slate-700 font-bold text-2xl
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
                className="w-full text-4xl font-bold text-slate-800 font-mono text-center
                           bg-transparent border-b-2 border-slate-300 focus:border-slate-500
                           outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none
                           [&::-webkit-outer-spin-button]:appearance-none"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
              />
              <div className="text-xs text-slate-500 mt-1">
                초 ({formatTime(timerSeconds)})
              </div>
            </div>

            <button
              type="button"
              onClick={handleIncrease}
              disabled={timerSeconds >= MAX_SECONDS}
              className="w-12 h-12 rounded-full bg-slate-200 hover:bg-slate-300
                         text-slate-700 font-bold text-2xl
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors flex items-center justify-center"
            >
              +
            </button>
          </div>

          {/* 빠른 선택 버튼 */}
          <div className="flex justify-center gap-2 mt-3">
            {[30, 60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  playSound('click')
                  setTimerSeconds(sec)
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  timerSeconds === sec
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {sec >= 60 ? `${sec / 60}분` : `${sec}초`}
              </button>
            ))}
          </div>
        </div>

        {/* 파워 선택 */}
        <div className="p-4">
          <div className="text-sm font-bold text-slate-700 mb-3">파워</div>
          <div className="grid grid-cols-3 gap-3">
            {POWER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  playSound('click')
                  setPower(option.value)
                }}
                className={`p-3 rounded-xl border-2 transition-all ${
                  power === option.value
                    ? `bg-gradient-to-r ${option.color} border-transparent text-white shadow-lg scale-105`
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="text-2xl text-center">{option.emoji}</div>
                <div className="text-sm font-bold text-center mt-1">{option.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t border-slate-300 bg-slate-100 flex gap-3">
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
            disabled={selectedOrderIds.size === 0 || selectableOrders.length === 0}
            className="flex-1 py-3 rounded-lg bg-gradient-to-r from-slate-500 to-slate-600
                       hover:from-slate-600 hover:to-slate-700
                       text-white font-bold text-sm shadow-md
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            시작 ({selectedOrderIds.size}개)
          </button>
        </div>
        </motion.div>
      </div>
    </>,
    document.body
  )
}

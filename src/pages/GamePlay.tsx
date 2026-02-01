import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import { selectRandomMenu } from '../stores/gameStore'
import { MENU_INTERVAL_MS, MENUS_PER_INTERVAL, buildSeasoningSKU } from '../types/database.types'
import type { IngredientInventory, Seasoning } from '../types/database.types'
import GameHeader from '../components/Game/GameHeader'
import ActionLogPanel from '../components/Game/ActionLogPanel'
import RecipeGuide from '../components/Game/RecipeGuide'
import MenuQueue from '../components/Menu/MenuQueue'
import SinkArea from '../components/Kitchen/SinkArea'
import Burner from '../components/Kitchen/Burner'
import WokDryingManager from '../components/Kitchen/WokDryingManager'
import DrawerFridge from '../components/Kitchen/DrawerFridge'
import FridgeBox from '../components/Kitchen/FridgeBox'
import FridgeZoomView from '../components/Kitchen/FridgeZoomView'
import SeasoningCounter from '../components/Kitchen/SeasoningCounter'
import AmountInputPopup from '../components/Kitchen/AmountInputPopup'
import BatchAmountInputPopup from '../components/Kitchen/BatchAmountInputPopup'

type AmountPopupState =
  | null
  | {
      type: 'ingredient'
      ingredient: IngredientInventory
      targetWok: number
      requiredAmount: number
      requiredUnit: string
    }
  | {
      type: 'seasoning'
      seasoning: Seasoning
      targetWok: number
      requiredAmount: number
      requiredUnit: string
    }

type BatchInputState = {
  ingredients: Array<{
    id: string
    name: string
    sku: string
    standardAmount: number
    standardUnit: string
    raw: any
  }>
} | null

export default function GamePlay() {
  const navigate = useNavigate()
  const {
    level,
    isPlaying,
    woks,
    completedMenus,
    targetMenus,
    assignMenuToWok,
    validateAndAdvanceIngredient,
    recordBurnerUsage,
    updateWokTemperatures,
    checkMenuTimers,
    endGame,
    getCurrentStepIngredients,
    fridgeViewState,
    openFridgeZoom,
    lastServeError,
  } = useGameStore()

  const [selectedBurner, setSelectedBurner] = useState<number | null>(null)
  const [amountPopup, setAmountPopup] = useState<AmountPopupState>(null)
  const [batchInputPopup, setBatchInputPopup] = useState<BatchInputState>(null)
  const [toast, setToast] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const burnerUsageRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tempUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isPlaying) return
    const interval = MENU_INTERVAL_MS[level]
    const count = MENUS_PER_INTERVAL[level]
    const tick = () => {
      const state = useGameStore.getState()
      if (state.completedMenus >= state.targetMenus) return
      for (let i = 0; i < count; i++) {
        const recipe = selectRandomMenu(state.recipes, state.usedMenuNames)
        if (recipe) {
          state.addMenuToQueue(recipe.menu_name)
          console.log('🍳 새 주문:', recipe.menu_name)
        }
      }
    }
    tick()
    intervalRef.current = setInterval(tick, interval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, level])

  useEffect(() => {
    if (!isPlaying) return
    timerRef.current = setInterval(() => {
      useGameStore.getState().tickTimer()
      useGameStore.getState().checkMenuTimers() // 타이머 체크 추가
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!isPlaying) return
    burnerUsageRef.current = setInterval(() => recordBurnerUsage(), 1000)
    return () => {
      if (burnerUsageRef.current) clearInterval(burnerUsageRef.current)
    }
  }, [isPlaying, recordBurnerUsage])

  // 웍 온도 업데이트 (1초마다)
  useEffect(() => {
    if (!isPlaying) return
    tempUpdateRef.current = setInterval(() => updateWokTemperatures(), 1000)
    return () => {
      if (tempUpdateRef.current) clearInterval(tempUpdateRef.current)
    }
  }, [isPlaying, updateWokTemperatures])

  useEffect(() => {
    if (completedMenus >= targetMenus) {
      endGame().then(() => navigate('/result'))
    }
  }, [completedMenus, targetMenus, endGame, navigate])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const targetWokForIngredient = woks.find((w) => w.currentMenu)?.burnerNumber ?? null

  const handleAssignToWok = (orderId: string, burnerNumber: number) => {
    assignMenuToWok(orderId, burnerNumber)
    setSelectedBurner(null)
  }

  const handleSelectIngredient = (ingredient: IngredientInventory) => {
    // 메뉴가 배정된 웍이 하나도 없으면 경고
    const woksWithMenu = woks.filter((w) => w.currentMenu)
    if (woksWithMenu.length === 0) {
      showToast('먼저 메뉴를 배정하세요.')
      return
    }
    // 각 웍의 현재 단계에서 요구하는 양 찾기
    let maxRequired = ingredient.standard_amount
    woksWithMenu.forEach((wok) => {
      const reqs = getCurrentStepIngredients(wok.currentMenu!, wok.currentStep)
      const match = reqs.find((r) => r.required_sku === ingredient.sku_full)
      if (match && match.required_amount > maxRequired) {
        maxRequired = match.required_amount
      }
    })
    setAmountPopup({
      type: 'ingredient',
      ingredient,
      targetWok: 0, // 더 이상 사용 안 함
      requiredAmount: maxRequired,
      requiredUnit: ingredient.standard_unit,
    })
  }

  // 다중 식재료 선택 핸들러 (배치 입력 모드)
  const handleSelectMultipleIngredients = (selectedIngredients: any[]) => {
    const woksWithMenu = woks.filter((w) => w.currentMenu)
    if (woksWithMenu.length === 0) {
      showToast('먼저 메뉴를 배정하세요.')
      return
    }

    setBatchInputPopup({
      ingredients: selectedIngredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        sku: ing.sku,
        standardAmount: ing.amount,
        standardUnit: ing.unit,
        raw: ing.raw,
      })),
    })
  }

  const handleSelectSeasoning = (seasoning: Seasoning, requiredAmount: number, requiredUnit: string) => {
    const woksWithMenu = woks.filter((w) => w.currentMenu)
    if (woksWithMenu.length === 0) {
      showToast('먼저 메뉴를 배정하세요.')
      return
    }
    let maxRequired = requiredAmount || 10
    woksWithMenu.forEach((wok) => {
      const reqs = getCurrentStepIngredients(wok.currentMenu!, wok.currentStep)
      const match = reqs.find((r) => r.required_sku.startsWith(`SEASONING:${seasoning.seasoning_name}:`))
      if (match && match.required_amount > maxRequired) {
        maxRequired = match.required_amount
      }
    })
    setAmountPopup({
      type: 'seasoning',
      seasoning,
      targetWok: 0,
      requiredAmount: maxRequired,
      requiredUnit: requiredUnit || seasoning.base_unit,
    })
  }

  const handleConfirmAmount = (amountsByWok: Record<number, number>) => {
    if (!amountPopup) return
    
    const results: { burner: number; ok: boolean }[] = []
    
    // 각 웍에 대해 지정된 양만큼 투입
    Object.entries(amountsByWok).forEach(([burnerStr, amount]) => {
      const burnerNumber = Number(burnerStr)
      if (amount === 0) return // 0이면 스킵
      
      const wok = woks.find((w) => w.burnerNumber === burnerNumber)
      if (!wok?.currentMenu) return // 메뉴 없으면 스킵
      
      let ok = false
      if (amountPopup.type === 'ingredient') {
        ok = validateAndAdvanceIngredient(
          burnerNumber,
          amountPopup.ingredient.sku_full,
          amount,
          false
        )
      } else {
        const sku = buildSeasoningSKU(
          amountPopup.seasoning.seasoning_name,
          amount,
          amountPopup.seasoning.base_unit
        )
        ok = validateAndAdvanceIngredient(burnerNumber, sku, amount, true)
      }
      results.push({ burner: burnerNumber, ok })
    })
    
    // 결과 토스트
    const successCount = results.filter((r) => r.ok).length
    const failCount = results.filter((r) => !r.ok).length
    if (successCount > 0 && failCount === 0) {
      showToast(`✅ 모두 정확합니다! (${successCount}개 웍)`)
    } else if (successCount > 0) {
      showToast(`⚠️ ${successCount}개 성공, ${failCount}개 오류`)
    } else if (failCount > 0) {
      showToast(`❌ 틀렸습니다! (${failCount}개 웍)`)
    }
    
    setAmountPopup(null)
  }

  // 배치 입력 확인 핸들러
  const handleBatchConfirm = (assignments: Array<{ sku: string; burnerNumber: number; amount: number; raw: any }>) => {
    const results: { burner: number; sku: string; ok: boolean }[] = []

    assignments.forEach(({ sku, burnerNumber, amount, raw }) => {
      const wok = woks.find((w) => w.burnerNumber === burnerNumber)
      if (!wok?.currentMenu) return

      const ok = validateAndAdvanceIngredient(burnerNumber, sku, amount, false)
      results.push({ burner: burnerNumber, sku, ok })
    })

    // 결과 토스트
    const successCount = results.filter((r) => r.ok).length
    const failCount = results.filter((r) => !r.ok).length
    
    if (successCount > 0 && failCount === 0) {
      showToast(`✅ 모두 정확합니다! (${successCount}개 투입)`)
    } else if (successCount > 0) {
      showToast(`⚠️ ${successCount}개 성공, ${failCount}개 오류`)
    } else if (failCount > 0) {
      showToast(`❌ 틀렸습니다! (${failCount}개 투입)`)
    }

    setBatchInputPopup(null)
  }

  const burnerUsageHistory = useGameStore((s) => s.burnerUsageHistory)
  const burnerUsagePercent =
    burnerUsageHistory.length > 0
      ? Math.round(
          (burnerUsageHistory.reduce((s, l) => s + l.activeBurners.length, 0) /
            (burnerUsageHistory.length * 3)) *
            100
        )
      : 0

  // 레벨 선택(게임 시작)이 완료되지 않았으면 /level-select로 리다이렉트
  if (!isPlaying) {
    navigate('/level-select', { replace: true })
    return null
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 min-w-[1280px] min-h-screen">
      <WokDryingManager />
      <GameHeader />

      {/* 주문서 (상단 중앙 고정) - 주방 알림판 스타일 */}
      <div className="px-4 py-3 bg-gradient-to-r from-yellow-50 via-white to-yellow-50 border-b-4 border-yellow-400 shadow-md">
        <MenuQueue onAssignToWok={handleAssignToWok} selectedBurner={selectedBurner} />
      </div>

      {/* 주방 레이아웃: 왼쪽(싱크대+4호박스) | 중앙(화구+서랍) | 오른쪽(조미료대) */}
      <div className="flex pb-12 pt-8 px-6">
        {/* 왼쪽: 싱크대(위) + 4호박스(아래) */}
        <div className="w-[230px] flex flex-col gap-4 my-8">
          {/* 싱크대 */}
          <div className="w-full">
            <SinkArea />
          </div>
          
          {/* 4호박스 냉장고 - 실버 스테인리스 스타일 */}
          <div className="w-full p-4 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 border-2 border-gray-300 rounded-xl shadow-xl flex-1 flex flex-col"
               style={{
                 backgroundImage: `
                   linear-gradient(135deg, 
                     rgba(255,255,255,0.8) 0%, 
                     rgba(200,200,200,0.3) 25%,
                     rgba(255,255,255,0.5) 50%, 
                     rgba(200,200,200,0.3) 75%,
                     rgba(255,255,255,0.8) 100%)
                 `,
                 boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.9), 0 8px 20px rgba(0,0,0,0.15)'
               }}>
            <div className="text-xs font-bold text-gray-700 mb-3 px-2 py-1 bg-white/60 rounded text-center tracking-wider border border-gray-300">
              🧊 4호박스 냉장고
            </div>
            <button
              type="button"
              onClick={() => openFridgeZoom('FRIDGE_ALL')}
              className="w-full group flex-1 flex items-center"
            >
              <div className="grid grid-cols-2 gap-2 w-full">
                {['FRIDGE_LT', 'FRIDGE_RT', 'FRIDGE_LB', 'FRIDGE_RB'].map((code, index) => {
                  const labels = ['좌상', '우상', '좌하', '우하']
                  return (
                    <div
                      key={code}
                      className="h-28 rounded-lg bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 shadow-md group-hover:shadow-xl border-2 border-gray-300 text-gray-700 font-bold text-xs transition-all flex items-center justify-center relative overflow-hidden"
                      style={{
                        backgroundImage: `
                          linear-gradient(135deg, 
                            rgba(255,255,255,0.9) 0%, 
                            rgba(220,220,220,0.5) 50%, 
                            rgba(255,255,255,0.9) 100%)
                        `,
                        boxShadow: 'inset 0 1px 3px rgba(255,255,255,1), 0 4px 8px rgba(0,0,0,0.1)'
                      }}
                    >
                      {/* 문 손잡이 */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-16 bg-gray-400 rounded-full shadow-inner"></div>
                      <div className="relative z-10 flex flex-col items-center gap-1">
                        <div className="text-xl">❄️</div>
                        <div>{labels[index]}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </button>
          </div>
        </div>

        {/* 중앙: 화구 + 서랍냉장고 */}
        <div className="flex-1 flex flex-col gap-8 px-6 items-center my-8">
          {/* 화구 3개 가로 배치 - 밝은 스테인리스 화구대 */}
          <div className="flex gap-16 items-end bg-gradient-to-b from-gray-300 via-gray-200 to-gray-300 px-16 py-10 rounded-2xl shadow-xl border-2 border-gray-400"
               style={{
                 backgroundImage: `
                   linear-gradient(135deg, 
                     rgba(255,255,255,0.6) 0%, 
                     rgba(200,200,200,0.4) 50%, 
                     rgba(255,255,255,0.6) 100%)
                 `,
                 boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.9), 0 10px 30px rgba(0,0,0,0.2)'
               }}>
            {[1, 2, 3].map((n) => (
              <Burner key={n} burnerNumber={n} />
            ))}
          </div>

          {/* 서랍냉장고 - 실버 스테인리스 서랍 스타일 */}
          <div className="w-full max-w-[700px] flex-1 flex items-end">
            <DrawerFridge 
              onSelectIngredient={handleSelectIngredient}
              onSelectMultiple={handleSelectMultipleIngredients}
            />
          </div>
        </div>

        {/* 오른쪽: 조미료대 - 밝은 선반 스타일 */}
        <div className="w-48 flex flex-col my-8">
          <SeasoningCounter onSelectSeasoning={handleSelectSeasoning} />
        </div>
      </div>

      {/* 레시피 가이드 */}
      <div className="py-6 px-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-t-4 border-blue-300">
        <RecipeGuide />
      </div>

      {/* 액션 로그 & 화구 사용율 */}
      <div className="grid grid-cols-2 gap-3 px-4 py-6 bg-gradient-to-br from-gray-100 to-gray-200 border-t-4 border-gray-300 mb-12">
        <div className="bg-white/80 p-4 rounded-lg border-2 border-gray-300 shadow-md">
          <h4 className="font-bold text-gray-700 mb-2 text-xs tracking-wider flex items-center gap-2">
            <span>📋</span> 액션 로그
          </h4>
          <ActionLogPanel />
        </div>
        <div className="bg-white/80 p-4 rounded-lg border-2 border-gray-300 shadow-md">
          <h4 className="font-bold text-gray-700 mb-2 text-xs tracking-wider flex items-center gap-2">
            <span>🔥</span> 화구 사용율
          </h4>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-orange-400 via-red-500 to-red-600 rounded-full transition-all shadow-md"
                style={{ 
                  width: `${Math.min(100, burnerUsagePercent)}%`,
                  boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)'
                }}
              />
            </div>
            <span className="font-mono font-bold text-sm text-gray-700 min-w-[3rem] text-right">{burnerUsagePercent}%</span>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-xl bg-white text-gray-800 shadow-2xl z-50 border-2 border-gray-300 font-bold">
          {toast}
        </div>
      )}

      {amountPopup && (
        <AmountInputPopup
          title={
            amountPopup.type === 'ingredient'
              ? amountPopup.ingredient.ingredient_master?.ingredient_name ?? amountPopup.ingredient.sku_full
              : amountPopup.seasoning.seasoning_name
          }
          requiredAmount={amountPopup.requiredAmount}
          requiredUnit={amountPopup.requiredUnit}
          onConfirm={handleConfirmAmount}
          onCancel={() => setAmountPopup(null)}
        />
      )}

      {/* 4호박스 줌뷰 */}
      {fridgeViewState !== 'CLOSED' && (
        <FridgeZoomView 
          onSelectIngredient={handleSelectIngredient}
          onSelectMultiple={handleSelectMultipleIngredients}
        />
      )}

      {/* 배치 입력 팝업 */}
      {batchInputPopup && (
        <BatchAmountInputPopup
          ingredients={batchInputPopup.ingredients}
          onConfirm={handleBatchConfirm}
          onCancel={() => setBatchInputPopup(null)}
        />
      )}

      {/* 레시피 오류 알림 (신입이 아닐 때만, 서빙 시 3초간 표시) */}
      {lastServeError && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-orange-500 text-white px-8 py-4 rounded-xl shadow-2xl border-4 border-orange-600">
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">⚠️ 레시피 오류 발생!</div>
              <div className="text-lg font-semibold">{lastServeError.menuName}</div>
              <div className="text-base mt-2">
                오류: {lastServeError.errors}/{lastServeError.totalSteps} 스텝
              </div>
              <div className="text-xl font-bold mt-1">
                정확도: {lastServeError.accuracy}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
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
import FridgeZoomView from '../components/Kitchen/FridgeZoomView'
import SeasoningCounter from '../components/Kitchen/SeasoningCounter'
import AmountInputPopup from '../components/Kitchen/AmountInputPopup'
import BatchAmountInputPopup from '../components/Kitchen/BatchAmountInputPopup'
import GridPopup from '../components/GridPopup'

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
    validateAndAdvanceAction,
    recordBurnerUsage,
    updateWokTemperatures,
    endGame,
    getCurrentStepIngredients,
    fridgeViewState,
    openFridgeZoom,
    lastServeError,
    setHeatLevel,
    storageCache,
  } = useGameStore()

  // 모바일용 상태 추가
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [selectedWokForActions, setSelectedWokForActions] = useState<number | null>(null)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [selectedFridgeBox, setSelectedFridgeBox] = useState<string | null>(null)
  const [mobileGridPopup, setMobileGridPopup] = useState<{
    title: string
    gridRows: number
    gridCols: number
    ingredients: Array<{
      id: string
      name: string
      amount: number
      unit: string
      gridPositions: string
      gridSize: string
      sku: string
      raw: any
    }>
  } | null>(null)

  // 디버깅: selectedMenuId 변경 감지
  useEffect(() => {
    console.log('🎯 selectedMenuId 변경:', selectedMenuId)
  }, [selectedMenuId])

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

  const handleAssignToWok = (orderId: string, burnerNumber: number) => {
    console.log('🔥 메뉴 배정:', orderId, '화구:', burnerNumber)
    assignMenuToWok(orderId, burnerNumber)
    setSelectedBurner(null)
    setSelectedMenuId(null) // 배정 후 선택 초기화
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

    assignments.forEach(({ sku, burnerNumber, amount }) => {
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
    <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 min-h-screen">
      <WokDryingManager />
      <GameHeader />

      {/* Desktop Layout - 기존 코드 유지 */}
      <div className="hidden lg:block">
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
        <div className="w-[230px] flex flex-col my-8">
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
      </div>

      {/* Mobile Layout - 새로운 모바일 전용 */}
      <div className="block lg:hidden relative min-h-screen">
        {/* 주문서 - 모바일 간소화 */}
        <div className="px-3 py-1 border-b border-gray-200">
          <MenuQueue 
            onAssignToWok={handleAssignToWok} 
            selectedBurner={selectedBurner}
            onSelectMenu={setSelectedMenuId}
            selectedMenuId={selectedMenuId}
          />
        </div>

        {/* 좌측 사이드바 - 4호박스 냉장고 */}
        <button
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          className="fixed left-0 top-1/3 z-40 bg-blue-500 text-white px-2 py-6 rounded-r-lg shadow-lg text-xs font-bold"
        >
          📦
        </button>
        {leftSidebarOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => {
                setLeftSidebarOpen(false)
                setSelectedFridgeBox(null)
              }}
            />
            <div className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 shadow-2xl overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm">🧊 4호박스 냉장고</h3>
                  <button
                    onClick={() => {
                      setLeftSidebarOpen(false)
                      setSelectedFridgeBox(null)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>
                
                {!selectedFridgeBox ? (
                  <div className="grid grid-cols-2 gap-2">
                    {['FRIDGE_LT', 'FRIDGE_RT', 'FRIDGE_LB', 'FRIDGE_RB'].map((code, index) => {
                      const labels = ['좌상', '우상', '좌하', '우하']
                      return (
                        <button
                          key={code}
                          onClick={() => setSelectedFridgeBox(code)}
                          className="h-24 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 text-gray-700 font-bold text-xs flex items-center justify-center hover:shadow-lg transition-all"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-2xl">❄️</div>
                            <div>{labels[index]}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="text-sm font-bold text-gray-800 text-center mb-2">
                      {['좌상', '우상', '좌하', '우하'][['FRIDGE_LT', 'FRIDGE_RT', 'FRIDGE_LB', 'FRIDGE_RB'].indexOf(selectedFridgeBox)]}
                    </div>
                    
                    <button
                      onClick={() => {
                        const cacheKey = `${selectedFridgeBox}_F1`
                        const cachedData = storageCache[cacheKey]
                        if (!cachedData) {
                          alert('이 층에 등록된 식자재가 없습니다.')
                          return
                        }
                        setMobileGridPopup({
                          title: cachedData.title,
                          gridRows: cachedData.gridRows,
                          gridCols: cachedData.gridCols,
                          ingredients: cachedData.ingredients.map((ing: any) => ({
                            id: ing.id,
                            name: ing.ingredient_master?.ingredient_name ?? ing.sku_full,
                            amount: ing.standard_amount,
                            unit: ing.standard_unit,
                            gridPositions: ing.grid_positions ?? '1',
                            gridSize: ing.grid_size ?? '1x1',
                            sku: ing.sku_full,
                            raw: ing,
                          })),
                        })
                        setLeftSidebarOpen(false)
                        setSelectedFridgeBox(null)
                      }}
                      className="w-full py-3 rounded-lg bg-white border-2 border-blue-400 text-blue-700 font-bold hover:bg-blue-50 transition shadow-md text-sm"
                    >
                      1️⃣ 1층
                    </button>
                    
                    <button
                      onClick={() => {
                        const cacheKey = `${selectedFridgeBox}_F2`
                        const cachedData = storageCache[cacheKey]
                        if (!cachedData) {
                          alert('이 층에 등록된 식자재가 없습니다.')
                          return
                        }
                        setMobileGridPopup({
                          title: cachedData.title,
                          gridRows: cachedData.gridRows,
                          gridCols: cachedData.gridCols,
                          ingredients: cachedData.ingredients.map((ing: any) => ({
                            id: ing.id,
                            name: ing.ingredient_master?.ingredient_name ?? ing.sku_full,
                            amount: ing.standard_amount,
                            unit: ing.standard_unit,
                            gridPositions: ing.grid_positions ?? '1',
                            gridSize: ing.grid_size ?? '1x1',
                            sku: ing.sku_full,
                            raw: ing,
                          })),
                        })
                        setLeftSidebarOpen(false)
                        setSelectedFridgeBox(null)
                      }}
                      className="w-full py-3 rounded-lg bg-white border-2 border-blue-400 text-blue-700 font-bold hover:bg-blue-50 transition shadow-md text-sm"
                    >
                      2️⃣ 2층
                    </button>

                    <button
                      onClick={() => setSelectedFridgeBox(null)}
                      className="mt-2 px-4 py-2 rounded bg-gray-300 text-gray-700 text-sm hover:bg-gray-400 transition shadow-md"
                    >
                      ← 뒤로
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* 우측 사이드바 - 조미료 선반 */}
        <button
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          className="fixed right-0 top-1/3 z-40 bg-orange-500 text-white px-2 py-6 rounded-l-lg shadow-lg text-xs font-bold"
        >
          🧂
        </button>
        {rightSidebarOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setRightSidebarOpen(false)}
            />
            <div className="fixed right-0 top-0 bottom-0 w-64 bg-white z-50 shadow-2xl overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm">🧂 조미료 선반</h3>
                  <button
                    onClick={() => setRightSidebarOpen(false)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>
                <SeasoningCounter onSelectSeasoning={handleSelectSeasoning} />
              </div>
            </div>
          </>
        )}

        {/* 모바일 메인 레이아웃 */}
        <div className="relative pt-2">
          {/* 싱크대 - 왼쪽 구석에 30x30px */}
          <div className="absolute top-2 left-2 z-10">
            <SinkArea />
          </div>

          {/* 화구 가로 배치 (1번-왼쪽, 2번-중앙, 3번-오른쪽) */}
          <div className="relative w-full h-[250px] mx-auto max-w-[350px]">
            {/* 1번 화구 - 왼쪽 */}
            <div 
              className="absolute"
              style={{
                left: '50%',
                top: '45px',
                transform: 'translate(calc(-50% - 95px), 0) scale(0.6)',
                transformOrigin: 'top center',
              }}
              onClick={() => {
                const wok = woks.find(w => w.burnerNumber === 1)
                if (wok?.currentMenu && wok.state === 'CLEAN') {
                  setSelectedWokForActions(selectedWokForActions === 1 ? null : 1)
                }
              }}
            >
              <Burner burnerNumber={1} />
            </div>

            {/* 2번 화구 - 중앙 */}
            <div 
              className="absolute"
              style={{
                left: '50%',
                top: '45px',
                transform: 'translate(-50%, 0) scale(0.6)',
                transformOrigin: 'top center',
              }}
              onClick={() => {
                const wok = woks.find(w => w.burnerNumber === 2)
                if (wok?.currentMenu && wok.state === 'CLEAN') {
                  setSelectedWokForActions(selectedWokForActions === 2 ? null : 2)
                }
              }}
            >
              <Burner burnerNumber={2} />
            </div>

            {/* 3번 화구 - 오른쪽 */}
            <div 
              className="absolute"
              style={{
                left: '50%',
                top: '45px',
                transform: 'translate(calc(-50% + 95px), 0) scale(0.6)',
                transformOrigin: 'top center',
              }}
              onClick={() => {
                const wok = woks.find(w => w.burnerNumber === 3)
                if (wok?.currentMenu && wok.state === 'CLEAN') {
                  setSelectedWokForActions(selectedWokForActions === 3 ? null : 3)
                }
              }}
            >
              <Burner burnerNumber={3} />
            </div>
          </div>

          {/* 서랍냉장고 - 뷰포트 100% 사용, 타이트하게 */}
          <div className="w-full mx-auto px-2">
            <DrawerFridge 
              onSelectIngredient={handleSelectIngredient}
              onSelectMultiple={handleSelectMultipleIngredients}
            />
          </div>
        </div>
        
        {/* 하단 여백 확보 (하단바 공간) */}
        <div className="h-32 lg:hidden"></div>

        {/* 하단 액션바 오버레이 (외부 클릭 시 닫기) */}
        {(selectedMenuId || selectedWokForActions) && (
          <div 
            className="lg:hidden fixed inset-0 z-20"
            onClick={() => {
              setSelectedMenuId(null)
              setSelectedWokForActions(null)
            }}
          />
        )}

        {/* 하단 액션바 - 메뉴 선택 또는 웍 액션 (모바일 전용) */}
        {(selectedMenuId || selectedWokForActions) && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 shadow-2xl z-30 p-3">
            {/* 메뉴 선택 시: 웍 선택 버튼 */}
            {selectedMenuId && !selectedWokForActions && (
              <div>
                <div className="text-xs text-gray-600 mb-2 text-center">웍을 선택하세요</div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((n) => {
                    const wok = woks.find(w => w.burnerNumber === n)
                    const isAvailable = wok && wok.state === 'CLEAN' && !wok.currentMenu
                    return (
                      <button
                        key={n}
                        disabled={!isAvailable}
                        onClick={() => {
                          if (selectedMenuId) {
                            handleAssignToWok(selectedMenuId, n)
                            setSelectedMenuId(null)
                          }
                        }}
                        className={`py-3 rounded-lg font-bold text-sm shadow-lg transition-all ${
                          isAvailable
                            ? 'bg-gradient-to-r from-blue-400 to-blue-600 text-white active:scale-95'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        화구 {n}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 웍 선택 시: 액션 버튼 (2행) */}
            {selectedWokForActions && (() => {
              const selectedWok = woks.find(w => w.burnerNumber === selectedWokForActions)
              return selectedWok?.currentMenu && selectedWok.state === 'CLEAN' ? (
                <div className="flex flex-col gap-2">
                  {/* 1행: 액션 버튼 (볶기, 물넣기, 뒤집기) */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        validateAndAdvanceAction(selectedWokForActions, 'STIR_FRY')
                        setSelectedWokForActions(null)
                      }}
                      className="py-3 rounded-lg bg-gradient-to-r from-orange-400 to-red-500 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
                    >
                      🍳 볶기
                    </button>
                    <button
                      onClick={() => {
                        validateAndAdvanceAction(selectedWokForActions, 'ADD_WATER')
                        setSelectedWokForActions(null)
                      }}
                      className="py-3 rounded-lg bg-gradient-to-r from-blue-400 to-cyan-500 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
                    >
                      💧 물넣기
                    </button>
                    <button
                      onClick={() => {
                        validateAndAdvanceAction(selectedWokForActions, 'FLIP')
                        setSelectedWokForActions(null)
                      }}
                      className="py-3 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
                    >
                      🔄 뒤집기
                    </button>
                  </div>

                  {/* 2행: 불 세기 조절 (약, 중, 강) */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setHeatLevel(selectedWokForActions, 1)
                        setSelectedWokForActions(null)
                      }}
                      className={`py-2 rounded-lg font-bold text-sm shadow-md active:scale-95 transition-transform ${
                        selectedWok.heatLevel === 1
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      약
                    </button>
                    <button
                      onClick={() => {
                        setHeatLevel(selectedWokForActions, 2)
                        setSelectedWokForActions(null)
                      }}
                      className={`py-2 rounded-lg font-bold text-sm shadow-md active:scale-95 transition-transform ${
                        selectedWok.heatLevel === 2
                          ? 'bg-gradient-to-r from-orange-400 to-red-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      중
                    </button>
                    <button
                      onClick={() => {
                        setHeatLevel(selectedWokForActions, 3)
                        setSelectedWokForActions(null)
                      }}
                      className={`py-2 rounded-lg font-bold text-sm shadow-md active:scale-95 transition-transform ${
                        selectedWok.heatLevel === 3
                          ? 'bg-gradient-to-r from-red-500 to-red-700 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      강
                    </button>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        )}

        {/* 레시피 가이드 - 스크롤 영역 */}
        <div className="py-6 px-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-t-2 border-blue-300">
          <RecipeGuide />
        </div>

        {/* 액션 로그 & 화구 사용율 - 스크롤 영역 */}
        <div className="px-4 py-6 bg-gradient-to-br from-gray-100 to-gray-200 border-t-2 border-gray-300 mb-12 space-y-4">
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

      {/* 모바일 GridPopup (4호박스 사이드바에서 층 선택 시) */}
      {mobileGridPopup && (
        <GridPopup
          title={mobileGridPopup.title}
          gridRows={mobileGridPopup.gridRows}
          gridCols={mobileGridPopup.gridCols}
          ingredients={mobileGridPopup.ingredients}
          enableMultiSelect={true}
          onSelect={(ing) => {
            handleSelectIngredient(ing.raw)
            setMobileGridPopup(null)
          }}
          onSelectMultiple={(selectedIngs) => {
            handleSelectMultipleIngredients(selectedIngs)
            setMobileGridPopup(null)
          }}
          onClose={() => setMobileGridPopup(null)}
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

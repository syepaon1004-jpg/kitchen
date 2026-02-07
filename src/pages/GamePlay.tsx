import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import { selectRandomMenu } from '../stores/gameStore'
import { MENU_INTERVAL_MS, MENUS_PER_INTERVAL } from '../types/database.types'
import type { IngredientInventory, Seasoning } from '../types/database.types'
import GameHeader from '../components/Game/GameHeader'
import RecipeGuide from '../components/Game/RecipeGuide'
import ActionLogPanel from '../components/Game/ActionLogPanel'
import WokDryingManager from '../components/Kitchen/WokDryingManager'
import FridgeZoomView from '../components/Kitchen/FridgeZoomView'
import AmountInputPopup from '../components/Kitchen/AmountInputPopup'
import BatchAmountInputPopup from '../components/Kitchen/BatchAmountInputPopup'
import LegacyKitchenLayout from '../components/Kitchen/LegacyKitchenLayout'
import KitchenViewport from '../components/Kitchen/KitchenViewport'
import MenuQueue from '../components/Menu/MenuQueue'
import DecoZone from '../components/Kitchen/DecoZone'
import IngredientModeSelector from '../components/Kitchen/IngredientModeSelector'
import SettingAmountPopup from '../components/Kitchen/SettingAmountPopup'
import PlateSelectPopup from '../components/Kitchen/PlateSelectPopup'

type AmountPopupState =
  | null
  | {
      type: 'ingredient'
      ingredient: IngredientInventory
      targetWok: number
      requiredAmount: number
      requiredUnit: string
      recipeIngredientId?: string // v3: FK 매칭용
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

// 재료 선택 후 모드 선택 상태 (투입/세팅존)
type ModeSelectorState = {
  ingredients: Array<{
    id: string
    name: string
    sku: string
    amount: number
    unit: string
    raw: any
    ingredientMasterId?: string
  }>
} | null

// 세팅존 양 입력 상태
type SettingPopupState = {
  ingredients: Array<{
    id: string
    name: string
    sku: string
    amount: number
    unit: string
    raw: any
    ingredientMasterId?: string
  }>
} | null

// 접시 선택 팝업 상태 (콜드메뉴용)
type PlateSelectPopupState = {
  orderId: string
  menuName: string
  recipeId: string
  bundleId: string | null
  bundleName: string | null
  isMainDish: boolean
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
    endGame,
    getCurrentStepIngredients,
    fridgeViewState,
    lastServeError,
    kitchenGrid,
    kitchenEquipment,
    setIngredientCallbacks,
    setSeasoningCallback,
    currentZone,
    setZone,
    openDecoZone,
    decoPlates,
  } = useGameStore()

  const [selectedBurner, setSelectedBurner] = useState<number | null>(null)
  const [amountPopup, setAmountPopup] = useState<AmountPopupState>(null)
  const [batchInputPopup, setBatchInputPopup] = useState<BatchInputState>(null)
  const [modeSelectorPopup, setModeSelectorPopup] = useState<ModeSelectorState>(null)
  const [settingPopup, setSettingPopup] = useState<SettingPopupState>(null)
  const [plateSelectPopup, setPlateSelectPopup] = useState<PlateSelectPopupState>(null)
  const [toast, setToast] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const burnerUsageRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tempUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 콜백 핸들러 refs (stale closure 방지용)
  const handleSelectIngredientRef = useRef<(ingredient: IngredientInventory) => void>(() => {})
  const handleSelectMultipleRef = useRef<(ingredients: any[]) => void>(() => {})
  const handleSelectSeasoningRef = useRef<(seasoning: Seasoning, amount: number, unit: string) => void>(() => {})

  // 데코존 확대 애니메이션 상태
  const [decoExpanded, setDecoExpanded] = useState(false)
  const decoZoneRect = useGameStore((s) => s.decoZoneRect)

  // DECO 모드 진입 시 확대 애니메이션 시작
  useEffect(() => {
    if (currentZone === 'DECO') {
      // 다음 프레임에서 확대 시작 (transition 적용을 위해)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDecoExpanded(true)
        })
      })
    }
  }, [currentZone])

  // 주방으로 돌아가기
  const handleBackToCooking = () => {
    setDecoExpanded(false)
    // 축소 애니메이션 완료 후 정리
    setTimeout(() => {
      setZone('COOKING')
    }, 500)
  }

  useEffect(() => {
    if (!isPlaying) return
    const interval = MENU_INTERVAL_MS[level]
    const count = MENUS_PER_INTERVAL[level]
    const tick = () => {
      const state = useGameStore.getState()
      if (state.completedMenus >= state.targetMenus) return
      if (state.menuQueue.length >= 10) return
      for (let i = 0; i < count; i++) {
        if (useGameStore.getState().menuQueue.length >= 10) break
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
      useGameStore.getState().checkMenuTimers()
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

  useEffect(() => {
    setIngredientCallbacks(
      (ingredient) => handleSelectIngredientRef.current(ingredient),
      (ingredients) => handleSelectMultipleRef.current(ingredients)
    )
    setSeasoningCallback(
      (seasoning, amount, unit) => handleSelectSeasoningRef.current(seasoning, amount, unit)
    )
    return () => {
      setIngredientCallbacks(null, null)
      setSeasoningCallback(null)
    }
  }, [setIngredientCallbacks, setSeasoningCallback])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const handleAssignToWok = (orderId: string, burnerNumber: number, bundleId?: string) => {
    console.log('🔥 메뉴 배정:', orderId, '화구:', burnerNumber, bundleId ? `묶음: ${bundleId}` : '')
    assignMenuToWok(orderId, burnerNumber, bundleId)
    setSelectedBurner(null)
  }

  // v3: inventory_id로 recipe_ingredient 매칭
  const handleSelectIngredient = (ingredient: IngredientInventory) => {
    const woksWithMenu = woks.filter((w) => w.currentMenu)
    if (woksWithMenu.length === 0) {
      showToast('먼저 메뉴를 배정하세요.')
      return
    }
    let maxRequired = ingredient.standard_amount
    let matchedRecipeIngredientId: string | undefined = undefined

    woksWithMenu.forEach((wok) => {
      const reqs = getCurrentStepIngredients(wok.currentMenu!, wok.currentStep, wok.currentBundleId)
      // v3: inventory_id로 매칭
      const match = reqs.find((r) => r.inventory_id === ingredient.id)
      if (match) {
        if (match.required_amount > maxRequired) {
          maxRequired = match.required_amount
        }
        if (!matchedRecipeIngredientId) {
          matchedRecipeIngredientId = match.id
        }
      }
    })

    setAmountPopup({
      type: 'ingredient',
      ingredient,
      targetWok: 0,
      requiredAmount: maxRequired,
      requiredUnit: ingredient.standard_unit,
      recipeIngredientId: matchedRecipeIngredientId, // v3: 매칭된 recipe_ingredient.id 저장
    })
  }

  const handleSelectMultipleIngredients = (selectedIngredients: any[]) => {
    // 모드 선택 팝업 표시 (투입/세팅존 선택)
    setModeSelectorPopup({
      ingredients: selectedIngredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        sku: ing.sku,
        amount: ing.amount,
        unit: ing.unit,
        raw: ing.raw,
        ingredientMasterId: ing.raw?.ingredient_master_id,
      })),
    })
  }

  // 투입 모드 선택 시
  const handleSelectInputMode = () => {
    if (!modeSelectorPopup) return

    const woksWithMenu = woks.filter((w) => w.currentMenu)
    if (woksWithMenu.length === 0) {
      showToast('먼저 메뉴를 배정하세요.')
      setModeSelectorPopup(null)
      return
    }

    // 기존 배치 입력 팝업으로 전환
    setBatchInputPopup({
      ingredients: modeSelectorPopup.ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        sku: ing.sku,
        standardAmount: ing.amount,
        standardUnit: ing.unit,
        raw: ing.raw,
      })),
    })
    setModeSelectorPopup(null)
  }

  // 세팅존 모드 선택 시
  const handleSelectSettingMode = () => {
    if (!modeSelectorPopup) return

    // 세팅 양 입력 팝업으로 전환
    setSettingPopup({
      ingredients: modeSelectorPopup.ingredients,
    })
    setModeSelectorPopup(null)
  }

  // 콜드메뉴 접시 선택 (bundleId가 전달되면 해당 묶음, 없으면 첫 번째 콜드 묶음)
  const handleSelectPlate = (orderId: string, menuName: string, recipeId: string, bundleId?: string) => {
    const { recipeBundles } = useGameStore.getState()

    // bundleId가 명시되면 해당 묶음, 아니면 첫 번째 콜드 묶음
    const coldBundle = bundleId
      ? recipeBundles.find((b) => b.id === bundleId)
      : recipeBundles.find((b) => b.recipe_id === recipeId && b.cooking_type === 'COLD')

    setPlateSelectPopup({
      orderId,
      menuName,
      recipeId,
      bundleId: coldBundle?.id ?? null,
      bundleName: coldBundle?.bundle_name ?? null,
      isMainDish: coldBundle?.is_main_dish ?? true,
    })
  }

  // v3: 조미료도 ingredient_master_id로 매칭
  const handleSelectSeasoning = (seasoning: Seasoning, requiredAmount: number, requiredUnit: string) => {
    const woksWithMenu = woks.filter((w) => w.currentMenu)
    if (woksWithMenu.length === 0) {
      showToast('먼저 메뉴를 배정하세요.')
      return
    }
    let maxRequired = requiredAmount || 10
    woksWithMenu.forEach((wok) => {
      const reqs = getCurrentStepIngredients(wok.currentMenu!, wok.currentStep, wok.currentBundleId)
      // v3: ingredient_master_id로 매칭 (조미료는 inventory_id 또는 ingredient_master_id로 매칭)
      const match = reqs.find((r) =>
        r.ingredient_master_id === seasoning.ingredient_master_id ||
        r.inventory?.storage_location?.location_type === 'SEASONING'
      )
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

  handleSelectIngredientRef.current = handleSelectIngredient
  handleSelectMultipleRef.current = handleSelectMultipleIngredients
  handleSelectSeasoningRef.current = handleSelectSeasoning

  // v3: recipeIngredientId 기반으로 변경
  const handleConfirmAmount = (amountsByWok: Record<number, number>) => {
    if (!amountPopup) return

    const results: { burner: number; ok: boolean }[] = []

    Object.entries(amountsByWok).forEach(([burnerStr, amount]) => {
      const burnerNumber = Number(burnerStr)
      if (amount === 0) return

      const wok = woks.find((w) => w.burnerNumber === burnerNumber)
      if (!wok?.currentMenu) return

      let ok = false
      // v3: 해당 웍의 현재 스텝에서 매칭되는 recipe_ingredient 찾기
      const reqs = getCurrentStepIngredients(wok.currentMenu!, wok.currentStep, wok.currentBundleId)

      if (amountPopup.type === 'ingredient') {
        // v3: inventory_id로 매칭
        const match = reqs.find((r) => r.inventory_id === amountPopup.ingredient.id)
        if (match) {
          ok = validateAndAdvanceIngredient(burnerNumber, match.id, amount)
        } else {
          console.warn(`❌ 매칭되는 recipe_ingredient 없음: inventory_id=${amountPopup.ingredient.id}`)
          ok = false
        }
      } else {
        // v3: 조미료도 inventory_id로 매칭 (seasonings 테이블의 id 또는 inventory.id)
        const match = reqs.find((r) =>
          r.inventory_id === amountPopup.seasoning.id ||
          r.ingredient_master_id === amountPopup.seasoning.ingredient_master_id
        )
        if (match) {
          ok = validateAndAdvanceIngredient(burnerNumber, match.id, amount)
        } else {
          console.warn(`❌ 매칭되는 recipe_ingredient 없음 (조미료): ${amountPopup.seasoning.seasoning_name}`)
          ok = false
        }
      }
      results.push({ burner: burnerNumber, ok })
    })

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

  // v3: inventory_id 기반으로 recipe_ingredient 매칭
  const handleBatchConfirm = (assignments: Array<{ sku: string; burnerNumber: number; amount: number; raw: any }>) => {
    const results: { burner: number; sku: string; ok: boolean }[] = []

    assignments.forEach(({ sku, burnerNumber, amount, raw }) => {
      const wok = woks.find((w) => w.burnerNumber === burnerNumber)
      if (!wok?.currentMenu) return

      // v3: raw에서 inventory id 가져와서 recipe_ingredient 매칭
      const inventoryId = raw?.id
      const reqs = getCurrentStepIngredients(wok.currentMenu!, wok.currentStep, wok.currentBundleId)
      const match = reqs.find((r) => r.inventory_id === inventoryId)

      let ok = false
      if (match) {
        ok = validateAndAdvanceIngredient(burnerNumber, match.id, amount)
      } else {
        console.warn(`❌ 매칭되는 recipe_ingredient 없음: inventory_id=${inventoryId}`)
      }
      results.push({ burner: burnerNumber, sku, ok })
    })

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
  const totalBurners = woks.length || 3
  const burnerUsagePercent =
    burnerUsageHistory.length > 0
      ? Math.round(
          (burnerUsageHistory.reduce((s, l) => s + l.activeBurners.length, 0) /
            (burnerUsageHistory.length * totalBurners)) *
            100
        )
      : 0

  if (!isPlaying) {
    navigate('/level-select', { replace: true })
    return null
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 min-h-screen flex flex-col">
      <WokDryingManager />
      <GameHeader />

      {kitchenGrid && kitchenEquipment.length > 0 ? (
        <>
          {/* 1. 주문서 - 상단 고정 (줌 대상 밖) */}
          <div className="px-4 py-3 bg-gradient-to-r from-yellow-50 via-white to-yellow-50 border-b-4 border-yellow-400 shadow-md">
            <MenuQueue
              onAssignToWok={handleAssignToWok}
              selectedBurner={selectedBurner}
              onSelectPlate={handleSelectPlate}
            />
          </div>

          {/* 2. 주방 컨테이너 */}
          <div className="flex-1 relative overflow-hidden">
            <div className="px-4 py-4 h-full">
              <KitchenViewport gridData={kitchenGrid} equipment={kitchenEquipment} />
            </div>
          </div>

          {/* 3. 하단 - 레시피 가이드 (줌 대상 밖) */}
          <div className="py-6 px-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-t-4 border-blue-300">
            <RecipeGuide />
          </div>

          {/* 4. 하단 - 액션 로그 & 화구 사용율 (줌 대상 밖) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-4 py-6 bg-gradient-to-br from-gray-100 to-gray-200 border-t-4 border-gray-300 mb-12">
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
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)',
                    }}
                  />
                </div>
                <span className="font-mono font-bold text-sm text-gray-700 min-w-[3rem] text-right">
                  {burnerUsagePercent}%
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <LegacyKitchenLayout
          onSelectIngredient={handleSelectIngredient}
          onSelectMultiple={handleSelectMultipleIngredients}
          onSelectSeasoning={handleSelectSeasoning}
          onAssignToWok={handleAssignToWok}
          selectedBurner={selectedBurner}
          burnerUsagePercent={burnerUsagePercent}
        />
      )}

      {/* 데코존 오버레이 — DECO 모드일 때만 렌더링 */}
      {currentZone === 'DECO' && decoZoneRect && (
        <>
          {/* 배경 어둡게 */}
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-500"
            style={{ opacity: decoExpanded ? 1 : 0 }}
            onClick={handleBackToCooking}
          />

          {/* 데코존 — 캡처된 위치에서 90vw × 90vh로 확대 */}
          <div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={
              decoExpanded
                ? {
                    top: '5vh',
                    left: '5vw',
                    width: '90vw',
                    height: '90vh',
                  }
                : {
                    top: `${decoZoneRect.top}px`,
                    left: `${decoZoneRect.left}px`,
                    width: `${decoZoneRect.width}px`,
                    height: `${decoZoneRect.height}px`,
                  }
            }
          >
            <DecoZone onBack={handleBackToCooking} />
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-xl bg-white text-gray-800 shadow-2xl z-[60] border-2 border-gray-300 font-bold">
          {toast}
        </div>
      )}

      {amountPopup && (
        <AmountInputPopup
          title={
            amountPopup.type === 'ingredient'
              ? amountPopup.ingredient.ingredient_master?.ingredient_name ?? amountPopup.ingredient.sku_full ?? '재료'
              : amountPopup.seasoning.seasoning_name
          }
          requiredAmount={amountPopup.requiredAmount}
          requiredUnit={amountPopup.requiredUnit}
          onConfirm={handleConfirmAmount}
          onCancel={() => setAmountPopup(null)}
        />
      )}

      {fridgeViewState !== 'CLOSED' && (
        <FridgeZoomView
          onSelectIngredient={handleSelectIngredient}
          onSelectMultiple={handleSelectMultipleIngredients}
        />
      )}

      {batchInputPopup && (
        <BatchAmountInputPopup
          ingredients={batchInputPopup.ingredients}
          onConfirm={handleBatchConfirm}
          onCancel={() => setBatchInputPopup(null)}
        />
      )}

      {/* 재료 모드 선택 팝업 (투입/세팅존) */}
      {modeSelectorPopup && (
        <IngredientModeSelector
          ingredients={modeSelectorPopup.ingredients}
          onSelectInput={handleSelectInputMode}
          onSelectSetting={handleSelectSettingMode}
          onCancel={() => setModeSelectorPopup(null)}
        />
      )}

      {/* 세팅존 양 입력 팝업 */}
      {settingPopup && (
        <SettingAmountPopup
          ingredients={settingPopup.ingredients}
          onComplete={() => setSettingPopup(null)}
          onCancel={() => setSettingPopup(null)}
        />
      )}

      {/* 콜드메뉴 접시 선택 팝업 */}
      {plateSelectPopup && (
        <PlateSelectPopup
          orderId={plateSelectPopup.orderId}
          menuName={plateSelectPopup.menuName}
          recipeId={plateSelectPopup.recipeId}
          bundleId={plateSelectPopup.bundleId}
          bundleName={plateSelectPopup.bundleName}
          isMainDish={plateSelectPopup.isMainDish}
          onComplete={() => setPlateSelectPopup(null)}
          onCancel={() => setPlateSelectPopup(null)}
        />
      )}

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

      {/* 데코존 이동 플로팅 버튼 - COOKING 모드에서만 표시 */}
      {currentZone === 'COOKING' && (
        <button
          type="button"
          onClick={openDecoZone}
          className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl cursor-pointer transition-transform hover:scale-110 active:scale-95 bg-gradient-to-br from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 border-2 border-white/30"
          title="데코존으로 이동"
        >
          🎨
          {decoPlates.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {decoPlates.length}
            </span>
          )}
        </button>
      )}
    </div>
  )
}

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
import MicrowaveSetupPopup from '../components/Kitchen/MicrowaveSetupPopup'
// FryerSetupPopup은 BatchAmountInputPopup으로 대체됨

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
    unit: string
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

// 접시 선택 팝업 상태 (v3.1 리팩토링: instanceId 기반)
type PlateSelectPopupState = {
  instanceId: string  // BundleInstance.id
} | null

// 전자레인지 설정 팝업 상태
type MicrowaveSetupState = {
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

// 튀김기 설정 팝업 상태
type FryerSetupState = {
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

export default function GamePlay() {
  const navigate = useNavigate()
  const {
    level,
    isPlaying,
    woks,
    completedMenus,
    targetMenus,
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
    // v3.1 리팩토링: 통합 함수
    assignBundle,
    addIngredientToBundle: _addIngredientToBundle,
    completeBundle,
    routeAfterPlate: _routeAfterPlate,
    tickBundleTimers: _tickBundleTimers,
    // v3.1 리팩토링: selector
    getWokBundle: _getWokBundle,
    getMicrowaveBundles: _getMicrowaveBundles,
    getFryerBundle: _getFryerBundle,
    updateBundleInstance,
    // 레거시 웍 함수 (BatchAmountInputPopup용)
    validateAndAdvanceIngredient,
  } = useGameStore()

  const [selectedBurner, setSelectedBurner] = useState<number | null>(null)
  const [amountPopup, setAmountPopup] = useState<AmountPopupState>(null)
  const [batchInputPopup, setBatchInputPopup] = useState<BatchInputState>(null)
  const [modeSelectorPopup, setModeSelectorPopup] = useState<ModeSelectorState>(null)
  const [settingPopup, setSettingPopup] = useState<SettingPopupState>(null)
  const [plateSelectPopup, setPlateSelectPopup] = useState<PlateSelectPopupState>(null)
  const [microwaveSetupPopup, setMicrowaveSetupPopup] = useState<MicrowaveSetupState>(null)
  const [fryerSetupPopup, setFryerSetupPopup] = useState<FryerSetupState>(null)
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
      useGameStore.getState().checkBoilCompletion() // v3.1: BOIL 액션 자동 완료 체크
      // v3.1 리팩토링: 통합 타이머 틱 (전자레인지 + 튀김기 + 스텝 진행)
      useGameStore.getState().tickBundleTimers()
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

  // v3.1 리팩토링: 접시 선택 팝업 이벤트 리스너 (instanceId 기반)
  useEffect(() => {
    const handleOpenPlateSelect = (e: CustomEvent) => {
      const { instanceId } = e.detail
      if (!instanceId) {
        console.warn('instanceId가 없음:', e.detail)
        return
      }
      setPlateSelectPopup({ instanceId })
    }

    window.addEventListener('openPlateSelectPopup', handleOpenPlateSelect as EventListener)
    return () => {
      window.removeEventListener('openPlateSelectPopup', handleOpenPlateSelect as EventListener)
    }
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const handleAssignToWok = (orderId: string, burnerNumber: number, bundleId?: string) => {
    console.log('🔥 메뉴 배정:', orderId, '화구:', burnerNumber, bundleId ? `묶음: ${bundleId}` : '')
    if (!bundleId) {
      showToast('❌ bundleId가 필요합니다')
      return
    }
    // v3.1 리팩토링: 통합 함수 사용
    const result = assignBundle(orderId, bundleId, { type: 'WOK', burnerNumber })
    if (!result.success) {
      showToast(`❌ ${result.message}`)
    }
    setSelectedBurner(null)
  }

  const handleAssignToFryer = (orderId: string, basketNumber: number, bundleId?: string) => {
    console.log('🍟 튀김기 배정:', orderId, '바스켓:', basketNumber, bundleId ? `묶음: ${bundleId}` : '')
    if (!bundleId) {
      showToast('❌ bundleId가 필요합니다')
      return
    }
    // v3.1 리팩토링: 통합 함수 사용
    const result = assignBundle(orderId, bundleId, { type: 'FRYER', basketNumber })
    if (!result.success) {
      showToast(`❌ ${result.message}`)
    }
  }

  // v3.3: 단일 식재료도 이동경로 선택 팝업 표시
  const handleSelectIngredient = (ingredient: IngredientInventory) => {
    console.log('🎯 [GamePlay] handleSelectIngredient 호출:', ingredient.ingredient_master?.ingredient_name ?? ingredient.id)
    setModeSelectorPopup({
      ingredients: [{
        id: ingredient.id,
        name: ingredient.ingredient_master?.ingredient_name ?? ingredient.id,
        sku: ingredient.sku_code ?? '',
        amount: 0,
        unit: ingredient.ingredient_master?.base_unit ?? 'g',
        raw: ingredient,
        ingredientMasterId: ingredient.ingredient_master_id,
      }],
    })
  }

  const handleSelectMultipleIngredients = (selectedIngredients: any[]) => {
    console.log('🎯 [GamePlay] handleSelectMultipleIngredients 호출:', selectedIngredients.length, '개', selectedIngredients.map(i => i.name))
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
      showToast('화구에 배정된 메뉴가 없습니다. 먼저 메뉴를 화구에 배정하세요.')
      return // 모드 선택 팝업 유지 (다른 옵션 선택 가능)
    }

    // 기존 배치 입력 팝업으로 전환
    setBatchInputPopup({
      ingredients: modeSelectorPopup.ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        sku: ing.sku,
        unit: ing.unit,
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

  // 전자레인지 모드 선택 시
  const handleSelectMicrowaveMode = () => {
    if (!modeSelectorPopup) return

    setMicrowaveSetupPopup({
      ingredients: modeSelectorPopup.ingredients,
    })
    setModeSelectorPopup(null)
  }

  // 튀김기 모드 선택 시
  const handleSelectFryerMode = () => {
    if (!modeSelectorPopup) return

    const { fryerState: fs } = useGameStore.getState()
    const activeFryerBaskets = fs.baskets.filter(
      (b) => b.orderId && b.status === 'ASSIGNED' && !b.isSubmerged
    )
    if (activeFryerBaskets.length === 0) {
      showToast('튀김기 바스켓에 배정된 메뉴가 없습니다. 먼저 메뉴를 바스켓에 배정하세요.')
      return // 모드 선택 팝업 유지 (다른 옵션 선택 가능)
    }

    setFryerSetupPopup({
      ingredients: modeSelectorPopup.ingredients,
    })
    setModeSelectorPopup(null)
  }

  // 콜드메뉴 접시 선택 (bundleId가 전달되면 해당 묶음, 없으면 첫 번째 콜드 묶음)
  const handleSelectPlate = (orderId: string, _menuName: string, recipeId: string, bundleId?: string) => {
    const { recipeBundles } = useGameStore.getState()

    // bundleId가 명시되면 해당 묶음, 아니면 첫 번째 콜드 묶음
    const coldBundle = bundleId
      ? recipeBundles.find((b) => b.id === bundleId)
      : recipeBundles.find((b) => b.recipe_id === recipeId && b.cooking_type === 'COLD')

    if (!coldBundle) {
      showToast('콜드 묶음을 찾을 수 없습니다')
      return
    }

    // v3.1 리팩토링: COLD 메뉴도 BundleInstance 생성 (NOT_ASSIGNED → PLATE_SELECT로 즉시 이동)
    const result = assignBundle(orderId, coldBundle.id, { type: 'NOT_ASSIGNED' })
    if (result.success && result.instanceId) {
      // 바로 completeBundle 호출해서 PLATE_SELECT 상태로 전환
      completeBundle(result.instanceId)
      setPlateSelectPopup({ instanceId: result.instanceId })
    } else {
      showToast(`❌ ${result.message}`)
    }
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

  // v3: recipeIngredientId 기반으로 변경 + 특수 액션 체크 추가
  const handleConfirmAmount = (amountsByWok: Record<number, number>) => {
    if (!amountPopup) return

    const results: { burner: number; ok: boolean }[] = []

    // 특수 액션 체크용 - 첫 번째 웍에서만 체크
    const entries = Object.entries(amountsByWok).filter(([, amount]) => amount > 0)

    for (const [burnerStr, amount] of entries) {
      const burnerNumber = Number(burnerStr)
      const wok = woks.find((w) => w.burnerNumber === burnerNumber)
      if (!wok?.currentMenu) continue

      const reqs = getCurrentStepIngredients(wok.currentMenu!, wok.currentStep, wok.currentBundleId)

      if (amountPopup.type === 'ingredient') {
        const match = reqs.find((r) => r.inventory_id === amountPopup.ingredient.id)
        if (!match) {
          console.warn(`❌ 매칭되는 recipe_ingredient 없음: inventory_id=${amountPopup.ingredient.id}`)
          results.push({ burner: burnerNumber, ok: false })
          continue
        }

        const ok = validateAndAdvanceIngredient(burnerNumber, match.id, amount)
        results.push({ burner: burnerNumber, ok })
      } else {
        // 조미료 처리 (특수 액션 없음)
        const match = reqs.find((r) =>
          r.inventory_id === amountPopup.seasoning.id ||
          r.ingredient_master_id === amountPopup.seasoning.ingredient_master_id
        )
        if (match) {
          const ok = validateAndAdvanceIngredient(burnerNumber, match.id, amount)
          results.push({ burner: burnerNumber, ok })
        } else {
          console.warn(`❌ 매칭되는 recipe_ingredient 없음 (조미료): ${amountPopup.seasoning.seasoning_name}`)
          results.push({ burner: burnerNumber, ok: false })
        }
      }
    }

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
    <div className="bg-indigo-50 min-h-screen flex flex-col">
      <WokDryingManager />
      <GameHeader />

      {kitchenGrid && kitchenEquipment.length > 0 ? (
        <>
          {/* 1. 주문서 - 상단 고정 (줌 대상 밖) */}
          <div className="px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
            <MenuQueue
              onAssignToWok={handleAssignToWok}
              onAssignToFryer={handleAssignToFryer}
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
          <div className="py-4 px-4 bg-white border-t border-gray-200">
            <RecipeGuide />
          </div>

          {/* 4. 하단 - 액션 로그 & 화구 사용율 (줌 대상 밖) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 px-4 py-4 bg-white border-t border-gray-200 mb-12">
            <div className="bg-indigo-50 p-4 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-700 mb-2 text-xs tracking-wider flex items-center gap-2">
                <span>📋</span> 액션 로그
              </h4>
              <ActionLogPanel />
            </div>
            <div className="bg-indigo-50 p-4 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-700 mb-2 text-xs tracking-wider flex items-center gap-2">
                <span>🔥</span> 화구 사용율
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, burnerUsagePercent)}%`,
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl bg-white text-gray-800 shadow-lg z-[60] border border-gray-200 font-medium">
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

      {/* 재료 모드 선택 팝업 (투입/이동) */}
      {modeSelectorPopup && (
        <IngredientModeSelector
          ingredients={modeSelectorPopup.ingredients}
          onSelectInput={handleSelectInputMode}
          onSelectSetting={handleSelectSettingMode}
          onSelectMicrowave={handleSelectMicrowaveMode}
          onSelectFryer={handleSelectFryerMode}
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

      {/* 전자레인지 설정 팝업 */}
      {microwaveSetupPopup && (
        <MicrowaveSetupPopup
          ingredients={microwaveSetupPopup.ingredients}
          onConfirm={(timerSeconds, power, orderId, bundleId, ingredientAmounts) => {
            console.log('📡 전자레인지 설정:', { timerSeconds, power, orderId, bundleId, ingredientAmounts })

            const result = assignBundle(orderId, bundleId, { type: 'MICROWAVE' }, { timerSeconds, powerLevel: power })

            if (result.success && result.instanceId) {
              updateBundleInstance(result.instanceId, { ingredients: ingredientAmounts })

              const powerLabel = power === 'LOW' ? '약' : power === 'MEDIUM' ? '중' : '강'
              const ingredientNames = ingredientAmounts.map((i) => `${i.name} ${i.amount}${i.unit}`).join(', ')
              showToast(`전자레인지: ${ingredientNames} - ${timerSeconds}초 (${powerLabel})`)
            } else {
              showToast(`❌ ${result.message ?? '전자레인지에 재료를 추가할 수 없습니다'}`)
            }

            setMicrowaveSetupPopup(null)
          }}
          onCancel={() => setMicrowaveSetupPopup(null)}
        />
      )}

      {/* 튀김기 재료 투입 팝업 - v3.1: 웍과 동일한 배치 투입 UI 사용 */}
      {fryerSetupPopup && (
        <BatchAmountInputPopup
          ingredients={fryerSetupPopup.ingredients.map((ing) => ({
            id: ing.id,
            name: ing.name,
            sku: ing.sku,
            unit: ing.unit,
            raw: ing.raw,
          }))}
          targetType="fryer"
          onConfirm={() => {}} // 웍용 (사용 안 함)
          onConfirmFryer={(assignments) => {
            console.log('🍟 튀김기 배치 투입:', assignments)

            // v3.1 리팩토링: BundleInstance 기반 함수 사용
            const { getFryerBundle, addIngredientToBundle, updateBundleInstance, getCurrentStepIngredients, recipeBundles, level, logAction } = useGameStore.getState()

            let totalSuccess = 0
            let totalFail = 0
            let validationError: string | null = null
            const affectedBundles = new Map<string, { bundleId: string; timerSeconds: number }>()

            // v3.1: 바스켓별 타이머 검증 (BEGINNER 모드)
            const basketTimerMap = new Map<number, number>()
            assignments.forEach(({ basketNumber, timerSeconds }) => {
              if (!basketTimerMap.has(basketNumber)) {
                basketTimerMap.set(basketNumber, timerSeconds)
              }
            })

            // BEGINNER 모드: 시간 검증
            if (level === 'BEGINNER') {
              for (const [basketNumber, userTimer] of basketTimerMap) {
                const bundle = getFryerBundle(basketNumber)
                if (!bundle) continue

                const recipeBundle = recipeBundles.find((b) => b.id === bundle.bundleId)
                const deepFryStep = recipeBundle?.recipe_steps?.find(
                  (step: any) => step.step_type === 'ACTION' && step.action_type === 'DEEP_FRY'
                )
                const requiredDuration = (deepFryStep?.action_params as any)?.required_duration

                console.log('🔍 튀김기 검증:', { basketNumber, userTimer, requiredDuration, bundleId: bundle.bundleId })

                if (requiredDuration !== undefined && userTimer !== requiredDuration) {
                  validationError = `바스켓 ${basketNumber}: 시간이 ${requiredDuration}초여야 합니다 (입력: ${userTimer}초)`
                  logAction({
                    actionType: 'FRYER_REJECT',
                    menuName: bundle.menuName ?? '',
                    isCorrect: false,
                    message: `튀김기 설정 오류: ${validationError}`,
                  })
                  break
                }
              }
            }

            if (validationError) {
              showToast(`❌ ${validationError}`)
              return  // 검증 실패 시 중단
            }

            // 각 assignment 처리 (바스켓별로 그룹화하지 않고 순차 처리)
            assignments.forEach(({ sku, basketNumber, amount, raw }) => {
              const bundle = getFryerBundle(basketNumber)
              if (!bundle) {
                console.warn(`🍟 바스켓 ${basketNumber}: 메뉴 미배정`)
                totalFail++
                return
              }

              // v3.1: 타이머 설정을 위해 bundle 저장
              const userTimer = basketTimerMap.get(basketNumber) ?? 180
              affectedBundles.set(bundle.id, { bundleId: bundle.id, timerSeconds: userTimer })

              // 현재 스텝의 재료 목록 가져오기
              const stepIngredients = getCurrentStepIngredients(bundle.menuName, bundle.cooking.currentStep, bundle.bundleId)

              // inventory_id로 recipe ingredient 찾기
              const matchedRecipeIngredient = stepIngredients.find(
                (r) => r.inventory_id === raw?.id || r.inventory_id === sku
              )

              if (matchedRecipeIngredient) {
                // v3.1 리팩토링: addIngredientToBundle 사용 (boolean 반환)
                const success = addIngredientToBundle(bundle.id, matchedRecipeIngredient.id, amount)
                if (success) {
                  totalSuccess++
                  console.log(`🍟 바스켓 ${basketNumber}: ${amount}${raw?.ingredient_master?.base_unit ?? 'g'} 투입 성공`)
                } else {
                  totalFail++
                }
              } else {
                console.warn(`🍟 바스켓 ${basketNumber}: recipe_ingredient 매칭 실패 (sku: ${sku})`)
                totalFail++
              }
            })

            // 각 바스켓에 타이머 설정 (튀김 시작은 "내리기" 버튼으로)
            affectedBundles.forEach(({ bundleId, timerSeconds }) => {
              const bundle = useGameStore.getState().bundleInstances.find((b) => b.id === bundleId)
              if (bundle) {
                // v3.2: timerSeconds만 설정, startedAt은 lowerBundle에서 설정
                updateBundleInstance(bundleId, {
                  cooking: {
                    ...bundle.cooking,
                    timerSeconds,
                    // startedAt은 설정하지 않음 (바스켓 내릴 때 설정)
                  }
                })
                console.log(`🍟 번들 ${bundleId}: 타이머 ${timerSeconds}초 설정 (내리기 대기)`)
              }
            })

            if (totalSuccess > 0 && totalFail === 0) {
              showToast(`튀김기: ${totalSuccess}개 재료 투입 완료`)
            } else if (totalSuccess > 0) {
              showToast(`튀김기: ${totalSuccess}개 성공, ${totalFail}개 오류`)
            } else {
              showToast('튀김기: 재료 투입 실패')
            }

            setFryerSetupPopup(null)
          }}
          onCancel={() => setFryerSetupPopup(null)}
        />
      )}

      {/* 콜드메뉴/튀김/전자레인지 접시 선택 팝업 - v3.1 리팩토링: instanceId 기반 */}
      {plateSelectPopup && (
        <PlateSelectPopup
          instanceId={plateSelectPopup.instanceId}
          onComplete={() => setPlateSelectPopup(null)}
          onCancel={() => setPlateSelectPopup(null)}
        />
      )}

      {lastServeError && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-orange-500 text-white px-6 py-3 rounded-xl shadow-lg">
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
          className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl cursor-pointer transition-transform hover:scale-110 active:scale-95 bg-purple-500 hover:bg-purple-600"
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

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
import SeasoningCounter from '../components/Kitchen/SeasoningCounter'
import AmountInputPopup from '../components/Kitchen/AmountInputPopup'

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
    endGame,
    getCurrentStepIngredients,
  } = useGameStore()

  const [selectedBurner, setSelectedBurner] = useState<number | null>(null)
  const [amountPopup, setAmountPopup] = useState<AmountPopupState>(null)
  const [toast, setToast] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const burnerUsageRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    timerRef.current = setInterval(() => useGameStore.getState().tickTimer(), 1000)
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
    <div className="h-full flex flex-col bg-[#F7F7F7] min-w-[1280px] overflow-y-auto">
      <WokDryingManager />
      <GameHeader />

      {/* 메뉴 대기열 - 플로우에 포함 */}
      <div className="shrink-0 px-4 py-3 bg-white border-b border-[#E0E0E0]">
        <MenuQueue onAssignToWok={handleAssignToWok} selectedBurner={selectedBurner} />
      </div>

      {/* 주방 레이아웃: 왼쪽 싱크대 | 중앙(화구+서랍) | 오른쪽 조미료대 */}
      <div className="flex min-h-[600px]">
        {/* 왼쪽: 싱크대 (청록색) */}
        <div className="w-48 shrink-0">
          <SinkArea />
        </div>

        {/* 중앙: 화구 3개 가로 + 서랍냉장고 2x2 (화구 바로 아래) */}
        <div className="flex-1 flex flex-col items-center justify-start pt-8 gap-6 p-6 min-w-0">
          <div className="flex gap-8 items-end">
            {[1, 2, 3].map((n) => (
              <Burner key={n} burnerNumber={n} />
            ))}
          </div>
          {targetWokForIngredient && (
            <p className="text-sm text-[#757575]">재료/조미료 투입 대상: 화구{targetWokForIngredient}</p>
          )}
          <DrawerFridge onSelectIngredient={handleSelectIngredient} />
        </div>

        {/* 오른쪽: 조미료대 (2행 3열, 독립) */}
        <div className="w-64 shrink-0">
          <SeasoningCounter onSelectSeasoning={handleSelectSeasoning} />
        </div>
      </div>

      {/* 레시피 가이드 (정답지) - footer와 독립 */}
      <RecipeGuide />

      {/* 액션 로그 & 화구 사용율 (작게, 가장 아래) */}
      <div className="shrink-0 grid grid-cols-2 gap-3 px-4 py-2 bg-gray-100 border-t border-gray-300">
        <div>
          <h4 className="font-semibold text-[#333] mb-1 text-xs">액션 로그</h4>
          <ActionLogPanel />
        </div>
        <div>
          <h4 className="font-semibold text-[#333] mb-1 text-xs">화구 사용율</h4>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-4 bg-[#E0E0E0] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, burnerUsagePercent)}%` }}
              />
            </div>
            <span className="font-mono font-semibold text-xs">{burnerUsagePercent}%</span>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl bg-[#333] text-white shadow-lg z-50">
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
    </div>
  )
}

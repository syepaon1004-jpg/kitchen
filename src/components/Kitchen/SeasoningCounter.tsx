import { useGameStore } from '../../stores/gameStore'
import type { Seasoning } from '../../types/database.types'

interface SeasoningCounterProps {
  onSelectSeasoning: (seasoning: Seasoning, requiredAmount: number, requiredUnit: string) => void
}

export default function SeasoningCounter({ onSelectSeasoning }: SeasoningCounterProps) {
  const { seasonings, woks, getCurrentStepIngredients } = useGameStore()

  const getRequiredForCurrentWoks = () => {
    const req: Record<string, { amount: number; unit: string }> = {}
    woks.forEach((w) => {
      if (!w.currentMenu) return
      const ingredients = getCurrentStepIngredients(w.currentMenu, w.currentStep)
      ingredients.forEach((i) => {
        if (i.required_sku.startsWith('SEASONING:')) {
          const name = i.required_sku.split(':')[1]
          req[name] = { amount: i.required_amount, unit: i.required_unit }
        }
      })
    })
    return req
  }
  const requiredFor = getRequiredForCurrentWoks()
  const slots = 6
  const gridItems: (Seasoning | null)[] = Array.from({ length: slots }, (_, i) => seasonings[i] ?? null)

  return (
    <div className="min-h-[600px] flex flex-col p-4 bg-amber-100 border-l border-amber-300 shadow-inner">
      <h3 className="text-xl font-bold mb-4 text-[#333]">조미료대</h3>
      <div className="grid grid-cols-3 gap-3">
        {gridItems.map((s, i) =>
          s ? (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSeasoning(s, requiredFor[s.seasoning_name]?.amount ?? 10, requiredFor[s.seasoning_name]?.unit ?? s.base_unit)}
              className="w-full min-h-[60px] max-w-[80px] mx-auto py-2 px-2 rounded-lg bg-white hover:bg-amber-50 border-2 border-amber-300 shadow text-[#333] text-xs font-medium flex flex-col items-center justify-center"
            >
              <span className="truncate w-full text-center">{s.seasoning_name}</span>
              {requiredFor[s.seasoning_name] && (
                <span className="text-[10px] text-amber-700 mt-0.5">
                  {requiredFor[s.seasoning_name].amount}{requiredFor[s.seasoning_name].unit}
                </span>
              )}
            </button>
          ) : (
            <div key={`empty-${i}`} className="min-h-[60px] max-w-[80px] mx-auto rounded-lg bg-amber-200/50 border border-amber-300/50" />
          )
        )}
      </div>
    </div>
  )
}

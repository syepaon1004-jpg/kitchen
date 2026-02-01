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
  const slots = 8
  const gridItems: (Seasoning | null)[] = Array.from({ length: slots }, (_, i) => seasonings[i] ?? null)

  return (
    <div className="w-full h-full p-4 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 border-2 border-orange-200 rounded-xl shadow-xl flex flex-col"
         style={{
           backgroundImage: `
             linear-gradient(135deg, 
               rgba(255,255,255,0.6) 0%, 
               rgba(251,191,36,0.2) 50%, 
               rgba(255,255,255,0.6) 100%)
           `,
           boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8), 0 8px 20px rgba(0,0,0,0.1)'
         }}>
      <div className="text-xs font-bold text-orange-800 mb-3 px-2 py-1 bg-white/70 rounded text-center tracking-wider border border-orange-300">
        🧂 조미료 선반
      </div>
      <div className="grid grid-cols-2 gap-3">
        {gridItems.map((s, i) =>
          s ? (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectSeasoning(s, requiredFor[s.seasoning_name]?.amount ?? 10, requiredFor[s.seasoning_name]?.unit ?? s.base_unit)}
              className="w-full min-h-[60px] max-w-[80px] mx-auto py-2 px-2 rounded-lg bg-white hover:bg-orange-50 border-2 border-orange-200 hover:border-orange-300 shadow-md hover:shadow-lg text-orange-900 text-xs font-bold transition-all flex flex-col items-center justify-center"
              style={{
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,1), 0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <div className="text-xl mb-1">{getSeasoningIcon(s.seasoning_name)}</div>
              <span className="truncate w-full text-center leading-tight">{s.seasoning_name}</span>
              {requiredFor[s.seasoning_name] && (
                <span className="text-[10px] text-orange-600 mt-0.5 font-medium">
                  {requiredFor[s.seasoning_name].amount}{requiredFor[s.seasoning_name].unit}
                </span>
              )}
            </button>
          ) : (
            <div key={`empty-${i}`} className="min-h-[60px] max-w-[80px] mx-auto rounded-lg bg-gray-100 border border-gray-200" />
          )
        )}
      </div>
    </div>
  )
}

function getSeasoningIcon(name: string): string {
  const icons: Record<string, string> = {
    소금: '🧂',
    설탕: '🍬',
    간장: '🥢',
    식용유: '🫗',
    참기름: '🥜',
    고추가루: '🌶️',
    후추: '⚫',
    다시다: '🥣',
    굴소스: '🦪',
    마늘: '🧄',
  }
  return icons[name] ?? '🧪'
}

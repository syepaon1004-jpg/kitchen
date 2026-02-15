import { useGameStore } from '../../stores/gameStore'
import type { Seasoning } from '../../types/database.types'
import type { EquipmentComponentProps } from './PlaceholderEquipment'
import { useSound } from '../../hooks/useSound'

/**
 * SeasoningEquipment - CSS Grid 기반 조미료대 컴포넌트
 * 기존 SeasoningCounter의 기능을 EquipmentComponentProps 기반으로 래핑
 * gameStore의 onSeasoningSelected 콜백을 통해 조미료 선택 이벤트 전달
 */
export default function SeasoningEquipment({
  displayName,
  config: _config,
  gridW,
  gridH,
}: EquipmentComponentProps) {
  const { seasonings, woks, getCurrentStepIngredients, onSeasoningSelected } = useGameStore()
  const { playSound } = useSound()

  // v3: location_type='SEASONING'인 재료 매칭
  const getRequiredForCurrentWoks = () => {
    const req: Record<string, { amount: number; unit: string }> = {}
    woks.forEach((w) => {
      if (!w.currentMenu) return
      const ingredients = getCurrentStepIngredients(w.currentMenu, w.currentStep, w.currentBundleId)
      ingredients.forEach((i) => {
        // v3: 조미료인지 확인 (storage_location.location_type='SEASONING')
        const locationType = i.inventory?.storage_location?.location_type
        if (locationType === 'SEASONING') {
          const name = i.display_name ?? i.ingredient_master?.ingredient_name ?? 'unknown'
          req[name] = { amount: i.required_amount, unit: i.required_unit }
        }
      })
    })
    return req
  }
  const requiredFor = getRequiredForCurrentWoks()

  // 조미료 선택 핸들러
  const handleSelectSeasoning = (seasoning: Seasoning, amount: number, unit: string) => {
    playSound('select')
    if (onSeasoningSelected) {
      onSeasoningSelected(seasoning, amount, unit)
    }
  }

  // 아이콘 매핑
  const getSeasoningIcon = (name: string): string => {
    const icons: Record<string, string> = {
      소금: '🧂',
      설탕: '🍬',
      간장: '🥢',
      식용유: '🫗',
      기름: '🫗',
      참기름: '🥜',
      고추가루: '🌶️',
      후추: '⚫',
      다시다: '🥣',
      굴소스: '🦪',
      마늘: '🧄',
      케첩: '🍅',
      카레가루: '🍛',
    }
    return icons[name] ?? '🧪'
  }

  // 그리드 크기에 따른 열 수 결정
  const cols = gridW >= 2 ? 3 : 2
  const rows = Math.ceil(seasonings.length / cols) || 1
  const totalSlots = rows * cols
  const gridItems: (Seasoning | null)[] = Array.from(
    { length: totalSlots },
    (_, i) => seasonings[i] ?? null
  )

  // 컴팩트 모드 (1×1 셀)
  const isCompact = gridW === 1 && gridH === 1

  if (isCompact) {
    return (
      <button
        type="button"
        onClick={() => {
          // 컴팩트 모드에서는 첫 번째 조미료 선택 또는 팝업 표시
          // 현재는 단순히 첫 번째 조미료 선택
          if (seasonings.length > 0) {
            const s = seasonings[0]
            handleSelectSeasoning(
              s,
              requiredFor[s.seasoning_name]?.amount ?? 10,
              requiredFor[s.seasoning_name]?.unit ?? s.base_unit
            )
          }
        }}
        className="w-full h-full bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 border border-orange-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-all"
        style={{
          backgroundImage: `
            linear-gradient(135deg,
              rgba(255,255,255,0.6) 0%,
              rgba(251,191,36,0.2) 50%,
              rgba(255,255,255,0.6) 100%)
          `,
        }}
      >
        <span className="text-xl">🧂</span>
        <span className="text-[8px] font-bold text-orange-800 mt-0.5">{displayName}</span>
      </button>
    )
  }

  return (
    <div
      className="w-full h-full p-2 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 border border-orange-200 rounded-lg flex flex-col overflow-hidden"
      style={{
        backgroundImage: `
          linear-gradient(135deg,
            rgba(255,255,255,0.6) 0%,
            rgba(251,191,36,0.2) 50%,
            rgba(255,255,255,0.6) 100%)
        `,
        boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* 헤더 */}
      <div className="text-[10px] font-bold text-orange-800 mb-1.5 px-1.5 py-0.5 bg-white/70 rounded text-center border border-orange-300">
        🧂 {displayName}
      </div>

      {/* 조미료 그리드 */}
      <div
        className="flex-1 grid gap-0.5 auto-rows-fr"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {gridItems.map((s, i) =>
          s ? (
            <button
              key={s.id}
              type="button"
              onClick={() =>
                handleSelectSeasoning(
                  s,
                  requiredFor[s.seasoning_name]?.amount ?? 10,
                  requiredFor[s.seasoning_name]?.unit ?? s.base_unit
                )
              }
              className="w-full h-full py-0.5 px-0.5 rounded bg-white hover:bg-orange-50 border border-orange-200 hover:border-orange-300 shadow-sm hover:shadow text-orange-900 font-bold transition-all flex flex-col items-center justify-center overflow-hidden"
            >
              <span className="text-xl leading-none">{getSeasoningIcon(s.seasoning_name)}</span>
              <span className="w-full text-center leading-none truncate mt-0.5 text-[10px]">{s.seasoning_name}</span>
              {requiredFor[s.seasoning_name] && (
                <span className="text-[9px] text-orange-600 font-medium leading-none">
                  {requiredFor[s.seasoning_name].amount}
                  {requiredFor[s.seasoning_name].unit}
                </span>
              )}
            </button>
          ) : (
            <div
              key={`empty-${i}`}
              className="rounded bg-indigo-100/50 border border-gray-200/50"
            />
          )
        )}
      </div>
    </div>
  )
}

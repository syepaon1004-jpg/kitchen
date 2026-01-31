import { useGameStore } from '../../stores/gameStore'
import { isSeasoningSKU } from '../../types/database.types'

const ACTION_LABELS: Record<string, string> = {
  STIR_FRY: '볶기',
  ADD_WATER: '물넣기',
  ADD_BROTH: '육수넣기',
  FLIP: '뒤집기',
}

export default function RecipeGuide() {
  const woks = useGameStore((s) => s.woks)
  const getRecipeByMenuName = useGameStore((s) => s.getRecipeByMenuName)
  const ingredients = useGameStore((s) => s.ingredients)

  // SKU에서 식자재 이름 추출
  const getIngredientName = (sku: string): string => {
    if (isSeasoningSKU(sku)) {
      // "SEASONING:참치액젓:10ML" → "참치액젓"
      return sku.split(':')[1] ?? sku
    }
    // ingredients_inventory에서 찾기
    const found = ingredients.find((ing) => ing.sku_full === sku)
    if (found?.ingredient_master?.ingredient_name) {
      return found.ingredient_master.ingredient_name
    }
    // 못 찾으면 SKU에서 파싱 시도
    const parts = sku.split('_')
    return parts[parts.length - 2] ?? sku
  }

  return (
    <div className="shrink-0 bg-blue-50 border-t-2 border-blue-300 p-4">
      <h4 className="font-bold text-[#333] mb-3 text-sm">📋 레시피 가이드 (정답지)</h4>
      <div className="grid grid-cols-3 gap-4">
        {woks.map((wok) => {
          const recipe = wok.currentMenu ? getRecipeByMenuName(wok.currentMenu) : null
          const sortedSteps = recipe?.steps ? [...recipe.steps].sort((a, b) => a.step_number - b.step_number) : []
          const currentStep = sortedSteps[wok.currentStep]
          const nextStep = sortedSteps[wok.currentStep + 1]

          return (
            <div
              key={wok.burnerNumber}
              className={`rounded-lg p-3 border-2 ${
                wok.currentMenu
                  ? 'bg-white border-blue-400'
                  : 'bg-gray-100 border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#333]">화구{wok.burnerNumber}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    wok.state === 'CLEAN'
                      ? 'bg-green-100 text-green-700'
                      : wok.state === 'WET'
                        ? 'bg-blue-100 text-blue-700'
                        : wok.state === 'DIRTY'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                  }`}
                >
                  {wok.state}
                </span>
              </div>

              {!wok.currentMenu ? (
                <p className="text-xs text-gray-500">메뉴 대기 중</p>
              ) : (
                <>
                  <div className="text-sm font-semibold text-blue-700 mb-2">
                    {wok.currentMenu}
                  </div>

                  {currentStep ? (
                    <div className="mb-2 p-2 bg-yellow-50 border border-yellow-300 rounded">
                      <div className="text-xs font-bold text-yellow-800 mb-1">
                        ▶ 현재 단계 {currentStep.step_number}
                      </div>
                      {currentStep.step_type === 'INGREDIENT' ? (
                        <div className="text-xs text-[#333] space-y-0.5">
                          {currentStep.ingredients?.map((ing, i) => (
                            <div key={i} className="font-medium">
                              • {getIngredientName(ing.required_sku)} {ing.required_amount}
                              {ing.required_unit}
                            </div>
                          )) ?? <div className="text-gray-500">재료 정보 없음</div>}
                        </div>
                      ) : (
                        <div className="text-xs text-[#333]">
                          • 액션: <strong>{currentStep.action_type}</strong>
                          {currentStep.time_limit_seconds && (
                            <span className="text-red-600 ml-1">
                              ({currentStep.time_limit_seconds}초 제한)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : sortedSteps.length > 0 ? (
                    <p className="text-xs text-green-600 font-semibold">✅ 조리 완료 → 서빙하세요</p>
                  ) : null}

                  {nextStep && currentStep && (
                    <div className="text-xs text-gray-600 mt-1">
                      다음:{' '}
                      {nextStep.step_type === 'INGREDIENT'
                        ? `재료 ${nextStep.ingredients?.length ?? 0}개`
                        : ACTION_LABELS[nextStep.action_type ?? ''] ?? nextStep.action_type}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

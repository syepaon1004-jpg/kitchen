import { useGameStore } from '../../stores/gameStore'
import type { RecipeIngredient } from '../../types/database.types'

const ACTION_LABELS: Record<string, string> = {
  STIR_FRY: '볶기',
  ADD_WATER: '물넣기',
  ADD_BROTH: '육수넣기',
  FLIP: '뒤집기',
}

export default function RecipeGuide() {
  const woks = useGameStore((s) => s.woks)
  const getRecipeByMenuName = useGameStore((s) => s.getRecipeByMenuName)

  // v3: RecipeIngredient에서 표시 이름 추출
  const getIngredientDisplayName = (ing: RecipeIngredient): string => {
    return ing.display_name
      ?? ing.ingredient_master?.ingredient_name
      ?? ing.id.slice(0, 8)
  }

  return (
    <div className="shrink-0 bg-white border-t border-gray-200 p-2 lg:p-4">
      <h4 className="font-bold text-gray-700 mb-2 lg:mb-3 text-xs lg:text-sm">📋 레시피 가이드 (정답지)</h4>
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-2 lg:gap-4">
        {woks.map((wok) => {
          const recipe = wok.currentMenu ? getRecipeByMenuName(wok.currentMenu) : null
          // v3: recipe_bundles에서 스텝 가져오기
          const targetBundles = wok.currentBundleId
            ? (recipe?.recipe_bundles ?? []).filter((b) => b.id === wok.currentBundleId)
            : recipe?.recipe_bundles ?? []
          const allSteps = targetBundles.flatMap((b) => b.recipe_steps ?? [])
          const sortedSteps = [...allSteps].sort((a, b) => a.step_number - b.step_number)
          const currentStep = sortedSteps[wok.currentStep]
          const nextStep = sortedSteps[wok.currentStep + 1]

          return (
            <div
              key={wok.burnerNumber}
              className={`rounded-lg p-2 lg:p-3 border ${
                wok.currentMenu
                  ? 'bg-white border-gray-200'
                  : 'bg-indigo-50 border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1 lg:mb-2">
                <span className="font-bold text-[#333] text-xs lg:text-sm">화구{wok.burnerNumber}</span>
                <span
                  className={`text-[10px] lg:text-xs px-1.5 lg:px-2 py-0.5 rounded font-medium ${
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
                <p className="text-[10px] lg:text-xs text-gray-500">메뉴 대기 중</p>
              ) : (
                <>
                  <div className="text-xs lg:text-sm font-semibold text-blue-700 mb-1 lg:mb-2 truncate">
                    {wok.currentMenu}
                  </div>

                  {currentStep ? (
                    <div className="mb-1 lg:mb-2 p-1.5 lg:p-2 bg-yellow-50 border border-yellow-300 rounded">
                      <div className="text-[10px] lg:text-xs font-bold text-yellow-800 mb-0.5 lg:mb-1">
                        ▶ 현재 단계 {currentStep.step_number}
                      </div>
                      {currentStep.step_type === 'INGREDIENT' ? (
                        <div className="text-[10px] lg:text-xs text-[#333] space-y-0.5">
                          {/* v3: recipe_ingredients 사용 */}
                          {currentStep.recipe_ingredients?.map((ing, i) => (
                            <div key={i} className="font-medium truncate">
                              • {getIngredientDisplayName(ing)} {ing.required_amount}
                              {ing.required_unit}
                            </div>
                          )) ?? <div className="text-gray-500">재료 정보 없음</div>}
                        </div>
                      ) : (
                        <div className="text-[10px] lg:text-xs text-[#333]">
                          • 액션: <strong>{currentStep.action_type}</strong>
                          {currentStep.time_limit_seconds && (
                            <span className="text-red-600 ml-1">
                              ({currentStep.time_limit_seconds}초)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : sortedSteps.length > 0 ? (
                    <p className="text-[10px] lg:text-xs text-green-600 font-semibold">✅ 조리 완료 → 서빙하세요</p>
                  ) : null}

                  {nextStep && currentStep && (
                    <div className="text-[10px] lg:text-xs text-gray-600 mt-0.5 lg:mt-1 truncate">
                      다음:{' '}
                      {nextStep.step_type === 'INGREDIENT'
                        ? `재료 ${nextStep.recipe_ingredients?.length ?? 0}개`
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

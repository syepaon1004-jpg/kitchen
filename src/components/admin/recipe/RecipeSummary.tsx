import { memo, useMemo } from 'react'
import type { IngredientMaster, IngredientInventory, PlateType, DecoIngredient } from '../../../types/database.types'
import type { LocalRecipe, LocalBundle, LocalStep, LocalDecoStep } from '../../../api/recipeApi'

interface Props {
  recipe: LocalRecipe
  ingredientsMaster: IngredientMaster[]
  inventoryItems: IngredientInventory[]
  plateTypes: PlateType[]
  decoIngredients: DecoIngredient[]
}

const COOKING_LABEL: Record<string, string> = {
  HOT: '화구(웍)',
  COLD: '접시(차가운)',
  MICROWAVE: '전자레인지',
  FRYING: '튀김기',
}

const ACTION_LABEL: Record<string, string> = {
  STIR_FRY: '볶기',
  FLIP: '뒤집기',
  ADD_WATER: '물 넣기',
  BOIL: '끓이기',
  SIMMER: '약불 조림',
  DEEP_FRY: '튀기기',
  BLANCH: '데치기',
  DRAIN: '물 빼기',
  TORCH: '토치',
  SLICE: '썰기',
  MIX: '섞기',
  MICROWAVE: '전자레인지 돌리기',
  LIFT_BASKET: '바스켓 올리기',
}

const MENU_TYPE_LABEL: Record<string, string> = {
  HOT: '뜨거운 요리',
  COLD: '차가운 요리',
  MIXED: '복합 요리 (뜨거운+차가운)',
  FRYING: '튀김 요리',
}

function RecipeSummary({ recipe, ingredientsMaster, inventoryItems, plateTypes, decoIngredients }: Props) {
  // 빠른 조회용 맵
  const masterMap = useMemo(() => {
    const m = new Map<string, IngredientMaster>()
    for (const item of ingredientsMaster) m.set(item.id, item)
    return m
  }, [ingredientsMaster])

  const inventoryMap = useMemo(() => {
    const m = new Map<string, IngredientInventory>()
    for (const item of inventoryItems) m.set(item.id, item)
    return m
  }, [inventoryItems])

  const plateMap = useMemo(() => {
    const m = new Map<string, PlateType>()
    for (const p of plateTypes) m.set(p.id, p)
    return m
  }, [plateTypes])

  const decoIngMap = useMemo(() => {
    const m = new Map<string, DecoIngredient>()
    for (const d of decoIngredients) m.set(d.id, d)
    return m
  }, [decoIngredients])

  const bundleMap = useMemo(() => {
    const m = new Map<string, LocalBundle>()
    for (const b of recipe.bundles) m.set(b.localId, b)
    return m
  }, [recipe.bundles])

  // 묶음이 없으면 요약 불필요
  if (recipe.bundles.length === 0 && recipe.decoSteps.length === 0) return null

  const mainBundles = recipe.bundles.filter((b) => b.is_main_dish)
  const sideBundles = recipe.bundles.filter((b) => !b.is_main_dish)

  const getIngredientName = (masterId: string) =>
    masterMap.get(masterId)?.ingredient_name ?? '(알 수 없음)'

  const getLocationName = (invId: string) => {
    const inv = inventoryMap.get(invId)
    return inv?.storage_location?.location_name ?? ''
  }

  const getPlateName = (plateId: string | null) => {
    if (!plateId) return null
    const p = plateMap.get(plateId)
    return p ? `${p.plate_name}` : null
  }

  const renderStepText = (step: LocalStep, stepIdx: number): string => {
    if (step.step_type === 'INGREDIENT') {
      if (step.ingredients.length === 0) return `${stepIdx}. 재료 투입 (재료 미지정)`
      const items = step.ingredients.map((ing) => {
        const name = ing._ingredientName || getIngredientName(ing.ingredient_master_id)
        const loc = ing._locationName || getLocationName(ing.inventory_id)
        const amt = ing.required_amount ? `${ing.required_amount}${ing.required_unit}` : ''
        const locStr = loc ? ` [${loc}]` : ''
        return `${name} ${amt}${locStr}`
      })
      return `${stepIdx}. 재료 넣기: ${items.join(', ')}`
    }

    // ACTION
    const actionName = ACTION_LABEL[step.action_type ?? ''] ?? step.action_type ?? '액션'
    const duration = step.action_params?.required_duration as number | undefined
    const durationStr = duration ? ` ${duration}초` : ''
    const instructionStr = step.instruction ? ` — ${step.instruction}` : ''
    return `${stepIdx}. ${actionName}${durationStr}${instructionStr}`
  }

  const renderBundle = (bundle: LocalBundle) => {
    const cookLabel = COOKING_LABEL[bundle.cooking_type] ?? bundle.cooking_type
    const plate = bundle.is_main_dish ? getPlateName(bundle.plate_type_id) : null
    const plateStr = plate ? ` / ${plate} 사용` : ''
    const roleStr = bundle.is_main_dish ? '(메인)' : '(사이드)'

    return (
      <div key={bundle.localId} className="mb-3">
        <p className="text-xs font-bold text-[#333] mb-1">
          {bundle.bundle_name || '(이름 없음)'} {roleStr} — {cookLabel}{plateStr}
        </p>
        {bundle.steps.length === 0 ? (
          <p className="text-[11px] text-[#999] ml-3">스텝 없음</p>
        ) : (
          <ol className="ml-3 space-y-0.5">
            {bundle.steps.map((step, si) => (
              <li key={step.localId} className="text-[11px] text-[#555] leading-relaxed">
                {renderStepText(step, si + 1)}
              </li>
            ))}
          </ol>
        )}
      </div>
    )
  }

  const renderDecoStep = (deco: LocalDecoStep, idx: number) => {
    let sourceLabel = ''
    if (deco.source_type === 'BUNDLE') {
      const b = deco.source_bundle_id ? bundleMap.get(deco.source_bundle_id) : null
      sourceLabel = b ? `"${b.bundle_name}" 묶음을 올린다` : `묶음 올리기`
    } else if (deco.source_type === 'DECO_ITEM') {
      const d = deco.deco_ingredient_id ? decoIngMap.get(deco.deco_ingredient_id) : null
      const name = d?.ingredient_master?.ingredient_name ?? deco.display_name ?? '데코재료'
      sourceLabel = `${name} 올리기`
    } else if (deco.source_type === 'SETTING_ITEM') {
      const inv = deco.inventory_id ? inventoryMap.get(deco.inventory_id) : null
      const name = inv?.ingredient_master?.ingredient_name ?? deco.display_name ?? '세팅재료'
      sourceLabel = `${name} 세팅`
    }

    const amtStr = deco.required_amount ? ` (${deco.required_amount}${deco.required_unit ?? ''})` : ''
    return (
      <li key={deco.localId} className="text-[11px] text-[#555] leading-relaxed">
        {idx + 1}. {sourceLabel}{amtStr}
      </li>
    )
  }

  // 정렬된 데코 스텝
  const sortedDecoSteps = [...recipe.decoSteps].sort((a, b) => a.deco_order - b.deco_order)

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
      <h3 className="text-sm font-bold text-amber-800 mb-3">
        레시피 요약 — "{recipe.menu_name || '(이름 없음)'}"
      </h3>

      {/* 기본 정보 한 줄 */}
      <p className="text-[11px] text-amber-700 mb-3">
        {MENU_TYPE_LABEL[recipe.menu_type] ?? recipe.menu_type}
        {recipe.category ? ` / ${recipe.category}` : ''}
      </p>

      {/* 조리 흐름 */}
      <div className="border-t border-amber-200 pt-3">
        {/* 메인 묶음 */}
        {mainBundles.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">조리</p>
            {mainBundles.map(renderBundle)}
          </div>
        )}

        {/* 사이드 묶음 */}
        {sideBundles.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">사이드 조리</p>
            {sideBundles.map(renderBundle)}
          </div>
        )}

        {/* 플레이팅 순서 */}
        {sortedDecoSteps.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">플레이팅 순서</p>
            <ol className="ml-3 space-y-0.5">
              {sortedDecoSteps.map((ds, i) => renderDecoStep(ds, i))}
            </ol>
          </div>
        )}

        {/* 간단한 흐름 요약 (MIXED일 때) */}
        {recipe.menu_type === 'MIXED' && mainBundles.length > 0 && sideBundles.length > 0 && (
          <div className="mt-3 pt-2 border-t border-amber-200">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">합치기 흐름</p>
            <p className="text-[11px] text-[#555] ml-3">
              {mainBundles.map((b) => `"${b.bundle_name}"`).join(', ')} 접시 위에{' '}
              {sortedDecoSteps
                .map((ds) => {
                  if (ds.source_type === 'BUNDLE') {
                    const b = ds.source_bundle_id ? bundleMap.get(ds.source_bundle_id) : null
                    return b ? `"${b.bundle_name}"` : null
                  }
                  return ds.display_name ? `"${ds.display_name}"` : null
                })
                .filter(Boolean)
                .join(' → ')}{' '}
              순서로 올려서 완성
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(RecipeSummary)

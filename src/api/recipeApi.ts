import { supabase } from '../lib/supabase'
import type { Recipe, RecipeBundle, RecipeStep, RecipeIngredient, DecoStep, PlateType, IngredientInventory } from '../types/database.types'

/**
 * Recipe API
 * 레시피 CRUD (5개 테이블 연쇄)
 * 패턴: 에러 시 throw → 호출 측 try/catch + toast
 */

// ==================== 로컬 편집 타입 ====================

export interface LocalRecipe {
  localId: string
  dbId: string | null
  store_id: string
  menu_name: string
  menu_name_en: string
  menu_type: 'HOT' | 'COLD' | 'MIXED' | 'FRYING'
  category: string
  difficulty_level: string
  estimated_cooking_time: number
  is_active: boolean
  bundles: LocalBundle[]
  decoSteps: LocalDecoStep[]
}

export interface LocalBundle {
  localId: string
  dbId: string | null
  bundle_name: string
  bundle_name_en: string
  bundle_order: number
  cooking_type: 'HOT' | 'COLD' | 'MICROWAVE' | 'FRYING'
  is_main_dish: boolean
  plate_type_id: string | null
  merge_order: number | null
  description: string
  steps: LocalStep[]
}

export interface LocalStep {
  localId: string
  dbId: string | null
  step_number: number
  step_group: number
  step_type: 'INGREDIENT' | 'ACTION'
  action_type: string | null
  action_params: Record<string, unknown>
  time_limit_seconds: number | null
  is_order_critical: boolean
  instruction: string
  ingredients: LocalIngredient[]
}

export interface LocalIngredient {
  localId: string
  dbId: string | null
  ingredient_master_id: string
  inventory_id: string
  required_amount: number
  required_unit: string
  display_name: string
  is_exact_match_required: boolean
  // UI 표시용 (DB 저장 안함)
  _ingredientName?: string
  _locationName?: string
}

export interface LocalDecoStep {
  localId: string
  dbId: string | null
  deco_order: number
  source_type: 'DECO_ITEM' | 'SETTING_ITEM' | 'BUNDLE'
  deco_ingredient_id: string | null
  inventory_id: string | null
  source_bundle_id: string | null   // 로컬에서는 bundle localId 사용
  display_name: string
  required_amount: number | null
  required_unit: string | null
  grid_position: number
  layer_image_color: string
  layer_order: number
}

// ==================== DB → Local 변환 ====================

const NESTED_RECIPE_SELECT = `
  *,
  recipe_bundles(
    *,
    plate_type:plate_types(*),
    recipe_steps(
      *,
      recipe_ingredients(
        *,
        ingredient_master:ingredients_master(*),
        inventory:ingredients_inventory(
          *,
          storage_location:storage_locations(*)
        )
      )
    )
  )
`

export function fromDbRecipe(recipe: Recipe, decoSteps: DecoStep[]): LocalRecipe {
  const bundles = (recipe.recipe_bundles ?? [])
    .sort((a, b) => a.bundle_order - b.bundle_order)
    .map(fromDbBundle)

  // deco_steps의 source_bundle_id를 localId로 매핑
  const dbIdToLocalId = new Map<string, string>()
  for (const b of bundles) {
    if (b.dbId) dbIdToLocalId.set(b.dbId, b.localId)
  }

  const localDecoSteps = decoSteps
    .filter(ds => ds.recipe_id === recipe.id)
    .sort((a, b) => a.deco_order - b.deco_order)
    .map(ds => fromDbDecoStep(ds, dbIdToLocalId))

  return {
    localId: crypto.randomUUID(),
    dbId: recipe.id,
    store_id: recipe.store_id,
    menu_name: recipe.menu_name,
    menu_name_en: recipe.menu_name_en ?? '',
    menu_type: recipe.menu_type ?? 'HOT',
    category: recipe.category ?? '',
    difficulty_level: recipe.difficulty_level ?? 'BEGINNER',
    estimated_cooking_time: recipe.estimated_cooking_time ?? 300,
    is_active: recipe.is_active !== false,
    bundles,
    decoSteps: localDecoSteps,
  }
}

export function fromDbBundle(bundle: RecipeBundle): LocalBundle {
  const steps = (bundle.recipe_steps ?? [])
    .sort((a, b) => a.step_number - b.step_number)
    .map(fromDbStep)

  return {
    localId: crypto.randomUUID(),
    dbId: bundle.id,
    bundle_name: bundle.bundle_name,
    bundle_name_en: bundle.bundle_name_en ?? '',
    bundle_order: bundle.bundle_order,
    cooking_type: bundle.cooking_type,
    is_main_dish: bundle.is_main_dish,
    plate_type_id: bundle.plate_type_id,
    merge_order: bundle.merge_order ?? null,
    description: bundle.description ?? '',
    steps,
  }
}

function fromDbStep(step: RecipeStep): LocalStep {
  const ingredients = (step.recipe_ingredients ?? []).map(fromDbIngredient)

  return {
    localId: crypto.randomUUID(),
    dbId: step.id,
    step_number: step.step_number,
    step_group: step.step_group ?? 1,
    step_type: step.step_type,
    action_type: step.action_type ?? null,
    action_params: step.action_params ?? {},
    time_limit_seconds: step.time_limit_seconds ?? null,
    is_order_critical: step.is_order_critical ?? false,
    instruction: step.instruction ?? '',
    ingredients,
  }
}

function fromDbIngredient(ing: RecipeIngredient): LocalIngredient {
  return {
    localId: crypto.randomUUID(),
    dbId: ing.id,
    ingredient_master_id: ing.ingredient_master_id,
    inventory_id: ing.inventory_id,
    required_amount: ing.required_amount,
    required_unit: ing.required_unit,
    display_name: ing.display_name ?? '',
    is_exact_match_required: ing.is_exact_match_required !== false,
    _ingredientName: ing.ingredient_master?.ingredient_name,
    _locationName: ing.inventory?.storage_location?.location_name,
  }
}

function fromDbDecoStep(ds: DecoStep, bundleDbIdToLocalId: Map<string, string>): LocalDecoStep {
  return {
    localId: crypto.randomUUID(),
    dbId: ds.id,
    deco_order: ds.deco_order,
    source_type: ds.source_type,
    deco_ingredient_id: ds.deco_ingredient_id ?? null,
    inventory_id: ds.inventory_id ?? null,
    source_bundle_id: ds.source_bundle_id
      ? (bundleDbIdToLocalId.get(ds.source_bundle_id) ?? ds.source_bundle_id)
      : null,
    display_name: ds.display_name,
    required_amount: ds.required_amount ?? null,
    required_unit: ds.required_unit ?? null,
    grid_position: ds.grid_position ?? 5,
    layer_image_color: ds.layer_image_color ?? '#FF6B6B',
    layer_order: ds.layer_order ?? 1,
  }
}

// ==================== 빈 항목 생성 ====================

export function createEmptyRecipe(storeId: string): LocalRecipe {
  return {
    localId: crypto.randomUUID(),
    dbId: null,
    store_id: storeId,
    menu_name: '',
    menu_name_en: '',
    menu_type: 'HOT',
    category: '',
    difficulty_level: 'BEGINNER',
    estimated_cooking_time: 300,
    is_active: true,
    bundles: [],
    decoSteps: [],
  }
}

export function createEmptyBundle(order: number): LocalBundle {
  return {
    localId: crypto.randomUUID(),
    dbId: null,
    bundle_name: '',
    bundle_name_en: '',
    bundle_order: order,
    cooking_type: 'HOT',
    is_main_dish: order === 1,
    plate_type_id: null,
    merge_order: null,
    description: '',
    steps: [],
  }
}

export function createEmptyStep(stepNumber: number): LocalStep {
  return {
    localId: crypto.randomUUID(),
    dbId: null,
    step_number: stepNumber,
    step_group: 1,
    step_type: 'INGREDIENT',
    action_type: null,
    action_params: {},
    time_limit_seconds: null,
    is_order_critical: false,
    instruction: '',
    ingredients: [],
  }
}

export function createEmptyIngredient(): LocalIngredient {
  return {
    localId: crypto.randomUUID(),
    dbId: null,
    ingredient_master_id: '',
    inventory_id: '',
    required_amount: 0,
    required_unit: 'g',
    display_name: '',
    is_exact_match_required: true,
  }
}

export function createEmptyDecoStep(order: number): LocalDecoStep {
  return {
    localId: crypto.randomUUID(),
    dbId: null,
    deco_order: order,
    source_type: 'DECO_ITEM',
    deco_ingredient_id: null,
    inventory_id: null,
    source_bundle_id: null,
    display_name: '',
    required_amount: null,
    required_unit: null,
    grid_position: 5,
    layer_image_color: '#FF6B6B',
    layer_order: order,
  }
}

// ==================== 조회 함수 ====================

export async function fetchRecipesByStore(storeId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(NESTED_RECIPE_SELECT)
    .eq('store_id', storeId)
    .order('menu_name')

  if (error) throw new Error(`레시피 목록 조회 실패: ${error.message}`)
  return (data ?? []) as Recipe[]
}

export async function fetchDecoStepsByRecipeIds(recipeIds: string[]): Promise<DecoStep[]> {
  if (recipeIds.length === 0) return []
  const { data, error } = await supabase
    .from('deco_steps')
    .select('*')
    .in('recipe_id', recipeIds)
    .order('deco_order')

  if (error) throw new Error(`데코 스텝 조회 실패: ${error.message}`)
  return (data ?? []) as DecoStep[]
}

export async function fetchPlateTypesByStore(storeId: string): Promise<PlateType[]> {
  const { data, error } = await supabase
    .from('plate_types')
    .select('*')
    .eq('store_id', storeId)
    .order('display_order', { ascending: true })

  if (error) throw new Error(`접시 타입 조회 실패: ${error.message}`)
  return (data ?? []) as PlateType[]
}

export async function fetchInventoryByStore(storeId: string): Promise<IngredientInventory[]> {
  const { data, error } = await supabase
    .from('ingredients_inventory')
    .select('*, ingredient_master:ingredients_master(*), storage_location:storage_locations(*)')
    .eq('store_id', storeId)
    .order('display_order', { ascending: true })

  if (error) throw new Error(`재고 조회 실패: ${error.message}`)
  return (data ?? []) as IngredientInventory[]
}

export async function createPlateType(
  input: { store_id: string; plate_name: string; plate_category?: string; plate_color?: string }
): Promise<PlateType> {
  const { data, error } = await supabase
    .from('plate_types')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`접시 타입 생성 실패: ${error.message}`)
  return data as PlateType
}

// ==================== 저장 (FK 순서 일괄) ====================

interface SaveResult {
  recipeDbId: string
  bundleIdMap: Map<string, string>  // localId → dbId
}

/**
 * 레시피 전체 트리 일괄 저장
 * FK 순서: recipes → bundles → steps → ingredients → deco_steps
 * 삭제는 역순: ingredients → steps → bundles → deco_steps
 */
export async function saveRecipe(
  localRecipe: LocalRecipe,
  originalBundleDbIds: Set<string>,
  originalStepDbIds: Set<string>,
  originalIngredientDbIds: Set<string>,
  originalDecoStepDbIds: Set<string>,
): Promise<SaveResult> {

  console.group('[saveRecipe] 시작')
  console.log('recipe dbId:', localRecipe.dbId, '| localId:', localRecipe.localId, '| menu_name:', localRecipe.menu_name)
  console.log('bundles:', localRecipe.bundles.map(b => ({ localId: b.localId, dbId: b.dbId, name: b.bundle_name })))
  console.log('originalDbIds:', {
    bundles: [...originalBundleDbIds],
    steps: [...originalStepDbIds],
    ingredients: [...originalIngredientDbIds],
    decoSteps: [...originalDecoStepDbIds],
  })

  // === Phase 0: 삭제 대상 수집 & 역순 삭제 ===
  const currentBundleDbIds = new Set(localRecipe.bundles.map(b => b.dbId).filter(Boolean) as string[])
  const currentStepDbIds = new Set(localRecipe.bundles.flatMap(b => b.steps.map(s => s.dbId).filter(Boolean)) as string[])
  const currentIngredientDbIds = new Set(
    localRecipe.bundles.flatMap(b => b.steps.flatMap(s => s.ingredients.map(i => i.dbId).filter(Boolean))) as string[]
  )
  const currentDecoStepDbIds = new Set(localRecipe.decoSteps.map(d => d.dbId).filter(Boolean) as string[])

  const deletedIngredientIds = [...originalIngredientDbIds].filter(id => !currentIngredientDbIds.has(id))
  const deletedStepIds = [...originalStepDbIds].filter(id => !currentStepDbIds.has(id))
  const deletedBundleIds = [...originalBundleDbIds].filter(id => !currentBundleDbIds.has(id))
  const deletedDecoStepIds = [...originalDecoStepDbIds].filter(id => !currentDecoStepDbIds.has(id))

  // FK 역순 삭제: recipe_ingredients → recipe_steps → recipe_bundles → deco_steps
  if (deletedIngredientIds.length > 0) {
    const { error } = await supabase.from('recipe_ingredients').delete().in('id', deletedIngredientIds)
    if (error) throw new Error(`재료 삭제 실패: ${error.message}`)
  }
  if (deletedStepIds.length > 0) {
    const { error } = await supabase.from('recipe_steps').delete().in('id', deletedStepIds)
    if (error) throw new Error(`스텝 삭제 실패: ${error.message}`)
  }
  if (deletedBundleIds.length > 0) {
    const { error } = await supabase.from('recipe_bundles').delete().in('id', deletedBundleIds)
    if (error) throw new Error(`묶음 삭제 실패: ${error.message}`)
  }
  if (deletedDecoStepIds.length > 0) {
    const { error } = await supabase.from('deco_steps').delete().in('id', deletedDecoStepIds)
    if (error) throw new Error(`데코 스텝 삭제 실패: ${error.message}`)
  }

  // === Phase 1: Recipe UPSERT ===
  console.log('[Phase 1] Recipe UPSERT — dbId:', localRecipe.dbId, '→', localRecipe.dbId ? 'UPDATE' : 'INSERT')
  let recipeDbId: string

  const recipePayload = {
    store_id: localRecipe.store_id,
    menu_name: localRecipe.menu_name,
    menu_name_en: localRecipe.menu_name_en || null,
    menu_type: localRecipe.menu_type,
    category: localRecipe.category || null,
    difficulty_level: localRecipe.difficulty_level,
    estimated_cooking_time: localRecipe.estimated_cooking_time,
    is_active: localRecipe.is_active,
  }

  console.log('[Phase 1] payload:', recipePayload)
  if (localRecipe.dbId) {
    console.log('[Phase 1] UPDATE recipes SET ... WHERE id =', localRecipe.dbId)
    const { data, error } = await supabase
      .from('recipes')
      .update(recipePayload)
      .eq('id', localRecipe.dbId)
      .select()
      .single()
    if (error) {
      console.error('[Phase 1] UPDATE 실패:', error)
      throw new Error(`레시피 수정 실패: ${error.message}`)
    }
    recipeDbId = data.id
    console.log('[Phase 1] UPDATE 성공, id:', recipeDbId)
  } else {
    console.log('[Phase 1] INSERT INTO recipes ...')
    const { data, error } = await supabase
      .from('recipes')
      .insert(recipePayload)
      .select()
      .single()
    if (error) {
      console.error('[Phase 1] INSERT 실패:', error)
      throw new Error(`레시피 생성 실패: ${error.message}`)
    }
    recipeDbId = data.id
    console.log('[Phase 1] INSERT 성공, id:', recipeDbId)
  }

  // === Phase 2: Bundles UPSERT + ID 매핑 ===
  console.log('[Phase 2] Bundles UPSERT — count:', localRecipe.bundles.length)
  const bundleIdMap = new Map<string, string>()

  for (const bundle of localRecipe.bundles) {
    console.log(`[Phase 2] bundle "${bundle.bundle_name}" — dbId:`, bundle.dbId, '→', bundle.dbId ? 'UPDATE' : 'INSERT')
    const bundlePayload = {
      recipe_id: recipeDbId,
      bundle_name: bundle.bundle_name,
      bundle_name_en: bundle.bundle_name_en || null,
      bundle_order: bundle.bundle_order,
      cooking_type: bundle.cooking_type,
      is_main_dish: bundle.is_main_dish,
      plate_type_id: bundle.plate_type_id,
      merge_order: bundle.merge_order,
      description: bundle.description || null,
    }

    let bundleDbId: string
    if (bundle.dbId) {
      const { data, error } = await supabase
        .from('recipe_bundles')
        .update(bundlePayload)
        .eq('id', bundle.dbId)
        .select()
        .single()
      if (error) throw new Error(`묶음 수정 실패: ${error.message}`)
      bundleDbId = data.id
    } else {
      const { data, error } = await supabase
        .from('recipe_bundles')
        .insert(bundlePayload)
        .select()
        .single()
      if (error) throw new Error(`묶음 생성 실패: ${error.message}`)
      bundleDbId = data.id
    }
    bundleIdMap.set(bundle.localId, bundleDbId)
  }

  // === Phase 3: Steps UPSERT + ID 매핑 ===
  console.log('[Phase 3] Steps UPSERT')
  const stepIdMap = new Map<string, string>()

  for (const bundle of localRecipe.bundles) {
    const bundleDbId = bundleIdMap.get(bundle.localId)!
    for (const step of bundle.steps) {
      console.log(`[Phase 3] step #${step.step_number} (${step.step_type}) — dbId:`, step.dbId, '→', step.dbId ? 'UPDATE' : 'INSERT')
      const stepPayload = {
        bundle_id: bundleDbId,
        step_number: step.step_number,
        step_group: step.step_group,
        step_type: step.step_type,
        action_type: step.step_type === 'ACTION' ? step.action_type : null,
        action_params: step.step_type === 'ACTION' ? step.action_params : {},
        time_limit_seconds: step.time_limit_seconds,
        instruction: step.instruction || null,
      }

      let stepDbId: string
      if (step.dbId) {
        const { data, error } = await supabase
          .from('recipe_steps')
          .update(stepPayload)
          .eq('id', step.dbId)
          .select()
          .single()
        if (error) throw new Error(`스텝 수정 실패: ${error.message}`)
        stepDbId = data.id
      } else {
        const { data, error } = await supabase
          .from('recipe_steps')
          .insert(stepPayload)
          .select()
          .single()
        if (error) throw new Error(`스텝 생성 실패: ${error.message}`)
        stepDbId = data.id
      }
      stepIdMap.set(step.localId, stepDbId)
    }
  }

  // === Phase 4: Ingredients UPSERT ===
  console.log('[Phase 4] Ingredients UPSERT')
  for (const bundle of localRecipe.bundles) {
    for (const step of bundle.steps) {
      if (step.step_type !== 'INGREDIENT') continue
      const stepDbId = stepIdMap.get(step.localId)!
      for (const ing of step.ingredients) {
        const ingPayload = {
          recipe_step_id: stepDbId,
          ingredient_master_id: ing.ingredient_master_id,
          inventory_id: ing.inventory_id,
          required_amount: ing.required_amount,
          required_unit: ing.required_unit,
          display_name: ing.display_name || null,
          is_exact_match_required: ing.is_exact_match_required,
        }

        if (ing.dbId) {
          const { error } = await supabase
            .from('recipe_ingredients')
            .update(ingPayload)
            .eq('id', ing.dbId)
          if (error) throw new Error(`재료 수정 실패: ${error.message}`)
        } else {
          const { error } = await supabase
            .from('recipe_ingredients')
            .insert(ingPayload)
          if (error) throw new Error(`재료 생성 실패: ${error.message}`)
        }
      }
    }
  }

  // === Phase 5: DecoSteps UPSERT ===
  console.log('[Phase 5] DecoSteps UPSERT — count:', localRecipe.decoSteps.length)
  for (const deco of localRecipe.decoSteps) {
    console.log(`[Phase 5] deco #${deco.deco_order} "${deco.display_name}" — dbId:`, deco.dbId, '→', deco.dbId ? 'UPDATE' : 'INSERT')
    // source_bundle_id 매핑: localId → 실제 dbId
    let resolvedSourceBundleId: string | null = null
    if (deco.source_type === 'BUNDLE' && deco.source_bundle_id) {
      resolvedSourceBundleId = bundleIdMap.get(deco.source_bundle_id) ?? null
      if (!resolvedSourceBundleId) {
        console.warn(`[saveRecipe] 데코 스텝 "${deco.display_name}"의 source_bundle_id 매핑 실패 (삭제된 묶음일 수 있음). null 처리`)
      }
    }

    const decoPayload = {
      recipe_id: recipeDbId,
      deco_order: deco.deco_order,
      source_type: deco.source_type,
      deco_ingredient_id: deco.source_type === 'DECO_ITEM' ? deco.deco_ingredient_id : null,
      inventory_id: deco.source_type === 'SETTING_ITEM' ? deco.inventory_id : null,
      source_bundle_id: deco.source_type === 'BUNDLE' ? resolvedSourceBundleId : null,
      display_name: deco.display_name,
      required_amount: deco.required_amount,
      required_unit: deco.required_unit,
      grid_position: deco.grid_position,
      layer_image_color: deco.layer_image_color,
      layer_order: deco.layer_order,
    }

    if (deco.dbId) {
      const { error } = await supabase
        .from('deco_steps')
        .update(decoPayload)
        .eq('id', deco.dbId)
      if (error) throw new Error(`데코 스텝 수정 실패: ${error.message}`)
    } else {
      const { error } = await supabase
        .from('deco_steps')
        .insert(decoPayload)
      if (error) throw new Error(`데코 스텝 생성 실패: ${error.message}`)
    }
  }

  console.log('[saveRecipe] 완료! recipeDbId:', recipeDbId)
  console.groupEnd()
  return { recipeDbId, bundleIdMap }
}

// ==================== 레시피 삭제 ====================

export async function deleteRecipe(recipeId: string): Promise<void> {
  // FK 역순 삭제: recipe_ingredients → recipe_steps → recipe_bundles → deco_steps → recipe
  // 1. 묶음 ID 조회
  const { data: bundles } = await supabase
    .from('recipe_bundles')
    .select('id')
    .eq('recipe_id', recipeId)

  if (bundles && bundles.length > 0) {
    const bundleIds = bundles.map(b => b.id)
    // 2. 스텝 ID 조회
    const { data: steps } = await supabase
      .from('recipe_steps')
      .select('id')
      .in('bundle_id', bundleIds)

    if (steps && steps.length > 0) {
      const stepIds = steps.map(s => s.id)
      // 3. 재료 삭제
      const { error: ingErr } = await supabase
        .from('recipe_ingredients')
        .delete()
        .in('recipe_step_id', stepIds)
      if (ingErr) throw new Error(`재료 삭제 실패: ${ingErr.message}`)
    }

    // 4. 스텝 삭제
    const { error: stepErr } = await supabase
      .from('recipe_steps')
      .delete()
      .in('bundle_id', bundleIds)
    if (stepErr) throw new Error(`스텝 삭제 실패: ${stepErr.message}`)

    // 5. 묶음 삭제
    const { error: bundleErr } = await supabase
      .from('recipe_bundles')
      .delete()
      .eq('recipe_id', recipeId)
    if (bundleErr) throw new Error(`묶음 삭제 실패: ${bundleErr.message}`)
  }

  // 6. 데코 스텝 삭제
  const { error: decoErr } = await supabase
    .from('deco_steps')
    .delete()
    .eq('recipe_id', recipeId)
  if (decoErr) throw new Error(`데코 삭제 실패: ${decoErr.message}`)

  // 7. 레시피 삭제
  const { error: recipeErr } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
  if (recipeErr) throw new Error(`레시피 삭제 실패: ${recipeErr.message}`)
}

// ==================== 검증 ====================

export function validateRecipe(recipe: LocalRecipe): string[] {
  const errors: string[] = []

  if (!recipe.menu_name.trim()) {
    errors.push('메뉴명을 입력하세요.')
  }
  if (recipe.bundles.length === 0) {
    errors.push('최소 1개 묶음이 필요합니다.')
  }

  for (const bundle of recipe.bundles) {
    if (!bundle.bundle_name.trim()) {
      errors.push(`묶음 ${bundle.bundle_order}: 묶음명을 입력하세요.`)
    }
    if (bundle.steps.length === 0) {
      errors.push(`묶음 "${bundle.bundle_name || bundle.bundle_order}": 최소 1개 스텝이 필요합니다.`)
    }
    for (const step of bundle.steps) {
      if (step.step_type === 'INGREDIENT' && step.ingredients.length === 0) {
        errors.push(`묶음 "${bundle.bundle_name}" 스텝 ${step.step_number}: 최소 1개 재료가 필요합니다.`)
      }
      if (step.step_type === 'ACTION' && !step.action_type) {
        errors.push(`묶음 "${bundle.bundle_name}" 스텝 ${step.step_number}: 액션 타입을 선택하세요.`)
      }
      for (const ing of step.ingredients) {
        if (!ing.inventory_id) {
          errors.push(`묶음 "${bundle.bundle_name}" 스텝 ${step.step_number}: 재료 위치(inventory)를 선택하세요.`)
        }
        if (ing.required_amount <= 0) {
          errors.push(`묶음 "${bundle.bundle_name}" 스텝 ${step.step_number}: 수량은 0보다 커야 합니다.`)
        }
      }
    }
  }

  if (recipe.menu_type === 'MIXED') {
    const hasMain = recipe.bundles.some(b => b.is_main_dish)
    if (!hasMain) {
      errors.push('MIXED 메뉴에는 최소 1개 메인 묶음(is_main_dish)이 필요합니다.')
    }
  }

  return errors
}

// ==================== 순서 재계산 ====================

export function renumberBundles(bundles: LocalBundle[]): LocalBundle[] {
  return bundles.map((b, i) => ({ ...b, bundle_order: i + 1 }))
}

export function renumberSteps(steps: LocalStep[]): LocalStep[] {
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }))
}

export function renumberDecoSteps(decoSteps: LocalDecoStep[]): LocalDecoStep[] {
  return decoSteps.map((d, i) => ({ ...d, deco_order: i + 1 }))
}

// ==================== 원본 DB ID 수집 ====================

export function collectOriginalDbIds(recipe: LocalRecipe) {
  const bundleDbIds = new Set<string>()
  const stepDbIds = new Set<string>()
  const ingredientDbIds = new Set<string>()
  const decoStepDbIds = new Set<string>()

  for (const b of recipe.bundles) {
    if (b.dbId) bundleDbIds.add(b.dbId)
    for (const s of b.steps) {
      if (s.dbId) stepDbIds.add(s.dbId)
      for (const i of s.ingredients) {
        if (i.dbId) ingredientDbIds.add(i.dbId)
      }
    }
  }
  for (const d of recipe.decoSteps) {
    if (d.dbId) decoStepDbIds.add(d.dbId)
  }

  return { bundleDbIds, stepDbIds, ingredientDbIds, decoStepDbIds }
}

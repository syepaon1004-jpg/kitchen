import { supabase } from '../lib/supabase'
import type { StorageLocation, IngredientMaster, IngredientInventory, DecoIngredient } from '../types/database.types'
import { updateEquipment } from './kitchenEditorApi'

/**
 * Inventory API
 * 저장 공간, 재료 마스터, 재고 CRUD
 * 패턴: 에러 시 throw → 호출 측 try/catch + toast
 */

// ==================== 저장 공간 ====================

export async function fetchStorageLocationsByStore(storeId: string): Promise<StorageLocation[]> {
  const { data, error } = await supabase
    .from('storage_locations')
    .select('*')
    .eq('store_id', storeId)
    .order('position_order', { ascending: true })

  if (error) throw new Error(`저장 공간 조회 실패: ${error.message}`)
  return (data ?? []) as StorageLocation[]
}

export async function fetchStorageLocationsByCodes(
  storeId: string,
  codes: string[]
): Promise<StorageLocation[]> {
  if (codes.length === 0) return []
  const { data, error } = await supabase
    .from('storage_locations')
    .select('*')
    .eq('store_id', storeId)
    .in('location_code', codes)
    .order('position_order', { ascending: true })

  if (error) throw new Error(`저장 공간 조회 실패: ${error.message}`)
  return (data ?? []) as StorageLocation[]
}

/**
 * FRIDGE 타입 부모의 자식 FRIDGE_FLOOR들을 조회
 */
export async function fetchFridgeFloors(
  storeId: string,
  parentIds: string[]
): Promise<StorageLocation[]> {
  if (parentIds.length === 0) return []
  const { data, error } = await supabase
    .from('storage_locations')
    .select('*')
    .eq('store_id', storeId)
    .eq('location_type', 'FRIDGE_FLOOR')
    .in('parent_location_id', parentIds)
    .order('location_code', { ascending: true })

  if (error) throw new Error(`냉장고 층 조회 실패: ${error.message}`)
  return (data ?? []) as StorageLocation[]
}

// ---------- 자동 생성 ----------

/** 장비 타입에 따라 location_code 접두사와 구조를 결정하여 자동 생성 */
interface LocationTemplate {
  code: string
  name: string
  type: StorageLocation['location_type']
  gridRows: number
  gridCols: number
  hasFloors: boolean
  floorCount: number
  positionOrder: number
}

/** equipment_key에서 번호 추출 (예: drawer_fridge_1 → "1") */
function extractEquipmentNumber(equipmentKey: string): string {
  const match = equipmentKey.match(/_(\d+)$/)
  return match ? match[1] : '1'
}

function buildDrawerTemplates(num: string): LocationTemplate[] {
  return [
    { code: `DRAWER_${num}_LT`, name: `서랍 ${num} 왼쪽 위`, type: 'DRAWER', gridRows: 4, gridCols: 2, hasFloors: false, floorCount: 1, positionOrder: 1 },
    { code: `DRAWER_${num}_RT`, name: `서랍 ${num} 오른쪽 위`, type: 'DRAWER', gridRows: 4, gridCols: 2, hasFloors: false, floorCount: 1, positionOrder: 2 },
    { code: `DRAWER_${num}_LB`, name: `서랍 ${num} 왼쪽 아래`, type: 'DRAWER', gridRows: 4, gridCols: 2, hasFloors: false, floorCount: 1, positionOrder: 3 },
    { code: `DRAWER_${num}_RB`, name: `서랍 ${num} 오른쪽 아래`, type: 'DRAWER', gridRows: 4, gridCols: 2, hasFloors: false, floorCount: 1, positionOrder: 4 },
  ]
}

function buildFreezerTemplates(num: string): LocationTemplate[] {
  const positions = ['LT', 'RT', 'LB', 'RB']
  const names = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래']
  return positions.map((pos, i) => ({
    code: `FREEZER_${num}_${pos}`,
    name: `냉동고 ${num} ${names[i]}`,
    type: 'FREEZER' as StorageLocation['location_type'],
    gridRows: 4, gridCols: 4,
    hasFloors: true, floorCount: 2,
    positionOrder: i + 1,
  }))
}

function buildFridgeTemplates(num: string): LocationTemplate[] {
  const positions = ['LT', 'RT', 'LB', 'RB']
  const names = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래']
  const templates: LocationTemplate[] = []
  positions.forEach((pos, i) => {
    templates.push({
      code: `FRIDGE_${num}_${pos}`,
      name: `냉장고 ${num} ${names[i]}`,
      type: 'FRIDGE',
      gridRows: 2, gridCols: 2,
      hasFloors: true, floorCount: 2,
      positionOrder: i + 1,
    })
  })
  return templates
}

/**
 * 장비 타입에 따라 storage_locations를 자동 생성하고, 생성된 location_code 배열을 반환.
 * 이미 존재하는 코드는 건너뛴다 (UPSERT).
 */
export async function initStorageLocationsForEquipment(
  storeId: string,
  equipmentType: string,
  equipmentKey: string
): Promise<{ locations: StorageLocation[]; codes: string[] }> {
  const num = extractEquipmentNumber(equipmentKey)

  let templates: LocationTemplate[] = []
  switch (equipmentType) {
    case 'DRAWER_FRIDGE':
      templates = buildDrawerTemplates(num)
      break
    case 'FRIDGE_4BOX':
      templates = buildFridgeTemplates(num)
      break
    case 'SEASONING_COUNTER':
      templates = [{ code: `SEASONING_${num}`, name: `조미료대 ${num}`, type: 'SEASONING', gridRows: 4, gridCols: 2, hasFloors: false, floorCount: 1, positionOrder: 1 }]
      break
    case 'FREEZER':
      templates = buildFreezerTemplates(num)
      break
    case 'PREP_TABLE':
      templates = [{ code: `DECO_${num}`, name: `상시배치 재료대 ${num}`, type: 'DECO_ZONE', gridRows: 3, gridCols: 8, hasFloors: false, floorCount: 1, positionOrder: 1 }]
      break
    default:
      return { locations: [], codes: [] }
  }

  // 기존 코드 조회
  const allCodes = templates.map(t => t.code)
  const existing = await fetchStorageLocationsByCodes(storeId, allCodes)
  const existingMap = new Map(existing.map(loc => [loc.location_code, loc]))

  // 기존 location 템플릿 동기화 (grid_rows, grid_cols 등이 변경되었으면 UPDATE)
  const synced: StorageLocation[] = []
  for (const t of templates) {
    const loc = existingMap.get(t.code)
    if (!loc) continue
    const needsSync =
      loc.grid_rows !== t.gridRows ||
      loc.grid_cols !== t.gridCols ||
      loc.has_floors !== t.hasFloors ||
      loc.floor_count !== t.floorCount
    if (needsSync) {
      console.log(`[initStorage] 동기화: ${t.code} grid ${loc.grid_rows}x${loc.grid_cols} → ${t.gridRows}x${t.gridCols}`)
      const { data, error } = await supabase
        .from('storage_locations')
        .update({
          grid_rows: t.gridRows,
          grid_cols: t.gridCols,
          has_floors: t.hasFloors,
          floor_count: t.floorCount,
          location_name: t.name,
        })
        .eq('id', loc.id)
        .select()
        .single()
      if (error) throw new Error(`저장 공간 동기화 실패 (${t.code}): ${error.message}`)
      synced.push(data as StorageLocation)
    } else {
      console.log(`[initStorage] 동기화 불필요: ${t.code} (${loc.grid_rows}x${loc.grid_cols})`)
    }
  }

  // 새로 생성할 것만 필터
  const toCreate = templates.filter(t => !existingMap.has(t.code))

  const created: StorageLocation[] = []
  for (const t of toCreate) {
    console.log(`[initStorage] 생성: ${t.code} (${t.gridRows}x${t.gridCols})`)
    const { data, error } = await supabase
      .from('storage_locations')
      .insert({
        store_id: storeId,
        location_type: t.type,
        location_code: t.code,
        location_name: t.name,
        grid_rows: t.gridRows,
        grid_cols: t.gridCols,
        has_floors: t.hasFloors,
        floor_count: t.floorCount,
        position_order: t.positionOrder,
      })
      .select()
      .single()
    if (error) throw new Error(`저장 공간 생성 실패 (${t.code}): ${error.message}`)
    created.push(data as StorageLocation)
  }

  // synced된 location은 existing 목록 업데이트
  const syncedIds = new Set(synced.map(s => s.id))
  const updatedExisting = existing.map(loc => syncedIds.has(loc.id) ? (synced.find(s => s.id === loc.id) ?? loc) : loc)

  // FRIDGE_4BOX / FREEZER: 자식 FRIDGE_FLOOR 자동 생성 + 동기화
  const FLOOR_CONFIG: Record<string, { parentType: string; rows: number; cols: number }> = {
    'FRIDGE_4BOX': { parentType: 'FRIDGE', rows: 4, cols: 4 },
    'FREEZER': { parentType: 'FREEZER', rows: 4, cols: 4 },
  }
  const floorCfg = FLOOR_CONFIG[equipmentType]
  if (floorCfg) {
    const allParents = [
      ...updatedExisting.filter(l => l.location_type === floorCfg.parentType),
      ...created.filter(l => l.location_type === floorCfg.parentType),
    ]
    for (const parent of allParents) {
      for (let floor = 1; floor <= (parent.floor_count || 2); floor++) {
        const floorCode = `${parent.location_code}_F${floor}`
        const { data: existFloor } = await supabase
          .from('storage_locations')
          .select('*')
          .eq('store_id', storeId)
          .eq('location_code', floorCode)
          .maybeSingle()

        if (existFloor) {
          // 기존 floor 동기화 (grid 크기 변경 시)
          if (existFloor.grid_rows !== floorCfg.rows || existFloor.grid_cols !== floorCfg.cols) {
            console.log(`[initStorage] floor 동기화: ${floorCode} ${existFloor.grid_rows}x${existFloor.grid_cols} → ${floorCfg.rows}x${floorCfg.cols}`)
            const { data: syncedFloor, error: syncErr } = await supabase
              .from('storage_locations')
              .update({ grid_rows: floorCfg.rows, grid_cols: floorCfg.cols })
              .eq('id', existFloor.id)
              .select()
              .single()
            if (!syncErr && syncedFloor) created.push(syncedFloor as StorageLocation)
          } else {
            created.push(existFloor as StorageLocation)
          }
          continue
        }

        const { data: floorData, error: floorErr } = await supabase
          .from('storage_locations')
          .insert({
            store_id: storeId,
            location_type: 'FRIDGE_FLOOR',
            location_code: floorCode,
            location_name: `${parent.location_name} ${floor}층`,
            grid_rows: floorCfg.rows,
            grid_cols: floorCfg.cols,
            has_floors: false,
            floor_count: 1,
            parent_location_id: parent.id,
            position_order: floor,
          })
          .select()
          .single()
        if (floorErr) throw new Error(`층 생성 실패 (${floorCode}): ${floorErr.message}`)
        created.push(floorData as StorageLocation)
      }
    }
  }

  // 장비에 연결할 location_code 목록 (FRIDGE는 부모 코드만)
  const linkCodes = templates.map(t => t.code)
  const allLocations = [...updatedExisting, ...created]

  return { locations: allLocations, codes: linkCodes }
}

export async function deleteStorageLocation(id: string, _storeId?: string): Promise<void> {
  // 자식 FRIDGE_FLOOR 먼저 찾기
  const { data: children } = await supabase
    .from('storage_locations')
    .select('id')
    .eq('parent_location_id', id)

  const idsToDelete = [id, ...(children ?? []).map(c => c.id)]

  // 해당 location들의 재고 삭제
  for (const locId of idsToDelete) {
    await supabase.from('ingredients_inventory').delete().eq('storage_location_id', locId)
  }

  // 자식 → 부모 순으로 삭제
  if (children && children.length > 0) {
    for (const child of children) {
      const { error } = await supabase.from('storage_locations').delete().eq('id', child.id)
      if (error) throw new Error(`저장 공간 자식 삭제 실패: ${error.message}`)
    }
  }
  const { error } = await supabase.from('storage_locations').delete().eq('id', id)
  if (error) throw new Error(`저장 공간 삭제 실패: ${error.message}`)
}

// ==================== 재료 마스터 ====================

export async function fetchAllIngredientsMaster(): Promise<IngredientMaster[]> {
  const { data, error } = await supabase
    .from('ingredients_master')
    .select('*')
    .order('ingredient_name', { ascending: true })

  if (error) throw new Error(`재료 마스터 조회 실패: ${error.message}`)
  return (data ?? []) as IngredientMaster[]
}

export async function createIngredientMaster(
  input: Omit<IngredientMaster, 'id'>
): Promise<IngredientMaster> {
  const { data, error } = await supabase
    .from('ingredients_master')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`재료 등록 실패: ${error.message}`)
  return data as IngredientMaster
}

// ==================== 재고 ====================

export async function fetchInventoryByLocation(
  storeId: string,
  locationId: string
): Promise<IngredientInventory[]> {
  const { data, error } = await supabase
    .from('ingredients_inventory')
    .select('*, ingredient_master:ingredients_master(*)')
    .eq('store_id', storeId)
    .eq('storage_location_id', locationId)
    .order('display_order', { ascending: true })

  if (error) throw new Error(`재고 조회 실패: ${error.message}`)
  return (data ?? []) as IngredientInventory[]
}

export async function createInventoryItem(
  input: Omit<IngredientInventory, 'id' | 'ingredient_master' | 'storage_location'>
): Promise<IngredientInventory> {
  const { data, error } = await supabase
    .from('ingredients_inventory')
    .insert(input)
    .select('*, ingredient_master:ingredients_master(*)')
    .single()

  if (error) throw new Error(`재고 생성 실패: ${error.message}`)
  return data as IngredientInventory
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<IngredientInventory>
): Promise<IngredientInventory> {
  const { id: _id, ingredient_master, storage_location, ...safe } = updates as any
  const { data, error } = await supabase
    .from('ingredients_inventory')
    .update(safe)
    .eq('id', id)
    .select('*, ingredient_master:ingredients_master(*)')
    .single()

  if (error) throw new Error(`재고 수정 실패: ${error.message}`)
  return data as IngredientInventory
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('ingredients_inventory')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`재고 삭제 실패: ${error.message}`)
}

// ==================== 데코 재료 ====================

export async function fetchDecoIngredients(storeId: string): Promise<DecoIngredient[]> {
  const { data, error } = await supabase
    .from('deco_ingredients')
    .select('*, ingredient_master:ingredients_master(*)')
    .eq('store_id', storeId)
    .order('display_order', { ascending: true })

  if (error) throw new Error(`데코 재료 조회 실패: ${error.message}`)
  return (data ?? []) as DecoIngredient[]
}

export async function createDecoIngredient(
  input: Omit<DecoIngredient, 'id' | 'ingredient_master' | 'created_at'>
): Promise<DecoIngredient> {
  // UPSERT: UNIQUE(store_id, ingredient_master_id) 충돌 시 UPDATE
  const { data, error } = await supabase
    .from('deco_ingredients')
    .upsert(input, { onConflict: 'store_id,ingredient_master_id' })
    .select('*, ingredient_master:ingredients_master(*)')
    .single()

  if (error) throw new Error(`데코 재료 생성 실패: ${error.message}`)
  return data as DecoIngredient
}

export async function updateDecoIngredient(
  id: string,
  updates: Partial<DecoIngredient>
): Promise<DecoIngredient> {
  const { id: _id, ingredient_master, created_at, ...safe } = updates as any
  const { data, error } = await supabase
    .from('deco_ingredients')
    .update(safe)
    .eq('id', id)
    .select('*, ingredient_master:ingredients_master(*)')
    .single()

  if (error) throw new Error(`데코 재료 수정 실패: ${error.message}`)
  return data as DecoIngredient
}

export async function deleteDecoIngredient(id: string): Promise<void> {
  const { error } = await supabase
    .from('deco_ingredients')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`데코 재료 삭제 실패: ${error.message}`)
}

// ==================== 장비 연결 ====================

export async function updateEquipmentStorageLinks(
  equipmentId: string,
  locationCodes: string[]
): Promise<void> {
  await updateEquipment(equipmentId, { storage_location_ids: locationCodes } as any)
}

import { supabase } from '../lib/supabase'
import type { KitchenGrid, KitchenEquipment } from '../types/database.types'

/**
 * Kitchen Editor API
 * 주방 에디터에서 사용할 Supabase CRUD 함수 모음
 * 모든 함수는 에러 시 throw (호출 측에서 try/catch + toast)
 */

// ==================== 그리드 함수 ====================

/**
 * 매장의 주방 그리드를 조회
 */
export async function fetchKitchenGrid(storeId: string): Promise<KitchenGrid | null> {
  const { data, error } = await supabase
    .from('kitchen_grids')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - 활성 그리드 없음
      return null
    }
    throw new Error(`그리드 조회 실패: ${error.message}`)
  }

  return data
}

/**
 * 새 주방 그리드 생성
 */
export async function createKitchenGrid(
  storeId: string,
  cols: number,
  rows: number,
  name: string
): Promise<KitchenGrid> {
  const { data, error } = await supabase
    .from('kitchen_grids')
    .insert({
      store_id: storeId,
      grid_cols: cols,
      grid_rows: rows,
      grid_name: name,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`그리드 생성 실패: ${error.message}`)
  }

  return data
}

/**
 * 주방 그리드 업데이트
 */
export async function updateKitchenGrid(
  gridId: string,
  updates: Partial<Pick<KitchenGrid, 'grid_cols' | 'grid_rows' | 'grid_name'>>
): Promise<KitchenGrid> {
  const { data, error } = await supabase
    .from('kitchen_grids')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gridId)
    .select()
    .single()

  if (error) {
    throw new Error(`그리드 업데이트 실패: ${error.message}`)
  }

  return data
}

// ==================== 장비 함수 ====================

/**
 * 그리드의 모든 장비 조회
 */
export async function fetchKitchenEquipment(gridId: string): Promise<KitchenEquipment[]> {
  const { data, error } = await supabase
    .from('kitchen_equipment')
    .select('*')
    .eq('kitchen_grid_id', gridId)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    throw new Error(`장비 조회 실패: ${error.message}`)
  }

  return data ?? []
}

/**
 * 새 장비 생성
 */
export async function createEquipment(
  gridId: string,
  data: Omit<KitchenEquipment, 'id' | 'kitchen_grid_id' | 'created_at' | 'updated_at'>
): Promise<KitchenEquipment> {
  const { data: created, error } = await supabase
    .from('kitchen_equipment')
    .insert({
      ...data,
      kitchen_grid_id: gridId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`장비 생성 실패: ${error.message}`)
  }

  return created
}

/**
 * 장비 업데이트
 */
export async function updateEquipment(
  equipmentId: string,
  updates: Partial<KitchenEquipment>
): Promise<KitchenEquipment> {
  // id, kitchen_grid_id, created_at은 업데이트하지 않음
  const { id, kitchen_grid_id, created_at, ...safeUpdates } = updates as any

  const { data, error } = await supabase
    .from('kitchen_equipment')
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', equipmentId)
    .select()
    .single()

  if (error) {
    throw new Error(`장비 업데이트 실패: ${error.message}`)
  }

  return data
}

/**
 * 장비 삭제 (soft delete - is_active = false)
 */
export async function deleteEquipment(equipmentId: string): Promise<void> {
  const { error } = await supabase
    .from('kitchen_equipment')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', equipmentId)

  if (error) {
    throw new Error(`장비 삭제 실패: ${error.message}`)
  }
}

// ==================== 일괄 업데이트 함수 ====================

/**
 * 여러 장비의 위치를 일괄 업데이트 (DnD 용)
 */
export async function batchUpdatePositions(
  updates: Array<{
    id: string
    grid_x: number
    grid_y: number
    grid_w: number
    grid_h: number
  }>
): Promise<void> {
  const now = new Date().toISOString()

  const promises = updates.map((item) =>
    supabase
      .from('kitchen_equipment')
      .update({
        grid_x: item.grid_x,
        grid_y: item.grid_y,
        grid_w: item.grid_w,
        grid_h: item.grid_h,
        updated_at: now,
      })
      .eq('id', item.id)
  )

  const results = await Promise.all(promises)

  // 에러 체크
  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    const messages = errors.map((e) => e.error?.message).join(', ')
    throw new Error(`일괄 위치 업데이트 실패: ${messages}`)
  }
}

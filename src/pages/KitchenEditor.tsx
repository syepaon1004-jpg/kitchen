import { useState, useEffect, useMemo, useCallback } from 'react'
import { ReactGridLayout as GridLayout, type Layout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { supabase } from '../lib/supabase'
import type { Store, KitchenGrid, KitchenEquipment, EquipmentType } from '../types/database.types'
import {
  fetchKitchenGrid,
  fetchKitchenEquipment,
  createKitchenGrid,
  updateKitchenGrid,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  batchUpdatePositions,
} from '../api/kitchenEditorApi'

// 장비 타입 목록
const EQUIPMENT_TYPES: EquipmentType[] = [
  'BURNER',
  'SINK',
  'DRAWER_FRIDGE',
  'FRIDGE_4BOX',
  'SEASONING_COUNTER',
  'FRYER',
  'PREP_TABLE',
  'MICROWAVE',
  'PLATING_STATION',
  'CUTTING_BOARD',
  'TORCH',
  'COLD_TABLE',
  'WORKTABLE',
  'PASS',
  'GRILL',
]

// 장비 타입 아이콘
const EQUIPMENT_ICONS: Record<EquipmentType, string> = {
  BURNER: '🔥',
  SINK: '🚰',
  DRAWER_FRIDGE: '🗄️',
  FRIDGE_4BOX: '❄️',
  SEASONING_COUNTER: '🧂',
  FRYER: '🍳',
  PREP_TABLE: '🥬',
  MICROWAVE: '📦',
  PLATING_STATION: '🍽️',
  CUTTING_BOARD: '🔪',
  TORCH: '🔦',
  COLD_TABLE: '🧊',
  WORKTABLE: '🛠️',
  PASS: '📤',
  GRILL: '🥩',
}

// 장비 타입별 색상
function getEquipmentColor(type: EquipmentType): string {
  const colors: Record<EquipmentType, string> = {
    BURNER: '#ef4444',        // red-500
    SINK: '#06b6d4',          // cyan-500
    DRAWER_FRIDGE: '#3b82f6', // blue-500
    FRIDGE_4BOX: '#6366f1',   // indigo-500
    SEASONING_COUNTER: '#f59e0b', // amber-500
    FRYER: '#f97316',         // orange-500
    PREP_TABLE: '#22c55e',    // green-500
    MICROWAVE: '#8b5cf6',     // violet-500
    PLATING_STATION: '#ec4899', // pink-500
    CUTTING_BOARD: '#84cc16', // lime-500
    TORCH: '#eab308',         // yellow-500
    COLD_TABLE: '#0ea5e9',    // sky-500
    WORKTABLE: '#64748b',     // slate-500
    PASS: '#14b8a6',          // teal-500
    GRILL: '#dc2626',         // red-600
  }
  return colors[type] || '#6b7280' // gray-500 fallback
}

// 빈 장비 생성
function createEmptyEquipment(gridId: string, order: number): Partial<KitchenEquipment> {
  return {
    kitchen_grid_id: gridId,
    equipment_type: 'BURNER',
    equipment_key: `equipment_${Date.now()}`,
    display_name: '새 장비',
    grid_x: 0,
    grid_y: 0,
    grid_w: 1,
    grid_h: 1,
    display_order: order,
    is_active: true,
    equipment_config: {},
    storage_location_ids: [],
  }
}

// 겹침 감지 함수
function checkOverlap(
  eq1: Partial<KitchenEquipment>,
  eq2: Partial<KitchenEquipment>
): boolean {
  if (!eq1.grid_x || !eq1.grid_y || !eq1.grid_w || !eq1.grid_h) return false
  if (!eq2.grid_x || !eq2.grid_y || !eq2.grid_w || !eq2.grid_h) return false

  const x1Start = eq1.grid_x
  const x1End = eq1.grid_x + eq1.grid_w
  const y1Start = eq1.grid_y
  const y1End = eq1.grid_y + eq1.grid_h

  const x2Start = eq2.grid_x
  const x2End = eq2.grid_x + eq2.grid_w
  const y2Start = eq2.grid_y
  const y2End = eq2.grid_y + eq2.grid_h

  return x1Start < x2End && x1End > x2Start && y1Start < y2End && y1End > y2Start
}

export default function KitchenEditor() {
  // 매장 목록
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)

  // 그리드 상태
  const [grid, setGrid] = useState<KitchenGrid | null>(null)
  const [localGrid, setLocalGrid] = useState<Partial<KitchenGrid>>({
    grid_name: '',
    grid_cols: 6,
    grid_rows: 4,
  })

  // 장비 상태
  const [equipment, setEquipment] = useState<KitchenEquipment[]>([])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [editingEquipment, setEditingEquipment] = useState<Partial<KitchenEquipment> | null>(null)

  // UI 상태
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [hasUnsavedPositions, setHasUnsavedPositions] = useState(false)

  // 매장 목록 로드
  useEffect(() => {
    async function loadStores() {
      const { data, error } = await supabase.from('stores').select('*').order('store_name')
      if (!error && data) {
        setStores(data)
      }
    }
    loadStores()
  }, [])

  // 매장 선택 시 그리드/장비 로드
  useEffect(() => {
    if (!selectedStoreId) {
      setGrid(null)
      setLocalGrid({ grid_name: '', grid_cols: 6, grid_rows: 4 })
      setEquipment([])
      setSelectedEquipmentId(null)
      setEditingEquipment(null)
      return
    }

    const storeId = selectedStoreId // Capture for async function
    async function loadGridAndEquipment() {
      setLoading(true)
      try {
        const gridData = await fetchKitchenGrid(storeId)
        if (gridData) {
          setGrid(gridData)
          setLocalGrid({
            grid_name: gridData.grid_name,
            grid_cols: gridData.grid_cols,
            grid_rows: gridData.grid_rows,
          })
          const eqData = await fetchKitchenEquipment(gridData.id)
          setEquipment(eqData)
        } else {
          setGrid(null)
          setLocalGrid({ grid_name: `${selectedStoreId} 주방`, grid_cols: 6, grid_rows: 4 })
          setEquipment([])
        }
      } catch (err: any) {
        showToast(err.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    loadGridAndEquipment()
  }, [selectedStoreId])

  // 토스트 표시
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 그리드 저장
  const handleSaveGrid = async () => {
    if (!selectedStoreId) return

    setLoading(true)
    try {
      if (grid) {
        // 기존 그리드 업데이트
        const updated = await updateKitchenGrid(grid.id, {
          grid_name: localGrid.grid_name,
          grid_cols: localGrid.grid_cols,
          grid_rows: localGrid.grid_rows,
        })
        setGrid(updated)
        showToast('그리드 설정이 저장되었습니다.', 'success')
      } else {
        // 새 그리드 생성
        const created = await createKitchenGrid(
          selectedStoreId,
          localGrid.grid_cols ?? 6,
          localGrid.grid_rows ?? 4,
          localGrid.grid_name ?? '새 주방'
        )
        setGrid(created)
        showToast('새 그리드가 생성되었습니다.', 'success')
      }
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // 장비 추가
  const handleAddEquipment = () => {
    if (!grid) {
      showToast('먼저 그리드를 저장하세요.', 'error')
      return
    }
    const newEq = createEmptyEquipment(grid.id, equipment.length + 1)
    setEditingEquipment(newEq)
    setSelectedEquipmentId(null)
    setIsCreatingNew(true)
  }

  // 장비 선택
  const handleSelectEquipment = (eq: KitchenEquipment) => {
    setSelectedEquipmentId(eq.id)
    setEditingEquipment({ ...eq })
    setIsCreatingNew(false)
  }

  // 장비 저장
  const handleSaveEquipment = async () => {
    if (!editingEquipment || !grid) return

    setLoading(true)
    try {
      if (isCreatingNew) {
        // 새 장비 생성
        const { kitchen_grid_id, ...data } = editingEquipment
        const created = await createEquipment(grid.id, data as any)
        setEquipment([...equipment, created])
        setSelectedEquipmentId(created.id)
        setEditingEquipment({ ...created })
        setIsCreatingNew(false)
        showToast('장비가 추가되었습니다.', 'success')
      } else if (selectedEquipmentId) {
        // 기존 장비 업데이트
        const updated = await updateEquipment(selectedEquipmentId, editingEquipment)
        setEquipment(equipment.map((e) => (e.id === selectedEquipmentId ? updated : e)))
        setEditingEquipment({ ...updated })
        showToast('장비가 수정되었습니다.', 'success')
      }
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // 장비 삭제
  const handleDeleteEquipment = async () => {
    if (!selectedEquipmentId) return
    if (!confirm('이 장비를 삭제하시겠습니까?')) return

    setLoading(true)
    try {
      await deleteEquipment(selectedEquipmentId)
      setEquipment(equipment.filter((e) => e.id !== selectedEquipmentId))
      setSelectedEquipmentId(null)
      setEditingEquipment(null)
      showToast('장비가 삭제되었습니다.', 'success')
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // DnD 레이아웃 변경 핸들러 (로컬 상태만 업데이트)
  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      // 위치가 실제로 변경된 경우에만 업데이트
      let changed = false
      const updatedEquipment = equipment.map((eq) => {
        const layoutItem = layout.find((l) => l.i === eq.id)
        if (!layoutItem) return eq

        if (
          eq.grid_x !== layoutItem.x ||
          eq.grid_y !== layoutItem.y ||
          eq.grid_w !== layoutItem.w ||
          eq.grid_h !== layoutItem.h
        ) {
          changed = true
          return {
            ...eq,
            grid_x: layoutItem.x,
            grid_y: layoutItem.y,
            grid_w: layoutItem.w,
            grid_h: layoutItem.h,
          }
        }
        return eq
      })

      if (changed) {
        setEquipment(updatedEquipment)
        setHasUnsavedPositions(true)

        // 선택된 장비의 편집 상태도 업데이트
        if (editingEquipment && selectedEquipmentId) {
          const updated = updatedEquipment.find((e) => e.id === selectedEquipmentId)
          if (updated) {
            setEditingEquipment({
              ...editingEquipment,
              grid_x: updated.grid_x,
              grid_y: updated.grid_y,
              grid_w: updated.grid_w,
              grid_h: updated.grid_h,
            })
          }
        }
      }
    },
    [equipment, editingEquipment, selectedEquipmentId]
  )

  // 위치 일괄 저장
  const handleSavePositions = async () => {
    if (!hasUnsavedPositions || equipment.length === 0) return

    setLoading(true)
    try {
      await batchUpdatePositions(
        equipment.map((eq) => ({
          id: eq.id,
          grid_x: eq.grid_x,
          grid_y: eq.grid_y,
          grid_w: eq.grid_w,
          grid_h: eq.grid_h,
        }))
      )
      setHasUnsavedPositions(false)
      showToast('위치가 저장되었습니다.', 'success')
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // 팔레트에서 장비 타입 클릭 시 빈 자리에 자동 배치
  const handlePaletteClick = (type: EquipmentType) => {
    if (!grid) {
      showToast('먼저 그리드를 저장하세요.', 'error')
      return
    }

    // 기본 크기 설정
    const defaultSizes: Record<EquipmentType, { w: number; h: number }> = {
      BURNER: { w: 1, h: 1 },
      SINK: { w: 2, h: 1 },
      DRAWER_FRIDGE: { w: 2, h: 2 },
      FRIDGE_4BOX: { w: 2, h: 2 },
      SEASONING_COUNTER: { w: 2, h: 1 },
      FRYER: { w: 1, h: 1 },
      PREP_TABLE: { w: 2, h: 1 },
      MICROWAVE: { w: 1, h: 1 },
      PLATING_STATION: { w: 2, h: 1 },
      CUTTING_BOARD: { w: 1, h: 1 },
      TORCH: { w: 1, h: 1 },
      COLD_TABLE: { w: 2, h: 1 },
      WORKTABLE: { w: 2, h: 1 },
      PASS: { w: 2, h: 1 },
      GRILL: { w: 1, h: 1 },
    }

    const size = defaultSizes[type] || { w: 1, h: 1 }

    // 빈 자리 찾기
    const occupied = new Set<string>()
    equipment.forEach((eq) => {
      for (let dx = 0; dx < eq.grid_w; dx++) {
        for (let dy = 0; dy < eq.grid_h; dy++) {
          occupied.add(`${eq.grid_x + dx},${eq.grid_y + dy}`)
        }
      }
    })

    let foundPos: { x: number; y: number } | null = null
    outer: for (let y = 0; y < (localGrid.grid_rows ?? 4); y++) {
      for (let x = 0; x < (localGrid.grid_cols ?? 6); x++) {
        // 이 위치에 배치 가능한지 확인
        let canPlace = true
        for (let dx = 0; dx < size.w && canPlace; dx++) {
          for (let dy = 0; dy < size.h && canPlace; dy++) {
            const checkX = x + dx
            const checkY = y + dy
            if (
              checkX >= (localGrid.grid_cols ?? 6) ||
              checkY >= (localGrid.grid_rows ?? 4) ||
              occupied.has(`${checkX},${checkY}`)
            ) {
              canPlace = false
            }
          }
        }
        if (canPlace) {
          foundPos = { x, y }
          break outer
        }
      }
    }

    if (!foundPos) {
      showToast('배치할 공간이 없습니다.', 'error')
      return
    }

    const newEq: Partial<KitchenEquipment> = {
      kitchen_grid_id: grid.id,
      equipment_type: type,
      equipment_key: `${type.toLowerCase()}_${Date.now()}`,
      display_name: `새 ${type}`,
      grid_x: foundPos.x,
      grid_y: foundPos.y,
      grid_w: size.w,
      grid_h: size.h,
      display_order: equipment.length + 1,
      is_active: true,
      equipment_config: {},
      storage_location_ids: [],
    }

    setEditingEquipment(newEq)
    setSelectedEquipmentId(null)
    setIsCreatingNew(true)
  }

  // 겹침 감지된 장비 ID 목록
  const overlappingIds = useMemo(() => {
    const ids = new Set<string>()
    for (let i = 0; i < equipment.length; i++) {
      for (let j = i + 1; j < equipment.length; j++) {
        if (checkOverlap(equipment[i], equipment[j])) {
          ids.add(equipment[i].id)
          ids.add(equipment[j].id)
        }
      }
    }
    return ids
  }, [equipment])

  // 미리보기용 장비 목록 (편집 중인 장비 반영)
  const previewEquipment = useMemo(() => {
    if (!editingEquipment) return equipment

    if (isCreatingNew) {
      // 새 장비 추가된 상태로 미리보기
      return [...equipment, editingEquipment as KitchenEquipment]
    } else if (selectedEquipmentId) {
      // 편집 중인 장비 반영
      return equipment.map((e) =>
        e.id === selectedEquipmentId ? { ...e, ...editingEquipment } : e
      )
    }
    return equipment
  }, [equipment, editingEquipment, selectedEquipmentId, isCreatingNew])

  // 미리보기용 그리드
  const previewGrid: KitchenGrid | null = grid
    ? { ...grid, ...localGrid }
    : localGrid.grid_cols && localGrid.grid_rows
    ? {
        id: 'preview',
        store_id: selectedStoreId ?? '',
        grid_cols: localGrid.grid_cols,
        grid_rows: localGrid.grid_rows,
        grid_name: localGrid.grid_name ?? '',
        is_active: true,
        created_at: '',
        updated_at: '',
      }
    : null

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white font-bold ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-800 mb-4">🔧 주방 에디터</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 좌측: 편집 패널 */}
        <div className="space-y-4">
          {/* 매장 선택 */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-gray-700 mb-2">매장 선택</h2>
            <select
              value={selectedStoreId ?? ''}
              onChange={(e) => setSelectedStoreId(e.target.value || null)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">-- 매장 선택 --</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.store_name}
                </option>
              ))}
            </select>
          </div>

          {/* 그리드 설정 */}
          {selectedStoreId && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold text-gray-700 mb-2">그리드 설정</h2>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-gray-600">이름</label>
                  <input
                    type="text"
                    value={localGrid.grid_name ?? ''}
                    onChange={(e) => setLocalGrid({ ...localGrid, grid_name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="주방 이름"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-600">열 수 (4-24)</label>
                    <input
                      type="number"
                      min={4}
                      max={24}
                      value={localGrid.grid_cols ?? 6}
                      onChange={(e) =>
                        setLocalGrid({ ...localGrid, grid_cols: parseInt(e.target.value) || 6 })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">행 수 (2-12)</label>
                    <input
                      type="number"
                      min={2}
                      max={12}
                      value={localGrid.grid_rows ?? 4}
                      onChange={(e) =>
                        setLocalGrid({ ...localGrid, grid_rows: parseInt(e.target.value) || 4 })
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveGrid}
                  disabled={loading}
                  className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {grid ? '그리드 저장' : '그리드 생성'}
                </button>
              </div>
            </div>
          )}

          {/* 장비 팔레트 */}
          {grid && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold text-gray-700 mb-2">장비 팔레트</h2>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => handlePaletteClick(type)}
                    className="px-2 py-1 bg-gray-100 hover:bg-blue-100 rounded text-sm border border-gray-200 hover:border-blue-300 transition flex items-center gap-1"
                    title={`${type} 추가`}
                  >
                    <span>{EQUIPMENT_ICONS[type]}</span>
                    <span className="text-xs text-gray-600">{type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 장비 목록 */}
          {grid && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-gray-700">장비 목록</h2>
                <button
                  onClick={handleAddEquipment}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  + 추가
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {equipment.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-4">장비가 없습니다.</div>
                ) : (
                  equipment.map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => handleSelectEquipment(eq)}
                      className={`w-full text-left px-3 py-2 rounded border flex items-center gap-2 transition ${
                        selectedEquipmentId === eq.id
                          ? 'border-blue-500 bg-blue-50'
                          : overlappingIds.has(eq.id)
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{EQUIPMENT_ICONS[eq.equipment_type]}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{eq.display_name}</div>
                        <div className="text-xs text-gray-400">
                          ({eq.grid_x}, {eq.grid_y}) {eq.grid_w}×{eq.grid_h}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 장비 편집 폼 */}
          {editingEquipment && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold text-gray-700 mb-2">
                {isCreatingNew ? '새 장비 추가' : '장비 편집'}
              </h2>
              <div className="space-y-3">
                {/* 기본 정보 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-600">타입</label>
                    <select
                      value={editingEquipment.equipment_type ?? 'BURNER'}
                      onChange={(e) =>
                        setEditingEquipment({
                          ...editingEquipment,
                          equipment_type: e.target.value as EquipmentType,
                        })
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                    >
                      {EQUIPMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {EQUIPMENT_ICONS[t]} {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">키</label>
                    <input
                      type="text"
                      value={editingEquipment.equipment_key ?? ''}
                      onChange={(e) =>
                        setEditingEquipment({ ...editingEquipment, equipment_key: e.target.value })
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                      placeholder="equipment_key"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600">표시 이름</label>
                  <input
                    type="text"
                    value={editingEquipment.display_name ?? ''}
                    onChange={(e) =>
                      setEditingEquipment({ ...editingEquipment, display_name: e.target.value })
                    }
                    className="w-full border rounded px-2 py-1 text-sm"
                    placeholder="화구1"
                  />
                </div>

                {/* 위치/크기 */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600">X</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEquipment.grid_x ?? 0}
                      onChange={(e) =>
                        setEditingEquipment({
                          ...editingEquipment,
                          grid_x: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Y</label>
                    <input
                      type="number"
                      min={0}
                      value={editingEquipment.grid_y ?? 0}
                      onChange={(e) =>
                        setEditingEquipment({
                          ...editingEquipment,
                          grid_y: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">너비</label>
                    <input
                      type="number"
                      min={1}
                      value={editingEquipment.grid_w ?? 1}
                      onChange={(e) =>
                        setEditingEquipment({
                          ...editingEquipment,
                          grid_w: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">높이</label>
                    <input
                      type="number"
                      min={1}
                      value={editingEquipment.grid_h ?? 1}
                      onChange={(e) =>
                        setEditingEquipment({
                          ...editingEquipment,
                          grid_h: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600">표시 순서</label>
                  <input
                    type="number"
                    min={1}
                    value={editingEquipment.display_order ?? 1}
                    onChange={(e) =>
                      setEditingEquipment({
                        ...editingEquipment,
                        display_order: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>

                {/* 타입별 동적 config */}
                <EquipmentConfigForm
                  type={editingEquipment.equipment_type ?? 'BURNER'}
                  config={(editingEquipment.equipment_config ?? {}) as Record<string, any>}
                  onChange={(config) =>
                    setEditingEquipment({ ...editingEquipment, equipment_config: config })
                  }
                />

                {/* storage_location_ids (태그 입력) */}
                {['DRAWER_FRIDGE', 'FRIDGE_4BOX'].includes(
                  editingEquipment.equipment_type ?? ''
                ) && (
                  <div>
                    <label className="block text-sm text-gray-600">Storage Location IDs</label>
                    <input
                      type="text"
                      value={(editingEquipment.storage_location_ids ?? []).join(', ')}
                      onChange={(e) =>
                        setEditingEquipment({
                          ...editingEquipment,
                          storage_location_ids: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                      placeholder="DRAWER_LT, DRAWER_RT, DRAWER_LB, DRAWER_RB"
                    />
                    <div className="text-xs text-gray-400 mt-1">콤마로 구분</div>
                  </div>
                )}

                {/* 버튼들 */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEquipment}
                    disabled={loading}
                    className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
                  >
                    저장
                  </button>
                  {!isCreatingNew && (
                    <button
                      onClick={handleDeleteEquipment}
                      disabled={loading}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-sm"
                    >
                      삭제
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingEquipment(null)
                      setSelectedEquipmentId(null)
                      setIsCreatingNew(false)
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 우측: DnD 미리보기 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-gray-700">미리보기 (드래그로 배치)</h2>
            {hasUnsavedPositions && (
              <button
                onClick={handleSavePositions}
                disabled={loading}
                className="px-4 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 disabled:opacity-50 font-bold animate-pulse"
              >
                위치 저장
              </button>
            )}
          </div>
          {previewGrid ? (
            <div className="border rounded-lg overflow-hidden bg-gray-800 p-2">
              <GridLayout
                layout={previewEquipment.map((eq) => ({
                  i: eq.id || `new_${eq.equipment_key}`,
                  x: eq.grid_x,
                  y: eq.grid_y,
                  w: eq.grid_w,
                  h: eq.grid_h,
                }))}
                cols={previewGrid.grid_cols}
                rowHeight={60}
                width={(previewGrid.grid_cols * 60) + ((previewGrid.grid_cols - 1) * 10) + 20}
                compactType={null}
                preventCollision={true}
                onLayoutChange={handleLayoutChange}
                isDraggable={!isCreatingNew}
                isResizable={!isCreatingNew}
                margin={[10, 10]}
              >
                {previewEquipment.map((eq) => (
                  <div
                    key={eq.id || `new_${eq.equipment_key}`}
                    onClick={() => {
                      if (!isCreatingNew && eq.id) {
                        handleSelectEquipment(eq as KitchenEquipment)
                      }
                    }}
                    className={`rounded-lg cursor-pointer transition-all flex flex-col items-center justify-center text-center p-1 ${
                      selectedEquipmentId === eq.id
                        ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800'
                        : ''
                    } ${
                      overlappingIds.has(eq.id)
                        ? 'ring-2 ring-red-500'
                        : ''
                    } ${
                      isCreatingNew && !eq.id
                        ? 'ring-2 ring-green-400 animate-pulse'
                        : ''
                    }`}
                    style={{
                      backgroundColor: getEquipmentColor(eq.equipment_type),
                    }}
                  >
                    <span className="text-2xl">{EQUIPMENT_ICONS[eq.equipment_type]}</span>
                    <span className="text-xs text-white font-bold truncate w-full">
                      {eq.display_name}
                    </span>
                  </div>
                ))}
              </GridLayout>
            </div>
          ) : (
            <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-400">
              매장을 선택하세요
            </div>
          )}
          {overlappingIds.size > 0 && (
            <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
              ⚠️ 겹치는 장비가 있습니다!
            </div>
          )}
          {hasUnsavedPositions && (
            <div className="mt-2 p-2 bg-orange-100 text-orange-700 rounded text-sm">
              💾 저장되지 않은 위치 변경이 있습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 타입별 동적 config 폼
function EquipmentConfigForm({
  type,
  config,
  onChange,
}: {
  type: EquipmentType
  config: Record<string, any>
  onChange: (config: Record<string, any>) => void
}) {
  const update = (key: string, value: any) => {
    onChange({ ...config, [key]: value })
  }

  switch (type) {
    case 'BURNER':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">BURNER 설정</div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.has_wok ?? true}
              onChange={(e) => update('has_wok', e.target.checked)}
            />
            <label className="text-sm">웍 포함</label>
          </div>
          <div>
            <label className="block text-xs text-gray-600">최대 온도</label>
            <input
              type="number"
              value={config.max_temp ?? 500}
              onChange={(e) => update('max_temp', parseInt(e.target.value) || 500)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      )

    case 'SINK':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">SINK 설정</div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.can_wash_wok ?? true}
              onChange={(e) => update('can_wash_wok', e.target.checked)}
            />
            <label className="text-sm">웍 세척 가능</label>
          </div>
        </div>
      )

    case 'DRAWER_FRIDGE':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">DRAWER_FRIDGE 설정</div>
          <div>
            <label className="block text-xs text-gray-600">서랍 배치 (예: 2x2)</label>
            <input
              type="text"
              value={config.drawer_layout ?? '2x2'}
              onChange={(e) => update('drawer_layout', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="2x2"
            />
          </div>
        </div>
      )

    case 'FRIDGE_4BOX':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">FRIDGE_4BOX 설정</div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.has_floor_2 ?? true}
              onChange={(e) => update('has_floor_2', e.target.checked)}
            />
            <label className="text-sm">2층 있음</label>
          </div>
        </div>
      )

    case 'FRYER':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">FRYER 설정</div>
          <div>
            <label className="block text-xs text-gray-600">최대 온도</label>
            <input
              type="number"
              value={config.max_temp ?? 180}
              onChange={(e) => update('max_temp', parseInt(e.target.value) || 180)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">오일 타입</label>
            <input
              type="text"
              value={config.oil_type ?? '식용유'}
              onChange={(e) => update('oil_type', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      )

    case 'SEASONING_COUNTER':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">SEASONING_COUNTER 설정</div>
          <div>
            <label className="block text-xs text-gray-600">위치</label>
            <select
              value={config.position ?? 'standalone'}
              onChange={(e) => update('position', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="standalone">독립형</option>
              <option value="on_prep_table">조리대 위</option>
            </select>
          </div>
        </div>
      )

    case 'PREP_TABLE':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">PREP_TABLE 설정</div>
          <div>
            <label className="block text-xs text-gray-600">슬롯 수</label>
            <input
              type="number"
              value={config.slots ?? 4}
              onChange={(e) => update('slots', parseInt(e.target.value) || 4)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.is_deco_zone ?? false}
              onChange={(e) => update('is_deco_zone', e.target.checked)}
            />
            <label className="text-sm">데코 존</label>
          </div>
        </div>
      )

    case 'MICROWAVE':
      return (
        <div className="space-y-2 p-2 bg-gray-50 rounded">
          <div className="text-xs font-bold text-gray-500">MICROWAVE 설정</div>
          <div>
            <label className="block text-xs text-gray-600">모드 (콤마 구분)</label>
            <input
              type="text"
              value={(config.modes ?? ['해동', '가열']).join(', ')}
              onChange={(e) =>
                update(
                  'modes',
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="해동, 가열"
            />
          </div>
        </div>
      )

    default:
      return (
        <div className="p-2 bg-gray-50 rounded text-xs text-gray-400">
          이 장비 타입에 대한 추가 설정이 없습니다.
        </div>
      )
  }
}

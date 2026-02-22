import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useGameStore } from '../../stores/gameStore'
import type { Store, KitchenGrid, KitchenEquipment, EquipmentType } from '../../types/database.types'
import {
  fetchKitchenGrid,
  fetchKitchenEquipment,
  createKitchenGrid,
  updateKitchenGrid,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from '../../api/kitchenEditorApi'
import EquipmentStorageModal, { STORABLE_TYPES } from '../../components/admin/EquipmentStorageModal'

// ==================== 상수 ====================

// 팔레트에 표시할 장비 (시뮬레이터 컴포넌트가 구현된 것만)
const PALETTE_TYPES: EquipmentType[] = [
  'BURNER',
  'SINK',
  'DRAWER_FRIDGE',
  'FRIDGE_4BOX',
  'SEASONING_COUNTER',
  'FRYER',
  'PREP_TABLE',
  'MICROWAVE',
  'FREEZER',
]

const EQUIPMENT_ICONS: Record<string, string> = {
  BURNER: '🔥',
  SINK: '🚰',
  DRAWER_FRIDGE: '🗄️',
  FRIDGE_4BOX: '❄️',
  SEASONING_COUNTER: '🧂',
  FRYER: '🍳',
  PREP_TABLE: '🥬',
  MICROWAVE: '📦',
  FREEZER: '🧊',
  PLATING_STATION: '🍽️',
  CUTTING_BOARD: '🔪',
  TORCH: '🔦',
  COLD_TABLE: '🧊',
  WORKTABLE: '🛠️',
  PASS: '📤',
  GRILL: '🥩',
}

const EQUIPMENT_LABELS: Record<string, string> = {
  BURNER: '버너',
  SINK: '싱크대',
  DRAWER_FRIDGE: '서랍냉장고',
  FRIDGE_4BOX: '4칸냉장고',
  SEASONING_COUNTER: '양념카운터',
  FRYER: '튀김기',
  PREP_TABLE: '작업대(데코존)',
  MICROWAVE: '전자레인지',
  FREEZER: '냉동고',
  PLATING_STATION: '플레이팅',
  CUTTING_BOARD: '도마',
  TORCH: '토치',
  COLD_TABLE: '냉장테이블',
  WORKTABLE: '작업대',
  PASS: '패스',
  GRILL: '그릴',
}

function getEquipmentColor(type: string): string {
  const colors: Record<string, string> = {
    BURNER: '#ef4444',
    SINK: '#06b6d4',
    DRAWER_FRIDGE: '#3b82f6',
    FRIDGE_4BOX: '#6366f1',
    SEASONING_COUNTER: '#f59e0b',
    FRYER: '#f97316',
    PREP_TABLE: '#22c55e',
    MICROWAVE: '#8b5cf6',
    FREEZER: '#1e40af',
    PLATING_STATION: '#ec4899',
    CUTTING_BOARD: '#84cc16',
    TORCH: '#eab308',
    COLD_TABLE: '#0ea5e9',
    WORKTABLE: '#64748b',
    PASS: '#14b8a6',
    GRILL: '#dc2626',
  }
  return colors[type] || '#6b7280'
}

const EQUIPMENT_DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  BURNER: { w: 2, h: 2 },
  SINK: { w: 2, h: 3 },
  DRAWER_FRIDGE: { w: 4, h: 2 },
  FRIDGE_4BOX: { w: 2, h: 4 },
  SEASONING_COUNTER: { w: 2, h: 4 },
  PLATING_STATION: { w: 3, h: 2 },
  CUTTING_BOARD: { w: 2, h: 2 },
  MICROWAVE: { w: 2, h: 2 },
  TORCH: { w: 1, h: 1 },
  COLD_TABLE: { w: 3, h: 2 },
  PREP_TABLE: { w: 3, h: 2 },
  FRYER: { w: 3, h: 2 },
  WORKTABLE: { w: 3, h: 2 },
  FREEZER: { w: 2, h: 3 },
  PASS: { w: 2, h: 1 },
  GRILL: { w: 2, h: 2 },
}

const CELL_SIZE = 56

// ==================== 로컬 장비 타입 (임시 id 포함) ====================

interface LocalEquipment {
  localId: string          // 로컬 임시 ID (crypto.randomUUID)
  dbId: string | null      // DB UUID (새 장비는 null)
  equipment_type: EquipmentType
  equipment_key: string
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
  equipment_config: Record<string, unknown>
  storage_location_ids: string[]
  display_name: string
  display_order: number
  is_active: boolean
}

function fromDb(eq: KitchenEquipment): LocalEquipment {
  return {
    localId: crypto.randomUUID(),
    dbId: eq.id,
    equipment_type: eq.equipment_type,
    equipment_key: eq.equipment_key,
    grid_x: eq.grid_x,
    grid_y: eq.grid_y,
    grid_w: eq.grid_w,
    grid_h: eq.grid_h,
    equipment_config: eq.equipment_config ?? {},
    storage_location_ids: eq.storage_location_ids ?? [],
    display_name: eq.display_name ?? '',
    display_order: eq.display_order ?? 0,
    is_active: eq.is_active ?? true,
  }
}

// ==================== DnD 컴포넌트 ====================

function PaletteItem({ type }: { type: EquipmentType }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, isNew: true },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[#E0E0E0] cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition text-sm"
    >
      <span>{EQUIPMENT_ICONS[type] || '📦'}</span>
      <span className="font-medium text-[#333]">{EQUIPMENT_LABELS[type] || type}</span>
      <span className="text-xs text-[#9E9E9E] ml-auto">
        {EQUIPMENT_DEFAULT_SIZE[type]?.w}×{EQUIPMENT_DEFAULT_SIZE[type]?.h}
      </span>
    </div>
  )
}

function GridCell({ col, row }: { col: number; row: number }) {
  const cellId = `cell-${col}-${row}`
  const { setNodeRef } = useDroppable({ id: cellId, data: { col, row } })

  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn: col + 1, gridRow: row + 1 }}
      className="border border-dashed border-[#E0E0E0] bg-white/50"
    />
  )
}

function PlacedEquipment({
  eq,
  isSelected,
  onClick,
}: {
  eq: LocalEquipment
  isSelected: boolean
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `eq-${eq.localId}`,
    data: { type: eq.equipment_type, isNew: false, localId: eq.localId },
  })

  const area = eq.grid_w * eq.grid_h
  // 면적이 작을수록 z-index 높게 (겹침 시 작은 장비가 위로)
  const zIndex = isDragging ? 100 : Math.max(1, 50 - area)

  const style: React.CSSProperties = {
    gridColumn: `${eq.grid_x + 1} / span ${eq.grid_w}`,
    gridRow: `${eq.grid_y + 1} / span ${eq.grid_h}`,
    backgroundColor: getEquipmentColor(eq.equipment_type) + '33',
    borderColor: isSelected ? '#333' : getEquipmentColor(eq.equipment_type),
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`border-2 rounded-md flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none transition-shadow ${
        isSelected ? 'ring-2 ring-offset-1 ring-[#333] shadow-lg' : 'hover:shadow-md'
      }`}
    >
      <span className="text-lg leading-none">{EQUIPMENT_ICONS[eq.equipment_type] || '📦'}</span>
      <span className="text-[10px] font-bold text-[#333] mt-0.5 text-center px-1 truncate w-full">
        {eq.display_name || EQUIPMENT_LABELS[eq.equipment_type] || eq.equipment_type}
      </span>
    </div>
  )
}

// ==================== 메인 컴포넌트 ====================

export default function KitchenLayoutEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentStore = useGameStore((s) => s.currentStore)
  const setStore = useGameStore((s) => s.setStore)

  // 매장 결정
  const storeFromState = (location.state as { store?: Store })?.store
  useEffect(() => {
    if (storeFromState && !currentStore) {
      setStore(storeFromState)
    }
  }, [storeFromState, currentStore, setStore])

  const store = currentStore ?? storeFromState
  useEffect(() => {
    if (!store) navigate('/', { replace: true })
  }, [store, navigate])

  // 그리드 상태
  const [grid, setGrid] = useState<KitchenGrid | null>(null)
  const [gridRows, setGridRows] = useState(8)
  const [gridCols, setGridCols] = useState(12)
  const [gridName, setGridName] = useState('기본 주방')

  // 장비 상태
  const [equipment, setEquipment] = useState<LocalEquipment[]>([])
  const [dbEquipmentIds, setDbEquipmentIds] = useState<Set<string>>(new Set()) // 저장 시 비교용
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // UI 상태
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [storageModalEquipment, setStorageModalEquipment] = useState<LocalEquipment | null>(null)
  const [activeDragType, setActiveDragType] = useState<EquipmentType | null>(null)
  const [activeDragSize, setActiveDragSize] = useState<{ w: number; h: number } | null>(null)
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null)
  const [gridSizeWarning, setGridSizeWarning] = useState<string | null>(null)

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // DnD 센서
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ==================== 데이터 로드 ====================

  useEffect(() => {
    if (!store) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const g = await fetchKitchenGrid(store!.id)
        if (cancelled) return

        if (g) {
          setGrid(g)
          setGridRows(g.grid_rows)
          setGridCols(g.grid_cols)
          setGridName(g.grid_name)

          const eqs = await fetchKitchenEquipment(g.id)
          if (cancelled) return

          const locals = eqs.map(fromDb)
          setEquipment(locals)
          setDbEquipmentIds(new Set(eqs.map((e) => e.id)))
        }
      } catch (err: any) {
        showToast(err.message, 'error')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [store, showToast])

  // ==================== 그리드 크기 변경 + 경고 ====================

  const handleGridRowsChange = (val: number) => {
    const outOfBounds = equipment.filter((eq) => eq.grid_y + eq.grid_h > val)
    if (outOfBounds.length > 0) {
      setGridSizeWarning(
        `${outOfBounds.length}개 장비가 범위 밖에 있습니다. 저장 전 위치를 조정해주세요.`
      )
    } else {
      setGridSizeWarning(null)
    }
    setGridRows(val)
  }

  const handleGridColsChange = (val: number) => {
    const outOfBounds = equipment.filter((eq) => eq.grid_x + eq.grid_w > val)
    if (outOfBounds.length > 0) {
      setGridSizeWarning(
        `${outOfBounds.length}개 장비가 범위 밖에 있습니다. 저장 전 위치를 조정해주세요.`
      )
    } else {
      setGridSizeWarning(null)
    }
    setGridCols(val)
  }

  // ==================== DnD 핸들러 ====================

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type) {
      const eqType = data.type as EquipmentType
      setActiveDragType(eqType)
      if (data.isNew) {
        setActiveDragSize(EQUIPMENT_DEFAULT_SIZE[eqType] || { w: 1, h: 1 })
      } else if (data.localId) {
        const eq = equipment.find((e) => e.localId === data.localId)
        if (eq) setActiveDragSize({ w: eq.grid_w, h: eq.grid_h })
      }
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setHoverCell(null)
      return
    }
    const overData = over.data.current as { col?: number; row?: number } | undefined
    if (overData?.col != null && overData?.row != null) {
      setHoverCell({ col: overData.col, row: overData.row })
    } else {
      setHoverCell(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragType(null)
    setActiveDragSize(null)
    setHoverCell(null)
    const { active, over } = event
    if (!over) return

    const overData = over.data.current as { col?: number; row?: number } | undefined
    if (overData?.col == null || overData?.row == null) return

    const activeData = active.data.current as { type: EquipmentType; isNew: boolean; localId?: string }
    const dropCol = overData.col
    const dropRow = overData.row

    if (activeData.isNew) {
      // 팔레트에서 새 장비 드롭
      const size = EQUIPMENT_DEFAULT_SIZE[activeData.type] || { w: 1, h: 1 }

      // 그리드 범위 체크
      if (dropCol + size.w > gridCols || dropRow + size.h > gridRows) {
        showToast('그리드 범위를 벗어납니다', 'error')
        return
      }

      const defaultName = activeData.type === 'PREP_TABLE'
        ? '작업대(데코존)'
        : EQUIPMENT_LABELS[activeData.type] || activeData.type

      const newEq: LocalEquipment = {
        localId: crypto.randomUUID(),
        dbId: null,
        equipment_type: activeData.type,
        equipment_key: '', // 저장 시 자동 생성
        grid_x: dropCol,
        grid_y: dropRow,
        grid_w: size.w,
        grid_h: size.h,
        equipment_config: {},
        storage_location_ids: [],
        display_name: defaultName,
        display_order: equipment.length,
        is_active: true,
      }

      setEquipment((prev) => [...prev, newEq])
      setSelectedId(newEq.localId)
    } else if (activeData.localId) {
      // 기존 장비 재배치
      setEquipment((prev) =>
        prev.map((eq) => {
          if (eq.localId !== activeData.localId) return eq
          const newX = dropCol
          const newY = dropRow

          // 그리드 범위 체크
          if (newX + eq.grid_w > gridCols || newY + eq.grid_h > gridRows) {
            showToast('그리드 범위를 벗어납니다', 'error')
            return eq
          }

          return { ...eq, grid_x: newX, grid_y: newY }
        })
      )
    }
  }

  // ==================== 장비 설정 ====================

  const selectedEquipment = equipment.find((eq) => eq.localId === selectedId)

  const updateSelected = (updates: Partial<LocalEquipment>) => {
    if (!selectedId) return
    setEquipment((prev) =>
      prev.map((eq) => (eq.localId === selectedId ? { ...eq, ...updates } : eq))
    )
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setEquipment((prev) => prev.filter((eq) => eq.localId !== selectedId))
    setSelectedId(null)
  }

  // ==================== 저장 (UPSERT) ====================

  const generateEquipmentKeys = (eqs: LocalEquipment[]): LocalEquipment[] => {
    const counts: Record<string, number> = {}
    return eqs.map((eq) => {
      const typeKey = eq.equipment_type.toLowerCase()
      counts[typeKey] = (counts[typeKey] || 0) + 1
      return { ...eq, equipment_key: `${typeKey}_${counts[typeKey]}` }
    })
  }

  const handleSave = async () => {
    if (!store) return
    setSaving(true)

    try {
      // 1. 그리드 UPSERT
      let gridId: string
      if (grid) {
        const updated = await updateKitchenGrid(grid.id, {
          grid_cols: gridCols,
          grid_rows: gridRows,
          grid_name: gridName,
        })
        gridId = updated.id
        setGrid(updated)
      } else {
        const created = await createKitchenGrid(store.id, gridCols, gridRows, gridName)
        gridId = created.id
        setGrid(created)
      }

      // 2. 장비 UPSERT
      const keyedEquipment = generateEquipmentKeys(equipment)
      const currentLocalIds = new Set(keyedEquipment.map((eq) => eq.dbId).filter(Boolean))

      // DELETE: DB에 있지만 화면에 없는 장비
      for (const dbId of dbEquipmentIds) {
        if (!currentLocalIds.has(dbId)) {
          await deleteEquipment(dbId)
        }
      }

      // INSERT/UPDATE
      const newDbIds = new Set<string>()
      const updatedLocals: LocalEquipment[] = []

      for (const eq of keyedEquipment) {
        const payload = {
          equipment_type: eq.equipment_type,
          equipment_key: eq.equipment_key,
          grid_x: eq.grid_x,
          grid_y: eq.grid_y,
          grid_w: eq.grid_w,
          grid_h: eq.grid_h,
          equipment_config: eq.equipment_config,
          storage_location_ids: eq.storage_location_ids,
          display_name: eq.display_name,
          display_order: eq.display_order,
          is_active: true,
        }

        if (eq.dbId) {
          // UPDATE: DB에 있고 화면에도 있는 장비
          const updated = await updateEquipment(eq.dbId, payload)
          newDbIds.add(updated.id)
          updatedLocals.push({ ...eq, dbId: updated.id })
        } else {
          // INSERT: DB에 없고 화면에 있는 장비
          const created = await createEquipment(gridId, payload as any)
          newDbIds.add(created.id)
          updatedLocals.push({ ...eq, dbId: created.id })
        }
      }

      setEquipment(updatedLocals)
      setDbEquipmentIds(newDbIds)
      showToast('저장 완료!')
    } catch (err: any) {
      showToast(`저장 실패: ${err.message}`, 'error')
    }

    setSaving(false)
  }

  // ==================== 초기화 ====================

  const handleReset = () => {
    if (!confirm('모든 장비를 제거하시겠습니까?')) return
    setEquipment([])
    setSelectedId(null)
    setGridSizeWarning(null)
  }

  // ==================== 렌더링 ====================

  if (!store) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-[#757575]">주방 데이터 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b border-[#E0E0E0] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="text-[#757575] hover:text-[#333] font-medium"
          >
            ← 돌아가기
          </button>
          <h1 className="text-lg font-bold text-[#333]">
            {store.store_name} — 주방 레이아웃 설정
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-gray-100 text-sm transition disabled:opacity-50"
          >
            초기화
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium ${
              toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 그리드 설정 바 */}
      <div className="bg-white border-b border-[#E0E0E0] px-4 py-2 flex items-center gap-4 text-sm flex-wrap">
        <label className="flex items-center gap-1">
          이름:
          <input
            type="text"
            value={gridName}
            onChange={(e) => setGridName(e.target.value)}
            className="px-2 py-1 border border-[#E0E0E0] rounded w-32"
          />
        </label>
        <label className="flex items-center gap-1">
          행:
          <input
            type="number"
            min={2}
            max={20}
            value={gridRows}
            onChange={(e) => handleGridRowsChange(Number(e.target.value))}
            className="px-2 py-1 border border-[#E0E0E0] rounded w-16 text-center"
          />
        </label>
        <label className="flex items-center gap-1">
          열:
          <input
            type="number"
            min={4}
            max={24}
            value={gridCols}
            onChange={(e) => handleGridColsChange(Number(e.target.value))}
            className="px-2 py-1 border border-[#E0E0E0] rounded w-16 text-center"
          />
        </label>
        <span className="text-[#9E9E9E]">
          그리드: {gridRows}×{gridCols} ({gridRows * gridCols}칸)
        </span>
        {gridSizeWarning && (
          <span className="text-orange-600 font-medium">{gridSizeWarning}</span>
        )}
      </div>

      {/* 메인 영역 */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          {/* 좌측: 장비 팔레트 */}
          <div className="w-56 bg-white border-r border-[#E0E0E0] p-3 overflow-y-auto flex-shrink-0">
            <h2 className="text-sm font-bold text-[#333] mb-2">장비 팔레트</h2>
            <p className="text-xs text-[#9E9E9E] mb-3">드래그하여 그리드에 배치</p>
            <div className="flex flex-col gap-1.5">
              {PALETTE_TYPES.map((type) => (
                <PaletteItem key={type} type={type} />
              ))}
            </div>
          </div>

          {/* 우측: 그리드 + 설정 패널 */}
          <div className="flex-1 flex flex-col overflow-auto">
            {/* 그리드 */}
            <div className="flex-1 p-4 overflow-auto" onClick={() => setSelectedId(null)}>
              <div
                className="relative inline-grid gap-0 bg-[#FAFAFA] border border-[#BDBDBD] rounded-lg"
                style={{
                  gridTemplateColumns: `repeat(${gridCols}, ${CELL_SIZE}px)`,
                  gridTemplateRows: `repeat(${gridRows}, ${CELL_SIZE}px)`,
                }}
              >
                {/* 배경 셀 (드롭 대상) */}
                {Array.from({ length: gridRows }, (_, row) =>
                  Array.from({ length: gridCols }, (_, col) => (
                    <GridCell key={`${col}-${row}`} col={col} row={row} />
                  ))
                )}

                {/* 드래그 하이라이트 오버레이 */}
                {hoverCell && activeDragSize && (() => {
                  const outOfBounds =
                    hoverCell.col + activeDragSize.w > gridCols ||
                    hoverCell.row + activeDragSize.h > gridRows
                  return (
                    <div
                      style={{
                        gridColumn: `${hoverCell.col + 1} / span ${activeDragSize.w}`,
                        gridRow: `${hoverCell.row + 1} / span ${activeDragSize.h}`,
                        backgroundColor: outOfBounds
                          ? 'rgba(239, 68, 68, 0.25)'
                          : 'rgba(59, 130, 246, 0.2)',
                        border: `2px dashed ${outOfBounds ? '#ef4444' : '#3b82f6'}`,
                        zIndex: 90,
                        pointerEvents: 'none' as const,
                      }}
                      className="rounded-md transition-colors duration-150"
                    />
                  )
                })()}

                {/* 배치된 장비 */}
                {equipment.map((eq) => (
                  <PlacedEquipment
                    key={eq.localId}
                    eq={eq}
                    isSelected={eq.localId === selectedId}
                    onClick={() => setSelectedId(eq.localId)}
                  />
                ))}
              </div>
            </div>

            {/* 하단: 장비 설정 패널 */}
            <AnimatePresence>
              {selectedEquipment && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-[#E0E0E0] bg-white overflow-hidden"
                >
                  <div className="p-4 flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="block text-xs font-medium text-[#757575] mb-1">타입</label>
                      <div className="px-3 py-1.5 bg-gray-100 rounded text-sm font-medium flex items-center gap-1">
                        <span>{EQUIPMENT_ICONS[selectedEquipment.equipment_type]}</span>
                        {EQUIPMENT_LABELS[selectedEquipment.equipment_type] || selectedEquipment.equipment_type}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#757575] mb-1">표시 이름</label>
                      <input
                        type="text"
                        value={selectedEquipment.display_name}
                        onChange={(e) => updateSelected({ display_name: e.target.value })}
                        className="px-2 py-1.5 border border-[#E0E0E0] rounded text-sm w-40"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[#757575] mb-1">X</label>
                        <input
                          type="number"
                          min={0}
                          value={selectedEquipment.grid_x}
                          onChange={(e) => updateSelected({ grid_x: Number(e.target.value) })}
                          className="px-2 py-1.5 border border-[#E0E0E0] rounded text-sm w-14 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#757575] mb-1">Y</label>
                        <input
                          type="number"
                          min={0}
                          value={selectedEquipment.grid_y}
                          onChange={(e) => updateSelected({ grid_y: Number(e.target.value) })}
                          className="px-2 py-1.5 border border-[#E0E0E0] rounded text-sm w-14 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#757575] mb-1">W</label>
                        <input
                          type="number"
                          min={1}
                          value={selectedEquipment.grid_w}
                          onChange={(e) => updateSelected({ grid_w: Number(e.target.value) })}
                          className="px-2 py-1.5 border border-[#E0E0E0] rounded text-sm w-14 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#757575] mb-1">H</label>
                        <input
                          type="number"
                          min={1}
                          value={selectedEquipment.grid_h}
                          onChange={(e) => updateSelected({ grid_h: Number(e.target.value) })}
                          className="px-2 py-1.5 border border-[#E0E0E0] rounded text-sm w-14 text-center"
                        />
                      </div>
                    </div>
                    {STORABLE_TYPES.includes(selectedEquipment.equipment_type) && (
                      <button
                        onClick={() => setStorageModalEquipment(selectedEquipment)}
                        className="px-3 py-1.5 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600 transition"
                      >
                        📦 내부 열기
                      </button>
                    )}
                    <button
                      onClick={deleteSelected}
                      className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
                    >
                      삭제
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 드래그 오버레이 */}
        <DragOverlay>
          {activeDragType && (
            <div
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 border-primary shadow-xl text-sm pointer-events-none"
              style={{ opacity: 0.9 }}
            >
              <span>{EQUIPMENT_ICONS[activeDragType]}</span>
              <span className="font-medium">{EQUIPMENT_LABELS[activeDragType] || activeDragType}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* 장비 내부 (식자재 배치) 모달 */}
      {storageModalEquipment && store && (
        <EquipmentStorageModal
          store={store}
          equipmentDbId={storageModalEquipment.dbId}
          equipmentType={storageModalEquipment.equipment_type}
          equipmentKey={storageModalEquipment.equipment_key}
          equipmentName={storageModalEquipment.display_name || EQUIPMENT_LABELS[storageModalEquipment.equipment_type] || storageModalEquipment.equipment_type}
          storageLocationIds={storageModalEquipment.storage_location_ids}
          onClose={() => setStorageModalEquipment(null)}
          onStorageLinked={(codes) => {
            // 장비의 storage_location_ids 로컬 업데이트
            if (storageModalEquipment) {
              setEquipment(prev => prev.map(eq =>
                eq.localId === storageModalEquipment.localId
                  ? { ...eq, storage_location_ids: codes }
                  : eq
              ))
            }
          }}
        />
      )}
    </div>
  )
}

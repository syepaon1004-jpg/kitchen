import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fetchStorageLocationsByCodes,
  fetchFridgeFloors,
  fetchAllIngredientsMaster,
  fetchInventoryByLocation,
  initStorageLocationsForEquipment,
  updateEquipmentStorageLinks,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  fetchDecoIngredients,
  createDecoIngredient,
  updateDecoIngredient,
  deleteDecoIngredient,
} from '../../api/inventoryApi'
import { calculateGridArea } from '../../utils/grid'
import type { Store, StorageLocation, IngredientMaster, IngredientInventory, DecoIngredient } from '../../types/database.types'
import IngredientMasterModal from './IngredientMasterModal'

// ==================== 유틸 ====================

function extractEquipmentNumber(equipmentKey: string): string {
  const match = equipmentKey.match(/(\d+)$/)
  return match ? match[1] : '1'
}

// ==================== 상수 ====================

const STORABLE_TYPES = ['DRAWER_FRIDGE', 'FRIDGE_4BOX', 'SEASONING_COUNTER', 'FREEZER', 'PREP_TABLE']

const GRID_SIZES = ['1x1', '1x2', '2x1', '2x2', '2x3', '3x2'] as const

const STORAGE_CELL = 52

const DECO_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#78716C', '#1E293B',
] as const

// ==================== 로컬 타입 ====================

/** 그리드 배치 가능한 아이템의 공통 필드 */
interface GridPlaceable {
  localId: string
  grid_positions: string
  grid_size: string
  _deleted?: boolean
}

interface LocalInventoryItem extends GridPlaceable {
  dbId: string | null
  ingredient_master_id: string
  ingredient_master?: IngredientMaster
  storage_location_id: string
  floor_number: number | null
  display_order: number
}

interface LocalDecoItem extends GridPlaceable {
  dbId: string | null
  ingredient_master_id: string
  ingredient_master?: IngredientMaster
  storage_location_id: string
  deco_category: 'GARNISH' | 'SAUCE' | 'TOPPING'
  has_exact_amount: boolean
  display_color: string
  display_order: number
}

function fromDbInventory(inv: IngredientInventory): LocalInventoryItem {
  return {
    localId: crypto.randomUUID(),
    dbId: inv.id,
    ingredient_master_id: inv.ingredient_master_id,
    ingredient_master: inv.ingredient_master,
    storage_location_id: inv.storage_location_id,
    grid_positions: inv.grid_positions ?? '1',
    grid_size: inv.grid_size ?? '1x1',
    floor_number: inv.floor_number ?? null,
    display_order: inv.display_order ?? 0,
  }
}

function fromDbDeco(d: DecoIngredient): LocalDecoItem {
  return {
    localId: crypto.randomUUID(),
    dbId: d.id,
    ingredient_master_id: d.ingredient_master_id,
    ingredient_master: d.ingredient_master,
    storage_location_id: d.storage_location_id ?? '',
    deco_category: d.deco_category,
    has_exact_amount: d.has_exact_amount,
    display_color: d.display_color,
    grid_positions: d.grid_positions ?? '1',
    grid_size: d.grid_size ?? '1x1',
    display_order: d.display_order ?? 0,
  }
}

// ==================== 그리드 유틸 ====================

/** grid_size "WxH" → {w, h} */
function parseGridSize(gs: string): { w: number; h: number } {
  const [w, h] = gs.split('x').map(Number)
  return { w: w || 1, h: h || 1 }
}

/** 앵커 셀 + grid_size → grid_positions 문자열 */
function generateGridPositions(anchor: number, gridSize: string, gridCols: number): string {
  const { w, h } = parseGridSize(gridSize)
  const anchorRow = Math.floor((anchor - 1) / gridCols)
  const anchorCol = (anchor - 1) % gridCols
  const positions: number[] = []
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      positions.push((anchorRow + dy) * gridCols + (anchorCol + dx) + 1)
    }
  }
  return positions.join(',')
}

/** 셀이 사용 가능한지 (anchor + size가 그리드 범위 내 && 겹침 없음) */
function canPlaceAt(
  anchor: number,
  gridSize: string,
  gridRows: number,
  gridCols: number,
  occupiedCells: Set<number>,
  excludeLocalId?: string,
  items?: GridPlaceable[]
): boolean {
  const { w, h } = parseGridSize(gridSize)
  const anchorRow = Math.floor((anchor - 1) / gridCols)
  const anchorCol = (anchor - 1) % gridCols
  if (anchorCol + w > gridCols || anchorRow + h > gridRows) return false
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const cellNum = (anchorRow + dy) * gridCols + (anchorCol + dx) + 1
      if (occupiedCells.has(cellNum)) {
        if (excludeLocalId && items) {
          const owner = items.find(it =>
            !it._deleted && it.grid_positions.split(',').map(Number).includes(cellNum) && it.localId === excludeLocalId
          )
          if (owner) continue
        }
        return false
      }
    }
  }
  return true
}

function getOccupiedCells(items: GridPlaceable[], excludeId?: string): Set<number> {
  const cells = new Set<number>()
  items.forEach(it => {
    if (it._deleted) return
    if (excludeId && it.localId === excludeId) return
    it.grid_positions.split(',').map(Number).forEach(n => cells.add(n))
  })
  return cells
}

// ==================== Props ====================

interface Props {
  store: Store
  equipmentDbId: string | null
  equipmentType: string
  equipmentKey: string
  equipmentName: string
  storageLocationIds: string[]
  onClose: () => void
  onStorageLinked: (codes: string[]) => void
}

// ==================== 메인 컴포넌트 ====================

export default function EquipmentStorageModal({
  store,
  equipmentDbId,
  equipmentType,
  equipmentKey,
  equipmentName,
  storageLocationIds,
  onClose,
  onStorageLinked,
}: Props) {
  const isPrepTable = equipmentType === 'PREP_TABLE'

  // ---------- 공통 상태 ----------
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [masters, setMasters] = useState<IngredientMaster[]>([])
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // 재고 (일반 장비)
  const [inventoryMap, setInventoryMap] = useState<Record<string, LocalInventoryItem[]>>({})
  // 데코 재료 (PREP_TABLE)
  const [decoMap, setDecoMap] = useState<Record<string, LocalDecoItem[]>>({})

  // 4호박스/냉동고 구역별 층 선택
  const [zoneFloors, setZoneFloors] = useState<Record<string, number>>({ LT: 1, RT: 1, LB: 1, RB: 1 })

  // 공통 폼 상태
  const [addingForLocationId, setAddingForLocationId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<GridPlaceable | null>(null)
  const [formMasterId, setFormMasterId] = useState<string>('')
  const [formGridSize, setFormGridSize] = useState<string>('1x1')
  const [formAnchor, setFormAnchor] = useState<number | null>(null)
  const [masterSearch, setMasterSearch] = useState('')
  const [showMasterModal, setShowMasterModal] = useState(false)

  // 데코 전용 폼
  const [formDecoCategory, setFormDecoCategory] = useState<'GARNISH' | 'SAUCE' | 'TOPPING'>('GARNISH')
  const [formHasExactAmount, setFormHasExactAmount] = useState(false)
  const [formDisplayColor, setFormDisplayColor] = useState<string>(DECO_COLORS[0])

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ---------- 초기 로드 ----------

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // 1. 재료 마스터 로드
        const allMasters = await fetchAllIngredientsMaster()
        if (cancelled) return
        setMasters(allMasters)

        // 2. storage_locations 확인/생성
        let locs: StorageLocation[] = []
        let codes = storageLocationIds

        if (codes.length === 0) {
          const result = await initStorageLocationsForEquipment(
            store.id,
            equipmentType,
            equipmentKey
          )
          if (cancelled) return
          locs = result.locations
          codes = result.codes

          if (equipmentDbId && codes.length > 0) {
            await updateEquipmentStorageLinks(equipmentDbId, codes)
            onStorageLinked(codes)
          }
        } else {
          locs = await fetchStorageLocationsByCodes(store.id, codes)
          if (cancelled) return

          // FRIDGE / FREEZER 부모의 자식 FRIDGE_FLOOR 조회
          const floorParents = locs.filter(l => l.location_type === 'FRIDGE' || l.location_type === 'FREEZER')
          if (floorParents.length > 0) {
            const floors = await fetchFridgeFloors(store.id, floorParents.map(f => f.id))
            if (cancelled) return
            locs = [...locs, ...floors]
          }
        }

        setLocations(locs)

        // 3. 데이터 로드 (장비 타입별 분기)
        if (isPrepTable) {
          // PREP_TABLE → deco_ingredients 로드
          const allDeco = await fetchDecoIngredients(store.id)
          if (cancelled) return
          const dMap: Record<string, LocalDecoItem[]> = {}
          // DECO_ZONE 위치 목록
          const decoLocs = locs.filter(l => l.location_type === 'DECO_ZONE')
          const decoLocIds = new Set(decoLocs.map(l => l.id))
          for (const loc of locs) {
            if (loc.location_type === 'DECO_ZONE') {
              // storage_location_id 일치 + NULL인 기존 항목도 포함 (샘플 데이터 등)
              dMap[loc.id] = allDeco
                .filter(d => d.storage_location_id === loc.id ||
                  ((!d.storage_location_id) && decoLocs.length === 1))
                .map(fromDbDeco)
            }
          }
          // 어느 DECO_ZONE에도 속하지 않는 기존 항목 → 첫 번째 DECO_ZONE에 할당
          if (decoLocs.length > 0) {
            const orphaned = allDeco.filter(d =>
              d.storage_location_id && !decoLocIds.has(d.storage_location_id)
            )
            if (orphaned.length > 0) {
              const firstLocId = decoLocs[0].id
              dMap[firstLocId] = [...(dMap[firstLocId] ?? []), ...orphaned.map(fromDbDeco)]
            }
          }
          setDecoMap(dMap)
        } else {
          // 일반 장비 → ingredients_inventory 로드
          const invMap: Record<string, LocalInventoryItem[]> = {}
          for (const loc of locs) {
            // FRIDGE/FREEZER 부모는 floor에만 재고 저장 → 건너뜀
            if (loc.location_type === 'FRIDGE' || (loc.location_type === 'FREEZER' && loc.has_floors)) continue
            const items = await fetchInventoryByLocation(store.id, loc.id)
            if (cancelled) return
            invMap[loc.id] = items.map(fromDbInventory)
          }
          setInventoryMap(invMap)
        }
      } catch (err: any) {
        showToast(err.message, 'error')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 공통 폼 유틸 ----------

  const selectedMaster = useMemo(
    () => masters.find(m => m.id === formMasterId),
    [masters, formMasterId]
  )

  const filteredMasters = useMemo(
    () => masterSearch
      ? masters.filter(m => m.ingredient_name.includes(masterSearch) || (m.ingredient_name_en ?? '').toLowerCase().includes(masterSearch.toLowerCase()))
      : masters,
    [masters, masterSearch]
  )

  const openAddForm = (locationId: string) => {
    setAddingForLocationId(locationId)
    setEditingItem(null)
    setFormMasterId('')
    setFormGridSize('1x1')
    setFormAnchor(null)
    setMasterSearch('')
    setFormDecoCategory('GARNISH')
    setFormHasExactAmount(false)
    setFormDisplayColor(DECO_COLORS[0])
  }

  const closeForm = () => {
    setAddingForLocationId(null)
    setEditingItem(null)
  }

  // ---------- 일반 재고 추가/수정 ----------

  const openEditForm = (item: LocalInventoryItem) => {
    setAddingForLocationId(item.storage_location_id)
    setEditingItem(item)
    setFormMasterId(item.ingredient_master_id)
    setFormGridSize(item.grid_size)
    setFormAnchor(Number(item.grid_positions.split(',')[0]))
    setMasterSearch('')
  }

  const handleAddItem = () => {
    if (!addingForLocationId || !formMasterId || !formAnchor) return
    const master = masters.find(m => m.id === formMasterId)
    if (!master) return

    const loc = locations.find(l => l.id === addingForLocationId)
    if (!loc) return

    const gridPositions = generateGridPositions(formAnchor, formGridSize, loc.grid_cols)

    let floorNumber: number | null = null
    if (loc.location_type === 'FRIDGE_FLOOR') {
      const floorMatch = loc.location_code.match(/_F(\d+)$/)
      floorNumber = floorMatch ? Number(floorMatch[1]) : null
    }

    if (editingItem) {
      setInventoryMap(prev => ({
        ...prev,
        [addingForLocationId]: (prev[addingForLocationId] ?? []).map(it =>
          it.localId === editingItem.localId
            ? {
                ...it,
                ingredient_master_id: formMasterId,
                ingredient_master: master,
                grid_positions: gridPositions,
                grid_size: formGridSize,
                floor_number: floorNumber,
              }
            : it
        ),
      }))
    } else {
      const newItem: LocalInventoryItem = {
        localId: crypto.randomUUID(),
        dbId: null,
        ingredient_master_id: formMasterId,
        ingredient_master: master,
        storage_location_id: addingForLocationId,
        grid_positions: gridPositions,
        grid_size: formGridSize,
        floor_number: floorNumber,
        display_order: (inventoryMap[addingForLocationId] ?? []).filter(i => !i._deleted).length,
      }
      setInventoryMap(prev => ({
        ...prev,
        [addingForLocationId]: [...(prev[addingForLocationId] ?? []), newItem],
      }))
    }
    setDirty(true)
    closeForm()
  }

  const handleDeleteItem = (locationId: string, localId: string) => {
    setInventoryMap(prev => ({
      ...prev,
      [locationId]: (prev[locationId] ?? []).map(it =>
        it.localId === localId ? { ...it, _deleted: true } : it
      ),
    }))
    setDirty(true)
    if (editingItem?.localId === localId) closeForm()
  }

  // ---------- 데코 재료 추가/수정 ----------

  const openDecoEditForm = (item: LocalDecoItem) => {
    setAddingForLocationId(item.storage_location_id)
    setEditingItem(item)
    setFormMasterId(item.ingredient_master_id)
    setFormGridSize(item.grid_size)
    setFormAnchor(Number(item.grid_positions.split(',')[0]))
    setFormDecoCategory(item.deco_category)
    setFormHasExactAmount(item.has_exact_amount)
    setFormDisplayColor(item.display_color)
    setMasterSearch('')
  }

  const handleAddDecoItem = () => {
    if (!addingForLocationId || !formMasterId || !formAnchor) return
    const master = masters.find(m => m.id === formMasterId)
    if (!master) return

    const loc = locations.find(l => l.id === addingForLocationId)
    if (!loc) return

    const gridPositions = generateGridPositions(formAnchor, formGridSize, loc.grid_cols)

    if (editingItem) {
      setDecoMap(prev => ({
        ...prev,
        [addingForLocationId]: (prev[addingForLocationId] ?? []).map(it =>
          it.localId === editingItem.localId
            ? {
                ...it,
                ingredient_master_id: formMasterId,
                ingredient_master: master,
                deco_category: formDecoCategory,
                has_exact_amount: formHasExactAmount,
                display_color: formDisplayColor,
                grid_positions: gridPositions,
                grid_size: formGridSize,
              }
            : it
        ),
      }))
    } else {
      const newItem: LocalDecoItem = {
        localId: crypto.randomUUID(),
        dbId: null,
        ingredient_master_id: formMasterId,
        ingredient_master: master,
        storage_location_id: addingForLocationId,
        deco_category: formDecoCategory,
        has_exact_amount: formHasExactAmount,
        display_color: formDisplayColor,
        grid_positions: gridPositions,
        grid_size: formGridSize,
        display_order: (decoMap[addingForLocationId] ?? []).filter(i => !i._deleted).length,
      }
      setDecoMap(prev => ({
        ...prev,
        [addingForLocationId]: [...(prev[addingForLocationId] ?? []), newItem],
      }))
    }
    setDirty(true)
    closeForm()
  }

  const handleDeleteDecoItem = (locationId: string, localId: string) => {
    setDecoMap(prev => ({
      ...prev,
      [locationId]: (prev[locationId] ?? []).map(it =>
        it.localId === localId ? { ...it, _deleted: true } : it
      ),
    }))
    setDirty(true)
    if (editingItem?.localId === localId) closeForm()
  }

  // ---------- 일괄 저장 ----------

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isPrepTable) {
        // PREP_TABLE → deco_ingredients 저장
        for (const [locationId, items] of Object.entries(decoMap)) {
          for (const item of items) {
            if (item._deleted && item.dbId) {
              await deleteDecoIngredient(item.dbId)
            } else if (item.dbId && !item._deleted) {
              await updateDecoIngredient(item.dbId, {
                ingredient_master_id: item.ingredient_master_id,
                deco_category: item.deco_category,
                has_exact_amount: item.has_exact_amount,
                display_color: item.display_color,
                grid_positions: item.grid_positions,
                grid_size: item.grid_size,
                display_order: item.display_order,
                storage_location_id: item.storage_location_id,
                store_id: store.id,
              } as any)
            } else if (!item.dbId && !item._deleted) {
              const created = await createDecoIngredient({
                store_id: store.id,
                ingredient_master_id: item.ingredient_master_id,
                storage_location_id: item.storage_location_id,
                deco_category: item.deco_category,
                has_exact_amount: item.has_exact_amount,
                display_color: item.display_color,
                grid_positions: item.grid_positions,
                grid_size: item.grid_size,
                display_order: item.display_order,
              } as any)
              item.dbId = created.id
            }
          }
          setDecoMap(prev => ({
            ...prev,
            [locationId]: (prev[locationId] ?? []).filter(it => !it._deleted),
          }))
        }
      } else {
        // 일반 장비 → ingredients_inventory 저장
        for (const [locationId, items] of Object.entries(inventoryMap)) {
          for (const item of items) {
            if (item._deleted && item.dbId) {
              await deleteInventoryItem(item.dbId)
            } else if (item.dbId && !item._deleted) {
              await updateInventoryItem(item.dbId, {
                ingredient_master_id: item.ingredient_master_id,
                grid_positions: item.grid_positions,
                grid_size: item.grid_size,
                floor_number: item.floor_number,
                display_order: item.display_order,
                store_id: store.id,
                storage_location_id: item.storage_location_id,
              } as any)
            } else if (!item.dbId && !item._deleted) {
              const created = await createInventoryItem({
                store_id: store.id,
                ingredient_master_id: item.ingredient_master_id,
                storage_location_id: item.storage_location_id,
                grid_positions: item.grid_positions,
                grid_size: item.grid_size,
                floor_number: item.floor_number,
                display_order: item.display_order,
              } as any)
              item.dbId = created.id
            }
          }
          setInventoryMap(prev => ({
            ...prev,
            [locationId]: (prev[locationId] ?? []).filter(it => !it._deleted),
          }))
        }
      }
      setDirty(false)
      showToast('저장 완료!')
    } catch (err: any) {
      showToast(`저장 실패: ${err.message}`, 'error')
    }
    setSaving(false)
  }

  // ---------- 모달 닫기 (변경사항 경고) ----------

  const handleClose = () => {
    if (showMasterModal) return
    if (dirty) {
      if (!confirm('저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?')) return
    }
    onClose()
  }

  // ---------- 재료 선택 폼 (공통) ----------

  const renderMasterSearchForm = () => (
    <div className="mb-2">
      <label className="block text-[10px] text-[#757575] mb-1">재료</label>
      <input
        type="text"
        value={masterSearch || (selectedMaster?.ingredient_name ?? '')}
        onChange={(e) => {
          setMasterSearch(e.target.value)
          if (!e.target.value) setFormMasterId('')
        }}
        onFocus={() => {
          if (selectedMaster) setMasterSearch(selectedMaster.ingredient_name)
        }}
        placeholder="재료 이름 검색..."
        className="w-full px-2 py-1.5 text-xs border border-[#E0E0E0] rounded"
      />
      {masterSearch && !formMasterId && (
        <div className="max-h-32 overflow-y-auto border border-[#E0E0E0] rounded mt-1 bg-white">
          {filteredMasters.map(m => (
            <div
              key={m.id}
              onClick={() => {
                setFormMasterId(m.id)
                setMasterSearch('')
              }}
              className="px-2 py-1.5 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
            >
              <span>{m.ingredient_name}</span>
              <span className="text-[#9E9E9E]">{m.base_unit}</span>
            </div>
          ))}
          {filteredMasters.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-[#9E9E9E]">
              결과 없음 —{' '}
              <button onClick={() => setShowMasterModal(true)} className="text-blue-600 underline">
                새 재료 등록
              </button>
            </div>
          )}
        </div>
      )}
      {selectedMaster && (
        <div className="text-[10px] text-[#757575] mt-0.5">
          단위: {selectedMaster.base_unit} | 카테고리: {selectedMaster.category}
        </div>
      )}
    </div>
  )

  // ---------- 일반 장비 그리드 ----------

  const renderGrid = (loc: StorageLocation) => {
    const items = (inventoryMap[loc.id] ?? []).filter(it => !it._deleted)
    const occupied = getOccupiedCells(items, editingItem?.localId)
    const isAdding = addingForLocationId === loc.id

    return (
      <div key={loc.id} className="border border-[#E0E0E0] rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#333]">{loc.location_name}</span>
          <span className="text-[10px] text-[#9E9E9E]">{loc.grid_rows}x{loc.grid_cols}</span>
        </div>

        {/* 그리드 */}
        <div
          className="inline-grid gap-[1px] bg-[#E0E0E0] border border-[#BDBDBD] rounded"
          style={{
            gridTemplateColumns: `repeat(${loc.grid_cols}, ${STORAGE_CELL}px)`,
            gridTemplateRows: `repeat(${loc.grid_rows}, ${STORAGE_CELL}px)`,
          }}
        >
          {/* 배경 셀 */}
          {Array.from({ length: loc.grid_rows * loc.grid_cols }, (_, i) => {
            const cellNum = i + 1
            const isOccupied = occupied.has(cellNum)

            const isAnchorMode = isAdding && !!formMasterId
            const placeable = isAnchorMode && canPlaceAt(cellNum, formGridSize, loc.grid_rows, loc.grid_cols, occupied, editingItem?.localId, items)
            const isSelected = formAnchor === cellNum && isAdding

            return (
              <div
                key={cellNum}
                onClick={() => {
                  if (isAnchorMode && placeable) {
                    setFormAnchor(cellNum)
                  } else if (!isOccupied && !isAdding) {
                    openAddForm(loc.id)
                  }
                }}
                className={`relative flex items-center justify-center transition-colors
                  ${isOccupied ? '' : 'bg-[#FAFAFA]'}
                  ${!isOccupied && !isAnchorMode ? 'bg-[#FAFAFA] cursor-pointer hover:bg-blue-50' : ''}
                  ${isAnchorMode && placeable ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer' : ''}
                  ${isAnchorMode && !placeable && !isOccupied ? 'bg-gray-100' : ''}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-200' : ''}
                `}
                style={{
                  gridColumn: ((cellNum - 1) % loc.grid_cols) + 1,
                  gridRow: Math.floor((cellNum - 1) / loc.grid_cols) + 1,
                }}
              >
                {!isOccupied && !isAnchorMode && (
                  <span className="text-[18px] leading-none text-[#BDBDBD] hover:text-blue-400 select-none font-light">+</span>
                )}
              </div>
            )
          })}

          {/* 배치된 재고 아이템 */}
          {items.map(item => {
            const area = calculateGridArea(item.grid_positions, loc.grid_cols)
            return (
              <div
                key={item.localId}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!addingForLocationId) openEditForm(item)
                }}
                className="flex flex-col items-center justify-center rounded text-center cursor-pointer bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 transition-colors z-10"
                style={{
                  gridColumn: `${area.colStart} / ${area.colEnd}`,
                  gridRow: `${area.rowStart} / ${area.rowEnd}`,
                }}
              >
                <span className="text-[10px] font-bold text-emerald-800 leading-tight truncate w-full px-0.5">
                  {item.ingredient_master?.ingredient_name ?? '?'}
                </span>
                <span className="text-[9px] text-emerald-600">
                  ({item.ingredient_master?.base_unit ?? 'g'})
                </span>
              </div>
            )
          })}

          {/* 앵커 프리뷰 */}
          {isAdding && formAnchor && (() => {
            const previewPositions = generateGridPositions(formAnchor, formGridSize, loc.grid_cols)
            const area = calculateGridArea(previewPositions, loc.grid_cols)
            return (
              <div
                className="bg-blue-200/60 border-2 border-dashed border-blue-400 rounded z-20 pointer-events-none"
                style={{
                  gridColumn: `${area.colStart} / ${area.colEnd}`,
                  gridRow: `${area.rowStart} / ${area.rowEnd}`,
                }}
              />
            )
          })()}
        </div>

        {/* [+] 버튼 */}
        {!addingForLocationId && (
          <button
            onClick={() => openAddForm(loc.id)}
            className="mt-2 w-full py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
          >
            + 식자재 추가
          </button>
        )}

        {/* 추가/수정 폼 (인라인) */}
        {isAdding && (
          <div className="mt-2 border border-blue-200 rounded-lg p-3 bg-blue-50/50">
            <div className="text-xs font-bold text-[#333] mb-2">
              {editingItem ? '식자재 수정' : '식자재 추가'}
            </div>

            {renderMasterSearchForm()}

            {/* 크기 */}
            <div className="flex gap-2 mb-2">
              <div className="w-24">
                <label className="block text-[10px] text-[#757575] mb-1">크기</label>
                <select
                  value={formGridSize}
                  onChange={(e) => {
                    setFormGridSize(e.target.value)
                    setFormAnchor(null)
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-[#E0E0E0] rounded"
                >
                  {GRID_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* 위치 안내 */}
            <div className="text-[10px] text-[#757575] mb-2">
              {formMasterId
                ? formAnchor
                  ? `위치 선택됨: 셀 ${formAnchor}`
                  : '위 그리드에서 배치할 위치를 클릭하세요'
                : '재료를 먼저 선택하세요'
              }
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleAddItem}
                disabled={!formMasterId || !formAnchor}
                className="flex-1 py-1.5 text-xs text-white bg-blue-600 rounded-lg disabled:opacity-40 hover:bg-blue-700 transition"
              >
                {editingItem ? '수정' : '추가'}
              </button>
              {editingItem && (
                <button
                  onClick={() => handleDeleteItem((editingItem as LocalInventoryItem).storage_location_id, editingItem.localId)}
                  className="px-3 py-1.5 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600 transition"
                >
                  삭제
                </button>
              )}
              <button
                onClick={closeForm}
                className="px-3 py-1.5 text-xs text-[#757575] border border-[#E0E0E0] rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- 데코 그리드 (PREP_TABLE 전용) ----------

  const renderDecoGrid = (loc: StorageLocation) => {
    const items = (decoMap[loc.id] ?? []).filter(it => !it._deleted)
    const occupied = getOccupiedCells(items, editingItem?.localId)
    const isAdding = addingForLocationId === loc.id

    return (
      <div key={loc.id} className="border border-[#E0E0E0] rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#333]">{loc.location_name}</span>
          <span className="text-[10px] text-[#9E9E9E]">{loc.grid_rows}x{loc.grid_cols}</span>
        </div>

        {/* 그리드 */}
        <div
          className="inline-grid gap-[1px] bg-[#E0E0E0] border border-[#BDBDBD] rounded"
          style={{
            gridTemplateColumns: `repeat(${loc.grid_cols}, ${STORAGE_CELL}px)`,
            gridTemplateRows: `repeat(${loc.grid_rows}, ${STORAGE_CELL}px)`,
          }}
        >
          {/* 배경 셀 */}
          {Array.from({ length: loc.grid_rows * loc.grid_cols }, (_, i) => {
            const cellNum = i + 1
            const isOccupied = occupied.has(cellNum)

            const isAnchorMode = isAdding && !!formMasterId
            const placeable = isAnchorMode && canPlaceAt(cellNum, formGridSize, loc.grid_rows, loc.grid_cols, occupied, editingItem?.localId, items)
            const isSelected = formAnchor === cellNum && isAdding

            return (
              <div
                key={cellNum}
                onClick={() => {
                  if (isAnchorMode && placeable) {
                    setFormAnchor(cellNum)
                  } else if (!isOccupied && !isAdding) {
                    openAddForm(loc.id)
                  }
                }}
                className={`relative flex items-center justify-center transition-colors
                  ${isOccupied ? '' : 'bg-[#FAFAFA]'}
                  ${!isOccupied && !isAnchorMode ? 'bg-[#FAFAFA] cursor-pointer hover:bg-blue-50' : ''}
                  ${isAnchorMode && placeable ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer' : ''}
                  ${isAnchorMode && !placeable && !isOccupied ? 'bg-gray-100' : ''}
                  ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-200' : ''}
                `}
                style={{
                  gridColumn: ((cellNum - 1) % loc.grid_cols) + 1,
                  gridRow: Math.floor((cellNum - 1) / loc.grid_cols) + 1,
                }}
              >
                {!isOccupied && !isAnchorMode && (
                  <span className="text-[18px] leading-none text-[#BDBDBD] hover:text-blue-400 select-none font-light">+</span>
                )}
              </div>
            )
          })}

          {/* 배치된 데코 아이템 */}
          {items.map(item => {
            const area = calculateGridArea(item.grid_positions, loc.grid_cols)
            const catLabel = { GARNISH: '가니쉬', SAUCE: '소스', TOPPING: '토핑' }[item.deco_category]
            return (
              <div
                key={item.localId}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!addingForLocationId) openDecoEditForm(item)
                }}
                className="flex flex-col items-center justify-center rounded text-center cursor-pointer border hover:opacity-80 transition-colors z-10"
                style={{
                  gridColumn: `${area.colStart} / ${area.colEnd}`,
                  gridRow: `${area.rowStart} / ${area.rowEnd}`,
                  backgroundColor: item.display_color + '30',
                  borderColor: item.display_color,
                }}
              >
                <span className="text-[10px] font-bold leading-tight truncate w-full px-0.5" style={{ color: item.display_color }}>
                  {item.ingredient_master?.ingredient_name ?? '?'}
                </span>
                <span className="text-[9px] text-[#757575]">{catLabel}</span>
              </div>
            )
          })}

          {/* 앵커 프리뷰 */}
          {isAdding && formAnchor && (() => {
            const previewPositions = generateGridPositions(formAnchor, formGridSize, loc.grid_cols)
            const area = calculateGridArea(previewPositions, loc.grid_cols)
            return (
              <div
                className="border-2 border-dashed rounded z-20 pointer-events-none"
                style={{
                  gridColumn: `${area.colStart} / ${area.colEnd}`,
                  gridRow: `${area.rowStart} / ${area.rowEnd}`,
                  backgroundColor: formDisplayColor + '30',
                  borderColor: formDisplayColor,
                }}
              />
            )
          })()}
        </div>

        {/* [+] 버튼 */}
        {!addingForLocationId && (
          <button
            onClick={() => openAddForm(loc.id)}
            className="mt-2 w-full py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
          >
            + 상시배치 재료 추가
          </button>
        )}

        {/* 추가/수정 폼 (인라인) */}
        {isAdding && (
          <div className="mt-2 border border-blue-200 rounded-lg p-3 bg-blue-50/50">
            <div className="text-xs font-bold text-[#333] mb-2">
              {editingItem ? '상시배치 재료 수정' : '상시배치 재료 추가'}
            </div>

            {renderMasterSearchForm()}

            {/* 카테고리 + 크기 */}
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <label className="block text-[10px] text-[#757575] mb-1">카테고리</label>
                <select
                  value={formDecoCategory}
                  onChange={(e) => setFormDecoCategory(e.target.value as any)}
                  className="w-full px-2 py-1.5 text-xs border border-[#E0E0E0] rounded"
                >
                  <option value="GARNISH">가니쉬</option>
                  <option value="SAUCE">소스</option>
                  <option value="TOPPING">토핑</option>
                </select>
              </div>
              <div className="w-24">
                <label className="block text-[10px] text-[#757575] mb-1">크기</label>
                <select
                  value={formGridSize}
                  onChange={(e) => {
                    setFormGridSize(e.target.value)
                    setFormAnchor(null)
                  }}
                  className="w-full px-2 py-1.5 text-xs border border-[#E0E0E0] rounded"
                >
                  {GRID_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* 정확한 수량 토글 */}
            <label className="flex items-center gap-2 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formHasExactAmount}
                onChange={(e) => setFormHasExactAmount(e.target.checked)}
                className="rounded border-[#E0E0E0]"
              />
              <span className="text-[10px] text-[#757575]">정확한 수량 필요</span>
            </label>

            {/* 표시 색상 */}
            <div className="mb-2">
              <label className="block text-[10px] text-[#757575] mb-1">표시 색상</label>
              <div className="flex gap-1 flex-wrap">
                {DECO_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormDisplayColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      formDisplayColor === c ? 'border-[#333] scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* 위치 안내 */}
            <div className="text-[10px] text-[#757575] mb-2">
              {formMasterId
                ? formAnchor
                  ? `위치 선택됨: 셀 ${formAnchor}`
                  : '위 그리드에서 배치할 위치를 클릭하세요'
                : '재료를 먼저 선택하세요'
              }
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleAddDecoItem}
                disabled={!formMasterId || !formAnchor}
                className="flex-1 py-1.5 text-xs text-white bg-blue-600 rounded-lg disabled:opacity-40 hover:bg-blue-700 transition"
              >
                {editingItem ? '수정' : '추가'}
              </button>
              {editingItem && (
                <button
                  onClick={() => handleDeleteDecoItem((editingItem as LocalDecoItem).storage_location_id, editingItem.localId)}
                  className="px-3 py-1.5 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600 transition"
                >
                  삭제
                </button>
              )}
              <button
                onClick={closeForm}
                className="px-3 py-1.5 text-xs text-[#757575] border border-[#E0E0E0] rounded-lg hover:bg-gray-50 transition"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- 2×2 구역+층 뷰 (FRIDGE_4BOX / FREEZER 공통) ----------

  const renderZoneFloorView = (parentType: string, codePrefix: string) => {
    const zones = ['LT', 'RT', 'LB', 'RB']
    const num = extractEquipmentNumber(equipmentKey)

    return (
      <div className="grid grid-cols-2 gap-3">
        {zones.map(zone => {
          const currentParent = locations.find(l =>
            l.location_type === parentType && l.location_code === `${codePrefix}_${num}_${zone}`
          )
          const selectedFloor = zoneFloors[zone] ?? 1
          const currentFloor = currentParent
            ? locations.find(l =>
                l.location_type === 'FRIDGE_FLOOR' &&
                l.parent_location_id === currentParent.id &&
                l.location_code === `${currentParent.location_code}_F${selectedFloor}`
              )
            : null

          return (
            <div key={zone}>
              <div className="flex gap-1 mb-1">
                {[1, 2].map(f => (
                  <button
                    key={f}
                    onClick={() => setZoneFloors(prev => ({ ...prev, [zone]: f }))}
                    className={`px-2 py-1 text-[10px] rounded border transition ${
                      selectedFloor === f
                        ? 'bg-blue-100 border-blue-300 text-blue-700 font-bold'
                        : 'border-[#E0E0E0] text-[#757575] hover:bg-gray-50'
                    }`}
                  >
                    {f}층
                  </button>
                ))}
              </div>
              {currentFloor ? renderGrid(currentFloor) : (
                <div className="border border-[#E0E0E0] rounded-lg p-3 bg-white text-xs text-[#9E9E9E] py-4 text-center">층 정보 없음</div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ---------- 장비 타입별 내부 뷰 ----------

  const renderContent = () => {
    if (loading) {
      return <div className="flex items-center justify-center py-12 text-[#757575]">로딩 중...</div>
    }

    switch (equipmentType) {
      case 'DRAWER_FRIDGE': {
        const drawers = locations.filter(l => l.location_type === 'DRAWER')
        return (
          <div className="grid grid-cols-2 gap-3">
            {drawers.map(loc => renderGrid(loc))}
          </div>
        )
      }

      case 'FRIDGE_4BOX':
        return renderZoneFloorView('FRIDGE', 'FRIDGE')

      case 'FREEZER':
        return renderZoneFloorView('FREEZER', 'FREEZER')

      case 'PREP_TABLE': {
        const loc = locations.find(l => l.location_type === 'DECO_ZONE')
        return loc ? renderDecoGrid(loc) : (
          <div className="text-xs text-[#9E9E9E] py-4 text-center">저장 공간 없음</div>
        )
      }

      case 'SEASONING_COUNTER': {
        const loc = locations.find(l => l.location_type !== 'FRIDGE' && l.location_type !== 'FRIDGE_FLOOR')
        return loc ? renderGrid(loc) : (
          <div className="text-xs text-[#9E9E9E] py-4 text-center">저장 공간 없음</div>
        )
      }

      default:
        return <div className="text-xs text-[#9E9E9E] py-4 text-center">지원되지 않는 장비 타입</div>
    }
  }

  // ---------- 렌더 ----------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#F7F7F7] rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E0E0E0] bg-white rounded-t-xl">
          <h2 className="text-sm font-bold text-[#333]">
            {isPrepTable ? '상시배치 재료대' : `${equipmentName} — 식자재 배치`}
          </h2>
          <button onClick={handleClose} className="text-[#9E9E9E] hover:text-[#333] text-lg">×</button>
        </div>

        {/* 토스트 */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mx-5 mt-2 px-3 py-1.5 rounded-lg text-xs text-white ${
                toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
              }`}
            >
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#E0E0E0] bg-white rounded-b-xl">
          <span className="text-[10px] text-[#9E9E9E]">
            {dirty && '변경사항 있음'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-[#757575] border border-[#E0E0E0] rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* 새 재료 등록 서브모달 */}
      {showMasterModal && (
        <IngredientMasterModal
          onCreated={(master) => {
            setMasters(prev => [...prev, master])
            setFormMasterId(master.id)
            setShowMasterModal(false)
          }}
          onClose={() => setShowMasterModal(false)}
        />
      )}
    </div>
  )
}

export { STORABLE_TYPES }

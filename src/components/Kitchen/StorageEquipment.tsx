import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { IngredientInventory } from '../../types/database.types'
import type { EquipmentComponentProps } from './PlaceholderEquipment'
import GridPopup from '../GridPopup'

interface GridPopupState {
  title: string
  gridRows: number
  gridCols: number
  ingredients: Array<{
    id: string
    name: string
    amount: number
    unit: string
    gridPositions: string
    gridSize: string
    sku: string
    raw: IngredientInventory
  }>
}

/**
 * StorageEquipment - CSS Grid 기반 저장소 컴포넌트
 * DRAWER_FRIDGE와 FRIDGE_4BOX를 하나의 컴포넌트로 통합
 * storageLocationIds와 storageCache를 사용하여 동적으로 재료 표시
 */
export default function StorageEquipment({
  equipmentKey: _equipmentKey,
  equipmentType,
  displayName,
  config,
  storageLocationIds,
}: EquipmentComponentProps) {
  const { storageCache, onIngredientSelected, onMultipleIngredientsSelected } = useGameStore()

  const [isOpen, setIsOpen] = useState(false)
  const [selectedBox, setSelectedBox] = useState<string | null>(null)
  const [gridPopup, setGridPopup] = useState<GridPopupState | null>(null)

  // 서랍/냉장고 칸 레이블 생성
  const getBoxLabel = (index: number, _locationId: string): string => {
    // v3.1: DRAWER_FRIDGE와 FREEZER(서랍형태)는 동일하게 처리
    if (equipmentType === 'DRAWER_FRIDGE' || equipmentType === 'FREEZER') {
      const labels = ['좌상', '우상', '좌하', '우하']
      return labels[index] ?? `칸${index + 1}`
    }
    // FRIDGE_4BOX
    const labels = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래']
    return labels[index] ?? `박스${index + 1}`
  }

  // v3.1: 장비 형태 판별 (서랍형 vs 4호박스형)
  const isDrawerType = equipmentType === 'DRAWER_FRIDGE' || equipmentType === 'FREEZER'
  // is4BoxType은 필요 시 equipmentType === 'FRIDGE_4BOX'로 직접 체크

  // 서랍 클릭 (DRAWER_FRIDGE, FREEZER)
  const handleDrawerClick = (locationId: string) => {
    console.log(`📦 handleDrawerClick: locationId=${locationId}, storageCache keys:`, Object.keys(storageCache))
    const cachedData = storageCache[locationId]

    if (!cachedData) {
      console.warn(`📦 storageCache에 ${locationId} 없음. 전체 캐시:`, storageCache)
      alert(`이 ${equipmentType === 'FREEZER' ? '냉동고' : '서랍'}에 등록된 식자재가 없습니다. (${locationId})`)
      return
    }
    console.log(`📦 ${locationId} 데이터 로드:`, cachedData.ingredients.length, '개 재료')

    setGridPopup({
      title: cachedData.title,
      gridRows: cachedData.gridRows,
      gridCols: cachedData.gridCols,
      ingredients: cachedData.ingredients.map((ing: any) => ({
        id: ing.id,
        name: ing.ingredient_master?.ingredient_name ?? ing.sku_full,
        amount: ing.standard_amount,
        unit: ing.standard_unit,
        gridPositions: ing.grid_positions ?? '1',
        gridSize: ing.grid_size ?? '1x1',
        sku: ing.sku_full,
        raw: ing,
      })),
    })
  }

  // 냉장고 층 선택 (FRIDGE_4BOX)
  const handleFloorSelect = (locationId: string, floor: number) => {
    const cacheKey = `${locationId}_F${floor}`
    const cachedData = storageCache[cacheKey]

    if (!cachedData) {
      alert('이 층에 등록된 식자재가 없습니다.')
      return
    }

    setGridPopup({
      title: cachedData.title,
      gridRows: cachedData.gridRows,
      gridCols: cachedData.gridCols,
      ingredients: cachedData.ingredients.map((ing: any) => ({
        id: ing.id,
        name: ing.ingredient_master?.ingredient_name ?? ing.sku_full,
        amount: ing.standard_amount,
        unit: ing.standard_unit,
        gridPositions: ing.grid_positions ?? '1',
        gridSize: ing.grid_size ?? '1x1',
        sku: ing.sku_full,
        raw: ing,
      })),
    })
  }

  // 재료 선택 핸들러
  const handleSelectIngredient = (ing: any) => {
    console.log('📦 [StorageEquipment] handleSelectIngredient:', ing.name, '| callback:', !!onIngredientSelected)
    if (onIngredientSelected) {
      onIngredientSelected(ing.raw)
    } else {
      console.error('❌ onIngredientSelected 콜백이 null!')
    }
    setGridPopup(null)
    setSelectedBox(null)
    setIsOpen(false)
  }

  // 다중 선택 핸들러
  const handleSelectMultiple = (selectedIngs: any[]) => {
    console.log('📦 [StorageEquipment] handleSelectMultiple:', selectedIngs.length, '개 | callback:', !!onMultipleIngredientsSelected)
    if (onMultipleIngredientsSelected) {
      onMultipleIngredientsSelected(selectedIngs)
    } else {
      console.error('❌ onMultipleIngredientsSelected 콜백이 null!')
    }
    setGridPopup(null)
    setSelectedBox(null)
    setIsOpen(false)
  }

  // config에서 has_floor_2 확인 (기본값 true)
  const hasFloor2 = config?.has_floor_2 !== false

  // 그리드 레이아웃 파싱 (문자열 "2x2" 또는 객체 {rows, cols} 지원)
  const parseGridLayout = (): { rows: number; cols: number } => {
    const layout = config?.drawer_layout
    if (!layout) return { rows: 2, cols: 2 }

    // 이미 객체인 경우 (타입 가드 추가)
    if (typeof layout === 'object' && 'rows' in layout && 'cols' in layout) {
      const layoutObj = layout as { rows: number; cols: number }
      return { rows: layoutObj.rows, cols: layoutObj.cols }
    }

    // 문자열 "2x2" 형식인 경우
    if (typeof layout === 'string') {
      const match = layout.match(/(\d+)x(\d+)/i)
      if (match) {
        return { rows: parseInt(match[1], 10), cols: parseInt(match[2], 10) }
      }
    }

    return { rows: 2, cols: 2 }
  }
  const gridLayout = parseGridLayout()

  return (
    <>
      {/* 장비 블록 (클릭하여 팝업 열기) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full h-full bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all p-1 lg:p-2 flex flex-col items-center justify-center cursor-pointer"
      >
        <div className="text-2xl lg:text-3xl mb-1">
          {equipmentType === 'FREEZER' ? '🧊' : equipmentType === 'DRAWER_FRIDGE' ? '🗄️' : '❄️'}
        </div>
        <div className={`text-[9px] lg:text-xs font-bold text-center ${
          equipmentType === 'FREEZER' ? 'text-blue-700' : 'text-gray-700'
        }`}>
          {displayName}
        </div>
      </button>

      {/* 팝업 오버레이 - Portal로 body에 렌더링 (transform 컨테이너 밖으로) */}
      {createPortal(
        <AnimatePresence>
          {isOpen && !gridPopup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
              onClick={() => {
                setIsOpen(false)
                setSelectedBox(null)
              }}
            >
              {/* 나가기 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsOpen(false)
                  setSelectedBox(null)
                }}
                className="absolute top-4 right-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-gray-700 rounded-lg transition shadow-lg z-10 text-sm"
              >
                ✕ 닫기
              </button>

              {/* 내부 구조 */}
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="p-4"
              >
                <div className="text-center text-white font-bold text-lg mb-4">
                  {displayName}
                </div>

                {/* 2×2 그리드 */}
                <div
                  className="grid gap-3 lg:gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
                  }}
                >
                  {storageLocationIds.map((locationId, index) => {
                    const isSelected = selectedBox === locationId
                    const label = getBoxLabel(index, locationId)

                    return (
                      <div key={locationId} className="relative w-40 h-32 lg:w-52 lg:h-40">
                        {isDrawerType ? (
                          // 서랍형 (DRAWER_FRIDGE, FREEZER): 바로 GridPopup 열기
                          <button
                            onClick={() => handleDrawerClick(locationId)}
                            className="w-full h-full bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all font-bold text-sm flex flex-col items-center justify-center gap-2 text-gray-700"
                          >
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                            <div className="text-sm font-bold">{label}</div>
                          </button>
                        ) : !isSelected ? (
                          // 4호박스: 칸 선택
                          <button
                            onClick={() => setSelectedBox(locationId)}
                            className="w-full h-full bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all text-gray-700 font-bold flex items-center justify-center"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-2xl">❄️</div>
                              <div className="text-sm">{label}</div>
                            </div>
                          </button>
                        ) : (
                          // 4호박스: 층 선택 UI
                          <div className="w-full h-full rounded-xl bg-white border border-gray-200 flex flex-col items-center justify-center gap-2 p-3 shadow-sm">
                            <div className="text-xs font-bold text-gray-800">{label}</div>

                            <button
                              onClick={() => handleFloorSelect(locationId, 1)}
                              className="w-full py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 rounded-lg shadow-sm font-bold transition text-xs"
                            >
                              1️⃣ 1층
                            </button>

                            {hasFloor2 && (
                              <button
                                onClick={() => handleFloorSelect(locationId, 2)}
                                className="w-full py-2 bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 rounded-lg shadow-sm font-bold transition text-xs"
                              >
                                2️⃣ 2층
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedBox(null)}
                              className="mt-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-gray-700 rounded-lg text-[10px] transition"
                            >
                              취소
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* GridPopup - Portal로 body에 렌더링 */}
      {gridPopup && createPortal(
        <>
          {/* 뒤로 버튼 */}
          <button
            onClick={() => {
              setGridPopup(null)
              if (equipmentType === 'FRIDGE_4BOX') {
                setSelectedBox(null)
              }
            }}
            className="fixed top-4 left-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-gray-700 rounded-lg transition shadow-lg z-[60] text-sm"
          >
            ← 뒤로
          </button>

          {/* 닫기 버튼 */}
          <button
            onClick={() => {
              setGridPopup(null)
              setSelectedBox(null)
              setIsOpen(false)
            }}
            className="fixed top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg z-[60] text-sm"
          >
            ✕ 닫기
          </button>

          <GridPopup
            title={gridPopup.title}
            gridRows={gridPopup.gridRows}
            gridCols={gridPopup.gridCols}
            ingredients={gridPopup.ingredients}
            enableMultiSelect={true}
            onSelect={handleSelectIngredient}
            onSelectMultiple={handleSelectMultiple}
            onClose={() => {
              setGridPopup(null)
              if (equipmentType === 'FRIDGE_4BOX') {
                setSelectedBox(null)
              }
            }}
          />
        </>,
        document.body
      )}
    </>
  )
}

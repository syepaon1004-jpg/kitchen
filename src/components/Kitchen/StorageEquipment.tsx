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
    if (equipmentType === 'DRAWER_FRIDGE') {
      const labels = ['좌상', '우상', '좌하', '우하']
      return labels[index] ?? `칸${index + 1}`
    }
    // FRIDGE_4BOX
    const labels = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래']
    return labels[index] ?? `박스${index + 1}`
  }

  // 서랍 클릭 (DRAWER_FRIDGE)
  const handleDrawerClick = (locationId: string) => {
    const cachedData = storageCache[locationId]

    if (!cachedData) {
      alert('이 서랍에 등록된 식자재가 없습니다.')
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
    if (onIngredientSelected) {
      onIngredientSelected(ing.raw)
    }
    setGridPopup(null)
    setSelectedBox(null)
    setIsOpen(false)
  }

  // 다중 선택 핸들러
  const handleSelectMultiple = (selectedIngs: any[]) => {
    if (onMultipleIngredientsSelected) {
      onMultipleIngredientsSelected(selectedIngs)
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
        className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 rounded-lg p-1 lg:p-2 flex flex-col items-center justify-center cursor-pointer hover:shadow-lg transition-all border border-gray-300"
        style={{
          backgroundImage: `
            linear-gradient(135deg,
              rgba(255,255,255,0.8) 0%,
              rgba(200,200,200,0.3) 50%,
              rgba(255,255,255,0.8) 100%)
          `,
          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.9), 0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <div className="text-2xl lg:text-3xl mb-1">
          {equipmentType === 'DRAWER_FRIDGE' ? '🗄️' : '❄️'}
        </div>
        <div className="text-[9px] lg:text-xs font-bold text-gray-700 text-center">
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
                className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg z-10 text-sm"
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
                        {equipmentType === 'DRAWER_FRIDGE' ? (
                          // 서랍냉장고: 바로 GridPopup 열기
                          <button
                            onClick={() => handleDrawerClick(locationId)}
                            className="w-full h-full rounded-lg bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 shadow-lg border-2 border-gray-300 text-gray-700 font-bold text-sm flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform"
                            style={{
                              backgroundImage: `
                                linear-gradient(135deg,
                                  rgba(255,255,255,0.9) 0%,
                                  rgba(220,220,220,0.5) 50%,
                                  rgba(255,255,255,0.9) 100%)
                              `,
                              boxShadow: 'inset 0 2px 4px rgba(255,255,255,1), 0 4px 8px rgba(0,0,0,0.15)',
                            }}
                          >
                            <div className="w-12 h-1.5 bg-gray-400 rounded-full shadow-md" />
                            <div className="text-sm font-bold">{label}</div>
                          </button>
                        ) : !isSelected ? (
                          // 4호박스: 칸 선택
                          <button
                            onClick={() => setSelectedBox(locationId)}
                            className="w-full h-full rounded-lg bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 shadow-lg border-2 border-gray-300 text-gray-700 font-bold flex items-center justify-center hover:scale-105 transition-transform"
                            style={{
                              backgroundImage: `
                                linear-gradient(135deg,
                                  rgba(255,255,255,0.9) 0%,
                                  rgba(220,220,220,0.5) 50%,
                                  rgba(255,255,255,0.9) 100%)
                              `,
                              boxShadow: 'inset 0 2px 4px rgba(255,255,255,1), 0 4px 8px rgba(0,0,0,0.2)',
                            }}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-2xl">❄️</div>
                              <div className="text-sm">{label}</div>
                            </div>
                          </button>
                        ) : (
                          // 4호박스: 층 선택 UI
                          <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 flex flex-col items-center justify-center gap-2 p-3 shadow-lg">
                            <div className="text-xs font-bold text-gray-800">{label}</div>

                            <button
                              onClick={() => handleFloorSelect(locationId, 1)}
                              className="w-full py-2 rounded-lg bg-white border-2 border-blue-400 text-blue-700 font-bold hover:bg-blue-50 transition shadow-md text-xs"
                            >
                              1️⃣ 1층
                            </button>

                            {hasFloor2 && (
                              <button
                                onClick={() => handleFloorSelect(locationId, 2)}
                                className="w-full py-2 rounded-lg bg-white border-2 border-blue-400 text-blue-700 font-bold hover:bg-blue-50 transition shadow-md text-xs"
                              >
                                2️⃣ 2층
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedBox(null)}
                              className="mt-1 px-3 py-1 rounded bg-gray-300 text-gray-700 text-[10px] hover:bg-gray-400 transition shadow-md"
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
            className="fixed top-4 left-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition shadow-lg z-[60] text-sm"
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

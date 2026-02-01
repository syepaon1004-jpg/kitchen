import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import type { IngredientInventory } from '../../types/database.types'
import GridPopup from '../GridPopup'

const FRIDGE_POSITIONS = [
  { code: 'FRIDGE_LT', label: '왼쪽 위', row: 0, col: 0 },
  { code: 'FRIDGE_RT', label: '오른쪽 위', row: 0, col: 1 },
  { code: 'FRIDGE_LB', label: '왼쪽 아래', row: 1, col: 0 },
  { code: 'FRIDGE_RB', label: '오른쪽 아래', row: 1, col: 1 },
]

interface Props {
  onSelectIngredient: (ingredient: IngredientInventory) => void
  onSelectMultiple?: (ingredients: any[]) => void
}

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

export default function FridgeZoomView({ onSelectIngredient, onSelectMultiple }: Props) {
  const {
    fridgeViewState,
    closeFridgeView,
    storageCache,
  } = useGameStore()

  const [selectedBox, setSelectedBox] = useState<string | null>(null)
  const [gridPopup, setGridPopup] = useState<GridPopupState | null>(null)

  const showFloorData = (fridgeCode: string, floor: number) => {
    const cacheKey = `${fridgeCode}_F${floor}`
    const cachedData = storageCache[cacheKey]

    if (!cachedData) {
      alert('이 층에 등록된 식자재가 없습니다.')
      return
    }

    setGridPopup({
      title: cachedData.title,
      gridRows: cachedData.gridRows,
      gridCols: cachedData.gridCols,
      ingredients: cachedData.ingredients.map((ing: IngredientInventory) => ({
        id: ing.id,
        name: (ing.ingredient_master as any)?.ingredient_name ?? ing.sku_full,
        amount: ing.standard_amount,
        unit: ing.standard_unit,
        gridPositions: ing.grid_positions ?? '1',
        gridSize: ing.grid_size ?? '1x1',
        sku: ing.sku_full,
        raw: ing,
      })),
    })

    useGameStore.setState({ fridgeViewState: 'GRID_VIEW' })
  }

  // ZOOMED 상태: 2x2 그리드에서 칸 선택
  if (fridgeViewState === 'ZOOMED') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        {/* 나가기 버튼 */}
        <button
          onClick={closeFridgeView}
          className="absolute top-2 lg:top-4 right-2 lg:right-4 px-3 lg:px-4 py-1.5 lg:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg z-10 text-xs lg:text-base"
        >
          🏠 냉장고 나가기
        </button>

        {/* 2x2 냉장고 칸들 */}
        <div className="grid grid-cols-2 gap-4 lg:gap-8 scale-75 lg:scale-150">
          {FRIDGE_POSITIONS.map((pos) => {
            const isSelected = selectedBox === pos.code

            return (
              <div
                key={pos.code}
                className="relative w-64 h-48 lg:w-64 lg:h-48"
              >
                {!isSelected ? (
                  <button
                    onClick={() => setSelectedBox(pos.code)}
                    className="w-full h-full rounded-lg bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 shadow-2xl border-4 border-gray-300 text-gray-700 font-bold text-xl flex items-center justify-center hover:scale-105 transition-transform"
                    style={{
                      backgroundImage: `
                        linear-gradient(135deg, 
                          rgba(255,255,255,0.9) 0%, 
                          rgba(220,220,220,0.5) 50%, 
                          rgba(255,255,255,0.9) 100%)
                      `,
                      boxShadow: 'inset 0 2px 6px rgba(255,255,255,1), 0 8px 20px rgba(0,0,0,0.3)'
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-2xl lg:text-3xl">❄️</div>
                      <div className="text-sm lg:text-base">{pos.label}</div>
                    </div>
                  </button>
                ) : (
                  <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border-4 border-blue-300 flex flex-col items-center justify-center gap-2 lg:gap-3 p-3 lg:p-4 shadow-2xl">
                    <div className="text-xs lg:text-sm font-bold text-gray-800 mb-1">{pos.label}</div>
                    
                    <button
                      onClick={() => showFloorData(pos.code, 1)}
                      className="w-full py-2 lg:py-3 rounded-lg bg-white border-2 border-blue-400 text-blue-700 font-bold hover:bg-blue-50 transition shadow-md text-xs lg:text-sm"
                    >
                      1️⃣ 1층
                    </button>
                    
                    <button
                      onClick={() => showFloorData(pos.code, 2)}
                      className="w-full py-2 lg:py-3 rounded-lg bg-white border-2 border-blue-400 text-blue-700 font-bold hover:bg-blue-50 transition shadow-md text-xs lg:text-sm"
                    >
                      2️⃣ 2층
                    </button>

                    <button
                      onClick={() => setSelectedBox(null)}
                      className="mt-1 lg:mt-2 px-3 lg:px-4 py-1 rounded bg-gray-300 text-gray-700 text-[10px] lg:text-xs hover:bg-gray-400 transition shadow-md"
                    >
                      닫기
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // GRID_VIEW: 층 선택 후 GridPopup
  if (fridgeViewState === 'GRID_VIEW' && gridPopup) {
    return (
      <>
        {/* 뒤로 버튼 (GridPopup 위에 표시) */}
        <button
          onClick={() => {
            setGridPopup(null)
            setSelectedBox(null)
            useGameStore.setState({ fridgeViewState: 'ZOOMED' })
          }}
          className="fixed top-4 left-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition shadow-lg z-[60]"
        >
          ← 뒤로
        </button>

        {/* 나가기 버튼 */}
        <button
          onClick={() => {
            setGridPopup(null)
            setSelectedBox(null)
            closeFridgeView()
          }}
          className="fixed top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition shadow-lg z-[60]"
        >
          🏠 냉장고 나가기
        </button>

        <GridPopup
          title={gridPopup.title}
          gridRows={gridPopup.gridRows}
          gridCols={gridPopup.gridCols}
          ingredients={gridPopup.ingredients}
          enableMultiSelect={true}
          onSelect={(ing) => {
            onSelectIngredient(ing.raw)
            setGridPopup(null)
            setSelectedBox(null)
            closeFridgeView()
          }}
          onSelectMultiple={(selectedIngs) => {
            if (onSelectMultiple) {
              onSelectMultiple(selectedIngs)
            }
            setGridPopup(null)
            setSelectedBox(null)
            closeFridgeView()
          }}
          onClose={() => {
            setGridPopup(null)
            useGameStore.setState({ fridgeViewState: 'ZOOMED' })
          }}
        />
      </>
    )
  }

  return null
}

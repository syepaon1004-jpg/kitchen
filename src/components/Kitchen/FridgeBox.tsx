import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../stores/gameStore'
import type { IngredientInventory } from '../../types/database.types'
import GridPopup from '../GridPopup'

const FRIDGE_CODES = ['FRIDGE_LT', 'FRIDGE_RT', 'FRIDGE_LB', 'FRIDGE_RB']

interface FridgeBoxProps {
  onSelectIngredient: (ingredient: IngredientInventory) => void
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

export default function FridgeBox({ onSelectIngredient }: FridgeBoxProps) {
  const currentStore = useGameStore((s) => s.currentStore)
  const [selectedBox, setSelectedBox] = useState<string | null>(null)
  const [doorOpen, setDoorOpen] = useState(false)
  const [gridPopup, setGridPopup] = useState<GridPopupState | null>(null)

  const handleBoxClick = (fridgeCode: string) => {
    setSelectedBox(fridgeCode)
  }

  const handleFloorClick = async (fridgeCode: string, floor: number) => {
    if (!currentStore) return

    const floorLocationCode = `${fridgeCode}_F${floor}`

    // 해당 층의 그리드 설정 및 식자재 가져오기
    const { data: location } = await supabase
      .from('storage_locations')
      .select('*')
      .eq('location_code', floorLocationCode)
      .eq('store_id', currentStore.id)
      .single()

    if (!location) {
      alert(`${floorLocationCode} 위치를 찾을 수 없습니다.`)
      return
    }

    const { data: ingredients } = await supabase
      .from('ingredients_inventory')
      .select('*, ingredient_master:ingredients_master(*)')
      .eq('storage_location_id', location.id)
      .not('grid_positions', 'is', null)

    if (!ingredients || ingredients.length === 0) {
      alert('이 층에 등록된 식자재가 없습니다.')
      return
    }

    // GridPopup 표시
    setGridPopup({
      title: `${location.location_name ?? floorLocationCode}`,
      gridRows: (location as any).grid_rows ?? 3,
      gridCols: (location as any).grid_cols ?? 2,
      ingredients: ingredients.map((ing: any) => ({
        id: ing.id,
        name: ing.ingredient_master?.ingredient_name ?? ing.sku_full,
        amount: ing.standard_amount,
        unit: ing.standard_unit,
        gridPositions: ing.grid_positions ?? '1',
        gridSize: ing.grid_size ?? '1x1',
        sku: ing.sku_full,
        raw: ing as IngredientInventory,
      })),
    })
  }

  const handleCloseFridge = () => {
    setDoorOpen(false)
    setTimeout(() => setSelectedBox(null), 300)
  }

  const labels: Record<string, string> = {
    FRIDGE_LT: '왼쪽 위',
    FRIDGE_RT: '오른쪽 위',
    FRIDGE_LB: '왼쪽 아래',
    FRIDGE_RB: '오른쪽 아래',
  }

  return (
    <>
      <div className="w-full max-w-[360px]">
        <h3 className="text-sm font-semibold text-[#333] mb-2">4호박스 냉장고</h3>
        <div className="grid grid-cols-2 gap-4">
          {FRIDGE_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleBoxClick(code)}
              className="w-40 h-32 bg-gradient-to-br from-gray-300 to-gray-500 rounded-lg shadow-md hover:shadow-lg border-2 border-gray-600 text-white font-medium text-sm transition flex items-center justify-center"
            >
              {labels[code]}
            </button>
          ))}
        </div>
      </div>

      {/* 4호박스 확대 모달 */}
      <AnimatePresence>
        {selectedBox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={handleCloseFridge}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
              {/* 냉장고 본체 */}
              <div className="w-[500px] h-[600px] bg-gradient-to-br from-gray-200 to-gray-400 rounded-2xl border-4 border-gray-600 shadow-2xl relative overflow-hidden">
                {/* 냉장고 문 */}
                <motion.div
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: doorOpen ? -120 : 0 }}
                  transition={{ duration: 0.5 }}
                  style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
                  className="absolute inset-0 bg-gradient-to-br from-slate-300 to-slate-500 border-r-4 border-slate-600 cursor-pointer flex items-center justify-center"
                  onClick={() => setDoorOpen(!doorOpen)}
                >
                  {!doorOpen && (
                    <div className="text-center">
                      <div className="text-6xl mb-4">🚪</div>
                      <div className="font-bold text-white text-xl">{labels[selectedBox]}</div>
                      <div className="text-sm text-white/80 mt-2">클릭하여 문 열기</div>
                    </div>
                  )}
                </motion.div>

                {/* 냉장고 내부 (문 열렸을 때) */}
                {doorOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute inset-0 bg-gradient-to-b from-blue-100 to-blue-200 p-8 flex flex-col items-center justify-center"
                  >
                    <h3 className="text-2xl font-bold text-[#333] mb-6">층 선택</h3>
                    <div className="flex flex-col gap-4">
                      <button
                        type="button"
                        onClick={() => handleFloorClick(selectedBox, 1)}
                        className="px-8 py-4 rounded-xl bg-white border-2 border-blue-400 hover:bg-blue-50 font-bold text-lg shadow-lg transition"
                      >
                        1️⃣ 1층
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFloorClick(selectedBox, 2)}
                        className="px-8 py-4 rounded-xl bg-white border-2 border-blue-400 hover:bg-blue-50 font-bold text-lg shadow-lg transition"
                      >
                        2️⃣ 2층
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseFridge}
                      className="mt-6 px-6 py-2 rounded-lg bg-gray-500 text-white hover:bg-gray-600"
                    >
                      닫기
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 그리드 팝업 (층 선택 후) */}
      {gridPopup && (
        <GridPopup
          title={gridPopup.title}
          gridRows={gridPopup.gridRows}
          gridCols={gridPopup.gridCols}
          ingredients={gridPopup.ingredients}
          onSelect={(ing) => {
            onSelectIngredient(ing.raw)
            setGridPopup(null)
          }}
          onClose={() => setGridPopup(null)}
        />
      )}
    </>
  )
}

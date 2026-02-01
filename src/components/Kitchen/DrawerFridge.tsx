import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../stores/gameStore'
import type { IngredientInventory } from '../../types/database.types'
import GridPopup from '../GridPopup'

const DRAWER_CODES = ['DRAWER_LT', 'DRAWER_RT', 'DRAWER_LB', 'DRAWER_RB']

interface DrawerFridgeProps {
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

export default function DrawerFridge({ onSelectIngredient }: DrawerFridgeProps) {
  const currentStore = useGameStore((s) => s.currentStore)
  const [gridPopup, setGridPopup] = useState<GridPopupState | null>(null)

  const handleDrawerClick = async (drawerCode: string) => {
    if (!currentStore) return

    // 1. 해당 서랍의 그리드 설정 가져오기
    const { data: location } = await supabase
      .from('storage_locations')
      .select('*')
      .eq('location_code', drawerCode)
      .eq('store_id', currentStore.id)
      .single()

    if (!location) {
      console.error('서랍 위치를 찾을 수 없습니다:', drawerCode)
      return
    }

    // 2. 해당 서랍의 식자재 가져오기
    const { data: ingredients } = await supabase
      .from('ingredients_inventory')
      .select('*, ingredient_master:ingredients_master(*)')
      .eq('storage_location_id', location.id)
      .not('grid_positions', 'is', null)

    if (!ingredients || ingredients.length === 0) {
      console.warn('이 서랍에 등록된 식자재가 없습니다.')
      // fallback: section_code 방식으로 보여주기
      setGridPopup(null)
      return
    }

    // 3. GridPopup 표시
    setGridPopup({
      title: location.location_name ?? drawerCode,
      gridRows: (location as any).grid_rows ?? 4,
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

  const labels: Record<string, string> = {
    DRAWER_LT: '왼쪽 위',
    DRAWER_RT: '오른쪽 위',
    DRAWER_LB: '왼쪽 아래',
    DRAWER_RB: '오른쪽 아래',
  }

  return (
    <>
      <div className="w-full max-w-[360px] mb-8">
        <h3 className="text-sm font-semibold text-[#333] mb-2">서랍 냉장고 (화구 아래)</h3>
        <div className="grid grid-cols-2 gap-4">
          {DRAWER_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleDrawerClick(code)}
              className="w-40 h-[120px] rounded-lg bg-gradient-to-br from-blue-400 to-slate-500 shadow-md hover:shadow-lg border-2 border-slate-600 text-white font-medium text-sm transition flex items-center justify-center"
            >
              {labels[code] ?? code.replace('DRAWER_', '')}
            </button>
          ))}
        </div>
      </div>

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

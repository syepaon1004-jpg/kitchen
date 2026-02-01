import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import type { IngredientInventory } from '../../types/database.types'
import GridPopup from '../GridPopup'

const DRAWER_CODES = ['DRAWER_LT', 'DRAWER_RT', 'DRAWER_LB', 'DRAWER_RB']

interface DrawerFridgeProps {
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

export default function DrawerFridge({ onSelectIngredient, onSelectMultiple }: DrawerFridgeProps) {
  const storageCache = useGameStore((s) => s.storageCache)
  const [gridPopup, setGridPopup] = useState<GridPopupState | null>(null)

  const handleDrawerClick = (drawerCode: string) => {
    const cachedData = storageCache[drawerCode]

    if (!cachedData) {
      alert('이 서랍에 등록된 식자재가 없습니다.')
      return
    }

    // GridPopup 표시
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

  const labels: Record<string, string> = {
    DRAWER_LT: '좌상',
    DRAWER_RT: '우상',
    DRAWER_LB: '좌하',
    DRAWER_RB: '우하',
  }

  return (
    <>
      <div className="w-full px-16">
        <div className="grid grid-cols-2 gap-4 p-6 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 border-2 border-gray-300 rounded-xl shadow-xl"
             style={{
               backgroundImage: `
                 linear-gradient(135deg, 
                   rgba(255,255,255,0.8) 0%, 
                   rgba(200,200,200,0.3) 50%, 
                   rgba(255,255,255,0.8) 100%)
               `,
               boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.9), 0 8px 20px rgba(0,0,0,0.15)'
             }}>
          {DRAWER_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleDrawerClick(code)}
              className="w-full h-32 rounded-lg bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 shadow-md hover:shadow-xl border-2 border-gray-300 text-gray-700 font-bold text-sm transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden group"
              style={{
                backgroundImage: `
                  linear-gradient(135deg, 
                    rgba(255,255,255,0.9) 0%, 
                    rgba(220,220,220,0.5) 50%, 
                    rgba(255,255,255,0.9) 100%)
                `,
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,1), 0 4px 8px rgba(0,0,0,0.1)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="w-16 h-2 bg-gray-400 rounded-full shadow-md"
                     style={{
                       backgroundImage: 'linear-gradient(to right, rgba(150,150,150,0.8), rgba(180,180,180,0.8), rgba(150,150,150,0.8))'
                     }}></div>
                <div className="text-xs font-bold tracking-wide text-gray-700">{labels[code] ?? code.replace('DRAWER_', '')}</div>
              </div>
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
          enableMultiSelect={true}
          onSelect={(ing) => {
            onSelectIngredient(ing.raw)
            setGridPopup(null)
          }}
          onSelectMultiple={(selectedIngs) => {
            if (onSelectMultiple) {
              onSelectMultiple(selectedIngs)
            }
            setGridPopup(null)
          }}
          onClose={() => setGridPopup(null)}
        />
      )}
    </>
  )
}

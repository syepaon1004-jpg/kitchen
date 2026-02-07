import { useGameStore } from '../stores/gameStore'
import KitchenViewport from '../components/Kitchen/KitchenViewport'

export default function TestKitchen() {
  const { kitchenGrid, kitchenEquipment, currentStore } = useGameStore()

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Kitchen Renderer Test</h1>

      <div className="text-white mb-4">
        <p>Store: {currentStore?.store_name ?? 'None (먼저 매장 선택 필요)'}</p>
        <p>Grid: {kitchenGrid ? `${kitchenGrid.grid_cols}×${kitchenGrid.grid_rows} (${kitchenGrid.grid_name})` : 'None'}</p>
        <p>Equipment: {kitchenEquipment.length}개</p>
      </div>

      {kitchenGrid && kitchenEquipment.length > 0 ? (
        <div className="max-w-4xl">
          <KitchenViewport gridData={kitchenGrid} equipment={kitchenEquipment} />
        </div>
      ) : (
        <div className="text-yellow-400">
          <p>⚠️ kitchen_grids 데이터가 없습니다.</p>
          <p className="text-sm mt-2">
            1. 먼저 / 에서 매장을 선택하세요<br />
            2. 또는 DB에 kitchen_grids / kitchen_equipment 데이터를 추가하세요
          </p>
        </div>
      )}

      <div className="mt-4 text-gray-400 text-sm">
        <h3 className="font-bold mb-2">Equipment List:</h3>
        <ul className="space-y-1">
          {kitchenEquipment.map((eq) => (
            <li key={eq.id}>
              [{eq.equipment_type}] {eq.display_name} ({eq.equipment_key}) -
              pos: ({eq.grid_x}, {eq.grid_y}) size: {eq.grid_w}×{eq.grid_h}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

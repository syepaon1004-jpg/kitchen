import type { KitchenGrid, KitchenEquipment } from '../../types/database.types'
import { getEquipmentComponent } from './equipmentRegistry'

interface KitchenRendererProps {
  gridData: KitchenGrid
  equipment: KitchenEquipment[]
}

/**
 * CSS Grid 기반 주방 렌더러
 * kitchen_grids와 kitchen_equipment 데이터를 받아서 동적으로 주방을 렌더링
 * 모바일: 최소 셀 크기 48px × 48px (탭 타겟 기준)
 *
 * 모든 장비는 그리드 안에서 렌더링 (PREP_TABLE 포함)
 * DECO 모드 전환 시 GamePlay.tsx에서 fixed 오버레이로 별도 처리
 */
export default function KitchenRenderer({ gridData, equipment }: KitchenRendererProps) {
  return (
    <div
      className="w-full bg-gray-800 rounded-xl p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridData.grid_cols}, minmax(48px, 1fr))`,
        gridTemplateRows: `repeat(${gridData.grid_rows}, minmax(48px, 1fr))`,
        gap: '4px',
        aspectRatio: `${gridData.grid_cols} / ${gridData.grid_rows}`,
      }}
    >
      {equipment.map((eq) => {
        const Component = getEquipmentComponent(eq.equipment_type)

        return (
          <div
            key={eq.id}
            style={{
              gridColumn: `${eq.grid_x + 1} / span ${eq.grid_w}`,
              gridRow: `${eq.grid_y + 1} / span ${eq.grid_h}`,
            }}
          >
            <Component
              equipmentKey={eq.equipment_key}
              equipmentType={eq.equipment_type}
              displayName={eq.display_name}
              config={eq.equipment_config}
              storageLocationIds={eq.storage_location_ids}
              allEquipment={equipment}
              gridW={eq.grid_w}
              gridH={eq.grid_h}
            />
          </div>
        )
      })}
    </div>
  )
}

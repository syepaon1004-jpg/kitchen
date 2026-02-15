import type { EquipmentType, KitchenEquipment } from '../../types/database.types'

// 각 장비 컴포넌트의 공통 props
export interface EquipmentComponentProps {
  equipmentKey: string
  equipmentType: EquipmentType
  displayName: string
  config: Record<string, unknown>
  storageLocationIds: string[]
  allEquipment: KitchenEquipment[]
  gridW: number
  gridH: number
}

// 장비 타입별 이모지
const EQUIPMENT_EMOJI: Record<EquipmentType, string> = {
  BURNER: '🔥',
  SINK: '💧',
  DRAWER_FRIDGE: '🧊',
  FRIDGE_4BOX: '❄️',
  SEASONING_COUNTER: '🧂',
  FRYER: '🍟',
  PLATING_STATION: '🍽️',
  CUTTING_BOARD: '🔪',
  MICROWAVE: '📡',
  FREEZER: '🧊',
  TORCH: '🔦',
  COLD_TABLE: '🧊',
  PREP_TABLE: '🪵',
  WORKTABLE: '🪵',
  PASS: '📤',
  GRILL: '🥩',
}

// 장비 타입별 텍스트 색상 (라이트 테마)
const EQUIPMENT_TEXT_COLORS: Record<EquipmentType, string> = {
  BURNER: 'text-orange-600',
  SINK: 'text-blue-500',
  DRAWER_FRIDGE: 'text-cyan-600',
  FRIDGE_4BOX: 'text-cyan-700',
  SEASONING_COUNTER: 'text-amber-600',
  FRYER: 'text-amber-600',
  PLATING_STATION: 'text-purple-600',
  CUTTING_BOARD: 'text-lime-600',
  MICROWAVE: 'text-gray-600',
  FREEZER: 'text-blue-700',
  TORCH: 'text-red-500',
  COLD_TABLE: 'text-sky-600',
  PREP_TABLE: 'text-stone-500',
  WORKTABLE: 'text-stone-600',
  PASS: 'text-teal-600',
  GRILL: 'text-red-700',
}

export default function PlaceholderEquipment({
  equipmentType,
  displayName,
}: EquipmentComponentProps) {
  const emoji = EQUIPMENT_EMOJI[equipmentType] || '❓'
  const textColor = EQUIPMENT_TEXT_COLORS[equipmentType] || 'text-gray-500'

  return (
    <div
      className="bg-white w-full h-full flex flex-col items-center justify-center rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md cursor-pointer"
    >
      <span className="text-2xl md:text-3xl">{emoji}</span>
      <span className={`text-xs md:text-sm font-medium mt-1 text-center px-1 truncate max-w-full ${textColor}`}>
        {displayName}
      </span>
    </div>
  )
}

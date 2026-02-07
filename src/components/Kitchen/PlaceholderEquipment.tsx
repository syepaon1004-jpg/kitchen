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
  TORCH: '🔦',
  COLD_TABLE: '🧊',
  PREP_TABLE: '🪵',
  WORKTABLE: '🪵',
  PASS: '📤',
  GRILL: '🥩',
}

// 장비 타입별 배경색
const EQUIPMENT_COLORS: Record<EquipmentType, string> = {
  BURNER: 'bg-orange-600',
  SINK: 'bg-blue-500',
  DRAWER_FRIDGE: 'bg-cyan-600',
  FRIDGE_4BOX: 'bg-cyan-700',
  SEASONING_COUNTER: 'bg-amber-600',
  FRYER: 'bg-yellow-600',
  PLATING_STATION: 'bg-purple-600',
  CUTTING_BOARD: 'bg-lime-600',
  MICROWAVE: 'bg-gray-600',
  TORCH: 'bg-red-500',
  COLD_TABLE: 'bg-sky-600',
  PREP_TABLE: 'bg-stone-500',
  WORKTABLE: 'bg-stone-600',
  PASS: 'bg-teal-600',
  GRILL: 'bg-red-700',
}

export default function PlaceholderEquipment({
  equipmentKey,
  equipmentType,
  displayName,
}: EquipmentComponentProps) {
  const emoji = EQUIPMENT_EMOJI[equipmentType] || '❓'
  const bgColor = EQUIPMENT_COLORS[equipmentType] || 'bg-gray-500'

  return (
    <div
      className={`
        ${bgColor}
        w-full h-full
        flex flex-col items-center justify-center
        rounded-lg
        text-white
        border-2 border-white/20
        shadow-md
        transition-all
        hover:brightness-110
        cursor-pointer
      `}
    >
      <span className="text-2xl md:text-3xl">{emoji}</span>
      <span className="text-xs md:text-sm font-medium mt-1 text-center px-1 truncate max-w-full">
        {displayName}
      </span>
      <span className="text-[10px] opacity-60 truncate max-w-full">
        {equipmentKey}
      </span>
    </div>
  )
}

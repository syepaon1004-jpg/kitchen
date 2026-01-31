import { useGameStore } from '../../stores/gameStore'
import type { MenuOrder } from '../../types/database.types'

interface MenuQueueProps {
  onAssignToWok: (orderId: string, burnerNumber: number) => void
  selectedBurner: number | null
}

export default function MenuQueue({ onAssignToWok, selectedBurner }: MenuQueueProps) {
  const { menuQueue, woks } = useGameStore()
  const cleanWoks = woks.filter((w) => w.state === 'CLEAN' && !w.currentMenu)

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {menuQueue.length === 0 && (
        <p className="text-[#757575] text-sm py-2">메뉴가 곧 입장합니다...</p>
      )}
      {menuQueue.map((order, index) => (
        <MenuCard
          key={order.id}
          order={order}
          index={index}
          onAssign={(burnerNumber) => onAssignToWok(order.id, burnerNumber)}
          canAssign={order.status === 'WAITING' && cleanWoks.length > 0}
          selectedBurner={selectedBurner}
        />
      ))}
    </div>
  )
}

function MenuCard({
  order,
  index,
  onAssign,
  canAssign,
  selectedBurner,
}: {
  order: MenuOrder
  index: number
  onAssign: (burnerNumber: number) => void
  canAssign: boolean
  selectedBurner: number | null
}) {
  const statusClass =
    order.status === 'COMPLETED'
      ? 'bg-green-200 border-2 border-green-500'
      : order.status === 'COOKING'
        ? 'bg-orange-200 border-2 border-orange-500 animate-pulse'
        : 'bg-yellow-200 border-2 border-yellow-500'
  return (
    <div className={`w-40 min-w-[160px] p-4 rounded-lg shadow-lg ${statusClass} transition`}>
      <div className="font-bold text-sm text-[#333]">{order.menuName}</div>
      <div className="text-xs text-gray-600 mt-1">주문 {index + 1}</div>
      {order.status === 'WAITING' && canAssign && (
        <div className="flex gap-1 flex-wrap mt-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onAssign(n)}
              className={`py-1 px-2 rounded text-xs font-medium ${
                selectedBurner === n ? 'bg-primary text-white' : 'bg-white/80 text-[#333]'
              }`}
            >
              화구{n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

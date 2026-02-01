import { useGameStore } from '../../stores/gameStore'
import type { MenuOrder } from '../../types/database.types'
import { MENU_TIMER } from '../../types/database.types'
import { useEffect, useState } from 'react'

interface MenuQueueProps {
  onAssignToWok: (orderId: string, burnerNumber: number) => void
  selectedBurner: number | null
  onSelectMenu?: (menuId: string) => void
  selectedMenuId?: string | null
}

export default function MenuQueue({ onAssignToWok, selectedBurner, onSelectMenu, selectedMenuId }: MenuQueueProps) {
  const { menuQueue, woks, elapsedSeconds } = useGameStore()
  const cleanWoks = woks.filter((w) => w.state === 'CLEAN' && !w.currentMenu)

  return (
    <>
      {/* Desktop 버전 - 기존 스타일 유지 */}
      <div className="hidden lg:flex gap-4 overflow-x-auto pb-2">
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

      {/* Mobile 버전 - 간소화 (메뉴이름 + 타이머만) */}
      <div className="flex lg:hidden gap-2 overflow-x-auto pb-1">
        {menuQueue.length === 0 && (
          <p className="text-gray-500 text-xs py-1">메뉴 대기중...</p>
        )}
        {menuQueue.map((order) => {
          const elapsedTime = (elapsedSeconds - order.enteredAt) * 1000
          const minutes = Math.floor(elapsedTime / 60000)
          const seconds = Math.floor((elapsedTime % 60000) / 1000)
          
          // 시간에 따른 타이머 색상
          let timerClass = 'text-green-700'
          if (elapsedTime > MENU_TIMER.CRITICAL_TIME) {
            timerClass = 'text-red-700 font-bold animate-pulse'
          } else if (elapsedTime > MENU_TIMER.WARNING_TIME) {
            timerClass = 'text-orange-700 font-bold'
          } else if (elapsedTime > MENU_TIMER.TARGET_TIME) {
            timerClass = 'text-yellow-700'
          }
          
          const canSelect = order.status === 'WAITING' && cleanWoks.length > 0
          
          console.log('🍽️ 메뉴 상태:', {
            menuName: order.menuName,
            id: order.id,
            status: order.status,
            canSelect,
            cleanWoksCount: cleanWoks.length,
            isSelected: selectedMenuId === order.id
          })
          
          return (
            <button
              key={order.id}
              disabled={!canSelect}
              onClick={(e) => {
                e.stopPropagation() // 이벤트 전파 방지
                console.log('📱 메뉴 클릭:', order.menuName, 'ID:', order.id, 'canSelect:', canSelect)
                if (canSelect && onSelectMenu) {
                  console.log('✅ onSelectMenu 호출')
                  onSelectMenu(order.id)
                } else {
                  console.log('❌ 선택 불가:', { status: order.status, cleanWoksCount: cleanWoks.length })
                }
              }}
              className={`min-w-[90px] p-2 rounded-lg shadow-md transition-all ${
                selectedMenuId === order.id
                  ? 'ring-2 ring-blue-500 scale-105'
                  : ''
              } ${
                order.status === 'COMPLETED'
                  ? 'bg-green-200 border border-green-500'
                  : order.status === 'COOKING'
                    ? 'bg-orange-200 border border-orange-500'
                    : 'bg-yellow-200 border border-yellow-500'
              } ${
                !canSelect ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div className="font-bold text-[10px] text-gray-800 truncate">{order.menuName}</div>
              {order.status !== 'COMPLETED' && (
                <div className={`text-[8px] mt-1 font-mono ${timerClass}`}>
                  ⏱️ {minutes}:{seconds.toString().padStart(2, '0')}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </>
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
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds)
  const [elapsedTime, setElapsedTime] = useState(0)
  
  useEffect(() => {
    const elapsed = (elapsedSeconds - order.enteredAt) * 1000 // 밀리초
    setElapsedTime(elapsed)
  }, [elapsedSeconds, order.enteredAt])
  
  const minutes = Math.floor(elapsedTime / 60000)
  const seconds = Math.floor((elapsedTime % 60000) / 1000)
  
  // 시간에 따른 색상
  let timerClass = 'text-green-700'
  if (elapsedTime > MENU_TIMER.CRITICAL_TIME) {
    timerClass = 'text-red-700 font-bold animate-pulse'
  } else if (elapsedTime > MENU_TIMER.WARNING_TIME) {
    timerClass = 'text-orange-700 font-bold'
  } else if (elapsedTime > MENU_TIMER.TARGET_TIME) {
    timerClass = 'text-yellow-700'
  }
  
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
      
      {/* 타이머 표시 */}
      {order.status !== 'COMPLETED' && (
        <div className={`text-xs mt-1 font-mono ${timerClass}`}>
          ⏱️ {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      )}
      
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

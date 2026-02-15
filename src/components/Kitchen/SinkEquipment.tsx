import { useGameStore } from '../../stores/gameStore'
import { useSound } from '../../hooks/useSound'
import type { EquipmentComponentProps } from './PlaceholderEquipment'

/**
 * SinkEquipment - CSS Grid 기반 싱크대 컴포넌트
 * allEquipment에서 BURNER 타입 장비를 동적으로 조회하여 씻기 버튼 생성
 */
export default function SinkEquipment({
  displayName,
  allEquipment,
}: EquipmentComponentProps) {
  const { woks, washWok } = useGameStore()
  const { playSound } = useSound()

  // allEquipment에서 BURNER 타입 장비를 동적으로 조회
  const burners = allEquipment
    .filter((eq) => eq.equipment_type === 'BURNER' && eq.is_active)
    .sort((a, b) => a.display_order - b.display_order)

  // 화구별 웍 정보 및 씻기 가능 여부 계산
  const burnerWokInfo = burners.map((burner) => {
    const wok = woks.find((w) => w.equipmentKey === burner.equipment_key)
    const canWash = wok && (wok.state === 'DIRTY' || wok.state === 'BURNED') && !wok.isOn
    return {
      burner,
      wok,
      canWash,
    }
  })

  const handleWash = (burnerNumber: number) => {
    playSound('wash')
    washWok(burnerNumber)
  }

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 w-full h-full flex flex-col p-2"
    >
      {/* 상단: 싱크대 시각화 */}
      <div className="text-[10px] font-bold text-gray-600 bg-indigo-50 rounded-lg text-center py-0.5 mb-1">
        {displayName}
      </div>

      <div
        data-kitchen-sink
        className="bg-blue-50 rounded-lg shadow-inner border border-gray-200 flex-1 flex items-center justify-center relative overflow-hidden mb-2"
      >
        {/* 수도꼭지 */}
        <div className="text-3xl lg:text-4xl filter drop-shadow-lg">💧</div>
      </div>

      {/* 하단: 씻기 버튼들 (씻을 수 있는 웍만 표시) */}
      <div className="flex flex-col gap-1">
        {burnerWokInfo.filter(({ canWash }) => canWash).length === 0 ? (
          <div className="text-[9px] text-gray-400 text-center py-1">
            씻을 웍 없음
          </div>
        ) : (
          burnerWokInfo
            .filter(({ canWash }) => canWash)
            .map(({ burner, wok }) => (
              <button
                key={burner.equipment_key}
                onClick={() => wok && handleWash(wok.burnerNumber)}
                className="min-h-[36px] lg:min-h-[32px] py-1 px-2 text-[10px] lg:text-xs font-bold transition-all bg-teal-500 hover:bg-teal-600 text-white rounded-lg shadow-sm active:scale-95"
              >
                {burner.display_name} 🧼
              </button>
            ))
        )}
      </div>
    </div>
  )
}

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
      className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 rounded-lg p-2 flex flex-col"
      style={{
        backgroundImage: `
          linear-gradient(135deg,
            rgba(255,255,255,0.8) 0%,
            rgba(200,200,200,0.3) 50%,
            rgba(255,255,255,0.8) 100%)
        `,
        boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.9), 0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* 상단: 싱크대 시각화 */}
      <div className="text-[10px] font-bold text-gray-600 mb-1 px-1 py-0.5 bg-white/60 rounded text-center border border-gray-300">
        {displayName}
      </div>

      <div
        data-kitchen-sink
        className="flex-1 min-h-[60px] bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg shadow-inner border border-gray-300 flex items-center justify-center relative overflow-hidden mb-2"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, transparent 70%),
            linear-gradient(to bottom, #eff6ff, #dbeafe, #bfdbfe)
          `,
          boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.1), inset 0 -2px 6px rgba(255,255,255,0.5)',
        }}
      >
        {/* 수도꼭지 */}
        <div
          className="absolute top-1 right-1 w-6 h-6 bg-gray-300 rounded-full shadow-md border border-gray-400"
          style={{
            backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(150,150,150,0.4) 100%)',
          }}
        >
          <div className="absolute inset-0.5 bg-gray-200 rounded-full"></div>
        </div>
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
                className="min-h-[36px] lg:min-h-[32px] py-1 px-2 rounded text-[10px] lg:text-xs font-bold transition-all shadow bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-500 hover:to-cyan-600 text-white hover:shadow-md active:scale-95"
              >
                {burner.display_name} 🧼
              </button>
            ))
        )}
      </div>
    </div>
  )
}

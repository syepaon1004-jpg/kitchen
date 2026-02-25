import { useGameStore } from '../../stores/gameStore'
import type { EquipmentComponentProps } from './PlaceholderEquipment'

/**
 * PrepTableEquipment - 작업다이 컴포넌트
 *
 * 일반 작업다이: 조리 준비용 테이블
 * 데코존(is_deco_zone === true): 클릭 시 DECO 모드로 전환
 *
 * COOKING 모드에서는 그리드 안에서 정상 렌더링 (스크롤 따라감)
 * DECO 모드 전환 시 GamePlay.tsx에서 fixed 오버레이로 처리
 */
export default function PrepTableEquipment({
  displayName,
  equipmentKey,
  config,
}: EquipmentComponentProps) {
  const { openDecoZone } = useGameStore()
  const isDecoZone = config?.is_deco_zone !== false

  // 데코존이 아닌 일반 작업다이
  if (!isDecoZone) {
    return (
      <div
        data-equipment-key={equipmentKey}
        className="w-full h-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-100 rounded-lg border-2 border-amber-300 flex flex-col items-center justify-center p-2"
        style={{
          backgroundImage: `
            linear-gradient(135deg,
              rgba(255,255,255,0.6) 0%,
              rgba(251,191,36,0.2) 50%,
              rgba(255,255,255,0.6) 100%)
          `,
          boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.08)',
        }}
      >
        <span className="text-2xl mb-1">🔪</span>
        <span className="text-xs font-bold text-amber-800">{displayName}</span>
      </div>
    )
  }

  // 데코존 — 클릭 시 DECO 모드로 전환
  return (
    <button
      type="button"
      data-equipment-key={equipmentKey}
      data-prep-table-placeholder
      onClick={openDecoZone}
      className="w-full h-full bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg border-2 border-purple-300 flex flex-col items-center justify-center p-2 cursor-pointer transition-colors"
      style={{
        backgroundImage: `
          linear-gradient(135deg,
            rgba(255,255,255,0.6) 0%,
            rgba(168,85,247,0.15) 50%,
            rgba(255,255,255,0.6) 100%)
        `,
        boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.8), 0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <span className="text-2xl mb-1">🎨</span>
      <span className="text-xs font-bold text-purple-700">{displayName}</span>
      <span className="text-[10px] text-purple-500 mt-0.5">클릭하여 이동</span>
    </button>
  )
}

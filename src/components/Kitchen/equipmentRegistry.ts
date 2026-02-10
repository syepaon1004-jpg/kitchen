import type { ComponentType } from 'react'
import type { EquipmentType } from '../../types/database.types'
import PlaceholderEquipment, { type EquipmentComponentProps } from './PlaceholderEquipment'
import BurnerEquipment from './BurnerEquipment'
import SinkEquipment from './SinkEquipment'
import StorageEquipment from './StorageEquipment'
import SeasoningEquipment from './SeasoningEquipment'
import PrepTableEquipment from './PrepTableEquipment'
// v3.1: 신규 장비 컴포넌트
import MicrowaveEquipment from './equipment/MicrowaveEquipment'
import FryerEquipment from './equipment/FryerEquipment'

// 장비 타입별 컴포넌트 매핑 레지스트리
// 아직 구현되지 않은 컴포넌트는 PlaceholderEquipment로 표시
const EQUIPMENT_COMPONENTS: Record<EquipmentType, ComponentType<EquipmentComponentProps>> = {
  BURNER: BurnerEquipment,                // ✅ equipmentKey 기반 버너 컴포넌트
  SINK: SinkEquipment,                    // ✅ allEquipment 기반 동적 싱크대
  DRAWER_FRIDGE: StorageEquipment,        // ✅ 서랍냉장고 (storageCache 기반)
  FRIDGE_4BOX: StorageEquipment,          // ✅ 4호박스 (storageCache 기반, 층 선택 지원)
  SEASONING_COUNTER: SeasoningEquipment,  // ✅ 조미료대 (gameStore 콜백 기반)
  PREP_TABLE: PrepTableEquipment,         // ✅ 작업다이 (데코존 줌인 지원)
  FRYER: FryerEquipment,                  // v3.1: 튀김기
  PLATING_STATION: PlaceholderEquipment,
  CUTTING_BOARD: PlaceholderEquipment,
  MICROWAVE: MicrowaveEquipment,          // v3.1: 전자레인지
  FREEZER: StorageEquipment,              // v3.1 Fix: 냉동고도 StorageEquipment 사용 (동일한 플로우)
  TORCH: PlaceholderEquipment,
  COLD_TABLE: PlaceholderEquipment,
  WORKTABLE: PlaceholderEquipment,
  PASS: PlaceholderEquipment,             // 패스 (미구현)
  GRILL: PlaceholderEquipment,            // 그릴 (미구현)
}

/**
 * 장비 타입에 해당하는 컴포넌트를 반환
 * @param type 장비 타입 (EquipmentType)
 * @returns 해당 장비를 렌더링하는 React 컴포넌트
 */
export function getEquipmentComponent(type: EquipmentType): ComponentType<EquipmentComponentProps> {
  return EQUIPMENT_COMPONENTS[type] || PlaceholderEquipment
}

/**
 * 장비 레지스트리 업데이트 함수
 * 실제 컴포넌트가 구현되면 이 함수로 교체
 * @param type 장비 타입
 * @param component 교체할 컴포넌트
 */
export function registerEquipment(
  type: EquipmentType,
  component: ComponentType<EquipmentComponentProps>
): void {
  EQUIPMENT_COMPONENTS[type] = component
}

// EquipmentComponentProps 타입도 re-export
export type { EquipmentComponentProps } from './PlaceholderEquipment'

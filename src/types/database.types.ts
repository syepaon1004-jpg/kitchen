// Supabase DB 타입 및 게임 도메인 타입

export interface Store {
  id: string
  store_name: string
  store_code: string
  created_at?: string
  updated_at?: string
}

export interface User {
  id: string
  store_id: string
  username: string
  avatar_name: string
  password_hash?: string
  created_at?: string
}

export interface KitchenLayout {
  id: string
  store_id: string
  burner_count: number
  has_sink: boolean
  sink_position?: string
  has_seasoning_counter: boolean
  seasoning_counter_position?: string
  drawer_fridge_config?: Record<string, unknown>
}

export interface StorageLocation {
  id: string
  store_id: string
  location_code: string
  location_name: string
  location_type: string
  parent_location_id?: string
  section_code?: string
  section_name?: string
  position_order?: number
}

export interface IngredientMaster {
  id: string
  ingredient_name: string
  ingredient_name_en?: string
  category?: string
  base_unit: string
}

export interface IngredientInventory {
  id: string
  store_id: string
  ingredient_master_id: string
  storage_location_id: string
  sku_full: string
  standard_amount: number
  standard_unit: string
  description?: string
  ingredient_master?: IngredientMaster
  storage_location?: StorageLocation
  grid_positions?: string  // GridPopup에서 사용하는 위치 정보
  grid_size?: string       // GridPopup에서 사용하는 크기 정보
}

export interface Seasoning {
  id: string
  store_id: string
  seasoning_name: string
  position_code: string
  position_name: string
  base_unit: string
}

export interface RecipeIngredient {
  id: string
  recipe_step_id: string
  required_sku: string
  required_amount: number
  required_unit: string
  is_exact_match_required: boolean
}

export interface RecipeStep {
  id: string
  recipe_id: string
  step_number: number
  step_group?: number
  step_type: 'INGREDIENT' | 'ACTION'
  action_type?: string
  time_limit_seconds?: number
  is_order_critical?: boolean
  instruction?: string
  ingredients?: RecipeIngredient[]
}

export interface Recipe {
  id: string
  store_id: string
  menu_name: string
  menu_name_en?: string
  category?: string
  difficulty_level?: string
  estimated_cooking_time?: number
  description?: string
  steps?: RecipeStep[]
}

export interface GameSession {
  id: string
  user_id: string
  store_id: string
  level: string
  start_time: string
  end_time?: string
  total_menus_target: number
  completed_menus?: number
  status: 'IN_PROGRESS' | 'COMPLETED'
}

export interface GameScore {
  id: string
  session_id: string
  recipe_accuracy_score: number
  speed_score: number
  burner_usage_score: number
  total_score: number
  total_elapsed_time_seconds: number
  average_burner_usage_percent?: number
  perfect_recipe_count?: number
}

export type WokState = 'CLEAN' | 'WET' | 'DIRTY' | 'BURNED' | 'OVERHEATING'
export type WokPosition = 'AT_BURNER' | 'AT_SINK' | 'MOVING_TO_SINK' | 'MOVING_TO_BURNER'

export interface Wok {
  burnerNumber: number
  isOn: boolean
  state: WokState
  position: WokPosition
  currentMenu: string | null
  currentOrderId: string | null
  currentStep: number
  stepStartTime: number | null
  burnerOnSince: number | null
  addedIngredients: string[] // 현재 스텝에서 투입한 재료 SKU 목록
  temperature: number // 웍 현재 온도 (°C)
  isStirFrying: boolean // 볶기 중인지 여부
  stirFryStartTime: number | null // 볶기 시작 시간
  heatLevel: number // 불 세기 (1: 약불, 2: 중불, 3: 강불)
  stirFryCount: number // 현재 스텝에서 볶기 횟수
  hasWater: boolean // 물이 들어있는지 여부
  waterTemperature: number // 물 온도
  waterBoilStartTime: number | null // 100도 도달 시간
  isBoiling: boolean // 끓고 있는지 여부
  recipeErrors: number // 레시피 오류 횟수 (재료/액션 틀린 횟수)
  totalSteps: number // 현재 메뉴의 총 스텝 수
}

// 웍 온도 관련 상수
export const WOK_TEMP = {
  AMBIENT: 25, // 실온
  SMOKING_POINT: 300, // 스모킹 포인트 (1.5배: 200 → 300)
  MIN_STIR_FRY: 180, // 볶기 최소 온도
  OVERHEATING: 360, // 과열 온도 (300 × 1.2)
  BURNED: 400, // 타버림 온도
  MAX_SAFE: 420, // 절대 최대 온도
  BASE_HEAT_RATE: 25.2, // 기본 온도 상승률 (°C/s) - 1.2배 조정 (21 * 1.2)
  COOL_RATE: 5, // 초당 온도 하강률 (°C/s, 불 끄면)
  
  // 물 관련 온도
  WATER_BOIL: 100, // 끓는점
  WATER_HEAT_RATE: 2.5, // 물 가열 속도 (°C/s) - 100도까지 30초
  WATER_BOIL_DURATION: 5000, // 끓기 위한 유지 시간 (5초)
  
  // 불 세기별 가열 배율
  HEAT_MULTIPLIER: {
    1: 0.78,  // 약불 (0.6 * 1.3)
    2: 1.56,  // 중불 (1.2 * 1.3)
    3: 1.82,  // 강불 (1.4 * 1.3)
  } as Record<1 | 2 | 3, number>,
  
  // 재료 투입 시 온도 하락
  COOLING: {
    VEGETABLE: 40, // 채소류 (양파, 애호박, 당근)
    SEAFOOD: 45, // 해산물 (새우, 오징어)
    EGG: 20, // 계란
    RICE: 15, // 밥
    SEASONING: 5, // 조미료
    WATER: 60, // 물
    BROTH: 50, // 육수
  } as Record<string, number>,
  
  // 액션별 온도 변화
  ACTION_TEMP: {
    STIR_FRY: 10, // 볶기 (-10°C)
    FLIP: 8, // 뒤집기 (-8°C)
    ADD_WATER: 60, // 물 넣기 (-60°C)
  } as Record<string, number>,
}

export type MenuOrderStatus = 'WAITING' | 'COOKING' | 'COMPLETED'

export interface MenuOrder {
  id: string
  menuName: string
  enteredAt: number
  status: MenuOrderStatus
  assignedBurner: number | null
  servedAt?: Date
}

export interface BurnerUsageLog {
  timestamp: number
  activeBurners: number[]
}

export interface ActionLog {
  timestamp: Date
  elapsedSeconds: number
  actionType: string
  menuName?: string
  burnerNumber?: number
  ingredientSKU?: string
  amountInput?: number
  expectedSKU?: string
  expectedAmount?: number
  isCorrect: boolean
  timingCorrect?: boolean
  message: string
}

export type GameLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'

export const MENU_INTERVAL_MS: Record<GameLevel, number> = {
  BEGINNER: 30000,
  INTERMEDIATE: 20000,
  ADVANCED: 15000,
}

export const MENUS_PER_INTERVAL: Record<GameLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
}

// 메뉴 타이머 기준 (밀리초)
export const MENU_TIMER = {
  TARGET_TIME: 7 * 60 * 1000,      // 7분 (목표 시간 - 최고 점수)
  WARNING_TIME: 10 * 60 * 1000,    // 10분 (감점 시작)
  CRITICAL_TIME: 15 * 60 * 1000,   // 15분 (큰 감점)
  CANCEL_TIME: 15 * 60 * 1000,     // 15분 초과 시 자동 취소
} as const

// 시간대별 점수 계산
export function calculateTimeScore(elapsedMs: number): {
  score: number
  tier: 'perfect' | 'good' | 'warning' | 'critical' | 'cancelled'
  message: string
} {
  const minutes = Math.floor(elapsedMs / 60000)
  
  if (elapsedMs > MENU_TIMER.CANCEL_TIME) {
    return {
      score: -50, // 치명적인 감점
      tier: 'cancelled',
      message: `❌ 15분 초과 (${minutes}분) - 주문 취소`
    }
  } else if (elapsedMs > MENU_TIMER.CRITICAL_TIME) {
    return {
      score: 30, // 큰 감점 (잘못된 레시피와 동일)
      tier: 'critical',
      message: `⚠️ 매우 느림 (${minutes}분)`
    }
  } else if (elapsedMs > MENU_TIMER.WARNING_TIME) {
    return {
      score: 70, // 감점
      tier: 'warning',
      message: `⚠️ 느림 (${minutes}분)`
    }
  } else if (elapsedMs <= MENU_TIMER.TARGET_TIME) {
    return {
      score: 100, // 최고 점수
      tier: 'perfect',
      message: `✅ 완벽 (${minutes}분)`
    }
  } else {
    return {
      score: 85, // 약간 감점
      tier: 'good',
      message: `👍 양호 (${minutes}분)`
    }
  }
}

export const LEVEL_LABELS: Record<GameLevel, string> = {
  BEGINNER: '신입',
  INTERMEDIATE: '알바',
  ADVANCED: '관리자',
}

export function isSeasoningSKU(sku: string): boolean {
  return sku.startsWith('SEASONING:')
}

export function parseSeasoningSKU(sku: string): { name: string; amount: number; unit: string } | null {
  const parts = sku.split(':')
  if (parts[0] !== 'SEASONING' || parts.length < 3) return null
  const amountWithUnit = parts[2]
  const match = amountWithUnit.match(/^(\d+)([A-Za-z]+)$/)
  if (!match) return null
  return {
    name: parts[1],
    amount: parseInt(match[1], 10),
    unit: match[2].toUpperCase(),
  }
}

export function buildSeasoningSKU(name: string, amount: number, unit: string): string {
  return `SEASONING:${name}:${amount}${unit.toUpperCase()}`
}

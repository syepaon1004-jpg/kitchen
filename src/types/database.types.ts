// Supabase DB 타입 및 게임 도메인 타입
// v3 스키마: SKU 문자열 → FK(UUID) 기반으로 전환

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
  location_type: string // 'FRIDGE', 'DRAWER', 'SEASONING' 등
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

// v3: 조미료도 일반 재고로 통합 (location_type='SEASONING'으로 구분)
export interface IngredientInventory {
  id: string
  store_id: string
  ingredient_master_id: string
  storage_location_id: string
  sku_code?: string | null // 선택적 SKU 코드 (호환용)
  sku_full?: string | null // 기존 UI 호환용 (deprecated)
  standard_amount: number
  standard_unit: string
  description?: string
  grid_positions?: string | null  // GridPopup에서 사용하는 위치 정보
  grid_size?: string | null       // GridPopup에서 사용하는 크기 정보
  floor_number?: number | null    // 4호박스 층 번호
  display_order?: number
  // JOIN 데이터
  ingredient_master?: IngredientMaster
  storage_location?: StorageLocation
}

// v3: recipe_ingredients - SKU 대신 FK 사용
export interface RecipeIngredient {
  id: string
  recipe_step_id: string
  ingredient_master_id: string      // FK → ingredients_master (어떤 재료)
  inventory_id: string              // FK → ingredients_inventory (어느 위치의 재료)
  required_amount: number
  required_unit: string
  display_name?: string | null      // 표시용 이름 (선택)
  is_exact_match_required?: boolean
  // JOIN 데이터
  ingredient_master?: IngredientMaster
  inventory?: IngredientInventory
}

// v3: recipe_steps - bundle_id만 사용 (recipe_id 제거)
export interface RecipeStep {
  id: string
  bundle_id: string                 // FK → recipe_bundles (NOT NULL)
  step_number: number
  step_group?: number
  step_type: 'INGREDIENT' | 'ACTION'
  action_type?: string
  time_limit_seconds?: number
  is_order_critical?: boolean
  instruction?: string
  // JOIN 데이터
  recipe_ingredients?: RecipeIngredient[]
}

// v3: Recipe에 recipe_bundles 중첩 구조
export interface Recipe {
  id: string
  store_id: string
  menu_name: string
  menu_name_en?: string
  category?: string
  difficulty_level?: string
  estimated_cooking_time?: number
  description?: string
  // v3: steps 대신 recipe_bundles 사용
  recipe_bundles?: RecipeBundle[]
  // 호환성: 기존 코드에서 steps 접근 시 사용 (deprecated)
  steps?: RecipeStep[]
}

export interface GameSession {
  id: string
  user_id: string
  store_id: string
  level?: string // v3: DB에 없을 수 있음, 로컬 상태로 관리
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

// v3: Wok - addedIngredients → addedIngredientIds
export interface Wok {
  equipmentKey: string // 'burner_1', 'burner_2' 등 (DB kitchen_equipment.equipment_key와 매핑)
  burnerNumber: number
  isOn: boolean
  state: WokState
  position: WokPosition
  currentMenu: string | null
  currentOrderId: string | null
  currentBundleId: string | null // MIXED 메뉴의 묶음 ID (HOT 묶음 조리 시 필터링용)
  currentStep: number
  stepStartTime: number | null
  burnerOnSince: number | null
  addedIngredientIds: string[] // v3: 투입 완료된 recipe_ingredients.id 목록
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
  ingredientId?: string // v3: SKU 대신 inventory_id 또는 ingredient_master_id
  amountInput?: number
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

// ============================================
// === 주방 그리드 시스템 타입 (Data-Driven) ===
// ============================================

// === 장비 타입 ===
export type EquipmentType =
  | 'BURNER'
  | 'SINK'
  | 'DRAWER_FRIDGE'
  | 'FRIDGE_4BOX'
  | 'SEASONING_COUNTER'
  | 'FRYER'
  | 'PREP_TABLE'
  | 'MICROWAVE'
  | 'PLATING_STATION'
  | 'CUTTING_BOARD'
  | 'TORCH'
  | 'COLD_TABLE'
  | 'WORKTABLE'
  | 'PASS'
  | 'GRILL'

// === 장비별 config 인터페이스 ===
export interface BurnerConfig {
  max_temp: number
  has_wok: boolean
}

export interface SinkConfig {
  can_wash_wok: boolean
}

export interface DrawerFridgeConfig {
  drawer_layout: string   // "2x2" 등
}

export interface Fridge4BoxConfig {
  has_floor_2: boolean
}

export interface SeasoningCounterConfig {
  position: 'standalone' | 'on_prep_table'
  parent_key?: string     // position이 on_prep_table일 때
}

export interface FryerConfig {
  max_temp: number
  oil_type: string
}

export interface PlatingStationConfig {
  max_plates: number
}

export interface PrepTableConfig {
  slots: number
  is_deco_zone: boolean   // true면 데코존 역할
}

export interface MicrowaveConfig {
  modes: string[]
}

export interface CuttingBoardConfig {
  can_slice: boolean
}

export interface ColdTableConfig {
  temp_range: [number, number]
}

export interface WorktableConfig {
  has_seasoning: boolean
}

// === DB 테이블 1:1 매핑 ===
export interface KitchenGrid {
  id: string
  store_id: string
  grid_cols: number
  grid_rows: number
  grid_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface KitchenEquipment {
  id: string
  kitchen_grid_id: string
  equipment_type: EquipmentType
  grid_x: number           // 0-based
  grid_y: number           // 0-based
  grid_w: number
  grid_h: number
  equipment_key: string    // 'burner_1', 'sink_main' 등
  equipment_config: Record<string, unknown>
  storage_location_ids: string[]   // ['DRAWER_LT', 'DRAWER_RT', ...]
  display_name: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// === 장비 Config 유니온 타입 ===
export type EquipmentConfig =
  | BurnerConfig
  | SinkConfig
  | DrawerFridgeConfig
  | Fridge4BoxConfig
  | SeasoningCounterConfig
  | FryerConfig
  | PlatingStationConfig
  | PrepTableConfig
  | MicrowaveConfig
  | CuttingBoardConfig
  | ColdTableConfig
  | WorktableConfig

// ============================================
// === 데코존/묶음/콜드메뉴 시스템 타입 ===
// ============================================

// === Supabase 마스터 테이블 타입 ===
export interface PlateType {
  id: string
  plate_name: string
  plate_type: 'BOWL' | 'FLAT' | 'DEEP' | 'TRAY'
  plate_color?: string // 플레이트 색상
  grid_size: number // 3 = 3×3
  deco_slots: number
  created_at?: string
}

// v3: RecipeBundle - recipe_steps 중첩 포함
export interface RecipeBundle {
  id: string
  recipe_id: string
  bundle_name: string
  bundle_order: number
  cooking_type: 'HOT' | 'COLD'
  is_main_dish: boolean
  plate_type_id: string | null
  merge_target_bundle_id: string | null
  deco_required: boolean
  created_at?: string
  // Joined data
  recipe?: Recipe
  plate_type?: PlateType
  recipe_steps?: RecipeStep[] // v3: 중첩된 스텝들
}

// v3: DecoIngredient (구 deco_default_items 대체)
export interface DecoIngredient {
  id: string
  store_id: string
  ingredient_master_id: string    // FK → ingredients_master
  deco_category: 'GARNISH' | 'SAUCE' | 'TOPPING'
  has_exact_amount: boolean
  display_color: string
  image_url?: string | null
  storage_location_id?: string | null
  display_order: number
  created_at?: string
  // JOIN 데이터
  ingredient_master?: IngredientMaster
}

// v3: DecoStep (구 deco_rules + deco_item_images 대체)
export interface DecoStep {
  id: string
  recipe_id: string
  deco_order: number
  source_type: 'DECO_ITEM' | 'SETTING_ITEM' | 'BUNDLE'
  deco_ingredient_id?: string | null    // source_type='DECO_ITEM'일 때
  inventory_id?: string | null          // source_type='SETTING_ITEM'일 때
  source_bundle_id?: string | null      // source_type='BUNDLE'일 때
  display_name: string
  required_amount?: number | null
  required_unit?: string | null
  grid_position: number                 // 1~9
  layer_image_url?: string | null
  layer_image_color: string
  layer_order: number
  created_at?: string
}

export interface IngredientSpecialAction {
  id: string
  ingredient_master_id: string
  action_type: 'SLICE' | 'DICE' | 'TORCH' | 'CHILL'
  produces_sku: string
  time_seconds: number
  created_at?: string
}

// === 게임 런타임 타입 ===
export type IngredientMode = 'INPUT' | 'SETTING' | null

export type DecoPlateStatus =
  | 'DECO_WAITING'      // 데코 대기 중
  | 'DECO_IN_PROGRESS'  // 데코 진행 중
  | 'DECO_COMPLETE'     // 데코 완료
  | 'READY_TO_SERVE'    // 서빙 준비 완료

export type BundleStatus =
  | 'NOT_STARTED'  // 아직 시작 안 함
  | 'COOKING'      // 조리 중 (HOT: 웍에서, COLD: 세팅존)
  | 'PLATED'       // 접시에 담김
  | 'IN_DECO_ZONE' // 데코존에 있음
  | 'MERGED'       // 다른 묶음에 합쳐짐

export interface DecoLayer {
  decoStepId: string // v3: decoRuleId → decoStepId
  ingredientName: string
  imageColor: string
  amount: number
  appliedAt: number // timestamp
}

export interface DecoGridCell {
  position: number // 1~9
  layers: DecoLayer[]
}

export interface AppliedDeco {
  decoStepId: string // v3: decoRuleId → decoStepId
  sourceType: 'DECO_ITEM' | 'SETTING_ITEM' | 'BUNDLE'
  gridPosition: number // 1~9
  imageColor: string
  amount?: number
}

export interface DecoPlate {
  id: string
  orderId: string
  menuName: string
  recipeId: string
  bundleId: string | null
  bundleName: string | null
  plateType: PlateType
  isMainDish: boolean
  status: DecoPlateStatus
  appliedDecos: AppliedDeco[]
  gridCells: DecoGridCell[]
  mergedBundles: string[]
}

export interface DecoSettingItem {
  id: string
  ingredientName: string
  ingredientMasterId: string
  inventoryId: string // v3: 추가
  amount: number
  unit: string
  remainingAmount: number
}

export interface BundleProgress {
  bundleId: string
  bundleName: string
  cookingType: 'HOT' | 'COLD'
  isMainDish: boolean
  status: BundleStatus
  assignedBurner?: number
  plateTypeId?: string
}

// 데코존에서 현재 선택된 재료
export interface SelectedDecoIngredient {
  type: 'DECO_ITEM' | 'SETTING_ITEM' // v3: DEFAULT_ITEM → DECO_ITEM
  id: string
  name: string
  color: string
  remainingAmount: number | null // null이면 무한 (has_exact_amount=false)
  unit: string
}

// ============================================
// === 호환성 유지용 타입/함수 (deprecated) ===
// ============================================

// @deprecated v3: 조미료는 IngredientInventory로 통합됨
export interface Seasoning {
  id: string
  store_id: string
  seasoning_name: string
  position_code: string
  position_name: string
  base_unit: string
  ingredient_master_id?: string | null // v3 호환용
}

// @deprecated v3: DecoIngredient로 대체됨
export interface DecoDefaultItem {
  id: string
  store_id: string
  item_name: string
  item_name_en?: string
  item_category?: string
  base_unit: string
  has_exact_amount?: boolean
  item_color?: string
  item_image_url?: string
  display_order: number
  created_at?: string
}

// @deprecated v3: DecoStep으로 대체됨
export interface DecoRule {
  id: string
  recipe_id: string
  deco_order: number
  source_type: string
  deco_default_item_id?: string | null
  ingredient_master_id?: string | null
  source_bundle_id?: string | null
  display_name: string
  required_amount: number
  required_unit: string
  grid_position?: number | null
  grid_positions?: number[]
  min_amount?: number
  max_amount?: number
  image_color?: string
  image_url?: string
  created_at?: string
}

// @deprecated v3: DecoStep에 흡수됨
export interface DecoItemImage {
  id: string
  recipe_id: string
  ingredient_master_id: string
  image_url: string
  image_type: 'FULL' | 'SLICE' | 'DICE' | 'LAYER'
  color_hex: string
  layer_z_index: number
  created_at?: string
  ingredient_master?: IngredientMaster
}

// @deprecated v3: 조미료 SKU 형식 사용 안 함
export function isSeasoningSKU(sku: string): boolean {
  return sku.startsWith('SEASONING:')
}

// @deprecated v3: 조미료 SKU 형식 사용 안 함
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

// @deprecated v3: 조미료 SKU 형식 사용 안 함
export function buildSeasoningSKU(name: string, amount: number, unit: string): string {
  return `SEASONING:${name}:${amount}${unit.toUpperCase()}`
}

// ============================================
// === 헬퍼 함수 ===
// ============================================

// v3: 조미료 재고 필터링 헬퍼
export function filterSeasoningInventory(ingredients: IngredientInventory[]): IngredientInventory[] {
  return ingredients.filter(inv => inv.storage_location?.location_type === 'SEASONING')
}

// v3: 레시피에서 번들의 스텝 가져오기 헬퍼
export function getBundleSteps(recipe: Recipe, bundleId: string): RecipeStep[] {
  const bundle = recipe.recipe_bundles?.find(b => b.id === bundleId)
  return bundle?.recipe_steps || []
}

// v3: 재료명 가져오기 헬퍼
export function getIngredientDisplayName(ingredient: RecipeIngredient): string {
  return ingredient.display_name
    || ingredient.ingredient_master?.ingredient_name
    || '알 수 없는 재료'
}

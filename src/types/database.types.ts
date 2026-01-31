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

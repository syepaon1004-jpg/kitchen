import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  Store,
  User,
  KitchenLayout,
  Recipe,
  RecipeStep,
  RecipeIngredient,
  IngredientInventory,
  GameSession,
  Wok,
  MenuOrder,
  ActionLog,
  BurnerUsageLog,
  GameLevel,
  KitchenGrid,
  KitchenEquipment,
  // 데코존/묶음/콜드메뉴 시스템
  PlateType,
  RecipeBundle,
  DecoIngredient,
  DecoStep,
  IngredientSpecialAction,
  IngredientMode,
  DecoPlate,
  DecoSettingItem,
  BundleProgress,
  SelectedDecoIngredient,
  Seasoning,
} from '../types/database.types'
import { WOK_TEMP, MENU_TIMER, calculateTimeScore } from '../types/database.types'

// 기본 웍 생성 함수
function createWok(equipmentKey: string, burnerNumber: number): Wok {
  return {
    equipmentKey,
    burnerNumber,
    isOn: false,
    state: 'CLEAN',
    position: 'AT_BURNER',
    currentMenu: null,
    currentOrderId: null,
    currentBundleId: null, // MIXED 메뉴의 묶음 ID
    currentStep: 0,
    stepStartTime: null,
    burnerOnSince: null,
    addedIngredientIds: [],
    temperature: WOK_TEMP.AMBIENT,
    isStirFrying: false,
    stirFryStartTime: null,
    heatLevel: 3, // 기본 강불
    stirFryCount: 0,
    hasWater: false,
    waterTemperature: WOK_TEMP.AMBIENT,
    waterBoilStartTime: null,
    isBoiling: false,
    recipeErrors: 0,
    totalSteps: 0,
  }
}

// kitchenEquipment에서 BURNER 타입 장비로 woks 생성
function createWoksFromEquipment(equipment: KitchenEquipment[]): Wok[] {
  const burners = equipment
    .filter((e) => e.equipment_type === 'BURNER')
    .sort((a, b) => a.display_order - b.display_order)

  if (burners.length === 0) {
    // 폴백: 기본 3개 화구
    return [
      createWok('burner_1', 1),
      createWok('burner_2', 2),
      createWok('burner_3', 3),
    ]
  }

  return burners.map((burner) => {
    // equipment_key에서 burnerNumber 추출 (예: 'burner_1' → 1)
    const keyParts = burner.equipment_key.split('_')
    const burnerNumber = parseInt(keyParts[keyParts.length - 1], 10) || 1
    return createWok(burner.equipment_key, burnerNumber)
  })
}

// 기본 초기 웍 (kitchenEquipment 없을 때 사용)
const INITIAL_WOKS: Wok[] = [
  createWok('burner_1', 1),
  createWok('burner_2', 2),
  createWok('burner_3', 3),
]

const TARGET_MENUS = 3

interface GameStore {
  currentStore: Store | null
  currentUser: User | null
  currentSession: GameSession | null
  level: GameLevel
  kitchenLayout: KitchenLayout | null
  ingredients: IngredientInventory[]
  recipes: Recipe[]
  seasonings: Seasoning[] // 조미료 데이터 (기존 UI 호환용)

  // 그리드 기반 주방 시스템
  kitchenGrid: KitchenGrid | null
  kitchenEquipment: KitchenEquipment[]
  
  // 냉장고/서랍 식자재 캐시 (location_code별)
  storageCache: Record<string, {
    title: string
    gridRows: number
    gridCols: number
    ingredients: IngredientInventory[]
  }>

  isPlaying: boolean
  elapsedSeconds: number
  completedMenus: number
  targetMenus: number
  woks: Wok[]
  menuQueue: MenuOrder[]
  actionLogs: ActionLog[]
  burnerUsageHistory: BurnerUsageLog[]
  usedMenuNames: Set<string>
  
  // 서빙 오류 알림 (신입이 아닐 때)
  lastServeError: {
    burnerNumber: number
    menuName: string
    errors: number
    totalSteps: number
    accuracy: number
    timestamp: number
  } | null
  
  // 4호박스 뷰 상태
  fridgeViewState: 'CLOSED' | 'ZOOMED' | 'DOOR_OPEN' | 'FLOOR_SELECT' | 'GRID_VIEW'
  selectedFridgePosition: string | null // 'FRIDGE_LT', 'FRIDGE_RT', etc.
  selectedFloor: number | null // 1 or 2

  // 시점 이동 (조리존 ↔ 데코존)
  currentZone: 'COOKING' | 'DECO'
  decoZoneRect: { top: number; left: number; width: number; height: number } | null

  // 재료 선택 모드 (INPUT = 투입존, SETTING = 세팅존)
  ingredientMode: IngredientMode

  // 데코존 상태
  decoPlates: DecoPlate[]
  decoSettingItems: DecoSettingItem[]
  decoMistakes: number
  selectedDecoIngredient: SelectedDecoIngredient | null

  // 합치기 모드 상태
  mergeMode: boolean
  selectedSourcePlateId: string | null

  // 묶음 상태 (주문별)
  activeBundles: Map<string, BundleProgress[]>

  // Supabase 마스터 데이터 (데코존/묶음/콜드메뉴)
  plateTypes: PlateType[]
  recipeBundles: RecipeBundle[]
  decoIngredients: DecoIngredient[] // v3: decoDefaultItems → decoIngredients
  decoSteps: DecoStep[] // v3: decoRules → decoSteps
  ingredientSpecialActions: IngredientSpecialAction[]

  // 완료된 특수 액션 ID 추적 (세션 동안 유지)
  completedSpecialActionIds: string[]

  setStore: (store: Store | null) => void
  setUser: (user: User | null) => void
  setCurrentUser: (user: User | null) => void
  setLevel: (level: GameLevel) => void
  loadStoreData: (storeId: string) => Promise<void>
  preloadStorageData: (storeId: string) => Promise<void>
  resetGameState: () => void
  tickTimer: () => void
  checkMenuTimers: () => void // 메뉴 타이머 체크 (15분 초과 시 자동 취소)
  addMenuToQueue: (menuName: string) => void
  assignMenuToWok: (menuId: string, burnerNumber: number, bundleId?: string) => void
  updateWok: (burnerNumber: number, updates: Partial<Wok>) => void
  updateWokTemperatures: () => void // 모든 웍의 온도 계산 및 업데이트
  setHeatLevel: (burnerNumber: number, level: number) => void // 불 세기 조절
  startStirFry: (burnerNumber: number) => boolean // 볶기 시작
  stopStirFry: (burnerNumber: number) => void // 볶기 중지
  washWok: (burnerNumber: number) => void
  emptyWok: (burnerNumber: number) => void // 웍 비우기 (음식 버리기)
  toggleBurner: (burnerNumber: number) => void
  serve: (burnerNumber: number) => boolean
  logAction: (action: Omit<ActionLog, 'timestamp' | 'elapsedSeconds'>) => void
  recordBurnerUsage: () => void
  startGame: () => Promise<GameSession | null>
  endGame: () => Promise<void>
  getRecipeByMenuName: (menuName: string) => Recipe | undefined
  // v3: 레시피에서 스텝 추출 (recipe_bundles 중첩 구조 처리)
  getRecipeSteps: (recipe: Recipe | undefined, bundleId?: string | null) => RecipeStep[]
  // v3: RecipeIngredient 객체 배열 반환 (required_sku 대신 FK 사용)
  getCurrentStepIngredients: (menuName: string, stepIndex: number, bundleId?: string | null) => RecipeIngredient[]
  // v3: recipeIngredientId (FK) 기반 매칭으로 변경
  validateAndAdvanceIngredient: (burnerNumber: number, recipeIngredientId: string, amount: number) => boolean
  validateAndAdvanceAction: (burnerNumber: number, actionType: string) => { ok: boolean; burned?: boolean }
  
  // 4호박스 뷰 액션
  openFridgeZoom: (position: string) => void
  closeFridgeView: () => void
  openFridgeDoor: () => void
  selectFloor: (floor: number) => void
  backToFridgeZoom: () => void

  // 시점 이동 액션
  setZone: (zone: 'COOKING' | 'DECO') => void
  openDecoZone: () => void

  // 재료 선택 모드 액션
  setIngredientMode: (mode: IngredientMode) => void

  // 데코존 액션
  addToDecoZone: (plate: DecoPlate) => boolean
  removeFromDecoZone: (plateId: string) => void
  selectDecoIngredient: (ingredient: SelectedDecoIngredient) => void
  clearDecoSelection: () => void
  applyDecoItem: (
    plateId: string,
    gridPosition: number,
    ingredientId: string,
    amount: number
  ) => { success: boolean; message: string; isPositionError?: boolean; isOrderError?: boolean; allowedPositions?: number[] }
  mergeBundles: (targetPlateId: string, sourcePlateId: string) => { success: boolean; message: string }
  enterMergeMode: (sourcePlateId: string) => void
  exitMergeMode: () => void
  getNextMergeStep: (recipeId: string) => DecoStep | null
  servePlate: (plateId: string) => boolean
  checkDecoComplete: (plateId: string) => boolean
  addDecoMistake: () => void
  // v3: getDecoRuleForIngredient → getDecoStepForIngredient
  getDecoStepForIngredient: (ingredientId: string, recipeId: string) => DecoStep | null

  // 특수 액션 관리
  completeSpecialAction: (actionId: string) => void
  isSpecialActionCompleted: (actionId: string) => boolean
  getRequiredSpecialActions: (ingredientMasterIds: string[], recipeId: string) => IngredientSpecialAction[]
  getPendingPrerequisites: (ingredientMasterIds: string[], recipeId: string) => IngredientSpecialAction[]

  // 세팅존 액션
  addSettingItem: (item: Omit<DecoSettingItem, 'id' | 'remainingAmount'>) => void
  useSettingItem: (itemId: string, amount: number) => boolean
  removeSettingItem: (itemId: string) => void

  // 묶음 진행 상태 업데이트
  updateBundleProgress: (orderId: string, bundleProgress: Omit<BundleProgress, 'assignedBurner' | 'plateTypeId'> & { assignedBurner?: number; plateTypeId?: string }) => void

  // 재료 선택 콜백 (StorageEquipment에서 사용)
  onIngredientSelected: ((ing: IngredientInventory) => void) | null
  onMultipleIngredientsSelected: ((ings: any[]) => void) | null
  setIngredientCallbacks: (
    onSelect: ((ing: IngredientInventory) => void) | null,
    onMultiple?: ((ings: any[]) => void) | null
  ) => void

  // 조미료 선택 콜백 (SeasoningEquipment에서 사용)
  onSeasoningSelected: ((seasoning: Seasoning, amount: number, unit: string) => void) | null
  setSeasoningCallback: (
    onSelect: ((seasoning: Seasoning, amount: number, unit: string) => void) | null
  ) => void

  reset: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentStore: null,
  currentUser: null,
  currentSession: null,
  level: 'BEGINNER',
  kitchenLayout: null,
  ingredients: [],
  recipes: [],
  seasonings: [], // 조미료 데이터 (기존 UI 호환용)

  // 그리드 기반 주방 시스템
  kitchenGrid: null,
  kitchenEquipment: [],

  storageCache: {},

  isPlaying: false,
  elapsedSeconds: 0,
  completedMenus: 0,
  targetMenus: TARGET_MENUS,
  woks: [...INITIAL_WOKS],
  menuQueue: [],
  actionLogs: [],
  burnerUsageHistory: [],
  usedMenuNames: new Set(),
  lastServeError: null,
  
  fridgeViewState: 'CLOSED',
  selectedFridgePosition: null,
  selectedFloor: null,

  // 시점 이동 초기값
  currentZone: 'COOKING',
  decoZoneRect: null,

  // 재료 선택 모드 초기값
  ingredientMode: null,

  // 데코존 초기값
  decoPlates: [],
  decoSettingItems: [],
  decoMistakes: 0,
  selectedDecoIngredient: null,

  // 합치기 모드 초기값
  mergeMode: false,
  selectedSourcePlateId: null,

  // 묶음 상태 초기값
  activeBundles: new Map(),

  // Supabase 마스터 데이터 초기값
  plateTypes: [],
  recipeBundles: [],
  decoIngredients: [], // v3: decoDefaultItems → decoIngredients
  decoSteps: [], // v3: decoRules → decoSteps
  ingredientSpecialActions: [],

  // 완료된 특수 액션 ID 초기값
  completedSpecialActionIds: [],

  // 재료 선택 콜백 (StorageEquipment에서 사용)
  onIngredientSelected: null,
  onMultipleIngredientsSelected: null,
  setIngredientCallbacks: (onSelect, onMultiple) => set({
    onIngredientSelected: onSelect,
    onMultipleIngredientsSelected: onMultiple ?? null,
  }),

  // 조미료 선택 콜백 (SeasoningEquipment에서 사용)
  onSeasoningSelected: null,
  setSeasoningCallback: (onSelect) => set({
    onSeasoningSelected: onSelect,
  }),

  setStore: (store) => set({ currentStore: store }),
  setUser: (user) => set({ currentUser: user }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setLevel: (level) => set({ level }),

  resetGameState: () => {
    const { kitchenEquipment } = get()
    const woks = kitchenEquipment.length > 0
      ? createWoksFromEquipment(kitchenEquipment)
      : INITIAL_WOKS.map((w) => ({ ...w }))

    set({
      woks,
      menuQueue: [],
      actionLogs: [],
      burnerUsageHistory: [],
      elapsedSeconds: 0,
      completedMenus: 0,
      usedMenuNames: new Set(),
      lastServeError: null,
      // 데코존 상태 초기화
      decoPlates: [],
      decoSettingItems: [],
      decoMistakes: 0,
      selectedDecoIngredient: null,
      mergeMode: false,
      selectedSourcePlateId: null,
      activeBundles: new Map(),
    })
  },

  reset: () => {
    set({
      currentStore: null,
      currentUser: null,
      currentSession: null,
      level: 'BEGINNER',
      kitchenLayout: null,
      ingredients: [],
      recipes: [],
      seasonings: [],
      kitchenGrid: null,
      kitchenEquipment: [],
      storageCache: {},
      isPlaying: false,
      elapsedSeconds: 0,
      completedMenus: 0,
      targetMenus: TARGET_MENUS,
      woks: INITIAL_WOKS.map((w) => ({ ...w })),
      menuQueue: [],
      actionLogs: [],
      burnerUsageHistory: [],
      usedMenuNames: new Set(),
      lastServeError: null,
      fridgeViewState: 'CLOSED',
      selectedFridgePosition: null,
      selectedFloor: null,
      currentZone: 'COOKING',
      decoZoneRect: null,
      // 데코존/묶음/콜드메뉴 상태 초기화
      ingredientMode: null,
      decoPlates: [],
      decoSettingItems: [],
      decoMistakes: 0,
      selectedDecoIngredient: null,
      activeBundles: new Map(),
      plateTypes: [],
      recipeBundles: [],
      decoIngredients: [], // v3: decoDefaultItems → decoIngredients
      decoSteps: [], // v3: decoRules → decoSteps
      ingredientSpecialActions: [],
      completedSpecialActionIds: [],
    })
  },

  tickTimer: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  checkMenuTimers: () => {
    const { menuQueue, elapsedSeconds, woks } = get()
    const now = elapsedSeconds
    
    menuQueue.forEach((order) => {
      const elapsedTime = (now - order.enteredAt) * 1000 // 밀리초로 변환
      
      // 15분 초과 시 자동 취소
      if (elapsedTime > MENU_TIMER.CANCEL_TIME && order.status !== 'COMPLETED') {
        console.warn(`⏰ 메뉴 자동 취소: ${order.menuName} (${Math.floor(elapsedTime / 60000)}분 경과)`)
        
        // 해당 메뉴를 조리 중이던 웍 정보 찾기
        const assignedWok = woks.find((w) => w.currentOrderId === order.id)
        
        // 웍에서 메뉴 제거 (조리 중이었다면)
        if (assignedWok) {
          set((s) => ({
            woks: s.woks.map((w) =>
              w.burnerNumber === assignedWok.burnerNumber
                ? {
                    ...w,
                    state: 'DIRTY' as const,
                    currentMenu: null,
                    currentOrderId: null,
                    currentBundleId: null,
                    currentStep: 0,
                    stepStartTime: null,
                    isOn: false,
                    burnerOnSince: null,
                    addedIngredientIds: [],
                    recipeErrors: 0,
                    totalSteps: 0,
                  }
                : w
            ),
          }))
        }
        
        // 메뉴큐에서 제거
        set((s) => ({
          menuQueue: s.menuQueue.filter((o) => o.id !== order.id),
        }))
        
        // 로그 기록
        get().logAction({
          actionType: 'MENU_CANCELLED',
          menuName: order.menuName,
          burnerNumber: assignedWok?.burnerNumber,
          isCorrect: false,
          message: `❌ ${order.menuName} 15분 초과로 자동 취소`,
        })
      }
    })
  },

  addMenuToQueue: (menuName) => {
    const id = `order-${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((s) => ({
      menuQueue: [
        ...s.menuQueue,
        {
          id,
          menuName,
          enteredAt: s.elapsedSeconds,
          status: 'WAITING' as const,
          assignedBurner: null,
        },
      ],
      usedMenuNames: new Set([...s.usedMenuNames, menuName]),
    }))
  },

  assignMenuToWok: (menuId, burnerNumber, bundleId) => {
    const { woks, menuQueue, getRecipeByMenuName } = get()
    const order = menuQueue.find((o) => o.id === menuId)
    if (!order || order.status !== 'WAITING') return

    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || wok.state !== 'CLEAN' || wok.currentMenu) return

    const recipe = getRecipeByMenuName(order.menuName)
    if (!recipe) return

    // v3: recipe_bundles에서 스텝 추출
    const filteredSteps = get().getRecipeSteps(recipe, bundleId)
    const totalSteps = filteredSteps.length

    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? {
              ...w,
              currentMenu: order.menuName,
              currentOrderId: order.id,
              currentBundleId: bundleId ?? null, // 묶음 ID 저장
              currentStep: 0,
              stepStartTime: Date.now(),
              isOn: true,
              burnerOnSince: Date.now(),
              addedIngredientIds: [], // 초기화
              stirFryCount: 0, // 볶기 횟수 초기화
              recipeErrors: 0, // 오류 횟수 초기화
              totalSteps: totalSteps, // 해당 묶음의 스텝 수 저장
            }
          : w
      ),
      menuQueue: s.menuQueue.map((o) =>
        o.id === menuId ? { ...o, status: 'COOKING' as const, assignedBurner: burnerNumber } : o
      ),
    }))
    get().logAction({
      actionType: 'ASSIGN_MENU',
      menuName: order.menuName,
      burnerNumber,
      isCorrect: true,
      message: `화구${burnerNumber}: ${order.menuName}${bundleId ? ' (묶음)' : ''} 배정`,
    })
  },

  updateWok: (burnerNumber, updates) => {
    set((s) => ({
      woks: s.woks.map((w) => (w.burnerNumber === burnerNumber ? { ...w, ...updates } : w)),
    }))
  },

  // 모든 웍의 온도 계산 및 업데이트 (1초마다 호출)
  updateWokTemperatures: () => {
    const now = Date.now()
    set((s) => ({
      woks: s.woks.map((wok) => {
        let newTemp = wok.temperature
        let newWaterTemp = wok.waterTemperature
        let newWaterBoilStartTime = wok.waterBoilStartTime
        let newIsBoiling = wok.isBoiling

        if (wok.hasWater) {
          // 물이 있을 때 - 물 온도 계산
          if (wok.isOn && newWaterTemp < WOK_TEMP.WATER_BOIL) {
            // 100도까지 천천히 가열 (30초)
            newWaterTemp = Math.min(newWaterTemp + WOK_TEMP.WATER_HEAT_RATE, WOK_TEMP.WATER_BOIL)
            
            // 100도 도달 시
            if (newWaterTemp >= WOK_TEMP.WATER_BOIL && !newWaterBoilStartTime) {
              newWaterBoilStartTime = now
            }
          }
          
          // 100도에서 5초 유지하면 끓기 시작
          if (newWaterTemp >= WOK_TEMP.WATER_BOIL && newWaterBoilStartTime) {
            const boilDuration = now - newWaterBoilStartTime
            if (boilDuration >= WOK_TEMP.WATER_BOIL_DURATION && !newIsBoiling) {
              newIsBoiling = true
            }
          }
          
          // 불이 꺼지면 물도 식음
          if (!wok.isOn) {
            newWaterTemp = Math.max(newWaterTemp - WOK_TEMP.COOL_RATE, WOK_TEMP.AMBIENT)
            if (newWaterTemp < WOK_TEMP.WATER_BOIL) {
              newWaterBoilStartTime = null
              newIsBoiling = false
            }
          }
          
          return {
            ...wok,
            waterTemperature: newWaterTemp,
            waterBoilStartTime: newWaterBoilStartTime,
            isBoiling: newIsBoiling,
          }
        }

        // 물이 없을 때 - 일반 온도 계산
        if (wok.isOn) {
          // 불 세기별 가열률 적용
          const heatMultiplier = WOK_TEMP.HEAT_MULTIPLIER[wok.heatLevel as 1 | 2 | 3] || 1.0
          
          // 초반은 빠르게, 후반은 지수적으로 느리게
          const tempDiff = WOK_TEMP.MAX_SAFE - wok.temperature
          const tempRatio = tempDiff / (WOK_TEMP.MAX_SAFE - WOK_TEMP.AMBIENT)
          // 지수를 2로 설정 (완만한 곡선)
          const heatRate = WOK_TEMP.BASE_HEAT_RATE * heatMultiplier * Math.pow(tempRatio, 2)
          
          newTemp = Math.min(wok.temperature + heatRate, WOK_TEMP.MAX_SAFE)
        } else {
          // 불이 꺼져 있으면 온도 하강
          newTemp = Math.max(wok.temperature - WOK_TEMP.COOL_RATE, WOK_TEMP.AMBIENT)
        }

        // 온도 기반 상태 자동 전환
        let newState = wok.state
        
        // WET 상태에서 180도 도달 시 CLEAN으로 자동 변경
        if (wok.state === 'WET' && newTemp >= 180) {
          newState = 'CLEAN'
        }
        
        if (newTemp >= WOK_TEMP.BURNED && wok.state !== 'BURNED') {
          // 400°C 이상 → 타버림
          newState = 'BURNED'
          console.warn(`화구${wok.burnerNumber}: 🔥 타버림! (온도: ${Math.round(newTemp)}°C)`)
          
          // 메뉴 실패 처리
          const orderId = wok.currentOrderId
          if (orderId) {
            setTimeout(() => {
              useGameStore.setState((st) => ({
                menuQueue: st.menuQueue.map((o) =>
                  o.id === orderId
                    ? { ...o, status: 'WAITING' as const, assignedBurner: null }
                    : o
                ),
              }))
            }, 0)
          }
          
          return {
            ...wok,
            temperature: newTemp,
            state: newState,
            isOn: false,
            burnerOnSince: null,
            currentMenu: null,
            currentOrderId: null,
            currentBundleId: null,
            currentStep: 0,
            stepStartTime: null,
            addedIngredientIds: [],
            isStirFrying: false,
            stirFryStartTime: null,
            stirFryCount: 0,
            hasWater: false,
            waterTemperature: WOK_TEMP.AMBIENT,
            waterBoilStartTime: null,
            isBoiling: false,
          }
        } else if (newTemp >= WOK_TEMP.OVERHEATING && newTemp < WOK_TEMP.BURNED) {
          // 360~400°C → 과열
          if (wok.state !== 'OVERHEATING' && wok.state !== 'BURNED') {
            newState = 'OVERHEATING'
            console.warn(`화구${wok.burnerNumber}: ⚠️ 과열! (온도: ${Math.round(newTemp)}°C)`)
          }
        } else if (newTemp < WOK_TEMP.OVERHEATING && wok.state === 'OVERHEATING') {
          // 360°C 미만 → 정상 복귀
          newState = 'CLEAN'
        }

        return {
          ...wok,
          temperature: newTemp,
          state: newState,
        }
      }),
    }))
  },

  // 불 세기 조절
  setHeatLevel: (burnerNumber, level) => {
    if (level < 1 || level > 3) return
    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? { ...w, heatLevel: level }
          : w
      ),
    }))
  },

  // 볶기 시작 (온도 체크)
  startStirFry: (burnerNumber) => {
    const { woks } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok) return false

    // 최소 볶기 온도 확인
    if (wok.temperature < WOK_TEMP.MIN_STIR_FRY) {
      return false
    }

    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? { ...w, isStirFrying: true, stirFryStartTime: Date.now() }
          : w
      ),
    }))
    return true
  },

  // 볶기 중지
  stopStirFry: (burnerNumber) => {
    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? { ...w, isStirFrying: false, stirFryStartTime: null }
          : w
      ),
    }))
  },

  washWok: (burnerNumber) => {
    const { woks } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok) return
    if (wok.state !== 'DIRTY' && wok.state !== 'BURNED') return
    if (wok.isOn) return

    // 1. 웍이 싱크대로 이동
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { ...w, position: 'MOVING_TO_SINK' as const, currentOrderId: null }
            : w
        ),
      }))

    setTimeout(() => {
      // 2. 싱크대 도착 → 씻기 시작 (온도 초기화)
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { 
                ...w, 
                position: 'AT_SINK' as const, 
                state: 'WET' as const, 
                currentMenu: null, 
                currentStep: 0, 
                stepStartTime: null,
                temperature: WOK_TEMP.AMBIENT, // 온도 초기화
                isStirFrying: false,
                stirFryStartTime: null,
                stirFryCount: 0, // 볶기 횟수 초기화
                hasWater: false, // 물 제거
                waterTemperature: WOK_TEMP.AMBIENT,
                waterBoilStartTime: null,
                isBoiling: false,
              }
            : w
        ),
      }))
      
      get().logAction({
        actionType: 'WASH_WOK',
        burnerNumber,
        isCorrect: true,
        message: `화구${burnerNumber} 웍 씻기`,
      })

      setTimeout(() => {
        // 3. 화구로 복귀
        set((s) => ({
          woks: s.woks.map((w) =>
            w.burnerNumber === burnerNumber
              ? { ...w, position: 'MOVING_TO_BURNER' as const }
              : w
          ),
        }))

        setTimeout(() => {
          // 4. 화구 도착 (WET 상태 유지)
          set((s) => ({
            woks: s.woks.map((w) =>
              w.burnerNumber === burnerNumber
                ? { ...w, position: 'AT_BURNER' as const }
                : w
            ),
          }))
        }, 800)
      }, 2000)
    }, 800)
  },

  toggleBurner: (burnerNumber) => {
    const { woks } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok) return

    // 일반 on/off 토글
    const newIsOn = !wok.isOn
    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber 
          ? { ...w, isOn: newIsOn, burnerOnSince: newIsOn ? Date.now() : null } 
          : w
      ),
    }))
  },

  emptyWok: (burnerNumber) => {
    const { woks } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu) return

    const menuName = wok.currentMenu
    const orderId = wok.currentOrderId

    console.log(`화구${burnerNumber}: 🗑️ 웍 비우기 - ${menuName} 버림`)

    // 웍 상태를 DIRTY로 변경하고 메뉴 정보 초기화
    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? {
              ...w,
              state: 'DIRTY' as const,
              currentMenu: null,
              currentOrderId: null,
              currentBundleId: null,
              currentStep: 0,
              stepStartTime: null,
              isOn: false,
              burnerOnSince: null,
              addedIngredientIds: [],
              temperature: WOK_TEMP.AMBIENT,
              isStirFrying: false,
              stirFryStartTime: null,
              recipeErrors: 0,
              totalSteps: 0,
              hasWater: false,
              waterTemperature: WOK_TEMP.AMBIENT,
              waterBoilStartTime: null,
              isBoiling: false,
            }
          : w
      ),
      // 메뉴를 다시 WAITING 상태로 되돌림 (재배정 가능)
      menuQueue: orderId
        ? s.menuQueue.map((o) =>
            o.id === orderId
              ? { ...o, status: 'WAITING' as const, assignedBurner: null }
              : o
          )
        : s.menuQueue,
    }))

    get().logAction({
      actionType: 'EMPTY_WOK',
      menuName,
      burnerNumber,
      isCorrect: true,
      message: `화구${burnerNumber}: 웍 비우기 - ${menuName} 버림`,
    })
  },

  serve: (burnerNumber) => {
    const { woks, completedMenus, targetMenus, getRecipeByMenuName, level, elapsedSeconds, menuQueue } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu || !wok.currentOrderId) return false

    const recipe = getRecipeByMenuName(wok.currentMenu)
    // v3: recipe_bundles에서 스텝 추출 (이미 정렬됨)
    const sortedSteps = get().getRecipeSteps(recipe, wok.currentBundleId)
    if (!recipe || !sortedSteps.length) return false
    const isComplete = wok.currentStep >= sortedSteps.length
    if (!isComplete) {
      console.warn(`화구${burnerNumber}: 아직 조리가 완료되지 않았습니다. (${wok.currentStep}/${sortedSteps.length})`)
      return false
    }

    // 서빙 전에 필요한 정보 저장
    const completedOrderId = wok.currentOrderId
    const completedMenuName = wok.currentMenu
    const recipeErrors = wok.recipeErrors
    const totalSteps = wok.totalSteps
    const isBeginnerLevel = level === 'BEGINNER'
    
    // 주문 시간 정보 가져오기
    const order = menuQueue.find((o) => o.id === completedOrderId)
    const cookingTime = order ? (elapsedSeconds - order.enteredAt) * 1000 : 0 // 밀리초
    const timeScore = calculateTimeScore(cookingTime)

    // 레시피 정확도 계산 (신입이 아닐 때만)
    let recipeAccuracy = 100
    if (!isBeginnerLevel && totalSteps > 0) {
      recipeAccuracy = Math.max(0, Math.round(((totalSteps - recipeErrors) / totalSteps) * 100))
    }
    
    // 레시피 정확도를 시간 점수에 반영
    // 레시피 오류가 있으면 10~15분 사이 점수 (30점)로 처리
    const finalRecipeScore = recipeErrors > 0 ? 30 : 100
    
    // 최종 점수: 시간 점수와 레시피 점수의 평균
    const finalScore = Math.round((timeScore.score + finalRecipeScore) / 2)

    set((s) => ({
      menuQueue: s.menuQueue.map((o) =>
        o.id === completedOrderId
          ? { ...o, status: 'COMPLETED' as const, servedAt: new Date() }
          : o
      ),
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? { ...w, state: 'DIRTY' as const, currentMenu: null, currentOrderId: null, currentBundleId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null, addedIngredientIds: [], recipeErrors: 0, totalSteps: 0 }
          : w
      ),
      completedMenus: s.completedMenus + 1,
    }))

    get().logAction({
      actionType: 'SERVE',
      menuName: completedMenuName,
      burnerNumber,
      isCorrect: true,
      message: `${completedMenuName} 서빙 완료 (${timeScore.message}, 레시피: ${recipeAccuracy}%, 최종: ${finalScore}점)`,
    })

    // 신입이 아니고 오류가 있을 때 잠깐 알림 표시
    if (!isBeginnerLevel && (recipeErrors > 0 || timeScore.tier !== 'perfect')) {
      const errorMessage = recipeErrors > 0 
        ? `⚠️ 레시피 오류: ${recipeErrors}/${totalSteps} (정확도: ${recipeAccuracy}%)\n${timeScore.message}\n최종 점수: ${finalScore}점`
        : `${timeScore.message}\n최종 점수: ${finalScore}점`
      console.warn(`화구${burnerNumber}: ${errorMessage}`)
      
      // UI에 표시하기 위해 임시 상태 저장
      set(() => ({
        lastServeError: {
          burnerNumber,
          menuName: completedMenuName,
          errors: recipeErrors,
          totalSteps,
          accuracy: recipeAccuracy,
          timestamp: Date.now(),
        }
      }))
      
      // 3초 후 에러 메시지 제거
      setTimeout(() => {
        set(() => ({
          lastServeError: null
        }))
      }, 3000)
    }

    // 3초 후 완료된 주문카드 제거 (orderId로 정확하게 매칭)
    setTimeout(() => {
      set((s) => ({
        menuQueue: s.menuQueue.filter((o) => o.id !== completedOrderId),
      }))
    }, 3000)

    return completedMenus + 1 >= targetMenus
  },

  logAction: (action) => {
    const { elapsedSeconds } = get()
    const log: ActionLog = {
      timestamp: new Date(),
      elapsedSeconds,
      ...action,
    }
    set((s) => ({ actionLogs: [...s.actionLogs, log] }))

    // DB 로깅은 스킵 (v3 스키마 호환성 문제)
    // 로컬 actionLogs 배열에만 저장됨
  },

  recordBurnerUsage: () => {
    const { woks } = get()
    const activeBurners = woks.filter((w) => w.isOn).map((w) => w.burnerNumber)
    set((s) => ({
      burnerUsageHistory: [
        ...s.burnerUsageHistory,
        { timestamp: Date.now(), activeBurners },
      ],
    }))
  },

  loadStoreData: async (storeId) => {
    // 기본 데이터 로드 (v3: kitchen_layouts, seasonings 테이블 삭제됨)
    try {
      const [ingredientsRes, recipesRes] = await Promise.all([
        supabase
          .from('ingredients_inventory')
          .select('*, ingredient_master:ingredients_master(*), storage_location:storage_locations(*)')
          .eq('store_id', storeId),
        // v3: recipe_bundles 중첩 구조로 변경
        supabase
          .from('recipes')
          .select(
            `*,
            recipe_bundles(
              *,
              plate_type:plate_types(*),
              recipe_steps(
                *,
                recipe_ingredients(
                  *,
                  ingredient_master:ingredients_master(*),
                  inventory:ingredients_inventory(
                    *,
                    storage_location:storage_locations(*)
                  )
                )
              )
            )`
          )
          .eq('store_id', storeId),
      ])

      // v3: 조미료는 ingredients_inventory에서 location_type='SEASONING'으로 필터
      const seasoningsFromInventory = (ingredientsRes.data ?? [])
        .filter((inv: any) => inv.storage_location?.location_type === 'SEASONING')
        .map((inv: any) => ({
          id: inv.id,
          store_id: inv.store_id,
          seasoning_name: inv.ingredient_master?.ingredient_name ?? inv.id,
          position_code: inv.storage_location?.location_code ?? 'UNKNOWN',
          position_name: inv.storage_location?.location_name ?? '조미료',
          base_unit: inv.standard_unit,
          ingredient_master_id: inv.ingredient_master_id,
        }))

      set({
        kitchenLayout: null, // v3: kitchen_layouts 삭제됨
        ingredients: ingredientsRes.data ?? [],
        recipes: recipesRes.data ?? [],
        seasonings: seasoningsFromInventory as Seasoning[],
      })
    } catch (error) {
      console.error('❌ 기본 데이터 로드 실패:', error)
      // 기본 데이터 로드 실패해도 계속 진행
    }

    // === 그리드 기반 주방 데이터 로드 ===
    try {
      const { data: gridData, error: gridError } = await supabase
        .from('kitchen_grids')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .maybeSingle()

      if (gridError) {
        console.warn('⚠️ kitchen_grids 로드 실패:', gridError.message)
        set({ kitchenGrid: null, kitchenEquipment: [] })
        // return 제거 - 데코 데이터 로드를 계속 진행
      } else if (!gridData) {
        console.warn('⚠️ 해당 매장의 kitchen_grids 데이터가 없습니다. 레거시 레이아웃 사용.')
        set({ kitchenGrid: null, kitchenEquipment: [] })
        // return 제거 - 데코 데이터 로드를 계속 진행
      } else {
        // gridData가 있을 때만 equipment 로드
        const { data: equipmentData, error: equipmentError } = await supabase
          .from('kitchen_equipment')
          .select('*')
          .eq('kitchen_grid_id', gridData.id)
          .eq('is_active', true)
          .order('display_order')

        if (equipmentError) {
          console.warn('⚠️ kitchen_equipment 로드 실패:', equipmentError.message)
          set({ kitchenGrid: gridData as KitchenGrid, kitchenEquipment: [] })
        } else {
          const equipmentList = (equipmentData ?? []) as KitchenEquipment[]
          const dynamicWoks = createWoksFromEquipment(equipmentList)

          set({
            kitchenGrid: gridData as KitchenGrid,
            kitchenEquipment: equipmentList,
            woks: dynamicWoks,
          })
        }
      }
    } catch (error) {
      console.error('❌ 그리드 주방 데이터 로드 중 예외:', error)
      // 기존 기능 유지 - 에러 시에도 레거시 레이아웃 사용
    }

    // === 데코존/묶음/콜드메뉴 마스터 데이터 로드 ===
    try {
      const { recipes } = get()
      const recipeIds = recipes.map((r) => r.id)

      // v3: store_id 기반 데이터 병렬 로드
      const [decoIngredientsRes, plateTypesRes] = await Promise.all([
        // v3: deco_default_items → deco_ingredients
        supabase
          .from('deco_ingredients')
          .select('*, ingredient_master:ingredients_master(*)')
          .eq('store_id', storeId)
          .order('display_order'),
        supabase.from('plate_types').select('*').eq('store_id', storeId),
      ])

      const plateTypes = (plateTypesRes.data ?? []) as PlateType[]
      const decoIngredients = (decoIngredientsRes.data ?? []) as DecoIngredient[]

      // store_id 기반 데이터 저장
      set({ plateTypes, decoIngredients })

      // recipe_id 기반 데이터는 레시피가 있어야 로드
      if (recipeIds.length === 0) {
        return
      }

      // v3: recipe_id 기반 데이터 병렬 로드 (deco_item_images 제거)
      const [
        recipeBundlesRes,
        decoStepsRes,
        specialActionsRes,
      ] = await Promise.all([
        // recipe_id 기반 + JOIN (plate_type 정보 포함)
        supabase
          .from('recipe_bundles')
          .select('*, plate_type:plate_types(*)')
          .in('recipe_id', recipeIds)
          .order('bundle_order'),
        // v3: deco_rules → deco_steps
        supabase
          .from('deco_steps')
          .select('*')
          .in('recipe_id', recipeIds)
          .order('deco_order'),
        // recipe_id 기반
        supabase
          .from('ingredient_special_actions')
          .select('*')
          .in('recipe_id', recipeIds),
      ])

      const recipeBundles = (recipeBundlesRes.data ?? []) as RecipeBundle[]
      const decoSteps = (decoStepsRes.data ?? []) as DecoStep[]
      const ingredientSpecialActions = (specialActionsRes.data ?? []) as IngredientSpecialAction[]

      set({
        recipeBundles,
        decoSteps, // v3: decoRules → decoSteps
        ingredientSpecialActions,
      })
    } catch (error) {
      console.error('❌ 데코 마스터 데이터 로드 예외:', error)
    }
  },

  preloadStorageData: async (storeId) => {
    // 모든 냉장고/서랍 위치 코드
    const locationCodes = [
      'FRIDGE_LT_F1', 'FRIDGE_LT_F2',
      'FRIDGE_RT_F1', 'FRIDGE_RT_F2',
      'FRIDGE_LB_F1', 'FRIDGE_LB_F2',
      'FRIDGE_RB_F1', 'FRIDGE_RB_F2',
      'DRAWER_LT', 'DRAWER_RT', 'DRAWER_LB', 'DRAWER_RB',
    ]

    // 모든 위치의 데이터를 병렬로 로드
    const results = await Promise.all(
      locationCodes.map(async (locationCode) => {
        try {
          // .single() 대신 .maybeSingle() 사용 (데이터 없어도 에러 안 남)
          const { data: location, error: locationError } = await supabase
            .from('storage_locations')
            .select('*')
            .eq('location_code', locationCode)
            .eq('store_id', storeId)
            .maybeSingle()

          if (locationError) {
            console.warn(`⚠️ ${locationCode} 조회 에러:`, locationError)
            return { locationCode, data: null }
          }

          if (!location) {
            return { locationCode, data: null }
          }

          const { data: ingredients, error: ingredientsError } = await supabase
            .from('ingredients_inventory')
            .select('*, ingredient_master:ingredients_master(*)')
            .eq('storage_location_id', location.id)
            .not('grid_positions', 'is', null)

          if (ingredientsError) {
            console.warn(`⚠️ ${locationCode} 식자재 조회 에러:`, ingredientsError)
            return { locationCode, data: null }
          }

          if (!ingredients || ingredients.length === 0) {
            return { locationCode, data: null }
          }

          return {
            locationCode,
            data: {
              title: location.location_name ?? locationCode,
              gridRows: (location as any).grid_rows ?? 3,
              gridCols: (location as any).grid_cols ?? 2,
              ingredients: ingredients as IngredientInventory[],
            },
          }
        } catch (error) {
          console.error(`❌ ${locationCode} 처리 중 예외:`, error)
          return { locationCode, data: null }
        }
      })
    )

    // 캐시에 저장
    const cache: Record<string, any> = {}
    let successCount = 0
    results.forEach((result) => {
      if (result.data) {
        cache[result.locationCode] = result.data
        successCount++
      }
    })

    set({ storageCache: cache })
  },

  startGame: async () => {
    const { currentUser, currentStore, level, resetGameState } = get()
    if (!currentUser || !currentStore) return null

    resetGameState()

    // v3: game_sessions 테이블 스키마가 다를 수 있으므로 로컬 세션 사용
    // DB 저장은 선택적으로 시도 (실패해도 게임 진행 가능)
    const tempSession: GameSession = {
      id: `session-${Date.now()}`,
      user_id: currentUser.id,
      store_id: currentStore.id,
      level,
      total_menus_target: TARGET_MENUS,
      start_time: new Date().toISOString(),
      status: 'IN_PROGRESS',
    }

    const { kitchenEquipment } = get()
    const woks = kitchenEquipment.length > 0
      ? createWoksFromEquipment(kitchenEquipment)
      : INITIAL_WOKS.map((w) => ({ ...w }))

    set({
      currentSession: tempSession,
      isPlaying: true,
      level,
      elapsedSeconds: 0,
      completedMenus: 0,
      menuQueue: [],
      actionLogs: [],
      burnerUsageHistory: [],
      woks,
      usedMenuNames: new Set(),
    })

    // 백그라운드로 DB 저장 시도 (실패해도 무시)
    supabase
      .from('game_sessions')
      .insert({
        user_id: currentUser.id,
        store_id: currentStore.id,
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          // DB 세션 ID로 업데이트
          set((s) => ({
            currentSession: s.currentSession ? { ...s.currentSession, id: data.id } : null
          }))
          console.log('✅ game_session 저장 완료:', data.id)
        }
        // 에러는 무시 (이미 게임 시작됨)
      })

    return tempSession
  },

  endGame: async () => {
    const {
      currentSession,
      completedMenus,
      elapsedSeconds,
      actionLogs,
      burnerUsageHistory,
    } = get()

    if (!currentSession?.id) {
      set({ isPlaying: false })
      return
    }

    const totalActions = actionLogs.length
    const correctActions = actionLogs.filter((l) => l.isCorrect).length
    const recipeAccuracyScore =
      totalActions > 0 ? Math.round((correctActions / totalActions) * 100) : 0

    const targetTime = completedMenus * 120
    const speedScore =
      elapsedSeconds > 0
        ? Math.round(Math.min(100, Math.max(0, (targetTime / elapsedSeconds) * 100)))
        : 0

    const totalPossible = burnerUsageHistory.length * 3
    const actualBurnerSeconds = burnerUsageHistory.reduce(
      (sum, log) => sum + log.activeBurners.length,
      0
    )
    const burnerUsageScore =
      totalPossible > 0 ? Math.round((actualBurnerSeconds / totalPossible) * 100) : 0

    const totalScore = Math.round(
      recipeAccuracyScore * 0.5 + speedScore * 0.3 + burnerUsageScore * 0.2
    )

    await supabase
      .from('game_sessions')
      .update({
        end_time: new Date().toISOString(),
        status: 'COMPLETED',
        completed_menus: completedMenus,
      })
      .eq('id', currentSession.id)

    await supabase.from('game_scores').insert({
      session_id: currentSession.id,
      recipe_accuracy_score: recipeAccuracyScore,
      speed_score: speedScore,
      burner_usage_score: burnerUsageScore,
      total_score: totalScore,
      total_elapsed_time_seconds: elapsedSeconds,
      average_burner_usage_percent: burnerUsageScore,
    })

    set({ isPlaying: false })
  },

  getRecipeByMenuName: (menuName) => {
    return get().recipes.find((r) => r.menu_name === menuName)
  },

  // v3: 레시피에서 스텝 추출 (recipe_bundles 중첩 구조 처리)
  getRecipeSteps: (recipe, bundleId) => {
    if (!recipe?.recipe_bundles?.length) return []

    // bundleId가 있으면 해당 묶음의 스텝만 필터링
    const targetBundles = bundleId
      ? recipe.recipe_bundles.filter((b) => b.id === bundleId)
      : recipe.recipe_bundles

    // 모든 번들의 스텝을 플랫하게 가져와서 정렬
    const allSteps = targetBundles.flatMap((b) => b.recipe_steps ?? [])
    return [...allSteps].sort((a, b) => a.step_number - b.step_number)
  },

  // v3: RecipeIngredient 객체 배열 반환 (FK 기반)
  getCurrentStepIngredients: (menuName, stepIndex, bundleId) => {
    const recipe = get().getRecipeByMenuName(menuName)
    if (!recipe?.recipe_bundles?.length) return []

    // v3: recipe_bundles에서 bundleId로 필터링 후 recipe_steps 가져오기
    const targetBundles = bundleId
      ? recipe.recipe_bundles.filter((b) => b.id === bundleId)
      : recipe.recipe_bundles

    // 모든 번들의 스텝을 플랫하게 가져와서 정렬
    const allSteps = targetBundles.flatMap((b) => b.recipe_steps ?? [])
    const sortedSteps = [...allSteps].sort((a, b) => a.step_number - b.step_number)

    if (stepIndex >= sortedSteps.length) return []
    const step = sortedSteps[stepIndex]

    // v3: recipe_ingredients 배열 직접 반환
    return step.recipe_ingredients ?? []
  },

  // v3: FK 기반 매칭으로 변경 (recipeIngredientId 사용)
  validateAndAdvanceIngredient: (burnerNumber, recipeIngredientId, amount) => {
    const { woks, getRecipeByMenuName, getCurrentStepIngredients, logAction, level } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu) return false

    const recipe = getRecipeByMenuName(wok.currentMenu)
    if (!recipe?.recipe_bundles?.length) return false

    // v3: bundleId가 있으면 해당 묶음의 스텝만 조회
    const reqs = getCurrentStepIngredients(wok.currentMenu, wok.currentStep, wok.currentBundleId)

    // v3: 해당 recipeIngredientId와 일치하는 재료 찾기
    const matchedIngredient = reqs.find((r) => r.id === recipeIngredientId)
    const displayName = matchedIngredient?.display_name
      ?? matchedIngredient?.ingredient_master?.ingredient_name
      ?? recipeIngredientId

    // 디버그 로깅
    console.log(`🔍 validateAndAdvanceIngredient v3 디버그:`)
    console.log(`  - 화구: ${burnerNumber}, 현재 스텝: ${wok.currentStep}`)
    console.log(`  - bundleId: ${wok.currentBundleId}`)
    console.log(`  - 입력 recipeIngredientId: "${recipeIngredientId}", 수량: ${amount}`)
    console.log(`  - 현재 스텝 요구사항 (${reqs.length}개):`, reqs.map(r => ({ id: r.id, name: r.display_name })))
    console.log(`  - 이미 투입된 재료 ID:`, wok.addedIngredientIds)

    const isBeginnerLevel = level === 'BEGINNER'

    // v3: 이미 추가한 재료 ID는 다시 추가 불가
    if (wok.addedIngredientIds.includes(recipeIngredientId)) {
      logAction({
        actionType: 'ADD_TO_WOK',
        menuName: wok.currentMenu,
        burnerNumber,
        ingredientId: recipeIngredientId, // v3: ingredientSKU → ingredientId
        amountInput: amount,
        isCorrect: false,
        message: `화구${burnerNumber}: 이미 투입한 재료입니다 (${displayName})`,
      })
      return false
    }

    // v3: recipeIngredientId와 수량으로 매칭
    const match = reqs.find((r) => r.id === recipeIngredientId && r.required_amount === amount)
    const isCorrect = !!match
    console.log(`  - 매칭 결과: ${isCorrect ? '✅ 정확' : '❌ 오류'}`)

    logAction({
      actionType: 'ADD_TO_WOK',
      menuName: wok.currentMenu,
      burnerNumber,
      ingredientId: recipeIngredientId, // v3: ingredientSKU → ingredientId
      amountInput: amount,
      expectedAmount: match?.required_amount,
      isCorrect,
      message: isCorrect ? `화구${burnerNumber}: 재료 투입 정확 (${displayName})` : `화구${burnerNumber}: 재료 투입 오류`,
    })

    // 신입 단계에서는 틀리면 중단
    if (isBeginnerLevel && !isCorrect) {
      return false
    }

    // 신입이 아닌 경우, 틀려도 오류 카운트만 증가하고 진행
    const errorIncrement = isCorrect ? 0 : 1

    // v3: 재료 투입 시 온도 하락 (ingredient_master.category 기반)
    let tempDrop = WOK_TEMP.COOLING.SEASONING // 기본값

    const category = matchedIngredient?.ingredient_master?.category?.toLowerCase() ?? ''
    const locationTypeRaw = matchedIngredient?.inventory?.storage_location?.location_type
    const locationType = typeof locationTypeRaw === 'string' ? locationTypeRaw.toUpperCase() : ''

    if (locationType === 'SEASONING') {
      tempDrop = WOK_TEMP.COOLING.SEASONING
    } else if (category.includes('vegetable') || category.includes('채소')) {
      tempDrop = WOK_TEMP.COOLING.VEGETABLE
    } else if (category.includes('seafood') || category.includes('해산물')) {
      tempDrop = WOK_TEMP.COOLING.SEAFOOD
    } else if (category.includes('egg') || category.includes('계란')) {
      tempDrop = WOK_TEMP.COOLING.EGG
    } else if (category.includes('rice') || category.includes('밥')) {
      tempDrop = WOK_TEMP.COOLING.RICE
    }

    // 온도 하락 적용
    const newTemp = Math.max(WOK_TEMP.AMBIENT, wok.temperature - tempDrop)

    // v3: 투입한 재료 ID 목록에 추가
    const newAddedIngredientIds = [...wok.addedIngredientIds, recipeIngredientId]

    // v3: 현재 스텝의 모든 재료가 투입되었는지 확인 (ID 기반)
    console.log(`  - 모든 재료 투입 검사:`)
    console.log(`    - 투입 예정 ID 목록:`, newAddedIngredientIds)
    console.log(`    - 요구 재료 ID (${reqs.length}개):`, reqs.map(r => r.id))

    const allIngredientsAdded = reqs.every((req) => {
      const found = newAddedIngredientIds.includes(req.id)
      console.log(`    - 재료 "${req.display_name ?? req.id}" 투입됨: ${found}`)
      return found
    })

    console.log(`  - 모든 재료 투입 완료: ${allIngredientsAdded}`)

    if (allIngredientsAdded) {
      // 모든 재료 투입 완료 → 다음 스텝으로
      const nextStep = wok.currentStep + 1
      console.log(`🎉 화구${burnerNumber}: ✅ 스텝 ${wok.currentStep} 완료 → 스텝 ${nextStep}로 진행`)

      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? {
                ...w,
                currentStep: nextStep,
                stepStartTime: Date.now(),
                burnerOnSince: w.isOn ? Date.now() : w.burnerOnSince,
                addedIngredientIds: [], // 다음 스텝 시작 시 초기화
                temperature: newTemp, // 온도 반영
                recipeErrors: w.recipeErrors + errorIncrement, // 오류 누적
              }
            : w
        ),
      }))
    } else {
      // 아직 더 넣을 재료가 있음
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? {
                ...w,
                addedIngredientIds: newAddedIngredientIds,
                burnerOnSince: w.isOn ? Date.now() : w.burnerOnSince,
                temperature: newTemp, // 온도 반영
                recipeErrors: w.recipeErrors + errorIncrement, // 오류 누적
              }
            : w
        ),
      }))
    }

    return true
  },

  validateAndAdvanceAction: (burnerNumber, actionType) => {
    const { woks, getRecipeByMenuName, logAction, level } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu) return { ok: false }

    const isBeginnerLevel = level === 'BEGINNER'
    const recipe = getRecipeByMenuName(wok.currentMenu)
    // v3: recipe_bundles에서 스텝 추출 (이미 정렬됨)
    const sortedSteps = get().getRecipeSteps(recipe, wok.currentBundleId)
    const step = sortedSteps[wok.currentStep]

    // 현재 스텝이 ACTION 타입이 아닐 때
    if (!step || step.step_type !== 'ACTION') {
      logAction({
        actionType,
        menuName: wok.currentMenu,
        burnerNumber,
        isCorrect: false,
        message: `화구${burnerNumber}: 잘못된 액션 (현재 단계: ${step?.step_type ?? '없음'})`,
      })
      
      // 신입 단계에서는 차단
      if (isBeginnerLevel) {
        return { ok: false }
      }
      
      // 신입이 아니면 물리적 효과만 적용하고 스텝은 진행 안함
      let tempDrop = 0
      let addWater = false
      
      if (actionType === 'FLIP') {
        tempDrop = WOK_TEMP.ACTION_TEMP.FLIP
      } else if (actionType === 'ADD_WATER') {
        addWater = true
      }
      
      const newTemp = Math.max(WOK_TEMP.AMBIENT, wok.temperature - tempDrop)
      
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { 
                ...w,
                temperature: addWater ? WOK_TEMP.AMBIENT : newTemp,
                hasWater: addWater,
                waterTemperature: addWater ? WOK_TEMP.AMBIENT : w.waterTemperature,
                waterBoilStartTime: null,
                isBoiling: false,
                recipeErrors: w.recipeErrors + 1, // 오류 카운트
              }
            : w
        ),
      }))
      
      return { ok: true } // 신입이 아니면 물리적 효과는 적용됨
    }

    const isCorrectAction = step.action_type === actionType
    const limitMs = (step.time_limit_seconds ?? 999) * 1000
    const timingCorrect = !wok.stepStartTime || Date.now() - wok.stepStartTime <= limitMs

    // 볶기 액션 처리 - 현재 스텝이 볶기면 레시피 진행, 아니면 온도 조절용
    if (actionType === 'STIR_FRY') {
      // 온도 하락 (1초 후 적용)
      setTimeout(() => {
        const tempDrop = WOK_TEMP.ACTION_TEMP.STIR_FRY
        const currentWok = get().woks.find((w) => w.burnerNumber === burnerNumber)
        if (currentWok) {
          const newTemp = Math.max(WOK_TEMP.AMBIENT, currentWok.temperature - tempDrop)

          set((s) => ({
            woks: s.woks.map((w) =>
              w.burnerNumber === burnerNumber
                ? { ...w, temperature: newTemp }
                : w
            ),
          }))
        }
      }, 1000)
      
      if (isCorrectAction) {
        // 현재 스텝이 볶기 - 레시피 진행
        logAction({
          actionType,
          menuName: wok.currentMenu,
          burnerNumber,
          isCorrect: isCorrectAction && timingCorrect,
          timingCorrect,
          message: `화구${burnerNumber}: 볶기 완료 (레시피 진행)`,
        })

        // 신입 단계에서만 타이밍 오류 시 타버림 처리
        if (isBeginnerLevel && !timingCorrect) {
          const orderId = wok.currentOrderId
          set((s) => ({
            woks: s.woks.map((w) =>
              w.burnerNumber === burnerNumber 
                ? { ...w, state: 'BURNED' as const, currentMenu: null, currentOrderId: null, currentBundleId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null, addedIngredientIds: [], recipeErrors: 0, totalSteps: 0 } 
                : w
            ),
            menuQueue: orderId 
              ? s.menuQueue.map((o) =>
                  o.id === orderId
                    ? { ...o, status: 'WAITING' as const, assignedBurner: null }
                    : o
                )
              : s.menuQueue,
          }))
          return { ok: false, burned: true }
        }

        // 다음 스텝으로 진행
        set((s) => ({
          woks: s.woks.map((w) =>
            w.burnerNumber === burnerNumber
              ? { 
                  ...w, 
                  currentStep: w.currentStep + 1, 
                  stepStartTime: Date.now(),
                  burnerOnSince: w.isOn ? Date.now() : w.burnerOnSince,
                  addedIngredientIds: [], // 다음 스텝 시작 시 재료 목록 초기화
                  recipeErrors: w.recipeErrors + (timingCorrect ? 0 : 1), // 타이밍 오류 카운트
                }
              : w
          ),
        }))
        return { ok: true }
      } else {
        // 현재 스텝이 볶기가 아님 - 온도 조절용
        return { ok: true }
      }
    }

    // 일반 액션 처리
    logAction({
      actionType,
      menuName: wok.currentMenu,
      burnerNumber,
      isCorrect: isCorrectAction && timingCorrect,
      timingCorrect,
      message: isCorrectAction && timingCorrect ? `화구${burnerNumber}: ${actionType} 완료` : `화구${burnerNumber}: 액션 오류`,
    })

    // 신입 단계에서는 틀린 액션 시 중단
    if (isBeginnerLevel && !isCorrectAction) {
      return { ok: false }
    }
    
    // 액션별 온도 하락 및 물 시스템
    let tempDrop = 0
    let addWater = false
    
    if (actionType === 'FLIP') {
      tempDrop = WOK_TEMP.ACTION_TEMP.FLIP
    } else if (actionType === 'ADD_WATER') {
      addWater = true // 물 추가 모드
    }
    
    const newTemp = Math.max(WOK_TEMP.AMBIENT, wok.temperature - tempDrop)

    // 신입 단계에서만 타이밍 오류 시 타버림 처리
    if (isBeginnerLevel && !timingCorrect) {
      const orderId = wok.currentOrderId
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber 
            ? { ...w, state: 'BURNED' as const, currentMenu: null, currentOrderId: null, currentBundleId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null, addedIngredientIds: [], recipeErrors: 0, totalSteps: 0 } 
            : w
        ),
        menuQueue: orderId 
          ? s.menuQueue.map((o) =>
              o.id === orderId
                ? { ...o, status: 'WAITING' as const, assignedBurner: null }
                : o
            )
          : s.menuQueue,
      }))
      return { ok: false, burned: true }
    }

    // 정확한 액션일 때만 스텝 진행, 틀렸을 때는 오류 카운트만 (신입 아닐 때)
    if (isCorrectAction) {
      // 액션 성공 시 타이머 리셋하고 다음 스텝으로
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { 
                ...w, 
                currentStep: w.currentStep + 1, 
                stepStartTime: Date.now(),
                burnerOnSince: w.isOn ? Date.now() : w.burnerOnSince,
                temperature: addWater ? WOK_TEMP.AMBIENT : newTemp,
                addedIngredientIds: [], // 다음 스텝 시작 시 재료 목록 초기화
                hasWater: addWater,
                waterTemperature: addWater ? WOK_TEMP.AMBIENT : w.waterTemperature,
                waterBoilStartTime: null,
                isBoiling: false,
                recipeErrors: w.recipeErrors + (!timingCorrect ? 1 : 0), // 타이밍 오류만 카운트
              }
            : w
        ),
      }))
      return { ok: true }
    } else {
      // 틀린 액션이지만 신입이 아니면 오류 카운트만 하고 물/온도 효과는 적용
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { 
                ...w,
                temperature: addWater ? WOK_TEMP.AMBIENT : newTemp,
                hasWater: addWater,
                waterTemperature: addWater ? WOK_TEMP.AMBIENT : w.waterTemperature,
                waterBoilStartTime: null,
                isBoiling: false,
                recipeErrors: w.recipeErrors + 1, // 틀린 액션 카운트
              }
            : w
        ),
      }))
      return { ok: true } // 신입이 아니면 틀려도 진행
    }
  },
  
  // 4호박스 뷰 액션 구현
  openFridgeZoom: (position) => set({ 
    fridgeViewState: 'ZOOMED', 
    selectedFridgePosition: position 
  }),
  
  closeFridgeView: () => set({ 
    fridgeViewState: 'CLOSED', 
    selectedFridgePosition: null, 
    selectedFloor: null 
  }),
  
  openFridgeDoor: () => set({ fridgeViewState: 'DOOR_OPEN' }),
  
  selectFloor: (floor) => set({ 
    fridgeViewState: 'GRID_VIEW', 
    selectedFloor: floor 
  }),
  
  backToFridgeZoom: () => set({
    fridgeViewState: 'ZOOMED',
    selectedFloor: null
  }),

  // 시점 이동
  setZone: (zone) => set({ currentZone: zone }),

  // 데코존 열기 (현재 위치 캡처 후 DECO 모드로 전환)
  openDecoZone: () => {
    const el = document.querySelector('[data-prep-table-placeholder]')
    if (el) {
      const r = el.getBoundingClientRect()
      set({
        decoZoneRect: { top: r.top, left: r.left, width: r.width, height: r.height },
        currentZone: 'DECO',
      })
    } else {
      set({ currentZone: 'DECO' })
    }
  },

  // 재료 선택 모드 설정
  setIngredientMode: (mode) => set({ ingredientMode: mode }),

  // 데코존에 플레이트 추가 (최대 6개)
  addToDecoZone: (plate) => {
    const { decoPlates } = get()
    if (decoPlates.length >= 6) {
      console.warn('❌ 데코존 최대 수용량 초과 (6개)')
      return false
    }
    set((s) => ({
      decoPlates: [...s.decoPlates, plate],
    }))
    return true
  },

  // 데코존에서 플레이트 제거
  removeFromDecoZone: (plateId) => {
    set((s) => ({
      decoPlates: s.decoPlates.filter((p) => p.id !== plateId),
    }))
  },

  // 데코존에서 재료 선택
  selectDecoIngredient: (ingredient) => {
    set({ selectedDecoIngredient: ingredient })
  },

  // 데코 재료 선택 초기화
  clearDecoSelection: () => {
    set({ selectedDecoIngredient: null })
  },

  // 데코 실수 추가 (감점)
  addDecoMistake: () => {
    set((s) => ({ decoMistakes: s.decoMistakes + 1 }))
    console.warn('❌ 데코 실수 +1')
  },

  // v3: 재료와 레시피에 해당하는 데코 스텝 조회
  // ingredientId는 deco_ingredient_id 또는 inventory_id일 수 있음
  // ⚠️ 반드시 recipe_id가 일치하는 스텝만 반환 (다른 레시피 규칙 허용 방지)
  getDecoStepForIngredient: (ingredientId, recipeId) => {
    const { decoSteps } = get()

    // 1. deco_ingredient_id로 검색 (DECO_ITEM 타입) - recipe_id 필수
    const stepByDecoItem = decoSteps.find(
      (s) => s.deco_ingredient_id === ingredientId && s.recipe_id === recipeId
    )
    if (stepByDecoItem) return stepByDecoItem

    // 2. inventory_id로 검색 (SETTING_ITEM 타입) - recipe_id 필수
    const stepByInventory = decoSteps.find(
      (s) => s.inventory_id === ingredientId && s.recipe_id === recipeId
    )
    if (stepByInventory) return stepByInventory

    // ⚠️ 레시피 무관 검색(fallback) 제거 - 의도치 않은 재료 허용 방지
    // 해당 레시피에 맞는 스텝이 없으면 null 반환
    return null
  },

  // 특수 액션 완료 처리
  completeSpecialAction: (actionId) => {
    set((s) => ({
      completedSpecialActionIds: [...s.completedSpecialActionIds, actionId]
    }))
    console.log(`✅ 특수 액션 완료: ${actionId}`)
  },

  // 특수 액션 완료 여부 확인
  isSpecialActionCompleted: (actionId) => {
    return get().completedSpecialActionIds.includes(actionId)
  },

  // 특정 재료들에 대한 모든 특수 액션 조회
  getRequiredSpecialActions: (ingredientMasterIds, recipeId) => {
    const { ingredientSpecialActions } = get()
    return ingredientSpecialActions
      .filter(
        (action) =>
          action.recipe_id === recipeId &&
          ingredientMasterIds.includes(action.ingredient_master_id)
      )
      .sort((a, b) => a.display_order - b.display_order)
  },

  // 아직 완료되지 않은 필수 전처리 액션 조회
  getPendingPrerequisites: (ingredientMasterIds, recipeId) => {
    const { ingredientSpecialActions, completedSpecialActionIds } = get()
    return ingredientSpecialActions
      .filter(
        (action) =>
          action.recipe_id === recipeId &&
          ingredientMasterIds.includes(action.ingredient_master_id) &&
          action.is_prerequisite &&
          !completedSpecialActionIds.includes(action.id)
      )
      .sort((a, b) => a.display_order - b.display_order)
  },

  // v3: 데코 아이템 적용 (그리드 위치 + 수량 + deco_order 검증)
  applyDecoItem: (plateId, gridPosition, ingredientId, amount) => {
    const { decoPlates, decoSteps, decoSettingItems, checkDecoComplete, level, addDecoMistake } = get()
    const plate = decoPlates.find((p) => p.id === plateId)

    if (!plate) {
      return { success: false, message: '플레이트를 찾을 수 없습니다', isPositionError: false }
    }

    // 완성된 접시에는 더 이상 재료 투입 불가
    if (checkDecoComplete(plateId)) {
      return { success: false, message: '이미 완성된 접시입니다. 서빙해 주세요!', isPositionError: false }
    }

    // 그리드 위치 유효성 검사 (1~9, 3x3 그리드)
    if (gridPosition < 1 || gridPosition > 9) {
      return { success: false, message: '유효하지 않은 그리드 위치입니다', isPositionError: true }
    }

    // v3: 데코 스텝 찾기 (해당 레시피의 스텝만 - recipe_id 필수 체크)
    // 1. deco_ingredient_id로 검색 (DECO_ITEM 타입)
    let decoStep = decoSteps.find(
      (s) => s.deco_ingredient_id === ingredientId && s.recipe_id === plate.recipeId
    )
    // 2. inventory_id로 검색 (SETTING_ITEM 타입)
    if (!decoStep) {
      decoStep = decoSteps.find(
        (s) => s.inventory_id === ingredientId && s.recipe_id === plate.recipeId
      )
    }
    // ⚠️ 주의: 레시피 무관 검색(fallback)은 의도치 않은 재료 허용을 유발하므로 제거
    // 반드시 해당 레시피의 데코 스텝에서만 검색해야 함

    if (!decoStep) {
      console.warn(`❌ 데코 스텝 없음: ingredientId=${ingredientId}, recipeId=${plate.recipeId}`)
      return { success: false, message: '이 레시피에서 사용할 수 없는 재료입니다', isPositionError: false }
    }

    const step = decoStep

    // v3: deco_order 순서 검증 (BUNDLE 외 일반 데코 아이템도 순서 강제)
    // BUNDLE 타입은 mergeBundles에서 별도 처리하므로 여기서는 DECO_ITEM, SETTING_ITEM만 검증
    if (step.source_type !== 'BUNDLE') {
      // 해당 레시피의 모든 non-BUNDLE 데코 스텝을 deco_order 순으로 정렬
      const orderedSteps = decoSteps
        .filter((s) => s.recipe_id === plate.recipeId && s.source_type !== 'BUNDLE')
        .sort((a, b) => a.deco_order - b.deco_order)

      const currentStepIndex = orderedSteps.findIndex((s) => s.id === step.id)

      if (currentStepIndex > 0) {
        // 이전 스텝들이 모두 완료되었는지 확인
        const previousSteps = orderedSteps.slice(0, currentStepIndex)
        const incompleteSteps = previousSteps.filter(
          (prevStep) => !plate.appliedDecos.some((applied) => applied.decoStepId === prevStep.id)
        )

        if (incompleteSteps.length > 0) {
          const nextRequiredStep = incompleteSteps[0]
          const nextStepName = nextRequiredStep.display_name ?? '이전 재료'

          if (level === 'BEGINNER') {
            // 신입: 순서 틀리면 거절
            return {
              success: false,
              message: `먼저 "${nextStepName}"을(를) 배치해야 합니다`,
              isPositionError: false,
              isOrderError: true,
            }
          } else {
            // 중급 이상: 순서 틀려도 진행하되 감점
            console.warn(`⚠️ 데코 순서 틀림: ${nextStepName} 먼저 필요 (감점 적용)`)
            addDecoMistake()
          }
        }
      }
    }

    // v3: 중복 배치 방지: 같은 decoStepId + gridPosition 조합이 이미 존재하는지 확인
    const alreadyPlaced = plate.appliedDecos.some(
      (applied) => applied.decoStepId === step.id && applied.gridPosition === gridPosition
    )
    if (alreadyPlaced) {
      return { success: false, message: '이미 배치된 재료입니다', isPositionError: false }
    }

    // v3: grid_position 단일 값으로 검증 (배열 grid_positions 제거됨)
    const allowedPosition = step.grid_position
    if (allowedPosition && allowedPosition !== gridPosition) {
      return {
        success: false,
        message: `이 재료는 ${allowedPosition}번 위치에만 놓을 수 있습니다`,
        isPositionError: true,
        allowedPositions: [allowedPosition],
      }
    }

    // v3: 수량 검증 (required_amount만 사용)
    const requiredAmount = step.required_amount ?? 1
    if (amount !== requiredAmount) {
      return {
        success: false,
        message: `수량이 맞지 않습니다 (필요: ${requiredAmount})`,
        isPositionError: false,
      }
    }

    // 세팅 아이템에서 재료 차감 (있으면)
    const settingItem = decoSettingItems.find((i) => i.ingredientMasterId === ingredientId)
    if (settingItem && settingItem.remainingAmount < amount) {
      return { success: false, message: '세팅된 재료가 부족합니다', isPositionError: false }
    }

    // v3: 레이어 생성 (decoStepId 사용)
    const newLayer = {
      decoStepId: step.id,
      ingredientName: settingItem?.ingredientName ?? step.display_name ?? ingredientId,
      imageColor: step.layer_image_color ?? '#9CA3AF',
      amount,
      appliedAt: Date.now(),
    }

    // 그리드 셀 업데이트
    set((s) => ({
      decoPlates: s.decoPlates.map((p) => {
        if (p.id !== plateId) return p

        const updatedCells = [...p.gridCells]
        const cellIndex = updatedCells.findIndex((c) => c.position === gridPosition)

        if (cellIndex >= 0) {
          // 기존 셀에 레이어 추가
          updatedCells[cellIndex] = {
            ...updatedCells[cellIndex],
            layers: [...updatedCells[cellIndex].layers, newLayer],
          }
        } else {
          // 새 셀 생성
          updatedCells.push({
            position: gridPosition,
            layers: [newLayer],
          })
        }

        // v3: appliedDecos도 업데이트 (decoStepId 사용)
        const newAppliedDeco = {
          decoStepId: step.id,
          sourceType: step.source_type,
          gridPosition,
          imageColor: step.layer_image_color ?? '#9CA3AF',
          amount,
        }

        return {
          ...p,
          gridCells: updatedCells,
          appliedDecos: [...p.appliedDecos, newAppliedDeco],
          status: 'DECO_IN_PROGRESS' as const,
        }
      }),
      // 세팅 아이템 차감
      decoSettingItems: settingItem
        ? s.decoSettingItems.map((i) =>
            i.id === settingItem.id
              ? { ...i, remainingAmount: i.remainingAmount - amount }
              : i
          )
        : s.decoSettingItems,
    }))

    console.log(`🎨 데코 적용: ${newLayer.ingredientName} x${amount} → 위치 ${gridPosition}`)
    return { success: true, message: '데코 적용 완료', isPositionError: false }
  },

  // 합치기 모드 진입
  enterMergeMode: (sourcePlateId) => {
    const { decoPlates } = get()
    const sourcePlate = decoPlates.find((p) => p.id === sourcePlateId)

    if (!sourcePlate || sourcePlate.isMainDish) {
      console.warn('❌ 사이드 플레이트만 합치기 가능')
      return
    }

    set({
      mergeMode: true,
      selectedSourcePlateId: sourcePlateId,
      selectedDecoIngredient: null, // 재료 선택 해제
    })
    console.log(`🔀 합치기 모드 진입: ${sourcePlate.bundleName}`)
  },

  // 합치기 모드 종료
  exitMergeMode: () => {
    set({ mergeMode: false, selectedSourcePlateId: null })
    console.log('🔀 합치기 모드 종료')
  },

  // 다음 합치기 스텝 조회 (deco_order 순서)
  getNextMergeStep: (recipeId) => {
    const { decoSteps, decoPlates } = get()
    const mainPlate = decoPlates.find((p) => p.recipeId === recipeId && p.isMainDish)
    if (!mainPlate) return null

    // 해당 레시피의 BUNDLE 타입 스텝들을 deco_order 순으로 정렬
    const bundleSteps = decoSteps
      .filter((s) => s.recipe_id === recipeId && s.source_type === 'BUNDLE')
      .sort((a, b) => a.deco_order - b.deco_order)

    // 아직 적용되지 않은 첫 번째 BUNDLE 스텝 찾기
    const nextStep = bundleSteps.find(
      (step) => !mainPlate.appliedDecos.some((applied) => applied.decoStepId === step.id)
    )

    return nextStep ?? null
  },

  // 묶음 병합 (동일 주문 내에서만)
  mergeBundles: (targetPlateId, sourcePlateId) => {
    const { decoPlates, decoSteps, level, addDecoMistake } = get()
    const targetPlate = decoPlates.find((p) => p.id === targetPlateId)
    const sourcePlate = decoPlates.find((p) => p.id === sourcePlateId)

    if (!targetPlate || !sourcePlate) {
      return { success: false, message: '플레이트를 찾을 수 없습니다' }
    }

    // 동일 주문 검증
    if (targetPlate.orderId !== sourcePlate.orderId) {
      return { success: false, message: '동일 주문의 묶음만 병합할 수 있습니다' }
    }

    // 메인 디쉬 여부 검증 (메인 디쉬로만 병합 가능)
    if (!targetPlate.isMainDish) {
      return { success: false, message: '메인 디쉬로만 병합할 수 있습니다' }
    }

    // 소스 번들 ID 검증
    const sourceBundleId = sourcePlate.bundleId
    if (!sourceBundleId) {
      return { success: false, message: '소스 플레이트에 묶음 ID가 없습니다' }
    }

    // 해당 BUNDLE 스텝 찾기
    const bundleStep = decoSteps.find(
      (s) => s.recipe_id === targetPlate.recipeId &&
             s.source_type === 'BUNDLE' &&
             s.source_bundle_id === sourceBundleId
    )

    if (!bundleStep) {
      return { success: false, message: '해당 묶음의 데코 스텝을 찾을 수 없습니다' }
    }

    // 순서 검증: 이전 BUNDLE 스텝들이 모두 완료되었는지 확인
    const bundleSteps = decoSteps
      .filter((s) => s.recipe_id === targetPlate.recipeId && s.source_type === 'BUNDLE')
      .sort((a, b) => a.deco_order - b.deco_order)

    const currentStepIndex = bundleSteps.findIndex((s) => s.id === bundleStep.id)
    const previousSteps = bundleSteps.slice(0, currentStepIndex)
    const allPreviousCompleted = previousSteps.every((step) =>
      targetPlate.appliedDecos.some((applied) => applied.decoStepId === step.id)
    )

    if (!allPreviousCompleted) {
      const nextStep = previousSteps.find(
        (step) => !targetPlate.appliedDecos.some((applied) => applied.decoStepId === step.id)
      )
      const nextStepName = nextStep?.display_name ?? '이전 묶음'

      if (level === 'BEGINNER') {
        // 초급: 순서 틀리면 거절
        return {
          success: false,
          message: `먼저 "${nextStepName}"을(를) 합쳐주세요`
        }
      } else {
        // 중급/고급: 감점 후 진행
        addDecoMistake()
        console.warn(`⚠️ 순서 오류 (감점): "${nextStepName}" 먼저 합쳐야 함`)
      }
    }

    // AppliedDeco 생성
    const newAppliedDeco = {
      decoStepId: bundleStep.id,
      sourceType: 'BUNDLE' as const,
      gridPosition: bundleStep.grid_position,
      imageColor: bundleStep.layer_image_color,
      amount: 1,
    }

    // 병합 실행: 타겟에 레이어 추가 + 소스 제거
    set((s) => ({
      decoPlates: s.decoPlates
        .map((p) => {
          if (p.id !== targetPlateId) return p

          // 그리드셀에 레이어 추가
          const updatedGridCells = p.gridCells.map((cell) => {
            if (cell.position !== bundleStep.grid_position) return cell
            return {
              ...cell,
              layers: [
                ...cell.layers,
                {
                  decoStepId: bundleStep.id,
                  ingredientName: sourcePlate.bundleName ?? '묶음',
                  imageColor: bundleStep.layer_image_color,
                  amount: 1,
                  appliedAt: Date.now(),
                },
              ],
            }
          })

          return {
            ...p,
            mergedBundles: [...p.mergedBundles, sourceBundleId],
            appliedDecos: [...p.appliedDecos, newAppliedDeco],
            gridCells: updatedGridCells,
          }
        })
        .filter((p) => p.id !== sourcePlateId), // 소스 플레이트 제거
      mergeMode: false,
      selectedSourcePlateId: null,
    }))

    console.log(`🔗 묶음 병합 완료: ${sourcePlate.bundleName} → ${targetPlate.bundleName} (위치: ${bundleStep.grid_position})`)
    return { success: true, message: '묶음 병합 완료' }
  },

  // 플레이트 서빙
  servePlate: (plateId) => {
    const { decoPlates, checkDecoComplete, logAction } = get()
    const plate = decoPlates.find((p) => p.id === plateId)

    if (!plate) {
      console.warn('❌ 플레이트를 찾을 수 없습니다')
      return false
    }

    // 데코 완료 체크
    if (!checkDecoComplete(plateId)) {
      console.warn('❌ 데코가 완료되지 않았습니다')
      return false
    }

    const completedOrderId = plate.orderId
    const completedMenuName = plate.menuName

    // 데코존에서 제거 + completedMenus 증가 + menuQueue 업데이트
    set((s) => ({
      decoPlates: s.decoPlates.filter((p) => p.id !== plateId),
      completedMenus: s.completedMenus + 1,
      menuQueue: s.menuQueue.map((o) =>
        o.id === completedOrderId
          ? { ...o, status: 'COMPLETED' as const, servedAt: new Date() }
          : o
      ),
    }))

    // 액션 로그
    logAction({
      actionType: 'SERVE',
      menuName: completedMenuName,
      burnerNumber: 0, // 데코존에서 서빙
      isCorrect: true,
      message: `${completedMenuName} 데코 완료 후 서빙`,
    })

    console.log(`🍽️ 플레이트 서빙 완료: ${completedMenuName} (완성 메뉴: ${get().completedMenus}개)`)

    // 3초 후 완료된 주문카드 제거
    setTimeout(() => {
      set((s) => ({
        menuQueue: s.menuQueue.filter((o) => o.id !== completedOrderId),
      }))
    }, 3000)

    return true
  },

  // v3: 데코 완료 체크 (모든 데코 스텝 충족 여부)
  checkDecoComplete: (plateId) => {
    const { decoPlates, decoSteps, recipeBundles } = get()
    const plate = decoPlates.find((p) => p.id === plateId)

    if (!plate) return false

    // v3: 해당 레시피의 모든 데코 스텝 찾기
    const recipeDecoSteps = decoSteps.filter(
      (s) => s.recipe_id === plate.recipeId
    )

    // 데코 스텝이 있으면 반드시 체크 (deco_required 무관)
    if (recipeDecoSteps.length > 0) {
      // v3: 모든 데코 스텝이 적용되었는지 확인 (decoStepId 사용)
      const allStepsApplied = recipeDecoSteps.every((step) =>
        plate.appliedDecos.some((applied) => applied.decoStepId === step.id)
      )
      return allStepsApplied
    }

    // 데코 스텝이 없을 때만 번들의 deco_required 확인
    const bundle = recipeBundles.find((b) => b.id === plate.bundleId)
    if (bundle && bundle.deco_required) {
      // 데코 필수인데 스텝이 없으면 미완료 (데이터 오류 상황)
      return false
    }

    // 데코 스텝도 없고 필수도 아니면 완료
    return true
  },

  // 세팅 아이템 추가
  addSettingItem: (item) => {
    const id = `setting-${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((s) => ({
      decoSettingItems: [
        ...s.decoSettingItems,
        {
          ...item,
          id,
          remainingAmount: item.amount,
        },
      ],
    }))
  },

  // 세팅 아이템 사용
  useSettingItem: (itemId, amount) => {
    const { decoSettingItems } = get()
    const item = decoSettingItems.find((i) => i.id === itemId)

    if (!item || item.remainingAmount < amount) {
      console.warn('❌ 세팅 아이템이 부족합니다')
      return false
    }

    set((s) => ({
      decoSettingItems: s.decoSettingItems.map((i) =>
        i.id === itemId
          ? { ...i, remainingAmount: i.remainingAmount - amount }
          : i
      ),
    }))

    return true
  },

  // 세팅 아이템 제거 (다시 넣기)
  removeSettingItem: (itemId) => {
    const { decoSettingItems, selectedDecoIngredient, clearDecoSelection } = get()
    const item = decoSettingItems.find((i) => i.id === itemId)

    if (!item) {
      console.warn('❌ 세팅 아이템을 찾을 수 없습니다')
      return
    }

    // 현재 선택된 재료가 이 아이템이면 선택 해제
    if (selectedDecoIngredient?.id === itemId) {
      clearDecoSelection()
    }

    set((s) => ({
      decoSettingItems: s.decoSettingItems.filter((i) => i.id !== itemId),
    }))
  },

  // 묶음 진행 상태 업데이트
  updateBundleProgress: (orderId, bundleProgress) => {
    set((s) => {
      const currentProgress = s.activeBundles.get(orderId) ?? []
      const existingIndex = currentProgress.findIndex((p) => p.bundleId === bundleProgress.bundleId)

      let updatedProgress: BundleProgress[]
      if (existingIndex >= 0) {
        // 기존 항목 업데이트
        updatedProgress = currentProgress.map((p, i) =>
          i === existingIndex ? { ...p, ...bundleProgress } : p
        )
      } else {
        // 새 항목 추가
        updatedProgress = [...currentProgress, bundleProgress]
      }

      const newActiveBundles = new Map(s.activeBundles)
      newActiveBundles.set(orderId, updatedProgress)

      return { activeBundles: newActiveBundles }
    })
  },
}))

export function selectRandomMenu(
  recipes: Recipe[],
  usedMenus: Set<string>
): Recipe | null {
  if (!recipes.length) return null
  const unused = recipes.filter((r) => !usedMenus.has(r.menu_name))
  const pool = unused.length > 0 ? unused : recipes
  return pool[Math.floor(Math.random() * pool.length)]
}


if (typeof window !== 'undefined') {
  (window as any).__gameStore = useGameStore;
}
if (typeof window !== 'undefined') {
  (window as any).__gameStore = useGameStore;
  (window as any).checkStore = () => {
    const s = useGameStore.getState();
    alert(JSON.stringify({
      kitchenGrid: s.kitchenGrid ? `${s.kitchenGrid.grid_cols}x${s.kitchenGrid.grid_rows}` : 'null',
      equipment: s.kitchenEquipment?.length ?? 0,
      woks: s.woks?.map(w => w.equipmentKey || w.burnerNumber),
      storageCacheKeys: Object.keys(s.storageCache).length,
    }, null, 2));
  };
}
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
  SelectedDecoIngredient,
  Seasoning,
  // v3.1: 전자레인지/튀김기 상태
  MicrowaveState,
  FryerState,
  FryerBasket,
  // v3.1 리팩토링: BundleInstance 중앙 관리
  BundleInstance,
  BundleLocation,
  PlatingState,
} from '../types/database.types'
import { WOK_TEMP, MENU_TIMER, calculateTimeScore, FRYER_TEMP } from '../types/database.types'

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

// 레벨별 목표 메뉴 개수
const TARGET_MENUS_BY_LEVEL: Record<GameLevel, number> = {
  BEGINNER: 3,    // 신입: 3개
  INTERMEDIATE: 5, // 알바: 5개
  ADVANCED: 10,    // 관리자: 10개
}

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

  // v3.1: 전자레인지/튀김기 상태
  microwaveState: MicrowaveState
  fryerState: FryerState

  // v3.1 리팩토링: BundleInstance 중앙 관리
  bundleInstances: BundleInstance[]

  // Supabase 마스터 데이터 (데코존/묶음/콜드메뉴)
  plateTypes: PlateType[]
  recipeBundles: RecipeBundle[]
  decoIngredients: DecoIngredient[] // v3: decoDefaultItems → decoIngredients
  decoSteps: DecoStep[] // v3: decoRules → decoSteps
  ingredientSpecialActions: IngredientSpecialAction[]

  setStore: (store: Store | null) => void
  setUser: (user: User | null) => void
  setCurrentUser: (user: User | null) => void
  setLevel: (level: GameLevel) => void
  loadStoreData: (storeId: string) => Promise<void>
  preloadStorageData: (storeId: string) => Promise<void>
  resetGameState: () => void
  tickTimer: () => void
  checkMenuTimers: () => void // 메뉴 타이머 체크 (15분 초과 시 자동 취소)
  checkBoilCompletion: () => void // BOIL 액션 자동 완료 체크
  addMenuToQueue: (menuName: string) => void
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
  selectDecoIngredient: (ingredient: SelectedDecoIngredient) => void
  clearDecoSelection: () => void
  applyDecoItem: (
    plateId: string,
    gridPosition: number,
    ingredientId: string,
    amount: number
  ) => { success: boolean; message: string; isPositionError?: boolean; isOrderError?: boolean; allowedPositions?: number[] }
  enterMergeMode: (sourcePlateId: string) => void
  exitMergeMode: () => void
  getNextMergeStep: (recipeId: string) => DecoStep | null
  checkDecoComplete: (plateId: string) => boolean
  addDecoMistake: () => void
  // v3: getDecoRuleForIngredient → getDecoStepForIngredient
  getDecoStepForIngredient: (ingredientId: string, recipeId: string) => DecoStep | null

  // 세팅존 액션
  addSettingItem: (item: Omit<DecoSettingItem, 'id' | 'remainingAmount'>) => void

  // v3.1: 내부용 튀김기 물리 상태 업데이트 (assignBundle, routeAfterPlate에서 사용)
  updateFryerBasket: (basketNumber: number, updates: Partial<FryerBasket>) => void

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

  // v3.1 리팩토링: BundleInstance 통합 관리
  moveBundle: (instanceId: string, newLocation: BundleLocation) => void
  updateBundleInstance: (instanceId: string, updates: Partial<BundleInstance>) => void

  // v3.1 리팩토링: selector
  getWokBundle: (burnerNumber: number) => BundleInstance | undefined
  getMicrowaveBundles: () => BundleInstance[]
  getFryerBundle: (basketNumber: number) => BundleInstance | undefined
  getDecoMainPlates: () => BundleInstance[]
  getSettingBundles: () => BundleInstance[]
  getOrderBundles: (orderId: string) => BundleInstance[]
  getMergeableBundles: (sourceBundleId: string) => BundleInstance[]

  // v3.1 리팩토링: 통합 함수
  assignBundle: (
    orderId: string,
    bundleId: string,
    location: BundleLocation,
    config?: { timerSeconds?: number; powerLevel?: 'LOW' | 'MEDIUM' | 'HIGH' }
  ) => { success: boolean; instanceId?: string; message?: string }
  addIngredientToBundle: (instanceId: string, recipeIngredientId: string, amount: number) => boolean
  executeAction: (instanceId: string, actionType: string) => { ok: boolean; message?: string }
  completeBundle: (instanceId: string) => BundleInstance | null
  routeAfterPlate: (instanceId: string, plateType: PlateType) => void
  mergeBundle: (targetInstanceId: string, sourceInstanceId: string, amount?: number) => { success: boolean; message: string }
  serveBundle: (instanceId: string) => boolean
  tickBundleTimers: () => void
  // v3.2 리팩토링: 튀김기 전용 통합 함수 (올리기/내리기 분리)
  lowerBundle: (instanceId: string) => { success: boolean; message?: string }
  liftBundle: (instanceId: string) => { success: boolean; message?: string }
  discardBundle: (instanceId: string) => void
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
  targetMenus: TARGET_MENUS_BY_LEVEL['BEGINNER'], // 기본 레벨(신입)에 맞는 목표
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

  // v3.1: 전자레인지/튀김기 초기값
  microwaveState: {
    status: 'EMPTY',
    currentItem: null,
    waitingItems: [],
  },
  // v3.3: 튀김기 상태 (isSubmerged 기반 물리 모델)
  fryerState: {
    baskets: [
      { basketNumber: 1, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
      { basketNumber: 2, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
      { basketNumber: 3, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
    ],
    oilTemperature: 180, // 항상 180도 고정
    isHeating: false,
  },

  // v3.1 리팩토링: BundleInstance 초기값
  bundleInstances: [],

  // Supabase 마스터 데이터 초기값
  plateTypes: [],
  recipeBundles: [],
  decoIngredients: [], // v3: decoDefaultItems → decoIngredients
  decoSteps: [], // v3: decoRules → decoSteps
  ingredientSpecialActions: [],

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
  setLevel: (level) => set({ level, targetMenus: TARGET_MENUS_BY_LEVEL[level] }),

  resetGameState: () => {
    const { kitchenEquipment, level } = get()
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
      targetMenus: TARGET_MENUS_BY_LEVEL[level], // 레벨에 맞는 목표 메뉴 개수
      usedMenuNames: new Set(),
      lastServeError: null,
      // 데코존 상태 초기화
      decoPlates: [],
      decoSettingItems: [],
      decoMistakes: 0,
      selectedDecoIngredient: null,
      mergeMode: false,
      selectedSourcePlateId: null,
      // v3.1: 전자레인지/튀김기 상태 초기화
      microwaveState: {
        status: 'EMPTY',
        currentItem: null,
        waitingItems: [],
      },
      fryerState: {
        baskets: [
          { basketNumber: 1, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
          { basketNumber: 2, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
          { basketNumber: 3, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
        ],
        oilTemperature: 180,
        isHeating: false,
      },
      // v3.1 리팩토링: BundleInstance 초기화
      bundleInstances: [],
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
      targetMenus: TARGET_MENUS_BY_LEVEL['BEGINNER'], // 기본 레벨에 맞는 목표
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
      plateTypes: [],
      recipeBundles: [],
      decoIngredients: [], // v3: decoDefaultItems → decoIngredients
      decoSteps: [], // v3: decoRules → decoSteps
      ingredientSpecialActions: [],
      // v3.1: 전자레인지/튀김기 상태 초기화
      microwaveState: {
        status: 'EMPTY',
        currentItem: null,
        waitingItems: [],
      },
      fryerState: {
        baskets: [
          { basketNumber: 1, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
          { basketNumber: 2, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
          { basketNumber: 3, status: 'EMPTY', isSubmerged: false, orderId: null, bundleId: null, menuName: null, startedAt: null },
        ],
        oilTemperature: 180,
        isHeating: false,
      },
      // v3.1 리팩토링: BundleInstance 초기화
      bundleInstances: [],
    })
  },

  tickTimer: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

  checkMenuTimers: () => {
    const { menuQueue, elapsedSeconds, woks, fryerState } = get()
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

        // v3.3: 튀김기 바스켓에서도 해당 주문 제거
        const assignedBasket = fryerState.baskets.find((b) => b.orderId === order.id)
        if (assignedBasket) {
          console.log(`🍟 튀김기 바스켓 ${assignedBasket.basketNumber} 초기화 (메뉴 취소)`)
          set((s) => ({
            fryerState: {
              ...s.fryerState,
              baskets: s.fryerState.baskets.map((b) =>
                b.orderId === order.id
                  ? {
                      ...b,
                      status: 'EMPTY' as const,
                      isSubmerged: false,
                      orderId: null,
                      bundleId: null,
                      menuName: null,
                      startedAt: null,
                    }
                  : b
              ),
            },
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

  // BOIL 액션 자동 완료 체크 (물이 끓고 있을 때 required_duration 경과 시 자동 진행)
  checkBoilCompletion: () => {
    const { woks, getRecipeByMenuName, getRecipeSteps } = get()

    woks.forEach((wok) => {
      // 조리 중이고 물이 끓고 있는 웍만 체크
      if (!wok.currentMenu || !wok.isBoiling || !wok.waterBoilStartTime) return

      const recipe = getRecipeByMenuName(wok.currentMenu)
      if (!recipe) return

      const sortedSteps = getRecipeSteps(recipe, wok.currentBundleId)
      const currentStep = sortedSteps[wok.currentStep]

      // 현재 스텝이 BOIL 액션인지 확인
      if (!currentStep || currentStep.step_type !== 'ACTION' || currentStep.action_type !== 'BOIL') return

      // required_duration 확인
      const requiredDuration = (currentStep.action_params as any)?.required_duration
      if (!requiredDuration) return

      // 끓기 시작한 이후 경과 시간 계산
      const now = Date.now()
      const boilElapsed = (now - wok.waterBoilStartTime) / 1000

      if (boilElapsed >= requiredDuration) {
        console.log(`🫧 BOIL 완료: 화구${wok.burnerNumber} - ${wok.currentMenu} (${boilElapsed.toFixed(1)}초/${requiredDuration}초)`)

        // 다음 스텝으로 진행
        const nextStep = wok.currentStep + 1
        const isComplete = nextStep >= sortedSteps.length

        if (isComplete) {
          console.log(`🎉 화구${wok.burnerNumber}: 조리 완료! 서빙 가능`)
        }

        set((s) => ({
          woks: s.woks.map((w) =>
            w.burnerNumber === wok.burnerNumber
              ? {
                  ...w,
                  currentStep: nextStep,
                  stepStartTime: Date.now(),
                  addedIngredientIds: [], // 다음 스텝 시작 시 초기화
                  // BOIL 완료 후 물 상태 유지 (다음 스텝에서 필요할 수 있음)
                }
              : w
          ),
        }))

        // 로그 기록
        get().logAction({
          actionType: 'BOIL',
          menuName: wok.currentMenu,
          burnerNumber: wok.burnerNumber,
          isCorrect: true,
          message: `화구${wok.burnerNumber}: BOIL 완료 (${requiredDuration}초)`,
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
          
          // 메뉴 실패 처리 + BundleInstance 정리
          const orderId = wok.currentOrderId
          const burnedBurnerNumber = wok.burnerNumber
          if (orderId) {
            setTimeout(() => {
              useGameStore.setState((st) => ({
                menuQueue: st.menuQueue.map((o) =>
                  o.id === orderId
                    ? { ...o, status: 'WAITING' as const, assignedBurner: null }
                    : o
                ),
                bundleInstances: st.bundleInstances.filter(
                  (b) => !(b.location.type === 'WOK' && b.location.burnerNumber === burnedBurnerNumber)
                ),
              }))
            }, 0)
          } else {
            // orderId 없어도 BundleInstance는 정리
            setTimeout(() => {
              useGameStore.setState((st) => ({
                bundleInstances: st.bundleInstances.filter(
                  (b) => !(b.location.type === 'WOK' && b.location.burnerNumber === burnedBurnerNumber)
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
      // v3.1 Fix: BundleInstance 제거 (assignBundle 중복 체크 방지)
      bundleInstances: s.bundleInstances.filter(
        (b) => !(b.location.type === 'WOK' && b.location.burnerNumber === burnerNumber)
      ),
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
        // recipe_id 기반 + JOIN (plate_type, recipe_steps 정보 포함)
        supabase
          .from('recipe_bundles')
          .select(`
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
          `)
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
    // v3.1 Fix: kitchen_equipment에서 실제 사용 중인 storage_location_ids 동적 수집
    const { kitchenEquipment } = get()
    const dynamicLocationCodes = new Set<string>()

    kitchenEquipment.forEach((eq) => {
      if (eq.storage_location_ids?.length) {
        eq.storage_location_ids.forEach((locId) => dynamicLocationCodes.add(locId))
      }
    })

    // 기본 냉장고/서랍 코드 + 동적 수집된 코드 병합
    const baseLocationCodes = [
      'FRIDGE_LT_F1', 'FRIDGE_LT_F2',
      'FRIDGE_RT_F1', 'FRIDGE_RT_F2',
      'FRIDGE_LB_F1', 'FRIDGE_LB_F2',
      'FRIDGE_RB_F1', 'FRIDGE_RB_F2',
      'DRAWER_LT', 'DRAWER_RT', 'DRAWER_LB', 'DRAWER_RB',
      'FREEZER', 'FREEZER_MAIN', 'FREEZER_LT', 'FREEZER_RT', // v3.1: 냉동고 여러 형태 지원
    ]

    // 중복 제거하여 병합
    const locationCodes = [...new Set([...baseLocationCodes, ...dynamicLocationCodes])]
    console.log('📦 storageCache 로드 대상:', locationCodes)

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

          // v3.1 Fix: grid_positions null 조건 제거 (null이면 기본값 '1' 사용)
          const { data: ingredients, error: ingredientsError } = await supabase
            .from('ingredients_inventory')
            .select('*, ingredient_master:ingredients_master(*)')
            .eq('storage_location_id', location.id)

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
      total_menus_target: TARGET_MENUS_BY_LEVEL[level], // 레벨에 맞는 목표
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

  // ============================================
  // v3.1 리팩토링: BundleInstance 통합 관리 함수
  // ============================================

  moveBundle: (instanceId, newLocation) => {
    set((s) => ({
      bundleInstances: s.bundleInstances.map((b) =>
        b.id === instanceId ? { ...b, location: newLocation } : b
      ),
    }))
  },

  updateBundleInstance: (instanceId, updates) => {
    set((s) => ({
      bundleInstances: s.bundleInstances.map((b) =>
        b.id === instanceId ? { ...b, ...updates } : b
      ),
    }))
  },

  getWokBundle: (burnerNumber) => {
    return get().bundleInstances.find(
      (b) => b.location.type === 'WOK' && b.location.burnerNumber === burnerNumber
    )
  },

  getMicrowaveBundles: () => {
    return get().bundleInstances.filter((b) => b.location.type === 'MICROWAVE')
  },

  getFryerBundle: (basketNumber) => {
    return get().bundleInstances.find(
      (b) => b.location.type === 'FRYER' && b.location.basketNumber === basketNumber
    )
  },

  getDecoMainPlates: () => {
    return get().bundleInstances.filter((b) => b.location.type === 'DECO_MAIN')
  },

  getSettingBundles: () => {
    return get().bundleInstances.filter((b) => b.location.type === 'DECO_SETTING')
  },

  getOrderBundles: (orderId) => {
    return get().bundleInstances.filter((b) => b.orderId === orderId)
  },

  getMergeableBundles: (sourceBundleId) => {
    return get().bundleInstances.filter(
      (b) => b.bundleId === sourceBundleId && b.location.type === 'DECO_SETTING'
    )
  },

  // ============================================
  // === v3.1 리팩토링: 내부 헬퍼 (export하지 않음) ===
  // ============================================

  // (a) 재료 투입 시 장비 물리 효과
  // applyIngredientPhysics는 통합 함수 내부에서 인라인으로 처리

  // (b) 액션 실행 전 장비 조건 판정
  // checkEquipmentCondition은 통합 함수 내부에서 인라인으로 처리

  // (c) 액션 실행 후 장비 물리 효과
  // applyActionPhysics는 통합 함수 내부에서 인라인으로 처리

  // (d) 묶음 완료 시 장비 정리
  // cleanupEquipment는 통합 함수 내부에서 인라인으로 처리

  // ============================================
  // === v3.1 리팩토링: 통합 함수 ===
  // ============================================

  assignBundle: (orderId, bundleId, location, config) => {
    const { menuQueue, recipeBundles, recipes, getRecipeSteps, logAction, level, updateWok, updateFryerBasket } = get()

    // 1. menuQueue에서 주문 찾기
    const order = menuQueue.find((o) => o.id === orderId)
    if (!order) {
      return { success: false, message: '주문을 찾을 수 없습니다' }
    }

    // 2. recipeBundles에서 묶음 정의 찾기
    const bundleDef = recipeBundles.find((b) => b.id === bundleId)
    if (!bundleDef) {
      return { success: false, message: '묶음 정의를 찾을 수 없습니다' }
    }

    // 3. 레시피와 스텝 수 계산
    const recipe = recipes.find((r) => r.id === bundleDef.recipe_id)
    if (!recipe) {
      return { success: false, message: '레시피를 찾을 수 없습니다' }
    }
    const steps = getRecipeSteps(recipe, bundleId)
    const totalSteps = steps.length

    // 3.5. 장비가 이미 사용 중인지 검증
    const { woks, fryerState, bundleInstances } = get()
    if (location.type === 'WOK') {
      const wok = woks.find((w) => w.burnerNumber === location.burnerNumber)
      // 웍 상태 검증: CLEAN 상태에서만 배정 가능
      if (wok?.state !== 'CLEAN') {
        const stateMessages: Record<string, string> = {
          WET: '물이 있습니다. 먼저 말려주세요',
          DIRTY: '더럽습니다. 먼저 닦아주세요',
          BURNED: '탔습니다. 먼저 정리해주세요',
          OVERHEATING: '과열 상태입니다. 잠시 기다려주세요',
        }
        return { success: false, message: `화구 ${location.burnerNumber}번이 ${stateMessages[wok?.state ?? ''] ?? '사용할 수 없는 상태입니다'}` }
      }
      if (wok?.currentMenu) {
        return { success: false, message: `화구 ${location.burnerNumber}번에 이미 메뉴가 있습니다` }
      }
      // BundleInstance 중복 체크
      const existingBundle = bundleInstances.find(
        (b) => b.location.type === 'WOK' && b.location.burnerNumber === location.burnerNumber
      )
      if (existingBundle) {
        return { success: false, message: `화구 ${location.burnerNumber}번에 이미 묶음이 배정되어 있습니다` }
      }
    } else if (location.type === 'FRYER') {
      const basket = fryerState.baskets.find((b) => b.basketNumber === location.basketNumber)
      if (basket?.status !== 'EMPTY') {
        return { success: false, message: `바스켓 ${location.basketNumber}번이 비어있지 않습니다` }
      }
      // BundleInstance 중복 체크
      const existingBundle = bundleInstances.find(
        (b) => b.location.type === 'FRYER' && b.location.basketNumber === location.basketNumber
      )
      if (existingBundle) {
        return { success: false, message: `바스켓 ${location.basketNumber}번에 이미 묶음이 배정되어 있습니다` }
      }
    }

    // 4. BEGINNER 모드 검증 (전자레인지/튀김기: action_params 비교)
    if (level === 'BEGINNER' && (location.type === 'MICROWAVE' || location.type === 'FRYER')) {
      // v3.1 Fix: 해당 action_type의 스텝에서 action_params 확인 (첫 번째 스텝이 아닐 수 있음)
      const targetActionType = location.type === 'MICROWAVE' ? 'MICROWAVE' : 'DEEP_FRY'
      const actionStep = steps.find((s) => s.step_type === 'ACTION' && s.action_type === targetActionType)

      console.log('🔍 assignBundle 검증:', {
        location: location.type,
        targetActionType,
        foundStep: actionStep ? { action_type: actionStep.action_type, action_params: actionStep.action_params } : null,
        config,
      })

      if (actionStep?.action_params) {
        const requiredDuration = actionStep.action_params.required_duration as number | undefined
        const requiredPower = actionStep.action_params.power as string | undefined

        if (location.type === 'MICROWAVE') {
          if (requiredDuration !== undefined && config?.timerSeconds !== requiredDuration) {
            return { success: false, message: `시간 설정이 올바르지 않습니다 (필요: ${requiredDuration}초)` }
          }
          if (requiredPower && config?.powerLevel !== requiredPower) {
            return { success: false, message: `파워 설정이 올바르지 않습니다 (필요: ${requiredPower})` }
          }
        }
        if (location.type === 'FRYER') {
          // v3.1 Fix: 타이머가 설정된 경우에만 검증 (배정 시점에는 config 없음, BatchAmountInputPopup에서 설정)
          if (requiredDuration !== undefined && config?.timerSeconds !== undefined && config.timerSeconds !== requiredDuration) {
            return { success: false, message: `튀김 시간 설정이 올바르지 않습니다 (필요: ${requiredDuration}초)` }
          }
        }
      }
    }

    // 5. BundleInstance 생성
    const instanceId = `bi-${Date.now()}-${Math.random().toString(36).slice(2)}`
    // v3.1 Fix: FRYER는 배정 시점에는 타이머 시작하지 않음 (재료 투입 후 시작)
    const shouldStartTimer = location.type !== 'FRYER'
    const newInstance: BundleInstance = {
      id: instanceId,
      orderId,
      menuName: order.menuName,
      recipeId: recipe.id,
      bundleId,
      bundleName: bundleDef.bundle_name,
      cookingType: bundleDef.cooking_type,
      isMainDish: bundleDef.is_main_dish,
      location,
      cooking: {
        currentStep: 0,
        totalSteps,
        addedIngredientIds: [],
        startedAt: shouldStartTimer ? Date.now() : null,
        timerSeconds: config?.timerSeconds,
        elapsedSeconds: 0,
        powerLevel: config?.powerLevel,
      },
      plating: null,
      ingredients: [],
      errors: 0,
      availableAmount: 0, // routeAfterPlate에서 실제 값으로 갱신
    }

    // 6. bundleInstances에 추가
    set((s) => ({
      bundleInstances: [...s.bundleInstances, newInstance],
    }))

    // 7. 장비별 상태 업데이트
    if (location.type === 'WOK') {
      updateWok(location.burnerNumber, {
        currentMenu: order.menuName,
        currentOrderId: orderId,
        currentBundleId: bundleId,
        currentStep: 0,
        totalSteps,
        addedIngredientIds: [],
        stepStartTime: Date.now(),
      })
    } else if (location.type === 'FRYER') {
      // v3.3: FryerBasket은 물리 상태만 관리 (레시피 진행은 BundleInstance에서)
      updateFryerBasket(location.basketNumber, {
        status: 'ASSIGNED',
        isSubmerged: false,
        orderId,
        bundleId,
        menuName: order.menuName,
        startedAt: null,
      })
    }

    // 8. menuQueue 상태 업데이트
    set((s) => ({
      menuQueue: s.menuQueue.map((o) =>
        o.id === orderId ? { ...o, status: 'COOKING' as const } : o
      ),
    }))

    // 9. 액션 로그
    logAction({
      actionType: 'ASSIGN_BUNDLE',
      menuName: order.menuName,
      isCorrect: true,
      message: `🔥 ${order.menuName} - ${bundleDef.bundle_name} 배정 (${location.type})`,
    })

    console.log(`🔥 assignBundle: ${order.menuName} - ${bundleDef.bundle_name} → ${location.type}`)
    return { success: true, instanceId }
  },

  addIngredientToBundle: (instanceId, recipeIngredientId, amount) => {
    const { bundleInstances, getCurrentStepIngredients, logAction, level, updateWok, woks } = get()

    // 1. bundleInstances에서 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      console.error(`❌ addIngredientToBundle: instance not found: ${instanceId}`)
      return false
    }

    // 2. 현재 스텝 재료 목록 가져오기
    const reqs = getCurrentStepIngredients(instance.menuName, instance.cooking.currentStep, instance.bundleId)

    // 3. recipeIngredientId로 매칭
    const matchedIngredient = reqs.find((r) => r.id === recipeIngredientId)
    if (!matchedIngredient) {
      console.error(`❌ addIngredientToBundle: ingredient not found in current step: ${recipeIngredientId}`)
      return false
    }

    const displayName = matchedIngredient.display_name
      ?? matchedIngredient.ingredient_master?.ingredient_name
      ?? recipeIngredientId

    // v3.3: FRYER 물리 검증 - 바스켓이 기름에 잠겨있으면 재료 투입 불가
    // 원칙: 장비가 주체 — 장비의 물리 상태가 조건을 충족하는지 장비가 판정
    if (instance.location.type === 'FRYER') {
      const basketNumber = instance.location.basketNumber
      const { fryerState } = get()
      const basket = fryerState.baskets.find((b) => b.basketNumber === basketNumber)

      // isSubmerged === true면 재료 투입 거절
      if (basket?.isSubmerged) {
        console.warn(`[addIngredientToBundle] FRYER basket isSubmerged=true, REJECTED - 바스켓을 먼저 올려주세요`)
        return false
      }
      console.log(`[addIngredientToBundle] FRYER basket isSubmerged=false, OK`)
    }

    // 4. BEGINNER 수량 검증
    if (level === 'BEGINNER') {
      if (amount !== matchedIngredient.required_amount) {
        logAction({
          actionType: 'INGREDIENT',
          menuName: instance.menuName,
          ingredientId: recipeIngredientId,
          amountInput: amount,
          expectedAmount: matchedIngredient.required_amount,
          isCorrect: false,
          message: `❌ ${displayName}: 수량 불일치 (입력: ${amount}, 필요: ${matchedIngredient.required_amount})`,
        })
        // 에러 카운트 증가
        set((s) => ({
          bundleInstances: s.bundleInstances.map((b) =>
            b.id === instanceId ? { ...b, errors: b.errors + 1 } : b
          ),
        }))
        return false
      }
    }

    // 5. cooking.addedIngredientIds에 추가 + ingredients 배열 업데이트
    // v3.3: 데코존에서 실제 수량 표시를 위해 ingredients도 저장
    const ingredientUnit = matchedIngredient.required_unit ?? 'g'
    set((s) => ({
      bundleInstances: s.bundleInstances.map((b) => {
        if (b.id !== instanceId) return b

        // 기존 ingredients에서 같은 이름의 재료 찾기
        const existingIdx = b.ingredients.findIndex((ing) => ing.name === displayName)

        let updatedIngredients: typeof b.ingredients
        if (existingIdx >= 0) {
          // 같은 재료가 있으면 수량 합산
          updatedIngredients = b.ingredients.map((ing, idx) =>
            idx === existingIdx ? { ...ing, amount: ing.amount + amount } : ing
          )
        } else {
          // 새 재료 추가
          updatedIngredients = [...b.ingredients, { name: displayName, amount, unit: ingredientUnit }]
        }

        return {
          ...b,
          cooking: {
            ...b.cooking,
            addedIngredientIds: [...b.cooking.addedIngredientIds, recipeIngredientId],
          },
          ingredients: updatedIngredients,
        }
      }),
    }))

    // 6. applyIngredientPhysics (인라인)
    const loc = instance.location
    if (loc.type === 'WOK') {
      const wok = woks.find((w) => w.burnerNumber === loc.burnerNumber)
      if (wok) {
        // 재료 카테고리별 온도 하락
        const category = matchedIngredient.ingredient_master?.category ?? 'DEFAULT'
        const tempDrop = WOK_TEMP.COOLING[category] ?? 20
        updateWok(loc.burnerNumber, {
          temperature: Math.max(WOK_TEMP.AMBIENT, wok.temperature - tempDrop),
          addedIngredientIds: [...wok.addedIngredientIds, recipeIngredientId],
        })
      }
    }

    // 7. 스텝 내 모든 재료 완료 체크 → 스텝 진행
    const updatedInstance = get().bundleInstances.find((b) => b.id === instanceId)
    if (updatedInstance) {
      const allReqIds = reqs.map((r) => r.id)
      const allAdded = allReqIds.every((id) => updatedInstance.cooking.addedIngredientIds.includes(id))

      if (allAdded) {
        // 스텝 진행
        set((s) => ({
          bundleInstances: s.bundleInstances.map((b) =>
            b.id === instanceId
              ? { ...b, cooking: { ...b.cooking, currentStep: b.cooking.currentStep + 1 } }
              : b
          ),
        }))

        // 웍 동기화
        if (instance.location.type === 'WOK') {
          updateWok(instance.location.burnerNumber, {
            currentStep: updatedInstance.cooking.currentStep + 1,
          })
        }

        console.log(`✅ 스텝 ${updatedInstance.cooking.currentStep} 완료 → ${updatedInstance.cooking.currentStep + 1}`)
      }
    }

    // 8. 액션 로그
    logAction({
      actionType: 'INGREDIENT',
      menuName: instance.menuName,
      ingredientId: recipeIngredientId,
      amountInput: amount,
      expectedAmount: matchedIngredient.required_amount,
      isCorrect: true,
      message: `✅ ${displayName}: ${amount}${matchedIngredient.required_unit} 투입`,
    })

    return true
  },

  executeAction: (instanceId, actionType) => {
    const { bundleInstances, getRecipeByMenuName, getRecipeSteps, logAction, woks, fryerState, updateWok } = get()

    // 1. bundleInstances에서 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      return { ok: false, message: '묶음을 찾을 수 없습니다' }
    }

    // 2. 현재 스텝의 action_type 확인
    const recipe = getRecipeByMenuName(instance.menuName)
    const steps = getRecipeSteps(recipe, instance.bundleId)
    const currentStep = steps[instance.cooking.currentStep]

    if (!currentStep || currentStep.action_type !== actionType) {
      return { ok: false, message: `현재 스텝에서 ${actionType} 액션이 필요하지 않습니다` }
    }

    // 3. checkEquipmentCondition (인라인)
    const location = instance.location
    if (location.type === 'WOK') {
      const wok = woks.find((w) => w.burnerNumber === location.burnerNumber)
      if (!wok) {
        return { ok: false, message: '웍을 찾을 수 없습니다' }
      }

      if (actionType === 'STIR_FRY' && wok.temperature < WOK_TEMP.MIN_STIR_FRY) {
        return { ok: false, message: `웍 온도 부족 (${Math.round(wok.temperature)}°C < ${WOK_TEMP.MIN_STIR_FRY}°C)` }
      }
      if (actionType === 'BOIL' && (!wok.hasWater || !wok.isBoiling)) {
        return { ok: false, message: wok.hasWater ? '물이 아직 끓지 않았습니다' : '웍에 물이 없습니다' }
      }
      if (actionType === 'FLIP' && wok.temperature < 100) {
        return { ok: false, message: `웍 온도 부족 (${Math.round(wok.temperature)}°C < 100°C)` }
      }
    } else if (location.type === 'FRYER') {
      if (actionType === 'DEEP_FRY' && fryerState.oilTemperature < FRYER_TEMP.MIN_FRYING) {
        return { ok: false, message: `기름 온도 부족 (${Math.round(fryerState.oilTemperature)}°C < ${FRYER_TEMP.MIN_FRYING}°C)` }
      }
    }

    // 4. applyActionPhysics (인라인)
    if (location.type === 'WOK') {
      const wok = woks.find((w) => w.burnerNumber === location.burnerNumber)
      if (wok) {
        if (actionType === 'STIR_FRY') {
          updateWok(location.burnerNumber, {
            temperature: Math.max(WOK_TEMP.AMBIENT, wok.temperature - WOK_TEMP.ACTION_TEMP.STIR_FRY),
            stirFryCount: wok.stirFryCount + 1,
            isStirFrying: true,
            stirFryStartTime: wok.stirFryStartTime ?? Date.now(),
          })
        } else if (actionType === 'FLIP') {
          updateWok(location.burnerNumber, {
            temperature: Math.max(WOK_TEMP.AMBIENT, wok.temperature - WOK_TEMP.ACTION_TEMP.FLIP),
          })
        }
      }
    }

    // 5. 스텝 진행
    set((s) => ({
      bundleInstances: s.bundleInstances.map((b) =>
        b.id === instanceId
          ? { ...b, cooking: { ...b.cooking, currentStep: b.cooking.currentStep + 1 } }
          : b
      ),
    }))

    // 웍 동기화
    if (location.type === 'WOK') {
      updateWok(location.burnerNumber, {
        currentStep: instance.cooking.currentStep + 1,
      })
    }

    // 6. 액션 로그
    logAction({
      actionType,
      menuName: instance.menuName,
      isCorrect: true,
      message: `✅ ${actionType} 액션 실행`,
    })

    console.log(`✅ executeAction: ${instance.menuName} - ${actionType}`)
    return { ok: true }
  },

  completeBundle: (instanceId) => {
    const { bundleInstances, moveBundle, logAction, updateWok, updateFryerBasket } = get()

    // 1. bundleInstances에서 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      console.error(`❌ completeBundle: instance not found: ${instanceId}`)
      return null
    }

    const location = instance.location

    // 2. cleanupEquipment (조리 완료 → 웍 DIRTY, 세척 필요)
    if (location.type === 'WOK') {
      updateWok(location.burnerNumber, {
        state: 'DIRTY' as const,
        isOn: false,
        burnerOnSince: null,
        isStirFrying: false,
        stirFryStartTime: null,
        stirFryCount: 0,
        currentMenu: null,
        currentOrderId: null,
        currentBundleId: null,
        currentStep: 0,
        totalSteps: 0,
        addedIngredientIds: [],
        stepStartTime: null,
        recipeErrors: 0,
        hasWater: false,
        waterTemperature: WOK_TEMP.AMBIENT,
        waterBoilStartTime: null,
        isBoiling: false,
      })
    } else if (location.type === 'FRYER') {
      // v3.3: FryerBasket은 물리 상태만 관리 (레시피 진행은 BundleInstance에서)
      updateFryerBasket(location.basketNumber, {
        status: 'EMPTY',
        isSubmerged: false,
        orderId: null,
        bundleId: null,
        menuName: null,
        startedAt: null,
      })
    }
    // MICROWAVE: 향후 microwaveEquipment 상태 변경

    // 3. moveBundle → PLATE_SELECT
    moveBundle(instanceId, { type: 'PLATE_SELECT' })

    // 4. 액션 로그
    logAction({
      actionType: 'COMPLETE_BUNDLE',
      menuName: instance.menuName,
      isCorrect: true,
      message: `🎉 ${instance.menuName} - ${instance.bundleName} 조리 완료`,
    })

    console.log(`🎉 completeBundle: ${instance.menuName} - ${instance.bundleName}`)

    // 5. 업데이트된 인스턴스 반환
    return get().bundleInstances.find((b) => b.id === instanceId) ?? null
  },

  routeAfterPlate: (instanceId, plateType) => {
    const { bundleInstances, updateBundleInstance, moveBundle, updateWok } = get()

    // 1. bundleInstances에서 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      console.error(`❌ routeAfterPlate: instance not found: ${instanceId}`)
      return
    }

    // 1.5. 웍에서 이동하는 경우, 웍 상태 정리 (DIRTY → 세척 필요)
    if (instance.location.type === 'WOK') {
      const burnerNumber = instance.location.burnerNumber
      updateWok(burnerNumber, {
        state: 'DIRTY' as const,
        currentMenu: null,
        currentOrderId: null,
        currentBundleId: null,
        currentStep: 0,
        stepStartTime: null,
        addedIngredientIds: [],
        recipeErrors: 0,
        totalSteps: 0,
        isOn: false,
        burnerOnSince: null,
        isStirFrying: false,
        stirFryStartTime: null,
        hasWater: false,
        waterTemperature: WOK_TEMP.AMBIENT,
        waterBoilStartTime: null,
        isBoiling: false,
      })
      console.log(`🧹 routeAfterPlate: 화구 ${burnerNumber}번 상태 정리 완료`)
    }

    // 2. PlatingState 초기화
    const gridCells: Array<{ position: number; layers: Array<{ decoStepId: string; ingredientName: string; imageColor: string; amount: number; appliedAt: number }> }> = []
    for (let i = 1; i <= 9; i++) {
      gridCells.push({ position: i, layers: [] })
    }

    const platingState: PlatingState = {
      plateType,
      gridCells,
      appliedDecos: [],
      mergedBundleIds: [],
    }

    // 3. availableAmount 계산 (합치기 가능 수량 = 조리된 재료 수량)
    const availableAmount = instance.ingredients.length > 0
      ? instance.ingredients.reduce((sum, ing) => sum + ing.amount, 0)
      : 1

    // 4. updateBundleInstance
    updateBundleInstance(instanceId, { plating: platingState, availableAmount })

    // 5. is_main_dish 판별 → 위치 결정
    const plateId = `plate-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (instance.isMainDish) {
      moveBundle(instanceId, { type: 'DECO_MAIN', plateId })
      console.log(`📍 routeAfterPlate: ${instance.menuName} → DECO_MAIN (메인)`)
    } else {
      moveBundle(instanceId, { type: 'DECO_SETTING' })
      console.log(`📍 routeAfterPlate: ${instance.menuName} → DECO_SETTING (비메인)`)
    }
  },

  mergeBundle: (targetInstanceId, sourceInstanceId, requestedAmount?) => {
    const { bundleInstances, decoSteps, level, updateBundleInstance, moveBundle, addDecoMistake } = get()

    // 1. target, source 찾기
    const target = bundleInstances.find((b) => b.id === targetInstanceId)
    const source = bundleInstances.find((b) => b.id === sourceInstanceId)

    if (!target || !source) {
      return { success: false, message: '묶음을 찾을 수 없습니다' }
    }

    // 2. recipeId 일치 검증 (orderId 아님 — 크로스 오더 허용)
    if (target.recipeId !== source.recipeId) {
      return { success: false, message: '같은 레시피의 묶음만 합칠 수 있습니다' }
    }

    // 3. target.isMainDish 검증
    if (!target.isMainDish) {
      return { success: false, message: '메인 접시에만 합칠 수 있습니다' }
    }

    // 4. decoSteps에서 source_bundle_id 매칭
    const decoStep = decoSteps.find(
      (d) => d.recipe_id === target.recipeId && d.source_type === 'BUNDLE' && d.source_bundle_id === source.bundleId
    )

    if (!decoStep) {
      return { success: false, message: '이 묶음을 합칠 수 있는 데코 스텝이 없습니다' }
    }

    // 5. deco_order 순서 검증 — 이전 ALL 스텝 전부 완료 체크 (타입 무관, 수량 누적 기반)
    if (target.plating) {
      const allRecipeSteps = decoSteps
        .filter((s) => s.recipe_id === target.recipeId)
        .sort((a, b) => a.deco_order - b.deco_order)

      const currentStepIndex = allRecipeSteps.findIndex((s) => s.id === decoStep.id)
      const previousSteps = allRecipeSteps.slice(0, currentStepIndex)
      const incompleteSteps = previousSteps.filter((prevStep) => {
        if (prevStep.source_type === 'BUNDLE') {
          // BUNDLE 타입: 수량 누적 기반 판별
          const prevRequired = prevStep.required_amount ?? 1
          const prevMerged = target.plating!.appliedDecos
            .filter((a) => a.decoStepId === prevStep.id)
            .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
          return prevMerged < prevRequired
        }
        // 기타 타입: 기존 존재 여부 체크
        return !target.plating!.appliedDecos.some((applied) => applied.decoStepId === prevStep.id)
      })

      if (incompleteSteps.length > 0) {
        const nextRequiredStep = incompleteSteps[0]
        const nextStepName = nextRequiredStep.display_name ?? '이전 묶음'

        if (level === 'BEGINNER') {
          return { success: false, message: `먼저 "${nextStepName}"을(를) 합쳐야 합니다` }
        } else {
          // 중급 이상: 순서 틀려도 진행하되 감점
          console.warn(`⚠️ mergeBundle 순서 틀림: ${nextStepName} 먼저 필요 (감점 적용)`)
          addDecoMistake()
        }
      }
    }

    // 5.5. 수량 검증 — required_amount 대비 누적 수량 체크
    const required = decoStep.required_amount ?? 1
    const alreadyMerged = target.plating
      ? target.plating.appliedDecos
          .filter((a) => a.decoStepId === decoStep.id)
          .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
      : 0
    const remainingNeeded = required - alreadyMerged

    if (remainingNeeded <= 0) {
      return { success: false, message: '이미 충분한 수량이 합쳐졌습니다' }
    }

    const available = source.availableAmount ?? 1
    const toMerge = requestedAmount
      ? Math.min(requestedAmount, available, remainingNeeded)
      : Math.min(available, remainingNeeded)

    if (toMerge <= 0) {
      return { success: false, message: '합칠 수량이 없습니다' }
    }

    // 6. target.plating에 레이어 추가 (실제 합친 수량 기록)
    if (target.plating) {
      const newAppliedDeco = {
        decoStepId: decoStep.id,
        sourceType: 'BUNDLE' as const,
        gridPosition: decoStep.grid_position,
        imageColor: decoStep.layer_image_color,
        amount: toMerge,
        mergedAmount: toMerge,
      }

      const updatedGridCells = target.plating.gridCells.map((cell) => {
        if (cell.position === decoStep.grid_position) {
          return {
            ...cell,
            layers: [
              ...cell.layers,
              {
                decoStepId: decoStep.id,
                ingredientName: source.bundleName,
                imageColor: decoStep.layer_image_color,
                amount: toMerge,
                appliedAt: Date.now(),
              },
            ],
          }
        }
        return cell
      })

      updateBundleInstance(targetInstanceId, {
        plating: {
          ...target.plating,
          appliedDecos: [...target.plating.appliedDecos, newAppliedDeco],
          gridCells: updatedGridCells,
          mergedBundleIds: [...target.plating.mergedBundleIds, sourceInstanceId],
        },
      })
    }

    // 7. source 잔여 수량 처리
    const newAvailable = available - toMerge

    if (newAvailable > 0) {
      // 잔여 수량 있음 → DECO_SETTING에 유지
      updateBundleInstance(sourceInstanceId, { availableAmount: newAvailable })
      console.log(`🔗 mergeBundle: ${source.bundleName} ${toMerge}ea 합침 → 잔여 ${newAvailable}ea`)
    } else {
      // 전부 소모 → MERGED로 이동
      moveBundle(sourceInstanceId, { type: 'MERGED', targetInstanceId })
      console.log(`🔗 mergeBundle: ${source.bundleName} 전체 합침 (${toMerge}ea)`)
    }
    return { success: true, message: '묶음 병합 완료' }
  },

  serveBundle: (instanceId) => {
    const { bundleInstances, decoSteps, moveBundle, logAction } = get()

    // 1. bundleInstances에서 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      console.error(`❌ serveBundle: instance not found: ${instanceId}`)
      return false
    }

    // location.type === 'DECO_MAIN' 검증
    if (instance.location.type !== 'DECO_MAIN') {
      console.error(`❌ serveBundle: instance is not on DECO_MAIN: ${instance.location.type}`)
      return false
    }

    // 2. 데코 완성 체크 (수량 누적 기반)
    const requiredDecos = decoSteps.filter((d) => d.recipe_id === instance.recipeId)
    const appliedDecos = instance.plating?.appliedDecos ?? []
    const isComplete = requiredDecos.every((d) => {
      if (d.source_type === 'BUNDLE') {
        const required = d.required_amount ?? 1
        const merged = appliedDecos
          .filter((a) => a.decoStepId === d.id)
          .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
        return merged >= required
      }
      return appliedDecos.some((a) => a.decoStepId === d.id)
    })

    if (!isComplete) {
      console.warn(`⚠️ serveBundle: deco not complete for ${instance.menuName}`)
      // 완성되지 않아도 서빙 허용 (점수 감점은 별도 처리)
    }

    // 3. moveBundle → SERVED
    moveBundle(instanceId, { type: 'SERVED' })

    // 4. completedMenus++
    set((s) => ({ completedMenus: s.completedMenus + 1 }))

    // 5. menuQueue 상태 COMPLETED
    set((s) => ({
      menuQueue: s.menuQueue.map((o) =>
        o.id === instance.orderId ? { ...o, status: 'COMPLETED' as const } : o
      ),
    }))

    // 6. 3초 후 menuQueue에서 제거
    setTimeout(() => {
      set((s) => ({
        menuQueue: s.menuQueue.filter((o) => o.id !== instance.orderId),
      }))
    }, 3000)

    // 7. 액션 로그
    logAction({
      actionType: 'SERVE',
      menuName: instance.menuName,
      isCorrect: isComplete,
      message: isComplete
        ? `🎉 ${instance.menuName} 서빙 완료`
        : `⚠️ ${instance.menuName} 서빙 (미완성)`,
    })

    console.log(`🍽️ serveBundle: ${instance.menuName}`)
    return true
  },

  // v3.3 리팩토링: 타이머 틱 (매초 호출)
  // FRYER: isSubmerged && startedAt이면 elapsedSeconds++
  // DEEP_FRY 스텝 완료 시 자동 스텝 진행
  tickBundleTimers: () => {
    const { getRecipeByMenuName, getRecipeSteps, fryerState } = get()

    set((s) => {
      // v3.1 Fix: 전자레인지는 첫 번째 번들만 조리 중 (나머지는 대기)
      const microwaveBundles = s.bundleInstances.filter((b) => b.location.type === 'MICROWAVE')
      const activeMicrowaveId = microwaveBundles[0]?.id

      // v3.3: BURNED 감지된 바스켓 번호 수집
      const burnedBaskets: number[] = []

      const updatedInstances = s.bundleInstances.map((b) => {
        // FRYER: isSubmerged가 true이고 startedAt이 설정된 경우에만 타이머 증가
        if (b.location.type === 'FRYER') {
          const fryerLocation = b.location // 타입 narrowing 유지
          const basket = fryerState.baskets.find((bsk) => bsk.basketNumber === fryerLocation.basketNumber)

          // 바스켓이 기름에 잠겨있고 타이머가 시작된 경우에만 카운트
          if (basket?.isSubmerged && b.cooking.startedAt) {
            const newElapsed = (b.cooking.elapsedSeconds ?? 0) + 1
            const timer = b.cooking.timerSeconds ?? 0

            // v3.3: BURNED 체크 (목표 시간 + 10초 초과 시)
            const burnThreshold = timer + 10
            if (timer > 0 && newElapsed >= burnThreshold) {
              console.log(`🔥 tickBundleTimers: 바스켓 ${fryerLocation.basketNumber} BURNED! (${newElapsed}초 >= ${burnThreshold}초)`)
              burnedBaskets.push(fryerLocation.basketNumber)
            }

            // v3.3: DEEP_FRY 스텝 완료 체크 → 자동 스텝 진행
            if (timer > 0 && newElapsed >= timer) {
              // 현재 스텝이 DEEP_FRY인지 확인
              const recipe = getRecipeByMenuName(b.menuName)
              const steps = getRecipeSteps(recipe, b.bundleId)
              const currentStep = steps[b.cooking.currentStep]

              if (currentStep?.step_type === 'ACTION' && currentStep?.action_type === 'DEEP_FRY') {
                const newStepIndex = b.cooking.currentStep + 1
                console.log(`[tickBundleTimers] FRYER elapsed=${newElapsed}/${timer}, advancing step ${b.cooking.currentStep}→${newStepIndex}`)

                // 다음 스텝 확인 → DEEP_FRY면 timerSeconds 설정
                const nextStep = steps[newStepIndex]
                let nextTimerSeconds = 0
                if (nextStep?.step_type === 'ACTION' && nextStep?.action_type === 'DEEP_FRY') {
                  nextTimerSeconds = (nextStep.action_params as any)?.required_duration ?? 0
                }

                return {
                  ...b,
                  cooking: {
                    ...b.cooking,
                    elapsedSeconds: 0, // 리셋
                    currentStep: newStepIndex,
                    timerSeconds: nextTimerSeconds, // 다음 DEEP_FRY 시간 또는 0
                    startedAt: null, // 타이머 정지 (다음 내리기까지 대기)
                  },
                }
              }
            }

            // 스텝 진행 없이 경과 시간만 증가
            return {
              ...b,
              cooking: {
                ...b.cooking,
                elapsedSeconds: newElapsed,
              },
            }
          }

          // isSubmerged가 false면 카운트 안 함
          return b
        }

        // MICROWAVE: 첫 번째 번들만 타이머 증가 (startedAt 체크 포함)
        if (b.location.type === 'MICROWAVE' && b.id === activeMicrowaveId && b.cooking.startedAt) {
          return {
            ...b,
            cooking: {
              ...b.cooking,
              elapsedSeconds: (b.cooking.elapsedSeconds ?? 0) + 1,
            },
          }
        }

        return b
      })

      // v3.3: BURNED 바스켓 물리 상태 업데이트
      const updatedFryerState = burnedBaskets.length > 0
        ? {
            ...s.fryerState,
            baskets: s.fryerState.baskets.map((basket) =>
              burnedBaskets.includes(basket.basketNumber)
                ? { ...basket, status: 'BURNED' as const }
                : basket
            ),
          }
        : s.fryerState

      return {
        bundleInstances: updatedInstances,
        fryerState: updatedFryerState,
      }
    })
  },

  // v3.3 리팩토링: 튀김기 바스켓 내리기 (장비 물리만)
  // 원칙: 장비 조작 함수는 장비 물리만 변경. 레시피 스텝 안 건드림.
  lowerBundle: (instanceId) => {
    const { bundleInstances, updateBundleInstance, fryerState } = get()

    // 1. BundleInstance 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      return { success: false, message: 'Bundle not found' }
    }

    // 2. FRYER 위치 확인
    if (instance.location.type !== 'FRYER') {
      return { success: false, message: 'Bundle is not in FRYER' }
    }

    const basketNumber = instance.location.basketNumber
    const basket = fryerState.baskets.find((b) => b.basketNumber === basketNumber)

    // 3. 이미 기름에 잠겨있는지 확인
    if (basket?.isSubmerged) {
      return { success: false, message: '이미 기름에 잠겨있습니다' }
    }

    // 4. BundleInstance 타이머 시작 (물리 상태 - 레시피 스텝 아님)
    // 기름이 항상 180도이므로 내리자마자 타이머 시작
    updateBundleInstance(instanceId, {
      cooking: {
        ...instance.cooking,
        startedAt: Date.now(),
        // elapsedSeconds는 유지 (중간에 올렸다 내린 경우)
      },
    })

    // 5. 장비 물리: isSubmerged = true
    set((s) => ({
      fryerState: {
        ...s.fryerState,
        baskets: s.fryerState.baskets.map((b) =>
          b.basketNumber === basketNumber
            ? {
                ...b,
                isSubmerged: true,
                startedAt: Date.now(),
              }
            : b
        ),
      },
    }))

    console.log(`[lowerBundle] basketNumber=${basketNumber}, isSubmerged=true, startedAt=${Date.now()}`)
    return { success: true }
  },

  // v3.3 리팩토링: 튀김기 바스켓 들어올리기 (장비 물리만)
  // 원칙: 장비 조작 함수는 장비 물리만 변경. 레시피 스텝 안 건드림.
  liftBundle: (instanceId) => {
    const { bundleInstances, updateBundleInstance, fryerState } = get()

    // 1. BundleInstance 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      return { success: false, message: 'Bundle not found' }
    }

    // 2. FRYER 위치 확인
    if (instance.location.type !== 'FRYER') {
      return { success: false, message: 'Bundle is not in FRYER' }
    }

    const basketNumber = instance.location.basketNumber
    const basket = fryerState.baskets.find((b) => b.basketNumber === basketNumber)

    // 3. 이미 올라와있는지 확인
    if (basket && !basket.isSubmerged) {
      return { success: false, message: '이미 올라와있습니다' }
    }

    // 4. BundleInstance 타이머 정지 (물리 상태 - 레시피 스텝 아님)
    const currentElapsed = instance.cooking.elapsedSeconds ?? 0
    updateBundleInstance(instanceId, {
      cooking: {
        ...instance.cooking,
        startedAt: null, // 타이머 정지
        elapsedSeconds: currentElapsed, // 진행 시간 유지
      },
    })

    // 5. 장비 물리: isSubmerged = false
    set((s) => ({
      fryerState: {
        ...s.fryerState,
        baskets: s.fryerState.baskets.map((b) =>
          b.basketNumber === basketNumber
            ? {
                ...b,
                isSubmerged: false,
                startedAt: null,
              }
            : b
        ),
      },
    }))

    console.log(`[liftBundle] basketNumber=${basketNumber}, isSubmerged=false`)
    return { success: true }
  },

  // v3.1 리팩토링: 묶음 폐기 (BundleInstance 제거 + 장비 상태 초기화)
  discardBundle: (instanceId) => {
    const { bundleInstances, logAction } = get()

    // 1. BundleInstance 찾기
    const instance = bundleInstances.find((b) => b.id === instanceId)
    if (!instance) {
      console.warn(`❌ discardBundle: instance not found: ${instanceId}`)
      return
    }

    const orderId = instance.orderId
    const location = instance.location

    console.log(`🗑️ discardBundle: ${instance.menuName} (${instance.bundleName}) 폐기`)

    // 2. 장비 상태 초기화 (location 기반)
    if (location.type === 'FRYER') {
      set((s) => ({
        fryerState: {
          ...s.fryerState,
          baskets: s.fryerState.baskets.map((b) =>
            b.basketNumber === location.basketNumber
              ? {
                  ...b,
                  status: 'EMPTY' as const,
                  isSubmerged: false,
                  orderId: null,
                  bundleId: null,
                  menuName: null,
                  startedAt: null,
                }
              : b
          ),
        },
      }))
    } else if (location.type === 'WOK') {
      // emptyWok과 동일한 수준으로 초기화
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === location.burnerNumber
            ? {
                ...w,
                state: 'DIRTY' as const,
                currentMenu: null,
                currentOrderId: null,
                currentBundleId: null,
                currentStep: 0,
                totalSteps: 0,
                addedIngredientIds: [],
                stepStartTime: null,
                recipeErrors: 0,
                isOn: false,
                burnerOnSince: null,
                isStirFrying: false,
                stirFryStartTime: null,
                hasWater: false,
                waterTemperature: WOK_TEMP.AMBIENT,
                waterBoilStartTime: null,
                isBoiling: false,
              }
            : w
        ),
      }))
    }

    // 3. BundleInstance 제거
    set((s) => ({
      bundleInstances: s.bundleInstances.filter((b) => b.id !== instanceId),
    }))

    // 4. menuQueue 상태 WAITING으로 리셋 (재배정 가능)
    set((s) => ({
      menuQueue: s.menuQueue.map((o) =>
        o.id === orderId && o.status === 'COOKING'
          ? { ...o, status: 'WAITING' as const }
          : o
      ),
    }))

    // 5. 액션 로그
    logAction({
      actionType: 'DISCARD',
      menuName: instance.menuName,
      isCorrect: false,
      message: `🗑️ ${instance.menuName} - ${instance.bundleName} 폐기`,
    })
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

    // v3.4: bundleInstance.ingredients 동기화 (DecoZone 표시 + availableAmount 계산용)
    const { bundleInstances: currentBundles, updateBundleInstance: syncBundleIngredients } = get()
    const bundleForWok = currentBundles.find(
      (b) => b.location.type === 'WOK' && b.location.burnerNumber === burnerNumber
    )
    if (bundleForWok) {
      const ingredientUnit = matchedIngredient?.required_unit ?? 'g'
      const existingIdx = bundleForWok.ingredients.findIndex((ing) => ing.name === displayName)
      let updatedIngredients: typeof bundleForWok.ingredients
      if (existingIdx >= 0) {
        updatedIngredients = bundleForWok.ingredients.map((ing, idx) =>
          idx === existingIdx ? { ...ing, amount: ing.amount + amount } : ing
        )
      } else {
        updatedIngredients = [...bundleForWok.ingredients, { name: displayName, amount, unit: ingredientUnit }]
      }
      syncBundleIngredients(bundleForWok.id, { ingredients: updatedIngredients })
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
            // BundleInstance 제거 (재배정 가능하도록)
            bundleInstances: s.bundleInstances.filter(
              (b) => !(b.location.type === 'WOK' && b.location.burnerNumber === burnerNumber)
            ),
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
        // BundleInstance 제거 (재배정 가능하도록)
        bundleInstances: s.bundleInstances.filter(
          (b) => !(b.location.type === 'WOK' && b.location.burnerNumber === burnerNumber)
        ),
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

    // 3. v3.1: source_bundle_id로 검색 (BUNDLE 타입) - recipe_id 필수
    // 완성된 묶음(settingItem)을 메인 플레이트에 합칠 때 사용
    const stepByBundle = decoSteps.find(
      (s) => s.source_bundle_id === ingredientId && s.recipe_id === recipeId && s.source_type === 'BUNDLE'
    )
    if (stepByBundle) return stepByBundle

    // ⚠️ 레시피 무관 검색(fallback) 제거 - 의도치 않은 재료 허용 방지
    // 해당 레시피에 맞는 스텝이 없으면 null 반환
    return null
  },

  // v3: 데코 아이템 적용 (그리드 위치 + 수량 + deco_order 검증)
  applyDecoItem: (plateId, gridPosition, ingredientId, amount) => {
    const { bundleInstances, decoSteps, checkDecoComplete, level, addDecoMistake } = get()
    // v3.1: BundleInstance에서 플레이트 찾기 (DECO_MAIN location)
    const instance = bundleInstances.find((b) => b.id === plateId && b.location.type === 'DECO_MAIN')
    // 하위 호환성: instance의 plating에서 plate 정보 추출
    const plate = instance ? {
      id: instance.id,
      recipeId: instance.recipeId,
      isMainDish: instance.isMainDish,
      menuName: instance.menuName,
      appliedDecos: instance.plating?.appliedDecos ?? [],
      gridCells: instance.plating?.gridCells ?? [],
    } : null
    // v3.1: DECO_SETTING 위치의 인스턴스를 settingItems로 사용
    const settingInstances = bundleInstances.filter((b) => b.location.type === 'DECO_SETTING')

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
    // 3. v3.1: source_bundle_id로 검색 (BUNDLE 타입 settingItem)
    if (!decoStep) {
      decoStep = decoSteps.find(
        (s) => s.source_bundle_id === ingredientId && s.recipe_id === plate.recipeId && s.source_type === 'BUNDLE'
      )
    }
    // ⚠️ 주의: 레시피 무관 검색(fallback)은 의도치 않은 재료 허용을 유발하므로 제거
    // 반드시 해당 레시피의 데코 스텝에서만 검색해야 함

    if (!decoStep) {
      console.warn(`❌ 데코 스텝 없음: ingredientId=${ingredientId}, recipeId=${plate.recipeId}`)
      return { success: false, message: '이 레시피에서 사용할 수 없는 재료입니다', isPositionError: false }
    }

    const step = decoStep

    // v3.1: BUNDLE 타입은 메인 플레이트에만 합칠 수 있음
    if (step.source_type === 'BUNDLE') {
      if (!plate.isMainDish) {
        return { success: false, message: '묶음은 메인 플레이트에만 합칠 수 있습니다', isPositionError: false }
      }

      // BUNDLE 스텝 순서 검증 (ALL 타입 통합, 수량 완료 확인)
      const allRecipeSteps = decoSteps
        .filter((s) => s.recipe_id === plate.recipeId)
        .sort((a, b) => a.deco_order - b.deco_order)

      const currentStepIndex = allRecipeSteps.findIndex((s) => s.id === step.id)
      const previousSteps = allRecipeSteps.slice(0, currentStepIndex)
      const incompleteSteps = previousSteps.filter((prevStep) => {
        if (prevStep.source_type === 'BUNDLE') {
          const prevRequired = prevStep.required_amount ?? 1
          const prevMerged = plate.appliedDecos
            .filter((a) => a.decoStepId === prevStep.id)
            .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
          return prevMerged < prevRequired
        }
        return !plate.appliedDecos.some((applied) => applied.decoStepId === prevStep.id)
      })

      if (incompleteSteps.length > 0) {
        const nextRequiredStep = incompleteSteps[0]
        const nextStepName = nextRequiredStep.display_name ?? '이전 묶음'

        if (level === 'BEGINNER') {
          return {
            success: false,
            message: `먼저 "${nextStepName}"을(를) 합쳐야 합니다`,
            isPositionError: false,
            isOrderError: true,
          }
        } else {
          console.warn(`⚠️ BUNDLE 순서 틀림: ${nextStepName} 먼저 필요 (감점 적용)`)
          addDecoMistake()
        }
      }

      console.log(`🥡 BUNDLE 합치기: ${step.display_name} → ${plate.menuName}`)
    }

    // v3: deco_order 순서 검증 (non-BUNDLE 아이템) — ALL 타입 통합
    if (step.source_type !== 'BUNDLE') {
      // 해당 레시피의 모든 데코 스텝을 deco_order 순으로 정렬 (타입 무관)
      const orderedSteps = decoSteps
        .filter((s) => s.recipe_id === plate.recipeId)
        .sort((a, b) => a.deco_order - b.deco_order)

      const currentStepIndex = orderedSteps.findIndex((s) => s.id === step.id)

      if (currentStepIndex > 0) {
        // 이전 스텝들이 모두 완료되었는지 확인 (BUNDLE은 수량 기반)
        const previousSteps = orderedSteps.slice(0, currentStepIndex)
        const incompleteSteps = previousSteps.filter((prevStep) => {
          if (prevStep.source_type === 'BUNDLE') {
            const prevRequired = prevStep.required_amount ?? 1
            const prevMerged = plate.appliedDecos
              .filter((a) => a.decoStepId === prevStep.id)
              .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
            return prevMerged < prevRequired
          }
          return !plate.appliedDecos.some((applied) => applied.decoStepId === prevStep.id)
        })

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
    // v3.5: BUNDLE 타입은 수량 누적 허용 (1ea + 1ea = 2ea)
    if (step.source_type !== 'BUNDLE') {
      const alreadyPlaced = plate.appliedDecos.some(
        (applied) => applied.decoStepId === step.id && applied.gridPosition === gridPosition
      )
      if (alreadyPlaced) {
        return { success: false, message: '이미 배치된 재료입니다', isPositionError: false }
      }
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
    // BUNDLE 타입은 required_amount 필수 — NULL이면 DB 오류
    if (step.source_type === 'BUNDLE' && (step.required_amount == null || step.required_amount <= 0)) {
      console.error('[applyDecoItem] required_amount 누락:', step.display_name)
      return { success: false, message: `${step.display_name}의 필요 수량이 설정되지 않았습니다. DB를 확인하세요.`, isPositionError: false }
    }
    const requiredAmount = step.required_amount ?? 1
    // v3.5: BUNDLE 타입은 누적 기반 수량 검증 (부분 합치기 허용)
    if (step.source_type === 'BUNDLE') {
      const alreadyMerged = plate.appliedDecos
        .filter((a) => a.decoStepId === step.id)
        .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
      const remainingNeeded = requiredAmount - alreadyMerged
      if (remainingNeeded <= 0) {
        return { success: false, message: '이미 충분한 수량이 합쳐졌습니다', isPositionError: false }
      }
      if (amount > remainingNeeded) {
        return { success: false, message: `필요 수량 초과 (남은 필요량: ${remainingNeeded})`, isPositionError: false }
      }
    } else if (amount !== requiredAmount) {
      return {
        success: false,
        message: `수량이 맞지 않습니다 (필요: ${requiredAmount})`,
        isPositionError: false,
      }
    }

    // v3.1: DECO_SETTING 위치의 번들에서 재료 찾기 (BUNDLE 타입 스텝용)
    const settingBundle = settingInstances.find((b) => b.bundleId === ingredientId)

    // v3.1: BundleInstance 기반 이름 추출
    const ingredientName = settingBundle?.bundleName ?? settingBundle?.menuName ?? step.display_name ?? ingredientId

    // v3: 레이어 생성 (decoStepId 사용)
    const newLayer = {
      decoStepId: step.id,
      ingredientName,
      imageColor: step.layer_image_color ?? '#9CA3AF',
      amount,
      appliedAt: Date.now(),
    }

    // v3: appliedDecos 엔트리 생성
    const newAppliedDeco = {
      decoStepId: step.id,
      sourceType: step.source_type,
      gridPosition,
      imageColor: step.layer_image_color ?? '#9CA3AF',
      amount,
      ...(step.source_type === 'BUNDLE' ? { mergedAmount: amount } : {}),
    }

    // v3.1: BundleInstance.plating 업데이트
    set((s) => {
      // 현재 인스턴스의 plating 상태 가져오기
      const currentInstance = s.bundleInstances.find((b) => b.id === plateId)
      if (!currentInstance || !currentInstance.plating) {
        console.warn('❌ plating 상태 없음:', plateId)
        return s
      }

      const currentPlating = currentInstance.plating
      const updatedCells = [...currentPlating.gridCells]
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

      return {
        // v3.1: bundleInstances만 업데이트 (decoPlates, decoSettingItems 동기화 제거)
        bundleInstances: s.bundleInstances.map((b) => {
          // 타겟 플레이트 업데이트
          if (b.id === plateId) {
            return {
              ...b,
              plating: {
                ...currentPlating,
                gridCells: updatedCells,
                appliedDecos: [...currentPlating.appliedDecos, newAppliedDeco],
              },
            }
          }
          // v3.3: 소스 번들 처리 (BUNDLE 타입 또는 SETTING_ITEM)
          if (settingBundle && b.id === settingBundle.id) {
            // 수량 차감 로직 (availableAmount 우선 사용)
            const currentAmount = b.availableAmount ?? (b.ingredients?.[0]?.amount ?? 1)
            const remainingAmount = currentAmount - amount

            if (remainingAmount <= 0) {
              // 수량 소진 → MERGED로 이동
              console.log(`🎨 ${b.bundleName}: 수량 소진 → MERGED`)
              return {
                ...b,
                availableAmount: 0,
                location: { type: 'MERGED' as const, targetInstanceId: plateId },
              }
            } else {
              // 잔량 있음 → availableAmount 차감
              console.log(`🎨 ${b.bundleName}: ${currentAmount} - ${amount} = ${remainingAmount} 남음`)
              return {
                ...b,
                availableAmount: remainingAmount,
              }
            }
          }
          return b
        }),
      }
    })

    console.log(`🎨 데코 적용: ${newLayer.ingredientName} x${amount} → 위치 ${gridPosition}`)
    return { success: true, message: '데코 적용 완료', isPositionError: false }
  },

  // 합치기 모드 진입
  // v3.1: BundleInstance 기반으로 리팩토링
  enterMergeMode: (sourcePlateId) => {
    const { bundleInstances } = get()
    const sourceInstance = bundleInstances.find((b) => b.id === sourcePlateId && b.location.type === 'DECO_MAIN')

    if (!sourceInstance || sourceInstance.isMainDish) {
      console.warn('❌ 사이드 플레이트만 합치기 가능')
      return
    }

    set({
      mergeMode: true,
      selectedSourcePlateId: sourcePlateId,
      selectedDecoIngredient: null, // 재료 선택 해제
    })
    console.log(`🔀 합치기 모드 진입: ${sourceInstance.bundleName}`)
  },

  // 합치기 모드 종료
  exitMergeMode: () => {
    set({ mergeMode: false, selectedSourcePlateId: null })
    console.log('🔀 합치기 모드 종료')
  },

  // 다음 합치기 스텝 조회 (deco_order 순서)
  // v3.1: BundleInstance 기반으로 리팩토링
  getNextMergeStep: (recipeId) => {
    const { decoSteps, bundleInstances } = get()
    const mainInstance = bundleInstances.find((b) => b.recipeId === recipeId && b.isMainDish && b.location.type === 'DECO_MAIN')
    if (!mainInstance || !mainInstance.plating) return null

    const appliedDecos = mainInstance.plating.appliedDecos

    // 해당 레시피의 BUNDLE 타입 스텝들을 deco_order 순으로 정렬
    const bundleSteps = decoSteps
      .filter((s) => s.recipe_id === recipeId && s.source_type === 'BUNDLE')
      .sort((a, b) => a.deco_order - b.deco_order)

    // 아직 수량이 충족되지 않은 첫 번째 BUNDLE 스텝 찾기
    const nextStep = bundleSteps.find((step) => {
      const required = step.required_amount ?? 1
      const merged = appliedDecos
        .filter((a) => a.decoStepId === step.id)
        .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
      return merged < required
    })

    return nextStep ?? null
  },

  // v3: 데코 완료 체크 (모든 데코 스텝 충족 여부)
  // v3.1: BundleInstance 기반으로 리팩토링
  checkDecoComplete: (plateId) => {
    const { bundleInstances, decoSteps, recipeBundles } = get()
    // v3.1: BundleInstance에서 플레이트 찾기
    const instance = bundleInstances.find((b) => b.id === plateId && b.location.type === 'DECO_MAIN')

    if (!instance || !instance.plating) return false

    const appliedDecos = instance.plating.appliedDecos

    // v3: 해당 레시피의 모든 데코 스텝 찾기
    const recipeDecoSteps = decoSteps.filter(
      (s) => s.recipe_id === instance.recipeId
    )

    // 데코 스텝이 있으면 반드시 체크 (deco_required 무관)
    if (recipeDecoSteps.length > 0) {
      // v3.4: 모든 데코 스텝이 수량 기준으로 완성되었는지 확인
      const allStepsApplied = recipeDecoSteps.every((step) => {
        if (step.source_type === 'BUNDLE') {
          // BUNDLE 타입: 수량 누적 >= required_amount
          const required = step.required_amount ?? 1
          const merged = appliedDecos
            .filter((a) => a.decoStepId === step.id)
            .reduce((sum, a) => sum + (a.mergedAmount ?? 1), 0)
          return merged >= required
        }
        // 기타 타입 (DECO_ITEM, SETTING_ITEM): 기존 존재 여부 체크
        return appliedDecos.some((applied) => applied.decoStepId === step.id)
      })
      return allStepsApplied
    }

    // 데코 스텝이 없을 때만 번들의 deco_required 확인
    const bundle = recipeBundles.find((b) => b.id === instance.bundleId)
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

  // ============================================
  // === v3.1: 튀김기 물리 상태 업데이트 (내부용) ===
  // ============================================

  updateFryerBasket: (basketNumber, updates) => {
    set((s) => ({
      fryerState: {
        ...s.fryerState,
        baskets: s.fryerState.baskets.map((b) =>
          b.basketNumber === basketNumber ? { ...b, ...updates } : b
        ),
      },
    }))
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
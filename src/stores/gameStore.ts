import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  Store,
  User,
  KitchenLayout,
  Recipe,
  IngredientInventory,
  Seasoning,
  GameSession,
  Wok,
  MenuOrder,
  ActionLog,
  BurnerUsageLog,
  GameLevel,
} from '../types/database.types'
import { WOK_TEMP, MENU_TIMER, calculateTimeScore } from '../types/database.types'

const INITIAL_WOKS: Wok[] = [
  { 
    burnerNumber: 1, 
    isOn: false, 
    state: 'CLEAN', 
    position: 'AT_BURNER', 
    currentMenu: null, 
    currentOrderId: null, 
    currentStep: 0, 
    stepStartTime: null, 
    burnerOnSince: null, 
    addedIngredients: [],
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
  },
  { 
    burnerNumber: 2, 
    isOn: false, 
    state: 'CLEAN', 
    position: 'AT_BURNER', 
    currentMenu: null, 
    currentOrderId: null, 
    currentStep: 0, 
    stepStartTime: null, 
    burnerOnSince: null, 
    addedIngredients: [],
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
  },
  { 
    burnerNumber: 3, 
    isOn: false, 
    state: 'CLEAN', 
    position: 'AT_BURNER', 
    currentMenu: null, 
    currentOrderId: null, 
    currentStep: 0, 
    stepStartTime: null, 
    burnerOnSince: null, 
    addedIngredients: [],
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
  },
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
  seasonings: Seasoning[]
  
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
  assignMenuToWok: (menuId: string, burnerNumber: number) => void
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
  getCurrentStepIngredients: (menuName: string, stepIndex: number) => { required_sku: string; required_amount: number; required_unit: string }[]
  validateAndAdvanceIngredient: (burnerNumber: number, sku: string, amount: number, isSeasoning: boolean) => boolean
  validateAndAdvanceAction: (burnerNumber: number, actionType: string) => { ok: boolean; burned?: boolean }
  
  // 4호박스 뷰 액션
  openFridgeZoom: (position: string) => void
  closeFridgeView: () => void
  openFridgeDoor: () => void
  selectFloor: (floor: number) => void
  backToFridgeZoom: () => void
  
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
  seasonings: [],
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

  setStore: (store) => set({ currentStore: store }),
  setUser: (user) => set({ currentUser: user }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setLevel: (level) => set({ level }),

  resetGameState: () =>
    set({
      woks: INITIAL_WOKS.map((w) => ({ ...w })),
      menuQueue: [],
      actionLogs: [],
      burnerUsageHistory: [],
      elapsedSeconds: 0,
      completedMenus: 0,
      usedMenuNames: new Set(),
      lastServeError: null,
    }),

  reset: () =>
    set({
      currentStore: null,
      currentUser: null,
      currentSession: null,
      level: 'BEGINNER',
      kitchenLayout: null,
      ingredients: [],
      recipes: [],
      seasonings: [],
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
    }),

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
                    currentStep: 0,
                    stepStartTime: null,
                    isOn: false,
                    burnerOnSince: null,
                    addedIngredients: [],
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

  assignMenuToWok: (menuId, burnerNumber) => {
    const { woks, menuQueue, getRecipeByMenuName } = get()
    const order = menuQueue.find((o) => o.id === menuId)
    if (!order || order.status !== 'WAITING') return

    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || wok.state !== 'CLEAN' || wok.currentMenu) return

    const recipe = getRecipeByMenuName(order.menuName)
    if (!recipe) return

    const totalSteps = recipe.steps?.length || 0

    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? {
              ...w,
              currentMenu: order.menuName,
              currentOrderId: order.id,
              currentStep: 0,
              stepStartTime: Date.now(),
              isOn: true,
              burnerOnSince: Date.now(),
              addedIngredients: [], // 초기화
              stirFryCount: 0, // 볶기 횟수 초기화
              recipeErrors: 0, // 오류 횟수 초기화
              totalSteps: totalSteps, // 총 스텝 수 저장
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
      message: `화구${burnerNumber}: ${order.menuName} 배정`,
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
              console.log(`화구${wok.burnerNumber}: 💧 물이 100°C 도달!`)
            }
          }
          
          // 100도에서 5초 유지하면 끓기 시작
          if (newWaterTemp >= WOK_TEMP.WATER_BOIL && newWaterBoilStartTime) {
            const boilDuration = now - newWaterBoilStartTime
            if (boilDuration >= WOK_TEMP.WATER_BOIL_DURATION && !newIsBoiling) {
              newIsBoiling = true
              console.log(`화구${wok.burnerNumber}: 💦 물이 끓기 시작!`)
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
          console.log(`화구${wok.burnerNumber}: ✨ 웍이 말랐습니다! (온도: ${Math.round(newTemp)}°C)`)
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
            currentStep: 0,
            stepStartTime: null,
            addedIngredients: [],
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
          console.log(`화구${wok.burnerNumber}: ✅ 정상 복귀 (온도: ${Math.round(newTemp)}°C)`)
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
              currentStep: 0,
              stepStartTime: null,
              isOn: false,
              burnerOnSince: null,
              addedIngredients: [],
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
    const sortedSteps = recipe?.steps ? [...recipe.steps].sort((a, b) => a.step_number - b.step_number) : []
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
          ? { ...w, state: 'DIRTY' as const, currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null, addedIngredients: [], recipeErrors: 0, totalSteps: 0 }
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
    const { elapsedSeconds, currentSession } = get()
    const log: ActionLog = {
      timestamp: new Date(),
      elapsedSeconds,
      ...action,
    }
    set((s) => ({ actionLogs: [...s.actionLogs, log] }))

    if (currentSession?.id) {
      supabase.from('game_action_logs').insert({
        session_id: currentSession.id,
        timestamp: log.timestamp.toISOString(),
        elapsed_time_seconds: log.elapsedSeconds,
        action_type: log.actionType,
        menu_name: log.menuName ?? null,
        burner_number: log.burnerNumber ?? null,
        ingredient_sku: log.ingredientSKU ?? null,
        amount_input: log.amountInput ?? null,
        expected_sku: log.expectedSKU ?? null,
        expected_amount: log.expectedAmount ?? null,
        is_correct: log.isCorrect,
        timing_correct: log.timingCorrect ?? null,
        action_detail: log.message,
      }).then(() => {})
    }
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
    const [layoutRes, ingredientsRes, recipesRes, seasoningsRes] = await Promise.all([
      supabase.from('kitchen_layouts').select('*').eq('store_id', storeId).single(),
      supabase
        .from('ingredients_inventory')
        .select('*, ingredient_master:ingredients_master(*), storage_location:storage_locations(*)')
        .eq('store_id', storeId),
      supabase
        .from('recipes')
        .select(
          `*,
          steps:recipe_steps(
            *,
            ingredients:recipe_ingredients(*)
          )`
        )
        .eq('store_id', storeId),
      supabase.from('seasonings').select('*').eq('store_id', storeId),
    ])

    set({
      kitchenLayout: layoutRes.data ?? null,
      ingredients: ingredientsRes.data ?? [],
      recipes: recipesRes.data ?? [],
      seasonings: seasoningsRes.data ?? [],
    })
  },

  preloadStorageData: async (storeId) => {
    console.log('🔄 식자재 데이터 프리로딩 시작...')
    
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
            console.log(`ℹ️ ${locationCode} - DB에 없음 (건너뜀)`)
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
            console.log(`ℹ️ ${locationCode} - 식자재 없음`)
            return { locationCode, data: null }
          }

          console.log(`✅ ${locationCode} - ${ingredients.length}개 식자재 로드`)
          
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

    console.log(`🎉 프리로딩 완료: ${successCount}/${locationCodes.length}개 위치 캐시됨`)
    set({ storageCache: cache })
  },

  startGame: async () => {
    const { currentUser, currentStore, level, resetGameState } = get()
    if (!currentUser || !currentStore) return null

    resetGameState()

    const { data: session, error } = await supabase
      .from('game_sessions')
      .insert({
        user_id: currentUser.id,
        store_id: currentStore.id,
        level,
        total_menus_target: TARGET_MENUS,
        start_time: new Date().toISOString(),
        status: 'IN_PROGRESS',
      })
      .select()
      .single()

    if (error || !session) return null

    set({
      currentSession: session as GameSession,
      isPlaying: true,
      level,
      elapsedSeconds: 0,
      completedMenus: 0,
      menuQueue: [],
      actionLogs: [],
      burnerUsageHistory: [],
      woks: INITIAL_WOKS.map((w) => ({ ...w })),
      usedMenuNames: new Set(),
    })
    return session as GameSession
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

  getCurrentStepIngredients: (menuName, stepIndex) => {
    const recipe = get().getRecipeByMenuName(menuName)
    if (!recipe?.steps?.length) return []
    const sortedSteps = [...recipe.steps].sort((a, b) => a.step_number - b.step_number)
    if (stepIndex >= sortedSteps.length) return []
    const step = sortedSteps[stepIndex]
    return (step.ingredients ?? []).map((i) => ({
      required_sku: i.required_sku,
      required_amount: i.required_amount,
      required_unit: i.required_unit,
    }))
  },

  validateAndAdvanceIngredient: (burnerNumber, sku, amount, isSeasoning) => {
    const { woks, getRecipeByMenuName, getCurrentStepIngredients, logAction, level } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu) return false

    const recipe = getRecipeByMenuName(wok.currentMenu)
    if (!recipe?.steps?.length) return false
    const reqs = getCurrentStepIngredients(wok.currentMenu, wok.currentStep)
    
    const isBeginnerLevel = level === 'BEGINNER'
    
    // 이미 추가한 재료는 다시 추가 불가
    if (wok.addedIngredients.includes(sku)) {
      logAction({
        actionType: 'ADD_TO_WOK',
        menuName: wok.currentMenu,
        burnerNumber,
        ingredientSKU: sku,
        amountInput: amount,
        isCorrect: false,
        message: `화구${burnerNumber}: 이미 투입한 재료입니다`,
      })
      return false
    }
    
    const match = reqs.find((r) => {
      if (isSeasoning) {
        return r.required_sku.startsWith('SEASONING:') && r.required_sku.includes(sku.split(':')[1]) && r.required_amount === amount
      }
      return r.required_sku === sku && r.required_amount === amount
    })
    const isCorrect = !!match

    logAction({
      actionType: 'ADD_TO_WOK',
      menuName: wok.currentMenu,
      burnerNumber,
      ingredientSKU: sku,
      amountInput: amount,
      expectedSKU: match?.required_sku,
      expectedAmount: match?.required_amount,
      isCorrect,
      message: isCorrect ? `화구${burnerNumber}: 재료 투입 정확` : `화구${burnerNumber}: 재료 투입 오류`,
    })

    // 신입 단계에서는 틀리면 중단
    if (isBeginnerLevel && !isCorrect) {
      return false
    }
    
    // 신입이 아닌 경우, 틀려도 오류 카운트만 증가하고 진행
    const errorIncrement = isCorrect ? 0 : 1

    // 재료 투입 시 온도 하락 (재료 특성에 따라)
    let tempDrop = WOK_TEMP.COOLING.SEASONING // 기본값
    
    // 재료 카테고리 판단 (SKU 기반)
    const skuLower = sku.toLowerCase()
    if (skuLower.includes('양파') || skuLower.includes('애호박') || skuLower.includes('당근') || 
        skuLower.includes('onion') || skuLower.includes('zucchini') || skuLower.includes('carrot')) {
      tempDrop = WOK_TEMP.COOLING.VEGETABLE
    } else if (skuLower.includes('새우') || skuLower.includes('오징어') || 
               skuLower.includes('shrimp') || skuLower.includes('squid')) {
      tempDrop = WOK_TEMP.COOLING.SEAFOOD
    } else if (skuLower.includes('계란') || skuLower.includes('egg')) {
      tempDrop = WOK_TEMP.COOLING.EGG
    } else if (skuLower.includes('밥') || skuLower.includes('rice')) {
      tempDrop = WOK_TEMP.COOLING.RICE
    }
    
    // 온도 하락 적용
    const newTemp = Math.max(WOK_TEMP.AMBIENT, wok.temperature - tempDrop)
    console.log(`화구${burnerNumber}: 재료 투입으로 온도 하락 ${Math.round(wok.temperature)}°C → ${Math.round(newTemp)}°C (-${tempDrop}°C)`)

    // 투입한 재료 목록에 추가
    const newAddedIngredients = [...wok.addedIngredients, sku]
    
    // 현재 스텝의 모든 재료가 투입되었는지 확인
    const allIngredientsAdded = reqs.every((req) => 
      newAddedIngredients.some((added) => {
        // SEASONING인 경우 부분 매칭
        if (req.required_sku.startsWith('SEASONING:')) {
          return added.includes(req.required_sku.split(':')[1])
        }
        return added === req.required_sku
      })
    )

    if (allIngredientsAdded) {
      // 모든 재료 투입 완료 → 다음 스텝으로
      const nextStep = wok.currentStep + 1
      console.log(`화구${burnerNumber}: 스텝 ${wok.currentStep} 모든 재료 투입 완료 (${reqs.length}개) → 스텝 ${nextStep}로 진행`)
      
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { 
                ...w, 
                currentStep: nextStep, 
                stepStartTime: Date.now(),
                burnerOnSince: w.isOn ? Date.now() : w.burnerOnSince,
                addedIngredients: [], // 다음 스텝 시작 시 초기화
                temperature: newTemp, // 온도 반영
                recipeErrors: w.recipeErrors + errorIncrement, // 오류 누적
              }
            : w
        ),
      }))
    } else {
      // 아직 더 넣을 재료가 있음
      console.log(`화구${burnerNumber}: 재료 투입 (${newAddedIngredients.length}/${reqs.length}) - 계속 진행`)
      
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { 
                ...w, 
                addedIngredients: newAddedIngredients,
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
    const sortedSteps = recipe?.steps ? [...recipe.steps].sort((a, b) => a.step_number - b.step_number) : []
    const step = sortedSteps[wok.currentStep]
    
    console.log('액션 검증:', {
      burnerNumber,
      currentMenu: wok.currentMenu,
      currentStep: wok.currentStep,
      totalSteps: sortedSteps.length,
      step,
      actionType,
      isBeginnerLevel,
    })
    
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
      
      if (addWater) {
        console.log(`화구${burnerNumber}: 💧 물 추가 (잘못된 타이밍이지만 신입 아님) - 온도 25°C로 리셋`)
      }
      
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
          console.log(`화구${burnerNumber}: 볶기 온도 하락 (1초 후) ${Math.round(currentWok.temperature)}°C → ${Math.round(newTemp)}°C`)
          
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
                ? { ...w, state: 'BURNED' as const, currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null, addedIngredients: [], recipeErrors: 0, totalSteps: 0 } 
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
                  addedIngredients: [], // 다음 스텝 시작 시 재료 목록 초기화
                  recipeErrors: w.recipeErrors + (timingCorrect ? 0 : 1), // 타이밍 오류 카운트
                }
              : w
          ),
        }))
        return { ok: true }
      } else {
        // 현재 스텝이 볶기가 아님 - 온도 조절용
        console.log(`화구${burnerNumber}: 추가 볶기 (온도 조절용)`)
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
    if (tempDrop > 0) {
      console.log(`화구${burnerNumber}: ${actionType} 실행으로 온도 하락 ${Math.round(wok.temperature)}°C → ${Math.round(newTemp)}°C (-${tempDrop}°C)`)
    }
    
    if (addWater) {
      console.log(`화구${burnerNumber}: 💧 물 추가 - 온도 25°C로 리셋, 물 시스템 활성화`)
    }
    
    // 신입 단계에서만 타이밍 오류 시 타버림 처리
    if (isBeginnerLevel && !timingCorrect) {
      const orderId = wok.currentOrderId
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber 
            ? { ...w, state: 'BURNED' as const, currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null, addedIngredients: [], recipeErrors: 0, totalSteps: 0 } 
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
                addedIngredients: [], // 다음 스텝 시작 시 재료 목록 초기화
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

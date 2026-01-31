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

const INITIAL_WOKS: Wok[] = [
  { burnerNumber: 1, isOn: false, state: 'CLEAN', position: 'AT_BURNER', currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, burnerOnSince: null },
  { burnerNumber: 2, isOn: false, state: 'CLEAN', position: 'AT_BURNER', currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, burnerOnSince: null },
  { burnerNumber: 3, isOn: false, state: 'CLEAN', position: 'AT_BURNER', currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, burnerOnSince: null },
]

const TARGET_MENUS = 50

interface GameStore {
  currentStore: Store | null
  currentUser: User | null
  currentSession: GameSession | null
  level: GameLevel
  kitchenLayout: KitchenLayout | null
  ingredients: IngredientInventory[]
  recipes: Recipe[]
  seasonings: Seasoning[]

  isPlaying: boolean
  elapsedSeconds: number
  completedMenus: number
  targetMenus: number
  woks: Wok[]
  menuQueue: MenuOrder[]
  actionLogs: ActionLog[]
  burnerUsageHistory: BurnerUsageLog[]
  usedMenuNames: Set<string>

  setStore: (store: Store | null) => void
  setUser: (user: User | null) => void
  setCurrentUser: (user: User | null) => void
  setLevel: (level: GameLevel) => void
  loadStoreData: (storeId: string) => Promise<void>
  resetGameState: () => void
  tickTimer: () => void
  addMenuToQueue: (menuName: string) => void
  assignMenuToWok: (menuId: string, burnerNumber: number) => void
  updateWok: (burnerNumber: number, updates: Partial<Wok>) => void
  washWok: (burnerNumber: number) => void
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

  isPlaying: false,
  elapsedSeconds: 0,
  completedMenus: 0,
  targetMenus: TARGET_MENUS,
  woks: [...INITIAL_WOKS],
  menuQueue: [],
  actionLogs: [],
  burnerUsageHistory: [],
  usedMenuNames: new Set(),

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
      isPlaying: false,
      elapsedSeconds: 0,
      completedMenus: 0,
      targetMenus: TARGET_MENUS,
      woks: INITIAL_WOKS.map((w) => ({ ...w })),
      menuQueue: [],
      actionLogs: [],
      burnerUsageHistory: [],
      usedMenuNames: new Set(),
    }),

  tickTimer: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),

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
      // 2. 싱크대 도착 → 씻기 시작
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber
            ? { ...w, position: 'AT_SINK' as const, state: 'WET' as const, currentMenu: null, currentStep: 0, stepStartTime: null }
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

  serve: (burnerNumber) => {
    const { woks, completedMenus, targetMenus, getRecipeByMenuName } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu) return false

    const recipe = getRecipeByMenuName(wok.currentMenu)
    const sortedSteps = recipe?.steps ? [...recipe.steps].sort((a, b) => a.step_number - b.step_number) : []
    if (!recipe || !sortedSteps.length) return false
    const isComplete = wok.currentStep >= sortedSteps.length
    if (!isComplete) return false

    set((s) => ({
      menuQueue: s.menuQueue.map((o) =>
        o.menuName === wok.currentMenu && o.assignedBurner === burnerNumber
          ? { ...o, status: 'COMPLETED' as const, servedAt: new Date() }
          : o
      ),
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? { ...w, state: 'DIRTY' as const, currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null }
          : w
      ),
      completedMenus: s.completedMenus + 1,
    }))
    get().logAction({
      actionType: 'SERVE',
      menuName: wok.currentMenu,
      burnerNumber,
      isCorrect: true,
      message: `${wok.currentMenu} 서빙 완료`,
    })

    // 3초 후 완료된 주문카드 제거
    setTimeout(() => {
      set((s) => ({
        menuQueue: s.menuQueue.filter(
          (o) => !(o.status === 'COMPLETED' && o.menuName === wok.currentMenu && o.assignedBurner === burnerNumber)
        ),
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
    const { woks, getRecipeByMenuName, getCurrentStepIngredients, logAction } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu) return false

    const recipe = getRecipeByMenuName(wok.currentMenu)
    if (!recipe?.steps?.length) return false
    const reqs = getCurrentStepIngredients(wok.currentMenu, wok.currentStep)
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

    if (!isCorrect) return false

    const nextStep = wok.currentStep + 1
    // 재료 투입 시에도 타이머 리셋 (웍에 재료 넣으면 다시 카운트)
    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? { 
              ...w, 
              currentStep: nextStep, 
              stepStartTime: Date.now(),
              burnerOnSince: w.isOn ? Date.now() : w.burnerOnSince, // 불 켜져있으면 타이머 리셋
            }
          : w
      ),
    }))
    return true
  },

  validateAndAdvanceAction: (burnerNumber, actionType) => {
    const { woks, getRecipeByMenuName, logAction } = get()
    const wok = woks.find((w) => w.burnerNumber === burnerNumber)
    if (!wok || !wok.currentMenu) return { ok: false }

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
    })
    
    if (!step || step.step_type !== 'ACTION') {
      logAction({
        actionType,
        menuName: wok.currentMenu,
        burnerNumber,
        isCorrect: false,
        message: `화구${burnerNumber}: 잘못된 액션 (현재 단계: ${step?.step_type ?? '없음'})`,
      })
      return { ok: false }
    }

    const isCorrectAction = step.action_type === actionType
    const limitMs = (step.time_limit_seconds ?? 999) * 1000
    const timingCorrect = !wok.stepStartTime || Date.now() - wok.stepStartTime <= limitMs

    logAction({
      actionType,
      menuName: wok.currentMenu,
      burnerNumber,
      isCorrect: isCorrectAction && timingCorrect,
      timingCorrect,
      message: isCorrectAction && timingCorrect ? `화구${burnerNumber}: ${actionType} 완료` : `화구${burnerNumber}: 액션 오류`,
    })

    if (!isCorrectAction) return { ok: false }
    if (!timingCorrect) {
      const orderId = wok.currentOrderId
      set((s) => ({
        woks: s.woks.map((w) =>
          w.burnerNumber === burnerNumber 
            ? { ...w, state: 'BURNED' as const, currentMenu: null, currentOrderId: null, currentStep: 0, stepStartTime: null, isOn: false, burnerOnSince: null } 
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

    // 액션 성공 시 타이머 리셋 (웍질로 재료 타는 것 방지)
    set((s) => ({
      woks: s.woks.map((w) =>
        w.burnerNumber === burnerNumber
          ? { 
              ...w, 
              currentStep: w.currentStep + 1, 
              stepStartTime: Date.now(),
              burnerOnSince: w.isOn ? Date.now() : w.burnerOnSince, // 불 켜져있으면 타이머 리셋
            }
          : w
      ),
    }))
    return { ok: true }
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

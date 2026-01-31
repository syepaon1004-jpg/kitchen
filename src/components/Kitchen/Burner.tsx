import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { WokState } from '../../types/database.types'

const COOKING_ACTIONS = [
  { type: 'STIR_FRY', label: '볶기', icon: '🍳' },
  { type: 'ADD_WATER', label: '물넣기', icon: '💧' },
  { type: 'ADD_BROTH', label: '육수넣기', icon: '🍲' },
  { type: 'FLIP', label: '뒤집기', icon: '🔄' },
] as const

interface BurnerProps {
  burnerNumber: number
}

const stateColors: Record<WokState, string> = {
  CLEAN: 'bg-gray-700',
  WET: 'bg-[#64B5F6]',
  DIRTY: 'bg-[#8D6E63]',
  BURNED: 'bg-black',
  OVERHEATING: 'bg-orange-600',
}

// 재료 없을 때 (빈 웍)
const EMPTY_OVERHEAT_TIME_MS = 13000 // 13초부터 과열 경고
const EMPTY_BURN_TIME_MS = 15000 // 15초에 타버림

// 재료 있을 때 (조리 중)
const COOKING_OVERHEAT_TIME_MS = 28000 // 28초부터 과열 경고
const COOKING_BURN_TIME_MS = 30000 // 30초에 타버림

const OVERHEAT_COOLDOWN_MS = 10000 // OVERHEATING 상태에서 10초 후 CLEAN

export default function Burner({ burnerNumber }: BurnerProps) {
  const { woks, toggleBurner, serve, validateAndAdvanceAction, updateWok, washWok } = useGameStore()
  const wok = woks.find((w) => w.burnerNumber === burnerNumber)
  if (!wok) return null

  const handleAction = (actionType: string) => {
    const result = validateAndAdvanceAction(burnerNumber, actionType)
    if (result.burned) {
      // 타버림 처리는 validateAndAdvanceAction에서 함
    }
  }

  // OVERHEATING → CLEAN 자동 전환 (불 끄면)
  useEffect(() => {
    if (wok.state !== 'OVERHEATING' || wok.isOn) return
    
    const timer = setTimeout(() => {
      const currentWok = useGameStore.getState().woks.find((w) => w.burnerNumber === burnerNumber)
      if (currentWok?.state === 'OVERHEATING' && !currentWok.isOn) {
        console.log(`화구${burnerNumber}: 과열 해소, CLEAN 상태로 복귀`)
        updateWok(burnerNumber, { state: 'CLEAN' })
      }
    }, OVERHEAT_COOLDOWN_MS)

    return () => clearTimeout(timer)
  }, [wok.state, wok.isOn, burnerNumber, updateWok])

  // 불을 너무 오래 켜두면 과열 → 타버림
  useEffect(() => {
    if (!wok.isOn || !wok.burnerOnSince) return

    const elapsed = Date.now() - wok.burnerOnSince
    
    // WET 상태에서는 타이머 제외 (WokDryingManager가 CLEAN으로 전환)
    if (wok.state === 'WET') return

    // CLEAN 상태에서만 과열/타버림 체크
    if (wok.state === 'CLEAN' || wok.state === 'OVERHEATING') {
      // 재료가 들어갔는지 판단 (currentMenu 있고 step > 0이면 재료 투입됨)
      const hasIngredients = wok.currentMenu && wok.currentStep > 0
      const overheatTime = hasIngredients ? COOKING_OVERHEAT_TIME_MS : EMPTY_OVERHEAT_TIME_MS
      const burnTime = hasIngredients ? COOKING_BURN_TIME_MS : EMPTY_BURN_TIME_MS

      const overheatRemaining = overheatTime - elapsed
      const burnRemaining = burnTime - elapsed

      let overheatTimer: ReturnType<typeof setTimeout> | null = null
      let burnTimer: ReturnType<typeof setTimeout> | null = null

      if (overheatRemaining > 0) {
        overheatTimer = setTimeout(() => {
          const currentWok = useGameStore.getState().woks.find((w) => w.burnerNumber === burnerNumber)
          if (!currentWok?.isOn || currentWok.state === 'BURNED') return
          console.warn(`화구${burnerNumber}: ⚠️ 과열 중! 2초 후 타버립니다!`)
          updateWok(burnerNumber, { state: 'OVERHEATING' })
        }, overheatRemaining)
      } else if (wok.state === 'CLEAN') {
        // 이미 58초 지남 → 즉시 OVERHEATING
        updateWok(burnerNumber, { state: 'OVERHEATING' })
      }

      if (burnRemaining > 0) {
        burnTimer = setTimeout(() => {
          const state = useGameStore.getState()
          const currentWok = state.woks.find((w) => w.burnerNumber === burnerNumber)
          if (!currentWok?.isOn) return
          console.warn(`화구${burnerNumber}: 🔥 타버림!`)
          
          const orderId = currentWok.currentOrderId
          
          // 웍 초기화
          updateWok(burnerNumber, { 
            state: 'BURNED', 
            isOn: false, 
            burnerOnSince: null,
            currentMenu: null,
            currentOrderId: null,
            currentStep: 0,
            stepStartTime: null,
          })
          
          // 해당 주문을 WAITING으로 재배정 가능하게
          if (orderId) {
            useGameStore.setState((s) => ({
              menuQueue: s.menuQueue.map((o) =>
                o.id === orderId
                  ? { ...o, status: 'WAITING' as const, assignedBurner: null }
                  : o
              ),
            }))
          }
        }, burnRemaining)
      } else {
        // 이미 타버림 시간 지남 → 즉시 처리
        const orderId = wok.currentOrderId
        updateWok(burnerNumber, { 
          state: 'BURNED', 
          isOn: false, 
          burnerOnSince: null,
          currentMenu: null,
          currentOrderId: null,
          currentStep: 0,
          stepStartTime: null,
        })
        if (orderId) {
          useGameStore.setState((s) => ({
            menuQueue: s.menuQueue.map((o) =>
              o.id === orderId
                ? { ...o, status: 'WAITING' as const, assignedBurner: null }
                : o
            ),
          }))
        }
      }

      return () => {
        if (overheatTimer) clearTimeout(overheatTimer)
        if (burnTimer) clearTimeout(burnTimer)
      }
    }
  }, [wok.isOn, wok.burnerOnSince, wok.state, burnerNumber, updateWok])

  // 웍 위치에 따른 애니메이션
  const wokAnimation = {
    AT_BURNER: { x: 0, y: 0 },
    MOVING_TO_SINK: { x: -300, y: -50 },
    AT_SINK: { x: -300, y: -50 },
    MOVING_TO_BURNER: { x: 0, y: 0 },
  }

  return (
    <div className="flex flex-col items-center gap-2 relative pt-20">
      {/* 웍 (애니메이션) - 크게, 상태별 색상 */}
      <motion.div
        animate={wokAnimation[wok.position]}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className="absolute top-0 z-10 flex flex-col items-center"
      >
        <div className={`w-[150px] h-[150px] rounded-full border-4 flex items-center justify-center shadow-lg transition ${
          wok.state === 'BURNED' 
            ? 'border-red-700 bg-black animate-pulse shadow-[0_0_40px_rgba(0,0,0,0.9)]'
            : wok.state === 'OVERHEATING'
              ? 'border-orange-500 bg-orange-600 animate-pulse shadow-[0_0_30px_rgba(234,88,12,0.8)]'
              : `border-[#424242] ${stateColors[wok.state]}`
        }`}>
          {wok.currentMenu && (
            <span className="text-white text-xs font-bold text-center px-2 drop-shadow">
              {wok.currentMenu}
            </span>
          )}
          {wok.state === 'BURNED' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl">💀</span>
            </div>
          )}
        </div>
        <div className={`text-xs mt-1 font-bold ${
          wok.state === 'BURNED' ? 'text-red-600 animate-bounce' : 
          wok.state === 'OVERHEATING' ? 'text-orange-600 animate-pulse' : 
          'text-[#757575]'
        }`}>
          {wok.state === 'WET' ? '💧 젖음' : 
           wok.state === 'DIRTY' ? '🟤 더러움' : 
           wok.state === 'BURNED' ? '💀 타버림!' : 
           wok.state === 'OVERHEATING' ? '⚠️ 과열!' :
           '✨ 깨끗'}
        </div>
      </motion.div>

      {/* 화구 - 작게, 불만 표시 */}
      <div
        className={`w-[100px] h-[100px] rounded-full border-4 border-[#424242] flex items-center justify-center transition shadow-lg ${
          wok.isOn ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.8)]' : 'bg-gray-800'
        }`}
      >
        {wok.isOn && (
          <span className="text-yellow-300 text-2xl">🔥</span>
        )}
      </div>
      <span className="text-sm text-[#333] font-semibold">화구{burnerNumber}</span>

      {/* 상태별 안내 및 액션 */}
      {wok.state === 'DIRTY' || wok.state === 'BURNED' ? (
        <div className="text-center">
          <p className="text-xs text-red-600 font-bold mb-2">
            {wok.state === 'BURNED' ? '🔥 타버림!' : '🟤 더러움'}
          </p>
          <button
            type="button"
            onClick={() => washWok(burnerNumber)}
            disabled={wok.isOn}
            className={`px-3 py-1.5 rounded-lg text-white text-xs font-medium ${
              wok.isOn 
                ? 'bg-gray-400 cursor-not-allowed' 
                : wok.state === 'BURNED'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {wok.isOn ? '⚠️ 불을 먼저 끄세요' : '🚰 웍 씻기'}
          </button>
        </div>
      ) : wok.state === 'WET' ? (
        <button
          type="button"
          onClick={() => toggleBurner(burnerNumber)}
          className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
        >
          🔥 불 켜서 말리기
        </button>
      ) : (
        <>
          {/* 일반 불 켜기/끄기 버튼 */}
          <button
            type="button"
            onClick={() => toggleBurner(burnerNumber)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              wok.isOn 
                ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {wok.isOn ? '🔥 불 끄기' : '🔥 불 켜기'}
          </button>
          
          {wok.currentMenu && (
        <div className="flex flex-wrap gap-1 justify-center">
          {COOKING_ACTIONS.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => handleAction(a.type)}
              className="p-1.5 rounded bg-white border border-[#E0E0E0] hover:bg-primary/20 text-sm"
              title={a.label}
            >
              {a.icon}
            </button>
          ))}
          <button
            type="button"
            onClick={() => serve(burnerNumber)}
            className="p-1.5 rounded bg-green-100 border border-green-300 text-sm font-medium"
          >
            서빙
          </button>
        </div>
          )}
        </>
      )}
    </div>
  )
}

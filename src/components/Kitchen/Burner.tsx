import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { WokState } from '../../types/database.types'
import { WOK_TEMP } from '../../types/database.types'
import { useSound } from '../../hooks/useSound'

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

export default function Burner({ burnerNumber }: BurnerProps) {
  const { woks, toggleBurner, serve, validateAndAdvanceAction, washWok, emptyWok, startStirFry, stopStirFry, setHeatLevel } = useGameStore()
  const wok = woks.find((w) => w.burnerNumber === burnerNumber)
  const [showRadialMenu, setShowRadialMenu] = useState(false)
  const [wokPosition, setWokPosition] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wokElementRef = useRef<HTMLDivElement>(null)
  const { playSound } = useSound()

  // 레이디얼 메뉴가 열릴 때 위치 업데이트
  useEffect(() => {
    if (showRadialMenu) {
      // 즉시 위치 계산
      if (wokElementRef.current) {
        const rect = wokElementRef.current.getBoundingClientRect()
        const pos = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
        setWokPosition(pos)
        console.log('📍 레이디얼 메뉴 열림, 웍 위치:', pos)
      }
    }
  }, [showRadialMenu])


  // ESC 키로 메뉴 닫기
  useEffect(() => {
    if (!showRadialMenu) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('⌨️ ESC 키 - 메뉴 닫기')
        setShowRadialMenu(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showRadialMenu])

  // Early return은 모든 훅 선언 후에!
  if (!wok) return null

  const handleAction = (actionType: string) => {
    console.log('🔥 handleAction 호출됨:', actionType, 'burnerNumber:', burnerNumber)

    // 볶기 액션인 경우 온도 체크
    if (actionType === 'STIR_FRY') {
      playSound('stir')
      const success = startStirFry(burnerNumber)
      if (!success) {
        playSound('error')
        alert(`웍 온도가 너무 낮습니다! (현재: ${Math.round(wok.temperature)}°C, 필요: ${WOK_TEMP.MIN_STIR_FRY}°C 이상)`)
        setShowRadialMenu(false)
        return
      }

      // 볶기 액션 검증
      const result = validateAndAdvanceAction(burnerNumber, actionType)
      console.log('🍳 볶기 액션 결과:', result, 'currentStep:', wok.currentStep)

      // 볶기 애니메이션 1초 후 종료
      setTimeout(() => {
        stopStirFry(burnerNumber)
      }, 1000)

      // 레시피 완료 체크 (v3: recipe_bundles에서 스텝 추출)
      const { getRecipeByMenuName, getRecipeSteps } = useGameStore.getState()
      const recipe = getRecipeByMenuName(wok.currentMenu!)
      const sortedSteps = getRecipeSteps(recipe, wok.currentBundleId)
      const isComplete = wok.currentStep + 1 >= sortedSteps.length

      if (result.burned) {
        playSound('error')
      } else if (result.ok && isComplete) {
        playSound('complete')
      } else if (result.ok) {
        playSound('success')
      }
    } else {
      // 다른 액션들 효과음
      if (actionType === 'ADD_WATER') {
        playSound('add')
      } else if (actionType === 'FLIP') {
        playSound('stir')
      }

      const result = validateAndAdvanceAction(burnerNumber, actionType)
      console.log('💧 액션 결과:', actionType, result, 'currentStep:', wok.currentStep)

      // 레시피 완료 체크 (v3: recipe_bundles에서 스텝 추출)
      const { getRecipeByMenuName: getRecipe, getRecipeSteps: getSteps } = useGameStore.getState()
      const recipe = getRecipe(wok.currentMenu!)
      const sortedSteps2 = getSteps(recipe, wok.currentBundleId)
      const isComplete = wok.currentStep + 1 >= sortedSteps2.length

      if (result.burned) {
        playSound('error')
      } else if (result.ok && isComplete) {
        playSound('complete')
      } else if (result.ok) {
        playSound('success')
      }
    }

    // 액션 후 레이디얼 메뉴 닫기
    setShowRadialMenu(false)

    // 액션 후 메뉴 자동 닫기
    setShowRadialMenu(false)
  }

  // 웍 위치에 따른 애니메이션
  const wokAnimation = {
    AT_BURNER: { x: 0, y: 0 },
    MOVING_TO_SINK: { x: -300, y: -50 },
    AT_SINK: { x: -300, y: -50 },
    MOVING_TO_BURNER: { x: 0, y: 0 },
  }

  return (
    <>
      <div ref={containerRef} className="flex flex-col items-center gap-2 relative pt-3 pb-0 lg:pb-2 min-h-[240px] lg:min-h-[320px]">
      {/* 온도 게이지 (컴팩트) */}
      <div className="w-full max-w-[160px]">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm lg:text-[10px] font-bold text-gray-700">
            {wok.hasWater ? '💧' : '🌡️'}
          </span>
          <span className={`text-sm lg:text-xs font-bold px-2 lg:px-1.5 py-1 lg:py-0.5 rounded ${
            wok.hasWater ? (
              wok.waterTemperature >= WOK_TEMP.WATER_BOIL ? 'bg-blue-500 text-white' :
              'bg-blue-200 text-gray-700'
            ) : (
              wok.temperature >= WOK_TEMP.BURNED ? 'bg-red-600 text-white' :
              wok.temperature >= WOK_TEMP.OVERHEATING ? 'bg-orange-500 text-white' :
              wok.temperature >= WOK_TEMP.SMOKING_POINT ? 'bg-orange-400 text-white' :
              wok.temperature >= WOK_TEMP.MIN_STIR_FRY ? 'bg-yellow-400 text-gray-800' :
              'bg-gray-300 text-gray-600'
            )
          }`}>
            {wok.hasWater ? Math.round(wok.waterTemperature) : Math.round(wok.temperature)}°C
          </span>
        </div>
        
        {/* 온도 바 (간소화) */}
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
          {wok.hasWater ? (
            <div 
              className="absolute inset-y-0 left-0 transition-all duration-300 bg-gradient-to-r from-blue-300 to-blue-500"
              style={{ width: `${Math.min((wok.waterTemperature / WOK_TEMP.WATER_BOIL) * 100, 100)}%` }}
            />
          ) : (
            <div 
              className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                wok.temperature >= WOK_TEMP.BURNED ? 'bg-gradient-to-r from-red-600 to-red-800' :
                wok.temperature >= WOK_TEMP.OVERHEATING ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                wok.temperature >= WOK_TEMP.SMOKING_POINT ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                wok.temperature >= WOK_TEMP.MIN_STIR_FRY ? 'bg-gradient-to-r from-green-400 to-yellow-400' :
                'bg-gradient-to-r from-blue-300 to-blue-400'
              }`}
              style={{ width: `${Math.min((wok.temperature / WOK_TEMP.MAX_SAFE) * 100, 100)}%` }}
            />
          )}
        </div>
      </div>

      {/* 웍과 화구 영역 (클릭 가능) */}
      <div className={`relative w-full flex flex-col items-center ${showRadialMenu ? 'z-[102]' : 'z-10'}`} style={{ height: '180px' }}>
        {/* 웍 (클릭하면 radial menu) */}
        <motion.div
          animate={wokAnimation[wok.position]}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="absolute top-0 z-10 flex flex-col items-center cursor-pointer"
          onClick={(e) => {
            console.log('🍳 웍 클릭됨!', {
              currentMenu: wok.currentMenu,
              state: wok.state,
              windowWidth: window.innerWidth,
              showRadialMenu
            })
            // CLEAN, WET, OVERHEATING 상태에서 메뉴가 있으면 클릭 가능
            const clickableStates: WokState[] = ['CLEAN', 'WET', 'OVERHEATING']
            if (wok.currentMenu && clickableStates.includes(wok.state)) {
              e.stopPropagation()
              setShowRadialMenu(!showRadialMenu)
              console.log('✅ 레이디얼 메뉴 토글:', !showRadialMenu)
            }
          }}
        >
        <div
          ref={wokElementRef}
          className={`w-[130px] h-[130px] rounded-full border-4 flex items-center justify-center shadow-xl transition relative ${
          showRadialMenu ? 'ring-4 ring-blue-400 ring-opacity-50' : ''
        } ${
          wok.state === 'BURNED'
            ? 'border-red-900 bg-gradient-to-br from-black via-gray-900 to-black animate-pulse shadow-[0_0_40px_rgba(0,0,0,0.9)]'
            : wok.state === 'OVERHEATING'
              ? 'border-orange-600 bg-gradient-to-br from-orange-400 via-red-500 to-orange-600 animate-pulse shadow-[0_0_30px_rgba(234,88,12,0.8)]'
              : wok.hasWater
                ? 'border-gray-400 bg-gradient-to-br from-blue-300 via-blue-200 to-blue-100'
                : `border-gray-400 ${stateColors[wok.state]}`
        }`}
        style={
          wok.state !== 'BURNED' && wok.state !== 'OVERHEATING' && !wok.hasWater ? {
            backgroundImage: `
              radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 60%),
              radial-gradient(circle at center, rgba(0,0,0,0.2) 0%, transparent 70%)
            `,
            boxShadow: 'inset 0 -10px 20px rgba(0,0,0,0.3), inset 0 5px 15px rgba(255,255,255,0.3), 0 10px 30px rgba(0,0,0,0.2)'
          } : wok.hasWater ? {
            boxShadow: 'inset 0 -5px 15px rgba(59,130,246,0.4), inset 0 5px 10px rgba(255,255,255,0.5), 0 5px 20px rgba(59,130,246,0.3)'
          } : {}
        }
        >
          {/* 물이 있을 때 표시 */}
          {wok.hasWater && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl lg:text-3xl">💧</div>
                <div className="text-sm lg:text-[10px] font-bold text-blue-700 mt-1">
                  {Math.round(wok.waterTemperature)}°C
                </div>
              </div>
            </div>
          )}
          
          {/* 물이 끓을 때 애니메이션 (간소화) */}
          <AnimatePresence>
            {wok.isBoiling && (
              <>
                {[0, 0.3, 0.6].map((delay, i) => (
                  <motion.div
                    key={`bubble-${i}-${burnerNumber}`}
                    initial={{ scale: 0, y: 0, opacity: 0 }}
                    animate={{ 
                      scale: [0, 1, 0],
                      y: [0, -40],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, delay }}
                    className="absolute text-2xl"
                    style={{ left: `${30 + i * 20}%`, top: '50%' }}
                  >
                    💦
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>
          
          {/* 볶기 중일 때 불 효과 (간소화) */}
          <AnimatePresence mode="wait">
            {wok.isStirFrying && wok.temperature >= WOK_TEMP.MIN_STIR_FRY && !wok.hasWater && (
              <motion.div
                key={`fire-${burnerNumber}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: [1, 1.3, 1.1],
                  opacity: [0.8, 1, 0.8],
                  rotate: [0, 5, -5, 0],
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl z-20"
                style={{ filter: 'drop-shadow(0 0 15px rgba(255,100,0,0.8))' }}
              >
                🔥
              </motion.div>
            )}
          </AnimatePresence>

          {wok.currentMenu && !wok.hasWater && (
            <span
              className="text-white text-sm lg:text-[10px] font-bold text-center px-2 drop-shadow-lg z-10 cursor-pointer"
              onClick={(e) => {
                // CLEAN, WET, OVERHEATING 상태에서 메뉴가 있으면 클릭 가능
                const clickableStates: WokState[] = ['CLEAN', 'WET', 'OVERHEATING']
                if (wok.currentMenu && clickableStates.includes(wok.state)) {
                  // 데스크톱에서만 radial menu 표시 + 이벤트 전파 중단
                  if (window.innerWidth >= 1024) {
                    e.stopPropagation()
                    setShowRadialMenu(!showRadialMenu)
                  }
                  // 모바일에서는 이벤트가 부모로 전파되어 하단바 표시됨
                }
              }}
            >
              {wok.currentMenu}
            </span>
          )}
          {wok.state === 'BURNED' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl filter drop-shadow-2xl">💀</span>
            </div>
          )}
          
          {/* 스모킹 포인트 효과 (간소화) */}
          <AnimatePresence mode="wait">
            {wok.temperature >= WOK_TEMP.SMOKING_POINT && 
             wok.temperature < WOK_TEMP.BURNED &&
             wok.state !== 'BURNED' && 
             wok.state !== 'OVERHEATING' &&
             !wok.isStirFrying && 
             !wok.hasWater && (
              <motion.div
                key={`smoke-${burnerNumber}-${wok.temperature >= WOK_TEMP.SMOKING_POINT}`}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: [0.3, 0.7, 0.3], y: [-5, -25] }}
                exit={{ opacity: 0, y: -30, transition: { duration: 0.3 } }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity
                }}
                className="absolute -top-8 text-3xl z-5"
              >
                💨
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>
        <div className={`text-sm lg:text-[10px] mt-1 font-bold px-2 lg:px-1.5 py-1 lg:py-0.5 rounded ${
          wok.state === 'BURNED' ? 'text-white bg-red-600/90' : 
          wok.state === 'OVERHEATING' ? 'text-white bg-orange-500/90' : 
          'text-gray-700 bg-gray-200/80'
        }`}>
          {wok.state === 'WET' ? '💧' : 
           wok.state === 'DIRTY' ? '🟤' : 
           wok.state === 'BURNED' ? '💀' : 
           wok.state === 'OVERHEATING' ? '⚠️' :
           '✨'}
        </div>
      </motion.div>

      {/* Radial Menu는 Portal로 body에 렌더링 */}

      {/* 화구 (간소화) */}
      <div
        className={`w-[85px] h-[85px] rounded-full border-4 border-gray-400 flex items-center justify-center transition shadow-xl relative cursor-pointer ${
          wok.isOn ? 'bg-gradient-radial from-red-400 via-orange-500 to-red-600' : 'bg-gradient-to-br from-gray-300 via-gray-200 to-gray-300'
        }`}
        style={wok.isOn ? {
          backgroundImage: `radial-gradient(circle at center, rgba(255,200,0,0.8) 0%, rgba(255,100,0,0.6) 30%, rgba(255,0,0,0.4) 60%, transparent 100%)`,
          boxShadow: '0 0 30px rgba(255,100,0,0.5), inset 0 0 15px rgba(0,0,0,0.3)'
        } : {
          backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(200,200,200,0.5) 50%, rgba(255,255,255,0.8) 100%)',
          boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.15), 0 3px 6px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => {
          // CLEAN, WET, OVERHEATING 상태에서 메뉴가 있으면 클릭 가능
          const clickableStates: WokState[] = ['CLEAN', 'WET', 'OVERHEATING']
          if (wok.currentMenu && clickableStates.includes(wok.state)) {
            // 데스크톱에서만 radial menu 표시 + 이벤트 전파 중단
            if (window.innerWidth >= 1024) {
              e.stopPropagation()
              setShowRadialMenu(!showRadialMenu)
            }
            // 모바일에서는 이벤트가 부모로 전파되어 하단바 표시됨
          }
        }}
      >
        {wok.isOn && (
          <span className="text-yellow-300 text-2xl animate-pulse filter drop-shadow-[0_0_10px_rgba(255,200,0,0.8)] z-10">
            🔥
          </span>
        )}
      </div>
      <span className="text-sm lg:text-[10px] text-gray-700 font-bold px-2 py-1 lg:py-0.5 bg-gray-200/80 rounded-full border border-gray-300">
        화구{burnerNumber}
      </span>
      </div>

      {/* 컨트롤 버튼 영역 - 최소화 */}
      <div className="w-full flex flex-col items-center gap-1.5" style={{ minHeight: '80px' }}>
      {wok.state === 'DIRTY' || wok.state === 'BURNED' ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              if (!wok.isOn) {
                playSound('wash')
              }
              washWok(burnerNumber)
            }}
            disabled={wok.isOn}
            className={`px-3 py-1.5 rounded-lg text-white text-sm lg:text-xs font-bold shadow-md transition-all ${
              wok.isOn
                ? 'bg-gray-400 cursor-not-allowed opacity-50'
                : wok.state === 'BURNED'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700'
            }`}
          >
            {wok.isOn ? '⚠️ 불 끄기' : '🚰 웍 씻기'}
          </button>
        </div>
      ) : wok.state === 'WET' ? (
        <button
          type="button"
          onClick={() => {
            playSound(wok.isOn ? 'fire_off' : 'fire_on')
            toggleBurner(burnerNumber)
          }}
          className={`px-3 py-1.5 rounded-lg text-white text-sm lg:text-xs font-bold shadow-md transition-all ${
            wok.isOn
              ? 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 animate-pulse'
              : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'
          }`}
        >
          {wok.isOn ? '🔥 말리는 중...' : '🔥 말리기'}
        </button>
      ) : (
        <>
          {/* 불 켜기/끄기 */}
          <button
            type="button"
            onClick={() => {
              playSound(wok.isOn ? 'fire_off' : 'fire_on')
              toggleBurner(burnerNumber)
            }}
            className={`px-4 py-1.5 rounded-lg text-sm lg:text-xs font-bold shadow-md transition-all ${
              wok.isOn
                ? 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
                : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
            }`}
          >
            {wok.isOn ? '🔥 불 끄기' : '🔥 불 켜기'}
          </button>
          
          {wok.currentMenu && (
            <div className="flex flex-col gap-1 items-center">
              {/* 진행 상황 (간소화) - bundleId 필터링 적용 */}
              <div className="text-sm lg:text-[9px] text-gray-700 font-bold px-2 py-1 lg:py-0.5 bg-white/80 rounded border border-gray-300">
                {(() => {
                  const recipe = useGameStore.getState().getRecipeByMenuName(wok.currentMenu)
                  // v3: recipe_bundles에서 스텝 추출
                  const sortedSteps = useGameStore.getState().getRecipeSteps(recipe, wok.currentBundleId)
                  const isComplete = wok.currentStep >= sortedSteps.length
                  return isComplete ? '✅ 완료' : `${wok.currentStep + 1}/${sortedSteps.length}`
                })()}
              </div>

              {/* 서빙 & 비우기 버튼 */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`${wok.currentMenu}을(를) 버리시겠습니까?`)) {
                      playSound('remove')
                      emptyWok(burnerNumber)
                    }
                  }}
                  className="px-2 py-1 rounded border border-red-300 bg-red-50 text-base shadow-sm transition-all hover:bg-red-100"
                  title="웍 비우기"
                >
                  🗑️
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const { getRecipeByMenuName, getRecipeSteps } = useGameStore.getState()
                    const recipe = getRecipeByMenuName(wok.currentMenu!)
                    const sortedSteps = getRecipeSteps(recipe, wok.currentBundleId)
                    const isComplete = wok.currentStep >= sortedSteps.length
                    if (isComplete) {
                      playSound('serve')
                    }
                    serve(burnerNumber)
                  }}
                  className={`px-2 py-1 rounded text-sm lg:text-xs font-bold transition-all shadow-sm ${
                    (() => {
                      const { getRecipeByMenuName, getRecipeSteps } = useGameStore.getState()
                      const recipe = getRecipeByMenuName(wok.currentMenu!)
                      const sortedSteps = getRecipeSteps(recipe, wok.currentBundleId)
                      const isComplete = wok.currentStep >= sortedSteps.length
                      return isComplete
                        ? 'bg-gradient-to-r from-green-400 to-emerald-500 border border-green-500 text-white hover:from-green-500 hover:to-emerald-600'
                        : 'bg-gray-300 border border-gray-400 text-gray-500 opacity-50 cursor-not-allowed'
                    })()
                  }`}
                >
                  🍽️ 서빙
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>

    {/* Radial Menu - Portal로 document.body에 직접 렌더링 (transform 컨테이너 탈출) */}
    {showRadialMenu && wok.currentMenu && createPortal(
      <div id="radial-menu-portal">
        {/* 배경 오버레이 */}
        <div
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: 9998 }}
          onClick={() => {
            console.log('🔲 오버레이 클릭!')
            setShowRadialMenu(false)
          }}
        />

        {/* 버튼 컨테이너 */}
        <div
          className="fixed"
          style={{
            zIndex: 9999,
            left: wokPosition?.x ?? window.innerWidth / 2,
            top: wokPosition?.y ?? window.innerHeight / 2,
            transform: 'translate(-50%, -50%)',
            width: '250px',
            height: '250px',
            pointerEvents: 'none',
          }}
        >
          {/* 북쪽 (상단): 볶기 */}
          <div
            onClick={() => {
              console.log('🍳 볶기 버튼 클릭!')
              handleAction('STIR_FRY')
            }}
            className={`absolute w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 ${
              wok.temperature < WOK_TEMP.MIN_STIR_FRY
                ? 'bg-gray-300 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-br from-orange-400 to-red-500'
            }`}
            style={{ left: '97px', top: '25px', pointerEvents: 'auto' }}
          >
            🍳
          </div>

          {/* 서쪽 (좌측): 물넣기 */}
          <div
            onClick={() => {
              console.log('💧 물넣기 버튼 클릭!')
              handleAction('ADD_WATER')
            }}
            className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 shadow-2xl flex items-center justify-center text-2xl cursor-pointer select-none transition-transform hover:scale-110 active:scale-95"
            style={{ left: '25px', top: '97px', pointerEvents: 'auto' }}
          >
            💧
          </div>

          {/* 동쪽 (우측): 뒤집기 */}
          <div
            onClick={() => {
              console.log('🔄 뒤집기 버튼 클릭!')
              handleAction('FLIP')
            }}
            className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-2xl flex items-center justify-center text-2xl cursor-pointer select-none transition-transform hover:scale-110 active:scale-95"
            style={{ left: '169px', top: '97px', pointerEvents: 'auto' }}
          >
            🔄
          </div>

          {/* 북동쪽 (우상단): 쓰레기통 (버리기) */}
          <div
            onClick={() => {
              console.log('🗑️ 버리기 버튼 클릭!')
              if (confirm(`${wok.currentMenu}을(를) 버리시겠습니까?`)) {
                playSound('remove')
                emptyWok(burnerNumber)
                setShowRadialMenu(false)
              }
            }}
            className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-2xl flex items-center justify-center text-2xl cursor-pointer select-none transition-transform hover:scale-110 active:scale-95"
            style={{ left: '175px', top: '45px', pointerEvents: 'auto' }}
          >
            🗑️
          </div>

          {/* 남쪽 (하단): 불 세기 */}
          {wok.isOn && (
            <div
              className="absolute flex gap-2"
              style={{ left: '73px', top: '175px' }}
            >
              <div
                onClick={() => {
                  console.log('🔥 약불 클릭!')
                  setHeatLevel(burnerNumber, 1)
                  setShowRadialMenu(false)
                }}
                className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-sm font-bold cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 ${
                  wok.heatLevel === 1
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-2 ring-yellow-300'
                    : 'bg-white text-gray-600'
                }`}
                style={{ pointerEvents: 'auto' }}
              >
                약
              </div>
              <div
                onClick={() => {
                  console.log('🔥 중불 클릭!')
                  setHeatLevel(burnerNumber, 2)
                  setShowRadialMenu(false)
                }}
                className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-sm font-bold cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 ${
                  wok.heatLevel === 2
                    ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white ring-2 ring-orange-300'
                    : 'bg-white text-gray-600'
                }`}
                style={{ pointerEvents: 'auto' }}
              >
                중
              </div>
              <div
                onClick={() => {
                  console.log('🔥 강불 클릭!')
                  setHeatLevel(burnerNumber, 3)
                  setShowRadialMenu(false)
                }}
                className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-sm font-bold cursor-pointer select-none transition-transform hover:scale-110 active:scale-95 ${
                  wok.heatLevel === 3
                    ? 'bg-gradient-to-br from-red-500 to-red-700 text-white ring-2 ring-red-300'
                    : 'bg-white text-gray-600'
                }`}
                style={{ pointerEvents: 'auto' }}
              >
                강
              </div>
            </div>
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

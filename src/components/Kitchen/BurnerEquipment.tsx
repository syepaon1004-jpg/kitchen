import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { WokState } from '../../types/database.types'
import { WOK_TEMP } from '../../types/database.types'
import { useSound } from '../../hooks/useSound'
import type { EquipmentComponentProps } from './PlaceholderEquipment'
import PlateSelectPopup from './PlateSelectPopup'

const stateColors: Record<WokState, string> = {
  CLEAN: 'bg-gray-700',
  WET: 'bg-[#64B5F6]',
  DIRTY: 'bg-[#8D6E63]',
  BURNED: 'bg-black',
  OVERHEATING: 'bg-orange-600',
}

/**
 * BurnerEquipment - CSS Grid 기반 버너 컴포넌트
 * equipmentKey로 wok을 찾아 렌더링
 * 기존 Burner.tsx의 기능을 equipmentKey 기반으로 재설계
 */
export default function BurnerEquipment({
  equipmentKey,
  displayName,
  gridW,
  gridH,
}: EquipmentComponentProps) {
  const { woks, toggleBurner, serve: _serve, validateAndAdvanceAction, washWok, emptyWok, startStirFry, stopStirFry, setHeatLevel } = useGameStore()

  // equipmentKey로 해당 웍을 찾음
  const wok = woks.find((w) => w.equipmentKey === equipmentKey)

  const [showRadialMenu, setShowRadialMenu] = useState(false)
  const [plateSelectInstanceId, setPlateSelectInstanceId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { playSound } = useSound()
  const [sinkOffset, setSinkOffset] = useState({ x: -300, y: -50 })

  // 웍이 없으면 렌더링하지 않음
  if (!wok) {
    return (
      <div className="w-full h-full bg-gray-600 rounded-lg flex items-center justify-center">
        <span className="text-gray-400 text-xs">웍 없음</span>
      </div>
    )
  }

  // 호환성을 위해 burnerNumber 사용 (gameStore 호출 시)
  const burnerNumber = wok.burnerNumber

  // ESC 키로 메뉴 닫기 (외부 클릭은 오버레이 onClick에서 처리)
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

  const handleAction = (actionType: string) => {
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

    // 액션 후 메뉴 자동 닫기
    setShowRadialMenu(false)
  }

  // 싱크대 위치 기반 동적 오프셋 계산
  useEffect(() => {
    const computeOffset = () => {
      const sinkEl = document.querySelector('[data-kitchen-sink]') as HTMLElement | null
      const wokEl = wokRef.current
      if (!sinkEl || !wokEl) return
      const sinkRect = sinkEl.getBoundingClientRect()
      const wokRect = wokEl.getBoundingClientRect()
      setSinkOffset({
        x: sinkRect.left + sinkRect.width / 2 - (wokRect.left + wokRect.width / 2),
        y: sinkRect.top + sinkRect.height / 2 - (wokRect.top + wokRect.height / 2),
      })
    }
    const timer = setTimeout(computeOffset, 300)
    window.addEventListener('resize', computeOffset)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', computeOffset)
    }
  }, [])

  // 웍 위치에 따른 애니메이션 (싱크대 위치 동적 계산)
  const wokAnimation = {
    AT_BURNER: { x: 0, y: 0 },
    MOVING_TO_SINK: sinkOffset,
    AT_SINK: sinkOffset,
    MOVING_TO_BURNER: { x: 0, y: 0 },
  }

  // 그리드 크기에 따른 동적 스타일 - 셀 기반 반응형
  const isCompact = gridW === 1 || gridH === 1

  // 웍 중심 좌표 계산 (래디얼 메뉴 위치용)
  const [wokCenter, setWokCenter] = useState<{ x: number; y: number } | null>(null)
  const wokRef = useRef<HTMLDivElement>(null)

  // 웍 위치 업데이트
  useEffect(() => {
    if (showRadialMenu && wokRef.current) {
      const rect = wokRef.current.getBoundingClientRect()
      setWokCenter({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    }
  }, [showRadialMenu])

  // 래디얼 메뉴 반경 (뷰포트 크기에 따라 조정) - 더 넓게 배치
  const radialRadius = typeof window !== 'undefined' && window.innerWidth < 1024 ? 70 : 85

  return (
    <>
      {/* Radial Menu - Portal로 body에 렌더링 (오버레이와 버튼 분리) */}
      {showRadialMenu && wokCenter && createPortal(
        <>
          {/* 배경 오버레이 - 별도 div */}
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 9998 }}
            onClick={() => {
              console.log('🔲 오버레이 클릭!')
              setShowRadialMenu(false)
            }}
          />

          {/* 래디얼 메뉴 버튼들 - 웍 중심 기준 배치 (오버레이와 분리) */}
          {wok.currentMenu && (
            <>
              {/* 데스크톱용 래디얼 메뉴 */}
              <div className="hidden lg:block" style={{ zIndex: 9999 }}>
                {/* 북쪽 (상단): 볶기 */}
                <button
                  type="button"
                  onClick={() => {
                    console.log('🍳 볶기 버튼 클릭!')
                    handleAction('STIR_FRY')
                  }}
                  disabled={wok.temperature < WOK_TEMP.MIN_STIR_FRY}
                  className={`fixed w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-2xl cursor-pointer transition-transform hover:scale-110 active:scale-95 ${
                    wok.temperature < WOK_TEMP.MIN_STIR_FRY
                      ? 'bg-gray-300 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-br from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600'
                  }`}
                  style={{
                    zIndex: 9999,
                    left: wokCenter.x - 24,
                    top: wokCenter.y - radialRadius - 24,
                  }}
                  title="볶기"
                >
                  🍳
                </button>

                {/* 서쪽 (좌측): 물넣기 */}
                <button
                  type="button"
                  onClick={() => {
                    console.log('💧 물넣기 버튼 클릭!')
                    handleAction('ADD_WATER')
                  }}
                  className="fixed w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 shadow-xl flex items-center justify-center text-2xl cursor-pointer transition-transform hover:scale-110 active:scale-95"
                  style={{
                    zIndex: 9999,
                    left: wokCenter.x - radialRadius - 24,
                    top: wokCenter.y - 24,
                  }}
                  title="물넣기"
                >
                  💧
                </button>

                {/* 동쪽 (우측): 뒤집기 */}
                <button
                  type="button"
                  onClick={() => {
                    console.log('🔄 뒤집기 버튼 클릭!')
                    handleAction('FLIP')
                  }}
                  className="fixed w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 shadow-xl flex items-center justify-center text-2xl cursor-pointer transition-transform hover:scale-110 active:scale-95"
                  style={{
                    zIndex: 9999,
                    left: wokCenter.x + radialRadius - 24,
                    top: wokCenter.y - 24,
                  }}
                  title="뒤집기"
                >
                  🔄
                </button>

                {/* 북서쪽 (좌상 대각선): 비우기 */}
                <button
                  type="button"
                  onClick={() => {
                    console.log('🗑️ 비우기 버튼 클릭!')
                    if (confirm(`${wok.currentMenu}을(를) 버리시겠습니까?`)) {
                      playSound('remove')
                      emptyWok(burnerNumber)
                      setShowRadialMenu(false)
                    }
                  }}
                  className="fixed w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700 shadow-xl flex items-center justify-center text-2xl cursor-pointer transition-transform hover:scale-110 active:scale-95"
                  style={{
                    zIndex: 9999,
                    left: wokCenter.x - radialRadius * 0.7 - 24,
                    top: wokCenter.y - radialRadius * 0.7 - 24,
                  }}
                  title="비우기"
                >
                  🗑️
                </button>

                {/* 남쪽 (하단): 불 세기 */}
                {wok.isOn && (
                  <div
                    className="fixed flex gap-2"
                    style={{
                      zIndex: 9999,
                      left: wokCenter.x - 52,
                      top: wokCenter.y + radialRadius,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        console.log('🔥 약불 클릭!')
                        setHeatLevel(burnerNumber, 1)
                        setShowRadialMenu(false)
                      }}
                      className={`w-9 h-9 rounded-full shadow-xl flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95 ${
                        wok.heatLevel === 1
                          ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-2 ring-yellow-300'
                          : 'bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                      title="약불"
                    >
                      약
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        console.log('🔥 중불 클릭!')
                        setHeatLevel(burnerNumber, 2)
                        setShowRadialMenu(false)
                      }}
                      className={`w-9 h-9 rounded-full shadow-xl flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95 ${
                        wok.heatLevel === 2
                          ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white ring-2 ring-orange-300'
                          : 'bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                      title="중불"
                    >
                      중
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        console.log('🔥 강불 클릭!')
                        setHeatLevel(burnerNumber, 3)
                        setShowRadialMenu(false)
                      }}
                      className={`w-9 h-9 rounded-full shadow-xl flex items-center justify-center text-xs font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95 ${
                        wok.heatLevel === 3
                          ? 'bg-gradient-to-br from-red-500 to-red-700 text-white ring-2 ring-red-300'
                          : 'bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                      title="강불"
                    >
                      강
                    </button>
                  </div>
                )}
              </div>

              {/* 모바일용 중앙 액션 메뉴 (데스크톱에서는 숨김) */}
              <div className="lg:hidden fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
                <div
                  className="bg-gray-900/95 rounded-2xl p-4 shadow-2xl border border-gray-700 max-w-[280px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center text-white text-sm font-bold mb-3">
                    {wok.currentMenu}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* 볶기 */}
                    <button
                      type="button"
                      onClick={() => {
                        console.log('🍳 볶기 버튼 클릭! (모바일)')
                        handleAction('STIR_FRY')
                      }}
                      disabled={wok.temperature < WOK_TEMP.MIN_STIR_FRY}
                      className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-1 ${
                        wok.temperature < WOK_TEMP.MIN_STIR_FRY
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-br from-orange-400 to-red-500 text-white active:scale-95'
                      }`}
                    >
                      <span className="text-xl">🍳</span>
                      <span className="text-[10px] font-bold">볶기</span>
                    </button>

                    {/* 물넣기 */}
                    <button
                      type="button"
                      onClick={() => {
                        console.log('💧 물넣기 버튼 클릭! (모바일)')
                        handleAction('ADD_WATER')
                      }}
                      className="min-h-[48px] rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 text-white flex flex-col items-center justify-center gap-1 active:scale-95"
                    >
                      <span className="text-xl">💧</span>
                      <span className="text-[10px] font-bold">물넣기</span>
                    </button>

                    {/* 뒤집기 */}
                    <button
                      type="button"
                      onClick={() => {
                        console.log('🔄 뒤집기 버튼 클릭! (모바일)')
                        handleAction('FLIP')
                      }}
                      className="min-h-[48px] rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 text-white flex flex-col items-center justify-center gap-1 active:scale-95"
                    >
                      <span className="text-xl">🔄</span>
                      <span className="text-[10px] font-bold">뒤집기</span>
                    </button>

                    {/* 비우기 */}
                    <button
                      type="button"
                      onClick={() => {
                        console.log('🗑️ 비우기 버튼 클릭! (모바일)')
                        if (confirm(`${wok.currentMenu}을(를) 버리시겠습니까?`)) {
                          playSound('remove')
                          emptyWok(burnerNumber)
                          setShowRadialMenu(false)
                        }
                      }}
                      className="min-h-[48px] rounded-xl bg-gradient-to-br from-red-400 to-red-600 text-white flex flex-col items-center justify-center gap-1 active:scale-95"
                    >
                      <span className="text-xl">🗑️</span>
                      <span className="text-[10px] font-bold">비우기</span>
                    </button>
                  </div>

                  {/* 불 세기 (화구 켜져있을 때만) */}
                  {wok.isOn && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-[10px] text-gray-400 text-center mb-2">불 세기</div>
                      <div className="flex justify-center gap-2">
                        {[1, 2, 3].map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => {
                              console.log(`🔥 ${level === 1 ? '약' : level === 2 ? '중' : '강'}불 클릭! (모바일)`)
                              setHeatLevel(burnerNumber, level as 1 | 2 | 3)
                              setShowRadialMenu(false)
                            }}
                            className={`min-w-[48px] min-h-[48px] rounded-xl flex items-center justify-center text-sm font-bold ${
                              wok.heatLevel === level
                                ? level === 1
                                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white ring-2 ring-yellow-300'
                                  : level === 2
                                  ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white ring-2 ring-orange-300'
                                  : 'bg-gradient-to-br from-red-500 to-red-700 text-white ring-2 ring-red-300'
                                : 'bg-gray-700 text-gray-300'
                            }`}
                          >
                            {level === 1 ? '약' : level === 2 ? '중' : '강'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 닫기 버튼 */}
                  <button
                    type="button"
                    onClick={() => setShowRadialMenu(false)}
                    className="w-full mt-3 py-2 min-h-[44px] rounded-xl bg-gray-700 text-gray-300 text-sm font-bold active:bg-gray-600"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </>
          )}
        </>,
        document.body
      )}

      <div
        ref={containerRef}
        className="w-full h-full bg-gray-800 rounded-lg flex flex-col items-center p-1 relative"
      >
        {/* 온도 게이지 - 상단 컴팩트 */}
        <div className="w-full flex items-center justify-between px-1 mb-1">
          <span className="text-[9px] font-bold text-gray-400">
            {wok.hasWater ? '💧' : '🌡️'}
          </span>
          <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
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

        {/* 온도 바 - 컴팩트 */}
        <div className="w-full h-1 bg-gray-600 rounded-full overflow-hidden mb-1">
          {wok.hasWater ? (
            <div
              className="h-full transition-all duration-300 bg-gradient-to-r from-blue-300 to-blue-500"
              style={{ width: `${Math.min((wok.waterTemperature / WOK_TEMP.WATER_BOIL) * 100, 100)}%` }}
            />
          ) : (
            <div
              className={`h-full transition-all duration-300 ${
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

        {/* 웍+화구 영역 - flex-col로 배치 (웍 위, 화구 아래) */}
        <div className={`flex-1 w-full flex flex-col items-center justify-center gap-1 ${showRadialMenu ? 'z-[102]' : 'z-10'}`}>
          {/* 웍 (위쪽) */}
          <motion.div
            ref={wokRef}
            animate={wokAnimation[wok.position]}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="flex items-center justify-center cursor-pointer relative"
            style={{
              width: isCompact ? '50%' : '52%',
              aspectRatio: '1',
              zIndex: wok.position !== 'AT_BURNER' ? 50 : 2,
              opacity: wok.position !== 'AT_BURNER' ? 1 : 0.5,
            }}
            onClick={(e) => {
              const clickableStates: WokState[] = ['CLEAN', 'WET', 'OVERHEATING']
              if (wok.currentMenu && clickableStates.includes(wok.state)) {
                // 데스크톱과 모바일 모두에서 메뉴 열기 지원
                e.stopPropagation()
                setShowRadialMenu(!showRadialMenu)
              }
            }}
          >
            {/* 웍 본체 */}
            <div className={`w-full h-full rounded-full border-4 flex items-center justify-center shadow-xl transition relative ${
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
                    <div className="text-2xl lg:text-3xl">💧</div>
                    <div className="text-[9px] lg:text-[10px] font-bold text-blue-700 mt-0.5">
                      {Math.round(wok.waterTemperature)}°C
                    </div>
                  </div>
                </div>
              )}

              {/* 물이 끓을 때 애니메이션 */}
              <AnimatePresence>
                {wok.isBoiling && (
                  <>
                    {[0, 0.3, 0.6].map((delay, i) => (
                      <motion.div
                        key={`bubble-${i}-${equipmentKey}`}
                        initial={{ scale: 0, y: 0, opacity: 0 }}
                        animate={{
                          scale: [0, 1, 0],
                          y: [0, -40],
                          opacity: [0, 1, 0],
                        }}
                        transition={{ duration: 1.2, repeat: Infinity, delay }}
                        className="absolute text-xl"
                        style={{ left: `${30 + i * 20}%`, top: '50%' }}
                      >
                        💦
                      </motion.div>
                    ))}
                  </>
                )}
              </AnimatePresence>

              {/* 볶기 중일 때 불 효과 */}
              <AnimatePresence mode="wait">
                {wok.isStirFrying && wok.temperature >= WOK_TEMP.MIN_STIR_FRY && !wok.hasWater && (
                  <motion.div
                    key={`fire-${equipmentKey}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: [1, 1.3, 1.1],
                      opacity: [0.8, 1, 0.8],
                      rotate: [0, 5, -5, 0],
                    }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl lg:text-4xl z-20"
                    style={{ filter: 'drop-shadow(0 0 15px rgba(255,100,0,0.8))' }}
                  >
                    🔥
                  </motion.div>
                )}
              </AnimatePresence>

              {wok.currentMenu && !wok.hasWater && (
                <span className="text-white text-[10px] lg:text-xs font-bold text-center px-1 drop-shadow-lg z-10">
                  {wok.currentMenu}
                </span>
              )}
              {wok.state === 'BURNED' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl lg:text-4xl filter drop-shadow-2xl">💀</span>
                </div>
              )}

              {/* 스모킹 포인트 효과 */}
              <AnimatePresence mode="wait">
                {wok.temperature >= WOK_TEMP.SMOKING_POINT &&
                 wok.temperature < WOK_TEMP.BURNED &&
                 wok.state !== 'BURNED' &&
                 wok.state !== 'OVERHEATING' &&
                 !wok.isStirFrying &&
                 !wok.hasWater && (
                  <motion.div
                    key={`smoke-${equipmentKey}`}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: [0.3, 0.7, 0.3], y: [-5, -25] }}
                    exit={{ opacity: 0, y: -30, transition: { duration: 0.3 } }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-6 text-2xl z-5"
                  >
                    💨
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* 웍 상태 표시 - 웍 내부 하단 */}
            <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1 py-0.5 rounded ${
              wok.state === 'BURNED' ? 'text-white bg-red-600/90' :
              wok.state === 'OVERHEATING' ? 'text-white bg-orange-500/90' :
              'text-gray-300 bg-gray-700/80'
            }`}>
              {wok.state === 'WET' ? '💧' :
               wok.state === 'DIRTY' ? '🟤' :
               wok.state === 'BURNED' ? '💀' :
               wok.state === 'OVERHEATING' ? '⚠️' :
               '✨'}
            </div>
          </motion.div>

          {/* 화구 (아래쪽 - 웍과 겹침) */}
          <div
            className={`rounded-full border-2 border-gray-500 flex items-center justify-center transition shadow-lg ${
              wok.isOn ? '' : 'bg-gradient-to-br from-gray-400 via-gray-300 to-gray-400'
            }`}
            style={{
              width: isCompact ? '40%' : '45%',
              aspectRatio: '1',
              zIndex: 1,
              marginTop: '-100px',
              ...(wok.isOn ? {
                backgroundImage: `radial-gradient(circle at center, rgba(255,200,0,0.8) 0%, rgba(255,100,0,0.6) 30%, rgba(255,0,0,0.4) 60%, rgba(200,50,0,0.3) 100%)`,
                boxShadow: '0 0 20px rgba(255,100,0,0.6), inset 0 0 10px rgba(0,0,0,0.3)'
              } : {
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.2)'
              })
            }}
          >
            {wok.isOn && (
              <span className="text-yellow-300 text-lg animate-pulse filter drop-shadow-[0_0_10px_rgba(255,200,0,0.9)]">
                🔥
              </span>
            )}
          </div>

          {/* 장비명 */}
          <span className="text-[8px] text-gray-400 font-bold whitespace-nowrap">
            {displayName}
          </span>
        </div>

        {/* 컨트롤 버튼 영역 */}
        <div className="w-full flex flex-col items-center gap-1">
          {wok.state === 'DIRTY' || wok.state === 'BURNED' ? (
            <button
              type="button"
              onClick={() => {
                if (!wok.isOn) {
                  playSound('wash')
                }
                washWok(burnerNumber)
              }}
              disabled={wok.isOn}
              className={`px-2 py-1 rounded text-white text-[10px] lg:text-xs font-bold shadow transition-all ${
                wok.isOn
                  ? 'bg-gray-400 cursor-not-allowed opacity-50'
                  : wok.state === 'BURNED'
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                    : 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700'
              }`}
            >
              {wok.isOn ? '⚠️' : '🚰'} 씻기
            </button>
          ) : wok.state === 'WET' ? (
            <button
              type="button"
              onClick={() => {
                playSound(wok.isOn ? 'fire_off' : 'fire_on')
                toggleBurner(burnerNumber)
              }}
              className={`px-2 py-1 rounded text-white text-[10px] lg:text-xs font-bold shadow transition-all ${
                wok.isOn
                  ? 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 animate-pulse'
                  : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'
              }`}
            >
              {wok.isOn ? '🔥 말리는 중' : '🔥 말리기'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  playSound(wok.isOn ? 'fire_off' : 'fire_on')
                  toggleBurner(burnerNumber)
                }}
                className={`px-2 py-1 rounded text-[10px] lg:text-xs font-bold shadow transition-all ${
                  wok.isOn
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
                    : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                }`}
              >
                {wok.isOn ? '🔥 끄기' : '🔥 켜기'}
              </button>

              {wok.currentMenu && (() => {
                // v3: recipe_bundles에서 스텝 추출
                const { getRecipeByMenuName, getRecipeSteps, getWokBundle } = useGameStore.getState()
                const recipe = getRecipeByMenuName(wok.currentMenu!)
                const sortedSteps = getRecipeSteps(recipe, wok.currentBundleId)
                const isComplete = wok.currentStep >= sortedSteps.length && sortedSteps.length > 0
                return isComplete ? (
                  <button
                    type="button"
                    onClick={() => {
                      playSound('add')
                      const bundle = getWokBundle(burnerNumber)
                      if (bundle) {
                        setPlateSelectInstanceId(bundle.id)
                      }
                    }}
                    className="px-2 py-1 rounded text-[10px] font-bold transition-all shadow-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 animate-pulse"
                  >
                    🍽️ 그릇 선택
                  </button>
                ) : null
              })()}
            </>
          )}
        </div>
      </div>

      {/* HOT 메뉴 그릇 선택 팝업 - Portal로 body에 렌더링 (v3.1: instanceId 기반) */}
      {plateSelectInstanceId && createPortal(
        <PlateSelectPopup
          instanceId={plateSelectInstanceId}
          onComplete={() => setPlateSelectInstanceId(null)}
          onCancel={() => setPlateSelectInstanceId(null)}
        />,
        document.body
      )}
    </>
  )
}

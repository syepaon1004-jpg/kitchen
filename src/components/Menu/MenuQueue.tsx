import { useGameStore } from '../../stores/gameStore'
import type { MenuOrder, RecipeBundle, BundleProgress } from '../../types/database.types'
import { MENU_TIMER } from '../../types/database.types'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MenuQueueProps {
  onAssignToWok: (orderId: string, burnerNumber: number, bundleId?: string) => void
  selectedBurner: number | null
  onSelectMenu?: (menuId: string) => void
  selectedMenuId?: string | null
  onSelectPlate?: (orderId: string, menuName: string, recipeId: string, bundleId?: string) => void
}

// 메뉴의 번들 타입 분석
type MenuBundleType = 'HOT_ONLY' | 'COLD_ONLY' | 'MIXED' | 'SINGLE'

interface MenuBundleInfo {
  type: MenuBundleType
  bundles: RecipeBundle[]
  hotBundles: RecipeBundle[]
  coldBundles: RecipeBundle[]
}

export default function MenuQueue({
  onAssignToWok,
  selectedBurner,
  onSelectMenu,
  selectedMenuId,
  onSelectPlate,
}: MenuQueueProps) {
  const { menuQueue, woks, elapsedSeconds, recipeBundles, recipes, activeBundles } = useGameStore()
  const cleanWoks = woks.filter((w) => w.state === 'CLEAN' && !w.currentMenu)

  // 확장된 메뉴 ID 추적
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  // 메뉴별 번들 정보 계산
  const getMenuBundleInfo = (menuName: string): MenuBundleInfo => {
    const recipe = recipes.find((r) => r.menu_name === menuName)
    if (!recipe) {
      return { type: 'SINGLE', bundles: [], hotBundles: [], coldBundles: [] }
    }

    const bundles = recipeBundles.filter((b) => b.recipe_id === recipe.id)
    if (bundles.length === 0) {
      return { type: 'SINGLE', bundles: [], hotBundles: [], coldBundles: [] }
    }

    const hotBundles = bundles.filter((b) => b.cooking_type === 'HOT')
    const coldBundles = bundles.filter((b) => b.cooking_type === 'COLD')

    let type: MenuBundleType = 'SINGLE'
    if (hotBundles.length > 0 && coldBundles.length > 0) {
      type = 'MIXED'
    } else if (hotBundles.length > 0) {
      // HOT 묶음이 1개면 SINGLE로 처리 (기존 볶음밥 동작 유지)
      type = hotBundles.length === 1 ? 'HOT_ONLY' : 'MIXED'
    } else if (coldBundles.length > 0) {
      type = coldBundles.length === 1 ? 'COLD_ONLY' : 'MIXED'
    }

    return { type, bundles, hotBundles, coldBundles }
  }

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId)
  }

  return (
    <>
      {/* Desktop 버전 - 번들 지원 + 확장 UI */}
      <div className="hidden lg:flex gap-4 overflow-x-auto pb-2">
        {menuQueue.length === 0 && (
          <p className="text-[#757575] text-sm py-2">메뉴가 곧 입장합니다...</p>
        )}
        {menuQueue.map((order, index) => {
          const bundleInfo = getMenuBundleInfo(order.menuName)
          const recipe = recipes.find((r) => r.menu_name === order.menuName)
          const isExpanded = expandedOrderId === order.id
          const isMixed = bundleInfo.type === 'MIXED'

          return (
            <MenuCard
              key={order.id}
              order={order}
              index={index}
              onAssign={(burnerNumber, bundleId) => onAssignToWok(order.id, burnerNumber, bundleId)}
              canAssign={order.status === 'WAITING' && cleanWoks.length > 0}
              selectedBurner={selectedBurner}
              bundleInfo={bundleInfo}
              bundleProgress={activeBundles.get(order.id)}
              recipeId={recipe?.id}
              onSelectPlate={onSelectPlate}
              isExpanded={isExpanded}
              onToggleExpand={() => isMixed && toggleExpand(order.id)}
              cleanWoksCount={cleanWoks.length}
            />
          )
        })}
      </div>

      {/* Mobile 버전 - 간소화 + MIXED 확장 지원 */}
      <div className="flex lg:hidden gap-2 overflow-x-auto pb-1">
        {menuQueue.length === 0 && (
          <p className="text-gray-500 text-xs py-1">메뉴 대기중...</p>
        )}
        {menuQueue.map((order) => {
          const bundleInfo = getMenuBundleInfo(order.menuName)
          const recipe = recipes.find((r) => r.menu_name === order.menuName)
          const isExpanded = expandedOrderId === order.id
          const isMixed = bundleInfo.type === 'MIXED'

          return (
            <MobileMenuCard
              key={order.id}
              order={order}
              bundleInfo={bundleInfo}
              recipe={recipe}
              elapsedSeconds={elapsedSeconds}
              cleanWoksCount={cleanWoks.length}
              onSelectMenu={onSelectMenu}
              onSelectPlate={onSelectPlate}
              onAssignToWok={onAssignToWok}
              selectedMenuId={selectedMenuId}
              isExpanded={isExpanded}
              onToggleExpand={() => isMixed && toggleExpand(order.id)}
              bundleProgress={activeBundles.get(order.id)}
            />
          )
        })}
      </div>
    </>
  )
}

// 모바일 메뉴 카드 컴포넌트
function MobileMenuCard({
  order,
  bundleInfo,
  recipe,
  elapsedSeconds,
  cleanWoksCount,
  onSelectMenu,
  onSelectPlate,
  onAssignToWok,
  selectedMenuId,
  isExpanded,
  onToggleExpand,
  bundleProgress,
}: {
  order: MenuOrder
  bundleInfo: MenuBundleInfo
  recipe: any
  elapsedSeconds: number
  cleanWoksCount: number
  onSelectMenu?: (menuId: string) => void
  onSelectPlate?: (orderId: string, menuName: string, recipeId: string, bundleId?: string) => void
  onAssignToWok: (orderId: string, burnerNumber: number, bundleId?: string) => void
  selectedMenuId?: string | null
  isExpanded: boolean
  onToggleExpand: () => void
  bundleProgress?: BundleProgress[]
}) {
  const elapsedTime = (elapsedSeconds - order.enteredAt) * 1000
  const minutes = Math.floor(elapsedTime / 60000)
  const seconds = Math.floor((elapsedTime % 60000) / 1000)

  // 시간에 따른 타이머 색상
  let timerClass = 'text-green-700'
  if (elapsedTime > MENU_TIMER.CRITICAL_TIME) {
    timerClass = 'text-red-700 font-bold animate-pulse'
  } else if (elapsedTime > MENU_TIMER.WARNING_TIME) {
    timerClass = 'text-orange-700 font-bold'
  } else if (elapsedTime > MENU_TIMER.TARGET_TIME) {
    timerClass = 'text-yellow-700'
  }

  const isColdOnly = bundleInfo.type === 'COLD_ONLY'
  const isMixed = bundleInfo.type === 'MIXED'
  const canSelect = order.status === 'WAITING' && (isColdOnly || cleanWoksCount > 0)

  // 번들 타입 배지
  const getBundleBadge = (type: MenuBundleType) => {
    switch (type) {
      case 'HOT_ONLY': return { text: '🔥', color: 'bg-orange-500' }
      case 'COLD_ONLY': return { text: '❄️', color: 'bg-cyan-500' }
      case 'MIXED': return { text: '🔥❄️', color: 'bg-purple-500' }
      default: return null
    }
  }
  const bundleBadge = getBundleBadge(bundleInfo.type)

  // 번들 상태 아이콘
  const getBundleStatusIcon = (status?: string) => {
    switch (status) {
      case 'NOT_STARTED': return '⬜'
      case 'COOKING': return '🔥'
      case 'PLATED': return '✅'
      case 'IN_DECO_ZONE': return '📦'
      case 'MERGED': return '🔗'
      default: return '⬜'
    }
  }

  // MIXED가 아닌 경우 기존 동작
  if (!isMixed) {
    return (
      <button
        disabled={!canSelect}
        onClick={(e) => {
          e.stopPropagation()
          if (!canSelect) return

          if (isColdOnly && onSelectPlate && recipe) {
            onSelectPlate(order.id, order.menuName, recipe.id)
          } else if (onSelectMenu) {
            onSelectMenu(order.id)
          }
        }}
        className={`min-w-[90px] p-2 rounded-lg shadow-md transition-all ${
          selectedMenuId === order.id ? 'ring-2 ring-blue-500 scale-105' : ''
        } ${
          order.status === 'COMPLETED'
            ? 'bg-green-200 border border-green-500'
            : order.status === 'COOKING'
              ? 'bg-orange-200 border border-orange-500'
              : isColdOnly
                ? 'bg-cyan-100 border border-cyan-500'
                : 'bg-yellow-200 border border-yellow-500'
        } ${!canSelect ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="font-bold text-[10px] text-gray-800 truncate flex-1">{order.menuName}</div>
          {bundleBadge && <span className="text-[8px]">{bundleBadge.text}</span>}
        </div>
        {order.status !== 'COMPLETED' && (
          <div className={`text-[8px] mt-1 font-mono ${timerClass}`}>
            ⏱️ {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        )}
        {isColdOnly && order.status === 'WAITING' && (
          <div className="text-[8px] text-cyan-700 mt-1 font-medium">🍽️ 접시선택</div>
        )}
      </button>
    )
  }

  // MIXED 메뉴 - 확장 가능한 카드
  return (
    <div className="flex items-start gap-1">
      {/* 메인 카드 (클릭하면 확장) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleExpand()
        }}
        className={`min-w-[100px] p-2 rounded-lg shadow-md transition-all ${
          isExpanded ? 'ring-2 ring-purple-500' : ''
        } bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-400 cursor-pointer`}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="font-bold text-[10px] text-gray-800 truncate flex-1">{order.menuName}</div>
          <span className="text-[8px]">🔥❄️</span>
        </div>
        {order.status !== 'COMPLETED' && (
          <div className={`text-[8px] mt-1 font-mono ${timerClass}`}>
            ⏱️ {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        )}
        <div className="text-[8px] text-purple-600 mt-1 font-medium">
          {isExpanded ? '◀ 접기' : '▶ 펼치기'}
        </div>
      </button>

      {/* 확장된 묶음 카드들 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex gap-1 overflow-hidden"
          >
            {bundleInfo.bundles.map((bundle) => {
              const progress = bundleProgress?.find((p) => p.bundleId === bundle.id)
              const isHot = bundle.cooking_type === 'HOT'
              // 접시 선택 가능한 상태 (progress 없거나 NOT_STARTED 또는 status 미정의)
              const isActionable = !progress || !progress.status || progress.status === 'NOT_STARTED'
              // COOKING 상태여도 해당 묶음이 아직 시작되지 않았으면 액션 가능
              const canAction = (order.status === 'WAITING' || order.status === 'COOKING') && isActionable
              // 접시 선택 완료 상태
              const isPlateSelected = progress?.status === 'IN_DECO_ZONE' || progress?.status === 'PLATED'

              return (
                <motion.div
                  key={bundle.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className={`min-w-[80px] p-2 rounded-lg shadow-md border-2 ${
                    isHot
                      ? 'bg-orange-50 border-orange-300'
                      : isPlateSelected
                        ? 'bg-green-50 border-green-300'
                        : 'bg-cyan-50 border-cyan-300'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">{isHot ? '🔥' : '❄️'}</span>
                    <span className="text-[9px] font-bold text-gray-700 truncate">
                      {bundle.bundle_name}
                    </span>
                  </div>
                  <div className="text-[8px] text-gray-500 mb-1">
                    {getBundleStatusIcon(progress?.status)} {progress?.status || 'NOT_STARTED'}
                  </div>
                  {/* HOT: 화구 배정, COLD: 접시 선택 */}
                  {canAction && isHot && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAssignToWok(order.id, n, bundle.id)
                          }}
                          disabled={cleanWoksCount === 0}
                          className="py-0.5 px-1 rounded text-[8px] font-medium bg-orange-200 hover:bg-orange-300 text-orange-800 disabled:opacity-50"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {canAction && !isHot && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onSelectPlate && recipe) {
                          onSelectPlate(order.id, order.menuName, recipe.id, bundle.id)
                        }
                      }}
                      className="w-full py-1 rounded text-[8px] font-bold bg-cyan-200 hover:bg-cyan-300 text-cyan-800"
                    >
                      🍽️ 접시
                    </button>
                  )}
                  {/* COLD 묶음 접시 선택 완료 표시 */}
                  {!isHot && isPlateSelected && (
                    <div className="w-full py-1 rounded text-[8px] font-bold bg-green-200 text-green-800 text-center">
                      ✅ 선택완료
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 데스크탑 메뉴 카드 컴포넌트
function MenuCard({
  order,
  index,
  onAssign,
  canAssign,
  selectedBurner,
  bundleInfo,
  bundleProgress,
  recipeId,
  onSelectPlate,
  isExpanded,
  onToggleExpand,
  cleanWoksCount,
}: {
  order: MenuOrder
  index: number
  onAssign: (burnerNumber: number, bundleId?: string) => void
  canAssign: boolean
  selectedBurner: number | null
  bundleInfo: MenuBundleInfo
  bundleProgress?: BundleProgress[]
  recipeId?: string
  onSelectPlate?: (orderId: string, menuName: string, recipeId: string, bundleId?: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
  cleanWoksCount: number
}) {
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    const elapsed = (elapsedSeconds - order.enteredAt) * 1000
    setElapsedTime(elapsed)
  }, [elapsedSeconds, order.enteredAt])

  const minutes = Math.floor(elapsedTime / 60000)
  const seconds = Math.floor((elapsedTime % 60000) / 1000)

  let timerClass = 'text-green-700'
  if (elapsedTime > MENU_TIMER.CRITICAL_TIME) {
    timerClass = 'text-red-700 font-bold animate-pulse'
  } else if (elapsedTime > MENU_TIMER.WARNING_TIME) {
    timerClass = 'text-orange-700 font-bold'
  } else if (elapsedTime > MENU_TIMER.TARGET_TIME) {
    timerClass = 'text-yellow-700'
  }

  const isColdOnly = bundleInfo.type === 'COLD_ONLY'
  const isMixed = bundleInfo.type === 'MIXED'

  // 상태별 스타일
  const getStatusClass = () => {
    if (order.status === 'COMPLETED') return 'bg-green-200 border-2 border-green-500'
    if (order.status === 'COOKING') return 'bg-orange-200 border-2 border-orange-500 animate-pulse'
    if (isColdOnly) return 'bg-cyan-100 border-2 border-cyan-400'
    if (isMixed) return 'bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-400'
    return 'bg-yellow-200 border-2 border-yellow-500'
  }

  // 번들 상태 아이콘
  const getBundleStatusIcon = (status?: string) => {
    switch (status) {
      case 'NOT_STARTED': return '⬜'
      case 'COOKING': return '🔥'
      case 'PLATED': return '✅'
      case 'IN_DECO_ZONE': return '📦'
      case 'MERGED': return '🔗'
      default: return '⬜'
    }
  }

  // MIXED가 아닌 경우 기존 레이아웃
  if (!isMixed) {
    return (
      <div className={`w-44 min-w-[176px] p-4 rounded-lg shadow-lg ${getStatusClass()} transition`}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-sm text-[#333] truncate flex-1">{order.menuName}</div>
          {bundleInfo.type !== 'SINGLE' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isColdOnly ? 'bg-cyan-500 text-white' : 'bg-orange-500 text-white'
            }`}>
              {isColdOnly ? '❄️' : '🔥'}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-1">주문 {index + 1}</div>

        {order.status !== 'COMPLETED' && (
          <div className={`text-xs mt-1 font-mono ${timerClass}`}>
            ⏱️ {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        )}

        {/* HOT 메뉴: 화구 선택 버튼 */}
        {order.status === 'WAITING' && !isColdOnly && canAssign && (
          <div className="flex gap-1 flex-wrap mt-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onAssign(n)}
                className={`py-1 px-2 rounded text-xs font-medium ${
                  selectedBurner === n ? 'bg-primary text-white' : 'bg-white/80 text-[#333]'
                }`}
              >
                화구{n}
              </button>
            ))}
          </div>
        )}

        {/* COLD 메뉴: 접시 선택 버튼 */}
        {order.status === 'WAITING' && isColdOnly && recipeId && onSelectPlate && (
          <button
            type="button"
            onClick={() => onSelectPlate(order.id, order.menuName, recipeId)}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1"
          >
            <span>🍽️</span>
            <span>접시 선택</span>
          </button>
        )}
      </div>
    )
  }

  // MIXED 메뉴 - 확장 가능한 카드
  return (
    <div className="flex items-stretch gap-2">
      {/* 메인 카드 - 묶음 개수에 따라 너비 유연하게 조정 */}
      <div
        className={`min-w-[176px] p-4 rounded-lg shadow-lg ${getStatusClass()} transition cursor-pointer`}
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-sm text-[#333] truncate flex-1">{order.menuName}</div>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500 text-white">🔥❄️</span>
        </div>
        <div className="text-xs text-gray-600 mt-1">주문 {index + 1}</div>

        {order.status !== 'COMPLETED' && (
          <div className={`text-xs mt-1 font-mono ${timerClass}`}>
            ⏱️ {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
        )}

        {/* 묶음 요약 (축소 상태) - 묶음이 많으면 카드 너비가 늘어남 */}
        {!isExpanded && (
          <div className="mt-2 pt-2 border-t border-purple-200">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-purple-600 font-medium whitespace-nowrap">
                {bundleInfo.bundles.length}개 묶음
              </div>
              <div className="text-[10px] text-purple-500 whitespace-nowrap">▶ 클릭하여 펼치기</div>
            </div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {bundleInfo.bundles.map((bundle) => {
                const progress = bundleProgress?.find((p) => p.bundleId === bundle.id)
                return (
                  <div
                    key={bundle.id}
                    className="flex items-center gap-0.5 text-[10px] bg-white/60 px-1.5 py-0.5 rounded whitespace-nowrap"
                    title={`${bundle.bundle_name}: ${progress?.status || 'NOT_STARTED'}`}
                  >
                    <span>{bundle.cooking_type === 'HOT' ? '🔥' : '❄️'}</span>
                    <span className="font-medium">{bundle.bundle_name.slice(0, 4)}</span>
                    <span>{getBundleStatusIcon(progress?.status)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 접기 버튼 (확장 상태) */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-purple-200">
            <div className="text-[10px] text-purple-500 text-center">◀ 클릭하여 접기</div>
          </div>
        )}
      </div>

      {/* 확장된 묶음 카드들 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex gap-2 overflow-hidden"
          >
            {bundleInfo.bundles.map((bundle) => {
              const progress = bundleProgress?.find((p) => p.bundleId === bundle.id)
              const isHot = bundle.cooking_type === 'HOT'
              // 접시 선택 가능한 상태 (progress 없거나 NOT_STARTED 또는 status 미정의)
              const isActionable = !progress || !progress.status || progress.status === 'NOT_STARTED'
              // COOKING 상태여도 해당 묶음이 아직 시작되지 않았으면 액션 가능
              const canAction = (order.status === 'WAITING' || order.status === 'COOKING') && isActionable
              const hasCleanWok = cleanWoksCount > 0
              // 접시 선택 완료 상태
              const isPlateSelected = progress?.status === 'IN_DECO_ZONE' || progress?.status === 'PLATED'

              return (
                <motion.div
                  key={bundle.id}
                  initial={{ scale: 0.8, opacity: 0, x: -20 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0.8, opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className={`w-36 min-w-[144px] p-3 rounded-lg shadow-lg border-2 ${
                    isHot
                      ? 'bg-orange-50 border-orange-300'
                      : isPlateSelected
                        ? 'bg-green-50 border-green-400'
                        : 'bg-cyan-50 border-cyan-300'
                  }`}
                >
                  {/* 묶음 헤더 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{isHot ? '🔥' : '❄️'}</span>
                    <div>
                      <div className="font-bold text-sm text-gray-800">{bundle.bundle_name}</div>
                      <div className="text-[10px] text-gray-500">
                        {isHot ? 'HOT 조리' : 'COLD 플레이팅'}
                      </div>
                    </div>
                  </div>

                  {/* 상태 표시 */}
                  <div className={`text-xs mb-2 px-2 py-1 rounded ${
                    !progress || !progress.status || progress.status === 'NOT_STARTED'
                      ? 'bg-gray-100 text-gray-600'
                      : progress.status === 'COOKING'
                        ? 'bg-orange-100 text-orange-700'
                        : progress.status === 'PLATED' || progress.status === 'IN_DECO_ZONE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                  }`}>
                    {getBundleStatusIcon(progress?.status)} {progress?.status || '미시작'}
                  </div>

                  {/* HOT: 화구 배정 버튼 */}
                  {canAction && isHot && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-medium">화구 배정</div>
                      <div className="flex gap-1">
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAssign(n, bundle.id)
                            }}
                            disabled={!hasCleanWok}
                            className={`flex-1 py-1.5 rounded text-xs font-bold transition ${
                              hasCleanWok
                                ? 'bg-orange-400 hover:bg-orange-500 text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* COLD: 접시 선택 버튼 */}
                  {canAction && !isHot && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onSelectPlate && recipeId) {
                          onSelectPlate(order.id, order.menuName, recipeId, bundle.id)
                        }
                      }}
                      className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1"
                    >
                      <span>🍽️</span>
                      <span>접시 선택</span>
                    </button>
                  )}

                  {/* COLD 묶음 접시 선택 완료 표시 */}
                  {!isHot && isPlateSelected && (
                    <div className="w-full py-2 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1">
                      <span>✅</span>
                      <span>접시 선택 완료</span>
                    </div>
                  )}

                  {/* 메인 디쉬 표시 */}
                  {bundle.is_main_dish && (
                    <div className="mt-2 text-[10px] text-center text-purple-600 font-medium">
                      ⭐ 메인 디쉬
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { useSound } from '../../hooks/useSound'
import type { PlateType, DecoPlate, DecoGridCell } from '../../types/database.types'

interface PlateSelectPopupProps {
  orderId: string
  menuName: string
  recipeId: string
  bundleId: string | null
  bundleName: string | null
  isMainDish: boolean
  onComplete: () => void
  onCancel: () => void
  // HOT 메뉴용 추가 props
  cookingType?: 'HOT' | 'COLD'
  burnerNumber?: number // HOT 메뉴일 때 웍 정보
}

type Phase = 'SELECT' | 'COMPLETE'

/**
 * 접시 선택 팝업 (콜드메뉴용)
 * 1단계: 접시 타입 선택
 * 2단계: 완료 후 [닫기 / 데코존 이동] 버튼 표시
 */
export default function PlateSelectPopup({
  orderId,
  menuName,
  recipeId,
  bundleId,
  bundleName,
  isMainDish,
  onComplete,
  onCancel,
  cookingType = 'COLD',
  burnerNumber,
}: PlateSelectPopupProps) {
  const { plateTypes, addToDecoZone, openDecoZone, updateBundleProgress, recipeBundles, updateWok } = useGameStore()
  const { playSound } = useSound()

  const [phase, setPhase] = useState<Phase>('SELECT')
  const [selectedPlateType, setSelectedPlateType] = useState<PlateType | null>(null)
  const [, setCreatedPlate] = useState<DecoPlate | null>(null)

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleSelectPlate = (plateType: PlateType) => {
    playSound('add')
    setSelectedPlateType(plateType)
  }

  const handleConfirmPlate = () => {
    if (!selectedPlateType) {
      alert('접시를 선택해주세요.')
      return
    }

    // 3x3 그리드 셀 초기화
    const gridCells: DecoGridCell[] = []
    for (let i = 1; i <= 9; i++) {
      gridCells.push({ position: i, layers: [] })
    }

    // DecoPlate 생성
    const newPlate: DecoPlate = {
      id: `plate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      orderId,
      menuName,
      recipeId,
      bundleId,
      bundleName,
      plateType: selectedPlateType,
      isMainDish,
      status: 'DECO_WAITING',
      appliedDecos: [],
      gridCells,
      mergedBundles: [],
    }

    // 데코존에 플레이트 추가
    const success = addToDecoZone(newPlate)
    if (!success) {
      alert('데코존이 가득 찼습니다. (최대 6개)')
      return
    }

    // HOT 메뉴일 때: 웍을 DIRTY 상태로 변경하고 메뉴 정보 초기화
    if (cookingType === 'HOT' && burnerNumber !== undefined) {
      updateWok(burnerNumber, {
        state: 'DIRTY',
        currentMenu: null,
        currentOrderId: null,
        currentStep: 0,
        stepStartTime: null,
        isOn: false,
        burnerOnSince: null,
        addedIngredientIds: [], // v3: addedIngredients → addedIngredientIds
        recipeErrors: 0,
        totalSteps: 0,
      })
      console.log(`🍳 화구${burnerNumber}: ${menuName} → 접시로 이동, 웍 DIRTY 상태로 변경`)
    }

    // 묶음 진행 상태 업데이트 (IN_DECO_ZONE으로 설정)
    if (bundleId) {
      const bundle = recipeBundles.find((b) => b.id === bundleId)
      if (bundle) {
        updateBundleProgress(orderId, {
          bundleId,
          bundleName: bundle.bundle_name,
          cookingType: bundle.cooking_type as 'HOT' | 'COLD',
          isMainDish: bundle.is_main_dish,
          status: 'IN_DECO_ZONE',
          plateTypeId: selectedPlateType.id,
          assignedBurner: burnerNumber,
        })
      }
    }

    setCreatedPlate(newPlate)
    playSound('confirm')
    setPhase('COMPLETE')
  }

  const handleClose = () => {
    playSound('cancel')
    onComplete()
  }

  const handleMoveToDecoZone = () => {
    playSound('confirm')
    onComplete()
    openDecoZone()
  }

  // 접시 타입별 아이콘
  const getPlateIcon = (type: PlateType['plate_type']) => {
    switch (type) {
      case 'BOWL': return '🥣'
      case 'FLAT': return '🍽️'
      case 'DEEP': return '🥘'
      case 'TRAY': return '🍱'
      default: return '🍽️'
    }
  }

  // 접시 타입별 한글 이름
  const getPlateTypeName = (type: PlateType['plate_type']) => {
    switch (type) {
      case 'BOWL': return '그릇형'
      case 'FLAT': return '평판형'
      case 'DEEP': return '깊은형'
      case 'TRAY': return '트레이형'
      default: return type
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-lg w-full max-h-[80vh] flex flex-col"
      >
        {/* 헤더 */}
        <div className={`p-4 border-b flex justify-between items-center ${
          cookingType === 'HOT'
            ? 'bg-gradient-to-r from-orange-500 to-red-500'
            : 'bg-gradient-to-r from-cyan-500 to-blue-500'
        }`}>
          <div>
            <h3 className="font-bold text-white text-lg">
              {phase === 'SELECT' ? '그릇 선택' : '그릇 준비 완료'}
            </h3>
            <p className={`text-xs mt-1 ${cookingType === 'HOT' ? 'text-orange-100' : 'text-cyan-100'}`}>
              {phase === 'SELECT'
                ? `${menuName} - 플레이팅할 그릇을 선택하세요`
                : '데코존에서 플레이팅을 시작하세요'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound('cancel')
              onCancel()
            }}
            className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium text-sm"
          >
            ✕
          </button>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'SELECT' ? (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 overflow-y-auto"
            >
              {/* 메뉴 정보 */}
              <div className="p-4 bg-gray-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-xl shadow-md">
                    🍽️
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">{menuName}</div>
                    {bundleName && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {bundleName} {isMainDish && '(메인)'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 접시 목록 */}
              <div className="p-4 space-y-3">
                {plateTypes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    사용 가능한 접시 타입이 없습니다.
                  </div>
                ) : (
                  plateTypes.map((plate) => (
                    <button
                      key={plate.id}
                      type="button"
                      onClick={() => handleSelectPlate(plate)}
                      className={`w-full p-4 rounded-xl border-2 transition-all ${
                        selectedPlateType?.id === plate.id
                          ? 'border-cyan-500 bg-cyan-50 shadow-lg ring-2 ring-cyan-200'
                          : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-md ${
                          selectedPlateType?.id === plate.id
                            ? 'bg-cyan-500'
                            : 'bg-gray-100'
                        }`}>
                          {getPlateIcon(plate.plate_type)}
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-bold text-gray-800 text-lg">
                            {plate.plate_name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {getPlateTypeName(plate.plate_type)}
                            </span>
                            <span>
                              {plate.grid_size}×{plate.grid_size} 그리드
                            </span>
                            <span>
                              슬롯 {plate.deco_slots}개
                            </span>
                          </div>
                        </div>
                        {selectedPlateType?.id === plate.id && (
                          <div className="text-cyan-500 text-2xl">✓</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* 확인 버튼 */}
              <div className="p-4 border-t bg-white flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playSound('cancel')
                    onCancel()
                  }}
                  className="px-6 py-2 rounded bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold text-sm"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPlate}
                  disabled={!selectedPlateType}
                  className={`px-6 py-2 rounded font-bold text-sm shadow-lg ${
                    selectedPlateType
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ✓ 접시 선택
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="complete"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              {/* 완료 표시 */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-4xl shadow-lg mb-4">
                  {selectedPlateType ? getPlateIcon(selectedPlateType.plate_type) : '🍽️'}
                </div>
                <div className="text-gray-800 font-bold text-lg">접시가 준비되었습니다!</div>
                <div className="text-gray-500 text-sm mt-1">
                  데코존에서 플레이팅을 진행하세요
                </div>
              </div>

              {/* 선택한 접시 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-xs font-medium text-gray-500 mb-2">선택한 접시</div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center text-2xl">
                    {selectedPlateType ? getPlateIcon(selectedPlateType.plate_type) : '🍽️'}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">
                      {selectedPlateType?.plate_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {selectedPlateType && getPlateTypeName(selectedPlateType.plate_type)} · {selectedPlateType?.grid_size}×{selectedPlateType?.grid_size} 그리드
                    </div>
                  </div>
                </div>
              </div>

              {/* 메뉴 정보 */}
              <div className="bg-cyan-50 rounded-lg p-3 mb-6 border border-cyan-200">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-600">📋</span>
                  <span className="font-medium text-cyan-800">{menuName}</span>
                  {bundleName && (
                    <span className="text-xs text-cyan-600">({bundleName})</span>
                  )}
                </div>
              </div>

              {/* 닫기 / 이동 버튼 */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleMoveToDecoZone}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2"
                >
                  <span>🎨</span>
                  <span>데코존으로 이동</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

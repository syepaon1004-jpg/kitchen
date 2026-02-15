import { useState, useCallback } from 'react'
import { useGameStore } from '../../stores/gameStore'
import { useSound } from '../../hooks/useSound'
import DecoAmountPopup from './DecoAmountPopup'
// v3: DecoIngredient, DecoStep 사용 (deprecated: DecoDefaultItem, DecoRule)
// v3.1: BundleInstance 기반 리팩토링
import type { DecoIngredient, DecoStep, DecoPlate, SelectedDecoIngredient, BundleInstance } from '../../types/database.types'

interface DecoZoneProps {
  onBack?: () => void
}

// 셀 플래시 상태 타입
interface CellFlash {
  plateId: string
  position: number
  type: 'success' | 'error'
}

// v3: 수량 입력 팝업 상태 타입
interface AmountPopupState {
  plateId: string
  position: number
  step: DecoStep // v3: rule → step
  sourceInstanceId?: string // BUNDLE 합치기 시 소스 번들 인스턴스 ID
}

/**
 * DecoZone - 데코/플레이팅 화면
 *
 * 인터랙션 플로우:
 * 1. 재료 선택 → selectDecoIngredient()
 * 2. 칸 클릭 → handleGridCellClick()
 * 3. 위치 판정 → grid_positions 확인
 * 4. 수량 입력 → min_amount !== max_amount일 때 팝업
 * 5. 레이어 적용 → applyDecoItem()
 * 6. 선택 초기화 → clearDecoSelection()
 */
export default function DecoZone({ onBack }: DecoZoneProps) {
  const {
    setZone,
    woks,
    level,
    decoIngredients, // v3: decoDefaultItems → decoIngredients
    // v3.1: BundleInstance 기반 selectors
    getDecoMainPlates,
    getSettingBundles,
    selectedDecoIngredient,
    selectDecoIngredient,
    clearDecoSelection,
    applyDecoItem,
    getDecoStepForIngredient, // v3: getDecoRuleForIngredient → getDecoStepForIngredient
    addDecoMistake,
    moveBundle, // v3.1: removeSettingItem 대체
    decoSteps, // v3: decoRules → decoSteps (디버그용)
    checkDecoComplete,
    // v3.1: serveBundle (servePlate 대체)
    serveBundle,
    // 합치기 모드
    mergeMode,
    selectedSourcePlateId,
    enterMergeMode,
    exitMergeMode,
    // v3.1: mergeBundle (mergeBundles 대체)
    mergeBundle,
  } = useGameStore()

  // v3.1: BundleInstance 기반 데이터
  const decoMainInstances = getDecoMainPlates()
  const settingInstances = getSettingBundles()

  // v3.1: BundleInstance → DecoPlate 형태 변환 (UI 렌더링용)
  const decoPlates: DecoPlate[] = decoMainInstances
    .filter((inst) => inst.plating?.plateType) // plateType 필수
    .map((inst) => ({
      id: inst.id,
      orderId: inst.orderId,
      menuName: inst.menuName,
      recipeId: inst.recipeId,
      bundleId: inst.bundleId,
      bundleName: inst.bundleName,
      isMainDish: inst.isMainDish,
      plateType: inst.plating!.plateType!,
      gridCells: inst.plating?.gridCells ?? [],
      status: inst.plating?.appliedDecos?.length ? 'DECO_IN_PROGRESS' as const : 'DECO_WAITING' as const,
      appliedDecos: inst.plating?.appliedDecos ?? [],
      mergedBundles: inst.plating?.mergedBundleIds ?? [],
    }))

  const { playSound } = useSound()

  // 셀 플래시 상태 (시각적 피드백)
  const [cellFlash, setCellFlash] = useState<CellFlash | null>(null)

  // 수량 입력 팝업 상태
  const [amountPopup, setAmountPopup] = useState<AmountPopupState | null>(null)

  // 토스트 메시지 상태 (순서 오류 등 피드백용)
  const [toast, setToast] = useState<string | null>(null)

  // 과열 경고: 신입 난이도에서 데코존에 있을 때 웍 과열 알림
  const overheatingWoks = woks.filter((w) => w.state === 'OVERHEATING' || w.temperature >= 360)

  // 완성된 접시 수
  const completedCount = decoPlates.filter((p) => p.status === 'DECO_COMPLETE' || p.status === 'READY_TO_SERVE').length

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      setZone('COOKING')
    }
  }

  // 셀 플래시 표시 (300ms 후 자동 제거)
  const showCellFlash = useCallback((plateId: string, position: number, type: 'success' | 'error') => {
    setCellFlash({ plateId, position, type })
    setTimeout(() => setCellFlash(null), 300)
  }, [])

  // 토스트 메시지 표시 (2초 후 자동 제거)
  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // v3: 상시배치 재료 클릭 (DecoIngredient)
  const handleDecoIngredientClick = (item: DecoIngredient) => {
    playSound('add')
    const itemName = item.ingredient_master?.ingredient_name ?? item.id
    const selected: SelectedDecoIngredient = {
      type: 'DECO_ITEM', // v3: DEFAULT_ITEM → DECO_ITEM
      id: item.id,
      name: itemName,
      color: item.display_color ?? '#9CA3AF', // 기본 회색
      remainingAmount: null, // 무한
      unit: item.ingredient_master?.base_unit ?? 'g',
    }
    selectDecoIngredient(selected)
  }

  // v3.1: 꺼내놓은 식자재 클릭 (BundleInstance 기반)
  // v3.3 Fix: instance.ingredients에서 실제 수량/단위 사용
  const handleSettingBundleClick = (instance: BundleInstance) => {
    playSound('add')
    // v3.3: ingredients 배열에서 수량/단위 추출 (첫 번째 재료 기준)
    const firstIngredient = instance.ingredients?.[0]
    const totalAmount = instance.availableAmount ?? (firstIngredient?.amount ?? 1)
    const unit = firstIngredient?.unit ?? 'ea'

    const selected: SelectedDecoIngredient = {
      type: 'SETTING_ITEM',
      id: instance.bundleId, // 데코 규칙 검색용 ID
      instanceId: instance.id, // v3.3: 수량 차감용 인스턴스 ID
      name: instance.bundleName ?? instance.menuName,
      color: '#14B8A6', // teal-500 (번들용)
      remainingAmount: totalAmount, // v3.3: 실제 수량 사용
      unit, // v3.3: 실제 단위 사용
    }
    selectDecoIngredient(selected)
  }

  // v3: 접시 그리드 셀 클릭 - 핵심 인터랙션 플로우
  const handleGridCellClick = (plateId: string, position: number) => {
    // Step 1: 재료가 선택되어 있어야 함
    if (!selectedDecoIngredient) {
      playSound('error')
      return
    }

    // 해당 접시 찾기
    const plate = decoPlates.find((p) => p.id === plateId)
    if (!plate) return

    // v3: 데코 스텝 조회
    const step = getDecoStepForIngredient(selectedDecoIngredient.id, plate.recipeId)

    // 스텝이 없으면 에러 (이 레시피에서 사용할 수 없는 재료)
    if (!step) {
      playSound('error')
      showCellFlash(plateId, position, 'error')
      addDecoMistake() // 실수 카운트 증가
      console.warn(`❌ 데코 스텝 없음: "${selectedDecoIngredient.name}"은(는) 이 레시피에서 사용 불가 (recipeId=${plate.recipeId})`)
      return
    }

    // v3: 위치 판정 - grid_position (단일 값만 사용)
    const allowedPosition = step.grid_position
    if (allowedPosition && allowedPosition !== position) {
      // 잘못된 위치 → 빨간 플래시 + 실수 카운트
      playSound('error')
      showCellFlash(plateId, position, 'error')
      addDecoMistake()
      console.warn(`위치 오류: ${position}번 위치는 허용되지 않음 (허용: ${allowedPosition})`)
      return
    }

    // v3: 수량 입력 필요 여부 확인 (required_amount만 사용)
    const requiredAmount = step.required_amount ?? 1

    // v3.5: SETTING_ITEM 분기 — BUNDLE vs non-BUNDLE
    if (selectedDecoIngredient.type === 'SETTING_ITEM') {
      if (step.source_type === 'BUNDLE') {
        // BUNDLE 합치기: 수량 팝업 표시 (확인 시 mergeBundle 호출)
        const sourceInstanceId = selectedDecoIngredient.instanceId
        if (!sourceInstanceId) {
          playSound('error')
          showCellFlash(plateId, position, 'error')
          console.warn('❌ BUNDLE 합치기: instanceId 없음')
          return
        }
        setAmountPopup({ plateId, position, step, sourceInstanceId })
        return
      }
      // non-BUNDLE SETTING_ITEM: 기존 수량 팝업 유지
      setAmountPopup({ plateId, position, step })
      return
    }

    // v3.1: BUNDLE 타입은 수량 팝업 없이 바로 적용 (1인분 고정)
    // 주의: 위에서 SETTING_ITEM 체크가 먼저 수행됨
    if (step.source_type === 'BUNDLE') {
      applyDecoWithAmount(plateId, position, requiredAmount)
      return
    }

    // v3: DECO_ITEM의 경우 수량이 고정이면 바로 적용
    applyDecoWithAmount(plateId, position, requiredAmount)
  }

  // 데코 적용 (수량 포함)
  const applyDecoWithAmount = (plateId: string, position: number, amount: number) => {
    if (!selectedDecoIngredient) return

    const result = applyDecoItem(plateId, position, selectedDecoIngredient.id, amount)

    if (result.success) {
      // 성공 → 초록 플래시
      playSound('confirm')
      showCellFlash(plateId, position, 'success')
      // Step 6: 선택 초기화 (선택 유지하고 싶으면 이 줄 제거)
      // clearDecoSelection()
    } else {
      // 실패 → 빨간 플래시
      playSound('error')
      showCellFlash(plateId, position, 'error')

      // 위치 오류 시 실수 카운트 (gameStore에서 이미 추가하지 않은 경우)
      if (result.isPositionError) {
        addDecoMistake()
      }

      // 순서 오류 시 토스트 메시지 표시 (BEGINNER에서만 - 중급 이상은 gameStore에서 감점 처리됨)
      if (result.isOrderError) {
        showToast(result.message)
      }

      console.warn(result.message)
    }
  }

  // 수량 팝업 확인
  const handleAmountConfirm = (amount: number) => {
    if (!amountPopup) return

    if (amountPopup.sourceInstanceId) {
      // BUNDLE 합치기: mergeBundle에 유저 선택 수량 전달
      const result = mergeBundle(amountPopup.plateId, amountPopup.sourceInstanceId, amount)
      if (result.success) {
        playSound('confirm')
        showCellFlash(amountPopup.plateId, amountPopup.position, 'success')
        clearDecoSelection()
      } else {
        playSound('error')
        showCellFlash(amountPopup.plateId, amountPopup.position, 'error')
        showToast(result.message)
      }
    } else {
      // 일반 데코 아이템
      applyDecoWithAmount(amountPopup.plateId, amountPopup.position, amount)
    }

    setAmountPopup(null)
  }

  // 수량 팝업 취소
  const handleAmountCancel = () => {
    playSound('cancel')
    setAmountPopup(null)
  }

  return (
    <div className="w-full h-full bg-indigo-50 flex flex-col overflow-hidden">
      {/* ===== 상단 바 ===== */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2"
        >
          <span>←</span>
          <span>주방으로</span>
        </button>

        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>데코존</span>
        </h2>

        <div className="text-sm font-medium text-gray-600 bg-indigo-100 px-3 py-1.5 rounded-lg">
          {completedCount}/{decoPlates.length} 완성
        </div>
      </div>

      {/* 과열 경고 (신입 난이도) */}
      {level === 'BEGINNER' && overheatingWoks.length > 0 && (
        <div className="mx-4 mt-2 p-2 bg-red-500 text-white rounded-lg shadow-sm animate-pulse flex items-center gap-2 shrink-0">
          <span className="text-xl">⚠️</span>
          <div className="text-sm">
            <span className="font-bold">웍 과열!</span> 화구 {overheatingWoks.map((w) => w.burnerNumber).join(', ')}번
          </div>
        </div>
      )}

      {/* ===== [DEBUG] 첫 번째 접시 데코 규칙 ===== */}
      {/* v3: 디버그 정보 - decoSteps/decoIngredients 사용 */}
      {decoPlates.length > 0 && (
        <div className="mx-4 mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm text-xs shrink-0 max-h-48 overflow-auto">
          <div className="font-bold text-yellow-800 mb-2">[DEBUG] 첫 번째 접시 데코 정보 (v3)</div>
          <div className="text-gray-700 mb-1">
            <strong>메뉴:</strong> {decoPlates[0].menuName} | <strong>recipe_id:</strong> {decoPlates[0].recipeId}
          </div>
          <div className="text-gray-700 mb-2">
            <strong>decoSteps 총 {decoSteps.length}개 로드됨</strong>
          </div>
          <div className="text-gray-700 mb-1">
            <strong>이 레시피의 데코 스텝:</strong>
          </div>
          {decoSteps.filter(s => s.recipe_id === decoPlates[0].recipeId).length === 0 ? (
            <div className="text-red-600 font-bold">⚠️ 해당 레시피의 스텝 없음!</div>
          ) : (
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              {decoSteps
                .filter(s => s.recipe_id === decoPlates[0].recipeId)
                .map((step, idx) => (
                  <li key={step.id}>
                    #{idx + 1} <strong>{step.display_name}</strong> |
                    grid: {step.grid_position} |
                    type: {step.source_type} |
                    deco_ingredient: {step.deco_ingredient_id?.slice(0, 8) ?? 'null'} |
                    amount: {step.required_amount ?? '-'}{step.required_unit ?? ''}
                  </li>
                ))}
            </ul>
          )}
          <div className="text-gray-700 mt-2 mb-1">
            <strong>decoIngredients ({decoIngredients.length}개):</strong>
          </div>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            {decoIngredients.map((item) => (
              <li key={item.id}>
                <strong>{item.ingredient_master?.ingredient_name ?? item.id.slice(0, 8)}</strong> ({item.deco_category})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== 상단 재료 영역 (2열) ===== */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-white border-b border-gray-200 shrink-0">
        {/* 좌측: 상시배치 재료 */}
        <div>
          <div className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
            <span>🧂</span> 상시배치 재료
          </div>
          {/* v3: decoIngredients 렌더링 */}
          <div className="flex flex-wrap gap-2">
            {decoIngredients.length === 0 ? (
              <div className="text-xs text-gray-400">재료 없음</div>
            ) : (
              decoIngredients.map((item) => {
                const itemName = item.ingredient_master?.ingredient_name ?? item.id.slice(0, 8)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleDecoIngredientClick(item)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-all hover:scale-105 active:scale-95 ${
                      selectedDecoIngredient?.id === item.id
                        ? 'ring-2 ring-purple-500 ring-offset-2'
                        : ''
                    }`}
                    style={{ backgroundColor: item.display_color ?? '#D1D5DB' }}
                    title={itemName}
                  >
                    <span className="text-white text-[10px] text-center leading-tight px-0.5">
                      {itemName.slice(0, 3)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* 우측: 꺼내놓은 식자재 (v3.1: BundleInstance 기반) */}
        <div>
          <div className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
            <span>📦</span> 꺼내놓은 식자재
          </div>
          <div className="flex flex-wrap gap-2">
            {settingInstances.length === 0 ? (
              <div className="text-xs text-gray-400">세팅된 재료 없음</div>
            ) : (
              settingInstances.map((instance) => {
                const displayName = instance.bundleName ?? instance.menuName
                const isSelected = selectedDecoIngredient?.id === instance.bundleId
                // v3.4: availableAmount로 잔여 합치기 수량 표시
                const firstIngredient = instance.ingredients?.[0]
                const unit = firstIngredient?.unit ?? 'ea'
                const availAmount = instance.availableAmount ?? (firstIngredient?.amount ?? 1)
                const originalAmount = firstIngredient?.amount ?? 1
                const isPartial = availAmount < originalAmount
                const amountText = isPartial
                  ? `${availAmount}${unit} 남음 (${originalAmount}${unit} 중)`
                  : `${availAmount}${unit}`
                return (
                  <div key={instance.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => handleSettingBundleClick(instance)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium shadow-sm transition-all ${
                        isSelected
                          ? 'bg-teal-500 text-white ring-2 ring-teal-300'
                          : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-300'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span>🥡</span>
                        <span>{displayName}</span>
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {amountText} {isPartial ? '' : '(조리완료)'}
                      </div>
                    </button>
                    {/* 다시 넣기 버튼 - v3.1: moveBundle로 NOT_ASSIGNED 이동 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        playSound('remove')
                        moveBundle(instance.id, { type: 'NOT_ASSIGNED' })
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 flex items-center justify-center"
                      title="다시 넣기"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ===== 메인 영역 (좌측 패널 + 우측 접시) ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측 패널: 선택한 재료 */}
        <div className="w-32 shrink-0 bg-white border-r border-gray-200 p-3 flex flex-col">
          <div className="text-xs font-bold text-gray-600 mb-2">선택한 재료</div>

          {selectedDecoIngredient ? (
            <div className="flex-1 flex flex-col items-center relative group">
              {/* 선택 해제 X 버튼 (호버 시 표시) */}
              <button
                type="button"
                onClick={() => {
                  playSound('cancel')
                  clearDecoSelection()
                }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full text-sm font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 flex items-center justify-center z-10"
                title="선택 해제"
              >
                ×
              </button>

              {/* 재료 이미지 (색깔 사각형) */}
              <div
                className="w-20 h-20 rounded-lg shadow-lg flex items-center justify-center mb-2"
                style={{ backgroundColor: selectedDecoIngredient.color }}
              >
                <span className="text-white text-2xl">🥗</span>
              </div>

              {/* 재료 이름 */}
              <div className="text-sm font-bold text-gray-800 text-center mb-1">
                {selectedDecoIngredient.name}
              </div>

              {/* 남은 양 */}
              <div className="text-xs text-gray-500 text-center">
                {selectedDecoIngredient.remainingAmount !== null
                  ? `${selectedDecoIngredient.remainingAmount}${selectedDecoIngredient.unit}`
                  : '무한'}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-4xl mb-2 opacity-30">👆</div>
              <div className="text-xs text-gray-400">
                재료를<br />선택하세요
              </div>
            </div>
          )}
        </div>

        {/* 우측: 접시 영역 (2x3 그리드) */}
        <div className="flex-1 p-4 overflow-auto">
          {/* 합치기 모드 안내 */}
          {mergeMode && selectedSourcePlateId && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-300 rounded-lg flex items-center justify-between">
              <div className="text-sm text-blue-800">
                <span className="font-bold">🔗 합치기 모드:</span>{' '}
                메인 접시(파란 테두리)를 클릭하세요
              </div>
              <button
                type="button"
                onClick={() => {
                  playSound('cancel')
                  exitMergeMode()
                }}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600"
              >
                취소
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 h-full" style={{ gridTemplateRows: 'repeat(2, 1fr)' }}>
            {/* 6개 슬롯 (채워진 접시 + 빈 슬롯) */}
            {Array.from({ length: 6 }).map((_, slotIndex) => {
              const plate = decoPlates[slotIndex]

              if (plate) {
                // 채워진 접시
                const isComplete = checkDecoComplete(plate.id)
                const sourcePlate = selectedSourcePlateId
                  ? decoPlates.find((p) => p.id === selectedSourcePlateId)
                  : null

                // 합치기 모드에서 타겟 하이라이트 여부
                // v3.1: orderId 대신 recipeId로 비교 (동일 메뉴면 어떤 주문이든 합치기 가능)
                const isTargetHighlight =
                  mergeMode &&
                  sourcePlate &&
                  plate.isMainDish &&
                  plate.recipeId === sourcePlate.recipeId &&
                  plate.id !== selectedSourcePlateId

                return (
                  <PlateSlot
                    key={plate.id}
                    plate={plate}
                    selectedIngredient={selectedDecoIngredient}
                    onCellClick={(pos) => handleGridCellClick(plate.id, pos)}
                    cellFlash={cellFlash?.plateId === plate.id ? cellFlash : null}
                    isComplete={isComplete}
                    onServe={() => {
                      // v3.1: serveBundle 사용 (boolean 반환)
                      const success = serveBundle(plate.id)
                      if (success) {
                        playSound('confirm')
                      }
                    }}
                    mergeMode={mergeMode}
                    isSourcePlate={plate.id === selectedSourcePlateId}
                    isTargetHighlight={isTargetHighlight ?? false}
                    onMergeClick={() => {
                      if (selectedSourcePlateId) {
                        // v3.1: mergeBundle 사용
                        const result = mergeBundle(plate.id, selectedSourcePlateId)
                        if (result.success) {
                          playSound('confirm')
                        } else {
                          playSound('error')
                          alert(result.message)
                        }
                      }
                    }}
                    onEnterMergeMode={() => enterMergeMode(plate.id)}
                  />
                )
              } else {
                // 빈 슬롯
                return (
                  <div
                    key={`empty-${slotIndex}`}
                    className="aspect-square border border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-white/50"
                  >
                    <div className="text-center text-gray-300">
                      <div className="text-3xl">🥣</div>
                      <div className="text-xs mt-1">빈 슬롯</div>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        </div>
      </div>

      {/* v3: 수량 입력 팝업 - step 사용 */}
      {amountPopup && selectedDecoIngredient && (() => {
        const step = amountPopup.step
        const requiredAmount = step.required_amount ?? 1
        const minAmt = 1
        let maxAmt: number
        let defaultAmt: number

        if (amountPopup.sourceInstanceId) {
          // BUNDLE: 소스 가용량과 남은 필요량 중 작은 값이 최대
          const sourceAvailable = selectedDecoIngredient.remainingAmount ?? 1
          const decoMainInstances = getDecoMainPlates()
          const targetInstance = decoMainInstances.find((b) => b.id === amountPopup.plateId)
          const alreadyMerged = targetInstance?.plating?.appliedDecos
            ?.filter((a) => a.decoStepId === step.id)
            ?.reduce((sum, a) => sum + ((a as any).mergedAmount ?? 1), 0) ?? 0
          const remainingNeeded = Math.max(requiredAmount - alreadyMerged, 0)
          maxAmt = Math.min(sourceAvailable, remainingNeeded > 0 ? remainingNeeded : sourceAvailable)
          defaultAmt = maxAmt
        } else {
          maxAmt = Math.max(requiredAmount, selectedDecoIngredient.remainingAmount ?? requiredAmount, 10)
          defaultAmt = requiredAmount
        }

        return (
          <DecoAmountPopup
            ingredientName={selectedDecoIngredient.name}
            minAmount={minAmt}
            maxAmount={maxAmt}
            defaultAmount={defaultAmt}
            unit={selectedDecoIngredient.unit || step.required_unit || 'g'}
            onConfirm={handleAmountConfirm}
            onCancel={handleAmountCancel}
          />
        )
      })()}

      {/* 토스트 메시지 (순서 오류 등 피드백) */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl bg-orange-500 text-white shadow-2xl z-[60] font-bold animate-bounce">
          ⚠️ {toast}
        </div>
      )}
    </div>
  )
}

/**
 * 접시 슬롯 컴포넌트
 */
interface PlateSlotProps {
  plate: DecoPlate
  selectedIngredient: SelectedDecoIngredient | null
  onCellClick: (position: number) => void
  cellFlash: CellFlash | null
  isComplete: boolean
  onServe: () => void
  // 합치기 모드
  mergeMode: boolean
  isSourcePlate: boolean
  isTargetHighlight: boolean
  onMergeClick: () => void
  onEnterMergeMode: () => void
}

function PlateSlot({
  plate,
  selectedIngredient,
  onCellClick,
  cellFlash,
  isComplete,
  onServe,
  mergeMode,
  isSourcePlate,
  isTargetHighlight,
  onMergeClick,
  onEnterMergeMode,
}: PlateSlotProps) {
  const { playSound } = useSound()

  // 접시 배경색
  const plateColor = plate.plateType?.plate_color ?? '#F3F4F6'

  // 상태별 테두리 색상
  const getBorderColor = () => {
    if (isSourcePlate) return 'border-orange-500 border-2' // 합치기 소스 (선택됨)
    if (isTargetHighlight) return 'border-blue-500 border-2 animate-pulse' // 합치기 대상 (하이라이트)
    if (isComplete) return 'border-green-400'
    if (plate.status === 'DECO_IN_PROGRESS') return 'border-purple-400'
    return 'border-gray-200'
  }

  // 사이드 접시인지 (합치기 가능)
  const isSidePlate = !plate.isMainDish && plate.bundleId

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${getBorderColor()} p-3 flex flex-col relative`}>
      {/* 완성 뱃지 */}
      {isComplete && !mergeMode && (
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg z-10 animate-bounce">
          <span className="text-white text-lg">✓</span>
        </div>
      )}

      {/* 사이드 접시 표시 (합치기 가능) */}
      {isSidePlate && !mergeMode && (
        <div className="absolute -top-2 -left-2 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full shadow-lg z-10">
          사이드
        </div>
      )}

      {/* 합치기 대상 표시 */}
      {isTargetHighlight && (
        <div className="absolute inset-0 bg-blue-500/20 rounded-xl z-5 pointer-events-none" />
      )}

      {/* 접시 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-bold text-gray-700 truncate flex-1">
          {plate.menuName}
        </div>
        <div className={`text-[10px] px-1.5 py-0.5 rounded ${
          isComplete
            ? 'bg-green-100 text-green-700'
            : plate.status === 'DECO_IN_PROGRESS'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-indigo-100 text-gray-600'
        }`}>
          {isComplete ? '✅ 완성' : plate.status === 'DECO_IN_PROGRESS' ? '진행중' : '대기'}
        </div>
      </div>

      {/* 3x3 그리드 */}
      <div
        className={`flex-1 rounded-lg overflow-hidden ${isTargetHighlight ? 'cursor-pointer' : ''}`}
        style={{ backgroundColor: plateColor }}
        onClick={isTargetHighlight ? onMergeClick : undefined}
      >
        <div className="grid grid-cols-3 gap-0.5 h-full p-1">
          {Array.from({ length: 9 }).map((_, idx) => {
            const position = idx + 1
            const cell = plate.gridCells.find((c) => c.position === position)
            const hasLayers = cell && cell.layers.length > 0
            const topLayer = hasLayers ? cell.layers[cell.layers.length - 1] : null

            // 플래시 상태 확인
            const isFlashing = cellFlash?.position === position
            const flashClass = isFlashing
              ? cellFlash.type === 'success'
                ? 'ring-4 ring-green-400 bg-green-200'
                : 'ring-4 ring-red-400 bg-red-200'
              : ''

            return (
              <button
                key={position}
                type="button"
                onClick={(e) => {
                  if (isTargetHighlight) {
                    e.stopPropagation()
                    onMergeClick()
                    return
                  }
                  if (selectedIngredient && !mergeMode) {
                    onCellClick(position)
                  } else if (!mergeMode) {
                    playSound('error')
                  }
                }}
                className={`aspect-square rounded transition-all ${
                  selectedIngredient && !mergeMode
                    ? 'hover:ring-2 hover:ring-purple-400 cursor-pointer'
                    : isTargetHighlight
                      ? 'cursor-pointer'
                      : 'cursor-default'
                } ${
                  hasLayers ? '' : 'bg-white/50'
                } ${flashClass}`}
                style={topLayer && !isFlashing ? { backgroundColor: topLayer.imageColor } : {}}
                title={topLayer ? `${topLayer.ingredientName} x${topLayer.amount}` : `셀 ${position}`}
              >
                {hasLayers && !isFlashing && (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold drop-shadow">
                      {cell.layers.length > 1 ? `+${cell.layers.length}` : ''}
                    </span>
                  </div>
                )}
                {isFlashing && (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className={`text-lg ${cellFlash.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {cellFlash.type === 'success' ? '✓' : '✗'}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 번들 이름 */}
      {plate.bundleName && (
        <div className="text-[10px] text-gray-500 text-center mt-1 truncate">
          {plate.isMainDish ? `🍚 ${plate.bundleName}` : `🍳 ${plate.bundleName}`}
        </div>
      )}

      {/* 합치기 버튼 (사이드 접시, 합치기 모드 아닐 때) */}
      {isSidePlate && !mergeMode && !isComplete && (
        <button
          type="button"
          onClick={() => {
            playSound('add')
            onEnterMergeMode()
          }}
          className="mt-2 w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg shadow-sm transition-all active:scale-95 text-sm"
        >
          🔗 합치기
        </button>
      )}

      {/* 합치기 대상 버튼 (메인 접시, 합치기 모드일 때) */}
      {isTargetHighlight && (
        <button
          type="button"
          onClick={() => {
            playSound('confirm')
            onMergeClick()
          }}
          className="mt-2 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow-sm transition-all active:scale-95 text-sm animate-pulse"
        >
          ⬇️ 여기에 합치기
        </button>
      )}

      {/* 서빙 버튼 (완성 시, 합치기 모드 아닐 때, 메인 접시만) */}
      {isComplete && !mergeMode && plate.isMainDish && (
        <button
          type="button"
          onClick={() => {
            playSound('confirm')
            onServe()
          }}
          className="mt-2 w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-sm transition-all active:scale-95 text-sm"
        >
          🍽️ 서빙하기
        </button>
      )}
    </div>
  )
}

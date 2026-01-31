import { useState } from 'react'
import { useGameStore } from '../../stores/gameStore'
import type { IngredientInventory } from '../../types/database.types'

const DRAWER_CODES = ['DRAWER_LT', 'DRAWER_RT', 'DRAWER_LB', 'DRAWER_RB']

interface DrawerFridgeProps {
  onSelectIngredient: (ingredient: IngredientInventory) => void
}

export default function DrawerFridge({ onSelectIngredient }: DrawerFridgeProps) {
  const { ingredients } = useGameStore()
  const [popup, setPopup] = useState<{
    position: string
    ingredients: IngredientInventory[]
  } | null>(null)

  const openDrawer = (locationCode: string) => {
    // location_code로 직접 필터링하면 parent-child 구조 때문에 비어있을 수 있음
    // 대신 해당 서랍 위치와 관련된 모든 재료를 찾기 위해:
    // 1) location_code가 정확히 일치하거나
    // 2) parent_location의 location_code가 일치하는 경우
    const list = ingredients.filter((i) => {
      const loc = i.storage_location as any
      if (!loc) return false
      // 직접 일치
      if (loc.location_code === locationCode) return true
      // parent가 일치 (parent_location_id를 통한 조회는 복잡하므로 일단 전체 표시)
      return false
    })
    
    // 만약 여전히 비어있으면 모든 재료를 보여주고 section_code로 분류
    const finalList = list.length > 0 ? list : ingredients
    setPopup({ position: locationCode, ingredients: finalList })
  }

  const labels: Record<string, string> = {
    DRAWER_LT: '왼쪽 위',
    DRAWER_RT: '오른쪽 위',
    DRAWER_LB: '왼쪽 아래',
    DRAWER_RB: '오른쪽 아래',
  }

  return (
    <>
      <div className="w-full max-w-[360px] mb-8">
        <h3 className="text-sm font-semibold text-[#333] mb-2">서랍 냉장고 (화구 아래)</h3>
        <div className="grid grid-cols-2 gap-4">
          {DRAWER_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => openDrawer(code)}
              className="w-40 h-[120px] rounded-lg bg-gradient-to-br from-blue-400 to-slate-500 shadow-md hover:shadow-lg border-2 border-slate-600 text-white font-medium text-sm transition flex items-center justify-center"
            >
              {labels[code] ?? code.replace('DRAWER_', '')}
            </button>
          ))}
        </div>
      </div>

      {popup && <DrawerPopup ingredients={popup.ingredients} position={popup.position} onClose={() => setPopup(null)} onSelect={onSelectIngredient} />}
    </>
  )
}

function DrawerPopup({
  ingredients,
  position,
  onClose,
  onSelect,
}: {
  ingredients: IngredientInventory[]
  position: string
  onClose: () => void
  onSelect: (ingredient: IngredientInventory) => void
}) {
  // 디버깅: 첫 재료의 storage_location 구조 확인
  if (ingredients.length > 0) {
    console.log('첫 번째 재료 storage_location:', ingredients[0].storage_location)
  }

  // section_code 기준으로 분류
  const innerLeft = ingredients.filter((i) => {
    const loc = i.storage_location as any
    const sectionCode = loc?.section_code
    return sectionCode === 'INNER_LEFT_THIRD'
  })
  
  const innerRight = ingredients.filter((i) => {
    const loc = i.storage_location as any
    const sectionCode = loc?.section_code
    return sectionCode === 'INNER_RIGHT_THIRD'
  })
  
  const outer = ingredients.filter((i) => {
    const loc = i.storage_location as any
    const sectionCode = loc?.section_code
    return sectionCode === 'OUTER_HALF'
  })

  // section_code가 없는 재료들 (fallback)
  const unclassified = ingredients.filter((i) => {
    const loc = i.storage_location as any
    const sectionCode = loc?.section_code
    return !sectionCode || (
      sectionCode !== 'INNER_LEFT_THIRD' &&
      sectionCode !== 'INNER_RIGHT_THIRD' &&
      sectionCode !== 'OUTER_HALF'
    )
  })

  console.log('서랍 냉장고 분류:', {
    total: ingredients.length,
    innerLeft: innerLeft.length,
    innerRight: innerRight.length,
    outer: outer.length,
    unclassified: unclassified.length,
  })

  // section_code가 하나도 없으면 전체를 바깥쪽에 표시
  const hasNoSectionCode = innerLeft.length === 0 && innerRight.length === 0 && outer.length === 0
  const displayInnerLeft = hasNoSectionCode ? [] : innerLeft
  const displayInnerRight = hasNoSectionCode ? [] : innerRight
  const displayOuter = hasNoSectionCode ? ingredients : [...outer, ...unclassified]

  const handleSelect = (ing: IngredientInventory) => {
    onSelect(ing)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="p-4 border-b flex justify-between items-center bg-blue-50">
          <h3 className="font-bold text-[#333]">서랍 냉장고 - {position}</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#E0E0E0] hover:bg-[#d0d0d0] font-medium"
          >
            닫기
          </button>
        </div>

        {/* 냉장고 내부 구조 (세로로 긴 직사각형) */}
        <div className="flex flex-col max-h-[70vh] overflow-y-auto">
          {/* 위쪽: 안쪽 서드팬 (왼쪽 | 오른쪽) */}
          <div className="grid grid-cols-2 border-b-4 border-gray-400">
            {/* 안쪽 서드팬 왼쪽 */}
            <div className="border-r-2 border-gray-300 p-3 bg-blue-50/30 min-h-[200px]">
              <h4 className="text-xs font-bold text-blue-800 mb-2 border-b border-blue-300 pb-1">
                안쪽 서드팬 (왼쪽)
              </h4>
              <div className="space-y-1">
                {displayInnerLeft.length === 0 ? (
                  <p className="text-xs text-gray-500">식자재 없음</p>
                ) : (
                  displayInnerLeft.map((ing) => (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() => handleSelect(ing)}
                      className="w-full text-left py-1.5 px-2 rounded bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-400 text-xs transition"
                    >
                      <div className="font-semibold text-[#333]">
                        {ing.ingredient_master?.ingredient_name ?? ing.sku_full}
                      </div>
                      <div className="text-gray-600">
                        {ing.standard_amount}
                        {ing.standard_unit}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* 안쪽 서드팬 오른쪽 */}
            <div className="p-3 bg-blue-50/30 min-h-[200px]">
              <h4 className="text-xs font-bold text-blue-800 mb-2 border-b border-blue-300 pb-1">
                안쪽 서드팬 (오른쪽)
              </h4>
              <div className="space-y-1">
                {displayInnerRight.length === 0 ? (
                  <p className="text-xs text-gray-500">식자재 없음</p>
                ) : (
                  displayInnerRight.map((ing) => (
                    <button
                      key={ing.id}
                      type="button"
                      onClick={() => handleSelect(ing)}
                      className="w-full text-left py-1.5 px-2 rounded bg-white border border-blue-200 hover:bg-blue-50 hover:border-blue-400 text-xs transition"
                    >
                      <div className="font-semibold text-[#333]">
                        {ing.ingredient_master?.ingredient_name ?? ing.sku_full}
                      </div>
                      <div className="text-gray-600">
                        {ing.standard_amount}
                        {ing.standard_unit}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 아래쪽: 바깥쪽 하프팬 */}
          <div className="p-3 bg-slate-50 min-h-[200px]">
            <h4 className="text-xs font-bold text-slate-800 mb-2 border-b border-slate-300 pb-1">
              바깥쪽 하프팬 {hasNoSectionCode && '(전체)'}
            </h4>
            <div className="space-y-1">
              {displayOuter.length === 0 ? (
                <p className="text-xs text-gray-500">식자재 없음</p>
              ) : (
                displayOuter.map((ing) => (
                  <button
                    key={ing.id}
                    type="button"
                    onClick={() => handleSelect(ing)}
                    className="w-full text-left py-1.5 px-2 rounded bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-400 text-xs transition"
                  >
                    <div className="font-semibold text-[#333]">
                      {ing.ingredient_master?.ingredient_name ?? ing.sku_full}
                    </div>
                    <div className="text-gray-600">
                      {ing.standard_amount}
                      {ing.standard_unit}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

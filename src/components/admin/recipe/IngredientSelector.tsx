import { memo, useMemo } from 'react'
import type { IngredientMaster, IngredientInventory } from '../../../types/database.types'
import type { LocalIngredient } from '../../../api/recipeApi'
import { createEmptyIngredient } from '../../../api/recipeApi'

interface Props {
  ingredients: LocalIngredient[]
  ingredientsMaster: IngredientMaster[]
  inventoryItems: IngredientInventory[]
  onChange: (ingredients: LocalIngredient[]) => void
}

function IngredientSelector({ ingredients, ingredientsMaster, inventoryItems, onChange }: Props) {
  // 재료 마스터 ID별 인벤토리 그룹핑
  const inventoryByMaster = useMemo(() => {
    const map = new Map<string, IngredientInventory[]>()
    for (const inv of inventoryItems) {
      const key = inv.ingredient_master_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(inv)
    }
    return map
  }, [inventoryItems])

  const handleAdd = () => {
    onChange([...ingredients, createEmptyIngredient()])
  }

  const handleRemove = (localId: string) => {
    onChange(ingredients.filter((i) => i.localId !== localId))
  }

  const handleUpdate = (localId: string, updates: Partial<LocalIngredient>) => {
    onChange(
      ingredients.map((i) =>
        i.localId === localId ? { ...i, ...updates } : i
      )
    )
  }

  const handleMasterChange = (localId: string, masterId: string) => {
    const master = ingredientsMaster.find((m) => m.id === masterId)
    const locations = inventoryByMaster.get(masterId) ?? []
    // 자동 선택: 위치가 1개면 자동 설정
    const autoInventoryId = locations.length === 1 ? locations[0].id : ''

    handleUpdate(localId, {
      ingredient_master_id: masterId,
      inventory_id: autoInventoryId,
      required_unit: master?.base_unit ?? 'g',
      _ingredientName: master?.ingredient_name,
      _locationName: autoInventoryId
        ? locations[0]?.storage_location?.location_name
        : undefined,
    })
  }

  const handleInventoryChange = (localId: string, inventoryId: string) => {
    const inv = inventoryItems.find((i) => i.id === inventoryId)
    handleUpdate(localId, {
      inventory_id: inventoryId,
      _locationName: inv?.storage_location?.location_name,
    })
  }

  return (
    <div className="ml-4 mt-1 space-y-2">
      {ingredients.map((ing) => {
        const availableLocations = inventoryByMaster.get(ing.ingredient_master_id) ?? []

        return (
          <div key={ing.localId} className="flex items-start gap-2 bg-gray-50 rounded p-2">
            {/* 재료 마스터 선택 */}
            <div className="flex-1 min-w-0">
              <select
                value={ing.ingredient_master_id}
                onChange={(e) => handleMasterChange(ing.localId, e.target.value)}
                className="w-full px-1.5 py-1 border border-[#E0E0E0] rounded text-xs bg-white"
              >
                <option value="">-- 재료 선택 --</option>
                {ingredientsMaster.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.ingredient_name} ({m.base_unit})
                  </option>
                ))}
              </select>
            </div>

            {/* 위치 선택 */}
            <div className="flex-1 min-w-0">
              <select
                value={ing.inventory_id}
                onChange={(e) => handleInventoryChange(ing.localId, e.target.value)}
                className={`w-full px-1.5 py-1 border rounded text-xs bg-white ${
                  ing.ingredient_master_id && !ing.inventory_id
                    ? 'border-red-300'
                    : 'border-[#E0E0E0]'
                }`}
                disabled={!ing.ingredient_master_id}
              >
                <option value="">-- 위치 선택 --</option>
                {availableLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.storage_location?.location_name ?? loc.storage_location_id}
                  </option>
                ))}
              </select>
              {ing.ingredient_master_id && availableLocations.length === 0 && (
                <p className="text-[10px] text-red-500 mt-0.5">재고 미등록. 주방 에디터에서 배치 필요</p>
              )}
            </div>

            {/* 수량 */}
            <div className="w-16">
              <input
                type="number"
                value={ing.required_amount || ''}
                onChange={(e) =>
                  handleUpdate(ing.localId, { required_amount: parseFloat(e.target.value) || 0 })
                }
                min={0}
                step={1}
                placeholder="수량"
                className="w-full px-1.5 py-1 border border-[#E0E0E0] rounded text-xs"
              />
            </div>

            {/* 단위 */}
            <div className="w-14">
              <input
                type="text"
                value={ing.required_unit}
                onChange={(e) => handleUpdate(ing.localId, { required_unit: e.target.value })}
                placeholder="단위"
                className="w-full px-1.5 py-1 border border-[#E0E0E0] rounded text-xs"
              />
            </div>

            {/* 정확도 */}
            <label className="flex items-center gap-0.5 text-[10px] text-[#757575] whitespace-nowrap">
              <input
                type="checkbox"
                checked={ing.is_exact_match_required}
                onChange={(e) =>
                  handleUpdate(ing.localId, { is_exact_match_required: e.target.checked })
                }
                className="rounded"
              />
              정확
            </label>

            {/* 삭제 */}
            <button
              onClick={() => handleRemove(ing.localId)}
              className="text-red-400 hover:text-red-600 text-sm px-1"
              title="재료 삭제"
            >
              x
            </button>
          </div>
        )
      })}

      <button
        onClick={handleAdd}
        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
      >
        + 재료 추가
      </button>
    </div>
  )
}

export default memo(IngredientSelector)

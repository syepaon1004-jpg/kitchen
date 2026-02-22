import { memo } from 'react'
import type { DecoIngredient, IngredientInventory } from '../../../types/database.types'
import type { LocalBundle, LocalDecoStep } from '../../../api/recipeApi'
import { createEmptyDecoStep, renumberDecoSteps } from '../../../api/recipeApi'

interface Props {
  decoSteps: LocalDecoStep[]
  bundles: LocalBundle[]
  decoIngredients: DecoIngredient[]
  inventoryItems: IngredientInventory[]
  onChange: (decoSteps: LocalDecoStep[]) => void
}

function DecoStepEditor({ decoSteps, bundles, decoIngredients, inventoryItems, onChange }: Props) {
  const sideBundle = bundles.filter((b) => !b.is_main_dish)

  const handleAdd = () => {
    const nextOrder = decoSteps.length + 1
    onChange([...decoSteps, createEmptyDecoStep(nextOrder)])
  }

  const handleRemove = (localId: string) => {
    onChange(renumberDecoSteps(decoSteps.filter((d) => d.localId !== localId)))
  }

  const handleUpdate = (localId: string, updates: Partial<LocalDecoStep>) => {
    onChange(
      decoSteps.map((d) => (d.localId === localId ? { ...d, ...updates } : d))
    )
  }

  const handleSourceTypeChange = (localId: string, newType: LocalDecoStep['source_type']) => {
    handleUpdate(localId, {
      source_type: newType,
      deco_ingredient_id: null,
      inventory_id: null,
      source_bundle_id: null,
      display_name: '',
    })
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const arr = [...decoSteps]
    ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
    onChange(renumberDecoSteps(arr))
  }

  const handleMoveDown = (index: number) => {
    if (index >= decoSteps.length - 1) return
    const arr = [...decoSteps]
    ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
    onChange(renumberDecoSteps(arr))
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl p-4">
      <h3 className="text-sm font-bold text-[#333] mb-3">데코 스텝</h3>

      <div className="space-y-2">
        {decoSteps.map((deco, idx) => (
          <div key={deco.localId} className="border border-[#E0E0E0] rounded-lg p-2 bg-white overflow-hidden">
            {/* 1행: 순서 + 소스타입 + 소스선택 + 순서/삭제 */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#757575] w-4 flex-shrink-0">{deco.deco_order}.</span>

              <select
                value={deco.source_type}
                onChange={(e) =>
                  handleSourceTypeChange(deco.localId, e.target.value as LocalDecoStep['source_type'])
                }
                className="px-1 py-1 border border-[#E0E0E0] rounded text-xs bg-white font-medium flex-shrink-0"
              >
                <option value="DECO_ITEM">데코재료</option>
                <option value="SETTING_ITEM">세팅재료</option>
                <option value="BUNDLE">묶음</option>
              </select>

              {/* 소스 선택 드롭다운 */}
              {deco.source_type === 'DECO_ITEM' && (
                <select
                  value={deco.deco_ingredient_id ?? ''}
                  onChange={(e) => {
                    const decoIng = decoIngredients.find((d) => d.id === e.target.value)
                    handleUpdate(deco.localId, {
                      deco_ingredient_id: e.target.value || null,
                      display_name: decoIng?.ingredient_master?.ingredient_name ?? '',
                    })
                  }}
                  className="flex-1 min-w-0 px-1 py-1 border border-[#E0E0E0] rounded text-xs bg-white"
                >
                  <option value="">-- 데코 재료 --</option>
                  {decoIngredients.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.ingredient_master?.ingredient_name ?? d.id} ({d.deco_category})
                    </option>
                  ))}
                </select>
              )}

              {deco.source_type === 'SETTING_ITEM' && (
                <select
                  value={deco.inventory_id ?? ''}
                  onChange={(e) => {
                    const inv = inventoryItems.find((i) => i.id === e.target.value)
                    handleUpdate(deco.localId, {
                      inventory_id: e.target.value || null,
                      display_name: inv?.ingredient_master?.ingredient_name ?? '',
                    })
                  }}
                  className="flex-1 min-w-0 px-1 py-1 border border-[#E0E0E0] rounded text-xs bg-white"
                >
                  <option value="">-- 재고 재료 --</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.ingredient_master?.ingredient_name ?? inv.id}
                      {inv.storage_location ? ` [${inv.storage_location.location_name}]` : ''}
                    </option>
                  ))}
                </select>
              )}

              {deco.source_type === 'BUNDLE' && (
                <select
                  value={deco.source_bundle_id ?? ''}
                  onChange={(e) => {
                    const bundle = bundles.find((b) => b.localId === e.target.value)
                    handleUpdate(deco.localId, {
                      source_bundle_id: e.target.value || null,
                      display_name: bundle?.bundle_name ?? '',
                    })
                  }}
                  className="flex-1 min-w-0 px-1 py-1 border border-[#E0E0E0] rounded text-xs bg-white"
                >
                  <option value="">-- 묶음 선택 --</option>
                  {sideBundle.map((b) => (
                    <option key={b.localId} value={b.localId}>
                      {b.bundle_name || '(이름 없음)'} ({b.cooking_type})
                    </option>
                  ))}
                </select>
              )}

              {/* 순서/삭제 */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                  className="text-xs text-[#757575] hover:text-[#333] disabled:opacity-30 px-0.5"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx >= decoSteps.length - 1}
                  className="text-xs text-[#757575] hover:text-[#333] disabled:opacity-30 px-0.5"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleRemove(deco.localId)}
                  className="text-xs text-red-400 hover:text-red-600 px-0.5"
                >
                  x
                </button>
              </div>
            </div>

            {/* 2행: 표시명 + 위치 + 색상 + z순서 + 수량/단위 */}
            <div className="flex items-center gap-2 mt-1.5 ml-5 flex-wrap">
              <input
                type="text"
                value={deco.display_name}
                onChange={(e) => handleUpdate(deco.localId, { display_name: e.target.value })}
                placeholder="표시명"
                className="w-20 px-1 py-0.5 border border-[#E0E0E0] rounded text-[10px]"
              />

              <div className="flex items-center gap-0.5">
                <label className="text-[10px] text-[#757575]">위치:</label>
                <select
                  value={deco.grid_position}
                  onChange={(e) =>
                    handleUpdate(deco.localId, { grid_position: parseInt(e.target.value) })
                  }
                  className="px-0.5 py-0.5 border border-[#E0E0E0] rounded text-[10px] bg-white w-8"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <input
                type="color"
                value={deco.layer_image_color}
                onChange={(e) =>
                  handleUpdate(deco.localId, { layer_image_color: e.target.value })
                }
                className="w-5 h-5 rounded border border-[#E0E0E0] cursor-pointer"
              />

              <div className="flex items-center gap-0.5">
                <label className="text-[10px] text-[#757575]">z:</label>
                <input
                  type="number"
                  value={deco.layer_order}
                  onChange={(e) =>
                    handleUpdate(deco.localId, { layer_order: parseInt(e.target.value) || 1 })
                  }
                  min={1}
                  className="w-8 px-0.5 py-0.5 border border-[#E0E0E0] rounded text-[10px]"
                />
              </div>

              <div className="flex items-center gap-0.5">
                <label className="text-[10px] text-[#757575]">수량:</label>
                <input
                  type="number"
                  value={deco.required_amount ?? ''}
                  onChange={(e) =>
                    handleUpdate(deco.localId, {
                      required_amount: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="-"
                  min={0}
                  className="w-10 px-0.5 py-0.5 border border-[#E0E0E0] rounded text-[10px]"
                />
              </div>

              <div className="flex items-center gap-0.5">
                <label className="text-[10px] text-[#757575]">단위:</label>
                <input
                  type="text"
                  value={deco.required_unit ?? ''}
                  onChange={(e) =>
                    handleUpdate(deco.localId, { required_unit: e.target.value || null })
                  }
                  placeholder="-"
                  className="w-10 px-0.5 py-0.5 border border-[#E0E0E0] rounded text-[10px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAdd}
        className="mt-3 w-full py-2 rounded-lg border-2 border-dashed border-[#BDBDBD] text-[#757575] hover:border-blue-400 hover:text-blue-600 transition text-xs font-medium"
      >
        + 데코 스텝 추가
      </button>
    </div>
  )
}

export default memo(DecoStepEditor)

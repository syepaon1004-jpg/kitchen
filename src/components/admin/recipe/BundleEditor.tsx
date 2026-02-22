import { memo, useState } from 'react'
import type { PlateType, IngredientMaster, IngredientInventory } from '../../../types/database.types'
import type { LocalBundle } from '../../../api/recipeApi'
import { createEmptyBundle, renumberBundles } from '../../../api/recipeApi'
import StepEditor from './StepEditor'

const COOKING_TYPES = [
  { value: 'HOT', label: 'HOT (화구)' },
  { value: 'COLD', label: 'COLD (접시)' },
  { value: 'MICROWAVE', label: 'MICROWAVE (전자레인지)' },
  { value: 'FRYING', label: 'FRYING (튀김기)' },
] as const

interface Props {
  bundles: LocalBundle[]
  plateTypes: PlateType[]
  ingredientsMaster: IngredientMaster[]
  inventoryItems: IngredientInventory[]
  onChange: (bundles: LocalBundle[]) => void
}

function BundleEditor({ bundles, plateTypes, ingredientsMaster, inventoryItems, onChange }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (localId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(localId)) next.delete(localId)
      else next.add(localId)
      return next
    })
  }

  const handleAdd = () => {
    const nextOrder = bundles.length + 1
    const newBundle = createEmptyBundle(nextOrder)
    onChange([...bundles, newBundle])
    setExpandedIds((prev) => new Set(prev).add(newBundle.localId))
  }

  const handleRemove = (localId: string) => {
    onChange(renumberBundles(bundles.filter((b) => b.localId !== localId)))
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(localId)
      return next
    })
  }

  const handleUpdate = (localId: string, updates: Partial<LocalBundle>) => {
    onChange(
      bundles.map((b) => (b.localId === localId ? { ...b, ...updates } : b))
    )
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const arr = [...bundles]
    ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
    onChange(renumberBundles(arr))
  }

  const handleMoveDown = (index: number) => {
    if (index >= bundles.length - 1) return
    const arr = [...bundles]
    ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
    onChange(renumberBundles(arr))
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 mb-4">
      <h3 className="text-sm font-bold text-[#333] mb-3">묶음 (Bundles)</h3>

      <div className="space-y-2">
        {bundles.map((bundle, idx) => {
          const isExpanded = expandedIds.has(bundle.localId)
          return (
            <div key={bundle.localId} className="border border-[#E0E0E0] rounded-lg overflow-hidden">
              {/* 묶음 헤더 */}
              <div
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
                onClick={() => toggleExpand(bundle.localId)}
              >
                <span className="text-xs font-bold text-[#757575]">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="text-sm font-medium text-[#333] flex-1">
                  묶음 {bundle.bundle_order}: {bundle.bundle_name || '(이름 없음)'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  bundle.cooking_type === 'HOT' ? 'bg-red-100 text-red-700' :
                  bundle.cooking_type === 'COLD' ? 'bg-blue-100 text-blue-700' :
                  bundle.cooking_type === 'MICROWAVE' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {bundle.cooking_type}
                </span>
                {bundle.is_main_dish && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">메인</span>
                )}
                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="text-xs text-[#757575] hover:text-[#333] disabled:opacity-30 px-1"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx >= bundles.length - 1}
                    className="text-xs text-[#757575] hover:text-[#333] disabled:opacity-30 px-1"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleRemove(bundle.localId)}
                    className="text-xs text-red-400 hover:text-red-600 px-1"
                  >
                    x
                  </button>
                </div>
              </div>

              {/* 묶음 내용 */}
              {isExpanded && (
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-[#757575] mb-0.5">묶음명 *</label>
                      <input
                        type="text"
                        value={bundle.bundle_name}
                        onChange={(e) => handleUpdate(bundle.localId, { bundle_name: e.target.value })}
                        placeholder="예: 메인, 소면, 냉면육수"
                        className="w-full px-2 py-1 border border-[#E0E0E0] rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#757575] mb-0.5">조리 타입</label>
                      <select
                        value={bundle.cooking_type}
                        onChange={(e) =>
                          handleUpdate(bundle.localId, {
                            cooking_type: e.target.value as LocalBundle['cooking_type'],
                          })
                        }
                        className="w-full px-2 py-1 border border-[#E0E0E0] rounded text-xs bg-white"
                      >
                        {COOKING_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1 text-xs text-[#333] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bundle.is_main_dish}
                        onChange={(e) => handleUpdate(bundle.localId, { is_main_dish: e.target.checked })}
                        className="rounded"
                      />
                      메인 접시 (is_main_dish)
                    </label>

                    {bundle.is_main_dish && (
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-[#757575]">접시:</label>
                        <select
                          value={bundle.plate_type_id ?? ''}
                          onChange={(e) =>
                            handleUpdate(bundle.localId, {
                              plate_type_id: e.target.value || null,
                            })
                          }
                          className="px-1.5 py-1 border border-[#E0E0E0] rounded text-xs bg-white"
                        >
                          <option value="">-- 접시 선택 --</option>
                          {plateTypes.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.plate_name} ({p.plate_type})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#757575] mb-2">스텝 목록</h4>
                    <StepEditor
                      steps={bundle.steps}
                      ingredientsMaster={ingredientsMaster}
                      inventoryItems={inventoryItems}
                      onChange={(newSteps) =>
                        handleUpdate(bundle.localId, { steps: newSteps })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={handleAdd}
        className="mt-3 w-full py-2 rounded-lg border-2 border-dashed border-[#BDBDBD] text-[#757575] hover:border-blue-400 hover:text-blue-600 transition text-xs font-medium"
      >
        + 묶음 추가
      </button>
    </div>
  )
}

export default memo(BundleEditor)

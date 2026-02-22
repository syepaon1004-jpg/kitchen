import { memo } from 'react'
import type { IngredientMaster, IngredientInventory } from '../../../types/database.types'
import type { LocalStep } from '../../../api/recipeApi'
import { createEmptyStep, renumberSteps } from '../../../api/recipeApi'
import IngredientSelector from './IngredientSelector'

const ACTION_TYPES = [
  { value: 'STIR_FRY', label: '볶기' },
  { value: 'FLIP', label: '뒤집기' },
  { value: 'ADD_WATER', label: '물넣기' },
  { value: 'BOIL', label: '끓이기' },
  { value: 'SIMMER', label: '약불조림' },
  { value: 'DEEP_FRY', label: '튀기기' },
  { value: 'BLANCH', label: '데치기' },
  { value: 'DRAIN', label: '물빼기' },
  { value: 'TORCH', label: '토치' },
  { value: 'SLICE', label: '썰기' },
  { value: 'MIX', label: '섞기' },
  { value: 'MICROWAVE', label: '전자레인지' },
  { value: 'LIFT_BASKET', label: '바스켓올리기' },
] as const

const DURATION_ACTIONS = ['STIR_FRY', 'BOIL', 'SIMMER', 'DEEP_FRY', 'BLANCH', 'MICROWAVE']

interface Props {
  steps: LocalStep[]
  ingredientsMaster: IngredientMaster[]
  inventoryItems: IngredientInventory[]
  onChange: (steps: LocalStep[]) => void
}

function StepEditor({ steps, ingredientsMaster, inventoryItems, onChange }: Props) {
  const handleAdd = () => {
    const nextNum = steps.length + 1
    onChange([...steps, createEmptyStep(nextNum)])
  }

  const handleRemove = (localId: string) => {
    onChange(renumberSteps(steps.filter((s) => s.localId !== localId)))
  }

  const handleUpdate = (localId: string, updates: Partial<LocalStep>) => {
    onChange(
      steps.map((s) => (s.localId === localId ? { ...s, ...updates } : s))
    )
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const arr = [...steps]
    ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
    onChange(renumberSteps(arr))
  }

  const handleMoveDown = (index: number) => {
    if (index >= steps.length - 1) return
    const arr = [...steps]
    ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
    onChange(renumberSteps(arr))
  }

  const handleTypeChange = (localId: string, newType: 'INGREDIENT' | 'ACTION') => {
    handleUpdate(localId, {
      step_type: newType,
      action_type: newType === 'ACTION' ? 'STIR_FRY' : null,
      action_params: {},
      ingredients: newType === 'INGREDIENT' ? [] : [],
    })
  }

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={step.localId} className="border border-[#E0E0E0] rounded-lg p-2 bg-white overflow-hidden">
          {/* 1행: 번호 + 타입 + 순서/삭제 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#757575] w-4 flex-shrink-0">{step.step_number}.</span>

            <select
              value={step.step_type}
              onChange={(e) => handleTypeChange(step.localId, e.target.value as 'INGREDIENT' | 'ACTION')}
              className="px-1.5 py-1 border border-[#E0E0E0] rounded text-xs bg-white font-medium flex-shrink-0"
            >
              <option value="INGREDIENT">재료투입</option>
              <option value="ACTION">액션</option>
            </select>

            {/* ACTION: 액션타입 + 파라미터 */}
            {step.step_type === 'ACTION' && (
              <>
                <select
                  value={step.action_type ?? ''}
                  onChange={(e) => handleUpdate(step.localId, { action_type: e.target.value })}
                  className="px-1.5 py-1 border border-[#E0E0E0] rounded text-xs bg-white flex-shrink-0"
                >
                  <option value="">-- 액션 --</option>
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>

                {DURATION_ACTIONS.includes(step.action_type ?? '') && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <input
                      type="number"
                      value={(step.action_params?.required_duration as number) ?? ''}
                      onChange={(e) =>
                        handleUpdate(step.localId, {
                          action_params: {
                            ...step.action_params,
                            required_duration: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      placeholder="초"
                      min={0}
                      className="w-12 px-1 py-1 border border-[#E0E0E0] rounded text-xs"
                    />
                    <span className="text-[10px] text-[#757575]">초</span>
                  </div>
                )}

                {step.action_type === 'MICROWAVE' && (
                  <select
                    value={(step.action_params?.power as string) ?? 'HIGH'}
                    onChange={(e) =>
                      handleUpdate(step.localId, {
                        action_params: { ...step.action_params, power: e.target.value },
                      })
                    }
                    className="px-1 py-1 border border-[#E0E0E0] rounded text-xs bg-white flex-shrink-0"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MED</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                )}
              </>
            )}

            {/* 설명 (남은 공간 차지) */}
            <input
              type="text"
              value={step.instruction}
              onChange={(e) => handleUpdate(step.localId, { instruction: e.target.value })}
              placeholder="설명"
              className="flex-1 min-w-0 px-1.5 py-1 border border-[#E0E0E0] rounded text-xs"
            />

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
                disabled={idx >= steps.length - 1}
                className="text-xs text-[#757575] hover:text-[#333] disabled:opacity-30 px-0.5"
              >
                ↓
              </button>
              <button
                onClick={() => handleRemove(step.localId)}
                className="text-xs text-red-400 hover:text-red-600 px-0.5"
              >
                x
              </button>
            </div>
          </div>

          {/* INGREDIENT 스텝: 재료 목록 */}
          {step.step_type === 'INGREDIENT' && (
            <IngredientSelector
              ingredients={step.ingredients}
              ingredientsMaster={ingredientsMaster}
              inventoryItems={inventoryItems}
              onChange={(newIngs) => handleUpdate(step.localId, { ingredients: newIngs })}
            />
          )}
        </div>
      ))}

      <button
        onClick={handleAdd}
        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1"
      >
        + 스텝 추가
      </button>
    </div>
  )
}

export default memo(StepEditor)

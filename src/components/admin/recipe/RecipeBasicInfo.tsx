import { memo } from 'react'
import type { LocalRecipe } from '../../../api/recipeApi'

const MENU_TYPES = [
  { value: 'HOT', label: 'HOT (볶음/덮밥)' },
  { value: 'COLD', label: 'COLD (샐러드/냉채)' },
  { value: 'MIXED', label: 'MIXED (복합 메뉴)' },
  { value: 'FRYING', label: 'FRYING (튀김)' },
] as const

interface Props {
  recipe: LocalRecipe
  onChange: (updates: Partial<LocalRecipe>) => void
  onDelete: () => void
}

function RecipeBasicInfo({ recipe, onChange, onDelete }: Props) {
  return (
    <div className="bg-white border border-[#E0E0E0] rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#333]">기본 정보</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[#333] cursor-pointer">
            <input
              type="checkbox"
              checked={recipe.is_active}
              onChange={(e) => onChange({ is_active: e.target.checked })}
              className="rounded"
            />
            활성
          </label>
          {recipe.dbId && (
            <button
              onClick={onDelete}
              className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* 메뉴명 */}
        <div>
          <label className="block text-[10px] font-medium text-[#757575] mb-0.5">메뉴명 *</label>
          <input
            type="text"
            value={recipe.menu_name}
            onChange={(e) => onChange({ menu_name: e.target.value })}
            placeholder="예: 김치볶음밥"
            className="w-full px-2 py-1.5 border border-[#E0E0E0] rounded text-sm"
          />
        </div>

        {/* 메뉴 타입 */}
        <div>
          <label className="block text-[10px] font-medium text-[#757575] mb-0.5">메뉴 타입 *</label>
          <select
            value={recipe.menu_type}
            onChange={(e) => onChange({ menu_type: e.target.value as LocalRecipe['menu_type'] })}
            className="w-full px-2 py-1.5 border border-[#E0E0E0] rounded text-sm bg-white"
          >
            {MENU_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* 카테고리 */}
        <div>
          <label className="block text-[10px] font-medium text-[#757575] mb-0.5">카테고리</label>
          <input
            type="text"
            value={recipe.category}
            onChange={(e) => onChange({ category: e.target.value })}
            placeholder="예: 볶음밥, 덮밥, 물회"
            className="w-full px-2 py-1.5 border border-[#E0E0E0] rounded text-sm"
          />
        </div>
      </div>
    </div>
  )
}

export default memo(RecipeBasicInfo)

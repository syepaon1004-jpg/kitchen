import { memo, useState, useMemo } from 'react'
import type { LocalRecipe } from '../../../api/recipeApi'

const MENU_TYPE_FILTERS = [
  { value: null, label: '전체' },
  { value: 'HOT', label: '핫' },
  { value: 'COLD', label: '콜드' },
  { value: 'MIXED', label: '믹스' },
  { value: 'FRYING', label: '튀김' },
] as const

const MENU_TYPE_LABELS: Record<string, string> = {
  HOT: '핫', COLD: '콜드', MIXED: '믹스', FRYING: '튀김',
}

const TYPE_COLORS: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700',
  COLD: 'bg-blue-100 text-blue-700',
  MIXED: 'bg-purple-100 text-purple-700',
  FRYING: 'bg-yellow-100 text-yellow-700',
}

interface Props {
  recipes: LocalRecipe[]
  selectedLocalId: string | null
  onSelect: (localId: string) => void
  onAdd: () => void
}

function RecipeListPanel({ recipes, selectedLocalId, onSelect, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = recipes
    if (typeFilter) {
      list = list.filter((r) => r.menu_type === typeFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.menu_name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      )
    }
    return list
  }, [recipes, typeFilter, search])

  // 카테고리별 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, LocalRecipe[]>()
    for (const r of filtered) {
      const cat = r.category || '미분류'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(r)
    }
    return map
  }, [filtered])

  return (
    <div className="flex-1 bg-white border-r border-[#E0E0E0] flex flex-col h-full min-w-0">
      {/* 헤더 + 검색 */}
      <div className="px-3 py-2 border-b border-[#E0E0E0] space-y-1.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#333]">레시피</h2>
          <span className="text-[10px] text-[#999]">{filtered.length}개{filtered.length !== recipes.length ? ` / ${recipes.length}개` : ''}</span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="메뉴명 또는 카테고리 검색..."
          className="w-full px-2 py-1 border border-[#E0E0E0] rounded text-xs bg-gray-50 focus:bg-white focus:border-blue-300 outline-none transition"
        />
        <div className="flex gap-1">
          {MENU_TYPE_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setTypeFilter(f.value)}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition ${
                typeFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filtered.length === 0 && (
          <p className="text-[10px] text-[#999] text-center mt-4">
            {recipes.length === 0 ? '레시피가 없습니다.' : '검색 결과 없음'}
          </p>
        )}
        {[...grouped.entries()].map(([category, items]) => (
          <div key={category} className="mb-2">
            <p className="text-[10px] font-medium text-[#999] px-1 py-1 sticky top-0 bg-white">
              {category}
              <span className="ml-1 text-[#ccc]">({items.length})</span>
            </p>
            {items.map((recipe) => (
              <button
                key={recipe.localId}
                onClick={() => onSelect(recipe.localId)}
                className={`w-full text-left px-2 py-1.5 rounded mb-0.5 transition ${
                  selectedLocalId === recipe.localId
                    ? 'bg-blue-50 border border-blue-300 text-blue-700'
                    : 'hover:bg-gray-50 text-[#333] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] px-1 py-px rounded font-medium flex-shrink-0 ${
                    TYPE_COLORS[recipe.menu_type] ?? 'bg-gray-100 text-gray-600'
                  }`}>
                    {MENU_TYPE_LABELS[recipe.menu_type] ?? recipe.menu_type}
                  </span>
                  <span className="text-xs truncate">{recipe.menu_name || '(이름 없음)'}</span>
                  {!recipe.dbId && (
                    <span className="text-[9px] px-1 py-px rounded bg-green-100 text-green-700 flex-shrink-0">N</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 추가 */}
      <div className="px-3 py-2 border-t border-[#E0E0E0] flex-shrink-0">
        <button
          onClick={onAdd}
          className="w-full py-1.5 rounded-lg border-2 border-dashed border-[#BDBDBD] text-[#757575] hover:border-blue-400 hover:text-blue-600 transition text-xs"
        >
          + 새 레시피
        </button>
      </div>
    </div>
  )
}

export default memo(RecipeListPanel)

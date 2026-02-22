import { useState } from 'react'
import { motion } from 'framer-motion'
import { createIngredientMaster } from '../../api/inventoryApi'
import type { IngredientMaster } from '../../types/database.types'

const CATEGORIES = [
  '채소', '육류', '해산물', '계란', '곡물', '유제품',
  '소스', '조미료', '가니쉬', '토핑', '기타',
] as const

const UNITS = ['g', 'ml', 'ea'] as const

interface Props {
  onCreated: (master: IngredientMaster) => void
  onClose: () => void
}

export default function IngredientMasterModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [category, setCategory] = useState<string>('채소')
  const [baseUnit, setBaseUnit] = useState<string>('g')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('재료 이름을 입력하세요')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createIngredientMaster({
        ingredient_name: name.trim(),
        ingredient_name_en: nameEn.trim() || undefined,
        category,
        base_unit: baseUnit,
      })
      onCreated(created)
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5"
      >
        <h3 className="text-base font-bold text-[#333] mb-4">새 재료 등록</h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-[#757575] mb-1">재료 이름 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 양파"
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#757575] mb-1">영문 이름</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="예: Onion"
              className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#757575] mb-1">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-[#757575] mb-1">기본 단위</label>
              <select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#757575] border border-[#E0E0E0] rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

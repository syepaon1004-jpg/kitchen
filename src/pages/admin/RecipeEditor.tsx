import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { Store, PlateType, IngredientMaster, IngredientInventory, DecoIngredient } from '../../types/database.types'
import {
  type LocalRecipe,
  fetchRecipesByStore,
  fetchDecoStepsByRecipeIds,
  fetchPlateTypesByStore,
  fetchInventoryByStore,
  createPlateType,
  fromDbRecipe,
  createEmptyRecipe,
  saveRecipe,
  deleteRecipe,
  validateRecipe,
  collectOriginalDbIds,
} from '../../api/recipeApi'
import { fetchAllIngredientsMaster, fetchDecoIngredients } from '../../api/inventoryApi'
import RecipeListPanel from '../../components/admin/recipe/RecipeListPanel'
import RecipeBasicInfo from '../../components/admin/recipe/RecipeBasicInfo'
import BundleEditor from '../../components/admin/recipe/BundleEditor'
import DecoStepEditor from '../../components/admin/recipe/DecoStepEditor'
import RecipeSummary from '../../components/admin/recipe/RecipeSummary'

export default function RecipeEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentStore = useGameStore((s) => s.currentStore)
  const setStore = useGameStore((s) => s.setStore)

  // 매장 state 수신
  const storeFromState = (location.state as { store?: Store })?.store
  useEffect(() => {
    if (storeFromState && !currentStore) {
      setStore(storeFromState)
    }
  }, [storeFromState, currentStore, setStore])

  const store = currentStore ?? storeFromState
  useEffect(() => {
    if (!store) navigate('/', { replace: true })
  }, [store, navigate])

  // === 상태 ===
  const [recipes, setRecipes] = useState<LocalRecipe[]>([])
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 참조 데이터
  const [ingredientsMaster, setIngredientsMaster] = useState<IngredientMaster[]>([])
  const [inventoryItems, setInventoryItems] = useState<IngredientInventory[]>([])
  const [plateTypes, setPlateTypes] = useState<PlateType[]>([])
  const [decoIngredients, setDecoIngredients] = useState<DecoIngredient[]>([])

  // 원본 DB ID 추적 (저장 시 삭제 대상 판별)
  const [originalDbIds, setOriginalDbIds] = useState<{
    bundleDbIds: Set<string>
    stepDbIds: Set<string>
    ingredientDbIds: Set<string>
    decoStepDbIds: Set<string>
  }>({ bundleDbIds: new Set(), stepDbIds: new Set(), ingredientDbIds: new Set(), decoStepDbIds: new Set() })

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // === 데이터 로딩 ===
  const loadData = useCallback(async () => {
    if (!store) return
    try {
      setLoading(true)
      const [recipesRes, masterRes, inventoryRes, plateRes, decoIngRes] = await Promise.all([
        fetchRecipesByStore(store.id),
        fetchAllIngredientsMaster(),
        fetchInventoryByStore(store.id),
        fetchPlateTypesByStore(store.id),
        fetchDecoIngredients(store.id),
      ])

      setIngredientsMaster(masterRes)
      setInventoryItems(inventoryRes)
      setPlateTypes(plateRes)
      setDecoIngredients(decoIngRes)

      // 데코 스텝 로드
      const recipeIds = recipesRes.map((r) => r.id)
      const decoStepsRes = recipeIds.length > 0
        ? await fetchDecoStepsByRecipeIds(recipeIds)
        : []

      // Local 변환
      const localRecipes = recipesRes.map((r) => fromDbRecipe(r, decoStepsRes))
      setRecipes(localRecipes)

      // 첫 번째 레시피 자동 선택
      if (localRecipes.length > 0 && !selectedLocalId) {
        setSelectedLocalId(localRecipes[0].localId)
        setOriginalDbIds(collectOriginalDbIds(localRecipes[0]))
      }
    } catch (err: any) {
      showToast(`데이터 로드 실패: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [store, showToast])

  useEffect(() => { loadData() }, [loadData])

  // === 선택된 레시피 ===
  const selectedRecipe = recipes.find((r) => r.localId === selectedLocalId) ?? null

  // === 레시피 선택 ===
  const handleSelectRecipe = useCallback((localId: string) => {
    setSelectedLocalId(localId)
    const recipe = recipes.find((r) => r.localId === localId)
    if (recipe) {
      console.log('[RecipeEditor] 레시피 선택:', { localId: recipe.localId, dbId: recipe.dbId, menu_name: recipe.menu_name })
      console.log('[RecipeEditor] bundles dbIds:', recipe.bundles.map(b => ({ name: b.bundle_name, dbId: b.dbId })))
      setOriginalDbIds(collectOriginalDbIds(recipe))
    }
  }, [recipes])

  // === 새 레시피 ===
  const handleAddRecipe = useCallback(() => {
    if (!store) return
    const newRecipe = createEmptyRecipe(store.id)
    setRecipes((prev) => [...prev, newRecipe])
    setSelectedLocalId(newRecipe.localId)
    setOriginalDbIds({ bundleDbIds: new Set(), stepDbIds: new Set(), ingredientDbIds: new Set(), decoStepDbIds: new Set() })
  }, [store])

  // === 레시피 업데이트 ===
  const handleUpdateRecipe = useCallback((updates: Partial<LocalRecipe>) => {
    if (!selectedLocalId) return
    setRecipes((prev) =>
      prev.map((r) => (r.localId === selectedLocalId ? { ...r, ...updates } : r))
    )
  }, [selectedLocalId])

  // === 저장 ===
  const handleSave = useCallback(async () => {
    if (!selectedRecipe) return

    console.log('[RecipeEditor] 저장 시작 — selectedRecipe:', {
      localId: selectedRecipe.localId,
      dbId: selectedRecipe.dbId,
      menu_name: selectedRecipe.menu_name,
    })

    // 검증
    const errors = validateRecipe(selectedRecipe)
    if (errors.length > 0) {
      showToast(errors[0], 'error')
      return
    }

    try {
      setSaving(true)
      const { recipeDbId } = await saveRecipe(
        selectedRecipe,
        originalDbIds.bundleDbIds,
        originalDbIds.stepDbIds,
        originalDbIds.ingredientDbIds,
        originalDbIds.decoStepDbIds,
      )

      showToast('저장 완료!')
      // 리로드
      await loadData()
      // 저장된 레시피 다시 선택
      setRecipes((prev) => {
        const saved = prev.find((r) => r.dbId === recipeDbId)
        if (saved) {
          setSelectedLocalId(saved.localId)
          setOriginalDbIds(collectOriginalDbIds(saved))
        }
        return prev
      })
    } catch (err: any) {
      showToast(`저장 실패: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedRecipe, originalDbIds, showToast, loadData])

  // === 삭제 ===
  const handleDelete = useCallback(async () => {
    if (!selectedRecipe?.dbId) {
      // 아직 DB에 없는 경우 로컬에서만 제거
      setRecipes((prev) => prev.filter((r) => r.localId !== selectedLocalId))
      setSelectedLocalId(null)
      return
    }

    if (!confirm(`"${selectedRecipe.menu_name}" 레시피를 삭제하시겠습니까?\n하위 묶음/스텝/재료/데코가 모두 삭제됩니다.`)) return

    try {
      setSaving(true)
      await deleteRecipe(selectedRecipe.dbId)
      showToast('삭제 완료!')
      setSelectedLocalId(null)
      await loadData()
    } catch (err: any) {
      showToast(`삭제 실패: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedRecipe, selectedLocalId, showToast, loadData])

  // === 접시 타입 추가 ===
  const handleCreatePlateType = useCallback(async () => {
    if (!store) return
    const name = prompt('접시 이름:')
    if (!name) return

    try {
      const newPlate = await createPlateType({
        store_id: store.id,
        plate_name: name,
        plate_color: '#FFFFFF',
      })
      setPlateTypes((prev) => [...prev, newPlate])
      showToast('접시 추가 완료!')
    } catch (err: any) {
      showToast(`접시 추가 실패: ${err.message}`, 'error')
    }
  }, [store, showToast])

  if (!store) return null

  return (
    <div className="flex flex-col h-screen bg-[#F7F7F7]">
      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white text-sm font-medium ${
              toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E0E0E0] shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="text-sm text-[#757575] hover:text-[#333] transition"
          >
            ← 돌아가기
          </button>
          <h1 className="text-base font-bold text-[#333]">
            {store.store_name} — 레시피 관리
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreatePlateType}
            className="px-3 py-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-gray-100 text-sm transition"
          >
            + 접시 타입
          </button>
          <button
            onClick={loadData}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-[#E0E0E0] text-[#757575] hover:bg-gray-100 text-sm transition disabled:opacity-50"
          >
            초기화
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedRecipe}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 레시피 목록 */}
        <RecipeListPanel
          recipes={recipes}
          selectedLocalId={selectedLocalId}
          onSelect={handleSelectRecipe}
          onAdd={handleAddRecipe}
        />

        {/* 우측: 편집 폼 */}
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[#757575]">
              로딩 중...
            </div>
          ) : !selectedRecipe ? (
            <div className="flex items-center justify-center h-full text-[#757575]">
              좌측에서 레시피를 선택하거나 새 레시피를 추가하세요.
            </div>
          ) : (
            <>
              {/* 기본 정보 */}
              <RecipeBasicInfo
                recipe={selectedRecipe}
                onChange={handleUpdateRecipe}
                onDelete={handleDelete}
              />

              {/* 묶음 편집 */}
              <BundleEditor
                bundles={selectedRecipe.bundles}
                plateTypes={plateTypes}
                ingredientsMaster={ingredientsMaster}
                inventoryItems={inventoryItems}
                onChange={(bundles) => handleUpdateRecipe({ bundles })}
              />

              {/* 데코 스텝 편집 */}
              <DecoStepEditor
                decoSteps={selectedRecipe.decoSteps}
                bundles={selectedRecipe.bundles}
                decoIngredients={decoIngredients}
                inventoryItems={inventoryItems}
                onChange={(decoSteps) => handleUpdateRecipe({ decoSteps })}
              />

              {/* 레시피 요약 */}
              <RecipeSummary
                recipe={selectedRecipe}
                ingredientsMaster={ingredientsMaster}
                inventoryItems={inventoryItems}
                plateTypes={plateTypes}
                decoIngredients={decoIngredients}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

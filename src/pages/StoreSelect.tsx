import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../stores/gameStore'
import type { Store } from '../types/database.types'

const STORE_STORAGE_KEY = 'kitchen-simulator-last-store'

export default function StoreSelect() {
  const navigate = useNavigate()
  const { setStore, setUser } = useGameStore()
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 매장 생성 폼 상태
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreCode, setNewStoreCode] = useState('')
  const [newStoreAddress, setNewStoreAddress] = useState('')
  const [newStorePhone, setNewStorePhone] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    setUser(null)
    async function fetchStores() {
      const { data, error: e } = await supabase.from('stores').select('*').order('store_name')
      if (e) {
        setError(e.message)
        setStores([])
      } else {
        setStores(data ?? [])
      }
      setLoading(false)
    }
    fetchStores()
  }, [setUser])

  const lastStoreId = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_STORAGE_KEY) : null

  const handleSelect = (store: Store) => {
    setStore(store)
    try {
      localStorage.setItem(STORE_STORAGE_KEY, store.id)
    } catch (_) {}
    // state로 매장 전달 → UserLogin에서 즉시 사용 가능 (Zustand 비동기 반영 전)
    navigate('/user-login', { state: { store } })
  }

  const resetCreateForm = () => {
    setNewStoreName('')
    setNewStoreCode('')
    setNewStoreAddress('')
    setNewStorePhone('')
    setCreateError(null)
    setShowCreateForm(false)
  }

  const handleCreateStore = async () => {
    // 필수 필드 검증
    if (!newStoreName.trim()) {
      setCreateError('매장 이름을 입력해주세요')
      return
    }
    if (!newStoreCode.trim()) {
      setCreateError('매장 코드를 입력해주세요')
      return
    }

    setIsCreating(true)
    setCreateError(null)

    const { data, error: e } = await supabase
      .from('stores')
      .insert({
        store_name: newStoreName.trim(),
        store_code: newStoreCode.trim().toUpperCase(),
        ...(newStoreAddress.trim() && { store_address: newStoreAddress.trim() }),
        ...(newStorePhone.trim() && { store_phone: newStorePhone.trim() }),
      })
      .select()
      .single()

    setIsCreating(false)

    if (e) {
      if (e.message.includes('duplicate') || e.message.includes('unique') || e.code === '23505') {
        setCreateError('이미 사용 중인 매장 코드입니다')
      } else {
        setCreateError(e.message)
      }
      return
    }

    // 성공: 목록에 추가 + 하이라이트를 위해 localStorage에 저장
    setStores(prev => [...prev, data].sort((a, b) => a.store_name.localeCompare(b.store_name)))
    try {
      localStorage.setItem(STORE_STORAGE_KEY, data.id)
    } catch (_) {}
    resetCreateForm()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <p className="text-[#757575]">매장 목록 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6">
      <motion.h1
        className="text-3xl font-bold text-[#333] mb-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        주방 시뮬레이터
      </motion.h1>
      <p className="text-[#757575] mb-8">매장을 선택하세요</p>

      {error && (
        <p className="text-red-500 mb-4">연결 오류: {error}</p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-md">
        {stores.map((store, i) => (
          <motion.button
            key={store.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => handleSelect(store)}
            className={`py-4 px-6 rounded-xl text-lg font-medium transition shadow-md ${
              lastStoreId === store.id
                ? 'bg-primary text-white ring-2 ring-primary-dark'
                : 'bg-white text-[#333] hover:bg-primary/10 border border-[#E0E0E0]'
            }`}
          >
            {store.store_name}
          </motion.button>
        ))}
      </div>

      {stores.length === 0 && !error && (
        <p className="text-[#757575] mt-4">등록된 매장이 없습니다.</p>
      )}

      {/* 어드민: 주방 레이아웃 설정 */}
      {lastStoreId && stores.length > 0 && (
        <div className="w-full max-w-md mt-4">
          <button
            onClick={() => {
              const store = stores.find((s) => s.id === lastStoreId)
              if (store) {
                setStore(store)
                navigate('/admin/kitchen', { state: { store } })
              }
            }}
            className="w-full py-2 px-6 rounded-xl text-sm text-[#757575] hover:text-primary hover:bg-primary/5 border border-[#E0E0E0] transition"
          >
            주방 레이아웃 설정 →
          </button>
          <button
            onClick={() => {
              const store = stores.find((s) => s.id === lastStoreId)
              if (store) {
                setStore(store)
                navigate('/admin/recipe', { state: { store } })
              }
            }}
            className="w-full py-2 px-6 rounded-xl text-sm text-[#757575] hover:text-primary hover:bg-primary/5 border border-[#E0E0E0] transition mt-2"
          >
            레시피 관리 →
          </button>
        </div>
      )}

      {/* 매장 생성 영역 */}
      <div className="w-full max-w-md mt-6">
        <AnimatePresence>
          {!showCreateForm ? (
            <motion.button
              key="create-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateForm(true)}
              className="w-full py-3 px-6 rounded-xl border-2 border-dashed border-[#BDBDBD] text-[#757575] hover:border-primary hover:text-primary transition font-medium"
            >
              + 새 매장 만들기
            </motion.button>
          ) : (
            <motion.div
              key="create-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-xl border border-[#E0E0E0] shadow-md p-6 overflow-hidden"
            >
              <h3 className="text-lg font-bold text-[#333] mb-4">새 매장 만들기</h3>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">
                    매장 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="매장 이름"
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">
                    매장 코드 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newStoreCode}
                    onChange={(e) => setNewStoreCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="매장 코드 (예: STORE001)"
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none font-mono"
                  />
                  <p className="text-xs text-[#9E9E9E] mt-1">영문 대문자 + 숫자만 입력 가능</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">주소</label>
                  <input
                    type="text"
                    value={newStoreAddress}
                    onChange={(e) => setNewStoreAddress(e.target.value)}
                    placeholder="주소 (선택)"
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">전화번호</label>
                  <input
                    type="text"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    placeholder="전화번호 (선택)"
                    className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
              </div>

              {createError && (
                <p className="text-red-500 text-sm mt-3">{createError}</p>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleCreateStore}
                  disabled={isCreating}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? '생성 중...' : '생성'}
                </button>
                <button
                  type="button"
                  onClick={resetCreateForm}
                  disabled={isCreating}
                  className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400 font-medium transition disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

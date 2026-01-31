import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
    </div>
  )
}

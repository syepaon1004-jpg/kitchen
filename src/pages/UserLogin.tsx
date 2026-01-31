import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../stores/gameStore'
import type { Store } from '../types/database.types'
import type { User } from '../types/database.types'

const CURRENT_USER_ID_KEY = 'currentUserId'

export default function UserLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentStore = useGameStore((s) => s.currentStore)
  const setStore = useGameStore((s) => s.setStore)
  const setCurrentUser = useGameStore((s) => s.setCurrentUser)
  const loadStoreData = useGameStore((s) => s.loadStoreData)

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUserForLogin, setSelectedUserForLogin] = useState<User | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // 매장이 라우트 state로 넘어온 경우 스토어에 반영 (Zustand 비동기 대비)
  useEffect(() => {
    const storeFromState = (location.state as { store?: Store })?.store
    if (storeFromState) {
      setStore(storeFromState)
    }
  }, [location.state, setStore])

  // 매장이 선택되지 않았으면 / 로 리다이렉트
  useEffect(() => {
    const storeFromState = (location.state as { store?: Store })?.store
    if (!currentStore && !storeFromState) {
      navigate('/', { replace: true })
      return
    }
    if (currentStore) {
      loadStoreData(currentStore.id)
    } else if (storeFromState) {
      loadStoreData(storeFromState.id)
    }
  }, [currentStore, location.state, navigate, loadStoreData])

  // 선택된 매장의 사용자 목록 조회 (currentStore 또는 location.state.store 기준)
  const storeToUse = currentStore ?? (location.state as { store?: Store })?.store
  useEffect(() => {
    if (!storeToUse) return
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      const { data, error: e } = await supabase
        .from('users')
        .select('*')
        .eq('store_id', storeToUse.id)

      if (cancelled) return
      if (e) {
        setError(e.message)
        setUsers([])
      } else {
        setUsers((data ?? []).sort((a, b) => (a.avatar_name || '').localeCompare(b.avatar_name || '')))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [storeToUse?.id])

  const handleUserCardClick = (user: User) => {
    setSelectedUserForLogin(user)
    setShowPasswordModal(true)
    setPassword('')
    setPasswordError('')
  }

  const handlePasswordSubmit = async () => {
    if (!selectedUserForLogin) return
    if (!password.trim()) {
      setPasswordError('비밀번호를 입력해주세요')
      return
    }
    // TODO: 실제 배포 시 bcrypt로 password_hash 비교
    // 현재는 개발 모드로 4자 이상 입력 시 통과
    const isValidPassword = password.length >= 4
    if (!isValidPassword) {
      setPasswordError('비밀번호는 4자 이상이어야 합니다')
      return
    }
    console.log('🔐 비밀번호 입력:', password)
    console.log('✅ 검증 통과 (개발 모드)')

    try {
      const { error: authError } = await supabase.auth.signInAnonymously()
      if (authError) throw authError

      setCurrentUser(selectedUserForLogin)
      try {
        localStorage.setItem(CURRENT_USER_ID_KEY, selectedUserForLogin.id)
      } catch (_) {}

      setShowPasswordModal(false)
      setSelectedUserForLogin(null)
      setPassword('')
      setPasswordError('')

      alert(`${selectedUserForLogin.avatar_name}님, 환영합니다!`)

      setTimeout(() => {
        navigate('/level-select')
      }, 500)
    } catch (err) {
      setPasswordError('로그인 중 오류가 발생했습니다')
      console.error(err)
    }
  }

  const handleBack = () => {
    useGameStore.getState().setStore(null)
    navigate('/')
  }

  if (!currentStore && !storeToUse) return null

  const displayStore = currentStore ?? storeToUse

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center p-6">
      {/* 상단: 매장 이름 */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={handleBack}
          className="text-[#757575] hover:text-[#333] font-medium flex items-center gap-1"
        >
          ← 매장 선택
        </button>
        <h1 className="text-2xl font-bold text-[#333]">
          {displayStore?.store_name}
        </h1>
        <div className="w-20" />
      </div>

      <p className="text-[#757575] mb-6">사용자를 선택하세요</p>

      {loading && (
        <p className="text-[#757575] py-8">사용자 목록 불러오는 중...</p>
      )}

      {error && (
        <p className="text-red-500 mb-4" role="alert">
          연결 오류: {error}
        </p>
      )}

      {/* 중간: 사용자 카드 그리드 */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-2xl">
          {users.map((user, i) => (
            <motion.div
              key={user.id}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleUserCardClick(user)}
              onKeyDown={(e) => e.key === 'Enter' && handleUserCardClick(user)}
              className="cursor-pointer p-6 bg-white rounded-2xl border-2 border-[#E0E0E0] shadow-sm hover:shadow-lg hover:border-primary hover:bg-primary/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
            >
              <div className="text-4xl mb-2 flex justify-center">👤</div>
              <div className="font-bold text-[#333] text-center break-words">
                {user.avatar_name}
              </div>
              <div className="text-sm text-gray-500 text-center mt-1">
                클릭하여 로그인
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 비밀번호 입력 모달 */}
      {showPasswordModal && selectedUserForLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
            <h2 className="text-2xl font-bold mb-4 text-[#333]">
              {selectedUserForLogin.avatar_name} 로그인
            </h2>

            <div className="mb-4">
              <label htmlFor="login-password" className="block text-sm font-medium mb-2 text-[#333]">
                비밀번호
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                placeholder="비밀번호를 입력하세요"
                autoFocus
              />
            </div>

            {passwordError && (
              <div className="mb-4 text-red-600 text-sm">
                ❌ {passwordError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePasswordSubmit}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium transition"
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false)
                  setSelectedUserForLogin(null)
                  setPassword('')
                  setPasswordError('')
                }}
                className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400 font-medium transition"
              >
                취소
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-500">
              💡 개발 모드: 4자 이상 입력 시 로그인됩니다
            </div>
          </div>
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <p className="text-[#757575] py-8">등록된 사용자가 없습니다.</p>
      )}
    </div>
  )
}

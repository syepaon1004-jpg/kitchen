import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { isDevMode } from '../utils/env'
import { supabase } from '../lib/supabase'
import { useGameStore } from '../stores/gameStore'
import type { Store, User } from '../types/database.types'

const STORE_STORAGE_KEY = 'kitchen-simulator-last-store'
const CURRENT_USER_ID_KEY = 'currentUserId'

type LoginStep = 'STORE' | 'USER' | 'PASSWORD'

export default function LoginPage() {
  const navigate = useNavigate()
  const currentStore = useGameStore((s) => s.currentStore)
  const currentUser = useGameStore((s) => s.currentUser)
  const setStore = useGameStore((s) => s.setStore)
  const setCurrentUser = useGameStore((s) => s.setCurrentUser)
  const loadStoreData = useGameStore((s) => s.loadStoreData)

  // 이미 로그인 상태이면 /home으로 리다이렉트
  useEffect(() => {
    if (currentStore && currentUser) {
      navigate('/home', { replace: true })
    }
  }, [currentStore, currentUser, navigate])

  // --- Step tracking ---
  const [step, setStep] = useState<LoginStep>('STORE')

  // --- STORE step ---
  const [storeCode, setStoreCode] = useState('')
  const [store, setStoreLocal] = useState<Store | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [storeLoading, setStoreLoading] = useState(false)
  const [recentStore, setRecentStore] = useState<Store | null>(null)
  const [recentStoreLoading, setRecentStoreLoading] = useState(true)

  // --- Create store form ---
  const [showCreateStore, setShowCreateStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [newStoreCode, setNewStoreCode] = useState('')
  const [newStoreAddress, setNewStoreAddress] = useState('')
  const [newStorePhone, setNewStorePhone] = useState('')
  const [createStoreError, setCreateStoreError] = useState<string | null>(null)
  const [isCreatingStore, setIsCreatingStore] = useState(false)

  // --- USER step ---
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // --- Create user form ---
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newAvatarName, setNewAvatarName] = useState('')
  const [newRole, setNewRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF'>('STAFF')
  const [createUserError, setCreateUserError] = useState<string | null>(null)
  const [isCreatingUser, setIsCreatingUser] = useState(false)

  // --- PASSWORD step ---
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // --- 최근 매장 로드 ---
  useEffect(() => {
    const lastStoreId = localStorage.getItem(STORE_STORAGE_KEY)
    if (!lastStoreId) {
      setRecentStoreLoading(false)
      return
    }
    supabase
      .from('stores')
      .select('*')
      .eq('id', lastStoreId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRecentStore(data)
        setRecentStoreLoading(false)
      })
  }, [])

  // --- STORE: 매장 코드 조회 ---
  const handleStoreLookup = async () => {
    const code = storeCode.trim().toUpperCase()
    if (!code) {
      setStoreError('매장 코드를 입력해주세요')
      return
    }
    setStoreLoading(true)
    setStoreError(null)

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('store_code', code)
      .maybeSingle()

    setStoreLoading(false)

    if (error) {
      setStoreError(error.message)
      return
    }
    if (!data) {
      setStoreError('해당 매장 코드를 찾을 수 없습니다')
      return
    }

    selectStore(data)
  }

  const selectStore = (s: Store) => {
    setStoreLocal(s)
    setStoreError(null)
    setStep('USER')
    fetchUsers(s.id)
  }

  // --- USER: 사용자 목록 조회 ---
  const fetchUsers = async (storeId: string) => {
    setUsersLoading(true)
    setUsersError(null)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('store_id', storeId)

    if (error) {
      setUsersError(error.message)
      setUsers([])
    } else {
      setUsers((data ?? []).sort((a, b) => (a.avatar_name || '').localeCompare(b.avatar_name || '')))
    }
    setUsersLoading(false)
  }

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setPassword('')
    setPasswordError('')
    setStep('PASSWORD')
  }

  // --- PASSWORD: 로그인 ---
  const handleLogin = async () => {
    if (!selectedUser || !store) return
    if (!password.trim()) {
      setPasswordError('비밀번호를 입력해주세요')
      return
    }
    // TODO: 실제 배포 시 bcrypt로 password_hash 비교
    if (password.length < 4) {
      setPasswordError('비밀번호는 4자 이상이어야 합니다')
      return
    }

    setLoginLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInAnonymously()
      if (authError) throw authError

      setStore(store)
      await loadStoreData(store.id)
      setCurrentUser(selectedUser)

      try {
        localStorage.setItem(STORE_STORAGE_KEY, store.id)
        localStorage.setItem(CURRENT_USER_ID_KEY, selectedUser.id)
      } catch (_) {}

      navigate('/home')
    } catch (err) {
      setPasswordError('로그인 중 오류가 발생했습니다')
      console.error(err)
    } finally {
      setLoginLoading(false)
    }
  }

  // --- 매장 생성 ---
  const resetCreateStoreForm = () => {
    setNewStoreName('')
    setNewStoreCode('')
    setNewStoreAddress('')
    setNewStorePhone('')
    setCreateStoreError(null)
    setShowCreateStore(false)
  }

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) {
      setCreateStoreError('매장 이름을 입력해주세요')
      return
    }
    if (!newStoreCode.trim()) {
      setCreateStoreError('매장 코드를 입력해주세요')
      return
    }

    setIsCreatingStore(true)
    setCreateStoreError(null)

    const { data, error } = await supabase
      .from('stores')
      .insert({
        store_name: newStoreName.trim(),
        store_code: newStoreCode.trim().toUpperCase(),
        ...(newStoreAddress.trim() && { store_address: newStoreAddress.trim() }),
        ...(newStorePhone.trim() && { store_phone: newStorePhone.trim() }),
      })
      .select()
      .single()

    setIsCreatingStore(false)

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique') || error.code === '23505') {
        setCreateStoreError('이미 사용 중인 매장 코드입니다')
      } else {
        setCreateStoreError(error.message)
      }
      return
    }

    // 성공: 생성된 매장으로 진행
    try {
      localStorage.setItem(STORE_STORAGE_KEY, data.id)
    } catch (_) {}
    resetCreateStoreForm()
    selectStore(data)
  }

  // --- 사용자 생성 ---
  const resetCreateUserForm = () => {
    setNewUsername('')
    setNewAvatarName('')
    setNewRole('STAFF')
    setCreateUserError(null)
    setShowCreateUser(false)
  }

  const handleCreateUser = async () => {
    if (!store) return
    if (!newUsername.trim()) {
      setCreateUserError('사용자 이름을 입력해주세요')
      return
    }

    setIsCreatingUser(true)
    setCreateUserError(null)

    const { data, error } = await supabase
      .from('users')
      .insert({
        store_id: store.id,
        username: newUsername.trim(),
        avatar_name: newAvatarName.trim() || newUsername.trim(),
        role: newRole,
      })
      .select()
      .single()

    setIsCreatingUser(false)

    if (error) {
      setCreateUserError(error.message)
      return
    }

    setUsers(prev => [...prev, data].sort((a, b) => (a.avatar_name || '').localeCompare(b.avatar_name || '')))
    resetCreateUserForm()
  }

  // --- 뒤로가기 ---
  const goBackToStore = () => {
    setStep('STORE')
    setStoreLocal(null)
    setUsers([])
    setSelectedUser(null)
    setShowCreateUser(false)
  }

  const goBackToUser = () => {
    setStep('USER')
    setSelectedUser(null)
    setPassword('')
    setPasswordError('')
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col items-center justify-center p-6">
      <motion.h1
        className="text-3xl font-bold text-[#333] mb-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Kitchen Flow
      </motion.h1>
      <motion.p
        className="text-[#757575] mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        주방 시뮬레이션 훈련 플랫폼
      </motion.p>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {/* ===== STEP 1: STORE ===== */}
          {step === 'STORE' && (
            <motion.div
              key="store-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-xl border border-[#E0E0E0] shadow-md p-6">
                <h2 className="text-lg font-bold text-[#333] mb-4">매장 코드 입력</h2>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleStoreLookup()}
                    placeholder="매장 코드 (예: STORE001)"
                    className="flex-1 px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none font-mono text-lg"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleStoreLookup}
                    disabled={storeLoading}
                    className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark font-medium transition disabled:opacity-50"
                  >
                    {storeLoading ? '...' : '확인'}
                  </button>
                </div>

                {storeError && (
                  <p className="text-red-500 text-sm mt-2">{storeError}</p>
                )}

                <p className="text-xs text-[#9E9E9E] mt-2">영문 대문자 + 숫자만 입력 가능</p>
              </div>

              {/* 최근 매장 바로가기 */}
              {!recentStoreLoading && recentStore && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => selectStore(recentStore)}
                  className="w-full py-4 px-6 bg-white rounded-xl border border-[#E0E0E0] shadow-sm hover:shadow-md hover:border-primary transition text-left"
                >
                  <span className="text-sm text-[#757575]">최근 매장</span>
                  <div className="text-lg font-bold text-[#333] mt-1">{recentStore.store_name}</div>
                  <span className="text-xs text-[#9E9E9E] font-mono">{recentStore.store_code}</span>
                </motion.button>
              )}

              {/* 새 매장 만들기 */}
              <AnimatePresence>
                {!showCreateStore ? (
                  <motion.button
                    key="create-store-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowCreateStore(true)}
                    className="w-full py-3 px-6 rounded-xl border-2 border-dashed border-[#BDBDBD] text-[#757575] hover:border-primary hover:text-primary transition font-medium"
                  >
                    + 새 매장 만들기
                  </motion.button>
                ) : (
                  <motion.div
                    key="create-store-form"
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

                    {createStoreError && (
                      <p className="text-red-500 text-sm mt-3">{createStoreError}</p>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={handleCreateStore}
                        disabled={isCreatingStore}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCreatingStore ? '생성 중...' : '생성'}
                      </button>
                      <button
                        type="button"
                        onClick={resetCreateStoreForm}
                        disabled={isCreatingStore}
                        className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400 font-medium transition disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ===== STEP 2: USER ===== */}
          {step === 'USER' && store && (
            <motion.div
              key="user-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={goBackToStore}
                className="text-[#757575] hover:text-[#333] font-medium flex items-center gap-1 text-sm"
              >
                &lt; 다른 매장
              </button>

              <div className="bg-white rounded-xl border border-[#E0E0E0] shadow-md p-6">
                <h2 className="text-lg font-bold text-[#333] mb-1">{store.store_name}</h2>
                <p className="text-sm text-[#757575] mb-4">사용자를 선택하세요</p>

                {usersLoading && (
                  <p className="text-[#757575] py-4 text-center">불러오는 중...</p>
                )}

                {usersError && (
                  <p className="text-red-500 text-sm mb-4">오류: {usersError}</p>
                )}

                {!usersLoading && (
                  <div className="grid grid-cols-2 gap-3">
                    {users.map((user, i) => (
                      <motion.div
                        key={user.id}
                        role="button"
                        tabIndex={0}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => handleUserSelect(user)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUserSelect(user)}
                        className="cursor-pointer p-4 rounded-xl border-2 border-[#E0E0E0] hover:shadow-md hover:border-primary hover:bg-primary/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 text-center"
                      >
                        <div className="text-3xl mb-1">👤</div>
                        <div className="font-bold text-[#333] text-sm break-words">
                          {user.avatar_name}
                        </div>
                      </motion.div>
                    ))}

                    {/* 사용자 추가 카드 */}
                    <motion.div
                      role="button"
                      tabIndex={0}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: users.length * 0.04 }}
                      onClick={() => setShowCreateUser(true)}
                      onKeyDown={(e) => e.key === 'Enter' && setShowCreateUser(true)}
                      className="cursor-pointer p-4 rounded-xl border-2 border-dashed border-[#BDBDBD] hover:border-primary hover:bg-primary/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 flex flex-col items-center justify-center"
                    >
                      <div className="text-3xl mb-1 text-[#BDBDBD]">+</div>
                      <div className="font-medium text-[#757575] text-sm">추가</div>
                    </motion.div>
                  </div>
                )}

                {!usersLoading && !usersError && users.length === 0 && (
                  <p className="text-[#757575] py-4 text-center">등록된 사용자가 없습니다.</p>
                )}
              </div>

              {/* 사용자 생성 폼 */}
              <AnimatePresence>
                {showCreateUser && (
                  <motion.div
                    key="create-user-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white rounded-xl border border-[#E0E0E0] shadow-md p-6 overflow-hidden"
                  >
                    <h3 className="text-lg font-bold text-[#333] mb-4">사용자 추가</h3>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-sm font-medium text-[#333] mb-1">
                          사용자 이름 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="사용자 이름"
                          className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#333] mb-1">표시 이름</label>
                        <input
                          type="text"
                          value={newAvatarName}
                          onChange={(e) => setNewAvatarName(e.target.value)}
                          placeholder={newUsername || '비워두면 사용자 이름과 동일'}
                          className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#333] mb-1">역할</label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'MANAGER' | 'STAFF')}
                          className="w-full px-4 py-2 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none bg-white"
                        >
                          <option value="STAFF">STAFF (직원)</option>
                          <option value="MANAGER">MANAGER (관리자)</option>
                          <option value="ADMIN">ADMIN (어드민)</option>
                        </select>
                      </div>
                    </div>

                    {createUserError && (
                      <p className="text-red-500 text-sm mt-3">{createUserError}</p>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={handleCreateUser}
                        disabled={isCreatingUser}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCreatingUser ? '생성 중...' : '생성'}
                      </button>
                      <button
                        type="button"
                        onClick={resetCreateUserForm}
                        disabled={isCreatingUser}
                        className="flex-1 bg-gray-300 py-2 rounded-lg hover:bg-gray-400 font-medium transition disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ===== STEP 3: PASSWORD ===== */}
          {step === 'PASSWORD' && store && selectedUser && (
            <motion.div
              key="password-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={goBackToUser}
                className="text-[#757575] hover:text-[#333] font-medium flex items-center gap-1 text-sm"
              >
                &lt; 다른 사용자
              </button>

              <div className="bg-white rounded-xl border border-[#E0E0E0] shadow-md p-6">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">👤</div>
                  <h2 className="text-xl font-bold text-[#333]">{selectedUser.avatar_name}</h2>
                  <p className="text-sm text-[#757575]">{store.store_name}</p>
                </div>

                <div className="mb-4">
                  <label htmlFor="login-password" className="block text-sm font-medium mb-2 text-[#333]">
                    비밀번호
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-lg"
                    placeholder="비밀번호를 입력하세요"
                    autoFocus
                  />
                </div>

                {passwordError && (
                  <div className="mb-4 text-red-600 text-sm">{passwordError}</div>
                )}

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loginLoading}
                  className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-dark font-medium transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {loginLoading ? '로그인 중...' : '로그인'}
                </button>

                {isDevMode && (
                  <div className="mt-4 text-sm text-gray-500 text-center">
                    개발 모드: 4자 이상 입력 시 로그인됩니다
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

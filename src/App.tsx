import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AppHeader from './components/AppHeader'
import DebugPanel from './components/DebugPanel'
import StoreSelect from './pages/StoreSelect'
import UserLogin from './pages/UserLogin'
import LevelSelect from './pages/LevelSelect'
import GamePlay from './pages/GamePlay'
import GameResult from './pages/GameResult'

function App() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('stores').select('*').limit(1)
      if (error) {
        console.error('Supabase connection error:', error)
      } else {
        console.log('✅ Supabase connected! Stores:', data)
      }
    }
    testConnection()
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<StoreSelect />} />
          <Route path="/user-login" element={<UserLogin />} />
          <Route path="/level-select" element={<LevelSelect />} />
          <Route path="/game" element={<GamePlay />} />
          <Route path="/result" element={<GameResult />} />
          <Route path="/user" element={<Navigate to="/user-login" replace />} />
          <Route path="/level" element={<Navigate to="/level-select" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <DebugPanel />
    </div>
  )
}

export default App

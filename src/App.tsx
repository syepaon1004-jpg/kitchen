import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AppHeader from './components/AppHeader'
import DebugPanel from './components/DebugPanel'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import LevelSelect from './pages/LevelSelect'
import GamePlay from './pages/GamePlay'
import GameResult from './pages/GameResult'
import TestKitchen from './pages/TestKitchen'
import KitchenEditor from './pages/KitchenEditor'
import KitchenLayoutEditor from './pages/admin/KitchenLayoutEditor'
import RecipeEditor from './pages/admin/RecipeEditor'
import { isDevMode } from './utils/env'

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
          <Route path="/" element={<LoginPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/level-select" element={<LevelSelect />} />
          <Route path="/game" element={<GamePlay />} />
          <Route path="/result" element={<GameResult />} />
          <Route path="/test-kitchen" element={<TestKitchen />} />
          <Route path="/admin/kitchen-editor" element={<KitchenEditor />} />
          <Route path="/admin/kitchen" element={<KitchenLayoutEditor />} />
          <Route path="/admin/recipe" element={<RecipeEditor />} />
          <Route path="/user-login" element={<Navigate to="/" replace />} />
          <Route path="/user" element={<Navigate to="/" replace />} />
          <Route path="/level" element={<Navigate to="/level-select" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {isDevMode && <DebugPanel />}
    </div>
  )
}

export default App

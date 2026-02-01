import { useGameStore } from '../../stores/gameStore'

export default function SinkArea() {
  const { woks, washWok } = useGameStore()

  return (
    <div className="w-full p-4 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 border-2 border-gray-300 rounded-xl shadow-xl"
         style={{
           backgroundImage: `
             linear-gradient(135deg, 
               rgba(255,255,255,0.8) 0%, 
               rgba(200,200,200,0.3) 50%, 
               rgba(255,255,255,0.8) 100%)
           `,
           boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.9), 0 8px 20px rgba(0,0,0,0.15)'
         }}>
      <div className="text-xs font-bold text-gray-700 mb-3 px-2 py-1 bg-white/60 rounded text-center tracking-wider border border-gray-300">
        🚰 싱크대
      </div>
      <div className="w-full h-32 bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg shadow-inner border-2 border-gray-300 flex items-center justify-center relative overflow-hidden mb-3"
           style={{
             backgroundImage: `
               radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, transparent 70%),
               linear-gradient(to bottom, #eff6ff, #dbeafe, #bfdbfe)
             `,
             boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.1), inset 0 -2px 8px rgba(255,255,255,0.5)'
           }}>
        {/* 수도꼭지 */}
        <div className="absolute top-2 right-2 w-8 h-8 bg-gray-300 rounded-full shadow-md border-2 border-gray-400"
             style={{
               backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(150,150,150,0.4) 100%)'
             }}>
          <div className="absolute inset-1 bg-gray-200 rounded-full"></div>
        </div>
        <div className="text-5xl filter drop-shadow-lg">💧</div>
      </div>
      
      {/* 웍 씻기 버튼들 */}
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((n) => {
          const wok = woks.find((w) => w.burnerNumber === n)
          const canWash = wok && (wok.state === 'DIRTY' || wok.state === 'BURNED') && !wok.isOn
          return (
            <button
              key={n}
              disabled={!canWash}
              onClick={() => canWash && washWok(n)}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-md ${
                canWash 
                  ? 'bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-500 hover:to-cyan-600 text-white hover:shadow-lg' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              화구{n} {canWash ? '🧼 씻기' : '-'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

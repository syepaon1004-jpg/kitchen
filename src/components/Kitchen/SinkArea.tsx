import { useGameStore } from '../../stores/gameStore'

export default function SinkArea() {
  const { woks, washWok } = useGameStore()

  return (
    <div className="min-h-[600px] rounded-none bg-teal-500 flex flex-col p-4 shadow-inner text-white border-r border-teal-600">
      <h3 className="font-semibold mb-2 text-lg">싱크대</h3>
      <p className="text-sm opacity-90 mb-3">웍 씻기</p>
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((n) => {
          const wok = woks.find((w) => w.burnerNumber === n)
          const canWash = wok && (wok.state === 'DIRTY' || wok.state === 'BURNED') && !wok.isOn
          return (
            <button
              key={n}
              disabled={!canWash}
              onClick={() => canWash && washWok(n)}
              className={`py-2 px-3 rounded-lg text-sm font-medium ${
                canWash ? 'bg-white/25 hover:bg-white/40' : 'bg-white/10 opacity-50 cursor-not-allowed'
              }`}
            >
              화구{n} {canWash ? '씻기' : '-'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

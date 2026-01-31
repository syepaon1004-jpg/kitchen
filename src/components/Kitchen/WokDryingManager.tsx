import { useEffect } from 'react'
import { useGameStore } from '../../stores/gameStore'

const DRY_TIME_MS = 5000 // WET → CLEAN: 5초

export default function WokDryingManager() {
  const woks = useGameStore((s) => s.woks)
  const updateWok = useGameStore((s) => s.updateWok)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    woks.forEach((wok) => {
      // WET 상태 + 불 켜져있으면 말리기 시작
      if (wok.state === 'WET' && wok.isOn && wok.burnerOnSince) {
        const elapsed = Date.now() - wok.burnerOnSince
        const remaining = DRY_TIME_MS - elapsed

        if (remaining > 0) {
          const timer = setTimeout(() => {
            const currentWok = useGameStore.getState().woks.find((w) => w.burnerNumber === wok.burnerNumber)
            if (currentWok?.state === 'WET' && currentWok.isOn) {
              console.log(`화구${wok.burnerNumber}: 물기 마름! 불을 꺼주세요.`)
              updateWok(wok.burnerNumber, { state: 'CLEAN' })
              // 토스트 알림 (GamePlay에서 처리하도록 이벤트 발생 가능)
            }
          }, remaining)
          timers.push(timer)
        }
      }
    })

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [woks, updateWok])

  return null // 화면에 표시 안 함
}

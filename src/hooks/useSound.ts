import { useCallback, useRef, useEffect } from 'react'

// 효과음 타입
export type SoundType =
  | 'click'      // 일반 클릭
  | 'tap'        // 가벼운 탭
  | 'success'    // 성공/완료
  | 'error'      // 에러/실패
  | 'hover'      // 호버
  | 'select'     // 선택
  | 'confirm'    // 확인
  | 'cancel'     // 취소
  | 'add'        // 추가/투입
  | 'remove'     // 제거
  | 'stir'       // 볶기
  | 'serve'      // 서빙
  | 'wash'       // 씻기
  | 'fire_on'    // 불 켜기
  | 'fire_off'   // 불 끄기
  | 'warning'    // 경고
  | 'complete'   // 완료
  | 'menu_start' // 메뉴 시작

// Web Audio API를 사용한 효과음 생성
const createSound = (type: SoundType, audioContext: AudioContext) => {
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  const now = audioContext.currentTime

  switch (type) {
    case 'click':
      oscillator.frequency.setValueAtTime(800, now)
      oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.05)
      gainNode.gain.setValueAtTime(0.15, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
      oscillator.type = 'sine'
      break

    case 'tap':
      oscillator.frequency.setValueAtTime(600, now)
      oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.03)
      gainNode.gain.setValueAtTime(0.1, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03)
      oscillator.type = 'sine'
      break

    case 'hover':
      oscillator.frequency.setValueAtTime(500, now)
      gainNode.gain.setValueAtTime(0.05, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.02)
      oscillator.type = 'sine'
      break

    case 'select':
      oscillator.frequency.setValueAtTime(700, now)
      oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.08)
      gainNode.gain.setValueAtTime(0.12, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
      oscillator.type = 'sine'
      break

    case 'success':
      oscillator.frequency.setValueAtTime(600, now)
      oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.1)
      gainNode.gain.setValueAtTime(0.15, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      oscillator.type = 'sine'
      break

    case 'error':
      oscillator.frequency.setValueAtTime(300, now)
      oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.1)
      gainNode.gain.setValueAtTime(0.15, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      oscillator.type = 'sawtooth'
      break

    case 'confirm':
      oscillator.frequency.setValueAtTime(650, now)
      oscillator.frequency.exponentialRampToValueAtTime(850, now + 0.12)
      gainNode.gain.setValueAtTime(0.18, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      oscillator.type = 'sine'
      break

    case 'cancel':
      oscillator.frequency.setValueAtTime(500, now)
      oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.08)
      gainNode.gain.setValueAtTime(0.12, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
      oscillator.type = 'sine'
      break

    case 'add':
      oscillator.frequency.setValueAtTime(700, now)
      oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.1)
      gainNode.gain.setValueAtTime(0.15, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
      oscillator.type = 'triangle'
      break

    case 'remove':
      oscillator.frequency.setValueAtTime(600, now)
      oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1)
      gainNode.gain.setValueAtTime(0.12, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
      oscillator.type = 'triangle'
      break

    case 'stir':
      oscillator.frequency.setValueAtTime(400, now)
      oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.05)
      oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.1)
      gainNode.gain.setValueAtTime(0.15, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      oscillator.type = 'sawtooth'
      break

    case 'serve':
      oscillator.frequency.setValueAtTime(800, now)
      oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.15)
      gainNode.gain.setValueAtTime(0.2, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
      oscillator.type = 'sine'
      break

    case 'wash':
      oscillator.frequency.setValueAtTime(300, now)
      oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.2)
      gainNode.gain.setValueAtTime(0.1, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      oscillator.type = 'sine'
      break

    case 'fire_on':
      oscillator.frequency.setValueAtTime(200, now)
      oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.2)
      gainNode.gain.setValueAtTime(0.2, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      oscillator.type = 'sawtooth'
      break

    case 'fire_off':
      oscillator.frequency.setValueAtTime(800, now)
      oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.15)
      gainNode.gain.setValueAtTime(0.15, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
      oscillator.type = 'sine'
      break

    case 'warning':
      oscillator.frequency.setValueAtTime(800, now)
      oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.05)
      oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.1)
      gainNode.gain.setValueAtTime(0.2, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      oscillator.type = 'square'
      break

    case 'complete':
      oscillator.frequency.setValueAtTime(600, now)
      oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.1)
      oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.2)
      gainNode.gain.setValueAtTime(0.2, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      oscillator.type = 'sine'
      break

    case 'menu_start':
      oscillator.frequency.setValueAtTime(500, now)
      oscillator.frequency.exponentialRampToValueAtTime(700, now + 0.1)
      gainNode.gain.setValueAtTime(0.15, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      oscillator.type = 'triangle'
      break
  }

  oscillator.start(now)
  oscillator.stop(now + 0.2)
}

export const useSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const isMobileRef = useRef(window.innerWidth < 1024)
  const bgmNodesRef = useRef<{ oscillator: OscillatorNode; gainNode: GainNode }[]>([])
  const bgmIntervalRef = useRef<number | null>(null)

  // AudioContext 초기화
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (error) {
        console.warn('Web Audio API not supported:', error)
      }
    }
    return audioContextRef.current
  }, [])

  // 효과음 재생
  const playSound = useCallback((type: SoundType) => {
    // 모바일에서만 효과음 재생
    if (!isMobileRef.current) return

    const audioContext = initAudioContext()
    if (!audioContext) return

    // AudioContext가 suspended 상태면 resume
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    try {
      createSound(type, audioContext)
    } catch (error) {
      console.warn('Failed to play sound:', error)
    }
  }, [initAudioContext])

  // BGM 재생 (간단한 루프 멜로디)
  const startBGM = useCallback(() => {
    if (!isMobileRef.current) return

    const audioContext = initAudioContext()
    if (!audioContext || bgmIntervalRef.current) return

    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    // 간단한 멜로디 패턴 (주방 분위기)
    const melody = [
      { freq: 523.25, duration: 0.3 }, // C5
      { freq: 587.33, duration: 0.3 }, // D5
      { freq: 659.25, duration: 0.3 }, // E5
      { freq: 587.33, duration: 0.3 }, // D5
      { freq: 523.25, duration: 0.6 }, // C5
      { freq: 440.00, duration: 0.3 }, // A4
      { freq: 493.88, duration: 0.3 }, // B4
      { freq: 523.25, duration: 0.6 }, // C5
    ]

    let noteIndex = 0
    const playNote = () => {
      try {
        const note = melody[noteIndex]
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.setValueAtTime(note.freq, audioContext.currentTime)
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0.03, audioContext.currentTime) // 매우 낮은 볼륨
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.duration)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + note.duration)

        noteIndex = (noteIndex + 1) % melody.length
      } catch (error) {
        console.warn('Failed to play BGM note:', error)
      }
    }

    playNote()
    bgmIntervalRef.current = window.setInterval(playNote, 400)
  }, [initAudioContext])

  // BGM 정지
  const stopBGM = useCallback(() => {
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current)
      bgmIntervalRef.current = null
    }
    // 모든 BGM 노드 정리
    bgmNodesRef.current.forEach(({ oscillator, gainNode }) => {
      try {
        oscillator.stop()
        gainNode.disconnect()
      } catch (error) {
        // 이미 중지된 경우 무시
      }
    })
    bgmNodesRef.current = []
  }, [])

  // 컴포넌트 언마운트 시 BGM 정리
  useEffect(() => {
    return () => {
      stopBGM()
    }
  }, [stopBGM])

  return { playSound, startBGM, stopBGM }
}

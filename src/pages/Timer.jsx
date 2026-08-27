import { useState, useEffect, useRef } from 'react'

export default function Timer() {
  const [duration, setDuration] = useState(60)
  const [remaining, setRemaining] = useState(60)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef(null)
  const beepedRef = useRef(false)
  const audioCtxRef = useRef(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const unlockAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    // Play a silent blip to fully unlock audio on iOS
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
  }

  const playBeep = () => {
    try {
      const ctx = audioCtxRef.current
      if (!ctx) return
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.value = 880
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.error('Could not play sound', e)
    }
  }

  const startTimer = () => {
    unlockAudio()
    setIsRunning(true)
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1
        if (prev === 1 && !beepedRef.current) {
          playBeep()
          beepedRef.current = true
        }
        return next
      })
    }, 1000)
  }

  const pauseTimer = () => {
    setIsRunning(false)
    clearInterval(intervalRef.current)
  }

  const resetTimer = () => {
    setIsRunning(false)
    clearInterval(intervalRef.current)
    setRemaining(duration)
    beepedRef.current = false
  }

  const adjustDuration = (delta) => {
    if (isRunning) return
    const newDuration = Math.max(5, duration + delta)
    setDuration(newDuration)
    setRemaining(newDuration)
  }

  const formatTime = (secs) => {
    const isNegative = secs < 0
    const abs = Math.abs(secs)
    const mins = Math.floor(abs / 60)
    const s = abs % 60
    return `${isNegative ? '-' : ''}${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const isFresh = remaining === duration && !isRunning
  const isNegative = remaining < 0
  const progress = isNegative ? 0 : Math.max(0, Math.min(1, remaining / duration))

  const radius = 120
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="timer-page">
      <h1>Timer</h1>

      <div className="timer-ring-container">
        <svg width="280" height="280" viewBox="0 0 280 280">
          <circle
            cx="140"
            cy="140"
            r={radius}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="12"
          />
          <circle
            cx="140"
            cy="140"
            r={radius}
            fill="none"
            stroke={isNegative ? '#d90000' : '#00d9a3'}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 140 140)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
          />
        </svg>
        <div className="timer-display" style={{ color: isNegative ? '#d90000' : '#fff' }}>
          {formatTime(remaining)}
        </div>
      </div>

      {isFresh && (
        <div className="timer-adjust">
          <button className="control-btn" onClick={() => adjustDuration(-5)}>−</button>
          <span className="timer-duration-label">{formatTime(duration)}</span>
          <button className="control-btn" onClick={() => adjustDuration(5)}>+</button>
        </div>
      )}

      <div className="timer-buttons">
        <button className="cancel-btn timer-action-btn" onClick={resetTimer}>
          Cancel
        </button>
        {isRunning ? (
          <button className="timer-action-btn timer-pause-btn" onClick={pauseTimer}>
            Pause
          </button>
        ) : (
          <button className="timer-action-btn timer-start-btn" onClick={startTimer}>
            {isFresh ? 'Start' : 'Resume'}
          </button>
        )}
      </div>
    </div>
  )
}

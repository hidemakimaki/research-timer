import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const POMODORO_WORK = 25 * 60
const POMODORO_BREAK = 5 * 60
const STORAGE_KEY = 'research-timer-sessions'

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

function buildChartData(sessions) {
  const map = {}
  sessions.forEach(s => {
    const d = s.date
    map[d] = (map[d] || 0) + s.duration
  })
  const sorted = Object.keys(map).sort()
  const last7 = sorted.slice(-7)
  return last7.map(d => ({ date: formatDate(d), minutes: Math.round(map[d] / 60) }))
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px 12px' }}>
        <p style={{ fontSize: 13, color: '#555' }}>{label}</p>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#4f7cff' }}>{payload[0].value} 分</p>
      </div>
    )
  }
  return null
}

export default function App() {
  const [sessions, setSessions] = useState(loadSessions)
  const [mode, setMode] = useState('free') // 'free' | 'pomodoro'
  const [phase, setPhase] = useState('work') // 'work' | 'break'
  const [status, setStatus] = useState('idle') // 'idle' | 'running' | 'paused'
  const [elapsed, setElapsed] = useState(0)
  const [pomodoroLeft, setPomodoroLeft] = useState(POMODORO_WORK)
  const [sessionStart, setSessionStart] = useState(null)
  const [accumulatedWork, setAccumulatedWork] = useState(0)

  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)

  const today = toDateStr(new Date())
  const todayTotal = sessions
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + s.duration, 0)
  const chartData = buildChartData(sessions)

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    if (!startTimeRef.current) return
    const now = Date.now()
    const delta = Math.floor((now - startTimeRef.current) / 1000)

    if (mode === 'free') {
      setElapsed(prev => prev + 1)
    } else {
      const newLeft = pomodoroLeft - 1
      setPomodoroLeft(prev => {
        const next = prev - 1
        if (next <= 0) {
          clearInterval_()
          if (phase === 'work') {
            const worked = POMODORO_WORK
            setAccumulatedWork(w => w + worked)
            setPhase('break')
            setPomodoroLeft(POMODORO_BREAK)
          } else {
            setPhase('work')
            setPomodoroLeft(POMODORO_WORK)
          }
          setStatus('idle')
        }
        return Math.max(next, 0)
      })
    }
    startTimeRef.current = now
  }, [mode, phase, pomodoroLeft, clearInterval_])

  // Use a stable interval that reads latest tick via ref
  const tickRef = useRef(tick)
  useEffect(() => { tickRef.current = tick }, [tick])

  const start = useCallback(() => {
    if (status === 'running') return
    startTimeRef.current = Date.now()
    if (status === 'idle') {
      setSessionStart(new Date())
      if (mode === 'free') setElapsed(0)
    }
    setStatus('running')
    intervalRef.current = setInterval(() => tickRef.current(), 1000)
  }, [status, mode])

  const pause = useCallback(() => {
    if (status !== 'running') return
    clearInterval_()
    setStatus('paused')
  }, [status, clearInterval_])

  const stop = useCallback(() => {
    clearInterval_()
    const workSeconds = mode === 'free' ? elapsed : accumulatedWork + (phase === 'work' ? POMODORO_WORK - pomodoroLeft : 0)
    if (workSeconds > 0) {
      const newSession = {
        id: Date.now(),
        date: toDateStr(sessionStart || new Date()),
        startedAt: (sessionStart || new Date()).toISOString(),
        duration: workSeconds,
        mode,
      }
      const updated = [...sessions, newSession]
      setSessions(updated)
      saveSessions(updated)
    }
    setStatus('idle')
    setElapsed(0)
    setPomodoroLeft(POMODORO_WORK)
    setPhase('work')
    setAccumulatedWork(0)
    setSessionStart(null)
  }, [clearInterval_, elapsed, mode, accumulatedWork, phase, pomodoroLeft, sessions, sessionStart])

  const switchMode = useCallback((newMode) => {
    if (status !== 'idle') return
    setMode(newMode)
    setElapsed(0)
    setPomodoroLeft(POMODORO_WORK)
    setPhase('work')
    setAccumulatedWork(0)
  }, [status])

  useEffect(() => () => clearInterval_(), [clearInterval_])

  const isPomodoro = mode === 'pomodoro'
  const displayTime = isPomodoro ? pomodoroLeft : elapsed
  const progress = isPomodoro
    ? ((phase === 'work' ? POMODORO_WORK : POMODORO_BREAK) - pomodoroLeft) /
      (phase === 'work' ? POMODORO_WORK : POMODORO_BREAK)
    : 0

  const phaseColor = phase === 'work' ? '#4f7cff' : '#34c97e'
  const phaseLabel = phase === 'work' ? '作業中' : '休憩中'
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference * progress

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#222' }}>研究タイマー</h1>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['free', 'pomodoro'].map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            disabled={status !== 'idle'}
            style={{
              padding: '8px 20px',
              borderRadius: 20,
              border: 'none',
              cursor: status !== 'idle' ? 'not-allowed' : 'pointer',
              background: mode === m ? '#4f7cff' : '#e0e0e0',
              color: mode === m ? '#fff' : '#555',
              fontWeight: 600,
              fontSize: 14,
              transition: 'background 0.2s',
            }}
          >
            {m === 'free' ? '自由計測' : 'ポモドーロ'}
          </button>
        ))}
      </div>

      {/* Timer Card */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      }}>
        {isPomodoro && status !== 'idle' && (
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: phaseColor,
            background: phase === 'work' ? '#eef2ff' : '#e6faf3',
            padding: '4px 14px',
            borderRadius: 20,
          }}>
            {phaseLabel}
          </span>
        )}

        {isPomodoro ? (
          <svg width={180} height={180} viewBox="0 0 180 180">
            <circle cx={90} cy={90} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={10} />
            <circle
              cx={90} cy={90} r={radius}
              fill="none"
              stroke={phaseColor}
              strokeWidth={10}
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: 'stroke-dasharray 0.5s' }}
            />
            <text x={90} y={94} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 28, fontWeight: 700, fill: '#222', fontFamily: 'monospace' }}>
              {formatTime(displayTime)}
            </text>
          </svg>
        ) : (
          <div style={{ fontSize: 64, fontWeight: 700, fontFamily: 'monospace', color: '#222', letterSpacing: 2 }}>
            {formatTime(displayTime)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          {status === 'idle' && (
            <Btn onClick={start} color="#4f7cff">開始</Btn>
          )}
          {status === 'running' && (
            <>
              <Btn onClick={pause} color="#ff9f43">一時停止</Btn>
              <Btn onClick={stop} color="#ee5a24" outline>終了</Btn>
            </>
          )}
          {status === 'paused' && (
            <>
              <Btn onClick={start} color="#4f7cff">再開</Btn>
              <Btn onClick={stop} color="#ee5a24" outline>終了</Btn>
            </>
          )}
        </div>
      </div>

      {/* Today's Total */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '20px 28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, color: '#666' }}>今日の合計研究時間</span>
        <span style={{ fontSize: 26, fontWeight: 700, fontFamily: 'monospace', color: '#4f7cff' }}>
          {formatTime(todayTotal)}
        </span>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '24px 16px 16px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 16, paddingLeft: 8 }}>
            日別研究時間（分）
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#888' }} />
              <YAxis tick={{ fontSize: 12, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="minutes" fill="#4f7cff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Session History */}
      {sessions.length > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '24px 24px 16px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#444', marginBottom: 12 }}>
            セッション履歴
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...sessions].reverse().slice(0, 10).map(s => (
              <div key={s.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid #f5f5f5',
                fontSize: 14,
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: '#888' }}>{formatDate(s.date)}</span>
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: s.mode === 'pomodoro' ? '#eef2ff' : '#f5f5f5',
                    color: s.mode === 'pomodoro' ? '#4f7cff' : '#888',
                  }}>
                    {s.mode === 'pomodoro' ? 'ポモドーロ' : '自由'}
                  </span>
                </div>
                <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#333' }}>
                  {formatTime(s.duration)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Btn({ children, onClick, color, outline }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 28px',
        borderRadius: 8,
        border: outline ? `2px solid ${color}` : 'none',
        background: outline ? 'transparent' : color,
        color: outline ? color : '#fff',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {children}
    </button>
  )
}

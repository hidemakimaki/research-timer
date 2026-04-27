import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase } from './supabaseClient'
import LogView from './LogView'
import AdminPage from './AdminPage'
import { validateDisplayName } from './validateDisplayName'

const POMODORO_WORK = 25 * 60
const POMODORO_BREAK = 5 * 60
const STORAGE_KEY = 'research-timer-sessions'
const LEGENDARY_KEY = 'research-timer-legendary'
const POINTS_KEY = 'research-timer-points'

function loadLegendaryHistory() {
  try {
    return JSON.parse(localStorage.getItem(LEGENDARY_KEY) || '[]')
  } catch { return [] }
}

function loadPointsData() {
  try { return JSON.parse(localStorage.getItem(POINTS_KEY) || '[]') }
  catch { return [] }
}

// 50分ボーナス絵文字のロール
function roll50Emoji() {
  const r = Math.random() * 100
  if (r < 20) return '🎁'
  if (r < 50) return '⚡️'
  return '🐤'
}

function get50Bonus(emoji) {
  if (emoji === '🎁') return 3   // スーパーレア
  if (emoji === '⚡️') return 2  // レア
  return 1                        // ノーマル: 🐤
}

function get100Bonus(emoji) {
  if (['🌟', '🌍'].includes(emoji)) return 5   // スーパーレア
  if (['🦖', '🚀'].includes(emoji)) return 4   // レア
  return 3                                       // ノーマル: 🌊, 🧸
}

const FAVORITE_WORDS = [
  '人は自ら掴んだ本質しか、腹に落ちんのだ',
  'その努力の先に神が宿るから',
  '「審判の誤審」に惑わされてしまった',
  '少しの違いに歴戦の違いが宿る',
  '不正解は無意味を意味しない。',
]

// ポモドーロ終了: 2回連続再生
function playWorkChime() {
  const a = new Audio('/pomodoro-end.mp3')
  a.play().catch(() => {})
  a.addEventListener('ended', () => {
    const a2 = new Audio('/pomodoro-end.mp3')
    a2.play().catch(() => {})
  })
}

// 休憩終了: 1回再生
function playBreakChime() {
  const a = new Audio('/break-end.mp3')
  a.play().catch(() => {})
}

function loadLocalSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
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
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

function RandomWord() {
  const [word, setWord] = useState(() =>
    FAVORITE_WORDS[Math.floor(Math.random() * FAVORITE_WORDS.length)]
  )

  const shuffle = () => {
    const next = FAVORITE_WORDS[Math.floor(Math.random() * FAVORITE_WORDS.length)]
    setWord(next)
  }

  return (
    <div
      onClick={shuffle}
      style={{
        marginTop: 8,
        padding: '20px 24px',
        textAlign: 'center',
        color: '#333',
        fontSize: 14,
        fontStyle: 'italic',
        cursor: 'pointer',
        userSelect: 'none',
        letterSpacing: '0.03em',
        lineHeight: 1.7,
      }}
      title="クリックで切り替え"
    >
      {word}
    </div>
  )
}

export default function TimerApp({ user, profile, isAdmin = false, onProfileChange }) {
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [localData, setLocalData] = useState(loadLocalSessions)
  const [migrating, setMigrating] = useState(false)
  const [legendaryHistory, setLegendaryHistory] = useState(loadLegendaryHistory)
  const [pointsData, setPointsData] = useState(loadPointsData)
  const [fiftyEmoji, setFiftyEmoji] = useState(() => {
    const todayStr = toDateStr(new Date())
    return loadPointsData().find(r => r.date === todayStr)
      ?.milestones?.find(m => m.level === 50)?.bonusEmoji || null
  })

  const [mode, setMode] = useState('free')
  const [phase, setPhase] = useState('work')
  const [status, setStatus] = useState('idle')
  const [elapsed, setElapsed] = useState(0)
  const [pomodoroLeft, setPomodoroLeft] = useState(POMODORO_WORK)
  const [sessionStart, setSessionStart] = useState(null)
  const [accumulatedWork, setAccumulatedWork] = useState(0)
  const [bgMusic, setBgMusic] = useState('off')
  const [view, setView] = useState('timer')
  const [alarmMessage, setAlarmMessage] = useState(null)

  const intervalRef = useRef(null)
  const runStartRef = useRef(null)    // Date.now() when current run segment began
  const baseElapsedRef = useRef(0)    // free: seconds accumulated before current run
  const baseLeftRef = useRef(POMODORO_WORK) // pomodoro: seconds left at start of current run
  const sessionStartRef = useRef(null)
  const userIdRef = useRef(user.id)
  const communityIdRef = useRef(profile?.community_id ?? null)
  const musicRef = useRef(null)
  const musicKeyRef = useRef('off')
  const pendingAlarmRef = useRef(null) // 'work' | 'break' | null — pending alarm to retry on visibility
  const achievedRef = useRef(null)    // { [dateStr]: Set<'25'|'50'|'100'> } — prevents double-awarding

  // Load sessions from Supabase
  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
    if (data) setSessions(data)
    setSessionsLoading(false)
  }, [user.id])

  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => { sessionStartRef.current = sessionStart }, [sessionStart])

  // Migrate localStorage data to Supabase
  const migrateLocalData = async () => {
    if (localData.length === 0) return
    setMigrating(true)
    const inserts = localData.map(s => ({
      user_id: user.id,
      date: s.date,
      started_at: s.startedAt || new Date().toISOString(),
      duration: s.duration,
      mode: s.mode || 'free',
      community_id: communityIdRef.current,
    }))
    const { error } = await supabase.from('sessions').insert(inserts)
    if (!error) {
      localStorage.removeItem(STORAGE_KEY)
      setLocalData([])
      await fetchSessions()
    }
    setMigrating(false)
  }

  const today = toDateStr(new Date())
  const todayTotal = sessions
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + s.duration, 0)
  const chartData = buildChartData(sessions)

  const milestone = todayTotal >= 100 * 60
    ? { label: 'Legendary!', bg: '#fff0f0' }
    : todayTotal >= 50 * 60
    ? { label: 'Great work!', bg: '#f0f4ff' }
    : todayTotal >= 25 * 60
    ? { label: 'Good!', bg: '#f0fff4' }
    : null

  const isLegendary = todayTotal >= 100 * 60
  const legendaryEmoji = useMemo(() => {
    if (!isLegendary) return ''
    const EMOJIS = [
      { e: '🌟', w: 10 },
      { e: '🌍', w: 10 },
      { e: '🦖', w: 15 },
      { e: '🚀', w: 15 },
      { e: '🌊', w: 20 },
      { e: '🧸', w: 30 },
    ]
    let r = Math.random() * 100
    for (const { e, w } of EMOJIS) {
      r -= w
      if (r <= 0) return e
    }
    return '🧸'
  }, [isLegendary])

  // Record legendary emoji once per day when milestone is first reached
  useEffect(() => {
    if (!isLegendary || !legendaryEmoji) return
    const todayStr = toDateStr(new Date())
    setLegendaryHistory(prev => {
      if (prev.some(e => e.date === todayStr)) return prev
      const updated = [...prev, { date: todayStr, emoji: legendaryEmoji }]
      localStorage.setItem(LEGENDARY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [isLegendary, legendaryEmoji])

  // Award points when daily milestones are crossed (25 / 50 / 100 min)
  useEffect(() => {
    const todayStr = toDateStr(new Date())
    // Lazy-init achievedRef from localStorage so page refreshes don't double-award
    if (achievedRef.current === null) {
      achievedRef.current = {}
      loadPointsData().forEach(({ date, milestones }) => {
        achievedRef.current[date] = new Set(milestones.map(m => String(m.level)))
      })
    }
    if (!achievedRef.current[todayStr]) achievedRef.current[todayStr] = new Set()
    const done = achievedRef.current[todayStr]
    const newMilestones = []

    if (todayTotal >= 25 * 60 && !done.has('25')) {
      done.add('25')
      newMilestones.push({ level: 25, base: 3, bonusEmoji: null, bonusPoints: 0 })
    }
    if (todayTotal >= 50 * 60 && !done.has('50')) {
      done.add('50')
      const emoji = roll50Emoji()
      setFiftyEmoji(emoji)
      newMilestones.push({ level: 50, base: 2, bonusEmoji: emoji, bonusPoints: get50Bonus(emoji) })
    }
    if (todayTotal >= 100 * 60 && !done.has('100') && legendaryEmoji) {
      done.add('100')
      newMilestones.push({ level: 100, base: 3, bonusEmoji: legendaryEmoji, bonusPoints: get100Bonus(legendaryEmoji) })
    }

    if (newMilestones.length === 0) return

    setPointsData(prev => {
      const idx = prev.findIndex(r => r.date === todayStr)
      const updated = [...prev]
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], milestones: [...updated[idx].milestones, ...newMilestones] }
      } else {
        updated.push({ date: todayStr, milestones: newMilestones })
      }
      localStorage.setItem(POINTS_KEY, JSON.stringify(updated))
      return updated
    })

    // Supabase にも保存してランキングへ反映（失敗しても動作に影響しない）
    supabase.from('daily_points').upsert(
      newMilestones.map(m => ({
        user_id: userIdRef.current,
        date: todayStr,
        level: m.level,
        base_points: m.base,
        bonus_emoji: m.bonusEmoji,
        bonus_points: m.bonusPoints,
        community_id: communityIdRef.current,
      })),
      { onConflict: 'user_id,date,level' }
    ).then(({ error }) => { if (error) console.warn('daily_points save failed:', error) })
  }, [todayTotal, legendaryEmoji])

  const totalPoints = useMemo(
    () => pointsData.reduce((sum, { milestones }) =>
      sum + milestones.reduce((s, m) => s + m.base + m.bonusPoints, 0), 0),
    [pointsData]
  )

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    if (!runStartRef.current) return
    const secondsIntoRun = Math.floor((Date.now() - runStartRef.current) / 1000)

    if (mode === 'free') {
      setElapsed(baseElapsedRef.current + secondsIntoRun)
    } else {
      const newLeft = baseLeftRef.current - secondsIntoRun
      if (newLeft <= 0) {
        clearInterval_()
        if (phase === 'work') {
          pendingAlarmRef.current = 'work'
          setAlarmMessage('⏰ 作業終了！ 休憩に入りましょう')
          document.title = '⏰ ポモドーロ終了！'
          playWorkChime()
        } else {
          pendingAlarmRef.current = 'break'
          setAlarmMessage('⏰ 休憩終了！ 次のポモドーロを始めましょう')
          document.title = '⏰ 休憩終了！'
          playBreakChime()
        }
        if (phase === 'work') {
          // Save completed Pomodoro session immediately
          const start = sessionStartRef.current || new Date()
          supabase.from('sessions').insert({
            user_id: userIdRef.current,
            date: toDateStr(start),
            started_at: start.toISOString(),
            duration: POMODORO_WORK,
            mode: 'pomodoro',
            community_id: communityIdRef.current,
          }).select().single().then(({ data }) => {
            if (data) setSessions(prev => [data, ...prev])
          })
          setPhase('break')
          setPomodoroLeft(POMODORO_BREAK)
          // Auto-start break timer
          baseLeftRef.current = POMODORO_BREAK
          runStartRef.current = Date.now()
          setStatus('running')
          intervalRef.current = setInterval(() => tickRef.current(), 1000)
        } else {
          runStartRef.current = null
          setPhase('work')
          setPomodoroLeft(POMODORO_WORK)
          setStatus('idle')
        }
      } else {
        setPomodoroLeft(newLeft)
      }
    }
  }, [mode, phase, clearInterval_])

  const tickRef = useRef(tick)
  useEffect(() => { tickRef.current = tick }, [tick])

  const start = useCallback(() => {
    if (status === 'running') return
    pendingAlarmRef.current = null
    setAlarmMessage(null)
    document.title = '研究タイマー'
    runStartRef.current = Date.now()
    if (status === 'idle') {
      setSessionStart(new Date())
      if (mode === 'free') {
        setElapsed(0)
        baseElapsedRef.current = 0
      } else {
        baseLeftRef.current = pomodoroLeft
      }
    } else {
      // resuming from pause: pick up from current displayed values
      baseElapsedRef.current = elapsed
      baseLeftRef.current = pomodoroLeft
    }
    setStatus('running')
    intervalRef.current = setInterval(() => tickRef.current(), 1000)
  }, [status, mode, elapsed, pomodoroLeft])

  const pause = useCallback(() => {
    if (status !== 'running') return
    clearInterval_()
    // Sync state to exact current time before freezing
    if (runStartRef.current) {
      const s = Math.floor((Date.now() - runStartRef.current) / 1000)
      if (mode === 'free') {
        setElapsed(baseElapsedRef.current + s)
      } else {
        setPomodoroLeft(prev => Math.max(0, baseLeftRef.current - s))
      }
      runStartRef.current = null
    }
    setStatus('paused')
  }, [status, clearInterval_, mode])

  const stop = useCallback(async () => {
    clearInterval_()
    // Get accurate time (may be mid-interval when stop is pressed)
    const finalElapsed = runStartRef.current
      ? baseElapsedRef.current + Math.floor((Date.now() - runStartRef.current) / 1000)
      : elapsed
    const finalLeft = runStartRef.current
      ? Math.max(0, baseLeftRef.current - Math.floor((Date.now() - runStartRef.current) / 1000))
      : pomodoroLeft
    runStartRef.current = null
    const workSeconds = mode === 'free'
      ? finalElapsed
      : accumulatedWork + (phase === 'work' ? POMODORO_WORK - finalLeft : 0)

    if (workSeconds > 0) {
      const { data } = await supabase
        .from('sessions')
        .insert({
          user_id: userIdRef.current,
          date: toDateStr(sessionStart || new Date()),
          started_at: (sessionStart || new Date()).toISOString(),
          duration: workSeconds,
          mode,
          community_id: communityIdRef.current,
        })
        .select()
        .single()
      if (data) setSessions(prev => [data, ...prev])
    }

    pendingAlarmRef.current = null
    setAlarmMessage(null)
    document.title = '研究タイマー'
    setStatus('idle')
    setElapsed(0)
    setPomodoroLeft(POMODORO_WORK)
    setPhase('work')
    setAccumulatedWork(0)
    setSessionStart(null)
  }, [clearInterval_, elapsed, mode, accumulatedWork, phase, pomodoroLeft, sessionStart, user.id])

  const switchMode = useCallback((newMode) => {
    if (status !== 'idle') return
    setMode(newMode)
    setElapsed(0)
    setPomodoroLeft(POMODORO_WORK)
    setPhase('work')
    setAccumulatedWork(0)
  }, [status])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  useEffect(() => () => clearInterval_(), [clearInterval_])

  // Background music — plays only during Pomodoro work phase
  useEffect(() => {
    const shouldPlay = status === 'running' && bgMusic !== 'off' && (mode === 'free' || phase === 'work')
    if (!shouldPlay) {
      musicRef.current?.pause()
      return
    }
    const MUSIC_SRC = { ice: '/ice3.m4a', fire: '/fire.mp3' }
    if (!musicRef.current || musicKeyRef.current !== bgMusic) {
      musicRef.current?.pause()
      const audio = new Audio(MUSIC_SRC[bgMusic])
      audio.loop = true
      audio.volume = 0.4
      audio.addEventListener('ended', () => {
        audio.currentTime = 0
        audio.play().catch(() => {})
      })
      musicRef.current = audio
      musicKeyRef.current = bgMusic
    }
    musicRef.current.play().catch(() => {})
  }, [status, phase, mode, bgMusic])

  useEffect(() => () => { musicRef.current?.pause() }, [])

  useEffect(() => {
    document.body.style.background = milestone?.bg || '#f5f5f5'
    return () => { document.body.style.background = '' }
  }, [milestone?.bg])

  // Recalculate immediately when screen wakes from standby; retry alarm if pending
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Replay alarm if it fired while page was hidden/audio was suspended
        if (pendingAlarmRef.current === 'work') playWorkChime()
        else if (pendingAlarmRef.current === 'break') playBreakChime()
        tickRef.current()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#222' }}>研究タイマー</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#aaa' }}>{profile?.display_name || user.email}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 14px',
              border: '1.5px solid #e0e0e0',
              borderRadius: 6,
              background: '#fff',
              color: '#777',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* Migration Banner */}
      {view === 'timer' && localData.length > 0 && (
        <div style={{
          background: '#fffbe6',
          border: '1px solid #ffe58f',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <p style={{ fontSize: 13, color: '#7d6300', margin: 0 }}>
            このデバイスに {localData.length} 件のローカル記録があります。クラウドに移行しますか？
          </p>
          <button
            onClick={migrateLocalData}
            disabled={migrating}
            style={{
              padding: '6px 16px',
              background: migrating ? '#aaa' : '#4f7cff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: migrating ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {migrating ? '移行中...' : 'クラウドに移行'}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['free', 'pomodoro'].map(m => (
          <button
            key={m}
            onClick={() => { setView('timer'); switchMode(m) }}
            style={{
              padding: '8px 20px',
              borderRadius: 20,
              border: 'none',
              cursor: status !== 'idle' && view === 'timer' ? 'not-allowed' : 'pointer',
              background: view === 'timer' && mode === m ? '#4f7cff' : '#e0e0e0',
              color: view === 'timer' && mode === m ? '#fff' : '#555',
              fontWeight: 600,
              fontSize: 14,
              transition: 'background 0.2s',
            }}
          >
            {m === 'free' ? '自由計測' : 'ポモドーロ'}
          </button>
        ))}
        <button
          onClick={() => setView('log')}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: view === 'log' ? '#4f7cff' : '#e0e0e0',
            color: view === 'log' ? '#fff' : '#555',
            fontWeight: 600,
            fontSize: 14,
            transition: 'background 0.2s',
          }}
        >
          ログ
        </button>
        <button
          onClick={() => setView('settings')}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: view === 'settings' ? '#4f7cff' : '#e0e0e0',
            color: view === 'settings' ? '#fff' : '#555',
            fontWeight: 600,
            fontSize: 14,
            transition: 'background 0.2s',
          }}
        >
          設定
        </button>
        {isAdmin && (
          <button
            onClick={() => setView('admin')}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: view === 'admin' ? '#ee5a24' : '#e0e0e0',
              color: view === 'admin' ? '#fff' : '#555',
              fontWeight: 600,
              fontSize: 14,
              transition: 'background 0.2s',
            }}
          >
            管理
          </button>
        )}
      </div>

      {view === 'log' && <LogView sessions={sessions} legendaryHistory={legendaryHistory} totalPoints={totalPoints} displayName={profile?.display_name} communityId={profile?.community_id ?? null} />}
      {view === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SettingsCard user={user} profile={profile} onProfileSaved={onProfileChange} />
          <PostCard user={user} profile={profile} />
        </div>
      )}
      {view === 'admin' && isAdmin && <AdminPage />}

      {view === 'timer' && <>

      {/* Milestone label */}
      {milestone && (
        <div style={{
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 700,
          color: '#444',
          letterSpacing: '0.04em',
        }}>
          {milestone.label}
          {isLegendary && legendaryEmoji && ` ${legendaryEmoji}`}
          {!isLegendary && todayTotal >= 50 * 60 && fiftyEmoji && ` ${fiftyEmoji}`}
        </div>
      )}

      {/* Alarm Banner */}
      {alarmMessage && (
        <div style={{
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: 12,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          animation: 'pulse 1s infinite',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#856404' }}>{alarmMessage}</span>
          <button
            onClick={() => {
              pendingAlarmRef.current = null
              setAlarmMessage(null)
              document.title = '研究タイマー'
            }}
            style={{
              padding: '6px 16px',
              background: '#ffc107',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            OK
          </button>
        </div>
      )}

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

        <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'off',  label: 'off'  },
              { key: 'ice',  label: '❄️ ice'  },
              { key: 'fire', label: '🔥 fire' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setBgMusic(key)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  background: bgMusic === key ? '#4f7cff' : '#e8e8e8',
                  color: bgMusic === key ? '#fff' : '#666',
                  fontWeight: 600,
                  fontSize: 13,
                  transition: 'background 0.2s',
                }}
              >
                {label}
              </button>
            ))}
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
      {!sessionsLoading && chartData.length > 0 && (
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
      {!sessionsLoading && sessions.length > 0 && (
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
            {sessions.slice(0, 10).map(s => (
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

      <RandomWord />

      </>}
    </div>
  )
}

function SettingsCard({ user, profile, onProfileSaved }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [communityId, setCommunityId] = useState(profile?.community_id || '')
  const [joinPassword, setJoinPassword] = useState('')
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.from('communities').select('id, name, requires_password').order('name').then(({ data }) => {
      if (data) setCommunities(data)
    })
  }, [])

  const selectedCommunity = communities.find(c => c.id === communityId)
  const isChangingCommunity = communityId !== (profile?.community_id || '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    const nameError = validateDisplayName(displayName)
    if (nameError) { setError(nameError); return }
    if (!communityId) { setError('コミュニティを選択してください'); return }

    if (isChangingCommunity && selectedCommunity?.requires_password) {
      const { data: valid } = await supabase.rpc('verify_community_password', {
        p_community_id: communityId,
        p_password: joinPassword,
      })
      if (!valid) { setError('コミュニティのパスワードが正しくありません'); return }
    }

    setLoading(true)
    const { data, error: dbError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName.trim(), community_id: communityId, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (dbError) {
      setError('保存に失敗しました。再度お試しください。')
    } else {
      onProfileSaved(data)
      setSuccess(true)
      setJoinPassword('')
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #eef2ff 0%, #e8f4fd 100%)',
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(79,124,255,0.10)',
      border: '1.5px solid #c7d8fa',
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#3a5fc8', marginBottom: 16 }}>設定変更</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={settingsLabel}>表示名</label>
          <input
            type="text"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setSuccess(false) }}
            required
            style={settingsInput}
            placeholder="例: 研究者タロウ"
            maxLength={25}
          />
          <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>3〜20文字・日本語英数字OK・絵文字2個まで</p>
        </div>
        <div>
          <label style={settingsLabel}>コミュニティ</label>
          <select
            value={communityId}
            onChange={e => { setCommunityId(e.target.value); setJoinPassword(''); setSuccess(false) }}
            required
            style={{ ...settingsInput, color: communityId ? '#333' : '#aaa' }}
          >
            <option value="">選択してください</option>
            {communities.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {isChangingCommunity && selectedCommunity?.requires_password && (
          <div>
            <label style={settingsLabel}>コミュニティパスワード</label>
            <input
              type="password"
              value={joinPassword}
              onChange={e => { setJoinPassword(e.target.value); setSuccess(false) }}
              required
              style={settingsInput}
              placeholder="パスワードを入力"
            />
          </div>
        )}
        {error && (
          <p style={{ fontSize: 13, color: '#ee5a24', background: '#fff5f2', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
            {error}
          </p>
        )}
        {success && (
          <p style={{ fontSize: 13, color: '#34c97e', background: '#f0fdf8', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
            保存しました
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '11px 0',
            background: loading ? '#a0b4ff' : '#4f7cff',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '保存中...' : '設定を変更する'}
        </button>
      </form>
    </div>
  )
}

const settingsLabel = {
  fontSize: 13,
  fontWeight: 600,
  color: '#555',
  display: 'block',
  marginBottom: 5,
}

const settingsInput = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e0e0e0',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

function PostCard({ user, profile }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    setError('')
    setSuccess(false)
    setLoading(true)
    const { error: dbError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        display_name: profile?.display_name || null,
        content: content.trim(),
      })
    if (dbError) {
      setError('投稿に失敗しました。再度お試しください。')
    } else {
      setContent('')
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#444', marginBottom: 8 }}>ポスト</h2>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>アプリに対するご意見を自由にどうぞ。漫画や偉人の名言も募集します。</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          value={content}
          onChange={e => { setContent(e.target.value); setSuccess(false) }}
          rows={4}
          maxLength={500}
          placeholder="ご意見・ご要望をお書きください"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1.5px solid #e0e0e0',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 12, color: '#bbb', textAlign: 'right', marginTop: -8 }}>{content.length}/500</span>
        {error && (
          <p style={{ fontSize: 13, color: '#ee5a24', background: '#fff5f2', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
            {error}
          </p>
        )}
        {success && (
          <p style={{ fontSize: 13, color: '#34c97e', background: '#f0fdf8', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
            投稿しました。ありがとうございます！
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !content.trim()}
          style={{
            padding: '11px 0',
            background: loading || !content.trim() ? '#c5d0f0' : '#4f7cff',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 15,
            cursor: loading || !content.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '投稿中...' : '投稿する'}
        </button>
      </form>
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

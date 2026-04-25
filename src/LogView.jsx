import { useState } from 'react'

const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const DOW = ['日','月','火','水','木','金','土']

function logFormatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

function getMark(secs) {
  if (secs >= 100 * 60) return 'legendary'
  if (secs >= 50 * 60) return 'great'
  if (secs >= 25 * 60) return 'good'
  return null
}

export default function LogView({ sessions }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  // Aggregate all sessions by date
  const sessionMap = {}
  sessions.forEach(s => {
    sessionMap[s.date] = (sessionMap[s.date] || 0) + s.duration
  })

  // Build calendar grid
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // Monthly stats
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthEntries = Object.entries(sessionMap).filter(([d]) => d.startsWith(monthPrefix))
  const monthTotal = monthEntries.reduce((sum, [, s]) => sum + s, 0)
  const achieveDays = monthEntries.filter(([, s]) => s >= 25 * 60).length

  const todayStr = now.toISOString().slice(0, 10)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={prevMonth} style={navBtn}>＜</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#222' }}>
          {year}年 {MONTH_NAMES[month]}
        </span>
        <button onClick={nextMonth} style={navBtn}>＞</button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={statCard}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>達成日数</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4f7cff' }}>
            {achieveDays}<span style={{ fontSize: 14, fontWeight: 400 }}>日</span>
          </div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>月間累計</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4f7cff' }}>
            {logFormatTime(monthTotal)}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '16px 8px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
        {/* Day-of-week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {DOW.map((d, i) => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 600,
              paddingBottom: 4,
              color: i === 0 ? '#ee5a24' : i === 6 ? '#4f7cff' : '#999',
            }}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {week.map((day, di) => {
              const dateStr = day
                ? `${monthPrefix}-${String(day).padStart(2, '0')}`
                : null
              const secs = dateStr ? (sessionMap[dateStr] || 0) : 0
              const mark = day ? getMark(secs) : null
              const isToday = dateStr === todayStr
              const dayColor = di === 0 ? '#ee5a24' : di === 6 ? '#4f7cff' : '#333'
              const markColor = mark === 'legendary' ? '#4f7cff' : '#444'

              return (
                <div key={di} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '4px 0',
                  minHeight: 54,
                }}>
                  <div style={{
                    width: 26, height: 26,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isToday ? '#4f7cff' : 'transparent',
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#fff' : (day ? dayColor : 'transparent'),
                  }}>
                    {day || ''}
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1, marginTop: 3, color: markColor }}>
                    {mark === 'legendary' && '◎'}
                    {mark === 'great' && '◎'}
                    {mark === 'good' && '◯'}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12, color: '#888' }}>
        <span>◯ 25分+</span>
        <span style={{ color: '#444' }}>◎ 50分+</span>
        <span style={{ color: '#4f7cff' }}>◎ 100分+</span>
      </div>

    </div>
  )
}

const navBtn = {
  background: 'none',
  border: '1.5px solid #e0e0e0',
  borderRadius: 8,
  padding: '6px 16px',
  fontSize: 15,
  cursor: 'pointer',
  color: '#555',
}

const statCard = {
  flex: 1,
  background: '#fff',
  borderRadius: 12,
  padding: '14px 16px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  textAlign: 'center',
}

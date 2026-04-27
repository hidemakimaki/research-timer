import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

export default function LogView({ sessions, legendaryHistory = [], totalPoints = 0, displayName = '', communityId = null }) {
  const [weeklyRanking, setWeeklyRanking] = useState(null)  // null = loading
  const [monthlyRanking, setMonthlyRanking] = useState(null)
  const [communities, setCommunities] = useState([])

  useEffect(() => {
    supabase.from('communities').select('id, name').order('name').then(({ data }) => {
      if (data) setCommunities(data)
    })
  }, [])

  const currentCommunityName = communities.find(c => c.id === communityId)?.name ?? ''
  const isPersonal = currentCommunityName === '個人使用'

  useEffect(() => {
    if (isPersonal) return
    Promise.all([
      supabase.rpc('get_ranking', { period: 'week', p_community_id: communityId }),
      supabase.rpc('get_ranking', { period: 'month', p_community_id: communityId }),
    ]).then(([weekly, monthly]) => {
      setWeeklyRanking(weekly.data || [])
      setMonthlyRanking(monthly.data || [])
    })
  }, [communityId, isPersonal])
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

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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

      {/* Legendary Items */}
      {legendaryHistory.length > 0 && <LegendaryItems history={legendaryHistory} />}

      {/* Rankings */}
      {!isPersonal && <RankingCard title="週間ランキング" rows={weeklyRanking} myName={displayName} />}
      {!isPersonal && <RankingCard title="月間ランキング" rows={monthlyRanking} myName={displayName} />}

      {/* Research Points */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '20px 28px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, color: '#666', fontWeight: 600 }}>研究ポイント</span>
        <span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: '#ff9800' }}>
          {totalPoints}<span style={{ fontSize: 15, fontWeight: 500, color: '#aaa', marginLeft: 3 }}>点</span>
        </span>
      </div>

      {/* Points Guide */}
      <div style={{
        background: 'linear-gradient(135deg, #fffde7 0%, #fff8e1 100%)',
        border: '1.5px solid #ffe082',
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f57f17', marginBottom: 2 }}>🎮 ポイントの入り方</div>
        {[
          { time: '25分', base: '+3点', bonus: null,            label: 'Good!' },
          { time: '50分', base: '+2点', bonus: 'ガチャ +1〜3点', label: 'Great work!' },
          { time: '100分', base: '+3点', bonus: 'ガチャ +3〜5点', label: 'Legendary!' },
        ].map(({ time, base, bonus, label }) => (
          <div key={time} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#ffb300', borderRadius: 6, padding: '2px 8px', minWidth: 36, textAlign: 'center' }}>{time}</span>
            <span style={{ fontSize: 13, color: '#555' }}>{label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#e65100', fontFamily: 'monospace' }}>{base}</span>
            {bonus && <span style={{ fontSize: 12, color: '#ff8f00' }}>＋{bonus}</span>}
          </div>
        ))}
        <div style={{ fontSize: 12, color: '#a1887f', borderTop: '1px solid #ffe0b2', paddingTop: 8, marginTop: 2 }}>
          1日最大 <strong style={{ color: '#e65100' }}>16点</strong> 獲得可能 ✨ ガチャのレアリティは運次第！
        </div>
      </div>

    </div>
  )
}

function LegendaryItems({ history }) {
  const counts = {}
  history.forEach(({ emoji }) => {
    counts[emoji] = (counts[emoji] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])

  return (
    <div style={{
      background: 'linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%)',
      border: '1.5px solid #ffd54f',
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#5d4037' }}>
          Legendary Items
        </h2>
        <span style={{ fontSize: 13, color: '#8d6e63', fontWeight: 600 }}>
          計 {history.length} 日
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(([emoji, count]) => (
          <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</span>
            <div style={{ flex: 1, background: '#ffe0b2', borderRadius: 100, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 100,
                background: '#ff9800',
                width: `${(count / history.length) * 100}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#5d4037', minWidth: 28, textAlign: 'right' }}>
              {count}回
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const RANK_MEDALS = ['🥇', '🥈', '🥉']

function RankingCard({ title, rows, myName }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#444', marginBottom: 12 }}>{title}</h2>
      {rows === null ? (
        <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>読み込み中...</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>まだデータがありません</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map(r => {
            const isMe = r.display_name === myName
            const medal = RANK_MEDALS[r.rank - 1] || `${r.rank}位`
            return (
              <div key={r.rank} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 10px',
                borderRadius: 8,
                background: isMe ? '#eef2ff' : 'transparent',
                fontWeight: isMe ? 700 : 400,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#333' }}>
                  <span style={{ minWidth: 28, fontSize: r.rank <= 3 ? 18 : 13, color: '#888' }}>{medal}</span>
                  <span>{r.display_name}{isMe && ' 👈'}</span>
                </span>
                <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#4f7cff', fontWeight: 700 }}>
                  {Number(r.total_points)}点
                </span>
              </div>
            )
          })}
        </div>
      )}
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


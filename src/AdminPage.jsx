import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const RANK_MEDALS = ['🥇', '🥈', '🥉']

export default function AdminPage() {
  const [stats, setStats] = useState(null)
  const [allUsers, setAllUsers] = useState(null)
  const [rankings, setRankings] = useState({})
  const [selectedPeriod, setSelectedPeriod] = useState('week')
  const [posts, setPosts] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.rpc('get_community_stats'),
      supabase.rpc('get_all_users_points'),
      supabase.rpc('get_all_posts'),
    ]).then(([statsRes, usersRes, postsRes]) => {
      setStats(statsRes.data || [])
      setAllUsers(usersRes.data || [])
      setPosts(postsRes.data || [])
    })
  }, [])

  useEffect(() => {
    if (!stats) return
    const promises = stats.map(c =>
      supabase.rpc('get_ranking', { period: selectedPeriod, p_community_id: c.community_id })
        .then(({ data }) => ({ id: c.community_id, rows: data || [] }))
    )
    Promise.all(promises).then(results => {
      const map = {}
      results.forEach(({ id, rows }) => { map[id] = rows })
      setRankings(map)
    })
  }, [stats, selectedPeriod])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#222', margin: 0 }}>管理者ダッシュボード</h2>

      {/* Community Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#666', margin: 0 }}>コミュニティ統計</h3>
        {stats === null ? (
          <p style={{ fontSize: 13, color: '#bbb' }}>読み込み中...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.map(c => (
              <div key={c.community_id} style={{
                background: '#fff',
                borderRadius: 12,
                padding: '16px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 10 }}>{c.community_name}</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <StatItem label="メンバー" value={`${c.member_count}人`} />
                  <StatItem label="累計ポイント" value={`${c.total_points}点`} color="#ff9800" />
                  <StatItem label="今日アクティブ" value={`${c.active_today}人`} color="#34c97e" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-community Rankings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#666', margin: 0 }}>コミュニティ別ランキング</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {['week', 'month'].map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 20,
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedPeriod === p ? '#4f7cff' : '#e0e0e0',
                  color: selectedPeriod === p ? '#fff' : '#555',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {p === 'week' ? '週間' : '月間'}
              </button>
            ))}
          </div>
        </div>
        {stats === null ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.map(c => {
              const rows = rankings[c.community_id]
              return (
                <div key={c.community_id} style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: '16px 20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 10 }}>{c.community_name}</div>
                  {!rows ? (
                    <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>読み込み中...</p>
                  ) : rows.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>データなし</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {rows.slice(0, 5).map(r => {
                        const medal = RANK_MEDALS[r.rank - 1] || `${r.rank}位`
                        return (
                          <div key={r.rank} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 8px',
                            borderRadius: 6,
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333' }}>
                              <span style={{ minWidth: 26, fontSize: r.rank <= 3 ? 16 : 12, color: '#888' }}>{medal}</span>
                              <span>{r.display_name}</span>
                            </span>
                            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#4f7cff', fontWeight: 700 }}>
                              {Number(r.total_points)}点
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* All Users Points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#666', margin: 0 }}>全ユーザーポイント一覧</h3>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {allUsers === null ? (
            <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>読み込み中...</p>
          ) : allUsers.length === 0 ? (
            <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>データなし</p>
          ) : (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                gap: '4px 16px',
                fontSize: 11,
                fontWeight: 700,
                color: '#aaa',
                paddingBottom: 8,
                borderBottom: '1px solid #f0f0f0',
                marginBottom: 4,
              }}>
                <span>名前</span>
                <span style={{ textAlign: 'right' }}>コミュニティ</span>
                <span style={{ textAlign: 'right' }}>今日</span>
                <span style={{ textAlign: 'right' }}>累計</span>
              </div>
              {allUsers.map((u, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  gap: '4px 16px',
                  fontSize: 13,
                  padding: '7px 0',
                  borderBottom: i < allUsers.length - 1 ? '1px solid #f9f9f9' : 'none',
                  alignItems: 'center',
                }}>
                  <span style={{ color: '#333', fontWeight: 500 }}>{u.display_name}</span>
                  <span style={{ color: '#888', fontSize: 12 }}>{u.community_name}</span>
                  <span style={{ color: '#34c97e', fontFamily: 'monospace', fontWeight: 600 }}>{u.today_points}点</span>
                  <span style={{ color: '#ff9800', fontFamily: 'monospace', fontWeight: 700 }}>{u.total_points}点</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Posts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#666', margin: 0 }}>ユーザー投稿一覧</h3>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {posts === null ? (
            <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>読み込み中...</p>
          ) : posts.length === 0 ? (
            <p style={{ fontSize: 13, color: '#bbb', margin: 0 }}>投稿なし</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {posts.map((p, i) => (
                <div key={p.id} style={{
                  padding: '12px 0',
                  borderBottom: i < posts.length - 1 ? '1px solid #f5f5f5' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>
                      {p.display_name || '（名前なし）'}
                    </span>
                    <span style={{ fontSize: 11, color: '#bbb' }}>
                      {new Date(p.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {p.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function StatItem({ label, value, color = '#4f7cff' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#aaa' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

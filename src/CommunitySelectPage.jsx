import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function CommunitySelectPage({ user, profile, onSaved }) {
  const displayName = profile?.display_name || user?.user_metadata?.display_name || ''
  const [communityId, setCommunityId] = useState('')
  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('communities').select('id, name').order('name').then(({ data }) => {
      if (data) setCommunities(data)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!communityId) { setError('コミュニティを選択してください'); return }
    setLoading(true)
    const upsertData = { id: user.id, community_id: communityId, updated_at: new Date().toISOString() }
    if (displayName) upsertData.display_name = displayName
    const { data, error: dbError } = await supabase
      .from('profiles')
      .upsert(upsertData)
      .select()
      .single()
    if (dbError) {
      setError('保存に失敗しました。再度お試しください。')
    } else {
      onSaved(data)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5',
      padding: '0 16px',
      paddingBottom: '20vh',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 2px 16px rgba(0,0,0,0.09)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#222', marginBottom: 4 }}>コミュニティを選択</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 28 }}>
          {displayName ? `${displayName} さん、` : ''}所属コミュニティを設定してください
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>コミュニティ</label>
            <select
              value={communityId}
              onChange={e => setCommunityId(e.target.value)}
              required
              style={{ ...inputStyle, color: communityId ? '#333' : '#aaa' }}
            >
              <option value="">選択してください</option>
              {communities.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#ee5a24', background: '#fff5f2', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
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
            {loading ? '保存中...' : '設定して始める'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#bbb' }}>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 12, padding: 0 }}
          >
            ログアウト
          </button>
        </p>
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#555',
  display: 'block',
  marginBottom: 5,
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e0e0e0',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './AuthPage'
import DisplayNamePage from './DisplayNamePage'
import CommunitySelectPage from './CommunitySelectPage'
import TimerApp from './TimerApp'
import { isAdminUser } from './isAdmin'

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  return data ?? null
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // ログイン時はプロフィール取得完了まで読み込み中を表示
      if (event === 'SIGNED_IN') setLoading(true)
      try {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          const p = await fetchProfile(u.id)
          setProfile(p)
        } else {
          setProfile(null)
        }
      } finally {
        // 初回起動・ログイン時のみローディング解除（TOKEN_REFRESHED等は除外）
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          setLoading(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 15 }}>
        読み込み中...
      </div>
    )
  }

  if (!user) return <AuthPage />

  if (!profile?.display_name) {
    return <DisplayNamePage user={user} onSaved={setProfile} />
  }

  if (!profile?.community_id) {
    return <CommunitySelectPage user={user} profile={profile} onSaved={setProfile} />
  }

  return <TimerApp user={user} profile={profile} isAdmin={isAdminUser(user)} />
}

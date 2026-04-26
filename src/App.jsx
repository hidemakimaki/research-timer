import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './AuthPage'
import DisplayNamePage from './DisplayNamePage'
import CommunitySelectPage from './CommunitySelectPage'
import TimerApp from './TimerApp'
import { isAdminUser } from './isAdmin'

async function fetchProfile(userId) {
  // ネットワーク不調でハングしないよう5秒でタイムアウト
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 5000))
  const query = supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data }) => data ?? null)
    .catch(() => null)
  return Promise.race([query, timeout])
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null
      if (event === 'SIGNED_IN') setLoading(true)
      setUser(u)

      if (!u) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const p = await fetchProfile(u.id)
        setProfile(p)
      } finally {
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

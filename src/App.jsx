import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './AuthPage'
import DisplayNamePage from './DisplayNamePage'
import CommunitySelectPage from './CommunitySelectPage'
import TimerApp from './TimerApp'
import { isAdminUser } from './isAdmin'

async function fetchProfile(userId) {
  // getSession()でトークンが有効な状態で呼ばれるので3秒で十分
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 3000))
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
    let mounted = true

    // 初回: getSession()はトークンリフレッシュ完了を待ってから返すため
    // 有効なトークンで fetchProfile を確実に呼べる
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          const p = await fetchProfile(u.id)
          if (mounted) setProfile(p)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    // ログイン・ログアウトのみ監視（INITIAL_SESSIONはgetSession()で処理済み）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN') {
        setLoading(true)
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          const p = await fetchProfile(u.id)
          if (mounted) setProfile(p)
        }
        if (mounted) setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
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

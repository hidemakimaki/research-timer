import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './AuthPage'
import DisplayNamePage from './DisplayNamePage'
import TimerApp from './TimerApp'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true) // true until first auth+profile check done

  useEffect(() => {
    let initialized = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null
      setUser(u)

      if (u) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .maybeSingle()
        setProfile(data ?? null)
      } else {
        setProfile(null)
      }

      if (!initialized) {
        initialized = true
        setLoading(false)
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

  return <TimerApp user={user} profile={profile} />
}

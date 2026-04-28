import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './AuthPage'
import TimerApp from './TimerApp'
import { isAdminUser } from './isAdmin'

async function fetchProfile(userId) {
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 8000))
  const query = supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data }) => data ?? null)
    .catch(() => null)
  return Promise.race([query, timeout])
}

// 新規ユーザーを「個人使用」コミュニティに自動登録する
// INSERT（upsertではない）を使い、既存プロフィールを上書きしない
async function createDefaultProfile(user) {
  const { data: community } = await supabase
    .from('communities')
    .select('id')
    .eq('name', '個人使用')
    .maybeSingle()
  if (!community) return null

  const displayName = user.user_metadata?.display_name?.trim() || ''
  const row = {
    id: user.id,
    community_id: community.id,
    updated_at: new Date().toISOString(),
    ...(displayName && { display_name: displayName }),
  }
  const { data, error } = await supabase
    .from('profiles')
    .insert(row)
    .select()
    .single()

  // 競合（既存レコードあり＝タイムアウトで null になっただけ）なら再取得
  if (error) return await fetchProfile(user.id)
  return data ?? null
}

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // ログイン済みユーザーIDをrefで追跡し、トークンリフレッシュ時の誤検知を防ぐ
  const currentUserIdRef = useRef(null)

  useEffect(() => {
    let mounted = true

    // 初回: getSession()はトークンリフレッシュ完了を待ってから返すため
    // 有効なトークンで fetchProfile を確実に呼べる
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        const u = session?.user ?? null
        currentUserIdRef.current = u?.id ?? null
        setUser(u)
        if (u) {
          const p = await fetchProfile(u.id)
          if (mounted) setProfile(p)
          if (!p) createDefaultProfile(u).then(np => { if (mounted && np) setProfile(np) }).catch(() => {})
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    // ログイン・ログアウトのみ監視（INITIAL_SESSIONはgetSession()で処理済み）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN') {
        const u = session?.user ?? null
        const isNewLogin = currentUserIdRef.current === null || currentUserIdRef.current !== u?.id
        currentUserIdRef.current = u?.id ?? null
        setUser(u)
        if (isNewLogin) {
          // 新規ログイン: ローディングを出してプロフィール取得
          setLoading(true)
          try {
            const p = await fetchProfile(u?.id)
            if (mounted) setProfile(p)
            if (!p) createDefaultProfile(u).then(np => { if (mounted && np) setProfile(np) }).catch(() => {})
          } finally {
            if (mounted) setLoading(false)
          }
        } else {
          // トークンリフレッシュ: ローディングなし・nullでも既存profileを上書きしない
          const p = await fetchProfile(u?.id)
          if (mounted && p) setProfile(p)
        }
      } else if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null
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

  return <TimerApp user={user} profile={profile} isAdmin={isAdminUser(user)} onProfileChange={setProfile} />
}

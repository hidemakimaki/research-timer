import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import AuthPage from './AuthPage'
import TimerApp from './TimerApp'
import { isAdminUser } from './isAdmin'

const PROFILE_CACHE_KEY = 'research-timer-profile-v1'

function loadCachedProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) ?? 'null') }
  catch { return null }
}

function saveCachedProfile(p) {
  try {
    if (p) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p))
    else localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {}
}

async function fetchProfile(userId) {
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
  // キャッシュから即時復元 → 再訪問時はローディングなしで表示
  const [profile, setProfile] = useState(loadCachedProfile)
  const [loading, setLoading] = useState(true)
  const currentUserIdRef = useRef(null)

  // プロフィール更新時はキャッシュも同時に保存
  const handleProfileChange = (p) => {
    setProfile(p)
    saveCachedProfile(p)
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      // Step1: auth確認（高速・localStorage読み取り中心）
      let u = null
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        u = session?.user ?? null
        currentUserIdRef.current = u?.id ?? null
        setUser(u)
        if (!u) {
          // ログアウト状態 → キャッシュクリア
          setProfile(null)
          saveCachedProfile(null)
        }
      } finally {
        // auth確認が終わり次第すぐ表示（プロフィール取得を待たない）
        if (mounted) setLoading(false)
      }

      // Step2: プロフィール取得（バックグラウンド・loading解除後に続行）
      if (!u || !mounted) return
      const p = await fetchProfile(u.id)
      if (!mounted) return
      if (p) {
        setProfile(p)
        saveCachedProfile(p)
      } else if (!loadCachedProfile()) {
        // キャッシュもなければ新規ユーザー → デフォルトプロフィール作成
        createDefaultProfile(u).then(np => {
          if (mounted && np) { setProfile(np); saveCachedProfile(np) }
        }).catch(() => {})
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN') {
        const u = session?.user ?? null
        const isNewLogin = currentUserIdRef.current === null || currentUserIdRef.current !== u?.id
        currentUserIdRef.current = u?.id ?? null
        setUser(u)
        if (isNewLogin) {
          setLoading(true)
          try {
            const p = await fetchProfile(u?.id)
            if (mounted) {
              if (p) { setProfile(p); saveCachedProfile(p) }
              else if (!loadCachedProfile()) {
                createDefaultProfile(u).then(np => {
                  if (mounted && np) { setProfile(np); saveCachedProfile(np) }
                }).catch(() => {})
              }
            }
          } finally {
            if (mounted) setLoading(false)
          }
        } else {
          // トークンリフレッシュ: バックグラウンドで更新・nullで上書きしない
          const p = await fetchProfile(u?.id)
          if (mounted && p) { setProfile(p); saveCachedProfile(p) }
        }
      } else if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null
        setUser(null)
        setProfile(null)
        saveCachedProfile(null)
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

  return <TimerApp user={user} profile={profile} isAdmin={isAdminUser(user)} onProfileChange={handleProfileChange} />
}

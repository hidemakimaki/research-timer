import { useState } from 'react'
import { supabase } from './supabaseClient'
import { validateDisplayName } from './validateDisplayName'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const nameError = validateDisplayName(displayName)
      if (nameError) { setError(nameError); setLoading(false); return }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() } },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('確認メールを送信しました。メールのリンクをクリックしてログインしてください。')
      }
    }
    setLoading(false)
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    setError('')
    setMessage('')
    setDisplayName('')
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
      paddingBottom: '25vh',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 2px 16px rgba(0,0,0,0.09)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#222', marginBottom: 4 }}>研究タイマー</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 28 }}>
          {isLogin ? 'ログインして研究記録を同期する' : 'アカウントを作成する'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isLogin && (
            <div>
              <label style={labelStyle}>表示名</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                style={inputStyle}
                placeholder="例: 研究者タロウ"
                maxLength={25}
              />
              <p style={hintStyle}>3〜20文字・日本語英数字OK・絵文字2個まで</p>
            </div>
          )}
          <div>
            <label style={labelStyle}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
              placeholder="6文字以上"
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#ee5a24', background: '#fff5f2', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
              {error}
            </p>
          )}
          {message && (
            <p style={{ fontSize: 13, color: '#34c97e', background: '#f0fdf8', borderRadius: 6, padding: '8px 12px', margin: 0 }}>
              {message}
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
            {loading ? '処理中...' : (isLogin ? 'ログイン' : 'アカウント作成')}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#888' }}>
          {isLogin ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
          {' '}
          <button
            onClick={switchMode}
            style={{ background: 'none', border: 'none', color: '#4f7cff', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0 }}
          >
            {isLogin ? '新規登録' : 'ログイン'}
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

const hintStyle = {
  fontSize: 11,
  color: '#aaa',
  margin: '4px 0 0',
}

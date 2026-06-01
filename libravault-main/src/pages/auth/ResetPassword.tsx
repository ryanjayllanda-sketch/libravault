import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './Auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      if (res.data.session) {
        setValidSession(true)
      } else {
        setError('This reset link is invalid or has expired. Please request a new one.')
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
        setChecking(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ justifyContent: 'center' }}>
        <Link to="/" className="auth-logo" aria-label="LibraVault Home">
          <svg viewBox="0 0 64 64" fill="none" style={{ width: 56, height: 56 }}>
            <rect x="10" y="10" width="44" height="44" rx="12" fill="currentColor" opacity="0.1"/>
            <path d="M20 18h14c4 0 8 2 8 6v22c0-4-4-6-8-6H20V18z" fill="currentColor" />
            <path d="M24 22h10v18H24c-2 0-4 1-4 2V24c0-1 2-2 4-2z" fill="white" opacity="0.5" />
          </svg>
        </Link>

        {checking ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>
            Verifying your reset link…
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={56} color="green" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
              Password Updated!
            </h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>
              Redirecting you to sign in…
            </p>
            <Link to="/login" className="btn btn-secondary btn-sm">Go to Sign In</Link>
          </div>
        ) : !validSession ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 12 }}>
              Link Expired
            </h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>{error}</p>
            <Link to="/forgot-password" className="btn btn-primary btn-sm">
              Request New Link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Set New Password</h1>
            <p className="auth-sub">Choose a strong password for your account.</p>

            {error && <div className="auth-alert error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="password">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 0 }}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm">Confirm Password</label>
                <input
                  id="confirm"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
                style={{ marginTop: 4, padding: '18px', fontSize: 16 }}
              >
                {loading ? <><span className="spinner" /> Updating…</> : 'Update Password'}
              </button>
            </form>

            <p className="auth-switch">
              <Link to="/login">← Back to Sign In</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
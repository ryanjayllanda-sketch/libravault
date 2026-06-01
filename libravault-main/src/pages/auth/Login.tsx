import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchProfileRole } from '../../lib/profileRole'
import { hasPermission } from '../../lib/rbac'
import { useStore } from '../../store/useStore'
import './Auth.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser, addToast } = useStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Email and password are required'); return }
    setError('')
    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err

      const userRole = await fetchProfileRole(data.user.id)
      setUser(data.user, userRole)
      addToast(`Welcome back!`, 'success')

      navigate(hasPermission(userRole, 'admin:access') ? '/admin' : '/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
              <svg viewBox="0 0 64 64" fill="none" style={{ width: 56, height: 56 }}>
      <rect x="10" y="10" width="44" height="44" rx="12" fill="currentColor" opacity="0.1"/>

      <path
        d="M20 18h14c4 0 8 2 8 6v22c0-4-4-6-8-6H20V18z"
        fill="currentColor"
      />

      <path
        d="M24 22h10v18H24c-2 0-4 1-4 2V24c0-1 2-2 4-2z"
        fill="white"
        opacity="0.5"
      />
    </svg>
        </Link>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your LibraVault account</p>

        {error && <div className="auth-alert error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email" type="email" className="form-input"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email"
            />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label" htmlFor="password">Password</label>
              <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--gray-500)' }}>Forgot password?</Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password" type={showPw ? 'text' : 'password'} className="form-input"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" style={{ paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding: '16px', fontSize: 16 }}>
            {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">Don't have an account? <Link to="/register">Join Us</Link></p>
      </div>

      <div className="auth-visual">
        <img src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80" alt="Books" />
        <div className="auth-visual-overlay"><h2>READ IT ALL YOU CAN.</h2></div>
      </div>
    </div>
  )
}

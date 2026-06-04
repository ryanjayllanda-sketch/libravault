import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import './Auth.css'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_URL}/reset-password`,
      })
      if (err) throw err
      setSent(true)
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

        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={56} color="green" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
              Check your email
            </h2>
            <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <Link to="/login" className="btn btn-secondary btn-sm">
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-sub">Enter your email and we'll send you a reset link.</p>

            {error && <div className="auth-alert error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={loading}
                style={{ marginTop: 4, padding: '18px', fontSize: 16 }}
              >
                {loading ? <><span className="spinner" /> Sending...</> : 'Send Reset Link'}
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

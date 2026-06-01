import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, Phone, Lock, Eye, EyeOff, CheckCircle, Loader, Camera } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'

interface ProfileForm {
  full_name: string
  phone: string
  avatar_url: string
}

export default function Profile() {
  const { user, setUser, role } = useStore()

  const [form, setForm] = useState<ProfileForm>({ full_name: '', phone: '', avatar_url: '' })
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileDone, setProfileDone] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwDone, setPwDone] = useState(false)
  const [pwError, setPwError] = useState('')

  const [avatarUploading, setAvatarUploading] = useState(false)

  // FIX: load profile from profiles table (source of truth)
  const loadProfile = async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone, avatar_url')
      .eq('id', user.id)
      .single()
    if (data) setForm({ full_name: data.full_name ?? '', phone: data.phone ?? '', avatar_url: data.avatar_url ?? '' })
    setLoadingProfile(false)
  }

  useEffect(() => { loadProfile() }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path)
      setForm((f) => ({ ...f, avatar_url: publicUrl }))
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Avatar upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setProfileError('')
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        avatar_url: form.avatar_url,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      if (error) throw error

      // FIX: re-read the saved profile from DB to confirm changes
      const { data: saved } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url')
        .eq('id', user.id)
        .single()
      if (saved) setForm({ full_name: saved.full_name ?? '', phone: saved.phone ?? '', avatar_url: saved.avatar_url ?? '' })

      // FIX: update auth user metadata so Navbar picks up the new name
      await supabase.auth.updateUser({
        data: { full_name: form.full_name.trim() }
      })

      // Refresh store user
      const { data: { user: refreshed } } = await supabase.auth.getUser()
      if (refreshed) setUser(refreshed, role)

      setProfileDone(true)
      setTimeout(() => setProfileDone(false), 3000)
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setSavingPw(true)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPw,
      })
      if (signInErr) throw new Error('Current password is incorrect.')
      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) throw error
      setPwDone(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwDone(false), 3000)
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSavingPw(false)
    }
  }

  if (!user) return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32 }}>Please sign in</h2>
      <Link to="/login" className="btn btn-primary">Sign In</Link>
    </div>
  )

  const initials = form.full_name
    ? form.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : user.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ paddingTop: 'var(--nav-h)' }}>
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 720 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, marginBottom: 8 }}>My Profile</h1>
        <p style={{ color: 'var(--gray-500)', marginBottom: 40 }}>Manage your account information and password.</p>

        {loadingProfile ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <Loader size={32} strokeWidth={1.5} color="var(--gray-300)" style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Profile Info Card ── */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--gray-100)', borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                <User size={20} /> Profile Information
              </h2>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="Avatar"
                      style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gray-200)' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--black)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, flexShrink: 0 }}>
                      {initials}
                    </div>
                  )}
                  <label htmlFor="avatar-upload" style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--white)', border: '1.5px solid var(--gray-200)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                    {avatarUploading ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Camera size={13} />}
                  </label>
                  <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 16 }}>{form.full_name || 'No name set'}</p>
                  <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>{user.email}</p>
                  <p style={{ color: 'var(--gray-400)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>Role: {role}</p>
                </div>
              </div>

              {profileError && (
                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
                  {profileError}
                </div>
              )}
              {profileDone && (
                <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} /> Profile updated successfully!
                </div>
              )}

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Email — read only */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={14} /> Email Address
                  </label>
                  <input className="form-input" type="email" value={user.email ?? ''} disabled
                    style={{ background: 'var(--gray-50)', color: 'var(--gray-400)', cursor: 'not-allowed' }} />
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Email cannot be changed.</p>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={14} /> Full Name
                  </label>
                  <input className="form-input" type="text" value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Your full name" />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Phone size={14} /> Phone Number
                  </label>
                  <input className="form-input" type="tel" value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+63 9XX XXX XXXX" />
                </div>

                <button type="submit" className="btn btn-primary" disabled={savingProfile}
                  style={{ alignSelf: 'flex-start', padding: '12px 28px' }}>
                  {savingProfile ? <><Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</> : 'Save Changes'}
                </button>
              </form>
            </div>

            {/* ── Change Password Card ── */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--gray-100)', borderRadius: 16, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Lock size={20} /> Change Password
              </h2>

              {pwError && (
                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
                  {pwError}
                </div>
              )}
              {pwDone && (
                <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 8, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} /> Password updated successfully!
                </div>
              )}

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type={showPw ? 'text' : 'password'} value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password"
                      required autoComplete="current-password" style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 0 }}>
                      {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type={showPw ? 'text' : 'password'} value={newPw}
                    onChange={(e) => setNewPw(e.target.value)} placeholder="At least 6 characters"
                    required autoComplete="new-password" />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type={showPw ? 'text' : 'password'} value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password"
                    required autoComplete="new-password" />
                  {newPw && confirmPw && newPw !== confirmPw && (
                    <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Passwords do not match.</p>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" disabled={savingPw}
                  style={{ alignSelf: 'flex-start', padding: '12px 28px' }}>
                  {savingPw ? <><Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Updating…</> : 'Update Password'}
                </button>
              </form>
            </div>

            {/* ── Quick Links ── */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/orders" className="btn btn-secondary btn-sm">My Orders</Link>
              <Link to="/wishlist" className="btn btn-secondary btn-sm">Reading List</Link>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
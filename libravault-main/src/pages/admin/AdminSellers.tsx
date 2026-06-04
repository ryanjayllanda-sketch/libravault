import { useState, useEffect, useMemo } from 'react'
import { CheckCircle2, Edit2, Loader, Search, Trash2, User, X } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { filterByRole, filterBySearch, buildInitialEditForm } from '../../lib/adminHelpers'
import type { Profile, EditForm } from '../../lib/adminHelpers'
import { useAdminUsers } from '../../lib/hooks'
import { updateUserAccess, deleteUserAccount } from '../../lib/api'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Status metadata constants
// ---------------------------------------------------------------------------

const SELLER_STATUS_META = {
  pending:  { label: 'Pending',  color: '#d97706', bg: '#fef3c7' },
  approved: { label: 'Approved', color: '#16a34a', bg: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2' },
}

const ACCOUNT_STATUS_META = {
  active:    { label: 'Active',    color: '#16a34a', bg: '#dcfce7' },
  suspended: { label: 'Suspended', color: '#dc2626', bg: '#fee2e2' },
}

// ---------------------------------------------------------------------------
// Badge component
// ---------------------------------------------------------------------------

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: bg, color, padding: '4px 10px', borderRadius: 50,
      fontSize: 12, fontWeight: 700,
    }}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// AdminSellers page component
// ---------------------------------------------------------------------------

export default function AdminSellers() {
  const { data: users, loading, refetch } = useAdminUsers()

  // Search state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Action state
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Edit modal state
  const [editSeller, setEditSeller] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    full_name: '',
    email: '',
    seller_status: 'pending',
    account_status: 'active',
  })

  // Debounce search input (300ms, no external library)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // ---------------------------------------------------------------------------
  // Data derivations
  // ---------------------------------------------------------------------------

  const sellers = useMemo(() => filterByRole(users ?? [], 'seller'), [users])

  const filtered = useMemo(
    () => debouncedSearch ? filterBySearch(sellers, debouncedSearch) : sellers,
    [sellers, debouncedSearch],
  )

  const counts = useMemo(() => ({
    total: sellers.length,
    pending: sellers.filter((u) => u.seller_status === 'pending').length,
    suspended: sellers.filter((u) => u.account_status === 'suspended').length,
  }), [sellers])

  // ---------------------------------------------------------------------------
  // Action runner (same pattern as AdminUsers)
  // ---------------------------------------------------------------------------

  const runAction = async (userId: string, action: () => Promise<void>) => {
    setError('')
    setSaving(userId)
    try {
      await action()
      await refetch()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Specific action handlers
  // ---------------------------------------------------------------------------

  const handleDelete = async (userId: string, label: string) => {
    if (!confirm(`Delete ${label}? This removes the account and related profile data.`)) return
    await runAction(userId, () => deleteUserAccount(userId))
  }

  const openEditModal = (seller: Profile) => {
    setEditSeller(seller)
    setEditForm(buildInitialEditForm(seller))
  }

  const handleEditSave = async () => {
    if (!editSeller) return
    const id = editSeller.id
    setSaving(id)
    setError('')
    try {
      await updateUserAccess(id, {
        seller_status: editForm.seller_status,
        account_status: editForm.account_status,
      })
      await supabase.from('profiles').update({
        full_name: editForm.full_name,
        email: editForm.email,
      }).eq('id', id)
      await refetch()
      setEditSeller(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AdminLayout>
      {/* Section header */}
      <div className="admin-section-header">
        <h2 className="admin-section-title">Seller Management</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--gray-500)', flexWrap: 'wrap' }}>
          <span>Total: <strong style={{ color: 'var(--black)' }}>{counts.total}</strong></span>
          <span>Pending: <strong style={{ color: '#d97706' }}>{counts.pending}</strong></span>
          <span>Suspended: <strong style={{ color: 'var(--red)' }}>{counts.suspended}</strong></span>
        </div>
      </div>

      {/* Dismissible error banner */}
      {error && (
        <div style={{
          background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: 8,
          fontSize: 14, marginBottom: 12, display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ color: '#dc2626', fontWeight: 700 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search input */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search" style={{ flex: 1, minWidth: 220 }}>
          <Search size={16} color="var(--gray-400)" />
          <input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
      </div>

      {/* Main card */}
      <div className="admin-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader
              size={28}
              strokeWidth={1.5}
              color="var(--gray-300)"
              style={{ animation: 'spin 0.8s linear infinite' }}
            />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Seller Status</th>
                  <th>Account Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const sellerStatus = (u.seller_status ?? 'pending') as keyof typeof SELLER_STATUS_META
                  const accountStatus = (u.account_status ?? 'active') as keyof typeof ACCOUNT_STATUS_META
                  const isSaving = saving === u.id
                  const displayName = u.full_name || u.email || 'this seller'

                  return (
                    <tr key={u.id}>
                      {/* Seller column */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: '50%',
                            background: '#f3f4f6', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <User size={15} color="#6b7280" />
                          </div>
                          <div>
                            <strong style={{ fontSize: 14 }}>{u.full_name || '(no name)'}</strong><br />
                            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Seller status badge */}
                      <td>
                        <Badge {...SELLER_STATUS_META[sellerStatus]} />
                      </td>

                      {/* Account status badge */}
                      <td>
                        <Badge {...ACCOUNT_STATUS_META[accountStatus]} />
                      </td>

                      {/* Joined date */}
                      <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {isSaving && <span className="spinner" style={{ width: 16, height: 16 }} />}

                          {/* Approve — shown only when pending */}
                          {sellerStatus === 'pending' && (
                            <button
                              className="btn btn-sm btn-accent"
                              disabled={isSaving}
                              onClick={() => runAction(u.id, () => updateUserAccess(u.id, { seller_status: 'approved' }))}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            className="btn btn-sm btn-secondary"
                            disabled={isSaving}
                            onClick={() => openEditModal(u)}
                          >
                            <Edit2 size={14} /> Edit
                          </button>

                          {/* Suspend / Reactivate */}
                          {accountStatus === 'suspended' ? (
                            <button
                              className="btn btn-sm btn-secondary"
                              disabled={isSaving}
                              onClick={() => runAction(u.id, () => updateUserAccess(u.id, { account_status: 'active' }))}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-secondary"
                              disabled={isSaving}
                              onClick={() => runAction(u.id, () => updateUserAccess(u.id, { account_status: 'suspended' }))}
                            >
                              Suspend
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            className="btn btn-sm"
                            disabled={isSaving}
                            onClick={() => handleDelete(u.id, displayName)}
                            style={{ color: '#dc2626', border: '1.5px solid #fecaca', background: '#fff' }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty states */}
        {!loading && filtered.length === 0 && debouncedSearch && (
          <div className="admin-table-empty">No sellers match your search.</div>
        )}
        {!loading && sellers.length === 0 && !debouncedSearch && (
          <div className="admin-table-empty">No sellers found.</div>
        )}
      </div>

      {/* Edit modal placeholder — tasks 6.2 and 6.3 will implement the full modal */}
      {editSeller && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 32,
            width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Edit Seller</h3>
              <button onClick={() => setEditSeller(null)} style={{ color: 'var(--gray-400)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Full Name
              </label>
              <input
                className="admin-input"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 14 }}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Email
              </label>
              <input
                className="admin-input"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--gray-200)', fontSize: 14 }}
              />
            </div>

            {/* Seller Status */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Seller Status
              </label>
              <select
                className="sort-select"
                value={editForm.seller_status}
                onChange={(e) => setEditForm((f) => ({ ...f, seller_status: e.target.value as EditForm['seller_status'] }))}
                style={{ width: '100%', borderRadius: 8 }}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Account Status */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Account Status
              </label>
              <select
                className="sort-select"
                value={editForm.account_status}
                onChange={(e) => setEditForm((f) => ({ ...f, account_status: e.target.value as EditForm['account_status'] }))}
                style={{ width: '100%', borderRadius: 8 }}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Modal actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setEditSeller(null)}
                disabled={saving === editSeller.id}
              >
                Cancel
              </button>
              <button
                className="btn btn-accent"
                onClick={handleEditSave}
                disabled={saving === editSeller.id}
              >
                {saving === editSeller.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

import { useMemo, useState } from 'react'
import { CheckCircle2, Loader, Search, Shield, Trash2, User, X, XCircle } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { ROLE_META, ROLES, normalizeRole } from '../../lib/rbac'
import { useAdminUsers } from '../../lib/hooks'
import { deleteUserAccount, updateUserAccess, updateUserRole } from '../../lib/api'
import type { Role } from '../../lib/rbac'

type AccountStatus = 'active' | 'suspended'
type SellerStatus = 'pending' | 'approved' | 'rejected' | null

const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#16a34a', bg: '#dcfce7' },
  suspended: { label: 'Suspended', color: '#dc2626', bg: '#fee2e2' },
}

const SELLER_STATUS_META: Record<Exclude<SellerStatus, null>, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending approval', color: '#d97706', bg: '#fef3c7' },
  approved: { label: 'Approved seller', color: '#16a34a', bg: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: '#fee2e2' },
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color, padding: '4px 10px', borderRadius: 50, fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  )
}

export default function AdminUsers() {
  const { data: users, loading, refetch } = useAdminUsers()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    let items = [...(users ?? [])]
    if (search) {
      const q = search.toLowerCase()
      items = items.filter((u: any) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      )
    }
    if (roleFilter !== 'All') items = items.filter((u: any) => normalizeRole(u.role) === roleFilter)
    return items
  }, [users, search, roleFilter])

  const counts = useMemo(() => {
    const list = users ?? []
    return {
      total: list.length,
      pendingSellers: list.filter((u: any) => u.role === 'seller' && u.seller_status === 'pending').length,
      suspended: list.filter((u: any) => u.account_status === 'suspended').length,
    }
  }, [users])

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

  const handleDelete = async (userId: string, label: string) => {
    if (!confirm(`Delete ${label}? This removes the account and related profile data.`)) return
    await runAction(userId, () => deleteUserAccount(userId))
  }

  return (
    <AdminLayout>
      <div className="admin-section-header">
        <h2 className="admin-section-title">User Management</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--gray-500)', flexWrap: 'wrap' }}>
          <span>Total: <strong style={{ color: 'var(--black)' }}>{counts.total}</strong></span>
          <span>Pending sellers: <strong style={{ color: '#d97706' }}>{counts.pendingSellers}</strong></span>
          <span>Suspended: <strong style={{ color: 'var(--red)' }}>{counts.suspended}</strong></span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: 8, fontSize: 14, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ color: '#dc2626', fontWeight: 700 }}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search" style={{ flex: 1, minWidth: 220 }}>
          <Search size={16} color="var(--gray-400)" />
          <input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        <select className="sort-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | 'All')} style={{ borderRadius: 8 }}>
          <option value="All">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
        </select>
      </div>

      <div className="admin-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader size={28} strokeWidth={1.5} color="var(--gray-300)" style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Seller Approval</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => {
                  const userRole = normalizeRole(u.role)
                  const roleMeta = ROLE_META[userRole]
                  const accountStatus = (u.account_status ?? 'active') as AccountStatus
                  const sellerStatus = (u.seller_status ?? null) as SellerStatus
                  const isSaving = saving === u.id
                  const displayName = u.full_name || u.email || 'this user'

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: roleMeta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {userRole === 'admin' ? <Shield size={15} color={roleMeta.color} /> : <User size={15} color={roleMeta.color} />}
                          </div>
                          <div>
                            <strong style={{ fontSize: 14 }}>{u.full_name || '(no name)'}</strong><br />
                            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          className="sort-select"
                          value={userRole}
                          disabled={isSaving || userRole === 'admin'}
                          onChange={(e) => runAction(u.id, () => updateUserRole(u.id, e.target.value))}
                          style={{ borderRadius: 8, minWidth: 120 }}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                        </select>
                      </td>
                      <td>
                        <Badge {...ACCOUNT_STATUS_META[accountStatus]} />
                      </td>
                      <td>
                        {userRole === 'seller' && sellerStatus ? (
                          <Badge {...SELLER_STATUS_META[sellerStatus]} />
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Not a seller</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {isSaving && <span className="spinner" style={{ width: 16, height: 16 }} />}

                          {userRole === 'seller' && sellerStatus !== 'approved' && (
                            <button className="btn btn-sm btn-accent" disabled={isSaving} onClick={() => runAction(u.id, () => updateUserAccess(u.id, { seller_status: 'approved' }))}>
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          )}

                          {userRole === 'seller' && sellerStatus !== 'rejected' && (
                            <button className="btn btn-sm btn-secondary" disabled={isSaving} onClick={() => runAction(u.id, () => updateUserAccess(u.id, { seller_status: 'rejected' }))}>
                              <XCircle size={14} /> Reject
                            </button>
                          )}

                          {accountStatus === 'suspended' ? (
                            <button className="btn btn-sm btn-secondary" disabled={isSaving} onClick={() => runAction(u.id, () => updateUserAccess(u.id, { account_status: 'active' }))}>
                              Reactivate
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-secondary" disabled={isSaving || userRole === 'admin'} onClick={() => runAction(u.id, () => updateUserAccess(u.id, { account_status: 'suspended' }))}>
                              Suspend
                            </button>
                          )}

                          <button className="btn btn-sm" disabled={isSaving || userRole === 'admin'} onClick={() => handleDelete(u.id, displayName)} style={{ color: '#dc2626', border: '1.5px solid #fecaca', background: '#fff' }}>
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
        {!loading && filtered.length === 0 && <div className="admin-table-empty">No users found.</div>}
      </div>
    </AdminLayout>
  )
}

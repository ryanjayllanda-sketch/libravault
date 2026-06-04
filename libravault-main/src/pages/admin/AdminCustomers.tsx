import { useMemo, useState } from 'react'
import { CheckCircle2, Loader, Search, Trash2, User, X, XCircle } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { filterByRole, filterBySearch, buildOrderCountByEmail } from '../../lib/adminHelpers'
import type { Profile } from '../../lib/adminHelpers'
import { useAdminUsers, useAdminOrders } from '../../lib/hooks'
import { updateUserAccess, deleteUserAccount } from '../../lib/api'

type AccountStatus = 'active' | 'suspended'

const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#16a34a', bg: '#dcfce7' },
  suspended: { label: 'Suspended', color: '#dc2626', bg: '#fee2e2' },
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color, padding: '4px 10px', borderRadius: 50, fontSize: 12, fontWeight: 700 }}>
      {label}
    </span>
  )
}

export default function AdminCustomers() {
  const { data: users, loading, refetch } = useAdminUsers()
  const { data: orders } = useAdminOrders()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const customers = useMemo(() => filterByRole((users ?? []) as Profile[], 'customer'), [users])

  const filtered = useMemo(
    () => (search ? filterBySearch(customers, search) : customers),
    [customers, search],
  )

  const orderCountByEmail = useMemo(
    () => buildOrderCountByEmail(orders ?? []),
    [orders],
  )

  const counts = useMemo(() => ({
    total: customers.length,
    suspended: customers.filter((u) => u.account_status === 'suspended').length,
  }), [customers])

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
        <h2 className="admin-section-title">Customers</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--gray-500)', flexWrap: 'wrap' }}>
          <span>Total: <strong style={{ color: 'var(--black)' }}>{counts.total}</strong></span>
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
          <input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader size={28} strokeWidth={1.5} color="var(--gray-300)" style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Account Status</th>
                  <th>Orders</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const accountStatus = (u.account_status ?? 'active') as AccountStatus
                  const isSaving = saving === u.id
                  const displayName = u.full_name || u.email || 'this user'
                  const orderCount = orderCountByEmail.get(u.email ?? '') ?? 0

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={15} color="#16a34a" />
                          </div>
                          <div>
                            <strong style={{ fontSize: 14 }}>{u.full_name || '(no name)'}</strong><br />
                            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge {...ACCOUNT_STATUS_META[accountStatus]} />
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                        {orderCount}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {isSaving && <span className="spinner" style={{ width: 16, height: 16 }} />}

                          {accountStatus === 'suspended' ? (
                            <button
                              className="btn btn-sm btn-secondary"
                              disabled={isSaving}
                              onClick={() => runAction(u.id, () => updateUserAccess(u.id, { account_status: 'active' }))}
                            >
                              <CheckCircle2 size={14} /> Reactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-secondary"
                              disabled={isSaving}
                              onClick={() => runAction(u.id, () => updateUserAccess(u.id, { account_status: 'suspended' }))}
                            >
                              <XCircle size={14} /> Suspend
                            </button>
                          )}

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
        {!loading && filtered.length === 0 && search && (
          <div className="admin-table-empty">No customers match your search.</div>
        )}
        {!loading && customers.length === 0 && !search && (
          <div className="admin-table-empty">No customers found.</div>
        )}
      </div>
    </AdminLayout>
  )
}

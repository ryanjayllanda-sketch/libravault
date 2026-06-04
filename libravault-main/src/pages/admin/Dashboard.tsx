import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, ShoppingBag, Users, TrendingUp,
  ArrowUpRight, Loader, AlertTriangle, Clock,
  CheckCircle2, Store,
} from 'lucide-react'
import { useAdminAnalytics, useAdminOrders, useAdminUsers } from '../../lib/hooks'
import AdminLayout from './AdminLayout'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_COLORS: Record<string, string> = {
  Delivered: '#22c55e',
  Processing: '#f59e0b',
  Shipped: '#3b82f6',
  Cancelled: '#f04048',
}

const CATEGORY_COLORS: Record<string, string> = {
  fiction: '#8b5cf6',
  'non-fiction': '#3b82f6',
  science: '#22c55e',
  history: '#f59e0b',
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Loader size={32} strokeWidth={1.5} color="var(--gray-300)" style={{ animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function Dashboard() {
  const { data: analytics, loading } = useAdminAnalytics()
  const { data: orders, loading: ordersLoading } = useAdminOrders()
  const { data: users } = useAdminUsers()

  const recentOrders = (orders ?? []).slice(0, 5)

  // Order status breakdown
  const statusCounts = useMemo(() => {
    const all = orders ?? []
    return {
      Processing: all.filter((o: any) => o.status === 'Processing').length,
      Shipped:    all.filter((o: any) => o.status === 'Shipped').length,
      Delivered:  all.filter((o: any) => o.status === 'Delivered').length,
      Cancelled:  all.filter((o: any) => o.status === 'Cancelled').length,
    }
  }, [orders])

  // Pending sellers count
  const pendingSellers = useMemo(() =>
    (users ?? []).filter((u: any) => u.role === 'seller' && u.seller_status === 'pending').length,
    [users]
  )

  // Category stock breakdown
  const categoryStock = useMemo(() => {
    const prods = analytics?.products ?? []
    const grouped: Record<string, number> = {}
    prods.forEach((p: any) => {
      grouped[p.category] = (grouped[p.category] ?? 0) + p.stock
    })
    return grouped
  }, [analytics])

  // Monthly chart — last 6 months
  const monthlyData = useMemo(() => {
    const monthly = analytics?.monthly ?? []
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now.getMonth() - 5 + i + 12) % 12
      return { label: MONTHS[idx], value: monthly[idx] ?? 0 }
    })
  }, [analytics])
  const maxMonthly = Math.max(...monthlyData.map(m => m.value), 1)

  const totalRevenue = analytics?.totalRevenue ?? 0
  const totalOrders  = analytics?.totalOrders ?? 0
  const totalUsers   = analytics?.totalUsers ?? 0
  const totalBooks   = analytics?.totalProducts ?? 0

  return (
    <AdminLayout>
      {loading ? <Spinner /> : (
        <>
          {/* ── Pending seller alert ── */}
          {pendingSellers > 0 && (
            <div style={{
              background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 10,
              padding: '12px 18px', marginBottom: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} color="#d97706" />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                  {pendingSellers} seller{pendingSellers > 1 ? 's' : ''} awaiting approval
                </span>
              </div>
              <Link to="/admin/sellers" style={{ fontSize: 13, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                Review now <ArrowUpRight size={13} />
              </Link>
            </div>
          )}

          {/* ── Stat cards ── */}
          <div className="stat-cards" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total Revenue',  value: `₱${totalRevenue.toLocaleString('en', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: '#3b82f6', sub: 'All time sales' },
              { label: 'Total Orders',   value: totalOrders,  icon: ShoppingBag, color: '#8b5cf6', sub: `${statusCounts.Processing} processing` },
              { label: 'Customers',      value: totalUsers,   icon: Users,       color: '#22c55e', sub: `${pendingSellers} seller${pendingSellers !== 1 ? 's' : ''} pending` },
              { label: 'Books in Catalog', value: totalBooks, icon: BookOpen,    color: '#f59e0b', sub: `${analytics?.lowStockProducts?.length ?? 0} low stock` },
            ].map((s) => (
              <div key={s.label} className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
                {/* accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: s.color, borderRadius: '12px 0 0 12px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: 8 }}>
                  <div>
                    <p className="stat-label">{s.label}</p>
                    <p className="stat-value" style={{ fontSize: 30 }}>{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{s.sub}</p>
                  </div>
                  <div style={{ background: s.color + '18', borderRadius: 10, padding: 10, flexShrink: 0 }}>
                    <s.icon size={20} color={s.color} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Revenue chart + Order status ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginBottom: 20 }}>
            {/* Monthly revenue bar chart */}
            <div className="admin-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Monthly Revenue</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Last 6 months</span>
              </div>
              <div className="bar-chart" style={{ height: 160 }}>
                {monthlyData.map((m) => (
                  <div key={m.label} className="bar-col">
                    <span className="bar-val">{m.value > 0 ? `₱${(m.value/1000).toFixed(0)}k` : ''}</span>
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(4, (m.value / maxMonthly) * 100)}%`,
                        background: m.value > 0
                          ? 'linear-gradient(180deg, #3b82f6, #8b5cf6)'
                          : 'var(--gray-100)',
                      }}
                    />
                    <span className="bar-label">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Order status breakdown */}
            <div className="admin-card" style={{ padding: '20px 24px' }}>
              <span style={{ fontWeight: 700, fontSize: 15, display: 'block', marginBottom: 18 }}>Order Status</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(Object.entries(statusCounts) as [string, number][]).map(([status, count]) => {
                  const pct = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0
                  return (
                    <div key={status}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLORS[status] }}>{status}</span>
                        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{count} <span style={{ fontSize: 11 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLORS[status], borderRadius: 4, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Category stock mini breakdown */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--gray-500)', display: 'block', marginBottom: 10 }}>Stock by Category</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(categoryStock).map(([cat, stock]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[cat] ?? '#999', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--gray-600)' }}>{cat}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{stock}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Recent orders + Low stock ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            {/* Recent orders */}
            <div className="admin-card">
              <div className="admin-card-header">
                <span className="admin-card-title">Recent Orders</span>
                <Link to="/admin/orders" style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View all <ArrowUpRight size={13} />
                </Link>
              </div>
              {ordersLoading ? (
                <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                  <Loader size={20} strokeWidth={1.5} color="var(--gray-300)" style={{ animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : recentOrders.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                  No orders yet
                </div>
              ) : (
                <div>
                  {recentOrders.map((o: any, i: number) => (
                    <div key={o.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < recentOrders.length - 1 ? '1px solid var(--gray-100)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <ShoppingBag size={15} color="#64748b" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.id}</p>
                          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 1 }}>{o.customer || o.email || 'Unknown'} · {o.date}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>₱{Number(o.amount).toFixed(2)}</span>
                        <span className="status-badge" style={{ background: STATUS_COLORS[o.status] + '18', color: STATUS_COLORS[o.status], fontSize: 11 }}>{o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right column: low stock + pending sellers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Pending sellers card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <span className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Store size={15} color="#7c3aed" /> Sellers
                  </span>
                  <Link to="/admin/sellers" style={{ fontSize: 13, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Manage <ArrowUpRight size={13} />
                  </Link>
                </div>
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} color="#d97706" />
                      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Pending approval</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: pendingSellers > 0 ? '#d97706' : '#22c55e' }}>{pendingSellers}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={14} color="#22c55e" />
                      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Approved sellers</span>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#22c55e' }}>
                      {(users ?? []).filter((u: any) => u.role === 'seller' && u.seller_status === 'approved').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Low stock */}
              <div className="admin-card" style={{ flex: 1 }}>
                <div className="admin-card-header">
                  <span className="admin-card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <AlertTriangle size={14} color="#f59e0b" /> Low Stock
                  </span>
                  <Link to="/admin/products" style={{ fontSize: 13, color: 'var(--gray-500)' }}>Manage</Link>
                </div>
                <div>
                  {(analytics?.lowStockProducts ?? []).length === 0 ? (
                    <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                      ✓ All books well-stocked
                    </div>
                  ) : (
                    (analytics?.lowStockProducts ?? []).slice(0, 6).map((p: any, i: number, arr: any[]) => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '11px 20px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--gray-100)' : 'none',
                      }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{p.name}</span>
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: p.stock === 0 ? '#f04048' : p.stock < 5 ? '#f59e0b' : '#d97706',
                          background: p.stock === 0 ? '#fef2f2' : '#fef3c7',
                          padding: '2px 8px', borderRadius: 50,
                        }}>{p.stock} left</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}

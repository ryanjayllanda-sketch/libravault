import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, X, Search, Package, Loader, Minus } from 'lucide-react'
import { useAdminProducts } from '../../lib/hooks'
import { createProductWithSizes, updateProduct, deleteProduct, syncProductSizes, fetchProductSizes } from '../../lib/api'
import AdminLayout from './AdminLayout'
import ImageUpload from '../../components/ImageUpload'
import { Can, RequirePermission } from '../../components/Guards'
import type { Product } from '../../types'

interface SizeStock { size: number; stock: number }

type FormData = {
  name: string
  category: string
  price: string
  sale_price_str: string
  image: string
  description: string
  sizeStocks: SizeStock[]   // [{ size: 9, stock: 5 }, ...]
  colors: string[]
}

const EMPTY: FormData = {
  name: '', category: 'fiction', price: '', sale_price_str: '',
  image: '', description: '', sizeStocks: [], colors: [],
}

const ALL_SIZES = [1, 2, 3, 4]

const SIZE_PRESETS: { label: string; sizes: number[] }[] = [
  { label: 'Print only',       sizes: [1, 2] },
  { label: 'Digital only',     sizes: [3, 4] },
  { label: 'Print + eBook',    sizes: [1, 2, 3] },
  { label: 'All editions',     sizes: ALL_SIZES },
  { label: 'Clear',            sizes: [] },
]



export default function AdminProducts() {
  const { data: products, loading, refetch } = useAdminProducts()
  const [modal, setModal] = useState<'add'|'edit'|null>(null)
  const [editId, setEditId] = useState<number|null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [bulkStock, setBulkStock] = useState('10')

  const totalStock = useMemo(
    () => form.sizeStocks.reduce((s, x) => s + (x.stock || 0), 0),
    [form.sizeStocks]
  )

  const filtered = useMemo(() => {
    let items = [...(products ?? [])]
    if (search) items = items.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    if (catFilter !== 'all') items = items.filter((p) => p.category === catFilter)
    return items
  }, [products, search, catFilter])

  const openAdd = () => { setForm(EMPTY); setModal('add') }

  const openEdit = async (p: Product) => {
    // Load real per-size stock from DB
    try {
      const realSizes = await fetchProductSizes(p.id)
      setForm({
        name: p.name,
        category: p.category,
        price: String(p.price),
        sale_price_str: p.sale_price ? String(p.sale_price) : '',
        image: p.image,
        description: p.description,
        sizeStocks: realSizes.length > 0 ? realSizes : (p.sizes ?? []).map((s) => ({ size: s, stock: 0 })),
        colors: p.colors && p.colors.length > 0 ? p.colors : [],
      })
    } catch {
      setForm({
        name: p.name,
        category: p.category,
        price: String(p.price),
        sale_price_str: p.sale_price ? String(p.sale_price) : '',
        image: p.image,
        description: p.description,
        sizeStocks: (p.sizes ?? []).map((s) => ({ size: s, stock: 0 })),
        colors: [],
      })
    }
    setEditId(p.id)
    setModal('edit')
  }

  const close = () => { setModal(null); setEditId(null) }

  const setField = <K extends keyof FormData>(k: K) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))


  // Add/remove a size with default stock
  const toggleSize = (size: number) => {
    setForm((f) => {
      const has = f.sizeStocks.find((x) => x.size === size)
      const newStocks = has
        ? f.sizeStocks.filter((x) => x.size !== size)
        : [...f.sizeStocks, { size, stock: 0 }].sort((a, b) => a.size - b.size)
      return { ...f, sizeStocks: newStocks }
    })
  }

  // Update stock for a specific size
  const updateStock = (size: number, delta: number) => {
    setForm((f) => ({
      ...f,
      sizeStocks: f.sizeStocks.map((x) =>
        x.size === size ? { ...x, stock: Math.max(0, x.stock + delta) } : x
      ),
    }))
  }
  const setStock = (size: number, value: string) => {
    const n = Math.max(0, parseInt(value, 10) || 0)
    setForm((f) => ({
      ...f,
      sizeStocks: f.sizeStocks.map((x) => x.size === size ? { ...x, stock: n } : x),
    }))
  }

  // Apply preset (replaces with stock=0 for each)
  const applyPreset = (sizes: number[]) => {
    setForm((f) => ({
      ...f,
      sizeStocks: sizes.map((s) => {
        const existing = f.sizeStocks.find((x) => x.size === s)
        return existing ?? { size: s, stock: 0 }
      }),
    }))
  }

  // Apply same stock value to all current sizes
  const applyBulkStock = () => {
    const n = Math.max(0, parseInt(bulkStock, 10) || 0)
    setForm((f) => ({
      ...f,
      sizeStocks: f.sizeStocks.map((x) => ({ ...x, stock: n })),
    }))
  }

  const handleSave = async () => {
    if (!form.name || !form.price) return
    if (form.sizeStocks.length === 0) {
      alert('Please select at least one edition for this product.')
      return
    }
    setSaving(true)
    try {
      const productData = {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        sale_price: form.sale_price_str ? Number(form.sale_price_str) : null,
        image: form.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
        description: form.description,
        stock: totalStock,
        colors: [],
        sizes: form.sizeStocks.map((x) => x.size),
        badge: form.sale_price_str ? 'sale' : null,
        is_active: true,
      }

      if (modal === 'add') {
        await createProductWithSizes(productData, form.sizeStocks)
      } else if (editId) {
        await updateProduct(editId, productData)
        await syncProductSizes(editId, form.sizeStocks)
      }
      await refetch()
      close()
    } catch (err: any) { alert(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    setSaving(true)
    try {
      await deleteProduct(id)
      await refetch()
      setDeleteConfirm(null)
    } catch (err: any) {
      if (err.message && err.message.includes('deactivated')) {
        await refetch()
        setDeleteConfirm(null)
        alert(err.message)
      } else {
        alert(err.message || 'Failed to delete product')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-section-header">
        <h2 className="admin-section-title">Products {products ? `(${products.length})` : ''}</h2>
        <Can do="products:create">
          <button onClick={openAdd} className="btn btn-primary btn-sm"><Plus size={16} /> Add Product</button>
        </Can>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="admin-search" style={{ flex: 1 }}>
          <Search size={16} color="var(--gray-400)" />
          <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
        </div>
        <select className="sort-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ borderRadius: 8 }}>
          <option value="all">All Categories</option>
          <option value="fiction">Fiction</option>
          <option value="non-fiction">Non-Fiction</option>
          <option value="mystery">Mystery</option>
          <option value="sci-fi">Sci-Fi</option>
          <option value="fantasy">Fantasy</option>
          <option value="romance">Romance</option>
          <option value="biography">Biography</option>
          <option value="history">History</option>
          <option value="self-help">Self-Help</option>
          <option value="children">Children</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--gray-500)', alignSelf: 'center' }}>
          {filtered.length} of {products?.length ?? '…'}
        </span>
      </div>

      <div className="admin-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader size={28} strokeWidth={1.5} color="var(--gray-300)" style={{ animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <Package size={40} strokeWidth={1} color="var(--gray-300)" style={{ margin: '0 auto 12px' }} />
            <p>No products found</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Total Stock</th><th>Sizes</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ opacity: p.is_active === false ? 0.5 : 1 }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={p.image} alt={p.name} style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', background: 'var(--gray-100)', flexShrink: 0 }} />
                      <strong style={{ fontSize: 14 }}>{p.name}</strong>
                    </div>
                  </td>
                  <td><span style={{ textTransform: 'capitalize', background: 'var(--gray-100)', padding: '4px 10px', borderRadius: 50, fontSize: 12, fontWeight: 600 }}>{p.category}</span></td>
                  <td>
                    {p.sale_price
                      ? <><span style={{ color: 'var(--red)', fontWeight: 700 }}>₱{p.sale_price}</span>{' '}<span style={{ color: 'var(--gray-400)', textDecoration: 'line-through', fontSize: 12 }}>₱{p.price}</span></>
                      : <strong>₱{p.price}</strong>}
                  </td>
                  <td><span style={{ color: p.stock < 10 ? 'var(--red)' : p.stock < 20 ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>{p.stock}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>{p.sizes.length} sizes</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Can do="products:update">
                        <button onClick={() => openEdit(p)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1.5px solid #3b82f6', color: '#3b82f6', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                          <Pencil size={13} /> Edit
                        </button>
                      </Can>
                      <Can do="products:delete">
                        <button onClick={() => setDeleteConfirm(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1.5px solid var(--red)', color: 'var(--red)', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </Can>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <RequirePermission permission={modal === 'add' ? 'products:create' : 'products:update'}>
          <div className="modal-overlay" onClick={close}>
            <div className="modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3 style={{ fontWeight: 700, fontSize: 20 }}>{modal === 'add' ? 'Add New Product' : 'Edit Product'}</h3>
                <button onClick={close}><X size={20} /></button>
              </div>
              <div className="admin-modal-grid">
                <div className="form-group full"><label className="form-label">Product Name *</label><input className="form-input" value={form.name} onChange={setField('name')} placeholder="e.g. The Great Gatsby" /></div>
                <div className="form-group"><label className="form-label">Category</label><select className="form-input" value={form.category} onChange={setField('category')}><option value="fiction">Fiction</option><option value="non-fiction">Non-Fiction</option><option value="mystery">Mystery</option><option value="sci-fi">Sci-Fi</option><option value="fantasy">Fantasy</option><option value="romance">Romance</option><option value="biography">Biography</option><option value="history">History</option><option value="self-help">Self-Help</option><option value="children">Children</option></select></div>
                <div className="form-group"><label className="form-label">Total Stock <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(calculated)</span></label><input className="form-input" value={totalStock} disabled style={{ background: 'var(--gray-50)' }} /></div>
                <div className="form-group"><label className="form-label">Price (₱) *</label><input className="form-input" type="number" min={0} value={form.price} onChange={setField('price')} placeholder="7500" /></div>
                <div className="form-group"><label className="form-label">Sale Price (₱) <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>optional</span></label><input className="form-input" type="number" min={0} value={form.sale_price_str} onChange={setField('sale_price_str')} placeholder="blank = no sale" /></div>

                <div className="form-group full">
                  <label className="form-label">Product Image</label>
                  <ImageUpload value={form.image} onChange={(url) => setForm((f) => ({ ...f, image: url }))} bucket="product-images" />
                </div>

                {/* ── Sizes + Per-Size Stock ── */}
                <div className="form-group full">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Editions & Stock per Edition *
                      <span style={{ marginLeft: 6, color: 'var(--gray-400)', fontWeight: 400 }}>
                        ({form.sizeStocks.length} editions · {totalStock} total units)
                      </span>
                    </label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {SIZE_PRESETS.map((preset) => (
                        <button key={preset.label} type="button" onClick={() => applyPreset(preset.sizes)}
                          style={{ fontSize: 11, padding: '4px 9px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 6, cursor: 'pointer', color: 'var(--gray-600)' }}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Edition grid — click to add/remove */}
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>Click editions to enable them:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                    {ALL_SIZES.map((s) => {
                      const editionNames = ['Hardcover', 'Paperback', 'eBook', 'Audiobook']
                      const enabled = form.sizeStocks.some((x) => x.size === s)
                      return (
                        <button key={s} type="button" onClick={() => toggleSize(s)}
                          style={{
                            padding: '6px 4px', fontSize: 12, fontWeight: enabled ? 700 : 500,
                            border: `1.5px solid ${enabled ? 'var(--black)' : 'var(--gray-200)'}`,
                            background: enabled ? 'var(--black)' : 'var(--white)',
                            color: enabled ? 'var(--white)' : 'var(--black)',
                            borderRadius: 6, cursor: 'pointer', transition: 'all 0.12s',
                          }}>
                          {editionNames[s - 1] ?? s}
                        </button>
                      )
                    })}
                  </div>

                  {/* Stock per size */}
                  {form.sizeStocks.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 8, fontSize: 12 }}>
                        <span style={{ color: 'var(--gray-600)', fontWeight: 600 }}>Bulk-set stock:</span>
                        <input
                          type="number"
                          min={0}
                          value={bulkStock}
                          onChange={(e) => setBulkStock(e.target.value)}
                          style={{ width: 70, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: 12 }}
                        />
                        <button type="button" onClick={applyBulkStock}
                          style={{ padding: '4px 12px', background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          Apply to all editions
                        </button>
                      </div>

                      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', padding: '8px 14px', background: 'var(--gray-50)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--gray-500)', borderBottom: '1px solid var(--gray-200)' }}>
                          <span>Edition</span>
                          <span>Stock</span>
                          <span style={{ textAlign: 'right' }}>Status</span>
                        </div>
                        {form.sizeStocks.map((item) => {
                          const status = item.stock === 0 ? 'Out' : item.stock < 5 ? 'Low' : 'OK'
                          const color = item.stock === 0 ? 'var(--red)' : item.stock < 5 ? '#f59e0b' : '#22c55e'
                          return (
                            <div key={item.size} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px', padding: '8px 14px', borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
                              <strong style={{ fontSize: 13 }}>{['Hardcover','Paperback','eBook','Audiobook'][item.size - 1] ?? `Ed. ${item.size}`}</strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button type="button" onClick={() => updateStock(item.size, -1)}
                                  style={{ width: 26, height: 26, border: '1px solid var(--gray-200)', borderRadius: 6, background: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Minus size={12} />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.stock}
                                  onChange={(e) => setStock(item.size, e.target.value)}
                                  style={{ width: 60, padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                                />
                                <button type="button" onClick={() => updateStock(item.size, 1)}
                                  style={{ width: 26, height: 26, border: '1px solid var(--gray-200)', borderRadius: 6, background: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Plus size={12} />
                                </button>
                                <button type="button" onClick={() => toggleSize(item.size)}
                                  style={{ marginLeft: 'auto', color: 'var(--gray-400)', padding: 4, cursor: 'pointer', background: 'none', border: 'none' }}>
                                  <X size={14} />
                                </button>
                              </div>
                              <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color, background: color + '22', padding: '3px 10px', borderRadius: 50, justifySelf: 'end' }}>
                                {status}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {form.sizeStocks.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
                      Select at least one edition for this product.
                    </p>
                  )}
                </div>

                <div className="form-group full"><label className="form-label">Description</label><textarea className="form-input" value={form.description} onChange={setField('description')} rows={3} style={{ resize: 'vertical' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
                <button onClick={close} className="btn btn-secondary btn-sm">Cancel</button>
                <button onClick={handleSave} className="btn btn-primary btn-sm" disabled={!form.name || !form.price || form.sizeStocks.length === 0 || saving}>
                  {saving ? <><span className="spinner" /> Saving…</> : modal === 'add' ? 'Add Product' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </RequirePermission>
      )}

      {deleteConfirm !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <Trash2 size={40} color="var(--red)" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Delete Product?</h3>
            <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>This hides the product from the store. Cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary btn-sm">Cancel</button>
              <Can do="products:delete">
                <button onClick={() => handleDelete(deleteConfirm!)} className="btn btn-danger btn-sm" disabled={saving}>
                  {saving ? <><span className="spinner" /> Deleting…</> : 'Delete'}
                </button>
              </Can>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
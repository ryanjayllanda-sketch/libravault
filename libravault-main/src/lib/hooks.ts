import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type { Product, Review, DeliveryAddress, OrderRow } from '../types'

// ── Generic hook factory ──────────────────────────────────────────────────────
function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { run() }, [run])
  return { data, loading, error, refetch: run }
}

// ── Products ──────────────────────────────────────────────────────────────────
export function useProducts() {
  return useAsync<Product[]>(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Product[]
  }, [])
}

export function useProduct(id: number) {
  return useAsync<Product | null>(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()
    if (error) throw error
    return data as Product
  }, [id])
}

// Admin: all products including inactive
export function useAdminProducts() {
  return useAsync<Product[]>(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Product[]
  }, [])
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export function useReviews(productId: number) {
  return useAsync<Review[]>(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        *,
        profiles ( full_name, email )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      userId: r.user_id,
      userName: r.profiles?.full_name || r.profiles?.email?.split('@')[0] || 'Anonymous',
      rating: r.rating,
      title: r.title,
      body: r.body,
      verified: r.verified,
      date: new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    })) as Review[]
  }, [productId])
}

// ── Addresses ─────────────────────────────────────────────────────────────────
export function useAddresses(userId: string | undefined) {
  return useAsync<DeliveryAddress[]>(async () => {
    if (!userId) return []
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
    if (error) throw error
    return (data ?? []).map((a: any) => ({
      id: a.id,
      label: a.label,
      fullName: a.full_name,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 ?? '',
      city: a.city,
      province: a.province,
      zip: a.zip,
      country: a.country,
      isDefault: a.is_default,
    })) as DeliveryAddress[]
  }, [userId])
}

// ── Orders ────────────────────────────────────────────────────────────────────
export function useOrders(userId: string | undefined) {
  return useAsync<OrderRow[]>(async () => {
    if (!userId) return []
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        addresses ( full_name, city, province ),
        order_items (
          qty,
          unit_price,
          edition,
          products ( name, image )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((o: any) => ({
      id: `#${o.id.slice(0, 8).toUpperCase()}`,
      rawId: o.id,
      customer: o.addresses?.full_name ?? '',
      email: '',
      items: o.order_items?.length ?? 0,
      amount: Number(o.total),
      status: o.status,
      date: new Date(o.created_at).toLocaleDateString(),
      address: o.addresses ? `${o.addresses.city}, ${o.addresses.province}` : '',
      orderItems: o.order_items ?? [],
    })) as any[]
  }, [userId])
}

// Admin: all orders — uses get_all_orders() SECURITY DEFINER RPC to bypass RLS
export function useAdminOrders() {
  return useAsync<any[]>(async () => {
    // get_all_orders() is SECURITY DEFINER and returns fully enriched rows
    // bypassing RLS entirely — no second query needed
    const { data, error } = await supabase.rpc('get_all_orders')
    if (error) throw new Error(`get_all_orders RPC failed: ${error.message}`)
    return (data ?? []).map((o: any) => ({
      id: `#${o.id.slice(0, 8).toUpperCase()}`,
      rawId: o.id,
      customer: o.customer_name || o.customer_email?.split('@')[0] || 'Unknown',
      email: o.customer_email ?? '',
      items: Number(o.item_count ?? 0),
      amount: Number(o.total),
      status: o.status,
      date: new Date(o.created_at).toLocaleDateString(),
      createdAt: o.created_at,
      address: [o.address_line1, o.address_city].filter(Boolean).join(', '),
      orderItems: [],
    }))
  }, [])
}

// Admin: order items detail for a specific order (used for drill-down)
export function useAdminOrderItems(orderId: string | undefined) {
  return useAsync<any[]>(async () => {
    if (!orderId) return []
    const { data, error } = await supabase
      .from('order_items')
      .select('qty, unit_price, products ( id, name, image, category )')
      .eq('order_id', orderId)
    if (error) return []
    return data ?? []
  }, [orderId])
}

// Admin: all users (uses SECURITY DEFINER RPC to bypass RLS)
export function useAdminUsers() {
  return useAsync<any[]>(async () => {
    const { data, error } = await supabase.rpc('get_all_profiles')
    if (error) throw error
    return data ?? []
  }, [])
}

// Admin: analytics aggregate — uses SECURITY DEFINER RPCs to bypass RLS
export function useAdminAnalytics() {
  return useAsync<any>(async () => {
    const [ordersRes, productsRes, profilesRes] = await Promise.all([
      supabase.rpc('get_all_orders'),                             // bypasses RLS
      supabase.from('products').select('id, name, price, stock, category'), // public read
      supabase.rpc('get_all_profiles'),                           // bypasses RLS
    ])

    if (ordersRes.error) throw new Error(`Orders RPC failed: ${ordersRes.error.message}`)

    const orders   = (ordersRes.data   ?? []) as any[]
    const products = (productsRes.data ?? []) as any[]
    const profiles = (profilesRes.data ?? []) as any[]

    const nonCancelled = orders.filter((o) => o.status !== 'Cancelled')
    const totalRevenue = nonCancelled.reduce((s, o) => s + Number(o.total), 0)

    // Monthly revenue for the current year (12 buckets)
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      return nonCancelled
        .filter((o) => {
          const d = new Date(o.created_at)
          return d.getMonth() + 1 === month && d.getFullYear() === new Date().getFullYear()
        })
        .reduce((s, o) => s + Number(o.total), 0)
    })

    return {
      totalRevenue,
      totalOrders:   orders.length,
      totalUsers:    profiles.filter((p: any) => p.role === 'customer').length,
      totalProducts: products.length,
      lowStockProducts: products.filter((p: any) => p.stock < 10),
      products,
      monthly,
    }
  }, [])
}


// Per-size stock for a product
export function useProductSizes(productId: number | undefined) {
  return useAsync<{ size: number; stock: number }[]>(async () => {
    if (!productId) return []
    const { data, error } = await supabase
      .from('product_editions')
      .select('edition, stock')
      .eq('product_id', productId)
      .order('edition', { ascending: true })
    if (error) throw error
    return (data ?? []).map((r: any) => ({ size: Number(r.edition ?? r.size), stock: Number(r.stock) }))
  }, [productId])
}
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useStore } from './store/useStore'
import { fetchProfileRole } from './lib/profileRole'
import { normalizeRole } from './lib/rbac'
import { RequireAuth, RequireAdmin, AccessDenied } from './components/Guards'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Toast from './components/Toast'
import CartModal from './components/CartModal'

import Landing from './pages/Landing'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Wishlist from './pages/Wishlist'
import Orders from './pages/Orders'
import Profile from './pages/Profile'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

import AdminUsers from './pages/admin/AdminUsers'
import AdminOrders from './pages/admin/AdminOrders'
import AdminCustomers from './pages/admin/AdminCustomers'
import AdminSellers from './pages/admin/AdminSellers'

import './index.css'

function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh' }}>{children}</div>
      <Footer />
      <CartModal />
    </>
  )
}


export default function App() {
  const { setUser } = useStore()

  useEffect(() => {
    let profileChannel: ReturnType<typeof supabase.channel> | null = null

    const watchProfileRole = (user: any) => {
      if (profileChannel) supabase.removeChannel(profileChannel)

      profileChannel = supabase
        .channel(`profile-role-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            setUser(user, normalizeRole(payload.new?.role))
          }
        )
        .subscribe()
    }

    const resolveUserAndRole = async (session: any) => {
      if (!session?.user) {
        if (profileChannel) {
          supabase.removeChannel(profileChannel)
          profileChannel = null
        }
        setUser(null, 'customer')
        return
      }

      try {
        setUser(session.user, await fetchProfileRole(session.user.id))
        watchProfileRole(session.user)
      } catch {
        setUser(session.user, 'customer')
        watchProfileRole(session.user)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveUserAndRole(session)
    })

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === 'SIGNED_OUT') setUser(null, 'customer')
        resolveUserAndRole(session)
      }
    )

    const refreshRoleOnFocus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      try {
        setUser(user, await fetchProfileRole(user.id))
      } catch {
        setUser(user, 'customer')
      }
    }

    window.addEventListener('focus', refreshRoleOnFocus)

    return () => {
      authSubscription.unsubscribe()
      window.removeEventListener('focus', refreshRoleOnFocus)
      if (profileChannel) supabase.removeChannel(profileChannel)
    }
  }, [setUser])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/register"        element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/access-denied"   element={<StoreLayout><AccessDenied fullPage /></StoreLayout>} />

        <Route path="/admin"           element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/users"     element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/orders"    element={<RequireAdmin><AdminOrders /></RequireAdmin>} />
        <Route path="/admin/customers" element={<RequireAdmin><AdminCustomers /></RequireAdmin>} />
        <Route path="/admin/sellers"   element={<RequireAdmin><AdminSellers /></RequireAdmin>} />
        <Route path="/admin/products"  element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/analytics" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/roles"     element={<Navigate to="/admin/users" replace />} />

        <Route path="/"             element={<Landing />} />
        <Route path="/home"         element={<StoreLayout><Home /></StoreLayout>} />
        <Route path="/products"     element={<StoreLayout><Products /></StoreLayout>} />
        <Route path="/products/:id" element={<StoreLayout><ProductDetail /></StoreLayout>} />

        <Route path="/cart"     element={<StoreLayout><RequireAuth><Cart /></RequireAuth></StoreLayout>} />
        <Route path="/checkout" element={<StoreLayout><RequireAuth><Checkout /></RequireAuth></StoreLayout>} />
        <Route path="/wishlist" element={<StoreLayout><RequireAuth><Wishlist /></RequireAuth></StoreLayout>} />
        <Route path="/orders"   element={<StoreLayout><RequireAuth><Orders /></RequireAuth></StoreLayout>} />
        <Route path="/profile"  element={<StoreLayout><RequireAuth><Profile /></RequireAuth></StoreLayout>} />
      </Routes>
      <Toast />
    </BrowserRouter>
  )
}

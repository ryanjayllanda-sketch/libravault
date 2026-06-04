# Mobile App Integration Guide

This document explains the changes needed in your Expo Go mobile app to work seamlessly with the web admin's seller approval workflow.

---

## Database Schema (Already Done ✓)

The Supabase schema already has all required columns and RPC functions. No changes needed in the database.

**Existing columns in `profiles` table:**
- `seller_status` — `'pending' | 'approved' | 'rejected' | null`
- `account_status` — `'active' | 'suspended'` (defaults to `'active'`)

**Existing RPC functions used by the web admin:**
- `admin_update_user_access(user_id, account_status, seller_status)` — approve/reject/suspend
- `admin_delete_user(user_id)` — delete a user
- `handle_new_user()` — trigger that auto-creates profile rows on signup

---

## How the Full Flow Works

```
Mobile App                         Supabase (shared DB)       Web Admin (Vercel)
────────────────────────────────   ────────────────────────   ─────────────────────────────
1. Seller registers                →  profiles row created     
   role = 'seller'                    seller_status = 'pending'
   seller_status = 'pending'       
                                                              2. Admin opens /admin/sellers
                                                                 Sees pending seller in list
                                                              3. Admin clicks "Approve"
                                   ←  seller_status = 'approved'
4. Real-time event fires
   Seller redirected to dashboard
```

---

## Required Changes in Mobile App

### 1. Update Registration Logic

**File:** `app/(auth)/register.tsx`

**Current code:**
```typescript
await supabase.from('profiles').upsert({
  id: data.user.id,
  email,
  full_name: name.trim(),
  role: accountType,
  updated_at: new Date().toISOString(),
})
```

**Updated code — add `seller_status`:**
```typescript
await supabase.from('profiles').upsert({
  id: data.user.id,
  email,
  full_name: name.trim(),
  role: accountType,
  seller_status: accountType === 'seller' ? 'pending' : null,  // ← ADD THIS
  updated_at: new Date().toISOString(),
})
```

> This ensures sellers appear in the admin's pending approval queue immediately after registering.

---

### 2. Add Seller Approval Gate

**File:** `app/(seller)/_layout.tsx`

Replace the current permission check with one that also checks `seller_status`:

```typescript
import { useEffect, useState } from 'react'
import { Redirect, Slot } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'

export default function SellerLayout() {
  const { user, role } = useStore()
  const [sellerStatus, setSellerStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || role !== 'seller') {
      setLoading(false)
      return
    }

    supabase
      .from('profiles')
      .select('seller_status')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setSellerStatus(data?.seller_status ?? null)
        setLoading(false)
      })
  }, [user, role])

  // Subscribe to real-time status changes from admin
  useEffect(() => {
    if (!user || role !== 'seller') return

    const channel = supabase
      .channel(`seller-status-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.seller_status
          if (newStatus) setSellerStatus(newStatus)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, role])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // Not logged in → go to login
  if (!user) return <Redirect href="/(auth)/login" />

  // Not a seller → go to home
  if (role !== 'seller') return <Redirect href="/" />

  // Pending or rejected → show waiting screen
  if (sellerStatus !== 'approved') return <Redirect href="/pending-approval" />

  // Approved → render seller dashboard
  return <Slot />
}
```

---

### 3. Create Pending Approval Screen

**File:** `app/pending-approval.tsx` — create this new file

```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useStore } from '@/store/useStore'

export default function PendingApprovalScreen() {
  const { user, logout } = useStore()

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Awaiting Approval</Text>
      <Text style={styles.message}>
        Your seller account is currently under review by our admin team.
        You will gain access to the seller dashboard once your account is approved.
      </Text>
      <Text style={styles.email}>{user?.email}</Text>

      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  icon: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  email: {
    fontSize: 13,
    color: '#9ca3af',
    fontFamily: 'monospace',
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
})
```

---

## Summary of Changes

| File | Change | Required? |
|------|--------|-----------|
| `app/(auth)/register.tsx` | Set `seller_status: 'pending'` for sellers on upsert | ✅ Yes |
| `app/(seller)/_layout.tsx` | Check `seller_status === 'approved'` before rendering | ✅ Yes |
| `app/(seller)/_layout.tsx` | Real-time subscription to `profiles` for status changes | ✅ Yes |
| `app/pending-approval.tsx` | New screen shown while seller is awaiting approval | ✅ Yes |

---

## Fix for Existing Sellers

If you have sellers already in the database whose `seller_status` is `null` (registered before this change), run this SQL once in Supabase → SQL Editor:

```sql
-- Approve all existing sellers that are still null (they were trusted before)
UPDATE public.profiles
SET seller_status = 'approved'
WHERE role = 'seller' AND seller_status IS NULL;
```

Or if you want them to go through the approval process:

```sql
-- Put all null-status sellers back to pending
UPDATE public.profiles
SET seller_status = 'pending'
WHERE role = 'seller' AND seller_status IS NULL;
```

---

## Testing the Integration

1. **Mobile:** Register a new account with "Seller" selected
2. **Mobile:** Confirm you land on the "Awaiting Approval" screen
3. **Web Admin:** Log in → go to `/admin/sellers`
4. **Web Admin:** Find the seller (status shows `pending`)
5. **Web Admin:** Click **Approve**
6. **Mobile:** Screen updates automatically (real-time) → seller enters dashboard
7. **Mobile:** Log out and log back in → goes straight to seller dashboard

---

## Common Issues

**Seller logs in but still sees the pending screen after being approved**
- Check the real-time subscription is set up in `_layout.tsx`
- Alternatively, add a "Refresh" button on the pending screen that re-fetches `seller_status` from `profiles`

**`seller_status` is still `null` after registering**
- Make sure the upsert in `register.tsx` includes `seller_status`
- Check the `handle_new_user` trigger in Supabase — it also sets `seller_status = 'pending'` for sellers automatically, so the column should populate either way

**Sellers blocked from logging in entirely**
- The approval gate should only block access to seller **routes**, not the login screen itself
- Ensure `app/(auth)/login.tsx` is outside the `(seller)` route group

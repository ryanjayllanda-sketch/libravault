/**
 * adminHelpers.ts
 *
 * Pure helper functions extracted from admin page components to enable independent
 * unit and property-based testing without rendering full components.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'seller' | 'customer'
  account_status: 'active' | 'suspended'
  seller_status: 'pending' | 'approved' | 'rejected' | null
  created_at: string
}

export interface EditForm {
  full_name: string
  email: string
  seller_status: 'pending' | 'approved' | 'rejected'
  account_status: 'active' | 'suspended'
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

/**
 * Returns profiles where role === targetRole exactly.
 * Validates: Requirements 2.4, 3.4
 */
export function filterByRole(
  profiles: Profile[],
  role: 'customer' | 'seller',
): Profile[] {
  return profiles.filter((p) => p.role === role)
}

/**
 * Returns profiles where full_name or email contains the query string
 * (case-insensitive).
 * Validates: Requirements 2.7, 3.6
 */
export function filterBySearch(profiles: Profile[], query: string): Profile[] {
  const q = query.toLowerCase()
  return profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q),
  )
}

// ---------------------------------------------------------------------------
// Order count aggregation
// ---------------------------------------------------------------------------

/**
 * Builds a frequency map of order counts keyed by customer email.
 * Validates: Requirements 2.6
 */
export function buildOrderCountByEmail(orders: { email: string }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const order of orders) {
    map.set(order.email, (map.get(order.email) ?? 0) + 1)
  }
  return map
}

// ---------------------------------------------------------------------------
// Edit form initialisation
// ---------------------------------------------------------------------------

/**
 * Pre-populates the edit form with the seller's current field values.
 * Null full_name / email fall back to empty string.
 * Validates: Requirements 3.9
 */
export function buildInitialEditForm(
  seller: Pick<Profile, 'full_name' | 'email' | 'seller_status' | 'account_status'>,
): EditForm {
  return {
    full_name: seller.full_name ?? '',
    email: seller.email ?? '',
    seller_status: seller.seller_status ?? 'pending',
    account_status: seller.account_status,
  }
}

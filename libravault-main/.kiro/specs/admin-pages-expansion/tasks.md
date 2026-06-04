# Implementation Plan: Admin Pages Expansion

## Overview

Expand the LibraVault admin dashboard from two pages to five by wiring up the dormant `AdminOrders.tsx` and building two new page components (`AdminCustomers.tsx`, `AdminSellers.tsx`). Changes touch four layers: `rbac.ts` (permissions + nav), `App.tsx` (routes), new page components, and a shared `adminHelpers.ts` module that makes the filter/aggregation logic independently testable via property-based tests using Vitest + fast-check.

## Tasks

- [x] 1. Update `rbac.ts` — permissions, nav items, and role array
  - Add `customers:read` and `sellers:manage` to the `Permission` union type
  - Add `orders:read`, `orders:update_status`, `customers:read`, and `sellers:manage` to `ROLE_PERMISSIONS['admin']`
  - Import `ShoppingBag`, `UserCheck`, `Store` from lucide-react alongside the existing imports
  - Replace the existing two-item `ADMIN_NAV_ITEMS` array with the five-item ordered array: Dashboard → Orders → Customers → Sellers → Users, using the correct icons and permissions from the design
  - _Requirements: 1.2, 1.3, 1.6, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1_

  - [x] 1.1 Add new permissions to `Permission` union and `ROLE_PERMISSIONS`
    - Extend the `Permission` union type with `'customers:read'` and `'sellers:manage'`
    - Add `'orders:read'`, `'orders:update_status'`, `'customers:read'`, `'sellers:manage'` to the admin array in `ROLE_PERMISSIONS`
    - _Requirements: 1.2, 1.6, 2.1, 3.1, 4.1, 4.2_

  - [x] 1.2 Update `ADMIN_NAV_ITEMS` to five items in display order
    - Import `ShoppingBag`, `UserCheck`, `Store` from lucide-react (keep `LayoutDashboard` and `Users`)
    - Replace the two-item array with the five-item array in the order: Dashboard, Orders, Customers, Sellers, Users
    - _Requirements: 1.3, 2.2, 3.2, 5.1_

  - [ ]* 1.3 Write property tests for RBAC correctness (Properties 1, 2, 7, 8)
    - Create `src/__tests__/rbac.test.ts` with Vitest + fast-check
    - **Property 1: `hasPermission` returns `true` iff permission is in `ROLE_PERMISSIONS[role]`**
    - **Validates: Requirements 1.2, 1.6, 2.1, 3.1, 4.2, 4.3, 4.4**
    - **Property 2: visibleNav contains item iff `hasPermission(role, item.permission)`**
    - **Validates: Requirements 1.4, 4.5**
    - **Property 7: badge metadata returns exact color and label for all valid status values**
    - **Validates: Requirements 3.17**
    - **Property 8: `ADMIN_NAV_ITEMS` paths satisfy the strict ordering invariant**
    - **Validates: Requirements 5.1**
    - Configure Vitest in `vite.config.ts` with `environment: 'jsdom'` and add `"test": "vitest --run"` script to `package.json`
    - Install dev dependencies: `vitest @testing-library/react @testing-library/user-event jsdom fast-check`

- [x] 2. Create `src/lib/adminHelpers.ts` — pure helper functions for testable logic
  - Extract and export the following pure functions (components will import them):
    - `filterByRole(profiles: Profile[], role: 'customer' | 'seller'): Profile[]` — filters by exact role match
    - `filterBySearch(profiles: Profile[], query: string): Profile[]` — case-insensitive name/email filter
    - `buildOrderCountByEmail(orders: { email: string }[]): Map<string, number>` — frequency map keyed on email
    - `buildInitialEditForm(seller: Pick<Profile, 'full_name' | 'email' | 'seller_status' | 'account_status'>): EditForm` — returns pre-populated form with `''` for null fields
  - Export the `Profile` interface and `EditForm` interface from this module for use in components and tests
  - _Requirements: 2.4, 2.6, 2.7, 3.4, 3.6, 3.9_

  - [x] 2.1 Implement `filterByRole` and `filterBySearch` helpers
    - Write `filterByRole`: returns profiles where `p.role === targetRole`, exactly
    - Write `filterBySearch`: returns profiles where `full_name?.toLowerCase().includes(q)` OR `email?.toLowerCase().includes(q)` with `q = query.toLowerCase()`
    - _Requirements: 2.4, 2.7, 3.4, 3.6_

  - [ ]* 2.2 Write property tests for profile filtering (Properties 3 and 4)
    - Create `src/__tests__/profileFilter.test.ts`
    - **Property 3: `filterByRole` returns exactly those profiles with the matching role — no inclusions, no exclusions**
    - **Validates: Requirements 2.4, 3.4**
    - **Property 4: `filterBySearch` is case-insensitive and includes all matching profiles and excludes all non-matching**
    - **Validates: Requirements 2.7, 3.6**

  - [x] 2.3 Implement `buildOrderCountByEmail` and `buildInitialEditForm` helpers
    - Write `buildOrderCountByEmail`: iterates orders and builds a `Map<string, number>` counting by email
    - Write `buildInitialEditForm`: returns `{ full_name: seller.full_name ?? '', email: seller.email ?? '', seller_status: seller.seller_status, account_status: seller.account_status }`
    - _Requirements: 2.6, 3.9_

  - [ ]* 2.4 Write property tests for order count aggregation and edit form init (Properties 5 and 6)
    - Create `src/__tests__/orderCount.test.ts` for Property 5
    - Create `src/__tests__/sellerEditForm.test.ts` for Property 6
    - **Property 5: `buildOrderCountByEmail` count for any email equals the exact number of order rows with that email; zero for unmatched emails**
    - **Validates: Requirements 2.6**
    - **Property 6: `buildInitialEditForm` pre-populates every field with the seller's exact value; null fields become `''`**
    - **Validates: Requirements 3.9**

- [x] 3. Update `App.tsx` — remove redirect, add three new routes
  - Remove `<Route path="/admin/orders" element={<Navigate to="/admin/users" replace />} />`
  - Add imports for `AdminOrders`, `AdminCustomers`, `AdminSellers`
  - Register routes: `/admin/orders` → `<RequireAdmin><AdminOrders /></RequireAdmin>`, `/admin/customers` → `<RequireAdmin><AdminCustomers /></RequireAdmin>`, `/admin/sellers` → `<RequireAdmin><AdminSellers /></RequireAdmin>`
  - Also update `/admin` default route to point to `Dashboard` (or keep as `AdminUsers` if no `Dashboard` import yet — keep existing behavior for `/admin`)
  - _Requirements: 1.1, 1.5, 2.3, 3.3, 5.2, 5.3, 5.4_

- [x] 4. Create `src/pages/admin/AdminCustomers.tsx`
  - Follow the `AdminUsers.tsx` structure exactly (same `runAction` pattern, same error banner, same loading spinner, same CSS classes)
  - Use `useAdminUsers()` and `useAdminOrders()` hooks; derive `customers` via `filterByRole`, derive `filtered` via `filterBySearch`, derive `orderCountByEmail` via `buildOrderCountByEmail` wrapped in `useMemo`
  - Implement debounce-free immediate search (search state drives `filterBySearch` directly)
  - Render section header with total customer count and suspended count
  - Render table columns: User (avatar + name + email), Account Status badge, Orders (count), Joined, Actions
  - Actions per row: Suspend (when active), Reactivate (when suspended), Delete (with `confirm()`)
  - Render empty states: "No customers match your search." when search active with no results; "No customers found." when list is globally empty
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14_

  - [x] 4.1 Implement component skeleton, data loading, and search
    - Scaffold component with correct imports and hooks
    - Implement `customers`, `filtered`, and `orderCountByEmail` derivations using helpers from `adminHelpers.ts`
    - Render loading spinner, error banner, search input, and section header
    - _Requirements: 2.3, 2.4, 2.5, 2.7, 2.11, 2.12_

  - [x] 4.2 Implement customer table, action handlers, and empty states
    - Render `admin-table` with all columns including the order count cell
    - Implement `runAction`, `handleSuspend`, `handleReactivate`, and `handleDelete` with correct API calls (`updateUserAccess`, `deleteUserAccount`)
    - Add both empty-state messages with correct conditional logic
    - _Requirements: 2.5, 2.6, 2.8, 2.9, 2.10, 2.13, 2.14_

  - [ ]* 4.3 Write component example tests for `AdminCustomers`
    - Create `src/__tests__/adminCustomers.test.tsx`
    - Test: loading spinner renders while `useAdminUsers` is loading
    - Test: customer rows show correct order count from mocked order data
    - Test: Suspend button calls `updateUserAccess` with `account_status: 'suspended'`
    - Test: Delete button triggers `confirm()` then calls `deleteUserAccount`
    - Test: empty state "No customers found." renders when user list is empty
    - _Requirements: 2.8, 2.9, 2.10, 2.12, 2.14_

- [x] 5. Checkpoint — ensure existing tests pass and TypeScript compiles
  - Run `npm run build` (tsc + vite build) to confirm no TypeScript errors in `rbac.ts`, `App.tsx`, and `AdminCustomers.tsx`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create `src/pages/admin/AdminSellers.tsx`
  - Follow the `AdminUsers.tsx` structure with the additions required by the design: debounced search, Edit modal, approve/reject actions, and the two-call save logic
  - Use `useAdminUsers()` hook; derive `sellers` via `filterByRole`, derive `filtered` using `debouncedSearch` via `filterBySearch`
  - Implement 300ms debounce for search using `useEffect` + `setTimeout` (no external library)
  - Implement Edit modal with controlled form state (`editSeller`, `editForm`), pre-populated via `buildInitialEditForm`
  - Edit save logic: call `updateUserAccess` first, then `supabase.from('profiles').update(...)` for name/email; close modal and refetch only on full success
  - Render section header: total seller count, pending count, suspended count
  - Render table columns: Seller (avatar + name + email), Seller Status badge, Account Status badge, Joined, Actions
  - Actions per row: Approve (when pending/rejected), Reject (when pending/approved), Edit, Suspend (when active), Reactivate (when suspended), Delete
  - `SELLER_STATUS_META` and `ACCOUNT_STATUS_META` constants defined locally, matching exact color values from design (`#d97706`, `#16a34a`, `#dc2626`)
  - No "Add Seller" button
  - Render empty states: "No sellers match your search." / "No sellers found."
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14, 3.15, 3.16, 3.17, 3.18_

  - [x] 6.1 Implement component skeleton, debounced search, and data loading
    - Scaffold component with all state variables and debounce `useEffect`
    - Implement `sellers` and `filtered` derivations; render loading spinner, error banner, section header, and search input
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.15_

  - [x] 6.2 Implement seller table with status badges and approve/reject/suspend/reactivate/delete actions
    - Render `admin-table` with all columns
    - Define `SELLER_STATUS_META` and `ACCOUNT_STATUS_META` constants with exact hex colors from the design
    - Implement `runAction`, and all action handlers: `handleApprove`, `handleReject`, `handleSuspend`, `handleReactivate`, `handleDelete`
    - Add both empty-state messages
    - _Requirements: 3.5, 3.7, 3.8, 3.11, 3.12, 3.13, 3.16, 3.17, 3.18_

  - [x] 6.3 Implement Edit modal with pre-population and two-call save logic
    - Add modal overlay with controlled form inputs for `full_name`, `email`, `seller_status` select, `account_status` select
    - Pre-populate via `buildInitialEditForm` from `adminHelpers.ts` when Edit button is clicked
    - Implement save handler: call `updateUserAccess` then `supabase.from('profiles').update`, close modal and refetch on success, surface error in banner (modal stays open on failure)
    - _Requirements: 3.9, 3.10, 3.14_

  - [ ]* 6.4 Write component example tests for `AdminSellers`
    - Create `src/__tests__/adminSellers.test.tsx`
    - Test: loading spinner renders while data is loading
    - Test: Approve button calls `updateUserAccess` with `seller_status: 'approved'`
    - Test: Reject button calls `updateUserAccess` with `seller_status: 'rejected'`
    - Test: Edit button opens modal pre-populated with seller's current values
    - Test: empty state "No sellers found." renders when seller list is empty
    - Test: error banner appears on failed action without closing the modal
    - _Requirements: 3.7, 3.8, 3.9, 3.14, 3.15, 3.16_

- [x] 7. Final checkpoint — full build and test suite
  - Run `npm run build` to confirm zero TypeScript errors across all modified and new files
  - Run `npm run test` (Vitest) to confirm all property-based and example tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major layer change
- Property-based tests (fast-check) validate universal correctness properties across all valid inputs; unit/example tests validate specific behaviors and wiring
- The `adminHelpers.ts` module is the key extraction that makes Properties 3–6 independently testable without rendering full components
- `SELLER_STATUS_META` and `ACCOUNT_STATUS_META` are defined locally in `AdminSellers.tsx` to match the pattern already established in `AdminUsers.tsx`
- The debounce in `AdminSellers` is implemented with `useEffect` + `setTimeout`/`clearTimeout` — no external debounce library needed
- Install test dependencies before running tests: `npm install --save-dev vitest @testing-library/react @testing-library/user-event jsdom fast-check`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.4"] },
    { "id": 3, "tasks": ["4.1", "6.1"] },
    { "id": 4, "tasks": ["4.2", "6.2"] },
    { "id": 5, "tasks": ["4.3", "6.3"] },
    { "id": 6, "tasks": ["6.4"] }
  ]
}
```

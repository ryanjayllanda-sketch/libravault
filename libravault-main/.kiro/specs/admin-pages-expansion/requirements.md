# Requirements Document

## Introduction

LibraVault is a React + TypeScript + Supabase e-commerce application for books with a web admin dashboard (Vercel) and a mobile app (Expo Go). Both share the same Supabase database. The admin dashboard currently exposes two pages — Dashboard and Users — and has an undocumented `AdminOrders.tsx` component that is routed away to `/admin/users`. This feature expands the admin dashboard with three properly integrated pages:

1. **Orders** — Wire up the existing `AdminOrders.tsx` with its own route, sidebar entry, and RBAC permission.
2. **Customers** — A dedicated page listing only users whose role is `customer`, with view, suspend/reactivate, and delete actions plus an order-count summary.
3. **Sellers** — A dedicated page listing users whose role is `seller`, with view, approve/reject (via `seller_status`), edit profile, suspend/reactivate (via `account_status`), and delete actions. Sellers register via the mobile app with `seller_status: 'pending'` and cannot access seller features until an admin approves them on the web dashboard.

All three pages sit inside the `AdminLayout` shell, are guarded by `RequireAdmin`, and are driven by the same `hasPermission()` / `ADMIN_NAV_ITEMS` pattern already used by the Users page. The existing Supabase schema already includes `account_status` and `seller_status` columns and all necessary RPC functions (`admin_update_user_access`, `admin_update_user_role`, `admin_delete_user`).

---

## Glossary

- **Admin_Dashboard**: The admin section of LibraVault, accessible at `/admin/**`, rendered inside `AdminLayout`.
- **RBAC_System**: The role-based access control implementation in `rbac.ts` that defines `ROLE_PERMISSIONS`, `hasPermission()`, and `ADMIN_NAV_ITEMS`.
- **Sidebar_Nav**: The left-hand navigation rendered by `AdminLayout` from `ADMIN_NAV_ITEMS`, filtered by `hasPermission()`.
- **Orders_Page**: The admin page at `/admin/orders` that displays all platform orders and allows status progression.
- **Customers_Page**: The admin page at `/admin/customers` that lists all users with role `customer`.
- **Sellers_Page**: The admin page at `/admin/sellers` that lists all users with role `seller` and supports view, approve/reject, edit profile, suspend/reactivate, and delete operations.
- **Profile**: A row in the Supabase `profiles` table containing `id`, `full_name`, `email`, `role`, `account_status`, `seller_status`, and `created_at`.
- **OrderRow**: The TypeScript type representing a flattened order record returned by `useAdminOrders()`.
- **Seller_Status**: The `seller_status` field on a Profile; one of `pending`, `approved`, or `rejected`. Set to `pending` when a seller registers via the mobile app; changed to `approved` by admin to grant access, or `rejected` to deny access.
- **Account_Status**: The `account_status` field on a Profile; one of `active` or `suspended`. Set to `suspended` to block a user from logging in.
- **Permission**: A string key defined in the `Permission` union type in `rbac.ts`, checked by `hasPermission()`.
- **useAdminUsers**: The existing React hook that calls `supabase.rpc('get_all_profiles')` and returns all profiles.
- **useAdminOrders**: The existing React hook that fetches all orders with profile, address, and item joins.
- **AdminOrders**: The existing `AdminOrders.tsx` component that is currently routed to `/admin/users` via `Navigate`.

---

## Requirements

### Requirement 1: Orders Page Route and Navigation

**User Story:** As an admin, I want a dedicated Orders page in the sidebar so that I can navigate directly to `/admin/orders` without being redirected.

#### Acceptance Criteria

1. WHEN an admin navigates to `/admin/orders`, THE Admin_Dashboard SHALL render the `AdminOrders` component instead of redirecting to `/admin/users`.
2. THE RBAC_System SHALL add `orders:read` to `ROLE_PERMISSIONS['admin']` so that `hasPermission('admin', 'orders:read')` returns `true` (the `orders:read` value already exists in the `Permission` union type).
3. THE RBAC_System SHALL include an `AdminNavItem` for the Orders_Page with path `/admin/orders`, label `Orders`, icon `ShoppingBag` from lucide-react, and permission `orders:read`.
4. WHEN the logged-in user has permission `orders:read`, THE Sidebar_Nav SHALL display the Orders nav link.
5. THE Admin_Dashboard SHALL protect the `/admin/orders` route by wrapping `AdminOrders` in a `RequireAdmin` component, matching the pattern used for `/admin/users`.
6. THE RBAC_System SHALL add `orders:update_status` to `ROLE_PERMISSIONS['admin']` (the value already exists in the `Permission` union type), enabling the status-change controls already present in `AdminOrders`.

### Requirement 2: Customers Page

**User Story:** As an admin, I want a Customers page that shows only customer-role users so that I can manage customer accounts separately from all other roles.

#### Acceptance Criteria

1. THE RBAC_System SHALL add `customers:read` to the `Permission` union type and to `ROLE_PERMISSIONS['admin']`.
2. THE RBAC_System SHALL include an `AdminNavItem` for the Customers_Page with path `/admin/customers`, label `Customers`, icon `Users` or `UserCheck` from lucide-react, and permission `customers:read`.
3. WHEN an admin navigates to `/admin/customers`, THE Admin_Dashboard SHALL render the `AdminCustomers` component inside `AdminLayout`.
4. WHEN the Customers_Page loads, THE Customers_Page SHALL display only Profile records where `role` equals `customer`, fetched via `useAdminUsers()` and filtered client-side.
5. THE Customers_Page SHALL display each customer's full name (or "(no name)" if absent), email address, Account_Status badge, and join date for each row.
6. THE Customers_Page SHALL display a total order count per customer derived from `useAdminOrders()` data; customers with no orders SHALL show a count of `0`.
7. THE Customers_Page SHALL provide a text search input that, on each keystroke, filters the displayed customer list to only rows whose full name or email contains the query string (case-insensitive).
8. WHEN an admin clicks Suspend on a customer whose `account_status` is `active`, THE Customers_Page SHALL call `updateUserAccess(id, { account_status: 'suspended' })` and, only on success, refresh the list; IF the call fails, THE list SHALL remain unchanged.
9. WHEN an admin clicks Reactivate on a customer whose `account_status` is `suspended`, THE Customers_Page SHALL call `updateUserAccess(id, { account_status: 'active' })` and, only on success, refresh the list; IF the call fails, THE list SHALL remain unchanged.
10. WHEN an admin confirms deletion via a browser `confirm()` prompt, THE Customers_Page SHALL call `deleteUserAccount(id)` and, only on success, remove that customer from the displayed list; IF the call fails, THE list SHALL remain unchanged.
11. IF a data-fetch or action call fails, THEN THE Customers_Page SHALL display a dismissible inline error banner surfacing the failure reason (error message string), matching the error display pattern in `AdminUsers`.
12. WHILE the Customers_Page is loading data, THE Customers_Page SHALL display a centered `Loader` spinner matching the pattern used in `AdminOrders`.
13. WHEN no customers match the current search query, THE Customers_Page SHALL display an empty-state message "No customers match your search."
14. WHEN the full customer list is empty (no customers exist at all), THE Customers_Page SHALL display an empty-state message "No customers found."

### Requirement 3: Sellers Page

**User Story:** As an admin, I want a Sellers page that shows only seller-role users and lets me approve/reject registrations, edit profiles, suspend/reactivate accounts, and delete sellers so that I can manage seller access and roster from the dashboard.

#### Acceptance Criteria

1. THE RBAC_System SHALL add `sellers:manage` to the `Permission` union type and to `ROLE_PERMISSIONS['admin']`.
2. THE RBAC_System SHALL include an `AdminNavItem` for the Sellers_Page with path `/admin/sellers`, label `Sellers`, icon `Store` from lucide-react, and permission `sellers:manage`.
3. WHEN an admin navigates to `/admin/sellers`, THE Admin_Dashboard SHALL render the `AdminSellers` component inside `AdminLayout`.
4. WHEN the Sellers_Page loads, THE Sellers_Page SHALL display only Profile records where `role` equals `seller`, fetched via `useAdminUsers()` and filtered client-side.
5. THE Sellers_Page SHALL display each seller's full name (or "(no name)" if absent), email address, Seller_Status badge, Account_Status badge, and join date in each row.
6. THE Sellers_Page SHALL provide a text search input that, within 300ms of each keystroke, filters the displayed seller list to only rows whose full name or email contains the query string (case-insensitive).
7. WHEN an admin clicks Approve on a seller row whose `seller_status` is `pending` or `rejected`, THE Sellers_Page SHALL call `updateUserAccess(id, { seller_status: 'approved' })` and, only on success, refresh the list.
8. WHEN an admin clicks Reject on a seller row whose `seller_status` is `pending` or `approved`, THE Sellers_Page SHALL call `updateUserAccess(id, { seller_status: 'rejected' })` and, only on success, refresh the list.
9. WHEN an admin clicks Edit on a seller row, THE Sellers_Page SHALL open a modal form pre-populated with that seller's full name, email, Seller_Status, and Account_Status.
10. WHEN the admin saves the Edit Seller form, THE Sellers_Page SHALL call `updateUserAccess(id, { seller_status, account_status })` for status changes and `supabase.from('profiles').update({ full_name, email }).eq('id', id)` for name/email changes, then only on success close the modal and refresh the list.
11. WHEN an admin clicks Suspend on a seller whose `account_status` is `active`, THE Sellers_Page SHALL call `updateUserAccess(id, { account_status: 'suspended' })` and, only on success, refresh the list; IF the call fails, THE list SHALL remain unchanged.
12. WHEN an admin clicks Reactivate on a seller whose `account_status` is `suspended`, THE Sellers_Page SHALL call `updateUserAccess(id, { account_status: 'active' })` and, only on success, refresh the list; IF the call fails, THE list SHALL remain unchanged.
13. WHEN an admin confirms deletion via a browser `confirm()` prompt, THE Sellers_Page SHALL call `deleteUserAccount(id)` and, only after the call succeeds, remove that seller from the displayed list; IF the call fails or is blocked by the server, THE list SHALL remain unchanged and an error message SHALL be shown.
14. IF any seller action (approve, reject, edit, suspend, reactivate, delete) fails, THEN THE Sellers_Page SHALL display a dismissible inline error message surfacing the failure reason, without closing any open modal.
15. WHILE the Sellers_Page is loading data, THE Sellers_Page SHALL display a centered `Loader` spinner matching the pattern used in `AdminOrders`.
16. WHEN the filtered list is empty (due to search), THE Sellers_Page SHALL display "No sellers match your search." WHEN the full seller list is empty, THE Sellers_Page SHALL display "No sellers found."
17. THE Sellers_Page SHALL render Seller_Status badges using colors `#d97706` (pending), `#16a34a` (approved), `#dc2626` (rejected) and Account_Status badges using colors `#16a34a` (active), `#dc2626` (suspended), matching the `SELLER_STATUS_META` and `ACCOUNT_STATUS_META` constants in `AdminUsers`.
18. THE Sellers_Page SHALL NOT include an "Add Seller" button; sellers can only be created via mobile app registration.

### Requirement 4: RBAC Consistency

**User Story:** As a developer, I want all new admin permissions to be centrally declared in `rbac.ts` so that the permission model remains the single source of truth.

#### Acceptance Criteria

1. THE RBAC_System SHALL declare `customers:read` and `sellers:manage` in the `Permission` union type in `rbac.ts` (these do not yet exist); `orders:read` and `orders:update_status` already exist in the union type and SHALL NOT be duplicated.
2. THE RBAC_System SHALL add `orders:read`, `orders:update_status`, `customers:read`, and `sellers:manage` to the `admin` array in `ROLE_PERMISSIONS`.
3. WHEN `hasPermission('admin', p)` is called for any of `orders:read`, `orders:update_status`, `customers:read`, or `sellers:manage`, THE RBAC_System SHALL return `true`.
4. WHEN `hasPermission('seller', p)` or `hasPermission('customer', p)` is called for any of the new permissions, THE RBAC_System SHALL return `false` because neither role has these permissions in `ROLE_PERMISSIONS`.
5. WHERE `AdminLayout` computes `visibleNav` by calling `ADMIN_NAV_ITEMS.filter((item) => hasPermission(role, item.permission))`, THE Sidebar_Nav SHALL render the Orders, Customers, and Sellers nav links only when the logged-in user's role is `admin`.

### Requirement 5: Navigation Order and Routing

**User Story:** As an admin, I want the sidebar to list pages in a logical order and all admin URLs to be properly registered so that navigation is predictable.

#### Acceptance Criteria

1. THE `ADMIN_NAV_ITEMS` array in `rbac.ts` SHALL list items in the order: Dashboard (`/admin`) → Orders (`/admin/orders`) → Customers (`/admin/customers`) → Sellers (`/admin/sellers`) → Users (`/admin/users`), so that `AdminLayout` renders them in that sequence.
2. THE `App.tsx` SHALL register `<Route path="/admin/orders" element={<RequireAdmin><AdminOrders /></RequireAdmin>} />`, `<Route path="/admin/customers" element={<RequireAdmin><AdminCustomers /></RequireAdmin>} />`, and `<Route path="/admin/sellers" element={<RequireAdmin><AdminSellers /></RequireAdmin>} />`.
3. THE `App.tsx` SHALL remove the `<Route path="/admin/orders" element={<Navigate to="/admin/users" replace />} />` redirect that currently prevents `AdminOrders` from rendering.
4. WHEN an unauthenticated user navigates to `/admin/orders`, `/admin/customers`, or `/admin/sellers`, THE `RequireAdmin` guard SHALL redirect to `/login`. WHEN an authenticated user whose role is not `admin` navigates to any of these routes, THE `RequireAdmin` guard SHALL redirect to `/access-denied`.

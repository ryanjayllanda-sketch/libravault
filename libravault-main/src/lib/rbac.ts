import { LayoutDashboard, ShoppingBag, UserCheck, Store, Users } from 'lucide-react'

export type Role = 'customer' | 'seller' | 'admin'

export const ROLES = ['customer', 'seller', 'admin'] as const

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role)
}

export function normalizeRole(value: unknown): Role {
  return isRole(value) ? value : 'customer'
}

export type Permission =
  | 'admin:access'
  | 'products:read'
  | 'products:create'
  | 'products:update'
  | 'products:delete'
  | 'orders:read'
  | 'orders:update_status'
  | 'orders:delete'
  | 'users:read'
  | 'users:update_role'
  | 'users:update_status'
  | 'users:delete'
  | 'analytics:read'
  | 'customers:read'
  | 'sellers:manage'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'admin:access',
    'orders:read',
    'customers:read',
    'sellers:manage',
    'users:read',
    'users:update_role',
    'users:update_status',
    'users:delete',
  ],
  seller: [],
  customer: [],
}

export interface RoleMeta {
  label: string
  color: string
  bg: string
  description: string
  rank: number
}

export const ROLE_META: Record<Role, RoleMeta> = {
  admin: {
    label: 'Admin',
    color: '#7c3aed',
    bg: '#7c3aed18',
    description: 'Approves sellers and manages user access',
    rank: 2,
  },
  seller: {
    label: 'Seller',
    color: '#2563eb',
    bg: '#2563eb18',
    description: 'Mobile app seller account',
    rank: 1,
  },
  customer: {
    label: 'Customer',
    color: '#737373',
    bg: '#73737318',
    description: 'Mobile app customer account',
    rank: 0,
  },
}

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function hasAllPermissions(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

export function canModifyRole(actorRole: Role, targetRole: Role): boolean {
  return actorRole === 'admin' && targetRole !== 'admin'
}

export interface AdminNavItem {
  to: string
  label: string
  icon: React.ElementType
  permission: Permission
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin',           label: 'Dashboard', icon: LayoutDashboard, permission: 'admin:access'   },
  { to: '/admin/orders',    label: 'Orders',    icon: ShoppingBag,     permission: 'orders:read'    },
  { to: '/admin/customers', label: 'Customers', icon: UserCheck,       permission: 'customers:read' },
  { to: '/admin/sellers',   label: 'Sellers',   icon: Store,           permission: 'sellers:manage' },
  { to: '/admin/users',     label: 'Users',     icon: Users,           permission: 'users:read'     },
]

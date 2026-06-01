import { supabase } from './supabase'
import { normalizeRole } from './rbac'
import type { Role } from './rbac'

export async function fetchProfileRole(userId: string): Promise<Role> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return normalizeRole(data?.role)
}

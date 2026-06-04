import { supabase } from './supabase'

const TABLE = 'actions_log'

export async function logAction({ type, description, metadata = {} }) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from(TABLE).insert({
      user_id: user.id,
      type,
      description,
      metadata,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Silencieux — le log ne doit jamais bloquer l'app
  }
}

export async function getActionsLog(limit = 50) {
  try {
    const { data } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  } catch {
    return []
  }
}

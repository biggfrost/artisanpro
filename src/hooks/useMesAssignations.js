import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'

// Récupère les assignations de l'utilisateur connecté (l'ouvrier).
// RLS sur assignations laisse passer les rows où ouvrier_id = auth.uid().
export function useMesAssignations() {
  const [assignations, setAssignations] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error } = await supabase
      .from('assignations')
      .select(`
        id, ouvrier_id, chantier_id, date_debut, date_fin, notes, created_at,
        chantier:chantiers ( id, nom, statut, adresse, code_postal, ville, avancement, description, notes, client_nom )
      `)
      .eq('ouvrier_id', user.id)
      .order('date_debut', { ascending: false })
    if (error) setError(error.message)
    else       setAssignations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { assignations, loading, error, refresh }
}

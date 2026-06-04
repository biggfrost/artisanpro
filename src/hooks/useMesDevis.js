import { useCallback, useEffect, useState } from 'react'
import { listMesDevisCreated, normalizeDevis, createDevisComplet, updateDevisStatut } from '../services/devisService'

// Strictement filtré par cree_par = auth.uid() (filtre client-side en plus
// de RLS). Garantit qu'un ouvrier ne voit que les devis qu'il a lui-même émis.
export function useMesDevis() {
  const [devis,   setDevis]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await listMesDevisCreated()
    if (error) setError(error.message)
    else       setDevis(data.map(normalizeDevis))
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function addDevis(form) {
    const { data, error } = await createDevisComplet(form)
    if (data) setDevis((prev) => [data, ...prev])
    return { data, error }
  }

  async function setStatut(id, statut) {
    const { error } = await updateDevisStatut(id, statut)
    if (!error) setDevis((prev) => prev.map((d) => d.id === id ? { ...d, statut } : d))
    return { error }
  }

  return { devis, loading, error, refresh, addDevis, setStatut }
}

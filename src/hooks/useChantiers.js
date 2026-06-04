import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  listChantiers,
  createChantier as svcCreate,
  updateChantier as svcUpdate,
  deleteChantier as svcDelete,
  migrateLegacyChantiers,
} from '../services/chantiersService'

export function useChantiers() {
  const { entreprise } = useAuth()
  const entrepriseId = entreprise?.id

  const [chantiers, setChantiers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await listChantiers()
    if (error) setError(error.message)
    else       setChantiers(data || [])
    setLoading(false)
  }, [])

  // Au montage : on tente la migration legacy avant le 1er fetch,
  // pour que les chantiers stockés dans localStorage soient visibles
  // immédiatement après refresh.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (entrepriseId) {
        const result = await migrateLegacyChantiers(entrepriseId)
        if (cancelled) return
        if (result.migrated > 0) {
          console.log(`[useChantiers] ${result.migrated} chantier(s) importés depuis localStorage`)
        }
      }
      if (!cancelled) await refresh()
    })()
    return () => { cancelled = true }
  }, [entrepriseId, refresh])

  async function addChantier(form) {
    if (!entrepriseId) return null
    const { data, error } = await svcCreate(entrepriseId, form)
    if (data) setChantiers((prev) => [data, ...prev])
    if (error) setError(error.message)
    return data
  }

  async function updateChantier(id, form) {
    const { data, error } = await svcUpdate(id, form)
    if (data) setChantiers((prev) => prev.map((c) => (c.id === id ? data : c)))
    if (error) setError(error.message)
    return data
  }

  async function deleteChantier(id) {
    const { error } = await svcDelete(id)
    if (!error) setChantiers((prev) => prev.filter((c) => c.id !== id))
    if (error) setError(error.message)
  }

  return { chantiers, loading, error, refresh, addChantier, updateChantier, deleteChantier }
}

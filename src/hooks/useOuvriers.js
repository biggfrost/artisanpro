import { useCallback, useEffect, useState } from 'react'
import { listOuvriers, getAssignationsActivesParOuvrier } from '../services/utilisateursService'

export function useOuvriers() {
  const [ouvriers, setOuvriers] = useState([])
  const [activeMap, setActiveMap] = useState({}) // ouvrier_id → nb chantiers actifs
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [list, active] = await Promise.all([
      listOuvriers(),
      getAssignationsActivesParOuvrier(),
    ])
    if (list.error)   setError(list.error.message)
    else              setOuvriers(list.data)
    if (!active.error) setActiveMap(active.map)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function getStatutDispo(ouvrierId, statutBase) {
    if (statutBase === 'inactif') return 'inactif'
    return (activeMap[ouvrierId] || 0) > 0 ? 'en_chantier' : 'disponible'
  }

  return { ouvriers, activeMap, loading, error, refresh, getStatutDispo }
}

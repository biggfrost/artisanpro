import { useCallback, useEffect, useState } from 'react'
import {
  listMesPointages, getPointageEnCours,
  startPointage as svcStart, endPointage as svcEnd,
} from '../services/pointagesService'

export function usePointages(opts = {}) {
  const { fromISO, toISO } = opts
  const [pointages, setPointages] = useState([])
  const [enCours,   setEnCours]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [list, active] = await Promise.all([
      listMesPointages(fromISO, toISO),
      getPointageEnCours(),
    ])
    if (list.error) setError(list.error.message)
    else            setPointages(list.data)
    if (!active.error) setEnCours(active.data)
    setLoading(false)
  }, [fromISO, toISO])

  useEffect(() => { refresh() }, [refresh])

  async function start(chantierId) {
    const { data, error, pending } = await svcStart(chantierId)
    if (data) {
      setEnCours(data)
      setPointages((prev) => [data, ...prev])
    }
    return { data, error, pending }
  }

  async function end() {
    if (!enCours?.id) return { error: { message: 'Aucun pointage en cours' } }
    const { data, error, pending } = await svcEnd(enCours.id)
    if (data) {
      setEnCours(null)
      // En ligne : re-fetch pour les heures complètes. Hors-ligne : on évite
      // un appel réseau voué à l'échec (l'état optimiste suffit).
      if (!pending) refresh()
    }
    return { data, error, pending }
  }

  return { pointages, enCours, loading, error, refresh, start, end }
}

import { useCallback, useEffect, useState } from 'react'
import {
  listAssignationsForOuvrier,
  createAssignation as svcCreate,
  updateAssignation as svcUpdate,
  deleteAssignation as svcDelete,
} from '../services/assignationsService'

export function useAssignations(ouvrierId) {
  const [assignations, setAssignations] = useState([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)

  const refresh = useCallback(async () => {
    if (!ouvrierId) { setAssignations([]); return }
    setLoading(true)
    setError(null)
    const { data, error } = await listAssignationsForOuvrier(ouvrierId)
    if (error) setError(error.message)
    else       setAssignations(data)
    setLoading(false)
  }, [ouvrierId])

  useEffect(() => { refresh() }, [refresh])

  async function add(form) {
    const { data, error } = await svcCreate({ ouvrierId, ...form })
    if (data) setAssignations((prev) => [data, ...prev])
    return { data, error }
  }

  async function edit(id, form) {
    const { data, error } = await svcUpdate(id, form)
    if (data) setAssignations((prev) => prev.map((a) => (a.id === id ? data : a)))
    return { data, error }
  }

  async function remove(id) {
    const { error } = await svcDelete(id)
    if (!error) setAssignations((prev) => prev.filter((a) => a.id !== id))
    return { error }
  }

  return { assignations, loading, error, refresh, add, edit, remove }
}

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  listClients,
  createClient as svcCreate,
  updateClient as svcUpdate,
  deleteClient as svcDelete,
} from '../services/clientsService'

export function useClients() {
  const { entreprise } = useAuth()
  const entrepriseId = entreprise?.id

  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await listClients()
    if (error) setError(error.message)
    else setClients(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function addClient(form) {
    if (!entrepriseId) return { error: { message: 'Entreprise non identifiée' } }
    const { data, error } = await svcCreate(entrepriseId, form)
    if (data) setClients((prev) => [data, ...prev])
    return { data, error }
  }

  async function editClient(id, form) {
    const { data, error } = await svcUpdate(id, form)
    if (data) setClients((prev) => prev.map((c) => (c.id === id ? data : c)))
    return { data, error }
  }

  async function removeClient(id) {
    const { error } = await svcDelete(id)
    if (!error) setClients((prev) => prev.filter((c) => c.id !== id))
    return { error }
  }

  return { clients, loading, error, refresh, addClient, editClient, removeClient }
}

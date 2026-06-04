import { useState, useEffect } from 'react'
import { loadDevis, saveDevis } from '../services/storage'
import { generateId } from '../utils/formatters'

export function useDevis() {
  const [devis, setDevis] = useState([])

  useEffect(() => {
    setDevis(loadDevis())
  }, [])

  function addDevis(data) {
    const item = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    }
    setDevis((prev) => {
      const updated = [item, ...prev]
      saveDevis(updated)
      return updated
    })
    return item
  }

  function updateDevis(id, data) {
    setDevis((prev) => {
      const updated = prev.map((d) => (d.id === id ? { ...d, ...data } : d))
      saveDevis(updated)
      return updated
    })
  }

  function deleteDevis(id) {
    setDevis((prev) => {
      const updated = prev.filter((d) => d.id !== id)
      saveDevis(updated)
      return updated
    })
  }

  return { devis, addDevis, updateDevis, deleteDevis }
}

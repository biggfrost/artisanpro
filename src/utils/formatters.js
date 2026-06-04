export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

export function formatDateRelative(isoStr) {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  return formatDate(isoStr.split('T')[0])
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPhone(phone) {
  if (!phone) return '—'
  return phone
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function dateInDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

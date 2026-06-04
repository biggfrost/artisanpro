const KEY = 'artisanpro_devis_counter'
const KEY_YEAR = 'artisanpro_devis_counter_year'

export function getNextDevisNumber() {
  const year = new Date().getFullYear()
  const storedYear = parseInt(localStorage.getItem(KEY_YEAR) || '0', 10)

  let counter = parseInt(localStorage.getItem(KEY) || '0', 10)

  if (storedYear !== year) {
    counter = 0
    localStorage.setItem(KEY_YEAR, String(year))
  }

  counter += 1
  localStorage.setItem(KEY, String(counter))

  return `DEV-${year}-${String(counter).padStart(3, '0')}`
}

export function peekNextDevisNumber() {
  const year = new Date().getFullYear()
  const storedYear = parseInt(localStorage.getItem(KEY_YEAR) || '0', 10)
  let counter = parseInt(localStorage.getItem(KEY) || '0', 10)
  if (storedYear !== year) counter = 0
  return `DEV-${year}-${String(counter + 1).padStart(3, '0')}`
}

const BASE = 'https://api.open-meteo.com/v1/forecast'

const WMO_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const WMO_LABELS = {
  0: 'Soleil', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard', 48: 'Brouillard givrant',
  51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine forte',
  61: 'Pluie légère', 63: 'Pluie', 65: 'Forte pluie',
  71: 'Neige légère', 73: 'Neige', 75: 'Forte neige',
  80: 'Averses légères', 81: 'Averses', 82: 'Averses violentes',
  95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage violent',
}

let cache = null
let cacheExpiry = 0

export async function getWeekWeather(lat = 48.8566, lon = 2.3522) {
  const now = Date.now()
  if (cache && now < cacheExpiry) return cache

  try {
    const url = `${BASE}?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe/Paris&forecast_days=7`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    const { daily } = json

    const result = daily.time.map((date, i) => ({
      date,
      code: daily.weather_code[i],
      icon: WMO_ICONS[daily.weather_code[i]] || '🌡️',
      label: WMO_LABELS[daily.weather_code[i]] || '',
      tMax: Math.round(daily.temperature_2m_max[i]),
      tMin: Math.round(daily.temperature_2m_min[i]),
      rain: daily.precipitation_probability_max[i],
    }))

    cache = result
    cacheExpiry = now + 30 * 60 * 1000 // 30 min
    return result
  } catch {
    return null
  }
}

export async function getUserLocationWeather() {
  if (!navigator.geolocation) return getWeekWeather()
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(getWeekWeather(pos.coords.latitude, pos.coords.longitude)),
      () => resolve(getWeekWeather()),
      { timeout: 5000 }
    )
  })
}

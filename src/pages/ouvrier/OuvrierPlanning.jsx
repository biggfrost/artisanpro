import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, ChevronLeft, ChevronRight, LogOut, MapPin, Clock,
  PlayCircle, StopCircle, Loader2, Construction, X, FileText, HardHat,
  Mic, MicOff, Camera, Navigation,
} from 'lucide-react'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import PullToRefreshIndicator from '../../components/PullToRefreshIndicator'
import { useAuth } from '../../contexts/AuthContext'
import { signOut } from '../../services/auth'
import { useMesAssignations } from '../../hooks/useMesAssignations'
import { usePointages } from '../../hooks/usePointages'
import { getUserLocationWeather } from '../../services/weatherService'
import { haptic } from '../../utils/haptics'
import { useToast } from '../../contexts/ToastContext'

// ── Helpers date ───────────────────────────────────────────────
function startOfWeek(d) {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}
function fmtDateShort(d) { return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }
function fmtHeure(iso)   { return iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '' }
function isoDate(d)      { return d.toISOString().slice(0, 10) }

const JOUR_COURT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ═════════════════════════════════════════════════════════════
export default function OuvrierPlanning() {
  const { profile, entreprise } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { assignations, loading, refresh } = useMesAssignations()
  const { enCours, start, end } = usePointages()

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [detail, setDetail]       = useState(null)
  const [pointing, setPointing]   = useState(false)
  const [weather, setWeather]     = useState(null)

  const { pullDistance, refreshing, isTriggered } = usePullToRefresh(refresh)

  // Chargement météo
  useEffect(() => {
    getUserLocationWeather().then(setWeather)
  }, [])

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Groupe les assignations par jour
  const planningByDay = useMemo(() => {
    const result = Array.from({ length: 7 }, () => [])
    for (const a of assignations) {
      if (!a.date_debut) continue
      const s = new Date(a.date_debut)
      const e = a.date_fin ? new Date(a.date_fin) : s
      for (let i = 0; i < 7; i++) {
        const dayStart = addDays(weekStart, i)
        const dayEnd   = addDays(weekStart, i + 1)
        if (s < dayEnd && e >= dayStart) result[i].push(a)
      }
    }
    return result
  }, [assignations, weekStart])

  const now          = new Date()
  const today        = startOfWeek(now)
  const todayIdx     = (now >= weekStart && now < addDays(weekStart, 7))
    ? Math.floor((now - weekStart) / 86400000) : -1
  const isCurrentWeek = today.getTime() === weekStart.getTime()
  const todayItems   = todayIdx >= 0 ? planningByDay[todayIdx] : []

  async function handlePointage(chantierId) {
    setPointing(true)
    haptic.medium()
    if (enCours) {
      await end()
      toast.success(`Départ enregistré à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`)
    } else if (chantierId) {
      await start(chantierId)
      toast.success(`Arrivée enregistrée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`)
    }
    setPointing(false)
  }

  // Météo du jour courant
  const todayWeather = useMemo(() => {
    if (!weather) return null
    const todayStr = isoDate(new Date())
    return weather.find((w) => w.date === todayStr) || weather[0]
  }, [weather])

  return (
    <div className="px-4 pt-12 pb-6">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} isTriggered={isTriggered} />
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-slate-500 font-medium">
            Bonjour {profile?.prenom || ''} 👋
          </p>
          <h1 className="text-2xl font-bold text-primary-900">Mon planning</h1>
          {entreprise?.nom && <p className="text-xs text-slate-400 mt-0.5">{entreprise.nom}</p>}
        </div>
        <div className="flex items-center gap-2">
          {todayWeather && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-card">
              <span className="text-base">{todayWeather.icon}</span>
              <span>{todayWeather.tMax}°</span>
            </div>
          )}
          <button onClick={handleLogout} aria-label="Déconnexion"
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors shadow-card">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ── Pointage en cours (sticky) ────────────────── */}
      {enCours && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-4 mb-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-white animate-pulse-dot" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">Pointage en cours</p>
              <p className="text-sm font-bold truncate">{enCours.chantier?.nom || 'Chantier'}</p>
              <p className="text-xs text-emerald-100">Depuis {fmtHeure(enCours.heure_arrivee)}</p>
            </div>
            <button onClick={() => handlePointage()} disabled={pointing}
              className="bg-white text-emerald-700 rounded-xl px-3 py-2.5 font-bold text-xs shadow-sm hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1.5">
              {pointing ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />}
              Je pars
            </button>
          </div>
        </div>
      )}

      {/* ── Aujourd'hui ─────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-accent-600" />
            <h2 className="text-sm font-bold text-slate-800">
              Aujourd'hui · {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
          </div>
          {todayWeather && (
            <span className="text-xs text-slate-500">{todayWeather.label}</span>
          )}
        </div>

        {loading ? (
          <TodaySkeleton />
        ) : todayItems.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">
            <Construction size={26} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Aucun chantier prévu aujourd'hui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayItems.map((a) => (
              <AssignationTodayCard
                key={a.id}
                assignation={a}
                enCours={enCours?.chantier_id === a.chantier_id}
                pointing={pointing}
                onTap={() => setDetail(a)}
                onArrive={() => handlePointage(a.chantier_id)}
                onLeave={() => handlePointage()}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Planning de la semaine ───────────────────────── */}
      <div className="flex items-center justify-between bg-slate-50 rounded-xl px-2 py-1.5 mb-2">
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semaine précédente"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white transition-colors">
          <ChevronLeft size={16} className="text-slate-600" />
        </button>
        <div className="text-center flex-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Semaine</p>
          <p className="text-sm font-bold text-slate-800">{fmtDateShort(weekStart)} — {fmtDateShort(addDays(weekStart, 6))}</p>
          {!isCurrentWeek && (
            <button type="button" onClick={() => setWeekStart(today)}
              className="text-[10px] font-bold text-accent-600 hover:text-accent-700 mt-0.5">
              ← Aujourd'hui
            </button>
          )}
        </div>
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semaine suivante"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white transition-colors">
          <ChevronRight size={16} className="text-slate-600" />
        </button>
      </div>

      <div className="space-y-1.5">
        {planningByDay.map((items, idx) => {
          const day = addDays(weekStart, idx)
          const isToday = idx === todayIdx
          const dayWeather = weather?.find((w) => w.date === isoDate(day))

          return (
            <div key={idx} className={`rounded-xl border px-3 py-2 ${isToday ? 'border-accent-300 bg-accent-50/40' : 'border-slate-100 bg-white'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase ${isToday ? 'text-accent-700' : 'text-slate-400'}`}>
                  {JOUR_COURT[idx]}
                </span>
                <span className={`text-xs ${isToday ? 'text-accent-700 font-bold' : 'text-slate-500'}`}>
                  {day.getDate()}/{day.getMonth() + 1}
                </span>
                {dayWeather && (
                  <span className="ml-auto text-base" title={dayWeather.label}>
                    {dayWeather.icon}
                    {dayWeather.rain > 50 && <span className="text-[9px] text-blue-500 font-bold ml-0.5">{dayWeather.rain}%</span>}
                  </span>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-[11px] text-slate-300 italic">—</p>
              ) : (
                <div className="space-y-1">
                  {items.map((a) => (
                    <button key={a.id} onClick={() => setDetail(a)}
                      className="w-full bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2 hover:bg-blue-100 transition-colors text-left active:scale-[0.99]">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-900 truncate">{a.chantier?.nom || 'Chantier'}</p>
                        <p className="text-[10px] text-blue-600 truncate">
                          {a.chantier?.ville && <>{a.chantier.ville} · </>}
                          {fmtHeure(a.date_debut)}{a.date_fin && ` → ${fmtHeure(a.date_fin)}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Detail modal ───────────────────────────────── */}
      {detail && (
        <DetailModal
          assignation={detail}
          enCours={enCours?.chantier_id === detail.chantier_id}
          pointing={pointing}
          onClose={() => setDetail(null)}
          onPointer={() => handlePointage(detail.chantier_id)}
          onLeave={() => handlePointage()}
        />
      )}
    </div>
  )
}

// ── Skeleton loader ───────────────────────────────────────────────
function TodaySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="bg-slate-100 rounded-2xl h-24" />
    </div>
  )
}

// ── Carte du jour ─────────────────────────────────────────────────
function AssignationTodayCard({ assignation: a, enCours, pointing, onTap, onArrive, onLeave }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-card">
      <button onClick={onTap} className="w-full text-left mb-3">
        <p className="text-lg font-bold text-slate-900">{a.chantier?.nom || 'Chantier'}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          {a.chantier?.ville && (
            <p className="text-xs text-slate-500 inline-flex items-center gap-1">
              <MapPin size={11} />{a.chantier.ville}
            </p>
          )}
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            <Clock size={11} />{fmtHeure(a.date_debut)}{a.date_fin && ` → ${fmtHeure(a.date_fin)}`}
          </p>
        </div>
      </button>

      {enCours ? (
        <button onClick={onLeave} disabled={pointing}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-base shadow-sm active:scale-95 transition-all disabled:opacity-60 min-h-[56px]">
          {pointing ? <Loader2 size={20} className="animate-spin" /> : <StopCircle size={20} />}
          Je quitte le chantier
        </button>
      ) : (
        <button onClick={onArrive} disabled={pointing}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-sm active:scale-95 transition-all disabled:opacity-60 min-h-[56px]">
          {pointing ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
          Je pointe mon arrivée
        </button>
      )}
    </div>
  )
}

// ── Modal de détail chantier ──────────────────────────────────────
function DetailModal({ assignation: a, enCours, pointing, onClose, onPointer, onLeave }) {
  const c = a.chantier || {}
  const adresseComplete = [c.adresse, c.code_postal, c.ville].filter(Boolean).join(', ')
  const [note, setNote]       = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.lang = 'fr-FR'
    r.continuous = false
    r.interimResults = false
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      setNote((prev) => prev ? `${prev} ${transcript}` : transcript)
    }
    r.onend = () => setListening(false)
    r.start()
    recognitionRef.current = r
    setListening(true)
    haptic.light()
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  function openMaps() {
    if (!adresseComplete) return
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseComplete)}`
    window.open(url, '_blank')
    haptic.light()
  }

  function takePhoto() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.click()
    haptic.light()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 truncate">{c.nom || 'Chantier'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Adresse + bouton Maps */}
          {adresseComplete && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Adresse du chantier</p>
              <p className="text-sm text-slate-800 flex items-start gap-1.5 mb-2">
                <MapPin size={14} className="text-accent-600 mt-0.5 flex-shrink-0" />
                <span>{adresseComplete}</span>
              </p>
              <button onClick={openMaps}
                className="inline-flex items-center gap-1.5 bg-primary-900 text-white text-xs font-bold px-3 py-2 rounded-lg active:scale-95 transition-transform">
                <Navigation size={12} />
                Ouvrir dans Maps
              </button>
            </div>
          )}

          {/* Horaires */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Horaires</p>
            <p className="text-sm text-slate-800 inline-flex items-center gap-1.5">
              <Clock size={14} className="text-accent-600" />
              {fmtHeure(a.date_debut)}{a.date_fin && ` → ${fmtHeure(a.date_fin)}`}
            </p>
          </div>

          {/* Client */}
          {c.client_nom && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Client</p>
              <p className="text-sm text-slate-800">{c.client_nom}</p>
            </div>
          )}

          {/* Description */}
          {c.description && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 inline-flex items-center gap-1">
                <FileText size={11} />Travaux à effectuer
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.description}</p>
            </div>
          )}

          {/* Notes manager */}
          {c.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Notes du manager</p>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}

          {/* Avancement */}
          {typeof c.avancement === 'number' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 inline-flex items-center gap-1">
                  <HardHat size={11} />Avancement
                </p>
                <span className="text-xs font-bold text-slate-700">{c.avancement} %</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent-500 to-accent-600 transition-all"
                  style={{ width: `${c.avancement}%` }} />
              </div>
            </div>
          )}

          {/* Zone note + dictée vocale */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Note de chantier</p>
              <div className="flex gap-2">
                <button onClick={takePhoto}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary-700 transition-colors">
                  <Camera size={14} />
                  Photo
                </button>
                <button onClick={listening ? stopVoice : startVoice}
                  className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                    listening ? 'text-red-500' : 'text-slate-500 hover:text-primary-700'
                  }`}>
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                  {listening ? 'Arrêter' : 'Dicter'}
                </button>
              </div>
            </div>
            {listening && (
              <p className="text-[10px] text-red-500 font-medium mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot inline-block" />
                Dictée en cours…
              </p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Saisir ou dicter vos notes de chantier…"
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none bg-white"
            />
          </div>

          {/* CTA pointage */}
          {enCours ? (
            <button onClick={onLeave} disabled={pointing}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-base shadow-sm active:scale-95 transition-all disabled:opacity-60 min-h-[56px]">
              {pointing ? <Loader2 size={20} className="animate-spin" /> : <StopCircle size={20} />}
              Je quitte le chantier
            </button>
          ) : (
            <button onClick={onPointer} disabled={pointing}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-sm active:scale-95 transition-all disabled:opacity-60 min-h-[56px]">
              {pointing ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
              Je pointe mon arrivée
            </button>
          )}
          <p className="text-[10px] text-slate-400 text-center -mt-2">
            Position GPS enregistrée automatiquement
          </p>
        </div>
      </div>
    </div>
  )
}

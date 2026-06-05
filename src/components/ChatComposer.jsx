import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Send, Loader2, Plus, Image as ImageIcon, Video, FileText,
  Camera, Mic, Trash2, X,
} from 'lucide-react'
import { uploadMedia, detectMediaType, formatDuree } from '../services/messagesMedia'

// Barre de saisie complète : texte + pièces jointes (photo/vidéo/document/caméra)
// + message vocal. Gère l'upload puis appelle onSend(contenu, media|null).
//
// Props :
//   - onSend(contenu, media)  → envoie ; media = null pour un texte simple
//   - disabled                → désactive la saisie
//   - placeholder             → texte du champ
//   - accent = 'primary'|'accent' → couleur du bouton d'envoi
export default function ChatComposer({ onSend, disabled, placeholder = 'Écrire un message…', accent = 'primary' }) {
  const [text, setText]         = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending]   = useState(false)

  // Refs des inputs fichiers cachés
  const galleryRef  = useRef(null)  // photo + vidéo galerie
  const documentRef = useRef(null)  // documents
  const cameraRef   = useRef(null)  // caméra directe

  const sendColor = accent === 'accent'
    ? 'bg-accent-500 hover:bg-accent-600'
    : 'bg-primary-900 hover:bg-primary-800'

  // ── Envoi texte ───────────────────────────────────────────────
  async function handleSendText(e) {
    e?.preventDefault?.()
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    await onSend(value, null)
    setSending(false)
    setText('')
  }

  // ── Pièce jointe fichier ──────────────────────────────────────
  async function handleFile(e, forcedType) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    setMenuOpen(false)
    if (!file) return

    setUploading(true)
    const type = forcedType || detectMediaType(file)
    const { data, error } = await uploadMedia(file, { type })
    setUploading(false)
    if (error) { alert(error.message || "Échec de l'envoi du fichier."); return }
    await onSend('', data)
  }

  return (
    <div className="bg-white border-t border-slate-100 sticky bottom-0">
      {/* Inputs fichiers cachés */}
      <input ref={galleryRef}  type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFile(e)} />
      <input ref={documentRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/*" className="hidden" onChange={(e) => handleFile(e, 'document')} />
      <input ref={cameraRef}   type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e, 'image')} />

      {/* Menu pièces jointes */}
      {menuOpen && (
        <div className="px-3 pt-3 pb-1 animate-slide-up">
          <div className="grid grid-cols-4 gap-2">
            <AttachOption icon={ImageIcon} label="Galerie"  color="text-violet-600" bg="bg-violet-50"   onClick={() => galleryRef.current?.click()} />
            <AttachOption icon={Camera}    label="Caméra"   color="text-blue-600"   bg="bg-blue-50"     onClick={() => cameraRef.current?.click()} />
            <AttachOption icon={Video}     label="Vidéo"    color="text-rose-600"   bg="bg-rose-50"     onClick={() => galleryRef.current?.click()} />
            <AttachOption icon={FileText}  label="Document" color="text-amber-600"  bg="bg-amber-50"    onClick={() => documentRef.current?.click()} />
          </div>
        </div>
      )}

      {/* Barre principale */}
      <VoiceOrText
        text={text}
        setText={setText}
        disabled={disabled}
        uploading={uploading}
        sending={sending}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        placeholder={placeholder}
        sendColor={sendColor}
        onSendText={handleSendText}
        onSendVoice={async (media) => { await onSend('', media) }}
      />
    </div>
  )
}

function AttachOption({ icon: Icon, label, color, bg, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 py-2 rounded-xl active:scale-95 transition-transform">
      <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
        <Icon size={22} className={color} />
      </div>
      <span className="text-[10px] font-medium text-slate-600">{label}</span>
    </button>
  )
}

// ── Saisie texte OU enregistrement vocal ─────────────────────────
function VoiceOrText({
  text, setText, disabled, uploading, sending, menuOpen, setMenuOpen,
  placeholder, sendColor, onSendText, onSendVoice,
}) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed]     = useState(0)
  const [voiceUploading, setVoiceUploading] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const startedAtRef     = useRef(0)
  const cancelledRef     = useRef(false)

  const hasText = text.trim().length > 0

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  async function startRecording() {
    if (disabled || uploading) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert("L'enregistrement vocal n'est pas supporté sur cet appareil.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
                 : MediaRecorder.isTypeSupported('audio/mp4')  ? 'audio/mp4' : ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      cancelledRef.current = false
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        stopTimer()
        const duree = (Date.now() - startedAtRef.current) / 1000
        setRecording(false)
        setElapsed(0)
        if (cancelledRef.current || duree < 0.6) return // trop court / annulé
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
        const file = new File([blob], `vocal-${Date.now()}.${mime.includes('mp4') ? 'm4a' : 'webm'}`, { type: blob.type })
        setVoiceUploading(true)
        const { data, error } = await uploadMedia(file, { type: 'audio' })
        setVoiceUploading(false)
        if (error) { alert(error.message || "Échec de l'envoi du vocal."); return }
        await onSendVoice({ ...data, duree: Math.round(duree) })
      }
      mediaRecorderRef.current = rec
      startedAtRef.current = Date.now()
      rec.start()
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000)
      }, 200)
      if (navigator.vibrate) navigator.vibrate(15)
    } catch {
      alert("Micro inaccessible. Autorisez l'accès au microphone.")
    }
  }

  function stopAndSend() {
    cancelledRef.current = false
    mediaRecorderRef.current?.stop()
  }
  function cancelRecording() {
    cancelledRef.current = true
    mediaRecorderRef.current?.stop()
  }

  // ── Mode enregistrement ──
  if (recording) {
    return (
      <div className="px-3 py-2.5 flex items-center gap-3">
        <button onClick={cancelRecording} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Trash2 size={18} className="text-red-500" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-dot" />
          <span className="text-sm font-semibold text-slate-700 tabular-nums">{formatDuree(elapsed)}</span>
          <span className="text-xs text-slate-400">Enregistrement…</span>
        </div>
        <button onClick={stopAndSend} className={`w-10 h-10 rounded-full ${sendColor} text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform`}>
          <Send size={18} />
        </button>
      </div>
    )
  }

  // ── Mode normal ──
  return (
    <form onSubmit={onSendText} className="px-3 py-2.5 flex items-end gap-2">
      {/* Bouton pièces jointes */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={disabled || uploading}
        className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-50"
      >
        {uploading
          ? <Loader2 size={18} className="animate-spin text-slate-500" />
          : <Plus size={20} className={`text-slate-600 transition-transform ${menuOpen ? 'rotate-45' : ''}`} />}
      </button>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendText(e) } }}
        placeholder={voiceUploading ? 'Envoi du vocal…' : placeholder}
        rows={1}
        disabled={disabled || voiceUploading}
        className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm bg-slate-50 outline-none focus:border-primary-700 focus:bg-white focus:ring-2 focus:ring-primary-900/10 resize-none max-h-32"
        style={{ minHeight: 42 }}
      />

      {/* Micro (si pas de texte) OU envoi (si texte) */}
      {hasText ? (
        <button
          type="submit"
          disabled={sending || disabled}
          className={`w-11 h-11 rounded-full ${sendColor} text-white flex items-center justify-center shadow-sm disabled:opacity-40 active:scale-95 transition-all flex-shrink-0`}
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={disabled || uploading || voiceUploading}
          title="Message vocal"
          className={`w-11 h-11 rounded-full ${sendColor} text-white flex items-center justify-center shadow-sm disabled:opacity-40 active:scale-95 transition-all flex-shrink-0`}
        >
          {voiceUploading ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
        </button>
      )}
    </form>
  )
}

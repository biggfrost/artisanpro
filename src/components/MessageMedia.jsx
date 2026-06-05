import { useState, useRef, useEffect } from 'react'
import { FileText, Download, Play, Pause, Mic } from 'lucide-react'
import { formatTaille, formatDuree } from '../services/messagesMedia'

// Affiche le contenu média d'un message (image, vidéo, audio, document).
// `isMe` ajuste les couleurs pour les bulles envoyées vs reçues.
export default function MessageMedia({ message: m, isMe }) {
  switch (m.type) {
    case 'image':    return <ImageMedia m={m} />
    case 'video':    return <VideoMedia m={m} />
    case 'audio':    return <AudioMedia m={m} isMe={isMe} />
    case 'document': return <DocumentMedia m={m} isMe={isMe} />
    default:         return null
  }
}

function ImageMedia({ m }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="block rounded-xl overflow-hidden -m-0.5">
        <img
          src={m.media_url}
          alt="Photo"
          loading="lazy"
          className="max-w-full max-h-64 rounded-xl object-cover"
        />
      </button>
      {open && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <img src={m.media_url} alt="Photo" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  )
}

function VideoMedia({ m }) {
  return (
    <video
      src={m.media_url}
      controls
      preload="metadata"
      className="max-w-full max-h-64 rounded-xl bg-black"
    />
  )
}

function AudioMedia({ m, isMe }) {
  const audioRef = useRef(null)
  const [playing, setPlaying]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(m.media_duree || 0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setProgress(a.currentTime)
    const onMeta = () => { if (a.duration && isFinite(a.duration)) setDuration(a.duration) }
    const onEnd  = () => { setPlaying(false); setProgress(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
    }
  }, [])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="flex items-center gap-2.5 min-w-[180px] py-0.5">
      <audio ref={audioRef} src={m.media_url} preload="metadata" />
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
          isMe ? 'bg-white/20 text-white' : 'bg-primary-900 text-white'
        }`}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Mic size={11} className={isMe ? 'text-blue-200' : 'text-slate-400'} />
          <div className={`flex-1 h-1 rounded-full overflow-hidden ${isMe ? 'bg-white/25' : 'bg-slate-200'}`}>
            <div className={`h-full ${isMe ? 'bg-white' : 'bg-primary-700'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className={`text-[10px] mt-0.5 tabular-nums ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
          {formatDuree(playing || progress ? progress : duration)}
        </p>
      </div>
    </div>
  )
}

function DocumentMedia({ m, isMe }) {
  return (
    <a
      href={m.media_url}
      target="_blank"
      rel="noopener noreferrer"
      download={m.media_nom}
      className={`flex items-center gap-2.5 py-1 min-w-[180px] ${isMe ? 'text-white' : 'text-slate-800'}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isMe ? 'bg-white/20' : 'bg-slate-100'
      }`}>
        <FileText size={18} className={isMe ? 'text-white' : 'text-primary-700'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{m.media_nom || 'Document'}</p>
        <p className={`text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
          {formatTaille(m.media_taille)}
        </p>
      </div>
      <Download size={15} className={isMe ? 'text-blue-200' : 'text-slate-400'} />
    </a>
  )
}

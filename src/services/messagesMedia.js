import { supabase } from './supabase'

const BUCKET = 'messages-media'

// Détermine le type de message à partir d'un fichier
export function detectMediaType(file) {
  const mime = file.type || ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

// Compresse une image avant upload (réduit la taille / accélère l'envoi).
// Renvoie un Blob JPEG. Si échec, renvoie le fichier original.
export async function compressImage(file, maxDim = 1600, quality = 0.8) {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return blob || file
  } catch {
    return file
  }
}

// Upload un fichier dans le bucket et renvoie l'URL publique + métadonnées.
export async function uploadMedia(file, { type } = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Non authentifié' } }

  const mediaType = type || detectMediaType(file)

  // Compression pour les images
  let toUpload = file
  if (mediaType === 'image') {
    toUpload = await compressImage(file)
  }

  // Garde-fou taille (50 Mo max)
  if (toUpload.size > 50 * 1024 * 1024) {
    return { error: { message: 'Fichier trop volumineux (50 Mo maximum).' } }
  }

  const ext = (file.name?.split('.').pop() || guessExt(mediaType, file.type) || 'bin').toLowerCase()
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, toUpload, {
      contentType: file.type || (mediaType === 'image' ? 'image/jpeg' : undefined),
      upsert: false,
    })

  if (upErr) {
    // Message clair si le bucket n'existe pas (migration non exécutée)
    if (upErr.message?.includes('Bucket not found') || upErr.message?.includes('not found')) {
      return { error: { message: "Stockage non configuré. Exécutez la migration SQL des médias dans Supabase." } }
    }
    return { error: upErr }
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return {
    data: {
      type:   mediaType,
      url:    pub.publicUrl,
      nom:    file.name || `${mediaType}.${ext}`,
      taille: toUpload.size,
    },
    error: null,
  }
}

function guessExt(type, mime) {
  if (type === 'image') return 'jpg'
  if (type === 'video') return mime?.includes('webm') ? 'webm' : 'mp4'
  if (type === 'audio') return mime?.includes('webm') ? 'webm' : mime?.includes('mp4') ? 'm4a' : 'ogg'
  return null
}

// Format lisible d'une taille de fichier
export function formatTaille(octets) {
  if (!octets) return ''
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`
}

// Format durée mm:ss
export function formatDuree(sec) {
  if (!sec && sec !== 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

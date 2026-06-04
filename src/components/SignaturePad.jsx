import { useRef, useState, useLayoutEffect, useCallback } from 'react'
import { RotateCcw, Check } from 'lucide-react'

/**
 * Zone de signature manuscrite — canvas (souris + touch + DPR).
 *
 * Props:
 *   value       — base64 existante (pour afficher une signature sauvée)
 *   onSave      — callback(base64) appelé quand l'utilisateur valide
 *   height      — hauteur CSS du canvas en px (défaut 140)
 *   label       — libellé affiché au-dessus
 *   readOnly    — afficher une signature sans permettre de la modifier
 */
export default function SignaturePad({
  value,
  onSave,
  height = 140,
  label,
  readOnly = false,
}) {
  const canvasRef  = useRef(null)
  const ctxRef     = useRef(null)
  const painting   = useRef(false)
  const lastPt     = useRef({ x: 0, y: 0 })

  const [isEmpty, setIsEmpty] = useState(!value)
  const [saved,   setSaved  ] = useState(!!value)

  // ── initialisation du canvas (après rendu DOM) ────────────────
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    // Dimensions bitmap = dimensions CSS × DPR (haute résolution)
    canvas.width  = rect.width  * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1e3a8a'
    ctx.lineWidth   = 2.2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctxRef.current  = ctx

    // Afficher la signature existante si fournie
    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height)
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
      }
      img.src = value
    }
  }, [value])

  useLayoutEffect(() => {
    initCanvas()
  }, [initCanvas])

  // ── coordonnées normalisées (souris & touch) ──────────────────
  function getXY(e) {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const src    = e.touches ? e.touches[0] : e
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    }
  }

  // ── événements de dessin ──────────────────────────────────────
  function onStart(e) {
    if (readOnly) return
    e.preventDefault()
    painting.current = true
    setSaved(false)
    const pt = getXY(e)
    lastPt.current = pt
    setIsEmpty(false)
    const ctx = ctxRef.current
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
  }

  function onMove(e) {
    if (!painting.current || readOnly) return
    e.preventDefault()
    const pt  = getXY(e)
    const ctx = ctxRef.current
    // Interpolation quadratique pour courbe fluide
    const mx  = (lastPt.current.x + pt.x) / 2
    const my  = (lastPt.current.y + pt.y) / 2
    ctx.quadraticCurveTo(lastPt.current.x, lastPt.current.y, mx, my)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(mx, my)
    lastPt.current = pt
  }

  function onEnd() {
    painting.current = false
  }

  // ── actions ───────────────────────────────────────────────────
  function clear() {
    const canvas = canvasRef.current
    const ctx    = ctxRef.current
    const dpr    = window.devicePixelRatio || 1
    const rect   = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setIsEmpty(true)
    setSaved(false)
  }

  function save() {
    if (isEmpty || !onSave) return
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    // Fond blanc (transparent → blanc pour le PDF)
    const tmp    = document.createElement('canvas')
    tmp.width    = canvas.width
    tmp.height   = canvas.height
    const tctx   = tmp.getContext('2d')
    tctx.fillStyle = '#ffffff'
    tctx.fillRect(0, 0, tmp.width, tmp.height)
    tctx.drawImage(canvas, 0, 0)
    const base64 = tmp.toDataURL('image/png')
    onSave(base64)
    setSaved(true)
  }

  return (
    <div>
      {label && (
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          {label}
        </p>
      )}

      <div
        className="relative rounded-xl overflow-hidden border-2 bg-white"
        style={{
          height,
          borderStyle: readOnly ? 'solid' : 'dashed',
          borderColor: readOnly ? '#e2e8f0' : isEmpty ? '#cbd5e1' : '#1e40af',
        }}
      >
        {/* Watermark (zone vide, non readOnly) */}
        {isEmpty && !readOnly && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-300 pointer-events-none select-none text-center px-4">
            Signez ici avec votre doigt ou la souris
          </p>
        )}

        {/* Watermark (zone vide, readOnly) */}
        {isEmpty && readOnly && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-300 select-none">
            Signature en attente
          </p>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ touchAction: readOnly ? 'auto' : 'none', cursor: readOnly ? 'default' : 'crosshair' }}
          onMouseDown={onStart}
          onMouseMove={onMove}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
        />
      </div>

      {/* Barre d'actions */}
      {!readOnly && (
        <div className="flex items-center justify-between mt-2 px-0.5">
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            <RotateCcw size={11} strokeWidth={2.5} />
            Effacer
          </button>

          <button
            type="button"
            onClick={save}
            disabled={isEmpty}
            className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
              saved
                ? 'text-emerald-600'
                : 'text-primary-700 hover:text-primary-900'
            }`}
          >
            {saved && <Check size={12} strokeWidth={3} />}
            {saved ? 'Signature sauvegardée' : 'Sauvegarder la signature'}
          </button>
        </div>
      )}
    </div>
  )
}

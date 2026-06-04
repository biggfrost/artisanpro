import { useEffect, useRef, useState } from 'react'

// Détecte le scrollable principal de l'app (les layouts ont <main overflow-y-auto>).
function getScrollContainer() {
  return document.querySelector('main') || document.scrollingElement || document.documentElement
}

// Pull-to-refresh natif tactile. Écoute les touch events au niveau window
// et déclenche `onRefresh` quand l'utilisateur tire vers le bas depuis le
// haut de la liste (au-delà du seuil).
//
// Renvoie : { pullDistance, refreshing, isTriggered }
export function usePullToRefresh(onRefresh, opts = {}) {
  const { threshold = 70, enabled = true } = opts
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing,   setRefreshing]   = useState(false)
  const startYRef     = useRef(null)
  const activeRef     = useRef(false)
  const distRef       = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    function onTouchStart(e) {
      if (refreshingRef.current) return
      const sc = getScrollContainer()
      if (sc.scrollTop > 5) return
      startYRef.current = e.touches[0].clientY
      activeRef.current = true
      distRef.current = 0
    }

    function onTouchMove(e) {
      if (!activeRef.current || refreshingRef.current) return
      const delta = e.touches[0].clientY - startYRef.current
      if (delta > 0) {
        // Damping pour résistance progressive
        const damped = Math.min(delta * 0.5, 120)
        distRef.current = damped
        setPullDistance(damped)
        // Bloque le scroll natif au-delà du seuil de friction
        if (delta > 10 && e.cancelable) e.preventDefault()
      }
    }

    async function onTouchEnd() {
      if (!activeRef.current) return
      activeRef.current = false
      const d = distRef.current
      distRef.current = 0
      if (d > threshold && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullDistance(60)            // hold au seuil pendant le refresh
        try { await onRefresh() }
        finally {
          refreshingRef.current = false
          setRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: false })
    window.addEventListener('touchend',   onTouchEnd,   { passive: true })
    window.addEventListener('touchcancel', onTouchEnd,  { passive: true })
    return () => {
      window.removeEventListener('touchstart',  onTouchStart)
      window.removeEventListener('touchmove',   onTouchMove)
      window.removeEventListener('touchend',    onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled, onRefresh, threshold])

  return { pullDistance, refreshing, isTriggered: pullDistance > threshold }
}

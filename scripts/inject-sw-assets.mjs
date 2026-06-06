// Post-build : injecte la liste des fichiers générés (JS/CSS/HTML/icônes)
// dans dist/sw.js pour que le service worker les PRÉCHARGE tous → l'app
// fonctionne entièrement hors-ligne, même après un nouveau déploiement.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = 'dist'

// Liste récursive de tous les fichiers de dist/ → URLs absolues ('/assets/x.js')
function listFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(full))
    else out.push('/' + relative(DIST, full).replace(/\\/g, '/'))
  }
  return out
}

const swPath = join(DIST, 'sw.js')
if (!existsSync(swPath)) {
  console.error('[inject-sw] dist/sw.js introuvable — copie depuis public/ ?')
  process.exit(0)
}

const all = listFiles(DIST)

// On précache : index.html + tous les assets hashés + manifest + icônes.
// On EXCLUT sw.js lui-même et les fichiers volumineux inutiles hors-ligne.
const precache = all.filter((p) => {
  if (p === '/sw.js') return false
  return (
    p === '/index.html' ||
    p === '/manifest.json' ||
    p.startsWith('/assets/') ||
    p.startsWith('/icons/')
  )
})

// Identifiant de build unique → garantit un nouveau cache à chaque déploiement
const buildId = Date.now().toString(36)

let sw = readFileSync(swPath, 'utf8')
sw = sw
  .replaceAll('BUILD_ID_PLACEHOLDER', buildId)
  .replaceAll('PRECACHE_MANIFEST_PLACEHOLDER', JSON.stringify(precache))

writeFileSync(swPath, sw)
console.log(`[inject-sw] ${precache.length} fichiers préchargés, build ${buildId}`)

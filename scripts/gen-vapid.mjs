import { generateKeyPairSync } from 'node:crypto'

// Génère une paire de clés VAPID (ECDSA P-256) au format base64url
// attendu par l'API Web Push.
const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
})

// Clé publique : point non compressé (65 octets) → base64url
const pubRaw = publicKey.export({ type: 'spki', format: 'der' })
// Les 65 derniers octets du DER SPKI sont le point EC brut (0x04 + X + Y)
const pubPoint = pubRaw.subarray(pubRaw.length - 65)

// Clé privée : valeur scalaire d (32 octets) → base64url
const privDer = privateKey.export({ type: 'pkcs8', format: 'der' })
// Extraction du scalaire de 32 octets dans le PKCS8 (offset connu pour P-256)
// On cherche la séquence OCTET STRING de 32 octets.
function extractPrivateScalar(der) {
  for (let i = 0; i < der.length - 1; i++) {
    if (der[i] === 0x04 && der[i + 1] === 0x20) {
      return der.subarray(i + 2, i + 2 + 32)
    }
  }
  throw new Error('Scalaire introuvable')
}
const privScalar = extractPrivateScalar(privDer)

const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

console.log('VAPID_PUBLIC_KEY=' + b64url(pubPoint))
console.log('VAPID_PRIVATE_KEY=' + b64url(privScalar))

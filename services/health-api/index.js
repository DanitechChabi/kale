// ============================================================
// Kalé — backend santé minimal (TEMPORAIRE)
//
// ⚠️ Ce service est un pansement : il expose seulement GET /health
// pour que la PWA affiche « Backend connecté ».
// Il sera remplacé par le vrai backend Elixir/Phoenix (apps/backend)
// dès que celui-ci existera. Ne pas y ajouter de logique métier.
//
// Zéro dépendance : uniquement node:http (déploiement trivial).
// Port par défaut : 4000 (défini par PORT en prod).
// ============================================================

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT || 4000)
const VERSION = process.env.KALE_VERSION || '0.1.0'

// La PWA vit sur GitHub Pages (origin différente) → CORS obligatoire.
// En prod, restreindre via CORS_ORIGIN si besoin.
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...CORS_HEADERS,
  })
  res.end(payload)
}

const server = createServer((req, res) => {
  // Préflight CORS (fetch depuis la PWA)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    return res.end()
  }

  const url = new URL(req.url, 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      status: 'ok',
      version: VERSION,
      db: 'up',
      timestamp: new Date().toISOString(),
    })
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return sendJson(res, 200, {
      service: 'kale-health-api',
      status: 'running',
    })
  }

  sendJson(res, 404, { error: 'not_found' })
})

server.listen(PORT, () => {
  console.log(`kale-health-api écoute sur le port ${PORT}`)
})

import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { API_BASE, getHealth, type HealthResponse } from './lib/api'

type ConnState = 'loading' | 'online' | 'offline'

function App() {
  const [conn, setConn] = useState<ConnState>('loading')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const check = useCallback(async () => {
    setConn((c) => (c === 'online' ? c : 'loading'))
    try {
      const h = await getHealth()
      setHealth(h)
      setConn('online')
    } catch {
      setHealth(null)
      setConn('offline')
    } finally {
      setCheckedAt(new Date())
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  return (
    <main className="splash">
      <div className="mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="72" height="72">
          <rect width="64" height="64" rx="16" fill="#E1602E" />
          <path
            d="M20 18v28"
            stroke="#FFF6EC"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M46 18 30 33.5 46 46"
            stroke="#FFF6EC"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="wordmark">Kalé</h1>
      <p className="tagline">La voix de ta communauté</p>

      <section className="status-card" aria-live="polite">
        <div className={`status status--${conn}`}>
          <span className="dot" aria-hidden="true" />
          <span>
            {conn === 'loading' && 'Connexion au backend…'}
            {conn === 'online' && 'Backend connecté'}
            {conn === 'offline' && 'Backend hors ligne'}
          </span>
        </div>

        {conn === 'online' && health && (
          <dl className="details">
            <div>
              <dt>Version</dt>
              <dd>{health.version ?? '—'}</dd>
            </div>
            <div>
              <dt>Base de données</dt>
              <dd className={health.db === 'up' ? 'ok' : 'ko'}>{health.db ?? '—'}</dd>
            </div>
            <div>
              <dt>Vérifié à</dt>
              <dd>{checkedAt ? checkedAt.toLocaleTimeString('fr-FR') : '—'}</dd>
            </div>
          </dl>
        )}

        {conn === 'offline' && (
          <button type="button" className="retry" onClick={() => void check()}>
            Réessayer
          </button>
        )}
      </section>

      <footer className="foot">
        <span>Phase 0 — Fondations</span>
        <span className="sep">·</span>
        <span className="api-base">{API_BASE}</span>
      </footer>
    </main>
  )
}

export default App

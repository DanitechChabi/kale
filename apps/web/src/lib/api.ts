// Client API Kalé — Phase 0 : health check.
// Les endpoints réels seront générés depuis contracts/openapi.yaml (voir packages/kale-api-client).

export interface HealthResponse {
  status: 'ok'
  version?: string
  db?: 'up' | 'down'
  timestamp?: string
}

export class ApiError extends Error {
  status?: number
  code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:4000'

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`, { signal })
  if (!res.ok) {
    throw new ApiError(`Backend répond ${res.status}`, res.status)
  }
  return (await res.json()) as HealthResponse
}

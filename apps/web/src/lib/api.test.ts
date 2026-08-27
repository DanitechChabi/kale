import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getHealth } from './api'

function mockFetchOnce(res: Partial<Response>) {
  return vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getHealth', () => {
  it('parse la réponse 200 en HealthResponse', async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: 'ok',
        version: '0.1.0',
        db: 'up',
      }),
    })

    const health = await getHealth()
    expect(health).toMatchObject({ status: 'ok', version: '0.1.0', db: 'up' })
  })

  it('lève ApiError si le backend répond non-2xx', async () => {
    mockFetchOnce({ ok: false, status: 503 })

    await expect(getHealth()).rejects.toBeInstanceOf(ApiError)
    await expect(getHealth()).rejects.toMatchObject({ status: 503 })
  })

  it('propage l’erreur réseau (backend injoignable)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getHealth()).rejects.toBeInstanceOf(TypeError)
  })
})

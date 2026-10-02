import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/crawler/vietstock/auth', () => ({
  getVietstockCredentials: vi.fn(async () => ({ cookie: 'c=1', token: 'tok' })),
  clearVietstockSession: vi.fn(),
}))

const { clearVietstockSession, getVietstockCredentials } = await import('../../server/crawler/vietstock/auth')
const { vietstockPost, VietstockAuthError } = await import('../../server/crawler/vietstock/client')

const fetchMock = vi.fn<typeof fetch>()

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const html = () => new Response('<html>login</html>', { status: 200 })
const status = (code: number) => new Response('', { status: code })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  fetchMock.mockReset()
  vi.useRealTimers()
})

describe('vietstockPost', () => {
  it('posts the form with cookie and verification token, returns parsed JSON', async () => {
    fetchMock.mockResolvedValueOnce(json([[1], {}]))

    await expect(vietstockPost('/data/financeinfo', { Code: 'FPT' }, 'FPT')).resolves.toEqual([[1], {}])

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://finance.vietstock.vn/data/financeinfo')
    expect((init!.headers as Record<string, string>).Cookie).toBe('c=1')
    expect(String(init!.body)).toBe('Code=FPT&__RequestVerificationToken=tok')
  })

  it('re-logs in once when Vietstock returns the HTML login page', async () => {
    fetchMock.mockResolvedValueOnce(html()).mockResolvedValueOnce(json({ ok: true }))

    await expect(vietstockPost('/x', {}, 'FPT')).resolves.toEqual({ ok: true })
    expect(clearVietstockSession).toHaveBeenCalledTimes(1)
    expect(getVietstockCredentials).toHaveBeenCalledTimes(2)
  })

  it('treats a redirect as an expired session', async () => {
    fetchMock.mockResolvedValueOnce(status(302)).mockResolvedValueOnce(json(1))

    await expect(vietstockPost('/x', {}, 'FPT')).resolves.toBe(1)
    expect(clearVietstockSession).toHaveBeenCalledTimes(1)
  })

  it('gives up with VietstockAuthError when re-login does not help', async () => {
    fetchMock.mockImplementation(async () => html())

    await expect(vietstockPost('/x', {}, 'FPT')).rejects.toBeInstanceOf(VietstockAuthError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries 5xx with backoff', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(json('ok'))

    const result = vietstockPost('/x', {}, 'FPT')
    await vi.runAllTimersAsync()

    await expect(result).resolves.toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries network errors and fails after 3 attempts', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const result = vietstockPost('/x', {}, 'FPT')
    const assertion = expect(result).rejects.toThrow('fetch failed')
    await vi.runAllTimersAsync()

    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry other 4xx errors', async () => {
    fetchMock.mockResolvedValueOnce(status(404))

    await expect(vietstockPost('/x', {}, 'FPT')).rejects.toThrow('/x returned 404')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

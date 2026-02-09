export class HttpError extends Error {
  status: number
  body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

export type HttpOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

function getApiBaseUrl() {
  const env = import.meta.env as unknown as Record<string, unknown>
  const fromEnv = typeof env.VITE_API_BASE_URL === 'string' ? env.VITE_API_BASE_URL : undefined
  return fromEnv?.trim() ? fromEnv.trim().replace(/\/+$/, '') : 'http://localhost:8000'
}

function hasDetail(x: unknown): x is { detail: unknown } {
  return typeof x === 'object' && x !== null && 'detail' in x
}

export async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`

  const headers = new Headers(options.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  const hasBody = options.body !== undefined
  if (hasBody && !headers.has('content-type')) headers.set('content-type', 'application/json')

  const res = await fetch(url, {
    ...options,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  })

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const parsed = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined)

  if (!res.ok) {
    const msg = hasDetail(parsed) ? String(parsed.detail) : `Request failed with ${res.status}`
    throw new HttpError(msg, res.status, parsed)
  }

  return parsed as T
}


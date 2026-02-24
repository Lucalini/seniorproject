import { HttpError } from './http'

function getSupabaseUrl() {
  const env = import.meta.env as unknown as Record<string, unknown>
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL : undefined
  if (!url?.trim()) throw new Error('Missing VITE_SUPABASE_URL')
  return url.trim().replace(/\/+$/, '')
}

function getSupabaseAnonKey() {
  const env = import.meta.env as unknown as Record<string, unknown>
  const key = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY : undefined
  if (!key?.trim()) throw new Error('Missing VITE_SUPABASE_ANON_KEY')
  return key.trim()
}

function hasMessage(x: unknown): x is { message: unknown } {
  return typeof x === 'object' && x !== null && 'message' in x
}

export async function postgrest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getSupabaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`

  const headers = new Headers(init.headers)
  if (!headers.has('accept')) headers.set('accept', 'application/json')
  if (!headers.has('apikey')) headers.set('apikey', getSupabaseAnonKey())
  if (!headers.has('authorization')) headers.set('authorization', `Bearer ${getSupabaseAnonKey()}`)

  const res = await fetch(url, { ...init, headers })
  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const parsed = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined)

  if (!res.ok) {
    const msg = hasMessage(parsed) ? String(parsed.message) : `Request failed with ${res.status}`
    throw new HttpError(msg, res.status, parsed)
  }

  return parsed as T
}


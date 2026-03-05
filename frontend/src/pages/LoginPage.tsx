import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { ErrorBanner } from '../components/ErrorBanner'

type Tab = 'signin' | 'signup'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setBusy(true)
    setError(null)
    setSignUpSuccess(false)
    try {
      if (tab === 'signin') {
        await signIn(email, password)
        navigate('/events')
      } else {
        await signUp(email, password)
        setSignUpSuccess(true)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="authPage">
      <div className="card authCard">
        <div className="authTabs">
          <button
            type="button"
            className={`authTab ${tab === 'signin' ? 'authTabActive' : ''}`}
            onClick={() => { setTab('signin'); setError(null); setSignUpSuccess(false) }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`authTab ${tab === 'signup' ? 'authTabActive' : ''}`}
            onClick={() => { setTab('signup'); setError(null); setSignUpSuccess(false) }}
          >
            Sign Up
          </button>
        </div>

        <div className="cardBody">
          {error && <ErrorBanner message={error} />}

          {signUpSuccess ? (
            <div className="authSuccess">
              <p><strong>Account created!</strong></p>
              <p className="muted">Check your email to confirm your account, then sign in.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="stack">
              <label className="field">
                <span className="fieldLabel">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </label>
              <label className="field">
                <span className="fieldLabel">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                />
              </label>
              <button className="button" disabled={busy}>
                {busy
                  ? (tab === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (tab === 'signin' ? 'Sign In' : 'Create Account')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

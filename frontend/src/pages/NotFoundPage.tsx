import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="stack">
      <h1 className="pageTitle">Page not found</h1>
      <p className="muted">That route doesn’t exist.</p>
      <div>
        <Link to="/" className="button">
          Go home
        </Link>
      </div>
    </div>
  )
}


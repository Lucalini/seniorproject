type Props = {
  label?: string
}

export function Loading({ label = 'Loading…' }: Props) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}


import type { ReactNode } from 'react'

type Props = {
  title?: string
  children: ReactNode
  className?: string
}

export function Card({ title, children, className }: Props) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      {title ? <h2 className="cardTitle">{title}</h2> : null}
      <div className="cardBody">{children}</div>
    </section>
  )
}


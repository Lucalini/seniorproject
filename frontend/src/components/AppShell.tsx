import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import poliMustang from '../assets/POLIMustang.JPG'

type Props = {
  children: ReactNode
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function AppShell({ children }: Props) {
  return (
    <div className="app">
      <header className="appHeader">
        <div className="appHeaderInner">
          <div className="brand">
            <div className="brandMark" aria-hidden="true">
              <img className="brandMarkImg" src={poliMustang} alt="" />
            </div>
            <div className="brandText">
              <div className="brandTitle">POLI</div>
              <div className="brandSubtitle">San Luis Obispo County political hub</div>
            </div>
          </div>

          <nav className="nav">
            <NavLink
              to="/"
              className={({ isActive }) => cx('navLink', isActive && 'navLinkActive')}
              end
            >
              Home
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) => cx('navLink', isActive && 'navLinkActive')}
            >
              Events
            </NavLink>
            <NavLink
              to="/officials"
              className={({ isActive }) => cx('navLink', isActive && 'navLinkActive')}
            >
              Civil Servants
            </NavLink>
            <NavLink
              to="/education"
              className={({ isActive }) => cx('navLink', isActive && 'navLinkActive')}
            >
              Education
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="container">{children}</main>

      <footer className="footer">
        <div className="container footerInner">
          <span>Data will come from public sources + community submissions.</span>
          <span className="footerSep" aria-hidden="true">
            ·
          </span>
          <span>
            Built for SLO County · <span className="muted">prototype</span>
          </span>
        </div>
      </footer>
    </div>
  )
}


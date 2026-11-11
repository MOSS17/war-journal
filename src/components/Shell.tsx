import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Mark } from './icons';
import { Skyline, type SkylineVariant } from './Skyline';
import { useOverlay } from './overlay';
import { Icon } from './icons';

const NAV = [
  { to: '/', label: 'War Board', end: true },
  { to: '/characters', label: 'Characters' },
  { to: '/instances', label: 'Instances' },
  { to: '/plans', label: 'War Plans' },
  { to: '/journal', label: 'Journal' },
  { to: '/library', label: 'Library' },
];

function NavBar() {
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
  }, [loc.pathname]);

  return (
    <div className="navbar plank">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          {/* Logo slot: an official asset may only go here unaltered, on a non-commercial site. */}
          <span className="logo-slot" data-logo-slot>
            <Mark size={30} />
          </span>
          <span>War Journal</span>
        </Link>
        <nav className={`nav${menu ? ' open' : ''}`} aria-label="Main" id="main-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="navbar-actions">
          <button
            type="button"
            className="iconbtn menu-toggle"
            aria-expanded={menu}
            aria-controls="main-nav"
            aria-label="Menu"
            onClick={() => setMenu((m) => !m)}
          >
            <Icon.menu />
          </button>
        </div>
      </div>
    </div>
  );
}

/** A section page: camp skyline hero with the title, the wood plank nav, then content. */
export function Page({
  variant,
  eyebrow,
  title,
  actions,
  hero,
  children,
}: {
  variant: SkylineVariant;
  eyebrow?: ReactNode;
  title?: string;
  actions?: ReactNode;
  /** Replaces the default title block (used by the War Board). */
  hero?: ReactNode;
  children: ReactNode;
}) {
  const { open } = useOverlay();
  useEffect(() => {
    document.title = title ? `${title} · War Journal` : 'War Journal';
  }, [title]);
  return (
    <>
      <header className={`hero${variant === 'home' ? ' home' : ''}`}>
        <Skyline variant={variant} />
        <div className="hero-quick">
          <button type="button" className="btn" onClick={() => open({ kind: 'quick' })} aria-keyshortcuts="N">
            +<span className="quick-label"> Quick add</span>
          </button>
        </div>
        <div className="hero-inner">
          {hero ?? (
            <div className="pagehead">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h1>{title}</h1>
              </div>
              {actions && <div className="pagehead-actions">{actions}</div>}
            </div>
          )}
        </div>
      </header>
      <NavBar />
      <main className="page" id="main">
        {children}
      </main>
    </>
  );
}

export function Footer() {
  const { open } = useOverlay();
  return (
    <footer className="footer">
      <div className="footer-inner">
      <p>
        World of Warcraft and Warcraft are trademarks or registered trademarks of Blizzard Entertainment, Inc. This site
        is not affiliated with or endorsed by Blizzard.
      </p>
      <div className="row-gap">
        <a
          href="/glance"
          className="linkbtn"
          onClick={(e) => {
            e.preventDefault();
            window.open('/glance', 'war-journal-glance', 'width=440,height=860');
          }}
        >
          Second-screen glance
        </a>
        <button type="button" className="linkbtn" onClick={() => open({ kind: 'data' })}>
          Backup &amp; data
        </button>
      </div>
      </div>
    </footer>
  );
}

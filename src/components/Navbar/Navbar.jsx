import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* Pages qui affichent la flèche ← retour au lieu du menu sidebar */
const INNER_PAGES = ['/revenus', '/charges', '/factures', '/notifications', '/profil', '/stats', '/chat'];

/* Sous-titres selon la page */
const PAGE_TITLES = {
  '/revenus':       'Gestion des Revenus',
  '/charges':       'Gestion des Charges',
  '/factures':      'Gestion des Factures',
  '/notifications': 'Notifications',
  '/profil':        'Mon Profil',
  '/stats':         'Statistiques',
  '/chat':          'IA Chat',
};

function Navbar() {
  const { logout }   = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();

  const isInnerPage  = INNER_PAGES.some(p => location.pathname.startsWith(p));
  const pageTagline  = PAGE_TITLES[location.pathname] || 'Gestion budgétaire familiale';

  useEffect(() => {
    if (window.feather) window.feather.replace();
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleBack   = () => navigate(-1);

  return (
    <>
      <style>{`
        /* ── SVG icônes toujours visibles ── */
        .icon-svg {
          width: 20px; height: 20px;
          stroke: #4b5563;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          display: inline-block;
          vertical-align: middle;
          transition: stroke .2s;
        }
        .btn-link-header:hover .icon-svg,
        .btn-back:hover .icon-svg {
          stroke: #377CF4;
        }
        .btn-link-header:hover,
        .btn-back:hover {
          background: rgba(55,124,244,.08) !important;
          border-radius: 10px;
        }
        .btn-back {
          background: none;
          border: none;
          padding: 6px 10px;
          cursor: pointer;
          border-radius: 10px;
          transition: background .2s;
          display: flex;
          align-items: center;
        }

        /* ── Fix z-index header / sidebar ── */
        .adminuiux-header { z-index: 1100 !important; }
        .adminuiux-sidebar {
          top: 56px !important;
          height: calc(100% - 56px) !important;
        }
        .sidebar-overlay { top: 56px !important; }
      `}</style>

      <header className="adminuiux-header inner-page">
        <nav className="navbar navbar-expand-lg fixed-top">
          <div className="container-fluid">

            {/* ── Gauche : flèche retour (inner) ou menu sidebar (dashboard) ── */}
            {isInnerPage ? (
              <button className="btn-back ms-1" onClick={handleBack} title="Retour">
                {/* Flèche gauche SVG */}
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <line x1="19" y1="12" x2="5" y2="12"/>
                  <polyline points="12 19 5 12 12 5"/>
                </svg>
              </button>
            ) : (
              <button
                className="btn btn-link btn-square sidebar-toggler ms-1"
                type="button"
                onClick={() => window.initSidebar && window.initSidebar()}
                title="Menu"
              >
                {/* 3 lignes menu SVG */}
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <line x1="3" y1="6"  x2="21" y2="6"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}

            {/* ── Logo + tagline dynamique ── */}
            <Link className="navbar-brand" to="/">
              <img src="/assets/img/family-balance-logo.png" alt="FamilyBalance" />
              <div className="lh-20 d-block ms-2">
                <span className="h4">FamilyBalance</span>
                <p className="company-tagline mb-0">{pageTagline}</p>
              </div>
            </Link>

            {/* ── Icônes droite ── */}
            <div className="ms-auto d-flex align-items-center">

              {/* Soleil / thème */}
              <button
                className="btn btn-link btn-square btn-link-header"
                id="btn-layout-modes-dark-page"
                title="Changer le thème"
              >
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1"  x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1"  y1="12" x2="3"  y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              </button>

              {/* Cloche notifications */}
              <Link
                to="/notifications"
                className="btn btn-link btn-square btn-icon btn-link-header position-relative"
                title="Notifications"
              >
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span
                  className="position-absolute top-0 end-0 badge rounded-pill bg-danger"
                  style={{ fontSize:'9px', padding:'2px 5px' }}
                >
                  3
                </span>
              </Link>

              {/* Déconnexion */}
              <button
                className="btn btn-link btn-square btn-icon btn-link-header"
                title="Déconnexion"
                onClick={handleLogout}
              >
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>

            </div>
          </div>
        </nav>
      </header>
    </>
  );
}

export default Navbar;
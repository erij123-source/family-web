import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [statsOpen, setStatsOpen] = useState(false);

  // Conserver l'état du sous-menu entre les navigations
  useEffect(() => {
    const saved = sessionStorage.getItem('statsMenuOpen');
    if (saved === 'true') setStatsOpen(true);
  }, []);

  const toggleStats = (e) => {
    e.preventDefault();
    const next = !statsOpen;
    setStatsOpen(next);
    sessionStorage.setItem('statsMenuOpen', next ? 'true' : 'false');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="adminuiux-sidebar">
      <div className="adminuiux-sidebar-inner" style={{ paddingBottom: '20px' }}>

        {/* Profil utilisateur */}
        <div className="px-3 px-lg-4 my-3">
          <div className="row gx-3 gx-lg-4 justify-content-center align-items-center">
            <div className="col-auto">
              <figure className="avatar avatar-60 rounded p-1 card mx-auto coverimg">
                <img src="/assets/img/adminuiux/user-1.jpg" alt="profil" />
              </figure>
            </div>
            <div className="col">
              <h4 className="mb-0">{user?.familyName || 'Famille Ben Ali'}</h4>
              <p className="opacity-50">{user?.role || 'Administrateur'}</p>
            </div>
          </div>
        </div>

        {/* Menu principal */}
        <ul className="nav flex-column menu-active-line mt-0">

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/')}`} to="/">
              <div className="avatar avatar-30 icon"><i className="bi bi-house-door"></i></div>
              <div className="col">Accueil</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/revenus')}`} to="/revenus">
              <div className="avatar avatar-30 icon"><i className="bi bi-graph-up-arrow"></i></div>
              <div className="col">Revenus</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/charges')}`} to="/charges">
              <div className="avatar avatar-30 icon"><i className="bi bi-wallet2"></i></div>
              <div className="col">Charges</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/factures')}`} to="/factures">
              <div className="avatar avatar-30 icon"><i className="bi bi-receipt"></i></div>
              <div className="col">Factures</div>
            </Link>
          </li>

          {/* ── Statistiques avec sous-menu ── */}
          <li className={`nav-item nav-item-stats ${statsOpen ? 'stats-open' : ''}`}>
            <a className="nav-link" href="#stats" onClick={toggleStats}>
              <div className="avatar avatar-30 icon"><i className="bi bi-bar-chart-line"></i></div>
              <div className="col">Statistiques</div>
              <i
                className="bi bi-chevron-down stats-chevron"
                style={{ transform: statsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              ></i>
            </a>
            <ul
              className={`nav flex-column stats-submenu ${statsOpen ? 'stats-submenu-open' : ''}`}
            >
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/stats/budget')}`} to="/stats/budget">
                  <span className="sub-dot"></span><span>Budget Global</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/stats/revenus')}`} to="/stats/revenus">
                  <span className="sub-dot"></span><span>Revenus</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/stats/charges')}`} to="/stats/charges">
                  <span className="sub-dot"></span><span>Charges</span>
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link ${isActive('/stats/factures')}`} to="/stats/factures">
                  <span className="sub-dot"></span><span>Factures</span>
                </Link>
              </li>
            </ul>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/notifications')}`} to="/notifications">
              <div className="avatar avatar-30 icon"><i className="bi bi-bell"></i></div>
              <div className="col">Alertes</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/assistant')}`} to="/assistant">
              <div className="avatar avatar-30 icon"><i className="bi bi-robot"></i></div>
              <div className="col">IA Chat</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/profile')}`} to="/profile">
              <div className="avatar avatar-30 icon"><i className="bi bi-person-circle"></i></div>
              <div className="col">Profil</div>
            </Link>
          </li>

          <li className="nav-item">
            <button className="nav-link border-0 bg-transparent w-100 text-start" onClick={handleLogout}>
              <div className="avatar avatar-30 icon"><i className="bi bi-box-arrow-right"></i></div>
              <div className="col">Déconnexion</div>
            </button>
          </li>

        </ul>
      </div>
    </div>
  );
}

export default Sidebar;
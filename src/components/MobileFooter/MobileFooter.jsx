import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function MobileFooter() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <footer className="adminuiux-mobile-footer style-1">
      <div className="container">
        <ul className="nav nav-pills nav-justified bg-blur">

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/')}`} to="/">
              <span>
                <i className="nav-icon bi bi-house"></i>
                <span className="nav-text">Accueil</span>
              </span>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/stats-budget')}`} to="/stats-budget">
              <span>
                <i className="nav-icon bi bi-bar-chart-line"></i>
                <span className="nav-text">Stats</span>
              </span>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/chat')}`} to="/chat">
              <span>
                <i className="nav-icon bi bi-robot"></i>
                <span className="nav-text">IA Chat</span>
              </span>
            </Link>
          </li>

          <li className="nav-item">
            <Link className={`nav-link ${isActive('/profile')}`} to="/profile">
              <span>
                <i className="nav-icon bi bi-person-circle"></i>
                <span className="nav-text">Profil</span>
              </span>
            </Link>
          </li>

        </ul>
      </div>
    </footer>
  );
}

export default MobileFooter;
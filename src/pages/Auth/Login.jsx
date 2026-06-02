import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/* ── SVG logo de secours (identique au fallback HTML) ── */
function LogoFallback() {
  return (
    <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" width="96" height="96">
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#377CF4" />
          <stop offset="100%" stopColor="#2E3F8F" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" fill="url(#lg)" />
      <path d="M48 20 L22 42 L26 42 L26 72 L70 72 L70 42 L74 42 Z" fill="rgba(255,255,255,0.95)" />
      <rect x="42" y="54" width="12" height="18" rx="2" fill="url(#lg)" />
      <rect x="30" y="50" width="9"  height="9"  rx="2" fill="url(#lg)" />
      <rect x="57" y="50" width="9"  height="9"  rx="2" fill="url(#lg)" />
      <rect x="36" y="38" width="24" height="2.5" rx="1.25" fill="rgba(255,255,255,0.85)" />
      <circle cx="32" cy="41" r="3" fill="rgba(255,255,255,0.85)" />
      <circle cx="64" cy="41" r="3" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}

function Login() {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [logoError,   setLogoError]   = useState(false);
  const [pwdInvalid,  setPwdInvalid]  = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  /* ── Validation & login ── */
  const handleLogin = async () => {
    setError('');

    if (!email.trim() || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);

    try {
      // 1. Authentification → récupère le token JWT
      const response = await fetch('http://localhost:8080/authentification/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: email.trim(),
          password: password,
        }),
      });

      if (!response.ok) {
        setError('Identifiant ou mot de passe incorrect. Veuillez réessayer.');
        setPwdInvalid(true);
        setTimeout(() => setPwdInvalid(false), 2500);
        return;
      }

      const data = await response.json();
      // data = { token: "eyJ...", refreshToken: "..." }

      // ✅ Sauvegarde du token JWT via AuthContext
      login(
        { username: email.trim() },
        data.token,
        data.refreshToken
      );

      // ✅ Stocker le username dans sessionStorage
      // Le Dashboard va chercher l'admin par username directement
      sessionStorage.clear();
      sessionStorage.setItem('username', email.trim());

      navigate('/');   // redirige vers la page d'accueil

    } catch (err) {
      setError('Serveur inaccessible. Vérifiez que Spring Boot est lancé sur le port 8080.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Touche Entrée ── */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Sora:wght@300;400;500;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --blue:        #377CF4;
          --violet:      #2E3F8F;
          --blue-soft:   #377CF4;
          --gradient:    linear-gradient(135deg, #377CF4 0%, #2E3F8F 100%);
          --gradient-r:  linear-gradient(135deg, #2a6be0 0%, #4a3189 100%);
          --white:       #FFFFFF;
          --bg:          #EEF2FC;
          --text-dark:   #111827;
          --text-mid:    #374151;
          --text-muted:  #6B7280;
          --card-shadow: 0 32px 80px rgba(55,124,244,0.18), 0 8px 24px rgba(46,63,143,0.10);
          --btn-shadow:  0 10px 32px rgba(55,124,244,0.50);
          --radius-card:  28px;
          --radius-input: 14px;
        }

        html, body {
          height: 100%;
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          overflow-x: hidden;
        }

        /* ── Background ── */
        .page-bg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px 48px;
          position: relative;
          overflow: hidden;
        }
        .page-bg::before {
          content: '';
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 15% 10%, rgba(55,124,244,0.18) 0%, transparent 65%),
            radial-gradient(ellipse 60% 55% at 85% 85%, rgba(46,63,143,0.20) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 70% 15%, rgba(55,124,244,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 20% 80%, rgba(46,63,143,0.12) 0%, transparent 50%);
          pointer-events: none; z-index: 0;
        }

        /* ── Shapes flottantes ── */
        .shape {
          position: fixed; border-radius: 50%;
          filter: blur(70px); pointer-events: none; z-index: 0;
          animation: shapeFloat var(--dur) ease-in-out infinite alternate;
        }
        .shape-1 { width:520px;height:520px;background:#377CF4;top:-180px;left:-160px;opacity:0.14;--dur:16s; }
        .shape-2 { width:380px;height:380px;background:#2E3F8F;bottom:-120px;right:-100px;opacity:0.18;--dur:20s; }
        .shape-3 { width:250px;height:250px;background:#377CF4;top:40%;right:8%;opacity:0.10;--dur:13s; }
        @keyframes shapeFloat {
          0%   { transform: translate(0,0) scale(1); }
          100% { transform: translate(30px,22px) scale(1.06); }
        }

        /* ── Torn corners ── */
        .torn-tr {
          position:fixed;top:0;right:0;width:160px;height:160px;pointer-events:none;z-index:0;
        }
        .torn-tr::before {
          content:'';position:absolute;top:0;right:0;width:0;height:0;
          border-style:solid;border-width:0 160px 160px 0;
          border-color:transparent rgba(55,124,244,0.12) transparent transparent;
        }
        .torn-bl {
          position:fixed;bottom:0;left:0;width:140px;height:140px;pointer-events:none;z-index:0;
        }
        .torn-bl::before {
          content:'';position:absolute;bottom:0;left:0;width:0;height:0;
          border-style:solid;border-width:140px 0 0 140px;
          border-color:transparent transparent transparent rgba(46,63,143,0.12);
        }

        /* ── Card ── */
        .signin-card {
          position:relative;z-index:1;
          background:rgba(255,255,255,0.88);
          backdrop-filter:blur(24px);
          border-radius:var(--radius-card);
          box-shadow:var(--card-shadow);
          width:100%;max-width:430px;
          padding:48px 44px 40px;
          border:1px solid rgba(255,255,255,0.95);
          animation:cardReveal 0.8s cubic-bezier(0.22,1,0.36,1) 0.2s both;
        }
        @keyframes cardReveal {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .signin-card::before {
          content:'';position:absolute;top:0;left:12%;right:12%;
          height:3px;background:var(--gradient);border-radius:0 0 4px 4px;
        }

        /* ── Logo ── */
        .logo-section {
          display:flex;flex-direction:column;align-items:center;margin-bottom:36px;
          animation:fadeUp 0.6s ease 0.5s both;
        }
        .logo-wrap {
          width:96px;height:96px;border-radius:26px;overflow:hidden;
          box-shadow:0 0 0 1px rgba(55,124,244,0.15),0 8px 28px rgba(55,124,244,0.30);
        }

        /* ── Welcome ── */
        .welcome-block { text-align:center;margin-bottom:28px;animation:fadeUp 0.5s ease 0.65s both; }
        .welcome-text  { font-size:1.05rem;color:var(--text-mid);font-weight:400;line-height:1.5; }
        .accent        { font-weight:600;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }

        /* ── Error box ── */
        .error-box {
          display:flex;align-items:center;gap:10px;
          background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.22);
          border-radius:12px;padding:12px 16px;margin-bottom:20px;
          font-size:0.875rem;color:#dc2626;
          animation:fadeUp 0.3s ease both;
        }
        @keyframes errorShake {
          0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}
        }

        /* ── Fields ── */
        .field-group  { margin-bottom:18px;animation:fadeUp 0.5s ease 0.75s both; }
        .field-label  { display:block;font-size:0.82rem;font-weight:600;color:var(--text-mid);margin-bottom:7px;letter-spacing:0.01em; }
        .input-wrap   { position:relative; }
        .input-icon   { position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#9CA3AF;font-size:1rem;pointer-events:none;transition:color 0.25s; }
        .field-input  {
          width:100%;height:50px;padding:0 44px 0 42px;
          background:rgba(241,245,255,0.70);border:1.5px solid rgba(55,124,244,0.15);
          border-radius:var(--radius-input);
          font-family:'DM Sans',sans-serif;font-size:0.95rem;color:var(--text-dark);
          outline:none;transition:border-color 0.25s,background 0.25s,box-shadow 0.25s;
        }
        .field-input::placeholder { color:#9CA3AF; }
        .field-input::-ms-reveal, .field-input::-ms-clear { display:none; }
        .field-input:focus {
          border-color:var(--blue);background:rgba(255,255,255,0.95);
          box-shadow:0 0 0 4px rgba(55,124,244,0.10);
        }
        .field-input:focus ~ .input-icon { color:var(--blue); }
        .field-input.is-invalid { border-color:#ef4444;animation:errorShake 0.45s ease; }
        .eye-btn {
          position:absolute;right:14px;top:50%;transform:translateY(-50%);
          background:none;border:none;cursor:pointer;color:var(--text-muted);
          font-size:1.05rem;padding:4px;display:flex;align-items:center;transition:color 0.2s;
        }
        .eye-btn:hover { color:var(--blue); }

        /* ── Forgot ── */
        .forgot-row {
          text-align:right;margin-top:-6px;margin-bottom:28px;
          animation:fadeUp 0.5s ease 0.90s both;
        }
        .forgot-link { font-size:0.82rem;font-weight:500;color:var(--text-muted);text-decoration:none;transition:color 0.2s; }
        .forgot-link:hover { color:var(--blue); }

        /* ── Button ── */
        .btn-signin {
          width:100%;height:54px;border:none;border-radius:16px;
          background:var(--gradient);color:#fff;
          font-family:'Sora',sans-serif;font-size:0.96rem;font-weight:600;
          cursor:pointer;position:relative;overflow:hidden;
          box-shadow:var(--btn-shadow);transition:box-shadow 0.3s,transform 0.2s;
          display:flex;align-items:center;justify-content:center;gap:10px;
          animation:fadeUp 0.5s ease 0.95s both;
        }
        .btn-signin:hover { box-shadow:0 16px 44px rgba(55,124,244,0.55);transform:translateY(-2px); }
        .btn-signin:active { transform:translateY(0); }
        .btn-signin:disabled { opacity:0.75;cursor:not-allowed;transform:none; }
        .btn-text { display:flex;align-items:center;gap:8px;position:relative;z-index:1; }
        .btn-spinner {
          width:20px;height:20px;border:2.5px solid rgba(255,255,255,0.35);
          border-top-color:#fff;border-radius:50%;
          animation:spin 0.75s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* ── Divider ── */
        .divider {
          display:flex;align-items:center;gap:14px;
          margin:24px 0;color:#D1D5DB;font-size:0.80rem;
          animation:fadeUp 0.5s ease 1.00s both;
        }
        .divider::before,.divider::after { content:'';flex:1;height:1px;background:rgba(55,124,244,0.12); }

        /* ── Register ── */
        .register-text {
          text-align:center;font-size:0.875rem;color:var(--text-muted);
          animation:fadeUp 0.5s ease 1.05s both;
        }
        .register-text a { color:var(--blue);text-decoration:none;font-weight:600;transition:color 0.2s; }
        .register-text a:hover { color:#2E3F8F; }

        /* ── Footer ── */
        .page-footer {
          position:fixed;bottom:16px;left:0;right:0;
          text-align:center;font-size:0.75rem;
          color:rgba(107,114,128,0.60);z-index:1;
        }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }

        @media (max-width:480px) {
          .signin-card { padding:40px 28px 32px;border-radius:22px; }
          .logo-wrap   { width:84px;height:84px; }
          .welcome-text{ font-size:1.05rem; }
        }
      `}</style>

      {/* ── Décorations ── */}
      <div className="torn-tr"></div>
      <div className="torn-bl"></div>
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>

      <div className="page-bg" onKeyDown={handleKeyDown}>
        <div className="signin-card">

          {/* Logo */}
          <div className="logo-section">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div className="logo-glow"></div>
              <div className="logo-wrap">
                {logoError
                  ? <LogoFallback />
                  : <img
                      src="/assets/img/family-balance-logo.png"
                      alt="Family Balance Logo"
                      onError={() => setLogoError(true)}
                    />
                }
              </div>
            </div>
          </div>

          {/* Welcome */}
          <div className="welcome-block">
            <p className="welcome-text">
              Connectez-vous à votre <span className="accent">espace familial</span>
            </p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="error-box">
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Champs */}
          <div>
            {/* Identifiant */}
            <div className="field-group">
              <label className="field-label" htmlFor="email">Identifiant</label>
              <div className="input-wrap">
                <input
                  type="text"
                  className="field-input"
                  id="email"
                  placeholder="Entrez votre identifiant"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                />
                <i className="bi bi-person input-icon"></i>
              </div>
            </div>

            {/* Mot de passe */}
            <div className="field-group">
              <label className="field-label" htmlFor="password">Mot de passe</label>
              <div className="input-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={`field-input pwd-field ${pwdInvalid ? 'is-invalid' : ''}`}
                  id="password"
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                />
                <i className="bi bi-lock input-icon"></i>
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPwd(!showPwd)}
                  title="Afficher / masquer"
                >
                  <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>
          </div>

          {/* Mot de passe oublié */}
          <div className="forgot-row">
            <Link to="/forgot-password" className="forgot-link">
              Mot de passe oublié ?
            </Link>
          </div>

          {/* Bouton connexion */}
          <button
            className="btn-signin"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading
              ? <span className="btn-spinner"></span>
              : <span className="btn-text">
                  <i className="bi bi-box-arrow-in-right"></i>
                  Se connecter
                </span>
            }
          </button>

          {/* Divider */}
          <div className="divider">ou</div>

          {/* Créer un compte */}
          <p className="register-text">
            Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          </p>

        </div>

      </div>
    </>
  );
}

export default Login;
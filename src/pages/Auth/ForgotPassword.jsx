import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/* ══ Logo SVG fallback ══ */
function LogoFallback() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" width="90" height="90">
      <defs>
        <linearGradient id="lg3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#377CF4" />
          <stop offset="100%" stopColor="#2E3F8F" />
        </linearGradient>
      </defs>
      <rect width="90" height="90" fill="url(#lg3)" />
      <path d="M45 18L20 40h5v28h40V40h5z" fill="rgba(255,255,255,.95)" />
      <rect x="39" y="52" width="12" height="16" rx="2" fill="url(#lg3)" />
      <rect x="27" y="47" width="9"  height="9"  rx="2" fill="url(#lg3)" />
      <rect x="54" y="47" width="9"  height="9"  rx="2" fill="url(#lg3)" />
      <rect x="34" y="35" width="22" height="2.5" rx="1.25" fill="rgba(255,255,255,.85)" />
      <circle cx="30" cy="38" r="3" fill="rgba(255,255,255,.85)" />
      <circle cx="60" cy="38" r="3" fill="rgba(255,255,255,.85)" />
    </svg>
  );
}

/* ══ OTP 4 digits ══ */
function OtpInput({ otp, setOtp, onComplete }) {
  const refs = [useRef(), useRef(), useRef(), useRef()];
  const handleChange = (val, idx) => {
    val = val.replace(/\D/g, '');
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 3) refs[idx + 1].current?.focus();
    if (idx === 3 && val) onComplete([...next].join(''));
  };
  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace') {
      const next = [...otp];
      if (!next[idx] && idx > 0) { refs[idx - 1].current?.focus(); }
      next[idx] = '';
      setOtp(next);
    }
  };
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
      {[0,1,2,3].map(i => (
        <input key={i} ref={refs[i]} type="text" maxLength={1} value={otp[i]}
          onChange={e => handleChange(e.target.value, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          className={`otp-digit ${otp[i] ? 'filled' : ''}`}
        />
      ))}
    </div>
  );
}

/* ══ Password strength ══ */
function PwdStrength({ value }) {
  let score = 0;
  if (value.length >= 6)          score++;
  if (value.length >= 10)         score++;
  if (/[A-Z]/.test(value) && /[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const levels = [
    { cls: '',       text: 'Force du mot de passe', col: '' },
    { cls: 'weak',   text: 'Faible',                col: '#ef4444' },
    { cls: 'fair',   text: 'Acceptable',            col: '#ea580c' },
    { cls: 'good',   text: 'Bon',                   col: '#eab308' },
    { cls: 'strong', text: 'Excellent',             col: '#16a34a' },
  ];
  const l = levels[score];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            height: 3, flex: 1, borderRadius: 2,
            background: score > 0 && i < score
              ? (l.cls === 'weak' ? '#ef4444' : l.cls === 'fair' ? '#ea580c' : l.cls === 'good' ? '#eab308' : '#16a34a')
              : 'rgba(55,124,244,.12)',
            transition: 'background .3s'
          }} />
        ))}
      </div>
      <span style={{ fontSize: '.73rem', color: l.col || 'var(--text-muted)' }}>{l.text}</span>
    </div>
  );
}

/* ══════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════ */
function ForgotPassword() {
  const navigate    = useNavigate();

  /* ── Étapes : 1 | 2 | 3 | 'success' ── */
  const [step,        setStep]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [logoError,   setLogoError]   = useState(false);

  /* ── Étape 1 : Téléphone ── */
  const [phone,       setPhone]       = useState('');
  const [phoneError,  setPhoneError]  = useState('');

  /* ── Étape 2 : OTP ── */
  const [otp,         setOtp]         = useState(['','','','']);
  const [countdown,   setCountdown]   = useState(120);
  const [canResend,   setCanResend]   = useState(false);
  const countdownRef = useRef(null);

  /* ── Étape 3 : Nouveau mot de passe ── */
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPwdError, setNewPwdError] = useState('');
  const [confirmError,setConfirmError]= useState('');
  const [confirmOk,   setConfirmOk]   = useState(false);

  /* ── Countdown ── */
  const startCountdown = () => {
    setCountdown(120);
    setCanResend(false);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(s => {
        if (s <= 1) {
          clearInterval(countdownRef.current);
          setCanResend(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(countdownRef.current), []);

  const formatCountdown = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const formatPhone = (n) =>
    n.slice(0, 2) + ' ' + n.slice(2, 5) + ' ' + n.slice(5);

  const showGlobalErr = (msg) => {
    setGlobalError(msg);
    setTimeout(() => setGlobalError(''), 4500);
  };

  /* ── ÉTAPE 1 : Soumettre téléphone → appel réel API ── */
  const submitPhone = async () => {
    if (phone.length !== 8) {
      setPhoneError('Numéro invalide (8 chiffres requis).');
      return;
    }
    setPhoneError('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/authentification/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: `+216${phone}` }), // ← aligné avec ForgotPasswordRequest.java
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Numéro introuvable ou erreur serveur.');
      }
      setStep(2);
      setOtp(['', '', '', '']);
      startCountdown();
    } catch (err) {
      showGlobalErr(err.message || "Erreur lors de l'envoi du code SMS.");
    } finally {
      setLoading(false);
    }
  };

  /* ── ÉTAPE 2 : Vérifier OTP (passage à étape 3, vrai check au reset-password) ── */
  const submitOtp = (code) => {
    const c = code || otp.join('');
    if (c.length !== 4) {
      showGlobalErr('Entrez les 4 chiffres du code SMS.');
      return;
    }
    // Le code sera vérifié côté backend lors du reset-password
    clearInterval(countdownRef.current);
    setStep(3);
  };

  const resendOtp = async () => {
    setOtp(['', '', '', '']);
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/authentification/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: `+216${phone}` }),
      });
      if (!res.ok) throw new Error('Erreur lors du renvoi du code.');
      startCountdown();
    } catch (err) {
      showGlobalErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── ÉTAPE 3 : Vérifier correspondance ── */
  const checkMatch = (pwd, conf) => {
    if (!conf) { setConfirmError(''); setConfirmOk(false); return; }
    if (pwd === conf) { setConfirmError(''); setConfirmOk(true); }
    else              { setConfirmError('Les mots de passe ne correspondent pas.'); setConfirmOk(false); }
  };

  /* ── ÉTAPE 3 : Réinitialiser le mot de passe → appel réel API ── */
  const submitNewPwd = async () => {
    let ok = true;
    if (newPwd.length < 8) { setNewPwdError('8 caractères minimum requis.'); ok = false; }
    else setNewPwdError('');
    if (newPwd !== confirmPwd) { setConfirmError('Les mots de passe ne correspondent pas.'); ok = false; }
    else setConfirmError('');
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/authentification/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: otp.join(''),   // ← aligné avec ResetPasswordRequest.java
          newPassword: newPwd,  // ← aligné avec ResetPasswordRequest.java
        }),
      });
      const msg = await res.text();
      if (!res.ok) throw new Error(msg || 'Erreur lors de la réinitialisation.');
      setStep('success');
    } catch (err) {
      showGlobalErr(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Dots progress ── */
  const DotProgress = () => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:28 }}>
      {[1,2,3].map(n => {
        const stepNum = step === 'success' ? 4 : step;
        const done    = stepNum > n;
        const active  = stepNum === n;
        return (
          <div key={n} style={{
            height: 8, borderRadius: 4,
            width: active ? 28 : 8,
            background: done
              ? '#16a34a'
              : active
                ? 'linear-gradient(135deg,#377CF4,#2E3F8F)'
                : 'rgba(55,124,244,.20)',
            boxShadow: active ? '0 3px 10px rgba(55,124,244,.35)' : done ? '0 3px 10px rgba(22,163,74,.30)' : 'none',
            transition: 'all .4s cubic-bezier(.22,1,.36,1)',
          }} />
        );
      })}
    </div>
  );

  /* ════════════════════
     RENDU
  ════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Sora:wght@300;400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --blue:#377CF4;--violet:#2E3F8F;--blue-soft:#377CF4;
          --gradient:linear-gradient(135deg,#377CF4 0%,#2E3F8F 100%);
          --gradient-r:linear-gradient(135deg,#2a6be0 0%,#4a3189 100%);
          --bg:#EEF2FC;--text-dark:#111827;--text-mid:#374151;--text-muted:#6B7280;
          --card-shadow:0 32px 80px rgba(55,124,244,0.16),0 8px 24px rgba(46,63,143,0.10);
          --btn-shadow:0 10px 32px rgba(55,124,244,0.48);
          --radius-card:28px;--radius-input:13px;--success:#16a34a;--danger:#dc2626;
        }
        html,body{min-height:100%;font-family:'DM Sans',sans-serif;background:var(--bg);overflow-x:hidden}

        .page-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 16px 56px;position:relative}
        .page-bg::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 70% 60% at 12% 8%,rgba(55,124,244,.18) 0%,transparent 65%),radial-gradient(ellipse 60% 55% at 88% 88%,rgba(46,63,143,.20) 0%,transparent 60%);pointer-events:none;z-index:0}

        .blob{position:fixed;border-radius:50%;filter:blur(72px);pointer-events:none;z-index:0}
        .blob-1{width:520px;height:520px;background:var(--blue);top:-180px;left:-160px;opacity:.13;animation:blobFloat 16s ease-in-out infinite alternate}
        .blob-2{width:380px;height:380px;background:var(--violet);bottom:-120px;right:-100px;opacity:.17;animation:blobFloat 20s ease-in-out infinite alternate-reverse}
        @keyframes blobFloat{0%{transform:translate(0,0) scale(1)}100%{transform:translate(28px,20px) scale(1.07)}}

        .torn-tr,.torn-bl{position:fixed;pointer-events:none;z-index:0}
        .torn-tr{top:0;right:0;width:160px;height:160px}
        .torn-tr::before{content:'';position:absolute;top:0;right:0;width:0;height:0;border-style:solid;border-width:0 160px 160px 0;border-color:transparent rgba(55,124,244,.12) transparent transparent}
        .torn-bl{bottom:0;left:0;width:140px;height:140px}
        .torn-bl::before{content:'';position:absolute;bottom:0;left:0;width:0;height:0;border-style:solid;border-width:140px 0 0 140px;border-color:transparent transparent transparent rgba(46,63,143,.12)}

        .fp-card{position:relative;z-index:1;background:rgba(255,255,255,.90);backdrop-filter:blur(22px);border-radius:var(--radius-card);box-shadow:var(--card-shadow);width:100%;max-width:430px;padding:46px 44px 40px;border:1px solid rgba(255,255,255,.95);animation:cardUp .75s cubic-bezier(.22,1,.36,1) .15s both}
        .fp-card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:3px;background:var(--gradient);border-radius:0 0 4px 4px}
        @keyframes cardUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

        .logo-section{display:flex;flex-direction:column;align-items:center;margin-bottom:24px;animation:fadeUp .6s ease .4s both}
        .logo-wrap{position:relative;width:90px;height:90px;border-radius:24px;overflow:hidden;box-shadow:0 0 0 1px rgba(55,124,244,.15),0 8px 28px rgba(55,124,244,.28)}
        .logo-wrap img{width:100%;height:100%;object-fit:cover;display:block}
        .logo-glow{position:absolute;inset:-7px;border-radius:30px;background:linear-gradient(135deg,rgba(55,124,244,.22),rgba(46,63,143,.18));filter:blur(12px);z-index:-1}

        .icon-header{display:flex;flex-direction:column;align-items:center;margin-bottom:16px}
        .icon-circle{width:62px;height:62px;border-radius:18px;background:rgba(55,124,244,.10);border:1.5px solid rgba(55,124,244,.20);display:flex;align-items:center;justify-content:center;margin-bottom:14px;position:relative}
        .icon-circle i{font-size:1.6rem;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .icon-circle::after{content:'';position:absolute;inset:-6px;border-radius:22px;background:linear-gradient(135deg,rgba(55,124,244,.15),rgba(46,63,143,.10));filter:blur(8px);z-index:-1}

        .step-title{font-family:'Sora',sans-serif;font-size:1.15rem;font-weight:700;color:var(--text-dark);letter-spacing:-.025em;text-align:center;margin-bottom:6px}
        .step-sub{font-size:.84rem;color:var(--text-muted);text-align:center;line-height:1.55;margin-bottom:22px}
        .step-sub strong{color:var(--blue);font-weight:600}

        .field-label{display:block;font-size:.75rem;font-weight:600;color:var(--text-mid);letter-spacing:.04em;text-transform:uppercase;margin-bottom:7px}
        .field-error{font-size:.74rem;color:var(--danger);margin-top:5px}
        .field-hint{font-size:.74rem;color:var(--text-muted);margin-top:5px}
        .field-ok{font-size:.74rem;color:var(--success);margin-top:5px}

        .phone-input-group{display:flex;align-items:stretch;border:1.5px solid rgba(55,124,244,.15);border-radius:var(--radius-input);background:rgba(241,245,255,.72);overflow:hidden;transition:border-color .25s,box-shadow .25s}
        .phone-input-group:focus-within{border-color:var(--blue);background:rgba(255,255,255,.97);box-shadow:0 0 0 4px rgba(55,124,244,.10)}
        .phone-input-group.is-invalid{border-color:var(--danger);box-shadow:0 0 0 4px rgba(220,38,38,.09)}
        .phone-prefix{display:flex;align-items:center;gap:5px;padding:0 12px 0 14px;background:rgba(55,124,244,.08);border-right:1.5px solid rgba(55,124,244,.15);font-family:'Sora',sans-serif;font-size:.88rem;font-weight:700;color:var(--blue);white-space:nowrap;user-select:none;flex-shrink:0}
        .phone-number-input{flex:1;height:50px;padding:0 14px;background:transparent;border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:.92rem;color:var(--text-dark);letter-spacing:.04em}
        .phone-number-input::placeholder{color:#9CA3AF;letter-spacing:0}

        .input-wrap{position:relative}
        .input-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:.95rem;color:var(--text-muted);pointer-events:none;transition:color .25s}
        .field-input{width:100%;height:50px;padding:0 42px;background:rgba(241,245,255,.72);border:1.5px solid rgba(55,124,244,.15);border-radius:var(--radius-input);font-family:'DM Sans',sans-serif;font-size:.92rem;color:var(--text-dark);outline:none;transition:border-color .25s,background .25s,box-shadow .25s}
        .field-input:focus{border-color:var(--blue);background:rgba(255,255,255,.97);box-shadow:0 0 0 4px rgba(55,124,244,.10)}
        .field-input.is-invalid{border-color:var(--danger);box-shadow:0 0 0 4px rgba(220,38,38,.09)}
        .field-input.is-valid{border-color:var(--success);box-shadow:0 0 0 4px rgba(22,163,74,.08)}
        .eye-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;padding:4px;display:flex;align-items:center;transition:color .2s}
        .eye-btn:hover{color:var(--blue)}

        .otp-digit{width:52px;height:56px;text-align:center;border:1.5px solid rgba(55,124,244,.20);border-radius:12px;background:rgba(255,255,255,.95);font-family:'Sora',sans-serif;font-size:1.3rem;font-weight:700;color:var(--text-dark);outline:none;transition:border-color .2s,box-shadow .2s,transform .15s}
        .otp-digit:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(55,124,244,.14);transform:scale(1.05)}
        .otp-digit.filled{border-color:var(--blue);background:rgba(55,124,244,.05)}
        .otp-timer{font-size:.75rem;color:var(--text-muted);text-align:center;margin-top:4px}
        .otp-timer span{color:var(--blue);font-weight:600}

        .btn-fp{display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:.93rem;font-weight:600;cursor:pointer;position:relative;overflow:hidden;transition:transform .2s,box-shadow .3s;letter-spacing:.01em;width:100%;height:52px;margin-top:6px}
        .btn-fp:active{transform:scale(.98)}
        .btn-fp:disabled{opacity:.7;cursor:not-allowed;transform:none}
        .btn-primary-fp{background:var(--gradient);color:#fff;box-shadow:var(--btn-shadow)}
        .btn-primary-fp:hover{transform:translateY(-2px);box-shadow:0 16px 44px rgba(55,124,244,.52)}
        .btn-ghost-fp{background:none;border:1.5px solid rgba(55,124,244,.20);color:var(--text-muted);font-size:.86rem;border-radius:12px;height:44px;margin-top:10px}
        .btn-ghost-fp:hover{border-color:var(--blue);color:var(--blue);background:rgba(55,124,244,.05)}
        .btn-text-inner{position:relative;z-index:1;display:flex;align-items:center;gap:8px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .btn-spinner{width:18px;height:18px;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:spin .75s linear infinite}

        .error-box-fp{display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);color:var(--danger);border-radius:12px;padding:11px 14px;margin-bottom:16px;font-size:.84rem;font-weight:500;animation:shake .4s ease}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}

        .success-anim{width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#15803d);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:1.9rem;color:#fff;box-shadow:0 12px 36px rgba(22,163,74,.35);animation:successPop .55s cubic-bezier(.34,1.56,.64,1) .1s both}
        @keyframes successPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}

        .back-link{display:flex;align-items:center;justify-content:center;gap:6px;font-size:.84rem;color:var(--text-muted);text-decoration:none;margin-top:16px;transition:color .2s}
        .back-link:hover{color:var(--blue)}
        .page-footer-fp{position:fixed;bottom:14px;left:0;right:0;text-align:center;font-size:.73rem;color:rgba(107,114,128,.55);z-index:1}

        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .step-anim{animation:fadeUp .4s ease both}

        @media(max-width:480px){.fp-card{padding:36px 22px 30px;border-radius:22px}.otp-digit{width:46px;height:50px}}
        @media(max-width:360px){.fp-card{padding:28px 16px 24px}.otp-digit{width:40px;height:46px;font-size:1.1rem}}
      `}</style>

      {/* Décorations */}
      <div className="torn-tr"></div>
      <div className="torn-bl"></div>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <div className="page-bg">
        <div className="fp-card">

          {/* Logo */}
          <div className="logo-section">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div className="logo-glow"></div>
              <div className="logo-wrap">
                {logoError
                  ? <LogoFallback />
                  : <img src="/assets/img/family-balance-logo.png" alt="FamilyBalance"
                      onError={() => setLogoError(true)} />
                }
              </div>
            </div>
          </div>

          {/* Dots progression */}
          {step !== 'success' && <DotProgress />}

          {/* Erreur globale */}
          {globalError && (
            <div className="error-box-fp">
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{globalError}</span>
            </div>
          )}

          {/* ════ ÉTAPE 1 : Téléphone ════ */}
          {step === 1 && (
            <div className="step-anim">
              <div className="icon-header">
                <div className="icon-circle"><i className="bi bi-phone-vibrate"></i></div>
                <h1 className="step-title">Mot de passe oublié ?</h1>
              </div>
              <p className="step-sub">
                Entrez votre numéro tunisien. Nous vous enverrons un code SMS pour réinitialiser votre mot de passe.
              </p>

              <div style={{ marginBottom: 18 }}>
                <label className="field-label">Numéro de téléphone</label>
                <div className={`phone-input-group ${phoneError ? 'is-invalid' : ''}`}>
                  <div className="phone-prefix">🇹🇳 +216</div>
                  <input className="phone-number-input" type="tel" placeholder="XX XXX XXX"
                    maxLength={8} value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g,'').slice(0,8)); setPhoneError(''); }}
                    onKeyDown={e => e.key === 'Enter' && submitPhone()} />
                </div>
                {phoneError && <div className="field-error">{phoneError}</div>}
              </div>

              <button className="btn-fp btn-primary-fp" onClick={submitPhone} disabled={loading}>
                {loading
                  ? <span className="btn-spinner"></span>
                  : <span className="btn-text-inner"><i className="bi bi-send"></i> Envoyer le code SMS</span>
                }
              </button>

              <Link to="/login" className="back-link">
                <i className="bi bi-arrow-left"></i> Retour à la connexion
              </Link>
            </div>
          )}

          {/* ════ ÉTAPE 2 : OTP ════ */}
          {step === 2 && (
            <div className="step-anim">
              <div className="icon-header">
                <div className="icon-circle"><i className="bi bi-shield-lock"></i></div>
                <h2 className="step-title">Code de vérification</h2>
              </div>
              <p className="step-sub">
                Un code à 4 chiffres a été envoyé au<br />
                <strong>+216 {formatPhone(phone)}</strong>
              </p>

              <div style={{ background:'rgba(55,124,244,.06)', border:'1.5px solid rgba(55,124,244,.18)', borderRadius:14, padding:18, marginBottom:18 }}>
                <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text-mid)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                  <i className="bi bi-grid-3x2-gap"></i> Entrez les 4 chiffres reçus
                </div>
                <OtpInput otp={otp} setOtp={setOtp} onComplete={submitOtp} />
                <div className="otp-timer">
                  Expire dans <span>{formatCountdown(countdown)}</span>
                </div>
                {canResend && (
                  <div style={{ textAlign:'center', marginTop:8 }}>
                    <button onClick={resendOtp} disabled={loading}
                      style={{ fontSize:'.78rem', color:'var(--blue)', fontWeight:600, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', padding:0 }}>
                      Renvoyer le code
                    </button>
                  </div>
                )}
              </div>

              <button className="btn-fp btn-primary-fp" onClick={() => submitOtp()} disabled={loading}>
                {loading
                  ? <span className="btn-spinner"></span>
                  : <span className="btn-text-inner"><i className="bi bi-check2-circle"></i> Vérifier le code</span>
                }
              </button>

              <button className="btn-fp btn-ghost-fp" onClick={() => setStep(1)}>
                <i className="bi bi-arrow-left"></i> Changer de numéro
              </button>
            </div>
          )}

          {/* ════ ÉTAPE 3 : Nouveau mot de passe ════ */}
          {step === 3 && (
            <div className="step-anim">
              <div className="icon-header">
                <div className="icon-circle"><i className="bi bi-key"></i></div>
                <h2 className="step-title">Nouveau mot de passe</h2>
              </div>
              <p className="step-sub">Choisissez un mot de passe sécurisé pour votre compte.</p>

              {/* Nouveau mot de passe */}
              <div style={{ marginBottom: 16 }}>
                <label className="field-label">Nouveau mot de passe</label>
                <div className="input-wrap">
                  <i className="bi bi-lock input-icon"></i>
                  <input type={showNew ? 'text' : 'password'}
                    className={`field-input ${newPwdError ? 'is-invalid' : ''}`}
                    style={{ paddingRight: 44 }}
                    placeholder="Minimum 8 caractères"
                    value={newPwd}
                    onChange={e => { setNewPwd(e.target.value); setNewPwdError(''); checkMatch(e.target.value, confirmPwd); }} />
                  <button type="button" className="eye-btn" onClick={() => setShowNew(!showNew)}>
                    <i className={`bi ${showNew ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                <PwdStrength value={newPwd} />
                {newPwdError && <div className="field-error">{newPwdError}</div>}
              </div>

              {/* Confirmer */}
              <div style={{ marginBottom: 18 }}>
                <label className="field-label">Confirmer le mot de passe</label>
                <div className="input-wrap">
                  <i className="bi bi-lock-fill input-icon"></i>
                  <input type={showConfirm ? 'text' : 'password'}
                    className={`field-input ${confirmError ? 'is-invalid' : confirmOk ? 'is-valid' : ''}`}
                    style={{ paddingRight: 44 }}
                    placeholder="Répétez votre mot de passe"
                    value={confirmPwd}
                    onChange={e => { setConfirmPwd(e.target.value); checkMatch(newPwd, e.target.value); }} />
                  <button type="button" className="eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
                    <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                {confirmError && <div className="field-error">{confirmError}</div>}
                {confirmOk && !confirmError && <div className="field-ok">✓ Les mots de passe correspondent</div>}
              </div>

              <button className="btn-fp btn-primary-fp" onClick={submitNewPwd} disabled={loading}>
                {loading
                  ? <span className="btn-spinner"></span>
                  : <span className="btn-text-inner"><i className="bi bi-shield-check"></i> Réinitialiser le mot de passe</span>
                }
              </button>
            </div>
          )}

          {/* ════ SUCCÈS ════ */}
          {step === 'success' && (
            <div className="step-anim" style={{ textAlign: 'center', padding: '8px 0' }}>
              <div className="success-anim"><i className="bi bi-check-lg"></i></div>
              <h2 style={{ fontFamily:"'Sora',sans-serif", fontSize:'1.18rem', fontWeight:700, color:'var(--text-dark)', marginBottom:8 }}>
                Mot de passe réinitialisé !
              </h2>
              <p style={{ fontSize:'.86rem', color:'var(--text-muted)', marginBottom:24, lineHeight:1.55 }}>
                Votre mot de passe a été mis à jour avec succès.<br />
                Vous pouvez maintenant vous reconnecter à votre espace familial.
              </p>
              <button className="btn-fp btn-primary-fp" style={{ maxWidth: 280, margin: '0 auto' }}
                onClick={() => navigate('/login')}>
                <span className="btn-text-inner">
                  <i className="bi bi-box-arrow-in-right"></i> Se connecter
                </span>
              </button>
            </div>
          )}

        </div>

        <p className="page-footer-fp">© 2026 FamilyBalance &nbsp;·&nbsp; Tous droits réservés</p>
      </div>
    </>
  );
}

export default ForgotPassword;
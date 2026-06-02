import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const BASE_URL = 'http://localhost:8080';

/* ══ Logo SVG fallback ══ */
function LogoFallback() {
  return (
    <svg viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg" width="90" height="90">
      <defs>
        <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#377CF4" />
          <stop offset="100%" stopColor="#2E3F8F" />
        </linearGradient>
      </defs>
      <rect width="90" height="90" fill="url(#lg2)" />
      <path d="M45 18L20 40h5v28h40V40h5z" fill="rgba(255,255,255,.95)" />
      <rect x="39" y="52" width="12" height="16" rx="2" fill="url(#lg2)" />
      <rect x="27" y="47" width="9"  height="9"  rx="2" fill="url(#lg2)" />
      <rect x="54" y="47" width="9"  height="9"  rx="2" fill="url(#lg2)" />
      <rect x="34" y="35" width="22" height="2.5" rx="1.25" fill="rgba(255,255,255,.85)" />
      <circle cx="30" cy="38" r="3" fill="rgba(255,255,255,.85)" />
      <circle cx="60" cy="38" r="3" fill="rgba(255,255,255,.85)" />
    </svg>
  );
}

/* ══ Password strength ══ */
function getPwdStrength(val) {
  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { cls: '',       text: 'Force du mot de passe', col: '' },
    { cls: 'weak',   text: 'Faible',                col: '#ef4444' },
    { cls: 'fair',   text: 'Acceptable',            col: '#ea580c' },
    { cls: 'good',   text: 'Bon',                   col: '#eab308' },
    { cls: 'strong', text: 'Excellent',             col: '#16a34a' },
  ];
  return { score, ...levels[score] };
}

function PwdStrength({ value }) {
  const { score, cls, text, col } = getPwdStrength(value);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            height: 3, flex: 1, borderRadius: 2,
            background: score > 0 && i < score
              ? (cls === 'weak' ? '#ef4444' : cls === 'fair' ? '#ea580c' : cls === 'good' ? '#eab308' : '#16a34a')
              : 'rgba(55,124,244,.12)',
            transition: 'background .3s'
          }} />
        ))}
      </div>
      <span style={{ fontSize: '.73rem', color: col || 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

/* ══ OTP 4 digits component ══ */
function OtpInput({ otp, setOtp, onConfirm }) {
  const refs = [useRef(), useRef(), useRef(), useRef()];
  const handleChange = (val, idx) => {
    val = val.replace(/\D/g, '');
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 3) refs[idx + 1].current?.focus();
    if (idx === 3 && val) {
      const code = [...next].join('');
      if (code.length === 4) onConfirm(code);
    }
  };
  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0)
      refs[idx - 1].current?.focus();
  };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[0,1,2,3].map(i => (
        <input key={i} ref={refs[i]} type="text" maxLength={1} value={otp[i]}
          onChange={e => handleChange(e.target.value, i)}
          onKeyDown={e => handleKeyDown(e, i)}
          style={{
            width: 44, height: 48, textAlign: 'center',
            border: '1.5px solid rgba(55,124,244,.20)',
            borderRadius: 10, background: 'rgba(255,255,255,.9)',
            fontFamily: "'Sora', sans-serif", fontSize: '1.1rem', fontWeight: 700,
            color: '#111827', outline: 'none',
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════ */
function Register() {
  const navigate  = useNavigate();
  const { login } = useAuth();

  const [step,        setStep]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [logoError,   setLogoError]   = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [createdFamilyId, setCreatedFamilyId] = useState(null);

  /* ── Étape 1 ── */
  const [familyName,  setFamilyName]  = useState('');
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [username,    setUsername]    = useState('');
  const [pwd,         setPwd]         = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [phone,       setPhone]       = useState('');
  const [errors,      setErrors]      = useState({});
  const [otpVisible,    setOtpVisible]    = useState(false);
  const [otpCode,       setOtpCode]       = useState(['','','','']);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpError,      setOtpError]      = useState(false);
  const [otpSending,    setOtpSending]    = useState(false);

  /* Auto-génération du username depuis firstName + lastName — aligné sur
     le web Angular (cf. register.component.ts:syncUsername). L'utilisateur
     n'a plus à saisir / choisir un identifiant : le système le dérive
     automatiquement de "prenom nom" (en minuscules, espaces compactés). */
  useEffect(() => {
    const f = firstName.trim().toLowerCase().replace(/\s+/g, '');
    const l = lastName.trim().toLowerCase().replace(/\s+/g, '');
    setUsername(f && l ? `${f} ${l}` : f + l);
  }, [firstName, lastName]);

  /* ── Étape 2 ── */
  const [members,        setMembers]        = useState([]);
  const [showAddForm,    setShowAddForm]    = useState(false);
  const [editingIdx,     setEditingIdx]     = useState(-1);
  const [mRole,          setMRole]          = useState('Gestionnaire');
  const [mFirstName,     setMFirstName]     = useState('');
  const [mLastName,      setMLastName]      = useState('');
  const [mUsername,      setMUsername]      = useState('');
  const [mPwd,           setMPwd]           = useState('');
  const [showMPwd,       setShowMPwd]       = useState(false);
  const [mPhone,         setMPhone]         = useState('');
  const [mErrors,        setMErrors]        = useState({});
  const [mOtpVisible,    setMOtpVisible]    = useState(false);
  const [mOtpCode,       setMOtpCode]       = useState(['','','','']);
  const [mPhoneVerified, setMPhoneVerified] = useState(false);
  const [mOtpError,      setMOtpError]      = useState(false);
  const [mOtpSending,    setMOtpSending]    = useState(false);

  /* Auto-génération du username du membre depuis mFirstName + mLastName. */
  useEffect(() => {
    const f = mFirstName.trim().toLowerCase().replace(/\s+/g, '');
    const l = mLastName.trim().toLowerCase().replace(/\s+/g, '');
    setMUsername(f && l ? `${f} ${l}` : f + l);
  }, [mFirstName, mLastName]);

  const showGlobalErr = (msg) => {
    setGlobalError(msg);
    setTimeout(() => setGlobalError(''), 5000);
  };

  /* ════════════════════════════════
     OTP — ÉTAPE 1 (Admin)
  ════════════════════════════════ */
  const sendOtp = async () => {
    if (phone.length !== 8) {
      setErrors(e => ({ ...e, phone: 'Numéro invalide (8 chiffres requis).' }));
      return;
    }
    setErrors(e => ({ ...e, phone: '' }));
    setOtpSending(true);
    try {
      const res = await fetch(`${BASE_URL}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+216' + phone }),
      });
      if (!res.ok) {
        let errMsg = 'Impossible d\'envoyer le SMS. Vérifiez le numéro.';
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
          else if (errData?.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }
      setOtpVisible(true);
      setOtpCode(['','','','']);
      setPhoneVerified(false);
      setOtpError(false);
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setErrors(e => ({ ...e, phone: 'Serveur inaccessible. Vérifiez votre connexion.' }));
      } else {
        setErrors(e => ({ ...e, phone: err.message || 'Impossible d\'envoyer le SMS.' }));
      }
    } finally {
      setOtpSending(false);
    }
  };

  const confirmOtp = async (code) => {
    const c = code || otpCode.join('');
    if (c.length < 4) return;
    try {
      const res = await fetch(`${BASE_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+216' + phone, code: c }),
      });
      if (res.ok) {
        setPhoneVerified(true);
        setOtpVisible(false);
        setOtpError(false);
      } else {
        setOtpError(true);
        setOtpCode(['','','','']);
      }
    } catch {
      setOtpError(true);
      setOtpCode(['','','','']);
    }
  };

  /* ════════════════════════════════
     ÉTAPE 1 → appels API :
     1. POST /users/register       → crée le user
     2. POST /admins/create-family → crée famille + admin + membre(ADMINISTRATEUR)
     3. POST /comptes              → crée le compte de la famille (si non créé par backend)
  ════════════════════════════════ */
  const goStep2 = async () => {
    const errs = {};
    if (!familyName.trim())         errs.familyName = 'Ce champ est requis.';
    if (!firstName.trim())          errs.firstName  = 'Ce champ est requis.';
    if (!lastName.trim())           errs.lastName   = 'Ce champ est requis.';
    if (username.trim().length < 3) errs.username   = 'Minimum 3 caractères.';
    if (pwd.length < 8)             errs.pwd        = '8 caractères minimum.';
    if (phone.length !== 8)         errs.phone      = 'Numéro invalide (8 chiffres requis).';
    setErrors(errs);
    if (!phoneVerified) { showGlobalErr('Veuillez vérifier votre numéro (code SMS).'); return; }
    if (Object.keys(errs).length > 0) { showGlobalErr('Veuillez corriger les champs en rouge.'); return; }

    setLoading(true);
    setGlobalError('');

    try {
      // ── 1 : Créer le User de l'admin ──
      const resUser = await fetch(`${BASE_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:  username.trim(),
          password:  pwd,
          firstName: firstName.trim(),
          lastName:  lastName.trim(),
          phone:     '+216' + phone,
          active:    true,
        }),
      });
      if (!resUser.ok) {
        const e = await resUser.json().catch(() => ({}));
        throw new Error(e.message || `Erreur création utilisateur (${resUser.status})`);
      }
      const userData = await resUser.json();
      const userId = userData?.id;
      if (!userId) throw new Error("L'id utilisateur n'a pas été retourné.");
      console.log('[Register] userId créé :', userId);

      // ── 2 : Créer la Famille ──
      const resFamily = await fetch(
        `${BASE_URL}/admins/create-family?name=${encodeURIComponent(familyName.trim())}&creatorId=${userId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (!resFamily.ok) {
        const e = await resFamily.json().catch(() => ({}));
        throw new Error(e.message || `Erreur création famille (${resFamily.status})`);
      }
      const familyData = await resFamily.json();
      const familyId = familyData?.id;
      if (!familyId) throw new Error("L'id famille n'a pas été retourné.");
      console.log('[Register] familyId créé :', familyId);
      setCreatedFamilyId(familyId);

      // ✅ FIX BUG COMPTE : Vérifier si le compte a été créé par le backend,
      //    sinon le créer manuellement ici.
      const resCompteCheck = await fetch(`${BASE_URL}/comptes/famille/${familyId}`);
      if (!resCompteCheck.ok) {
        console.log('[Register] Compte non trouvé, création manuelle...');
        const resCompte = await fetch(`${BASE_URL}/comptes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            famille: { id: familyId },
            budget: 0,
          }),
        });
        if (!resCompte.ok) {
          const e = await resCompte.json().catch(() => ({}));
          console.warn('[Register] Erreur création compte :', e.message || resCompte.status);
          // On ne bloque pas le flow — le backend devrait normalement le créer
        } else {
          console.log('[Register] Compte créé manuellement avec succès.');
        }
      } else {
        console.log('[Register] Compte déjà créé par le backend ✅');
      }

      setLoading(false);
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error('Erreur goStep2:', err);
      showGlobalErr(err.message || 'Erreur serveur. Vérifiez la console.');
      setLoading(false);
    }
  };

  /* ════════════════════════════════
     OTP — ÉTAPE 2 (Membre)
  ════════════════════════════════ */
  const sendMOtp = async () => {
    if (mPhone.length !== 8) {
      setMErrors(e => ({ ...e, phone: 'Numéro invalide (8 chiffres requis).' }));
      return;
    }
    setMErrors(e => ({ ...e, phone: '' }));
    setMOtpSending(true);
    try {
      const res = await fetch(`${BASE_URL}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+216' + mPhone }),
      });
      if (!res.ok) {
        let errMsg = 'Impossible d\'envoyer le SMS. Vérifiez le numéro.';
        try {
          const errData = await res.json();
          if (errData?.message) errMsg = errData.message;
          else if (errData?.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }
      setMOtpVisible(true);
      setMOtpCode(['','','','']);
      setMPhoneVerified(false);
      setMOtpError(false);
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setMErrors(e => ({ ...e, phone: 'Serveur inaccessible. Vérifiez votre connexion.' }));
      } else {
        setMErrors(e => ({ ...e, phone: err.message || 'Impossible d\'envoyer le SMS.' }));
      }
    } finally {
      setMOtpSending(false);
    }
  };

  const confirmMOtp = async (code) => {
    const c = code || mOtpCode.join('');
    if (c.length < 4) return;
    try {
      const res = await fetch(`${BASE_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+216' + mPhone, code: c }),
      });
      if (res.ok) {
        setMPhoneVerified(true);
        setMOtpVisible(false);
        setMOtpError(false);
      } else {
        setMOtpError(true);
        setMOtpCode(['','','','']);
      }
    } catch {
      setMOtpError(true);
      setMOtpCode(['','','','']);
    }
  };

  const resetMemberForm = () => {
    setMRole('Gestionnaire'); setMFirstName(''); setMLastName(''); setMUsername(''); setMPwd(''); setMPhone('');
    setMPhoneVerified(false); setMOtpVisible(false); setMOtpCode(['','','','']);
    setMErrors({}); setEditingIdx(-1); setMOtpError(false);
  };

  const toggleAddForm = () => {
    if (showAddForm) { setShowAddForm(false); resetMemberForm(); }
    else             { setShowAddForm(true);  resetMemberForm(); }
  };

  const saveMember = () => {
    const errs = {};
    if (!mFirstName.trim())          errs.firstName = 'Ce champ est requis.';
    if (!mLastName.trim())           errs.lastName  = 'Ce champ est requis.';
    if (mUsername.trim().length < 3) errs.username  = 'Minimum 3 caractères.';
    if (mPwd.length < 6)             errs.pwd       = '6 caractères minimum.';
    setMErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const member = {
      role: mRole, firstName: mFirstName.trim(), lastName: mLastName.trim(),
      username: mUsername.trim(), password: mPwd,
      phone: mPhone ? '+216' + mPhone : '', verified: mPhoneVerified,
    };
    if (editingIdx >= 0) { setMembers(m => m.map((x, i) => i === editingIdx ? member : x)); }
    else                 { setMembers(m => [...m, member]); }
    setShowAddForm(false);
    resetMemberForm();
  };

  const editMember = (idx) => {
    const m = members[idx];
    setEditingIdx(idx); setMRole(m.role || 'Gestionnaire');
    setMFirstName(m.firstName || ''); setMLastName(m.lastName || '');
    setMUsername(m.username); setMPhone(m.phone?.replace('+216', '') || '');
    setMPhoneVerified(m.verified || false); setShowAddForm(true);
  };

  /* ════════════════════════════════
     ÉTAPE 2 → par membre :
     A. POST /users/register       → table user
     B. POST /admins/invite-member → table membre (role CONSULTANT par défaut)
     C. PUT  /admins/change-role   → applique le bon rôle (GESTIONNAIRE / CONSULTANT)
  ════════════════════════════════ */
  const finishSetup = async () => {
    setLoading(true);
    try {
      for (const member of members) {
        // ── A : Créer le User ──
        const resUser = await fetch(`${BASE_URL}/users/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: member.username, password: member.password,
            firstName: member.firstName, lastName: member.lastName,
            phone: member.phone, active: true,
          }),
        });
        if (!resUser.ok) {
          const e = await resUser.json().catch(() => ({}));
          throw new Error(e.message || `Erreur création user "${member.username}" (${resUser.status})`);
        }
        const userData = await resUser.json();
        const userId = userData?.id;
        if (!userId) throw new Error(`L'id du user "${member.username}" n'a pas été retourné.`);
        console.log('[Register] userId membre créé :', userId);

        // ── B : Inviter dans la famille → crée entrée dans table membre ──
        if (!createdFamilyId) throw new Error('familyId manquant — rechargez et réessayez.');
        const resInvite = await fetch(
          `${BASE_URL}/admins/invite-member?userId=${userId}&familleId=${createdFamilyId}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } }
        );
        if (!resInvite.ok) {
          const e = await resInvite.json().catch(() => ({}));
          throw new Error(e.message || `Erreur invite-member pour "${member.username}" (${resInvite.status})`);
        }
        console.log('[Register] membre invité dans famille', createdFamilyId);

        // ── C : Appliquer le bon rôle ──
        const resMembres = await fetch(`${BASE_URL}/membres/famille/${createdFamilyId}`);
        if (!resMembres.ok) throw new Error('Impossible de récupérer les membres de la famille.');
        const membresData = await resMembres.json();
        const membreEntry = membresData.find(m => m.user?.id === userId);

        if (membreEntry && member.role) {
          const roleMap = { 'Gestionnaire': 'GESTIONNAIRE', 'Consultant': 'CONSULTANT' };
          const backendRole = roleMap[member.role] || 'CONSULTANT';
          const resRole = await fetch(
            `${BASE_URL}/admins/change-role/${membreEntry.id}?role=${backendRole}`,
            { method: 'PUT', headers: { 'Content-Type': 'application/json' } }
          );
          if (!resRole.ok) console.warn(`[Register] change-role échoué pour membre ${membreEntry.id}`);
          else console.log('[Register] rôle appliqué :', backendRole);
        }
      }
      setStep('success');
    } catch (err) {
      console.error('[Register] finishSetup error:', err);
      showGlobalErr(err.message || "Erreur lors de l'ajout des membres. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  /* ════════════════════════════════
     ✅ FIX PRINCIPAL : goToDashboard
     — Fait un vrai login JWT
     — Stocke le username dans sessionStorage
     — Le Dashboard peut alors charger les bonnes données
  ════════════════════════════════ */
  const goToDashboard = async () => {
    setLoading(true);
    try {
      // ✅ FIX 1 : Faire un vrai login pour obtenir le token JWT réel
      const resLogin = await fetch(`${BASE_URL}/authentification/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: pwd,
        }),
      });

      if (resLogin.ok) {
        const loginData = await resLogin.json();
        // ✅ FIX 2 : Stocker le username dans sessionStorage (comme Login.jsx)
        sessionStorage.clear();
        sessionStorage.setItem('username', username.trim());
        // ✅ FIX 3 : Appeler login() avec le vrai token JWT
        login({ username: username.trim() }, loginData.token, loginData.refreshToken);
        console.log('[Register] Login JWT réussi, redirection dashboard...');
      } else {
        // Fallback : si le login échoue pour une raison quelconque,
        // on stocke quand même le username et on navigue
        console.warn('[Register] Login JWT échoué, fallback sessionStorage uniquement.');
        sessionStorage.clear();
        sessionStorage.setItem('username', username.trim());
        login({ username: username.trim() }, null, null);
      }

      navigate('/');
    } catch (err) {
      console.error('[Register] goToDashboard error:', err);
      // Fallback réseau : on navigue quand même avec le username en session
      sessionStorage.clear();
      sessionStorage.setItem('username', username.trim());
      login({ username: username.trim() }, null, null);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Sora:wght@300;400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
          --blue:#377CF4;--violet:#2E3F8F;--gradient:linear-gradient(135deg,#377CF4 0%,#2E3F8F 100%);
          --gradient-r:linear-gradient(135deg,#2a6be0 0%,#4a3189 100%);
          --bg:#EEF2FC;--text-dark:#111827;--text-mid:#374151;--text-muted:#6B7280;
          --card-shadow:0 32px 80px rgba(55,124,244,0.16),0 8px 24px rgba(46,63,143,0.10);
          --btn-shadow:0 10px 32px rgba(55,124,244,0.48);
          --radius-card:28px;--radius-input:13px;--success:#16a34a;--danger:#dc2626;
        }
        html,body{min-height:100%;font-family:'DM Sans',sans-serif;background:var(--bg);overflow-x:hidden}
        .page-bg{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 16px 56px;position:relative}
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
        .reg-card{position:relative;z-index:1;background:rgba(255,255,255,.90);backdrop-filter:blur(22px);border-radius:var(--radius-card);box-shadow:var(--card-shadow);width:100%;max-width:500px;padding:46px 44px 40px;border:1px solid rgba(255,255,255,.95);animation:cardUp .75s cubic-bezier(.22,1,.36,1) .15s both}
        .reg-card::before{content:'';position:absolute;top:0;left:10%;right:10%;height:3px;background:var(--gradient);border-radius:0 0 4px 4px}
        @keyframes cardUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .logo-section{display:flex;flex-direction:column;align-items:center;margin-bottom:28px}
        .logo-wrap{position:relative;width:90px;height:90px;border-radius:24px;overflow:hidden;box-shadow:0 0 0 1px rgba(55,124,244,.15),0 8px 28px rgba(55,124,244,.28)}
        .logo-wrap img{width:100%;height:100%;object-fit:cover;display:block}
        .logo-glow{position:absolute;inset:-7px;border-radius:30px;background:linear-gradient(135deg,rgba(55,124,244,.22),rgba(46,63,143,.18));filter:blur(12px);z-index:-1}
        .page-title{font-family:'Sora',sans-serif;font-size:1.18rem;font-weight:600;color:var(--text-dark);text-align:center;margin-bottom:26px}
        .page-title .accent{background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .step-indicator{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:32px}
        .step-item{display:flex;flex-direction:column;align-items:center;gap:6px}
        .step-circle{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Sora',sans-serif;font-size:.82rem;font-weight:700;border:2px solid rgba(55,124,244,.25);color:var(--text-muted);background:rgba(241,245,255,.7);transition:all .4s}
        .step-circle.active{background:var(--gradient);border-color:transparent;color:#fff;box-shadow:0 6px 20px rgba(55,124,244,.40)}
        .step-circle.done{background:linear-gradient(135deg,#16a34a,#15803d);border-color:transparent;color:#fff}
        .step-label{font-size:.72rem;font-weight:500;color:var(--text-muted);white-space:nowrap}
        .step-label.active{color:var(--blue);font-weight:600}
        .step-label.done{color:var(--success)}
        .step-line{width:80px;height:2px;background:rgba(55,124,244,.15);margin:0 4px 22px;border-radius:2px;overflow:hidden}
        .step-line-fill{height:100%;border-radius:2px;background:var(--gradient);transition:width .6s cubic-bezier(.22,1,.36,1)}
        .field-group{margin-bottom:16px}
        .field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .field-label{display:block;font-size:.75rem;font-weight:600;color:var(--text-mid);letter-spacing:.04em;text-transform:uppercase;margin-bottom:7px}
        .input-wrap{position:relative}
        .input-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:.95rem;color:var(--text-muted);pointer-events:none;transition:color .25s}
        .field-input{width:100%;height:50px;padding:0 42px 0 42px;background:rgba(241,245,255,.72);border:1.5px solid rgba(55,124,244,.15);border-radius:var(--radius-input);font-family:'DM Sans',sans-serif;font-size:.92rem;color:var(--text-dark);outline:none;transition:border-color .25s,background .25s,box-shadow .25s}
        .field-input::placeholder{color:#9CA3AF}
        .field-input:focus{border-color:var(--blue);background:rgba(255,255,255,.97);box-shadow:0 0 0 4px rgba(55,124,244,.10)}
        .field-input.is-invalid{border-color:var(--danger);box-shadow:0 0 0 4px rgba(220,38,38,.09)}
        .eye-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1rem;padding:4px;display:flex;align-items:center;transition:color .2s}
        .eye-btn:hover{color:var(--blue)}
        .field-error{font-size:.74rem;color:var(--danger);margin-top:5px}
        .phone-verify-row{display:flex;gap:8px;align-items:flex-end}
        .phone-input-group{display:flex;align-items:stretch;border:1.5px solid rgba(55,124,244,.15);border-radius:var(--radius-input);background:rgba(241,245,255,.72);overflow:hidden;transition:border-color .25s,box-shadow .25s;flex:1}
        .phone-input-group:focus-within{border-color:var(--blue);background:rgba(255,255,255,.97);box-shadow:0 0 0 4px rgba(55,124,244,.10)}
        .phone-input-group.is-valid{border-color:var(--success)}
        .phone-prefix{display:flex;align-items:center;gap:5px;padding:0 12px 0 14px;background:rgba(55,124,244,.08);border-right:1.5px solid rgba(55,124,244,.15);font-family:'Sora',sans-serif;font-size:.88rem;font-weight:700;color:var(--blue);white-space:nowrap;user-select:none;flex-shrink:0}
        .phone-number-input{flex:1;height:50px;padding:0 14px;background:transparent;border:none;outline:none;font-family:'DM Sans',sans-serif;font-size:.92rem;color:var(--text-dark);letter-spacing:.04em}
        .phone-number-input::placeholder{color:#9CA3AF;letter-spacing:0}
        .otp-section{background:rgba(55,124,244,.06);border:1.5px solid rgba(55,124,244,.18);border-radius:14px;padding:16px;margin-top:10px;animation:fadeIn .35s ease}
        .otp-label{font-size:.80rem;font-weight:600;color:var(--text-mid);margin-bottom:10px}
        .otp-row{display:flex;gap:8px;align-items:center}
        .otp-verified{display:flex;align-items:center;gap:6px;font-size:.82rem;font-weight:600;color:var(--success);margin-top:10px}
        .btn-reg{display:flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:14px;font-family:'Sora',sans-serif;font-size:.92rem;font-weight:600;cursor:pointer;position:relative;overflow:hidden;transition:transform .2s,box-shadow .3s;letter-spacing:.01em}
        .btn-reg:active{transform:scale(.98)}
        .btn-primary-reg{width:100%;height:52px;background:var(--gradient);color:#fff;box-shadow:var(--btn-shadow);margin-top:8px}
        .btn-primary-reg:hover{transform:translateY(-2px);box-shadow:0 16px 44px rgba(55,124,244,.52)}
        .btn-primary-reg:disabled{opacity:.7;cursor:not-allowed;transform:none}
        .btn-verify-reg{height:50px;padding:0 16px;white-space:nowrap;flex-shrink:0;background:var(--gradient);color:#fff;box-shadow:0 6px 20px rgba(55,124,244,.35);font-size:.82rem;border-radius:14px;border:none;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer;transition:all .2s}
        .btn-verify-reg:hover{transform:translateY(-1px)}
        .btn-verify-reg:disabled{opacity:.7;cursor:not-allowed;transform:none}
        .btn-verify-reg.verified{background:linear-gradient(135deg,#16a34a,#15803d)}
        .btn-otp-confirm{height:42px;padding:0 16px;background:var(--gradient);color:#fff;font-size:.82rem;box-shadow:0 4px 14px rgba(55,124,244,.30);border-radius:10px;flex-shrink:0;border:none;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer}
        .btn-secondary-reg{height:44px;padding:0 20px;background:rgba(55,124,244,.08);border:1.5px solid rgba(55,124,244,.20);color:var(--blue);font-size:.86rem;border-radius:14px;font-family:'Sora',sans-serif;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center;transition:all .2s}
        .btn-secondary-reg:hover{background:rgba(55,124,244,.13);transform:translateY(-1px)}
        .error-box-reg{display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);color:var(--danger);border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:.84rem;font-weight:500;animation:shake .4s ease}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
        .members-list{display:flex;flex-direction:column;gap:10px;margin-bottom:18px;max-height:320px;overflow-y:auto}
        .member-card{display:flex;align-items:center;gap:12px;background:rgba(241,245,255,.75);border:1.5px solid rgba(55,124,244,.14);border-radius:14px;padding:12px 14px;position:relative;overflow:hidden;animation:memberIn .35s cubic-bezier(.22,1,.36,1)}
        .member-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gradient)}
        @keyframes memberIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
        .member-avatar{width:40px;height:40px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;color:#fff;font-weight:700;font-family:'Sora',sans-serif}
        .member-info{flex:1;min-width:0}
        .member-name{font-size:.90rem;font-weight:600;color:var(--text-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .member-meta{font-size:.76rem;color:var(--text-muted);margin-top:1px}
        .member-actions{display:flex;gap:6px;flex-shrink:0}
        .member-btn{width:32px;height:32px;border-radius:8px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;transition:all .2s}
        .member-btn-edit{background:rgba(55,124,244,.10);color:var(--blue)}
        .member-btn-edit:hover{background:rgba(55,124,244,.20)}
        .member-btn-del{background:rgba(220,38,38,.08);color:var(--danger)}
        .member-btn-del:hover{background:rgba(220,38,38,.16)}
        .empty-state{text-align:center;padding:28px 0;color:var(--text-muted);font-size:.86rem}
        .add-member-form{background:rgba(55,124,244,.04);border:1.5px dashed rgba(55,124,244,.25);border-radius:16px;padding:20px;margin-bottom:18px;animation:fadeIn .35s ease}
        .add-member-title{font-family:'Sora',sans-serif;font-size:.88rem;font-weight:700;color:var(--text-dark);margin-bottom:14px;display:flex;align-items:center;gap:6px}
        .form-actions{display:flex;gap:8px;margin-top:14px}
        .success-screen{text-align:center;padding:10px 0;animation:fadeIn .5s ease}
        .success-icon{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#15803d);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.8rem;color:#fff;box-shadow:0 12px 36px rgba(22,163,74,.35);animation:successPop .5s cubic-bezier(.34,1.56,.64,1) .1s both}
        @keyframes successPop{from{transform:scale(0)}to{transform:scale(1)}}
        .success-title{font-family:'Sora',sans-serif;font-size:1.22rem;font-weight:700;color:var(--text-dark);margin-bottom:6px}
        .success-sub{font-size:.87rem;color:var(--text-muted);margin-bottom:24px}
        .family-badge{display:inline-flex;align-items:center;gap:8px;background:var(--gradient);color:#fff;border-radius:50px;padding:8px 20px;font-size:.88rem;font-weight:600;margin-bottom:20px;box-shadow:0 6px 20px rgba(55,124,244,.35)}
        .divider-reg{display:flex;align-items:center;gap:12px;margin:20px 0;color:#D1D5DB;font-size:.78rem;letter-spacing:.04em}
        .divider-reg::before,.divider-reg::after{content:'';flex:1;height:1px;background:rgba(55,124,244,.12)}
        .login-text{text-align:center;font-size:.87rem;color:var(--text-muted)}
        .login-text a{color:var(--blue);text-decoration:none;font-weight:600;transition:color .2s}
        .page-footer-reg{position:fixed;bottom:14px;left:0;right:0;text-align:center;font-size:.73rem;color:rgba(107,114,128,.55);z-index:1}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:480px){.reg-card{padding:36px 22px 30px;border-radius:22px}.field-row{grid-template-columns:1fr}.phone-verify-row{flex-direction:column}.btn-verify-reg{width:100%}}
      `}</style>

      <div className="torn-tr"></div>
      <div className="torn-bl"></div>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <div className="page-bg">
        <div className="reg-card">

          {/* Logo */}
          <div className="logo-section">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div className="logo-glow"></div>
              <div className="logo-wrap">
                {logoError
                  ? <LogoFallback />
                  : <img src="/assets/img/family-balance-logo.png" alt="Family Balance" onError={() => setLogoError(true)} />
                }
              </div>
            </div>
          </div>

          <p className="page-title">Créez votre <span className="accent">espace familial</span></p>

          {step !== 'success' && (
            <div className="step-indicator">
              <div className="step-item">
                <div className={`step-circle ${step === 1 ? 'active' : 'done'}`}>
                  {step === 1 ? '1' : <i className="bi bi-check-lg" style={{ fontSize: '.75rem' }}></i>}
                </div>
                <span className={`step-label ${step === 1 ? 'active' : 'done'}`}>La famille</span>
              </div>
              <div className="step-line">
                <div className="step-line-fill" style={{ width: step === 2 ? '100%' : '0%' }}></div>
              </div>
              <div className="step-item">
                <div className={`step-circle ${step === 2 ? 'active' : ''}`}>2</div>
                <span className={`step-label ${step === 2 ? 'active' : ''}`}>Les membres</span>
              </div>
            </div>
          )}

          {globalError && (
            <div className="error-box-reg">
              <i className="bi bi-exclamation-circle-fill"></i>
              <span>{globalError}</span>
            </div>
          )}

          {/* ════ ÉTAPE 1 ════ */}
          {step === 1 && (
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>👨‍💼 Administrateur de la famille</div>
              <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: 24 }}>Ces informations servent à créer votre compte principal</p>

              <div className="field-group">
                <label className="field-label">Nom de la famille</label>
                <div className="input-wrap">
                  <i className="bi bi-house-heart input-icon"></i>
                  <input type="text" className={`field-input ${errors.familyName ? 'is-invalid' : ''}`}
                    placeholder="Entrez le nom de la famille" value={familyName}
                    onChange={e => { setFamilyName(e.target.value); setErrors(er => ({...er, familyName: ''})); }} />
                </div>
                {errors.familyName && <div className="field-error">{errors.familyName}</div>}
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Prénom</label>
                  <div className="input-wrap">
                    <i className="bi bi-person input-icon"></i>
                    <input type="text" className={`field-input ${errors.firstName ? 'is-invalid' : ''}`}
                      placeholder="Entrez votre prénom" value={firstName}
                      onChange={e => { setFirstName(e.target.value); setErrors(er => ({...er, firstName: ''})); }} />
                  </div>
                  {errors.firstName && <div className="field-error">{errors.firstName}</div>}
                </div>
                <div className="field-group">
                  <label className="field-label">Nom</label>
                  <div className="input-wrap">
                    <i className="bi bi-person input-icon"></i>
                    <input type="text" className={`field-input ${errors.lastName ? 'is-invalid' : ''}`}
                      placeholder="Entrez votre nom" value={lastName}
                      onChange={e => { setLastName(e.target.value); setErrors(er => ({...er, lastName: ''})); }} />
                  </div>
                  {errors.lastName && <div className="field-error">{errors.lastName}</div>}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Mot de passe</label>
                <div className="input-wrap">
                  <i className="bi bi-lock input-icon"></i>
                  <input type={showPwd ? 'text' : 'password'}
                    className={`field-input ${errors.pwd ? 'is-invalid' : ''}`}
                    style={{ paddingRight: 44 }} placeholder="Minimum 8 caractères" value={pwd}
                    onChange={e => { setPwd(e.target.value); setErrors(er => ({...er, pwd: ''})); }} />
                  <button type="button" className="eye-btn" onClick={() => setShowPwd(!showPwd)}>
                    <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                <PwdStrength value={pwd} />
                {errors.pwd && <div className="field-error">{errors.pwd}</div>}
              </div>

              <div className="field-group">
                <label className="field-label">Numéro de téléphone</label>
                <div className="phone-verify-row">
                  <div className={`phone-input-group ${phoneVerified ? 'is-valid' : ''}`}>
                    <div className="phone-prefix">🇹🇳 +216</div>
                    <input type="tel" className="phone-number-input" placeholder="XX XXX XXX" maxLength={8}
                      value={phone} disabled={phoneVerified}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                  </div>
                  {!phoneVerified
                    ? (
                      <button className="btn-verify-reg" onClick={sendOtp} disabled={otpSending}>
                        {otpSending
                          ? <span style={{ width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .75s linear infinite',display:'inline-block' }}></span>
                          : <><i className="bi bi-shield-check"></i> Vérifier</>
                        }
                      </button>
                    )
                    : <button className="btn-verify-reg verified" disabled><i className="bi bi-check-lg"></i> Vérifié</button>
                  }
                </div>
                {errors.phone && <div className="field-error">{errors.phone}</div>}
              </div>

              {otpVisible && !phoneVerified && (
                <div className="otp-section">
                  <div className="otp-label"><i className="bi bi-envelope-check"></i> Code SMS envoyé — Entrez les 4 chiffres</div>
                  <div className="otp-row">
                    <OtpInput otp={otpCode} setOtp={setOtpCode} onConfirm={confirmOtp} />
                    <button className="btn-otp-confirm" onClick={() => confirmOtp()}>Confirmer</button>
                  </div>
                  {otpError && <div style={{ color: 'var(--danger)', fontSize: '.74rem', marginTop: 8 }}>Code incorrect, réessayez.</div>}
                </div>
              )}
              {phoneVerified && (
                <div className="otp-verified"><i className="bi bi-check-circle-fill"></i> Numéro vérifié avec succès</div>
              )}

              <button className="btn-reg btn-primary-reg" onClick={goStep2} disabled={loading}>
                {loading
                  ? <span style={{ width:18,height:18,border:'2.5px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .75s linear infinite',display:'inline-block' }}></span>
                  : <><i className="bi bi-house-add"></i> Créer la famille</>
                }
              </button>

              <div className="divider-reg">ou</div>
              <p className="login-text">Déjà un compte ? <Link to="/login">Se connecter</Link></p>
            </div>
          )}

          {/* ════ ÉTAPE 2 ════ */}
          {step === 2 && (
            <div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>👨‍👩‍👧 Membres de la famille</div>
              <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: 24 }}>Ajoutez vos proches (enfants, consultants…)</p>

              <div className="members-list">
                {members.length === 0 ? (
                  <div className="empty-state">
                    <i className="bi bi-people" style={{ fontSize: '2.2rem', display: 'block', marginBottom: 8, opacity: .4 }}></i>
                    Aucun membre ajouté pour l'instant
                  </div>
                ) : members.map((m, i) => (
                  <div key={i} className="member-card">
                    <div className="member-avatar">{m.firstName.charAt(0).toUpperCase()}</div>
                    <div className="member-info">
                      <div className="member-name">{m.firstName} {m.lastName}</div>
                      <div className="member-meta">
                        @{m.username}
                        {m.role && <span style={{ marginLeft: 4, padding: '1px 7px', borderRadius: 20, background: 'rgba(55,124,244,.10)', color: 'var(--blue)', fontSize: '.70rem', fontWeight: 600 }}>{m.role}</span>}
                        {m.phone && ` · 📱 ${m.phone}`}
                        {m.verified && <span style={{ color: 'var(--success)', fontSize: '.72rem' }}> · <i className="bi bi-check-circle-fill"></i> Vérifié</span>}
                      </div>
                    </div>
                    <div className="member-actions">
                      <button className="member-btn member-btn-edit" onClick={() => editMember(i)}><i className="bi bi-pencil"></i></button>
                      <button className="member-btn member-btn-del" onClick={() => setMembers(m => m.filter((_, j) => j !== i))}><i className="bi bi-trash3"></i></button>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn-secondary-reg" style={{ width: '100%', marginBottom: 16 }} onClick={toggleAddForm}>
                {showAddForm ? <><i className="bi bi-x-lg"></i> Fermer</> : <><i className="bi bi-person-plus"></i> + Ajouter un membre</>}
              </button>

              {showAddForm && (
                <div className="add-member-form">
                  <div className="add-member-title">
                    <i className="bi bi-person-badge" style={{ background: 'var(--gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}></i>
                    Nouveau membre
                  </div>

                  {/* Rôle */}
                  <div className="field-group">
                    <label className="field-label">Rôle</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {['Gestionnaire', 'Consultant'].map(role => (
                        <button key={role} type="button" onClick={() => setMRole(role)}
                          style={{
                            flex: 1, height: 50,
                            border: mRole === role ? 'none' : '1.5px solid rgba(55,124,244,.20)',
                            borderRadius: 'var(--radius-input)',
                            background: mRole === role ? 'var(--gradient)' : 'rgba(241,245,255,.72)',
                            color: mRole === role ? '#fff' : 'var(--text-muted)',
                            fontFamily: "'Sora', sans-serif", fontSize: '.88rem', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            boxShadow: mRole === role ? 'var(--btn-shadow)' : 'none', transition: 'all .25s',
                          }}>
                          <i className={`bi ${role === 'Gestionnaire' ? 'bi-person-gear' : 'bi-person-lines-fill'}`} style={{ fontSize: '1rem' }}></i>
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field-row">
                    <div className="field-group">
                      <label className="field-label">Prénom</label>
                      <div className="input-wrap">
                        <i className="bi bi-person input-icon"></i>
                        <input type="text" className={`field-input ${mErrors.firstName ? 'is-invalid' : ''}`}
                          placeholder="Entrez le prénom" value={mFirstName}
                          onChange={e => { setMFirstName(e.target.value); setMErrors(er => ({...er, firstName: ''})); }} />
                      </div>
                      {mErrors.firstName && <div className="field-error">{mErrors.firstName}</div>}
                    </div>
                    <div className="field-group">
                      <label className="field-label">Nom</label>
                      <div className="input-wrap">
                        <i className="bi bi-person input-icon"></i>
                        <input type="text" className={`field-input ${mErrors.lastName ? 'is-invalid' : ''}`}
                          placeholder="Entrez le nom" value={mLastName}
                          onChange={e => { setMLastName(e.target.value); setMErrors(er => ({...er, lastName: ''})); }} />
                      </div>
                      {mErrors.lastName && <div className="field-error">{mErrors.lastName}</div>}
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Mot de passe</label>
                    <div className="input-wrap">
                      <i className="bi bi-lock input-icon"></i>
                      <input type={showMPwd ? 'text' : 'password'}
                        className={`field-input ${mErrors.pwd ? 'is-invalid' : ''}`}
                        style={{ paddingRight: 44 }} placeholder="Minimum 6 caractères" value={mPwd}
                        onChange={e => { setMPwd(e.target.value); setMErrors(er => ({...er, pwd: ''})); }} />
                      <button type="button" className="eye-btn" onClick={() => setShowMPwd(!showMPwd)}>
                        <i className={`bi ${showMPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                    <PwdStrength value={mPwd} />
                    {mErrors.pwd && <div className="field-error">{mErrors.pwd}</div>}
                  </div>

                  <div className="field-group">
                    <label className="field-label">Numéro de téléphone</label>
                    <div className="phone-verify-row">
                      <div className={`phone-input-group ${mPhoneVerified ? 'is-valid' : ''}`}>
                        <div className="phone-prefix">🇹🇳 +216</div>
                        <input type="tel" className="phone-number-input" placeholder="XX XXX XXX" maxLength={8}
                          value={mPhone} disabled={mPhoneVerified}
                          onChange={e => setMPhone(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                      </div>
                      {!mPhoneVerified
                        ? (
                          <button className="btn-verify-reg" onClick={sendMOtp} disabled={mOtpSending}>
                            {mOtpSending
                              ? <span style={{ width:14,height:14,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .75s linear infinite',display:'inline-block' }}></span>
                              : <><i className="bi bi-shield-check"></i> Vérifier</>
                            }
                          </button>
                        )
                        : <button className="btn-verify-reg verified" disabled><i className="bi bi-check-lg"></i> Vérifié</button>
                      }
                    </div>
                    {mErrors.phone && <div className="field-error">{mErrors.phone}</div>}
                  </div>

                  {mOtpVisible && !mPhoneVerified && (
                    <div className="otp-section">
                      <div className="otp-label"><i className="bi bi-envelope-check"></i> Code SMS envoyé — Entrez les 4 chiffres</div>
                      <div className="otp-row">
                        <OtpInput otp={mOtpCode} setOtp={setMOtpCode} onConfirm={confirmMOtp} />
                        <button className="btn-otp-confirm" onClick={() => confirmMOtp()}>Confirmer</button>
                      </div>
                      {mOtpError && <div style={{ color: 'var(--danger)', fontSize: '.74rem', marginTop: 8 }}>Code incorrect, réessayez.</div>}
                    </div>
                  )}
                  {mPhoneVerified && (
                    <div className="otp-verified"><i className="bi bi-check-circle-fill"></i> Numéro vérifié</div>
                  )}

                  <div className="form-actions">
                    <button className="btn-secondary-reg" style={{ flex: 1 }} onClick={() => { setShowAddForm(false); resetMemberForm(); }}>
                      <i className="bi bi-x"></i> Annuler
                    </button>
                    <button className="btn-reg btn-primary-reg" style={{ flex: 2, marginTop: 0 }} onClick={saveMember}>
                      <i className="bi bi-check2"></i> {editingIdx >= 0 ? 'Mettre à jour' : 'Ajouter'}
                    </button>
                  </div>
                </div>
              )}

              <button className="btn-reg btn-primary-reg" onClick={finishSetup} disabled={loading}>
                {loading
                  ? <span style={{ width:18,height:18,border:'2.5px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .75s linear infinite',display:'inline-block' }}></span>
                  : <><i className="bi bi-rocket-takeoff"></i> Terminer la configuration</>
                }
              </button>
            </div>
          )}

          {/* ════ SUCCÈS ════ */}
          {step === 'success' && (
            <div className="success-screen">
              <div className="success-icon"><i className="bi bi-check-lg"></i></div>
              <h2 className="success-title">Espace familial créé ! 🎉</h2>
              <p className="success-sub">Votre famille est prête. Bienvenue sur Family Balance.</p>
              <div className="family-badge">
                <i className="bi bi-house-heart-fill"></i>
                <span>{familyName || 'Famille'}</span>
              </div>
              <button className="btn-reg btn-primary-reg" style={{ maxWidth: 260, margin: '0 auto' }} onClick={goToDashboard} disabled={loading}>
                {loading
                  ? <span style={{ width:18,height:18,border:'2.5px solid rgba(255,255,255,.35)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .75s linear infinite',display:'inline-block' }}></span>
                  : <><i className="bi bi-grid-fill"></i> Accéder au tableau de bord</>
                }
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default Register;
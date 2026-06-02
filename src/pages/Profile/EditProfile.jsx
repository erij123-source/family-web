import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'http://localhost:8080';

/* ══ Password strength ══ */
function getPwdStrength(val) {
  let score = 0;
  if (val.length >= 8)          score++;
  if (/[A-Z]/.test(val))        score++;
  if (/[0-9]/.test(val))        score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { w: '0%',   bg: 'transparent', txt: '' },
    { w: '25%',  bg: '#dc3545',     txt: 'Faible' },
    { w: '50%',  bg: '#fd7e14',     txt: 'Moyen'  },
    { w: '75%',  bg: '#ffc107',     txt: 'Bon'    },
    { w: '100%', bg: '#198754',     txt: 'Excellent' },
  ];
  return { score, ...levels[score] };
}

// Formate un numéro tunisien 8 chiffres → "XX XXX XXX"
function formatPhone(digits) {
  if (!digits || digits.length !== 8) return digits;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
}

function EditProfile() {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const fileInputRef = useRef(null);

  /* ── IDs backend ── */
  const [userId,        setUserId]        = useState(null);
  const [familleId,     setFamilleId]     = useState(null);
  const [isAdmin,       setIsAdmin]       = useState(false);

  /* ── FIX : stocker l'objet famille complet pour le PUT ── */
  const [familleData,   setFamilleData]   = useState(null);

  /* ── Champs formulaire — initialisés depuis localStorage → zéro flash ── */
  const _u = sessionStorage.getItem('username') || '';
  const [familyName,    setFamilyName]    = useState(() => localStorage.getItem('profile__familleNom__' + _u) || '');
  const [nom,           setNom]           = useState(() => localStorage.getItem('profile__nom__'        + _u) || '');
  const [prenom,        setPrenom]        = useState(() => localStorage.getItem('profile__prenom__'     + _u) || '');
  const [username,      setUsername]      = useState(() => _u);
  const [phone,         setPhone]         = useState(() => {
    const raw = localStorage.getItem('profile__phone__' + _u) || '';
    return raw.replace(/^\+216\s*/, '').replace(/\s/g, '');
  });
  const [originalPhone, setOriginalPhone] = useState(() => {
    const raw = localStorage.getItem('profile__phone__' + _u) || '';
    return raw.replace(/^\+216\s*/, '').replace(/\s/g, '');
  });
  // Photo de profil chargée depuis le backend
  const [avatarSrc,     setAvatarSrc]     = useState('');

  /* ── FIX : valeurs initiales pour détecter les changements ── */
  const [initValues,    setInitValues]    = useState(null);

  /* ── photo modifiée : on garde le vrai File pour l'upload multipart ── */
  const [newAvatarFile, setNewAvatarFile] = useState(null); // File object réel
  const [avatarPreview, setAvatarPreview] = useState('');   // URL locale pour preview

  /* ── OTP ── */
  const [otpSent,      setOtpSent]      = useState(false);
  const [otpCode,      setOtpCode]      = useState('');
  const [otpInput,     setOtpInput]     = useState('');
  const [otpVerified,  setOtpVerified]  = useState(false);
  const [otpHint,      setOtpHint]      = useState('');
  const [otpHintColor, setOtpHintColor] = useState('#6c757d');

  /* ── UI ── */
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [toast,        setToast]        = useState('');
  const [modified,     setModified]     = useState({});

  /* ── Toast ── */
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  /* ── Marquer champ modifié ── */
  const mark = (field) => setModified(m => ({ ...m, [field]: true }));

  /* ── FIX : détecter si quelque chose a vraiment changé ── */
  const hasChanges = () => {
    if (!initValues) return false;
    if (newAvatarFile) return true;
    return (
      familyName !== initValues.familyName ||
      nom        !== initValues.nom        ||
      prenom     !== initValues.prenom     ||
      username   !== initValues.username   ||
      phone      !== initValues.phone
    );
  };

  /* ── Charger données depuis backend ── */
  useEffect(() => {
    async function fetchData() {
      try {
        const storedUsername = sessionStorage.getItem('username');
        if (!storedUsername) return;

        // Étape 1 : trouver l'id depuis la liste
        const usersRes = await fetch(`${API}/users`);
        const users = await usersRes.json();
        const userBasic = users.find(u => u.username === storedUsername);
        if (!userBasic?.id) return;

        // Étape 2 : recharger l'utilisateur complet via GET /users/{id}
        // → garantit que le champ "photo" est bien présent (pas de lazy loading JPA)
        const userFullRes = await fetch(`${API}/users/${userBasic.id}`);
        const currentUser = userFullRes.ok ? await userFullRes.json() : userBasic;

        setUserId(currentUser.id);

        const nomVal      = currentUser.lastName  ?? currentUser.nom    ?? '';
        const prenomVal   = currentUser.firstName ?? currentUser.prenom ?? '';
        const usernameVal = currentUser.username  ?? '';
        const rawPhone    = currentUser.phone     ?? '';
        const cleanPhone  = rawPhone.replace(/^\+216\s*/, '');

        setNom(nomVal);
        setPrenom(prenomVal);
        setUsername(usernameVal);
        setPhone(cleanPhone);
        setOriginalPhone(cleanPhone);

        // Charger la photo : backend en priorité, sinon sessionStorage
        const photoFromBackend = currentUser.photo ?? null;
        const photoFromSession = sessionStorage.getItem('photo__' + storedUsername) ?? null;
        const photoToUse = photoFromBackend || photoFromSession || '';
        if (photoToUse) setAvatarSrc(photoToUse);

        // Vérifier si admin → récupérer famille complète
        let familyNameVal = '';
        const adminRes = await fetch(`${API}/admins/user/${currentUser.id}`);
        if (adminRes.ok) {
          const admin = await adminRes.json();
          setIsAdmin(true);
          const fid = admin.famille?.id ?? null;
          setFamilleId(fid);
          familyNameVal = admin.famille?.name ?? '';
          setFamilyName(familyNameVal);

          /* ── FIX : charger l'objet famille COMPLET ── */
          if (fid) {
            try {
              const famFullRes = await fetch(`${API}/familles/${fid}`);
              if (famFullRes.ok) {
                const famFull = await famFullRes.json();
                setFamilleData(famFull);
              }
            } catch (e) {
              console.warn('Impossible de charger la famille complète:', e);
            }
          }
        }

        /* ── FIX : mémoriser les valeurs initiales ── */
        setInitValues({
          familyName: familyNameVal,
          nom:        nomVal,
          prenom:     prenomVal,
          username:   usernameVal,
          phone:      cleanPhone,
        });

      } catch (err) {
        console.error('Erreur chargement profil:', err);
      }
    }
    fetchData();
  }, []);

  /* ── Preview avatar + stockage du vrai File pour upload multipart ── */
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('⚠️ Image trop lourde — max 5 Mo'); return; }

    // Lire en base64 pour un preview fiable (pas de problème de blob URL)
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarSrc(ev.target.result); // base64 → preview immédiat et fiable
    };
    reader.readAsDataURL(file);
    // On garde le vrai File object pour l'upload multipart vers /users/upload-photo/{id}
    setNewAvatarFile(file);
  };

  /* ── OTP ── */
  const sendOtp = async () => {
    if (!phone || phone.length !== 8) { showToast('⚠️ 8 chiffres requis'); return; }
    try {
      const res = await fetch(`${API}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+216${phone}` }),
      });
      if (!res.ok) throw new Error('Erreur envoi OTP');
      setOtpSent(true);
      setOtpVerified(false);
      setOtpInput('');
      setOtpHintColor('#6c757d');
      setOtpHint(`Code envoyé au +216 ${formatPhone(phone)}. Valable 5 min.`);
      showToast(`Code OTP envoyé au +216 ${formatPhone(phone)}`);
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    }
  };

  const verifyOtp = async () => {
    if (!otpInput) { showToast('⚠️ Saisissez le code OTP'); return; }
    try {
      const res = await fetch(`${API}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+216${phone}`, code: otpInput }),
      });
      if (res.ok) {
        setOtpVerified(true);
        setOtpHintColor('#198754');
        setOtpHint('✓ Numéro vérifié avec succès');
        showToast('✓ Numéro vérifié');
      } else {
        setOtpHintColor('#dc3545');
        setOtpHint('✗ Code incorrect. Réessayez.');
        setOtpInput('');
      }
    } catch (err) {
      showToast(`⚠️ ${err.message}`);
    }
  };

  const resetOtp = () => {
    setOtpSent(false); setOtpVerified(false);
    setOtpCode(''); setOtpInput(''); setOtpHint('');
  };

  /* ── Téléphone modifié ? ── */
  const phoneChanged = phone !== originalPhone;

  /* ── Validation ── */
  const validate = () => {
    if (!username.trim())                      { showToast("⚠️ Le nom d'utilisateur est requis"); return false; }
    if (phone && phone.length !== 8)           { showToast('⚠️ Le numéro doit contenir 8 chiffres'); return false; }
    if (phoneChanged && phone && !otpVerified) { showToast('⚠️ Veuillez vérifier le nouveau numéro par OTP'); return false; }
    return true;
  };

  /* ── Sauvegarder ── */
  const saveProfile = async () => {
    if (!validate()) return;
    if (!userId) { showToast('⚠️ Utilisateur introuvable'); return; }
    setSaving(true);
    try {
      // 1. Mettre à jour l'utilisateur (sans la photo)
      const userRes = await fetch(`${API}/users/edit-profile/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: prenom,
          lastName:  nom,
          username:  username,
          phone:     phone ? `+216${phone}` : '',
        }),
      });
      if (!userRes.ok) {
        let errMsg = 'Erreur mise à jour utilisateur';
        try { const body = await userRes.json(); errMsg = body.message ?? body.error ?? errMsg; } catch {}
        throw new Error(errMsg);
      }

      // 1b. Upload photo si modifiée → multipart vers /users/upload-photo/{id}
      if (newAvatarFile && userId) {
        const formData = new FormData();
        formData.append('file', newAvatarFile);
        const photoRes = await fetch(`${API}/users/upload-photo/${userId}`, {
          method: 'POST',
          body: formData,
        });
        if (photoRes.ok) {
          const updatedUser = await photoRes.json();
          const photoUrl = updatedUser.photo ?? '';
          if (photoUrl) {
            setAvatarSrc(photoUrl);
            // Stocker dans sessionStorage → Profile et Dashboard liront la photo à jour
            const uname = sessionStorage.getItem('username') || '';
            if (uname) sessionStorage.setItem('photo__' + uname, photoUrl);
            // Déclencher refresh Dashboard si ouvert
            window.dispatchEvent(new Event('dashboard-refresh'));
          }
        } else {
          showToast('⚠️ Photo non sauvegardée, réessayez');
        }
      }

      // Sauvegarder infos texte dans sessionStorage
      const uname = sessionStorage.getItem('username') || '';
      if (uname) {
        sessionStorage.setItem('profile__nom__'    + uname, nom);
        sessionStorage.setItem('profile__prenom__' + uname, prenom);
        sessionStorage.setItem('profile__phone__'  + uname, phone ? `+216${phone}` : '');
        if (isAdmin && familyName) sessionStorage.setItem('profile__familleNom__' + uname, familyName);
      }

      // 2. Si admin, mettre à jour le nom de la famille
      if (isAdmin && familleId && familyName.trim()) {
        const famPayload = familleData
          ? { ...familleData, name: familyName }
          : { name: familyName };

        const famRes = await fetch(`${API}/familles/${familleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(famPayload),
        });
        if (!famRes.ok) {
          let errMsg = 'Erreur mise à jour famille';
          try { const body = await famRes.json(); errMsg = body.message ?? body.error ?? errMsg; } catch {}
          throw new Error(errMsg);
        }
      }

      setSaving(false);
      setSaved(true);
      showToast('✓ Profil mis à jour avec succès');
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err) {
      setSaving(false);
      showToast(`⚠️ ${err.message}`);
    }
  };

  /* ── FIX : bouton actif seulement si des changements existent ── */
  const canSave = hasChanges() && !saving;

  return (
    <Layout>
      <style>{`
        :root{--purple:#377CF4;--purple-lt:rgba(55,124,244,0.1);--green-lt:rgba(25,135,84,0.1);--border:#e9ecef}

        .edit-banner{background:linear-gradient(135deg,#1a1f3a 0%,#2d3561 55%,#377CF4 100%);border-radius:16px;padding:24px 16px;position:relative;overflow:hidden;text-align:center;margin-bottom:14px}
        .edit-banner::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:rgba(55,124,244,.18);border-radius:50%;pointer-events:none}
        .edit-banner::after{content:'';position:absolute;bottom:-50px;left:20px;width:120px;height:120px;background:rgba(255,255,255,.04);border-radius:50%;pointer-events:none}

        .ava-upload{position:relative;display:inline-block;cursor:pointer;margin-bottom:12px}
        .ava-upload:hover .ava-overlay{opacity:1}
        .ava-img{width:84px;height:84px;border-radius:16px;object-fit:cover;border:3px solid rgba(255,255,255,.3);display:block}
        .ava-fb{width:84px;height:84px;border-radius:16px;background:linear-gradient(135deg,#377CF4,#2E3F8F);display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff;font-weight:700;border:3px solid rgba(255,255,255,.3)}
        .ava-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:600;gap:4px;opacity:0;transition:opacity .22s}
        .ava-overlay i{font-size:1.3rem}
        .ava-changed-badge{position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:#198754;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center}
        .ava-changed-badge i{font-size:9px;color:#fff}

        .banner-name{font-size:16px;font-weight:700;color:#fff;margin-bottom:6px}
        .banner-role{display:inline-flex;align-items:center;gap:5px;background:rgba(55,124,244,.3);color:#c084fc;border:1px solid rgba(55,124,244,.5);border-radius:20px;padding:3px 14px;font-size:11px;font-weight:700}

        .ep-card{background:#fff;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
        .sec-head{display:flex;align-items:center;gap:10px;margin-bottom:16px}
        .sh-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
        .sh-title{font-size:14px;font-weight:700;margin:0}

        .ep-label{font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;display:block;margin-bottom:6px;letter-spacing:.03em}
        .ep-required{color:#dc3545;margin-left:2px}
        .ep-field-wrap{position:relative;margin-bottom:4px}
        .ep-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);font-size:14px;color:#9ca3af;pointer-events:none;transition:color .2s}
        .ep-input{width:100%;height:48px;padding:0 14px 0 40px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s,background .2s;box-sizing:border-box;background:#f9fafb}
        .ep-input:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(55,124,244,.10);background:#fff}
        .ep-input:focus+.ep-icon,.ep-input:focus~.ep-icon{color:var(--purple)}
        .ep-input.modified{border-color:var(--purple)!important;background:rgba(55,124,244,.03)!important}
        .ep-char{font-size:10px;color:#9ca3af;text-align:right;margin-top:2px}

        .phone-group{display:flex;border:1.5px solid var(--border);border-radius:12px;overflow:hidden;background:#f9fafb;transition:border-color .2s,box-shadow .2s}
        .phone-group:focus-within{border-color:var(--purple);box-shadow:0 0 0 3px rgba(55,124,244,.10);background:#fff}
        .phone-prefix{display:flex;align-items:center;gap:5px;padding:0 12px;background:var(--purple-lt);border-right:1.5px solid var(--border);font-size:13px;font-weight:700;color:var(--purple);white-space:nowrap;flex-shrink:0}
        .phone-number{flex:1;height:48px;padding:0 12px;border:none;outline:none;background:transparent;font-size:14px}
        .btn-otp-send{height:48px;padding:0 14px;background:linear-gradient(135deg,var(--purple),#2E3F8F);color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:opacity .2s}
        .btn-otp-send:hover{opacity:.9}

        .otp-section{background:var(--green-lt);border:1.5px solid rgba(25,135,84,.2);border-radius:12px;padding:12px;margin-top:8px}
        .otp-row{display:flex;gap:8px;align-items:center}
        .otp-inp{flex:1;height:44px;padding:0 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;outline:none;transition:border-color .2s}
        .otp-inp:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(55,124,244,.10)}
        .btn-otp-verify{height:44px;padding:0 14px;background:#198754;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0}

        .btn-cancel{display:flex;align-items:center;gap:6px;padding:12px 20px;border:1.5px solid #dee2e6;border-radius:12px;background:transparent;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;color:#374151;justify-content:center;transition:background .2s}
        .btn-cancel:hover{background:#f3f4f6}

        .btn-save{display:flex;align-items:center;gap:6px;padding:12px 28px;background:linear-gradient(135deg,#377CF4,#2E3F8F);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(55,124,244,.35);transition:opacity .2s,transform .2s;justify-content:center}
        .btn-save:hover:not(:disabled){opacity:.92;transform:translateY(-1px)}
        .btn-save:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none;background:#adb5bd}
        .btn-save.saved{background:linear-gradient(135deg,#198754,#20c374);box-shadow:0 4px 14px rgba(25,135,84,.35)}

        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}

        .fb-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a1f3a,#377CF4);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:500;z-index:9999;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:fadeUp .3s ease both}
        @keyframes fadeUp{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

        .adminuiux-content.has-sidebar{padding-top:56px!important}
        .navbar.fixed-top{z-index:1050!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;background-color:inherit!important}
      `}</style>

      <div style={{ padding: '14px 14px 100px' }}>

        {/* Breadcrumb */}
        <nav style={{ fontSize: 11, marginBottom: 12 }}>
          <Link to="/" style={{ color: '#377CF4', textDecoration: 'none' }}>Accueil</Link>
          <span style={{ color: '#6c757d' }}> / </span>
          <Link to="/profil" style={{ color: '#377CF4', textDecoration: 'none' }}>Profil</Link>
          <span style={{ color: '#6c757d' }}> / Modifier</span>
        </nav>

        {/* ══ BANNER ══ */}
        <div className="edit-banner">
          <div className="ava-upload" onClick={() => fileInputRef.current?.click()}>
            <img
              className="ava-img"
              src={avatarSrc}
              alt="avatar"
              style={{ display: avatarSrc ? 'block' : 'none' }}
              onError={e => { e.target.style.display = 'none'; setAvatarSrc(''); }}
            />
            <div className="ava-fb" style={{ display: avatarSrc ? 'none' : 'flex' }}>
              {prenom?.[0]?.toUpperCase() || familyName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="ava-overlay">
              <i className="bi bi-camera-fill"></i>
              <span>Changer</span>
            </div>
            {/* Badge vert si photo changée */}
            {newAvatarFile && (
              <div className="ava-changed-badge">
                <i className="bi bi-check"></i>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }} onChange={handleAvatarChange} />

          {newAvatarFile && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginBottom: 6 }}>
              <i className="bi bi-check-circle-fill" style={{ color: '#4ade80' }}></i> Nouvelle photo sélectionnée
            </div>
          )}

          <div className="banner-name">{prenom || nom ? `${prenom} ${nom}`.trim() : 'Prénom Nom'}</div>
          <div className="banner-role">
            <i className="bi bi-shield-fill-check"></i> Administrateur
          </div>
        </div>

        {/* ══ INFORMATIONS PERSONNELLES ══ */}
        <div className="ep-card">
          <div className="sec-head">
            <div className="sh-icon" style={{ background: 'var(--purple-lt)', color: 'var(--purple)' }}>
              <i className="bi bi-person-fill"></i>
            </div>
            <div>
              <p className="sh-title">Informations personnelles</p>
            </div>
          </div>

          {isAdmin && (
          <div style={{ marginBottom: 14 }}>
            <label className="ep-label">
              Nom de famille <span className="ep-required">*</span>
            </label>
            <div className="ep-field-wrap">
              <input className={`ep-input ${modified.familyName ? 'modified' : ''}`}
                type="text" maxLength={50}
                value={familyName}
                onChange={e => { setFamilyName(e.target.value); mark('familyName'); }} />
              <i className="bi bi-people-fill ep-icon"></i>
            </div>
            <div className="ep-char">{familyName.length} / 50</div>
          </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="ep-label">Nom</label>
              <div className="ep-field-wrap">
                <input className={`ep-input ${modified.nom ? 'modified' : ''}`}
                  type="text" maxLength={50} placeholder="Votre nom"
                  value={nom}
                  onChange={e => { setNom(e.target.value); mark('nom'); }} />
                <i className="bi bi-person ep-icon"></i>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label className="ep-label">Prénom</label>
              <div className="ep-field-wrap">
                <input className={`ep-input ${modified.prenom ? 'modified' : ''}`}
                  type="text" maxLength={50} placeholder="Votre prénom"
                  value={prenom}
                  onChange={e => { setPrenom(e.target.value); mark('prenom'); }} />
                <i className="bi bi-person ep-icon"></i>
              </div>
            </div>
          </div>

          {/* Champ "Nom d'utilisateur" retiré — aligné sur le web Angular :
              l'identifiant est dérivé automatiquement de "prenom nom" et
              n'est plus modifiable depuis le mobile. La valeur reste
              chargée depuis le backend et renvoyée intacte au PUT. */}

          <div style={{ marginBottom: 6 }}>
            <label className="ep-label">Téléphone</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className={`phone-group ${otpVerified ? 'modified' : ''}`} style={{ flex: 1 }}>
                <div className="phone-prefix">
                  <i className="bi bi-telephone-fill"></i> +216
                </div>
                <input className="phone-number" type="tel" placeholder="XX XXX XXX"
                  maxLength={10} value={formatPhone(phone)}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setPhone(raw);
                    mark('phone'); resetOtp();
                  }} />
              </div>
              {phoneChanged && (
                <button className="btn-otp-send" onClick={sendOtp}>
                  <i className={`bi ${otpSent ? 'bi-arrow-clockwise' : 'bi-send'} me-1`}></i>
                  {otpSent ? 'Renvoyer' : 'OTP'}
                </button>
              )}
            </div>

            {phoneChanged && otpSent && !otpVerified && (
              <div className="otp-section">
                <div className="otp-row">
                  <input className="otp-inp" type="text" placeholder="Code à 6 chiffres"
                    maxLength={6} value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))} />
                  <button className="btn-otp-verify" onClick={verifyOtp}>
                    <i className="bi bi-check2-circle me-1"></i>Vérifier
                  </button>
                </div>
                {otpHint && <div style={{ fontSize: 11, color: otpHintColor, marginTop: 6 }}>{otpHint}</div>}
              </div>
            )}
            {phoneChanged && otpVerified && (
              <div style={{ fontSize: 12, color: '#198754', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="bi bi-check-circle-fill"></i> Numéro vérifié avec succès
              </div>
            )}
          </div>
        </div>

        {/* ══ BOUTONS ACTION ══ */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <button
            className="btn-cancel"
            style={{ flex: 'none', background: '#fff' }}
            onClick={() => navigate('/profile')}
          >
            <i className="bi bi-x-circle"></i> Annuler
          </button>

          <button
            className={`btn-save ${saved ? 'saved' : ''}`}
            style={{ flex: 1 }}
            onClick={saveProfile}
            disabled={!canSave}
            title={!hasChanges() ? 'Aucune modification détectée' : ''}
          >
            {saving
              ? <><span className="spinner"></span> Enregistrement…</>
              : saved
                ? <><i className="bi bi-check2-circle"></i> Modifié !</>
                : <><i className="bi bi-pencil-square"></i> Enregistrer</>
            }
          </button>
        </div>

        {/* Message d'aide si rien n'est modifié */}
        {!hasChanges() && initValues && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
            <i className="bi bi-info-circle me-1"></i>
            Modifiez au moins un champ pour pouvoir enregistrer
          </p>
        )}

      </div>

      {toast && <div className="fb-toast">{toast}</div>}
    </Layout>
  );
}

export default EditProfile;
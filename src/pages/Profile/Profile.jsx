import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API = 'http://localhost:8080';

const FORM_INIT = { nom: '', prenom: '', username: '', password: '', phone: '', role: 'gestionnaire' };

function formatDT(val) { return val.toLocaleString('fr-FR') + ' DT'; }

// Formate un numéro tunisien : "+21621754123" → "+216 21 754 123"
function formatPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, ''); // garder uniquement les chiffres
  if (digits.startsWith('216') && digits.length === 11) {
    // +216 XX XXX XXX
    return `+216 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }
  if (digits.length === 8) {
    // XX XXX XXX (sans indicatif)
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
  }
  return phone; // fallback : afficher tel quel
}

// Normalise n'importe quelle valeur brute du backend vers 'admin' | 'gestionnaire' | 'consultant'
function normalizeRole(raw) {
  if (!raw) return 'consultant';
  const s = raw.toString().toLowerCase()
    .replace('role_', '')   // ROLE_GESTIONNAIRE → gestionnaire
    .replace('_', '')       // sous_admin → souadmin
    .trim();
  if (s === 'admin' || s === 'administrateur' || s === 'administrator') return 'admin';
  if (s === 'gestionnaire' || s === 'manager' || s === 'gestion') return 'gestionnaire';
  return 'consultant';
}

function RoleBadge({ role }) {
  const normalized = normalizeRole(role);
  const map = {
    admin:        { cls: 'role-admin',        icon: 'bi-shield-fill-check', label: 'Administrateur' },
    gestionnaire: { cls: 'role-gestionnaire', icon: 'bi-person-gear',       label: 'Gestionnaire' },
    consultant:   { cls: 'role-consultant',   icon: 'bi-eye',               label: 'Consultant' },
  };
  const r = map[normalized] ?? map.consultant;
  return <span className={`role-badge ${r.cls}`}><i className={`bi ${r.icon}`}></i> {r.label}</span>;
}

function PresenceDot({ color }) {
  const bg = color === 'success' ? '#198754' : color === 'warning' ? '#ffc107' : '#6c757d';
  return <span style={{ width:10, height:10, borderRadius:'50%', border:'2px solid #fff', position:'absolute', bottom:0, right:0, background:bg, display:'block' }} />;
}

function Profile() {
  const { user } = useAuth();
  // Lecture synchrone depuis localStorage → zéro flash au chargement
  const _u = () => sessionStorage.getItem('username') || '';
  const [membres,     setMembres]     = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(FORM_INIT);
  const [formErrors,  setFormErrors]  = useState({});

  /* Auto-génération du username depuis prenom + nom — aligné sur le web
     Angular. Le champ "Nom d'utilisateur" a été retiré du formulaire :
     l'identifiant est dérivé automatiquement et envoyé au backend tel quel. */
  useEffect(() => {
    const f = (form.prenom || '').trim().toLowerCase().replace(/\s+/g, '');
    const l = (form.nom    || '').trim().toLowerCase().replace(/\s+/g, '');
    const autoUsername = f && l ? `${f} ${l}` : f + l;
    if (form.username !== autoUsername) {
      setForm(prev => ({ ...prev, username: autoUsername }));
    }
  }, [form.prenom, form.nom]); // eslint-disable-line react-hooks/exhaustive-deps
  const [toast,       setToast]       = useState('');
  const [modalBudget, setModalBudget] = useState(null);
  const [budgetVal,   setBudgetVal]   = useState('');
  const [modalDel,    setModalDel]    = useState(null);
  // ── Modal d'édition d'un membre (admin uniquement) ──
  // editMember = membre cible | null. editForm contient les champs édités.
  const [editMember, setEditMember] = useState(null);
  const [editForm,   setEditForm]   = useState({ firstName: '', lastName: '', phone: '', role: 'consultant', img: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [otpSent,     setOtpSent]     = useState(false);
  const [otpCode,     setOtpCode]     = useState('');
  const [otpInput,    setOtpInput]    = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [statsOpen,   setStatsOpen]   = useState(false);
  const [familleNom,  setFamilleNom]  = useState(() => localStorage.getItem('profile__familleNom__' + _u()) || '');
  const [userNom,     setUserNom]     = useState(() => localStorage.getItem('profile__nom__'        + _u()) || '');
  const [userPrenom,  setUserPrenom]  = useState(() => localStorage.getItem('profile__prenom__'     + _u()) || '');
  const [userPhone,   setUserPhone]   = useState(() => localStorage.getItem('profile__phone__'      + _u()) || '');
  const [isAdmin,     setIsAdmin]     = useState(false);
  const [compteId,    setCompteId]    = useState(null);
  const [budgetGlobal,setBudgetGlobal]= useState(0);
  const [familleId,   setFamilleId]   = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [userAvatar,  setUserAvatar]  = useState('');

  // Restore stats menu state from sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem('statsMenuOpen') === 'true') setStatsOpen(true);
  }, []);

  // ── Fetch données depuis backend ──
  useEffect(() => {
    async function fetchData() {
      try {
        const username = sessionStorage.getItem('username');
        if (!username) return;

        // 1. Trouver user
        const usersRes = await fetch(`${API}/users`);
        const users = await usersRes.json();
        const currentUser = users.find(u => u.username === username);
        console.log('[Profile] currentUser:', currentUser);
        if (!currentUser?.id) return;

        const nom    = currentUser.lastName  ?? currentUser.nom    ?? '';
        const prenom = currentUser.firstName ?? currentUser.prenom ?? '';
        const phone  = currentUser.phone ?? '';
        setUserNom(nom);
        setUserPrenom(prenom);
        setUserPhone(phone);
        // Cache localStorage pour zéro flash au prochain chargement
        localStorage.setItem('profile__nom__'    + username, nom);
        localStorage.setItem('profile__prenom__' + username, prenom);
        localStorage.setItem('profile__phone__'  + username, phone);

        // Avatar : toujours depuis GET /users/{id} pour avoir la photo la plus récente
        const userFullRes2 = await fetch(`${API}/users/${currentUser.id}`);
        if (userFullRes2.ok) {
          const userFull = await userFullRes2.json();
          const photo = userFull.photo ?? '';
          if (photo) {
            setUserAvatar(photo);
            sessionStorage.setItem('photo__' + username, photo);
          } else {
            // Fallback sessionStorage si backend pas encore à jour
            const cached = sessionStorage.getItem('photo__' + username) || '';
            if (cached) setUserAvatar(cached);
          }
        }

        // 2. Chercher si c'est un admin
        let famille = null;
        let adminDetected = false; // variable locale pour éviter le problème de state async
        const adminRes = await fetch(`${API}/admins/user/${currentUser.id}`);
        console.log('[Profile] adminRes status:', adminRes.status);

        if (adminRes.ok) {
          const admin = await adminRes.json();
          console.log('[Profile] admin:', admin);
          adminDetected = true;
          setIsAdmin(true);
          famille = admin.famille;
        } else {
          // Pas admin → essayer tous les endpoints possibles
          const endpoints = [
            `${API}/familles/membre-user/${currentUser.id}`,
            `${API}/membres/user/${currentUser.id}`,
            `${API}/familles/by-user/${currentUser.id}`,
            `${API}/familles/user/${currentUser.id}`,
          ];
          for (const url of endpoints) {
            const res = await fetch(url);
            console.log(`[Profile] essai ${url} → ${res.status}`);
            if (res.ok) {
              const data = await res.json();
              console.log(`[Profile] résultat ${url}:`, data);
              famille = data.famille ?? data;
              break;
            }
          }
        }

        console.log('[Profile] famille trouvée:', famille);
        if (!famille?.id) return;

        setFamilleId(famille.id);
        const famNom = famille.name ?? '';
        setFamilleNom(famNom);
        localStorage.setItem('profile__familleNom__' + username, famNom);

        // 3. Compte de la famille
        const compteRes = await fetch(`${API}/comptes/famille/${famille.id}`);
        if (compteRes.ok) {
          const compte = await compteRes.json();
          setCompteId(compte.id);
          setBudgetGlobal(compte.budget ?? 0);
        }

        // 4. Membres de la famille
        const memRes = await fetch(`${API}/familles/membres/${famille.id}`);
        if (memRes.ok) {
          const memData = await memRes.json();
          console.log('Membres raw:', JSON.stringify(memData, null, 2)); // debug

          // Enrichir chaque membre : toujours GET /users/{id} = source de vérité
          const enrichedMembers = await Promise.all((memData ?? []).map(async (m) => {
            const u = m.user ?? m;
            const uId = u.id ?? m.userId ?? null;
            const uUsername = u.username ?? '';
            let photo = '';

            if (uId) {
              try {
                const userRes = await fetch(`${API}/users/${uId}`);
                if (userRes.ok) {
                  const userData = await userRes.json();
                  photo = userData.photo ?? '';
                  // Cache court terme en sessionStorage (pas localStorage)
                  if (photo && uUsername) sessionStorage.setItem('photo__' + uUsername, photo);
                }
              } catch (_) {}
            }
            // Fallback sessionStorage si fetch échoue
            if (!photo && uUsername) photo = sessionStorage.getItem('photo__' + uUsername) || '';

            return { ...m, _resolvedPhoto: photo };
          }));

          const mapMembre = (m, forceRole) => {
            const u = m.user ?? m;
            const prenom   = u.firstName ?? u.prenom ?? '';
            const nom      = u.lastName  ?? u.nom    ?? '';
            const fullName = `${prenom} ${nom}`.trim() || u.username || `Membre ${m.id}`;
            const rawRole = forceRole
              ?? m.role
              ?? m.roleInFamily
              ?? m.type
              ?? u.role
              ?? u.roleInFamily
              ?? '';
            const estVous = (u.username ?? '') === username;
            // Photo : _resolvedPhoto depuis GET /users/{id} est la source fiable
            const img = m._resolvedPhoto || u.photo || '';
            return {
              id:       m.id,
              userId:   u.id ?? m.userId ?? null,
              nom:      fullName,
              // Champs bruts conservés pour le modal d'édition admin
              firstName: prenom,
              lastName:  nom,
              phoneRaw:  u.phone ?? '',
              username:  u.username ?? '',
              role:     normalizeRole(rawRole),
              budget:   m.budget ?? m.budgetAlloue ?? 0,
              presence: 'success',
              img,
              estVous,
            };
          };

          const mapped = (enrichedMembers ?? []).map(m => mapMembre(m, null));

          // Si le user connecté n'est pas dans la liste, on l'ajoute manuellement
          const adminDejaPresent = mapped.some(m => m.estVous);
          if (!adminDejaPresent) {
            mapped.unshift({
              id:       currentUser.id ?? 'user-0',
              nom:      `${currentUser.firstName ?? currentUser.prenom ?? ''} ${currentUser.lastName ?? currentUser.nom ?? ''}`.trim() || username,
              role:     adminDetected ? 'admin' : normalizeRole(currentUser.role ?? currentUser.roleInFamily ?? ''),
              budget:   0,
              presence: 'success',
              img:      sessionStorage.getItem('photo__' + username) || currentUser.photo || '',
              estVous:  true,
            });
          }

          // Tri : vous en premier, puis admin, gestionnaire, consultant, puis alphabétique
          const roleOrder = { admin: 0, gestionnaire: 1, consultant: 2 };
          mapped.sort((a, b) => {
            if (a.estVous) return -1;
            if (b.estVous) return  1;
            const rDiff = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
            if (rDiff !== 0) return rDiff;
            return a.nom.localeCompare(b.nom, 'fr');
          });

          setMembres(mapped);
        }
      } catch (err) {
        console.error('Erreur profil:', err);
      } finally {
        setLoadingData(false);
      }
    }
    fetchData();
  }, []);

  function toggleStats(e) {
    e.preventDefault();
    const next = !statsOpen;
    setStatsOpen(next);
    sessionStorage.setItem('statsMenuOpen', String(next));
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800); };
  const totalDistribue = membres.reduce((s, m) => s + m.budget, 0);
  const restant = Math.max(0, budgetGlobal - totalDistribue);

  const confirmDelete = async () => {
    try {
      const res = await fetch(`${API}/admins/remove-member/${modalDel.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Erreur suppression - status:', res.status, 'détail:', errText);
        throw new Error(errText);
      }
      setMembres(m => m.filter(x => x.id !== modalDel.id));
      showToast(`${modalDel.nom} retiré de la famille`);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      showToast('Erreur lors de la suppression');
    }
    setModalDel(null);
  };

  // ── Édition d'un membre (admin only) ──────────────────────────────────
  // Pré-remplit le formulaire avec les valeurs brutes du membre, ouvre le
  // popup. Les modifications sont envoyées via PUT /users/edit-profile/{id}
  // (nom/prenom/phone/photo) + PUT /membres/change-role/{id}?role=X (rôle).
  const openEditMember = (m) => {
    if (!isAdmin || m.estVous) return; // garde-fou : admin seulement, pas soi-même
    const phoneLocal = (m.phoneRaw || '').replace(/\D/g, '').replace(/^216/, '').slice(0, 8);
    const roleNorm = m.role === 'admin' ? 'administrateur' : m.role;
    setEditForm({
      firstName: m.firstName || '',
      lastName:  m.lastName  || '',
      phone:     phoneLocal,
      role:      roleNorm,
      img:       m.img || '',
    });
    setEditMember(m);
  };

  const handleEditPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Image trop lourde (max 2 MB).'); return; }
    const reader = new FileReader();
    reader.onload = ev => setEditForm(f => ({ ...f, img: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const saveEditMember = async () => {
    if (!editMember || !isAdmin) return;
    const phoneClean = (editForm.phone || '').replace(/\D/g, '');
    if (phoneClean && phoneClean.length !== 8) { showToast('Téléphone invalide (8 chiffres).'); return; }
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) { showToast('Prénom et nom obligatoires.'); return; }
    setEditSaving(true);
    try {
      // 1) Mise à jour du User (nom/prenom/phone/photo + username auto)
      if (editMember.userId) {
        const autoUsername = `${editForm.firstName.trim().toLowerCase().replace(/\s+/g,'')} ${editForm.lastName.trim().toLowerCase().replace(/\s+/g,'')}`.trim();
        const payload = {
          firstName: editForm.firstName.trim(),
          lastName:  editForm.lastName.trim(),
          username:  autoUsername || editMember.username,
          phone:     phoneClean ? `+216${phoneClean}` : '',
          photo:     editForm.img || '',
        };
        const r = await fetch(`${API}/users/edit-profile/${editMember.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(await r.text() || 'edit-profile failed');
      }
      // 2) Mise à jour du rôle (si modifié)
      const backendRole = editForm.role === 'administrateur' ? 'ADMINISTRATEUR'
                        : editForm.role === 'gestionnaire'   ? 'GESTIONNAIRE'
                        : 'CONSULTANT';
      const originalBackendRole = editMember.role === 'admin' ? 'ADMINISTRATEUR'
                                : editMember.role === 'gestionnaire' ? 'GESTIONNAIRE'
                                : 'CONSULTANT';
      if (backendRole !== originalBackendRole) {
        await fetch(`${API}/membres/change-role/${editMember.id}?role=${backendRole}`, { method: 'PUT' });
      }
      // 3) MAJ locale immédiate (avant re-fetch éventuel)
      setMembres(prev => prev.map(x => x.id === editMember.id ? {
        ...x,
        firstName: editForm.firstName.trim(),
        lastName:  editForm.lastName.trim(),
        nom:       `${editForm.firstName.trim()} ${editForm.lastName.trim()}`.trim() || x.nom,
        phoneRaw:  phoneClean ? `+216${phoneClean}` : '',
        role:      editForm.role === 'administrateur' ? 'admin' : editForm.role,
        img:       editForm.img,
      } : x));
      // Si on a modifié notre propre photo en session, persister le cache photo
      if (editMember.username) {
        try {
          if (editForm.img) sessionStorage.setItem('photo__' + editMember.username, editForm.img);
          else sessionStorage.removeItem('photo__' + editMember.username);
        } catch (_) {}
      }
      showToast(`${editForm.firstName} ${editForm.lastName} mis à jour ✓`);
      setEditMember(null);
    } catch (err) {
      console.error('Erreur édition membre:', err);
      showToast('Erreur lors de la mise à jour');
    } finally {
      setEditSaving(false);
    }
  };

  const openBudget = (m) => { setModalBudget(m); setBudgetVal(String(budgetGlobal)); };
  const applyBudget = async () => {
    const val = parseInt(budgetVal, 10);
    if (isNaN(val) || val < 0) { showToast('Montant invalide'); return; }
    if (!compteId) { showToast('Compte introuvable'); return; }
    try {
      const res = await fetch(`${API}/admins/set-budget/${compteId}?budget=${val}`, { method: 'PUT' });
      if (!res.ok) throw new Error();
      setBudgetGlobal(val);
      window.dispatchEvent(new Event('dashboard-refresh'));
      showToast(`Budget global mis à jour → ${formatDT(val)}`);
      setModalBudget(null);
    } catch {
      showToast('Erreur lors de la mise à jour du budget');
    }
  };

  const sendOtp = async () => {
    const rawPhone = form.phone.replace(/\s/g, '');
    if (rawPhone.length !== 8) { showToast('8 chiffres requis'); return; }
    const fullPhone = '+216' + rawPhone;
    try {
      // Le backend génère le code, le stocke en session/mémoire, et le logue dans Spring Boot
      // Le frontend NE connaît JAMAIS le code → vérification faite par POST /otp/verify
      const res = await fetch(`${API}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      if (!res.ok) {
        // Fallback query param
        const res2 = await fetch(
          `${API}/otp/send?phone=${encodeURIComponent(fullPhone)}`,
          { method: 'POST' }
        );
        if (!res2.ok) {
          let errMsg = 'Erreur envoi OTP';
          try { const j = await res2.json(); errMsg = j?.message ?? j?.error ?? errMsg; } catch { errMsg = (await res2.text().catch(() => '')) || errMsg; }
          showToast(errMsg);
          return;
        }
      }
      // On ne stocke PAS de code côté frontend — la vérification se fait via le backend
      setOtpCode('__backend__');
      setOtpSent(true); setOtpVerified(false);
      showToast('Code OTP envoyé');
    } catch (_) {
      showToast('Erreur réseau lors de l\'envoi OTP');
    }
  };
  const verifyOtp = async () => {
    const fullPhone = '+216' + form.phone.replace(/\s/g, '');
    try {
      // Vérification faite par le backend — le code n'est jamais exposé au frontend
      const res = await fetch(`${API}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code: otpInput }),
      });
      if (res.ok) {
        setOtpVerified(true);
        showToast('Numéro vérifié ✓');
      } else {
        // Fallback query param
        const res2 = await fetch(
          `${API}/otp/verify?phone=${encodeURIComponent(fullPhone)}&code=${otpInput}`,
          { method: 'POST' }
        );
        if (res2.ok) {
          setOtpVerified(true);
          showToast('Numéro vérifié ✓');
        } else {
          showToast('Code OTP incorrect');
          setOtpInput('');
        }
      }
    } catch (_) {
      showToast('Erreur réseau lors de la vérification OTP');
    }
  };

  const addMember = async () => {
    const errs = {};
    if (!form.nom.trim())        errs.nom      = 'Requis';
    if (!form.prenom.trim())     errs.prenom   = 'Requis';
    if (!form.username.trim())   errs.username = 'Requis';
    if (!form.password.trim())   errs.password = 'Requis';
    if (form.phone.replace(/\s/g,'').length !== 8) errs.phone    = '8 chiffres requis';
    if (!otpVerified)            errs.otp      = 'Vérifiez le numéro';
    // Snapshot familleId pour éviter le problème de state async
    const currentFamilleId = familleId;
    if (!currentFamilleId)       errs.global   = 'Famille introuvable — rechargez la page';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      // ── Étape 1 : créer l\'utilisateur ──
      // Essai de plusieurs endpoints courants (POST /users peut retourner 405 si le backend
      // utilise /users/add, /users/register, ou /auth/register)
      const userBody = JSON.stringify({
        lastName:  form.nom,
        firstName: form.prenom,
        username:  form.username,
        password:  form.password,
        phone:     '+216' + form.phone.replace(/\s/g,''),
        role:      form.role.toUpperCase(),
      });
      const userHeaders = { 'Content-Type': 'application/json' };
      const userEndpoints = [
        `${API}/users`,
        `${API}/users/add`,
        `${API}/users/register`,
        `${API}/auth/register`,
        `${API}/api/users`,
      ];
      let userRes = null;
      for (const endpoint of userEndpoints) {
        const r = await fetch(endpoint, { method: 'POST', headers: userHeaders, body: userBody });
        if (r.status !== 405 && r.status !== 404) { userRes = r; break; }
      }
      if (!userRes || !userRes.ok) {
        let errMsg = "Erreur création utilisateur (vérifiez l\'endpoint POST /users dans UserController.java)";
        if (userRes) { try { const j = await userRes.json(); errMsg = j?.message ?? j?.error ?? errMsg; } catch { errMsg = (await userRes.text().catch(() => '')) || errMsg; } }
        showToast(errMsg);
        return;
      }
      const createdUser = await userRes.json();
      const newUserId = createdUser?.id;
      if (!newUserId) { showToast("Erreur : ID utilisateur introuvable"); return; }

      // ── Étape 2 : inviter l\'utilisateur dans la famille ──
      const inviteRes = await fetch(
        `${API}/admins/invite-member?userId=${newUserId}&familleId=${currentFamilleId}`,
        { method: 'POST' }
      );
      if (!inviteRes.ok) {
        let errMsg = "Erreur invitation dans la famille";
        try { const j = await inviteRes.json(); errMsg = j?.message ?? j?.error ?? errMsg; } catch { errMsg = (await inviteRes.text().catch(() => '')) || errMsg; }
        showToast(errMsg);
        return;
      }

      // ── Étape 3 : définir le rôle du membre ──
      try {
        const membreRes = await fetch(`${API}/membres/user/${newUserId}`);
        if (membreRes.ok) {
          const membreData = await membreRes.json();
          const membreId = membreData?.id;
          if (membreId) {
            await fetch(`${API}/membres/change-role/${membreId}?role=${form.role.toUpperCase()}`, { method: 'PUT' });
          }
        }
      } catch (_) {}

      showToast(`@${form.username} ajouté avec succès ✓`);
      setForm(FORM_INIT); setOtpSent(false); setOtpInput(''); setOtpVerified(false);
      setShowForm(false); setFormErrors({});

      // ── Étape 4 : re-fetch la liste des membres ──
      const memRes = await fetch(`${API}/familles/membres/${familleId}`);
      if (memRes.ok) {
        const memData = await memRes.json();
        const username = sessionStorage.getItem('username') || '';
        const enriched = await Promise.all((memData ?? []).map(async (m) => {
          const u = m.user ?? m;
          const uId = u.id ?? m.userId ?? null;
          const uUsername = u.username ?? '';
          let photo = '';
          if (uId) {
            try {
              const ur = await fetch(`${API}/users/${uId}`);
              if (ur.ok) {
                const ud = await ur.json();
                photo = ud.photo ?? '';
                if (photo && uUsername) sessionStorage.setItem('photo__' + uUsername, photo);
              }
            } catch (_) {}
          }
          if (!photo && uUsername) photo = sessionStorage.getItem('photo__' + uUsername) || '';
          return { ...m, _resolvedPhoto: photo };
        }));
        const mapped = enriched.map(m => {
          const u = m.user ?? m;
          const prenom   = u.firstName ?? u.prenom ?? '';
          const nom      = u.lastName  ?? u.nom    ?? '';
          const fullName = `${prenom} ${nom}`.trim() || u.username || `Membre ${m.id}`;
          const rawRole  = m.role ?? m.roleInFamily ?? m.type ?? u.role ?? u.roleInFamily ?? '';
          const estVous  = (u.username ?? '') === username;
          const img      = m._resolvedPhoto || u.photo || '';
          return {
            id: m.id,
            userId: u.id ?? m.userId ?? null,
            nom: fullName,
            firstName: prenom,
            lastName: nom,
            phoneRaw: u.phone ?? '',
            username: u.username ?? '',
            role: normalizeRole(rawRole),
            budget: m.budget ?? 0,
            presence: 'success',
            img,
            estVous,
          };
        });
        const roleOrder = { admin: 0, gestionnaire: 1, consultant: 2 };
        mapped.sort((a, b) => {
          if (a.estVous) return -1;
          if (b.estVous) return 1;
          const rDiff = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
          return rDiff !== 0 ? rDiff : a.nom.localeCompare(b.nom, 'fr');
        });
        setMembres(mapped);
      }
    } catch {
      showToast('Erreur réseau lors de l\'ajout');
    }
  };

  return (
    <div
      className="main-bg main-bg-blur main-bg-opac roundedui adminuiux-header-standard theme-purple adminuiux-mobile-footer-fill-white adminuiux-sidebar-fill-theme adminuiux-header-transparent adminuiux-sidebar-boxed bg-gradient-1 scrollup"
      data-theme="theme-purple"
    >

      {/* ════════════════════════════════════════
          STYLES
      ════════════════════════════════════════ */}
      <style>{`
        /* ── Icônes SVG visibles sur header clair ── */
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
        .sidebar-toggler:hover .icon-svg {
          stroke: #377CF4;
        }
        .btn-link-header:hover,
        .sidebar-toggler:hover {
          background: rgba(55,124,244,.08) !important;
          border-radius: 10px;
        }
        /* ── Fix header toujours au-dessus de la sidebar ── */
        .adminuiux-header { z-index: 1100 !important; }
        .adminuiux-sidebar {
          top: 56px !important;
          height: calc(100% - 56px) !important;
        }
        .sidebar-overlay { top: 56px !important; }

        /* ── Sous-menu Statistiques ── */
        .stats-chevron {
          margin-left: auto;
          font-size: 10px;
          opacity: 0.7;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
        }
        .stats-open .stats-chevron { transform: rotate(180deg); }
        .stats-submenu {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
          opacity: 0;
          background: transparent;
          border-radius: 0;
          margin: 0 !important;
          padding: 0 !important;
          pointer-events: none;
          list-style: none;
        }
        .stats-submenu.stats-submenu-open {
          max-height: 180px;
          opacity: 1;
          background: rgba(255,255,255,0.08);
          border-radius: 12px;
          margin: 2px 8px 4px 8px !important;
          pointer-events: auto;
        }
        .stats-submenu .nav-link {
          padding: 8px 16px 8px 20px !important;
          font-size: 13.5px;
          font-weight: 500;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .stats-submenu:not(.stats-submenu-open) .nav-link {
          padding: 0 !important;
          margin: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
        }
        .stats-submenu .nav-link .sub-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.4; flex-shrink: 0;
          transition: opacity 0.2s, transform 0.2s;
        }
        .stats-submenu .nav-link:hover .sub-dot,
        .stats-submenu .nav-link.active .sub-dot { opacity: 1; transform: scale(1.4); }
        .stats-submenu .nav-link:hover { background: rgba(255,255,255,0.12) !important; }
        .nav-item-stats.stats-open > .nav-link { opacity: 1; }

        /* ── Fix navbar z-index ── */
        .navbar.fixed-top {
          z-index: 1050 !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          background-color: inherit !important;
        }

        /* ── Profile styles ── */
        :root{--purple:#377CF4;--purple-lt:rgba(55,124,244,0.1);--blue-lt:rgba(55,124,244,0.1);--green-lt:rgba(25,135,84,0.1);--red-lt:rgba(220,53,69,0.1);--border:#e9ecef}
        .profile-banner{background:linear-gradient(135deg,#1a1f3a 0%,#2d3561 45%,#377CF4 100%);border-radius:20px;padding:40px 24px 36px;position:relative;overflow:hidden;margin-bottom:14px;min-height:220px}
        .profile-banner::before{content:'';position:absolute;top:-60px;right:-60px;width:260px;height:260px;background:rgba(55,124,244,.22);border-radius:50%;pointer-events:none}
        .profile-banner::after{content:'';position:absolute;bottom:-50px;left:-30px;width:180px;height:180px;background:rgba(255,255,255,.05);border-radius:50%;pointer-events:none}
        .banner-inner{display:flex;flex-direction:column;align-items:center;gap:16px;position:relative;text-align:center}
        .banner-ava{width:110px;height:110px;border-radius:22px;overflow:hidden;border:3px solid rgba(255,255,255,.4);flex-shrink:0;box-shadow:0 10px 30px rgba(0,0,0,.3)}
        .banner-ava img{width:100%;height:100%;object-fit:cover}
        .banner-ava-fb{width:100%;height:100%;background:linear-gradient(135deg,#377CF4,#2E3F8F);display:flex;align-items:center;justify-content:center;font-size:2.4rem;color:#fff;font-weight:700}
        .banner-info{display:flex;flex-direction:column;align-items:center;gap:7px}
        .banner-role-admin{display:inline-flex;align-items:center;gap:5px;background:rgba(55,124,244,.35);color:#d8b4fe;border:1px solid rgba(168,85,247,.5);border-radius:20px;padding:5px 16px;font-size:12px;font-weight:700}
        .banner-name{font-size:22px;font-weight:800;color:#fff;margin:0;letter-spacing:-.3px}
        .banner-fullname{font-size:15px;font-weight:600;color:rgba(255,255,255,.9);margin:0}
        .banner-phone{font-size:12px;color:rgba(255,255,255,.55);display:flex;align-items:center;gap:5px;margin:0}
        .banner-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:2px}
        .banner-sub{font-size:13px;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:5px;margin:0}
        .banner-divider{width:1px;height:13px;background:rgba(255,255,255,.3)}
        .btn-edit-prof{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:10px;padding:6px 13px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;display:flex;align-items:center;gap:5px;transition:background .2s;backdrop-filter:blur(6px)}
        .btn-edit-prof:hover{background:rgba(255,255,255,.25);color:#fff}
        .prof-card{background:#fff;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
        .sec-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .sec-head-left{display:flex;align-items:center;gap:10px}
        .sh-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
        .sh-title{font-size:14px;font-weight:700;margin:0}
        .sh-sub{font-size:11px;color:#6c757d;margin:0}
        .btn-add-member{background:linear-gradient(135deg,#377CF4,#2E3F8F);color:#fff;border:none;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;transition:opacity .2s}
        .btn-add-member:hover{opacity:.9}
        .add-form{background:rgba(55,124,244,.05);border:1.5px dashed rgba(55,124,244,.3);border-radius:14px;padding:16px;margin-bottom:14px}
        .fl{font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;display:block;margin-bottom:6px}
        .fi{width:100%;padding:10px 12px;border:1.5px solid rgba(55,124,244,.2);border-radius:10px;font-size:13px;outline:none;margin-bottom:4px;transition:border-color .2s;box-sizing:border-box}
        .fi:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(55,124,244,.1)}
        .fe{font-size:11px;color:#dc3545;margin-bottom:6px}
        .member-row{padding:12px 0;border-bottom:1px solid var(--border)}
        .member-row:last-child{border-bottom:none;padding-bottom:0}
        .member-row:first-child{padding-top:0}
        .member-inner{display:flex;align-items:center;gap:12px}
        .member-ava{position:relative;width:44px;height:44px;flex-shrink:0}
        .member-ava img{width:44px;height:44px;border-radius:10px;object-fit:cover;display:block}
        .member-ava-fb{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#377CF4,#2E3F8F);display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;font-weight:700}
        .member-info{flex:1;min-width:0}
        .member-name-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;font-size:13px;font-weight:600}
        .member-actions{display:flex;gap:6px;flex-shrink:0}
        .role-badge{display:inline-flex;align-items:center;gap:4px;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700}
        .role-admin{background:var(--purple-lt);color:var(--purple)}
        .role-gestionnaire{background:var(--blue-lt);color:#377CF4}
        .role-consultant{background:var(--green-lt);color:#198754}
        .budget-badge{display:inline-flex;align-items:center;gap:4px;background:var(--green-lt);color:#198754;border:1px solid rgba(25,135,84,.25);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:700;cursor:pointer;transition:background .15s}
        .budget-badge:hover{background:rgba(25,135,84,.18)}
        .btn-act{width:30px;height:30px;border-radius:8px;border:none;display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;transition:background .15s}
        .btn-wal{background:var(--purple-lt);color:var(--purple)}
        .btn-wal:hover{background:rgba(55,124,244,.2)}
        .btn-del{background:var(--red-lt);color:#dc3545}
        .btn-del:hover{background:rgba(220,53,69,.2)}
        .budget-recap{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
        .brc{border-radius:12px;padding:12px;text-align:center;border:1px solid var(--border)}
        .brc-val{font-size:14px;font-weight:700}
        .brc-lbl{font-size:10px;color:#6c757d;margin-top:2px}
        .chip-role{transition:box-shadow .15s,opacity .15s;opacity:.55;cursor:pointer;padding:6px 14px !important;font-size:12px !important}
        .chip-role.chip-active{opacity:1;box-shadow:0 0 0 2.5px currentColor}
        .modal-back{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1040;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal-box{background:#fff;border-radius:20px;width:100%;max-width:400px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.18);animation:fadeUp .3s ease both}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fb-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a1f3a,#377CF4);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:500;z-index:9999;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:fadeUp .3s ease both}
        .you-badge{background:#6c757d;color:#fff;font-size:10px;padding:1px 7px;border-radius:20px}
        @media(max-width:360px){.budget-recap{grid-template-columns:1fr}}
      `}</style>

      {/* ════════════════════════════════════════
          HEADER (identique à AssistantIA)
      ════════════════════════════════════════ */}
      <header className="adminuiux-header inner-page">
        <nav className="navbar navbar-expand-lg fixed-top">
          <div className="container-fluid">

            {/* 3 lignes sidebar toggler */}
            <button
              className="btn btn-link btn-square sidebar-toggler ms-1"
              type="button"
              onClick={() => window.initSidebar && window.initSidebar()}
            >
              <svg className="icon-svg" viewBox="0 0 24 24">
                <line x1="3" y1="6"  x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {/* Logo */}
            <a className="navbar-brand" href="/">
              <img data-bs-img="light" src="assets/img/family-balance-logo.png" alt="" />
              <img data-bs-img="dark"  src="assets/img/family-balance-logo.png" alt="" />
              <div className="lh-20 d-block ms-2">
                <span className="h4">FamilyBalance</span>
                <p className="company-tagline">Gestion budgétaire familiale</p>
              </div>
            </a>

            {/* Icônes droite */}
            <div className="ms-auto d-flex align-items-center">

              {/* Soleil / Thème */}
              <button className="btn btn-link btn-square btn-link-header" id="btn-layout-modes-dark-page" title="Changer le thème">
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

              {/* Cloche */}
              <a href="/notifications" className="btn btn-link btn-square btn-icon btn-link-header position-relative" title="Notifications">
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="position-absolute top-0 end-0 badge rounded-pill bg-danger" style={{ fontSize:'9px', padding:'2px 5px' }}>3</span>
              </a>

              {/* Déconnexion */}
              <a href="/login" className="btn btn-link btn-square btn-icon btn-link-header" title="Déconnexion">
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </a>

            </div>
          </div>
        </nav>
      </header>

      {/* ════════════════════════════════════════
          PAGE WRAPPER
      ════════════════════════════════════════ */}
      <div className="adminuiux-wrap">

        {/* ════════════════════════════════════════
            SIDEBAR (identique à AssistantIA)
        ════════════════════════════════════════ */}
        <div className="adminuiux-sidebar">
          <div className="adminuiux-sidebar-inner" style={{ paddingBottom: 80, overflowY: 'auto', height: '100%' }}>

            <div className="px-3 px-lg-4 my-3">
              <div className="row gx-3 gx-lg-4 justify-content-center align-items-center">
                <div className="col-auto">
                  <figure className="avatar avatar-60 rounded p-1 card mx-auto coverimg" style={{ overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#377CF4,#2E3F8F)' }}>
                    {userAvatar
                      ? <img src={userAvatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                          onError={e => { e.target.style.display='none'; }}/>
                      : <span style={{ color:'#fff', fontWeight:700, fontSize:'1.4rem' }}>
                          {(userPrenom || 'U')[0]?.toUpperCase()}
                        </span>
                    }
                  </figure>
                </div>
                <div className="col">
                  <h4 className="mb-0">Famille Ben Ali</h4>
                  <p className="opacity-50">Administrateur</p>
                </div>
              </div>
            </div>

            <ul className="nav flex-column menu-active-line mt-0">
              <li className="nav-item"><a className="nav-link" href="/"><div className="avatar avatar-30 icon"><i className="bi bi-house-door"></i></div><div className="col">Accueil</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/revenus"><div className="avatar avatar-30 icon"><i className="bi bi-graph-up-arrow"></i></div><div className="col">Revenus</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/charges"><div className="avatar avatar-30 icon"><i className="bi bi-wallet2"></i></div><div className="col">Charges</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/factures"><div className="avatar avatar-30 icon"><i className="bi bi-receipt"></i></div><div className="col">Factures</div></a></li>

              {/* ══ STATISTIQUES avec sous-menu ══ */}
              <li className={`nav-item nav-item-stats${statsOpen ? ' stats-open' : ''}`} id="statsNavItem">
                <a className="nav-link" href="#" onClick={toggleStats}>
                  <div className="avatar avatar-30 icon"><i className="bi bi-bar-chart-line"></i></div>
                  <div className="col">Statistiques</div>
                  <i className="bi bi-chevron-down stats-chevron"></i>
                </a>
                <ul className={`nav flex-column stats-submenu${statsOpen ? ' stats-submenu-open' : ''}`}>
                  <li className="nav-item"><a className="nav-link" href="/stats-budget"><span className="sub-dot"></span><span>Budget Global</span></a></li>
                  <li className="nav-item"><a className="nav-link" href="/stats-revenus"><span className="sub-dot"></span><span>Revenus</span></a></li>
                  <li className="nav-item"><a className="nav-link" href="/stats-charges"><span className="sub-dot"></span><span>Charges</span></a></li>
                  <li className="nav-item"><a className="nav-link" href="/stats-factures"><span className="sub-dot"></span><span>Factures</span></a></li>
                </ul>
              </li>

              <li className="nav-item"><a className="nav-link" href="/notifications"><div className="avatar avatar-30 icon"><i className="bi bi-bell"></i></div><div className="col">Alertes</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/chat"><div className="avatar avatar-30 icon"><i className="bi bi-robot"></i></div><div className="col">IA Chat</div></a></li>
              <li className="nav-item"><a className="nav-link active" href="/profile"><div className="avatar avatar-30 icon"><i className="bi bi-person-circle"></i></div><div className="col">Profil</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/login"><div className="avatar avatar-30 icon"><i className="bi bi-box-arrow-right"></i></div><div className="col">Déconnexion</div></a></li>
            </ul>

          </div>
        </div>
        {/* ── END SIDEBAR ── */}

        {/* ════════════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════════════ */}
        <main className="adminuiux-content has-sidebar">
          <div className="main-container container" style={{ paddingTop: '60px', paddingBottom: '80px' }}>

            {/* Breadcrumb */}
            <div className="row gx-3 mb-3">
              <div className="col-12">
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-1" style={{ fontSize: '0.78rem' }}>
                    <li className="breadcrumb-item"><Link to="/" className="text-theme-1 style-none">Accueil</Link></li>
                    <li className="breadcrumb-item active">Profil</li>
                  </ol>
                </nav>
              </div>
            </div>

            {/* ── CONTENU PROFIL ── */}
            <div style={{ padding: '0 0 8px' }}>

              {/* ── BANNER ── */}
              <div className="profile-banner">
                <Link to="/profile/edit" className="btn-edit-prof">
                  <i className="bi bi-pencil-fill"></i> Modifier
                </Link>
                <div className="banner-inner">
                  <div className="banner-ava">
                    {userAvatar
                      ? <img src={userAvatar} alt="avatar"
                          onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                      : null
                    }
                    <div className="banner-ava-fb" style={{ display: userAvatar ? 'none' : 'flex' }}>
                      {(userPrenom || user?.familyName || 'F')[0]?.toUpperCase()}
                    </div>
                  </div>
                  <div className="banner-info">
                    <div className="banner-role-admin"><i className="bi bi-shield-fill-check"></i> Administrateur</div>
                    <div className="banner-name">{familleNom || user?.familyName || ''}</div>
                    <div className="banner-fullname">
                      <i className="bi bi-person-fill" style={{ opacity:.7 }}></i> {userPrenom} {userNom}
                    </div>
                    {userPhone && (
                      <div className="banner-phone">
                        <i className="bi bi-telephone-fill"></i> {formatPhone(userPhone)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── GESTION FAMILLE ── */}
              <div className="prof-card">
                <div className="sec-head">
                  <div className="sec-head-left">
                    <div className="sh-icon" style={{ background:'rgba(55,124,244,.1)', color:'#377CF4' }}>
                      <i className="bi bi-people-fill"></i>
                    </div>
                    <div>
                      <p className="sh-title">Membres de la famille</p>
                      <p className="sh-sub">{membres.length} membres</p>
                    </div>
                  </div>

                  {/* Bouton Ajouter — admin seulement */}
                  {isAdmin && (
                    <button className="btn-add-member"
                      onClick={() => { setShowForm(v => !v); setFormErrors({}); setOtpSent(false); setOtpVerified(false); setOtpInput(''); setForm(FORM_INIT); }}>
                      <i className={`bi ${showForm ? 'bi-x-lg' : 'bi-person-plus'}`}></i>
                      {showForm ? 'Fermer' : 'Ajouter'}
                    </button>
                  )}
                </div>

                {/* Formulaire ajout membre — admin seulement */}
                {isAdmin && showForm && (
                  <div className="add-form">
                    <p style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1e1b4b' }}>
                      <i className="bi bi-person-badge me-1" style={{ color:'#377CF4' }}></i> Nouveau membre
                    </p>

                    {formErrors.global && (
                      <div style={{ background:'rgba(220,53,69,.08)', border:'1px solid rgba(220,53,69,.25)', borderRadius:8, padding:'8px 12px', marginBottom:10, fontSize:12, color:'#dc3545', fontWeight:600 }}>
                        <i className="bi bi-exclamation-triangle me-1"></i>{formErrors.global}
                      </div>
                    )}

                    <div style={{ display:'flex', gap:10 }}>
                      <div style={{ flex:1 }}>
                        <label className="fl">Nom *</label>
                        <input className="fi" type="text" placeholder="Nom de famille" value={form.nom}
                          onChange={e => setForm({...form, nom: e.target.value})} />
                        {formErrors.nom && <div className="fe">{formErrors.nom}</div>}
                      </div>
                      <div style={{ flex:1 }}>
                        <label className="fl">Prénom *</label>
                        <input className="fi" type="text" placeholder="Prénom" value={form.prenom}
                          onChange={e => setForm({...form, prenom: e.target.value})} />
                        {formErrors.prenom && <div className="fe">{formErrors.prenom}</div>}
                      </div>
                    </div>

                    {/* Champ "Nom d'utilisateur" retiré — auto-généré
                        depuis Prénom + Nom (cf. useEffect en haut du composant),
                        aligné sur le web Angular. */}

                    <label className="fl">Mot de passe *</label>
                    <div style={{ position:'relative', marginBottom:8 }}>
                      <input className="fi" type={showPassword ? 'text' : 'password'} placeholder="Mot de passe" value={form.password}
                        style={{ paddingRight:38, marginBottom:0 }}
                        onChange={e => setForm({...form, password: e.target.value})} />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#6c757d', padding:0, fontSize:16, lineHeight:1 }}>
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                    {formErrors.password && <div className="fe">{formErrors.password}</div>}

                    <label className="fl">Téléphone *</label>
                    <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                      <div style={{ display:'flex', border:'1.5px solid rgba(55,124,244,.2)', borderRadius:10, overflow:'hidden', flex:1 }}>
                        <span style={{ padding:'10px', background:'rgba(55,124,244,.08)', fontWeight:700, fontSize:13, color:'#377CF4' }}>+216</span>
                        <input type="tel" placeholder="XX XXX XXX" maxLength={11} value={form.phone}
                          style={{ border:'none', flex:1, padding:'10px', fontSize:13, outline:'none' }}
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g,'').slice(0,8);
                            let formatted = digits;
                            if (digits.length > 5) formatted = digits.slice(0,2) + ' ' + digits.slice(2,5) + ' ' + digits.slice(5);
                            else if (digits.length > 2) formatted = digits.slice(0,2) + ' ' + digits.slice(2);
                            setForm({...form, phone: formatted});
                          }} />
                      </div>
                      <button onClick={sendOtp}
                        style={{ background:'linear-gradient(135deg,#377CF4,#2E3F8F)', color:'#fff', border:'none', borderRadius:10, padding:'0 14px', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                        {otpSent ? 'Renvoyer' : 'OTP'}
                      </button>
                    </div>
                    {formErrors.phone && <div className="fe">{formErrors.phone}</div>}

                    {otpSent && !otpVerified && (
                      <div style={{ marginBottom:8 }}>
                        <label className="fl">Code OTP *</label>
                        <div style={{ display:'flex', gap:8 }}>
                          <input className="fi" type="text" placeholder="6 chiffres" maxLength={6} value={otpInput}
                            style={{ flex:1, marginBottom:0 }}
                            onChange={e => setOtpInput(e.target.value.replace(/\D/g,''))} />
                          <button onClick={verifyOtp}
                            style={{ background:'#198754', color:'#fff', border:'none', borderRadius:10, padding:'0 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                            Vérifier
                          </button>
                        </div>
                      </div>
                    )}
                    {otpVerified && (
                      <div style={{ fontSize:12, color:'#198754', fontWeight:600, marginBottom:8 }}>
                        <i className="bi bi-check-circle-fill me-1"></i>Numéro vérifié
                      </div>
                    )}
                    {formErrors.otp && <div className="fe">{formErrors.otp}</div>}

                    <label className="fl" style={{ marginTop:8 }}>Rôle *</label>
                    <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                      {['gestionnaire','consultant'].map(r => (
                        <span key={r}
                          onClick={() => setForm({...form, role: r})}
                          style={{
                            cursor:'pointer', userSelect:'none', padding:'7px 14px', borderRadius:20,
                            fontWeight:600, fontSize:12, display:'flex', alignItems:'center', gap:5,
                            border:      form.role === r ? '2px solid #377CF4' : '1.5px solid #dee2e6',
                            background:  form.role === r ? 'rgba(55,124,244,.12)' : 'transparent',
                            color:       form.role === r ? '#377CF4' : '#6c757d',
                            transition:  'all .18s',
                          }}>
                          <i className={`bi ${r === 'gestionnaire' ? 'bi-person-gear' : 'bi-eye'}`}></i>
                          {r === 'gestionnaire' ? 'Gestionnaire' : 'Consultant'}
                        </span>
                      ))}
                    </div>

                    <div style={{ display:'flex', gap:8 }}>
                      <button
                        onClick={() => { setShowForm(false); setForm(FORM_INIT); setFormErrors({}); setOtpSent(false); setOtpVerified(false); setOtpInput(''); }}
                        style={{ flex:1, padding:'10px', border:'1.5px solid #dee2e6', borderRadius:10, background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        Annuler
                      </button>
                      <button onClick={addMember}
                        style={{ flex:2, padding:'10px', background:'linear-gradient(135deg,#377CF4,#2E3F8F)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        <i className="bi bi-person-check me-1"></i>Ajouter
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste membres — triée dans fetchData : vous, admin, gestionnaire, consultant, alpha.
                    Click sur la carte (admin only, hors soi-même) → popup d'édition. */}
                {membres.map(m => {
                  const canEditThis = isAdmin && !m.estVous;
                  return (
                  <div key={m.id} className="member-row">
                    <div className="member-inner"
                         onClick={() => canEditThis && openEditMember(m)}
                         style={{ cursor: canEditThis ? 'pointer' : 'default' }}
                         title={canEditThis ? 'Modifier ce membre' : ''}>
                      <div className="member-ava">
                        {m.img
                          ? <img src={m.img} alt={m.nom} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                          : null
                        }
                        <div className="member-ava-fb" style={{ display: m.img ? 'none' : 'flex' }}>
                          {m.nom[0].toUpperCase()}
                        </div>
                        <PresenceDot color={m.presence} />
                      </div>
                      <div className="member-info">
                        <div className="member-name-row">{m.nom}</div>
                        <div style={{ marginTop:3 }}>
                          {m.estVous
                            ? <span className="you-badge">Vous</span>
                            : <RoleBadge role={m.role} />
                          }
                        </div>
                      </div>
                      {canEditThis && (
                        <div className="member-actions" onClick={e => e.stopPropagation()}>
                          <button className="btn-act btn-edit" onClick={() => openEditMember(m)} title="Modifier"
                                  style={{ background:'rgba(91,127,232,.12)', color:'#377CF4', border:'1px solid rgba(91,127,232,.25)' }}>
                            <i className="bi bi-pencil-square"></i>
                          </button>
                          <button className="btn-act btn-del" onClick={() => setModalDel(m)} title="Supprimer">
                            <i className="bi bi-trash3"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}

              </div>

            </div>
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════
          TAB BAR MOBILE (identique à AssistantIA)
      ════════════════════════════════════════ */}
      <footer className="adminuiux-mobile-footer hide-on-scrolldown style-1">
        <div className="container">
          <ul className="nav nav-pills nav-justified bg-blur">
            <li className="nav-item">
              <a className="nav-link" href="/">
                <span><i className="nav-icon bi bi-house"></i><span className="nav-text">Accueil</span></span>
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/stats-budget">
                <span><i className="nav-icon bi bi-bar-chart-line"></i><span className="nav-text">Statistiques</span></span>
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/chat">
                <span><i className="nav-icon bi bi-robot"></i><span className="nav-text">IA Chat</span></span>
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link active" href="/profile">
                <span><i className="nav-icon bi bi-person-circle"></i><span className="nav-text">Profil</span></span>
              </a>
            </li>
          </ul>
        </div>
      </footer>

      {/* ── MODAL BUDGET ── */}
      {modalBudget && (
        <div className="modal-back" onClick={() => setModalBudget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'rgba(25,135,84,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="bi bi-wallet2" style={{ color:'#198754', fontSize:18 }}></i>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>Définir le budget global</div>
                <div style={{ fontSize:12, color:'#6c757d' }}>Famille · Compte #{compteId}</div>
              </div>
              <button onClick={() => setModalBudget(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6c757d' }}>✕</button>
            </div>
            <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:6 }}>Montant (DT)</label>
            <div style={{ display:'flex', border:'1.5px solid #dee2e6', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
              <input type="number" min="0" value={budgetVal} onChange={e => setBudgetVal(e.target.value)}
                style={{ flex:1, padding:'10px 12px', border:'none', outline:'none', fontSize:14 }} />
              <span style={{ padding:'10px 12px', background:'#f8f9fa', fontSize:14, fontWeight:600 }}>DT</span>
            </div>
            <p style={{ fontSize:11, color:'#6c757d', marginBottom:16 }}>
              Budget actuel : {formatDT(budgetGlobal)}
            </p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModalBudget(null)} style={{ flex:1, padding:'10px', border:'1.5px solid #dee2e6', borderRadius:10, background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer' }}>Annuler</button>
              <button onClick={applyBudget} style={{ flex:2, padding:'10px', background:'linear-gradient(135deg,#198754,#15803d)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                <i className="bi bi-check2 me-1"></i>Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SUPPRESSION ── */}
      {modalDel && (
        <div className="modal-back" onClick={() => setModalDel(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'rgba(220,53,69,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="bi bi-person-x" style={{ color:'#dc3545', fontSize:18 }}></i>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>Supprimer le membre</div>
                <div style={{ fontSize:12, color:'#6c757d' }}>{modalDel.nom}</div>
              </div>
              <button onClick={() => setModalDel(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6c757d' }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:'#6c757d', marginBottom:20 }}>Êtes-vous sûr ? Cette action est irréversible.</p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModalDel(null)} style={{ flex:1, padding:'10px', border:'1.5px solid #dee2e6', borderRadius:10, background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer' }}>Non</button>
              <button onClick={confirmDelete} style={{ flex:1, padding:'10px', background:'linear-gradient(135deg,#dc3545,#b91c1c)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                <i className="bi bi-trash3 me-1"></i>Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ÉDITION MEMBRE (admin only) ────────────────────────────
          Permet de modifier prénom / nom / téléphone / rôle / photo d'un
          autre membre. Ouvert au click sur la carte membre ou sur l'icône
          crayon. Le champ téléphone est limité à 8 chiffres ; le rôle se
          choisit parmi Administrateur / Gestionnaire / Consultant. */}
      {editMember && (
        <div className="modal-back" onClick={() => !editSaving && setEditMember(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'rgba(91,127,232,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="bi bi-person-gear" style={{ color:'#377CF4', fontSize:18 }}></i>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>Modifier le membre</div>
                <div style={{ fontSize:12, color:'#6c757d' }}>{editMember.nom}</div>
              </div>
              <button onClick={() => !editSaving && setEditMember(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6c757d' }}>✕</button>
            </div>

            {/* Photo */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
              <div style={{ position:'relative', width:64, height:64, borderRadius:'50%', background:'#f1f5f9', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid rgba(91,127,232,.25)', flexShrink:0 }}>
                {editForm.img
                  ? <img src={editForm.img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <span style={{ fontSize:24, fontWeight:700, color:'#377CF4' }}>
                      {(editForm.firstName[0] || '?').toUpperCase()}{(editForm.lastName[0] || '').toUpperCase()}
                    </span>
                }
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ padding:'6px 12px', background:'rgba(91,127,232,.10)', color:'#377CF4', border:'1px solid rgba(91,127,232,.30)', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'center' }}>
                  <i className="bi bi-camera me-1"></i>Changer la photo
                  <input type="file" accept="image/*" onChange={handleEditPhoto} style={{ display:'none' }} />
                </label>
                {editForm.img && (
                  <button onClick={() => setEditForm(f => ({ ...f, img: '' }))}
                    style={{ padding:'4px 10px', background:'transparent', color:'#dc3545', border:'1px solid rgba(220,53,69,.30)', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    <i className="bi bi-trash me-1"></i>Retirer
                  </button>
                )}
              </div>
            </div>

            {/* Prénom + Nom */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:4 }}>Prénom</label>
                <input type="text" value={editForm.firstName}
                       onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))}
                       style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #dee2e6', borderRadius:8, fontSize:13 }} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:4 }}>Nom</label>
                <input type="text" value={editForm.lastName}
                       onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))}
                       style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #dee2e6', borderRadius:8, fontSize:13 }} />
              </div>
            </div>

            {/* Téléphone */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:4 }}>Téléphone (8 chiffres)</label>
              <div style={{ display:'flex', alignItems:'center', border:'1.5px solid #dee2e6', borderRadius:8, overflow:'hidden' }}>
                <span style={{ padding:'8px 10px', background:'#f8f9fa', fontSize:13, fontWeight:600, color:'#475569' }}>+216</span>
                <input type="tel" inputMode="numeric" maxLength={8} pattern="\d*"
                       value={editForm.phone}
                       onChange={e => setEditForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                       placeholder="XX XXX XXX"
                       style={{ flex:1, padding:'8px 10px', border:'none', outline:'none', fontSize:13 }} />
              </div>
            </div>

            {/* Rôle */}
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, fontWeight:600, color:'#475569', display:'block', marginBottom:4 }}>Rôle</label>
              <select value={editForm.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                      style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #dee2e6', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer' }}>
                <option value="gestionnaire">Gestionnaire</option>
                <option value="consultant">Consultant</option>
              </select>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => !editSaving && setEditMember(null)}
                style={{ flex:1, padding:'10px', border:'1.5px solid #dee2e6', borderRadius:10, background:'transparent', fontSize:13, fontWeight:600, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.6 : 1 }}>
                Annuler
              </button>
              <button onClick={saveEditMember} disabled={editSaving}
                style={{ flex:2, padding:'10px', background:'linear-gradient(135deg,#377CF4,#2E3F8F)', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? 'Enregistrement…' : <><i className="bi bi-check2 me-1"></i>Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fb-toast">{toast}</div>}
    </div>
  );
}

export default Profile;
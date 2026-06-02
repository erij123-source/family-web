import { useEffect, useState, useCallback } from "react";

const API = "http://localhost:8080";

// ─── Clé localStorage ──────────────────────────────────────────────────────
function getNotifKey(username) {
  const now = new Date();
  return `notifs__${username}__${now.getFullYear()}_${now.getMonth() + 1}`;
}
function purgeOldNotifs(username) {
  const now    = new Date();
  const curKey = `notifs__${username}__${now.getFullYear()}_${now.getMonth() + 1}`;
  Object.keys(localStorage)
    .filter(k => k.startsWith(`notifs__${username}__`) && k !== curKey)
    .forEach(k => localStorage.removeItem(k));
}
function getSentKey(username) {
  const now = new Date();
  return `notifs_sent__${username}__${now.getFullYear()}_${now.getMonth() + 1}`;
}
function loadNotifs(username) {
  try { const r = localStorage.getItem(getNotifKey(username)); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveNotifs(username, notifs) {
  localStorage.setItem(getNotifKey(username), JSON.stringify(notifs));
}
function loadSent(username) {
  try { const r = localStorage.getItem(getSentKey(username)); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
function saveSent(username, sent) {
  localStorage.setItem(getSentKey(username), JSON.stringify(sent));
}

// ─── Niveau d'alerte ────────────────────────────────────────────────────────
function getAlertLevel(reste, budget) {
  if (budget <= 0) return null;
  // Seuils alignés avec backend / web : épuisé, 1/8, 1/4 (le palier 1/6
   //  intermédiaire a été retiré pour rester cohérent partout).
  if (reste <= 0)           return "epuise";
  if (reste <= budget / 8)  return "urgent";
  if (reste <= budget / 4)  return "attention";
  return null;
}

// ─── Config niveaux ─────────────────────────────────────────────────────────
const LEVELS = {
  attention: {
    icon: "bi bi-graph-down-arrow",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.20)",
    iconBg: "rgba(245,158,11,0.12)",
    label: null,
    msg: () => "Attention, votre budget commence à se réduire.",
  },
  presque: {
    icon: "bi bi-exclamation-triangle",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.20)",
    iconBg: "rgba(249,115,22,0.12)",
    label: null,
    msg: () => "Votre budget est presque épuisé.",
  },
  urgent: {
    icon: "bi bi-lightning-charge",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.20)",
    iconBg: "rgba(239,68,68,0.12)",
    label: null,
    msg: () => "Il vous reste très peu de budget ce mois-ci.",
  },
  epuise: {
    icon: "bi bi-wallet2",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.22)",
    iconBg: "rgba(220,38,38,0.12)",
    label: "Budget épuisé",
    msg: () => "Votre budget est entièrement consommé pour ce mois.",
  },
  admin_epuise: {
    icon: "bi bi-wallet2",
    color: "#377CF4",
    bg: "rgba(55,124,244,0.07)",
    border: "rgba(55,124,244,0.18)",
    iconBg: "rgba(55,124,244,0.12)",
    label: "Membre épuisé",
    msg: (nom) => `${nom} a terminé son budget.`,
  },
  // ── Factures : J-3, J-1, en retard ──────────────────────────────────
  facture_j3: {
    icon: "bi bi-calendar-event",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.08)",
    border: "rgba(14,165,233,0.20)",
    iconBg: "rgba(14,165,233,0.12)",
    label: "Échéance dans 3 jours",
    msg: (titre) => `${titre || "Facture"} arrive à échéance dans 3 jours.`,
  },
  facture_j1: {
    icon: "bi bi-calendar-x",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.22)",
    iconBg: "rgba(245,158,11,0.12)",
    label: "Échéance demain",
    msg: (titre) => `${titre || "Facture"} arrive à échéance demain.`,
  },
  facture_retard: {
    icon: "bi bi-exclamation-octagon",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.09)",
    border: "rgba(220,38,38,0.22)",
    iconBg: "rgba(220,38,38,0.12)",
    label: "Facture en retard",
    msg: (titre) => `${titre || "Facture"} est en retard de paiement.`,
  },
};

// ─── Format date ─────────────────────────────────────────────────────────────
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Carte notification ──────────────────────────────────────────────────────
function NotifCard({ notif, onDismiss }) {
  const cfg = LEVELS[notif.type] ?? LEVELS.attention;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 18,
      padding: "14px 16px",
      position: "relative",
      animation: "fadeSlideIn .35s ease both",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      {/* Icône Bootstrap */}
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: cfg.iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={cfg.icon} style={{ fontSize: 18, color: cfg.color }}></i>
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
          {cfg.label && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: .5,
              color: cfg.color,
              background: `${cfg.color}18`,
              borderRadius: 20, padding: "2px 9px",
              textTransform: "uppercase",
            }}>
              {cfg.label}
            </span>
          )}
        </div>
        <p style={{
          margin: 0, fontSize: 13.5, fontWeight: 600,
          color: "var(--text-primary, #1f2937)",
          lineHeight: 1.5,
        }}>
          {notif.message}
        </p>
        <p style={{
          margin: "5px 0 0", fontSize: 11,
          color: "var(--text-secondary, #9ca3af)",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <i className="bi bi-clock" style={{ fontSize: 10 }}></i>
          {fmtDate(notif.date)}
        </p>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(notif.id)}
        style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(0,0,0,0.05)", border: "none",
          width: 22, height: 22, borderRadius: 6,
          fontSize: 11, color: "var(--text-secondary, #9ca3af)",
          cursor: "pointer", lineHeight: 1, padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .2s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.10)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.05)"}
        title="Ignorer"
      >
        <i className="bi bi-x" style={{ fontSize: 13 }}></i>
      </button>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function Notifications() {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const username = sessionStorage.getItem("username") ?? "";

  function handleLogout(e) {
    e.preventDefault();
    sessionStorage.clear();
    window.location.href = "/login";
  }

  const compute = useCallback(async () => {
    if (!username) { setLoading(false); return; }
    purgeOldNotifs(username);

    // On repart toujours d'une liste VIDE et on recalcule depuis le backend.
    // L'anti-doublon se fait par type+membre sur la liste résultante, PAS via sent.
    const freshNotifs = [];

    function addNotif(type, membreKey, message) {
      // Eviter les doublons dans la même session de calcul
      const alreadyHere = freshNotifs.some(n => n.type === type && (n.membre ?? "self") === (membreKey ?? "self"));
      if (alreadyHere) return;
      freshNotifs.push({
        id: `${type}__${membreKey ?? "self"}__${Date.now()}`,
        type, membre: membreKey || null, message,
        date: new Date().toISOString(),
      });
    }

    try {
      // Récupérer userId via /users (sessionStorage ne stocke que username)
      const usersRes = await fetch(`${API}/users`);
      if (!usersRes.ok) throw new Error("users");
      const users = await usersRes.json();
      const currentUser = users.find(u => u.username === username);
      if (!currentUser?.id) throw new Error("user not found");
      const userId = currentUser.id;

      const membreRes = await fetch(`${API}/membres/user/${userId}`);
      if (!membreRes.ok) throw new Error("membre");
      const membre   = await membreRes.json();
      const membreId = membre.id;
      const budget      = Number(membre.budget ?? 0);
      const carryover   = Number(membre.carryoverBudget ?? 0);
      const budgetTotal = budget + carryover;

      const [chargesRes, facturesRes] = await Promise.all([
        fetch(`${API}/charges/membre/${membreId}/total/mois`),
        fetch(`${API}/factures/membre/${membreId}/total/mois`),
      ]);
      const chargesRaw  = chargesRes.ok  ? await chargesRes.text()  : "0";
      const facturesRaw = facturesRes.ok ? await facturesRes.text() : "0";
      const charges  = Math.max(0, Number(chargesRaw)  || 0);
      const factures = Math.max(0, Number(facturesRaw) || 0);
      const depenses = charges + factures;
      const reste    = budgetTotal - depenses;

      if (budgetTotal > 0) {
        // Seuils budget : épuisé / 1/8 restant / 1/4 restant — aligné
        // sur le backend + web Angular (palier 1/6 retiré pour cohérence).
        if      (reste <= 0)               addNotif("epuise",    null, LEVELS.epuise.msg(""));
        else if (reste <= budgetTotal / 8) addNotif("urgent",    null, LEVELS.urgent.msg(""));
        else if (reste <= budgetTotal / 4) addNotif("attention", null, LEVELS.attention.msg(""));
      }

      // ── Factures du membre : J-3, J-1, en retard ──
      try {
        const facRes = await fetch(`${API}/factures/membre/${membreId}`);
        if (facRes.ok) {
          const facs = await facRes.json() ?? [];
          const today = new Date(); today.setHours(0, 0, 0, 0);
          for (const f of facs) {
            if (f.statut === 'PAYEE') continue;
            const dueRaw = f.dueDate || f.issueDate;
            if (!dueRaw) continue;
            const due = new Date(dueRaw); due.setHours(0, 0, 0, 0);
            const diffDays = Math.round((due - today) / 86400000);
            const titre = f.title || 'Facture';
            if      (diffDays < 0)  addNotif('facture_retard', `f${f.id}`, LEVELS.facture_retard.msg(titre));
            else if (diffDays === 1) addNotif('facture_j1',     `f${f.id}`, LEVELS.facture_j1.msg(titre));
            else if (diffDays === 3) addNotif('facture_j3',     `f${f.id}`, LEVELS.facture_j3.msg(titre));
          }
        }
      } catch (e) { console.warn('[Notifications] factures scan failed', e); }

      const roleRes = await fetch(`${API}/membres/role/${membreId}`);
      let isAdmin = false;
      if (roleRes.ok) {
        const rawRole = await roleRes.text();
        let role = "";
        try { const p = JSON.parse(rawRole); role = typeof p === "string" ? p : (p?.role ?? ""); }
        catch { role = rawRole.trim().replace(/"/g, ""); }
        isAdmin = role.toUpperCase().includes("ADMIN");
      }

      if (isAdmin) {
        const familleId = membre.famille?.id ?? membre.familleId ?? null;
        if (familleId) {
          const membresRes = await fetch(`${API}/membres/famille/${familleId}`);
          if (membresRes.ok) {
            const tousMembres = await membresRes.json();
            await Promise.all(tousMembres.map(async (m) => {
              if (m.id === membreId) return;
              const mBudget      = Number(m.budget ?? 0);
              const mCarryover   = Number(m.carryoverBudget ?? 0);
              const mBudgetTotal = mBudget + mCarryover;
              if (mBudgetTotal <= 0) return;

              const mPrenom = m.prenom ?? m.user?.prenom ?? m.user?.firstName ?? "";
              const mNom    = m.nom    ?? m.user?.nom    ?? m.user?.lastName  ?? "";
              const mName   = `${mPrenom} ${mNom}`.trim() || m.user?.username || m.username || "Membre";

              const [mc, mf] = await Promise.all([
                fetch(`${API}/charges/membre/${m.id}/total/mois`),
                fetch(`${API}/factures/membre/${m.id}/total/mois`),
              ]);
              const mcRaw = mc.ok ? await mc.text() : "0";
              const mfRaw = mf.ok ? await mf.text() : "0";
              const mCharges  = Math.max(0, Number(mcRaw) || 0);
              const mFactures = Math.max(0, Number(mfRaw) || 0);
              const mReste    = mBudgetTotal - mCharges - mFactures;
              if (mReste <= 0) addNotif("admin_epuise", mName, LEVELS.admin_epuise.msg(mName));
            }));
          }
        }
      }
    } catch (err) {
      console.error("[Notifications] Erreur:", err.message);
    }

    freshNotifs.sort((a, b) => new Date(b.date) - new Date(a.date));
    // Sauvegarder la liste recalculée (remplace l'ancienne)
    saveNotifs(username, freshNotifs);
    // Réinitialiser le compteur de "lues" pour que le badge Dashboard reflète la réalité
    const now = new Date();
    const readKey = `notifs_read__${username}__${now.getFullYear()}_${now.getMonth() + 1}`;
    // On garde readCount tel quel — le badge = total - readCount sera recalculé par Dashboard
    setNotifs(freshNotifs);
    setLoading(false);
  }, [username]);

  // Marquer toutes les notifs comme lues (met à jour le compteur du Dashboard)
  // Sauvegarder le niveau d'alerte vu — le Dashboard compare avec le niveau actuel
  function markAllRead() {
    if (!username) return;
    const now = new Date();
    const seenKey = `notifs_seen_level__${username}__${now.getFullYear()}_${now.getMonth() + 1}`;
    // Trouver le niveau le plus élevé parmi les notifs affichées
    const levelMap = { attention: 1, urgent: 3, epuise: 4, admin_epuise: 0, facture_j3: 1, facture_j1: 2, facture_retard: 3 };
    const maxLevel = notifs.reduce((max, n) => Math.max(max, levelMap[n.type] ?? 0), 0);
    localStorage.setItem(seenKey, String(maxLevel));
  }

  useEffect(() => { compute(); }, [compute]);

  // Dès que les notifs sont chargées, marquer le niveau comme vu (badge Dashboard = 0)
  useEffect(() => {
    if (!loading) markAllRead();
  }, [loading, notifs]);

  function handleDismiss(id) {
    const updated = notifs.filter(n => n.id !== id);
    setNotifs(updated);
    saveNotifs(username, updated);
  }

  function handleClearAll() {
    setNotifs([]);
    saveNotifs(username, []);
    // Mettre le niveau vu à 4 (max) pour masquer le badge même après clear
    const now = new Date();
    const seenKey = `notifs_seen_level__${username}__${now.getFullYear()}_${now.getMonth() + 1}`;
    localStorage.setItem(seenKey, "4");
  }

  const unread = notifs.length;

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes spin {
          from { transform:rotate(0deg); }
          to   { transform:rotate(360deg); }
        }
        .icon-svg {
          width:20px; height:20px;
          stroke:#4b5563; stroke-width:2;
          stroke-linecap:round; stroke-linejoin:round;
          fill:none; display:inline-block;
          vertical-align:middle; transition:stroke .2s;
        }
        .btn-link-header:hover .icon-svg,
        .sidebar-toggler:hover .icon-svg { stroke:#377CF4; }
        .btn-link-header:hover,
        .sidebar-toggler:hover {
          background:rgba(55,124,244,.08) !important;
          border-radius:10px;
        }
        .adminuiux-header { z-index:1100 !important; }
        .navbar.fixed-top {
          z-index:1050 !important;
          backdrop-filter:blur(12px) !important;
          -webkit-backdrop-filter:blur(12px) !important;
        }
        html, body { min-height:100vh; height:auto !important; }
        .adminuiux-mobile-footer {
          position:fixed !important; bottom:0 !important; left:0 !important;
          right:0 !important; z-index:1050 !important; transform:none !important;
        }
        .notif-page-content {
          max-width:540px; margin:0 auto;
          padding:72px 14px 100px;
        }
        .notif-subheader {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 14px 8px;
          max-width:540px; margin:0 auto;
        }
        .clear-text-btn {
          background:none; border:none; padding:0;
          font-size:11px; color:#9ca3af;
          cursor:pointer; font-weight:500;
          transition:color .2s;
        }
        .clear-text-btn:hover { color:#ef4444; }
        .notif-section-title {
          font-size:11px; font-weight:700; letter-spacing:.6px;
          text-transform:uppercase; color:#9ca3af;
          margin:0;
        }
        .bell-icon-active {
          color:#377CF4;
        }
        .nav-link.notif-active .nav-icon,
        .nav-link.notif-active .nav-text {
          color:#377CF4 !important;
        }
      `}</style>

      {/* ── NAVBAR (identique Dashboard) ── */}
      <header className="adminuiux-header inner-page">
        <nav className="navbar navbar-expand-lg fixed-top">
          <div className="container-fluid">
            <a
              href="/"
              className="btn btn-link btn-square ms-1"
              title="Retour au dashboard"
            >
              <svg className="icon-svg" viewBox="0 0 24 24" style={{ strokeWidth:2.2 }}>
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
            </a>

            <a className="navbar-brand" href="/">
              <img data-bs-img="light" src="assets/img/family-balance-logo.png" alt="" />
              <img data-bs-img="dark"  src="assets/img/family-balance-logo.png" alt="" />
              <div className="lh-20 d-block ms-2">
                <span className="h4">FamilyBalance</span>
                <p className="company-tagline">Gestion budgétaire familiale</p>
              </div>
            </a>

            <div className="ms-auto d-flex align-items-center">
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

              {/* Cloche active — violette, sans badge rouge (on est déjà sur la page) */}
              <a href="/notifications" className="btn btn-link btn-square btn-icon btn-link-header position-relative" title="Notifications"
                style={{ background:"rgba(55,124,244,0.10)", borderRadius:10 }}>
                <svg className="icon-svg" viewBox="0 0 24 24" style={{ stroke:"#377CF4", strokeWidth:2.5 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </a>

              <a href="/login" onClick={handleLogout} className="btn btn-link btn-square btn-icon btn-link-header" title="Déconnexion">
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

      {/* ── SOUS NAVBAR : titre + tout effacer ── */}
      <div className="notif-subheader" style={{ marginTop: 58 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <i className="bi bi-bell-fill" style={{ fontSize:15, color:"#377CF4" }}></i>
          <span className="notif-section-title">
            {loading ? "Analyse en cours…" : unread === 0 ? "Aucune alerte" : `${unread} alerte${unread > 1 ? "s" : ""}`}
          </span>
        </div>
        {unread > 0 && !loading && (
          <button className="clear-text-btn" onClick={handleClearAll}>
            Tout effacer
          </button>
        )}
      </div>

      {/* ── CONTENU ── */}
      <div className="notif-page-content" style={{ paddingTop: 8 }}>

        {/* Loading */}
        {loading && (
          <div style={{ padding:"56px 0", textAlign:"center" }}>
            <div style={{
              width:44, height:44, borderRadius:"50%",
              border:"3px solid rgba(55,124,244,0.15)",
              borderTopColor:"#377CF4",
              animation:"spin 0.8s linear infinite",
              margin:"0 auto 16px",
            }} />
            <p style={{ fontSize:13, margin:0, opacity:.5 }}>Analyse de votre budget en cours…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && unread === 0 && (
          <p style={{
            textAlign:"center", color:"#9ca3af", fontSize:13,
            position:"fixed", top:"50%", left:"50%",
            transform:"translate(-50%, -50%)",
            margin:0, pointerEvents:"none",
          }}>
            Aucune notification
          </p>
        )}

        {/* Liste */}
        {!loading && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {notifs.map(n => (
              <NotifCard key={n.id} notif={n} onDismiss={handleDismiss} />
            ))}
          </div>
        )}

      </div>

      {/* ── BOTTOM TAB BAR (identique Dashboard + Alertes actif) ── */}
      <footer className="adminuiux-mobile-footer style-1">
        <div className="container">
          <ul className="nav nav-pills nav-justified bg-blur">
            <li className="nav-item">
              <a className="nav-link" href="/">
                <span><i className="nav-icon bi bi-house"></i><span className="nav-text">Accueil</span></span>
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/stats-budget">
                <span><i className="nav-icon bi bi-bar-chart-line"></i><span className="nav-text">Stats</span></span>
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/chat">
                <span><i className="nav-icon bi bi-robot"></i><span className="nav-text">IA Chat</span></span>
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/profile">
                <span><i className="nav-icon bi bi-person-circle"></i><span className="nav-text">Profil</span></span>
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </>
  );
}
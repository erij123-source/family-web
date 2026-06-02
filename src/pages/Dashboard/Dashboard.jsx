import { useEffect, useState, useCallback } from "react";

const API = "http://localhost:8080";

// ─── Helper : date dynamique (recalculée à chaque appel) ───────────────────
// FIX #1 : Ne plus utiliser des constantes figées au chargement du module.
// Ces fonctions recalculent la date réelle à chaque appel.
function getNow()          { return new Date(); }
function getCurrentMonth() { return getNow().getMonth() + 1; } // 1-12
function getCurrentYear()  { return getNow().getFullYear(); }

// Nom du mois en français pour l'enregistrement backend
function getMoisNom(date) {
  return date.toLocaleDateString("fr-FR", { month: "long" });
}

// ─── Helper : URL photo de profil ──────────────────────────────────────────
// Simplifié : on utilise uniquement le champ "photo" retourné par le backend
function getProfilePhoto(obj) {
  if (!obj) return null;
  return obj.photo ?? obj.user?.photo ?? null;
}

// ─── Enrichit chaque membre avec sa photo depuis GET /users/{id} ──────────
// Toujours GET /users/{id} = source de vérité unique, sessionStorage = cache court terme
async function enrichMembresWithPhotos(membres) {
  return Promise.all((membres ?? []).map(async (m) => {
    const uId       = m.user?.id ?? m.userId ?? null;
    const uUsername = m.user?.username ?? m.username ?? null;
    let photo = null;

    // Toujours fetch /users/{id} → garantit la photo la plus récente
    if (uId) {
      try {
        const res = await fetch(`${API}/users/${uId}`);
        if (res.ok) {
          const data = await res.json();
          photo = data.photo ?? null;
          if (photo && uUsername) sessionStorage.setItem('photo__' + uUsername, photo);
        }
      } catch (_) {}
    }

    // Fallback : sessionStorage si le fetch échoue
    if (!photo && uUsername) photo = sessionStorage.getItem('photo__' + uUsername) || null;

    return photo ? { ...m, photo, user: m.user ? { ...m.user, photo } : m.user } : m;
  }));
}

// Affiche la photo si disponible, sinon les initiales sur fond dégradé.
function Avatar({ obj, initiales, size = 44, fontSize = 14 }) {
  const [imgError, setImgError] = useState(false);
  const photo = getProfilePhoto(obj);
  if (photo && !imgError) {
    return (
      <img
        src={photo}
        alt={initiales}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          boxShadow: "0 4px 14px rgba(91,127,232,0.35)",
          border: "2px solid rgba(255,255,255,0.15)",
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#377CF4,#2E3F8F)",
      color: "#fff", fontWeight: 800, fontSize,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, letterSpacing: 1,
      boxShadow: "0 4px 14px rgba(91,127,232,0.35)",
    }}>
      {initiales}
    </div>
  );
}

// ─── Helpers date ───────────────────────────────────────────────────────────
/**
 * Filtre un tableau de charges/revenus pour ne garder que ceux du mois en cours.
 * FIX #1 : Utilise getCurrentMonth() et getCurrentYear() dynamiquement.
 */
function filterCurrentMonth(items) {
  if (!Array.isArray(items)) return [];
  const cm = getCurrentMonth();
  const cy = getCurrentYear();
  return items.filter(item => {
    const raw = item.date ?? item.dateCharge ?? item.dateRevenu ?? item.createdAt;
    if (!raw) return false;
    const d = new Date(raw);
    return d.getMonth() + 1 === cm && d.getFullYear() === cy;
  });
}

/** Somme un tableau sur un champ montant */
function sumAmount(items) {
  return items.reduce((s, i) => s + (i.amount ?? i.montant ?? 0), 0);
}

// ─── Modal de modification de budget ───────────────────────────────────────
function BudgetModal({ membre, onClose, onSaved, compteId,
                      memberSpend = 0, otherBudgetsTotal = 0, totalRevenus = 0 }) {
  const [value, setValue] = useState(membre.budget ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  // ── Reste à vivre courant = ancien budget − dépenses ─────────────────
  // S'il est positif, le BACKEND le transfère automatiquement dans
  // `carryoverBudget` lors du PUT /admins/set-budget. Côté UI on ne fait
  // qu'afficher l'info — on n'ajoute PAS le reste à la valeur envoyée.
  const reste = Math.max(0, (Number(membre.budget) || 0) - memberSpend);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const next = Number(value) || 0;

    // ── Règles métier admin : alignées sur la page Famille du web Angular ──
    // La somme des budgets ne peut pas dépasser le total des revenus.
    if (totalRevenus > 0 && (otherBudgetsTotal + next) > totalRevenus + 0.0001) {
      const dispo = Math.max(0, totalRevenus - otherBudgetsTotal);
      setError(`⚠️ Plafond atteint : la somme des budgets dépasserait les revenus ` +
               `(${totalRevenus.toFixed(2)} DT). Disponible pour ce membre : ${dispo.toFixed(2)} DT.`);
      setSaving(false);
      return;
    }

    try {
      // Le backend transfère automatiquement le reste à vivre courant
      // dans carryoverBudget — on envoie juste la valeur saisie.
      const res = await fetch(
        `${API}/admins/set-budget/${membre.id}?budget=${next}`,
        { method: "PUT" }
      );
      if (!res.ok) {
        let msg = "⚠️ Le budget dépasse le montant disponible.";
        try {
          const json = await res.json();
          if (json.message) msg = "⚠️ " + json.message;
        } catch (_) {}
        setError(msg);
        return;
      }

      // 2. Créer un revenu mensuel de distribution pour StatsBudget.
      // FIX #2A + #2B + #3 :
      //   - On vérifie l'année ET le mois pour éviter d'écraser l'historique.
      //   - On ne met JAMAIS à jour (PUT) un enregistrement existant du même mois :
      //     on crée toujours un nouvel enregistrement (nouvelle redistribution).
      //   - On inclut mois, annee, moisNom dans le payload pour le filtrage StatsBudget.
      if (compteId && Number(value) > 0) {
        try {
          const now = getNow(); // FIX #1 : date dynamique
          const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString().split("T")[0];

          // FIX #3 : Payload enrichi avec mois, annee, moisNom pour que StatsBudget
          // puisse filtrer correctement par mois/année sans ambiguïté.
          const payload = {
            montant:      Number(value),
            amount:       Number(value),
            type:         "DISTRIBUTION_BUDGET",
            description:  `Budget distribué - ${membre.prenom ?? ""} ${membre.nom ?? ""}`.trim(),
            perceptionDate: firstOfMonth,
            // Champs explicites pour filtrage StatsBudget
            mois:    now.getMonth() + 1,           // ex: 5 pour mai
            annee:   now.getFullYear(),             // ex: 2026
            moisNom: getMoisNom(now),               // ex: "mai"
            compteId,
            membreId: membre.id,
          };

          // FIX #2B : On crée TOUJOURS un nouveau revenu de distribution (POST).
          // On ne cherche plus un existant pour le mettre à jour (PUT).
          // Chaque redistribution dans le même mois crée une nouvelle entrée,
          // préservant ainsi l'historique complet.
          await fetch(`${API}/revenus`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

        } catch (distErr) {
          // Non bloquant : le budget est déjà enregistré sur le membre
          console.warn("Distribution budget : erreur création revenu mensuel", distErr);
        }
      }

      // Backend a stocké : budget = next (saisie) + carryoverBudget = reste
      // (le reste à vivre courant transféré automatiquement). On remonte
      // les deux pour que le state local reflète immédiatement la pill
      // "Budget total = next + reste" et la sous-pill "+ reste DT report".
      onSaved(membre.id, next, reste);
      onClose();
    } catch {
      setError("⚠️ Erreur de connexion, veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
      pointerEvents: "none",
    }} onClick={onClose}>
      <div style={{
        background: "#1c2547", borderRadius: "20px",
        padding: "24px", width: "100%", maxWidth: "340px",
        boxShadow: "0 8px 40px rgba(55,124,244,0.28), 0 2px 12px rgba(0,0,0,0.40)",
        border: "1px solid rgba(107,111,212,0.35)",
        pointerEvents: "all",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <Avatar
            obj={membre}
            initiales={`${(membre.prenom ?? "?")[0]}${(membre.nom ?? "?")[0]}`.toUpperCase()}
            size={40}
            fontSize={14}
          />
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:15, color:"#fff" }}>
              {membre.prenom} {membre.nom}
            </p>
            <p style={{ margin:0, fontSize:11, color:"rgba(255,255,255,0.5)" }}>Modifier le budget</p>
          </div>
          <button onClick={onClose} style={{
            marginLeft:"auto", background:"none", border:"none",
            fontSize:18, color:"rgba(255,255,255,0.5)", cursor:"pointer", lineHeight:1,
          }}>✕</button>
        </div>

        {/* Input */}
        <label style={{ fontSize:12, color:"rgba(255,255,255,0.55)", display:"block", marginBottom:6 }}>
          Nouveau budget (DT)
        </label>
        <div style={{ position:"relative", marginBottom:16 }}>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            style={{
              width:"100%", borderRadius:12,
              border:"2px solid rgba(91,127,232,0.4)", padding:"10px 40px 10px 14px",
              fontSize:16, fontWeight:700, background:"rgba(30,45,94,0.7)",
              color:"#fff",
              transition:"border-color .2s",
            }}
            onFocus={e => e.target.style.borderColor = "#2E3F8F"}
            onBlur={e => e.target.style.borderColor = "rgba(91,127,232,0.4)"}
          />
          <span style={{
            position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
            fontSize:12, color:"rgba(255,255,255,0.4)", pointerEvents:"none",
          }}>DT</span>
        </div>

        {reste > 0 && (
          <p style={{
            margin:"-6px 0 12px", padding:"8px 10px",
            background:"rgba(34,197,94,0.14)", borderRadius:10,
            fontSize:11.5, color:"#86efac", lineHeight:1.4,
          }}>
            <i className="bi bi-arrow-down-circle" style={{ marginRight:6 }}></i>
            Reste à vivre courant : <strong>+{reste.toFixed(0)} DT</strong> sera
            transféré en report du mois et s'ajoutera au nouveau budget.
            <br/>
            <span style={{ opacity:0.85 }}>
              Budget total après modification : <strong>{((Number(value) || 0) + reste).toFixed(0)} DT</strong>
            </span>
          </p>
        )}

        {error && <p style={{ color:"#dc2626", fontSize:12, marginBottom:12 }}>{error}</p>}

        {/* Actions */}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{
            flex:1, padding:"10px", borderRadius:12,
            border:"1.5px solid rgba(91,127,232,0.35)", background:"rgba(30,45,94,0.5)",
            fontSize:13, fontWeight:600, cursor:"pointer", color:"rgba(255,255,255,0.75)",
          }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            flex:2, padding:"10px", borderRadius:12, border:"none",
            background:"linear-gradient(135deg,#377CF4,#2E3F8F)",
            color:"#fff", fontSize:13, fontWeight:700,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Sauvegarde…" : "✓ Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ligne d'un membre (admin view) ────────────────────────────────────────
function MembreRow({ membre, onBudgetSaved, isOwnRow, onCarryoverApplied, compteId,
                    totalRevenus = 0, otherBudgetsTotal = 0 }) {
  const [chargesMois,       setChargesMois]       = useState(null);
  const [revenuMois,        setRevenuMois]        = useState(null);
  const [revenuAnnuel,      setRevenuAnnuel]      = useState(null);
  const [chargeAnnuelle,    setChargeAnnuelle]    = useState(null);
  const [facturesMoisRow,   setFacturesMoisRow]   = useState(null);
  const [facturesAnneeRow,  setFacturesAnneeRow]  = useState(null);

  const [modalOpen,    setModalOpen]    = useState(false);

  // ── Validation budget : ignorer si distribué un autre mois (dynamique) ──
  const now0 = getNow();
  const budgetValide =
    membre.budgetMois  !== null && membre.budgetMois  !== undefined &&
    membre.budgetAnnee !== null && membre.budgetAnnee !== undefined &&
    membre.budgetMois  === now0.getMonth() + 1 &&
    membre.budgetAnnee === now0.getFullYear();
  const [localBudget,  setLocalBudget]  = useState(budgetValide ? (membre.budget ?? 0) : 0);

  const [carryover,    setCarryover]    = useState(null);
  const [carryApplied, setCarryApplied] = useState(false);
  const [carryLoading, setCarryLoading] = useState(false);
  const [carryError,   setCarryError]   = useState(null);

  const [expanded,   setExpanded]   = useState(false);
  const [periodRev,  setPeriodRev]  = useState("mois");
  const [periodDep,  setPeriodDep]  = useState("mois");

  useEffect(() => {
    async function loadData() {
      try {
        const resMois = await fetch(`${API}/revenus/membre/${membre.id}/total/mois`);
        if (resMois.ok) {
          const val = await resMois.json();
          setRevenuMois(Math.max(0, val ?? 0));
        }

        const resAnnee = await fetch(`${API}/revenus/membre/${membre.id}/total/annee`);
        if (resAnnee.ok) {
          const val = await resAnnee.json();
          setRevenuAnnuel(Math.max(0, val ?? 0));
        }

        // ── CHARGES du mois : on utilise /total/mois qui filtre désormais
        // par paymentDate côté backend (cash sorti effectivement ce mois).
        // Une charge avec chargeDate=août / paymentDate=mai compte en mai.
        const resChargesMois = await fetch(`${API}/charges/membre/${membre.id}/total/mois`).catch(() => null);
        if (resChargesMois?.ok) {
          const val = await resChargesMois.json();
          setChargesMois(Math.max(0, val ?? 0));
        }
        // Annuel : on filtre la liste complète sur paymentDate (fallback
        // chargeDate pour les anciennes lignes sans paymentDate).
        const resChargesAll = await fetch(`${API}/charges/membre/${membre.id}`).catch(() => null);
        if (resChargesAll?.ok) {
          const allCharges = await resChargesAll.json() ?? [];
          const cy = getNow().getFullYear();
          const totalAnnee = allCharges
            .filter(c => {
              const d = c.paymentDate ?? c.chargeDate ?? c.date ?? c.createdAt;
              return d && new Date(d).getFullYear() === cy;
            })
            .reduce((s, c) => s + (c.amount ?? 0), 0);
          setChargeAnnuelle(Math.max(0, totalAnnee));
        }

        const resFacturesMois = await fetch(`${API}/factures/membre/${membre.id}/total/mois`);
        if (resFacturesMois.ok) {
          const val = await resFacturesMois.json();
          setFacturesMoisRow(Math.max(0, val ?? 0));
        }

        const resFacturesAnnee = await fetch(`${API}/factures/membre/${membre.id}/total/annee`);
        if (resFacturesAnnee.ok) {
          const val = await resFacturesAnnee.json();
          setFacturesAnneeRow(Math.max(0, val ?? 0));
        }
      } catch (_) {}
    }

    loadData();

    // ── Recharger quand une charge ou facture est ajoutée/modifiée/supprimée
    window.addEventListener('dashboard-refresh', loadData);
    return () => window.removeEventListener('dashboard-refresh', loadData);
  }, [membre.id]);

  // FIX #6 : Vérifier que le carryoverBudget appartient bien au mois en cours.
  // Le backend Spring sérialise les champs en `carryoverMois` / `carryoverAnnee`
  // (cf. Membre.java). On garde aussi le fallback `carryoverMonth/Year` au cas
  // où un ancien endpoint exposerait les champs sous ces noms.
  const now = getNow();
  const carryoverFromBase = (() => {
    const raw = membre.carryoverBudget ?? 0;
    const cMois  = membre.carryoverMois  ?? membre.carryoverMonth;
    const cAnnee = membre.carryoverAnnee ?? membre.carryoverYear;
    if (cMois !== undefined && cAnnee !== undefined) {
      const isCurrentMonth =
        cMois  === now.getMonth() + 1 &&
        cAnnee === now.getFullYear();
      return isCurrentMonth ? raw : 0;
    }
    // Pas de champ mois/année → on utilise la valeur telle quelle
    return raw;
  })();

  // ── Validation budget : ignorer si distribué un autre mois ──────────────
  const budgetCeMois = (() => {
    if (
      membre.budgetMois  !== null && membre.budgetMois  !== undefined &&
      membre.budgetAnnee !== null && membre.budgetAnnee !== undefined
    ) {
      return membre.budgetMois  === now.getMonth() + 1 &&
             membre.budgetAnnee === now.getFullYear()
        ? localBudget
        : 0;
    }
    // Pas de champ → compatibilité anciens membres, on affiche tel quel
    return localBudget;
  })();

  // Le carryoverBudget est désormais le reste à vivre TRANSFÉRÉ par le
  // backend lors de la dernière modification du budget par l'admin (cf.
  // AdminServiceImpl.setBudget). Il est donc systématiquement inclus dans
  // le budget total disponible — l'ancien gating `carryApplied` n'est
  // plus pertinent car il s'agit d'un report déjà acquis, pas d'un
  // surplus en attente.
  const budgetTotal = budgetCeMois + carryoverFromBase;

  const depensesMois = chargesMois !== null && facturesMoisRow !== null
    ? chargesMois + facturesMoisRow
    : chargesMois ?? null;
  const resteAVivre = depensesMois !== null ? Math.max(0, budgetTotal - depensesMois) : null;

  // Appliquer le report du mois dernier via l'API
  async function handleApplyCarryover(e) {
    e.stopPropagation();
    setCarryLoading(true);
    setCarryError(null);
    try {
      const res = await fetch(`${API}/membres/apply-carryover/${membre.id}`, { method: "PUT" });
      if (!res.ok) throw new Error("Échec");
      const data = await res.json();
      const carry = data?.carryoverAmount ?? data?.montantReport ?? data ?? 0;
      const carryNum = Math.max(0, Number(carry));
      setCarryover(carryNum);
      setCarryApplied(true);
      if (onCarryoverApplied) onCarryoverApplied(carryNum);
    } catch {
      setCarryError("Erreur report");
    } finally {
      setCarryLoading(false);
    }
  }

  const fmt = (n) =>
    n === null || n === undefined
      ? "..."
      : Number(n).toLocaleString("fr-TN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const ralColor = resteAVivre === null
    ? "#6b7280"
    : resteAVivre <= 0
      ? "#dc2626"
      : resteAVivre < budgetCeMois * 0.2
        ? "#d97706"
        : "#16a34a";

  const roleBadgeStyle = {
    GESTIONNAIRE:   { bg: "rgba(91,127,232,0.12)", color: "#377CF4" },
    CONSULTANT:     { bg: "rgba(16,185,129,0.12)", color: "#059669" },
    ADMINISTRATEUR: { bg: "rgba(245,158,11,0.12)", color: "#d97706" },
  };
  const roleStyle = roleBadgeStyle[membre.role] ?? { bg: "rgba(100,116,139,0.10)", color: "#64748b" };

  function handleSaved(id, newBudget, newCarryover = null) {
    setLocalBudget(newBudget);
    if (newCarryover !== null) setCarryover(newCarryover);
    onBudgetSaved && onBudgetSaved(id, newBudget, newCarryover);
  }

  // FIX #7 : La barre de progression inclut maintenant charges + factures
  // pour être cohérente avec l'affichage du "Reste à vivre".
  const pct = budgetTotal > 0 && depensesMois !== null
    ? Math.min(100, Math.round((depensesMois / budgetTotal) * 100))
    : 0;

  const prenom = membre.prenom ?? membre.user?.prenom ?? membre.user?.firstName ?? "";
  const nom    = membre.nom    ?? membre.user?.nom    ?? membre.user?.lastName  ?? "";
  const fullName = `${prenom} ${nom}`.trim() || membre.user?.username || "Membre";
  const initiales2 = `${(prenom || "?")[0]}${(nom || "?")[0]}`.toUpperCase();

  // FIX #1 : Utiliser getCurrentYear() dynamiquement
  const currentYear = getCurrentYear();

  return (
    <>
      {modalOpen && (
        <BudgetModal
          membre={{ ...membre, prenom, nom, budget: localBudget }}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          compteId={compteId}
          // Dépenses du mois courant = charges payées + factures payées.
          memberSpend={(chargesMois || 0) + (facturesMoisRow || 0)}
          totalRevenus={totalRevenus}
          otherBudgetsTotal={otherBudgetsTotal}
        />
      )}
      <div style={{
        background: "#ffffff",
        borderRadius: "16px",
        padding: "13px 14px",
        border: "1px solid rgba(91,127,232,0.18)",
        boxShadow: "0 2px 16px rgba(91,127,232,0.10), 0 1px 4px rgba(0,0,0,0.06)",
        transition: "box-shadow .2s ease, transform .2s ease",
      }}>
        {/* Ligne principale */}
        <div
          style={{ display:"flex", alignItems:"center", gap:14, cursor: isOwnRow ? "default" : "pointer" }}
          onClick={() => { if (!isOwnRow) setExpanded(v => !v); }}
        >

          {/* Avatar */}
          <Avatar obj={membre} initiales={initiales2} size={44} fontSize={14} />

          {/* Nom + rôle */}
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{
              margin:0, fontWeight:700, fontSize:14,
              lineHeight:1.3, whiteSpace:"nowrap",
              overflow:"hidden", textOverflow:"ellipsis",
              color: "#1e293b",
            }}>
              {fullName}
            </p>
            <span style={{
              background: roleStyle.bg, color: roleStyle.color,
              borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:600,
              display:"inline-block", marginTop:2,
            }}>
              {membre.role ?? "—"}
            </span>
          </div>

          {/* Budget + flèche */}
          <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}
               onClick={e => e.stopPropagation()}>

            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }}>
              <button
                onClick={() => setModalOpen(true)}
                title="Modifier le budget"
                style={{
                  background:"linear-gradient(135deg,#377CF4,#2E3F8F)",
                  color:"#fff", border:"none", borderRadius:11,
                  padding:"5px 10px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:5,
                  boxShadow:"0 2px 8px rgba(91,127,232,0.35)",
                  whiteSpace:"nowrap",
                }}
              >
                <i className="bi bi-wallet2" style={{ fontSize:12 }}></i>
                <span style={{ fontSize:12, fontWeight:800 }}>
                  {budgetCeMois === 0 && localBudget > 0
                    ? <span style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>Non distribué</span>
                    : <>{fmt(budgetCeMois)} DT</>
                  }
                </span>
              </button>

              <span
                onClick={!carryApplied ? handleApplyCarryover : undefined}
                title={carryApplied ? `Report appliqué : +${fmt(carryover)} DT` : "Cliquer pour appliquer le report du mois dernier"}
                style={{
                  fontSize:9, fontWeight:600, cursor: carryApplied ? "default" : "pointer",
                  color: carryApplied ? "#059669" : "#325DC1",
                  display:"flex", alignItems:"center", gap:2,
                  paddingLeft:2, lineHeight:1,
                  opacity: carryLoading ? 0.5 : 1,
                }}
              >
                <i className="bi bi-plus-lg" style={{ fontSize:8 }}></i>
                {carryLoading ? "..." : `${fmt(carryoverFromBase ?? carryover ?? 0)} DT report`}
              </span>
            </div>

            {/* Séparateur */}
            <div style={{ width:1, height:30, background:"rgba(91,127,232,0.15)", flexShrink:0 }} />

            {/* Reste à vivre */}
            <div style={{
                display:"flex", flexDirection:"column", alignItems:"center",
                background: resteAVivre === null
                  ? "rgba(100,116,139,0.08)"
                  : resteAVivre <= 0
                    ? "rgba(220,38,38,0.08)"
                    : resteAVivre < budgetCeMois * 0.2
                      ? "rgba(217,119,6,0.08)"
                      : "rgba(22,163,74,0.08)",
                borderRadius:11, padding:"5px 10px", minWidth:60,
                border: resteAVivre === null ? "1px solid rgba(100,116,139,0.15)"
                  : resteAVivre <= 0 ? "1px solid rgba(220,38,38,0.18)"
                  : resteAVivre < budgetCeMois * 0.2 ? "1px solid rgba(217,119,6,0.18)"
                  : "1px solid rgba(22,163,74,0.18)",
              }}>
                <span style={{ fontSize:9, color:"#64748b", fontWeight:600 }}>Reste à vivre</span>
                <span style={{ fontSize:12, fontWeight:800, color:ralColor }}>
                  {fmt(resteAVivre)} DT
                </span>
              </div>

            {/* Flèche — uniquement si pas la propre ligne de l'admin */}
            {!isOwnRow && (
              <div
                onClick={() => setExpanded(v => !v)}
                style={{
                  cursor:"pointer", padding:"4px 2px",
                  color:"#94a3b8", transition:"transform .2s",
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  display:"flex", alignItems:"center",
                }}
              >
                <i className="bi bi-chevron-down" style={{ fontSize:13 }}></i>
              </div>
            )}

          </div>
        </div>

        {/* ── Section expansible : revenus + dépenses ── */}
        {!isOwnRow && expanded && (
          <div style={{
            display:"grid", gridTemplateColumns:"1fr 1fr", gap:8,
            marginTop:10, paddingTop:10,
            borderTop:"1px solid rgba(91,127,232,0.12)",
          }}>

            {/* Bloc Revenus — vert */}
            <div style={{
              background:"rgba(22,163,74,0.07)", borderRadius:12,
              padding:"10px 12px",
              border:"1px solid rgba(22,163,74,0.15)",
            }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <i className="bi bi-arrow-down-left" style={{ fontSize:11, color:"#16a34a" }}></i>
                  <span style={{ fontSize:10, fontWeight:600, color:"#15803d" }}>Revenus</span>
                </div>
                <button
                  onClick={() => setPeriodRev(p => p === "mois" ? "annee" : "mois")}
                  title="Changer la période"
                  style={{
                    background:"rgba(22,163,74,0.15)", border:"none", borderRadius:6,
                    padding:"2px 7px", cursor:"pointer", fontSize:9,
                    color:"#15803d", fontWeight:700, display:"flex", alignItems:"center", gap:3,
                  }}
                >
                  <i className="bi bi-caret-up-fill" style={{ fontSize:7 }}></i>
                  {periodRev === "mois" ? "mois" : `${currentYear}`}
                </button>
              </div>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#15803d" }}>
                {periodRev === "mois" ? fmt(revenuMois) : fmt(revenuAnnuel)}&nbsp;
                <span style={{ fontSize:10, fontWeight:500, opacity:0.7 }}>DT</span>
              </p>
              <p style={{ margin:0, fontSize:9, color:"#94a3b8", marginTop:2 }}>
                {periodRev === "mois" ? `ce mois · ${getNow().toLocaleDateString("fr-FR",{month:"long"})}` : `cette année ${currentYear}`}
              </p>
            </div>

            {/* Bloc Dépenses — rouge */}
            <div style={{
              background:"rgba(220,38,38,0.07)", borderRadius:12,
              padding:"10px 12px",
              border:"1px solid rgba(220,38,38,0.15)",
            }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <i className="bi bi-arrow-up-right" style={{ fontSize:11, color:"#dc2626" }}></i>
                  <span style={{ fontSize:10, fontWeight:600, color:"#dc2626" }}>Dépenses</span>
                </div>
                <button
                  onClick={() => setPeriodDep(p => p === "mois" ? "annee" : "mois")}
                  title="Changer la période"
                  style={{
                    background:"rgba(220,38,38,0.15)", border:"none", borderRadius:6,
                    padding:"2px 7px", cursor:"pointer", fontSize:9,
                    color:"#dc2626", fontWeight:700, display:"flex", alignItems:"center", gap:3,
                  }}
                >
                  <i className="bi bi-caret-up-fill" style={{ fontSize:7 }}></i>
                  {periodDep === "mois" ? "mois" : `${currentYear}`}
                </button>
              </div>
              <p style={{ margin:0, fontSize:16, fontWeight:800, color:"#dc2626" }}>
                {periodDep === "mois"
                  ? fmt((chargesMois ?? 0) + (facturesMoisRow ?? 0))
                  : fmt((chargeAnnuelle ?? 0) + (facturesAnneeRow ?? 0))}&nbsp;
                <span style={{ fontSize:10, fontWeight:500, opacity:0.7 }}>DT</span>
              </p>
              <p style={{ margin:0, fontSize:9, color:"#94a3b8", marginTop:2 }}>
                {periodDep === "mois" ? `ce mois · ${getNow().toLocaleDateString("fr-FR",{month:"long"})}` : `cette année ${currentYear}`}
              </p>
            </div>

          </div>
        )}

      </div>
    </>
  );
}

// ─── Donut Budget Chart ─────────────────────────────────────────────────────
function DonutBudgetChart({ totalRevenu, budgetDistribue, budgetRestant }) {
  const rev  = totalRevenu    ?? 0;
  const dist = budgetDistribue ?? 0;
  const rest = budgetRestant   ?? 0;

  const base         = rev > 0 ? rev : 1;
  const pctDistribue = Math.min(100, Math.round((dist / base) * 100));
  const pctRestant   = Math.min(100, Math.round((rest / base) * 100));
  const pctRevenu    = Math.max(0, 100 - pctDistribue - pctRestant);

  const fmt = (n) =>
    n === null || n === undefined ? "..."
      : Number(n).toLocaleString("fr-TN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const R      = 52;
  const STROKE = 18;
  const CIRC   = 2 * Math.PI * R;
  const GAP_PX = 4;

  const segs = [
    { key: "revenu",    pct: 100,          label: "Revenu",    value: rev,
      c1: "#00e5c0", c2: "#00c896", glow: "rgba(0,229,192,0.7)"  },
  ];

  let cumLen = 0;
  const built = segs.map(seg => {
    const rawLen  = (seg.pct / 100) * CIRC;
    const arcLen  = Math.max(0, rawLen - GAP_PX);
    const dashOff = -(cumLen + GAP_PX / 2);
    cumLen += rawLen;
    const midFrac  = (cumLen - rawLen / 2) / CIRC;
    const midAngle = midFrac * 2 * Math.PI - Math.PI / 2;
    return { ...seg, arcLen, dashOff, midAngle };
  });

  const LPAD  = 44;
  const RPAD  = 44;
  const VPAD  = 14;
  const CW    = (R + STROKE / 2) * 2 + LPAD + RPAD;
  const CH    = (R + STROKE / 2) * 2 + VPAD * 2;
  const OX    = LPAD + R + STROKE / 2;
  const OY    = CH / 2;
  const LBLR  = R + STROKE / 2 + 16;

  return (
    <div style={{
      background: "linear-gradient(135deg, #1c2547 0%, #2a3670 55%, #377CF4 100%)",
      borderRadius: 18,
      padding: "10px 10px 8px 10px",
      marginBottom: 14,
      boxShadow: "0 0 0 1px rgba(91,127,232,0.25), 0 0 24px rgba(55,124,244,0.15), 0 8px 24px rgba(0,0,0,0.5)",
    }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: 0.3 }}>
          Répartition Budget
        </span>
        <span style={{
          background: "rgba(255,255,255,0.08)", borderRadius: 20,
          padding: "2px 8px", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.55)",
        }}>ce mois</span>
      </div>

      {/* Donut + Legend row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, paddingLeft: 30 }}>

        {/* SVG */}
        <div style={{ flexShrink: 0 }}>
          <svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`} style={{ display: "block", overflow: "visible" }}>
            <defs>
              {built.map(s => (
                <linearGradient key={s.key} id={`dg-${s.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor={s.c1} />
                  <stop offset="100%" stopColor={s.c2} />
                </linearGradient>
              ))}
              {built.map(s => (
                <filter key={`df-${s.key}`} id={`df-${s.key}`} x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feFlood floodColor={s.glow} result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="g" />
                  <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              ))}
            </defs>

            {/* Track */}
            <circle cx={OX} cy={OY} r={R} fill="none"
              stroke="rgba(255,255,255,0.05)" strokeWidth={STROKE} />

            {/* Segments */}
            {built.map(s => s.pct > 0 && (
              <circle key={s.key} cx={OX} cy={OY} r={R}
                fill="none"
                stroke={`url(#dg-${s.key})`}
                strokeWidth={STROKE}
                strokeLinecap="butt"
                strokeDasharray={`${s.arcLen} ${CIRC}`}
                strokeDashoffset={s.dashOff}
                transform={`rotate(-90 ${OX} ${OY})`}
                filter={`url(#df-${s.key})`}
              />
            ))}

            {/* Outside percentage labels */}
            {built.map(s => {
              if (s.pct < 4) return null;
              const lx     = OX + LBLR * Math.cos(s.midAngle);
              const ly     = OY + LBLR * Math.sin(s.midAngle);
              const anchor = lx < OX - 5 ? "end" : lx > OX + 5 ? "start" : "middle";
              const col = s.c1;
              return (
                <text key={`pct-${s.key}`} x={lx} y={ly}
                  textAnchor={anchor} dominantBaseline="central"
                  style={{ fontSize: 13, fontWeight: 800, fill: col,
                           filter: `drop-shadow(0 0 4px ${s.glow})`,
                           pointerEvents: "none" }}>
                  {s.pct}%
                </text>
              );
            })}
          </svg>
        </div>

        {/* Legend cards */}
        <div style={{ width: 110, flexShrink: 0, display: "flex", flexDirection: "column", gap: 5, marginLeft: 28 }}>
          {built.map(s => (
            <div key={s.key} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 8px", borderRadius: 9,
              background: "rgba(91,127,232,0.08)",
              border: "1px solid rgba(107,111,212,0.20)",
              boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04)`,
            }}>
              <div style={{
                width: 6, height: 24, borderRadius: 3, flexShrink: 0,
                background: `linear-gradient(180deg, ${s.c1}, ${s.c2})`,
                boxShadow: `0 0 8px ${s.glow}`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.50)", lineHeight: 1.2 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", lineHeight: 1.3, whiteSpace: "nowrap" }}>
                  {fmt(s.value)}
                  <span style={{ fontSize: 8, fontWeight: 500, opacity: 0.6, marginLeft: 3 }}>DT</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ marginTop: 7, background: "rgba(255,255,255,0.07)", borderRadius: 10, height: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 10,
          background: "linear-gradient(90deg,#377CF4,#325DC1,#2E3F8F)",
          width: rev > 0 ? `${Math.min(100, Math.round(((dist + rest) / rev) * 100))}%` : "0%",
          transition: "width 1.2s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Budget Stats Bar ────────────────────────────────────────────────────────
function BudgetStatsBar({ budgetDistribue, budgetRestant, totalRevenu }) {
  const dist = budgetDistribue ?? 0;
  const rest = budgetRestant   ?? 0;
  const base = totalRevenu > 0 ? totalRevenu : 1;

  const pctDist = Math.min(100, Math.round((dist / base) * 100));
  const pctRest = Math.min(100, Math.round((rest / base) * 100));

  const fmt = (n) =>
    n === null || n === undefined ? "..."
      : Number(n).toLocaleString("fr-TN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  function MiniDonut({ pct, c1, c2, glow, pctColor }) {
    const R = 22, SW = 6;
    const CIRC = 2 * Math.PI * R;
    const arcLen = (pct / 100) * CIRC;
    return (
      <svg width={54} height={54} viewBox="0 0 54 54" style={{ display: "block", flexShrink: 0 }}>
        <defs>
          <linearGradient id={`bsb-g-${c1.replace('#','')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
          <filter id={`bsb-f-${c1.replace('#','')}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={glow} floodOpacity="0.5" />
          </filter>
        </defs>
        <circle cx="27" cy="27" r={R} fill="none"
          stroke="rgba(91,127,232,0.15)" strokeWidth={SW} />
        <circle cx="27" cy="27" r={R} fill="none"
          stroke={`url(#bsb-g-${c1.replace('#','')})`}
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${CIRC}`}
          strokeDashoffset="0"
          transform="rotate(-90 27 27)"
        />
        <text x="27" y="27" textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 9, fontWeight: 800, fill: c1, pointerEvents: "none" }}>
          {pct}%
        </text>
      </svg>
    );
  }

  const sections = [
    {
      key: "dist",
      label: "Budget Distribué",
      value: dist,
      pct: pctDist,
      c1: "#377CF4", c2: "#325DC1",
      glow: "rgba(91,127,232,0.6)",
      pctColor: "#a3bbf5",
    },
    {
      key: "rest",
      label: "Budget Restant",
      value: rest,
      pct: pctRest,
      c1: "#325DC1", c2: "#2E3F8F",
      glow: "rgba(123,93,184,0.6)",
      pctColor: "#c0b2f0",
    },
  ];

  return (
    <div style={{
      padding: "10px 4px 14px 4px",
      display: "flex",
      alignItems: "center",
      background: "transparent",
    }}>
      {sections.map((s) => (
          <div key={s.key} style={{
            flex: 1,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "6px 8px",
          }}>
            <MiniDonut pct={s.pct} c1={s.c1} c2={s.c2} glow={s.glow} pctColor={s.pctColor} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#64748b", letterSpacing: 0.3 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#1e293b", lineHeight: 1.1, letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>
                {fmt(s.value)}
                <span style={{ fontSize: 10, fontWeight: 600, color:"#94a3b8", marginLeft: 4 }}>DT</span>
              </div>
            </div>
          </div>
      ))}
    </div>
  );
}

// ─── Composant principal ────────────────────────────────────────────────────
export default function Dashboard() {
  const [statsOpen,    setStatsOpen]    = useState(false);
  const [isDark,       setIsDark]       = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.setAttribute("data-bs-theme", "dark");
      root.classList.add("dark-mode");
      root.classList.remove("light-mode");
    } else {
      root.setAttribute("data-bs-theme", "light");
      root.classList.remove("dark-mode");
      root.classList.add("light-mode");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const [familleNom,   setFamilleNom]   = useState("...");
  const [totalRevenus, setTotalRevenus] = useState(null);
  const [revenuAnnuel, setRevenuAnnuel] = useState(null);
  const [budget,       setBudget]       = useState(null);
  const [resteAVivre,  setResteAVivre]  = useState(null);
  const [pctBudget,    setPctBudget]    = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [depenses,     setDepenses]     = useState(null);
  const [depensesAnnuelles, setDepensesAnnuelles] = useState(null);
  const [facturesMois,      setFacturesMois]      = useState(null);
  const [facturesAnnuelles, setFacturesAnnuelles] = useState(null);

  const [periodRevDash, setPeriodRevDash] = useState("mois");
  const [periodDepDash, setPeriodDepDash] = useState("mois");

  const [currentMembreId, setCurrentMembreId] = useState(null);
  const [carryoverDash,    setCarryoverDash]    = useState(null);

  const [isAdmin,  setIsAdmin]  = useState(false);
  const [membres,  setMembres]  = useState([]);
  const [currentMembreObj, setCurrentMembreObj] = useState(null);
  const [currentUserFullName, setCurrentUserFullName] = useState("");
  const [notifCount, setNotifCount] = useState(0);

  const [familleId,              setFamilleId]              = useState(null);
  const [totalRevenusFamille,    setTotalRevenusFamille]    = useState(null);
  // Report de revenu non distribué hérité du mois précédent (serveur). Avec
  // les revenus DU MOIS (totalRevenusFamille) il forme le pool distribuable.
  // Le "budget restant" (balanceRestante) est calculé côté serveur et persiste
  // d'un mois à l'autre via ce report ; le revenu, lui, repart de 0.
  const [carryoverRevenuFamille, setCarryoverRevenuFamille] = useState(null);
  const [budgetDistribueFamille, setBudgetDistribueFamille] = useState(null);
  const [balanceRestante,        setBalanceRestante]        = useState(null);
  const [totalChargesFamille,    setTotalChargesFamille]    = useState(null);
  const [totalFacturesFamille,   setTotalFacturesFamille]   = useState(null);
  const [compteIdFamille,        setCompteIdFamille]        = useState(null);

  const username = sessionStorage.getItem("username") ?? "";

  useEffect(() => {
    if (sessionStorage.getItem("statsMenuOpen") === "true") setStatsOpen(true);
    if (window.feather) window.feather.replace();
  }, []);

  useEffect(() => { if (window.feather) window.feather.replace(); });

  // FIX #5 : Vérification au démarrage si c'est le 1er du mois → remise à 0 automatique.
  // On stocke le dernier mois connu dans localStorage pour détecter le changement.
  useEffect(() => {
    const now = getNow();
    const currentMonthKey = `${now.getFullYear()}_${now.getMonth() + 1}`;
    const lastKnownMonth  = localStorage.getItem("last_known_month");

    if (lastKnownMonth && lastKnownMonth !== currentMonthKey) {
      // Nouveau mois détecté → signaler au backend pour remise à 0 des budgets
      // et créer de nouvelles entrées mensuelles. Le frontend ne fait que déclencher.
      console.info(`[Dashboard] Nouveau mois détecté : ${currentMonthKey}. Remise à 0 des budgets.`);
      fetch(`${API}/admins/reset-budgets-new-month`, { method: "POST" })
        .catch(() => {}); // non bloquant
    }
    localStorage.setItem("last_known_month", currentMonthKey);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      if (!username) { setLoading(false); return; }

      const usersRes = await fetch(`${API}/users`);
      if (!usersRes.ok) { setLoading(false); return; }
      const users = await usersRes.json();
      const currentUser = users.find(u => u.username === username);
      if (!currentUser?.id) { setLoading(false); return; }
      const userId = currentUser.id;

      const userPrenom = currentUser.prenom ?? currentUser.firstName ?? currentUser.first_name ?? "";
      const userNom    = currentUser.nom    ?? currentUser.lastName  ?? currentUser.last_name  ?? "";
      const fullName   = `${userPrenom} ${userNom}`.trim() || currentUser.username || "";
      setCurrentUserFullName(fullName);

      let membreId      = null;
      let familleId     = null;
      let membreBudget   = 0;
      let membreCarryover = 0;

      const membreRes = await fetch(`${API}/membres/user/${userId}`);
      if (membreRes.ok) {
        const membre = await membreRes.json();
        membreId = membre.id;
        setCurrentMembreObj(membre);

        // La photo est directement dans membre.user.photo (retournée par le backend)
        const famille = membre.famille;
        if (famille?.id) {
          familleId = famille.id;
          setFamilleNom(famille.name ?? "...");
        }
        membreBudget   = membre.budget ?? 0;
        // Validation : le carryover persistant n'est pris en compte que s'il
        // correspond bien au mois courant (cf. fix backend getBudgetSummary).
        // Sinon on retourne 0 — évite d'afficher un "+ X DT report du mois
        // dernier" qui viendrait d'un mois précédent obsolète.
        {
          const _now = getNow();
          const _cMois  = membre.carryoverMois  ?? membre.carryoverMonth;
          const _cAnnee = membre.carryoverAnnee ?? membre.carryoverYear;
          const _carryValide =
            _cMois  === (_now.getMonth() + 1) &&
            _cAnnee === _now.getFullYear();
          membreCarryover = _carryValide ? (membre.carryoverBudget ?? 0) : 0;
        }
        setBudget(membreBudget);
        setCarryoverDash(membreCarryover);

        const roleRes = await fetch(`${API}/membres/role/${membreId}`);
        if (roleRes.ok) {
          const rawRole = await roleRes.text();
          let role = "";
          try {
            const parsed = JSON.parse(rawRole);
            role = typeof parsed === "string"
              ? parsed
              : (parsed?.role ?? parsed?.name ?? "");
          } catch {
            role = rawRole.trim();
          }

          if (role.toUpperCase() === "ADMINISTRATEUR") {
            setIsAdmin(true);
            if (familleId) {
              setFamilleId(familleId);
              // Charger les membres D'ABORD pour calculer le budget distribué depuis leurs données
              let membresData = [];
              const membresRes = await fetch(`${API}/membres/famille/${familleId}`);
              if (membresRes.ok) {
                const tousLesMembres = await membresRes.json();
                const enriched = await enrichMembresWithPhotos(tousLesMembres);
                setMembres(enriched);
                membresData = enriched;
              }

              const now = getNow();
              const moisCourant   = now.getMonth() + 1;
              const anneeCourante = now.getFullYear();

              // FIX PRINCIPAL : Calculer budgetDistribue directement depuis les données membres
              // (budgetMois + budgetAnnee stockés sur chaque membre par le backend).
              // On ne dépend plus de l'endpoint total-budget-distributed qui peut retourner 0.
              const dist1FromMembres = membresData
                .filter(m =>
                  m.budgetMois  === moisCourant &&
                  m.budgetAnnee === anneeCourante &&
                  m.budget != null
                )
                .reduce((s, m) => s + (m.budget ?? 0), 0);

              const compteResF = await fetch(`${API}/comptes/famille/${familleId}`);
              if (compteResF.ok) {
                const compteF = await compteResF.json();
                const compteId = compteF.id;
                setCompteIdFamille(compteId);
                const [revRes, chargesRes, restantRes, carryRes] = await Promise.allSettled([
                  fetch(`${API}/revenus/compte/${compteId}/total/mois`),
                  fetch(`${API}/charges/compte/${compteId}/total/mois`),
                  fetch(`${API}/comptes/budget-restant/${familleId}`),
                  fetch(`${API}/comptes/revenu-carryover/${familleId}`),
                ]);
                let rev1 = 0;
                if (revRes.status === "fulfilled" && revRes.value.ok) {
                  rev1 = Math.max(0, (await revRes.value.json()) ?? 0);
                  setTotalRevenusFamille(rev1);
                }
                if (chargesRes.status === "fulfilled" && chargesRes.value.ok)
                  setTotalChargesFamille(Math.max(0, (await chargesRes.value.json()) ?? 0));

                // Report du mois précédent (revenu non distribué) — persiste d'un
                // mois à l'autre. Avec rev1 (mois courant) il forme le pool
                // distribuable ; le "budget restant" est calculé côté serveur.
                if (carryRes.status === "fulfilled" && carryRes.value.ok)
                  setCarryoverRevenuFamille(Math.max(0, (await carryRes.value.json()) ?? 0));

                const dist1 = dist1FromMembres;
                setBudgetDistribueFamille(dist1);
                if (restantRes.status === "fulfilled" && restantRes.value.ok)
                  setBalanceRestante(Math.max(0, (await restantRes.value.json()) ?? 0));

                try {
                  const factRes = await fetch(`${API}/factures/compte/${compteId}/total/mois`);
                  if (factRes.ok) {
                    const val = await factRes.json();
                    setTotalFacturesFamille(Math.max(0, val ?? 0));
                  }
                } catch (_) {}
              }
            }
          } else {
            setIsAdmin(false);
            setMembres([]);
            if (familleId) {
              setFamilleId(familleId);
              try {
                const now = getNow();
                const moisCN   = now.getMonth() + 1;
                const anneeCN  = now.getFullYear();
                const compteResM = await fetch(`${API}/comptes/famille/${familleId}`);
                if (compteResM.ok) {
                  const compteM = await compteResM.json();
                  const compteIdM = compteM.id;
                  const [revResM, chargesResM, distResM, factResM, restantResM, carryResM] = await Promise.allSettled([
                    fetch(`${API}/revenus/compte/${compteIdM}/total/mois`),
                    fetch(`${API}/charges/compte/${compteIdM}/total/mois`),
                    fetch(`${API}/comptes/total-budget-distributed/${familleId}?month=${moisCN}&year=${anneeCN}`),
                    fetch(`${API}/factures/compte/${compteIdM}/total/mois`),
                    fetch(`${API}/comptes/budget-restant/${familleId}`),
                    fetch(`${API}/comptes/revenu-carryover/${familleId}`),
                  ]);
                  let revM = 0, distM = 0;
                  if (revResM.status === "fulfilled" && revResM.value.ok) {
                    revM = Math.max(0, (await revResM.value.json()) ?? 0);
                    setTotalRevenusFamille(revM);
                  }
                  if (chargesResM.status === "fulfilled" && chargesResM.value.ok)
                    setTotalChargesFamille(Math.max(0, (await chargesResM.value.json()) ?? 0));
                  if (distResM.status === "fulfilled" && distResM.value.ok) {
                    distM = Math.max(0, (await distResM.value.json()) ?? 0);
                    setBudgetDistribueFamille(distM);
                  }
                  if (carryResM.status === "fulfilled" && carryResM.value.ok)
                    setCarryoverRevenuFamille(Math.max(0, (await carryResM.value.json()) ?? 0));
                  if (restantResM.status === "fulfilled" && restantResM.value.ok)
                    setBalanceRestante(Math.max(0, (await restantResM.value.json()) ?? 0));
                  if (factResM.status === "fulfilled" && factResM.value.ok)
                    setTotalFacturesFamille(Math.max(0, (await factResM.value.json()) ?? 0));
                }
              } catch (_) {}
            }
          }
        }
      }

      if (!membreId) {
        const adminRes = await fetch(`${API}/admins/user/${userId}`);
        if (adminRes.ok) {
          const admin = await adminRes.json();
          const famille = admin.famille;
          if (famille?.id) {
            familleId = famille.id;
            setFamilleNom(famille.name ?? "...");
          }
          setIsAdmin(true);
          if (familleId) {
            setFamilleId(familleId);
            // Charger les membres D'ABORD pour calculer le budget distribué depuis leurs données
            let membresData2 = [];
            const membresRes2 = await fetch(`${API}/membres/famille/${familleId}`);
            if (membresRes2.ok) {
              const tousLesMembres2 = await membresRes2.json();
              const enriched2 = await enrichMembresWithPhotos(tousLesMembres2);
              setMembres(enriched2);
              membresData2 = enriched2;
            }
            const now = getNow();
            const moisC2   = now.getMonth() + 1;
            const anneeC2  = now.getFullYear();
            // FIX PRINCIPAL : Budget distribué = somme des budgets membres du mois courant
            const dist2FromMembres = membresData2
              .filter(m => m.budgetMois === moisC2 && m.budgetAnnee === anneeC2 && m.budget != null)
              .reduce((s, m) => s + (m.budget ?? 0), 0);

            const compteResF2 = await fetch(`${API}/comptes/famille/${familleId}`);
            if (compteResF2.ok) {
              const compteF2 = await compteResF2.json();
              const compteId2 = compteF2.id;
              setCompteIdFamille(compteId2);
              const [revRes, chargesRes, restantRes2, carryRes2] = await Promise.allSettled([
                fetch(`${API}/revenus/compte/${compteId2}/total/mois`),
                fetch(`${API}/charges/compte/${compteId2}/total/mois`),
                fetch(`${API}/comptes/budget-restant/${familleId}`),
                fetch(`${API}/comptes/revenu-carryover/${familleId}`),
              ]);
              let rev2 = 0;
              if (revRes.status === "fulfilled" && revRes.value.ok) {
                rev2 = Math.max(0, (await revRes.value.json()) ?? 0);
                setTotalRevenusFamille(rev2);
              }
              if (chargesRes.status === "fulfilled" && chargesRes.value.ok)
                setTotalChargesFamille(Math.max(0, (await chargesRes.value.json()) ?? 0));
              if (carryRes2.status === "fulfilled" && carryRes2.value.ok)
                setCarryoverRevenuFamille(Math.max(0, (await carryRes2.value.json()) ?? 0));
              // FIX PRINCIPAL : Utiliser la valeur calculée depuis les membres
              const dist2 = dist2FromMembres;
              setBudgetDistribueFamille(dist2);
              if (restantRes2.status === "fulfilled" && restantRes2.value.ok)
                setBalanceRestante(Math.max(0, (await restantRes2.value.json()) ?? 0));

              try {
                const factRes2 = await fetch(`${API}/factures/compte/${compteId2}/total/mois`);
                if (factRes2.ok) {
                  const val2 = await factRes2.json();
                  setTotalFacturesFamille(Math.max(0, val2 ?? 0));
                }
              } catch (_) {}
            }
          }
        }
      }

      if (membreId) {
        setCurrentMembreId(membreId);

        const revMoisRes = await fetch(`${API}/revenus/membre/${membreId}/total/mois`);
        if (revMoisRes.ok) {
          const val = await revMoisRes.json();
          setTotalRevenus(Math.max(0, val ?? 0));
        }

        const revAnneeRes = await fetch(`${API}/revenus/membre/${membreId}/total/annee`);
        if (revAnneeRes.ok) {
          const val = await revAnneeRes.json();
          setRevenuAnnuel(Math.max(0, val ?? 0));
        }

        // Charges déduites du reste à vivre : /total/mois filtre désormais
        // par paymentDate côté backend (cash sorti effectivement ce mois).
        let totalChargesMois  = 0;
        let totalFacturesMois = 0;

        const [chargesMoisRes, chargesAllRes, facturesMoisRes, facturesAnneeRes] = await Promise.all([
          fetch(`${API}/charges/membre/${membreId}/total/mois`).catch(() => null),
          fetch(`${API}/charges/membre/${membreId}`).catch(() => null),
          fetch(`${API}/factures/membre/${membreId}/total/mois`),
          fetch(`${API}/factures/membre/${membreId}/total/annee`),
        ]);

        if (chargesMoisRes?.ok) {
          totalChargesMois = Math.max(0, (await chargesMoisRes.json()) ?? 0);
          setDepenses(totalChargesMois);
        }
        if (chargesAllRes?.ok) {
          const allCharges = await chargesAllRes.json() ?? [];
          // Total annuel : filtré par paymentDate (fallback chargeDate).
          const cy = getCurrentYear();
          const annuel = allCharges
            .filter(c => {
              const d = c.paymentDate ?? c.chargeDate ?? c.date ?? c.createdAt;
              return d && new Date(d).getFullYear() === cy;
            })
            .reduce((s, c) => s + (c.amount ?? 0), 0);
          setDepensesAnnuelles(Math.max(0, annuel));
        }
        if (facturesMoisRes.ok) {
          totalFacturesMois = Math.max(0, (await facturesMoisRes.json()) ?? 0);
          setFacturesMois(totalFacturesMois);
        }
        if (facturesAnneeRes.ok) {
          const val = await facturesAnneeRes.json();
          setFacturesAnnuelles(Math.max(0, val ?? 0));
        }

        const localBudget    = membreBudget;
        const localCarryover = membreCarryover;
        const totalDepenses  = totalChargesMois + totalFacturesMois;
        const localBudgetTotal = localBudget + localCarryover;
        const localRal = Math.max(0, localBudgetTotal - totalDepenses);

        if (membreId) {
          fetch(`${API}/membres/calculate-remaining/${membreId}?expenses=${totalDepenses}`, { method: "PUT" })
            .catch(() => {});
        }

        setBudget(localBudget);
        setCarryoverDash(localCarryover);
        setResteAVivre(localRal);

        const ralReel = localBudgetTotal - totalDepenses;
        const _u   = sessionStorage.getItem("username") ?? "";
        const _now2 = getNow(); // FIX #1 : date dynamique
        const _seenKey = `notifs_seen_level__${_u}__${_now2.getFullYear()}_${_now2.getMonth() + 1}`;

        let currentLevel = 0;
        if (localBudgetTotal > 0) {
          if      (ralReel <= 0)                      currentLevel = 4;
          else if (ralReel <= localBudgetTotal / 8)   currentLevel = 3;
          else if (ralReel <= localBudgetTotal / 6)   currentLevel = 2;
          else if (ralReel <= localBudgetTotal / 4)   currentLevel = 1;
        }

        const seenLevel = Number(localStorage.getItem(_seenKey) || "0");
        setNotifCount(currentLevel > 0 && currentLevel > seenLevel ? 1 : 0);

      } else if (familleId) {
        const compteRes = await fetch(`${API}/comptes/famille/${familleId}`);
        if (!compteRes.ok) { setLoading(false); return; }
        const compte = await compteRes.json();
        setBudget(compte.budget ?? 0);

        const revRes = await fetch(`${API}/revenus/total-amount/${compte.id}`);
        if (revRes.ok) setTotalRevenus(Math.max(0, (await revRes.json()) ?? 0));

        const ralRes = await fetch(`${API}/comptes/remaining-budget/${compte.id}`);
        if (ralRes.ok) setResteAVivre(Math.max(0, (await ralRes.json()) ?? 0));

        const chargesRes = await fetch(`${API}/charges/compte/${compte.id}`);
        if (chargesRes.ok) {
          const chargesData = await chargesRes.json();
          if (Array.isArray(chargesData)) {
            const moisItems = filterCurrentMonth(chargesData);
            setDepenses(Math.max(0, sumAmount(moisItems)));
          } else {
            setDepenses(Math.max(0, chargesData ?? 0));
          }
        }
      }

    } catch (err) {
      console.error("Erreur dashboard :", err);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    function recheckBadge() { fetchDashboard(); }
    const onFocusNotif   = () => recheckBadge();
    const onVisibleNotif = () => { if (document.visibilityState === "visible") recheckBadge(); };
    window.addEventListener("focus", onFocusNotif);
    document.addEventListener("visibilitychange", onVisibleNotif);
    return () => {
      window.removeEventListener("focus", onFocusNotif);
      document.removeEventListener("visibilitychange", onVisibleNotif);
    };
  }, [fetchDashboard]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") fetchDashboard(); };
    const onFocus   = () => fetchDashboard();
    const onRefresh = () => fetchDashboard();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("dashboard-refresh", onRefresh);
    };
  }, [fetchDashboard]);

  useEffect(() => {
    // Pourcentage d'utilisation du **budget gestionnaire uniquement**
    // (cohérent avec l'affichage "X / budget DT" dans la barre — le report
    // est volontairement exclu du dénominateur, identique à la page Home web).
    const _budget = budget ?? 0;
    const _carry  = carryoverDash ?? 0;
    if (_budget > 0 && resteAVivre !== null) {
      const _depenses = Math.max(0, (_budget + _carry) - resteAVivre);
      const pct = Math.min(100, Math.max(0, (_depenses / _budget) * 100));
      setPctBudget(pct);
    } else {
      setPctBudget(0);
    }
  }, [budget, resteAVivre, carryoverDash]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      const bar = document.getElementById("ralProgressBar");
      if (bar) bar.style.width = `${pctBudget.toFixed(1)}%`;
    }, 400);
    return () => clearTimeout(t);
  }, [loading, pctBudget]);

  const fmt = (n) =>
    n === null || n === undefined
      ? "..."
      : Number(n).toLocaleString("fr-TN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  function handleLogout() { sessionStorage.clear(); }

  function toggleStats(e) {
    e.preventDefault();
    const next = !statsOpen;
    setStatsOpen(next);
    sessionStorage.setItem("statsMenuOpen", String(next));
  }

  // FIX #4 : handleBudgetSaved — source unique de vérité = budgets des membres en state.
  // Le re-fetch backend est supprimé car l'endpoint DISTRIBUTION_BUDGET peut retourner 0
  // si le revenu n'est pas encore persisté, ce qui écrase la valeur correcte affichée.
  function handleBudgetSaved(id, newBudget, newCarryover = null) {
    const now = getNow();
    const moisCourant   = now.getMonth() + 1;
    const anneeCourante = now.getFullYear();

    // Mettre à jour la liste locale des membres avec budgetMois/budgetAnnee
    // du mois courant + le nouveau carryoverBudget (= reste à vivre transféré
    // par le backend lors du PUT /admins/set-budget).
    setMembres(prev => {
      const updated = prev.map(m =>
        m.id === id
          ? {
              ...m,
              budget: newBudget,
              budgetMois: moisCourant,
              budgetAnnee: anneeCourante,
              ...(newCarryover !== null && {
                carryoverBudget: newCarryover,
                carryoverMois: moisCourant,
                carryoverAnnee: anneeCourante,
              }),
            }
          : m
      );

      // Sommer uniquement les budgets distribués CE mois-ci.
      // Le membre qui vient d'être mis à jour (id) est toujours inclus
      // car ses budgetMois/budgetAnnee viennent d'être mis à jour ci-dessus.
      const totalDist = updated
        .filter(m => {
          if (m.id === id) return true; // toujours inclure le membre qu'on vient de sauver
          return (
            m.budgetMois  !== null && m.budgetMois  !== undefined &&
            m.budgetAnnee !== null && m.budgetAnnee !== undefined &&
            m.budgetMois  === moisCourant &&
            m.budgetAnnee === anneeCourante
          );
        })
        .reduce((s, m) => s + (m.budget ?? 0), 0);

      // Budget restant = pool distribuable (report mois préc. + revenus du mois)
      // − budgets distribués ce mois. Aligné sur le calcul serveur.
      const pool = (carryoverRevenuFamille ?? 0) + (totalRevenusFamille ?? 0);
      setBudgetDistribueFamille(totalDist);
      setBalanceRestante(Math.max(0, pool - totalDist));
      return updated;
    });

    // 3. Si c'est le budget du membre connecté (admin), mettre à jour son
    //    affichage. Le carryover passé en argument (s'il est non-null)
    //    REMPLACE l'ancienne valeur — c'est le reste à vivre fraîchement
    //    transféré par le backend.
    if (id === currentMembreId) {
      setBudget(newBudget);
      const effectiveCarry = newCarryover !== null ? newCarryover : (carryoverDash ?? 0);
      if (newCarryover !== null) setCarryoverDash(newCarryover);
      setDepenses(dep => {
        setFacturesMois(fac => {
          const totalDep = (dep ?? 0) + (fac ?? 0);
          const newRal = Math.max(0, newBudget + effectiveCarry - totalDep);
          setResteAVivre(newRal);
          fetch(`${API}/membres/calculate-remaining/${currentMembreId}?expenses=${totalDep}`, { method: "PUT" })
            .catch(() => {});
          return fac;
        });
        return dep;
      });
    }
  }

  // FIX #1 : currentYear recalculé dynamiquement pour l'affichage
  const currentYear = getCurrentYear();

  return (
    <>
      <style>{`
        :root {
          --brand-dark:    #1c2547;
          --brand-mid:     #377CF4;
          --brand-accent:  #2E3F8F;
          --brand-accent2: #325DC1;
          --card-bg:       #1c2547;
        }
        .icon-svg {
          width: 20px; height: 20px;
          stroke: rgba(255,255,255,0.70);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          display: inline-block;
          vertical-align: middle;
          transition: stroke .2s;
        }
        .btn-link-header:hover .icon-svg,
        .sidebar-toggler:hover .icon-svg { stroke: #2E3F8F; }
        .btn-link-header:hover,
        .sidebar-toggler:hover {
          background: rgba(107,111,212,.15) !important;
          border-radius: 10px;
        }
        .adminuiux-header { z-index: 1100 !important; }
        .navbar.fixed-top {
          z-index: 1050 !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }
        html, body { min-height:100vh; height:auto !important; }
        .adminuiux-wrap { flex-grow:0 !important; min-height:0 !important; height:auto !important; }
        main.adminuiux-content {
          height:auto !important;
          min-height:0 !important;
          overflow-y:visible !important;
        }
        .adminuiux-content { padding-bottom:0 !important; }
        .adminuiux-content.has-sidebar { padding-top:56px !important; }
        .adminuiux-sidebar { padding-top:56px !important; top:0 !important; }
        .adminuiux-sidebar-inner { height:100% !important; overflow-y:auto !important; }
        .adminuiux-mobile-footer {
          position:fixed !important; bottom:0 !important; left:0 !important;
          right:0 !important; z-index:1050 !important; transform:none !important;
        }
        .main-container.container { padding-top:12px !important; }

        .stats-chevron {
          margin-left:auto; font-size:10px; opacity:.7;
          transition:transform .3s cubic-bezier(.4,0,.2,1); flex-shrink:0;
        }
        .stats-open .stats-chevron { transform:rotate(180deg); }
        .stats-submenu {
          overflow:hidden; max-height:0;
          transition:max-height .35s cubic-bezier(.4,0,.2,1),opacity .28s ease;
          opacity:0; background:transparent; border-radius:0;
          margin:0 !important; padding:0 !important; pointer-events:none;
        }
        .stats-submenu.stats-submenu-open {
          max-height:180px; opacity:1;
          background:rgba(107,111,212,.12); border-radius:12px;
          margin:2px 8px 4px 8px !important; pointer-events:auto;
        }
        .stats-submenu .nav-link {
          padding:8px 16px 8px 20px !important; font-size:13.5px;
          font-weight:500; border-radius:8px;
          display:flex; align-items:center; gap:10px;
        }
        .stats-submenu:not(.stats-submenu-open) .nav-link {
          padding:0 !important; margin:0 !important;
          height:0 !important; overflow:hidden !important;
        }
        .stats-submenu .nav-link .sub-dot {
          width:6px; height:6px; border-radius:50%; background:currentColor;
          opacity:.4; flex-shrink:0; transition:opacity .2s,transform .2s;
        }
        .stats-submenu .nav-link:hover .sub-dot,
        .stats-submenu .nav-link.active .sub-dot { opacity:1; transform:scale(1.4); }
        .stats-submenu .nav-link:hover { background:rgba(107,111,212,.20) !important; }
        .nav-item-stats.stats-open > .nav-link { opacity:1; }

        .ral-card {
          background:linear-gradient(135deg,#377CF4 0%,#325DC1 55%,#2E3F8F 100%);
          border-radius:20px; position:relative; overflow:hidden;
          box-shadow:0 10px 32px rgba(91,127,232,.45);
        }
        .ral-card::before {
          content:''; position:absolute; top:-40px; right:-40px;
          width:140px; height:140px; border-radius:50%;
          background:rgba(255,255,255,.08); pointer-events:none;
        }
        .ral-card::after {
          content:''; position:absolute; bottom:-30px; left:-20px;
          width:100px; height:100px; border-radius:50%;
          background:rgba(255,255,255,.05); pointer-events:none;
        }
        .ral-progress-track { background:rgba(255,255,255,.2); border-radius:10px; height:7px; overflow:hidden; }
        .ral-progress-bar {
          height:100%; border-radius:10px;
          background:linear-gradient(90deg,rgba(255,255,255,0.6),#ffffff); width:0%;
          transition:width 1.4s cubic-bezier(.4,0,.2,1);
          box-shadow:0 0 10px rgba(255,255,255,.5);
        }
        .ral-badge {
          background:rgba(255,255,255,.18); border-radius:20px; padding:3px 10px;
          font-size:11px; backdrop-filter:blur(6px); white-space:nowrap;
        }
        .pct-badge-up {
          background:rgba(34,197,94,.12); color:#16a34a; border-radius:12px;
          padding:2px 8px; font-size:10px; font-weight:600;
          display:inline-flex; align-items:center; gap:2px; white-space:nowrap;
        }
        .pct-badge-down {
          background:rgba(239,68,68,.12); color:#dc2626; border-radius:12px;
          padding:2px 8px; font-size:10px; font-weight:600;
          display:inline-flex; align-items:center; gap:2px; white-space:nowrap;
        }
        .qa-card {
          border-radius:16px; transition:transform .22s ease,box-shadow .22s ease; cursor:pointer;
        }
        .qa-card:hover { transform:translateY(-4px) scale(1.02); box-shadow:0 12px 30px rgba(107,111,212,.20) !important; }
        .qa-icon-green { background:linear-gradient(135deg,#d1fae5,#a7f3d0); }
        .qa-icon-red   { background:linear-gradient(135deg,#fee2e2,#fecaca); }
        .qa-icon-amber { background:linear-gradient(135deg,#fef3c7,#fde68a); }

        .membres-section-header {
          display:flex; align-items:center; gap:8px; margin-bottom:14px;
        }
        .membres-count-badge {
          background:rgba(107,111,212,0.20); color:#a89de8;
          border-radius:20px; padding:2px 10px;
          font-size:10px; font-weight:700;
        }

        .famille-recap-card {
          background: linear-gradient(135deg,#377CF4 0%,#325DC1 55%,#2E3F8F 100%);
          border-radius: 20px;
          padding: 12px 14px 10px 14px;
          margin-bottom: 14px;
          box-shadow: 0 6px 22px rgba(107,111,212,0.40);
        }
        .famille-recap-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          margin-top: 0;
        }
        .famille-recap-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .famille-recap-item .recap-icon {
          width: 42px; height: 42px; border-radius: 13px;
          background: rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
          backdrop-filter: blur(4px);
          transition: background .2s, transform .2s;
        }
        .famille-recap-item:hover .recap-icon {
          background: rgba(255,255,255,0.25);
          transform: translateY(-2px);
        }
        .famille-recap-item .recap-label {
          font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.75);
          line-height: 1.2; text-align: center; white-space: nowrap;
        }
        .famille-recap-item .recap-value {
          font-size: 11px; font-weight: 800; color: #fff;
          line-height: 1; text-align: center; white-space: nowrap;
        }

        .cf-card {
          background: linear-gradient(135deg, #377CF4 0%, #325DC1 55%, #2E3F8F 100%);
          border-radius: 18px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 6px 20px rgba(107,111,212,0.40);
          position: relative;
        }
        .cf-inner {
          display: flex;
          align-items: stretch;
          min-height: 56px;
        }
        .cf-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 10px 8px 10px;
          gap: 2px;
          position: relative;
          z-index: 1;
        }
        .cf-divider {
          width: 1px;
          background: rgba(255,255,255,0.25);
          flex-shrink: 0;
          margin: 12px 0;
          align-self: stretch;
        }
        .cf-label {
          font-size: 9px;
          font-weight: 600;
          color: rgba(255,255,255,0.75);
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .cf-pct {
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          line-height: 1;
          letter-spacing: -0.5px;
        }
        .cf-amount {
          font-size: 9px;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
          white-space: nowrap;
          margin-bottom: 3px;
        }
        .cf-bar-track {
          width: 75%;
          height: 3px;
          border-radius: 4px;
          background: rgba(255,255,255,0.22);
          overflow: hidden;
        }
        .cf-bar-fill-charges {
          height: 100%;
          border-radius: 4px;
          background: #fca5a5;
          transition: width 1.2s cubic-bezier(.4,0,.2,1);
        }
        .cf-bar-fill-factures {
          height: 100%;
          border-radius: 4px;
          background: #fde68a;
          transition: width 1.2s cubic-bezier(.4,0,.2,1);
        }
        .cf-total-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 16px 4px 16px;
          gap: 1px;
          position: relative;
          z-index: 1;
        }
        .cf-total-label {
          font-size: 9px;
          font-weight: 600;
          color: rgba(255,255,255,0.65);
          letter-spacing: 0.5px;
          text-transform: uppercase;
          text-align: center;
        }
        .cf-total-amount {
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          letter-spacing: -0.5px;
        }

        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        input[type=number] { -moz-appearance:textfield; }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .anim-1 { animation:fadeSlideUp .4s ease both; }
        .anim-2 { animation:fadeSlideUp .4s .08s ease both; }
        .anim-3 { animation:fadeSlideUp .4s .16s ease both; }
        .anim-4 { animation:fadeSlideUp .4s .24s ease both; }
        .anim-5 { animation:fadeSlideUp .4s .32s ease both; }
        .anim-6 { animation:fadeSlideUp .4s .40s ease both; }
      `}</style>

      {/* ── HEADER ── */}
      <header className="adminuiux-header inner-page">
        <nav className="navbar navbar-expand-lg fixed-top">
          <div className="container-fluid">

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

            <a className="navbar-brand" href="/">
              <img data-bs-img="light" src="assets/img/family-balance-logo.png" alt="" />
              <img data-bs-img="dark"  src="assets/img/family-balance-logo.png" alt="" />
              <div className="lh-20 d-block ms-2">
                <span className="h4">FamilyBalance</span>
                <p className="company-tagline">Gestion budgétaire familiale</p>
              </div>
            </a>

            <div className="ms-auto d-flex align-items-center">

              <button
                className="btn btn-link btn-square btn-link-header"
                title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
                onClick={() => setIsDark(d => !d)}
                style={{ transition: "transform .3s ease" }}
              >
                <svg className="icon-svg" viewBox="0 0 24 24" >
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

              <a
                href="/notifications"
                className="btn btn-link btn-square btn-icon btn-link-header position-relative"
                title="Notifications"
                onClick={() => {
                  try {
                    const u   = sessionStorage.getItem("username") ?? "";
                    const now = getNow(); // FIX #1 : date dynamique
                    const seenKey = `notifs_seen_level__${u}__${now.getFullYear()}_${now.getMonth() + 1}`;
                    localStorage.setItem(seenKey, "4");
                    setNotifCount(0);
                  } catch {}
                }}
              >
                <svg className="icon-svg" viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {notifCount > 0 && (
                  <span className="position-absolute top-0 end-0 badge rounded-pill bg-danger" style={{ fontSize: '9px', padding: '2px 5px', minWidth:16 }}>
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
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

      {/* ── PAGE WRAPPER ── */}
      <div className="adminuiux-wrap" style={{ height:"auto", minHeight:"100vh", display:"flex", flexDirection:"column" }}>

        {/* Sidebar */}
        <div className="adminuiux-sidebar">
          <div className="adminuiux-sidebar-inner" style={{ paddingBottom:"80px", overflowY:"auto", height:"100%" }}>
            <div className="px-3 px-lg-4 my-3">
              <div className="row gx-3 gx-lg-4 justify-content-center align-items-center">
                <div className="col-auto">
                  {(() => {
                    const localPhoto = localStorage.getItem('avatar__' + username) || '';
                    const photo = localPhoto || getProfilePhoto(currentMembreObj);
                    const initSidebar = currentMembreObj
                      ? `${(currentMembreObj.prenom ?? currentMembreObj.user?.firstName ?? username ?? "?")[0]}${(currentMembreObj.nom ?? currentMembreObj.user?.lastName ?? "")[0] ?? ""}`.toUpperCase()
                      : (username || "?")[0].toUpperCase();
                    return photo ? (
                      <figure className="avatar avatar-60 rounded p-1 card mx-auto coverimg" style={{ overflow:"hidden" }}>
                        <img src={photo} alt={initSidebar} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      </figure>
                    ) : (
                      <div style={{
                        width:60, height:60, borderRadius:"50%",
                        background:"linear-gradient(135deg,#377CF4,#2E3F8F)",
                        color:"#fff", fontWeight:800, fontSize:18,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        boxShadow:"0 4px 14px rgba(91,127,232,0.35)",
                      }}>
                        {initSidebar}
                      </div>
                    );
                  })()}
                </div>
                <div className="col">
                  <h4 className="mb-0">{familleNom}</h4>
                  <p className="opacity-50">{isAdmin ? "Administrateur" : "Membre"}</p>
                </div>
              </div>
            </div>
            <ul className="nav flex-column menu-active-line mt-0">
              <li className="nav-item"><a className="nav-link active" href="/"><div className="avatar avatar-30 icon"><i className="bi bi-house-door"></i></div><div className="col">Accueil</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/revenus"><div className="avatar avatar-30 icon"><i className="bi bi-graph-up-arrow"></i></div><div className="col">Revenus</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/charges"><div className="avatar avatar-30 icon"><i className="bi bi-wallet2"></i></div><div className="col">Charges</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/factures"><div className="avatar avatar-30 icon"><i className="bi bi-receipt"></i></div><div className="col">Factures</div></a></li>
              <li className={`nav-item nav-item-stats${statsOpen ? " stats-open" : ""}`}>
                <a className="nav-link" href="#" onClick={toggleStats}>
                  <div className="avatar avatar-30 icon"><i className="bi bi-bar-chart-line"></i></div>
                  <div className="col">Statistiques</div>
                  <i className="bi bi-chevron-down stats-chevron"></i>
                </a>
                <ul className={`nav flex-column stats-submenu${statsOpen ? " stats-submenu-open" : ""}`}>
                  <li className="nav-item"><a className="nav-link" href="/stats-budget"><span className="sub-dot"></span><span>Budget Global</span></a></li>
                  <li className="nav-item"><a className="nav-link" href="/stats-revenus"><span className="sub-dot"></span><span>Revenus</span></a></li>
                  <li className="nav-item"><a className="nav-link" href="/stats-charges"><span className="sub-dot"></span><span>Charges</span></a></li>
                  <li className="nav-item"><a className="nav-link" href="/stats-factures"><span className="sub-dot"></span><span>Factures</span></a></li>
                </ul>
              </li>
              <li className="nav-item"><a className="nav-link" href="/notifications"><div className="avatar avatar-30 icon"><i className="bi bi-bell"></i></div><div className="col">Alertes</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/chat"><div className="avatar avatar-30 icon"><i className="bi bi-robot"></i></div><div className="col">IA Chat</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/profile"><div className="avatar avatar-30 icon"><i className="bi bi-person-circle"></i></div><div className="col">Profil</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/login" onClick={handleLogout}>
                <div className="avatar avatar-30 icon"><i className="bi bi-box-arrow-right"></i></div>
                <div className="col">Déconnexion</div>
              </a></li>
            </ul>
          </div>
        </div>

        {/* Main content */}
        <main className="adminuiux-content has-sidebar" onClick={() => window.contentClick && window.contentClick()} style={{ height:"auto", minHeight:0, overflowY:"visible", paddingBottom:0 }}>
          <div className="main-container container" style={{ paddingBottom:"80px" }}>

            {/* Bonjour */}
            <div className="row gx-3 gx-lg-4 mb-2 anim-1">
              <div className="col">
                <p className="text-secondary mb-0" style={{ fontSize:"13px" }}>Bonjour 👋</p>
                <h5 className="mb-0">{loading ? "Chargement..." : (currentUserFullName || familleNom)}</h5>
              </div>
              <div className="col-auto align-self-center">
                <span className="badge rounded-pill" style={{ background:"rgba(91,127,232,0.20)", color:"#a3bbf5", fontSize:"11px" }}>
                  {/* FIX #1 : date dynamique */}
                  {getNow().toLocaleDateString("fr-FR", { month:"short", year:"numeric" })}
                </span>
              </div>
            </div>

            {/* Reste à vivre — sémantique mise à jour suite à la règle :
                  • Pill "Budget : X DT" = budget total = base + report du mois dernier
                    (la valeur affichée est ce dont le membre dispose réellement)
                  • Sous-pill "+ Y DT report du mois dernier" = le report seul,
                    affiché en clair pour montrer d'où vient une partie du total
                  • Reste à vivre = max(0, budget total − dépenses) */}
            {(() => {
              const _budget   = budget ?? 0;
              const _carry    = carryoverDash ?? 0;
              const _total    = _budget + _carry;
              // Dépenses dérivées du couple (resteAVivre venant du backend
              // qui inclut déjà le carry dans son calcul).
              const _depenses = Math.max(0, _total - (resteAVivre ?? 0));
              const _ravFromBudget = Math.max(0, _total - _depenses);
              return (
            <div className="row gx-3 gx-lg-4 mb-3 anim-2">
              <div className="col-12">
                <div className="ral-card p-3 p-sm-4">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <div>
                      <p className="small mb-1 text-white" style={{ opacity:".75", fontSize:"12px" }}>Reste à vivre</p>
                      <h1 className="mb-0 text-white fw-bold" style={{ fontSize:"2rem", letterSpacing:"-1px" }}>
                        {fmt(_ravFromBudget)} <span style={{ fontSize:"1rem", opacity:".8" }}>DT</span>
                      </h1>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                      <span className="ral-badge text-white" style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <i className="bi bi-wallet2 me-1"></i>
                        Budget : {fmt(_total)} DT
                      </span>
                      <span style={{
                        fontSize:9, color:"rgba(255,255,255,0.70)",
                        display:"flex", alignItems:"center", gap:3,
                        background:"rgba(255,255,255,0.10)",
                        borderRadius:6, padding:"2px 6px",
                      }}>
                        <i className="bi bi-plus-lg" style={{ fontSize:8 }}></i>
                        {fmt(_carry)} DT report du mois dernier
                      </span>
                    </div>
                  </div>
                  <p className="text-white mb-2" style={{ opacity:".6", fontSize:"11px" }}>
                    sur {fmt(_total)} DT budget total
                  </p>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="small text-white" style={{ opacity:".75", fontSize:"11px" }}>Utilisation budget</span>
                    <span className="small text-white fw-semibold" style={{ fontSize:"11px" }}>{pctBudget.toFixed(1)}%</span>
                  </div>
                  <div className="ral-progress-track mb-1">
                    <div className="ral-progress-bar" id="ralProgressBar" style={{ width:"0%" }}></div>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="small text-white" style={{ fontSize:"10px", opacity:".6" }}>{fmt(_depenses)} DT</span>
                    <span className="small text-white" style={{ fontSize:"10px", opacity:".6" }}>
                      {fmt(_budget)} DT
                    </span>
                  </div>
                </div>
              </div>
            </div>
              );
            })()}

            {/* Revenus / Dépenses */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-3">
              <div className="col-6">
                <div className="card adminuiux-card h-100" style={{ borderRadius:"16px" }}>
                  <div className="card-body py-3 px-3">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div className="avatar avatar-40 p-1 rounded-3 bg-theme-1-subtle theme-green flex-shrink-0">
                        <div className="icons avatar avatar-32 bg-theme-1 text-white rounded-3">
                          <i className="bi bi-arrow-down-left fs-6"></i>
                        </div>
                      </div>
                      <button
                        onClick={() => setPeriodRevDash(p => p === "mois" ? "annee" : "mois")}
                        className="ms-auto"
                        style={{
                          background:"rgba(22,163,74,0.12)", border:"none", borderRadius:7,
                          padding:"3px 8px", cursor:"pointer", fontSize:9,
                          color:"#15803d", fontWeight:700, display:"flex", alignItems:"center", gap:3,
                        }}
                      >
                        <i className="bi bi-caret-up-fill" style={{ fontSize:7 }}></i>
                        {periodRevDash === "mois" ? "mois" : `${currentYear}`}
                      </button>
                    </div>
                    <p className="text-secondary mb-0" style={{ fontSize:"11px" }}>
                      Revenus {periodRevDash === "mois" ? "ce mois" : `${currentYear}`}
                    </p>
                    <h5 className="mb-0 fw-bold" style={{ fontSize:"15px" }}>
                      {fmt(periodRevDash === "mois" ? totalRevenus : revenuAnnuel)}{" "}
                      <span className="text-secondary" style={{ fontSize:"10px", fontWeight:"400" }}>DT</span>
                    </h5>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="card adminuiux-card h-100" style={{ borderRadius:"16px" }}>
                  <div className="card-body py-3 px-3">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div className="avatar avatar-40 p-1 rounded-3 bg-theme-1-subtle theme-red flex-shrink-0">
                        <div className="icons avatar avatar-32 bg-theme-1 text-white rounded-3">
                          <i className="bi bi-arrow-up-right fs-6"></i>
                        </div>
                      </div>
                      <button
                        onClick={() => setPeriodDepDash(p => p === "mois" ? "annee" : "mois")}
                        className="ms-auto"
                        style={{
                          background:"rgba(220,38,38,0.12)", border:"none", borderRadius:7,
                          padding:"3px 8px", cursor:"pointer", fontSize:9,
                          color:"#dc2626", fontWeight:700, display:"flex", alignItems:"center", gap:3,
                        }}
                      >
                        <i className="bi bi-caret-up-fill" style={{ fontSize:7 }}></i>
                        {periodDepDash === "mois" ? "mois" : `${currentYear}`}
                      </button>
                    </div>
                    <p className="text-secondary mb-0" style={{ fontSize:"11px" }}>
                      Dépenses {periodDepDash === "mois" ? "ce mois" : `${currentYear}`}
                    </p>
                    <h5 className="mb-0 fw-bold" style={{ fontSize:"15px" }}>
                      {fmt(periodDepDash === "mois"
                        ? (depenses ?? 0) + (facturesMois ?? 0)
                        : (depensesAnnuelles ?? 0) + (facturesAnnuelles ?? 0)
                      )}{" "}
                      <span className="text-secondary" style={{ fontSize:"10px", fontWeight:"400" }}>DT</span>
                    </h5>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Actions rapides ── */}
            <div className="row gx-3 gx-lg-4 mb-2 anim-4">
              <div className="col-12">
                <h6 className="mb-3" style={{ fontSize:"14px" }}>⚡ Actions rapides</h6>
              </div>
            </div>
            <div className="row gx-3 gx-lg-4 mb-4 anim-4">
              <div className="col-4 text-center">
                <a href="/revenus" className="style-none d-block">
                  <div className="card adminuiux-card qa-card mb-1">
                    <div className="card-body p-3">
                      <div className="avatar rounded-4 mx-auto mb-2 qa-icon-green d-flex align-items-center justify-content-center" style={{ width:"52px", height:"52px" }}>
                        <i className="bi bi-graph-up-arrow" style={{ fontSize:"22px", color:"#16a34a" }}></i>
                      </div>
                      <p className="mb-0 fw-semibold" style={{ fontSize:"12px" }}>Revenus</p>
                    </div>
                  </div>
                </a>
              </div>
              <div className="col-4 text-center">
                <a href="/charges" className="style-none d-block">
                  <div className="card adminuiux-card qa-card mb-1">
                    <div className="card-body p-3">
                      <div className="avatar rounded-4 mx-auto mb-2 qa-icon-red d-flex align-items-center justify-content-center" style={{ width:"52px", height:"52px" }}>
                        <i className="bi bi-wallet2" style={{ fontSize:"22px", color:"#dc2626" }}></i>
                      </div>
                      <p className="mb-0 fw-semibold" style={{ fontSize:"12px" }}>Charges</p>
                    </div>
                  </div>
                </a>
              </div>
              <div className="col-4 text-center">
                <a href="/factures" className="style-none d-block">
                  <div className="card adminuiux-card qa-card mb-1">
                    <div className="card-body p-3">
                      <div className="avatar rounded-4 mx-auto mb-2 qa-icon-amber d-flex align-items-center justify-content-center" style={{ width:"52px", height:"52px" }}>
                        <i className="bi bi-receipt" style={{ fontSize:"22px", color:"#d97706" }}></i>
                      </div>
                      <p className="mb-0 fw-semibold" style={{ fontSize:"12px" }}>Factures</p>
                    </div>
                  </div>
                </a>
              </div>
            </div>

            {/* ── Carte Charges / Factures — données FAMILLE ── */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-4">
              <div className="col-12">
                <div className="cf-card">

                  <div className="cf-total-header">
                    <span className="cf-total-label">Total dépenses ce mois de toute la famille</span>
                    <span className="cf-total-amount">
                      {fmt((totalChargesFamille ?? 0) + (totalFacturesFamille ?? 0))}
                      <span style={{ fontSize:12, fontWeight:600, opacity:.65, marginLeft:4 }}>DT</span>
                    </span>
                  </div>

                  <div className="cf-inner">

                    <div className="cf-side">
                      <span className="cf-label">Charges</span>
                      <span className="cf-pct">
                        {totalRevenusFamille && totalRevenusFamille > 0 && totalChargesFamille !== null
                          ? `${Math.min(100, Math.round((totalChargesFamille / totalRevenusFamille) * 100))}%`
                          : "—"}
                      </span>
                      <span className="cf-amount">
                        {fmt(totalChargesFamille)} <span style={{ opacity:.6 }}>DT</span>
                      </span>
                      <div className="cf-bar-track">
                        <div className="cf-bar-fill-charges" style={{
                          width: totalRevenusFamille && totalRevenusFamille > 0 && totalChargesFamille !== null
                            ? `${Math.min(100, Math.round((totalChargesFamille / totalRevenusFamille) * 100))}%`
                            : "0%"
                        }} />
                      </div>
                    </div>

                    <div className="cf-divider" />

                    <div className="cf-side">
                      <span className="cf-label">Factures</span>
                      <span className="cf-pct">
                        {totalRevenusFamille && totalRevenusFamille > 0 && totalFacturesFamille !== null
                          ? `${Math.min(100, Math.round((totalFacturesFamille / totalRevenusFamille) * 100))}%`
                          : "—"}
                      </span>
                      <span className="cf-amount">
                        {fmt(totalFacturesFamille)} <span style={{ opacity:.6 }}>DT</span>
                      </span>
                      <div className="cf-bar-track">
                        <div className="cf-bar-fill-factures" style={{
                          width: totalRevenusFamille && totalRevenusFamille > 0 && totalFacturesFamille !== null
                            ? `${Math.min(100, Math.round((totalFacturesFamille / totalRevenusFamille) * 100))}%`
                            : "0%"
                        }} />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* ── SECTION ADMIN : Stats + Membres ── */}
            {isAdmin && membres.length > 0 && (
              <div className="row gx-3 gx-lg-4 mb-3 anim-5">
                <div className="col-12">
                  <div style={{ background: "transparent" }}>

                    {/* Stats bar */}
                    <div style={{
                      background: "#ffffff",
                      borderRadius: 18,
                      boxShadow: "0 2px 16px rgba(91,127,232,0.12), 0 1px 4px rgba(0,0,0,0.06)",
                      border: "1px solid rgba(91,127,232,0.14)",
                      marginBottom: 10,
                      overflow: "hidden",
                    }}>
                      <BudgetStatsBar
                        budgetDistribue={budgetDistribueFamille}
                        budgetRestant={balanceRestante}
                        totalRevenu={(carryoverRevenuFamille ?? 0) + (totalRevenusFamille ?? 0)}
                      />
                    </div>

                    {/* Header membres */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "4px 2px 10px 2px",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                        👥 Membres de la famille
                      </span>
                      <span style={{
                        background: "linear-gradient(135deg,#377CF4,#2E3F8F)",
                        color: "#fff",
                        borderRadius: 20, padding: "2px 10px",
                        fontSize: 10, fontWeight: 700,
                        boxShadow: "0 2px 8px rgba(91,127,232,0.35)",
                      }}>
                        {membres.length} membre{membres.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Liste membres */}
                    <div style={{ padding: "0", display: "flex", flexDirection: "column", gap: 10 }}>
                      {membres.map(m => {
                        // Validation budget admin : somme des budgets des AUTRES
                        // membres (pour appliquer la règle "total ≤ revenus"
                        // dans BudgetModal sans double-compter le membre édité).
                        const otherBudgetsTotal = membres
                          .filter(x => x.id !== m.id)
                          .reduce((s, x) => s + (x.budget ?? 0), 0);
                        return (
                          <MembreRow
                            key={m.id}
                            membre={m}
                            onBudgetSaved={handleBudgetSaved}
                            isOwnRow={m.id === currentMembreId}
                            compteId={compteIdFamille}
                            totalRevenus={(carryoverRevenuFamille ?? 0) + (totalRevenusFamille ?? 0)}
                            otherBudgetsTotal={otherBudgetsTotal}
                            onCarryoverApplied={m.id === currentMembreId
                              ? (amount) => setCarryoverDash(amount)
                              : undefined}
                          />
                        );
                      })}
                    </div>

                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── MOBILE TAB BAR ── */}
      <footer className="adminuiux-mobile-footer style-1">
        <div className="container">
          <ul className="nav nav-pills nav-justified bg-blur">
            <li className="nav-item"><a className="nav-link active" href="/"><span><i className="nav-icon bi bi-house"></i><span className="nav-text">Accueil</span></span></a></li>
            <li className="nav-item"><a className="nav-link" href="/stats-budget"><span><i className="nav-icon bi bi-bar-chart-line"></i><span className="nav-text">Stats</span></span></a></li>
            <li className="nav-item"><a className="nav-link" href="/chat"><span><i className="nav-icon bi bi-robot"></i><span className="nav-text">IA Chat</span></span></a></li>
            <li className="nav-item"><a className="nav-link" href="/profile"><span><i className="nav-icon bi bi-person-circle"></i><span className="nav-text">Profil</span></span></a></li>
          </ul>
        </div>
      </footer>
    </>
  );
}
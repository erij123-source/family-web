import { useState, useEffect, useCallback, useRef } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip
} from 'recharts';

const API = "http://localhost:8080";

/* ════════════════════════════════════════════
   STYLES — injectés une seule fois (pattern AssistantIA)
════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Open+Sans:wght@400;500;600&display=swap');
  @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');

  :root {
    --adminuiux-content-font: "Open Sans", sans-serif;
    --adminuiux-content-font-weight: 400;
    --adminuiux-title-font: "Inter", sans-serif;
    --adminuiux-title-font-weight: 600;
  }

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
  .sidebar-toggler:hover .icon-svg { stroke: #377CF4; }
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

  /* ── Navbar ne saigne plus au scroll ── */
  .navbar.fixed-top {
    z-index: 1050 !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    background-color: inherit !important;
  }

  /* ══ STATS SUBMENU ══ */
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

  /* ══ PAGE STYLES ══ */
  .chart-card {
    border-radius: 18px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.07);
    transition: box-shadow 0.3s ease;
  }
  .chart-card:hover { box-shadow: 0 8px 32px rgba(55,124,244,0.13); }
  .chart-subtitle { font-size: 11px; opacity: 0.55; letter-spacing: 0.3px; }

  /* Period tabs – violet */
  .period-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .period-tabs button {
    border: none; border-radius: 20px;
    padding: 4px 12px; font-size: 11px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
    background: rgba(55,124,244,0.10); color: #377CF4;
  }
  .period-tabs button.active {
    background: #377CF4; color: #fff;
    box-shadow: 0 3px 10px rgba(55,124,244,0.35);
  }

  /* Sub-nav tabs */
  .stats-nav-tabs {
    display: flex; gap: 8px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: none; padding-bottom: 2px;
  }
  .stats-nav-tabs::-webkit-scrollbar { display: none; }
  .stats-nav-tabs a {
    white-space: nowrap; border-radius: 20px;
    padding: 5px 14px; font-size: 12px; font-weight: 600;
    text-decoration: none; transition: all 0.2s;
    border: 1.5px solid rgba(0,0,0,0.08);
    color: inherit; opacity: 0.65;
  }
  .stats-nav-tabs a.active {
    background: #377CF4; color: #fff;
    border-color: #377CF4; opacity: 1;
    box-shadow: 0 3px 10px rgba(55,124,244,0.3);
  }
  .stats-nav-tabs a:hover:not(.active) { opacity: 1; }

  /* Animations */
  @keyframes fadeSlideUp {
    from { opacity:0; transform:translateY(18px); }
    to   { opacity:1; transform:translateY(0); }
  }
  .anim-1 { animation: fadeSlideUp .45s ease both; }
  .anim-2 { animation: fadeSlideUp .45s .1s ease both; }
  .anim-3 { animation: fadeSlideUp .45s .2s ease both; }
  .anim-4 { animation: fadeSlideUp .45s .3s ease both; }
  .anim-5 { animation: fadeSlideUp .45s .4s ease both; }

  /* ══ FILTER DROPDOWN ══ */
  .bgt-flt-trigger {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 8px 4px 10px;
    background: rgba(255,255,255,0.88);
    border: 1.5px solid rgba(55,124,244,0.2);
    border-radius: 20px;
    font-size: 11px; font-weight: 600; color: #377CF4;
    cursor: pointer; outline: none;
    box-shadow: 0 1px 6px rgba(55,124,244,0.08);
    transition: all .18s ease;
    white-space: nowrap; user-select: none;
    backdrop-filter: blur(6px);
  }
  .bgt-flt-trigger:hover { border-color: rgba(55,124,244,0.5); background: rgba(55,124,244,0.07); }
  .bgt-flt-trigger.open  { border-color: #377CF4; background: rgba(55,124,244,0.1); }
  .bgt-flt-chevron {
    width: 10px; height: 10px; flex-shrink: 0; color: #377CF4;
    transition: transform .22s cubic-bezier(.34,1.56,.64,1);
  }
  .bgt-flt-trigger.open .bgt-flt-chevron { transform: rotate(180deg); }
  .bgt-flt-wrap { position: relative; display: inline-block; }
  .bgt-flt-menu {
    position: absolute; top: calc(100% + 5px); right: 0;
    background: rgba(255,255,255,0.98);
    border: 1.5px solid rgba(55,124,244,0.14);
    border-radius: 13px;
    box-shadow: 0 8px 28px rgba(55,124,244,0.13), 0 2px 8px rgba(0,0,0,0.06);
    backdrop-filter: blur(14px); z-index: 9999;
    animation: bgt-flt-open .16s cubic-bezier(.34,1.56,.64,1) forwards;
    padding: 4px; max-height: 220px; overflow-y: auto;
    scrollbar-width: thin; scrollbar-color: rgba(55,124,244,0.25) transparent;
  }
  .bgt-flt-menu::-webkit-scrollbar { width: 4px; }
  .bgt-flt-menu::-webkit-scrollbar-thumb { background: rgba(55,124,244,0.25); border-radius: 4px; }
  .bgt-flt-menu-month { min-width: 68px; }
  .bgt-flt-menu-year  { min-width: 76px; }
  @keyframes bgt-flt-open {
    from { opacity: 0; transform: scale(.93) translateY(-5px); }
    to   { opacity: 1; transform: scale(1)   translateY(0); }
  }
  .bgt-flt-item {
    padding: 5px 10px; font-size: 11px; font-weight: 500;
    color: #374151; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between; gap: 6px; white-space: nowrap;
    transition: background .12s, color .12s;
  }
  .bgt-flt-item:hover    { background: rgba(55,124,244,0.09); color: #377CF4; }
  .bgt-flt-item.selected { background: rgba(55,124,244,0.13); color: #377CF4; font-weight: 700; }
  .bgt-flt-item.selected::after { content:""; width:5px; height:5px; border-radius:50%; background:#377CF4; flex-shrink:0; display:block; }
  .bgt-flt-item-month { padding: 4px 8px; justify-content: center; text-align: center; }
  .bgt-flt-item-month.selected { justify-content: space-between; }

  /* Skeleton shimmer */
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .skeleton {
    border-radius: 8px;
    background: linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s infinite;
  }

  /* KPI / misc */
  .kpi-card { border-radius: 16px; transition: transform 0.25s ease, box-shadow 0.25s ease; cursor: pointer; }
  .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.12) !important; }

  /* ══ BUDGET CARRYOVER CHART ══ */
  .bcc-legend { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
  .bcc-legend-item { display:flex; align-items:center; gap:5px; font-size:10px; opacity:0.65; }
  .bcc-legend-dot { width:9px; height:9px; border-radius:2px; flex-shrink:0; }

  .bcc-row { padding:10px 0; border-bottom:0.5px solid rgba(0,0,0,0.06); }
  .bcc-row:last-child { border-bottom:none; padding-bottom:0; }
  .bcc-row:first-child { padding-top:0; }

  .bcc-avatar {
    width:28px; height:28px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:700; flex-shrink:0;
  }
  .bcc-badge {
    font-size:10px; font-weight:600;
    padding:2px 8px; border-radius:20px;
    background:rgba(0,0,0,0.06); color:#374151;
    flex-shrink:0; white-space:nowrap;
  }
  .bcc-track {
    height:12px; border-radius:6px;
    background:rgba(0,0,0,0.04);
    border:0.5px solid rgba(0,0,0,0.06);
    overflow:hidden; cursor:pointer; position:relative;
  }
  .bcc-fill { height:100%; display:flex; }
  .bcc-used  { height:100%; background:#6366f1; transition:width .75s cubic-bezier(0.4,0,0.2,1); }
  .bcc-carry { height:100%; background:#1D9E75; transition:width .75s cubic-bezier(0.4,0,0.2,1) .08s; }
  .bcc-reste { height:100%; background:#f43f5e; transition:width .75s cubic-bezier(0.4,0,0.2,1) .16s; }

  .bcc-tip {
    position:absolute; bottom:calc(100% + 8px); left:50%;
    transform:translateX(-50%);
    background:#fff; border:1px solid rgba(0,0,0,0.09);
    border-radius:10px; padding:8px 12px; font-size:11px;
    box-shadow:0 4px 16px rgba(0,0,0,0.11);
    pointer-events:none; z-index:200; min-width:170px;
    white-space:nowrap; opacity:0; transition:opacity .15s;
  }
  .bcc-tip.visible { opacity:1; }

  .bcc-amounts { display:flex; justify-content:space-between; margin-top:4px; }
  .bcc-amt-used  { font-size:10px; color:#6366f1; font-weight:600; }
  .bcc-amt-carry { font-size:10px; color:#f43f5e; font-weight:600; }
`;

/* ══════════════════════════════════════
   PALETTE couleurs membres
══════════════════════════════════════ */
const COLORS = [
  '#6366f1','#f43f5e','#f59e0b','#10b981',
  '#3b82f6','#ec4899','#14b8a6','#8b5cf6',
  '#ef4444','#06b6d4','#84cc16','#f97316',
];

/* Noms des mois (index 0 = Jan) */
const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

/* ════════════════════════════════════════════
   FILTER DROPDOWN — palette violette budget
════════════════════════════════════════════ */
function FilterDropdown({ value, onChange, options, type = "year" }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const isMonth = type === "month";

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div ref={wrapRef} className="bgt-flt-wrap">
      <button type="button" className={`bgt-flt-trigger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {selected?.label ?? value}
        <svg className="bgt-flt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={`bgt-flt-menu${isMonth ? ' bgt-flt-menu-month' : ' bgt-flt-menu-year'}`}>
          {options.map(opt => {
            const isSel = String(opt.value) === String(value);
            return (
              <div
                key={opt.value}
                className={`bgt-flt-item${isMonth ? ' bgt-flt-item-month' : ''}${isSel ? ' selected' : ''}`}
                onMouseDown={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   BUDGET CARRYOVER CHART — composant interne
════════════════════════════════════════════ */
function BudgetCarryoverRow({ member, index, animate }) {
  const [hovered, setHovered] = useState(false);
  const color    = COLORS[index % COLORS.length];
  const budget   = member.budget ?? 0;
  // spent = dépenses réelles (charges + factures) fetchées par le parent pour le mois sélectionné
  const spent    = member.spent  ?? 0;
  // carryover = report du mois précédent
  const carryover = member.carry ?? 0;
  // "reste de budget" = budget + carryover - dépenses
  const reste    = Math.max(0, budget + carryover - spent);
  const total    = budget + carryover; // base pour les pourcentages
  const usedPct  = total > 0 ? Math.min(100, Math.round((spent   / total) * 100)) : 0;
  const carryPct = total > 0 ? Math.min(100, Math.round((carryover / total) * 100)) : 0;
  const restePct = Math.max(0, 100 - usedPct - carryPct);

  const prenom = member.prenom ?? member.user?.prenom ?? "";
  const nom    = member.nom    ?? member.user?.nom    ?? "";
  const name   = `${prenom} ${nom}`.trim() || member.user?.username || `Membre ${index + 1}`;
  const ini    = ((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase() || '?';
  const avatarBg = color + '1a';

  return (
    <div className="bcc-row">
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:7 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {name}
          </div>
        </div>
        <span className="bcc-badge">Budget : {Number(budget).toLocaleString('fr-FR')} DT</span>
      </div>

      <div style={{ position:'relative' }}>
        <div
          className="bcc-track"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="bcc-fill">
            <div className="bcc-used"  style={{ width: animate ? usedPct  + '%' : '0%', background:'#6366f1' }} />
            <div className="bcc-carry" style={{ width: animate ? carryPct + '%' : '0%' }} />
            <div className="bcc-reste" style={{ width: animate ? restePct + '%' : '0%', background:'#f43f5e' }} />
          </div>
        </div>
        <div className={`bcc-tip${hovered ? ' visible' : ''}`}>
          <div style={{ fontWeight:700, marginBottom:5, fontSize:11.5 }}>{name}</div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:18, marginBottom:2 }}>
            <span style={{ opacity:.6 }}>Budget alloué</span>
            <strong>{Number(budget).toLocaleString('fr-FR')} DT</strong>
          </div>
          {carryover > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', gap:18, marginBottom:2 }}>
              <span style={{ opacity:.6, color:'#1D9E75' }}>Report mois préc.</span>
              <strong style={{ color:'#1D9E75' }}>+{Number(carryover).toLocaleString('fr-FR')} DT</strong>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', gap:18, marginBottom:2 }}>
            <span style={{ opacity:.6, color:'#6366f1' }}>Consommé</span>
            <strong style={{ color:'#6366f1' }}>{Number(spent).toLocaleString('fr-FR')} DT ({usedPct}%)</strong>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:18 }}>
            <span style={{ color:'#f43f5e' }}>Reste à vivre</span>
            <strong style={{ color:'#f43f5e' }}>{Number(reste).toLocaleString('fr-FR')} DT ({restePct}%)</strong>
          </div>
        </div>
      </div>

      <div className="bcc-amounts">
        <span className="bcc-amt-used" style={{ color:'#6366f1', fontWeight:700 }}>Consommé : {Number(spent).toLocaleString('fr-FR')} DT ({usedPct}%)</span>
        <span className="bcc-amt-carry" style={{ color:'#f43f5e', fontWeight:700 }}>Reste : {Number(reste).toLocaleString('fr-FR')} DT ({restePct}%)</span>
      </div>
    </div>
  );
}

export default function StatsBudget() {
  const [statsOpen, setStatsOpen] = useState(true);
  const [bccAnimate, setBccAnimate] = useState(false);

  /* ── Inject styles once ── */
  if (typeof document !== 'undefined') {
    const id = "statsbudget-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = STYLES;
      document.head.appendChild(el);
    }
    if (!document.querySelector('link[href*="bootstrap-icons"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
      document.head.appendChild(link);
    }
  }

  /* ══════════════════════════════════════════
    ÉTAT
  ══════════════════════════════════════════ */

  // tous les membres de la famille (avec leurs champs budgetMois, budgetAnnee, carryoverBudget)
  const [tousLesMembres,  setTousLesMembres]  = useState([]);
  const [pieLoading,      setPieLoading]      = useState(true);
  const [pieError,        setPieError]        = useState(null);
  const [availableYears,  setAvailableYears]  = useState([]);
  // familleId pour les appels backend
  const [familleIdState,  setFamilleIdState]  = useState(null);
  // Données historiques pour la chart 1 (depuis budget_historique)
  const [pieHistorique,   setPieHistorique]   = useState([]);
  const [pieHistLoading,  setPieHistLoading]  = useState(false);

  const _now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(_now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(_now.getMonth()); // 0-11 (index)

  /* États filtre indépendants pour CHART 2 */
  const [bccYear,  setBccYear]  = useState(_now.getFullYear());
  const [bccMonth, setBccMonth] = useState(_now.getMonth()); // 0-11

  // Dépenses (charges + factures) par membre pour le mois bccMonth/bccYear
  // Map: membreId → { spent, loading }
  const [bccSpent, setBccSpent] = useState({});
  const [bccSpentLoading, setBccSpentLoading] = useState(false);

  /* ─────────────────────────────────────────────────────────────────────────
     fetchPieHistorique — charge les données budget_historique pour la chart 1
     Appelé à chaque changement de selectedMonth / selectedYear
  ───────────────────────────────────────────────────────────────────────── */
  const fetchPieHistorique = useCallback(async (fId, month0, year) => {
    if (!fId) return;
    const mois1 = month0 + 1; // 0-11 → 1-12
    setPieHistLoading(true);
    try {
      const res = await fetch(
        `${API}/membres/famille/${fId}/budget-historique?month=${mois1}&year=${year}`
      );
      if (res.ok) {
        const data = await res.json();
        setPieHistorique(Array.isArray(data) ? data : []);
      } else {
        setPieHistorique([]);
      }
    } catch (_) {
      setPieHistorique([]);
    } finally {
      setPieHistLoading(false);
    }
  }, []);

  // Relancer fetchPieHistorique quand le filtre de la chart 1 change
  useEffect(() => {
    if (familleIdState) {
      fetchPieHistorique(familleIdState, selectedMonth, selectedYear);
    }
  }, [familleIdState, selectedMonth, selectedYear, fetchPieHistorique]);

  /* ─────────────────────────────────────────────────────────────────────────
     loadPieData — charge membres de la famille
  ───────────────────────────────────────────────────────────────────────── */
  const loadPieData = useCallback(async () => {
    setPieLoading(true);
    setPieError(null);
    try {
      const username = sessionStorage.getItem("username") ?? "";
      if (!username) { setPieError("Non connecté"); setPieLoading(false); return; }

      // 1. Utilisateur courant
      const usersRes = await fetch(`${API}/users`);
      if (!usersRes.ok) throw new Error("Impossible de charger les utilisateurs");
      const users = await usersRes.json();
      const currentUser = users.find(u => u.username === username);
      if (!currentUser?.id) { setPieError("Utilisateur introuvable"); setPieLoading(false); return; }
      const userId = currentUser.id;

      // 2. Résolution famille
      let fId = null;
      const membreRes = await fetch(`${API}/membres/user/${userId}`);
      if (membreRes.ok) { const m = await membreRes.json(); fId = m.famille?.id ?? null; }
      if (!fId) {
        const adminRes = await fetch(`${API}/admins/user/${userId}`);
        if (adminRes.ok) { const a = await adminRes.json(); fId = a.famille?.id ?? null; }
      }
      if (!fId) { setPieError("Famille introuvable"); setPieLoading(false); return; }
      setFamilleIdState(fId);
      // Charger immédiatement les données pie pour le mois courant
      await fetchPieHistorique(fId, _now.getMonth(), _now.getFullYear());

      // 3. Tous les membres de la famille
      const membresRes = await fetch(`${API}/membres/famille/${fId}`);
      if (!membresRes.ok) throw new Error("Impossible de charger les membres");
      const membres = (await membresRes.json()) ?? [];
      setTousLesMembres(membres);

      // 4. Années disponibles — année courante + toutes les années des membres
      // budget_historique contient l'historique complet, mais on ne peut pas le fetcher ici
      // sans endpoint dédié. On part de budgetAnnee des membres + année courante.
      const yearsSet = new Set();
      yearsSet.add(_now.getFullYear());
      // Ajouter les années passées connues (au moins l'année précédente)
      yearsSet.add(_now.getFullYear() - 1);
      membres.forEach(m => {
        if (m.budgetAnnee) yearsSet.add(m.budgetAnnee);
      });
      const years = Array.from(yearsSet).sort((a, b) => b - a);
      setAvailableYears(years);

      // 5. Sélection par défaut : mois courant (l'admin vient de distribuer ce mois)
      //    Si le mois courant n'a aucun budget, on laisse quand même sélectionné le mois courant
      //    (l'UI affichera "Aucun budget distribué ce mois")
      setSelectedYear(_now.getFullYear());
      setSelectedMonth(_now.getMonth());
      setBccYear(_now.getFullYear());
      setBccMonth(_now.getMonth());

    } catch (err) {
      setPieError(err.message ?? "Erreur de chargement");
    } finally {
      setPieLoading(false);
    }
  }, [fetchPieHistorique]);

  useEffect(() => { loadPieData(); }, [loadPieData]);

  useEffect(() => {
    const hasMembers = tousLesMembres.length > 0;
    if (hasMembers) {
      const t = setTimeout(() => setBccAnimate(true), 150);
      return () => clearTimeout(t);
    }
  }, [tousLesMembres]);



  /* ─────────────────────────────────────────────────────────────────────────
     fetchBudgetSnapshots — appelle GET /membres/{id}/budget-snapshot?month=M&year=Y
     pour chaque membre. Retourne budget + carryover + spent + reste validés côté backend.
  ───────────────────────────────────────────────────────────────────────── */
  const fetchBudgetSnapshots = useCallback(async (membres, month0, year) => {
    if (!membres || membres.length === 0) return;
    const mois1 = month0 + 1; // 0-11 → 1-12
    setBccSpentLoading(true);
    try {
      const results = await Promise.all(
        membres.map(async (m) => {
          try {
            const res = await fetch(
              `${API}/membres/${m.id}/budget-snapshot?month=${mois1}&year=${year}`
            );
            if (!res.ok) return { id: m.id, budget: m.budget ?? 0, spent: 0, carry: 0, reste: 0 };
            const snap = await res.json();
            return {
              id:     snap.membreId,
              budget: snap.budget    ?? m.budget ?? 0,
              spent:  snap.spent     ?? 0,
              carry:  snap.carryover ?? 0,
              reste:  snap.reste     ?? 0,
            };
          } catch {
            return { id: m.id, budget: m.budget ?? 0, spent: 0, carry: 0, reste: 0 };
          }
        })
      );
      const map = {};
      results.forEach(r => { map[r.id] = { budget: r.budget, spent: r.spent, carry: r.carry, reste: r.reste }; });
      setBccSpent(map);
    } catch (_) {}
    finally { setBccSpentLoading(false); }
  }, []);

  // Relancer fetchBudgetSnapshots quand les membres ou le filtre bcc change
  useEffect(() => {
    if (tousLesMembres.length > 0) {
      setBccAnimate(false);
      fetchBudgetSnapshots(tousLesMembres, bccMonth, bccYear)
        .then(() => { setTimeout(() => setBccAnimate(true), 100); });
    }
  }, [tousLesMembres, bccMonth, bccYear, fetchBudgetSnapshots]);

  /* ─────────────────────────────────────────────────────────────────────────
     pieData — lit depuis budget_historique via l'endpoint dédié
     fetchPieHistorique est appelé à chaque changement de selectedMonth/selectedYear
  ───────────────────────────────────────────────────────────────────────── */
  const pieData = (() => {
    if (pieHistorique.length === 0) return [];
    return pieHistorique.map((item, i) => ({
      name:  item.nomComplet || `Membre ${i + 1}`,
      value: item.budget ?? 0,
      color: COLORS[i % COLORS.length],
    }));
  })();

  const totalPie = pieData.reduce((s, d) => s + d.value, 0);

  /* ─────────────────────────────────────────────────────────────────────────
     membresForChart2 — membres ayant un budget distribué pour bccMonth/bccYear
     Enrichis avec spent (dépenses réelles) et carry (carryover validé du mois)
  ───────────────────────────────────────────────────────────────────────── */
  // Chart 2 : membres filtrés par bccMonth/bccYear via budget_historique (backend)
  // Le snapshot backend retourne budget+carryover+spent+reste pour le mois exact demandé
  const membresForChart2 = (() => {
    // Inclure tous les membres actifs de la famille — le snapshot dira budget=0 si pas distribué
    return tousLesMembres
      .filter(m => {
        const snap = bccSpent[m.id];
        // Afficher seulement si le snapshot contient un budget > 0 pour ce mois
        return snap && (snap.budget ?? 0) > 0;
      })
      .map(m => {
        const snap = bccSpent[m.id];
        return {
          ...m,
          budget: snap?.budget ?? 0,
          spent:  snap?.spent  ?? 0,
          carry:  snap?.carry  ?? 0,
          reste:  snap?.reste  ?? 0,
        };
      });
  })();

  function toggleStats(e) {
    e.preventDefault();
    const next = !statsOpen;
    setStatsOpen(next);
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem("statsMenuOpen", String(next));
  }

  const fmt = (n) =>
    n === null || n === undefined ? "—"
      : Number(n).toLocaleString("fr-TN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  /* ══════════════════════════════════════════
     RENDU
  ══════════════════════════════════════════ */
  return (
    <div
      className="main-bg main-bg-blur main-bg-opac roundedui adminuiux-header-standard theme-purple adminuiux-mobile-footer-fill-white adminuiux-sidebar-fill-theme adminuiux-header-transparent adminuiux-sidebar-boxed bg-gradient-1 scrollup"
      data-theme="theme-purple"
    >

      {/* ════════════════════════════════════════
          HEADER — SVG inline (AssistantIA pattern)
      ════════════════════════════════════════ */}
      <header className="adminuiux-header inner-page">
        <nav className="navbar navbar-expand-lg fixed-top">
          <div className="container-fluid">

            {/* 3 lignes sidebar */}
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

            {/* Icônes droite SVG inline */}
            <div className="ms-auto d-flex align-items-center">

              {/* Thème */}
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
                <span className="position-absolute top-0 end-0 badge rounded-pill bg-danger" style={{ fontSize: '9px', padding: '2px 5px' }}>3</span>
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
            SIDEBAR — AssistantIA pattern
        ════════════════════════════════════════ */}
        <div className="adminuiux-sidebar">
          <div className="adminuiux-sidebar-inner" style={{ paddingBottom: 80, overflowY: 'auto', height: '100%' }}>

            {/* Avatar */}
            <div className="px-3 px-lg-4 my-3">
              <div className="row gx-3 gx-lg-4 justify-content-center align-items-center">
                <div className="col-auto">
                  <figure className="avatar avatar-60 rounded p-1 card mx-auto coverimg">
                    <img src="assets/img/adminuiux/user-1.jpg" alt="" />
                  </figure>
                </div>
                <div className="col">
                  <h4 className="mb-0">Famille Ben Ali</h4>
                  <p className="opacity-50">Administrateur</p>
                </div>
              </div>
            </div>

            {/* Nav links */}
            <ul className="nav flex-column menu-active-line mt-0">
              <li className="nav-item">
                <a className="nav-link" href="/">
                  <div className="avatar avatar-30 icon"><i className="bi bi-house-door"></i></div>
                  <div className="col">Accueil</div>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/revenus">
                  <div className="avatar avatar-30 icon"><i className="bi bi-graph-up-arrow"></i></div>
                  <div className="col">Revenus</div>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/charges">
                  <div className="avatar avatar-30 icon"><i className="bi bi-wallet2"></i></div>
                  <div className="col">Charges</div>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/factures">
                  <div className="avatar avatar-30 icon"><i className="bi bi-receipt"></i></div>
                  <div className="col">Factures</div>
                </a>
              </li>

              {/* ══ STATISTIQUES avec sous-menu ══ */}
              <li className={`nav-item nav-item-stats${statsOpen ? ' stats-open' : ''}`}>
                <a className="nav-link" href="#" onClick={toggleStats}>
                  <div className="avatar avatar-30 icon"><i className="bi bi-bar-chart-line"></i></div>
                  <div className="col">Statistiques</div>
                  <i className="bi bi-chevron-down stats-chevron"></i>
                </a>
                <ul className={`nav flex-column stats-submenu${statsOpen ? ' stats-submenu-open' : ''}`}>
                  <li className="nav-item">
                    <a className="nav-link active" href="/stats-budget">
                      <span className="sub-dot"></span><span>Budget Global</span>
                    </a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="/stats-revenus">
                      <span className="sub-dot"></span><span>Revenus</span>
                    </a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="/stats-charges">
                      <span className="sub-dot"></span><span>Charges</span>
                    </a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" href="/stats-factures">
                      <span className="sub-dot"></span><span>Factures</span>
                    </a>
                  </li>
                </ul>
              </li>
              {/* ══ fin STATISTIQUES ══ */}

              <li className="nav-item">
                <a className="nav-link" href="/notifications">
                  <div className="avatar avatar-30 icon"><i className="bi bi-bell"></i></div>
                  <div className="col">Alertes</div>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/chat">
                  <div className="avatar avatar-30 icon"><i className="bi bi-robot"></i></div>
                  <div className="col">IA Chat</div>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/profile">
                  <div className="avatar avatar-30 icon"><i className="bi bi-person-circle"></i></div>
                  <div className="col">Profil</div>
                </a>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/login">
                  <div className="avatar avatar-30 icon"><i className="bi bi-box-arrow-right"></i></div>
                  <div className="col">Déconnexion</div>
                </a>
              </li>
            </ul>

          </div>
        </div>
        {/* ── END SIDEBAR ── */}

        {/* ════════════════════════════════════════
            MAIN CONTENT
        ════════════════════════════════════════ */}
        <main
          className="adminuiux-content has-sidebar"
          onClick={() => window.contentClick && window.contentClick()}
        >
          <div className="main-container container" style={{ paddingTop: '60px', paddingBottom: '80px' }}>

            {/* Page Header */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-1">
              <div className="col">
                <p className="text-secondary mb-0">Statistiques</p>
                <h5 className="mb-0">Budget Global 📊</h5>
              </div>
              <div className="col-auto align-self-center">
                <span className="badge rounded-pill" style={{ background:'rgba(55,124,244,0.1)', color:'#377CF4', fontSize:11 }}>
                  {new Date().toLocaleDateString('fr-FR', { month:'short', year:'numeric' })}
                </span>
              </div>
            </div>

            {/* Sub-navigation */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-1">
              <div className="col-12">
                <div className="stats-nav-tabs">
                  <a href="/stats-budget" className="active">Budget Global</a>
                  <a href="/stats-revenus">Revenus</a>
                  <a href="/stats-charges">Charges</a>
                  <a href="/stats-factures">Factures</a>
                </div>
              </div>
            </div>


            {/* CHART 1 — Répartition par Membre (Pie) — DYNAMIQUE */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-3">
              <div className="col-12">
                <div className="card adminuiux-card chart-card">
                  <div className="card-body p-3">

                    {/* ── En-tête + Dropdowns Mois / Année ── */}
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <p className="fw-semibold mb-0" style={{ fontSize:13 }}>Répartition par Membre</p>
                        <p className="chart-subtitle mb-0">
                          {pieLoading
                            ? 'Chargement…'
                            : `Total ${totalPie.toLocaleString('fr-FR')} DT · ${MOIS_LABELS[selectedMonth]} ${selectedYear}`}
                        </p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <FilterDropdown
                          type="month"
                          value={selectedMonth}
                          onChange={v => setSelectedMonth(Number(v))}
                          options={MOIS_LABELS.map((m, i) => ({ label: m, value: i }))}
                        />
                        <FilterDropdown
                          value={selectedYear}
                          onChange={v => setSelectedYear(Number(v))}
                          options={
                            availableYears.length > 0
                              ? availableYears.map(y => ({ label: String(y), value: y }))
                              : [{ label: String(selectedYear), value: selectedYear }]
                          }
                        />
                      </div>
                    </div>

                    {/* ── État : loading ── */}
                    {(pieLoading || pieHistLoading) && (
                      <div className="d-flex align-items-center gap-3 py-3">
                        <div className="skeleton" style={{ width:160, height:160, borderRadius:'50%' }} />
                        <div className="d-flex flex-column gap-2" style={{ flex:1 }}>
                          {[1,2,3].map(i => (
                            <div key={i} className="skeleton" style={{ height:36, borderRadius:10 }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── État : erreur ── */}
                    {!pieLoading && pieError && (
                      <div style={{ textAlign:'center', padding:'24px 0', color:'#f43f5e', fontSize:12 }}>
                        <i className="bi bi-exclamation-triangle" style={{ fontSize:28, display:'block', marginBottom:8 }}></i>
                        {pieError}
                        <br />
                        <button onClick={loadPieData} style={{ marginTop:10, border:'none', borderRadius:10, background:'rgba(55,124,244,0.10)', color:'#377CF4', padding:'5px 14px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                          Réessayer
                        </button>
                      </div>
                    )}

                    {/* ── État : aucune donnée ce mois ── */}
                    {!pieLoading && !pieError && pieData.length === 0 && (
                      <div style={{ textAlign:'center', padding:'32px 0', color:'#9ca3af', fontSize:12 }}>
                        <i className="bi bi-pie-chart" style={{ fontSize:32, display:'block', marginBottom:8, opacity:0.35 }}></i>
                        Aucun budget distribué en {MOIS_LABELS[selectedMonth]} {selectedYear}.
                      </div>
                    )}

                    {/* ── Pie Chart + Légende (style original) ── */}
                    {!pieLoading && !pieError && pieData.length > 0 && (
                      <div className="row gx-3 align-items-center">
                        {/* Pie pleine avec labels de pourcentage sur chaque tranche */}
                        <div className="col-6">
                          <ResponsiveContainer width="100%" height={210}>
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%" cy="50%"
                                outerRadius={80}
                                strokeWidth={2}
                                stroke="#fff"
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                  const RADIAN = Math.PI / 180;
                                  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                                  const x = cx + r * Math.cos(-midAngle * RADIAN);
                                  const y = cy + r * Math.sin(-midAngle * RADIAN);
                                  return percent > 0.07 ? (
                                    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700}>
                                      {Math.round(percent * 100)}%
                                    </text>
                                  ) : null;
                                }}
                                labelLine={false}
                              >
                                {pieData.map((e, i) => (
                                  <Cell key={i} fill={e.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v) => `${Number(v).toLocaleString('fr-FR')} DT`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Légende avec valeurs réelles */}
                        <div className="col-6">
                          <div className="d-flex flex-column gap-3">
                            {pieData.map((m, i) => {
                              const pct = totalPie > 0
                                ? Math.round((m.value / totalPie) * 100)
                                : 0;
                              return (
                                <div key={i} className="d-flex align-items-center gap-2">
                                  <span style={{
                                    width:12, height:12, borderRadius:3,
                                    background:m.color, flexShrink:0,
                                    display:'inline-block',
                                  }} />
                                  <div style={{ minWidth:0, flex:1 }}>
                                    <p className="mb-0 fw-semibold" style={{ fontSize:11.5, lineHeight:1.3 }}>
                                      {m.name}
                                    </p>
                                    <p className="mb-0 text-secondary" style={{ fontSize:10 }}>
                                      {pct}% · {Number(m.value).toLocaleString('fr-FR')} DT
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </div>

            {/* CHART 2 — Budget & Consommation & Reste par membre */}
            {!pieLoading && !pieError && (
              <div className="row gx-3 gx-lg-4 mb-3 anim-4">
                <div className="col-12">
                  <div className="card adminuiux-card chart-card">
                    <div className="card-body p-3">

                      {/* En-tête */}
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <p className="fw-semibold mb-0" style={{ fontSize:13 }}>Budget &amp; Reste de budget par membre</p>
                          <p className="chart-subtitle mb-0">Budget · Consommation · Reste — {MOIS_LABELS[bccMonth]} {bccYear}</p>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <FilterDropdown
                            type="month"
                            value={bccMonth}
                            onChange={v => { setBccAnimate(false); setBccMonth(Number(v)); }}
                            options={MOIS_LABELS.map((m, i) => ({ label: m, value: i }))}
                          />
                          <FilterDropdown
                            value={bccYear}
                            onChange={v => { setBccAnimate(false); setBccYear(Number(v)); }}
                            options={
                              availableYears.length > 0
                                ? availableYears.map(y => ({ label: String(y), value: y }))
                                : [{ label: String(bccYear), value: bccYear }]
                            }
                          />
                        </div>
                      </div>

                      {/* Loading dépenses */}
                      {bccSpentLoading && (
                        <div className="d-flex flex-column gap-2">
                          {[1,2,3].map(i => <div key={i} className="skeleton" style={{height:56, borderRadius:10}} />)}
                        </div>
                      )}

                      {/* Aucun budget distribué ce mois */}
                      {!bccSpentLoading && membresForChart2.length === 0 && (
                        <div style={{ textAlign:'center', padding:'32px 0', color:'#9ca3af', fontSize:12 }}>
                          <i className="bi bi-wallet2" style={{ fontSize:32, display:'block', marginBottom:8, opacity:0.3 }}></i>
                          Pas de répartition de budget en {MOIS_LABELS[bccMonth]} {bccYear}.
                        </div>
                      )}

                      {/* Lignes membres */}
                      {!bccSpentLoading && membresForChart2.map((m, i) => (
                        <BudgetCarryoverRow
                          key={m.id ?? i}
                          member={m}
                          index={i}
                          animate={bccAnimate}
                        />
                      ))}

                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>

      </div>
      {/* page wrapper ends */}

      {/* ════════════════════════════════════════
          TAB BAR MOBILE — AssistantIA pattern
          lien actif : Statistiques (cette page)
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
              <a className="nav-link active" href="/stats-budget">
                <span><i className="nav-icon bi bi-bar-chart-line"></i><span className="nav-text">Statistiques</span></span>
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

    </div>
  );
}
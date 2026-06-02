import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine } from "recharts";

const API_BASE = "http://localhost:8080";
const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const MEMBER_COLORS_PURPLE = [
  '#6366f1','#f43f5e','#f59e0b','#10b981',
  '#3b82f6','#ec4899','#14b8a6','#8b5cf6',
  '#ef4444','#06b6d4','#84cc16','#f97316',
];

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

  /* Period tabs – vert */
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

  /* KPI / misc */
  .kpi-card { border-radius: 16px; transition: transform 0.25s ease, box-shadow 0.25s ease; cursor: pointer; }
  .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.12) !important; }

  /* ── Custom Filter Dropdown — palette violette revenus ── */
  .flt-trigger {
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
    backdrop-filter: blur(6px); min-width: 0;
  }
  .flt-trigger:hover {
    border-color: rgba(55,124,244,0.5);
    background: rgba(55,124,244,0.07);
    box-shadow: 0 3px 12px rgba(55,124,244,0.15);
  }
  .flt-trigger.open {
    border-color: #377CF4;
    background: rgba(55,124,244,0.10);
    box-shadow: 0 4px 16px rgba(55,124,244,0.2);
  }
  .flt-chevron {
    width: 10px; height: 10px; flex-shrink: 0;
    transition: transform .22s cubic-bezier(.34,1.56,.64,1);
    color: #377CF4;
  }
  .flt-trigger.open .flt-chevron { transform: rotate(180deg); }
  .flt-wrap { position: relative; display: inline-block; }
  .flt-menu {
    position: absolute; top: calc(100% + 5px); right: 0;
    background: rgba(255,255,255,0.98);
    border: 1.5px solid rgba(55,124,244,0.14);
    border-radius: 13px;
    box-shadow: 0 8px 28px rgba(55,124,244,0.13), 0 2px 8px rgba(0,0,0,0.06);
    backdrop-filter: blur(14px);
    z-index: 9999;
    transform-origin: top right;
    animation: flt-open .16s cubic-bezier(.34,1.56,.64,1) forwards;
    padding: 4px;
    max-height: 220px; overflow-y: auto; overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(55,124,244,0.25) transparent;
  }
  .flt-menu::-webkit-scrollbar { width: 4px; }
  .flt-menu::-webkit-scrollbar-track { background: transparent; }
  .flt-menu::-webkit-scrollbar-thumb { background: rgba(55,124,244,0.25); border-radius: 4px; }
  .flt-menu-month { min-width: 68px; max-height: 200px; }
  .flt-menu-year  { min-width: 76px; }
  @keyframes flt-open {
    from { opacity: 0; transform: scale(.93) translateY(-5px); }
    to   { opacity: 1; transform: scale(1)   translateY(0); }
  }
  .flt-item {
    padding: 5px 10px; font-size: 11px; font-weight: 500;
    color: #374151; border-radius: 8px; cursor: pointer;
    transition: background .12s, color .12s;
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px; white-space: nowrap;
  }
  .flt-item:hover { background: rgba(55,124,244,0.09); color: #377CF4; }
  .flt-item.selected { background: rgba(55,124,244,0.13); color: #377CF4; font-weight: 700; }
  .flt-item.selected::after {
    content: ""; width: 5px; height: 5px; border-radius: 50%;
    background: #377CF4; flex-shrink: 0; display: block;
  }
  .flt-item-month { padding: 4px 8px; justify-content: center; text-align: center; }
  .flt-item-month.selected { justify-content: space-between; }

  /* Skeleton loader */
  @keyframes shimmer {
    from { background-position: -400px 0; }
    to   { background-position:  400px 0; }
  }
  .skel {
    background: linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 8px;
  }
`;

/* ════════════════════════════════════════════
   DATA – Revenus familiaux
════════════════════════════════════════════ */
/* ════════════════════════════════════════════
   EVOLUTION HELPER — même logique que StatsCharges
   Fenêtre de 3 mois se terminant à endMonthIndex
════════════════════════════════════════════ */
function buildEvolutionRevenus(revenus, year, endMonthIndex, count) {
  const byMonth = {};
  revenus.forEach(r => {
    if (!r.perceptionDate) return;
    const parts = r.perceptionDate.slice(0, 10).split('-').map(Number);
    const yyyy = parts[0];
    const mo   = parts[1] - 1; // 0-based month
    if (yyyy !== year) return;
    byMonth[mo] = (byMonth[mo] || 0) + Number(r.amount ?? 0);
  });
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    const mo = endMonthIndex - i;
    if (mo < 0) continue;
    result.push({ mois: MONTHS_FR[mo], Revenus: Math.round((byMonth[mo] || 0) * 100) / 100, moIndex: mo });
  }
  return result;
}

/* ── Tooltip violet ── */
const CustomTooltipRev = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'rgba(255,255,255,0.95)', border:'1.5px solid rgba(99,102,241,0.18)', borderRadius:10, padding:'8px 12px', fontSize:11, boxShadow:'0 4px 16px rgba(99,102,241,0.12)' }}>
      <p style={{ margin:0, fontWeight:700, color:'#374151', marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin:0, color:'#6366f1' }}>
          Revenus : <strong>{Number(p.value).toLocaleString('fr-FR')} DT</strong>
        </p>
      ))}
    </div>
  );
};

/* ── Chart Skeleton ── */
const ChartSkeletonRev = ({ height = 220 }) => (
  <div className="skel" style={{ width:'100%', height, borderRadius:10 }} />
);

const CAT_COLORS_PURPLE = [
  '#6366f1','#f43f5e','#f59e0b','#10b981',
  '#3b82f6','#ec4899','#14b8a6','#8b5cf6',
  '#ef4444','#06b6d4','#84cc16','#f97316',
];

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
/* ════════════════════════════════════════════
   FILTER DROPDOWN — palette violette revenus
════════════════════════════════════════════ */
function FilterDropdown({ value, onChange, options, type = "year" }) {
  const [open, setOpen] = useState(false);
  const ref = useState(() => ({ current: null }))[0];
  const isMonth = type === "month";

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));

  return (
    <div ref={el => ref.current = el} className="flt-wrap">
      <button
        type="button"
        className={`flt-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {selected?.label ?? value}
        <svg className="flt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={`flt-menu${isMonth ? ' flt-menu-month' : ' flt-menu-year'}`}>
          {options.map(opt => {
            const isSel = String(opt.value) === String(value);
            return (
              <div
                key={opt.value}
                className={`flt-item${isMonth ? ' flt-item-month' : ''}${isSel ? ' selected' : ''}`}
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

function PieSkeleton() {
  return (
    <div className="row gx-2 align-items-center">
      <div className="col-6 d-flex justify-content-center">
        <div className="skel" style={{ width: 130, height: 130, borderRadius: '50%' }} />
      </div>
      <div className="col-6 d-flex flex-column gap-2">
        {[80, 60, 70].map((w, i) => (
          <div key={i} className="d-flex align-items-center gap-2">
            <div className="skel" style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0 }} />
            <div className="skel" style={{ width: `${w}%`, height: 10 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsRevenus() {
  const { user }          = useAuth();
  const [statsOpen, setStatsOpen] = useState(false);

  /* ── Member pie new state ── */
  const _now = new Date();
  const [memberFilterMonth, setMemberFilterMonth] = useState(_now.getMonth());
  const [memberFilterYear,  setMemberFilterYear]  = useState(_now.getFullYear());
  const [memberPieData,     setMemberPieData]     = useState([]);
  const [memberPieLoading,  setMemberPieLoading]  = useState(false);
  const [memberTotal,       setMemberTotal]       = useState(0);
  const [allRevenusRaw,     setAllRevenusRaw]     = useState([]);
  const [familleId,         setFamilleId]         = useState(null);

  /* ── Evolution Chart states ── */
  const [areaYear,     setAreaYear]     = useState(_now.getFullYear());
  const [areaEndMonth, setAreaEndMonth] = useState(_now.getMonth());

  /* ── Category pie state ── */
  const [catFilterMonth,  setCatFilterMonth]  = useState(_now.getMonth());
  const [catFilterYear,   setCatFilterYear]   = useState(_now.getFullYear());
  const [catPieData,      setCatPieData]      = useState([]);
  const [catPieLoading,   setCatPieLoading]   = useState(false);
  const [catTotal,        setCatTotal]        = useState(0);



  /* ── Inject styles + Bootstrap Icons synchronously (before first paint) ── */
  if (typeof document !== "undefined") {
    const id = "statsrevenus-styles";
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

  /* ── Restore stats submenu state ── */
  useEffect(() => {
    if (sessionStorage.getItem("statsMenuOpen") === "true") setStatsOpen(true);
  }, []);

  /* ════ RESOLVE familleId once ════ */
  useEffect(() => {
    if (!user?.username) return;
    async function resolve() {
      try {
        const resUsers = await fetch(`${API_BASE}/users`);
        if (!resUsers.ok) throw new Error(`/users: ${resUsers.status}`);
        const allUsers = await resUsers.json();
        const me = allUsers.find(u => u.username === user.username);
        if (!me) throw new Error(`Utilisateur introuvable`);

        const resAdmin = await fetch(`${API_BASE}/admins/user/${me.id}`);
        if (!resAdmin.ok) throw new Error(`Admin introuvable`);
        const admin = await resAdmin.json();
        const fid = admin?.famille?.id;
        if (!fid) throw new Error(`familleId introuvable`);
        setFamilleId(fid);
      } catch (err) {
        console.error('familleId resolve error:', err);
      }
    }
    resolve();
  }, [user?.username]);

  /* ════ FETCH revenus par membre — agrégé en frontend ════ */
  useEffect(() => {
    if (!familleId) return;
    async function fetchMemberPie() {
      setMemberPieLoading(true);
      try {
        /* 1. familleId → compteId */
        const compRes = await fetch(`${API_BASE}/comptes/famille/${familleId}`);
        if (!compRes.ok) throw new Error(`Compte: ${compRes.status}`);
        const compte = await compRes.json();

        /* 2. Tous les revenus du compte (RevenuDTO) */
        const revRes = await fetch(`${API_BASE}/revenus/compte/${compte.id}`);
        if (!revRes.ok) throw new Error(`Revenus: ${revRes.status}`);
        const revenus = await revRes.json();

        /* Stocker le brut pour les années disponibles */
        setAllRevenusRaw(revenus);

        /* 3. Filtrer par mois + année sélectionnés */
        const filtered = revenus.filter(r => {
          if (!r.perceptionDate) return false;
          const [yyyy, mm] = r.perceptionDate.slice(0, 10).split('-').map(Number);
          return (mm - 1) === memberFilterMonth && yyyy === memberFilterYear;
        });

        /* 4. Agréger par membre */
        const byMember = {};
        filtered.forEach(r => {
          const key = `${r.membrePrenom ?? ''} ${r.membreNom ?? ''}`.trim() || `Membre ${r.membreId}`;
          byMember[key] = (byMember[key] || 0) + Number(r.amount ?? 0);
        });

        /* 5. Convertir en tableau trié */
        const result = Object.entries(byMember)
          .map(([label, value], i) => ({ label, value, color: MEMBER_COLORS_PURPLE[i % MEMBER_COLORS_PURPLE.length] }))
          .filter(d => d.value > 0)
          .sort((a, b) => b.value - a.value);

        setMemberPieData(result);
        setMemberTotal(result.reduce((s, d) => s + d.value, 0));
      } catch (err) {
        console.error('Member pie error:', err);
        setMemberPieData([]);
        setMemberTotal(0);
      } finally {
        setMemberPieLoading(false);
      }
    }
    fetchMemberPie();
  }, [familleId, memberFilterMonth, memberFilterYear]);

  /* ════ FETCH revenus par catégorie — agrégé en frontend depuis allRevenusRaw ════ */
  useEffect(() => {
    if (!allRevenusRaw.length) return;

    setCatPieLoading(true);

    // Filtrer par mois + année sélectionnés
    const filtered = allRevenusRaw.filter(r => {
      if (!r.perceptionDate) return false;
      const [yyyy, mm] = r.perceptionDate.slice(0, 10).split('-').map(Number);
      return (mm - 1) === catFilterMonth && yyyy === catFilterYear;
    });

    // Agréger par type de revenu (comme mapRevenu dans RevenusListe)
    // type AUTRE + description non vide → afficher la description (label custom)
    // sinon afficher le label standard
    const TYPE_LABEL_CAT = { SALAIRE: 'Salaire', SECONDAIRE: 'Revenu secondaire', AIDE: 'Aide / Subvention', AUTRE: 'Autre' };
    const bycat = {};
    filtered.forEach(r => {
      const typeRaw = (r.type ?? '').toUpperCase();
      let key;
      if (typeRaw === 'AUTRE') {
        const desc = (r.description ?? '').trim();
        key = desc || 'Autre';
      } else {
        key = TYPE_LABEL_CAT[typeRaw] || r.type || 'Autre';
      }
      bycat[key] = (bycat[key] || 0) + Number(r.amount ?? 0);
    });

    const result = Object.entries(bycat)
      .map(([label, value], i) => ({ label, value, color: CAT_COLORS_PURPLE[i % CAT_COLORS_PURPLE.length] }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);

    setCatPieData(result);
    setCatTotal(result.reduce((s, d) => s + d.value, 0));
    setCatPieLoading(false);
  }, [allRevenusRaw, catFilterMonth, catFilterYear]);

  /* ════ TOGGLE STATS SUBMENU ════ */
  function toggleStats(e) {
    e.preventDefault();
    const next = !statsOpen;
    setStatsOpen(next);
    sessionStorage.setItem("statsMenuOpen", String(next));
  }

  /* ── Evolution: fenêtre 3 mois depuis allRevenusRaw ── */
  const areaData = buildEvolutionRevenus(allRevenusRaw, areaYear, areaEndMonth, 3);

  /* ── Ticks dynamiques pour l axe Y — valeurs réelles + base fixe ── */
  /* ── Ticks dynamiques pour l'axe Y — repères fixes adaptés à la magnitude + valeurs réelles ── */
  const { areaYTicks, areaAllLineTicks } = (() => {
    const realValues = areaData.map(d => d.Revenus).filter(v => v > 0);

    // Calculer un pas "joli" adapté à la magnitude du max
    const maxVal = realValues.length > 0 ? Math.max(...realValues) : 500;
    const rawStep = maxVal / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
    const step = (niceSteps.find(s => s * magnitude >= rawStep) || 1) * magnitude;

    // Générer les ticks fixes de 0 jusqu'au plafond
    const ceiling = Math.ceil(maxVal / step) * step;
    const baseTicks = [];
    for (let v = 0; v <= ceiling; v += step) baseTicks.push(v);

    // Fusionner avec les valeurs réelles (sans doublons, triés)
    const merged = Array.from(new Set([...baseTicks, ...realValues])).sort((a, b) => a - b);

    // ReferenceLine pour TOUS les ticks > 0 (fixes + réels)
    const allLineTicks = merged.filter(v => v > 0);
    return { areaYTicks: merged, areaAllLineTicks: allLineTicks };
  })();

  function handleAreaYearChange(newYear) {
    setAreaYear(newYear);
    setAreaEndMonth(2); // repart de Jan–Fév–Mar; naviguer jusqu'à Déc
  }

  function shiftAreaWindow(direction) {
    setAreaEndMonth(prev => {
      const next = prev + direction;
      if (next < 2) return 2;
      if (next > 11) return 11; // max = Décembre, toujours
      return next;
    });
  }

  /* ── Available years from real data ── */
  const availableYears = (() => {
    const yrs = new Set();
    allRevenusRaw.forEach(r => {
      if (r.perceptionDate) yrs.add(Number(r.perceptionDate.slice(0, 4)));
    });
    yrs.add(new Date().getFullYear());
    return Array.from(yrs).sort();
  })();

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */

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
                    <a className="nav-link" href="/stats-budget">
                      <span className="sub-dot"></span><span>Budget Global</span>
                    </a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link active" href="/stats-revenus">
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

            {/* ── Page Header ── */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-1">
              <div className="col">
                <p className="text-secondary mb-0">Statistiques</p>
                <h5 className="mb-0">Analyse des Revenus 💰</h5>
              </div>
              <div className="col-auto align-self-center">
                <span className="badge rounded-pill" style={{ background: 'rgba(55,124,244,0.10)', color: '#377CF4', fontSize: '11px' }}>
                  {new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                </span>
              </div>
            </div>

            {/* ── Sub-navigation tabs ── */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-1">
              <div className="col-12">
                <div className="stats-nav-tabs">
                  <a href="/stats-budget">Budget Global</a>
                  <a href="/stats-revenus" className="active">Revenus</a>
                  <a href="/stats-charges">Charges</a>
                  <a href="/stats-factures">Factures</a>
                </div>
              </div>
            </div>

            {/* ── Chart 1 : Répartition par Membre (Recharts donut) ── */}
            <div className="row gx-3 gx-lg-4 mb-4 anim-3">
              <div className="col-12">
                <div className="card adminuiux-card chart-card">
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <p className="fw-semibold mb-0" style={{ fontSize: '13px' }}>Répartition par Membre</p>
                        <p className="chart-subtitle mb-0">
                          {memberPieLoading
                            ? 'Chargement…'
                            : `Total ${memberTotal.toLocaleString('fr-FR')} DT`}
                        </p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <FilterDropdown
                          type="month"
                          value={memberFilterMonth}
                          onChange={v => setMemberFilterMonth(Number(v))}
                          options={MONTHS_FR.map((m, i) => ({ label: m, value: i }))}
                        />
                        <FilterDropdown
                          value={memberFilterYear}
                          onChange={v => setMemberFilterYear(Number(v))}
                          options={availableYears.map(y => ({ label: String(y), value: y }))}
                        />
                      </div>
                    </div>

                    {memberPieLoading ? (
                      <PieSkeleton />
                    ) : memberPieData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', opacity: 0.45, fontSize: 12 }}>
                        <i className="bi bi-people" style={{ fontSize: 28 }}></i>
                        <p className="mb-0 mt-2">Aucun revenu pour cette période</p>
                      </div>
                    ) : (
                      <div className="row gx-2 align-items-center">
                        {/* Pie plein — identique Chart 1 StatsCharges */}
                        <div className="col-6">
                          <ResponsiveContainer width="100%" height={195}>
                            <PieChart>
                              <Pie
                                data={memberPieData}
                                dataKey="value"
                                nameKey="label"
                                cx="50%" cy="50%"
                                outerRadius={86}
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
                                {memberPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                              </Pie>
                              <Tooltip formatter={v => `${Number(v).toLocaleString('fr-FR')} DT`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Légende verticale */}
                        <div className="col-6">
                          <div className="d-flex flex-column gap-2">
                            {memberPieData.map((item, i) => {
                              const pct = memberTotal > 0 ? Math.round(item.value / memberTotal * 100) : 0;
                              return (
                                <div key={i} className="d-flex align-items-center gap-2">
                                  <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0, display: 'inline-block' }} />
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <p className="mb-0 fw-medium" style={{ fontSize: 11, lineHeight: 1.2 }}>{item.label}</p>
                                    <p className="mb-0 text-secondary" style={{ fontSize: 10 }}>{pct}%</p>
                                  </div>
                                  <span className="fw-semibold" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {item.value.toLocaleString('fr-FR')} DT
                                  </span>
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
            {/* ── Chart 2 : Évolution des Revenus (AreaChart Recharts) ── */}
            <div className="row gx-3 gx-lg-4 mb-3 anim-4">
              <div className="col-12">
                <div className="card adminuiux-card chart-card">
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <p className="fw-semibold mb-0" style={{ fontSize: '13px' }}>Évolution des Revenus</p>
                        <p className="chart-subtitle mb-0">
                          {areaData.length > 0
                            ? `${areaData[0].mois} → ${areaData[areaData.length - 1].mois} ${areaYear}`
                            : `Année ${areaYear}`}
                        </p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {/* ‹ Older */}
                        <button
                          onClick={() => shiftAreaWindow(-1)}
                          disabled={areaEndMonth <= 2}
                          style={{
                            border: '1.5px solid rgba(99,102,241,0.22)',
                            borderRadius: '50%', width: 26, height: 26,
                            background: areaEndMonth <= 2 ? 'rgba(0,0,0,0.04)' : 'rgba(99,102,241,0.08)',
                            color: areaEndMonth <= 2 ? '#aaa' : '#6366f1',
                            cursor: areaEndMonth <= 2 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 700, padding: 0,
                            transition: 'all .2s', flexShrink: 0,
                          }}
                          title="Mois précédents"
                        >‹</button>
                        {/* › Newer */}
                        <button
                          onClick={() => shiftAreaWindow(+1)}
                          disabled={areaEndMonth >= 11}
                          style={{
                            border: '1.5px solid rgba(99,102,241,0.22)',
                            borderRadius: '50%', width: 26, height: 26,
                            background: areaEndMonth >= 11 ? 'rgba(0,0,0,0.04)' : 'rgba(99,102,241,0.08)',
                            color: areaEndMonth >= 11 ? '#aaa' : '#6366f1',
                            cursor: areaEndMonth >= 11 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 700, padding: 0,
                            transition: 'all .2s', flexShrink: 0,
                          }}
                          title="Mois suivants"
                        >›</button>
                        {/* Year selector */}
                        <FilterDropdown
                          value={areaYear}
                          onChange={v => handleAreaYearChange(Number(v))}
                          options={availableYears.map(y => ({ label: String(y), value: y }))}
                        />
                      </div>
                    </div>

                    {!allRevenusRaw.length && familleId ? (
                      <ChartSkeletonRev height={220} />
                    ) : areaData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.45, fontSize: 12 }}>
                        <i className="bi bi-graph-up" style={{ fontSize: 28 }}></i>
                        <p className="mb-0 mt-2">Pas de données pour cette période</p>
                      </div>
                    ) : (
                      <div
                        onWheel={e => {
                          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                            e.preventDefault();
                            if (e.deltaX > 30)      shiftAreaWindow(-1);
                            else if (e.deltaX < -30) shiftAreaWindow(+1);
                          }
                        }}
                        onTouchStart={e => { window._areaSwipeRevX = e.touches[0].clientX; }}
                        onTouchEnd={e => {
                          if (window._areaSwipeRevX == null) return;
                          const dx = e.changedTouches[0].clientX - window._areaSwipeRevX;
                          if (dx < -40)      shiftAreaWindow(-1);
                          else if (dx > 40)  shiftAreaWindow(+1);
                          window._areaSwipeRevX = null;
                        }}
                        style={{ touchAction: 'pan-y' }}
                      >
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={areaData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gradRevEvo" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.65} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
                              </linearGradient>
                            </defs>
                            {/* Pas de CartesianGrid — ReferenceLine uniquement pour les valeurs réelles */}
                            <XAxis dataKey="mois" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis
                              tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                              tickFormatter={v => `${Number(v).toLocaleString('fr-FR')} DT`}
                              ticks={areaYTicks}
                              domain={[0, 'auto']}
                              width={72}
                            />
                            <Tooltip content={<CustomTooltipRev />} />
                            {areaAllLineTicks.map(val => (
                              <ReferenceLine
                                key={`rl-${val}`}
                                y={val}
                                stroke="rgba(0,0,0,0.05)"
                                strokeDasharray="4 4"
                                strokeWidth={1}
                                ifOverflow="extendDomain"
                              />
                            ))}
                            <Area
                              type="monotone"
                              dataKey="Revenus"
                              stroke="#6366f1"
                              strokeWidth={3.5}
                              fill="url(#gradRevEvo)"
                              dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                              activeDot={{ r: 6, fill: '#377CF4' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>

                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Chart 3 : Répartition par Catégorie de Revenu (Recharts donut) ── */}
            <div className="row gx-3 gx-lg-4 mb-4 anim-5">
              <div className="col-12">
                <div className="card adminuiux-card chart-card">
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <p className="fw-semibold mb-0" style={{ fontSize: '13px' }}>Répartition par Catégorie de Revenu</p>
                        <p className="chart-subtitle mb-0">
                          {catPieLoading
                            ? 'Chargement…'
                            : `Total ${catTotal.toLocaleString('fr-FR')} DT`}
                        </p>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <FilterDropdown
                          type="month"
                          value={catFilterMonth}
                          onChange={v => setCatFilterMonth(Number(v))}
                          options={MONTHS_FR.map((m, i) => ({ label: m, value: i }))}
                        />
                        <FilterDropdown
                          value={catFilterYear}
                          onChange={v => setCatFilterYear(Number(v))}
                          options={availableYears.map(y => ({ label: String(y), value: y }))}
                        />
                      </div>
                    </div>

                    {catPieLoading ? (
                      <PieSkeleton />
                    ) : catPieData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', opacity: 0.45, fontSize: 12 }}>
                        <i className="bi bi-tag" style={{ fontSize: 28 }}></i>
                        <p className="mb-0 mt-2">Aucune catégorie pour cette période</p>
                      </div>
                    ) : (
                      <div className="row gx-2 align-items-center">
                        <div className="col-6">
                          <ResponsiveContainer width="100%" height={195}>
                            <PieChart>
                              <Pie
                                data={catPieData}
                                dataKey="value"
                                nameKey="label"
                                cx="50%" cy="50%"
                                outerRadius={84}
                                innerRadius={52}
                                strokeWidth={0}
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
                                {catPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                              </Pie>
                              <Tooltip formatter={v => `${Number(v).toLocaleString('fr-FR')} DT`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="col-6">
                          <div className="d-flex flex-column gap-2">
                            {catPieData.map((item, i) => {
                              const pct = catTotal > 0 ? Math.round(item.value / catTotal * 100) : 0;
                              return (
                                <div key={i} className="d-flex align-items-center gap-2">
                                  <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0, display: 'inline-block' }} />
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <p className="mb-0 fw-medium" style={{ fontSize: 11, lineHeight: 1.2 }}>{item.label}</p>
                                    <p className="mb-0 text-secondary" style={{ fontSize: 10 }}>{pct}%</p>
                                  </div>
                                  <span className="fw-semibold" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                                    {item.value.toLocaleString('fr-FR')} DT
                                  </span>
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



          </div>
          {/* main content ends */}
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
              <a className="nav-link active" href="/stats-revenus">
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
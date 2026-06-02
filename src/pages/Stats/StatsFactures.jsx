import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  ReferenceLine
} from 'recharts';

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
  .chart-card:hover { box-shadow: 0 8px 32px rgba(239,68,68,0.13); }
  .chart-subtitle { font-size: 11px; opacity: 0.55; letter-spacing: 0.3px; }

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
    background: #dc2626; color: #fff;
    border-color: #dc2626; opacity: 1;
    box-shadow: 0 3px 10px rgba(220,38,38,0.3);
  }
  .stats-nav-tabs a:hover:not(.active) { opacity: 1; }

  /* Hero card */
  .hero-card {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #7f1d1d 100%);
    border-radius: 20px; position: relative; overflow: hidden;
    box-shadow: 0 12px 40px rgba(220,38,38,0.35);
  }
  .hero-card::before {
    content: ''; position: absolute; top: -40px; right: -40px;
    width: 140px; height: 140px; border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }
  .hero-card::after {
    content: ''; position: absolute; bottom: -30px; left: -20px;
    width: 100px; height: 100px; border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
  .hero-badge {
    background: rgba(255,255,255,0.18); border-radius: 20px;
    padding: 3px 10px; font-size: 11px; backdrop-filter: blur(6px);
  }
  .hero-progress-track {
    background: rgba(255,255,255,0.2);
    border-radius: 10px; height: 8px; overflow: hidden;
  }
  .hero-progress-bar {
    height: 100%; border-radius: 10px;
    background: linear-gradient(90deg, #a5f3fc, #ffffff);
    width: 0%; transition: width 1.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 10px rgba(255,255,255,0.5);
  }

  /* KPI cards */
  .kpi-card { border-radius: 16px; transition: transform 0.25s ease, box-shadow 0.25s ease; cursor: pointer; }
  .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.12) !important; }

  /* Top 5 bar items */
  .top-bar-item { margin-bottom: 14px; }
  .top-bar-label { font-size: 12px; font-weight: 600; display: flex; justify-content: space-between; margin-bottom: 4px; }
  .top-bar-track { background: rgba(0,0,0,0.06); border-radius: 8px; height: 10px; overflow: hidden; }
  .top-bar-fill { height: 100%; border-radius: 8px; width: 0%; transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1); }

  /* Status rows */
  .status-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
  .status-row:last-child { border-bottom: none; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-right: 10px; }
  .status-label { font-size: 13px; font-weight: 600; flex: 1; }
  .status-count { font-size: 11px; opacity: 0.5; margin-right: 10px; }
  .status-amount { font-size: 13px; font-weight: 700; }

  /* Badges */
  .pct-badge-up { background: rgba(34,197,94,0.12); color: #16a34a; border-radius: 12px; padding: 2px 8px; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px; }
  .pct-badge-down { background: rgba(239,68,68,0.12); color: #dc2626; border-radius: 12px; padding: 2px 8px; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px; }
  .pct-badge-warn { background: rgba(245,158,11,0.12); color: #d97706; border-radius: 12px; padding: 2px 8px; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px; }

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
  .anim-6 { animation: fadeSlideUp .45s .5s ease both; }

  /* Skeleton loader */
  .skeleton {
    background: linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ── Custom Filter Dropdown ── */
  .flt-trigger {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 8px 4px 10px;
    background: rgba(255,255,255,0.88);
    border: 1.5px solid rgba(220,38,38,0.2);
    border-radius: 20px;
    font-size: 11px; font-weight: 600; color: #b91c1c;
    cursor: pointer; outline: none;
    box-shadow: 0 1px 6px rgba(220,38,38,0.08);
    transition: all .18s ease;
    white-space: nowrap; user-select: none;
    backdrop-filter: blur(6px); min-width: 0;
  }
  .flt-trigger:hover {
    border-color: rgba(220,38,38,0.5);
    background: rgba(220,38,38,0.07);
    box-shadow: 0 3px 12px rgba(220,38,38,0.15);
  }
  .flt-trigger.open {
    border-color: #dc2626;
    background: rgba(220,38,38,0.1);
    box-shadow: 0 4px 16px rgba(220,38,38,0.2);
  }
  .flt-chevron {
    width: 10px; height: 10px; flex-shrink: 0;
    transition: transform .22s cubic-bezier(.34,1.56,.64,1);
    color: #dc2626;
  }
  .flt-trigger.open .flt-chevron { transform: rotate(180deg); }

  /* Wrapper positionné pour le menu */
  .flt-wrap { position: relative; display: inline-block; }

  /* Menu commun */
  .flt-menu {
    position: absolute; top: calc(100% + 5px);
    right: 0;
    background: rgba(255,255,255,0.98);
    border: 1.5px solid rgba(220,38,38,0.14);
    border-radius: 13px;
    box-shadow: 0 8px 28px rgba(220,38,38,0.13), 0 2px 8px rgba(0,0,0,0.06);
    backdrop-filter: blur(14px);
    z-index: 9999;
    transform-origin: top right;
    animation: flt-open .16s cubic-bezier(.34,1.56,.64,1) forwards;
    padding: 4px;
    /* scroll interne */
    max-height: 220px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(220,38,38,0.25) transparent;
  }
  .flt-menu::-webkit-scrollbar { width: 4px; }
  .flt-menu::-webkit-scrollbar-track { background: transparent; }
  .flt-menu::-webkit-scrollbar-thumb {
    background: rgba(220,38,38,0.25); border-radius: 4px;
  }

  /* Menu mois : plus compact et plus étroit */
  .flt-menu-month {
    min-width: 68px;
    max-height: 200px;
  }
  /* Menu année : largeur normale */
  .flt-menu-year { min-width: 76px; }

  @keyframes flt-open {
    from { opacity: 0; transform: scale(.93) translateY(-5px); }
    to   { opacity: 1; transform: scale(1)   translateY(0); }
  }

  /* Items */
  .flt-item {
    padding: 5px 10px; font-size: 11px; font-weight: 500;
    color: #374151; border-radius: 8px; cursor: pointer;
    transition: background .12s, color .12s;
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px; white-space: nowrap;
  }
  .flt-item:hover { background: rgba(220,38,38,0.09); color: #dc2626; }
  .flt-item.selected {
    background: rgba(220,38,38,0.13); color: #b91c1c; font-weight: 700;
  }
  .flt-item.selected::after {
    content: "";
    width: 5px; height: 5px; border-radius: 50%;
    background: #dc2626; flex-shrink: 0; display: block;
  }
  /* Items mois : centrés et encore plus compacts */
  .flt-item-month {
    padding: 4px 8px;
    justify-content: center;
    text-align: center;
  }
  .flt-item-month.selected { justify-content: space-between; }
`;


const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];


const API_BASE = 'http://localhost:8080';
const CAT_COLORS    = ['#ef4444','#f97316','#eab308','#06b6d4','#8b5cf6','#64748b','#22c55e','#ec4899'];
const MEMBER_COLORS = ['#ef4444','#f59e0b','#3b82f6','#22c55e','#8b5cf6','#06b6d4','#ec4899','#f97316'];


/* Returns the latest month index available for a given year (0-based) */
function getLastMonthOfYear(year) {
    const now = new Date();
    if (year < now.getFullYear()) return 11;
    return now.getMonth();
}

/* Returns up to 3 months ending at endMonthIdx for given year */
function getMonthWindow(year, endMonthIdx) {
    const result = [];
    for (let i = Math.max(0, endMonthIdx - 2); i <= endMonthIdx; i++) {
        result.push(i);
    }
    return result;
}

/**
 * Agrège les factures PAYEE d'une année donnée par mois (dueDate).
 * Retourne exactement les mois de la fenêtre visible.
 */
function buildEvolutionDataForYear(factures, year, endMonthIndex, count) {
    const byMonth = {};
    factures.forEach(f => {
        if (f.statut !== 'PAYEE') return;
        const dateStr = f.dueDate;
        if (!dateStr) return;
        const [yyyy, mm] = dateStr.split('-').map(Number);
        if (yyyy !== year) return;
        const mo = mm - 1; // 0-based
        byMonth[mo] = (byMonth[mo] || 0) + Number(f.amount);
    });
    const result = [];
    for (let i = count - 1; i >= 0; i--) {
        const mo = endMonthIndex - i;
        if (mo < 0) continue;
        result.push({
            mois: MONTH_NAMES[mo],
            Factures: byMonth[mo] || 0,
            moIndex: mo,
        });
    }
    return result;
}

/* Tooltip custom cyan (couleur Factures) */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background:'#fff', border:'1px solid #e9ecef', borderRadius:10, padding:'10px 14px', boxShadow:'0 4px 16px rgba(0,0,0,.1)', fontSize:12 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color || p.stroke, marginBottom:2 }}>
                    {p.name} : <strong>{Number(p.value).toLocaleString('fr-FR')} DT</strong>
                </div>
            ))}
        </div>
    );
};

/* Skeleton chart */
const ChartSkeleton = ({ height = 220 }) => (
    <div style={{ height, display:'flex', alignItems:'flex-end', gap:8, padding:'0 8px' }}>
        {[60,80,50,90,70,85,55].map((h, i) => (
            <div key={i} className="skeleton" style={{ flex:1, height:`${h}%`, borderRadius:'6px 6px 0 0' }} />
        ))}
    </div>
);

/* ════════════════════════════════════════════
   SKELETON PIE
════════════════════════════════════════════ */
const PieSkeleton = () => (
  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
    <div className="skeleton" style={{ width:120, height:120, borderRadius:'50%' }} />
    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
      {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height:14, borderRadius:6, width:`${60+i*8}%` }} />)}
    </div>
  </div>
);

/* ════════════════════════════════════════════
   FILTER DROPDOWN — custom pill dropdown
   props: value, onChange, options [{label,value}], type ("month"|"year")
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
                                className={`flt-item${isMonth ? ' flt-item-month' : ''}`+`${isSel ? ' selected' : ''}`}
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

export default function StatsFactures() {
    const { user }             = useAuth();
    const [statsOpen, setStatsOpen] = useState(true);


    /* ── Member Distribution states ── */
    const _now = new Date();
    const [memberFilterMonth, setMemberFilterMonth] = useState(_now.getMonth());
    const [memberFilterYear,  setMemberFilterYear]  = useState(_now.getFullYear());
    const [memberData,        setMemberData]        = useState([]);
    const [membresLoading,    setMembresLoading]    = useState(false);
    const [membresError,      setMembresError]      = useState(null);
    const [familleId,         setFamilleId]         = useState(null);

    /* ── Category Distribution states ── */
    const [catFilterMonth, setCatFilterMonth] = useState(_now.getMonth());
    const [catFilterYear,  setCatFilterYear]  = useState(_now.getFullYear());
    const [byCatData,      setByCatData]      = useState([]);
    const [catLoading,     setCatLoading]     = useState(false);

    /* ── All factures (flat) for evolution chart ── */
    const [allFactures,    setAllFactures]    = useState([]);
    const [allFacturesRaw, setAllFacturesRaw] = useState([]); // toutes les factures brutes → années dispo
    const [chartLoading, setChartLoading] = useState(true);

    /* ── Evolution chart state ── */
    const now = new Date();
    const [areaYear,     setAreaYear]     = useState(now.getFullYear());
    const [areaEndMonth, setAreaEndMonth] = useState(now.getMonth());

    /* ── Inject styles + Bootstrap Icons synchroniquement (avant le premier paint) ── */
    if (typeof document !== "undefined") {
        const id = "statsfactures-styles";
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

    /* ════ FETCH COMPLET — un seul useEffect pour éviter race condition ════ */
    useEffect(() => {
        if (!user?.username) return;
        async function fetchAll() {
            setMembresLoading(true);
            setMembresError(null);
            try {
                /* étape 1 : username → userId */
                const resUsers = await fetch(`${API_BASE}/users`);
                const allUsers = await resUsers.json();
                const currentUser = allUsers.find(u => u.username === user.username);
                if (!currentUser) throw new Error('Utilisateur introuvable');

                /* étape 2 : userId → familleId */
                const resAdmin = await fetch(`${API_BASE}/admins/user/${currentUser.id}`);
                const admin = await resAdmin.json();
                const fid = admin?.famille?.id;
                if (!fid) throw new Error('familleId introuvable');
                setFamilleId(fid);

                /* étape 3 : membres de la famille */
                const resMembres = await fetch(`${API_BASE}/familles/membres/${fid}`);
                const membresData = await resMembres.json();

                /* étape 4 : factures de chaque membre */
                const facturesParMembre = await Promise.all(
                    membresData.map(async (m) => {
                        const res = await fetch(`${API_BASE}/factures/membre/${m.id}`);
                        if (!res.ok) return { membre: m, factures: [] };
                        const factures = await res.json();
                        return { membre: m, factures };
                    })
                );

                /* étape 5 : flat array */
                const flat = facturesParMembre.flatMap(({ membre, factures }) =>
                    factures.map(f => ({ ...f, membre }))
                );

                /* étape 6 : agréger par membre pour le mois sélectionné */
                const selMonth = Number(memberFilterMonth);
                const selYear  = Number(memberFilterYear);

                const byMember = {};
                flat.forEach(f => {
                    if (f.statut !== 'PAYEE') return;
                    if (!f.dueDate) return;
                    const [yyyy, mm] = f.dueDate.split('-').map(Number);
                    if ((mm - 1) !== selMonth || yyyy !== selYear) return;
                    const memberId = f.membre?.id;
                    if (!memberId) return;
                    if (!byMember[memberId]) {
                        byMember[memberId] = {
                            label: `${f.membre?.user?.firstName || ''} ${f.membre?.user?.lastName || ''}`.trim() || `Membre ${memberId}`,
                            value: 0,
                        };
                    }
                    byMember[memberId].value += Number(f.amount);
                });

                const result = Object.values(byMember)
                    .filter(m => m.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .map((m, i) => ({ ...m, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }));

                setMemberData(result);

                /* stocker toutes les factures pour le chart évolution */
                setAllFactures(flat);
                setChartLoading(false);
            } catch (err) {
                console.error(err);
                setMembresError(err.message);
            } finally {
                setMembresLoading(false);
            }
        }
        fetchAll();
    }, [user?.username, memberFilterMonth, memberFilterYear]);

    /* ════ FETCH CATÉGORIES — via /factures/compte/{compteId}, agrégé en frontend ════ */
    useEffect(() => {
        if (!familleId) return;
        async function fetchCat() {
            setCatLoading(true);
            try {
                /* 1. familleId → compteId */
                const compRes = await fetch(`${API_BASE}/comptes/famille/${familleId}`);
                if (!compRes.ok) throw new Error(`Compte introuvable: ${compRes.status}`);
                const compte = await compRes.json();
                const cid = compte.id;

                /* 2. Toutes les factures du compte */
                const facRes = await fetch(`${API_BASE}/factures/compte/${cid}`);
                if (!facRes.ok) throw new Error(`Erreur factures: ${facRes.status}`);
                const facData = await facRes.json();

                /* 3. Enrichir catégorie si besoin (même logique que Factures.jsx) */
                let catLookup = {};
                try {
                    const catRes = await fetch(`${API_BASE}/categories/type/FACTURE`);
                    if (catRes.ok) {
                        const cats = await catRes.json();
                        cats.forEach(c => { catLookup[c.id] = c.name; });
                    }
                } catch (_) {}

                /* 4. Filtrer : statut PAYEE + dueDate correspond au mois/année sélectionnés */
                const selMonth = catFilterMonth; // 0-based
                const selYear  = catFilterYear;

                const byCategory = {};
                facData.forEach(f => {
                    if (f.statut !== 'PAYEE') return;
                    if (!f.dueDate) return;
                    // parse "YYYY-MM-DD" en local (même logique que Factures.jsx)
                    const [yyyy, mm] = f.dueDate.slice(0, 10).split('-').map(Number);
                    if ((mm - 1) !== selMonth || yyyy !== selYear) return;

                    // résoudre le nom de catégorie
                    let catName = f.categorie?.name;
                    if (!catName && f.categorie?.id) catName = catLookup[f.categorie.id];
                    if (!catName) catName = 'Sans catégorie';

                    byCategory[catName] = (byCategory[catName] || 0) + Number(f.amount ?? 0);
                });

                /* 5. Convertir en tableau [{label, value}] */
                const result = Object.entries(byCategory)
                    .map(([label, value]) => ({ label, value }))
                    .filter(d => d.value > 0)
                    .sort((a, b) => b.value - a.value);

                setByCatData(result);
                // stocker toutes les factures brutes pour dériver les années disponibles
                setAllFacturesRaw(facData);
            } catch (err) {
                console.error(err);
                setByCatData([]);
            } finally {
                setCatLoading(false);
            }
        }
        fetchCat();
    }, [familleId, catFilterMonth, catFilterYear]);


    /* ════ CHART ÉVOLUTION — Recharts (même pattern StatsCharges) ════ */

    /* Dériver les données de la fenêtre visible */
    const areaData = buildEvolutionDataForYear(allFactures, areaYear, areaEndMonth, 3);

    /* Années disponibles — extraites des vraies données backend (toutes les factures, pas seulement filtrées) */
    const availableYears = (() => {
        const yrs = new Set();
        // Source 1 : toutes les factures brutes du compte (la plus complète)
        allFacturesRaw.forEach(f => {
            if (f.dueDate) yrs.add(Number(f.dueDate.slice(0, 4)));
        });
        // Source 2 : factures plate du chart évolution (fallback si allFacturesRaw pas encore chargé)
        allFactures.forEach(f => {
            if (f.dueDate) yrs.add(Number(f.dueDate.split('-')[0]));
        });
        // Toujours inclure l'année courante pour ne jamais avoir une liste vide
        yrs.add(new Date().getFullYear());
        return Array.from(yrs).sort();
    })();

    function handleAreaYearChange(newYear) {
        setAreaYear(newYear);
        setAreaEndMonth(2); // repart toujours sur Janvier–Février–Mars
    }

    function shiftAreaWindow(direction) {
        setAreaEndMonth(prev => {
            const next = prev + direction;
            if (next < 2) return 2;
            if (next > 11) return 11;
            return next;
        });
    }

    /* ════ TOGGLE STATS SUBMENU ════ */
    function toggleStats(e) {
        e.preventDefault();
        setStatsOpen(prev => {
            const next = !prev;
            sessionStorage.setItem('statsMenuOpen', next ? 'true' : 'false');
            return next;
        });
    }

    /* ════ MEMBER TOTAL ════ */
    const memberTotal = memberData.reduce((a, b) => a + b.value, 0);

    /* ════ AREA Y TICKS — repères fixes adaptés à la magnitude + valeurs réelles ════ */
    const { areaYTicks, areaAllLineTicks } = (() => {
        const realValues = areaData.map(d => d.Factures).filter(v => typeof v === 'number' && v > 0);

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

    /* ════ CAT DATA — mappe PieChartDTO {label,value} → {label,value,color} ════ */
    const catData = byCatData
        .map((d, i) => ({ label: d.label, value: d.value, color: CAT_COLORS[i % CAT_COLORS.length] }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value);
    const catTotal = catData.reduce((a, b) => a + b.value, 0);

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
                                        <a className="nav-link active" href="/stats-factures">
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
                                <h5 className="mb-0">Analyse des Factures 🧾</h5>
                            </div>
                            <div className="col-auto align-self-center">
                                <span className="badge rounded-pill" style={{background:'rgba(220,38,38,0.1)',color:'#dc2626',fontSize:'11px'}}>
                                  {new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                                </span>
                            </div>
                        </div>

                        {/* ── Sub-navigation tabs ── */}
                        <div className="row gx-3 gx-lg-4 mb-3 anim-1">
                            <div className="col-12">
                                <div className="stats-nav-tabs">
                                    <a href="/stats-budget">Budget Global</a>
                                    <a href="/stats-revenus">Revenus</a>
                                    <a href="/stats-charges">Charges</a>
                                    <a href="/stats-factures" className="active">Factures</a>
                                </div>
                            </div>
                        </div>

                        {/* ── Chart 1 : Répartition par Membre (DONNÉES RÉELLES) ── */}
                        <div className="row gx-3 gx-lg-4 mb-3 anim-3">
                            <div className="col-12">
                                <div className="card adminuiux-card chart-card">
                                    <div className="card-body p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div>
                                                <p className="fw-semibold mb-0" style={{fontSize:'13px'}}>Répartition par Membre</p>
                                                <p className="chart-subtitle mb-0">
                                                    {membresLoading
                                                        ? 'Chargement…'
                                                        : membresError
                                                            ? `Erreur : ${membresError}`
                                                            : `Période sélectionnée · Total ${memberTotal.toLocaleString('fr-FR')} DT`
                                                    }
                                                </p>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <FilterDropdown
                                                    type="month"
                                                    value={memberFilterMonth}
                                                    onChange={v => setMemberFilterMonth(Number(v))}
                                                    options={MONTH_NAMES.map((m, i) => ({ label: m, value: i }))}
                                                />
                                                <FilterDropdown
                                                    value={memberFilterYear}
                                                    onChange={v => setMemberFilterYear(Number(v))}
                                                    options={availableYears.map(y => ({ label: String(y), value: y }))}
                                                />
                                            </div>
                                        </div>

                                        {membresLoading ? (
                                            <PieSkeleton />
                                        ) : membresError ? (
                                            <div style={{textAlign:'center', padding:'24px 0', opacity:0.45, fontSize:12}}>
                                                <i className="bi bi-exclamation-triangle" style={{fontSize:28}}></i>
                                                <p className="mb-0 mt-2">{membresError}</p>
                                            </div>
                                        ) : memberData.length === 0 ? (
                                            <div style={{textAlign:'center', padding:'24px 0', opacity:0.45, fontSize:12}}>
                                                <i className="bi bi-people" style={{fontSize:28}}></i>
                                                <p className="mb-0 mt-2">Aucune facture ce mois</p>
                                            </div>
                                        ) : (
                                            <div className="row gx-2 align-items-center">
                                                {/* Pie plein — identique Chart 1 StatsCharges */}
                                                <div className="col-6">
                                                    <ResponsiveContainer width="100%" height={195}>
                                                        <PieChart>
                                                            <Pie
                                                                data={memberData}
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
                                                                {memberData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                            </Pie>
                                                            <Tooltip formatter={v => `${Number(v).toLocaleString('fr-FR')} DT`} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                {/* Légende */}
                                                <div className="col-6">
                                                    <div className="d-flex flex-column gap-2">
                                                        {memberData.map((item, i) => {
                                                            const pct = memberTotal > 0 ? Math.round(item.value / memberTotal * 100) : 0;
                                                            return (
                                                                <div key={i} className="d-flex align-items-center gap-2">
                                                                    <span style={{width:10, height:10, borderRadius:3, background:item.color, flexShrink:0, display:'inline-block'}} />
                                                                    <div style={{minWidth:0, flex:1}}>
                                                                        <p className="mb-0 fw-medium" style={{fontSize:11, lineHeight:1.2}}>{item.label}</p>
                                                                        <p className="mb-0 text-secondary" style={{fontSize:10}}>{pct}%</p>
                                                                    </div>
                                                                    <span className="fw-semibold" style={{fontSize:11, whiteSpace:'nowrap'}}>
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

                        {/* ── Chart 2 : Évolution des Factures (Recharts) ── */}
                        <div className="row gx-3 gx-lg-4 mb-3 anim-4">
                            <div className="col-12">
                                <div className="card adminuiux-card chart-card">
                                    <div className="card-body p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div>
                                                <p className="fw-semibold mb-0" style={{fontSize:'13px'}}>Évolution des Factures</p>
                                                <p className="chart-subtitle mb-0">
                                                    {areaData.length > 0
                                                        ? `${areaData[0].mois} → ${areaData[areaData.length-1].mois} ${areaYear}`
                                                        : `Année ${areaYear}`
                                                    }
                                                </p>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                {/* Flèche gauche — mois plus anciens */}
                                                <button
                                                    onClick={() => shiftAreaWindow(-1)}
                                                    disabled={areaEndMonth <= 2}
                                                    style={{
                                                        border: '1.5px solid rgba(220,38,38,0.3)',
                                                        borderRadius: '50%', width: 26, height: 26,
                                                        background: areaEndMonth <= 2 ? 'rgba(0,0,0,0.04)' : 'rgba(220,38,38,0.07)',
                                                        color: areaEndMonth <= 2 ? '#aaa' : '#dc2626',
                                                        cursor: areaEndMonth <= 2 ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 14, fontWeight: 700, padding: 0,
                                                        transition: 'all .2s', flexShrink: 0,
                                                    }}
                                                    title="Mois précédents"
                                                >‹</button>
                                                {/* Flèche droite — mois plus récents */}
                                                <button
                                                    onClick={() => shiftAreaWindow(+1)}
                                                    disabled={areaEndMonth >= 11}
                                                    style={{
                                                        border: '1.5px solid rgba(220,38,38,0.3)',
                                                        borderRadius: '50%', width: 26, height: 26,
                                                        background: areaEndMonth >= 11 ? 'rgba(0,0,0,0.04)' : 'rgba(220,38,38,0.07)',
                                                        color: areaEndMonth >= 11 ? '#aaa' : '#dc2626',
                                                        cursor: areaEndMonth >= 11 ? 'not-allowed' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 14, fontWeight: 700, padding: 0,
                                                        transition: 'all .2s', flexShrink: 0,
                                                    }}
                                                    title="Mois suivants"
                                                >›</button>
                                                {/* Sélecteur d'année — années réelles depuis le backend */}
                                                <FilterDropdown
                                                    value={areaYear}
                                                    onChange={v => handleAreaYearChange(Number(v))}
                                                    options={availableYears.map(y => ({ label: String(y), value: y }))}
                                                />
                                            </div>
                                        </div>

                                        {chartLoading ? (
                                            <ChartSkeleton height={220} />
                                        ) : areaData.length === 0 ? (
                                            <div style={{ textAlign:'center', padding:'40px 0', opacity:0.45, fontSize:12 }}>
                                                <i className="bi bi-graph-up" style={{ fontSize:28 }}></i>
                                                <p className="mb-0 mt-2">Pas de données pour cette période</p>
                                            </div>
                                        ) : (
                                            <div
                                                onWheel={e => {
                                                    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                                                        e.preventDefault();
                                                        if (e.deltaX > 30)       shiftAreaWindow(-1);
                                                        else if (e.deltaX < -30) shiftAreaWindow(+1);
                                                    }
                                                }}
                                                onTouchStart={e => { window._areaSwipeX = e.touches[0].clientX; }}
                                                onTouchEnd={e => {
                                                    if (window._areaSwipeX == null) return;
                                                    const dx = e.changedTouches[0].clientX - window._areaSwipeX;
                                                    if (dx < -40)      shiftAreaWindow(-1);
                                                    else if (dx > 40)  shiftAreaWindow(+1);
                                                    window._areaSwipeX = null;
                                                }}
                                                style={{ touchAction: 'pan-y' }}
                                            >
                                                <ResponsiveContainer width="100%" height={220}>
                                                    <AreaChart data={areaData} margin={{ top:10, right:6, left:0, bottom:0 }}>
                                                        <defs>
                                                            <linearGradient id="gradFactRed" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.7} />
                                                                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.03} />
                                                            </linearGradient>
                                                        </defs>
                                                        {/* Pas de CartesianGrid — une ReferenceLine par tick garantit
                                                            une ligne pointillée identique pour toutes les valeurs */}
                                                        <XAxis dataKey="mois" tick={{ fontSize:10 }} axisLine={false} tickLine={false} />
                                                        <YAxis
                                                            tick={{ fontSize:9 }} axisLine={false} tickLine={false}
                                                            tickFormatter={v => `${Number(v).toLocaleString('fr-FR')} DT`} width={72}
                                                            ticks={areaYTicks}
                                                            domain={[0, 'auto']}
                                                        />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        {/* Une ReferenceLine par tick (base + dynamiques) — style uniforme */}
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
                                                            dataKey="Factures"
                                                            stroke="#ef4444"
                                                            strokeWidth={3.5}
                                                            fill="url(#gradFactRed)"
                                                            dot={{ r:4, fill:'#ef4444', strokeWidth:0 }}
                                                            activeDot={{ r:6, fill:'#dc2626' }}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* ── Chart 3 : Répartition par Catégorie des Factures (donut) ── */}
                        <div className="row gx-3 gx-lg-4 mb-4 anim-5">
                            <div className="col-12">
                                <div className="card adminuiux-card chart-card">
                                    <div className="card-body p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div>
                                                <p className="fw-semibold mb-0" style={{fontSize:'13px'}}>Répartition par Catégorie des Factures</p>
                                                <p className="chart-subtitle mb-0">
                                                    {catLoading
                                                        ? 'Chargement…'
                                                        : `Période sélectionnée · Total ${catTotal.toLocaleString('fr-FR')} DT`
                                                    }
                                                </p>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <FilterDropdown
                                                    type="month"
                                                    value={catFilterMonth}
                                                    onChange={v => setCatFilterMonth(Number(v))}
                                                    options={MONTH_NAMES.map((m, i) => ({ label: m, value: i }))}
                                                />
                                                <FilterDropdown
                                                    value={catFilterYear}
                                                    onChange={v => setCatFilterYear(Number(v))}
                                                    options={availableYears.map(y => ({ label: String(y), value: y }))}
                                                />
                                            </div>
                                        </div>

                                        {catLoading ? (
                                            <PieSkeleton />
                                        ) : catData.length === 0 ? (
                                            <div style={{textAlign:'center', padding:'24px 0', opacity:0.45, fontSize:12}}>
                                                <i className="bi bi-tag" style={{fontSize:28}}></i>
                                                <p className="mb-0 mt-2">Aucune catégorie trouvée</p>
                                            </div>
                                        ) : (
                                            <div className="row gx-2 align-items-center">
                                                {/* Donut Recharts */}
                                                <div className="col-6">
                                                    <ResponsiveContainer width="100%" height={195}>
                                                        <PieChart>
                                                            <Pie
                                                                data={catData}
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
                                                                {catData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                            </Pie>
                                                            <Tooltip formatter={v => `${Number(v).toLocaleString('fr-FR')} DT`} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                {/* Légende verticale */}
                                                <div className="col-6">
                                                    <div className="d-flex flex-column gap-2">
                                                        {catData.map((item, i) => {
                                                            const pct = catTotal > 0 ? Math.round(item.value / catTotal * 100) : 0;
                                                            return (
                                                                <div key={i} className="d-flex align-items-center gap-2">
                                                                    <span style={{width:10, height:10, borderRadius:3, background:item.color, flexShrink:0, display:'inline-block'}} />
                                                                    <div style={{minWidth:0, flex:1}}>
                                                                        <p className="mb-0 fw-medium" style={{fontSize:11, lineHeight:1.2}}>{item.label}</p>
                                                                        <p className="mb-0 text-secondary" style={{fontSize:10}}>{pct}%</p>
                                                                    </div>
                                                                    <span className="fw-semibold" style={{fontSize:11, whiteSpace:'nowrap'}}>
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
                            <a className="nav-link active" href="/stats-factures">
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
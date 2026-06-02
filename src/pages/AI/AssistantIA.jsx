import { useState, useRef, useEffect } from "react";

/* ════════════════════════════════════════
   STYLES (injected once)
════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Open+Sans:wght@400;500;600&display=swap');
  @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');

  :root {
    --adminuiux-content-font: "Open Sans", sans-serif;
    --adminuiux-content-font-weight: 400;
    --adminuiux-title-font: "Inter", sans-serif;
    --adminuiux-title-font-weight: 600;
  }

  .ai-header-banner {
    background: linear-gradient(135deg, #1a1f3a 0%, #2d3561 60%, #377CF4 100%);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    position: relative;
    overflow: hidden;
  }
  .ai-header-banner::before {
    content: '';
    position: absolute; top: -40px; right: -40px;
    width: 180px; height: 180px;
    background: rgba(55,124,244,0.25);
    border-radius: 50%;
  }
  .ai-header-banner::after {
    content: '';
    position: absolute; bottom: -50px; right: 80px;
    width: 120px; height: 120px;
    background: rgba(255,255,255,0.05);
    border-radius: 50%;
  }
  .ai-status-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 20px; padding: 4px 12px;
    font-size: 0.72rem; font-weight: 600; color: #fff;
  }
  .pulse-dot {
    width: 7px; height: 7px;
    background: #4ade80; border-radius: 50%;
    animation: pulse-anim 1.5s infinite;
  }
  @keyframes pulse-anim {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(1.4); }
  }

  .chat-scroll-area {
    max-height: 520px;
    overflow-y: auto;
    scroll-behavior: smooth;
    padding: 0.75rem 0.25rem;
  }
  .chat-scroll-area::-webkit-scrollbar { width: 4px; }
  .chat-scroll-area::-webkit-scrollbar-track { background: transparent; }
  .chat-scroll-area::-webkit-scrollbar-thumb { background: rgba(55,124,244,0.2); border-radius: 4px; }

  .msg-row { display: flex; gap: 10px; margin-bottom: 1rem; animation: msg-in 0.3s ease; }
  .msg-row.user-row { flex-direction: row-reverse; }
  @keyframes msg-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .msg-avatar {
    width: 34px; height: 34px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.95rem; flex-shrink: 0; align-self: flex-end;
  }
  .msg-avatar.ai-av  { background: linear-gradient(135deg,#1a1f3a,#377CF4); color: #fff; }
  .msg-avatar.usr-av { background: rgba(55,124,244,0.1); color: #377CF4; }

  .msg-content { max-width: 75%; }
  .user-row .msg-content { text-align: right; }

  .msg-bubble {
    display: inline-block;
    padding: 10px 14px; border-radius: 14px;
    font-size: 0.855rem; line-height: 1.6;
    text-align: left;
  }
  .msg-bubble.ai-bubble {
    background: #fff;
    border: 1px solid #dee2e6;
    border-bottom-left-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    width: 100%;
  }
  .msg-bubble.usr-bubble {
    background: linear-gradient(135deg,#377CF4,#2E3F8F);
    color: #fff;
    border-bottom-right-radius: 4px;
    box-shadow: 0 4px 14px rgba(55,124,244,0.35);
  }
  .msg-time {
    font-size: 0.67rem;
    color: #6c757d;
    margin-top: 3px; padding: 0 2px;
  }

  .ai-section {
    background: #f8f9fa;
    border-radius: 10px; padding: 10px 12px;
    margin-top: 8px; font-size: 0.825rem;
    border-left: 3px solid #377CF4;
  }
  .ai-section-label {
    font-size: 0.7rem; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    color: #377CF4; margin-bottom: 4px;
    display: flex; align-items: center; gap: 4px;
  }

  .trend-up   { background: rgba(220,53,69,0.1);  color: #dc3545; border-radius: 12px; padding: 1px 8px; font-size: 0.72rem; font-weight: 600; }
  .trend-down { background: rgba(25,135,84,0.1);  color: #198754; border-radius: 12px; padding: 1px 8px; font-size: 0.72rem; font-weight: 600; }

  .sim-card {
    background: linear-gradient(135deg, #fef3c7, #fff7ed);
    border: 1px solid #fcd34d; border-radius: 12px;
    padding: 12px 14px; margin-top: 10px; font-size: 0.825rem;
  }
  .sim-card-title {
    font-weight: 700; color: #92400e;
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 4px; font-size: 0.8rem;
  }

  .mini-chart-wrap {
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 12px; padding: 10px 12px; margin-top: 8px;
  }
  .mini-chart-wrap .chart-lbl {
    font-size: 0.7rem; font-weight: 600;
    color: #6c757d; margin-bottom: 6px;
  }

  .typing-row { display: flex; gap: 10px; margin-bottom: 0.75rem; animation: msg-in 0.25s ease; }
  .typing-bubble {
    background: #fff;
    border: 1px solid #dee2e6;
    border-radius: 14px; border-bottom-left-radius: 4px;
    padding: 10px 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .typing-dots { display: flex; gap: 4px; align-items: center; }
  .typing-dots span {
    width: 7px; height: 7px; background: #377CF4;
    border-radius: 50%; animation: bounce-dot 1.2s infinite;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce-dot {
    0%,80%,100% { transform: translateY(0); opacity: 0.5; }
    40%          { transform: translateY(-6px); opacity: 1; }
  }

  .chat-input-wrap {
    display: flex; align-items: flex-end; gap: 8px;
    background: #f8f9fa;
    border: 2px solid rgba(55,124,244,0.2);
    border-radius: 14px; padding: 8px 10px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .chat-input-wrap:focus-within {
    border-color: #377CF4;
    box-shadow: 0 0 0 4px rgba(55,124,244,0.1);
  }
  .ai-chat-input {
    flex: 1; background: none; border: none; outline: none;
    font-size: 0.875rem; font-family: "Open Sans", sans-serif;
    resize: none; max-height: 90px; min-height: 22px;
    color: inherit;
  }
  .btn-inp {
    width: 34px; height: 34px; border-radius: 9px; border: none;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; cursor: pointer; flex-shrink: 0;
    transition: all 0.18s;
  }
  .btn-mic  { background: #f0f0f0; color: #6c757d; }
  .btn-mic:hover  { background: rgba(55,124,244,0.12); color: #377CF4; }
  .btn-send {
    background: linear-gradient(135deg,#377CF4,#2E3F8F);
    color: #fff;
    box-shadow: 0 4px 12px rgba(55,124,244,0.35);
  }
  .btn-send:hover { transform: scale(1.06); box-shadow: 0 6px 18px rgba(55,124,244,0.45); }

  .conv-hist-item {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 12px; border-radius: 10px; cursor: pointer;
    font-size: 0.8rem; transition: background 0.15s; color: inherit;
  }
  .conv-hist-item:hover { background: rgba(55,124,244,0.07); }
  .conv-hist-item.active { background: rgba(55,124,244,0.1); color: #377CF4; font-weight: 600; }
  .conv-hist-item .conv-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .btn-del-conv {
    background: none; border: none; color: #dc3545; cursor: pointer;
    padding: 0 2px; font-size: 0.75rem; opacity: 0; transition: opacity 0.15s;
  }
  .conv-hist-item:hover .btn-del-conv { opacity: 1; }

  .ia-bloc {
    background: linear-gradient(135deg, #1a1f3a 0%, #2d3561 100%);
    border-radius: 16px;
  }
  .ia-item {
    background: rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 10px;
  }
  .ia-item:last-child { margin-bottom: 0; }

  .welcome-ai {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    min-height: 280px; text-align: center;
    color: #6c757d;
  }
  .welcome-ai-icon {
    width: 68px; height: 68px;
    background: linear-gradient(135deg,#1a1f3a,#377CF4);
    border-radius: 18px; display: flex;
    align-items: center; justify-content: center;
    font-size: 1.9rem; color: white; margin-bottom: 1rem;
    box-shadow: 0 10px 30px rgba(55,124,244,0.35);
    animation: float-anim 3s ease-in-out infinite;
  }
  @keyframes float-anim {
    0%,100% { transform: translateY(0); }
    50%      { transform: translateY(-8px); }
  }

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

  /* ── BUG 3 FIX: navbar bleeds through on scroll ── */
  .navbar.fixed-top {
    z-index: 1050 !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    background-color: inherit !important;
  }
`;

/* ════════════════════════════════════════
   MOCK AI RESPONSES
════════════════════════════════════════ */
const MOCK = {
  achat: {
    text: "Voici une analyse de votre capacité d'achat pour ce mois.",
    sections: [
      { icon: "🔍", title: "Analyse", body: "Votre solde disponible après les dépenses fixes est de <strong>380 DT</strong>. Vos dépenses variables sont dans la moyenne ce mois-ci." },
      { icon: "📊", title: "Impact", trend: "up", body: "Un achat supérieur à <strong>300 DT</strong> réduirait votre épargne mensuelle de 40% et pourrait compromettre votre objectif." },
      { icon: "💡", title: "Recommandation", body: "Vous pouvez effectuer cet achat si son montant est inférieur à <strong>250 DT</strong>. Sinon, envisagez un échelonnement ou reportez au mois prochain." }
    ]
  },
  augmenté: {
    text: "J'ai analysé l'évolution de vos dépenses sur les 3 derniers mois.",
    sections: [
      { icon: "🔍", title: "Analyse", trend: "up", body: "Vos dépenses <strong>alimentaires</strong> ont augmenté de <strong>18%</strong> ce mois-ci, passant de 520 DT à 614 DT." },
      { icon: "📊", title: "Impact", body: "Cette hausse représente <strong>94 DT supplémentaires</strong>. Combinée à la hausse carburant (+12%), votre reste à vivre a diminué de 12%." },
      { icon: "💡", title: "Recommandation", body: "Privilégiez les achats en gros pour les produits courants. Une économie de <strong>60 DT</strong> est réalisable dès ce mois." }
    ],
    chart: {
      labels: ["Jan", "Fév", "Mar"],
      datasets: [
        { label: "Alimentation", data: [490, 520, 614], borderColor: "#377CF4", backgroundColor: "rgba(55,124,244,0.1)", tension: 0.4, fill: true },
        { label: "Transport", data: [180, 195, 218], borderColor: "#377CF4", backgroundColor: "rgba(55,124,244,0.1)", tension: 0.4, fill: true }
      ]
    }
  },
  équilibrer: {
    text: "Voici mon plan d'équilibrage budgétaire personnalisé pour votre foyer.",
    sections: [
      { icon: "🔍", title: "Analyse", body: "Votre budget présente actuellement un <strong>déficit de 145 DT/mois</strong>. Les dépenses discrétionnaires représentent 38% du total." },
      { icon: "📊", title: "Impact", body: "À ce rythme, votre épargne tampon sera consommée en <strong>4 mois</strong>. Une intervention est recommandée ce mois-ci." },
      { icon: "💡", title: "Recommandation", body: "Abonnements inutilisés <strong>-40 DT</strong>, courses optimisées <strong>-60 DT</strong>, dépenses optionnelles <strong>-45 DT</strong>. Total récupérable : <strong>145 DT/mois</strong>." }
    ],
    simulation: "Simulation : En appliquant ces 3 actions, votre budget sera équilibré en 1 mois et vous générerez une épargne de +85 DT/mois d'ici 3 mois."
  },
  prévision: {
    text: "Voici la prévision de vos dépenses pour avril 2026 basée sur vos tendances récentes.",
    sections: [
      { icon: "🔍", title: "Analyse", body: "Dépenses totales prévues pour avril : <strong>2 340 DT</strong> (±5%), basé sur vos 3 derniers mois." },
      { icon: "📊", title: "Impact", body: "Hausses saisonnières attendues : énergie <strong>+8%</strong>, transport <strong>+5%</strong>. Épargne projetée : 210 DT." },
      { icon: "💡", title: "Recommandation", body: "Constituez dès maintenant une réserve de <strong>150 DT</strong> pour absorber les hausses prévues sans affecter votre épargne." }
    ],
    chart: {
      labels: ["Jan", "Fév", "Mar", "Avr (Prévu)"],
      datasets: [
        { label: "Réel", data: [2100, 2200, 2280, null], borderColor: "#377CF4", backgroundColor: "rgba(55,124,244,0.1)", tension: 0.4, fill: true },
        { label: "Prévu", data: [null, null, 2280, 2340], borderColor: "#fd7e14", backgroundColor: "rgba(253,126,20,0.08)", borderDash: [6, 3], tension: 0.4, fill: true }
      ]
    }
  },
  réduire: {
    text: "J'ai identifié les postes où vous pouvez réaliser des économies significatives.",
    sections: [
      { icon: "🔍", title: "Analyse", body: "4 catégories présentent des dépenses supérieures à la moyenne recommandée pour un foyer de votre taille." },
      { icon: "📊", title: "Impact", trend: "down", body: "Économies potentielles :<br>• Streaming/Abonnements : <strong>-45 DT</strong><br>• Restauration externe : <strong>-80 DT</strong><br>• Achats impulsifs : <strong>-60 DT</strong><br>• Énergie (optimisation) : <strong>-35 DT</strong>" },
      { icon: "💡", title: "Recommandation", body: "En appliquant ces réductions progressivement : <strong>220 DT/mois</strong> soit <strong>2 640 DT/an</strong> — de quoi financer un projet familial !" }
    ],
    simulation: "Simulation : Si vous réduisez vos dépenses de restauration de 50%, votre reste à vivre augmentera de 80 DT/mois, permettant d'atteindre votre objectif d'épargne 2 mois plus tôt."
  }
};

function getAI(q) {
  const lq = q.toLowerCase();
  if (lq.match(/achat|appareil|acheter/))         return MOCK.achat;
  if (lq.match(/augment|hausse|pourquoi/))        return MOCK["augmenté"];
  if (lq.match(/équilibr|balance|comment/))       return MOCK["équilibrer"];
  if (lq.match(/prévi|prochain|futur|prévision/)) return MOCK["prévision"];
  if (lq.match(/réduire|économis|où/))            return MOCK["réduire"];
  return {
    text: "J'ai analysé votre question en tenant compte de votre profil budgétaire.",
    sections: [
      { icon: "🔍", title: "Analyse", body: "Votre budget familial montre une gestion globalement <strong>équilibrée</strong>. Taux d'épargne actuel : 12% (objectif recommandé : 15%)." },
      { icon: "📊", title: "Impact", body: "Votre situation est <strong>stable</strong>, mais des optimisations sont possibles dans certaines catégories." },
      { icon: "💡", title: "Recommandation", body: "Identifiez les 2-3 postes prioritaires à optimiser ce mois-ci. Précisez votre question pour une analyse plus ciblée." }
    ]
  };
}

function nowTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/* ════════════════════════════════════════
   MINI CHART (canvas via Chart.js)
════════════════════════════════════════ */
let chartIdx = 0;

function MiniChart({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line",
      data,
      options: {
        responsive: true,
        plugins: { legend: { labels: { font: { size: 10 }, boxWidth: 10 } } },
        scales: {
          y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 10 } } },
          x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  return (
    <div className="mini-chart-wrap">
      <div className="chart-lbl">📈 Évolution graphique</div>
      <canvas ref={canvasRef} height={130}></canvas>
    </div>
  );
}

/* ════════════════════════════════════════
   MESSAGE COMPONENTS
════════════════════════════════════════ */
function UserMessage({ text, time }) {
  return (
    <div className="msg-row user-row">
      <div className="msg-content">
        <div className="msg-bubble usr-bubble">{text}</div>
        <div className="msg-time">{time}</div>
      </div>
      <div className="msg-avatar usr-av"><i className="bi bi-person-fill"></i></div>
    </div>
  );
}

function AIMessage({ resp, time }) {
  return (
    <div className="msg-row">
      <div className="msg-avatar ai-av">🤖</div>
      <div className="msg-content" style={{ maxWidth: "80%" }}>
        <div className="msg-bubble ai-bubble">
          <div style={{ marginBottom: resp.sections?.length ? "4px" : "0" }}>{resp.text}</div>
          {(resp.sections || []).map((s, i) => (
            <div className="ai-section" key={i}>
              <div className="ai-section-label">
                {s.icon} {s.title}
                {s.trend === "up" && <span className="trend-up ms-1"><i className="bi bi-arrow-up-right"></i> Hausse</span>}
                {s.trend === "down" && <span className="trend-down ms-1"><i className="bi bi-arrow-down-right"></i> Baisse</span>}
              </div>
              <div style={{ fontSize: "0.835rem" }} dangerouslySetInnerHTML={{ __html: s.body }} />
            </div>
          ))}
          {resp.chart && <MiniChart data={resp.chart} />}
          {resp.simulation && (
            <div className="sim-card">
              <div className="sim-card-title">🔮 Simulation de Scénario</div>
              <div>{resp.simulation}</div>
            </div>
          )}
        </div>
        <div className="msg-time">{time} · FamilyBalance AI</div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-row">
      <div className="msg-avatar ai-av">🤖</div>
      <div className="typing-bubble">
        <div className="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   CONVERSATION HISTORY ITEM
════════════════════════════════════════ */
function ConvHistItem({ conv, isActive, onDelete }) {
  return (
    <div
      className={`conv-hist-item${isActive ? " active" : ""}`}
      style={{ opacity: conv.deleting ? 0 : 1, transform: conv.deleting ? "translateX(20px)" : "none", transition: "all 0.25s ease" }}
    >
      <i className="bi bi-chat-text text-theme" style={{ fontSize: "0.75rem", flexShrink: 0 }}></i>
      <span className="conv-name">{conv.name}</span>
      <button className="btn-del-conv" onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}>
        <i className="bi bi-x"></i>
      </button>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
export default function AssistantIA() {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [convLabel, setConvLabel] = useState("Session actuelle");
  const [conversations, setConversations] = useState([{ id: "conv-0", name: "Session actuelle", active: true }]);
  const [statsOpen, setStatsOpen] = useState(false);
  const chatAreaRef = useRef(null);
  const textareaRef = useRef(null);

  // Inject styles once
  useEffect(() => {
    const id = "assistantia-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = STYLES;
      document.head.appendChild(el);
    }
    // Load Chart.js if needed
    if (!window.Chart) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      document.head.appendChild(script);
    }
    // Load Bootstrap Icons if not present
    if (!document.querySelector('link[href*="bootstrap-icons"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
      document.head.appendChild(link);
    }
  }, []);

  // Restore stats menu from sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem("statsMenuOpen") === "true") setStatsOpen(true);
  }, []);

  function scrollChat() {
    setTimeout(() => {
      if (chatAreaRef.current) chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }, 60);
  }

  function sendMessage() {
    const txt = inputVal.trim();
    if (!txt) return;

    setShowWelcome(false);
    const time = nowTime();
    setMessages(prev => [...prev, { type: "user", text: txt, time }]);
    setInputVal("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    // Update conv title
    setConversations(prev => prev.map(c => {
      if (c.active && (c.name === "Session actuelle" || c.name === "Nouvelle conversation")) {
        const newName = txt.length > 26 ? txt.slice(0, 26) + "…" : txt;
        setConvLabel(newName);
        return { ...c, name: newName };
      }
      return c;
    }));

    setIsTyping(true);
    scrollChat();

    const delay = 1100 + Math.random() * 700;
    setTimeout(() => {
      setIsTyping(false);
      const resp = getAI(txt);
      setMessages(prev => [...prev, { type: "ai", resp, time: nowTime() }]);
      scrollChat();
    }, delay);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 90) + "px";
  }

  function newConversation() {
    setMessages([]);
    setShowWelcome(true);
    const newId = "conv-new-" + Date.now();
    setConvLabel("Nouvelle conversation");
    setConversations(prev => [
      { id: newId, name: "Nouvelle conversation", active: true },
      ...prev.map(c => ({ ...c, active: false }))
    ]);
  }

  function deleteConv(id) {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, deleting: true } : c));
    setTimeout(() => setConversations(prev => prev.filter(c => c.id !== id)), 250);
  }

  function toggleStats(e) {
    e.preventDefault();
    const next = !statsOpen;
    setStatsOpen(next);
    sessionStorage.setItem("statsMenuOpen", String(next));
  }

  return (
    <div
      className="main-bg main-bg-blur main-bg-opac roundedui adminuiux-header-standard theme-purple adminuiux-mobile-footer-fill-white adminuiux-sidebar-fill-theme adminuiux-header-transparent adminuiux-sidebar-boxed bg-gradient-1 scrollup"
      data-theme="theme-purple"
    >

      {/* ════════════════════════════════════════
          HEADER — fixes z-index + icônes SVG inline + 3 lignes sidebar
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
      `}</style>

      <header className="adminuiux-header inner-page">
        <nav className="navbar navbar-expand-lg fixed-top">
          <div className="container-fluid">

            {/* ── 3 lignes menu sidebar (comme Dashboard) ── */}
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

            {/* ── Logo ── */}
            <a className="navbar-brand" href="/">
              <img data-bs-img="light" src="assets/img/family-balance-logo.png" alt="" />
              <img data-bs-img="dark"  src="assets/img/family-balance-logo.png" alt="" />
              <div className="lh-20 d-block ms-2">
                <span className="h4">FamilyBalance</span>
                <p className="company-tagline">Gestion budgétaire familiale</p>
              </div>
            </a>

            {/* ── Icônes droite (SVG inline) ── */}
            <div className="ms-auto d-flex align-items-center">

              {/* Soleil */}
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

        {/* ── SIDEBAR ── */}
        <div className="adminuiux-sidebar">
          <div className="adminuiux-sidebar-inner" style={{ paddingBottom: 80, overflowY: "auto", height: "100%" }}>

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

            <ul className="nav flex-column menu-active-line mt-0">
              <li className="nav-item"><a className="nav-link" href="/"><div className="avatar avatar-30 icon"><i className="bi bi-house-door"></i></div><div className="col">Accueil</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/revenus"><div className="avatar avatar-30 icon"><i className="bi bi-graph-up-arrow"></i></div><div className="col">Revenus</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/charges"><div className="avatar avatar-30 icon"><i className="bi bi-wallet2"></i></div><div className="col">Charges</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/factures"><div className="avatar avatar-30 icon"><i className="bi bi-receipt"></i></div><div className="col">Factures</div></a></li>

              {/* ══ STATISTIQUES avec sous-menu ══ */}
              <li className={`nav-item nav-item-stats${statsOpen ? " stats-open" : ""}`} id="statsNavItem">
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
              <li className="nav-item"><a className="nav-link active" href="/chat"><div className="avatar avatar-30 icon"><i className="bi bi-robot"></i></div><div className="col">IA Chat</div></a></li>
              <li className="nav-item"><a className="nav-link" href="/profile"><div className="avatar avatar-30 icon"><i className="bi bi-person-circle"></i></div><div className="col">Profil</div></a></li>
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

            {/* 1. BREADCRUMB */}
            <div className="row gx-3 mb-3">
              <div className="col-12">
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-1" style={{ fontSize: "0.78rem" }}>
                    <li className="breadcrumb-item"><a href="/" className="text-theme-1 style-none">Accueil</a></li>
                    <li className="breadcrumb-item active">Assistant Intelligent</li>
                  </ol>
                </nav>
              </div>
            </div>

            {/* 2. BANNER HEADER AI */}
            <div className="ai-header-banner mb-4">
              <div className="row gx-3 align-items-center position-relative">
                <div className="col-auto">
                  <div className="avatar avatar-60 rounded-4 d-flex align-items-center justify-content-center"
                    style={{ background: "rgba(255,255,255,0.15)", fontSize: "1.8rem" }}>
                    🤖
                  </div>
                </div>
                <div className="col">
                  <h5 className="text-white fw-bold mb-1" style={{ fontFamily: "'Inter',sans-serif" }}>
                    Assistant Intelligent
                  </h5>
                  <p className="mb-2" style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.82rem" }}>
                    Analysez, anticipez et optimisez votre budget familial
                  </p>
                  <div className="ai-status-badge">
                    <span className="pulse-dot"></span>
                    Analyse active · Données temps réel
                  </div>
                </div>
                <div className="col-auto d-none d-md-flex flex-column gap-2 text-end">
                  <span className="badge rounded-pill" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "0.72rem" }}>📊 Analyse</span>
                  <span className="badge rounded-pill" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "0.72rem" }}>📈 Prévisions</span>
                  <span className="badge rounded-pill" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "0.72rem" }}>🔮 Simulation</span>
                </div>
              </div>
            </div>

            {/* 4. ZONE DE CONVERSATION */}
            <div className="card adminuiux-card mb-4">
              <div className="card-header border-0 pb-0">
                <div className="d-flex align-items-center gap-2">
                  <div className="avatar avatar-40 rounded-3" style={{ background: "rgba(55,124,244,0.12)" }}>
                    <i className="bi bi-robot" style={{ color: "#377CF4", fontSize: "1.1rem" }}></i>
                  </div>
                  <div>
                    <p className="fw-bold mb-0" style={{ fontSize: "0.875rem" }}>
                      Conversation avec FamilyBalance AI
                    </p>
                    <p className="text-secondary mb-0" style={{ fontSize: "0.72rem" }}>
                      {convLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-body">
                {/* Chat scroll area */}
                <div className="chat-scroll-area" ref={chatAreaRef}>

                  {/* Welcome State */}
                  {showWelcome && (
                    <div className="welcome-ai">
                      <div className="welcome-ai-icon">🤖</div>
                      <h6 className="fw-bold mb-2" style={{ fontFamily: "'Inter',sans-serif" }}>
                        Bonjour, je suis votre assistant FamilyBalance
                      </h6>
                      <p className="text-secondary small mb-3" style={{ maxWidth: 340, lineHeight: 1.6 }}>
                        Posez-moi vos questions sur votre budget, vos dépenses
                        ou demandez une analyse de votre situation financière.
                      </p>
                      <div className="d-flex gap-2 flex-wrap justify-content-center">
                        <span className="badge rounded-pill" style={{ background: "rgba(55,124,244,0.1)", color: "#377CF4", fontSize: "0.75rem" }}>📊 Analyse</span>
                        <span className="badge rounded-pill" style={{ background: "rgba(55,124,244,0.1)", color: "#377CF4", fontSize: "0.75rem" }}>📈 Prévisions</span>
                        <span className="badge rounded-pill" style={{ background: "rgba(25,135,84,0.1)", color: "#198754", fontSize: "0.75rem" }}>💡 Conseils</span>
                        <span className="badge rounded-pill" style={{ background: "rgba(253,193,7,0.15)", color: "#997404", fontSize: "0.75rem" }}>🔮 Simulations</span>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map((msg, i) =>
                    msg.type === "user"
                      ? <UserMessage key={i} text={msg.text} time={msg.time} />
                      : <AIMessage key={i} resp={msg.resp} time={msg.time} />
                  )}

                  {/* Typing indicator */}
                  {isTyping && <TypingIndicator />}

                </div>

                {/* Input Bar */}
                <div className="mt-3">
                  <div className="chat-input-wrap">
                    <button className="btn-inp btn-mic" title="Microphone (simulé)">
                      <i className="bi bi-mic"></i>
                    </button>
                    <textarea
                      ref={textareaRef}
                      className="ai-chat-input"
                      rows={1}
                      value={inputVal}
                      placeholder="Posez une question sur votre situation financière..."
                      onKeyDown={handleKey}
                      onChange={e => { setInputVal(e.target.value); autoGrow(e.target); }}
                    />
                    <button
                      className="btn-inp"
                      onClick={newConversation}
                      title="Nouvelle conversation"
                      style={{ background: "rgba(55,124,244,0.1)", color: "#377CF4", width: 34, height: 34, borderRadius: 9, border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", cursor: "pointer", flexShrink: 0, transition: "all 0.18s" }}
                    >
                      <i className="bi bi-plus-lg"></i>
                    </button>
                    <button className="btn-inp btn-send" onClick={sendMessage} title="Envoyer">
                      <i className="bi bi-send-fill"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════
          TAB BAR MOBILE
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
              <a className="nav-link active" href="/chat">
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
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';

const API = 'http://localhost:8080';

/* ══════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════ */
const MOIS_LISTE = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

/* Normalise un nom de catégorie pour la comparaison (accents + casse) */
function normalizeCatName(name) {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* Meta visuelle par catégorie FACTURE (clés normalisées) */
const FAC_META_RAW = {
  'facture electricite': { emoji: '⚡', css: 'cbdg-energie'   },
  'electricite':         { emoji: '⚡', css: 'cbdg-energie'   },
  'facture eau':         { emoji: '💧', css: 'cbdg-telecom'   },
  'eau':                 { emoji: '💧', css: 'cbdg-telecom'   },
  'facture gaz':         { emoji: '🔥', css: 'cbdg-energie'   },
  'gaz':                 { emoji: '🔥', css: 'cbdg-energie'   },
  'facture internet':    { emoji: '📶', css: 'cbdg-telecom'   },
  'internet':            { emoji: '📶', css: 'cbdg-telecom'   },
  'autre facture':       { emoji: '🗂️', css: 'cbdg-autre'     },
  'logement':            { emoji: '🏠', css: 'cbdg-logement'  },
  'energie':             { emoji: '⚡', css: 'cbdg-energie'   },
  'telecommunications':  { emoji: '📡', css: 'cbdg-telecom'   },
  'education':           { emoji: '📚', css: 'cbdg-education' },
  'sante':               { emoji: '💊', css: 'cbdg-sante'     },
  'assurance':           { emoji: '🛡️', css: 'cbdg-assurance' },
};

/* Couleurs dynamiques pour catégories personnalisées */
const CUSTOM_CSS = ['cbdg-logement','cbdg-energie','cbdg-telecom','cbdg-education','cbdg-sante','cbdg-assurance'];
function getCustomFacMeta(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const css = CUSTOM_CSS[Math.abs(hash) % CUSTOM_CSS.length];
  return { emoji: '🏷️', css };
}
function getFacMeta(name) {
  return FAC_META_RAW[normalizeCatName(name)] ?? getCustomFacMeta(name);
}

/* Type Fixe / Variable — persisté en BDD côté backend (Facture.type).
   Mapping bidirectionnel UI ↔ enum backend. */
const TYPE_TO_BACKEND   = { 'Fixe':'FIXE', 'Variable':'VARIABLE' };
const TYPE_FROM_BACKEND = { 'FIXE':'Fixe', 'VARIABLE':'Variable' };

const STATUT_TO_BACKEND        = { 'En attente':'NON_PAYEE', 'Payée':'PAYEE', 'En retard':'NON_PAYEE' };
const STATUT_FROM_BACKEND      = { 'PAYEE':'paid', 'NON_PAYEE':'pending', 'EN_RETARD':'late' };

const todayIsoStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const FORM_INIT = {
  nom:'', categorieId:'', categorie:'', nouvelleCategorie:'', montant:'',
  // Aligné sur le web Angular : issueDate (obligatoire) + dueDate (facultatif).
  // type = UI-only (Fixe / Variable), n'est pas envoyé au backend — la Facture
  // backend n'a pas de champ type.
  issueDate: todayIsoStr(),
  echeance:'', type:'Fixe', statut:'En attente',
  // Date à laquelle l'argent sort effectivement. Imposée à aujourd'hui quand
  // statut === 'Payée' — règle métier "imputé au mois courant".
  datePaiement: todayIsoStr(),
  membreId:'', image:null, imagePreview:null, imageFile:null, fileName:'',
};

/* ══ Transformer API → UI ══ */
function mapFacture(f) {
  const statutRaw = STATUT_FROM_BACKEND[f.statut] ?? 'pending';
  // dueDate est le champ backend (LocalDate → string ISO "YYYY-MM-DD")
  // ⚠️ On évite new Date(isoString) qui interprète en UTC et décale d'un jour
  // en début de mois selon le fuseau (ex: Tunisie UTC+1).
  // On parse manuellement pour rester en heure locale.
  const parsedDate = f.dueDate
    ? (() => {
        const [y, m, d] = f.dueDate.slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d); // ✅ date locale, pas UTC
      })()
    : null;
  // EN_RETARD du backend prime ; sinon fallback frontend : NON_PAYEE + dueDate dépassée → late
  const today    = new Date(); today.setHours(0,0,0,0);
  const statutUI = statutRaw === 'late'
    ? 'late'
    : (statutRaw === 'pending' && parsedDate && parsedDate < today) ? 'late' : statutRaw;
  const echeanceLabel = parsedDate
    ? parsedDate.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
    : '—';
  // ✅ Lecture directe depuis la string ISO → zéro décalage UTC
  // Filtres mois/année : on s'appuie sur issueDate (toujours présent côté
  // backend) avec dueDate en repli. Le web Angular rend dueDate facultatif
  // et filtre par issueDate ; sans ce fallback, les factures créées depuis
  // le web sans échéance étaient invisibles ici à cause du filtre par
  // défaut (mois/année courants).
  const filterDate = f.issueDate || f.dueDate;
  const moisLabel  = filterDate ? MOIS_LISTE[parseInt(filterDate.slice(5, 7)) - 1] : '';
  const anneeLabel = filterDate ? filterDate.slice(0, 4) : '';

  const membreNom = f.membre?.user
    ? `${f.membre.user.firstName ?? ''} ${f.membre.user.lastName ?? ''}`.trim()
    : f.membre?.id ? `Membre #${f.membre.id}` : '—';

  const catNom = f.categorie?.name ?? 'Autre';
  return {
    id:          f.id,
    nom:         f.title ?? catNom ?? 'Facture',
    membreId:    f.membre?.id ?? null,
    membre:      membreNom,
    cat:         catNom,
    categorieId: f.categorie?.id ?? null,
    statut:      statutUI,
    // Type backend (FIXE | VARIABLE) → libellé UI (Fixe | Variable).
    // Fallback Variable pour les factures créées avant l'ajout du champ.
    type:        TYPE_FROM_BACKEND[f.type] ?? 'Variable',
    montant:     f.amount ?? 0,
    echeance:    echeanceLabel,
    rawIssueDate: f.issueDate ?? '',
    rawEcheance: f.dueDate ?? '',
    rawDatePaiement: f.datePaiement ?? '',
    mois:        moisLabel,
    annee:       anneeLabel,
    image:       f.fileUrl ? `${API}${f.fileUrl}` : null,
    fileName:    f.fileName ?? '',
    fileUrl:     f.fileUrl ?? '',
  };
}

/* ══ Helpers UI ══ */
function CatBadge({ cat }) {
  const meta = getFacMeta(cat);
  return <span className={`cbdg ${meta.css}`}>{cat}</span>;
}

function TypeBadge({ type }) {
  const isFixe = type === 'Fixe';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '10.5px',
      fontWeight: 700,
      lineHeight: 1.4,
      border: '1px solid',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: isFixe ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.10)',
      color:      isFixe ? '#16a34a'             : '#dc2626',
      borderColor:isFixe ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)',
    }}>{type}</span>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop-custom" style={{ zIndex:1060 }} onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth:400, padding:0 }} onClick={e => e.stopPropagation()}>
        <div className="p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div style={{ width:44,height:44,borderRadius:'50%',flexShrink:0,background:'rgba(239,68,68,.12)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ color:'#ef4444',fontSize:'1.3rem' }}></i>
            </div>
            <div>
              <h6 className="fw-bold mb-0">Confirmer la suppression</h6>
              <p className="text-secondary small mb-0">{message}</p>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button className="btn btn-outline-secondary rounded-3 px-3 btn-sm" onClick={onCancel}>
              <i className="bi bi-x-lg me-1"></i>Annuler
            </button>
            <button className="btn btn-sm rounded-3 px-3" style={{ background:'#ef4444',color:'#fff',border:'none' }} onClick={onConfirm}>
              <i className="bi bi-trash3 me-1"></i>Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══ FactCategorySelect : dropdown catégories FACTURE avec ajout/suppression ══ */
/* ══ Liste preset des catégories de Factures (ordre identique à la maquette) ══ */
const FACTURE_PRESETS = [
  'Électricité',
  'Eau',
  'Internet',
  'Loyer',
  'Assurance',
  'Téléphone',
  'Santé',
  'Éducation',
  'Alimentation',
  'Transport',
  'Autre',
];
const FACTURE_PRESET_KEYS = new Set(FACTURE_PRESETS.map(n => normalizeCatName(n)));

function FactCategorySelect({ value, onChange, categories, onAddCategory, onDeleteCategory }) {
  const [open, setOpen]           = React.useState(false);
  const [addingNew, setAddingNew] = React.useState(false);
  const [newName, setNewName]     = React.useState('');
  const ref      = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAddingNew(false); setNewName(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  React.useEffect(() => { if (addingNew && inputRef.current) inputRef.current.focus(); }, [addingNew]);

  /* Index des catégories DB par nom normalisé — pour lier preset ↔ DB */
  const dbCatByName = React.useMemo(() => {
    const map = {};
    for (const c of categories) {
      const k = normalizeCatName(c.name);
      // garder la 1re ou la is_default=1 en priorité
      if (!map[k] || (c.isDefault ?? c.is_default)) map[k] = c;
    }
    return map;
  }, [categories]);

  /* Catégories personnalisées = DB sans correspondance preset */
  const customCats = categories.filter(c => !FACTURE_PRESET_KEYS.has(normalizeCatName(c.name)));

  const selected = categories.find(c => String(c.id) === String(value));
  const selLabel = selected ? selected.name : null;

  /* Click sur un preset : utilise la catégorie DB existante OU la crée à la volée.
     Cas particulier "Autre" : ouvre le champ inline de saisie (comme dans Charges
     et Revenus) pour saisir le vrai nom au lieu d'enregistrer "Autre" tel quel. */
  const handlePresetClick = async (presetName) => {
    if (normalizeCatName(presetName) === 'autre') {
      setAddingNew(true);
      setNewName('');
      return;
    }
    setOpen(false);
    const existing = dbCatByName[normalizeCatName(presetName)];
    if (existing) {
      onChange(String(existing.id), existing);
      return;
    }
    const created = await onAddCategory(presetName);
    if (created) onChange(String(created.id), created);
  };

  const handleAdd = async () => {
    const nom = newName.trim();
    if (!nom) return;
    const newCat = await onAddCategory(nom);
    if (newCat) onChange(String(newCat.id), newCat);
    setNewName(''); setAddingNew(false); setOpen(false);
  };

  const handleDelete = (e, cat) => {
    e.stopPropagation();
    onDeleteCategory(cat.id, cat.name);
    if (String(value) === String(cat.id)) onChange('', null);
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button type="button" onClick={() => { setOpen(o => !o); setAddingNew(false); setNewName(''); }}
        className="form-select form-select-sm rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{ fontSize:'13px', height:'32px', cursor:'pointer',
          border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          background:'#fff', color: selLabel ? '#212529' : '#6c757d' }}>
        <span>{selLabel ?? 'Catégorie'}</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:'11px', opacity:.6 }}></i>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'#fff', borderRadius:'10px', border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 8px 24px rgba(0,0,0,.13)', zIndex:9999, maxHeight:'260px', overflowY:'auto' }}>

          {/* Catégories preset — toujours affichées (ordre maquette).
              "Autre" déclenche le champ inline de saisie (cf. handlePresetClick). */}
          {FACTURE_PRESETS.map(name => {
            const isAutre = normalizeCatName(name) === 'autre';
            const dbCat  = dbCatByName[normalizeCatName(name)];
            const isSel  = !isAutre && dbCat && String(dbCat.id) === String(value);
            const label  = isAutre ? 'Autre (préciser)' : name;
            return (
              <div key={name} onMouseDown={() => handlePresetClick(name)}
                style={{ padding:'7px 12px', fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px',
                  background: isSel ? 'rgba(55,124,244,.09)' : 'transparent',
                  color: isSel ? 'var(--clr-primary)' : '#212529', fontWeight: isSel ? 600 : 400 }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='rgba(55,124,244,.05)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent'; }}>
                <span style={{ flex:1 }}>{label}</span>
                {isSel && <i className="bi bi-check2" style={{ color:'var(--clr-primary)', fontSize:'13px' }}></i>}
              </div>
            );
          })}

          {/* Catégories personnalisées */}
          {customCats.length > 0 && (
            <>
              <div style={{ padding:'5px 12px 3px', fontSize:'10px', fontWeight:700, letterSpacing:'.8px',
                color:'#94a3b8', textTransform:'uppercase', borderTop:'1px solid rgba(0,0,0,.06)', marginTop:'2px' }}>
                Personnalisées
              </div>
              {customCats.map(cat => {
                const isSel = String(cat.id) === String(value);
                return (
                  <div key={cat.id}
                    style={{ padding:'7px 12px', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px',
                      background: isSel ? 'rgba(55,124,244,.09)' : 'transparent' }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='rgba(55,124,244,.05)'; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent'; }}>
                    <span onMouseDown={() => { onChange(String(cat.id), cat); setOpen(false); }}
                      style={{ flex:1, cursor:'pointer', color: isSel ? 'var(--clr-primary)' : '#212529', fontWeight: isSel ? 600 : 400 }}>
                      {cat.name}
                    </span>
                    {isSel && <i className="bi bi-check2" style={{ color:'var(--clr-primary)', fontSize:'13px' }}></i>}
                    <button type="button" onMouseDown={e => handleDelete(e, cat)}
                      style={{ width:'20px', height:'20px', borderRadius:'50%', border:'none',
                        background:'rgba(239,68,68,.15)', color:'#ef4444', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', padding:0 }}
                      onMouseEnter={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,.15)'; e.currentTarget.style.color='#ef4444'; }}>
                      ✕
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Ajouter */}
          <div style={{ borderTop:'1px solid rgba(0,0,0,.06)', marginTop:'2px' }}>
            {!addingNew ? (
              <div onMouseDown={e => { e.preventDefault(); setAddingNew(true); }}
                style={{ padding:'8px 12px', fontSize:'13px', cursor:'pointer', color:'var(--clr-primary)', fontWeight:600,
                  display:'flex', alignItems:'center', gap:'7px' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(55,124,244,.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}>
                <i className="bi bi-plus-circle" style={{ fontSize:'13px' }}></i>
                + Ajouter une catégorie
              </div>
            ) : (
              <div style={{ padding:'7px 10px', display:'flex', gap:'5px', alignItems:'center' }}
                onMouseDown={e => e.stopPropagation()}>
                <input ref={inputRef} type="text" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); handleAdd(); } if (e.key==='Escape') { setAddingNew(false); setNewName(''); } }}
                  placeholder="Nom de la catégorie..."
                  style={{ flex:1, height:'28px', padding:'0 8px', fontSize:'12px',
                    border:'1.5px solid rgba(55,124,244,.4)', borderRadius:'7px', outline:'none' }} />
                <button type="button" onMouseDown={e => { e.preventDefault(); handleAdd(); }}
                  style={{ height:'28px', padding:'0 9px', fontSize:'12px', fontWeight:600,
                    background:'var(--clr-primary)', color:'#fff', border:'none', borderRadius:'7px', cursor:'pointer' }}>
                  OK
                </button>
                <button type="button" onMouseDown={e => { e.preventDefault(); setAddingNew(false); setNewName(''); }}
                  style={{ height:'28px', width:'28px', background:'rgba(100,116,139,.1)', color:'#64748b',
                    border:'none', borderRadius:'7px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className="bi bi-x"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ ModalDatePicker : input texte jj/mm/aaaa + calendrier (identique à RevenusListe) ══ */
function ModalDatePicker({ value, onChange }) {
  const [open, setOpen]           = React.useState(false);
  const [inputText, setInputText] = React.useState(value ? value.split('-').reverse().join('/') : '');
  const [viewY, setViewY]         = React.useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear());
  const [viewM, setViewM]         = React.useState(() => value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth());
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    setInputText(value ? value.split('-').reverse().join('/') : '');
    if (value) { setViewY(parseInt(value.split('-')[0])); setViewM(parseInt(value.split('-')[1]) - 1); }
  }, [value]);

  React.useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selDay = value ? parseInt(value.split('-')[2]) : null;
  const selM   = value ? parseInt(value.split('-')[1]) - 1 : null;
  const selY   = value ? parseInt(value.split('-')[0]) : null;

  const firstDay    = new Date(viewY, viewM, 1).getDay();
  const startOff    = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const cells = Array.from({ length: startOff + daysInMonth }, (_, i) => i < startOff ? null : i - startOff + 1);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (viewM === 0) { setViewM(11); setViewY(y => y-1); } else setViewM(m => m-1); };
  const nextMonth = () => { if (viewM === 11) { setViewM(0); setViewY(y => y+1); } else setViewM(m => m+1); };

  const selectDay = (d) => {
    if (!d) return;
    const iso = `${viewY}-${String(viewM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    onChange(iso);
    setInputText(`${String(d).padStart(2,'0')}/${String(viewM+1).padStart(2,'0')}/${viewY}`);
    setOpen(false);
  };

  const todayClick = () => { const t = new Date(); setViewM(t.getMonth()); setViewY(t.getFullYear()); selectDay(t.getDate()); };

  const handleInputChange = (e) => {
    let raw = e.target.value.replace(/[^0-9/]/g, '');

    // Extraire les segments JJ / MM / AAAA
    const segments = raw.split('/');
    const ddRaw   = segments[0] ?? '';
    const mmRaw   = segments[1] ?? '';
    const yyyyRaw = segments[2] ?? '';

    // Bloquer JJ invalide : max 2 chiffres, valeur 01-31
    if (ddRaw.length === 2) {
      const dd = parseInt(ddRaw);
      if (dd < 1 || dd > 31) return;
    }

    // Bloquer MM invalide : max 2 chiffres, valeur 01-12
    if (mmRaw.length >= 1) {
      if (mmRaw.length === 1 && parseInt(mmRaw[0]) > 1) return; // ex: "2" → mois 20+ impossible
      if (mmRaw.length === 2) {
        const mm = parseInt(mmRaw);
        if (mm < 1 || mm > 12) return;
      }
    }

    // Bloquer AAAA : max 4 chiffres
    if (yyyyRaw.length > 4) return;

    // Auto-insertion des slashes
    if (raw.length === 2 && !raw.includes('/')) raw = raw + '/';
    if (raw.length === 5 && raw.split('/').length === 2) raw = raw + '/';
    if (raw.length > 10) raw = raw.slice(0, 10);

    setInputText(raw);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split('/');
      const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy);
      if (m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate()) {
        onChange(`${yyyy}-${mm}-${dd}`);
        setViewY(y); setViewM(m - 1);
      }
    }
    if (raw === '') onChange('');
  };

  const isSel   = (d) => d && selDay === d && selM === viewM && selY === viewY;
  const isToday = (d) => { const t = new Date(); return d && t.getDate()===d && t.getMonth()===viewM && t.getFullYear()===viewY; };
  const JOURS   = ['Lu','Ma','Me','Je','Ve','Sa','Di'];

  return (
    <div ref={wrapRef} style={{ position:'relative', overflow:'visible' }}>
      <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
        <input
          type="text"
          className="form-control form-control-sm rounded-3"
          placeholder="jj/mm/aaaa"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          style={{ fontSize:'13px', height:'32px', paddingRight:'30px',
            border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
            boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none' }}
        />
        <i className="bi bi-calendar3"
          onClick={() => setOpen(o => !o)}
          style={{ position:'absolute', right:'9px', fontSize:'12px', opacity:.5, cursor:'pointer', color:'#6c757d' }}
        />
      </div>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, left:'auto',
          width:'224px', background:'#fff', borderRadius:'12px',
          border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 8px 24px rgba(0,0,0,.13)',
          zIndex:99999, padding:'10px' }}>

          <div className="d-flex align-items-center justify-content-between mb-2">
            <button type="button" onMouseDown={e => { e.preventDefault(); prevMonth(); }}
              style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 8px', borderRadius:'6px', fontSize:'14px', color:'var(--clr-primary)' }}>
              <i className="bi bi-chevron-left"></i>
            </button>
            <span style={{ fontSize:'12px', fontWeight:700, color:'#212529' }}>{MOIS_LISTE[viewM]} {viewY}</span>
            <button type="button" onMouseDown={e => { e.preventDefault(); nextMonth(); }}
              style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 8px', borderRadius:'6px', fontSize:'14px', color:'var(--clr-primary)' }}>
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'1px', marginBottom:'3px' }}>
            {JOURS.map(j => <div key={j} style={{ textAlign:'center', fontSize:'10px', fontWeight:700, color:'#94a3b8' }}>{j}</div>)}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'1px' }}>
            {cells.map((d, i) => (
              <button key={i} type="button"
                onMouseDown={e => { e.preventDefault(); selectDay(d); }}
                disabled={!d}
                style={{ border:'none', borderRadius:'6px', padding:'5px 1px', fontSize:'11px',
                  fontWeight: isSel(d) ? 700 : 400, cursor: d ? 'pointer' : 'default',
                  background: isSel(d) ? 'var(--clr-primary)' : isToday(d) ? 'rgba(55,124,244,.12)' : 'transparent',
                  color: isSel(d) ? '#fff' : isToday(d) ? 'var(--clr-primary)' : d ? '#212529' : 'transparent',
                  transition:'background .12s' }}
                onMouseEnter={e => { if (d && !isSel(d)) e.currentTarget.style.background='rgba(55,124,244,.08)'; }}
                onMouseLeave={e => { if (d && !isSel(d)) e.currentTarget.style.background = isToday(d) ? 'rgba(55,124,244,.12)' : 'transparent'; }}>
                {d ?? ''}
              </button>
            ))}
          </div>

          <div style={{ borderTop:'1px solid rgba(0,0,0,.06)', marginTop:'8px', paddingTop:'6px', textAlign:'center' }}>
            <button type="button" onMouseDown={e => { e.preventDefault(); todayClick(); }}
              style={{ background:'none', border:'none', fontSize:'11px', color:'var(--clr-primary)', fontWeight:600, cursor:'pointer' }}>
              Aujourd'hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ ModalSelect : dropdown générique style Catégorie ══ */
function ModalSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => String(o.value) === String(value));
  const selLabel = selected ? selected.label : null;

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="form-select form-select-sm rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{ fontSize:'13px', height:'32px', cursor:'pointer',
          border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          background:'#fff', color: selLabel ? '#212529' : '#6c757d' }}>
        <span>{selLabel ?? placeholder}</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:'11px', opacity:.6 }}></i>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'#fff', borderRadius:'10px', border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 8px 24px rgba(0,0,0,.13)', zIndex:9999, maxHeight:'260px', overflowY:'auto' }}>
          {options.map(opt => {
            const isSel = String(opt.value) === String(value);
            return (
              <div key={opt.value} onMouseDown={() => { if (!opt.disabled) { onChange(opt.value); setOpen(false); } }}
                style={{ padding:'7px 12px', fontSize:'13px', cursor: opt.disabled ? 'default' : 'pointer',
                  display:'flex', alignItems:'center', gap:'8px',
                  background: isSel ? 'rgba(55,124,244,.09)' : 'transparent',
                  color: opt.disabled ? '#adb5bd' : isSel ? 'var(--clr-primary)' : '#212529',
                  fontWeight: isSel ? 600 : 400 }}
                onMouseEnter={e => { if (!isSel && !opt.disabled) e.currentTarget.style.background='rgba(55,124,244,.05)'; }}
                onMouseLeave={e => { if (!isSel && !opt.disabled) e.currentTarget.style.background='transparent'; }}>
                <span style={{ flex:1 }}>{opt.label}</span>
                {isSel && <i className="bi bi-check2" style={{ color:'var(--clr-primary)', fontSize:'13px' }}></i>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══ FilterYearInput : saisie libre d'année (1900-2999, vide = toutes années).
   Apparence identique au FilterSelect existant (même hauteur, bordure, radius, font).
   Seul le fonctionnement change : champ texte au lieu d'un dropdown. ══ */
function FilterYearInput({ value, onChange, placeholder = 'Année' }) {
  const [focused, setFocused] = React.useState(false);
  const handleChange = (e) => {
    const v = (e.target.value ?? '').trim();
    if (!v) { onChange(''); return; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1900 || n > 2999) return;
    onChange(String(n));
  };
  return (
    <div style={{ position:'relative', flex:1, minWidth:0 }}>
      <input
        type="number"
        inputMode="numeric"
        min="1900" max="2999" step="1"
        placeholder={placeholder}
        value={value || ''}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width:'100%', height:'32px', padding:'0 10px',
          fontSize:'12px', fontWeight:500,
          border: focused ? '1.5px solid rgba(55,124,244,.5)' : '1px solid #dee2e6',
          borderRadius:'10px', background:'#fff',
          color: value ? '#212529' : '#6c757d',
          boxShadow: focused ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          outline:'none', fontFamily:'inherit',
          MozAppearance:'textfield',
        }}
      />
    </div>
  );
}

/* ══ FilterSelect : dropdown filtre compact et stylé ══ */
function FilterSelect({ value, onChange, options, placeholder, alignRight = false }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position:'relative', flex:1, minWidth:0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', height:'32px', padding:'0 28px 0 10px',
          fontSize:'12px', fontWeight:500, cursor:'pointer',
          border: open ? '1.5px solid rgba(55,124,244,.5)' : '1px solid #dee2e6',
          borderRadius:'10px', background:'#fff',
          color: selected ? '#212529' : '#6c757d',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          position:'relative',
        }}
      >
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, textAlign:'left' }}>
          {selected ? selected.label : placeholder}
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`}
          style={{ fontSize:'10px', opacity:.5, position:'absolute', right:'9px', flexShrink:0 }}></i>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)',
          left: alignRight ? 'auto' : 0, right: alignRight ? 0 : 'auto', minWidth:'100%',
          background:'#fff', borderRadius:'10px',
          border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 8px 24px rgba(0,0,0,.13)',
          zIndex:9999, maxHeight:'220px', overflowY:'auto',
          width:'max-content', maxWidth:'220px',
        }}>
          {options.map(opt => {
            const isSel = opt.value === value;
            return (
              <div
                key={opt.value}
                onMouseDown={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  padding:'7px 12px', fontSize:'13px', cursor:'pointer',
                  background: isSel ? 'rgba(55,124,244,.09)' : 'transparent',
                  color: isSel ? 'var(--clr-primary)' : '#212529',
                  fontWeight: isSel ? 600 : 400,
                  display:'flex', alignItems:'center', gap:'7px',
                  whiteSpace:'nowrap',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background='rgba(55,124,244,.05)'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background='transparent'; }}
              >
                <span style={{ flex:1 }}>{opt.label}</span>
                {isSel && <i className="bi bi-check2" style={{ color:'var(--clr-primary)', fontSize:'12px' }}></i>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════ */

/* ══ BudgetAwareSelect : dropdown membres avec grisage si budget épuisé ══ */
function BudgetAwareSelect({ value, onChange, membres, budgetsRestants }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getLabel = (m) =>
    `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim() || `Membre ${m.id}`;

  const isEpuise = (m) => { const b = budgetsRestants[String(m.id)] ?? null; return b !== null && b <= 0; };

  const selected = membres.find(m => String(m.id) === String(value));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-select rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{
          fontSize: '13px', height: '32px', cursor: 'pointer',
          border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          background: '#fff',
          color: selected ? (isEpuise(selected) ? '#ef4444' : '#212529') : '#6c757d',
        }}
      >
        <span>
          {selected
            ? <>
                {getLabel(selected)}
                {isEpuise(selected) && <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444', fontWeight: 700 }}>● Budget épuisé</span>}
              </>
            : '— Choisir un membre —'}
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: '11px', opacity: .6 }}></i>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', borderRadius: '10px',
          border: '1.5px solid rgba(55,124,244,.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,.13)',
          zIndex: 9999, overflow: 'hidden',
          maxHeight: '200px', overflowY: 'auto',
        }}>
          {membres.map(m => {
            const epuise    = isEpuise(m);
            const isSelected = String(m.id) === String(value);
            return (
              <div
                key={m.id}
                onMouseDown={() => { if (!epuise) { onChange(String(m.id)); setOpen(false); } }}
                style={{
                  padding: '8px 12px', fontSize: '13px',
                  cursor: epuise ? 'not-allowed' : 'pointer',
                  background: isSelected ? 'rgba(55,124,244,.09)' : epuise ? 'rgba(239,68,68,.04)' : 'transparent',
                  color: epuise ? '#9ca3af' : isSelected ? 'var(--clr-primary)' : '#212529',
                  fontWeight: isSelected ? 600 : 400,
                  display: 'flex', alignItems: 'center', gap: '8px',
                  opacity: epuise ? 0.65 : 1,
                  transition: 'background .12s',
                  borderLeft: epuise ? '3px solid #fca5a5' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!epuise && !isSelected) e.currentTarget.style.background = 'rgba(55,124,244,.05)'; }}
                onMouseLeave={e => { if (!epuise && !isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flex: 1 }}>{getLabel(m)}</span>
                {epuise && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,.12)', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    Budget épuisé
                  </span>
                )}
                {isSelected && !epuise && <i className="bi bi-check2 ms-1" style={{ color: 'var(--clr-primary)', fontSize: '13px' }}></i>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Factures() {
  /* ── Données ── */
  const [factures,   setFactures]   = useState([]);
  const [membres,    setMembres]    = useState([]);
  const [compteId,   setCompteId]   = useState(null);
  const [categories, setCategories] = useState([]);   // chargées depuis GET /categories/type/FACTURE
  const [currentUserId, setCurrentUserId] = useState(null);

  /* ── Auth ── */
  const [roleUtilisateur, setRoleUtilisateur] = useState('');

  /* ── UI ── */
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  /* ── Filtres ── */
  const [fltAnnee,  setFltAnnee]  = useState(() => String(new Date().getFullYear()));
  const [fltMois,   setFltMois]   = useState(() => MOIS_LISTE[new Date().getMonth()]);
  const [fltMembre, setFltMembre] = useState('');
  const [fltCat,    setFltCat]    = useState('');

  /* ── Tabs ── */
  const [activeTab, setActiveTab] = useState('paid');

  /* ── Modals ── */
  const [showModal,     setShowModal]     = useState(false);
  const [showDetail,    setShowDetail]    = useState(false);
  const [showImage,     setShowImage]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailData,    setDetailData]    = useState(null);
  const [editId,        setEditId]        = useState(null);
  const [form,          setForm]          = useState(FORM_INIT);

  /* ══ Budget restant par membre (membreId → resteAVivre) ══ */
  const [budgetsRestants, setBudgetsRestants] = useState({});
  const [budgetError,     setBudgetError]     = useState('');
  const budgetErrorTimer = React.useRef(null);

  const showBudgetError = (msg) => {
    setBudgetError(msg);
    if (budgetErrorTimer.current) clearTimeout(budgetErrorTimer.current);
    budgetErrorTimer.current = setTimeout(() => setBudgetError(''), 3000);
  };

  useEffect(() => () => { if (budgetErrorTimer.current) clearTimeout(budgetErrorTimer.current); }, []);

  const now         = new Date();
  const moisActuel  = MOIS_LISTE[now.getMonth()];
  const anneeActuel = String(now.getFullYear());

  /* ══════════════════════════════════════
     CHARGEMENT INITIAL
  ══════════════════════════════════════ */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      /* 1. username → userId */
      const username = sessionStorage.getItem('username');
      if (!username) { setError('Utilisateur non connecté.'); setLoading(false); return; }

      const usersRes = await fetch(`${API}/users`);
      if (!usersRes.ok) { setError('Impossible de charger les utilisateurs.'); setLoading(false); return; }
      const users      = await usersRes.json();
      const currentUser = users.find(u => u.username === username);
      if (!currentUser?.id) { setError('Utilisateur introuvable.'); setLoading(false); return; }
      const userId = currentUser.id;

      /* 2. userId → familleId + rôle */
      let famId     = null;
      let roleLocal = 'ADMINISTRATEUR';

      const adminRes = await fetch(`${API}/admins/user/${userId}`);
      if (adminRes.ok) {
        const admin = await adminRes.json();
        if (admin.famille?.id) famId = admin.famille.id;
        roleLocal = 'ADMINISTRATEUR';
      }

      if (!famId) {
        const membreRes = await fetch(`${API}/membres/user/${userId}`);
        if (membreRes.ok) {
          const membre = await membreRes.json();
          if (membre.famille?.id) famId = membre.famille.id;
          if (membre.role)        roleLocal = membre.role;
        }
      }

      setRoleUtilisateur(roleLocal);
      if (!famId) { setError('Aucune famille trouvée pour cet utilisateur.'); setLoading(false); return; }

      /* 3. Membres de la famille */
      const memRes  = await fetch(`${API}/membres/famille/${famId}`);
      const rawMems = memRes.ok ? (await memRes.json() ?? []) : [];
      const memData = await Promise.all(rawMems.map(async (m) => {
        if (m.user?.firstName?.trim() || m.user?.lastName?.trim()) return m;
        const uid = m.userId ?? m.user?.id;
        if (!uid) return m;
        try {
          const uRes = await fetch(`${API}/users/${uid}`);
          if (uRes.ok) return { ...m, user: await uRes.json() };
        } catch (_) {}
        return m;
      }));
      setMembres(memData);

      /* 4. Compte famille */
      const compRes = await fetch(`${API}/comptes/famille/${famId}`);
      if (!compRes.ok) { setError('Compte introuvable.'); setLoading(false); return; }
      const compte = await compRes.json();
      const cid    = compte.id;
      setCompteId(cid);

      /* 5. Catégories FACTURE depuis l'API (avant de mapper les factures) */
      const catRes  = await fetch(`${API}/categories/type/FACTURE`);
      const catData = catRes.ok ? (await catRes.json() ?? []) : [];
      setCategories(catData);
      setCurrentUserId(userId);

      /* 6. Factures */
      const facRes  = await fetch(`${API}/factures/compte/${cid}`);
      const facData = facRes.ok ? (await facRes.json() ?? []) : [];
      /* Enrichir avec le nom de catégorie si le backend retourne seulement l'id */
      const enriched = facData.map(f => {
        if (!f.categorie?.name && f.categorie?.id) {
          const catObj = catData.find(c => c.id === f.categorie.id);
          if (catObj) f = { ...f, categorie: catObj };
        }
        return mapFacture(f);
      });
      setFactures(enriched);

      /* 7. Budgets restants (budget - charges - factures du mois courant) par membre */
      const budgetsMap = {};
      await Promise.all(
        memData.map(async m => {
          try {
            const [budgetRes, chargesTotRes, factTotRes] = await Promise.all([
              fetch(`${API}/membres/${m.id}`),
              fetch(`${API}/charges/membre/${m.id}/total/mois`).catch(() => null),
              fetch(`${API}/factures/membre/${m.id}/total/mois`).catch(() => null),
            ]);
            const memObj    = budgetRes.ok  ? await budgetRes.json()   : null;
            const budget    = memObj?.budget ?? 0;
            const carryover = memObj?.carryoverBudget ?? 0; // ✅ inclure le carryover
            const budgetTotal = budget + carryover;
            const charges_  = chargesTotRes?.ok ? (await chargesTotRes.json() ?? 0) : 0;
            const factures_ = factTotRes?.ok    ? (await factTotRes.json()    ?? 0) : 0;
            // ✅ resteAVivre = (budget + carryover) - charges - factures
            budgetsMap[String(m.id)] = Math.max(0, budgetTotal - charges_ - factures_);
          } catch (_) {
            budgetsMap[String(m.id)] = null;
          }
        })
      );
      setBudgetsRestants(budgetsMap);

    } catch (err) {
      setError('Erreur de connexion au serveur.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadFactures = async (catData) => {
    if (!compteId) return;
    try {
      // On REFETCH systématiquement les catégories si non passées en
      // paramètre : sinon, après création d'une catégorie custom ("Autre" +
      // nom saisi) le state `categories` n'est pas encore mis à jour à
      // cause de l'asynchronicité React → le lookup `cats.find` rate et
      // l'enrichissement retombe sur `categorie?.name ?? 'Autre'`.
      let cats = catData;
      if (!cats) {
        const catRes = await fetch(`${API}/categories/type/FACTURE`);
        cats = catRes.ok ? (await catRes.json() ?? []) : categories;
        // On synchronise aussi le state pour que les autres usages voient
        // la nouvelle catégorie (dropdown du modal, filtre, etc.).
        setCategories(cats);
      }
      const res  = await fetch(`${API}/factures/compte/${compteId}`);
      const data = res.ok ? (await res.json() ?? []) : [];
      const enriched = data.map(f => {
        if (!f.categorie?.name && f.categorie?.id) {
          const catObj = cats.find(c => c.id === f.categorie.id);
          if (catObj) f = { ...f, categorie: catObj };
        }
        return mapFacture(f);
      });
      setFactures(enriched);
    } catch (err) { console.error('Reload factures:', err); }
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ══ Auto-refresh : si l'utilisateur ajoute une facture depuis le web,
       elle doit apparaître côté mobile dès que l'onglet/app reprend le focus.
       On rafraîchit la liste à chaque retour de visibilité ou de focus. ══ */
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(); };
    const onFocus   = () => fetchAll();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchAll]);

  /* ══ Stats KPI (hero banner — respectent les filtres mois/année sélectionnés) ══ */
  /* Mois et année affichés dans le banner : filtres actifs ou valeurs actuelles */
  const bannerMois  = fltMois  || moisActuel;
  const bannerAnnee = fltAnnee || anneeActuel;

  const paidThisMonth = useMemo(() =>
    factures.filter(f => {
      const matchStatut = f.statut === 'paid';
      const matchMois   = f.mois  === bannerMois;
      const matchAnnee  = f.annee === bannerAnnee;
      const matchMembre = !fltMembre || String(f.membreId) === fltMembre;
      const matchCat    = !fltCat    || f.cat === fltCat;
      return matchStatut && matchMois && matchAnnee && matchMembre && matchCat;
    })
  , [factures, bannerMois, bannerAnnee, fltMembre, fltCat]);

  const paidThisYear = useMemo(() =>
    factures.filter(f => {
      const matchStatut = f.statut === 'paid';
      const matchAnnee  = f.annee === bannerAnnee;
      const matchMembre = !fltMembre || String(f.membreId) === fltMembre;
      const matchCat    = !fltCat    || f.cat === fltCat;
      return matchStatut && matchAnnee && matchMembre && matchCat;
    })
  , [factures, bannerAnnee, fltMembre, fltCat]);

  const totalPaidMonth = paidThisMonth.reduce((s,f) => s + f.montant, 0);
  const totalPaidYear  = paidThisYear.reduce((s,f) => s + f.montant, 0);
  const countPaidMonth = paidThisMonth.length;
  const countPaidYear  = paidThisYear.length;

  /* ══ Listes filtres ══ */
  const membresPourFiltre = useMemo(() =>
    [...new Set(factures.map(f => f.membreId).filter(Boolean))].map(mid => ({
      id: mid, nom: factures.find(x => x.membreId === mid)?.membre ?? `Membre #${mid}`,
    }))
  , [factures]);
  const anneesPourFiltre = useMemo(() => [...new Set(factures.map(f => f.annee).filter(Boolean))].sort(), [factures]);

  /* ══ Filtrage + tab ══ */
  const baseFiltered = useMemo(() => factures.filter(f => {
    const ma = !fltAnnee  || f.annee === fltAnnee;
    const mm = !fltMois   || f.mois  === fltMois;
    const mb = !fltMembre || String(f.membreId) === fltMembre;
    const mc = !fltCat    || f.cat   === fltCat;
    return ma && mm && mb && mc;
  }), [factures, fltAnnee, fltMois, fltMembre, fltCat]);

  const filtered = useMemo(() => {
    return baseFiltered
      .filter(f => f.statut === activeTab)
      .sort((a, b) => {
        const da = a.rawEcheance ? new Date(a.rawEcheance) : new Date(0);
        const db = b.rawEcheance ? new Date(b.rawEcheance) : new Date(0);
        return db - da; // décroissant : plus récent en haut
      });
  }, [baseFiltered, activeTab]);

  /* ══ KPI carreaux blancs — calculés sur baseFiltered (respectent les filtres) ══ */
  const pendingFacts = useMemo(() => baseFiltered.filter(f => f.statut === 'pending'), [baseFiltered]);
  const lateFacts    = useMemo(() => baseFiltered.filter(f => f.statut === 'late'),    [baseFiltered]);
  // Totaux montants pour les KPI "En Attente" / "En Retard" — alignés
  // sur l'affichage Angular (nombre + total DT).
  const totalPending = pendingFacts.reduce((s,f) => s + f.montant, 0);
  const totalLate    = lateFacts.reduce((s,f) => s + f.montant, 0);

  /* ══ canEdit (CONSULTANT ne peut pas modifier) ══ */
  const canEdit = roleUtilisateur !== 'CONSULTANT';

  /* ══ Actions ══ */
  const demanderSuppression = (id) => setConfirmDelete({ id });

  const confirmerSuppression = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API}/factures/delete/${id}`, { method:'DELETE' });
      if (!res.ok) throw new Error();
      setFactures(prev => prev.filter(f => f.id !== id));
    } catch { alert('Erreur lors de la suppression.'); }
  };

  /* ══ Marquer comme payée ══ */
  const [payingId, setPayingId] = useState(null);

  const handleMarkAsPaid = async (fact) => {
    setPayingId(fact.id);
    try {
      const payload = {
        title:     fact.nom,
        amount:    fact.montant,
        issueDate: fact.rawIssueDate ? fact.rawIssueDate.split('T')[0] : todayIsoStr(),
        dueDate:   fact.rawEcheance  ? fact.rawEcheance.split('T')[0]  : undefined,
        datePaiement: todayIsoStr(),
        statut:    'PAYEE',
        type:      TYPE_TO_BACKEND[fact.type] ?? 'VARIABLE',
        categorie: fact.categorieId ? { id: fact.categorieId } : null,
        membre:    fact.membreId    ? { id: fact.membreId }    : null,
        compte:    compteId         ? { id: compteId }         : null,
      };
      const res = await fetch(`${API}/factures/edit/${fact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      /* Mise à jour immédiate sans rechargement */
      setFactures(prev => prev.map(f =>
        f.id === fact.id ? { ...f, statut: 'paid' } : f
      ));
    } catch {
      alert('Erreur lors de la mise à jour du statut.');
    } finally {
      setPayingId(null);
    }
  };

  /* ══ Modals ══ */
  const openModal = (fact = null) => {
    if (fact && fact.statut === 'paid') return; // facture payée : non modifiable
    if (fact) {
      setEditId(fact.id);
      const todayStr = todayIsoStr();
      setForm({
        nom:               fact.nom,
        categorieId:       fact.categorieId ? String(fact.categorieId) : '',
        categorie:         fact.cat,
        nouvelleCategorie: '',
        montant:           fact.montant,
        issueDate:         fact.rawIssueDate ? fact.rawIssueDate.split('T')[0] : todayStr,
        echeance:          fact.rawEcheance  ? fact.rawEcheance.split('T')[0]  : '',
        type:              fact.type ?? 'Variable',
        statut:            fact.statut === 'paid' ? 'Payée' : fact.statut === 'late' ? 'En retard' : 'En attente',
        datePaiement:      fact.rawDatePaiement
          ? fact.rawDatePaiement.split('T')[0]
          : todayStr,
        membreId:          String(fact.membreId ?? ''),
        image:             fact.image ?? null,
        imagePreview:      fact.image ?? null,
        imageFile:         null,
        fileName:          fact.fileName ?? '',
      });
    } else {
      setEditId(null);
      setForm(FORM_INIT);
    }
    setShowModal(true);
  };
  const closeModal  = () => { setShowModal(false); setSaving(false); setBudgetError(''); };

  /* ══ Vérification budget en temps réel ══ */
  const selectedBudgetRestant = form.membreId
    ? budgetsRestants[String(form.membreId)] ?? null
    : null;

  const membreBudgetEpuise = selectedBudgetRestant !== null && selectedBudgetRestant <= 0;
  const montantDepasse     = selectedBudgetRestant !== null
    && selectedBudgetRestant > 0
    && Number(form.montant) > 0
    && Number(form.montant) > selectedBudgetRestant;

  useEffect(() => {
    if (!form.membreId) return;
    if (membreBudgetEpuise) {
      showBudgetError('Ce membre a déjà épuisé son budget.');
    } else if (montantDepasse) {
      showBudgetError('Le montant dépasse le budget restant de ce membre.');
    } else {
      setBudgetError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.membreId, form.montant, membreBudgetEpuise, montantDepasse]);

  const openDetail  = (fact) => { setDetailData(fact); setShowDetail(true); };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({
      ...f,
      image: ev.target.result,
      imagePreview: ev.target.result,
      imageFile: file,
      fileName: file.name,
    }));
    reader.readAsDataURL(file);
  };

  /* ══ Enregistrer ══ */
  const handleSave = async () => {
    if (!form.nom?.trim()) {
      alert('Le nom de la facture est obligatoire.');
      return;
    }
    if (!form.membreId) {
      alert('Sélectionnez un membre.');
      return;
    }
    if (!form.categorieId) {
      alert('Sélectionnez une catégorie.');
      return;
    }
    if (!form.montant || Number(form.montant) <= 0) {
      alert('Le montant doit être supérieur à 0.');
      return;
    }
    if (!form.issueDate) {
      alert("La date d'émission est obligatoire.");
      return;
    }
    /* ── Contrôle budget membre ── */
    if (membreBudgetEpuise) {
      showBudgetError('Ce membre a déjà épuisé son budget.');
      return;
    }
    if (montantDepasse) {
      showBudgetError('Le montant dépasse le budget restant de ce membre.');
      return;
    }
    setSaving(true);

    let catId   = form.categorieId ? Number(form.categorieId) : null;
    let catName = form.categorie ?? '';

    /* Nouvelle catégorie : POST /categories d'abord */
    if (form.categorieId === '__new__' && form.nouvelleCategorie.trim()) {
      try {
        const newPayload = {
          name:      form.nouvelleCategorie.trim(),
          type:      'FACTURE',
          default:   false,
          isDefault: false,
          ...(currentUserId ? { createdBy: { id: currentUserId } } : {}),
        };
        const catRes = await fetch(`${API}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPayload),
        });
        if (catRes.ok) {
          const newCat = await catRes.json();
          catId   = newCat.id;
          catName = newCat.name;
          /* Recharger la liste des catégories */
          const refreshRes = await fetch(`${API}/categories/type/FACTURE`);
          if (refreshRes.ok) setCategories(await refreshRes.json() ?? []);
          else setCategories(prev => [...prev, newCat]);
        } else {
          alert('Erreur lors de la création de la catégorie.');
          setSaving(false); return;
        }
      } catch (err) {
        alert('Erreur réseau lors de la création de la catégorie.');
        setSaving(false); return;
      }
    }

    if (!catId) {
      alert('Veuillez sélectionner ou créer une catégorie.');
      setSaving(false); return;
    }

    const nomFinal = form.nom?.trim() || catName;

    /* Payload identique au web Angular (FacturePayload) — aligné sur Facture.java.
       issueDate est obligatoire, dueDate facultatif. */
    const buildPayload = (catValue) => ({
      title:     nomFinal,
      amount:    Number(form.montant),
      issueDate: form.issueDate,
      dueDate:   form.echeance || undefined,
      // Règle métier "imputé au mois courant" : datePaiement = aujourd'hui
      // si statut = Payée, sinon non envoyée (le backend la laisse null).
      datePaiement: form.statut === 'Payée' ? todayIsoStr() : undefined,
      statut:    STATUT_TO_BACKEND[form.statut] ?? 'NON_PAYEE',
      // Type FIXE / VARIABLE saisi dans le modal — persisté côté backend.
      type:      TYPE_TO_BACKEND[form.type] ?? 'VARIABLE',
      categorie: catValue,
      membre:    form.membreId ? { id: Number(form.membreId) } : null,
      compte:    compteId      ? { id: compteId }    : null,
    });

    try {
      let res;
      const url    = editId ? `${API}/factures/edit/${editId}` : `${API}/factures/add`;
      const method = editId ? 'PUT' : 'POST';

      const payload = buildPayload({ id: catId });
      res = await fetch(url, {
        method, headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error('[Factures] Erreur backend:', errBody);
        throw new Error(errBody);
      }
      const saved = await res.json();

      /* Upload fichier — PUT /factures/upload/{id} */
      if (form.imageFile && saved?.id) {
        const fd = new FormData();
        fd.append('file', form.imageFile);
        await fetch(`${API}/factures/upload/${saved.id}`, { method: 'PUT', body: fd });
      }

      closeModal();
      await reloadFactures();
    } catch (err) {
      alert('Erreur lors de l\'enregistrement : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Catégories : ajouter ── */
  const handleAddCategory = async (nom) => {
    if (!nom?.trim()) return null;
    try {
      const payload = {
        name:      nom.trim(),
        type:      'FACTURE',
        default:   false,
        isDefault: false,
        ...(currentUserId ? { createdBy: { id: currentUserId } } : {}),
      };
      const res = await fetch(`${API}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const newCat = await res.json();
        const refreshRes = await fetch(`${API}/categories/type/FACTURE`);
        if (refreshRes.ok) setCategories(await refreshRes.json() ?? []);
        else setCategories(prev => [...prev, newCat]);
        return newCat;
      } else {
        console.error('Erreur ajout catégorie facture:', await res.text());
      }
    } catch (err) { console.error(err); }
    return null;
  };

  /* ── Catégories : supprimer ── */
  const handleDeleteCategory = async (catId, catName) => {
    const usedInFact = factures.some(f => f.cat === catName);
    const msg = usedInFact
      ? `La catégorie "${catName}" est utilisée dans des factures. Supprimer quand même ?`
      : `Supprimer la catégorie "${catName}" ?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`${API}/categories/${catId}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== catId));
        if (String(form.categorieId) === String(catId))
          setForm(f => ({ ...f, categorieId: '', categorie: '' }));
      }
    } catch (err) { console.error(err); }
  };

  /* ════════════════════════════════════════
     RENDU
  ════════════════════════════════════════ */
  return (
    <Layout>
      <style>{`
        :root {
          --clr-primary:#377CF4; --clr-indigo:#377CF4; --clr-green:#22c55e;
          --clr-orange:#f97316; --clr-red:#ef4444; --clr-blue:#377CF4;
          --clr-amber:#f59e0b; --clr-slate:#64748b; --clr-teal:#0ea5e9;
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .anim   { animation:fadeUp .4s ease both; }
        .anim-1 { animation-delay:.06s; } .anim-2 { animation-delay:.12s; }
        .anim-3 { animation-delay:.18s; } .anim-4 { animation-delay:.24s; }

        .kpi-banner {
          background: linear-gradient(135deg,#377CF4 0%,#325DC1 55%,#2E3F8F 100%);
          border-radius:22px; position:relative; overflow:hidden;
          box-shadow:0 14px 42px rgba(55,124,244,.32);
        }
        .kpi-banner::before { content:''; position:absolute; top:-50px; right:-50px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,.07); }
        .kpi-banner::after  { content:''; position:absolute; bottom:-40px; left:-30px; width:130px; height:130px; border-radius:50%; background:rgba(255,255,255,.05); }
        .kpi-var-badge { background:rgba(255,255,255,.18); border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700; backdrop-filter:blur(6px); display:inline-flex; align-items:center; gap:4px; }
        .kpi-var-badge.down { background:rgba(239,68,68,.25); }

        .kpi-card { border-radius:14px; transition:transform .2s,box-shadow .2s; }
        .kpi-card:hover { transform:translateY(-3px); box-shadow:0 10px 28px rgba(0,0,0,.1)!important; }
        .kpi-icon { width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0; }
        .ki-orange { background:rgba(249,115,22,.13); color:var(--clr-orange); }
        .ki-red    { background:rgba(239,68,68,.13);  color:var(--clr-red); }

        .toggle-pill { font-size:10px; font-weight:700; border-radius:10px; padding:3px 9px; border:none; cursor:pointer; transition:all .18s; }
        .toggle-pill-orange { background:rgba(249,115,22,.13); color:var(--clr-orange); }
        .toggle-pill-orange.active, .toggle-pill-orange:hover { background:var(--clr-orange); color:#fff; }
        .toggle-pill-red    { background:rgba(239,68,68,.13);  color:var(--clr-red); }
        .toggle-pill-red.active, .toggle-pill-red:hover       { background:var(--clr-red);    color:#fff; }

        .sb { font-size:10px;font-weight:700;border-radius:20px;padding:2px 9px;letter-spacing:.3px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap; }
        .sb::before { content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0; }
        .sb-paid::before    { background:#22c55e; } .sb-paid    { background:rgba(34,197,94,.13);  color:#16a34a; }
        .sb-pending::before { background:var(--clr-orange); } .sb-pending { background:rgba(249,115,22,.13); color:var(--clr-orange); }
        .sb-late::before    { background:var(--clr-red); }    .sb-late    { background:rgba(239,68,68,.13);  color:var(--clr-red); }

        .cbdg { font-size:10px;font-weight:700;border-radius:10px;padding:2px 8px;letter-spacing:.2px; }
        .cbdg-logement  { background:rgba(55,124,244,.12); color:var(--clr-primary); }
        .cbdg-energie   { background:rgba(249,115,22,.12); color:var(--clr-orange); }
        .cbdg-telecom   { background:rgba(55,124,244,.12); color:var(--clr-blue); }
        .cbdg-education { background:rgba(239,68,68,.12);  color:var(--clr-red); }
        .cbdg-sante     { background:rgba(34,197,94,.12);  color:#16a34a; }
        .cbdg-assurance { background:rgba(14,165,233,.12); color:var(--clr-teal); }
        .cbdg-autre     { background:rgba(100,116,139,.12);color:var(--clr-slate); }

        .fact-tabs { display:flex; gap:4px; background:rgba(0,0,0,.04); border-radius:12px; padding:4px; }
        .fact-tab  { flex:1; text-align:center; padding:6px 10px; border-radius:9px; border:none; background:transparent; font-size:12px; font-weight:600; color:var(--clr-slate); cursor:pointer; transition:all .18s; }
        .fact-tab.active-paid    { background:#fff; color:#16a34a; box-shadow:0 2px 8px rgba(0,0,0,.08); }
        .fact-tab.active-pending { background:#fff; color:var(--clr-orange); box-shadow:0 2px 8px rgba(0,0,0,.08); }
        .fact-tab.active-late    { background:#fff; color:var(--clr-red);    box-shadow:0 2px 8px rgba(0,0,0,.08); }
        .fact-tab:hover:not(.active-paid):not(.active-pending):not(.active-late) { background:rgba(255,255,255,.6); }

        .filter-bar .form-select { border-radius:10px; font-size:.8rem; }
        .filter-bar .form-select:focus { box-shadow:0 0 0 3px rgba(55,124,244,.15); border-color:var(--clr-primary); }

        .sec-lbl { display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:700; }


        .btn-act-edit { color:var(--clr-primary); background:none; border:none; padding:4px 5px; border-radius:7px; font-size:14px; line-height:1; cursor:pointer; transition:background .15s; }
        .btn-act-del  { color:var(--clr-red);     background:none; border:none; padding:4px 5px; border-radius:7px; font-size:14px; line-height:1; cursor:pointer; transition:background .15s; }
        .btn-act-view { color:var(--clr-blue);    background:none; border:none; padding:4px 5px; border-radius:7px; font-size:14px; line-height:1; cursor:pointer; transition:background .15s; }
        .btn-act-edit:hover { background:rgba(55,124,244,.1); }
        .btn-act-del:hover  { background:rgba(239,68,68,.1); }
        .btn-act-view:hover { background:rgba(55,124,244,.1); }

        .fact-card-row {
          background:#fff; border-radius:14px; border:1px solid rgba(0,0,0,.06);
          padding:11px 14px; margin-bottom:8px;
          display:flex; align-items:center; justify-content:space-between; gap:10px;
          transition:box-shadow .18s,transform .18s;
        }
        .fact-card-row:hover { box-shadow:0 4px 16px rgba(0,0,0,.08); transform:translateY(-1px); }

        .fact-avatar {
          width:36px; height:36px; border-radius:50%; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:11px; font-weight:800; letter-spacing:.5px;
          background:rgba(55,124,244,.1); color:var(--clr-primary);
        }

        .img-overlay { position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px; }
        .img-overlay img { max-width:90vw;max-height:85vh;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.5); }
        .img-preview { max-width:100%;border-radius:12px;max-height:200px;object-fit:cover; }

        .modal-backdrop-custom { position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1055;display:flex;align-items:center;justify-content:center;padding:16px; }
        .modal-box { background:#fff;border-radius:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.18);animation:fadeUp .3s ease both; }
        .modal-box-sm { max-width:420px; }

        @keyframes spin { to { transform:rotate(360deg); } }
        .spinner { width:36px;height:36px;border:3px solid rgba(55,124,244,.2);border-top-color:var(--clr-primary);border-radius:50%;animation:spin .75s linear infinite; }

        .adminuiux-content.has-sidebar { padding-top:56px!important; }
        .adminuiux-sidebar { padding-top:56px!important; top:0!important; }
        .adminuiux-sidebar-inner { height:100%!important; overflow-y:auto!important; }
        .navbar.fixed-top { z-index:1050!important; backdrop-filter:blur(12px)!important; -webkit-backdrop-filter:blur(12px)!important; background-color:inherit!important; }

        /* Uniformisation des selects dans la modal */
        .modal-box .form-select,
        .modal-box .form-select-sm {
          font-size: 13px !important;
          padding: 5px 30px 5px 10px !important;
          height: 32px !important;
          line-height: 1.4 !important;
          border-radius: 8px !important;
          border: 1px solid #dee2e6 !important;
          background-color: #fff !important;
          color: #212529 !important;
          appearance: auto !important;
          -webkit-appearance: auto !important;
          overflow: hidden !important;
          white-space: nowrap !important;
          text-overflow: ellipsis !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .modal-box .form-select:focus,
        .modal-box .form-select-sm:focus {
          border-color: rgba(55,124,244,.6) !important;
          box-shadow: 0 0 0 3px rgba(55,124,244,.10) !important;
          outline: none !important;
        }

        /* Badge rôle consultant */
        .role-badge-consultant { display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:rgba(100,116,139,.1);color:var(--clr-slate); }
      `}</style>

      <div className="main-container container" style={{ paddingTop:'12px', paddingBottom:'80px' }}>

        {/* Breadcrumb + Titre */}
        <div className="row gx-3 mb-2 anim">
          <div className="col-12">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h5 className="mb-0 fw-bold">🧾 Factures</h5>
                <p className="text-secondary small mb-0">
                  Suivez et gérez toutes les factures familiales  
                  {roleUtilisateur === 'CONSULTANT' && (
                    <span className="role-badge-consultant ms-2">
                      <i className="bi bi-eye"></i> Lecture seule
                    </span>
                  )}
                </p>
              </div>
              {canEdit && (
              <button className="btn btn-theme btn-sm rounded-3 px-3" onClick={() => openModal()} disabled={loading}>
                <i className="bi bi-plus-lg me-1"></i> Ajouter une facture
              </button>
              )}
            </div>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="alert alert-danger rounded-3 py-2 px-3 mb-3 small d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill"></i>{error}
            <button className="btn btn-sm btn-link text-danger ms-auto p-0" onClick={fetchAll}>Réessayer</button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="text-center">
              <div className="spinner mx-auto mb-3"></div>
              <p className="text-secondary small">Chargement des factures…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ══ HERO BANNER ══ */}
            <div className="row gx-3 mb-3 mt-2 anim anim-1">
              <div className="col-12">
                <div className="kpi-banner p-4">
                  {/* Titre famille ou membre filtré */}
                  <p className="text-white mb-3" style={{ opacity:1, fontSize:'16px', letterSpacing:'.3px', fontWeight:700, textAlign:'left' }}>
                    {fltMembre ? (
                      <><i className="bi bi-person me-2"></i>Factures de {(() => { const m = membres.find(mm => String(mm.id) === fltMembre); return m?.user ? `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() : `Membre #${fltMembre}`; })()}</>
                    ) : (
                      <><i className="bi bi-people me-2"></i>Total des factures de toute la famille</>
                    )}
                  </p>
                  <div className="d-flex align-items-end justify-content-between flex-wrap gap-3">
                    {/* Gauche : total mois payées */}
                    <div style={{ flex:'1 1 auto' }}>
                      <p className="text-white mb-1" style={{ opacity:.72, fontSize:'11px', letterSpacing:'.8px', textTransform:'uppercase', fontWeight:600 }}>
                        <i className="bi bi-calendar3 me-1"></i>Factures payées du mois · {bannerMois.toUpperCase()} {bannerAnnee}
                      </p>
                      <h1 className="text-white fw-bold mb-2" style={{ fontSize:'clamp(2rem,5vw,2.8rem)', letterSpacing:'-1.5px', lineHeight:1 }}>
                        {totalPaidMonth.toLocaleString('fr-TN')}
                        <span style={{ fontSize:'1.1rem', opacity:.75, marginLeft:'6px' }}>DT</span>
                      </h1>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="kpi-var-badge">
                          <i className="bi bi-receipt" style={{ fontSize:'11px' }}></i>
                          {countPaidMonth} facture{countPaidMonth !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    {/* Droite : total annuel */}
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p className="text-white mb-1" style={{ opacity:.6, fontSize:'10px', letterSpacing:'.6px', textTransform:'uppercase', fontWeight:600 }}>
                        <i className="bi bi-graph-up me-1"></i>Total {anneeActuel}
                      </p>
                      <p className="text-white fw-bold mb-0" style={{ fontSize:'clamp(1.1rem,3vw,1.5rem)', letterSpacing:'-0.5px', opacity:.92 }}>
                        {totalPaidYear.toLocaleString('fr-TN')}
                        <span style={{ fontSize:'0.75rem', opacity:.7, marginLeft:'5px' }}>DT / an</span>
                      </p>
                      <p className="text-white mb-0" style={{ fontSize:'10px', opacity:.55, marginTop:'2px' }}>
                        calculé sur {countPaidYear} facture{countPaidYear !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ KPI CARDS — aligné sur l'affichage Angular :
                « N facture(s) » en gras + « X DT total » en sous-ligne. ══ */}
            <div className="row gx-2 mb-3 anim anim-2">
              <div className="col-6">
                <div className="card adminuiux-card kpi-card">
                  <div className="card-body p-3">
                    <div className="d-flex align-items-center mb-2">
                      <div className="kpi-icon ki-orange"><i className="bi bi-hourglass-split"></i></div>
                      <span className="text-secondary ms-2" style={{ fontSize:'11px', fontWeight:600, letterSpacing:'.3px', textTransform:'uppercase' }}>
                        En Attente
                      </span>
                    </div>
                    <h6 className="fw-bold mb-0" style={{ fontSize:'18px' }}>
                      {pendingFacts.length}
                      <span className="text-secondary ms-1" style={{ fontSize:'12px', fontWeight:500 }}>
                        facture{pendingFacts.length !== 1 ? 's' : ''}
                      </span>
                    </h6>
                    <p className="text-secondary mb-0 mt-1" style={{ fontSize:'11px' }}>
                      {totalPending.toLocaleString('fr-TN')} DT total
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="card adminuiux-card kpi-card">
                  <div className="card-body p-3">
                    <div className="d-flex align-items-center mb-2">
                      <div className="kpi-icon ki-red"><i className="bi bi-exclamation-circle-fill"></i></div>
                      <span className="text-secondary ms-2" style={{ fontSize:'11px', fontWeight:600, letterSpacing:'.3px', textTransform:'uppercase' }}>
                        En Retard
                      </span>
                    </div>
                    <h6 className="fw-bold mb-0" style={{ fontSize:'18px' }}>
                      {lateFacts.length}
                      <span className="text-secondary ms-1" style={{ fontSize:'12px', fontWeight:500 }}>
                        facture{lateFacts.length !== 1 ? 's' : ''}
                      </span>
                    </h6>
                    <p className="text-secondary mb-0 mt-1" style={{ fontSize:'11px' }}>
                      {totalLate.toLocaleString('fr-TN')} DT total
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ LISTE ══ */}
            <div className="card adminuiux-card mb-3 anim anim-4">
              <div className="card-body p-3">

                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                  <p className="sec-lbl mb-0"><i className="bi bi-list-ul text-theme-1 me-1"></i>Liste des factures</p>
                  <div className="d-flex align-items-center gap-2">
                    <span className="cbdg cbdg-logement">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>

                  </div>
                </div>

                {/* Filtres */}
                <div className="filter-bar mb-2">
                  <div className="d-flex gap-2" style={{ flexWrap:'nowrap', overflow:'visible' }}>
                    <FilterSelect
                      value={fltMois}
                      onChange={setFltMois}
                      placeholder="Mois"
                      options={[
                        { value: '', label: 'Tous mois' },
                        ...MOIS_LISTE.map(m => ({ value: m, label: m })),
                      ]}
                    />
                    <FilterYearInput
                      value={fltAnnee}
                      onChange={setFltAnnee}
                      placeholder="Année"
                    />
                    <FilterSelect
                      value={fltMembre}
                      onChange={setFltMembre}
                      placeholder="Membres"
                      options={[
                        { value: '', label: 'Tous membres' },
                        ...membresPourFiltre.map(m => ({ value: String(m.id), label: m.nom })),
                      ]}
                    />
                    <FilterSelect
                      value={fltCat}
                      onChange={setFltCat}
                      placeholder="Catégories"
                      alignRight={true}
                      options={[
                        { value: '', label: 'Toutes catégories' },
                        ...categories
                          .filter((c, idx, arr) => arr.findIndex(x => normalizeCatName(x.name) === normalizeCatName(c.name)) === idx)
                          .map(c => ({ value: c.name, label: c.name })),
                      ]}
                    />
                  </div>
                </div>

                {/* Tabs */}
                <div className="fact-tabs mb-3">
                  {[
                    { key:'paid',    label:'✅ Payées',     count: baseFiltered.filter(f => f.statut === 'paid').length },
                    { key:'pending', label:'⏳ En attente', count: baseFiltered.filter(f => f.statut === 'pending').length },
                    { key:'late',    label:'🔴 En retard',  count: baseFiltered.filter(f => f.statut === 'late').length },
                  ].map(tab => (
                    <button key={tab.key}
                      className={`fact-tab ${activeTab === tab.key ? `active-${tab.key}` : ''}`}
                      onClick={() => setActiveTab(tab.key)}>
                      {tab.label} <span style={{ opacity:.6 }}>({tab.count})</span>
                    </button>
                  ))}
                </div>

                {/* Lignes */}
                <div>
                  {filtered.length === 0 && (
                    <div className="text-center py-4 text-secondary">
                      <i className="bi bi-inbox" style={{ fontSize:'1.5rem', opacity:.35 }}></i>
                      <p className="mt-1 mb-0 small">Aucune facture dans cet onglet</p>
                    </div>
                  )}
                  {filtered.map(f => {
                    const meta         = getFacMeta(f.cat);
                    const montantColor = f.statut === 'late' ? 'var(--clr-red)' : f.statut === 'pending' ? 'var(--clr-orange)' : '#16a34a';
                    const iconBg       = f.statut === 'late' ? 'rgba(239,68,68,.12)' : f.statut === 'pending' ? 'rgba(249,115,22,.12)' : 'rgba(34,197,94,.12)';
                    return (
                      <div key={f.id} className="fact-card-row">
                        {/* Infos principales */}
                        <div style={{ minWidth:0, flex:1 }}>
                          <div className="d-flex align-items-center gap-2">
                            <TypeBadge type={f.type} />
                            <CatBadge cat={f.cat} />
                            {canEdit && (f.statut === 'pending' || f.statut === 'late') && (
                              <button
                                title="Marquer comme payée"
                                disabled={payingId === f.id}
                                onClick={() => handleMarkAsPaid(f)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '3px',
                                  background: 'rgba(34,197,94,.12)', color: '#16a34a',
                                  border: '1px solid rgba(34,197,94,.25)',
                                  borderRadius: '8px', padding: '3px 7px',
                                  fontSize: '11px', fontWeight: 700,
                                  cursor: payingId === f.id ? 'not-allowed' : 'pointer',
                                  opacity: payingId === f.id ? 0.6 : 1,
                                  transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0,
                                }}
                                onMouseEnter={e => { if (payingId !== f.id) { e.currentTarget.style.background='#16a34a'; e.currentTarget.style.color='#fff'; }}}
                                onMouseLeave={e => { e.currentTarget.style.background='rgba(34,197,94,.12)'; e.currentTarget.style.color='#16a34a'; }}
                              >
                                {payingId === f.id
                                  ? <span className="spinner-border spinner-border-sm" style={{ width:'10px', height:'10px', borderWidth:'1.5px' }}></span>
                                  : <i className="bi bi-check2-circle" style={{ fontSize:'12px' }}></i>
                                }
                                Payer
                              </button>
                            )}
                            {f.image && (
                              <button
                                className="btn-act-view"
                                title="Voir le fichier"
                                onClick={() => { setDetailData(f); setShowImage(true); }}
                                style={{ cursor: 'pointer' }}
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                            )}
                          </div>
                          {normalizeCatName(f.nom) !== normalizeCatName(f.cat) && (
                            <p className="mb-0 fw-semibold mt-1" style={{ fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {f.nom}
                            </p>
                          )}
                          {f.membre && (
                            <p className="mb-0 mt-1 text-secondary" style={{ fontSize:'11px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              <i className="bi bi-person me-1"></i>{f.membre}
                            </p>
                          )}
                        </div>

                        {/* Montant + actions + date */}
                        <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                          <div className="d-flex align-items-center gap-1">
                            <span className="fw-bold" style={{ fontSize:'13.5px', color: montantColor }}>
                              {f.montant.toLocaleString('fr-TN')} DT
                            </span>

                          </div>
                          <span className="text-secondary" style={{ fontSize:'11px' }}>
                            <i className="bi bi-calendar3 me-1"></i>{f.echeance}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </>
        )}
      </div>



      {/* ══ MODAL IMAGE ══ */}
      {showImage && detailData && (
        <div className="img-overlay" onClick={() => setShowImage(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ position:'relative', maxWidth:'90vw', maxHeight:'85vh' }}
          >
            {/* Bouton fermer */}
            <button
              onClick={() => setShowImage(false)}
              style={{
                position:'absolute', top:'-14px', right:'-14px',
                width:'32px', height:'32px', borderRadius:'50%',
                background:'#fff', border:'none', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 2px 10px rgba(0,0,0,.3)', zIndex:10,
                fontSize:'14px', color:'#374151', fontWeight:700,
              }}
            >✕</button>

            {detailData.image ? (
              detailData.image.match(/\.pdf$/i) ? (
                <div style={{ background:'#fff', borderRadius:'16px', padding:'32px 40px', textAlign:'center', boxShadow:'0 24px 60px rgba(0,0,0,.4)', minWidth:'280px' }}>
                  <i className="bi bi-file-earmark-pdf" style={{ fontSize:'3rem', color:'#dc2626' }}></i>
                  <p style={{ margin:'12px 0 6px', fontWeight:700, fontSize:'14px', color:'#374151' }}>Fichier PDF</p>
                  <a href={detailData.image} target="_blank" rel="noreferrer"
                    style={{ display:'inline-block', marginTop:'8px', padding:'8px 20px', background:'#dc2626', color:'#fff', borderRadius:'8px', fontSize:'13px', fontWeight:600, textDecoration:'none' }}>
                    <i className="bi bi-box-arrow-up-right me-1"></i>Ouvrir le PDF
                  </a>
                </div>
              ) : (
                <img
                  src={detailData.image}
                  alt={detailData?.nom}
                  style={{ maxWidth:'88vw', maxHeight:'82vh', borderRadius:'16px', boxShadow:'0 24px 60px rgba(0,0,0,.5)', display:'block' }}
                />
              )
            ) : (
              <div style={{ background:'#fff', borderRadius:'16px', padding:'40px 48px', textAlign:'center', boxShadow:'0 24px 60px rgba(0,0,0,.4)', minWidth:'260px' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:'12px', opacity:.35 }}>🖼️</div>
                <p style={{ margin:0, fontWeight:700, fontSize:'14px', color:'#374151' }}>Aucun fichier disponible</p>
                <p style={{ margin:'6px 0 0', fontSize:'12px', color:'#9ca3af' }}>Cette facture n'a pas de fichier joint.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL CONFIRMATION SUPPRESSION ══ */}
      {confirmDelete && (
        <ConfirmModal
          message="Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible."
          onConfirm={confirmerSuppression}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ══ MODAL AJOUTER / MODIFIER ══ */}
      {showModal && (
        <div className="modal-backdrop-custom" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="p-3 pb-2 border-bottom">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0">
                  <i className={`bi ${editId ? 'bi-pencil-square text-warning' : 'bi-plus-circle text-theme-1'} me-2`}></i>
                  {editId ? 'Modifier la facture' : 'Ajouter une facture'}
                </h6>
                <button className="btn btn-sm btn-link text-secondary p-0" onClick={closeModal}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            <div className="p-3">

              {/* Nom */}
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">
                  <i className="bi bi-fonts me-1 text-theme-1"></i>Nom <span className="text-danger">*</span>
                </label>
                <input type="text" className="form-control form-control-sm rounded-3"
                  placeholder="Ex : Facture STEG"
                  value={form.nom}
                  onChange={e => setForm({...form, nom: e.target.value})}
                />
              </div>

              {/* Membre concerné */}
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">
                  <i className="bi bi-person me-1 text-theme-1"></i>Membre concerné <span className="text-danger">*</span>
                </label>
                <BudgetAwareSelect
                  value={form.membreId}
                  onChange={val => {
                    setForm({...form, membreId: val, montant: ''});
                    setBudgetError('');
                  }}
                  membres={membres}
                  budgetsRestants={budgetsRestants}
                />
                {/* Message erreur budget — disparaît après 3s */}
                {budgetError && (
                  <div style={{
                    marginTop: '6px', padding: '8px 12px', borderRadius: '10px',
                    background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.25)',
                    color: '#dc2626', fontSize: '12px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    animation: 'fadeUp .25s ease both',
                  }}>
                    <i className="bi bi-exclamation-triangle-fill" style={{ flexShrink: 0 }}></i>
                    {budgetError}
                  </div>
                )}
              </div>

              {/* Catégorie + Type */}
              <div className="row gx-2 mb-2" style={{ overflow:'visible' }}>
                <div className="col-7" style={{ overflow:'visible' }}>
                  <label className="form-label small fw-medium mb-1">
                    <i className="bi bi-tag me-1 text-theme-1"></i>Catégorie <span className="text-danger">*</span>
                  </label>
                  <FactCategorySelect
                    value={form.categorieId}
                    onChange={(id, cat) => setForm(f => ({ ...f, categorieId: id, categorie: cat?.name ?? '' }))}
                    categories={categories}
                    onAddCategory={handleAddCategory}
                    onDeleteCategory={handleDeleteCategory}
                  />
                </div>
                <div className="col-5">
                  <label className="form-label small fw-medium mb-1">
                    <i className="bi bi-bookmark me-1 text-theme-1"></i>Type <span className="text-danger">*</span>
                  </label>
                  <ModalSelect
                    value={form.type}
                    onChange={val => setForm({...form, type: val})}
                    placeholder="— Type —"
                    options={[
                      { value: 'Fixe',     label: 'Fixe' },
                      { value: 'Variable', label: 'Variable' },
                    ]}
                  />
                </div>
              </div>

              {/* Montant + Statut */}
              <div className="row gx-2 mb-2">
                <div className="col-7">
                  <label className="form-label small fw-medium mb-1">
                    <i className="bi bi-cash me-1 text-theme-1"></i>Montant (DT) <span className="text-danger">*</span>
                  </label>
                  <div className="input-group input-group-sm">
                    <input type="number" className="form-control rounded-3" min="0"
                      value={form.montant}
                      onChange={e => setForm({...form, montant: e.target.value})}
                      style={montantDepasse ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,.15)' } : {}}
                    />
                    <span className="input-group-text">DT</span>
                  </div>
                </div>
                <div className="col-5">
                  <label className="form-label small fw-medium mb-1">
                    <i className="bi bi-flag me-1 text-theme-1"></i>Statut <span className="text-danger">*</span>
                  </label>
                  <ModalSelect
                    value={form.statut}
                    onChange={val => setForm({...form, statut: val})}
                    placeholder="— Statut —"
                    options={[
                      { value: 'En attente', label: 'En attente' },
                      { value: 'Payée',      label: 'Payée' },
                      { value: 'En retard',  label: 'En retard' },
                    ]}
                  />
                </div>
              </div>

              {/* Date d'émission + Date d'échéance */}
              <div className="row gx-2 mb-2" style={{ overflow:'visible' }}>
                <div className="col-6" style={{ overflow:'visible' }}>
                  <label className="form-label small fw-medium mb-1">
                    <i className="bi bi-calendar3 me-1 text-theme-1"></i>Date d'émission <span className="text-danger">*</span>
                  </label>
                  <ModalDatePicker
                    value={form.issueDate}
                    onChange={val => setForm({...form, issueDate: val})}
                  />
                </div>
                <div className="col-6" style={{ overflow:'visible' }}>
                  <label className="form-label small fw-medium mb-1">
                    <i className="bi bi-calendar-check me-1 text-theme-1"></i>Date d'échéance
                  </label>
                  <ModalDatePicker
                    value={form.echeance}
                    onChange={val => setForm({...form, echeance: val})}
                  />
                </div>
              </div>

              {/* La date de paiement n'est pas exposée à l'utilisateur :
                  imposée automatiquement = aujourd'hui quand statut = Payée
                  (cf. handleSave). Règle : facture marquée payée aujourd'hui
                  → imputée au mois courant, non négociable. */}

              {/* Upload image */}
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">
                  <i className="bi bi-image me-1 text-theme-1"></i>Photo de la facture
                </label>
                <input type="file" className="form-control form-control-sm rounded-3" accept="image/*,application/pdf"
                  onChange={handleImageChange} />
                {(form.imagePreview || form.image) && (
                  <div className="mt-2">
                    {(form.imageFile?.type === 'application/pdf') ? (
                      <div style={{ padding:'8px 12px', background:'rgba(239,68,68,.08)', borderRadius:'8px', border:'1px solid rgba(239,68,68,.2)', fontSize:'12px', color:'#dc2626', display:'flex', alignItems:'center', gap:'6px' }}>
                        <i className="bi bi-file-earmark-pdf"></i> PDF : {form.imageFile?.name}
                      </div>
                    ) : (
                      <img
                        src={form.imagePreview || form.image}
                        alt="Aperçu"
                        className="img-preview"
                        style={{ maxWidth:'100%', maxHeight:'160px', borderRadius:'8px', border:'1.5px solid rgba(55,124,244,.2)', display:'block' }}
                      />
                    )}
                    {form.fileName && (
                      <div style={{ marginTop:'4px', display:'flex', alignItems:'center', gap:'6px', fontSize:'11.5px', color:'#475569' }}>
                        <i className="bi bi-paperclip"></i>
                        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{form.fileName}</span>
                        {!form.imageFile && (
                          <span style={{ color:'#16a34a', fontSize:'10px', fontWeight:600 }}>
                            <i className="bi bi-check-circle me-1"></i>Enregistré
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <p className="text-secondary mb-0" style={{ fontSize:'.72rem' }}>
                <span className="text-danger">*</span> Champs obligatoires
              </p>
            </div>

            <div className="px-3 pb-3 d-flex justify-content-end gap-2">
              <button className="btn btn-sm btn-outline-secondary rounded-3 px-3" onClick={closeModal} disabled={saving}>
                <i className="bi bi-x-lg me-1"></i>Annuler
              </button>
              <button className="btn btn-sm btn-theme rounded-3 px-3" onClick={handleSave} disabled={saving || membreBudgetEpuise || montantDepasse}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement…</>
                  : <><i className="bi bi-check-lg me-1"></i>Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DÉTAIL ══ */}
      {showDetail && detailData && (
        <div className="modal-backdrop-custom" onClick={() => setShowDetail(false)}>
          <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
            <div className="p-3 pb-2 border-bottom">
              <div className="d-flex align-items-center justify-content-between">
                <h6 className="fw-bold mb-0"><i className="bi bi-receipt me-2 text-theme-1"></i>Détail de la facture</h6>
                <button className="btn btn-sm btn-link text-secondary p-0" onClick={() => setShowDetail(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
            <div className="p-3">
              <div className="mb-2 p-2 rounded-3" style={{ background:'rgba(55,124,244,.06)' }}>
                <p className="text-secondary small mb-0 fw-medium">📌 {detailData.nom}</p>
              </div>
              <div className="row gx-2 mb-2">
                <div className="col-6">
                  <div className="p-2 rounded-3" style={{ background:'rgba(0,0,0,.03)' }}>
                    <p className="text-secondary small mb-0 fw-medium">📁 Catégorie</p>
                    <p className="fw-semibold mb-0 small">{detailData.cat}</p>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-2 rounded-3" style={{ background:'rgba(0,0,0,.03)' }}>
                    <p className="text-secondary small mb-0 fw-medium">📅 Échéance</p>
                    <p className="fw-semibold mb-0 small">{detailData.echeance}</p>
                  </div>
                </div>
              </div>
              <div className="row gx-2 mb-2">
                <div className="col-6">
                  <div className="p-2 rounded-3" style={{ background:'rgba(34,197,94,.06)' }}>
                    <p className="text-secondary small mb-0 fw-medium">💰 Montant</p>
                    <p className="fw-bold mb-0 small" style={{ color:'var(--clr-primary)' }}>{detailData.montant.toLocaleString('fr-TN')} DT</p>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-2 rounded-3" style={{ background:'rgba(0,0,0,.03)' }}>
                    <p className="text-secondary small mb-0 fw-medium">👤 Membre</p>
                    <p className="fw-semibold mb-0 small">{detailData.membre || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-3 pb-3 d-flex justify-content-end gap-2">
              <button className="btn btn-sm btn-outline-secondary rounded-3 px-3" onClick={() => setShowDetail(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Factures;
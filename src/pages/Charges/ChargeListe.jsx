import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';

const API = 'http://localhost:8080';

/* ══ Enum mappings (alignés avec Charge.java) ══ */
const TYPE_LABEL    = { FIXE: 'fixe', VARIABLE: 'variable' };
// Label affiché dans la liste (Fixe / Variable). Remplace l'ancienne périodicité
// (Mensuel / Annuel / Ponctuel) côté UI — la périodicité côté backend reste
// dérivée automatiquement (FIXE→MENSUELLE, VARIABLE→PONCTUELLE) dans handleSave.
const KIND_DISPLAY  = { FIXE: 'Fixe', VARIABLE: 'Variable' };

/* ══ Catégories → emoji + couleur + type (FIXE / VARIABLE) ══
   Liste alignée sur les presets de l'app Angular (charge-modal.component.ts) */
const CAT_META_RAW = {
  'loyer':            { emoji: '🏠', iconBg: '#377CF4', border: 'var(--clr-blue)',    type: 'FIXE',     order: 1 },
  'electricite':      { emoji: '⚡', iconBg: '#e6ac00', border: 'var(--clr-orange)',  type: 'FIXE',     order: 2 },
  'eau':              { emoji: '💧', iconBg: '#0dcaf0', border: 'var(--clr-teal)',    type: 'FIXE',     order: 3 },
  'internet':         { emoji: '📶', iconBg: '#0dcaf0', border: 'var(--clr-teal)',    type: 'FIXE',     order: 4 },
  'assurance':        { emoji: '🛡️', iconBg: '#377CF4', border: 'var(--clr-primary)', type: 'FIXE',     order: 5 },
  'abonnement':       { emoji: '📱', iconBg: '#0891b2', border: 'var(--clr-teal)',    type: 'FIXE',     order: 6 },
  'alimentation':     { emoji: '🛒', iconBg: '#fd7e14', border: 'var(--clr-orange)',  type: 'VARIABLE', order: 1 },
  'transport':        { emoji: '🚗', iconBg: '#198754', border: 'var(--clr-green)',   type: 'VARIABLE', order: 2 },
  'loisirs':          { emoji: '🎭', iconBg: '#377CF4', border: 'var(--clr-primary)', type: 'VARIABLE', order: 3 },
  'sante':            { emoji: '💊', iconBg: '#dc3545', border: 'var(--clr-red)',     type: 'VARIABLE', order: 4 },
  'education':        { emoji: '📚', iconBg: '#377CF4', border: 'var(--clr-blue)',    type: 'VARIABLE', order: 5 },
  'depense imprevue': { emoji: '⚠️', iconBg: '#dc3545', border: 'var(--clr-red)',     type: 'VARIABLE', order: 6 },
  'autre':            { emoji: '➕', iconBg: '#6b7280', border: 'var(--clr-slate)',   type: 'VARIABLE', order: 7 },
};

/* Normalise un nom de catégorie : retire accents + minuscules pour la comparaison */
function normalizeCatName(name) {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getCatMeta(name) {
  return CAT_META_RAW[normalizeCatName(name)] ?? getCustomMeta(name);
}

const DEFAULT_META = { emoji: '➕', iconBg: '#6b7280', border: 'var(--clr-slate)' };

/* ══ Génère une couleur + emoji pour les catégories personnalisées ══ */
const CUSTOM_COLORS = [
  { iconBg: '#0891b2', border: 'var(--clr-teal)',   emoji: '📌' },
  { iconBg: '#d97706', border: 'var(--clr-orange)',  emoji: '🗂️' },
  { iconBg: '#16a34a', border: 'var(--clr-green)',   emoji: '📂' },
  { iconBg: '#377CF4', border: 'var(--clr-primary)', emoji: '🏷️' },
  { iconBg: '#db2777', border: '#db2777',             emoji: '📋' },
  { iconBg: '#377CF4', border: 'var(--clr-blue)',    emoji: '🔖' },
];
function getCustomMeta(name) {
  // Déterministe : même nom → même couleur
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CUSTOM_COLORS[Math.abs(hash) % CUSTOM_COLORS.length];
}


function mapCharge(c, membres) {
  const membreObj = membres.find(m => m.id === (c.membre?.id ?? c.membreId));
  const nomMembre = membreObj
    ? `${membreObj.user?.firstName ?? ''} ${membreObj.user?.lastName ?? ''}`.trim() || `Membre ${membreObj.id}`
    : 'Famille';
  const catNom = c.categorie?.name ?? 'Autre';
  const meta   = getCatMeta(catNom);
  const typeKey = TYPE_LABEL[c.type] ?? 'fixe';
  const amount  = c.amount ?? 0;
  const plafond = c.budget_limit ?? c.ceiling ?? 0;
  const statut  = plafond > 0 && amount > plafond ? 'depasse' : 'normal';
  // Plus de périodicité affichée : on dérive le libellé Fixe/Variable
  // directement depuis le type backend (FIXE | VARIABLE).
  const kindKey = (c.type ?? 'FIXE').toUpperCase();
  return {
    id:           c.id,
    membreId:     c.membre?.id ?? c.membreId,
    membre:       nomMembre,
    categorieId:  c.categorie?.id ?? null,
    cat:          catNom,
    emoji:        meta.emoji,
    iconBg:       meta.iconBg,
    borderColor:  meta.border,
    type:         typeKey,
    amount,
    plafond,
    statut,
    // Libellé d'affichage du type (Fixe / Variable) — periodicite supprimée
    // partout, on affiche directement le type.
    typeLabel:    KIND_DISPLAY[kindKey] ?? 'Fixe',
    date: c.chargeDate
      ? new Date(c.chargeDate).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
      : '—',
    rawDate: c.chargeDate ?? '',
    rawPaymentDate: c.paymentDate ?? '',
    desc: c.description ?? '',
  };
}

const todayIso = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// Plus de `periodicite` dans le form — dérivée du `type` au save côté backend.
const FORM_INIT = { membreId: '', type: 'FIXE', categorieId: '', categorie: '', amount: '', plafond: '', date: '', paymentDate: todayIso(), desc: '' };

/* ══ Badges ══ */
function TypeBadge({ type }) {
  return <span className={`bdg ${type === 'fixe' ? 'bdg-fixe' : 'bdg-variable'}`}>{type === 'fixe' ? 'Fixe' : 'Variable'}</span>;
}
function StatutBadge({ statut }) {
  return statut === 'depasse'
    ? <span className="bdg bdg-depasse">⚠ Dépassement</span>
    : <span className="bdg bdg-normal">Normal</span>;
}

/* ══ CustomSelect : dropdown React pur, compact, contenu dans le modal ══ */
function CustomSelect({ value, onChange, options, placeholder = '— Sélectionner —' }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-select rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{
          fontSize: '13px', height: '38px', cursor: 'pointer',
          border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          background: '#fff', color: selected ? '#212529' : '#6c757d',
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: '11px', opacity: .6 }}></i>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', borderRadius: '10px',
          border: '1.5px solid rgba(55,124,244,.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,.13)',
          zIndex: 9999, overflow: 'hidden',
          maxHeight: '180px', overflowY: 'auto',
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onMouseDown={() => { onChange(opt.value); setOpen(false); }}
              style={{
                padding: '7px 12px', fontSize: '13px', cursor: 'pointer',
                background: opt.value === value ? 'rgba(55,124,244,.09)' : 'transparent',
                color: opt.value === value ? 'var(--clr-primary)' : '#212529',
                fontWeight: opt.value === value ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: '7px',
                transition: 'background .12s',
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(55,124,244,.05)'; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
              {opt.value === value && <i className="bi bi-check2 ms-auto" style={{ color: 'var(--clr-primary)', fontSize: '13px' }}></i>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ Liste preset des catégories de Charges — identique à l'app Angular
   (charge-modal.component.ts → CATEGORY_PRESETS). Toujours affichée dans
   le dropdown, indépendamment du contenu DB. ══ */
const CHARGE_PRESETS = [
  { name: 'Loyer',        emoji: '🏠', type: 'FIXE' },
  { name: 'Électricité',  emoji: '⚡', type: 'FIXE' },
  { name: 'Eau',          emoji: '💧', type: 'FIXE' },
  { name: 'Internet',     emoji: '📊', type: 'FIXE' },
  { name: 'Assurance',    emoji: '🛡️', type: 'FIXE' },
  { name: 'Alimentation', emoji: '🛒', type: 'VARIABLE' },
  { name: 'Transport',    emoji: '🚗', type: 'VARIABLE' },
  { name: 'Loisirs',      emoji: '🎭', type: 'VARIABLE' },
  { name: 'Santé',        emoji: '💊', type: 'VARIABLE' },
  { name: 'Éducation',    emoji: '📚', type: 'VARIABLE' },
  { name: 'Autre',        emoji: '📦', type: 'VARIABLE' },
];
const PRESET_NAMES_SET = new Set(CHARGE_PRESETS.map(p => normalizeCatName(p.name)));

/* ══ CategorySelect : dropdown — affiche la liste preset (Fixes/Variables)
   comme dans le web, plus les catégories personnalisées issues de la DB ══ */
function CategorySelect({ value, onChange, categories, onAddCategory, onDeleteCategory }) {
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

  React.useEffect(() => {
    if (addingNew && inputRef.current) inputRef.current.focus();
  }, [addingNew]);

  // Catégories DB indexées par nom normalisé pour matcher avec les presets
  const dbCatByName = React.useMemo(() => {
    const map = {};
    for (const c of categories) map[normalizeCatName(c.name)] = c;
    return map;
  }, [categories]);

  // Catégories personnalisées = DB sans correspondance dans la liste preset
  const customCats = categories.filter(c => !PRESET_NAMES_SET.has(normalizeCatName(c.name)));

  // Découpe des presets en Fixes / Variables (ordre identique au web)
  const fixesPresets     = CHARGE_PRESETS.filter(p => p.type === 'FIXE');
  const variablesPresets = CHARGE_PRESETS.filter(p => p.type === 'VARIABLE');

  // Item sélectionné : on cherche dans la DB par id, puis on lit son nom (sans emoji)
  const selected     = categories.find(c => String(c.id) === String(value));
  const selectedName = selected?.name ?? '';
  const selectedPreset = CHARGE_PRESETS.find(p => normalizeCatName(p.name) === normalizeCatName(selectedName));
  const selectedLabel = selected
    ? (selectedPreset ? selectedPreset.name : selectedName)
    : null;

  /* Click sur un preset : trouve la catégorie DB existante OU la crée à la volée.
     Cas particulier "Autre" : on N'enregistre PAS la charge avec une catégorie
     littéralement nommée "Autre" — on ouvre l'input inline pour que l'admin
     saisisse le vrai nom custom (ex. "Médecin", "Caution voiture"…). Aligné
     sur le web Angular (champ "Préciser la catégorie" quand "Autre" est sélectionné). */
  const handlePresetClick = async (preset) => {
    if (normalizeCatName(preset.name) === 'autre') {
      // Ouvrir le champ de saisie inline (au lieu de fermer le dropdown).
      setAddingNew(true);
      setNewName('');
      return;
    }
    setOpen(false);
    const existing = dbCatByName[normalizeCatName(preset.name)];
    if (existing) {
      onChange(String(existing.id), existing);
      return;
    }
    // Aucune catégorie DB → la créer (puis sélectionner)
    const created = await onAddCategory(preset.name);
    if (created) onChange(String(created.id), created);
  };

  /* Render d'un preset (sans emoji) — toujours présent même si pas en DB.
     Le preset "Autre" sert de déclencheur pour saisir un nom custom : on
     l'indique visuellement avec "(préciser)" pour éviter qu'il soit
     enregistré littéralement comme "Autre" dans la BDD. */
  const renderPresetItem = (preset) => {
    const isAutre = normalizeCatName(preset.name) === 'autre';
    const dbCat = dbCatByName[normalizeCatName(preset.name)];
    const isSelected = !isAutre && dbCat && String(dbCat.id) === String(value);
    const displayLabel = isAutre ? 'Autre (préciser)' : preset.name;
    return (
      <div key={preset.name} onMouseDown={() => handlePresetClick(preset)}
        style={{ padding:'8px 14px 8px 24px', fontSize:'13px', cursor:'pointer',
          background: isSelected ? 'rgba(55,124,244,.09)' : 'transparent',
          color: isSelected ? 'var(--clr-primary)' : '#212529',
          fontWeight: isSelected ? 600 : 400,
          display:'flex', alignItems:'center', gap:'8px', transition:'background .12s' }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(55,124,244,.05)'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ flex:1 }}>{displayLabel}</span>
        {isSelected && <i className="bi bi-check2" style={{ color:'var(--clr-primary)', fontSize:'13px' }}></i>}
      </div>
    );
  };

  /* En-tête de groupe (optgroup-style) */
  const GroupHeader = ({ label }) => (
    <div style={{ padding:'6px 14px 4px', fontSize:'11px', fontWeight:700, letterSpacing:'.3px',
      color:'#64748b', background:'rgba(248,250,252,.6)' }}>
      {label}
    </div>
  );

  const handleAdd = async () => {
    const nom = newName.trim();
    if (!nom) return;
    const newCat = await onAddCategory(nom);
    if (newCat) {
      // onChange reçoit l'id ET la catégorie complète pour éviter un problème de timing React
      onChange(String(newCat.id), newCat);
    }
    setNewName('');
    setAddingNew(false);
    setOpen(false);
  };

  const handleDelete = (e, cat) => {
    e.stopPropagation();
    onDeleteCategory(cat.id, cat.name);
    if (String(value) === String(cat.id)) onChange('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(o => !o); setAddingNew(false); setNewName(''); }}
        className="form-select rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{ fontSize:'13px', height:'38px', cursor:'pointer',
          border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          background:'#fff', color: selectedLabel ? '#212529' : '#6c757d' }}>
        <span>{selectedLabel ?? '— Catégorie —'}</span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:'11px', opacity:.6 }}></i>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'#fff', borderRadius:'12px', border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 12px 32px rgba(0,0,0,.15)', zIndex:9999, overflow:'hidden',
          maxHeight:'320px', overflowY:'auto' }}>

          {/* Charges fixes — liste preset (identique à l'app web) */}
          <GroupHeader label="Charges fixes" />
          {fixesPresets.map(renderPresetItem)}

          {/* Charges variables — liste preset (identique à l'app web) */}
          <GroupHeader label="Charges variables" />
          {variablesPresets.map(renderPresetItem)}

          {/* Catégories personnalisées (pas dans CAT_META) */}
          {customCats.length > 0 && (
            <>
              <div style={{ padding:'6px 14px 4px', fontSize:'10px', fontWeight:700, letterSpacing:'.8px',
                color:'#94a3b8', textTransform:'uppercase', borderTop:'1px solid rgba(0,0,0,.06)', marginTop:'4px' }}>
                Personnalisées
              </div>
              {customCats.map(cat => {
                const isSelected = String(cat.id) === String(value);
                return (
                  <div key={cat.id}
                    style={{ padding:'8px 14px', fontSize:'13px', cursor:'pointer',
                      background: isSelected ? 'rgba(55,124,244,.09)' : 'transparent',
                      display:'flex', alignItems:'center', gap:'8px', transition:'background .12s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(55,124,244,.05)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                    <span onMouseDown={() => { onChange(String(cat.id)); setOpen(false); }}
                      style={{ flex:1, color: isSelected ? 'var(--clr-primary)' : '#212529',
                        fontWeight: isSelected ? 600 : 400, cursor:'pointer' }}>
                      {cat.name}
                    </span>
                    {isSelected && <i className="bi bi-check2" style={{ color:'var(--clr-primary)', fontSize:'13px' }}></i>}
                    <button type="button" onMouseDown={e => handleDelete(e, cat)}
                      style={{ width:'20px', height:'20px', borderRadius:'50%', border:'none',
                        background:'rgba(239,68,68,.15)', color:'#ef4444', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'12px', padding:0, flexShrink:0, transition:'background .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#ef4444'; e.currentTarget.style.color='#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(239,68,68,.15)'; e.currentTarget.style.color='#ef4444'; }}>
                      ✕
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Ajouter un nouveau type */}
          <div style={{ borderTop:'1px solid rgba(0,0,0,.06)', marginTop:'4px' }}>
            {!addingNew ? (
              <div onMouseDown={e => { e.preventDefault(); setAddingNew(true); }}
                style={{ padding:'9px 14px', fontSize:'13px', cursor:'pointer',
                  color:'var(--clr-primary)', fontWeight:600,
                  display:'flex', alignItems:'center', gap:'8px', transition:'background .12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(55,124,244,.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                <i className="bi bi-plus-circle" style={{ fontSize:'14px' }}></i>
                + Ajouter une catégorie
              </div>
            ) : (
              <div style={{ padding:'8px 10px', display:'flex', gap:'6px', alignItems:'center' }}
                onMouseDown={e => e.stopPropagation()}>
                <input ref={inputRef} type="text" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } if (e.key === 'Escape') { setAddingNew(false); setNewName(''); } }}
                  placeholder="Nom de la catégorie..."
                  style={{ flex:1, height:'32px', padding:'0 10px', fontSize:'12px',
                    border:'1.5px solid rgba(55,124,244,.4)', borderRadius:'8px',
                    outline:'none', color:'#1e293b' }} />
                <button type="button" onMouseDown={e => { e.preventDefault(); handleAdd(); }}
                  style={{ height:'32px', padding:'0 10px', fontSize:'12px', fontWeight:600,
                    background:'var(--clr-primary)', color:'#fff', border:'none',
                    borderRadius:'8px', cursor:'pointer', whiteSpace:'nowrap' }}>
                  Ajouter
                </button>
                <button type="button" onMouseDown={e => { e.preventDefault(); setAddingNew(false); setNewName(''); }}
                  style={{ height:'32px', width:'32px', fontSize:'13px',
                    background:'rgba(100,116,139,.1)', color:'#64748b', border:'none',
                    borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
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

/* ══ ModalDatePicker : calendrier custom avec saisie manuelle ══ */
const MOIS_LISTE_CH = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

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
      const firstDigit = parseInt(mmRaw[0]);
      if (mmRaw.length === 1 && firstDigit > 1) return; // ex: taper "2" → mois 20+ impossible
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
          className="form-control rounded-3"
          placeholder="jj/mm/aaaa"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          style={{ fontSize:'13px', height:'38px', paddingRight:'32px',
            border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
            boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none' }}
        />
        <i className="bi bi-calendar3"
          onClick={() => setOpen(o => !o)}
          style={{ position:'absolute', right:'10px', fontSize:'13px', opacity:.5, cursor:'pointer', color:'#6c757d' }}
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
            <span style={{ fontSize:'12px', fontWeight:700, color:'#212529' }}>{MOIS_LISTE_CH[viewM]} {viewY}</span>
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

/* ══ Modal confirmation suppression ══ */
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop-custom" style={{ zIndex: 1060 }} onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 400, padding: 0 }} onClick={e => e.stopPropagation()}>
        <div className="p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div style={{ width:44, height:44, borderRadius:'50%', flexShrink:0, background:'rgba(239,68,68,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ color:'#ef4444', fontSize:'1.3rem' }}></i>
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
            <button className="btn btn-sm rounded-3 px-3" style={{ background:'#ef4444', color:'#fff', border:'none' }} onClick={onConfirm}>
              <i className="bi bi-trash3 me-1"></i>Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOIS_LABELS_FR_GLOBAL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

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
          left: alignRight ? 'auto' : 0, right: alignRight ? 0 : 'auto',
          minWidth:'100%', width:'max-content', maxWidth:'220px',
          background:'#fff', borderRadius:'10px',
          border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 8px 24px rgba(0,0,0,.13)',
          zIndex:9999, maxHeight:'220px', overflowY:'auto',
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

  const getBudgetRestant = (m) => budgetsRestants[String(m.id)] ?? null;
  const isEpuise = (m) => { const b = getBudgetRestant(m); return b !== null && b <= 0; };

  const selected = membres.find(m => String(m.id) === String(value));

  const fmt = (n) => Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-select rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{
          fontSize: '13px', height: '38px', cursor: 'pointer',
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
            : '— Sélectionner un membre —'}
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
            const epuise = isEpuise(m);
            const budgetRest = getBudgetRestant(m);
            const isSelected = String(m.id) === String(value);
            return (
              <div
                key={m.id}
                onMouseDown={() => { if (!epuise) { onChange(String(m.id)); setOpen(false); } }}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
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

function ChargeListe() {
  const [charges,    setCharges]    = useState([]);
  const [membres,    setMembres]    = useState([]);
  const [categories, setCategories] = useState([]);   // depuis GET /categories
  const [compteId,   setCompteId]   = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const MOIS_LABELS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const [filterType,   setFilterType]   = useState('');
  const [filterCat,    setFilterCat]    = useState('');
  const [filterAnnee,  setFilterAnnee]  = useState(() => String(new Date().getFullYear()));
  const [filterMois,   setFilterMois]   = useState(() => MOIS_LABELS_FR[new Date().getMonth()]);
  const [filterMembre, setFilterMembre] = useState('');
  const [sortCol,      setSortCol]      = useState(null);
  const [sortAsc,      setSortAsc]      = useState(true);

  const [showModal,  setShowModal]  = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [form,       setForm]       = useState(FORM_INIT);
  const [roleUtilisateur, setRoleUtilisateur] = useState('');
  const [confirmDelete,   setConfirmDelete]   = useState(null);
  const [activeTab,       setActiveTab]       = useState('all');
  const [tabAnimating,    setTabAnimating]    = useState(false);
  const [tabDir,          setTabDir]          = useState('left');
  const swipeStartX = React.useRef(null);

  /* ══ Budget restant par membre (membreId → resteAVivre) ══ */
  const [budgetsRestants, setBudgetsRestants] = useState({});
  const [budgetError,     setBudgetError]     = useState('');
  const budgetErrorTimer = React.useRef(null);
  /* Stocke le budget brut (budget + carryover) par membreId pour recalcul multi-mois */
  const budgetsBrutsRef = React.useRef({});

  const showBudgetError = (msg) => {
    setBudgetError(msg);
    if (budgetErrorTimer.current) clearTimeout(budgetErrorTimer.current);
    budgetErrorTimer.current = setTimeout(() => setBudgetError(''), 3000);
  };

  useEffect(() => () => { if (budgetErrorTimer.current) clearTimeout(budgetErrorTimer.current); }, []);

  const TABS = [
    { key: 'all',      label: 'Toutes',             icon: 'bi-list-ul',          accentColor: 'var(--clr-primary)', badgeCls: 'bdg-all' },
    { key: 'fixe',     label: 'Charges Fixes',     icon: 'bi-lock2',            accentColor: 'var(--clr-blue)',   badgeCls: 'bdg-fixe' },
    { key: 'variable', label: 'Charges Variables',  icon: 'bi-arrow-left-right', accentColor: 'var(--clr-orange)', badgeCls: 'bdg-variable' },
  ];

  const switchTab = (newKey, dir) => {
    if (newKey === activeTab || tabAnimating) return;
    setTabDir(dir ?? (TABS.findIndex(t => t.key === newKey) > TABS.findIndex(t => t.key === activeTab) ? 'left' : 'right'));
    setTabAnimating(true);
    setTimeout(() => {
      setActiveTab(newKey);
      setTabAnimating(false);
    }, 220);
  };

  const handleSwipeStart = e => { swipeStartX.current = (e.touches?.[0] ?? e).clientX; };
  const handleSwipeEnd   = e => {
    if (swipeStartX.current === null) return;
    const dx = (e.changedTouches?.[0] ?? e).clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 40) return;
    const idx = TABS.findIndex(t => t.key === activeTab);
    if (dx < 0 && idx < TABS.length - 1) switchTab(TABS[idx + 1].key, 'left');
    if (dx > 0 && idx > 0)               switchTab(TABS[idx - 1].key, 'right');
  };

  /* ══ Chargement initial ══ */
  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      /* 1. User connecté */
      const username = sessionStorage.getItem('username');
      if (!username) { setError('Utilisateur non connecté.'); return; }
      const usersRes = await fetch(`${API}/users`);
      if (!usersRes.ok) { setError('Impossible de charger les utilisateurs.'); return; }
      const users = await usersRes.json();
      const currentUser = users.find(u => u.username === username);
      if (!currentUser?.id) { setError('Utilisateur introuvable.'); return; }
      const userId = currentUser.id;
      setCurrentUserId(userId);

      /* 2. Famille + rôle */
      let familleId = null;
      let roleLocal = 'MEMBRE';

      try {
        const adminRes = await fetch(`${API}/admins/user/${userId}`);
        if (adminRes.ok) {
          const adminText = await adminRes.text();
          const admin = adminText ? JSON.parse(adminText) : null;
          if (admin?.famille?.id) {
            familleId = admin.famille.id;
            roleLocal = 'ADMINISTRATEUR';
          }
        }
      } catch (_) { /* pas admin, on continue */ }

      if (!familleId) {
        try {
          const membreRes = await fetch(`${API}/membres/user/${userId}`);
          if (membreRes.ok) {
            const membreText = await membreRes.text();
            const membre = membreText ? JSON.parse(membreText) : null;
            if (membre?.famille?.id) familleId = membre.famille.id;
            if (membre?.role) roleLocal = membre.role;
          }
        } catch (_) { /* ignore */ }
      }

      setRoleUtilisateur(roleLocal);
      if (!familleId) { setError('Aucune famille trouvée pour cet utilisateur.'); return; }

      /* 3. Membres de la famille */
      const memRes = await fetch(`${API}/membres/famille/${familleId}`);
      let memData = memRes.ok ? (await memRes.json() ?? []) : [];

      /* 3b. Enrichir les membres dont user est null via GET /users/{uid} */
      memData = await Promise.all(
        memData.map(async m => {
          if (m.user?.firstName?.trim() || m.user?.lastName?.trim()) return m;
          const uid = m.userId ?? m.user?.id;
          if (!uid) return m;
          try {
            const uRes = await fetch(`${API}/users/${uid}`);
            if (uRes.ok) return { ...m, user: await uRes.json() };
          } catch (_) {}
          return m;
        })
      );

      /* 4. Compte */
      const compRes = await fetch(`${API}/comptes/famille/${familleId}`);
      if (!compRes.ok) { setError('Compte introuvable.'); return; }
      const compte = await compRes.json();
      setCompteId(compte.id);

      /* 5. Charges de TOUS les membres de la famille
            On lance GET /charges/membre/{id} pour chaque membre EN PARALLÈLE,
            puis on combine avec GET /charges/compte/{id} et on déduplique par id.
            Cela garantit que les charges de TOUS les membres sont incluses,
            peu importe quel utilisateur est connecté (admin ou membre simple). */
      const [chCompteRes, ...chMembreResponses] = await Promise.all([
        fetch(`${API}/charges/compte/${compte.id}`).catch(() => null),
        ...memData.map(m => fetch(`${API}/charges/membre/${m.id}`).catch(() => null)),
      ]);

      const parseJson = async (r) => {
        if (!r?.ok) return [];
        try { const d = await r.json(); return Array.isArray(d) ? d : []; }
        catch (_) { return []; }
      };

      const chCompteArr = await parseJson(chCompteRes);
      const chMembreArrs = await Promise.all(chMembreResponses.map(parseJson));

      /* Fusionner sans doublons (par id) */
      const idsSeen = new Set();
      const chData = [];
      for (const c of [...chCompteArr, ...chMembreArrs.flat()]) {
        if (c?.id != null && !idsSeen.has(c.id)) {
          idsSeen.add(c.id);
          chData.push(c);
        }
      }

      /* 6. Enrichir membres avec firstName/lastName depuis les charges */
      const nomParMembreId = {};
      chData.forEach(c => {
        const mid = c.membre?.id ?? c.membreId;
        const prenom = c.membrePrenom ?? c.membre?.user?.firstName ?? '';
        const nom    = c.membreNom    ?? c.membre?.user?.lastName  ?? '';
        if (mid && (prenom || nom)) nomParMembreId[mid] = { firstName: prenom, lastName: nom };
      });
      memData = memData.map(m => {
        if (m.user?.firstName?.trim() || m.user?.lastName?.trim()) return m;
        const info = nomParMembreId[m.id];
        if (!info) return m;
        return { ...m, user: { ...(m.user ?? {}), firstName: info.firstName, lastName: info.lastName } };
      });
      setMembres(memData);

      /* 7. Catégories AVANT de mapper les charges (besoin du nom pour le meta) */
      const catRes = await fetch(`${API}/categories/type/CHARGE`);
      const catData = catRes.ok ? (await catRes.json() ?? []) : [];
      setCategories(catData);

      /* Enrichir chaque charge avec le nom de catégorie depuis catData si le backend ne le retourne pas */
      const enrichedCharges = chData.map(c => {
        if (!c.categorie?.name && c.categorie?.id) {
          const catObj = catData.find(cat => cat.id === c.categorie.id);
          if (catObj) c = { ...c, categorie: catObj };
        }
        return mapCharge(c, memData);
      });
      setCharges(enrichedCharges);

      /* 8. Budgets restants par membre
            reste = (budget + carryover) − charges_paymentDate_du_mois
                                          − factures_datePaiement_du_mois
            Les deux totaux viennent de /total/mois (filtré côté backend par
            paymentDate/datePaiement). */
      const budgetsMap = {};
      await Promise.all(
        memData.map(async m => {
          try {
            const [budgetRes, chargesTotRes, factTotRes] = await Promise.all([
              fetch(`${API}/membres/${m.id}`),
              fetch(`${API}/charges/membre/${m.id}/total/mois`).catch(() => null),
              fetch(`${API}/factures/membre/${m.id}/total/mois`).catch(() => null),
            ]);
            const memObj      = budgetRes.ok ? await budgetRes.json() : null;
            const budget      = memObj?.budget ?? 0;
            const carryover   = memObj?.carryoverBudget ?? 0;
            const budgetTotal = budget + carryover;
            budgetsBrutsRef.current[String(m.id)] = budgetTotal;
            const charges_  = chargesTotRes?.ok ? (await chargesTotRes.json() ?? 0) : 0;
            const factures_ = factTotRes?.ok    ? (await factTotRes.json()    ?? 0) : 0;
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Filtre + tri ── */
  const filtered = useMemo(() => {
    let list = charges.filter(c => {
      const matchType   = !filterType   || c.type === filterType;
      const matchCat    = !filterCat    || c.cat.toLowerCase().includes(filterCat.toLowerCase());
      const matchMembre = !filterMembre || String(c.membreId) === filterMembre;
      let matchAnnee = true;
      let matchMois  = true;
      if ((filterAnnee || filterMois) && c.rawDate) {
        const d = new Date(c.rawDate);
        if (filterAnnee) matchAnnee = String(d.getFullYear()) === filterAnnee;
        if (filterMois)  matchMois  = MOIS_LABELS_FR[d.getMonth()] === filterMois;
      } else if ((filterAnnee || filterMois) && !c.rawDate) {
        matchAnnee = false; matchMois = false;
      }
      return matchType && matchCat && matchMembre && matchAnnee && matchMois;
    });
    if (sortCol) {
      list = [...list].sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
        return sortAsc ? String(va).localeCompare(String(vb),'fr') : String(vb).localeCompare(String(va),'fr');
      });
    } else {
      // Tri par défaut : décroissant par date (plus récent en haut)
      list = [...list].sort((a, b) => {
        const da = a.rawDate ? new Date(a.rawDate) : new Date(0);
        const db = b.rawDate ? new Date(b.rawDate) : new Date(0);
        return db - da;
      });
    }
    return list;
  }, [charges, filterType, filterCat, filterAnnee, filterMois, filterMembre, sortCol, sortAsc]);

  /* ══ Listes pour les dropdowns de filtrage ══ */
  const anneesPourFiltre = useMemo(() =>
    [...new Set(charges.map(c => c.rawDate ? String(new Date(c.rawDate).getFullYear()) : null).filter(Boolean))].sort((a,b) => b - a)
  , [charges]);

  const membresPourFiltre = useMemo(() =>
    [...new Set(charges.map(c => c.membreId).filter(Boolean))].map(mid => ({
      id: mid,
      nom: charges.find(x => x.membreId === mid)?.membre ?? `Membre #${mid}`,
    }))
  , [charges]);

  const fixes     = filtered.filter(c => c.type === 'fixe');
  const variables = filtered.filter(c => c.type === 'variable');
  const totalAmount  = filtered.reduce((s,c) => s + c.amount, 0);
  const totalFixes   = fixes.reduce((s,c) => s + c.amount, 0);
  const totalVars    = variables.reduce((s,c) => s + c.amount, 0);
  const nbDepasses   = filtered.filter(c => c.statut === 'depasse').length;

  const now = new Date();
  const currentYear = now.getFullYear();

  /* ── Étiquette période affichée dans le banner ── */
  const labelMoisBanner = filterMois
    ? filterMois
    : new Date().toLocaleDateString('fr-FR', { month: 'long' });
  const labelAnneeBanner = filterAnnee || String(currentYear);
  const moisAn = `${labelMoisBanner} ${labelAnneeBanner}`;

  /* ══ Totaux du mois : si filtre mois+année actif → basé sur filtered,
        sinon → mois courant sur charges brutes ══ */
  const chargesMoisCourant = useMemo(() => {
    if (filterMois || filterAnnee) {
      // Utiliser les charges déjà filtrées (filtered inclut les filtres mois+année+type+cat+membre)
      // On veut juste le total du mois sélectionné : filtered correspond exactement
      return filtered;
    }
    // Aucun filtre : mois courant sur toutes les charges
    return charges.filter(c => {
      if (!c.rawDate) return false;
      const d = new Date(c.rawDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [filtered, charges, filterMois, filterAnnee]);

  const totalMoisCourant = chargesMoisCourant.reduce((s,c) => s + c.amount, 0);
  const totalFixesMois   = chargesMoisCourant.filter(c => c.type === 'fixe').reduce((s,c) => s + c.amount, 0);
  const totalVarsMois    = chargesMoisCourant.filter(c => c.type === 'variable').reduce((s,c) => s + c.amount, 0);

  /* ══ Totaux annuels : si filtre année actif → toutes les charges de l'année filtrée
        (en respectant aussi les filtres type/cat/membre mais PAS le filtre mois)
        sinon → année courante sur charges brutes ══ */
  const chargesAnnee = useMemo(() => {
    const targetYear = filterAnnee ? Number(filterAnnee) : currentYear;
    // Base : charges filtrées par type/cat/membre (on retire le filtre mois pour avoir toute l'année)
    return charges.filter(c => {
      if (!c.rawDate) return false;
      if (new Date(c.rawDate).getFullYear() !== targetYear) return false;
      const matchType   = !filterType   || c.type === filterType;
      const matchCat    = !filterCat    || c.cat.toLowerCase().includes(filterCat.toLowerCase());
      const matchMembre = !filterMembre || String(c.membreId) === filterMembre;
      return matchType && matchCat && matchMembre;
    });
  }, [charges, filterAnnee, filterType, filterCat, filterMembre, currentYear]);

  const totalAnnuel      = chargesAnnee.reduce((s,c) => s + c.amount, 0);
  const totalFixesAnnuel = chargesAnnee.filter(c => c.type === 'fixe').reduce((s,c) => s + c.amount, 0);
  const totalVarsAnnuel  = chargesAnnee.filter(c => c.type === 'variable').reduce((s,c) => s + c.amount, 0);

  const fmt = n => Number(n).toLocaleString('fr-TN', { minimumFractionDigits:0, maximumFractionDigits:0 });

  const handleSort = col => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };
  const sortIcon = col => {
    if (sortCol !== col) return <span style={{ opacity:.4, fontSize:10, marginLeft:3 }}>⇅</span>;
    return <span style={{ fontSize:10, marginLeft:3, color:'var(--clr-primary)' }}>{sortAsc ? '▲' : '▼'}</span>;
  };

  /* ── Suppression → DELETE /charges/delete/{id} ── */
  const demanderSuppression = (id) => setConfirmDelete({ id });

  const confirmerSuppression = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API}/charges/delete/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setCharges(c => c.filter(x => x.id !== id));
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };

  /* ── Modal ── */
  const openModal = (ch = null) => {
    if (ch) {
      setEditId(ch.id);
      const typeBack = ch.type === 'fixe' ? 'FIXE' : 'VARIABLE';
      // Plus de periodicite dans le form : dérivée du type au save.
      setForm({ membreId: ch.membreId, type: typeBack, categorieId: ch.categorieId ? String(ch.categorieId) : '', categorie: ch.cat, amount: ch.amount, plafond: ch.plafond, date: ch.rawDate ?? '', paymentDate: (ch.rawPaymentDate || ch.rawDate || todayIso()).slice(0, 10), desc: ch.desc });
    } else {
      setEditId(null);
      setForm(FORM_INIT);
    }
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setSaving(false); setBudgetError(''); };

  /* ══ Vérification budget en temps réel ══
       Le reste à vivre côté serveur est déjà filtré par paymentDate du mois
       courant. En mode édition, on rajoute le montant original de la charge
       éditée (si son paymentDate tombe ce mois-ci) pour qu'elle ne se
       compte pas deux fois dans le contrôle de plafond. */
  const selectedBudgetRestant = useMemo(() => {
    if (!form.membreId) return null;
    const serverReste = budgetsRestants[String(form.membreId)];
    if (serverReste === null || serverReste === undefined) return null;

    if (!editId) return serverReste;

    const editedCharge = charges.find(c => c.id === editId);
    if (!editedCharge) return serverReste;
    const refDate = editedCharge.rawPaymentDate || editedCharge.rawDate;
    if (!refDate) return serverReste;
    const d = new Date(refDate);
    const now = new Date();
    const sameMonth = !Number.isNaN(d.getTime())
      && d.getMonth() === now.getMonth()
      && d.getFullYear() === now.getFullYear();
    return sameMonth ? serverReste + (editedCharge.amount || 0) : serverReste;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.membreId, budgetsRestants, charges, editId]);

  const membreBudgetEpuise = selectedBudgetRestant !== null && selectedBudgetRestant <= 0;
  const montantDepasse     = selectedBudgetRestant !== null
    && selectedBudgetRestant > 0
    && Number(form.amount) > 0
    && Number(form.amount) > selectedBudgetRestant;

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
  }, [form.membreId, form.amount, membreBudgetEpuise, montantDepasse]);


  /* ── Catégories : ajouter via POST /categories ── */
  const handleAddCategory = async (nom) => {
    if (!nom?.trim()) return;
    try {
      const payload = {
        name: nom.trim(),
        type: 'CHARGE',
        default: false,
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
        // Recharger depuis l'API pour avoir l'objet complet avec id réel
        try {
          const catRes = await fetch(`${API}/categories/type/CHARGE`);
          if (catRes.ok) {
            const catData = await catRes.json();
            setCategories(catData ?? []);
          } else {
            setCategories(prev => [...prev, newCat]);
          }
        } catch (_) {
          setCategories(prev => [...prev, newCat]);
        }
        return newCat;
      } else {
        const errText = await res.text();
        console.error('Erreur ajout catégorie:', errText);
      }
    } catch (err) {
      console.error('Erreur ajout catégorie:', err);
    }
    return null;
  };

  /* ── Catégories : supprimer via DELETE /categories/{id} ── */
  const handleDeleteCategory = async (catId, catName) => {
    const usedInCharges = charges.some(c => c.cat === catName);
    const msg = usedInCharges
      ? `La catégorie "${catName}" est utilisée dans des charges. Supprimer quand même ?`
      : `Supprimer la catégorie "${catName}" ?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`${API}/categories/${catId}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== catId));
        if (String(form.categorieId) === String(catId)) setForm(f => ({ ...f, categorieId: '', categorie: '' }));
      }
    } catch (err) {
      console.error('Erreur suppression catégorie:', err);
    }
  };

  /* ── Enregistrer → POST /charges/add  |  PUT /charges/edit/{id} ── */
  const handleSave = async () => {
    if (!form.membreId || !form.categorieId || !form.amount || !form.date) {
      alert('Veuillez remplir tous les champs obligatoires.');
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
    /* Vérifier le budget limit si un plafond est défini */
    if (compteId && form.plafond && Number(form.plafond) > 0) {
      try {
        const checkRes = await fetch(
          `${API}/charges/check-budget-limit?compteId=${compteId}&montant=${Number(form.amount)}`
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData?.depasse || checkData === true) {
            const continuer = window.confirm(
              `⚠️ Ce montant dépasse le plafond défini (${Number(form.plafond).toLocaleString('fr-TN')} DT). Continuer quand même ?`
            );
            if (!continuer) { setSaving(false); return; }
          }
        }
      } catch (_) { /* non bloquant si l'endpoint échoue */ }
    }
    // CREATE : force aujourd'hui (utilisateur n'a pas accès à ce champ).
    // EDIT : préserve la paymentDate existante pour ne pas déplacer la
    // charge d'un mois budget à un autre rétroactivement.
    const paymentDate = editId
      ? (form.paymentDate || todayIso())
      : todayIso();
    const payload = {
      amount:      Number(form.amount),
      ceiling:     Number(form.plafond) || 0,
      type:        form.type,
      chargeDate:  form.date,
      paymentDate,
      description: form.desc || null,
      membre:      { id: Number(form.membreId) },
      compte:      compteId ? { id: compteId } : undefined,
      categorie:   { id: Number(form.categorieId) },
    };
    try {
      let res;
      if (editId) {
        res = await fetch(`${API}/charges/edit/${editId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API}/charges/add`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const errText = await res.text();
        console.error('[ChargeListe] erreur backend →', errText);
        throw new Error(errText);
      }
      closeModal();
      window.dispatchEvent(new Event('dashboard-refresh'));
      await fetchAll();
    } catch (err) {
      alert('Erreur lors de l\'enregistrement : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ════════════════════════════════════════
     RENDU
  ════════════════════════════════════════ */
  return (
    <Layout>
      <style>{`
        :root {
          --clr-primary:#377CF4; --clr-green:#22c55e; --clr-blue:#377CF4;
          --clr-orange:#f97316; --clr-red:#ef4444; --clr-slate:#64748b; --clr-teal:#0ea5e9;
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .anim   { animation: fadeUp .4s ease both; }
        .anim-1 { animation-delay:.05s; } .anim-2 { animation-delay:.10s; }
        .anim-3 { animation-delay:.15s; } .anim-4 { animation-delay:.22s; }

        .kpi-banner {
          background: linear-gradient(135deg,#377CF4 0%,#325DC1 55%,#2E3F8F 100%);
          border-radius:22px; position:relative; overflow:hidden;
          box-shadow:0 14px 42px rgba(55,124,244,.32);
        }
        .kpi-banner::before { content:''; position:absolute; top:-50px; right:-50px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,.07); }
        .kpi-banner::after  { content:''; position:absolute; bottom:-40px; left:-30px; width:130px; height:130px; border-radius:50%; background:rgba(255,255,255,.05); }
        .kpi-var-badge { background:rgba(255,255,255,.18); border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700; backdrop-filter:blur(6px); display:inline-flex; align-items:center; gap:4px; }
        .kpi-var-badge.down { background:rgba(239,68,68,.25); }

        .sum-card { border-radius:18px; transition:transform .22s ease,box-shadow .22s ease; }
        .sum-card:hover { transform:translateY(-4px); box-shadow:0 12px 32px rgba(0,0,0,.11)!important; }
        .sum-icon { width:48px;height:48px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0; }
        .ic-blue   { background:rgba(55,124,244,.14); color:var(--clr-blue); }
        .ic-orange { background:rgba(249,115,22,.14); color:var(--clr-orange); }
        .ic-red    { background:rgba(239,68,68,.14);  color:var(--clr-red); }
        .var-pill  { font-size:10px;font-weight:700;border-radius:10px;padding:2px 8px;display:inline-flex;align-items:center;gap:2px; }
        .vp-down { background:rgba(239,68,68,.13); color:var(--clr-red); }

        .bdg { font-size:10px;font-weight:700;border-radius:10px;padding:3px 9px;letter-spacing:.2px;display:inline-block; }
        .bdg-fixe     { background:rgba(55,124,244,.13);  color:var(--clr-blue); }
        .bdg-variable { background:rgba(249,115,22,.13);  color:var(--clr-orange); }
        .bdg-normal   { background:rgba(34,197,94,.13);   color:#16a34a; }
        .bdg-depasse  { background:rgba(239,68,68,.13);   color:var(--clr-red); }

        .sec-label { display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:700; }
        .charge-row { transition:background .18s ease; }
        .charge-row:hover { background:rgba(55,124,244,.04)!important; }
        .th-sort { cursor:pointer;user-select:none;white-space:nowrap; }
        .th-sort:hover { color:var(--clr-primary); }
        .btn-action-edit   { color:var(--clr-primary); background:none; border:none; }
        .btn-action-delete { color:var(--clr-red);     background:none; border:none; }
        .btn-action-edit:hover   { background:rgba(55,124,244,.1); border-radius:8px; }
        .btn-action-delete:hover { background:rgba(239,68,68,.1);  border-radius:8px; }
        .av-initials { width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0; }
        .avatar-35 { width:35px;height:35px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0; }
        .mob-card { border-radius:16px;border-left:3px solid var(--clr-red);transition:transform .2s ease,box-shadow .2s ease; }
        .mob-card:hover { transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.09)!important; }

        @media (max-width:767px) { .d-md-none { display:block!important } .d-none.d-md-block { display:none!important } }

        .adminuiux-content.has-sidebar { padding-top:56px!important; }
        .adminuiux-sidebar { padding-top:56px!important; top:0!important; }
        .adminuiux-sidebar-inner { height:100%!important; overflow-y:auto!important; }
        .navbar.fixed-top { z-index:1050!important; backdrop-filter:blur(12px)!important; background-color:inherit!important; }

        .modal-backdrop-custom { position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1055;display:flex;align-items:center;justify-content:center;padding:16px; }
        .modal-box { background:#fff;border-radius:20px;width:100%;max-width:520px;max-height:90vh;overflow:visible;box-shadow:0 24px 60px rgba(0,0,0,.18);animation:fadeUp .3s ease both; }
        .modal-box-inner { max-height:calc(90vh - 80px);overflow-y:auto;overflow-x:visible; }

        /* ── Tab System ── */
        @keyframes slideInLeft  { from{opacity:0;transform:translateX(40px)}  to{opacity:1;transform:translateX(0)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(-40px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideOutLeft  { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(-40px)} }
        @keyframes slideOutRight { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(40px)} }

        .tab-bar { display:flex; background:#f1f5f9; border-radius:16px; padding:4px; gap:4px; }
        .tab-btn {
          flex:1; border:none; background:transparent; border-radius:12px;
          padding:9px 12px; font-size:13px; font-weight:600; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:7px;
          color:#64748b; transition:all .22s cubic-bezier(.4,0,.2,1);
          white-space:nowrap;
        }
        .tab-btn.active {
          background:#fff; color:var(--tab-accent,var(--clr-primary));
          box-shadow:0 2px 10px rgba(0,0,0,.09);
        }
        .tab-dot { width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.7;flex-shrink:0; }
        .tab-count { font-size:10px;font-weight:700;border-radius:8px;padding:1px 6px;background:currentColor;color:#fff; }
        .tab-count-inner { mix-blend-mode:normal; }

        .tab-indicator { height:3px;border-radius:2px;background:var(--tab-accent,var(--clr-primary)); transition:width .3s ease,transform .3s ease; }

        .tab-content-wrapper { overflow:hidden; position:relative; }
        .tab-content-panel { will-change:transform,opacity; }
        .tab-content-panel.slide-in-left  { animation:slideInLeft  .22s cubic-bezier(.4,0,.2,1) both; }
        .tab-content-panel.slide-in-right { animation:slideInRight .22s cubic-bezier(.4,0,.2,1) both; }
        .tab-content-panel.slide-out-left  { animation:slideOutLeft  .22s cubic-bezier(.4,0,.2,1) both; pointer-events:none; }
        .tab-content-panel.slide-out-right { animation:slideOutRight .22s cubic-bezier(.4,0,.2,1) both; pointer-events:none; }

        /* ── Charge Card (new style) ── */
        .charge-card {
          border-radius:16px; background:#fff; border:1.5px solid rgba(0,0,0,.06);
          box-shadow:0 2px 8px rgba(0,0,0,.05);
          transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;
          cursor:default; overflow:hidden;
        }
        .charge-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,.10); border-color:var(--card-accent,rgba(55,124,244,.2)); }
        .charge-card-accent { width:4px; flex-shrink:0; border-radius:4px 0 0 4px; }
        .empty-tab { text-align:center; padding:48px 24px; }
        .empty-tab-icon { width:64px;height:64px;border-radius:20px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem; }

        /* ── Filter Bar (identique Factures) ── */
        .filter-bar .form-select { border-radius:10px; font-size:.8rem; }
        .filter-bar .form-select:focus { box-shadow:0 0 0 3px rgba(55,124,244,.15); border-color:var(--clr-primary); }

        /* ── Type Toggle Buttons ── */
        .type-toggle { display:flex; gap:8px; }
        .type-toggle-btn {
          flex:1; height:38px; border-radius:10px; font-size:13px; font-weight:600;
          border:1.5px solid rgba(55,124,244,.25); cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:7px;
          transition:all .2s cubic-bezier(.4,0,.2,1);
          background:#f8fafc; color:#64748b;
        }
        .type-toggle-btn.active-fixe {
          background:var(--clr-primary); color:#fff;
          border-color:var(--clr-primary);
          box-shadow:0 4px 14px rgba(55,124,244,.3);
        }
        .type-toggle-btn.active-variable {
          background:var(--clr-orange); color:#fff;
          border-color:var(--clr-orange);
          box-shadow:0 4px 14px rgba(249,115,22,.3);
        }
        .type-toggle-btn:not(.active-fixe):not(.active-variable):hover {
          border-color:rgba(55,124,244,.4);
          background:#f1f5f9;
        }

        /* ── Category Manager ── */
        .cat-manager { display:flex; flex-direction:column; gap:8px; }
        .cat-add-row { display:flex; gap:8px; }
        .cat-add-input {
          flex:1; height:36px; padding:0 12px; font-size:13px;
          border:1.5px solid rgba(55,124,244,.25); border-radius:10px;
          background:#fff; color:#1e293b;
          transition:border-color .18s,box-shadow .18s;
        }
        .cat-add-input:focus { outline:none; border-color:rgba(55,124,244,.5); box-shadow:0 0 0 3px rgba(55,124,244,.10); }
        .cat-add-btn {
          height:36px; padding:0 14px; font-size:12px; font-weight:600;
          border:none; border-radius:10px;
          background:var(--clr-primary); color:#fff; cursor:pointer;
          display:flex; align-items:center; gap:5px;
          transition:all .18s; white-space:nowrap;
        }
        .cat-add-btn:hover { background:#377CF4; box-shadow:0 4px 12px rgba(55,124,244,.3); }
        .cat-tags { display:flex; flex-wrap:wrap; gap:6px; max-height:120px; overflow-y:auto; }
        .cat-tag {
          display:inline-flex; align-items:center; gap:5px;
          height:28px; padding:0 10px; border-radius:8px;
          font-size:12px; font-weight:500;
          background:rgba(55,124,244,.08); color:var(--clr-primary);
          border:1px solid rgba(55,124,244,.2);
          transition:all .15s;
        }
        .cat-tag.default-cat { background:rgba(100,116,139,.08); color:#475569; border-color:rgba(100,116,139,.2); }
        .cat-tag-del {
          width:16px; height:16px; border-radius:50%; border:none;
          background:rgba(239,68,68,.15); color:#ef4444; cursor:pointer;
          display:flex; align-items:center; justify-content:center; font-size:10px;
          padding:0; transition:all .15s; flex-shrink:0;
        }
        .cat-tag-del:hover { background:#ef4444; color:#fff; }
      `}</style>

      <div className="main-container container" style={{ paddingTop:'12px', paddingBottom:'80px' }}>

        {/* ── Breadcrumb + Titre ── */}
        <div className="row gx-3 mb-2 anim">
          <div className="col-12">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h5 className="mb-0 fw-bold">💸 Gestion des Charges</h5>
                <p className="text-secondary small mb-0">Contrôlez et analysez toutes vos dépenses familiales</p>
              </div>
              {roleUtilisateur !== 'CONSULTANT' && (
              <button className="btn btn-theme btn-sm rounded-3 px-3" onClick={() => openModal()} disabled={loading}>
                <i className="bi bi-plus-lg me-1"></i> Ajouter une charge
              </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Erreur ── */}
        {error && (
          <div className="alert alert-danger rounded-3 py-2 px-3 mb-3" style={{ fontSize:'13px' }}>
            <i className="bi bi-exclamation-circle me-2"></i>{error}
            <button className="btn btn-sm btn-link text-danger float-end p-0" onClick={fetchAll}>Réessayer</button>
          </div>
        )}

        {/* ── Hero KPI Banner ── */}
        <div className="row gx-3 mb-3 mt-2 anim anim-1">
          <div className="col-12">
            <div className="kpi-banner p-4">
              {/* Phrase ajoutée : total famille ou membre filtré */}
              <p className="text-white mb-3" style={{ opacity:1, fontSize:'16px', letterSpacing:'.3px', fontWeight:700, textAlign:'left' }}>
                {filterMembre ? (
                  <><i className="bi bi-person me-2"></i>Charges de {(() => { const m = membres.find(mm => String(mm.id) === filterMembre); return m?.user ? `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() : `Membre #${filterMembre}`; })()}</>
                ) : (
                  <><i className="bi bi-people me-2"></i>Total charge de toute la famille</>
                )}
              </p>
              <div className="d-flex align-items-end justify-content-between flex-wrap gap-3">
                {/* Gauche : total mensuel (grand) + label */}
                <div style={{ flex: '1 1 auto' }}>
                  <p className="text-white mb-1" style={{ opacity:.72, fontSize:'11px', letterSpacing:'.8px', textTransform:'uppercase', fontWeight:600 }}>
                    <i className="bi bi-calendar3 me-1"></i>Charges du mois · {moisAn}
                  </p>
                  <h1 className="text-white fw-bold mb-2" style={{ fontSize:'clamp(2rem,5vw,2.8rem)', letterSpacing:'-1.5px', lineHeight:1 }}>
                    {loading ? '—' : fmt(totalMoisCourant)}
                    <span style={{ fontSize:'1.1rem', opacity:.75, marginLeft:'6px' }}>DT</span>
                  </h1>
                  {/* Badges info */}
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    {nbDepasses > 0 && (
                      <span className="kpi-var-badge down">
                        <i className="bi bi-exclamation-triangle" style={{ fontSize:'11px' }}></i>
                        {nbDepasses} dépassement{nbDepasses > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="kpi-var-badge">
                      <i className="bi bi-receipt" style={{ fontSize:'11px' }}></i>
                      {chargesMoisCourant.length} charge{chargesMoisCourant.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Droite : total annuel (plus petit, aligné bas) */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p className="text-white mb-1" style={{ opacity:.6, fontSize:'10px', letterSpacing:'.6px', textTransform:'uppercase', fontWeight:600 }}>
                    <i className="bi bi-graph-up me-1"></i>Total {labelAnneeBanner}
                  </p>
                  <p className="text-white fw-bold mb-0" style={{ fontSize:'clamp(1.1rem,3vw,1.5rem)', letterSpacing:'-0.5px', opacity:.92 }}>
                    {loading ? '—' : fmt(totalAnnuel)}
                    <span style={{ fontSize:'0.75rem', opacity:.7, marginLeft:'5px' }}>DT / an</span>
                  </p>
                  <p className="text-white mb-0" style={{ fontSize:'10px', opacity:.55, marginTop:'2px' }}>
                    calculé sur {chargesAnnee.length} charge{chargesAnnee.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="row gx-3 mb-4 anim anim-2">
          {/* Charges Fixes */}
          <div className="col-6 mb-2">
            <div className="card adminuiux-card sum-card h-100" style={{ borderTop: '3px solid var(--clr-blue)', borderRadius:'18px', position:'relative', overflow:'hidden' }}>

              <div className="card-body p-3 d-flex flex-column justify-content-between" style={{ minHeight:'110px' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="sum-icon ic-blue" style={{ position:'relative' }}>
                    {/* Icône cadenas SVG inline — net et centré */}
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                      style={{ width:'22px', height:'22px', color:'var(--clr-blue)' }}>
                      <rect x="4" y="11" width="16" height="11" rx="2.5" fill="var(--clr-blue)" fillOpacity=".18"/>
                      <rect x="4" y="11" width="16" height="11" rx="2.5" stroke="var(--clr-blue)" strokeWidth="1.8"/>
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="var(--clr-blue)" strokeWidth="1.8" strokeLinecap="round"/>
                      <circle cx="12" cy="16.5" r="1.4" fill="var(--clr-blue)"/>
                      <line x1="12" y1="17.9" x2="12" y2="19.5" stroke="var(--clr-blue)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'var(--clr-blue)', letterSpacing:'.2px' }}>Charges Fixes</span>
                </div>
                <div>
                  <h4 className="fw-bold mb-0" style={{ fontSize:'clamp(1.2rem,3vw,1.6rem)', color:'#1e293b' }}>
                    {loading ? '—' : fmt(totalFixesMois)}
                    <span className="text-secondary ms-1" style={{ fontSize:'11px', fontWeight:400 }}>DT / mois</span>
                  </h4>
                  <div className="d-flex align-items-center justify-content-between mt-1">
                    <span className="text-secondary" style={{ fontSize:'10.5px' }}>
                      {chargesMoisCourant.filter(c => c.type === 'fixe').length} poste{chargesMoisCourant.filter(c => c.type === 'fixe').length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize:'10px', color:'var(--clr-blue)', fontWeight:600, background:'rgba(55,124,244,.10)', borderRadius:'8px', padding:'2px 7px' }}>
                      {loading ? '—' : fmt(totalFixesAnnuel)} DT / an
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charges Variables */}
          <div className="col-6 mb-2">
            <div className="card adminuiux-card sum-card h-100" style={{ borderTop: '3px solid var(--clr-orange)', borderRadius:'18px' }}>
              <div className="card-body p-3 d-flex flex-column justify-content-between" style={{ minHeight:'110px' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="sum-icon ic-orange"><i className="bi bi-arrow-left-right"></i></div>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'var(--clr-orange)', letterSpacing:'.2px' }}>Charges Variables</span>
                </div>
                <div>
                  <h4 className="fw-bold mb-0" style={{ fontSize:'clamp(1.2rem,3vw,1.6rem)', color:'#1e293b' }}>
                    {loading ? '—' : fmt(totalVarsMois)}
                    <span className="text-secondary ms-1" style={{ fontSize:'11px', fontWeight:400 }}>DT / mois</span>
                  </h4>
                  <div className="d-flex align-items-center justify-content-between mt-1">
                    <span className="text-secondary" style={{ fontSize:'10.5px' }}>
                      {chargesMoisCourant.filter(c => c.type === 'variable').length} poste{chargesMoisCourant.filter(c => c.type === 'variable').length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize:'10px', color:'var(--clr-orange)', fontWeight:600, background:'rgba(249,115,22,.10)', borderRadius:'8px', padding:'2px 7px' }}>
                      {loading ? '—' : fmt(totalVarsAnnuel)} DT / an
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton chargement */}
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-theme-1" role="status" style={{ width:'2rem', height:'2rem' }}></div>
            <p className="text-secondary mt-3 small">Chargement des charges...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* ══════════ SWIPEABLE TAB SYSTEM (Mobile + Desktop) ══════════ */}
            <div className="anim anim-4 mb-5">

              {/* ── Tab Bar Header ── */}
              <div className="card adminuiux-card" style={{ borderRadius:'20px', overflow:'hidden' }}>
                <div className="p-3 pb-0" style={{ borderBottom:'1px solid rgba(0,0,0,.06)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
                    <p className="sec-label mb-0">
                      <i className="bi bi-layers text-theme-1 me-1"></i> Liste des charges
                    </p>
                  </div>

                  {/* ── Filter Bar ── */}
                  <div className="filter-bar mb-2">
                    <div className="d-flex gap-2" style={{ flexWrap:'nowrap', overflow:'visible' }}>
                      <FilterSelect
                        value={filterMois}
                        onChange={setFilterMois}
                        placeholder="Mois"
                        options={[
                          { value:'', label:'Tous les mois' },
                          ...MOIS_LABELS_FR_GLOBAL.map(m => ({ value:m, label:m })),
                        ]}
                      />
                      <FilterYearInput
                        value={filterAnnee}
                        onChange={setFilterAnnee}
                        placeholder="Année"
                      />
                      <FilterSelect
                        value={filterMembre}
                        onChange={setFilterMembre}
                        placeholder="Membres"
                        options={[
                          { value:'', label:'Tous membres' },
                          ...membresPourFiltre.map(m => ({ value:String(m.id), label:m.nom })),
                        ]}
                      />
                      <FilterSelect
                        value={filterCat}
                        onChange={setFilterCat}
                        placeholder="Catégories"
                        alignRight={true}
                        options={[
                          { value:'', label:'Toutes catégories' },
                          ...categories
                            .filter((c, idx, arr) => arr.findIndex(x => normalizeCatName(x.name) === normalizeCatName(c.name)) === idx)
                            .map(c => ({ value:c.name, label:c.name })),
                        ]}
                      />
                    </div>
                  </div>
                  {/* Tabs */}
                  <div className="tab-bar mb-0">
                    {TABS.map(tab => {
                      const list = tab.key === 'all'  ? filtered
                                 : tab.key === 'fixe' ? fixes
                                 : variables;
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          className={`tab-btn${isActive ? ' active' : ''}`}
                          style={{ '--tab-accent': tab.accentColor }}
                          onClick={() => switchTab(tab.key)}
                        >
                          {tab.key === 'fixe' ? (
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                              style={{ width:'14px', height:'14px', flexShrink:0 }}>
                              <rect x="4" y="11" width="16" height="11" rx="2.5"
                                fill={isActive ? 'var(--clr-blue)' : '#94a3b8'} fillOpacity=".2"/>
                              <rect x="4" y="11" width="16" height="11" rx="2.5"
                                stroke={isActive ? 'var(--clr-blue)' : '#94a3b8'} strokeWidth="1.7"/>
                              <path d="M8 11V8a4 4 0 0 1 8 0v3"
                                stroke={isActive ? 'var(--clr-blue)' : '#94a3b8'} strokeWidth="1.7" strokeLinecap="round"/>
                              <circle cx="12" cy="16.5" r="1.3"
                                fill={isActive ? 'var(--clr-blue)' : '#94a3b8'}/>
                            </svg>
                          ) : (
                            <i className={`bi ${tab.icon}`} style={{ fontSize:'13px' }}></i>
                          )}
                          <span className="d-none d-sm-inline">{tab.label}</span>
                          <span className="d-sm-none">
                            {tab.key === 'all' ? 'Toutes' : tab.key === 'fixe' ? 'Fixes' : 'Variables'}
                          </span>
                          <span style={{
                            fontSize:'10px', fontWeight:700, borderRadius:'8px', padding:'1px 6px',
                            background: isActive ? tab.accentColor : '#94a3b8',
                            color:'#fff', marginLeft:'2px', flexShrink:0,
                          }}>{list.length}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Tab Content ── */}
                <div
                  className="tab-content-wrapper"
                  onTouchStart={handleSwipeStart}
                  onTouchEnd={handleSwipeEnd}
                  onMouseDown={handleSwipeStart}
                  onMouseUp={handleSwipeEnd}
                >
                  {(() => {
                    const curTab = TABS.find(t => t.key === activeTab);
                    const list   = activeTab === 'all'  ? filtered
                                 : activeTab === 'fixe' ? fixes
                                 : variables;

                    return (
                      <div
                        className={`tab-content-panel${tabAnimating ? (tabDir === 'left' ? ' slide-out-left' : ' slide-out-right') : (tabDir === 'left' ? ' slide-in-left' : ' slide-in-right')}`}
                        style={{ '--card-accent': curTab.accentColor }}
                      >
                        {/* ── Desktop Table ── */}
                        <div className="d-none d-md-block">
                          <div className="table-responsive">
                            <table className="table table-hover mb-0">
                              <thead>
                                <tr style={{ borderBottom:'2px solid rgba(0,0,0,.05)', background:'rgba(248,250,252,1)' }}>
                                  <th className="ps-3" style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}>Membre</th>
                                  <th className="th-sort" onClick={() => handleSort('cat')} style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}>
                                    Catégorie {sortIcon('cat')}
                                  </th>
                                  <th style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}>Type</th>
                                  <th className="th-sort" onClick={() => handleSort('amount')} style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}>
                                    Montant {sortIcon('amount')}
                                  </th>
                                  <th className="th-sort" onClick={() => handleSort('date')} style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}>
                                    Date {sortIcon('date')}
                                  </th>
                                  <th style={{ fontSize:'12px', fontWeight:700, color:'#475569' }}>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {list.length === 0 && (
                                  <tr>
                                    <td colSpan="6" style={{ padding:0, border:'none' }}>
                                      <div className="empty-tab">
                                        <div className="empty-tab-icon" style={{ background: curTab.accentColor + '18' }}>
                                          <i className={`bi ${curTab.icon}`} style={{ color: curTab.accentColor }}></i>
                                        </div>
                                        <p className="fw-semibold mb-1" style={{ color:'#334155' }}>Aucune charge{activeTab === 'all' ? '' : activeTab === 'fixe' ? ' fixe' : ' variable'}</p>
                                        <p className="text-secondary mb-0" style={{ fontSize:'13px' }}>
                                          {filterCat ? `Aucun résultat pour « ${filterCat} »` : 'Commencez par ajouter une charge.'}
                                        </p>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {list.map(c => (
                                  <tr key={c.id} className="charge-row">
                                    <td className="ps-3"><span className="small">{c.membre}</span></td>
                                    <td>
                                      <span className="small fw-medium">{c.cat}</span>
                                    </td>
                                    <td>
                                      <span className="bdg" style={{ background: curTab.accentColor + '18', color: curTab.accentColor }}>
                                        {c.typeLabel}
                                      </span>
                                    </td>
                                    <td><span className="small fw-bold" style={{ color: curTab.accentColor }}>{fmt(c.amount)} DT</span></td>
                                    <td><span className="small text-secondary">{c.date}</span></td>
                                    <td>
                                      <span className="small text-secondary" style={{ fontSize:'11px' }}>
                                        {c.desc || '—'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* ── Mobile Cards ── */}
                        <div className="d-md-none p-3">
                          {list.length === 0 ? (
                            <div className="empty-tab">
                              <div className="empty-tab-icon" style={{ background: curTab.accentColor + '18' }}>
                                <i className={`bi ${curTab.icon}`} style={{ color: curTab.accentColor, fontSize:'1.8rem' }}></i>
                              </div>
                              <p className="fw-semibold mb-1" style={{ color:'#334155' }}>Aucune charge{activeTab === 'all' ? '' : activeTab === 'fixe' ? ' fixe' : ' variable'}</p>
                              <p className="text-secondary mb-0" style={{ fontSize:'13px' }}>
                                {filterCat ? `Aucun résultat pour « ${filterCat} »` : 'Commencez par ajouter une charge.'}
                              </p>
                            </div>
                          ) : (
                            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                              {list.map(c => (
                                <div key={c.id} className="charge-card" style={{ '--card-accent': curTab.accentColor, display:'flex' }}>
                                  <div style={{ width:'4px', background: curTab.accentColor, borderRadius:'4px 0 0 4px', flexShrink:0 }}></div>
                                  <div style={{ padding:'12px 14px', flex:1 }}>
                                    <div className="d-flex align-items-start justify-content-between gap-2">
                                      <div className="d-flex align-items-center gap-2 flex-grow-1">
                                        <div style={{ minWidth:0 }}>
                                          <p className="mb-0 fw-semibold" style={{ fontSize:'13px', color:'#1e293b' }}>{c.cat}</p>
                                          <p className="text-secondary mb-0" style={{ fontSize:'11px' }}>
                                            <i className="bi bi-person me-1"></i>{c.membre}
                                          </p>
                                          <p className="text-secondary mb-1" style={{ fontSize:'11px' }}>
                                            <span style={{ color: curTab.accentColor, fontWeight:600 }}>{c.typeLabel}</span>
                                          </p>
                                          {c.desc && <p className="text-secondary mb-0" style={{ fontSize:'10px', fontStyle:'italic' }}>{c.desc}</p>}
                                        </div>
                                      </div>
                                      <div style={{ textAlign:'right', flexShrink:0 }}>
                                        <p className="fw-bold mb-0" style={{ fontSize:'15px', color: curTab.accentColor }}>
                                          {fmt(c.amount)}
                                        </p>
                                        <p className="text-secondary mb-0" style={{ fontSize:'10px' }}>DT · {c.date}</p>

                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════ MODAL ══════════ */}
      {showModal && (
        <div className="modal-backdrop-custom" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="p-4 pb-2">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5 className="fw-bold mb-0">
                    <i className={`bi ${editId ? 'bi-pencil-square text-warning' : 'bi-plus-circle text-danger'} me-2`}></i>
                    {editId ? 'Modifier la charge' : 'Ajouter une charge'}
                  </h5>
                  <p className="text-secondary small mb-0">Remplissez les informations de la dépense</p>
                </div>
                <button className="btn btn-sm btn-link text-secondary" onClick={closeModal}><i className="bi bi-x-lg"></i></button>
              </div>
            </div>

            <div className="modal-box-inner">
            <div className="p-4 pt-2">
              {/* Membre */}
              <div className="mb-3">
                <label className="form-label small fw-medium"><i className="bi bi-person me-1 text-theme-1"></i>Membre concerné <span className="text-danger">*</span></label>
                <BudgetAwareSelect
                  value={form.membreId}
                  onChange={val => {
                    setForm({...form, membreId: val, amount: ''});
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

              {/* Type + Catégorie */}
              <div className="row gx-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium"><i className="bi bi-tag me-1 text-theme-1"></i>Type <span className="text-danger">*</span></label>
                  <div className="type-toggle">
                    <button
                      type="button"
                      className={`type-toggle-btn${form.type === 'FIXE' ? ' active-fixe' : ''}`}
                      onClick={() => setForm({...form, type: 'FIXE'})}
                    >
                      <i className="bi bi-lock2" style={{ fontSize:'13px' }}></i>
                      Fixe
                    </button>
                    <button
                      type="button"
                      className={`type-toggle-btn${form.type === 'VARIABLE' ? ' active-variable' : ''}`}
                      onClick={() => setForm({...form, type: 'VARIABLE'})}
                    >
                      <i className="bi bi-arrow-left-right" style={{ fontSize:'13px' }}></i>
                      Variable
                    </button>
                  </div>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium"><i className="bi bi-grid me-1 text-theme-1"></i>Catégorie <span className="text-danger">*</span></label>
                  <CategorySelect
                    value={form.categorieId}
                    onChange={(id, newCat) => {
                      // newCat est passé uniquement lors d'une création (timing React)
                      const cat = newCat ?? categories.find(c => String(c.id) === String(id));
                      setForm(f => ({ ...f, categorieId: id, categorie: cat?.name ?? '' }));
                    }}
                    categories={categories}
                    onAddCategory={handleAddCategory}
                    onDeleteCategory={handleDeleteCategory}
                  />
                </div>
              </div>

              {/* Montant */}
              <div className="mb-3">
                <label className="form-label small fw-medium"><i className="bi bi-cash me-1 text-theme-1"></i>Montant (DT) <span className="text-danger">*</span></label>
                <div className="input-group">
                  <input type="number" className="form-control rounded-start-3" placeholder="0" min="0"
                    value={form.amount}
                    onChange={e => setForm({...form, amount: e.target.value})}
                    style={montantDepasse ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,.15)' } : {}}
                  />
                  <span className="input-group-text">DT</span>
                </div>
              </div>

              {/* Date — pleine largeur (Périodicité retirée du formulaire :
                  dérivée automatiquement de form.type côté handleSave —
                  FIXE → MENSUELLE, VARIABLE → PONCTUELLE). */}
              <div className="mb-3" style={{ overflow:'visible' }}>
                <label className="form-label small fw-medium"><i className="bi bi-calendar3 me-1 text-theme-1"></i>Date de la charge <span className="text-danger">*</span></label>
                <ModalDatePicker
                  value={form.date}
                  onChange={val => setForm({...form, date: val})}
                />
              </div>

              {/* La date de paiement n'est pas exposée : imposée à
                  aujourd'hui par handleSave (règle "toujours imputé au
                  mois courant"). Préservée à l'identique en mode édition. */}

              {/* Description */}
              <div className="mb-3">
                <label className="form-label small fw-medium"><i className="bi bi-chat-left-text me-1 text-theme-1"></i>Description</label>
                <textarea className="form-control rounded-3" rows="2" placeholder="Détails supplémentaires..."
                  value={form.desc} onChange={e => setForm({...form, desc:e.target.value})} />
              </div>
              <p className="text-secondary" style={{ fontSize:'0.75rem' }}><span className="text-danger">*</span> Champs obligatoires</p>
            </div>

            </div>{/* /modal-box-inner */}
            <div className="px-4 pb-4 d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary rounded-3 px-4" onClick={closeModal} disabled={saving}>
                <i className="bi bi-x-lg me-1"></i>Annuler
              </button>
              <button className="btn btn-theme rounded-3 px-4" onClick={handleSave} disabled={saving || membreBudgetEpuise || montantDepasse}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</>
                  : <><i className="bi bi-check-lg me-1"></i>Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <ConfirmModal
          message="Êtes-vous sûr de vouloir supprimer cette charge ? Cette action est irréversible."
          onConfirm={confirmerSuppression}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Layout>
  );
}

/* ══ Carte mobile ══ */
function MobileCard({ charge: c, onEdit, onDelete, canEdit }) {
  return (
    <div className="card adminuiux-card mob-card mb-3" style={{ borderLeftColor: c.borderColor }}>
      <div className="card-body p-3">
        <div className="d-flex align-items-start gap-3">
          <div className="av-initials" style={{ background: c.iconBg + '33' }}>{c.emoji}</div>
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <p className="mb-0 fw-semibold" style={{ fontSize:'13px' }}>{c.cat}</p>
                <p className="text-secondary mb-0" style={{ fontSize:'11px' }}>{c.membre}</p>
                <p className="text-secondary mb-1" style={{ fontSize:'11px' }}>{c.typeLabel}</p>
                <div className="d-flex gap-2 flex-wrap">
                  <TypeBadge type={c.type} />
                  {c.statut === 'depasse' && <StatutBadge statut={c.statut} />}
                </div>
              </div>
              <div className="text-end">
                <p className="fw-bold text-danger mb-0" style={{ fontSize:'15px' }}>{Number(c.amount).toLocaleString('fr-TN')}</p>
                <p className="text-secondary mb-0" style={{ fontSize:'10px' }}>DT · {c.date}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChargeListe;
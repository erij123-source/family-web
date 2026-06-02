import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';

const API = 'http://localhost:8080';

/* ══ Helper : récupérer la photo de profil d'un objet membre/user ══ */
function getProfilePhoto(obj) {
  if (!obj) return null;
  const keys = ['profilePicture', 'profilePhoto', 'avatar', 'avatarUrl', 'photoUrl', 'photo', 'picture', 'imageUrl'];
  for (const k of keys) {
    if (obj[k]) return obj[k];
    if (obj.user?.[k]) return obj.user[k];
  }
  return null;
}

/* ══ Enrichit chaque membre avec sa photo via GET /users/{id} + cache localStorage ══ */
async function enrichMembresWithPhotos(membres) {
  return Promise.all((membres ?? []).map(async (m) => {
    const u        = m.user ?? m;
    const uId      = u.id ?? m.userId ?? null;
    const uUsername = u.username ?? '';
    const cacheKey  = uUsername ? 'avatar__' + uUsername : null;

    let photo = getProfilePhoto(m);

    if (!photo && cacheKey) photo = localStorage.getItem(cacheKey) || '';

    if (!photo && uId) {
      try {
        const res = await fetch(`${API}/users/${uId}`);
        if (res.ok) {
          const data = await res.json();
          photo = data.photo ?? data.avatar ?? data.profileImage ?? data.profilePicture ?? '';
          if (photo && cacheKey) localStorage.setItem(cacheKey, photo);
        }
      } catch (_) {}
    }

    return photo
      ? { ...m, photo, avatar: photo, user: m.user ? { ...m.user, photo, avatar: photo } : m.user }
      : m;
  }));
}

/* ══ Couleurs par index membre ══ */
const COULEURS = [
  { c: 'rgba(34,197,94,.15)',  t: '#16a34a' },
  { c: 'rgba(55,124,244,.15)', t: 'var(--clr-blue)' },
  { c: 'rgba(14,165,233,.15)', t: 'var(--clr-teal)' },
  { c: 'rgba(249,115,22,.15)', t: 'var(--clr-orange)' },
  { c: 'rgba(55,124,244,.15)', t: 'var(--clr-primary)' },
];

/* ══ Mappings type/période ══ */
const TYPE_LABEL   = { SALAIRE: 'Salaire', SECONDAIRE: 'Secondaire', AIDE: 'Aide', AUTRE: 'Autre' };
const TYPE_BADGE   = { Salaire: 'bdg-salaire', Secondaire: 'bdg-secon', Aide: 'bdg-aide', Autre: 'bdg-autre' };

/* ══ Clé localStorage pour les types personnalisés ══ */
const CUSTOM_TYPES_KEY = 'revenus_custom_types';
const loadCustomTypes  = () => { try { return JSON.parse(localStorage.getItem(CUSTOM_TYPES_KEY) ?? '[]'); } catch { return []; } };
const saveCustomTypes  = (arr) => { try { localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(arr)); } catch {} };

/* Kind backend = FIXE | VARIABLE (remplace l'ancienne periodicite).
 * On garde des constantes nommées PERIODE_* pour limiter le delta de refactor :
 * la liste affiche désormais "Fixe" ou "Variable" au lieu de "Mensuel/Annuel/Ponctuel". */
const KIND_BADGE = { FIXE: 'bdg-mensuel', VARIABLE: 'bdg-ponctuel' };
const KIND_LABEL = { FIXE: 'Fixe',         VARIABLE: 'Variable' };

/* ══ Transformer une entrée API → objet UI ══ */
function mapRevenu(r, membres) {
  // ✅ Lire directement depuis le DTO
  const membreId = r.membreId;
  const prenom   = r.membrePrenom ?? '';
  const nom      = r.membreNom    ?? '';
  const nomMembre = `${prenom} ${nom}`.trim() || `Membre #${membreId}`;

  const idx = membres.findIndex(m => m.id === membreId);
  const { c, t } = COULEURS[idx >= 0 ? idx % COULEURS.length : 0];
  const initiales = nomMembre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const typeRaw = (r.type ?? '').toUpperCase();
  const typeKey = TYPE_LABEL[typeRaw] ?? r.type ?? 'Autre';
  const kindRaw = (r.kind ?? 'FIXE').toUpperCase();
  const kindKey = kindRaw === 'VARIABLE' ? 'VARIABLE' : 'FIXE';

  // typeDisplay : si AUTRE + description non vide → label du type custom
  let typeDisplay = typeKey;
  let typeIsCustom = false;
  if (typeRaw === 'AUTRE') {
    const desc = r.description?.trim() ?? '';
    if (desc) {
      typeDisplay  = desc;
      typeIsCustom = true;
    } else {
      typeDisplay  = 'Autre';
      typeIsCustom = false;
    }
  }

  return {
    id:           r.id,
    membreId:     r.membreId,
    membre:       nomMembre,
    initiales,
    couleur:      c,
    couleurText:  t,
    type:         typeKey,
    typeDisplay,
    typeIsCustom,
    badgeType:    typeIsCustom ? 'bdg-custom' : (TYPE_BADGE[typeKey] ?? 'bdg-autre'),
    kind:         kindKey,                       // 'FIXE' | 'VARIABLE' (raw)
    periode:      KIND_LABEL[kindKey],           // 'Fixe' | 'Variable' (affichage liste)
    badgePeriode: KIND_BADGE[kindKey],
    montant:      r.amount ?? 0,
    date: r.perceptionDate
      ? new Date(r.perceptionDate).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
      : '—',
    rawDate: r.perceptionDate ?? '',
    desc:    typeIsCustom ? '' : (r.description ?? ''),
  };
}


// `kind` = FIXE (revenu récurrent) | VARIABLE (revenu ponctuel) — envoyé tel quel au backend.
// `type` = preset name (Salaire / Revenu secondaire / Aide…) ou CUSTOM__xxx.
const FORM_INIT = { membreId: '', kind: 'FIXE', type: '', montant: '', date: '', desc: '' };

// Catégories presets (alignées avec l'app web Angular — revenu-modal).
const REVENU_PRESETS = [
  { name: 'Salaire' },
  { name: 'Revenu secondaire' },
  { name: 'Aide / Subvention' },
];

/* ══ Avatar membre : photo de profil ou initiales en fallback ══ */
function MemberAvatar({ photoUrl, initiales, couleur, couleurText, size = 30 }) {
  const [imgError, setImgError] = React.useState(false);
  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={initiales}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '2px solid rgba(55,124,244,.15)',
          boxShadow: '0 2px 6px rgba(0,0,0,.12)',
        }}
      />
    );
  }
  return (
    <div
      className="av-initials flex-shrink-0"
      style={{ background: couleur, color: couleurText, width: size, height: size }}
    >
      {initiales}
    </div>
  );
}

/* ══ Helper badges ══ */
function TypeBadge({ type, typeDisplay, badgeType }) {
  const label = typeDisplay ?? type;
  const cls   = badgeType ?? TYPE_BADGE[type] ?? 'bdg-autre';
  return <span className={`bdg ${cls}`}>{label}</span>;
}
function PeriodeBadge({ periode }) {
  const map = { Mensuel: 'bdg-mensuel', Annuel: 'bdg-annuel', Ponctuel: 'bdg-ponctuel' };
  return <span className={`bdg ${map[periode] ?? 'bdg-mensuel'}`}>{periode}</span>;
}

/* ══ Modal de confirmation suppression ══ */
/* ══ ModalDatePicker : calendrier custom avec saisie manuelle ══ */
const MOIS_LISTE_RV = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

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
            <span style={{ fontSize:'12px', fontWeight:700, color:'#212529' }}>{MOIS_LISTE_RV[viewM]} {viewY}</span>
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

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop-custom" style={{ zIndex: 1060 }} onClick={onCancel}>
      <div
        className="modal-box"
        style={{ maxWidth: 400, padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(239,68,68,.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444', fontSize: '1.3rem' }}></i>
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
            <button
              className="btn btn-sm rounded-3 px-3"
              style={{ background: '#ef4444', color: '#fff', border: 'none' }}
              onClick={onConfirm}
            >
              <i className="bi bi-trash3 me-1"></i>Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══ CustomSelect générique ══ */
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
      <button type="button" onClick={() => setOpen(o => !o)}
        className="form-select rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{ fontSize:'13px', height:'38px', cursor:'pointer', gap:'6px',
          border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          background:'#fff', color: selected ? '#212529' : '#6c757d' }}>
        <span style={{ flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:'11px', opacity:.6, flexShrink:0 }}></i>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'#fff', borderRadius:'10px', border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 8px 24px rgba(0,0,0,.13)', zIndex:9999,
          maxHeight:'200px', overflowY:'auto' }}>
          {options.map(opt => (
            <div key={opt.value} onMouseDown={() => { onChange(opt.value); setOpen(false); }}
              style={{ padding:'7px 12px', fontSize:'13px', cursor:'pointer',
                background: opt.value === value ? 'rgba(55,124,244,.09)' : 'transparent',
                color: opt.value === value ? 'var(--clr-primary)' : '#212529',
                fontWeight: opt.value === value ? 600 : 400,
                display:'flex', alignItems:'center', gap:'7px', transition:'background .12s' }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(55,124,244,.05)'; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}>
              {opt.label}
              {opt.value === value && <i className="bi bi-check2 ms-auto" style={{ color:'var(--clr-primary)', fontSize:'13px' }}></i>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ TypeSelectWithAdd : sélecteur de type avec ajout/suppression dynamique ══ */
function TypeSelectWithAdd({ value, onChange, customTypes, onAddType, onDeleteType }) {
  const [open, setOpen]         = React.useState(false);
  const [addMode, setAddMode]   = React.useState(false);
  const [newLabel, setNewLabel] = React.useState('');
  const ref = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAddMode(false); setNewLabel(''); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  React.useEffect(() => { if (addMode && inputRef.current) inputRef.current.focus(); }, [addMode]);

  /* Types de base */
  const BASE_TYPES = [
    { value: 'SALAIRE',    label: 'Salaire' },
    { value: 'SECONDAIRE', label: 'Revenu secondaire' },
    { value: 'AIDE',       label: 'Aide / Subvention' },
  ];

  const allOptions = [
    ...BASE_TYPES,
    ...customTypes.map(ct => ({ value: 'CUSTOM__' + ct, label: ct, isCustom: true })),
  ];

  const selected = allOptions.find(o => o.value === value);
  const displayLabel = selected ? selected.label : (value ? value : null);

  const handleConfirmAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    onAddType(label);
    onChange('CUSTOM__' + label);
    setNewLabel('');
    setAddMode(false);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Trigger button */}
      <button type="button" onClick={() => { setOpen(o => !o); setAddMode(false); setNewLabel(''); }}
        className="form-select rounded-3 text-start d-flex align-items-center justify-content-between"
        style={{ fontSize:'13px', height:'38px', cursor:'pointer', gap:'6px',
          border: open ? '1.5px solid rgba(55,124,244,.6)' : '1px solid #dee2e6',
          boxShadow: open ? '0 0 0 3px rgba(55,124,244,.10)' : 'none',
          background:'#fff', color: displayLabel ? '#212529' : '#6c757d' }}>
        <span style={{ flex:1, minWidth:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {displayLabel ?? '— Catégorie —'}
        </span>
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} style={{ fontSize:'11px', opacity:.6, flexShrink:0 }}></i>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
          background:'#fff', borderRadius:'12px', border:'1.5px solid rgba(55,124,244,.2)',
          boxShadow:'0 8px 28px rgba(0,0,0,.14)', zIndex:9999,
          maxHeight:'260px', overflowY:'auto' }}>

          {/* Types de base */}
          {BASE_TYPES.map(opt => (
            <div key={opt.value} onMouseDown={() => { onChange(opt.value); setOpen(false); }}
              style={{ padding:'8px 12px', fontSize:'13px', cursor:'pointer',
                background: opt.value === value ? 'rgba(55,124,244,.09)' : 'transparent',
                color: opt.value === value ? 'var(--clr-primary)' : '#212529',
                fontWeight: opt.value === value ? 600 : 400,
                display:'flex', alignItems:'center', gap:'7px', transition:'background .12s' }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(55,124,244,.05)'; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}>
              {opt.label}
              {opt.value === value && <i className="bi bi-check2 ms-auto" style={{ color:'var(--clr-primary)' }}></i>}
            </div>
          ))}

          {/* Séparateur si types custom présents */}
          {customTypes.length > 0 && (
            <div style={{ borderTop:'1px solid rgba(55,124,244,.12)', margin:'4px 0',
              padding:'4px 12px', fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.4px' }}>
              Types personnalisés
            </div>
          )}

          {/* Types personnalisés avec ❌ */}
          {customTypes.map(ct => {
            const val = 'CUSTOM__' + ct;
            return (
              <div key={val}
                style={{ padding:'8px 12px', fontSize:'13px', cursor:'pointer',
                  background: val === value ? 'rgba(55,124,244,.09)' : 'transparent',
                  display:'flex', alignItems:'center', gap:'7px', transition:'background .12s' }}
                onMouseEnter={e => { if (val !== value) e.currentTarget.style.background = 'rgba(55,124,244,.05)'; }}
                onMouseLeave={e => { if (val !== value) e.currentTarget.style.background = 'transparent'; }}>
                <span onMouseDown={() => { onChange(val); setOpen(false); }}
                  style={{ flex:1, color: val === value ? 'var(--clr-primary)' : '#212529',
                    fontWeight: val === value ? 600 : 400, cursor:'pointer' }}>
                  ✏️ {ct}
                </span>
                {val === value && <i className="bi bi-check2" style={{ color:'var(--clr-primary)', fontSize:'13px' }}></i>}
                <button type="button" title="Supprimer ce type"
                  onMouseDown={e => { e.stopPropagation(); onDeleteType(ct); if (value === val) onChange(''); }}
                  style={{ background:'none', border:'none', padding:'2px 4px', cursor:'pointer',
                    color:'#ef4444', fontSize:'13px', lineHeight:1, borderRadius:'4px',
                    flexShrink:0, display:'flex', alignItems:'center' }}>
                  <i className="bi bi-x-circle-fill"></i>
                </button>
              </div>
            );
          })}

          {/* Séparateur + bouton Ajouter */}
          <div style={{ borderTop:'1px solid rgba(55,124,244,.12)', marginTop:'4px' }}>
            {!addMode ? (
              <div onMouseDown={() => setAddMode(true)}
                style={{ padding:'9px 12px', fontSize:'13px', cursor:'pointer',
                  color:'var(--clr-primary)', fontWeight:600,
                  display:'flex', alignItems:'center', gap:'7px',
                  background:'rgba(55,124,244,.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(55,124,244,.10)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(55,124,244,.04)'}>
                <i className="bi bi-plus-circle-fill" style={{ fontSize:'14px' }}></i>
                + Ajouter un nouveau type
              </div>
            ) : (
              <div style={{ padding:'8px 10px', display:'flex', gap:'6px', alignItems:'center' }} onMouseDown={e => e.stopPropagation()}>
                <input ref={inputRef} type="text" value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleConfirmAdd(); if (e.key === 'Escape') { setAddMode(false); setNewLabel(''); } }}
                  placeholder="Ex: Cadeau, Héritage..."
                  style={{ flex:1, fontSize:'12px', border:'1.5px solid rgba(55,124,244,.4)',
                    borderRadius:'7px', padding:'5px 8px', outline:'none',
                    boxShadow:'0 0 0 2px rgba(55,124,244,.08)' }} />
                <button type="button" onMouseDown={handleConfirmAdd}
                  style={{ background:'var(--clr-primary)', color:'#fff', border:'none',
                    borderRadius:'7px', padding:'5px 10px', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
                  OK
                </button>
                <button type="button" onMouseDown={() => { setAddMode(false); setNewLabel(''); }}
                  style={{ background:'transparent', color:'#6c757d', border:'none',
                    borderRadius:'7px', padding:'5px', cursor:'pointer', fontSize:'14px' }}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            )}
          </div>
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
          display:'flex', alignItems:'center',
          whiteSpace:'nowrap', overflow:'hidden',
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
function RevenusListe() {
  const navigate = useNavigate();

  /* ── État ── */
  const [revenus,      setRevenus]      = useState([]);
  const [membres,      setMembres]      = useState([]);
  const [compteId,     setCompteId]     = useState(null);
  const [totalRevenus, setTotalRevenus] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  /* ── Point 5 : filtres mois/année/membre (remplace la recherche texte) ── */
  const now = new Date();
  const [filtreMois,   setFiltreMois]   = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [filtreAnnee,  setFiltreAnnee]  = useState(String(now.getFullYear()));
  const [filtreMembre, setFiltreMembre] = useState('');

  const [sortCol,      setSortCol]      = useState('rawDate');
  const [sortAsc,      setSortAsc]      = useState(false); // Point 4 : décroissant par défaut

  /* ── Modal ajout/modif ── */
  const [showModal,     setShowModal]     = useState(false);
  const [editId,        setEditId]        = useState(null);
  const [form,          setForm]          = useState(FORM_INIT);

  /* ── Point 2 : modal confirmation suppression ── */
  const [confirmDelete, setConfirmDelete] = useState(null); // { id } ou null
  const [roleUtilisateur, setRoleUtilisateur] = useState(''); // ADMINISTRATEUR | GESTIONNAIRE | CONSULTANT
  const [adminTabPeriode, setAdminTabPeriode] = useState('MENSUEL'); // onglet admin : MENSUEL | ANNUEL
  const [customTypes, setCustomTypes] = useState(() => loadCustomTypes()); // types personnalisés (persistés localStorage)
  const [currentMembre, setCurrentMembre] = useState(null); // membre connecté (pour exclure de la liste admin)

  /* ══ Chargement initial : user connecté → famille → membres + compte → revenus ══ */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const username = sessionStorage.getItem('username');
      if (!username) { setError('Utilisateur non connecté.'); return; }

      const usersRes = await fetch(`${API}/users`);
      if (!usersRes.ok) { setError('Impossible de charger les utilisateurs.'); return; }
      const users = await usersRes.json();
      const currentUser = users.find(u => u.username === username);
      if (!currentUser?.id) { setError('Utilisateur introuvable.'); return; }
      const userId = currentUser.id;

      let familleId = null;
      let memData = [];
      let roleLocal = 'ADMINISTRATEUR'; // variable locale fiable (state React pas dispo immédiatement)
      let currentMembreLocal = null; // membre connecté

      const adminRes = await fetch(`${API}/admins/user/${userId}`);
      if (adminRes.ok) {
        const admin = await adminRes.json();
        if (admin.famille?.id) familleId = admin.famille.id;
        roleLocal = 'ADMINISTRATEUR';
      }

      if (!familleId) {
        const membreRes = await fetch(`${API}/membres/user/${userId}`);
        if (membreRes.ok) {
          const membre = await membreRes.json();
          if (membre.famille?.id) familleId = membre.famille.id;
          if (membre.role) roleLocal = membre.role;
          currentMembreLocal = membre;
        }
      }

      setRoleUtilisateur(roleLocal);
      setCurrentMembre(currentMembreLocal);

      if (!familleId) { setError('Aucune famille trouvée pour cet utilisateur.'); return; }

      const memRes = await fetch(`${API}/membres/famille/${familleId}`);
      if (memRes.ok) {
        const rawMembres = await memRes.json() ?? [];

        // Enrichir chaque membre avec son objet user si non présent
        let tempMemData = await Promise.all(
          rawMembres.map(async (m) => {
            if (m.user?.firstName?.trim() || m.user?.lastName?.trim()) return m;
            const uid = m.userId ?? m.user?.id;
            if (!uid) return m;
            try {
              const uRes = await fetch(`${API}/users/${uid}`);
              if (uRes.ok) {
                const userData = await uRes.json();
                return { ...m, user: userData };
              }
            } catch (_) {}
            return m;
          })
        );

        // Enrichir avec les photos de profil (même logique que le Dashboard)
        memData = await enrichMembresWithPhotos(tempMemData);
      }

      const compRes = await fetch(`${API}/comptes/famille/${familleId}`);
      if (!compRes.ok) { setError('Compte introuvable.'); return; }
      const compte = await compRes.json();
      setCompteId(compte.id);

      const revRes = await fetch(`${API}/revenus/compte/${compte.id}`);
      const revData = revRes.ok ? await revRes.json() : [];

      // Enrichir memData avec firstName/lastName depuis les RevenuDTOs
      // (utile quand un membre n'a pas encore de revenu et que l'API membres ne retourne pas user)
      const nomParMembreId = {};
      (revData ?? []).forEach(r => {
        if (r.membreId && (r.membrePrenom || r.membreNom)) {
          nomParMembreId[r.membreId] = { firstName: r.membrePrenom ?? '', lastName: r.membreNom ?? '' };
        }
      });
      memData = memData.map(m => {
        if (m.user?.firstName?.trim() || m.user?.lastName?.trim()) return m;
        const info = nomParMembreId[m.id];
        if (!info) return m;
        // Préserver photo/avatar existants lors de la mise à jour des noms
        return {
          ...m,
          user: {
            ...(m.user ?? {}),
            firstName: info.firstName,
            lastName:  info.lastName,
            photo:  m.photo ?? m.avatar ?? m.user?.photo ?? m.user?.avatar,
            avatar: m.photo ?? m.avatar ?? m.user?.photo ?? m.user?.avatar,
          },
        };
      });

      setMembres(memData);
      setRevenus((revData ?? []).map(r => mapRevenu(r, memData ?? [])));

      const totRes = await fetch(`${API}/revenus/total-amount/${compte.id}`);
      if (totRes.ok) setTotalRevenus(await totRes.json());

    } catch (err) {
      setError('Erreur de connexion au serveur.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Point 4 & 5 : Filtre par mois/année/membre + tri décroissant ── */
  const filtered = useMemo(() => {
    let list = revenus.filter(r => {
      const matchMembre = !filtreMembre || r.membreId === Number(filtreMembre);

      let matchDate = true;
      if (r.rawDate) {
        const d = new Date(r.rawDate);
        const moisR   = String(d.getMonth() + 1).padStart(2, '0');
        const anneeR  = String(d.getFullYear());
        matchDate =
          (!filtreMois  || moisR  === filtreMois) &&
          (!filtreAnnee || anneeR === filtreAnnee);
      }

      return matchMembre && matchDate;
    });

    /* Tri */
    const col = sortCol ?? 'rawDate';
    list = [...list].sort((a, b) => {
      let va = a[col], vb = b[col];
      if (col === 'rawDate') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
        return sortAsc ? va - vb : vb - va;
      }
      if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc
        ? String(va).localeCompare(String(vb), 'fr')
        : String(vb).localeCompare(String(va), 'fr');
    });

    return list;
  }, [revenus, filtreMois, filtreAnnee, filtreMembre, sortCol, sortAsc]);

  const totalFiltré = filtered.reduce((s, r) => s + r.montant, 0);

  /* ── Total de l'année sélectionnée calculé depuis les données locales ── */
  const totalAnneeActuelle = useMemo(() => {
    const anneeCible = filtreAnnee || String(new Date().getFullYear());
    return revenus
      .filter(r => r.rawDate && String(new Date(r.rawDate).getFullYear()) === anneeCible)
      .reduce((s, r) => s + r.montant, 0);
  }, [revenus, filtreAnnee]);

  /* ── Revenus de l'année sélectionnée (pour le compteur "calculé sur X revenus") ── */
  const revenusAnnee = useMemo(() => {
    const anneeCible = filtreAnnee || String(new Date().getFullYear());
    return revenus.filter(r => r.rawDate && String(new Date(r.rawDate).getFullYear()) === anneeCible);
  }, [revenus, filtreAnnee]);

  /* ── Total du mois sélectionné (pour le banner violet) ── */
  const totalMoisFiltré = useMemo(() => {
    return revenus.filter(r => {
      if (!r.rawDate) return false;
      const d = new Date(r.rawDate);
      const moisR  = String(d.getMonth() + 1).padStart(2, '0');
      const anneeR = String(d.getFullYear());
      const moisCible  = filtreMois  || String(now.getMonth() + 1).padStart(2, '0');
      const anneeCible = filtreAnnee || String(now.getFullYear());
      const matchDate   = moisR === moisCible && anneeR === anneeCible;
      const matchMembre = !filtreMembre || r.membreId === Number(filtreMembre);
      return matchDate && matchMembre;
    }).reduce((s, r) => s + r.montant, 0);
  }, [revenus, filtreMois, filtreAnnee, filtreMembre]);

  /* ── Revenus Fixes / Variables — totals dérivés du backend ─────────────
     kind = 'FIXE' (récurrent) | 'VARIABLE' (ponctuel).
     On filtre sur les revenus du mois sélectionné (banner) puis on calcule
     les totaux mensuels et annuels en deux passes (mois courant + année). */
  const revenusMoisCourant = useMemo(() => {
    const moisCible  = filtreMois  || String(now.getMonth() + 1).padStart(2, '0');
    const anneeCible = filtreAnnee || String(now.getFullYear());
    return revenus.filter(r => {
      if (!r.rawDate) return false;
      const d = new Date(r.rawDate);
      const moisR  = String(d.getMonth() + 1).padStart(2, '0');
      const anneeR = String(d.getFullYear());
      const matchDate = moisR === moisCible && anneeR === anneeCible;
      const matchMembre = !filtreMembre || r.membreId === Number(filtreMembre);
      return matchDate && matchMembre;
    });
  }, [revenus, filtreMois, filtreAnnee, filtreMembre]);

  const isVariable = (r) => r.kind === 'VARIABLE';
  const isFixe     = (r) => r.kind !== 'VARIABLE';

  const totalFixesMois   = useMemo(() => revenusMoisCourant.filter(isFixe).reduce((s,r) => s + r.montant, 0), [revenusMoisCourant]);
  const totalVarsMois    = useMemo(() => revenusMoisCourant.filter(isVariable).reduce((s,r) => s + r.montant, 0), [revenusMoisCourant]);
  const totalFixesAnnuel = useMemo(() => revenusAnnee.filter(isFixe).reduce((s,r) => s + r.montant, 0), [revenusAnnee]);
  const totalVarsAnnuel  = useMemo(() => revenusAnnee.filter(isVariable).reduce((s,r) => s + r.montant, 0), [revenusAnnee]);

  /* ── Label mois affiché dans le banner (suit le filtre) ── */
  const moisAnLabel = useMemo(() => {
    const moisCible  = filtreMois  || String(now.getMonth() + 1).padStart(2, '0');
    const anneeCible = filtreAnnee || String(now.getFullYear());
    const d = new Date(Number(anneeCible), Number(moisCible) - 1, 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [filtreMois, filtreAnnee]);

  /* ── Tri ── */
  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(col !== 'rawDate'); } // date : décroissant par défaut
  };
  const sortIcon = (col) => {
    if (sortCol !== col) return <span style={{ opacity:.4, fontSize:10, marginLeft:3 }}>⇅</span>;
    return <span style={{ fontSize:10, marginLeft:3, color:'var(--clr-primary)' }}>{sortAsc ? '▲' : '▼'}</span>;
  };

  /* ── Point 2 : Suppression avec confirmation modal ── */
  const demanderSuppression = (id) => setConfirmDelete({ id });

  const confirmerSuppression = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API}/revenus/delete/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRevenus(r => r.filter(x => x.id !== id));
      if (compteId) {
        const t = await fetch(`${API}/revenus/total-amount/${compteId}`);
        if (t.ok) setTotalRevenus(await t.json());
      }
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };

  /* ── Modal ouvrir / fermer ── */
  const openModal = (rev = null) => {
    if (rev) {
      setEditId(rev.id);
      // kind est désormais stocké tel quel ('FIXE' | 'VARIABLE'), plus de conversion périodicité.
      const kindFromRev = rev.kind === 'VARIABLE' ? 'VARIABLE' : 'FIXE';
      // Si type custom → CUSTOM__xxx, sinon type backend standard
      let typeForForm;
      if (rev.typeIsCustom && rev.typeDisplay) {
        typeForForm = 'CUSTOM__' + rev.typeDisplay;
      } else {
        typeForForm = Object.keys(TYPE_LABEL).find(k => TYPE_LABEL[k] === rev.type) ?? '';
      }
      setForm({ membreId: String(rev.membreId), kind: kindFromRev, type: typeForForm, montant: rev.montant, date: rev.rawDate ?? '', desc: rev.desc });
    } else {
      setEditId(null);
      setForm(FORM_INIT);
    }
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setSaving(false); };

  /* ── Gestion types personnalisés ── */
  const handleAddType = (label) => {
    setCustomTypes(prev => {
      if (prev.includes(label)) return prev;
      const next = [...prev, label];
      saveCustomTypes(next);
      return next;
    });
  };
  const handleDeleteType = (label) => {
    setCustomTypes(prev => {
      const next = prev.filter(t => t !== label);
      saveCustomTypes(next);
      return next;
    });
  };

  /* ── Enregistrer → POST /revenus/ajouter  |  PUT /revenus/edit/{id} ── */
  const handleSave = async () => {
    if (!form.membreId || !form.type || !form.montant || !form.date) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSaving(true);
    // CUSTOM__xxx → backend: type=AUTRE, description=label du type custom
    const isCustom    = form.type?.startsWith('CUSTOM__');
    const customLabel = isCustom ? form.type.replace('CUSTOM__', '') : '';
    const backendType = isCustom ? 'AUTRE' : form.type;
    // Pour type custom : description = label (ex: "Cadeau"), sinon description libre
    const description = isCustom ? customLabel : form.desc;

    // Plus de periodicite côté backend : on envoie directement kind = FIXE | VARIABLE.
    const payload = {
      amount:         Number(form.montant),
      kind:           form.kind === 'VARIABLE' ? 'VARIABLE' : 'FIXE',
      perceptionDate: form.date,
      description,
      type:           backendType,
      membre:         { id: Number(form.membreId) },
      compte:         compteId ? { id: compteId } : undefined,
    };
    try {
      let res;
      if (editId) {
        res = await fetch(`${API}/revenus/edit/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API}/revenus/ajouter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error(await res.text());

      closeModal();
      await fetchAll();
    } catch (err) {
      alert('Erreur lors de l\'enregistrement : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => n === null || n === undefined ? '...'
    : Number(n).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const moisAn = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  /* ── Listes pour les selects de filtre ── */
  const MOIS_OPTIONS = [
    { value: '', label: 'Tous les mois' },
    { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },     { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },{ value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },{ value: '12', label: 'Décembre' },
  ];

  const ANNEE_OPTIONS = useMemo(() => {
    const yearsFromData = revenus
      .filter(r => r.rawDate)
      .map(r => new Date(r.rawDate).getFullYear())
      .filter(y => !isNaN(y));

    const currentYear = now.getFullYear();
    const allYears = new Set([...yearsFromData, currentYear]);
    const sorted = Array.from(allYears).sort((a, b) => b - a); // décroissant

    return [
      { value: '', label: 'Toutes les années' },
      ...sorted.map(y => ({ value: String(y), label: String(y) })),
    ];
  }, [revenus]);

  const selectStyle = {
    borderRadius: '10px',
    borderColor: 'rgba(55,124,244,.25)',
    fontSize: '12px',
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
          background:linear-gradient(135deg,#377CF4 0%,#325DC1 55%,#2E3F8F 100%);
          border-radius:22px; position:relative; overflow:hidden;
          box-shadow:0 14px 42px rgba(55,124,244,.32);
        }
        .kpi-var-badge {
          background:rgba(255,255,255,.18); border-radius:20px; padding:3px 10px;
          font-size:11px; font-weight:700; backdrop-filter:blur(6px);
          display:inline-flex; align-items:center; gap:4px;
        }
        .kpi-var-badge.up   { background:rgba(34,197,94,.25); }
        .kpi-var-badge.down { background:rgba(239,68,68,.25); }

        .bdg { font-size:10px;font-weight:700;border-radius:10px;padding:3px 9px;letter-spacing:.2px;display:inline-block; }
        .bdg-mensuel  { background:rgba(55,124,244,.13); color:var(--clr-primary); }
        .bdg-annuel   { background:rgba(55,124,244,.13);  color:var(--clr-blue); }
        .bdg-ponctuel { background:rgba(249,115,22,.13); color:var(--clr-orange); }
        .bdg-salaire  { background:rgba(34,197,94,.13);  color:#16a34a; }
        .bdg-secon    { background:rgba(14,165,233,.13); color:var(--clr-teal); }
        .bdg-aide     { background:rgba(249,115,22,.13); color:var(--clr-orange); }
        .bdg-autre    { background:rgba(100,116,139,.13);color:var(--clr-slate); }
        .bdg-custom   { background:rgba(55,124,244,.13);color:var(--clr-primary); }

        .revenu-row { transition:background .18s ease; }
        .revenu-row:hover { background:rgba(55,124,244,.04)!important; }
        .th-sort { cursor:pointer;user-select:none;white-space:nowrap; }
        .th-sort:hover { color:var(--clr-primary); }

        .btn-action-edit   { color:var(--clr-primary); background:none; border:none; }
        .btn-action-delete { color:var(--clr-red);     background:none; border:none; }
        .btn-action-edit:hover   { background:rgba(55,124,244,.1); border-radius:8px; }
        .btn-action-delete:hover { background:rgba(239,68,68,.1);  border-radius:8px; }

        .av-initials { width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0; }

        .mob-card { border-radius:16px;border-left:3px solid var(--clr-primary);transition:transform .2s ease,box-shadow .2s ease; }
        .mob-card:hover { transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.09)!important; }
        .sec-label { display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:700; }

        .filtre-bar { background:rgba(55,124,244,.04); border:1px solid rgba(55,124,244,.12); border-radius:14px; padding:12px 14px; }

        /* ── Grille filtres responsive ── */
        .filtre-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          width: 100%;
        }
        .filtre-grid select {
          width: 100% !important;
          min-width: 0;
        }
        @media (max-width: 359px) {
          /* Très petits écrans : 2 cols mois+année / membre pleine largeur */
          .filtre-grid {
            grid-template-columns: 1fr 1fr;
          }
          .filtre-grid select:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width:767px) { .table-desktop{display:none!important} .cards-mobile{display:block!important} }
        @media (min-width:768px) { .table-desktop{display:block!important} .cards-mobile{display:none!important} }

        .adminuiux-content.has-sidebar { padding-top: 56px !important; }
        .adminuiux-sidebar { padding-top: 56px !important; top: 0 !important; }
        .adminuiux-sidebar-inner { height: 100% !important; overflow-y: auto !important; }
        .navbar.fixed-top { z-index: 1050 !important; backdrop-filter: blur(12px) !important; background-color: inherit !important; }

        .modal-backdrop-custom {
          position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1040;
          display:flex;align-items:center;justify-content:center;padding:16px;
        }
        .modal-box {
          background:#fff;border-radius:20px;width:100%;max-width:500px;
          max-height:90vh;overflow:visible;box-shadow:0 24px 60px rgba(0,0,0,.18);
          animation:fadeUp .3s ease both;
        }
        .modal-box-inner { max-height:calc(90vh - 80px);overflow-y:auto;overflow-x:visible; }
        .skeleton { background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
          background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:8px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <div className="main-container container" style={{ paddingTop: '12px', paddingBottom: '80px' }}>

        {/* ── Breadcrumb + Titre ── */}
        <div className="row gx-3 mb-2 anim">
          <div className="col-12">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h5 className="mb-0 fw-bold">💼 Gestion des Revenus</h5>
                <p className="text-secondary small mb-0">Suivez et gérez tous les revenus de votre famille</p>
              </div>
              {roleUtilisateur !== 'CONSULTANT' && (
              <button className="btn btn-theme btn-sm rounded-3 px-3" onClick={() => openModal()} disabled={loading}>
                <i className="bi bi-plus-lg me-1"></i> Ajouter un revenu
              </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Erreur globale ── */}
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
              {/* Titre famille */}
              <p className="text-white mb-3" style={{ opacity:1, fontSize:'16px', letterSpacing:'.3px', fontWeight:700, textAlign:'left' }}>
                {filtreMembre
                  ? <><i className="bi bi-person me-2"></i>Revenus de {(() => { const m = membres.find(mm => mm.id === Number(filtreMembre)); return m?.user ? `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() : `Membre #${filtreMembre}`; })()}</>
                  : <><i className="bi bi-people me-2"></i>Total revenu de toute la famille</>
                }
              </p>
              <div className="d-flex align-items-end justify-content-between flex-wrap gap-3">
                {/* Gauche : total du mois sélectionné */}
                <div style={{ flex:'1 1 auto' }}>
                  <p className="text-white mb-1" style={{ opacity:.72, fontSize:'11px', letterSpacing:'.8px', textTransform:'uppercase', fontWeight:600 }}>
                    <i className="bi bi-calendar3 me-1"></i>Revenus du mois · {moisAnLabel}
                  </p>
                  <h1 className="text-white fw-bold mb-2" style={{ fontSize:'clamp(2rem,5vw,2.8rem)', letterSpacing:'-1.5px', lineHeight:1 }}>
                    {loading ? '—' : fmt(totalMoisFiltré)}
                    <span style={{ fontSize:'1.1rem', opacity:.75, marginLeft:'6px' }}>DT</span>
                  </h1>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="kpi-var-badge">
                      <i className="bi bi-arrow-up-short" style={{ fontSize:'14px' }}></i>
                      {filtered.length} source{filtered.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Droite : total annuel */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p className="text-white mb-1" style={{ opacity:.6, fontSize:'10px', letterSpacing:'.6px', textTransform:'uppercase', fontWeight:600 }}>
                    <i className="bi bi-graph-up me-1"></i>Total {filtreAnnee || new Date().getFullYear()}
                  </p>
                  <p className="text-white fw-bold mb-0" style={{ fontSize:'clamp(1.1rem,3vw,1.5rem)', letterSpacing:'-0.5px', opacity:.92 }}>
                    {loading ? '—' : fmt(totalAnneeActuelle)}
                    <span style={{ fontSize:'0.75rem', opacity:.7, marginLeft:'5px' }}>DT / an</span>
                  </p>
                  <p className="text-white mb-0" style={{ fontSize:'10px', opacity:.55, marginTop:'2px' }}>
                    calculé sur {revenusAnnee.length} revenu{revenusAnnee.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI Cards : Revenus Fixes / Revenus Variables (alignées sur la page Charges) ── */}
        <div className="row gx-3 mb-4 anim anim-2">
          {/* Revenus Fixes */}
          <div className="col-6 mb-2">
            <div className="card adminuiux-card sum-card h-100" style={{ borderTop: '3px solid var(--clr-blue)', borderRadius:'18px', position:'relative', overflow:'hidden' }}>
              <div className="card-body p-3 d-flex flex-column justify-content-between" style={{ minHeight:'110px' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="sum-icon ic-blue" style={{ position:'relative' }}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                      style={{ width:'22px', height:'22px', color:'var(--clr-blue)' }}>
                      <rect x="4" y="11" width="16" height="11" rx="2.5" fill="var(--clr-blue)" fillOpacity=".18"/>
                      <rect x="4" y="11" width="16" height="11" rx="2.5" stroke="var(--clr-blue)" strokeWidth="1.8"/>
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="var(--clr-blue)" strokeWidth="1.8" strokeLinecap="round"/>
                      <circle cx="12" cy="16.5" r="1.4" fill="var(--clr-blue)"/>
                      <line x1="12" y1="17.9" x2="12" y2="19.5" stroke="var(--clr-blue)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'var(--clr-blue)', letterSpacing:'.2px' }}>Revenus Fixes</span>
                </div>
                <div>
                  <h4 className="fw-bold mb-0" style={{ fontSize:'clamp(1.2rem,3vw,1.6rem)', color:'#1e293b' }}>
                    {loading ? '—' : fmt(totalFixesMois)}
                    <span className="text-secondary ms-1" style={{ fontSize:'11px', fontWeight:400 }}>DT / mois</span>
                  </h4>
                  <div className="d-flex align-items-center justify-content-between mt-1">
                    <span className="text-secondary" style={{ fontSize:'10.5px' }}>
                      {revenusMoisCourant.filter(isFixe).length} poste{revenusMoisCourant.filter(isFixe).length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize:'10px', color:'var(--clr-blue)', fontWeight:600, background:'rgba(55,124,244,.10)', borderRadius:'8px', padding:'2px 7px' }}>
                      {loading ? '—' : fmt(totalFixesAnnuel)} DT / an
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Revenus Variables */}
          <div className="col-6 mb-2">
            <div className="card adminuiux-card sum-card h-100" style={{ borderTop: '3px solid var(--clr-orange)', borderRadius:'18px' }}>
              <div className="card-body p-3 d-flex flex-column justify-content-between" style={{ minHeight:'110px' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="sum-icon ic-orange"><i className="bi bi-arrow-left-right"></i></div>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'var(--clr-orange)', letterSpacing:'.2px' }}>Revenus Variables</span>
                </div>
                <div>
                  <h4 className="fw-bold mb-0" style={{ fontSize:'clamp(1.2rem,3vw,1.6rem)', color:'#1e293b' }}>
                    {loading ? '—' : fmt(totalVarsMois)}
                    <span className="text-secondary ms-1" style={{ fontSize:'11px', fontWeight:400 }}>DT / mois</span>
                  </h4>
                  <div className="d-flex align-items-center justify-content-between mt-1">
                    <span className="text-secondary" style={{ fontSize:'10.5px' }}>
                      {revenusMoisCourant.filter(isVariable).length} poste{revenusMoisCourant.filter(isVariable).length !== 1 ? 's' : ''}
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
            <p className="text-secondary mt-3 small">Chargement des revenus...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* ══════════ LISTE MOBILE (CARDS) ══════════ */}
            <div className="cards-mobile mb-4 anim anim-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <p className="sec-label mb-0"><i className="bi bi-list-ul text-theme-1 me-1"></i> Liste des revenus</p>
                <span className="bdg bdg-mensuel">{filtered.length} revenus</span>
              </div>

              {/* ── Filtres mois / année / membre (mobile) ── */}
              <div className="filtre-bar mb-3">
                <p className="mb-2 small fw-semibold text-secondary" style={{ fontSize:'11px', letterSpacing:'.3px', textTransform:'uppercase' }}>
                  <i className="bi bi-funnel me-1" style={{ color:'var(--clr-primary)' }}></i>Filtrer par
                </p>
                <div className="d-flex gap-2" style={{ flexWrap:'nowrap', overflow:'visible' }}>
                  <FilterSelect
                    value={filtreMois}
                    onChange={setFiltreMois}
                    placeholder="Mois"
                    options={MOIS_OPTIONS}
                  />
                  <FilterYearInput
                    value={filtreAnnee}
                    onChange={setFiltreAnnee}
                    placeholder="Année"
                  />
                  <FilterSelect
                    value={filtreMembre}
                    onChange={setFiltreMembre}
                    placeholder="Membres"
                    alignRight={true}
                    options={[
                      { value:'', label:'👥 Membres' },
                      ...membres.map(m => ({
                        value: String(m.id),
                        label: `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim() || `#${m.id}`,
                      })),
                    ]}
                  />
                </div>
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-4 text-secondary">
                  <i className="bi bi-calendar-x" style={{ fontSize:'1.5rem', opacity:.4 }}></i>
                  <p className="mt-2 mb-0 small">Aucun revenu pour cette période</p>
                </div>
              )}
              {filtered.map(r => (
                <div key={r.id} className="card adminuiux-card mob-card mb-3">
                  <div className="card-body p-3">
                    <div className="d-flex align-items-center gap-3">
                      {/* Avatar */}
                      <div className="av-initials flex-shrink-0" style={{ background: r.couleur, color: r.couleurText }}>{r.initiales}</div>

                      {/* Contenu principal */}
                      <div className="flex-grow-1" style={{ minWidth:0 }}>
                        {/* Ligne 1 : nom | montant + icônes */}
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <span className="fw-semibold text-truncate" style={{ fontSize:'13px' }}>{r.membre}</span>
                          <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            <span className="fw-bold text-success" style={{ fontSize:'14px' }}>+{r.montant.toLocaleString('fr-TN')} DT</span>
                          </div>
                        </div>
                        {/* Ligne 2 : badges + date */}
                        <div className="d-flex align-items-center justify-content-between gap-2 mt-1 flex-wrap">
                          <div className="d-flex gap-1 flex-wrap align-items-center">
                            <TypeBadge type={r.type} typeDisplay={r.typeDisplay} badgeType={r.badgeType} />
                            <PeriodeBadge periode={r.periode} />
                          </div>
                          <span className="text-secondary" style={{ fontSize:'10px', whiteSpace:'nowrap' }}>{r.date}</span>
                        </div>
                        {/* Ligne 3 : description si présente */}
                        {r.desc && <p className="text-secondary mb-0 mt-1 text-truncate" style={{ fontSize:'11px' }}>{r.desc}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ══════════ TABLE DESKTOP ══════════ */}
            <div className="table-desktop mb-5 anim anim-4">
              <div className="card adminuiux-card">
                <div className="card-body p-0">
                  {/* En-tête : titre + compteur */}
                  <div className="d-flex align-items-center justify-content-between p-3 pb-0">
                    <p className="sec-label mb-0">
                      <i className="bi bi-table text-theme-1 me-1"></i> Liste des revenus
                      <span className="bdg bdg-mensuel ms-2">{filtered.length} revenus</span>
                    </p>
                    <span style={{ fontSize:'11px', color:'var(--clr-primary)', fontWeight:600 }}>
                      <i className="bi bi-funnel me-1"></i>Filtrer
                    </span>
                  </div>
                  {/* Filtres desktop */}
                  <div className="px-3 pt-2 pb-2">
                    <div className="d-flex gap-2" style={{ flexWrap:'nowrap', overflow:'visible' }}>
                      <FilterSelect
                        value={filtreMois}
                        onChange={setFiltreMois}
                        placeholder="Mois"
                        options={MOIS_OPTIONS}
                      />
                      <FilterYearInput
                        value={filtreAnnee}
                        onChange={setFiltreAnnee}
                        placeholder="Année"
                      />
                      <FilterSelect
                        value={filtreMembre}
                        onChange={setFiltreMembre}
                        placeholder="Membres"
                        alignRight={true}
                        options={[
                          { value:'', label:'👥 Tous les membres' },
                          ...membres.map(m => ({
                            value: String(m.id),
                            label: `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim() || `Membre ${m.id}`,
                          })),
                        ]}
                      />
                    </div>
                  </div>

                  <div className="table-responsive mt-2">
                    <table className="table table-hover mb-0">
                      <thead>
                        <tr style={{ borderBottom:'2px solid rgba(0,0,0,.06)' }}>
                          <th className="ps-3 th-sort" onClick={() => handleSort('membre')} style={{ fontSize:'12px', fontWeight:700 }}>
                            Membre {sortIcon('membre')}
                          </th>
                          <th className="th-sort" onClick={() => handleSort('type')} style={{ fontSize:'12px', fontWeight:700 }}>
                            Catégorie {sortIcon('type')}
                          </th>
                          {/* Type = Fixe / Variable (anciennement appelé "Périodicité" — renommé pour
                              s'aligner avec le web et la suppression définitive de "periodicite"). */}
                          <th style={{ fontSize:'12px', fontWeight:700 }}>Type</th>
                          <th className="th-sort" onClick={() => handleSort('montant')} style={{ fontSize:'12px', fontWeight:700 }}>
                            Montant {sortIcon('montant')}
                          </th>
                          <th className="th-sort" onClick={() => handleSort('rawDate')} style={{ fontSize:'12px', fontWeight:700 }}>
                            Date {sortIcon('rawDate')}
                          </th>
                          <th style={{ fontSize:'12px', fontWeight:700 }}>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 && (
                          <tr><td colSpan="6" className="text-center py-4 text-secondary">
                            <i className="bi bi-calendar-x" style={{ fontSize:'1.5rem', opacity:.4 }}></i>
                            <p className="mt-2 mb-0 small">Aucun revenu pour cette période</p>
                          </td></tr>
                        )}
                        {filtered.map(r => {
                          const membreObj = membres.find(m => m.id === r.membreId);
                          const photoUrl  = getProfilePhoto(membreObj) || null;
                          return (
                          <tr key={r.id} className="revenu-row" style={{ verticalAlign:'middle' }}>
                            <td className="ps-3" style={{ verticalAlign:'middle' }}>
                              <div className="d-flex align-items-center gap-2">
                                <MemberAvatar
                                  photoUrl={photoUrl}
                                  initiales={r.initiales}
                                  couleur={r.couleur}
                                  couleurText={r.couleurText}
                                />
                                <span className="small fw-semibold">{r.membre}</span>
                              </div>
                            </td>
                            {/* Catégorie : libellé du type (ex: Salaire, Loyer…). Le badge "TypeBadge"
                                d'origine reflète en fait la CATÉGORIE, d'où le renommage de la colonne. */}
                            <td style={{ verticalAlign:'middle' }}><TypeBadge type={r.type} typeDisplay={r.typeDisplay} badgeType={r.badgeType} /></td>
                            {/* Type : Fixe / Variable (ancien "Périodicité"). */}
                            <td style={{ verticalAlign:'middle' }}><PeriodeBadge periode={r.periode} /></td>
                            <td style={{ verticalAlign:'middle' }}><span className="fw-bold text-success">{r.montant.toLocaleString('fr-TN')} DT</span></td>
                            <td style={{ verticalAlign:'middle' }}><span className="small text-secondary">{r.date}</span></td>
                            <td style={{ verticalAlign:'middle' }}><span className="small text-secondary">{r.desc || '—'}</span></td>
                          </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background:'rgba(55,124,244,.04)', borderTop:'2px solid rgba(55,124,244,.12)' }}>
                          <td colSpan="3" className="ps-3 fw-bold small">Total des revenus filtrés</td>
                          <td><span className="fw-bold text-success">{totalFiltré.toLocaleString('fr-TN')} DT</span></td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </div>

      {/* ══════════ MODAL CONFIRMATION SUPPRESSION ══════════ */}
      {confirmDelete && (
        <ConfirmModal
          message="Êtes-vous sûr de vouloir supprimer ce revenu ? Cette action est irréversible."
          onConfirm={confirmerSuppression}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ══════════ MODAL AJOUTER / MODIFIER ══════════ */}
      {showModal && (
        <div className="modal-backdrop-custom" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>

            <div className="p-4 pb-2 border-bottom-0">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5 className="fw-bold mb-0">
                    <i className={`bi ${editId ? 'bi-pencil-square text-warning' : 'bi-plus-circle text-success'} me-2`}></i>
                    {editId ? 'Modifier le revenu' : 'Ajouter un revenu'}
                  </h5>
                  <p className="text-secondary small mb-0">Remplissez les informations du revenu</p>
                </div>
                <button className="btn btn-sm btn-link text-secondary" onClick={closeModal}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            <div className="modal-box-inner">
            <div className="p-4 pt-3">
              {/* Membre */}
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  <i className="bi bi-person me-1 text-theme-1"></i>Membre <span className="text-danger">*</span>
                </label>
                <CustomSelect
                  value={form.membreId}
                  onChange={val => setForm({...form, membreId: val})}
                  placeholder="— Sélectionner un membre —"
                  options={membres.map(m => ({
                    value: String(m.id),
                    label: `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim() || `Membre ${m.id}`,
                  }))}
                />
              </div>

              {/* Type (Fixe / Variable) + Catégorie sur la même ligne */}
              <div className="row gx-3 mb-3" style={{ overflow:'visible' }}>
                <div className="col-6">
                  <label className="form-label small fw-medium">
                    <i className="bi bi-tag me-1 text-theme-1"></i>Type <span className="text-danger">*</span>
                  </label>
                  <CustomSelect
                    value={form.kind}
                    onChange={val => setForm({ ...form, kind: val })}
                    options={[
                      { value: 'FIXE',     label: 'Revenu fixe' },
                      { value: 'VARIABLE', label: 'Revenu variable' },
                    ]}
                  />
                </div>
                <div className="col-6" style={{ overflow:'visible' }}>
                  <label className="form-label small fw-medium">
                    <i className="bi bi-grid-3x3-gap me-1 text-theme-1"></i>Catégorie <span className="text-danger">*</span>
                  </label>
                  <TypeSelectWithAdd
                    value={form.type}
                    onChange={val => setForm({ ...form, type: val })}
                    customTypes={customTypes}
                    onAddType={handleAddType}
                    onDeleteType={handleDeleteType}
                  />
                </div>
              </div>

              {/* Montant — pleine largeur */}
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  <i className="bi bi-cash me-1 text-theme-1"></i>Montant (DT) <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input type="number" className="form-control rounded-3" placeholder="" min="0"
                    value={form.montant} onChange={e => setForm({...form, montant: e.target.value})} />
                  <span className="input-group-text">DT</span>
                </div>
              </div>

              {/* Date de début — pleine largeur */}
              <div className="mb-3" style={{ overflow:'visible' }}>
                <label className="form-label small fw-medium">
                  <i className="bi bi-calendar3 me-1 text-theme-1"></i>Date de début <span className="text-danger">*</span>
                </label>
                <ModalDatePicker
                  value={form.date}
                  onChange={val => setForm({...form, date: val})}
                />
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  <i className="bi bi-chat-left-text me-1 text-theme-1"></i>Description
                </label>
                <textarea className="form-control rounded-3" rows="2" placeholder="Détails supplémentaires..."
                  value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
              </div>

              <p className="text-secondary" style={{ fontSize:'0.75rem' }}><span className="text-danger">*</span> Champs obligatoires</p>
            </div>
            </div>{/* /modal-box-inner */}

            <div className="px-4 pb-4 d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary rounded-3 px-4" onClick={closeModal} disabled={saving}>
                <i className="bi bi-x-lg me-1"></i>Annuler
              </button>
              <button className="btn btn-theme rounded-3 px-4" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Enregistrement...</>
                  : <><i className="bi bi-check-lg me-1"></i>Enregistrer</>}
              </button>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
}

export default RevenusListe;
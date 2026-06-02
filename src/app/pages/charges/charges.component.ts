// @ts-nocheck
import { Component, ViewEncapsulation, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ChargesService } from '../../core/services/charges.service';
import { SessionService } from '../../core/services/session.service';
import { Charge, ChargeType } from '../../core/models/charge.model';
import { ChargeModalComponent } from './charge-modal.component';

type FilterMode = 'all' | 'fixe' | 'variable';
type SortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type AllOrNum = number | 'all';
type AllOrStr = string | 'all';

@Component({
  selector: 'app-charges',
  standalone: true,
  imports: [CommonModule, FormsModule, ChargeModalComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './charges.component.html',
})
export class ChargesComponent implements OnInit {
  private readonly chargesApi = inject(ChargesService);
  private readonly session = inject(SessionService);

  // Data loaded from the backend.
  charges: Charge[] = [];
  loading = false;
  errorMsg = '';

  // UI state.
  search = '';
  // Tabs : "Toutes" / "Charges Fixes" / "Charges Variables". Démarre sur Toutes.
  filter: FilterMode = 'all';
  sort: SortMode = 'date-desc';

  // ─── Top-of-table filters (Mois / Année / Membre / Catégorie) ───────────
  selectedMonth: AllOrNum = 'all';
  // Année courante par défaut — l'utilisateur peut taper une autre année
  // ou vider l'input pour repasser à "Toutes années".
  selectedYear: AllOrNum = new Date().getFullYear();
  selectedMemberId: AllOrNum = 'all';
  selectedCategory: AllOrStr = 'all';
  monthOpen = false;
  yearOpen = false;
  memberOpen = false;
  categoryOpen = false;

  readonly months = [
    { value: 1, label: 'Janvier' },  { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },     { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },      { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },  { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },{ value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },{ value: 12, label: 'Décembre' },
  ];

  // Modal state.
  modalOpen = false;
  editingCharge: Charge | null = null;

  // Delete confirmation.
  confirmDeleteId: number | null = null;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMsg = '';
    this.chargesApi.list().subscribe({
      next: (list) => { this.charges = list || []; this.loading = false; },
      error: (err) => {
        console.error('[ChargesComponent] load failed', err);
        this.errorMsg = 'Chargement impossible. Vérifiez que le backend est démarré.';
        this.loading = false;
      },
    });
  }

  // ─── Derived values for KPIs / table ────────────────────────────────────
  // Totals reflect every charge in the list, regardless of date — so any
  // newly-added row (whatever chargeDate it carries) is immediately counted.
  private sum(list: Charge[]): number {
    return list.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  }

  get totalMois(): number { return this.sum(this.charges); }
  get totalFixesMois(): number {
    return this.sum(this.charges.filter((c) => c.type === 'FIXE'));
  }
  get totalVariablesMois(): number {
    return this.sum(this.charges.filter((c) => c.type === 'VARIABLE'));
  }
  get fixesPct(): number {
    return this.totalMois > 0 ? Math.round((this.totalFixesMois / this.totalMois) * 100) : 0;
  }
  get variablesPct(): number {
    return this.totalMois > 0 ? Math.round((this.totalVariablesMois / this.totalMois) * 100) : 0;
  }

  // ─── Hero KPI banner + sous-cartes Fixes/Variables (alignées sur la page
  //     Revenus). Mois et année cibles : filtres de la table si choisis,
  //     sinon mois/année courants. ─────────────────────────────────────────
  get targetMonth(): number {
    return this.selectedMonth === 'all' ? (new Date().getMonth() + 1) : (this.selectedMonth as number);
  }
  get targetYear(): number {
    return this.selectedYear === 'all' ? new Date().getFullYear() : (this.selectedYear as number);
  }

  private matchesTargetMember(c: Charge): boolean {
    return this.selectedMemberId === 'all' || c.membre?.id === this.selectedMemberId;
  }

  /** Charges du mois cible (filtre membre appliqué). Sert au "X DT" du
   *  hero, au compteur "0 charges" et aux totaux mois des sous-cartes. */
  get chargesMoisCourant(): Charge[] {
    const m = this.targetMonth;
    const y = this.targetYear;
    return this.charges.filter((c) => {
      if (!c.chargeDate) return false;
      const d = new Date(c.chargeDate);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getMonth() + 1 !== m || d.getFullYear() !== y) return false;
      return this.matchesTargetMember(c);
    });
  }

  /** Charges de l'année cible (filtre membre appliqué). Sert au "Total 2026"
   *  et aux pills "X DT / an" des sous-cartes. */
  get chargesAnneeCourante(): Charge[] {
    const y = this.targetYear;
    return this.charges.filter((c) => {
      if (!c.chargeDate) return false;
      const d = new Date(c.chargeDate);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getFullYear() !== y) return false;
      return this.matchesTargetMember(c);
    });
  }

  get totalMoisCourant(): number      { return this.sum(this.chargesMoisCourant); }
  get totalAnneeCourante(): number    { return this.sum(this.chargesAnneeCourante); }
  get nbChargesMois(): number         { return this.chargesMoisCourant.length; }
  get nbChargesAnnee(): number        { return this.chargesAnneeCourante.length; }

  // ─── Sous-cartes Fixes / Variables (mois + année cibles) ────────────────
  get totalFixesMoisDynamique(): number    { return this.sum(this.chargesMoisCourant.filter((c) => c.type === 'FIXE')); }
  get totalVarsMoisDynamique(): number     { return this.sum(this.chargesMoisCourant.filter((c) => c.type === 'VARIABLE')); }
  get totalFixesAnnuelDynamique(): number  { return this.sum(this.chargesAnneeCourante.filter((c) => c.type === 'FIXE')); }
  get totalVarsAnnuelDynamique(): number   { return this.sum(this.chargesAnneeCourante.filter((c) => c.type === 'VARIABLE')); }
  get nbFixesPostesMois(): number          { return this.chargesMoisCourant.filter((c) => c.type === 'FIXE').length; }
  get nbVarsPostesMois(): number           { return this.chargesMoisCourant.filter((c) => c.type === 'VARIABLE').length; }

  // ─── Labels affichés dans le hero ───────────────────────────────────────
  get moisLabel(): string {
    return this.months.find((m) => m.value === this.targetMonth)?.label ?? '';
  }
  get heroTitle(): string {
    if (this.selectedMemberId === 'all') return 'Total charge de toute la famille';
    const m = this.memberOptions.find((x) => x.id === this.selectedMemberId);
    return m ? `Charges de ${m.name}` : 'Charges';
  }

  get filteredCharges(): Charge[] {
    const q = this.search.trim().toLowerCase();
    return this.charges
      .filter((c) => {
        if (this.filter === 'fixe' && c.type !== 'FIXE') return false;
        if (this.filter === 'variable' && c.type !== 'VARIABLE') return false;
        if (!this.matchesDate(c)) return false;
        if (this.selectedMemberId !== 'all' && c.membre?.id !== this.selectedMemberId) return false;
        if (this.selectedCategory !== 'all' && (c.categorie?.name || '') !== this.selectedCategory) return false;
        if (q) {
          const haystack = [
            c.description ?? '',
            c.categorie?.name ?? '',
            c.membre?.user?.firstName ?? '',
            c.membre?.user?.lastName ?? '',
            String(c.amount ?? ''),
          ].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (this.sort) {
          case 'date-asc':   return (a.chargeDate || '').localeCompare(b.chargeDate || '');
          case 'date-desc':  return (b.chargeDate || '').localeCompare(a.chargeDate || '');
          case 'amount-asc': return (a.amount || 0) - (b.amount || 0);
          case 'amount-desc':return (b.amount || 0) - (a.amount || 0);
          default: return 0;
        }
      });
  }

  /** Keep the row when its chargeDate matches the picked (month, year). */
  private matchesDate(c: Charge): boolean {
    if (this.selectedMonth === 'all' && this.selectedYear === 'all') return true;
    if (!c.chargeDate) return false;
    const d = new Date(c.chargeDate);
    if (Number.isNaN(d.getTime())) return false;
    if (this.selectedMonth !== 'all' && d.getMonth() + 1 !== this.selectedMonth) return false;
    if (this.selectedYear !== 'all' && d.getFullYear() !== this.selectedYear) return false;
    return true;
  }

  /** Years actually present in the loaded charges, plus today's year. */
  get yearOptions(): number[] {
    const set = new Set<number>();
    for (const c of this.charges) {
      if (!c.chargeDate) continue;
      const d = new Date(c.chargeDate);
      if (!Number.isNaN(d.getTime())) set.add(d.getFullYear());
    }
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }

  /** Unique members extracted from the loaded charges. */
  get memberOptions(): { id: number; name: string }[] {
    const map = new Map<number, string>();
    for (const c of this.charges) {
      if (c.membre?.id == null) continue;
      const f = c.membre?.user?.firstName ?? '';
      const l = c.membre?.user?.lastName ?? '';
      const name = `${f} ${l}`.trim() || `Membre #${c.membre.id}`;
      map.set(c.membre.id, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Unique category names extracted from the loaded charges, with
   *  "Autre" always appended (matches the add-charge modal so the filter
   *  exposes it even before any "Autre" charge exists in the table). */
  get categoryOptions(): string[] {
    const set = new Set<string>();
    for (const c of this.charges) {
      const n = c.categorie?.name;
      if (n) set.add(n);
    }
    const out = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (!out.some((n) => n.toLowerCase() === 'autre')) out.push('Autre');
    return out;
  }

  monthDropdownLabel(m: AllOrNum): string {
    return m === 'all' ? 'Mois' : (this.months.find((x) => x.value === m)?.label ?? '—');
  }
  yearDropdownLabel(y: AllOrNum): string {
    return y === 'all' ? 'Année' : String(y);
  }
  memberDropdownLabel(id: AllOrNum): string {
    if (id === 'all') return 'Tous membres';
    return this.memberOptions.find((m) => m.id === id)?.name ?? 'Membre';
  }
  categoryDropdownLabel(c: AllOrStr): string {
    return c === 'all' ? 'Toutes catégories' : c;
  }

  // ─── Dropdown toggles ───────────────────────────────────────────────────
  toggleMonthMenu(ev: Event): void {
    ev.stopPropagation();
    const wasOpen = this.monthOpen;
    this.closeAllMenus();
    this.monthOpen = !wasOpen;
  }
  toggleYearMenu(ev: Event): void {
    ev.stopPropagation();
    const wasOpen = this.yearOpen;
    this.closeAllMenus();
    this.yearOpen = !wasOpen;
  }
  toggleMemberMenu(ev: Event): void {
    ev.stopPropagation();
    const wasOpen = this.memberOpen;
    this.closeAllMenus();
    this.memberOpen = !wasOpen;
  }
  toggleCategoryMenu(ev: Event): void {
    ev.stopPropagation();
    const wasOpen = this.categoryOpen;
    this.closeAllMenus();
    this.categoryOpen = !wasOpen;
  }
  setMonth(m: AllOrNum, ev: Event): void {
    ev.stopPropagation();
    this.selectedMonth = m;
    this.monthOpen = false;
  }
  setYear(y: AllOrNum, ev: Event): void {
    ev.stopPropagation();
    this.selectedYear = y;
    this.yearOpen = false;
  }
  /** Saisie libre d'une année : valide les 4 chiffres puis applique le filtre.
   *  Une chaîne vide ou < 1900 / > 2999 → revient à "Toutes années". */
  setYearFromInput(value: string, ev: Event): void {
    ev.stopPropagation();
    const trimmed = (value ?? '').trim();
    if (!trimmed) { this.selectedYear = 'all'; return; }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1900 || n > 2999) return;
    this.selectedYear = n;
  }
  /** Valeur affichée dans l'input année (vide quand "Toutes années"). */
  get yearInputValue(): string {
    return this.selectedYear === 'all' ? '' : String(this.selectedYear);
  }
  setMemberFilter(id: AllOrNum, ev: Event): void {
    ev.stopPropagation();
    this.selectedMemberId = id;
    this.memberOpen = false;
  }
  setCategoryFilter(c: AllOrStr, ev: Event): void {
    ev.stopPropagation();
    this.selectedCategory = c;
    this.categoryOpen = false;
  }
  @HostListener('document:click') onDocClick(): void {
    this.closeAllMenus();
  }
  private closeAllMenus(): void {
    this.monthOpen = false;
    this.yearOpen = false;
    this.memberOpen = false;
    this.categoryOpen = false;
  }

  memberName(c: Charge): string {
    const f = c.membre?.user?.firstName ?? '';
    const l = c.membre?.user?.lastName ?? '';
    const both = `${f} ${l}`.trim();
    return both || (c.membre?.id != null ? `Membre #${c.membre.id}` : '—');
  }

  memberInitials(c: Charge): string {
    const f = (c.membre?.user?.firstName ?? '').charAt(0);
    const l = (c.membre?.user?.lastName ?? '').charAt(0);
    return (f + l).toUpperCase() || '?';
  }

  /**
   * Returns the uploaded avatar data URL for this charge's member, or null
   * if we don't have one. Today the only avatar we know about is the one
   * the logged-in user uploaded to their own session — so we match by
   * userId. Other family members fall back to initials.
   */
  memberAvatar(c: Charge): string | null {
    const currentUserId = this.session.snapshot?.userId;
    const chargeUserId = c.membre?.user?.id;
    if (!currentUserId || !chargeUserId) return null;
    if (currentUserId !== chargeUserId) return null;
    return this.session.snapshot?.avatarDataUrl ?? null;
  }

  typeLabel(type: ChargeType): string {
    return type === 'FIXE' ? 'Fixe' : 'Variable';
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ─── Permissions ────────────────────────────────────────────────────────
  /** Le CONSULTANT n'a aucun droit d'écriture (alignement mobile React).
   *  Un autre membre peut tout de même créer/modifier des charges/factures/
   *  revenus AU NOM d'un consultant via le select Membre du modal. */
  get isConsultant(): boolean {
    return this.session.snapshot?.role === 'CONSULTANT';
  }
  get canEdit(): boolean { return !this.isConsultant; }

  // ─── Actions ────────────────────────────────────────────────────────────
  openAddModal(): void {
    if (!this.canEdit) return;
    this.editingCharge = null;
    this.modalOpen = true;
  }

  openEditModal(c: Charge): void {
    if (!this.canEdit) return;
    this.editingCharge = c;
    this.modalOpen = true;
  }

  onSaved(): void {
    this.reload();
  }

  askDelete(c: Charge): void {
    if (!this.canEdit) return;
    this.confirmDeleteId = c.id;
  }

  cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  confirmDelete(): void {
    if (this.confirmDeleteId == null) return;
    const id = this.confirmDeleteId;
    this.confirmDeleteId = null;
    this.chargesApi.delete(id).subscribe({
      next: () => this.reload(),
      error: (err) => {
        console.error('[ChargesComponent] delete failed', err);
        this.errorMsg = 'Suppression impossible. Réessayez.';
      },
    });
  }

  setFilter(mode: FilterMode): void { this.filter = mode; }
  setSort(value: SortMode): void { this.sort = value; }
}

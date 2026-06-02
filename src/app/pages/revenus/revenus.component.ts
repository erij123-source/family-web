// @ts-nocheck
import { Component, ViewEncapsulation, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RevenusService } from '../../core/services/revenus.service';
import { SessionService } from '../../core/services/session.service';
import { RevenuDTO } from '../../core/models/revenu.model';
import { RevenuModalComponent } from './revenu-modal.component';

type SortMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type KindFilter = 'all' | 'FIXE' | 'VARIABLE';
type AllOrNum = number | 'all';

@Component({
  selector: 'app-revenus',
  standalone: true,
  imports: [CommonModule, FormsModule, RevenuModalComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './revenus.component.html',
})
export class RevenusComponent implements OnInit {
  private readonly revenusApi = inject(RevenusService);
  private readonly session = inject(SessionService);

  revenus: RevenuDTO[] = [];
  loading = false;
  errorMsg = '';

  search = '';
  sort: SortMode = 'date-desc';
  kindFilter: KindFilter = 'all';

  // ─── Top-of-table filters (Mois / Année / Membre) ───────────────────────
  selectedMonth: AllOrNum = 'all';
  // Année courante par défaut — modifiable en tapant dans le pill input.
  selectedYear: AllOrNum = new Date().getFullYear();
  selectedMemberId: AllOrNum = 'all';
  monthOpen = false;
  yearOpen = false;
  memberOpen = false;

  readonly months = [
    { value: 1, label: 'Janvier' },  { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },     { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },      { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },  { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },{ value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },{ value: 12, label: 'Décembre' },
  ];

  modalOpen = false;
  editingRevenu: RevenuDTO | null = null;

  confirmDeleteId: number | null = null;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMsg = '';
    this.revenusApi.list().subscribe({
      next: (list) => { this.revenus = list || []; this.loading = false; },
      error: (err) => {
        console.error('[RevenusComponent] load failed', err);
        this.errorMsg = 'Chargement impossible. Vérifiez que le backend est démarré.';
        this.loading = false;
      },
    });
  }

  // ─── Derived KPIs (no date filter — same behaviour as Charges) ──────────
  private sum(list: RevenuDTO[]): number {
    return list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }
  get totalMensuel(): number { return this.sum(this.revenus); }
  get totalFixes(): number {
    return this.sum(this.revenus.filter((r) => r.kind !== 'VARIABLE'));
  }
  get totalVariables(): number {
    return this.sum(this.revenus.filter((r) => r.kind === 'VARIABLE'));
  }
  get fixesPct(): number {
    return this.totalMensuel > 0 ? Math.round((this.totalFixes / this.totalMensuel) * 100) : 0;
  }
  get variablesPct(): number {
    return this.totalMensuel > 0 ? Math.round((this.totalVariables / this.totalMensuel) * 100) : 0;
  }

  // ─── Hero KPI banner (mois courant / année courante, optionnellement filtré
  //     par membre) ─────────────────────────────────────────────────────────
  /** Mois et année cibles : filtres si choisis, sinon mois/année courants. */
  get targetMonth(): number {
    return this.selectedMonth === 'all' ? (new Date().getMonth() + 1) : (this.selectedMonth as number);
  }
  get targetYear(): number {
    return this.selectedYear === 'all' ? new Date().getFullYear() : (this.selectedYear as number);
  }

  private matchesTargetMember(r: RevenuDTO): boolean {
    return this.selectedMemberId === 'all' || r.membreId === this.selectedMemberId;
  }

  /** Revenus du mois cible (filtre membre appliqué — même comportement que la
   *  page React mobile). Utilisé pour les chiffres `… DT / mois` du banner. */
  get revenusMoisCourant(): RevenuDTO[] {
    const m = this.targetMonth;
    const y = this.targetYear;
    return this.revenus.filter((r) => {
      if (!r.perceptionDate) return false;
      const d = new Date(r.perceptionDate);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getMonth() + 1 !== m || d.getFullYear() !== y) return false;
      return this.matchesTargetMember(r);
    });
  }

  /** Revenus de l'année cible (filtre membre appliqué) — sert au "Total 2026"
   *  et aux pills "X DT / an" des deux cartes Fixes / Variables. */
  get revenusAnneeCourante(): RevenuDTO[] {
    const y = this.targetYear;
    return this.revenus.filter((r) => {
      if (!r.perceptionDate) return false;
      const d = new Date(r.perceptionDate);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getFullYear() !== y) return false;
      return this.matchesTargetMember(r);
    });
  }

  get totalMoisCourant(): number { return this.sum(this.revenusMoisCourant); }
  get totalAnneeCourante(): number { return this.sum(this.revenusAnneeCourante); }
  get nbSourcesMois(): number { return this.revenusMoisCourant.length; }
  get nbSourcesAnnee(): number { return this.revenusAnneeCourante.length; }

  // ─── Cartes Fixes / Variables (mois + année cibles) ─────────────────────
  get totalFixesMois(): number     { return this.sum(this.revenusMoisCourant.filter((r) => r.kind !== 'VARIABLE')); }
  get totalVarsMois(): number      { return this.sum(this.revenusMoisCourant.filter((r) => r.kind === 'VARIABLE')); }
  get totalFixesAnnuel(): number   { return this.sum(this.revenusAnneeCourante.filter((r) => r.kind !== 'VARIABLE')); }
  get totalVarsAnnuel(): number    { return this.sum(this.revenusAnneeCourante.filter((r) => r.kind === 'VARIABLE')); }
  get nbFixesPostesMois(): number  { return this.revenusMoisCourant.filter((r) => r.kind !== 'VARIABLE').length; }
  get nbVarsPostesMois(): number   { return this.revenusMoisCourant.filter((r) => r.kind === 'VARIABLE').length; }

  // ─── Labels affichés dans le hero ───────────────────────────────────────
  get moisLabel(): string {
    return this.months.find((m) => m.value === this.targetMonth)?.label ?? '';
  }
  /** "Total revenu de toute la famille" ou "Revenus de Prénom Nom" si filtré. */
  get heroTitle(): string {
    if (this.selectedMemberId === 'all') return 'Total revenu de toute la famille';
    const m = this.memberOptions.find((x) => x.id === this.selectedMemberId);
    return m ? `Revenus de ${m.name}` : 'Revenus';
  }

  // ─── Table derivations ───────────────────────────────────────────────────
  private matchesKind(r: RevenuDTO): boolean {
    if (this.kindFilter === 'all') return true;
    const isVariable = r.kind === 'VARIABLE';
    return this.kindFilter === 'VARIABLE' ? isVariable : !isVariable;
  }
  setKindFilter(v: KindFilter): void { this.kindFilter = v; }

  get filteredRevenus(): RevenuDTO[] {
    const q = this.search.trim().toLowerCase();
    return this.revenus
      .filter((r) => {
        if (!this.matchesKind(r)) return false;
        if (!this.matchesDate(r)) return false;
        if (this.selectedMemberId !== 'all' && r.membreId !== this.selectedMemberId) return false;
        if (!q) return true;
        const haystack = [
          r.description ?? '',
          r.categorieName ?? '',
          r.membrePrenom ?? '',
          r.membreNom ?? '',
          String(r.amount ?? ''),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        switch (this.sort) {
          case 'date-asc':    return (a.perceptionDate || '').localeCompare(b.perceptionDate || '');
          case 'date-desc':   return (b.perceptionDate || '').localeCompare(a.perceptionDate || '');
          case 'amount-asc':  return (a.amount || 0) - (b.amount || 0);
          case 'amount-desc': return (b.amount || 0) - (a.amount || 0);
          default: return 0;
        }
      });
  }

  /** Date filter — keep the row when its perceptionDate matches the
   *  selected month/year (either side may be 'all' to skip that part). */
  private matchesDate(r: RevenuDTO): boolean {
    if (this.selectedMonth === 'all' && this.selectedYear === 'all') return true;
    if (!r.perceptionDate) return false;
    const d = new Date(r.perceptionDate);
    if (Number.isNaN(d.getTime())) return false;
    if (this.selectedMonth !== 'all' && d.getMonth() + 1 !== this.selectedMonth) return false;
    if (this.selectedYear !== 'all' && d.getFullYear() !== this.selectedYear) return false;
    return true;
  }

  /** Years actually present in the data, plus the current year so the
   *  user can still pick the active year even before any entry exists. */
  get yearOptions(): number[] {
    const set = new Set<number>();
    for (const r of this.revenus) {
      if (!r.perceptionDate) continue;
      const d = new Date(r.perceptionDate);
      if (!Number.isNaN(d.getTime())) set.add(d.getFullYear());
    }
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }

  /** Unique members extracted from the revenus list (the page doesn't
   *  fetch the full membre roster, so we reuse what's embedded in the
   *  DTOs — enough for the "filter by member" dropdown). */
  get memberOptions(): { id: number; name: string }[] {
    const map = new Map<number, string>();
    for (const r of this.revenus) {
      if (r.membreId == null) continue;
      const name = `${r.membrePrenom ?? ''} ${r.membreNom ?? ''}`.trim() || `Membre #${r.membreId}`;
      map.set(r.membreId, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  monthDropdownLabel(m: AllOrNum): string {
    return m === 'all' ? 'Mois' : (this.months.find((x) => x.value === m)?.label ?? '—');
  }
  yearDropdownLabel(y: AllOrNum): string {
    return y === 'all' ? 'Année' : String(y);
  }
  memberDropdownLabel(id: AllOrNum): string {
    if (id === 'all') return 'Membres';
    return this.memberOptions.find((m) => m.id === id)?.name ?? 'Membre';
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
  /** Saisie libre d'une année (1900-2999). Vide → "Toutes années". */
  setYearFromInput(value: string, ev: Event): void {
    ev.stopPropagation();
    const trimmed = (value ?? '').trim();
    if (!trimmed) { this.selectedYear = 'all'; return; }
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1900 || n > 2999) return;
    this.selectedYear = n;
  }
  get yearInputValue(): string {
    return this.selectedYear === 'all' ? '' : String(this.selectedYear);
  }
  setMemberFilter(id: AllOrNum, ev: Event): void {
    ev.stopPropagation();
    this.selectedMemberId = id;
    this.memberOpen = false;
  }
  @HostListener('document:click') onDocClick(): void {
    this.closeAllMenus();
  }
  private closeAllMenus(): void {
    this.monthOpen = false;
    this.yearOpen = false;
    this.memberOpen = false;
  }

  memberName(r: RevenuDTO): string {
    const both = `${r.membrePrenom ?? ''} ${r.membreNom ?? ''}`.trim();
    return both || `Membre #${r.membreId}`;
  }
  memberInitials(r: RevenuDTO): string {
    const f = (r.membrePrenom ?? '').charAt(0);
    const l = (r.membreNom ?? '').charAt(0);
    return (f + l).toUpperCase() || '?';
  }
  /** Session's uploaded avatar, shown only when the revenu belongs to the logged-in user. */
  memberAvatar(r: RevenuDTO): string | null {
    // We don't have userId on the DTO — fall back to matching names.
    const s = this.session.snapshot;
    if (!s?.avatarDataUrl) return null;
    const match = (r.membrePrenom ?? '').toLowerCase() === (s.firstName ?? '').toLowerCase()
               && (r.membreNom ?? '').toLowerCase() === (s.lastName ?? '').toLowerCase();
    return match ? s.avatarDataUrl : null;
  }

  /** Fixe / Variable — basé sur le champ kind directement. */
  kindLabel(r: RevenuDTO): 'Fixe' | 'Variable' {
    return r.kind === 'VARIABLE' ? 'Variable' : 'Fixe';
  }
  isFixe(r: RevenuDTO): boolean {
    return r.kind !== 'VARIABLE';
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ─── Permissions ─────────────────────────────────────────────────────────
  /** Le CONSULTANT n'a aucun droit d'écriture (alignement mobile React).
   *  Un autre membre peut tout de même créer/modifier des revenus AU NOM
   *  d'un consultant via le select Membre du modal. */
  get isConsultant(): boolean {
    return this.session.snapshot?.role === 'CONSULTANT';
  }
  get canEdit(): boolean { return !this.isConsultant; }

  // ─── Actions ─────────────────────────────────────────────────────────────
  openAddModal(): void {
    if (!this.canEdit) return;
    this.editingRevenu = null;
    this.modalOpen = true;
  }
  openEditModal(r: RevenuDTO): void {
    if (!this.canEdit) return;
    this.editingRevenu = r;
    this.modalOpen = true;
  }
  onSaved(): void { this.reload(); }

  askDelete(r: RevenuDTO): void { if (!this.canEdit) return; this.confirmDeleteId = r.id; }
  cancelDelete(): void { this.confirmDeleteId = null; }
  confirmDelete(): void {
    if (this.confirmDeleteId == null) return;
    const id = this.confirmDeleteId;
    this.confirmDeleteId = null;
    this.revenusApi.delete(id).subscribe({
      next: () => this.reload(),
      error: (err) => {
        console.error('[RevenusComponent] delete failed', err);
        this.errorMsg = 'Suppression impossible. Réessayez.';
      },
    });
  }

  setSort(v: SortMode): void { this.sort = v; }
}

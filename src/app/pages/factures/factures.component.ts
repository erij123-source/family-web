import {
  Component,
  HostListener,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { of } from 'rxjs';

import { FacturesService } from '../../core/services/factures.service';
import { BudgetService, BUDGET_EXCEEDED_MSG } from '../../core/services/budget.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { SessionService } from '../../core/services/session.service';
import { Facture, FactureStatut } from '../../core/models/facture.model';
import { Membre } from '../../core/models/membre.model';
import { environment } from '../../../environments/environment';

// Frontend-friendly label for the statut (backend = PAYEE/NON_PAYEE/EN_RETARD).
type UIStatus = 'payee' | 'attente' | 'retard';
type UIType = 'fixe' | 'variable';

type StatusFilter = 'all' | UIStatus;
type SortMode = 'status' | 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type AllOrNum = number | 'all';
type AllOrStr = string | 'all';

type Toast = { show: boolean; type: 'success' | 'danger' | 'warning' | 'info'; msg: string };

// Preset categories available in the "Catégorie" select. Missing ones get
// created on the fly via FacturesService.ensureCategoryByName.
interface CatPreset { key: string; label: string; icon: string; color: string; }
const CAT_PRESETS: CatPreset[] = [
  { key: 'electricite',  label: 'Électricité',  icon: 'bolt',              color: 'linear-gradient(135deg,#d97706,#f59e0b)' },
  { key: 'eau',          label: 'Eau',          icon: 'water_drop',        color: 'linear-gradient(135deg,#0891b2,#06b6d4)' },
  { key: 'internet',     label: 'Internet',     icon: 'wifi',              color: 'linear-gradient(135deg,#7c3aed,#a855f7)' },
  { key: 'loyer',        label: 'Loyer',        icon: 'home',              color: 'linear-gradient(135deg,#377CF4,#2E3F8F)' },
  { key: 'assurance',    label: 'Assurance',    icon: 'health_and_safety', color: 'linear-gradient(135deg,#059669,#10b981)' },
  { key: 'telephone',    label: 'Téléphone',    icon: 'phone_android',     color: 'linear-gradient(135deg,#db2777,#ec4899)' },
  { key: 'sante',        label: 'Santé',        icon: 'medication',        color: 'linear-gradient(135deg,#dc2626,#ef4444)' },
  { key: 'education',    label: 'Éducation',    icon: 'school',            color: 'linear-gradient(135deg,#377CF4,#2E3F8F)' },
  { key: 'alimentation', label: 'Alimentation', icon: 'shopping_cart',     color: 'linear-gradient(135deg,#16a34a,#22c55e)' },
  { key: 'transport',    label: 'Transport',    icon: 'local_gas_station', color: 'linear-gradient(135deg,#d97706,#f59e0b)' },
  { key: 'autre',        label: 'Autre',        icon: 'category',          color: 'linear-gradient(135deg,#475569,#64748b)' },
];

// Order used by the default "status" sort: retard first, then attente, then payee.
const STATUS_ORDER: Record<UIStatus, number> = { retard: 0, attente: 1, payee: 2 };

// Sentinel value emitted by the Catégorie <select> when the user picks
// "Autre" — surfaces a free-form input for a custom category name.
const AUTRE = 'Autre';

interface FactureDraft {
  title: string;
  amount: number | null;
  issueDate: string;
  dueDate: string;
  // Date réelle de paiement — saisie seulement quand statut = payee, sinon
  // ignorée. C'est elle qui détermine à quel mois la facture est imputée
  // pour le reste à vivre, pas issueDate.
  datePaiement: string;
  categoryName: string;        // preset label or "Autre"
  customCategoryName: string;  // only used when categoryName === AUTRE
  membreId: number | null;
  type: UIType;          // UI-only: persisted via category mapping
  statut: UIStatus;
  note: string;          // UI-only: backend has no note field on Facture
  // Fichier sélectionné : on garde le File brut (multipart) + métadonnées.
  // L'upload se fait dans un 2ᵉ appel à /factures/upload/{id} après la
  // création de la facture — évite d'envoyer un gros Base64 dans le JSON
  // (la colonne fileUrl en base est un simple VARCHAR(255)).
  file: File | null;
  fileName: string;
  /** URL persistée côté serveur (ex. /factures/files/xxx), affichée en mode
   *  édition même si l'utilisateur n'a pas resélectionné de fichier. */
  existingFileUrl: string;
}

@Component({
  selector: 'app-factures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './factures.component.html',
})
export class FacturesComponent implements OnInit {

  private readonly factService = inject(FacturesService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly notifSvc = inject(NotificationsService);
  private readonly session = inject(SessionService);

  /** Le CONSULTANT n'a aucun droit d'écriture (alignement mobile React).
   *  Un autre membre peut tout de même créer/modifier des factures AU NOM
   *  d'un consultant via le select Membre du modal. */
  get isConsultant(): boolean {
    return this.session.snapshot?.role === 'CONSULTANT';
  }
  get canEdit(): boolean { return !this.isConsultant; }

  readonly CAT_PRESETS = CAT_PRESETS;
  readonly catKeys = CAT_PRESETS.map((c) => c.key);
  readonly AUTRE = AUTRE;
  get isAutreSelected(): boolean { return this.draft.categoryName === AUTRE; }

  factures: Facture[] = [];
  membres: Membre[] = [];
  loading = false;
  errorMsg = '';

  // ── Toolbar state ────────────────────────────────────────────────
  search = '';
  statusFilter: StatusFilter = 'all';
  sort: SortMode = 'status';

  // ─── Top-of-table filters (Mois / Année / Membre / Catégorie) ───────────
  selectedMonth: AllOrNum = 'all';
  // Année courante par défaut — modifiable via le pill input.
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

  // ── Add / Edit modal ────────────────────────────────────────────
  modalOpen = false;
  editingId: number | null = null;
  saving = false;
  formError = '';
  draft: FactureDraft = this.emptyDraft();

  // ── Delete confirmation ────────────────────────────────────────
  deletingId: number | null = null;

  toast: Toast = { show: false, type: 'success', msg: '' };

  ngOnInit(): void {
    this.reload();
    this.factService.listMembres().subscribe((list) => (this.membres = list));
  }

  reload(): void {
    this.loading = true;
    this.errorMsg = '';
    this.factService.list().subscribe({
      next: (list) => { this.factures = list || []; this.loading = false; },
      error: (err) => {
        console.error('[FacturesComponent] load failed', err);
        this.errorMsg = 'Chargement impossible. Vérifiez que le backend est démarré.';
        this.loading = false;
      },
    });
  }

  // ── Statut mapping (backend enum ⇔ UI lowercase) ─────────────────
  uiStatus(s: FactureStatut | string | undefined): UIStatus {
    switch (s) {
      case 'PAYEE': return 'payee';
      case 'EN_RETARD': return 'retard';
      default: return 'attente';
    }
  }
  toBackendStatus(s: UIStatus): FactureStatut {
    switch (s) {
      case 'payee': return 'PAYEE';
      case 'retard': return 'EN_RETARD';
      default: return 'NON_PAYEE';
    }
  }

  // ── Derived KPIs ──────────────────────────────────────────────────────
  private sumBy(pred: (f: Facture) => boolean): number {
    return this.factures.filter(pred).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  }
  get total(): number { return this.factures.reduce((s, f) => s + (Number(f.amount) || 0), 0); }
  get totalPayees(): number { return this.sumBy((f) => this.uiStatus(f.statut) === 'payee'); }
  get totalAttente(): number { return this.sumBy((f) => this.uiStatus(f.statut) === 'attente'); }
  get totalRetard(): number { return this.sumBy((f) => this.uiStatus(f.statut) === 'retard'); }
  get countAll(): number { return this.factures.length; }
  get countPayees(): number { return this.factures.filter((f) => this.uiStatus(f.statut) === 'payee').length; }
  get countAttente(): number { return this.factures.filter((f) => this.uiStatus(f.statut) === 'attente').length; }
  get countRetard(): number { return this.factures.filter((f) => this.uiStatus(f.statut) === 'retard').length; }

  private pct(n: number): number {
    return this.total > 0 ? Math.round((n / this.total) * 100) : 0;
  }
  get pctPayees(): number  { return this.pct(this.totalPayees); }
  get pctAttente(): number { return this.pct(this.totalAttente); }
  get pctRetard(): number  { return this.pct(this.totalRetard); }

  // ─── Hero KPI banner + sous-cartes (alignées sur Revenus/Charges) ───────
  /** Mois et année cibles : filtres si choisis, sinon mois/année courants. */
  get targetMonth(): number {
    return this.selectedMonth === 'all' ? (new Date().getMonth() + 1) : (this.selectedMonth as number);
  }
  get targetYear(): number {
    return this.selectedYear === 'all' ? new Date().getFullYear() : (this.selectedYear as number);
  }
  private matchesTargetMember(f: Facture): boolean {
    return this.selectedMemberId === 'all' || f.membre?.id === this.selectedMemberId;
  }

  /** Factures du mois cible (basées sur issueDate, comme matchesDate). */
  get facturesMoisCourant(): Facture[] {
    const m = this.targetMonth;
    const y = this.targetYear;
    return this.factures.filter((f) => {
      if (!f.issueDate) return false;
      const d = new Date(f.issueDate);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getMonth() + 1 !== m || d.getFullYear() !== y) return false;
      return this.matchesTargetMember(f);
    });
  }
  /** Factures de l'année cible. */
  get facturesAnneeCourante(): Facture[] {
    const y = this.targetYear;
    return this.factures.filter((f) => {
      if (!f.issueDate) return false;
      const d = new Date(f.issueDate);
      if (Number.isNaN(d.getTime())) return false;
      if (d.getFullYear() !== y) return false;
      return this.matchesTargetMember(f);
    });
  }

  // Hero — totaux et compteurs des factures PAYÉES du mois / année cibles.
  get totalPayeesMoisCourant(): number {
    return this.facturesMoisCourant
      .filter((f) => this.uiStatus(f.statut) === 'payee')
      .reduce((s, f) => s + (Number(f.amount) || 0), 0);
  }
  get totalPayeesAnneeCourante(): number {
    return this.facturesAnneeCourante
      .filter((f) => this.uiStatus(f.statut) === 'payee')
      .reduce((s, f) => s + (Number(f.amount) || 0), 0);
  }
  get nbFacturesMois(): number       { return this.facturesMoisCourant.length; }
  get nbFacturesAnnee(): number      { return this.facturesAnneeCourante.length; }
  get nbEnAttenteMois(): number      { return this.facturesMoisCourant.filter((f) => this.uiStatus(f.statut) === 'attente').length; }
  get nbEnRetardMois(): number       { return this.facturesMoisCourant.filter((f) => this.uiStatus(f.statut) === 'retard').length; }
  get nbPayeesMois(): number         { return this.facturesMoisCourant.filter((f) => this.uiStatus(f.statut) === 'payee').length; }

  // Labels du hero
  get moisLabel(): string {
    return this.months.find((m) => m.value === this.targetMonth)?.label ?? '';
  }
  get heroTitle(): string {
    if (this.selectedMemberId === 'all') return 'Total des factures de toute la famille';
    const m = this.memberOptions.find((x) => x.id === this.selectedMemberId);
    return m ? `Factures de ${m.name}` : 'Factures';
  }

  // ── Category / type derivation from the stored Categorie ────────────
  /** Resolve the preset that matches the facture's stored category name.
   *  Falls back to the "autre" preset when the name isn't recognised. */
  categoryPreset(f: Facture): CatPreset {
    const name = (f.categorie?.name || '').toLowerCase();
    return CAT_PRESETS.find((p) => p.label.toLowerCase() === name)
      ?? CAT_PRESETS[CAT_PRESETS.length - 1];
  }
  categoryLabel(f: Facture): string { return f.categorie?.name || 'Autre'; }
  categoryIcon(f: Facture): string { return this.categoryPreset(f).icon; }
  categoryColor(f: Facture): string { return this.categoryPreset(f).color; }

  /** Type Fixe / Variable lu directement depuis le champ backend `facture.type`
   *  (persisté en BDD, indépendant de la catégorie). Fallback "variable" pour
   *  les factures créées avant l'ajout du champ. */
  typeOf(f: Facture): UIType { return f.type === 'FIXE' ? 'fixe' : 'variable'; }
  typeLabel(t: UIType): string { return t === 'fixe' ? 'Fixe' : 'Variable'; }

  // ── Filtering / sorting ────────────────────────────────────────
  setStatusFilter(f: StatusFilter): void { this.statusFilter = f; }
  setSort(s: SortMode): void { this.sort = s; }

  get filteredFactures(): Facture[] {
    const q = this.search.trim().toLowerCase();
    return this.factures
      .filter((f) => {
        if (this.statusFilter !== 'all' && this.uiStatus(f.statut) !== this.statusFilter) return false;
        if (!this.matchesDate(f)) return false;
        if (this.selectedMemberId !== 'all' && f.membre?.id !== this.selectedMemberId) return false;
        if (this.selectedCategory !== 'all' && this.categoryLabel(f) !== this.selectedCategory) return false;
        if (!q) return true;
        return (
          (f.title || '').toLowerCase().includes(q)
          || this.categoryLabel(f).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        switch (this.sort) {
          case 'status':
            return STATUS_ORDER[this.uiStatus(a.statut)] - STATUS_ORDER[this.uiStatus(b.statut)];
          case 'date-desc':   return (b.issueDate || '').localeCompare(a.issueDate || '');
          case 'date-asc':    return (a.issueDate || '').localeCompare(b.issueDate || '');
          case 'amount-desc': return b.amount - a.amount;
          case 'amount-asc':  return a.amount - b.amount;
          default: return 0;
        }
      });
  }

  /** Keep the row when its issueDate matches the picked (month, year). */
  private matchesDate(f: Facture): boolean {
    if (this.selectedMonth === 'all' && this.selectedYear === 'all') return true;
    if (!f.issueDate) return false;
    const d = new Date(f.issueDate);
    if (Number.isNaN(d.getTime())) return false;
    if (this.selectedMonth !== 'all' && d.getMonth() + 1 !== this.selectedMonth) return false;
    if (this.selectedYear !== 'all' && d.getFullYear() !== this.selectedYear) return false;
    return true;
  }

  /** Years actually present in the loaded factures, plus today's year. */
  get yearOptions(): number[] {
    const set = new Set<number>();
    for (const f of this.factures) {
      if (!f.issueDate) continue;
      const d = new Date(f.issueDate);
      if (!Number.isNaN(d.getTime())) set.add(d.getFullYear());
    }
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }

  /** Unique members extracted from the loaded factures. */
  get memberOptions(): { id: number; name: string }[] {
    const map = new Map<number, string>();
    for (const f of this.factures) {
      if (f.membre?.id == null) continue;
      const u: any = f.membre?.user;
      const name = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || `Membre #${f.membre.id}`;
      map.set(f.membre.id, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Unique category names extracted from the loaded factures, with
   *  "Autre" always appended so the filter exposes it even when no
   *  facture currently uses that category. */
  get categoryOptions(): string[] {
    const set = new Set<string>();
    for (const f of this.factures) {
      const n = f.categorie?.name;
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

  // ── Display helpers ─────────────────────────────────────────────
  statutLabel(s: UIStatus): string {
    switch (s) {
      case 'payee': return 'Payée';
      case 'attente': return 'En attente';
      case 'retard': return 'En retard';
    }
  }

  /** Resolve the member's full name for the "Membre" column. Falls back to
   *  the membre id when the user fields aren't loaded (rare — happens when
   *  the backend ships a stripped membre object). */
  memberName(f: Facture): string {
    const u: any = f?.membre?.user;
    const full = `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim();
    if (full) return full;
    return f?.membre?.id ? `Membre #${f.membre.id}` : '—';
  }
  memberInitials(f: Facture): string {
    const u: any = f?.membre?.user;
    const fi = (u?.firstName ?? '').charAt(0);
    const li = (u?.lastName  ?? '').charAt(0);
    return (fi + li).toUpperCase() || '?';
  }

  /** Construit l'URL absolue vers le fichier facture. Le backend stocke
   *  un chemin relatif (ex. "/factures/files/xxx") qu'on préfixe avec la
   *  base API pour que `<a href="…">` résolve correctement le téléchargement.
   *  Si le serveur a déjà donné une URL absolue (http…), on la garde telle quelle. */
  fileLink(url?: string): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const base = environment.apiBaseUrl.replace(/\/+$/, '');
    return base + (url.startsWith('/') ? url : '/' + url);
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Add / Edit ──────────────────────────────────────────────────
  openAddModal(): void {
    if (!this.canEdit) return;
    this.editingId = null;
    this.draft = this.emptyDraft();
    this.formError = '';
    this.modalOpen = true;
  }

  openEditModal(f: Facture): void {
    if (!this.canEdit) return;
    this.editingId = f.id;
    const existingName = f.categorie?.name ?? '';
    const isPreset = CAT_PRESETS.some(
      (p) => p.label.toLowerCase() === existingName.toLowerCase() && p.label !== AUTRE,
    );
    this.draft = {
      title: f.title,
      amount: f.amount,
      issueDate: (f.issueDate ?? '').slice(0, 10) || this.todayIso(),
      dueDate: (f.dueDate ?? '').slice(0, 10) || '',
      datePaiement: (f.datePaiement ?? '').slice(0, 10) || this.todayIso(),
      categoryName: isPreset ? existingName : (existingName ? AUTRE : ''),
      customCategoryName: isPreset ? '' : existingName,
      membreId: f.membre?.id ?? null,
      type: this.typeOf(f),
      statut: this.uiStatus(f.statut),
      note: '',
      file: null,
      fileName: f.fileName ?? '',
      existingFileUrl: f.fileUrl ?? '',
    };
    this.formError = '';
    this.modalOpen = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
  }

  get isEditing(): boolean { return this.editingId !== null; }

  saveFacture(): void {
    if (this.saving) return;
    this.formError = '';
    if (!this.draft.title.trim()) {
      this.formError = 'Le nom de la facture est obligatoire.';
      return;
    }
    if (this.draft.membreId == null) {
      this.formError = 'Sélectionnez un membre.';
      return;
    }
    if (!this.draft.categoryName) {
      this.formError = 'Sélectionnez une catégorie.';
      return;
    }
    if (this.isAutreSelected && !this.draft.customCategoryName.trim()) {
      this.formError = 'Précisez le nom de la catégorie.';
      return;
    }
    if (this.draft.amount == null || this.draft.amount <= 0) {
      this.formError = 'Le montant doit être supérieur à 0.';
      return;
    }
    if (!this.draft.issueDate) {
      this.formError = "La date d'émission est obligatoire.";
      return;
    }

    const effectiveCategoryName = this.isAutreSelected
      ? this.draft.customCategoryName.trim()
      : this.draft.categoryName;

    this.saving = true;
    // Budget guard — same rule used by Charges. Skip in edit mode so users
    // can still tweak an already-saved facture that pushed them past the cap.
    const guard$ = this.editingId != null
      ? of({ wouldExceed: () => false } as { wouldExceed: (n: number) => boolean })
      : this.budgetSvc.getStatus(this.draft.membreId!);
    guard$.subscribe((status) => {
      if (status.wouldExceed(this.draft.amount!)) {
        this.saving = false;
        this.formError = BUDGET_EXCEEDED_MSG;
        return;
      }
      this.factService.ensureCategoryByName(effectiveCategoryName).subscribe({
        next: (categorie) => this.persistFacture(categorie.id),
        error: (err) => {
          this.saving = false;
          this.formError = this.describeError(err, 'Création de la catégorie impossible.');
        },
      });
    });
  }

  private persistFacture(categorieId: number): void {
    // L'utilisateur ne saisit pas la datePaiement : règle métier "imputé
    // au mois courant". Quand statut = PAYEE on force aujourd'hui ; sinon
    // on laisse null (le backend renseignera la date au markAsPaid).
    // Le JSON ne porte plus fileUrl/fileName — le fichier est uploadé via
    // multipart dans un 2ᵉ appel (cf. uploadFileIfAny ci-dessous).
    const payload = {
      membre: { id: this.draft.membreId! },
      categorie: { id: categorieId },
      title: this.draft.title.trim(),
      amount: this.draft.amount!,
      issueDate: this.draft.issueDate,
      dueDate: this.draft.dueDate || undefined,
      datePaiement: this.draft.statut === 'payee' ? this.todayIso() : undefined,
      statut: this.toBackendStatus(this.draft.statut),
      // Type FIXE / VARIABLE saisi dans le modal — persisté côté backend.
      type: (this.draft.type === 'fixe' ? 'FIXE' : 'VARIABLE') as 'FIXE' | 'VARIABLE',
    } as const;

    const op$ = this.editingId != null
      ? this.factService.edit(this.editingId, payload)
      : this.factService.add(payload);

    op$.subscribe({
      next: (saved: any) => {
        const savedId = saved?.id ?? this.editingId;
        this.uploadFileIfAny(savedId).then(() => {
          this.saving = false;
          this.modalOpen = false;
          this.notifSvc.refreshFromOtherPage();
          this.showToast(
            this.editingId != null ? 'Facture modifiée avec succès' : 'Facture ajoutée avec succès',
            'success',
          );
          this.reload();
        }).catch((uploadErr) => {
          this.saving = false;
          this.modalOpen = false;
          console.error('[FacturesComponent] file upload failed', uploadErr);
          this.showToast('Facture enregistrée, mais l\'upload du fichier a échoué.', 'warning');
          this.reload();
        });
      },
      error: (err) => {
        this.saving = false;
        this.formError = this.describeError(err, 'Enregistrement impossible. Réessayez.');
      },
    });
  }

  /** Si l'utilisateur a sélectionné un nouveau fichier, on l'envoie en
   *  multipart à /factures/upload/{id}. Sinon résout immédiatement. */
  private uploadFileIfAny(factureId: number | null): Promise<void> {
    if (!factureId || !this.draft.file) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.factService.uploadFile(factureId, this.draft.file!).subscribe({
        next: () => resolve(),
        error: (e) => reject(e),
      });
    });
  }

  markPaid(f: Facture): void {
    if (!this.canEdit) return;
    this.factService.markAsPaid(f.id).subscribe({
      next: () => {
        // Marking a facture as paid may clear an "En retard" / "Échéance
        // dans Nj" alert generated earlier — re-scan to pick that up.
        this.notifSvc.refreshFromOtherPage();
        this.showToast('Facture marquée comme payée', 'success');
        this.reload();
      },
      error: (err) => {
        console.error('[FacturesComponent] markAsPaid failed', err);
        this.showToast('Opération impossible.', 'danger');
      },
    });
  }

  // ── Delete ──────────────────────────────────────────────────────
  askDelete(f: Facture): void { if (!this.canEdit) return; this.deletingId = f.id; }
  cancelDelete(): void { this.deletingId = null; }
  confirmDelete(): void {
    if (this.deletingId == null) return;
    const id = this.deletingId;
    this.deletingId = null;
    this.factService.delete(id).subscribe({
      next: () => {
        this.showToast('Facture supprimée', 'danger');
        this.reload();
      },
      error: (err) => {
        console.error('[FacturesComponent] delete failed', err);
        this.showToast('Suppression impossible.', 'danger');
      },
    });
  }

  deletingName(): string {
    const f = this.factures.find((x) => x.id === this.deletingId);
    return f?.title ?? 'Cette facture';
  }

  // ── Internals ───────────────────────────────────────────────────
  private todayIso(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  private emptyDraft(): FactureDraft {
    return {
      title: '',
      amount: null,
      issueDate: this.todayIso(),
      dueDate: '',
      datePaiement: this.todayIso(),
      // Pré-sélection du premier preset pour éviter le placeholder
      // "— Sélectionner —" peu professionnel dans le select.
      categoryName: CAT_PRESETS[0]?.label ?? '',
      customCategoryName: '',
      membreId: null,
      type: 'fixe',
      statut: 'attente',
      note: '',
      file: null,
      fileName: '',
      existingFileUrl: '',
    };
  }

  /** Handler du <input type="file"> : on garde l'objet File pour l'envoyer
   *  en multipart APRÈS création de la facture. Limite 5 Mo côté front. */
  onFileSelected(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      this.formError = 'Le fichier dépasse 5 Mo. Choisissez un fichier plus petit.';
      target.value = '';
      return;
    }
    this.draft.file = file;
    this.draft.fileName = file.name;
    this.formError = '';
  }
  removeAttachedFile(): void {
    this.draft.file = null;
    this.draft.fileName = '';
    this.draft.existingFileUrl = '';
  }

  private describeError(err: any, fallback: string): string {
    const status = err?.status;
    if (status === 0) return 'Serveur injoignable. Vérifiez que le backend est démarré.';
    const body = err?.error;
    const msg = typeof body === 'string' ? body : body?.message || body?.error || '';
    if (msg) return `Erreur (${status ?? '?'}) : ${msg}`;
    return fallback;
  }

  private showToast(msg: string, type: Toast['type'] = 'success'): void {
    this.toast = { show: true, type, msg };
    setTimeout(() => (this.toast = { ...this.toast, show: false }), 3000);
  }
}

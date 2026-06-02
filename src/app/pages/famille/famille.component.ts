import {
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { FamilleService, FamilleMemberVM } from '../../core/services/famille.service';
import { AuthService } from '../../core/services/auth.service';
import { SessionService } from '../../core/services/session.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { MembreRole } from '../../core/models/membre.model';

type RoleFilter = 'all' | 'ADMINISTRATEUR' | 'GESTIONNAIRE' | 'CONSULTANT';

type Toast = { show: boolean; type: 'success' | 'danger' | 'warning' | 'info'; msg: string };

interface MemberFormDraft {
  firstName: string;
  lastName: string;
  phone: string;       // without +216 prefix
  role: MembreRole;
  password: string;    // only used when adding
  username: string;    // auto-derived
  budget: number | null; // monthly budget — admin only
  photoUrl: string;    // URL persistée côté serveur (mode édition)
  photoPreview: string; // dataURL local pour aperçu après sélection
  photoFile: File | null; // nouveau fichier à uploader (null si inchangé)
}

@Component({
  selector: 'app-famille',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './famille.component.html',
})
export class FamilleComponent implements OnInit {
  private readonly famille = inject(FamilleService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly notifSvc = inject(NotificationsService);

  members: FamilleMemberVM[] = [];
  loading = false;

  /** Revenus de la famille pour le MOIS courant (repart de 0 chaque mois).
   *  Avec le report ci-dessous, forme le pool distribuable. Rechargé à chaque
   *  reload(). */
  totalRevenusFamille = 0;

  /** Report de revenu non distribué hérité du mois précédent (serveur). */
  revenuCarryover = 0;

  /** Budget restant glissant calculé côté serveur (report mois préc. +
   *  revenus du mois − budgets distribués ce mois). */
  budgetRestantBackend = 0;

  /** Pool réellement distribuable = revenus du mois + report du mois dernier.
   *  Sert de plafond à la distribution de budget. */
  get poolDistribuable(): number {
    return (this.revenuCarryover || 0) + (this.totalRevenusFamille || 0);
  }

  /** Somme des budgets de base saisis par l'admin pour chaque membre
   *  (hors report). C'est ce qui a déjà été "engagé" sur le plafond des
   *  revenus de la famille. */
  get totalBudgetDistribue(): number {
    return this.members.reduce((sum, m) => sum + (m.budget || 0), 0);
  }

  /** Budget restant = valeur serveur (report du mois précédent + revenus du
   *  mois − budgets distribués). Persiste d'un mois à l'autre via le report,
   *  contrairement au revenu affiché qui repart de 0. */
  get budgetRestant(): number {
    return Math.max(0, this.budgetRestantBackend || 0);
  }

  /** % du plafond déjà distribué (0-100). Utilisé pour la barre de
   *  progression de la carte récap en haut de page. */
  get pctDistribue(): number {
    if (this.poolDistribuable <= 0) return 0;
    return Math.min(
      100,
      Math.round((this.totalBudgetDistribue / this.poolDistribuable) * 100),
    );
  }

  /** Complément du précédent — affiché à côté du "Budget restant". */
  get pctRestant(): number {
    if (this.poolDistribuable <= 0) return 0;
    return Math.max(0, 100 - this.pctDistribue);
  }

  /** Reste à vivre courant du membre en cours d'édition (sera transféré
   *  en report par le backend lors de la sauvegarde). */
  get editingResteAVivre(): number {
    if (!this.isEditing || this.editingId == null) return 0;
    const m = this.members.find((x) => x.id === this.editingId);
    if (!m) return 0;
    const total = (m.budget || 0) + (m.carryover || 0);
    return Math.max(0, total - (m.spend || 0));
  }

  // ── Toolbar state ────────────────────────────────────────────────
  search = '';
  filter: RoleFilter = 'all';

  // ── Add / Edit modal ────────────────────────────────────────────
  modalOpen = false;
  editingId: number | null = null;       // Membre id
  editingUserId: number | null = null;   // User id
  saving = false;
  formError = '';

  draft: MemberFormDraft = this.emptyDraft();

  // ── OTP de vérification du téléphone du membre ──────────────────
  // Même flux que la page d'inscription (cf. register.component.ts) :
  // exigé en CREATE quand un téléphone est saisi ; non exigé en EDIT
  // (on garde le numéro déjà persisté en base).
  memberOtpRequested = false;
  memberOtpCode = '';
  memberPhoneVerified = false;
  memberOtpStatus: 'idle' | 'sending' | 'verifying' | 'sent' | 'verified' | 'error' = 'idle';
  memberOtpError = '';

  // ── Delete confirmation ─────────────────────────────────────────
  deletingId: number | null = null;
  deletingName = '';

  // ── Lightweight toast ───────────────────────────────────────────
  toast: Toast = { show: false, type: 'success', msg: '' };

  // ── Header / family name ────────────────────────────────────────
  get familleName(): string {
    return this.session.snapshot?.familleName?.trim() || 'Famille';
  }

  /** Only the family ADMINISTRATEUR can manage budgets (and reach this
   *  page — see the role guard on the route). */
  get isAdmin(): boolean {
    return this.session.snapshot?.role === 'ADMINISTRATEUR';
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.famille.listMembers().subscribe({
      next: (list) => { this.members = list; this.loading = false; },
      error: (err) => {
        console.error('[Famille] load failed', err);
        this.members = [];
        this.loading = false;
        this.showToast('Chargement des membres impossible.', 'danger');
      },
    });
    // Pool distribuable + budget restant — chargés en parallèle.
    // - revenus DU MOIS (repart de 0 chaque mois)
    // - report du mois précédent (revenu non distribué hérité)
    // - budget restant glissant calculé côté serveur
    this.famille.getRevenusMoisFamille().subscribe({
      next: (v) => { this.totalRevenusFamille = v || 0; },
      error: () => { this.totalRevenusFamille = 0; },
    });
    this.famille.getRevenuCarryoverFamille().subscribe({
      next: (v) => { this.revenuCarryover = v || 0; },
      error: () => { this.revenuCarryover = 0; },
    });
    this.famille.getBudgetRestantFamille().subscribe({
      next: (v) => { this.budgetRestantBackend = v || 0; },
      error: () => { this.budgetRestantBackend = 0; },
    });
  }

  // ── Filtering / search ──────────────────────────────────────────
  setFilter(f: RoleFilter): void { this.filter = f; }

  get visibleMembers(): FamilleMemberVM[] {
    const q = this.search.trim().toLowerCase();
    return this.members.filter((m) => {
      const matchesSearch = !q
        || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
        || m.phone.toLowerCase().includes(q);
      const matchesFilter = this.filter === 'all' || m.role === this.filter;
      return matchesSearch && matchesFilter;
    });
  }

  // ── Display helpers ─────────────────────────────────────────────
  initials(m: FamilleMemberVM): string {
    const f = (m.firstName || '').trim().charAt(0);
    const l = (m.lastName || '').trim().charAt(0);
    return (f + l).toUpperCase() || '?';
  }

  /** Deterministic gradient per member so two members don't share the same
   *  avatar colour — keyed on the user id. */
  avatarGradient(m: FamilleMemberVM): string {
    const palette = [
      'linear-gradient(135deg,#377CF4,#2E3F8F)',
      'linear-gradient(135deg,#dc2626,#ef4444)',
      'linear-gradient(135deg,#7c3aed,#a855f7)',
      'linear-gradient(135deg,#16a34a,#22c55e)',
      'linear-gradient(135deg,#d97706,#f59e0b)',
      'linear-gradient(135deg,#0891b2,#06b6d4)',
      'linear-gradient(135deg,#db2777,#ec4899)',
    ];
    const key = m.userId || m.id;
    return palette[Math.abs(key) % palette.length];
  }

  roleLabel(role: MembreRole): string {
    switch (role) {
      case 'ADMINISTRATEUR': return 'Administrateur';
      case 'GESTIONNAIRE':   return 'Gestionnaire';
      case 'CONSULTANT':     return 'Consultant';
      default: return role;
    }
  }

  roleClass(role: MembreRole): string {
    switch (role) {
      case 'ADMINISTRATEUR': return 'admin';
      case 'GESTIONNAIRE':   return 'gestionnaire';
      case 'CONSULTANT':     return 'consultant';
      default: return 'consultant';
    }
  }

  /** Budget total réel disponible = base + report transféré par l'admin
   *  lors de la dernière modification de budget. C'est la valeur utilisée
   *  comme dénominateur partout (progression, reste à vivre, total carte). */
  budgetTotal(m: FamilleMemberVM): number {
    return (m.budget || 0) + (m.carryover || 0);
  }

  /** % du budget TOTAL consommé. Capped à 100. */
  budgetPct(m: FamilleMemberVM): number {
    const total = this.budgetTotal(m);
    if (total <= 0) return 0;
    return Math.min(Math.round((m.spend / total) * 100), 100);
  }

  /** Reste à vivre = budget total − dépenses, ≥ 0. */
  remainingBudget(m: FamilleMemberVM): number {
    if (!m.budget || m.budget <= 0) return 0;
    return Math.max(0, this.budgetTotal(m) - (m.spend || 0));
  }

  progressColor(pct: number): string {
    if (pct >= 85) return '#ef4444';
    if (pct >= 60) return '#f59e0b';
    return '#22c55e';
  }

  // ── Add / Edit modal ────────────────────────────────────────────
  openAddModal(): void {
    this.editingId = null;
    this.editingUserId = null;
    this.draft = this.emptyDraft();
    this.formError = '';
    this.resetOtpState();
    this.modalOpen = true;
  }

  openEditModal(m: FamilleMemberVM): void {
    this.editingId = m.id;
    this.editingUserId = m.userId;
    this.draft = {
      firstName: m.firstName,
      lastName: m.lastName,
      phone: this.stripPhonePrefix(m.phone),
      role: m.role,
      password: '',
      username: `${m.firstName} ${m.lastName}`.trim().toLowerCase(),
      budget: m.budget || null,
      photoUrl: m.photo || '',
      photoPreview: m.photo || '',
      photoFile: null,
    };
    this.formError = '';
    // Edit mode : on considère le numéro déjà vérifié (il est en base).
    // Si l'utilisateur l'édite ensuite, onPhoneInput remettra à zéro l'état.
    this.memberPhoneVerified = !!this.draft.phone;
    this.memberOtpRequested = false;
    this.memberOtpCode = '';
    this.memberOtpStatus = this.memberPhoneVerified ? 'verified' : 'idle';
    this.memberOtpError = '';
    this.modalOpen = true;
  }

  /** Restreint le téléphone à 8 chiffres + reset l'état OTP si modifié. */
  onPhoneInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const cleaned = (input.value || '').replace(/\D/g, '').slice(0, 8);
    if (input.value !== cleaned) input.value = cleaned;
    this.draft.phone = cleaned;
    this.resetOtpState();
  }

  private resetOtpState(): void {
    this.memberOtpRequested = false;
    this.memberOtpCode = '';
    this.memberPhoneVerified = false;
    this.memberOtpStatus = 'idle';
    this.memberOtpError = '';
  }

  private get memberPhoneE164(): string {
    const digits = (this.draft.phone || '').replace(/\D/g, '');
    return digits ? `+216${digits}` : '';
  }

  sendMemberOtp(): void {
    const digits = (this.draft.phone || '').replace(/\D/g, '');
    if (digits.length !== 8) {
      this.memberOtpError = 'Numéro invalide.';
      return;
    }
    this.memberOtpError = '';
    this.memberOtpStatus = 'sending';
    this.auth.sendOtp(this.memberPhoneE164).subscribe({
      next: () => {
        this.memberOtpRequested = true;
        this.memberOtpStatus = 'sent';
      },
      error: () => {
        this.memberOtpStatus = 'error';
        this.memberOtpError = 'Envoi du code impossible. Réessayez.';
      },
    });
  }

  verifyMemberOtp(): void {
    if (!this.memberOtpCode.trim()) {
      this.memberOtpError = 'Entrez le code reçu par SMS.';
      return;
    }
    this.memberOtpStatus = 'verifying';
    this.memberOtpError = '';
    this.auth.verifyOtp(this.memberPhoneE164, this.memberOtpCode.trim()).subscribe({
      next: () => {
        this.memberPhoneVerified = true;
        this.memberOtpStatus = 'verified';
      },
      error: (err) => {
        this.memberOtpStatus = 'error';
        this.memberOtpError = err?.error?.message || 'Code incorrect.';
      },
    });
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
  }

  onNameChange(): void {
    const f = this.draft.firstName.trim().toLowerCase().replace(/\s+/g, '');
    const l = this.draft.lastName.trim().toLowerCase().replace(/\s+/g, '');
    this.draft.username = f && l ? `${f} ${l}` : f + l;
  }

  get isEditing(): boolean { return this.editingId !== null; }

  saveMember(): void {
    if (this.saving) return;
    this.formError = '';

    const first = this.draft.firstName.trim();
    const last = this.draft.lastName.trim();
    if (!first || !last) {
      this.formError = 'Prénom et nom sont obligatoires.';
      return;
    }

    // Phone is optional. If provided it must be a Tunisian 8-digit number.
    const digits = this.draft.phone.replace(/\D/g, '');
    if (digits && digits.length !== 8) {
      this.formError = 'Numéro invalide (8 chiffres requis).';
      return;
    }
    const phoneE164 = digits ? `+216${digits}` : '';

    if (this.isEditing) {
      this.persistEdit(first, last, phoneE164);
    } else {
      this.persistCreate(first, last, phoneE164);
    }
  }

  private persistCreate(firstName: string, lastName: string, phone: string): void {
    if (!this.draft.password) {
      this.formError = 'Le mot de passe est obligatoire.';
      return;
    }
    // Si un téléphone est saisi en CREATE, il doit être OTP-vérifié.
    // Aligne le flux interne sur l'inscription externe (register.component.ts)
    // et sur la 2ᵉ étape (register-step2.component.ts).
    if (phone && !this.memberPhoneVerified) {
      this.formError = 'Veuillez vérifier le numéro de téléphone avant d\'ajouter le membre.';
      return;
    }
    this.saving = true;
    this.auth.addMember({
      role: this.draft.role,
      user: {
        firstName,
        lastName,
        username: this.draft.username.trim(),
        password: this.draft.password,
        phone,
      },
    }).subscribe({
      next: () => {
        this.saving = false;
        this.modalOpen = false;
        this.showToast('Membre ajouté avec succès.', 'success');
        this.reload();
      },
      error: (err) => {
        this.saving = false;
        this.formError = this.describeError(err, 'Ajout du membre impossible.');
      },
    });
  }

  private persistEdit(firstName: string, lastName: string, phone: string): void {
    if (this.editingUserId == null || this.editingId == null) return;

    const original = this.members.find((x) => x.id === this.editingId);

    // ── OTP : si l'utilisateur a modifié le numéro de téléphone, il faut
    //    re-vérifier via SMS avant d'enregistrer. `onPhoneInput` remet
    //    déjà `memberPhoneVerified` à false dès qu'un caractère change ;
    //    on s'appuie sur ce flag.
    const originalDigits = (original?.phone || '').replace(/\D/g, '').replace(/^216/, '');
    const newDigits = (this.draft.phone || '').replace(/\D/g, '');
    const phoneChanged = originalDigits !== newDigits;
    if (phoneChanged && newDigits && !this.memberPhoneVerified) {
      this.formError = 'Veuillez vérifier le nouveau numéro de téléphone (OTP) avant d\'enregistrer.';
      return;
    }

    const roleChanged = original ? original.role !== this.draft.role : false;
    const enteredBudget = Math.max(0, Number(this.draft.budget) || 0);

    // Le reste à vivre (= original.budget − original.spend) est transféré
    // automatiquement par le BACKEND dans `carryoverBudget` lors du PUT
    // /membres/set-budget. Côté front on envoie uniquement la saisie ; le
    // backend stocke budget=saisie + carryoverBudget=reste, l'UI Dashboard
    // affichera ensuite "Budget total = saisie + carryover" et
    // "+ carryover DT report" en sous-pill.
    const budgetChanged = this.isAdmin && original
      ? Math.abs(original.budget - enteredBudget) > 0.0001
      : false;

    // ── Règles de validation budget (admin only) ────────────────────────
    // La somme des budgets saisis (hors reports) ne doit pas dépasser le
    // total des revenus encaissés par la famille.
    if (this.isAdmin && budgetChanged && original) {
      const otherBudgets = this.members
        .filter((m) => m.id !== this.editingId)
        .reduce((s, m) => s + (m.budget || 0), 0);
      const nextTotal = otherBudgets + enteredBudget;
      // Plafond = pool distribuable = revenus du mois + report du mois dernier
      // (aligné sur le backend setBudget, qui ajoute aussi le report).
      const pool = this.poolDistribuable;
      if (pool > 0 && nextTotal > pool + 0.0001) {
        const dispo = Math.max(0, pool - otherBudgets);
        this.formError =
          `Budget impossible : la somme des budgets dépasserait le budget disponible ` +
          `de la famille (${pool.toFixed(2)} DT, report inclus). ` +
          `Disponible pour ce membre : ${dispo.toFixed(2)} DT.`;
        return;
      }
    }

    this.saving = true;

    const profile$ = this.famille.updateUser(this.editingUserId, {
      firstName,
      lastName,
      phone: phone || undefined,
      username: this.draft.username.trim(),
    });

    profile$.subscribe({
      next: () => this.applyRoleThenBudget(roleChanged, budgetChanged, enteredBudget),
      error: (err) => {
        this.saving = false;
        this.formError = this.describeError(err, 'Modification impossible.');
      },
    });
  }

  private applyRoleThenBudget(
    roleChanged: boolean,
    budgetChanged: boolean,
    newBudget: number,
  ): void {
    const applyBudget = () => {
      if (!budgetChanged) return this.afterEditSuccess();
      this.famille.setBudget(this.editingId!, newBudget).subscribe({
        next: () => this.afterEditSuccess(),
        error: (err) => {
          this.saving = false;
          this.formError = this.describeError(err, 'Mise à jour du budget impossible.');
        },
      });
    };
    if (!roleChanged) return applyBudget();
    this.famille.changeRole(this.editingId!, this.draft.role).subscribe({
      next: () => applyBudget(),
      error: (err) => {
        this.saving = false;
        this.formError = this.describeError(err, 'Changement de rôle impossible.');
      },
    });
  }

  private afterEditSuccess(): void {
    // Si l'admin a choisi un nouveau fichier photo, on l'envoie en multipart
    // sur /users/upload-photo/{userId} APRÈS la mise à jour du profil. Échec
    // d'upload = warning (le reste a été sauvegardé) — n'annule pas le succès.
    const file = this.draft.photoFile;
    const finish = () => {
      this.saving = false;
      this.modalOpen = false;
      this.notifSvc.refreshFromOtherPage();
      this.showToast('Membre modifié avec succès.', 'success');
      this.reload();
    };
    if (file && this.editingUserId != null) {
      this.famille.uploadUserPhoto(this.editingUserId, file).subscribe({
        next: () => finish(),
        error: (err) => {
          console.error('[Famille] photo upload failed', err);
          this.showToast('Profil enregistré, mais l\'upload de la photo a échoué.', 'warning');
          finish();
        },
      });
      return;
    }
    finish();
  }

  /** Bouton "Supprimer" : retire localement la photo de profil affichée
   *  dans le draft. L'upload différé ne se déclenchera plus (photoFile=null)
   *  et l'aperçu disparaît immédiatement. */
  clearPhoto(): void {
    this.draft.photoUrl = '';
    this.draft.photoPreview = '';
    this.draft.photoFile = null;
  }

  /** Sélection d'un fichier image dans le modal d'édition.
   *  - Génère un dataURL pour aperçu immédiat (photoPreview)
   *  - Conserve le File brut pour l'upload après save (photoFile)
   *  - L'URL persistée d'origine reste dans photoUrl pour fallback affichage. */
  onPhotoChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.formError = 'Veuillez sélectionner une image.';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.draft.photoPreview = String(reader.result || '');
      this.draft.photoFile = file;
    };
    reader.readAsDataURL(file);
  }

  // ── Delete flow ─────────────────────────────────────────────────
  askDelete(m: FamilleMemberVM): void {
    if (m.isOwner) {
      this.showToast("Le chef de famille ne peut pas être supprimé.", 'warning');
      return;
    }
    this.deletingId = m.id;
    this.deletingName = `${m.firstName} ${m.lastName}`.trim();
  }

  cancelDelete(): void {
    this.deletingId = null;
    this.deletingName = '';
  }

  confirmDelete(): void {
    if (this.deletingId == null) return;
    const id = this.deletingId;
    this.deletingId = null;
    this.famille.deleteMembre(id).subscribe({
      next: () => {
        this.showToast('Membre supprimé.', 'danger');
        this.reload();
      },
      error: (err) => {
        console.error('[Famille] delete failed', err);
        this.showToast('Suppression impossible.', 'danger');
      },
    });
  }

  // ── Internals ───────────────────────────────────────────────────
  private emptyDraft(): MemberFormDraft {
    return {
      firstName: '',
      lastName: '',
      phone: '',
      role: 'GESTIONNAIRE',
      password: '',
      username: '',
      budget: null,
      photoUrl: '',
      photoPreview: '',
      photoFile: null,
    };
  }

  private stripPhonePrefix(phone: string): string {
    if (!phone) return '';
    return phone.replace(/^\+?216/, '').replace(/\D/g, '');
  }

  private describeError(err: any, fallback: string): string {
    const status = err?.status;
    if (status === 0) return 'Serveur injoignable.';
    if (status === 409) return 'Un utilisateur existe déjà avec ce nom.';
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

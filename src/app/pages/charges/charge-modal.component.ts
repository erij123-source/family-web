import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { ChargesService } from '../../core/services/charges.service';
import { BudgetService, BUDGET_EXCEEDED_MSG } from '../../core/services/budget.service';
import { NotificationsService } from '../../core/services/notifications.service';
import {
  Charge,
  ChargePayload,
  ChargeType,
} from '../../core/models/charge.model';
import { Membre } from '../../core/models/membre.model';

// Preset category options used in the dropdown. The backend Categorie entity
// is looked up (or created if missing) by name on save — so the user sees a
// familiar fixed list while the DB stays the source of truth for the actual id.
interface CategoryPreset {
  name: string;
  type: ChargeType;
}

const CATEGORY_PRESETS: CategoryPreset[] = [
  { name: 'Loyer',  type: 'FIXE' },
  { name: 'Électricité', type: 'FIXE' },
  { name: 'Eau', type: 'FIXE' },
  { name: 'Internet',  type: 'FIXE' },
  { name: 'Assurance',    type: 'FIXE' },
  { name: 'Alimentation',  type: 'VARIABLE' },
  { name: 'Transport',    type: 'VARIABLE' },
  { name: 'Loisirs',       type: 'VARIABLE' },
  { name: 'Santé',        type: 'VARIABLE' },
  { name: 'Éducation',     type: 'VARIABLE' },
  { name: 'Autre',       type: 'VARIABLE' },
];

// Value emitted by the <select> when the user wants to type a free-form name.
const AUTRE = 'Autre';

@Component({
  selector: 'app-charge-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './charge-modal.component.html',
  styleUrls: ['./charge-modal.component.scss'],
})
export class ChargeModalComponent implements OnChanges {
  @Input() open = false;
  /** When provided, the modal opens in edit mode and pre-fills from this row. */
  @Input() editing: Charge | null = null;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<Charge>();

  private readonly charges = inject(ChargesService);
  private readonly budgetSvc = inject(BudgetService);
  private readonly notifSvc = inject(NotificationsService);

  readonly presetsFixes   = CATEGORY_PRESETS.filter((p) => p.type === 'FIXE');
  readonly presetsVariables = CATEGORY_PRESETS.filter((p) => p.type === 'VARIABLE');

  membres: Membre[] = [];

  form = {
    membreId: null as number | null,
    type: 'FIXE' as ChargeType,
    /** Either a preset name or the literal 'Autre'. */
    categoryName: '' as string,
    /** Only relevant when categoryName === 'Autre'. */
    customCategoryName: '',
    budget: null as number | null,   // required — stored in Charge.amount
    chargeDate: this.todayIso(),
    // Date où l'argent sort effectivement. C'est ce champ — et non chargeDate
    // — qui décide à quel mois la charge est imputée pour le reste à vivre.
    paymentDate: this.todayIso(),
    description: '',
  };

  saving = false;
  errorMsg = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.loadDropdowns();
      this.errorMsg = '';
      this.hydrateForm();
    }
  }

  private loadDropdowns(): void {
    this.charges.listMembres().subscribe((list) => (this.membres = list));
  }

  private hydrateForm(): void {
    const e = this.editing;
    if (e) {
      const existingName = e.categorie?.name ?? '';
      const isKnownPreset = CATEGORY_PRESETS.some(
        (p) => p.name.toLowerCase() === existingName.toLowerCase() && p.name !== AUTRE,
      );
      this.form = {
        membreId: e.membre?.id ?? null,
        type: e.type,
        categoryName: isKnownPreset ? existingName : (existingName ? AUTRE : ''),
        customCategoryName: isKnownPreset ? '' : existingName,
        budget: e.amount,
        chargeDate: (e.chargeDate ?? '').slice(0, 10) || this.todayIso(),
        // Repli sur chargeDate puis aujourd'hui pour les charges importées
        // d'avant le champ paymentDate.
        paymentDate: (e.paymentDate ?? e.chargeDate ?? '').slice(0, 10) || this.todayIso(),
        description: e.description ?? '',
      };
    } else {
      this.form = {
        membreId: null,
        type: 'FIXE',
        categoryName: '',
        customCategoryName: '',
        budget: null,
        chargeDate: this.todayIso(),
        paymentDate: this.todayIso(),
        description: '',
      };
    }
  }

  get isAutreSelected(): boolean {
    return this.form.categoryName === AUTRE;
  }

  private todayIso(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  save(): void {
    if (this.saving) return;
    this.errorMsg = '';
    if (this.form.membreId == null) { this.errorMsg = 'Sélectionnez un membre.'; return; }
    if (!this.form.categoryName) { this.errorMsg = 'Sélectionnez une catégorie.'; return; }
    if (this.isAutreSelected && !this.form.customCategoryName.trim()) {
      this.errorMsg = 'Précisez le nom de la catégorie.';
      return;
    }
    if (this.form.budget == null || this.form.budget <= 0) {
      this.errorMsg = 'Le budget est obligatoire.';
      return;
    }
    if (!this.form.chargeDate) { this.errorMsg = 'La date de la charge est obligatoire.'; return; }

    const effectiveCategoryName = this.isAutreSelected
      ? this.form.customCategoryName.trim()
      : this.form.categoryName;

    this.saving = true;
    // Guard the member's monthly budget before doing any DB writes — the
    // cap is enforced uniformly across charges and factures. Skip the check
    // in edit mode so users can still adjust an existing charge that's
    // already past the cap.
    const guard$ = this.editing
      ? of({ wouldExceed: () => false } as { wouldExceed: (n: number) => boolean })
      : this.budgetSvc.getStatus(this.form.membreId!);
    guard$.subscribe((status) => {
      if (status.wouldExceed(this.form.budget!)) {
        this.saving = false;
        this.errorMsg = BUDGET_EXCEEDED_MSG;
        return;
      }
      this.charges.ensureCategoryByName(effectiveCategoryName).subscribe({
        next: (categorie) => this.persistCharge(categorie.id),
        error: (err) => {
          this.saving = false;
          this.errorMsg = 'Création de la catégorie impossible.';
          console.error('[charge-modal] ensureCategory failed', err);
        },
      });
    });
  }

  private persistCharge(categorieId: number): void {
    // En CREATE on force paymentDate = aujourd'hui (l'utilisateur n'a pas
    // accès à ce champ : règle métier "toujours imputé au mois courant").
    // En EDIT on préserve la paymentDate existante pour ne pas déplacer la
    // charge d'un mois budget à un autre rétroactivement.
    const paymentDate = this.editing
      ? (this.form.paymentDate || this.todayIso())
      : this.todayIso();
    const payload: Omit<ChargePayload, 'compte'> = {
      membre: { id: this.form.membreId! },
      categorie: { id: categorieId },
      type: this.form.type,
      amount: this.form.budget!,
      ceiling: 0, // Plafond max was removed from the UI — keep 0 on the entity.
      chargeDate: this.form.chargeDate,
      paymentDate,
      description: this.form.description?.trim() || undefined,
    };
    const op$ = this.editing
      ? this.charges.edit(this.editing.id, payload)
      : this.charges.add(payload);

    op$.subscribe({
      next: (result) => {
        this.saving = false;
        // Re-scan for new alerts (budget thresholds, …) so the bell badge
        // reflects the change immediately on the Notifications page.
        this.notifSvc.refreshFromOtherPage();
        this.saved.emit(result);
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg =
          err?.error?.message ||
          (typeof err?.error === 'string' ? err.error : null) ||
          'Enregistrement impossible. Réessayez.';
        console.error('[charge-modal] save failed', err);
      },
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  close(): void {
    this.open = false;
    this.openChange.emit(false);
  }
}

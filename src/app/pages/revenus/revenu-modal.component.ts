import {
  Component, EventEmitter, Input, Output,
  ViewEncapsulation, inject, OnChanges, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { RevenusService } from '../../core/services/revenus.service';
import { RevenuDTO, RevenuPayload, RevenuKind } from '../../core/models/revenu.model';
import { Membre } from '../../core/models/membre.model';

interface RevenuPreset { name: string }

// Preset list of "Type de revenu" exactly matching the user's screenshot.
const REVENU_PRESETS: RevenuPreset[] = [
  { name: 'Salaire'},
  { name: 'Revenu secondaire' },
  { name: 'Aide / Subvention' },
];
const CUSTOM = '__custom__';

@Component({
  selector: 'app-revenu-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './revenu-modal.component.html',
  styleUrls: ['./revenu-modal.component.scss'],
})
export class RevenuModalComponent implements OnChanges {
  @Input() open = false;
  /** When provided, the modal opens in edit mode and pre-fills from this row. */
  @Input() editing: RevenuDTO | null = null;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  private readonly revenus = inject(RevenusService);

  readonly presets = REVENU_PRESETS;
  readonly CUSTOM = CUSTOM;

  membres: Membre[] = [];

  form = {
    membreId: null as number | null,
    typeName: '' as string,          // preset name or CUSTOM sentinel
    customTypeName: '',              // when typeName === CUSTOM
    // Revenu kind — persisté directement en base (colonne `kind`).
    kind: 'FIXE' as RevenuKind,
    amount: null as number | null,
    perceptionDate: this.todayIso(),
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
    this.revenus.listMembres().subscribe((list) => (this.membres = list));
  }

  private hydrateForm(): void {
    const e = this.editing;
    if (e) {
      const existingName = e.categorieName ?? '';
      const isPreset = REVENU_PRESETS.some(
        (p) => p.name.toLowerCase() === existingName.toLowerCase(),
      );
      this.form = {
        membreId: e.membreId,
        typeName: isPreset ? existingName : (existingName ? CUSTOM : ''),
        customTypeName: isPreset ? '' : existingName,
        kind: e.kind ?? 'FIXE',
        amount: e.amount,
        perceptionDate: (e.perceptionDate ?? '').slice(0, 10) || this.todayIso(),
        description: e.description ?? '',
      };
    } else {
      this.form = {
        membreId: null,
        typeName: '',
        customTypeName: '',
        kind: 'FIXE',
        amount: null,
        perceptionDate: this.todayIso(),
        description: '',
      };
    }
  }

  /** Kept for template (ngModelChange) compatibility — plus aucun side-effect
   *  nécessaire depuis que la periodicite a été retirée. */
  onKindChange(): void { /* no-op */ }

  get isCustom(): boolean { return this.form.typeName === CUSTOM; }

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
    if (!this.form.typeName) { this.errorMsg = 'Sélectionnez une catégorie.'; return; }
    if (this.isCustom && !this.form.customTypeName.trim()) {
      this.errorMsg = 'Précisez le nom de la catégorie.';
      return;
    }
    if (this.form.amount == null || this.form.amount <= 0) {
      this.errorMsg = 'Le montant est obligatoire.';
      return;
    }
    if (!this.form.perceptionDate) { this.errorMsg = 'La date est obligatoire.'; return; }

    const effectiveName = this.isCustom
      ? this.form.customTypeName.trim()
      : this.form.typeName;

    this.saving = true;
    this.revenus.ensureCategoryByName(effectiveName).subscribe({
      next: (categorie) => this.persistRevenu(categorie.id),
      error: (err) => {
        this.saving = false;
        this.errorMsg = this.describeError(err, 'Création du type impossible.');
        console.error('[revenu-modal] ensureCategory failed', err);
      },
    });
  }

  private describeError(err: any, fallback: string): string {
    const body = err?.error;
    const serverMsg =
      typeof body === 'string' ? body :
      body?.message || body?.error || '';
    const status = err?.status;
    if (status === 0) return 'Serveur injoignable. Vérifiez que le backend est démarré.';
    if (serverMsg) return `Erreur (${status ?? '?'}) : ${serverMsg}`;
    return fallback;
  }

  private persistRevenu(categorieId: number): void {
    // Plus de periodicite : on envoie directement kind (FIXE | VARIABLE).
    const payload: Omit<RevenuPayload, 'compte'> = {
      membre: { id: this.form.membreId! },
      categorie: { id: categorieId },
      amount: this.form.amount!,
      kind: this.form.kind,
      perceptionDate: this.form.perceptionDate,
      description: this.form.description?.trim() || undefined,
    };
    const op$ = this.editing
      ? this.revenus.edit(this.editing.id, payload)
      : this.revenus.add(payload);

    op$.subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit();
        this.close();
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = this.describeError(err, 'Enregistrement impossible. Réessayez.');
        console.error('[revenu-modal] save failed', err);
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

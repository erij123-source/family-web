import { Component, EventEmitter, Input, Output, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../core/services/auth.service';
import { SessionService } from '../core/services/session.service';

// Simple overlay + card modal. We avoid Bootstrap's JS modal so the show/hide
// state stays owned by Angular (no race between BS + Angular change detection)
// and so the dialog inherits the rest of the auth-style CSS without any
// data-bs-* wiring.
@Component({
  selector: 'app-profile-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="fb-profile-overlay" *ngIf="open" (click)="onBackdropClick($event)">
      <div class="fb-profile-card" role="dialog" aria-modal="true" aria-labelledby="fbProfileTitle">

        <!-- Accent strip (matches the auth cards) -->
        <div class="fb-profile-accent"></div>

        <!-- Header -->
        <div class="fb-profile-head">
          <div class="fb-profile-head-icon"><i class="material-icons-outlined">person</i></div>
          <div>
            <h5 id="fbProfileTitle" class="fb-profile-title">Profil utilisateur</h5>
            <p class="fb-profile-sub">Vos informations personnelles</p>
          </div>
          <button type="button" class="fb-profile-close" (click)="close()" aria-label="Fermer">
            <i class="material-icons-outlined">close</i>
          </button>
        </div>

        <!-- Photo block (UI only — backend does not persist avatars yet) -->
        <div class="fb-profile-photo-row">
          <div class="fb-profile-avatar" [style.background]="avatarBg">
            <span *ngIf="!avatarDataUrl">{{ initials }}</span>
            <img *ngIf="avatarDataUrl" [src]="avatarDataUrl" alt="avatar">
          </div>
          <div class="fb-profile-photo-info">
            <div class="fb-profile-photo-title">Photo de profil</div>
            <div class="fb-profile-photo-hint">JPG, PNG ou GIF max 2 MB</div>
            <div class="fb-profile-photo-actions">
              <label class="fb-btn-small fb-btn-small-primary">
                <i class="material-icons-outlined">upload</i> Changer
                <input type="file" accept="image/*" (change)="onPhotoPick($event)" hidden>
              </label>
              <button type="button" class="fb-btn-small fb-btn-small-danger" (click)="removePhoto()">
                <i class="material-icons-outlined">delete</i> Supprimer
              </button>
            </div>
          </div>
        </div>

        <!-- Form -->
        <form (ngSubmit)="save()" #f="ngForm" novalidate class="fb-profile-form">
          <div class="fb-profile-grid">
            <div class="fb-profile-field">
              <label>Nom</label>
              <input type="text" name="lastName" [(ngModel)]="form.lastName" placeholder="Nom" required>
            </div>
            <div class="fb-profile-field">
              <label>Prénom</label>
              <input type="text" name="firstName" [(ngModel)]="form.firstName" placeholder="Prénom" required>
            </div>
            <div class="fb-profile-field">
              <label>Nom de famille</label>
              <input type="text" name="familleName" [(ngModel)]="form.familleName" readonly>
            </div>
          </div>

          <div class="fb-profile-grid two">
            <div class="fb-profile-field">
              <label>Téléphone</label>
              <div class="fb-profile-phone">
                <i class="material-icons-outlined">phone</i>
                <input type="tel" name="phone" [(ngModel)]="form.phone" placeholder="+216 ..."
                       inputmode="numeric" maxlength="12"
                       (input)="onPhoneInput($event)">
                <button *ngIf="phoneChanged" type="button"
                        (click)="sendOtp()"
                        [disabled]="otpStatus === 'sending' || phoneVerified"
                        style="margin-left:8px; padding:6px 12px; border:none; border-radius:8px;
                               background:linear-gradient(135deg,#377CF4,#2E3F8F); color:#fff;
                               font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">
                  {{ phoneVerified ? 'Vérifié ✓' : (otpStatus === 'sending' ? 'Envoi…' : (otpRequested ? 'Renvoyer' : 'Vérifier')) }}
                </button>
              </div>
              <!-- Champ code OTP : visible après l'envoi du SMS et tant que non vérifié -->
              <div *ngIf="phoneChanged && otpRequested && !phoneVerified"
                   style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                <input type="text" name="otpCode" [(ngModel)]="otpCode"
                       placeholder="Code SMS (4-6 chiffres)" inputmode="numeric" maxlength="6"
                       style="flex:1; padding:6px 10px; border:1px solid var(--bs-border-color); border-radius:8px;">
                <button type="button" (click)="verifyOtp()"
                        [disabled]="otpStatus === 'verifying'"
                        style="padding:6px 12px; border:none; border-radius:8px;
                               background:#22c55e; color:#fff; font-size:12px; font-weight:700;
                               cursor:pointer; white-space:nowrap;">
                  {{ otpStatus === 'verifying' ? '…' : 'Valider' }}
                </button>
              </div>
              <div *ngIf="otpError" style="color:#ef4444; font-size:12px; margin-top:6px;">{{ otpError }}</div>
              <div *ngIf="phoneVerified && otpStatus === 'verified'"
                   style="color:#22c55e; font-size:12px; margin-top:6px;">Numéro vérifié.</div>
            </div>
            <div class="fb-profile-field">
              <label>Rôle dans la famille</label>
              <input type="text" name="role" [(ngModel)]="form.role" readonly>
            </div>
          </div>

          <div *ngIf="errorMsg" class="fb-profile-alert error">{{ errorMsg }}</div>
          <div *ngIf="infoMsg"  class="fb-profile-alert ok">{{ infoMsg }}</div>

          <div class="fb-profile-actions">
            <button type="submit" class="fb-btn-save" [disabled]="saving">
              <i class="material-icons-outlined">save</i>
              {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button type="button" class="fb-btn-cancel" (click)="close()">
              <i class="material-icons-outlined">undo</i> Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .fb-profile-overlay {
      position: fixed; inset: 0; z-index: 1080;
      background: rgba(2, 6, 23, 0.65);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    }
    .fb-profile-card {
      position: relative;
      width: 100%; max-width: 920px; max-height: 90vh; overflow: auto;
      background: linear-gradient(127deg, rgba(6,11,40,0.96) 19%, rgba(10,14,35,0.88) 77%);
      border-radius: 16px;
      box-shadow: 0 22px 60px rgba(0,0,0,0.45);
      color: #e6ecf0;
      padding: 30px 32px 26px;
    }
    .fb-profile-accent {
      position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(to right, #7928ca, #ff0080, #04e09a, #e0d504);
      border-radius: 16px 16px 0 0;
    }
    .fb-profile-head {
      display: flex; align-items: flex-start; gap: 14px;
      padding-bottom: 20px; margin-bottom: 22px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .fb-profile-head-icon {
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg, #377CF4, #2E3F8F);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .fb-profile-head-icon i { font-size: 26px; color: #fff; }
    .fb-profile-title { margin: 0; font-size: 18px; font-weight: 700; color: #e6ecf0; }
    .fb-profile-sub { margin: 2px 0 0; font-size: 13px; color: rgba(255,255,255,0.5); }
    .fb-profile-close {
      margin-left: auto; background: transparent; border: 0; color: rgba(255,255,255,0.5);
      cursor: pointer; padding: 4px; border-radius: 8px;
    }
    .fb-profile-close:hover { color: #e6ecf0; background: rgba(255,255,255,0.06); }

    .fb-profile-photo-row {
      display: flex; align-items: center; gap: 20px; margin-bottom: 24px;
    }
    .fb-profile-avatar {
      width: 92px; height: 92px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px; font-weight: 700; color: #fff;
      flex-shrink: 0; overflow: hidden;
    }
    .fb-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .fb-profile-photo-info { flex: 1; min-width: 0; }
    .fb-profile-photo-title { font-weight: 600; font-size: 15px; margin-bottom: 3px; }
    .fb-profile-photo-hint { font-size: 12.5px; color: rgba(255,255,255,0.45); margin-bottom: 10px; }
    .fb-profile-photo-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .fb-btn-small {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: 1px solid transparent; transition: filter 0.15s;
    }
    .fb-btn-small i { font-size: 16px; }
    .fb-btn-small-primary {
      background: linear-gradient(135deg, #377CF4, #2E3F8F);
      color: #fff; border: 0;
    }
    .fb-btn-small-primary:hover { filter: brightness(1.1); }
    .fb-btn-small-danger {
      background: transparent; color: #ef4444; border-color: rgba(239,68,68,0.4);
    }
    .fb-btn-small-danger:hover { background: rgba(239,68,68,0.08); }

    .fb-profile-form { }
    .fb-profile-grid {
      display: grid; gap: 16px 18px;
      grid-template-columns: repeat(3, 1fr);
      margin-bottom: 16px;
    }
    .fb-profile-grid.two { grid-template-columns: repeat(2, 1fr); }
    .fb-profile-grid.one { grid-template-columns: 1fr; max-width: 280px; }
    .fb-profile-field label {
      display: block; font-size: 13px; font-weight: 600;
      color: rgba(255,255,255,0.75); margin-bottom: 6px;
    }
    .fb-profile-field input {
      width: 100%; height: 44px; padding: 0 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      color: #e6ecf0; font-size: 14px; font-family: inherit;
      outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    }
    .fb-profile-field input:focus {
      border-color: #2E3F8F;
      box-shadow: 0 0 0 3px rgba(55,124,244,0.15);
      background: rgba(255,255,255,0.08);
    }
    .fb-profile-field input[readonly] { opacity: 0.65; cursor: not-allowed; }
    .fb-profile-field input::placeholder { color: rgba(255,255,255,0.35); }

    .fb-profile-phone {
      position: relative; height: 44px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      display: flex; align-items: center; padding: 0 12px;
    }
    .fb-profile-phone:focus-within {
      border-color: #2E3F8F;
      box-shadow: 0 0 0 3px rgba(55,124,244,0.15);
    }
    .fb-profile-phone i { color: rgba(255,255,255,0.4); font-size: 18px; margin-right: 8px; }
    .fb-profile-phone input {
      flex: 1; height: 100%; border: 0; background: transparent; outline: none;
      color: #e6ecf0; font-size: 14px;
    }

    .fb-profile-alert {
      padding: 10px 12px; border-radius: 10px; font-size: 13px; margin: 8px 0 4px;
    }
    .fb-profile-alert.error { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fecaca; }
    .fb-profile-alert.ok    { background: rgba(34,197,94,0.12);  border: 1px solid rgba(34,197,94,0.3);  color: #bbf7d0; }

    .fb-profile-actions {
      display: flex; gap: 12px; margin-top: 18px;
      padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.08);
    }
    .fb-btn-save {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 0 22px; height: 42px; border: 0; border-radius: 10px;
      background: linear-gradient(135deg, #377CF4, #2E3F8F); color: #fff;
      font-size: 14px; font-weight: 600; cursor: pointer;
      box-shadow: 0 3px 12px rgba(55,124,244,0.3);
    }
    .fb-btn-save:hover { filter: brightness(1.08); }
    .fb-btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
    .fb-btn-cancel {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 0 20px; height: 42px; border-radius: 10px;
      background: transparent; color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .fb-btn-cancel:hover { background: rgba(255,255,255,0.05); color: #fff; }

    @media (max-width: 720px) {
      .fb-profile-grid, .fb-profile-grid.two { grid-template-columns: 1fr; }
      .fb-profile-card { padding: 24px 20px; }
      .fb-profile-photo-row { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class ProfileModalComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();

  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);

  form = {
    firstName: '',
    lastName: '',
    phone: '',
    familleName: '',
    role: '',
  };

  saving = false;
  errorMsg = '';
  infoMsg = '';

  // ── État OTP pour la modification du téléphone ──
  // Lecture session : on garde le téléphone d'origine pour détecter le
  // moindre changement. Tant que le numéro est identique au précédent,
  // aucune vérification SMS n'est demandée. Dès qu'il est modifié,
  // `phoneVerified` repasse à false et la sauvegarde est bloquée tant que
  // l'OTP n'a pas été validé.
  private originalPhoneDigits = '';
  otpRequested = false;
  otpCode = '';
  phoneVerified = true; // par défaut OK (pas modifié)
  otpStatus: 'idle' | 'sending' | 'verifying' | 'sent' | 'verified' | 'error' = 'idle';
  otpError = '';

  /** Le téléphone saisi diffère-t-il du numéro initial chargé en session ?
   *  Utilisé pour afficher conditionnellement le bouton "Vérifier". */
  get phoneChanged(): boolean {
    const cur = (this.form.phone || '').replace(/\D/g, '').replace(/^216/, '');
    return cur !== this.originalPhoneDigits;
  }

  private get phoneE164(): string {
    const digits = (this.form.phone || '').replace(/\D/g, '');
    const local = digits.startsWith('216') ? digits.slice(3) : digits;
    return local ? `+216${local}` : '';
  }

  /** Live-bound to the session so the modal's circle and the header's avatar
   *  stay in sync the moment the picture is picked or removed. */
  get avatarDataUrl(): string | null {
    return this.session.snapshot?.avatarDataUrl ?? null;
  }

  // Colors for the initials-based avatar fallback.
  readonly avatarBg = 'linear-gradient(135deg, #7c3aed, #377CF4)';

  get initials(): string {
    const f = (this.form.firstName || '').trim().charAt(0);
    const l = (this.form.lastName || '').trim().charAt(0);
    const both = (f + l).toUpperCase();
    return both || '?';
  }

  ngOnChanges(): void {
    if (this.open) this.loadFromSession();
  }

  /** Téléphone : on autorise le préfixe "+216" facultatif, mais on borne
   *  toujours à 8 chiffres locaux maximum (alignement avec le mobile et
   *  les pages d'auth). Si l'utilisateur tape ou colle un numéro plus
   *  long, on conserve uniquement les 8 derniers chiffres. */
  onPhoneInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const raw = input.value || '';
    const hasPlus = raw.trim().startsWith('+');
    let digits = raw.replace(/\D/g, '');
    // Si le numéro porte le préfixe pays 216, on le garde + 8 chiffres
    // locaux max ; sinon on garde simplement 8 chiffres.
    if (digits.startsWith('216')) digits = '216' + digits.slice(3).slice(0, 8);
    else digits = digits.slice(0, 8);
    const next = hasPlus && digits.startsWith('216') ? '+' + digits : digits;
    if (input.value !== next) input.value = next;
    this.form.phone = next;
    // Reset complet de l'état OTP dès que le numéro diffère de l'original.
    if (this.phoneChanged) {
      this.phoneVerified = false;
      this.otpRequested = false;
      this.otpCode = '';
      this.otpStatus = 'idle';
      this.otpError = '';
    } else {
      // Retour au numéro d'origine → considéré déjà vérifié, on cache l'UI.
      this.phoneVerified = true;
      this.otpRequested = false;
      this.otpCode = '';
      this.otpStatus = 'idle';
      this.otpError = '';
    }
  }

  private loadFromSession(): void {
    const s = this.session.snapshot;
    this.errorMsg = '';
    this.infoMsg = '';
    this.form = {
      firstName: s?.firstName ?? '',
      lastName:  s?.lastName  ?? '',
      phone:     s?.phone     ?? '',
      familleName: s?.familleName ?? '',
      role:      this.prettyRole(s?.role),
    };
    // Mémoriser le numéro d'origine pour la détection de changement OTP.
    const rawDigits = (s?.phone || '').replace(/\D/g, '');
    this.originalPhoneDigits = rawDigits.startsWith('216') ? rawDigits.slice(3) : rawDigits;
    this.phoneVerified = true;
    this.otpRequested = false;
    this.otpCode = '';
    this.otpStatus = 'idle';
    this.otpError = '';
  }

  // ── OTP send / verify ─────────────────────────────────────────────────
  sendOtp(): void {
    const digits = (this.form.phone || '').replace(/\D/g, '');
    const local = digits.startsWith('216') ? digits.slice(3) : digits;
    if (local.length !== 8) {
      this.otpError = 'Numéro invalide (8 chiffres requis).';
      return;
    }
    this.otpError = '';
    this.otpStatus = 'sending';
    this.auth.sendOtp(this.phoneE164).subscribe({
      next: () => {
        this.otpRequested = true;
        this.otpStatus = 'sent';
      },
      error: () => {
        this.otpStatus = 'error';
        this.otpError = 'Envoi du code impossible. Réessayez.';
      },
    });
  }

  verifyOtp(): void {
    if (!this.otpCode.trim()) {
      this.otpError = 'Entrez le code reçu par SMS.';
      return;
    }
    this.otpStatus = 'verifying';
    this.otpError = '';
    this.auth.verifyOtp(this.phoneE164, this.otpCode.trim()).subscribe({
      next: () => {
        this.phoneVerified = true;
        this.otpStatus = 'verified';
      },
      error: (err: any) => {
        this.otpStatus = 'error';
        this.otpError = err?.error?.message || 'Code incorrect.';
      },
    });
  }

  private prettyRole(role?: string): string {
    switch (role) {
      case 'ADMINISTRATEUR': return 'Administrateur';
      case 'GESTIONNAIRE':   return 'Gestionnaire';
      case 'CONSULTANT':     return 'Consultant';
      default: return '';
    }
  }

  onPhotoPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.errorMsg = 'Image trop lourde. Maximum 2 MB.';
      input.value = '';
      return;
    }
    // Client-side only — no upload endpoint on the backend. We persist the
    // data URL in SessionService so the header avatar and this modal stay
    // in sync and the image survives page reloads.
    const reader = new FileReader();
    reader.onload = () => {
      this.session.update({ avatarDataUrl: reader.result as string });
      this.errorMsg = '';
    };
    reader.onerror = () => { this.errorMsg = "Lecture de l'image impossible."; };
    reader.readAsDataURL(file);
    // Reset the input so picking the same file twice still fires onchange.
    input.value = '';
  }

  removePhoto(): void {
    this.session.update({ avatarDataUrl: undefined });
  }

  save(): void {
    if (this.saving) return;
    this.errorMsg = '';
    this.infoMsg = '';
    if (!this.form.firstName.trim() || !this.form.lastName.trim()) {
      this.errorMsg = 'Le prénom et le nom sont obligatoires.';
      return;
    }
    // Si le numéro a été modifié, exiger une vérification OTP avant l'enregistrement.
    if (this.phoneChanged && !this.phoneVerified) {
      this.errorMsg = 'Veuillez vérifier le nouveau numéro de téléphone (code SMS) avant d\'enregistrer.';
      return;
    }
    this.saving = true;
    this.auth
      .updateProfile({
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        phone: this.form.phone?.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.infoMsg = 'Profil mis à jour avec succès.';
          setTimeout(() => this.close(), 900);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err?.error?.message || 'Mise à jour impossible. Réessayez.';
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

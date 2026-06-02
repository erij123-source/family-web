// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { ThemeSwitcherComponent } from '../../../shared/theme-switcher.component';

declare const $: any;

@Component({
  selector: 'app-auth-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './register.component.html',
})
export class RegisterComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  familyName = '';
  firstName = '';
  lastName = '';
  username = '';
  password = '';
  phone = '';

  // OTP phone-verification state.
  otpRequested = false;
  otpCode = '';
  phoneVerified = false;
  otpStatus: 'idle' | 'sending' | 'verifying' | 'sent' | 'verified' | 'error' = 'idle';
  otpError = '';

  submitting = false;
  errorMsg = '';

  /** Saisie téléphone : on supprime tout caractère non-numérique et on
   *  tronque à 8 chiffres — comme le mobile React Native. Empêche tout
   *  caractère au-delà de la 8ᵉ position côté UI. */
  onPhoneInput(ev: Event, field: 'phone'): void {
    const input = ev.target as HTMLInputElement;
    const cleaned = (input.value || '').replace(/\D/g, '').slice(0, 8);
    if (input.value !== cleaned) input.value = cleaned;
    (this as any)[field] = cleaned;
  }

  /** Build username from first + last name, matching the original UX. */
  syncUsername(): void {
    const f = this.firstName.trim().toLowerCase().replace(/\s+/g, '');
    const l = this.lastName.trim().toLowerCase().replace(/\s+/g, '');
    this.username = f && l ? `${f} ${l}` : f + l;
  }

  get phoneE164(): string {
    // Backend stores whatever we send — we prepend the Tunisian country code
    // so it's consistent with the UI's fixed +216 prefix.
    const digits = this.phone.replace(/\D/g, '');
    return digits ? `+216${digits}` : '';
  }

  sendOtp(): void {
    const digits = this.phone.replace(/\D/g, '');
    if (digits.length !== 8) {
      this.otpError = 'Numéro invalide.';
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
      error: (err) => {
        this.otpStatus = 'error';
        this.otpError = err?.error?.message || 'Code incorrect.';
      },
    });
  }

  onSubmit(): void {
    console.log('[register] onSubmit fired', {
      familyName: this.familyName,
      firstName: this.firstName,
      lastName: this.lastName,
      username: this.username,
      password: this.password ? '(provided)' : '(empty)',
      phone: this.phone,
      phoneVerified: this.phoneVerified,
      submitting: this.submitting,
    });

    if (this.submitting) {
      console.warn('[register] ignored — already submitting');
      return;
    }
    this.errorMsg = '';
    if (!this.familyName.trim() || !this.firstName.trim() || !this.lastName.trim() || !this.password) {
      console.warn('[register] blocked — required fields missing');
      this.errorMsg = 'Tous les champs sont obligatoires.';
      return;
    }
    if (!this.phoneVerified) {
      console.warn('[register] blocked — phone not verified. Click "Vérifier" → enter SMS code → "Valider" first.');
      this.errorMsg = 'Veuillez vérifier votre numéro de téléphone avant de continuer.';
      return;
    }

    this.submitting = true;
    console.log('[register] dispatching registerFamily → POST /authentification/register-family');
    this.auth
      .registerFamily({
        familyName: this.familyName.trim(),
        admin: {
          username: this.username.trim(),
          password: this.password,
          firstName: this.firstName.trim(),
          lastName: this.lastName.trim(),
          phone: this.phoneE164,
        },
      })
      .subscribe({
        next: (session) => {
          console.log('[register] success, session received', session);
          // Reset here too — in case navigation fails the button still unlocks.
          this.submitting = false;
          this.router.navigate(['/auth/register-step2']);
        },
        error: (err) => {
          console.error('[register] family creation failed', {
            status: err?.status,
            url: err?.url,
            body: err?.error,
          });
          this.submitting = false;
          this.errorMsg = this.describeError(err);
        },
      });
  }

  // Extracts whatever useful detail the backend returned so the user can
  // see the real cause (duplicate username, missing field, etc).
  private describeError(err: any): string {
    const status = err?.status;
    const url = err?.url ? String(err.url).replace(/^https?:\/\/[^/]+/, '') : '';
    const body = err?.error;
    const serverMsg =
      typeof body === 'string'
        ? body
        : body?.message || body?.error || '';

    if (status === 0) return 'Serveur injoignable. Est-il démarré sur le port 8080 ?';
    if (status === 409 || /duplicate|exist|unique|déjà|utilis/i.test(serverMsg)) {
      return "Cet identifiant est déjà utilisé. Changez de prénom ou de nom.";
    }
    if (serverMsg) return `Erreur serveur (${status}) sur ${url || 'API'} : ${serverMsg}`;
    return `Création du compte impossible (HTTP ${status ?? '?'}${url ? ' sur ' + url : ''}).`;
  }

  ngAfterViewInit(): void {
    // Preserve the original password-strength meter + visibility toggle.
    try {
      $(document).ready(() => {
        $('#togglePwd').on('click', function () {
          const inp = $('#inputPassword');
          const ico = $(this).find('.material-icons-outlined');
          if (inp.attr('type') === 'password') {
            inp.attr('type', 'text');
            ico.text('visibility');
          } else {
            inp.attr('type', 'password');
            ico.text('visibility_off');
          }
        });

        $('#inputPassword').on('input', function () {
          const v = $(this).val();
          let s = 0;
          if (v.length >= 6) s++;
          if (v.length >= 10) s++;
          if (/[A-Z]/.test(v)) s++;
          if (/[0-9]/.test(v)) s++;
          if (/[^A-Za-z0-9]/.test(v)) s++;
          const L = [
            { w: '0%', c: 'transparent', t: '', tc: '#94a3b8' },
            { w: '20%', c: '#ef4444', t: 'Très faible', tc: '#ef4444' },
            { w: '40%', c: '#f97316', t: 'Faible', tc: '#f97316' },
            { w: '60%', c: '#eab308', t: 'Moyen', tc: '#eab308' },
            { w: '80%', c: '#22c55e', t: 'Fort', tc: '#22c55e' },
            { w: '100%', c: '#16a34a', t: 'Très fort', tc: '#16a34a' },
          ][s];
          $('#strengthFill').css({ width: L.w, background: L.c });
          $('#strengthText').text(L.t).css('color', L.tc);
        });
      });
    } catch (e) {
      console.warn('[register] inline script failed', e);
    }
  }
}

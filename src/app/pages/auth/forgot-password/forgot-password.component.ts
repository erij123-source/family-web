// @ts-nocheck
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { ThemeSwitcherComponent } from '../../../shared/theme-switcher.component';

@Component({
  selector: 'app-auth-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  phoneNumber = '';

  /** Restreint l'input téléphone à 8 chiffres max — comme le mobile. */
  onPhoneInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const cleaned = (input.value || '').replace(/\D/g, '').slice(0, 8);
    if (input.value !== cleaned) input.value = cleaned;
    this.phoneNumber = cleaned;
  }
  submitting = false;
  errorMsg = '';
  infoMsg = '';

  onSubmit(): void {
    if (this.submitting) return;
    this.errorMsg = '';
    this.infoMsg = '';
    const phone = this.phoneNumber.trim();
    if (!phone) {
      this.errorMsg = 'Veuillez saisir votre numéro de téléphone.';
      return;
    }
    this.submitting = true;
    this.auth.forgotPassword(phone).subscribe({
      next: (msg) => {
        this.infoMsg = msg || 'Un code de réinitialisation a été envoyé par SMS.';
        this.submitting = false;
        // The backend's `/authentification/forgot-password` identifies users
        // by phone only. We forward it to reset-password so the user sees
        // their number and doesn't have to retype it.
        setTimeout(
          () => this.router.navigate(['/auth/reset-password'], { queryParams: { phone } }),
          1200,
        );
      },
      error: () => {
        this.submitting = false;
        this.errorMsg = 'Envoi impossible. Vérifiez le numéro et réessayez.';
      },
    });
  }
}

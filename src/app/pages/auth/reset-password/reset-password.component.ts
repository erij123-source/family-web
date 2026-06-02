// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { ThemeSwitcherComponent } from '../../../shared/theme-switcher.component';

@Component({
  selector: 'app-auth-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // The SMS code from /authentification/forgot-password.
  code = '';
  newPassword = '';
  confirmPassword = '';
  phone = '';
  submitting = false;
  errorMsg = '';
  infoMsg = '';

  ngAfterViewInit(): void {
    this.phone = this.route.snapshot.queryParamMap.get('phone') || '';
  }

  onSubmit(): void {
    if (this.submitting) return;
    this.errorMsg = '';
    this.infoMsg = '';

    if (!this.code.trim()) {
      this.errorMsg = 'Veuillez saisir le code reçu par SMS.';
      return;
    }
    if (!this.newPassword || this.newPassword.length < 6) {
      this.errorMsg = 'Le mot de passe doit contenir au moins 6 caractères.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMsg = 'Les deux mots de passe ne correspondent pas.';
      return;
    }

    this.submitting = true;
    this.auth.resetPassword(this.code.trim(), this.newPassword).subscribe({
      next: (msg) => {
        this.infoMsg = msg || 'Mot de passe réinitialisé avec succès.';
        setTimeout(() => this.router.navigate(['/auth/login']), 1200);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg =
          err?.error && typeof err.error === 'string'
            ? err.error
            : 'Réinitialisation impossible. Vérifiez le code et réessayez.';
      },
    });
  }

  togglePwd(id: string, btn: HTMLButtonElement): void {
    const inp = document.getElementById(id) as HTMLInputElement | null;
    const ico = btn.querySelector('.material-icons-outlined');
    if (!inp) return;
    if (inp.type === 'password') {
      inp.type = 'text';
      if (ico) ico.textContent = 'visibility';
    } else {
      inp.type = 'password';
      if (ico) ico.textContent = 'visibility_off';
    }
  }
}

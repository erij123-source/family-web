// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { ThemeSwitcherComponent } from '../../../shared/theme-switcher.component';

declare const $: any;

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './login.component.html',
})
export class LoginComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  username = '';
  password = '';
  submitting = false;
  errorMsg = '';

  onSubmit(): void {
    if (this.submitting) return;
    this.errorMsg = '';
    if (!this.username.trim() || !this.password) {
      this.errorMsg = 'Veuillez renseigner votre identifiant et votre mot de passe.';
      return;
    }
    this.submitting = true;
    this.auth.login({ username: this.username.trim(), password: this.password }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg =
          err?.status === 401
            ? 'Identifiant ou mot de passe incorrect.'
            : 'Connexion impossible. Veuillez réessayer.';
      },
    });
  }

  ngAfterViewInit(): void {
    // Password visibility toggle preserved from the original template script.
    try {
      const btn = document.getElementById('togglePwd');
      const inp = document.getElementById('inputPassword') as HTMLInputElement | null;
      if (btn && inp) {
        btn.addEventListener('click', () => {
          const ico = btn.querySelector('.material-icons-outlined');
          if (inp.type === 'password') {
            inp.type = 'text';
            if (ico) ico.textContent = 'visibility';
          } else {
            inp.type = 'password';
            if (ico) ico.textContent = 'visibility_off';
          }
        });
      }
    } catch (e) {
      console.warn('[login] togglePwd wiring failed', e);
    }
  }
}

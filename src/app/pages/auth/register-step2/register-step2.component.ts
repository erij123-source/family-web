// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { MembreRole } from '../../../core/models/membre.model';
import { ThemeSwitcherComponent } from '../../../shared/theme-switcher.component';

declare const $: any;

interface MemberDraft {
  id: number; // backend membre id once created
  firstName: string;
  lastName: string;
  username: string;
  role: 'gestionnaire' | 'consultant';
}

@Component({
  selector: 'app-auth-register-step2',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ThemeSwitcherComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './register-step2.component.html',
})
export class RegisterStep2Component implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  members: MemberDraft[] = [];
  addFormOpen = false;

  // ── draft member form state ──
  selectedRole: 'gestionnaire' | 'consultant' = 'gestionnaire';
  firstName = '';
  lastName = '';
  username = '';
  password = '';
  phone = '';
  adding = false;
  errorMsg = '';

  // ── OTP du membre — même flux que l'admin sur register.component.ts ──
  // memberPhoneVerified bloque "Ajouter" tant que le numéro n'est pas validé.
  memberOtpRequested = false;
  memberOtpCode = '';
  memberPhoneVerified = false;
  memberOtpStatus: 'idle' | 'sending' | 'verifying' | 'sent' | 'verified' | 'error' = 'idle';
  memberOtpError = '';

  toggleAddForm(show: boolean): void {
    this.addFormOpen = show;
    if (show) this.resetDraft();
  }

  selectMemberRole(role: 'gestionnaire' | 'consultant'): void {
    this.selectedRole = role;
  }

  syncUsername(): void {
    const f = this.firstName.trim().toLowerCase().replace(/\s+/g, '');
    const l = this.lastName.trim().toLowerCase().replace(/\s+/g, '');
    this.username = f && l ? `${f} ${l}` : f + l;
  }

  /** Restreint l'input téléphone à 8 chiffres max — comme le mobile. */
  onPhoneInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const cleaned = (input.value || '').replace(/\D/g, '').slice(0, 8);
    if (input.value !== cleaned) input.value = cleaned;
    this.phone = cleaned;
    // Reset l'état OTP si l'utilisateur édite le numéro après envoi/validation.
    if (this.memberOtpRequested || this.memberPhoneVerified) {
      this.memberOtpRequested = false;
      this.memberPhoneVerified = false;
      this.memberOtpCode = '';
      this.memberOtpStatus = 'idle';
      this.memberOtpError = '';
    }
  }

  private get phoneE164(): string {
    const digits = this.phone.replace(/\D/g, '');
    return digits ? `+216${digits}` : '';
  }

  sendMemberOtp(): void {
    const digits = this.phone.replace(/\D/g, '');
    if (digits.length !== 8) {
      this.memberOtpError = 'Numéro invalide.';
      return;
    }
    this.memberOtpError = '';
    this.memberOtpStatus = 'sending';
    this.auth.sendOtp(this.phoneE164).subscribe({
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
    this.auth.verifyOtp(this.phoneE164, this.memberOtpCode.trim()).subscribe({
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

  addMember(): void {
    if (this.adding) return;
    this.errorMsg = '';
    if (!this.firstName.trim() || !this.lastName.trim() || !this.password) {
      this.errorMsg = 'Prénom, nom et mot de passe sont obligatoires.';
      return;
    }
    if (this.phone && this.phone.replace(/\D/g, '').length !== 8) {
      this.errorMsg = 'Numéro invalide.';
      return;
    }
    // Téléphone fourni → exiger la vérification OTP. Aligné sur le flux
    // d'inscription de l'admin (cf. register.component.ts).
    if (this.phone && !this.memberPhoneVerified) {
      this.errorMsg = 'Veuillez vérifier le numéro de téléphone du membre avant de l\'ajouter.';
      return;
    }
    const backendRole: MembreRole =
      this.selectedRole === 'gestionnaire' ? 'GESTIONNAIRE' : 'CONSULTANT';

    this.adding = true;
    this.auth
      .addMember({
        role: backendRole,
        user: {
          firstName: this.firstName.trim(),
          lastName: this.lastName.trim(),
          username: this.username.trim(),
          password: this.password,
          phone: this.phoneE164,
        },
      })
      .subscribe({
        next: (membre) => {
          this.members = [
            ...this.members,
            {
              id: membre.id,
              firstName: this.firstName.trim(),
              lastName: this.lastName.trim(),
              username: this.username.trim(),
              role: this.selectedRole,
            },
          ];
          this.adding = false;
          this.toggleAddForm(false);
        },
        error: (err) => {
          this.adding = false;
          this.errorMsg =
            err?.status === 409 || (err?.error && String(err.error).includes('exist'))
              ? 'Un utilisateur existe déjà avec cet identifiant.'
              : 'Ajout du membre impossible.';
        },
      });
  }

  removeMember(id: number): void {
    // Local-only removal for now — backend DELETE requires a separate call;
    // we keep UX simple by not propagating the removal for in-registration drafts.
    this.members = this.members.filter((m) => m.id !== id);
  }

  finishSetup(): void {
    this.router.navigate(['/']);
  }

  private resetDraft(): void {
    this.firstName = '';
    this.lastName = '';
    this.username = '';
    this.password = '';
    this.phone = '';
    this.selectedRole = 'gestionnaire';
    this.errorMsg = '';
    this.memberOtpRequested = false;
    this.memberOtpCode = '';
    this.memberPhoneVerified = false;
    this.memberOtpStatus = 'idle';
    this.memberOtpError = '';
  }

  ngAfterViewInit(): void {
    // Preserve the original password-visibility toggle + strength meter.
    try {
      $(document).ready(() => {
        $('#toggleMemberPwd').on('click', function () {
          const inp = $('#memberPassword');
          const ico = $(this).find('.material-icons-outlined');
          if (inp.attr('type') === 'password') {
            inp.attr('type', 'text');
            ico.text('visibility');
          } else {
            inp.attr('type', 'password');
            ico.text('visibility_off');
          }
        });

        $('#memberPassword').on('input', function () {
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
          $('#memberStrengthFill').css({ width: L.w, background: L.c });
          $('#memberStrengthText').text(L.t).css('color', L.tc);
        });
      });
    } catch (e) {
      console.warn('[register-step2] inline script failed', e);
    }
  }
}

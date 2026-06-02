import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Sélecteur de thème (Blue / Light / Dark / Semi-Dark / Bordered).
 *
 * Composant standalone réutilisable : utilisé à la fois dans le layout
 * principal (après login) ET sur les pages d'auth (login, register,
 * forgot/reset password) — un utilisateur qui change le thème depuis
 * l'écran de connexion le retrouve appliqué une fois connecté.
 *
 * Source de vérité : `localStorage['fb-theme']` + l'attribut
 * `data-bs-theme` sur `<html>`. Aligné sur la logique historique du
 * main-layout pour éviter toute divergence.
 */
type ThemeKey = 'blue-theme' | 'light' | 'dark' | 'semi-dark' | 'bodered-theme';

interface ThemeOption {
  key: ThemeKey;
  label: string;
  icon: string;
}

const THEMES: ThemeOption[] = [
  { key: 'blue-theme',     label: 'Blue',      icon: 'contactless' },
  { key: 'light',          label: 'Light',     icon: 'light_mode' },
  { key: 'dark',           label: 'Dark',      icon: 'dark_mode' },
  { key: 'semi-dark',      label: 'Semi Dark', icon: 'contrast' },
  { key: 'bodered-theme',  label: 'Bordered',  icon: 'border_style' },
];

@Component({
  selector: 'app-theme-switcher',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="dropdown fb-theme-switcher">
      <a href="javascript:;" role="button" data-bs-toggle="dropdown"
         class="dropdown-toggle dropdown-toggle-nocaret rounded-circle border d-flex align-items-center justify-content-center p-0"
         title="Changer de thème"
         [style.width.px]="size"
         [style.height.px]="size"
         style="background: rgba(255,255,255,0.08); backdrop-filter: blur(6px);">
        <i class="material-icons-outlined"
           [style.fontSize.px]="iconSize"
           style="color: var(--bs-body-color, #e6ecf0);">{{ currentIcon }}</i>
      </a>
      <ul class="dropdown-menu dropdown-menu-end shadow" style="min-width: 180px;">
        <li *ngFor="let t of themes">
          <a class="dropdown-item d-flex align-items-center gap-2 py-2"
             href="javascript:;"
             [class.active]="current === t.key"
             (click)="apply(t.key)">
            <i class="material-icons-outlined">{{ t.icon }}</i>{{ t.label }}
          </a>
        </li>
      </ul>
    </div>
  `,
})
export class ThemeSwitcherComponent implements OnInit {
  readonly themes = THEMES;
  current: ThemeKey = 'blue-theme';

  /** Taille du bouton circulaire (px). Permet d'adapter aux pages d'auth
   *  où on a moins de place que dans le top-header. */
  readonly size = 42;
  readonly iconSize = 20;

  get currentIcon(): string {
    return THEMES.find((t) => t.key === this.current)?.icon || 'palette';
  }

  ngOnInit(): void {
    try {
      const saved = (localStorage.getItem('fb-theme') as ThemeKey) || 'blue-theme';
      this.current = saved;
      document.documentElement.setAttribute('data-bs-theme', saved);
    } catch (_) {
      /* localStorage indisponible — on garde la valeur par défaut */
    }
  }

  apply(theme: ThemeKey): void {
    this.current = theme;
    document.documentElement.setAttribute('data-bs-theme', theme);
    try { localStorage.setItem('fb-theme', theme); } catch (_) { /* ignore */ }

    // Synchronise les radios du Customizer du main-layout si elles existent
    // sur la page (cas où le bouton est utilisé depuis le main-layout).
    document
      .querySelectorAll<HTMLInputElement>('input[name="theme-options"]')
      .forEach((r) => (r.checked = false));
    const radioId = {
      'blue-theme':    'BlueTheme',
      light:           'LightTheme',
      dark:            'DarkTheme',
      'semi-dark':     'SemiDarkTheme',
      'bodered-theme': 'BoderedTheme',
    }[theme];
    const el = radioId ? (document.getElementById(radioId) as HTMLInputElement | null) : null;
    if (el) el.checked = true;
  }
}

import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService } from '../core/services/auth.service';
import { SessionService } from '../core/services/session.service';
import { ProfileModalComponent } from './profile-modal.component';

declare const $: any;
declare const SimpleBar: any;
declare const PerfectScrollbar: any;

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ProfileModalComponent],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  profileOpen = false;

  ngOnInit(): void {
    // À l'entrée dans le shell authentifié (login ou simple refresh), on
    // resynchronise l'avatar du header depuis le serveur pour refléter une
    // photo changée ailleurs (mobile, page Famille).
    this.auth.syncAvatarFromServer();
  }

  /** Stats submenu state — driven by Angular bindings instead of an
   *  imperative DOM toggle so navigations and re-renders never lose it.
   *  Stop propagation so the click doesn't bubble to any parent handler
   *  (the sidebar overlay / btn-toggle binds clicks too). */
  statsOpen = false;
  toggleStats(e?: Event): void {
    e?.preventDefault();
    e?.stopPropagation();
    this.statsOpen = !this.statsOpen;
  }

  get fullName(): string {
    const s = this.session.snapshot;
    const name = `${s?.firstName ?? ''} ${s?.lastName ?? ''}`.trim();
    return name || s?.username || 'Utilisateur';
  }

  get roleLabel(): string {
    switch (this.session.snapshot?.role) {
      case 'ADMINISTRATEUR': return 'Administrateur';
      case 'GESTIONNAIRE':   return 'Gestionnaire';
      case 'CONSULTANT':     return 'Consultant';
      default: return '';
    }
  }

  get initials(): string {
    const s = this.session.snapshot;
    const f = (s?.firstName ?? '').trim().charAt(0);
    const l = (s?.lastName ?? '').trim().charAt(0);
    const both = (f + l).toUpperCase();
    return both || (s?.username ?? '?').charAt(0).toUpperCase();
  }

  get avatarDataUrl(): string | null {
    return this.session.snapshot?.avatarDataUrl ?? null;
  }

  /** Only the family's ADMINISTRATEUR sees the "Famille" menu entries
   *  (sidebar + avatar dropdown). Non-admins can't even load the page
   *  thanks to the adminGuard on the route. */
  get isAdmin(): boolean {
    return this.session.snapshot?.role === 'ADMINISTRATEUR';
  }

  openProfile(event?: Event): void {
    event?.preventDefault();
    this.profileOpen = true;
  }

  logout(event?: Event): void {
    event?.preventDefault();
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login']),
    });
  }
  currentTheme = 'blue-theme';

  private themeRadioMap: Record<string, string> = {
    'blue-theme': 'BlueTheme',
    light: 'LightTheme',
    dark: 'DarkTheme',
    'semi-dark': 'SemiDarkTheme',
    'bodered-theme': 'BoderedTheme',
  };

  private themeIcons: Record<string, string> = {
    'blue-theme': 'contactless',
    light: 'light_mode',
    dark: 'dark_mode',
    'semi-dark': 'contrast',
    'bodered-theme': 'border_style',
  };

  get currentThemeIcon(): string {
    return this.themeIcons[this.currentTheme] || 'palette';
  }

  private onScroll = () => {
    if (($(window) as any).scrollTop() > 60) {
      $('.top-header .navbar').addClass('sticky-header');
    } else {
      $('.top-header .navbar').removeClass('sticky-header');
    }
  };

  applyThemeQuick(theme: string): void {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('fb-theme', theme);
    this.currentTheme = theme;

    // Keep the Customizer offcanvas radios in sync.
    document
      .querySelectorAll<HTMLInputElement>('input[name="theme-options"]')
      .forEach((r) => (r.checked = false));
    const id = this.themeRadioMap[theme];
    if (id) {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.checked = true;
    }
  }

  ngAfterViewInit(): void {
    const $$ = $;

    // ── Theme persistence ──
    const savedTheme = localStorage.getItem('fb-theme') || 'blue-theme';
    $$('html').attr('data-bs-theme', savedTheme);
    this.currentTheme = savedTheme;
    if (this.themeRadioMap[savedTheme]) {
      $$('#' + this.themeRadioMap[savedTheme]).prop('checked', true);
    }

    // ── MetisMenu init ──
    try {
      $$('#sidenav').metisMenu();
    } catch (e) {
      /* metismenu may be absent briefly */
    }

    // ── SimpleBar on sidebar ──
    try {
      const el = document.querySelector('.sidebar-wrapper');
      if (el && typeof SimpleBar !== 'undefined') new SimpleBar(el);
    } catch (e) {}

    // ── Sidebar toggle ──
    $$('.btn-toggle')
      .off('click.fb')
      .on('click.fb', () => {
        if ($$('body').hasClass('toggled')) {
          $$('body').removeClass('toggled sidebar-hovered');
          $$('.sidebar-wrapper').off('mouseenter mouseleave');
        } else {
          $$('body').addClass('toggled');
          $$('.sidebar-wrapper')
            .on('mouseenter', () => $$('body').addClass('sidebar-hovered'))
            .on('mouseleave', () => $$('body').removeClass('sidebar-hovered'));
        }
      });

    $$('.sidebar-close')
      .off('click.fb')
      .on('click.fb', () =>
        $$('body').removeClass('toggled sidebar-hovered')
      );
    $$('.overlay')
      .off('click.fb')
      .on('click.fb', () =>
        $$('body').removeClass('toggled sidebar-hovered')
      );

    // ── Sticky header ──
    $$(window).off('scroll.fb').on('scroll.fb', this.onScroll);

    // ── Theme switcher ──
    const applyTheme = (theme: string) => {
      $$('html').attr('data-bs-theme', theme);
      localStorage.setItem('fb-theme', theme);
      this.currentTheme = theme;
    };
    $$('#BlueTheme').off('click.fb').on('click.fb', () => applyTheme('blue-theme'));
    $$('#LightTheme').off('click.fb').on('click.fb', () => applyTheme('light'));
    $$('#DarkTheme').off('click.fb').on('click.fb', () => applyTheme('dark'));
    $$('#SemiDarkTheme').off('click.fb').on('click.fb', () => applyTheme('semi-dark'));
    $$('#BoderedTheme').off('click.fb').on('click.fb', () => applyTheme('bodered-theme'));

    // Auto-open the stats submenu when the current URL is a stats page
    // (initial load) and on every subsequent navigation.
    this.statsOpen = this.router.url.startsWith('/statistiques');
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects.startsWith('/statistiques')) this.statsOpen = true;
      });
  }

  ngOnDestroy(): void {
    $(window).off('scroll.fb');
  }
}

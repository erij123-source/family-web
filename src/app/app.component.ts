import { Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  constructor() {
    // Applique le thème persisté avant tout rendu — concerne aussi les
    // pages d'auth (login / register / forgot / reset) qui se chargent
    // hors du main-layout et n'ont donc pas la logique de thème.
    try {
      const saved = localStorage.getItem('fb-theme') || 'blue-theme';
      document.documentElement.setAttribute('data-bs-theme', saved);
    } catch (_) {
      /* localStorage indisponible (SSR / mode privé) — on garde le thème par défaut */
    }
  }
}

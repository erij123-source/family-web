import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout.component';
import { AuthLayoutComponent } from './layout/auth-layout.component';
import { adminGuard, authGuard, publicOnlyGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'charges',
        loadComponent: () => import('./pages/charges/charges.component').then((m) => m.ChargesComponent),
      },
      {
        path: 'factures',
        loadComponent: () => import('./pages/factures/factures.component').then((m) => m.FacturesComponent),
      },
      {
        path: 'revenus',
        loadComponent: () => import('./pages/revenus/revenus.component').then((m) => m.RevenusComponent),
      },
      {
        path: 'famille',
        canActivate: [adminGuard],
        loadComponent: () => import('./pages/famille/famille.component').then((m) => m.FamilleComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/notifications/notifications.component').then((m) => m.NotificationsComponent),
      },
      {
        path: 'assistant',
        loadComponent: () => import('./pages/assistant/assistant.component').then((m) => m.AssistantComponent),
      },
      { path: 'statistiques', pathMatch: 'full', redirectTo: 'statistiques/budget' },
      {
        path: 'statistiques/budget',
        loadComponent: () =>
          import('./pages/statistiques-budget/statistiques-budget.component').then(
            (m) => m.StatistiquesBudgetComponent
          ),
      },
      {
        path: 'statistiques/revenus',
        loadComponent: () =>
          import('./pages/statistiques-revenus/statistiques-revenus.component').then(
            (m) => m.StatistiquesRevenusComponent
          ),
      },
      {
        path: 'statistiques/charges',
        loadComponent: () =>
          import('./pages/statistiques-charges/statistiques-charges.component').then(
            (m) => m.StatistiquesChargesComponent
          ),
      },
      {
        path: 'statistiques/factures',
        loadComponent: () =>
          import('./pages/statistiques-factures/statistiques-factures.component').then(
            (m) => m.StatistiquesFacturesComponent
          ),
      },
    ],
  },
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [publicOnlyGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./pages/auth/register/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'register-step2',
        loadComponent: () =>
          import('./pages/auth/register-step2/register-step2.component').then(
            (m) => m.RegisterStep2Component
          ),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./pages/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./pages/auth/reset-password/reset-password.component').then(
            (m) => m.ResetPasswordComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

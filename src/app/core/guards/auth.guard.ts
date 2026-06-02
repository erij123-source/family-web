import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { SessionService } from '../services/session.service';

// Protects the authenticated area. Sends anonymous users to the login page
// with a returnUrl so they land back where they were after logging in.
export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.isAuthenticated) return true;

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};

// Keeps already-authenticated users out of /auth/* pages.
export const publicOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const session = inject(SessionService);
  const router = inject(Router);
  return session.isAuthenticated ? router.createUrlTree(['/']) : true;
};

// Restricts a route to the family ADMINISTRATEUR (chef de famille). Any other
// role (GESTIONNAIRE / CONSULTANT) is bounced to the home dashboard. Used for
// the Famille section which manages members/roles/budgets.
export const adminGuard: CanActivateFn = (): boolean | UrlTree => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (!session.isAuthenticated) return router.createUrlTree(['/auth/login']);
  return session.snapshot?.role === 'ADMINISTRATEUR'
    ? true
    : router.createUrlTree(['/']);
};

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { Membre, MembreRole } from '../models/membre.model';
import { User } from '../models/user.model';

/** Flat view-model the Famille page binds to. Aggregates Membre + User
 *  (names/phone/active flag) with the member's current-month income &
 *  spending totals — fetched in parallel so the card shows real numbers. */
export interface FamilleMemberVM {
  id: number;               // Membre id
  userId: number;
  firstName: string;
  lastName: string;
  phone: string;
  role: MembreRole;
  active: boolean;
  income: number;           // revenus du mois
  spend: number;            // charges + factures du mois
  budget: number;           // base saisie par l'admin (sans report)
  carryover: number;        // report = reste à vivre transféré lors de la
                            // dernière modification du budget par l'admin
  isOwner: boolean;
  photo: string;            // URL absolue de la photo du membre (vide si aucune)
}

@Injectable({ providedIn: 'root' })
export class FamilleService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * List the current family's members, each enriched with their monthly
   * income and spending. "spend" combines charges + factures since both
   * draw from the member's monthly budget envelope. Per-member totals are
   * fired in parallel with forkJoin so the cards render in a single pass.
   */
  listMembers(): Observable<FamilleMemberVM[]> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of([]);
    return this.http
      .get<Membre[]>(`${this.baseUrl}/membres/famille/${familleId}`)
      .pipe(
        switchMap((membres) => {
          if (!membres?.length) return of([] as FamilleMemberVM[]);
          const enriched$ = membres.map((m) =>
            forkJoin({
              income: this.totalRevenuMois(m.id),
              charges: this.totalChargesMois(m.id),
              factures: this.totalFacturesMois(m.id),
            }).pipe(
              map(({ income, charges, factures }) =>
                this.toVM(m, income, (charges || 0) + (factures || 0)),
              ),
            ),
          );
          return forkJoin(enriched$);
        }),
        catchError((err) => {
          console.error('[FamilleService] listMembers failed', err);
          return of([] as FamilleMemberVM[]);
        }),
      );
  }

  private totalRevenuMois(membreId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/revenus/membre/${membreId}/total/mois`)
      .pipe(catchError(() => of(0)));
  }

  private totalChargesMois(membreId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/charges/membre/${membreId}/total/mois`)
      .pipe(catchError(() => of(0)));
  }

  private totalFacturesMois(membreId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/factures/membre/${membreId}/total/mois`)
      .pipe(catchError(() => of(0)));
  }

  private toVM(m: Membre, income: number, spend: number): FamilleMemberVM {
    const u = (m.user ?? {}) as Partial<User>;
    // carryoverBudget n'est valide que si carryoverMois/Annee correspondent
    // au mois courant — sinon c'est une valeur stale, on la considère = 0.
    const mAny = m as any;
    const now = new Date();
    const curMois  = now.getMonth() + 1;
    const curAnnee = now.getFullYear();
    const carryValide =
      mAny.carryoverMois  != null && Number(mAny.carryoverMois)  === curMois &&
      mAny.carryoverAnnee != null && Number(mAny.carryoverAnnee) === curAnnee;
    return {
      id: m.id,
      userId: u.id ?? 0,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      phone: u.phone ?? '',
      role: m.role,
      active: u.active ?? true,
      income: income || 0,
      spend: spend || 0,
      budget: m.budget ?? 0,
      carryover: carryValide ? Number(mAny.carryoverBudget ?? 0) : 0,
      isOwner: m.role === 'ADMINISTRATEUR',
      photo: (u as any).photo ?? '',
    };
  }

  /** Upload a profile photo for a user. Returns the updated User (server
   *  re-emits the persisted photo URL). Used by the Famille edit modal. */
  uploadUserPhoto(userId: number, file: File): Observable<User> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<User>(`${this.baseUrl}/users/upload-photo/${userId}`, fd);
  }

  /** Update the User (name/phone) tied to a member. */
  updateUser(userId: number, patch: {
    firstName: string;
    lastName: string;
    phone?: string;
    username?: string;
  }): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/users/edit-profile/${userId}`, patch);
  }

  /** Change the Membre's role (Administrateur / Gestionnaire / Consultant). */
  changeRole(membreId: number, role: MembreRole): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/membres/change-role/${membreId}?role=${encodeURIComponent(role)}`,
      null,
    );
  }

  /** Delete a Membre. Keeps the underlying User row intact — matches the
   *  backend's existing behaviour and avoids cascading pain on related
   *  charges/revenus that reference the user's membre id. */
  deleteMembre(membreId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/membres/${membreId}`);
  }

  /** Update the monthly budget allocated to a member. Admin-only in the UI. */
  setBudget(membreId: number, budget: number): Observable<Membre> {
    return this.http.put<Membre>(
      `${this.baseUrl}/membres/set-budget/${membreId}?budget=${encodeURIComponent(budget)}`,
      null,
    );
  }

  /** Total des revenus de la famille (cumul historique). Conservé pour
   *  compatibilité (anciens écrans) — la page Famille utilise désormais les
   *  revenus DU MOIS + le report, cf. méthodes ci-dessous. */
  getTotalRevenusFamille(): Observable<number> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of(0);
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-revenu/${familleId}`)
      .pipe(catchError(() => of(0)));
  }

  /** Revenus de la famille pour le MOIS courant (repart de 0 chaque mois). */
  getRevenusMoisFamille(): Observable<number> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of(0);
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-revenu-mois/${familleId}`)
      .pipe(catchError(() => of(0)));
  }

  /** Budget restant glissant calculé côté serveur = report du mois précédent
   *  + revenus du mois − budgets distribués ce mois. */
  getBudgetRestantFamille(): Observable<number> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of(0);
    return this.http
      .get<number>(`${this.baseUrl}/comptes/budget-restant/${familleId}`)
      .pipe(catchError(() => of(0)));
  }

  /** Report de revenu non distribué hérité du mois précédent. */
  getRevenuCarryoverFamille(): Observable<number> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of(0);
    return this.http
      .get<number>(`${this.baseUrl}/comptes/revenu-carryover/${familleId}`)
      .pipe(catchError(() => of(0)));
  }
}

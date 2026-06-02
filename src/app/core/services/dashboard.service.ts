import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { BudgetSummary, DashboardSummary } from '../models/dashboard.model';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  // Resolves the active famille id from the authenticated session. The
  // authGuard keeps anonymous users out of the dashboard route, so the
  // session is expected to exist; we fall back to 1 only as a last resort
  // to avoid NaN path parameters during cold starts.
  private get familleId(): number {
    return this.session.snapshot?.familleId ?? 1;
  }

  /**
   * Builds the aggregated dashboard view-model by fanning out to the
   * backend endpoints in parallel. Any individual failure degrades to
   * a safe default (0 / 'Famille') so a single broken endpoint does
   * not blank out the whole screen.
   */
  loadSummary(familleId: number = this.familleId): Observable<DashboardSummary> {
    const membreId = this.session.snapshot?.membreId ?? 0;
    return forkJoin({
      familleName: this.getFamilleName(familleId),
      totalRevenuMois: this.getTotalRevenuMois(familleId),
      totalChargesMois: this.getTotalChargesMois(familleId),
      remainingBalanceMois: this.getRemainingBalanceMois(familleId),
      totalRevenu: this.getTotalRevenu(familleId),
      totalCharges: this.getTotalCharges(familleId),
      totalFactures: this.getTotalFactures(familleId),
      totalFacturesMois: this.getTotalFacturesMois(familleId),
      factureCount: this.getFactureCount(familleId),
      myRevenusMois: this.getMyRevenusMois(membreId),
      myDepensesMois: this.getMyDepensesMois(membreId),
      myRevenusAnnee: this.getMyRevenusAnnee(membreId),
      myDepensesAnnee: this.getMyDepensesAnnee(membreId),
      budget: this.getMyBudgetSummary(membreId),
    }).pipe(
      map(({ budget, ...rest }) => ({
        ...rest,
        // Flatten the BudgetSummary into the DashboardSummary view-model so
        // the home page doesn't need to know the endpoint layout.
        myBudget: budget.baseBudget,
        myCarryover: budget.carryover,
        myEffectiveBudget: budget.effectiveBudget,
        myRestAvivre: budget.restAvivre,
        myBudgetExhausted: budget.exhausted,
      })),
    );
  }

  /** Full budget snapshot for the logged-in member: base allowance,
   *  carryover from last month, effective budget for this month, depenses
   *  already booked, and the "reste à vivre". One round-trip to
   *  GET /membres/{id}/budget-summary. */
  getMyBudgetSummary(membreId: number): Observable<BudgetSummary> {
    const empty: BudgetSummary = {
      baseBudget: 0, carryover: 0, effectiveBudget: 0,
      depensesMois: 0, restAvivre: 0, exhausted: false,
    };
    if (!membreId) return of(empty);
    return this.http
      .get<BudgetSummary>(`${this.baseUrl}/membres/${membreId}/budget-summary`)
      .pipe(catchError(this.fallback(empty)));
  }

  /** Revenus du membre connecté pour le mois en cours. */
  getMyRevenusMois(membreId: number): Observable<number> {
    if (!membreId) return of(0);
    return this.http
      .get<number>(`${this.baseUrl}/revenus/membre/${membreId}/total/mois`)
      .pipe(catchError(this.fallback(0)));
  }

  /** Dépenses du membre = charges + factures du mois en cours. */
  getMyDepensesMois(membreId: number): Observable<number> {
    if (!membreId) return of(0);
    return forkJoin({
      charges: this.http
        .get<number>(`${this.baseUrl}/charges/membre/${membreId}/total/mois`)
        .pipe(catchError(this.fallback(0))),
      factures: this.http
        .get<number>(`${this.baseUrl}/factures/membre/${membreId}/total/mois`)
        .pipe(catchError(this.fallback(0))),
    }).pipe(map(({ charges, factures }) => (charges || 0) + (factures || 0)));
  }

  /** Revenus du membre connecté pour l'année en cours. */
  getMyRevenusAnnee(membreId: number): Observable<number> {
    if (!membreId) return of(0);
    return this.http
      .get<number>(`${this.baseUrl}/revenus/membre/${membreId}/total/annee`)
      .pipe(catchError(this.fallback(0)));
  }

  /** Dépenses du membre = charges + factures pour l'année en cours. */
  getMyDepensesAnnee(membreId: number): Observable<number> {
    if (!membreId) return of(0);
    return forkJoin({
      charges: this.http
        .get<number>(`${this.baseUrl}/charges/membre/${membreId}/total/annee`)
        .pipe(catchError(this.fallback(0))),
      factures: this.http
        .get<number>(`${this.baseUrl}/factures/membre/${membreId}/total/annee`)
        .pipe(catchError(this.fallback(0))),
    }).pipe(map(({ charges, factures }) => (charges || 0) + (factures || 0)));
  }

  getFamilleName(familleId: number): Observable<string> {
    // Always hit the backend so a renamed family is reflected immediately.
    // Fall back to the session-cached name, then to an empty string if the
    // request fails (keeps the UI from blanking out completely).
    return this.http
      .get(`${this.baseUrl}/familles/nom/${familleId}`, { responseType: 'text' })
      .pipe(catchError(() => of(this.session.snapshot?.familleName ?? '')));
  }

  getTotalRevenuMois(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-revenu-mois/${familleId}`)
      .pipe(catchError(this.fallback(0)));
  }

  getTotalChargesMois(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-charges-mois/${familleId}`)
      .pipe(catchError(this.fallback(0)));
  }

  getRemainingBalanceMois(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/comptes/remaining-balance-mois/${familleId}`)
      .pipe(catchError(this.fallback(0)));
  }

  getTotalRevenu(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-revenu/${familleId}`)
      .pipe(catchError(this.fallback(0)));
  }

  getTotalCharges(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-charges/${familleId}`)
      .pipe(catchError(this.fallback(0)));
  }

  getTotalFactures(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-factures/${familleId}`)
      .pipe(catchError(this.fallback(0)));
  }

  /** Factures payées du mois en cours — utilisé par la carte KPI qui se
   *  remet à zéro à chaque nouveau mois. */
  getTotalFacturesMois(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/comptes/total-factures-mois/${familleId}`)
      .pipe(catchError(this.fallback(0)));
  }

  getFactureCount(familleId: number): Observable<number> {
    return this.http
      .get<number>(`${this.baseUrl}/factures/famille/${familleId}/count`)
      .pipe(catchError(this.fallback(0)));
  }

  private fallback<T>(defaultValue: T) {
    return (error: HttpErrorResponse) => {
      console.error('[DashboardService] request failed', error.status, error.url);
      return of(defaultValue);
    };
  }
}

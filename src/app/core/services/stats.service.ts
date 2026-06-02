import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { MonthlyStat, PieSlice } from '../models/stats.model';

/**
 * Wraps the backend `/dashboard/*` endpoints used by the four Statistiques
 * pages (Budget / Revenus / Charges / Factures). Every method takes the
 * `period` in months (3 / 6 / 12) and resolves `familleId` from the
 * authenticated session, so callers don't need to know it.
 */
/** Optional (year, month) anchor — when both are set, the backend uses
 *  that month as the end of the rolling window (1 = January … 12 =
 *  December). Pass undefined for both to keep the legacy "ending at the
 *  current month" behavior (still used by the home page projections). */
export interface MonthAnchor {
  year?: number;
  month?: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  // ── Revenus ────────────────────────────────────────────────────────────
  revenusMonthly(period: number, forward = false, anchor?: MonthAnchor): Observable<MonthlyStat[]> {
    return this.get<MonthlyStat[]>('/dashboard/revenus/monthly', period, [], forward, anchor);
  }
  revenusByCategory(period: number, anchor?: MonthAnchor): Observable<PieSlice[]> {
    return this.get<PieSlice[]>('/dashboard/revenus/by-category', period, [], false, anchor);
  }
  revenusByMember(period: number, anchor?: MonthAnchor): Observable<PieSlice[]> {
    return this.get<PieSlice[]>('/dashboard/revenus/by-member', period, [], false, anchor);
  }

  // ── Charges ────────────────────────────────────────────────────────────
  chargesMonthly(period: number, forward = false, anchor?: MonthAnchor): Observable<MonthlyStat[]> {
    return this.get<MonthlyStat[]>('/dashboard/charges/monthly', period, [], forward, anchor);
  }
  chargesByCategory(period: number, anchor?: MonthAnchor): Observable<PieSlice[]> {
    return this.get<PieSlice[]>('/dashboard/charges/by-category', period, [], false, anchor);
  }
  chargesByMember(period: number, anchor?: MonthAnchor): Observable<PieSlice[]> {
    return this.get<PieSlice[]>('/dashboard/charges/by-member', period, [], false, anchor);
  }

  // ── Factures ───────────────────────────────────────────────────────────
  facturesMonthly(period: number, forward = false, anchor?: MonthAnchor): Observable<MonthlyStat[]> {
    return this.get<MonthlyStat[]>('/dashboard/factures/monthly', period, [], forward, anchor);
  }
  facturesByCategory(period: number, anchor?: MonthAnchor): Observable<PieSlice[]> {
    return this.get<PieSlice[]>('/dashboard/factures/by-category', period, [], false, anchor);
  }
  facturesByMember(period: number, anchor?: MonthAnchor): Observable<PieSlice[]> {
    return this.get<PieSlice[]>('/dashboard/factures/by-member', period, [], false, anchor);
  }

  // ── Budget (cross-domain) ─────────────────────────────────────────────
  /** Allocated budget per member — one PieSlice per member. With a
   *  (year, month) anchor, only members whose budget was allocated for that
   *  month contribute; without it, the current allocation is returned. */
  budgetByMember(anchor?: MonthAnchor): Observable<PieSlice[]> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of([] as PieSlice[]);
    let params = new HttpParams().set('familleId', String(familleId));
    if (anchor?.year && anchor?.month) {
      params = params.set('year', String(anchor.year)).set('month', String(anchor.month));
    }
    return this.http
      .get<PieSlice[]>(`${this.baseUrl}/dashboard/budget/by-member`, { params })
      .pipe(catchError((err) => {
        console.error('[StatsService] budget/by-member failed', err);
        return of([] as PieSlice[]);
      }));
  }

  /** Spending per member (charges + factures) for the anchor month — or
   *  the current month when no anchor is supplied. */
  spendingByMember(anchor?: MonthAnchor): Observable<PieSlice[]> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of([] as PieSlice[]);
    let params = new HttpParams().set('familleId', String(familleId));
    if (anchor?.year && anchor?.month) {
      params = params.set('year', String(anchor.year)).set('month', String(anchor.month));
    }
    return this.http
      .get<PieSlice[]>(`${this.baseUrl}/dashboard/budget/spending-by-member`, { params })
      .pipe(catchError((err) => {
        console.error('[StatsService] budget/spending-by-member failed', err);
        return of([] as PieSlice[]);
      }));
  }

  // ── Internals ──────────────────────────────────────────────────────────
  private get<T>(path: string, period: number, fallback: T,
                 forward = false, anchor?: MonthAnchor): Observable<T> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of(fallback);
    let params = new HttpParams()
      .set('familleId', String(familleId))
      .set('period', String(period));
    // Only stamp the forward flag when set so we don't pollute back-compat
    // with the existing endpoints used by Statistiques pages.
    if (forward) params = params.set('forward', 'true');
    if (anchor?.year && anchor?.month) {
      params = params.set('year', String(anchor.year)).set('month', String(anchor.month));
    }
    return this.http.get<T>(`${this.baseUrl}${path}`, { params }).pipe(
      catchError((err) => {
        console.error(`[StatsService] ${path} failed`, err.status, err.url);
        return of(fallback);
      }),
    );
  }
}

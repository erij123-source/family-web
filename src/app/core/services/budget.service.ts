import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface MemberBudgetStatus {
  /** Monthly budget allocated by the admin (0 = unlimited / not set). */
  budget: number;
  /** Charges + factures of the current month. */
  spent: number;
  /** budget − spent, floored at 0. */
  remaining: number;
  /** True when adding `addedAmount` would push spent past budget.
   *  Always false when budget = 0 (treated as no limit). */
  wouldExceed(addedAmount: number): boolean;
}

/**
 * Centralised budget guard for charge/facture creation flows. Both modals
 * call `getStatus(membreId)` before persisting and bail out with the
 * standard "Budget dépassé" message when the new amount would push the
 * member past their monthly cap.
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getStatus(membreId: number): Observable<MemberBudgetStatus> {
    if (!membreId) return of(this.empty());
    return forkJoin({
      membre: this.http
        .get<{ budget?: number }>(`${this.baseUrl}/membres/${membreId}`)
        .pipe(catchError(() => of({ budget: 0 }))),
      charges: this.http
        .get<number>(`${this.baseUrl}/charges/membre/${membreId}/total/mois`)
        .pipe(catchError(() => of(0))),
      factures: this.http
        .get<number>(`${this.baseUrl}/factures/membre/${membreId}/total/mois`)
        .pipe(catchError(() => of(0))),
    }).pipe(
      map(({ membre, charges, factures }) => {
        const budget = Number(membre?.budget) || 0;
        const spent = (Number(charges) || 0) + (Number(factures) || 0);
        const remaining = Math.max(0, budget - spent);
        return {
          budget,
          spent,
          remaining,
          wouldExceed: (added: number) => budget > 0 && spent + Math.max(0, Number(added) || 0) > budget,
        } satisfies MemberBudgetStatus;
      }),
    );
  }

  private empty(): MemberBudgetStatus {
    return { budget: 0, spent: 0, remaining: 0, wouldExceed: () => false };
  }
}

/** Standard error message shared by both modals when the cap is hit. */
export const BUDGET_EXCEEDED_MSG = 'Budget dépassé — vous ne pouvez plus ajouter de dépenses.';

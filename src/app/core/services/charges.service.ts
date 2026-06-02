import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { Charge, ChargePayload } from '../models/charge.model';
import { Categorie } from '../models/categorie.model';
import { Membre } from '../models/membre.model';

@Injectable({ providedIn: 'root' })
export class ChargesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  constructor() {
    // Drop the compteId cache whenever the session is cleared (logout) so
    // the next login starts from a clean slate.
    this.session.changes.subscribe((s) => {
      if (!s) this.compteIdCache.clear();
    });
  }

  /**
   * compteId cache keyed by familleId.
   *
   * CRITICAL: this MUST be keyed by familleId. Earlier we cached the result
   * with a single `shareReplay(1)` observable, which persisted across
   * logout/login — so a new user reusing the same browser would receive the
   * previous user's compteId and therefore POST/GET charges against the
   * previous family's data. Keying by familleId means switching accounts
   * transparently picks up a fresh cache slot.
   */
  private compteIdCache = new Map<number, Observable<number>>();

  private getCompteId(): Observable<number> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) {
      return throwError(() => new Error('No familleId on session — please log in again.'));
    }
    const cached = this.compteIdCache.get(familleId);
    if (cached) return cached;
    const fresh = this.http
      .get<{ id: number }>(`${this.baseUrl}/familles/compte/${familleId}`)
      .pipe(map((c) => c.id), shareReplay(1));
    this.compteIdCache.set(familleId, fresh);
    return fresh;
  }

  /** All charges for the active family's compte. */
  list(): Observable<Charge[]> {
    return this.getCompteId().pipe(
      switchMap((compteId) => this.http.get<Charge[]>(`${this.baseUrl}/charges/compte/${compteId}`)),
      catchError((err) => {
        console.error('[ChargesService] list failed', err);
        return of([] as Charge[]);
      }),
    );
  }

  /** Members of the current family — used to populate the "Membre concerné" select. */
  listMembres(): Observable<Membre[]> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of([]);
    return this.http
      .get<Membre[]>(`${this.baseUrl}/membres/famille/${familleId}`)
      .pipe(catchError(() => of([] as Membre[])));
  }

  /** Categories of type CHARGE — used to populate the "Catégorie" select. */
  listCategories(): Observable<Categorie[]> {
    return this.http
      .get<Categorie[]>(`${this.baseUrl}/categories/type/CHARGE`)
      .pipe(catchError(() => of([] as Categorie[])));
  }

  /**
   * Resolve a category by name (case-insensitive), creating it on the fly
   * as a custom category for the current user if it doesn't exist yet.
   * Lets the frontend offer a fixed preset list (Loyer, Électricité, …)
   * plus a free-form "Autre" option, without requiring the DB to be
   * pre-seeded with exactly those names.
   */
  ensureCategoryByName(name: string): Observable<Categorie> {
    const userId = this.session.snapshot?.userId;
    if (!userId) return throwError(() => new Error('No active session.'));
    const clean = name.trim();
    if (!clean) return throwError(() => new Error('Nom de catégorie vide.'));
    return this.listCategories().pipe(
      switchMap((list) => {
        const existing = list.find(
          (c) => (c.name || '').toLowerCase() === clean.toLowerCase(),
        );
        if (existing) return of(existing);
        return this.http.post<Categorie>(
          `${this.baseUrl}/categories/custom/${userId}`,
          { name: clean, type: 'CHARGE' },
        );
      }),
    );
  }

  /** Create a charge. The caller provides everything except the compte id,
   *  which we inject from the current session. */
  add(payload: Omit<ChargePayload, 'compte'>): Observable<Charge> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        this.http.post<Charge>(`${this.baseUrl}/charges/add`, {
          ...payload,
          compte: { id: compteId },
        } satisfies ChargePayload),
      ),
    );
  }

  /** Update an existing charge. */
  edit(id: number, payload: Omit<ChargePayload, 'compte'>): Observable<Charge> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        this.http.put<Charge>(`${this.baseUrl}/charges/edit/${id}`, {
          ...payload,
          compte: { id: compteId },
        } satisfies ChargePayload),
      ),
    );
  }

  /** Delete a charge. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/charges/delete/${id}`);
  }
}

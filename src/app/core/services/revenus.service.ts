import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { Revenu, RevenuDTO, RevenuPayload } from '../models/revenu.model';
import { Categorie } from '../models/categorie.model';
import { Membre } from '../models/membre.model';

@Injectable({ providedIn: 'root' })
export class RevenusService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  constructor() {
    // See ChargesService — wipe the compteId cache on logout so the next
    // login cannot inherit the previous session's compteId.
    this.session.changes.subscribe((s) => {
      if (!s) this.compteIdCache.clear();
    });
  }

  /**
   * compteId cache keyed by familleId — see ChargesService for the full
   * rationale. A single `shareReplay(1)` leaks data across accounts when
   * the same browser is reused by different users.
   */
  private compteIdCache = new Map<number, Observable<number>>();

  private getCompteId(): Observable<number> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return throwError(() => new Error('No familleId on session.'));
    const cached = this.compteIdCache.get(familleId);
    if (cached) return cached;
    const fresh = this.http
      .get<{ id: number }>(`${this.baseUrl}/familles/compte/${familleId}`)
      .pipe(map((c) => c.id), shareReplay(1));
    this.compteIdCache.set(familleId, fresh);
    return fresh;
  }

  /**
   * List revenus for the current family's compte.
   *
   * Uses the server-side-filtered endpoint `/revenus/compte/{compteId}` so
   * we never miss a freshly-saved revenu whose `compte` relation came back
   * partially populated in the JSON (which would silently exclude it from
   * a client-side filter). The REVENU categories list is fetched in
   * parallel and merged in to fill `categorieName` from `categorieId` when
   * the backend DTO only carries the id.
   */
  list(): Observable<RevenuDTO[]> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        forkJoin({
          revenus: this.http.get<RevenuDTO[]>(`${this.baseUrl}/revenus/compte/${compteId}`),
          categories: this.listCategories(),
        }).pipe(
          map(({ revenus, categories }) => {
            const catsById = new Map(categories.map((c) => [c.id, c.name]));
            return (revenus || []).map((r) => ({
              ...r,
              categorieName:
                r.categorieName ||
                (r.categorieId != null ? catsById.get(r.categorieId) : undefined),
            }));
          }),
        ),
      ),
      catchError((err) => {
        console.error('[RevenusService] list failed', err);
        return of([] as RevenuDTO[]);
      }),
    );
  }

  /** Members of the current family, used for the "Membre" select. */
  listMembres(): Observable<Membre[]> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of([]);
    return this.http
      .get<Membre[]>(`${this.baseUrl}/membres/famille/${familleId}`)
      .pipe(catchError(() => of([] as Membre[])));
  }

  /** Categories of type REVENU, used for the "Type de revenu" select. */
  listCategories(): Observable<Categorie[]> {
    return this.http
      .get<Categorie[]>(`${this.baseUrl}/categories/type/REVENU`)
      .pipe(catchError(() => of([] as Categorie[])));
  }

  /** Lookup or create (as a custom category) a REVENU category by name.
   *  Mirrors ChargesService.ensureCategoryByName but for the REVENU type. */
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
          { name: clean, type: 'REVENU' },
        );
      }),
    );
  }

  add(payload: Omit<RevenuPayload, 'compte'>): Observable<Revenu> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        this.http.post<Revenu>(`${this.baseUrl}/revenus/ajouter`, {
          ...payload,
          compte: { id: compteId },
        } satisfies RevenuPayload),
      ),
    );
  }

  edit(id: number, payload: Omit<RevenuPayload, 'compte'>): Observable<Revenu> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        this.http.put<Revenu>(`${this.baseUrl}/revenus/edit/${id}`, {
          ...payload,
          compte: { id: compteId },
        } satisfies RevenuPayload),
      ),
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/revenus/delete/${id}`);
  }
}

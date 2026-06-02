import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { Facture, FacturePayload } from '../models/facture.model';
import { Categorie } from '../models/categorie.model';
import { Membre } from '../models/membre.model';

@Injectable({ providedIn: 'root' })
export class FacturesService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  constructor() {
    // Wipe the compteId cache on logout so the next login doesn't inherit
    // the previous session's account.
    this.session.changes.subscribe((s) => {
      if (!s) this.compteIdCache.clear();
    });
  }

  /** compteId cache keyed by familleId (same pattern as Charges / Revenus
   *  services — see there for the cross-tenant-safety rationale). */
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

  /**
   * List factures for the current family's compte.
   *
   * We fetch full Facture entities from `/factures` (not a dedicated DTO
   * endpoint) and filter by compteId client-side. This lets us project the
   * Categorie.name and Membre.user fields directly, matching the Revenus
   * service pattern. The FACTURE categories list is fetched in parallel so
   * the category label is always populated — even when a freshly-saved
   * facture returns with a partially-loaded relation.
   */
  list(): Observable<Facture[]> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        forkJoin({
          all: this.http.get<any[]>(`${this.baseUrl}/factures`),
          categories: this.listCategories(),
        }).pipe(
          map(({ all, categories }) => {
            const catsById = new Map(
              categories.map((c) => [c.id, { name: c.name, type: c.type }]),
            );
            return (all || [])
              .filter((f) => f?.compte?.id === compteId)
              .map((f) => this.enrichCategorie(f, catsById));
          }),
        ),
      ),
      catchError((err) => {
        console.error('[FacturesService] list failed', err);
        return of([] as Facture[]);
      }),
    );
  }

  /** Members of the current family — used for the "Membre" select. */
  listMembres(): Observable<Membre[]> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) return of([]);
    return this.http
      .get<Membre[]>(`${this.baseUrl}/membres/famille/${familleId}`)
      .pipe(catchError(() => of([] as Membre[])));
  }

  /** Categories of type FACTURE — used to populate the category select. */
  listCategories(): Observable<Categorie[]> {
    return this.http
      .get<Categorie[]>(`${this.baseUrl}/categories/type/FACTURE`)
      .pipe(catchError(() => of([] as Categorie[])));
  }

  /**
   * Resolve a FACTURE category by name (case-insensitive), creating it as a
   * custom category for the current user if missing. Mirrors the approach
   * used by Charges and Revenus.
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
          { name: clean, type: 'FACTURE' },
        );
      }),
    );
  }

  /** Create a facture. Compte id is injected from the current session. */
  add(payload: Omit<FacturePayload, 'compte'>): Observable<Facture> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        this.http.post<Facture>(`${this.baseUrl}/factures/add`, {
          ...payload,
          compte: { id: compteId },
        } satisfies FacturePayload),
      ),
    );
  }

  /** Update an existing facture. */
  edit(id: number, payload: Omit<FacturePayload, 'compte'>): Observable<Facture> {
    return this.getCompteId().pipe(
      switchMap((compteId) =>
        this.http.put<Facture>(`${this.baseUrl}/factures/edit/${id}`, {
          ...payload,
          compte: { id: compteId },
        } satisfies FacturePayload),
      ),
    );
  }

  /** Mark a facture as paid. */
  markAsPaid(id: number): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/factures/mark-as-paid/${id}`, null);
  }

  /** Delete a facture. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/factures/delete/${id}`);
  }

  /** Upload du fichier de facture (PDF/image) en multipart vers
   *  /factures/upload/{id}. Le backend écrit le fichier sur disque, stocke
   *  un chemin court dans Facture.fileUrl et le nom original dans fileName. */
  uploadFile(factureId: number, file: File): Observable<Facture> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<Facture>(`${this.baseUrl}/factures/upload/${factureId}`, form);
  }

  // ── Internals ──────────────────────────────────────────────────────────
  /** Fill the categorie.name from the categories map when the entity was
   *  returned with only a partial categorie object. */
  private enrichCategorie(f: any, catsById: Map<number, { name: string; type?: string }>): Facture {
    const catId = f?.categorie?.id;
    const catName = f?.categorie?.name || (catId != null ? catsById.get(catId)?.name : undefined);
    return {
      ...f,
      categorie: catId != null ? { id: catId, name: catName, type: 'FACTURE' } : undefined,
    };
  }
}

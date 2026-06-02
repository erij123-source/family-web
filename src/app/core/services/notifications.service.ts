import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { NotificationDTO, NotificationPayload } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  /** Liste des notifications du MEMBRE connecté pour le mois courant.
   *  Chaque membre ne voit que ses propres notifications — l'historique
   *  est vidé chaque 1er du mois côté backend (filtre + scheduler). */
  list(): Observable<NotificationDTO[]> {
    const membreId = this.session.snapshot?.membreId;
    if (!membreId) return of([]);
    return this.http
      .get<NotificationDTO[]>(`${this.baseUrl}/notifications/membre/${membreId}`)
      .pipe(catchError((err) => {
        console.error('[NotificationsService] list failed', err);
        return of([] as NotificationDTO[]);
      }));
  }

  /** Non-lues du membre connecté — pour le badge dans le header/sidebar. */
  countUnread(): Observable<number> {
    const membreId = this.session.snapshot?.membreId;
    if (!membreId) return of(0);
    return this.http
      .get<number>(`${this.baseUrl}/notifications/membre/${membreId}/unread-count`)
      .pipe(catchError(() => of(0)));
  }

  add(payload: Omit<NotificationPayload, 'famille'>): Observable<NotificationDTO> {
    const familleId = this.session.snapshot?.familleId ?? 0;
    return this.http.post<NotificationDTO>(
      `${this.baseUrl}/notifications`,
      { ...payload, famille: { id: familleId } } satisfies NotificationPayload,
    );
  }

  setRead(id: number, read: boolean): Observable<NotificationDTO> {
    return this.http.put<NotificationDTO>(
      `${this.baseUrl}/notifications/${id}/read?read=${read}`,
      null,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/notifications/${id}`);
  }

  markAllRead(): Observable<number> {
    const membreId = this.session.snapshot?.membreId ?? 0;
    return this.http
      .put<number>(`${this.baseUrl}/notifications/membre/${membreId}/mark-all-read`, null)
      .pipe(catchError(() => of(0)));
  }

  clearRead(): Observable<number> {
    const membreId = this.session.snapshot?.membreId ?? 0;
    return this.http
      .delete<number>(`${this.baseUrl}/notifications/membre/${membreId}/clear-read`)
      .pipe(catchError(() => of(0)));
  }

  /**
   * Demande au backend de scanner l'état courant de la famille (budgets,
   * factures…) et de créer les notifications manquantes pour chaque membre.
   * Idempotent — ne duplique pas un titre déjà présent (mois courant).
   */
  generate(): Observable<number> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) {
      console.warn('[NotificationsService] generate: no familleId on session');
      return of(0);
    }
    return this.http
      .post<number>(`${this.baseUrl}/notifications/famille/${familleId}/generate`, null)
      .pipe(catchError((err) => {
        console.error('[NotificationsService] generate FAILED', err.status, err.url, err.message);
        return of(0);
      }));
  }

  /** Raccourci fire-and-forget après une mutation (charge/facture/budget). */
  refreshFromOtherPage(): void {
    this.generate().subscribe({
      next: (n) => { if (n > 0) console.log('[NotificationsService] auto-generated', n, 'notification(s)'); },
      error: (err) => console.warn('[NotificationsService] auto-generate failed', err),
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, firstValueFrom, map, of, switchMap, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SessionService } from './session.service';
import { User } from '../models/user.model';
import { Famille } from '../models/famille.model';
import { Membre, MembreRole } from '../models/membre.model';
import {
  AddMemberRequest,
  AuthSession,
  CreateFamilyRequest,
  ForgotPasswordRequest,
  JwtResponse,
  LoginRequest,
  RegisterUserRequest,
  ResetPasswordRequest,
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = environment.apiBaseUrl;

  // ─── Login ────────────────────────────────────────────────────────────
  /**
   * Authenticates, then resolves userId + familleId (+ membreId/role) so the
   * rest of the app can operate from a fully populated session. Fails loudly
   * if any step breaks so the UI can surface the error.
   */
  login(credentials: LoginRequest): Observable<AuthSession> {
    return this.http.post<JwtResponse>(`${this.baseUrl}/authentification/login`, credentials).pipe(
      switchMap((jwt) => this.hydrateSession(jwt, credentials.username)),
      tap((session) => this.session.save(session)),
      catchError(this.rethrow),
    );
  }

  // ─── Registration: family + admin user ────────────────────────────────
  /**
   * Step 1 of the registration wizard. Delegates to the atomic backend
   * endpoint `/authentification/register-family`, which creates user +
   * famille + compte + membre + admin inside a single @Transactional — so
   * either everything succeeds or nothing persists.
   */
  registerFamily(request: CreateFamilyRequest): Observable<AuthSession> {
    const url = `${this.baseUrl}/authentification/register-family`;
    console.log('[AuthService] POST', url, {
      familyName: request.familyName,
      adminUsername: request.admin.username,
    });
    return this.http
      .post<{
        token: string;
        refreshToken: string;
        userId: number;
        username: string;
        familleId: number;
        familleName: string;
        membreId: number;
        role: MembreRole;
      }>(url, request)
      .pipe(
        map((res) => ({
          token: res.token,
          refreshToken: res.refreshToken,
          username: res.username,
          userId: res.userId,
          // Carry over the admin info from the submitted request so the
          // header avatar + profile modal can show them immediately,
          // without waiting for a second round-trip to /users/{id}.
          firstName: request.admin.firstName,
          lastName: request.admin.lastName,
          phone: request.admin.phone,
          familleId: res.familleId,
          familleName: res.familleName,
          membreId: res.membreId,
          role: res.role,
        })),
        tap((session) => this.session.save(session)),
        catchError(this.rethrow),
      );
  }

  // ─── Registration: additional member ──────────────────────────────────
  /** Step 2 of the registration wizard. Requires an existing session. */
  addMember(request: AddMemberRequest): Observable<Membre> {
    const familleId = this.session.snapshot?.familleId;
    if (!familleId) {
      return throwError(() => new Error('No active family session — cannot add member.'));
    }
    return this.createUser(request.user).pipe(
      switchMap((user) => this.createMembre(user.id, familleId, request.role)),
      catchError(this.rethrow),
    );
  }

  // ─── Password recovery ────────────────────────────────────────────────
  forgotPassword(phoneNumber: string): Observable<string> {
    const body: ForgotPasswordRequest = { phoneNumber };
    return this.http
      .post(`${this.baseUrl}/authentification/forgot-password`, body, { responseType: 'text' })
      .pipe(catchError(this.rethrow));
  }

  resetPassword(code: string, newPassword: string): Observable<string> {
    const body: ResetPasswordRequest = { code, newPassword };
    return this.http
      .post(`${this.baseUrl}/authentification/reset-password`, body, { responseType: 'text' })
      .pipe(catchError(this.rethrow));
  }

  // ─── OTP (phone verification) ─────────────────────────────────────────
  sendOtp(phone: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/otp/send`, { phone }).pipe(
      catchError(this.rethrow),
    );
  }

  verifyOtp(phone: string, code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/otp/verify`, { phone, code }).pipe(
      catchError(this.rethrow),
    );
  }

  // ─── Profile edit ─────────────────────────────────────────────────────
  /**
   * Updates the current user's profile through the existing
   * `PUT /users/edit-profile/{id}` endpoint and syncs the session cache so
   * the avatar/name in the header updates immediately.
   */
  updateProfile(patch: {
    firstName: string;
    lastName: string;
    phone?: string;
    username?: string;
  }): Observable<User> {
    const current = this.session.snapshot;
    if (!current) return throwError(() => new Error('No active session.'));
    const body = {
      firstName: patch.firstName,
      lastName: patch.lastName,
      phone: patch.phone,
      // Keep the existing username unless the caller really wants to change it.
      username: patch.username ?? current.username,
    };
    return this.http
      .put<User>(`${this.baseUrl}/users/edit-profile/${current.userId}`, body)
      .pipe(
        tap((updated) =>
          this.session.update({
            firstName: updated.firstName,
            lastName: updated.lastName,
            phone: updated.phone,
            username: updated.username,
          }),
        ),
        catchError(this.rethrow),
      );
  }

  // ─── Logout ───────────────────────────────────────────────────────────
  logout(): Observable<void> {
    const username = this.session.snapshot?.username;
    this.session.clear();
    if (!username) return of(void 0);
    return this.http
      .post<void>(`${this.baseUrl}/users/logout/${encodeURIComponent(username)}`, null)
      .pipe(catchError(() => of(void 0)));
  }

  // ─── Internals ────────────────────────────────────────────────────────
  private hydrateSession(jwt: JwtResponse, username: string): Observable<AuthSession> {
    return this.getUserByUsername(username).pipe(
      switchMap((user) =>
        this.getMembreByUser(user.id).pipe(
          map((membre) => ({
            token: jwt.token,
            refreshToken: jwt.refreshToken,
            username: user.username,
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            familleId: membre?.famille?.id ?? 0,
            // Membre's @ManyToOne Famille is serialized inline, so the name
            // comes along for free — no extra round-trip to /familles/nom.
            familleName: (membre?.famille as { name?: string } | undefined)?.name,
            membreId: membre?.id,
            role: membre?.role,
            // Restore the previously-uploaded avatar for this userId if we
            // still have it on this device — otherwise it stays undefined
            // and the header falls back to initials.
            avatarDataUrl: typeof localStorage !== 'undefined'
              ? localStorage.getItem(`avatar_${user.id}`) ?? undefined
              : undefined,
          })),
        ),
      ),
    );
  }

  private getUserByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/username/${encodeURIComponent(username)}`);
  }

  private getMembreByUser(userId: number): Observable<Membre | null> {
    return this.http.get<Membre>(`${this.baseUrl}/membres/user/${userId}`).pipe(
      catchError((err: HttpErrorResponse) => (err.status === 404 ? of(null) : throwError(() => err))),
    );
  }

  private createUser(user: RegisterUserRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/users/register`, user);
  }

  private createFamille(name: string, creatorId: number): Observable<Famille> {
    const body: Partial<Famille> = { name, creator: { id: creatorId } };
    return this.http.post<Famille>(`${this.baseUrl}/familles`, body);
  }

  private createCompte(familleId: number): Observable<unknown> {
    const body = { famille: { id: familleId } };
    return this.http.post(`${this.baseUrl}/comptes`, body);
  }

  private createMembre(userId: number, familleId: number, role: MembreRole): Observable<Membre> {
    const body: Partial<Membre> = {
      user: { id: userId },
      famille: { id: familleId },
      role,
    };
    return this.http.post<Membre>(`${this.baseUrl}/membres`, body);
  }

  private rethrow = (err: HttpErrorResponse) => {
    // Print the body inline so the developer console isn't hiding it
    // behind a collapsed "Object" preview.
    const body = err.error;
    const bodyStr =
      typeof body === 'string' ? body : body == null ? '<empty>' : JSON.stringify(body, null, 2);
    console.error(`[AuthService] ${err.status} ${err.url}\n${bodyStr}`);
    return throwError(() => err);
  };
}

// Convenience for places that prefer Promises over Observables.
export const toPromise = <T>(obs: Observable<T>): Promise<T> => firstValueFrom(obs);

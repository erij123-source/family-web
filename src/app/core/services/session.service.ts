import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { AuthSession } from '../models/auth.model';
import { MembreRole } from '../models/membre.model';

// Keys owned by the session layer. Everything else that previously wrote to
// localStorage (e.g. the dashboard component) reads via this service.
const KEYS = {
  token: 'token',
  refreshToken: 'refreshToken',
  username: 'username',
  userId: 'userId',
  firstName: 'firstName',
  lastName: 'lastName',
  phone: 'phone',
  familleId: 'familleId',
  familleName: 'familleName',
  membreId: 'membreId',
  role: 'role',
} as const;

// Avatars live under a per-user key so that a logout does not erase them —
// the photo is local-device-only and should persist for that user across
// login/logout cycles on the same browser. Distinct users on the same
// browser each keep their own avatar.
function avatarKey(userId: number): string {
  return `avatar_${userId}`;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly session$ = new BehaviorSubject<AuthSession | null>(this.readFromStorage());

  get snapshot(): AuthSession | null {
    return this.session$.value;
  }

  get changes(): Observable<AuthSession | null> {
    return this.session$.asObservable();
  }

  get token(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEYS.token) : null;
  }

  get refreshToken(): string | null {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEYS.refreshToken) : null;
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  save(session: AuthSession): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEYS.token, session.token);
    localStorage.setItem(KEYS.refreshToken, session.refreshToken);
    localStorage.setItem(KEYS.username, session.username);
    localStorage.setItem(KEYS.userId, String(session.userId));
    localStorage.setItem(KEYS.familleId, String(session.familleId));
    if (session.firstName) localStorage.setItem(KEYS.firstName, session.firstName);
    if (session.lastName) localStorage.setItem(KEYS.lastName, session.lastName);
    if (session.phone) localStorage.setItem(KEYS.phone, session.phone);
    if (session.familleName) localStorage.setItem(KEYS.familleName, session.familleName);
    if (session.membreId != null) localStorage.setItem(KEYS.membreId, String(session.membreId));
    if (session.role) localStorage.setItem(KEYS.role, session.role);
    // Avatar is persisted under avatar_<userId>, not with the main session
    // keys, so logout() can clear the session without destroying the photo.
    if (session.userId != null) {
      const key = avatarKey(session.userId);
      if (session.avatarDataUrl) {
        localStorage.setItem(key, session.avatarDataUrl);
      } else {
        localStorage.removeItem(key);
      }
    }
    this.session$.next(session);
  }

  /** Patch a subset of fields without overwriting the rest. */
  update(patch: Partial<AuthSession>): void {
    const current = this.session$.value;
    if (!current) return;
    this.save({ ...current, ...patch });
  }

  updateTokens(token: string, refreshToken: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(KEYS.token, token);
    localStorage.setItem(KEYS.refreshToken, refreshToken);
    const current = this.session$.value;
    if (current) this.session$.next({ ...current, token, refreshToken });
  }

  clear(): void {
    if (typeof localStorage === 'undefined') return;
    // Only wipe the main session keys — avatar_<userId> entries are
    // intentionally preserved so users get their photo back on re-login.
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    this.session$.next(null);
  }

  private readFromStorage(): AuthSession | null {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem(KEYS.token);
    const refreshToken = localStorage.getItem(KEYS.refreshToken);
    const username = localStorage.getItem(KEYS.username);
    const userId = Number(localStorage.getItem(KEYS.userId));
    const familleId = Number(localStorage.getItem(KEYS.familleId));
    if (!token || !refreshToken || !username || !userId || !familleId) return null;

    const membreIdRaw = localStorage.getItem(KEYS.membreId);
    const roleRaw = localStorage.getItem(KEYS.role) as MembreRole | null;
    const familleName = localStorage.getItem(KEYS.familleName) ?? undefined;
    const firstName = localStorage.getItem(KEYS.firstName) ?? undefined;
    const lastName = localStorage.getItem(KEYS.lastName) ?? undefined;
    const phone = localStorage.getItem(KEYS.phone) ?? undefined;
    const avatarDataUrl = localStorage.getItem(avatarKey(userId)) ?? undefined;
    return {
      token,
      refreshToken,
      username,
      userId,
      firstName,
      lastName,
      phone,
      familleId,
      familleName,
      membreId: membreIdRaw ? Number(membreIdRaw) : undefined,
      role: roleRaw ?? undefined,
      avatarDataUrl,
    };
  }
}

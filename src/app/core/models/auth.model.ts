import { MembreRole } from './membre.model';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface JwtResponse {
  token: string;
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  phoneNumber: string;
}

export interface ResetPasswordRequest {
  code: string;
  newPassword: string;
}

export interface RegisterUserRequest {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface CreateFamilyRequest {
  familyName: string;
  admin: RegisterUserRequest;
}

export interface AddMemberRequest {
  user: RegisterUserRequest;
  role: MembreRole;
}

// Session cached in localStorage after login / register.
export interface AuthSession {
  token: string;
  refreshToken: string;
  username: string;
  userId: number;
  firstName?: string;
  lastName?: string;
  phone?: string;
  familleId: number;
  familleName?: string;
  membreId?: number;
  role?: MembreRole;
  /** Base64 data URL. Client-side only — not persisted to the backend. */
  avatarDataUrl?: string;
}

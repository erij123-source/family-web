import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ChatResponse {
  reply: string;
}

export interface ChatTurn {
  role: 'user' | 'bot';
  text: string;
}

/**
 * Talks to the backend `/chat` relay, which forwards the message to Gemini
 * Flash. The JWT is attached automatically by the auth interceptor since the
 * URL targets environment.apiBaseUrl.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  ask(
    message: string,
    history: ChatTurn[] = [],
    familleId?: number,
    membreId?: number,
    username?: string,
  ): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, {
      message,
      history,
      familleId,
      membreId,
      username,
    });
  }
}

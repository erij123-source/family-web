import {
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  ViewEncapsulation,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { ChatService } from '../../core/services/chat.service';
import { SessionService } from '../../core/services/session.service';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './assistant.component.html',
})
export class AssistantComponent {
  private readonly chat = inject(ChatService);
  private readonly zone = inject(NgZone);
  private readonly session = inject(SessionService);

  @ViewChild('msgsContainer') private msgsContainer?: ElementRef<HTMLElement>;

  private static readonly STORAGE_KEY = 'fb_assistant_chat';

  readonly messages = signal<ChatMessage[]>(this.loadMessages());
  readonly typing = signal(false);
  readonly recording = signal(false);
  draft = '';

  private recognition: any;

  // Persiste la conversation pour qu'elle survive aux changements de page / rechargements.
  private readonly persist = effect(() => this.saveMessages(this.messages()));

  // ─── Sending ──────────────────────────────────────────────────────────
  send(): void {
    const text = this.draft.trim();
    if (!text || this.typing()) {
      return;
    }

    // Prior turns (before adding the new message) so the assistant has memory.
    const history = this.messages().map((m) => ({
      role: (m.sender === 'user' ? 'user' : 'bot') as 'user' | 'bot',
      text: m.text,
    }));

    this.push({ sender: 'user', text, time: this.now() });
    this.draft = '';
    this.typing.set(true);
    this.scrollToBottom();

    const snap = this.session.snapshot;
    this.chat.ask(text, history, snap?.familleId, snap?.membreId, snap?.username).subscribe({
      next: (res) => {
        this.typing.set(false);
        this.push({ sender: 'bot', text: res.reply, time: this.now() });
        this.scrollToBottom();
      },
      error: () => {
        this.typing.set(false);
        this.push({
          sender: 'bot',
          text: "Désolé, une erreur est survenue. Réessayez dans un instant.",
          time: this.now(),
        });
        this.scrollToBottom();
      },
    });
  }

  /** Suggestion buttons: fill the input with the question and send it. */
  ask(question: string): void {
    this.draft = question;
    this.send();
  }

  clearChat(): void {
    this.messages.set([this.greeting()]);
    this.draft = '';
  }

  // ─── Input handlers ───────────────────────────────────────────────────
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  autoGrow(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 110) + 'px';
  }

  // ─── Voice input (Web Speech API, optional / feature-detected) ─────────
  toggleMic(): void {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      this.botSay(
        "🎤 La reconnaissance vocale n'est pas supportée par ce navigateur. " +
          'Utilisez Google Chrome ou Edge, ou tapez votre message.',
      );
      return;
    }

    // Already recording → stop it.
    if (this.recording()) {
      try {
        this.recognition?.stop();
      } catch {
        /* ignore */
      }
      this.recording.set(false);
      return;
    }

    const rec = new SR();
    this.recognition = rec;
    rec.lang = 'fr-FR';
    rec.continuous = true; // reste actif jusqu'au clic d'arrêt
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';
    let gotAnything = false;

    rec.onstart = () => console.log('[mic] start');
    rec.onaudiostart = () => console.log('[mic] audiostart (micro capte de l audio)');
    rec.onspeechstart = () => console.log('[mic] speechstart (voix detectee)');
    rec.onresult = (e: any) => {
      gotAnything = true;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          finalText += t + ' ';
        } else {
          interim += t;
        }
      }
      console.log('[mic] result =>', (finalText + interim).trim());
      this.zone.run(() => {
        this.draft = (finalText + interim).trim();
      });
    };
    rec.onerror = (e: any) =>
      this.zone.run(() => {
        console.error('[mic] error =>', e?.error);
        this.recording.set(false);
        const code = e?.error ?? 'inconnue';
        this.botSay(
          code === 'not-allowed' || code === 'service-not-allowed'
            ? "🎤 Accès au micro refusé. Clique sur l'icône caméra/micro dans la barre d'adresse, autorise le micro, et ouvre l'app via http://localhost."
            : code === 'no-speech'
              ? "🎤 Je n'ai rien entendu. Vérifie que le bon micro est actif et parle plus fort."
              : `🎤 Erreur micro : ${code}. Réessaie ou tape ton message.`,
        );
      });
    rec.onend = () =>
      this.zone.run(() => {
        console.log('[mic] end (gotAnything=' + gotAnything + ')');
        this.recording.set(false);
        if (!gotAnything) {
          this.botSay(
            "🎤 Micro arrêté — rien capté. Vérifie l'autorisation micro (icône dans la barre d'adresse) et que ton micro système fonctionne.",
          );
        }
      });

    try {
      this.recording.set(true);
      rec.start();
      this.botSay("🎤 J'écoute… parle, puis reclique le micro pour arrêter.");
    } catch (err) {
      console.error('[mic] start failed', err);
      this.recording.set(false);
      this.botSay('🎤 Impossible de démarrer le micro. Réessaie.');
    }
  }

  private botSay(text: string): void {
    this.push({ sender: 'bot', text, time: this.now() });
    this.scrollToBottom();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  private push(message: ChatMessage): void {
    this.messages.update((list) => [...list, message]);
  }

  private greeting(): ChatMessage {
    return {
      sender: 'bot',
      text:
        "Bonjour ! 👋 Je suis votre assistant IA pour la gestion budgétaire familiale. " +
        "Posez-moi vos questions sur vos revenus, charges, factures, épargne ou objectifs.",
      time: this.now(),
    };
  }

  private now(): string {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.msgsContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  private loadMessages(): ChatMessage[] {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(AssistantComponent.STORAGE_KEY)
          : null;
      if (raw) {
        const arr = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(arr) && arr.length) {
          return arr;
        }
      }
    } catch {
      /* ignore */
    }
    return [this.greeting()];
  }

  private saveMessages(msgs: ChatMessage[]): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AssistantComponent.STORAGE_KEY, JSON.stringify(msgs));
      }
    } catch {
      /* ignore */
    }
  }
}

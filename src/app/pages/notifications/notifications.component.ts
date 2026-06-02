import {
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { NotificationsService } from '../../core/services/notifications.service';
import {
  NotificationDTO,
  NotificationKind,
  NotificationSeverity,
} from '../../core/models/notification.model';

// UI-only enrichments derived from the persisted notification.
type NotifGroup = 'today' | 'yesterday' | 'older';

interface NotifVM extends NotificationDTO {
  /** Lower-case alias of `kind` used by the template's NgClass calls. */
  kindLower: 'reminder' | 'alert' | 'suggestion';
  severityLower: 'critical' | 'warning' | 'info' | 'suggestion';
  /** Bucket (today / yesterday / older) computed from createdAt. */
  group: NotifGroup;
  /** Human-readable timestamp shown in the card. */
  time: string;
}

type KindFilter = 'all' | 'REMINDER' | 'ALERT' | 'UNREAD';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent implements OnInit {

  private readonly notifService = inject(NotificationsService);

  notifs: NotifVM[] = [];
  loading = false;
  errorMsg = '';
  checking = false;
  lastCheckMsg = '';

  // ── Toolbar state ──────────────────────────────────────────────
  filter: KindFilter = 'all';
  search = '';
  setFilter(f: KindFilter): void { this.filter = f; }

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading = true;
    this.errorMsg = '';
    // Trigger backend auto-generation first (budgets, factures dues, etc.)
    // then fetch the up-to-date list. Generation never throws — even if it
    // fails we still display whatever's in the DB.
    this.notifService.generate().subscribe(() => this.fetchList());
  }

  /** Manual "Vérifier maintenant" — runs the scan and reports the result
   *  inline so the user knows whether the backend produced anything. */
  checkNow(): void {
    if (this.checking) return;
    this.checking = true;
    this.lastCheckMsg = '';
    this.notifService.generate().subscribe({
      next: (n) => {
        this.checking = false;
        this.lastCheckMsg = n > 0
          ? `${n} nouvelle${n > 1 ? 's' : ''} notification${n > 1 ? 's' : ''} créée${n > 1 ? 's' : ''}.`
          : 'Aucune nouvelle condition détectée. Tout est à jour.';
        this.fetchList();
        setTimeout(() => (this.lastCheckMsg = ''), 4000);
      },
      error: (err) => {
        this.checking = false;
        this.lastCheckMsg = `Erreur backend (${err?.status ?? '?'}). Vérifiez que STS est démarré.`;
        console.error('[Notifications] checkNow failed', err);
      },
    });
  }

  private fetchList(): void {
    this.notifService.list().subscribe({
      next: (list) => {
        this.notifs = (list || []).map((n) => this.toVM(n));
        this.loading = false;
      },
      error: (err) => {
        console.error('[Notifications] load failed', err);
        this.notifs = [];
        this.errorMsg = 'Chargement impossible. Vérifiez que le backend est démarré.';
        this.loading = false;
      },
    });
  }

  // ── Counts (always reflect the FULL dataset, not the filter) ──
  get total(): number { return this.notifs.length; }
  get unreadCount(): number { return this.notifs.filter((n) => !n.readFlag).length; }
  get readCount(): number { return this.notifs.filter((n) => n.readFlag).length; }
  get urgentCount(): number {
    return this.notifs.filter((n) => !n.readFlag
      && (n.severity === 'CRITICAL' || n.severity === 'WARNING')).length;
  }
  get todayCount(): number { return this.notifs.filter((n) => n.group === 'today').length; }
  get countAll(): number { return this.total; }
  get countReminders(): number { return this.notifs.filter((n) => n.kind === 'REMINDER').length; }
  get countAlerts(): number { return this.notifs.filter((n) => n.kind === 'ALERT').length; }
  get countSuggestions(): number { return this.notifs.filter((n) => n.kind === 'SUGGESTION').length; }
  get countCritical(): number { return this.notifs.filter((n) => n.severity === 'CRITICAL').length; }

  // ── Filtering + grouping by time ───────────────────────────────
  get visible(): NotifVM[] {
    const q = this.search.trim().toLowerCase();
    return this.notifs.filter((n) => {
      if (this.filter === 'UNREAD') {
        if (n.readFlag) return false;
      } else if (this.filter !== 'all' && n.kind !== this.filter) {
        return false;
      }
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    });
  }
  get todayGroup(): NotifVM[]     { return this.visible.filter((n) => n.group === 'today'); }
  get yesterdayGroup(): NotifVM[] { return this.visible.filter((n) => n.group === 'yesterday'); }
  get olderGroup(): NotifVM[]     { return this.visible.filter((n) => n.group === 'older'); }
  get isEmpty(): boolean { return this.visible.length === 0; }

  // ── Actions (call backend, then update local list) ─────────────
  toggleRead(n: NotifVM): void {
    const next = !n.readFlag;
    this.notifService.setRead(n.id, next).subscribe({
      next: () => { n.readFlag = next; },
      error: (err) => console.error('[Notifications] toggleRead failed', err),
    });
  }

  remove(n: NotifVM): void {
    this.notifService.delete(n.id).subscribe({
      next: () => { this.notifs = this.notifs.filter((x) => x.id !== n.id); },
      error: (err) => console.error('[Notifications] delete failed', err),
    });
  }

  markAllRead(): void {
    this.notifService.markAllRead().subscribe({
      next: () => this.notifs.forEach((n) => (n.readFlag = true)),
      error: (err) => console.error('[Notifications] markAllRead failed', err),
    });
  }

  clearRead(): void {
    this.notifService.clearRead().subscribe({
      next: () => { this.notifs = this.notifs.filter((n) => !n.readFlag); },
      error: (err) => console.error('[Notifications] clearRead failed', err),
    });
  }

  // ── Display helpers ────────────────────────────────────────────
  kindLabel(k: NotificationKind): string {
    switch (k) {
      case 'REMINDER':   return 'Rappel';
      case 'ALERT':      return 'Alerte';
      case 'SUGGESTION': return 'Suggestion';
    }
  }

  todayLabel(): string {
    const d = new Date();
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ── Internals ──────────────────────────────────────────────────
  /** Wrap a backend DTO with the UI-only fields (group, time, lower-case
   *  enums). Computing them once avoids re-deriving on every change-detection
   *  cycle in the template. */
  private toVM(n: NotificationDTO): NotifVM {
    const created = n.createdAt ? new Date(n.createdAt) : new Date();
    const group = this.bucketOf(created);
    const fallbackIcon = this.iconFor(n.severity, n.kind);
    return {
      ...n,
      icon: n.icon || fallbackIcon,
      kindLower: n.kind.toLowerCase() as NotifVM['kindLower'],
      severityLower: n.severity.toLowerCase() as NotifVM['severityLower'],
      group,
      time: this.formatTime(created, group),
    };
  }

  private bucketOf(d: Date): NotifGroup {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(d);  day.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return 'older';
  }

  private formatTime(d: Date, group: NotifGroup): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (group === 'today') return `Aujourd'hui · ${hh}:${mm}`;
    if (group === 'yesterday') return `Hier · ${hh}:${mm}`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  /** Default Material Icon when the backend didn't supply one. */
  private iconFor(s: NotificationSeverity, k: NotificationKind): string {
    if (s === 'CRITICAL') return 'error';
    if (s === 'WARNING') return 'warning';
    if (k === 'REMINDER') return 'schedule';
    if (k === 'SUGGESTION') return 'psychology';
    return 'notifications';
  }
}

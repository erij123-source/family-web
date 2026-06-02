/** Backend enum mirrors. */
export type NotificationKind = 'REMINDER' | 'ALERT' | 'SUGGESTION';
export type NotificationSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUGGESTION';

/** Shape returned by GET /notifications/famille/{familleId}. */
export interface NotificationDTO {
  id: number;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  icon?: string;
  createdAt: string;       // ISO date-time
  readFlag: boolean;
  famille?: { id: number };
  membre?: { id: number };
}

/** Payload for POST /notifications. */
export interface NotificationPayload {
  famille: { id: number };
  membre?: { id: number };
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  icon?: string;
}

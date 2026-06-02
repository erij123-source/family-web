// Mirrors the backend Compte entity. Only the fields actually used by
// the frontend are typed strictly; the rest stay permissive to avoid churn.
export interface Compte {
  id: number;
  solde?: number;
  budgetMensuel?: number;
  [key: string]: unknown;
}

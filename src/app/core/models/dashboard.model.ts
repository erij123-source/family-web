// Aggregated view-model consumed by the Dashboard Home page.
// Assembled by DashboardService from several backend endpoints.
export interface DashboardSummary {
  familleName: string;
  /** Family-level totals (used by the "Budget" card). */
  totalRevenuMois: number;
  totalChargesMois: number;
  remainingBalanceMois: number;
  totalRevenu: number;
  totalCharges: number;
  totalFactures: number;
  /** Factures payées ce mois — affiché sur la carte KPI (remise à 0 chaque mois). */
  totalFacturesMois: number;
  factureCount: number;
  /** Admin-scoped totals (used by the "Tes Revenus" / "Tes Dépenses" cards).
   *  "myDepensesMois" = charges + factures of the current month for the
   *  logged-in member. */
  myRevenusMois: number;
  myDepensesMois: number;
  /** Admin-scoped annual totals — used by the "mois / année" toggle on the
   *  Tes Revenus / Tes Dépenses cards. */
  myRevenusAnnee: number;
  myDepensesAnnee: number;
  /** Monthly budget assigned to the logged-in member by the admin (base
   *  allowance, before carryover). */
  myBudget: number;
  /** Unspent portion of last month's budget rolled into this month. */
  myCarryover: number;
  /** Base budget + carryover — what the member can actually spend this
   *  month. Drives the "Budget : … DT" pill and the progress-bar scale. */
  myEffectiveBudget: number;
  /** Effective budget − depenses, floored at 0. The "Reste à vivre" headline. */
  myRestAvivre: number;
  /** True when a budget was set AND it's fully consumed — the user is
   *  blocked from adding revenus/charges/factures until next month. */
  myBudgetExhausted: boolean;
}

/** Server-side budget snapshot returned by GET /membres/{id}/budget-summary. */
export interface BudgetSummary {
  baseBudget: number;
  carryover: number;
  effectiveBudget: number;
  depensesMois: number;
  restAvivre: number;
  exhausted: boolean;
}

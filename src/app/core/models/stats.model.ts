/** One bucket on a monthly line/area chart. */
export interface MonthlyStat {
  month: string;   // "Jan", "Fév", "Mar"…
  total: number;
}

/** One slice of a pie/donut. */
export interface PieSlice {
  label: string;
  value: number;
}

// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { StatsService, MonthAnchor } from '../../core/services/stats.service';
import { MonthlyStat, PieSlice } from '../../core/models/stats.model';

declare const ApexCharts: any;

type Scope = 'line' | 'bars' | 'share';

@Component({
  selector: 'app-statistiques-budget',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './statistiques-budget.component.html',
})
export class StatistiquesBudgetComponent implements AfterViewInit {
  private readonly stats = inject(StatsService);

  // Independent pickers — line (Revenus vs Dépenses), bars (Budget vs
  // Dépenses par Membre) and share (Répartition du Budget par Membre).
  // Each member's budget is stamped with the month it was allocated for,
  // so the donut filters by the picked month just like the others.
  readonly months = [
    { value: 1, label: 'Janvier' },  { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },     { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },      { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },  { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },{ value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },{ value: 12, label: 'Décembre' },
  ];
  readonly years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i);

  anchors: Record<Scope, { month: number; year: number; monthOpen: boolean; yearOpen: boolean }> = {
    line:  { month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthOpen: false, yearOpen: false },
    bars:  { month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthOpen: false, yearOpen: false },
    share: { month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthOpen: false, yearOpen: false },
  };

  loading = false;

  private revVsExpChart: any = null;       // 1. Revenus vs Dépenses (line)
  private budgetVsSpentChart: any = null;  // 2. Budget vs Dépenses par Membre (grouped bar)
  private budgetShareChart: any = null;    // 3. Répartition du Budget par Membre (donut, static)

  ngAfterViewInit(): void {
    this.renderBudgetVsSpentChart();
    this.renderBudgetShareChart();
    this.fetchAll();
  }

  monthLabel(m: number): string {
    return this.months.find((x) => x.value === m)?.label ?? '—';
  }
  toggleMonthMenu(scope: Scope, ev: Event): void {
    ev.stopPropagation();
    const wasOpen = this.anchors[scope].monthOpen;
    this.closeAllMenus();
    this.anchors[scope].monthOpen = !wasOpen;
  }
  toggleYearMenu(scope: Scope, ev: Event): void {
    ev.stopPropagation();
    const wasOpen = this.anchors[scope].yearOpen;
    this.closeAllMenus();
    this.anchors[scope].yearOpen = !wasOpen;
  }
  setMonth(scope: Scope, m: number, ev: Event): void {
    ev.stopPropagation();
    const a = this.anchors[scope];
    if (a.month === m) { a.monthOpen = false; return; }
    a.month = m;
    a.monthOpen = false;
    this.refresh(scope);
  }
  setYear(scope: Scope, y: number, ev: Event): void {
    ev.stopPropagation();
    const a = this.anchors[scope];
    if (a.year === y) { a.yearOpen = false; return; }
    a.year = y;
    a.yearOpen = false;
    this.refresh(scope);
  }
  /** Stepper d'année (flèches up/down ou saisie) : valide puis filtre en direct. */
  setYearFromInput(scope: Scope, value: string | number): void {
    const n = Number((value ?? '').toString().trim());
    if (!Number.isInteger(n) || n < 1900 || n > 2999) return;
    const a = this.anchors[scope];
    if (a.year === n) return;
    a.year = n;
    a.yearOpen = false;
    this.refresh(scope);
  }
  @HostListener('document:click') onDocClick(): void {
    this.closeAllMenus();
  }
  private closeAllMenus(): void {
    for (const k of Object.keys(this.anchors) as Scope[]) {
      this.anchors[k].monthOpen = false;
      this.anchors[k].yearOpen = false;
    }
  }
  private toAnchor(scope: Scope): MonthAnchor {
    const a = this.anchors[scope];
    return { year: a.year, month: a.month };
  }

  /** True when the user picked a month that hasn't happened yet — those
   *  buckets must stay empty even if the backend has projected recurring
   *  entries forward. */
  private isFutureAnchor(scope: Scope): boolean {
    const a = this.anchors[scope];
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth() + 1;
    return a.year > currentY || (a.year === currentY && a.month > currentM);
  }

  // ── Data fetch ────────────────────────────────────────────────────────
  private fetchAll(): void {
    this.loading = true;
    const barsAnchor = this.toAnchor('bars');
    const shareAnchor = this.toAnchor('share');
    forkJoin({
      budgetMbr: this.stats.budgetByMember(),            // global — bars chart
      spendMbr:  this.stats.spendingByMember(barsAnchor),
      shareMbr:  this.stats.budgetByMember(shareAnchor),  // anchored — donut
    }).subscribe({
      next: ({ budgetMbr, spendMbr, shareMbr }) => {
        this.updateBudgetVsSpentChart(budgetMbr, spendMbr);
        this.updateBudgetShareChart(shareMbr);
        this.loading = false;
      },
      error: (err) => {
        console.error('[stats-budget] load failed', err);
        this.loading = false;
      },
    });
  }

  private refresh(scope: Scope): void {
    if (scope === 'line') {
      const a = this.toAnchor('line');
      forkJoin({
        revenus:  this.stats.revenusMonthly(12, false, a),
        charges:  this.stats.chargesMonthly(12, false, a),
        factures: this.stats.facturesMonthly(12, false, a),
      }).subscribe({
        next: ({ revenus, charges, factures }) => {
          this.updateRevVsExpChart(revenus, this.combineMonthly(charges, factures));
        },
        error: (e) => console.error('[stats-budget] line refresh failed', e),
      });
    } else if (scope === 'bars') {
      const a = this.toAnchor('bars');
      forkJoin({
        budgetMbr: this.stats.budgetByMember(),
        spendMbr:  this.stats.spendingByMember(a),
      }).subscribe({
        next: ({ budgetMbr, spendMbr }) => this.updateBudgetVsSpentChart(budgetMbr, spendMbr),
        error: (e) => console.error('[stats-budget] bars refresh failed', e),
      });
    } else if (scope === 'share') {
      const a = this.toAnchor('share');
      this.stats.budgetByMember(a).subscribe({
        next: (shareMbr) => this.updateBudgetShareChart(shareMbr),
        error: (e) => console.error('[stats-budget] share refresh failed', e),
      });
    }
  }

  private combineMonthly(a: MonthlyStat[], b: MonthlyStat[]): MonthlyStat[] {
    const map = new Map<string, number>();
    for (const r of a) map.set(r.month, (map.get(r.month) || 0) + (r.total || 0));
    for (const r of b) map.set(r.month, (map.get(r.month) || 0) + (r.total || 0));
    const seen = new Set<string>();
    const out: MonthlyStat[] = [];
    for (const r of a) {
      if (seen.has(r.month)) continue;
      seen.add(r.month);
      out.push({ month: r.month, total: map.get(r.month) || 0 });
    }
    for (const r of b) {
      if (seen.has(r.month)) continue;
      seen.add(r.month);
      out.push({ month: r.month, total: map.get(r.month) || 0 });
    }
    return out;
  }

  // ── Chart 1 — Revenus vs Dépenses (line, like before) ─────────────────
  private renderRevVsExpChart(): void {
    const options = {
      series: [
        { name: 'Revenus',  data: [] as number[] },
        { name: 'Dépenses', data: [] as number[] },
      ],
      chart: {
        foreColor: '#9ba7b2', height: 380, type: 'line',
        zoom: { enabled: false }, toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 600 },
      },
      stroke: { width: [4, 4], curve: 'smooth' },
      colors: ['#22c55e', '#ef4444'],
      dataLabels: { enabled: false },
      markers: { size: 4, strokeWidth: 0, hover: { size: 7 } },
      grid: { show: true, borderColor: 'rgba(128,128,128,0.12)', strokeDashArray: 4 },
      tooltip: { theme: 'dark', shared: true, intersect: false,
        y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      xaxis: { categories: [] as string[] },
      yaxis: {
        forceNiceScale: true, min: 0,
        labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
      },
      legend: { show: false },
    };
    try {
      this.revVsExpChart = new ApexCharts(document.querySelector('#bdg-rev-vs-exp'), options);
      this.revVsExpChart.render();
    } catch (e) { console.warn('[stats-budget] rev-vs-exp render failed', e); }
  }

  private updateRevVsExpChart(rev: MonthlyStat[], exp: MonthlyStat[]): void {
    if (!this.revVsExpChart) return;
    const expByMonth = new Map(exp.map((e) => [e.month, e.total || 0]));
    const categories = rev.map((r) => r.month);
    const isFuture = this.isFutureAnchor('line');
    const hasRev = !isFuture && rev.some((r) => (r.total || 0) > 0);
    const hasExp = !isFuture && exp.some((e) => (e.total || 0) > 0);
    if (!hasRev && !hasExp) {
      // Nothing to plot — keep the month labels but don't draw any line.
      try {
        this.revVsExpChart.updateOptions({
          series: [
            { name: 'Revenus',  data: [] },
            { name: 'Dépenses', data: [] },
          ],
          xaxis: { categories },
          noData: { text: '' },
        }, true, true);
      } catch (e) { console.warn('[stats-budget] rev-vs-exp empty refresh failed', e); }
      return;
    }
    let runRev = 0;
    const revData = rev.map((r) => (runRev += (r.total || 0)));
    let runExp = 0;
    const expData = rev.map((r) => (runExp += (expByMonth.get(r.month) || 0)));
    const yMax = this.niceCeil(Math.max(0, ...revData, ...expData));
    try {
      this.revVsExpChart.updateOptions({
        series: [
          { name: 'Revenus',  data: revData },
          { name: 'Dépenses', data: expData },
        ],
        xaxis: { categories },
        yaxis: {
          min: 0, max: yMax, tickAmount: 5, forceNiceScale: true,
          labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
        },
      }, true, true);
    } catch (e) { console.warn('[stats-budget] rev-vs-exp refresh failed', e); }
  }

  // ── Chart 2 — Budget vs Dépenses par Membre (grouped bar, full width) ─
  private renderBudgetVsSpentChart(): void {
    const options = {
      series: [
        { name: 'Budget',   data: [] as number[] },
        { name: 'Dépenses', data: [] as number[] },
      ],
      chart: {
        foreColor: '#9ba7b2', height: 400, type: 'bar',
        toolbar: { show: false }, zoom: { enabled: false },
        animations: { enabled: true, easing: 'easeinout', speed: 600 },
        dropShadow: { enabled: true, top: 2, left: 0, blur: 4, opacity: 0.18, color: ['#2E3F8F', '#ef4444'] },
      },
      plotOptions: { bar: { horizontal: false, columnWidth: '45%', borderRadius: 8, borderRadiusApplication: 'end' } },
      dataLabels: { enabled: false },
      stroke: { show: true, width: 2, colors: ['transparent'] },
      colors: ['#2E3F8F', '#ef4444'],
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark', gradientToColors: ['#377CF4', '#dc2626'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 0.85, stops: [0, 100] },
      },
      grid: { show: true, borderColor: 'rgba(128,128,128,0.12)', strokeDashArray: 4 },
      tooltip: { theme: 'dark', shared: true, intersect: false,
        y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      xaxis: { categories: [] as string[] },
      yaxis: {
        forceNiceScale: true, min: 0,
        labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
      },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '13px', fontWeight: 600 },
    };
    try {
      this.budgetVsSpentChart = new ApexCharts(document.querySelector('#bdg-vs-spent'), options);
      this.budgetVsSpentChart.render();
    } catch (e) { console.warn('[stats-budget] budget-vs-spent render failed', e); }
  }

  private updateBudgetVsSpentChart(budget: PieSlice[], spent: PieSlice[]): void {
    if (!this.budgetVsSpentChart) return;
    const spentByName = new Map(spent.map((s) => [s.label, s.value]));
    const labels = budget.map((b) => b.label);
    const budgetData = budget.map((b) => b.value);
    const spentData = budget.map((b) => spentByName.get(b.label) || 0);
    const isFuture = this.isFutureAnchor('bars');
    const hasBudget = !isFuture && budgetData.some((v) => (v || 0) > 0);
    const hasSpent  = !isFuture && spentData.some((v) => (v || 0) > 0);
    if (!hasBudget && !hasSpent) {
      // No allocations AND no spending for the picked month — keep
      // member labels on the axis but draw no bars at all.
      try {
        this.budgetVsSpentChart.updateOptions({
          series: [
            { name: 'Budget',   data: [] },
            { name: 'Dépenses', data: [] },
          ],
          xaxis: { categories: labels },
          noData: { text: '' },
        }, true, true);
      } catch (e) { console.warn('[stats-budget] budget-vs-spent empty refresh failed', e); }
      return;
    }
    const yMax = this.niceCeil(Math.max(0, ...budgetData, ...spentData));
    try {
      this.budgetVsSpentChart.updateOptions({
        series: [
          { name: 'Budget',   data: budgetData },
          { name: 'Dépenses', data: spentData },
        ],
        xaxis: { categories: labels },
        yaxis: {
          min: 0, max: yMax, tickAmount: 5, forceNiceScale: true,
          labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
        },
      }, true, true);
    } catch (e) { console.warn('[stats-budget] budget-vs-spent refresh failed', e); }
  }

  // ── Chart 3 — Répartition du Budget par Membre (donut) ───────────────
  private renderBudgetShareChart(): void {
    const options = {
      series: [] as number[],
      labels: [] as string[],
      chart: { type: 'donut', height: 380, foreColor: '#9ba7b2', toolbar: { show: false } },
      colors: ['#2E3F8F', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#64748b'],
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark',
          gradientToColors: ['#377CF4', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
      },
      plotOptions: { pie: { donut: { size: '65%' } } },
      dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
      legend: { position: 'bottom', fontSize: '13px' },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
    };
    try {
      this.budgetShareChart = new ApexCharts(document.querySelector('#bdg-share'), options);
      this.budgetShareChart.render();
    } catch (e) { console.warn('[stats-budget] share render failed', e); }
  }

  private updateBudgetShareChart(budget: PieSlice[]): void {
    if (!this.budgetShareChart) return;
    const total = budget.reduce((s, b) => s + (b.value || 0), 0);
    if (total <= 0) {
      // No allocations set yet — show an empty donut ring with no values.
      try { this.budgetShareChart.updateOptions(emptyPieOptions(true)); }
      catch (e) { console.warn('[stats-budget] share empty refresh failed', e); }
      return;
    }
    const labels = budget.map((b) => b.label);
    const series = budget.map((b) => b.value);
    try {
      this.budgetShareChart.updateOptions({
        labels, series,
        colors: ['#2E3F8F', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#64748b'],
        fill: {
          type: 'gradient', opacity: 1,
          gradient: { shade: 'dark',
            gradientToColors: ['#377CF4', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569'],
            shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
        },
        dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
        legend: { position: 'bottom', show: true, fontSize: '13px' },
        tooltip: { enabled: true, theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
        plotOptions: { pie: { donut: { size: '65%',
          labels: { show: true, total: { show: true, label: 'Total Budget',
            formatter: () => total.toLocaleString('fr') + ' DT' } } } } },
      });
    } catch (e) { console.warn('[stats-budget] share refresh failed', e); }
  }

  // ── Internals ────────────────────────────────────────────────────────
  private niceCeil(peak: number): number {
    if (!isFinite(peak) || peak <= 0) return 1000;
    const padded = peak * 1.15;
    const exp = Math.pow(10, Math.floor(Math.log10(padded)));
    const norm = padded / exp;
    let nice: number;
    if (norm <= 1) nice = 1;
    else if (norm <= 2) nice = 2;
    else if (norm <= 5) nice = 5;
    else nice = 10;
    return nice * exp;
  }
}

/** Empty state — single full slice with the page accent (budget =
 *  blue @ 18%), no labels, no legend, no tooltip. Shape with one color,
 *  no composition, no values. */
function emptyPieOptions(donut: boolean): any {
  return {
    labels: [''],
    series: [1],
    colors: ['rgba(55,124,244, 0.18)'],
    fill: { type: 'solid', opacity: 1 },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: { enabled: false },
    stroke: { show: false, width: 0 },
    plotOptions: donut
      ? { pie: { donut: { size: '65%', labels: { show: false } } } }
      : { pie: {} },
  };
}

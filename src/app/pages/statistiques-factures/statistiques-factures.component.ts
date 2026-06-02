// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { StatsService, MonthAnchor } from '../../core/services/stats.service';
import { MonthlyStat, PieSlice } from '../../core/models/stats.model';

declare const ApexCharts: any;

type Scope = 'line' | 'cat' | 'mem';

@Component({
  selector: 'app-statistiques-factures',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './statistiques-factures.component.html',
})
export class StatistiquesFacturesComponent implements AfterViewInit {
  private readonly stats = inject(StatsService);

  // Each chart owns its own Mois+Année picker — see statistiques-charges
  // for the shared pattern.
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
    line: { month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthOpen: false, yearOpen: false },
    cat:  { month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthOpen: false, yearOpen: false },
    mem:  { month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthOpen: false, yearOpen: false },
  };

  loading = false;

  private areaChart: any = null;
  private categoriesChart: any = null;
  private membersChart: any = null;

  ngAfterViewInit(): void {
    this.renderEmptyCharts();
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
    forkJoin({
      monthly:    this.stats.facturesMonthly(12, false, this.toAnchor('line')),
      byCategory: this.stats.facturesByCategory(12, this.toAnchor('cat')),
      byMember:   this.stats.facturesByMember(12, this.toAnchor('mem')),
    }).subscribe({
      next: ({ monthly, byCategory, byMember }) => {
        this.updateAreaChart(monthly);
        this.updateCategoriesDonut(byCategory);
        this.updateMembersPie(byMember);
        this.loading = false;
      },
      error: (err) => {
        console.error('[stats-factures] load failed', err);
        this.loading = false;
      },
    });
  }

  private refresh(scope: Scope): void {
    const anchor = this.toAnchor(scope);
    if (scope === 'line') {
      this.stats.facturesMonthly(12, false, anchor).subscribe({
        next: (r) => this.updateAreaChart(r),
        error: (e) => console.error('[stats-factures] line refresh failed', e),
      });
    } else if (scope === 'cat') {
      this.stats.facturesByCategory(12, anchor).subscribe({
        next: (r) => this.updateCategoriesDonut(r),
        error: (e) => console.error('[stats-factures] cat refresh failed', e),
      });
    } else if (scope === 'mem') {
      this.stats.facturesByMember(12, anchor).subscribe({
        next: (r) => this.updateMembersPie(r),
        error: (e) => console.error('[stats-factures] mem refresh failed', e),
      });
    }
  }

  // ── Chart factories (empty data, populated by update*) ────────────────
  private renderEmptyCharts(): void {
    this.renderAreaChart();
    this.renderCategoriesDonut();
    this.renderMembersPie();
  }

  private renderAreaChart(): void {
    const options = {
      series: [{ name: 'Factures', data: [] as number[] }],
      chart: {
        foreColor: '#9ba7b2', height: 460, type: 'area',
        zoom: { enabled: false }, toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 600 },
      },
      dataLabels: { enabled: false },
      stroke: { width: 4, curve: 'smooth' },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark', gradientToColors: ['#7c3aed'],
          shadeIntensity: 1, type: 'vertical',
          opacityFrom: 0.7, opacityTo: 0.05, stops: [0, 100],
        },
      },
      colors: ['#a855f7'],
      grid: { show: true, borderColor: 'rgba(128,128,128,0.12)', strokeDashArray: 4 },
      markers: { size: 4, strokeWidth: 0, hover: { size: 7 } },
      tooltip: { theme: 'dark',
        y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      xaxis: { categories: [] as string[] },
      yaxis: {
        forceNiceScale: true,
        min: 0,
        labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
      },
      legend: { show: false },
    };
    try {
      this.areaChart = new ApexCharts(document.querySelector('#fac-area-evolution'), options);
      this.areaChart.render();
    } catch (e) { console.warn('[stats-factures] area chart failed', e); }
  }

  private renderCategoriesDonut(): void {
    const options = {
      series: [] as number[],
      labels: [] as string[],
      chart: { type: 'donut', height: 360, foreColor: '#9ba7b2', toolbar: { show: false } },
      colors: ['#2E3F8F','#f97316','#22c55e','#06b6d4','#8b5cf6','#ec4899','#64748b','#0ea5e9'],
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark',
          gradientToColors: ['#ee0979','#17ad37','#ec6ead','#00c6fb','#ffd200','#7928ca','#ff6a00','#2af598'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
      },
      plotOptions: { pie: { donut: { size: '65%' } } },
      dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
      legend: { position: 'bottom', fontSize: '12px' },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
    };
    try {
      this.categoriesChart = new ApexCharts(document.querySelector('#fac-donut-categories'), options);
      this.categoriesChart.render();
    } catch (e) { console.warn('[stats-factures] categories donut failed', e); }
  }

  private renderMembersPie(): void {
    const options = {
      series: [] as number[],
      labels: [] as string[],
      chart: { type: 'pie', height: 360, foreColor: '#9ba7b2', toolbar: { show: false } },
      colors: ['#a855f7', '#f59e0b', '#2E3F8F', '#22c55e', '#ef4444'],
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark',
          gradientToColors: ['#7c3aed','#d97706','#377CF4','#16a34a','#dc2626'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
      },
      legend: { position: 'bottom', fontSize: '12px' },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      responsive: [{ breakpoint: 480, options: { chart: { width: 220 }, legend: { position: 'bottom' } } }],
    };
    try {
      this.membersChart = new ApexCharts(document.querySelector('#fac-pie-members'), options);
      this.membersChart.render();
    } catch (e) { console.warn('[stats-factures] members pie failed', e); }
  }

  // ── Live-update helpers ──────────────────────────────────────────────
  private updateAreaChart(rows: MonthlyStat[]): void {
    if (!this.areaChart) return;
    const categories = rows.map((r) => r.month);
    const isFuture = this.isFutureAnchor('line');
    const hasData = !isFuture && rows.some((r) => (r.total || 0) > 0);
    if (!hasData) {
      // No factures in the picked window — keep the x-axis labels but
      // don't draw any line.
      try {
        this.areaChart.updateOptions({
          series: [{ name: 'Factures', data: [] }],
          xaxis: { categories },
          noData: { text: '' },
        }, true, true);
      } catch (e) { console.warn('[stats-factures] area empty refresh failed', e); }
      return;
    }
    let running = 0;
    const data = rows.map((r) => (running += (r.total || 0)));
    const yMax = this.niceCeil(Math.max(0, ...data));
    try {
      this.areaChart.updateOptions({
        series: [{ name: 'Factures', data }],
        xaxis: { categories },
        yaxis: {
          min: 0,
          max: yMax,
          tickAmount: 5,
          forceNiceScale: true,
          labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
        },
      }, true, true);
    } catch (e) { console.warn('[stats-factures] area refresh failed', e); }
  }

  private updateCategoriesDonut(rows: PieSlice[]): void {
    if (!this.categoriesChart) return;
    const isFuture = this.isFutureAnchor('cat');
    const total = isFuture ? 0 : rows.reduce((s, r) => s + (r.value || 0), 0);
    if (total <= 0) {
      try { this.categoriesChart.updateOptions(emptyPieOptions(true)); }
      catch (e) { console.warn('[stats-factures] categories empty refresh failed', e); }
      return;
    }
    try {
      this.categoriesChart.updateOptions({
        labels: rows.map((r) => r.label),
        series: rows.map((r) => r.value),
        colors: ['#2E3F8F','#f97316','#22c55e','#06b6d4','#8b5cf6','#ec4899','#64748b','#0ea5e9'],
        fill: {
          type: 'gradient', opacity: 1,
          gradient: { shade: 'dark',
            gradientToColors: ['#ee0979','#17ad37','#ec6ead','#00c6fb','#ffd200','#7928ca','#ff6a00','#2af598'],
            shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
        },
        dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
        legend: { position: 'bottom', show: true, fontSize: '12px' },
        tooltip: { enabled: true, theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
        plotOptions: { pie: { donut: { size: '65%',
          labels: { show: true, total: { show: true, label: 'Total',
            formatter: () => total.toLocaleString('fr') + ' DT' } } } } },
      });
    } catch (e) { console.warn('[stats-factures] categories refresh failed', e); }
  }

  private updateMembersPie(rows: PieSlice[]): void {
    if (!this.membersChart) return;
    const isFuture = this.isFutureAnchor('mem');
    const total = isFuture ? 0 : rows.reduce((s, r) => s + (r.value || 0), 0);
    if (total <= 0) {
      try { this.membersChart.updateOptions(emptyPieOptions(false)); }
      catch (e) { console.warn('[stats-factures] members empty refresh failed', e); }
      return;
    }
    try {
      this.membersChart.updateOptions({
        labels: rows.map((r) => r.label),
        series: rows.map((r) => r.value),
        colors: ['#a855f7', '#f59e0b', '#2E3F8F', '#22c55e', '#ef4444'],
        fill: {
          type: 'gradient', opacity: 1,
          gradient: { shade: 'dark',
            gradientToColors: ['#7c3aed','#d97706','#377CF4','#16a34a','#dc2626'],
            shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
        },
        dataLabels: { enabled: true },
        legend: { position: 'bottom', show: true, fontSize: '12px' },
        tooltip: { enabled: true, theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
      });
    } catch (e) { console.warn('[stats-factures] members refresh failed', e); }
  }

  /** Round `peak * 1.15` up to a nice human-friendly step (1k/2k/5k/10k…). */
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

/** Empty state — single full slice with the page accent (factures =
 *  purple @ 18%), no labels, no legend, no tooltip. Shape with one color,
 *  no composition, no values. */
function emptyPieOptions(donut: boolean): any {
  return {
    labels: [''],
    series: [1],
    colors: ['rgba(168, 85, 247, 0.18)'],
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

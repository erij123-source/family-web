// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { StatsService, MonthAnchor } from '../../core/services/stats.service';
import { MonthlyStat, PieSlice } from '../../core/models/stats.model';

declare const ApexCharts: any;

type Scope = 'line' | 'cat' | 'mem';

@Component({
  selector: 'app-statistiques-revenus',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './statistiques-revenus.component.html',
})
export class StatistiquesRevenusComponent implements AfterViewInit {
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
      monthly:    this.stats.revenusMonthly(12, false, this.toAnchor('line')),
      byCategory: this.stats.revenusByCategory(1, this.toAnchor('cat')),   // selected month only
      byMember:   this.stats.revenusByMember(1, this.toAnchor('mem')),     // selected month only
    }).subscribe({
      next: ({ monthly, byCategory, byMember }) => {
        this.updateAreaChart(monthly);
        this.updateCategoriesDonut(byCategory);
        this.updateMembersPie(byMember);
        this.loading = false;
      },
      error: (err) => {
        console.error('[stats-revenus] load failed', err);
        this.loading = false;
      },
    });
  }

  private refresh(scope: Scope): void {
    const anchor = this.toAnchor(scope);
    if (scope === 'line') {
      this.stats.revenusMonthly(12, false, anchor).subscribe({
        next: (r) => this.updateAreaChart(r),
        error: (e) => console.error('[stats-revenus] line refresh failed', e),
      });
    } else if (scope === 'cat') {
      this.stats.revenusByCategory(1, anchor).subscribe({
        next: (r) => this.updateCategoriesDonut(r),
        error: (e) => console.error('[stats-revenus] cat refresh failed', e),
      });
    } else if (scope === 'mem') {
      this.stats.revenusByMember(1, anchor).subscribe({
        next: (r) => this.updateMembersPie(r),
        error: (e) => console.error('[stats-revenus] mem refresh failed', e),
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
      series: [{ name: 'Revenus', data: [] as number[] }],
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
          shade: 'dark', gradientToColors: ['#ff0080'], shadeIntensity: 1,
          type: 'vertical', opacityFrom: 0.8, opacityTo: 0.1, stops: [0, 100, 100, 100],
        },
      },
      colors: ['#ffd200'],
      grid: { show: true, borderColor: 'rgba(0,0,0,0.15)', strokeDashArray: 4 },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      xaxis: { categories: [] as string[] },
      yaxis: {
        forceNiceScale: true,
        min: 0,
        labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
      },
      markers: { size: 4, strokeWidth: 0, hover: { size: 7 } },
    };
    try {
      this.areaChart = new ApexCharts(document.querySelector('#rev-area-monthly'), options);
      this.areaChart.render();
    } catch (e) { console.warn('[stats-revenus] area chart failed', e); }
  }

  private renderCategoriesDonut(): void {
    const options = {
      series: [] as number[],
      chart: { foreColor: '#9ba7b2', height: 360, type: 'donut' },
      labels: [] as string[],
      dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark',
          gradientToColors: ['#ee0979', '#17ad37', '#ec6ead', '#00c6fb'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
      },
      colors: ['#ff6a00', '#98ec2d', '#3494e6', '#005bea', '#ff0080', '#0891b2', '#7c3aed'],
      legend: { position: 'bottom', show: true, onItemClick: { toggleDataSeries: false } },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }],
    };
    try {
      this.categoriesChart = new ApexCharts(document.querySelector('#rev-donut-categories'), options);
      this.categoriesChart.render();
    } catch (e) { console.warn('[stats-revenus] donut categories failed', e); }
  }

  private renderMembersPie(): void {
    const options = {
      series: [] as number[],
      chart: { foreColor: '#9ba7b2', height: 360, type: 'pie' },
      labels: [] as string[],
      dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark',
          gradientToColors: ['#ee0979', '#17ad37', '#ec6ead', '#00c6fb'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
      },
      colors: ['#ff6a00', '#98ec2d', '#3494e6', '#005bea'],
      legend: { position: 'bottom', show: true, onItemClick: { toggleDataSeries: false } },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }],
    };
    try {
      this.membersChart = new ApexCharts(document.querySelector('#rev-pie-members'), options);
      this.membersChart.render();
    } catch (e) { console.warn('[stats-revenus] pie members failed', e); }
  }

  // ── Live-update helpers ──────────────────────────────────────────────
  private updateAreaChart(rows: MonthlyStat[]): void {
    if (!this.areaChart) return;
    const categories = rows.map((r) => r.month);
    const isFuture = this.isFutureAnchor('line');
    const hasData = !isFuture && rows.some((r) => (r.total || 0) > 0);
    if (!hasData) {
      // No revenus in the picked window — keep the x-axis labels but
      // don't draw any line.
      try {
        this.areaChart.updateOptions({
          series: [{ name: 'Revenus', data: [] }],
          xaxis: { categories },
          noData: { text: '' },
        }, true, true);
      } catch (e) { console.warn('[stats-revenus] area empty refresh failed', e); }
      return;
    }
    // Valeur propre de chaque mois (pas de cumul) : juin = revenus de juin.
    const data = rows.map((r) => r.total || 0);
    const yMax = this.niceCeil(Math.max(0, ...data));
    try {
      this.areaChart.updateOptions({
        series: [{ name: 'Revenus', data }],
        xaxis: { categories },
        yaxis: {
          min: 0,
          max: yMax,
          tickAmount: 5,
          forceNiceScale: true,
          labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
        },
      }, true, true);
    } catch (e) { console.warn('[stats-revenus] area refresh failed', e); }
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

  // Distinct palette — one clearly different hue per category, so 8+ slices
  // stay visually separable (no two adjacent blues blending into one).
  private readonly sliceColors = [
    '#ff6a00', '#22c55e', '#3494e6', '#ff0080', '#7c3aed',
    '#0891b2', '#facc15', '#ef4444', '#14b8a6', '#a855f7',
  ];
  private readonly sliceGradient = [
    '#ee0979', '#16a34a', '#1d4ed8', '#db2777', '#6d28d9',
    '#0e7490', '#ca8a04', '#b91c1c', '#0f766e', '#7e22ce',
  ];

  private updateCategoriesDonut(rows: PieSlice[]): void {
    if (!this.categoriesChart) return;
    const isFuture = this.isFutureAnchor('cat');
    // One slice per revenue name present in the month's list — nothing merged
    // into "Autres". Sorted largest-first so the legend reads top-down.
    const slices = isFuture
      ? []
      : [...rows].filter((r) => (r.value || 0) > 0).sort((a, b) => (b.value || 0) - (a.value || 0));
    const total = slices.reduce((s, r) => s + (r.value || 0), 0);
    if (total <= 0) {
      try {
        this.categoriesChart.updateOptions(emptyPieOptions(true));
        this.categoriesChart.updateSeries([1], true);
      } catch (e) { console.warn('[stats-revenus] categories empty refresh failed', e); }
      return;
    }
    try {
      // Labels + styling via updateOptions (default redraw → the legend
      // re-syncs to the new labels, no stale entries), then the values via
      // updateSeries so the slices redraw even when the count changes between
      // months — including the empty→data first load.
      this.categoriesChart.updateOptions({
        labels: slices.map((r) => r.label),
        colors: this.sliceColors,
        fill: {
          type: 'gradient', opacity: 1,
          gradient: { shade: 'dark', gradientToColors: this.sliceGradient,
            shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
        },
        dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
        legend: { position: 'bottom', show: true, onItemClick: { toggleDataSeries: false } },
        tooltip: { enabled: true, theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
      });
      this.categoriesChart.updateSeries(slices.map((r) => r.value), true);
    } catch (e) { console.warn('[stats-revenus] categories refresh failed', e); }
  }

  private updateMembersPie(rows: PieSlice[]): void {
    if (!this.membersChart) return;
    const isFuture = this.isFutureAnchor('mem');
    const slices = isFuture
      ? []
      : [...rows].filter((r) => (r.value || 0) > 0).sort((a, b) => (b.value || 0) - (a.value || 0));
    const total = slices.reduce((s, r) => s + (r.value || 0), 0);
    if (total <= 0) {
      try {
        this.membersChart.updateOptions(emptyPieOptions(false));
        this.membersChart.updateSeries([1], true);
      } catch (e) { console.warn('[stats-revenus] members empty refresh failed', e); }
      return;
    }
    try {
      this.membersChart.updateOptions({
        labels: slices.map((r) => r.label),
        colors: this.sliceColors,
        fill: {
          type: 'gradient', opacity: 1,
          gradient: { shade: 'dark', gradientToColors: this.sliceGradient,
            shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
        },
        dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
        legend: { position: 'bottom', show: true, onItemClick: { toggleDataSeries: false } },
        tooltip: { enabled: true, theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
      });
      this.membersChart.updateSeries(slices.map((r) => r.value), true);
    } catch (e) { console.warn('[stats-revenus] members refresh failed', e); }
  }
}

/** Empty state — single full slice with the page accent (revenus = gold
 *  @ 18%), no labels, no legend, no tooltip. Shape with one color, no
 *  composition, no values. */
function emptyPieOptions(donut: boolean): any {
  return {
    labels: [''],
    series: [1],
    colors: ['rgba(255, 210, 0, 0.18)'],
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

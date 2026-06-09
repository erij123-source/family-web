// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import { StatsService, MonthAnchor } from '../../core/services/stats.service';
import { MonthlyStat, PieSlice } from '../../core/models/stats.model';

declare const ApexCharts: any;

type Scope = 'line' | 'cat' | 'mem';

@Component({
  selector: 'app-statistiques-charges',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './statistiques-charges.component.html',
})
export class StatistiquesChargesComponent implements AfterViewInit {
  private readonly stats = inject(StatsService);

  // Each chart owns its own Mois+Année picker so the user can scope the
  // line, the categories donut and the members pie independently.
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

  // ── Picker handlers ──────────────────────────────────────────────────
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
   *  entries forward (e.g. picking June while we're still in May). */
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
      monthly:    this.stats.chargesMonthly(12, false, this.toAnchor('line')),
      byCategory: this.stats.chargesByCategory(1, this.toAnchor('cat')),   // selected month only
      byMember:   this.stats.chargesByMember(1, this.toAnchor('mem')),     // selected month only
    }).subscribe({
      next: ({ monthly, byCategory, byMember }) => {
        this.updateAreaChart(monthly);
        this.updateCategoriesDonut(byCategory);
        this.updateMembersPie(byMember);
        this.loading = false;
      },
      error: (err) => {
        console.error('[stats-charges] load failed', err);
        this.loading = false;
      },
    });
  }

  /** Refresh only the chart whose picker changed, leaving the other two alone. */
  private refresh(scope: Scope): void {
    const anchor = this.toAnchor(scope);
    if (scope === 'line') {
      this.stats.chargesMonthly(12, false, anchor).subscribe({
        next: (r) => this.updateAreaChart(r),
        error: (e) => console.error('[stats-charges] line refresh failed', e),
      });
    } else if (scope === 'cat') {
      this.stats.chargesByCategory(1, anchor).subscribe({
        next: (r) => this.updateCategoriesDonut(r),
        error: (e) => console.error('[stats-charges] cat refresh failed', e),
      });
    } else if (scope === 'mem') {
      this.stats.chargesByMember(1, anchor).subscribe({
        next: (r) => this.updateMembersPie(r),
        error: (e) => console.error('[stats-charges] mem refresh failed', e),
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
      series: [{ name: 'Charges', data: [] as number[] }],
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
          shade: 'dark', gradientToColors: ['#dc2626'], shadeIntensity: 1,
          type: 'vertical', opacityFrom: 0.7, opacityTo: 0.05, stops: [0, 100],
        },
      },
      colors: ['#ef4444'],
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
      this.areaChart = new ApexCharts(document.querySelector('#chg-area-fixe-variable'), options);
      this.areaChart.render();
    } catch (e) { console.warn('[stats-charges] area chart failed', e); }
  }

  private renderCategoriesDonut(): void {
    const options = {
      series: [] as number[],
      labels: [] as string[],
      chart: { type: 'donut', height: 360, foreColor: '#9ba7b2', toolbar: { show: false } },
      colors: ['#ef4444','#f97316','#eab308','#06b6d4','#8b5cf6','#14b8a6','#f43f5e'],
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark',
          gradientToColors: ['#ee0979','#17ad37','#ec6ead','#00c6fb'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
      },
      plotOptions: { pie: { donut: { size: '65%' } } },
      dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
      legend: { position: 'bottom', fontSize: '12px' },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
    };
    try {
      this.categoriesChart = new ApexCharts(document.querySelector('#chg-donut-cats'), options);
      this.categoriesChart.render();
    } catch (e) { console.warn('[stats-charges] categories donut failed', e); }
  }

  private renderMembersPie(): void {
    const options = {
      series: [] as number[],
      labels: [] as string[],
      chart: { type: 'pie', height: 360, foreColor: '#9ba7b2', toolbar: { show: false } },
      colors: ['#ef4444', '#f59e0b', '#2E3F8F', '#22c55e', '#8b5cf6'],
      dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
      fill: {
        type: 'gradient',
        gradient: { shade: 'dark',
          gradientToColors: ['#dc2626','#d97706','#377CF4','#16a34a'],
          shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
      },
      legend: { position: 'bottom', fontSize: '12px' },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
      responsive: [{ breakpoint: 480, options: { chart: { width: 220 }, legend: { position: 'bottom' } } }],
    };
    try {
      this.membersChart = new ApexCharts(document.querySelector('#chg-pie-members'), options);
      this.membersChart.render();
    } catch (e) { console.warn('[stats-charges] members pie failed', e); }
  }

  // ── Live-update helpers ──────────────────────────────────────────────
  private updateAreaChart(rows: MonthlyStat[]): void {
    if (!this.areaChart) return;
    // Future-month picks must stay completely empty — the backend may
    // still project recurring entries forward, but visually we want no
    // line at all for a month that hasn't happened yet.
    const isFuture = this.isFutureAnchor('line');
    const hasData = !isFuture && rows.some((r) => (r.total || 0) > 0);
    if (!hasData) {
      // No data in the picked window — clear the curve. We keep the
      // x-axis month labels so the user still sees the window they chose.
      try {
        this.areaChart.updateOptions({
          series: [{ name: 'Charges', data: [] }],
          xaxis: { categories: rows.map((r) => r.month) },
          noData: { text: '' },
        }, true, true);
      } catch (e) { console.warn('[stats-charges] area empty refresh failed', e); }
      return;
    }
    // Valeur propre de chaque mois (pas de cumul) : juin = charges de juin.
    const data = rows.map((r) => r.total || 0);
    const yMax = this.niceCeil(Math.max(0, ...data));
    try {
      this.areaChart.updateOptions({
        series: [{ name: 'Charges', data }],
        xaxis: { categories: rows.map((r) => r.month) },
        yaxis: {
          min: 0,
          max: yMax,
          tickAmount: 5,
          forceNiceScale: true,
          labels: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' },
        },
      }, true, true);
    } catch (e) { console.warn('[stats-charges] area refresh failed', e); }
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

  private updateCategoriesDonut(rows: PieSlice[]): void {
    if (!this.categoriesChart) return;
    const isFuture = this.isFutureAnchor('cat');
    const total = isFuture ? 0 : rows.reduce((s, r) => s + (r.value || 0), 0);
    if (total <= 0) {
      try {
        this.categoriesChart.updateOptions(emptyPieOptions(true), false, false);
        this.categoriesChart.updateSeries([1], false);
      } catch (e) { console.warn('[stats-charges] categories empty refresh failed', e); }
      return;
    }
    try {
      // Labels + styling via updateOptions, then the data via updateSeries.
      // For pie/donut, updateOptions({series}) does NOT reliably redraw when
      // the number of slices changes between months (e.g. 1 category → 2),
      // which left the newly-selected month's slices missing. updateSeries
      // forces the slices to redraw for the new month.
      this.categoriesChart.updateOptions({
        labels: rows.map((r) => r.label),
        colors: ['#ef4444','#f97316','#eab308','#06b6d4','#8b5cf6','#14b8a6','#f43f5e'],
        // Reset fill explicitly: emptyPieOptions sets opacity 0 / solid, which
        // would persist through ApexCharts' deep-merge and leave the slices
        // invisible if we don't override it here.
        fill: {
          type: 'gradient', opacity: 1,
          gradient: { shade: 'dark',
            gradientToColors: ['#ee0979','#17ad37','#ec6ead','#00c6fb'],
            shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
        },
        dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
        legend: { position: 'bottom', show: true, fontSize: '12px' },
        tooltip: { enabled: true, theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
        plotOptions: { pie: { donut: { size: '65%',
          labels: { show: true, total: { show: true, label: 'Total',
            formatter: () => total.toLocaleString('fr') + ' DT' } } } } },
      }, false, false);
      this.categoriesChart.updateSeries(rows.map((r) => r.value), true);
    } catch (e) { console.warn('[stats-charges] categories refresh failed', e); }
  }

  private updateMembersPie(rows: PieSlice[]): void {
    if (!this.membersChart) return;
    const isFuture = this.isFutureAnchor('mem');
    const total = isFuture ? 0 : rows.reduce((s, r) => s + (r.value || 0), 0);
    if (total <= 0) {
      try {
        this.membersChart.updateOptions(emptyPieOptions(false), false, false);
        this.membersChart.updateSeries([1], false);
      } catch (e) { console.warn('[stats-charges] members empty refresh failed', e); }
      return;
    }
    try {
      // Same as the categories donut: data via updateSeries so the pie redraws
      // its slices when the member count changes from one month to another.
      this.membersChart.updateOptions({
        labels: rows.map((r) => r.label),
        colors: ['#ef4444', '#f59e0b', '#2E3F8F', '#22c55e', '#8b5cf6'],
        fill: {
          type: 'gradient', opacity: 1,
          gradient: { shade: 'dark',
            gradientToColors: ['#dc2626','#d97706','#377CF4','#16a34a'],
            shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 },
        },
        dataLabels: { enabled: true, formatter: (v: number) => Math.round(v) + '%' },
        legend: { position: 'bottom', show: true, fontSize: '12px' },
        tooltip: { enabled: true, theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' } },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
      }, false, false);
      this.membersChart.updateSeries(rows.map((r) => r.value), true);
    } catch (e) { console.warn('[stats-charges] members refresh failed', e); }
  }
}

/**
 * Apex update payload for the empty state: a single full slice filled
 * with a soft accent color matching the page (charges = red @ 18%), no
 * labels, no legend, no tooltip — the user sees the donut/pie shape with
 * one color, no composition, no values.
 */
function emptyPieOptions(donut: boolean): any {
  return {
    labels: [''],
    series: [1],
    colors: ['rgba(239, 68, 68, 0.18)'],
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

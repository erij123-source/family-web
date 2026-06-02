// @ts-nocheck
import { Component, ViewEncapsulation, AfterViewInit, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DashboardService } from '../../core/services/dashboard.service';
import { StatsService } from '../../core/services/stats.service';
import { FacturesService } from '../../core/services/factures.service';
import { forkJoin } from 'rxjs';

declare const $: any;
declare const ApexCharts: any;
declare const SimpleBar: any;
declare const PerfectScrollbar: any;
declare const bootstrap: any;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  private readonly dashboardService = inject(DashboardService);
  private readonly statsService = inject(StatsService);
  private readonly facturesService = inject(FacturesService);
  private readonly http = inject(HttpClient);
  private readonly destroy$ = new Subject<void>();

  // ── Card-trend metadata (vs previous month) ────────────────────────
  // Filled by `refreshKpiCharts()`. The HTML renders an up/down arrow
  // next to each headline number based on the sign.
  revenusTrendPct = 0;     // % vs mois précédent (positive = better)
  chargesTrendPct = 0;     // % vs mois précédent (positive = bad — more spending)
  factureCountMois = 0;    // # of invoices issued this month
  facturePaidCount = 0;    // # of those that are PAYEE
  facturePaidPct = 0;      // 0–100, paid / total this month

  familleName = 'Famille';
  totalRevenuMois = 0;
  totalChargesMois = 0;
  remainingBalanceMois = 0;
  totalRevenu = 0;
  totalCharges = 0;
  totalFactures = 0;
  totalFacturesMois = 0;
  factureCount = 0;
  // Admin-scoped (only the logged-in user's) monthly totals.
  myRevenusMois = 0;
  myDepensesMois = 0;
  myRevenusAnnee = 0;
  myDepensesAnnee = 0;
  // Period toggle state for the Tes Revenus / Tes Dépenses cards.
  // 'mois' = current month, 'annee' = current year. Matches the React app.
  periodRev: 'mois' | 'annee' = 'mois';
  periodDep: 'mois' | 'annee' = 'mois';
  myBudget = 0;             // base allowance (before carryover)
  myCarryover = 0;          // unspent budget rolled over from last month
  myEffectiveBudget = 0;    // base + carryover — usable this month
  myRestAvivre = 0;         // effective − depenses, floored at 0
  myBudgetExhausted = false;
  loading = true;

  /** Budget total disponible = base saisie + report transféré par l'admin
   *  lors de la dernière modification de budget. C'est cette valeur qui
   *  sert de référence pour la pill "Budget : X DT" et le calcul du reste
   *  à vivre — le report ne s'affiche plus à part en termes de calcul,
   *  juste en sous-info dans la sous-pill. */
  get myBudgetTotal(): number {
    return (this.myBudget || 0) + (this.myCarryover || 0);
  }

  /** Pourcentage d'utilisation du budget total (= base + report). */
  get budgetUsagePct(): number {
    if (!this.myBudgetTotal || this.myBudgetTotal <= 0) return 0;
    const pct = (this.myDepensesMois / this.myBudgetTotal) * 100;
    return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
  }

  /** Reste à vivre = budget total − dépenses du mois. */
  get restAvivreFromBudget(): number {
    return Math.max(0, this.myBudgetTotal - (this.myDepensesMois || 0));
  }

  // Lowercase French month + year for the breadcrumb pill ("mai 2026").
  private readonly monthLabels = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  get currentMonthLabel(): string {
    return this.monthLabels[new Date().getMonth()];
  }
  get currentYear(): number {
    return new Date().getFullYear();
  }

  togglePeriodRev(): void {
    this.periodRev = this.periodRev === 'mois' ? 'annee' : 'mois';
  }
  togglePeriodDep(): void {
    this.periodDep = this.periodDep === 'mois' ? 'annee' : 'mois';
  }

  /**
   * Détecte un changement de mois entre deux sessions (via localStorage)
   * et déclenche la remise à zéro côté backend des charges/factures/budgets
   * pour le nouveau mois. Port du fix #5 du Dashboard React :
   *   POST /admins/reset-budgets-new-month
   * Non bloquant : si l'appel échoue, la page se charge quand même.
   */
  private checkMonthRollover(): void {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}_${now.getMonth() + 1}`;
    const lastKnownMonth = localStorage.getItem('last_known_month');

    if (lastKnownMonth && lastKnownMonth !== currentMonthKey) {
      console.info(
        `[HomeComponent] Nouveau mois détecté : ${currentMonthKey}. Remise à 0 des budgets/charges/factures.`,
      );
      this.http
        .post<void>(`${environment.apiBaseUrl}/admins/reset-budgets-new-month`, {})
        .subscribe({
          next: () => console.info('[HomeComponent] reset-budgets-new-month OK'),
          error: (err) => console.warn('[HomeComponent] reset-budgets-new-month failed', err),
        });
    }
    localStorage.setItem('last_known_month', currentMonthKey);
  }

  ngOnInit(): void {
    this.checkMonthRollover();
    this.dashboardService
      .loadSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (s) => {
          this.familleName = (s.familleName && s.familleName.trim()) || 'Famille';
          this.totalRevenuMois = s.totalRevenuMois ?? 0;
          this.totalChargesMois = s.totalChargesMois ?? 0;
          this.remainingBalanceMois = s.remainingBalanceMois ?? 0;
          this.totalRevenu = s.totalRevenu ?? 0;
          this.totalCharges = s.totalCharges ?? 0;
          this.totalFactures = s.totalFactures ?? 0;
          this.totalFacturesMois = s.totalFacturesMois ?? 0;
          this.factureCount = s.factureCount ?? 0;
          this.myRevenusMois = s.myRevenusMois ?? 0;
          this.myDepensesMois = s.myDepensesMois ?? 0;
          this.myRevenusAnnee = s.myRevenusAnnee ?? 0;
          this.myDepensesAnnee = s.myDepensesAnnee ?? 0;
          this.myBudget = s.myBudget ?? 0;
          this.myCarryover = s.myCarryover ?? 0;
          this.myEffectiveBudget = s.myEffectiveBudget ?? 0;
          this.myRestAvivre = s.myRestAvivre ?? 0;
          this.myBudgetExhausted = !!s.myBudgetExhausted;
          this.loading = false;
          // Once the headline numbers are in place, replace the mock
          // sparklines on the KPI cards (chart1/chart3/chart7) with real
          // backend-driven series.
          this.refreshKpiCharts();
        },
        error: (err) => {
          console.error('[HomeComponent] failed to load dashboard summary', err);
          this.loading = false;
        },
      });
  }

  /**
   * Replace the placeholder sparklines created by the inline scripts in
   * `ngAfterViewInit` with real data from the dashboard endpoints. We
   * clear each container first because ApexCharts otherwise stacks a new
   * SVG on top of the existing one. Runs in a microtask so the DOM
   * elements are guaranteed to exist (the inline `ngAfterViewInit` block
   * also waits for `$(document).ready`).
   */
  /**
   * KPI metadata for the 3 dashboard cards (Revenus / Charges / Factures).
   * The cards are now chartless — we only need the headline number, the
   * % vs previous month trend, and the paid-ratio for invoices.
   */
  private refreshKpiCharts(): void {
    forkJoin({
      revenusBwd: this.statsService.revenusMonthly(2, false),
      chargesBwd: this.statsService.chargesMonthly(2, false),
      factures:   this.facturesService.list(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ revenusBwd, chargesBwd, factures }) => {
        this.revenusTrendPct = this.trendPct(revenusBwd);
        this.chargesTrendPct = this.trendPct(chargesBwd);
        // Filter factures issued THIS month and compute paid ratio.
        const now = new Date();
        const sameMonth = (iso?: string) => {
          if (!iso) return false;
          const d = new Date(iso);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        };
        const monthly = (factures || []).filter((f: any) => sameMonth(f.issueDate));
        this.factureCountMois = monthly.length;
        this.facturePaidCount = monthly.filter((f: any) => f.statut === 'PAYEE').length;
        this.facturePaidPct = monthly.length
          ? Math.round((this.facturePaidCount / monthly.length) * 100)
          : 0;
      },
      error: (err) => console.warn('[HomeComponent] kpi data fetch failed', err),
    });
  }

  /** % change from the second-to-last month to the last one. Returns 0
   *  when the previous month has 0 (avoids division by zero). */
  private trendPct(rows: { month: string; total: number }[]): number {
    if (!rows || rows.length < 2) return 0;
    const last = rows[rows.length - 1].total || 0;
    const prev = rows[rows.length - 2].total || 0;
    if (prev <= 0) return 0;
    return Math.round(((last - prev) / prev) * 1000) / 10; // 1 decimal
  }

  // The three rendering methods below are no longer wired (the cards are
  // chartless) but kept as reference for future sparkline experiments.
  private renderKpiCharts(
    revenus: { month: string; total: number }[],
    charges: { month: string; total: number }[],
  ): void {
    const revData = revenus.map((r) => r.total);
    const revCats = revenus.map((r) => r.month);
    const chgData = charges.map((r) => r.total);
    const chgCats = charges.map((r) => r.month);

    // ── Card 1 — Revenus, current month + 5 future months area sparkline ──
    // We force yaxis.min = 0 so a constant series (e.g. a fixed monthly
    // salary projected forward) still draws visible filled area instead
    // of collapsing to a flat zero-height ribbon.
    const revMax = Math.max(0, ...revData);
    this.replaceChart('#chart1', {
      series: [{ name: 'Revenus', data: revData }],
      chart: { height: 105, type: 'area', sparkline: { enabled: true }, zoom: { enabled: false } },
      dataLabels: { enabled: false },
      stroke: { width: 3, curve: 'smooth' },
      fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#fc185a'], shadeIntensity: 1, type: 'vertical', opacityFrom: 0.8, opacityTo: 0.2 } },
      colors: ['#ffc107'],
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' }, marker: { show: false } },
      xaxis: { categories: revCats },
      yaxis: { min: 0, max: revMax > 0 ? revMax * 1.1 : 1 },
      markers: { size: 4, strokeWidth: 0, hover: { size: 6 } },
    });

    // ── Card 2 — Charges, current month + 5 future months vertical bars ──
    const chgMax = Math.max(0, ...chgData);
    this.replaceChart('#chart3', {
      series: [{ name: 'Charges', data: chgData }],
      chart: { height: 120, type: 'bar', sparkline: { enabled: true }, zoom: { enabled: false } },
      dataLabels: { enabled: false },
      stroke: { width: 1, curve: 'smooth', color: ['transparent'] },
      fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#7928ca'], shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1, stops: [0, 100, 100, 100] } },
      colors: ['#ff0080'],
      plotOptions: { bar: { horizontal: false, borderRadius: 4, borderRadiusApplication: 'around', columnWidth: '45%' } },
      tooltip: { theme: 'dark', y: { formatter: (v: number) => v.toLocaleString('fr') + ' DT' }, marker: { show: false } },
      xaxis: { categories: chgCats },
      yaxis: { min: 0, max: chgMax > 0 ? chgMax * 1.1 : 1 },
    });

    // ── Card 3 — Factures, radial gauge of % paid this month ──
    this.replaceChart('#chart7', {
      series: [this.facturePaidPct],
      chart: { height: 180, type: 'radialBar', toolbar: { show: false } },
      plotOptions: {
        radialBar: {
          startAngle: -115, endAngle: 115,
          hollow: { margin: 0, size: '70%', background: 'transparent' },
          track: { background: 'rgba(0,0,0,0.1)', strokeWidth: '67%', margin: 0 },
          dataLabels: {
            show: true,
            name: { show: true, offsetY: -8, color: '#888', fontSize: '11px', fontWeight: 600 },
            value: { offsetY: 6, color: 'inherit', fontSize: '22px', fontWeight: 700, show: true,
              formatter: (v: number) => v + ' %' },
          },
        },
      },
      fill: { type: 'gradient', gradient: { shade: 'dark', type: 'horizontal', shadeIntensity: 0.5, gradientToColors: ['#22c55e'], inverseColors: false, opacityFrom: 1, opacityTo: 1, stops: [0, 100] } },
      colors: ['#16a34a'],
      stroke: { lineCap: 'round' },
      labels: ['Payées'],
    });
  }

  /** Clear the container and mount a fresh ApexCharts instance there. */
  private replaceChart(selector: string, options: any): void {
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      (el as HTMLElement).innerHTML = '';
      const chart = new ApexCharts(el, options);
      chart.render();
    } catch (e) {
      console.warn('[HomeComponent] replaceChart failed for', selector, e);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    try {
$(".data-attributes span").peity("donut")
    } catch (e) { console.warn('[home] inline script 1 failed', e); }
    try {
new PerfectScrollbar(".user-list")
    } catch (e) { console.warn('[home] inline script 2 failed', e); }
    try {
(function(){
  var themeMap = {
    'blue-theme':'BlueTheme','light':'LightTheme','dark':'DarkTheme',
    'semi-dark':'SemiDarkTheme','bodered-theme':'BoderedTheme'
  };
  document.addEventListener('DOMContentLoaded', function(){
    var saved = localStorage.getItem('fb-theme') || 'blue-theme';
    document.querySelectorAll('input[name="theme-options"]').forEach(function(r){ r.checked = false; });
    var el = document.getElementById(themeMap[saved]);
    if(el) el.checked = true;
    Object.keys(themeMap).forEach(function(theme){
      var btn = document.getElementById(themeMap[theme]);
      if(!btn) return;
      btn.addEventListener('change', function(){
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('fb-theme', theme);
      });
    });
  });
})();
    } catch (e) { console.warn('[home] inline script 3 failed', e); }
    // Inline script 4 (sidebar stats-toggle) removed — main-layout handles it.
    //
    // Inline script 5 below previously rendered chart1/3/7 with hardcoded
    // mock data. We removed it because `renderKpiCharts()` now does this
    // with the real backend series; keeping both made the cards either
    // empty (race condition wins) or duplicated (mock SVG lingers under
    // the new one). The mock chart4/5/6/8 anchors don't exist in the HTML
    // so dropping that block doesn't break anything visible.
    /* removed-mock-charts-marker */
    if (false) {
$(function () {
    "use strict";

var options = {
    series: [{ name: "Total Accounts", data: [4, 10, 25, 12, 25, 18, 40, 22, 7] }],
    chart: { height: 105, type: 'area', sparkline: { enabled: !0 }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { width: 3, curve: 'smooth' },
    fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#fc185a'], shadeIntensity: 1, type: 'vertical', opacityFrom: 0.8, opacityTo: 0.2 } },
    colors: ["#ffc107"],
    tooltip: { theme: "dark", fixed: { enabled: !1 }, x: { show: !1 }, y: { title: { formatter: function (e) { return "" } } }, marker: { show: !1 } },
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'] }
};
var chart = new ApexCharts(document.querySelector("#chart1"), options);
chart.render();

    var options = {
        series: [{ name: "Net Sales", data: [4, 10, 12, 17, 25, 30, 40, 55, 68] }],
        chart: { height: 120, type: 'bar', sparkline: { enabled: !0 }, zoom: { enabled: false } },
        dataLabels: { enabled: false },
        stroke: { width: 1, curve: 'smooth', color: ['transparent'] },
        fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#7928ca'], shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1, stops: [0, 100, 100, 100] } },
        colors: ["#ff0080"],
        plotOptions: { bar: { horizontal: false, borderRadius: 4, borderRadiusApplication: 'around', borderRadiusWhenStacked: 'last', columnWidth: '45%' } },
        tooltip: { theme: "dark", fixed: { enabled: !1 }, x: { show: !1 }, y: { title: { formatter: function (e) { return "" } } }, marker: { show: !1 } },
        xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'] }
    };
    var chart = new ApexCharts(document.querySelector("#chart3"), options);
    chart.render();

    var options = {
        series: [{ name: "Net Sales", data: [4, 25, 14, 34, 10, 39] }],
        chart: { height: 105, type: 'line', sparkline: { enabled: !0 }, zoom: { enabled: false } },
        dataLabels: { enabled: false },
        stroke: { width: 3, curve: 'straight' },
        fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#00f2fe'], shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1, stops: [0, 100, 100, 100] } },
        colors: ["#ee0979"],
        tooltip: { theme: "dark", fixed: { enabled: !1 }, x: { show: !1 }, y: { title: { formatter: function (e) { return "" } } }, marker: { show: !1 } },
        markers: { show: !1, size: 5 },
        xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'] }
    };
    var chart = new ApexCharts(document.querySelector("#chart4"), options);
    chart.render();

    var options = {
        series: [{ name: "Desktops", data: [14, 41, 35, 51, 25, 18, 21, 35, 15] }],
        chart: { foreColor: "#9ba7b2", height: 280, type: 'bar', toolbar: { show: !1 }, sparkline: { enabled: !1 }, zoom: { enabled: false } },
        dataLabels: { enabled: false },
        stroke: { width: 1, curve: 'smooth' },
        plotOptions: { bar: { horizontal: false, borderRadius: 4, borderRadiusApplication: 'around', borderRadiusWhenStacked: 'last', columnWidth: '45%' } },
        fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#009efd'], shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1, stops: [0, 100, 100, 100] } },
        colors: ["#2af598"],
        grid: { show: true, borderColor: 'rgba(255, 255, 255, 0.1)' },
        xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'] },
        tooltip: { theme: "dark", marker: { show: !1 } }
    };
    var chart = new ApexCharts(document.querySelector("#chart5"), options);
    chart.render();

    var options = {
        series: [58, 25, 25],
        chart: { height: 290, type: 'donut' },
        legend: { position: 'bottom', show: !1 },
        fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#ee0979', '#17ad37', '#ec6ead'], shadeIntensity: 1, type: 'vertical', opacityFrom: 1, opacityTo: 1 } },
        colors: ["#ff6a00", "#98ec2d", "#3494e6"],
        dataLabels: { enabled: !1 },
        plotOptions: { pie: { donut: { size: "85%" } } },
        responsive: [{ breakpoint: 480, options: { chart: { height: 270 }, legend: { position: 'bottom', show: !1 } } }]
    };
    var chart = new ApexCharts(document.querySelector("#chart6"), options);
    chart.render();

var options = {
    series: [78],
    chart: { height: 180, type: 'radialBar', toolbar: { show: false } },
    plotOptions: { radialBar: { startAngle: -115, endAngle: 115, hollow: { margin: 0, size: '80%', background: 'transparent', image: undefined, imageOffsetX: 0, imageOffsetY: 0, position: 'front', dropShadow: { enabled: false, top: 3, left: 0, blur: 4, opacity: 0.24 } }, track: { background: 'rgba(0, 0, 0, 0.1)', strokeWidth: '67%', margin: 0, dropShadow: { enabled: false, top: -3, left: 0, blur: 4, opacity: 0.35 } }, dataLabels: { show: true, name: { offsetY: -10, show: false, color: '#888', fontSize: '17px' }, value: { offsetY: 10, color: '#111', fontSize: '24px', show: true } } } },
    fill: { type: 'gradient', gradient: { shade: 'dark', type: 'horizontal', shadeIntensity: 0.5, gradientToColors: ['#ffd200'], inverseColors: true, opacityFrom: 1, opacityTo: 1, stops: [0, 100] } },
    colors: ["#ee0979"],
    stroke: { lineCap: 'round' },
    labels: ['Total Orders'],
};
var chart = new ApexCharts(document.querySelector("#chart7"), options);
chart.render();

var options = {
    series: [{ name: "Total Sales", data: [4, 10, 25, 12, 25, 18, 40, 22, 7] }],
    chart: { height: 210, type: 'area', sparkline: { enabled: !0 }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { width: 3, curve: 'straight' },
    fill: { type: 'gradient', gradient: { shade: 'dark', gradientToColors: ['#17ad37'], shadeIntensity: 1, type: 'vertical', opacityFrom: 0.7, opacityTo: 0.0 } },
    colors: ["#98ec2d"],
    tooltip: { theme: "dark", fixed: { enabled: !1 }, x: { show: !1 }, y: { title: { formatter: function (e) { return "" } } }, marker: { show: !1 } },
    markers: { show: !1, size: 5 },
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'] }
};
var chart = new ApexCharts(document.querySelector("#chart8"), options);
chart.render();

});
    }
  }
}

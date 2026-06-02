
$(function () {
  "use strict";

  // ── Theme persistence ──
  var savedTheme = localStorage.getItem('fb-theme') || 'blue-theme';
  $("html").attr("data-bs-theme", savedTheme);
  var themeRadioMap = {
    'blue-theme': 'BlueTheme', 'light': 'LightTheme',
    'dark': 'DarkTheme', 'semi-dark': 'SemiDarkTheme', 'bodered-theme': 'BoderedTheme'
  };
  if (themeRadioMap[savedTheme]) {
    $('#' + themeRadioMap[savedTheme]).prop('checked', true);
  }

  /* scrollbar  only init if element exists */
  if ($(".notify-list").length)  new PerfectScrollbar(".notify-list");

  /* ── Sidebar toggle ── */
  $(".btn-toggle").click(function () {
    if ($("body").hasClass("toggled")) {
      $("body").removeClass("toggled sidebar-hovered");
      $(".sidebar-wrapper").off("mouseenter mouseleave");
    } else {
      $("body").addClass("toggled");
      $(".sidebar-wrapper").on("mouseenter", function () {
        $("body").addClass("sidebar-hovered");
      }).on("mouseleave", function () {
        $("body").removeClass("sidebar-hovered");
      });
    }
  });

  /* menu */
  $(function () { $('#sidenav').metisMenu(); });
  $(".sidebar-close").on("click", function () { $("body").removeClass("toggled sidebar-hovered"); });
  /* overlay closes sidebar on mobile */
  $(".overlay").on("click", function () { $("body").removeClass("toggled sidebar-hovered"); });

  /* dark mode button */
  $(".dark-mode i").click(function () {
    $(this).text(function (i, v) { return v === 'dark_mode' ? 'light_mode' : 'dark_mode'; });
  });
  $(".dark-mode").click(function () {
    var newTheme = $("html").attr("data-bs-theme") === 'dark' ? 'light' : 'dark';
    $("html").attr("data-bs-theme", newTheme);
    localStorage.setItem('fb-theme', newTheme);
  });

  /* sticky header */
  $(window).on("scroll", function () {
    if ($(this).scrollTop() > 60) { $('.top-header .navbar').addClass('sticky-header'); }
    else { $('.top-header .navbar').removeClass('sticky-header'); }
  });

  /* email */
  $(".email-toggle-btn").on("click", function() { $(".email-wrapper").toggleClass("email-toggled"); });
  $(".email-toggle-btn-mobile").on("click", function() { $(".email-wrapper").removeClass("email-toggled"); });
  $(".compose-mail-btn").on("click", function() { $(".compose-mail-popup").show(); });
  $(".compose-mail-close").on("click", function() { $(".compose-mail-popup").hide(); });

  /* chat */
  $(".chat-toggle-btn").on("click", function() { $(".chat-wrapper").toggleClass("chat-toggled"); });
  $(".chat-toggle-btn-mobile").on("click", function() { $(".chat-wrapper").removeClass("chat-toggled"); });

  /* switcher  save theme to localStorage so ALL pages update */
  function applyTheme(theme) {
    $("html").attr("data-bs-theme", theme);
    localStorage.setItem('fb-theme', theme);
  }
  $("#BlueTheme").on("click",    function () { applyTheme("blue-theme"); });
  $("#LightTheme").on("click",   function () { applyTheme("light"); });
  $("#DarkTheme").on("click",    function () { applyTheme("dark"); });
  $("#SemiDarkTheme").on("click",function () { applyTheme("semi-dark"); });
  $("#BoderedTheme").on("click", function () { applyTheme("bodered-theme"); });

  /* Sync theme radio buttons with saved theme */
  $(document).ready(function(){
    var saved = localStorage.getItem('fb-theme') || 'blue-theme';
    $('input[name="theme-options"]').each(function(){ $(this).prop('checked', false); });
    var radioId = themeRadioMap[saved];
    if (radioId) $('#' + radioId).prop('checked', true);
    $('input[name="theme-options"]').on('change', function(){
      var map = { BlueTheme:'blue-theme', LightTheme:'light', DarkTheme:'dark', SemiDarkTheme:'semi-dark', BoderedTheme:'bodered-theme' };
      applyTheme(map[this.id]);
    });
  });

  /* menu active */
  $(function () {
    for (var e = window.location, o = $(".metismenu li a").filter(function () {
      return this.href == e;
    }).addClass("").parent().addClass("mm-active"); o.is("li");)
      o = o.parent("").addClass("mm-show").parent("").addClass("mm-active");
  });

  // ── Language (i18n) ──────────────────────────────────────────────────────
  var translations = {
    fr: {},
    en: {
      "Famille": "Family", "Revenus": "Income", "Charges": "Expenses",
      "Factures": "Bills", "Statistiques": "Statistics", "Notifications": "Notifications",
      "Paramètres": "Settings", "Assistant IA": "AI Assistant",
      "Solde du mois": "Monthly Balance", "Épargne cumulée": "Cumulative Savings",
      "Total Charges": "Total Expenses", "Factures à régler": "Bills to pay",
      "Déconnexion": "Logout", "Mon Profil": "My Profile", "Ma famille": "My Family",
      "Suivi Budgétaire": "Budget Tracking", "Dernières transactions": "Latest Transactions",
      "Membres de la famille": "Family Members", "Bienvenue": "Welcome",
      "Enregistrer": "Save", "Annuler": "Cancel", "Accueil": "Home"
    },
    ar: {
      "Famille": "العائلة", "Revenus": "الدخل", "Charges": "المصاريف",
      "Factures": "الفواتير", "Statistiques": "الإحصائيات", "Notifications": "الإشعارات",
      "Paramètres": "الإعدادات", "Assistant IA": "المساعد الذكي",
      "Solde du mois": "رصيد الشهر", "Épargne cumulée": "المدخرات المتراكمة",
      "Total Charges": "إجمالي المصاريف", "Factures à régler": "فواتير للسداد",
      "Déconnexion": "تسجيل الخروج", "Mon Profil": "ملفي الشخصي", "Ma famille": "عائلتي",
      "Suivi Budgétaire": "متابعة الميزانية", "Dernières transactions": "آخر المعاملات",
      "Membres de la famille": "أفراد العائلة", "Bienvenue": "مرحباً",
      "Enregistrer": "حفظ", "Annuler": "إلغاء", "Accueil": "الرئيسية"
    }
  };

  var currentLang = localStorage.getItem('fb-lang') || 'fr';
  applyLanguage(currentLang);

  function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('fb-lang', lang);
    if (lang === 'ar') {
      $("html").attr("dir", "rtl").attr("lang", "ar");
    } else {
      $("html").attr("dir", "ltr").attr("lang", lang);
    }
    $(".lang-btn").removeClass("active btn-primary").addClass("btn-outline-secondary");
    $(".lang-btn[data-lang='" + lang + "']").removeClass("btn-outline-secondary").addClass("btn-primary active");
    if (lang !== 'fr') {
      var dict = translations[lang] || {};
      $("[data-i18n]").each(function() {
        var key = $(this).attr("data-i18n");
        if (dict[key]) $(this).text(dict[key]);
      });
    } else {
      $("[data-i18n]").each(function() {
        var orig = $(this).attr("data-i18n-fr");
        if (orig) $(this).text(orig);
      });
    }
  }

  $(document).on("click", ".lang-btn", function() {
    applyLanguage($(this).data("lang"));
  });

});

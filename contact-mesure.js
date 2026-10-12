/* Bulle WhatsApp, bandeau de consentement et mesure d'audience (Google Analytics 4).
   Ajouté le 12/10/2026. Chargé par script.js, donc présent sur toutes les pages sans
   toucher à leur HTML.

   Règle tenue par ce fichier : Google Analytics n'est chargé, et aucun cookie de mesure
   n'est déposé, qu'après un « Accepter » du visiteur. Un refus arrête la mesure et efface
   les cookies déjà posés. Le choix est gardé six mois dans le navigateur. */
(function () {
  'use strict';
  if (window.__contactMesure) return;
  window.__contactMesure = true;

  var CFG = {
    mesure: 'G-EDVBQY8EN2',
    whatsapp: '33615513604',
    message: 'Bonjour, je vous contacte depuis le site fiducia-ia.com.',
    cle: 'fia_consent',
    infos: '/privacy-policy#cookies',
    evite: '.action-bar',  // barre d'action mobile fixée en bas d'écran (style.css)
    z: 40,                 // sous la navigation (50), au-dessus des calques de fond (30)
    police: "var(--font-body,system-ui),system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
    fond: '#0d1424', texte: '#eaf1fb', trait: 'rgba(255,255,255,.16)', accent: '#37c8ff', surAccent: '#05070d'
  };

  var MOIS6 = 15552000000;          // durée de conservation du choix, en millisecondes
  var MOIS13 = 33696000;            // durée de vie des cookies de mesure, en secondes
  var bulle = null, hote = null, hoteLien = null, mesureActive = false, baliseInjectee = false;

  /* ---------- Choix du visiteur ---------- */
  function lire() {
    try {
      var c = JSON.parse(localStorage.getItem(CFG.cle) || 'null');
      return (c && c.v === 1 && c.exp > Date.now()) ? c : null;
    } catch (e) { return null; }
  }
  function ecrire(accepte) {
    try {
      localStorage.setItem(CFG.cle, JSON.stringify({ v: 1, a: accepte, exp: Date.now() + MOIS6, d: new Date().toISOString() }));
    } catch (e) {}
  }

  /* ---------- Google Analytics : chargé seulement après accord ---------- */
  function chargerMesure() {
    if (mesureActive) return;
    mesureActive = true;
    window['ga-disable-' + CFG.mesure] = false;
    if (baliseInjectee) {            // accord redonné après un refus dans la même page
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
      window.gtag('config', CFG.mesure, { cookie_expires: MOIS13 });
      return;
    }
    baliseInjectee = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', CFG.mesure, { cookie_expires: MOIS13 });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CFG.mesure;
    document.head.appendChild(s);
  }
  function arreterMesure() {
    window['ga-disable-' + CFG.mesure] = true;
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
    var noms = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return n === '_ga' || n.indexOf('_ga_') === 0; });
    var hoteSite = location.hostname, racine = hoteSite.split('.').slice(-2).join('.');
    noms.forEach(function (n) {
      ['', '; domain=' + hoteSite, '; domain=.' + hoteSite, '; domain=.' + racine].forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
    mesureActive = false;
  }
  function envoyer(nom, params) {
    if (!mesureActive || typeof window.gtag !== 'function') return;
    window.gtag('event', nom, params || {});
  }

  /* ---------- Événements de contact ---------- */
  function texte(a) {
    return (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '', nom = null;
    if (h.indexOf('wa.me/') > -1 || h.indexOf('api.whatsapp.com') > -1) nom = 'contact_whatsapp';
    else if (h.indexOf('tel:') === 0) nom = 'contact_telephone';
    else if (h.indexOf('mailto:') === 0) nom = 'contact_email';
    else if (h.indexOf('calendly.com') > -1 || h.indexOf('zcal.co') > -1) nom = 'prise_rdv';
    else if (/^https?:\/\/(t|telegram)\.me\//.test(h)) nom = 'clic_telegram';
    if (nom) envoyer(nom, { lien_texte: texte(a) });
  }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    envoyer('contact_formulaire', { formulaire: f.getAttribute('name') || f.getAttribute('id') || 'sans-nom' });
  }, true);

  /* ---------- Placement : ne recouvrir ni une barre fixe du site, ni le bandeau ---------- */
  function occupe(cote) {
    var h = 0, els = [], larg = window.innerWidth, haut = window.innerHeight;
    if (CFG.evite) { var b = document.querySelector(CFG.evite); if (b) els.push(b); }
    if (hote) els.push(hote);
    els.forEach(function (el) {
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.position !== 'fixed') return;
      var r = el.getBoundingClientRect();
      if (!r.height || r.bottom < haut - 60) return;
      var gene = cote === 'droite' ? r.right > larg - 92 : r.left < 110;
      if (gene) h = Math.max(h, haut - r.top);
    });
    return h;
  }
  function placer() {
    var d = occupe('droite'), g = occupe('gauche');
    if (bulle) bulle.style.setProperty('bottom', (d ? d + 12 : 20) + 'px', 'important');
    if (hoteLien) hoteLien.style.setProperty('bottom', (g ? g + 6 : 8) + 'px', 'important');
  }
  /* Le bandeau n'a pas encore de hauteur au moment où il est inséré : on replace après le rendu. */
  function replacer() {
    placer();
    if (window.requestAnimationFrame) window.requestAnimationFrame(placer);
    window.setTimeout(placer, 300);
  }

  /* ---------- Bulle WhatsApp ---------- */
  function creerBulle() {
    var st = document.createElement('style');
    st.textContent = 'a.bulle-whatsapp{position:fixed!important;right:20px!important;bottom:20px;z-index:' + CFG.z + '!important;'
      + 'width:56px!important;height:56px!important;display:flex!important;align-items:center!important;justify-content:center!important;'
      + 'margin:0!important;padding:0!important;border:0!important;border-radius:50%!important;background:#25D366!important;'
      + 'box-shadow:0 6px 20px rgba(0,0,0,.35)!important;text-decoration:none!important;opacity:1!important;'
      + 'transition:transform .18s ease,box-shadow .18s ease,bottom .2s ease}'
      + 'a.bulle-whatsapp:hover{transform:scale(1.06);box-shadow:0 8px 26px rgba(0,0,0,.45)!important}'
      + 'a.bulle-whatsapp:focus-visible{outline:3px solid #fff!important;outline-offset:3px!important}'
      + 'a.bulle-whatsapp svg{width:30px!important;height:30px!important;fill:#fff!important;display:block!important}'
      + '@media (prefers-reduced-motion:reduce){a.bulle-whatsapp{transition:none}}'
      + '@media print{a.bulle-whatsapp{display:none!important}}';
    document.head.appendChild(st);

    bulle = document.createElement('a');
    bulle.className = 'bulle-whatsapp';
    bulle.href = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(CFG.message);
    bulle.target = '_blank';
    bulle.rel = 'noopener';
    bulle.setAttribute('aria-label', 'Écrire sur WhatsApp');
    bulle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
    document.body.appendChild(bulle);
  }

  /* ---------- Bandeau de consentement (DOM isolé : le style du site ne l'atteint pas) ---------- */
  var CSS = ':host{all:initial}*{box-sizing:border-box;margin:0}'
    + '.c{background:' + CFG.fond + ';color:' + CFG.texte + ';border:1px solid ' + CFG.trait + ';border-radius:14px;'
    + 'box-shadow:0 12px 40px rgba(0,0,0,.55);padding:18px 20px;font:15px/1.55 ' + CFG.police + '}'
    + 'p{margin:0 0 14px}a{color:' + CFG.accent + '}'
    + '.b{display:flex;gap:10px;flex-wrap:wrap}'
    + '.b button{flex:1 1 160px;min-height:44px;padding:11px 18px;border-radius:9px;cursor:pointer;'
    + 'font:600 15px/1 ' + CFG.police + ';background:transparent;color:' + CFG.texte + ';border:1px solid ' + CFG.accent + '}'
    + '.b button:hover,.b button:focus-visible{background:' + CFG.accent + ';color:' + CFG.surAccent + ';outline:none}'
    + '.l{background:none;border:0;color:' + CFG.texte + ';opacity:.6;text-decoration:underline;cursor:pointer;'
    + 'font:12px ' + CFG.police + ';padding:4px}.l:hover,.l:focus-visible{opacity:1}'
    + '@media(max-width:520px){.c{padding:16px}}';
  var POS = 'position:fixed!important;left:16px!important;right:16px!important;bottom:16px!important;top:auto!important;'
    + 'width:auto!important;max-width:720px!important;height:auto!important;margin:0 auto!important;padding:0!important;'
    + 'border:0!important;display:block!important;visibility:visible!important;opacity:1!important;transform:none!important;'
    + 'z-index:2147483000!important';
  var POSL = 'position:fixed!important;left:12px!important;right:auto!important;bottom:8px;top:auto!important;'
    + 'width:auto!important;height:auto!important;margin:0!important;padding:0!important;border:0!important;'
    + 'display:block!important;z-index:' + CFG.z + '!important';

  function racine(el) {
    var r = el.attachShadow({ mode: 'open' }), s = document.createElement('style');
    s.textContent = CSS;
    r.appendChild(s);
    return r;
  }
  function choisir(accepte) {
    ecrire(accepte);
    if (accepte) chargerMesure(); else arreterMesure();
    if (hote) { hote.remove(); hote = null; }
    lienReglage();
    replacer();
  }
  function afficherBandeau() {
    if (hote) return;
    hote = document.createElement('div');
    hote.id = 'bandeau-cookies';
    hote.setAttribute('style', POS);
    var r = racine(hote);
    var c = document.createElement('div');
    c.className = 'c';
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-label', 'Consentement à la mesure d’audience');
    var p = document.createElement('p');
    p.innerHTML = 'Ce site utilise Google Analytics pour mesurer sa fréquentation : pages consultées et prises de contact. '
      + 'Aucune publicité. Rien n’est mesuré sans votre accord, et refuser ne change rien à votre navigation. '
      + '<a href="' + CFG.infos + '">En savoir plus</a>.';
    var b = document.createElement('div');
    b.className = 'b';
    var non = document.createElement('button'); non.type = 'button'; non.textContent = 'Refuser';
    var oui = document.createElement('button'); oui.type = 'button'; oui.textContent = 'Accepter';
    non.addEventListener('click', function () { choisir(false); });
    oui.addEventListener('click', function () { choisir(true); });
    b.appendChild(non); b.appendChild(oui);
    c.appendChild(p); c.appendChild(b); r.appendChild(c);
    document.body.appendChild(hote);
    if (window.ResizeObserver) new ResizeObserver(placer).observe(hote);
    replacer();
  }
  function lienReglage() {
    if (hoteLien) return;
    hoteLien = document.createElement('div');
    hoteLien.id = 'reglage-cookies';
    hoteLien.setAttribute('style', POSL);
    var r = racine(hoteLien);
    var l = document.createElement('button');
    l.type = 'button'; l.className = 'l'; l.textContent = 'Cookies';
    l.addEventListener('click', function () { hoteLien.remove(); hoteLien = null; afficherBandeau(); });
    r.appendChild(l);
    document.body.appendChild(hoteLien);
  }

  /* ---------- Démarrage ---------- */
  function demarrer() {
    creerBulle();
    var c = lire();
    if (c) { if (c.a) chargerMesure(); lienReglage(); } else { afficherBandeau(); }
    replacer();
    window.addEventListener('resize', placer);
    window.addEventListener('load', placer);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();

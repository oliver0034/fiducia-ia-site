/* Fiducia IA — interactions */
(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----- Menu mobile ----- */
  var burger = document.querySelector(".nav__burger");
  var links = document.querySelector(".nav__links");
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ----- H1 : apparition mot à mot puis dégradé animé continu ----- */
  var h1 = document.querySelector(".hero h1, .page-hero h1");
  if (h1 && reducedMotion) {
    h1.classList.add("h1-grad");
  } else if (h1) {
    {
      var wi = 0;
      var wrapWords = function (node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            var frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(function (part) {
              if (/^\s+$/.test(part) || part === "") {
                frag.appendChild(document.createTextNode(part));
              } else {
                var s = document.createElement("span");
                s.className = "w";
                s.style.setProperty("--d", wi++);
                s.textContent = part;
                frag.appendChild(s);
              }
            });
            node.replaceChild(frag, child);
          } else if (
            child.nodeType === 1 &&
            child.tagName !== "BR" &&
            !child.classList.contains("typed-line") &&
            !child.querySelector(".typed-line")
          ) {
            wrapWords(child);
          }
        });
      };
      wrapWords(h1);
      /* Une fois l'entrée jouée, on retire les spans et on passe
         au dégradé animé sur l'ensemble du titre */
      setTimeout(function () {
        h1.querySelectorAll(".w").forEach(function (s) {
          s.replaceWith(document.createTextNode(s.textContent));
        });
        h1.normalize();
        h1.classList.add("h1-grad");
      }, wi * 70 + 850);
    }
  }

  /* ----- Spotlight des cartes (suit le curseur) ----- */
  document.querySelectorAll(".offer, .step").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ----- Révélation au scroll ----- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reducedMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ----- Effet de frappe (hero) ----- */
  var typedEl = document.getElementById("typed");
  if (typedEl) {
    var phrases = JSON.parse(typedEl.getAttribute("data-phrases") || "[]");
    if (reducedMotion || phrases.length === 0) {
      typedEl.textContent = phrases[0] || "";
    } else {
      var pi = 0, ci = 0, deleting = false;
      (function tick() {
        var phrase = phrases[pi];
        typedEl.textContent = phrase.slice(0, ci);
        var delay = deleting ? 28 : 55;
        if (!deleting && ci === phrase.length) { delay = 2200; deleting = true; }
        else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 350; }
        ci += deleting ? -1 : 1;
        setTimeout(tick, delay);
      })();
    }
  }

  /* ----- Vagues lumineuses WebGL (hero accueil) ----- */
  var shaderCanvas = document.getElementById("shader-canvas");
  if (shaderCanvas && !reducedMotion) {
    var gl = shaderCanvas.getContext("webgl", { antialias: false });
    if (gl) {
      var vsSrc = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
      /* Shader d'ondes — recoloré charte Fiducia (bleu #2e8fff / cyan #37c8ff) */
      var fsSrc =
        "precision highp float;" +
        "uniform vec2 res;uniform float t;" +
        "void main(){" +
        "vec2 p=(gl_FragCoord.xy*2.-res)/min(res.x,res.y);" +
        "float d=length(p)*.05;" +
        "float a=.05/abs(p.y+sin((p.x*(1.+d)+t))*.5);" +
        "float b=.05/abs(p.y+sin((p.x+t))*.5);" +
        "float c=.05/abs(p.y+sin((p.x*(1.-d)+t))*.5);" +
        "float i=(a+b+c)*.8;" +
        "vec3 tint=mix(vec3(.11,.45,1.),vec3(.22,.78,1.),clamp(p.x*.5+.5,0.,1.));" + /* bleu #2e8fff -> cyan #37c8ff */
        "vec3 col=i*tint;" +
        "col+=vec3(.019,.027,.051);" + /* fond #05070d */
        "gl_FragColor=vec4(col,1.);}";

      var compile = function (type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      var prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(prog);
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      var uRes = gl.getUniformLocation(prog, "res");
      var uT = gl.getUniformLocation(prog, "t");
      var dpr = Math.min(devicePixelRatio || 1, 1.5);

      var resizeGL = function () {
        shaderCanvas.width = shaderCanvas.offsetWidth * dpr;
        shaderCanvas.height = shaderCanvas.offsetHeight * dpr;
        gl.viewport(0, 0, shaderCanvas.width, shaderCanvas.height);
      };
      resizeGL();
      window.addEventListener("resize", resizeGL);

      var t0 = 0;
      (function drawGL() {
        t0 += 0.01;
        gl.uniform2f(uRes, shaderCanvas.width, shaderCanvas.height);
        gl.uniform1f(uT, t0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        requestAnimationFrame(drawGL);
      })();
    }
  }

  /* ----- Chiffres réels IA : donuts + compteurs du bandeau ----- */
  var countUp = function (el, target, decimals, prefix, suffix) {
    var fmt = function (v) {
      return prefix + v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    };
    if (reducedMotion) { el.textContent = fmt(target); return; }
    var start = performance.now(), dur = 1300;
    (function step(now) {
      var k = Math.min(1, (now - start) / dur);
      k = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(target * k);
      if (k < 1) requestAnimationFrame(step);
    })(start);
    setTimeout(function () { el.textContent = fmt(target); }, dur + 150);
  };

  var donuts = document.querySelectorAll(".donut");
  if (donuts.length) {
    donuts.forEach(function (card, idx) {
      var ring = card.querySelector(".donut-ring");
      var value = Math.abs(parseFloat(card.getAttribute("data-value")));
      var gid = "dg-" + idx;
      var R = 54, C = (2 * Math.PI * R).toFixed(1);
      ring.insertAdjacentHTML("afterbegin",
        '<svg viewBox="0 0 128 128" aria-hidden="true">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#2e8fff"/><stop offset="1" stop-color="#37c8ff"/></linearGradient></defs>' +
        '<circle class="ring-bg" cx="64" cy="64" r="' + R + '"/>' +
        '<circle class="ring-arc" cx="64" cy="64" r="' + R + '" stroke="url(#' + gid + ')"' +
        ' stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/>' +
        "</svg>"
      );
    });

    var armDonut = function (card) {
      if (card.getAttribute("data-armed")) return;
      card.setAttribute("data-armed", "1");
      var value = parseFloat(card.getAttribute("data-value"));
      var mag = Math.min(100, Math.abs(value));
      var arc = card.querySelector(".ring-arc");
      var C = parseFloat(arc.getAttribute("stroke-dasharray"));
      arc.style.strokeDashoffset = (C * (1 - mag / 100)).toFixed(1);
      var val = card.querySelector(".donut-val");
      var decimals = card.getAttribute("data-decimals") === "1" ? 1 : 0;
      countUp(val, Math.abs(value), decimals, value < 0 ? "−" : "+", card.getAttribute("data-suffix") || " %");
    };
    var armProof = function (el) {
      if (el.getAttribute("data-armed")) return;
      el.setAttribute("data-armed", "1");
      countUp(el, parseFloat(el.getAttribute("data-count")), 0, "", el.getAttribute("data-suffix") || " %");
    };

    if ("IntersectionObserver" in window && !reducedMotion) {
      var statIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          if (e.target.classList.contains("donut")) armDonut(e.target);
          else armProof(e.target);
          statIO.unobserve(e.target);
        });
      }, { threshold: 0.4 });
      donuts.forEach(function (d) { statIO.observe(d); });
      document.querySelectorAll(".proof strong[data-count]").forEach(function (p) { statIO.observe(p); });
    } else {
      donuts.forEach(armDonut);
      document.querySelectorAll(".proof strong[data-count]").forEach(armProof);
    }
  }

  /* ----- Simulateur agents IA (page agents) ----- */
  var sim = document.getElementById("sim-agents");
  if (sim) {
    var AUTOMATION = 0.6;   /* part du temps répétitif absorbée par l'agent (hypothèse affichée) */
    var WORKDAYS = 220;     /* jours travaillés par an */
    var DAY_HOURS = 8;      /* journée type pour la barre avant/après */

    var inN = document.getElementById("sim-n");
    var inH = document.getElementById("sim-hrep");
    var inC = document.getElementById("sim-cost");
    var outN = document.getElementById("sim-n-out");
    var outH = document.getElementById("sim-hrep-out");
    var outC = document.getElementById("sim-cost-out");
    var resH = document.getElementById("sim-res-h");
    var resE = document.getElementById("sim-res-eur");
    var resJ = document.getElementById("sim-res-j");

    var fr = function (v) { return Math.round(v).toLocaleString("fr-FR"); };

    /* Number Ticker : le chiffre roule vers sa nouvelle valeur */
    var tickTo = function (el, target, fmt) {
      var from = el._val || 0;
      el._val = target;
      if (reducedMotion) { el.textContent = fmt(target); return; }
      if (el._raf) cancelAnimationFrame(el._raf);
      var t0 = performance.now(), dur = 500;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        k = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(from + (target - from) * k);
        if (k < 1) el._raf = requestAnimationFrame(step);
      })(t0);
      setTimeout(function () { el.textContent = fmt(target); }, dur + 100);
    };

    var setSeg = function (id, hours, label) {
      var el = document.getElementById(id);
      el.style.width = (hours / DAY_HOURS) * 100 + "%";
      el.textContent = hours >= 1.2 ? label + " " + hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " h" : "";
    };

    /* Remplissage lumineux de la piste jusqu'au curseur */
    var paintTrack = function (input) {
      var pct = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty("--pct", pct + "%");
    };

    var updateSim = function () {
      var n = parseFloat(inN.value);
      var h = parseFloat(inH.value);
      var c = parseFloat(inC.value);
      outN.textContent = n + (n > 1 ? " personnes" : " personne");
      outH.textContent = h.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " h / jour";
      outC.textContent = c + " € / h";
      [inN, inH, inC].forEach(paintTrack);

      var freedPerYear = n * h * AUTOMATION * WORKDAYS;
      tickTo(resH, freedPerYear, function (v) { return fr(v) + " h"; });
      tickTo(resE, freedPerYear * c, function (v) { return fr(v) + " €"; });
      tickTo(resJ, freedPerYear / 7, function (v) { return fr(v) + " jours"; });

      /* Journée type : avant (valeur + répétitif) / après (répétitif résiduel + libéré) */
      setSeg("seg-avant-work", DAY_HOURS - h, "Cœur de métier");
      setSeg("seg-avant-rep", h, "Répétitif");
      setSeg("seg-apres-work", DAY_HOURS - h, "Cœur de métier");
      setSeg("seg-apres-rep", h * (1 - AUTOMATION), "Répétitif");
      setSeg("seg-apres-free", h * AUTOMATION, "Libéré");
    };

    [inN, inH, inC].forEach(function (input) {
      input.addEventListener("input", updateSim);
      /* Pulse + reflet sur les cartes de résultats au relâchement du curseur */
      input.addEventListener("change", function () {
        document.querySelectorAll(".sim-res").forEach(function (card) {
          card.classList.remove("pop");
          void card.offsetWidth;
          card.classList.add("pop");
        });
      });
    });
    updateSim();
  }

  /* ----- Graphe interactif des heures gagnées (formation / agents IA) ----- */
  var gainChart = document.getElementById("gain-chart");
  if (gainChart) {
    /* Hypothèse affichée sous le graphe : équipe de 5 personnes,
       2 h gagnées par jour et par personne, montée en charge progressive. */
    var PERIODS = {
      jours:    { n: 30, tick: 5, prefix: "J", perStep: 10,  caption: "sur 30 jours" },
      semaines: { n: 12, tick: 1, prefix: "S", perStep: 50,  caption: "sur 12 semaines" },
      mois:     { n: 12, tick: 1, prefix: "M", perStep: 210, caption: "sur 12 mois" }
    };
    var W = 640, H = 320, padL = 54, padR = 24, padT = 26, padB = 36;
    var currentPts = [], currentPeriod = null;

    var cumule = function (p) {
      var vals = [0], total = 0;
      for (var i = 1; i <= p.n; i++) {
        var adoption = Math.min(1, 0.35 + (0.65 * i) / (p.n / 3));
        total += p.perStep * adoption;
        vals.push(total);
      }
      return vals;
    };

    /* Courbe lissée : Catmull-Rom convertie en Bézier cubiques */
    var smoothPath = function (pts) {
      if (pts.length < 3) return "";
      var d = "M" + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        d += "C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c2x.toFixed(1) + " " + c2y.toFixed(1) + " " + p2.x.toFixed(1) + " " + p2.y.toFixed(1);
      }
      return d;
    };

    /* Compteur animé (total d'heures) */
    var animateCounter = function (el, target) {
      if (reducedMotion || !("requestAnimationFrame" in window)) {
        el.textContent = "≈ " + Math.round(target).toLocaleString("fr-FR") + " h";
        return;
      }
      var from = parseFloat((el.getAttribute("data-val") || "0")) || 0;
      var start = performance.now(), dur = 900;
      el.setAttribute("data-val", target);
      (function step(now) {
        var k = Math.min(1, (now - start) / dur);
        k = 1 - Math.pow(1 - k, 3); /* ease-out cubic */
        el.textContent = "≈ " + Math.round(from + (target - from) * k).toLocaleString("fr-FR") + " h";
        if (k < 1) requestAnimationFrame(step);
      })(start);
      /* Filet de sécurité si rAF est suspendu (onglet en arrière-plan) */
      setTimeout(function () {
        el.textContent = "≈ " + Math.round(target).toLocaleString("fr-FR") + " h";
      }, dur + 150);
    };

    var renderChart = function (key) {
      var p = PERIODS[key];
      currentPeriod = p;
      var vals = cumule(p);
      var max = vals[vals.length - 1];
      var X = function (i) { return padL + (i / p.n) * (W - padL - padR); };
      var Y = function (v) { return H - padB - (v / max) * (H - padT - padB); };

      currentPts = vals.map(function (v, i) { return { x: X(i), y: Y(v), v: v, i: i }; });
      var line = smoothPath(currentPts);
      var area = line + "L" + X(p.n).toFixed(1) + " " + (H - padB) + "L" + padL + " " + (H - padB) + "Z";

      var grid = "", labels = "";
      for (var g = 1; g <= 4; g++) {
        var gy = padT + ((H - padT - padB) * g) / 4;
        grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="rgba(56,152,255,0.10)" stroke-dasharray="3 5"/>';
        labels += '<text x="' + (padL - 9) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="11" fill="#7d8ca3">' + Math.round((max * (4 - g)) / 4).toLocaleString("fr-FR") + '</text>';
      }
      for (var t = p.tick; t <= p.n; t += p.tick) {
        labels += '<text x="' + X(t) + '" y="' + (H - padB + 20) + '" text-anchor="middle" font-size="11" fill="#7d8ca3">' + p.prefix + t + "</text>";
      }

      var endX = X(p.n), endY = Y(max);
      gainChart.innerHTML =
        '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        "<defs>" +
        '<linearGradient id="gain-line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2e8fff"/><stop offset="1" stop-color="#37c8ff"/></linearGradient>' +
        '<linearGradient id="gain-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(46,143,255,0.35)"/><stop offset="1" stop-color="rgba(46,143,255,0)"/></linearGradient>' +
        '<filter id="gain-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
        "</defs>" +
        grid + labels +
        '<path class="gain-area" d="' + area + '" fill="url(#gain-fill)"/>' +
        '<path class="gain-line" d="' + line + '" fill="none" stroke="url(#gain-line)" stroke-width="3" stroke-linecap="round" filter="url(#gain-glow)"/>' +
        '<circle class="gain-end" cx="' + endX + '" cy="' + endY + '" r="5" fill="#37c8ff" filter="url(#gain-glow)"><animate attributeName="r" values="4;6.5;4" dur="2.2s" repeatCount="indefinite"/></circle>' +
        '<g class="gain-cursor" opacity="0">' +
        '<line y1="' + padT + '" y2="' + (H - padB) + '" stroke="rgba(55,200,255,0.35)" stroke-width="1" stroke-dasharray="4 4"/>' +
        '<circle r="5.5" fill="#04101f" stroke="#37c8ff" stroke-width="2.5" filter="url(#gain-glow)"/>' +
        "</g>" +
        "</svg>";

      /* Tooltip HTML (verre dépoli) */
      var tip = document.createElement("div");
      tip.className = "gain-tooltip";
      tip.hidden = true;
      gainChart.appendChild(tip);

      /* Animation de tracé + fondu de l'aire (CSS) */
      var path = gainChart.querySelector(".gain-line");
      var areaEl = gainChart.querySelector(".gain-area");
      if (path && !reducedMotion) {
        var len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        areaEl.style.opacity = "0";
        path.getBoundingClientRect();
        path.style.transition = "stroke-dashoffset 1.5s ease-out";
        areaEl.style.transition = "opacity 1s ease-out 0.7s";
        path.style.strokeDashoffset = "0";
        areaEl.style.opacity = "1";
      }

      var counter = document.querySelector("[data-gain-total]");
      if (counter) animateCounter(counter, max);

      /* --- Interactivité : crosshair + tooltip --- */
      var svg = gainChart.querySelector("svg");
      var cursor = svg.querySelector(".gain-cursor");
      var cLine = cursor.querySelector("line");
      var cDot = cursor.querySelector("circle");

      var moveTo = function (clientX) {
        var rect = svg.getBoundingClientRect();
        var sx = ((clientX - rect.left) / rect.width) * W;
        var idx = Math.round(((sx - padL) / (W - padL - padR)) * currentPeriod.n);
        idx = Math.max(1, Math.min(currentPeriod.n, idx));
        var pt = currentPts[idx];
        var prev = currentPts[idx - 1];
        cursor.setAttribute("opacity", "1");
        cLine.setAttribute("x1", pt.x); cLine.setAttribute("x2", pt.x);
        cDot.setAttribute("cx", pt.x); cDot.setAttribute("cy", pt.y);
        tip.hidden = false;
        tip.innerHTML =
          "<span>" + currentPeriod.prefix + pt.i + "</span>" +
          "<strong>≈ " + Math.round(pt.v).toLocaleString("fr-FR") + " h gagnées</strong>" +
          "<em>+" + Math.round(pt.v - prev.v) + " h sur la période</em>";
        var px = (pt.x / W) * rect.width, py = (pt.y / H) * rect.height;
        var flip = px > rect.width * 0.62;
        tip.style.left = px + (flip ? -12 : 12) + "px";
        tip.style.top = py + "px";
        tip.style.transform = "translate(" + (flip ? "-100%" : "0") + ", -110%)";
      };
      var hide = function () { cursor.setAttribute("opacity", "0"); tip.hidden = true; };

      svg.addEventListener("pointermove", function (e) { moveTo(e.clientX); });
      svg.addEventListener("pointerleave", hide);
      svg.addEventListener("touchmove", function (e) { if (e.touches[0]) moveTo(e.touches[0].clientX); }, { passive: true });
      svg.addEventListener("touchend", hide);
    };

    document.querySelectorAll(".gain-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".gain-tab").forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        renderChart(btn.getAttribute("data-period"));
      });
    });

    renderChart("semaines");
  }

  /* ----- Réseau neuronal animé (pages intérieures si présent) ----- */
  var canvas = document.getElementById("neural-canvas");
  if (canvas && !reducedMotion) {
    var ctx = canvas.getContext("2d");
    var nodes = [];
    var COUNT = window.innerWidth < 640 ? 34 : 70;
    var LINK_DIST = 150;

    function resize() {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    for (var i = 0; i < COUNT; i++) {
      nodes.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.8
      });
    }

    function frame() {
      var w = canvas.offsetWidth, h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < COUNT; i++) {
        var n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        for (var j = i + 1; j < COUNT; j++) {
          var m = nodes[j];
          var dx = n.x - m.x, dy = n.y - m.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            ctx.strokeStyle = "rgba(46,143,255," + (0.20 * (1 - d / LINK_DIST)).toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(55,200,255,0.75)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();

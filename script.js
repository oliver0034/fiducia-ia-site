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

  /* ----- Menus déroulants (silos) ----- */
  var dropdowns = document.querySelectorAll(".nav__item--dropdown");
  var closeAllDropdowns = function () {
    dropdowns.forEach(function (item) {
      item.classList.remove("is-open");
      var t = item.querySelector(".nav__dropdown-toggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  };
  dropdowns.forEach(function (item) {
    var toggle = item.querySelector(".nav__dropdown-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      var wasOpen = item.classList.contains("is-open");
      closeAllDropdowns();
      if (!wasOpen) {
        item.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });
  });
  document.addEventListener("click", function (e) {
    dropdowns.forEach(function (item) {
      if (!item.contains(e.target)) {
        item.classList.remove("is-open");
        var t = item.querySelector(".nav__dropdown-toggle");
        if (t) t.setAttribute("aria-expanded", "false");
      }
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllDropdowns();
  });

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

  /* ----- Fonds animés (hero + footer) -----
     Effet principal : simulation de fluide "encre" WebGL2 (fluidHero),
     une instance par canvas — chacune se met en pause hors viewport,
     donc une seule tourne à la fois en pratique.
     Fallback si WebGL2 indisponible : aurora 2D (auroraFallback). */
  var fxCanvases = [];
  var heroFxCanvas = document.getElementById("shader-canvas") || document.getElementById("neural-canvas");
  if (heroFxCanvas) fxCanvases.push(heroFxCanvas);
  document.querySelectorAll(".fluid-canvas").forEach(function (c) { fxCanvases.push(c); });
  fxCanvases.forEach(function (c) { if (!fluidHero(c)) auroraFallback(c); });

  /* ----- Fallback Aurora Gradient (canvas 2D) -----
     Blobs dégradés en blending additif, curseur à ressort (effet magnétique
     + bloom), parallax multi-couches. Rendu dans un buffer basse résolution
     upscalé par le navigateur : les gradients sont si doux que c'est
     invisible, et le coût mesuré tombe à ~1,5 ms/frame même sans GPU. */
  function auroraFallback(shaderCanvas) {
    var actx = shaderCanvas.getContext("2d");
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var AURORA_RES = coarse ? 0.18 : 0.25;
    var aw = 0, ah = 0;

    var resizeAurora = function () {
      aw = shaderCanvas.offsetWidth;
      ah = shaderCanvas.offsetHeight;
      shaderCanvas.width = Math.max(2, Math.round(aw * AURORA_RES));
      shaderCanvas.height = Math.max(2, Math.round(ah * AURORA_RES));
      actx.setTransform(AURORA_RES, 0, 0, AURORA_RES, 0, 0);
    };
    resizeAurora();
    window.addEventListener("resize", resizeAurora);

    /* Charte : bleu #2e8fff dominant, cyan #37c8ff, pointe d'indigo/violet */
    var AURORA_COLORS = [
      [46, 143, 255, 0.60],
      [55, 200, 255, 0.42],
      [46, 143, 255, 0.38],
      [99, 102, 241, 0.30],
      [55, 200, 255, 0.28],
      [139, 92, 246, 0.18]
    ];
    var AURORA_COUNT = coarse ? 4 : 6;
    var auroraBlobs = [];
    for (var bi = 0; bi < AURORA_COUNT; bi++) {
      auroraBlobs.push({
        cx: 0.15 + 0.7 * ((bi * 0.618) % 1),
        cy: 0.2 + 0.6 * ((bi * 0.387 + 0.3) % 1),
        ax: 0.10 + 0.10 * ((bi * 0.53) % 1),
        ay: 0.08 + 0.10 * ((bi * 0.71) % 1),
        s1: 0.05 + 0.04 * ((bi * 0.41) % 1),
        s2: 0.04 + 0.05 * ((bi * 0.67) % 1),
        p1: bi * 2.1, p2: bi * 1.3,
        r: 0.34 + 0.14 * ((bi * 0.83) % 1),
        parallax: 0.02 + 0.06 * (bi / AURORA_COUNT),
        color: AURORA_COLORS[bi % AURORA_COLORS.length],
        glow: 0
      });
    }

    /* Curseur : cible brute + position amortie par ressort */
    var aMouse = { tx: aw / 2, ty: ah / 2, x: aw / 2, y: ah / 2, vx: 0, vy: 0, energy: 0 };
    var A_STIFFNESS = 42, A_DAMPING = 11;
    if (!coarse) {
      window.addEventListener("pointermove", function (e) {
        var r = shaderCanvas.getBoundingClientRect();
        aMouse.tx = e.clientX - r.left;
        aMouse.ty = e.clientY - r.top;
        aMouse.energy = Math.min(1, aMouse.energy + 0.12);
      }, { passive: true });
    }

    /* Pause quand le hero sort du viewport */
    var auroraVisible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        auroraVisible = entries[0].isIntersecting;
      }).observe(shaderCanvas);
    }

    var drawAuroraBlob = function (x, y, radius, color, alphaMul) {
      var grad = actx.createRadialGradient(x, y, 0, x, y, radius);
      var alpha = color[3] * alphaMul;
      var rgb = color[0] + "," + color[1] + "," + color[2];
      grad.addColorStop(0, "rgba(" + rgb + "," + alpha + ")");
      grad.addColorStop(0.45, "rgba(" + rgb + "," + alpha * 0.45 + ")");
      grad.addColorStop(1, "rgba(" + rgb + ",0)");
      actx.fillStyle = grad;
      actx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };

    var auroraLast = performance.now();
    var renderAurora = function (now) {
      var dt = Math.min((now - auroraLast) / 1000, 0.05);
      auroraLast = now;
      var t = now / 1000;

      /* Ressort semi-implicite : stable à 60 comme à 120 Hz */
      aMouse.vx = (aMouse.vx + (aMouse.tx - aMouse.x) * A_STIFFNESS * dt) * Math.exp(-A_DAMPING * dt);
      aMouse.vy = (aMouse.vy + (aMouse.ty - aMouse.y) * A_STIFFNESS * dt) * Math.exp(-A_DAMPING * dt);
      aMouse.x += aMouse.vx * dt;
      aMouse.y += aMouse.vy * dt;
      aMouse.energy = Math.max(0, aMouse.energy - dt * 0.5);

      var diag = Math.sqrt(aw * aw + ah * ah);
      var pdx = aMouse.x - aw / 2, pdy = aMouse.y - ah / 2;

      actx.clearRect(0, 0, aw, ah);
      actx.globalCompositeOperation = "lighter";

      for (var i = 0; i < auroraBlobs.length; i++) {
        var b = auroraBlobs[i];
        var x = (b.cx + b.ax * Math.sin(t * b.s1 * 6.28 + b.p1)) * aw + pdx * b.parallax;
        var y = (b.cy + b.ay * Math.cos(t * b.s2 * 6.28 + b.p2)) * ah + pdy * b.parallax;

        /* Influence magnétique avec retombée lissée */
        var target = 0;
        if (!coarse) {
          var d = Math.sqrt((aMouse.x - x) * (aMouse.x - x) + (aMouse.y - y) * (aMouse.y - y));
          target = Math.max(0, 1 - d / (diag * 0.32));
          target = target * target * aMouse.energy;
        }
        b.glow += (target - b.glow) * Math.min(1, dt * 4);

        x += (aMouse.x - x) * b.glow * 0.10;
        y += (aMouse.y - y) * b.glow * 0.10;
        drawAuroraBlob(x, y, b.r * diag * 0.5 * (1 + b.glow * 0.30), b.color, 1 + b.glow * 0.75);
      }

      /* Lumière radiale + bloom sur la position amortie du curseur */
      if (!coarse && aMouse.energy > 0.01) {
        drawAuroraBlob(aMouse.x, aMouse.y, diag * 0.30, [140, 190, 255, 0.10], aMouse.energy);
        drawAuroraBlob(aMouse.x, aMouse.y, diag * 0.10, [190, 225, 255, 0.16], aMouse.energy);
      }

      actx.globalCompositeOperation = "source-over";
    };

    var auroraLoop = function (now) {
      if (auroraVisible) renderAurora(now);
      requestAnimationFrame(auroraLoop);
    };
    if (reducedMotion) {
      /* Une seule frame statique, pas de boucle */
      requestAnimationFrame(renderAurora);
    } else {
      requestAnimationFrame(auroraLoop);
    }
  }

  /* ----- Fluide "encre" WebGL2 (effet principal du hero) -----
     Simulation Navier-Stokes sur grille : advection semi-lagrangienne,
     projection de pression (Jacobi), confinement de vorticité pour les
     volutes, shading directionnel pour le relief "fumée". L'encre suit le
     curseur (le doigt sur mobile) et des impulsions automatiques font vivre
     le fond sans interaction. Coût mesuré : ~4,5 ms/frame sur iGPU Intel.
     Renvoie false si WebGL2 indisponible (le fallback aurora prend le relais). */
  function fluidHero(canvas) {
    var gl = canvas.getContext("webgl2", { alpha: false, depth: false, stencil: false, antialias: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return false;

    var coarse = window.matchMedia("(pointer: coarse)").matches;
    /* Mode "subtil" pour le footer : l'encre reste un FOND — atténuée,
       dissipation forte (pas d'accumulation), impulsions plus rares.
       Sur mobile, dissipation renforcée partout : le scroll tactile
       injecte de l'encre en continu et saturait la carte vers le blanc. */
    var subtle = canvas.classList.contains("fluid-canvas");
    var CONFIG = {
      SIM_RES: coarse ? 96 : 144,
      DYE_RES: coarse ? 448 : 1024,
      PRESSURE_ITERS: coarse ? 10 : 16,
      CURL: 42,
      VELOCITY_DISSIPATION: 0.55,
      DYE_DISSIPATION: subtle ? 1.2 : (coarse ? 1.0 : 0.45),
      SPLAT_FORCE: 7500,
      SPLAT_RADIUS: 0.0055,
      AUTO_SPLAT_EVERY: subtle ? 0.7 : 0.55,
      INK_GAIN: subtle ? 0.6 : (coarse ? 0.7 : 1)
    };

    /* Palette alchimie — identique à la démo preview validée */
    var INK = [
      [0.08, 0.85, 0.65],   // jade
      [0.85, 0.60, 0.16],   // or
      [0.70, 0.12, 0.46],   // magenta
      [0.40, 0.16, 0.85],   // violet
      [0.12, 0.40, 0.95]    // bleu électrique
    ];

    var VERT = "#version 300 es\n" +
      "precision highp float;\n" +
      "in vec2 aPos; out vec2 vUv;\n" +
      "void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";

    function makeProgram(fragSrc) {
      var compile = function (type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.error("Shader:", gl.getShaderInfoLog(s));
        }
        return s;
      };
      var p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER,
        "#version 300 es\nprecision highp float; precision highp sampler2D;\n" +
        "in vec2 vUv; out vec4 outColor;\n" + fragSrc));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error("Link:", gl.getProgramInfoLog(p));
      var uniforms = {};
      var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) {
        var name = gl.getActiveUniform(p, i).name;
        uniforms[name] = gl.getUniformLocation(p, name);
      }
      return { program: p, uniforms: uniforms };
    }

    var progs = {
      advection: makeProgram(
        "uniform sampler2D uVelocity, uSource;\n" +
        "uniform vec2 texelSize;\n" +
        "uniform float dt, dissipation;\n" +
        "void main(){\n" +
        "  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;\n" +
        "  outColor = texture(uSource, coord) / (1.0 + dissipation * dt);\n" +
        "}"),
      splat: makeProgram(
        "uniform sampler2D uTarget;\n" +
        "uniform float aspectRatio, radius;\n" +
        "uniform vec2 point;\n" +
        "uniform vec3 color;\n" +
        "void main(){\n" +
        "  vec2 p = vUv - point;\n" +
        "  p.x *= aspectRatio;\n" +
        "  vec3 s = exp(-dot(p, p) / radius) * color;\n" +
        "  outColor = vec4(texture(uTarget, vUv).xyz + s, 1.0);\n" +
        "}"),
      curl: makeProgram(
        "uniform sampler2D uVelocity;\n" +
        "uniform vec2 texelSize;\n" +
        "void main(){\n" +
        "  float L = texture(uVelocity, vUv - vec2(texelSize.x, 0.0)).y;\n" +
        "  float R = texture(uVelocity, vUv + vec2(texelSize.x, 0.0)).y;\n" +
        "  float B = texture(uVelocity, vUv - vec2(0.0, texelSize.y)).x;\n" +
        "  float T = texture(uVelocity, vUv + vec2(0.0, texelSize.y)).x;\n" +
        "  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);\n" +
        "}"),
      vorticity: makeProgram(
        "uniform sampler2D uVelocity, uCurl;\n" +
        "uniform vec2 texelSize;\n" +
        "uniform float curl, dt;\n" +
        "void main(){\n" +
        "  float L = texture(uCurl, vUv - vec2(texelSize.x, 0.0)).x;\n" +
        "  float R = texture(uCurl, vUv + vec2(texelSize.x, 0.0)).x;\n" +
        "  float B = texture(uCurl, vUv - vec2(0.0, texelSize.y)).x;\n" +
        "  float T = texture(uCurl, vUv + vec2(0.0, texelSize.y)).x;\n" +
        "  float C = texture(uCurl, vUv).x;\n" +
        "  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(L) - abs(R));\n" +
        "  force /= length(force) + 0.0001;\n" +
        "  force *= curl * C;\n" +
        "  force.y *= -1.0;\n" +
        "  vec2 vel = texture(uVelocity, vUv).xy + force * dt;\n" +
        "  outColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);\n" +
        "}"),
      divergence: makeProgram(
        "uniform sampler2D uVelocity;\n" +
        "uniform vec2 texelSize;\n" +
        "void main(){\n" +
        "  float L = texture(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;\n" +
        "  float R = texture(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;\n" +
        "  float B = texture(uVelocity, vUv - vec2(0.0, texelSize.y)).y;\n" +
        "  float T = texture(uVelocity, vUv + vec2(0.0, texelSize.y)).y;\n" +
        "  vec2 C = texture(uVelocity, vUv).xy;\n" +
        "  if (vUv.x - texelSize.x < 0.0) L = -C.x;\n" +
        "  if (vUv.x + texelSize.x > 1.0) R = -C.x;\n" +
        "  if (vUv.y - texelSize.y < 0.0) B = -C.y;\n" +
        "  if (vUv.y + texelSize.y > 1.0) T = -C.y;\n" +
        "  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);\n" +
        "}"),
      pressure: makeProgram(
        "uniform sampler2D uPressure, uDivergence;\n" +
        "uniform vec2 texelSize;\n" +
        "void main(){\n" +
        "  float L = texture(uPressure, vUv - vec2(texelSize.x, 0.0)).x;\n" +
        "  float R = texture(uPressure, vUv + vec2(texelSize.x, 0.0)).x;\n" +
        "  float B = texture(uPressure, vUv - vec2(0.0, texelSize.y)).x;\n" +
        "  float T = texture(uPressure, vUv + vec2(0.0, texelSize.y)).x;\n" +
        "  float div = texture(uDivergence, vUv).x;\n" +
        "  outColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);\n" +
        "}"),
      gradient: makeProgram(
        "uniform sampler2D uPressure, uVelocity;\n" +
        "uniform vec2 texelSize;\n" +
        "void main(){\n" +
        "  float L = texture(uPressure, vUv - vec2(texelSize.x, 0.0)).x;\n" +
        "  float R = texture(uPressure, vUv + vec2(texelSize.x, 0.0)).x;\n" +
        "  float B = texture(uPressure, vUv - vec2(0.0, texelSize.y)).x;\n" +
        "  float T = texture(uPressure, vUv + vec2(0.0, texelSize.y)).x;\n" +
        "  vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B);\n" +
        "  outColor = vec4(vel, 0.0, 1.0);\n" +
        "}"),
      display: makeProgram(
        "uniform sampler2D uTexture;\n" +
        "uniform vec2 texelSize;\n" +
        "void main(){\n" +
        "  vec3 c = texture(uTexture, vUv).rgb;\n" +
        "  /* Shading directionnel : gradient de densité -> relief \"fumée\" */\n" +
        "  vec3 L = texture(uTexture, vUv - vec2(texelSize.x, 0.0)).rgb;\n" +
        "  vec3 R = texture(uTexture, vUv + vec2(texelSize.x, 0.0)).rgb;\n" +
        "  vec3 B = texture(uTexture, vUv - vec2(0.0, texelSize.y)).rgb;\n" +
        "  vec3 T = texture(uTexture, vUv + vec2(0.0, texelSize.y)).rgb;\n" +
        "  float dx = length(R) - length(L);\n" +
        "  float dy = length(T) - length(B);\n" +
        "  vec3 n = normalize(vec3(dx, dy, length(texelSize)));\n" +
        "  c *= clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);\n" +
        "  /* roll-off doux : jamais saturé */\n" +
        "  c = c / (1.0 + max(max(c.r, c.g), c.b) * 0.35);\n" +
        "  outColor = vec4(c, 1.0);\n" +
        "}")
    };

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function createFBO(w, h, internalFormat, format, filter) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, gl.HALF_FLOAT, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        tex: tex, fbo: fbo, w: w, h: h, texelX: 1 / w, texelY: 1 / h,
        attach: function (unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, this.tex); return unit; }
      };
    }
    function createDouble(w, h, internalFormat, format, filter) {
      var a = createFBO(w, h, internalFormat, format, filter);
      var b = createFBO(w, h, internalFormat, format, filter);
      return {
        get read() { return a; }, get write() { return b; },
        swap: function () { var t = a; a = b; b = t; },
        w: w, h: h, texelX: 1 / w, texelY: 1 / h
      };
    }

    function simSize(base) {
      var aspect = canvas.width / canvas.height;
      return aspect > 1
        ? { w: Math.round(base * aspect), h: base }
        : { w: base, h: Math.round(base / aspect) };
    }

    var velocity, dye, pressureFBO, divergenceFBO, curlFBO;
    function initFBOs() {
      var s = simSize(CONFIG.SIM_RES);
      var d = simSize(Math.min(CONFIG.DYE_RES, Math.max(canvas.width, canvas.height)));
      velocity = createDouble(s.w, s.h, gl.RG16F, gl.RG, gl.LINEAR);
      dye = createDouble(d.w, d.h, gl.RGBA16F, gl.RGBA, gl.LINEAR);
      pressureFBO = createDouble(s.w, s.h, gl.R16F, gl.RED, gl.NEAREST);
      divergenceFBO = createFBO(s.w, s.h, gl.R16F, gl.RED, gl.NEAREST);
      curlFBO = createFBO(s.w, s.h, gl.R16F, gl.RED, gl.NEAREST);
    }

    function resizeFluid() {
      var dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5);
      var w = Math.round(canvas.clientWidth * dpr);
      var h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        initFBOs();
      }
    }
    resizeFluid();
    window.addEventListener("resize", resizeFluid);

    function blit(target) {
      if (target) {
        gl.viewport(0, 0, target.w, target.h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      } else {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function splat(x, y, dx, dy, color) {
      var p = progs.splat;
      gl.useProgram(p.program);
      gl.uniform1f(p.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(p.uniforms.point, x, y);
      gl.uniform1f(p.uniforms.radius, CONFIG.SPLAT_RADIUS);

      gl.uniform1i(p.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform3f(p.uniforms.color, dx, dy, 0);
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(p.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(p.uniforms.color, color[0], color[1], color[2]);
      blit(dye.write);
      dye.swap();
    }

    var inkIndex = 0;
    function nextInk() {
      inkIndex = (inkIndex + 1) % INK.length;
      var c = INK[inkIndex];
      var v = (0.75 + 0.5 * ((inkIndex * 0.37) % 1)) * CONFIG.INK_GAIN;
      return [c[0] * v, c[1] * v, c[2] * v];
    }

    function step(dt) {
      gl.disable(gl.BLEND);
      var tx = velocity.texelX, ty = velocity.texelY;

      var p = progs.curl;
      gl.useProgram(p.program);
      gl.uniform2f(p.uniforms.texelSize, tx, ty);
      gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
      blit(curlFBO);

      p = progs.vorticity;
      gl.useProgram(p.program);
      gl.uniform2f(p.uniforms.texelSize, tx, ty);
      gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(p.uniforms.uCurl, curlFBO.attach(1));
      gl.uniform1f(p.uniforms.curl, CONFIG.CURL);
      gl.uniform1f(p.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      p = progs.divergence;
      gl.useProgram(p.program);
      gl.uniform2f(p.uniforms.texelSize, tx, ty);
      gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergenceFBO);

      p = progs.pressure;
      gl.useProgram(p.program);
      gl.uniform2f(p.uniforms.texelSize, tx, ty);
      gl.uniform1i(p.uniforms.uDivergence, divergenceFBO.attach(0));
      for (var i = 0; i < CONFIG.PRESSURE_ITERS; i++) {
        gl.uniform1i(p.uniforms.uPressure, pressureFBO.read.attach(1));
        blit(pressureFBO.write);
        pressureFBO.swap();
      }

      p = progs.gradient;
      gl.useProgram(p.program);
      gl.uniform2f(p.uniforms.texelSize, tx, ty);
      gl.uniform1i(p.uniforms.uPressure, pressureFBO.read.attach(0));
      gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      p = progs.advection;
      gl.useProgram(p.program);
      gl.uniform2f(p.uniforms.texelSize, tx, ty);
      gl.uniform1f(p.uniforms.dt, dt);
      gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(p.uniforms.uSource, velocity.read.attach(0));
      gl.uniform1f(p.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(p.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(p.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(p.uniforms.dissipation, CONFIG.DYE_DISSIPATION);
      blit(dye.write);
      dye.swap();
    }

    function render() {
      var p = progs.display;
      gl.useProgram(p.program);
      gl.uniform2f(p.uniforms.texelSize, dye.texelX, dye.texelY);
      gl.uniform1i(p.uniforms.uTexture, dye.read.attach(0));
      blit(null);
    }

    var pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, moved: false, color: nextInk(), colorT: 0 };
    function onMove(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = (clientX - r.left) / r.width;
      pointer.y = 1 - (clientY - r.top) / r.height;
      pointer.moved = true;
    }
    window.addEventListener("pointermove", function (e) { onMove(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (e.touches.length) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    var autoT = 0, wanderA = 0.7, wanderB = 2.1;
    function autoSplat(dt) {
      autoT -= dt;
      if (autoT > 0) return;
      autoT = CONFIG.AUTO_SPLAT_EVERY * (0.6 + ((wanderA * 7.13) % 1) * 0.8);
      wanderA += 0.9; wanderB += 1.37;
      var x = 0.5 + 0.38 * Math.sin(wanderA) * Math.cos(wanderB * 0.7);
      var y = 0.5 + 0.34 * Math.sin(wanderB) * Math.sin(wanderA * 0.5);
      var angle = Math.sin(wanderA * 3.7) * Math.PI * 2;
      var force = CONFIG.SPLAT_FORCE * 0.35;
      splat(x, y, Math.cos(angle) * force * 0.001 * canvas.width,
                  Math.sin(angle) * force * 0.001 * canvas.height, nextInk());
    }

    /* Pause quand le hero sort du viewport */
    var fluidVisible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        fluidVisible = entries[0].isIntersecting;
      }).observe(canvas);
    }

    var last = performance.now();
    function update(now) {
      var dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (pointer.moved) {
        pointer.moved = false;
        /* On n'injecte de l'encre que si le pointeur est sur le canvas —
           sinon le scroll tactile sature la simulation depuis n'importe où */
        if (pointer.x >= -0.02 && pointer.x <= 1.02 && pointer.y >= -0.02 && pointer.y <= 1.02) {
          var dx = (pointer.x - pointer.px) * CONFIG.SPLAT_FORCE;
          var dy = (pointer.y - pointer.py) * CONFIG.SPLAT_FORCE;
          pointer.colorT += Math.abs(dx) + Math.abs(dy);
          if (pointer.colorT > 900) { pointer.colorT = 0; pointer.color = nextInk(); }
          splat(pointer.x, pointer.y, dx, dy, pointer.color);
        }
      }
      autoSplat(dt);
      step(dt);
      render();
    }
    function loop(now) {
      if (fluidVisible) update(now);
      requestAnimationFrame(loop);
    }

    /* Amorce : quelques volutes pour ne jamais démarrer sur du noir */
    for (var si = 0; si < 6; si++) {
      var sa = (si / 6) * Math.PI * 2;
      splat(0.5 + 0.25 * Math.cos(sa), 0.45 + 0.22 * Math.sin(sa),
            Math.cos(sa + 1.6) * 800, Math.sin(sa + 1.6) * 800, nextInk());
    }

    if (reducedMotion) {
      /* Rendu figé : diffusion hors écran puis une seule frame */
      var rt = performance.now();
      for (var ri = 0; ri < 90; ri++) { rt += 16.7; autoSplat(0.0167); step(0.0167); }
      render();
    } else {
      requestAnimationFrame(loop);
    }

    /* Hook de test — exposé uniquement en local (une entrée par canvas) */
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      window.__fluidHero = window.__fluidHero || [];
      window.__fluidHero.push({
        canvas: canvas,
        stepN: function (n) { var t = performance.now(); for (var i = 0; i < n; i++) { t += 16.7; update(t); } },
        splat: function (x, y, dx, dy) { splat(x, y, dx, dy, nextInk()); }
      });
    }

    return true;
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
      /* Libellé adapté à la largeur réelle du segment (mobile : version courte ou rien) */
      var track = el.parentElement;
      var px = (track.offsetWidth || 600) * (hours / DAY_HOURS);
      var heures = hours.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " h";
      if (px >= 130) el.textContent = label + " " + heures;
      else if (px >= 52) el.textContent = heures;
      else el.textContent = "";
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
    window.addEventListener("resize", updateSim);
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

  /* (L'ancien réseau neuronal des pages intérieures est remplacé par le
     fluide — voir le dispatcher heroFxCanvas en tête de fichier.) */
})();

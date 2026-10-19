/* app.js · Paquete B · arranque, router por hash, cabecera, banda, barra/raíl, FAB e insignias */
(function () {
  "use strict";
  var ING = (window.ING = window.ING || {});
  var ui = ING.ui;
  var h = ui.h;

  /* ---------- store provisional (solo si store.js no existe; el definitivo es de A) ---------- */
  if (!ING.store) {
    ING.store = (function () {
      var semilla = null;
      try { semilla = JSON.parse(document.getElementById("datos-semilla").textContent); } catch (e) { semilla = {}; }
      var db = {};
      ["expedientes", "muestras", "analisis", "aislados", "tandas", "informes", "valoraciones", "comunicaciones", "eventos"].forEach(function (c) {
        db[c] = {};
        ui.lista(semilla[c]).forEach(function (d) { db[c][d.id] = d; });
      });
      var subs = [];
      var rol = ui.ls.get("ing-rol", "responsable");
      function avisar() { requestAnimationFrame(function () { subs.forEach(function (f) { f(); }); }); }
      function evento(ev) {
        if (!ev) return;
        ev.id = ev.id || "EV-stub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
        ev.ts = ev.ts || new Date().toISOString(); ev.rol = ev.rol || rol; ev.dispositivo = ev.dispositivo || "stub";
        db.eventos[ev.id] = ev;
      }
      return {
        provisional: true,
        db: function () { return db; },
        modo: function () { return "memoria"; },
        rol: function () { return rol; },
        setRol: function (r) { rol = r; ui.ls.set("ing-rol", r); avisar(); return Promise.resolve(); },
        guardar: function (col, doc, ev) { db[col] = db[col] || {}; db[col][doc.id] = doc; evento(ev); avisar(); return Promise.resolve(doc); },
        guardarVarios: function (lista, ev) { lista.forEach(function (x) { db[x.col] = db[x.col] || {}; db[x.col][x.doc.id] = x.doc; }); evento(ev); avisar(); return Promise.resolve(); },
        reiniciar: function () { avisar(); return Promise.resolve(); },
        on: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (f) { return f !== fn; }); }; }
      };
    })();
  }

  /* ---------- rutas conocidas (una ruta conocida sin pantalla aún muestra "en preparación") ---------- */
  var CONOCIDAS = ["inicio", "expedientes", "exp", "nueva", "lab/micro", "lab/molecular", "lab/tanda", "informes", "informe", "alertas",
    "mas", "mas/sobre", "mas/biblioteca", "mas/reglas", "mas/registro", "mas/compartir", "mas/ajustes"];
  var TITULOS = {
    inicio: "Inicio", expedientes: "Expedientes", exp: "Expediente", nueva: "Nueva entrada", "lab/micro": "Microbiología",
    "lab/molecular": "Biología molecular", "lab/tanda": "Nueva tanda", informes: "Informes", informe: "Informe", alertas: "Alertas",
    mas: "Más", "mas/sobre": "Sobre esta demo", "mas/biblioteca": "Biblioteca", "mas/reglas": "Reglas", "mas/registro": "Registro",
    "mas/compartir": "Compartir", "mas/ajustes": "Ajustes"
  };

  function parseHash() {
    var raw = (location.hash || "").replace(/^#\/?/, "");
    var qi = raw.indexOf("?");
    var path = qi >= 0 ? raw.slice(0, qi) : raw;
    var qs = qi >= 0 ? raw.slice(qi + 1) : "";
    var q = {};
    qs.split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("="); var k = i >= 0 ? kv.slice(0, i) : kv; var v = i >= 0 ? kv.slice(i + 1) : "";
      try { q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " ")); } catch (e) { q[k] = v; }
    });
    var segs = path.split("/").filter(Boolean).map(function (s) { try { return decodeURIComponent(s); } catch (e) { return s; } });
    return { path: segs.join("/"), segs: segs, q: q };
  }

  /* Empareja el hash con la clave registrada más específica. Claves: "a/b", "exp/:ref/:pestana?" o prefijo "exp". */
  function resolver(info) {
    var mejor = null;
    Object.keys(ING.rutas).forEach(function (clave) {
      var pat = clave.split("/").filter(Boolean);
      var params = {}, lit = 0, i;
      for (i = 0; i < pat.length; i++) {
        var p = pat[i];
        if (p[0] === ":") {
          var opc = p[p.length - 1] === "?"; var nom = p.slice(1, opc ? -1 : undefined);
          if (i < info.segs.length) params[nom] = info.segs[i];
          else if (!opc) return;
        } else {
          if (info.segs[i] !== p) return;
          lit++;
        }
      }
      var resto = info.segs.slice(Math.min(pat.length, info.segs.length));
      var exacto = info.segs.length <= pat.length;
      var punt = lit * 100 + (exacto ? 50 : 0) + pat.length;
      if (!mejor || punt > mejor.punt) mejor = { clave: clave, params: params, resto: resto, punt: punt, lit: lit };
    });
    return mejor;
  }

  function claveConocida(info) {
    var dos = info.segs.slice(0, 2).join("/");
    if (CONOCIDAS.indexOf(dos) >= 0) return dos;
    if (CONOCIDAS.indexOf(info.segs[0]) >= 0) return info.segs[0];
    return null;
  }

  /* ---------- destino de cada pestaña ---------- */
  function seccionDe(segs) {
    var s = segs[0] || "inicio";
    if (s === "inicio") return "inicio";
    if (s === "expedientes" || s === "exp") return "expedientes";
    if (s === "lab") return "lab";
    if (s === "informes" || s === "informe") return "informes";
    if (s === "mas") return "mas";
    return null;
  }
  function rutaLab() {
    var u = ui.ls.get("ing-lab-ultimo", "micro");
    return u === "molecular" ? "#/lab/molecular" : "#/lab/micro";
  }
  var NAV = [
    { id: "inicio", texto: "Inicio", icono: "layout-dashboard", href: function () { return "#/inicio"; } },
    { id: "expedientes", texto: "Expedientes", icono: "folder-open", href: function () { return "#/expedientes"; } },
    { id: "lab", texto: "Laboratorio", icono: "flask-conical", href: rutaLab, insignia: "badge-lab" },
    { id: "informes", texto: "Informes", icono: "file-check", href: function () { return "#/informes"; }, insignia: "badge-informes" },
    { id: "mas", texto: "Más", icono: "menu", href: function () { return "#/mas"; } }
  ];
  function fabVisible(info) {
    var p = info.segs.slice(0, 2).join("/");
    return p === "inicio" || p === "expedientes" || p === "lab/micro" || p === "lab/molecular";
  }

  /* ---------- carcasa ---------- */
  var el = {};
  var MODOS = {
    db: { texto: "En vivo", titulo: "Los cambios se comparten en vivo con otros dispositivos" },
    local: { texto: "Solo este dispositivo", titulo: "Los cambios se guardan en este navegador" },
    memoria: { texto: "Sin guardar", titulo: "Este navegador no permite guardar: los cambios se pierden al recargar" }
  };
  function montarCarcasa() {
    var raiz = document.getElementById("app") || document.body;
    raiz.textContent = "";
    el.modo = h("span", { class: "cab-modo", testid: "indicador-modo", "data-modo": "memoria", role: "status" }, h("span", { class: "punto", "aria-hidden": "true" }), h("span", { class: "cab-modo-txt" }, "Sin guardar"));
    el.badgeAlertas = h("span", { class: "insignia", testid: "badge-alertas", "data-n": "0" }, "0");
    el.campana = h("a", { class: "cab-btn", href: "#/alertas", testid: "campana", "aria-label": "Alertas pendientes" }, ui.icon("bell"), el.badgeAlertas);
    el.rolTxt = h("span", { class: "cab-rol", style: { display: "inline-flex", alignItems: "center", justifyContent: "center" } }, "RT");
    el.rol = h("button", { type: "button", class: "cab-rol-wrap", testid: "selector-rol", "aria-label": "Rol: Responsable técnico. Cambiar", onclick: function () { ui.abrirSelectorRol(); } }, el.rolTxt);
    el.cab = h("header", { class: "cab" },
      h("a", { class: "cab-titulo", href: "#/inicio", "aria-label": "Circuito de muestras · Inicio" }, h("b", null, "Circuito de muestras"), h("small", null, "Prototipo para Ingulados")),
      el.modo, el.campana, el.rol);
    el.banda = h("div", { class: "banda", testid: "banda-modo" }, "SIMULACIÓN · datos ficticios · sin validez");
    el.main = h("main", { id: "contenido", class: "contenido", tabindex: "-1" });
    el.nav = {};
    el.barra = h("nav", { class: "barra", "aria-label": "Secciones" }, NAV.map(function (n) {
      var badge = n.insignia ? h("span", { class: "insignia", testid: n.insignia, "data-n": "0" }, "0") : null;
      var a = h("a", { class: "nav-item", href: n.href(), testid: "nav-" + n.id },
        h("span", { class: "nav-pildora" }, ui.icon(n.icono)), h("span", { class: "nav-txt" }, n.texto), badge);
      a.addEventListener("click", function () { a.setAttribute("href", n.href()); });
      el.nav[n.id] = { a: a, badge: badge, def: n };
      return a;
    }));
    el.fab = h("a", { class: "fab", href: "#/nueva", testid: "fab-nueva", "aria-label": "Nueva entrada", title: "Nueva entrada" }, ui.icon("plus"), h("span", { class: "fab-txt" }, "Nueva entrada"));
    el.toasts = h("div", { id: "toasts", class: "toasts", role: "status", "aria-live": "polite" });
    raiz.appendChild(el.cab);
    raiz.appendChild(el.banda);
    raiz.appendChild(el.main);
    raiz.appendChild(el.barra);
    raiz.appendChild(el.fab);
    document.body.appendChild(el.toasts);
  }

  function setInsignia(nodo, n) {
    if (!nodo) return;
    n = n === null || n === undefined || isNaN(n) ? 0 : n;
    nodo.textContent = String(n);
    nodo.setAttribute("data-n", String(n));
  }
  function actualizarCarcasa(info) {
    var modo = "memoria";
    try { modo = ING.store.modo() || "memoria"; } catch (e) { /* nada */ }
    var m = MODOS[modo] || MODOS.memoria;
    el.modo.setAttribute("data-modo", modo);
    el.modo.setAttribute("title", m.titulo);
    el.modo.lastChild.textContent = m.texto;
    var r = ui.rolInfo(ui.rolActual());
    el.rolTxt.textContent = r.corto;
    el.rol.setAttribute("aria-label", "Rol: " + r.nombre + ". Cambiar");
    var p = null;
    try { p = ui.panelActual(null); } catch (e) { p = null; setTimeout(function () { throw e; }); }
    if (p) {
      setInsignia(el.badgeAlertas, p.badge_alertas);
      setInsignia(el.nav.lab.badge, (p.bandeja_micro || 0) + (p.bandeja_molecular || 0));
      setInsignia(el.nav.informes.badge, p.badge_informes);
      el.campana.setAttribute("aria-label", "Alertas pendientes: " + (p.badge_alertas || 0));
    }
    var sec = seccionDe(info.segs);
    NAV.forEach(function (n) {
      var a = el.nav[n.id].a;
      a.setAttribute("href", n.href());
      if (n.id === sec) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.body.classList.toggle("sin-fab", !fabVisible(info));
  }

  /* ---------- render ---------- */
  var app = (ING.app = { ciclo: 0, rutaActual: null });
  var scrollPorRuta = {};
  var pintando = false;

  function pantallaProvisional(clave) {
    return h("div", null,
      h("div", { class: "pantalla-cab" }, h("h1", null, TITULOS[clave] || "Pantalla")),
      h("div", { class: "tarjeta vacio" }, h("p", null, "Esta pantalla se está preparando."), h("a", { class: "btn btn-sec", href: "#/inicio" }, "Volver a Inicio")));
  }
  function pantallaError(e) {
    return h("div", { class: "tarjeta error-pantalla", testid: "error-ruta", role: "alert" },
      h("h2", null, "No se ha podido mostrar esta pantalla"),
      h("p", { class: "sec muted" }, String(e && e.message || e)),
      h("a", { class: "btn btn-sec", href: "#/inicio" }, "Volver a Inicio"));
  }
  function colocar(nodo) {
    var cont = h("div", { class: "contenido-int" });
    if (Array.isArray(nodo)) nodo.forEach(function (n) { if (n) cont.appendChild(n); });
    else if (nodo instanceof Node) cont.appendChild(nodo);
    el.main.textContent = "";
    el.main.appendChild(cont);
  }

  function render(motivo) {
    if (pintando) return;
    pintando = true;
    app.ciclo++;
    var info = parseHash();
    if (!info.segs.length) { pintando = false; location.replace("#/inicio"); return; }
    var mismaRuta = app.rutaActual === location.hash;
    var y = window.scrollY || 0;
    if (app.rutaActual) scrollPorRuta[app.rutaActual] = y;
    try {
      var m = resolver(info);
      var conocida = claveConocida(info);
      if (!m || (m.lit === 0 && !conocida)) {
        if (!conocida) { pintando = false; location.replace("#/inicio"); return; }
      }
      if (info.segs[0] === "lab" && (info.segs[1] === "micro" || info.segs[1] === "molecular")) ui.ls.set("ing-lab-ultimo", info.segs[1]);
      actualizarCarcasa(info);
      var nodo;
      if (m && (m.lit > 0 || m.clave === conocida)) {
        var p = { ruta: info.path, hash: location.hash, segs: m.resto, q: info.q, motivo: motivo || "ruta" };
        Object.keys(m.params).forEach(function (k) { p[k] = m.params[k]; });
        if (m.resto.length) {
          if (p.ref === undefined) p.ref = m.resto[0];
          if (p.id === undefined) p.id = m.resto[0];
          if (p.pestana === undefined && m.resto[1] !== undefined) p.pestana = m.resto[1];
        }
        try { nodo = ING.rutas[m.clave](p); }
        catch (e) { nodo = pantallaError(e); setTimeout(function () { throw e; }); }
      } else {
        nodo = pantallaProvisional(conocida);
      }
      var fin = function (n) {
        colocar(n);
        ui.limpiarCharts();
        var nuevoTitulo = TITULOS[claveConocida(info)] || "";
        document.title = (nuevoTitulo && nuevoTitulo !== "Inicio" ? nuevoTitulo + " · " : "") + "Circuito de muestras · demo";
        if (mismaRuta) window.scrollTo(0, y);
        else {
          window.scrollTo(0, motivo === "historial" && scrollPorRuta[location.hash] ? scrollPorRuta[location.hash] : 0);
          if (motivo !== "inicio") { try { el.main.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
        }
        app.rutaActual = location.hash;
      };
      if (nodo && typeof nodo.then === "function") {
        nodo.then(fin, function (e) { fin(pantallaError(e)); setTimeout(function () { throw e; }); });
      } else fin(nodo);
    } finally {
      pintando = false;
    }
  }
  app.render = function () { render("datos"); };
  app.parseHash = parseHash;

  /* ---------- arranque ---------- */
  function arrancar() {
    montarCarcasa();
    if (!location.hash || location.hash === "#" || location.hash === "#/") {
      try { history.replaceState(null, "", "#/inicio"); } catch (e) { location.hash = "#/inicio"; }
    }
    window.addEventListener("hashchange", function () { ui.cerrarCapas(); render("historial"); });
    var pendiente = false;
    var alCambiar = function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; render("datos"); });
    };
    try { if (ING.store.on) ING.store.on(alCambiar); } catch (e) { setTimeout(function () { throw e; }); }
    render("inicio");
    try { if (ING.store.iniciar) Promise.resolve(ING.store.iniciar()).then(alCambiar, function () { alCambiar(); }); } catch (e) { setTimeout(function () { throw e; }); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();

/* ui-base.js · Paquete B · componentes compartidos de interfaz (CONTRATO §10, PLAN §1)
 *
 * Expone ING.ui.{h, icon, md, chipEstado, chipNivel, chipRef, chipsRefs, tarjetaGrafica, recuadroObjetivo,
 *                toast, dialogo, hoja, abrirRef, irA, chart, qr, ls, fmt, panelActual, ESTADOS, NIVELES}
 * y el registro de rutas ING.rutas.
 *
 * RUTAS · cómo registrar una pantalla (lo resuelve app.js):
 *   ING.rutas["inicio"] = (p) => nodo;                 // #/inicio
 *   ING.rutas["lab/micro"] = (p) => nodo;              // #/lab/micro
 *   ING.rutas["exp"] = (p) => nodo;                    // #/exp/ING-26-0351/muestras  → p.segs = ["ING-26-0351","muestras"]
 *   ING.rutas["exp/:ref/:pestana?"] = (p) => nodo;     // también vale con patrón → p.ref, p.pestana
 * Se busca primero la clave más larga que encaje. p = {ruta, hash, segs, q (query como objeto), ref, id, pestana, ...}.
 * La función devuelve un Node, un array de nodos, null o una Promise de lo anterior.
 */
(function () {
  "use strict";
  var ING = (window.ING = window.ING || {});
  ING.rutas = ING.rutas || {};
  var ui = (ING.ui = ING.ui || {});

  /* ---------- almacenamiento local seguro ---------- */
  ui.ls = {
    get: function (k, def) { try { var v = window.localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- datos (de datos.js si existe; si no, de las etiquetas JSON) ---------- */
  var _json = {};
  function jsonTag(nombre) {
    if (_json[nombre] !== undefined) return _json[nombre];
    var el = document.getElementById("datos-" + nombre);
    try { _json[nombre] = el ? JSON.parse(el.textContent) : null; } catch (e) { _json[nombre] = null; }
    return _json[nombre];
  }
  ui.cat = function () { return ING.cat || jsonTag("catalogos") || {}; };
  ui.reglasLista = function () {
    var r = ING.reglas || jsonTag("reglas") || {};
    return Array.isArray(r) ? r : (r.reglas || []);
  };
  ui.refsLista = function () { var r = ING.refs || jsonTag("referencias") || []; return Array.isArray(r) ? r : Object.values(r); };
  var _refIdx = null;
  ui.ref = function (id) {
    if (ING.idx && ING.idx.refs && ING.idx.refs[id]) return ING.idx.refs[id];
    if (!_refIdx) { _refIdx = {}; ui.refsLista().forEach(function (r) { _refIdx[r.id] = r; }); }
    return _refIdx[id] || null;
  };
  ui.lista = function (col) { if (!col) return []; return Array.isArray(col) ? col : Object.values(col); };

  /* ---------- formato es-ES (usa ING.fmt si existe) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var fmtLocal = {
    num: function (x, dec) {
      if (x === null || x === undefined || x === "" || isNaN(x)) return "—";
      dec = dec === undefined ? 0 : dec;
      return Number(x).toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: Math.abs(x) >= 10000 });
    },
    fecha: function (iso) { if (!iso) return ""; var s = String(iso); return s.slice(8, 10) + "-" + s.slice(5, 7) + "-" + s.slice(0, 4); },
    hora: function (iso) { if (!iso) return ""; var s = String(iso); return s.length > 15 ? s.slice(11, 16) : ""; },
    fechaHora: function (iso) { if (!iso) return ""; return fmtLocal.fecha(iso) + " " + fmtLocal.hora(iso); },
    dias: function (x) { return fmtLocal.num(x, 1) + " días"; }
  };
  ui.fmt = {
    num: function (x, dec) { return ING.fmt && ING.fmt.num ? ING.fmt.num(x, dec) : fmtLocal.num(x, dec); },
    fecha: function (iso) { return ING.fmt && ING.fmt.fecha ? ING.fmt.fecha(iso) : fmtLocal.fecha(iso); },
    hora: function (iso) { return ING.fmt && ING.fmt.hora ? ING.fmt.hora(iso) : fmtLocal.hora(iso); },
    fechaHora: function (iso) { return ING.fmt && ING.fmt.fechaHora ? ING.fmt.fechaHora(iso) : fmtLocal.fechaHora(iso); },
    dias: function (x) { return ING.fmt && ING.fmt.dias ? ING.fmt.dias(x) : fmtLocal.dias(x); },
    pct: function (x) { return fmtLocal.num(x, 0) + " %"; },
    dm: function (iso) { if (!iso) return ""; var s = String(iso); return s.slice(8, 10) + "-" + s.slice(5, 7); },
    hoyISO: function (desfaseDias) {
      var d = new Date(); d.setDate(d.getDate() - (desfaseDias || 0));
      return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }
  };

  /* ---------- h() ---------- */
  function anadir(el, hijo) {
    if (hijo === null || hijo === undefined || hijo === false || hijo === true) return;
    if (Array.isArray(hijo)) { hijo.forEach(function (x) { anadir(el, x); }); return; }
    if (hijo instanceof Node) { el.appendChild(hijo); return; }
    el.appendChild(document.createTextNode(String(hijo)));
  }
  var SVG_TAGS = { svg: 1, g: 1, path: 1, rect: 1, circle: 1, line: 1, polyline: 1, polygon: 1, text: 1, tspan: 1, defs: 1, marker: 1, title: 1 };
  ui.h = function (tag, attrs) {
    var svg = SVG_TAGS[tag] && tag !== "title" || (tag === "title" && attrs && attrs.svg);
    var el = svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) {
      anadir(el, attrs); attrs = null;
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "svg") return;
        if (k === "class" || k === "className") { el.setAttribute("class", Array.isArray(v) ? v.filter(Boolean).join(" ") : v); }
        else if (k === "testid") { el.setAttribute("data-testid", v); }
        else if (k === "style" && typeof v === "object") { Object.keys(v).forEach(function (s) { if (s.indexOf("--") === 0) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; }); }
        else if (k === "dataset" && typeof v === "object") { Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; }); }
        else if (k.slice(0, 2) === "on" && typeof v === "function") { el.addEventListener(k.slice(2).toLowerCase(), v); }
        else if (k === "text" || k === "textContent") { el.textContent = v; }
        else if (!svg && (k === "value" || k === "checked" || k === "selected" || k === "disabled" || k === "open" || k === "hidden")) {
          el[k] = v; if (v === true && k !== "value") el.setAttribute(k, "");
        }
        else if (v === true) { el.setAttribute(k, ""); }
        else { el.setAttribute(k, String(v)); }
      });
    }
    for (var i = 2; i < arguments.length; i++) anadir(el, arguments[i]);
    return el;
  };
  var h = ui.h;

  /* ---------- iconos Lucide (estáticos, de build.py) ---------- */
  var _plantillaIco = {};
  ui.icon = function (nombre, clase) {
    var src = ING.iconos && ING.iconos[nombre];
    if (!src) { var s = document.createElement("span"); s.className = "ico"; s.setAttribute("aria-hidden", "true"); return s; }
    if (!_plantillaIco[nombre]) {
      var t = document.createElement("template");
      t.innerHTML = src;  /* contenido estático del propio build, no datos de usuario */
      _plantillaIco[nombre] = t.content.firstElementChild || t.content.firstChild;
    }
    var n = _plantillaIco[nombre].cloneNode(true);
    if (clase) n.setAttribute("class", n.getAttribute("class") + " " + clase);
    return n;
  };

  /* ---------- md: solo *cursiva*, todo lo demás como texto ---------- */
  ui.md = function (texto) {
    var frag = document.createDocumentFragment();
    if (texto === null || texto === undefined) return frag;
    String(texto).split(/(\*[^*\n]+\*)/g).forEach(function (parte) {
      if (!parte) return;
      if (parte.length > 2 && parte[0] === "*" && parte[parte.length - 1] === "*") {
        var em = document.createElement("em"); em.textContent = parte.slice(1, -1); frag.appendChild(em);
      } else frag.appendChild(document.createTextNode(parte));
    });
    return frag;
  };

  /* ---------- estados y niveles ---------- */
  ui.ESTADOS = [
    { id: "RECIBIDO", nombre: "Recibido", icono: "clock", tono: "pendiente" },
    { id: "EN_ANALISIS", nombre: "En análisis", icono: "flask-conical", tono: "info" },
    { id: "PENDIENTE_VALORACION", nombre: "Pendiente de valoración", icono: "triangle-alert", tono: "revisar" },
    { id: "LISTO_PARA_VALIDAR", nombre: "Listo para validar", icono: "file-check", tono: "soft" },
    { id: "EMITIDO", nombre: "Emitido", icono: "circle-check", tono: "ok" },
    { id: "BLOQUEADO", nombre: "Bloqueado", icono: "lock", tono: "novalido" }
  ];
  ui.NIVELES = [
    { id: "critico", nombre: "Crítico", icono: "octagon-alert", tono: "critico" },
    { id: "revisar", nombre: "Revisar", icono: "triangle-alert", tono: "revisar" },
    { id: "info", nombre: "Información", icono: "info", tono: "info" },
    { id: "no_valido", nombre: "No válido", icono: "ban", tono: "novalido" }
  ];
  function buscar(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; }
  ui.estadoInfo = function (e) { return buscar(ui.ESTADOS, e) || { id: e, nombre: String(e || "—"), icono: "info", tono: "" }; };
  ui.nivelInfo = function (n) { return buscar(ui.NIVELES, n) || { id: n, nombre: String(n || "—"), icono: "info", tono: "" }; };

  ui.chipEstado = function (estado, attrs) {
    var e = ui.estadoInfo(estado);
    var a = { class: "chip chip-estado", "data-tono": e.tono, "data-estado": e.id, testid: "chip-estado" };
    if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return h("span", a, ui.icon(e.icono), h("span", null, e.nombre));
  };
  ui.chipNivel = function (nivel, attrs) {
    var n = ui.nivelInfo(nivel);
    var a = { class: "chip chip-nivel", "data-tono": n.tono, "data-nivel": n.id };
    if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
    return h("span", a, ui.icon(n.icono), h("span", null, n.nombre));
  };

  ui.chipRef = function (refId) {
    var r = ui.ref(refId);
    return h("button", {
      type: "button", class: "chip-ref", testid: "chip-ref", "data-ref-id": refId,
      "aria-label": "Referencia " + refId + (r ? ": " + String(r.cita).slice(0, 80) : ""),
      onclick: function (ev) { ev.preventDefault(); ev.stopPropagation(); ui.abrirRef(refId); }
    }, refId);
  };
  ui.chipsRefs = function (ids) {
    var c = h("span", { class: "chips chips-refs" });
    (ids || []).forEach(function (id) { if (id) c.appendChild(ui.chipRef(id)); });
    return c;
  };

  /* ---------- tabla sencilla ---------- */
  ui.tabla = function (cabeceras, filas, numCols) {
    numCols = numCols || [];
    var t = h("table", { class: "tabla" },
      h("thead", null, h("tr", null, cabeceras.map(function (c, i) { return h("th", { scope: "col", class: numCols.indexOf(i) >= 0 ? "n" : null }, c); }))),
      h("tbody", null, filas.map(function (f) {
        return h("tr", null, f.map(function (c, i) { return h(i === 0 ? "th" : "td", { scope: i === 0 ? "row" : null, class: numCols.indexOf(i) >= 0 ? "n" : null }, c); }));
      })));
    return h("div", { class: "tabla-wrap" }, t);
  };

  /* ---------- tarjeta de gráfica (ESPEC §6, anatomía obligatoria) ---------- */
  ui.tarjetaGrafica = function (o) {
    o = o || {};
    var cuerpo;
    if (o.canvas) cuerpo = h("div", { class: "grafica-caja", "data-alto": o.alto || null, style: o.alto ? { height: o.alto + "px" } : null }, o.canvas);
    else cuerpo = o.nodo || null;
    var zonaTabla = h("div", { class: "grafica-tabla", hidden: true });
    var btnTabla = h("button", {
      type: "button", class: "btn btn-texto", testid: "ver-tabla", "aria-expanded": "false",
      onclick: function () {
        var abrir = zonaTabla.hidden;
        if (abrir && !zonaTabla.firstChild) {
          var t = typeof o.tabla === "function" ? o.tabla() : o.tabla;
          if (t && t.cabeceras) t = ui.tabla(t.cabeceras, t.filas, t.numericas);
          if (t) zonaTabla.appendChild(t);
        }
        zonaTabla.hidden = !abrir;
        btnTabla.setAttribute("aria-expanded", abrir ? "true" : "false");
        btnTabla.lastChild.textContent = abrir ? "Ocultar tabla" : "Ver tabla";
      }
    }, ui.icon("file-text"), h("span", null, "Ver tabla"));
    var como = o.comoSeLee ? h("details", { class: "plegable" },
      h("summary", null, ui.icon("circle-help"), h("span", null, "¿Cómo se lee?"), ui.icon("chevron-down", "chev")),
      h("div", { class: "grafica-como" }, typeof o.comoSeLee === "string" ? ui.md(o.comoSeLee) : o.comoSeLee)) : null;
    var fuente = String(o.fuente || "").replace(/^Fuente:\s*/, "");
    return h("section", { class: ["tarjeta", "grafica", o.clase], testid: o.id ? "grafica-" + o.id : null, "aria-label": o.titulo },
      h("h2", { class: "grafica-tit" }, o.titulo),
      o.subtitulo ? h("p", { class: "grafica-sub" }, o.subtitulo) : null,
      o.destacado || null,
      cuerpo,
      h("p", { class: "grafica-fuente", testid: "fuente" }, h("b", null, "Fuente:"), " " + fuente),
      h("div", { class: "grafica-pie" },
        o.refs && o.refs.length ? ui.chipsRefs(o.refs) : h("span"),
        h("div", { class: "grafica-acc" }, btnTabla)),
      como,
      zonaTabla);
  };

  /* ---------- recuadro objetivo (plegable, recuerda su estado) ---------- */
  ui.recuadroObjetivo = function (o) {
    o = o || {};
    var clave = "ing-recuadro-" + (o.clave || "x");
    var guardado = ui.ls.get(clave, null);
    var abierto = guardado === null ? !!o.abierto : guardado === "1";
    var d = h("details", { class: "recuadro", testid: "recuadro-objetivo", open: abierto },
      h("summary", null, ui.icon("info"), h("span", null, o.titulo || "Para qué sirve", o.resumen ? h("span", { class: "resumen-corto" }, " · " + o.resumen) : null), ui.icon("chevron-down", "chev")),
      h("dl", null,
        h("div", null, h("dt", null, "Objetivo"), h("dd", null, ui.md(o.objetivo))),
        h("div", null, h("dt", null, "Qué significa"), h("dd", null, ui.md(o.significa))),
        h("div", null, h("dt", null, "Cómo se lee"), h("dd", null, ui.md(o.comoSeLee)))));
    d.addEventListener("toggle", function () { ui.ls.set(clave, d.open ? "1" : "0"); });
    return d;
  };

  /* ---------- toast ---------- */
  function zonaToasts() {
    var z = document.getElementById("toasts");
    if (!z) { z = h("div", { id: "toasts", class: "toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(z); }
    return z;
  }
  /* Un solo aviso a la vez: el nuevo sustituye al anterior. Dura 2,5 s (4 s si lleva botón de acción).
     No captura toques (pointer-events:none) salvo su botón; con una hoja o diálogo abierto se coloca arriba. */
  var _toastActual = null, _toastTimer = null;
  ui.toast = function (texto, accion) {
    var z = zonaToasts();
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
    if (_toastActual && _toastActual.parentNode) _toastActual.parentNode.removeChild(_toastActual);
    z.textContent = "";
    var t = h("div", { class: "toast", testid: "toast" }, h("span", null, texto));
    var cerrar = function () {
      if (t.parentNode) t.parentNode.removeChild(t);
      if (_toastActual === t) { _toastActual = null; if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; } }
    };
    if (accion) {
      var etiqueta = accion.texto || accion.etiqueta || "Ver";
      var fn = accion.fn || accion.onClick || accion.accion;
      var destino = accion.hash || accion.href;
      t.appendChild(h("button", { type: "button", class: "btn-toast", onclick: function () { cerrar(); if (fn) fn(); else if (destino) ui.irA(destino); } }, etiqueta));
    }
    z.appendChild(t);
    _toastActual = t;
    _toastTimer = setTimeout(cerrar, accion ? 4000 : 2500);
    return t;
  };

  /* ---------- hojas y diálogos ---------- */
  var pilaCapas = [];
  function crearCapa(tipo, o) {
    o = o || {};
    var previo = document.activeElement;
    var capa = h("div", { class: "capa" + (tipo === "dialogo" ? " dialogo-capa" : "") });
    var tituloId = "capa-t-" + Math.random().toString(36).slice(2, 8);
    var cuerpo = h("div", { class: "hoja-cuerpo" });
    anadir(cuerpo, typeof o.cuerpo === "function" ? o.cuerpo() : o.cuerpo);
    var panel = h("div", {
      class: tipo === "dialogo" ? "hoja dialogo" : "hoja", role: "dialog", "aria-modal": "true", "aria-labelledby": tituloId,
      testid: o.testid || null
    });
    var ctl = { capa: capa, el: panel, nodo: panel, cuerpo: cuerpo, botones: {}, cerrado: false };
    ctl.cerrar = function () {
      if (ctl.cerrado) return; ctl.cerrado = true;
      if (capa.parentNode) capa.parentNode.removeChild(capa);
      var i = pilaCapas.indexOf(ctl); if (i >= 0) pilaCapas.splice(i, 1);
      if (!pilaCapas.length) document.body.classList.remove("con-capa");
      if (o.alCerrar) { try { o.alCerrar(); } catch (e) { setTimeout(function () { throw e; }); } }
      if (previo && previo.focus && document.contains(previo)) { try { previo.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
    };
    var btnX = h("button", { type: "button", class: "hoja-cerrar", "aria-label": "Cerrar", testid: "btn-cerrar-hoja", onclick: ctl.cerrar }, ui.icon("x"));
    panel.appendChild(h("div", { class: "hoja-cab" }, h("h2", { id: tituloId }, o.titulo || ""), btnX));
    panel.appendChild(cuerpo);
    var bs = o.botones || [];
    if (bs.length) {
      var pie = h("div", { class: "hoja-pie" });
      bs.forEach(function (b) {
        if (!b) return;
        var cls = b.tipo === "sec" || b.tipo === "secundario" ? "btn btn-sec" : b.tipo === "peligro" ? "btn btn-peligro" : b.tipo === "texto" ? "btn btn-texto" : "btn";
        var btn = h("button", { type: "button", class: cls, testid: b.testid || null, disabled: !!b.disabled }, b.icono ? ui.icon(b.icono) : null, h("span", null, b.texto || b.etiqueta || "Aceptar"));
        btn.addEventListener("click", function () {
          if (btn.disabled) return;
          var fn = b.onClick || b.fn || b.accion;
          var r = fn ? fn(ctl) : undefined;
          var fin = function (v) { if (v !== false && b.cerrar !== false) ctl.cerrar(); };
          if (r && typeof r.then === "function") { btn.disabled = true; r.then(function (v) { btn.disabled = false; fin(v); }, function (e) { btn.disabled = false; setTimeout(function () { throw e; }); }); }
          else fin(r);
        });
        if (b.testid) ctl.botones[b.testid] = btn;
        pie.appendChild(btn);
      });
      ctl.pie = pie;
      panel.appendChild(pie);
    }
    capa.appendChild(panel);
    capa.addEventListener("mousedown", function (ev) { capa._abajo = ev.target === capa; });
    capa.addEventListener("click", function (ev) { if (ev.target === capa && capa._abajo !== false) ctl.cerrar(); });
    document.body.appendChild(capa);
    document.body.classList.add("con-capa");
    pilaCapas.push(ctl);
    setTimeout(function () {
      var foco = panel.querySelector("[autofocus]") || btnX;
      try { foco.focus({ preventScroll: true }); } catch (e) { /* nada */ }
    }, 30);
    return ctl;
  }
  ui.hoja = function (o) { return crearCapa("hoja", o); };
  ui.dialogo = function (o) { return crearCapa("dialogo", o); };
  ui.cerrarCapas = function () { pilaCapas.slice().forEach(function (c) { c.cerrar(); }); };
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && pilaCapas.length) { ev.preventDefault(); pilaCapas[pilaCapas.length - 1].cerrar(); }
  });

  /* ---------- referencias: dónde se usa cada una ---------- */
  var _usos = null;
  ui.usosRefs = function () {
    if (_usos) return _usos;
    _usos = {};
    function add(id, etiqueta, destino) {
      if (!id) return;
      (_usos[id] = _usos[id] || []);
      if (!_usos[id].some(function (u) { return u.etiqueta === etiqueta; })) _usos[id].push({ etiqueta: etiqueta, destino: destino });
    }
    var cat = ui.cat();
    ui.reglasLista().forEach(function (r) { (r.refs || []).forEach(function (x) { add(x, "Regla " + r.id, "#/mas/reglas"); }); });
    (cat.analisis || []).forEach(function (a) { (a.refs || []).forEach(function (x) { add(x, a.nombre, null); }); });
    (cat.plan || []).forEach(function (p) { (p.refs || []).forEach(function (x) { add(x, "Plan " + p.id, null); }); });
    (cat.dianas || []).forEach(function (d) {
      (d.refs || []).concat(d.refs_positivo || [], d.refs_negativo || []).forEach(function (x) { add(x, "Diana " + String(d.nombre), null); });
    });
    (cat.patogenos || []).forEach(function (p) { (p.refs || []).forEach(function (x) { add(x, "Patógeno " + String(p.nombre || p.id), null); }); });
    (cat.taxones || []).forEach(function (t) { (t.refs || []).forEach(function (x) { add(x, "Taxón " + String(t.nombre_md || t.id), null); }); });
    Object.keys(cat).forEach(function (k) {
      var v = cat[k];
      if (Array.isArray(v) && ["reglas", "analisis", "plan", "dianas", "patogenos", "taxones"].indexOf(k) < 0) {
        v.forEach(function (it) { if (it && it.refs) it.refs.forEach(function (x) { add(x, "Catálogo: " + (it.nombre || it.id), null); }); });
      }
    });
    var par = cat.parametros || {};
    (par.norma_antibiograma_refs || []).forEach(function (x) { add(x, "Antibiograma", null); });
    (ui.REFS_PANTALLA || []).forEach(function (p) { p.refs.forEach(function (x) { add(x, p.etiqueta, p.destino); }); });
    return _usos;
  };
  /* Referencias citadas por las propias pantallas (gráficas, rótulos) */
  ui.REFS_PANTALLA = [
    { etiqueta: "Gráfica G1", destino: "#/inicio", refs: ["REF-01"] },
    { etiqueta: "Gráfica G4", destino: "#/inicio", refs: ["REF-64"] },
    { etiqueta: "Gráfica G5", destino: "#/inicio", refs: ["REF-73", "REF-57", "REF-24"] },
    { etiqueta: "Gráfica G6", destino: "#/inicio", refs: ["REF-17", "REF-23"] },
    { etiqueta: "Gráfica G7", destino: "#/lab/micro", refs: ["REF-48"] },
    { etiqueta: "Gráfica G8", destino: "#/lab/molecular", refs: ["REF-73"] },
    { etiqueta: "Validación y versión del informe", destino: "#/informes", refs: ["REF-01"] },
    { etiqueta: "Comunicación a la autoridad", destino: "#/alertas", refs: ["REF-137"] }
  ];

  function enlaceRef(r) {
    if (!r || r.verificado !== true) return null;
    if (r.pmid) return "https://pubmed.ncbi.nlm.nih.gov/" + r.pmid + "/";
    if (r.doi) return "https://doi.org/" + r.doi;
    if (r.url && /^https:\/\//.test(r.url)) return r.url;
    return null;
  }
  ui.enlaceRef = enlaceRef;
  var TIPO_REF = { norma: "Norma", guia: "Guía", legislacion: "Legislación", articulo: "Artículo" };
  ui.TIPO_REF = TIPO_REF;

  ui.fichaRef = function (refId, conTitulo) {
    var r = ui.ref(refId);
    if (!r) return h("p", null, "No se encuentra la referencia " + refId + ".");
    var url = enlaceRef(r);
    var usos = ui.usosRefs()[r.id] || [];
    var meta = h("dl", { class: "ref-meta" },
      h("dt", null, "Tipo"), h("dd", null, TIPO_REF[r.tipo] || r.tipo || "—"),
      h("dt", null, "Año"), h("dd", null, r.anio ? String(r.anio) : "—"),
      r.pmid ? [h("dt", null, "PMID"), h("dd", null, String(r.pmid))] : null,
      r.doi ? [h("dt", null, "DOI"), h("dd", null, r.doi)] : null);
    return h("div", { class: "ref-ficha", "data-ref-id": r.id },
      conTitulo ? h("div", { class: "fila" }, h("b", null, r.id), r.verificado ? null : h("span", { class: "chip", "data-tono": "revisar" }, ui.icon("triangle-alert"), "No verificada")) : null,
      h("p", { class: "ref-cita" }, ui.md(r.cita)),
      meta,
      url ? h("p", null, h("a", { class: "ref-enlace", href: url, target: "_blank", rel: "noopener noreferrer", testid: "ref-enlace" }, ui.icon("external-link"), h("span", null, url.replace(/^https:\/\//, "").slice(0, 60) + (url.length > 68 ? "…" : ""))))
        : h("p", { class: "aviso", "data-tono": "revisar" }, ui.icon("triangle-alert"), h("span", null, "No verificada: se muestra sin enlace.")),
      h("p", { class: "sec" }, h("b", null, r.verificado ? "Comprobada en: " : "Sin confirmar: "), r.verificado ? ui.dondeComprobada(r) : (r.metodo_verificacion || "—")),
      r.uso_en_app ? h("p", { class: "sec muted" }, r.uso_en_app) : null,
      usos.length ? h("div", null, h("p", { class: "sec", style: { marginBottom: "6px" } }, h("b", null, "Se usa en:")),
        h("div", { class: "chips" }, usos.map(function (u) {
          return u.destino ? h("a", { class: "chip", "data-tono": "borde", href: u.destino, onclick: function () { ui.cerrarCapas(); } }, ui.md(u.etiqueta))
            : h("span", { class: "chip", "data-tono": "borde" }, ui.md(u.etiqueta));
        }))) : null);
  };

  /* "Comprobada en": lenguaje llano en lugar del método técnico de verificación (DIR-14) */
  ui.dondeComprobada = function (r) {
    var t = String((r && r.metodo_verificacion) || "") + " " + String((r && r.url) || "");
    var donde = [];
    if (r && r.pmid || /pubmed/i.test(t)) donde.push("PubMed");
    if (/woah/i.test(t)) donde.push("web oficial de la WOAH");
    if (/boe\.es|\bBOE\b/i.test(t)) donde.push("BOE");
    if (/eur-lex|europa\.eu/i.test(t)) donde.push("EUR-Lex (Diario Oficial de la UE)");
    if (/iso\.org/i.test(t)) donde.push("iso.org");
    if (/clsi/i.test(t)) donde.push("web de CLSI");
    if (/efsa/i.test(t)) donde.push("web de la EFSA");
    if (/mapa\.gob|mapa\.es/i.test(t)) donde.push("web del Ministerio de Agricultura");
    if (!donde.length && (r && r.doi || /doi|crossref/i.test(t))) donde.push("registro DOI de la revista");
    if (!donde.length) return String((r && r.metodo_verificacion) || "—").replace(/\b(WebFetch|WebSearch|mcp__\w+)\b/g, "").replace(/\s{2,}/g, " ").trim() || "—";
    return donde.filter(function (x, i) { return donde.indexOf(x) === i; }).join(" · ");
  };

  ui.abrirRef = function (refId) {
    var r = ui.ref(refId);
    return ui.hoja({
      titulo: refId + (r && r.verificado === false ? " · No verificada" : ""),
      testid: "hoja-ref",
      cuerpo: ui.fichaRef(refId, false),
      botones: [{ texto: "Cerrar", tipo: "sec" }]
    });
  };

  /* ---------- navegación ---------- */
  ui.irA = function (hash) {
    if (!hash) return;
    hash = String(hash);
    if (hash[0] !== "#") hash = "#" + (hash[0] === "/" ? "" : "/") + hash;
    if (location.hash === hash) { if (ING.app && ING.app.render) ING.app.render(); }
    else location.hash = hash;
  };

  /* ---------- panel del motor en el ciclo de render (insignias e Inicio lo comparten) ---------- */
  var _panelCache = { ciclo: -1, desde: undefined, valor: null };
  ui.panelActual = function (desde) {
    desde = desde || null;
    var ciclo = ING.app ? ING.app.ciclo : 0;
    if (_panelCache.ciclo === ciclo && _panelCache.desde === desde && _panelCache.valor) return _panelCache.valor;
    if (!(ING.motor && ING.motor.panel && ING.store && ING.store.db)) return null;
    var v = ING.motor.panel(ING.store.db(), desde);
    _panelCache = { ciclo: ciclo, desde: desde, valor: v };
    return v;
  };

  /* ---------- Chart.js: valores por defecto, registro y redibujo por tema ---------- */
  var registro = [];   // {canvas, fabrica, inst}
  function css(nombre) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nombre);
    return (v || "").trim() || "#7A8078";
  }
  ui.css = css;
  function resolverColores(x) {
    if (typeof x === "string") {
      var m = x.match(/^var\((--[\w-]+)\)$/);
      if (m) return css(m[1]);
      if (x.indexOf("--") === 0) return css(x);
      return x;
    }
    if (Array.isArray(x)) return x.map(resolverColores);
    if (x && typeof x === "object" && Object.getPrototypeOf(x) === Object.prototype) {
      var o = {}; Object.keys(x).forEach(function (k) { o[k] = resolverColores(x[k]); }); return o;
    }
    return x;
  }
  function fusion(base, extra) {
    Object.keys(extra || {}).forEach(function (k) {
      var v = extra[k];
      if (v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) {
        if (!base[k] || typeof base[k] !== "object") base[k] = {};
        fusion(base[k], v);
      } else base[k] = v;
    });
    return base;
  }
  function reducida() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function aplicarDefectos() {
    if (!window.Chart) return;
    var C = window.Chart;
    C.defaults.font.family = "'Alegreya Sans', system-ui, sans-serif";
    C.defaults.font.size = 15;
    C.defaults.color = css("--text-muted");
    C.defaults.borderColor = css("--grid");
    C.defaults.locale = "es-ES";
    C.defaults.maintainAspectRatio = false;
    C.defaults.responsive = true;
    C.defaults.animation.duration = reducida() ? 0 : 200;
    C.defaults.plugins.tooltip.backgroundColor = css("--primary");
    C.defaults.plugins.tooltip.titleColor = css("--on-primary");
    C.defaults.plugins.tooltip.bodyColor = css("--on-primary");
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.titleFont = { family: "'Alegreya Sans', system-ui, sans-serif", size: 15, weight: "700" };
    C.defaults.plugins.tooltip.bodyFont = { family: "'Alegreya Sans', system-ui, sans-serif", size: 15 };
    C.defaults.plugins.legend.position = "bottom";
  }
  function construir(reg) {
    if (!window.Chart) return null;
    aplicarDefectos();
    var cfg = typeof reg.fabrica === "function" ? reg.fabrica() : reg.fabrica;
    cfg = resolverColores(cfg);
    var nSeries = cfg.data && cfg.data.datasets ? cfg.data.datasets.length : 0;
    var defectos = {
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: reducida() ? 0 : 200 },
        plugins: {
          legend: { display: nSeries >= 2 && cfg.type !== "doughnut" && cfg.type !== "pie", position: "bottom", labels: { boxWidth: 14, boxHeight: 14, padding: 14, color: css("--text") } },
          tooltip: { callbacks: {} }
        }
      }
    };
    if (cfg.type !== "doughnut" && cfg.type !== "pie") {
      defectos.options.scales = {
        x: { grid: { color: css("--grid") }, ticks: { color: css("--text-muted"), font: { size: 15 } }, border: { color: css("--grid") } },
        y: { grid: { color: css("--grid") }, ticks: { color: css("--text-muted"), font: { size: 15 } }, border: { color: css("--grid") } }
      };
    }
    var final = fusion(defectos, cfg);
    // escalas: si cfg.options.scales tiene otras claves, añadir colores también
    if (final.options.scales) {
      Object.keys(final.options.scales).forEach(function (k) {
        var s = final.options.scales[k];
        s.grid = s.grid || {}; if (!s.grid.color) s.grid.color = css("--grid");
        s.ticks = s.ticks || {}; if (!s.ticks.color) s.ticks.color = css("--text-muted");
      });
    }
    try { reg.inst = new window.Chart(reg.canvas, final); }
    catch (e) { reg.inst = null; setTimeout(function () { throw e; }); }
    return reg.inst;
  }
  /* ui.chart(canvas, config | () => config). Se crea en cuanto el canvas está en el documento.
     Devuelve un control {chart (instancia o null), destroy(), redibujar()}. */
  ui.chart = function (canvas, config) {
    var reg = { canvas: canvas, fabrica: config, inst: null };
    registro.push(reg);
    var intentos = 0;
    function intentar() {
      if (registro.indexOf(reg) < 0) return;
      if (canvas.isConnected) { construir(reg); return; }
      if (++intentos < 120) requestAnimationFrame(intentar);
      else quitar(reg);
    }
    if (canvas.isConnected) construir(reg); else requestAnimationFrame(intentar);
    return {
      get chart() { return reg.inst; },
      destroy: function () { quitar(reg); },
      redibujar: function () { if (reg.inst) { reg.inst.destroy(); } construir(reg); }
    };
  };
  function quitar(reg) {
    var i = registro.indexOf(reg); if (i >= 0) registro.splice(i, 1);
    if (reg.inst) { try { reg.inst.destroy(); } catch (e) { /* nada */ } reg.inst = null; }
  }
  /* Destruye los gráficos cuyo canvas ya no está en la página (lo llama app.js tras cada render) */
  ui.limpiarCharts = function () { registro.slice().forEach(function (r) { if (!r.canvas.isConnected && r.inst) quitar(r); }); };
  ui.redibujarCharts = function () {
    registro.slice().forEach(function (r) {
      if (!r.canvas.isConnected) { if (r.inst) quitar(r); return; }
      if (r.inst) { try { r.inst.destroy(); } catch (e) { /* nada */ } r.inst = null; }
      construir(r);
    });
  };
  ui._charts = registro;
  var _tRedib = null;
  function programarRedibujo() { clearTimeout(_tRedib); _tRedib = setTimeout(ui.redibujarCharts, 30); }
  try {
    new MutationObserver(programarRedibujo).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", programarRedibujo); else if (mq.addListener) mq.addListener(programarRedibujo);
  } catch (e) { /* sin observadores */ }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(programarRedibujo, function () { /* nada */ });

  /* ---------- tema y modo presentación ---------- */
  ui.tema = function () { var t = ui.ls.get("ing-tema", "auto"); return t === "light" || t === "dark" ? t : "auto"; };
  ui.setTema = function (t) {
    if (t === "claro") t = "light"; if (t === "oscuro") t = "dark";
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else { document.documentElement.removeAttribute("data-theme"); t = "auto"; }
    ui.ls.set("ing-tema", t);
  };
  ui.presentacion = function () { return ui.ls.get("ing-presentacion", "0") === "1"; };
  ui.setPresentacion = function (on) {
    document.documentElement.classList.toggle("presentacion", !!on);
    ui.ls.set("ing-presentacion", on ? "1" : "0");
  };
  (function aplicarPreferencias() {
    var t = ui.tema(); if (t !== "auto") document.documentElement.setAttribute("data-theme", t);
    if (ui.presentacion()) document.documentElement.classList.add("presentacion");
  })();

  /* ---------- QR (qrcode-generator 1.4.4) → <svg> ---------- */
  ui.qr = function (texto, px) {
    px = px || 120;
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "qr");
    svg.setAttribute("width", px); svg.setAttribute("height", px);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Código QR: " + texto);
    if (typeof window.qrcode !== "function") return svg;
    var q = window.qrcode(0, "M");
    q.addData(String(texto));
    q.make();
    var n = q.getModuleCount(), m = 2, tot = n + 2 * m, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    svg.setAttribute("viewBox", "0 0 " + tot + " " + tot);
    svg.setAttribute("shape-rendering", "crispEdges");
    var fondo = document.createElementNS(svgNS, "rect");
    fondo.setAttribute("width", tot); fondo.setAttribute("height", tot); fondo.setAttribute("fill", "#FFFFFF");
    var p = document.createElementNS(svgNS, "path");
    p.setAttribute("d", d); p.setAttribute("fill", "#1F272E");
    svg.appendChild(fondo); svg.appendChild(p);
    return svg;
  };

  /* ---------- roles ---------- */
  ui.ROLES = [
    { id: "responsable", nombre: "Responsable técnico", corto: "RT" },
    { id: "microbiologia", nombre: "Microbiología", corto: "Mi" },
    { id: "molecular", nombre: "Biología molecular", corto: "Mo" },
    { id: "recepcion", nombre: "Recepción", corto: "Re" }
  ];
  ui.rolInfo = function (id) { return buscar(ui.ROLES, id) || ui.ROLES[0]; };
  ui.rolActual = function () {
    try { if (ING.store && ING.store.rol) return ING.store.rol() || "responsable"; } catch (e) { /* nada */ }
    return ui.ls.get("ing-rol", "responsable");
  };
  ui.setRol = function (r) {
    if (ING.store && ING.store.setRol) return ING.store.setRol(r);
    ui.ls.set("ing-rol", r);
    if (ING.app && ING.app.render) ING.app.render();
  };
  ui.abrirSelectorRol = function () {
    var actual = ui.rolActual();
    var ctl = ui.hoja({
      titulo: "¿Quién está usando la demo?",
      testid: "hoja-rol",
      cuerpo: [
        h("p", { class: "muted sec" }, "No es un inicio de sesión: el rol solo queda registrado en cada acción y sirve para el aviso de revisión."),
        h("div", { class: "pila" }, ui.ROLES.map(function (r) {
          return h("button", {
            type: "button", class: "btn btn-bloque " + (r.id === actual ? "" : "btn-sec"), testid: "rol-" + r.id, "aria-pressed": r.id === actual ? "true" : "false",
            onclick: function () { ctl.cerrar(); if (r.id !== actual) { Promise.resolve(ui.setRol(r.id)).then(function () { ui.toast("Rol: " + r.nombre); }); } }
          }, h("span", { class: "chip", "data-tono": "borde", style: { minWidth: "44px", justifyContent: "center" } }, r.corto), h("span", null, r.nombre));
        }))
      ]
    });
    return ctl;
  };
})();

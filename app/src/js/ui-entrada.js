/* ui-entrada.js · Paquete C · #/nueva (ESPEC §3.2) + utilidades comunes del paquete C (ING.cx).
   Reglas: nada se ejecuta de otros módulos durante la carga; todo texto de usuario va por textContent. */
(function (root) {
  "use strict";
  var ING = root.ING = root.ING || {};
  ING.ui = ING.ui || {};
  ING.rutas = ING.rutas || {};

  /* ================================================================ utilidades comunes (ING.cx) */
  var cx = ING.cx = ING.cx || {};

  /* h propio del paquete C: atributos conocidos, eventos on*, hijos como texto (textContent) o nodos. */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value") el.value = v;
      else if (k === "checked" || k === "selected" || k === "disabled") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : String(v));
    });
    for (var i = 2; i < arguments.length; i++) anadir(el, arguments[i]);
    return el;
  }
  function anadir(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { anadir(el, x); }); return; }
    if (typeof c === "object" && c.nodeType) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }
  cx.h = h;

  cx.icon = function (nombre) {
    try { if (ING.ui.icon) { var n = ING.ui.icon(nombre); if (n) return n; } } catch (e) { /* sigue */ }
    var s = document.createElement("span");
    s.className = "cx-ico";
    s.setAttribute("aria-hidden", "true");
    var svg = (ING.iconos || {})[nombre];
    if (svg) { var t = document.createElement("template"); t.innerHTML = svg; s.appendChild(t.content); }
    return s;
  };
  cx.md = function (t) {
    try { if (ING.fmt && ING.fmt.md) return ING.fmt.md(t); } catch (e) { /* sigue */ }
    return document.createTextNode(String(t == null ? "" : t).replace(/\*([^*]+)\*/g, "$1"));
  };
  cx.plano = function (t) { return String(t == null ? "" : t).replace(/\*([^*]+)\*/g, "$1"); };
  cx.chipRef = function (id) {
    try { if (ING.ui.chipRef) return ING.ui.chipRef(id); } catch (e) { /* sigue */ }
    return h("button", { type: "button", class: "cx-chipref", text: id, onclick: function () { if (ING.ui.abrirRef) ING.ui.abrirRef(id); } });
  };
  cx.refs = function (lista) {
    lista = (lista || []).filter(Boolean);
    if (!lista.length) return null;
    try { if (ING.ui.chipsRefs) return ING.ui.chipsRefs(lista); } catch (e) { /* sigue */ }
    return h("span", { class: "cx-refs" }, lista.map(cx.chipRef));
  };
  var ESTADOS = {
    RECIBIDO: ["Recibido", "clock"], EN_ANALISIS: ["En análisis", "flask-conical"],
    PENDIENTE_VALORACION: ["Pendiente de valoración", "triangle-alert"], LISTO_PARA_VALIDAR: ["Listo para validar", "file-check"],
    EMITIDO: ["Emitido", "circle-check"], BLOQUEADO: ["Bloqueado", "lock"]
  };
  cx.ESTADOS = ESTADOS;
  cx.ORDEN_ESTADOS = ["RECIBIDO", "EN_ANALISIS", "PENDIENTE_VALORACION", "LISTO_PARA_VALIDAR", "EMITIDO", "BLOQUEADO"];
  cx.chipEstado = function (estado, testid) {
    var n = null;
    try { if (ING.ui.chipEstado) n = ING.ui.chipEstado(estado); } catch (e) { n = null; }
    if (!n) {
      var e = ESTADOS[estado] || [estado, "info"];
      n = h("span", { class: "cx-chip-estado cx-est-" + estado }, cx.icon(e[1]), h("span", { text: e[0] }));
    }
    n.setAttribute("data-testid", testid || "chip-estado");
    n.setAttribute("data-estado", estado);
    return n;
  };
  cx.toast = function (texto, accion) {
    try { if (ING.ui.toast) { ING.ui.toast(texto, accion); return; } } catch (e) { /* sigue */ }
  };
  cx.irA = function (hash) {
    if (ING.ui.irA) { try { ING.ui.irA(hash); return; } catch (e) { /* sigue */ } }
    location.hash = hash;
  };
  /* hash actual → {segs, q} ("#/exp/ING-26-0351/muestras?x=1") */
  cx.ruta = function () {
    var s = (location.hash || "").replace(/^#\/?/, "");
    var qi = s.indexOf("?"), qs = qi >= 0 ? s.slice(qi + 1) : "";
    if (qi >= 0) s = s.slice(0, qi);
    var q = {};
    qs.split("&").forEach(function (p) {
      if (!p) return;
      var kv = p.split("=");
      try { q[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || "").replace(/\+/g, " ")); } catch (e) { /* ignora */ }
    });
    return { segs: s.split("/").filter(Boolean), q: q };
  };
  cx.db = function () { return ING.store.db(); };
  cx.rol = function () { try { return ING.store.rol(); } catch (e) { return "responsable"; } };
  cx.nombreRol = function (r) { var x = ING.idx.roles && ING.idx.roles[r]; return x ? x.nombre : r; };
  cx.usuarioRol = function (r) { var x = ING.idx.roles && ING.idx.roles[r]; return x ? x.usuario : r; };
  /* ahora en hora de Madrid con desfase fijo +02:00 (CONTRATO §1) */
  cx.ahora = function () {
    var d = new Date(Date.now() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 19) + "+02:00";
  };
  cx.hoy = function () { return cx.ahora().slice(0, 10); };
  cx.fecha = function (iso) { return ING.fmt && ING.fmt.fecha ? ING.fmt.fecha(iso) : String(iso || "").slice(0, 10); };
  cx.fechaHora = function (iso) { return ING.fmt && ING.fmt.fechaHora ? ING.fmt.fechaHora(iso) : String(iso || ""); };
  cx.fechaHoraCorta = function (iso) {
    if (ING.fmt && ING.fmt.fechaHoraCorta) return ING.fmt.fechaHoraCorta(iso);
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || "");
    return m ? m[3] + "-" + m[2] + " " + m[4] + ":" + m[5] : "";
  };
  cx.ct = function (v) { return v == null || v === "" ? "Sin Ct" : Number(v).toFixed(1).replace(".", ","); };
  cx.deExp = function (db, col, ref) {
    var out = [], c = db[col] || {};
    Object.keys(c).forEach(function (k) { if (c[k] && c[k].expediente_id === ref) out.push(c[k]); });
    out.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    return out;
  };
  cx.informes = function (db, ref) {
    return cx.deExp(db, "informes", ref).sort(function (a, b) { return a.version - b.version; });
  };
  cx.estado = function (db, ref) { try { return ING.motor.estadoExpediente(db, ref); } catch (e) { return "RECIBIDO"; } };
  cx.progreso = function (db, ref) {
    try { return ING.motor.progreso(db, ref); } catch (e) { return { micro: { x: 0, n: 0 }, molecular: { x: 0, n: 0 } }; }
  };
  cx.txtProg = function (p) { return p && p.n ? p.x + "/" + p.n : "—"; };
  /* alertas que cuentan como "por valorar" en un expediente */
  cx.pendientes = function (db, ref) {
    var al = [];
    try { al = ING.motor.alertas(db, ref) || []; } catch (e) { al = []; }
    return {
      todas: al,
      alertas: al.filter(function (a) { return a.estado === "pendiente"; }).length,
      comunicaciones: al.filter(function (a) { return a.comunicacion_pendiente; }).length
    };
  };
  cx.storage = function (tipo) { try { return root[tipo]; } catch (e) { return null; } };

  /* ---- hoja y diálogo: usan los de B cuando existen; si no, uno propio con Esc / tocar fuera / ✕ */
  var abierta = null;
  function cerrarAbierta() { if (abierta) { var a = abierta; abierta = null; a.cerrar(); } }
  cx.modal = function (o) {
    /* o = {titulo, cuerpo (nodo), testid, tipo:"hoja"|"dialogo", alCerrar} → {cerrar, nodo} */
    cerrarAbierta();
    var fnB = o.tipo === "dialogo" ? ING.ui.dialogo : ING.ui.hoja;
    if (typeof fnB === "function") {
      var cb = null;
      try { cb = fnB({ titulo: o.titulo, cuerpo: o.cuerpo, testid: o.testid || null, alCerrar: function () { if (abierta === cb) abierta = null; if (o.alCerrar) o.alCerrar(); } }); } catch (e) { cb = null; }
      if (cb) {
        cb.nodo = cb.nodo || cb.el;
        abierta = cb;
        setTimeout(function () {
          var f = cb.nodo && cb.nodo.querySelector("input:not([type=hidden]):not([type=checkbox]),textarea");
          if (f) { try { f.focus({ preventScroll: true }); } catch (x) { /* nada */ } }
        }, 60);
        return cb;
      }
    }
    var previo = document.activeElement;
    var fondo = h("div", { class: "cx-velo" + (o.tipo === "dialogo" ? " cx-velo-dialogo" : "") });
    var caja = h("div", {
      class: o.tipo === "dialogo" ? "cx-dialogo" : "cx-hoja", role: "dialog", "aria-modal": "true",
      "aria-label": o.titulo, "data-testid": o.testid || null
    });
    var cab = h("div", { class: "cx-modal-cab" },
      h("h2", { class: "cx-modal-titulo", text: o.titulo }),
      h("button", { type: "button", class: "cx-btn-x", "aria-label": "Cerrar", onclick: function () { ctl.cerrar(); } }, cx.icon("x")));
    caja.appendChild(cab);
    caja.appendChild(o.cuerpo);
    fondo.appendChild(caja);
    function tecla(ev) { if (ev.key === "Escape") ctl.cerrar(); }
    fondo.addEventListener("click", function (ev) { if (ev.target === fondo) ctl.cerrar(); });
    var ctl = {
      nodo: caja,
      cerrar: function () {
        document.removeEventListener("keydown", tecla);
        if (fondo.parentNode) fondo.parentNode.removeChild(fondo);
        document.documentElement.classList.remove("cx-modal-abierto");
        if (abierta === ctl) abierta = null;
        if (o.alCerrar) o.alCerrar();
        try { if (previo && previo.focus && document.contains(previo)) previo.focus(); } catch (e) { /* nada */ }
      }
    };
    document.addEventListener("keydown", tecla);
    document.body.appendChild(fondo);
    document.documentElement.classList.add("cx-modal-abierto");
    abierta = ctl;
    var foco = caja.querySelector("input:not([type=hidden]),select,textarea,button.cx-primario");
    try { (foco || caja.querySelector("button")).focus({ preventScroll: true }); } catch (e) { /* nada */ }
    return ctl;
  };
  cx.cerrarModal = cerrarAbierta;
  /* las rutas de C se repintan con store.on: si hay una hoja abierta se mantiene (vive en body). */

  /* ---- campos de formulario grandes */
  cx.select = function (o) {
    /* o = {testid, valor, opciones:[{id,nombre}] | grupos:[{nombre, opciones}], vacio, onchange, id} */
    var s = h("select", { class: "cx-select", "data-testid": o.testid || null, id: o.id || null, "aria-label": o.aria || null });
    if (o.vacio) s.appendChild(h("option", { value: "", text: o.vacio }));
    function opt(op) { return h("option", { value: op.id, text: cx.plano(op.nombre) }); }
    if (o.grupos) o.grupos.forEach(function (g) { var og = h("optgroup", { label: g.nombre }); g.opciones.forEach(function (op) { og.appendChild(opt(op)); }); s.appendChild(og); });
    else (o.opciones || []).forEach(function (op) { s.appendChild(opt(op)); });
    s.value = o.valor == null ? "" : o.valor;
    if (o.onchange) s.addEventListener("change", function () { o.onchange(s.value); });
    return s;
  };
  cx.campo = function (etiqueta, control, o) {
    o = o || {};
    var id = control.id || ("cx-c-" + Math.random().toString(36).slice(2, 8));
    control.id = id;
    return h("div", { class: "cx-campo" + (o.class ? " " + o.class : "") },
      h("label", { for: id, class: "cx-etq", text: etiqueta }),
      o.ayuda ? h("div", { class: "cx-ayuda", text: o.ayuda }) : null,
      control,
      o.error ? h("p", { class: "cx-error", role: "alert", "data-testid": o.errorTestid || "error-campo", text: o.error }) : null);
  };
  /* chips de una sola elección (radio) */
  cx.chipsRadio = function (o) {
    /* o = {nombre, opciones:[{id,nombre}], valor, onchange, testid} */
    var g = h("div", { class: "cx-chips", role: "radiogroup", "aria-label": o.nombre });
    o.opciones.forEach(function (op) {
      var b = h("button", {
        type: "button", role: "radio", class: "cx-chip" + (op.id === o.valor ? " on" : ""),
        "aria-checked": op.id === o.valor ? "true" : "false", "data-testid": o.testid ? o.testid + "-" + op.id : null,
        "data-valor": op.id, onclick: function () { o.onchange(op.id); }
      }, op.id === o.valor ? cx.icon("check") : null, h("span", { text: cx.plano(op.nombre) }));
      g.appendChild(b);
    });
    return g;
  };

  /* ================================================================ #/nueva */
  var CLAVE_BORRADOR = "ing-borrador-entrada";
  var B = null;       // borrador en curso
  var errores = {};   // {campo: texto}

  function muestraVacia(base) {
    var m = { especie_id: "", tipo_muestra_id: "", identificacion: "", conservacion: "refrigerada", tiempo_toma: "lt24",
      envase_integro: true, rechazada: false, motivo_rechazo: "", auto: true, quitar: [], extra: [] };
    if (base) {
      ["especie_id", "tipo_muestra_id", "conservacion", "tiempo_toma", "envase_integro", "rechazada", "motivo_rechazo", "auto"].forEach(function (k) { m[k] = base[k]; });
      m.quitar = (base.quitar || []).slice();
      m.extra = (base.extra || []).slice();
    }
    return m;
  }
  function borradorNuevo() {
    return { paso: 1, ref_remitente: "", procedencia_id: "", remitente_id: "", motivo_id: "", fecha_toma: cx.hoy(),
      n_animales: "", signos: [], sospecha_id: "", tratamientos_previos: "", observaciones: "", muestras: [muestraVacia()] };
  }
  function guardarBorrador() {
    var ss = cx.storage("sessionStorage");
    try { if (ss) ss.setItem(CLAVE_BORRADOR, JSON.stringify(B)); } catch (e) { /* sin sessionStorage: se sigue en memoria */ }
  }
  function leerBorrador() {
    var ss = cx.storage("sessionStorage");
    try {
      var t = ss && ss.getItem(CLAVE_BORRADOR);
      if (t) { var b = JSON.parse(t); if (b && b.muestras && b.muestras.length) return b; }
    } catch (e) { /* nada */ }
    return null;
  }
  function borrarBorrador() {
    var ss = cx.storage("sessionStorage");
    try { if (ss) ss.removeItem(CLAVE_BORRADOR); } catch (e) { /* nada */ }
  }
  function tieneDatos(b) {
    return !!(b && (b.procedencia_id || b.remitente_id || b.motivo_id || b.ref_remitente || b.muestras.length > 1 ||
      b.muestras.some(function (m) { return m.identificacion; })));
  }

  function aplicarDefaultsMotivo(motivoId) {
    var mo = ING.idx.motivos[motivoId];
    var d = mo && mo.defaults;
    if (!d) return;
    B.muestras.forEach(function (m) {
      if (!m.auto) return;
      if (d.especie_id) m.especie_id = d.especie_id;
      if (d.tipo_muestra_id) m.tipo_muestra_id = d.tipo_muestra_id;
    });
    if (d.sospecha_id) B.sospecha_id = d.sospecha_id;
    if (d.signos) d.signos.forEach(function (s) { if (B.signos.indexOf(s) < 0) B.signos.push(s); });
  }

  function regla(id) { return ING.idx.reglas[id]; }
  function fueraCondiciones(m) {
    var r = regla("REC-01");
    if (!r || m.rechazada) return false;
    var c = r.condicion;
    return c.conservaciones.indexOf(m.conservacion) >= 0 || c.tiempos.indexOf(m.tiempo_toma) >= 0 || (c.envase_no_integro && !m.envase_integro);
  }
  function expBorrador() {
    return { motivo_id: B.motivo_id, signos: B.signos.slice(), sospecha_id: B.sospecha_id || null };
  }
  function planDe(m) {
    if (!m.especie_id || !m.tipo_muestra_id || m.rechazada) return [];
    var p = [];
    try { p = ING.motor.planMuestra(expBorrador(), { especie_id: m.especie_id, tipo_muestra_id: m.tipo_muestra_id }) || []; } catch (e) { p = []; }
    return p;
  }
  /* análisis que se crearán para la muestra: plan (menos los desmarcados) + añadidos a mano */
  function analisisDe(m) {
    var out = [];
    planDe(m).forEach(function (p) { if (m.quitar.indexOf(p.analisis_id) < 0) out.push({ analisis_id: p.analisis_id, plan_id: p.plan_id, origen: "plan" }); });
    m.extra.forEach(function (aid) { if (!out.some(function (x) { return x.analisis_id === aid; })) out.push({ analisis_id: aid, plan_id: null, origen: "manual" }); });
    return out;
  }

  function validarPaso(p) {
    errores = {};
    if (p === 1) {
      if (!B.procedencia_id) errores.procedencia = "Falta la procedencia. Elígela para seguir.";
      if (!B.remitente_id) errores.remitente = "Falta el remitente. Elígelo para seguir.";
      if (!B.motivo_id) errores.motivo = "Falta el motivo. Elígelo para seguir.";
      if (!B.fecha_toma) errores.fecha = "Falta la fecha de toma. Indícala para seguir.";
    }
    if (p === 2) {
      if (!B.muestras.length) errores.muestras = "Añade al menos una muestra para seguir.";
      B.muestras.forEach(function (m, i) {
        if (!m.especie_id) errores["especie-" + i] = "Falta la especie de la muestra " + (i + 1) + ".";
        if (!m.tipo_muestra_id) errores["tipo-" + i] = "Falta el tipo de muestra " + (i + 1) + ".";
        if (m.rechazada && !m.motivo_rechazo) errores["rechazo-" + i] = "Elige el motivo del rechazo.";
        if (m.identificacion && m.identificacion.length > 40) errores["ident-" + i] = "Máximo 40 caracteres.";
      });
    }
    return !Object.keys(errores).length;
  }

  var raiz = null;
  function vistaNueva() {
    if (!B) {
      var guardado = leerBorrador();
      B = guardado || borradorNuevo();
      errores = {};
    }
    raiz = h("section", { class: "cx-entrada", "aria-labelledby": "cx-entrada-titulo" });
    pintar();
    return raiz;
  }
  function pintar(focoSelector) {
    if (!raiz) return;
    var db = cx.db();
    var ref = "";
    try { ref = ING.motor.siguienteRef(db); } catch (e) { ref = "ING-26-…"; }
    raiz.textContent = "";
    var nombres = ["Remitente y procedencia", "Muestras", "Análisis propuestos"];
    raiz.appendChild(h("div", { class: "cx-entrada-cab" },
      h("h1", { id: "cx-entrada-titulo", class: "cx-h1", text: "Nueva entrada" }),
      tieneDatos(B) ? h("button", { type: "button", class: "cx-btn-texto", "data-testid": "btn-descartar", text: "Empezar de cero",
        onclick: function () { B = borradorNuevo(); errores = {}; borrarBorrador(); pintar(); } }) : null));
    var prog = h("div", { class: "cx-pasos", role: "progressbar", "aria-valuemin": "1", "aria-valuemax": "3", "aria-valuenow": String(B.paso),
      "aria-label": "Paso " + B.paso + " de 3" });
    for (var i = 1; i <= 3; i++) prog.appendChild(h("span", { class: "cx-paso-seg" + (i <= B.paso ? " on" : "") }));
    raiz.appendChild(prog);
    raiz.appendChild(h("p", { class: "cx-paso-txt", text: "Paso " + B.paso + " de 3 · " + nombres[B.paso - 1] }));
    var cuerpo = B.paso === 1 ? paso1(ref) : B.paso === 2 ? paso2() : paso3(ref);
    raiz.appendChild(cuerpo);
    raiz.appendChild(barraAcciones());
    guardarBorrador();
    if (focoSelector) {
      var f = raiz.querySelector(focoSelector);
      if (f) { try { f.focus(); } catch (e) { /* nada */ } }
    }
  }

  function paso1(ref) {
    var cat = ING.cat;
    var s = h("div", { class: "cx-paso", "data-testid": "paso-1" });
    s.appendChild(h("div", { class: "cx-ref-auto" }, h("span", { class: "cx-etq", text: "Referencia" }),
      h("span", { class: "cx-ref-num", "data-testid": "ref-nueva", text: ref }), h("span", { class: "cx-ayuda", text: "automática" })));
    var grupos = cat.procedencia_tipos.map(function (t) {
      return { nombre: t.nombre, opciones: cat.procedencias.filter(function (p) { return p.tipo === t.id; }).map(function (p) { return { id: p.id, nombre: p.nombre }; }) };
    }).filter(function (g) { return g.opciones.length; });
    s.appendChild(cx.campo("Procedencia", cx.select({ testid: "campo-procedencia", vacio: "Elige la procedencia…", grupos: grupos, valor: B.procedencia_id,
      onchange: function (v) { B.procedencia_id = v; delete errores.procedencia; pintar("[data-testid=campo-remitente]"); } }), { error: errores.procedencia }));
    s.appendChild(cx.campo("Remitente", cx.select({ testid: "campo-remitente", vacio: "Elige el remitente…", opciones: cat.remitentes, valor: B.remitente_id,
      onchange: function (v) { B.remitente_id = v; delete errores.remitente; pintar("[data-testid=campo-motivo]"); } }), { error: errores.remitente }));
    var motivoTxt = null;
    var mo = ING.idx.motivos[B.motivo_id];
    if (mo && mo.defaults) {
      var d = mo.defaults, partes = [];
      if (d.especie_id) partes.push(ING.idx.especies[d.especie_id].nombre);
      if (d.tipo_muestra_id) partes.push(ING.idx.tiposMuestra[d.tipo_muestra_id].nombre);
      if (d.sospecha_id) partes.push("sospecha " + cx.plano(ING.idx.patogenos[d.sospecha_id].nombre_md));
      motivoTxt = "Se propone: " + partes.join(" · ") + ". Todo se puede cambiar.";
    }
    s.appendChild(cx.campo("Motivo", cx.select({ testid: "campo-motivo", vacio: "Elige el motivo…", opciones: cat.motivos, valor: B.motivo_id,
      onchange: function (v) { B.motivo_id = v; delete errores.motivo; aplicarDefaultsMotivo(v); pintar(); } }), { error: errores.motivo, ayuda: motivoTxt }));
    var fecha = h("input", { type: "date", class: "cx-input", "data-testid": "campo-fecha-toma", value: B.fecha_toma, max: cx.hoy() });
    fecha.addEventListener("change", function () { B.fecha_toma = fecha.value; delete errores.fecha; guardarBorrador(); });
    var nan = h("input", { type: "number", inputmode: "numeric", min: "1", class: "cx-input cx-input-corto", "data-testid": "campo-n-animales", value: B.n_animales });
    nan.addEventListener("input", function () { B.n_animales = nan.value; guardarBorrador(); });
    s.appendChild(h("div", { class: "cx-fila2" },
      cx.campo("Fecha de toma", fecha, { error: errores.fecha }),
      cx.campo("Nº de animales", nan)));
    var rr = h("input", { type: "text", class: "cx-input", maxlength: "30", "data-testid": "campo-ref-remitente", value: B.ref_remitente, autocomplete: "off", placeholder: "Opcional" });
    rr.addEventListener("input", function () { B.ref_remitente = rr.value; guardarBorrador(); });
    s.appendChild(cx.campo("Ref. del remitente", rr, { ayuda: "Código que trae el cliente (dato aportado por el remitente)" }));

    /* Más datos */
    var det = h("details", { class: "cx-mas-datos" });
    if (B.masAbierto) det.open = true;
    det.addEventListener("toggle", function () { B.masAbierto = det.open; guardarBorrador(); });
    det.appendChild(h("summary", null, h("span", { text: "Más datos" }),
      h("span", { class: "cx-ayuda", text: resumenMas() })));
    var sig = h("div", { class: "cx-chips", role: "group", "aria-label": "Signos clínicos y lesiones" });
    ING.cat.signos.forEach(function (sg) {
      var on = B.signos.indexOf(sg.id) >= 0;
      sig.appendChild(h("button", { type: "button", class: "cx-chip" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false", "data-testid": "signo-" + sg.id,
        onclick: function () { var k = B.signos.indexOf(sg.id); if (k >= 0) B.signos.splice(k, 1); else B.signos.push(sg.id); pintar(); } },
        on ? cx.icon("check") : null, h("span", { text: sg.nombre })));
    });
    det.appendChild(h("div", { class: "cx-campo" }, h("span", { class: "cx-etq", text: "Signos clínicos y lesiones" }), sig));
    det.appendChild(cx.campo("Sospecha de agente causal", cx.select({ testid: "campo-sospecha", vacio: "Ninguna",
      opciones: ING.cat.patogenos.map(function (p) { return { id: p.id, nombre: p.nombre_md }; }), valor: B.sospecha_id,
      onchange: function (v) { B.sospecha_id = v; guardarBorrador(); } })));
    var tr = h("input", { type: "text", class: "cx-input", "data-testid": "campo-tratamientos", value: B.tratamientos_previos, maxlength: "120" });
    tr.addEventListener("input", function () { B.tratamientos_previos = tr.value; guardarBorrador(); });
    det.appendChild(cx.campo("Tratamientos previos", tr));
    var ob = h("textarea", { class: "cx-input cx-textarea", rows: "2", "data-testid": "campo-observaciones", maxlength: "300" });
    ob.value = B.observaciones;
    ob.addEventListener("input", function () { B.observaciones = ob.value; guardarBorrador(); });
    det.appendChild(cx.campo("Observaciones", ob));
    s.appendChild(det);
    return s;
  }
  function resumenMas() {
    var p = [];
    if (B.signos.length) p.push(B.signos.length + (B.signos.length === 1 ? " signo" : " signos"));
    if (B.sospecha_id && ING.idx.patogenos[B.sospecha_id]) p.push("sospecha: " + cx.plano(ING.idx.patogenos[B.sospecha_id].nombre_md));
    return p.length ? p.join(" · ") : "signos, sospecha, tratamientos";
  }

  function paso2() {
    var s = h("div", { class: "cx-paso", "data-testid": "paso-2" });
    if (errores.muestras) s.appendChild(h("p", { class: "cx-error", role: "alert", text: errores.muestras }));
    B.muestras.forEach(function (m, i) { s.appendChild(tarjetaMuestra(m, i)); });
    s.appendChild(h("div", { class: "cx-fila-botones" },
      h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande", "data-testid": "btn-mas-uno",
        onclick: function () {
          var ult = B.muestras[B.muestras.length - 1];
          B.muestras.push(muestraVacia(ult));
          pintar("[data-testid=campo-ident-" + B.muestras.length + "]");
        } }, cx.icon("copy-plus"), h("span", { text: "+1 igual" })),
      h("button", { type: "button", class: "cx-btn cx-btn-grande", "data-testid": "btn-otra-muestra",
        onclick: function () {
          var mo = ING.idx.motivos[B.motivo_id], d = (mo && mo.defaults) || {};
          var m = muestraVacia();
          m.especie_id = d.especie_id || ""; m.tipo_muestra_id = d.tipo_muestra_id || "";
          B.muestras.push(m);
          pintar("[data-testid=campo-especie-" + B.muestras.length + "]");
        } }, cx.icon("plus"), h("span", { text: "Otra muestra" }))));
    s.appendChild(h("p", { class: "cx-ayuda cx-centro", text: B.muestras.length + (B.muestras.length === 1 ? " muestra" : " muestras") +
      " · «+1 igual» copia la última con la identificación vacía" }));
    return s;
  }
  function siguienteIdent(txt) {
    var m = /^(.*?)(\d+)(\D*)$/.exec(txt || "");
    if (!m) return "";
    var n = String(parseInt(m[2], 10) + 1);
    while (n.length < m[2].length) n = "0" + n;
    return m[1] + n + m[3];
  }
  function tarjetaMuestra(m, i) {
    var n = i + 1;
    var cat = ING.cat;
    var card = h("div", { class: "cx-tarjeta cx-muestra-form" + (m.rechazada ? " rechazada" : ""), "data-testid": "muestra-form", "data-indice": String(n) });
    card.appendChild(h("div", { class: "cx-muestra-cab" },
      h("h2", { class: "cx-h2", text: "Muestra " + n }),
      h("span", { class: "cx-codigo-prov", text: "-M" + (n < 10 ? "0" : "") + n }),
      B.muestras.length > 1 ? h("button", { type: "button", class: "cx-btn-icono", "aria-label": "Quitar la muestra " + n, "data-testid": "btn-quitar-" + n,
        onclick: function () { B.muestras.splice(i, 1); pintar(); } }, cx.icon("trash-2")) : null));
    card.appendChild(cx.campo("Especie", cx.select({ testid: "campo-especie-" + n, vacio: "Elige la especie…", opciones: cat.especies, valor: m.especie_id,
      onchange: function (v) { m.especie_id = v; m.auto = false; delete errores["especie-" + i]; pintar(); } }), { error: errores["especie-" + i] }));
    card.appendChild(cx.campo("Tipo de muestra", cx.select({ testid: "campo-tipo-" + n, vacio: "Elige el tipo…", opciones: cat.tipos_muestra, valor: m.tipo_muestra_id,
      onchange: function (v) { m.tipo_muestra_id = v; m.auto = false; delete errores["tipo-" + i]; pintar(); } }),
      { error: errores["tipo-" + i], ayuda: m.tipo_muestra_id && ING.idx.tiposMuestra[m.tipo_muestra_id] ? "Conservar: " + ING.idx.tiposMuestra[m.tipo_muestra_id].conservacion : null }));
    var prev = i > 0 ? B.muestras[i - 1].identificacion : "";
    var id = h("input", { type: "text", class: "cx-input", maxlength: "40", autocomplete: "off", "data-testid": "campo-ident-" + n, value: m.identificacion,
      placeholder: prev && siguienteIdent(prev) ? "p. ej. " + siguienteIdent(prev) : "Precinto, crotal o id. del animal", enterkeyhint: "next" });
    id.addEventListener("input", function () { m.identificacion = id.value; guardarBorrador(); });
    card.appendChild(cx.campo("Precinto / crotal / id. animal", id, { error: errores["ident-" + i] }));
    card.appendChild(h("div", { class: "cx-campo" }, h("span", { class: "cx-etq", text: "Conservación" }),
      cx.chipsRadio({ nombre: "Conservación de la muestra " + n, opciones: cat.conservaciones, valor: m.conservacion, testid: "conservacion-" + n,
        onchange: function (v) { m.conservacion = v; pintar(); } })));
    card.appendChild(h("div", { class: "cx-campo" }, h("span", { class: "cx-etq", text: "Tiempo desde la toma" }),
      cx.chipsRadio({ nombre: "Tiempo desde la toma de la muestra " + n, opciones: cat.tiempos_toma, valor: m.tiempo_toma, testid: "tiempo-" + n,
        onchange: function (v) { m.tiempo_toma = v; pintar(); } })));
    var env = h("input", { type: "checkbox", role: "switch", class: "cx-switch", "data-testid": "envase-" + n, checked: m.envase_integro });
    env.addEventListener("change", function () { m.envase_integro = env.checked; pintar(); });
    card.appendChild(h("label", { class: "cx-interruptor" }, env, h("span", { text: "Envase íntegro" })));
    if (fueraCondiciones(m)) {
      card.appendChild(h("div", { class: "cx-aviso cx-aviso-revisar", role: "note", "data-testid": "aviso-rec01" },
        cx.icon("triangle-alert"),
        h("div", null, h("p", { text: "Fuera de condiciones de recepción: se aceptará con desviación (REC-01)" }),
          cx.refs(regla("REC-01") ? regla("REC-01").refs : []))));
    }
    var rech = h("input", { type: "checkbox", class: "cx-check", "data-testid": "rechazar-" + n, checked: m.rechazada });
    rech.addEventListener("change", function () { m.rechazada = rech.checked; if (!m.rechazada) m.motivo_rechazo = ""; pintar(); });
    card.appendChild(h("label", { class: "cx-casilla" }, rech, h("span", { text: "Rechazar muestra" })));
    if (m.rechazada) {
      card.appendChild(cx.campo("Motivo del rechazo", cx.select({ testid: "motivo-rechazo-" + n, vacio: "Elige el motivo…",
        opciones: cat.motivos_rechazo.map(function (t) { return { id: t, nombre: t }; }), valor: m.motivo_rechazo,
        onchange: function (v) { m.motivo_rechazo = v; delete errores["rechazo-" + i]; pintar(); } }), { error: errores["rechazo-" + i] }));
    }
    return card;
  }

  function paso3(ref) {
    var s = h("div", { class: "cx-paso", "data-testid": "paso-3" });
    var tot = 0, mi = 0, mo = 0;
    B.muestras.forEach(function (m, i) {
      var n = i + 1;
      var card = h("div", { class: "cx-tarjeta cx-plan-muestra" });
      var esp = ING.idx.especies[m.especie_id], tip = ING.idx.tiposMuestra[m.tipo_muestra_id];
      card.appendChild(h("h2", { class: "cx-h2" }, h("span", { text: ref + "-M" + (n < 10 ? "0" : "") + n }),
        h("span", { class: "cx-sub cx-bloque", text: [esp ? esp.nombre : "", tip ? tip.nombre : "", m.identificacion || ""].filter(Boolean).join(" · ") })));
      if (m.rechazada) {
        card.appendChild(h("p", { class: "cx-aviso cx-aviso-novalido" }, cx.icon("ban"), h("span", { text: "Muestra rechazada (" + m.motivo_rechazo + "): no se analiza." })));
        s.appendChild(card);
        return;
      }
      var plan = planDe(m);
      var lista = h("ul", { class: "cx-plan-lista" });
      plan.forEach(function (p) {
        var c = ING.idx.analisis[p.analisis_id], pl = ING.idx.plan[p.plan_id];
        var marcado = m.quitar.indexOf(p.analisis_id) < 0;
        if (marcado) { tot++; if (c.departamento === "micro") mi++; else mo++; }
        lista.appendChild(filaPlan(m, c, marcado, pl, false));
      });
      m.extra.forEach(function (aid) {
        if (plan.some(function (p) { return p.analisis_id === aid; })) return;
        var c = ING.idx.analisis[aid];
        tot++; if (c.departamento === "micro") mi++; else mo++;
        lista.appendChild(filaPlan(m, c, true, null, true));
      });
      if (!lista.childNodes.length) lista.appendChild(h("li", { class: "cx-ayuda", text: "El catálogo no propone análisis para esta muestra. Añade alguno a mano." }));
      card.appendChild(lista);
      var usados = plan.map(function (p) { return p.analisis_id; }).concat(m.extra);
      var resto = ING.cat.analisis.filter(function (a) { return a.sobre === "muestra" && usados.indexOf(a.id) < 0; });
      if (resto.length) {
        card.appendChild(cx.campo("+ Añadir análisis", cx.select({ testid: "anadir-analisis-" + n, vacio: "Elige un análisis del catálogo…",
          opciones: resto.map(function (a) { return { id: a.id, nombre: a.nombre + (a.departamento === "micro" ? " · Micro" : " · Molecular") }; }),
          onchange: function (v) { if (v) { m.extra.push(v); pintar(); } } }), { class: "cx-anadir" }));
      }
      s.appendChild(card);
    });
    var nm = B.muestras.filter(function (m) { return !m.rechazada; }).length;
    s.appendChild(h("p", { class: "cx-resumen-plan", "data-testid": "resumen-plan", text:
      nm + (nm === 1 ? " muestra · " : " muestras · ") + tot + (tot === 1 ? " análisis" : " análisis") + " (" + mi + " micro · " + mo + " molecular)" }));
    if (errores.registro) s.appendChild(h("p", { class: "cx-error", role: "alert", text: errores.registro }));
    return s;
  }
  function filaPlan(m, c, marcado, pl, manual) {
    var chk = h("input", { type: "checkbox", class: "cx-check", checked: marcado, "aria-label": cx.plano(c.nombre) });
    chk.addEventListener("change", function () {
      if (manual) { m.extra = m.extra.filter(function (x) { return x !== c.id; }); }
      else {
        var k = m.quitar.indexOf(c.id);
        if (chk.checked && k >= 0) m.quitar.splice(k, 1);
        if (!chk.checked && k < 0) m.quitar.push(c.id);
      }
      pintar();
    });
    var dep = c.departamento === "micro"
      ? h("span", { class: "cx-dep cx-dep-micro" }, cx.icon("microscope"), h("span", { text: "Micro" }))
      : h("span", { class: "cx-dep cx-dep-mol" }, cx.icon("dna"), h("span", { text: "Molecular" }));
    return h("li", { class: "cx-plan-fila" + (marcado ? "" : " off"), "data-testid": "plan-analisis", "data-analisis": c.id, "data-marcado": marcado ? "1" : "0" },
      h("label", { class: "cx-plan-check" }, chk, h("span", { class: "cx-plan-nombre" }, cx.md(c.nombre))),
      h("div", { class: "cx-plan-meta" }, dep),
      pl ? h("p", { class: "cx-porque" }, h("strong", { text: "Por qué: " }), cx.md(pl.porque)) :
        h("p", { class: "cx-porque" }, h("strong", { text: "Por qué: " }), h("span", { text: "añadido a mano" })),
      pl ? cx.refs(pl.refs) : cx.refs(c.refs));
  }

  function barraAcciones() {
    var bar = h("div", { class: "cx-barra-acciones" });
    if (B.paso > 1) bar.appendChild(h("button", { type: "button", class: "cx-btn cx-btn-grande", "data-testid": "btn-atras",
      onclick: function () { errores = {}; B.paso--; pintar(); scrollArriba(); } }, cx.icon("arrow-left"), h("span", { text: "Atrás" })));
    else bar.appendChild(h("a", { href: "#/expedientes", class: "cx-btn cx-btn-grande", "data-testid": "btn-cancelar-entrada", text: "Cancelar" }));
    if (B.paso < 3) {
      bar.appendChild(h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande", "data-testid": "btn-siguiente",
        onclick: function () {
          if (!validarPaso(B.paso)) {
            pintar();
            var e = raiz.querySelector(".cx-error");
            if (e && e.scrollIntoView) e.scrollIntoView({ block: "center" });
            return;
          }
          B.paso++; pintar(); scrollArriba();
        } }, h("span", { text: "Siguiente" }), cx.icon("chevron-right")));
    } else {
      bar.appendChild(h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande", "data-testid": "btn-registrar-entrada",
        onclick: registrar }, cx.icon("check"), h("span", { text: "Registrar entrada" })));
    }
    return bar;
  }
  function scrollArriba() { try { root.scrollTo({ top: 0 }); } catch (e) { /* nada */ } }

  var registrando = false;
  function registrar() {
    if (registrando) return;
    if (!validarPaso(1)) { B.paso = 1; pintar(); return; }
    if (!validarPaso(2)) { B.paso = 2; pintar(); return; }
    var db = cx.db();
    var ref = ING.motor.siguienteRef(db);
    var ahora = cx.ahora(), rol = cx.rol();
    var docs = [], eventos = [];
    var exp = {
      id: ref, ref_remitente: B.ref_remitente.trim() || null, procedencia_id: B.procedencia_id, remitente_id: B.remitente_id, motivo_id: B.motivo_id,
      signos: B.signos.slice(), sospecha_id: B.sospecha_id || null, sospecha_texto: "", tratamientos_previos: B.tratamientos_previos.trim(),
      n_animales: B.n_animales ? parseInt(B.n_animales, 10) : B.muestras.length, fecha_toma: B.fecha_toma, recibido_en: ahora,
      observaciones: B.observaciones.trim(), creado_por: rol, origen_dato: "usuario", guion: null
    };
    docs.push({ col: "expedientes", doc: exp });
    var nAn = 0;
    var muestrasEv = [];
    B.muestras.forEach(function (m, i) {
      var mid = ref + "-M" + (i < 9 ? "0" : "") + (i + 1);
      docs.push({ col: "muestras", doc: {
        id: mid, expediente_id: ref, especie_id: m.especie_id, tipo_muestra_id: m.tipo_muestra_id, identificacion: (m.identificacion || "").trim(),
        conservacion: m.conservacion, tiempo_toma: m.tiempo_toma, envase_integro: !!m.envase_integro, rechazada: !!m.rechazada,
        motivo_rechazo: m.rechazada ? m.motivo_rechazo : null, creado_en: ahora } });
      muestrasEv.push({ tipo: "MUESTRA_REGISTRADA", coleccion: "muestras", entidad_id: mid, expediente_id: ref, resumen: "Muestra " + mid, cambios: [], motivo: null });
      if (m.rechazada) {
        muestrasEv.push({ tipo: "MUESTRA_RECHAZADA", coleccion: "muestras", entidad_id: mid, expediente_id: ref, resumen: "Muestra " + mid + " rechazada", cambios: [], motivo: m.motivo_rechazo });
        return;
      }
      analisisDe(m).forEach(function (x) {
        var c = ING.idx.analisis[x.analisis_id];
        nAn++;
        docs.push({ col: "analisis", doc: {
          id: mid + "-" + c.id, expediente_id: ref, muestra_id: mid, aislado_id: null, catalogo_id: c.id, departamento: c.departamento,
          origen: x.origen, plan_id: x.plan_id, regla_id: null, solicitado_en: ahora, solicitado_por: rol,
          resultado: null, resultado_en: null, resultado_por: null, anulado: false, motivo_anulacion: null } });
      });
    });
    eventos.push({ tipo: "EXPEDIENTE_CREADO", coleccion: "expedientes", entidad_id: ref, expediente_id: ref,
      resumen: "Entrada " + ref + " · " + B.muestras.length + " muestras · " + nAn + " análisis", cambios: [], motivo: null });
    eventos = eventos.concat(muestrasEv);
    registrando = true;
    var fin = function (res) {
      var r = (res && res.ref) || ref;
      registrando = false;
      B = null; errores = {};
      borrarBorrador();
      cx.toast("Entrada " + r + " registrada", { texto: "Ver", hash: "#/exp/" + r });
      cx.irA("#/exp/" + r);
    };
    var p;
    try { p = cx.guardarConEventos(docs, eventos); } catch (e) { registrando = false; errores.registro = "No se ha podido registrar. Inténtalo de nuevo."; pintar(); return; }
    Promise.resolve(p).then(fin, function () { registrando = false; errores.registro = "No se ha podido registrar. Inténtalo de nuevo."; pintar(); });
  }

  /* guardarVarios con varios eventos: el store de A recibe la lista de documentos y los eventos (DUDAS_C §2).
     Si el store solo admite un evento, el resto se escribe con guardar() del documento afectado. */
  cx.guardarConEventos = function (docs, eventos) {
    /* store.guardarVarios admite un evento: el primero va con los documentos; el resto, como eventos sueltos
       (guardarVarios([], ev)), con la referencia definitiva si el store la ha renumerado. */
    var st = ING.store;
    var ref0 = docs[0] && docs[0].doc.id;
    return Promise.resolve(st.guardarVarios(docs, eventos[0])).then(function (res) {
      res = res || { ok: true };
      var ref = res.ref || ref0;
      return eventos.slice(1).reduce(function (acc, ev) {
        return acc.then(function () {
          var e = ref !== ref0 ? JSON.parse(JSON.stringify(ev).split(ref0).join(ref)) : ev;
          return st.guardarVarios([], e);
        });
      }, Promise.resolve()).then(function () { return res; });
    });
  };

  ING.rutas.nueva = vistaNueva;
})(typeof window !== "undefined" ? window : globalThis);

/* ui-expedientes.js · Paquete C · #/expedientes (ESPEC §3.3), #/exp/<ref>[/<pestaña>] (§3.4) y ING.ui.abrirCorregir.
   Usa ING.cx (definido en ui-entrada.js). Nada se ejecuta de otros módulos durante la carga. */
(function (root) {
  "use strict";
  var ING = root.ING = root.ING || {};
  ING.ui = ING.ui || {};
  ING.rutas = ING.rutas || {};
  var cx = ING.cx;
  var h = cx.h;

  /* ================================================================ #/expedientes */
  var L = { q: "", estado: "TODOS", tipo: "", pagina: 1, hashVisto: null };
  var POR_PAGINA = 20;

  /* ?estado= admite mayúsculas o minúsculas (el panel usa "en_curso") y algunos alias */
  function normEstado(v) {
    var e = String(v || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    var alias = { TODO: "TODOS", ALL: "TODOS", ENCURSO: "EN_CURSO", POR_VALIDAR: "POR_VALIDAR", LISTO: "LISTO_PARA_VALIDAR", PENDIENTE: "PENDIENTE_VALORACION" };
    e = alias[e] || e;
    if (e === "TODOS" || e === "EN_CURSO" || e === "POR_VALIDAR" || cx.ESTADOS[e]) return e;
    return "TODOS";
  }
  cx.normEstado = normEstado;

  function filasExpedientes(db) {
    var ids = Object.keys(db.expedientes || {});
    return ids.map(function (ref) {
      var e = db.expedientes[ref];
      var p = ING.idx.procedencias[e.procedencia_id] || {};
      return { ref: ref, exp: e, estado: cx.estado(db, ref), proc: p };
    }).sort(function (a, b) {
      var x = a.exp.recibido_en || "", y = b.exp.recibido_en || "";
      return x < y ? 1 : x > y ? -1 : (a.ref < b.ref ? 1 : -1);
    });
  }
  function coincide(f, q) {
    if (!q) return true;
    q = q.toLowerCase().trim();
    var e = f.exp;
    return [e.id, e.ref_remitente || "", f.proc.nombre || "", f.proc.codigo || ""].some(function (t) { return String(t).toLowerCase().indexOf(q) >= 0; });
  }

  function vistaLista() {
    var r = cx.ruta();
    var hashAhora = location.hash;
    if (L.hashVisto !== hashAhora) {
      /* filtros que llegan desde el panel: ?estado=…&tipo=…&q=… */
      if (r.q.estado) { L.estado = normEstado(r.q.estado); L.pagina = 1; }
      if (r.q.tipo != null) { L.tipo = r.q.tipo; L.pagina = 1; }
      if (r.q.q != null) { L.q = r.q.q; L.pagina = 1; }
      L.hashVisto = hashAhora;
    }
    var db = cx.db();
    var filas = filasExpedientes(db);
    var sec = h("section", { class: "cx-lista-exp", "aria-labelledby": "cx-lista-titulo" });
    sec.appendChild(h("h1", { id: "cx-lista-titulo", class: "cx-h1", text: "Expedientes" }));
    var busca = h("input", { type: "search", class: "cx-input cx-buscador", "data-testid": "buscador", value: L.q,
      placeholder: "Buscar referencia o finca", "aria-label": "Buscar expedientes", autocomplete: "off", enterkeyhint: "search" });
    var zonaChips = h("div");
    var zonaLista = h("div", { class: "cx-lista-zona", "aria-live": "polite" });
    busca.addEventListener("input", function () { L.q = busca.value; L.pagina = 1; pintarChips(); pintarLista(); });
    sec.appendChild(h("div", { class: "cx-busca-envoltorio" }, cx.icon("search"), busca));
    sec.appendChild(zonaChips);
    sec.appendChild(zonaLista);

    function base() { return filas.filter(function (f) { return coincide(f, L.q) && (!L.tipo || f.proc.tipo === L.tipo); }); }
    function pasaEstado(f) {
      if (L.estado === "TODOS") return true;
      if (L.estado === "EN_CURSO") return f.estado !== "EMITIDO" && f.estado !== "BLOQUEADO";
      if (L.estado === "POR_VALIDAR") return f.estado === "LISTO_PARA_VALIDAR" || f.estado === "PENDIENTE_VALORACION";
      return f.estado === L.estado;
    }
    function pintarChips() {
      zonaChips.textContent = "";
      var b = base();
      var cuenta = {};
      b.forEach(function (f) { cuenta[f.estado] = (cuenta[f.estado] || 0) + 1; });
      var g = h("div", { class: "cx-chips cx-chips-scroll", role: "group", "aria-label": "Filtrar por estado" });
      function chip(id, texto, icono, n) {
        var on = L.estado === id;
        g.appendChild(h("button", { type: "button", class: "cx-chip cx-chip-filtro" + (on ? " on" : "") + (id !== "TODOS" ? " cx-est-" + id : ""),
          "aria-pressed": on ? "true" : "false", "data-testid": "filtro-estado-" + id,
          onclick: function () { L.estado = on && id !== "TODOS" ? "TODOS" : id; L.pagina = 1; pintarChips(); pintarLista(); } },
          icono ? cx.icon(icono) : null, h("span", { text: texto }), h("span", { class: "cx-cuenta", text: String(n) })));
      }
      chip("TODOS", "Todos", "folder-open", b.length);
      if (L.estado === "EN_CURSO") chip("EN_CURSO", "En curso", "history", b.filter(pasaEstado).length);
      if (L.estado === "POR_VALIDAR") chip("POR_VALIDAR", "Por validar", "file-check", b.filter(pasaEstado).length);
      cx.ORDEN_ESTADOS.forEach(function (e) { chip(e, cx.ESTADOS[e][0], cx.ESTADOS[e][1], cuenta[e] || 0); });
      zonaChips.appendChild(g);
      var gt = h("div", { class: "cx-chips cx-chips-scroll", role: "group", "aria-label": "Filtrar por tipo de procedencia" });
      [{ id: "", nombre: "Toda procedencia" }].concat(ING.cat.procedencia_tipos).forEach(function (t) {
        var on = L.tipo === t.id;
        gt.appendChild(h("button", { type: "button", class: "cx-chip cx-chip-filtro cx-chip-sec" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
          "data-testid": "filtro-tipo-" + (t.id || "todos"),
          onclick: function () { L.tipo = t.id; L.pagina = 1; pintarChips(); pintarLista(); } }, on ? cx.icon("check") : null, h("span", { text: t.nombre })));
      });
      zonaChips.appendChild(gt);
    }
    function pintarLista() {
      zonaLista.textContent = "";
      var lista = base().filter(pasaEstado);
      var visibles = lista.slice(0, L.pagina * POR_PAGINA);
      zonaLista.appendChild(h("p", { class: "cx-ayuda", "data-testid": "total-expedientes", text: lista.length + (lista.length === 1 ? " expediente" : " expedientes") +
        (lista.length > visibles.length ? " · se ven " + visibles.length : "") }));
      if (!lista.length) {
        zonaLista.appendChild(h("div", { class: "cx-vacio" }, h("p", { text: "No hay expedientes con estos filtros." }),
          h("button", { type: "button", class: "cx-btn", "data-testid": "btn-limpiar-filtros", text: "Quitar filtros",
            onclick: function () { L.q = ""; L.estado = "TODOS"; L.tipo = ""; busca.value = ""; pintarChips(); pintarLista(); } })));
        return;
      }
      var ul = h("ul", { class: "cx-rejilla" });
      visibles.forEach(function (f) { ul.appendChild(h("li", null, tarjetaExp(db, f))); });
      zonaLista.appendChild(ul);
      if (lista.length > visibles.length) {
        zonaLista.appendChild(h("button", { type: "button", class: "cx-btn cx-btn-grande cx-ver-mas", "data-testid": "btn-ver-mas",
          text: "Ver más (" + (lista.length - visibles.length) + ")", onclick: function () { L.pagina++; pintarLista(); } }));
      }
    }
    pintarChips();
    pintarLista();
    return sec;
  }

  function tarjetaExp(db, f) {
    var e = f.exp, ref = f.ref;
    var mus = cx.deExp(db, "muestras", ref);
    var especies = [];
    mus.forEach(function (m) { var n = (ING.idx.especies[m.especie_id] || {}).nombre; if (n && especies.indexOf(n) < 0) especies.push(n); });
    var pr = cx.progreso(db, ref);
    var pend = cx.pendientes(db, ref);
    var nPend = pend.alertas + pend.comunicaciones;
    var tot = pr.micro.n + pr.molecular.n, hechos = pr.micro.x + pr.molecular.x;
    var pct = tot ? Math.round(100 * hechos / tot) : 0;
    return h("a", { href: "#/exp/" + ref, class: "cx-tarjeta cx-tarjeta-exp", "data-testid": "tarjeta-exp", "data-ref": ref },
      h("div", { class: "cx-tx-cab" }, h("span", { class: "cx-ref", text: ref }), cx.chipEstado(f.estado)),
      h("p", { class: "cx-tx-linea", text: (f.proc.nombre || "") + " · " + especies.join(", ") + " · " + mus.length + (mus.length === 1 ? " muestra" : " muestras") }),
      h("p", { class: "cx-tx-sub", text: "recibido " + cx.fechaHoraCorta(e.recibido_en) + (e.ref_remitente ? " · ref. remitente " + e.ref_remitente : "") }),
      h("div", { class: "cx-tx-prog" },
        h("span", { class: "cx-prog-txt", "data-testid": "progreso-tarjeta", text: "Micro " + cx.txtProg(pr.micro) + " · Molecular " + cx.txtProg(pr.molecular) }),
        nPend ? h("span", { class: "cx-tx-alertas", "aria-label": cx.textoPendientes(pend), title: cx.textoPendientes(pend) }, cx.icon("triangle-alert"), h("span", { text: String(nPend) })) : null),
      h("div", { class: "cx-barra-fina", "aria-hidden": "true" }, h("span", { style: "width:" + pct + "%" })));
  }

  /* ================================================================ #/exp/<ref>[/<pestaña>] */
  var TAB_ESTADO = { RECIBIDO: "muestras", EN_ANALISIS: "muestras", PENDIENTE_VALORACION: "alertas", LISTO_PARA_VALIDAR: "informe", EMITIDO: "informe", BLOQUEADO: "muestras" };
  /* "Menos de 24 h" sin partir: espacio irrompible entre cifra y unidad */
  function nb(t) { return String(t == null ? "" : t).replace(/(\d) (h|°C|días?)\b/g, "$1\u00a0$2"); }
  cx.nb = nb;
  var PESTANAS = [["resumen", "Resumen"], ["muestras", "Muestras"], ["alertas", "Alertas"], ["informe", "Informe"], ["registro", "Registro"]];

  function vistaFicha() {
    var r = cx.ruta();
    var ref = r.segs[1], tab = r.segs[2] || "resumen";
    if (!PESTANAS.some(function (p) { return p[0] === tab; })) tab = "resumen";
    var db = cx.db();
    var e = db.expedientes[ref];
    if (!e) {
      return h("section", { class: "cx-ficha" }, h("h1", { class: "cx-h1", text: "Expediente no encontrado" }),
        h("p", { text: "No existe el expediente " + (ref || "") + " en esta demo." }),
        h("a", { href: "#/expedientes", class: "cx-btn", text: "Ver expedientes" }));
    }
    var estado = cx.estado(db, ref);
    var pr = cx.progreso(db, ref);
    var proc = ING.idx.procedencias[e.procedencia_id] || {};
    var tipo = ING.idx.procedenciaTipos ? (ING.idx.procedenciaTipos[proc.tipo] || {}).nombre : proc.tipo;
    var rem = ING.idx.remitentes[e.remitente_id] || {};
    var mot = ING.idx.motivos[e.motivo_id] || {};
    var sec = h("section", { class: "cx-ficha", "data-ref": ref });
    sec.appendChild(h("div", { class: "cx-ficha-cab" },
      h("a", { href: "#/expedientes", class: "cx-btn-icono", "aria-label": "Volver a expedientes", "data-testid": "btn-volver" }, cx.icon("arrow-left")),
      h("h1", { class: "cx-h1 cx-ficha-ref", text: ref }),
      h("a", { href: "#/exp/" + ref + "/" + TAB_ESTADO[estado], class: "cx-chip-enlace", "data-testid": "chip-estado-enlace",
        "aria-label": "Estado: " + (cx.ESTADOS[estado] || [estado])[0] + ". Ver " + TAB_ESTADO[estado] }, cx.chipEstado(estado, "ficha-estado"))));
    sec.appendChild(h("p", { class: "cx-ficha-datos" },
      h("span", { text: (proc.nombre || "") + " (" + (tipo || "") + " · " + (proc.codigo || "") + ")" }), " · ",
      h("span", { text: rem.nombre || "" }), " · ",
      h("span", { text: mot.nombre || "" }), " · ",
      h("span", { text: "toma " + cx.fecha(e.fecha_toma) })));
    sec.appendChild(h("div", { class: "cx-ficha-prog" },
      h("span", { class: "cx-prog-dep" }, cx.icon("microscope"), h("span", { text: "Micro " }), h("strong", { "data-testid": "progreso-micro", text: cx.txtProg(pr.micro) })),
      h("span", { class: "cx-prog-dep" }, cx.icon("dna"), h("span", { text: "Molecular " }), h("strong", { "data-testid": "progreso-molecular", text: cx.txtProg(pr.molecular) }))));
    var cad = bandaCaducada(db, ref, estado);
    if (cad) sec.appendChild(cad);
    var tabs = h("div", { class: "cx-tabs", role: "tablist", "aria-label": "Secciones del expediente" });
    var pend = cx.pendientes(db, ref);
    PESTANAS.forEach(function (p) {
      var on = p[0] === tab;
      var extra = p[0] === "alertas" && (pend.alertas + pend.comunicaciones) ? h("span", { class: "cx-cuenta cx-cuenta-alerta", text: String(pend.alertas + pend.comunicaciones) }) : null;
      tabs.appendChild(h("a", { href: "#/exp/" + ref + (p[0] === "resumen" ? "" : "/" + p[0]), role: "tab", "aria-selected": on ? "true" : "false",
        class: "cx-tab" + (on ? " on" : ""), "data-testid": "tab-" + p[0] }, h("span", { text: p[1] }), extra));
    });
    var tabsCaja = h("div", { class: "cx-tabs-caja" }, tabs);
    function pista() { tabsCaja.classList.toggle("hay-mas", tabs.scrollWidth - tabs.clientWidth - tabs.scrollLeft > 4); }
    tabs.addEventListener("scroll", pista, { passive: true });
    sec.appendChild(tabsCaja);
    var panel = h("div", { class: "cx-tab-panel", role: "tabpanel", "data-tab": tab });
    try {
      if (tab === "resumen") pResumen(panel, db, ref, estado, pr);
      else if (tab === "muestras") pMuestras(panel, db, ref, estado);
      else if (tab === "alertas") pAlertas(panel, db, ref);
      else if (tab === "informe") pInforme(panel, db, ref, estado);
      else pRegistro(panel, db, ref);
    } catch (err) {
      panel.appendChild(h("p", { class: "cx-error", text: "No se ha podido mostrar esta sección." }));
      if (root.console && console.error) console.error(err);
    }
    sec.appendChild(panel);
    /* la pestaña activa visible (desplazamiento horizontal propio) */
    root.requestAnimationFrame && root.requestAnimationFrame(function () {
      var t = tabs.querySelector(".on");
      if (t && tabs.scrollWidth > tabs.clientWidth) { try { tabs.scrollLeft = Math.max(0, t.offsetLeft - 48); } catch (x) { /* nada */ } }
      pista();
    });
    return sec;
  }

  function bandaCaducada(db, ref, estado) {
    var infs = cx.informes(db, ref);
    if (!infs.length || estado === "EMITIDO" || estado === "BLOQUEADO") return null;
    var ult = infs[infs.length - 1];
    var actual = "";
    try { actual = ING.motor.huella(db, ref); } catch (e) { actual = ""; }
    return h("div", { class: "cx-aviso cx-aviso-revisar cx-banda-caducada", role: "status", "data-testid": "banda-caducada" },
      cx.icon("triangle-alert"),
      h("div", null,
        h("p", null, h("strong", { text: "Se ha cambiado un dato después de emitir." }),
          h("span", { text: " La v" + ult.version + " ya no vale: emite una v" + (ult.version + 1) + ", que la sustituye y deja constancia del motivo." })),
        h("p", { class: "cx-sello-detalle", text: "sello " + String(ult.huella).slice(0, 8) + " → " + String(actual).slice(0, 8) })));
  }

  /* ---------------------------------------------------------------- Resumen */
  function pResumen(panel, db, ref, estado, pr) {
    var e = db.expedientes[ref];
    var mus = cx.deExp(db, "muestras", ref);
    var desv = 0, rech = 0;
    mus.forEach(function (m) { if (m.rechazada) rech++; else if (estadoMuestra(db, m) === "ACEPTADA_CON_DESVIACION") desv++; });
    var pend = cx.pendientes(db, ref);
    var infs = cx.informes(db, ref);
    var ult = infs[infs.length - 1];
    function nodo(icono, titulo, lineas, cls, extra) {
      return h("li", { class: "cx-tl-nodo " + (cls || "") },
        h("span", { class: "cx-tl-punto", "aria-hidden": "true" }, cx.icon(icono)),
        h("div", { class: "cx-tl-cuerpo" }, h("h3", { class: "cx-tl-titulo", text: titulo }),
          lineas.filter(Boolean).map(function (l) { return typeof l === "string" ? h("p", { text: l }) : l; }), extra || null));
    }
    function hecho(p) { return p.n && p.x === p.n ? "hecho" : p.n ? "en-curso" : "pend"; }
    var tl = h("ol", { class: "cx-timeline" });
    tl.appendChild(nodo("test-tube", "Recepción", [cx.fechaHora(e.recibido_en),
      mus.length + (mus.length === 1 ? " muestra" : " muestras") + (desv ? " · " + desv + " con desviación" : "") + (rech ? " · " + rech + (rech === 1 ? " rechazada" : " rechazadas") : "")], "hecho"));
    tl.appendChild(nodo("microscope", "Microbiología", [h("p", null, h("span", { text: "Progreso " }), h("strong", { text: cx.txtProg(pr.micro) }))], hecho(pr.micro)));
    tl.appendChild(nodo("dna", "Biología molecular", [h("p", null, h("span", { text: "Progreso " }), h("strong", { text: cx.txtProg(pr.molecular) }))], hecho(pr.molecular)));
    var nVal = pend.alertas, nCom = pend.comunicaciones;
    var txtVal = cx.textoPendientes(pend) || "Sin alertas pendientes";
    tl.appendChild(nodo("triangle-alert", "Valoración", [txtVal], nVal || nCom ? "en-curso" : (estado === "RECIBIDO" || estado === "EN_ANALISIS" ? "pend" : "hecho")));
    var txtInf;
    if (estado === "EMITIDO" && ult) txtInf = "v" + ult.version + " emitido " + cx.fechaHoraCorta(ult.emitido_en) + " · sellado";
    else if (estado === "LISTO_PARA_VALIDAR") txtInf = "Listo para validar" + (ult ? " (v" + (ult.version + 1) + ")" : "");
    else if (estado === "BLOQUEADO") txtInf = "Bloqueado: todas las muestras están rechazadas";
    else txtInf = "Pendiente";
    tl.appendChild(nodo("file-check", "Informe", [txtInf], estado === "EMITIDO" ? "hecho" : estado === "LISTO_PARA_VALIDAR" ? "en-curso" : "pend"));
    tl.appendChild(h("li", { class: "cx-tl-nodo cx-tl-futuro", "data-testid": "fase-siguiente" },
      h("span", { class: "cx-tl-punto", "aria-hidden": "true" }, cx.icon("lock")),
      h("div", { class: "cx-tl-cuerpo" }, h("p", { text: "Plan sanitario y de vigilancia epidemiológica de la finca · fase siguiente (no incluida)" }))));
    panel.appendChild(tl);
    if (estado === "LISTO_PARA_VALIDAR") {
      panel.appendChild(h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande cx-ancho", "data-testid": "btn-ir-validar",
        onclick: function () { if (ING.cx.abrirEmision) ING.cx.abrirEmision(ref); else cx.irA("#/informes"); } }, cx.icon("file-check"), h("span", { text: "Ir a validar" })));
    } else if (estado === "PENDIENTE_VALORACION") {
      panel.appendChild(h("a", { href: "#/exp/" + ref + "/alertas", class: "cx-btn cx-primario cx-btn-grande cx-ancho", "data-testid": "btn-ver-alertas" },
        cx.icon("triangle-alert"), h("span", { text: "Ver alertas" })));
    }
    /* Datos aportados por el remitente */
    var sig = (e.signos || []).map(function (s) { return (ING.idx.signos[s] || {}).nombre || s; }).join(", ");
    var sos = e.sospecha_id && ING.idx.patogenos[e.sospecha_id] ? ING.idx.patogenos[e.sospecha_id].nombre_md : null;
    var dl = h("dl", { class: "cx-dl" });
    function fila(dt, dd) { dl.appendChild(h("dt", { text: dt })); dl.appendChild(h("dd", null, dd)); }
    fila("Ref. del remitente", h("span", { text: e.ref_remitente || "—" }));
    fila("Signos clínicos y lesiones", h("span", { text: sig || "—" }));
    fila("Sospecha de agente causal", sos ? cx.md(sos) : h("span", { text: "Ninguna" }));
    fila("Tratamientos previos", h("span", { text: e.tratamientos_previos || "—" }));
    if (e.n_animales) fila("Nº de animales", h("span", { text: String(e.n_animales) }));
    if (e.observaciones) fila("Observaciones", h("span", { text: e.observaciones }));
    panel.appendChild(h("div", { class: "cx-tarjeta cx-datos-remitente" },
      h("h2", { class: "cx-h2" }, h("span", { text: "Datos aportados por el remitente" })),
      h("p", { class: "cx-ayuda", text: "Los aporta el cliente; el laboratorio no los verifica." }),
      dl));
  }

  function estadoMuestra(db, m) {
    try { if (ING.motor.estadoMuestra) return ING.motor.estadoMuestra(db, m); } catch (e) { /* sigue */ }
    if (m.rechazada) return "RECHAZADA";
    var r = ING.idx.reglas["REC-01"], c = r && r.condicion;
    if (c && (c.conservaciones.indexOf(m.conservacion) >= 0 || c.tiempos.indexOf(m.tiempo_toma) >= 0 || (c.envase_no_integro && !m.envase_integro))) return "ACEPTADA_CON_DESVIACION";
    return "ACEPTADA";
  }
  cx.estadoMuestra = estadoMuestra;
  /* el mismo texto en Resumen, pestaña Alertas e Informes; la insignia suma ambos (alertas + comunicaciones) */
  cx.textoPendientes = function (p) {
    return [p.alertas ? p.alertas + (p.alertas === 1 ? " alerta por valorar" : " alertas por valorar") : null,
      p.comunicaciones ? p.comunicaciones + (p.comunicaciones === 1 ? " comunicación pendiente" : " comunicaciones pendientes") : null].filter(Boolean).join(" · ");
  };
  var TXT_MUESTRA = { ACEPTADA: "Aceptada", ACEPTADA_CON_DESVIACION: "Aceptada con desviación", RECHAZADA: "Rechazada" };
  cx.TXT_MUESTRA = TXT_MUESTRA;
  var TXT_ANALISIS = { PENDIENTE: "Pendiente", RESULTADO: "Con resultado", REPETIR: "Repetir", ANULADO: "Anulado" };

  /* ---------------------------------------------------------------- Muestras */
  cx.qr = function (texto, px) {
    try { if (ING.ui.qr) { var n = ING.ui.qr(texto, px); if (n) return n; } } catch (e) { /* sigue */ }
    try {
      var q = root.qrcode(0, "M"); q.addData(texto); q.make();
      var t = document.createElement("template");
      t.innerHTML = q.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
      var s = t.content.firstChild;
      s.setAttribute("width", px); s.setAttribute("height", px);
      return s;
    } catch (e) { return h("span", { text: texto }); }
  };
  function abrirQR(codigo) {
    var cuerpo = h("div", { class: "cx-qr-grande" }, cx.qr(codigo, 240), h("p", { class: "cx-mono", text: codigo }),
      h("p", { class: "cx-ayuda", text: "La etiqueta solo contiene el código de la muestra." }));
    cx.modal({ titulo: "Etiqueta de " + codigo, cuerpo: cuerpo, testid: "hoja-qr" });
  }

  function etiquetaPCR(diana, r) {
    if (!r) return "Pendiente";
    var et = ING.cat.parametros.etiquetas_resultado_pcr;
    if (r === "positivo" && diana && diana.etiqueta_positivo) return diana.etiqueta_positivo;
    return et[r] || r;
  }
  cx.etiquetaPCR = etiquetaPCR;
  /* ¿se muestra la nota negativa? (nota_negativo_solo_grupo: solo si la especie es de ese grupo) */
  function notaNegAplica(diana, especieId) {
    if (!diana.nota_negativo_md) return false;
    if (!diana.nota_negativo_solo_grupo) return true;
    var g = (ING.idx.especies[especieId] || {}).grupos || [];
    return g.indexOf(diana.nota_negativo_solo_grupo) >= 0;
  }
  cx.notaNegAplica = notaNegAplica;
  function bloquePCR(db, a, m) {
    if (ING.ui.chipResultadoPCR) {
      try { var n = ING.ui.chipResultadoPCR(a.id); if (n) return n; } catch (e) { /* sigue */ }
    }
    var c = ING.idx.analisis[a.catalogo_id], d = ING.idx.dianas[c.diana_id];
    var t = ING.motor.tandaVigente(db, a.id), r = ING.motor.resultadoPCR(db, a);
    if (!t) return h("span", { class: "cx-res-pend", text: "Pendiente de tanda" });
    var p = t.pocillos.filter(function (x) { return x.analisis_id === a.id; })[0] || {};
    var cls = r === "positivo" ? "pos" : r === "dudoso" ? "dud" : r === "negativo" ? "neg" : "nv";
    var nota = null;
    if (r === "positivo" || r === "dudoso") nota = d.nota_positivo_md ? h("p", { class: "cx-nota" }, cx.md(d.nota_positivo_md), cx.refs(d.refs_positivo)) : null;
    else if (r === "negativo" && notaNegAplica(d, m.especie_id)) nota = h("p", { class: "cx-nota" }, cx.md(d.nota_negativo_md), cx.refs(d.refs_negativo));
    return h("div", { class: "cx-res-pcr" },
      h("span", { class: "cx-res-etq cx-res-" + cls, text: etiquetaPCR(d, r) }),
      h("span", { class: "cx-mono", text: " Ct " + cx.ct(p.ct) }),
      h("span", { class: "cx-ayuda", text: " · tanda " + t.id }),
      nota);
  }

  function pMuestras(panel, db, ref, estado) {
    var mus = cx.deExp(db, "muestras", ref);
    var ans = cx.deExp(db, "analisis", ref);
    var ais = cx.deExp(db, "aislados", ref);
    var bloqueado = estado === "BLOQUEADO";
    mus.forEach(function (m) {
      var esp = ING.idx.especies[m.especie_id] || {}, tip = ING.idx.tiposMuestra[m.tipo_muestra_id] || {};
      var em = estadoMuestra(db, m);
      var card = h("article", { class: "cx-tarjeta cx-muestra", "data-testid": "tarjeta-muestra", "data-muestra": m.id });
      var qrBtn = h("button", { type: "button", class: "cx-qr-btn", "aria-label": "Ampliar la etiqueta QR de " + m.id, "data-testid": "qr-muestra",
        onclick: function () { abrirQR(m.id); } }, cx.qr(m.id, 72));
      card.appendChild(h("div", { class: "cx-muestra-top" },
        h("div", { class: "cx-muestra-id" },
          h("h2", { class: "cx-h2 cx-mono-ref", text: m.id }),
          h("p", { text: (esp.nombre || "") + " · " + (tip.nombre || "") }),
          h("p", { class: "cx-ident" }, h("span", { text: m.identificacion || "Sin identificación" }),
            bloqueado ? null : botonCorregir({ col: "muestras", id: m.id, campo: "identificacion", etiqueta: "Identificación de " + m.id, valorActual: m.identificacion || "" }))),
        qrBtn));
      card.appendChild(h("p", { class: "cx-recep cx-recep-" + em }, cx.icon(em === "ACEPTADA" ? "circle-check" : em === "RECHAZADA" ? "ban" : "triangle-alert"),
        h("span", { text: TXT_MUESTRA[em] + " · " + nb((ING.idx.conservaciones[m.conservacion] || {}).nombre || m.conservacion) +
          " · " + nb((ING.idx.tiemposToma[m.tiempo_toma] || {}).nombre || "") + (m.envase_integro ? "" : " · envase no íntegro") +
          (m.rechazada && m.motivo_rechazo ? " · " + m.motivo_rechazo : "") })));
      var lista = h("ul", { class: "cx-analisis-lista" });
      ans.filter(function (a) { return a.muestra_id === m.id && !a.aislado_id; }).forEach(function (a) {
        lista.appendChild(filaAnalisis(db, a, m, ais, ans, bloqueado));
      });
      card.appendChild(lista);
      panel.appendChild(card);
    });
    panel.appendChild(h("p", { class: "cx-ayuda", text: "La PCR no se corrige: si hace falta, se repite la tanda en Biología molecular." }));
  }

  function filaAnalisis(db, a, m, ais, ans, bloqueado) {
    var c = ING.idx.analisis[a.catalogo_id];
    var est = ING.motor.estadoAnalisis(db, a);
    var li = h("li", { class: "cx-an-fila cx-an-" + est, "data-testid": "analisis-fila", "data-analisis": a.id });
    li.appendChild(h("div", { class: "cx-an-cab" },
      h("span", { class: "cx-an-nombre" }, cx.md(c.nombre)),
      h("span", { class: "cx-dep " + (c.departamento === "micro" ? "cx-dep-micro" : "cx-dep-mol") }, cx.icon(c.departamento === "micro" ? "microscope" : "dna"),
        h("span", { text: c.departamento === "micro" ? "Micro" : "Molecular" })),
      h("span", { class: "cx-an-estado", text: TXT_ANALISIS[est] || est })));
    if (a.anulado) { li.appendChild(h("p", { class: "cx-ayuda", text: "Anulado" + (a.motivo_anulacion ? ": " + a.motivo_anulacion : "") })); return li; }
    if (c.tipo === "pcr") {
      li.appendChild(bloquePCR(db, a, m));
      if (est === "REPETIR") {
        var t = ING.motor.tandaVigente(db, a.id), v = t ? ING.motor.validezTanda(db, t) : { reglas: [] };
        li.appendChild(h("p", { class: "cx-aviso cx-aviso-novalido" }, cx.icon("ban"), h("span", { text: "Tanda " + (t ? t.id : "") + " no válida (" + v.reglas.join(", ") + "): hay que repetir." })));
      }
    } else {
      var op = a.resultado ? (c.opciones_resultado || []).filter(function (o) { return o.id === a.resultado.opcion_id; })[0] : null;
      if (op) {
        var opsSimples = (c.opciones_resultado || []).filter(function (o) { return !o.requiere_aislado; });
        li.appendChild(h("p", { class: "cx-res-micro" }, cx.md(op.nombre),
          !bloqueado && !op.requiere_aislado && opsSimples.length > 1 ? botonCorregir({ col: "analisis", id: a.id, campo: "resultado", etiqueta: "Resultado de " + cx.plano(c.nombre) + " (" + m.id + ")",
            valorActual: op.id, opciones: opsSimples.map(function (o) { return { id: o.id, nombre: cx.plano(o.nombre) }; }) }) : null));
        if (a.resultado.observaciones) li.appendChild(h("p", { class: "cx-ayuda", text: a.resultado.observaciones }));
      } else if (!bloqueado && ING.ui.abrirRegistrarMicro) {
        li.appendChild(h("button", { type: "button", class: "cx-btn cx-btn-sec", "data-testid": "btn-registrar-ficha", "data-analisis": a.id,
          onclick: function () { ING.ui.abrirRegistrarMicro(a.id); } }, cx.icon("pencil"), h("span", { text: "Registrar resultado" })));
      }
      ais.filter(function (x) { return x.analisis_id === a.id; }).forEach(function (x) { li.appendChild(bloqueAislado(db, x, ans, bloqueado)); });
      if (op && op.requiere_aislado && est === "PENDIENTE") li.appendChild(h("p", { class: "cx-ayuda", text: "Falta registrar el aislado o su antibiograma." }));
    }
    return li;
  }

  function bloqueAislado(db, x, ans, bloqueado) {
    var tx = ING.idx.taxones[x.taxon_id] || {};
    var met = (ING.idx.metodos[x.metodo_id] || {}).nombre || x.metodo_id;
    var box = h("div", { class: "cx-aislado", "data-testid": "aislado", "data-aislado": x.id },
      h("p", { class: "cx-ais-cab" }, h("span", { class: "cx-mono", text: x.id + " · " }), cx.md(tx.nombre_md || x.taxon_id), h("span", { class: "cx-ayuda", text: " · " + met })));
    if (x.antibiograma) {
      var sir = null;
      if (ING.ui.barraSIR) { try { sir = ING.ui.barraSIR(x); } catch (e) { sir = null; } }
      if (!sir) sir = tablaSIRpropia(x);
      box.appendChild(sir);
      if (!bloqueado) {
        var det = h("details", { class: "cx-corregir-lecturas" });
        det.appendChild(h("summary", { text: "Corregir una lectura S/I/R" }));
        var ul = h("ul", { class: "cx-lecturas" });
        x.antibiograma.lecturas.forEach(function (l) {
          var atm = ING.idx.antimicrobianos[l.antimicrobiano_id] || {};
          ul.appendChild(h("li", null, h("span", { text: (atm.nombre || l.antimicrobiano_id) + " · " }), h("strong", { text: l.sir }),
            botonCorregir({ col: "aislados", id: x.id, campo: "lectura:" + l.antimicrobiano_id, etiqueta: "Lectura de " + (atm.nombre || l.antimicrobiano_id) + " (" + x.id + ")",
              valorActual: l.sir, opciones: [{ id: "S", nombre: "S" }, { id: "I", nombre: "I" }, { id: "R", nombre: "R" }] })));
        });
        det.appendChild(ul);
        box.appendChild(det);
      }
    } else if (tx.panel) box.appendChild(h("p", { class: "cx-ayuda", text: "Antibiograma pendiente." }));
    ans.filter(function (a) { return a.aislado_id === x.id; }).forEach(function (a) {
      var c = ING.idx.analisis[a.catalogo_id];
      box.appendChild(h("div", { class: "cx-an-gen", "data-analisis": a.id }, h("span", { class: "cx-an-nombre" }, cx.md(c.nombre)), bloquePCR(db, a, db.muestras[x.muestra_id] || {})));
    });
    return box;
  }
  function tablaSIRpropia(x) {
    var t = h("div", { class: "cx-sir" });
    x.antibiograma.lecturas.forEach(function (l) {
      var atm = ING.idx.antimicrobianos[l.antimicrobiano_id] || {};
      t.appendChild(h("span", { class: "cx-sir-c cx-sir-" + l.sir, title: atm.nombre || "" }, h("span", { text: (atm.nombre || l.antimicrobiano_id) + " " }), h("strong", { text: l.sir })));
    });
    return t;
  }

  /* ---------------------------------------------------------------- Corregir */
  function botonCorregir(o) {
    return h("button", { type: "button", class: "cx-btn-corregir", "data-testid": "btn-corregir", "data-campo": o.campo.split(":")[0], "data-id": o.id,
      "aria-label": "Corregir " + o.etiqueta, onclick: function () { ING.ui.abrirCorregir(o); } }, cx.icon("pencil"), h("span", { text: "Corregir" }));
  }

  ING.ui.abrirCorregir = function (o) {
    /* o = {col, id, campo, etiqueta, valorActual, opciones?}; campo "lectura:<antimicrobiano_id>" para S/I/R */
    var nuevo = o.opciones ? null : o.valorActual;
    var cuerpo = h("div", { class: "cx-form-hoja" });
    cuerpo.appendChild(h("p", { class: "cx-ayuda" }, h("span", { text: "Valor actual: " }),
      h("strong", { text: o.opciones ? ((o.opciones.filter(function (x) { return x.id === o.valorActual; })[0] || {}).nombre || o.valorActual) : (o.valorActual || "—") })));
    var control, zonaOps;
    if (o.opciones) {
      zonaOps = h("div");
      var pintarOps = function () {
        zonaOps.textContent = "";
        zonaOps.appendChild(cx.chipsRadio({ nombre: "Nuevo valor", opciones: o.opciones.filter(function (x) { return x.id !== o.valorActual; }), valor: nuevo, testid: "nuevo-valor",
          onchange: function (v) { nuevo = v; pintarOps(); comprobar(); } }));
      };
      pintarOps();
      cuerpo.appendChild(h("div", { class: "cx-campo" }, h("span", { class: "cx-etq", text: "Nuevo valor" }), zonaOps));
    } else {
      control = h("input", { type: "text", class: "cx-input", maxlength: "40", "data-testid": "input-nuevo-valor", value: o.valorActual || "", autocomplete: "off" });
      control.addEventListener("input", function () { nuevo = control.value; comprobar(); });
      cuerpo.appendChild(cx.campo("Nuevo valor", control));
    }
    var motivo = h("input", { type: "text", class: "cx-input", "data-testid": "input-motivo", maxlength: "160", autocomplete: "off", placeholder: "p. ej. error de transcripción" });
    motivo.addEventListener("input", comprobar);
    cuerpo.appendChild(cx.campo("Motivo de la corrección (obligatorio)", motivo, { ayuda: "Queda en el registro con el valor anterior y el nuevo." }));
    var rapidos = h("div", { class: "cx-chips" });
    ["Error de transcripción", "Dato mal leído en recepción", "Revisión del técnico"].forEach(function (t) {
      rapidos.appendChild(h("button", { type: "button", class: "cx-chip cx-chip-sec", text: t, onclick: function () { motivo.value = t.toLowerCase(); comprobar(); } }));
    });
    cuerpo.appendChild(rapidos);
    var err = h("p", { class: "cx-error", role: "alert", hidden: true });
    cuerpo.appendChild(err);
    var guardar = h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande cx-ancho", "data-testid": "btn-guardar-correccion", disabled: true },
      cx.icon("check"), h("span", { text: "Guardar corrección" }));
    cuerpo.appendChild(guardar);
    function valido() {
      var v = nuevo == null ? "" : String(nuevo).trim();
      return v !== "" && v !== String(o.valorActual) && motivo.value.trim().length >= 3;
    }
    function comprobar() { guardar.disabled = !valido(); }
    var ctl;
    guardar.addEventListener("click", function () {
      if (!valido()) { err.hidden = false; err.textContent = "Indica un valor distinto y el motivo."; return; }
      var db = cx.db();
      var col = db[o.col] || {};
      var doc0 = col[o.id];
      if (!doc0) { ctl.cerrar(); return; }
      var doc = JSON.parse(JSON.stringify(doc0));
      var campo = o.campo, antes = o.valorActual, despues = String(nuevo).trim();
      if (campo === "resultado") doc.resultado = Object.assign({ observaciones: "" }, doc.resultado || {}, { opcion_id: despues });
      else if (campo.indexOf("lectura:") === 0) {
        var atm = campo.slice(8);
        (doc.antibiograma.lecturas || []).forEach(function (l) { if (l.antimicrobiano_id === atm) l.sir = despues; });
        campo = "antibiograma." + atm + ".sir";
      } else doc[campo] = despues;
      ["origen_dato", "dispositivo", "epoch"].forEach(function (k) { if (doc0[k] === undefined) delete doc[k]; });
      var ref = doc.expediente_id;
      var estabaEmitido = cx.estado(db, ref) === "EMITIDO" || cx.informes(db, ref).length > 0;
      var nombreCampo = campo === "identificacion" ? "Identificación" : campo === "resultado" ? "Resultado" : "Lectura S/I/R";
      var ev = { tipo: "DATO_CORREGIDO", coleccion: o.col, entidad_id: o.id, expediente_id: ref,
        resumen: nombreCampo + " de " + o.id + " corregida: " + (antes || "—") + " → " + despues,
        cambios: [{ campo: campo, antes: antes, despues: despues }], motivo: motivo.value.trim() };
      guardar.disabled = true;
      Promise.resolve(ING.store.guardar(o.col, doc, ev)).then(function () {
        ctl.cerrar();
        cx.toast(estabaEmitido ? "Dato corregido · la v" + cx.informes(db, ref).length + " ya no vale: emite una nueva versión" : "Dato corregido");
      }, function () { ctl.cerrar(); });
    });
    ctl = cx.modal({ titulo: "Corregir: " + o.etiqueta, cuerpo: cuerpo, testid: "hoja-corregir" });
    if (control) { try { control.focus(); control.select(); } catch (e) { /* nada */ } }
  };

  /* ---------------------------------------------------------------- Alertas */
  function pAlertas(panel, db, ref) {
    var al = [];
    try { al = ING.motor.alertas(db, ref) || []; } catch (e) { al = []; }
    var orden = { pendiente: 0, valorada: 1, informativa: 2 };
    var nivel = { critico: 0, revisar: 1, info: 2 };
    al.sort(function (a, b) { return (orden[a.estado] - orden[b.estado]) || ((nivel[a.nivel] || 9) - (nivel[b.nivel] || 9)) || (a.clave < b.clave ? -1 : 1); });
    var pp = cx.pendientes(db, ref);
    panel.appendChild(h("p", { class: "cx-ayuda", "data-testid": "resumen-alertas", text: al.length ? (cx.textoPendientes(pp) || "Todas valoradas") + ". Las alertas no paran el trabajo; solo impiden emitir hasta que alguien las valora." : "Este expediente no tiene alertas." }));
    al.forEach(function (a) {
      var n = null;
      if (ING.ui.tarjetaAlerta) { try { n = ING.ui.tarjetaAlerta(a); } catch (e) { n = null; } }
      if (!n) {
        var r = ING.idx.reglas[a.regla_id] || {};
        n = h("div", { class: "cx-tarjeta", "data-testid": "alerta", "data-clave": a.clave, "data-estado": a.estado },
          h("p", null, h("strong", { text: a.regla_id + " · " }), cx.md(r.titulo || "")), h("p", null, cx.md(r.mensaje_md || "")));
      }
      panel.appendChild(n);
    });
    /* marcas de tanda no válida (no son alertas de expediente) */
    var rep = cx.deExp(db, "analisis", ref).filter(function (a) { return !a.anulado && ING.motor.estadoAnalisis(db, a) === "REPETIR"; });
    if (rep.length) {
      var box = h("div", { class: "cx-tarjeta cx-tandas-nv" }, h("h2", { class: "cx-h2" }, cx.icon("ban"), h("span", { text: " Tandas no válidas" })));
      rep.forEach(function (a) {
        var t = ING.motor.tandaVigente(db, a.id), v = ING.motor.validezTanda(db, t);
        box.appendChild(h("p", { text: a.id + " · tanda " + t.id + " (" + v.reglas.join(", ") + ") · repetir" }));
      });
      panel.appendChild(box);
    }
  }

  /* ---------------------------------------------------------------- Informe */
  function pInforme(panel, db, ref, estado) {
    var infs = cx.informes(db, ref);
    var cad = bandaCaducada(db, ref, estado);
    if (cad) { cad.removeAttribute("data-testid"); panel.appendChild(cad); }
    if (estado === "LISTO_PARA_VALIDAR") {
      var v = infs.length + 1;
      panel.appendChild(h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande cx-ancho", "data-testid": "btn-emitir", "data-ref": ref,
        onclick: function () { if (ING.cx.abrirEmision) ING.cx.abrirEmision(ref); } }, cx.icon("file-check"), h("span", { text: "Validar y emitir v" + v })));
    } else if (estado !== "EMITIDO") {
      panel.appendChild(h("p", { class: "cx-ayuda", text: estado === "PENDIENTE_VALORACION" ? "Para emitir, primero hay que valorar las alertas (y registrar la comunicación si procede)." :
        estado === "BLOQUEADO" ? "No se puede emitir: todas las muestras están rechazadas." : "Para emitir, todos los análisis deben tener resultado." }));
    }
    if (!infs.length) { panel.appendChild(h("p", { class: "cx-vacio", text: "Todavía no hay ningún informe emitido." })); return; }
    var ul = h("ul", { class: "cx-versiones" });
    infs.slice().reverse().forEach(function (inf, i) {
      var vigente = i === 0 && estado === "EMITIDO";
      var sust = infs.filter(function (x) { return x.version === inf.version + 1; })[0];
      ul.appendChild(h("li", null, h("a", { href: "#/informe/" + inf.id, class: "cx-tarjeta cx-version" + (vigente ? " vigente" : ""), "data-testid": "version-informe", "data-informe": inf.id },
        h("div", { class: "cx-tx-cab" }, h("span", { class: "cx-ref", text: inf.id }),
          h("span", { class: "cx-etq-version " + (vigente ? "vig" : "sus"), "data-testid": "estado-version",
            text: vigente ? "Vigente" : sust ? "Sustituida por v" + sust.version : "Caducada" })),
        h("p", { class: "cx-tx-sub", text: "Emitido " + cx.fechaHoraCorta(inf.emitido_en) + " · " + cx.nombreRol(inf.emitido_por) + " · sello " + String(inf.huella).slice(0, 8) }),
        inf.motivo ? h("p", { class: "cx-tx-sub", text: "Motivo: " + inf.motivo }) : null,
        inf.aviso_revisor ? h("p", { class: "cx-tx-sub", text: "Validado por quien registró resultados (aviso aceptado)" }) : null)));
    });
    panel.appendChild(ul);
  }

  /* ---------------------------------------------------------------- Registro */
  function pRegistro(panel, db, ref) {
    var evs = cx.deExp(db, "eventos", ref).sort(function (a, b) { return (a.ts + a.id) < (b.ts + b.id) ? 1 : -1; });
    panel.appendChild(h("p", { class: "cx-ayuda", text: evs.length + " eventos de este expediente, del más reciente al más antiguo. Solo se añaden; nunca se editan." }));
    var ul = h("ol", { class: "cx-eventos" });
    evs.forEach(function (e) {
      ul.appendChild(h("li", { class: "cx-evento", "data-testid": "evento", "data-tipo": e.tipo },
        h("p", { class: "cx-ev-cab" }, h("span", { class: "cx-mono", text: cx.fechaHoraCorta(e.ts) }), h("span", { text: " · " + cx.nombreRol(e.rol) })),
        h("p", { class: "cx-ev-res", text: e.resumen }),
        (e.cambios || []).map(function (c) { return h("p", { class: "cx-ev-cambio" }, h("span", { class: "cx-ayuda", text: c.campo + ": " }), h("span", { text: String(c.antes == null ? "—" : c.antes) + " → " + String(c.despues == null ? "—" : c.despues) })); }),
        e.motivo ? h("p", { class: "cx-ayuda", text: "Motivo: " + e.motivo }) : null));
    });
    panel.appendChild(ul);
  }

  ING.rutas.expedientes = vistaLista;
  ING.rutas.exp = vistaFicha;
})(typeof window !== "undefined" ? window : globalThis);

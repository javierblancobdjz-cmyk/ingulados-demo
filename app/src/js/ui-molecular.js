/* ui-molecular.js · Paquete D · Laboratorio de Biología molecular (ESPEC §3.6)
 * Rutas: #/lab/molecular, #/lab/tanda?diana=<id>
 * Exporta: ING.ui.chipResultadoPCR(analisis_id[, opciones]) → nodo (etiqueta, Ct y tanda, con nota de la diana)
 * Usa las ayudas de ING.lab (ui-micro.js) solo dentro de rutas y manejadores.
 */
(function () {
  "use strict";
  var ING = (window.ING = window.ING || {});
  ING.rutas = ING.rutas || {};
  var ui = (ING.ui = ING.ui || {});

  function h() { return ui.h.apply(null, arguments); }
  function idx() { return ING.idx || {}; }
  function motor() { return ING.motor; }
  function store() { return ING.store; }
  function L() { return ING.lab; }
  function plano(t) { return t == null ? "" : String(t).replace(/\*([^*]+)\*/g, "$1"); }
  function md(t) { return ui.md(t); }
  function P() { return ING.cat.parametros.pcr; }
  function fct(x) { return x == null ? "sin amplificación" : ING.fmt.num(x, 1); }
  /* "Sin Ct", "sin amplificación", "sin amp." … cuentan como sin amplificación */
  var RE_SIN = /^sin( ?ct| ?amp(\.|lificaci[oó]n)?)?$/i;
  function etiquetas() { return ING.cat.parametros.etiquetas_resultado_pcr; }
  function dianaDe(a) { var c = idx().analisis[a.catalogo_id] || {}; return idx().dianas[c.diana_id] || null; }
  function etiquetaRes(r, d) {
    if (r == null) return "Pendiente";
    if (r === "positivo" && d && d.etiqueta_positivo) return d.etiqueta_positivo;
    return etiquetas()[r] || r;
  }
  var TONO_RES = { positivo: "critico", dudoso: "revisar", inhibido: "novalido", negativo: "ok", repetir: "novalido" };
  var ICO_RES = { positivo: "circle-check", dudoso: "triangle-alert", inhibido: "ban", negativo: "circle-x", repetir: "rotate-ccw" };

  /* ------------------------------------------------------------ chipResultadoPCR */
  function notaDiana(db, a, r, d) {
    if (!d) return null;
    var m = db.muestras[a.muestra_id];
    if ((r === "positivo" || r === "dudoso") && d.nota_positivo_md) return { md: d.nota_positivo_md, refs: d.refs_positivo || [] };
    if (r === "negativo" && d.nota_negativo_md) {
      if (d.nota_negativo_solo_grupo) {
        var e = m && idx().especies[m.especie_id];
        if (!e || (e.grupos || []).indexOf(d.nota_negativo_solo_grupo) < 0) return null;
      }
      return { md: d.nota_negativo_md, refs: d.refs_negativo || [] };
    }
    return null;
  }

  ui.chipResultadoPCR = function (analisisId, opciones) {
    opciones = opciones || {};
    var db = store().db();
    var a = typeof analisisId === "string" ? db.analisis[analisisId] : analisisId;
    if (!a) return h("span", { class: "muted sec" }, "—");
    var d = dianaDe(a);
    var t = motor().tandaVigente(db, a.id);
    var r = motor().resultadoPCR(db, a);
    var caja = h("div", { class: "pcr-res", testid: "resultado-pcr", "data-analisis": a.id, "data-resultado": r || "pendiente" });
    if (r == null) {
      caja.appendChild(h("span", { class: "chip", "data-tono": "pendiente" }, ui.icon("clock"), h("span", null, "Pendiente de tanda")));
      return caja;
    }
    var poc = (t.pocillos || []).filter(function (p) { return p.analisis_id === a.id; })[0] || {};
    var fila = h("div", { class: "fila pcr-res-fila" },
      h("span", { class: "chip pcr-chip", "data-tono": TONO_RES[r], "data-resultado": r }, ui.icon(ICO_RES[r]), h("span", null, etiquetaRes(r, d))),
      r !== "repetir" ? (poc.ct == null
        ? h("span", { class: "pcr-ct sec", title: "La diana no amplificó en ningún ciclo" }, "sin amplificación")
        : h("span", { class: "pcr-ct sec", title: "Ct: ciclo umbral en que la diana amplifica" }, h("span", { class: "mono" }, "Ct " + fct(poc.ct)), " (ciclo umbral)")) : null,
      h("a", { class: "pcr-tanda-enl sec", href: "#/lab/molecular?tanda=" + t.id, title: "Ver la tanda " + t.id }, "tanda " + t.id));
    caja.appendChild(fila);
    if (r === "repetir") {
      var v = motor().validezTanda(db, t);
      caja.appendChild(h("p", { class: "pcr-nota sec" }, explicaNoValida(v, t.pocillos.length) + " (" + v.reglas.join(", ") + ")"));
    } else if (r === "inhibido") {
      caja.appendChild(h("p", { class: "pcr-nota sec" }, (poc.ct_ci == null ? "El control interno no amplificó" : "El control interno salió tarde (Ct " + fct(poc.ct_ci) + ")") + ": la PCR pudo estar inhibida y no se puede informar como negativo (PCR-04). ", ui.chipsRefs(["REF-57"])));
    }
    if (opciones.nota !== false) {
      var n = notaDiana(db, a, r, d);
      if (n) caja.appendChild(h("p", { class: "pcr-nota sec", testid: "nota-diana" }, md(n.md), " ", ui.chipsRefs(n.refs)));
    }
    return caja;
  };

  /* ------------------------------------------------------------ utilidades de tanda */
  function posicion(i) { return "ABCDEFGH".charAt(i % 8) + (Math.floor(i / 8) + 1); }
  function nombreDiana(d) { return d ? d.nombre : "—"; }
  function recuento(db, t) {
    var c = { det: 0, nodet: 0, nv: 0, dud: 0 };
    var v = motor().validezTanda(db, t);
    t.pocillos.forEach(function (p) {
      var a = db.analisis[p.analisis_id];
      if (!a) return;
      var r = motor().resultadoPCR(db, a, t);
      if (!v.valida) return;
      if (r === "positivo") c.det++; else if (r === "negativo") c.nodet++; else if (r === "dudoso") c.dud++; else c.nv++;
    });
    return c;
  }
  /* explicación en lenguaje llano de por qué una tanda no vale (DIR-13) */
  function explicaNoValida(v, n) {
    var motivos = v.reglas.map(function (r) {
      return r === "PCR-01" ? "el control que debía salir vacío ha amplificado (posible contaminación)"
        : r === "PCR-02" ? "el blanco de extracción ha amplificado (posible contaminación en la extracción)"
        : "el control positivo no ha salido donde debía (la reacción no es fiable)";
    });
    return "Esta tanda no vale: " + motivos.join("; ") + ". Hay que repetir " + (n === 1 ? "su análisis" : "sus " + n + " análisis") + ".";
  }
  function chipValidez(v) {
    if (v.valida) return h("span", { class: "chip", "data-tono": "ok", testid: "validez-tanda", "data-valida": "1" }, ui.icon("circle-check"), h("span", null, "Válida"));
    return h("span", { class: "chip", "data-tono": "novalido", testid: "validez-tanda", "data-valida": "0" }, ui.icon("ban"), h("span", null, "No válida · " + v.reglas.join(", ")));
  }
  function chipCtrl(nombre, val, mal) {
    return h("span", { class: "chip pcr-ctrl", "data-tono": mal ? "critico" : "borde" }, h("b", null, nombre), h("span", { class: "mono" }, fct(val)));
  }

  /* ------------------------------------------------------------ #/lab/molecular */
  function tarjetaTanda(db, t, abierta) {
    var d = idx().dianas[t.diana_id];
    var v = motor().validezTanda(db, t);
    var c = recuento(db, t);
    var txt = v.valida
      ? [c.det + " detectado" + (c.det === 1 ? "" : "s"), c.dud ? c.dud + " dudoso" + (c.dud === 1 ? "" : "s") : null, c.nodet + " no detectado" + (c.nodet === 1 ? "" : "s"), c.nv ? c.nv + " no valorable" + (c.nv === 1 ? "" : "s") : null].filter(Boolean).join(" · ")
      : t.pocillos.length + " análisis por repetir";
    var filas = t.pocillos.map(function (p) {
      var a = db.analisis[p.analisis_id] || { id: p.analisis_id, muestra_id: p.analisis_id };
      var r = motor().resultadoPCR(db, a, t);
      return h("tr", null,
        h("th", { scope: "row" }, p.pos),
        h("td", null, h("a", { href: "#/exp/" + (a.expediente_id || "") + "/muestras", title: a.aislado_id || a.muestra_id }, String(a.aislado_id || a.muestra_id).replace(/^ING-26-/, ""))),
        h("td", { class: "n mono" }, fct(p.ct)),
        h("td", { class: "n mono" }, fct(p.ct_ci)),
        h("td", null, r === "repetir" ? "Repetir" : etiquetaRes(r, d).replace(" (zona gris)", "").replace(" (inhibición)", "")));
    });
    return h("article", { class: "tarjeta pcr-tanda", testid: "tarjeta-tanda", "data-tanda": t.id, "data-valida": v.valida ? "1" : "0" },
      h("div", { class: "fila-sep" }, h("b", { class: "pcr-tanda-id" }, t.id), chipValidez(v)),
      h("p", { class: "pcr-tanda-diana" }, md(nombreDiana(d)), h("span", { class: "muted sec" }, " · " + (d ? d.gen : ""))),
      h("p", { class: "sec muted" }, ING.fmt.fecha(t.fecha) + " · " + t.equipo + " · " + t.pocillos.length + " pocillo" + (t.pocillos.length === 1 ? "" : "s")),
      h("div", { class: "chips pcr-ctrls" },
        chipCtrl("CP", t.controles.cp, v.reglas.indexOf("PCR-03") >= 0),
        chipCtrl("NTC", t.controles.ntc, t.controles.ntc != null),
        chipCtrl("CEX", t.controles.cex, t.controles.cex != null)),
      !v.valida ? h("p", { class: "aviso pcr-llano", "data-tono": "novalido", testid: "explica-no-valida" }, ui.icon("ban"), h("span", null, h("b", null, explicaNoValida(v, t.pocillos.length)), " ", h("span", { class: "sec" }, v.reglas.map(function (r) { return r + ": " + L().titRegla(r); }).join(" · ")))) : null,
      h("p", { class: "sec pcr-recuento" }, txt),
      h("details", { class: "plegable", open: !!abierta },
        h("summary", null, h("span", null, "Pocillos"), ui.icon("chevron-down", "chev")),
        h("div", { class: "tabla-wrap" }, h("table", { class: "tabla" },
          h("thead", null, h("tr", null, h("th", { scope: "col" }, "Pos."), h("th", { scope: "col" }, "Muestra"), h("th", { scope: "col", class: "n" }, "Ct"), h("th", { scope: "col", class: "n" }, "Ct CI"), h("th", { scope: "col" }, "Resultado"))),
          h("tbody", null, filas)))));
  }

  function tarjetaPendientes(db, g, tipo) {
    var d = idx().dianas[g.diana_id];
    var lista = tipo === "repetir" ? g.repetir : g.pendientes;
    if (!lista.length) return null;
    return h("article", { class: "tarjeta pcr-pend", testid: "pendientes-diana", "data-diana": g.diana_id, "data-tipo": tipo },
      h("div", { class: "fila-sep" },
        h("span", { class: "pcr-pend-diana" }, md(nombreDiana(d))),
        tipo === "repetir" ? h("span", { class: "chip", "data-tono": "novalido" }, ui.icon("rotate-ccw"), h("span", null, "Repetir")) : h("span", { class: "chip", "data-tono": "pendiente" }, ui.icon("clock"), h("span", null, "Pendiente"))),
      h("p", { class: "sec" }, lista.length + (lista.length === 1 ? " análisis " : " análisis ") + (tipo === "repetir" ? "por repetir (tanda no válida)" : "pendientes")),
      h("ul", { class: "pcr-pend-lista sec" }, lista.map(function (a) {
        return h("li", { "data-analisis": a.id, "data-estado": tipo === "repetir" ? "REPETIR" : "PENDIENTE" },
          h("a", { href: "#/exp/" + a.expediente_id + "/muestras" }, a.aislado_id || a.muestra_id),
          tipo === "repetir" ? h("span", { class: "pcr-rep" }, " · Repetir") : null);
      })),
      h("a", { class: "btn btn-bloque", href: "#/lab/tanda?diana=" + g.diana_id, testid: "btn-nueva-tanda", "data-diana": g.diana_id },
        ui.icon("plus"), h("span", null, "Nueva tanda")));
  }

  function graficaG8(db) {
    var porDiana = {}, ordenD = [];
    Object.keys(db.tandas).forEach(function (k) {
      var t = db.tandas[k];
      if (!motor().validezTanda(db, t).valida) return;
      t.pocillos.forEach(function (p) {
        var a = db.analisis[p.analisis_id];
        if (!a || a.anulado) return;
        if (motor().tandaVigente(db, a.id) !== t) return;
        var r = motor().resultadoPCR(db, a);
        if (r !== "positivo" && r !== "dudoso") return;
        if (!porDiana[t.diana_id]) { porDiana[t.diana_id] = []; }
        porDiana[t.diana_id].push({ ct: p.ct, r: r, a: a.id, t: t.id });
      });
    });
    (ING.cat.dianas || []).forEach(function (d) { if (porDiana[d.id]) ordenD.push(d.id); });
    var CORTA = { mtbc: "Compl. M. tuberculosis", map: "Paratuberculosis", bru: "Brucella spp.", cox: "Coxiella burnetii", chl: "Chlamydia abortus",
      vppa: "Peste porcina afr.", adv: "Aujeszky", btv: "Lengua azul", ehdv: "EHE", mcr: "Genes mcr", ctxm: "blaCTX-M", mec: "mecA / mecC" };
    var etiquetasY = ordenD.map(function (id) { return CORTA[id] || plano(idx().dianas[id].nombre); });
    var puntos = function (res) {
      var out = [];
      ordenD.forEach(function (id, i) { porDiana[id].forEach(function (x) { if (x.r === res) out.push({ x: x.ct, y: etiquetasY[i], a: x.a, t: x.t }); }); });
      return out;
    };
    var n = ordenD.reduce(function (s, id) { return s + porDiana[id].length; }, 0);
    var canvas = h("canvas", { "aria-label": "Dispersión del Ct de los positivos y dudosos por diana", role: "img" });
    var P0 = P();
    var bandaGris = {
      id: "bandaGris",
      beforeDatasetsDraw: function (chart) {
        var x = chart.scales.x, a = chart.chartArea, ctx = chart.ctx;
        if (!x || !a) return;
        var x0 = x.getPixelForValue(P0.positivo_lt), x1 = x.getPixelForValue(P0.dudoso_lt);
        ctx.save();
        ctx.fillStyle = ui.css("--revisar-bg");
        ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
        ctx.fillStyle = ui.css("--revisar");
        ctx.font = "600 13px 'Alegreya Sans', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textAlign = "right";
        ctx.fillText("zona gris 35–40", x1 - 4, a.bottom - 6);
        ctx.restore();
      }
    };
    var alto = Math.max(220, 60 + 34 * ordenD.length);
    ui.chart(canvas, function () {
      return {
        type: "scatter",
        data: {
          datasets: [
            { label: "Detectado / compatible", data: puntos("positivo"), backgroundColor: "var(--serie-4)", borderColor: "var(--serie-4)", pointRadius: 6, pointHoverRadius: 8 },
            { label: "Dudoso", data: puntos("dudoso"), backgroundColor: "var(--serie-3)", borderColor: "var(--serie-3)", pointRadius: 6, pointHoverRadius: 8, pointStyle: "triangle" }
          ]
        },
        options: {
          layout: { padding: { top: 4, right: 8 } },
          scales: {
            x: { type: "linear", min: 15, max: 40, title: { display: true, text: "Ct" }, ticks: { stepSize: 5 } },
            y: {
              type: "category", labels: etiquetasY, offset: true,
              ticks: { autoSkip: false },
              grid: { display: false }
            }
          },
          plugins: {
            tooltip: { callbacks: { label: function (c) { return c.raw.a + " · Ct " + ING.fmt.num(c.raw.x, 1) + " · " + c.raw.t; } } }
          }
        },
        plugins: [bandaGris]
      };
    });
    return ui.tarjetaGrafica({
      id: "g8", titulo: "¿Con qué Ct salen los positivos y dudosos?",
      subtitulo: "Tandas válidas · n = " + n + " pocillos · zona gris: criterio del laboratorio",
      canvas: canvas, alto: alto,
      fuente: "Ct de la diana en tandas válidas",
      refs: ["REF-73"],
      comoSeLee: "Cada punto es un pocillo con resultado detectado (círculo) o dudoso (triángulo). Cuanto más a la izquierda, más carga. La banda sombreada es la zona gris entre Ct 35 y 40: es un criterio del laboratorio, no un valor de referencia.",
      tabla: function () {
        var filas = [];
        ordenD.forEach(function (id) { porDiana[id].forEach(function (x) { filas.push([plano(idx().dianas[id].nombre), x.a, ING.fmt.num(x.ct, 1), x.r === "positivo" ? "Detectado" : "Dudoso", x.t]); }); });
        return { cabeceras: ["Diana", "Análisis", "Ct", "Resultado", "Tanda"], filas: filas, numericas: [2] };
      }
    });
  }

  ING.rutas["lab/molecular"] = function (p) {
    var db = store().db();
    var M = motor();
    var tandas = Object.keys(db.tandas).map(function (k) { return db.tandas[k]; });
    var vs = tandas.map(function (t) { return M.validezTanda(db, t); });
    var nVal = vs.filter(function (v) { return v.valida; }).length;
    var motivos = {};
    vs.forEach(function (v) { v.reglas.forEach(function (r) { motivos[r] = (motivos[r] || 0) + 1; }); });
    var pct = tandas.length ? Math.round(100 * nVal / tandas.length) : 0;
    var grupos = M.bandejaMolecularPorDiana ? M.bandejaMolecularPorDiana(db) : [];
    var nPend = grupos.reduce(function (s, g) { return s + g.pendientes.length + g.repetir.length; }, 0);
    var recientes = tandas.slice().sort(function (a, b) { return a.creado_en < b.creado_en ? 1 : a.creado_en > b.creado_en ? -1 : (a.id < b.id ? 1 : -1); });
    var foco = p && p.q && p.q.tanda;
    var lista = recientes.slice(0, 10);
    if (foco && db.tandas[foco] && lista.indexOf(db.tandas[foco]) < 0) lista.unshift(db.tandas[foco]);

    var cont = h("div", { class: "lab lab-molecular" });
    cont.appendChild(L().selector("molecular"));
    cont.appendChild(h("div", { class: "pantalla-cab" }, h("h1", null, "Biología molecular"), h("span", { class: "chip", "data-tono": "info" }, nPend + " pendientes")));
    cont.appendChild(L().recuadro());
    cont.appendChild(h("p", { class: "aviso pcr-rotulo", "data-tono": "info" }, ui.icon("info"), h("span", null, "Catálogo de ejemplo: cada diana con su referencia; kits y cortes de Ct los valida el laboratorio.")));
    cont.appendChild(h("section", { class: "tarjeta pcr-kpi" },
      h("p", { class: "pcr-kpi-et" }, "Tandas válidas"),
      h("p", { class: "pcr-kpi-cifra", testid: "kpi-tandas-validas" }, h("span", { class: "cifra" }, nVal + " de " + tandas.length), h("span", { class: "pcr-kpi-pct" }, " (" + pct + " %)")),
      Object.keys(motivos).length ? h("div", { class: "chips" }, Object.keys(motivos).sort().map(function (r) {
        return h("span", { class: "chip", "data-tono": "novalido", title: L().titRegla(r) }, ui.icon("ban"), h("span", null, r + " · " + motivos[r]));
      })) : null,
      h("p", { class: "min muted" }, "Una tanda no es válida si el NTC o el blanco de extracción amplifican o si el control positivo sale de su rango. ", ui.chipsRefs(["REF-24", "REF-25"]))));

    cont.appendChild(h("h2", { class: "seccion" }, "Pendientes por diana"));
    var tarjetas = [];
    grupos.forEach(function (g) {
      var a = tarjetaPendientes(db, g, "pendientes"); if (a) tarjetas.push(a);
      var b = tarjetaPendientes(db, g, "repetir"); if (b) tarjetas.push(b);
    });
    if (!tarjetas.length) cont.appendChild(L().vacio());
    else cont.appendChild(h("div", { class: "rejilla" }, tarjetas));

    var noValidas = recientes.filter(function (t) { return !M.validezTanda(db, t).valida; });
    if (noValidas.length) {
      cont.appendChild(h("h2", { class: "seccion" }, "Tandas no válidas"));
      cont.appendChild(h("div", { class: "rejilla" }, noValidas.map(function (t) { return tarjetaTanda(db, t, foco === t.id); })));
    }
    var recLista = lista.filter(function (t) { return noValidas.indexOf(t) < 0; });
    cont.appendChild(h("h2", { class: "seccion" }, "Tandas recientes"));
    cont.appendChild(h("p", { class: "sec muted" }, "Las 10 últimas registradas" + (noValidas.length ? " (las no válidas van arriba)" : "") + "."));
    cont.appendChild(h("div", { class: "rejilla" }, recLista.map(function (t) { return tarjetaTanda(db, t, foco === t.id); })));
    cont.appendChild(h("div", { class: "seccion" }, graficaG8(db)));
    if (foco) setTimeout(function () {
      var n = document.querySelector('[data-testid="tarjeta-tanda"][data-tanda="' + foco + '"]');
      if (n && n.scrollIntoView) n.scrollIntoView({ block: "center" });
    }, 50);
    return cont;
  };

  /* ------------------------------------------------------------ #/lab/tanda */
  var borrador = null;   // se conserva mientras no se registre (cambio de diana lo rehace)

  function nuevoBorrador(db, dianaId) {
    var M = motor();
    var g = (M.bandejaMolecularPorDiana(db) || []).filter(function (x) { return x.diana_id === dianaId; })[0] || { pendientes: [], repetir: [] };
    var ans = g.repetir.concat(g.pendientes);
    var d = idx().dianas[dianaId] || { cp_rango: [24, 30] };
    var cpDef = Math.round(((d.cp_rango[0] + d.cp_rango[1]) / 2) * 10) / 10;
    return {
      diana: dianaId,
      equipo: (ING.cat.equipos_pcr || ["TC-01"])[0],
      cp: String(ING.fmt.num(cpDef, 1)),
      ntcSin: true, ntc: "", cexSin: true, cex: "",
      filas: ans.map(function (a) { return { id: a.id, incl: true, ct: "", sinCt: false, ci: "29,0", repetir: g.repetir.indexOf(a) >= 0 }; })
    };
  }

  function tandaProvisional(db, b) {
    var pn = L().parseNum;
    var incl = b.filas.filter(function (f) { return f.incl; });
    return {
      id: motor().siguienteTanda(db), diana_id: b.diana, fecha: L().hoyISO(), equipo: b.equipo, operador: L().rol(),
      controles: { cp: pn(b.cp), ntc: b.ntcSin ? null : pn(b.ntc), cex: b.cexSin ? null : pn(b.cex) },
      pocillos: incl.map(function (f, i) { return { analisis_id: f.id, pos: posicion(i), ct: f.sinCt ? null : pn(f.ct), ct_ci: pn(f.ci) }; }),
      creado_en: L().ahora(), creado_por: L().rol()
    };
  }
  function erroresTanda(b, t) {
    var e = [];
    if (t.controles.cp == null || isNaN(t.controles.cp)) e.push("Falta el Ct del control positivo (CP).");
    if (!b.ntcSin && (t.controles.ntc == null || isNaN(t.controles.ntc))) e.push("Escribe el Ct del NTC o marca «Sin amplificación».");
    if (!b.cexSin && (t.controles.cex == null || isNaN(t.controles.cex))) e.push("Escribe el Ct del blanco de extracción o marca «Sin amplificación».");
    if (!t.pocillos.length) e.push("Incluye al menos un análisis.");
    var pn = L().parseNum;
    b.filas.forEach(function (f) {
      if (!f.incl) return;
      var corto = f.id.replace(/-pcr_\w+$/, "");
      if (!f.sinCt && (!String(f.ct).trim() || isNaN(pn(f.ct)))) e.push("Ct de " + corto + ": escribe un número o marca «Sin amplificación».");
      if (String(f.ci).trim() && isNaN(pn(f.ci))) e.push("Control interno de " + corto + ": no es un número.");
    });
    return e;
  }

  /* resumen corto de lo que falta: "Faltan 4 Ct · falta el CP" */
  function resumenErrores(errs) {
    var nCt = errs.filter(function (e) { return /^Ct de /.test(e); }).length;
    var nCi = errs.filter(function (e) { return /^Control interno de /.test(e); }).length;
    var otros = errs.filter(function (e) { return !/^Ct de |^Control interno de /.test(e); });
    var partes = [];
    if (nCt) partes.push(nCt === 1 ? "Falta 1 Ct de pocillo" : "Faltan " + nCt + " Ct de pocillos");
    if (nCi) partes.push(nCi + (nCi === 1 ? " control interno no es un número" : " controles internos no son números"));
    otros.forEach(function (e) { partes.push(e.replace(/\.$/, "")); });
    return partes.join(" · ") + ". Escribe el Ct o marca «Sin amplificación».";
  }

  ING.rutas["lab/tanda"] = function (p) {
    var db = store().db();
    var M = motor();
    var grupos = M.bandejaMolecularPorDiana(db) || [];
    var dianas = grupos.map(function (g) { return g.diana_id; });
    var pedida = p && p.q && p.q.diana;
    var dianaId = dianas.indexOf(pedida) >= 0 ? pedida : (borrador && dianas.indexOf(borrador.diana) >= 0 ? borrador.diana : dianas[0]);
    var cont = h("div", { class: "lab lab-tanda" });
    cont.appendChild(h("div", { class: "pantalla-cab" },
      h("a", { class: "volver", href: "#/lab/molecular", "aria-label": "Volver a Biología molecular" }, ui.icon("arrow-left")),
      h("h1", null, "Nueva tanda")));
    if (!dianaId) {
      cont.appendChild(h("div", { class: "tarjeta vacio" }, h("p", null, "No hay análisis moleculares pendientes."), h("a", { class: "btn btn-sec", href: "#/lab/molecular" }, "Volver")));
      return cont;
    }
    if (!borrador || borrador.diana !== dianaId) borrador = nuevoBorrador(db, dianaId);
    else {
      /* quitar filas que ya no están pendientes y añadir nuevas */
      var nb = nuevoBorrador(db, dianaId);
      var viejas = {}; borrador.filas.forEach(function (f) { viejas[f.id] = f; });
      borrador.filas = nb.filas.map(function (f) { return viejas[f.id] ? Object.assign(viejas[f.id], { repetir: f.repetir }) : f; });
    }
    var b = borrador;
    var d = idx().dianas[dianaId];
    var idTanda = M.siguienteTanda(db);

    var previa = h("div", { class: "tarjeta pcr-previa", "aria-live": "polite" });
    var btnReg = h("button", { type: "button", class: "btn btn-bloque", testid: "btn-registrar-tanda" }, ui.icon("check"), h("span", null, "Registrar tanda " + idTanda));
    var celdasRes = {};

    function recalcular() {
      var t = tandaProvisional(db, b);
      var errs = erroresTanda(b, t);
      var v = M.validezTanda(db, t);
      previa.textContent = "";
      var txtV = v.valida ? "Válida" : "No válida: " + v.reglas.map(function (r) {
        return r === "PCR-01" ? "el NTC amplifica (PCR-01)" : r === "PCR-02" ? "el blanco de extracción amplifica (PCR-02)" : "el control positivo está fuera de rango " + ING.fmt.num(d.cp_rango[0], 0) + "–" + ING.fmt.num(d.cp_rango[1], 0) + " (PCR-03)";
      }).join("; ");
      previa.appendChild(h("p", { class: "pcr-previa-v", testid: "previa-validez", "data-valida": errs.length ? "" : (v.valida ? "1" : "0") },
        errs.length ? h("span", { class: "chip", "data-tono": "pendiente" }, ui.icon("pencil"), h("span", null, "Faltan datos para valorar la tanda"))
          : h("span", { class: "chip", "data-tono": v.valida ? "ok" : "novalido" }, ui.icon(v.valida ? "circle-check" : "ban"), h("span", null, txtV))));
      if (errs.length) previa.appendChild(h("p", { class: "pcr-errores sec", testid: "previa-faltan" }, resumenErrores(errs)));
      if (!v.valida && !errs.length) previa.appendChild(h("p", { class: "sec" }, "Se registra igualmente: sus análisis pasan a «Repetir»."));
      /* resultado por pocillo */
      var resum = { };
      t.pocillos.forEach(function (pz) {
        var a = db.analisis[pz.analisis_id];
        var r = errs.length || (pz.ct != null && isNaN(pz.ct)) || (pz.ct_ci != null && isNaN(pz.ct_ci)) ? null : M.resultadoPCR(db, a, t);
        var c = celdasRes[pz.analisis_id];
        if (c) {
          c.textContent = "";
          if (r) c.appendChild(h("span", { class: "chip pcr-chip", "data-tono": TONO_RES[r], "data-resultado": r }, ui.icon(ICO_RES[r]), h("span", null, etiquetaRes(r, d))));
          else c.appendChild(h("span", { class: "muted sec" }, "—"));
        }
        if (r) resum[r] = (resum[r] || 0) + 1;
      });
      b.filas.forEach(function (f) { if (!f.incl && celdasRes[f.id]) { celdasRes[f.id].textContent = ""; celdasRes[f.id].appendChild(h("span", { class: "muted sec" }, "No incluido")); } });
      var partes = Object.keys(resum).map(function (r) { return resum[r] + " " + etiquetaRes(r, d).toLowerCase(); });
      if (partes.length) previa.appendChild(h("p", { class: "sec" }, partes.join(" · ")));
      var P0 = P();
      previa.appendChild(h("p", { class: "min muted" }, "Umbrales: positivo Ct < " + ING.fmt.num(P0.positivo_lt, 0) + "; dudoso " + ING.fmt.num(P0.positivo_lt, 0) + "–" + ING.fmt.num(P0.dudoso_lt, 0) + "; inhibido si el control interno falta o supera " + ING.fmt.num(P0.ci_ref + P0.ci_max_desvio, 0) + " · criterio del laboratorio ", ui.chipsRefs(["REF-73", "REF-57"])));
      btnReg.disabled = errs.length > 0;
      btnReg._tanda = t; btnReg._valida = v;
    }

    /* 1. diana */
    var selD = h("select", { class: "input", testid: "campo-diana", "aria-label": "Diana" }, grupos.map(function (g) {
      var n = g.pendientes.length + g.repetir.length;
      return h("option", { value: g.diana_id, selected: g.diana_id === dianaId }, plano(idx().dianas[g.diana_id].nombre) + " · " + n);
    }));
    selD.addEventListener("change", function () { ui.irA("#/lab/tanda?diana=" + selD.value); });
    var selEq = h("select", { class: "input", "aria-label": "Equipo" }, (ING.cat.equipos_pcr || []).map(function (e) { return h("option", { value: e, selected: e === b.equipo }, e); }));
    selEq.addEventListener("change", function () { b.equipo = selEq.value; recalcular(); });
    cont.appendChild(h("section", { class: "tarjeta pila" },
      h("label", { class: "campo" }, h("span", null, "1 · Diana"), selD),
      h("p", { class: "sec muted" }, md(d.nombre), " · gen " + d.gen + " · control interno " + (d.tipo_ci === "endogeno" ? "endógeno (β-actina)" : "exógeno (IAC)") + " · rango del CP " + ING.fmt.num(d.cp_rango[0], 0) + "–" + ING.fmt.num(d.cp_rango[1], 0)),
      h("label", { class: "campo" }, h("span", null, "Equipo"), selEq)));

    /* 2. controles */
    function campoCtrl(clave, etiqueta, testid) {
      /* "Sin amplificación" activado por defecto; escribir un Ct lo desactiva y activarlo borra el Ct */
      var inp = h("input", { type: "text", inputmode: "decimal", class: "input pcr-ct-in", testid: testid, value: b[clave], placeholder: "sin amplif.", "aria-label": "Ct de " + etiqueta + " (opcional)" });
      var chk = h("input", { type: "checkbox", checked: b[clave + "Sin"], testid: testid + "-sin" });
      chk.addEventListener("change", function () { b[clave + "Sin"] = chk.checked; if (chk.checked) { inp.value = ""; b[clave] = ""; } else inp.focus(); recalcular(); });
      inp.addEventListener("input", function () {
        b[clave] = inp.value;
        var vacio = !inp.value.trim() || RE_SIN.test(inp.value.trim());
        b[clave + "Sin"] = vacio; chk.checked = vacio;
        recalcular();
      });
      return h("div", { class: "pcr-ctrl-fila" },
        h("span", { class: "pcr-ctrl-et" }, etiqueta),
        h("label", { class: "pcr-sinct" }, chk, h("span", null, "Sin amplificación")),
        inp);
    }
    var cpIn = h("input", { type: "text", inputmode: "decimal", class: "input pcr-ct-in", testid: "ctrl-cp", value: b.cp, "aria-label": "Ct del control positivo" });
    cpIn.addEventListener("input", function () { b.cp = cpIn.value; recalcular(); });
    cont.appendChild(h("section", { class: "tarjeta" },
      h("h2", { class: "tarjeta-tit" }, "2 · Controles"),
      h("div", { class: "pcr-ctrl-fila" }, h("span", { class: "pcr-ctrl-et" }, "CP (control positivo)"), h("span"), cpIn),
      campoCtrl("ntc", "NTC (sin plantilla)", "ctrl-ntc"),
      campoCtrl("cex", "CEX (blanco de extracción)", "ctrl-cex")));

    /* 3. pocillos */
    var tbody = h("div", { class: "pcr-pocillos" });
    var incluidos = 0;
    b.filas.forEach(function (f) {
      var a = db.analisis[f.id];
      var chk = h("input", { type: "checkbox", checked: f.incl, "aria-label": "Incluir " + f.id, testid: "incl-" + f.id });
      var ct = h("input", { type: "text", inputmode: "decimal", class: "input pcr-ct-in", testid: "ct-" + f.id, value: f.sinCt ? "" : f.ct, placeholder: "Ct", "aria-label": "Ct de la diana en " + f.id });
      var sin = h("input", { type: "checkbox", checked: f.sinCt, testid: "sinct-" + f.id });
      var ci = h("input", { type: "text", inputmode: "decimal", class: "input pcr-ct-in", testid: "ctci-" + f.id, value: f.ci, "aria-label": "Ct del control interno en " + f.id });
      var res = h("div", { class: "pcr-poc-res" });
      celdasRes[f.id] = res;
      var posEt = h("span", { class: "pcr-pos mono" }, "");
      chk.addEventListener("change", function () { f.incl = chk.checked; pintarPos(); recalcular(); });
      ct.addEventListener("input", function () {
        var v = ct.value.trim();
        if (RE_SIN.test(v)) { f.sinCt = true; f.ct = ""; sin.checked = true; }
        else { f.ct = ct.value; if (v) { f.sinCt = false; sin.checked = false; } }
        recalcular();
      });
      sin.addEventListener("change", function () { f.sinCt = sin.checked; if (sin.checked) { ct.value = ""; f.ct = ""; } recalcular(); });
      ci.addEventListener("input", function () { f.ci = ci.value; recalcular(); });
      f._pos = posEt;
      tbody.appendChild(h("div", { class: "pcr-poc", "data-analisis": f.id },
        h("div", { class: "pcr-poc-cab" },
          h("label", { class: "pcr-incl" }, chk, h("span", null, h("b", null, a ? (a.aislado_id || a.muestra_id) : f.id))),
          posEt,
          f.repetir ? h("span", { class: "chip", "data-tono": "novalido" }, ui.icon("rotate-ccw"), h("span", null, "Repetir")) : null),
        h("p", { class: "sec muted pcr-poc-m" }, a ? L().describirMuestra(db, a.muestra_id) : ""),
        h("div", { class: "pcr-poc-campos" },
          h("label", { class: "pcr-campo" }, h("span", null, "Ct diana"), ct),
          h("label", { class: "pcr-sinct" }, sin, h("span", null, "Sin amplificación")),
          h("label", { class: "pcr-campo" }, h("span", null, "Ct CI"), ci)),
        res));
      if (f.incl) incluidos++;
    });
    function pintarPos() {
      var i = 0;
      b.filas.forEach(function (f) { f._pos.textContent = f.incl ? posicion(i++) : "—"; });
    }
    pintarPos();
    cont.appendChild(h("section", { class: "tarjeta" },
      h("h2", { class: "tarjeta-tit" }, "3 · Pocillos"),
      h("p", { class: "sec muted" }, "Posición automática por columnas (A1, B1… H1, A2…). Control interno 29,0 por defecto."),
      tbody));

    /* 4. vista previa + registrar */
    cont.appendChild(h("section", { class: "pcr-previa-wrap" }, h("h2", { class: "seccion pcr-previa-h" }, "4 · Vista previa y registro"), previa, btnReg));
    btnReg.addEventListener("click", function () {
      if (btnReg.disabled) return;
      var t = btnReg._tanda, v = btnReg._valida;
      btnReg.disabled = true;
      var dbAhora = store().db();
      var refs = {};
      t.pocillos.forEach(function (pz) { var a = dbAhora.analisis[pz.analisis_id]; if (a) refs[a.expediente_id] = 1; });
      var antes = {};
      Object.keys(refs).forEach(function (r) { antes[r] = L().claves(M.alertas(dbAhora, r)); });
      t.id = M.siguienteTanda(dbAhora);
      t.creado_en = L().ahora();
      var dbP = L().conCambio(dbAhora, "tandas", t);
      var nuevas = [];
      Object.keys(refs).forEach(function (r) { M.alertas(dbP, r).forEach(function (a) { if (antes[r].indexOf(a.clave) < 0) nuevas.push(a); }); });
      store().guardar("tandas", t, {
        tipo: "TANDA_REGISTRADA", coleccion: "tandas", entidad_id: t.id, expediente_id: Object.keys(refs).length === 1 ? Object.keys(refs)[0] : null,
        resumen: "Tanda " + t.id + " · " + d.gen + " · " + t.pocillos.length + " pocillo" + (t.pocillos.length === 1 ? "" : "s") + " · " + (v.valida ? "Válida" : "No válida (" + v.reglas.join(", ") + ")"),
        cambios: [{ campo: "pocillos", antes: null, despues: t.pocillos.map(function (pz) { return pz.analisis_id; }).join(",") }]
      }).then(function () {
        borrador = null;
        var txt = "Tanda " + t.id + " registrada · " + (v.valida ? "Válida" : "No válida (" + v.reglas.join(", ") + ")");
        if (nuevas.length) {
          var tit = {}; nuevas.forEach(function (a) { tit[L().titRegla(a.regla_id)] = 1; });
          txt += " · " + nuevas.length + (nuevas.length === 1 ? " alerta: " : " alertas: ") + Object.keys(tit).join(", ");
        }
        ui.toast(txt, { texto: "Ver", hash: "#/lab/molecular?tanda=" + t.id });
        ui.irA("#/lab/molecular?tanda=" + t.id);
      }, function (e) { btnReg.disabled = false; setTimeout(function () { throw e; }); });
    });
    recalcular();
    return cont;
  };
})();

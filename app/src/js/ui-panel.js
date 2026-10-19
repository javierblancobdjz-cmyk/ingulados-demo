/* ui-panel.js · Paquete B · Inicio / Panel (#/inicio) · ESPEC §3.1 y §6 (G1-G6) */
(function () {
  "use strict";
  var ING = (window.ING = window.ING || {});
  var ui = ING.ui, h = ui.h, fmt = ui.fmt;

  var periodo = "todo";  // semana | mes | todo (por defecto Todo; dura lo que la sesión)
  var PERIODOS = [
    { id: "semana", texto: "Semana", dias: 7, sub: "últimos 7 días" },
    { id: "mes", texto: "Mes", dias: 30, sub: "últimos 30 días" },
    { id: "todo", texto: "Todo", dias: null, sub: "24-08 a 19-10-2026" }
  ];
  function periodoInfo() { for (var i = 0; i < PERIODOS.length; i++) if (PERIODOS[i].id === periodo) return PERIODOS[i]; return PERIODOS[2]; }
  function desdeISO() { var p = periodoInfo(); return p.dias ? fmt.hoyISO(p.dias) : null; }

  var CORTO_DIANA = {
    mtbc: "M. tuberculosis (c.)", map: "Paratuberculosis", bru: "Brucella spp.", cox: "C. burnetii", chl: "C. abortus",
    vppa: "Peste porcina af.", adv: "Aujeszky", btv: "Lengua azul", ehdv: "EHE", mcr: "Genes mcr", ctxm: "blaCTX-M", mec: "mecA / mecC"
  };
  var ORDEN_PCR = [
    { id: "positivo", nombre: "Detectado", color: "var(--serie-4)" },
    { id: "dudoso", nombre: "Dudoso", color: "var(--serie-3)" },
    { id: "inhibido", nombre: "No valorable", color: "var(--serie-otros)" },
    { id: "negativo", nombre: "No detectado", color: "var(--serie-1)" }
  ];
  var TIPOS_PROC = [
    { id: "cinegetica", nombre: "Finca cinegética", color: "var(--serie-1)" },
    { id: "ganadera", nombre: "Explotación ganadera", color: "var(--serie-2)" },
    { id: "mixta", nombre: "Mixta", color: "var(--serie-3)" },
    { id: "otro", nombre: "Otro cliente", color: "var(--serie-4)" }
  ];

  /* ---------- utilidades ---------- */
  function nombreSinMd(s) { return String(s || "").replace(/\*/g, ""); }
  function catIdx(lista) { var o = {}; (lista || []).forEach(function (x) { o[x.id] = x; }); return o; }
  function suma(o) { var t = 0; Object.keys(o || {}).forEach(function (k) { t += Number(o[k]) || 0; }); return t; }

  /* Plugin: escribe un texto al final de cada barra (o del último punto) */
  function pluginEtiquetas(textos, opciones) {
    opciones = opciones || {};
    return {
      id: "etiquetasFin",
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var metas = chart.getSortedVisibleDatasetMetas();
        if (!metas.length) return;
        var meta = opciones.ultimoDataset ? metas[metas.length - 1] : metas[0];
        ctx.save();
        ctx.font = "700 15px 'Alegreya Sans', system-ui, sans-serif";
        ctx.fillStyle = ui.css("--text");
        meta.data.forEach(function (el, i) {
          var t = typeof textos === "function" ? textos(i) : textos[i];
          if (t === null || t === undefined || t === "") return;
          if (opciones.soloUltimo && i !== meta.data.length - 1) return;
          var p = el.tooltipPosition ? el.tooltipPosition() : el;
          if (chart.options.indexAxis === "y") {
            var x = opciones.ultimoDataset ? el.x : el.x;
            ctx.textAlign = "left"; ctx.textBaseline = "middle";
            ctx.fillText(t, x + 6, el.y);
          } else if (opciones.soloUltimo) {
            ctx.textAlign = "right"; ctx.textBaseline = "bottom";
            ctx.fillText(t, p.x - 4, p.y - 8);
          } else {
            ctx.textAlign = "center"; ctx.textBaseline = "bottom";
            ctx.fillText(t, el.x, el.y - 4);
          }
        });
        ctx.restore();
      }
    };
  }

  /* ---------- cálculos que no vienen en motor.panel ---------- */
  function expedientesEnPeriodo(db, desde) {
    var out = [];
    ui.lista(db.expedientes).forEach(function (e) { if (!desde || String(e.recibido_en).slice(0, 10) >= desde) out.push(e); });
    return out;
  }
  function positividad(db, desde, panel) {
    var M = ING.motor, cat = ui.cat();
    if (M && M.positividadPorDiana) return M.positividadPorDiana(db, desde) || {};
    if (!desde && panel && panel.positividad_por_diana) return panel.positividad_por_diana;
    var ana = catIdx(cat.analisis);
    var refs = {}; expedientesEnPeriodo(db, desde).forEach(function (e) { refs[e.id] = 1; });
    var mus = db.muestras || {};
    var out = {};
    if (!M || !M.resultadoPCR) return out;
    ui.lista(db.analisis).forEach(function (a) {
      var c = ana[a.catalogo_id];
      if (!c || c.tipo !== "pcr" || a.anulado || !refs[a.expediente_id]) return;
      var r = M.resultadoPCR(db, a);
      if (!r || r === "repetir") return;
      var d = c.diana_id || a.catalogo_id.replace(/^pcr_/, "");
      out[d] = out[d] || {};
      out[d][r] = (out[d][r] || 0) + 1;
    });
    return out;
  }
  function contarAlertas(db, desde) {
    var M = ING.motor, res = { critico: 0, revisar: 0, info: 0, ok: false };
    if (!M || !M.alertas) return res;
    expedientesEnPeriodo(db, desde).forEach(function (e) {
      var L = [];
      try { L = M.alertas(db, e.id) || []; } catch (err) { L = []; }
      ui.lista(L).forEach(function (a) {
        if (a.nivel === "info") res.info++;
        else if ((a.estado === "pendiente" || a.comunicacion_pendiente) && res[a.nivel] !== undefined) res[a.nivel]++;
      });
    });
    res.ok = true;
    return res;
  }

  /* ---------- bloques ---------- */
  function filtroPeriodo() {
    return h("div", { class: "filtros panel-filtro", role: "group", "aria-label": "Periodo" }, PERIODOS.map(function (p) {
      return h("button", {
        type: "button", class: "chip-filtro", testid: "filtro-periodo-" + p.id, "aria-pressed": p.id === periodo ? "true" : "false",
        onclick: function () { if (periodo !== p.id) { periodo = p.id; ING.app.render(); } }
      }, p.texto);
    }));
  }

  function kpis(P) {
    function tile(o) {
      return h("a", { class: "kpi", href: o.href, "aria-label": o.aria, testid: o.testidTile || null },
        h("span", { class: "kpi-etq" }, ui.icon(o.icono), h("span", null, o.etiqueta)),
        h("span", { class: "kpi-num num", testid: o.testid || null }, o.valor),
        o.linea ? h("span", { class: "kpi-linea" }, o.linea) : null);
    }
    var med = P.kpi_tat_mediana_dias, p90 = P.kpi_tat_p90_dias;
    return h("div", { class: "kpis" },
      tile({ etiqueta: "Muestras", icono: "test-tube", valor: fmt.num(P.kpi_muestras), testid: "kpi-muestras", href: "#/expedientes", aria: "Muestras: " + P.kpi_muestras + ". Ver expedientes", linea: "recibidas" }),
      tile({ etiqueta: "En curso", icono: "flask-conical", valor: fmt.num(P.kpi_en_curso), testid: "kpi-en-curso", href: "#/expedientes?estado=en_curso", aria: "Expedientes en curso: " + P.kpi_en_curso, linea: "expedientes sin emitir" }),
      tile({ etiqueta: "Por validar", icono: "file-check", valor: fmt.num(P.kpi_por_validar), testid: "kpi-por-validar", href: "#/informes", aria: "Por validar: " + P.kpi_por_validar + ". Ver informes", linea: "listos o con alertas" }),
      h("a", { class: "kpi", href: "#/informes", testid: "kpi-tat", "aria-label": "Tiempo de respuesta" },
        h("span", { class: "kpi-etq" }, ui.icon("clock"), h("span", null, "Tiempo de respuesta")),
        h("span", { class: "kpi-num num" }, med === null || med === undefined ? "—" : fmt.num(med, 1), h("small", null, med === null || med === undefined ? "" : " días")),
        h("span", { class: "kpi-linea" }, p90 === null || p90 === undefined ? "sin informes en el periodo" : "mediana · P90 " + fmt.num(p90, 1) + " días")));
  }

  function contadoresAlertas(A) {
    function pill(nivel, n, texto) {
      var ni = ui.nivelInfo(nivel);
      return h("a", { class: "pill-alerta", href: "#/alertas", "data-tono": ni.tono, testid: "contador-" + nivel, "aria-label": texto + ": " + n },
        ui.icon(ni.icono), h("span", null, ni.nombre), h("b", { class: "num" }, String(n)));
    }
    return h("div", { class: "pills-alertas", "aria-label": "Alertas pendientes" },
      h("span", { class: "pills-tit" }, "Alertas pendientes"),
      h("div", { class: "pills-fila" },
        pill("critico", A.critico, "Críticas sin valorar"),
        pill("revisar", A.revisar, "Para revisar sin valorar"),
        pill("info", A.info, "Informativas")));
  }

  /* G1 · ¿Por dónde va cada expediente? (barras CSS) */
  function g1(P, sub) {
    var est = P.estados || {};
    var max = 0; ui.ESTADOS.forEach(function (e) { max = Math.max(max, est[e.id] || 0); });
    var total = suma(est);
    var lista = h("ol", { class: "barras-css barras-estado" }, ui.ESTADOS.map(function (e) {
      var n = est[e.id] || 0;
      var ancho = max ? Math.max(n ? 2 : 0, Math.round(100 * n / max)) : 0;
      return h("li", null, h("a", { class: "barra-css", href: "#/expedientes?estado=" + e.id, "data-estado": e.id, "data-tono": e.tono, "aria-label": e.nombre + ": " + n + " expedientes" },
        h("span", { class: "barra-etq" }, ui.icon(e.icono), h("span", null, e.nombre)),
        h("span", { class: "barra-pista" }, h("span", { class: "barra-relleno", style: { width: ancho + "%" } })),
        h("span", { class: "barra-n num" }, String(n))));
    }));
    return ui.tarjetaGrafica({
      id: "g1", titulo: "¿Por dónde va cada expediente?", subtitulo: sub + " · " + total + " expedientes",
      nodo: lista,
      fuente: "Estado calculado de cada expediente (recepción, resultados, alertas y validación)",
      refs: ["REF-01"],
      comoSeLee: "Las barras siguen el orden del circuito, de la recepción a la emisión. Cada expediente está en un solo estado, que se calcula con sus datos: nadie lo cambia a mano. Toca una barra para ver esos expedientes.",
      tabla: function () {
        return { cabeceras: ["Estado", "Expedientes"], numericas: [1], filas: ui.ESTADOS.map(function (e) { return [e.nombre, String(est[e.id] || 0)]; }).concat([["Total", String(total)]]) };
      }
    });
  }

  /* G2 · ¿De dónde vienen las muestras? (rosca) */
  function g2(P, sub) {
    var d = P.muestras_por_tipo_procedencia || {};
    var tipos = TIPOS_PROC.filter(function (t) { return (d[t.id] || 0) > 0; });
    var total = suma(d);
    var canvas = h("canvas", { role: "img", "aria-label": "Rosca: " + tipos.map(function (t) { return t.nombre + " " + d[t.id]; }).join(", ") });
    ui.chart(canvas, function () {
      return {
        type: "doughnut",
        data: { labels: tipos.map(function (t) { return t.nombre; }), datasets: [{ data: tipos.map(function (t) { return d[t.id]; }), backgroundColor: tipos.map(function (t) { return t.color; }), borderColor: "var(--surface)", borderWidth: 3, hoverOffset: 4 }] },
        options: {
          cutout: "62%",
          plugins: { tooltip: { callbacks: { label: function (c) { return " " + c.label + ": " + c.raw + " (" + fmt.num(100 * c.raw / (total || 1), 0) + " %)"; } } } },
          onClick: function (ev, els) { if (els && els.length) ui.irA("#/expedientes?tipo=" + tipos[els[0].index].id); }
        }
      };
    });
    var leyenda = h("ul", { class: "leyenda-directa" }, tipos.map(function (t) {
      return h("li", null, h("a", { href: "#/expedientes?tipo=" + t.id },
        h("span", { class: "muestra-color", style: { background: t.color } }),
        h("span", { class: "ley-nombre" }, t.nombre),
        h("span", { class: "ley-n num" }, h("b", null, fmt.num(100 * d[t.id] / (total || 1), 0) + " %"), " · " + d[t.id])));
    }));
    var nodo = h("div", { class: "rosca" }, h("div", { class: "grafica-caja rosca-caja", style: { height: "200px" } }, canvas,
      h("div", { class: "rosca-centro", "aria-hidden": "true" }, h("b", { class: "num" }, String(total)), h("span", null, "muestras"))), leyenda);
    return ui.tarjetaGrafica({
      id: "g2", titulo: "¿De dónde vienen las muestras?", subtitulo: sub + " · n = " + total + " muestras",
      nodo: nodo,
      fuente: "Procedencia de cada expediente",
      comoSeLee: "Cada parte es el porcentaje de muestras según el tipo de procedencia del expediente. Toca una parte o su nombre para ver esos expedientes.",
      tabla: function () {
        return { cabeceras: ["Procedencia", "Muestras", "%"], numericas: [1, 2], filas: tipos.map(function (t) { return [t.nombre, String(d[t.id]), fmt.num(100 * d[t.id] / (total || 1), 0) + " %"]; }).concat([["Total", String(total), "100 %"]]) };
      }
    });
  }

  /* G3 · ¿Cuántas muestras entran cada semana? (línea; ignora el filtro) */
  function g3(P) {
    var s = P.muestras_por_semana || {};
    var ks = Object.keys(s).sort();
    var vals = ks.map(function (k) { return s[k]; });
    var etiquetas = ks.map(function (k) { return fmt.dm(k); });
    var total = suma(s);
    var canvas = h("canvas", { role: "img", "aria-label": "Línea: muestras por semana, " + vals.join(", ") });
    ui.chart(canvas, function () {
      return {
        type: "line",
        data: { labels: etiquetas, datasets: [{ label: "Muestras", data: vals, borderColor: "var(--serie-2)", backgroundColor: "var(--serie-2)", borderWidth: 3, pointRadius: 4, pointHoverRadius: 6, tension: 0.25, fill: false }] },
        options: {
          layout: { padding: { top: 26, right: 10 } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 5 } }, x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } } },
          plugins: { tooltip: { callbacks: { title: function (c) { return "Semana del " + c[0].label + (c[0].dataIndex === ks.length - 1 ? " (en curso)" : ""); }, label: function (c) { return " " + c.raw + " muestras"; } } } }
        },
        plugins: [pluginEtiquetas(function (i) { return i === vals.length - 1 ? String(vals[i]) + " (en curso)" : ""; }, { soloUltimo: true })]
      };
    });
    return ui.tarjetaGrafica({
      id: "g3", titulo: "¿Cuántas muestras entran cada semana?", subtitulo: "9 semanas, del 24-08 al 19-10-2026 · n = " + total + " muestras · no depende del periodo elegido",
      canvas: canvas,
      fuente: "Fecha de recepción, por semana ISO (lunes)",
      comoSeLee: "Cada punto es una semana, que empieza en lunes. La última está en curso y por eso sale más baja. El pico de octubre coincide con la temporada de monterías.",
      tabla: function () {
        return { cabeceras: ["Semana (lunes)", "Muestras"], numericas: [1], filas: ks.map(function (k, i) { return [fmt.fecha(k) + (i === ks.length - 1 ? " (en curso)" : ""), String(s[k])]; }) };
      }
    });
  }

  /* G4 · ¿Cuánto tardamos en emitir? (barras verticales por tramos) */
  function g4(P, sub) {
    var T = P.tat_tramos || {};
    var tramos = [["<3", "< 3 días"], ["3-5", "3–5 días"], ["5-7", "5–7 días"], [">7", "> 7 días"]];
    var vals = tramos.map(function (t) { return T[t[0]] || 0; });
    var pct = P.tat_dentro_objetivo_pct;
    var obj = (ui.cat().parametros || {}).objetivo_tat_dias || 7;
    var canvas = h("canvas", { role: "img", "aria-label": "Barras: informes por tiempo de respuesta, " + tramos.map(function (t, i) { return t[1] + " " + vals[i]; }).join(", ") });
    ui.chart(canvas, function () {
      return {
        type: "bar",
        data: { labels: tramos.map(function (t) { return t[1]; }), datasets: [{ label: "Informes", data: vals, backgroundColor: ["var(--serie-1)", "var(--serie-1)", "var(--serie-1)", "var(--serie-otros)"], borderRadius: 6, maxBarThickness: 56 }] },
        options: {
          layout: { padding: { top: 22 } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 5 } }, x: { grid: { display: false } } },
          plugins: { tooltip: { callbacks: { label: function (c) { return " " + c.raw + " informes"; } } } }
        },
        plugins: [pluginEtiquetas(vals.map(String))]
      };
    });
    var destacado = h("p", { class: "destacado" },
      h("b", { class: "num" }, pct === null || pct === undefined ? "—" : pct + " %"),
      h("span", null, " dentro del objetivo de " + obj + " días (objetivo de ejemplo)"));
    return ui.tarjetaGrafica({
      id: "g4", titulo: "¿Cuánto tardamos en emitir?", subtitulo: sub + " · n = " + (P.tat_n || 0) + " informes v1 · mediana " + fmt.num(P.kpi_tat_mediana_dias, 1) + " días · P90 " + fmt.num(P.kpi_tat_p90_dias, 1) + " días",
      destacado: destacado,
      canvas: canvas,
      fuente: "De la recepción a la emisión de la v1; mediana y percentil 90",
      refs: ["REF-64"],
      comoSeLee: "Cada barra cuenta los informes emitidos en ese tramo de días desde que llegó la muestra. La barra gris queda fuera del objetivo. El objetivo de " + obj + " días es un ejemplo: lo fija el laboratorio.",
      tabla: function () {
        return { cabeceras: ["Tramo", "Informes"], numericas: [1], filas: tramos.map(function (t, i) { return [t[1], String(vals[i])]; }).concat([["Mediana", fmt.dias(P.kpi_tat_mediana_dias)], ["Percentil 90", fmt.dias(P.kpi_tat_p90_dias)], ["Dentro del objetivo", (pct === null || pct === undefined ? "—" : pct + " %")]]) };
      }
    });
  }

  /* G5 · ¿Qué sale en las PCR? (barras horizontales apiladas por diana) */
  function g5(pos, sub) {
    var cat = ui.cat(), dianas = catIdx(cat.dianas);
    var ids = Object.keys(pos).filter(function (d) { return suma(pos[d]) > 0; });
    ids.sort(function (a, b) { return suma(pos[b]) - suma(pos[a]) || (a < b ? -1 : 1); });
    var totales = ids.map(function (d) { return suma(pos[d]); });
    var total = suma(totales.reduce(function (o, v, i) { o[i] = v; return o; }, {}));
    var detectados = ids.reduce(function (t, d) { return t + (pos[d].positivo || 0); }, 0);
    var canvas = h("canvas", { role: "img", "aria-label": "Barras apiladas: resultados de PCR por diana" });
    ui.chart(canvas, function () {
      return {
        type: "bar",
        data: {
          labels: ids.map(function (d) { return CORTO_DIANA[d] || nombreSinMd(dianas[d] && dianas[d].nombre) || d; }),
          datasets: ORDEN_PCR.map(function (r) { return { label: r.nombre, data: ids.map(function (d) { return pos[d][r.id] || 0; }), backgroundColor: r.color, borderColor: "var(--surface)", borderWidth: { right: 1 }, borderSkipped: false, barThickness: 18 }; })
        },
        options: {
          indexAxis: "y",
          layout: { padding: { right: 34 } },
          scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 5 } }, y: { stacked: true, grid: { display: false }, ticks: { color: "var(--text)", autoSkip: false } } },
          plugins: { legend: { display: true, labels: { boxWidth: 12, boxHeight: 12, padding: 12 } }, tooltip: { callbacks: { label: function (c) { return " " + c.dataset.label + ": " + c.raw; } } } }
        },
        plugins: [pluginEtiquetas(totales.map(function (n) { return "n " + n; }), { ultimoDataset: true })]
      };
    });
    var alto = Math.max(220, ids.length * 30 + 90);
    return ui.tarjetaGrafica({
      id: "g5", titulo: "¿Qué sale en las PCR?", subtitulo: sub + " · n = " + total + " PCR con resultado · " + detectados + " detectadas",
      canvas: canvas, alto: alto,
      fuente: "Resultado de cada pocillo según los controles de su tanda",
      refs: ["REF-73", "REF-57", "REF-24"],
      comoSeLee: "Cada barra es una diana; los colores reparten sus resultados y el número final es el total de análisis. Solo cuentan las PCR de tandas válidas: las de tandas no válidas se repiten y no salen aquí. Los cortes de Ct son criterio del laboratorio.",
      tabla: function () {
        var filas = ids.map(function (d) {
          return [ui.md(dianas[d] ? dianas[d].nombre : d)].concat(ORDEN_PCR.map(function (r) { return String(pos[d][r.id] || 0); }), [String(suma(pos[d]))]);
        });
        return { cabeceras: ["Diana"].concat(ORDEN_PCR.map(function (r) { return r.nombre; }), ["Total"]), numericas: [1, 2, 3, 4, 5], filas: filas };
      }
    });
  }

  /* G6 · ¿A qué antimicrobianos son resistentes? (barras horizontales % R, n ≥ 5) */
  function g6(P, sub) {
    var cat = ui.cat(), atm = catIdx(cat.antimicrobianos);
    var R = P.resistencia_por_antimicrobiano || {};
    var ids = Object.keys(R).filter(function (k) { return (R[k].n || 0) >= 5; });
    ids.sort(function (a, b) { return R[b].pct - R[a].pct || R[b].n - R[a].n || (a < b ? -1 : 1); });
    var excluidos = Object.keys(R).filter(function (k) { return (R[k].n || 0) > 0 && R[k].n < 5; });
    function nombre(id) { var n = atm[id] ? atm[id].nombre : id; return id === "sxt" ? "Trimetoprim-sulfa." : n.replace(/\s*\(.*\)$/, ""); }
    var canvas = h("canvas", { role: "img", "aria-label": "Barras: porcentaje de aislados resistentes por antimicrobiano. " + ids.map(function (k) { return nombre(k) + " " + R[k].pct + " %"; }).join(", ") });
    ui.chart(canvas, function () {
      return {
        type: "bar",
        data: { labels: ids.map(nombre), datasets: [{ label: "% resistentes", data: ids.map(function (k) { return R[k].pct; }), backgroundColor: "var(--serie-4)", borderRadius: 4, barThickness: 16 }] },
        options: {
          indexAxis: "y",
          layout: { padding: { right: 58 } },
          scales: { x: { beginAtZero: true, max: 100, ticks: { callback: function (v) { return v + " %"; }, maxTicksLimit: 5 } }, y: { grid: { display: false }, ticks: { color: "var(--text)", autoSkip: false } } },
          plugins: { tooltip: { callbacks: { label: function (c) { var k = ids[c.dataIndex]; return " " + R[k].pct + " % · " + R[k].R + " de " + R[k].n; } } } }
        },
        plugins: [pluginEtiquetas(ids.map(function (k) { return R[k].R + " de " + R[k].n; }))]
      };
    });
    var destacado = h("p", { class: "destacado" }, h("b", { class: "num" }, (P.aislados_mdr || 0) + " de " + (P.aislados_con_antibiograma || 0)), h("span", null, " aislados multirresistentes (criterio adaptado)"));
    return ui.tarjetaGrafica({
      id: "g6", titulo: "¿A qué antimicrobianos son resistentes?", subtitulo: sub + " · " + (P.aislados_con_antibiograma || 0) + " aislados con antibiograma · solo antimicrobianos con n ≥ 5",
      destacado: destacado,
      canvas: canvas, alto: Math.max(220, ids.length * 26 + 50),
      fuente: "Antibiogramas registrados (S/I/R del técnico; valores ilustrativos)",
      refs: ["REF-17", "REF-23"],
      comoSeLee: "Cada barra es el porcentaje de aislados con resultado R para ese antimicrobiano; al final, cuántos de cuántos. No cuentan las resistencias intrínsecas del taxón. Multirresistente: R o I en tres clases o más (Magiorakos 2012, adaptado y extrapolado)." + (excluidos.length ? " Se omiten por tener menos de 5 lecturas: " + excluidos.map(nombre).join(", ") + "." : ""),
      tabla: function () {
        return { cabeceras: ["Antimicrobiano", "R", "n", "% R"], numericas: [1, 2, 3], filas: Object.keys(R).sort(function (a, b) { return R[b].pct - R[a].pct; }).map(function (k) { return [atm[k] ? atm[k].nombre : k, String(R[k].R), String(R[k].n), R[k].pct + " %" + (R[k].n < 5 ? " (n < 5)" : "")]; }) };
      }
    });
  }

  /* ---------- pantalla ---------- */
  ING.rutas["inicio"] = function () {
    var db = ING.store && ING.store.db ? ING.store.db() : {};
    var desde = desdeISO();
    var P = ui.panelActual(desde);
    var pi = periodoInfo();
    var sub = pi.id === "todo" ? "Todo el periodo" : "Recibidos en los " + pi.sub;
    var cab = h("div", { class: "pantalla-cab panel-cab" }, h("h1", null, "Panel del circuito"));
    var recuadro = ui.recuadroObjetivo({
      clave: "panel", titulo: "Para qué sirve este panel", abierto: true,
      objetivo: "ver de un vistazo cuántas muestras entran, en qué paso del circuito está cada expediente y cuánto tardamos en emitir.",
      significa: "cada cifra se calcula en el momento a partir de los expedientes registrados en esta demo. Los datos son ficticios; las reglas y los catálogos que los clasifican citan referencias reales.",
      comoSeLee: "de arriba abajo, del total al detalle. Toca una cifra o una barra para ver sus expedientes. Cada gráfica dice de dónde sale y tiene una tabla con los números."
    });
    if (!P) {
      return h("div", { class: "panel" }, cab, recuadro, h("div", { class: "tarjeta vacio" }, h("p", null, "Calculando el panel…")));
    }
    var pos = positividad(db, desde, P);
    var A = contarAlertas(db, desde);
    if (!A.ok && !desde) { A = { critico: (P.alertas_pendientes_por_nivel || {}).critico || 0, revisar: P.badge_alertas || 0, info: (P.alertas_por_nivel || {}).info || 0 }; }
    return h("div", { class: "panel" },
      cab,
      recuadro,
      h("div", { class: "panel-barra" }, filtroPeriodo(), h("p", { class: "panel-periodo muted" }, pi.id === "todo" ? "Datos del 24-08 al 19-10-2026" : "Desde el " + fmt.fecha(desde) + " · la gráfica semanal muestra siempre las 9 semanas")),
      kpis(P),
      contadoresAlertas(A),
      h("div", { class: "panel-graficas" }, g1(P, sub), g2(P, sub), g3(P), g4(P, sub), g5(pos, sub), g6(P, sub)),
      h("p", { class: "pie" }, "Datos ficticios generados para la demo · 24-08 a 19-10-2026 · se actualiza con cada acción"));
  };
})();

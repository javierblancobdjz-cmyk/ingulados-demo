/* datos.js · Paquete A · catálogos, reglas, referencias, semilla, índices y formato es-ES.
   ING.initDatos({catalogos, reglas, semilla, referencias}); en el navegador se llama sola leyendo #datos-<x>. */
(function (root) {
  "use strict";
  var ING = root.ING = root.ING || {};

  function porId(lista) {
    var o = {};
    (lista || []).forEach(function (x) { if (x && x.id != null) o[x.id] = x; });
    return o;
  }

  function initDatos(d) {
    d = d || {};
    var cat = d.catalogos || {}, reg = d.reglas || {}, refs = d.referencias || [], sem = d.semilla || {};
    ING.cat = cat;
    ING.reglas = reg;
    ING.refs = refs;
    ING.semilla = sem;
    ING.idx = {
      analisis: porId(cat.analisis),
      dianas: porId(cat.dianas),
      taxones: porId(cat.taxones),
      antimicrobianos: porId(cat.antimicrobianos),
      clases: porId(cat.clases_antimicrobianas),
      especies: porId(cat.especies),
      procedencias: porId(cat.procedencias),
      procedenciaTipos: porId(cat.procedencia_tipos),
      remitentes: porId(cat.remitentes),
      tiposMuestra: porId(cat.tipos_muestra),
      motivos: porId(cat.motivos),
      signos: porId(cat.signos),
      patogenos: porId(cat.patogenos),
      roles: porId(cat.roles),
      conservaciones: porId(cat.conservaciones),
      tiemposToma: porId(cat.tiempos_toma),
      metodos: porId(cat.metodos_identificacion),
      medios: porId(cat.medios_comunicacion),
      plan: porId(cat.plan),
      reglas: porId(reg.reglas),
      niveles: porId(reg.niveles),
      capas: porId(reg.capas),
      refs: porId(refs)
    };
    /* análisis del catálogo por diana (pcr_*) */
    ING.idx.analisisPorDiana = {};
    (cat.analisis || []).forEach(function (a) { if (a.diana_id) ING.idx.analisisPorDiana[a.diana_id] = a.id; });
    return ING;
  }

  /* ------------------------------------------------------------ formato es-ES
     Las fechas ISO llevan su zona (+02:00): se muestran tal como están escritas (hora local de Madrid). */
  function partes(iso) {
    if (!iso) return null;
    var s = String(iso);
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (!m) return null;
    return { a: m[1], m: m[2], d: m[3], hh: m[4] || null, mm: m[5] || null };
  }
  function fecha(iso) { var p = partes(iso); return p ? p.d + "-" + p.m + "-" + p.a : ""; }
  function fechaCorta(iso) { var p = partes(iso); return p ? p.d + "-" + p.m : ""; }
  function hora(iso) { var p = partes(iso); return p && p.hh ? p.hh + ":" + p.mm : ""; }
  function fechaHora(iso) { var p = partes(iso); if (!p) return ""; return fecha(iso) + (p.hh ? " " + p.hh + ":" + p.mm : ""); }
  function fechaHoraCorta(iso) { var p = partes(iso); if (!p) return ""; return fechaCorta(iso) + (p.hh ? " " + p.hh + ":" + p.mm : ""); }

  function num(x, dec) {
    if (x == null || x === "" || isNaN(Number(x))) return "";
    var n = Number(x);
    var s = dec == null ? String(n) : n.toFixed(dec);
    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var ent = s.split(".")[0], fr = s.split(".")[1];
    if (ent.length > 4) ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + ent + (fr ? "," + fr : "");
  }
  function dias(x) {
    if (x == null || isNaN(Number(x))) return "—";
    var n = Number(x);
    return num(n, 1) + (n === 1 ? " día" : " días");
  }
  function ct(x) { return x == null ? "sin amplificación" : num(x, 1); }
  function huellaCorta(h) { return h ? String(h).slice(0, 8) : ""; }
  function pct(x) { return x == null ? "—" : num(x, 0) + " %"; }

  /* *cursiva* → <em>; el resto se escapa (textContent). En Node devuelve texto plano. */
  function md(texto) {
    var t = texto == null ? "" : String(texto);
    var trozos = t.split(/\*([^*]+)\*/g);
    if (typeof document === "undefined") return trozos.join("");
    var frag = document.createDocumentFragment();
    trozos.forEach(function (tr, i) {
      if (!tr) return;
      if (i % 2 === 1) { var em = document.createElement("em"); em.textContent = tr; frag.appendChild(em); }
      else frag.appendChild(document.createTextNode(tr));
    });
    return frag;
  }
  function plano(texto) { return texto == null ? "" : String(texto).replace(/\*([^*]+)\*/g, "$1"); }

  ING.fmt = {
    fecha: fecha, fechaHora: fechaHora, hora: hora, num: num, dias: dias, md: md,
    /* añadidos opcionales */
    fechaCorta: fechaCorta, fechaHoraCorta: fechaHoraCorta, ct: ct, huellaCorta: huellaCorta, pct: pct, plano: plano
  };
  ING.initDatos = initDatos;

  if (typeof document !== "undefined") {
    var leer = function (x) {
      var el = document.getElementById("datos-" + x);
      if (!el) return null;
      try { return JSON.parse(el.textContent); } catch (e) { return null; }
    };
    initDatos({ catalogos: leer("catalogos"), reglas: leer("reglas"), semilla: leer("semilla"), referencias: leer("referencias") });
  }
})(typeof window !== "undefined" ? window : globalThis);

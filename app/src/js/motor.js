/* motor.js · Paquete A · funciones puras de CONTRATO_DATOS.md §5-§7.
   `db` = vista combinada {expedientes:{}, muestras:{}, analisis:{}, aislados:{}, tandas:{}, informes:{},
   valoraciones:{}, comunicaciones:{}, eventos:{}} (mapas por id). NO se muta nunca: el motor memoriza
   resultados por identidad de `db` (WeakMap). Para una vista previa, crea un objeto nuevo
   (p. ej. Object.assign({}, db, {tandas: Object.assign({}, db.tandas, {[t.id]: t})})).
   Referencia en Python: 03_diseno_final/gen_semilla.py. */
(function (root) {
  "use strict";
  var ING = root.ING = root.ING || {};
  var COLS = ["expedientes", "muestras", "analisis", "aislados", "tandas", "informes", "valoraciones", "comunicaciones", "eventos"];

  function I() { return ING.idx; }
  function P() { return ING.cat.parametros; }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function porIdOrd(a, b) { return cmp(a.id, b.id); }
  function interseca(a, b) { for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) return true; return false; }
  function col(db, c) { return (db && db[c]) || {}; }
  function valores(m) { return Object.keys(m).map(function (k) { return m[k]; }); }

  /* ------------------------------------------------------------ caché por identidad de db */
  var CACHE = typeof WeakMap === "function" ? new WeakMap() : null;
  function cache(db) {
    if (!CACHE || !db || typeof db !== "object") return nuevaCache(db);
    var c = CACHE.get(db);
    if (!c) { c = nuevaCache(db); CACHE.set(db, c); }
    return c;
  }
  function nuevaCache(db) {
    var porExp = {}, aisPorAnalisis = {}, tandaDe = {};
    COLS.forEach(function (c) { porExp[c] = {}; });
    ["muestras", "analisis", "aislados", "informes", "valoraciones", "comunicaciones", "eventos"].forEach(function (c) {
      valores(col(db, c)).forEach(function (x) {
        var e = x.expediente_id;
        if (e == null) return;
        (porExp[c][e] = porExp[c][e] || []).push(x);
      });
      Object.keys(porExp[c]).forEach(function (e) { porExp[c][e].sort(porIdOrd); });
    });
    valores(col(db, "aislados")).forEach(function (x) { (aisPorAnalisis[x.analisis_id] = aisPorAnalisis[x.analisis_id] || []).push(x); });
    valores(col(db, "tandas")).forEach(function (t) {
      (t.pocillos || []).forEach(function (p) {
        var cur = tandaDe[p.analisis_id];
        if (!cur || cmp(t.creado_en, cur.creado_en) > 0 || (t.creado_en === cur.creado_en && cmp(t.id, cur.id) > 0)) tandaDe[p.analisis_id] = t;
      });
    });
    return { porExp: porExp, aisPorAnalisis: aisPorAnalisis, tandaDe: tandaDe, estA: {}, resP: {}, alertas: {}, estE: {}, huella: {}, det: {} };
  }
  function deExp(db, c, ref) { return cache(db).porExp[c][ref] || []; }

  function analisisObj(db, a) { return typeof a === "string" ? col(db, "analisis")[a] : a; }

  /* ------------------------------------------------------------ plan (catálogo) */
  function planMuestra(exp, muestra) {
    exp = exp || {};
    muestra = muestra || {};
    var especie = muestra.especie_id, tipo = muestra.tipo_muestra_id;
    var signos = exp.signos || [];
    var out = [], vistos = {};
    (ING.cat.plan || []).forEach(function (pl) {
      if (pl.tipos_muestra.indexOf(tipo) < 0) return;
      if (pl.especies && pl.especies.indexOf(especie) < 0) return;
      if (pl.motivos && pl.motivos.indexOf(exp.motivo_id) < 0) return;
      if (pl.excluir_motivos && pl.excluir_motivos.indexOf(exp.motivo_id) >= 0) return;
      if (pl.signos && !interseca(pl.signos, signos)) return;
      if (pl.sospechas && pl.sospechas.indexOf(exp.sospecha_id == null ? null : exp.sospecha_id) < 0) return;
      pl.analisis.forEach(function (a) {
        if (vistos[a]) return;
        vistos[a] = 1;
        out.push({ analisis_id: a, plan_id: pl.id });
      });
    });
    var orden = (ING.cat.analisis || []).map(function (a) { return a.id; });
    out.sort(function (x, y) { return orden.indexOf(x.analisis_id) - orden.indexOf(y.analisis_id); });
    return out;
  }

  /* ------------------------------------------------------------ tandas y PCR (§5.3) */
  function validezTanda(db, t) {
    if (typeof t === "string") t = col(db, "tandas")[t];
    if (!t) return null;
    var d = I().dianas[t.diana_id] || { cp_rango: [-Infinity, Infinity] };
    var c = t.controles || {};
    var reglas = [];
    if (c.ntc != null) reglas.push("PCR-01");
    if (c.cex != null) reglas.push("PCR-02");
    if (c.cp == null || c.cp < d.cp_rango[0] || c.cp > d.cp_rango[1]) reglas.push("PCR-03");
    return { valida: !reglas.length, reglas: reglas, estado: reglas.length ? "NO_VALIDA" : "VALIDA" };
  }

  function tandaVigente(db, aid) {
    if (aid && typeof aid === "object") aid = aid.id;
    return cache(db).tandaDe[aid] || null;
  }

  function pocilloDe(t, aid) {
    var ps = (t && t.pocillos) || [];
    for (var i = 0; i < ps.length; i++) if (ps[i].analisis_id === aid) return ps[i];
    return null;
  }

  /* resultadoPCR(db, a[, tanda]) — con `tanda` (opcional) se evalúa el pocillo de esa tanda provisional. */
  function resultadoPCR(db, a, tanda) {
    a = analisisObj(db, a);
    if (!a) return null;
    var c = cache(db);
    if (!tanda && Object.prototype.hasOwnProperty.call(c.resP, a.id)) return c.resP[a.id];
    var t = tanda || tandaVigente(db, a.id);
    var r = calcResultado(db, a, t);
    if (!tanda) c.resP[a.id] = r;
    return r;
  }
  function calcResultado(db, a, t) {
    if (!t) return null;
    var poc = pocilloDe(t, a.id);
    if (!poc) return null;
    if (!validezTanda(db, t).valida) return "repetir";
    var p = P().pcr, ct = poc.ct, ci = poc.ct_ci;
    if (ct != null && ct < p.positivo_lt) return "positivo";
    if (ct != null && ct < p.dudoso_lt) return "dudoso";
    if (ci == null || ci > p.ci_ref + p.ci_max_desvio) return "inhibido";
    return "negativo";
  }

  /* etiqueta de pantalla del resultado PCR (añadido) */
  function etiquetaPCR(db, a, tanda) {
    a = analisisObj(db, a);
    var r = resultadoPCR(db, a, tanda);
    if (r == null) return "Pendiente";
    var cat = I().analisis[a.catalogo_id] || {};
    var d = I().dianas[cat.diana_id] || {};
    if (r === "positivo" && d.etiqueta_positivo) return d.etiqueta_positivo;
    return P().etiquetas_resultado_pcr[r] || r;
  }

  /* ------------------------------------------------------------ estado de un análisis (§5.2) */
  function opcion(a) {
    if (!a || !a.resultado) return null;
    var cat = I().analisis[a.catalogo_id];
    var ops = (cat && cat.opciones_resultado) || [];
    for (var i = 0; i < ops.length; i++) if (ops[i].id === a.resultado.opcion_id) return ops[i];
    return null;
  }

  function estadoAnalisis(db, a) {
    a = analisisObj(db, a);
    if (!a) return null;
    var c = cache(db);
    if (c.estA[a.id]) return c.estA[a.id];
    var e = calcEstadoAnalisis(db, a);
    c.estA[a.id] = e;
    return e;
  }
  function calcEstadoAnalisis(db, a) {
    if (a.anulado) return "ANULADO";
    var cat = I().analisis[a.catalogo_id] || {};
    if (cat.tipo === "pcr") {
      var r = resultadoPCR(db, a);
      if (r == null) return "PENDIENTE";
      return r === "repetir" ? "REPETIR" : "RESULTADO";
    }
    if (!a.resultado) return "PENDIENTE";
    var o = opcion(a);
    if (o && o.requiere_aislado) {
      var propios = cache(db).aisPorAnalisis[a.id] || [];
      if (!propios.length) return "PENDIENTE";
      for (var i = 0; i < propios.length; i++) {
        var tx = I().taxones[propios[i].taxon_id];
        if (tx && tx.panel && !propios[i].antibiograma) return "PENDIENTE";
      }
    }
    return "RESULTADO";
  }

  /* qué le falta a un análisis micro en PENDIENTE (añadido): "resultado" | "aislado" | "antibiograma" | null */
  function pendienteDe(db, a) {
    a = analisisObj(db, a);
    if (!a || estadoAnalisis(db, a) !== "PENDIENTE") return null;
    if ((I().analisis[a.catalogo_id] || {}).tipo === "pcr" || !a.resultado) return "resultado";
    var propios = cache(db).aisPorAnalisis[a.id] || [];
    return propios.length ? "antibiograma" : "aislado";
  }

  /* ------------------------------------------------------------ activos, detecciones (§5.1, §5.4) */
  function rechazadas(db, ref) {
    var s = {};
    deExp(db, "muestras", ref).forEach(function (m) { if (m.rechazada) s[m.id] = 1; });
    return s;
  }
  function activos(db, ref) {
    var rech = rechazadas(db, ref);
    return deExp(db, "analisis", ref).filter(function (a) { return !a.anulado && !rech[a.muestra_id]; });
  }

  function detecciones(db, ref) {
    var c = cache(db);
    if (c.det[ref]) return c.det[ref];
    var out = [], rech = rechazadas(db, ref);
    activos(db, ref).forEach(function (a) {
      var cat = I().analisis[a.catalogo_id] || {};
      if (cat.tipo === "pcr") {
        if (estadoAnalisis(db, a) !== "RESULTADO") return;
        var r = resultadoPCR(db, a);
        var d = I().dianas[cat.diana_id] || {};
        if (d.patogeno_id && (r === "positivo" || r === "dudoso"))
          out.push({ patogeno_id: d.patogeno_id, resultado: r, fuente: a.id, detectado_en: tandaVigente(db, a.id).creado_en });
      } else {
        var o = opcion(a);
        if (o && o.patogeno_id) out.push({ patogeno_id: o.patogeno_id, resultado: "positivo", fuente: a.id, detectado_en: a.resultado_en });
      }
    });
    deExp(db, "aislados", ref).forEach(function (x) {
      if (rech[x.muestra_id]) return;
      var tx = I().taxones[x.taxon_id] || {};
      if (tx.patogeno_id) out.push({ patogeno_id: tx.patogeno_id, resultado: "positivo", fuente: x.id, detectado_en: x.creado_en });
    });
    c.det[ref] = out;
    return out;
  }

  function lectura(ais, atm) {
    if (!ais || !ais.antibiograma) return null;
    var ls = ais.antibiograma.lecturas || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].antimicrobiano_id === atm) return ls[i];
    return null;
  }

  function gruposDe(m) { var e = I().especies[m.especie_id]; return (e && e.grupos) || []; }

  /* ------------------------------------------------------------ alertas (§5.5, §7) */
  function alertas(db, ref) {
    var c = cache(db);
    if (c.alertas[ref]) return c.alertas[ref];
    var r = calcAlertas(db, ref);
    c.alertas[ref] = r;
    return r;
  }

  function calcAlertas(db, ref) {
    var exp = col(db, "expedientes")[ref];
    if (!exp) return [];
    var muestras = deExp(db, "muestras", ref).filter(function (m) { return !m.rechazada; });
    var mids = {};
    muestras.forEach(function (m) { mids[m.id] = 1; });
    var aislados = deExp(db, "aislados", ref).filter(function (x) { return mids[x.muestra_id]; });
    var acts = activos(db, ref);
    var cand = [], sanit = [];
    var esPcr = function (a) { return (I().analisis[a.catalogo_id] || {}).tipo === "pcr"; };

    (ING.reglas.reglas || []).forEach(function (r) {
      var cd = r.condicion || {}, t = cd.tipo;
      if (t === "recepcion_fuera_condiciones") {
        muestras.forEach(function (m) {
          if (cd.conservaciones.indexOf(m.conservacion) >= 0 || cd.tiempos.indexOf(m.tiempo_toma) >= 0 || (cd.envase_no_integro && !m.envase_integro))
            cand.push([r, r.id + "~" + m.id, null, null]);
        });
      } else if (t === "motivo_y_especie") {
        if (cd.motivos.indexOf(exp.motivo_id) >= 0 && muestras.some(function (m) { return interseca(gruposDe(m), cd.grupos_especie); }))
          cand.push([r, r.id + "~" + ref, null, null]);
      } else if (t === "pcr_resultado") {
        acts.forEach(function (a) {
          if (esPcr(a) && estadoAnalisis(db, a) === "RESULTADO" && cd.resultados.indexOf(resultadoPCR(db, a)) >= 0)
            cand.push([r, r.id + "~" + a.id, null, null]);
        });
      } else if (t === "mdr") {
        aislados.forEach(function (x) {
          if (!x.antibiograma) return;
          var intr = (I().taxones[x.taxon_id] || {}).intrinsecas || [];
          var clases = {};
          (x.antibiograma.lecturas || []).forEach(function (l) {
            if ((l.sir === "I" || l.sir === "R") && intr.indexOf(l.antimicrobiano_id) < 0) {
              var am = I().antimicrobianos[l.antimicrobiano_id];
              clases[am ? am.clase_id : l.antimicrobiano_id] = 1;
            }
          });
          if (Object.keys(clases).length >= cd.min_clases) cand.push([r, r.id + "~" + x.id, null, null]);
        });
      } else if (t === "resistencia_con_gen") {
        aislados.forEach(function (x) {
          var tx = I().taxones[x.taxon_id] || {};
          cd.casos.forEach(function (caso) {
            if (("panel" in caso && tx.panel !== caso.panel) || ("taxon_id" in caso && x.taxon_id !== caso.taxon_id)) return;
            var l = lectura(x, caso.antimicrobiano_id);
            if (l && l.sir === "R") cand.push([r, r.id + "~" + x.id + "~" + caso.antimicrobiano_id, null, null]);
          });
        });
      } else if (t === "intrinseca_sensible") {
        aislados.forEach(function (x) {
          ((I().taxones[x.taxon_id] || {}).intrinsecas || []).forEach(function (atm) {
            var l = lectura(x, atm);
            if (l && l.sir === "S") cand.push([r, r.id + "~" + x.id + "~" + atm, null, null]);
          });
        });
      } else if (t === "taxon_flag_en_muestra") {
        aislados.forEach(function (x) {
          var m = col(db, "muestras")[x.muestra_id];
          var fl = (I().taxones[x.taxon_id] || {}).flags || [];
          if (m && fl.indexOf(cd.flag) >= 0 && cd.tipos_muestra.indexOf(m.tipo_muestra_id) >= 0) cand.push([r, r.id + "~" + x.id, null, null]);
        });
      } else if (t === "gen_vs_fenotipo") {
        acts.forEach(function (a) {
          var cc = I().analisis[a.catalogo_id] || {};
          if (cc.tipo !== "pcr" || !a.aislado_id) return;
          var d = I().dianas[cc.diana_id] || {};
          if (!d.gen_resistencia || estadoAnalisis(db, a) !== "RESULTADO" || resultadoPCR(db, a) !== "positivo") return;
          var l = lectura(col(db, "aislados")[a.aislado_id], d.antimicrobiano_id);
          if (!l) return;
          if ((cd.modo === "concordante" && l.sir === "R") || (cd.modo === "discordante" && l.sir === "S")) cand.push([r, r.id + "~" + a.id, null, null]);
        });
      } else if (t === "patogeno_detectado") {
        detecciones(db, ref).forEach(function (det) {
          if (cd.patogenos.indexOf(det.patogeno_id) >= 0 && cd.resultados.indexOf(det.resultado) >= 0)
            sanit.push([r, r.id + "~" + ref + "~" + det.patogeno_id, det.patogeno_id, det.detectado_en]);
        });
      } else if (t === "sospecha_o_motivo") {
        var hit = exp.sospecha_id === cd.patogeno_id ||
          (cd.motivos.indexOf(exp.motivo_id) >= 0 && muestras.some(function (m) { return interseca(gruposDe(m), cd.grupos_especie); }));
        if (hit) sanit.push([r, r.id + "~" + ref + "~" + cd.patogeno_id, cd.patogeno_id, exp.recibido_en]);
      }
    });

    /* deduplicación sanitaria: una por (expediente, patógeno) */
    var best = {}, ordenPat = [];
    var niv = function (r) { return (I().niveles[r.nivel] || {}).orden || 0; };
    sanit.forEach(function (s) {
      var cur = best[s[2]];
      if (!cur) { best[s[2]] = s; ordenPat.push(s[2]); return; }
      var ro = niv(s[0]), rc = niv(cur[0]);
      if (ro > rc || (ro === rc && s[0].id < cur[0].id)) best[s[2]] = s;
      else if (ro === rc && s[0].id === cur[0].id && s[3] < cur[3]) best[s[2]] = s;
    });
    ordenPat.forEach(function (p) { cand.push(best[p]); });

    var vistos = {}, out = [];
    var vals = col(db, "valoraciones"), coms = col(db, "comunicaciones");
    cand.forEach(function (x) {
      var r = x[0], k = x[1], pid = x[2], when = x[3];
      if (vistos[k]) return;
      vistos[k] = 1;
      var req = (I().niveles[r.nivel] || {}).requiere_valoracion;
      var estado = req ? (vals[k] ? "valorada" : "pendiente") : "informativa";
      var comPend = !!(r.requiere_comunicacion && !coms["COM~" + ref + "~" + pid]);
      out.push({
        clave: k, regla_id: r.id, nivel: r.nivel, capa: r.capa, estado: estado, patogeno_id: pid,
        requiere_comunicacion: !!r.requiere_comunicacion, comunicacion_pendiente: comPend, detectado_en: when,
        expediente_id: ref, entidad_id: k.split("~")[1]
      });
    });
    out.sort(function (a, b) { return cmp(a.clave, b.clave); });
    return out;
  }

  function alertasTodas(db) {
    var out = [];
    Object.keys(col(db, "expedientes")).sort().forEach(function (ref) { out = out.concat(alertas(db, ref)); });
    out.sort(function (a, b) { return cmp(a.clave, b.clave); });
    return out;
  }

  /* tandas no válidas con sus análisis aún en "Repetir" (añadido; sección de #/alertas y bandeja molecular) */
  function tandasNoValidas(db) {
    return valores(col(db, "tandas")).map(function (t) { return { tanda: t, validez: validezTanda(db, t) }; })
      .filter(function (x) { return !x.validez.valida; })
      .sort(function (a, b) { return cmp(b.tanda.creado_en, a.tanda.creado_en) || cmp(b.tanda.id, a.tanda.id); })
      .map(function (x) {
        var aids = (x.tanda.pocillos || []).map(function (p) { return p.analisis_id; });
        var repetir = aids.filter(function (aid) { var a = col(db, "analisis")[aid]; return a && !a.anulado && estadoAnalisis(db, a) === "REPETIR" && tandaVigente(db, aid) === x.tanda; });
        var repetidaEn = {};
        aids.forEach(function (aid) { var tv = tandaVigente(db, aid); if (tv && tv !== x.tanda) repetidaEn[aid] = tv.id; });
        return { tanda: x.tanda, reglas: x.validez.reglas, analisis: aids, repetir: repetir, repetida_en: repetidaEn };
      });
  }

  /* ------------------------------------------------------------ muestra, expediente, progreso (§5.6) */
  function estadoMuestra(db, m) {
    if (typeof m === "string") m = col(db, "muestras")[m];
    if (!m) return null;
    if (m.rechazada) return "RECHAZADA";
    var r = I().reglas["REC-01"], cd = (r && r.condicion) || { conservaciones: [], tiempos: [] };
    if (cd.conservaciones.indexOf(m.conservacion) >= 0 || cd.tiempos.indexOf(m.tiempo_toma) >= 0 || (cd.envase_no_integro && !m.envase_integro))
      return "ACEPTADA_CON_DESVIACION";
    return "ACEPTADA";
  }

  function informesDe(db, ref) {
    return deExp(db, "informes", ref).slice().sort(function (a, b) { return a.version - b.version; });
  }

  function estadoExpediente(db, ref) {
    var c = cache(db);
    if (c.estE[ref]) return c.estE[ref];
    var e = calcEstadoExp(db, ref);
    c.estE[ref] = e;
    return e;
  }
  function calcEstadoExp(db, ref) {
    if (!col(db, "expedientes")[ref]) return null;
    var ms = deExp(db, "muestras", ref);
    if (ms.length && ms.every(function (m) { return m.rechazada; })) return "BLOQUEADO";
    var acts = activos(db, ref);
    var infs = informesDe(db, ref);
    if (infs.length && infs[infs.length - 1].huella === huella(db, ref)) return "EMITIDO";
    var iniciado = acts.some(function (a) { return a.resultado || tandaVigente(db, a.id); }) || deExp(db, "aislados", ref).length > 0;
    if (!acts.length || !iniciado) return "RECIBIDO";
    if (acts.some(function (a) { var s = estadoAnalisis(db, a); return s === "PENDIENTE" || s === "REPETIR"; })) return "EN_ANALISIS";
    if (alertas(db, ref).some(function (a) { return a.estado === "pendiente" || a.comunicacion_pendiente; })) return "PENDIENTE_VALORACION";
    return "LISTO_PARA_VALIDAR";
  }

  function progreso(db, ref) {
    var out = { micro: { x: 0, n: 0 }, molecular: { x: 0, n: 0 } };
    activos(db, ref).forEach(function (a) {
      var d = out[a.departamento];
      if (!d) return;
      d.n++;
      if (estadoAnalisis(db, a) === "RESULTADO") d.x++;
    });
    return out;
  }

  /* ------------------------------------------------------------ huella (§6) */
  function fnum(v) {
    if (v == null) return "";
    var f = Number(v);
    return Number.isInteger(f) ? String(f) : String(f);
  }
  function fct(v) { return v == null ? "" : Number(v).toFixed(1); }

  function snapshot(db, ref) {
    var e = col(db, "expedientes")[ref];
    if (!e) return null;
    var cab = [e.id, e.procedencia_id, e.remitente_id, e.ref_remitente || "", e.motivo_id, e.fecha_toma, e.recibido_en,
      e.sospecha_id || "", (e.signos || []).join(",")];
    var mus = deExp(db, "muestras", ref).map(function (m) {
      return [m.id, m.especie_id, m.tipo_muestra_id, m.identificacion, m.conservacion, m.tiempo_toma, m.envase_integro ? "1" : "0", m.rechazada ? "1" : "0"];
    });
    var res = [];
    deExp(db, "analisis", ref).forEach(function (a) {
      if (a.anulado) return;
      if ((I().analisis[a.catalogo_id] || {}).tipo === "pcr") {
        var t = tandaVigente(db, a.id), r = resultadoPCR(db, a);
        if (r == null) { res.push([a.id, "pendiente"]); return; }
        var poc = pocilloDe(t, a.id);
        res.push([a.id, r + "|" + fct(poc.ct) + "|" + t.id]);
      } else {
        res.push([a.id, a.resultado ? a.resultado.opcion_id : "pendiente"]);
      }
    });
    var ais = deExp(db, "aislados", ref).map(function (x) {
      var ab = ((x.antibiograma && x.antibiograma.lecturas) || []).map(function (l) { return l.antimicrobiano_id + ":" + l.sir + ":" + fnum(l.valor); }).join(";");
      return [x.id, x.taxon_id, x.metodo_id, ab];
    });
    var ordLista = function (a, b) {
      for (var i = 0; i < Math.min(a.length, b.length); i++) { var c = cmp(a[i], b[i]); if (c) return c; }
      return a.length - b.length;
    };
    var val = deExp(db, "valoraciones", ref).map(function (v) { return [v.id, v.comentario]; }).sort(ordLista);
    var com = deExp(db, "comunicaciones", ref).map(function (c) { return [c.id, c.destinatario, c.comunicado_en]; }).sort(ordLista);
    return { cab: cab, muestras: mus, resultados: res, aislados: ais, valoraciones: val, comunicaciones: com };
  }

  function canon(obj) {
    if (obj === null || obj === undefined) return "null";
    if (typeof obj === "number") return isFinite(obj) ? JSON.stringify(obj) : "null";
    if (typeof obj !== "object") return JSON.stringify(obj);
    if (Array.isArray(obj)) return "[" + obj.map(canon).join(",") + "]";
    return "{" + Object.keys(obj).filter(function (k) { return obj[k] !== undefined; }).sort().map(function (k) {
      return JSON.stringify(k) + ":" + canon(obj[k]);
    }).join(",") + "}";
  }

  function huella(db, ref) {
    var c = cache(db);
    if (c.huella[ref]) return c.huella[ref];
    var s = snapshot(db, ref);
    if (!s) return null;
    var h = ING.sha256(canon(s));
    c.huella[ref] = h;
    return h;
  }

  /* ------------------------------------------------------------ redondeo como Python round() (mitad al par, valor exacto) */
  function pyRound(x, nd) {
    if (x == null || !isFinite(x)) return x;
    nd = nd || 0;
    var neg = x < 0, s = Math.abs(x).toFixed(100);
    var p = s.indexOf("."), ent = s.slice(0, p), fr = s.slice(p + 1);
    var keep = fr.slice(0, nd), resto = fr.slice(nd);
    var digs = (ent + keep).split("").map(Number);
    var mitad = "5" + new Array(resto.length).join("0");
    var subir;
    if (resto > mitad) subir = true;
    else if (resto < mitad) subir = false;
    else subir = digs[digs.length - 1] % 2 === 1;
    if (subir) {
      var i = digs.length - 1;
      while (i >= 0) { digs[i]++; if (digs[i] < 10) break; digs[i] = 0; i--; }
      if (i < 0) digs.unshift(1);
    }
    var str = digs.join("");
    var entS = str.slice(0, str.length - nd) || "0", frS = str.slice(str.length - nd);
    var v = Number(entS + (nd ? "." + frS : ""));
    return neg ? -v : v;
  }

  /* ------------------------------------------------------------ panel (ESPEC §6) */
  function lunesDe(fechaStr) {
    var d = new Date(fechaStr + "T00:00:00Z");
    var wd = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - wd * 86400000).toISOString().slice(0, 10);
  }
  function contar(o, k) { o[k] = (o[k] || 0) + 1; }

  function positividadPorDiana(db, desde) {
    var exps = col(db, "expedientes"), out = {};
    valores(col(db, "analisis")).forEach(function (a) {
      var cat = I().analisis[a.catalogo_id] || {};
      if (cat.tipo !== "pcr" || a.anulado) return;
      var e = exps[a.expediente_id];
      if (desde && (!e || e.recibido_en < desde)) return;
      var r = resultadoPCR(db, a);
      if (!r || r === "repetir") return;
      out[cat.diana_id] = out[cat.diana_id] || {};
      contar(out[cat.diana_id], r);
    });
    var ord = {};
    Object.keys(out).sort().forEach(function (k) { ord[k] = out[k]; });
    return ord;
  }

  function panel(db, desde) {
    desde = desde || null;
    var exAll = col(db, "expedientes");
    var refs = Object.keys(exAll).filter(function (r) { return !desde || exAll[r].recibido_en >= desde; });
    var enFiltro = {};
    refs.forEach(function (r) { enFiltro[r] = 1; });
    var est = {};
    refs.forEach(function (r) { est[r] = estadoExpediente(db, r); });
    var musAll = valores(col(db, "muestras"));
    var mus = musAll.filter(function (m) { return enFiltro[m.expediente_id]; });

    var tats = [];
    valores(col(db, "informes")).forEach(function (i) {
      if (i.version !== 1 || !enFiltro[i.expediente_id]) return;
      var a = Date.parse(exAll[i.expediente_id].recibido_en), b = Date.parse(i.emitido_en);
      tats.push((b - a) / 86400000);
    });
    tats.sort(function (a, b) { return a - b; });
    var n = tats.length;
    var med = n ? (n % 2 ? tats[(n - 1) / 2] : (tats[n / 2 - 1] + tats[n / 2]) / 2) : null;
    var p90 = n ? tats[Math.ceil(0.9 * n) - 1] : null;
    var obj = P().objetivo_tat_dias;
    var tramos = { "<3": 0, "3-5": 0, "5-7": 0, ">7": 0 };
    tats.forEach(function (t) { tramos[t < 3 ? "<3" : t < 5 ? "3-5" : t <= 7 ? "5-7" : ">7"]++; });

    var semanas = {};
    var l0 = new Date(P().inicio_datos + "T00:00:00Z").getTime();
    for (var k = 0; k < 9; k++) semanas[new Date(l0 + k * 7 * 86400000).toISOString().slice(0, 10)] = 0;
    musAll.forEach(function (m) {
      var e = exAll[m.expediente_id];
      if (!e) return;
      contar(semanas, lunesDe(e.recibido_en.slice(0, 10)));
    });
    var semOrd = {};
    Object.keys(semanas).sort().forEach(function (s) { semOrd[s] = semanas[s]; });

    var tipoProc = {};
    mus.forEach(function (m) { var p = I().procedencias[exAll[m.expediente_id].procedencia_id]; contar(tipoProc, p ? p.tipo : "otro"); });

    var rc = {}, tot = {}, mdr = 0, conAb = 0, taxa = {};
    var muestrasM = col(db, "muestras");
    valores(col(db, "aislados")).forEach(function (x) {
      if (!enFiltro[x.expediente_id]) return;
      contar(taxa, x.taxon_id);
      var m = muestrasM[x.muestra_id];
      if (!x.antibiograma || (m && m.rechazada)) return;
      conAb++;
      var intr = (I().taxones[x.taxon_id] || {}).intrinsecas || [], cl = {};
      (x.antibiograma.lecturas || []).forEach(function (l) {
        if (intr.indexOf(l.antimicrobiano_id) >= 0) return;
        contar(tot, l.antimicrobiano_id);
        if (l.sir === "R") contar(rc, l.antimicrobiano_id);
        if (l.sir === "I" || l.sir === "R") { var am = I().antimicrobianos[l.antimicrobiano_id]; cl[am ? am.clase_id : l.antimicrobiano_id] = 1; }
      });
      var minC = ((I().reglas["MIC-01"] || {}).condicion || {}).min_clases || 3;
      if (Object.keys(cl).length >= minC) mdr++;
    });
    var resis = {};
    Object.keys(tot).sort().forEach(function (k2) { resis[k2] = { R: rc[k2] || 0, n: tot[k2], pct: pyRound(100 * (rc[k2] || 0) / tot[k2], 0) }; });
    var taxaOrd = {};
    Object.keys(taxa).sort(function (a, b) { return taxa[b] - taxa[a] || cmp(a, b); }).forEach(function (t) { taxaOrd[t] = taxa[t]; });

    var al = [];
    refs.forEach(function (r) { al = al.concat(alertas(db, r)); });
    var porNivel = {};
    al.forEach(function (a) { contar(porNivel, a.nivel); });

    var tandas = valores(col(db, "tandas")).filter(function (t) { return !desde || t.fecha >= desde.slice(0, 10); });
    var vt = tandas.map(function (t) { return validezTanda(db, t); });
    var nvRegla = {};
    vt.forEach(function (v) { v.reglas.forEach(function (r) { contar(nvRegla, r); }); });

    var estados = {};
    refs.forEach(function (r) { contar(estados, est[r]); });

    /* insignias y bandejas: siempre sobre todo (no dependen del filtro de periodo) */
    var todos = Object.keys(exAll);
    var alTodas = desde ? alertasTodas(db) : al;
    var bandejaMicro = 0, bandejaMol = 0, listos = 0;
    todos.forEach(function (r) {
      if (estadoExpediente(db, r) === "LISTO_PARA_VALIDAR") listos++;
      activos(db, r).forEach(function (a) {
        var s = estadoAnalisis(db, a);
        if (a.departamento === "micro" && s === "PENDIENTE") bandejaMicro++;
        if (a.departamento === "molecular" && (s === "PENDIENTE" || s === "REPETIR")) bandejaMol++;
      });
    });

    return {
      kpi_muestras: mus.length,
      kpi_en_curso: refs.filter(function (r) { return est[r] !== "EMITIDO" && est[r] !== "BLOQUEADO"; }).length,
      kpi_por_validar: refs.filter(function (r) { return est[r] === "LISTO_PARA_VALIDAR" || est[r] === "PENDIENTE_VALORACION"; }).length,
      kpi_tat_mediana_dias: med != null ? pyRound(med, 1) : null,
      kpi_tat_p90_dias: p90 != null ? pyRound(p90, 1) : null,
      tat_n: n,
      tat_dentro_objetivo_pct: n ? pyRound(100 * tats.filter(function (t) { return t <= obj; }).length / n, 0) : null,
      tat_tramos: tramos,
      estados: estados,
      muestras_por_semana: semOrd,
      muestras_por_tipo_procedencia: tipoProc,
      aislados_con_antibiograma: conAb,
      aislados_mdr: mdr,
      resistencia_por_antimicrobiano: resis,
      aislados_por_taxon: taxaOrd,
      tandas_total: vt.length,
      tandas_validas: vt.filter(function (v) { return v.valida; }).length,
      tandas_no_validas_por_regla: nvRegla,
      alertas_por_nivel: porNivel,
      muestras_con_desviacion: al.filter(function (a) { return a.regla_id === "REC-01"; }).length,
      muestras_no_rechazadas: mus.filter(function (m) { return !m.rechazada; }).length,
      badge_alertas: alTodas.filter(function (a) { return a.estado === "pendiente" || a.comunicacion_pendiente; }).length,
      bandeja_micro: bandejaMicro,
      bandeja_molecular: bandejaMol,
      badge_informes: listos
    };
  }

  /* ------------------------------------------------------------ bandejas */
  function ordSolicitud(a, b) { return cmp(a.solicitado_en, b.solicitado_en) || cmp(a.id, b.id); }

  /* análisis micro activos en PENDIENTE, del más antiguo al más reciente → [analisis] */
  function bandejaMicro(db) {
    var out = [];
    Object.keys(col(db, "expedientes")).forEach(function (r) {
      activos(db, r).forEach(function (a) { if (a.departamento === "micro" && estadoAnalisis(db, a) === "PENDIENTE") out.push(a); });
    });
    return out.sort(ordSolicitud);
  }

  /* análisis moleculares activos en PENDIENTE o REPETIR, del más antiguo al más reciente → [analisis] */
  function bandejaMolecular(db) {
    var out = [];
    Object.keys(col(db, "expedientes")).forEach(function (r) {
      activos(db, r).forEach(function (a) {
        var s = estadoAnalisis(db, a);
        if (a.departamento === "molecular" && (s === "PENDIENTE" || s === "REPETIR")) out.push(a);
      });
    });
    return out.sort(ordSolicitud);
  }

  /* añadido: la bandeja molecular agrupada por diana, en el orden del catálogo de dianas
     → [{diana_id, pendientes:[analisis], repetir:[analisis]}] */
  function bandejaMolecularPorDiana(db) {
    var g = {};
    bandejaMolecular(db).forEach(function (a) {
      var d = (I().analisis[a.catalogo_id] || {}).diana_id;
      g[d] = g[d] || { diana_id: d, pendientes: [], repetir: [] };
      (estadoAnalisis(db, a) === "REPETIR" ? g[d].repetir : g[d].pendientes).push(a);
    });
    return (ING.cat.dianas || []).map(function (d) { return g[d.id]; }).filter(Boolean);
  }

  /* ------------------------------------------------------------ identificadores */
  function siguienteRef(db) {
    var mx = 300;
    Object.keys(col(db, "expedientes")).forEach(function (k) { var m = /^ING-26-(\d{4})$/.exec(k); if (m) mx = Math.max(mx, +m[1]); });
    return "ING-26-" + ("0000" + (mx + 1)).slice(-4);
  }
  function siguienteTanda(db) {
    var mx = 40;
    Object.keys(col(db, "tandas")).forEach(function (k) { var m = /^T-2026-(\d{3,})$/.exec(k); if (m) mx = Math.max(mx, +m[1]); });
    return "T-2026-" + ("000" + (mx + 1)).slice(-3);
  }
  function siguienteInforme(db, ref) { return "INF-" + ref + "-v" + (deExp(db, "informes", ref).length + 1); }

  ING.motor = {
    planMuestra: planMuestra, estadoAnalisis: estadoAnalisis, tandaVigente: tandaVigente, validezTanda: validezTanda,
    resultadoPCR: resultadoPCR, detecciones: detecciones, alertas: alertas, alertasTodas: alertasTodas,
    estadoMuestra: estadoMuestra, estadoExpediente: estadoExpediente, progreso: progreso, snapshot: snapshot,
    canon: canon, huella: huella, panel: panel, bandejaMicro: bandejaMicro, bandejaMolecular: bandejaMolecular,
    siguienteRef: siguienteRef, siguienteTanda: siguienteTanda,
    /* añadidos (opcionales) */
    activos: activos, deExp: deExp, informesDe: informesDe, opcion: opcion, lectura: lectura, etiquetaPCR: etiquetaPCR,
    pendienteDe: pendienteDe, tandasNoValidas: tandasNoValidas, positividadPorDiana: positividadPorDiana,
    bandejaMolecularPorDiana: bandejaMolecularPorDiana, siguienteInforme: siguienteInforme, pyRound: pyRound
  };
})(typeof window !== "undefined" ? window : globalThis);

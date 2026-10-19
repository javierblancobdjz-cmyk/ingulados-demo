/* ui-informes.js · Paquete C · #/informes (ESPEC §3.8), diálogo de emisión (CONTRATO §5.7, §6) e #/informe/<id> (§3.9).
   El informe se pinta desde el snapshot guardado (lo que se validó); lo que no entra en la huella se lee de la base. */
(function (root) {
  "use strict";
  var ING = root.ING = root.ING || {};
  ING.ui = ING.ui || {};
  ING.rutas = ING.rutas || {};
  var cx = ING.cx;
  var h = cx.h;

  var TXT_RECUADRO = {
    objetivo: "que nada salga sin la autorización de una persona.",
    significa: "solo se puede emitir un expediente con todo analizado y todas las alertas valoradas. La autorización queda ligada a una versión y a su huella.",
    comoSeLee: "“Listos para validar” se pueden emitir ya; “Pendientes de valoración” esperan a que alguien revise sus alertas."
  };
  function mayus(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function recuadro() {
    if (ING.ui.recuadroObjetivo) {
      try {
        return ING.ui.recuadroObjetivo({ clave: "informes", titulo: "Para qué sirve esta pantalla", abierto: false,
          objetivo: mayus(TXT_RECUADRO.objetivo), significa: mayus(TXT_RECUADRO.significa), comoSeLee: TXT_RECUADRO.comoSeLee });
      } catch (e) { /* sigue */ }
    }
    return h("details", { class: "cx-recuadro", "data-testid": "recuadro-objetivo" }, h("summary", { text: "Para qué sirve esta pantalla" }),
      h("p", null, h("strong", { text: "Objetivo: " }), mayus(TXT_RECUADRO.objetivo)),
      h("p", null, h("strong", { text: "Qué significa: " }), mayus(TXT_RECUADRO.significa)),
      h("p", null, h("strong", { text: "Cómo se lee: " }), TXT_RECUADRO.comoSeLee));
  }

  function ahora() { try { if (ING.store.ahora) return ING.store.ahora(); } catch (e) { /* sigue */ } return cx.ahora(); }
  function plural(n, s, p) { return n + " " + (n === 1 ? s : p); }

  /* ================================================================ #/informes */
  var verTodos = false;
  function vistaInformes() {
    var db = cx.db();
    var grupos = { LISTO_PARA_VALIDAR: [], PENDIENTE_VALORACION: [], EMITIDO: [], EN_ANALISIS: [], RECIBIDO: [], BLOQUEADO: [] };
    Object.keys(db.expedientes).forEach(function (ref) { var e = cx.estado(db, ref); (grupos[e] = grupos[e] || []).push(ref); });
    function porRecepcion(a, b) { var x = db.expedientes[a].recibido_en, y = db.expedientes[b].recibido_en; return x < y ? -1 : x > y ? 1 : (a < b ? -1 : 1); }
    var sec = h("section", { class: "cx-informes", "aria-labelledby": "cx-inf-titulo" });
    sec.appendChild(h("h1", { id: "cx-inf-titulo", class: "cx-h1", text: "Informes" }));
    sec.appendChild(recuadro());
    sec.appendChild(h("p", { class: "cx-no-emitibles", "data-testid": "no-emitibles", text: "No se pueden emitir: en análisis (" + grupos.EN_ANALISIS.length +
      "), recibidos (" + grupos.RECIBIDO.length + "), bloqueados (" + grupos.BLOQUEADO.length + ")" }));

    /* 1 · Listos para validar */
    var listos = grupos.LISTO_PARA_VALIDAR.sort(porRecepcion);
    var g1 = h("section", { class: "cx-grupo", "data-testid": "grupo-listos", "data-n": String(listos.length) },
      h("h2", { class: "cx-h2" }, cx.icon("file-check"), h("span", { text: " Listos para validar (" + listos.length + ")" })));
    if (!listos.length) g1.appendChild(h("p", { class: "cx-vacio", text: "Ningún expediente listo para validar ahora mismo." }));
    var ul1 = h("ul", { class: "cx-rejilla" });
    listos.forEach(function (ref) {
      var infs = cx.informes(db, ref), v = infs.length + 1;
      ul1.appendChild(h("li", null, h("div", { class: "cx-tarjeta cx-tarjeta-inf", "data-testid": "tarjeta-listo", "data-ref": ref },
        h("div", { class: "cx-tx-cab" }, h("a", { href: "#/exp/" + ref, class: "cx-ref", text: ref }),
          h("span", { class: "cx-etq-version", text: v > 1 ? "v" + v + " · sustituye a v" + (v - 1) : "v1" })),
        h("p", { class: "cx-tx-sub", text: resumenExp(db, ref) }),
        h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande cx-ancho", "data-testid": "btn-emitir", "data-ref": ref,
          onclick: function () { abrirEmision(ref); } }, cx.icon("file-check"), h("span", { text: "Validar y emitir" })))));
    });
    g1.appendChild(ul1);
    sec.appendChild(g1);

    /* 2 · Pendientes de valoración */
    var pend = grupos.PENDIENTE_VALORACION.sort(porRecepcion);
    var g2 = h("section", { class: "cx-grupo", "data-testid": "grupo-pendientes", "data-n": String(pend.length) },
      h("h2", { class: "cx-h2" }, cx.icon("triangle-alert"), h("span", { text: " Pendientes de valoración (" + pend.length + ")" })));
    var ul2 = h("ul", { class: "cx-rejilla" });
    pend.forEach(function (ref) {
      var p = cx.pendientes(db, ref);
      var motivo = [p.alertas ? plural(p.alertas, "alerta por valorar", "alertas por valorar") : null,
        p.comunicaciones ? plural(p.comunicaciones, "comunicación", "comunicaciones") : null].filter(Boolean).join(" · ");
      ul2.appendChild(h("li", null, h("div", { class: "cx-tarjeta cx-tarjeta-inf", "data-testid": "tarjeta-pendiente", "data-ref": ref },
        h("div", { class: "cx-tx-cab" }, h("a", { href: "#/exp/" + ref, class: "cx-ref", text: ref }), cx.chipEstado("PENDIENTE_VALORACION")),
        h("p", { class: "cx-tx-linea", text: motivo }),
        h("a", { href: "#/exp/" + ref + "/alertas", class: "cx-btn cx-btn-grande cx-ancho", "data-testid": "btn-ver-alertas", "data-ref": ref },
          cx.icon("triangle-alert"), h("span", { text: "Ver alertas" })))));
    });
    if (!pend.length) g2.appendChild(h("p", { class: "cx-vacio", text: "No hay expedientes esperando valoración." }));
    g2.appendChild(ul2);
    sec.appendChild(g2);

    /* 3 · Emitidos */
    var emit = grupos.EMITIDO.map(function (ref) { var i = cx.informes(db, ref); return i[i.length - 1]; }).filter(Boolean)
      .sort(function (a, b) { return a.emitido_en < b.emitido_en ? 1 : a.emitido_en > b.emitido_en ? -1 : (a.id < b.id ? 1 : -1); });
    var g3 = h("section", { class: "cx-grupo", "data-testid": "grupo-emitidos", "data-n": String(emit.length) },
      h("h2", { class: "cx-h2" }, cx.icon("circle-check"), h("span", { text: " Emitidos (" + emit.length + ")" })));
    var ul3 = h("ul", { class: "cx-lista-emitidos" });
    (verTodos ? emit : emit.slice(0, 10)).forEach(function (inf) {
      ul3.appendChild(h("li", null, h("a", { href: "#/informe/" + inf.id, class: "cx-fila-emitido", "data-testid": "fila-emitido", "data-informe": inf.id },
        h("span", { class: "cx-ref", text: inf.expediente_id }),
        h("span", { class: "cx-etq-version", text: "v" + inf.version }),
        h("span", { class: "cx-tx-sub", text: cx.fechaHoraCorta(inf.emitido_en) }),
        h("span", { class: "cx-mono cx-huella-corta", text: String(inf.huella).slice(0, 8) }))));
    });
    g3.appendChild(ul3);
    if (emit.length > 10) g3.appendChild(h("button", { type: "button", class: "cx-btn cx-btn-texto", "data-testid": "btn-ver-todos",
      text: verTodos ? "Ver solo los 10 últimos" : "Ver todos (" + emit.length + ")", onclick: function () { verTodos = !verTodos; if (ING.app && ING.app.render) ING.app.render(); } }));
    sec.appendChild(g3);
    return sec;
  }
  function resumenExp(db, ref) {
    var e = db.expedientes[ref], p = ING.idx.procedencias[e.procedencia_id] || {};
    var ms = cx.deExp(db, "muestras", ref);
    return (p.nombre || "") + " · " + plural(ms.length, "muestra", "muestras") + " · recibido " + cx.fechaHoraCorta(e.recibido_en);
  }

  /* ================================================================ diálogo de emisión */
  /* §5.7: ¿el rol actual registró algún resultado, aislado, antibiograma o tanda del expediente? */
  function rolRegistroResultados(db, ref, rol) {
    var si = cx.deExp(db, "analisis", ref).some(function (a) { return !a.anulado && a.resultado_por === rol; });
    si = si || cx.deExp(db, "aislados", ref).some(function (x) { return x.creado_por === rol || (x.antibiograma && x.antibiograma.registrado_por === rol); });
    if (!si) {
      var aids = {};
      cx.deExp(db, "analisis", ref).forEach(function (a) { aids[a.id] = 1; });
      si = Object.keys(db.tandas || {}).some(function (k) {
        var t = db.tandas[k];
        return t.creado_por === rol && (t.pocillos || []).some(function (p) { return aids[p.analisis_id]; });
      });
    }
    return si;
  }
  function ultimoMotivoCorreccion(db, ref) {
    var evs = cx.deExp(db, "eventos", ref).filter(function (e) { return e.tipo === "DATO_CORREGIDO" && e.motivo; })
      .sort(function (a, b) { return (a.ts + a.id) < (b.ts + b.id) ? -1 : 1; });
    return evs.length ? evs[evs.length - 1].motivo : "";
  }

  var emitiendo = false;
  function abrirEmision(ref) {
    var db = cx.db();
    if (cx.estado(db, ref) !== "LISTO_PARA_VALIDAR") { cx.toast("Este expediente no está listo para validar."); return; }
    var infs = cx.informes(db, ref), v = infs.length + 1, id = "INF-" + ref + "-v" + v;
    var rol = cx.rol();
    var huella = ING.motor.huella(db, ref);
    var aviso = rolRegistroResultados(db, ref, rol);
    var cuerpo = h("div", { class: "cx-form-hoja cx-emision" });
    cuerpo.appendChild(h("p", { text: "Quedará registrado a nombre de " + cx.nombreRol(rol) + ", con la huella " + huella.slice(0, 4) + "…. " +
      "Si después cambia algún dato, esta validación caduca y habrá que emitir una nueva versión." }));
    cuerpo.appendChild(h("p", { class: "cx-huella-dialogo" }, h("span", { class: "cx-ayuda", text: "Huella SHA-256 " }), h("span", { class: "cx-mono", text: huella.slice(0, 8) })));
    if (aviso) {
      cuerpo.appendChild(h("div", { class: "cx-aviso cx-aviso-revisar", role: "note", "data-testid": "aviso-revisor" },
        cx.icon("users-round"),
        h("div", null, h("p", { text: "Has registrado resultados de este expediente. Lo recomendable es que valide otra persona (ISO/IEC 17025, 7.8.1.1)." }),
          h("p", { class: "cx-ayuda", text: "Es un aviso: puedes emitir igualmente y quedará indicado en el informe." }), cx.refs(["REF-01"]))));
    }
    var motivo = null, err = null;
    if (v > 1) {
      motivo = h("input", { type: "text", class: "cx-input", maxlength: "200", "data-testid": "input-motivo-version", value: ultimoMotivoCorreccion(db, ref), autocomplete: "off" });
      cuerpo.appendChild(cx.campo("Motivo de la nueva versión (obligatorio)", motivo, { ayuda: "Sustituye a " + infs[infs.length - 1].id + " (ISO/IEC 17025, 7.8.8)." }));
      err = h("p", { class: "cx-error", role: "alert", hidden: true, text: "Indica el motivo de la nueva versión." });
      cuerpo.appendChild(err);
    }
    var btnEmitir = h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande", "data-testid": "btn-confirmar-emision" }, cx.icon("check"), h("span", { text: "Emitir" }));
    var btnCancelar = h("button", { type: "button", class: "cx-btn cx-btn-grande", "data-testid": "btn-cancelar-emision", text: "Cancelar" });
    cuerpo.appendChild(h("div", { class: "cx-fila-botones cx-botones-dialogo" }, btnCancelar, btnEmitir));
    var ctl = cx.modal({ titulo: "Vas a emitir " + id, cuerpo: cuerpo, testid: "dialogo-emision", tipo: "dialogo" });
    btnCancelar.addEventListener("click", function () { ctl.cerrar(); });
    if (motivo) motivo.addEventListener("input", function () { if (err) err.hidden = motivo.value.trim().length >= 3; });
    btnEmitir.addEventListener("click", function () {
      if (emitiendo) return;
      var m = motivo ? motivo.value.trim() : null;
      if (motivo && m.length < 3) { err.hidden = false; motivo.focus(); return; }
      var db2 = cx.db();
      if (cx.estado(db2, ref) !== "LISTO_PARA_VALIDAR") { ctl.cerrar(); cx.toast("Los datos han cambiado: revisa el expediente antes de emitir."); return; }
      var v2 = cx.informes(db2, ref).length + 1, id2 = "INF-" + ref + "-v" + v2;
      var rol2 = cx.rol();
      var av = rolRegistroResultados(db2, ref, rol2);
      var doc = { id: id2, expediente_id: ref, version: v2, emitido_en: ahora(), emitido_por: rol2,
        huella: ING.motor.huella(db2, ref), snapshot: JSON.parse(JSON.stringify(ING.motor.snapshot(db2, ref))),
        motivo: v2 > 1 ? m : null, aviso_revisor: av, modo: "simulacion" };
      var ev = { tipo: "INFORME_EMITIDO", coleccion: "informes", entidad_id: id2, expediente_id: ref,
        resumen: "Informe " + id2 + " emitido (simulación)" + (v2 > 1 ? " · sustituye a v" + (v2 - 1) : "") + (av ? " · aviso revisor aceptado" : ""),
        cambios: [], motivo: v2 > 1 ? m : null };
      emitiendo = true;
      btnEmitir.disabled = true;
      Promise.resolve(ING.store.guardar("informes", doc, ev)).then(function () {
        emitiendo = false;
        recien = { id: id2, t: Date.now() };
        ctl.cerrar();
        cx.toast("Informe " + id2 + " emitido (simulación)");
        cx.irA("#/informe/" + id2);
      }, function () { emitiendo = false; btnEmitir.disabled = false; cx.toast("No se ha podido emitir. Inténtalo de nuevo."); });
    });
  }
  ING.cx.abrirEmision = abrirEmision;
  var recien = null;

  /* ================================================================ #/informe/<id> */
  function reglaREC01() { var r = ING.idx.reglas["REC-01"]; return r && r.condicion; }
  function recepcionSnap(fila) {
    /* [id, especie, tipo, identificacion, conservacion, tiempo_toma, envase "1|0", rechazada "1|0"] */
    if (fila[7] === "1") return "RECHAZADA";
    var c = reglaREC01();
    if (c && (c.conservaciones.indexOf(fila[4]) >= 0 || c.tiempos.indexOf(fila[5]) >= 0 || (c.envase_no_integro && fila[6] !== "1"))) return "ACEPTADA_CON_DESVIACION";
    return "ACEPTADA";
  }
  function catDe(analisisId) {
    var cats = ING.cat.analisis;
    for (var i = 0; i < cats.length; i++) {
      var suf = "-" + cats[i].id;
      if (analisisId.slice(-suf.length) === suf) return { cat: cats[i], objeto: analisisId.slice(0, -suf.length) };
    }
    return null;
  }
  function marcaAgua() {
    var m = h("div", { class: "cx-marca-agua", "data-testid": "marca-agua", "aria-hidden": "true" });
    for (var i = 0; i < 14; i++) m.appendChild(h("span", { text: "DEMOSTRACIÓN · DATOS FICTICIOS · SIN VALIDEZ" }));
    return m;
  }
  function tabla(cab, filas, cls) {
    var t = h("table", { class: "cx-tabla " + (cls || "") });
    t.appendChild(h("thead", null, h("tr", null, cab.map(function (c) { return h("th", { scope: "col", text: c }); }))));
    var tb = h("tbody");
    filas.forEach(function (f) { tb.appendChild(h("tr", null, f.map(function (c) { return h("td", null, c); }))); });
    t.appendChild(tb);
    return h("div", { class: "cx-tabla-wrap" }, t);
  }

  function vistaInforme() {
    var r = cx.ruta();
    var id = r.segs[1];
    var db = cx.db();
    var inf = db.informes[id];
    if (!inf) {
      return h("section", { class: "cx-informe-vista" }, h("h1", { class: "cx-h1", text: "Informe no encontrado" }),
        h("p", { text: "No existe el informe " + (id || "") + " en esta demo." }), h("a", { href: "#/informes", class: "cx-btn", text: "Ver informes" }));
    }
    var ref = inf.expediente_id;
    var S = inf.snapshot || {};
    var infs = cx.informes(db, ref);
    var ultimo = infs[infs.length - 1];
    var sustituto = infs.filter(function (x) { return x.version === inf.version + 1; })[0];
    var previo = infs.filter(function (x) { return x.version === inf.version - 1; })[0];
    var vigente = ultimo && ultimo.id === inf.id && cx.estado(db, ref) === "EMITIDO";

    var vista = h("section", { class: "cx-informe-vista" });
    vista.appendChild(h("div", { class: "cx-informe-acciones no-print" },
      h("a", { href: "#/exp/" + ref + "/informe", class: "cx-btn cx-btn-grande", "data-testid": "btn-volver-informe" }, cx.icon("arrow-left"), h("span", { text: "Volver" })),
      h("button", { type: "button", class: "cx-btn cx-primario cx-btn-grande", "data-testid": "btn-imprimir",
        onclick: function () { try { root.print(); } catch (e) { cx.toast("Este navegador no permite imprimir desde aquí."); } } },
        cx.icon("printer"), h("span", { text: "Imprimir / Guardar PDF" }))));
    if (recien && recien.id === inf.id && Date.now() - recien.t < 6000) {
      vista.appendChild(h("p", { class: "cx-emitido-ok no-print", role: "status" }, h("span", { class: "cx-check-anim", "aria-hidden": "true" }, cx.icon("circle-check")),
        h("span", { text: "Emitido en simulación · " + inf.id })));
    }

    var doc = h("article", { class: "cx-informe", "data-testid": "informe", "data-informe": inf.id, "aria-label": "Informe " + inf.id });
    doc.appendChild(marcaAgua());
    /* 1 · cabecera */
    doc.appendChild(h("header", { class: "cx-inf-cab" },
      h("p", { class: "cx-inf-tipo", text: "Informe de ensayo (demostración)" }),
      h("h1", { class: "cx-inf-id" }, h("span", { text: "INF-" + ref + "-" }), h("span", { "data-testid": "informe-version", text: "v" + inf.version })),
      h("p", { class: "cx-inf-lab", text: "Laboratorio: prototipo de demostración preparado para Ingulados" }),
      h("p", { class: "cx-inf-sim", text: "Emitido en modo simulación · " + cx.fechaHora(inf.emitido_en) })));
    /* 2 · versión */
    if (inf.version > 1) {
      doc.appendChild(h("div", { class: "cx-inf-banda cx-inf-sustituye", "data-testid": "informe-sustituye" },
        h("strong", { text: "Sustituye a " + (previo ? previo.id : "INF-" + ref + "-v" + (inf.version - 1)) }),
        h("span", { text: " · Motivo: " + (inf.motivo || "—") })));
    }
    if (!vigente) {
      doc.appendChild(h("div", { class: "cx-inf-banda cx-inf-novigente", "data-testid": "informe-no-vigente" },
        h("strong", { text: "Esta versión ya no es vigente" }),
        h("span", { text: sustituto ? " · Sustituida por " + sustituto.id + (sustituto.motivo ? " (" + sustituto.motivo + ")" : "") :
          " · Han cambiado los datos después de emitir: la validación ha caducado." })));
    }
    /* 3 · remitente y procedencia */
    var cab = S.cab || [];
    var proc = ING.idx.procedencias[cab[1]] || {}, rem = ING.idx.remitentes[cab[2]] || {}, mot = ING.idx.motivos[cab[4]] || {};
    var tipoProc = ING.idx.procedenciaTipos ? (ING.idx.procedenciaTipos[proc.tipo] || {}).nombre : proc.tipo;
    var dl = h("dl", { class: "cx-inf-dl" });
    function fila(dt, dd) { dl.appendChild(h("div", null, h("dt", { text: dt }), h("dd", null, dd))); }
    fila("Referencia", h("span", { class: "cx-mono", text: ref }));
    fila("Remitente", h("span", { text: (rem.nombre || "") + (rem.colegiado ? " · " + rem.colegiado : "") }));
    fila("Procedencia", h("span", { text: (proc.nombre || "") + " · " + (tipoProc || "") + " · " + (proc.codigo || "") + (proc.provincia ? " · " + proc.provincia : "") }));
    fila("Ref. del remitente", cab[3] ? h("span", null, h("span", { text: cab[3] }), h("span", { class: "cx-inf-etq", text: " Dato aportado por el remitente" })) : h("span", { text: "—" }));
    fila("Motivo", h("span", { text: mot.nombre || cab[4] || "" }));
    fila("Fecha de toma", h("span", { text: cx.fecha(cab[5]) }));
    fila("Recepción", h("span", { text: cx.fechaHora(cab[6]) }));
    var exp = db.expedientes[ref] || {};
    if (cab[7] || cab[8]) {
      var sos = cab[7] && ING.idx.patogenos[cab[7]] ? ING.idx.patogenos[cab[7]].nombre_md : null;
      var sig = (cab[8] ? cab[8].split(",") : []).map(function (s) { return (ING.idx.signos[s] || {}).nombre || s; }).join(", ");
      fila("Datos clínicos", h("span", null, sig ? h("span", { text: sig }) : null, sig && sos ? " · " : null,
        sos ? h("span", null, h("span", { text: "sospecha: " }), cx.md(sos)) : null, h("span", { class: "cx-inf-etq", text: " Dato aportado por el remitente" })));
    }
    if (exp.tratamientos_previos) fila("Tratamientos previos", h("span", null, h("span", { text: exp.tratamientos_previos }), h("span", { class: "cx-inf-etq", text: " Dato aportado por el remitente" })));
    doc.appendChild(seccion("Remitente y procedencia", dl));

    /* 4 · muestras */
    var mus = S.muestras || [];
    var hayDesv = false;
    var filasM = mus.map(function (m) {
      var est = recepcionSnap(m);
      if (est === "ACEPTADA_CON_DESVIACION") hayDesv = true;
      return [h("span", { class: "cx-mono", text: m[0].slice(ref.length + 1) }), (ING.idx.especies[m[1]] || {}).nombre || m[1],
        (ING.idx.tiposMuestra[m[2]] || {}).nombre || m[2], m[3] || "—", cx.TXT_MUESTRA[est] + (est !== "RECHAZADA" ? " · " + ((ING.idx.conservaciones[m[4]] || {}).nombre || m[4]) : "")];
    });
    var secM = seccion("Muestras", tabla(["Código", "Especie", "Tipo", "Identificación", "Recepción"], filasM, "cx-tabla-muestras"));
    secM.appendChild(h("p", { class: "cx-inf-nota", text: "Código completo: " + ref + "-Mnn." }));
    if (hayDesv) secM.appendChild(h("p", { class: "cx-inf-salvedad", "data-testid": "salvedad-rec01",
      text: "Muestra recibida fuera de condiciones (REC-01); el resultado se refiere a la muestra tal como se recibió." }));
    doc.appendChild(secM);

    /* 5 · resultados */
    var res = (S.resultados || []).map(function (x) { return { id: x[0], val: x[1], c: catDe(x[0]) }; }).filter(function (x) { return x.c; });
    var ais = (S.aislados || []).map(function (a) { return { id: a[0], taxon: a[1], metodo: a[2], lect: a[3] ? a[3].split(";").map(function (s) { var p = s.split(":"); return { atm: p[0], sir: p[1], valor: p[2] }; }) : [] }; });
    var dianasImpl = {}, patogenosDet = {};
    var secR = seccion("Resultados", null);
    mus.forEach(function (m) {
      var mid = m[0];
      if (m[7] === "1") return;
      var bloque = h("div", { class: "cx-inf-res-muestra" }, h("h3", { class: "cx-inf-h3" }, h("span", { class: "cx-mono", text: mid.slice(ref.length + 1) }),
        h("span", { text: " · " + ((ING.idx.especies[m[1]] || {}).nombre || "") + " · " + ((ING.idx.tiposMuestra[m[2]] || {}).nombre || "") })));
      var filas = [];
      res.filter(function (x) { return x.c.objeto === mid; }).forEach(function (x) {
        var c = x.c.cat;
        if (c.tipo === "pcr") filas.push(filaPCR(x, c, m, dianasImpl, patogenosDet));
        else {
          var op = (c.opciones_resultado || []).filter(function (o) { return o.id === x.val; })[0];
          if (op && op.patogeno_id) patogenosDet[op.patogeno_id] = 1;
          filas.push([cx.md(c.nombre), h("span", { text: c.metodo || "" }), op ? cx.md(op.nombre) : h("span", { text: "Pendiente" })]);
        }
      });
      if (filas.length) bloque.appendChild(tabla(["Análisis", "Método", "Resultado"], filas, "cx-tabla-res"));
      ais.filter(function (a) { return a.id.indexOf(mid + "-A") === 0; }).forEach(function (a) {
        var tx = ING.idx.taxones[a.taxon] || {};
        if (tx.patogeno_id) patogenosDet[tx.patogeno_id] = 1;
        var caja = h("div", { class: "cx-inf-aislado" },
          h("p", null, h("strong", { text: "Aislado " + a.id.slice(mid.length + 1) + ": " }), cx.md(tx.nombre_md || a.taxon),
            h("span", { text: " · identificación por " + (((ING.idx.metodos[a.metodo] || {}).nombre) || a.metodo) })));
        if (a.lect.length) {
          caja.appendChild(tabla(["Antimicrobiano", "Interpretación", "Valor"], a.lect.map(function (l) {
            var atm = ING.idx.antimicrobianos[l.atm] || {};
            return [atm.nombre || l.atm, h("strong", { class: "cx-sir-" + l.sir, text: l.sir }), l.valor ? String(l.valor).replace(".", ",") + (atm.unidad ? " " + atm.unidad : "") : "—"];
          }), "cx-tabla-sir"));
          caja.appendChild(h("p", { class: "cx-inf-nota" }, h("span", { text: ING.cat.parametros.norma_antibiograma_texto + " " }), cx.refs(ING.cat.parametros.norma_antibiograma_refs)));
        }
        var gen = res.filter(function (x) { return x.c.objeto === a.id; });
        if (gen.length) caja.appendChild(tabla(["Análisis", "Método", "Resultado"], gen.map(function (x) { return filaPCR(x, x.c.cat, m, dianasImpl, patogenosDet); }), "cx-tabla-res"));
        bloque.appendChild(caja);
      });
      secR.appendChild(bloque);
    });
    doc.appendChild(secR);

    /* 6 · interpretación */
    var secI = seccion("Interpretación (no forma parte del resultado)", null);
    var hayI = false;
    Object.keys(dianasImpl).forEach(function (k) {
      var x = dianasImpl[k], d = x.d;
      if (x.pos && d.nota_positivo_md) { hayI = true; secI.appendChild(h("p", null, h("strong", null, cx.md(d.nombre), ": "), cx.md(d.nota_positivo_md), " ", cx.refs(d.refs_positivo))); }
      if (x.neg && d.nota_negativo_md) { hayI = true; secI.appendChild(h("p", null, h("strong", null, cx.md(d.nombre), ": "), cx.md(d.nota_negativo_md), " ", cx.refs(d.refs_negativo))); }
    });
    Object.keys(patogenosDet).forEach(function (pid) {
      var p = ING.idx.patogenos[pid];
      if (!p || !p.cat_ue_md) return;
      hayI = true;
      secI.appendChild(h("p", null, cx.md(p.nombre_md), h("span", { text: " · categoría en la UE: " }), cx.md(p.cat_ue_md), " ", cx.refs(p.refs)));
    });
    if (hayI && Object.keys(dianasImpl).length) {
      secI.appendChild(h("p", { class: "cx-inf-nota" }, h("span", { text: "Corte de Ct: criterio del laboratorio. " }), cx.refs(["REF-73"])));
    }
    if (!hayI) secI.appendChild(h("p", { text: "Sin notas de interpretación para estos resultados." }));
    doc.appendChild(secI);

    /* 7 · alertas valoradas y comunicaciones */
    var secA = seccion("Alertas valoradas y comunicaciones", null);
    var vals = S.valoraciones || [], coms = S.comunicaciones || [];
    if (!vals.length && !coms.length) secA.appendChild(h("p", { text: "Sin alertas que requieran valoración." }));
    vals.forEach(function (v) {
      var reg = ING.idx.reglas[String(v[0]).split("~")[0]] || {};
      var vd = (db.valoraciones || {})[v[0]] || {};
      secA.appendChild(h("p", null, h("strong", { text: (reg.id || "") + " · " }), cx.md(reg.titulo || ""),
        h("span", { text: ": «" + v[1] + "»" + (vd.valorado_por ? " · " + cx.nombreRol(vd.valorado_por) : "") + (vd.valorado_en ? " · " + cx.fechaHora(vd.valorado_en) : "") })));
    });
    coms.forEach(function (c) {
      var cd = (db.comunicaciones || {})[c[0]] || {};
      var pat = ING.idx.patogenos[cd.patogeno_id || String(c[0]).split("~")[2]];
      var medio = cd.medio && ING.idx.medios[cd.medio] ? ING.idx.medios[cd.medio].nombre.toLowerCase() : null;
      secA.appendChild(h("p", null, h("strong", { text: "Comunicación registrada" }), pat ? h("span", null, h("span", { text: " (" }), cx.md(pat.nombre_md), h("span", { text: ")" })) : null,
        h("span", { text: ": comunicado a " + c[1] + " · " + cx.fechaHora(c[2]) + (medio ? " · " + medio : "") +
          (cd.registrado_por ? " · registrado por " + cx.nombreRol(cd.registrado_por) : "") })));
    });
    if (coms.length) secA.appendChild(h("p", { class: "cx-inf-nota" }, h("span", { text: "La demo registra la comunicación, pero no envía nada (Ley 8/2003, art. 5). " }), cx.refs(["REF-137"])));
    doc.appendChild(secA);

    /* 8 · alcance */
    doc.appendChild(h("p", { class: "cx-inf-alcance", text: "Los resultados se refieren únicamente a las muestras ensayadas." }));
    /* 9 · autorización */
    doc.appendChild(h("section", { class: "cx-inf-sec cx-inf-autorizacion" },
      h("h2", { class: "cx-inf-h2", text: "Autorización" }),
      h("p", { text: "Registro de autorización: " + cx.usuarioRol(inf.emitido_por) + " (rol de la demo) · " + cx.fechaHora(inf.emitido_en) + " · huella SHA-256" }),
      h("p", { class: "cx-mono cx-huella-larga", "data-testid": "informe-huella", text: inf.huella }),
      inf.aviso_revisor ? h("p", { class: "cx-inf-aviso-rev", "data-testid": "informe-aviso-revisor", text: "Validado por la misma persona que registró resultados (aviso aceptado)" }) : null,
      h("p", { class: "cx-inf-nota", text: "Sin identidad verificada: la demo registra qué rol pulsa «Validar y emitir»." })));
    /* 10 · fin */
    doc.appendChild(h("p", { class: "cx-inf-fin" }, h("span", { class: "cx-inf-pag", text: "Página 1 de 1 · " }), h("span", { text: "Fin del informe" })));
    vista.appendChild(doc);
    if (infs.length > 1) {
      vista.appendChild(h("nav", { class: "cx-inf-otras no-print", "aria-label": "Otras versiones" },
        h("span", { class: "cx-ayuda", text: "Versiones: " }),
        infs.map(function (x) { return x.id === inf.id ? h("strong", { class: "cx-etq-version", text: "v" + x.version }) : h("a", { href: "#/informe/" + x.id, class: "cx-etq-version", text: "v" + x.version }); })));
    }
    return vista;
  }
  function seccion(titulo, contenido) {
    return h("section", { class: "cx-inf-sec" }, h("h2", { class: "cx-inf-h2", text: titulo }), contenido);
  }
  function filaPCR(x, c, m, dianasImpl, patogenosDet) {
    var d = ING.idx.dianas[c.diana_id] || {};
    var p = String(x.val).split("|");
    var r = p[0], ct = p[1], tanda = p[2];
    var di = dianasImpl[d.id] = dianasImpl[d.id] || { d: d, pos: false, neg: false };
    if (r === "positivo" || r === "dudoso") { di.pos = true; if (d.patogeno_id) patogenosDet[d.patogeno_id] = 1; }
    if (r === "negativo" && cx.notaNegAplica(d, m[1])) di.neg = true;
    var et = r === "pendiente" ? "Pendiente" : cx.etiquetaPCR(d, r);
    return [h("span", null, cx.md(d.nombre || c.nombre), h("span", { class: "cx-inf-gen", text: " (" + (d.gen || "") + ")" })),
      h("span", { text: c.metodo || "" }),
      h("span", null, h("strong", { text: et }), r !== "pendiente" ? h("span", { class: "cx-mono", text: " · Ct " + (ct ? ct.replace(".", ",") : "sin Ct") + " · tanda " + tanda }) : null)];
  }

  ING.rutas.informes = vistaInformes;
  ING.rutas.informe = vistaInforme;
})(typeof window !== "undefined" ? window : globalThis);

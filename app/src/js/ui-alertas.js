/* ui-alertas.js · Paquete A · ruta #/alertas (ESPEC §3.7) y componentes compartidos:
   ING.ui.tarjetaAlerta(alerta) → nodo · ING.ui.abrirValorar(clave) · ING.ui.abrirComunicar(ref, patogeno_id)
   Escribe `valoraciones` (+ ALERTA_VALORADA) y `comunicaciones` (+ COMUNICACION_REGISTRADA). */
(function () {
  "use strict";
  var ING = (window.ING = window.ING || {});
  ING.ui = ING.ui || {};
  ING.rutas = ING.rutas || {};
  var ui = ING.ui;

  function h() { return ui.h.apply(null, arguments); }
  function md(t) { return ING.fmt && ING.fmt.md ? ING.fmt.md(t) : document.createTextNode(String(t == null ? "" : t)); }
  function db() { return ING.store.db(); }
  function regla(id) { return (ING.idx.reglas || {})[id] || { id: id, titulo: id, refs: [] }; }
  function rolNombre(id) {
    if (ui.rolInfo) { var r = ui.rolInfo(id); if (r && r.id === id) return r.nombre; }
    var x = ING.idx.roles && ING.idx.roles[id];
    return x ? x.nombre : String(id || "");
  }
  function fhCorta(iso) { return ING.fmt.fechaHoraCorta ? ING.fmt.fechaHoraCorta(iso) : ING.fmt.fechaHora(iso); }
  function ahoraISO() { return ING.store.ahora ? ING.store.ahora() : new Date().toISOString(); }

  var NIVEL_ORDEN = ["critico", "revisar", "info"];
  var GRUPO = { critico: "Crítico", revisar: "Revisar", info: "Información" };

  /* ------------------------------------------------------------ descripción de la entidad de la alerta */
  function nombreMuestra(mid) {
    var m = db().muestras[mid];
    if (!m) return mid;
    var esp = ING.idx.especies[m.especie_id], tm = ING.idx.tiposMuestra[m.tipo_muestra_id];
    return mid.slice(-3) + " · " + (esp ? esp.nombre : m.especie_id) + " · " + (tm ? tm.nombre : m.tipo_muestra_id) + (m.identificacion ? " · " + m.identificacion : "");
  }
  function descEntidad(a) {
    var partes = a.clave.split("~"), ent = partes[1], extra = partes[2];
    var d = db(), frag = document.createDocumentFragment();
    var add = function (x) { frag.appendChild(typeof x === "string" ? document.createTextNode(x) : x); };
    if (/^SAN-/.test(a.regla_id)) {
      var pat = ING.idx.patogenos[a.patogeno_id];
      add(md(pat ? pat.nombre_md : a.patogeno_id));
      return frag;
    }
    if (a.regla_id === "REC-02") { add("Todo el expediente"); return frag; }
    if (d.analisis[ent]) {
      var an = d.analisis[ent], cat = ING.idx.analisis[an.catalogo_id] || {};
      add((an.aislado_id ? an.aislado_id.slice(an.expediente_id.length + 1) : an.muestra_id.slice(-3)) + " · ");
      add(md(cat.nombre || an.catalogo_id));
      return frag;
    }
    if (d.aislados[ent]) {
      var x = d.aislados[ent], tx = ING.idx.taxones[x.taxon_id];
      add(ent.slice(x.expediente_id.length + 1) + " · ");
      add(md(tx ? tx.nombre_md : x.taxon_id));
      if (extra) { var am = ING.idx.antimicrobianos[extra]; add(" · " + (am ? am.nombre : extra)); }
      return frag;
    }
    if (d.muestras[ent]) { add(nombreMuestra(ent)); return frag; }
    add(ent || "");
    return frag;
  }

  /* ------------------------------------------------------------ plazo de comunicación (24 h) */
  function textoPlazo(desde) {
    var t0 = Date.parse(desde);
    if (!desde || isNaN(t0)) return { txt: "Comunicación a la autoridad · plazo máximo 24 h desde la detección", vencido: false };
    var horas = (Date.now() - t0) / 3600000;
    var quedan = 24 - horas;
    if (quedan > 0) {
      var q = quedan >= 1 ? "quedan " + Math.floor(quedan) + " h" : "quedan " + Math.max(1, Math.ceil(quedan * 60)) + " min";
      return { txt: "Comunicación a la autoridad · plazo máximo 24 h desde la detección (" + q + ")", vencido: false };
    }
    return { txt: "Comunicación a la autoridad · plazo máximo 24 h desde la detección: plazo de 24 h superado · detectado hace " + Math.floor(horas) + " h", vencido: true };
  }
  function pintarPlazo(nodo) {
    var p = textoPlazo(nodo.getAttribute("data-plazo"));
    nodo.querySelector(".al-plazo-txt").textContent = p.txt;
    nodo.setAttribute("data-tono", p.vencido ? "critico" : "revisar");
    nodo.setAttribute("data-vencido", p.vencido ? "1" : "0");
  }
  setInterval(function () {
    var ns = document.querySelectorAll("[data-plazo]");
    for (var i = 0; i < ns.length; i++) pintarPlazo(ns[i]);
  }, 60000);

  /* ------------------------------------------------------------ tarjeta de alerta */
  function tarjetaAlerta(a) {
    if (!a) return h("div");
    var r = regla(a.regla_id), d = db();
    var val = d.valoraciones[a.clave];
    var com = a.patogeno_id ? d.comunicaciones["COM~" + a.expediente_id + "~" + a.patogeno_id] : null;
    var capa = ING.idx.capas && ING.idx.capas[a.capa];
    var estadoTxt = a.estado === "pendiente" ? "Sin valorar" : a.estado === "valorada" ? "Valorada" : "Informativa";

    var cab = h("div", { class: "al-cab" },
      ui.chipNivel(a.nivel),
      h("span", { class: "chip", "data-tono": "borde" }, "Capa " + (capa ? capa.nombre.toLowerCase() : a.capa)),
      h("span", { class: "chip al-estado", "data-tono": a.estado === "valorada" ? "ok" : a.estado === "pendiente" ? "pendiente" : "borde" },
        ui.icon(a.estado === "valorada" ? "circle-check" : a.estado === "pendiente" ? "clock" : "info"), h("span", null, estadoTxt)));

    var titulo = h("h3", { class: "al-tit" }, h("span", { class: "al-tit-txt" }, md(r.titulo)), " ", h("span", { class: "al-id mono" }, a.regla_id));
    var expLink = h("p", { class: "al-exp" },
      h("a", { href: "#/exp/" + a.expediente_id + "/alertas", testid: "alerta-exp", class: "al-ref" }, ui.icon("folder-open"), h("span", null, a.expediente_id)),
      h("span", { class: "al-ent" }, descEntidad(a)));

    var cuerpo = [
      r.mensaje_md ? h("p", { class: "al-msg" }, md(r.mensaje_md)) : null,
      r.accion_md ? h("p", { class: "al-accion" }, h("b", null, "Qué hacer: "), md(r.accion_md)) : null
    ];
    var pie = h("div", { class: "al-refs" },
      r.criterio_laboratorio ? h("span", { class: "chip al-umbral", "data-tono": "borde" }, "Umbral: criterio del laboratorio") : null,
      (r.refs && r.refs.length) ? ui.chipsRefs(r.refs) : null);

    var bloqueCom = null;
    if (a.requiere_comunicacion) {
      if (com) {
        var medio = ING.idx.medios[com.medio];
        bloqueCom = h("div", { class: "aviso al-com", "data-tono": "ok", testid: "comunicacion-registrada" }, ui.icon("phone"),
          h("div", null, h("span", null, "Comunicado a " + com.destinatario + " · " + fhCorta(com.comunicado_en) + " · " + (medio ? medio.nombre.toLowerCase() : com.medio)),
            com.nota ? h("span", { class: "al-nota" }, " · «" + com.nota + "»") : null,
            h("span", { class: "al-ley" }, " · registro de la comunicación (Ley 8/2003, art. 5); la app no envía nada")));
      } else {
        var plazo = h("div", { class: "aviso al-plazo", "data-tono": "revisar", "data-plazo": a.detectado_en || "", testid: "plazo-comunicacion" },
          ui.icon("clock"),
          h("div", { class: "al-plazo-cuerpo" },
            h("span", { class: "al-plazo-txt" }, ""),
            h("span", { class: "al-ley" }, " Ley 8/2003, art. 5: los laboratorios privados también comunican. La app solo registra a quién y cuándo."),
            h("div", { class: "botones" },
              h("button", { type: "button", class: "btn", testid: "btn-comunicar", onclick: function () { abrirComunicar(a.expediente_id, a.patogeno_id); } },
                ui.icon("phone"), h("span", null, "Registrar comunicación")))));
        pintarPlazo(plazo);
        bloqueCom = plazo;
      }
    }

    var bloqueVal = null;
    if (a.estado === "valorada" && val) {
      bloqueVal = h("p", { class: "al-valorada", testid: "valoracion" }, ui.icon("circle-check"),
        h("span", null, "Valorada por " + rolNombre(val.valorado_por) + " · " + fhCorta(val.valorado_en) + " · «" + val.comentario + "»"));
    } else if (a.estado === "pendiente") {
      bloqueVal = h("div", { class: "botones al-botones" },
        h("button", { type: "button", class: "btn btn-sec", testid: "btn-valorar", onclick: function () { abrirValorar(a.clave); } },
          ui.icon("pencil"), h("span", null, "Valorar")));
    } else {
      bloqueVal = h("p", { class: "al-info muted" }, "Informativa: no requiere valoración ni bloquea la emisión.");
    }

    return h("article", {
      class: "tarjeta alerta", testid: "alerta", "data-clave": a.clave, "data-estado": a.estado, "data-nivel": a.nivel,
      "data-regla": a.regla_id, "data-ref": a.expediente_id, "aria-label": "Alerta " + a.regla_id + " · " + a.expediente_id
    }, cab, titulo, expLink, cuerpo, pie, bloqueCom, bloqueVal);
  }

  /* ------------------------------------------------------------ buscar una alerta viva por clave */
  function alertaPorClave(clave) {
    var ref = null, partes = String(clave).split("~");
    if (/^(SAN-|REC-02)/.test(partes[0])) ref = partes[1];
    else {
      var m = /^(ING-26-\d{4})/.exec(partes[1] || "");
      ref = m ? m[1] : null;
    }
    var lista = ref ? ING.motor.alertas(db(), ref) : ING.motor.alertasTodas(db());
    for (var i = 0; i < lista.length; i++) if (lista[i].clave === clave) return lista[i];
    return null;
  }

  /* ------------------------------------------------------------ hoja "Valorar" */
  function abrirValorar(clave) {
    var a = alertaPorClave(clave);
    if (!a) { ui.toast("Esta alerta ya no está activa"); return null; }
    var r = regla(a.regla_id);
    if (db().valoraciones[clave]) { ui.toast("Esta alerta ya está valorada"); return null; }
    var ctl;
    var ta = h("textarea", { class: "input", testid: "input-comentario", id: "al-coment", rows: "3", maxlength: "400", required: true,
      placeholder: "Qué se ha revisado y qué se hace", "aria-describedby": "al-coment-ayuda" });
    var ayuda = h("p", { class: "sec muted", id: "al-coment-ayuda" }, "Obligatorio (al menos 3 caracteres). Queda en el registro y en el informe.");
    var valido = function () { return ta.value.trim().length >= 3; };
    var refrescar = function () { if (ctl && ctl.botones["btn-confirmar"]) ctl.botones["btn-confirmar"].disabled = !valido(); };
    ta.addEventListener("input", refrescar);
    var rapidos = h("div", { class: "chips al-rapidos" }, (ING.cat.comentarios_rapidos || []).map(function (c, i) {
      return h("button", { type: "button", class: "chip-filtro", testid: "comentario-rapido", "data-i": String(i), "aria-pressed": "false",
        onclick: function (ev) {
          ta.value = c;
          var bs = rapidos.querySelectorAll("button");
          for (var k = 0; k < bs.length; k++) bs[k].setAttribute("aria-pressed", bs[k] === ev.currentTarget ? "true" : "false");
          refrescar();
        } }, c);
    }));
    ctl = ui.hoja({
      titulo: "Valorar " + a.regla_id,
      testid: "hoja-valorar",
      cuerpo: [
        h("p", { class: "al-hoja-tit" }, md(r.titulo), " · ", h("b", null, a.expediente_id)),
        h("p", { class: "sec al-ent" }, descEntidad(a)),
        r.accion_md ? h("p", { class: "sec" }, h("b", null, "Qué hacer: "), md(r.accion_md)) : null,
        h("p", { class: "etiqueta" }, "Comentario rápido"),
        rapidos,
        h("label", { class: "campo", for: "al-coment" }, h("span", null, "Comentario"), ta),
        ayuda,
        h("p", { class: "sec muted" }, "Quedará a nombre de " + rolNombre(ING.store.rol()) + ".")
      ],
      botones: [
        { texto: "Cancelar", tipo: "sec" },
        { texto: "Marcar como valorada", icono: "circle-check", testid: "btn-confirmar", disabled: true, onClick: function () {
          if (!valido()) { ta.focus(); return false; }
          return valorar(a, ta.value.trim());
        } }
      ]
    });
    refrescar();
    return ctl;
  }

  function valorar(a, comentario) {
    var doc = {
      id: a.clave, alerta_key: a.clave, regla_id: a.regla_id, expediente_id: a.expediente_id,
      comentario: comentario, valorado_en: ahoraISO(), valorado_por: ING.store.rol()
    };
    recientes[a.clave] = 1;
    return ING.store.guardar("valoraciones", doc, {
      tipo: "ALERTA_VALORADA", coleccion: "valoraciones", entidad_id: a.clave, expediente_id: a.expediente_id,
      resumen: "Alerta " + a.regla_id + " valorada · «" + comentario + "»", cambios: [], motivo: null
    }).then(function () { ui.toast("Alerta valorada"); return true; }, function () { ui.toast("No se ha podido guardar la valoración"); return false; });
  }

  /* ------------------------------------------------------------ hoja "Registrar comunicación" */
  function localInput(iso) { return String(iso || "").slice(0, 16); }
  function abrirComunicar(ref, patogeno_id) {
    var id = "COM~" + ref + "~" + patogeno_id;
    if (db().comunicaciones[id]) { ui.toast("La comunicación ya está registrada"); return null; }
    var pat = ING.idx.patogenos[patogeno_id];
    var medio = "telefono";
    var dest = h("input", { class: "input", type: "text", testid: "input-destinatario", id: "al-dest", maxlength: "120",
      value: (ING.cat.parametros || {}).comunicacion_destinatario_defecto || "" });
    var fecha = h("input", { class: "input", type: "datetime-local", testid: "input-fecha-comunicacion", id: "al-fecha", value: localInput(ahoraISO()) });
    var nota = h("input", { class: "input", type: "text", testid: "input-nota", id: "al-nota", maxlength: "200", placeholder: "Opcional" });
    var seg = h("div", { class: "segmentado al-medios", role: "group", "aria-label": "Medio" }, (ING.cat.medios_comunicacion || []).map(function (m) {
      return h("button", { type: "button", testid: "medio-" + m.id, "aria-pressed": m.id === medio ? "true" : "false",
        onclick: function (ev) {
          medio = m.id;
          var bs = seg.querySelectorAll("button");
          for (var k = 0; k < bs.length; k++) bs[k].setAttribute("aria-pressed", bs[k] === ev.currentTarget ? "true" : "false");
        } }, m.nombre);
    }));
    var ctl;
    var refrescar = function () { if (ctl && ctl.botones["btn-guardar-comunicacion"]) ctl.botones["btn-guardar-comunicacion"].disabled = dest.value.trim().length < 3 || !fecha.value; };
    dest.addEventListener("input", refrescar);
    fecha.addEventListener("input", refrescar);
    ctl = ui.hoja({
      titulo: "Registrar comunicación",
      testid: "hoja-comunicar",
      cuerpo: [
        h("p", null, h("b", null, ref), " · ", md(pat ? pat.nombre_md : patogeno_id)),
        h("div", { class: "aviso", "data-tono": "revisar" }, ui.icon("info"),
          h("span", null, "La app no envía nada: solo deja registrado a quién se ha comunicado y cuándo. La comunicación la hace el laboratorio por sus cauces (Ley 8/2003, art. 5).")),
        h("label", { class: "campo", for: "al-dest" }, h("span", null, "Destinatario"), dest),
        h("div", { class: "campo" }, h("span", { class: "etiqueta" }, "Medio"), seg),
        h("label", { class: "campo", for: "al-fecha" }, h("span", null, "Fecha y hora"), fecha),
        h("label", { class: "campo", for: "al-nota" }, h("span", null, "Nota"), nota)
      ],
      botones: [
        { texto: "Cancelar", tipo: "sec" },
        { texto: "Guardar", icono: "check", testid: "btn-guardar-comunicacion", onClick: function () {
          var f = fecha.value ? (fecha.value.length === 16 ? fecha.value + ":00" : fecha.value.slice(0, 19)) + "+02:00" : ahoraISO();
          var doc = {
            id: id, expediente_id: ref, patogeno_id: patogeno_id, destinatario: dest.value.trim(), medio: medio,
            comunicado_en: f, registrado_por: ING.store.rol(), nota: nota.value.trim()
          };
          return ING.store.guardar("comunicaciones", doc, {
            tipo: "COMUNICACION_REGISTRADA", coleccion: "comunicaciones", entidad_id: id, expediente_id: ref,
            resumen: "Comunicación registrada (" + (pat ? ING.fmt.plano(pat.nombre_md) : patogeno_id) + ") · " + doc.destinatario, cambios: [], motivo: null
          }).then(function () { ui.toast("Comunicación registrada"); return true; }, function () { ui.toast("No se ha podido guardar la comunicación"); return false; });
        } }
      ]
    });
    refrescar();
    return ctl;
  }

  /* ------------------------------------------------------------ tandas no válidas */
  function tarjetaTandaNoValida(x) {
    var t = x.tanda, d = ING.idx.dianas[t.diana_id] || {}, c = t.controles || {};
    var ctrl = function (nom, v) { return h("span", { class: "chip", "data-tono": "borde" }, nom + " " + (v == null ? "Sin Ct" : ING.fmt.num(v, 1))); };
    var filas = x.analisis.map(function (aid) {
      var an = db().analisis[aid];
      var otra = x.repetida_en[aid];
      var est = x.repetir.indexOf(aid) >= 0 ? h("span", { class: "chip", "data-tono": "revisar" }, ui.icon("rotate-ccw"), h("span", null, "Repetir"))
        : otra ? h("span", { class: "chip", "data-tono": "ok" }, ui.icon("check"), h("span", null, "Repetida en " + otra))
          : h("span", { class: "chip", "data-tono": "borde" }, "—");
      return h("li", { class: "al-tnv-fila" },
        an ? h("a", { href: "#/exp/" + an.expediente_id + "/muestras", class: "mono" }, aid.replace(/-pcr_\w+$/, "")) : h("span", { class: "mono" }, aid), est);
    });
    return h("article", { class: "tarjeta alerta al-tnv", testid: "tanda-no-valida", "data-tanda": t.id, "data-nivel": "no_valido" },
      h("div", { class: "al-cab" }, ui.chipNivel("no_valido"), x.reglas.map(function (rid) {
        return h("span", { class: "chip", "data-tono": "novalido", title: ING.fmt.plano(regla(rid).titulo) }, rid);
      })),
      h("h3", { class: "al-tit" }, h("span", { class: "mono" }, t.id), " · ", md(d.nombre || t.diana_id)),
      h("p", { class: "sec muted" }, ING.fmt.fecha(t.fecha) + " · " + (t.equipo || "") + " · " + (t.pocillos || []).length + " pocillos"),
      x.reglas.map(function (rid) { var r = regla(rid); return h("p", { class: "al-msg" }, h("b", null, rid + ": "), md(r.titulo), r.mensaje_md ? " · " : null, r.mensaje_md ? md(r.mensaje_md) : null); }),
      h("div", { class: "chips al-ctrl" }, ctrl("CP", c.cp), ctrl("NTC", c.ntc), ctrl("CEX", c.cex)),
      h("ul", { class: "al-tnv-lista" }, filas),
      x.repetir.length ? h("div", { class: "botones" },
        h("a", { class: "btn btn-sec", href: "#/lab/tanda?diana=" + encodeURIComponent(t.diana_id), testid: "btn-repetir-tanda" },
          ui.icon("rotate-ccw"), h("span", null, "Nueva tanda (" + x.repetir.length + " por repetir)"))) : null);
  }

  /* ------------------------------------------------------------ pantalla #/alertas */
  var filtro = "pendientes";
  var recientes = {};       // sin valorar al entrar o valoradas en esta visita: siguen visibles (ya valoradas) hasta salir de la ruta

  function sinValorar(a) { return a.estado === "pendiente" || a.comunicacion_pendiente; }

  function pantalla(p) {
    var entrada = !p || p.motivo !== "datos";
    if (entrada) recientes = {};
    if (p && p.q && p.q.filtro && ["pendientes", "valoradas", "todas"].indexOf(p.q.filtro) >= 0 && entrada) filtro = p.q.filtro;
    var d = db();
    var todas = ING.motor.alertasTodas(d);
    todas.forEach(function (a) { if (sinValorar(a)) recientes[a.clave] = 1; });
    var nPend = todas.filter(sinValorar).length;
    var nVal = todas.filter(function (a) { return a.estado === "valorada"; }).length;
    var visibles = todas.filter(function (a) {
      if (filtro === "pendientes") return sinValorar(a) || recientes[a.clave] || a.estado === "informativa";
      if (filtro === "valoradas") return a.estado === "valorada";
      return true;
    });

    var chipF = function (id, txt, n) {
      return h("button", { type: "button", class: "chip-filtro", testid: "filtro-alertas-" + id, "aria-pressed": filtro === id ? "true" : "false",
        onclick: function () { filtro = id; recientes = {}; ING.motor.alertasTodas(db()).forEach(function (a) { if (sinValorar(a)) recientes[a.clave] = 1; }); if (ING.app && ING.app.render) ING.app.render(); } },
        h("span", null, txt), h("span", { class: "n" }, String(n)));
    };

    var grupos = NIVEL_ORDEN.map(function (nv) {
      var lista = visibles.filter(function (a) { return a.nivel === nv; }).sort(function (x, y) {
        var px = sinValorar(x) ? 0 : 1, py = sinValorar(y) ? 0 : 1;
        if (px !== py) return px - py;
        if (x.expediente_id !== y.expediente_id) return x.expediente_id < y.expediente_id ? 1 : -1;
        return x.clave < y.clave ? -1 : x.clave > y.clave ? 1 : 0;
      });
      var cuenta = lista.length;
      var cab = h("h2", { class: "al-grupo-tit" }, ui.chipNivel(nv), h("span", { class: "n", testid: "grupo-n" }, String(cuenta)));
      var cuerpo;
      if (!cuenta) cuerpo = h("p", { class: "muted al-vacio" }, filtro === "valoradas" ? "Ninguna valorada." : "Ninguna" + (filtro === "pendientes" ? " sin valorar." : "."));
      else if (nv === "info" && filtro === "pendientes") {
        cuerpo = h("details", { class: "plegable al-info-pleg" },
          h("summary", null, ui.icon("info"), h("span", null, cuenta + (cuenta === 1 ? " informativa" : " informativas") + " · no requieren valoración"), ui.icon("chevron-down", "chev")),
          h("div", { class: "pila" }, lista.map(tarjetaAlerta)));
      } else cuerpo = h("div", { class: "pila al-lista" }, lista.map(tarjetaAlerta));
      return h("section", { class: "al-grupo", testid: "grupo-" + nv, "data-n": String(cuenta), "aria-label": GRUPO[nv] }, cab, cuerpo);
    });

    var tnv = ING.motor.tandasNoValidas(d);
    var secTandas = h("section", { class: "al-grupo al-tandas", testid: "seccion-tandas-no-validas", "data-n": String(tnv.length) },
      h("h2", { class: "al-grupo-tit" }, ui.chipNivel("no_valido"), h("span", null, "Tandas no válidas"), h("span", { class: "n" }, String(tnv.length))),
      h("p", { class: "sec muted" }, "No son alertas del expediente: es una marca de la tanda. Sus análisis pasan a «Repetir» y no se puede emitir hasta repetirlos."),
      tnv.length ? h("div", { class: "pila" }, tnv.map(tarjetaTandaNoValida)) : h("p", { class: "muted" }, "Todas las tandas son válidas."));

    return h("div", { class: "pantalla-alertas", testid: "pantalla-alertas" },
      h("div", { class: "pantalla-cab" }, h("h1", null, "Alertas")),
      h("p", { class: "sec muted al-intro" }, "Las alertas no paran el trabajo: solo impiden emitir el informe hasta que alguien las valora. Las de declaración obligatoria piden además registrar a quién se comunicaron."),
      h("div", { class: "filtros", role: "group", "aria-label": "Filtro de alertas" },
        chipF("pendientes", "Sin valorar", nPend), chipF("valoradas", "Valoradas", nVal), chipF("todas", "Todas", todas.length)),
      grupos, secTandas);
  }

  ING.rutas["alertas"] = pantalla;
  ui.tarjetaAlerta = tarjetaAlerta;
  ui.abrirValorar = abrirValorar;
  ui.abrirComunicar = abrirComunicar;
  ui.tarjetaTandaNoValida = tarjetaTandaNoValida;
})();

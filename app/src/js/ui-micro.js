/* ui-micro.js · Paquete D · Laboratorio de Microbiología (ESPEC §3.5)
 * Rutas: #/lab/micro
 * Exporta (CONTRATO §10, PLAN §1): ING.ui.barraSIR(aislado[, opciones]) → nodo, ING.ui.abrirRegistrarMicro(analisis_id)
 * Añadidos: ING.ui.abrirAislado(aislado_id), ING.ui.btnPcrGen(aislado) y ayudas compartidas del laboratorio en ING.lab.
 * Nada de este fichero llama a otros módulos durante la carga: solo dentro de rutas y manejadores.
 */
(function () {
  "use strict";
  var ING = (window.ING = window.ING || {});
  ING.rutas = ING.rutas || {};
  var ui = (ING.ui = ING.ui || {});
  var lab = (ING.lab = ING.lab || {});

  /* ------------------------------------------------------------ ayudas comunes del laboratorio */
  function h() { return ui.h.apply(null, arguments); }
  function idx() { return ING.idx || {}; }
  function motor() { return ING.motor; }
  function store() { return ING.store; }
  function plano(t) { return t == null ? "" : String(t).replace(/\*([^*]+)\*/g, "$1"); }
  function md(t) { return ui.md ? ui.md(t) : document.createTextNode(plano(t)); }
  function num(x, dec) { return ING.fmt && ING.fmt.num ? ING.fmt.num(x, dec) : String(x); }
  function ahora() {
    if (store() && store().ahora) return store().ahora();
    var d = new Date(Date.now() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 19) + "+02:00";
  }
  function rol() { try { return store().rol() || "responsable"; } catch (e) { return "responsable"; } }
  function hoyISO() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function diasEntre(isoA, isoB) {
    var a = Date.UTC(+isoA.slice(0, 4), +isoA.slice(5, 7) - 1, +isoA.slice(8, 10));
    var b = Date.UTC(+isoB.slice(0, 4), +isoB.slice(5, 7) - 1, +isoB.slice(8, 10));
    return Math.round((b - a) / 86400000);
  }
  function parseNum(s) {
    s = String(s == null ? "" : s).trim().replace(/\s/g, "").replace(",", ".");
    if (!s) return null;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function claves(lista) { return (lista || []).map(function (a) { return a.clave; }); }
  function titRegla(id) { var r = idx().reglas && idx().reglas[id]; return r ? plano(r.titulo) : id; }
  function conCambio(db, col, doc) {
    var o = {}; Object.keys(db).forEach(function (k) { o[k] = db[k]; });
    var m = {}; Object.keys(db[col] || {}).forEach(function (k) { m[k] = db[col][k]; });
    m[doc.id] = doc; o[col] = m;
    return o;
  }
  function textoAlertas(nuevas) {
    if (!nuevas.length) return "Resultado guardado";
    var t = nuevas.map(function (a) { return titRegla(a.regla_id); });
    var vistos = {};
    t = t.filter(function (x) { if (vistos[x]) return false; vistos[x] = 1; return true; });
    return "Guardado · " + nuevas.length + (nuevas.length === 1 ? " alerta: " : " alertas: ") + t.join(", ");
  }
  function selectorLab(actual) {
    return h("nav", { class: "lab-selector", "aria-label": "Departamento" },
      h("a", { href: "#/lab/micro", class: "lab-sel", testid: "lab-selector-micro", "aria-current": actual === "micro" ? "page" : null },
        ui.icon("microscope"), h("span", null, "Microbiología")),
      h("a", { href: "#/lab/molecular", class: "lab-sel", testid: "lab-selector-molecular", "aria-current": actual === "molecular" ? "page" : null },
        ui.icon("dna"), h("span", null, "Biología molecular")));
  }
  function recuadroLab() {
    return ui.recuadroObjetivo({
      clave: "lab", titulo: "Para qué sirve esta bandeja", abierto: false,
      objetivo: "que cada departamento vuelque su parte en el expediente común.",
      significa: "cada tarjeta es un análisis pedido por el plan o a mano. Al guardar, el motor de reglas revisa el resultado.",
      comoSeLee: "lo más antiguo arriba. Las alertas no bloquean: se valoran antes de emitir."
    });
  }
  function vacioBandeja() {
    return h("div", { class: "tarjeta vacio lab-vacio" },
      h("p", null, "No hay análisis pendientes."),
      h("a", { class: "btn btn-sec", href: "#/expedientes" }, "Ver expedientes"));
  }
  function describirMuestra(db, mid) {
    var m = db.muestras[mid];
    if (!m) return mid;
    var e = idx().especies[m.especie_id], t = idx().tiposMuestra[m.tipo_muestra_id];
    return [e ? e.nombre : m.especie_id, t ? t.nombre : m.tipo_muestra_id, m.identificacion].filter(Boolean).join(" · ");
  }
  lab.h = h; lab.plano = plano; lab.md = md; lab.num = num; lab.ahora = ahora; lab.rol = rol; lab.hoyISO = hoyISO;
  lab.parseNum = parseNum; lab.diasEntre = diasEntre; lab.claves = claves; lab.titRegla = titRegla; lab.conCambio = conCambio;
  lab.selector = selectorLab; lab.recuadro = recuadroLab; lab.vacio = vacioBandeja; lab.describirMuestra = describirMuestra;

  /* ------------------------------------------------------------ antibiograma: barra S/I/R */
  var CORTO = {
    ampicilina: "AMP", penicilina: "PEN", amoxi_clav: "AMC", ceftiofur: "XNL", cefoxitina: "FOX", enrofloxacino: "ENR",
    gentamicina: "GEN", colistina: "COL", florfenicol: "FFC", tulatromicina: "TUL", eritromicina: "ERY", tetraciclina: "TET", sxt: "SXT"
  };
  var NOMBRE_SIR = { S: "Sensible", I: "Intermedio", R: "Resistente" };

  function casosMic02(ais) {
    var r = idx().reglas && idx().reglas["MIC-02"];
    if (!r || !ais || !ais.antibiograma) return [];
    var tx = idx().taxones[ais.taxon_id] || {};
    return (r.condicion.casos || []).filter(function (c) {
      if (c.panel && tx.panel !== c.panel) return false;
      if (c.taxon_id && ais.taxon_id !== c.taxon_id) return false;
      var l = (ais.antibiograma.lecturas || []).filter(function (x) { return x.antimicrobiano_id === c.antimicrobiano_id; })[0];
      return l && l.sir === "R";
    });
  }
  function esMdr(db, ais) {
    return motor().alertas(db, ais.expediente_id).some(function (a) { return a.clave === "MIC-01~" + ais.id; });
  }

  /* Botones "Solicitar PCR del gen" (MIC-02, CONTRATO §7) para un aislado */
  ui.btnPcrGen = function (ais) {
    var db = store().db();
    ais = typeof ais === "string" ? db.aislados[ais] : ais;
    var casos = casosMic02(ais);
    if (!casos.length) return null;
    return h("div", { class: "lab-pcrgen" }, casos.map(function (c) {
      var aid = ais.id + "-" + c.analisis_id;
      var cat = idx().analisis[c.analisis_id] || { nombre: c.analisis_id };
      var atm = idx().antimicrobianos[c.antimicrobiano_id] || { nombre: c.antimicrobiano_id };
      if (db.analisis[aid]) {
        return h("span", { class: "chip", "data-tono": "ok", testid: "pcr-gen-solicitada", "data-analisis": aid },
          ui.icon("check"), h("span", null, "PCR del gen solicitada ✓"));
      }
      var b = h("button", {
        type: "button", class: "btn btn-sec lab-btn-pcrgen", testid: "btn-pcr-gen", "data-analisis": aid,
        onclick: function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          b.disabled = true;
          solicitarPcrGen(ais, c).then(function () {
            ui.toast("PCR del gen solicitada · " + plano(cat.nombre), { texto: "Ver bandeja", hash: "#/lab/molecular" });
            var ok = h("span", { class: "chip", "data-tono": "ok", testid: "pcr-gen-solicitada", "data-analisis": aid }, ui.icon("check"), h("span", null, "PCR del gen solicitada ✓"));
            if (b.parentNode) b.parentNode.replaceChild(ok, b);
          }, function (e) { b.disabled = false; setTimeout(function () { throw e; }); });
        }
      }, ui.icon("dna"), h("span", null, "Solicitar PCR del gen"), h("span", { class: "lab-pcrgen-det" }, " · " + plano(cat.nombre) + " (R a " + atm.nombre.replace(/\s*\(.*\)$/, "") + ")"));
      return b;
    }));
  };

  function solicitarPcrGen(ais, caso) {
    var cat = idx().analisis[caso.analisis_id];
    var aid = ais.id + "-" + caso.analisis_id;
    var t = ahora(), r = rol();
    var doc = {
      id: aid, expediente_id: ais.expediente_id, muestra_id: ais.muestra_id, aislado_id: ais.id,
      catalogo_id: caso.analisis_id, departamento: cat.departamento, origen: "regla", plan_id: null, regla_id: "MIC-02",
      solicitado_en: t, solicitado_por: r, resultado: null, resultado_en: null, resultado_por: null, anulado: false, motivo_anulacion: null
    };
    return store().guardar("analisis", doc, {
      tipo: "ANALISIS_ANADIDO", coleccion: "analisis", entidad_id: aid, expediente_id: ais.expediente_id,
      resumen: plano(cat.nombre) + " solicitada en " + ais.id + " (regla MIC-02)",
      cambios: [{ campo: "analisis", antes: null, despues: caso.analisis_id }]
    });
  }

  /* barraSIR(aislado) → nodo: tabla S/I/R compacta, etiqueta MDR y, si procede, el botón de la PCR del gen.
     opciones: {boton: false} quita el botón; {norma: false} quita el rótulo de la norma. */
  ui.barraSIR = function (ais, opciones) {
    opciones = opciones || {};
    var db = store().db();
    if (typeof ais === "string") ais = db.aislados[ais];
    if (!ais) return h("span", { class: "muted sec" }, "Aislado no encontrado");
    var tx = idx().taxones[ais.taxon_id] || {};
    var caja = h("div", { class: "lab-sir", testid: "barra-sir", "data-aislado": ais.id });
    if (!tx.panel) {
      caja.appendChild(h("p", { class: "muted sec lab-sir-nota" }, "Sin antibiograma: no aplica a este taxón."));
      return caja;
    }
    if (!ais.antibiograma) {
      caja.appendChild(h("div", { class: "fila" },
        h("span", { class: "chip", "data-tono": "pendiente" }, ui.icon("clock"), h("span", null, "Antibiograma pendiente")),
        h("button", { type: "button", class: "btn btn-texto", testid: "btn-registrar-antibiograma", onclick: function (ev) { ev.stopPropagation(); ui.abrirRegistrarMicro(ais.analisis_id); } }, "Registrar")));
      return caja;
    }
    var intr = tx.intrinsecas || [];
    var lista = h("ul", { class: "lab-sir-lista", "aria-label": "Antibiograma" });
    ais.antibiograma.lecturas.forEach(function (l) {
      var atm = idx().antimicrobianos[l.antimicrobiano_id] || { nombre: l.antimicrobiano_id, unidad: "" };
      var esIntr = intr.indexOf(l.antimicrobiano_id) >= 0;
      lista.appendChild(h("li", {
        class: "lab-sir-item", "data-sir": l.sir, "data-atm": l.antimicrobiano_id, title: atm.nombre + ": " + NOMBRE_SIR[l.sir] + (esIntr ? " (intrínseca)" : ""),
        "aria-label": atm.nombre + ": " + NOMBRE_SIR[l.sir] + (l.valor != null ? ", " + num(l.valor) + " " + atm.unidad : "") + (esIntr ? ", resistencia intrínseca" : "")
      },
        h("span", { class: "lab-sir-atm" }, CORTO[l.antimicrobiano_id] || l.antimicrobiano_id),
        h("span", { class: "lab-sir-letra" }, l.sir),
        l.valor != null ? h("span", { class: "lab-sir-valor" }, num(l.valor) + (atm.unidad === "mg/L" ? " mg/L" : "")) : null,
        esIntr ? h("span", { class: "lab-sir-intr" }, "intr.") : null));
    });
    var nR = ais.antibiograma.lecturas.filter(function (l) { return l.sir === "R"; }).length;
    var nI = ais.antibiograma.lecturas.filter(function (l) { return l.sir === "I"; }).length;
    var cab = h("div", { class: "fila lab-sir-cab" },
      h("span", { class: "sec" }, h("b", null, "Antibiograma"), " · " + ais.antibiograma.lecturas.length + " antimicrobianos · " + nR + " R" + (nI ? " · " + nI + " I" : "")),
      esMdr(db, ais) ? h("span", { class: "chip", "data-tono": "revisar", testid: "etiqueta-mdr" }, ui.icon("triangle-alert"), h("span", null, "MDR")) : null);
    caja.appendChild(cab);
    caja.appendChild(lista);
    if (opciones.norma !== false) {
      var par = (ING.cat && ING.cat.parametros) || {};
      caja.appendChild(h("p", { class: "lab-sir-norma min muted" }, par.norma_antibiograma_texto || "", " ", ui.chipsRefs(par.norma_antibiograma_refs || [])));
    }
    if (opciones.boton !== false) { var b = ui.btnPcrGen(ais); if (b) caja.appendChild(b); }
    return caja;
  };

  /* Ficha del aislado en hoja (taxón, método, antibiograma y acción rápida MIC-02) */
  ui.abrirAislado = function (aid) {
    var db = store().db();
    var ais = db.aislados[aid];
    if (!ais) return null;
    var tx = idx().taxones[ais.taxon_id] || {};
    var met = idx().metodos[ais.metodo_id] || { nombre: ais.metodo_id };
    return ui.hoja({
      titulo: "Aislado " + ais.id, testid: "hoja-aislado",
      cuerpo: h("div", { class: "pila" },
        h("p", { class: "lab-taxon" }, md(tx.nombre_md), h("span", { class: "muted sec" }, " · " + met.nombre)),
        h("p", { class: "sec muted" }, describirMuestra(db, ais.muestra_id)),
        ui.barraSIR(ais),
        h("a", { class: "btn btn-texto", href: "#/exp/" + ais.expediente_id + "/muestras" }, ui.icon("folder-open"), h("span", null, "Ver expediente " + ais.expediente_id))),
      botones: [{ texto: "Cerrar", tipo: "sec" }]
    });
  };

  /* ------------------------------------------------------------ hoja "Registrar resultado" */
  function siguienteAislado(db, mid) {
    var mx = 0;
    Object.keys(db.aislados).forEach(function (k) {
      if (k.indexOf(mid + "-A") === 0) { var n = parseInt(k.slice(mid.length + 2), 10); if (!isNaN(n)) mx = Math.max(mx, n); }
    });
    return mid + "-A" + ("0" + (mx + 1)).slice(-2);
  }
  function aisladoSinAntibiograma(db, a) {
    return Object.keys(db.aislados).map(function (k) { return db.aislados[k]; }).filter(function (x) {
      var tx = idx().taxones[x.taxon_id] || {};
      return x.analisis_id === a.id && tx.panel && !x.antibiograma;
    })[0] || null;
  }
  function aisladosDe(db, a) {
    return Object.keys(db.aislados).map(function (k) { return db.aislados[k]; }).filter(function (x) { return x.analisis_id === a.id; });
  }

  ui.abrirRegistrarMicro = function (analisisId) {
    var db = store().db();
    var a = db.analisis[analisisId];
    if (!a) { ui.toast("No se encuentra el análisis " + analisisId); return null; }
    var cat = idx().analisis[a.catalogo_id];
    var par = (ING.cat && ING.cat.parametros) || {};
    var paneles = (ING.cat && ING.cat.paneles_antibiograma) || {};
    var existente = aisladoSinAntibiograma(db, a);
    var yaAislados = aisladosDe(db, a);
    var st = {
      opcion: a.resultado ? a.resultado.opcion_id : null,
      obs: a.resultado ? a.resultado.observaciones || "" : "",
      taxon: existente ? existente.taxon_id : "",
      metodo: existente ? existente.metodo_id : "maldi",
      obsAis: "",
      lect: {}
    };
    var ctl = null;
    var zonaAislado = h("div", { class: "lab-zona-aislado" });
    var zonaAb = h("div", { class: "lab-zona-ab" });

    function opcionSel() { return (cat.opciones_resultado || []).filter(function (o) { return o.id === st.opcion; })[0] || null; }
    function taxonSel() { return st.taxon ? idx().taxones[st.taxon] : null; }
    function panelSel() { var tx = taxonSel(); return tx && tx.panel ? (paneles[tx.panel] || []) : []; }
    function necesitaAisladoNuevo() {
      var o = opcionSel();
      if (!o || !o.requiere_aislado || existente) return false;
      /* si ya tiene aislados completos con la misma opción, no hace falta otro */
      return !(a.resultado && a.resultado.opcion_id === o.id && yaAislados.length);
    }
    function valido() {
      var o = opcionSel();
      if (!o) return false;
      if (o.requiere_aislado && (necesitaAisladoNuevo() || existente)) {
        if (!st.taxon || !st.metodo) return false;
        var pan = panelSel();
        for (var i = 0; i < pan.length; i++) {
          var l = st.lect[pan[i]];
          if (!l || !l.sir) return false;
          if (l.valor !== "" && l.valor != null && isNaN(parseNum(l.valor))) return false;
        }
      }
      return true;
    }
    function actualizarBoton() {
      if (!ctl || !ctl.botones["btn-guardar"]) return;
      var ok = valido();
      ctl.botones["btn-guardar"].disabled = !ok;
      faltan.textContent = ok ? "" : textoFalta();
    }
    function textoFalta() {
      var o = opcionSel();
      if (!o) return "Elige un resultado para poder guardar.";
      if (o.requiere_aislado && (necesitaAisladoNuevo() || existente)) {
        if (!st.taxon) return "Falta el taxón del aislado.";
        var pan = panelSel(), n = 0;
        pan.forEach(function (x) { if (st.lect[x] && st.lect[x].sir) n++; });
        if (n < pan.length) return "Antibiograma: faltan " + (pan.length - n) + " de " + pan.length + " filas.";
      }
      return "";
    }
    var faltan = h("p", { class: "lab-faltan sec muted", "aria-live": "polite" });

    /* --- 1. opciones */
    var grupo = h("div", { class: "lab-opciones", role: "radiogroup", "aria-label": "Resultado" });
    (cat.opciones_resultado || []).forEach(function (o) {
      var input = h("input", { type: "radio", name: "opcion", value: o.id, checked: st.opcion === o.id });
      input.addEventListener("change", function () {
        if (!input.checked) return;
        st.opcion = o.id;
        pintarAislado();
        actualizarBoton();
      });
      grupo.appendChild(h("label", { class: "lab-opcion", testid: "opcion-" + o.id }, input, h("span", { class: "lab-opcion-txt" }, md(o.nombre))));
    });

    /* --- 2. aislado */
    function pintarAislado() {
      zonaAislado.textContent = "";
      var o = opcionSel();
      if (!o || !o.requiere_aislado) { zonaAb.textContent = ""; return; }
      if (!necesitaAisladoNuevo() && !existente) {
        zonaAislado.appendChild(h("p", { class: "aviso", "data-tono": "ok" }, ui.icon("circle-check"), h("span", null, "Aislado ya registrado: " + yaAislados.map(function (x) { return x.id; }).join(", "))));
        zonaAb.textContent = "";
        return;
      }
      var id = existente ? existente.id : siguienteAislado(db, a.muestra_id);
      zonaAislado.appendChild(h("h3", { class: "lab-h3" }, "Aislado " + id));
      if (existente) {
        var tx0 = idx().taxones[existente.taxon_id] || {};
        zonaAislado.appendChild(h("p", null, md(tx0.nombre_md), h("span", { class: "muted sec" }, " · " + ((idx().metodos[existente.metodo_id] || {}).nombre || ""))));
      } else {
        var selTax = h("select", { class: "input", testid: "campo-taxon", "aria-label": "Taxón" },
          h("option", { value: "" }, "Elige el taxón…"),
          (ING.cat.taxones || []).map(function (t) { return h("option", { value: t.id, selected: st.taxon === t.id }, plano(t.nombre_md)); }));
        selTax.addEventListener("change", function () { st.taxon = selTax.value; pintarAb(); actualizarBoton(); });
        var selMet = h("select", { class: "input", testid: "campo-metodo", "aria-label": "Método de identificación" },
          (ING.cat.metodos_identificacion || []).map(function (m) { return h("option", { value: m.id, selected: st.metodo === m.id }, m.nombre); }));
        selMet.addEventListener("change", function () { st.metodo = selMet.value; actualizarBoton(); });
        var obs = h("input", { type: "text", class: "input", maxlength: "200", value: st.obsAis, placeholder: "Opcional", "aria-label": "Observaciones del aislado" });
        obs.addEventListener("input", function () { st.obsAis = obs.value; });
        zonaAislado.appendChild(h("label", { class: "campo" }, h("span", null, "Taxón"), selTax));
        zonaAislado.appendChild(h("label", { class: "campo" }, h("span", null, "Método de identificación"), selMet));
        zonaAislado.appendChild(h("label", { class: "campo" }, h("span", null, "Observaciones"), obs));
      }
      pintarAb();
    }

    /* --- 3. antibiograma */
    function pintarAb() {
      zonaAb.textContent = "";
      var tx = taxonSel();
      if (!tx) return;
      if (!tx.panel) { zonaAb.appendChild(h("p", { class: "muted sec" }, "Este taxón no lleva antibiograma.")); return; }
      var pan = paneles[tx.panel] || [];
      var intr = tx.intrinsecas || [];
      intr.forEach(function (x) { if (pan.indexOf(x) >= 0 && !st.lect[x]) st.lect[x] = { sir: "R", valor: "" }; });
      zonaAb.appendChild(h("h3", { class: "lab-h3" }, "Antibiograma · " + pan.length + " antimicrobianos"));
      zonaAb.appendChild(h("p", { class: "min muted lab-norma" }, par.norma_antibiograma_texto || "", " ", ui.chipsRefs(par.norma_antibiograma_refs || [])));
      var filas = h("div", { class: "lab-ab-filas" });
      var botonesSir = {};
      pan.forEach(function (atmId) {
        var atm = idx().antimicrobianos[atmId] || { nombre: atmId, unidad: "" };
        var l = st.lect[atmId] = st.lect[atmId] || { sir: null, valor: "" };
        var seg = h("div", { class: "segmentado lab-sir-seg", role: "group", testid: "sir-" + atmId, "aria-label": atm.nombre });
        botonesSir[atmId] = {};
        ["S", "I", "R"].forEach(function (s) {
          var b = h("button", {
            type: "button", class: "lab-sir-btn", "data-sir": s, testid: "sir-" + atmId + "-" + s, "aria-pressed": l.sir === s ? "true" : "false",
            "aria-label": atm.nombre + ": " + NOMBRE_SIR[s],
            onclick: function () {
              l.sir = s;
              Object.keys(botonesSir[atmId]).forEach(function (k) { botonesSir[atmId][k].setAttribute("aria-pressed", k === s ? "true" : "false"); });
              actualizarBoton();
            }
          }, s);
          botonesSir[atmId][s] = b;
          seg.appendChild(b);
        });
        var val = h("input", {
          type: "text", inputmode: "decimal", class: "input lab-ab-valor", value: l.valor || "", placeholder: atm.unidad || "valor",
          "aria-label": "Valor de " + atm.nombre + " (" + (atm.unidad || "") + ", opcional)", testid: "valor-" + atmId
        });
        val.addEventListener("input", function () { l.valor = val.value; actualizarBoton(); });
        filas.appendChild(h("div", { class: "lab-ab-fila", "data-atm": atmId },
          h("div", { class: "lab-ab-nombre" }, h("span", null, atm.nombre),
            intr.indexOf(atmId) >= 0 ? h("span", { class: "chip lab-intr", "data-tono": "novalido" }, "R esperada (intrínseca)") : null),
          h("div", { class: "lab-ab-ctl" }, seg, val)));
      });
      var resto = h("button", {
        type: "button", class: "btn btn-texto", testid: "btn-sir-resto",
        onclick: function () {
          pan.forEach(function (x) {
            if (!st.lect[x].sir) {
              st.lect[x].sir = "S";
              Object.keys(botonesSir[x]).forEach(function (k) { botonesSir[x][k].setAttribute("aria-pressed", k === "S" ? "true" : "false"); });
            }
          });
          actualizarBoton();
        }
      }, ui.icon("check"), h("span", null, "Marcar el resto como S"));
      zonaAb.appendChild(filas);
      zonaAb.appendChild(resto);
    }

    var obsRes = h("input", { type: "text", class: "input", maxlength: "200", value: st.obs, placeholder: "Opcional", "aria-label": "Observaciones del resultado" });
    obsRes.addEventListener("input", function () { st.obs = obsRes.value; });
    var m = db.muestras[a.muestra_id];
    var cuerpo = h("div", { class: "lab-hoja" },
      h("p", { class: "lab-hoja-sub" }, h("b", null, a.muestra_id), " · ", md(cat.nombre)),
      h("p", { class: "sec muted" }, m ? describirMuestra(db, a.muestra_id) : "", cat.metodo ? " · " + cat.metodo : ""),
      h("fieldset", { class: "lab-fs" }, h("legend", { class: "etiqueta" }, "Resultado"), grupo),
      zonaAislado,
      zonaAb,
      h("label", { class: "campo" }, h("span", null, "Observaciones del resultado"), obsRes),
      faltan);

    ctl = ui.hoja({
      titulo: "Registrar resultado", testid: "hoja-registrar",
      cuerpo: cuerpo,
      botones: [
        { texto: "Cancelar", tipo: "sec", testid: "btn-cancelar" },
        {
          texto: "Guardar", testid: "btn-guardar", icono: "check", disabled: true,
          onClick: function () {
            if (!valido()) return false;
            return guardarMicro(a, st, existente, necesitaAisladoNuevo()).then(function (res) {
              ui.toast(textoAlertas(res.nuevas), res.aislado ? { texto: "Ver aislado", fn: function () { ui.abrirAislado(res.aislado); } } : null);
              if (res.aislado && res.mic02) setTimeout(function () { ui.abrirAislado(res.aislado); }, 60);
              return true;
            });
          }
        }
      ]
    });
    pintarAislado();
    actualizarBoton();
    return ctl;
  };

  /* Escribe resultado, aislado y antibiograma (cada uno con su evento, en este orden) */
  function guardarMicro(a, st, existente, nuevoAislado) {
    var S = store(), M = motor();
    var db = S.db(), ref = a.expediente_id;
    var antes = claves(M.alertas(db, ref));
    var cat = idx().analisis[a.catalogo_id];
    var op = (cat.opciones_resultado || []).filter(function (o) { return o.id === st.opcion; })[0];
    var t = ahora(), r = rol();
    var cambioRes = !a.resultado || a.resultado.opcion_id !== st.opcion || (a.resultado.observaciones || "") !== (st.obs || "");
    var aNew = a;
    if (cambioRes) {
      aNew = JSON.parse(JSON.stringify(a));
      aNew.resultado = { opcion_id: st.opcion, observaciones: st.obs || "" };
      aNew.resultado_en = t; aNew.resultado_por = r;
    }
    var ais = null, conAb = false, tx = null;
    if (op.requiere_aislado && (nuevoAislado || existente)) {
      if (existente) ais = JSON.parse(JSON.stringify(existente));
      else ais = {
        id: siguienteAislado(db, a.muestra_id), expediente_id: ref, muestra_id: a.muestra_id, analisis_id: a.id,
        taxon_id: st.taxon, metodo_id: st.metodo, observaciones: st.obsAis || "", antibiograma: null, creado_en: t, creado_por: r
      };
      tx = idx().taxones[ais.taxon_id] || {};
      if (tx.panel) {
        var pan = (ING.cat.paneles_antibiograma || {})[tx.panel] || [];
        ais.antibiograma = {
          lecturas: pan.map(function (x) { var v = parseNum(st.lect[x].valor); return { antimicrobiano_id: x, valor: v == null || isNaN(v) ? null : v, sir: st.lect[x].sir }; }),
          registrado_en: t, registrado_por: r
        };
        conAb = true;
      }
    }
    var dbP = conCambio(db, "analisis", aNew);
    if (ais) dbP = conCambio(dbP, "aislados", ais);
    var nuevas = M.alertas(dbP, ref).filter(function (x) { return antes.indexOf(x.clave) < 0; });
    var mic02 = ais ? casosMic02(ais).length > 0 : false;

    var p = Promise.resolve();
    if (cambioRes) p = p.then(function () {
      return S.guardar("analisis", aNew, {
        tipo: "RESULTADO_REGISTRADO", coleccion: "analisis", entidad_id: a.id, expediente_id: ref,
        resumen: plano(cat.nombre) + ": " + plano(op.nombre),
        cambios: [{ campo: "resultado", antes: a.resultado ? a.resultado.opcion_id : null, despues: st.opcion }]
      });
    });
    if (ais && !existente) p = p.then(function () {
      var met = idx().metodos[ais.metodo_id] || { nombre: ais.metodo_id };
      return S.guardar("aislados", ais, {
        tipo: "AISLADO_REGISTRADO", coleccion: "aislados", entidad_id: ais.id, expediente_id: ref,
        resumen: "Aislado " + ais.id + ": " + plano(tx.nombre_md) + " (" + met.nombre + ")",
        cambios: [{ campo: "taxon_id", antes: null, despues: ais.taxon_id }]
      });
    });
    if (conAb) p = p.then(function () {
      var nR = ais.antibiograma.lecturas.filter(function (l) { return l.sir === "R"; }).length;
      return S.guardarVarios(existente ? [{ col: "aislados", doc: ais }] : [], {
        tipo: "ANTIBIOGRAMA_REGISTRADO", coleccion: "aislados", entidad_id: ais.id, expediente_id: ref,
        resumen: "Antibiograma de " + ais.id + " (" + ais.antibiograma.lecturas.length + " antimicrobianos · " + nR + " R)"
      });
    });
    return p.then(function () { return { nuevas: nuevas, aislado: ais ? ais.id : null, mic02: mic02 }; });
  }

  /* ------------------------------------------------------------ pantalla #/lab/micro */
  var FILTROS = [
    { id: "todas", texto: "Todas" },
    { id: "cultivo", texto: "Cultivo" },
    { id: "frotis", texto: "Frotis" },
    { id: "antibiograma", texto: "Pendiente de antibiograma" }
  ];
  var filtroActual = "todas";
  try { filtroActual = (ui.ls && ui.ls.get("ing-lab-filtro-micro", "todas")) || "todas"; } catch (e) { filtroActual = "todas"; }

  function pasaFiltro(db, a, f) {
    var cat = idx().analisis[a.catalogo_id] || {};
    if (f === "cultivo") return cat.tipo === "cultivo";
    if (f === "frotis") return cat.tipo === "frotis";
    if (f === "antibiograma") { var p = motor().pendienteDe ? motor().pendienteDe(db, a) : null; return p === "antibiograma" || p === "aislado"; }
    return true;
  }

  function tarjetaTarea(db, a) {
    var cat = idx().analisis[a.catalogo_id] || { nombre: a.catalogo_id };
    var d = diasEntre(String(a.solicitado_en).slice(0, 10), hoyISO());
    var pedido = d <= 0 ? "Pedido hoy" : d === 1 ? "Pedido hace 1 día" : "Pedido hace " + d + " días";
    var falta = motor().pendienteDe ? motor().pendienteDe(db, a) : "resultado";
    var tarde = cat.tat_dias != null && d > cat.tat_dias;
    return h("article", { class: "tarjeta lab-tarea", testid: "tarea-micro", "data-analisis": a.id },
      h("div", { class: "fila-sep" },
        h("a", { class: "lab-ref", href: "#/exp/" + a.expediente_id + "/muestras" }, h("b", null, a.expediente_id), h("span", { class: "muted" }, " · " + a.muestra_id.slice(-3))),
        h("span", { class: "chip", "data-tono": "info" }, ui.icon("microscope"), h("span", null, cat.tipo === "frotis" ? "Frotis" : "Cultivo"))),
      h("p", { class: "lab-tarea-muestra sec" }, describirMuestra(db, a.muestra_id)),
      h("p", { class: "lab-tarea-an" }, md(cat.nombre)),
      falta === "aislado" ? h("p", { class: "aviso", "data-tono": "revisar" }, ui.icon("triangle-alert"), h("span", null, "Falta registrar el aislado")) : null,
      falta === "antibiograma" ? h("p", { class: "aviso", "data-tono": "revisar" }, ui.icon("triangle-alert"), h("span", null, "Pendiente de antibiograma")) : null,
      h("p", { class: "sec " + (tarde ? "lab-tarde" : "muted") }, ui.icon("clock"), " " + pedido + (cat.tat_dias != null ? " · plazo orientativo " + cat.tat_dias + (cat.tat_dias === 1 ? " día" : " días") : "")),
      h("button", { type: "button", class: "btn btn-bloque", testid: "btn-registrar", onclick: function () { ui.abrirRegistrarMicro(a.id); } },
        ui.icon("pencil"), h("span", null, "Registrar resultado")));
  }

  function graficaG7(db) {
    var p = (ui.panelActual && ui.panelActual(null)) || motor().panel(db, null);
    var datos = p.aislados_por_taxon || {};
    var ids = Object.keys(datos).sort(function (x, y) { return datos[y] - datos[x] || (x < y ? -1 : 1); });
    var max = ids.reduce(function (m, k) { return Math.max(m, datos[k]); }, 0) || 1;
    var total = ids.reduce(function (s, k) { return s + datos[k]; }, 0);
    var barras = h("ul", { class: "lab-barras", "aria-label": "Aislados por taxón" }, ids.map(function (k) {
      var tx = idx().taxones[k] || { nombre_md: k };
      return h("li", { class: "lab-barra" },
        h("span", { class: "lab-barra-et" }, md(tx.nombre_md)),
        h("span", { class: "lab-barra-pista" }, h("span", { class: "lab-barra-relleno", style: { width: Math.max(4, Math.round(100 * datos[k] / max)) + "%" } })),
        h("span", { class: "lab-barra-n" }, String(datos[k])));
    }));
    return ui.tarjetaGrafica({
      id: "g7", titulo: "¿Qué bacterias aislamos?",
      subtitulo: "Todos los expedientes de la demo · n = " + total + " aislados",
      nodo: barras,
      fuente: "Identificación de cada aislado",
      refs: ["REF-48"],
      comoSeLee: "Cada barra es un taxón; el número es cuántos aislados se han identificado. Las barras se ordenan de más a menos frecuente.",
      tabla: function () {
        return { cabeceras: ["Taxón", "Aislados"], filas: ids.map(function (k) { return [md((idx().taxones[k] || { nombre_md: k }).nombre_md), String(datos[k])]; }), numericas: [1] };
      }
    });
  }

  ING.rutas["lab/micro"] = function () {
    var db = store().db();
    var todas = motor().bandejaMicro(db);
    var lista = todas.filter(function (a) { return pasaFiltro(db, a, filtroActual); });
    var cont = h("div", { class: "lab lab-micro" });
    cont.appendChild(selectorLab("micro"));
    cont.appendChild(h("div", { class: "pantalla-cab" }, h("h1", null, "Microbiología"), h("span", { class: "chip", "data-tono": "info", testid: "n-tareas-micro" }, String(todas.length) + " pendientes")));
    cont.appendChild(recuadroLab());
    var filtros = h("div", { class: "filtros", role: "group", "aria-label": "Filtrar tareas" });
    FILTROS.forEach(function (f) {
      var n = todas.filter(function (a) { return pasaFiltro(db, a, f.id); }).length;
      filtros.appendChild(h("button", {
        type: "button", class: "chip-filtro", testid: "filtro-micro-" + f.id, "aria-pressed": filtroActual === f.id ? "true" : "false",
        onclick: function () { filtroActual = f.id; if (ui.ls) ui.ls.set("ing-lab-filtro-micro", f.id); if (ING.app && ING.app.render) ING.app.render(); }
      }, h("span", null, f.texto), h("span", { class: "n" }, String(n))));
    });
    cont.appendChild(filtros);
    if (!lista.length) cont.appendChild(vacioBandeja());
    else cont.appendChild(h("div", { class: "rejilla lab-lista" }, lista.map(function (a) { return tarjetaTarea(db, a); })));
    cont.appendChild(h("div", { class: "seccion" }, graficaG7(db)));
    return cont;
  };
})();

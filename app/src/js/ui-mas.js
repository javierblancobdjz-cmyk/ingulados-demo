/* ui-mas.js · Paquete B · Más (#/mas y subrutas) · ESPEC §3.10 y §5.4, CONTRATO §8 */
(function () {
  "use strict";
  var ING = (window.ING = window.ING || {});
  var ui = ING.ui, h = ui.h, fmt = ui.fmt;

  function cabecera(titulo, volver) {
    return h("div", { class: "pantalla-cab" },
      volver ? h("a", { class: "volver", href: volver, "aria-label": "Volver" }, ui.icon("arrow-left")) : null,
      h("h1", null, titulo));
  }
  function db() { return ING.store && ING.store.db ? ING.store.db() : {}; }

  /* ---------- #/mas ---------- */
  var ITEMS = [
    { href: "#/mas/sobre", icono: "info", titulo: "Sobre esta demo", sub: "Qué enseña, qué no es y la fase siguiente", testid: "mas-sobre" },
    { href: "#/mas/biblioteca", icono: "book-open", titulo: "Biblioteca de referencias", sub: "Normas, guías, legislación y artículos citados", testid: "mas-biblioteca" },
    { href: "#/mas/reglas", icono: "shield-alert", titulo: "Reglas de alerta", sub: "Las 19 reglas del motor, por capa", testid: "mas-reglas" },
    { href: "#/mas/registro", icono: "history", titulo: "Registro y trazabilidad", sub: "Eventos y verificación de integridad", testid: "mas-registro" },
    { href: "#/mas/compartir", icono: "qr-code", titulo: "Compartir la demo", sub: "Código QR para abrirla en otro móvil", testid: "mas-compartir" },
    { href: "#/mas/ajustes", icono: "settings", titulo: "Ajustes", sub: "Tema, modo presentación, rol y reinicio", testid: "mas-ajustes" }
  ];
  ING.rutas["mas"] = function () {
    return h("div", null,
      cabecera("Más"),
      h("ul", { class: "mas-lista" }, ITEMS.map(function (it) {
        return h("li", null, h("a", { class: "mas-item", href: it.href, testid: it.testid },
          h("span", { class: "mas-ico" }, ui.icon(it.icono)),
          h("span", null, h("b", null, it.titulo), h("small", null, it.sub)),
          ui.icon("chevron-right")));
      })),
      h("p", { class: "mas-nota" }, "Prototipo de demostración con datos ficticios. Versión " + (ING.build || "—") + "."));
  };

  /* ---------- #/mas/sobre (texto exacto ESPEC §5.4) ---------- */
  function diagrama() {
    var S = function (tag, a) { var el = document.createElementNS("http://www.w3.org/2000/svg", tag); Object.keys(a || {}).forEach(function (k) { el.setAttribute(k, a[k]); }); for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (typeof c === "string") el.appendChild(document.createTextNode(c)); else if (c) el.appendChild(c); } return el; };
    function caja(x, y, w, hh, texto, clase) {
      return S("g", null,
        S("rect", { x: x, y: y, width: w, height: hh, rx: 12, class: "caja " + (clase || "") }),
        S("text", { x: x + w / 2, y: y + hh / 2 + 6, "text-anchor": "middle", class: "txt" }, texto));
    }
    function flecha(x1, y1, x2, y2) {
      return S("g", null, S("line", { x1: x1, y1: y1, x2: x2, y2: y2 - 7, class: "flecha" }),
        S("path", { d: "M" + (x2 - 6) + " " + (y2 - 9) + " L" + x2 + " " + y2 + " L" + (x2 + 6) + " " + (y2 - 9) + " Z", class: "punta" }));
    }
    var svg = S("svg", { viewBox: "0 0 340 430", class: "diagrama", role: "img", "aria-labelledby": "diag-t", style: "max-width:460px" },
      S("title", { id: "diag-t" }, "Circuito: Entrada, después Microbiología y Biología molecular en paralelo, Valoración e Informe. Fase siguiente no incluida: plan sanitario de la finca."),
      caja(90, 4, 160, 50, "Entrada", "caja-fuerte"),
      flecha(170, 54, 92, 88), flecha(170, 54, 248, 88),
      caja(4, 88, 158, 50, "Microbiología"),
      caja(178, 88, 158, 50, "Molecular"),
      flecha(88, 138, 166, 172), flecha(252, 138, 174, 172),
      caja(90, 172, 160, 50, "Valoración"),
      flecha(170, 222, 170, 256),
      caja(90, 256, 160, 50, "Informe", "caja-fuerte"),
      S("line", { x1: 170, y1: 306, x2: 170, y2: 340, class: "flecha", "stroke-dasharray": "4 4" }),
      S("rect", { x: 20, y: 340, width: 300, height: 82, rx: 12, class: "caja-fase" }),
      S("text", { x: 170, y: 372, "text-anchor": "middle", class: "txt-fase" }, "Plan sanitario y de vigilancia de la finca"),
      S("text", { x: 170, y: 398, "text-anchor": "middle", class: "txt-fase" }, "fase siguiente (no incluida)"));
    return svg;
  }
  function li(titulo, texto) { return h("li", null, h("b", null, titulo), " " + texto); }
  ING.rutas["mas/sobre"] = function () {
    return h("div", { class: "sobre" },
      cabecera("Sobre esta demo", "#/mas"),
      h("p", { class: "lead" }, "Prototipo preparado por Javier Blanco para la dirección de Ingulados, construido en una tarde con IA (Claude Code). No es un sistema en producción."),
      h("p", null, h("b", null, "Qué enseña."), " El circuito de una muestra: entrada con su Referencia → plan de análisis según la muestra → microbiología y biología molecular en paralelo → reglas que avisan sin bloquear → validación humana con un único botón ligado a una versión → informe y registro."),
      diagrama(),
      h("p", { class: "diagrama-pie" }, "El circuito que recorre la demo, con datos ficticios de principio a fin."),
      h("ul", null,
        li("Datos ficticios.", "Fincas, explotaciones, remitentes, muestras y resultados son inventados. Cualquier parecido con casos reales es casual. No contiene datos de Ingulados."),
        li("Referencias reales.", "Catálogos y reglas citan normas, guías y artículos comprobables (pestaña Biblioteca). Los umbrales marcados como \"criterio del laboratorio\" son ejemplos que tendría que fijar y validar el laboratorio."),
        li("No está validado.", "No ha pasado la validación de sistemas informáticos que pide la ISO/IEC 17025 (7.11) ni ninguna otra. Sus informes no tienen validez técnica ni legal."),
        li("Sin identidad verificada.", "\"Validar y emitir\" registra qué rol pulsa el botón; no hay inicio de sesión ni firma con identidad verificada. Los roles se eligen de una lista."),
        li("No comunica nada.", "Registra que el responsable ha comunicado una sospecha a la autoridad, pero no envía nada. La comunicación oficial la hace el laboratorio por sus cauces (Ley 8/2003, art. 5)."),
        li("Cribado, no confirmación.", "Los resultados de PCR de enfermedades sometidas a programas oficiales se presentan como compatibles o de vigilancia; la confirmación corresponde a la vía oficial."),
        li("Dónde se guarda.", "En este dispositivo (o en la base de datos de prueba del artifact). \"Reiniciar demo\" vuelve a los datos de fábrica."),
        li("No sustituye", "al sistema de gestión del laboratorio, a los procedimientos internos ni al sistema de calidad.")),
      h("div", { class: "sobre-fase", testid: "fase-siguiente" }, h("b", null, "Fase siguiente (no incluida):"), " plan sanitario y de vigilancia epidemiológica de la finca, a partir de los expedientes acumulados por finca y temporada, redactado por los veterinarios."),
      h("p", null, h("b", null, "Cómo se ha hecho:"), " contrato de datos escrito antes de programar, varios agentes de IA construyendo en paralelo y un verificador independiente; el mismo patrón que BALANCE."));
  };

  /* ---------- #/mas/biblioteca ---------- */
  var bib = { q: "", tipo: null, solo: true, n: 30 };
  var _usadas = null;
  function refsUsadas() {
    /* "Las que usa la app" = citadas en catálogos y reglas (las mismas que valida build.py --check) */
    if (_usadas) return _usadas;
    _usadas = {};
    var txt = JSON.stringify(ui.cat()) + JSON.stringify(ui.reglasLista());
    (txt.match(/REF-\d+/g) || []).forEach(function (r) { _usadas[r] = 1; });
    return _usadas;
  }
  function normaliza(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  ING.rutas["mas/biblioteca"] = function () {
    var todas = ui.refsLista();
    var usadas = refsUsadas();
    var zona = h("div");
    var contador = h("p", { class: "contador", role: "status" });
    function filtrar() {
      var q = normaliza(bib.q);
      return todas.filter(function (r) {
        if (bib.solo && !usadas[r.id]) return false;
        if (bib.tipo && r.tipo !== bib.tipo) return false;
        if (q && normaliza(r.id + " " + r.cita + " " + (r.tema || "") + " " + (r.pmid || "") + " " + (r.doi || "")).indexOf(q) < 0) return false;
        return true;
      });
    }
    function pintar() {
      var L = filtrar();
      contador.textContent = L.length + (L.length === 1 ? " referencia" : " referencias") + (bib.solo ? " que usa la app" : " en la biblioteca");
      zona.textContent = "";
      if (!L.length) { zona.appendChild(h("div", { class: "tarjeta vacio" }, h("p", null, "Ninguna referencia coincide. Prueba con otra palabra o quita filtros."))); return; }
      var lista = h("div", { class: "rejilla" }, L.slice(0, bib.n).map(function (r) {
        return h("article", { class: "tarjeta ref-tarjeta", testid: "tarjeta-ref", "data-ref-id": r.id },
          h("div", { class: "fila-sep" }, ui.chipRef(r.id), h("span", { class: "chip", "data-tono": r.verificado ? "ok" : "revisar" }, ui.icon(r.verificado ? "circle-check" : "triangle-alert"), r.verificado ? (ui.TIPO_REF[r.tipo] || r.tipo) : "No verificada")),
          ui.fichaRef(r.id, false));
      }));
      zona.appendChild(lista);
      if (L.length > bib.n) zona.appendChild(h("div", { class: "ver-mas" }, h("button", { type: "button", class: "btn btn-sec btn-bloque", testid: "ver-mas", onclick: function () { bib.n += 30; pintar(); } }, "Ver más (" + (L.length - bib.n) + ")")));
    }
    var input = h("input", { class: "input", type: "search", placeholder: "Buscar por autor, tema, PMID…", "aria-label": "Buscar referencias", value: bib.q, testid: "buscador-refs",
      oninput: function () { bib.q = input.value; bib.n = 30; pintar(); } });
    var tipos = [["norma", "Norma"], ["guia", "Guía"], ["legislacion", "Legislación"], ["articulo", "Artículo"]];
    var chips = h("div", { class: "filtros", role: "group", "aria-label": "Filtros" });
    function pintarChips() {
      chips.textContent = "";
      chips.appendChild(h("button", { type: "button", class: "chip-filtro", "aria-pressed": bib.solo ? "true" : "false", testid: "filtro-usadas",
        onclick: function () { bib.solo = !bib.solo; bib.n = 30; pintarChips(); pintar(); } }, bib.solo ? ui.icon("check") : null, "Solo las que usa la app"));
      tipos.forEach(function (t) {
        chips.appendChild(h("button", { type: "button", class: "chip-filtro", "aria-pressed": bib.tipo === t[0] ? "true" : "false", testid: "filtro-tipo-" + t[0],
          onclick: function () { bib.tipo = bib.tipo === t[0] ? null : t[0]; bib.n = 30; pintarChips(); pintar(); } }, t[1]));
      });
    }
    pintarChips(); pintar();
    return h("div", null,
      cabecera("Biblioteca de referencias", "#/mas"),
      h("p", { class: "muted sec" }, "Cada chip REF de la app abre su ficha. Las no verificadas aparecen sin enlace."),
      h("div", { class: "buscador" }, ui.icon("search"), input),
      chips, contador, zona);
  };

  /* ---------- #/mas/reglas ---------- */
  ING.rutas["mas/reglas"] = function () {
    var R = ING.reglas && ING.reglas.capas ? ING.reglas : null;
    var capas = (R && R.capas) || [
      { id: "tecnica", nombre: "Técnica", descripcion: "Recepción de la muestra y controles de cada tanda" },
      { id: "analitica", nombre: "Analítica", descripcion: "Coherencia y relevancia de cada resultado" },
      { id: "sanitaria", nombre: "Sanitaria", descripcion: "Una sola alerta por patógeno y expediente" }];
    var reglas = ui.reglasLista();
    return h("div", null,
      cabecera("Reglas de alerta", "#/mas"),
      h("p", { class: "muted sec" }, reglas.length + " reglas en tres capas. Avisan sin bloquear el trabajo; solo impiden emitir hasta que alguien las valora."),
      capas.map(function (c) {
        var de = reglas.filter(function (r) { return r.capa === c.id; });
        return h("section", { class: "seccion" },
          h("h2", { class: "capa-tit" }, "Capa " + c.nombre.toLowerCase(), h("small", null, c.descripcion + " · " + de.length)),
          h("div", { class: "rejilla" }, de.map(function (r) {
            return h("article", { class: "tarjeta regla", testid: "regla", "data-regla": r.id },
              h("div", { class: "fila" }, h("span", { class: "regla-id" }, r.id), ui.chipNivel(r.nivel),
                r.demo ? h("span", { class: "chip", "data-tono": "soft" }, ui.icon("circle-check"), "se ve en la demo") : null),
              h("h3", null, ui.md(r.titulo)),
              h("dl", null,
                h("dt", null, "Cuándo salta"), h("dd", null, ui.md(r.condicion_texto)),
                h("dt", null, "Efecto"), h("dd", null, ui.md(r.efecto)),
                r.requiere_comunicacion ? [h("dt", null, "Comunicación"), h("dd", null, "Exige registrar a quién se comunicó y cuándo (plazo máximo 24 h).")] : null),
              r.criterio_laboratorio ? h("p", null, h("span", { class: "chip", "data-tono": "revisar" }, ui.icon("triangle-alert"), "Umbral: criterio del laboratorio")) : null,
              ui.chipsRefs(r.refs));
          })));
      }));
  };

  /* ---------- #/mas/registro (CONTRATO §8) ---------- */
  var reg = { tipo: "", base: null, manip: null, resultado: null };
  var NOMBRES_TIPO = {
    EXPEDIENTE_CREADO: "Expediente creado", MUESTRA_REGISTRADA: "Muestra registrada", MUESTRA_RECHAZADA: "Muestra rechazada",
    ANALISIS_ANADIDO: "Análisis añadido", ANALISIS_ANULADO: "Análisis anulado", RESULTADO_REGISTRADO: "Resultado registrado",
    AISLADO_REGISTRADO: "Aislado registrado", ANTIBIOGRAMA_REGISTRADO: "Antibiograma registrado", TANDA_REGISTRADA: "Tanda registrada",
    ALERTA_VALORADA: "Alerta valorada", COMUNICACION_REGISTRADA: "Comunicación registrada", INFORME_EMITIDO: "Informe emitido",
    DATO_CORREGIDO: "Dato corregido", DEMO_REINICIADA: "Demo reiniciada", ROL_CAMBIADO: "Rol cambiado"
  };
  function canonJS(o) {
    if (ING.motor && ING.motor.canon) return ING.motor.canon(o);
    if (o === null || typeof o !== "object") return JSON.stringify(o === undefined ? null : o);
    if (Array.isArray(o)) return "[" + o.map(canonJS).join(",") + "]";
    return "{" + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ":" + canonJS(o[k]); }).join(",") + "}";
  }
  function eventosOrdenados() {
    var L = ui.lista(db().eventos).slice();
    L.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    return L;
  }
  function cadena(eventos, manip) {
    var hprev = new Array(65).join("0"), out = [];
    eventos.forEach(function (e) {
      var ev = e;
      if (manip && manip.id === e.id) { ev = {}; Object.keys(e).forEach(function (k) { ev[k] = e[k]; }); ev.resumen = manip.resumen; }
      hprev = ING.sha256(hprev + "|" + canonJS(ev));
      out.push({ id: e.id, h: hprev });
    });
    return out;
  }
  function verificar() {
    if (!ING.sha256) return { error: "No se puede calcular la huella en este navegador." };
    var evs = eventosOrdenados();
    var ch = cadena(evs, reg.manip);
    /* Si el registro tiene menos eventos que la referencia, es un reinicio de la demo: se toma referencia nueva */
    if (reg.base && !reg.manip && ch.length < reg.baseN) reg.base = null;
    var res = { n: ch.length, ultima: ch.length ? ch[ch.length - 1].h : "", roto: null, nuevos: 0, primera: !reg.base };
    if (reg.base) {
      for (var i = 0; i < ch.length; i++) {
        var b = reg.base[ch[i].id];
        if (b === undefined) { res.nuevos = ch.length - i; break; }   // eventos añadidos desde la última verificación
        if (b !== ch[i].h) { res.roto = { pos: i + 1, ev: evs[i] }; break; }
      }
    }
    if (!res.roto && !reg.manip) { reg.base = {}; reg.baseN = ch.length; ch.forEach(function (x) { reg.base[x.id] = x.h; }); }
    return res;
  }
  function nodoResultado(r) {
    if (!r) return h("p", { class: "muted sec" }, "Pulsa «Verificar integridad» para recalcular la cadena de huellas.");
    if (r.error) return h("p", { class: "aviso", "data-tono": "critico" }, r.error);
    if (r.roto) {
      return h("div", { class: "aviso", "data-tono": "critico", role: "alert" }, ui.icon("octagon-alert"),
        h("div", null, h("p", { class: "verif-roto" }, "Cadena rota en el evento " + r.roto.pos + " de " + r.n),
          h("p", { class: "sec", style: { margin: 0 } }, r.roto.ev.id + " · " + fmt.fechaHora(r.roto.ev.ts) + ": su contenido no coincide con el de la última verificación. Desde ahí, todas las huellas cambian.")));
    }
    return h("div", { class: "aviso", "data-tono": "ok" }, ui.icon("circle-check"),
      h("div", null, h("p", { style: { margin: 0 } }, h("b", null, "Cadena correcta: " + r.n + " eventos"), " · última huella ", h("span", { class: "mono" }, r.ultima.slice(0, 8))),
        h("p", { class: "sec", style: { margin: 0 } }, r.primera ? "Ningún evento ha cambiado desde que se registró." : r.nuevos ? "Ningún evento anterior ha cambiado; " + r.nuevos + (r.nuevos === 1 ? " evento nuevo añadido." : " eventos nuevos añadidos.") : "Ningún evento ha cambiado.")));
  }
  function nombreRol(id) { var r = ui.rolInfo(id); return id === "sistema" ? "Sistema" : (r && r.id === id ? r.nombre : (id || "—")); }
  function texto(v) { if (v === null || v === undefined || v === "") return "—"; if (typeof v === "object") return JSON.stringify(v); return String(v); }
  ING.rutas["mas/registro"] = function () {
    var evs = eventosOrdenados();
    if (!reg.base && !reg.manip && ING.sha256) { try { verificar(); } catch (e) { reg.base = null; } }
    var tipos = {}; evs.forEach(function (e) { tipos[e.tipo] = (tipos[e.tipo] || 0) + 1; });
    var zonaRes = h("div", { class: "verificacion", testid: "resultado-verificacion", role: "status", "aria-live": "polite" }, nodoResultado(reg.resultado));
    var lista = h("ol", { class: "ev-lista", reversed: true });
    var btnRest;
    function pintarLista() {
      var L = evs.filter(function (e) { return !reg.tipo || e.tipo === reg.tipo; }).slice(-50).reverse();
      lista.textContent = "";
      if (!L.length) { lista.appendChild(h("li", { class: "vacio" }, "No hay eventos de este tipo.")); return; }
      L.forEach(function (e) {
        var manipulado = reg.manip && reg.manip.id === e.id;
        lista.appendChild(h("li", { class: "ev", testid: "evento", "data-tipo": e.tipo, "data-roto": manipulado ? "1" : null },
          h("div", { class: "ev-meta" }, h("span", { class: "num" }, fmt.fechaHora(e.ts)), h("span", null, nombreRol(e.rol)), h("span", { class: "ev-tipo" }, NOMBRES_TIPO[e.tipo] || e.tipo),
            e.expediente_id ? h("a", { href: "#/exp/" + e.expediente_id + "/registro" }, e.expediente_id) : null),
          h("div", { class: "ev-res" }, ui.md(manipulado ? reg.manip.resumen : e.resumen)),
          (e.cambios || []).map(function (c) { return h("div", { class: "ev-cambio" }, c.campo + ": " + texto(c.antes) + " → " + texto(c.despues)); }),
          e.motivo ? h("div", { class: "ev-cambio" }, "Motivo: " + e.motivo) : null));
      });
    }
    function verificarYPintar() {
      reg.resultado = verificar();
      zonaRes.textContent = ""; zonaRes.appendChild(nodoResultado(reg.resultado));
    }
    var sel = h("select", { class: "input select-filtro", "aria-label": "Filtrar por tipo de evento", testid: "filtro-tipo-evento",
      onchange: function () { reg.tipo = sel.value; pintarLista(); } },
      h("option", { value: "" }, "Todos los tipos (" + evs.length + ")"),
      Object.keys(tipos).sort().map(function (t) { return h("option", { value: t, selected: reg.tipo === t }, (NOMBRES_TIPO[t] || t) + " (" + tipos[t] + ")"); }));
    btnRest = h("button", { type: "button", class: "btn btn-sec", testid: "btn-restaurar", disabled: !reg.manip,
      onclick: function () { reg.manip = null; btnRest.disabled = true; verificarYPintar(); pintarLista(); ui.toast("Registro restaurado"); } }, ui.icon("rotate-ccw"), "Restaurar");
    pintarLista();
    return h("div", null,
      cabecera("Registro y trazabilidad", "#/mas"),
      h("p", { class: "aviso", "data-tono": "novalido" }, ui.icon("info"), h("span", null, "Demostración de trazabilidad; en producción el registro iría en una base de datos inalterable.")),
      h("section", { class: "tarjeta seccion" },
        h("h2", null, "Cadena de huellas"),
        h("p", { class: "sec muted" }, "Cada evento se encadena con el anterior mediante su huella SHA-256. Si alguien cambia un evento antiguo, la cadena se rompe en ese punto."),
        h("div", { class: "botones" },
          h("button", { type: "button", class: "btn", testid: "btn-verificar", onclick: verificarYPintar }, ui.icon("shield-alert"), "Verificar integridad")),
        zonaRes,
        h("div", { class: "botones" },
          h("button", { type: "button", class: "btn btn-sec", testid: "btn-simular-manipulacion", onclick: function () {
            if (!evs.length) return;
            if (!reg.base) verificar();                 // primero se fija la referencia con los datos reales
            var victima = evs[Math.floor(evs.length / 2)];
            reg.manip = { id: victima.id, resumen: String(victima.resumen || "") + " (modificado)" };
            btnRest.disabled = false;
            verificarYPintar(); pintarLista();
          } }, ui.icon("pencil"), "Simular manipulación"),
          btnRest),
        h("p", { class: "min muted" }, "«Simular manipulación» cambia el resumen de un evento solo en la memoria de esta pantalla; no toca los datos.")),
      h("section", { class: "seccion" },
        h("div", { class: "fila-sep" }, h("h2", { style: { margin: 0 } }, "Últimos 50 eventos"), sel),
        lista));
  };

  /* ---------- #/mas/compartir ---------- */
  ING.rutas["mas/compartir"] = function () {
    var url = (ui.cat().parametros || {}).url_publica || "https://javierblancobdjz-cmyk.github.io/ingulados-demo/";
    var qr = ui.qr(url, 240);
    qr.setAttribute("data-testid", "qr-compartir");
    function copiar() {
      var hecho = function () { ui.toast("Enlace copiado"); };
      var fallo = function () {
        try {
          var ta = h("textarea", { class: "sr-only" }); ta.value = url; document.body.appendChild(ta); ta.select();
          var ok = document.execCommand && document.execCommand("copy"); document.body.removeChild(ta);
          ui.toast(ok ? "Enlace copiado" : "No se ha podido copiar; mantén pulsada la dirección para copiarla");
        } catch (e) { ui.toast("No se ha podido copiar; mantén pulsada la dirección para copiarla"); }
      };
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(hecho, fallo); else fallo(); } catch (e) { fallo(); }
    }
    return h("div", null,
      cabecera("Compartir la demo", "#/mas"),
      h("div", { class: "tarjeta compartir" },
        qr,
        h("p", { class: "url-publica", testid: "url-publica" }, url),
        h("button", { type: "button", class: "btn", testid: "btn-copiar-enlace", onclick: copiar }, ui.icon("copy-plus"), "Copiar enlace"),
        h("p", { class: "sec" }, "Abre la demo en tu móvil: los cambios que hagas se quedan en tu dispositivo.")));
  };

  /* ---------- #/mas/ajustes ---------- */
  ING.rutas["mas/ajustes"] = function () {
    var tema = ui.tema();
    var seg = h("div", { class: "segmentado", role: "group", "aria-label": "Tema" });
    [["auto", "Automático", "tema-auto", "settings"], ["light", "Claro", "tema-claro", "sun"], ["dark", "Oscuro", "tema-oscuro", "moon"]].forEach(function (t) {
      seg.appendChild(h("button", { type: "button", testid: t[2], "aria-pressed": tema === t[0] ? "true" : "false",
        onclick: function () { ui.setTema(t[0]); Array.prototype.forEach.call(seg.children, function (b) { b.setAttribute("aria-pressed", b === this ? "true" : "false"); }, this); } },
        ui.icon(t[3]), t[1]));
    });
    var pres = h("input", { type: "checkbox", role: "switch", testid: "modo-presentacion", checked: ui.presentacion(),
      onchange: function () { ui.setPresentacion(pres.checked); } });
    var modoAlm = "memoria"; try { modoAlm = ING.store.modo(); } catch (e) { /* nada */ }
    var textoAlm = { db: "En vivo: los cambios se comparten con los dispositivos conectados al artifact.", local: "Solo este dispositivo: los cambios se guardan en este navegador.", memoria: "Sin guardar: este navegador no permite guardar; los cambios se pierden al recargar." }[modoAlm] || "";
    var rolAct = ui.rolActual();
    return h("div", null,
      cabecera("Ajustes", "#/mas"),
      h("div", { class: "tarjeta" },
        h("section", { class: "ajuste" }, h("h2", null, "Tema"), seg),
        h("section", { class: "ajuste" },
          h("label", { class: "interruptor" }, h("span", null, h("b", null, "Modo presentación"), h("br"), h("span", { class: "sec muted" }, "Letra un 25 % más grande para proyectar")), pres)),
        h("section", { class: "ajuste" }, h("h2", null, "Modo"),
          h("div", { class: "modo-op" }, h("span", { class: "chip", "data-tono": "ok" }, ui.icon("circle-check"), "Simulación"), h("span", { class: "sec" }, "Activo · datos ficticios")),
          h("div", { class: "modo-op" }, h("span", { class: "chip", "data-tono": "novalido" }, ui.icon("lock"), "Pruebas"), h("span", { class: "sec muted" }, "Desactivado: requiere integración con los sistemas de Ingulados")),
          h("div", { class: "modo-op" }, h("span", { class: "chip", "data-tono": "novalido" }, ui.icon("lock"), "Real"), h("span", { class: "sec muted" }, "Desactivado: requiere integración con los sistemas de Ingulados"))),
        h("section", { class: "ajuste" }, h("h2", null, "Rol"),
          h("p", { class: "sec muted" }, "No es un inicio de sesión: el rol solo se registra en cada acción."),
          h("div", { class: "segmentado segmentado-rol", role: "group", "aria-label": "Rol" }, ui.ROLES.map(function (r) {
            return h("button", { type: "button", testid: "ajuste-rol-" + r.id, "aria-pressed": r.id === rolAct ? "true" : "false",
              onclick: function () { if (r.id !== ui.rolActual()) Promise.resolve(ui.setRol(r.id)).then(function () { ui.toast("Rol: " + r.nombre); }); } }, r.nombre);
          }))),
        h("section", { class: "ajuste" }, h("h2", null, "Almacenamiento"), h("p", { class: "sec" }, textoAlm)),
        h("section", { class: "ajuste" }, h("h2", null, "Reiniciar demo"),
          h("p", { class: "sec muted" }, "Borra los cambios hechos en esta demo y vuelve a los datos de fábrica."),
          h("button", { type: "button", class: "btn btn-peligro", testid: "btn-reiniciar", onclick: function () {
            ui.dialogo({
              titulo: "¿Reiniciar la demo?", testid: "dialogo-reiniciar",
              cuerpo: h("p", null, "Se borran todos los cambios hechos en esta demo y vuelven los datos de fábrica"),
              botones: [
                { texto: "Cancelar", tipo: "sec", testid: "btn-cancelar-reinicio" },
                { texto: "Reiniciar", tipo: "peligro", testid: "btn-confirmar-reinicio", onClick: function () {
                  reg.base = null; reg.manip = null; reg.resultado = null;
                  return Promise.resolve(ING.store.reiniciar()).then(function () { ui.toast("Demo reiniciada: datos de fábrica"); });
                } }]
            });
          } }, ui.icon("rotate-ccw"), "Reiniciar demo")),
        h("section", { class: "ajuste" }, h("h2", null, "Versión"), h("p", { class: "build-id", testid: "build" }, ING.build || "—"))));
  };
})();

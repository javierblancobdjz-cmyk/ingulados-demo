/* store.js · Paquete A · vista combinada (semilla + cambios) y adaptadores db / local / memoria (CONTRATO §9).
   API: ING.store.{db(), modo(), rol(), setRol(r), guardar(col, doc, evento), guardarVarios([{col,doc}], evento),
                   reiniciar(), on(fn)}  + opcionales: textoModo(), dispositivo(), ahora()
   - db() devuelve la vista combinada {expedientes:{}, muestras:{}, …}. NO se muta: es la misma referencia
     hasta el siguiente cambio (el motor la usa como clave de caché).
   - guardar/guardarVarios devuelven una Promise que resuelve {ok, modo, ref?}. Si en modo db la referencia
     del expediente ya la ha usado otro dispositivo, se renumera y `ref` trae la definitiva. */
(function (root) {
  "use strict";
  var ING = root.ING = root.ING || {};
  var COLS = ["expedientes", "muestras", "analisis", "aislados", "tandas", "informes", "valoraciones", "comunicaciones", "eventos"];
  var CLAVE = "ing-demo-v1", CLAVE_ROL = "ing-rol", CLAVE_DISP = "ing-dispositivo";
  var ROLES = ["recepcion", "microbiologia", "molecular", "responsable"];

  /* ------------------------------------------------------------ localStorage seguro */
  function lsGet(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { root.localStorage.removeItem(k); return true; } catch (e) { return false; } }
  function lsDisponible() {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem("ing-prueba", "1");
      root.localStorage.removeItem("ing-prueba");
      return true;
    } catch (e) { return false; }
  }

  function aleatorio(n) { var s = ""; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); }

  var disp = lsGet(CLAVE_DISP);
  if (!/^d[0-9a-z]{4}$/.test(disp || "")) { disp = "d" + aleatorio(4); lsSet(CLAVE_DISP, disp); }

  var rolMem = lsGet(CLAVE_ROL);
  if (ROLES.indexOf(rolMem) < 0) rolMem = "responsable";

  function ahora() {
    var d = new Date(Date.now() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 19) + "+02:00";
  }

  /* ------------------------------------------------------------ estado */
  var base = null;          // semilla como mapas por id
  var cambios = vacio();    // memoria / local: {col:{id:doc}}
  var epochLocal = 0;
  var modo = "memoria";
  var vista = null;         // caché de la vista combinada
  var oyentes = [];
  var aviso = false;

  // modo db
  var dbns = null, remoto = vacio(), pend = vacio(), epochDb = 0, desuscribir = [];

  function vacio() { var o = {}; COLS.forEach(function (c) { o[c] = {}; }); return o; }

  function semillaBase() {
    if (base) return base;
    base = {};
    var s = ING.semilla || {};
    COLS.forEach(function (c) {
      var m = {};
      (s[c] || []).forEach(function (x) { m[x.id] = x; });
      base[c] = m;
    });
    return base;
  }

  function cambiosVigentes() {
    if (modo !== "db") return cambios;
    var out = vacio();
    COLS.forEach(function (c) {
      var r = remoto[c], p = pend[c], k;
      for (k in r) if ((r[k].epoch || 0) === epochDb) out[c][k] = r[k];
      for (k in p) if ((p[k].epoch || 0) === epochDb) out[c][k] = p[k];
    });
    return out;
  }

  function db() {
    if (vista) return vista;
    var b = semillaBase(), ch = cambiosVigentes(), v = {};
    COLS.forEach(function (c) {
      var keys = Object.keys(ch[c]);
      if (!keys.length) { v[c] = b[c]; return; }
      var m = {}, k;
      for (k in b[c]) m[k] = b[c][k];
      keys.forEach(function (k2) { m[k2] = ch[c][k2]; });
      v[c] = m;
    });
    vista = v;
    return v;
  }

  /* ------------------------------------------------------------ notificación (una vez por fotograma) */
  function marcar() {
    vista = null;
    if (aviso) return;
    aviso = true;
    var f = function () {
      aviso = false;
      oyentes.slice().forEach(function (fn) { try { fn(); } catch (e) { if (root.console) root.console.error(e); } });
    };
    if (typeof root.requestAnimationFrame === "function" && typeof document !== "undefined" && !document.hidden) root.requestAnimationFrame(f);
    else setTimeout(f, 0);
  }
  function on(fn) {
    oyentes.push(fn);
    return function () { oyentes = oyentes.filter(function (x) { return x !== fn; }); };
  }

  /* ------------------------------------------------------------ local */
  function cargarLocal() {
    var raw = lsGet(CLAVE);
    cambios = vacio(); epochLocal = 0;
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      epochLocal = o.epoch || 0;
      COLS.forEach(function (c) { if (o.cambios && o.cambios[c]) cambios[c] = o.cambios[c]; });
    } catch (e) { /* clave corrupta: se ignora */ }
  }
  function guardarLocal() {
    if (modo !== "local") return true;
    var ok = lsSet(CLAVE, JSON.stringify({ epoch: epochLocal, cambios: cambios }));
    if (!ok) { modo = "memoria"; marcar(); }
    return ok;
  }

  function pasarALocal(conservar) {
    var actuales = conservar ? cambiosVigentes() : null;
    desuscribir.forEach(function (u) { try { u(); } catch (e) { /* nada */ } });
    desuscribir = []; dbns = null;
    if (lsDisponible()) {
      modo = "local";
      cargarLocal();
      if (actuales) { COLS.forEach(function (c) { for (var k in actuales[c]) cambios[c][k] = actuales[c][k]; }); guardarLocal(); }
    } else {
      modo = "memoria";
      if (actuales) cambios = actuales;
    }
    marcar();
  }

  /* ------------------------------------------------------------ db (artifact de claude.ai) */
  function canonSimple(o) {
    if (o === null || typeof o !== "object") return JSON.stringify(o);
    if (Array.isArray(o)) return "[" + o.map(canonSimple).join(",") + "]";
    return "{" + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ":" + canonSimple(o[k]); }).join(",") + "}";
  }

  function conectarDb(ns) {
    var previos = cambios;  // lo hecho en memoria antes de conectar
    dbns = ns; modo = "db"; remoto = vacio(); pend = vacio();
    var fallo = function () { if (modo === "db") falloDb(); };
    try {
      desuscribir.push(ns.doc("config/demo").onSnapshot(function (s) {
        var d = s && s.exists ? s.data() : null;
        epochDb = d && typeof d.epoch === "number" ? d.epoch : 0;
        marcar();
      }, fallo));
      COLS.forEach(function (c) {
        desuscribir.push(ns.collection(c).onSnapshot(function (qs) {
          var m = {};
          (qs.docs || []).forEach(function (d) { var x = d.data(); if (x) m[d.id] = x; });
          remoto[c] = m;
          for (var k in pend[c]) if (pend[c][k].__ok && m[k] && canonSimple(m[k]) === pend[c][k].__canon) delete pend[c][k];
          marcar();
        }, fallo));
      });
    } catch (e) { falloDb(); return; }
    cambios = vacio();
    // volcar lo que se hizo antes de conectar (normalmente nada)
    COLS.forEach(function (c) {
      Object.keys(previos[c]).forEach(function (k) { var d = Object.assign({}, previos[c][k], { epoch: epochDb }); escribirDb(c, d); });
    });
    marcar();
  }

  function falloDb() {
    if (modo !== "db") return;
    pasarALocal(true);
    try { if (ING.ui && ING.ui.toast) ING.ui.toast("No se ha podido sincronizar; sigue en este dispositivo"); } catch (e) { /* nada */ }
  }

  function escribirDb(col, doc) {
    var copia = JSON.parse(JSON.stringify(doc));
    var reg = Object.assign({}, copia);
    Object.defineProperty(reg, "__canon", { value: canonSimple(copia), enumerable: false });
    Object.defineProperty(reg, "__ok", { value: false, enumerable: false, writable: true });
    pend[col][doc.id] = reg;
    vista = null;
    return dbns.collection(col).doc(doc.id).set(copia).then(function () {
      reg.__ok = true;
      var r = remoto[col][doc.id];
      if (r && canonSimple(r) === reg.__canon && pend[col][doc.id] === reg) delete pend[col][doc.id];
    });
  }

  function arrancar() {
    semillaBase();
    var cl = root.claude;
    if (!cl || typeof cl.use !== "function") { pasarALocal(false); return; }
    var hecho = false;
    var limite = setTimeout(function () { if (!hecho) { hecho = true; pasarALocal(false); } }, 4000);
    var p;
    try { p = Promise.resolve(cl.use("db")); } catch (e) { p = Promise.resolve(null); }
    p.then(function (ns) {
      if (hecho) return;
      hecho = true; clearTimeout(limite);
      if (ns && typeof ns.collection === "function") conectarDb(ns);
      else pasarALocal(false);
    }, function () {
      if (hecho) return;
      hecho = true; clearTimeout(limite);
      pasarALocal(false);
    });
  }

  /* ------------------------------------------------------------ escritura */
  function epochActual() { return modo === "db" ? epochDb : epochLocal; }

  function completarDoc(doc) {
    var d = JSON.parse(JSON.stringify(doc));
    d.origen_dato = "usuario";
    d.dispositivo = disp;
    d.epoch = epochActual();
    return d;
  }

  function completarEvento(ev, col, doc) {
    var t = Date.now();
    var e = Object.assign({
      tipo: null, coleccion: col || null, entidad_id: doc ? doc.id : null,
      expediente_id: doc ? (doc.expediente_id || (col === "expedientes" ? doc.id : null)) : null,
      resumen: "", cambios: [], motivo: null
    }, JSON.parse(JSON.stringify(ev)));
    e.id = "EV-" + disp + "-" + t + "-" + aleatorio(4);
    e.ts = ahora();
    e.rol = rolMem;
    e.dispositivo = disp;
    e.epoch = epochActual();
    if (!Array.isArray(e.cambios)) e.cambios = [];
    if (e.motivo === undefined) e.motivo = null;
    return e;
  }

  function escribirLocalOMem(lista) {
    lista.forEach(function (x) { cambios[x.col][x.doc.id] = x.doc; });
    if (modo === "local") guardarLocal();
    marcar();
    return Promise.resolve({ ok: true, modo: modo });
  }

  function maxRef(v) {
    var mx = 0;
    Object.keys(v.expedientes).forEach(function (k) { var m = /^ING-26-(\d{4})$/.exec(k); if (m) mx = Math.max(mx, +m[1]); });
    return mx;
  }

  function guardarVarios(items, evento) {
    items = (items || []).filter(function (x) { return x && x.col && x.doc && x.doc.id != null; });
    for (var i = 0; i < items.length; i++) if (COLS.indexOf(items[i].col) < 0) return Promise.reject(new Error("Colección desconocida: " + items[i].col));
    var lista = items.map(function (x) { return { col: x.col, doc: completarDoc(x.doc) }; });
    var principal = lista[0] || null;
    var ev = evento ? completarEvento(evento, principal && principal.col, principal && principal.doc) : null;
    if (ev) lista.push({ col: "eventos", doc: ev });

    if (modo !== "db") return escribirLocalOMem(lista);

    var v = db();
    var nuevoExp = lista.filter(function (x) { return x.col === "expedientes" && !v.expedientes[x.doc.id]; })[0];
    var comprobar = nuevoExp ? dbns.collection("expedientes").doc(nuevoExp.doc.id).get().then(function (s) {
      var d = s && s.exists ? s.data() : null;
      if (!d || (d.epoch || 0) !== epochDb) return null;
      var viejo = nuevoExp.doc.id;
      var nuevo = "ING-26-" + ("0000" + (Math.max(maxRef(db()), +viejo.slice(-4)) + 1)).slice(-4);
      var txt = JSON.stringify(lista).split(viejo).join(nuevo);
      lista = JSON.parse(txt);
      return nuevo;
    }, function () { return null; }) : Promise.resolve(null);

    return comprobar.then(function (renombrado) {
      var datos = lista.filter(function (x) { return x.col !== "eventos"; });
      var evs = lista.filter(function (x) { return x.col === "eventos"; });
      // escritura optimista: se ve ya; la confirmación llega por onSnapshot
      var pDatos = Promise.all(datos.map(function (x) { return escribirDb(x.col, x.doc); }));
      var pEv = pDatos.then(function () { return Promise.all(evs.map(function (x) { return escribirDb(x.col, x.doc); })); });
      evs.forEach(function (x) { pend.eventos[x.doc.id] = pend.eventos[x.doc.id] || x.doc; });
      marcar();
      return pEv.then(function () {
        var r = { ok: true, modo: "db" };
        if (renombrado) r.ref = renombrado;
        return r;
      }, function () {
        // el cambio se mantiene en este dispositivo
        COLS.forEach(function (c) { for (var k in pend[c]) pend[c][k] = Object.assign({}, pend[c][k]); });
        falloDb();
        var r = { ok: true, modo: modo, sincronizado: false };
        if (renombrado) r.ref = renombrado;
        return r;
      });
    });
  }

  function guardar(col, doc, evento) { return guardarVarios([{ col: col, doc: doc }], evento); }

  function reiniciar() {
    var evBase = { tipo: "DEMO_REINICIADA", coleccion: null, entidad_id: null, expediente_id: null, resumen: "Demo reiniciada: vuelven los datos de fábrica" };
    if (modo === "db" && dbns) {
      var e1 = epochDb + 1;
      epochDb = e1; pend = vacio(); marcar();
      return dbns.doc("config/demo").set({ epoch: e1, actualizado_en: ahora() }).then(function () {
        return guardarVarios([], evBase);
      }, function () { falloDb(); cambios = vacio(); guardarLocal(); return guardarVarios([], evBase); });
    }
    cambios = vacio(); epochLocal = 0;
    if (modo === "local") lsDel(CLAVE);
    marcar();
    return guardarVarios([], evBase);
  }

  /* ------------------------------------------------------------ rol */
  function rol() { return rolMem; }
  function setRol(r) {
    if (ROLES.indexOf(r) < 0 || r === rolMem) return Promise.resolve({ ok: true, modo: modo });
    var antes = rolMem;
    rolMem = r;
    lsSet(CLAVE_ROL, r);
    var nombre = function (id) { var x = ING.idx && ING.idx.roles && ING.idx.roles[id]; return x ? x.nombre : id; };
    return guardarVarios([], {
      tipo: "ROL_CAMBIADO", coleccion: null, entidad_id: null, expediente_id: null,
      resumen: "Rol cambiado a " + nombre(r), cambios: [{ campo: "rol", antes: antes, despues: r }]
    });
  }

  function textoModo() { return modo === "db" ? "● En vivo" : modo === "local" ? "Solo este dispositivo" : "Sin guardar"; }

  // otra pestaña del mismo navegador (modo local)
  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", function (e) {
      if (modo === "local" && e && e.key === CLAVE) { cargarLocal(); marcar(); }
    });
  }

  ING.store = {
    db: db, modo: function () { return modo; }, rol: rol, setRol: setRol,
    guardar: guardar, guardarVarios: guardarVarios, reiniciar: reiniciar, on: on,
    textoModo: textoModo, dispositivo: function () { return disp; }, ahora: ahora, colecciones: COLS.slice()
  };

  if (typeof document !== "undefined") arrancar();
})(typeof window !== "undefined" ? window : globalThis);

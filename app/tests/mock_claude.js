/* mock_claude.js · Paquete A · script para page.add_init_script(): simula window.claude.use("db") del artifact.
   Respaldo: localStorage["mockdb"] = {"<col>/<id>": doc} y BroadcastChannel("mockdb") para avisar a otras páginas
   del mismo contexto. Forma de db.d.ts: snapshots con docs[].id, docs[].data(), exists, metadata.
   Opciones (antes de cargar la app): window.__mockdb = {latencia: ms, fallarEscritura: bool, nulo: bool}. */
(function () {
  "use strict";
  var CLAVE = "mockdb";
  var canal = null;
  try { canal = new BroadcastChannel("mockdb"); } catch (e) { canal = null; }
  function opts() { return window.__mockdb || {}; }
  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}"); } catch (e) { return {}; } }
  function escribir(o) { localStorage.setItem(CLAVE, JSON.stringify(o)); }
  function clon(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function despues(fn) { setTimeout(fn, opts().latencia || 15); }
  var meta = { fromCache: false, hasPendingWrites: false };

  function snapDoc(path, data) {
    var id = path.split("/").pop();
    return { id: id, exists: data != null, data: function () { return data == null ? undefined : clon(data); }, metadata: meta };
  }
  function snapCol(col) {
    var all = leer(), docs = [];
    Object.keys(all).sort().forEach(function (k) {
      var i = k.lastIndexOf("/");
      if (k.slice(0, i) === col) docs.push(snapDoc(k, all[k]));
    });
    return { docs: docs, size: docs.length, empty: !docs.length, metadata: meta, docChanges: function () { return []; } };
  }

  var oyentes = [];   // {tipo:"doc"|"col", path, next}
  function avisar(path) {
    oyentes.slice().forEach(function (o) {
      if (o.tipo === "doc" && o.path === path) o.next(snapDoc(path, leer()[path]));
      if (o.tipo === "col" && path.slice(0, path.lastIndexOf("/")) === o.path) o.next(snapCol(o.path));
    });
  }
  if (canal) canal.onmessage = function (ev) { if (ev && ev.data && ev.data.path) avisar(ev.data.path); };
  window.addEventListener("storage", function (ev) { if (ev.key === CLAVE) oyentes.slice().forEach(function (o) { o.next(o.tipo === "doc" ? snapDoc(o.path, leer()[o.path]) : snapCol(o.path)); }); });

  function docRef(path) {
    return {
      id: path.split("/").pop(), path: path,
      get: function () { return new Promise(function (res) { despues(function () { res(snapDoc(path, leer()[path])); }); }); },
      set: function (data) {
        return new Promise(function (res, rej) {
          despues(function () {
            if (opts().fallarEscritura) { rej({ code: "unavailable", message: "mock: escritura rechazada" }); return; }
            var all = leer(); all[path] = clon(data); escribir(all);
            avisar(path);
            if (canal) canal.postMessage({ path: path });
            res();
          });
        });
      },
      update: function (data) {
        var self = this;
        return self.get().then(function (s) {
          if (!s.exists) throw { code: "invalid_argument", message: "mock: no existe" };
          return self.set(Object.assign(s.data(), data));
        });
      },
      delete: function () {
        return new Promise(function (res) {
          despues(function () { var all = leer(); delete all[path]; escribir(all); avisar(path); if (canal) canal.postMessage({ path: path }); res(); });
        });
      },
      onSnapshot: function (next, err) {
        var o = { tipo: "doc", path: path, next: next, err: err };
        oyentes.push(o);
        despues(function () { if (oyentes.indexOf(o) >= 0) next(snapDoc(path, leer()[path])); });
        return function () { oyentes = oyentes.filter(function (x) { return x !== o; }); };
      },
      collection: function (sub) { return colRef(path + "/" + sub); }
    };
  }
  function colRef(path) {
    var c = {
      path: path,
      doc: function (id) { return docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12))); },
      add: function (data) { var r = c.doc(); return r.set(data).then(function () { return r; }); },
      get: function () { return new Promise(function (res) { despues(function () { res(snapCol(path)); }); }); },
      where: function () { return c; }, orderBy: function () { return c; }, limit: function () { return c; },
      onSnapshot: function (next, err) {
        var o = { tipo: "col", path: path, next: next, err: err };
        oyentes.push(o);
        despues(function () { if (oyentes.indexOf(o) >= 0) next(snapCol(path)); });
        return function () { oyentes = oyentes.filter(function (x) { return x !== o; }); };
      }
    };
    return c;
  }
  var DB = Object.freeze({ doc: docRef, collection: colRef });

  window.claude = Object.freeze({
    use: function (name) {
      return new Promise(function (res) {
        despues(function () { res(name === "db" && !opts().nulo ? DB : null); });
      });
    }
  });
})();

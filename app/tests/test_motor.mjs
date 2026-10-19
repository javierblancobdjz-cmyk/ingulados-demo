// test_motor.mjs · Paquete A · node tests/test_motor.mjs
// Carga sha256.js, datos.js y motor.js en un contexto vm con la semilla y compara con esperado.json.
// Imprime "OK n/n" o el primer desajuste (código de salida 1).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, "..");
const leer = (p) => fs.readFileSync(path.join(APP, p), "utf8");
const json = (p) => JSON.parse(leer(p));

const ctx = { console, Math, JSON, Date, Number, String, Object, Array, WeakMap, Promise, setTimeout, clearTimeout };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["src/js/sha256.js", "src/js/datos.js", "src/js/motor.js", "src/js/store.js"]) vm.runInContext(leer(f), ctx, { filename: f });
const ING = ctx.ING;
ING.initDatos({ catalogos: json("src/data/catalogos.json"), reglas: json("src/data/reglas.json"), semilla: json("src/data/semilla.json"), referencias: json("src/data/referencias.json") });
const E = json("tests/esperado.json");
const M = ING.motor;

function mapa(sem) {
  const o = {};
  for (const c of ["expedientes", "muestras", "analisis", "aislados", "tandas", "informes", "valoraciones", "comunicaciones", "eventos"]) {
    o[c] = {};
    for (const x of sem[c] || []) o[c][x.id] = x;
  }
  return o;
}
const DB = mapa(ING.semilla);

let n = 0, ok = 0;
const fallos = [];
function canon(x) { return M.canon(JSON.parse(JSON.stringify(x === undefined ? null : x))); }
function check(nombre, obtenido, esperado) {
  n++;
  if (canon(obtenido) === canon(esperado)) { ok++; return true; }
  fallos.push(`${nombre}\n  obtenido: ${canon(obtenido).slice(0, 600)}\n  esperado: ${canon(esperado).slice(0, 600)}`);
  return false;
}

// A2 / A3
check("A2 sha256('abc')", ING.sha256("abc"), "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD");
check("A3 sha256(canon_ejemplo)", ING.sha256(E.canon_ejemplo.canon), E.huella_actual[E.canon_ejemplo.expediente]);
check("canon(snapshot) == canon_ejemplo", M.canon(M.snapshot(DB, E.canon_ejemplo.expediente)), E.canon_ejemplo.canon);

// A1
for (const [ref, est] of Object.entries(E.estado_expediente)) check(`estado_expediente ${ref}`, M.estadoExpediente(DB, ref), est);
for (const [aid, est] of Object.entries(E.estado_analisis)) check(`estado_analisis ${aid}`, M.estadoAnalisis(DB, DB.analisis[aid]), est);
for (const [aid, r] of Object.entries(E.resultado_pcr)) check(`resultado_pcr ${aid}`, M.resultadoPCR(DB, DB.analisis[aid]), r);
for (const [aid, t] of Object.entries(E.tanda_vigente)) check(`tanda_vigente ${aid}`, (M.tandaVigente(DB, aid) || {}).id ?? null, t);
for (const [tid, v] of Object.entries(E.validez_tanda)) {
  const r = M.validezTanda(DB, DB.tandas[tid]);
  check(`validez_tanda ${tid}`, { valida: r.valida, reglas: r.reglas }, v);
}
const noValidas = Object.keys(E.validez_tanda).filter((t) => !M.validezTanda(DB, DB.tandas[t]).valida).map((t) => `${t} ${M.validezTanda(DB, DB.tandas[t]).reglas.join(",")}`);
check("tandas no válidas", noValidas, ["T-2026-051 PCR-03", "T-2026-053 PCR-01", "T-2026-069 PCR-02"]);
const campos = ["clave", "regla_id", "nivel", "capa", "estado", "patogeno_id", "requiere_comunicacion", "comunicacion_pendiente", "detectado_en", "expediente_id"];
const pick = (a) => Object.fromEntries(campos.map((k) => [k, a[k] ?? null]));
const todas = M.alertasTodas(DB).map(pick);
check("alertas (n)", todas.length, E.alertas.length);
E.alertas.forEach((a, i) => check(`alerta ${a.clave}`, todas[i], pick(a)));
for (const [ref, h] of Object.entries(E.huella_actual)) check(`huella ${ref}`, M.huella(DB, ref), h);
const pan = M.panel(DB, null);
for (const [k, v] of Object.entries(E.panel)) check(`panel.${k}`, pan[k], v);
check("panel: mismas claves que esperado.panel", Object.keys(pan).sort(), Object.keys(E.panel).sort());
check("positividad_por_diana", M.positividadPorDiana(DB, null), E.positividad_por_diana);
const rec = {};
for (const ref of Object.keys(DB.expedientes)) { const s = M.estadoExpediente(DB, ref); rec[s] = (rec[s] || 0) + 1; }
check("recuento_estados", rec, E.recuento_estados);

// A4
check("A4 siguienteRef", M.siguienteRef(DB), "ING-26-0353");
check("A4 siguienteTanda", M.siguienteTanda(DB), "T-2026-085");
check("siguiente_referencia oráculo", M.siguienteRef(DB), E.siguiente_referencia);

// A5
const ids = (l) => l.map((x) => `${x.analisis_id}/${x.plan_id}`);
check("A5 montería jabalí ganglio", ids(M.planMuestra({ motivo_id: "monteria", signos: ["lesiones_tb"], sospecha_id: "mtbc" }, { especie_id: "jabali", tipo_muestra_id: "ganglio" })), ["cult_piogenos/PL01", "pcr_mtbc/PL01"]);
check("A5 aborto caprino", ids(M.planMuestra({ motivo_id: "aborto", signos: ["aborto"], sospecha_id: null }, { especie_id: "caprino", tipo_muestra_id: "feto_placenta" })), ["cult_aborto/PL05", "pcr_bru/PL05", "pcr_cox/PL05", "pcr_chl/PL05"]);
check("A5 jabalí bazo hallado muerto", ids(M.planMuestra({ motivo_id: "hallado_muerto", signos: [], sospecha_id: null }, { especie_id: "jabali", tipo_muestra_id: "bazo" })), ["pcr_vppa/PL09", "pcr_adv/PL11"]);
check("A5 bovino heces", ids(M.planMuestra({ motivo_id: "brote_clinica", signos: ["diarrea", "adelgazamiento"], sospecha_id: null }, { especie_id: "bovino", tipo_muestra_id: "heces" })), ["cult_general/PL03", "cult_salmonella/PL03", "pcr_map/PL04"]);

// bandejas
check("bandejaMicro (n)", M.bandejaMicro(DB).length, E.panel.bandeja_micro);
check("bandejaMolecular (n)", M.bandejaMolecular(DB).length, E.panel.bandeja_molecular);
const bm = M.bandejaMicro(DB);
check("bandejaMicro ordenada", bm.every((a, i) => i === 0 || bm[i - 1].solicitado_en <= a.solicitado_en), true);
check("bandejaMicro incluye 0351-M01", bm.some((a) => a.id === "ING-26-0351-M01-cult_piogenos"), true);

// A6: guion sobre ING-26-0351, con vistas nuevas (inmutables) en cada paso
const REF = "ING-26-0351";
const con = (db, colN, doc) => ({ ...db, [colN]: { ...db[colN], [doc.id]: doc } });
let d = DB;
const sec = [M.estadoExpediente(d, REF)];
const a1 = { ...d.analisis["ING-26-0351-M01-cult_piogenos"], resultado: { opcion_id: "sin_crecimiento", observaciones: "" }, resultado_en: "2026-10-19T21:00:00+02:00", resultado_por: "responsable" };
d = con(d, "analisis", a1);
sec.push(M.estadoExpediente(d, REF));
const pend = M.alertas(d, REF).filter((a) => a.estado === "pendiente");
check("A6 2 alertas pendientes", pend.map((a) => a.clave), ["PCR-04~ING-26-0351-M03-pcr_mtbc", "SAN-03~ING-26-0351~mtbc"]);
for (const al of pend) d = con(d, "valoraciones", { id: al.clave, alerta_key: al.clave, regla_id: al.regla_id, expediente_id: REF, comentario: "Revisado; se informa con observación.", valorado_en: "2026-10-19T21:05:00+02:00", valorado_por: "responsable" });
sec.push(M.estadoExpediente(d, REF));
d = con(d, "comunicaciones", { id: `COM~${REF}~mtbc`, expediente_id: REF, patogeno_id: "mtbc", destinatario: "Servicios veterinarios oficiales (destinatario ficticio)", medio: "telefono", comunicado_en: "2026-10-19T21:10:00+02:00", registrado_por: "responsable", nota: "" });
sec.push(M.estadoExpediente(d, REF));
check("A6 secuencia", sec, ["EN_ANALISIS", "PENDIENTE_VALORACION", "PENDIENTE_VALORACION", "LISTO_PARA_VALIDAR"]);
const h1 = M.huella(d, REF);
d = con(d, "informes", { id: M.siguienteInforme(d, REF), expediente_id: REF, version: 1, emitido_en: "2026-10-19T21:15:00+02:00", emitido_por: "responsable", huella: h1, snapshot: M.snapshot(d, REF), motivo: null, aviso_revisor: true, modo: "simulacion" });
check("A6 id informe", Object.keys(d.informes).includes("INF-ING-26-0351-v1"), true);
check("A6 tras emitir", M.estadoExpediente(d, REF), "EMITIDO");
d = con(d, "muestras", { ...d.muestras["ING-26-0351-M02"], identificacion: "Precinto 1202-B" });
check("A6 tras corregir", M.estadoExpediente(d, REF), "LISTO_PARA_VALIDAR");
check("A6 huella distinta", M.huella(d, REF) !== h1, true);
check("A6 siguiente informe v2", M.siguienteInforme(d, REF), "INF-ING-26-0351-v2");
check("A6 la semilla no se ha tocado", M.estadoExpediente(DB, REF), "EN_ANALISIS");

// panel con filtro (sanidad: no revienta, muestras_por_semana igual)
const pSem = M.panel(DB, "2026-10-12T00:00:00+02:00");
check("panel(desde) muestras_por_semana sin filtro", pSem.muestras_por_semana, E.panel.muestras_por_semana);
check("panel(desde) filtra", pSem.kpi_muestras < E.panel.kpi_muestras, true);

if (fallos.length) {
  console.log(`FALLO ${ok}/${n}\nPrimer desajuste: ${fallos[0]}`);
  if (fallos.length > 1) console.log(`(${fallos.length - 1} más)`);
  process.exit(1);
}
console.log(`OK ${ok}/${n}`);

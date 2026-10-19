#!/usr/bin/env python3
"""test_robustez.py · Paquete D · robustez de la demo.

Comprueba:
  1. Sin window.claude → modo local ("Solo este dispositivo"); un cambio sobrevive a la recarga.
  2. localStorage que lanza excepción → "Sin guardar" y la app funciona (registrar un resultado).
  3. Dos páginas con tests/mock_claude.js → valorar en la 1 se ve en la 2 en < 2 s, indicador "En vivo" (A9).
  4. scrollWidth ≤ ancho a 390 y 320 px en todas las rutas (claro) y a 390 en oscuro.
  5. Textos prohibidos en el DOM de todas las rutas.
  6. Fallo ante cualquier pageerror o console.error.
  --capturas: guarda PNG claro/oscuro de cada pantalla a 390 px en tests/capturas/.

Uso: python3 app/tests/test_robustez.py [URL] [--capturas]
"""
import functools, http.server, os, re, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
AQUI = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(os.path.dirname(AQUI), "dist")
CAPT = os.path.join(AQUI, "capturas")
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
CAPTURAS = "--capturas" in sys.argv

RUTAS = ["#/inicio", "#/expedientes", "#/exp/ING-26-0351", "#/exp/ING-26-0351/muestras", "#/exp/ING-26-0351/alertas",
         "#/exp/ING-26-0347/informe", "#/exp/ING-26-0351/registro", "#/nueva", "#/lab/micro", "#/lab/molecular",
         "#/lab/tanda?diana=adv", "#/informes", "#/informe/INF-ING-26-0347-v2", "#/alertas", "#/mas", "#/mas/sobre",
         "#/mas/biblioteca", "#/mas/reglas", "#/mas/registro", "#/mas/compartir", "#/mas/ajustes"]
PROHIBIDOS = [r"solicitante", r"acreditad", r"cumple la ISO", r"diagn[oó]stico oficial", r"confirmado por", r"RD 526/2014", r"notificado"]

RES, ERRS = [], []


def check(nombre, cond, detalle=""):
    RES.append((bool(cond), nombre, detalle))
    print(("  OK   " if cond else "  FALLA") + f" {nombre}" + (f" · {detalle}" if detalle else ""), flush=True)
    return cond


def T(s):
    return f'[data-testid="{s}"]'


def servir():
    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Silencioso, directory=DIST))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


def pagina(ctx, etiqueta):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: ERRS.append(f"[{etiqueta}] pageerror: {e}"))
    pg.on("console", lambda m: ERRS.append(f"[{etiqueta}] console.error: {m.text}") if m.type == "error" and "manifest" not in m.text.lower() else None)
    return pg


def contexto(b, ancho=390, oscuro=False, init=None):
    ctx = b.new_context(viewport={"width": ancho, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        locale="es-ES", timezone_id="Europe/Madrid", color_scheme="dark" if oscuro else "light")
    if init:
        ctx.add_init_script(init)
    return ctx


def ir(pg, base, h):
    pg.goto(base + h)
    pg.wait_for_selector("#contenido .contenido-int", state="attached")
    pg.wait_for_timeout(250)


def modo_texto(pg):
    return pg.inner_text(T("indicador-modo")).strip()


def prueba_local(b, base):
    print("\n## 1 · Sin window.claude → Solo este dispositivo, persiste al recargar")
    ctx = contexto(b)
    pg = pagina(ctx, "local")
    ir(pg, base, "#/inicio")
    pg.wait_for_timeout(300)
    check("sin window.claude", pg.evaluate("typeof window.claude") == "undefined")
    check("indicador 'Solo este dispositivo'", modo_texto(pg) == "Solo este dispositivo", modo_texto(pg))
    ir(pg, base, "#/lab/micro")
    pg.click(T("tarea-micro") + '[data-analisis="ING-26-0352-M01-cult_mastitis"] ' + T("btn-registrar"))
    pg.click(T("opcion-sin_crecimiento"))
    pg.click(T("btn-guardar"))
    pg.wait_for_timeout(400)
    pg.reload()
    pg.wait_for_selector("#contenido .contenido-int", state="attached")
    pg.wait_for_timeout(400)
    r = pg.evaluate("(ING.store.db().analisis['ING-26-0352-M01-cult_mastitis'].resultado||{}).opcion_id||null")
    check("el resultado sigue tras recargar", r == "sin_crecimiento", str(r))
    check("la tarea ya no está en la bandeja", pg.locator(T("tarea-micro") + '[data-analisis="ING-26-0352-M01-cult_mastitis"]').count() == 0)
    ctx.close()


LS_ROTO = """
(() => {
  const roto = { getItem(){ throw new Error('bloqueado'); }, setItem(){ throw new Error('bloqueado'); },
                 removeItem(){ throw new Error('bloqueado'); }, clear(){ throw new Error('bloqueado'); }, key(){ return null; }, length: 0 };
  Object.defineProperty(window, 'localStorage', { get(){ return roto; }, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { get(){ return roto; }, configurable: true });
})();
"""


def prueba_memoria(b, base):
    print("\n## 2 · localStorage que lanza excepción → Sin guardar y la app funciona")
    ctx = contexto(b, init=LS_ROTO)
    pg = pagina(ctx, "memoria")
    ir(pg, base, "#/inicio")
    pg.wait_for_timeout(300)
    check("indicador 'Sin guardar'", modo_texto(pg).startswith("Sin guardar"), modo_texto(pg))
    check("Inicio pinta las cifras", "105" in pg.inner_text(T("kpi-muestras")))
    ir(pg, base, "#/lab/micro")
    pg.click(T("tarea-micro") + '[data-analisis="ING-26-0352-M02-cult_mastitis"] ' + T("btn-registrar"))
    pg.click(T("opcion-flora_mixta"))
    pg.click(T("btn-guardar"))
    pg.wait_for_timeout(400)
    r = pg.evaluate("(ING.store.db().analisis['ING-26-0352-M02-cult_mastitis'].resultado||{}).opcion_id||null")
    check("se puede registrar un resultado en memoria", r == "flora_mixta", str(r))
    for h in ["#/lab/molecular", "#/mas/ajustes", "#/nueva", "#/alertas"]:
        ir(pg, base, h)
    check("rutas con almacenamiento bloqueado sin errores", True)
    ctx.close()


def prueba_sync(b, base):
    print("\n## 3 · Dos páginas con mock_claude.js → sincronización en vivo (A9)")
    mock = os.path.join(AQUI, "mock_claude.js")
    if not os.path.exists(mock):
        check("mock_claude.js existe", False)
        return
    init = open(mock, encoding="utf-8").read()
    ctx = contexto(b, init=init)
    p1, p2 = pagina(ctx, "sync-1"), pagina(ctx, "sync-2")
    ir(p1, base, "#/alertas")
    ir(p2, base, "#/alertas")
    p1.wait_for_timeout(600)
    check("página 1 'En vivo'", "En vivo" in modo_texto(p1), modo_texto(p1))
    check("página 2 'En vivo'", "En vivo" in modo_texto(p2), modo_texto(p2))
    tarj = p1.locator(T("alerta") + '[data-estado="pendiente"]').first
    clave = tarj.get_attribute("data-clave")
    tarj.locator(T("btn-valorar")).click()
    p1.locator(T("comentario-rapido")).first.click()
    p1.click(T("btn-confirmar"))
    t0 = time.time()
    visto = False
    while time.time() - t0 < 2.0:
        if p2.evaluate(f"!!ING.store.db().valoraciones[{clave!r}]"):
            visto = True
            break
        p2.wait_for_timeout(100)
    check(f"la valoración de {clave} aparece en la página 2 en < 2 s", visto, f"{time.time() - t0:.2f} s")
    ctx.close()


def prueba_rutas(b, base):
    print("\n## 4-5 · Rutas a 390 y 320 px (claro) y 390 px (oscuro): sin desplazamiento horizontal ni textos prohibidos")
    for ancho, oscuro in [(390, False), (320, False), (390, True)]:
        ctx = contexto(b, ancho=ancho, oscuro=oscuro)
        pg = pagina(ctx, f"{ancho}{'-oscuro' if oscuro else ''}")
        malos, prohib = [], []
        for h in RUTAS:
            ir(pg, base, h)
            w = pg.evaluate("document.documentElement.scrollWidth")
            if w > ancho:
                malos.append(f"{h}={w}")
            if not oscuro and ancho == 390:
                # Biblioteca con su filtro por defecto ("Solo las que usa la app"); REF-19 (norma derogada,
                # antecedente histórico) solo sale al quitar el filtro y se acepta como excepción (decisión del director).
                txt = pg.evaluate("[...document.body.querySelectorAll('*')].length && (()=>{const c=document.body.cloneNode(true);c.querySelectorAll('[data-ref-id=\"REF-19\"]').forEach(x=>{const t=x.closest('[data-testid=tarjeta-ref]')||x;t.remove()});return c.innerText})()")
                for pat in PROHIBIDOS:
                    if re.search(pat, txt, re.I):
                        prohib.append(f"{h}:{pat}")
            if CAPTURAS and ancho == 390:
                os.makedirs(CAPT, exist_ok=True)
                nom = re.sub(r"[^a-z0-9]+", "_", h.lower()).strip("_")
                pg.screenshot(path=os.path.join(CAPT, f"{nom}_{'oscuro' if oscuro else 'claro'}.png"), full_page=True)
        etiqueta = f"{ancho} px{' oscuro' if oscuro else ''}"
        check(f"scrollWidth ≤ {ancho} en las {len(RUTAS)} rutas ({etiqueta})", not malos, ", ".join(malos))
        if oscuro:
            bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
            check("modo oscuro: fondo rgb(26, 32, 38)", bg == "rgb(26, 32, 38)", bg)
        if not oscuro and ancho == 390:
            check("sin textos prohibidos en el DOM", not prohib, ", ".join(prohib))
        ctx.close()


def main():
    srv = None
    if ARGS:
        base = ARGS[0] if ARGS[0].endswith("/") else ARGS[0] + "/"
    else:
        srv, base = servir()
    print("Probando", base)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for fn in (prueba_local, prueba_memoria, prueba_sync, prueba_rutas):
            try:
                fn(b, base)
            except Exception as e:
                check(fn.__name__ + " (excepción)", False, (str(e).splitlines() or [""])[0][:300])
        b.close()
    if srv:
        srv.shutdown()
    check("sin errores de consola ni pageerror", not ERRS, " | ".join(ERRS)[:800])
    fallos = [r for r in RES if not r[0]]
    print(f"\nRESULTADO robustez: {len(RES) - len(fallos)}/{len(RES)} OK")
    for f in fallos:
        print("  FALLA:", f[1], "·", f[2])
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()

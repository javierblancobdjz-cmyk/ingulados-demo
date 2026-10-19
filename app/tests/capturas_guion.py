#!/usr/bin/env python3
"""capturas_guion.py · Paquete D · capturas a 390×844 (claro y oscuro) de las pantallas clave de la demo:
Inicio, ficha ING-26-0351 (resumen y muestras), alertas, diálogo de emisión, informe y nueva tanda.
Uso: python3 app/tests/capturas_guion.py [URL]   → app/tests/capturas/clave_*.png"""
import functools, http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
AQUI = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(os.path.dirname(AQUI), "dist")
CAPT = os.path.join(AQUI, "capturas")


def servir():
    class S(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(S, directory=DIST))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


def T(s):
    return f'[data-testid="{s}"]'


def main():
    srv = None
    if len(sys.argv) > 1:
        base = sys.argv[1].rstrip("/") + "/"
    else:
        srv, base = servir()
    os.makedirs(CAPT, exist_ok=True)
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for tema in ("claro", "oscuro"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                color_scheme="dark" if tema == "oscuro" else "light", locale="es-ES")
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "manifest" not in m.text.lower() else None)

            def foto(nombre, h=None, completa=False):
                if h:
                    pg.goto(base + h)
                    pg.wait_for_selector("#contenido .contenido-int", state="attached")
                pg.wait_for_timeout(600)
                pg.screenshot(path=os.path.join(CAPT, f"clave_{nombre}_{tema}.png"), full_page=completa)

            foto("01_inicio", "#/inicio")
            foto("01b_inicio_completo", "#/inicio", completa=True)
            foto("02_ficha_0351", "#/exp/ING-26-0351")
            foto("03_ficha_0351_muestras", "#/exp/ING-26-0351/muestras", completa=True)
            foto("04_alertas", "#/alertas")
            foto("05_ficha_0351_alertas", "#/exp/ING-26-0351/alertas", completa=True)
            foto("06_nueva_tanda", "#/lab/tanda?diana=adv", completa=True)
            foto("07_molecular", "#/lab/molecular")
            foto("08_micro", "#/lab/micro")
            foto("09_informe_0347_v2", "#/informe/INF-ING-26-0347-v2", completa=True)
            # diálogo de emisión: un expediente listo para validar de la semilla
            pg.goto(base + "#/informes")
            pg.wait_for_selector("#contenido .contenido-int", state="attached")
            btn = pg.locator(T("btn-emitir")).first
            if btn.count():
                btn.click()
                pg.wait_for_selector(T("dialogo-emision"))
                foto("10_dialogo_emision")
                pg.keyboard.press("Escape")
            ctx.close()
        b.close()
    if srv:
        srv.shutdown()
    print("capturas en", CAPT, "· errores de consola:", errs or "ninguno")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()

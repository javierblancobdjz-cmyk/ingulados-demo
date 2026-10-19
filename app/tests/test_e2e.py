#!/usr/bin/env python3
"""test_e2e.py · Paquete D · recorre el guion de 5 minutos (ESPEC §4) a 390 px y los criterios D1-D7.

Uso:
  python3 app/tests/test_e2e.py                 -> sirve app/dist en un puerto local y prueba
  python3 app/tests/test_e2e.py https://…/      -> prueba contra esa URL (p. ej. GitHub Pages)
  python3 app/tests/test_e2e.py --capturas      -> además guarda capturas del guion en tests/capturas/

Chromium de /opt/pw-browsers, viewport 390×844, device_scale_factor=3, is_mobile, has_touch.
Falla ante cualquier `pageerror` o `console.error`. Sale con código 1 si algo falla.
"""
import functools, http.server, os, re, socketserver, sys, threading, traceback
from playwright.sync_api import sync_playwright, expect

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
AQUI = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(os.path.dirname(AQUI), "dist")
CAPT = os.path.join(AQUI, "capturas")
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
CAPTURAS = "--capturas" in sys.argv
expect.set_options(timeout=8000)

RES = []      # (ok, nombre, detalle)
ERRS = []     # errores de consola


def servir():
    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    h = functools.partial(Silencioso, directory=DIST)
    srv = socketserver.TCPServer(("127.0.0.1", 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


def check(nombre, cond, detalle=""):
    RES.append((bool(cond), nombre, detalle))
    print(("  OK   " if cond else "  FALLA") + f" {nombre}" + (f" · {detalle}" if detalle else ""), flush=True)
    return cond


def paso(nombre):
    """Decorador: ejecuta el paso y registra una excepción como fallo, sin cortar el resto."""
    def deco(fn):
        def run(*a, **k):
            print(f"\n## {nombre}", flush=True)
            try:
                fn(*a, **k)
            except Exception as e:
                check(nombre + " (excepción)", False, (str(e).splitlines() or [""])[0][:300])
                if os.environ.get("E2E_TRAZA"):
                    traceback.print_exc()
        return run
    return deco


def T(sel):
    return f'[data-testid="{sel}"]'


def nuevo_contexto(b, oscuro=False):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                        locale="es-ES", timezone_id="Europe/Madrid", color_scheme="dark" if oscuro else "light")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: ERRS.append(f"pageerror: {e}"))
    pg.on("console", lambda m: ERRS.append(f"console.error: {m.text}") if m.type == "error" and "manifest" not in m.text.lower() else None)
    return ctx, pg


def ir(pg, base, hash_):
    pg.goto(base + hash_)
    pg.wait_for_selector("#contenido .contenido-int", state="attached")
    pg.wait_for_timeout(150)


def cerrar_capas(pg):
    for _ in range(3):
        if pg.locator(".capa").count():
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(120)


def captura(pg, nombre):
    if CAPTURAS:
        os.makedirs(CAPT, exist_ok=True)
        pg.screenshot(path=os.path.join(CAPT, f"guion_{nombre}.png"))


def sin_scroll_h(pg, donde):
    w = pg.evaluate("document.documentElement.scrollWidth")
    check(f"sin desplazamiento horizontal en {donde}", w <= 390, f"scrollWidth={w}")


# ---------------------------------------------------------------- guion de ESPEC §4
@paso("0 · Preparación: Reiniciar demo y rol Responsable técnico")
def g0(pg, base):
    ir(pg, base, "#/mas/ajustes")
    pg.click(T("btn-reiniciar"))
    pg.click(T("btn-confirmar-reinicio"))
    pg.wait_for_timeout(300)
    rol = pg.evaluate("ING.store.rol()")
    check("rol por defecto Responsable técnico", rol == "responsable", rol)
    check("indicador de almacenamiento", pg.inner_text(T("indicador-modo")).strip() in ("Solo este dispositivo", "En vivo", "Sin guardar"), pg.inner_text(T("indicador-modo")))


@paso("0:00 · Panel (B1, B2)")
def g1(pg, base):
    ir(pg, base, "#/inicio")
    expect(pg.locator(T("kpi-muestras"))).to_contain_text("105")
    check("kpi-muestras 105", "105" in pg.inner_text(T("kpi-muestras")))
    check("kpi-en-curso 13", "13" in pg.inner_text(T("kpi-en-curso")))
    check("kpi-por-validar 7", "7" in pg.inner_text(T("kpi-por-validar")))
    tat = pg.inner_text(T("kpi-tat"))
    check("kpi-tat 4,2 y 7,1", "4,2" in tat and "7,1" in tat, tat.replace("\n", " "))
    check("badge-alertas 8", pg.inner_text(T("badge-alertas")).strip() == "8", pg.inner_text(T("badge-alertas")))
    check("badge-lab 15", pg.inner_text(T("badge-lab")).strip() == "15", pg.inner_text(T("badge-lab")))
    check("badge-informes 5", pg.inner_text(T("badge-informes")).strip() == "5", pg.inner_text(T("badge-informes")))
    check("6 gráficas en Inicio", pg.locator('[data-testid^="grafica-g"]').count() == 6)
    captura(pg, "01_panel")
    pg.locator(T("chip-ref")).first.click()
    expect(pg.locator(T("hoja-ref"))).to_be_visible()
    check("chip REF abre hoja-ref con enlace https", pg.locator(T("hoja-ref") + " a[href^='https://']").count() >= 1)
    cerrar_capas(pg)
    sin_scroll_h(pg, "Inicio")


@paso("0:40 · Nueva entrada de montería (C1-C3)")
def g2(pg, base):
    ir(pg, base, "#/inicio")
    pg.click(T("fab-nueva"))
    expect(pg.locator(T("paso-1"))).to_be_visible()
    if pg.locator(T("btn-descartar")).count():
        pg.click(T("btn-descartar"))
    pg.select_option(T("campo-procedencia"), "P01")   # Coto Alfa
    pg.select_option(T("campo-remitente"), "R01")
    pg.select_option(T("campo-motivo"), "monteria")
    pg.click(T("btn-siguiente"))
    expect(pg.locator(T("paso-2"))).to_be_visible()
    esp = pg.eval_on_selector(T("campo-especie-1"), "e=>e.value")
    tip = pg.eval_on_selector(T("campo-tipo-1"), "e=>e.value")
    check("C1 montería rellena jabalí y ganglio", esp == "jabali" and tip == "ganglio", f"{esp}/{tip}")
    pg.fill(T("campo-ident-1"), "Precinto 0501")
    pg.click(T("btn-mas-uno"))
    pg.click(T("btn-mas-uno"))
    pg.click(T("btn-siguiente"))
    expect(pg.locator(T("paso-3"))).to_be_visible()
    filas = pg.eval_on_selector_all(T("plan-analisis"), "e=>e.map(x=>x.dataset.analisis)")
    check("C2 plan con 6 filas (3 cult_piogenos + 3 pcr_mtbc)", len(filas) == 6 and filas.count("cult_piogenos") == 3 and filas.count("pcr_mtbc") == 3, str(filas))
    txt = pg.inner_text(T("paso-3"))
    check("C2 'Por qué' y chips REF en el plan", "Por qué" in txt and pg.locator(T("paso-3") + " " + T("chip-ref")).count() >= 1)
    captura(pg, "02_plan")
    pg.click(T("btn-registrar-entrada"))
    expect(pg).to_have_url(re.compile(r"#/exp/ING-26-0353"))
    expect(pg.locator(T("ficha-estado"))).to_have_attribute("data-estado", "RECIBIDO")
    check("C3 ficha ING-26-0353 en RECIBIDO", True)
    check("C3 progreso-micro 0/3", pg.inner_text(T("progreso-micro")).strip().endswith("0/3"), pg.inner_text(T("progreso-micro")))
    check("C3 progreso-molecular 0/3", pg.inner_text(T("progreso-molecular")).strip().endswith("0/3"), pg.inner_text(T("progreso-molecular")))
    check("C3 toast con ING-26-0353", "ING-26-0353" in pg.inner_text("#toasts"), pg.inner_text("#toasts").replace("\n", " "))


@paso("1:40 · Ficha ING-26-0351 (C6, C8)")
def g3(pg, base):
    ir(pg, base, "#/expedientes")
    pg.fill(T("buscador"), "0351")
    pg.wait_for_timeout(300)
    tarj = pg.locator(T("tarjeta-exp"))
    check("C6 1 tarjeta al buscar 0351", tarj.count() == 1 and tarj.first.get_attribute("data-ref") == "ING-26-0351", str(tarj.count()))
    t = tarj.first.inner_text()
    check("C6 Micro 3/4 y Molecular 3/3", "3/4" in t and "3/3" in t, t.replace("\n", " ")[:160])
    tarj.first.click()
    expect(pg).to_have_url(re.compile(r"#/exp/ING-26-0351"))
    expect(pg.locator(T("ficha-estado"))).to_have_attribute("data-estado", "EN_ANALISIS")
    pg.click(T("tab-muestras"))
    pg.wait_for_timeout(200)
    m01 = pg.locator(T("resultado-pcr") + '[data-analisis="ING-26-0351-M01-pcr_mtbc"]').inner_text()
    check("C8 M01 'Compatible' Ct 33,2 'no oficial'", "Compatible" in m01 and "33,2" in m01 and "no oficial" in m01, m01.replace("\n", " ")[:120])
    m03 = pg.locator(T("resultado-pcr") + '[data-analisis="ING-26-0351-M03-pcr_mtbc"]').inner_text()
    check("C8 M03 'No valorable (inhibición)'", "No valorable (inhibición)" in m03)
    check("C8 un QR <svg> por muestra", pg.locator(T("qr-muestra") + " svg, svg" + T("qr-muestra")).count() >= 4)
    captura(pg, "03_ficha_muestras")
    sin_scroll_h(pg, "ficha · Muestras")


@paso("1:40 · Laboratorio → Micro → Sin crecimiento (D1, D2 = E2)")
def g4(pg, base):
    pg.click(T("nav-lab"))
    if "lab/micro" not in pg.url:
        pg.click(T("lab-selector-micro"))
    expect(pg.locator(T("tarea-micro")).first).to_be_visible()
    ids = pg.eval_on_selector_all(T("tarea-micro"), "e=>e.map(x=>x.dataset.analisis)")
    check("bandeja micro: 10 de la semilla + 3 de ING-26-0353", len(ids) == 13 and "ING-26-0351-M01-cult_piogenos" in ids, str(len(ids)))
    orden = pg.evaluate("""(()=>{const db=ING.store.db();return [...document.querySelectorAll('[data-testid=tarea-micro]')].map(x=>db.analisis[x.dataset.analisis].solicitado_en)})()""")
    check("D1 ordenadas de más antigua a más reciente", orden == sorted(orden))
    captura(pg, "04_micro")
    pg.click(T("tarea-micro") + '[data-analisis="ING-26-0351-M01-cult_piogenos"] ' + T("btn-registrar"))
    pg.click(T("opcion-sin_crecimiento"))
    pg.click(T("btn-guardar"))
    expect(pg.locator(T("toast")).last).to_be_visible()
    pg.wait_for_timeout(250)
    n = pg.locator(T("tarea-micro")).count()
    check("D2 la tarea desaparece (quedan 12 = 9 de la semilla + 3)", n == 12 and pg.locator(T("tarea-micro") + '[data-analisis="ING-26-0351-M01-cult_piogenos"]').count() == 0, str(n))
    ir(pg, base, "#/exp/ING-26-0351")
    expect(pg.locator(T("ficha-estado"))).to_have_attribute("data-estado", "PENDIENTE_VALORACION")
    check("D2 ficha en PENDIENTE_VALORACION", True)
    check("D2 progreso-micro 4/4", pg.inner_text(T("progreso-micro")).strip().endswith("4/4"), pg.inner_text(T("progreso-micro")))


@paso("2:30 · Alertas: comunicar SAN-03 y valorar ×2 (A6)")
def g5(pg, base):
    ir(pg, base, "#/exp/ING-26-0351/alertas")
    al = pg.locator(T("alerta") + '[data-clave="SAN-03~ING-26-0351~mtbc"]')
    expect(al).to_be_visible()
    check("SAN-03 con plazo 24 h", "24 h" in al.inner_text())
    captura(pg, "05_alertas")
    al.locator(T("btn-comunicar")).click()
    expect(pg.locator(T("hoja-comunicar"))).to_be_visible()
    pg.click(T("btn-guardar-comunicacion"))
    pg.wait_for_timeout(300)
    for _ in range(4):
        pend = pg.locator(T("alerta") + '[data-estado="pendiente"] ' + T("btn-valorar"))
        if not pend.count():
            break
        pend.first.click()
        expect(pg.locator(T("hoja-valorar"))).to_be_visible()
        pg.locator(T("comentario-rapido")).first.click()
        pg.click(T("btn-confirmar"))
        pg.wait_for_timeout(300)
    est = pg.evaluate("ING.motor.estadoExpediente(ING.store.db(),'ING-26-0351')")
    check("A6 ING-26-0351 en LISTO_PARA_VALIDAR", est == "LISTO_PARA_VALIDAR", est)


@paso("3:20 · Validar y emitir v1 con aviso revisor (C9)")
def g6(pg, base):
    ir(pg, base, "#/informes")
    pg.click(T("btn-emitir") + '[data-ref="ING-26-0351"]')
    expect(pg.locator(T("dialogo-emision"))).to_be_visible()
    check("C9 aviso-revisor visible", pg.locator(T("aviso-revisor")).is_visible())
    captura(pg, "06_dialogo_emision")
    pg.click(T("btn-confirmar-emision"))
    expect(pg).to_have_url(re.compile(r"#/informe/INF-ING-26-0351-v1"))
    expect(pg.locator(T("marca-agua")).first).to_be_attached()
    check("C9 marca de agua 'SIN VALIDEZ'", "SIN VALIDEZ" in (pg.locator(T("marca-agua")).first.text_content() or "").upper())
    hu = pg.inner_text(T("informe-huella"))
    check("C9 huella de 64 hex", re.search(r"[0-9A-F]{64}", hu.replace(" ", "").replace("\n", "")) is not None, hu[:80])
    est = pg.evaluate("ING.motor.estadoExpediente(ING.store.db(),'ING-26-0351')")
    check("A6 tras emitir: EMITIDO", est == "EMITIDO", est)
    captura(pg, "07_informe_v1")


@paso("4:00 · Corregir M02 → caduca → emitir v2 (C10)")
def g7(pg, base):
    h1 = pg.evaluate("ING.motor.huella(ING.store.db(),'ING-26-0351')")
    ir(pg, base, "#/exp/ING-26-0351/muestras")
    pg.click(T("btn-corregir") + '[data-id="ING-26-0351-M02"][data-campo="identificacion"]')
    expect(pg.locator(T("input-nuevo-valor"))).to_be_visible()
    pg.fill(T("input-nuevo-valor"), "Precinto 1202-B")
    pg.fill(T("input-motivo"), "error de transcripción")
    pg.click(T("btn-guardar-correccion"))
    expect(pg.locator(T("ficha-estado"))).to_have_attribute("data-estado", "LISTO_PARA_VALIDAR")
    check("C10 ficha vuelve a LISTO_PARA_VALIDAR", True)
    check("C10 banda-caducada visible", pg.locator(T("banda-caducada")).first.is_visible())
    h2 = pg.evaluate("ING.motor.huella(ING.store.db(),'ING-26-0351')")
    check("A6 huella distinta tras corregir", h1 != h2, f"{h1[:8]} → {h2[:8]}")
    captura(pg, "08_caducada")
    ir(pg, base, "#/informes")
    pg.click(T("btn-emitir") + '[data-ref="ING-26-0351"]')
    expect(pg.locator(T("input-motivo-version"))).to_be_visible()
    if not pg.eval_on_selector(T("input-motivo-version"), "e=>e.value").strip():
        pg.fill(T("input-motivo-version"), "Corrección de la identificación de M02")
    pg.click(T("btn-confirmar-emision"))
    expect(pg).to_have_url(re.compile(r"#/informe/INF-ING-26-0351-v2"))
    check("C10 v2 'Sustituye a INF-ING-26-0351-v1'", "Sustituye a INF-ING-26-0351-v1" in pg.inner_text(T("informe")))
    ir(pg, base, "#/exp/ING-26-0351/informe")
    check("C10 v1 aparece como Sustituida", "Sustituida" in pg.inner_text("#contenido"))


@paso("4:40 · Registro, Sobre esta demo y Compartir")
def g8(pg, base):
    ir(pg, base, "#/mas/registro")
    pg.click(T("btn-verificar"))
    r = pg.inner_text(T("resultado-verificacion"))
    check("Verificar integridad muestra la cadena", "eventos" in r, r.replace("\n", " ")[:120])
    ir(pg, base, "#/mas/sobre")
    t = pg.inner_text("#contenido")
    check("Sobre: 'datos ficticios', 'No comunica nada', 'Fase siguiente'", "datos ficticios" in t.lower() and "No comunica nada" in t and "Fase siguiente" in t)
    check("Sobre: sin 'acreditad', 'solicitante'", not re.search(r"acreditad|solicitante", t, re.I))
    ir(pg, base, "#/mas/compartir")
    check("Compartir: QR svg y URL pública", pg.locator(T("qr-compartir")).count() == 1 and "javierblancobdjz-cmyk.github.io/ingulados-demo" in pg.inner_text("#contenido"))
    captura(pg, "09_compartir")


# ---------------------------------------------------------------- criterios D3-D7 (contexto limpio)
@paso("D3-D4 · Aislado E. coli MDR con colistina R → PCR del gen")
def d34(pg, base):
    ir(pg, base, "#/lab/micro")
    ids = pg.eval_on_selector_all(T("tarea-micro"), "e=>e.map(x=>x.dataset.analisis)")
    check("D1 (semilla) 10 tarea-micro con ING-26-0351-M01-cult_piogenos", len(ids) == 10 and "ING-26-0351-M01-cult_piogenos" in ids, str(len(ids)))
    pg.click(T("tarea-micro") + '[data-analisis="ING-26-0350-M01-cult_general"] ' + T("btn-registrar"))
    pg.click(T("opcion-aislamiento"))
    pg.select_option(T("campo-taxon"), "t_ecoli")
    pg.select_option(T("campo-metodo"), "maldi")
    n = pg.locator(".lab-sir-btn[data-sir=S]").count()
    check("D3 panel de 9 antimicrobianos", n == 9, str(n))
    for a in ["ampicilina", "tetraciclina", "sxt", "colistina"]:
        pg.click(T(f"sir-{a}-R"))
    check("Guardar inactivo con filas vacías", pg.is_disabled(T("btn-guardar")))
    pg.click(T("btn-sir-resto"))
    captura(pg, "d3_antibiograma")
    pg.click(T("btn-guardar"))
    pg.wait_for_timeout(400)
    toasts = pg.inner_text("#toasts")
    check("D3 toast con 'Multirresistencia (MDR)'", "Multirresistencia (MDR)" in toasts, toasts.replace("\n", " ")[:160])
    check("D3 aislado ING-26-0350-M01-A01 creado", pg.evaluate("!!ING.store.db().aislados['ING-26-0350-M01-A01']"))
    expect(pg.locator(T("btn-pcr-gen")).first).to_be_visible()
    check("D4 btn-pcr-gen visible", True)
    captura(pg, "d4_aislado")
    pg.locator(T("btn-pcr-gen")).first.click()
    pg.wait_for_timeout(300)
    check("D4 análisis ING-26-0350-M01-A01-pcr_mcr creado", pg.evaluate("!!ING.store.db().analisis['ING-26-0350-M01-A01-pcr_mcr']"))
    cerrar_capas(pg)
    ir(pg, base, "#/alertas")
    check("D3 alerta MIC-01~ING-26-0350-M01-A01 en #/alertas", pg.locator(T("alerta") + '[data-clave="MIC-01~ING-26-0350-M01-A01"]').count() == 1)
    ir(pg, base, "#/lab/molecular")
    check("D4 pendientes-diana mcr", pg.locator(T("pendientes-diana") + '[data-diana="mcr"]').count() >= 1)
    tev = pg.evaluate("Object.values(ING.store.db().eventos).filter(e=>e.entidad_id&&e.entidad_id.indexOf('ING-26-0350-M01')===0).map(e=>e.tipo)")
    check("eventos RESULTADO/AISLADO/ANTIBIOGRAMA/ANALISIS_ANADIDO", all(x in tev for x in ["RESULTADO_REGISTRADO", "AISLADO_REGISTRADO", "ANTIBIOGRAMA_REGISTRADO", "ANALISIS_ANADIDO"]), str(tev))


@paso("D5-D7 · Molecular: tandas, vista previa y registro")
def d57(pg, base):
    ir(pg, base, "#/lab/molecular")
    check("D5 kpi '41 de 44'", "41 de 44" in pg.inner_text(T("kpi-tandas-validas")), pg.inner_text(T("kpi-tandas-validas")))
    v = pg.inner_text(T("tarjeta-tanda") + '[data-tanda="T-2026-053"] ' + T("validez-tanda"))
    check("D5 T-2026-053 'No válida' con PCR-01", "No válida" in v and "PCR-01" in v, v)
    rep = pg.locator(T("pendientes-diana") + '[data-diana="adv"]').inner_text().count("Repetir")
    check("D5 adv con 4 'Repetir'", rep >= 4, str(rep))
    captura(pg, "d5_molecular")
    sin_scroll_h(pg, "Biología molecular")
    pg.click(T("btn-nueva-tanda") + '[data-diana="adv"]')
    expect(pg.locator(T("ctrl-cp"))).to_be_visible()
    for aid, ct in [("ING-26-0340-M01-pcr_adv", "27,4"), ("ING-26-0340-M02-pcr_adv", "31,9"), ("ING-26-0340-M03-pcr_adv", "Sin Ct"), ("ING-26-0340-M04-pcr_adv", "Sin Ct")]:
        pg.fill(T(f"ct-{aid}"), ct)
        pg.fill(T(f"ctci-{aid}"), "29,0")
    pg.fill(T("ctrl-cp"), "26,5")
    check("D6 previa-validez 'Válida'", pg.inner_text(T("previa-validez")).strip() == "Válida", pg.inner_text(T("previa-validez")))
    check("D6 botón 'T-2026-085'", "T-2026-085" in pg.inner_text(T("btn-registrar-tanda")))
    pg.fill(T("ctrl-ntc"), "37,0")
    pv = pg.inner_text(T("previa-validez"))
    check("D7 con NTC 37,0: 'No válida' y 'PCR-01'", "No válida" in pv and "PCR-01" in pv, pv)
    pg.fill(T("ctrl-ntc"), "")
    captura(pg, "d6_tanda")
    sin_scroll_h(pg, "Nueva tanda")
    pg.click(T("btn-registrar-tanda"))
    expect(pg).to_have_url(re.compile(r"#/lab/molecular"))
    est = pg.evaluate("ING.motor.estadoExpediente(ING.store.db(),'ING-26-0340')")
    check("D6 ING-26-0340 en LISTO o PENDIENTE_VALORACION", est in ("LISTO_PARA_VALIDAR", "PENDIENTE_VALORACION"), est)
    check("toast 'Tanda T-2026-085 registrada · Válida'", "Tanda T-2026-085 registrada · Válida" in pg.inner_text("#toasts"))
    # D7: tanda no válida para la PCR del gen pendiente (mec, de la semilla)
    ir(pg, base, "#/lab/tanda?diana=mec")
    aid = "ING-26-0342-M01-A01-pcr_mec"
    pg.fill(T(f"ct-{aid}"), "20,0")
    pg.fill(T("ctrl-cp"), "18,0")
    pg.fill(T("ctrl-ntc"), "37,0")
    check("D7 previa 'No válida' (PCR-01)", "PCR-01" in pg.inner_text(T("previa-validez")))
    pg.click(T("btn-registrar-tanda"))
    expect(pg).to_have_url(re.compile(r"#/lab/molecular"))
    st = pg.evaluate(f"ING.motor.estadoAnalisis(ING.store.db(), ING.store.db().analisis['{aid}'])")
    check("D7 sus análisis siguen en 'Repetir'", st == "REPETIR", st)
    check("toast '… · No válida (PCR-01)'", "No válida (PCR-01)" in pg.inner_text("#toasts"))


def main():
    srv = None
    if ARGS:
        base = ARGS[0] if ARGS[0].endswith("/") else ARGS[0] + "/"
    else:
        if not os.path.exists(os.path.join(DIST, "index.html")):
            print("Falta app/dist/index.html: ejecuta antes python3 app/build.py")
            sys.exit(1)
        srv, base = servir()
    print("Probando", base)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx, pg = nuevo_contexto(b)
        for fn in (g0, g1, g2, g3, g4, g5, g6, g7, g8):
            fn(pg, base)
        ctx.close()
        ctx, pg = nuevo_contexto(b)
        ir(pg, base, "#/inicio")
        for fn in (d34, d57):
            fn(pg, base)
        ctx.close()
        b.close()
    if srv:
        srv.shutdown()
    check("sin errores de consola ni pageerror", not ERRS, " | ".join(ERRS)[:600])
    fallos = [r for r in RES if not r[0]]
    print(f"\nRESULTADO e2e: {len(RES) - len(fallos)}/{len(RES)} OK")
    for f in fallos:
        print("  FALLA:", f[1], "·", f[2])
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()

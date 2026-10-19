#!/usr/bin/env python3
"""build.py — genera app/dist/index.html autocontenido (y los ficheros de GitHub Pages).

Uso:  python3 build.py            -> dist/index.html, dist/manifest.webmanifest, dist/icon-*.png, dist/.nojekyll
      python3 build.py --check    -> además valida JSON, referencias y tamaño; sale con código 1 si algo falla

Dueño: paquete D (PLAN_CONSTRUCCION.md). Los demás paquetes NO lo editan: si necesitan un fichero nuevo,
se añade a la lista JS_ORDEN / CSS_ORDEN por el paquete D.
"""
import base64, json, os, re, sys, hashlib, datetime

APP = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(APP, "src")
VENDOR = os.path.join(APP, "vendor")
DIST = os.path.join(APP, "dist")

CSS_ORDEN = ["styles.css", "styles-panel.css", "styles-exp.css", "styles-informe.css", "styles-lab.css", "styles-alertas.css"]  # dueños: B, B, C, C, D, A
JS_ORDEN = [  # orden de carga cerrado (CONTRATO_DATOS.md §10)
    "js/sha256.js", "js/datos.js", "js/motor.js", "js/store.js",
    "js/ui-base.js",
    "js/ui-panel.js", "js/ui-entrada.js", "js/ui-expedientes.js",
    "js/ui-micro.js", "js/ui-molecular.js", "js/ui-alertas.js", "js/ui-informes.js",
    "js/ui-mas.js",
    "js/app.js",
]
DATOS = ["catalogos", "reglas", "semilla", "referencias"]
FUENTES = [("Raleway", 600, "raleway-latin-600-normal.woff2"), ("Raleway", 700, "raleway-latin-700-normal.woff2"),
           ("Alegreya Sans", 400, "alegreya-sans-latin-400-normal.woff2"), ("Alegreya Sans", 500, "alegreya-sans-latin-500-normal.woff2"),
           ("Alegreya Sans", 700, "alegreya-sans-latin-700-normal.woff2")]
TITULO = "Circuito de muestras · demo"
MAX_BYTES = 3 * 1024 * 1024


def leer(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def b64(p):
    with open(p, "rb") as f:
        return base64.b64encode(f.read()).decode()


def fallo(msg):
    print("ERROR:", msg)
    sys.exit(1)


def main():
    check = "--check" in sys.argv
    faltan = [f for f in CSS_ORDEN + JS_ORDEN if not os.path.exists(os.path.join(SRC, f))]
    if faltan:
        fallo("faltan ficheros en src/: " + ", ".join(faltan))
    datos = {}
    for d in DATOS:
        try:
            datos[d] = json.loads(leer(os.path.join(SRC, "data", d + ".json")))
        except Exception as e:
            fallo(f"data/{d}.json no es JSON válido: {e}")

    # --- comprobaciones de contenido
    if check:
        refs = {r["id"]: r for r in datos["referencias"]}
        txt = json.dumps(datos["catalogos"], ensure_ascii=False) + json.dumps(datos["reglas"], ensure_ascii=False)
        for js in JS_ORDEN:
            txt += leer(os.path.join(SRC, js))
        for rid in sorted(set(re.findall(r"REF-\d+", txt))):
            if rid not in refs:
                fallo(f"{rid} citado pero no existe en referencias.json")
            if refs[rid]["verificado"] is not True:
                fallo(f"{rid} citado pero NO está verificado (no se puede enlazar)")
        prohibidas = [r"cumple (la )?(ISO|17025)", r"\bacreditad[oa]s?\b", r"\bdiagn[oó]stico oficial\b", r"\bconfirmado por Ingulados\b",
                      r"\bsolicitante\b", r"RD 526/2014", r"\bnotificado a la autoridad\b", r"(?<!sin )firma electr[oó]nica",
                      r"sustituye al LIMS", r"la IA interpreta"]
        visibles = txt + leer(os.path.join(SRC, "styles.css"))
        for pat in prohibidas:
            for m_ in re.finditer(pat, visibles, flags=re.I):
                ctx = visibles[max(0, m_.start() - 60): m_.end() + 60].replace("\n", " ")
                fallo(f"texto prohibido /{pat}/ cerca de: …{ctx}…")

    css = "\n".join(f"/* ==== {f} ==== */\n" + leer(os.path.join(SRC, f)) for f in CSS_ORDEN)
    fuentes = "\n".join(
        f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{w};font-display:swap;"
        f"src:url(data:font/woff2;base64,{b64(os.path.join(VENDOR, 'fonts', fn))}) format('woff2');}}"
        for fam, w, fn in FUENTES)
    iconos = {}
    for fn in sorted(os.listdir(os.path.join(VENDOR, "icons"))):
        if fn.endswith(".svg"):
            s = leer(os.path.join(VENDOR, "icons", fn))
            s = re.sub(r'\s(width|height)="24"', "", s).replace('class="lucide', 'aria-hidden="true" class="ico lucide')
            iconos[fn[:-4]] = s
    datos_tags = "\n".join(
        f'<script type="application/json" id="datos-{d}">{json.dumps(datos[d], ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")}</script>'
        for d in DATOS)
    vendor_js = leer(os.path.join(VENDOR, "chart-4.5.0.umd.min.js")) + "\n" + leer(os.path.join(VENDOR, "qrcode-generator-1.4.4.js"))
    app_js = "\n".join(f"<script>/* ==== {f} ==== */\n{leer(os.path.join(SRC, f))}\n</script>" for f in JS_ORDEN)
    os.makedirs(DIST, exist_ok=True)
    iconos_png()
    icono_b64 = b64(os.path.join(DIST, "icon-192.png")) if os.path.exists(os.path.join(DIST, "icon-192.png")) else ""
    build_id = datetime.datetime.now().strftime("%Y%m%d-%H%M") + "-" + hashlib.sha1((css + app_js).encode()).hexdigest()[:7]

    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITULO}</title>
<meta name="description" content="Prototipo de demostración con datos ficticios: circuito de una muestra de laboratorio veterinario.">
<meta name="theme-color" content="#313E48">
<meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Muestras demo">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="data:image/png;base64,{icono_b64}">
<link rel="apple-touch-icon" href="data:image/png;base64,{icono_b64}">
<style>
{fuentes}
{css}
</style>
</head>
<body>
<div id="app" data-build="{build_id}"><noscript>Esta demo necesita JavaScript.</noscript></div>
{datos_tags}
<script>window.ING = {{ build: "{build_id}", iconos: {json.dumps(iconos, ensure_ascii=False)} }};</script>
<script>{vendor_js}</script>
{app_js}
</body>
</html>
"""
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(DIST, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    manifest = {"name": TITULO, "short_name": "Muestras demo", "lang": "es", "start_url": "./#/inicio", "scope": "./",
                "display": "standalone", "background_color": "#F6F3EA", "theme_color": "#313E48",
                "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}
    with open(os.path.join(DIST, "manifest.webmanifest"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    open(os.path.join(DIST, ".nojekyll"), "w").close()
    tam = os.path.getsize(os.path.join(DIST, "index.html"))
    print(f"dist/index.html  {tam/1024:.0f} KB  build {build_id}")
    if tam > MAX_BYTES:
        fallo(f"index.html supera {MAX_BYTES//1024} KB")


def iconos_png():
    """Icono propio (no es el logotipo de Ingulados): círculo oro sobre pizarra con una gota/matraz blanco esquemático."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("aviso: sin Pillow, no se generan iconos PNG")
        return
    for n in (192, 512):
        im = Image.new("RGB", (n, n), "#313E48")
        d = ImageDraw.Draw(im)
        r = int(n * 0.36)
        c = n // 2
        d.ellipse([c - r, c - r, c + r, c + r], fill="#BEA700")
        w = int(n * 0.06)
        # matraz esquemático
        d.line([(c - int(n * .07), c - int(n * .2)), (c - int(n * .07), c - int(n * .05)), (c - int(n * .17), c + int(n * .17)),
                (c + int(n * .17), c + int(n * .17)), (c + int(n * .07), c - int(n * .05)), (c + int(n * .07), c - int(n * .2))],
               fill="#FFFFFF", width=w, joint="curve")
        im.save(os.path.join(DIST, f"icon-{n}.png"))


if __name__ == "__main__":
    main()

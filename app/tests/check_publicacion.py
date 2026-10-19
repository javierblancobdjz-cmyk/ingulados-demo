#!/usr/bin/env python3
"""check_publicacion.py · Paquete D · revisa app/dist antes de publicar (ESPEC §9, PLAN §5.6).
Busca nombres reales de personas, NIF/CIF, correos reales y textos prohibidos en lo VISIBLE de la app
(datos incrustados + JS + CSS de dist/index.html). Sale con 1 si encuentra algo.
Las referencias bibliográficas (autores de artículos) se excluyen de la búsqueda de nombres: son citas, no personas de la demo."""
import json, os, re, sys
DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")
html = open(os.path.join(DIST, "index.html"), encoding="utf-8").read()
# quitar la biblioteca de referencias (citas con autores) para la búsqueda de nombres
sin_refs = re.sub(r'<script type="application/json" id="datos-referencias">.*?</script>', "", html, flags=re.S)
# quitar librerías de terceros (Chart.js / qrcode) para no confundir
sin_vendor = re.sub(r"<script>/\*!?\s*\n?\s*\*?\s*Chart\.js.*?</script>", "", sin_refs, flags=re.S)
fallos = []
def busca(nombre, patron, texto, flags=re.I):
    for m in re.finditer(patron, texto, flags):
        ctx = texto[max(0, m.start() - 50): m.end() + 50].replace("\n", " ")
        fallos.append(f"{nombre}: …{ctx}…")
        if sum(1 for f in fallos if f.startswith(nombre)) > 3:
            break
busca("solicitante", r"solicitante", html)
busca("acreditad", r"acreditad", html)
busca("cumple ISO", r"cumple (la )?(ISO|17025)", html)
busca("NIF/CIF", r"\b(\d{8}[A-HJ-NP-TV-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J])\b", sin_vendor, 0)
busca("correo no ficticio", r"[\w.+-]+@(?!ejemplo\.invalid)[\w-]+\.[\w.]+", sin_vendor)
busca("Ingulados con NIF/registro", r"AV-001|INGUBAL", html)
# nombres propios de personas reales conocidos del encargo (no deben aparecer salvo "Javier Blanco" en Sobre esta demo)
for n in ["Blanco Blanco", "Fernández", "Llario", "Rosario", "Adela", "Carreño", "Cerro", "Irene", "Simón", "Almeida", "Frenillo", "Pepa", "Yáñez"]:
    busca("nombre real", re.escape(n), sin_vendor, 0)
# fincas: las procedencias deben ser las ficticias del alfabeto griego
cat = json.loads(re.search(r'id="datos-catalogos">(.*?)</script>', html, re.S).group(1).replace("<\\/", "</"))
griego = re.compile(r"(Alfa|Beta|Gamma|Delta|Épsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Ómicron|Omicron|Sigma|Omega)\b")
for p in cat["procedencias"]:
    if not griego.search(p["nombre"]) or "DEMO" not in p["codigo"]:
        fallos.append(f"procedencia no ficticia: {p}")
for r in cat["remitentes"]:
    if "ficticio" not in r["nombre"] or not r["email"].endswith("@ejemplo.invalid"):
        fallos.append(f"remitente no ficticio: {r}")
print("Comprobación previa a publicar:", "OK" if not fallos else f"{len(fallos)} problemas")
for f in fallos:
    print("  -", f)
sys.exit(1 if fallos else 0)

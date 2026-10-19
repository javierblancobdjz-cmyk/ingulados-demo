# Circuito de muestras · demo

Prototipo de demostración, preparado para Ingulados, del circuito de una muestra de laboratorio veterinario: entrada, plan de análisis, microbiología y biología molecular, reglas de alerta, validación ligada a una versión con huella SHA-256, informe y registro.

**Demo con datos ficticios.** Fincas, remitentes, muestras y resultados son inventados; no contiene datos de Ingulados. No es un sistema validado y sus informes no tienen validez técnica ni legal.

Abrir: https://javierblancobdjz-cmyk.github.io/ingulados-demo/

Construcción: `python3 app/build.py --check` genera `index.html` autocontenido (sin red). Pruebas: `app/tests/test_e2e.py` y `app/tests/test_robustez.py` (Playwright).

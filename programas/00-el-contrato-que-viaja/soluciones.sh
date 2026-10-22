#!/usr/bin/env bash
# soluciones.sh — las corridas de las Soluciones 1 a 4 de la Lección 0.
#
# Reproduce, con las mismas órdenes que la lección, lo que las soluciones muestran, y las
# escribe en la salida estándar (la corrida guardada está en soluciones.salida.txt).
# Necesita Node 24 o más nuevo, curl, grep e internet (Solución 3 baja el registro de la IANA).
#
# Uso:  ./soluciones.sh > soluciones.salida.txt     (desde esta carpeta)
#
# Usa los puertos 18080 y 18081, los del curso: si alguno está ocupado, se detiene sin tocar
# nada. Solo termina los procesos que él mismo arrancó (por su número de proceso).
set -euo pipefail
cd "$(dirname "$0")"
AQUI="$PWD"

for puerto in 18080 18081; do
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$puerto/"; then
    echo "el puerto $puerto está ocupado; detén lo que lo usa y vuelve a correr" >&2
    exit 1
  fi
done

TMP="$(mktemp -d)"
PID=""
limpiar() {
  if [ -n "$PID" ]; then kill "$PID" 2>/dev/null || true; fi
  case "$TMP" in
    /tmp/*|/var/folders/*|/private/var/folders/*|/private/tmp/*) rm -rf "$TMP" ;;
  esac
}
trap limpiar EXIT

cp package.json fig00_02.ts fig00_03.ts fig00_04.ts "$TMP/"
cd "$TMP"
# ej1.ts: la copia de fig00_03.ts con la lista del Ejercicio 1.
sed 's/\[200, 204, 299, 308, 404, 471, 503, 600\]/[226, 418, 451, 799]/' fig00_03.ts > ej1.ts
# ej4.ts: la copia de fig00_04.ts con la cabecera del Ejercicio 4.
sed 's/"Cache-Control": "max-age=5, stale-if-error=600",/"Cache-Control": modo === "sano" ? "max-age=5, stale-if-error=600" : "no-store",/' fig00_04.ts > ej4.ts
grep -q '226, 418, 451, 799' ej1.ts
grep -q 'modo === "sano" ? "max-age' ej4.ts

# Muestra la orden como la escribe la lección y la corre; el código de salida de la
# orden no detiene el guion (varias órdenes fallan a propósito).
paso() { echo "\$ $1"; bash -c "$1" || true; }
arrancar() { node "$1" > "$2" 2>&1 & PID="$!"; sleep 1.5; }
parar() { kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; PID=""; }

echo "=== Solución 1 ==="
arrancar fig00_02.ts banco.log
paso "node ej1.ts"
for c in 226 418 451 799; do
  paso "curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/$c; echo \$?"
done
parar

echo
echo "=== Solución 2 ==="
arrancar fig00_02.ts banco.log
paso "curl -i -L http://127.0.0.1:18080/codigo/308"
echo "--- terminal del banco ---"
cat banco.log
parar

echo
echo "=== Solución 3 ==="
curl -s -o codigos.csv https://www.iana.org/assignments/http-status-codes/http-status-codes-1.csv
paso "grep -E '^4[0-9]{2},' codigos.csv | wc -l"
paso "grep -E '^4[0-9]{2},' codigos.csv | grep -vc -e Unassigned -e Unused"
paso "grep -E '^(418|429|451),' codigos.csv"

echo
echo "=== Solución 4 ==="
arrancar ej4.ts ej4.log
paso "curl -i http://127.0.0.1:18080/servicios"
paso "curl -X PUT http://127.0.0.1:18081/modo/mentiroso"
paso "sleep 6"
paso "curl -i http://127.0.0.1:18080/servicios"
paso "curl -i http://127.0.0.1:18080/servicios"
paso "curl -f http://127.0.0.1:18081/servicios; echo \$?"
echo "--- terminal del programa ---"
cat ej4.log
parar

echo
echo "=== Al terminar, nadie escucha ==="
echo "\$ curl -i http://127.0.0.1:18080/"
curl -i http://127.0.0.1:18080/ 2>&1 | grep '^curl' || true

#!/usr/bin/env bash
# fig08_03.sh — los 23 códigos del curso con curl y nada más: la misma idea de matriz23.ts, escrita como la
# teclearías tú en una terminal. Levanta el laboratorio y el revisor, prueba, y los apaga por PID.
# Uso: bash fig08_03.sh            (desde la carpeta que contiene fig08_01/)
set -u
cd "$(dirname "$0")/fig08_01" || exit 2
R=http://127.0.0.1:18080
LAB=http://127.0.0.1:18081

# Si algo ya escucha en los puertos del curso, la corrida mediría a otro programa: se detiene.
for puerto in 18080 18081; do
  if (exec 3<>/dev/tcp/127.0.0.1/$puerto) 2>/dev/null; then echo "el puerto $puerto está ocupado; apaga lo que lo usa"; exit 1; fi
done

node laboratorio.ts > /dev/null 2>&1 &
PID_LAB=$!
node servidor.ts > /dev/null 2>&1 &
PID_REV=$!
CAB=$(mktemp)
trap 'kill $PID_LAB $PID_REV 2>/dev/null; rm -f "$CAB"' EXIT
sleep 1

total=0
bien=0

# probar CODIGO "nombre" TIPO CABECERA -- argumentos de curl
#   TIPO:     problema (application/problem+json) · json (application/json) · nada (sin cuerpo)
#   CABECERA: la cabecera obligatoria de esa respuesta, o «-» si no hay
probar() {
  local esperado=$1 nombre=$2 tipo=$3 cabecera=$4
  shift 4
  total=$((total + 1))
  local salida codigo bytes tipo_visto fallas=""
  salida=$(curl -sS -o /dev/null -D "$CAB" -w '%{http_code} %{size_download}' "$@")
  codigo=${salida% *}
  bytes=${salida#* }
  tipo_visto=$(grep -i '^content-type:' "$CAB" | tr -d '\r' | sed 's/^[^:]*: *//')
  [ "$codigo" = "$esperado" ] || fallas="$fallas código $codigo;"
  case "$tipo" in
    problema) [ "$tipo_visto" = "application/problem+json" ] || fallas="$fallas tipo «$tipo_visto»;" ;;
    json) [ "$tipo_visto" = "application/json" ] || fallas="$fallas tipo «$tipo_visto»;" ;;
    nada) [ "$bytes" = "0" ] || fallas="$fallas trae $bytes bytes de cuerpo;" ;;
  esac
  if [ "$cabecera" != "-" ]; then
    grep -qi "^$cabecera:" "$CAB" || fallas="$fallas falta $cabecera;"
  fi
  if [ -z "$fallas" ]; then
    bien=$((bien + 1))
    echo "ok    $esperado $nombre"
  else
    echo "FALLA $esperado $nombre:$fallas"
  fi
}

LEE='Authorization: Bearer lectura-a'
ESCRIBE='Authorization: Bearer escritura-a'
ADMIN='Authorization: Bearer admin'
JSON='Content-Type: application/json'

ETAG=$(curl -sS -o /dev/null -w '%header{etag}' "$R/servicios/1" -H "$LEE")

probar 200 "consultar un servicio"            json     etag     "$R/servicios/1" -H "$LEE"
probar 304 "consultar sin cambios"            nada     etag     "$R/servicios/1" -H "$LEE" -H "If-None-Match: $ETAG"
probar 201 "dar de alta"                      json     location -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d "{\"nombre\":\"curl\",\"url\":\"$LAB/codigo/200\"}"
probar 202 "pedir revisión"                   json     location -X POST "$R/servicios/1/revisiones" -H "$ESCRIBE"
probar 204 "retirar"                          nada     -        -X DELETE "$R/servicios/7" -H "$ESCRIBE"
probar 301 "ruta vieja con 301"               nada     location -X POST "$R/viejo/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":"viejo","url":"http://127.0.0.1:18081/codigo/200"}'
probar 308 "ruta vieja con 308"               nada     location -X POST "$R/api/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":"api","url":"http://127.0.0.1:18081/codigo/200"}'
probar 400 "cuerpo ilegible"                  problema -        -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":'
probar 401 "sin credencial"                   problema www-authenticate "$R/servicios"
probar 403 "lectura que intenta escribir"     problema -        -X DELETE "$R/servicios/1" -H "$LEE"
probar 404 "servicio que no existe"           problema -        "$R/servicios/99" -H "$LEE"
probar 405 "método no admitido"               problema allow    -X PATCH "$R/servicios/1" -H "$ESCRIBE"
probar 409 "nombre repetido"                  problema -        -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d "{\"nombre\":\"pagos\",\"url\":\"$LAB/codigo/200\"}"
probar 410 "servicio retirado"                problema -        "$R/servicios/7" -H "$LEE"
probar 412 "etiqueta vencida"                 problema -        -X PUT "$R/servicios/1" -H "$ESCRIBE" -H "$JSON" -H 'If-Match: "1-0"' -d "{\"nombre\":\"catalogo\",\"url\":\"$LAB/codigo/200\"}"
probar 415 "formato no admitido"              problema accept   -X POST "$R/servicios" -H "$ESCRIBE" -H 'Content-Type: text/plain' -d 'curl'
probar 422 "datos imposibles"                 problema -        -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":"","url":"ftp://x"}'
probar 428 "cambio sin If-Match"              problema -        -X PUT "$R/servicios/1" -H "$ESCRIBE" -H "$JSON" -d "{\"nombre\":\"catalogo\",\"url\":\"$LAB/codigo/200\"}"
for i in 1 2 3; do curl -sS -o /dev/null -X POST "$R/servicios/2/revisiones" -H "$ESCRIBE"; done
probar 429 "demasiadas revisiones"            problema retry-after -X POST "$R/servicios/2/revisiones" -H "$ESCRIBE"
probar 500 "el defecto a propósito"           problema -        "$R/servicios/4/informe" -H "$LEE"
probar 502 "el servicio responde basura"      problema -        "$R/servicios/6/salud" -H "$LEE"
curl -sS -o /dev/null -X PUT "$R/mantenimiento" -H "$ADMIN" -H "$JSON" -d '{"activo":true}'
probar 503 "mantenimiento"                    problema retry-after "$R/servicios" -H "$LEE"
curl -sS -o /dev/null -X PUT "$R/mantenimiento" -H "$ADMIN" -H "$JSON" -d '{"activo":false}'
probar 504 "el servicio no responde a tiempo" problema -        "$R/servicios/5/salud" -H "$LEE"

echo
echo "$bien de $total escenarios pasaron"
[ "$bien" = "$total" ]

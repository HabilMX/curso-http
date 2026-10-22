#!/usr/bin/env bash
# arranque-lento.sh — el control negativo del ejercicio 6: corre la matriz de una carpeta con un arranque lento a propósito.
# Hace una copia temporal de la carpeta, le agrega a servidor.ts y pasarela.ts una pausa antes de escuchar (700 ms por
# omisión: más que la espera fija de la pasarela, 500 ms, y menos que la del revisor, 1000 ms) y corre ahí node matriz23.ts.
# Uso: ./arranque-lento.sh <carpeta con matriz23.ts, servidor.ts y pasarela.ts> [milisegundos]
# Necesita los puertos 18080, 18081 y 18082 libres. La copia temporal se borra al terminar.
set -u
ORIGEN="${1:?uso: ./arranque-lento.sh <carpeta> [milisegundos]}"
PAUSA="${2:-700}"
[ -f "$ORIGEN/matriz23.ts" ] && [ -f "$ORIGEN/servidor.ts" ] && [ -f "$ORIGEN/pasarela.ts" ] || { echo "faltan archivos en $ORIGEN" >&2; exit 2; }
for puerto in 18080 18081 18082; do
  if (exec 3<>/dev/tcp/127.0.0.1/$puerto) 2>/dev/null; then echo "puerto $puerto ocupado; apaga lo que lo usa" >&2; exit 2; fi
done
TEMPORAL="$(mktemp -d)"
cp -R "$ORIGEN"/. "$TEMPORAL"/
for archivo in servidor.ts pasarela.ts; do
  # La pausa va en la línea 2: después del comentario de la primera línea, antes de todo lo demás.
  awk -v pausa="$PAUSA" 'NR==1{print; print "await new Promise((listo) => setTimeout(listo, " pausa ")); // arranque lento a propósito"; next} {print}' \
    "$TEMPORAL/$archivo" > "$TEMPORAL/$archivo.nuevo" && mv "$TEMPORAL/$archivo.nuevo" "$TEMPORAL/$archivo"
done
( cd "$TEMPORAL" && node matriz23.ts >"$TEMPORAL/salida.txt" 2>&1; echo "$?" >"$TEMPORAL/codigo.txt" )
echo "--- $ORIGEN/matriz23.ts con un arranque lento de $PAUSA ms (lo que importa de su salida):"
grep -E "^FALLA|ECONNREFUSED|no respondió|ocupado|comprobaciones pasaron" "$TEMPORAL/salida.txt" | head -n 5 || true
echo "(código de salida: $(cat "$TEMPORAL/codigo.txt"))"
case "$TEMPORAL" in
  /tmp/*|/var/folders/*|/private/tmp/*|/private/var/folders/*) rm -rf "$TEMPORAL" ;;
  *) echo "no borro $TEMPORAL: no parece una carpeta temporal" >&2 ;;
esac

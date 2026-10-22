#!/usr/bin/env bash
# fig08_08.sh — corre la matriz de 23 escenarios N veces seguidas y cuenta cuántas salieron con código distinto de 0.
# Uso: ./fig08_08.sh [N] [carpeta]      (por omisión, 30 y fig08_01)
# Necesita los puertos 18080, 18081 y 18082 libres: la matriz levanta sus propios procesos.
set -u
N="${1:-30}"
CARPETA="${2:-fig08_01}"
SALIDA="$(mktemp)"
fallaron=0
cd "$CARPETA" || exit 2
for i in $(seq 1 "$N"); do
  # La salida completa va a un archivo, sin tubería: un filtro puede cortar el proceso a media corrida.
  node matriz23.ts >"$SALIDA" 2>&1
  codigo=$?
  resumen="$(grep -E '^[0-9]+ de [0-9]+ comprobaciones' "$SALIDA" || echo 'sin línea de resumen')"
  echo "corrida $i: código $codigo; $resumen"
  [ "$codigo" -ne 0 ] && fallaron=$((fallaron + 1))
done
rm -f "$SALIDA"
echo "$CARPETA/matriz23.ts: $fallaron de $N corridas fallaron"
[ "$fallaron" -eq 0 ]

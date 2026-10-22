#!/usr/bin/env bash
# verificar-url-sembrada.sh — corre la prueba de la URL sembrada contra CADA revisor del curso.
#
# Por qué existe: el revisor guarda la URL que alguien escribió y la devuelve en cada representación.
# Si esa URL trae usuario y clave, o un token en la consulta, el secreto sale en el 201, en la consulta
# y en la lista. La regla del curso: se rechaza al dar de alta, y ninguna respuesta repite usuario,
# clave, consulta ni fragmento. La prueba es herramientas/url-sembrada.ts.
#
# Es OBLIGATORIA y FALLA CERRADO: sale con 1 si la prueba no existe, si una carpeta sale en rojo, o si
# encontró menos revisores de los que el curso tiene (uno por lección en programas/NN-*/figNN_01 y otro
# en programas/_contrato/NN, de la 1 a la 8): una prueba que no corrió no es un verde.
# Uso: herramientas/verificar-url-sembrada.sh   (desde cualquier carpeta; usa los puertos 18080)
set -uo pipefail
cd "$(dirname "$0")/.."
PRUEBA=herramientas/url-sembrada.ts
# En el repo de trabajo hay dos revisores por lección: programas/NN-*/figNN_01 y programas/_contrato/NN.
# La copia que se publica no lleva _contrato/ ni verificar-publicable.sh (export-ignore): si faltan LOS
# DOS, es la copia publicada y se esperan solo los 8 publicables, corridos completos. Si falta uno solo,
# es el repo de trabajo incompleto y se exigen los 16 (y falla si no están).
if [ ! -d programas/_contrato ] && [ ! -f verificar-publicable.sh ]; then
  CONTEXTO="copia publicada"; ESPERADOS=8; CARPETAS_CONTRATO=0
else
  CONTEXTO="repo de trabajo"; ESPERADOS=16; CARPETAS_CONTRATO=1
fi

if [ ! -f "$PRUEBA" ]; then echo "❌ falta $PRUEBA: la prueba de la URL sembrada es obligatoria"; exit 1; fi
if (exec 3<>/dev/tcp/127.0.0.1/18080) 2>/dev/null; then echo "❌ el puerto 18080 está ocupado; apaga lo que lo usa"; exit 1; fi

corridas=0
rojas=0
for n in 1 2 3 4 5 6 7 8; do
  carpetas=(programas/0"$n"-*/fig0"$n"_01)
  [ "$CARPETAS_CONTRATO" -eq 1 ] && carpetas+=(programas/_contrato/0"$n")
  for carpeta in "${carpetas[@]}"; do
    [ -f "$carpeta/servidor.ts" ] || { echo "❌ no encontré el revisor de la lección $n en $carpeta"; rojas=$((rojas + 1)); continue; }
    corridas=$((corridas + 1))
    node "$PRUEBA" "$carpeta" "$n" || rojas=$((rojas + 1))
  done
done

if [ "$corridas" -ne "$ESPERADOS" ]; then
  echo "❌ corrí la prueba en $corridas revisores, y en el ${CONTEXTO} el curso tiene $ESPERADOS"
  exit 1
fi
if [ "$rojas" -ne 0 ]; then
  echo "❌ $rojas de $corridas revisores repiten o aceptan una URL con secretos"
  exit 1
fi
echo "✅ URL sembrada (${CONTEXTO}): $corridas de $corridas revisores la rechazan y no repiten sus secretos"

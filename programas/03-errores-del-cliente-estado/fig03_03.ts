// fig03_03.ts
// Lee los avisos de retiro de una ruta: Deprecation (RFC 9745) y Sunset (RFC 8594).
// Uso: node fig03_03.ts /v1/servicios
const ruta = process.argv[2] ?? "/v1/servicios";
const respuesta = await fetch(`http://127.0.0.1:18080${ruta}`, {
  headers: { Authorization: "Bearer lectura-a" },
});
await respuesta.body?.cancel();

const desaprobacion = respuesta.headers.get("deprecation"); // "@segundos": fecha de campo estructurado
const retiro = respuesta.headers.get("sunset"); // fecha HTTP: "Sun, 31 Jan 2027 00:00:00 GMT"
console.log(`${ruta}: ${respuesta.status}`);

if (desaprobacion === null && retiro === null) {
  console.log("sin avisos: la ruta no anuncia que se vaya a retirar");
} else {
  let desde: Date | undefined;
  if (desaprobacion !== null) {
    const segundos = /^@(-?\d+)$/.exec(desaprobacion);
    if (segundos === null) console.log(`Deprecation no es una fecha válida: ${desaprobacion}`);
    else desde = new Date(Number(segundos[1]) * 1000);
  }
  let hasta: Date | undefined;
  if (retiro !== null) {
    hasta = new Date(retiro);
    if (Number.isNaN(hasta.getTime())) {
      console.log(`Sunset no es una fecha válida: ${retiro}`);
      hasta = undefined;
    }
  }
  console.log(`desaprobada desde: ${desde?.toISOString() ?? "(no lo dice)"}`);
  console.log(`deja de responder: ${hasta?.toISOString() ?? "(no lo dice)"}`);
  const enlace = respuesta.headers.get("link");
  if (enlace !== null) console.log(`dónde leer más:   ${enlace}`);
  if (desde !== undefined && hasta !== undefined) {
    // RFC 9745, sección 4: la fecha de Sunset no puede ser anterior a la de Deprecation.
    console.log(hasta.getTime() >= desde.getTime() ? "orden correcto: primero se desaprueba, luego se retira" : "AVISO MAL ARMADO: el retiro es anterior a la desaprobación");
  }
}

// fig08_01/tabla23.ts — la tabla de decisión aplicada a los 23 códigos del curso, contra el laboratorio.
// Uso: con laboratorio.ts corriendo, node tabla23.ts
import { segundosDeEspera } from "./cliente.ts";
import { decidir, typeDe } from "./decisiones.ts";

const CODIGOS = [200, 201, 202, 204, 301, 304, 308, 400, 401, 403, 404, 405, 409, 410, 412, 415, 422, 428, 429, 500, 502, 503, 504];

console.log("CÓDIGO  ACCIÓN        REINTENTA  ESPERA  MOTIVO");
for (const codigo of CODIGOS) {
  const respuesta = await fetch(`http://127.0.0.1:18081/codigo/${codigo}`, { redirect: "manual" });
  const cuerpo = await respuesta.text();
  const decision = decidir(
    respuesta.status,
    segundosDeEspera(respuesta.headers.get("retry-after")),
    typeDe(respuesta.headers.get("content-type"), cuerpo),
  );
  const espera = decision.esperaS === null ? "—" : `${decision.esperaS} s`;
  console.log(
    `${String(respuesta.status).padEnd(8)}${decision.accion.padEnd(14)}${(decision.reintenta ? "sí" : "no").padEnd(11)}${espera.padEnd(8)}${decision.motivo}`,
  );
}

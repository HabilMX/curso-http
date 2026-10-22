// fig07_06.ts — qué hace la tabla con códigos que no lista: cae en el x00 de su familia (RFC 9110, sección 15).
// Uso: con laboratorio.ts corriendo, node fig07_06.ts
import { segundosDeEspera } from "./fig07_01/cliente.ts";
import { decidir, typeDe } from "./fig07_01/decisiones.ts";

const CODIGOS = [206, 299, 302, 307, 408, 418, 425, 451, 501, 507, 599, 600, 799];

console.log("CÓDIGO  ACCIÓN        REINTENTA  MOTIVO");
for (const codigo of CODIGOS) {
  const respuesta = await fetch(`http://127.0.0.1:18081/codigo/${codigo}`, { redirect: "manual" });
  const cuerpo = await respuesta.text();
  const decision = decidir(
    respuesta.status,
    segundosDeEspera(respuesta.headers.get("retry-after")),
    typeDe(respuesta.headers.get("content-type"), cuerpo),
  );
  console.log(`${String(respuesta.status).padEnd(8)}${decision.accion.padEnd(14)}${(decision.reintenta ? "sí" : "no").padEnd(11)}${decision.motivo}`);
}

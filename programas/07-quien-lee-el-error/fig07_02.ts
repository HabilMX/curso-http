// fig07_02.ts — sincronizar: da de alta una lista de servicios y decide qué hacer con cada respuesta.
// Es la escena de la lección con el guion bien escrito: decide con la tabla (el type y el código),
// no con el texto del detail. Uso: con laboratorio.ts y servidor.ts corriendo, node fig07_02.ts
import { randomUUID } from "node:crypto";
import { segundosDeEspera } from "./fig07_01/cliente.ts";
import { decidir, typeDe, type Decision } from "./fig07_01/decisiones.ts";

const BASE = "http://127.0.0.1:18080";
const LAB = "http://127.0.0.1:18081/codigo/200";

// Lo único que mira este guion de una respuesta de error: el código, Retry-After y el type.
// El texto del cuerpo (title, detail) no entra en la decisión.
function decidirRespuesta(respuesta: Response, cuerpo: string): Decision {
  return decidir(
    respuesta.status,
    segundosDeEspera(respuesta.headers.get("retry-after")),
    typeDe(respuesta.headers.get("content-type"), cuerpo),
  );
}

// Qué haría el guion con cada acción. Aquí solo lo dice; en un guion real lo haría.
const CONSECUENCIA: Record<string, string> = {
  seguir: "listo, sigue con el siguiente",
  corregir: "no repite: corrige la petición",
  reautenticar: "no repite: pide una credencial válida",
  esperar: "repite más tarde, con la misma llave (cada alta lleva la suya)",
  reconciliar: "relee el servicio que ya existe y compara con el que quería crear",
  rendirse: "se detiene y avisa a una persona; no vuelve a intentarlo",
};

const ALTAS: { nombre: string; url: string; credencial?: string }[] = [
  { nombre: "agenda", url: LAB },
  { nombre: "agenda", url: LAB },
  { nombre: "nomina2 (no existe aún)", url: LAB },
  { nombre: "nomina2 (no existe aún)", url: LAB },
  { nombre: "cuenta", url: "ftp://cuentas" },
  { nombre: "metadatos", url: "http://169.254.169.254/latest/meta-data/" },
  { nombre: "sin-permiso", url: LAB, credencial: "lectura-a" },
  { nombre: "sin-credencial", url: LAB, credencial: "inventada" },
];

for (const alta of ALTAS) {
  const respuesta = await fetch(BASE + "/servicios", {
    method: "POST",
    // Una llave por alta: así «esperar» y repetir con la misma llave no duplicaría nada.
    headers: {
      "Authorization": `Bearer ${alta.credencial ?? "escritura-a"}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ nombre: alta.nombre, url: alta.url }),
  });
  const cuerpo = await respuesta.text();
  const decision = decidirRespuesta(respuesta, cuerpo);
  console.log(`${alta.nombre}`);
  console.log(`  respondió ${respuesta.status} ${typeDe(respuesta.headers.get("content-type"), cuerpo) ?? "(sin Problem Details)"}`);
  console.log(`  acción: ${decision.accion} — ${CONSECUENCIA[decision.accion]}`);
}

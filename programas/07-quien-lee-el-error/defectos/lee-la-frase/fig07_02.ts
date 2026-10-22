// DEFECTO A PROPÓSITO (lección 7): decide leyendo la frase del detail, no el type ni el código.
// defectos/lee-la-frase/fig07_02.ts — sincronizar, con el defecto. Va en defectos/lee-la-frase/, junto a
// fig07_01/ (importa ../../fig07_01/). Uso: con laboratorio.ts y servidor.ts corriendo, node fig07_02.ts
import { randomUUID } from "node:crypto";
import { typeDe, type Decision } from "../../fig07_01/decisiones.ts";

const BASE = "http://127.0.0.1:18080";
const LAB = "http://127.0.0.1:18081/codigo/200";

// Lee la frase: decide buscando palabras en el detail. Se ve razonable el día que se escribe.
function decidirRespuesta(respuesta: Response, cuerpo: string): Decision {
  if (respuesta.ok) return { accion: "seguir", motivo: "salió bien", esperaS: null, reintenta: false };
  let detail = "";
  try {
    detail = String((JSON.parse(cuerpo) as { detail?: unknown }).detail ?? "");
  } catch {
    // un cuerpo que no es JSON se queda con el detail vacío
  }
  const decide = (accion: Decision["accion"]): Decision => ({ accion, motivo: detail, esperaS: null, reintenta: accion === "esperar" });
  if (/no existe/i.test(detail)) return decide("rendirse");
  if (/ya existe/i.test(detail)) return decide("reconciliar");
  if (/credencial/i.test(detail)) return decide("reautenticar");
  if (/no se pueden cumplir|no se conecta/i.test(detail)) return decide("corregir");
  return decide("rendirse");
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

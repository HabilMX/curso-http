// fig06_03.ts — comprueba que el alta del revisor respete Idempotency-Key como propone el borrador de la IETF.
// Uso: node fig06_03.ts [base]     (por omisión, http://127.0.0.1:18080)
// Cada corrida usa nombres y llaves nuevos, así que se puede repetir sin reiniciar el revisor.
import { randomUUID } from "node:crypto";

const BASE = process.argv[2] ?? "http://127.0.0.1:18080";
const URL_LAB = "http://127.0.0.1:18081/codigo/200";
const PROBLEMAS = "https://revisor.example/problemas/";
const marca = randomUUID().slice(0, 8);

type Respuesta = { codigo: number; location: string | null; cuerpo: Record<string, unknown> };

async function alta(llave: string, datos: Record<string, unknown>): Promise<Respuesta> {
  const respuesta = await fetch(BASE + "/servicios", {
    method: "POST",
    headers: { Authorization: "Bearer escritura-a", "Content-Type": "application/json", "Idempotency-Key": llave },
    body: JSON.stringify(datos),
  });
  return { codigo: respuesta.status, location: respuesta.headers.get("location"), cuerpo: await respuesta.json() };
}

async function cuantos(nombre: string): Promise<number> {
  const respuesta = await fetch(BASE + "/servicios", { headers: { Authorization: "Bearer escritura-a" } });
  const { servicios } = (await respuesta.json()) as { servicios: { nombre: string }[] };
  return servicios.filter((s) => s.nombre === nombre).length;
}

type Caso = { nombre: string; probar: () => Promise<string | null> };

const CASOS: Caso[] = [
  {
    nombre: "misma llave y mismo cuerpo: la misma respuesta, un solo servicio",
    probar: async () => {
      const datos = { nombre: `uno-${marca}`, url: URL_LAB };
      const primera = await alta(`k1-${marca}`, datos);
      const segunda = await alta(`k1-${marca}`, datos);
      if (primera.codigo !== 201) return `la primera dio ${primera.codigo}, se esperaba 201`;
      if (segunda.codigo !== 201 || segunda.location !== primera.location) {
        return `la segunda dio ${segunda.codigo} ${segunda.location}, se esperaba 201 ${primera.location}`;
      }
      const n = await cuantos(datos.nombre);
      return n === 1 ? null : `hay ${n} servicios con ese nombre, se esperaba 1`;
    },
  },
  {
    nombre: "misma llave con otro cuerpo: 422 llave-reutilizada, y no crea nada",
    probar: async () => {
      await alta(`k2-${marca}`, { nombre: `dos-${marca}`, url: URL_LAB });
      const otra = await alta(`k2-${marca}`, { nombre: `otro-${marca}`, url: URL_LAB });
      if (otra.codigo !== 422 || otra.cuerpo.type !== PROBLEMAS + "llave-reutilizada") {
        return `dio ${otra.codigo} ${String(otra.cuerpo.type ?? "")}, se esperaba 422 llave-reutilizada`;
      }
      const n = await cuantos(`otro-${marca}`);
      return n === 0 ? null : `se creó el servicio del segundo cuerpo (${n})`;
    },
  },
  {
    nombre: "misma llave mientras la original sigue en curso: 409 llave-en-curso",
    probar: async () => {
      const datos = { nombre: `tres-${marca}`, url: URL_LAB };
      const original = alta(`k3-${marca}`, datos);
      await new Promise((listo) => setTimeout(listo, 100));
      const durante = await alta(`k3-${marca}`, datos);
      const primera = await original;
      if (durante.codigo !== 409 || durante.cuerpo.type !== PROBLEMAS + "llave-en-curso") {
        return `la de en medio dio ${durante.codigo} ${String(durante.cuerpo.type ?? "")}, se esperaba 409 llave-en-curso`;
      }
      return primera.codigo === 201 ? null : `la original dio ${primera.codigo}, se esperaba 201`;
    },
  },
  {
    nombre: "un alta que falla libera la llave: corregida, con la misma llave, 201",
    probar: async () => {
      const mala = await alta(`k4-${marca}`, { nombre: `cuatro-${marca}`, url: "ftp://archivos" });
      if (mala.codigo !== 422) return `el alta mala dio ${mala.codigo}, se esperaba 422`;
      const buena = await alta(`k4-${marca}`, { nombre: `cuatro-${marca}`, url: URL_LAB });
      return buena.codigo === 201 ? null : `el alta corregida dio ${buena.codigo}, se esperaba 201`;
    },
  },
  {
    nombre: "dos llaves distintas con el mismo cuerpo: la segunda choca con el nombre (409 nombre-repetido)",
    probar: async () => {
      const datos = { nombre: `cinco-${marca}`, url: URL_LAB };
      await alta(`k5a-${marca}`, datos);
      const otra = await alta(`k5b-${marca}`, datos);
      if (otra.codigo !== 409 || otra.cuerpo.type !== PROBLEMAS + "nombre-repetido") {
        return `dio ${otra.codigo} ${String(otra.cuerpo.type ?? "")}, se esperaba 409 nombre-repetido`;
      }
      const n = await cuantos(datos.nombre);
      return n === 1 ? null : `hay ${n} servicios con ese nombre, se esperaba 1`;
    },
  },
];

let bien = 0;
for (const caso of CASOS) {
  const falla = await caso.probar();
  if (falla === null) bien++;
  console.log(`${falla === null ? "ok   " : "FALLA"} ${caso.nombre}`);
  if (falla !== null) console.log(`      ${falla}`);
}
console.log();
console.log(`${bien} de ${CASOS.length} comprobaciones de idempotencia pasaron`);
process.exitCode = bien === CASOS.length ? 0 : 1;

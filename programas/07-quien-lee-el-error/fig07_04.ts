// fig07_04.ts — comprueba la tabla de decisión del cliente del revisor.
// Uso: con laboratorio.ts corriendo, node fig07_04.ts
// Levanta, solo mientras corre, un servicio «hostil» en el puerto 18083 que responde Problem Details
// con el type que se le pida: así se prueba qué hace el cliente con un type que llega de afuera.
import { createServer } from "node:http";
import { segundosDeEspera } from "./fig07_01/cliente.ts";
import { decidir, typeDe, type Accion, type Decision } from "./fig07_01/decisiones.ts";

const LAB = "http://127.0.0.1:18081/codigo/";
const HOSTIL = "http://127.0.0.1:18083";
const BASE = "https://revisor.example/problemas/";
const CODIGOS = [200, 201, 202, 204, 301, 304, 308, 400, 401, 403, 404, 405, 409, 410, 412, 415, 422, 428, 429, 500, 502, 503, 504];
const ACCIONES: Accion[] = ["seguir", "corregir", "reautenticar", "esperar", "reconciliar", "rendirse"];

// El servicio hostil: /type/<texto> responde 409 con ese type; /idioma/<es|en> responde el mismo
// type con el title y el detail en otro idioma.
const servidor = createServer((peticion, respuesta) => {
  const ruta = decodeURIComponent(peticion.url ?? "/");
  let problema: Record<string, unknown>;
  if (ruta.startsWith("/type/")) {
    problema = { type: ruta.slice("/type/".length), title: "x", status: 409, detail: "x" };
  } else if (ruta === "/idioma/en") {
    problema = { type: BASE + "llave-en-curso", title: "That key is still in use", status: 409, detail: "the original request has not finished yet" };
  } else {
    problema = { type: BASE + "llave-en-curso", title: "Esa llave sigue en curso", status: 409, detail: "la petición original todavía no termina" };
  }
  respuesta.writeHead(409, { "Content-Type": "application/problem+json" });
  respuesta.end(JSON.stringify(problema));
});
await new Promise<void>((listo) => servidor.listen(18083, "127.0.0.1", listo));

async function decidirDe(url: string): Promise<Decision> {
  const respuesta = await fetch(url, { redirect: "manual" });
  const cuerpo = await respuesta.text();
  return decidir(
    respuesta.status,
    segundosDeEspera(respuesta.headers.get("retry-after")),
    typeDe(respuesta.headers.get("content-type"), cuerpo),
  );
}

type Caso = { nombre: string; probar: () => Promise<string | null> };

const CASOS: Caso[] = [
  {
    nombre: "los 23 códigos del curso caen en una de las seis acciones",
    probar: async () => {
      for (const codigo of CODIGOS) {
        const decision = await decidirDe(LAB + codigo);
        if (!ACCIONES.includes(decision.accion)) return `${codigo} dio «${decision.accion}»`;
      }
      return null;
    },
  },
  {
    nombre: "corregir, reautenticar, reconciliar y rendirse nunca reintentan",
    probar: async () => {
      for (const codigo of CODIGOS) {
        const decision = await decidirDe(LAB + codigo);
        if (decision.accion !== "esperar" && decision.reintenta) return `${codigo} es ${decision.accion} y reintenta`;
      }
      return null;
    },
  },
  {
    nombre: "un type conocido afina el código: el mismo 409 es esperar o reconciliar",
    probar: async () => {
      const enCurso = (await decidirDe(`${HOSTIL}/type/${encodeURIComponent(BASE + "llave-en-curso")}`)).accion;
      const repetido = (await decidirDe(`${HOSTIL}/type/${encodeURIComponent(BASE + "nombre-repetido")}`)).accion;
      return enCurso === "esperar" && repetido === "reconciliar" ? null : `llave-en-curso: ${enCurso}; nombre-repetido: ${repetido}`;
    },
  },
  {
    nombre: "un type que la tabla no conoce se decide por el código",
    probar: async () => {
      const decision = await decidirDe(`${HOSTIL}/type/${encodeURIComponent("https://otro.example/problemas/nuevo")}`);
      return decision.accion === "reconciliar" ? null : `dio ${decision.accion}, se esperaba reconciliar (el 409 a secas)`;
    },
  },
  {
    nombre: "un type heredado de Object.prototype no revienta: se decide por el código",
    probar: async () => {
      for (const nombre of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
        try {
          const decision = await decidirDe(`${HOSTIL}/type/${nombre}`);
          if (decision.accion !== "reconciliar") return `type ${nombre}: dio ${decision.accion}, se esperaba reconciliar`;
        } catch (error) {
          return `type ${nombre}: ${(error as Error).name}: ${(error as Error).message}`;
        }
      }
      return null;
    },
  },
  {
    nombre: "un código que la tabla no lista cae en el x00 de su familia",
    probar: async () => {
      const esperado: [number, Accion][] = [[299, "seguir"], [418, "corregir"], [451, "corregir"], [507, "rendirse"], [599, "rendirse"]];
      for (const [codigo, accion] of esperado) {
        const decision = await decidirDe(LAB + codigo);
        if (decision.accion !== accion) return `${codigo} dio ${decision.accion}, se esperaba ${accion}`;
      }
      return null;
    },
  },
  {
    nombre: "traducir el title y el detail no cambia la decisión",
    probar: async () => {
      const es = await decidirDe(`${HOSTIL}/idioma/es`);
      const en = await decidirDe(`${HOSTIL}/idioma/en`);
      return es.accion === en.accion && es.accion === "esperar" ? null : `en español ${es.accion}, en inglés ${en.accion}`;
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
servidor.close();
console.log();
console.log(`${bien} de ${CASOS.length} comprobaciones de la tabla pasaron`);
process.exitCode = bien === CASOS.length ? 0 : 1;

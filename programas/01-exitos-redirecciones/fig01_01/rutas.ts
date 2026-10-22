// fig01_01/rutas.ts — qué ruta y qué método atiende cada función.
import type { IncomingMessage, ServerResponse } from "node:http";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
} from "./servicios.ts";

type Manejador = (contexto: Contexto) => void | Promise<void>;
type Ruta = { patron: RegExp; metodos: Record<string, Manejador> };

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: listar, POST: darDeAlta } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: consultar, DELETE: retirar } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: pedirRevision } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: consultarRevision } },
];

// Las rutas viejas: /viejo/... se mudó con 301 y /api/... con 308.
function redirigir(ruta: string, consulta: string, respuesta: ServerResponse): boolean {
  if (ruta === "/viejo/servicios" || ruta.startsWith("/viejo/servicios/")) {
    enviarVacio(respuesta, 301, { Location: ruta.slice("/viejo".length) + consulta });
    return true;
  }
  if (ruta === "/api/servicios" || ruta.startsWith("/api/servicios/")) {
    enviarVacio(respuesta, 308, { Location: ruta.slice("/api".length) + consulta });
    return true;
  }
  return false;
}

export async function atender(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  console.log(`${peticion.method} ${peticion.url}`);
  const url = new URL(peticion.url ?? "/", "http://revisor");
  if (redirigir(url.pathname, url.search, respuesta)) return;
  // HEAD se atiende como GET; Node no manda el cuerpo.
  const metodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  for (const ruta of RUTAS) {
    const encontrada = ruta.patron.exec(url.pathname);
    // Object.hasOwn y no ruta.metodos[metodo] a secas: el método lo escribe el cliente, y un objeto también
    // «tiene» lo que hereda de Object.prototype (constructor, toString…).
    const manejador = Object.hasOwn(ruta.metodos, metodo) ? ruta.metodos[metodo] : undefined;
    if (encontrada !== null && manejador !== undefined) {
      await manejador({ peticion, respuesta, parametros: encontrada.slice(1) });
      return;
    }
  }
  // Todavía no distingue «no existe la ruta» de «no se permite el método»: eso es la lección 2.
  fallar(respuesta, 404, "no existe esa ruta");
}

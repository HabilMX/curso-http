// defectos/pila/servidor.ts — DEFECTO A PROPÓSITO: no copies este archivo; la versión correcta es fig04_01/servidor.ts.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fallar } from "./respuestas.ts";
import { atender } from "./rutas.ts";

const PUERTO = 18080;

// DEFECTO A PROPÓSITO: la pila completa viaja en el cuerpo del 500, a quien hizo la petición.
async function atenderSinFiltrar(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    const pila = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`error en ${peticion.method} ${peticion.url}`);
    if (!respuesta.headersSent) {
      fallar(respuesta, 500, pila);
    } else {
      respuesta.destroy();
    }
  }
}

createServer((peticion, respuesta) => void atenderSinFiltrar(peticion, respuesta)).listen(PUERTO, "127.0.0.1", () => {
  console.log(`revisor en http://127.0.0.1:${PUERTO}`);
});

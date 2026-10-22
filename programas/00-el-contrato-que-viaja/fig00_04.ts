// fig00_04.ts
// Un origen que puede estar sano, mentir o decir la verdad, y una caché de juguete delante.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type Modo = "sano" | "mentiroso" | "honesto";
let modo: Modo = "sano";

// ---------- El origen, en el puerto 18081 ----------

function origen(peticion: IncomingMessage, respuesta: ServerResponse): void {
  const cambio = /^\/modo\/(sano|mentiroso|honesto)$/.exec(peticion.url ?? "");
  if (peticion.method === "PUT" && cambio !== null) {
    modo = cambio[1] as Modo;
    console.log(`origen: ahora estoy ${modo}`);
    respuesta.writeHead(204).end();
    return;
  }
  if (modo === "honesto") {
    respuesta.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "120",
    });
    respuesta.end("la base de datos no está disponible\n");
    return;
  }
  const cuerpo = modo === "sano"
    ? '{"servicios":["catalogo","pagos"]}\n'
    : '{"error":"la base de datos no está disponible"}\n';
  // Esta ruta declara que sus respuestas se pueden reutilizar 5 segundos.
  respuesta.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=5, stale-if-error=600",
  });
  respuesta.end(cuerpo);
}

// ---------- La caché, en el puerto 18080 ----------

type Copia = { cuerpo: string; tipo: string; guardadaEn: number; maxAge: number; staleIfError: number };
let copia: Copia | undefined;

// Los únicos códigos que stale-if-error considera un error (RFC 5861, sección 4).
const ERRORES = new Set([500, 502, 503, 504]);

function directiva(cacheControl: string, nombre: string): number | undefined {
  const encontrada = new RegExp(`${nombre}=(\\d+)`).exec(cacheControl);
  return encontrada === null ? undefined : Number(encontrada[1]);
}

function servirCopia(respuesta: ServerResponse, guardada: Copia, edad: number): void {
  respuesta.writeHead(200, { "Content-Type": guardada.tipo, Age: String(Math.floor(edad)) });
  respuesta.end(guardada.cuerpo);
}

async function cache(_peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  const edad = copia === undefined ? Infinity : (Date.now() - copia.guardadaEn) / 1000;
  if (copia !== undefined && edad < copia.maxAge) {
    console.log("caché: tengo una copia fresca; no le pregunto al origen");
    servirCopia(respuesta, copia, edad);
    return;
  }
  const delOrigen = await fetch("http://127.0.0.1:18081/servicios");
  const cuerpo = await delOrigen.text();
  const cacheControl = delOrigen.headers.get("cache-control") ?? "";
  if (ERRORES.has(delOrigen.status) && copia !== undefined && edad < copia.maxAge + copia.staleIfError) {
    console.log(`caché: el origen respondió ${delOrigen.status}; sirvo la copia anterior`);
    servirCopia(respuesta, copia, edad);
    return;
  }
  const maxAge = directiva(cacheControl, "max-age");
  if (delOrigen.status === 200 && maxAge !== undefined) {
    copia = {
      cuerpo,
      tipo: delOrigen.headers.get("content-type") ?? "application/octet-stream",
      guardadaEn: Date.now(),
      maxAge,
      staleIfError: directiva(cacheControl, "stale-if-error") ?? 0,
    };
    console.log(`caché: guardé la respuesta 200 por ${maxAge} s`);
  } else {
    console.log(`caché: el origen respondió ${delOrigen.status}; no la guardo`);
  }
  const cabeceras: Record<string, string> = {};
  for (const nombre of ["content-type", "cache-control", "retry-after"]) {
    const valor = delOrigen.headers.get(nombre);
    if (valor !== null) cabeceras[nombre] = valor;
  }
  respuesta.writeHead(delOrigen.status, cabeceras);
  respuesta.end(cuerpo);
}

createServer(origen).listen(18081, "127.0.0.1", () => {
  console.log("origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)");
});
createServer((peticion, respuesta) => void cache(peticion, respuesta)).listen(18080, "127.0.0.1", () => {
  console.log("caché en http://127.0.0.1:18080/servicios");
});

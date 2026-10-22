// DEFECTO A PROPÓSITO (defectos/drenar-antes): esta copia tira el cuerpo que falta ANTES de responder el 413, con un tope de 1 MiB; por encima del tope el cierre vuelve a ser brusco y el 413 se pierde. No la uses como modelo.
// defectos/drenar-antes/respuestas.ts — las respuestas de éxito del revisor y la lectura del cuerpo. Los errores, en problemas.ts.
import type { IncomingMessage, ServerResponse } from "node:http";

export type Cabeceras = Record<string, string>;

// Node trae los nombres viejos de estos dos códigos; aquí van los del registro de la IANA.
const FRASES: Partial<Record<number, string>> = { 413: "Content Too Large", 422: "Unprocessable Content" };

export function escribirCabecera(respuesta: ServerResponse, codigo: number, cabeceras: Cabeceras): void {
  const frase = FRASES[codigo];
  if (frase === undefined) respuesta.writeHead(codigo, cabeceras);
  else respuesta.writeHead(codigo, frase, cabeceras);
}

export function enviarJson(respuesta: ServerResponse, codigo: number, datos: unknown, cabeceras: Cabeceras = {}): void {
  const cuerpo = JSON.stringify(datos) + "\n";
  escribirCabecera(respuesta, codigo, {
    ...cabeceras,
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(cuerpo)),
  });
  respuesta.end(cuerpo);
}

// Para 204, 304 y las redirecciones: código y cabeceras, sin cuerpo.
export function enviarVacio(respuesta: ServerResponse, codigo: number, cabeceras: Cabeceras = {}): void {
  // 204 y 304 no pueden llevar Content-Length de un cuerpo; los demás dicen «cero bytes».
  const largo: Cabeceras = codigo === 204 || codigo === 304 ? {} : { "Content-Length": "0" };
  escribirCabecera(respuesta, codigo, { ...cabeceras, ...largo });
  respuesta.end();
}

// Tope del cuerpo: 16 KiB. Un servicio es un nombre de hasta 40 caracteres, una URL y un número; cabe
// de sobra. Sin tope, leerCuerpo guardaba en memoria todo lo que llegara: un POST de 50 MB subía la
// memoria del revisor unos 150 MB, y cualquiera con la dirección podía llenarla.
export const TOPE_CUERPO = 16 * 1024;

// La señal de que el cuerpo pasó del tope. Quien llama responde 413 (RFC 9110, sección 15.5.14).
export class CuerpoDemasiadoGrande extends Error {}

// Cuando el cuerpo ya pasó del tope, el cliente puede seguir mandando. Si el servidor responde el 413 y cierra
// en ese momento, el sistema operativo contesta con un RST a lo que todavía llega, y ese RST puede borrar el 413
// antes de que el cliente lo lea: el cliente ve EPIPE o ECONNRESET en vez de la respuesta. El RFC 9112, sección
// 9.6, aconseja un cierre gradual: seguir leyendo (y tirando) lo que llegue hasta que el cliente termine. El límite
// en bytes y en tiempo (no lo fija el RFC) es del curso, para que nadie retenga la conexión mandando sin parar.
const DRENAR_MAX_BYTES = 1024 * 1024;
const DRENAR_MAX_MS = 2000;
function drenar(peticion: IncomingMessage): Promise<void> {
  return new Promise((listo) => {
    if (peticion.readableEnded || peticion.destroyed) {
      listo();
      return;
    }
    let tirados = 0;
    const fin = (): void => {
      clearTimeout(reloj);
      peticion.off("data", alLlegar);
      peticion.off("end", fin);
      peticion.off("close", fin);
      peticion.off("error", fin);
      listo();
    };
    const alLlegar = (trozo: Buffer): void => {
      tirados += trozo.length;
      if (tirados > DRENAR_MAX_BYTES) fin();
    };
    const reloj = setTimeout(fin, DRENAR_MAX_MS);
    peticion.on("data", alLlegar);
    peticion.on("end", fin);
    peticion.on("close", fin);
    peticion.on("error", fin);
    peticion.resume();
  });
}

// Lee el cuerpo contando los bytes. Si Content-Length ya anuncia más del tope, rechaza sin guardar nada;
// si no lo anuncia (cuerpo por partes) o miente, deja de guardar en cuanto se pasa. En los dos casos no
// guarda más de TOPE_CUERPO bytes. No se destruye la petición, porque con ella se iría la conexión y
// no se podría responder: antes de rechazar se drena lo que falta por llegar (ver arriba), y el 413 sale
// con «Connection: close», así que Node cierra la conexión al terminar de responder.
export function leerCuerpo(peticion: IncomingMessage): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const demasiado = (): void => {
      void drenar(peticion).then(() => rechazar(new CuerpoDemasiadoGrande(`el cuerpo pasa de ${TOPE_CUERPO} bytes`)));
    };
    if (Number(peticion.headers["content-length"] ?? 0) > TOPE_CUERPO) {
      demasiado();
      return;
    }
    const trozos: Buffer[] = [];
    let total = 0;
    const alLlegar = (trozo: Buffer): void => {
      total += trozo.length;
      if (total > TOPE_CUERPO) {
        peticion.off("data", alLlegar);
        peticion.off("end", alTerminar);
        peticion.pause();
        demasiado();
        return;
      }
      trozos.push(trozo);
    };
    const alTerminar = (): void => resolver(Buffer.concat(trozos).toString("utf8"));
    peticion.on("data", alLlegar);
    peticion.on("end", alTerminar);
    peticion.on("error", rechazar);
  });
}

// DEFECTO A PROPÓSITO (lección 7): el type se busca con POR_TYPE[type] a secas, sin Object.hasOwn.
// fig07_01/decisiones.ts — la tabla de decisión del cliente del revisor, con el defecto.
// Decide con el código y, si el cuerpo es un Problem Details con un type conocido, afina con el type.
// Nunca decide con el title ni con el detail: esos son para personas y pueden cambiar o traducirse.

export type Accion = "seguir" | "corregir" | "reautenticar" | "esperar" | "reconciliar" | "rendirse";

export type Decision = { accion: Accion; motivo: string; esperaS: number | null; reintenta: boolean };

// Por código. Lo que no está aquí se trata como el x00 de su familia (RFC 9110, sección 15).
const POR_CODIGO: Record<number, [Accion, string]> = {
  200: ["seguir", "salió bien"],
  201: ["seguir", "se creó; la dirección viene en Location"],
  202: ["seguir", "se aceptó; el seguimiento viene en Location"],
  204: ["seguir", "salió bien y no hay nada que leer"],
  300: ["corregir", "hay varias opciones: elige una dirección"],
  301: ["corregir", "la dirección cambió para siempre: actualiza la configuración"],
  302: ["corregir", "redirección temporal: el cliente no la sigue solo; revisa la dirección de Location"],
  303: ["corregir", "redirección a otro recurso: el cliente no la sigue solo; revisa la dirección de Location"],
  304: ["seguir", "no cambió: usa la copia que ya tienes"],
  307: ["corregir", "redirección temporal que conserva el método: el cliente no la sigue solo; revisa Location"],
  308: ["corregir", "la dirección cambió para siempre: actualiza la configuración"],
  400: ["corregir", "la petición no se puede leer"],
  401: ["reautenticar", "falta una credencial válida"],
  403: ["rendirse", "la credencial no tiene permiso: lo resuelve una persona"],
  404: ["rendirse", "no existe (o no te lo muestran)"],
  405: ["corregir", "ese método no se admite: mira Allow"],
  408: ["esperar", "el servidor no recibió la petición completa a tiempo: repítela tal cual, en una conexión nueva (RFC 9110, 15.5.9)"],
  409: ["reconciliar", "choca con el estado actual: relee y decide"],
  410: ["rendirse", "se retiró y no va a volver: dalo de baja"],
  412: ["reconciliar", "tu etiqueta ya no es la vigente: relee y vuelve a aplicar tu cambio"],
  415: ["corregir", "el formato no se admite: mira Accept"],
  422: ["corregir", "se entendió, pero los datos no se pueden cumplir"],
  425: ["esperar", "el servidor no quiso procesar datos tempranos: repite la petición, esta vez sin ellos (RFC 8470, 5.2)"],
  428: ["corregir", "falta la condición: manda If-Match"],
  429: ["esperar", "demasiadas peticiones: espera lo que diga Retry-After"],
  500: ["rendirse", "falla del servidor: repórtala con su instance"],
  502: ["esperar", "falló lo que está detrás: reintenta solo si la operación es idempotente"],
  503: ["esperar", "no está disponible: espera lo que diga Retry-After"],
  504: ["esperar", "lo de atrás no respondió a tiempo: reintenta solo si es idempotente"],
};

// Por type del revisor: el mismo código puede pedir cosas distintas.
const BASE = "https://revisor.example/problemas/";
const POR_TYPE: Record<string, [Accion, string]> = {
  [BASE + "llave-en-curso"]: ["esperar", "la petición original sigue en curso: espera y repite con la misma llave"],
  [BASE + "nombre-repetido"]: ["reconciliar", "ya existe: mira el miembro existente antes de crear otro"],
  [BASE + "llave-reutilizada"]: ["corregir", "usa una llave nueva para una petición nueva"],
  [BASE + "destino-prohibido"]: ["corregir", "el revisor no se conecta a esa dirección: usa otra"],
  [BASE + "servicio-retirado"]: ["rendirse", "el servicio se retiró: dalo de baja de tu lista"],
  [BASE + "en-mantenimiento"]: ["esperar", "el revisor está en mantenimiento: espera lo que diga Retry-After"],
};

// Sin respuesta HTTP también hay que decidir.
export function decidirSinRespuesta(tipo: "tiempo-agotado" | "sin-conexion" | "respuesta-invalida" | "destino-prohibido"): Decision {
  if (tipo === "destino-prohibido") return { accion: "corregir", motivo: "destino prohibido", esperaS: null, reintenta: false };
  return { accion: "esperar", motivo: tipo, esperaS: null, reintenta: true };
}

export function decidir(codigo: number, retryAfterS: number | null, type: string | null): Decision {
  const familia = codigo < 100 || codigo > 599 ? 500 : Math.floor(codigo / 100) * 100;
  const propia = (type !== null ? POR_TYPE[type] : undefined) ?? POR_CODIGO[codigo];
  const [accion, motivo] = propia ?? motivoDeFamilia(codigo, familia);
  return { accion, motivo, esperaS: accion === "esperar" ? retryAfterS : null, reintenta: accion === "esperar" };
}

// Un código que la tabla no lista se trata como el x00 de su clase (RFC 9110, sección 15). El motivo lo
// dice, para que nadie lea la frase del x00 como si fuera la del código que llegó.
function motivoDeFamilia(codigo: number, familia: number): [Accion, string] {
  const [accion, motivo] = POR_CODIGO[familia] ?? ["rendirse", "código desconocido"];
  if (codigo < 100 || codigo > 599) {
    return ["rendirse", `${codigo} no es un código de HTTP (el RFC 9110 admite de 100 a 599): se procesa como un 5xx`];
  }
  if (POR_CODIGO[familia] === undefined) return [accion, motivo];
  return [accion, `el ${codigo} no está en la tabla: se trata como un ${familia} (${motivo})`];
}

// Lee el type si el cuerpo es un Problem Details; si no, null. No lee nada más del cuerpo.
export function typeDe(tipoContenido: string | null, cuerpo: string): string | null {
  // El tipo de medio no distingue mayúsculas y puede traer parámetros (RFC 9110, sección 8.3.1).
  if (tipoContenido === null || tipoContenido.split(";")[0]?.trim().toLowerCase() !== "application/problem+json") return null;
  try {
    const problema = JSON.parse(cuerpo) as { type?: unknown };
    return typeof problema.type === "string" ? problema.type : "about:blank";
  } catch {
    return null;
  }
}

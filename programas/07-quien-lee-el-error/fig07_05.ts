// fig07_05.ts — cuántas llamadas ahorra leer bien el error: un cliente que reintenta todo contra uno
// que decide con la tabla. Las dos consultas son GET (seguros e idempotentes), así que reintentar
// no duplica nada: lo que se mide es solo cuánto se insiste. Uso: con laboratorio.ts corriendo,
// node fig07_05.ts
import { esperaConJitter, segundosDeEspera } from "./fig07_01/cliente.ts";
import { decidir, typeDe } from "./fig07_01/decisiones.ts";

const LAB = "http://127.0.0.1:18081/codigo/";
const CODIGOS = [400, 401, 403, 404, 409, 410, 422, 429, 500, 502, 503];
const INTENTOS = 3;
const TOPE_ESPERA_S = 5;

type Intento = { codigo: number; retryAfterS: number | null; type: string | null };

async function pedir(codigo: number): Promise<Intento> {
  const respuesta = await fetch(LAB + codigo);
  const cuerpo = await respuesta.text();
  return {
    codigo: respuesta.status,
    retryAfterS: segundosDeEspera(respuesta.headers.get("retry-after")),
    type: typeDe(respuesta.headers.get("content-type"), cuerpo),
  };
}

const dormir = (ms: number): Promise<void> => new Promise((listo) => setTimeout(listo, ms));

// Reintenta todo lo que sea 400 o más, sin mirar Retry-After.
async function ingenuo(codigo: number): Promise<number> {
  let llamadas = 0;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const respuesta = await pedir(codigo);
    llamadas++;
    if (respuesta.codigo < 400 || intento === INTENTOS) break;
    await dormir(esperaConJitter(intento, 250, 2000));
  }
  return llamadas;
}

// Reintenta solo si la tabla dice «esperar», y obedece Retry-After hasta un tope.
async function conTabla(codigo: number): Promise<number> {
  let llamadas = 0;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    const respuesta = await pedir(codigo);
    llamadas++;
    const decision = decidir(respuesta.codigo, respuesta.retryAfterS, respuesta.type);
    if (!decision.reintenta || intento === INTENTOS) break;
    if (decision.esperaS !== null && decision.esperaS > TOPE_ESPERA_S) break;
    await dormir(decision.esperaS !== null ? decision.esperaS * 1000 : esperaConJitter(intento, 250, 2000));
  }
  return llamadas;
}

console.log("código  sin tabla  con tabla");
let sumaIngenuo = 0;
let sumaTabla = 0;
for (const codigo of CODIGOS) {
  const a = await ingenuo(codigo);
  const b = await conTabla(codigo);
  sumaIngenuo += a;
  sumaTabla += b;
  console.log(`${String(codigo).padEnd(8)}${String(a).padStart(9)}${String(b).padStart(11)}`);
}
console.log(`total   ${String(sumaIngenuo).padStart(9)}${String(sumaTabla).padStart(11)}`);

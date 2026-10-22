// ejercicios/ej4/fig08_04.ts — DNS rebinding simulado: ¿a qué servidor llega el cliente cuando el nombre cambia de dueño
// entre la validación y la conexión? No ataca nada: el «DNS malicioso» es una función nuestra que miente
// la segunda vez que le preguntan.
// Uso: node fig08_04.ts <carpeta con cliente.ts y destinos.ts>      (por ejemplo, fig08_01 o con-fetch)
import dns from "node:dns";
import dnsPromesas from "node:dns/promises";
import { createServer } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const carpeta = process.argv[2];
if (carpeta === undefined) {
  console.error("uso: node fig08_04.ts <carpeta>");
  process.exit(2);
}

const NOMBRE = "rebote.ejemplo";
const PUERTO = 18081; // el del laboratorio: es el único destino privado que destinos.ts permite

// Dos servidores: el laboratorio de siempre (127.0.0.1) y «otro», en ::1, que responde 299.
// Ningún nombre se resuelve de verdad: las dos direcciones se escriben a mano.
const laboratorio = createServer((p, r) => {
  console.log(`  el laboratorio recibió Host: ${p.headers.host ?? "(ninguno)"}`);
  r.writeHead(200);
  r.end();
});
const otro = createServer((_p, r) => { r.writeHead(299); r.end(); });
await new Promise<void>((listo) => laboratorio.listen(PUERTO, "127.0.0.1", listo));
await new Promise<void>((listo) => otro.listen(PUERTO, "::1", listo));

// El DNS que miente: la primera pregunta recibe una dirección permitida; las demás, la del «otro».
let preguntas = 0;
function responder(nombre: string): { address: string; family: number } {
  preguntas++;
  const direccion = preguntas === 1 ? { address: "127.0.0.1", family: 4 } : { address: "::1", family: 6 };
  console.log(`  pregunta ${preguntas} al DNS: ${nombre} -> ${direccion.address}`);
  return direccion;
}
const lookupOriginal = dns.lookup;
dnsPromesas.lookup = (async (nombre: string) => [responder(nombre)]) as unknown as typeof dnsPromesas.lookup;
dns.lookup = ((nombre: string, opciones: unknown, listo?: (...args: unknown[]) => void) => {
  const cuando = typeof opciones === "function" ? (opciones as (...args: unknown[]) => void) : listo;
  const todas = typeof opciones === "object" && opciones !== null && (opciones as { all?: boolean }).all === true;
  if (nombre !== NOMBRE) return (lookupOriginal as (...args: unknown[]) => void)(nombre, opciones, listo);
  const { address, family } = responder(nombre);
  if (todas) cuando?.(null, [{ address, family }]);
  else cuando?.(null, address, family);
}) as typeof dns.lookup;
syncBuiltinESMExports(); // para que el «import { lookup }» de destinos.ts vea la función falsa

const { consultar } = (await import(pathToFileURL(join(resolve(carpeta), "cliente.ts")).href)) as {
  consultar: (url: string, limiteMs: number) => Promise<unknown>;
};

console.log(`$ consultar("http://${NOMBRE}:${PUERTO}/")   con el cliente de ${carpeta}`);
console.log(JSON.stringify(await consultar(`http://${NOMBRE}:${PUERTO}/`, 2000)));
console.log(`el DNS fue preguntado ${preguntas} ${preguntas === 1 ? "vez" : "veces"}`);

laboratorio.close();
otro.close();
process.exit(0);

// fig06_04.ts — un servidor de mentira en el 18082 (donde estaría la pasarela) que contesta lo que le digas.
// Uso: node fig06_04.ts <respuesta>...    (una respuesta por petición; la última se repite)
//   201           responde 201 con un cuerpo de juguete
//   503:2         responde 503 con «Retry-After: 2» (el número después de los dos puntos son los segundos)
//   409:en-curso  responde el 409 de «llave en curso»; 409 a secas es otro 409
//   mudo          acepta la conexión y no contesta nunca
import { createServer } from "node:http";

const pedidas = process.argv.slice(2);
if (pedidas.length === 0) {
  console.error("uso: node fig06_04.ts <respuesta>...   (por ejemplo: 503:2 201)");
  process.exit(2);
}
let peticiones = 0;
createServer((peticion, respuesta) => {
  peticion.resume();
  const pedida = pedidas[Math.min(peticiones, pedidas.length - 1)];
  peticiones++;
  console.log(`petición ${peticiones}: ${pedida}`);
  if (pedida === "mudo") return;
  const [codigo, extra] = pedida.split(":");
  const estado = Number(codigo);
  const bien = estado < 300;
  const cabeceras: Record<string, string> = { "Content-Type": bien ? "application/json" : "application/problem+json" };
  if (!bien && extra !== undefined && extra !== "en-curso") cabeceras["Retry-After"] = extra;
  const tipo = estado === 409 && extra === "en-curso" ? "https://revisor.example/problemas/llave-en-curso" : "about:blank";
  const cuerpo = bien ? { id: 99 } : { type: tipo, title: "respuesta de mentira", status: estado };
  respuesta.writeHead(estado, cabeceras);
  respuesta.end(JSON.stringify(cuerpo) + "\n");
}).listen(18082, "127.0.0.1", () => console.log("servidor de mentira en http://127.0.0.1:18082"));

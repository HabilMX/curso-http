// fig04_03.ts — leer Retry-After en sus dos formas: segundos o una fecha HTTP.
import { segundosDeEspera } from "./fig04_01/cliente.ts";

const dentroDe90 = new Date(Date.now() + 90_000).toUTCString();
const VALORES: (string | null)[] = ["120", "0", dentroDe90, "Wed, 21 Oct 2015 07:28:00 GMT", "mañana", null];

for (const valor of VALORES) {
  const texto = valor === null ? "(sin la cabecera)" : JSON.stringify(valor);
  console.log(`${texto.padEnd(34)} → ${segundosDeEspera(valor) ?? "null: no dice cuánto esperar"}`);
}

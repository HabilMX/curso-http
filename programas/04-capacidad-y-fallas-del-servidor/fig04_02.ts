// fig04_02.ts — la ventana fija, vista de cerca: 3 permisos cada 1000 ms.
// Usa el mismo limitador del revisor, con una ventana corta para no esperar un minuto.
import { setTimeout as esperar } from "node:timers/promises";
import { permitir } from "./fig04_01/limitador.ts";

const MAXIMO = 3;
const VENTANA_MS = 1000;
// Cuándo pide cada petición, en milisegundos desde el arranque.
const PLAN = [0, 950, 960, 1005, 1010, 1015, 1020];

const inicio = performance.now();
const permitidas: number[] = [];
for (const cuando of PLAN) {
  await esperar(Math.max(0, cuando - (performance.now() - inicio)));
  const decision = permitir("demo", MAXIMO, VENTANA_MS);
  const ms = Math.round(performance.now() - inicio);
  if (decision.permitido) permitidas.push(ms);
  const texto = decision.permitido ? "permitida" : `rechazada: Retry-After ${decision.esperaS}`;
  console.log(`${String(ms).padStart(5)} ms  ${texto}`);
}
const rafaga = permitidas.filter((ms) => ms >= 900);
console.log();
console.log(`límite: ${MAXIMO} cada ${VENTANA_MS} ms`);
console.log(`permitidas entre ${rafaga[0]} y ${rafaga[rafaga.length - 1]} ms: ${rafaga.length}`);

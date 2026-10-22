// fig06_02.ts — el retroceso exponencial, con y sin jitter: cuánto espera cada intento y qué ve el servidor.
// Usa la misma función del revisor. No necesita ningún servidor: solo hace cuentas.
import { esperaConJitter } from "./fig06_01/cliente.ts";

const BASE_MS = 250;
const TOPE_MS = 2000;

// 1. El techo de cada intento: base × 2^intento, sin pasar del tope. El jitter completo sortea entre 0 y el techo.
console.log("intento  techo (ms)  cinco esperas sorteadas (ms)");
for (let intento = 1; intento <= 5; intento++) {
  const techo = Math.min(TOPE_MS, BASE_MS * 2 ** intento);
  const sorteadas = Array.from({ length: 5 }, () => esperaConJitter(intento, BASE_MS, TOPE_MS));
  console.log(`${String(intento).padStart(7)}  ${String(techo).padStart(10)}  ${sorteadas.join(", ")}`);
}

// 2. Mil clientes fallan en el mismo instante y reintentan una vez (intento 1, techo de 500 ms).
// Se cuentan sus reintentos en ventanas de 100 ms, que es lo que el servidor recibe.
const CLIENTES = 1000;
const VENTANA_MS = 100;
function contar(esperas: number[]): number[] {
  const cuentas = Array.from({ length: 6 }, () => 0);
  for (const espera of esperas) cuentas[Math.min(5, Math.floor(espera / VENTANA_MS))]++;
  return cuentas;
}
const sinJitter = contar(Array.from({ length: CLIENTES }, () => Math.min(TOPE_MS, BASE_MS * 2 ** 1)));
const conJitter = contar(Array.from({ length: CLIENTES }, () => esperaConJitter(1, BASE_MS, TOPE_MS)));

console.log();
console.log(`${CLIENTES} clientes reintentan a la vez; reintentos por cada ${VENTANA_MS} ms:`);
console.log("ventana (ms)   sin jitter  con jitter");
for (let i = 0; i < 6; i++) {
  const ventana = i < 5 ? `${i * VENTANA_MS}-${(i + 1) * VENTANA_MS - 1}` : `${i * VENTANA_MS} o más`;
  console.log(`${ventana.padEnd(12)}  ${String(sinJitter[i]).padStart(10)}  ${String(conJitter[i]).padStart(10)}`);
}
console.log(`la ventana más cargada: ${Math.max(...sinJitter)} sin jitter, ${Math.max(...conJitter)} con jitter`);

// fig08_06.ts — ¿qué tan holgada es una espera fija? Mide cuánto tarda la pasarela en empezar a escuchar
// después de levantarla, N veces seguidas, y da la mediana, el percentil 95 y el máximo.
// Uso: node fig08_06.ts [N] [carpeta con pasarela.ts]     (por omisión, 100 y fig08_01)
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const N = Number(process.argv[2] ?? 100);
const carpeta = resolve(process.argv[3] ?? "fig08_01");

const tiempos: number[] = [];
for (let i = 0; i < N; i++) {
  const inicio = performance.now();
  const hijo = spawn(process.execPath, ["pasarela.ts"], { cwd: carpeta, stdio: "ignore" });
  // Se pregunta cada 5 ms hasta que alguien contesta en el 18082: cualquier respuesta sirve, incluso un error.
  while (!(await fetch("http://127.0.0.1:18082/").then(() => true, () => false))) {
    await new Promise((listo) => setTimeout(listo, 5));
  }
  tiempos.push(Math.round(performance.now() - inicio));
  const salio = new Promise((listo) => hijo.once("exit", listo));
  hijo.kill();
  await salio;
}
tiempos.sort((a, b) => a - b);
console.log(`n=${N}  mediana=${tiempos[Math.floor(N / 2)]} ms  p95=${tiempos[Math.floor(N * 0.95)]} ms  máximo=${tiempos[N - 1]} ms`);
// La matriz de esperas fijas (defectos/espera-fija) esperaba 500 ms a la pasarela y 1000 ms al revisor: cuántos arranques pasaron de cada tiempo.
console.log(`arranques de más de 500 ms: ${tiempos.filter((t) => t > 500).length}   de más de 1000 ms: ${tiempos.filter((t) => t > 1000).length}`);

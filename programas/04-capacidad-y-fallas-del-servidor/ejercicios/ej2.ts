// ejercicios/ej2.ts — Retry-After: la lectura del revisor contra una ingenua que confía en Date.parse.
import { segundosDeEspera } from "../fig04_01/cliente.ts";

// La versión ingenua: dígitos, o lo que Date.parse quiera entender como fecha.
function segundosConDateParse(valor: string): number | null {
  if (/^\d+$/.test(valor)) return Number(valor);
  const fecha = Date.parse(valor);
  return Number.isNaN(fecha) ? null : Math.max(0, Math.ceil((fecha - Date.now()) / 1000));
}

// La misma fecha, un minuto adelante, en las tres formas de HTTP-date (RFC 9110, sección 5.6.7).
const enUnMinuto = new Date(Math.ceil((Date.now() + 60_000) / 1000) * 1000);
const imf = enUnMinuto.toUTCString();
const [, dia, num, mes, anio, hora] = /^(\w{3}), (\d{2}) (\w{3}) (\d{4}) (\S+) GMT$/.exec(imf) ?? [];
const DIAS_LARGOS: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};
const rfc850 = `${DIAS_LARGOS[dia]}, ${num}-${mes}-${anio.slice(2)} ${hora} GMT`;
const asctime = `${dia} ${mes} ${num.replace(/^0/, " ")} ${hora} ${anio}`;

const VALORES = ["120", "1.5", "-1", "12 30", "Xyz, 21 Oct 2026 10:00:00 GMT", "Wed, 32 Oct 2026 10:00:00 GMT", imf, rfc850, asctime];

console.log(`${"valor".padEnd(36)}${"Date.parse".padStart(11)}${"revisor".padStart(9)}`);
for (const valor of VALORES) {
  const ingenua = segundosConDateParse(valor);
  console.log(`${JSON.stringify(valor).padEnd(36)}${String(ingenua).padStart(11)}${String(segundosDeEspera(valor)).padStart(9)}`);
}

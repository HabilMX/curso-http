// fig05_02.ts — comprueba que cada error del revisor sea un Problem Details bien formado (RFC 9457).
// Uso: node fig05_02.ts [base]     (por omisión, http://127.0.0.1:18080)
import { STATUS_CODES } from "node:http";

const BASE = process.argv[2] ?? "http://127.0.0.1:18080";
const MIEMBROS = ["type", "title", "status", "detail", "instance"];
// Node trae los nombres viejos de estos dos códigos; el registro de la IANA, los nuevos.
const FRASES: Record<number, string> = { 413: "Content Too Large", 422: "Unprocessable Content" };

type Caso = { nombre: string; metodo: string; ruta: string; cabeceras?: Record<string, string>; cuerpo?: string };

const escritor = { Authorization: "Bearer escritura-a" };
const json = { ...escritor, "Content-Type": "application/json" };

const CASOS: Caso[] = [
  { nombre: "servicio que no existe", metodo: "GET", ruta: "/servicios/99", cabeceras: escritor },
  { nombre: "servicio de otro equipo", metodo: "GET", ruta: "/servicios/3", cabeceras: escritor },
  { nombre: "revisión que no existe", metodo: "GET", ruta: "/revisiones/99", cabeceras: escritor },
  { nombre: "ruta que no existe", metodo: "GET", ruta: "/servicioss", cabeceras: escritor },
  { nombre: "método que la ruta no admite", metodo: "PATCH", ruta: "/servicios/1", cabeceras: escritor },
  { nombre: "sin credencial", metodo: "GET", ruta: "/servicios" },
  { nombre: "cuerpo en texto", metodo: "POST", ruta: "/servicios", cabeceras: { ...escritor, "Content-Type": "text/plain" }, cuerpo: "x" },
  { nombre: "cuerpo de más de 16 KiB", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: `{"nombre":"${"a".repeat(17_000)}"}` },
  { nombre: "datos imposibles", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: '{"nombre":"","url":"ftp://x"}' },
  { nombre: "nombre repetido", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}' },
  { nombre: "cambio sin If-Match", metodo: "PUT", ruta: "/servicios/1", cabeceras: json, cuerpo: "{}" },
  { nombre: "versión retirada", metodo: "GET", ruta: "/v0/servicios", cabeceras: escritor },
  { nombre: "error interno", metodo: "GET", ruta: "/servicios/1/informe", cabeceras: escritor },
];

// Lo que el revisor ya respondió para cada type: el title y el status no deben cambiar entre ocurrencias.
const vistos = new Map<string, { title: unknown; status: unknown }>();

async function comprobar(caso: Caso): Promise<string[]> {
  const respuesta = await fetch(BASE + caso.ruta, { method: caso.metodo, headers: caso.cabeceras, body: caso.cuerpo });
  const fallas: string[] = [];
  const tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();
  if (tipo !== "application/problem+json") fallas.push(`tipo ${tipo || "(ninguno)"}, se esperaba application/problem+json`);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(await respuesta.text());
  } catch {
    return [...fallas, "el cuerpo no es JSON"];
  }
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) return [...fallas, "el cuerpo no es un objeto"];
  const problema = cuerpo as Record<string, unknown>;
  for (const miembro of MIEMBROS) {
    if (!Object.hasOwn(problema, miembro)) fallas.push(`falta ${miembro}`);
  }
  // status: un número, y el mismo que la línea de estado (RFC 9457, sección 3.1.2).
  if (problema.status !== respuesta.status) fallas.push(`status ${JSON.stringify(problema.status)} en el cuerpo y ${respuesta.status} en la línea`);
  // type: about:blank o un URI absoluto (sección 3.1.1 recomienda absolutos).
  const type = problema.type;
  if (typeof type !== "string") {
    fallas.push("type no es un texto");
  } else if (type !== "about:blank" && !URL.canParse(type)) {
    fallas.push(`type ${type} no es un URI absoluto`);
  }
  // Con about:blank, el title es la frase del código (sección 4.2.1).
  const frase = FRASES[respuesta.status] ?? STATUS_CODES[respuesta.status];
  if (type === "about:blank" && problema.title !== frase) fallas.push(`title ${JSON.stringify(problema.title)} con about:blank; se esperaba ${frase}`);
  // El mismo type, el mismo title y el mismo status en cada ocurrencia (sección 3.1.3).
  if (typeof type === "string" && type !== "about:blank") {
    const antes = vistos.get(type);
    if (antes === undefined) vistos.set(type, { title: problema.title, status: problema.status });
    else if (antes.title !== problema.title || antes.status !== problema.status) fallas.push(`${type} cambió de title o de status entre ocurrencias`);
  }
  return fallas;
}

let bien = 0;
for (const caso of CASOS) {
  const fallas = await comprobar(caso);
  if (fallas.length === 0) bien++;
  console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${caso.metodo} ${caso.ruta} (${caso.nombre})${fallas.map((f) => "\n      " + f).join("")}`);
}
console.log(`\n${bien} de ${CASOS.length} respuestas son Problem Details bien formados`);
process.exitCode = bien === CASOS.length ? 0 : 1;

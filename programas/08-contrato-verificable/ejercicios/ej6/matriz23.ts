// ejercicios/ej6/matriz23.ts — la API verificable: los 23 códigos del curso, uno por escenario, con un solo comando.
// Levanta el laboratorio y el revisor, comprueba en cada respuesta el código, las cabeceras obligatorias,
// el tipo de contenido y el cuerpo, revisa que cada respuesta esté documentada en openapi.json,
// y apaga todo. Sale con 0 si todo pasó y con 1 si algo falló.
// Uso: node matriz23.ts
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { connect } from "node:net";
import { setTimeout as esperar } from "node:timers/promises";

// Espera a que algo acepte conexiones en el puerto, hasta 10 s: en lugar de un tiempo fijo después de levantar un
// proceso, que con la máquina cargada se queda corto. Si el proceso que se levantó ya salió (por ejemplo, porque el
// puerto estaba ocupado), falla en seguida en vez de esperar a que conteste.
async function esperarPuerto(puerto: number, proceso?: ChildProcess): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (proceso !== undefined && proceso.exitCode !== null) throw new Error(`el proceso del puerto ${puerto} salió antes de escuchar`);
    if (await aceptaConexiones(puerto)) return;
    await esperar(100);
  }
  throw new Error(`el puerto ${puerto} no respondió en 10 s`);
}

// Levanta un programa del curso y espera a que escuche. Antes comprueba que el puerto esté libre: si ya lo ocupa
// un proceso viejo, esperarPuerto lo daría por bueno aunque el programa nuevo muriera con EADDRINUSE.
async function arrancar(archivo: string, puerto: number): Promise<ChildProcess> {
  if (await aceptaConexiones(puerto)) throw new Error(`puerto ${puerto} ocupado; apaga lo que lo usa`);
  const proceso = spawn(process.execPath, [archivo], { cwd: import.meta.dirname, stdio: "ignore" });
  await esperarPuerto(puerto, proceso);
  return proceso;
}

// ¿Hay algo que acepte conexiones TCP en el puerto?
function aceptaConexiones(puerto: number): Promise<boolean> {
  return new Promise((listo) => {
    const conexion = connect(puerto, "127.0.0.1");
    conexion.once("connect", () => { conexion.destroy(); listo(true); });
    conexion.once("error", () => listo(false));
  });
}

const R = "http://127.0.0.1:18080";
const LAB = "http://127.0.0.1:18081";
const PROBLEMA = "https://revisor.example/problemas/";
const LEE = { Authorization: "Bearer lectura-a" };
const ESCRIBE = { Authorization: "Bearer escritura-a" };
const JSON_ = { "Content-Type": "application/json" };

type Peticion = { metodo: string; ruta: string; cabeceras?: Record<string, string>; cuerpo?: string };
type Escenario = {
  codigo: number;
  nombre: string;
  operacion: [string, string]; // método y ruta tal como los documenta openapi.json
  antes?: Peticion[];
  peticion: Peticion;
  cabeceras: string[];
  tipo: "application/json" | "application/problem+json" | null; // null: sin cuerpo
  type?: string;
  revisarCuerpo?: (cuerpo: Record<string, unknown>) => string | null;
};

// La ETag cambia en cada arranque del revisor (almacen.ts): el 304 se pide con la que se lee al empezar.
const SIN_CAMBIOS: Record<string, string> = { ...LEE };

const alta = (nombre: string): string => JSON.stringify({ nombre, url: `${LAB}/codigo/200` });

const ESCENARIOS: Escenario[] = [
  { codigo: 200, nombre: "consultar un servicio", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/1", cabeceras: LEE }, cabeceras: ["etag"], tipo: "application/json",
    revisarCuerpo: (c) => (c.id === 1 ? null : "el id no es 1") },
  { codigo: 304, nombre: "consultar sin cambios", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/1", cabeceras: SIN_CAMBIOS }, cabeceras: ["etag"], tipo: null },
  { codigo: 201, nombre: "dar de alta", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("matriz") },
    cabeceras: ["location", "etag"], tipo: "application/json", revisarCuerpo: (c) => (c.nombre === "matriz" ? null : "no es matriz") },
  { codigo: 202, nombre: "pedir revisión", operacion: ["post", "/servicios/{id}/revisiones"],
    peticion: { metodo: "POST", ruta: "/servicios/1/revisiones", cabeceras: ESCRIBE }, cabeceras: ["location"], tipo: "application/json",
    revisarCuerpo: (c) => (c.estado === "pendiente" ? null : "no está pendiente") },
  { codigo: 204, nombre: "retirar", operacion: ["delete", "/servicios/{id}"],
    peticion: { metodo: "DELETE", ruta: "/servicios/7", cabeceras: ESCRIBE }, cabeceras: [], tipo: null },
  { codigo: 301, nombre: "ruta vieja con 301", operacion: ["post", "/viejo/servicios"],
    peticion: { metodo: "POST", ruta: "/viejo/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("viejo") }, cabeceras: ["location"], tipo: null },
  { codigo: 308, nombre: "ruta vieja con 308", operacion: ["post", "/api/servicios"],
    peticion: { metodo: "POST", ruta: "/api/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("api") }, cabeceras: ["location"], tipo: null },
  { codigo: 400, nombre: "cuerpo ilegible", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: '{"nombre":' },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "cuerpo-ilegible" },
  { codigo: 401, nombre: "sin credencial", operacion: ["get", "/servicios"],
    peticion: { metodo: "GET", ruta: "/servicios" }, cabeceras: ["www-authenticate"], tipo: "application/problem+json", type: PROBLEMA + "credencial-invalida" },
  { codigo: 403, nombre: "lectura que intenta escribir", operacion: ["delete", "/servicios/{id}"],
    peticion: { metodo: "DELETE", ruta: "/servicios/1", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "permiso-insuficiente",
    // La credencial es un secreto: el cuerpo no la repite (quedaría en cualquier bitácora que lo guarde).
    revisarCuerpo: (c) => (JSON.stringify(c).includes("lectura-a") ? "el cuerpo repite la credencial" : null) },
  { codigo: 404, nombre: "servicio que no existe", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/99", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "servicio-inexistente" },
  // OpenAPI no describe un método que no existe: el 405 se documenta en las operaciones que sí existen.
  { codigo: 405, nombre: "método no admitido", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "PATCH", ruta: "/servicios/1", cabeceras: ESCRIBE }, cabeceras: ["allow"], tipo: "application/problem+json", type: "about:blank" },
  { codigo: 409, nombre: "nombre repetido", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("pagos") },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "nombre-repetido",
    revisarCuerpo: (c) => (c.existente === "/servicios/2" ? null : "falta la extensión existente") },
  { codigo: 410, nombre: "servicio retirado", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/7", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "servicio-retirado" },
  { codigo: 412, nombre: "etiqueta vencida", operacion: ["put", "/servicios/{id}"],
    peticion: { metodo: "PUT", ruta: "/servicios/1", cabeceras: { ...ESCRIBE, ...JSON_, "If-Match": '"1-0"' }, cuerpo: alta("catalogo") },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "etiqueta-vencida" },
  { codigo: 415, nombre: "formato no admitido", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, "Content-Type": "text/plain" }, cuerpo: "matriz" },
    cabeceras: ["accept"], tipo: "application/problem+json", type: "about:blank" },
  { codigo: 422, nombre: "datos imposibles", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: '{"nombre":"","url":"ftp://x"}' },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "datos-invalidos",
    revisarCuerpo: (c) => (Array.isArray(c.errors) && c.errors.length === 2 ? null : "errors no trae las 2 fallas") },
  { codigo: 428, nombre: "cambio sin If-Match", operacion: ["put", "/servicios/{id}"],
    peticion: { metodo: "PUT", ruta: "/servicios/1", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("catalogo") },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "falta-condicion" },
  { codigo: 429, nombre: "demasiadas revisiones", operacion: ["post", "/servicios/{id}/revisiones"],
    antes: [1, 2, 3].map(() => ({ metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE })),
    peticion: { metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE },
    cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "demasiadas-revisiones" },
  { codigo: 500, nombre: "el defecto a propósito", operacion: ["get", "/servicios/{id}/informe"],
    peticion: { metodo: "GET", ruta: "/servicios/4/informe", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "error-interno",
    revisarCuerpo: (c) => (typeof c.instance === "string" && c.instance.startsWith("urn:uuid:") ? null : "instance no es urn:uuid") },
  { codigo: 502, nombre: "el servicio responde basura", operacion: ["get", "/servicios/{id}/salud"],
    peticion: { metodo: "GET", ruta: "/servicios/6/salud", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "respuesta-invalida" },
  { codigo: 503, nombre: "mantenimiento", operacion: ["get", "/servicios"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":true}' }],
    peticion: { metodo: "GET", ruta: "/servicios", cabeceras: LEE }, cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "en-mantenimiento" },
  { codigo: 504, nombre: "el servicio no responde a tiempo", operacion: ["get", "/servicios/{id}/salud"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":false}' }],
    peticion: { metodo: "GET", ruta: "/servicios/5/salud", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "servicio-lento" },
];

// Lo que jamás debe salir en el cuerpo de un 5xx: pilas, rutas de archivos, SQL, secretos.
const FUGAS = [/\bat \S+ \(/, /file:\/\//, /\/(home|Users)\//, /node:internal/, /\bSELECT\b.+\bFROM\b/i, /Bearer \S+/, /TypeError|ReferenceError/];

function enviar(p: Peticion): Promise<Response> {
  return fetch(R + p.ruta, { method: p.metodo, headers: p.cabeceras, body: p.cuerpo, redirect: "manual" });
}

const documento = JSON.parse(readFileSync(new URL("./openapi.json", import.meta.url), "utf8")) as {
  paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
};

async function comprobar(e: Escenario): Promise<string[]> {
  const fallas: string[] = [];
  for (const previa of e.antes ?? []) await (await enviar(previa)).text();
  const respuesta = await enviar(e.peticion);
  const texto = await respuesta.text();
  if (respuesta.status !== e.codigo) fallas.push(`código ${respuesta.status}, se esperaba ${e.codigo}`);
  for (const cabecera of e.cabeceras) if (!respuesta.headers.has(cabecera)) fallas.push(`falta ${cabecera}`);
  const tipo = respuesta.headers.get("content-type");
  if (e.tipo === null) {
    if (texto !== "") fallas.push("trae cuerpo y no debía");
  } else if (tipo !== e.tipo) {
    fallas.push(`tipo ${tipo}, se esperaba ${e.tipo}`);
  } else {
    const cuerpo = JSON.parse(texto) as Record<string, unknown>;
    if (e.tipo === "application/problem+json") {
      if (cuerpo.type !== e.type) fallas.push(`type ${String(cuerpo.type)}, se esperaba ${e.type}`);
      if (cuerpo.status !== e.codigo) fallas.push("status del cuerpo distinto del código");
      if (typeof cuerpo.title !== "string") fallas.push("falta title");
    }
    const otra = e.revisarCuerpo?.(cuerpo) ?? null;
    if (otra !== null) fallas.push(otra);
  }
  if (e.codigo >= 500) for (const fuga of FUGAS) if (fuga.test(texto)) fallas.push(`el cuerpo filtra ${fuga}`);
  const [metodo, ruta] = e.operacion;
  if (documento.paths[ruta]?.[metodo]?.responses?.[String(e.codigo)] === undefined) {
    fallas.push(`openapi.json no documenta ${e.codigo} en ${metodo.toUpperCase()} ${ruta}`);
  }
  return fallas;
}

// Comprobaciones que el README pide además de los 23: idempotencia, SSRF y una credencial que solo
// existe en Object.prototype (regresión: con las credenciales en un objeto literal, pasaba con 200).
// Y cinco regresiones de la RFC: If-None-Match con lista, W/ y «*» (comparación débil); If-Match
// fuerte; el esquema «bearer» en minúsculas; el reto sin error con otro esquema; y un método con
// nombre de Object.prototype, que se prueba llamando a rutas.ts sin servidor (Node lo corta antes).
async function adicionales(): Promise<[string, string[]][]> {
  const resultados: [string, string[]][] = [];
  const llave = { ...ESCRIBE, ...JSON_, "Idempotency-Key": "matriz-1" };
  const a = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: llave, cuerpo: alta("idempotente") });
  const b = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: llave, cuerpo: alta("idempotente") });
  const c = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: llave, cuerpo: alta("otra-cosa") });
  const fallasLlave: string[] = [];
  if (a.status !== 201 || b.status !== 201) fallasLlave.push(`${a.status} y ${b.status}, se esperaba 201 y 201`);
  if (a.headers.get("location") !== b.headers.get("location")) fallasLlave.push("la repetición creó otro servicio");
  if (c.status !== 422) fallasLlave.push(`la misma llave con otro cuerpo dio ${c.status}, se esperaba 422`);
  resultados.push(["misma Idempotency-Key: no duplica; con otro cuerpo, 422", fallasLlave]);
  for (const url of ["http://169.254.169.254/latest/meta-data/", "http://localhost:18080/mantenimiento"]) {
    const r = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: JSON.stringify({ nombre: "ssrf", url }) });
    const cuerpo = (await r.json()) as { type?: string };
    const fallas = r.status === 422 && cuerpo.type === PROBLEMA + "destino-prohibido" ? [] : [`${r.status} ${cuerpo.type}`];
    resultados.push([`SSRF: ${url} se rechaza con 422 destino-prohibido`, fallas]);
  }
  const fallasPrototipo: string[] = [];
  for (const token of ["constructor", "__proto__", "toString"]) {
    const r = await enviar({ metodo: "GET", ruta: "/servicios", cabeceras: { Authorization: `Bearer ${token}` } });
    const cuerpo = (await r.json()) as { type?: string };
    if (r.status !== 401 || cuerpo.type !== PROBLEMA + "credencial-invalida") fallasPrototipo.push(`Bearer ${token}: ${r.status}`);
  }
  resultados.push(["credencial heredada de Object.prototype (constructor, __proto__, toString): 401", fallasPrototipo]);
  resultados.push(await condicionales());
  resultados.push(await actualizacionPerdida());
  resultados.push(await ordenDelPut());
  resultados.push(await esquemas());
  resultados.push(await metodoHeredado());
  resultados.push(await cuerpoNoObjeto());
  resultados.push(await cuerpoGrande());
  resultados.push(await consultasEnVivo());
  resultados.push(await esperaRetryAfter());
  resultados.push(await rangosSsrf());
  resultados.push(await sinRevisorNiPasarela());
  resultados.push(await altaSeguraDecide());
  resultados.push(await banco205());
  resultados.push(await etiquetaTrasReinicio());
  return resultados;
}

// Un cuerpo JSON que no es un objeto: 400 cuerpo-ilegible, y el revisor sigue respondiendo después.
async function cuerpoNoObjeto(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  for (const cuerpo of ["null", "7", '"texto"', "[]"]) {
    const r = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo });
    const problema = (await r.json()) as { type?: string };
    if (r.status !== 400 || problema.type !== PROBLEMA + "cuerpo-ilegible") fallas.push(`${cuerpo}: ${r.status} ${problema.type}`);
  }
  const vivo = await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE }).then((r) => r.status, () => 0);
  if (vivo !== 200) fallas.push(`después, GET /servicios/1 dio ${vivo}`);
  return ["cuerpo JSON que no es objeto (null, 7, \"texto\", []): 400, y el revisor sigue vivo", fallas];
}

// El tope del cuerpo (16 KiB): con Content-Length y por partes, 413 about:blank; justo en el tope, 400;
// y el revisor sigue vivo después.
async function cuerpoGrande(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const grande = "a".repeat(20000);
  const conLargo = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: grande });
  const problema = (await conLargo.json()) as { type?: string; status?: number };
  if (conLargo.status !== 413 || problema.type !== "about:blank" || problema.status !== 413) {
    fallas.push(`20000 bytes con Content-Length: ${conLargo.status} ${problema.type}`);
  }
  if (conLargo.headers.get("connection") !== "close") fallas.push("el 413 no cierra la conexión");
  const porPartes = new ReadableStream<Uint8Array>({
    start(control) {
      for (let i = 0; i < 20; i++) control.enqueue(new TextEncoder().encode("a".repeat(1000)));
      control.close();
    },
  });
  const sinLargo = await fetch(R + "/servicios", { method: "POST", headers: { ...ESCRIBE, ...JSON_ }, body: porPartes, duplex: "half" } as RequestInit)
    .then(async (r) => { await r.text(); return r.status; }, (error: unknown) => `error ${String(error)}`);
  if (sinLargo !== 413) fallas.push(`20000 bytes por partes: ${sinLargo}`);
  const enElTope = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: "a".repeat(16384) });
  await enElTope.text();
  if (enElTope.status !== 400) fallas.push(`16384 bytes: ${enElTope.status}, se esperaba 400`);
  const vivo = await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE }).then((r) => r.status, () => 0);
  if (vivo !== 200) fallas.push(`después, GET /servicios/1 dio ${vivo}`);
  return ["cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo", fallas];
}

// /salud sale a la red como una revisión: 3 por credencial cada minuto; la cuarta, 429 demasiadas-consultas.
// Usa admin, que ningún escenario usa para /salud; después, escritura-a no paga lo que gastó admin.
// Y el límite se consulta antes de buscar el servicio: quien enumera ids con escritura-b llega al 429.
async function consultasEnVivo(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const codigos: number[] = [];
  let ultima: Response | undefined;
  for (let i = 0; i < 4; i++) {
    ultima = await enviar({ metodo: "GET", ruta: "/servicios/1/salud", cabeceras: { Authorization: "Bearer admin" } });
    codigos.push(ultima.status);
    if (i < 3) await ultima.text();
  }
  const problema = ultima === undefined ? {} : ((await ultima.json()) as { type?: string });
  if (codigos.join(" ") !== "200 200 200 429") fallas.push(`códigos ${codigos.join(" ")}, se esperaba 200 200 200 429`);
  if (problema.type !== PROBLEMA + "demasiadas-consultas") fallas.push(`type ${problema.type}`);
  if (ultima?.headers.get("retry-after") === null) fallas.push("el 429 no trae Retry-After");
  const otra = await enviar({ metodo: "GET", ruta: "/servicios/1/salud", cabeceras: ESCRIBE });
  await otra.text();
  if (otra.status !== 200) fallas.push(`escritura-a dio ${otra.status} después del 429 de admin, se esperaba 200`);
  const enumeracion: number[] = [];
  // Ids del 11 al 20: no existen y nadie más los pidió, así que solo un límite por credencial los frena.
  for (let id = 11; id <= 20; id++) {
    const r = await enviar({ metodo: "POST", ruta: `/servicios/${id}/revisiones`, cabeceras: { Authorization: "Bearer escritura-b" } });
    await r.text();
    enumeracion.push(r.status);
  }
  if (!enumeracion.includes(429)) fallas.push(`enumerar los ids 11 a 20 con escritura-b dio ${enumeracion.join(" ")}, sin ningún 429`);
  return ["429 por credencial: la cuarta consulta en vivo, 429; otra credencial no lo paga; enumerar ids llega al 429", fallas];
}

// Retry-After estricto (RFC 9110, sección 10.2.3): segundos o HTTP-date en GMT; lo demás se ignora.
async function esperaRetryAfter(): Promise<[string, string[]]> {
  const { segundosDeEspera } = await import("./cliente.ts");
  const fallas: string[] = [];
  for (const valor of ["1.5", "-1", "12 30", "2100-01-01T00:00:00Z"]) {
    const s = segundosDeEspera(valor);
    if (s !== null) fallas.push(`${JSON.stringify(valor)} dio ${s}, se esperaba ignorarlo`);
  }
  if (segundosDeEspera("120") !== 120) fallas.push("120 no dio 120");
  // En una zona que no es GMT, para que una fecha leída como hora local se note (UTC−6: 21600 s de más).
  const zona = process.env.TZ;
  process.env.TZ = "America/Mexico_City";
  const imf = segundosDeEspera("Wed, 01 Jan 2070 00:00:00 GMT");
  const formas = [segundosDeEspera("Wednesday, 01-Jan-70 00:00:00 GMT"), segundosDeEspera("Wed Jan  1 00:00:00 2070")];
  if (zona === undefined) delete process.env.TZ;
  else process.env.TZ = zona;
  if (imf === null || formas.some((s) => s === null || Math.abs(s - imf) > 1)) {
    fallas.push(`la misma fecha en sus tres formas dio ${imf}, ${formas.join(", ")}`);
  }
  return ["Retry-After: 1.5, -1 y «12 30» se ignoran; las tres formas de HTTP-date dan lo mismo (GMT)", fallas];
}

// Rangos que faltaban: CGNAT, NAT64 con una IPv4 de enlace local adentro, multicast IPv4 e IPv6.
async function rangosSsrf(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const urls = [
    "http://100.100.100.200/latest/meta-data/", "http://[64:ff9b::a9fe:a9fe]/", "http://224.0.0.1/", "http://[ff02::1]/",
    "http://[2002:a9fe:a9fe::]/", "http://[::7f00:1]/", "http://[64:ff9b:1::a9fe:a9fe]/", "http://240.0.0.1/",
    "http://198.18.0.1/", "http://192.0.2.1/", "http://[2001:db8::1]/", "http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/",
  ];
  for (const [i, url] of urls.entries()) {
    const nombre = `rango-${i + 1}`; // un nombre por URL: si una pasa, la siguiente no choca con un 409
    const r = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: JSON.stringify({ nombre, url }) });
    const problema = (await r.json()) as { type?: string };
    if (r.status !== 422 || problema.type !== PROBLEMA + "destino-prohibido") fallas.push(`${url}: ${r.status}`);
  }
  // Y la otra dirección: 6to4 con una IPv4 pública adentro (8.8.8.8) sí se acepta. Sin esto, una lista que
  // rechazara todo pasaría la comprobación.
  const publica = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ },
    cuerpo: JSON.stringify({ nombre: "rango-publico", url: "http://[2002:808:808::1]/" }) });
  await publica.text();
  if (publica.status !== 201) fallas.push(`http://[2002:808:808::1]/: ${publica.status}, se esperaba 201`);
  return ["SSRF: 12 direcciones de uso especial (CGNAT, NAT64, 6to4, compatible, 64:ff9b:1::/48, 240/4, 198.18/15, TEST-NET, 2001:db8::, Teredo, multicast): 422; 6to4 con IPv4 pública: 201", fallas];
}

// Corre un programa del curso y devuelve su salida completa y su código de salida.
function correr(archivo: string, argumentos: string[], topeMs = 120000): Promise<{ salida: string; codigo: number | null }> {
  return new Promise((listo) => {
    const hijo = spawn(process.execPath, [archivo, ...argumentos], { cwd: import.meta.dirname });
    // Un programa que se queda esperando para siempre no cuelga la matriz: se corta y su código queda en null.
    const corte = setTimeout(() => hijo.kill(), topeMs);
    hijo.on("close", () => clearTimeout(corte));
    let salida = "";
    hijo.stdout.on("data", (trozo: Buffer) => { salida += trozo.toString(); });
    hijo.stderr.on("data", (trozo: Buffer) => { salida += trozo.toString(); });
    hijo.on("close", (codigo) => listo({ salida, codigo }));
  });
}

// La pasarela y alta-segura.ts cuando no hay quien responda (lección 6). Apaga el revisor que levantó
// esta matriz, prueba, y lo vuelve a levantar.
async function sinRevisorNiPasarela(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  // 0. Con el revisor vivo, la pasarela reenvía Content-Length (y los mismos bytes) en una respuesta que no pierde.
  const primera = await arrancar("pasarela.ts", 18082);
  const ok = await fetch("http://127.0.0.1:18082/servicios", { method: "POST", headers: { ...ESCRIBE, ...JSON_ }, body: alta("con-largo") });
  const cuerpoOk = await ok.text();
  if (ok.status !== 201 || ok.headers.get("content-length") !== String(Buffer.byteLength(cuerpoOk))) {
    fallas.push(`pasarela con revisor: ${ok.status}, Content-Length ${ok.headers.get("content-length")} de ${Buffer.byteLength(cuerpoOk)} bytes`);
  }
  const apagadaPrimera = new Promise((listo) => primera.once("exit", listo));
  primera.kill();
  await apagadaPrimera;
  const viejo = procesos[1];
  const salida = new Promise((listo) => viejo.once("exit", listo));
  viejo.kill();
  await salida;
  const pasarela = await arrancar("pasarela.ts", 18082);
  // 1. La pasarela no se cae: 502 Problem Details, y sigue escuchando.
  const r = await fetch("http://127.0.0.1:18082/servicios", { method: "POST", headers: { ...ESCRIBE, ...JSON_ }, body: alta("sin-revisor") })
    .then(async (x) => ({ status: x.status, tipo: x.headers.get("content-type") }), () => ({ status: 0, tipo: null }));
  if (r.status !== 502 || r.tipo !== "application/problem+json") fallas.push(`pasarela sin revisor: ${r.status} ${r.tipo}`);
  await esperar(200);
  const pasarelaViva = pasarela.exitCode === null && pasarela.signalCode === null;
  if (!pasarelaViva) fallas.push("la pasarela se cayó");
  // 2. Cuatro 502: termina con mensaje y sin esperar después del último intento.
  const con502 = await correr("alta-segura.ts", ["sin-revisor", `${LAB}/codigo/200`]);
  const despues = con502.salida.split("intento 4:")[1] ?? "";
  if (despues.includes("espero")) fallas.push("después del intento 4 todavía espera");
  if (!con502.salida.includes("se agotaron los 4 intentos") || con502.codigo !== 1) fallas.push(`con 502: salida ${con502.codigo}`);
  // Si se cayó, ya no hay a quién esperar.
  if (pasarela.exitCode === null && pasarela.signalCode === null) {
    const apagada = new Promise((listo) => pasarela.once("exit", listo));
    pasarela.kill();
    await apagada;
  }
  // 3. Sin pasarela: reintenta los cuatro intentos y termina sin la pila de Node.
  const rechazada = await correr("alta-segura.ts", ["sin-pasarela", `${LAB}/codigo/200`]);
  const sinRespuesta = rechazada.salida.match(/sin respuesta \(ECONNREFUSED\)/g)?.length ?? 0;
  if (sinRespuesta !== 4) fallas.push(`conexión rechazada: ${sinRespuesta} intentos sin respuesta, se esperaban 4`);
  if (/TypeError|node:internal|triggerUncaughtException/.test(rechazada.salida)) fallas.push("conexión rechazada: imprime la pila de Node");
  procesos[1] = await arrancar("servidor.ts", 18080);
  return ["la pasarela reenvía Content-Length; sin revisor responde 502 y sigue viva; alta-segura termina al agotar los intentos, también sin conexión", fallas];
}

// alta-segura.ts decide qué hacer con lo que recibe (lección 6). Un servidor de mentira en el 18082 (donde
// estaría la pasarela) responde lo que se le dice y cuenta las peticiones: un 4xx sale con 1 y no se repite,
// un Retry-After razonable se obedece y uno largo no se insiste, un servidor mudo se corta por tiempo y el 409
// de «llave en curso» no es final. Corre cuando la pasarela ya está apagada (sinRevisorNiPasarela la apagó).
type Respuesta = [number, Record<string, string>, string] | null; // null: el servidor no contesta
async function altaSeguraDecide(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const problema = (tipo: string, estado: number): string => JSON.stringify({ type: PROBLEMA + tipo, title: tipo, status: estado });
  async function caso(nombre: string, respuestas: Respuesta[], argumentos: string[], limiteMs?: number) {
    let peticiones = 0;
    const servidor = createServer((peticion, respuesta) => {
      peticion.resume();
      const que = respuestas[Math.min(peticiones++, respuestas.length - 1)];
      if (que === null) return; // se queda callado
      respuesta.writeHead(que[0], { "Content-Type": "application/problem+json", ...que[1] });
      respuesta.end(que[2] + "\n");
    });
    await new Promise<void>((listo) => servidor.listen(18082, "127.0.0.1", listo));
    if (limiteMs !== undefined) process.env.ALTA_LIMITE_MS = String(limiteMs);
    const inicio = Date.now();
    const corrida = await correr("alta-segura.ts", [nombre, `${LAB}/codigo/200`, ...argumentos], 20000);
    const ms = Date.now() - inicio;
    delete process.env.ALTA_LIMITE_MS;
    servidor.closeAllConnections();
    await new Promise((listo) => servidor.close(listo));
    return { ...corrida, ms, peticiones };
  }
  // 1. Un 4xx final: sale con 1, lo dice y no repite.
  const rechazo = await caso("rechazada", [[422, {}, problema("datos-invalidos", 422)]], []);
  if (rechazo.codigo !== 1 || rechazo.peticiones !== 1 || !rechazo.salida.includes("respondió 422")) {
    fallas.push(`4xx: salida ${rechazo.codigo}, ${rechazo.peticiones} peticiones`);
  }
  // 2. Retry-After largo: no insiste, y no espera.
  const largo = await caso("larga", [[503, { "Retry-After": "120" }, problema("en-mantenimiento", 503)]], []);
  if (largo.codigo !== 1 || largo.peticiones !== 1 || largo.ms > 3000 || !largo.salida.includes("no se reintenta")) {
    fallas.push(`Retry-After de 120 s: salida ${largo.codigo}, ${largo.peticiones} peticiones, ${largo.ms} ms`);
  }
  // 3. Retry-After razonable: espera lo que se pidió y el segundo intento pasa.
  const corto = await caso("corta", [[503, { "Retry-After": "1" }, problema("en-mantenimiento", 503)], [201, { "Content-Type": "application/json" }, "{}"]], []);
  if (corto.codigo !== 0 || corto.peticiones !== 2 || corto.ms < 1000) {
    fallas.push(`Retry-After de 1 s: salida ${corto.codigo}, ${corto.peticiones} peticiones, ${corto.ms} ms`);
  }
  // 4. Un servidor mudo: cada intento se corta por tiempo y el programa termina con 1.
  const mudo = await caso("muda", [null], [], 200);
  const cortes = mudo.salida.match(/tiempo agotado: 200 ms/g)?.length ?? 0;
  if (mudo.codigo !== 1 || cortes !== 4 || mudo.peticiones !== 4) {
    fallas.push(`servidor mudo: salida ${mudo.codigo}, ${cortes} cortes, ${mudo.peticiones} peticiones`);
  }
  // 5. El 409 de «llave en curso» se reintenta; el de «nombre repetido» no.
  const enCurso = await caso("encurso", [[409, {}, problema("llave-en-curso", 409)], [201, { "Content-Type": "application/json" }, "{}"]], []);
  if (enCurso.codigo !== 0 || enCurso.peticiones !== 2) fallas.push(`409 llave-en-curso: salida ${enCurso.codigo}, ${enCurso.peticiones} peticiones`);
  const repetido = await caso("repetida", [[409, {}, problema("nombre-repetido", 409)]], []);
  if (repetido.codigo !== 1 || repetido.peticiones !== 1) fallas.push(`409 nombre-repetido: salida ${repetido.codigo}, ${repetido.peticiones} peticiones`);
  return ["alta-segura decide: un 4xx sale con 1; obedece Retry-After si es razonable y no insiste si pide mucho; se corta por tiempo ante un servidor mudo; el 409 de llave en curso se reintenta y el de nombre repetido no", fallas];
}

// RFC 9110, sección 15.3.6: un servidor no genera contenido en un 205. El banco responde sin cuerpo, con
// «Content-Length: 0» (el 205 no se enmarca solo, RFC 9112 sección 6.3) y sin «Transfer-Encoding».
async function banco205(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const r = await fetch(`${LAB}/codigo/205`);
  const cuerpo = await r.text();
  if (r.status !== 205) fallas.push(`estado ${r.status}, se esperaba 205`);
  if (cuerpo !== "") fallas.push(`cuerpo de ${Buffer.byteLength(cuerpo)} bytes`);
  if (r.headers.get("transfer-encoding") !== null) fallas.push(`Transfer-Encoding: ${r.headers.get("transfer-encoding")}`);
  if (r.headers.get("content-length") !== "0") fallas.push(`Content-Length: ${r.headers.get("content-length")}`);
  return ["el banco responde el 205 sin cuerpo, con Content-Length: 0 y sin Transfer-Encoding", fallas];
}

// RFC 9110, sección 8.8.1: tras reiniciar el revisor, la etiqueta vieja no coincide aunque el id y la
// versión sean los mismos (el servicio 3 nunca cambia). Reinicia el revisor que levantó esta matriz.
async function etiquetaTrasReinicio(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const B = { Authorization: "Bearer escritura-b" };
  const antes = (await enviar({ metodo: "GET", ruta: "/servicios/3", cabeceras: B })).headers.get("etag") ?? "";
  const viejo = procesos[1];
  const salida = new Promise((listo) => viejo.once("exit", listo));
  viejo.kill();
  await salida;
  procesos[1] = await arrancar("servidor.ts", 18080);
  const r = await enviar({ metodo: "GET", ruta: "/servicios/3", cabeceras: { ...B, "If-None-Match": antes } });
  await r.text();
  const despues = r.headers.get("etag");
  if (r.status !== 200) fallas.push(`If-None-Match: ${antes} tras reiniciar dio ${r.status}, se esperaba 200`);
  if (despues === antes) fallas.push(`la etiqueta se repitió: ${antes}`);
  return ["ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)", fallas];
}

// RFC 9110, secciones 13.1.1, 13.1.2 y 8.8.3.2. Lee la etiqueta vigente del servicio 1 y la usa.
async function condicionales(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const vigente = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE })).headers.get("etag") ?? "";
  const otra = vigente.replace(/"$/, '9"');
  const leer = async (condicion: string, esperado: number): Promise<void> => {
    const r = await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: { ...LEE, "If-None-Match": condicion } });
    await r.text();
    if (r.status !== esperado) fallas.push(`If-None-Match: ${condicion} dio ${r.status}, se esperaba ${esperado}`);
  };
  await leer(`W/${vigente}`, 304);
  await leer(`"9-9", ${vigente}`, 304);
  await leer("*", 304);
  await leer(`"9-9", W/${otra}`, 200);
  const cambiar = async (condicion: string, esperado: number): Promise<void> => {
    const r = await enviar({ metodo: "PUT", ruta: "/servicios/1", cabeceras: { ...ESCRIBE, ...JSON_, "If-Match": condicion }, cuerpo: alta("catalogo") });
    await r.text();
    if (r.status !== esperado) fallas.push(`If-Match: ${condicion} dio ${r.status}, se esperaba ${esperado}`);
  };
  await cambiar(`W/${vigente}`, 412);
  await cambiar(`"9-9", ${vigente}`, 200);
  await cambiar("*", 200);
  return ["If-None-Match con lista, W/ y * (débil): 304; If-Match con W/: 412; con lista o *: 200", fallas];
}

// La actualización perdida con dos PUT a la vez y la misma If-Match. La lenta manda su cuerpo después
// de que la rápida ya cambió el servicio; el revisor compara la versión otra vez al escribir, así que la
// lenta recibe 412 y el servicio queda como lo dejó la rápida.
async function actualizacionPerdida(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const vigente = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: ESCRIBE })).headers.get("etag") ?? "";
  const cabeceras = { ...ESCRIBE, ...JSON_, "If-Match": vigente };
  let soltar = (): void => {};
  const suelto = new Promise<void>((listo) => { soltar = listo; });
  // El primer pedazo sale enseguida (fetch no manda las cabeceras hasta tener algo del cuerpo); el resto,
  // hasta que la rápida terminó.
  const texto = JSON.stringify({ nombre: "catalogo", url: `${LAB}/codigo/200`, limite_ms: 1000 });
  const codificar = (pedazo: string): Uint8Array => new TextEncoder().encode(pedazo);
  const cuerpo = new ReadableStream<Uint8Array>({
    async start(control) {
      control.enqueue(codificar(texto.slice(0, 10)));
      await suelto;
      control.enqueue(codificar(texto.slice(10)));
      control.close();
    },
  });
  const lenta = fetch(R + "/servicios/1", { method: "PUT", headers: cabeceras, body: cuerpo, duplex: "half" } as RequestInit);
  await esperar(300);
  const rapida = await enviar({ metodo: "PUT", ruta: "/servicios/1", cabeceras,
    cuerpo: JSON.stringify({ nombre: "catalogo", url: `${LAB}/codigo/200`, limite_ms: 3000 }) });
  await rapida.text();
  soltar();
  const respuestaLenta = await lenta;
  await respuestaLenta.text();
  const final = (await (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: ESCRIBE })).json()) as { limite_ms?: number };
  if (rapida.status !== 200) fallas.push(`la rápida dio ${rapida.status}, se esperaba 200`);
  if (respuestaLenta.status !== 412) fallas.push(`la lenta dio ${respuestaLenta.status}, se esperaba 412`);
  if (final.limite_ms !== 3000) fallas.push(`el servicio quedó con limite_ms ${final.limite_ms}, se esperaba 3000 (el de la rápida)`);
  return ["actualización perdida: dos PUT a la vez con la misma If-Match: 200 y 412, gana la primera que escribe", fallas];
}

// El orden del PUT (RFC 9110, sección 13.2.1): 415 antes que If-Match. Y si otro retira el servicio
// mientras el PUT espera su cuerpo, 410 y no 412.
async function ordenDelPut(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const texto = { ...ESCRIBE, "Content-Type": "text/plain" };
  for (const condicion of ['"1-0-0"', undefined]) {
    const cabeceras: Record<string, string> = condicion === undefined ? texto : { ...texto, "If-Match": condicion };
    const r = await enviar({ metodo: "PUT", ruta: "/servicios/1", cabeceras, cuerpo: "catalogo" });
    await r.text();
    if (r.status !== 415) fallas.push(`text/plain ${condicion === undefined ? "sin If-Match" : "con etiqueta vieja"}: ${r.status}, se esperaba 415`);
  }
  const alta = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ },
    cuerpo: JSON.stringify({ nombre: "efimero", url: `${LAB}/codigo/200` }) });
  await alta.text();
  const ruta = alta.headers.get("location") ?? "/servicios/0";
  const etiquetaLeida = alta.headers.get("etag") ?? "";
  const datos = JSON.stringify({ nombre: "efimero", url: `${LAB}/codigo/200` });
  let soltar = (): void => {};
  const suelto = new Promise<void>((listo) => { soltar = listo; });
  const cuerpo = new ReadableStream<Uint8Array>({
    async start(control) {
      control.enqueue(new TextEncoder().encode(datos.slice(0, 10)));
      await suelto;
      control.enqueue(new TextEncoder().encode(datos.slice(10)));
      control.close();
    },
  });
  const lento = fetch(R + ruta, { method: "PUT", headers: { ...ESCRIBE, ...JSON_, "If-Match": etiquetaLeida }, body: cuerpo, duplex: "half" } as RequestInit);
  await esperar(300);
  const retiro = await enviar({ metodo: "DELETE", ruta, cabeceras: ESCRIBE });
  await retiro.text();
  soltar();
  const respuestaLenta = await lento;
  const problema = (await respuestaLenta.json()) as { type?: string };
  if (retiro.status !== 204) fallas.push(`el retiro dio ${retiro.status}`);
  if (respuestaLenta.status !== 410 || problema.type !== PROBLEMA + "servicio-retirado") {
    fallas.push(`el PUT lento dio ${respuestaLenta.status} ${problema.type}, se esperaba 410 servicio-retirado`);
  }
  return ["orden del PUT: text/plain da 415 con etiqueta vieja o sin ella; retirado en el hueco, 410", fallas];
}

// RFC 9110, sección 11.1, y RFC 6750, sección 3.1.
async function esquemas(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  for (const valor of ["bearer lectura-a", "BEARER lectura-a"]) {
    const r = await enviar({ metodo: "GET", ruta: "/servicios", cabeceras: { Authorization: valor } });
    await r.text();
    if (r.status !== 200) fallas.push(`${valor}: ${r.status}, se esperaba 200`);
  }
  const retos: [string, string][] = [
    ["Basic bGVjdHVyYS1hOg==", 'Bearer realm="revisor"'],
    ["Bearer inventada", 'Bearer realm="revisor", error="invalid_token"'],
  ];
  for (const [valor, esperado] of retos) {
    const r = await enviar({ metodo: "GET", ruta: "/servicios", cabeceras: { Authorization: valor } });
    await r.text();
    const reto = r.headers.get("www-authenticate");
    if (r.status !== 401 || reto !== esperado) fallas.push(`${valor}: ${r.status} con ${reto}, se esperaba 401 con ${esperado}`);
  }
  return ["esquema sin distinguir mayúsculas (bearer: 200); Basic: reto sin error=\"invalid_token\"", fallas];
}

// Node responde 400 a un método que no conoce antes de llamar al revisor, así que esto no se puede
// provocar por la red: se llama a atender() directo, con una petición y una respuesta de mentira.
async function metodoHeredado(): Promise<[string, string[]]> {
  const { atender } = await import("./rutas.ts");
  const fallas: string[] = [];
  // rutas.ts escribe cada petición en la terminal del revisor; aquí correría dentro de la matriz.
  const registrar = console.log;
  console.log = () => {};
  for (const method of ["constructor", "toString", "__proto__"]) {
    const peticion = { method, url: "/servicios/1", headers: { authorization: "Bearer escritura-a" } };
    const codigo = await new Promise<string>((listo) => {
      const respuesta = {
        req: peticion,
        statusCode: 0,
        writeHead(codigo: number) { this.statusCode = codigo; return this; },
        end() { listo(String(this.statusCode)); },
      };
      atender(peticion as unknown as IncomingMessage, respuesta as unknown as ServerResponse)
        .catch((error: unknown) => listo(`excepción ${String(error)}`));
    });
    if (codigo !== "405") fallas.push(`${method}: ${codigo}`);
  }
  console.log = registrar;
  return ["método heredado de Object.prototype (constructor, toString, __proto__): 405", fallas];
}

// Si algo ya escucha en los puertos del curso, la corrida mediría a otro programa (o esperaría para siempre a un
// hijo que no pudo arrancar): se detiene en seguida.
for (const puerto of [18080, 18081, 18082]) {
  if (await aceptaConexiones(puerto)) {
    console.error(`puerto ${puerto} ocupado; apaga lo que lo usa`);
    process.exit(2);
  }
}

const procesos: ChildProcess[] = [
  spawn(process.execPath, ["laboratorio.ts"], { cwd: import.meta.dirname, stdio: "ignore" }),
  spawn(process.execPath, ["servidor.ts"], { cwd: import.meta.dirname, stdio: "ignore" }),
];
let fallidos = 0;
let extra = 0;
let abortada = false;
try {
  await esperarPuerto(18081, procesos[0]);
  await esperarPuerto(18080, procesos[1]);
  SIN_CAMBIOS["If-None-Match"] = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE })).headers.get("etag") ?? "";
  for (const escenario of ESCENARIOS) {
    const fallas = await comprobar(escenario);
    if (fallas.length > 0) fallidos++;
    console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${escenario.codigo} ${escenario.nombre}${fallas.length > 0 ? ": " + fallas.join("; ") : ""}`);
  }
  const resultados = await adicionales();
  extra = resultados.length;
  for (const [nombre, fallas] of resultados) {
    if (fallas.length > 0) fallidos++;
    console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${nombre}${fallas.length > 0 ? ": " + fallas.join("; ") : ""}`);
  }
} catch (error) {
  // Un proceso no arrancó (o no contestó a tiempo): no hay resumen que dar, y se dice por qué.
  console.error(`no se pudo correr la matriz: ${error instanceof Error ? error.message : String(error)}`);
  abortada = true;
} finally {
  for (const proceso of procesos) proceso.kill();
}
if (abortada) process.exit(1);
const total = ESCENARIOS.length + extra;
console.log(`\n${total - fallidos} de ${total} comprobaciones pasaron (${ESCENARIOS.length} escenarios de código y ${extra} adicionales).`);
process.exitCode = fallidos === 0 ? 0 : 1;

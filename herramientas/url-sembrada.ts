// url-sembrada.ts — prueba que el revisor de una carpeta no repite los secretos de una URL.
// Uso: node herramientas/url-sembrada.ts <carpeta-del-revisor> <lección (1 a 8)>
//
// Siembra la URL «http://usuario:clave@127.0.0.1:1/estado?token=SECRETO#x» y exige:
//   (a) que el alta (y, desde la lección 3, el cambio) la rechace: 400 en las lecciones 1 y 2, 422 desde la 3;
//   (b) que ninguna respuesta (cuerpo ni cabeceras) ni la terminal del revisor repita usuario, clave,
//       consulta ni fragmento.
// El revisor arranca con REVISOR_DESTINOS=127.0.0.1:1 para que la defensa contra SSRF no tape el defecto:
// con la configuración de fábrica, 127.0.0.1:1 se rechaza por otra razón y la prueba no vería nada.
// Control positivo: el alta de la misma URL SIN secretos responde 201 y su cuerpo sí trae «/estado»;
// sin él, una prueba que nunca leyera los cuerpos pasaría.
import { spawn } from "node:child_process";
import { setTimeout as esperar } from "node:timers/promises";

const [carpeta, textoLeccion] = process.argv.slice(2);
const leccion = Number(textoLeccion);
if (carpeta === undefined || !(leccion >= 1 && leccion <= 8)) {
  console.error("uso: node herramientas/url-sembrada.ts <carpeta-del-revisor> <lección (1 a 8)>");
  process.exit(2);
}

const BASE = "http://127.0.0.1:18080";
const SEMBRADA = "http://usuario:clave@127.0.0.1:1/estado?token=SECRETO#x";
const VARIANTES = [
  SEMBRADA,
  "http://usuario@127.0.0.1:1/estado", // solo usuario
  "http://:clave@127.0.0.1:1/estado", // solo clave
  "http://127.0.0.1:1/estado?token=SECRETO", // solo consulta
  "http://127.0.0.1:1/estado#x", // solo fragmento
];
// Lo que no puede aparecer en ninguna respuesta ni en la terminal.
const SECRETOS = ["usuario:clave", "usuario@", ":clave@", "SECRETO", "token=", "#x"];
const RECHAZO = leccion <= 2 ? 400 : 422;
const CREDENCIAL = { Authorization: "Bearer escritura-a" }; // la lección 1 no la lee; desde la 2, escritor del equipo a

const fallas: string[] = [];
const vistos: string[] = []; // todo lo que respondió el revisor, para buscar los secretos al final
let comprobaciones = 0;

function comprobar(condicion: boolean, falla: string): void {
  comprobaciones++;
  if (!condicion) fallas.push(falla);
}

async function pedir(metodo: string, ruta: string, cuerpo?: object, cabeceras: Record<string, string> = {}) {
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    headers: { ...CREDENCIAL, "Content-Type": "application/json", ...cabeceras },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  vistos.push(`${metodo} ${ruta} → ${respuesta.status} ${JSON.stringify([...respuesta.headers])} ${texto}`);
  return { codigo: respuesta.status, texto, etag: respuesta.headers.get("etag") };
}

const revisor = spawn(process.execPath, ["servidor.ts"], {
  cwd: carpeta,
  env: { ...process.env, REVISOR_DESTINOS: "127.0.0.1:1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let terminal = "";
revisor.stdout.on("data", (d: Buffer) => (terminal += d.toString()));
revisor.stderr.on("data", (d: Buffer) => (terminal += d.toString()));

try {
  let listo = false;
  for (let i = 0; i < 100 && !listo; i++) {
    await esperar(100);
    listo = terminal.includes("revisor en");
  }
  if (!listo) throw new Error(`el revisor de ${carpeta} no arrancó en 10 s: ${terminal}`);

  // (a) El alta con secretos se rechaza, con cada variante.
  for (const [i, url] of VARIANTES.entries()) {
    const alta = await pedir("POST", "/servicios", { nombre: `fuga${i}`, url });
    comprobar(alta.codigo === RECHAZO, `alta con ${url}: ${alta.codigo}, se esperaba ${RECHAZO}`);
  }

  // Control positivo: la misma URL sin secretos sí se da de alta, y su representación la trae.
  const limpia = await pedir("POST", "/servicios", { nombre: "limpia", url: "http://127.0.0.1:1/estado" });
  comprobar(limpia.codigo === 201, `alta sin secretos: ${limpia.codigo}, se esperaba 201 (control positivo)`);
  comprobar(limpia.texto.includes("/estado"), "el cuerpo del 201 no trae la url: la búsqueda no ve los cuerpos");
  const id = (JSON.parse(limpia.texto) as { id?: number }).id;

  // (b) Las representaciones: consulta, lista y, desde la 3, la v1.
  await pedir("GET", `/servicios/${id}`);
  await pedir("GET", "/servicios");
  if (leccion >= 3) await pedir("GET", `/v1/servicios/${id}`);

  // Desde la 3 existe el cambio (PUT): también lo rechaza, con la etiqueta vigente.
  if (leccion >= 3 && limpia.etag !== null) {
    const cambio = await pedir("PUT", `/servicios/${id}`, { nombre: "limpia", url: SEMBRADA }, { "If-Match": limpia.etag });
    comprobar(cambio.codigo === 422, `cambio con la URL sembrada: ${cambio.codigo}, se esperaba 422`);
    const despues = await pedir("GET", `/servicios/${id}`);
    comprobar(!despues.texto.includes("SECRETO"), "el cambio rechazado igual guardó la URL sembrada");
  }

  for (const secreto of SECRETOS) {
    const respuesta = vistos.find((v) => v.includes(secreto));
    comprobar(respuesta === undefined, `una respuesta repite «${secreto}»: ${respuesta}`);
    comprobar(!terminal.includes(secreto), `la terminal del revisor repite «${secreto}»`);
  }
} catch (error) {
  fallas.push(error instanceof Error ? error.message : String(error));
} finally {
  revisor.kill();
}

for (const falla of fallas) console.log(`FALLA ${carpeta}: ${falla}`);
console.log(`${carpeta}: ${comprobaciones - fallas.length} de ${comprobaciones} comprobaciones`);
process.exitCode = fallas.length === 0 && comprobaciones > 0 ? 0 : 1;

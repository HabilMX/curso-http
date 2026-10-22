# Lesson 1 — Successes and redirections: 200, 201, 202, 204, 301, 308, and 304

It is 11:20 AM on a Tuesday, and at 12:00 PM there is a review with the operations team. The question they are going to ask is simple: why did the `revisor` not monitor the billing service over the weekend, if someone registered it on Friday? The person who registered it swears they did. They have the screenshot from their terminal: they submitted the registration and received a `200 OK`. You open the `revisor`'s list of services and billing is not there. You open the server log and there is their request, complete, at 6:42 PM on Friday. Except the log does not say `POST /servicios`. It says `POST /viejo/servicios` and, right below it, `GET /servicios`. On Thursday someone moved the old routes with a redirect. Their program followed it, as it was supposed to. And along the way, without a single error, the registration turned into an inquiry. There are forty minutes left to explain why a `200` did not mean what everyone thought.

This lesson is about responses that say "it worked" and those that say "it's somewhere else": what each one promises, what headers accompany it, and which of them can drop a `POST` without warning.

**Time:** 2 × 45 min (the split is between sections 1.5 and 1.6)

**What you build:** the first version of the **`revisor`** as a server: the routes that register, query, and withdraw services, the one that requests a check and the one that allows tracking it, the legacy routes that redirect, and the first defense against someone using the `revisor` to reach where they should not. In addition, the **lab**: the test bench from Lesson 0 on port 18081, with the services the `revisor` queries

**What you learn:** choosing between returning (`200`), creating (`201`), accepting (`202`), and returning nothing (`204`); what `Location` is used for in a `201`, in a `202`, and in a redirect; **the `202` and its tracking resource**; what changes between `301` and `308` when the request is a `POST`; conditional requests with `ETag` and `If-None-Match`, and why a `304` carries no body. And in a security callout, what **SSRF** is and why a program like the `revisor` is the classic case

**Where you are coming from.** From [Lesson 0](00-el-contrato-que-viaja.md) you bring Node 24 and the `~/curso-http/` folder, the instrument (`curl -i`, `curl -v`, `curl -I`), the five families and the `x00` rule, and the test bench `fig00_02.ts`, which responds with whichever code you ask for at `/codigo/NNN`. You also bring the course's first criterion: the code rules and the body explains. There is no `revisor` yet: it is born in this lesson.

**What this lesson does not do.** It does not ask for credentials: anyone who can reach the port can register and remove services, and [Lesson 2](02-errores-del-cliente-peticion.md) adds the entry-point checks. Nor does it allow changing an already registered service; that requires `If-Match` and is the topic of [Lesson 3](03-errores-del-cliente-estado.md). The errors you will see here, a `400`, a `404`, and a `413`, are a **safety net**: they exist so the `revisor` does not respond `200` when something goes wrong, but they are explained in depth in Lesson 2, and their body is a single line of text until [Lesson 5](05-problem-details.md) formats it. And there is an intentional defect: a method that the route does not allow returns `404` instead of `405`; the "The error you will see" section points it out and Lesson 2 fixes it.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS with Node 24.14.1 and curl 8.7.1, adding `-sS` to each `curl` because the output was redirected to a file (`-s` silences the progress meter, `-S` shows errors, and neither changes the response). **A warning about ports:** while writing this lesson, other tests were occupying ports 18080 and 18081 on the machine, so the runs were done with an identical copy of the programs except for the ports, 18180 and 18181, and in the outputs pasted here they were rewritten to 18080 and 18081, which are the ones you will type. That is the only substitution made; both numbers have the same number of digits, so no `Content-Length` changes. In your run, the date in `Date`, the milliseconds (`"ms"`) measured by a check, and **the `ETag` tags** will also differ: the `revisor` picks eight random hexadecimal digits at startup that go at the end of each tag (`"4-1-7b2497d9"`), so yours will end differently and change each time you restart it; section 1.8 explains why. When a command in the lesson includes a tag, copy the one from your previous response, not the one from the lesson. The runs were performed following the lesson from beginning to end, in order, with restarts where the lesson calls for them, so the service and check numbers you see are the ones that will appear for you. It was not run on a Mint desktop installation. The programs are in [`programas/01-exitos-redirecciones/`](../programas/01-exitos-redirecciones), in the course repository: the `revisor` in the `fig01_01/` folder and each run in a `.salida.txt` file. All pass `tsc` in strict mode (section 1.11 explains how to verify it).

## By the end you will be able to

- Spin up the `revisor` and its lab, and trace the complete lifecycle of a service with `curl -i`: registration, query, check, withdrawal.
- Choose between `200`, `201`, `202`, and `204` for an operation using three questions, and justify the choice with the section of RFC 9110 that defines it.
- State what `Location` identifies in a `201`, in a `202`, and in a redirect, and verify it in a real response.
- Follow an operation accepted with `202` until it finishes, respecting `Retry-After`, without hammering the server.
- Trigger a `304` with `If-None-Match`, explain why it carries no body and which headers it must carry.
- Demonstrate with `curl -L` that a `301` can convert a `POST` into a `GET` without any error, and that a `308` does not.
- Explain what SSRF is, why the `revisor` carries it by design, and what defenses it has, including the one that arrives in Lesson 8.

## The why before the how

In Lesson 0 you saw that the status code is what all programs along the path read. In error responses, that contract is broken in a way that hurts immediately: a `200` with an error inside tricks the cache and the monitor. In success responses, the damage is quieter, because all of them say "it worked," and the temptation is to respond `200` whenever nothing has failed. But the four successes in this lesson do not say the same thing, and whoever receives the response does different things with each one:

- A **`200`** says "here is what you asked for." The client uses the body.
- A **`201`** says "I created something new, and it lives at this address." The client saves the `Location` address to return to that resource.
- A **`202`** says "I received it, but I haven't done it yet." The client **cannot** consider the operation finished: it has to ask again.
- A **`204`** says "done, and I have nothing to tell you." The client expects no body.

The difference between `201` and `202` is the most expensive to confuse. If the `revisor` responded `200` or `201` to a check that is barely about to start, the client would believe the check was already finished and read a result that does not exist. If it responded `200` to a registration, the client would have no standard way of knowing where the new service ended up.

Redirects have their own trap, which is the one from the opening scene. Moving a route is normal: APIs grow and names change. But there are two codes for "this moved permanently," `301` and `308`, and for historical reasons only one of them promises that a `POST` will remain a `POST` on the other side. With the other, the client has permission to convert it into a `GET`, and almost all of them do. The registration is lost, the final response is a `200` with the list, and nobody sees an error because there wasn't one.

And `304` closes the lesson with the opposite idea of `200`: sometimes the best response is **not sending anything**, because the client already has it. That is why entity tags (`ETag`) and conditional requests exist, which in Lesson 3 will also serve a much more serious purpose: preventing two people from stepping on each other when updating the same service.

The lesson has five parts:

1. **The `revisor` takes shape** (1.1 to 1.3): the files, the store, the three ways of responding, and the routing table.
2. **Returning and creating** (1.4 and 1.5): `200` and `201`, with `Location` and `ETag`.
3. **Accepting and returning nothing** (1.6 and 1.7): `202` with its tracking resource, and `204`.
4. **Not sending what you already have, and moving** (1.8 and 1.9): `304` with `If-None-Match`, and `301` versus `308`.
5. **The security callout** (1.10): SSRF, the lab exception, and the declared limit.

At the end of the lesson, this run will seem obvious to you. These are two identical requests except for the legacy route they use; the `revisor` logged this in its terminal:

```text
POST /viejo/servicios
GET /servicios
POST /api/servicios
POST /servicios
```

The first registration was lost. The second took place. The only thing that changed was the redirect code.

## The concepts

### 1.1 The `revisor` takes shape

#### 1.1.1 Nine files and a folder

From this lesson onward, the `revisor` stops being a single-file program. It is a multi-file program, each with a single responsibility, and it grows from lesson to lesson: Lesson 2 adds the entry-point checks, Lesson 3 service modification, Lesson 4 protection against failures, and so on up to Lesson 8. Today's nine files are:

| File | What it does |
|---|---|
| `servidor.ts` | starts the server on port 18080 |
| `rutas.ts` | decides which function handles each route and each method; this is where redirects live |
| `servicios.ts` | what each route does: list, register, query, withdraw, request, and track a check |
| `almacen.ts` | the services and checks, in memory, and each service's entity tag (`ETag`) |
| `etiquetas.ts` | read and compare entity tags as required by RFC 9110; used by section 1.8 |
| `respuestas.ts` | the three ways to respond: with JSON, with no body, and with an error |
| `cliente.ts` | the client side: queries a service and classifies what it responded |
| `destinos.ts` | where the `revisor` can connect; topic of the security callout |
| `laboratorio.ts` | the test bench from Lesson 0 on port 18081: the services the `revisor` queries |

In the repository they are in the `fig01_01/` folder, and each code block in this lesson starts with the file path (`// fig01_01/servidor.ts`), just like in Hábil's TypeScript course. You can save them wherever you like; here we assume a `~/curso-http/revisor/` folder with its own `package.json`, the same one from Lesson 0:

```bash
mkdir -p ~/curso-http/revisor && cd ~/curso-http/revisor
printf '{\n  "type": "module"\n}\n' > package.json
```

The files import each other with the full `.ts` extension written out (`import { atender } from "./rutas.ts"`). That is what Node requires when executing TypeScript by stripping types: it does not guess extensions, just as it does not guess them for JavaScript in an ESM module.

#### 1.1.2 The server

```ts
// fig01_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fallar } from "./respuestas.ts";
import { atender } from "./rutas.ts";

const PUERTO = 18080;

// Red de seguridad: un error que se escape de un manejador no debe tumbar el proceso. Sin este catch,
// la promesa rechazada no la espera nadie y Node termina el revisor para todos. Se responde 500 sin
// pila y el mensaje queda en la terminal. La lección 4 explica el 500 y le agrega una referencia.
async function atenderSinCaerse(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    console.error(`error en ${peticion.method} ${peticion.url}: ${error instanceof Error ? error.message : String(error)}`);
    if (!respuesta.headersSent) fallar(respuesta, 500, "error interno");
    else respuesta.destroy();
  }
}

createServer((peticion, respuesta) => void atenderSinCaerse(peticion, respuesta)).listen(PUERTO, "127.0.0.1", () => {
  console.log(`revisor en http://127.0.0.1:${PUERTO}`);
});
```

It is almost the server from Lesson 0, with one difference: it no longer makes any decisions. It receives each request and forwards it to `atender`, which lives in `rutas.ts`, through `atenderSinCaerse`. The `void` before the call says "I know this function returns a promise and I deliberately do not await it here": the server has nothing to do when the response completes.

That `void` has a cost, and `atenderSinCaerse` exists to pay it. A promise that no one awaits and that rejects is an **unhandled rejected promise**, and Node, by default, terminates the process when it encounters one. If a handler had a bug that threw an exception, a single request would shut down the `revisor` for everyone. `atenderSinCaerse` wraps `atender` in a `try`/`catch`: if anything escapes, it logs the message to the terminal, responds `500 error interno` without giving details, and the process stays alive. It is a safety net, not a design: [Lesson 4](04-capacidad-y-fallas-del-servidor.md) explains `500` in depth and what is said and not said in it. Today it is enough to know it is there, and in 1.5.2 you will see the request that would have taken down the `revisor` if no one stopped it first.

#### 1.1.3 The lab

The `revisor` monitors services, and to practice you need services to monitor. The lab is the test bench from Lesson 0 without fundamental changes: the same table of names, the same headers per code, the same three gates. What changes is the port, 18081, so it coexists with the `revisor` on 18080, and the startup message:

```ts
// fig01_01/laboratorio.ts
// El banco de pruebas de la lección 0, en el puerto 18081: los servicios que el revisor consulta.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PUERTO = 18081;

// Los nombres salen del registro de la IANA, no de Node, que guarda algunos viejos.
const NOMBRES: Partial<Record<number, string>> = {
  200: "OK", 201: "Created", 202: "Accepted", 204: "No Content",
  301: "Moved Permanently", 302: "Found", 304: "Not Modified",
  307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
  405: "Method Not Allowed", 406: "Not Acceptable", 409: "Conflict", 410: "Gone",
  412: "Precondition Failed", 413: "Content Too Large", 415: "Unsupported Media Type",
  422: "Unprocessable Content", 428: "Precondition Required", 429: "Too Many Requests",
  500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout",
};

// Las cabeceras que cada código exige o suele llevar, con valores de ejemplo.
const CABECERAS: Partial<Record<number, Record<string, string>>> = {
  201: { Location: "/servicios/demo" },
  301: { Location: "/codigo/200" },
  302: { Location: "/codigo/200" },
  307: { Location: "/codigo/200" },
  308: { Location: "/codigo/200" },
  304: { ETag: '"v1"' },
  401: { "WWW-Authenticate": 'Bearer realm="revisor"' },
  405: { Allow: "GET, HEAD" },
  429: { "Retry-After": "30" },
  503: { "Retry-After": "120" },
};

// Los códigos finales que este banco puede producir y que no pueden llevar cuerpo:
// 204 y 304 (RFC 9112, sección 6.3) y 205 (RFC 9110, sección 15.3.6: «MUST NOT generate content»).
// Un 1xx tampoco puede llevarlo, pero este banco ya se niega a producir uno; y a un HEAD
// Node no le manda el cuerpo aunque el programa lo escriba.
const SIN_CUERPO = new Set([204, 205, 304]);

function enviar(respuesta: ServerResponse, codigo: number, explicacion: string): void {
  const nombre = NOMBRES[codigo];
  const cabeceras: Record<string, string> = { ...CABECERAS[codigo] };
  let cuerpo = "";
  if (!SIN_CUERPO.has(codigo)) {
    cuerpo = `${codigo} ${nombre ?? "(sin nombre en este banco)"}\n${explicacion}\n`;
    cabeceras["Content-Type"] = "text/plain; charset=utf-8";
    cabeceras["Content-Length"] = String(Buffer.byteLength(cuerpo));
  }
  // El 205 no se enmarca solo como el 204 y el 304 (RFC 9112, sección 6.3): sin Content-Length ni Transfer-Encoding
  // terminaría al cerrar la conexión, y Node mandaría «Transfer-Encoding: chunked» con un cuerpo vacío.
  // «Content-Length: 0» dice dónde termina sin mandar contenido.
  if (codigo === 205) cabeceras["Content-Length"] = "0";
  if (nombre === undefined) {
    respuesta.writeHead(codigo, cabeceras);
  } else {
    respuesta.writeHead(codigo, nombre, cabeceras);
  }
  respuesta.end(cuerpo);
}

function atender(peticion: IncomingMessage, respuesta: ServerResponse): void {
  console.log(`${peticion.method} ${peticion.url}`);
  if (peticion.method !== "GET" && peticion.method !== "HEAD") {
    enviar(respuesta, 405, "el banco solo atiende GET y HEAD");
    return;
  }
  const ruta = new URL(peticion.url ?? "/", "http://banco").pathname;
  const pedido = /^\/codigo\/(\d{3})$/.exec(ruta);
  if (pedido === null) {
    enviar(respuesta, 404, "la única ruta es /codigo/NNN; prueba con /codigo/503");
    return;
  }
  const codigo = Number(pedido[1]);
  if (codigo < 100) {
    enviar(respuesta, 400, "no existe un código de estado menor que 100");
  } else if (codigo < 200) {
    enviar(respuesta, 400, "un 1xx es una respuesta intermedia: no puede ser la última");
  } else if (codigo > 599) {
    enviar(respuesta, codigo, "un código mayor que 599 es inválido; el banco lo produce para que veas qué hace el cliente");
  } else {
    enviar(respuesta, codigo, `lo pediste en ${ruta}`);
  }
}

createServer(atender).listen(PUERTO, "127.0.0.1", () => {
  console.log(`laboratorio en http://127.0.0.1:${PUERTO}/codigo/NNN`);
});
```

The three initial services that the `revisor` starts with point here: `catalogo` to `/codigo/200`, `pagos` to `/codigo/503`, and `nomina` to `/codigo/200`. If you want a service to "go down," there is no need to touch anything: register one pointing to `/codigo/503`.

#### 1.1.4 Starting both

Each lesson in the course that uses the `revisor` requires two terminals with servers and a third for `curl`. In the first:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

In the second:

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Leave both open. The `revisor`'s terminal will log each request it receives (`GET /servicios`, `POST /servicios`…), and that list is just as important as what `curl` prints: in "The error you will see" section it is the only one that tells the whole truth.

Before reading the files one by one, verify that the `revisor` is already responding. If you have not written them yet, copy them from `programas/01-exitos-redirecciones/fig01_01/` in the course repository and start them; the following sections explain what produced each response. In the third terminal:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 275
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

A `200` with the list of the three startup services, their `Content-Type`, and their `Content-Length`. Nothing you did not already know from Lesson 0, except that now the list is real. Section 1.4 explains what produced it.

### 1.2 Storing and responding

#### 1.2.1 The store

```ts
// fig01_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
import { randomBytes } from "node:crypto";

export type Servicio = {
  id: number;
  nombre: string;
  url: string;
  limiteMs: number;
  equipo: string;
  version: number;
};

export type Resultado = {
  estado: "ARRIBA" | "LENTO" | "CAIDO";
  codigo: number | null;
  ms: number | null;
  detalle: string;
};

export type Revision = {
  id: number;
  servicio: number;
  estado: "pendiente" | "terminada";
  resultado: Resultado | null;
};

export type DatosServicio = { nombre: string; url: string; limiteMs: number; equipo: string };

const servicios = new Map<number, Servicio>();
const revisiones = new Map<number, Revision>();
let siguienteServicio = 1;
let siguienteRevision = 1;

export function crearServicio(datos: DatosServicio): Servicio {
  const servicio: Servicio = { id: siguienteServicio++, ...datos, version: 1 };
  servicios.set(servicio.id, servicio);
  return servicio;
}

export function buscarServicio(id: number): Servicio | undefined {
  return servicios.get(id);
}

export function listarServicios(): Servicio[] {
  return [...servicios.values()];
}

export function retirarServicio(id: number): boolean {
  return servicios.delete(id);
}

export function crearRevision(servicio: number): Revision {
  const revision: Revision = { id: siguienteRevision++, servicio, estado: "pendiente", resultado: null };
  revisiones.set(revision.id, revision);
  return revision;
}

export function buscarRevision(id: number): Revision | undefined {
  return revisiones.get(id);
}

export function terminarRevision(id: number, resultado: Resultado): void {
  const revision = revisiones.get(id);
  if (revision !== undefined) {
    revision.estado = "terminada";
    revision.resultado = resultado;
  }
}

// La etiqueta (ETag) cambia cada vez que cambia el servicio: "id-versión-arranque".
// El almacén vive en memoria: al reiniciar el revisor, los id y las versiones vuelven a empezar, y
// "4-1" podría describir otro servicio, con lo que un cliente recibiría un 304 falso (RFC 9110,
// sección 8.8.1: una etiqueta no se reutiliza para otra representación). Por eso cada arranque
// sortea un identificador propio: tras reiniciar, ninguna etiqueta vieja coincide.
const ARRANQUE = randomBytes(4).toString("hex");

export function etiqueta(servicio: Servicio): string {
  return `"${servicio.id}-${servicio.version}-${ARRANQUE}"`;
}

// Tres servicios de arranque, para que cada corrida empiece igual.
crearServicio({ nombre: "catalogo", url: "http://127.0.0.1:18081/codigo/200", limiteMs: 2000, equipo: "a" });
crearServicio({ nombre: "pagos", url: "http://127.0.0.1:18081/codigo/503", limiteMs: 2000, equipo: "a" });
crearServicio({ nombre: "nomina", url: "http://127.0.0.1:18081/codigo/200", limiteMs: 2000, equipo: "b" });
```

The store holds two things in memory, across two `Map`s: the **services** and the **checks**. Stopping the `revisor` loses everything, on purpose: each run starts with the same three initial services, so what you see in your terminal matches what the lesson describes. A service has its `id`, its `nombre` (name), the `url` that is checked, the `limiteMs` (how long to wait for a response before considering it down), the `equipo` (team) it belongs to, which Lesson 2 will use to decide who sees what, and a `version`.

The `version` is the component that makes section 1.8 work. The `etiqueta` function builds a quoted string with three parts, `"4-1-7b2497d9"`: the `id`, the `version`, and a **startup identifier**. That string is the service's **entity tag** (the `ETag`). Today no service changes, so the version is always 1; in Lesson 3, each change increments it and the entity tag changes with it. The quotes are not decorative: [RFC 9110, section 8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3), defines the entity tag as an **opaque string enclosed in double quotes**, and states that to the client it is opaque: it does not need to know how it was constructed, only compare it. [Section 8.8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.1) gives as an example exactly what the `revisor` does: using an internal revision number.

And the startup identifier? It is 4 random bytes (`randomBytes(4)`, eight hexadecimal digits) that `almacen.ts` draws once, at startup. They exist because of a rule in [RFC 9110, section 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1): a strong entity tag is unique across all versions of all representations of a resource **over time**. The store lives in memory, and restarting the `revisor` resets `id`s and versions to the beginning. Without the identifier, service 4 before a restart and service 4 after, which might be a different service, would share the same entity tag `"4-1"`, and a client holding the first would receive confirmation that its stale copy remains valid. With the identifier, a tag from one startup does not match those of another in practice (they are 4 random bytes: odds of one in 4.295 billion for each earlier startup, never a mathematical guarantee), without storing anything on disk. That is why the entity tags in your run end differently from those in the lesson.

Checks are simpler: an `id`, the service checked, an `estado` that starts as `"pendiente"` and transitions to `"terminada"`, and a `resultado` that is `null` until the check completes.

#### 1.2.2 The three ways to respond

```ts
// fig01_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
import type { IncomingMessage, ServerResponse } from "node:http";

export type Cabeceras = Record<string, string>;

// Node trae los nombres viejos de estos dos códigos; aquí van los del registro de la IANA.
const FRASES: Partial<Record<number, string>> = { 413: "Content Too Large", 422: "Unprocessable Content" };

function escribirCabecera(respuesta: ServerResponse, codigo: number, cabeceras: Cabeceras): void {
  const frase = FRASES[codigo];
  if (frase === undefined) respuesta.writeHead(codigo, cabeceras);
  else respuesta.writeHead(codigo, frase, cabeceras);
}

export function enviarJson(respuesta: ServerResponse, codigo: number, datos: unknown, cabeceras: Cabeceras = {}): void {
  const cuerpo = JSON.stringify(datos) + "\n";
  escribirCabecera(respuesta, codigo, {
    ...cabeceras,
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(cuerpo)),
  });
  respuesta.end(cuerpo);
}

// Para 204, 304 y las redirecciones: código y cabeceras, sin cuerpo.
export function enviarVacio(respuesta: ServerResponse, codigo: number, cabeceras: Cabeceras = {}): void {
  // 204 y 304 no pueden llevar Content-Length de un cuerpo; los demás dicen «cero bytes».
  const largo: Cabeceras = codigo === 204 || codigo === 304 ? {} : { "Content-Length": "0" };
  escribirCabecera(respuesta, codigo, { ...cabeceras, ...largo });
  respuesta.end();
}

// Un error: por ahora, una línea de texto. La lección 5 lo cambia por Problem Details.
export function fallar(respuesta: ServerResponse, codigo: number, detalle: string, cabeceras: Cabeceras = {}): void {
  const cuerpo = detalle + "\n";
  escribirCabecera(respuesta, codigo, {
    ...cabeceras,
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": String(Buffer.byteLength(cuerpo)),
  });
  respuesta.end(cuerpo);
}

// Tope del cuerpo: 16 KiB. Un servicio es un nombre de hasta 40 caracteres, una URL y un número; cabe
// de sobra. Sin tope, leerCuerpo guardaba en memoria todo lo que llegara: un POST de 50 MB subía la
// memoria del revisor unos 150 MB, y cualquiera con la dirección podía llenarla.
export const TOPE_CUERPO = 16 * 1024;

// La señal de que el cuerpo pasó del tope. Quien llama responde 413 (RFC 9110, sección 15.5.14).
export class CuerpoDemasiadoGrande extends Error {}

// Cuando el cuerpo ya pasó del tope, el cliente puede seguir mandando. Si el servidor responde el 413 y destruye la
// conexión en ese momento, lo que todavía llega a una conexión cerrada se contesta con un RST del sistema operativo,
// y ese RST puede borrar el 413 antes de que el cliente lo lea: el cliente ve EPIPE o ECONNRESET en vez de la
// respuesta. El RFC 9112, sección 9.6, aconseja un cierre en etapas: responder, cerrar solo la escritura (media cerrada),
// seguir leyendo y tirando lo que llegue hasta que el cliente cierre o pase un plazo (el RFC no fija ninguno; el de 2 s es del curso), y cerrar del todo.
// Node, con «Connection: close», llama a socket.destroySoon() al terminar de responder, que cierra y destruye; aquí
// se cambia ese método, solo en esta conexión, para que únicamente cierre la escritura.
const ESPERA_CIERRE_MS = 2000;
function cerrarConCalma(peticion: IncomingMessage): void {
  const socket = peticion.socket;
  socket.destroySoon = (): void => {
    socket.end();
  };
  peticion.resume();
  const reloj = setTimeout(() => socket.destroy(), ESPERA_CIERRE_MS);
  socket.once("close", () => clearTimeout(reloj));
}

// Lee el cuerpo contando los bytes. Si Content-Length ya anuncia más del tope, rechaza sin guardar nada;
// si no lo anuncia (cuerpo por partes) o miente, deja de guardar en cuanto se pasa. En los dos casos no
// guarda más de TOPE_CUERPO bytes. No se destruye la petición, porque con ella se iría la conexión y
// no se podría responder: se prepara el cierre en etapas (ver arriba) y el 413 sale de inmediato, con
// «Connection: close».
export function leerCuerpo(peticion: IncomingMessage): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const demasiado = (): void => {
      cerrarConCalma(peticion);
      rechazar(new CuerpoDemasiadoGrande(`el cuerpo pasa de ${TOPE_CUERPO} bytes`));
    };
    if (Number(peticion.headers["content-length"] ?? 0) > TOPE_CUERPO) {
      demasiado();
      return;
    }
    const trozos: Buffer[] = [];
    let total = 0;
    const alLlegar = (trozo: Buffer): void => {
      total += trozo.length;
      if (total > TOPE_CUERPO) {
        peticion.off("data", alLlegar);
        peticion.off("end", alTerminar);
        demasiado();
        return;
      }
      trozos.push(trozo);
    };
    const alTerminar = (): void => resolver(Buffer.concat(trozos).toString("utf8"));
    peticion.on("data", alLlegar);
    peticion.on("end", alTerminar);
    peticion.on("error", rechazar);
  });
}
```

The `revisor` responds in three ways, each living in its own function so that no route has to remember the details:

- **`enviarJson`** responds with a JSON body. It calculates `Content-Length` in bytes, as in Lesson 0, and sets `Content-Type: application/json`. It is what `200`, `201`, and `202` use.
- **`enviarVacio`** responds with no body: for `204`, `304`, and redirects. It has a rule worth explaining: it does not add `Content-Length` to `204` and `304`, while it sets `Content-Length: 0` for the others. The reason is in [RFC 9110, section 8.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6): a server **must not** send `Content-Length` in a `204`, and in a `304` it may only send it if it states what the `200` would have stated, which would be the size of the omitted body. A redirect can carry a body, which is why it explicitly says it measures zero.
- **`fallar`** responds to an error with a single line of text. It is provisional: Lesson 5 replaces it with RFC 9457 *Problem Details*, and that transition is precisely the content of that lesson.

All three pass through `escribirCabecera`, which fixes a detail you already saw in Lesson 0: Node refers to two codes by their old names, so for `413` and `422` the `revisor` supplies the official IANA registry phrases.

`leerCuerpo` gathers the chunks of a request body and converts them into text. A body arrives over the network in fragments, and Node's request is a stream that can be traversed with `for await`; until the last chunk arrives, there is no complete body to read. And it reads **at most 16 KiB** (`TOPE_CUERPO`, 16384 bytes). A service is a short name (the course's model allows up to 40 characters), a URL, and a number, so that is more than enough. Mind what that sentence does not promise: in this lesson the `revisor` only checks that `nombre` and `url` are strings; the length of the name and the rest of the content rules arrive with the validation in [Lesson 3](03-errores-del-cliente-estado.md), and the only thing that bounds the size today is the body limit. Without a limit, anyone who can reach the `revisor` could send a giant body, or many at once, to fill its memory. That is why `leerCuerpo` does not collect chunks blindly: if `Content-Length` already announces more than the limit, it rejects without storing anything; if the body arrives in parts without announcing its size, it counts the bytes as they arrive and stops storing as soon as it goes over. In both cases it signals with `CuerpoDemasiadoGrande` and prepares a **staged close** (RFC 9112, section 9.6): the `413` goes out immediately, with `Connection: close`; the connection is closed for writing only (half-closed), the `revisor` keeps reading and discarding whatever the client manages to send and, if the client does not close its side within 2 seconds, destroys it. If it closed abruptly while the client was still sending, the operating system would answer with an RST that can wipe out the `413` before the client reads it. Whoever was reading responds `413 Content Too Large`. Lesson 2 explains the `413` in depth; here it is enough to know that it exists and to see it once, in 1.5.2.

### 1.3 The routing table

```ts
// fig01_01/rutas.ts — qué ruta y qué método atiende cada función.
import type { IncomingMessage, ServerResponse } from "node:http";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
} from "./servicios.ts";

type Manejador = (contexto: Contexto) => void | Promise<void>;
type Ruta = { patron: RegExp; metodos: Record<string, Manejador> };

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: listar, POST: darDeAlta } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: consultar, DELETE: retirar } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: pedirRevision } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: consultarRevision } },
];

// Las rutas viejas: /viejo/... se mudó con 301 y /api/... con 308.
function redirigir(ruta: string, consulta: string, respuesta: ServerResponse): boolean {
  if (ruta === "/viejo/servicios" || ruta.startsWith("/viejo/servicios/")) {
    enviarVacio(respuesta, 301, { Location: ruta.slice("/viejo".length) + consulta });
    return true;
  }
  if (ruta === "/api/servicios" || ruta.startsWith("/api/servicios/")) {
    enviarVacio(respuesta, 308, { Location: ruta.slice("/api".length) + consulta });
    return true;
  }
  return false;
}

export async function atender(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  console.log(`${peticion.method} ${peticion.url}`);
  const url = new URL(peticion.url ?? "/", "http://revisor");
  if (redirigir(url.pathname, url.search, respuesta)) return;
  // HEAD se atiende como GET; Node no manda el cuerpo.
  const metodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  for (const ruta of RUTAS) {
    const encontrada = ruta.patron.exec(url.pathname);
    // Object.hasOwn y no ruta.metodos[metodo] a secas: el método lo escribe el cliente, y un objeto también
    // «tiene» lo que hereda de Object.prototype (constructor, toString…).
    const manejador = Object.hasOwn(ruta.metodos, metodo) ? ruta.metodos[metodo] : undefined;
    if (encontrada !== null && manejador !== undefined) {
      await manejador({ peticion, respuesta, parametros: encontrada.slice(1) });
      return;
    }
  }
  // Todavía no distingue «no existe la ruta» de «no se permite el método»: eso es la lección 2.
  fallar(respuesta, 404, "no existe esa ruta");
}
```

`rutas.ts` answers a single question: which function handles this request? The `RUTAS` table has one row per route, with a regular expression that recognizes the path and, inside, the methods it accepts. The parentheses in the expression (`(\d+)`) capture the service or check number, and arrive at the handler as `parametros`.

`atender` does four things in order. It logs the method and path to the terminal. It checks whether it is a legacy route that moved, with `redirigir`, which section 1.9 explains. It treats `HEAD` as if it were `GET`: the handling function is the same, and Node, knowing the request was a `HEAD`, omits the body; you saw this in Lesson 0 with `curl -I`. And it iterates through the table until it finds a matching route **and** a function for that method. That final check is done with `Object.hasOwn(ruta.metodos, metodo)`, not bare `ruta.metodos[metodo]`, and the reason is security: the method is supplied by the client, and a JavaScript object also "has" whatever it inherits (`constructor`, `toString`…). With a naive lookup, a client sending the method `constructor` would find a function no one wrote to handle it; with `Object.hasOwn`, only the methods declared by the table count, and `constructor` receives the same `404` as any other unknown method.

If it finds none, it responds `404` with "no existe esa ruta". Notice the comment on that last line: the `revisor` does not yet distinguish between "that route does not exist" and "that route exists, but not with that method." Those are two distinct responses, `404` and `405`, and the second requires the `Allow` header. This is the intentional defect of this lesson, and you will see it in "The error you will see."

### 1.4 `200`: returning what was requested

#### 1.4.1 The deciding question

The `200 OK` is the most well-known success code, and RFC 9110 defines it in [section 15.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1) with an idea worth reading slowly: the content of a `200` **depends on the method**. For a `GET`, a representation of the resource is returned; for a `POST`, the status or result of the action; for a `PUT` or a `DELETE`, the status of the action. That is, `200` does not say "everything is fine" in the abstract: it says "here is the body corresponding to what you requested."

From that comes the deciding question: **is there something to return, and is it what was requested?** If yes, `200`. If the operation created something new, there is a more precise code (`201`). If it has not finished yet, another (`202`). If it finished and there is nothing to report, another (`204`). The `200` is what remains when none of the three more precise ones apply.

The same section adds two details. A `200` to a `GET` or `HEAD` **should** send available validators, such as the `ETag`, and the `revisor` does so when querying a service. And a `200` **is expected to carry content**, unless the framing of the message explicitly states it measures zero (`Content-Length: 0`); if something in the request indicates that the client prefers not to receive content, the RFC suggests a `204` instead.

#### 1.4.2 In the `revisor`

The two routes that return with `200` are `listar` and `consultar`, in `servicios.ts`. This is the complete file, because all the sections that follow will use it:

```ts
// fig01_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarRevision, buscarServicio, crearRevision, crearServicio, etiqueta, listarServicios,
  retirarServicio, terminarRevision, type Revision, type Servicio,
} from "./almacen.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, hayCoincidencia } from "./etiquetas.ts";
import { revisar } from "./cliente.ts";
import {
  CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras,
} from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
};

// Cuánto espera una revisión en la cola antes de empezar.
const ESPERA_EN_COLA_MS = 1000;

function representar(servicio: Servicio): object {
  return { id: servicio.id, nombre: servicio.nombre, url: servicio.url, limite_ms: servicio.limiteMs };
}

// La url sale tal cual en cada representación del servicio: el 201, la consulta, la lista. Lo que una URL
// lleva de secreto —usuario y clave (http://usuario:clave@…) o un token en la consulta (?token=…)— saldría
// con ella, así que no se acepta. El fragmento (#…) tampoco: nunca viaja al servidor y solo estorba.
// Si el texto no se puede leer como URL, aquí no se decide: lo rechaza otra regla.
function urlConSecretos(texto: string): boolean {
  try {
    const url = new URL(texto);
    return url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "";
  } catch {
    return false;
  }
}

function representarRevision(revision: Revision): object {
  return { id: revision.id, servicio: revision.servicio, estado: revision.estado, resultado: revision.resultado };
}

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, 400, `destino prohibido: ${veredicto.motivo}`);
  return false;
}

export function listar({ respuesta }: Contexto): void {
  enviarJson(respuesta, 200, { servicios: listarServicios().map(representar) });
}

export async function darDeAlta({ peticion, respuesta }: Contexto): Promise<void> {
  let leido: unknown;
  try {
    leido = JSON.parse(await leerCuerpo(peticion));
  } catch (error) {
    if (error instanceof CuerpoDemasiadoGrande) {
      // 413: el cuerpo es más grande de lo que el revisor acepta. La lección 2 lo explica.
      fallar(respuesta, 413, `el cuerpo pasa de ${TOPE_CUERPO} bytes`, { Connection: "close" });
      return;
    }
    fallar(respuesta, 400, "el cuerpo no es JSON");
    return;
  }
  // `null`, un número o una lista también son JSON válido, pero no traen campos: leer datos.nombre
  // sobre null lanzaría un TypeError. Solo un objeto sigue adelante.
  if (typeof leido !== "object" || leido === null || Array.isArray(leido)) {
    fallar(respuesta, 400, "el cuerpo no es un objeto JSON");
    return;
  }
  const datos: { nombre?: unknown; url?: unknown; limite_ms?: unknown } = leido;
  if (typeof datos.nombre !== "string" || typeof datos.url !== "string") {
    fallar(respuesta, 400, "faltan nombre y url");
    return;
  }
  if (urlConSecretos(datos.url)) {
    fallar(respuesta, 400, "url no puede llevar usuario, clave, consulta (?) ni fragmento (#)");
    return;
  }
  // limite_ms es opcional, pero si viene se acota: sin cota, un límite de horas dejaría al revisor
  // esperando a un servicio que no responde, y uno de 0 lo daría por caído sin consultarlo.
  const limiteMs = datos.limite_ms === undefined ? 2000 : datos.limite_ms;
  if (typeof limiteMs !== "number" || !Number.isInteger(limiteMs) || limiteMs < 100 || limiteMs > 10000) {
    fallar(respuesta, 400, "limite_ms debe ser un entero entre 100 y 10000");
    return;
  }
  if (!(await destinoPermitido(datos.url, respuesta))) return;
  const servicio = crearServicio({ nombre: datos.nombre, url: datos.url, limiteMs, equipo: "a" });
  enviarJson(respuesta, 201, representar(servicio), {
    Location: `/servicios/${servicio.id}`,
    ETag: etiqueta(servicio),
  });
}

export function consultar({ peticion, respuesta, parametros }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
    return;
  }
  const actual = etiqueta(servicio);
  // If-None-Match trae «*» o una lista, y se compara en débil (RFC 9110, secciones 13.1.2 y 8.8.3.2).
  const condicion = peticion.headers["if-none-match"];
  if (condicion !== undefined && hayCoincidencia(condicion, actual, coincideDebil)) {
    enviarVacio(respuesta, 304, { ETag: actual });
    return;
  }
  enviarJson(respuesta, 200, representar(servicio), { ETag: actual });
}

export function retirar({ respuesta, parametros }: Contexto): void {
  if (!retirarServicio(Number(parametros[0]))) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
    return;
  }
  enviarVacio(respuesta, 204);
}

export function pedirRevision({ respuesta, parametros }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}

export function consultarRevision({ respuesta, parametros }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  if (revision === undefined) {
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}
```

`listar` is the simplest in the entire API: it builds `{"servicios": […]}` with the representation of each service and responds `200`. Notice `representar`: the store keeps `limiteMs`, but the API exposes it as `limite_ms`, and does not expose `equipo` or `version`. The representation is a design decision, separated from how data is stored: if the store changes one day, the API can keep saying the same thing. The fields use `snake_case` because that is how they stay throughout the entire course, and what matters is that they do not change from one route to another.

The response from `listar` is the one you saw in 1.1.4: `{"servicios": […]}` with the three startup services and a `200`. `consultar`, the other `200` route, appears in 1.5.2 and is completed in 1.8, because it is the one that understands entity tags.

### 1.5 `201`: creating, and saying where it ended up

#### 1.5.1 The deciding question

[RFC 9110, section 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2), defines `201 Created` as: the request has been fulfilled and **resulted in one or more new resources being created**. And it explains how the primary resource is identified: by the `Location` header field of the response or, if none is received, by the request URI itself. That second option matters little in a registration like the `revisor`'s, because the request went to `/servicios` and the new service does not live at `/servicios`, but at `/servicios/4`. For this reason, for a `POST` that creates something, [section 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3) is more direct: the server **should** send a `201` with a `Location` identifying the created resource.

The deciding question: **did this request create something that did not exist before and has its own address?** If yes, `201` with `Location`. If the `POST` did something else (processing, computing, sending), there is no new resource to point to and `201` is a lie.

The same section 15.3.2 allows the `201` to carry validators, and states what they mean: they belong to the newly created resource. That is why the `revisor` sends the new service's `ETag` along with `Location`. Whoever performs the registration already has, from the very first response, the tag needed for a conditional request like those in section 1.8.

#### 1.5.2 In the `revisor`

`darDeAlta` reads the body, with the 16 KiB limit from 1.2.2, and asks five questions in order: is it JSON? Is it a JSON **object**? Does it include `nombre` and `url` as strings? Is `limite_ms`, if provided, a reasonable integer? Is the URL an allowed destination? (Section 1.10 explains why). If everything passes, it creates the service and responds `201` with two headers: `Location`, with the address of the new service, and `ETag`, with its entity tag. The body is the representation of the new service, the same one that a `GET` to that address would return; the RFC states that the body of a `201` typically describes and links to the created resource.

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-7b2497d9"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`-X POST` tells `curl` which method to use, `-H` adds the `Content-Type` header, and `-d` sends the body. The service is named `inventario`, points to the lab, and provides no `limite_ms`, so the `revisor` gave it the default, 2000. It is service 4 because the three startup services occupy 1, 2, and 3, and its entity tag is `"4-1-7b2497d9"`: service 4, version 1, and the identifier of this startup (yours will be different).

Now follow the `Location` address:

```text
$ curl -i http://127.0.0.1:18080/servicios/4
HTTP/1.1 200 OK
ETag: "4-1-7b2497d9"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

The same body, the same `ETag`. `Location` is a **relative reference**, `/servicios/4`, without server or port. [RFC 9110, section 10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2), allows this: if the value is relative, it is resolved against the target URI of the original request. That is the same thing `curl` does when following a relative redirect, and what `new URL(location, base)` does in a program, as you will see in section 1.6.

`limite_ms` has a bounded range, from 100 to 10000 milliseconds. Without it, someone could register a service with a one-hour limit, and every check would leave the `revisor` waiting an hour for a service that does not respond; with a limit of zero, it would consider it down without having queried it. Outside the range, registration does not take place:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"eterno","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3600000}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

That `400` is part of the safety net mentioned in "What this lesson does not do": the `revisor` does not create a service with data it cannot fulfill, and does not respond `200` when it did nothing. If you are thinking that "can be parsed but cannot be fulfilled" sounds more like `422` than `400`, you are right, and that is exactly the policy Lesson 3 establishes. For now, the `revisor` does not use `422`.

That leaves the second question on the list, the one that seems redundant: is it a JSON **object**? `null` is valid JSON, just like `7`, `"texto"`, or `[]`, and `JSON.parse` accepts them without complaint. But none of them carry fields, and reading `datos.nombre` on `null` throws a `TypeError`. Without that check, and without the safety net in `servidor.ts`, this request took down the `revisor` for everyone, with a single `curl` and without credentials. With the check:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d 'null'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios
200
```

`400` with the reason, and the next request responds `200`: the `revisor` remains standing. The check and the safety net are not the same thing. The check turns an unserviceable body into a `400` that tells the client what to fix; the safety net catches what nobody anticipated and turns it into a `500`, which tells the client nothing useful. The check is proper handling; the safety net is insurance for whatever slips through.

Before those five questions comes the limit. A 20000-byte body, more than the 16384 bytes the `revisor` accepts:

```text
$ head -c 20000 /dev/zero | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 23:42:10 GMT

el cuerpo pasa de 16384 bytes
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios
200
```

`413`, with `Connection: close`, without the `revisor` storing a single byte of the body: `Content-Length` announced 20000 and reading the header was enough. The next request responds `200`. `head -c 20000 /dev/zero` produces 20000 zero bytes, and `--data-binary @-` tells `curl` to send whatever arrives through the pipe as the body, unchanged.

> **Session break.** If you are taking the lesson in two 45-minute sessions, this is the place. Stop the `revisor` and the lab with `Ctrl`+`C`. When you return, start both and register the `inventario` service again with the `curl` from 1.5.2: since the store lives in memory, restarting loses it, and section 1.7 withdraws service 4. If you are taking the lesson in one go, do the same: stop both, start them up, and repeat the registration so your numbers match those in the lesson. The response is the same as in 1.5.2 except for the entity tag, because it is another startup:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-b27b3d9a"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

### 1.6 `202`: accepted, not yet done

#### 1.6.1 The deciding question

Requesting a check cannot be resolved on the spot. The `revisor` has to query the service, and a slow service might take seconds to respond; in a real system, checks wait their turn in a queue. Keeping the connection open in the meantime would be a bad idea: the client hangs, and if the connection drops it does not know if the check was performed.

That is what `202 Accepted` is for. [RFC 9110, section 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3), defines it with unusual candor: the request has been accepted for processing, but **the processing has not been completed**, and might never be performed, as it could be disallowed when processing actually takes place. It notes that `202` is "intentionally noncommittal." And it adds that in HTTP there is no facility for the server to later send a different status code for the same request: the response has already been given. That is why it concludes with a recommendation that is half of this section: the representation of a `202` **should** describe the current status of the request and point to a **status monitor** where the client can see when it is fulfilled.

The deciding question: **is the operation going to finish after I respond?** If yes, `202`, and never `200` or `201`, because both tell the client it has already finished.

#### 1.6.2 The tracking resource

In the `revisor`, that status monitor is its own resource: each check lives at `/revisiones/{id}`. `pedirRevision` creates the check in `pendiente` status, schedules it for one second later with `setTimeout` (the one-second "queue wait" that makes the pending state observable), and responds `202` with two things: a body describing the current status and a `Location` pointing to the check. It is the same header as `201`, with a different meaning: in a `201` it points to what was created, and in a `202` it points to where to inquire.

`consultarRevision` responds `200` with the check's status. While pending, it adds `Retry-After: 1`. [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), defines `Retry-After` as the time the client should wait before making a follow-up request, in seconds or as a date; the RFC specifies it for `503` and redirects, and in a tracking resource it serves the same role: "do not return before one second." That the `revisor` uses it here is a design decision, not a standard; the standard only defines what the header means.

Request a check for service 2, `pagos`, which points to `/codigo/503`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones
HTTP/1.1 202 Accepted
Location: /revisiones/1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"pendiente","resultado":null}
```

And immediately, without waiting, follow the `Location`:

```text
$ curl -i http://127.0.0.1:18080/revisiones/1
HTTP/1.1 200 OK
Retry-After: 1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"pendiente","resultado":null}
```

`200`, because querying the tracking resource did succeed: here is what you requested, the status of the check. The status is `pendiente`, and `Retry-After: 1` says when to return. This is a point that causes confusion at first: **the `202` describes the request for a check; the `200` describes querying the tracking resource**. They are two separate requests, each with its own code.

Two seconds later:

```text
$ sleep 2
$ curl -i http://127.0.0.1:18080/revisiones/1
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 111
Date: Wed, 21 Oct 2026 13:17:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":11,"detalle":"503"}}
```

Finished. The result indicates that `pagos` is `CAIDO`, with code `503` returned by the lab and the milliseconds it took (in your run, another number). `Retry-After` is no longer sent, because there is nothing left to wait for.

#### 1.6.3 The client side

Who queried `pagos`? The client side of the `revisor`:

```ts
// fig01_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
import type { Resultado } from "./almacen.ts";
import { revisarDestino } from "./destinos.ts";

export async function revisar(url: string, limiteMs: number): Promise<Resultado> {
  // Antes de CADA conexión se vuelve a revisar el destino: el DNS pudo cambiar desde el alta.
  // LÍMITE DECLARADO: esto NO cierra el DNS rebinding. fetch vuelve a resolver el nombre, y entre
  // esta revisión y la conexión el nombre puede apuntar a otra IP. La lección 8 lo completa:
  // se conecta a la IP ya validada, con http.request y su opción lookup.
  const veredicto = await revisarDestino(url);
  if (!veredicto.permitido) return { estado: "CAIDO", codigo: null, ms: null, detalle: `destino prohibido: ${veredicto.motivo}` };
  const inicio = performance.now();
  try {
    const respuesta = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(limiteMs) });
    await respuesta.body?.cancel();
    const ms = Math.round(performance.now() - inicio);
    const detalle = String(respuesta.status);
    if (respuesta.status >= 400) return { estado: "CAIDO", codigo: respuesta.status, ms, detalle };
    return { estado: ms >= limiteMs / 2 ? "LENTO" : "ARRIBA", codigo: respuesta.status, ms, detalle };
  } catch (error) {
    const agotado = error instanceof DOMException && error.name === "TimeoutError";
    return { estado: "CAIDO", codigo: null, ms: null, detalle: agotado ? "tiempo agotado" : "sin conexión" };
  }
}
```

`revisar` receives the URL and the limit. The first thing it does is recheck the destination (section 1.10 explains why before **each** connection). Then it measures time with `performance.now()`, queries with `fetch`, and classifies. If the code is `400` or higher, `CAIDO`. Otherwise, `LENTO` if it took half the limit or more, and `ARRIBA` if it took less. If `fetch` obtained no response, `CAIDO` with a detail distinguishing "timed out" from "no connection"; this is the distinction between `curl` error 7 and an HTTP response that you saw at the end of Lesson 0.

Three details about `fetch`. `AbortSignal.timeout(limiteMs)` aborts the query if it exceeds the limit. `respuesta.body?.cancel()` discards the body without reading it, because only the number matters for classification: this is the "code rules" criterion applied on the reader's side. And `redirect: "manual"` tells `fetch` **not to follow** redirects: if a service responds `301`, the `revisor` notes the `301` and does not follow where `Location` points. That decision has a security reason, which you will see in the callout.

#### 1.6.4 A client that knows how to wait

With `curl` you followed the `202` by hand. A program has to do it on its own, and the temptation is to query in an unpaused loop until it says `terminada`. This program does it properly. Save it as `~/curso-http/revisor/fig01_02.ts`:

```ts
// fig01_02.ts
// Pide una revisión y la sigue como debe hacerlo quien recibe un 202: va a Location y respeta Retry-After.
import { setTimeout as esperar } from "node:timers/promises";

const BASE = "http://127.0.0.1:18080";
const servicio = process.argv[2] ?? "2";

const pedido = await fetch(`${BASE}/servicios/${servicio}/revisiones`, { method: "POST" });
await pedido.text();
const seguimiento = pedido.headers.get("location");
console.log(`${pedido.status} ${pedido.statusText}; seguimiento en ${seguimiento}`);
if (pedido.status !== 202 || seguimiento === null) process.exit(1);

type Revision = { estado: "pendiente" | "terminada"; resultado: unknown };

for (let consulta = 1; consulta <= 10; consulta++) {
  const respuesta = await fetch(new URL(seguimiento, BASE));
  const revision = (await respuesta.json()) as Revision;
  const pide = respuesta.headers.get("retry-after");
  console.log(`consulta ${consulta}: ${respuesta.status} ${revision.estado}${pide === null ? "" : `, Retry-After: ${pide}`}`);
  if (revision.estado === "terminada") {
    console.log(`resultado: ${JSON.stringify(revision.resultado)}`);
    break;
  }
  // Espera lo que pide el servidor, entre 1 y 5 segundos: ni martilla ni se queda dormido.
  const segundos = Math.min(Math.max(Number(pide) || 1, 1), 5);
  await esperar(segundos * 1000);
}
```

It reads the `202` response and extracts `Location`; if the code is not `202` or the header is missing, it stops, because it would not know where to inquire. Then it queries the tracking resource: `new URL(seguimiento, BASE)` resolves the relative reference against the server and port, as the RFC specifies. On each iteration it prints the status and, if present, `Retry-After`. When the check finishes, it prints the result and exits. Otherwise, it waits for what the server requested, **bounded between 1 and 5 seconds**, and asks again. Both bounds are client-side choices, not from the RFC: the lower bound avoids hammering the server if `Retry-After` is missing or not a number, and the upper bound prevents a misconfigured server from putting it to sleep for an hour. [Lesson 6](06-reintentos-idempotencia.md) revisits that second bound, and [Lesson 7](07-quien-lee-el-error.md) covers what to do when the server asks to wait longer than you are willing. The loop also has a ceiling of ten queries, so that a tracking resource that never finishes does not leave the program running forever.

With the lab and the `revisor` running, request a check for service 1, `catalogo`:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/2
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"ARRIBA","codigo":200,"ms":1,"detalle":"200"}
```

Two queries. The first found the check pending and obeyed `Retry-After`; the second, one second later, found it finished: `catalogo` is `ARRIBA`. In the `revisor`'s terminal three lines remained: the `POST` and the two `GET`s. Count the queries your program made: if it was five thousand, the pause is missing.

### 1.7 `204`: done, and nothing to report

#### 1.7.1 The deciding question

[RFC 9110, section 15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5), defines `204 No Content`: the server has fulfilled the request and **there is no additional content** to send. And it is emphatic about the format: a `204` ends with the last header, and **must not** contain a body.

The deciding question: **did the operation complete and is there nothing useful to report?** Deletion is the textbook case. For a successful `DELETE`, [section 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.5) gives exactly three options: `202` if the action will likely succeed but is not yet enacted, `204` if the action has been enacted and no further information is to be supplied, and `200` if the action has been enacted and the response message includes a representation describing the status. The `revisor` withdraws on the spot and has nothing to report, so it responds `204`.

And why not `200` with an empty body, or with `{"ok": true}`? Because `204` tells any program, without parsing anything, that there is no body to wait for. A `200` with `{"ok": true}` forces the client to read the body to learn something the status code already stated. And an empty `200` is valid if it declares `Content-Length: 0`, but it forces the client to inspect the length to know there is nothing there, when `204` already announces it via the code itself.

#### 1.7.2 In the `revisor`

`retirar` removes the service from the store and responds with `enviarVacio`. If the service did not exist, it responds `404`. Withdraw service 4:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Neither `Content-Type` nor `Content-Length`: there is no body to describe. Request it again:

```text
$ curl -i http://127.0.0.1:18080/servicios/4
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 4
```

The service no longer exists, and the `revisor` says so with a `404` and a line of text. (In Lesson 3, a withdrawn service will respond `410`, which says "it existed and is no longer here"; today the `revisor` does not remember what it withdrew.) And if you repeat the withdrawal:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 4
```

The second `DELETE` responds differently than the first, and yet `DELETE` is **idempotent**. [RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2), defines an idempotent method by its **effect on the server**, not by the response: repeating the request leaves the server in the same state as making it once. After one or ten `DELETE`s, service 4 does not exist. That property is the foundation of Lesson 6, because it allows retrying without fear.

### 1.8 `304`: not sending what you already have

#### 1.8.1 The deciding question

Imagine a dashboard that displays services and queries them every ten seconds. Most of the time nothing changed, and the `revisor` sends the exact same body again and again. That is what **conditional requests** are for: the client says "I already have the version with this tag; send it to me only if it changed." The header is `If-None-Match` ("if none match"), and it carries the `ETag` that the client saved.

[RFC 9110, section 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2), explains how it is evaluated: if any of the tags sent by the client matches that of the resource, the condition is false, and therefore the server **must not** perform the requested method: for a `GET` or `HEAD` it responds `304`, and for any other method, `412` (Lesson 3 deals with `412`). If none match, the server responds as usual, with its `200`.

[RFC 9110, section 15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5), defines `304 Not Modified`: the conditional request would have resulted in a `200`, but there is no need to send the representation because **the client already has it**. The server, says the RFC, is "redirecting" the client to its own stored copy. That is why `304` lives in the `3xx` family even though it carries no `Location`: it is a redirection to what you already possess. And like `204`, it terminates after the last header: it **must not** carry a body.

What it must carry is the part most often forgotten. The RFC provides a short list: `Content-Location`, `Date`, `ETag`, and `Vary`, as well as `Cache-Control` and `Expires`; `Content-Length` may accompany them only if it says the same thing the `200` would have said (section 8.6), and the `revisor` prefers not to send it. Of those headers, a `304` **must** generate those that would have been sent in a `200` to the same request. The `ETag` is the one that matters here: it confirms to the client which version is current.

The deciding question, on the server side: **is the version the client claims to have the current one?** If yes, `304` and nothing more. If no, `200` with the new version and its tag.

#### 1.8.2 Reading a list of tags

Section 13.1.2 has two details that determine how the code is written. First: `If-None-Match` does not carry **one** tag, but `*` or **a comma-separated list** (`If-None-Match: "a", "b"`), because a client may have multiple stored versions and ask about all of them at once; and `*` means "whichever version you have." Second: the comparison is **weak**. [Section 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) defines two ways to compare tags. In the **strong** comparison, two tags match only if neither carries `W/` (the "weak" validator indicator) and the text is identical. In the **weak** comparison, it suffices that the quoted text is the same, whether with `W/` or without it. `If-None-Match` uses weak comparison, because it only asks whether the client's copy is still good enough to display. Lesson 3 uses strong comparison, with `If-Match`, for something more delicate.

Comparing the entire header against the tag as plain text fails on both counts, and that is why `etiquetas.ts` exists:

```ts
// fig01_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
//
// Una etiqueta es un texto entre comillas, con «W/» delante si es débil: "1-1" o W/"1-1" (sección 8.8.3).
// If-None-Match e If-Match no traen una etiqueta: traen «*» o una LISTA separada por comas
// (secciones 13.1.1 y 13.1.2). Por eso comparar la cabecera entera con la etiqueta, como texto, falla:
// W/"1-1" y "9-9", "1-1" no son iguales a "1-1", y las dos deben coincidir en If-None-Match.
//
// Hay dos maneras de comparar (sección 8.8.3.2):
//   débil  — If-None-Match (304): basta con que el texto entre comillas sea igual, con W/ o sin él;
//   fuerte — If-Match (412): además, ninguna de las dos puede ser débil.

// «*» aparte; si no, la lista de etiquetas tal como vienen (W/"1-1", "1-1"…).
export type Lista = "*" | string[];

// Lo que puede ir entre las comillas: visibles menos la comilla, y los bytes de 0x80 en adelante.
const OPACA = /^"[\x21\x23-\x7E\x80-\xFF]*"$/;

// Lee la cabecera respetando las comillas: una coma DENTRO de las comillas es parte de la etiqueta,
// no un separador. Los elementos vacíos («"1-1", , "2-1"») se saltan (sección 5.6.1).
// Si algo no es una etiqueta, la lista entera no vale y se devuelve vacía: así no coincide con nada,
// que es lo más prudente (If-None-Match responde completo; If-Match responde 412).
// «*» va sin compañía: mezclado con etiquetas es inválido (secciones 13.1.1 y 13.1.2).
export function interpretarLista(cabecera: string): Lista {
  const texto = cabecera.trim();
  if (texto === "*") return "*";
  const etiquetas: string[] = [];
  let i = 0;
  while (i < texto.length) {
    const letra = texto[i];
    if (letra === " " || letra === "\t" || letra === ",") {
      i++;
      continue;
    }
    const inicio = i;
    if (texto.startsWith("W/", i)) i += 2;
    if (texto[i] !== '"') return [];
    const cierre = texto.indexOf('"', i + 1);
    if (cierre === -1) return [];
    const etiqueta = texto.slice(inicio, cierre + 1);
    if (!OPACA.test(etiqueta.replace(/^W\//, ""))) return [];
    etiquetas.push(etiqueta);
    i = cierre + 1;
    // Después de una etiqueta solo pueden venir espacios y luego una coma o el final.
    while (texto[i] === " " || texto[i] === "\t") i++;
    if (i < texto.length && texto[i] !== ",") return [];
  }
  return etiquetas;
}

function esDebil(etiqueta: string): boolean {
  return etiqueta.startsWith("W/");
}

function opaca(etiqueta: string): string {
  return esDebil(etiqueta) ? etiqueta.slice(2) : etiqueta;
}

// Débil: W/"1" y "1" coinciden; W/"1" y W/"2" no.
export function coincideDebil(a: string, b: string): boolean {
  return opaca(a) === opaca(b);
}

// Fuerte: solo "1" con "1". Si cualquiera de las dos es débil, no coinciden.
export function coincideFuerte(a: string, b: string): boolean {
  return !esDebil(a) && !esDebil(b) && a === b;
}

// ¿Alguna etiqueta de la cabecera coincide con la vigente? «*» coincide si el recurso existe, y quien
// llama ya lo encontró antes de preguntar. Se elige la comparación: débil para If-None-Match,
// fuerte para If-Match.
export function hayCoincidencia(cabecera: string, vigente: string, comparar: (a: string, b: string) => boolean): boolean {
  const lista = interpretarLista(cabecera);
  if (lista === "*") return true;
  return lista.some((etiqueta) => comparar(etiqueta, vigente));
}
```

`interpretarLista` traverses the header respecting quotes: a comma **inside** quotes is part of the tag, not a delimiter. It returns `"*"` or the list of tags as they arrived. If anything does not have the form of a tag, the entire list is discarded and it returns an empty list, which matches nothing. This is the prudent decision: given a malformed header, the server responds with the full response, which is never incorrect. `coincideDebil` and `coincideFuerte` compare two tags. `hayCoincidencia` joins both pieces: `*` always matches (the caller already found the resource), and a list matches if **any** of its tags matches the current one.

#### 1.8.3 In the `revisor`

`consultar`, in `servicios.ts`, calculates the current tag and asks `hayCoincidencia`, with weak comparison, whether the `If-None-Match` header contains it. If yes, `enviarVacio(respuesta, 304, { ETag: actual })`; if not, the usual `200`. Request service 1, `catalogo`, and look at its `ETag`:

```text
$ curl -i http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-b27b3d9a"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Now request it with that tag. Copy **yours**, the one your response gave you, quotes included:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 304 Not Modified
ETag: "1-1-b27b3d9a"
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`304`, with the `ETag` and without a body, without `Content-Type`, and without `Content-Length`: the 88 bytes of the body did not travel over the network. On this toy service it is negligible; on a list of thousands of services queried every ten seconds by a hundred dashboards, it is the difference between transmitting megabytes per minute or virtually nothing.

Compare it with a `HEAD`, which also arrives with no body but for a different reason:

```text
$ curl -I http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-b27b3d9a"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`200` with `Content-Length: 88`: the `HEAD` indicates how large the body would measure, as in Lesson 0. The `304` says nothing like that, because it is not an answer to "what does it look like?", but to "did it change?".

The other three forms allowed by the RFC, with `-w '%{http_code}\n'` to see only the code: the tag marked as weak, a list containing it, and the asterisk.

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", "1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: *'
304
```

All three return `304`. `W/` changes nothing in a weak comparison; the list matches because one of its tags matches; and `*` matches because the service exists.

#### 1.8.4 The tag changes on every startup

Stop the `revisor` (leave the lab running) and start it up again. Then request service 1 with the earlier tag:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 200 OK
ETag: "1-1-ed399d6d"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`200`, with the full body and a new tag. Service 1 is the same `catalogo` and nothing changed in it, but the `revisor` has no way of knowing: it lost everything on restart and created it anew. When in doubt, it sends the full representation and a tag that cannot be confused with any previous one. This is the startup identifier from 1.2.1 doing its job. Without it, both the old and new tags would be `"1-1"`, and a `304` would have confirmed a copy to the client that the server can no longer guarantee. A server that stores its data in a database does not have this problem: its version survives a restart. The `revisor` solves it with the simplest thing that works.

### 1.9 `301` and `308`: moving without losing the `POST`

#### 1.9.1 The deciding question

APIs move. The `revisor` had two legacy routes, `/viejo/servicios` and `/api/servicios`, which now live at `/servicios`. To express this there are two permanent codes, and the difference between them is historical.

[RFC 9110, section 15.4.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.2), defines `301 Moved Permanently`: the target resource has been assigned a new permanent URI and the server **should** generate a `Location` header field. And it carries a note that is at the center of this section: **for historical reasons, a client may change the request method from `POST` to `GET`** in the follow-up request. The same note gives the solution: if that method change is not desired, `308` is used instead.

The introduction to [section 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4) recounts the full history. In HTTP/1.0, `301` and `302` preserved the method. But early browsers split: some repeated the `POST` at the new address, while others converted it into a `GET`, which was the most cautious behavior if the redirect led to another site. Industry practice ended up converting it to `GET`, and the specification was adjusted to allow it. For redirects that **do** preserve the method, new codes were minted: `307`, temporary, and `308 Permanent Redirect`, defined by [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) in June 2014 as experimental, promoted to standard by [RFC 7538](https://www.rfc-editor.org/rfc/rfc7538.html) in April 2015, and now residing in [section 15.4.9](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.9) of RFC 9110.

The clients you will use follow that practice to the letter. The `curl` manual states that when following a redirect with `-L`, if the request was a `POST` and the response was `301`, `302`, or `303`, the next request is a `GET`; with any other `3xx`, it repeats the same method. And the [Fetch standard](https://fetch.spec.whatwg.org/#http-redirect-fetch), followed by `fetch` in Node and browsers, specifies the exact same rule in its HTTP-redirect fetch algorithm: if the status is `301` or `302` and the method is `POST`, the method becomes `GET` and **the request body is discarded**.

The deciding question: **can anyone send anything other than a `GET` or `HEAD` to this legacy route?** If never, `301` suffices and even the oldest client understands it. If a `POST`, `PUT`, or `DELETE` might arrive, `308`. RFC 7538, in section 4, adds a precaution: a very old client that does not recognize `308` will treat it as a `300` under the `x00` rule from Lesson 0, and might not follow the redirect: the server cannot count on it following. Today that is rare, but it is why `301` remains the choice for routes that are only read.

Migrations are not a textbook hypothetical. The OWASP page cited in this lesson's security callout changed its address, and if you request it at the old address with `-I` (headers only) and `-L` (follow), you see the full migration in three hops:

```text
$ curl -sS -I -L https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/ | grep -i -E '^HTTP|^location'
HTTP/2 308 
location: /API-Security/editions/2023/en/0xa7-server-side-request-forgery
HTTP/2 308 
location: https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery
HTTP/2 301 
location: https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/
HTTP/2 200 
```

Two `308`s and one `301` before the `200`: the first strips the trailing slash, the second moves the page to another domain, and the third adds the slash back. This run is from October 21, 2026 and is saved, as is, in `programas/01-exitos-redirecciones/owasp.salida.txt`, and an external site can change its redirects whenever it likes, so yours may look different. The lines read `HTTP/2` and carry no phrase because that connection used HTTP/2, which does not send the reason phrase in the status line: Lesson 0 told you that a client must not base decisions on it.

There is a third code often mentioned here, `302 Found`, and it helps to know where it stands. It carries the same historical note as `301` (a `POST` may become `GET`), but it is **temporary**: the client should continue to use the original address. Its partner that preserves the method is `307`. The `revisor` does not use them because its moves are permanent; the lab produces them at `/codigo/302` and `/codigo/307` if you want to see them.

#### 1.9.2 In the `revisor`

`redirigir`, in `rutas.ts`, checks the route **before** the table, so a legacy route never reaches a handler. For `/viejo/servicios` and anything underneath it, it responds `301`; for `/api/servicios` and anything underneath, `308`. In both cases, `Location` is the new route: the prefix is stripped and the query string (what comes after `?`) is preserved, so that `GET /viejo/servicios?x=1` reaches `/servicios?x=1`.

Without `-L`, `curl` only displays the response without following it. Send a registration to each legacy route:

```text
$ curl -i -X POST http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
$ curl -i -X POST http://127.0.0.1:18080/api/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 308 Permanent Redirect
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Both responses say the same thing, except for the number: "this moved to `/servicios`", with `Content-Length: 0`. Neither created anything. What happens next depends on the client, and that is precisely what "The error you will see" section shows.

### 1.10 Security callout: SSRF

> **Security callout. What SSRF is and why the `revisor` carries it by design**
>
> **SSRF** (*server-side request forgery*) is what happens when someone succeeds in making **your server** make a request that **they** chose. The server connects from its own network, with its own access privileges, to an address the attacker could not reach from outside: the server itself (`127.0.0.1`), the company's internal network, or the cloud provider's metadata service. The [2023 OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/) places it in seventh position (API7:2023), defining it as: an API that fetches a remote resource **without validating the user-supplied URL**. And it explains why it became common: webhooks, link previews, and file downloads from URLs are product features whose entire purpose is connecting to an external address.
>
> **The `revisor` is the classic case.** Its job is connecting to the URL entered by whoever registered the service. It is not an oversight that can be removed: it is the product. Without any defense, anyone with permission to register a service could enter `http://127.0.0.1:18080/mantenimiento` and cause the `revisor` to query itself, or an internal network address only the server can see, and then read the check result: `ARRIBA`, `CAIDO`, the code, and the milliseconds. With that, they can already map out which machines and ports exist inside the network. And if the `revisor` runs in the cloud, there is one address more valuable than all others: `169.254.169.254`, where several clouds host instance **metadata**. The [AWS documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) uses that address in all its examples (and `[fd00:ec2::254]` in IPv6), [Alibaba Cloud](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata) uses another, `100.100.100.200`, and the [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) states it plainly: in the cloud, SSRF is frequently used to steal credentials and tokens from these metadata services.
>
> **The defense: asking DNS before each connection.** Checking the URL text alone is insufficient. `localhost` does not look like a prohibited address, but it is; `http://2130706433/` does not look like one either, but the URL parser normalizes it to `127.0.0.1`, because the [URL standard](https://url.spec.whatwg.org/#concept-ipv4-parser) accepts IPv4 addresses written as a single integer, in hexadecimal, or in octal. What matters is not how the destination is written, but **which IP address the `revisor` will connect to**. That is why `destinos.ts` does three things: it lets `new URL` normalize the address; it resolves the hostname with `dns.lookup` and the `all: true` option, which returns **all** IP addresses for the name, just as any other program on the machine would resolve it (including `/etc/hosts`); and it rejects the destination if **even a single one** falls into a private or reserved range. Ranges are verified with Node's `net.BlockList`, and an IPv4 embedded inside an IPv6 (`::ffff:127.0.0.1`) is extracted and checked for what it is. And the validation is performed **twice**: upon registering the URL, to notify whoever is registering it, and again in `cliente.ts`, **before each connection**, because what a hostname resolved to on Friday is not necessarily what it resolves to on Monday. Notice also what the rejection **does not** say: the error message does not disclose which IP address the hostname resolved to, so as not to hand the attacker an internal network map one request at a time. The specific IP address, if needed, goes strictly to the server's log, where the operator reads it.
>
> **The lab exception.** The lab for this course lives at `127.0.0.1:18081`, which is loopback, a prohibited range. Without an exception, the course could not practice on a single machine. That is why an allowlist of permitted destinations **by exact address and port** exists: by default only `127.0.0.1:18081`, configurable via the `REVISOR_DESTINOS` environment variable. It is deliberately exact: `127.0.0.1:18080`, the `revisor` itself, remains forbidden. And `localhost:18081` depends on the machine: if `localhost` also resolves to `::1`, as on macOS and many Linux setups, it is rejected because `[::1]:18081` is not in the list; if it resolves solely to `127.0.0.1`, it is accepted, because `127.0.0.1:18081` is the exact exception. That difference is one more reason why the allowlist is by IP address and not by hostname: what a hostname resolves to is not decided by whoever wrote the rule. In a real `revisor`, the list would be empty or contain only what is strictly necessary, and the general rule (no private destinations) would handle the rest. An allowlist is safer than a blocklist, and OWASP recommends it whenever destinations are known in advance; here they are not known, because anyone can register any service, which is why both are combined.
>
> **Why `fetch` does not follow redirects.** If `cliente.ts` followed `3xx` responses, someone could simply register a public service that responds `301` with `Location: http://169.254.169.254/…`: the registered URL would pass inspection, and the redirect would lead the `revisor` straight where it must not go, bypassing `destinos.ts`. With `redirect: "manual"`, the `revisor` logs the `301` and stops. OWASP and the API Top 10 recommend the same: disable redirect following.
>
> **The declared limit: DNS rebinding.** Even validating before each `fetch`, a gap remains, and it is worth acknowledging. `destinos.ts` resolves the hostname and approves its IP addresses; then, `fetch` **resolves it again** to connect. Milliseconds elapse between the two resolutions, and whoever controls the DNS server for that domain can return a public IP for the first query and `127.0.0.1` for the second, with a zero-second time-to-live so no cache stores the first answer. This is known as **DNS rebinding**, and it is a time-of-check to time-of-use race condition. The OWASP guide states it in plain terms: a second, unvalidated resolution between check and connection bypasses these defenses. The full defense is **connecting to the already validated IP address** without resolving the hostname again: using Node's `http.request` with its `lookup` option, a function that substitutes `dns.lookup` and can return the exact approved IP while the `Host` header retains the original domain name. **Here we validate before each connection, and the complete defense arrives in [Lesson 8](08-contrato-verificable.md)**, where `cliente.ts` connects directly to the validated IP; in the meantime, the limitation is declared in the comments of `destinos.ts`, so no one assumes it is resolved. And even with that defense, in production an additional layer is needed: a network configuration that prevents the `revisor` from reaching instance metadata even if it tries. Defense cannot hinge on a single file.

#### 1.10.1 The code

```ts
// fig01_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
//
// SSRF (server-side request forgery): quien da de alta un servicio escribe una URL, y el revisor
// se conecta a ella DESDE SU RED. Sin esta revisión, cualquiera con permiso de escritura podría hacer
// que el revisor consulte 127.0.0.1, la red interna o 169.254.169.254, donde las nubes publican los
// metadatos de la máquina (y a veces sus credenciales). Un revisor de servicios es el caso típico:
// conectarse a URLs ajenas es justo su trabajo, así que no se puede quitar; se acota.
//
// La regla: se resuelve el nombre y CADA dirección debe estar en la lista de destinos permitidos
// (ip:puerto) o ser pública. Se valida al registrar la URL Y antes de cada conexión, porque el DNS
// puede cambiar entre una y otra.
//
// LÍMITE DECLARADO: aun validando antes de cada fetch, el DNS puede cambiar entre la validación y la
// conexión (DNS rebinding). La defensa completa es conectarse a la IP ya validada (con http.request
// y su opción lookup), no volver a resolver el nombre. La lección 8 la hace en cliente.ts; hasta
// entonces, el límite queda escrito aquí.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Destinos permitidos aunque sean privados: el laboratorio del curso. Se cambian con REVISOR_DESTINOS.
const PERMITIDOS = new Set((process.env.REVISOR_DESTINOS ?? "127.0.0.1:18081").split(",").map((d) => d.trim()));

// Qué direcciones son «privadas o reservadas». Fuente: los registros de direcciones de uso especial
// de la IANA (IPv4 e IPv6, que actualizan al RFC 6890) y la OWASP SSRF Prevention Cheat Sheet.
//
// IPv4 va con LISTA NEGRA: no existe un bloque «global» que se pueda permitir entero, así que se
// rechazan los bloques del registro que no son alcanzables desde internet, más el multicast.
const IPV4_PROHIBIDAS = new BlockList();
IPV4_PROHIBIDAS.addSubnet("0.0.0.0", 8, "ipv4"); // «esta red», incluye 0.0.0.0
IPV4_PROHIBIDAS.addSubnet("10.0.0.0", 8, "ipv4"); // uso privado (RFC 1918)
IPV4_PROHIBIDAS.addSubnet("100.64.0.0", 10, "ipv4"); // espacio compartido (CGNAT); Alibaba Cloud publica ahí sus metadatos
IPV4_PROHIBIDAS.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
IPV4_PROHIBIDAS.addSubnet("169.254.0.0", 16, "ipv4"); // enlace local, incluye los metadatos de la nube
IPV4_PROHIBIDAS.addSubnet("172.16.0.0", 12, "ipv4"); // uso privado (RFC 1918)
IPV4_PROHIBIDAS.addSubnet("192.0.0.0", 24, "ipv4"); // asignaciones de protocolo del IETF
IPV4_PROHIBIDAS.addSubnet("192.0.2.0", 24, "ipv4"); // documentación (TEST-NET-1)
IPV4_PROHIBIDAS.addSubnet("192.88.99.0", 24, "ipv4"); // relevo 6to4, retirado
IPV4_PROHIBIDAS.addSubnet("192.168.0.0", 16, "ipv4"); // uso privado (RFC 1918)
IPV4_PROHIBIDAS.addSubnet("198.18.0.0", 15, "ipv4"); // pruebas de rendimiento
IPV4_PROHIBIDAS.addSubnet("198.51.100.0", 24, "ipv4"); // documentación (TEST-NET-2)
IPV4_PROHIBIDAS.addSubnet("203.0.113.0", 24, "ipv4"); // documentación (TEST-NET-3)
IPV4_PROHIBIDAS.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
IPV4_PROHIBIDAS.addSubnet("240.0.0.0", 4, "ipv4"); // reservado, incluye 255.255.255.255 (difusión)

// IPv6 va con LISTA BLANCA: solo 2000::/3, el unicast global. Así quedan fuera de un golpe ::1, ::,
// fc00::/7, fe80::/10, el multicast ff00::/8, 100::/64 y 64:ff9b:1::/48 (traducción local, RFC 8215),
// sin nombrarlos uno por uno. Dentro de 2000::/3 se rechazan los bloques que no son de internet.
const IPV6_GLOBAL = new BlockList();
IPV6_GLOBAL.addSubnet("2000::", 3, "ipv6");
const IPV6_PROHIBIDAS = new BlockList();
IPV6_PROHIBIDAS.addSubnet("2001::", 23, "ipv6"); // protocolos del IETF: Teredo (2001::/32), pruebas, ORCHID…
IPV6_PROHIBIDAS.addSubnet("2001:db8::", 32, "ipv6"); // documentación
IPV6_PROHIBIDAS.addSubnet("3fff::", 20, "ipv6"); // documentación
IPV6_PROHIBIDAS.addSubnet("5f00::", 16, "ipv6"); // segment routing (SRv6)

// Cuatro formatos IPv6 llevan una IPv4 adentro. La IPv4 se saca y se revisa contra la lista IPv4:
// [64:ff9b::a9fe:a9fe] es 169.254.169.254 por dentro. Se revisan ANTES que la lista blanca, porque
// ::ffff:8.8.8.8 o 2002:808:808:: llevan una dirección pública y deben pasar.
type Embebida = { prefijo: BlockList; ipv4: (g: number[]) => number[] };
function prefijo(direccion: string, bits: number): BlockList {
  const lista = new BlockList();
  lista.addSubnet(direccion, bits, "ipv6");
  return lista;
}
const ultimos32 = (g: number[]): number[] => [g[6], g[7]];
const EMBEBIDAS: Embebida[] = [
  { prefijo: prefijo("::ffff:0:0", 96), ipv4: ultimos32 }, // IPv4 mapeada (RFC 4291)
  { prefijo: prefijo("::", 96), ipv4: ultimos32 }, // IPv4 compatible, obsoleta; incluye :: y ::1 (0.0.0.0 y 0.0.0.1)
  { prefijo: prefijo("64:ff9b::", 96), ipv4: ultimos32 }, // NAT64 (RFC 6052)
  { prefijo: prefijo("2002::", 16), ipv4: (g) => [g[1], g[2]] }, // 6to4 (RFC 3056): la IPv4 va en los bits 16 a 47
];

// Los ocho grupos de 16 bits de una IPv6 («::» rellena con ceros; acepta la IPv4 escrita al final).
function grupos(ipv6: string): number[] {
  let texto = ipv6;
  const cola = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(texto);
  if (cola !== null) {
    const [a, b, c, d] = cola.slice(1).map(Number);
    texto = texto.slice(0, cola.index) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [izquierda, derecha] = texto.split("::");
  const antes = izquierda === "" ? [] : izquierda.split(":");
  const despues = derecha === undefined || derecha === "" ? [] : derecha.split(":");
  const ceros = derecha === undefined ? [] : Array<string>(8 - antes.length - despues.length).fill("0");
  return [...antes, ...ceros, ...despues].map((grupo) => parseInt(grupo, 16));
}

function privada(direccion: string): boolean {
  if (isIP(direccion) === 4) return IPV4_PROHIBIDAS.check(direccion, "ipv4");
  const ipv6 = direccion.replace(/%.*$/, ""); // sin el índice de zona (fe80::1%en0)
  for (const { prefijo, ipv4 } of EMBEBIDAS) {
    if (prefijo.check(ipv6, "ipv6")) {
      const [alto, bajo] = ipv4(grupos(ipv6));
      return IPV4_PROHIBIDAS.check([alto >> 8, alto & 0xff, bajo >> 8, bajo & 0xff].join("."), "ipv4");
    }
  }
  return !IPV6_GLOBAL.check(ipv6, "ipv6") || IPV6_PROHIBIDAS.check(ipv6, "ipv6");
}

export type Veredicto = { permitido: true } | { permitido: false; motivo: string };

export async function revisarDestino(texto: string): Promise<Veredicto> {
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { permitido: false, motivo: "no es una URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { permitido: false, motivo: "solo http o https" };
  const puerto = url.port !== "" ? url.port : url.protocol === "https:" ? "443" : "80";
  const nombre = url.hostname.replace(/^\[|\]$/g, "");
  let direcciones: string[];
  try {
    direcciones = isIP(nombre) !== 0 ? [nombre] : (await lookup(nombre, { all: true })).map((d) => d.address);
  } catch {
    return { permitido: false, motivo: `el nombre ${nombre} no se pudo resolver` };
  }
  // Basta con que UNA de las direcciones caiga en un rango prohibido para rechazar el destino.
  const prohibidas = direcciones
    .map((direccion) => (isIP(direccion) === 6 ? `[${direccion}]:${puerto}` : `${direccion}:${puerto}`))
    .filter((destino, i) => !PERMITIDOS.has(destino) && privada(direcciones[i]));
  if (prohibidas.length > 0) {
    // Una dirección escrita por el cliente se repite tal cual (es suya). Un NOMBRE no enumera lo que resolvió:
    // la lista cambia según el sistema (macOS devuelve IPv6 e IPv4, Linux a veces solo IPv4) y revelarla
    // le da al cliente un mapa de la red interna. Para depurar, la dirección concreta (`prohibidas`) puede
    // registrarla el servidor en su bitácora; aquí no se imprime para que la salida de la matriz sea igual en todo sistema.
    if (isIP(nombre) !== 0) return { permitido: false, motivo: `${prohibidas.join(", ")}: dirección privada o reservada` };
    return { permitido: false, motivo: `${nombre} resuelve a una dirección privada o reservada` };
  }
  return { permitido: true };
}
```

It reads in the order of the `revisarDestino` function. First it attempts to parse the string into a URL; if it cannot, it is not a destination. Then it requires `http:` or `https:`: a `file:` or `ftp:` scheme has no business in a web service monitor. It calculates the port (the one in the URL or the protocol default) and strips square brackets from IPv6 (`[::1]` → `::1`). The `privada` function determines whether an address is private or reserved, doing so differently for each protocol for reasons explained below: for an IPv4 address it checks whether it falls within `IPV4_PROHIBIDAS`; for an IPv6 address, it first checks whether it embeds an IPv4 (the four formats in `EMBEBIDAS`, assisted by `grupos`, which splits an IPv6 into its eight 16-bit groups), and if not, whether it is in `IPV6_GLOBAL` and outside `IPV6_PROHIBIDAS`. If the hostname is already an IP address, it uses it directly; otherwise, it resolves it with `lookup(nombre, { all: true })`. Finally, it formats each destination as `address:port` and retains those that are **not** in the allowlist **and** that `privada` declares private or reserved. If any remain, the destination is rejected. The reason depends on how the destination was written: if it was an IP address, it repeats it, since the client provided it; if it was a hostname, it only states that it resolves to a private or reserved address, without enumerating which ones.

**A design decision: blocklist in IPv4, allowlist in IPv6.** There are two ways to write the rule. A **blocklist** names what is forbidden and accepts everything else; an **allowlist** names what is allowed and rejects everything else. An allowlist is safer, because whatever you forgot to name stays out, not in. But it can only be written if what is allowed fits in a few lines, and there the two protocols differ.

In **IPv6**, it fits in one line. All global unicast on the internet lives in a single block, `2000::/3`, which the [IANA IPv6 Address Space Registry](https://www.iana.org/assignments/ipv6-address-space/) marks as *Global Unicast*. The rule reads just as spoken: "only the internet is allowed." With it, loopback `::1`, the unspecified address `::`, unique locals `fc00::/7`, link-local `fe80::/10`, multicast `ff00::/8`, and any special block added tomorrow outside `2000::/3` are excluded in a single stroke, without listing them individually. Inside that block there are a few that are not on the public internet, and those are explicitly listed in `IPV6_PROHIBIDAS`: `2001::/23` (IETF protocol assignments, including Teredo), `2001:db8::/32` and `3fff::/20` (documentation), and `5f00::/16` (*segment routing*).

In **IPv4**, it does not fit. There is no "global" block that can be accepted wholesale: the global space is "everything except the special ranges," and an IPv4 allowlist would be the exact same blocklist written in reverse. That is why `IPV4_PROHIBIDAS` is a blocklist, copied row by row from the [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/), with each block's name in its comment so it can be audited against the registry:

| IPv4 Block | What it is | Where it is defined |
|---|---|---|
| `0.0.0.0/8` | "this host on this network" | [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html), foundation of the special-purpose registry |
| `10/8`, `172.16/12`, `192.168/16` | private networks | [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) |
| `100.64/10` | shared address space, or *CGNAT* (*Carrier-Grade NAT*: the address translation an internet provider uses to share one public address among many customers); Alibaba Cloud hosts its metadata at `100.100.100.200` | [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) |
| `127/8` | loopback, the local host | RFC 6890 |
| `169.254/16` | link-local; AWS and other clouds host their metadata at `169.254.169.254` | [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) |
| `192.0.0.0/24` | IETF protocol assignments | IANA registry |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | documentation (TEST-NET-1, 2, and 3) | IANA registry |
| `192.88.99.0/24` | former 6to4 relay anycast, deprecated | IANA registry |
| `198.18.0.0/15` | benchmarking | IANA registry |
| `224/4` | multicast, addresses targeting a group of hosts | [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) |
| `240/4` | reserved, including the broadcast address `255.255.255.255` | IANA registry |

The list deliberately over-blocks slightly: `192.0.0.0/24` and `2001::/23` are rejected in their entirety even though the registry marks certain specific addresses within them as global. They are protocol addresses for network infrastructure, not web services anyone wants to monitor, and a single-line rule is easier to audit than a per-address exception.

**The IPv4 that travels inside an IPv6.** Four IPv6 formats embed an IPv4 address, and in all four what matters is that embedded IPv4, so `destinos.ts` extracts it and evaluates it against the IPv4 list, **before** the allowlist:

| IPv6 Format | Where the IPv4 resides | Example |
|---|---|---|
| `::ffff:0:0/96`, IPv4-**mapped** ([RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html)) | in the lowest 32 bits | `[::ffff:127.0.0.1]` is `127.0.0.1` |
| `::/96`, IPv4-**compatible**, deprecated (RFC 4291) | in the lowest 32 bits | `[::7f00:1]` is `127.0.0.1`; `::1` and `::` yield `0.0.0.1` and `0.0.0.0` |
| `64:ff9b::/96`, **NAT64** ([RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html)) | in the lowest 32 bits | `[64:ff9b::a9fe:a9fe]` is `169.254.169.254` |
| `2002::/16`, **6to4** ([RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html)) | in bits 16 through 47 | `[2002:a9fe:a9fe::]` is `169.254.169.254` |

The order matters. 6to4 lives inside `2000::/3` and NAT64 lives outside, and both carry legitimate public addresses: `[64:ff9b::808:808]` and `[2002:808:808::1]` contain `8.8.8.8`, a public address, and must be allowed; the same formats embedding a private IPv4 must be rejected. Neither the allowlist alone nor blocking the entire prefix distinguishes the two cases. Extracting the IPv4 and evaluating it does.

It is not an exhaustive rule for everything non-public, but it covers what the [OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) lists as minimal requirements, and the fastest-growing part, IPv6, closes automatically. That the rule fits on a single screen and can be audited against a public registry is part of the defense: a rule nobody understands is a rule nobody reviews. And that it is never perfect is the reason for the second layer: the network layer.

#### 1.10.2 The rejection runs

Attempt to register the cloud metadata address:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada
```

`400`, with the reason: `169.254.169.254:80` is a private or reserved address. The `revisor` did not register it and will never connect to it. Now a hostname that looks harmless, pointing back to the `revisor` itself:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada
```

The same `400`, with a reason that reveals less than the previous one, on purpose. In the first case, the client provided the address itself, so echoing it back reveals nothing new. In the second, the client only knows the **hostname**; the addresses it resolved to are internal network details of the `revisor`, and the message does not disclose them. On macOS, `localhost` resolves to two addresses, `::1` and `127.0.0.1`, both loopback; on Linux, depending on how `/etc/hosts` is configured, it may resolve only to `127.0.0.1`. The response the client receives is identical on both systems, which is another advantage of not enumerating addresses: what the API returns does not depend on the server's operating system.

And the metadata address of another cloud, falling in the shared address space:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"metadatos-2","url":"http://100.100.100.200/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 100.100.100.200:80: dirección privada o reservada
```

Finally, the two sides of 6to4. `2002:a00:1::1` carries in bits 16 to 47 the groups `0a00` and `0001`, which is `10.0.0.1`, a private network; `2002:808:808::1` carries `0808` and `0808`, which is `8.8.8.8`, a public address:

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-1","url":"http://[2002:a00:1::1]/"}'
destino prohibido: [2002:a00:1::1]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-2","url":"http://[2002:808:808::1]/"}'
{"id":4,"nombre":"tunel-2","url":"http://[2002:808:808::1]/","limite_ms":2000}
 → 201
```

The first is rejected because of what it embeds, even though it lies within `2000::/3`; the second is accepted, even though a rule blocking 6to4 wholesale would have rejected it. The registration of the second created service 4, but the `revisor` did not connect to anything: the first connection will occur during the first check, and before that connection the destination will be validated again.

If the operator of the `revisor` needs the specific IP addresses to investigate a rejection, the place for them is the server log, never the response. The course's `revisor` logs them nowhere: the comment in `destinos.ts` notes where they would go, and its terminal displays nothing beyond the standard `POST /servicios`, so that the run is identical on every system.

#### 1.10.3 The second check, before connecting

You have already seen the first validation. The second is on the first line of `revisar`, in `cliente.ts`, and becomes visible when the rule changes between registration and check. The three startup services are registered directly in the store, bypassing registration validation, so it suffices to start the `revisor` with an allowlist that **excludes** the lab. Stop the `revisor` and start it like this (the `9` is an arbitrary port where nothing is running):

```text
$ REVISOR_DESTINOS=127.0.0.1:9 node servidor.ts
revisor en http://127.0.0.1:18080
```

And request a check for `catalogo` with the program from 1.6.4:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"CAIDO","codigo":null,"ms":null,"detalle":"destino prohibido: 127.0.0.1:18081: dirección privada o reservada"}
```

The service was registered, the check was accepted with its `202`, and its tracking resource worked, but the `revisor` **did not connect**: before doing so it re-evaluated the destination, and `127.0.0.1:18081` was no longer permitted. The result is `CAIDO`, with neither status code nor milliseconds, because no exchange occurred, and the detail explains why. In a real system, what changes between registration and check is not the allowlist, but what DNS returns for a hostname; the effect is the same, and this is why validation happens twice. Stop the `revisor` and start it again without the environment variable.

#### 1.10.4 A URL with secrets

There is another way for registration to leak something, and it has nothing to do with where the `revisor` connects, but with what it **repeats**. A URL can carry a credential inside it: `http://usuario:clave@servidor/estado` (the user and the password go before the at sign; [RFC 3986, section 3.2.1](https://www.rfc-editor.org/rfc/rfc3986#section-3.2.1), discourages that format for exactly this reason) or `http://servidor/estado?token=…` (a token in the query). The `revisor` stores the URL as it arrived and returns it in every representation of the service: in the `201` of the registration, in the lookup and in the list. If it accepted it, the password would reach anyone with read permission and every log or cache that stores those responses.

There are two ways out. One is to **redact**: store the full URL and return it without user, password, query or fragment. The other is to **reject it at registration**. The `revisor` rejects, because of what this lesson teaches about representations: what the `201` and the `200` return is *the* service, and a client can take that representation and send it back (Lesson 3 does so with `PUT`, which replaces the whole service). If the representation kept quiet about a part, whoever resent it would erase the token without knowing, and the representation would state an address different from the one the `revisor` checks. Rejecting keeps the rule simple: the `revisor` only stores what it can show in full. The fragment (`#…`) is rejected too, even though it is not a secret: it never travels to the server, so in a service URL it is useless.

The rule lives in `urlConSecretos`, in `servicios.ts`, and `darDeAlta` asks it before checking the destination. That is why the rejection is the same with the factory configuration: even though `127.0.0.1:1` is also a forbidden destination, the URL is rejected first for what it carries. The message says what is wrong and **does not repeat the URL**: repeating it in the error would hand the secret back through another door.

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"fuga","url":"http://usuario:clave@127.0.0.1:1/estado?token=SECRETO#x"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 66
Date: Thu, 22 Oct 2026 18:36:45 GMT
Connection: keep-alive
Keep-Alive: timeout=5

url no puede llevar usuario, clave, consulta (?) ni fragmento (#)
```

It is still a `400`, because in this lesson everything the `revisor` does not accept is one; Lesson 3 turns it into a `422`. If a service requires a credential to report its status, that credential does not go in the URL: a real revisor would store it separately, as a secret of its configuration, and send it in a header when checking. This `revisor` does not do that, on purpose: it only checks services that answer without a credential. The startup services do not go through registration, but their URLs are the laboratory's, with no user and no query. The test `herramientas/url-sembrada.ts` plants the URL `http://usuario:clave@127.0.0.1:1/estado?token=SECRETO#x` in each lesson's `revisor` and checks that it is rejected and that neither the responses nor the terminal repeat any of it.

### 1.11 Type checking with `tsc` (optional)

As in Lesson 0, Node runs programs without checking types, and the course verifies them with `tsc` in strict mode. From this lesson onward an additional flag is required, `--allowImportingTsExtensions`, because the `revisor`'s files import each other with the `.ts` extension; with `--noEmit`, TypeScript allows it. Inside `~/curso-http/revisor/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

If everything is correct, `tsc` prints nothing and exits with code 0, which is what it returned for all ten files in this lesson (the nine for the `revisor` and `fig01_02.ts`).

## The error you will see

**The registration that was lost without an error.** This is the one from the opening scene, and now you are going to trigger it. Send the same registration to both legacy routes, but this time with `-L`, so `curl` follows the redirect as a program would. Without `-X POST`: `-d` already implies `POST`, which is what any client would do. If you are coming from 1.10.3, you already restarted the `revisor` without the environment variable, so it has its three startup services. First, the route that moved with `301`:

```text
$ curl -i -L http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 275
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

Two responses. The first is the `301`. The second is a `200` with the list of services, and `avisos` is not in it. Read the `revisor`'s terminal, which is the only one that tells what happened:

```text
POST /viejo/servicios
GET /servicios
```

`curl` followed the `301`, as permitted by RFC 9110 and as stated in its manual: it converted `POST` into `GET` and dropped the body. The `revisor` received a query, responded with the list and an honest `200`, and nobody lied at any step. To whoever sent the registration, the outcome is a `200` and a service that does not exist. Now the route that moved with `308`:

```text
$ curl -i -L http://127.0.0.1:18080/api/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 308 Permanent Redirect
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-aacab17b"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

The `308` followed by a `201` with `Location: /servicios/4`. The `revisor`'s terminal:

```text
POST /api/servicios
POST /servicios
```

The `POST` arrived as a `POST`, with its body, and the registration occurred. To verify it in the simplest way, request the list:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 361
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

`avisos` is service 4. The one from the `301` exists nowhere.

**What is wrong and how to fix it.** Neither `curl`, nor the `revisor`, nor the person registering the service did anything wrong: each did what its specification allows. What is wrong is **the choice of status code** for a route that receives writes. The fix is choosing `308` (or `307`, if the move is temporary) for every legacy route that might receive anything other than `GET` or `HEAD`. And on the client side, there is an equally valuable lesson: a program that writes should not follow redirects blindly. If it receives a `301` to a `POST`, the proper action is to notify and update the configured URI, not follow it; [Lesson 7](07-quien-lee-el-error.md) places that decision in the client's decision table. `curl` has an option to preserve `POST` across a `301`, `--post301`, and Exercise 2 asks you to try it; it exists precisely because converting to `GET` is the default behavior. It is an option of `curl` and a few other clients: `fetch`, for example, has no equivalent and converts the `POST` into a `GET` after a `301` as the specification allows, so this cannot be fixed on the client side. The real fix is on the server: choose the code that leaves no room for doubt.

**A trap when reproducing it: `-X POST` with `-L`.** If out of habit you type `-X POST` in addition to `-d`, the result is different, and confusing at first glance:

```text
$ curl -i -X POST -L http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 21
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es JSON
```

`-X` does not tell `curl` "the first request is a `POST`", but rather "use `POST` on **all** requests," including the one following the redirect. The `curl` manual warns of this: with `-L`, the method specified by `-X` is used on every request and may have unexpected effects. `curl` followed the `301` with a `POST`, but applied the other half of the redirect rule and did not send the body. The `revisor` received an empty `POST /servicios` and responded `400 el cuerpo no es JSON`: neither reproducing the defect nor creating anything. (Without `-sS`, `curl` might also print a note indicating that `-X` is redundant.) To observe the defect as a program would, let `-d` determine the method.

**The non-existent method responds with `404`.** The other error in this lesson is the intentional defect. Request a method the route does not allow:

```text
$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta
```

The route `/servicios/1` exists: with `GET` it responds. With `PATCH`, the `revisor` says "no existe esa ruta", which is false. The correct code is `405 Method Not Allowed`, with the `Allow` header listing the allowed methods, and Lesson 0 taught you that `Allow` is mandatory on a `405`. A client receiving this `404` concludes it had the wrong address, when it actually had the wrong method. It is resolved by having `atender` distinguish the two cases, which is the very first thing Lesson 2 does.

## What gets done wrong

**Responding `200` to everything that succeeded.** A registration with `200` leaves the client without `Location`; an operation that is barely starting with `200` leads it to believe it has already finished; a withdrawal with `200` and `{"ok": true}` forces it to read a body that says nothing the code did not already convey. The four successes in this lesson exist so the client knows what to do without reading the body.

**A `201` without `Location`.** The RFC allows omitting it, in which case the created resource is the request URI itself. In a registration to `/servicios`, that is false: the service does not live there. The client is forced to guess the `id` from the body, using a field name that varies from API to API.

**A `202` without anywhere to ask.** Responding `202` without providing a tracking resource leaves the client with two bad options: assuming the operation occurred or repeating it. If the `202` does not include `Location` or a body explaining how to track it, half the response is missing.

**Polling the tracking resource without pause.** A client that asks five thousand times a second "is it finished yet?" turns an asynchronous operation into a denial-of-service attack against its own server. `Retry-After` exists for that reason; if missing, the client must apply a sensible minimum delay.

**`301` on a route that receives writes.** This is the headline error of this lesson: `POST` turns into `GET` and the body is dropped, without an error. For routes that accept writes, use `308`.

**A body in a `204` or `304`.** The RFC specifies that they cannot carry one. Node, in fact, does not transmit a body on those two codes even if you write one, but other servers do, and then the client parses that body as the beginning of the next response: the conversation becomes desynchronized and responses reach callers who did not request them. It is one of the few specification violations that is not merely unsightly, but actively corrupts the connection.

**A `304` without `ETag`.** The RFC requires a `304` to send the headers that would have accompanied a `200`, including `ETag`. Without it, the client has no way to confirm that its copy remains the current one.

**Connecting to a supplied URL without checking where it leads.** This is the doorway to SSRF. Inspecting the URL string is not enough: you must resolve the hostnames and inspect the IP addresses before each connection, and refuse to follow redirects.

## Exercises

All four are self-checking: each ends with a run that tells you if you got it right. Write your prediction in the [logbook](bitacora.md) **before** running anything. Start the lab and the `revisor` **only once**, before Exercise 1, and work through all four in succession: the service numbers in the solutions assume that order.

### Exercise 1 — Four conditions

Request `GET /servicios/1` with `curl -i` and note its `ETag`; in the solution it is `"1-1-0e296858"`, and yours will end differently. Predict what code the `revisor` returns for each of these requests:

1. `GET /servicios/1` with `If-None-Match: "1-1"`, the tag written by hand without the startup identifier.
2. `GET /servicios/1` with `If-None-Match: W/` followed by your tag.
3. `GET /servicios/1` with `If-None-Match: "9-9-00000000", W/"8-8-00000000"`.
4. `GET /servicios/99` with `If-None-Match: *`.

Run all four with `curl -s -o /dev/null -w '%{http_code}\n'` followed by the address and `-H 'If-None-Match: …'`, and compare.

### Exercise 2 — Preserving `POST` after a `301`

The "The error you will see" section mentions that `curl` has an option, `--post301`, that preserves `POST` when following a `301`. Predict what this request returns, how many status lines you will see, and what the `revisor`'s terminal logs:

```bash
curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
```

Run the command and compare. Then answer: if `curl` can do it, why does the section say the fix is changing the code rather than asking every client to use that flag?

### Exercise 3 — Five destinations

Predict which of these URLs the `revisor`'s registration accepts and, for those it rejects, what the reason states (all are written as addresses except the last, so the reason names the address):

1. `http://2130706433:18081/codigo/200`
2. `http://2130706433:18080/servicios`
3. `http://[::ffff:127.0.0.1]:18081/codigo/200`
4. `http://[64:ff9b::a9fe:a9fe]/`
5. `http://example.com/`

For each one, submit a registration with a different name (`d1` to `d5`) and check only the body and code, using `curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"…"}'`. The fifth requires your machine to have internet access to resolve the hostname.

### Exercise 4 — Tracking a check that never finishes

Copy `fig01_02.ts` as `ej4.ts` and change its ceiling from ten queries to two (`consulta <= 2`). Predict what `node ej4.ts 2` prints and with what exit code it terminates (`echo $?`). Then run it. Does the program distinguish between "the check finished" and "I gave up polling"? If not, what is it missing?

## Solutions

### Solution 1

```text
$ curl -i http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-0e296858"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1"'
200
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-0e296858"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", W/"8-8-00000000"'
200
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/99 -H 'If-None-Match: *'
404
```

`200`, `304`, `200`, and `404`. The first does not match because an entity tag is opaque: `"1-1"` is not a substring of `"1-1-0e296858"`, it is a different tag, and comparison is against the entire quoted string. (Before a restart, that is precisely the tag that would give a client the wrong copy; hence the startup identifier.) The second matches because `If-None-Match` performs a weak comparison, and `W/` does not prevent a match. The third is a valid list in which **no** tag matches, so the server returns the full response. The fourth is the trick question: `*` means "whichever version you have," but service 99 does not exist, so there is no version to confirm; the `revisor` looks it up before checking the condition and responds `404`. A `304` there would confirm to the client a copy of something that does not exist.

### Solution 2

```text
$ curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-0e296858"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Two status lines: the `301` and a `201`. In the `revisor`'s terminal, `POST /viejo/servicios` and then `POST /servicios`: with `--post301`, `curl` repeated the `POST` with its body at the new address and registration took place, with id 4 because it is the first registration of this startup. The option exists, but the fix remains the code, for a practical reason: you control your server, and you do not control clients. You can put `--post301` in your own scripts, but not in the application of whoever consumes your API, nor in their HTTP library, nor in their browser's `fetch`, which under the Fetch standard converts `POST` to `GET` with no option to prevent it. A `308` behaves consistently across all of them without asking anything from anyone.

### Solution 3

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"http://2130706433:18081/codigo/200"}'
{"id":5,"nombre":"d1","url":"http://2130706433:18081/codigo/200","limite_ms":2000}
 → 201
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d2","url":"http://2130706433:18080/servicios"}'
destino prohibido: 127.0.0.1:18080: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d3","url":"http://[::ffff:127.0.0.1]:18081/codigo/200"}'
destino prohibido: [::ffff:7f00:1]:18081: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d4","url":"http://[64:ff9b::a9fe:a9fe]/"}'
destino prohibido: [64:ff9b::a9fe:a9fe]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d5","url":"http://example.com/"}'
{"id":6,"nombre":"d5","url":"http://example.com/","limite_ms":2000}
 → 201
```

Two are accepted and three are rejected, and the first is the trick. `http://2130706433:18081/` **is accepted**: the URL parser normalizes `2130706433` to `127.0.0.1`, and `127.0.0.1:18081` is precisely the lab exception. The defense was not fooled by the unusual notation; on the contrary, it saw where it truly led, and that destination is permitted. With port 18080 it is rejected, and the reason states `127.0.0.1:18080`, not `2130706433`: the `revisor` evaluates the normalized address. The third is also loopback, written as an IPv4-mapped IPv6 address: the parser normalizes it to `::ffff:7f00:1`, which is not in the allowlist (the list performs exact string comparison), and `destinos.ts` extracts `127.0.0.1` from inside and recognizes it as loopback. The fourth is the IPv4 `169.254.169.254` concealed in the NAT64 prefix: on a network with NAT64 it would route to metadata, and is rejected because of what it embeds. The fifth resolves to public IP addresses and is accepted (if your machine has no internet access, it will be rejected with "no se pudo resolver", which is correct: what cannot be resolved cannot be checked). None of the registrations initiated a network connection: accepting the destination merely records it; the first connection occurs during the first check, and before that connection the destination is validated once again.

### Solution 4

```text
$ node ej4.ts 2; echo $?
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 pendiente, Retry-After: 1
0
```

With two queries, the program never observed `terminada`, printed the two `pendiente` lines, exited the loop without notice, and terminated with exit code 0—the same code as if everything had succeeded. (The second query arrives one second after the first, and the check waits one second in the queue: it is a race of milliseconds. If in your run the second query already found it finished, the check won the race; set the ceiling to one query and you will see the same defect.) This is the exercise's deliberate bug: the program does not distinguish between "it finished" and "I gave up polling." It lacks a statement after the loop that, if `terminada` was never seen, reports the failure and exits with a non-zero status code, such as `console.log("la revisión no terminó a tiempo"); process.exit(1);`, which requires tracking in a variable whether it finished. It is the same criterion from Lesson 0 applied on the client side: the process exit code is also a contract, and a `0` that does not indicate success deceives the script reading it just like a `200` with an error inside.

## How I know I got it

- [ ] With the lab and the `revisor` running, `curl -i http://127.0.0.1:18080/servicios` returns `200` with the three startup services.
- [ ] The registration in 1.5.2 returns `201` with `Location: /servicios/4` and an `ETag` of the form `"4-1-` followed by eight hexadecimal digits, and you can explain what each header and each part of the tag identifies.
- [ ] `-d 'null'` returns `400` with "el cuerpo no es un objeto JSON", and the subsequent request responds `200`.
- [ ] Requesting a check returns `202` with `Location: /revisiones/1`; querying it immediately returns `200` with `"pendiente"` and `Retry-After: 1`, and two seconds later, `"terminada"`. You can explain why the first code is `202` and the second `200`.
- [ ] `node fig01_02.ts 1` tracks the check to `ARRIBA` respecting `Retry-After`, across two or three queries.
- [ ] Withdrawing service 4 returns `204` with neither `Content-Type` nor `Content-Length`; requesting it afterward returns `404`, and you can explain why `DELETE` remains idempotent.
- [ ] `GET /servicios/1` with `If-None-Match` and the tag given by the `revisor` returns `304` with `ETag` and no body; with `W/` prepended, in a list, or with `*`, it also does. You know which headers a `304` must carry per RFC 9110.
- [ ] After restarting the `revisor`, the previous tag returns `200` with a new tag, and you can explain why that prevents a false `304`.
- [ ] With `curl -L`, registering at `/viejo/servicios` ends in a `200` with the list and the `revisor`'s terminal logs `GET /servicios`; registering at `/api/servicios` ends in a `201` and the terminal logs `POST /servicios`.
- [ ] The registrations in the callout return `400` with "destino prohibido", and you can explain in which case `localhost:18081` is rejected and in which case it is accepted, even though `127.0.0.1:18081` is always accepted.
- [ ] You can explain what DNS rebinding is, why validating before each connection does not fully eliminate it, and how the complete defense arriving in Lesson 8 works.
- [ ] Upon finishing, no program is left listening: `curl -i http://127.0.0.1:18080/` and `curl -i http://127.0.0.1:18081/` return error 7.

## Summary

Answer without looking at the lesson:

1. What three questions distinguish `200`, `201`, `202`, and `204`?
2. What does `Location` identify in a `201`? In a `202`? In a `301`?
3. Why should a `202` point to a tracking resource, according to RFC 9110? What code does that resource return while the operation is pending?
4. Why does the second `DELETE` of the same service return `404` while the method remains idempotent?
5. What is an `ETag`, what is `If-None-Match` used for, and why does a `304` carry no body? Why does the `revisor`'s tag change on every startup?
6. What happens to a `POST` that receives a `301` when followed by `curl -L`? What about one that receives a `308`? Why does that difference exist?
7. What is SSRF, why does the `revisor` carry it by design, and why does it validate the destination twice?
8. What is DNS rebinding, what does the `revisor` in this lesson do against it, and how is it completely resolved?

## Sources

All consulted on October 21, 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), sections 15.3.1, 15.3.2, 15.3.3, and 15.3.5: `200`, `201`, `202`, and `204`; the content of `200` depending on the method, `Location` and validators on `201`, the "intentionally noncommittal" `202` with its status monitor, and `204` which must not carry a body.
2. [RFC 9110, section 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4), and sections 15.4.2, 15.4.5, and 15.4.9: the history of `POST` converting to `GET`, `301`, `304` with the headers it must generate, and `308`.
3. [RFC 9110, sections 9.2.2, 9.3.3, and 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): idempotent methods, `201` with `Location` for a creating `POST`, and the three valid responses to a successful `DELETE`.
4. [RFC 9110, sections 8.6, 8.8.1, 8.8.3, 8.8.3.1, and 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3): `Content-Length` on `204` and `304`; a strong tag is not reused for another representation; `ETag` as an opaque quoted string and its example using a revision number; strong and weak comparisons.
5. [RFC 9110, sections 10.2.2, 10.2.3, and 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2): `Location` as a relative reference, `Retry-After`, and evaluation of `If-None-Match` (`*` or a list, weak comparison, `304` for `GET` and `HEAD`, `412` for others).
6. [RFC 7538, *The Hypertext Transfer Protocol Status Code 308 (Permanent Redirect)*](https://www.rfc-editor.org/rfc/rfc7538.html), April 2015, standardizing the `308` from [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) (June 2014, experimental), and the precaution regarding clients that do not recognize it (section 4).
7. [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/#http-redirect-fetch), *HTTP-redirect fetch* algorithm: following a `301` or `302` to a `POST`, the method changes to `GET` and the body is discarded.
8. [`curl` manual](https://curl.se/docs/manpage.html): `-L` and conversion of `POST` to `GET` after `301`, `302`, and `303`; `--post301`; `-d` and `-X`. Also verified in `man curl` version 8.7.1.
9. [2023 OWASP API Security Top 10: API7:2023 Server Side Request Forgery](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/): definition of SSRF, why webhooks and link previews make it common, and recommendations to disable redirect following and use allowlists.
10. [OWASP *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): cloud metadata as target, minimal range list (with multicast), alternative IPv4 encodings, DNS rebinding, and connecting to the already validated IP address.
11. [AWS, *Use the Instance Metadata Service to access instance metadata*](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) and [Alibaba Cloud, *View instance metadata*](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata): metadata addresses `169.254.169.254` (and `[fd00:ec2::254]`) and `100.100.100.200`.
12. [WHATWG URL Standard](https://url.spec.whatwg.org/#concept-ipv4-parser), IPv4 parser: accepts an address written as a single integer, in hexadecimal, or in octal, and normalizes it.
13. Address blocks in `destinos.ts`: IANA Special-Purpose Address Registries, [IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) and [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/), and the [IPv6 Address Space](https://www.iana.org/assignments/ipv6-address-space/) (`2000::/3`, *Global Unicast*); [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) (private networks), [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) (link-local `169.254/16`), [RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html) (link-local, multicast, and IPv4-mapped IPv6), [RFC 4193](https://www.rfc-editor.org/rfc/rfc4193.html) (unique local addresses), [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) (IPv4 multicast), [RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html) (NAT64 prefix), [RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html) (6to4, February 2001), [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) (shared space `100.64/10`), and [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html) (special-purpose address registries).
14. [Node.js 24: DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), [Node.js 24: Net](https://nodejs.org/docs/latest-v24.x/api/net.html), and [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): `dns.lookup` with `all: true` and its use of operating system resolution, `net.BlockList` and IPv4 addresses written as IPv6, and the `lookup` option of `http.request`.

### Terms in this lesson

| | |
|---|---|
| **DNS rebinding** | altering what a hostname resolves to between validation and connection, causing the server to connect to an unvalidated address |
| **weak comparison** | the comparison used by `If-None-Match`: two tags match if their quoted string is identical, whether they carry `W/` or not |
| **`ETag`** (*entity tag*) | opaque quoted string identifying a specific version of a resource |
| **startup identifier** | eight random hexadecimal digits drawn by the `revisor` at startup and appended to each tag, so that tags do not repeat after a restart |
| **idempotent** | a method whose effect on the server is the same whether executed once or repeatedly |
| **allowlist / blocklist** | a rule that explicitly names allowed items and rejects all others, or names forbidden items and accepts all others |
| **loopback** | the local machine's addresses: `127.0.0.0/8` and `::1` |
| **cloud metadata** | the service at `169.254.169.254` where a cloud provider publishes instance data, sometimes including credentials |
| **conditional request** | a request that specifies execution only if a condition on the resource version is met, such as `If-None-Match` |
| **tracking resource** | the resource pointed to by a `202`, where the client queries the progress of the operation |
| **relative reference** | a URI reference without scheme or authority, such as `/servicios/4`, resolved against the request URI |
| **SSRF** | inducing a server to make a request chosen by another person, originating from the server's own network |

---

**Next:** [Lesson 2 — The client made a mistake (I): 400, 401, 403, 404, 405, and 415](02-errores-del-cliente-peticion.md)

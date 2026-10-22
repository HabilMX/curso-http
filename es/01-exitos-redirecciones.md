# Lección 1 — Éxitos y redirecciones: 200, 201, 202, 204, 301, 308 y 304

Son las 11:20 de un martes y a las 12:00 hay una revisión con el equipo de operaciones. La pregunta que van a hacer es sencilla: ¿por qué el `revisor` no vigiló el servicio de cobros durante el fin de semana, si el viernes alguien lo dio de alta? Quien lo dio de alta jura que lo hizo. Tiene la captura de su terminal: mandó el alta y recibió un `200 OK`. Abres la lista de servicios del `revisor` y el de cobros no está. Abres el registro del servidor y ahí está su petición, completa, a las 18:42 del viernes. Solo que el registro no dice `POST /servicios`. Dice `POST /viejo/servicios` y, justo debajo, `GET /servicios`. El jueves alguien mudó las rutas viejas con una redirección. Su programa la siguió, como debía. Y en el camino, sin un solo error, el alta se convirtió en una consulta. Faltan cuarenta minutos para explicar por qué un `200` no significaba lo que todos creyeron.

Esta lección es sobre las respuestas que dicen «salió bien» y las que dicen «está en otra parte»: qué promete cada una, qué cabeceras la acompañan y cuál de ellas puede perder un `POST` sin avisar.

**Tiempo:** 2 × 45 min (el corte está entre las secciones 1.5 y 1.6)

**Qué construyes:** la primera versión del **`revisor`** como servidor: las rutas que dan de alta, consultan y retiran servicios, la que pide una revisión y la que permite seguirla, las rutas viejas que se redirigen, y la primera defensa contra que alguien use al `revisor` para llegar a donde no debe. Además, el **laboratorio**: el banco de pruebas de la Lección 0 en el puerto 18081, con los servicios que el `revisor` consulta

**Qué aprendes:** elegir entre devolver (`200`), crear (`201`), aceptar (`202`) y no devolver nada (`204`); para qué sirve `Location` en un `201`, en un `202` y en una redirección; **el `202` y su recurso de seguimiento**; qué cambia entre `301` y `308` cuando la petición es un `POST`; las peticiones condicionales con `ETag` e `If-None-Match`, y por qué un `304` no lleva cuerpo. Y en un recuadro de seguridad, qué es **SSRF** y por qué un programa como el `revisor` es el caso típico

**De dónde vienes.** De la [Lección 0](00-el-contrato-que-viaja.md) traes Node 24 y la carpeta `~/curso-http/`, el instrumento (`curl -i`, `curl -v`, `curl -I`), las cinco familias y la regla del `x00`, y el banco de pruebas `fig00_02.ts`, que responde el código que le pidas en `/codigo/NNN`. Traes también el primer criterio del curso: el código manda y el cuerpo explica. Todavía no hay `revisor`: en esta lección nace.

**Qué no hace esta lección.** No pide credenciales: cualquiera que llegue al puerto puede dar de alta y retirar servicios, y la [Lección 2](02-errores-del-cliente-peticion.md) pone la puerta. Tampoco permite cambiar un servicio ya registrado; eso necesita `If-Match` y es tema de la [Lección 3](03-errores-del-cliente-estado.md). Los errores que vas a ver aquí, un `400`, un `404` y un `413`, son una **red de seguridad**: están para que el `revisor` no responda `200` cuando algo sale mal, pero se explican a fondo en la Lección 2, y su cuerpo es una línea de texto hasta que la [Lección 5](05-problem-details.md) le dé formato. Y hay un defecto a propósito: un método que la ruta no admite responde `404` en lugar de `405`; la sección «El error que vas a ver» lo señala y la Lección 2 lo corrige.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS con Node 24.14.1 y curl 8.7.1, agregando `-sS` a cada `curl` porque la salida iba a un archivo (`-s` apaga el medidor de progreso, `-S` deja ver los errores, y ninguna de las dos cambia la respuesta). **Una advertencia sobre los puertos:** mientras se escribía esta lección, otras pruebas ocupaban el 18080 y el 18081 de la máquina, así que las corridas se hicieron con una copia de los programas idéntica salvo por los puertos, 18180 y 18181, y en las salidas pegadas aquí se volvieron a escribir 18080 y 18081, que son los que vas a teclear tú. Es lo único que se sustituyó; los dos números tienen las mismas cifras, así que ningún `Content-Length` cambia. En tu corrida cambian además la fecha de `Date`, los milisegundos (`"ms"`) que mide una revisión y **las etiquetas `ETag`**: el `revisor` sortea al arrancar ocho cifras hexadecimales que van al final de cada etiqueta (`"4-1-7b2497d9"`), así que las tuyas van a terminar distinto, y cambian cada vez que lo reinicias; la sección 1.8 explica por qué. Cuando un comando de la lección lleve una etiqueta, copia la que te dio tu respuesta anterior, no la de la lección. Las corridas se hicieron siguiendo la lección de principio a fin, en su orden, con los reinicios donde la lección los pide, así que los números de servicio y de revisión que veas son los que te van a salir. No se corrió en una instalación de escritorio de Mint. Los programas están en [`programas/01-exitos-redirecciones/`](../programas/01-exitos-redirecciones), en el repositorio del curso: el `revisor` en la carpeta `fig01_01/` y cada corrida en un archivo `.salida.txt`. Todos pasan `tsc` en modo estricto (la sección 1.11 dice cómo comprobarlo).

## Al terminar vas a poder

- Levantar el `revisor` y su laboratorio, y recorrer con `curl -i` el ciclo completo de un servicio: alta, consulta, revisión, retiro.
- Elegir entre `200`, `201`, `202` y `204` para una operación con tres preguntas, y justificar la elección con la sección del RFC 9110 que la define.
- Decir qué identifica `Location` en un `201`, en un `202` y en una redirección, y comprobarlo en una respuesta real.
- Seguir una operación aceptada con `202` hasta que termina, respetando `Retry-After`, sin martillar al servidor.
- Provocar un `304` con `If-None-Match`, explicar por qué no lleva cuerpo y qué cabeceras sí debe llevar.
- Demostrar con `curl -L` que un `301` puede convertir un `POST` en un `GET` sin ningún error, y que un `308` no.
- Explicar qué es SSRF, por qué el `revisor` lo trae de nacimiento y qué defensas tiene, incluida la que llega en la Lección 8.

## El porqué antes del cómo

En la Lección 0 viste que el código de estado es lo que leen todos los programas del camino. En las respuestas de error ese contrato se rompe de una forma que duele de inmediato: un `200` con un error dentro engaña a la caché y al monitor. En las respuestas de éxito el daño es más silencioso, porque todas dicen «salió bien», y la tentación es responder `200` siempre que no haya fallado nada. Pero los cuatro éxitos de esta lección no dicen lo mismo, y quien recibe la respuesta hace cosas distintas con cada uno:

- Un **`200`** dice «aquí está lo que pediste». El cliente usa el cuerpo.
- Un **`201`** dice «creé algo nuevo, y vive en esta dirección». El cliente guarda la dirección de `Location` para volver a ese recurso.
- Un **`202`** dice «lo recibí, pero todavía no lo hago». El cliente **no** puede dar la operación por terminada: tiene que volver a preguntar.
- Un **`204`** dice «listo, y no tengo nada que contarte». El cliente no espera cuerpo.

La diferencia entre el `201` y el `202` es la más cara de confundir. Si el `revisor` respondiera `200` o `201` a una revisión que apenas va a empezar, el cliente creería que la revisión ya terminó y leería un resultado que no existe. Si respondiera `200` a un alta, el cliente no tendría una forma estándar de saber dónde quedó el servicio nuevo.

Las redirecciones tienen su propia trampa, que es la de la escena del principio. Mudar una ruta es normal: las APIs crecen y los nombres cambian. Pero hay dos códigos para «esto se mudó para siempre», el `301` y el `308`, y por razones históricas solo uno de ellos promete que el `POST` seguirá siendo `POST` al otro lado. Con el otro, el cliente tiene permiso de convertirlo en `GET`, y casi todos lo hacen. El alta se pierde, la respuesta final es un `200` con la lista, y nadie ve un error porque no lo hubo.

Y el `304` cierra la lección con la idea contraria al `200`: a veces la mejor respuesta es **no mandar nada**, porque el cliente ya lo tiene. Para eso existen las etiquetas (`ETag`) y las peticiones condicionales, que en la Lección 3 van a servir también para algo mucho más serio: que dos personas no se pisen al cambiar el mismo servicio.

La lección tiene cinco partes:

1. **El `revisor` toma forma** (1.1 a 1.3): los archivos, el almacén, las tres formas de responder y la tabla de rutas.
2. **Devolver y crear** (1.4 y 1.5): `200` y `201`, con `Location` y `ETag`.
3. **Aceptar y no devolver nada** (1.6 y 1.7): `202` con su recurso de seguimiento, y `204`.
4. **No mandar lo que ya tienes, y mudarse** (1.8 y 1.9): `304` con `If-None-Match`, y `301` frente a `308`.
5. **El recuadro de seguridad** (1.10): SSRF, la excepción del laboratorio y el límite que queda declarado.

Al final de la lección, esta corrida te va a parecer obvia. Son dos peticiones idénticas salvo por la ruta vieja que usan; el `revisor` registró esto en su terminal:

```text
POST /viejo/servicios
GET /servicios
POST /api/servicios
POST /servicios
```

La primera alta se perdió. La segunda ocurrió. Lo único que cambió fue el código de la redirección.

## Los conceptos

### 1.1 El `revisor` toma forma

#### 1.1.1 Nueve archivos y una carpeta

Desde esta lección el `revisor` deja de ser un programa de un archivo. Es un programa de varios, cada uno con una responsabilidad, y crece de lección en lección: la Lección 2 le agrega la puerta, la 3 el cambio de servicios, la 4 la defensa contra fallas, y así hasta la 8. Los nueve archivos de hoy son estos:

| Archivo | Qué hace |
|---|---|
| `servidor.ts` | arranca el servidor en el puerto 18080 |
| `rutas.ts` | decide qué función atiende cada ruta y cada método; aquí viven las redirecciones |
| `servicios.ts` | lo que hace cada ruta: listar, dar de alta, consultar, retirar, pedir y seguir una revisión |
| `almacen.ts` | los servicios y las revisiones, en memoria, y la etiqueta (`ETag`) de cada servicio |
| `etiquetas.ts` | leer y comparar etiquetas como pide el RFC 9110; la usa la sección 1.8 |
| `respuestas.ts` | las tres formas de responder: con JSON, sin cuerpo y con un error |
| `cliente.ts` | la cara cliente: consulta un servicio y clasifica lo que respondió |
| `destinos.ts` | a dónde puede conectarse el `revisor`; es el tema del recuadro de seguridad |
| `laboratorio.ts` | el banco de la Lección 0 en el puerto 18081: los servicios que el `revisor` consulta |

En el repositorio están en la carpeta `fig01_01/`, y cada bloque de código de esta lección empieza con la ruta del archivo (`// fig01_01/servidor.ts`), igual que en el curso de TypeScript de esta casa. Tú puedes guardarlos donde quieras; aquí se supone una carpeta `~/curso-http/revisor/` con su propio `package.json`, el mismo de la Lección 0:

```bash
mkdir -p ~/curso-http/revisor && cd ~/curso-http/revisor
printf '{\n  "type": "module"\n}\n' > package.json
```

Los archivos se importan entre sí con la extensión `.ts` escrita completa (`import { atender } from "./rutas.ts"`). Es lo que exige Node cuando ejecuta TypeScript quitando los tipos: no adivina extensiones, igual que no las adivina para JavaScript en un módulo ESM.

#### 1.1.2 El servidor

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

Es casi el servidor de la Lección 0, con una diferencia: ya no decide nada. Recibe cada petición y se la pasa a `atender`, que vive en `rutas.ts`, a través de `atenderSinCaerse`. El `void` delante de la llamada dice «sé que esta función devuelve una promesa y a propósito no la espero aquí»: el servidor no tiene nada que hacer cuando la respuesta termina.

Ese `void` tiene un costo, y `atenderSinCaerse` existe para pagarlo. Una promesa que nadie espera y que falla es una **promesa rechazada sin atender**, y Node, por omisión, termina el proceso cuando ve una. Si un manejador tuviera un error que lanza una excepción, una sola petición apagaría el `revisor` para todos. `atenderSinCaerse` envuelve `atender` en un `try`/`catch`: si algo se escapa, escribe el mensaje en la terminal, responde `500 error interno` sin dar detalles y el proceso sigue vivo. Es una red, no un diseño: la [Lección 4](04-capacidad-y-fallas-del-servidor.md) explica el `500` a fondo y qué se dice y qué no se dice en él. Hoy basta con saber que está ahí, y en 1.5.2 vas a ver la petición que habría tumbado al `revisor` si nadie la detuviera antes.

#### 1.1.3 El laboratorio

El `revisor` vigila servicios, y para practicar hace falta tener servicios que vigilar. El laboratorio es el banco de pruebas de la Lección 0 sin cambios de fondo: la misma tabla de nombres, las mismas cabeceras por código, las mismas tres puertas. Cambian el puerto, 18081, para que conviva con el `revisor` en el 18080, y el mensaje de arranque:

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

Los tres servicios con los que arranca el `revisor` apuntan aquí: `catalogo` a `/codigo/200`, `pagos` a `/codigo/503` y `nomina` a `/codigo/200`. Si quieres que un servicio «se caiga», no hace falta tocar nada: da de alta uno que apunte a `/codigo/503`.

#### 1.1.4 Arrancar los dos

Cada lección del curso que use el `revisor` necesita dos terminales con servidores y una tercera para `curl`. En la primera:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

En la segunda:

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Deja las dos abiertas. La terminal del `revisor` va a ir anotando cada petición que recibe (`GET /servicios`, `POST /servicios`…), y esa lista es tan importante como lo que imprime `curl`: en la sección «El error que vas a ver» es la única que cuenta la verdad completa.

Antes de leer los archivos uno por uno, comprueba que el `revisor` ya contesta. Si todavía no los escribiste, cópialos de `programas/01-exitos-redirecciones/fig01_01/`, en el repositorio del curso, y arráncalos; las secciones que siguen explican qué produjo cada respuesta. En la tercera terminal:

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

Un `200` con la lista de los tres servicios de arranque, su `Content-Type` y su `Content-Length`. Nada que no conocieras de la Lección 0, salvo que ahora la lista es de verdad. La sección 1.4 explica qué la produjo.

### 1.2 Guardar y responder

#### 1.2.1 El almacén

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

El almacén guarda dos cosas en memoria, en dos `Map`: los **servicios** y las **revisiones**. Al detener el `revisor` se pierde todo, a propósito: cada corrida empieza con los mismos tres servicios de arranque, y así lo que ves en tu terminal coincide con lo que dice la lección. Un servicio tiene su `id`, su `nombre`, la `url` que se consulta, el `limiteMs` (cuánto se espera la respuesta antes de darlo por caído), el `equipo` al que pertenece, que la Lección 2 va a usar para decidir quién ve qué, y una `version`.

La `version` es la pieza que hace funcionar la sección 1.8. La función `etiqueta` arma un texto entre comillas con tres partes, `"4-1-7b2497d9"`: el `id`, la `version` y un **identificador de arranque**. Ese texto es la **etiqueta de entidad** (*entity tag*, la `ETag`) del servicio. Hoy ningún servicio cambia, así que la versión siempre es 1; en la Lección 3, cada cambio la sube y la etiqueta cambia con ella. Las comillas no son decoración: el [RFC 9110, sección 8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3), define la etiqueta como un texto **opaco entre comillas dobles**, y dice que para el cliente es opaca: no tiene que saber cómo se construyó, solo compararla. La [sección 8.8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.1) pone como ejemplo justo lo que hace el `revisor`, usar un número de revisión interno.

¿Y el identificador de arranque? Son 4 bytes al azar (`randomBytes(4)`, ocho cifras hexadecimales) que `almacen.ts` sortea una vez, al arrancar. Existen por una regla del [RFC 9110, sección 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1): una etiqueta fuerte es única entre todas las versiones de todas las representaciones de un recurso **a lo largo del tiempo**. El almacén vive en memoria, y al reiniciar el `revisor` los `id` y las versiones vuelven a empezar. Sin el identificador, el servicio 4 de antes de un reinicio y el servicio 4 de después, que puede ser otro, tendrían la misma etiqueta `"4-1"`, y un cliente que guardó el primero recibiría la confirmación de que su copia vieja sigue vigente. Con el identificador, una etiqueta de un arranque no coincide con las de otro en la práctica (son 4 bytes al azar: una probabilidad de una en 4 295 millones por cada arranque anterior, nunca una garantía matemática), sin guardar nada en disco. Por eso las etiquetas de tu corrida terminan distinto que las de la lección.

Las revisiones son más simples: un `id`, el servicio revisado, un `estado` que empieza en `"pendiente"` y pasa a `"terminada"`, y un `resultado` que vale `null` hasta que la revisión termina.

#### 1.2.2 Las tres formas de responder

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

El `revisor` responde de tres formas, y cada una vive en una función, para que ninguna ruta tenga que acordarse de los detalles:

- **`enviarJson`** responde con un cuerpo JSON. Calcula `Content-Length` en bytes, como en la Lección 0, y pone `Content-Type: application/json`. Es la que usan `200`, `201` y `202`.
- **`enviarVacio`** responde sin cuerpo: para `204`, `304` y las redirecciones. Tiene una regla que merece explicación: a `204` y `304` no les pone `Content-Length`, y a los demás les pone `Content-Length: 0`. La razón está en el [RFC 9110, sección 8.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6): un servidor **no debe** mandar `Content-Length` en un `204`, y en un `304` solo puede mandarlo si dice lo mismo que habría dicho el `200`, que sería el tamaño del cuerpo que no se manda. Una redirección sí puede llevar cuerpo, y por eso dice explícitamente que mide cero.
- **`fallar`** responde un error con una línea de texto. Es provisional: la Lección 5 la reemplaza por los *Problem Details* del RFC 9457, y ese cambio es justo el contenido de esa lección.

Las tres pasan por `escribirCabecera`, que corrige un detalle que ya viste en la Lección 0: Node llama a dos códigos con sus nombres viejos, así que para el `413` y el `422` el `revisor` pone las frases del registro de la IANA.

`leerCuerpo` junta los trozos del cuerpo de una petición y los convierte en texto. Un cuerpo llega por la red en pedazos, y la petición de Node es un flujo que se puede recorrer con `for await`; hasta que llega el último pedazo no hay cuerpo completo que leer. Y lee **como máximo 16 KiB** (`TOPE_CUERPO`, 16384 bytes). Un servicio es un nombre corto (el modelo del curso lo prevé de hasta 40 caracteres), una URL y un número, y cabe de sobra. Ojo con lo que esa frase no promete: en esta lección el `revisor` solo comprueba que `nombre` y `url` sean texto; el largo del nombre y el resto de las reglas de contenido llegan con la validación de la [Lección 3](03-errores-del-cliente-estado.md), y lo único que acota hoy el tamaño es el tope del cuerpo. Sin tope, quien alcance el `revisor` podría mandar un cuerpo gigante, o muchos a la vez, para llenarle la memoria. Por eso `leerCuerpo` no junta trozos a ciegas: si `Content-Length` ya anuncia más del tope, rechaza sin guardar nada; si el cuerpo llega por partes, sin anunciar su tamaño, cuenta los bytes mientras llegan y deja de guardar en cuanto se pasa. En los dos casos avisa con `CuerpoDemasiadoGrande` y prepara un **cierre en etapas** (RFC 9112, sección 9.6): el `413` sale de inmediato, con `Connection: close`; la conexión se cierra solo de escritura (media cerrada), el `revisor` sigue leyendo y tirando lo que el cliente alcance a mandar y, si el cliente no cierra su lado en 2 segundos, la destruye. Si cerrara de golpe con el cliente todavía mandando, el sistema operativo contestaría con un RST que puede borrar el `413` antes de que el cliente lo lea. Quien leía responde `413 Content Too Large`. La Lección 2 explica el `413` a fondo; aquí basta con saber que está y verlo una vez, en 1.5.2.

### 1.3 La tabla de rutas

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

`rutas.ts` contesta una sola pregunta: ¿qué función atiende esta petición? La tabla `RUTAS` tiene un renglón por ruta, con una expresión regular que reconoce la ruta y, adentro, los métodos que admite. Los paréntesis de la expresión (`(\d+)`) capturan el número del servicio o de la revisión, y llegan a la función como `parametros`.

`atender` hace cuatro cosas en orden. Anota en la terminal el método y la ruta. Revisa si es una ruta vieja que se mudó, con `redirigir`, que la sección 1.9 explica. Trata `HEAD` como si fuera `GET`: la función que atiende es la misma, y Node, que sabe que la petición era `HEAD`, no manda el cuerpo; lo viste en la Lección 0 con `curl -I`. Y recorre la tabla hasta encontrar una ruta que coincida **y** tenga una función para ese método. Esa última pregunta se hace con `Object.hasOwn(ruta.metodos, metodo)`, no con `ruta.metodos[metodo]` a secas, y la razón es de seguridad: el método lo escribe el cliente, y un objeto de JavaScript también «tiene» lo que hereda (`constructor`, `toString`…). Con la búsqueda ingenua, un cliente que mande el método `constructor` encontraría una función que nadie escribió para atenderlo; con `Object.hasOwn`, solo cuentan los métodos que la tabla declara, y `constructor` recibe el mismo `404` que cualquier otro método desconocido.

Si no encuentra ninguna, responde `404` con «no existe esa ruta». Fíjate en el comentario de esa última línea: el `revisor` todavía no distingue entre «esa ruta no existe» y «esa ruta existe, pero no con ese método». Son dos respuestas distintas, `404` y `405`, y la segunda exige la cabecera `Allow`. Es el defecto a propósito de esta lección, y lo vas a ver en «El error que vas a ver».

### 1.4 `200`: devolver lo que se pidió

#### 1.4.1 La pregunta que decide

El `200 OK` es el éxito más conocido, y el RFC 9110 lo define en su [sección 15.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1) con una idea que conviene leer despacio: el contenido de un `200` **depende del método**. A un `GET` se le devuelve una representación del recurso; a un `POST`, el estado o el resultado de la acción; a un `PUT` o un `DELETE`, el estado de la acción. Es decir, el `200` no dice «todo bien» en abstracto: dice «aquí está el cuerpo que corresponde a lo que pediste».

De ahí sale la pregunta que decide: **¿hay algo que devolver, y es lo que se pidió?** Si sí, `200`. Si la operación creó algo nuevo, hay un código más preciso (`201`). Si todavía no terminó, otro (`202`). Si terminó y no hay nada que contar, otro (`204`). El `200` es lo que queda cuando ninguno de los tres más precisos aplica.

La misma sección agrega dos detalles. Un `200` a un `GET` o un `HEAD` **debería** mandar los validadores disponibles, como la `ETag`, y el `revisor` lo hace en la consulta de un servicio. Y un `200` **se espera que lleve contenido**, salvo que el encuadre del mensaje diga explícitamente que mide cero (`Content-Length: 0`); si algo en la petición indica que el cliente prefiere no recibir contenido, el RFC sugiere un `204` en su lugar.

#### 1.4.2 En el `revisor`

Las dos rutas que devuelven con `200` son `listar` y `consultar`, en `servicios.ts`. Este es el archivo completo, porque todas las secciones que siguen lo van a usar:

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

`listar` es la más simple de toda la API: arma `{"servicios": […]}` con la representación de cada servicio y responde `200`. Fíjate en `representar`: el almacén guarda `limiteMs`, pero la API lo expone como `limite_ms`, y no expone `equipo` ni `version`. La representación es una decisión de diseño, separada de cómo se guardan los datos: el día que el almacén cambie, la API puede seguir diciendo lo mismo. Los campos van en `snake_case` porque así quedan en todo el curso, y lo que importa es que no cambien de una ruta a otra.

La respuesta de `listar` es la que viste en 1.1.4: `{"servicios": […]}` con los tres servicios de arranque y un `200`. `consultar`, la otra ruta del `200`, aparece en 1.5.2 y se completa en 1.8, porque es la que entiende las etiquetas.

### 1.5 `201`: crear, y decir dónde quedó

#### 1.5.1 La pregunta que decide

El [RFC 9110, sección 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2), define el `201 Created` así: la petición se cumplió y **creó uno o más recursos nuevos**. Y dice cómo se identifica el recurso principal: por la cabecera `Location` de la respuesta o, si no viene, por la propia ruta de la petición. Esa segunda opción importa poco en un alta como la del `revisor`, porque la petición fue a `/servicios` y el servicio nuevo no vive en `/servicios`, sino en `/servicios/4`. Por eso, para un `POST` que crea algo, la [sección 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3) es más directa: el servidor **debería** responder `201` con un `Location` que identifique el recurso creado.

La pregunta que decide: **¿esta petición creó algo que antes no existía y que tiene su propia dirección?** Si sí, `201` con `Location`. Si el `POST` hizo otra cosa (procesar, calcular, enviar), no hay recurso nuevo que señalar y el `201` miente.

La misma sección 15.3.2 permite que el `201` lleve validadores, y dice qué significan: son los del recurso recién creado. Por eso el `revisor` manda la `ETag` del servicio nuevo junto con `Location`. Quien da de alta ya tiene, desde la primera respuesta, la etiqueta que necesitaría para una petición condicional como las de la sección 1.8.

#### 1.5.2 En el `revisor`

`darDeAlta` lee el cuerpo, con el tope de 16 KiB de 1.2.2, y hace cinco preguntas en orden: ¿es JSON?, ¿es un **objeto** JSON?, ¿trae `nombre` y `url` como textos?, ¿`limite_ms`, si viene, es un entero razonable?, ¿la URL es un destino permitido? (la sección 1.10 dice por qué). Si todo pasa, crea el servicio y responde `201` con dos cabeceras: `Location`, con la dirección del servicio nuevo, y `ETag`, con su etiqueta. El cuerpo es la representación del servicio nuevo, la misma que devolvería un `GET` a esa dirección; el RFC dice que el cuerpo de un `201` normalmente describe el recurso creado y enlaza a él.

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

`-X POST` le dice a `curl` qué método usar, `-H` agrega la cabecera `Content-Type` y `-d` manda el cuerpo. El servicio se llama `inventario`, apunta al laboratorio y no trae `limite_ms`, así que el `revisor` le puso el de omisión, 2000. Es el servicio 4 porque los tres de arranque ocupan el 1, el 2 y el 3, y su etiqueta es `"4-1-7b2497d9"`: servicio 4, versión 1, y el identificador de este arranque (el tuyo será otro).

Ahora sigue la dirección de `Location`:

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

El mismo cuerpo, la misma `ETag`. `Location` es una **referencia relativa**, `/servicios/4`, sin servidor ni puerto. El [RFC 9110, sección 10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2), lo permite: si el valor es relativo, se completa con la dirección de la petición original. Es lo mismo que hace `curl` cuando sigue una redirección relativa, y lo que hace `new URL(location, base)` en un programa, como vas a ver en la sección 1.6.

`limite_ms` tiene un rango, de 100 a 10000 milisegundos. Sin él, alguien podría registrar un servicio con un límite de una hora, y cada revisión dejaría al `revisor` esperando una hora a un servicio que no responde; con un límite de cero, lo daría por caído sin haberlo consultado. Fuera del rango, el alta no se hace:

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

Ese `400` es parte de la red de seguridad de la que habla «Qué no hace esta lección»: el `revisor` no crea un servicio con datos que no puede cumplir, y no responde `200` cuando no hizo nada. Si estás pensando que «se puede leer pero no se puede cumplir» suena más a `422` que a `400`, tienes razón, y es exactamente la política que la Lección 3 escribe. Por ahora, el `revisor` no tiene `422`.

Queda la segunda pregunta de la lista, la que parece de más: ¿es un **objeto** JSON? `null` es JSON válido, igual que `7`, `"texto"` o `[]`, y `JSON.parse` los acepta sin quejarse. Pero ninguno trae campos, y leer `datos.nombre` sobre `null` lanza un `TypeError`. Sin esa pregunta, y sin la red de `servidor.ts`, esta petición tumbaba el `revisor` para todos, con un solo `curl` y sin credencial. Con la pregunta:

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

`400` con el motivo, y la petición siguiente responde `200`: el `revisor` sigue en pie. La pregunta y la red no son lo mismo. La pregunta convierte un cuerpo inservible en un `400` que le dice al cliente qué corregir; la red atrapa lo que nadie previó y lo convierte en un `500`, que no le dice al cliente nada útil. La pregunta es lo correcto; la red es el seguro para lo que se escape.

Antes de esas cinco preguntas está el tope. Un cuerpo de 20000 bytes, más que los 16384 que acepta el `revisor`:

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

`413`, con `Connection: close`, sin que el `revisor` guardara un solo byte del cuerpo: `Content-Length` anunciaba 20000 y bastó con leer la cabecera. La petición siguiente responde `200`. `head -c 20000 /dev/zero` produce 20000 bytes en cero, y `--data-binary @-` le dice a `curl` que mande como cuerpo, tal cual, lo que le llega por la tubería.

> **Corte de la sesión.** Si tomas la lección en dos sesiones de 45 minutos, este es el lugar. Detén el `revisor` y el laboratorio con `Ctrl`+`C`. Al volver, arranca los dos y da de alta otra vez el servicio `inventario` con el `curl` de 1.5.2: como el almacén vive en memoria, al reiniciar se pierde, y la sección 1.7 retira el servicio 4. Si tomas la lección de corrido, haz lo mismo: detén los dos, arráncalos y repite el alta, para que tus números coincidan con los de la lección. La respuesta es la misma de 1.5.2 salvo la etiqueta, porque es otro arranque:

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

### 1.6 `202`: aceptado, todavía no hecho

#### 1.6.1 La pregunta que decide

Pedir una revisión no se resuelve en el momento. El `revisor` tiene que consultar el servicio, y un servicio lento puede tardar segundos en contestar; en un sistema real, las revisiones esperan su turno en una cola. Mantener la conexión abierta mientras tanto sería mala idea: el cliente se queda colgado, y si se corta la conexión no sabe si la revisión se hizo.

Para eso existe el `202 Accepted`. El [RFC 9110, sección 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3), lo define con una franqueza poco común: la petición se aceptó para procesarse, pero **el procesamiento no ha terminado**, y quizá nunca se haga, porque puede rechazarse cuando llegue su turno. Dice que el `202` es «intencionalmente evasivo» (*intentionally noncommittal*). Y agrega que en HTTP no hay forma de que el servidor mande después otro código de estado para la misma petición: la respuesta ya se dio. Por eso termina con una recomendación que es la mitad de esta sección: la representación del `202` **debería** describir el estado actual de la petición y apuntar a un **monitor de estado** (*status monitor*) donde el cliente pueda ver cuándo se cumple.

La pregunta que decide: **¿la operación va a terminar después de que yo responda?** Si sí, `202`, y nunca `200` ni `201`, porque los dos le dicen al cliente que ya terminó.

#### 1.6.2 El recurso de seguimiento

En el `revisor`, ese monitor de estado es un recurso propio: cada revisión vive en `/revisiones/{id}`. `pedirRevision` crea la revisión en estado `pendiente`, la programa para dentro de un segundo con `setTimeout` (el segundo de «espera en la cola», que hace visible el estado pendiente) y responde `202` con dos cosas: un cuerpo que describe el estado actual y un `Location` que apunta a la revisión. Es la misma cabecera del `201`, con otro significado: en un `201` señala lo que se creó, y en un `202` señala dónde preguntar.

`consultarRevision` responde `200` con el estado de la revisión. Mientras está pendiente, agrega `Retry-After: 1`. El [RFC 9110, sección 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), define `Retry-After` como el tiempo que el cliente debería esperar antes de su siguiente petición, en segundos o con una fecha; el RFC lo describe para el `503` y las redirecciones, y en un recurso de seguimiento cumple el mismo papel: «no vuelvas antes de un segundo». Que el `revisor` lo use aquí es una decisión de diseño, no una norma; la norma solo define qué significa la cabecera.

Pide una revisión del servicio 2, `pagos`, que apunta a `/codigo/503`:

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

Y enseguida, sin esperar, sigue el `Location`:

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

`200`, porque la consulta del seguimiento sí salió bien: aquí está lo que pediste, el estado de la revisión. El estado es `pendiente`, y `Retry-After: 1` dice cuándo volver. Ese es un punto que confunde al principio: **el `202` describe la petición de revisión; el `200` describe la consulta del seguimiento**. Son dos peticiones distintas, cada una con su código.

Dos segundos después:

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

Terminada. El resultado dice que `pagos` está `CAIDO`, con el código `503` que respondió el laboratorio y los milisegundos que tardó (en tu corrida, otro número). Ya no viene `Retry-After`, porque no hay nada que esperar.

#### 1.6.3 La cara cliente

¿Quién consultó a `pagos`? La cara cliente del `revisor`:

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

`revisar` recibe la URL y el límite. Lo primero que hace es volver a revisar el destino (la sección 1.10 dice por qué antes de **cada** conexión). Después mide el tiempo con `performance.now()`, consulta con `fetch` y clasifica. Si el código es `400` o más, `CAIDO`. Si no, `LENTO` si tardó la mitad del límite o más, y `ARRIBA` si tardó menos. Si `fetch` no obtuvo respuesta, `CAIDO` con un detalle que distingue «se acabó el tiempo» de «no hubo conexión»; es la distinción entre el error 7 de `curl` y una respuesta HTTP, que viste al final de la Lección 0.

Tres detalles del `fetch`. `AbortSignal.timeout(limiteMs)` corta la consulta si pasa del límite. `respuesta.body?.cancel()` descarta el cuerpo sin leerlo, porque para clasificar solo importa el número: es el criterio «el código manda» aplicado del lado del que lee. Y `redirect: "manual"` le dice a `fetch` que **no siga** las redirecciones: si un servicio responde `301`, el `revisor` anota el `301` y no va a donde dice `Location`. Esa decisión tiene una razón de seguridad, y la vas a ver en el recuadro.

#### 1.6.4 Un cliente que sabe esperar

Con `curl` seguiste el `202` a mano. Un programa tiene que hacerlo solo, y la tentación es consultar en un ciclo sin pausa hasta que diga `terminada`. Este programa lo hace como se debe. Guárdalo como `~/curso-http/revisor/fig01_02.ts`:

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

Lee la respuesta del `202` y saca el `Location`; si el código no es `202` o falta la cabecera, se detiene, porque no sabría dónde preguntar. Después consulta el seguimiento: `new URL(seguimiento, BASE)` completa la referencia relativa con el servidor y el puerto, como dice el RFC. En cada vuelta imprime el estado y, si viene, `Retry-After`. Cuando la revisión termina, imprime el resultado y sale. Si no, espera lo que pidió el servidor, **acotado entre 1 y 5 segundos**, y vuelve a preguntar. Las dos cotas son decisiones del cliente, no del RFC: la de abajo evita martillar al servidor si `Retry-After` falta o no es un número, y la de arriba evita que un servidor equivocado lo deje dormido una hora. La [Lección 6](06-reintentos-idempotencia.md) vuelve sobre esa segunda cota, y la [Lección 7](07-quien-lee-el-error.md) sobre qué hacer cuando el servidor pide esperar más de lo que estás dispuesto. El ciclo tiene además un tope de diez consultas, para que un seguimiento que nunca termina no deje el programa corriendo para siempre.

Con el laboratorio y el `revisor` corriendo, pide una revisión del servicio 1, `catalogo`:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/2
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"ARRIBA","codigo":200,"ms":1,"detalle":"200"}
```

Dos consultas. La primera encontró la revisión pendiente y obedeció el `Retry-After`; la segunda, un segundo después, la encontró terminada: `catalogo` está `ARRIBA`. En la terminal del `revisor` quedaron tres renglones, el `POST` y los dos `GET`. Cuenta las consultas que hizo tu programa: si fueron cinco mil, falta la pausa.

### 1.7 `204`: listo, y no hay nada que contar

#### 1.7.1 La pregunta que decide

El [RFC 9110, sección 15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5), define el `204 No Content`: el servidor cumplió la petición y **no tiene contenido adicional** que mandar. Y es tajante con la forma: un `204` termina con la última cabecera, y **no puede** llevar cuerpo.

La pregunta que decide: **¿la operación terminó y no hay nada útil que contar?** Un retiro es el caso de libro. Para un `DELETE` exitoso, la [sección 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.5) da exactamente tres opciones: `202` si la acción probablemente va a ocurrir pero todavía no ocurrió, `204` si ya ocurrió y no hay más información, y `200` si ya ocurrió y la respuesta trae una representación del estado. El `revisor` retira en el momento y no tiene nada que contar, así que responde `204`.

¿Y por qué no `200` con un cuerpo vacío, o con `{"ok": true}`? Porque el `204` le dice a cualquier programa, sin leer nada, que no hay cuerpo que esperar. Un `200` con `{"ok": true}` obliga al cliente a leer el cuerpo para enterarse de algo que el código ya decía. Y un `200` vacío es válido si declara `Content-Length: 0`, pero obliga al cliente a mirar el largo para saber que no hay nada, cuando el `204` ya lo dice con el código.

#### 1.7.2 En el `revisor`

`retirar` borra el servicio del almacén y responde con `enviarVacio`. Si el servicio no existía, responde `404`. Retira el servicio 4:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Ni `Content-Type` ni `Content-Length`: no hay cuerpo que describir. Pídelo otra vez:

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

El servicio ya no existe, y el `revisor` lo dice con un `404` y una línea de texto. (En la Lección 3, un servicio retirado va a responder `410`, que dice «existió y ya no está»; hoy el `revisor` no recuerda lo que retiró.) Y si repites el retiro:

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

El segundo `DELETE` responde distinto que el primero, y aun así el `DELETE` es **idempotente**. El [RFC 9110, sección 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2), define un método idempotente por su **efecto en el servidor**, no por la respuesta: repetir la petición deja el servidor igual que hacerla una vez. Después de uno o de diez `DELETE`, el servicio 4 no existe. Esa propiedad es la base de la Lección 6, porque es la que permite reintentar sin miedo.

### 1.8 `304`: no te mando lo que ya tienes

#### 1.8.1 La pregunta que decide

Imagina un tablero que muestra los servicios y los consulta cada diez segundos. La mayoría de las veces nada cambió, y el `revisor` manda el mismo cuerpo una y otra vez. Para eso existen las **peticiones condicionales**: el cliente dice «ya tengo la versión con esta etiqueta; mándamela solo si cambió». La cabecera es `If-None-Match` («si ninguna coincide»), y lleva la `ETag` que el cliente guardó.

El [RFC 9110, sección 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2), dice cómo se evalúa: si una de las etiquetas que mandó el cliente coincide con la del recurso, la condición es falsa, y entonces el servidor **no debe** ejecutar el método: a un `GET` o un `HEAD` responde `304`, y a cualquier otro método, `412` (la Lección 3 se ocupa del `412`). Si ninguna coincide, el servidor responde como siempre, con su `200`.

El [RFC 9110, sección 15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5), define el `304 Not Modified`: la petición condicional habría resultado en un `200`, pero no hace falta mandar la representación porque **el cliente ya la tiene**. El servidor, dice el RFC, está «redirigiendo» al cliente a su propia copia guardada. Por eso el `304` vive en la familia `3xx` aunque no lleve `Location`: es una redirección hacia lo que ya tienes. Y como el `204`, termina con la última cabecera: **no puede** llevar cuerpo.

Lo que sí debe llevar es la parte que más se olvida. El RFC da una lista corta: `Content-Location`, `Date`, `ETag` y `Vary`, y además `Cache-Control` y `Expires`; `Content-Length` puede acompañarlos solo si dice lo mismo que habría dicho el `200` (sección 8.6), y el `revisor` prefiere no mandarlo. De esas cabeceras, un `304` **debe** generar las que habría mandado el `200` a la misma petición. La `ETag` es la que importa aquí: le confirma al cliente cuál es la versión vigente.

La pregunta que decide, del lado del servidor: **¿la versión que el cliente dice tener es la vigente?** Si sí, `304` y nada más. Si no, `200` con la versión nueva y su etiqueta.

#### 1.8.2 Leer una lista de etiquetas

La sección 13.1.2 tiene dos detalles que deciden cómo se escribe el código. El primero: `If-None-Match` no trae **una** etiqueta, sino `*` o **una lista** separada por comas (`If-None-Match: "a", "b"`), porque un cliente puede tener guardadas varias versiones y preguntar por todas a la vez; y `*` significa «cualquier versión que tengas». El segundo: la comparación es **débil**. La [sección 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) define dos formas de comparar etiquetas. En la **fuerte**, dos etiquetas coinciden solo si ninguna lleva `W/` (la marca de «débil») y el texto es idéntico. En la **débil**, basta con que el texto entre comillas sea igual, con `W/` o sin él. `If-None-Match` usa la débil, porque solo pregunta si la copia del cliente todavía sirve para mostrarla. La Lección 3 usa la fuerte, con `If-Match`, para algo más delicado.

Comparar la cabecera entera con la etiqueta, como texto, falla con las dos cosas, y por eso existe `etiquetas.ts`:

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

`interpretarLista` recorre la cabecera respetando las comillas: una coma **dentro** de las comillas es parte de la etiqueta, no un separador. Devuelve `"*"` o la lista de etiquetas tal como llegaron. Si algo no tiene forma de etiqueta, la lista entera no vale y devuelve una lista vacía, que no coincide con nada. Es la decisión prudente: ante una cabecera rota, el servidor responde completo, que nunca es incorrecto. `coincideDebil` y `coincideFuerte` comparan dos etiquetas. `hayCoincidencia` junta las dos piezas: `*` coincide siempre (quien la llama ya encontró el recurso), y una lista coincide si **alguna** de sus etiquetas coincide con la vigente.

#### 1.8.3 En el `revisor`

`consultar`, en `servicios.ts`, calcula la etiqueta vigente y le pregunta a `hayCoincidencia`, con la comparación débil, si la cabecera `If-None-Match` la contiene. Si sí, `enviarVacio(respuesta, 304, { ETag: actual })`; si no, el `200` de siempre. Pide el servicio 1, `catalogo`, y fíjate en su `ETag`:

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

Ahora pídelo con esa etiqueta. Copia la **tuya**, la que te dio tu respuesta, con sus comillas:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 304 Not Modified
ETag: "1-1-b27b3d9a"
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`304`, con la `ETag` y sin cuerpo, sin `Content-Type` y sin `Content-Length`: los 88 bytes del cuerpo no viajaron. En este servicio de juguete no es nada; en una lista de miles de servicios consultada cada diez segundos por cien tableros, es la diferencia entre mandar megabytes por minuto o casi nada.

Compáralo con un `HEAD`, que también llega sin cuerpo pero por otra razón:

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

`200` con `Content-Length: 88`: el `HEAD` dice cuánto mediría el cuerpo, como en la Lección 0. El `304` no dice nada parecido, porque no es la respuesta a «¿cómo es?», sino a «¿cambió?».

Las otras tres formas que permite el RFC, con `-w '%{http_code}\n'` para ver solo el código: la etiqueta marcada como débil, una lista que la contiene, y el asterisco.

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", "1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: *'
304
```

Las tres dan `304`. `W/` no cambia nada en una comparación débil; la lista coincide porque una de sus etiquetas coincide; y `*` coincide porque el servicio existe.

#### 1.8.4 La etiqueta cambia en cada arranque

Detén el `revisor` (deja el laboratorio corriendo) y arráncalo otra vez. Después pide el servicio 1 con la etiqueta de antes:

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

`200`, con el cuerpo completo y una etiqueta nueva. El servicio 1 es el mismo `catalogo` y nada cambió en él, pero el `revisor` no tiene forma de saberlo: perdió todo al reiniciar y lo volvió a crear. Ante la duda, manda la representación entera y una etiqueta que no se puede confundir con ninguna de antes. Es el identificador de arranque de 1.2.1 haciendo su trabajo. Sin él, la etiqueta vieja y la nueva serían las dos `"1-1"`, y un `304` le habría confirmado al cliente una copia que el servidor ya no puede garantizar. Un servidor que guarda sus datos en una base no tiene este problema: su versión sobrevive a un reinicio. El `revisor` lo resuelve con lo más simple que funciona.

### 1.9 `301` y `308`: mudarse sin perder el `POST`

#### 1.9.1 La pregunta que decide

Las APIs se mudan. El `revisor` tuvo dos rutas viejas, `/viejo/servicios` y `/api/servicios`, que hoy viven en `/servicios`. Para decirlo hay dos códigos permanentes, y la diferencia entre ellos es de historia.

El [RFC 9110, sección 15.4.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.2), define el `301 Moved Permanently`: el recurso tiene una dirección nueva y permanente, y el servidor **debería** mandarla en `Location`. Y trae una nota que es el centro de esta sección: **por razones históricas, un cliente puede cambiar el método de `POST` a `GET`** en la petición que sigue. La misma nota da la salida: si ese cambio no se quiere, se usa el `308`.

La introducción de la [sección 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4) cuenta la historia completa. En HTTP/1.0, el `301` y el `302` conservaban el método. Pero los primeros navegadores se dividieron: unos repetían el `POST` en la nueva dirección y otros lo convertían en `GET`, que era lo más prudente si la redirección llevaba a otro sitio. La práctica terminó por convertirlo en `GET`, y la especificación se ajustó para permitirlo. Para las redirecciones que **sí** conservan el método se crearon códigos nuevos: el `307`, temporal, y el `308 Permanent Redirect`, que definió el [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) en junio de 2014, como experimento, que el [RFC 7538](https://www.rfc-editor.org/rfc/rfc7538.html) convirtió en estándar en abril de 2015, y que hoy está en la [sección 15.4.9](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.9) del RFC 9110.

Los clientes que vas a usar siguen esa práctica al pie de la letra. El manual de `curl` dice que, al seguir una redirección con `-L`, si la petición era un `POST` y la respuesta fue `301`, `302` o `303`, la siguiente petición es un `GET`; con cualquier otro `3xx`, repite el mismo método. Y el [estándar Fetch](https://fetch.spec.whatwg.org/#http-redirect-fetch), que sigue `fetch` en Node y en los navegadores, dice lo mismo en su algoritmo de redirección: si el código es `301` o `302` y el método es `POST`, el método pasa a ser `GET` y **el cuerpo se descarta**.

La pregunta que decide: **¿alguien puede mandar a esta ruta vieja algo distinto de un `GET` o un `HEAD`?** Si nunca, el `301` basta y lo entiende hasta el cliente más viejo. Si puede llegar un `POST`, un `PUT` o un `DELETE`, `308`. El RFC 7538, en su sección 4, agrega una precaución: un cliente muy viejo que no conozca el `308` lo va a tratar como un `300`, por la regla del `x00` de la Lección 0, y puede no seguir la redirección: el servidor no puede contar con que la siga. Hoy es raro, pero es la razón por la que el `301` sigue siendo la opción para las rutas que solo se leen.

Las mudanzas no son un ejemplo de libro. La página de OWASP que cita el recuadro de seguridad de esta lección cambió de dirección, y si la pides en la dirección vieja, con `-I` (solo cabeceras) y `-L` (seguir), ves la mudanza completa, en tres saltos:

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

Dos `308` y un `301` antes del `200`: el primero quita la diagonal final, el segundo muda la página a otro dominio, y el tercero se la vuelve a poner. Esta corrida es del 21 de octubre de 2026 y está guardada, tal cual, en `programas/01-exitos-redirecciones/owasp.salida.txt`, y un sitio ajeno puede cambiar sus mudanzas cuando quiera, así que la tuya puede verse distinta. Las líneas dicen `HTTP/2` y no traen frase porque esa conexión usó HTTP/2, que no manda la frase de la línea de estado: la Lección 0 te dijo que un cliente no debe decidir con ella.

Hay un tercer código del que se oye hablar aquí, el `302 Found`, y conviene saber dónde queda. Tiene la misma nota histórica que el `301` (un `POST` puede volverse `GET`), pero es **temporal**: el cliente debe seguir usando la dirección original. Su pareja que conserva el método es el `307`. El `revisor` no los usa porque sus mudanzas son permanentes; el laboratorio los produce en `/codigo/302` y `/codigo/307` si quieres verlos.

#### 1.9.2 En el `revisor`

`redirigir`, en `rutas.ts`, revisa la ruta **antes** que la tabla, para que una ruta vieja nunca llegue a un manejador. A `/viejo/servicios` y todo lo que cuelga de ella responde `301`; a `/api/servicios` y lo que cuelga, `308`. En los dos casos, `Location` es la ruta nueva: se quita el prefijo y se conserva la consulta (lo que viene después de `?`), para que un `GET /viejo/servicios?x=1` llegue a `/servicios?x=1`.

Sin `-L`, `curl` solo muestra la respuesta, sin seguirla. Manda un alta a cada ruta vieja:

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

Las dos respuestas dicen lo mismo, salvo el número: «esto se mudó a `/servicios`», con `Content-Length: 0`. Ninguna de las dos creó nada. Lo que pasa después depende del cliente, y eso es justo lo que muestra la sección «El error que vas a ver».

### 1.10 Recuadro de seguridad: SSRF

> **Recuadro de seguridad. Qué es SSRF y por qué el `revisor` lo trae de nacimiento**
>
> **SSRF** (*server-side request forgery*, falsificación de peticiones del lado del servidor) es lo que pasa cuando alguien logra que **tu servidor** haga una petición que **esa persona** eligió. El servidor se conecta desde su propia red, con su propio acceso, a una dirección que el atacante no podría alcanzar desde fuera: el propio servidor (`127.0.0.1`), la red interna de la empresa o el servicio de metadatos de la nube. El [OWASP API Security Top 10 de 2023](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/) lo pone en el séptimo lugar (API7:2023), y lo define así: una API que trae un recurso remoto **sin validar la URL que le dio el usuario**. Y explica por qué se volvió común: los *webhooks*, las vistas previas de enlaces y la descarga de archivos desde una URL son funciones de producto que consisten, precisamente, en conectarse a una dirección ajena.
>
> **El `revisor` es el caso típico.** Su trabajo es conectarse a la URL que escribió quien dio de alta el servicio. No es un descuido que se pueda quitar: es el producto. Sin ninguna defensa, cualquiera con permiso de dar de alta un servicio podría registrar `http://127.0.0.1:18080/mantenimiento` y hacer que el `revisor` se consulte a sí mismo, o una dirección de la red interna que solo el servidor ve, y luego leer el resultado de la revisión: `ARRIBA`, `CAIDO`, el código y los milisegundos. Con eso ya puede hacer un mapa de qué máquinas y qué puertos existen dentro de la red. Y si el `revisor` corre en una nube, hay una dirección que vale más que todas: `169.254.169.254`, donde varias nubes publican los **metadatos** de la máquina. La [documentación de AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) usa esa dirección en todos sus ejemplos (y `[fd00:ec2::254]` en IPv6), la de [Alibaba Cloud](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata) usa otra, `100.100.100.200`, y la [guía de prevención de SSRF de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) lo dice sin rodeos: en la nube, SSRF se usa a menudo para robar credenciales y tokens de esos servicios de metadatos.
>
> **La defensa: preguntarle al DNS antes de cada conexión.** Revisar el texto de la URL no alcanza. `localhost` no parece una dirección prohibida, y lo es; `http://2130706433/` tampoco lo parece, y el analizador de URLs lo convierte en `127.0.0.1`, porque el [estándar URL](https://url.spec.whatwg.org/#concept-ipv4-parser) acepta direcciones IPv4 escritas como un solo número, en hexadecimal o en octal. Lo que importa no es cómo se escribe el destino, sino **a qué dirección se va a conectar el `revisor`**. Por eso `destinos.ts` hace tres cosas: deja que `new URL` normalice la dirección; resuelve el nombre con `dns.lookup` y la opción `all: true`, que devuelve **todas** las direcciones del nombre, como lo resolvería cualquier otro programa de la máquina (con `/etc/hosts` incluido); y rechaza el destino si **una sola** de ellas cae en un rango privado o reservado. Los rangos se revisan con `net.BlockList` de Node, y una IPv4 escrita dentro de una IPv6 (`::ffff:127.0.0.1`) se saca y se revisa como lo que es. Y la revisión se hace **dos veces**: al registrar la URL, para avisarle a quien da de alta, y otra vez en `cliente.ts`, **antes de cada conexión**, porque lo que un nombre resolvía el viernes no tiene por qué ser lo que resuelve el lunes. Fíjate además en lo que el rechazo **no** dice: el mensaje no cuenta a qué dirección resolvió el nombre, para no darle al atacante un mapa de la red interna una petición a la vez. La dirección concreta, si hace falta, va solo a la bitácora del servidor, donde la lee quien opera el `revisor`.
>
> **La excepción del laboratorio.** El laboratorio de este curso vive en `127.0.0.1:18081`, que es loopback, un rango prohibido. Sin una excepción, el curso no podría practicar en una sola máquina. Por eso existe una lista de destinos permitidos **por dirección y puerto exactos**: por omisión solo `127.0.0.1:18081`, y se cambia con la variable de entorno `REVISOR_DESTINOS`. Es exacta a propósito: `127.0.0.1:18080`, el propio `revisor`, sigue prohibido. Y `localhost:18081` depende de la máquina: si `localhost` resuelve también a `::1`, como en macOS y en muchos Linux, se rechaza, porque `[::1]:18081` no está en la lista; si resuelve solo a `127.0.0.1`, se acepta, porque `127.0.0.1:18081` es justo la excepción. Esa diferencia es una razón más para que la lista sea por dirección y no por nombre: lo que un nombre resuelve no lo decide quien escribe la regla. En un `revisor` de verdad, la lista estaría vacía o tendría solo lo imprescindible, y la regla general (nada privado) haría el resto. Una lista de lo permitido es más segura que una de lo prohibido, y OWASP la recomienda siempre que los destinos se conozcan; aquí no se conocen, porque cualquiera da de alta cualquier servicio, y por eso se combinan las dos.
>
> **Por qué `fetch` no sigue redirecciones.** Si `cliente.ts` siguiera los `3xx`, bastaría con dar de alta un servicio público que responda `301` con `Location: http://169.254.169.254/…`: la URL registrada pasaría la revisión, y la redirección llevaría al `revisor` a donde no debe, sin pasar por `destinos.ts`. Con `redirect: "manual"`, el `revisor` anota el `301` y se detiene. OWASP y el API Top 10 recomiendan lo mismo: desactivar el seguimiento de redirecciones.
>
> **El límite que queda declarado: DNS rebinding.** Aun validando antes de cada `fetch`, queda un hueco, y conviene nombrarlo. `destinos.ts` resuelve el nombre y aprueba sus direcciones; después, `fetch` **vuelve a resolverlo** para conectarse. Entre una resolución y la otra pasan milisegundos, y quien controla el DNS de ese nombre puede contestar una dirección pública a la primera pregunta y `127.0.0.1` a la segunda, con un tiempo de vida de cero segundos para que nadie guarde la primera respuesta. A eso se le llama **DNS rebinding**, y es una carrera entre la revisión y el uso. La guía de OWASP lo dice con todas sus letras: una segunda resolución sin revisar, entre la validación y la conexión, se salta estas defensas. La defensa completa es **conectarse a la dirección ya validada** y no volver a resolver el nombre: con `http.request` de Node y su opción `lookup`, una función que reemplaza a `dns.lookup` y puede devolver justo la IP que se aprobó, mientras la cabecera `Host` conserva el nombre original. **Aquí validamos antes de cada conexión, y la defensa completa llega en la [Lección 8](08-contrato-verificable.md)**, donde `cliente.ts` se conecta a la IP ya validada; mientras tanto, el límite queda escrito en el comentario de `destinos.ts`, para que nadie lo dé por cerrado. Y aun con esa defensa, en producción hace falta una segunda capa: una red que no deje al `revisor` llegar a los metadatos aunque lo intente. La defensa no puede depender de un solo archivo.

#### 1.10.1 El código

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

Se lee en el orden de la función `revisarDestino`. Primero intenta convertir el texto en una URL; si no se puede, no es un destino. Después exige `http:` o `https:`: un `file:` o un `ftp:` no tienen nada que hacer en un revisor de servicios web. Calcula el puerto (el de la URL o el de omisión del protocolo) y quita los corchetes de una IPv6 (`[::1]` → `::1`). La función `privada` decide si una dirección es privada o reservada, y lo hace distinto para cada protocolo, por una razón que se explica abajo: a una IPv4 le pregunta si cae en `IPV4_PROHIBIDAS`; a una IPv6, primero si lleva una IPv4 adentro (los cuatro formatos de `EMBEBIDAS`, con ayuda de `grupos`, que reparte una IPv6 en sus ocho grupos de 16 bits), y si no, si está en `IPV6_GLOBAL` y fuera de `IPV6_PROHIBIDAS`. Si el nombre ya es una dirección, la usa tal cual; si no, la resuelve con `lookup(nombre, { all: true })`. Al final arma cada destino como `dirección:puerto` y se queda con los que **no** están en la lista de permitidos **y** que `privada` declara privados o reservados. Si queda alguno, el destino se rechaza. El motivo depende de cómo se escribió el destino: si era una dirección, la repite, porque es la que escribió el cliente; si era un nombre, solo dice que resuelve a una dirección privada o reservada, sin decir cuáles.

**Una decisión de diseño: lista negra en IPv4, lista blanca en IPv6.** Hay dos formas de escribir la regla. Una **lista negra** nombra lo prohibido y acepta todo lo demás; una **lista blanca** nombra lo permitido y rechaza todo lo demás. La lista blanca es más segura, porque lo que se te olvidó nombrar queda fuera, no dentro. Pero solo se puede escribir si lo permitido cabe en pocas líneas, y ahí los dos protocolos son distintos.

En **IPv6**, cabe en una. Todo el unicast global de internet vive en un solo bloque, `2000::/3`, que el [registro del espacio de direcciones IPv6 de la IANA](https://www.iana.org/assignments/ipv6-address-space/) marca como *Global Unicast*. La regla se lee como se dice: «solo se permite internet». Con ella quedan fuera de un golpe, sin nombrarlos, el loopback `::1`, la dirección sin especificar `::`, las locales únicas `fc00::/7`, el enlace local `fe80::/10`, la multidifusión `ff00::/8` y cualquier bloque especial que se agregue mañana fuera de `2000::/3`. Dentro de ese bloque hay unos pocos que no son de internet, y esos sí se nombran en `IPV6_PROHIBIDAS`: `2001::/23` (protocolos del IETF, entre ellos Teredo), `2001:db8::/32` y `3fff::/20` (documentación) y `5f00::/16` (*segment routing*).

En **IPv4**, no cabe. No existe un bloque «global» que se pueda aceptar entero: lo global es «todo menos los especiales», y una lista blanca de IPv4 sería la misma lista negra escrita al revés. Por eso `IPV4_PROHIBIDAS` es una lista negra, copiada renglón por renglón del [registro de direcciones IPv4 de uso especial de la IANA](https://www.iana.org/assignments/iana-ipv4-special-registry/), con el nombre de cada bloque en su comentario, para que se pueda auditar comparándola con el registro:

| Bloque IPv4 | Qué es | Dónde se define |
|---|---|---|
| `0.0.0.0/8` | «esta red» | [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html), base del registro de uso especial |
| `10/8`, `172.16/12`, `192.168/16` | redes privadas | [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) |
| `100.64/10` | espacio compartido o *CGNAT* (*Carrier-Grade NAT*: la traducción de direcciones con la que un proveedor de internet reparte una misma dirección pública entre muchos clientes); en `100.100.100.200` publica sus metadatos Alibaba Cloud | [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) |
| `127/8` | loopback, la propia máquina | RFC 6890 |
| `169.254/16` | enlace local; en `169.254.169.254` publican sus metadatos AWS y otras nubes | [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) |
| `192.0.0.0/24` | asignaciones de protocolo del IETF | registro de la IANA |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | documentación (TEST-NET-1, 2 y 3) | registro de la IANA |
| `192.88.99.0/24` | el antiguo relevo de 6to4, ya retirado | registro de la IANA |
| `198.18.0.0/15` | pruebas de rendimiento | registro de la IANA |
| `224/4` | multidifusión (*multicast*), una dirección que llega a un grupo de máquinas | [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) |
| `240/4` | reservado, incluida la difusión `255.255.255.255` | registro de la IANA |

La lista bloquea un poco de más, a propósito: `192.0.0.0/24` y `2001::/23` se rechazan enteros aunque el registro marque como globales algunas direcciones sueltas adentro. Son direcciones de protocolos de la propia red, no servicios web que alguien quiera vigilar, y una regla de un renglón se revisa mejor que una excepción por dirección.

**La IPv4 que viaja dentro de una IPv6.** Cuatro formatos de IPv6 llevan una IPv4 adentro, y en los cuatro lo que importa es esa IPv4, así que `destinos.ts` la saca y la juzga con la lista de IPv4, **antes** de la lista blanca:

| Formato IPv6 | Dónde va la IPv4 | Ejemplo |
|---|---|---|
| `::ffff:0:0/96`, IPv4 **mapeada** ([RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html)) | en los últimos 32 bits | `[::ffff:127.0.0.1]` es `127.0.0.1` |
| `::/96`, IPv4 **compatible**, obsoleta (RFC 4291) | en los últimos 32 bits | `[::7f00:1]` es `127.0.0.1`; `::1` y `::` dan `0.0.0.1` y `0.0.0.0` |
| `64:ff9b::/96`, **NAT64** ([RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html)) | en los últimos 32 bits | `[64:ff9b::a9fe:a9fe]` es `169.254.169.254` |
| `2002::/16`, **6to4** ([RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html)) | en los bits 16 a 47 | `[2002:a9fe:a9fe::]` es `169.254.169.254` |

El orden importa. 6to4 vive dentro de `2000::/3` y NAT64 fuera, y los dos tienen direcciones públicas legítimas: `[64:ff9b::808:808]` y `[2002:808:808::1]` llevan dentro `8.8.8.8`, una dirección pública, y deben pasar; las mismas formas con una IPv4 privada adentro deben rechazarse. Ni la lista blanca sola ni un bloqueo del prefijo entero distinguen los dos casos. Sacar la IPv4 y juzgarla sí.

No es una regla exhaustiva de todo lo que no es público, pero cubre lo que la [guía de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) pone en su lista mínima, y la parte que más crece, la de IPv6, se cierra sola. Que la regla quepa en una pantalla y se audite contra un registro público es parte de la defensa: una regla que nadie entiende es una regla que nadie revisa. Y que nunca sea perfecta es la razón de la segunda capa, la de la red.

#### 1.10.2 Las corridas de rechazo

Intenta registrar la dirección de los metadatos de la nube:

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

`400`, con el motivo: `169.254.169.254:80` es una dirección privada o reservada. El `revisor` no la registró y nunca se va a conectar a ella. Ahora un nombre que no parece peligroso, que apunta al propio `revisor`:

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

Mismo `400`, con un motivo que dice menos que el anterior, a propósito. En el primer caso, la dirección la escribió quien hizo la petición, y repetírsela no le enseña nada nuevo. En el segundo, quien la escribió solo conoce el **nombre**; las direcciones a las que resolvió son información de la red del `revisor`, y el mensaje no las cuenta. En macOS, `localhost` resuelve a dos direcciones, `::1` y `127.0.0.1`, las dos loopback; en Linux, según cómo esté configurado `/etc/hosts`, puede resolver solo a `127.0.0.1`. La respuesta que recibe el cliente es idéntica en los dos sistemas, y esa es otra ventaja de no enumerar: lo que dice la API no depende del sistema operativo del servidor.

Y la dirección de los metadatos de otra nube, que cae en el espacio compartido:

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

Por último, las dos caras de 6to4. `2002:a00:1::1` lleva en sus bits 16 a 47 los grupos `0a00` y `0001`, es decir `10.0.0.1`, una red privada; `2002:808:808::1` lleva `0808` y `0808`, es decir `8.8.8.8`, una dirección pública:

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-1","url":"http://[2002:a00:1::1]/"}'
destino prohibido: [2002:a00:1::1]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-2","url":"http://[2002:808:808::1]/"}'
{"id":4,"nombre":"tunel-2","url":"http://[2002:808:808::1]/","limite_ms":2000}
 → 201
```

El primero se rechaza por lo que lleva dentro, aunque esté en `2000::/3`; el segundo se acepta, aunque una regla que bloqueara 6to4 entero lo habría rechazado. El alta del segundo creó el servicio 4, pero el `revisor` no se conectó a nada: la primera conexión ocurriría en la primera revisión, y antes de ella se vuelve a revisar el destino.

Si quien opera el `revisor` necesita las direcciones concretas para investigar un rechazo, el lugar para ellas es la bitácora del servidor, nunca la respuesta. El `revisor` del curso no las escribe en ninguna parte: el comentario de `destinos.ts` dice dónde irían, y su terminal no muestra nada más que el `POST /servicios` de siempre, para que la corrida sea igual en todo sistema.

#### 1.10.3 La segunda revisión, antes de conectarse

La primera revisión ya la viste. La segunda está en la primera línea de `revisar`, en `cliente.ts`, y se ve cuando la regla cambia entre el alta y la revisión. Los tres servicios de arranque se registran directamente en el almacén, sin pasar por el alta, así que basta con arrancar el `revisor` con una lista de permitidos que **no** incluya el laboratorio. Detén el `revisor` y arráncalo así (el `9` es un puerto cualquiera donde no hay nada):

```text
$ REVISOR_DESTINOS=127.0.0.1:9 node servidor.ts
revisor en http://127.0.0.1:18080
```

Y pide una revisión de `catalogo` con el programa de 1.6.4:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"CAIDO","codigo":null,"ms":null,"detalle":"destino prohibido: 127.0.0.1:18081: dirección privada o reservada"}
```

El servicio estaba registrado, la revisión se aceptó con su `202` y su seguimiento funcionó, pero el `revisor` **no se conectó**: antes de hacerlo volvió a revisar el destino, y `127.0.0.1:18081` ya no estaba permitido. El resultado es `CAIDO`, sin código ni milisegundos, porque no hubo conversación, y el detalle dice por qué. En un sistema real, lo que cambia entre el alta y la revisión no es la lista de permitidos, sino lo que el DNS contesta para un nombre; el efecto es el mismo, y esta es la razón de revisar dos veces. Detén el `revisor` y arráncalo otra vez sin la variable.

### 1.11 Revisar los tipos con `tsc` (opcional)

Como en la Lección 0, Node ejecuta los programas sin revisar los tipos, y el curso los revisa con `tsc` en modo estricto. Desde esta lección hace falta una opción más, `--allowImportingTsExtensions`, porque los archivos del `revisor` se importan entre sí con la extensión `.ts`; con `--noEmit`, TypeScript lo permite. Dentro de `~/curso-http/revisor/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Si todo está bien, `tsc` no imprime nada y termina con código 0, que es lo que dio con los diez archivos de esta lección (los nueve del `revisor` y `fig01_02.ts`).

## El error que vas a ver

**El alta que se perdió sin error.** Es el de la escena del principio, y ahora lo vas a provocar. Manda la misma alta a las dos rutas viejas, pero esta vez con `-L`, para que `curl` siga la redirección como lo haría un programa. Sin `-X POST`: `-d` ya implica `POST`, y es lo que haría cualquier cliente. Si vienes de 1.10.3, ya arrancaste el `revisor` otra vez sin la variable, así que tiene sus tres servicios de arranque. Primero, la ruta que se mudó con `301`:

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

Dos respuestas. La primera es el `301`. La segunda es un `200` con la lista de servicios, y `avisos` no está en ella. Lee la terminal del `revisor`, que es la única que cuenta lo que pasó:

```text
POST /viejo/servicios
GET /servicios
```

`curl` siguió el `301`, como permite el RFC 9110 y como dice su manual: convirtió el `POST` en `GET` y tiró el cuerpo. El `revisor` recibió una consulta, respondió la lista con un `200` honesto, y nadie mintió en ningún paso. Para quien mandó el alta, el resultado es un `200` y un servicio que no existe. Ahora la ruta que se mudó con `308`:

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

El `308` y después un `201` con `Location: /servicios/4`. La terminal del `revisor`:

```text
POST /api/servicios
POST /servicios
```

El `POST` llegó como `POST`, con su cuerpo, y el alta ocurrió. Para comprobarlo de la forma más simple, pide la lista:

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

`avisos` es el servicio 4. El del `301` no existe en ninguna parte.

**Qué está mal y cómo se arregla.** No está mal `curl`, ni el `revisor`, ni la persona que dio de alta: cada uno hizo lo que su especificación le permite. Está mal **la elección del código** para una ruta que recibe escrituras. El arreglo es elegir `308` (o `307`, si la mudanza es temporal) para toda ruta vieja que pueda recibir algo distinto de `GET` o `HEAD`. Y del lado del cliente, hay una lección igual de útil: un programa que escribe no debería seguir redirecciones a ciegas. Si recibe un `301` a un `POST`, lo correcto es avisar y actualizar la dirección configurada, no seguirlo; la [Lección 7](07-quien-lee-el-error.md) pone esa decisión en la tabla del cliente. `curl` tiene una opción para conservar el `POST` tras un `301`, `--post301`, y el ejercicio 2 te pide probarla; existe justamente porque la conversión es el comportamiento de omisión. Es una opción de `curl` y de pocos clientes más: `fetch`, por ejemplo, no tiene una equivalente y convierte el `POST` en `GET` tras un `301` por especificación, así que no se arregla del lado del cliente. El arreglo de verdad es del servidor: elegir el código que no deja lugar a la duda.

**Una trampa al reproducirlo: `-X POST` con `-L`.** Si por costumbre escribes `-X POST` además de `-d`, el resultado es otro, y no se entiende a primera vista:

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

`-X` no le dice a `curl` «la primera petición es un `POST`», sino «usa `POST` en **todas** las peticiones», también en la que sigue a la redirección. El manual de `curl` lo advierte: con `-L`, el método de `-X` se usa en cada petición y puede tener efectos que no esperabas. `curl` siguió el `301` con un `POST`, pero aplicó la otra mitad de la regla de las redirecciones y no mandó el cuerpo. El `revisor` recibió un `POST /servicios` vacío y respondió `400 el cuerpo no es JSON`: ni se reproduce el defecto ni se crea nada. (Sin `-sS`, `curl` además puede imprimir una nota diciendo que el `-X` sobra.) Para ver el defecto como lo vería un programa, deja que `-d` decida el método.

**El método que no existe responde `404`.** El otro error de esta lección es el defecto a propósito. Pide un método que la ruta no admite:

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

La ruta `/servicios/1` existe: con `GET` responde. Con `PATCH`, el `revisor` dice «no existe esa ruta», que es falso. El código correcto es `405 Method Not Allowed`, con la cabecera `Allow` que liste los métodos que sí se admiten, y la Lección 0 te enseñó que `Allow` es obligatoria en un `405`. Un cliente que recibe este `404` concluye que se equivocó de dirección, cuando se equivocó de método. Se arregla haciendo que `atender` distinga los dos casos, y es lo primero que hace la Lección 2.

## Lo que se hace mal

**Responder `200` a todo lo que salió bien.** Un alta con `200` deja al cliente sin `Location`; una operación que apenas empieza con `200` le hace creer que ya terminó; un retiro con `200` y `{"ok": true}` lo obliga a leer un cuerpo que no dice nada que el código no dijera. Los cuatro éxitos de esta lección existen para que el cliente sepa qué hacer sin leer el cuerpo.

**Un `201` sin `Location`.** El RFC permite omitirlo, y entonces el recurso creado es la propia ruta de la petición. En un alta a `/servicios`, eso es falso: el servicio no vive ahí. El cliente tiene que adivinar el `id` en el cuerpo, con un nombre de campo que cambia de API en API.

**Un `202` sin dónde preguntar.** Responder `202` y no dar un recurso de seguimiento deja al cliente con dos opciones malas: creer que la operación ocurrió o repetirla. Si el `202` no trae `Location` ni un cuerpo que diga cómo seguirlo, falta la mitad de la respuesta.

**Consultar el seguimiento sin pausa.** El cliente que pregunta cinco mil veces por segundo «¿ya terminó?» convierte una operación asíncrona en un ataque contra el propio servidor. `Retry-After` existe para eso; si falta, el cliente pone una pausa mínima.

**`301` en una ruta que recibe escrituras.** Es el error de esta lección: el `POST` se vuelve `GET` y el cuerpo se tira, sin error. Para rutas que reciben escrituras, `308`.

**Un cuerpo en un `204` o un `304`.** El RFC dice que no pueden llevarlo. Node, por cierto, no manda un cuerpo en esos dos códigos aunque lo escribas, pero otros servidores sí lo hacen, y entonces el cliente lee ese cuerpo como el principio de la respuesta siguiente: la conversación se desalinea y las respuestas llegan a quien no las pidió. Es una de las pocas violaciones de la especificación que no solo es fea, sino que corrompe la conexión.

**Un `304` sin `ETag`.** El RFC obliga a mandar en el `304` las cabeceras que habría mandado el `200`, entre ellas la `ETag`. Sin ella, el cliente no tiene cómo confirmar que su copia es la vigente.

**Conectarse a la URL que te dieron sin revisar a dónde va.** Es la puerta del SSRF. Revisar el texto de la URL no alcanza: hay que revisar las direcciones a las que resuelve, antes de cada conexión, y no seguir redirecciones.

## Ejercicios

Los cuatro se corrigen solos: cada uno termina con una corrida que te dice si acertaste. Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada. Arranca de nuevo el laboratorio y el `revisor` **una sola vez**, antes del ejercicio 1, y haz los cuatro seguidos: los números de servicio de las soluciones suponen ese orden.

### Ejercicio 1 — Cuatro condiciones

Pide `GET /servicios/1` con `curl -i` y anota su `ETag`; en la solución es `"1-1-0e296858"`, y la tuya termina distinto. Predice qué código responde el `revisor` a cada una de estas peticiones:

1. `GET /servicios/1` con `If-None-Match: "1-1"`, la etiqueta escrita a mano, sin el identificador de arranque.
2. `GET /servicios/1` con `If-None-Match: W/` seguido de tu etiqueta.
3. `GET /servicios/1` con `If-None-Match: "9-9-00000000", W/"8-8-00000000"`.
4. `GET /servicios/99` con `If-None-Match: *`.

Corre las cuatro con `curl -s -o /dev/null -w '%{http_code}\n'` seguido de la dirección y de `-H 'If-None-Match: …'`, y compara.

### Ejercicio 2 — Conservar el `POST` tras un `301`

La sección «El error que vas a ver» dice que `curl` tiene una opción, `--post301`, que conserva el `POST` al seguir un `301`. Predice qué responde esta petición, cuántas líneas de estado vas a ver y qué escribe la terminal del `revisor`:

```bash
curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
```

Corre el comando y compara. Luego contesta: si `curl` puede hacerlo, ¿por qué la sección dice que el arreglo es cambiar el código y no pedirle a cada cliente que use esa opción?

### Ejercicio 3 — Cinco destinos

Predice cuáles de estas URLs acepta el alta del `revisor` y, para las que rechaza, qué dice el motivo (todas están escritas como direcciones, salvo la última, así que el motivo nombra la dirección):

1. `http://2130706433:18081/codigo/200`
2. `http://2130706433:18080/servicios`
3. `http://[::ffff:127.0.0.1]:18081/codigo/200`
4. `http://[64:ff9b::a9fe:a9fe]/`
5. `http://example.com/`

Para cada una, manda un alta con un nombre distinto (`d1` a `d5`) y mira solo el cuerpo y el código, con `curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"…"}'`. La quinta necesita que tu máquina tenga salida a internet para resolver el nombre.

### Ejercicio 4 — El seguimiento de una revisión que no termina

Copia `fig01_02.ts` como `ej4.ts` y cámbiale el tope de diez consultas por dos (`consulta <= 2`). Predice qué imprime `node ej4.ts 2` y con qué código termina (`echo $?`). Después corre. ¿El programa distingue entre «la revisión terminó» y «me cansé de preguntar»? Si no, ¿qué le falta?

## Soluciones

### Solución 1

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

`200`, `304`, `200` y `404`. La primera no coincide porque una etiqueta es opaca: `"1-1"` no es una parte de `"1-1-0e296858"`, es otra etiqueta, y la comparación es del texto completo entre comillas. (Antes de un reinicio, es justo la etiqueta que le daría a un cliente una copia equivocada; por eso el identificador de arranque.) La segunda coincide porque `If-None-Match` compara en débil, y `W/` no cuenta. La tercera es una lista válida en la que **ninguna** etiqueta coincide, y el servidor responde completo. La cuarta es la trampa: `*` significa «cualquier versión que tengas», pero el servicio 99 no existe, así que no hay versión que confirmar; el `revisor` lo busca antes de mirar la condición y responde `404`. Un `304` ahí le confirmaría al cliente una copia de algo que no existe.

### Solución 2

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

Dos líneas de estado: el `301` y un `201`. En la terminal del `revisor`, `POST /viejo/servicios` y después `POST /servicios`: con `--post301`, `curl` repitió el `POST` con su cuerpo en la nueva dirección y el alta ocurrió, con el id 4 porque es la primera alta de este arranque. La opción existe, pero el arreglo sigue siendo el código, por una razón práctica: tú controlas tu servidor, y no controlas los clientes. Puedes poner `--post301` en tus guiones, pero no en el programa de quien consume tu API, ni en su biblioteca HTTP, ni en el `fetch` de su navegador, que según el estándar Fetch convierte el `POST` en `GET` y no tiene una opción para evitarlo. Un `308` funciona igual con todos ellos, sin pedirle nada a nadie.

### Solución 3

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

Se aceptan dos y se rechazan tres, y la primera es la trampa. `http://2130706433:18081/` **se acepta**: el analizador de URLs convierte `2130706433` en `127.0.0.1`, y `127.0.0.1:18081` es justo la excepción del laboratorio. La defensa no se dejó engañar por la forma rara; al contrario, vio a dónde iba de verdad, y ese destino está permitido. Con el puerto 18080 se rechaza, y el motivo dice `127.0.0.1:18080`, no `2130706433`: el `revisor` juzga la dirección normalizada. La tercera también es loopback, escrita como IPv4 mapeada: el analizador la normaliza a `::ffff:7f00:1`, que no está en la lista de permitidos (la lista compara textos exactos), y `destinos.ts` saca la `127.0.0.1` de adentro y la reconoce como loopback. La cuarta es la IPv4 `169.254.169.254` escondida en el prefijo de NAT64: en una red con NAT64 llevaría a los metadatos, y se rechaza por lo que lleva dentro. La quinta resuelve a direcciones públicas y se acepta (si tu máquina no tiene salida a internet, se rechaza con «no se pudo resolver», y es el comportamiento correcto: lo que no se puede resolver no se puede revisar). Ningún alta hizo una conexión: aceptar el destino solo lo registra; la primera conexión ocurre en la primera revisión, y antes de ella se vuelve a revisar.

### Solución 4

```text
$ node ej4.ts 2; echo $?
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 pendiente, Retry-After: 1
0
```

Con dos consultas, el programa nunca vio `terminada`, imprimió las dos líneas de `pendiente`, salió del ciclo sin decir nada y terminó con código 0, el mismo que si todo hubiera salido bien. (La segunda consulta llega un segundo después de la primera, y la revisión espera un segundo en la cola: es una carrera de milisegundos. Si en tu corrida la segunda consulta ya la encontró terminada, la ganó la revisión; pon el tope en una consulta y verás el mismo defecto.) Es el defecto del ejercicio: el programa no distingue entre «terminó» y «dejé de preguntar». Le falta un renglón después del ciclo que, si nunca vio `terminada`, lo diga y salga con un código distinto de cero, por ejemplo `console.log("la revisión no terminó a tiempo"); process.exit(1);`, y para eso hace falta recordar en una variable si terminó. Es el mismo criterio de la Lección 0, del lado del cliente: el código de salida también es un contrato, y un `0` que no significa éxito engaña al guion que lo lee igual que un `200` con un error dentro.

## Cómo sé que lo logré

- [ ] Con el laboratorio y el `revisor` corriendo, `curl -i http://127.0.0.1:18080/servicios` da `200` con los tres servicios de arranque.
- [ ] El alta de 1.5.2 da `201` con `Location: /servicios/4` y una `ETag` de la forma `"4-1-` seguida de ocho cifras hexadecimales, y explicas qué identifica cada cabecera y cada parte de la etiqueta.
- [ ] `-d 'null'` da `400` con «el cuerpo no es un objeto JSON», y la petición siguiente responde `200`.
- [ ] Pedir una revisión da `202` con `Location: /revisiones/1`; consultarla enseguida da `200` con `"pendiente"` y `Retry-After: 1`, y dos segundos después, `"terminada"`. Explicas por qué el primer código es `202` y el segundo `200`.
- [ ] `node fig01_02.ts 1` sigue la revisión hasta `ARRIBA` respetando `Retry-After`, en dos o tres consultas.
- [ ] Retirar el servicio 4 da `204` sin `Content-Type` ni `Content-Length`; pedirlo después da `404`, y explicas por qué el `DELETE` sigue siendo idempotente.
- [ ] `GET /servicios/1` con `If-None-Match` y la etiqueta que te dio el `revisor` da `304` con `ETag` y sin cuerpo; con `W/` delante, en una lista o con `*`, también. Sabes qué cabeceras debe llevar un `304` según el RFC 9110.
- [ ] Después de reiniciar el `revisor`, la etiqueta de antes da `200` con una etiqueta nueva, y explicas por qué eso evita un `304` falso.
- [ ] Con `curl -L`, el alta a `/viejo/servicios` termina en un `200` con la lista y la terminal del `revisor` dice `GET /servicios`; el alta a `/api/servicios` termina en un `201` y la terminal dice `POST /servicios`.
- [ ] Las altas del recuadro dan `400` con «destino prohibido», y explicas en qué caso `localhost:18081` se rechaza y en qué caso se acepta, aunque `127.0.0.1:18081` siempre se acepte.
- [ ] Explicas qué es DNS rebinding, por qué validar antes de cada conexión no lo cierra del todo y qué hace la defensa completa que llega en la Lección 8.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/` y `curl -i http://127.0.0.1:18081/` dan el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Qué tres preguntas separan al `200`, el `201`, el `202` y el `204`?
2. ¿Qué identifica `Location` en un `201`? ¿Y en un `202`? ¿Y en un `301`?
3. ¿Por qué un `202` debería apuntar a un recurso de seguimiento, según el RFC 9110? ¿Qué código responde ese recurso mientras la operación está pendiente?
4. ¿Por qué el segundo `DELETE` del mismo servicio responde `404` y el método sigue siendo idempotente?
5. ¿Qué es una `ETag`, para qué sirve `If-None-Match` y por qué un `304` no lleva cuerpo? ¿Por qué la etiqueta del `revisor` cambia en cada arranque?
6. ¿Qué le pasa a un `POST` que recibe un `301` y lo sigue `curl -L`? ¿Y uno que recibe un `308`? ¿Por qué existe esa diferencia?
7. ¿Qué es SSRF, por qué el `revisor` lo trae de nacimiento y por qué revisa el destino dos veces?
8. ¿Qué es DNS rebinding, qué hace el `revisor` de esta lección contra él y cómo se cierra del todo?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), secciones 15.3.1, 15.3.2, 15.3.3 y 15.3.5: `200`, `201`, `202` y `204`; el contenido del `200` según el método, `Location` y los validadores del `201`, el `202` «intencionalmente evasivo» con su monitor de estado, y el `204` que no puede llevar cuerpo.
2. [RFC 9110, sección 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4), y secciones 15.4.2, 15.4.5 y 15.4.9: la historia del `POST` convertido en `GET`, el `301`, el `304` con las cabeceras que debe generar, y el `308`.
3. [RFC 9110, secciones 9.2.2, 9.3.3 y 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): los métodos idempotentes, el `201` con `Location` para un `POST` que crea, y las tres respuestas posibles a un `DELETE` exitoso.
4. [RFC 9110, secciones 8.6, 8.8.1, 8.8.3, 8.8.3.1 y 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3): `Content-Length` en `204` y `304`; una etiqueta fuerte no se reutiliza para otra representación; la `ETag` como texto opaco entre comillas y su ejemplo con un número de revisión; las comparaciones fuerte y débil.
5. [RFC 9110, secciones 10.2.2, 10.2.3 y 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2): `Location` como referencia relativa, `Retry-After`, y la evaluación de `If-None-Match` (`*` o una lista, comparación débil, `304` para `GET` y `HEAD`, `412` para lo demás).
6. [RFC 7538, *The Hypertext Transfer Protocol Status Code 308 (Permanent Redirect)*](https://www.rfc-editor.org/rfc/rfc7538.html), abril de 2015, que hizo estándar el `308` del [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) (junio de 2014, experimental), y la precaución con los clientes que no lo conocen (sección 4).
7. [Estándar Fetch, WHATWG](https://fetch.spec.whatwg.org/#http-redirect-fetch), algoritmo *HTTP-redirect fetch*: tras un `301` o `302` a un `POST`, el método pasa a `GET` y el cuerpo se descarta.
8. [Manual de `curl`](https://curl.se/docs/manpage.html): `-L` y la conversión de `POST` en `GET` tras `301`, `302` y `303`; `--post301`; `-d` y `-X`. Se leyó también en `man curl` de la versión 8.7.1.
9. [OWASP API Security Top 10, edición 2023: API7:2023 Server Side Request Forgery](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/): la definición de SSRF, por qué los *webhooks* y las vistas previas lo vuelven común, y la recomendación de desactivar redirecciones y usar listas de lo permitido.
10. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): los metadatos de la nube como objetivo, la lista mínima de rangos (con la multidifusión), las codificaciones alternativas de una IPv4, DNS rebinding y la conexión a la dirección ya validada.
11. [AWS, *Use the Instance Metadata Service to access instance metadata*](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) y [Alibaba Cloud, *View instance metadata*](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata): las direcciones `169.254.169.254` (y `[fd00:ec2::254]`) y `100.100.100.200` de sus servicios de metadatos.
12. [Estándar URL, WHATWG](https://url.spec.whatwg.org/#concept-ipv4-parser), el analizador IPv4: acepta una dirección escrita como un solo número, en hexadecimal o en octal, y la normaliza.
13. Los bloques de `destinos.ts`: los registros de direcciones de uso especial de la IANA, [IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) e [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/), y el [espacio de direcciones IPv6](https://www.iana.org/assignments/ipv6-address-space/) (`2000::/3`, *Global Unicast*); [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) (redes privadas), [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) (enlace local `169.254/16`), [RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html) (enlace local, multidifusión e IPv4 mapeada en IPv6), [RFC 4193](https://www.rfc-editor.org/rfc/rfc4193.html) (direcciones locales únicas), [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) (multidifusión IPv4), [RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html) (el prefijo de NAT64), [RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html) (6to4, febrero de 2001), [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) (espacio compartido `100.64/10`) y [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html) (el registro de direcciones de uso especial).
14. [Node.js 24: DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), [Node.js 24: Net](https://nodejs.org/docs/latest-v24.x/api/net.html) y [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): `dns.lookup` con `all: true` y su uso de la resolución del sistema, `net.BlockList` y las IPv4 escritas como IPv6, y la opción `lookup` de `http.request`.

### Términos de esta lección

| | |
|---|---|
| **DNS rebinding** | cambiar lo que resuelve un nombre entre la revisión y la conexión, para que el servidor se conecte a una dirección que no se revisó |
| **comparación débil** | la que usa `If-None-Match`: dos etiquetas coinciden si su texto entre comillas es igual, lleven `W/` o no |
| **`ETag`** (*entity tag*) | etiqueta opaca entre comillas que identifica una versión de un recurso |
| **identificador de arranque** | las ocho cifras al azar que el `revisor` sortea al arrancar y agrega a cada etiqueta, para que las etiquetas no se repitan tras un reinicio |
| **idempotente** | un método cuyo efecto en el servidor es el mismo si se repite que si se hace una vez |
| **lista blanca / lista negra** | una regla que nombra lo permitido y rechaza lo demás, o que nombra lo prohibido y acepta lo demás |
| **loopback** | las direcciones de la propia máquina: `127.0.0.0/8` y `::1` |
| **metadatos de la nube** | el servicio en `169.254.169.254` donde una nube publica datos de la máquina, a veces con credenciales |
| **petición condicional** | una petición que pide ejecutarse solo si se cumple una condición sobre la versión del recurso, como `If-None-Match` |
| **recurso de seguimiento** | el recurso al que apunta un `202`, donde el cliente pregunta cómo va la operación |
| **referencia relativa** | una dirección sin servidor ni puerto, como `/servicios/4`, que se completa con la de la petición |
| **SSRF** | lograr que un servidor haga una petición elegida por otra persona, desde la red del servidor |

---

**Siguiente:** [Lección 2 — El cliente se equivocó (I): 400, 401, 403, 404, 405 y 415](02-errores-del-cliente-peticion.md)

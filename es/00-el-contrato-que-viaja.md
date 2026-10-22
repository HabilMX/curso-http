# Lección 0 — El contrato que viaja por HTTP

Son las 23:40 de un viernes. El tablero del `revisor` dice que los cuatro servicios están arriba: `catalogo`, `inventario`, `pagos` y `reportes`, los cuatro en verde. El monitor de la empresa también está en verde: cero errores en la última hora. Y aun así, el chat de soporte se llena de mensajes de gente que no puede pagar. Alguien abre una terminal, le pide a `pagos` su estado y lee la respuesta completa por primera vez en la noche. La primera línea dice `HTTP/1.1 200 OK`. El cuerpo, tres líneas más abajo, dice `{"error": "la base de datos no está disponible"}`. Todos los programas que vigilaban el servicio leyeron la primera línea y se quedaron tranquilos. Ninguno leyó el cuerpo. El servicio llevaba cuarenta minutos caído, diciendo que estaba bien.

Esta lección es sobre esa primera línea: qué dice, quién la lee y por qué no puede mentir.

**Tiempo:** 90 min, o 2 × 45 (el corte está entre las secciones 0.4 y 0.5)

**Qué construyes:** el entorno del curso (Node 24 y `curl`), tu primer servidor HTTP y el **banco de pruebas** que vas a usar en todas las lecciones: un servidor que responde el código de estado que le pidas (`GET /codigo/503`) con las cabeceras que ese código lleva

**Qué aprendes:** qué es una respuesta HTTP (línea de estado, cabeceras, cuerpo); las cinco familias de códigos; **el código manda y el cuerpo explica**; qué hace un programa con un código que no conoce; dónde viven los registros oficiales de códigos, cabeceras y tipos de problema; y por qué un `200` con `{"error": …}` engaña a la caché, al monitor y al cliente

**De dónde vienes.** No traes nada de este curso todavía. Traes, eso sí, lo que pide el [README](README.md): ya escribiste alguna API, en el lenguaje que sea, sabes qué es una petición HTTP y qué es JSON, y lees un programa corto en TypeScript. No hace falta que conozcas ninguna especificación: cada vez que la lección cite una, te dice qué sección y qué dice.

**Qué no hace esta lección.** No enseña a elegir un código para una situación concreta: eso empieza en la [Lección 1](01-exitos-redirecciones.md) con los éxitos y sigue hasta la 4 con los errores. No da formato al cuerpo de los errores: aquí el cuerpo es una línea de texto, y la [Lección 5](05-problem-details.md) lo cambia por `application/problem+json`. Y la caché que aparece en la sección 0.8 es una caché **de juguete**, de sesenta renglones, que aplica dos reglas reales de las especificaciones; sirve para ver el problema con tus ojos, no para usarla en producción.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS con Node 24.14.1 y curl 8.7.1, y se repitieron completas en un contenedor de Ubuntu 24.04.5 (la base de Linux Mint 22) con Node 24.22.0 y curl 8.5.0, el `curl` que instala `apt`. Las dos corridas dieron lo mismo renglón por renglón salvo en tres cosas, que se avisan donde aparecen: la fecha de la cabecera `Date` (será la de tu día), la versión de `curl` que se ve en `curl -v`, y el número de error de «dirección ya en uso» (`-48` en macOS, `-98` en Linux). No se corrió en una instalación de escritorio de Mint. Los programas están en [`programas/00-el-contrato-que-viaja/`](../programas/00-el-contrato-que-viaja), en el repositorio del curso, cada uno con su corrida en un archivo `fig00_NN.salida.txt`. Todos pasan `tsc` en modo estricto (la sección 0.9 dice cómo comprobarlo).

## Al terminar vas a poder

- Levantar un servidor HTTP con Node 24 sin dependencias y consultarlo con `curl -i`, `curl -v` y `curl -I`.
- Señalar en una respuesta real la línea de estado, cada cabecera, la línea vacía y el cuerpo, y decir qué parte lee cada programa del camino.
- Decir la familia de cualquier código de tres cifras y qué debe hacer un cliente con un código que no conoce, citando la regla del RFC 9110.
- Provocar a voluntad cualquier código con el banco de pruebas y comprobar con `curl` qué cabeceras lleva.
- Encontrar un código o una cabecera en el registro de la IANA y contar cuántos códigos hay asignados en una familia sin caer en la trampa de los renglones «Unassigned».
- Demostrar con una corrida que un `200` con un error en el cuerpo pasa el chequeo de salud de `curl -f`, se queda guardado en una caché y le impide servir la copia buena.

## El porqué antes del cómo

Una API habla con muchos programas que no conoces. El que la llamó, sí: lo escribiste tú o alguien de tu equipo, y sabe leer tu JSON. Pero entre ese programa y tu servidor hay otros que nunca leyeron tu documentación: un balanceador que decide a qué máquina mandar cada petición, una caché que guarda respuestas para no repetir trabajo, un monitor que cuenta errores por minuto, un chequeo de salud que reinicia el servicio si no contesta bien, y el propio cliente HTTP de cada lenguaje, que trae sus reglas de fábrica. **Ninguno de ellos necesita entender tu cuerpo. Todos entienden el número.** (Hay pasarelas que inspeccionan el contenido, y clientes que sí lo leen; pero no puedes contar con ellas, y el número es lo único que todos tienen en común.)

Por eso la primera línea de una respuesta es un contrato. No es un contrato que firmes con una persona, sino con todo el software que ya existe y que sigue las mismas especificaciones. Cuando tu servidor responde `503`, cada uno de esos programas sabe algo sin preguntarte: el monitor lo cuenta como falla, el chequeo de salud lo marca, la caché puede servir una copia anterior, el cliente sabe que el problema no es suyo. Cuando responde `200`, todos concluyen que todo salió bien, diga lo que diga el cuerpo. La escena del principio no es exagerada: es lo que pasa cuando el número y el cuerpo dicen cosas distintas, y el número gana porque es lo único que leen casi todos.

En el `revisor` esto se vive de los dos lados. Como **cliente**, el `revisor` consulta servicios ajenos y decide si están arriba según lo que responden; si un servicio miente con un `200`, el `revisor` miente con él. Como **servidor**, el `revisor` es una API que alguien más va a consultar, y sus errores tienen que decir la verdad en el número para que sus propios clientes, monitores y cachés no se engañen.

La lección tiene cinco partes, en este orden:

1. **El entorno y la primera respuesta** (0.1 y 0.2): instalas Node 24, levantas un servidor de quince renglones y miras qué viaja de verdad.
2. **Las familias** (0.3): la primera cifra del código, y la pregunta que cada familia contesta.
3. **El banco de pruebas** (0.4): el servidor que responde el código que le pidas, y que vas a usar en todo el curso.
4. **Quién lee qué** (0.5 a 0.7): el código manda y el cuerpo explica; qué hace un programa con un código que no conoce; y dónde está escrito qué códigos existen.
5. **El daño** (0.8): una caché, un monitor y un cliente frente a un servidor que miente y otro que dice la verdad.

Con ese destino en mente, esto es lo que vas a ver en la sección 0.8: el mismo servicio caído, a través de una caché, en dos versiones. En la primera, el servidor respondió `200` con su error, y la caché lo guardó y lo repite. En la segunda, el servidor respondió `503`, y la caché sirvió la última copia buena:

```text
{"error":"la base de datos no está disponible"}
```

```text
{"servicios":["catalogo","pagos"]}
```

Lo único que cambió entre las dos corridas fue el número.

## Los conceptos

### 0.1 El entorno: Node 24, `curl` y una carpeta

#### 0.1.1 `curl`

`curl` es el instrumento del curso: un programa de terminal que hace una petición HTTP y te muestra lo que el servidor respondió, sin una pantalla bonita que esconda nada. Va primero porque lo necesitas para instalar Node, y después para todo lo demás. Si `curl --version` no responde, instálalo:

```bash
sudo apt install curl
```

#### 0.1.2 Node 24

Los programas del curso están en TypeScript y los ejecuta **Node.js 24**. Node 24 tiene una característica que este curso aprovecha: ejecuta un archivo `.ts` directamente, **quitándole los tipos** antes de correrlo, sin compilarlo a JavaScript y sin instalar nada más. La [documentación de Node 24](https://nodejs.org/docs/latest-v24.x/api/typescript.html) lo describe así: Node reemplaza las anotaciones de tipo por espacios y ejecuta lo que queda; por eso solo acepta TypeScript que se pueda «borrar» sin cambiar el programa. Lo que no se puede borrar así (un `enum`, un `namespace` con código, las propiedades declaradas en los parámetros de un constructor) da error, y los programas del curso no lo usan. Esa función está activa por omisión desde Node 23.6, dejó de imprimir el aviso de «experimental» en la 24.3 y se declaró estable en la 24.12.

¿Por qué Node 24 y no otra? Porque es una línea **LTS** (*long-term support*, soporte de largo plazo). Según el [calendario oficial de versiones de Node](https://github.com/nodejs/Release), la 24 entró a LTS el 28 de octubre de 2025, pasó a la etapa de mantenimiento el 20 de octubre de 2026 y recibe correcciones hasta el 30 de abril de 2028. La 26 será LTS a partir del 28 de octubre de 2026; los programas de este curso no usan nada que cambie entre las dos.

En Linux Mint 22 no conviene instalar Node con `apt`: Mint 22 se basa en Ubuntu 24.04, y el paquete `nodejs` de esa base es la versión 18.19.1 (se comprobó con `apt-cache policy nodejs` en un contenedor de Ubuntu 24.04), una línea que ya no recibe correcciones. Se instala con **nvm**, el administrador de versiones de Node que recomienda la [página de descargas de Node](https://nodejs.org/en/download), igual que en el curso de TypeScript de esta casa. La [documentación de nvm](https://github.com/nvm-sh/nvm) publica este instalador para su versión 0.40.8, la vigente:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

> **Nota de seguridad.** La tubería `| bash` ejecuta en tu máquina, sin que lo leas, lo que devuelva esa dirección. Aquí es razonable porque es el instalador oficial de `nvm`, por HTTPS y con una versión fija (`v0.40.8`), pero nunca lo hagas con una dirección que no conoces. Si quieres revisarlo antes, descárgalo a un archivo (`curl -o instalar-nvm.sh` con la misma dirección), léelo y córrelo después con `bash instalar-nvm.sh`.

Cierra la terminal, abre otra (el instalador agrega `nvm` a tu archivo de inicio, y la terminal que ya estaba abierta no se entera) y pide la línea 24:

```bash
nvm install 24
nvm alias default 24
node -v
```

`node -v` debe imprimir un número que empiece con `v24`. El número de después depende del día en que instales; las corridas de esta lección se hicieron con la 24.14.1 y la 24.22.0, y dieron lo mismo.

#### 0.1.3 La carpeta del curso

Todo el curso vive en una carpeta, `~/curso-http/`. Créala y entra en ella, porque todos los comandos de la lección se corren desde ahí:

```bash
mkdir -p ~/curso-http && cd ~/curso-http
```

Pon dentro un archivo `package.json` con una sola indicación:

```json
{
  "type": "module"
}
```

Ese archivo no instala nada; el curso no tiene dependencias. Solo le dice a Node, y a `tsc` si lo usas, que los archivos de esa carpeta son **módulos ESM**, la forma moderna de JavaScript, la que usa `import`. Sin él, Node tendría que adivinarlo cada vez.

### 0.2 Una respuesta por dentro

#### 0.2.1 El primer servidor

Este es el servidor HTTP más pequeño que vale la pena escribir. Guárdalo como `~/curso-http/fig00_01.ts`:

```ts
// fig00_01.ts
import { createServer } from "node:http";

const servidor = createServer((peticion, respuesta) => {
  console.log(`${peticion.method} ${peticion.url}`);
  const cuerpo = "el revisor está escuchando\n";
  respuesta.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(cuerpo),
  });
  respuesta.end(cuerpo);
});

servidor.listen(18080, "127.0.0.1", () => {
  console.log("escuchando en http://127.0.0.1:18080");
});
```

Se lee de arriba abajo. `node:http` es el módulo de Node que sabe hablar HTTP; el prefijo `node:` dice que viene con Node y no de un paquete externo. `createServer` recibe una función que Node llama **una vez por cada petición**, con dos objetos: la `peticion` que llegó y la `respuesta` que vas a escribir. La función imprime el método y la ruta (para que veas en la terminal del servidor qué le llegó), y luego escribe la respuesta en dos pasos. `writeHead` escribe el **código de estado** y las **cabeceras**; `end` escribe el **cuerpo** y cierra la respuesta.

Dos cabeceras, las dos con una razón. `Content-Type` dice qué es el cuerpo: texto plano en UTF-8. `Content-Length` dice cuántos **bytes** mide, y por eso se calcula con `Buffer.byteLength` y no con `cuerpo.length`: la «á» de «está» ocupa dos bytes en UTF-8, y el cuerpo mide 28 bytes aunque tenga 27 caracteres. Al final, `listen` abre el puerto 18080 en `127.0.0.1`, que es el nombre de «esta misma computadora»: nadie desde fuera de tu máquina puede llegar a este servidor, y así debe ser mientras practicas.

Córrelo en una terminal, que vas a dejar abierta:

```text
$ node fig00_01.ts
escuchando en http://127.0.0.1:18080
```

El programa no termina: se queda esperando peticiones hasta que lo detengas con `Ctrl`+`C`.

#### 0.2.2 Lo que viaja: `curl -i`

En **otra** terminal, pídele algo. La opción `-i` le dice a `curl` que muestre la respuesta completa, con su línea de estado y sus cabeceras, y no solo el cuerpo:

```text
$ curl -i http://127.0.0.1:18080/
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 07:27:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está escuchando
```

Esto es una respuesta HTTP, y tiene tres partes, siempre en el mismo orden:

| Parte | En la corrida | Quién la escribió |
|---|---|---|
| **Línea de estado** | `HTTP/1.1 200 OK` | tú, con el `200` de `writeHead`; Node agregó la versión y el `OK` |
| **Cabeceras** | de `Content-Type` a `Keep-Alive` | tú escribiste dos; Node agregó `Date`, `Connection` y `Keep-Alive` |
| **Cuerpo** | `el revisor está escuchando` | tú, con `end` |

Entre las cabeceras y el cuerpo hay **una línea vacía**. No es decoración: es la única forma que tiene quien lee de saber dónde terminan las cabeceras. Y el cuerpo termina donde dice `Content-Length`: 28 bytes, ni uno más. La especificación que define esta forma exacta, renglón por renglón, es el [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html), que describe HTTP/1.1 tal como viaja por la red. Lo que **significan** los códigos y las cabeceras está en otro documento, el [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), *HTTP Semantics*, que es el que más vas a citar en este curso. La separación tiene sentido: HTTP/2 y HTTP/3 viajan de otra forma, con otro formato binario, pero los códigos y las cabeceras significan lo mismo en las tres versiones.

Mira ahora la línea de estado con calma. Tiene tres piezas: la versión (`HTTP/1.1`), el código (`200`) y una frase (`OK`). La frase se llama *reason phrase*, y el RFC 9112, en su [sección 4](https://www.rfc-editor.org/rfc/rfc9112.html#section-4), dice algo que conviene recordar desde hoy: un cliente **debería ignorarla**, porque no es un canal de información confiable; puede venir traducida, la puede cambiar un intermediario o puede desaparecer al pasar a otra versión de HTTP. La frase es para la persona que lee la terminal. Para los programas, lo único que cuenta es el número. En la sección 0.5 vas a ver que hasta Node usa frases distintas de las oficiales para algunos códigos.

> **Nota sobre el nombre de la opción.** En las versiones recientes de `curl`, la opción larga de `-i` se llama `--show-headers` (antes se llamaba `--include`, y el nombre viejo sigue funcionando), según el [manual de `curl`](https://curl.se/docs/manpage.html). `-i` funciona igual en las dos.

#### 0.2.3 La petición también tiene forma: `curl -v`

Una conversación HTTP tiene dos mitades, y `-i` solo te enseña la segunda. Con `-v` (*verbose*, «con todo detalle»), `curl` te enseña también lo que **mandó**:

```text
$ curl -v http://127.0.0.1:18080/servicios
*   Trying 127.0.0.1:18080...
* Connected to 127.0.0.1 (127.0.0.1) port 18080
> GET /servicios HTTP/1.1
> Host: 127.0.0.1:18080
> User-Agent: curl/8.7.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=utf-8
< Content-Length: 28
< Date: Wed, 21 Oct 2026 07:27:41 GMT
< Connection: keep-alive
< Keep-Alive: timeout=5
< 
el revisor está escuchando
* Connection #0 to host 127.0.0.1 left intact
```

Los renglones con `*` son comentarios de `curl` sobre la conexión. Los que empiezan con `>` son la **petición**, tal como salió: una línea con el **método** (`GET`), la **ruta** (`/servicios`) y la versión, y luego sus propias cabeceras. Los que empiezan con `<` son la respuesta, la misma de antes. (En Linux vas a ver `curl/8.5.0` en `User-Agent`, o la versión que tengas; es lo único que cambia.)

Fíjate en dos cosas. La primera: la petición tiene la misma forma que la respuesta, una línea inicial, cabeceras, una línea vacía y, si hace falta, un cuerpo. La segunda: le pediste `/servicios` y el servidor respondió `200` con el mismo texto de siempre, porque este servidor no mira la ruta; solo la imprime. En su terminal apareció `GET /servicios`. Un servidor que responde `200` a una ruta que no existe ya es una pequeña mentira, y el banco de la sección 0.4 no la comete.

#### 0.2.4 Solo las cabeceras: `HEAD` y `curl -I`

Hay un método que existe para preguntar por una respuesta sin recibirla: `HEAD`. El servidor contesta exactamente lo que contestaría a un `GET`, cabeceras incluidas, pero sin cuerpo. `curl -I` manda un `HEAD`:

```text
$ curl -I http://127.0.0.1:18080/
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 07:27:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

`Content-Length` sigue diciendo 28, porque dice cuánto mediría el cuerpo de un `GET`, pero no llegó ningún cuerpo. Tu programa no hizo nada especial para eso: escribió el cuerpo con `end`, y Node, que sabe que la petición era `HEAD`, no lo mandó. En la terminal del servidor apareció `HEAD /`. Los chequeos de salud y algunos monitores usan `HEAD` justamente porque solo les importa el número, y el número llega igual.

Ya puedes detener el servidor con `Ctrl`+`C`. El resto de la lección usa el puerto 18080 para otros programas.

### 0.3 Cinco familias y una pregunta

El código de estado es un número de tres cifras, y **la primera cifra es la familia**. El RFC 9110 define cinco en su [sección 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), y cada una contesta una pregunta distinta:

| Familia | Lo que dice el RFC 9110 | La pregunta que contesta |
|---|---|---|
| `1xx` | la petición se recibió y el proceso continúa | ¿sigo esperando? Sí: esto no es la respuesta final |
| `2xx` | la petición se recibió, se entendió y se aceptó | ¿salió bien? Sí |
| `3xx` | hace falta otra acción para completarla | ¿dónde está? En otra parte, y te digo dónde |
| `4xx` | la petición tiene un error o no se puede cumplir | ¿quién se equivocó? Quien pidió |
| `5xx` | el servidor falló con una petición aparentemente válida | ¿quién se equivocó? Quien atiende |

La familia `1xx` es distinta de las otras cuatro, y conviene saberlo desde hoy. Una respuesta `1xx` es **intermedia**: según la [sección 15.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.2), una petición puede recibir cero o más respuestas `1xx` y después **exactamente una** respuesta final de las otras familias. Una `1xx` no puede llevar cuerpo, y nunca es la última palabra. Por eso el banco de pruebas de la siguiente sección se niega a producir una como respuesta final.

La pregunta de la última columna es la más útil del curso, y las lecciones 2 a 4 la convierten en un método. Cuando te llega un error, antes de leer nada más, mira la primera cifra. Un `4` dice que quien tiene que cambiar algo es quien hizo la petición: la entrada, la identidad, el permiso. Un `5` dice que la petición estaba bien y falló el servidor, y que quien la hizo no tiene nada que corregir, aunque eso no lo autoriza a repetirla a ciegas (la [Lección 6](06-reintentos-idempotencia.md) se ocupa de cuándo sí). Si quieres ver esta misma tabla aplicada a una API de contactos, con un servidor que miente y otro que no lado a lado, la primera entrega de la serie «HTTP y Problem Details» del boletín de esta casa, que se cita al final, la recorre código por código.

### 0.4 El banco de pruebas

#### 0.4.1 Para qué sirve

Para aprender qué hace un programa con un `503` necesitas un servidor que responda `503` cuando tú quieras. Esperar a que un servicio real se caiga no es un método, y provocarlo en un servicio ajeno no es correcto. El banco de pruebas resuelve eso: es un servidor que responde, en la ruta `/codigo/NNN`, el código `NNN` que le pidas, con las cabeceras que ese código exige o suele llevar. Lo vas a usar en todas las lecciones del curso, y por eso vale la pena leerlo con cuidado una vez.

#### 0.4.2 El programa

Guárdalo como `~/curso-http/fig00_02.ts`:

```ts
// fig00_02.ts
// El banco de pruebas del curso: responde el código que le pidas en /codigo/NNN.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PUERTO = 18080;

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
  console.log(`banco de pruebas en http://127.0.0.1:${PUERTO}/codigo/NNN`);
});
```

El programa tiene tres piezas.

**Dos tablas.** `NOMBRES` guarda la frase oficial de los 28 códigos que el curso usa (los 23 protagonistas y los cinco que aparecen de paso), copiada del registro de la IANA, que es la lista oficial de códigos (sección 0.7). `CABECERAS` guarda las cabeceras que cada código lleva. No todas tienen el mismo peso, y conviene decirlo con precisión: el RFC 9110 dice que un `401` **debe** llevar `WWW-Authenticate` con al menos un reto ([sección 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2)) y que un `405` **debe** llevar `Allow` con los métodos que sí se permiten ([sección 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6)). Para las redirecciones (`301`, `302`, `307`, `308`) el servidor **debería** mandar `Location`. Para el `201`, `Location` identifica el recurso creado, y si falta, el recurso creado es la propia ruta de la petición ([sección 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2)). Y `Retry-After` en un `503` es **opcional** según el RFC 9110, igual que en un `429` según el [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html), que es donde se definió ese código. Las lecciones 1 a 4 explican cada una a fondo; el banco solo te deja verlas.

**La función `enviar`.** Arma el cuerpo, una línea con el código y su nombre y otra con la explicación, y escribe la respuesta. Hay dos detalles. El primero: para `204`, `205` y `304` no escribe cuerpo ni `Content-Type`, porque esos tres códigos no pueden llevarlo: el RFC 9112 ([sección 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)) dice que una respuesta `204` o `304` termina en la primera línea vacía después de las cabeceras, y el RFC 9110 ([sección 15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6)) prohíbe generar contenido en un `205`. La lista no es toda la regla. Un `1xx` tampoco puede llevar cuerpo, pero el banco ya se niega a producir uno (lo viste en 0.3 y lo verás en 0.4.4); y una respuesta a `HEAD` nunca lleva cuerpo, de eso se encarga Node (0.2.4). Un `205` es raro (le pide al navegador que limpie el formulario que envió), pero el banco puede producirlo si se lo pides, y por eso está en la lista. El segundo: si el código está en `NOMBRES`, le pasa a `writeHead` la frase oficial; si no, deja que Node ponga la suya. La [documentación de `writeHead`](https://nodejs.org/docs/latest-v24.x/api/http.html) acepta los tres argumentos: el código, la frase (opcional) y las cabeceras.

**La función `atender`.** Es la puerta, y revisa en orden. Primero el método: el banco solo sabe responder `GET` y `HEAD`, y a cualquier otro le contesta `405` con su `Allow`; es decir, el banco cumple la regla que enseña. Después la ruta: tiene que ser `/codigo/` seguido de exactamente tres cifras, o el banco contesta `404` y dice cuál es la única ruta que existe. Y al final el número: menos de 100 no existe, un `1xx` no puede ser la respuesta final, y más de 599 es inválido según la especificación, pero el banco lo produce de todos modos, a propósito, porque en la sección 0.6 vas a necesitar ver qué hace un cliente con un código que no debería existir.

#### 0.4.3 Probarlo

Córrelo en una terminal y déjalo abierto:

```text
$ node fig00_02.ts
banco de pruebas en http://127.0.0.1:18080/codigo/NNN
```

En otra terminal, pídele un servicio caído:

```text
$ curl -i http://127.0.0.1:18080/codigo/503
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

503 Service Unavailable
lo pediste en /codigo/503
```

El código, su frase, la cabecera `Retry-After` («vuelve a intentar en 120 segundos») y un cuerpo que explica. Un recurso creado:

```text
$ curl -i http://127.0.0.1:18080/codigo/201
HTTP/1.1 201 Created
Location: /servicios/demo
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

201 Created
lo pediste en /codigo/201
```

Una respuesta sin contenido, que no trae cuerpo ni `Content-Type`, porque no hay nada que describir:

```text
$ curl -i http://127.0.0.1:18080/codigo/204
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

El `205` es del mismo tipo: sin cuerpo. Como el programa no escribe `Content-Length`, Node manda la respuesta en trozos, con un único trozo final de tamaño cero (la forma que explica 0.8.2); no hay contenido:

```text
$ curl -i http://127.0.0.1:18080/codigo/205
HTTP/1.1 205 Reset Content
Date: Wed, 21 Oct 2026 22:00:20 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

```

Una falta de identidad, con el reto que la especificación exige:

```text
$ curl -i http://127.0.0.1:18080/codigo/401
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 43
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

401 Unauthorized
lo pediste en /codigo/401
```

#### 0.4.4 Las tres puertas del banco

Ahora las tres validaciones de `atender`, para que veas que el propio banco también dice la verdad cuando el que se equivoca eres tú. Un método que no atiende (`-X DELETE` le dice a `curl` qué método usar):

```text
$ curl -i -X DELETE http://127.0.0.1:18080/codigo/200
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD
Content-Type: text/plain; charset=utf-8
Content-Length: 56
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

405 Method Not Allowed
el banco solo atiende GET y HEAD
```

Una ruta que no existe:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 68
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

404 Not Found
la única ruta es /codigo/NNN; prueba con /codigo/503
```

Y un `1xx` pedido como respuesta final:

```text
$ curl -i http://127.0.0.1:18080/codigo/103
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 76
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

400 Bad Request
un 1xx es una respuesta intermedia: no puede ser la última
```

Cada petición quedó anotada en la terminal del banco (`GET /codigo/503`, `DELETE /codigo/200`…). Deja el banco corriendo: lo necesitas en las dos secciones siguientes.

### 0.5 El código manda y el cuerpo explica

#### 0.5.1 Quién lee el número

Este es el primero de los tres criterios del curso, y se puede ver con una herramienta que seguramente ya tienes en algún guion: `curl -f`. Con `-f` (*fail*), `curl` deja de ser un instrumento para mirar y se vuelve un instrumento para **decidir**: si el código es `400` o mayor, no imprime el cuerpo y termina con el código de salida 22. El [manual de `curl`](https://curl.se/docs/manpage.html) lo define así: el código 22 significa que la página no se obtuvo porque el servidor respondió un código de 400 o más, y solo aparece con `--fail`. Muchos chequeos de salud son exactamente eso, un `curl -f` cuyo código de salida decide si el servicio está bien. `echo $?` muestra el código de salida del último comando:

```text
$ curl -f http://127.0.0.1:18080/codigo/200
200 OK
lo pediste en /codigo/200
$ echo $?
0
$ curl -f http://127.0.0.1:18080/codigo/503
curl: (22) The requested URL returned error: 503
$ echo $?
22
```

`curl -f` no leyó el cuerpo en ningún momento. No podía saber que «lo pediste en /codigo/503» no es una explicación muy útil; ni le importa. Decidió con el número, y con nada más.

El cliente HTTP de JavaScript hace lo mismo. Cuando usas `fetch`, la respuesta tiene una propiedad `ok`, y el [estándar Fetch](https://fetch.spec.whatwg.org/) la define en una frase: un estado *ok* es un estado entre 200 y 299, inclusive. Medio mundo escribe `if (respuesta.ok)` y sigue adelante. Si el servidor respondió `200` con `{"error": …}` adentro, ese `if` entra por la rama equivocada, y ningún programa del camino se va a dar cuenta. La sección 0.6 usa `fetch` contra el banco, y la 0.8 hace la cuenta completa del daño.

Por eso el criterio tiene dos mitades. **El código manda:** es la parte del mensaje que todos leen, y la que decide qué hacen. **El cuerpo explica:** es para quien necesita el detalle, una persona o un programa que entiende el formato de tu API. Y la condición que une a las dos es la que se rompe en la escena del principio: **los dos dicen lo mismo**. Un cuerpo puede agregar información al código, pero nunca contradecirlo ni sustituirlo. El RFC 9110 lo pide para las dos familias de errores: en un `4xx` y en un `5xx`, salvo cuando la petición es `HEAD`, el servidor **debería** mandar en el cuerpo una explicación del error y decir si es temporal o permanente ([secciones 15.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5) y [15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6)). Es decir: el número **y además** la explicación, no uno en lugar del otro.

#### 0.5.2 La frase de la línea de estado no es el mensaje

En 0.2.2 viste que un cliente debería ignorar la frase de la línea de estado. Aquí tienes la prueba de por qué. El banco usa las frases del registro oficial para sus 28 códigos, pero para cualquier otro deja que Node ponga la suya. Pídele un `418`, que no está en su tabla, solo las cabeceras:

```text
$ curl -I http://127.0.0.1:18080/codigo/418
HTTP/1.1 418 I'm a Teapot
Content-Type: text/plain; charset=utf-8
Content-Length: 57
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

Node lo llama «I'm a Teapot», «soy una tetera», que viene de un chiste: el [RFC 2324](https://www.rfc-editor.org/rfc/rfc2324.html), publicado el 1 de abril de 1998, que se burlaba de los abusos de HTTP. En el registro oficial, el `418` aparece como **(Unused)**, y la [sección 15.5.19 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.19) explica por qué: se usó como broma tantas veces que ya no sirve para ningún uso serio, así que quedó reservado. Y no es el único caso: la tabla de frases que trae Node llama al `422` «Unprocessable Entity» y al `413` «Payload Too Large», que eran los nombres viejos; el RFC 9110 los cambió a «Unprocessable Content» y «Content Too Large», y así aparecen en el registro. Por eso el banco trae su propia tabla.

Ninguna de esas diferencias rompe nada, y esa es la lección: **la frase puede decir cualquier cosa, y ningún programa debe decidir con ella**. Un cliente que compara la frase con `"Not Found"` deja de funcionar con el primer servidor que la traduce, la abrevia o la omite. El número es el mismo en todos.

### 0.6 Un código que la máquina no conoce

#### 0.6.1 La regla

Hay más de sesenta códigos asignados (sección 0.7), y aparecen nuevos de vez en cuando. Ningún programa los conoce todos, y la especificación lo sabe. El RFC 9110, en la introducción de su [sección 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), da una regla corta que conviene saber de memoria: un cliente no está obligado a entender todos los códigos registrados, pero **debe** entender la familia de cualquier código por su primera cifra, y **debe** tratar un código que no reconoce como el `x00` de su familia. El propio RFC pone el ejemplo: si llega un `471`, que no conoce, la primera cifra dice que algo estaba mal en la petición, y el cliente lo trata como si hubiera recibido un `400`.

La misma sección agrega una segunda regla: los valores fuera del rango de 100 a 599 son **inválidos**. Algunas bibliotecas usan números como 600 o 999 para comunicar errores internos que no son de HTTP, y si uno de esos llega a un cliente, el cliente **debería** tratarlo como un `5xx`. Es una decisión sensata: un número que no debería existir dice, sobre todo, que algo del lado del servidor está mal.

Con esas dos reglas, un programa que solo conoce un puñado de códigos puede reaccionar con sentido a cualquiera. Y por eso inventar códigos propios es mala idea (el curso no lo enseña, a propósito): tu `299 Casi listo` no lo entiende nadie más, y todos lo van a tratar como un `200` común.

#### 0.6.2 El lector que solo mira el número

Este programa lee las respuestas del banco como lo haría un monitor: no mira el cuerpo, solo el número, y aplica las dos reglas. Guárdalo como `~/curso-http/fig00_03.ts`:

```ts
// fig00_03.ts
// Lee solo el número, como lo hace un monitor o un balanceador.

// Los códigos que este lector conoce por su nombre: los del curso.
const CONOCIDOS = new Set([
  200, 201, 202, 204, 301, 302, 304, 307, 308,
  400, 401, 403, 404, 405, 406, 409, 410, 412, 413, 415, 422, 428, 429,
  500, 501, 502, 503, 504,
]);

const FAMILIAS = ["", "informativa", "éxito", "redirección", "error del cliente", "error del servidor"];

// La regla de la sección 15 del RFC 9110.
function comoSiFuera(codigo: number): number {
  if (codigo < 100 || codigo > 599) return 500; // inválido: se trata como un 5xx
  if (CONOCIDOS.has(codigo)) return codigo; // conocido: se trata como lo que es
  return Math.floor(codigo / 100) * 100; // desconocido: el x00 de su familia
}

for (const pedido of [200, 204, 299, 308, 404, 471, 503, 600]) {
  const respuesta = await fetch(`http://127.0.0.1:18080/codigo/${pedido}`, { redirect: "manual" });
  await respuesta.text();
  const trato = comoSiFuera(respuesta.status);
  const familia = FAMILIAS[Math.floor(trato / 100)];
  console.log(`${respuesta.status}  ok=${String(respuesta.ok).padEnd(5)}  se trata como ${trato} (${familia})`);
}
```

La función `comoSiFuera` es la regla escrita en tres renglones, en el orden en que hay que aplicarla: primero lo inválido, luego lo conocido, y al final lo desconocido, que se redondea al `x00` de su familia con `Math.floor(codigo / 100) * 100`. El ciclo le pide al banco ocho códigos, entre ellos dos que nadie registró (`299` y `471`) y uno inválido (`600`). Dos detalles de `fetch`: `redirect: "manual"` le dice que no siga el `Location` del `308` (por omisión lo seguiría y recibirías el `200` del destino, no el `308`), y `await respuesta.text()` lee el cuerpo y lo tira, para que la conexión quede libre. El `await` del ciclo funciona fuera de una función porque el archivo es un módulo, gracias al `package.json` de 0.1.3.

Con el banco corriendo, en la otra terminal:

```text
$ node fig00_03.ts
200  ok=true   se trata como 200 (éxito)
204  ok=true   se trata como 204 (éxito)
299  ok=true   se trata como 200 (éxito)
308  ok=false  se trata como 308 (redirección)
404  ok=false  se trata como 404 (error del cliente)
471  ok=false  se trata como 400 (error del cliente)
503  ok=false  se trata como 503 (error del servidor)
600  ok=false  se trata como 500 (error del servidor)
```

Lee la columna de `ok` y la de la derecha juntas. El `299` es *ok* para `fetch`, porque está entre 200 y 299, y el lector lo trata como un `200`: un código inventado en la familia del éxito se lee como éxito, que es justo lo que dice la regla. El `471` se lee como un `400`, el ejemplo del propio RFC. Y el `600`, que el banco produjo a propósito, se lee como un error del servidor. Nota también que el `308` no es *ok*: `ok` solo cubre la familia `2xx`, y una redirección no es un éxito todavía. Un programa que hace `if (!respuesta.ok) reportarFalla()` sin mirar más va a reportar como falla cada redirección; es el tipo de detalle que la [Lección 7](07-quien-lee-el-error.md) convierte en una tabla de decisión.

Ya puedes detener el banco con `Ctrl`+`C`.

### 0.7 Los registros oficiales

#### 0.7.1 Quién decide qué códigos existen

Ni Node, ni `curl`, ni este curso deciden qué códigos existen. Lo decide un proceso público. El RFC 9110, en su [sección 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1), establece que los códigos se registran en el **registro de códigos de estado de HTTP** que mantiene la **IANA** (*Internet Assigned Numbers Authority*, el organismo que administra los números y nombres oficiales de los protocolos de internet). Cada registro tiene tres datos: el código, una descripción corta y la referencia a la especificación que lo define. Y agregar un código nuevo exige una revisión de la IETF, el grupo que escribe los estándares de internet; no basta con que alguien lo use.

El [registro](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) se puede descargar como CSV, y se contó el 21 de octubre de 2026, en su versión actualizada el 15 de septiembre de 2025: hay **62 códigos asignados**. Por familia: 5 en `1xx`, 10 en `2xx`, 8 en `3xx`, 28 en `4xx` y 11 en `5xx`. Además hay dos números reservados sin uso, el `306` y el `418`, y rangos enteros sin asignar. Uno de los 62 es temporal: el `104`, registrado mientras se termina el borrador que lo define, con fecha de vencimiento en noviembre de 2026. El curso usa 23 de los 62, y el ejercicio 3 te pide repetir el conteo de la familia `4xx` con tus propias manos, porque tiene una trampa.

#### 0.7.2 Los otros tres registros que vas a usar

Los códigos no son lo único que se registra. A lo largo del curso vas a consultar otros tres registros de la IANA, y conviene saber hoy que existen:

| Registro | Qué guarda | Dónde aparece en el curso |
|---|---|---|
| [Nombres de campos de HTTP](https://www.iana.org/assignments/http-fields/http-fields.xhtml) | cada cabecera, con su estado (permanente, provisional, obsoleta) y la especificación que la define | `Location`, `Allow`, `Retry-After` o `WWW-Authenticate`, en cada lección |
| Tipos de medios | los valores válidos de `Content-Type`, como `application/json` o `application/problem+json` | Lección 5 |
| [Tipos de problema de HTTP](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml) | identificadores estándar para el campo `type` de un *Problem Details* | Lección 5 |

El registro de cabeceras se descargó el mismo día: tiene 260 nombres, y no todos están vigentes; 39 están marcados como obsoletos y 8 como desaprobados, de modo que «está en el registro» no significa «se debe usar». El de tipos de problema es mucho más pequeño: lo creó el [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), la especificación de los *Problem Details* que la Lección 5 enseña completa, y hoy tiene seis entradas, la primera de ellas `about:blank`.

Una nota sobre el criterio: cuando una lección diga que un código «significa» algo o que una cabecera «exige» algo, la fuente es una de estas especificaciones, enlazada en la sección de fuentes de la lección, y el registro de la IANA es el árbitro de qué existe. Cuando el curso tome una decisión que la especificación deja abierta (como `400` frente a `422`), lo va a decir: es criterio de diseño, no norma.

### 0.8 Por qué un `200` con `{"error": …}` rompe la caché, el monitor y al cliente

#### 0.8.1 El experimento

Ya viste por separado que `curl -f` y `fetch` deciden con el número. Falta el tercer lector del camino, el que más daño hace cuando se equivoca porque se equivoca **para todos**: la caché. Una **caché compartida** es un programa entre los clientes y el servidor que guarda respuestas y las repite, para que el servidor no calcule mil veces lo mismo. Las reglas de cuándo puede guardar algo están en el [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html), y hay dos que importan aquí.

La primera regla es de la [sección 3 del RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-3): una caché puede guardar una respuesta, entre otras condiciones, si la respuesta lo autoriza explícitamente, por ejemplo con `Cache-Control: max-age=N` («reutilízame durante N segundos»). La segunda es de una extensión, el [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html#section-4): con `stale-if-error=N`, el servidor autoriza a la caché a seguir sirviendo una copia vencida durante N segundos **si al pedir una nueva encuentra un error**. Y el RFC define «error» con una lista cerrada: cualquier situación que resulte en un `500`, `502`, `503` o `504`. La caché reconoce el error por el número. Si el número dice `200`, para la caché no hubo error.

Este programa pone las dos piezas lado a lado: un **origen** que puede estar sano, mentir o decir la verdad, y una caché de juguete delante que aplica esas dos reglas, y solo esas. Guárdalo como `~/curso-http/fig00_04.ts`:

```ts
// fig00_04.ts
// Un origen que puede estar sano, mentir o decir la verdad, y una caché de juguete delante.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type Modo = "sano" | "mentiroso" | "honesto";
let modo: Modo = "sano";

// ---------- El origen, en el puerto 18081 ----------

function origen(peticion: IncomingMessage, respuesta: ServerResponse): void {
  const cambio = /^\/modo\/(sano|mentiroso|honesto)$/.exec(peticion.url ?? "");
  if (peticion.method === "PUT" && cambio !== null) {
    modo = cambio[1] as Modo;
    console.log(`origen: ahora estoy ${modo}`);
    respuesta.writeHead(204).end();
    return;
  }
  if (modo === "honesto") {
    respuesta.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "120",
    });
    respuesta.end("la base de datos no está disponible\n");
    return;
  }
  const cuerpo = modo === "sano"
    ? '{"servicios":["catalogo","pagos"]}\n'
    : '{"error":"la base de datos no está disponible"}\n';
  // Esta ruta declara que sus respuestas se pueden reutilizar 5 segundos.
  respuesta.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=5, stale-if-error=600",
  });
  respuesta.end(cuerpo);
}

// ---------- La caché, en el puerto 18080 ----------

type Copia = { cuerpo: string; tipo: string; guardadaEn: number; maxAge: number; staleIfError: number };
let copia: Copia | undefined;

// Los únicos códigos que stale-if-error considera un error (RFC 5861, sección 4).
const ERRORES = new Set([500, 502, 503, 504]);

function directiva(cacheControl: string, nombre: string): number | undefined {
  const encontrada = new RegExp(`${nombre}=(\\d+)`).exec(cacheControl);
  return encontrada === null ? undefined : Number(encontrada[1]);
}

function servirCopia(respuesta: ServerResponse, guardada: Copia, edad: number): void {
  respuesta.writeHead(200, { "Content-Type": guardada.tipo, Age: String(Math.floor(edad)) });
  respuesta.end(guardada.cuerpo);
}

async function cache(_peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  const edad = copia === undefined ? Infinity : (Date.now() - copia.guardadaEn) / 1000;
  if (copia !== undefined && edad < copia.maxAge) {
    console.log("caché: tengo una copia fresca; no le pregunto al origen");
    servirCopia(respuesta, copia, edad);
    return;
  }
  const delOrigen = await fetch("http://127.0.0.1:18081/servicios");
  const cuerpo = await delOrigen.text();
  const cacheControl = delOrigen.headers.get("cache-control") ?? "";
  if (ERRORES.has(delOrigen.status) && copia !== undefined && edad < copia.maxAge + copia.staleIfError) {
    console.log(`caché: el origen respondió ${delOrigen.status}; sirvo la copia anterior`);
    servirCopia(respuesta, copia, edad);
    return;
  }
  const maxAge = directiva(cacheControl, "max-age");
  if (delOrigen.status === 200 && maxAge !== undefined) {
    copia = {
      cuerpo,
      tipo: delOrigen.headers.get("content-type") ?? "application/octet-stream",
      guardadaEn: Date.now(),
      maxAge,
      staleIfError: directiva(cacheControl, "stale-if-error") ?? 0,
    };
    console.log(`caché: guardé la respuesta 200 por ${maxAge} s`);
  } else {
    console.log(`caché: el origen respondió ${delOrigen.status}; no la guardo`);
  }
  const cabeceras: Record<string, string> = {};
  for (const nombre of ["content-type", "cache-control", "retry-after"]) {
    const valor = delOrigen.headers.get(nombre);
    if (valor !== null) cabeceras[nombre] = valor;
  }
  respuesta.writeHead(delOrigen.status, cabeceras);
  respuesta.end(cuerpo);
}

createServer(origen).listen(18081, "127.0.0.1", () => {
  console.log("origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)");
});
createServer((peticion, respuesta) => void cache(peticion, respuesta)).listen(18080, "127.0.0.1", () => {
  console.log("caché en http://127.0.0.1:18080/servicios");
});
```

El **origen** tiene una puerta de control, `PUT /modo/...`, para cambiar de humor sin reiniciarlo, y a cualquier otra petición, con el método y la ruta que sea, le contesta según su modo. La puerta es un interruptor de laboratorio: no pide identidad, así que cualquiera que llegue al puerto puede tumbar el servicio; aquí no importa porque escucha solo en `127.0.0.1`, pero una ruta para inyectar fallas nunca debe existir en un servicio real. Sano, responde `200` con la lista. Mentiroso, responde `200` con un error en el cuerpo, **con las mismas cabeceras de caché**: es lo realista, porque esas cabeceras suelen estar configuradas para la ruta entera, no para cada respuesta. Honesto, responde `503` con `Retry-After` y `Cache-Control: no-store` («no guardes esto»).

La **caché** hace cuatro cosas, en este orden. Si tiene una copia que todavía no cumple sus `max-age` segundos, la sirve sin preguntarle al origen. Si no, le pregunta al origen. Si el origen respondió uno de los cuatro errores de la lista y la copia vencida todavía está dentro de su ventana de `stale-if-error`, sirve la copia vieja. Y si el origen respondió `200` con `max-age`, guarda la respuesta nueva **en lugar** de la anterior. Cuando sirve una copia, agrega la cabecera `Age`, los segundos que lleva guardada, que es la cabecera estándar para eso según la [sección 5.1 del RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.1). Una caché de verdad aplica muchas más reglas; esta aplica dos, y es suficiente para ver el problema. Los `max-age` de 5 segundos son cortos a propósito, para que el experimento no tarde; en un servicio real serían minutos.

#### 0.8.2 Primera corrida: el origen miente

Córrelo en una terminal. En otra, pide la lista a través de la caché, haz que el origen empiece a mentir, espera a que la copia venza (`sleep 6`), y vuelve a pedir dos veces:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/mentiroso
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Age: 0
Date: Wed, 21 Oct 2026 07:28:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
```

Y esto escribió el programa en su terminal:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: guardé la respuesta 200 por 5 s
caché: tengo una copia fresca; no le pregunto al origen
```

Sigue la historia renglón por renglón. La primera petición encontró la caché vacía, le preguntó al origen sano y guardó la lista. Después de que la copia venció, la caché volvió a preguntar, el origen respondió `200` con su error, y la caché hizo lo correcto según lo que vio: un `200` con `max-age` es una respuesta buena y reutilizable, así que **la guardó encima de la copia buena**. La tercera petición ya ni siquiera llegó al origen: la caché repitió el error, con `Age: 0`, a quien fuera que preguntara. Con un `max-age` de cinco minutos, el error se repetiría cinco minutos a todos los clientes, aunque el servicio ya se hubiera recuperado. Y la copia buena, la que `stale-if-error` estaba ahí para proteger, se perdió.

Las cabeceras en minúsculas de las respuestas que pasaron por el origen (`content-type`, `cache-control`) no son un error: `fetch` entrega los nombres en minúsculas y la caché los reenvió así. Los nombres de las cabeceras no distinguen mayúsculas de minúsculas, según la [sección 5.1 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1), y ningún programa debe compararlos de otra forma.

Tampoco es un error que falte `Content-Length` y aparezca `Transfer-Encoding: chunked`. En 0.2.2 el cuerpo terminaba donde decía `Content-Length`, pero `fig00_04.ts` no calcula el tamaño antes de `writeHead`, y entonces Node manda el cuerpo **en trozos** (*chunks*): la [documentación de Node](https://nodejs.org/docs/latest-v24.x/api/http.html) dice que mandar `Content-Length` es lo que desactiva esa forma, que es la de omisión. Según la [sección 7.1 del RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1), cada trozo lleva su propio tamaño delante, y un trozo de tamaño cero marca el final. Son dos maneras de decir dónde acaba el cuerpo; `curl` entiende las dos y te muestra el mismo cuerpo.

Falta el monitor. Pregúntale directamente al origen mentiroso con el chequeo de salud de 0.5:

```text
$ curl -f http://127.0.0.1:18081/servicios
{"error":"la base de datos no está disponible"}
$ echo $?
0
```

El chequeo pasó. El servicio está caído y el chequeo de salud dice que está bien. Ese es el monitor en verde de la escena del principio.

#### 0.8.3 Segunda corrida: el origen dice la verdad

Detén el programa con `Ctrl`+`C` y vuelve a arrancarlo, para empezar con la caché vacía. Ahora el origen pasa a honesto:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/honesto
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Age: 6
Date: Wed, 21 Oct 2026 07:28:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -f http://127.0.0.1:18081/servicios
curl: (22) The requested URL returned error: 503
$ echo $?
22
```

Y en la terminal del programa:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy honesto
caché: el origen respondió 503; sirvo la copia anterior
```

Mismo servicio, misma caída, otro número. La caché recibió un `503`, lo reconoció como error porque está en la lista del RFC 5861, y sirvió la última copia buena, con `Age: 6` para que quien quiera sepa que tiene seis segundos de vieja. Los clientes siguen viendo la lista de servicios mientras el origen se recupera. Y el chequeo de salud, que le pregunta directo al origen, falló con el código 22: el monitor se pone rojo, alguien recibe una alerta y empieza a trabajar. **El `503` protegió a los clientes y avisó a quien opera, a la vez.** El `200` mentiroso hizo lo contrario en los dos frentes.

Ese es el daño completo, medido: la **caché** guarda el error y pierde la copia buena; el **monitor** sigue en verde; y el **cliente**, que hace `if (respuesta.ok)`, cree que recibió datos. Los tres decidieron bien con lo que leyeron. El que se equivocó fue el número.

Detén el programa con `Ctrl`+`C`. No queda nada escuchando.

### 0.9 Revisar los tipos con `tsc` (opcional)

Node quita los tipos y ejecuta; **no los revisa**. Si escribes `const x: number = "a"`, Node lo corre sin quejarse. Por eso el curso revisa sus programas con `tsc`, el compilador de TypeScript, en modo estricto, y tú puedes hacer lo mismo cuando quieras. No es parte del curso y no hace falta para ninguna lección. Dentro de `~/curso-http/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --types node fig00_01.ts fig00_02.ts fig00_03.ts fig00_04.ts
```

El primer comando trae el compilador y las descripciones de tipos de Node a una carpeta `node_modules/`, sin anotarlos en `package.json` (eso hace `--no-save`). El segundo revisa los cuatro programas sin generar archivos (`--noEmit`); `--erasableSyntaxOnly` le pide que rechace lo que Node no sabría borrar, y `--verbatimModuleSyntax` que exija `import type` donde solo se importa un tipo, como en `fig00_02.ts`. Son las opciones que recomienda la documentación de Node para este modo de trabajo. Si todo está bien, `tsc` no imprime nada y termina con código 0, que es lo que dio con los cuatro programas de esta lección.

## El error que vas a ver

**El puerto ocupado.** Es el error que más vas a ver en este curso, porque todos los programas usan el puerto 18080. Si arrancas un servidor mientras otro sigue escuchando en ese puerto, Node se detiene así:

```text
$ node fig00_01.ts
node:events:486
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use 127.0.0.1:18080
    at Server.setupListenHandle [as _listen2] (node:net:1948:16)
    at listenInCluster (node:net:2005:12)
    at node:net:2214:7
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
Emitted 'error' event on Server instance at:
    at emitErrorNT (node:net:1984:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -48,
  syscall: 'listen',
  address: '127.0.0.1',
  port: 18080
}

Node.js v24.14.1
```

Se lee por la línea que empieza con `Error:`: `listen` falló con `EADDRINUSE`, dirección ya en uso, en `127.0.0.1:18080`. Las líneas con `at` son el camino interno de Node y no te dicen nada útil aquí. En Linux, `errno` dice `-98` en lugar de `-48` (es el mismo error con el número de otro sistema), y los números de línea de `node:net` cambian con la versión de Node. Casi siempre la causa es un programa anterior del curso que sigue corriendo en otra terminal: búscala y detenlo con `Ctrl`+`C`. Si no la encuentras, pregúntale al sistema qué proceso escucha en ese puerto: en Linux, `ss -ltnp 'sport = :18080'` lo muestra con su número como `pid=NNNN`; en macOS, `lsof -iTCP:18080 -sTCP:LISTEN` lo muestra en la columna `PID`. Con ese número lo detienes: `kill NNNN`.

**Nadie escuchando.** El error opuesto: le pides algo a un puerto donde no hay ningún servidor. Ya no es un error de Node sino de `curl`:

```text
$ curl -i http://127.0.0.1:18080/
curl: (7) Failed to connect to 127.0.0.1 port 18080 after 0 ms: Couldn't connect to server
```

Fíjate en lo que **no** hay: no hay línea de estado, ni cabeceras, ni código. No hubo respuesta HTTP, porque no hubo conversación. Esa distinción importa mucho para el `revisor`: «el servicio respondió `503`» y «no se pudo conectar» son fallas distintas, con causas distintas, y el `revisor` las va a reportar distinto. El código 7 de `curl` dice «no me pude conectar»; el 22 de la sección 0.5 dice «me conecté y el servidor respondió un error». Un guion que solo mira si el código de salida es distinto de cero no distingue las dos.

## Lo que se hace mal

**Responder `200` con el error en el cuerpo.** Ya mediste el costo en 0.8: la caché lo guarda y pierde la copia buena, el chequeo de salud pasa y el cliente que confía en `ok` sigue de largo. El arreglo no es agregarle al cuerpo un campo `"exito": false` más visible: es poner en el número la verdad.

**Decidir con la frase de la línea de estado.** `if (statusText === "Not Found")` deja de funcionar con el primer servidor que la traduce o la omite, y el RFC 9112 avisa que la frase se puede perder al pasar a otra versión de HTTP. Viste en 0.5.2 que Node y el registro oficial ya usan frases distintas para tres códigos.

**Inventar códigos propios.** Un `299` o un `471` hecho en casa no lo entiende nadie más, y la regla de 0.6 hace que todos los traten como `200` o `400`. Si lo que querías decir no cabe en un código registrado, cabe en el cuerpo, y la Lección 5 te da el formato.

**Escribir un cliente que solo conoce sus códigos.** Un `switch` que reconoce `200`, `404` y `500`, y trata todo lo demás como «error desconocido», convierte un `204` en una falla. La regla del `x00` existe justamente para que eso no pase.

**Tratar «no se pudo conectar» como un código.** Algunos programas convierten una conexión rechazada en un `500` o en un `0` falso, para que «todo sea un número». Se pierde la información más útil: si el servidor respondió o no.

**Medir con un servidor que no mira la ruta.** El servidor de 0.2.1 responde `200` a `/servicios`, a `/lo-que-sea` y a todo lo demás. Sirve para ver la forma de una respuesta y para nada más; un servidor así engaña a cualquier prueba que le hagas.

## Ejercicios

Los cuatro se corrigen solos: cada uno termina con una corrida que te dice si acertaste. Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada.

### Ejercicio 1 — Cuatro códigos que el lector no conoce

Sin correr nada, predice para cada uno de estos códigos tres cosas: qué dice `respuesta.ok`, cómo lo trata `comoSiFuera` y qué código de salida da `curl -f`. Los códigos son `226`, `418`, `451` y `799`. Después cambia la lista del ciclo de `fig00_03.ts` por `[226, 418, 451, 799]`, corre el banco y el lector, y compara. Para `curl -f`, usa `curl -s -o /dev/null -w '%{http_code}\n' -f` seguido de la dirección, y luego `echo $?`.

### Ejercicio 2 — Seguir la redirección

Con el banco corriendo, predice qué imprime `curl -i -L http://127.0.0.1:18080/codigo/308`. La opción `-L` le dice a `curl` que siga el `Location`. ¿Cuántas líneas de estado vas a ver? ¿Qué ruta aparece en el cuerpo final? ¿Y qué escribe el banco en su terminal? Corre el comando y compara.

### Ejercicio 3 — Contar la familia `4xx` en el registro

Descarga el registro de códigos de la IANA en CSV:

```bash
curl -s -o codigos.csv https://www.iana.org/assignments/http-status-codes/http-status-codes-1.csv
```

Cuenta cuántos códigos `4xx` hay **asignados** usando `grep`. Después busca qué especificación define el `429` y el `451`, y qué dice el registro del `418`. Compara tu conteo con el de la sección 0.7.1: si no te dio 28, la solución explica por qué.

### Ejercicio 4 — Un mentiroso que no deja guardar

Alguien propone un arreglo para el problema de 0.8 que no toca el número: que el origen mentiroso mande `Cache-Control: no-store` en sus errores, para que la caché no los guarde. Copia `fig00_04.ts` como `ej4.ts` y cambia la cabecera de la respuesta `200` por esta, que solo autoriza a guardar las respuestas sanas:

```ts
    "Cache-Control": modo === "sano" ? "max-age=5, stale-if-error=600" : "no-store",
```

Antes de correrlo, predice qué ve un cliente de la caché cuando el origen miente, y si la caché sirve la copia buena. Después repite la primera corrida de 0.8.2 con `ej4.ts` y compara. ¿El arreglo resuelve el problema?

## Soluciones

Las cuatro soluciones se corrieron con [`soluciones.sh`](../programas/00-el-contrato-que-viaja/soluciones.sh), que crea las copias `ej1.ts` y `ej4.ts` en una carpeta temporal y usa los puertos del curso; su salida completa está en `soluciones.salida.txt`. Las fechas de las cabeceras cambian en cada corrida; lo demás debe coincidir.

### Solución 1

```text
$ node ej1.ts
226  ok=true   se trata como 200 (éxito)
418  ok=false  se trata como 400 (error del cliente)
451  ok=false  se trata como 400 (error del cliente)
799  ok=false  se trata como 500 (error del servidor)
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/226; echo $?
226
0
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/418; echo $?
418
22
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/451; echo $?
451
22
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/799; echo $?
799
22
```

(Aquí `ej1.ts` es tu copia de `fig00_03.ts` con la lista cambiada; si editaste `fig00_03.ts` directamente, el comando es `node fig00_03.ts`.) El `226` (*IM Used*) existe en el registro, pero no está en la tabla del lector, así que se trata como el `200` de su familia, y `ok` es `true` porque está entre 200 y 299. El `418` y el `451` (*Unavailable For Legal Reasons*, que también existe) se tratan como `400`. El `799` es inválido y se trata como `500`. Para `curl -f` no hay sorpresas: todo lo que es `400` o más da 22, y sí, eso incluye al `799` inválido. Si fallaste en el `451`, fíjate en la lección del ejercicio: que un código exista en el registro no significa que tu programa lo conozca, y para eso está la regla del `x00`.

### Solución 2

```text
$ curl -i -L http://127.0.0.1:18080/codigo/308
HTTP/1.1 308 Permanent Redirect
Location: /codigo/200
Content-Type: text/plain; charset=utf-8
Content-Length: 49
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 33
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

200 OK
lo pediste en /codigo/200
```

Dos líneas de estado: `curl` muestra con `-i` las cabeceras de **cada** respuesta del camino, pero el cuerpo solo de la última. El cuerpo del `308` existió (49 bytes, lo dice su `Content-Length`), pero `curl` no lo muestra porque siguió de largo. La ruta final es `/codigo/200`, la del `Location`, que es relativa: `curl` la completó con el servidor y el puerto de la petición original. En la terminal del banco aparecieron dos renglones, `GET /codigo/308` y `GET /codigo/200`: fueron dos peticiones, no una. Lo que cambia entre `301` y `308` cuando la petición es un `POST` es tema de la Lección 1.

### Solución 3

```text
$ grep -E '^4[0-9]{2},' codigos.csv | wc -l
31
$ grep -E '^4[0-9]{2},' codigos.csv | grep -vc -e Unassigned -e Unused
28
$ grep -E '^(418|429|451),' codigos.csv
418,(Unused),"[RFC 9110, Section 15.5.19]"
429,Too Many Requests,[RFC 6585]
451,Unavailable For Legal Reasons,[RFC 7725]
```

La trampa es la del primer comando: da 31, no 28. El registro escribe los huecos de dos maneras. Los huecos grandes van como un rango en un solo renglón (`432-450,Unassigned`), y el patrón `^4[0-9]{2},` no los cuenta porque después de las tres cifras viene un guion y no una coma. Pero los huecos de un solo número van en su propio renglón, con su número (`427,Unassigned` y `430,Unassigned`), y el patrón sí los cuenta. Súmale el `418`, que no está asignado sino reservado sin uso, y tienes los tres renglones de más. El segundo comando los quita y da 28, el mismo número que salió en 0.7.1 con un programa que lee el CSV columna por columna; cuando un conteo importa, se hace dos veces de dos formas distintas. El `429` lo define el RFC 6585, el `451` el RFC 7725, y el `418` aparece como `(Unused)` con referencia a la sección 15.5.19 del RFC 9110, que es la que explica por qué quedó reservado.

### Solución 4

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 08:05:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/mentiroso
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: no-store
Date: Wed, 21 Oct 2026 08:05:49 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: no-store
Date: Wed, 21 Oct 2026 08:05:49 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -f http://127.0.0.1:18081/servicios
{"error":"la base de datos no está disponible"}
$ echo $?
0
```

Y en la terminal del programa:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: el origen respondió 200; no la guardo
caché: el origen respondió 200; no la guardo
```

El arreglo limita el daño, pero no lo resuelve. La caché ya no guarda el error, así que no se lo repite a todos durante minutos: cada petición vuelve a preguntarle al origen. Pero tampoco sirve la copia buena, que seguía ahí, porque `stale-if-error` solo se activa con un `500`, `502`, `503` o `504`, y lo que llegó fue un `200`. El cliente ve el error en cada petición, el chequeo de salud sigue pasando, y la copia buena no sirve de nada. Compáralo con la segunda corrida de 0.8.3: el `503` hizo las tres cosas bien a la vez. Ninguna cabecera compensa un número equivocado.

## Cómo sé que lo logré

- [ ] `node -v` empieza con `v24`, y `curl --version` responde.
- [ ] Con `fig00_01.ts` corriendo, señalas en la salida de `curl -i` la línea de estado, cada cabecera, la línea vacía y el cuerpo, y explicas por qué `Content-Length` dice 28 y no 27.
- [ ] Explicas qué muestra `curl -v` que `curl -i` no muestra, y qué significan los renglones con `>` y con `<`.
- [ ] `curl -i http://127.0.0.1:18080/codigo/503` contra el banco da `503 Service Unavailable` con `Retry-After: 120`, y `curl -i -X DELETE` da `405` con `Allow: GET, HEAD`, igual que en 0.4.3.
- [ ] `node fig00_03.ts` imprime las ocho líneas de 0.6.2, y explicas sin mirar por qué el `471` se trata como `400` y el `600` como `500`.
- [ ] Dices de memoria la regla del `x00` y en qué sección del RFC 9110 está.
- [ ] Repetiste las dos corridas de 0.8 y tus terminales muestran lo mismo que la lección, salvo la fecha: el error guardado con `Age: 0` en la primera, y la copia buena con `Age: 6` y el código de salida 22 en la segunda.
- [ ] Tu conteo de códigos `4xx` asignados en el registro de la IANA dio 28, y sabes por qué el conteo ingenuo da 31.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/` da el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Cuáles son las tres partes de una respuesta HTTP y qué las separa?
2. ¿Por qué un cliente debería ignorar la frase de la línea de estado? Da un ejemplo de esta lección.
3. ¿Qué pregunta contesta cada una de las cinco familias, y por qué la `1xx` es distinta de las otras cuatro?
4. ¿Qué debe hacer un cliente con un código que no conoce? ¿Y con uno mayor que 599?
5. ¿Quién decide qué códigos existen, y dónde se consulta la lista?
6. ¿Qué significa «el código manda y el cuerpo explica»? ¿Qué pasa cuando los dos no dicen lo mismo?
7. En la caché de 0.8, ¿por qué el `200` mentiroso pierde la copia buena y el `503` la conserva?
8. ¿En qué se distinguen el error 7 y el error 22 de `curl`, y por qué esa diferencia le importa al `revisor`?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), sección 15: las cinco familias, la regla del `x00` para un código desconocido y la de los valores fuera de 100 a 599. Es la fuente principal de esta lección y del curso.
2. [RFC 9110, secciones 15.5 y 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5): en un `4xx` y en un `5xx`, el servidor debería explicar el error en el cuerpo, salvo en una respuesta a `HEAD`.
3. [RFC 9110, secciones 15.3.2, 15.5.2 y 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2): `Location` en el `201`, `WWW-Authenticate` obligatoria en el `401` y `Allow` obligatoria en el `405`, las cabeceras del banco.
4. [RFC 9110, sección 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1): el registro de códigos de estado de la IANA y la revisión de la IETF que exige un código nuevo.
5. [RFC 9112, *HTTP/1.1*](https://www.rfc-editor.org/rfc/rfc9112.html), sección 4: la forma de la línea de estado y por qué un cliente debería ignorar la frase.
6. [RFC 9111, *HTTP Caching*](https://www.rfc-editor.org/rfc/rfc9111.html), secciones 3 y 5.1: cuándo una caché puede guardar una respuesta y qué dice la cabecera `Age`.
7. [RFC 5861, *HTTP Cache-Control Extensions for Stale Content*](https://www.rfc-editor.org/rfc/rfc5861.html), sección 4: `stale-if-error` y la lista cerrada de códigos que cuentan como error (`500`, `502`, `503`, `504`).
8. [RFC 6585, *Additional HTTP Status Codes*](https://www.rfc-editor.org/rfc/rfc6585.html): define el `428` y el `429`, y el `Retry-After` opcional del `429`.
9. [Registro de códigos de estado de HTTP, IANA](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml), versión actualizada el 15 de septiembre de 2025: de aquí salen los 62 códigos asignados, las frases del banco y el `418` reservado sin uso.
10. [Registro de nombres de campos de HTTP, IANA](https://www.iana.org/assignments/http-fields/http-fields.xhtml): las 260 cabeceras registradas y su estado.
11. [Registro de tipos de problema de HTTP, IANA](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml), creado por el [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html): seis entradas, la primera `about:blank`. Se usa en la Lección 5.
12. [Estándar Fetch, WHATWG](https://fetch.spec.whatwg.org/): la definición de un estado *ok* (de 200 a 299) que usa `respuesta.ok`.
13. [Manual de `curl`](https://curl.se/docs/manpage.html): `-i` (`--show-headers`), `-v`, `-I`, `-f` y el código de salida 22.
14. [Node.js 24: TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html) y [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): la ejecución de `.ts` quitando tipos, la sintaxis que no admite, las opciones recomendadas de `tsc` y la firma de `writeHead`.
15. [Calendario de versiones de Node.js](https://github.com/nodejs/Release) y [nvm](https://github.com/nvm-sh/nvm): las fechas de LTS de Node 24 y 26, y el instalador de nvm 0.40.8.

### Lectura complementaria

- La serie **«HTTP y Problem Details»** de [En construcción](https://enconstruccionmx.substack.com/), el boletín de esta casa, en cuatro entregas. La primera, «El 200 que mentía», cuenta con una historia distinta la misma idea de esta lección y recorre trece códigos con una API de contactos, un servidor que miente y otro que no; la segunda desarma el formato de los *Problem Details* que este curso enseña en la Lección 5; la tercera y la cuarta lo implementan en Spring Boot, Quarkus, ASP.NET Core, FastAPI y Go. Este curso no las repite: si te quedaste con ganas de ver los códigos con otro ejemplo, o de ver el formato en tu lenguaje, empieza por ahí.

### Términos de esta lección

| | |
|---|---|
| **cabecera** (*header field*) | cada renglón `Nombre: valor` entre la línea de estado y el cuerpo; los nombres no distinguen mayúsculas |
| **caché compartida** | programa entre clientes y servidor que guarda respuestas y las repite a cualquier cliente |
| **chequeo de salud** | prueba automática que decide si un servicio está bien, casi siempre por el código de estado |
| **código de estado** | el número de tres cifras de la línea de estado; su primera cifra es la familia |
| **familia** | la clase de un código según su primera cifra: `1xx` a `5xx` |
| **IANA** | el organismo que mantiene los registros oficiales de códigos, cabeceras y tipos de medios |
| **línea de estado** | el primer renglón de una respuesta: versión, código y frase |
| ***reason phrase*** | la frase después del código (`OK`, `Not Found`); decorativa, un cliente debería ignorarla |
| **respuesta intermedia** | una respuesta `1xx`: llega antes de la respuesta final y nunca la sustituye |
| **LTS** | *long-term support*: una línea de versiones que recibe correcciones durante años |

---

**Siguiente:** [Lección 1 — Éxitos y redirecciones: 200, 201, 202, 204, 301, 308 y 304](01-exitos-redirecciones.md)

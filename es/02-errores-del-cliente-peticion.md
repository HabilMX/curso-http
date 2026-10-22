# Lección 2 — El cliente se equivocó (I): 400, 401, 403, 404, 405 y 415

Son las 02:10 de un martes y el `revisor` lleva tres semanas en producción, abierto a cualquiera que llegue a su puerto. Esta noche alguien del equipo de nómina escribió un guion para dar de alta sus servicios y lo dejó corriendo. El guion manda los datos como formulario y no como JSON, y el `revisor` le contesta `400` a cada intento, con el mismo renglón de siempre. El guion solo mira el código, y para él un `400` es un `400`: no sabe leer la frase del cuerpo, así que vuelve a mandar lo mismo. Mientras tanto, en otra terminal, un practicante descubre que con un `DELETE` cualquiera puede retirar el servicio de pagos de otro equipo, porque el `revisor` no pregunta quién es nadie. Y en una tercera, un guion que nadie reconoce recorre `/servicios/1`, `/servicios/2`, `/servicios/3`… y anota en cuál responde algo distinto. A las 02:40 ya tiene la lista completa de lo que vigila la empresa. Tres problemas distintos, y la API los atiende todos con dos códigos y una puerta que no existe.

Esta lección construye esa puerta: siete preguntas, siempre en el mismo orden, y un código distinto para cada respuesta.

**Tiempo:** 90 min, o 2 × 45 (el corte está entre las secciones 2.4 y 2.5)

**Qué construyes:** la puerta de la API del `revisor`: ruta, método, credencial, permiso, existencia, tipo de contenido y lectura del cuerpo, con un código distinto para cada falla; y un pequeño programa que intenta adivinar qué servicios existen, para comprobar que la puerta no lo deja

**Qué aprendes:** las siete preguntas de la puerta y por qué van en este orden: ruta → método → credencial → permiso → existencia → formato → lectura; `401` frente a `403`; `404` frente a `405`; `415` y `413` frente a `400`; `WWW-Authenticate` y `Allow`, las dos cabeceras que la especificación hace obligatorias; y cuándo un `404` esconde a propósito un recurso que sí existe, con el recuadro de seguridad sobre la **enumeración de recursos**

**De dónde vienes.** De la [Lección 1](01-exitos-redirecciones.md), con el `revisor` que da de alta, consulta, retira y revisa servicios, y que redirige sus rutas viejas con `301` y `308`. Ese `revisor` ya responde dos errores, un `400` y un `404`, pero la Lección 1 los usó como red de seguridad y te prometió explicarlos aquí. Y tiene tres huecos que esta lección cierra: no sabe quién le habla, no distingue entre una ruta que no existe y un método que no admite, y acepta cualquier cuerpo que parezca JSON, venga con el tipo que venga.

**Qué no hace esta lección.** No enseña autenticación de verdad: las credenciales son cuatro palabras escritas en el código, y en una API real vienen de un proveedor de identidad, con tokens que vencen y se firman (el [README](README.md) explica por qué el curso deja ese tema fuera). No enseña el `422`: aquí, todo lo que no se puede usar del cuerpo responde `400`, y la [Lección 3](03-errores-del-cliente-estado.md) separa lo que no se puede leer de lo que se lee pero no se puede cumplir. Y los cuerpos de error siguen siendo una línea de texto; la [Lección 5](05-problem-details.md) los cambia por `application/problem+json`.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS con Node 24.14.1 y curl 8.7.1, y ninguna depende de algo propio de macOS. En tu corrida van a cambiar dos cosas: la fecha de la cabecera `Date` y las ocho cifras finales de cada `ETag` (`"3-1-80925024"` en la corrida de la lección), que el `revisor` sortea cada vez que arranca; la sección 2.7.4 explica por qué, y cuando una petición necesite la etiqueta, copia la que te salió a ti en la respuesta anterior. El `revisor` guarda todo en memoria: para obtener lo mismo que la lección, arráncalo de nuevo antes de cada serie de peticiones, porque un alta o un retiro anterior cambia las respuestas. Los programas están en [`programas/02-errores-del-cliente-peticion/`](../programas/02-errores-del-cliente-peticion), en el repositorio del curso: el `revisor` en `fig02_01/`, el enumerador en `fig02_02.ts`, las versiones rotas de «El error que vas a ver» en `defectos/`, y cada corrida en su archivo `.salida.txt`. Todos pasan `tsc` en modo estricto, con el comando de la sección 0.9 de la Lección 0 más la opción `--allowImportingTsExtensions`, que hace falta desde que el `revisor` tiene varios archivos que se importan entre sí con su extensión `.ts`.

## Al terminar vas a poder

- Recitar las siete preguntas de la puerta en orden y predecir, para una petición dada, en cuál se detiene y qué código responde.
- Distinguir con una corrida un `401` de un `403`, y un `404` de un `405`, y decir qué cabecera exige cada uno.
- Escribir la cabecera `WWW-Authenticate` de un `401` y la cabecera `Allow` de un `405`, y citar la sección del RFC 9110 que las hace obligatorias.
- Rechazar un cuerpo con el tipo equivocado con `415` y `Accept`, y uno que no se puede leer con `400`.
- Demostrar con un programa que la API no revela qué servicios de otro equipo existen, y explicar qué cambio en el código bastaría para que sí lo revelara.
- Explicar por qué una tabla de credenciales escrita como objeto de JavaScript puede aceptar una credencial que nadie dio de alta.

## El porqué antes del cómo

Un error del cliente es un código `4xx`, y la Lección 0 te dio la pregunta que contesta esa familia: **¿quién se equivocó? Quien pidió.** Pero «quien pidió se equivocó» no le sirve de mucho a quien pidió. Lo que necesita saber es **qué** hizo mal, porque cada equivocación se arregla distinto:

| Si el problema es… | Quien pidió tiene que… | Código |
|---|---|---|
| la ruta no existe | revisar la dirección | `404` |
| la ruta existe, pero no con ese método | usar otro método, de los que dice `Allow` | `405` |
| no dijo quién es, o lo dijo mal | autenticarse | `401` |
| dijo quién es, pero no le toca | pedirle permiso a alguien, o rendirse | `403` |
| el recurso no existe (para él) | dejar de buscarlo | `404` |
| mandó el cuerpo en un formato que no se acepta | cambiar el formato, al que dice `Accept` | `415` |
| el cuerpo no se puede leer | corregir el cuerpo | `400` |

Cada renglón es una acción distinta, y casi siempre la ejecuta un programa, no una persona. El guion de la escena del principio reintentaba porque, para un programa, un `400` es un `400`: el cuerpo decía «el cuerpo no es JSON», pero un programa no interpreta frases, y el código era el mismo que para cualquier otro cuerpo inválido. Con un `415` y un `Accept: application/json`, el **código** le habría dicho que el problema era el formato y cuál usar. (Y el guion también estaba mal escrito: ningún cliente bien hecho repite sin cambios una petición que recibió un `4xx`, porque esa familia dice que quien tiene que cambiar algo es quien pidió.) **Un código bien elegido le dice al cliente qué hacer**, que es el segundo criterio del curso, y la [Lección 7](07-quien-lee-el-error.md) convierte esta tabla en el programa que decide.

La tabla tiene otra propiedad, menos visible y más importante: **está en orden**. No es lo mismo preguntar primero «¿quién eres?» y después «¿existe?» que al revés. Si el `revisor` le dice a un desconocido «ese servicio no existe» antes de preguntarle quién es, ya le contó algo. Si le dice «ese servicio es de otro equipo», le contó que existe. El orden de las preguntas decide qué aprende de tu API quien no debería aprender nada, y por eso esta lección dedica tanto espacio a él.

La lección tiene cuatro partes:

1. **La puerta** (2.1): las siete preguntas y por qué van en ese orden.
2. **Las cuatro preguntas de la puerta** (2.2 a 2.4): ruta y método (`404`, `405`), credencial (`401`) y permiso (`403`).
3. **Las tres del manejador** (2.5 y 2.6): existencia (`404`, el que esconde) y formato y lectura (`415`, `400`), con el recuadro de seguridad.
4. **El `revisor` completo** (2.7): los archivos y la corrida de todos los casos.

## Los conceptos

### 2.1 La puerta: siete preguntas en orden

#### 2.1.1 Las preguntas

Empieza por dos peticiones que ya conoces de la escena del principio: una sin credencial y otra con un método que la ruta no admite.

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1
```

Dos peticiones, dos códigos distintos: cada una se detuvo en una pregunta diferente. Estas son las siete:

Cuando una petición llega al `revisor`, antes de hacer cualquier cosa con ella, pasa por una serie de preguntas. Cada una tiene una respuesta de sí o no, y un «no» detiene la petición en ese punto con un código propio:

| # | Pregunta | Si la respuesta es «no» | Dónde se contesta |
|---|---|---|---|
| 1 | ¿Existe la ruta? | `404` | `rutas.ts` |
| 2 | ¿La ruta admite este método? | `405` + `Allow` | `rutas.ts` |
| 3 | ¿Quién eres? | `401` + `WWW-Authenticate` | `rutas.ts` |
| 4 | ¿Puedes hacer esto? | `403` | `rutas.ts` |
| 5 | ¿Existe el recurso, para ti? | `404` | el manejador, en `servicios.ts` |
| 6 | ¿El cuerpo viene en un formato que acepto? | `415` + `Accept` | el manejador |
| 7 | ¿Lo puedo leer? | `400`, o `413` si pasa del tope de tamaño | el manejador |

Dicho en una línea: **ruta → método → credencial → permiso → existencia → formato → lectura**. Son siete preguntas y siete pasos. Las cuatro primeras las contesta la puerta, en `rutas.ts`, igual para todas las rutas. Las tres últimas dependen de lo que pide cada ruta, y por eso las contesta el manejador: solo un `POST` trae cuerpo, y solo una ruta con `{id}` apunta a un recurso que puede no existir. Una petición que pasa las siete llega a hacer su trabajo y responde un éxito, de los que viste en la Lección 1.

Antes de la primera pregunta hay un paso que ya conoces: las rutas heredadas. `/viejo/servicios` y `/api/servicios` se redirigen con `301` y `308` sin preguntar nada más, porque una redirección no entrega ningún dato: solo dice dónde está la ruta nueva, y ahí empiezan las preguntas. Las Lecciones 3 y 4 agregan otras dos paradas en ese mismo lugar, antes de todo (la versión retirada de la API y el modo mantenimiento), y ninguna cambia el orden de las siete.

#### 2.1.2 Por qué este orden

El orden no es arbitrario, y no es el único posible. Sale de tres reglas, que conviene tener presentes porque son las que vas a usar cuando diseñes tu propia puerta.

**Primera regla: no se puede contestar una pregunta sin las anteriores.** No puedes decir si un método se admite sin saber de qué ruta hablas; no puedes decir si alguien puede hacer algo sin saber quién es; no puedes leer un cuerpo sin saber si está en un formato que entiendes. Esa regla sola fija buena parte del orden: ruta antes que método, credencial antes que permiso, formato antes que lectura.

**Segunda regla: quien no se identificó no aprende nada de los datos.** La credencial va antes que la existencia. Si fuera al revés, un desconocido podría pedir `/servicios/1`, `/servicios/2` y `/servicios/3` y saber, por la diferencia entre un `404` y lo que sea que responda después, cuáles existen. Con la credencial primero, un desconocido recibe `401` en todas, exista el servicio o no. Lo mismo vale para el cuerpo: si el `revisor` validara el cuerpo antes de pedir la credencial, cualquiera podría aprender, a fuerza de `400`, qué campos espera el alta y qué valores admite, sin haberse identificado nunca. Y además el servidor gastaría trabajo leyendo cuerpos de quien no tiene derecho a mandarlos.

**Tercera regla: el permiso que depende del rol va antes que la existencia.** Un lector no puede borrar nada, exista o no. Por eso el `403` llega antes que la pregunta por el recurso, y la respuesta a «un lector intenta borrar el servicio 99» es `403`, no `404`, aunque el 99 no exista. Así el `403` no dice nada sobre qué existe: depende solo de la credencial y del método, no del identificador. Lo vas a ver con una corrida en la sección 2.4.

Queda una decisión que no sale de ninguna regla y que conviene llamar por su nombre: **la ruta y el método van antes que la credencial**. El `revisor` le contesta `404` a una ruta que no existe y `405` a un método que no se admite aun a quien no dijo quién es. Eso le cuenta a un desconocido qué rutas y qué métodos tiene la API. El `revisor` lo hace a propósito, porque esa información ya es pública: está en su documentación, y en la [Lección 8](08-contrato-verificable.md) va a estar en una descripción OpenAPI que cualquiera puede leer. Lo que esconde la puerta son los **datos**, no la forma de la API. Hay APIs que deciden distinto y responden `401` a todo lo que llega sin credencial, incluso a una ruta que no existe; es una decisión defendible cuando la forma de la API también es secreta. Ninguna especificación obliga a una o a otra: **es criterio de diseño, no norma**, y lo que sí es obligatorio es escribirlo y aplicarlo igual en todas las rutas.

#### 2.1.3 El código de la puerta

La puerta vive en la función `atender` de `rutas.ts`, que en la Lección 1 era un ciclo de seis renglones. Ahora tiene las cuatro primeras preguntas escritas una tras otra, numeradas igual que en la tabla. El archivo completo está en la sección 2.7; aquí va la función, para leerla con la tabla al lado:

```ts
export async function atender(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  console.log(`${peticion.method} ${peticion.url}`);
  const url = new URL(peticion.url ?? "/", "http://revisor");
  if (redirigir(url.pathname, url.search, respuesta)) return;

  // 1. ¿Existe la ruta?
  let ruta: Ruta | undefined;
  let parametros: string[] = [];
  for (const candidata of RUTAS) {
    const encontrada = candidata.patron.exec(url.pathname);
    if (encontrada !== null) {
      ruta = candidata;
      parametros = encontrada.slice(1);
      break;
    }
  }
  if (ruta === undefined) {
    fallar(respuesta, 404, "no existe esa ruta");
    return;
  }

  // 2. ¿Admite este método?
  const nombreMetodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  // Object.hasOwn y no ruta.metodos[nombreMetodo] a secas: el método lo escribe el cliente, y un objeto
  // también «tiene» lo que hereda de Object.prototype (constructor, toString…). Igual que las credenciales.
  const metodo = Object.hasOwn(ruta.metodos, nombreMetodo) ? ruta.metodos[nombreMetodo] : undefined;
  if (metodo === undefined) {
    fallar(respuesta, 405, `${peticion.method} no se admite en ${url.pathname}`, { Allow: permitidos(ruta) });
    return;
  }

  // 3. ¿Quién eres?
  const identificacion = identificar(peticion);
  if (identificacion.tipo !== "valida") {
    const detalle = motivo(identificacion);
    fallar(respuesta, 401, detalle, { "WWW-Authenticate": reto(identificacion) });
    return;
  }

  // 4. ¿Puedes?
  if (!puede(identificacion.credencial, metodo)) {
    fallar(respuesta, 403, "tu credencial solo puede leer; para escribir pide una con rol de escritor");
    return;
  }

  // 5, 6 y 7. ¿Existe el recurso? ¿En qué formato viene? ¿Se puede leer? Lo decide cada manejador.
  await metodo.manejador({ peticion, respuesta, parametros, credencial: identificacion.credencial });
}
```

Se lee de arriba abajo, y cada bloque termina en un `return` si la respuesta es «no». La primera pregunta busca la ruta por su patrón, **sin mirar el método**: esa es la diferencia con la Lección 1, donde la ruta y el método se buscaban juntos y un método equivocado no encontraba nada y caía en el `404`. Separarlos es lo que permite contestar `405`. La segunda pregunta busca el método dentro de la ruta encontrada, tratando `HEAD` como `GET`, y lo busca con `Object.hasOwn`, por una razón que la sección 2.3.3 explica. La tercera y la cuarta usan `autenticacion.ts`, que es nuevo. Y al final, la puerta llama al manejador y le pasa la credencial, para que el manejador pueda contestar las tres preguntas que le tocan.

Fíjate en cómo se declara la tabla de rutas: cada método dice si **lee** o **escribe**.

```ts
type Manejador = (contexto: Contexto) => void | Promise<void>;
// Cada método dice qué función lo atiende y qué rol mínimo exige.
type Metodo = { manejador: Manejador; escribe: boolean };
type Ruta = { patron: RegExp; metodos: Record<string, Metodo> };

const lee = (manejador: Manejador): Metodo => ({ manejador, escribe: false });
const escribe = (manejador: Manejador): Metodo => ({ manejador, escribe: true });

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: lee(listar), POST: escribe(darDeAlta) } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: lee(consultar), DELETE: escribe(retirar) } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: escribe(pedirRevision) } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: lee(consultarRevision) } },
];
```

`lee` y `escribe` son dos funciones de un renglón que envuelven al manejador con esa marca. La marca es lo que usa la pregunta 4: un lector puede usar los métodos que leen y no los que escriben. Es un modelo de permisos deliberadamente pequeño, de tres roles, pero tiene la propiedad que importa: **el permiso se declara junto a la ruta**, en el mismo renglón, y no escondido dentro de cada manejador, donde es fácil olvidarlo en uno.

### 2.2 Ruta y método: `404` y `405`

#### 2.2.1 Una ruta que no existe

La primera pregunta es la más sencilla. Si nadie en la tabla reconoce la ruta, la respuesta es `404 Not Found`. El RFC 9110 lo define en la [sección 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): el servidor no encontró una representación actual del recurso pedido, **o no está dispuesto a revelar que existe**. Guarda la segunda mitad de esa frase; la vas a necesitar en la sección 2.5.

```text
$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta
```

`/servicioss`, con una «s» de más, no está en la tabla, y la puerta se detiene en la pregunta 1. Nota que la petición sí traía una credencial válida, y no importó: la puerta todavía no llegó a mirarla.

#### 2.2.2 Un método que la ruta no admite

La segunda pregunta es la que el `revisor` de la Lección 1 no sabía contestar. `/servicios/1` existe, pero solo admite `GET` (para consultar) y `DELETE` (para retirar). Si le mandas un `PATCH`:

```text
$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1
```

`405 Method Not Allowed`. El RFC 9110 lo define en la [sección 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6): el servidor conoce el método, pero el recurso no lo admite. Y en la misma sección pone la primera de las dos cabeceras obligatorias de esta lección: el servidor **debe** (*MUST*) mandar en un `405` una cabecera `Allow` con la lista de métodos que el recurso sí admite. La [sección 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.1), que define `Allow`, lo repite y agrega que se puede mandar en cualquier otra respuesta, pero que en un `405` es obligatoria.

¿Por qué obligatoria? Porque sin ella el `405` no dice qué hacer. «Ese método no» deja al cliente probando métodos a ciegas; «ese método no, estos sí» le da la corrección completa. `Allow: GET, HEAD, DELETE` dice exactamente lo que puedes hacer con `/servicios/1`. La función `permitidos` de `rutas.ts` la arma con los métodos de la tabla, y agrega `HEAD` justo detrás de `GET`, porque toda ruta que admite `GET` admite también `HEAD` (Node no manda el cuerpo; lo viste en la Lección 0).

Este es el error que el `revisor` de la Lección 1 cometía a propósito: a ese mismo `PATCH` le contestaba `404 no existe esa ruta`. Era mentira, y una mentira que cuesta: un cliente que recibe `404` concluye que la dirección está mal y se pone a buscar otra, cuando la dirección estaba bien y lo que había que cambiar era el método.

#### 2.2.3 `405` frente a `501`

Hay un código vecino que conviene distinguir: `501 Not Implemented`. La [sección 9.1 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1) traza la frontera: si el servidor **no reconoce o no implementa** el método en ninguna parte, debería responder `501`; si lo reconoce y lo implementa, pero **no para este recurso**, debería responder `405`. El `revisor` responde `405` a cualquier método **que Node conoce** y que la ruta no admite, como `PATCH` o `PUT`. A un método inventado, como `BORRAR`, ni siquiera llega: el analizador HTTP de Node lo rechaza antes con un `400 Bad Request` sin cuerpo (lo vas a ver con `-X constructor` en la sección 2.3.3). Según el RFC, ahí correspondería un `501`, pero esa decisión la toma Node y no el `revisor`. El `501` no es protagonista de este curso: lo produce el laboratorio en `/codigo/501` si lo quieres ver.

Una sutileza que vale la pena comprobar con tus manos: la ruta de revisiones, `/servicios/{id}/revisiones`, solo admite `POST`. ¿Qué pasa si le haces un `HEAD`?

```text
$ curl -i -I http://127.0.0.1:18080/servicios/1/revisiones
HTTP/1.1 405 Method Not Allowed
Allow: POST
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`405` con `Allow: POST`. `HEAD` solo se admite donde se admite `GET`, y esta ruta no tiene `GET`. Y la petición no traía credencial: la puerta se detuvo en la pregunta 2 sin llegar a la 3, como dice el orden.

### 2.3 ¿Quién eres?: `401` y `WWW-Authenticate`

#### 2.3.1 Credencial ausente, credencial inválida

La tercera pregunta necesita que el cliente diga quién es. En HTTP eso se hace con la cabecera `Authorization`, y el `revisor` usa el esquema más común en APIs: **`Bearer`**, definido en el [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html). La petición manda `Authorization: Bearer <credencial>`, y quien tenga la credencial (quien la «porte», de ahí el nombre) es quien dice ser. Por eso mismo, en una API real una credencial `Bearer` solo viaja cifrada, por `https`: el RFC 6750, en su [sección 5.3](https://www.rfc-editor.org/rfc/rfc6750.html#section-5.3), exige que los clientes usen siempre TLS, porque quien la lea en el camino puede usarla. El curso usa `http` solo porque todo ocurre dentro de tu máquina, en `127.0.0.1`, y nada sale a la red. Las credenciales del curso son cuatro, escritas en `autenticacion.ts`:

| Credencial | Equipo | Rol |
|---|---|---|
| `lectura-a` | a | lector |
| `escritura-a` | a | escritor |
| `escritura-b` | b | escritor |
| `admin` | todos | admin |

Sin credencial:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial
```

Con una credencial que no existe:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer inventada'
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor", error="invalid_token"
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la credencial no es válida
```

Las dos son `401 Unauthorized`, y las dos traen la segunda cabecera obligatoria de la lección. La [sección 15.5.2 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2) define el `401` así: la petición no se aplicó porque le faltan credenciales de autenticación válidas para el recurso. Y en la frase siguiente: el servidor que genera un `401` **debe** mandar una cabecera `WWW-Authenticate` con al menos un **reto** (*challenge*) que aplique al recurso. El reto le dice al cliente **cómo** autenticarse: con qué esquema (`Bearer`) y en qué ámbito (`realm="revisor"`, un nombre para el espacio protegido). Un `401` sin `WWW-Authenticate` es como un letrero de «identifíquese» que no dice con qué.

La diferencia entre las dos respuestas está en el reto. Cuando no vino credencial, el reto es solo `Bearer realm="revisor"`. Cuando vino una que no sirve, agrega `error="invalid_token"`. Esa regla no es del `revisor`, es del RFC 6750, en su [sección 3.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-3.1): `invalid_token` es el código para una credencial vencida, revocada, malformada o inválida por cualquier otra razón, y va con un `401`; pero si la petición **no trae ninguna información de autenticación** (porque el cliente no sabía que hacía falta, o porque usó **un método de autenticación que el servidor no admite**), el servidor **no debería** incluir en el reto un código de error ni otra información de error (los atributos `error`, `error_description` y `error_uri`). El cuerpo de la respuesta queda fuera de esa regla, y el `revisor` lo usa para explicar en español qué pasó. La distinción le sirve al cliente: «no mandaste nada» se arregla mandando la credencial; «mandaste una que no sirve» se arregla consiguiendo otra.

Esa última frase del RFC tiene un caso que conviene ver: un cliente que manda su usuario y contraseña con el esquema `Basic`, el de la ventanita de usuario y contraseña que abre el navegador (lo define el [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html)). No mandó una credencial `Bearer` mala: no mandó ninguna `Bearer`. El `revisor` responde el reto **sin** código de error, y lo dice en el cuerpo:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Basic bGVjdHVyYS1hOg=='
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 33
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo se admite el esquema Bearer
```

Y un detalle más, de la [sección 11.1 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1): el nombre del esquema de autenticación **no distingue mayúsculas**. `Bearer`, `bearer` y `BEARER` son el mismo esquema, y un servidor que solo acepta la primera rechaza a clientes que cumplen la especificación:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 279
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

La lista ya trae el servicio 4, que se dio de alta antes en la misma corrida (la sección 2.7 la muestra completa). Lo que sí distingue mayúsculas es la credencial misma: `Bearer Lectura-a` es una credencial que no existe.

Una nota sobre el nombre, porque confunde a todo el mundo una vez: el `401` se llama *Unauthorized*, «no autorizado», pero lo que dice es **no autenticado**: no sé quién eres. «No autorizado» en el sentido de «sé quién eres y no te toca» es el `403`, el de la sección siguiente. El nombre es una herencia de las primeras versiones de HTTP y ya no se puede cambiar; el significado está en la especificación, no en la frase.

#### 2.3.2 `autenticacion.ts`

```ts
// fig02_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
import type { IncomingMessage } from "node:http";

export type Credencial = { nombre: string; equipo: string; rol: "lector" | "escritor" | "admin" };

// Credenciales de práctica. En una API real vienen de un proveedor de identidad, no del código.
// Van en un Map y no en un objeto literal: CREDENCIALES[token] sobre un objeto también encuentra lo
// que hereda de Object.prototype, y «Bearer constructor» o «Bearer toString» pasarían como válidas.
// Map.get solo devuelve lo que se guardó con set.
const CREDENCIALES = new Map<string, Credencial>([
  ["lectura-a", { nombre: "lectura-a", equipo: "a", rol: "lector" }],
  ["escritura-a", { nombre: "escritura-a", equipo: "a", rol: "escritor" }],
  ["escritura-b", { nombre: "escritura-b", equipo: "b", rol: "escritor" }],
  ["admin", { nombre: "admin", equipo: "*", rol: "admin" }],
]);

// «ninguna»: no vino Authorization. «otro-esquema»: vino, pero no es Bearer (Basic, por ejemplo).
// «invalida»: vino Bearer con una credencial que no existe o mal escrita.
export type Identificacion =
  | { tipo: "ninguna" }
  | { tipo: "otro-esquema" }
  | { tipo: "invalida" }
  | { tipo: "valida"; credencial: Credencial };

export function identificar(peticion: IncomingMessage): Identificacion {
  const cabecera = peticion.headers.authorization;
  if (cabecera === undefined) return { tipo: "ninguna" };
  // credentials = auth-scheme [ 1*SP token68 ] (RFC 9110, sección 11.4). El nombre del esquema no
  // distingue mayúsculas (sección 11.1): «Bearer», «bearer» y «BEARER» son el mismo esquema.
  const esquema = /^[^ ]+/.exec(cabecera);
  if (esquema === null || esquema[0].toLowerCase() !== "bearer") return { tipo: "otro-esquema" };
  const encontrada = /^[^ ]+ +(\S+)$/.exec(cabecera);
  const credencial = encontrada === null ? undefined : CREDENCIALES.get(encontrada[1]);
  return credencial === undefined ? { tipo: "invalida" } : { tipo: "valida", credencial };
}

// La frase del 401 para cada caso.
export function motivo(identificacion: Identificacion): string {
  if (identificacion.tipo === "ninguna") return "falta la credencial";
  if (identificacion.tipo === "otro-esquema") return "solo se admite el esquema Bearer";
  return "la credencial no es válida";
}

// El reto que exige un 401 (RFC 9110, sección 11.6.1; el esquema Bearer es del RFC 6750).
// error="invalid_token" solo cuando llegó una credencial Bearer y no sirve (RFC 6750, sección 3).
// Sin credencial, o con un esquema que no se admite, no va ningún código de error (sección 3.1).
export function reto(identificacion: Identificacion): string {
  return identificacion.tipo === "invalida"
    ? 'Bearer realm="revisor", error="invalid_token"'
    : 'Bearer realm="revisor"';
}
```

El archivo tiene cuatro piezas. La **tabla** de credenciales, que en una API real no existiría: las credenciales las emite un proveedor de identidad y el servidor las verifica, por ejemplo comprobando la firma de un token. La función **`identificar`**, que lee la cabecera `Authorization` y devuelve uno de cuatro resultados: no vino ninguna, vino con otro esquema, vino una `Bearer` inválida o vino una válida, con su credencial. Primero separa el nombre del esquema (lo que va antes del primer espacio) y lo compara en minúsculas; si no es `bearer`, ni siquiera busca la credencial. La función **`motivo`** escribe la frase del cuerpo del `401` para cada caso, y la función **`reto`** arma el valor de `WWW-Authenticate`: el código `invalid_token` solo cuando llegó una credencial `Bearer` que no sirve. El tipo `Identificacion` es una unión de cuatro casos, y la puerta pregunta por `tipo` antes de usar `credencial`; TypeScript no la deja usarla en los otros tres.

#### 2.3.3 Por qué la tabla es un `Map`

Hay un detalle en la tabla de credenciales que parece de estilo y es de seguridad: es un `Map`, y se consulta con `CREDENCIALES.get(token)`. La forma que a casi todo el mundo se le ocurre primero es un objeto, `{ "lectura-a": {…}, "admin": {…} }`, consultado con `CREDENCIALES[token]`. Se ve igual de bien, TypeScript no se queja, y las cuatro credenciales funcionan igual. Pero tiene un hueco.

En JavaScript, un objeto escrito con llaves **hereda** propiedades de otro objeto, su **prototipo**, `Object.prototype`. Por eso todo objeto responde a `toString`, a `hasOwnProperty` o a `constructor`, aunque nadie los haya escrito en él. Y `CREDENCIALES[token]` no distingue lo que se escribió en el objeto de lo que heredó: si el token es `constructor`, la búsqueda encuentra algo, la función `Object`, y ese algo no es `undefined`. Para `identificar`, que solo pregunta si encontró algo, **`Bearer constructor` sería una credencial válida**. La sección «El error que vas a ver» lo provoca con una corrida, y lo que responde el `revisor` en ese caso no es lo que esperarías.

`Map.get` no tiene ese problema: devuelve solo lo que se guardó con `set` (o en la lista inicial), y para cualquier otra llave, `undefined`. La otra defensa correcta es un objeto sin prototipo, creado con `Object.create(null)`, consultado con `Object.hasOwn(objeto, token)`, que solo mira las propiedades propias. Las dos cierran el hueco; el `Map` además deja claro, a quien lea el código, que eso es una tabla de búsqueda y no un objeto con propiedades.

El caso enseña algo que va más allá de JavaScript: **la pregunta «¿quién eres?» se contesta con «sí» solo cuando se encontró exactamente lo que se buscaba**. Cualquier ruta del código que pueda devolver «encontré algo» por accidente (una propiedad heredada, una comparación que acepta una cadena vacía, una búsqueda que no distingue mayúsculas donde debería) es una credencial que nadie emitió. En una API real, ese accidente vive en la verificación de la firma de un token, en la comparación de una clave o en la consulta a una base de datos, y la regla es la misma.

El mismo cuidado aparece en otro lugar de la puerta. La tabla de métodos de cada ruta también es un objeto (`{ GET: …, DELETE: … }`), y el método lo escribe el cliente. Por eso `atender` no la consulta con `ruta.metodos[nombreMetodo]` a secas, sino con `Object.hasOwn(ruta.metodos, nombreMetodo)`, que solo mira los métodos que se escribieron en la tabla. ¿Llegaría un método llamado `constructor`? En la práctica, ni siquiera llega a la puerta:

```text
$ curl -i -X constructor http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 400 Bad Request
Connection: close
```

El analizador de HTTP de Node solo acepta los métodos que conoce, y a cualquier otro le responde `400` por su cuenta, sin cuerpo y cerrando la conexión, antes de llamar a `atender`; por eso la terminal del `revisor` no lo anota. La puerta no depende de ese filtro: una tabla que decide algo con un dato que manda el cliente se escribe de forma que solo encuentre lo que se guardó en ella, aunque otra pieza filtre antes, porque la otra pieza puede cambiar mañana.

### 2.4 ¿Puedes?: `403`

#### 2.4.1 Un lector que intenta escribir

Con la credencial verificada, la cuarta pregunta es si esa credencial puede hacer lo que pide. La función `puede` de `rutas.ts` lo resuelve en un renglón: si el método lee, cualquiera puede; si escribe, solo un escritor o un administrador.

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor
```

`403 Forbidden`. La [sección 15.5.4 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4) lo define así: el servidor entendió la petición, pero se niega a cumplirla. Y agrega lo que lo separa del `401`: si la petición traía credenciales, el servidor las considera **insuficientes** para darle acceso, y el cliente **no debería** repetir la petición con las mismas credenciales; puede repetirla con otras. El `403` no exige ninguna cabecera, a diferencia del `401` y del `405`. (Con tokens de OAuth, el RFC 6750 permite agregar al `403` un reto con `error="insufficient_scope"` para decir que al token le faltan permisos; el `revisor` no usa ámbitos y no lo manda.) Puede explicar en el cuerpo por qué se negó, y el `revisor` lo hace: `tu credencial solo puede leer; para escribir pide una con rol de escritor`.

Fíjate en lo que ese texto **no** dice: no repite la credencial. Sería tentador escribir «la credencial `lectura-a` solo puede leer», que suena más preciso. Pero en el `revisor`, el nombre de una credencial es la credencial misma: `lectura-a` es a la vez quién eres y la llave para entrar. Repetirla en el cuerpo es escribir un secreto en una respuesta, y las respuestas de error terminan en lugares que nadie vigila: la bitácora de un balanceador, la caché de un intermediario, el reporte de errores del cliente o la captura de pantalla que alguien pega en un chat para pedir ayuda. En una API real pasa lo mismo con un token: el mensaje de error dice qué le falta al cliente (un rol de escritor) y nunca devuelve lo que el cliente mandó para identificarse. El cliente ya lo sabe; quien no debe saberlo es todo lo que está en medio.

La pregunta que decide entre los dos códigos es corta, y conviene saberla de memoria: **¿cambiaría algo si se identificara de nuevo?** Si no sé quién eres, o lo que me diste no sirve, identificarte arregla el problema: `401`. Si sé quién eres y lo que pides no te toca, identificarte otra vez con lo mismo no cambia nada: `403`. Un cliente que recibe `401` puede pedir una credencial nueva y reintentar; uno que recibe `403` no debe reintentar con la misma, y lo sensato es rendirse o pedirle permiso a una persona.

#### 2.4.2 El `403` no depende del identificador

Aquí aparece la tercera regla del orden. ¿Qué pasa si el lector intenta borrar un servicio que no existe?

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor
```

`403`, igual que con el servicio 1. La puerta contestó la pregunta 4 antes de llegar a la 5, así que no sabe, ni le importa, si el servicio 99 existe. Para un lector, **todo** `DELETE` es un `403`, con cualquier identificador. Eso es justo lo que queremos: el `403` de esta puerta habla de la credencial y del método, y no deja ver nada de los datos. Si el orden fuera el contrario, existencia antes que permiso, el lector recibiría `403` en los servicios que existen y `404` en los que no, y tendría un mapa completo de lo que existe sin haber podido borrar nada. Es la misma fuga que el recuadro de seguridad de la sección 2.5 describe para el `404`, por otro camino.

### 2.5 ¿Existe, para ti?: el `404` que esconde

#### 2.5.1 Cada servicio es de un equipo

Desde esta lección, cada servicio pertenece a un equipo. Los tres de arranque ya lo tenían escrito en `almacen.ts`: `catalogo` y `pagos` son del equipo a, `nomina` es del equipo b. La Lección 1 lo ignoraba; ahora el `revisor` lo usa en tres lugares. Al **listar**, cada credencial ve solo los servicios de su equipo:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 189
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}]}
```

`lectura-a` ve los servicios 1 y 2, y no ve el 3. Al **dar de alta**, el servicio nuevo queda en el equipo de quien lo creó. Y al **consultar, retirar o pedir una revisión** de un servicio, la pregunta 5 no es solo «¿existe?», sino **«¿existe para ti?»**.

#### 2.5.2 El mismo `404` para lo ajeno y para lo inexistente

¿Qué debe responder el `revisor` cuando `lectura-a` pide el servicio 3, que existe pero es del equipo b? Hay dos respuestas posibles, y las dos están permitidas por la especificación. La primera es `403`: «existe, y no te toca». La segunda es `404`: «para ti, no existe». El RFC 9110 contempla las dos en un solo párrafo de la [sección 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4): un servidor de origen que quiera **«esconder»** la existencia de un recurso prohibido **puede**, en lugar del `403`, responder `404`. Y la definición del `404`, que viste en 2.2.1, ya lo traía: no encontró el recurso **o no está dispuesto a revelar que existe**.

El `revisor` elige la segunda. Mira las dos respuestas lado a lado, primero el servicio 3, que existe, y después el 99, que no:

```text
$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

Las dos son iguales salvo por el número del servicio, que es el que pediste. El mismo código, las mismas cabeceras, el mismo cuerpo, el mismo largo menos un byte por la cifra de más. Con esas dos respuestas no hay forma de saber cuál de los dos servicios existe. Y el dueño sí lo ve:

```text
$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 200 OK
ETag: "3-1-a06a8084"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

La decisión está en una función de cuatro renglones de `servicios.ts`, que todos los manejadores usan en lugar de buscar el servicio directamente:

```ts
// Un servicio de otro equipo se trata como si no existiera: el 404 esconde a propósito.
function visible(id: string, credencial: Credencial): Servicio | undefined {
  const servicio = buscarServicio(Number(id));
  if (servicio === undefined) return undefined;
  return credencial.equipo === "*" || servicio.equipo === credencial.equipo ? servicio : undefined;
}

function noExiste(respuesta: ServerResponse, id: string): void {
  fallar(respuesta, 404, `no existe el servicio ${id}`);
}
```

`visible` devuelve el servicio solo si es del equipo de la credencial (o si la credencial es de administrador, cuyo equipo es `*`), y `undefined` en cualquier otro caso. Para el manejador, «no existe» y «es de otro» son el mismo `undefined`, y por eso producen el mismo `404`, con el mismo texto, escrito en un solo lugar: `noExiste`. **El contenido de la respuesta no puede diferir, porque el código no tiene cómo distinguirlos.** Esa es la forma segura de escribirlo: no dos ramas que se procura mantener iguales, sino una sola rama. Lo que esto garantiza es la igualdad de la respuesta (código, cabeceras y texto), no la del tiempo que tarda: en un almacén en memoria como este la diferencia no se puede medir, pero con una base de datos real, buscar un registro y comprobar de quién es puede tardar distinto que descartar uno inexistente, y quien mide microsegundos podría notarlo. Es un canal lateral (*side channel*, información que se escapa por algo que no es el contenido), y se vigila aparte, por ejemplo consultando por identificador y equipo en una sola búsqueda.

> **Recuadro de seguridad: el `404` que esconde y la enumeración de recursos**
>
> **Qué es la enumeración.** Es averiguar qué recursos existen probando identificadores uno tras otro y comparando las respuestas. No hace falta leer ningún dato: basta con que la API responda **distinto** a lo que existe y a lo que no. Si `/servicios/3` responde `403` y `/servicios/99` responde `404`, quien prueba del 1 al 1000 sale con la lista de los servicios que existen, cuántos son y, si los identificadores son consecutivos, cuántos se crean por semana. La guía de pruebas de seguridad de OWASP describe esta técnica en su prueba [WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md), y su ejemplo es exactamente este: `/account1` responde `403`, `/account2` responde `404`, y el que prueba concluye que la primera cuenta existe y la segunda no.
>
> **Por qué importa aunque no se lea nada.** Saber qué existe es el primer paso de casi cualquier ataque: con la lista se buscan los recursos que valen la pena, se prueban credenciales robadas solo donde hay algo, y se descubren nombres internos que no debían salir. Y la diferencia no tiene que estar en el código: un cuerpo distinto («no existe» frente a «es de otro equipo»), un largo distinto o una cabecera de más bastan.
>
> **La defensa del `revisor`.** Lo ajeno y lo inexistente responden **idéntico**: el mismo código, el mismo cuerpo, salido de la misma función. El RFC 9110 lo permite expresamente (sección 15.5.4), y es lo que hacen APIs que operan a gran escala: la [documentación de la API de GitHub](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) explica que responde `404` y no `403` a un recurso privado, para no confirmar que existe. Y el orden de la puerta cierra los otros dos caminos: un desconocido recibe `401` en todos los identificadores (pregunta 3), y un lector que intenta escribir recibe `403` en todos (pregunta 4), existan o no.
>
> **Lo que el `404` no hace.** Esconder la existencia no es lo mismo que proteger el recurso. Lo que impide que el equipo a lea el servicio del equipo b no es el `404`, es que `visible` compara el equipo **en cada acceso**. Olvidar esa comparación en un manejador es el error número uno de la lista de riesgos de APIs de OWASP, [API1:2023, *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization), y la defensa que propone es esa: comprobar en cada función que recibe un identificador del cliente que quien pide puede hacer eso con ese registro. La misma guía sugiere además usar identificadores aleatorios, difíciles de adivinar, en lugar de consecutivos; el `revisor` usa consecutivos para que el curso sea legible, y por eso el `404` uniforme es lo que lo protege. Con identificadores aleatorios, la enumeración sería mucho más cara, pero la respuesta uniforme seguiría haciendo falta.
>
> **Cuándo se escribe como política.** Esconder tiene un costo: el dueño legítimo que se equivoca de credencial recibe «no existe» y puede perder un rato buscando un error de dirección. Por eso la decisión se escribe y se aplica igual en toda la API: en el `revisor`, **todo recurso de otro equipo responde `404`, en toda ruta y todo método**. Lo que no se vale es esconder en unas rutas y no en otras; la primera ruta que responde distinto deshace lo que las demás esconden.

#### 2.5.3 Comprobarlo con un programa

Una afirmación de seguridad se comprueba atacando, no leyendo el código. Este programa hace lo que haría quien quiere enumerar: recorre los identificadores del 1 al 6 con una credencial, anota qué responde el `revisor` a cada uno y saca sus conclusiones. Guárdalo como `~/curso-http/fig02_02.ts`:

```ts
// fig02_02.ts
// El enumerador: prueba identificadores uno tras otro y agrupa los que recibieron la misma respuesta.
// Uso: node fig02_02.ts <credencial>
const credencial = process.argv[2] ?? "lectura-a";
const grupos = new Map<string, number[]>(); // respuesta → identificadores que la recibieron

for (let id = 1; id <= 6; id++) {
  const respuesta = await fetch(`http://127.0.0.1:18080/servicios/${id}`, {
    headers: { Authorization: `Bearer ${credencial}` },
  });
  const cuerpo = (await respuesta.text()).trim();
  // Un éxito trae los datos del servicio; un error trae un texto, y en él se borra el número pedido,
  // para que dos errores que solo difieren en el id cuenten como la misma respuesta.
  const huella = respuesta.ok
    ? `${respuesta.status} con datos`
    : `${respuesta.status} ${cuerpo.replaceAll(String(id), "N")}`;
  console.log(`servicio ${id}: ${respuesta.status} ${cuerpo}`);
  grupos.set(huella, [...(grupos.get(huella) ?? []), id]);
}

console.log(`\nrespuestas distintas: ${grupos.size}`);
for (const [huella, ids] of grupos) console.log(`  ${ids.join(", ").padEnd(18)} → ${huella}`);
if (grupos.size > 2) console.log("más de dos respuestas: lo que no es tuyo ya no se ve todo igual");
```

El programa no sabe nada del `revisor` por dentro: ve solo lo que vería cualquiera desde fuera. Por cada identificador guarda una **huella** de la respuesta: el código y, si es un error, el cuerpo con el número pedido borrado, para que «no existe el servicio 3» y «no existe el servicio 4» cuenten como la misma respuesta. Al final agrupa los identificadores por huella. Si lo ajeno y lo inexistente reciben la misma respuesta, tiene que haber exactamente dos grupos: los tuyos, con datos, y todos los demás. Un tercer grupo significa que algo distingue lo ajeno de lo inexistente, y el programa lo avisa. Es el mismo razonamiento que haría una persona con una hoja de cálculo, solo que en un segundo. Comparar el cuerpo, y no solo el código, importa: un enumerador de verdad mira todo lo que cambia, y un `404` con dos textos distintos delata igual que un `403` frente a un `404`.

Con el laboratorio y el `revisor` de 2.7 corriendo, recién arrancados:

```text
$ node fig02_02.ts lectura-a
servicio 1: 200 {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 2: 200 {"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}
servicio 3: 404 no existe el servicio 3
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 2
  1, 2               → 200 con datos
  3, 4, 5, 6         → 404 no existe el servicio N
```

Dos grupos. `lectura-a` sabe que existen el 1 y el 2, que son suyos, y no sabe nada del 3: para él, el 3 es tan inexistente como el 6, que de verdad no existe. En «El error que vas a ver» vas a cambiar cuatro renglones de `servicios.ts` y a ver aparecer el tercer grupo.

#### 2.5.4 Las revisiones también son de un equipo

La pregunta «¿existe para ti?» no se limita a los servicios. Una revisión pertenece al servicio que revisó, y por lo tanto a su equipo. `consultarRevision` responde `404` si la revisión no existe **o** si su servicio no es visible para la credencial:

```ts
export function consultarRevision({ respuesta, parametros, credencial }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  if (revision === undefined || visible(String(revision.servicio), credencial) === undefined) {
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}
```

Es el mismo patrón con otro recurso, y conviene notarlo porque es el lugar donde más se olvida: el recurso principal se protege con cuidado, y el recurso «hijo», al que se llega con otro identificador, se queda abierto. Si `consultarRevision` buscara la revisión sin preguntar de quién es su servicio, cualquiera del equipo b podría leer los resultados de las revisiones del equipo a recorriendo `/revisiones/1`, `/revisiones/2`…, aunque no pudiera ver los servicios.

### 2.6 El cuerpo: `415` y `400`

#### 2.6.1 El formato antes que la lectura

Las dos últimas preguntas solo se hacen cuando la petición trae un cuerpo, y en el `revisor` eso es el alta, `POST /servicios`. Primero, **¿viene en un formato que acepto?** El cliente dice el formato de su cuerpo con la cabecera `Content-Type`, y el `revisor` solo acepta `application/json`. Después, **¿lo puedo leer?**: aunque diga que es JSON, puede no serlo.

Las dos preguntas las contesta la función `leerJson` de `servicios.ts`, que es nueva:

```ts
// Lee el cuerpo como JSON. Si no puede, ya respondió 415 o 400 y devuelve undefined.
async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
  const tipo = (peticion.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    fallar(respuesta, 415, `el cuerpo debe ser application/json, no ${tipo === "" ? "(sin tipo)" : tipo}`, {
      Accept: "application/json",
    });
    return undefined;
  }
  try {
    const datos: unknown = JSON.parse(await leerCuerpo(peticion));
    if (typeof datos === "object" && datos !== null && !Array.isArray(datos)) return datos as Record<string, unknown>;
  } catch (error) {
    // 413 (RFC 9110, sección 15.5.14): el cuerpo pasa del tope. «Connection: close» hace que Node cierre
    // la conexión al terminar de responder, en vez de seguir recibiendo lo que el cliente quería mandar.
    if (error instanceof CuerpoDemasiadoGrande) {
      fallar(respuesta, 413, `el cuerpo pasa de ${TOPE_CUERPO} bytes`, { Connection: "close" });
      return undefined;
    }
    // si no, cae al 400 de abajo
  }
  fallar(respuesta, 400, "el cuerpo no es un objeto JSON");
  return undefined;
}
```

La primera parte compara el `Content-Type` con `application/json`. Antes de comparar, se queda con lo que está antes del primer `;` y lo pasa a minúsculas, porque `application/json; charset=utf-8` y `Application/JSON` son el mismo tipo: la [sección 8.3.1 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1) dice que el tipo y el subtipo no distinguen mayúsculas, y que lo que va después del `;` son parámetros. Si el tipo no es JSON, responde `415`. La segunda parte intenta leer el JSON, y además exige que sea un **objeto**: un número, un texto o una lista son JSON válido, pero no son un servicio. Si cualquiera de las dos cosas falla, responde `400`, con el mismo texto para las dos: «el cuerpo no es un objeto JSON» cubre tanto un JSON cortado como uno que se lee bien pero no es un objeto. Antes de leer, además, `leerCuerpo` revisa el tamaño, y si el cuerpo es demasiado grande `leerJson` responde `413`; la sección 2.6.4 lo explica.

#### 2.6.2 `415`: el formato no es el que acepto

`curl -d` es la forma más corta de mandar un cuerpo, y tiene una trampa que vale la pena ver una vez. Si no le dices el tipo, manda `application/x-www-form-urlencoded`, el formato de los formularios web, como dice la [documentación de la opción `-d`](https://curl.se/docs/manpage.html#-d):

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -d 'nombre=inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no application/x-www-form-urlencoded
```

`415 Unsupported Media Type`. La [sección 15.5.16 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) lo define: el servidor se niega a atender la petición porque el contenido viene en un formato que este método no admite en este recurso. Y agrega qué cabecera ayuda al cliente: si el problema es el tipo de medios, la cabecera `Accept` **en la respuesta** puede decir qué tipos se habrían aceptado. Aquí la especificación dice **puede**, no **debe**: a diferencia de `Allow` en el `405` y `WWW-Authenticate` en el `401`, `Accept` en un `415` es recomendable, no obligatoria. El `revisor` la manda siempre, porque convierte el error en una instrucción: «no acepto formularios; acepto `application/json`». Y una pregunta razonable: ¿qué pasa con el cuerpo que el `revisor` no leyó? Se midió: un `POST` de 8 MiB con `Content-Type: text/plain` recibió el `415`, y la petición siguiente por la misma conexión recibió su `200` normal; Node descarta por su cuenta el cuerpo que nadie leyó cuando la respuesta termina, así que aquí no hace falta `Connection: close`, a diferencia del `413`, donde el objetivo es dejar de recibir.

`Accept` en una respuesta es menos común que en una petición, y conviene no confundirlas. En una petición, `Accept` dice qué formatos quiere **recibir** el cliente, y si el servidor no puede producir ninguno, el código es otro, `406 Not Acceptable`, que no es protagonista de este curso. En la respuesta a un `415`, `Accept` dice qué formatos acepta **recibir** el servidor. Mismo nombre, dirección contraria.

Con un tipo explícito que tampoco es JSON, el resultado es el mismo, y el cuerpo dice cuál llegó:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain
```

#### 2.6.3 `400`: dice ser JSON y no se puede leer

Ahora el tipo es el correcto, pero el JSON está cortado a la mitad:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre": "inventario",'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON
```

`400 Bad Request`. Es el código más general de la familia, y la [sección 15.5.1 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.1) lo define con esa amplitud: el servidor no puede o no quiere procesar la petición por algo que percibe como un error del cliente, y da como ejemplos una sintaxis mal formada o un mensaje mal enmarcado. Un JSON cortado es sintaxis mal formada.

¿Por qué `415` va antes que `400`, y no al revés? Por la primera regla del orden: no puedes decir si algo se puede leer sin saber en qué formato está. Si el `revisor` intentara leer como JSON un cuerpo que dice ser un formulario, el error que vería sería «no es JSON», y respondería `400`; el cliente concluiría que su JSON está mal, cuando lo que está mal es la cabecera. El orden hace que cada falla tenga su código.

#### 2.6.4 `413`: el cuerpo es demasiado grande

El formato no es lo único que se puede rechazar antes de entender un cuerpo: también el **tamaño**. Para leer un cuerpo, el `revisor` lo guarda en memoria, y un servidor que guarda en memoria todo lo que le manden le entrega a cualquiera la llave para llenársela. Primero el rojo. En una copia del `revisor` (la versión completa está en `defectos/sin-tope/respuestas.ts`), cambia el tope de `respuestas.ts` por infinito:

```ts
export const TOPE_CUERPO = Infinity;
```

Arranca el laboratorio y la copia, y en otra terminal guarda el número de proceso del `revisor` en una variable: `REV=$(pgrep -f 'node servidor.ts')`. Con él, `ps -o rss= -p $REV` dice cuánta memoria ocupa el proceso, en kilobytes. Mídela, manda un alta de 50 MB de letras `a` y vuelve a medir:

```text
$ ps -o rss= -p $REV
 93056

$ head -c 52428800 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w '%{http_code} en %{time_total} s\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
400 en 0.041348 s

$ ps -o rss= -p $REV
224064

$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200
```

La memoria del proceso pasó de unos 93 MB a unos 224 MB por **una** petición, y el `revisor` la leyó entera para terminar respondiendo `400`, porque 50 MB de letras `a` no son JSON. Con diez peticiones así a la vez, o con un cuerpo de unos cuantos gigabytes, el proceso se queda sin memoria y se cae para todos. Y fíjate en quién puede hacerlo: cualquiera con una credencial de escritura, porque el orden de la puerta sí deja fuera a los desconocidos (el cuerpo se lee hasta la pregunta 7). Es una defensa, pero no basta: una credencial de escritura también se puede robar o usar mal.

Ahora el verde, con el `revisor` de la lección. La misma medición:

```text
$ ps -o rss= -p $REV
 91616

$ head -c 52428800 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w '%{http_code} en %{time_total} s\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
413 en 0.002827 s

$ ps -o rss= -p $REV
 84272

$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200
```

`413`, en unas tres milésimas de segundo, y la memoria **no creció**: pasó de unos 92 MB a unos 84 MB, porque el recolector de basura de Node aprovechó para devolver memoria (en tu corrida las cifras serán otras; lo que importa es que no suben). El `revisor` no guardó los 50 MB: contestó el `413` en cuanto vio que pasaban del tope, y lo que siguió llegando lo leyó y lo tiró sin guardarlo. Esto es lo que hace `leerCuerpo` en `respuestas.ts` (es el mismo de la Lección 1, que ya lo usaba como red de seguridad):

```ts
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

Tiene dos defensas, porque hay dos formas de mandar un cuerpo. Si la petición trae `Content-Length` y ya anuncia más de 16 KiB (16 384 bytes), rechaza **sin guardar nada**. Si no lo trae, porque el cuerpo viene **por partes** (*chunked*, como viste en la Lección 0), o si el número miente, cuenta los bytes mientras llegan y deja de guardar en cuanto pasan del tope. En los dos casos nunca guarda más de 16 KiB, y responde el `413` de inmediato con un **cierre en etapas**: cierra solo la escritura (media cerrada), sigue leyendo y tirando lo que el cliente alcance a mandar y destruye la conexión a los 2 segundos si el cliente no la cerró. Si respondiera y cerrara de golpe con el cliente todavía mandando, el sistema operativo contestaría con un RST que puede borrar el `413` antes de que el cliente lo lea (RFC 9112, sección 9.6). ¿Por qué 16 KiB? Porque un servicio es un nombre de hasta 40 caracteres, una URL y un número: cabe muchas veces. El tope se elige por lo que la ruta necesita recibir, no por lo que el servidor aguanta.

Y quien lee el cuerpo, `leerJson`, convierte ese rechazo en la respuesta. La corrida completa de 2.7 trae las tres pruebas del tope:

```text
$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 23:42:11 GMT

el cuerpo pasa de 16384 bytes

$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w 'por partes: %{http_code}\n' -X POST -T - http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json'
por partes: 413

$ head -c 16384 /dev/zero | tr '\0' 'a' | curl -sS -o /dev/null -w 'en el tope: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
en el tope: 400

$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200
```

`413 Content Too Large`, que la [sección 15.5.14 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.14) define así: el servidor se niega a procesar la petición porque su contenido es más grande de lo que está dispuesto o es capaz de procesar, y **puede** cerrar la conexión. El `revisor` lo hace con `Connection: close`: Node cierra la conexión al terminar de responder, y lo que el cliente seguía mandando ya se drenó sin guardarse. No destruye la petición antes, porque entonces no podría responder nada. La segunda prueba manda el cuerpo por partes (`-T -`), sin `Content-Length`, y también recibe `413`: ahí funcionó la cuenta mientras lee. La tercera manda **exactamente** 16 384 bytes, justo en el tope: se leen completos y, como no son JSON, la respuesta es `400`. Y la consulta del final dice que el `revisor` sigue vivo.

El `413` y el `415` son parientes: los dos dicen que el cuerpo no se puede aceptar **tal como viene**, uno por el formato y otro por el tamaño, y los dos se deciden sin entender el contenido. Por eso van juntos en la pregunta del cuerpo, antes del `400`, que sí necesita leerlo. Un detalle de nombre, que ya viste en la Lección 0: Node llama a este código «Payload Too Large», el nombre viejo; el RFC 9110 lo cambió a «Content Too Large», y `respuestas.ts` usa el del registro.

#### 2.6.5 Lo que todavía es `400`

En esta lección hay otras cuatro situaciones que también responden `400`, y conviene verlas juntas porque la Lección 3 va a mover algunas a otro código.

**JSON que no es un objeto.** `null`, `7`, `"pagos"` y `[]` son JSON válido, pero ninguno es un servicio. `leerJson` lo revisa antes de dejar pasar el cuerpo, y responde `400 el cuerpo no es un objeto JSON`. No es un detalle: si `darDeAlta` recibiera `null` y leyera `datos.nombre`, JavaScript lanzaría un error, y un error que nadie atrapa en un servidor de Node termina el proceso. El ejercicio 4 lo recorre.

**Faltan campos.** Si el cuerpo es un objeto JSON, pero no trae `nombre` o `url` como textos, el `revisor` responde `400 faltan nombre y url`.

**Un límite fuera de rango.** `limite_ms` es opcional y por omisión vale 2000, pero si viene, tiene que ser un entero entre 100 y 10000:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"eterno","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3600000}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

La cota no es un capricho. El `revisor` espera la respuesta de cada servicio a lo sumo `limite_ms` milisegundos, y sin cota, un límite de horas lo dejaría esperando a un servicio que no responde, con la conexión ocupada todo ese tiempo; y un límite de cero lo daría por caído sin haberlo consultado. Un campo numérico que el cliente controla y el servidor usa para decidir cuánto trabajo hace es un campo que se acota siempre. La validación va **antes** de revisar el destino, porque revisar el destino resuelve un nombre por DNS, y no tiene caso gastar esa consulta en un alta que de todos modos se va a rechazar.

**Un destino prohibido.** La defensa contra SSRF de la Lección 1 sigue en su lugar: un alta que apunta a la dirección de metadatos de la nube o a un nombre que resuelve a `127.0.0.1` se rechaza con `400 destino prohibido: …`. La regla es la de la Lección 1, y cubre mucho más que las redes privadas. En IPv4 es una **lista negra** copiada del registro de direcciones de uso especial de la IANA: además de `10/8`, `172.16/12` y `192.168/16`, rechaza el espacio compartido de los proveedores (`100.64.0.0/10`, donde una nube publica sus metadatos), las redes de documentación y de pruebas de rendimiento, el *multicast* y el bloque reservado `240.0.0.0/4`. En IPv6 es una **lista blanca**: solo se acepta el unicast global, `2000::/3`, menos algunos bloques especiales que caen dentro (documentación, Teredo). Y antes de aplicar cualquiera de las dos, saca la IPv4 que algunas direcciones IPv6 llevan escondida en sus bits (`64:ff9b::…`, `2002:…`, `::…`) y la revisa como IPv4: `[2002:a9fe:a9fe::]` es `169.254.169.254` por dentro. La corrida completa de 2.7 lo comprueba con doce altas, una por bloque, y las doce se rechazan:

```text
$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-1","url":"http://100.100.100.200/latest/meta-data/"}'
destino prohibido: 100.100.100.200:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-2","url":"http://[64:ff9b::a9fe:a9fe]/"}'
destino prohibido: [64:ff9b::a9fe:a9fe]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-3","url":"http://224.0.0.1/"}'
destino prohibido: 224.0.0.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-4","url":"http://[ff02::1]/"}'
destino prohibido: [ff02::1]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-5","url":"http://[2002:a9fe:a9fe::]/"}'
destino prohibido: [2002:a9fe:a9fe::]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-6","url":"http://[::7f00:1]/"}'
destino prohibido: [::7f00:1]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-7","url":"http://[64:ff9b:1::a9fe:a9fe]/"}'
destino prohibido: [64:ff9b:1::a9fe:a9fe]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-8","url":"http://240.0.0.1/"}'
destino prohibido: 240.0.0.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-9","url":"http://198.18.0.1/"}'
destino prohibido: 198.18.0.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-10","url":"http://192.0.2.1/"}'
destino prohibido: 192.0.2.1:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-11","url":"http://[2001:db8::1]/"}'
destino prohibido: [2001:db8::1]:80: dirección privada o reservada
 [400]

$ curl -sS -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-12","url":"http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/"}'
destino prohibido: [2001:0:4136:e378:8000:63bf:3fff:fdd2]:80: dirección privada o reservada
 [400]
```

Las tres últimas tienen algo en común: el cuerpo **se pudo leer**, y lo que falla es que lo leído no se puede cumplir. La Lección 3 adopta una política escrita para esa diferencia: `400` para lo que no se puede leer y `422` para lo que se lee pero no se puede cumplir. Por ahora el `422` no existe en el `revisor`, y todo lo que no se puede usar del cuerpo es `400`. Que el código sea el mismo no significa que el cuerpo deba serlo: el texto de cada `400` dice qué falló, y esa es la diferencia entre un `400` útil y el de la escena del principio.

### 2.7 El `revisor` completo

#### 2.7.1 Los archivos que cambian

El `revisor` de esta lección vive en la carpeta `~/curso-http/fig02_01/`. Si tienes la carpeta de la Lección 1, cópiala con ese nombre y cambia tres archivos: uno nuevo, `autenticacion.ts` (sección 2.3.2), y dos modificados, `rutas.ts` y `servicios.ts`, completos aquí:

```ts
// fig02_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
} from "./servicios.ts";

type Manejador = (contexto: Contexto) => void | Promise<void>;
// Cada método dice qué función lo atiende y qué rol mínimo exige.
type Metodo = { manejador: Manejador; escribe: boolean };
type Ruta = { patron: RegExp; metodos: Record<string, Metodo> };

const lee = (manejador: Manejador): Metodo => ({ manejador, escribe: false });
const escribe = (manejador: Manejador): Metodo => ({ manejador, escribe: true });

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: lee(listar), POST: escribe(darDeAlta) } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: lee(consultar), DELETE: escribe(retirar) } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: escribe(pedirRevision) } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: lee(consultarRevision) } },
];

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

// Los métodos que admite una ruta, para la cabecera Allow (GET trae HEAD consigo).
function permitidos(ruta: Ruta): string {
  const metodos = Object.keys(ruta.metodos);
  if (metodos.includes("GET")) metodos.splice(metodos.indexOf("GET") + 1, 0, "HEAD");
  return metodos.join(", ");
}

function puede(credencial: Credencial, metodo: Metodo): boolean {
  return !metodo.escribe || credencial.rol === "escritor" || credencial.rol === "admin";
}

export async function atender(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  console.log(`${peticion.method} ${peticion.url}`);
  const url = new URL(peticion.url ?? "/", "http://revisor");
  if (redirigir(url.pathname, url.search, respuesta)) return;

  // 1. ¿Existe la ruta?
  let ruta: Ruta | undefined;
  let parametros: string[] = [];
  for (const candidata of RUTAS) {
    const encontrada = candidata.patron.exec(url.pathname);
    if (encontrada !== null) {
      ruta = candidata;
      parametros = encontrada.slice(1);
      break;
    }
  }
  if (ruta === undefined) {
    fallar(respuesta, 404, "no existe esa ruta");
    return;
  }

  // 2. ¿Admite este método?
  const nombreMetodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  // Object.hasOwn y no ruta.metodos[nombreMetodo] a secas: el método lo escribe el cliente, y un objeto
  // también «tiene» lo que hereda de Object.prototype (constructor, toString…). Igual que las credenciales.
  const metodo = Object.hasOwn(ruta.metodos, nombreMetodo) ? ruta.metodos[nombreMetodo] : undefined;
  if (metodo === undefined) {
    fallar(respuesta, 405, `${peticion.method} no se admite en ${url.pathname}`, { Allow: permitidos(ruta) });
    return;
  }

  // 3. ¿Quién eres?
  const identificacion = identificar(peticion);
  if (identificacion.tipo !== "valida") {
    const detalle = motivo(identificacion);
    fallar(respuesta, 401, detalle, { "WWW-Authenticate": reto(identificacion) });
    return;
  }

  // 4. ¿Puedes?
  if (!puede(identificacion.credencial, metodo)) {
    fallar(respuesta, 403, "tu credencial solo puede leer; para escribir pide una con rol de escritor");
    return;
  }

  // 5, 6 y 7. ¿Existe el recurso? ¿En qué formato viene? ¿Se puede leer? Lo decide cada manejador.
  await metodo.manejador({ peticion, respuesta, parametros, credencial: identificacion.credencial });
}
```

```ts
// fig02_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarRevision, buscarServicio, crearRevision, crearServicio, etiqueta, listarServicios,
  retirarServicio, terminarRevision, type Revision, type Servicio,
} from "./almacen.ts";
import type { Credencial } from "./autenticacion.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, hayCoincidencia } from "./etiquetas.ts";
import { revisar } from "./cliente.ts";
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
  credencial: Credencial;
};

const ESPERA_EN_COLA_MS = 1000;

function representar(servicio: Servicio): object {
  return { id: servicio.id, nombre: servicio.nombre, url: servicio.url, limite_ms: servicio.limiteMs };
}

function representarRevision(revision: Revision): object {
  return { id: revision.id, servicio: revision.servicio, estado: revision.estado, resultado: revision.resultado };
}

// Un servicio de otro equipo se trata como si no existiera: el 404 esconde a propósito.
function visible(id: string, credencial: Credencial): Servicio | undefined {
  const servicio = buscarServicio(Number(id));
  if (servicio === undefined) return undefined;
  return credencial.equipo === "*" || servicio.equipo === credencial.equipo ? servicio : undefined;
}

function noExiste(respuesta: ServerResponse, id: string): void {
  fallar(respuesta, 404, `no existe el servicio ${id}`);
}

// Lee el cuerpo como JSON. Si no puede, ya respondió 415 o 400 y devuelve undefined.
async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
  const tipo = (peticion.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    fallar(respuesta, 415, `el cuerpo debe ser application/json, no ${tipo === "" ? "(sin tipo)" : tipo}`, {
      Accept: "application/json",
    });
    return undefined;
  }
  try {
    const datos: unknown = JSON.parse(await leerCuerpo(peticion));
    if (typeof datos === "object" && datos !== null && !Array.isArray(datos)) return datos as Record<string, unknown>;
  } catch (error) {
    // 413 (RFC 9110, sección 15.5.14): el cuerpo pasa del tope. «Connection: close» hace que Node cierre
    // la conexión al terminar de responder, en vez de seguir recibiendo lo que el cliente quería mandar.
    if (error instanceof CuerpoDemasiadoGrande) {
      fallar(respuesta, 413, `el cuerpo pasa de ${TOPE_CUERPO} bytes`, { Connection: "close" });
      return undefined;
    }
    // si no, cae al 400 de abajo
  }
  fallar(respuesta, 400, "el cuerpo no es un objeto JSON");
  return undefined;
}

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, 400, `destino prohibido: ${veredicto.motivo}`);
  return false;
}

export function listar({ respuesta, credencial }: Contexto): void {
  const propios = listarServicios().filter((s) => credencial.equipo === "*" || s.equipo === credencial.equipo);
  enviarJson(respuesta, 200, { servicios: propios.map(representar) });
}

export async function darDeAlta({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  const datos = await leerJson(peticion, respuesta);
  if (datos === undefined) return;
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
  const servicio = crearServicio({ nombre: datos.nombre, url: datos.url, limiteMs, equipo: credencial.equipo });
  enviarJson(respuesta, 201, representar(servicio), {
    Location: `/servicios/${servicio.id}`,
    ETag: etiqueta(servicio),
  });
}

export function consultar({ peticion, respuesta, parametros, credencial }: Contexto): void {
  const servicio = visible(parametros[0], credencial);
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
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

export function retirar({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = visible(parametros[0], credencial);
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
    return;
  }
  retirarServicio(servicio.id);
  enviarVacio(respuesta, 204);
}

export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = visible(parametros[0], credencial);
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}

export function consultarRevision({ respuesta, parametros, credencial }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  if (revision === undefined || visible(String(revision.servicio), credencial) === undefined) {
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}
```

En `servicios.ts`, además de lo que ya viste (`visible`, `noExiste`, `leerJson` y la cota de `limite_ms`), cambió el `Contexto`: ahora trae la credencial que la puerta verificó, y cada manejador la recibe. Ningún manejador vuelve a leer la cabecera `Authorization`; la puerta lo hizo una vez y le pasó el resultado. Así hay un solo lugar donde se decide quién eres.

#### 2.7.2 Los archivos que no cambian

Los demás archivos son los de la Lección 1, sin un solo cambio. Van completos para que el `revisor` se pueda armar desde esta lección:

```ts
// fig02_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

```ts
// fig02_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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

```ts
// fig02_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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

```ts
// fig02_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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

```ts
// fig02_01/laboratorio.ts
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

```ts
// fig02_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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

```ts
// fig02_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

```json fig02_01/package.json
{
  "type": "module"
}
```

#### 2.7.3 La corrida completa

Abre dos terminales en `~/curso-http/fig02_01/`. En la primera, el laboratorio, que es el banco de la Lección 0 en el puerto 18081; en la segunda, el `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

En una tercera terminal, estas son las peticiones de la lección, en orden, con lo que respondieron. Las principales de las secciones anteriores están aquí otra vez, juntas, para que las compares de corrido con las tuyas:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer inventada'
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor", error="invalid_token"
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la credencial no es válida

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer constructor'
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor", error="invalid_token"
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la credencial no es válida

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 189
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}]}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 200 OK
ETag: "3-1-a06a8084"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1

$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -d 'nombre=inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no application/x-www-form-urlencoded

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'inventario'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre": "inventario",'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-a06a8084"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"eterno","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3600000}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

Diecisiete peticiones y ocho códigos distintos: `[401 401 401 200 404 404 200 403 405 404 415 415 400 201 400 400 400]`. Cada error es el «no» de una de las siete preguntas, y cada éxito, una petición que las pasó todas.

#### 2.7.4 La etiqueta sigue funcionando detrás de la puerta

La puerta no cambió nada de lo que la Lección 1 construyó: las peticiones condicionales con `If-None-Match` responden igual, ahora con una credencial. La `ETag` del `revisor` tiene tres partes, `"id-versión-arranque"`: la última son ocho cifras al azar que el `revisor` sortea cada vez que arranca, para que una etiqueta de antes de un reinicio no coincida, en la práctica, con una de después (son 32 bits al azar: una probabilidad de una en 4 295 millones por cada arranque anterior, no una garantía matemática; la Lección 1 explica por qué: el [RFC 9110, sección 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), no permite reutilizar una etiqueta para otra representación). Por eso, para repetir estas peticiones, primero hay que leer la etiqueta vigente. La corrida la guardó en una variable de la terminal, `ETAG`, con la opción `-w '%header{etag}'` de `curl`, que imprime solo esa cabecera:

```text
$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'); echo "ETAG=$ETAG"
ETAG="1-1-a06a8084"

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: W/$ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-a06a8084"
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: \"9-9\", $ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-a06a8084"
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: *'
HTTP/1.1 304 Not Modified
ETag: "1-1-a06a8084"
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: "9-9", W/"8-8"'
HTTP/1.1 200 OK
ETag: "1-1-a06a8084"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Las tres primeras son `304`: `If-None-Match` acepta la etiqueta débil (`W/`), una lista y `*`, como enseñó la Lección 1. La cuarta, una lista sin la etiqueta vigente, recibe el servicio completo. Y la prueba del reinicio: se leyó la etiqueta del servicio 3, se detuvo el `revisor` y se volvió a arrancar (en tu terminal, con `Ctrl`+`C` y `node servidor.ts`), y se pidió el servicio 3 con la etiqueta de antes:

```text
$ ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'); echo "ANTES=$ANTES"
ANTES="3-1-a06a8084"

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b' -H "If-None-Match: $ANTES"
HTTP/1.1 200 OK
ETag: "3-1-ae8e4dbe"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`200`, con una etiqueta nueva: el servicio 3 tiene el mismo id y la misma versión que antes del reinicio, pero las ocho cifras del final cambiaron, y la copia vieja del cliente ya no se da por buena.

La terminal del `revisor` anotó cada petición que le llegó en la corrida, en este orden: las diecisiete de 2.7.3; la de 2.2.3 y la de 2.4.2; las de la etiqueta; la de 2.3.1 en minúsculas y la de `Basic` (el método `constructor` de 2.3.3 no aparece, porque Node lo rechazó antes); las tres altas de cuerpos grandes de 2.6.4 y la consulta que comprueba que el `revisor` sigue vivo; un alta con `-d 'null'` seguida de una consulta, para comprobar que el `revisor` sigue vivo (el ejercicio 4 lo repite); las doce altas de rangos de 2.6.5, y las dos del reinicio, una antes y otra después. Fíjate en el segundo `revisor en …`, el de la segunda vida del proceso:

```text
revisor en http://127.0.0.1:18080
GET /servicios
GET /servicios
GET /servicios
GET /servicios
GET /servicios/3
GET /servicios/99
GET /servicios/3
DELETE /servicios/1
PATCH /servicios/1
GET /servicioss
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
HEAD /servicios/1/revisiones
DELETE /servicios/99
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios
GET /servicios
POST /servicios
POST /servicios
POST /servicios
GET /servicios/1
POST /servicios
GET /servicios/1
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
GET /servicios/3
revisor en http://127.0.0.1:18080
GET /servicios/3
```

## El error que vas a ver

### El `403` que delata

Este es el código que casi todo el mundo escribe la primera vez que separa los servicios por equipo, porque se lee muy natural: busco el servicio; si no existe, `404`; si existe y no es tuyo, `403`. Para provocarlo, copia la carpeta `fig02_01/` como `rota/` y cambia el principio de `consultar` en `rota/servicios.ts` por esto (es un fragmento; la versión completa está en `defectos/403/servicios.ts`):

```ts
export function consultar({ peticion, respuesta, parametros, credencial }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    noExiste(respuesta, parametros[0]);
    return;
  }
  if (credencial.equipo !== "*" && servicio.equipo !== credencial.equipo) {
    fallar(respuesta, 403, `el servicio ${parametros[0]} es de otro equipo`);
    return;
  }
```

Arranca el laboratorio y el `revisor` desde `rota/` y repite el par de 2.5.2:

```text
$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 32
Date: Wed, 21 Oct 2026 13:18:14 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 3 es de otro equipo

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:14 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

Cada respuesta, por separado, parece impecable: el `403` es un código permitido para un recurso prohibido, explica en el cuerpo por qué se negó, y el `404` dice la verdad. El problema está en el **par**. Pásale el enumerador:

```text
$ node fig02_02.ts lectura-a
servicio 1: 200 {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 2: 200 {"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}
servicio 3: 403 el servicio 3 es de otro equipo
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 3
  1, 2               → 200 con datos
  3                  → 403 el servicio N es de otro equipo
  4, 5, 6            → 404 no existe el servicio N
más de dos respuestas: lo que no es tuyo ya no se ve todo igual
```

Tres grupos, y el programa lo avisa. El 3 recibió una respuesta que ningún identificador inexistente recibe, así que `lectura-a` ahora sabe que el servicio 3 existe, y que es de otro equipo, sin haber visto ni uno de sus datos. Con identificadores del 1 al 100 000, sabría cuántos servicios tiene la empresa y cuáles son de otros equipos. Eso es la enumeración del recuadro de 2.5, producida por cuatro renglones que nadie escribió con mala intención.

El arreglo es volver a `visible`: una sola función que devuelve `undefined` para lo ajeno y para lo inexistente, y una sola rama que responde. No basta con cambiar el `403` por un `404` dejando las dos ramas: el día que alguien edite el texto de una y no el de la otra, la diferencia vuelve, ahora en el cuerpo. Detén los programas de `rota/` cuando termines.

### La credencial que nadie emitió

El segundo error es el de la sección 2.3.3. Copia otra vez `fig02_01/` como `rota2/` y cambia en `rota2/autenticacion.ts` la tabla y la búsqueda por la forma con un objeto (la versión completa está en `defectos/prototipo/autenticacion.ts`):

```ts
const CREDENCIALES: Record<string, Credencial> = {
  "lectura-a": { nombre: "lectura-a", equipo: "a", rol: "lector" },
  "escritura-a": { nombre: "escritura-a", equipo: "a", rol: "escritor" },
  "escritura-b": { nombre: "escritura-b", equipo: "b", rol: "escritor" },
  "admin": { nombre: "admin", equipo: "*", rol: "admin" },
};
```

```ts
  const credencial = encontrada === null ? undefined : CREDENCIALES[encontrada[1]];
```

TypeScript no se queja de ninguno de los dos cambios: para él, `CREDENCIALES[token]` es una `Credencial`. Arranca el laboratorio y el `revisor` desde `rota2/` y prueba con dos palabras que nadie dio de alta:

```text
$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer constructor'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 17
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[]}

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer toString'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 17
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[]}
```

`200 OK`. La puerta dejó pasar `constructor` y `toString` como si fueran credenciales. `CREDENCIALES["constructor"]` encontró la función `Object`, que todo objeto hereda; `CREDENCIALES["toString"]`, la función del mismo nombre. Ninguna es `undefined`, así que `identificar` respondió «válida». Que la lista salga vacía es pura suerte: esas «credenciales» no tienen `equipo`, y el filtro de `listar` no encuentra ningún servicio cuyo equipo sea `undefined`. Mira lo que pasa al intentar escribir y al consultar:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer constructor'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer constructor'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:15 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 1
```

El `403` dice «tu credencial solo puede leer»: la puerta cree que sabe quién eres, aunque detrás no haya nadie; no le dejó escribir solo porque la función `Object` no tiene `rol`. Y al consultar, `404`: su `equipo` es `undefined`, así que `visible` no le deja ver ni el servicio 1, que es del equipo a. Esta vez nada se rompió, por suerte. Pero la tercera pregunta de la puerta ya contestó «sí» a alguien que no existe, y cualquier regla que solo pregunte «¿se identificó?» lo dejaría pasar: un registro de auditoría anotaría a un usuario `undefined`, un límite de peticiones por credencial lo trataría como uno más, y una ruta que solo exige estar identificado le respondería. Con el `Map` de `fig02_01/`, las mismas peticiones dan `401` con `error="invalid_token"`, como muestra la tercera petición de la corrida completa de 2.7. Detén los programas de `rota2/` cuando termines.

## Lo que se hace mal

**Un `401` sin `WWW-Authenticate`.** Es el error más común con este código, y la especificación lo prohíbe con un **debe**. Sin el reto, el cliente sabe que le falta identificarse, pero no cómo; algunos clientes HTTP, además, no intentan autenticarse si no ven el reto.

**Un `405` sin `Allow`, o con un `Allow` que miente.** El primero deja al cliente probando métodos a ciegas. El segundo es peor: si `Allow` dice `PUT` y el `PUT` responde `405`, el cliente ya no puede confiar en nada de lo que dice la API. En el `revisor`, `Allow` se calcula con la misma tabla que decide qué método se atiende, así que no puede desviarse; escribirlo a mano en cada respuesta es la forma de que se desvíe.

**`404` para un método que no se admite.** Es lo que hacía el `revisor` de la Lección 1, y manda al cliente a buscar una dirección que estaba bien.

**`403` para quien no se identificó.** Si no sé quién eres, no puedo decir que no te toca: el código es `401`, con su reto. Un `403` a un cliente sin credencial le dice «no insistas», cuando lo que tenía que hacer era identificarse.

**`401` para quien se identificó bien, pero no tiene permiso.** El error contrario. El cliente reintenta con la misma credencial, o pide una nueva, y recibe lo mismo para siempre.

**Validar el cuerpo antes de la credencial.** Le enseña a un desconocido, a fuerza de `400`, qué espera tu API y qué valores admite, y gasta trabajo del servidor en peticiones que de todos modos iban a ser rechazadas.

**Responder distinto a lo ajeno y a lo inexistente.** Un `403` frente a un `404`, o un `404` con «no existe» frente a un `404` con «es de otro equipo», o el mismo texto con un largo distinto. Cualquiera de las tres diferencias basta para enumerar. El recuadro de 2.5 explica el costo.

**`400` para todo.** Un cliente que recibe el mismo `400` cuando el formato está mal, cuando el JSON está cortado o cuando le falta un campo no puede decidir por el código qué corregir; solo le queda interpretar el texto, y un programa no debe decidir con frases. Cada pregunta de la puerta tiene su código para que el cliente sepa cuál falló.

**Leer el cuerpo sin tope.** Cualquiera que llegue a la ruta puede llenarle la memoria al servidor con un solo `POST`, y la sección 2.6.4 midió cuánto: unos 150 MB por petición. El tope se fija por lo que la ruta necesita y se revisa **mientras** se lee, no después.

**Repetir la credencial en el mensaje de error.** El cliente ya sabe qué credencial mandó; las bitácoras, cachés y capturas de pantalla por las que pasa la respuesta no deben saberlo.

**Dejar que una excepción del lector de JSON se convierta en `500`.** `JSON.parse` lanza una excepción con un JSON mal formado. Si nadie la atrapa, el servidor responde `500` (o, en Node, se cae): culpa al servidor de un error del cliente. `leerJson` atrapa la excepción y la convierte en el `400` que es.

## Ejercicios

Los cuatro se corrigen solos: cada uno termina con una corrida que te dice si acertaste. Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada. Para todos necesitas el laboratorio y el `revisor` de 2.7 corriendo, recién arrancados (el `revisor` guarda todo en memoria, y un alta o un retiro anterior cambia las respuestas).

### Ejercicio 1 — ¿En qué pregunta se detiene?

Sin correr nada, predice el código de cada una de estas siete peticiones, y en qué pregunta de la puerta se detiene cada una:

```bash
curl -i -X PATCH http://127.0.0.1:18080/servicios/1
curl -i -X DELETE http://127.0.0.1:18080/servicios/99
curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-b'
curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/nada
```

Después córrelas y compara. Si fallaste alguna, la pista está en el orden: busca la primera pregunta cuya respuesta es «no».

### Ejercicio 2 — Lo que dice `Allow`

Predice la cabecera `Allow` de estas tres respuestas, y si de verdad son `405`:

```bash
curl -i -X DELETE http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
curl -I http://127.0.0.1:18080/servicios
curl -i -X PUT http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
```

`-I` manda un `HEAD`, y `-X` cambia el método. Corre las tres y compara.

### Ejercicio 3 — El enumerador con otras credenciales

Predice qué imprime `fig02_02.ts` con `escritura-b`, con `admin` y con una credencial inventada, `nadie`. ¿En cuál de las tres el programa «descubre» más servicios, y por qué no es una fuga? Corre los tres:

```bash
node fig02_02.ts escritura-b
node fig02_02.ts admin
node fig02_02.ts nadie
```

### Ejercicio 4 — JSON que no es un servicio

Predice el código y el cuerpo de cada una de estas cinco altas. Todas traen una credencial de escritura y dicen ser `application/json`, y todas fallan, pero no en el mismo lugar:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '7'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '[]'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json; charset=utf-8' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"rapido"}'
```

Fíjate en el `Content-Type` de la última: trae un parámetro, `charset=utf-8`. ¿Lo acepta `leerJson`? Corre las cinco y compara. Para cada una, di cuál de las siete preguntas la detuvo, o si pasó las siete y la detuvo una regla del alta.

## Soluciones

### Solución 1

```text
$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/99
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

falta la credencial

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 1

$ curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i http://127.0.0.1:18080/nada
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta
```

En orden: `405` (pregunta 2: la ruta existe y no admite `PATCH`, y se detuvo antes de preguntar quién eres); `401` (pregunta 3: la ruta y el método existen, falta la credencial, y el 99 ni se consultó); `403` (pregunta 4: un lector no borra, exista o no el 99); `415` (pregunta 6: el escritor puede dar de alta, pero el cuerpo no es JSON); `404` (pregunta 5: el servicio 1 es del equipo a, y para `escritura-b` no existe); `403` (pregunta 4: pedir una revisión es escribir, y `lectura-a` solo lee); `404` (pregunta 1: `/nada` no está en la tabla, y no hizo falta credencial). Si fallaste el segundo o el tercero, repasa 2.1.2: son los dos renglones donde el orden de la puerta esconde si el 99 existe.

### Solución 2

```text
$ curl -i -X DELETE http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD
Content-Type: text/plain; charset=utf-8
Content-Length: 37
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

DELETE no se admite en /revisiones/1

$ curl -I http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i -X PUT http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, POST
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PUT no se admite en /servicios
```

El primero es `405` con `Allow: GET, HEAD`: `/revisiones/1` solo se consulta. El segundo **no es un `405`**: `HEAD` se admite donde se admite `GET`, y `/servicios` admite `GET`, así que la puerta pasó a la pregunta 3 y respondió `401`, con su reto, y sin cuerpo porque era un `HEAD` (el `Content-Length: 20` dice cuánto mediría el de un `GET`, como en la Lección 0). El tercero es `405` con `Allow: GET, HEAD, POST`, los métodos de la colección. Fíjate en que los tres `Allow` salieron de la misma tabla de `rutas.ts`, sin escribir ninguno a mano.

### Solución 3

```text
$ node fig02_02.ts escritura-b
servicio 1: 404 no existe el servicio 1
servicio 2: 404 no existe el servicio 2
servicio 3: 200 {"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 2
  1, 2, 4, 5, 6      → 404 no existe el servicio N
  3                  → 200 con datos

$ node fig02_02.ts admin
servicio 1: 200 {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 2: 200 {"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000}
servicio 3: 200 {"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
servicio 4: 404 no existe el servicio 4
servicio 5: 404 no existe el servicio 5
servicio 6: 404 no existe el servicio 6

respuestas distintas: 2
  1, 2, 3            → 200 con datos
  4, 5, 6            → 404 no existe el servicio N

$ node fig02_02.ts nadie
servicio 1: 401 la credencial no es válida
servicio 2: 401 la credencial no es válida
servicio 3: 401 la credencial no es válida
servicio 4: 401 la credencial no es válida
servicio 5: 401 la credencial no es válida
servicio 6: 401 la credencial no es válida

respuestas distintas: 1
  1, 2, 3, 4, 5, 6   → 401 la credencial no es válida
```

`escritura-b` ve solo el 3, y para él el 1 y el 2 son tan inexistentes como el 6. `admin` «descubre» tres servicios, pero no es una fuga: el administrador tiene equipo `*` y puede ver todos, así que ver los tres es su permiso, no una deducción. Y `nadie` no aprende nada: los seis identificadores reciben el mismo `401`, porque la credencial se pregunta antes que la existencia. En los tres casos hay a lo sumo dos grupos, y el aviso del programa no aparece.

### Solución 4

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '7'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '[]'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 20
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

faltan nombre y url

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json; charset=utf-8' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"rapido"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:13 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

Las cinco pasaron las seis primeras preguntas: la ruta existe, admite `POST`, la credencial es válida y puede escribir, una colección no tiene un recurso que pueda no existir, y el tipo es JSON. La última también, aunque su `Content-Type` traiga `; charset=utf-8`: `leerJson` se queda con lo que va antes del `;`, como vimos en 2.6.1. Las tres primeras se detienen en la pregunta 7: `null`, `7` y `[]` se leen como JSON, pero no son un objeto, y `leerJson` las rechaza con `el cuerpo no es un objeto JSON`. Las dos últimas sí son objetos y pasan las siete preguntas; las detienen las reglas del alta: `{}` no trae `nombre` ni `url`, y `"rapido"` no es un entero entre 100 y 10000. Fíjate en que el texto de cada `400` es distinto: con el mismo código, el cuerpo dice qué corregir. Y en lo que no pasó: ninguna de las cinco tumbó al `revisor`, que sigue respondiendo a la siguiente petición.

## Cómo sé que lo logré

- [ ] Dices de memoria las siete preguntas de la puerta en orden, y para cada una, su código.
- [ ] `curl -i http://127.0.0.1:18080/servicios` sin credencial da `401` con `WWW-Authenticate: Bearer realm="revisor"`, y con `Authorization: Bearer inventada` da `401` con `error="invalid_token"` en el reto.
- [ ] Con `Authorization: Basic …` la respuesta es `401` con el reto **sin** `error`, y con `bearer lectura-a`, en minúsculas, es `200`.
- [ ] `curl -i -X PATCH` a `/servicios/1` da `405` con `Allow: GET, HEAD, DELETE`, y `/servicioss` da `404`.
- [ ] `curl -i -X DELETE` a `/servicios/1` y a `/servicios/99` con `lectura-a` dan los dos `403`, y explicas por qué el segundo no es `404`.
- [ ] `lectura-a` pide `/servicios/3` y `/servicios/99`, y las dos respuestas son idénticas salvo por el número; `escritura-b` sí ve el 3.
- [ ] `node fig02_02.ts lectura-a` concluye que solo existen los servicios 1 y 2.
- [ ] Un `POST` con `curl -d` sin `Content-Type` da `415` con `Accept: application/json`, y uno con JSON cortado da `400`.
- [ ] Un `POST` de 20 000 bytes da `413` con `Connection: close`, con `Content-Length` y por partes, y uno de 16 384 bytes da `400`.
- [ ] Explicas por qué la tabla de credenciales es un `Map` y no un objeto, con la corrida de `Bearer constructor`.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/` da el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Cuáles son las siete preguntas de la puerta, en orden, y qué código responde cada una cuando la respuesta es «no»?
2. ¿Qué cabecera exige un `401` y cuál un `405`? ¿Qué sección del RFC 9110 lo dice?
3. ¿Qué pregunta decide entre `401` y `403`?
4. ¿Por qué la credencial va antes que la existencia? ¿Y por qué el permiso del rol va antes que la existencia?
5. ¿Qué permite el RFC 9110 hacer con un recurso prohibido cuya existencia se quiere esconder?
6. ¿Qué es la enumeración de recursos, y qué tres caminos cierra el `revisor` para impedirla?
7. ¿Por qué `415` va antes que `400`? ¿Qué cabecera ayuda al cliente en un `415`, y es obligatoria?
8. ¿Por qué `CREDENCIALES[token]` sobre un objeto de JavaScript puede aceptar una credencial que nadie dio de alta?
9. ¿Qué tienen en común el `413` y el `415`? ¿Por qué `leerCuerpo` necesita dos defensas para el tamaño, y no una?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), sección 15.5.1: el `400` y su definición amplia, «algo que se percibe como un error del cliente».
2. [RFC 9110, sección 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2): el `401` y la cabecera `WWW-Authenticate` obligatoria, con al menos un reto; y la [sección 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), por qué la `ETag` no se reutiliza para otra representación.
3. [RFC 9110, sección 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4): el `403`, la regla de no repetir con las mismas credenciales, y el `404` permitido para «esconder» un recurso prohibido.
4. [RFC 9110, sección 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): el `404`, «no encontró una representación actual o no está dispuesto a revelar que existe».
5. [RFC 9110, secciones 15.5.6 y 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6): el `405` y la cabecera `Allow` obligatoria en él.
6. [RFC 9110, sección 9.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1): la frontera entre `405` (método conocido, no admitido en el recurso) y `501` (método que el servidor no implementa).
7. [RFC 9110, secciones 15.5.16 y 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16): el `415`, y `Accept` en la respuesta para decir qué tipos se habrían aceptado; el `413`, y que el servidor puede cerrar la conexión.
8. [RFC 9110, secciones 11.1, 11.4 y 11.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1): el nombre del esquema de autenticación no distingue mayúsculas, la forma de la credencial (`esquema` y un espacio) y la forma del reto en `WWW-Authenticate`.
9. [RFC 9110, sección 8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1): el tipo y el subtipo de un `Content-Type` no distinguen mayúsculas; lo que sigue al `;` son parámetros.
10. [RFC 6750, *The OAuth 2.0 Authorization Framework: Bearer Token Usage*](https://www.rfc-editor.org/rfc/rfc6750.html), secciones 3 y 3.1: el esquema `Bearer`, el reto con `realm`, el código `invalid_token` y la regla de no mandar código de error cuando la petición no trae autenticación o usa un esquema que no se admite.
11. [OWASP API Security Top 10, API1:2023 *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization): comprobar en cada acceso que quien pide puede usar ese registro, e identificadores difíciles de adivinar.
12. [OWASP Web Security Testing Guide, WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md): la enumeración por diferencias entre `403` y `404`, y las respuestas genéricas como defensa.
13. [Documentación de la API REST de GitHub, *Troubleshooting*](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api): responde `404` y no `403` a un recurso privado, para no confirmar que existe.
14. [Manual de `curl`](https://curl.se/docs/manpage.html), opciones `-d`, `-H`, `-X`, `-I` y `-w`: `-d` manda `application/x-www-form-urlencoded` si no se indica otro tipo, y `-w '%header{etag}'` imprime una cabecera de la respuesta.
15. [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): `message.headers` con los nombres de las cabeceras en minúsculas, como los lee `identificar` (`peticion.headers.authorization`) y `leerJson` (`peticion.headers["content-type"]`).

### Términos de esta lección

| | |
|---|---|
| **autenticación** | averiguar quién hace la petición; si falla, `401` |
| **autorización** | decidir si quien hace la petición puede hacer eso; si no, `403` |
| **`Bearer`** | esquema de autenticación del RFC 6750: quien porta la credencial es quien dice ser |
| **enumeración de recursos** | averiguar qué recursos existen probando identificadores y comparando las respuestas |
| **la puerta** | las preguntas que una petición pasa, en orden, antes de llegar a su manejador |
| **reto** (*challenge*) | el valor de `WWW-Authenticate`: el esquema con el que hay que autenticarse y sus parámetros |
| **rol** | lo que una credencial puede hacer: en el `revisor`, lector, escritor o admin |
| **tope del cuerpo** | el tamaño máximo que una ruta acepta leer; si se pasa, `413` |
| **prototipo** | el objeto del que un objeto de JavaScript hereda propiedades, como `constructor` o `toString` |

---

**Anterior:** [Lección 1 — Éxitos y redirecciones: 200, 201, 202, 204, 301, 308 y 304](01-exitos-redirecciones.md) · **Siguiente:** [Lección 3 — El cliente se equivocó (II): 409, 410, 412, 422 y 428](03-errores-del-cliente-estado.md)

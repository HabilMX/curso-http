# Lección 5 — Problem Details (RFC 9457)

Son las 03:20 de un jueves y el tablero del equipo de integraciones dice que el servicio `pagos` desapareció. No desapareció: sigue en el `revisor`, con su id 2 de siempre. Lo que pasó es más tonto y más caro. Hace dos semanas alguien escribió un guion que sincroniza la lista de servicios con el tablero. Cuando el `revisor` le contesta un error, el guion lee el cuerpo, y si encuentra las palabras «no existe», borra el servicio del tablero. Esta noche alguien más cambió la dirección base del guion y le quitó una letra. El `revisor` respondió `404` con «no existe esa ruta», el guion vio «no existe» y borró los seis servicios del tablero, uno por uno. Mientras tanto, otro guion del mismo equipo intenta dar de alta un servicio que ya existe, recibe `409` con «ya existe un servicio llamado pagos: /servicios/2», parte el texto en los dos puntos para sacar el id… y ayer alguien corrigió la redacción de ese mensaje y le puso un punto final. Ahora el guion busca el servicio `/servicios/2.`, que no existe, y reintenta cada segundo. Nadie hizo nada mal a propósito. Los dos guiones leyeron frases porque el `revisor` no les dio otra cosa que leer.

Esta lección le da al `revisor` una sola forma de decir qué salió mal, la que define el RFC 9457, con una parte para las máquinas que no cambia nunca y otra para las personas que se puede redactar como se quiera.

**Tiempo:** 90 min, o 2 × 45 (el corte está entre las secciones 5.8 y 5.9)

**Qué construyes:** el manejador central de errores del `revisor`, `problemas.ts`: un catálogo con un `type` estable para cada problema y una sola función, `fallar`, por la que pasan todos los errores de la API; y un programa que comprueba que cada error sea un Problem Details bien formado

**Qué aprendes:** `application/problem+json`; los cinco miembros `type`, `title`, `status`, `detail` e `instance`, y para qué sirve cada uno; **`type` como identificador estable**; `about:blank` y por qué su `title` va en inglés; las extensiones y sus reglas; qué hacer cuando hay varios problemas en una respuesta; el registro oficial de tipos de la IANA; y lo que cambió del RFC 7807 al RFC 9457

**De dónde vienes.** De la [Lección 4](04-capacidad-y-fallas-del-servidor.md), con un `revisor` que ya produce todos los códigos de error del curso: los de la puerta de la Lección 2, los de estado de la Lección 3 y los de capacidad y fallas de la Lección 4. Cada código está bien elegido y lleva sus cabeceras. Pero el cuerpo de cada error es una línea de texto escrita a mano en el lugar donde ocurre, y cada lugar la escribe a su manera. Esta lección no cambia ningún código ni ninguna de las cabeceras que cada código exige (`Allow`, `WWW-Authenticate`, `Retry-After`, `Accept`): cambia el cuerpo de todos los errores a la vez, y con él su `Content-Type`.

**Qué no hace esta lección.** No enseña a decidir qué hacer con un error del lado del cliente: aquí se diseña lo que el `revisor` dice, y la [Lección 7](07-quien-lee-el-error.md) escribe el programa que lo lee y decide. No documenta los tipos en OpenAPI ni los comprueba en cada cambio; eso es la [Lección 8](08-contrato-verificable.md). Y no publica páginas de documentación en las direcciones de los `type`: el curso usa un dominio reservado para ejemplos, que no se puede visitar, y la sección 5.4 explica qué harías en una API real.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS con Node 24.14.1 y curl 8.7.1, agregando `-sS` a cada `curl` porque la salida iba a un archivo (`-s` apaga el medidor de progreso, `-S` deja ver los errores, y ninguna de las dos cambia la respuesta). Como en la Lección 1, mientras se escribía esta lección otras pruebas ocupaban el 18080 y el 18081, así que las corridas se hicieron con una copia de los programas idéntica salvo por los puertos, 18580 y 18581, y en las salidas pegadas aquí se volvieron a escribir 18080 y 18081, que son los que vas a teclear tú. Los dos números tienen las mismas cifras, así que ningún `Content-Length` cambia. En la terminal del `revisor`, la carpeta de la máquina se sustituyó por `<carpeta>`. En tu corrida van a cambiar la fecha de `Date`, las ocho cifras finales de cada `ETag` (el `revisor` las sortea al arrancar) y la referencia `urn:uuid:` de cada error interno, que es nueva en cada ocurrencia, a propósito (sección 5.8). El `revisor` guarda todo en memoria: para obtener lo mismo que la lección, arráncalo de nuevo antes de cada serie de peticiones. No se corrió en una instalación de escritorio de Mint, y nada de lo que se usa depende de macOS. Los programas están en [`programas/05-problem-details/`](../programas/05-problem-details), en el repositorio del curso: el `revisor` en `fig05_01/`, el comprobador en `fig05_02.ts`, las versiones rotas de «El error que vas a ver» en `defectos/`, la solución del ejercicio 4 en `ejercicio4/`, la corrida del `revisor` de la Lección 4 en `antes.salida.txt` y cada corrida en su archivo `.salida.txt`. Todos pasan `tsc` en modo estricto (sección 5.16).

## Al terminar vas a poder

- Reconocer un Problem Details por su `Content-Type` y nombrar, sin mirar, sus cinco miembros y lo que dice cada uno.
- Decidir para un error nuevo si merece un `type` propio o basta con `about:blank`, y escribir su entrada en el catálogo con `type`, `title` y `status`.
- Explicar por qué el `type` no cambia nunca, ni entre ocurrencias ni entre idiomas, y por qué un cliente no debe decidir leyendo `title` ni `detail`.
- Agregar una extensión a un tipo de problema respetando las reglas de nombre del RFC 9457, y comprobar con una corrida que el `revisor` rechaza una extensión con nombre reservado.
- Responder varios problemas del mismo tipo en un solo cuerpo, con `errors` y `pointer`, y elegir cuál responder cuando los problemas son de tipos distintos.
- Correr un programa que compruebe que todos los errores de la API son Problem Details bien formados, y leer sus fallas en dos versiones rotas a propósito.

## El porqué antes del cómo

Las cuatro lecciones anteriores se ocuparon del código de estado, y con razón: es la parte del mensaje que entiende cualquier máquina del camino. Pero el código dice poco. Un `404` dice «no encontré lo que pediste», y en el `revisor` eso puede significar que la ruta no existe, que el servicio no existe, que el servicio es de otro equipo o que la revisión no existe. Un `422` dice «entendí, pero no puedo cumplirlo», y no dice qué campo falló. Un `409` dice «choca con el estado actual», y no dice con qué. El código manda, y para muchas decisiones basta. Para las demás, **el cuerpo explica**, y la pregunta de esta lección es cómo explica.

Hasta la Lección 4, el `revisor` explicaba con una línea de texto. Eso tiene tres costos, y la escena del principio los muestra todos:

1. **Cada error tiene su propia forma.** El `422` trae un renglón por campo, separado por saltos de línea; el `409` trae la ruta del servicio existente pegada al final de la frase; el `500` trae la referencia al final de otra frase. Un cliente que quiera aprovechar esa información escribe un traductor distinto para cada error.
2. **Lo que una máquina necesita está mezclado con lo que una persona lee.** El id del servicio repetido está dentro de una frase. Para sacarlo hay que partir el texto, y el día que alguien mejora la redacción, el cliente se rompe sin que el código de estado haya cambiado.
3. **No hay un nombre estable para el problema.** «No existe el servicio 99» y «no existe esa ruta» son dos problemas distintos con el mismo código, y la única forma de distinguirlos es leer la frase. Si mañana el `revisor` se traduce al inglés, todos los clientes que leían frases se rompen a la vez.

El RFC 9457 resuelve las tres cosas con un objeto JSON de cinco miembros. Uno de ellos, `type`, es un nombre para el problema que no cambia nunca, y es lo único que una máquina necesita para decidir. Otros dos, `title` y `detail`, son para personas, y se pueden redactar y traducir como se quiera. Lo que una máquina necesita además del nombre —el id del servicio repetido, la lista de campos que fallaron— va en miembros propios, las extensiones, nunca dentro de una frase. Y todo viaja con un tipo de contenido propio, `application/problem+json`, para que cualquiera sepa qué está leyendo antes de abrirlo.

La lección tiene cuatro partes:

1. **El formato** (5.1 a 5.3): qué cambia en la respuesta, el tipo de contenido y los cinco miembros.
2. **Cada miembro a fondo** (5.4 a 5.8): `type` y `about:blank`, `title` y `detail`, `status`, `instance`.
3. **Más allá de los cinco** (5.9 a 5.12): extensiones, varios problemas, el registro de la IANA y la historia del formato.
4. **El `revisor` completo** (5.13 a 5.16): el manejador central, los archivos, la corrida y el programa que lo comprueba.

## Los conceptos

### 5.1 El mismo error, antes y después

Empieza por ver el problema. Estas cuatro peticiones son al `revisor` de la Lección 4, tal como lo dejaste:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https
limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2
```

Cada respuesta es correcta en lo que la Lección 4 pedía: buen código, buenas cabeceras, una frase clara. Pero mira los cuerpos como los vería un programa. El primero es una frase con un número adentro. El segundo, otra frase con un método y una ruta adentro. El tercero, tres renglones con un formato propio, `campo: explicación`, que no aparece en ningún otro error. El cuarto mete una ruta al final de la frase, después de dos puntos. Cuatro errores, cuatro formas, y todas son `text/plain`: nada en la respuesta le dice al cliente que hay estructura que pueda aprovechar.

Ahora, la misma primera petición al `revisor` de esta lección:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}
```

Tres cosas cambiaron. El `Content-Type` ya no es `text/plain` sino `application/problem+json`. Apareció `Content-Language: es`, que dice en qué idioma están las partes para personas. Y el cuerpo es un objeto JSON con cinco miembros, siempre los mismos cinco, en todos los errores que responde el `revisor`. El código y su frase, `404 Not Found`, no cambiaron. **El código sigue mandando; el cuerpo ahora explica con una estructura que se puede leer sin interpretar frases.**

Lo que no cambió también importa. La Lección 4 dejó claro que un error del servidor no lleva pilas, rutas de la máquina ni secretos, y el formato nuevo no relaja nada de eso: un Problem Details es una superficie pública igual que el texto de antes, y el propio RFC 9457 lo dice en su sección 5 (sección 5.8 de esta lección).

### 5.2 `application/problem+json`: el tipo de contenido

El RFC 9457 define el modelo de un problema como un objeto JSON y, cuando ese objeto viaja como documento, le pone un tipo de contenido propio: `application/problem+json` (sección 3). Está inscrito en el registro de tipos de contenido de la IANA, que hoy remite al RFC 9457: no tiene parámetros obligatorios, ni opcionales, y para todo lo demás se comporta como `application/json`. El sufijo `+json` es una convención general: dice «esto es JSON con un significado particular». Un programa que no conozca el significado lo puede leer como JSON; uno que lo conozca sabe, antes de abrir el cuerpo, que adentro hay un problema con `type`, `title` y los demás.

¿Por qué no basta `application/json`? Porque el tipo de contenido es lo primero que ve un cliente, y con `application/json` no puede distinguir un error de un recurso. Piensa en un cliente genérico que recibe un `404` de una API que no conoce. Si el tipo es `application/problem+json`, sabe que puede buscar `type` y `detail` y mostrarlos. Si es `application/json`, puede ser un problema, puede ser una página de resultados vacía con su propia forma, puede ser cualquier cosa. La sección «El error que vas a ver» provoca justo eso: un cuerpo perfecto con el tipo equivocado, y el programa que comprueba los errores lo rechaza en los trece casos.

Hay una versión en XML, `application/problem+xml`, que el RFC define en su apéndice B para las APIs que hablan XML. El `revisor` habla JSON, así que no la usa.

El RFC agrega un detalle que conviene conocer: su segundo ejemplo, el mismo de `errors` y `pointer` que usa el `revisor`, manda `application/problem+json` aunque el cliente solo pidió `Accept: application/json`, y aclara que HTTP lo permite (sección 3, con referencia a la sección 12.5.1 del RFC 9110). La negociación de contenido es una preferencia del cliente, no una orden: el RFC 9110 dice en su sección 12.4.1 que, si ninguna representación es aceptable según una cabecera de negociación, el servidor puede responder `406` o ignorar esa cabecera. Para un error, ignorarla es casi siempre lo mejor: un `406` en lugar de la explicación del error deja al cliente sin saber qué falló. El ejercicio 3 lo comprueba con el `revisor`.

### 5.3 Los cinco miembros

Este es el cuerpo de la respuesta anterior, en varios renglones para leerlo mejor (es un fragmento: el `revisor` lo manda en uno solo):

```json
{
  "type": "https://revisor.example/problemas/servicio-inexistente",
  "title": "El servicio no existe",
  "status": 404,
  "detail": "no existe el servicio 99",
  "instance": "/servicios/99"
}
```

El RFC 9457 define cinco miembros en la sección 3.1, y esta tabla dice para quién es cada uno y qué pregunta contesta:

| Miembro | Tipo | Para quién | Qué contesta | ¿Cambia entre ocurrencias? |
|---|---|---|---|---|
| `type` | texto (un URI) | máquinas | ¿qué problema es? | nunca |
| `title` | texto | personas | ¿cómo se llama ese problema? | no, salvo por el idioma |
| `status` | número | máquinas que perdieron la línea de estado | ¿qué código respondió el servidor? | no en el `revisor`, que usa un solo código por `type` (el RFC deja que un `type` admita varios) |
| `detail` | texto | personas | ¿qué pasó esta vez, y cómo lo corrijo? | sí |
| `instance` | texto (un URI) | quien da soporte | ¿cuál ocurrencia fue? | sí |

Los cinco son opcionales para el RFC: un problema sin `type` vale como `about:blank` (sección 3.1.1), y los demás pueden faltar. **El `revisor` los manda siempre los cinco**, en el mismo orden, en todos los errores que responde él (el `400` de un método con nombre absurdo, como `-X constructor`, lo contesta el analizador de Node antes de que el `revisor` lo vea, y por eso no trae cuerpo; la sección 5.14 lo muestra). Es una decisión de diseño, no una norma: un cliente que sabe que siempre están no tiene que escribir el caso en que faltan, y una comprobación automática puede exigirlos (el programa de la sección 5.15 lo hace).

El RFC tiene una regla para el que lee que vale la pena aprender temprano: **si un miembro trae un tipo que no es el suyo, se ignora**, como si no estuviera (sección 3.1). Un `status` que llega como texto, `"404"`, no es un número, así que un cliente que siga el RFC hace como si no hubiera `status`. Es una regla pensada para que un cliente no se rompa con un servidor descuidado, y es otra razón para que el servidor sea cuidadoso: un error de tipo no da un mensaje de error, da un miembro que desaparece en silencio.

Las cinco secciones que siguen toman cada miembro por separado.

### 5.4 `type`: el identificador estable

Mira las dos primeras respuestas de la corrida de esta lección. La primera pide un servicio que no existe; la segunda, el servicio 3, que sí existe pero es del equipo b, y quien pregunta es del equipo a:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 172
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 3","instance":"/servicios/3"}
```

Las dos tienen el **mismo `type`** y el mismo `title`. Solo cambian `detail` e `instance`, y en los dos casos solo por el número. Es lo que la Lección 2 te pidió para no delatar qué servicios existen: el `404` que esconde a propósito tiene que ser indistinguible del `404` de algo que no existe, y ahora la regla alcanza también al `type`. Un `type` distinto para «es de otro equipo» sería la misma fuga que un `403`, escrita en otro lugar.

**El `type` es el nombre del problema, y es lo único con lo que una máquina debe decidir.** El RFC lo dice con un **debe**: quien consume un problema tiene que usar el `type` como el identificador principal del tipo de problema (sección 3.1.1). No el `title`, que se traduce. No el `detail`, que cambia en cada ocurrencia. El `type`.

De ahí sale la regla que da nombre a esta sección: **un `type` no cambia nunca.** No cambia de una ocurrencia a otra: el servicio 99 y el servicio 3 dan el mismo. No cambia entre idiomas: si el `revisor` se tradujera al inglés, `title` y `detail` cambiarían, y el `type` seguiría siendo `https://revisor.example/problemas/servicio-inexistente`, con sus palabras en español, porque no es una palabra sino un identificador. Y no cambia entre versiones de la API: cambiar un `type` es un cambio que rompe a todos los clientes que decidían con él, igual que cambiar una ruta.

**Un `type` es un URI.** El RFC permite cualquier referencia de URI, pero recomienda que sea absoluta (sección 3.1.1). Un `type` relativo, como `servicio-inexistente`, se resolvería contra la dirección de la petición, y la misma palabra significaría dos cosas distintas según dónde se pidió: el RFC pone justo ese ejemplo. El `revisor` usa direcciones absolutas bajo `https://revisor.example/problemas/`, más la clave del problema.

**Si un `type` es una dirección `https`, al visitarla debería haber documentación** para personas que explique el problema y cómo resolverlo (sección 3.1.1 y sección 4: «A problem type URI SHOULD resolve to HTML documentation»). En una API real, `https://tuapi.example.com/problemas/servicio-inexistente` sería una página que diga cuándo ocurre, qué significa cada extensión y qué hacer. El curso usa `revisor.example` porque `.example` es un dominio reservado para la documentación (RFC 6761), que no apunta a ninguna máquina: así ningún ejemplo del curso coincide con el dominio de una empresa real. En tu API, el `type` va bajo un dominio que controles.

Dos reglas más del RFC sobre los `type` resolubles. La primera: el cliente **no debería** visitar el `type` automáticamente, salvo para dar información a quien desarrolla, por ejemplo con una herramienta de depuración (sección 3.1.1). El `type` se compara, no se descarga: un cliente que pidiera la página en cada error duplicaría las peticiones y dependería de que la documentación esté arriba. La segunda: el RFC permite un `type` que no se pueda visitar, como un URI `tag:`, pero recomienda los resolubles, porque si un día quieres publicar la documentación y tu `type` no era una dirección, tendrás que cambiarlo, y cambiarlo rompe a todos.

Y la pregunta de diseño de esta sección: **¿cuándo un problema merece un `type` propio?** El RFC da el criterio en la sección 4: los problemas genéricos, los que podrían ocurrirle a cualquier recurso de la web, se expresan mejor con el código a secas. Su ejemplo es un `403` a un `PUT`: un tipo «no puedes escribir» no agrega nada que el código no diga. Un `type` propio vale la pena cuando el problema es de tu dominio y el cliente necesita distinguirlo de otros con el mismo código: «el servicio no existe» frente a «la revisión no existe» frente a «la ruta no existe», o «los datos no se pueden cumplir» frente a «el revisor no se conecta a ese destino», que son los dos `422` del `revisor`.

### 5.5 `about:blank`: el problema que es solo su código

Cuatro errores del `revisor` no tienen `type` propio. Estos son dos:

```text
$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 111
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Not Found","status":404,"detail":"no existe esa ruta","instance":"/servicioss"}

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, DELETE
Content-Type: application/problem+json
Content-Language: es
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Method Not Allowed","status":405,"detail":"PATCH no se admite en /servicios/1","instance":"/servicios/1"}
```

Una ruta que no existe y un método que la ruta no admite son problemas de HTTP, no del `revisor`: le pueden pasar a cualquier API, y el código ya dice todo lo que hay que decir (con `Allow`, en el caso del `405`). Para eso existe `about:blank`. El RFC lo inscribe como el único tipo que trae el registro desde el principio, y dice que **un problema `about:blank` no tiene más significado que el de su código de estado** (sección 4.2.1). Los otros dos son el `415`, un cuerpo que no se declara JSON, y el `413`, un cuerpo de más de 16 KiB, que verás en la corrida de la sección 5.14.3: a cualquier API le pueden llegar, y el código, con sus cabeceras, ya lo dice todo.

`about:blank` es además el valor por omisión: un problema sin `type` vale como si dijera `about:blank` (sección 3.1.1 y 4.2.1). El `revisor` lo escribe de todos modos, por la regla de los cinco miembros.

**Con `about:blank`, el `title` es la frase del código.** El RFC dice que el `title` **debería** ser la frase recomendada para ese código: `Not Found` para `404`, y así con todos (sección 4.2.1). Por eso el `revisor` dice `Not Found`, `Method Not Allowed` y `Unsupported Media Type`, en inglés, aunque todo lo demás esté en español. La razón es que con `about:blank` no hay un tipo propio que dé nombre al problema: el nombre del problema es el código, y el código tiene una frase oficial, la del registro de códigos de la IANA, que todo el mundo reconoce.

El mismo renglón del RFC agrega que esa frase **puede** traducirse según lo que pida el cliente con `Accept-Language`. Es un permiso, no una obligación, y el `revisor` no lo usa: deja la frase del registro tal cual. Lo que sí va en español en esos tres errores es el `detail`, que explica la ocurrencia: «no existe esa ruta», «PATCH no se admite en /servicios/1». Es la misma división de siempre: el nombre, estable; la explicación, para quien lee.

¿Y no es raro mandar `Content-Language: es` con un `title` en inglés? El RFC 9110 lo prevé: `Content-Language` describe el idioma del público al que va dirigida la representación, y dice que eso «puede no ser equivalente a todos los idiomas que se usan dentro» de ella (sección 8.5). El público del `revisor` lee español; que un nombre propio de HTTP aparezca en inglés no cambia a quién va dirigido.

Un detalle de precisión que el `revisor` resuelve en `respuestas.ts`: Node trae los nombres viejos de dos códigos, `413` y `422`, y el registro de la IANA tiene los nuevos, `Content Too Large` y `Unprocessable Content`. La línea de estado usa los del registro. Y el `413` del `revisor` es `about:blank`, así que su `title` también tiene que ser el del registro, `Content Too Large`, no el `Payload Too Large` que trae Node: el catálogo lo escribe a mano, y el programa de la sección 5.15 lo comprueba.

### 5.6 `title` y `detail`: lo que se traduce

`title` y `detail` son los dos miembros para personas, y se diferencian en una sola cosa: **`title` es del tipo y `detail` es de la ocurrencia.**

El `title` es un resumen corto del tipo de problema. El RFC dice que **no debería** cambiar de una ocurrencia a otra, salvo para traducirlo (sección 3.1.3). «El servicio no existe» es el mismo para el servicio 99, para el 3 y para el que pidas mañana. Por eso en el `revisor` el `title` vive en el catálogo, junto al `type`, y no lo escribe quien responde: lo escribe quien diseña el tipo, una vez. El RFC agrega que el `title` es solo orientativo, pensado para quien no conoce el significado del `type` y no lo puede averiguar, por ejemplo al leer una bitácora sin conexión.

El `detail` explica **esta** ocurrencia: «no existe el servicio 99». El RFC le pide dos cosas (sección 3.1.4). La primera, que se enfoque en ayudar al cliente a corregir el problema, no en dar información de depuración: «el servicio 5 no respondió en 1000 ms» le dice qué pasó y le sugiere qué cambiar (el límite del servicio); una pila no le sirve de nada y le enseña al mundo cómo está hecho el servidor. La segunda es una regla para el que lee: **el cliente no debería interpretar el `detail` para sacar información**; para eso están las extensiones, que son «más adecuadas y menos propensas a errores».

Esa segunda regla es la escena del principio escrita como norma. El `409` de la Lección 4 decía «ya existe un servicio llamado pagos: /servicios/2», y el guion partía la frase. Compáralo con el de esta lección:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 219
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado pagos","instance":"/servicios","existente":"/servicios/2"}
```

La ruta salió del `detail` y se mudó a su propio miembro, `existente`. El `detail` ya no la necesita y es una frase limpia, que se puede mejorar, acortar o traducir sin romper a nadie. El cliente que necesite el servicio existente lee `existente` y obtiene `/servicios/2`, sin partir texto. Esa es la extensión de la sección 5.9.

La división también te deja mejorar los textos sin pedirle permiso a nadie. Imagina que el `title` de `etiqueta-vencida` dijera «El servicio cambió desde que lo leíste». Sería falso en un caso: tras un reinicio, la etiqueta vieja tampoco coincide, aunque nadie haya cambiado el servicio. Cambiarlo por «Tu etiqueta ya no es la vigente», que es cierto en los dos casos y es el que usa el `revisor`, no rompería a ningún cliente, porque el `type`, `https://revisor.example/problemas/etiqueta-vencida`, seguiría igual. Un `title` se corrige; un `type` no se toca.

**Lo que se traduce y lo que no**, en una línea: se traducen `title` y `detail`; no se traducen `type`, `status`, `instance` ni los nombres ni los valores de las extensiones. El curso tiene ediciones en otros idiomas, pero el código de los programas se copia sin traducir: el `revisor` de todas las ediciones responde con el `title` y el `detail` en español, y el `type` es idéntico en todas. Si un `revisor` se tradujera, cambiarían esos dos y el `type` seguiría igual. Un cliente escrito contra la edición en español funciona igual contra un `revisor` que responda en búlgaro, porque nunca leyó una palabra.

### 5.7 `status`: el código, repetido a propósito

`status` es el código de estado, como número, el mismo de la línea de estado. ¿Para qué repetirlo? El RFC da dos razones (sección 3.1.2). Un intermediario, como una caché o un proxy, pudo cambiar el código en el camino, y el cliente puede ver cuál era el original. Y un problema se puede guardar sin su respuesta HTTP —en una bitácora, en una cola, en un correo—, y ahí ya no hay línea de estado.

Pero tiene una regla dura: quien genera el problema **debe** usar en la respuesta HTTP el mismo código que pone en `status`. Y el miembro es solo orientativo: el software HTTP genérico —proxies, balanceadores, cortafuegos, antivirus— no lo conoce ni lo respeta, y sigue usando el código de la línea de estado (secciones 3.1.2 y 5). **Si los dos difieren, ganó la línea de estado para todo el que no lee el cuerpo**, que es casi todo el camino. Es el primer criterio del curso dicho en un caso concreto: el cuerpo nunca contradice al código.

El RFC lo pone en su sección de seguridad, y vale citarlo entero en idea: como `status` duplica lo que ya dice la línea de estado, existe la posibilidad de que los dos no coincidan, y no está claro cuál tiene precedencia. Por eso en el `revisor` no hay forma de que difieran: el `status` sale del catálogo junto con el `type`, y la misma función que escribe el cuerpo escribe la línea de estado con ese número. Quien responde un error no elige el código: elige el problema, y el problema trae su código.

### 5.8 `instance`: cuál ocurrencia fue

`instance` es un URI que identifica **esta ocurrencia** del problema (sección 3.1.5). El RFC deja abierto qué URI usar, y el `revisor` toma dos decisiones distintas según el caso.

**En los errores del cliente, `instance` es la ruta que se pidió, sin la consulta**: `/servicios/99`, `/servicioss`, `/servicios`. Le dice a quien lee el problema en una bitácora a qué recurso iba la petición. Se quita la consulta (lo que va después de `?`) porque en una consulta a veces viajan datos que no deben quedar copiados en un error. Ojo: la terminal del `revisor` sí registra la petición completa, con su consulta; en una API real, la bitácora también recorta o enmascara lo que no debe guardarse. Y es un criterio de diseño que conviene decir con todas sus letras: se aparta un poco del RFC. El RFC define `instance` como el identificador de **esta** ocurrencia, y dice que, si el URI se puede visitar, ahí debería poder obtenerse el problema (sección 3.1.5). `/servicios/99` se puede visitar, pero devuelve el recurso (o el mismo `404`), no esta ocurrencia; y dos peticiones a `/servicios/99` dan el mismo `instance`. Se usa porque le dice a quien lee una bitácora a qué recurso iba la petición, y el RFC la deja pasar en la forma: su propio ejemplo usa una ruta (`/account/12345/msgs/abc`), y recomienda que un URI relativo lleve la ruta completa. Donde sí importa identificar la ocurrencia, en el `500`, el `revisor` usa una referencia única.

**En el error interno, `instance` es una referencia única**:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer escritura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:d80e7ef5-6cf9-4099-83a4-53c6d6116787"}
```

`urn:uuid:` seguido de un identificador universal único (RFC 9562) es un URI que no se puede visitar y cuya probabilidad de repetirse es despreciable (122 bits al azar: no es imposible, es absurdamente improbable). Cada `500` trae uno nuevo, y el mismo identificador queda en la terminal del `revisor`, junto con la pila:

```text
GET /servicios/1/informe
error d80e7ef5-6cf9-4099-83a4-53c6d6116787 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
```

Así trabaja el soporte con un error del servidor: el cliente reporta «me salió el `urn:uuid:…`», y quien opera busca ese texto en su bitácora y encuentra la pila exacta, la ruta y la hora. El cliente no recibe la pila ni la necesita. Es la misma referencia que la Lección 4 ponía en la frase del `500`, ahora en el miembro que el RFC diseñó para eso, y con un `detail` que ya no la repite: «ocurrió un error inesperado; si se repite, reporta la referencia».

El RFC sugiere que, si el `instance` se puede visitar, ahí se pueda obtener el problema completo (sección 3.1.5), y en su sección de seguridad advierte que quien ofrezca esa información por HTTP evite exponer detalles de la implementación, como un volcado de pila. El `revisor` no ofrece esa página: la pila vive en la terminal, que solo ve quien opera.

**Hasta aquí la primera mitad.** Si trabajas en dos sesiones, este es el corte.

### 5.9 Extensiones: lo que el tipo agrega

Un tipo de problema **puede** agregar miembros propios al objeto (sección 3.2). Se llaman extensiones, y son el lugar para todo lo que una máquina necesita además del nombre del problema. El `revisor` tiene dos: `existente` en el `409`, que ya viste, y `errors` en el `422`, que verás en la sección 5.10.

**Una extensión pertenece al tipo, no a la ocurrencia.** La define quien diseña el tipo, junto con su `type`, su `title` y su `status`, y se documenta en la página del `type`. `existente` siempre está en un `nombre-repetido`, y siempre es la ruta del servicio que ya tiene ese nombre. Un cliente que conoce el tipo sabe que puede contar con ella.

**El cliente debe ignorar las extensiones que no conoce** (sección 3.2). Es la regla que deja crecer a los tipos: si mañana el `revisor` agrega a `nombre-repetido` una extensión `sugerencia` con un nombre libre, los clientes de hoy siguen funcionando, porque no la buscan. Por la misma razón, quitar una extensión que los clientes usan sí rompe: es como quitar un campo de un recurso.

**El nombre de una extensión tiene reglas.** El RFC dice en la sección 4 que el nombre **debería** empezar con una letra, usar solo letras, dígitos y guion bajo, y tener tres caracteres o más. Las dos primeras reglas tienen una razón que el RFC da: que el nombre se pueda escribir también en otros formatos distintos de JSON, como XML. La de las tres letras el RFC la pide sin explicarla; es una recomendación (*SHOULD*), no una obligación. `existente` y `errors` cumplen. `ex` no cumpliría (tiene dos letras) y `nombre-previo` tampoco (lleva guion). El ejercicio 4 te pide hacer que `problemas.ts` lo compruebe.

**Y el nombre no puede ser el de un miembro estándar.** Aquí hay una trampa de JavaScript. `fallar` arma el cuerpo con `{ type, title, status, detail, instance, ...extensiones }`: primero los cinco y después las extensiones. Si alguien pasara una extensión llamada `status`, el `...` la escribiría encima del `status` del catálogo, y el cuerpo diría un código distinto del de la línea de estado: el desacuerdo que la sección 5.7 dijo que no podía pasar. Por eso `fallar` rechaza los cinco nombres reservados antes de armar el cuerpo, lanzando un error. Ese error lo atrapa `servidor.ts` y lo convierte en un `500` con su referencia: es un defecto del programa, no del cliente, y así se ve en la terminal en vez de salir como una respuesta que miente.

¿Y las cabeceras? `Retry-After` en el `503`, `Allow` en el `405`, `WWW-Authenticate` en el `401` y `Accept` en el `415` siguen siendo cabeceras, no extensiones. El RFC lo prevé: una definición de tipo puede pedir que la respuesta lleve `Retry-After` (sección 4). Las cabeceras las lee el software HTTP genérico; una extensión solo la lee quien entiende el tipo. Lo que HTTP ya tiene como cabecera se queda como cabecera, y por eso `fallar` recibe las cabeceras aparte de las extensiones.

### 5.10 Varios problemas en una respuesta

Una petición puede tener más de un problema. El RFC distingue dos casos, y el `revisor` tiene los dos.

**Varios problemas del mismo tipo: una extensión con la lista.** Un alta con tres campos malos tiene tres veces el mismo problema, «los datos no se pueden cumplir»:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 407
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"3 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"},{"detail":"debe ser un entero entre 100 y 10000","pointer":"#/limite_ms"}]}
```

Un solo problema `datos-invalidos`, con una extensión `errors` que lista las tres fallas. Cada falla es un objeto con su `detail`, que explica qué está mal, y un `pointer`, que dice dónde. Es exactamente la forma del segundo ejemplo de la sección 3 del RFC 9457, que define un tipo de validación con la extensión `errors` y dice que, cuando el tipo está diseñado para ello, las extensiones pueden llevar más de una ocurrencia del mismo problema. El `detail` de arriba solo cuenta cuántas fallas hay: lo que el cliente necesita está en la lista.

El `pointer` es un **JSON Pointer** (RFC 6901): una forma estándar de señalar un lugar dentro de un documento JSON. `#/nombre` es el miembro `nombre` del objeto raíz; `#/perfil/color` sería el miembro `color` dentro de `perfil`; `#/servicios/0` sería el primer elemento de la lista `servicios`. El `#` delante es la forma de escribir el puntero como fragmento de un URI (sección 6 del RFC 6901), la misma que usa el ejemplo del RFC 9457. Con eso, un formulario puede poner cada mensaje junto a su campo sin interpretar frases: el `pointer` dice cuál, el `detail` dice qué.

Compara con el `422` de la Lección 4: el mismo contenido, tres renglones `campo: explicación`. Ahí el cliente tenía que partir el texto por saltos de línea y por dos puntos, y un mensaje que llevara dos puntos lo rompía. Aquí cada pieza está en su miembro.

**Varios problemas de tipos distintos: se responde el más relevante.** Ahora un alta con un nombre que ya existe y una dirección prohibida:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}
```

`pagos` ya existe, así que este alta tiene dos problemas: `nombre-repetido` (`409`) y `destino-prohibido` (`422`). El `revisor` responde solo el segundo. El RFC dice que, cuando una API encuentra varios problemas que no comparten el tipo, **se recomienda** responder el más relevante o urgente (sección 3). Y explica por qué no se juntan: aunque se podría inventar un tipo «lote» que lleve problemas dispares, eso no encaja con HTTP. Tiene razón por el código: una respuesta tiene un solo código de estado, y un `409` y un `422` juntos no se pueden expresar con uno solo.

¿Cuál es el más relevante? El RFC no lo decide; lo decide tu API, y en el `revisor` lo decide el orden en que pregunta. Primero la puerta, con las siete preguntas de la Lección 2; después, dentro del alta, `validar` junta todas las fallas de datos; después `destinoPermitido` revisa la dirección; y al final se busca un nombre repetido. Una dirección prohibida es más urgente que un nombre repetido por una razón práctica: si el cliente solo cambiara el nombre, volvería a chocar con la dirección; si cambia la dirección, puede ser que el nombre deje de importarle. El ejercicio 2 te pide predecir otros tres empates.

### 5.11 El catálogo y el registro de la IANA

El `revisor` tiene veintidós tipos de problema, cada uno con su clave, su `type`, su `title` y su `status`. Están en un solo lugar, el catálogo de `problemas.ts` (sección 5.13), y esa es la mitad del valor del formato: en vez de veintiocho llamados con su propia frase repartidos por cinco archivos, una tabla que se puede leer, revisar y documentar de una sola vez. La Lección 8 la convierte en la descripción OpenAPI de la API.

El RFC 9457 pide que la definición de un tipo nuevo documente tres cosas: el URI del tipo, un `title` corto y el código con el que se usa (sección 4). Son las tres columnas del catálogo. Puede definir además extensiones y pedir `Retry-After`, que en el `revisor` son `existente`, `errors` y el `503` de mantenimiento.

Para los tipos que muchas APIs podrían compartir, el RFC 9457 creó un registro oficial en la IANA, «HTTP Problem Types» (sección 4.2). Su política es *Specification Required*: para inscribir un tipo hace falta una especificación publicada de forma estable y libre, aunque no tiene que ser un estándar. Y tiene una exclusión que importa aquí: los valores propios de un fabricante, de una aplicación o de una instalación **no** se pueden inscribir. Los tipos del `revisor` son de su aplicación, así que viven bajo su propio dominio y nunca irían al registro.

Al 21 de octubre de 2026, el registro tiene seis entradas (actualizado por última vez el 26 de junio de 2026):

| `type` | Nombre | Código recomendado | Definido en |
|---|---|---|---|
| `about:blank` | See HTTP Status Code | — | RFC 9457 |
| `…#date` | Date Not Acceptable | `400` | RFC 9458 |
| `…#ohttp-key` | Oblivious HTTP key configuration not acceptable | `400` | RFC 9458 |
| `…#digest-unsupported-algorithms` | Unsupported Hashing Algorithms | `400` | `draft-ietf-httpapi-digest-fields-problem-types`, ya aprobado y en espera de su número de RFC |
| `…#digest-invalid-values` | Invalid Digest Values | `400` | el mismo documento |
| `…#digest-mismatched-values` | Mismatched Digest Values | `400` | el mismo documento |

Los puntos suspensivos son `https://iana.org/assignments/http-problem-types`, el prefijo que el RFC permite usar a las inscripciones, y que advierte que puede no resolverse a una página (sección 4.2). Que el registro sea tan chico dice algo: casi todos los problemas son de una aplicación, y para los genéricos de verdad ya existe el código de estado con `about:blank`. Antes de inventar un tipo, mira el registro: si hay uno que sirve, reúsalo: para eso existe el registro («to promote reuse», sección 4.2), y es lo que sugiere el ejemplo de la sección 4.1.

### 5.12 Del RFC 7807 al RFC 9457

El formato tiene más historia que su número. Empezó como un borrador individual de Mark Nottingham, fechado el 4 de julio de 2012, *Indicating Details of Problems to Machines in HTTP*, con una advertencia poco común en la primera página: que no estaba claro si definir el formato mejoraría las cosas lo suficiente para compensar el daño que podía causar, y que usarlo antes de que fuera RFC «puede exponerte al ridículo». El riesgo que veía era el acoplamiento: que los clientes dependieran demasiado de los detalles de cada API. Lo publicó de todos modos porque, decía, mucha gente ya lo estaba haciendo a su manera.

Se publicó como **RFC 7807** en marzo de 2016, de Mark Nottingham y Erik Wilde, y durante siete años fue la referencia. En julio de 2023 lo reemplazó el **RFC 9457**, de los mismos dos autores y Sanjay Dalal, también estándar propuesto de la IETF, que declara obsoleto al 7807. Su apéndice D lista los cambios, y son tres:

1. **El registro de tipos** (sección 4.2): el 7807 no tenía un lugar común para los tipos compartidos; el 9457 creó el de la IANA y le inscribió `about:blank`.
2. **Qué hacer con varios problemas** (sección 3): la extensión con la lista para los del mismo tipo, y el más relevante para los de tipos distintos, con el ejemplo de `errors` y `pointer` que usa el `revisor`.
3. **Los `type` que no se pueden visitar** (sección 3.1.1): cuándo se vale un URI como `tag:` y por qué se prefieren los resolubles.

Lo que no cambió es casi todo: los cinco miembros, sus tipos, `application/problem+json` y `application/problem+xml`. Un problema escrito según el 7807 es válido según el 9457, y un cliente del 7807 lee sin cambios lo que manda el `revisor`. Quedan huellas del nombre viejo: el espacio de nombres del formato XML sigue siendo `urn:ietf:rfc:7807`, y el esquema JSON del apéndice A todavía se titula «An RFC 7807 problem object». Si ves una biblioteca que dice «RFC 7807», casi siempre produce lo mismo que esta lección; lo que le falta, si acaso, es el registro y la guía de varios problemas.

### 5.13 El manejador central: `problemas.ts`

Todo lo anterior cabe en un archivo nuevo de sesenta renglones:

```ts
// fig05_01/problemas.ts — el manejador central de errores: cada error sale como Problem Details (RFC 9457).
import type { ServerResponse } from "node:http";
import { escribirCabecera, type Cabeceras } from "./respuestas.ts";

const BASE = "https://revisor.example/problemas/";

type Tipo = { type: string; title: string; status: number };

// El catálogo del curso. El type es el identificador estable: no cambia de una ocurrencia a otra
// ni de un idioma a otro. El title es el nombre corto del tipo, y es lo que se traduce.
// Con about:blank, el title es la frase del código (RFC 9457, sección 4.2.1).
export const CATALOGO = {
  "ruta-inexistente": { type: "about:blank", title: "Not Found", status: 404 },
  "metodo-no-admitido": { type: "about:blank", title: "Method Not Allowed", status: 405 },
  "tipo-no-admitido": { type: "about:blank", title: "Unsupported Media Type", status: 415 },
  "cuerpo-demasiado-grande": { type: "about:blank", title: "Content Too Large", status: 413 },
  "cuerpo-ilegible": { type: BASE + "cuerpo-ilegible", title: "El cuerpo no se puede leer", status: 400 },
  "credencial-invalida": { type: BASE + "credencial-invalida", title: "Falta una credencial válida", status: 401 },
  "permiso-insuficiente": { type: BASE + "permiso-insuficiente", title: "La credencial no tiene permiso", status: 403 },
  "servicio-inexistente": { type: BASE + "servicio-inexistente", title: "El servicio no existe", status: 404 },
  "revision-inexistente": { type: BASE + "revision-inexistente", title: "La revisión no existe", status: 404 },
  "nombre-repetido": { type: BASE + "nombre-repetido", title: "Ya existe un servicio con ese nombre", status: 409 },
  "servicio-retirado": { type: BASE + "servicio-retirado", title: "El servicio se retiró", status: 410 },
  "version-retirada": { type: BASE + "version-retirada", title: "Esa versión de la API se retiró", status: 410 },
  "etiqueta-vencida": { type: BASE + "etiqueta-vencida", title: "Tu etiqueta ya no es la vigente", status: 412 },
  "destino-prohibido": { type: BASE + "destino-prohibido", title: "El revisor no se conecta a ese destino", status: 422 },
  "datos-invalidos": { type: BASE + "datos-invalidos", title: "Los datos no se pueden cumplir", status: 422 },
  "falta-condicion": { type: BASE + "falta-condicion", title: "Falta la condición If-Match", status: 428 },
  "demasiadas-revisiones": { type: BASE + "demasiadas-revisiones", title: "Demasiadas revisiones seguidas", status: 429 },
  "demasiadas-consultas": { type: BASE + "demasiadas-consultas", title: "Demasiadas consultas en vivo seguidas", status: 429 },
  "error-interno": { type: BASE + "error-interno", title: "Error interno del revisor", status: 500 },
  "respuesta-invalida": { type: BASE + "respuesta-invalida", title: "El servicio no dio una respuesta HTTP válida", status: 502 },
  "en-mantenimiento": { type: BASE + "en-mantenimiento", title: "El revisor está en mantenimiento", status: 503 },
  "servicio-lento": { type: BASE + "servicio-lento", title: "El servicio no respondió a tiempo", status: 504 },
} satisfies Record<string, Tipo>;

export type Clave = keyof typeof CATALOGO;

export type Opciones = {
  cabeceras?: Cabeceras;
  extensiones?: Record<string, unknown>;
  instance?: string;
};

// Los nombres de los cinco miembros estándar no se pueden usar como extensión.
const RESERVADOS = new Set(["type", "title", "status", "detail", "instance"]);

export function fallar(respuesta: ServerResponse, clave: Clave, detail: string, opciones: Opciones = {}): void {
  const { type, title, status } = CATALOGO[clave];
  const extensiones = opciones.extensiones ?? {};
  for (const nombre of Object.keys(extensiones)) {
    if (RESERVADOS.has(nombre)) throw new Error(`la extensión ${nombre} usa un nombre reservado`);
  }
  // instance: por omisión, la ruta que se pidió (sin la consulta).
  const instance = opciones.instance ?? new URL(respuesta.req.url ?? "/", "http://revisor").pathname;
  const cuerpo = JSON.stringify({ type, title, status, detail, instance, ...extensiones }) + "\n";
  escribirCabecera(respuesta, status, {
    ...opciones.cabeceras,
    "Content-Type": "application/problem+json",
    "Content-Language": "es",
    "Content-Length": String(Buffer.byteLength(cuerpo)),
  });
  respuesta.end(cuerpo);
}
```

Léelo en tres partes.

**El catálogo.** `CATALOGO` es un objeto cuyas claves son los nombres cortos de los problemas (`servicio-inexistente`, `datos-invalidos`…) y cuyos valores traen el `type`, el `title` y el `status`. Los cuatro primeros usan `about:blank` con la frase del registro; los demás, la base `https://revisor.example/problemas/` más la clave. `satisfies Record<string, Tipo>` le pide a TypeScript que compruebe que cada entrada tenga los tres campos con el tipo correcto, sin perder los nombres exactos de las claves. Por eso `Clave`, el tipo de la segunda línea después del catálogo, es la lista exacta de claves: si alguien llama `fallar(respuesta, "servicio-inexsitente", …)` con una letra cambiada, `tsc` lo marca antes de correr nada.

**`fallar`.** Recibe la respuesta, la clave del problema, el `detail` de esta ocurrencia y unas opciones: cabeceras, extensiones e `instance`. Saca del catálogo el `type`, el `title` y el `status`, así que quien llama **no puede** escribir un `status` distinto del código, ni un `title` distinto del del tipo. Rechaza las extensiones con nombre reservado (sección 5.9). Calcula `instance` como la ruta pedida sin la consulta, salvo que quien llama mande otra (el `500`). Arma el cuerpo con los cinco miembros primero y las extensiones después, y escribe la línea de estado con el mismo `status`, las cabeceras de quien llama, el tipo `application/problem+json`, `Content-Language: es` y el largo exacto en bytes. `Content-Length` se calcula con `Buffer.byteLength` y no con `.length` porque los acentos ocupan dos bytes en UTF-8: «revisión» tiene ocho letras y nueve bytes.

**Lo que no está.** `fallar` no decide nada del problema: no elige el código, no elige el tipo, no traduce. Solo convierte una decisión ya tomada (la clave) en una respuesta. Esa es la idea de un manejador central: **cada lugar del programa decide qué problema hubo, y un solo lugar decide cómo se dice.** Si mañana el `revisor` tuviera que negociar el idioma, o mandar `application/problem+xml`, se cambiaría este archivo y ninguno más.

`respuestas.ts` pierde su `fallar` de texto y exporta `escribirCabecera`, que ahora usa también `problemas.ts` para que la frase de la línea de estado sea la del registro:

```ts
// fig05_01/respuestas.ts — las respuestas de éxito del revisor y la lectura del cuerpo. Los errores, en problemas.ts.
import type { IncomingMessage, ServerResponse } from "node:http";

export type Cabeceras = Record<string, string>;

// Node trae los nombres viejos de estos dos códigos; aquí van los del registro de la IANA.
const FRASES: Partial<Record<number, string>> = { 413: "Content Too Large", 422: "Unprocessable Content" };

export function escribirCabecera(respuesta: ServerResponse, codigo: number, cabeceras: Cabeceras): void {
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

En los demás archivos, cada llamado cambia de código a clave, y lo que eran cabeceras pasa a la opción `cabeceras`. Por ejemplo, el `405` de `rutas.ts` (fragmento):

```ts
// Lección 4
fallar(respuesta, 405, `${peticion.method} no se admite en ${url.pathname}`, { Allow: permitidos(ruta) });
// Lección 5
fallar(respuesta, "metodo-no-admitido", `${peticion.method} no se admite en ${url.pathname}`, {
  cabeceras: { Allow: permitidos(ruta) },
});
```

Tres llamados cambian algo más que la forma, porque la información que una máquina necesita sale de la frase. El `409` mueve la ruta a la extensión `existente`; el `422` cambia los renglones por la lista `errors`; y el `500` mueve la referencia a `instance`. Los verás completos en la sección 5.14.

### 5.14 El `revisor` completo

#### 5.14.1 Los archivos que cambian

El `revisor` de esta lección vive en `~/curso-http/fig05_01/`. Si tienes la carpeta de la Lección 4, cópiala con ese nombre: además de `problemas.ts` y `respuestas.ts`, que ya viste completos, cambian cinco archivos. En todos, los llamados a `fallar` pasan de código a clave y el `import` de `fallar` viene ahora de `problemas.ts`.

`servidor.ts`: el `500` lleva la referencia en `instance`.

```ts
// fig05_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fallar } from "./problemas.ts";
import { atender } from "./rutas.ts";

const PUERTO = 18080;

// La pila para la bitácora: el mensaje y solo los marcos del propio curso. Los marcos internos de Node
// (`node:events`, `node:_http_server`…) y los de `node_modules` cambian con cada versión y no los puede corregir quien aprende.
function pilaDelCurso(error: unknown): string {
  if (!(error instanceof Error) || error.stack === undefined) return String(error);
  return error.stack
    .split("\n")
    .filter((linea) => !/^\s+at .*(node:|node_modules)/.test(linea))
    .join("\n");
}

// Lo inesperado: la pila va a la terminal de quien opera, con una referencia;
// a quien pidió solo le llega la referencia. Jamás la pila, el SQL, las rutas ni los secretos.
async function atenderSinFiltrar(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    const referencia = randomUUID();
    console.error(`error ${referencia} en ${peticion.method} ${peticion.url}: ${pilaDelCurso(error)}`);
    if (!respuesta.headersSent) {
      // instance identifica esta ocurrencia; con ella, quien opera encuentra la pila en su terminal.
      fallar(respuesta, "error-interno", "ocurrió un error inesperado; si se repite, reporta la referencia", {
        instance: `urn:uuid:${referencia}`,
      });
    } else {
      respuesta.destroy();
    }
  }
}

createServer((peticion, respuesta) => void atenderSinFiltrar(peticion, respuesta)).listen(PUERTO, "127.0.0.1", () => {
  console.log(`revisor en http://127.0.0.1:${PUERTO}`);
});
```

`rutas.ts`: la puerta, con `about:blank` para la ruta y el método, y los tipos propios de la credencial y el permiso.

```ts
// fig05_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { fallar } from "./problemas.ts";
import { enviarVacio } from "./respuestas.ts";
import { atajarPorMantenimiento, cambiarMantenimiento } from "./operacion.ts";
import {
  cambiar, consultar, consultarRevision, darDeAlta, informe, listar, pedirRevision, retirar, salud,
  type Contexto,
} from "./servicios.ts";
import { consultarV1, listarV1, versionRetirada } from "./versiones.ts";

type Manejador = (contexto: Contexto) => void | Promise<void>;
// Cada método dice qué función lo atiende y qué rol mínimo exige.
type Metodo = { manejador: Manejador; escribe: boolean };
type Ruta = { patron: RegExp; metodos: Record<string, Metodo> };

const lee = (manejador: Manejador): Metodo => ({ manejador, escribe: false });
const escribe = (manejador: Manejador): Metodo => ({ manejador, escribe: true });

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: lee(listar), POST: escribe(darDeAlta) } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: lee(consultar), PUT: escribe(cambiar), DELETE: escribe(retirar) } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: escribe(pedirRevision) } },
  { patron: /^\/servicios\/(\d+)\/salud$/, metodos: { GET: lee(salud) } },
  { patron: /^\/servicios\/(\d+)\/informe$/, metodos: { GET: lee(informe) } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: lee(consultarRevision) } },
  { patron: /^\/mantenimiento$/, metodos: { PUT: escribe(cambiarMantenimiento) } },
  // La versión anterior, desaprobada: solo lectura, con sus avisos.
  { patron: /^\/v1\/servicios$/, metodos: { GET: lee(listarV1) } },
  { patron: /^\/v1\/servicios\/(\d+)$/, metodos: { GET: lee(consultarV1) } },
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
  if (atajarPorMantenimiento(url.pathname, respuesta)) return;
  if (versionRetirada(url.pathname, respuesta)) return;

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
    fallar(respuesta, "ruta-inexistente", "no existe esa ruta");
    return;
  }

  // 2. ¿Admite este método?
  const nombreMetodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  // Object.hasOwn y no ruta.metodos[nombreMetodo] a secas: el método lo escribe el cliente, y un objeto
  // también «tiene» lo que hereda de Object.prototype (constructor, toString…). Igual que las credenciales.
  const metodo = Object.hasOwn(ruta.metodos, nombreMetodo) ? ruta.metodos[nombreMetodo] : undefined;
  if (metodo === undefined) {
    fallar(respuesta, "metodo-no-admitido", `${peticion.method} no se admite en ${url.pathname}`, {
      cabeceras: { Allow: permitidos(ruta) },
    });
    return;
  }

  // 3. ¿Quién eres?
  const identificacion = identificar(peticion);
  if (identificacion.tipo !== "valida") {
    const detalle = motivo(identificacion);
    fallar(respuesta, "credencial-invalida", detalle, { cabeceras: { "WWW-Authenticate": reto(identificacion) } });
    return;
  }

  // 4. ¿Puedes?
  if (!puede(identificacion.credencial, metodo)) {
    fallar(respuesta, "permiso-insuficiente", "tu credencial solo puede leer; para escribir pide una con rol de escritor");
    return;
  }

  // 5, 6 y 7. ¿Existe el recurso? ¿En qué formato viene? ¿Se puede leer? Lo decide cada manejador. Después, ¿se puede cumplir? (422)
  await metodo.manejador({ peticion, respuesta, parametros, credencial: identificacion.credencial });
}
```

`servicios.ts`: `rechazarDatos` arma la lista `errors`, y los dos `409` llevan `existente`.

```ts
// fig05_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarPorNombre, buscarRevision, buscarServicio, cambiarServicio, crearRevision, crearServicio,
  equipoDeRetirado, etiqueta, listarServicios, retirarServicio, terminarRevision,
  revisionesDe, type Revision, type Servicio,
} from "./almacen.ts";
import type { Credencial } from "./autenticacion.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, coincideFuerte, hayCoincidencia, interpretarLista } from "./etiquetas.ts";
import { consultar as consultarAhora, revisar } from "./cliente.ts";
import { permitir } from "./limitador.ts";
import { fallar } from "./problemas.ts";
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
  credencial: Credencial;
};

const ESPERA_EN_COLA_MS = 1000;
// Pedir una revisión hace salir al revisor a la red: se limita a 3 por credencial cada 60 segundos.
const REVISIONES_POR_VENTANA = 3;
const VENTANA_MS = 60_000;
const CONSULTAS_POR_VENTANA = 3;

export function representar(servicio: Servicio): object {
  return { id: servicio.id, nombre: servicio.nombre, url: servicio.url, limite_ms: servicio.limiteMs };
}

function representarRevision(revision: Revision): object {
  return { id: revision.id, servicio: revision.servicio, estado: revision.estado, resultado: revision.resultado };
}

function delEquipo(equipo: string, credencial: Credencial): boolean {
  return credencial.equipo === "*" || equipo === credencial.equipo;
}

// Busca un servicio que la credencial puede ver. Si no lo encuentra, ya respondió:
// 410 si existió y se retiró, 404 si nunca existió o es de otro equipo (el 404 esconde a propósito).
export function encontrar(id: string, credencial: Credencial, respuesta: ServerResponse): Servicio | undefined {
  const servicio = buscarServicio(Number(id));
  if (servicio !== undefined && delEquipo(servicio.equipo, credencial)) return servicio;
  const equipo = equipoDeRetirado(Number(id));
  if (servicio === undefined && equipo !== undefined && delEquipo(equipo, credencial)) {
    fallar(respuesta, "servicio-retirado", `el servicio ${id} se retiró y no va a volver`);
  } else {
    fallar(respuesta, "servicio-inexistente", `no existe el servicio ${id}`);
  }
  return undefined;
}

// 415 si el cuerpo no se declara application/json. Va aparte de leerJson porque el PUT lo pregunta
// antes que If-Match: el 415 se sabe sin procesar el contenido, y el RFC 9110 (sección 13.2.1) dice que
// las precondiciones no se evalúan si sin ellas la respuesta no habría sido 2xx ni 412.
function esJson(peticion: IncomingMessage, respuesta: ServerResponse): boolean {
  const tipo = (peticion.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    fallar(respuesta, "tipo-no-admitido", `el cuerpo debe ser application/json, no ${tipo === "" ? "(sin tipo)" : tipo}`, {
      cabeceras: { Accept: "application/json" },
    });
    return false;
  }
  return true;
}

// 415 si no es JSON, 400 si no se puede leer. Política del curso: 400 = no se puede leer.
export async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
  if (!esJson(peticion, respuesta)) return undefined;
  try {
    const datos: unknown = JSON.parse(await leerCuerpo(peticion));
    if (typeof datos === "object" && datos !== null && !Array.isArray(datos)) return datos as Record<string, unknown>;
  } catch (error) {
    // 413 (RFC 9110, sección 15.5.14): el cuerpo pasa del tope. «Connection: close» hace que Node cierre
    // la conexión al terminar de responder, en vez de seguir recibiendo lo que el cliente quería mandar.
    if (error instanceof CuerpoDemasiadoGrande) {
      fallar(respuesta, "cuerpo-demasiado-grande", `el cuerpo pasa de ${TOPE_CUERPO} bytes`, {
        cabeceras: { Connection: "close" },
      });
      return undefined;
    }
    // si no, cae al 400 de abajo
  }
  fallar(respuesta, "cuerpo-ilegible", "el cuerpo no es un objeto JSON");
  return undefined;
}

export type Falla = { campo: string; detalle: string };
type Validos = { nombre: string; url: string; limiteMs: number };

// Política del curso: 422 = se pudo leer, pero no se puede cumplir. Junta todas las fallas, no solo la primera.
function validar(datos: Record<string, unknown>): Validos | Falla[] {
  const fallas: Falla[] = [];
  const { nombre, url, limite_ms: limite } = datos;
  if (typeof nombre !== "string" || nombre.trim() === "" || nombre.length > 40) {
    fallas.push({ campo: "nombre", detalle: "debe ser un texto de 1 a 40 caracteres" });
  }
  let urlValida = false;
  if (typeof url === "string") {
    try {
      urlValida = ["http:", "https:"].includes(new URL(url).protocol);
    } catch {
      urlValida = false;
    }
  }
  if (!urlValida) fallas.push({ campo: "url", detalle: "debe ser una dirección http o https" });
  if (limite !== undefined && (typeof limite !== "number" || !Number.isInteger(limite) || limite < 100 || limite > 10000)) {
    fallas.push({ campo: "limite_ms", detalle: "debe ser un entero entre 100 y 10000" });
  }
  if (fallas.length > 0) return fallas;
  return { nombre: nombre as string, url: url as string, limiteMs: (limite as number | undefined) ?? 2000 };
}

export function rechazarDatos(respuesta: ServerResponse, fallas: Falla[]): void {
  // Varios problemas del mismo tipo en una respuesta: la extensión errors, como en el RFC 9457.
  fallar(respuesta, "datos-invalidos", `${fallas.length} dato(s) no se pueden cumplir`, {
    extensiones: { errors: fallas.map((f) => ({ detail: f.detalle, pointer: `#/${f.campo}` })) },
  });
}

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, "destino-prohibido", `destino prohibido: ${veredicto.motivo}`);
  return false;
}

export function listar({ respuesta, credencial }: Contexto): void {
  const propios = listarServicios().filter((s) => delEquipo(s.equipo, credencial));
  enviarJson(respuesta, 200, { servicios: propios.map(representar) });
}

export async function darDeAlta({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  const datos = await leerJson(peticion, respuesta);
  if (datos === undefined) return;
  const validos = validar(datos);
  if (Array.isArray(validos)) {
    rechazarDatos(respuesta, validos);
    return;
  }
  if (!(await destinoPermitido(validos.url, respuesta))) {
    return;
  }
  const existente = buscarPorNombre(credencial.equipo, validos.nombre);
  if (existente !== undefined) {
    fallar(respuesta, "nombre-repetido", `ya existe un servicio llamado ${validos.nombre}`, {
      extensiones: { existente: `/servicios/${existente.id}` },
    });
    return;
  }
  const servicio = crearServicio({ ...validos, equipo: credencial.equipo });
  enviarJson(respuesta, 201, representar(servicio), {
    Location: `/servicios/${servicio.id}`,
    ETag: etiqueta(servicio),
  });
}

export function consultar({ peticion, respuesta, parametros, credencial }: Contexto): void {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  const actual = etiqueta(servicio);
  // If-None-Match trae «*» o una lista, y se compara en débil (RFC 9110, secciones 13.1.2 y 8.8.3.2).
  const condicion = peticion.headers["if-none-match"];
  if (condicion !== undefined && hayCoincidencia(condicion, actual, coincideDebil)) {
    enviarVacio(respuesta, 304, { ETag: actual });
    return;
  }
  enviarJson(respuesta, 200, representar(servicio), { ETag: actual });
}

// PUT: cambiar sin pisar el cambio de otra persona. Exige If-Match con la etiqueta vigente.
export async function cambiar({ peticion, respuesta, parametros, credencial }: Contexto): Promise<void> {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // Primero el formato (415), después la condición (428 y 412), después la lectura (400).
  if (!esJson(peticion, respuesta)) return;
  const condicion = peticion.headers["if-match"];
  if (condicion === undefined) {
    fallar(respuesta, "falta-condicion", "para cambiar un servicio manda If-Match con su ETag");
    return;
  }
  // If-Match se compara en fuerte (RFC 9110, secciones 13.1.1 y 8.8.3.2): una etiqueta W/ nunca coincide.
  // El detail no repite la cabecera que mandó el cliente: dice qué pasó y qué hacer.
  if (!hayCoincidencia(condicion, etiqueta(servicio), coincideFuerte)) {
    // Si solo coincide en débil, no es que el servicio haya cambiado: la etiqueta W/ no sirve para escribir.
    const detalle = hayCoincidencia(condicion, etiqueta(servicio), coincideDebil)
      ? "If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó"
      : "tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo";
    fallar(respuesta, "etiqueta-vencida", detalle);
    return;
  }
  // La versión que coincidió. Entre aquí y la escritura hay dos await (leer el cuerpo y consultar el DNS),
  // y en ese hueco otra petición puede cambiar el servicio: cambiarServicio vuelve a comparar al escribir.
  const versionLeida = interpretarLista(condicion) === "*" ? null : servicio.version;
  const datos = await leerJson(peticion, respuesta);
  if (datos === undefined) return;
  const validos = validar(datos);
  if (Array.isArray(validos)) {
    rechazarDatos(respuesta, validos);
    return;
  }
  if (!(await destinoPermitido(validos.url, respuesta))) {
    return;
  }
  const homonimo = buscarPorNombre(servicio.equipo, validos.nombre);
  if (homonimo !== undefined && homonimo.id !== servicio.id) {
    fallar(respuesta, "nombre-repetido", `ya existe un servicio llamado ${validos.nombre}`, {
      extensiones: { existente: `/servicios/${homonimo.id}` },
    });
    return;
  }
  const cambiado = cambiarServicio(servicio.id, versionLeida, validos);
  if (cambiado === "conflicto") {
    fallar(respuesta, "etiqueta-vencida", "el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo");
    return;
  }
  if (cambiado === "retirado") {
    // Otra petición lo retiró mientras ésta esperaba: 410, como si hubiera llegado después del retiro.
    fallar(respuesta, "servicio-retirado", `el servicio ${servicio.id} se retiró y no va a volver`);
    return;
  }
  enviarJson(respuesta, 200, representar(cambiado), { ETag: etiqueta(cambiado) });
}

export function retirar({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  retirarServicio(servicio.id);
  enviarVacio(respuesta, 204);
}

export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  // El límite cuenta por credencial y se consulta ANTES de buscar el servicio: así también cuentan los
  // 404 de quien prueba ids uno tras otro (enumeración), y lo que gasta una credencial no lo paga otra.
  const decision = permitir(`revisiones:${credencial.nombre}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, "demasiadas-revisiones", `ya pediste ${REVISIONES_POR_VENTANA} revisiones en el último minuto`, {
      cabeceras: { "Retry-After": String(decision.esperaS) },
    });
    return;
  }
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}

export function consultarRevision({ respuesta, parametros, credencial }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  const servicio = revision === undefined ? undefined : buscarServicio(revision.servicio);
  const equipo = servicio?.equipo ?? (revision === undefined ? undefined : equipoDeRetirado(revision.servicio));
  if (revision === undefined || equipo === undefined || !delEquipo(equipo, credencial)) {
    fallar(respuesta, "revision-inexistente", `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}

// GET /servicios/{id}/salud: el revisor consulta el servicio en este momento y hace de pasarela.
// Si hubo respuesta HTTP, la informa con 200, sea cual sea su código. Si no la hubo, la culpa es de
// lo que está detrás: 504 si no contestó a tiempo, 502 si no contestó algo que sea HTTP.
export async function salud({ respuesta, parametros, credencial }: Contexto): Promise<void> {
  // La consulta en vivo también sale a la red, igual que una revisión: sin límite, el revisor serviría
  // para golpear un servicio ajeno a través de él. Cuenta por credencial, antes de buscar el servicio,
  // en una ventana aparte de la de las revisiones.
  const decision = permitir(`salud:${credencial.nombre}`, CONSULTAS_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, "demasiadas-consultas", `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      cabeceras: { "Retry-After": String(decision.esperaS) },
    });
    return;
  }
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  const consulta = await consultarAhora(servicio.url, servicio.limiteMs);
  switch (consulta.tipo) {
    case "respuesta":
      enviarJson(respuesta, 200, { servicio: servicio.id, codigo: consulta.codigo, ms: consulta.ms });
      return;
    case "tiempo-agotado":
      fallar(respuesta, "servicio-lento", `el servicio ${servicio.id} no respondió en ${servicio.limiteMs} ms`);
      return;
    case "sin-conexion":
      fallar(respuesta, "respuesta-invalida", `no se pudo conectar con el servicio ${servicio.id}`);
      return;
    case "destino-prohibido":
      fallar(respuesta, "destino-prohibido", `destino prohibido: ${consulta.motivo}`);
      return;
    case "respuesta-invalida":
      fallar(respuesta, "respuesta-invalida", `el servicio ${servicio.id} no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP`);
      return;
  }
}

// GET /servicios/{id}/informe: el resumen de sus revisiones.
// DEFECTO A PROPÓSITO (lección 4): no contempla un servicio sin revisiones terminadas, y revienta.
// Se deja así en el resto del curso para tener un 500 que provocar.
export function informe({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  const revisiones = revisionesDe(servicio.id);
  const ultima = revisiones[revisiones.length - 1] as Revision;
  enviarJson(respuesta, 200, {
    servicio: servicio.id,
    revisiones: revisiones.length,
    ultimo_estado: (ultima.resultado as NonNullable<Revision["resultado"]>).estado,
  });
}
```

`operacion.ts`: el `503` conserva su `Retry-After` como cabecera; el `403` de quien no es admin usa el mismo tipo que el de la puerta.

```ts
// fig05_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
import type { ServerResponse } from "node:http";
import { fallar } from "./problemas.ts";
import { enviarVacio } from "./respuestas.ts";
import { leerJson, rechazarDatos, type Contexto } from "./servicios.ts";

let enMantenimiento = false;
const VUELVE_EN_S = 120;

// Si está en mantenimiento, responde 503 y devuelve true. /mantenimiento siempre se atiende.
export function atajarPorMantenimiento(ruta: string, respuesta: ServerResponse): boolean {
  if (!enMantenimiento || ruta === "/mantenimiento") return false;
  fallar(respuesta, "en-mantenimiento", "el revisor está en mantenimiento", { cabeceras: { "Retry-After": String(VUELVE_EN_S) } });
  return true;
}

// PUT /mantenimiento con {"activo": true} o {"activo": false}. Solo la credencial admin.
export async function cambiarMantenimiento({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  if (credencial.rol !== "admin") {
    fallar(respuesta, "permiso-insuficiente", "solo quien opera el revisor puede cambiar el mantenimiento");
    return;
  }
  const datos = await leerJson(peticion, respuesta);
  if (datos === undefined) return;
  if (typeof datos.activo !== "boolean") {
    rechazarDatos(respuesta, [{ campo: "activo", detalle: "debe ser true o false" }]);
    return;
  }
  enMantenimiento = datos.activo;
  console.log(`operación: mantenimiento ${enMantenimiento ? "encendido" : "apagado"}`);
  enviarVacio(respuesta, 204);
}
```

`versiones.ts`: la versión retirada tiene su propio tipo, `version-retirada`, distinto de `servicio-retirado`, porque el cliente tiene que hacer cosas distintas: en uno, dejar de pedir ese servicio; en el otro, mudarse a otra versión de la API.

```ts
// fig05_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
import type { ServerResponse } from "node:http";
import { listarServicios, type Servicio } from "./almacen.ts";
import { fallar } from "./problemas.ts";
import { enviarJson, type Cabeceras } from "./respuestas.ts";
import { encontrar, type Contexto } from "./servicios.ts";

// Deprecation (RFC 9745): desde cuándo está desaprobada, como fecha de campo estructurado (@segundos).
// Sunset (RFC 8594): cuándo probablemente dejará de responder, como fecha HTTP. Nunca antes que Deprecation.
const AVISOS: Cabeceras = {
  Deprecation: "@1782864000", // 1 de julio de 2026, 00:00 UTC
  Sunset: "Sun, 31 Jan 2027 00:00:00 GMT",
  Link: '<https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"',
};

// La v1 hablaba de «direccion» y del límite en segundos.
function representarV1(servicio: Servicio): object {
  return { id: servicio.id, nombre: servicio.nombre, direccion: servicio.url, limite: servicio.limiteMs / 1000 };
}

export function listarV1({ respuesta, credencial }: Contexto): void {
  const propios = listarServicios().filter((s) => credencial.equipo === "*" || s.equipo === credencial.equipo);
  enviarJson(respuesta, 200, { servicios: propios.map(representarV1) }, AVISOS);
}

export function consultarV1({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  enviarJson(respuesta, 200, representarV1(servicio), AVISOS);
}

// La v0 se retiró: 410 para cualquier ruta suya, sin importar quién pregunte.
export function versionRetirada(ruta: string, respuesta: ServerResponse): boolean {
  if (ruta !== "/v0" && !ruta.startsWith("/v0/")) return false;
  fallar(respuesta, "version-retirada", "la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios");
  return true;
}
```

#### 5.14.2 Los archivos que no cambian

Los demás archivos son los de la Lección 4, sin un solo cambio. Van completos para que el `revisor` se pueda armar desde esta lección:

```ts
// fig05_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

// Los servicios retirados se recuerdan, con su equipo, para responder 410 y no 404.
const retirados = new Map<number, string>();

export function retirarServicio(id: number): boolean {
  const servicio = servicios.get(id);
  if (servicio === undefined) return false;
  servicios.delete(id);
  retirados.set(id, servicio.equipo);
  return true;
}

export function equipoDeRetirado(id: number): string | undefined {
  return retirados.get(id);
}

export function buscarPorNombre(equipo: string, nombre: string): Servicio | undefined {
  return [...servicios.values()].find((s) => s.equipo === equipo && s.nombre === nombre);
}

// Cambia los datos y sube la versión: la etiqueta vieja deja de valer.
// Compara la versión y escribe en un solo paso, sin ningún await de por medio: es el equivalente en
// memoria de «UPDATE servicios SET … WHERE id = ? AND version = ?». Quien llama dice qué versión leyó
// cuando revisó If-Match; si mientras tanto otra petición escribió o retiró el servicio, aquí ya no
// coincide y no se escribe nada: devuelve "conflicto" (412) o, si lo retiraron, "retirado" (410). Con
// If-Match: * se pasa null, porque «*» solo pide que el servicio exista.
export function cambiarServicio(
  id: number,
  versionLeida: number | null,
  datos: Omit<DatosServicio, "equipo">,
): Servicio | "conflicto" | "retirado" {
  const servicio = servicios.get(id);
  if (servicio === undefined) return "retirado";
  if (versionLeida !== null && servicio.version !== versionLeida) return "conflicto";
  Object.assign(servicio, datos, { version: servicio.version + 1 });
  return servicio;
}

export function crearRevision(servicio: number): Revision {
  const revision: Revision = { id: siguienteRevision++, servicio, estado: "pendiente", resultado: null };
  revisiones.set(revision.id, revision);
  return revision;
}

export function buscarRevision(id: number): Revision | undefined {
  return revisiones.get(id);
}

export function revisionesDe(servicio: number): Revision[] {
  return [...revisiones.values()].filter((r) => r.servicio === servicio);
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
// Desde la lección 4: uno lento, uno que no responde a tiempo y uno que no responde HTTP.
crearServicio({ nombre: "inventario", url: "http://127.0.0.1:18081/lento/1500", limiteMs: 2000, equipo: "a" });
crearServicio({ nombre: "reportes", url: "http://127.0.0.1:18081/lento/3000", limiteMs: 1000, equipo: "a" });
crearServicio({ nombre: "facturacion", url: "http://127.0.0.1:18081/basura", limiteMs: 2000, equipo: "a" });
```

```ts
// fig05_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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

```ts
// fig05_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
import type { Resultado } from "./almacen.ts";
import { revisarDestino } from "./destinos.ts";

// Lo que puede pasar al consultar: o hubo una respuesta HTTP, o no la hubo por una de tres razones.
export type Consulta =
  | { tipo: "respuesta"; codigo: number; ms: number; reintentarEn: number | null }
  | { tipo: "tiempo-agotado" }
  | { tipo: "sin-conexion" }
  | { tipo: "respuesta-invalida"; motivo: string }
  | { tipo: "destino-prohibido"; motivo: string };

// Retry-After trae segundos («120») o una fecha HTTP, y nada más (RFC 9110, sección 10.2.3):
// Retry-After = HTTP-date / delay-seconds, con delay-seconds = 1*DIGIT. Si no es ninguna de las dos,
// se ignora (null) y quien llama usa su espera por omisión. No se usa Date.parse: acepta «1.5», «-1»
// o «12 30» como fechas del pasado (esperar 0 s y reintentar de inmediato) y lee la forma asctime en
// la hora local de la máquina, cuando HTTP siempre habla en GMT.
export function segundosDeEspera(valor: string | null): number | null {
  if (valor === null) return null;
  if (/^\d+$/.test(valor)) return Number(valor);
  const fecha = fechaHttp(valor);
  return fecha === null ? null : Math.max(0, Math.ceil((fecha - Date.now()) / 1000));
}

const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MES = MESES.join("|");
// Las tres formas de HTTP-date (RFC 9110, sección 5.6.7). Quien recibe debe aceptar las tres.
const IMF_FIXDATE = new RegExp(`^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\\d{2}) (${MES}) (\\d{4}) (\\d{2}):(\\d{2}):(\\d{2}) GMT$`);
const RFC850 = new RegExp(
  `^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\\d{2})-(${MES})-(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2}) GMT$`,
);
const ASCTIME = new RegExp(`^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (${MES}) ( \\d|\\d{2}) (\\d{2}):(\\d{2}):(\\d{2}) (\\d{4})$`);

// Milisegundos desde 1970 de una HTTP-date, siempre en GMT (Date.UTC, nunca la hora local); null si no lo es.
function fechaHttp(texto: string): number | null {
  let partes: [string, string, number, string, string, string] | null = null;
  const imf = IMF_FIXDATE.exec(texto);
  const viejo = RFC850.exec(texto);
  const asc = ASCTIME.exec(texto);
  if (imf !== null) partes = [imf[1], imf[2], Number(imf[3]), imf[4], imf[5], imf[6]];
  else if (asc !== null) partes = [asc[2].trim(), asc[1], Number(asc[6]), asc[3], asc[4], asc[5]];
  else if (viejo !== null) {
    // Año de dos cifras: si queda más de 50 años en el futuro, es del siglo anterior (sección 5.6.7).
    const actual = new Date().getUTCFullYear();
    let anio = Math.floor(actual / 100) * 100 + Number(viejo[3]);
    if (anio > actual + 50) anio -= 100;
    partes = [viejo[1], viejo[2], anio, viejo[4], viejo[5], viejo[6]];
  }
  if (partes === null) return null;
  const [dia, mes, anio, horas, minutos, segundos] = partes;
  const m = MESES.indexOf(mes);
  const ms = Date.UTC(anio, m, Number(dia), Number(horas), Number(minutos), Number(segundos));
  // Date.UTC acepta el 32 de octubre o las 25:00 y los pasa al día siguiente: se rechazan.
  const comprobada = new Date(ms);
  const exacta = comprobada.getUTCDate() === Number(dia) && comprobada.getUTCMonth() === m
    && comprobada.getUTCHours() === Number(horas) && comprobada.getUTCMinutes() === Number(minutos)
    && comprobada.getUTCSeconds() === Number(segundos);
  return exacta ? ms : null;
}

export async function consultar(url: string, limiteMs: number): Promise<Consulta> {
  // Antes de CADA conexión se vuelve a revisar el destino: el DNS pudo cambiar desde el alta.
  const veredicto = await revisarDestino(url);
  if (!veredicto.permitido) return { tipo: "destino-prohibido", motivo: veredicto.motivo };
  const inicio = performance.now();
  try {
    const respuesta = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(limiteMs) });
    await respuesta.body?.cancel();
    return {
      tipo: "respuesta",
      codigo: respuesta.status,
      ms: Math.round(performance.now() - inicio),
      reintentarEn: segundosDeEspera(respuesta.headers.get("retry-after")),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") return { tipo: "tiempo-agotado" };
    const causa = (error as { cause?: { code?: string; message?: string } }).cause;
    if (causa?.code === "ECONNREFUSED" || causa?.code === "ENOTFOUND") return { tipo: "sin-conexion" };
    return { tipo: "respuesta-invalida", motivo: causa?.message ?? String(error) };
  }
}

export async function revisar(url: string, limiteMs: number): Promise<Resultado> {
  const consulta = await consultar(url, limiteMs);
  switch (consulta.tipo) {
    case "tiempo-agotado":
      return { estado: "CAIDO", codigo: null, ms: null, detalle: "tiempo agotado" };
    case "sin-conexion":
      return { estado: "CAIDO", codigo: null, ms: null, detalle: "sin conexión" };
    case "respuesta-invalida":
      return { estado: "CAIDO", codigo: null, ms: null, detalle: "respuesta inválida" };
    case "destino-prohibido":
      return { estado: "CAIDO", codigo: null, ms: null, detalle: `destino prohibido: ${consulta.motivo}` };
    case "respuesta": {
      const { codigo, ms, reintentarEn } = consulta;
      if (codigo >= 400) {
        const espera = reintentarEn === null ? "" : ` (reintentar en ${reintentarEn} s)`;
        return { estado: "CAIDO", codigo, ms, detalle: `${codigo}${espera}` };
      }
      return { estado: ms >= limiteMs / 2 ? "LENTO" : "ARRIBA", codigo, ms, detalle: String(codigo) };
    }
  }
}
```

```ts
// fig05_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig05_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig05_01/laboratorio.ts
// El banco de pruebas de la lección 0, en el puerto 18081, con tres rutas más para la lección 4:
// /lento/MS responde 200 después de MS milisegundos, /cortar cierra la conexión sin responder,
// y /basura responde algo que no es HTTP.
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
  if (nombre === undefined) {
    respuesta.writeHead(codigo, cabeceras);
  } else {
    respuesta.writeHead(codigo, nombre, cabeceras);
  }
  respuesta.end(cuerpo);
}

function atender(peticion: IncomingMessage, respuesta: ServerResponse): void {
  console.log(`${peticion.method} ${peticion.url}`);
  const lento = /^\/lento\/(\d{1,5})$/.exec(peticion.url ?? "");
  if (lento !== null) {
    setTimeout(() => enviar(respuesta, 200, `tardé ${lento[1]} ms`), Number(lento[1]));
    return;
  }
  if (peticion.url === "/cortar") {
    peticion.socket.destroy();
    return;
  }
  if (peticion.url === "/basura") {
    peticion.socket.end("esto no es una respuesta HTTP\r\n\r\n");
    return;
  }
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
// fig05_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
// Ventana fija: sencillo de leer; las ventanas deslizantes reparten mejor, pero enseñan lo mismo.

type Ventana = { inicio: number; usos: number };
const ventanas = new Map<string, Ventana>();

export type Decision = { permitido: true } | { permitido: false; esperaS: number };

export function permitir(clave: string, maximo: number, ventanaMs: number): Decision {
  const ahora = Date.now();
  const ventana = ventanas.get(clave);
  if (ventana === undefined || ahora - ventana.inicio >= ventanaMs) {
    ventanas.set(clave, { inicio: ahora, usos: 1 });
    return { permitido: true };
  }
  if (ventana.usos < maximo) {
    ventana.usos++;
    return { permitido: true };
  }
  return { permitido: false, esperaS: Math.ceil((ventana.inicio + ventanaMs - ahora) / 1000) };
}
```

```json fig05_01/package.json
{
  "type": "module"
}
```

#### 5.14.3 La corrida completa

Abre dos terminales en `~/curso-http/fig05_01/`. En la primera, el laboratorio; en la segunda, el `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

En una tercera, estas son las peticiones de la lección, en orden. Las de las secciones anteriores están aquí otra vez, juntas, y después de ellas vienen las del 401, el 503 de mantenimiento, un éxito, los dos rechazos de SSRF y un cuerpo demasiado grande:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 172
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/credencial-invalida","title":"Falta una credencial válida","status":401,"detail":"falta la credencial","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 219
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado pagos","instance":"/servicios","existente":"/servicios/2"}

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer escritura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:d80e7ef5-6cf9-4099-83a4-53c6d6116787"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 407
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"3 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"},{"detail":"debe ser un entero entre 100 y 10000","pointer":"#/limite_ms"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: application/problem+json
Content-Language: es
Content-Length: 188
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/en-mantenimiento","title":"El revisor está en mantenimiento","status":503,"detail":"el revisor está en mantenimiento","instance":"/servicios"}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
ETag: "1-1-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 235
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: localhost resuelve a una dirección privada o reservada","instance":"/servicios"}

$ printf '{"nombre":"%017000d"}' 0 | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: application/problem+json
Content-Language: es
Content-Length: 129
Date: Wed, 21 Oct 2026 23:42:15 GMT

{"type":"about:blank","title":"Content Too Large","status":413,"detail":"el cuerpo pasa de 16384 bytes","instance":"/servicios"}
```

Fíjate en cinco cosas. El `401` conserva su `WWW-Authenticate` y el `503` su `Retry-After`: las cabeceras que cada código exige no se movieron al cuerpo. El `413` del final, un alta con un nombre de 17,000 caracteres, es `about:blank` con la frase del registro, y lleva `Connection: close`: el `revisor` deja de leer en cuanto el cuerpo pasa de 16 KiB y cierra la conexión al responder, para no seguir recibiendo lo que el cliente quería mandar. Los `204` siguen sin cuerpo. El éxito, `GET /servicios/1`, sigue siendo `application/json`, sin `Content-Language`: el formato es solo para los errores. Y los dos rechazos de SSRF de la Lección 1 tienen ahora su tipo, `destino-prohibido`, con el mismo `detail` de siempre, que no enumera las direcciones a las que resuelve un nombre.

#### 5.14.4 Lo demás sigue funcionando

Las peticiones condicionales, el esquema de la credencial, el método con nombre de `Object.prototype`, el cuerpo que no es un objeto, los rangos de SSRF y la etiqueta tras reiniciar no cambiaron de comportamiento: solo de cuerpo, cuando son errores. Esta es la misma corrida, a continuación. Trae también el caso de la actualización perdida con dos `PUT` a la vez que vio la Lección 3: uno lento, que manda su cuerpo un segundo después (`curl -T -` lo envía por partes), y uno rápido con la misma etiqueta. Entre la penúltima y la última petición se reinició el `revisor`:

```text
$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'); echo "ETAG=$ETAG"
ETAG="1-1-f5a91511"

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: W/$ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: \"9-9\", $ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: *'
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: "9-9", W/"8-8"'
HTTP/1.1 200 OK
ETag: "1-1-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json
Content-Language: es
Content-Length: 263
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-3-f5a91511"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo","instance":"/servicios/1"}
lenta: 412

$ curl http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}

$ curl -o /dev/null -w 'text/plain con etiqueta vieja: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -H 'If-Match: "1-0-0"' -d 'catalogo'
text/plain con etiqueta vieja: 415

$ curl -o /dev/null -w 'text/plain sin If-Match: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
text/plain sin If-Match: 415

$ ID=$(curl -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/7 ETAG="7-1-f5a91511"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}' ) | curl -w ' <- PUT lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
{"type":"https://revisor.example/problemas/servicio-retirado","title":"El servicio se retiró","status":410,"detail":"el servicio 7 se retiró y no va a volver","instance":"/servicios/7"}
 <- PUT lento: 410

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 454
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000}]}

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Basic bGVjdHVyYS1hOg=='
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 185
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/credencial-invalida","title":"Falta una credencial válida","status":401,"detail":"solo se admite el esquema Bearer","instance":"/servicios"}

$ curl -i -X constructor http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 400 Bad Request
Connection: close

$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: application/problem+json
Content-Language: es
Content-Length: 129
Date: Wed, 21 Oct 2026 23:42:15 GMT

{"type":"about:blank","title":"Content Too Large","status":413,"detail":"el cuerpo pasa de 16384 bytes","instance":"/servicios"}

$ head -c 20000 /dev/zero | tr '\0' 'a' | curl -o /dev/null -w 'por partes: %{http_code}\n' -X POST -T - http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json'
por partes: 413

$ head -c 16384 /dev/zero | tr '\0' 'a' | curl -o /dev/null -w 'en el tope: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
en el tope: 400

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/cuerpo-ilegible","title":"El cuerpo no se puede leer","status":400,"detail":"el cuerpo no es un objeto JSON","instance":"/servicios"}

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
200

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-1","url":"http://100.100.100.200/latest/meta-data/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 100.100.100.200:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-2","url":"http://[64:ff9b::a9fe:a9fe]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [64:ff9b::a9fe:a9fe]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-3","url":"http://224.0.0.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 224.0.0.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-4","url":"http://[ff02::1]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [ff02::1]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-5","url":"http://[2002:a9fe:a9fe::]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [2002:a9fe:a9fe::]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-6","url":"http://[::7f00:1]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [::7f00:1]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-7","url":"http://[64:ff9b:1::a9fe:a9fe]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [64:ff9b:1::a9fe:a9fe]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-8","url":"http://240.0.0.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 240.0.0.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-9","url":"http://198.18.0.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 198.18.0.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-10","url":"http://192.0.2.1/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 192.0.2.1:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-11","url":"http://[2001:db8::1]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [2001:db8::1]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"rango-12","url":"http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/"}'
{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: [2001:0:4136:e378:8000:63bf:3fff:fdd2]:80: dirección privada o reservada","instance":"/servicios"}
 [422]

$ for i in 1 2 3 4; do curl -o /dev/null -w '%{http_code} %header{retry-after}\n' http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'; done
200 
200 
200 
429 60

$ for i in 1 2 3 4 5 6; do curl -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$i/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 

$ ID=$(curl -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"cortado","url":"http://127.0.0.1:18081/cortar"}'); echo "ID=$ID"
ID=/servicios/8

$ curl -i http://127.0.0.1:18080$ID/salud -H 'Authorization: Bearer admin'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Language: es
Content-Length: 278
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/respuesta-invalida","title":"El servicio no dio una respuesta HTTP válida","status":502,"detail":"el servicio 8 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP","instance":"/servicios/8/salud"}

$ TZ=America/Mexico_City node --input-type=module -e 'import { segundosDeEspera } from "./cliente.ts"; for (const v of ["120", "1.5", "-1", "12 30"]) console.log(JSON.stringify(v), "->", segundosDeEspera(v)); const imf = segundosDeEspera("Fri, 01 Jan 2100 00:00:00 GMT"), asc = segundosDeEspera("Fri Jan  1 00:00:00 2100"); console.log("asctime menos IMF-fixdate (misma fecha):", asc - imf, "s")'
"120" -> 120
"1.5" -> null
"-1" -> null
"12 30" -> null
asctime menos IMF-fixdate (misma fecha): 0 s

$ ANTES=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'); echo "ANTES=$ANTES"
ANTES="3-1-f5a91511"

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b' -H "If-None-Match: $ANTES"
HTTP/1.1 200 OK
ETag: "3-1-b32db61c"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Los dos `412` —el de la etiqueta débil y el de la petición lenta, que perdió la carrera— traen el mismo `type` y el mismo `title`, «Tu etiqueta ya no es la vigente», y solo su `detail` cuenta qué pasó en cada caso; el cambio que quedó es el de la rápida, `"limite_ms":3000`. El `401` del esquema `Basic` ya trae su tipo; el `400` de `null` es `cuerpo-ilegible`; los doce rangos dan `destino-prohibido` con `[422]`. El `400` de `-X constructor` sigue sin cuerpo porque no lo responde el `revisor` sino Node, antes de llamarlo, como explicó la Lección 2. El cambio con `text/plain` da `415` aunque traiga una etiqueta vieja o ninguna: el formato se pregunta antes que la condición, porque el RFC 9110 dice que las precondiciones no se evalúan si sin ellas la respuesta no habría sido `2xx` ni `412` (sección 13.2.1). Un `PUT` lento a un servicio que otra petición retira mientras tanto da `410` `servicio-retirado`, como si hubiera llegado después del retiro. Los cuerpos de 20,000 bytes dan `413`, con `Content-Length` o por partes, y uno de 16,384 exactos sí se lee (y da `400`, porque no es JSON). La consulta en vivo tiene su propio límite, `demasiadas-consultas`, con `Retry-After: 60`, aparte del de las revisiones. El `502` de un servicio que corta la conexión dice ahora en su `title` lo que de verdad pasó: «El servicio no dio una respuesta HTTP válida», cierto tanto si cortó como si respondió algo que no es HTTP. Y la etiqueta vieja, tras reiniciar, da `200` y no un `304` falso.

La terminal del `revisor`, al final de toda la corrida, con las dos referencias de error interno (la de la sección 5.8 y la del programa de 5.15):

```text
revisor en http://127.0.0.1:18080
GET /servicios/99
GET /servicios/3
GET /servicioss
PATCH /servicios/1
GET /servicios
POST /servicios
GET /servicios/1/informe
error d80e7ef5-6cf9-4099-83a4-53c6d6116787 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
POST /servicios
POST /servicios
PUT /mantenimiento
operación: mantenimiento encendido
GET /servicios
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios/1
POST /servicios
POST /servicios
POST /servicios
GET /servicios/99
GET /servicios/3
GET /revisiones/99
GET /servicioss
PATCH /servicios/1
GET /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
PUT /servicios/1
GET /v0/servicios
GET /servicios/1/informe
error 260fe541-4a99-4e15-a886-6907979f5e48 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
POST /servicios
GET /servicios/7
PUT /servicios/7
DELETE /servicios/7
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
GET /servicios/1/salud
GET /servicios/1/salud
GET /servicios/1/salud
GET /servicios/1/salud
POST /servicios/1/revisiones
POST /servicios/2/revisiones
POST /servicios/3/revisiones
POST /servicios/4/revisiones
POST /servicios/5/revisiones
POST /servicios/6/revisiones
POST /servicios
GET /servicios/8/salud
GET /servicios/3
revisor en http://127.0.0.1:18080
GET /servicios/3
```

### 5.15 Comprobarlo con un programa

Mirar trece respuestas a ojo para ver si cumplen el formato es aburrido y se equivoca. Este programa lo hace por ti: pide trece errores distintos al `revisor` y revisa en cada uno lo que dicen las secciones anteriores.

```ts
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
```

Por cada caso comprueba seis cosas: que el tipo de contenido sea `application/problem+json`; que el cuerpo sea un objeto JSON; que estén los cinco miembros; que `status` sea igual al código de la línea de estado; que `type` sea `about:blank` o un URI absoluto (`URL.canParse` dice si un texto se puede leer como dirección completa); y que, con `about:blank`, el `title` sea la frase del código. Además lleva la cuenta de lo que vio para cada `type`: si el mismo `type` aparece dos veces con distinto `title` o distinto `status`, lo marca. Termina con 0 si todo está bien y con 1 si algo falla, para que pueda usarse en una comprobación automática.

Con el `revisor` corriendo, en otra terminal (el programa va en la carpeta de arriba, `~/curso-http/`):

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
ok    GET /servicios/3 (servicio de otro equipo)
ok    GET /revisiones/99 (revisión que no existe)
ok    GET /servicioss (ruta que no existe)
ok    PATCH /servicios/1 (método que la ruta no admite)
ok    GET /servicios (sin credencial)
ok    POST /servicios (cuerpo en texto)
ok    POST /servicios (cuerpo de más de 16 KiB)
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

13 de 13 respuestas son Problem Details bien formados
```

Trece de trece. Este programa es la semilla de la matriz de la Lección 8, que hace lo mismo con los 23 códigos del curso y comprueba también las cabeceras.

### 5.16 Revisar los tipos con `tsc` (opcional)

Desde la carpeta del `revisor`, con el comando de la sección 0.9 de la Lección 0 más `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

No imprime nada: no hay errores. `fig05_02.ts` pasa el mismo comando junto con los archivos del `revisor`, y también las dos versiones rotas de la sección siguiente y la solución del ejercicio 4. Si cambias una letra de una clave en un llamado a `fallar`, `tsc` lo marca: es la ventaja de que `Clave` sea la lista exacta de claves del catálogo.

## El error que vas a ver

### El `title` que cuenta la ocurrencia

El error más común con este formato es usar `title` como si fuera `detail`: poner en el título el mensaje de esta ocurrencia. Se lee muy natural, porque muchas bibliotecas llaman «mensaje» o «título» a lo mismo. Para provocarlo, copia `fig05_01/` como `rota/` y cambia en `rota/problemas.ts` el principio de `fallar` por esto (es un fragmento; la versión completa está en `defectos/title-por-ocurrencia/problemas.ts`):

```ts
  // DEFECTO A PROPÓSITO (lección 5): el title lleva el mensaje de esta ocurrencia, como el detail.
  const { type, status } = CATALOGO[clave];
  const title = detail;
```

Arranca el laboratorio y el `revisor` desde `rota/` y pide los dos servicios de la sección 5.4:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"no existe el servicio 99","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"no existe el servicio 3","status":404,"detail":"no existe el servicio 3","instance":"/servicios/3"}
```

Cada respuesta, sola, parece bien: los cinco miembros están, el `type` es el de siempre, el código es correcto. El problema aparece al compararlas: el mismo `type` trae dos `title` distintos, y el RFC dice que el `title` no debería cambiar entre ocurrencias. Un cliente que agrupe sus errores por `title` en un tablero vería un renglón por cada servicio que no encontró, en vez de uno solo. Y el `title` ya no sirve para lo que existe: decirle a quien lee una bitácora qué *tipo* de problema es. El programa de 5.15 lo encuentra:

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
FALLA GET /servicios/3 (servicio de otro equipo)
      https://revisor.example/problemas/servicio-inexistente cambió de title o de status entre ocurrencias
ok    GET /revisiones/99 (revisión que no existe)
FALLA GET /servicioss (ruta que no existe)
      title "no existe esa ruta" con about:blank; se esperaba Not Found
FALLA PATCH /servicios/1 (método que la ruta no admite)
      title "PATCH no se admite en /servicios/1" con about:blank; se esperaba Method Not Allowed
ok    GET /servicios (sin credencial)
FALLA POST /servicios (cuerpo en texto)
      title "el cuerpo debe ser application/json, no text/plain" con about:blank; se esperaba Unsupported Media Type
FALLA POST /servicios (cuerpo de más de 16 KiB)
      title "el cuerpo pasa de 16384 bytes" con about:blank; se esperaba Content Too Large
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

8 de 13 respuestas son Problem Details bien formados
```

Cinco fallas, de dos clases. La primera es la del `title` que cambió entre el servicio 99 y el 3. Las otras cuatro son los `about:blank`, cuyo `title` ya no es la frase del código. Y mira lo que **no** encontró: ocho casos pasaron, aunque todos tienen el mismo defecto. El programa solo puede ver que un `title` cambia cuando el mismo `type` aparece dos veces, y en su lista solo `servicio-inexistente` se repite. **Una comprobación solo ve lo que compara.** El arreglo es volver al catálogo: el `title` es del tipo y lo escribe quien diseña el tipo, una vez. Detén los programas de `rota/` cuando termines.

### El problema que dice ser JSON

El segundo error es más pequeño y más dañino. Copia otra vez `fig05_01/` como `rota2/` y cambia en `rota2/problemas.ts` el tipo de contenido (la versión completa está en `defectos/json-a-secas/problemas.ts`):

```ts
    // DEFECTO A PROPÓSITO (lección 5): el cuerpo es un Problem Details, pero el tipo dice JSON a secas.
    "Content-Type": "application/json",
```

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}
```

El cuerpo es idéntico, byte por byte, al de la sección 5.1. Solo cambió un renglón de las cabeceras. Pero un cliente genérico que decide «¿esto es un problema?» mirando el tipo de contenido —que es lo que la sección 5.2 dijo que el tipo propio permite— ahora no lo reconoce: para él es un documento JSON cualquiera, quizá la representación de un recurso. El programa lo rechaza en todos los casos:

```text
$ node fig05_02.ts
FALLA GET /servicios/99 (servicio que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios/3 (servicio de otro equipo)
      tipo application/json, se esperaba application/problem+json
FALLA GET /revisiones/99 (revisión que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicioss (ruta que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA PATCH /servicios/1 (método que la ruta no admite)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios (sin credencial)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (cuerpo en texto)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (cuerpo de más de 16 KiB)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (datos imposibles)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (nombre repetido)
      tipo application/json, se esperaba application/problem+json
FALLA PUT /servicios/1 (cambio sin If-Match)
      tipo application/json, se esperaba application/problem+json
FALLA GET /v0/servicios (versión retirada)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios/1/informe (error interno)
      tipo application/json, se esperaba application/problem+json

0 de 13 respuestas son Problem Details bien formados
```

Cero de trece, por un renglón. Es un defecto común, porque muchos marcos de trabajo ponen `application/json` a todo lo que serializan. El arreglo es el de `fig05_01/`: el tipo lo escribe `fallar`, en un solo lugar, para todos los errores. Detén los programas de `rota2/` cuando termines.

## Lo que se hace mal

**Decidir con `detail` o con `title`.** Es lo que hacían los dos guiones de la escena. Las frases se corrigen, se acortan y se traducen, y cada cambio rompe al cliente sin que el código ni el `type` hayan cambiado. El RFC le pide al cliente no interpretar `detail`, y le da el `type` para decidir.

**Meter en una frase lo que una máquina necesita.** Un id, una ruta, una cantidad, un campo: si un cliente puede necesitarlo, va en una extensión con nombre propio. La frase es para personas.

**Un `type` por ocurrencia.** `…/servicio-inexistente/99`, o un `type` con la fecha. Un `type` es el nombre de una clase de problemas; si cambia en cada ocurrencia, el cliente no puede compararlo con nada. Lo que cambia en cada ocurrencia va en `detail` e `instance`.

**Cambiar un `type` publicado.** Aunque la palabra esté mal escrita, o ya no te guste. Cambiarlo es cambiar la API: todos los clientes que decidían con él dejan de reconocer el problema. Si de verdad hace falta, se trata como cualquier cambio de versión, con aviso.

**Un `status` distinto del código, o como texto.** Distinto, contradice la línea de estado, y casi todo el camino le va a creer a la línea. Como texto, `"404"`, un cliente que siga el RFC lo ignora como si no estuviera. En el `revisor` las dos cosas son imposibles porque el `status` sale del catálogo.

**`application/json` en los errores.** El cuerpo puede estar perfecto, y el cliente genérico no sabe que es un problema. Es la sección «El error que vas a ver».

**Usar el formato para depurar.** Pilas, consultas SQL, nombres de clases, rutas de la máquina en el `detail` o en una extensión. El RFC lo dice en la sección 4: los Problem Details no son una herramienta de depuración de la implementación, sino una forma de explicar mejor la interfaz HTTP. Para depurar está la referencia en `instance` y la bitácora de quien opera.

**Un tipo propio para lo que el código ya dice.** Un `type` «método no permitido» o «no autorizado» no agrega nada a un `405` o a un `401` con sus cabeceras. Para eso está `about:blank`.

**Juntar problemas de tipos distintos en un «lote».** Una respuesta tiene un código, y un `409` con un `422` adentro no tiene código que los represente. Se responde el más relevante; el cliente corrige y vuelve a intentar.

## Ejercicios

Los cuatro se corrigen solos: cada uno termina con una corrida que te dice si acertaste. Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada. Para los tres primeros necesitas el laboratorio y el `revisor` de 5.14 recién arrancados.

### Ejercicio 1 — ¿Qué problema es?

Sin correr nada, predice el código, el `type` y el `title` de estas seis respuestas, y si alguna trae una extensión:

```bash
curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer escritura-a'
curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i http://127.0.0.1:18080/v0/servicios
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
```

Pista: las claves del catálogo de `problemas.ts` son el mapa. Después córrelas y compara.

### Ejercicio 2 — Dos problemas a la vez

Cada una de estas tres peticiones tiene dos problemas de tipos distintos. Predice cuál de los dos responde el `revisor`, y por qué ese:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"ftp://pagos"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"http://169.254.169.254/"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a' -H 'Content-Type: text/plain' -d 'pagos'
```

La primera repite un nombre y trae una dirección `ftp`; la segunda trae un nombre vacío y una dirección prohibida; la tercera viene de un lector y en texto. Corre las tres.

### Ejercicio 3 — Lo que pide el cliente

Predice qué responde el `revisor` a estas tres peticiones. La primera pide HTML y dice preferir inglés; la segunda pide inglés para una ruta que no existe; la tercera usa `-I`, que manda un `HEAD`:

```bash
curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a' -H 'Accept: text/html' -H 'Accept-Language: en'
curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a' -H 'Accept-Language: en'
curl -I http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
```

¿Responde `406`? ¿Cambia el idioma de algo? ¿Qué trae el `HEAD`? Corre las tres y explica cada respuesta con la sección del RFC que la permite.

### Ejercicio 4 — La forma de una extensión

Copia `fig05_01/` como `ejercicio4/` y agrega a `fallar`, en `ejercicio4/problemas.ts`, una comprobación de la regla de nombres de la sección 5.9: un nombre de extensión empieza con una letra, usa solo letras, dígitos y `_`, y tiene tres caracteres o más. Si no la cumple, `fallar` lanza un error, como ya hace con los nombres reservados.

Para saber si acertaste, haz tres cosas. Primero, arranca el laboratorio y el `revisor` desde `ejercicio4/` y corre `node fig05_02.ts`: tiene que dar trece de trece, porque `existente` y `errors` cumplen la regla. Después, cambia en `ejercicio4/servicios.ts` la extensión `existente: ` del alta por `ex: `, reinicia el `revisor` e intenta dar de alta `pagos` otra vez. Predice qué código responde y qué aparece en la terminal. Por último, cambia `ex: ` por `status: `, reinicia y repite el alta: predice qué responde y qué dice la terminal.

## Soluciones

### Solución 1

```text
$ curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/revision-inexistente","title":"La revisión no existe","status":404,"detail":"no existe la revisión 99","instance":"/revisiones/99"}

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json
Content-Language: es
Content-Length: 231
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/permiso-insuficiente","title":"La credencial no tiene permiso","status":403,"detail":"tu credencial solo puede leer; para escribir pide una con rol de escritor","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 428 Precondition Required
Content-Type: application/problem+json
Content-Language: es
Content-Length: 202
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/falta-condicion","title":"Falta la condición If-Match","status":428,"detail":"para cambiar un servicio manda If-Match con su ETag","instance":"/servicios/1"}

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: application/problem+json
Content-Language: es
Content-Length: 231
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/version-retirada","title":"Esa versión de la API se retiró","status":410,"detail":"la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios","instance":"/v0/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 333
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"2 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}

$ curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: application/problem+json
Content-Language: es
Content-Length: 200
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-lento","title":"El servicio no respondió a tiempo","status":504,"detail":"el servicio 5 no respondió en 1000 ms","instance":"/servicios/5/salud"}
```

Las seis son tipos propios del `revisor`, y cada una dice su clave en el `type`. La revisión que no existe tiene su tipo, `revision-inexistente`, distinto del del servicio: el cliente busca cosas distintas. El lector que intenta borrar recibe `permiso-insuficiente`, sin extensiones, y fíjate en lo que **no** dice su `detail`: «tu credencial solo puede leer», sin repetir cuál. En el `revisor` de práctica, el nombre de la credencial es el mismo texto que el *token* que viaja en `Authorization`, y repetirlo en el cuerpo dejaría el secreto copiado en cualquier bitácora del cliente o de un intermediario: es lo que la sección 5 del RFC pide revisar en cada `detail`. El cambio sin `If-Match` es `falta-condicion` (`428`), y el `revisor` ni siquiera leyó el cuerpo: después de ver que se declara JSON, la condición se pregunta antes de leerlo. La versión retirada no pide credencial y responde `version-retirada` (`410`). El alta vacía es `datos-invalidos` con la extensión `errors` y **dos** fallas, no tres: `limite_ms` no vino, y su valor por omisión es válido. Y la salud del servicio 5 es `servicio-lento` (`504`), que tardó un segundo en llegar porque el `revisor` esperó el límite del servicio antes de rendirse.

### Solución 2

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"ftp://pagos"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 260
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"http://169.254.169.254/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 265
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a' -H 'Content-Type: text/plain' -d 'pagos'
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json
Content-Language: es
Content-Length: 229
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/permiso-insuficiente","title":"La credencial no tiene permiso","status":403,"detail":"tu credencial solo puede leer; para escribir pide una con rol de escritor","instance":"/servicios"}
```

Ninguna responde el `409` ni el `422` de destino que quizá esperabas. La primera da `datos-invalidos` con una sola falla, la de `url`: `validar` corre antes que la búsqueda del nombre repetido, y con una dirección `ftp` el alta ni siquiera llega a preguntar por el nombre. La segunda también da `datos-invalidos`, con la falla de `nombre`: `validar` corre antes que la revisión del destino, y como la dirección `http://169.254.169.254/` es una dirección `http` válida, `validar` no la marca; la revisaría `destinoPermitido`, que no llega a correr. La tercera da `403` y no `415`: el permiso es la cuarta pregunta de la puerta, y el formato es de las del manejador. En los tres casos, el más relevante es el que el `revisor` encuentra primero, y lo que encuentra primero lo decide el orden en que pregunta. Por eso ese orden se diseña y se documenta.

### Solución 3

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a' -H 'Accept: text/html' -H 'Accept-Language: en'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a' -H 'Accept-Language: en'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 111
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Not Found","status":404,"detail":"no existe esa ruta","instance":"/servicioss"}

$ curl -I http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Ninguna es `406`, y nada cambia de idioma. El `revisor` no negocia el contenido de sus errores: ignora `Accept` y `Accept-Language`, y manda `application/problem+json` en español. El RFC 9110 lo permite: si ninguna representación es aceptable según una cabecera de negociación, el servidor puede responder `406` o tratar la respuesta como si no hubiera negociación (sección 12.4.1); y el RFC 9457 manda su segundo ejemplo como `application/problem+json` a un cliente que solo pidió `application/json` (sección 3). Para un error, es lo mejor: el cliente recibe la explicación en vez de otro error. El `title` de `about:blank` sigue en inglés porque así es siempre en el `revisor`, no porque el cliente lo pidiera; el RFC permitiría traducirlo con `Accept-Language`, y el `revisor` decide no hacerlo (sección 5.5). Y el `HEAD` trae las mismas cabeceras que el `GET`, con `Content-Length: 174`, pero sin cuerpo: Node no lo manda en un `HEAD`, y el largo dice cuánto mediría.

### Solución 4

La comprobación, en `ejercicio4/problemas.ts` (fragmento; el archivo completo está en `ejercicio4/problemas.ts` del repositorio):

```ts
  for (const nombre of Object.keys(extensiones)) {
    if (RESERVADOS.has(nombre)) throw new Error(`la extensión ${nombre} usa un nombre reservado`);
    // RFC 9457, sección 4: empieza con letra, solo letras, dígitos y «_», y tres caracteres o más.
    if (!/^[A-Za-z][A-Za-z0-9_]{2,}$/.test(nombre)) throw new Error(`la extensión ${nombre} no cumple la forma del RFC 9457`);
  }
```

La expresión dice: una letra (`[A-Za-z]`), y después dos o más letras, dígitos o guiones bajos (`[A-Za-z0-9_]{2,}`), y nada más (`^` y `$`). Son letras del alfabeto inglés a propósito: es lo que el RFC llama `ALPHA`, y una `ñ` no lo es. La corrida:

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
ok    GET /servicios/3 (servicio de otro equipo)
ok    GET /revisiones/99 (revisión que no existe)
ok    GET /servicioss (ruta que no existe)
ok    PATCH /servicios/1 (método que la ruta no admite)
ok    GET /servicios (sin credencial)
ok    POST /servicios (cuerpo en texto)
ok    POST /servicios (cuerpo de más de 16 KiB)
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

13 de 13 respuestas son Problem Details bien formados

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:c0160764-27de-42f7-866a-28ea3f622e08"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:6e53e149-c257-402b-8ea7-2e74df849fb6"}
```

Con la regla, el `revisor` sigue dando trece de trece, porque sus dos extensiones la cumplen. Con `ex`, el alta repetida no responde `409` sino `500`: el nombre de la extensión es un defecto del programa, no del cliente, y `fallar` se niega a mandar un cuerpo que no cumple el formato. La terminal lo dice con la misma referencia que recibió el cliente:

```text
POST /servicios
error c0160764-27de-42f7-866a-28ea3f622e08 en POST /servicios: Error: la extensión ex no cumple la forma del RFC 9457
    at fallar (file://<carpeta>/problemas.ts:54:59)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

Con `status` pasa lo mismo, pero por la otra regla: la forma del nombre es correcta, y es uno de los cinco reservados. Sin esa comprobación, el `...extensiones` escribiría encima del `status` del catálogo (sección 5.9). La terminal, después del segundo reinicio:

```text
POST /servicios
error 6e53e149-c257-402b-8ea7-2e74df849fb6 en POST /servicios: Error: la extensión status usa un nombre reservado
    at fallar (file://<carpeta>/problemas.ts:52:39)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

Que el defecto salga como `500` y no como una respuesta mal formada es la idea: un error que se nota en la primera prueba y no en el cliente de alguien más. Devuelve `existente` a su nombre cuando termines.

## Cómo sé que lo logré

- [ ] Dices de memoria los cinco miembros de un Problem Details, para quién es cada uno y cuáles cambian entre ocurrencias.
- [ ] `curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'` da `404` con `Content-Type: application/problem+json`, `Content-Language: es` y `"type":"https://revisor.example/problemas/servicio-inexistente"`; `/servicios/3` da el mismo `type` y el mismo `title`.
- [ ] `/servicioss` da `"type":"about:blank","title":"Not Found"`, y `PATCH /servicios/1` da `about:blank`, `Method Not Allowed` y `Allow: GET, HEAD, PUT, DELETE`.
- [ ] Un alta con tres campos malos da `422` con `errors` y tres `pointer` (`#/nombre`, `#/url`, `#/limite_ms`); un alta con un nombre repetido da `409` con `"existente":"/servicios/2"`.
- [ ] `GET /servicios/1/informe` da `500` con `instance` `urn:uuid:…`, y encuentras esa misma referencia en la terminal del `revisor`, junto a la pila.
- [ ] Explicas por qué un cliente decide con `type` y no con `title` ni con `detail`, y por qué el `title` de `about:blank` va en inglés.
- [ ] Una extensión llamada `status` da `500`, y la terminal dice `usa un nombre reservado` con la misma referencia que recibió el cliente.
- [ ] `node fig05_02.ts` da `13 de 13`, y contra `defectos/json-a-secas/` da `0 de 13`.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/` da el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Qué tipo de contenido lleva un Problem Details en JSON, y qué gana el cliente con que no sea `application/json`?
2. ¿Cuáles son los cinco miembros? ¿Cuál es el identificador principal del problema, según el RFC, y con qué verbo lo dice?
3. ¿Qué significa `about:blank`? ¿Qué `title` lleva y por qué?
4. ¿Qué se traduce y qué no se traduce en un Problem Details?
5. ¿Qué regla une a `status` con la línea de estado, y por qué en el `revisor` no pueden diferir?
6. ¿Qué es `instance` en un `404` del `revisor`, y qué es en un `500`? ¿Para qué sirve la segunda?
7. ¿Qué debe hacer un cliente con una extensión que no conoce? ¿Qué reglas de nombre tiene una extensión?
8. ¿Cómo se responden varios problemas del mismo tipo? ¿Y varios de tipos distintos?
9. ¿Qué tres cosas cambiaron del RFC 7807 al RFC 9457?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (julio de 2023, estándar propuesto de la IETF), sección 3: el objeto, `application/problem+json`, el ejemplo de `errors` con `pointer` y la regla de varios problemas.
2. [RFC 9457, sección 3.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.1): los cinco miembros, la regla de ignorar un miembro con el tipo equivocado, `type` como identificador principal (3.1.1), `status` (3.1.2), `title` (3.1.3), `detail` (3.1.4) e `instance` (3.1.5).
3. [RFC 9457, sección 3.2](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.2): las extensiones y la obligación de ignorar las que no se conocen.
4. [RFC 9457, sección 4](https://www.rfc-editor.org/rfc/rfc9457.html#section-4): cuándo definir un tipo, qué documentar, `Retry-After` y las reglas de nombre de las extensiones.
5. [RFC 9457, secciones 4.2 y 4.2.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-4.2): el registro de tipos y `about:blank`, con el `title` igual a la frase del código.
6. [RFC 9457, sección 5 y apéndice D](https://www.rfc-editor.org/rfc/rfc9457.html#section-5): las consideraciones de seguridad y los cambios respecto al RFC 7807.
7. [IANA, *HTTP Problem Types*](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml): el registro oficial, con seis entradas y actualizado el 26 de junio de 2026.
8. [IANA, registro del tipo de contenido `application/problem+json`](https://www.iana.org/assignments/media-types/application/problem+json): sin parámetros, con referencia al RFC 9457.
9. [RFC 7807, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc7807.html) (marzo de 2016), la versión anterior, hoy obsoleta.
10. [*Indicating Details of Problems to Machines in HTTP*, draft-nottingham-http-problem-00](https://datatracker.ietf.org/doc/draft-nottingham-http-problem/00/) (4 de julio de 2012), el borrador original y su advertencia.
11. [RFC 9110, *HTTP Semantics*, secciones 8.5, 12.1, 12.4.1, 12.5.1, 13.2.1 y 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5): `Content-Language` y los idiomas de una representación, la libertad del servidor para no negociar, por qué el `415` va antes que la precondición, y el `413`.
12. [RFC 6901, *JavaScript Object Notation (JSON) Pointer*](https://www.rfc-editor.org/rfc/rfc6901.html), secciones 3 y 6: la sintaxis de `pointer` y su forma como fragmento de URI (`#/nombre`).
13. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html): el identificador de la referencia `urn:uuid:` de los errores internos.
14. [RFC 6761, *Special-Use Domain Names*](https://www.rfc-editor.org/rfc/rfc6761.html), sección 6.5: `.example`, reservado para la documentación.
15. [IANA, *HTTP Status Codes*](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml): las frases oficiales de los códigos, que son el `title` de `about:blank`.

### Términos de esta lección

| | |
|---|---|
| **Problem Details** | el objeto JSON del RFC 9457 que explica un error de una API HTTP |
| **tipo de problema** | una clase de problemas con nombre propio: el `type`, su `title`, su código y sus extensiones |
| **ocurrencia** | una vez concreta en que pasó un problema; la describen `detail` e `instance` |
| **`about:blank`** | el tipo que no agrega nada al código de estado; su `title` es la frase del código |
| **extensión** | un miembro propio de un tipo de problema, además de los cinco estándar |
| **JSON Pointer** | la forma estándar de señalar un lugar dentro de un JSON, como `#/nombre` |
| **catálogo** | la tabla de todos los tipos de problema de una API |
| **manejador central** | la única función por la que pasan todas las respuestas de error |

---

**Anterior:** [Lección 4 — Capacidad y fallas del servidor: 429, 500, 502, 503 y 504](04-capacidad-y-fallas-del-servidor.md) · **Siguiente:** [Lección 6 — Reintentos e idempotencia](06-reintentos-idempotencia.md)

# Lección 4 — Capacidad y fallas del servidor: 429, 500, 502, 503 y 504

Es viernes, último día del mes, y son las 19:05. El servicio de facturación del equipo `a` empezó a contestar cosas raras hace veinte minutos, y el tablero que se alimenta del `revisor` se pintó de rojo. Alguien del equipo de pagos, nervioso, abrió el tablero y apretó «revisar ahora» una y otra vez; su navegador quedó repitiendo la petición cada medio segundo, y cada repetición hace que el `revisor` salga a la red a consultar un servicio que ya sabe caído. A las 19:12, la persona de guardia pide el informe del servicio de catálogo y recibe un `500` cuyo cuerpo es una pila de llamadas con la carpeta completa del servidor, el nombre de cada archivo y la versión de Node que corre. Alguien copia ese cuerpo en el canal público de soporte para pedir ayuda. A las 19:20 llega la pregunta que nadie puede contestar: **¿la culpa es nuestra o de ellos?** El `revisor` responde `500` cuando su propio código falla, `500` cuando el servicio de facturación contesta basura y `500` cuando el de reportes tarda demasiado. Con un solo número para tres fallas distintas, nadie sabe a quién despertar.

Esta lección le da al `revisor` un número distinto para cada una de esas situaciones, y le enseña a callar lo que no debe salir.

**Tiempo:** 2 × 45 min (el corte está entre las secciones 4.4 y 4.5)

**Qué construyes:** la red completa para el error inesperado (un `500` con una referencia, y la pila solo en la terminal de quien opera), una consulta en vivo, `GET /servicios/{id}/salud`, en la que el `revisor` hace de pasarela y distingue entre una dependencia lenta (`504`) y una que no responde HTTP (`502`), un modo mantenimiento que responde `503` con `Retry-After`, y un límite por credencial para lo que hace salir al `revisor` a la red (las revisiones y la consulta en vivo), que responde `429`

**Qué aprendes:** a contestar, para cada falla, **quién tiene la culpa y quién puede arreglarlo**; `Retry-After` en sus dos formas, segundos o fecha; `500` frente a `502` frente a `504`; `503` frente a `500`; por qué el `429` es un `4xx` aunque hable de capacidad; **qué se dice y qué jamás se dice** en un error del servidor (pilas, consultas, rutas, secretos); y, en los recuadros de seguridad, lo que jamás se dice en un error y el `429` como defensa contra la enumeración y el agotamiento de recursos, y por qué la fuerza bruta sobre las credenciales se frena en otra capa

**De dónde vienes.** De la [Lección 3](03-errores-del-cliente-estado.md), con un `revisor` que ya distingue los errores de estado del cliente (no todo el registro de `4xx` de la IANA, sino los que el curso trabaja): el conflicto, la regla de negocio y la precondición, la actualización perdida, la versión retirada. Ese `revisor` ya no se cae cuando un manejador lanza una excepción: desde la Lección 1, `atenderSinCaerse` la atrapa y responde `500 error interno`. Pero es una red mínima: el `500` no trae nada que permita encontrar el error en la terminal, y nadie te explicó todavía qué significa ese código. Tampoco hay forma de ponerlo en mantenimiento, ni de frenar a quien pide revisiones sin parar, ni de preguntarle en vivo cómo está un servicio.

**Qué no hace esta lección.** No cambia la forma de los cuerpos de error: siguen siendo una línea de texto, y la [Lección 5](05-problem-details.md) los convierte en `application/problem+json`. No reintenta nada: el `revisor` lee `Retry-After` y lo anota en el resultado de una revisión, pero el retroceso exponencial y la decisión de reintentar son de la [Lección 6](06-reintentos-idempotencia.md), y la tabla que decide qué hacer con cada código es de la [Lección 7](07-quien-lee-el-error.md). No enseña las cabeceras `RateLimit-*`, porque todavía son un borrador de la IETF y no un estándar (sección 4.6.5). Y no simula un balanceador de carga de verdad: la pasarela de esta lección es el propio `revisor`, que consulta un servicio y te cuenta qué pasó.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS con Node 24.14.1 y curl 8.7.1, en una máquina con la zona horaria del centro de México (UTC−6); solo una salida depende de esa zona, la del ejercicio 2, y la solución dice por qué. La máquina tenía otros programas en los puertos del curso, así que el laboratorio y el `revisor` se levantaron en los puertos 18481 y 18480, y en las salidas se reescribieron como 18081 y 18080; los largos no cambian, porque los dos números tienen cinco cifras. En tu corrida van a cambiar varias cosas: la fecha de la cabecera `Date`, la referencia de cada `500` (un identificador al azar, distinto en cada error), los milisegundos medidos, las ocho cifras finales de cada `ETag`, y el `Retry-After` de un `429`, que depende de cuánto tiempo pasó desde la primera petición de la ventana. Cuando la terminal del `revisor` imprime una pila, la carpeta de la máquina se escribe `<carpeta>`: las rutas de una máquina no se publican, y la sección 4.3.4 explica por qué. El `revisor` guarda todo en memoria: arráncalo de nuevo antes de cada serie de peticiones para obtener lo mismo que la lección. Los programas están en [`programas/04-capacidad-y-fallas-del-servidor/`](../programas/04-capacidad-y-fallas-del-servidor), en el repositorio del curso: el `revisor` en `fig04_01/`, la ventana fija vista de cerca en `fig04_02.ts`, el lector de `Retry-After` en `fig04_03.ts`, las versiones rotas de «El error que vas a ver» en `defectos/`, las soluciones que llevan código en `ejercicios/`, y cada corrida en su archivo `.salida.txt`. Todos pasan `tsc` en modo estricto con el comando de la sección 4.7.4.

## Al terminar vas a poder

- Decir, para una falla dada, quién tiene la culpa, quién puede arreglarla y qué código le corresponde: `429`, `500`, `502`, `503` o `504`.
- Provocar un `500` en el `revisor` y encontrar su pila en la terminal a partir de la referencia que recibió el cliente.
- Distinguir con una corrida un `502` de un `504`, y explicar por qué un servicio caído que responde `503` produce un `200` en la consulta de salud.
- Leer un `Retry-After` en sus dos formas, segundos o fecha HTTP, y señalar qué valores no son válidos según el RFC 9110.
- Explicar por qué una ventana fija de 3 peticiones por segundo puede dejar pasar 5 peticiones en menos de 70 milisegundos, con la corrida que lo muestra.
- Enumerar lo que jamás se dice en un error del servidor y demostrar con una corrida qué revela una pila que viaja en el cuerpo.
- Demostrar con una corrida que un límite por credencial, preguntado antes de buscar el recurso, frena a quien prueba identificadores uno tras otro, y que uno por recurso no lo frena.

## El porqué antes del cómo

En la Lección 0 viste la pregunta que separa las dos familias de errores: **¿quién se equivocó?** Si fue quien pidió, el código es un `4xx`; si fue quien atiende, un `5xx`. Las Lecciones 2 y 3 se dedicaron a la primera mitad. Esta lección se ocupa de la segunda, y le agrega una pregunta que importa tanto como la primera: **¿quién puede arreglarlo?** Porque «la culpa es del servidor» no le dice a nadie qué hacer. El cliente necesita saber si le conviene esperar, cuánto, o rendirse. Quien opera necesita saber si el problema está en su código, en su configuración o en un servicio de otro equipo. Cada código de esta lección contesta las dos preguntas de una forma distinta:

| Código | Qué pasó | Quién tiene la culpa | Quién puede arreglarlo | Qué hace el cliente |
|---|---|---|---|---|
| `429` | pediste más de lo que te toca en un tiempo dado | el cliente, por su ritmo | el cliente, bajando el ritmo | esperar lo que diga `Retry-After` |
| `500` | algo inesperado pasó en el código del servidor | el servidor | quien opera el servidor, corrigiendo su código | no insistir en lo mismo; reportar la referencia |
| `502` | el servidor hizo de pasarela y lo que está detrás respondió algo inválido, o no se pudo conectar | lo que está detrás | quien opera lo que está detrás | esperar, o intentar más tarde |
| `503` | el servidor no puede atender ahora: mantenimiento o sobrecarga | nadie se equivocó: es una decisión o un límite | el tiempo, o quien opera | esperar lo que diga `Retry-After` |
| `504` | el servidor hizo de pasarela y lo que está detrás no respondió a tiempo | lo que está detrás | quien opera lo que está detrás | esperar, o intentar más tarde |

La escena del principio tenía tres problemas, y los tres caben en esta tabla. El navegador que repetía la petición cada medio segundo necesitaba un `429`, que le dijera «baja el ritmo» y cuánto esperar. El informe que reventó necesitaba un `500` que no contara nada de adentro, más una referencia para que la persona de guardia encontrara la pila en su terminal. Y la facturación caída necesitaba un `502` o un `504`, que dijeran «el problema está detrás de mí», para que nadie revisara el código del `revisor` buscando un error que no estaba ahí. Con un solo `500` para todo, cada una de esas personas tomó la decisión equivocada: el navegador siguió insistiendo, el cuerpo del error terminó en un canal público, y la guardia buscó en el lugar equivocado.

Fíjate en el primer renglón: el `429` es un `4xx`, aunque hable de capacidad. Es la única excepción aparente de la tabla, y no es una excepción: quien puede arreglarlo es el cliente, bajando su ritmo, y eso es exactamente lo que dice la familia `4xx`. El servidor no falló; el cliente pidió más de lo acordado. En cambio, el `503` es un `5xx` aunque el servidor «funcione»: el servidor no puede atender ahora, por una razón suya, y ningún cambio en la petición lo arregla.

La tabla tiene otra columna que no se ve, pero que atraviesa toda la lección: **qué se dice**. Un error del servidor es el momento en que una API está más tentada a contar de más, porque quien escribió el código quiere ver qué pasó, y lo más rápido es mandar la excepción completa en la respuesta. Lo que le sirve a quien opera (la pila, la consulta, la ruta del archivo) es exactamente lo que no debe ver quien pidió. El tercer criterio del curso lo dice: **lo que sale hacia fuera se diseña**.

La lección tiene cinco partes:

1. **El laboratorio y la pregunta** (4.1 y 4.2): las tres formas en que una dependencia falla sin responder, y la pregunta que decide el código.
2. **El `500`** (4.3): la referencia, la pila en la terminal y el recuadro de seguridad sobre lo que jamás se dice.
3. **El `revisor` como pasarela** (4.4): `502` y `504`, y por qué un `503` ajeno es un `200` propio.
4. **La capacidad** (4.5 y 4.6): `503` con `Retry-After` para el mantenimiento y `429` para el límite de peticiones, con el recuadro de seguridad sobre el `429` como defensa.
5. **El `revisor` completo** (4.7): los archivos y la corrida de todos los casos.

## Los conceptos

### 4.1 El `revisor` de esta lección

#### 4.1.1 Qué cambia

El `revisor` de esta lección vive en `~/curso-http/fig04_01/`. Si tienes la carpeta de la Lección 3, cópiala con ese nombre. Son trece archivos: dos nuevos, seis que cambian y cinco que se quedan como estaban. La sección 4.7 los trae todos completos; aquí va el mapa, para que sepas dónde está cada cosa mientras lees:

| Archivo | Qué cambia | Sección |
|---|---|---|
| `limitador.ts` | **nuevo**: cuántas veces se puede hacer algo en una ventana de tiempo | 4.6 |
| `operacion.ts` | **nuevo**: el modo mantenimiento y `PUT /mantenimiento` | 4.5 |
| `servidor.ts` | la red mínima se vuelve la completa: referencia y pila recortada | 4.3 |
| `cliente.ts` | `consultar` distingue cuatro desenlaces más uno, y lee `Retry-After` | 4.4 y 4.5 |
| `servicios.ts` | las rutas `salud` e `informe`, y los límites de `pedirRevision` y `salud` | 4.3, 4.4 y 4.6 |
| `rutas.ts` | las rutas nuevas y la parada por mantenimiento | 4.5 |
| `laboratorio.ts` | tres rutas para fallar: `/lento/MS`, `/cortar` y `/basura` | 4.1.2 |
| `almacen.ts` | tres servicios de arranque más, y `revisionesDe` | 4.1.2 y 4.3 |

`autenticacion.ts`, `destinos.ts`, `etiquetas.ts`, `respuestas.ts` y `versiones.ts` no cambian. Los cuerpos de error siguen saliendo de `fallar`, en `respuestas.ts`, como una línea de texto.

#### 4.1.2 Tres formas de fallar sin responder

Para provocar un `502` y un `504` hace falta un servicio que falle **sin** responder un código. Un servicio que responde `503` no sirve para eso: respondió, y su respuesta es HTTP válido. El laboratorio, que es el banco de la Lección 0 en el puerto 18081, gana tres rutas que fallan de las tres formas en que falla un servicio real cuando no contesta bien:

```ts
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
```

- `/lento/MS` responde `200`, pero después de `MS` milisegundos. Es el servicio que funciona, pero tarda: una base de datos saturada, un proceso que se quedó esperando a otro.
- `/cortar` cierra la conexión sin escribir nada. Es el proceso que se cayó a media petición, o el balanceador que corta.
- `/basura` escribe un renglón que no es una respuesta HTTP. Es el servicio que no habla el protocolo que esperabas: un puerto equivocado, otro programa escuchando ahí.

Antes de ver qué hace el `revisor` con ellas, mira qué hace `curl`, que es un cliente sin intermediarios. Arranca el laboratorio en una terminal (`node laboratorio.ts`, desde `fig04_01/`) y prueba las tres en otra:

```text
$ curl -i http://127.0.0.1:18081/basura
curl: (1) Received HTTP/0.9 when not allowed

$ curl -i -m 1 http://127.0.0.1:18081/lento/3000
curl: (28) Operation timed out after 1001 milliseconds with 0 bytes received

$ curl -i http://127.0.0.1:18081/cortar
curl: (52) Empty reply from server
```

Ninguna de las tres trae una línea de estado. Ninguna trae un código. `curl` termina con un error **suyo**, y cada uno dice algo distinto. El 1 es, según el manual de `curl`, «protocolo no soportado», y el mensaje explica por qué: lo que escribió `/basura` no empieza con `HTTP/1.1`, así que `curl` lo tomó por una respuesta de HTTP/0.9 (sin línea de estado ni cabeceras), y esa versión está apagada salvo que se la pidas con `--http0.9`. En la práctica: llegó algo, pero no es HTTP. El 28 dice que se acabó el tiempo: con `-m 1` le diste un segundo, y `/lento/3000` iba a tardar tres. El 52 dice que el servidor no contestó nada: aceptó la conexión y la cerró. En la Lección 0 viste el código 7, «no me pude conectar»: es la cuarta forma, y la vas a ver en el ejercicio 4.

Cuando el `revisor` consulte uno de estos servicios, va a estar en el lugar de `curl`. La diferencia es que `curl` puede terminar con un código de salida, y el `revisor` no: alguien le hizo una petición HTTP y le tiene que contestar con un código HTTP. Ese es el problema que resuelven el `502` y el `504`.

Los servicios de arranque del `almacen.ts` crecen para usar esas rutas. A los tres de antes (1 `catalogo`, 2 `pagos`, 3 `nomina`) se agregan tres, todos del equipo a:

| id | nombre | url | límite |
|---|---|---|---|
| 4 | inventario | `http://127.0.0.1:18081/lento/1500` | 2000 ms |
| 5 | reportes | `http://127.0.0.1:18081/lento/3000` | 1000 ms |
| 6 | facturacion | `http://127.0.0.1:18081/basura` | 2000 ms |

`inventario` tarda 1.5 s con un límite de 2 s: llega a tiempo, pero lento. `reportes` tarda 3 s con un límite de 1 s: no llega. `facturacion` contesta basura. Como ahora hay seis servicios de arranque, la primera alta de cada corrida recibe el id 7, no el 4.

#### 4.1.3 Arrancar los dos

Igual que en las lecciones anteriores, dos terminales en `~/curso-http/fig04_01/`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Deja las dos corriendo. Todas las peticiones de las secciones 4.3 a 4.6 van contra este par, en el orden en que aparecen, y la sección 4.7.3 las junta.

### 4.2 Quién tiene la culpa: la pregunta de los `5xx`

El RFC 9110 define la familia `5xx` en su [sección 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6) con una frase que conviene leer despacio: el servidor **sabe que se equivocó, o no es capaz** de ejecutar el método pedido. Son dos cosas distintas. «Se equivocó» es un error: algo en el servidor no hizo lo que debía. «No es capaz» puede no ser un error de nadie: el servidor está en mantenimiento, o saturado, o depende de otro que no contesta. La misma sección agrega una recomendación fuerte (un *SHOULD*, no un *MUST*) que ya viste en la Lección 0: salvo en una respuesta a `HEAD`, el servidor **debería** mandar una explicación del error y decir **si es temporal o permanente**. Esa segunda mitad es la que casi todo el mundo olvida, y es la que más le sirve al cliente, porque de ella depende si vale la pena volver a intentar.

Para elegir entre los cinco códigos de esta lección, hazte estas preguntas en orden:

1. **¿El cliente pidió más de lo que le toca en un tiempo dado?** Entonces el servidor no falló: el cliente tiene que bajar el ritmo. Es un `429`, de la familia `4xx`, con `Retry-After` si sabes cuánto tiene que esperar.
2. **¿El servidor decidió no atender ahora, por mantenimiento o porque está saturado?** Es un `503`. Nadie se equivocó; es temporal por definición, y `Retry-After` dice cuánto se espera que dure.
3. **¿El servidor estaba haciendo de pasarela, y lo que está detrás falló?** Si lo de atrás no contestó a tiempo, es un `504`. Si contestó algo que no es una respuesta válida, o no se pudo hablar con él, es un `502`.
4. **¿Nada de lo anterior, y algo inesperado pasó en tu propio código?** Es un `500`.

El `500` va al final a propósito. Es el código que se usa cuando ningún otro describe lo que pasó, y por eso es el más fácil de usar de más: todo lo que sale mal se puede llamar «error interno». Pero un `500` le dice a quien opera «busca en tu código», y si la falla estaba en una dependencia o era un mantenimiento planeado, lo manda a buscar donde no está. **Un `500` es una confesión: «esto no lo previmos»**. Cada vez que el `revisor` responde `500` por algo que sí podía prever, está diciendo algo falso sobre sí mismo.

Hay dos preguntas que el árbol no hace, y que conviene contestar antes de seguir. La primera: **¿y si es el cliente quien mandó algo imposible?** Entonces no es un `5xx`. Un cuerpo ilegible es `400`, uno de más de 16 KiB es `413`, un dato fuera de rango es `422`, y lo viste en las Lecciones 2 y 3. Un `5xx` para un error del cliente es tan engañoso como un `200` para un error: el cliente concluye que el problema no es suyo y repite la misma petición, que va a fallar igual. La segunda: **¿qué pasa con los `5xx` que el curso no usa?** El `501` se mencionó en la Lección 2: es para un método que el servidor no implementa en ningún recurso. El `505` es para una versión de HTTP que el servidor no admite. Ninguno es un error de capacidad ni de una dependencia, y el `revisor` no los necesita.

### 4.3 `500`: lo que nadie esperaba

#### 4.3.1 La pregunta que decide

El RFC 9110 define el `500 Internal Server Error` en la [sección 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1) en una sola frase: el servidor encontró **una condición inesperada** que le impidió cumplir la petición. La palabra que importa es «inesperada». La pregunta que decide el `500` es: **¿esto lo previmos?** Si la respuesta es sí, hay otro código que lo describe mejor. Si es no, es un `500`, y lo honesto es responderlo así, en vez de disfrazarlo de otra cosa.

En la práctica, un `500` es casi siempre una excepción que nadie atrapó: un `undefined` donde se esperaba un objeto, una división por cero, una conexión a la base de datos que se rompió a mitad de una consulta. Lo que el servidor puede hacer bien con un `500` no es evitarlo (si pudiera, no sería inesperado), sino **responderlo bien**: con el código correcto, sin contar de más, y dejando en algún lugar la información que quien opera necesita para corregirlo.

#### 4.3.2 Provocarlo

El `revisor` de esta lección trae un `500` a propósito, para que lo puedas provocar cuando quieras. La ruta `GET /servicios/{id}/informe` resume las revisiones de un servicio, y tiene un defecto que se le escapa a cualquiera:

```ts
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

Busca la última revisión del servicio y lee su resultado. Funciona siempre que el servicio tenga al menos una revisión terminada. Si no tiene ninguna, `revisiones[revisiones.length - 1]` es `undefined`, y leer `.resultado` sobre `undefined` lanza un `TypeError`. Los dos `as` del código le dicen a TypeScript «confía en mí, aquí siempre hay una revisión», y TypeScript confía: el defecto pasa `tsc` en modo estricto sin una sola queja. Es el tipo de error que produce un `500` en una API real: el caso que nadie pensó, escondido detrás de una suposición. El comentario dice que el defecto se queda así hasta el final del curso, para que siempre haya un `500` que provocar.

Con el laboratorio y el `revisor` recién arrancados, el servicio 1 no tiene revisiones. Pide su informe dos veces:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia affc3b8a-5ab9-42f5-8b37-2face1f8eafd

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia bf0e3b0a-790f-4625-80e7-017b0bcfa403
```

Lee las dos respuestas con la tabla del porqué en la mano. El código es `500`: el servidor confiesa que algo inesperado pasó, y el cliente sabe que el problema no es suyo. El cuerpo no dice qué pasó, ni dónde, ni en qué archivo. Dice solo dos cosas: que fue un error interno, y una **referencia**. Y la referencia es distinta en cada respuesta: cada error es un suceso distinto, aunque la causa sea la misma.

Ahora mira la terminal del `revisor`:

```text
GET /servicios/1/informe
error affc3b8a-5ab9-42f5-8b37-2face1f8eafd en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
```

Ahí está todo lo que el cliente no vio: el mensaje del error (`TypeError: Cannot read properties of undefined (reading 'resultado')`) y los marcos de la pila, del más reciente al más antiguo. El primero dice dónde nació el error: la función `informe`, en `servicios.ts`, renglón 304, columna 28, que es justo el `.resultado` sobre `ultima`, la revisión que no existe. Los otros tres dicen cómo se llegó ahí: `atender`, en `rutas.ts`, llamó al manejador, `atenderSinFiltrar`, en `servidor.ts`, llamó a `atender`, y el servidor de Node llamó a `atenderSinFiltrar`. Y al principio de la línea, la misma referencia que recibió el cliente. Si alguien reporta «me salió un error con la referencia `affc3b8a-…`», quien opera busca ese texto en su bitácora y encuentra la pila exacta de **esa** petición, entre miles.

#### 4.3.3 `servidor.ts`: la referencia y la pila

En las Lecciones 1 a 3, `servidor.ts` tenía una red mínima, `atenderSinCaerse`, que respondía `500 error interno` y escribía el mensaje en la terminal. Esta lección la convierte en la red completa, `atenderSinFiltrar`:

```ts
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
      fallar(respuesta, 500, `error interno; referencia ${referencia}`);
    } else {
      respuesta.destroy();
    }
  }
}
```

Lee primero `atenderSinFiltrar`, que es la que atrapa. Todo lo que hace el `revisor` pasa por el `await atender(...)` dentro del `try`. Si algo lanza, en cualquier manejador, en cualquier profundidad, la excepción sube hasta este `catch`. Ahí pasan tres cosas, en este orden.

**Primero, se sortea una referencia** con `randomUUID()`, del módulo `node:crypto`, que según la documentación de Node genera un identificador UUID de versión 4 al azar, con un generador criptográfico. Que sea al azar importa por dos razones. Una: dos errores prácticamente nunca comparten referencia (un UUID v4 trae 122 bits al azar: una colisión es posible en teoría y despreciable en la práctica), así que la referencia identifica una petición y no una causa. La otra: no revela nada. Un número consecutivo (`error 1043`) le diría a quien lo recibe cuántos errores ha tenido tu servidor, y a qué ritmo; un UUID al azar no dice nada más que «este suceso».

**Segundo, se escribe la pila en la terminal**, con la referencia delante. La terminal es la bitácora de quien opera: en un servidor real, eso iría a un sistema de registros, y el principio es el mismo.

**Tercero, se responde al cliente**, pero solo si todavía se puede. `respuesta.headersSent` dice si la línea de estado y las cabeceras ya salieron. Si no salieron, se responde `500` con la referencia. Si ya salieron (un manejador que empezó a responder `200` y lanzó a medio cuerpo), ya no se puede cambiar el código: la línea de estado es lo primero que viaja, y no se puede retirar. Lo único honesto es cortar la conexión con `respuesta.destroy()`, para que el cliente vea un cuerpo incompleto y no un `200` que parece entero. Del lado de `curl` se ve como un error 18, «transferencia incompleta»: llegaron el código y las cabeceras, pero no todo el cuerpo prometido. Se midió con un servidor de juguete que escribía `abc` y cortaba: con `Content-Length: 100` `curl` dice `(18) transfer closed with 97 bytes remaining to read`, y sin `Content-Length` (transferencia por partes) dice `(18) transfer closed with outstanding read data remaining`; en los dos casos, error 18.

Ahora `pilaDelCurso`. `error.stack` es un texto: el mensaje en el primer renglón, y después un renglón por marco, cada uno con `at`. La función se queda con el mensaje y con los marcos que no contienen `node:` ni `node_modules`. Los marcos de `node:` son los del propio Node (`node:events`, `node:_http_server`) y los de `node_modules` serían los de las dependencias, si el curso tuviera alguna. Se quitan por dos razones. La primera es práctica: los números de renglón de los marcos internos de Node cambian con cada versión, así que una salida que los incluyera cambiaría con cada actualización de Node, aunque tu código no cambiara. La segunda es de oficio: esos marcos no los puede corregir quien aprende, ni casi nunca quien opera. Lo que necesitas para arreglar el `500` está en los marcos de tu código, y ahí siguen. La sección «El error que vas a ver» muestra la pila completa, con los marcos de Node incluidos, y por qué esa versión es un problema cuando viaja.

Fíjate en el nombre de la función, `atenderSinFiltrar`. Se lee como «atender lo que nadie filtró antes»: es la red para lo que se escapó de todos los manejadores. No quiere decir que no filtre lo que sale: filtra todo, y al cliente solo le llega la referencia. Si cada manejador hiciera bien su trabajo, este `catch` nunca se activaría. Por eso cada vez que se activa es una noticia para quien opera, y la referencia es el hilo para jalar.

#### 4.3.4 Recuadro de seguridad: lo que jamás se dice en un error

> **Recuadro de seguridad.** Un error del servidor es una superficie pública. Cualquier cosa que viaje en su cuerpo la puede leer quien hizo la petición, la puede guardar un proxy, la puede copiar alguien en un canal de soporte, y la puede indexar un buscador si la respuesta llega a una página. Lo que jamás se dice:
>
> - **Pilas de llamadas.** Revelan nombres de archivos, de funciones y de dependencias, y la estructura interna del programa.
> - **Rutas de la máquina.** `file:///home/despliegue/revisor/servicios.ts` dice el usuario que corre el proceso, cómo se organiza el servidor y dónde buscar.
> - **Consultas SQL y nombres de tablas o columnas.** Un error de base de datos que repite la consulta le enseña a quien busca una inyección exactamente qué está construyendo el servidor con su entrada.
> - **Secretos.** Cadenas de conexión, tokens, contraseñas, llaves. Aparecen en errores más de lo que parece: una excepción que imprime el objeto de configuración completo, o una URL con credenciales adentro.
> - **Versiones y nombres de productos.** El servidor web, el lenguaje, el marco de trabajo y su versión le dicen a un atacante qué vulnerabilidades conocidas probar.
> - **Nombres de máquinas y direcciones internas.** Lo mismo que el `revisor` ya evita en el rechazo de SSRF desde la Lección 1: el mensaje dice que un nombre resuelve a una dirección privada, pero no cuál.
>
> El catálogo de debilidades comunes de MITRE tiene un nombre para esto: [CWE-209](https://cwe.mitre.org/data/definitions/209.html), «generación de un mensaje de error que contiene información sensible», y pone entre sus ejemplos las pilas expuestas, las rutas completas de archivos y la estructura de las consultas. La [hoja de recomendaciones de OWASP sobre manejo de errores](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) lo resume en la misma regla que sigue el `revisor`: el detalle del error se registra **del lado del servidor**, para investigarlo, y **no se le devuelve** a quien pidió, que recibe un mensaje genérico.
>
> **La referencia es el puente.** Sin ella, callar la pila haría que el `500` fuera inútil para todos: el cliente no sabría qué reportar, y quien opera no sabría qué buscar. Con ella, el cliente tiene un identificador que no revela nada, y quien opera tiene, en su bitácora, todo lo que el cliente no vio. Es la forma de no contar nada sin dejar de ayudar.
>
> **Callar también el texto del error.** El error más frecuente no es mandar la pila completa, sino mandar solo `error.message`, que parece inofensivo. No lo es. El mensaje de una excepción lo escribe quien la lanzó, que puede ser una biblioteca que no controlas, y no sabes qué va a contener: el de un controlador de base de datos puede traer el fragmento de SQL que falló, y el de un error de red puede traer la dirección interna a la que no se pudo conectar. En el `revisor` lo vas a ver en la sección 4.4.2: cuando un servicio responde basura, `fetch` dice `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, y ese texto se guarda en `motivo` y no viaja. El `502` dice, con palabras del `revisor`, «no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP». **Lo que sale hacia fuera lo escribe tu programa, con sus palabras**; nunca se reenvía el texto de una excepción.
>
> **La bitácora tampoco es un cajón sin fondo.** El `revisor` registra la ruta pedida con su consulta (`peticion.url`, con todo lo que va después del `?`), y si una API recibiera tokens en la URL, ahí quedarían escritos. La [hoja de recomendaciones de OWASP sobre registros](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) pide no registrar tokens de acceso ni datos sensibles: en una API real se registra la ruta sin la consulta, o con los valores sensibles tachados.

### 4.4 `502` y `504`: cuando el `revisor` hace de pasarela

#### 4.4.1 La pregunta que decide

Los dos códigos tienen una condición en común, que el RFC 9110 escribe en las dos definiciones: el servidor responde así **mientras actúa como pasarela o proxy** (*gateway or proxy*). Es decir: para contestarte, tuvo que pedirle algo a otro servidor, y ese otro falló. La [sección 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3) dice que el `502 Bad Gateway` significa que el servidor recibió **una respuesta inválida** del servidor al que fue a preguntar (el RFC lo llama *inbound server*: el que está hacia el origen, del lado contrario al cliente). La [sección 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5) dice que el `504 Gateway Timeout` significa que **no recibió una respuesta a tiempo** del servidor del que necesitaba algo para completar la petición.

Las dos preguntas que deciden son, entonces:

1. **¿Para contestar, tuve que preguntarle a otro?** Si no, no es ni `502` ni `504`. Un servidor que no depende de nadie y falla por un error imprevisto en su propia lógica responde `500`. (Si la causa es que está sobrecargado o en mantenimiento a propósito, el código es `503`, que esta lección ve en 4.5; el `500` es para lo que nadie previó.)
2. **¿Qué me contestó el otro?** Nada a tiempo → `504`. Algo que no es una respuesta HTTP válida → `502`.

Hay un caso que el RFC no nombra: **no se pudo ni conectar** (nadie escuchaba en ese puerto). No es una respuesta inválida, porque no hubo respuesta; tampoco es una respuesta tardía, porque el intento terminó al instante. El `revisor` lo trata como un `502`: lo que está detrás no respondió nada válido, y el problema es suyo. Es criterio de diseño, no norma. Lo que no es una opción es un `500`: el `revisor` sí previó que la conexión podía fallar, y su código no tiene la culpa.

Fíjate en lo que el `502` y el `504` **no** dicen: no dicen que el `revisor` esté mal. Le dicen al cliente «el problema está detrás de mí», y le dicen a quien opera el `revisor` que no busque en su código. Es la respuesta a la pregunta de las 19:20 de la escena del principio.

#### 4.4.2 `cliente.consultar`: cuatro desenlaces más uno

La cara cliente del `revisor` ya consultaba servicios desde la Lección 1, con `revisar`, que devolvía un resultado ya clasificado: `ARRIBA`, `LENTO` o `CAIDO`. Para responder una pasarela hace falta más detalle: no basta con saber que algo salió mal, hay que saber **qué** salió mal. Por eso `cliente.ts` gana una función, `consultar`, que devuelve el desenlace en bruto:

```ts
// Lo que puede pasar al consultar: o hubo una respuesta HTTP, o no la hubo por una de tres razones.
export type Consulta =
  | { tipo: "respuesta"; codigo: number; ms: number; reintentarEn: number | null }
  | { tipo: "tiempo-agotado" }
  | { tipo: "sin-conexion" }
  | { tipo: "respuesta-invalida"; motivo: string }
  | { tipo: "destino-prohibido"; motivo: string };

export async function consultar(url: string, limiteMs: number): Promise<Consulta> {
  // Antes de CADA conexión se vuelve a revisar el destino: el DNS pudo cambiar desde el alta.
  // LÍMITE DECLARADO: esto NO cierra el DNS rebinding. fetch vuelve a resolver el nombre, y entre
  // esta revisión y la conexión el nombre puede apuntar a otra IP. La lección 8 lo completa:
  // se conecta a la IP ya validada, con http.request y su opción lookup.
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
```

`Consulta` es una **unión discriminada**: un tipo que puede ser una de cinco formas, y el campo `tipo` dice cuál. Solo la primera, `"respuesta"`, trae un código; las otras cuatro son las formas de **no** tener uno. Fíjate en que el tipo hace imposible un error que se comete mucho: inventar un código para lo que no fue una respuesta (un `0`, un `-1`, un `500` falso). Si no hubo respuesta, no hay campo `codigo` que llenar. La Lección 0 lo puso en «Lo que se hace mal»: tratar «no se pudo conectar» como un código hace que se pierda la información más útil, si el servidor respondió o no.

`consultar` decide así:

- **Destino prohibido.** Antes de cada conexión se vuelve a revisar el destino contra la lista de SSRF de la Lección 1, porque el DNS pudo cambiar desde el alta. Si no se permite, ni se intenta.
- **Respuesta.** Si `fetch` devolvió una respuesta, hubo HTTP, con el código que sea. El cuerpo no se lee (`body?.cancel()`): para saber cómo está un servicio basta su código, y leer un cuerpo ajeno es gastar memoria en algo que no se va a usar. `redirect: "manual"` hace que un `301` del servicio se informe como `301` y no se siga: el `revisor` dice qué contestó el servicio, no a dónde lo mandó.
- **Tiempo agotado.** `AbortSignal.timeout(limiteMs)` aborta la petición si pasa el límite del servicio, y `fetch` lanza un `DOMException` con nombre `TimeoutError`. La documentación de MDN distingue ese nombre del `AbortError`, que es el que aparece cuando la cancelación viene de otra parte; por eso el código pregunta por el nombre exacto.
- **Sin conexión.** Si la causa del error trae el código `ECONNREFUSED` (nadie escucha en ese puerto), no hubo con quién hablar. `ENOTFOUND` (el nombre dejó de existir) se deja por completitud, pero casi nunca llega aquí: `revisarDestino` ya resolvió el nombre un instante antes, y si no pudo, la consulta termina como destino prohibido, con el motivo `el nombre … no se pudo resolver`.
- **Respuesta inválida.** Todo lo demás: se conectó, y lo que pasó después no fue una respuesta HTTP. `/basura` cae aquí, con la causa `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, y `/cortar` también, con la causa `other side closed` («el otro lado cerró»). El texto se guarda en `motivo`, para quien quiera depurar desde el código, y, como dijo el recuadro, no sale en ninguna respuesta.

Que «respuesta inválida» sea el caso por omisión es una decisión: si aparece una falla que el código no conoce, se trata como la más general de las fallas de un servicio ajeno, no como un error del `revisor`. Si el `revisor` tratara lo desconocido como un error propio, un tipo de falla de red que nadie previó acabaría en el `catch` de `servidor.ts` y saldría como `500`, mandando a buscar en el lugar equivocado.

Y `revisar`, la función de antes, ahora es una traducción de `consultar` al resultado que guarda una revisión:

```ts
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

El `switch` cubre los cinco casos, y TypeScript comprueba que no falte ninguno: si mañana alguien agrega un sexto tipo a `Consulta` y olvida este `switch`, la función ya no devolvería un `Resultado` en todos los caminos, y `tsc` lo marcaría. La clasificación no cambió respecto a la Lección 1, salvo en un detalle: si el servicio respondió un error y trajo `Retry-After`, el detalle lo anota, `503 (reintentar en 120 s)`. La sección 4.5.3 explica cómo se lee ese valor.

#### 4.4.3 La consulta de salud

Las revisiones de la Lección 1 son asíncronas: pides una, recibes un `202`, y el resultado llega después. Para practicar el `502` y el `504` hace falta lo contrario, una consulta **en vivo**, en la que el `revisor` le pregunte al servicio en ese momento y te conteste con lo que pasó. Es la ruta `GET /servicios/{id}/salud`:

```ts
// GET /servicios/{id}/salud: el revisor consulta el servicio en este momento y hace de pasarela.
// Si hubo respuesta HTTP, la informa con 200, sea cual sea su código. Si no la hubo, la culpa es de
// lo que está detrás: 504 si no contestó a tiempo, 502 si no contestó algo que sea HTTP.
export async function salud({ respuesta, parametros, credencial }: Contexto): Promise<void> {
  // La consulta en vivo también sale a la red, igual que una revisión: sin límite, el revisor serviría
  // para golpear un servicio ajeno a través de él. Cuenta por credencial, antes de buscar el servicio,
  // en una ventana aparte de la de las revisiones.
  const decision = permitir(`salud:${credencial.nombre}`, CONSULTAS_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
      fallar(respuesta, 504, `el servicio ${servicio.id} no respondió en ${servicio.limiteMs} ms`);
      return;
    case "sin-conexion":
      fallar(respuesta, 502, `no se pudo conectar con el servicio ${servicio.id}`);
      return;
    case "destino-prohibido":
      fallar(respuesta, 422, `destino prohibido: ${consulta.motivo}`);
      return;
    case "respuesta-invalida":
      fallar(respuesta, 502, `el servicio ${servicio.id} no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP`);
      return;
  }
}
```

Lo primero es un límite: cada credencial puede pedir **3 consultas en vivo por minuto**, porque cada una hace que el `revisor` salga a la red. La sección 4.6 lo explica junto con el límite de las revisiones; aquí basta con saber que existe, porque decide cómo se reparten las pruebas. Después se busca el servicio con `encontrar`, la misma función que usan todas las rutas con `{id}`: un servicio de otro equipo responde `404`, igual que uno que no existe, como en la Lección 2. Después se consulta, y cada desenlace tiene su código. Pruébala con los cinco servicios del equipo a. Son cinco consultas y cada credencial tiene tres por minuto, así que las tres primeras van con `lectura-a` y las dos últimas con `escritura-a`:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":1,"codigo":200,"ms":8}

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":1}

$ curl -i http://127.0.0.1:18080/servicios/4/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:08 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":4,"codigo":200,"ms":1503}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms
tardó 1.004405 s

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 6 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
tardó 0.002184 s
```

Uno por uno:

- **El 1 (`catalogo`) responde `200`** con `"codigo":200`. El servicio está bien, y el `revisor` también.
- **El 2 (`pagos`) responde `200`** con `"codigo":503`. Este es el renglón que más confunde, y el más importante de la sección. El servicio de pagos está caído, sí, pero **respondió**: dijo `503`, con HTTP válido. El `revisor` hizo lo que se le pidió, que era averiguar cómo está el servicio, y lo averiguó. Su respuesta es un éxito que trae una mala noticia adentro. Si el `revisor` respondiera `503` aquí, le estaría diciendo al cliente «yo, el `revisor`, no puedo atenderte», y cualquier máquina del camino (un balanceador, un monitor, una caché) lo creería: el monitor marcaría al `revisor` como caído por culpa de un servicio ajeno.
- **El 4 (`inventario`) responde `200`** con `"ms":1503`: tardó, pero menos que su límite de 2000 ms. Ese tiempo es real: el laboratorio esperó 1500 ms y el resto es lo que tardó la conexión.
- **El 5 (`reportes`) responde `504`**, y `curl` midió **1.004 segundos**: el límite del servicio es 1000 ms, y el `revisor` dejó de esperar justo ahí. El laboratorio iba a contestar a los 3000 ms, pero el `revisor` ya no estaba escuchando. El cuerpo dice cuánto esperó, que es lo que le sirve al cliente para entender qué pasó.
- **El 6 (`facturacion`) responde `502`**, y tardó **2 milisegundos**: el laboratorio contestó basura de inmediato, y el `revisor` la reconoció como tal.

Falta el quinto desenlace, destino prohibido, que responde `422`. Es la misma regla de SSRF de la Lección 1, aplicada otra vez justo antes de conectarse: si el nombre de un servicio que se dio de alta bien ahora resuelve a una dirección privada, o ya no resuelve, el `revisor` no se conecta. No hay corrida aquí porque no se puede provocar desde el laboratorio: cualquier URL que caiga en esa regla ya se rechazó con `422` en el alta. ¿Por qué `422` y no `502`? Porque el `revisor` no llegó a hablar con lo que está detrás: no es una falla de otro servidor, sino un dato guardado (la URL del servicio) que hoy no se puede cumplir. Es criterio de diseño, y tiene un costo que conviene decir: quien pidió la salud no mandó nada mal, y el `422` le habla de un dato que dio de alta otra persona, quizá hace meses. El `detail` dice el motivo, para que sepa qué corregir en el servicio.

Fíjate en los dos tiempos. El `504` tardó lo que dice el límite; el `502`, casi nada. No es casualidad: un `504`, en una pasarela simple como esta, cuesta el tiempo que esperó antes de rendirse, y un `502` puede ser instantáneo. (Una pasarela con disyuntor o con un plazo ya vencido puede dar un `504` casi al instante; lo que define al `504` es que se acabó el plazo para la respuesta del otro, no cuánto tardó la pasarela en decirlo.) Esa diferencia importa a quien diseña un cliente: un cliente que espera 30 segundos a una pasarela con un límite de 1 segundo está desperdiciando 29.

Falta el caso de `/cortar`. No hay un servicio de arranque que lo use, así que da uno de alta y pide su salud, otra vez con `escritura-a`, que lleva dos consultas:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"colgado","url":"http://127.0.0.1:18081/cortar"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-6db25d01"
Content-Type: application/json
Content-Length: 83
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"colgado","url":"http://127.0.0.1:18081/cortar","limite_ms":2000}

$ curl -i http://127.0.0.1:18080/servicios/7/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 7 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
```

`502`, con el mismo cuerpo que el servicio 6. Desde el punto de vista del `revisor`, un servicio que acepta la conexión y la cierra sin decir nada no dio una respuesta válida: no hubo línea de estado. `consultar` no distingue los dos casos (los dos son `respuesta-invalida`), y por eso el cuerpo dice las dos cosas que pudieron pasar, «cortó la conexión o respondió algo que no es HTTP», en vez de afirmar una que puede ser falsa. Separarlos exigiría mirar la causa del error, y no cambiaría el código, que es lo que leen las máquinas.

#### 4.4.4 `500` frente a `502` frente a `504`

Los tres son errores del servidor, y los tres se confunden. Esta tabla junta lo que los separa:

| | `500` | `502` | `504` |
|---|---|---|---|
| ¿Hubo otro servidor detrás? | no hace falta | sí | sí |
| ¿Qué pasó? | algo inesperado en tu código | lo de atrás respondió algo inválido, o no se pudo conectar | lo de atrás no respondió a tiempo |
| ¿Dónde busca quien opera? | en el código del servidor | en el servicio de atrás, o en la conexión | en el servicio de atrás: está lento o caído |
| ¿Cuánto tarda la respuesta? | lo que tarde en fallar | casi siempre poco | por lo menos el límite de la pasarela |
| En el `revisor` | `GET /servicios/1/informe` | `GET /servicios/6/salud` | `GET /servicios/5/salud` |

La regla corta: **`500` es «me equivoqué yo»; `502` y `504` son «se equivocó el que está detrás de mí»**, y entre los dos, la diferencia es si contestó mal o no contestó a tiempo.

Una consecuencia de esa regla, que la sección «El error que vas a ver» muestra con una corrida: si el `revisor` dejara que el error de `fetch` llegara hasta `servidor.ts`, el `502` y el `504` se convertirían en `500`, con su referencia y todo. La respuesta sería bien educada (sin pila, con referencia) y estaría equivocada: diría «me equivoqué yo» cuando el que se equivocó fue otro.

### 4.5 `503` y `Retry-After`: cerrado por mantenimiento

#### 4.5.1 La pregunta que decide

El RFC 9110 define el `503 Service Unavailable` en la [sección 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4): el servidor **no puede atender la petición en este momento** por una sobrecarga temporal o por un mantenimiento programado, y eso **probablemente se resolverá después de un tiempo**. El servidor **puede** mandar `Retry-After` para sugerir cuánto esperar. Y agrega una nota que vale la pena conocer: que exista el `503` no obliga a un servidor saturado a usarlo; algunos simplemente rechazan la conexión.

La pregunta que decide es: **¿el servidor decidió, o sabe, que ahora no puede atender, y que es temporal?** Las dos condiciones importan. «Decidió o sabe»: un `503` no es un error que se escapó, es una respuesta que el servidor eligió dar. «Temporal»: el `503` le promete al cliente que, si espera, la situación cambia. Un servidor que responde `503` para siempre está diciendo algo falso.

La diferencia con el `500` sale de ahí. Los dos son del servidor y los dos le dicen al cliente que el problema no es suyo. Pero el `500` dice «algo salió mal y no sé cuándo se arregla», y el `503` dice «no puedo ahora, vuelve después», muchas veces con la hora exacta. Para un cliente, la diferencia es decidir entre reportar un error y esperar. Para una caché, también: en la Lección 0 viste que `stale-if-error` le permite a una caché servir la copia anterior ante un `500`, `502`, `503` o `504`, pero un monitor que cuenta errores debería contar un mantenimiento anunciado distinto de una falla. Si el mantenimiento se responde con `500`, nadie puede distinguirlos.

#### 4.5.2 El modo mantenimiento

El `revisor` gana un interruptor: `PUT /mantenimiento`, con `{"activo": true}` o `{"activo": false}`, que solo puede usar la credencial `admin`. Mientras está encendido, todo lo demás responde `503` con `Retry-After: 120`. Vive en un archivo nuevo, `operacion.ts`:

```ts
let enMantenimiento = false;
const VUELVE_EN_S = 120;

// Si está en mantenimiento, responde 503 y devuelve true. /mantenimiento siempre se atiende.
export function atajarPorMantenimiento(ruta: string, respuesta: ServerResponse): boolean {
  if (!enMantenimiento || ruta === "/mantenimiento") return false;
  fallar(respuesta, 503, "el revisor está en mantenimiento", { "Retry-After": String(VUELVE_EN_S) });
  return true;
}

// PUT /mantenimiento con {"activo": true} o {"activo": false}. Solo la credencial admin.
export async function cambiarMantenimiento({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  if (credencial.rol !== "admin") {
    fallar(respuesta, 403, "solo quien opera el revisor puede cambiar el mantenimiento");
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

Dos funciones. `atajarPorMantenimiento` se llama desde la puerta, antes de todo, y responde `503` si el modo está encendido; devuelve `true` para que la puerta sepa que ya se respondió. `cambiarMantenimiento` es el manejador de `PUT /mantenimiento`: revisa el rol, lee el cuerpo con el mismo `leerJson` de siempre (así un cuerpo que no es JSON recibe su `415` o su `400`, como en la Lección 2), exige un booleano (si no, `422`, con la misma `rechazarDatos` de la Lección 3) y cambia el modo.

En `rutas.ts`, la parada se agrega en la puerta, junto a las otras paradas que van antes de las siete preguntas:

```ts
  if (redirigir(url.pathname, url.search, respuesta)) return;
  if (atajarPorMantenimiento(url.pathname, respuesta)) return;
  if (versionRetirada(url.pathname, respuesta)) return;
```

Pruébalo con las dos credenciales, y después pide dos cosas mientras dura:

```text
$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 59
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo quien opera el revisor puede cambiar el mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i http://127.0.0.1:18080/no-existe
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
200
```

Seis respuestas, y cada una dice algo:

- **`escritura-a` recibe `403`.** Es un escritor, y la ruta es de escritura, así que pasó la pregunta 4 de la puerta; pero el manejador revisa además que sea `admin`. Encender el mantenimiento le cambia el día a todos los equipos, y no le toca a uno solo.
- **`admin` recibe `204`.** El modo se encendió; no hay nada que devolver. La terminal del `revisor` lo registra: `operación: mantenimiento encendido`.
- **`GET /servicios` recibe `503` con `Retry-After: 120`.** El cuerpo dice qué pasa; la cabecera dice cuánto esperar; el código dice que no es culpa del cliente y que es temporal.
- **`/no-existe`, sin credencial, también recibe `503`.** Esta merece una pausa. Es una ruta que no existe, pedida por alguien que no dijo quién es, y la respuesta no es `404` ni `401`. Es que el mantenimiento va **antes** que las siete preguntas. La razón es la misma de la Lección 2 para las redirecciones: mientras el `revisor` está en mantenimiento, ninguna respuesta que dependa de sus datos es confiable, y responder `404` a una ruta que sí existe porque «hoy no la estoy atendiendo» sería mentir. Una sola respuesta para todo es lo más honesto, y además no le enseña nada a nadie: un desconocido no aprende qué rutas existen.
- **El `admin` apaga el modo con otro `204`.** `/mantenimiento` es la única ruta que se atiende durante el mantenimiento, porque si no, nadie podría apagarlo. Fíjate en que la excepción está escrita en la propia `atajarPorMantenimiento` y no en la puerta: el interruptor y su excepción viven juntos.
- **`GET /servicios` vuelve a `200`.**

¿Por qué el mantenimiento va **después** de las redirecciones? Porque una redirección no entrega datos: dice dónde está la ruta nueva, y eso sigue siendo cierto durante el mantenimiento. Un cliente que pide `/viejo/servicios` recibe el `301`, va a `/servicios`, y ahí recibe el `503`. Cada respuesta dice algo verdadero.

#### 4.5.3 `Retry-After`, en sus dos formas

`Retry-After` está definida en la [sección 10.2.3 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3). Dice cuánto **debería** esperar el cliente antes de volver a pedir; con un `503`, cuánto se espera que dure la indisponibilidad. Su valor tiene dos formas, y la gramática del RFC las escribe así:

```text
Retry-After = HTTP-date / delay-seconds
delay-seconds  = 1*DIGIT
```

O una fecha HTTP (`Fri, 31 Dec 1999 23:59:59 GMT`, el ejemplo del RFC), o una cantidad de segundos (`120`). `1*DIGIT` significa «uno o más dígitos»: un entero sin signo, sin punto decimal, sin espacios adentro. `1.5` no es un valor válido, ni `-1`, ni `2m`.

La fecha tiene a su vez tres formatos, por historia: la [sección 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) define el preferido (`Sun, 06 Nov 1994 08:49:37 GMT`) y dos obsoletos que vienen de versiones viejas de HTTP (`Sunday, 06-Nov-94 08:49:37 GMT` y `Sun Nov  6 08:49:37 1994`, el formato de la función `asctime` de C), y dice que quien lee una fecha en un campo HTTP **debe** aceptar los tres. Quien genera una fecha HTTP **debe** usar solo el primero.

¿Cuándo conviene cada forma? Los segundos son relativos: «espera 120 segundos desde que recibiste esto». La fecha es absoluta: «vuelve a partir de las 23:59». Los segundos son más robustos, porque no dependen de que el reloj del cliente y el del servidor estén de acuerdo. La fecha tiene sentido cuando el servidor sabe una hora concreta, por ejemplo el fin de una ventana de mantenimiento anunciada. El `revisor` manda segundos en todos los casos.

Del lado del cliente, `cliente.ts` lee las dos formas con `segundosDeEspera` y su ayudante, `fechaHttp`:

```ts
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
```

Si no viene la cabecera, `segundosDeEspera` devuelve `null`: no hay instrucción. Si son solo dígitos, son los segundos. Si no, le pide a `fechaHttp` que la lea como fecha, y calcula cuántos segundos faltan, redondeando hacia arriba; una fecha que ya pasó da `0`, «puedes intentar ya». Si no es una fecha, devuelve `null`: un valor que no se entiende no es una instrucción, y quien llama usa su propia espera por omisión.

`fechaHttp` es larga porque hace lo que el RFC pide y nada más. Tiene una expresión regular por cada uno de los tres formatos, con los nombres de días y meses que enumera el RFC; arma la fecha con `Date.UTC`, porque una fecha HTTP siempre está en GMT, aunque la forma `asctime` no lo escriba; aplica la regla del RFC 850 para el año de dos cifras (si queda más de 50 años en el futuro, es del siglo anterior); y al final comprueba que la fecha armada sea la que se pidió, porque `Date.UTC` acepta el 32 de octubre y lo convierte, sin quejarse, en el 1 de noviembre. Lo que **no** hace es lo más tentador: pasarle el texto a `Date.parse`. El comentario dice por qué, y el ejercicio 2 te lo muestra con una corrida: `Date.parse` entiende como fecha casi cualquier cosa, y lee la forma `asctime` en la hora local de la máquina.

Este programa prueba `segundosDeEspera` con cinco valores y con la cabecera ausente:

```ts
// fig04_03.ts — leer Retry-After en sus dos formas: segundos o una fecha HTTP.
import { segundosDeEspera } from "./fig04_01/cliente.ts";

const dentroDe90 = new Date(Date.now() + 90_000).toUTCString();
const VALORES: (string | null)[] = ["120", "0", dentroDe90, "Wed, 21 Oct 2015 07:28:00 GMT", "mañana", null];

for (const valor of VALORES) {
  const texto = valor === null ? "(sin la cabecera)" : JSON.stringify(valor);
  console.log(`${texto.padEnd(34)} → ${segundosDeEspera(valor) ?? "null: no dice cuánto esperar"}`);
}
```

```text
$ node fig04_03.ts
"120"                              → 120
"0"                                → 0
"Wed, 21 Oct 2026 13:21:26 GMT"    → 90
"Wed, 21 Oct 2015 07:28:00 GMT"    → 0
"mañana"                           → null: no dice cuánto esperar
(sin la cabecera)                  → null: no dice cuánto esperar
```

Los segundos se leen tal cual; la fecha de dentro de 90 segundos da `90`; la de 2015 ya pasó y da `0`; y `mañana` y la ausencia dan `null`. El ejercicio 2 la pone frente a una versión ingenua, con valores que no son válidos.

El valor que se lee termina en el detalle de la revisión. Lo vas a ver en 4.6.3: una revisión del servicio 2, que responde `503` con `Retry-After: 120` desde el laboratorio, queda con `"detalle":"503 (reintentar en 120 s)"`. El `revisor` todavía no hace nada con ese número, salvo anotarlo; la Lección 6 decide cuándo vale la pena esperar y reintentar, y cuándo no.

#### 4.5.4 `503` frente a `500`

Una forma rápida de no confundirlos es preguntarse **quién sabía**. Un `503` lo responde un servidor que sabe que no puede atender: lo pusieron en mantenimiento, o él mismo midió que está saturado (demasiadas conexiones abiertas, una cola llena). Un `500` lo responde un servidor que se enteró de su error al mismo tiempo que el cliente. Si sabías, y es temporal, es `503`; si no sabías, es `500`.

Hay un caso límite que vale la pena pensar: una base de datos que no responde. Para el servidor de la API, ¿es un `500` o un `503`? Si el código intenta conectarse, falla, y la excepción sube hasta la red de `servidor.ts`, sale un `500`, y no está mal: nadie previó la falla. Si el código detecta que la base no está disponible y lo dice a propósito, un `503` con `Retry-After` es más útil, porque le dice al cliente que es temporal. Y hay quien responde `502` o `504`, con el argumento de que la base de datos es un servidor que está detrás. El RFC no zanja este caso: es criterio de diseño, y lo que importa es decidirlo, escribirlo y aplicarlo igual en todas las rutas. El `revisor` reserva el `502` y el `504` para la consulta de salud, donde hace de pasarela de forma explícita, porque su trabajo es contestar cómo está otro servidor.

### 4.6 `429`: demasiadas peticiones

#### 4.6.1 La pregunta que decide

El `429 Too Many Requests` no está en el RFC 9110. Lo definió en 2012 el [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4), en su sección 4, junto con el `428` de la Lección 3. La definición es corta: el usuario mandó **demasiadas peticiones en un tiempo dado** («*rate limiting*», limitación de la tasa). La respuesta **debería** explicar la situación y **puede** traer `Retry-After`. El ejemplo del RFC es un sitio que permite 50 peticiones por hora a cada usuario identificado, y responde con `Retry-After: 3600`.

La misma sección dice dos cosas que vale la pena subrayar. La primera: el RFC **no define** cómo identifica el servidor al usuario ni cómo cuenta las peticiones. Puede contar por recurso, por servidor entero o entre varios servidores, y puede identificar al usuario por su credencial o por una cookie. Es decir: cuánto, cada cuánto y por quién son decisiones tuyas, y por eso tienen que estar documentadas. La segunda: una respuesta `429` **no debe** guardarse en una caché. Tiene sentido: «llevas demasiadas» es cierto para ti y ahora, no para el siguiente cliente ni para dentro de un minuto.

La pregunta que decide es: **¿el cliente pidió más de lo que le toca en un tiempo dado?** Si la respuesta es sí, el problema se arregla con tiempo y con un cliente que baja el ritmo; por eso es `4xx`. Si el servidor está saturado por la suma de todos los clientes, y no por uno en particular, no es un `429` sino un `503`: ningún cliente hizo nada mal.

El RFC 6585 tiene, además, una advertencia en sus consideraciones de seguridad ([sección 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2)): cuando un servidor está bajo ataque, contestar `429` a cada petición también gasta recursos, así que el servidor **no está obligado** a usar el `429`; a veces es mejor cortar la conexión. El `429` sirve tanto para el cliente que se pasa de la raya como para frenar a quien abusa; pero bajo un ataque de volumen, contestar cada petición también cuesta, y el RFC deja al servidor cortar la conexión en vez de contestar.

#### 4.6.2 La ventana fija

El límite del `revisor` vive en un archivo nuevo, `limitador.ts`. Es el algoritmo más simple que existe, la **ventana fija**: cuenta cuántas veces se usó una clave desde que empezó la ventana, y cuando la ventana termina, empieza otra desde cero:

```ts
// fig04_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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

Cada clave tiene su ventana: cuándo empezó y cuántos usos lleva. `permitir(clave, maximo, ventanaMs)` hace tres preguntas. ¿No hay ventana, o ya terminó? Empieza una nueva, con un uso, y se permite. ¿Hay ventana y quedan usos? Se cuenta uno más y se permite. ¿Se acabaron? Se rechaza, y se dice cuántos segundos faltan para que termine la ventana, redondeando hacia arriba. Ese número es el que viaja en `Retry-After`: el `revisor` no inventa una espera, la calcula. Redondear hacia arriba importa: si faltan 0.3 segundos, decir `0` invitaría al cliente a intentar de inmediato, y volvería a recibir `429`.

`limitador.ts` no sabe nada de HTTP: no recibe peticiones ni responde nada. Recibe una clave y devuelve una decisión. Así se puede usar desde cualquier manejador, y se puede probar solo, como vas a ver en 4.6.4.

#### 4.6.3 En el `revisor`: tres por minuto, por credencial

¿Qué se limita? En el `revisor`, lo que más cuesta es lo que lo hace salir a la red: pedir una revisión y pedir la salud en vivo (4.4.3). Sin límite, cualquiera con una credencial puede ponerlo a hacer miles de conexiones por minuto contra un servicio, el propio o el de otro, que es justo lo que pasaba en la escena del principio. El límite es de **3 revisiones por credencial cada 60 segundos**, en `pedirRevision`, y de otras 3 consultas en vivo por credencial, en una ventana aparte, en `salud`:

```ts
export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  // El límite cuenta por credencial y se consulta ANTES de buscar el servicio: así también cuentan los
  // 404 de quien prueba ids uno tras otro (enumeración), y lo que gasta una credencial no lo paga otra.
  const decision = permitir(`revisiones:${credencial.nombre}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
```

Dos decisiones, y las dos importan más de lo que parece.

**La clave es la credencial**: `revisiones:` más el nombre de la credencial. Así, lo que gasta una credencial no lo paga otra. Si la clave fuera el servicio, una sola credencial podría gastar las tres revisiones de un servicio y dejar a todos los demás un minuto sin poder revisarlo: el `429` le llegaría a quien no hizo nada, que es justo lo que el código no debe decir. El RFC 6585 deja contar por recurso, por servidor o por usuario; el `revisor` cuenta por quien pide, porque el `429` le dice a **ese** cliente que baje **su** ritmo.

**El límite se pregunta antes de `encontrar`.** Así cuentan también las peticiones que terminan en `404`. Parece un detalle, y es la diferencia entre un límite que frena a quien prueba identificadores uno tras otro y uno que no lo ve: si el límite viniera después, cada `404` saldría antes de tocar el limitador, y quien enumera nunca gastaría ninguna ventana. Hay otro beneficio: la clave sale de algo que la puerta ya verificó (la credencial), no de un identificador que el cliente escribe, así que nadie puede crear claves sin fin en el `Map` de `limitador.ts` inventando ids.

Pruébalo: tres revisiones del servicio 2 con `escritura-a`, una cuarta, y una del servicio 4 con `admin`. Después, una cuarta consulta en vivo con `lectura-a`, que ya hizo tres en 4.4.3, y el enumerador de la Lección 2 con `escritura-b`, pidiendo revisiones de los ids 1 a 10. Por último, espera 20 segundos y vuelve a intentar la de `escritura-a`:

```text
$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/4/revisiones -H 'Authorization: Bearer admin'
202

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 58
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 consultas en vivo en el último minuto

$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ sleep 20
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 40
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto
```

Renglón por renglón:

- **Las tres primeras, `202`**, como en la Lección 1. **La cuarta, `429`**, con `Retry-After: 60`: la ventana de `escritura-a` empezó hace un instante y le quedan 60 segundos. El cuerpo dice qué pasó con palabras del `revisor`, y el código y la cabecera dicen qué hacer.
- **La de `admin`, `202`**: tiene su propia ventana. Lo que gastó `escritura-a` no lo paga otra credencial.
- **La cuarta consulta en vivo de `lectura-a`, `429`**, con `Retry-After: 58`: su ventana de consultas empezó con la primera petición de 4.4.3, un par de segundos antes. Es otra ventana, aparte de la de las revisiones: pedir la salud no gasta revisiones, ni al revés.
- **El enumerador, `404 404 202 429 429 429 429 429 429 429`.** `escritura-b` es del equipo b: para él, el 1 y el 2 no existen (`404`), y el 3 es suyo (`202`). Esas tres peticiones llenaron su ventana, aunque dos fueran `404`, y del 4 al 10 recibe `429`. A ese ritmo, recorrer cien mil identificadores tomaría más de tres semanas.
- **Veinte segundos después, otra vez `429`**, pero ahora con `Retry-After: 40`. El número no es fijo: dice cuánto falta de verdad. Un cliente que obedezca esa cabecera no hace ni una petición de más.

Las tres revisiones aceptadas de `escritura-a` y la de `admin` ya terminaron. Mira la primera de cada una, y el informe del servicio 2, que ahora sí tiene revisiones:

```text
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":1,"detalle":"503 (reintentar en 120 s)"}}

$ curl http://127.0.0.1:18080/revisiones/4 -H 'Authorization: Bearer lectura-a'
{"id":4,"servicio":4,"estado":"terminada","resultado":{"estado":"LENTO","codigo":200,"ms":1501,"detalle":"200"}}

$ curl -i http://127.0.0.1:18080/servicios/2/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 54
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"revisiones":3,"ultimo_estado":"CAIDO"}
```

La revisión de `pagos` quedó `CAIDO`, con `"detalle":"503 (reintentar en 120 s)"`: el laboratorio respondió `503` con `Retry-After: 120`, y `segundosDeEspera` lo leyó. La de `inventario`, `LENTO`, con 1501 ms contra un límite de 2000: tardó la mitad del límite o más. Y el informe del servicio 2 responde `200`: el defecto de `informe` solo muerde cuando no hay revisiones terminadas, y aquí hay tres.

#### 4.6.4 La ventana fija, vista de cerca

La ventana fija es fácil de leer, y tiene un defecto que conviene ver con los ojos. Este programa usa el mismo `limitador.ts` del `revisor`, con un límite de 3 cada 1000 ms para no esperar un minuto, y hace siete peticiones en momentos elegidos:

```ts
// fig04_02.ts — la ventana fija, vista de cerca: 3 permisos cada 1000 ms.
// Usa el mismo limitador del revisor, con una ventana corta para no esperar un minuto.
import { setTimeout as esperar } from "node:timers/promises";
import { permitir } from "./fig04_01/limitador.ts";

const MAXIMO = 3;
const VENTANA_MS = 1000;
// Cuándo pide cada petición, en milisegundos desde el arranque.
const PLAN = [0, 950, 960, 1005, 1010, 1015, 1020];

const inicio = performance.now();
const permitidas: number[] = [];
for (const cuando of PLAN) {
  await esperar(Math.max(0, cuando - (performance.now() - inicio)));
  const decision = permitir("demo", MAXIMO, VENTANA_MS);
  const ms = Math.round(performance.now() - inicio);
  if (decision.permitido) permitidas.push(ms);
  const texto = decision.permitido ? "permitida" : `rechazada: Retry-After ${decision.esperaS}`;
  console.log(`${String(ms).padStart(5)} ms  ${texto}`);
}
const rafaga = permitidas.filter((ms) => ms >= 900);
console.log();
console.log(`límite: ${MAXIMO} cada ${VENTANA_MS} ms`);
console.log(`permitidas entre ${rafaga[0]} y ${rafaga[rafaga.length - 1]} ms: ${rafaga.length}`);
```

```text
$ node fig04_02.ts
    2 ms  permitida
  950 ms  permitida
  961 ms  permitida
 1005 ms  permitida
 1011 ms  permitida
 1016 ms  permitida
 1021 ms  rechazada: Retry-After 1

límite: 3 cada 1000 ms
permitidas entre 950 y 1016 ms: 5
```

El límite dice «3 por segundo», y entre el milisegundo 950 y el 1016 pasaron **5**. La primera petición abrió la ventana en los primeros milisegundos; las de 950 y 961 la llenaron; en el milisegundo 1000 la ventana terminó y empezó otra, que aceptó tres más. La séptima, en el 1021, se rechazó con `Retry-After: 1`. En el borde entre dos ventanas, la ventana fija deja pasar hasta el doble del límite en muy poco tiempo. Los milisegundos exactos cambian en cada corrida (los temporizadores de Node no son exactos al milisegundo), pero el cinco no.

¿Es grave? Depende de lo que protejas. Para el `revisor`, que quiere evitar miles de consultas por minuto, que un servicio reciba seis en vez de tres en el cambio de minuto no importa. Para un límite que protege algo frágil, sí puede importar, y por eso existen otros algoritmos: la **ventana deslizante**, que cuenta las peticiones de los últimos 60 segundos contados desde ahora, y el **cubo de fichas** (*token bucket*), que repone permisos poco a poco y permite una ráfaga pequeña pero nunca el doble. Los dos reparten mejor y enseñan lo mismo que la ventana fija: hay un máximo, hay un tiempo, y cuando se acaba, `429` con cuánto esperar. El comentario de `limitador.ts` lo dice en una línea.

#### 4.6.5 Recuadro de seguridad: el `429` como defensa

> **Recuadro de seguridad.** Un límite de peticiones no solo protege la capacidad. También es una defensa, porque muchos ataques necesitan muchas peticiones:
>
> - **La enumeración.** En la Lección 2 viste el enumerador que prueba `/servicios/1`, `/servicios/2`, `/servicios/3`… La puerta del `revisor` ya responde igual a lo ajeno y a lo inexistente, así que no hay nada que aprender de las respuestas. El límite agrega otra capa, por si algún día se escapa una diferencia: como cuenta por credencial y antes de buscar el servicio, también cuentan los `404`, y en 4.6.3 viste al enumerador frenado en la cuarta petición. Lo que hace que funcione es **contar por quien pregunta**; un límite por recurso no lo vería nunca, porque quien enumera pide un recurso distinto cada vez. El ejercicio 3 te lo muestra con las dos versiones.
> - **El agotamiento de recursos.** OWASP lo pone en su lista de los diez riesgos más importantes de las APIs como [API4:2023, *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption), y recomienda limitar cuántas veces puede un cliente interactuar con la API en un tiempo dado, con límites más estrictos en las operaciones caras, y fijar límites de tiempo de ejecución. El `revisor` hace las dos cosas: limita lo que sale a la red (las revisiones y la consulta en vivo), y cada consulta tiene su límite de tiempo (`limite_ms`, de 100 a 10 000), que es lo que produce el `504`.
> - **El `revisor` como arma contra otros.** Es la otra cara del SSRF de la Lección 1. La lista de destinos decide **a dónde** se conecta el `revisor`; el límite decide **cuántas veces**. Sin él, cualquiera con una credencial podría usar al `revisor` para golpear un servicio ajeno, y el servicio vería las conexiones venir del `revisor`, no de quien las pidió.
>
> **Lo que este límite no resuelve: la fuerza bruta sobre las credenciales.** Adivinar una credencial probando millones de valores es un ataque de muchas peticiones, pero el `revisor` no lo frena con su limitador, y es a propósito. Un límite por credencial no sirve contra quien todavía no tiene una, y uno por dirección de origen, en este curso, frenaría también a las matrices y a los programas de las lecciones, que corren todos desde `127.0.0.1`. La fuerza bruta se frena en otra capa: el proveedor de identidad o la pasarela que está delante de la API, con credenciales largas y al azar que no se pueden adivinar. La [hoja de recomendaciones de OWASP sobre autenticación](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) describe esa capa: un máximo de intentos fallidos, contado **por cuenta** y no solo por dirección, porque quien ataca puede cambiar de dirección. Las cuatro credenciales del `revisor` son palabras de práctica, escritas en el código para que el curso se pueda seguir; en una API real vienen de un proveedor de identidad, como dijo la Lección 2.
>
> **La clave del límite decide a quién proteges.** Por credencial, como el `revisor`, reparte la capacidad entre los clientes y no castiga a uno por lo que hizo otro. Por recurso, protege al recurso, pero cualquiera puede gastar la ventana de todos. Por dirección de origen, frena a quien no tiene credencial, pero castiga a todos los que comparten una misma salida a internet. El RFC 6585 lo deja abierto a propósito. Lo que no es opcional es que la clave salga de algo que el servidor verificó: una clave hecha con texto libre del cliente es una forma de llenarle la memoria al limitador.
>
> **Lo que todavía no es estándar.** Muchas APIs mandan, además de `Retry-After`, cabeceras que dicen cuántas peticiones quedan en la ventana. Hay un borrador de la IETF para eso, *RateLimit header fields for HTTP*, que define `RateLimit-Policy` y `RateLimit`; su versión más reciente es la 11, del 23 de mayo de 2026, y [sigue siendo un borrador](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), no un RFC. Y las APIs grandes usan sus propios nombres: la [API REST de GitHub](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), por ejemplo, responde `403` o `429` cuando se excede un límite, con sus cabeceras `x-ratelimit-remaining` y `x-ratelimit-reset`, y pide mirar primero `retry-after` si viene. Por eso el `revisor` solo manda `Retry-After`, que sí es estándar, y por eso el curso enseña las otras como lo que son: un patrón que cada API documenta, no un requisito de HTTP.

### 4.7 El `revisor` completo

#### 4.7.1 Los archivos que cambian

Copia tu carpeta de la Lección 3 como `~/curso-http/fig04_01/`. Ocho archivos son nuevos o cambian. Primero los dos nuevos:

```ts
// fig04_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
import type { ServerResponse } from "node:http";
import { enviarVacio, fallar } from "./respuestas.ts";
import { leerJson, rechazarDatos, type Contexto } from "./servicios.ts";

let enMantenimiento = false;
const VUELVE_EN_S = 120;

// Si está en mantenimiento, responde 503 y devuelve true. /mantenimiento siempre se atiende.
export function atajarPorMantenimiento(ruta: string, respuesta: ServerResponse): boolean {
  if (!enMantenimiento || ruta === "/mantenimiento") return false;
  fallar(respuesta, 503, "el revisor está en mantenimiento", { "Retry-After": String(VUELVE_EN_S) });
  return true;
}

// PUT /mantenimiento con {"activo": true} o {"activo": false}. Solo la credencial admin.
export async function cambiarMantenimiento({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  if (credencial.rol !== "admin") {
    fallar(respuesta, 403, "solo quien opera el revisor puede cambiar el mantenimiento");
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

`limitador.ts` está completo en la sección 4.6.2. Los seis que cambian, completos:

```ts
// fig04_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fallar } from "./respuestas.ts";
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
      fallar(respuesta, 500, `error interno; referencia ${referencia}`);
    } else {
      respuesta.destroy();
    }
  }
}

createServer((peticion, respuesta) => void atenderSinFiltrar(peticion, respuesta)).listen(PUERTO, "127.0.0.1", () => {
  console.log(`revisor en http://127.0.0.1:${PUERTO}`);
});
```

```ts
// fig04_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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
  // LÍMITE DECLARADO: esto NO cierra el DNS rebinding. fetch vuelve a resolver el nombre, y entre
  // esta revisión y la conexión el nombre puede apuntar a otra IP. La lección 8 lo completa:
  // se conecta a la IP ya validada, con http.request y su opción lookup.
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
// fig04_01/servicios.ts — lo que hace cada ruta de la API del revisor.
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
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

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
    fallar(respuesta, 410, `el servicio ${id} se retiró y no va a volver`);
  } else {
    fallar(respuesta, 404, `no existe el servicio ${id}`);
  }
  return undefined;
}

// 415 si el cuerpo no se declara application/json. Va aparte de leerJson porque el PUT lo pregunta
// antes que If-Match: el 415 se sabe sin procesar el contenido, y el RFC 9110 (sección 13.2.1) dice que
// las precondiciones no se evalúan si sin ellas la respuesta no habría sido 2xx ni 412.
function esJson(peticion: IncomingMessage, respuesta: ServerResponse): boolean {
  const tipo = (peticion.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    fallar(respuesta, 415, `el cuerpo debe ser application/json, no ${tipo === "" ? "(sin tipo)" : tipo}`, {
      Accept: "application/json",
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
      fallar(respuesta, 413, `el cuerpo pasa de ${TOPE_CUERPO} bytes`, { Connection: "close" });
      return undefined;
    }
    // si no, cae al 400 de abajo
  }
  fallar(respuesta, 400, "el cuerpo no es un objeto JSON");
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
  else if (typeof url === "string" && urlConSecretos(url)) fallas.push({ campo: "url", detalle: "no puede llevar usuario, clave, consulta (?) ni fragmento (#)" });
  if (limite !== undefined && (typeof limite !== "number" || !Number.isInteger(limite) || limite < 100 || limite > 10000)) {
    fallas.push({ campo: "limite_ms", detalle: "debe ser un entero entre 100 y 10000" });
  }
  if (fallas.length > 0) return fallas;
  return { nombre: nombre as string, url: url as string, limiteMs: (limite as number | undefined) ?? 2000 };
}

export function rechazarDatos(respuesta: ServerResponse, fallas: Falla[]): void {
  fallar(respuesta, 422, fallas.map((f) => `${f.campo}: ${f.detalle}`).join("\n"));
}

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, 422, `destino prohibido: ${veredicto.motivo}`);
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
    fallar(respuesta, 409, `ya existe un servicio llamado ${validos.nombre}: /servicios/${existente.id}`);
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
    fallar(respuesta, 428, "para cambiar un servicio manda If-Match con su ETag");
    return;
  }
  // If-Match se compara en fuerte (RFC 9110, secciones 13.1.1 y 8.8.3.2): una etiqueta W/ nunca coincide.
  // El detail no repite la cabecera que mandó el cliente: dice qué pasó y qué hacer.
  if (!hayCoincidencia(condicion, etiqueta(servicio), coincideFuerte)) {
    // Si solo coincide en débil, no es que el servicio haya cambiado: la etiqueta W/ no sirve para escribir.
    const detalle = hayCoincidencia(condicion, etiqueta(servicio), coincideDebil)
      ? "If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó"
      : "tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo";
    fallar(respuesta, 412, detalle);
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
    fallar(respuesta, 409, `ya existe un servicio llamado ${validos.nombre}: /servicios/${homonimo.id}`);
    return;
  }
  const cambiado = cambiarServicio(servicio.id, versionLeida, validos);
  if (cambiado === "conflicto") {
    fallar(respuesta, 412, "el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo");
    return;
  }
  if (cambiado === "retirado") {
    // Otra petición lo retiró mientras ésta esperaba: 410, como si hubiera llegado después del retiro.
    fallar(respuesta, 410, `el servicio ${servicio.id} se retiró y no va a volver`);
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
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
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
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
      fallar(respuesta, 504, `el servicio ${servicio.id} no respondió en ${servicio.limiteMs} ms`);
      return;
    case "sin-conexion":
      fallar(respuesta, 502, `no se pudo conectar con el servicio ${servicio.id}`);
      return;
    case "destino-prohibido":
      fallar(respuesta, 422, `destino prohibido: ${consulta.motivo}`);
      return;
    case "respuesta-invalida":
      fallar(respuesta, 502, `el servicio ${servicio.id} no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP`);
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

En `servicios.ts`, además de lo que ya viste (`salud`, `informe` y los límites de `pedirRevision` y `salud`), `leerJson` ahora se exporta, porque `operacion.ts` la usa para leer el cuerpo de `PUT /mantenimiento`. Todo lo demás es la Lección 3.

```ts
// fig04_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { enviarVacio, fallar } from "./respuestas.ts";
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

  // 5, 6 y 7. ¿Existe el recurso? ¿En qué formato viene? ¿Se puede leer? Lo decide cada manejador. Después, ¿se puede cumplir? (422)
  await metodo.manejador({ peticion, respuesta, parametros, credencial: identificacion.credencial });
}
```

```ts
// fig04_01/laboratorio.ts
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
// fig04_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

En `almacen.ts` hay dos cambios: `revisionesDe`, que usa `informe`, y los tres servicios de arranque nuevos al final del archivo.

#### 4.7.2 Los archivos que no cambian

Los demás son los de la Lección 3, sin un solo cambio. Van completos para que el `revisor` se pueda armar desde esta lección:

```ts
// fig04_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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
// fig04_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig04_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig04_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig04_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
import type { ServerResponse } from "node:http";
import { listarServicios, type Servicio } from "./almacen.ts";
import { enviarJson, fallar, type Cabeceras } from "./respuestas.ts";
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
  fallar(respuesta, 410, "la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios");
  return true;
}
```

```json fig04_01/package.json
{
  "type": "module"
}
```

#### 4.7.3 La corrida completa

Con el laboratorio y el `revisor` recién arrancados (sección 4.1.3), estas son todas las peticiones de la lección, en orden, con lo que respondieron. Están aquí juntas para que las compares de corrido con las tuyas:

```text
$ curl -i http://127.0.0.1:18081/basura
curl: (1) Received HTTP/0.9 when not allowed

$ curl -i -m 1 http://127.0.0.1:18081/lento/3000
curl: (28) Operation timed out after 1001 milliseconds with 0 bytes received

$ curl -i http://127.0.0.1:18081/cortar
curl: (52) Empty reply from server

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia affc3b8a-5ab9-42f5-8b37-2face1f8eafd

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia bf0e3b0a-790f-4625-80e7-017b0bcfa403

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":1,"codigo":200,"ms":8}

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":1}

$ curl -i http://127.0.0.1:18080/servicios/4/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:08 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":4,"codigo":200,"ms":1503}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms
tardó 1.004405 s

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 6 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
tardó 0.002184 s

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"colgado","url":"http://127.0.0.1:18081/cortar"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-6db25d01"
Content-Type: application/json
Content-Length: 83
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"colgado","url":"http://127.0.0.1:18081/cortar","limite_ms":2000}

$ curl -i http://127.0.0.1:18080/servicios/7/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 7 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 59
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo quien opera el revisor puede cambiar el mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i http://127.0.0.1:18080/no-existe
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
200

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/4/revisiones -H 'Authorization: Bearer admin'
202

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 58
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 consultas en vivo en el último minuto

$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ sleep 20
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 40
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":1,"detalle":"503 (reintentar en 120 s)"}}

$ curl http://127.0.0.1:18080/revisiones/4 -H 'Authorization: Bearer lectura-a'
{"id":4,"servicio":4,"estado":"terminada","resultado":{"estado":"LENTO","codigo":200,"ms":1501,"detalle":"200"}}

$ curl -i http://127.0.0.1:18080/servicios/2/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 54
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"revisiones":3,"ultimo_estado":"CAIDO"}
```

Y esto escribió la terminal del `revisor` durante toda la corrida. Fíjate en que las únicas pilas son las de los dos `500`, y en que cada una empieza con la referencia que recibió el cliente:

```text
revisor en http://127.0.0.1:18080
GET /servicios/1/informe
error affc3b8a-5ab9-42f5-8b37-2face1f8eafd en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
GET /servicios/1/informe
error bf0e3b0a-790f-4625-80e7-017b0bcfa403 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
GET /servicios/1/salud
GET /servicios/2/salud
GET /servicios/4/salud
GET /servicios/5/salud
GET /servicios/6/salud
POST /servicios
GET /servicios/7/salud
PUT /mantenimiento
PUT /mantenimiento
operación: mantenimiento encendido
GET /servicios
GET /no-existe
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/4/revisiones
GET /servicios/1/salud
POST /servicios/1/revisiones
POST /servicios/2/revisiones
POST /servicios/3/revisiones
POST /servicios/4/revisiones
POST /servicios/5/revisiones
POST /servicios/6/revisiones
POST /servicios/7/revisiones
POST /servicios/8/revisiones
POST /servicios/9/revisiones
POST /servicios/10/revisiones
POST /servicios/2/revisiones
GET /revisiones/1
GET /revisiones/4
GET /servicios/2/informe
```

#### 4.7.4 Revisar los tipos con `tsc` (opcional)

Igual que en las lecciones anteriores, los programas corren con `node archivo.ts` sin compilar nada, y `tsc` solo sirve para revisar los tipos. Desde la carpeta `fig04_01/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

No imprime nada si todo está bien. Los trece archivos de `fig04_01/`, `fig04_02.ts`, `fig04_03.ts`, las dos versiones de `defectos/` y las soluciones de `ejercicios/` pasan sin errores. Fíjate en lo que eso significa para el defecto de `informe`: pasa `tsc` en modo estricto. Los tipos dicen qué forma tienen los datos, no si existen; un `as` le quita a TypeScript la oportunidad de avisarte.

## El error que vas a ver

### La pila que viaja

Este es el `catch` que casi todo el mundo escribe la primera vez, porque es el más útil mientras programas: si algo falla, mándame todo. Para provocarlo, copia la carpeta `fig04_01/` como `rota/` y cambia en `rota/servidor.ts` la función `atenderSinFiltrar` por esta (es un fragmento; la versión completa está en `defectos/pila/servidor.ts`, que avisa en su primer renglón que no se copia):

```ts
async function atenderSinFiltrar(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    const pila = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`error en ${peticion.method} ${peticion.url}`);
    if (!respuesta.headersSent) {
      fallar(respuesta, 500, pila);
    } else {
      respuesta.destroy();
    }
  }
}
```

Arranca el laboratorio y el `revisor` desde `rota/` y pide el informe del servicio 1, que no tiene revisiones:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 865
Date: Wed, 21 Oct 2026 13:19:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:11:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:23:44)
    at Server.emit (node:events:508:28)
    at parserOnIncoming (node:_http_server:1210:12)
    at HTTPParser.parserOnHeadersComplete (node:_http_common:125:17)
```

(La carpeta de la máquina se escribe `<carpeta>`, como en la terminal del `revisor`; el `Content-Length: 865` cuenta la carpeta real, que es más larga.)

El código es correcto: `500`. Todo lo demás es un regalo para quien no debería recibirlo. Léelo como lo leería alguien que quiere atacar tu API:

- **Las rutas.** Cada marco trae la carpeta completa donde vive el programa. En un servidor real, eso dice qué usuario corre el proceso, cómo se llama el proyecto en el disco y dónde buscar si encuentra otra forma de leer archivos.
- **Los nombres internos.** `servicios.ts`, `rutas.ts`, `servidor.ts`, la función `informe`, el campo `resultado`. Es el mapa de tu código, gratis.
- **La tecnología y su versión.** `node:events:508:28` y `node:_http_server:1210:12` son marcos de Node, y sus números de renglón cambian con cada versión: quien conoce Node puede deducir cuál corres, y buscar sus vulnerabilidades conocidas.
- **Cómo provocarlo otra vez.** El mensaje dice que se leyó `resultado` sobre `undefined`. Junto con la ruta pedida, le dice a quien lo recibió exactamente qué condición rompe al servidor, y le permite repetirla cuando quiera.

Y mira la terminal del `revisor` en esta versión:

```text
revisor en http://127.0.0.1:18080
GET /servicios/1/informe
error en GET /servicios/1/informe
```

Una línea, sin referencia y sin pila. Este `catch` le dio todo al cliente y casi nada a quien opera. Si el cliente no reporta el cuerpo que recibió, nadie del lado del servidor sabe qué pasó. Es el error al revés, completo: la información está del lado equivocado.

El arreglo es el `atenderSinFiltrar` de `fig04_01/`: la pila va a la terminal, recortada a los marcos del curso, y al cliente solo le llega la referencia. Si estás pensando «pero en desarrollo me sirve ver la pila en la respuesta», la respuesta es que la tienes en la terminal, a un lado, con la misma información; y que un `catch` que se comporta distinto en desarrollo y en producción es un `catch` cuya versión de producción nunca probaste. Detén los programas de `rota/` cuando termines.

### Todo es `500`

El segundo error es más sutil, porque la respuesta es impecable en la forma y falsa en el fondo. Copia otra vez `fig04_01/` como `rota2/` y cambia en `rota2/servicios.ts` la función `salud` por esta, que consulta con `fetch` directamente, sin pasar por `consultar` (la versión completa está en `defectos/sin-pasarela/servicios.ts`, con el mismo aviso en su primer renglón):

```ts
export async function salud({ respuesta, parametros, credencial }: Contexto): Promise<void> {
  // La consulta en vivo también sale a la red, igual que una revisión: sin límite, el revisor serviría
  // para golpear un servicio ajeno a través de él. Cuenta por credencial, antes de buscar el servicio,
  // en una ventana aparte de la de las revisiones.
  const decision = permitir(`salud:${credencial.nombre}`, CONSULTAS_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
    });
    return;
  }
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // DEFECTO A PROPÓSITO: llama a fetch directo y no clasifica lo que puede salir mal. Si el servicio
  // no responde a tiempo o no responde HTTP, fetch lanza, y la excepción llega a servidor.ts.
  const veredicto = await revisarDestino(servicio.url);
  if (!veredicto.permitido) {
    fallar(respuesta, 422, `destino prohibido: ${veredicto.motivo}`);
    return;
  }
  const inicio = performance.now();
  const contestacion = await fetch(servicio.url, { redirect: "manual", signal: AbortSignal.timeout(servicio.limiteMs) });
  await contestacion.body?.cancel();
  enviarJson(respuesta, 200, { servicio: servicio.id, codigo: contestacion.status, ms: Math.round(performance.now() - inicio) });
}
```

Se lee bien, y hace lo correcto cuando el servicio responde. Arranca el laboratorio y el `revisor` desde `rota2/` y pide la salud de los servicios 2, 5 y 6:

```text
$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 36
Date: Wed, 21 Oct 2026 13:19:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":20}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia 53423d0e-11e2-4ce0-befe-6f701044a854
tardó 1.002529 s

$ curl -i http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia 3ec30ef1-4589-44c0-a95c-00c1195b86d9
```

El servicio 2 sale igual que antes, `200` con su `503` adentro. Pero el 5, que no respondió a tiempo, y el 6, que respondió basura, salen los dos como `500`, con referencia y sin pila. La red de `servidor.ts` hizo bien su trabajo: atrapó una excepción que nadie esperaba, no contó nada y dejó el hilo en la terminal:

```text
revisor en http://127.0.0.1:18080
GET /servicios/2/salud
GET /servicios/5/salud
error 53423d0e-11e2-4ce0-befe-6f701044a854 en GET /servicios/5/salud: TimeoutError: The operation was aborted due to timeout
GET /servicios/6/salud
error 3ec30ef1-4589-44c0-a95c-00c1195b86d9 en GET /servicios/6/salud: TypeError: fetch failed
```

El problema es que **sí se esperaba**. Que un servicio ajeno no conteste a tiempo, o conteste basura, es lo más normal del mundo para un programa cuyo trabajo es consultar servicios ajenos. Responder `500` le dice a quien opera «tu código tiene un error», y lo manda a buscar en `servicios.ts` un defecto que no existe, mientras el problema real está en el servicio de reportes y en el de facturación. Es exactamente la confusión de las 19:20 de la escena del principio. Y fíjate en la segunda línea de error: `TypeError: fetch failed`, sin un solo marco del curso. La pila de `fetch` vive entera dentro de Node, y `pilaDelCurso` la recortó toda. Ni siquiera la terminal dice dónde pasó.

El arreglo es el `salud` de `fig04_01/`: preguntarle a `consultar`, que convierte cada forma de fallar en un desenlace con nombre, y elegir un código para cada uno. **Lo que se puede prever no se deja llegar a la red del `500`**: la red es para lo que de verdad nadie previó. Detén los programas de `rota2/` cuando termines.

## Lo que se hace mal

**`500` para todo lo que sale mal.** Es el error que esta lección existe para evitar. Un `500` por una dependencia lenta, por un mantenimiento o por un límite de peticiones manda a quien opera a buscar en su propio código, y le dice al cliente «no sé qué pasó» cuando sí se sabía.

**La pila, el SQL o el mensaje de la excepción en el cuerpo.** El primero es el error de «La pila que viaja». El último es el que más se escapa, porque parece inofensivo: el texto de una excepción lo escribe quien la lanzó, y puede traer una consulta, una ruta o una dirección interna.

**Un `500` sin nada que permita encontrarlo.** El contrario del anterior: callar todo, incluso del lado de quien opera. Un `500` sin referencia, en un servidor que atiende miles de peticiones por minuto, no se puede asociar con ningún renglón de la bitácora.

**Un `503` sin `Retry-After`, o con uno inventado.** El RFC no obliga a mandarlo, pero un `503` sin él deja al cliente adivinando cuánto esperar, y cada cliente adivina distinto. Y un `Retry-After: 1` puesto «por si acaso» en un mantenimiento de dos horas hace que todos los clientes vuelvan cada segundo, que es lo contrario de lo que querías.

**Un `503` permanente.** El `503` promete que es temporal. Para algo que se retiró para siempre, el código es `410` (Lección 3); para algo que no existe, `404`.

**Responder con el código del servicio de atrás.** Si el servicio de pagos responde `503` y tu consulta de salud responde `503`, cualquier máquina del camino concluye que el caído eres tú. La consulta funcionó: es un `200` con el `503` adentro, como en 4.4.3. Y al revés, si tu API usa otro servicio para atender, un `404` de ese servicio no es un `404` tuyo: no le reenvíes al cliente los códigos de otro.

**Un `429` sin `Retry-After`, o un límite que nadie documentó.** El cliente que recibe un `429` sin saber cuánto esperar reintenta de inmediato, y vuelve a recibir `429`. El RFC 6585 deja abiertos el cuánto, el cada cuánto y el por quién; dejarlos también sin documentar convierte el límite en un misterio que cada cliente descubre a golpes.

**`429` para una saturación que no causó ese cliente.** Si el servidor está saturado por todos, el código es `503`. El `429` acusa a un cliente concreto de pasarse de la raya.

**Un límite cuya clave sale de texto libre del cliente.** Limitar por un identificador que el cliente puede inventar sin costo (un id que no existe, una cabecera que nadie verificó) le da a cualquiera una forma de crear claves sin fin y llenar la memoria del limitador.

**Esperar a una dependencia sin límite de tiempo.** Sin `AbortSignal.timeout`, una consulta a un servicio colgado espera para siempre, y cada petición que llega mientras tanto ocupa una conexión más. Sin límite de tiempo no hay `504`: hay un servidor que se va quedando sin recursos.

## Ejercicios

Los cuatro se corrigen solos: cada uno termina con una corrida que te dice si acertaste. Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada. Para el 1, el 3 y el 4 necesitas el laboratorio y el `revisor` de 4.7 corriendo, recién arrancados.

### Ejercicio 1 — ¿Quién tiene la culpa?

Predice el código de cada una de estas seis peticiones y, para cada una, quién tiene la culpa y quién puede arreglarlo. Cuidado: no todas son errores del servidor.

```bash
curl -i http://127.0.0.1:18080/servicios/3/salud -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/4/informe -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer escritura-a'
curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":"si"}'
```

Después córrelas y compara.

### Ejercicio 2 — Un `Retry-After` que no es válido

En 4.5.3 viste que `segundosDeEspera` no usa `Date.parse`. Este ejercicio te muestra por qué. Escribe una versión ingenua, `segundosConDateParse`, que acepte los dígitos y le pase todo lo demás a `Date.parse`, y compárala con la del `revisor` en un programa (`ejercicios/ej2.ts`) con estos nueve valores:

- `"120"`, `"1.5"`, `"-1"` y `"12 30"`
- `"Xyz, 21 Oct 2026 10:00:00 GMT"` y `"Wed, 32 Oct 2026 10:00:00 GMT"`
- la misma fecha, un minuto en el futuro, en las tres formas de HTTP-date: la preferida, la del RFC 850 y la de `asctime`

Antes de correr nada, decide cuáles son valores válidos de `Retry-After` según la gramática del RFC 9110, y predice qué devuelve cada versión con cada uno. Pista: la gramática del RFC enumera los días y los meses, y dice que una fecha HTTP siempre está en GMT; `Date.parse` no sabe nada de eso.

### Ejercicio 3 — El enumerador contra el límite

Con el laboratorio y el `revisor` de 4.7 recién arrancados, predice qué códigos recibe `escritura-b` al pedir revisiones de los ids 1 a 10, uno tras otro. Después, `escritura-a` pide tres revisiones del servicio 2, y enseguida `admin` pide una del mismo servicio: ¿qué recibe `admin`?

```bash
for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
```

Ahora haz una copia de `fig04_01/` y cambia en su `servicios.ts` el límite de `pedirRevision` por el que parece más natural: **por servicio** (la clave `revisiones:` más el id del servicio) y **después** de `encontrar`. No toques tu `fig04_01/`, que es el `revisor` que recibe la Lección 5. Arranca la copia, repite las mismas peticiones y predice otra vez. ¿Cuál de las dos versiones frena al enumerador? ¿Cuál castiga a `admin` por lo que hizo `escritura-a`?

### Ejercicio 4 — Sin laboratorio

Detén el laboratorio (`Ctrl+C` en su terminal) y deja el `revisor` corriendo. Predice qué responden estas peticiones, y cuánto tarda la segunda:

```bash
curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
sleep 2
curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
```

El servicio 5 daba `504` en 4.4.3. ¿Sigue dando `504`?

## Soluciones

### Solución 1

```text
$ curl -i http://127.0.0.1:18080/servicios/3/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/servicios/4/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia d88e2544-137d-436f-b5d2-c206d50ca348

$ curl -i -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":5}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":"si"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

activo: debe ser true o false
```

En orden:

- **`404`**: el servicio 3 es del equipo b, y para `lectura-a` no existe. Es un error del cliente, el mismo de la Lección 2, y la consulta de salud nunca salió a la red. Culpa y arreglo: del cliente.
- **`500`**: el servicio 4 (`inventario`) no tiene revisiones terminadas, y `informe` revienta, igual que con el 1. Culpa: el código del `revisor`. Arreglo: quien lo opera, corrigiendo `informe` (la referencia de la respuesta lleva a la pila en la terminal).
- **`403`**: pedir una revisión es escribir, y `lectura-a` solo lee. No es un `429`: la pregunta 4 de la puerta se contesta antes que el límite, que vive dentro del manejador. Culpa y arreglo: del cliente, o de quien le dio esa credencial.
- **`504`**: `reportes` no responde en 1000 ms. Culpa: el servicio de reportes. Arreglo: quien lo opera. El `revisor` no tiene nada que corregir.
- **`200`**: `pagos` respondió `503`, y el `revisor` lo informó con éxito. Nadie se equivocó con esta petición; la mala noticia es el dato que trae.
- **`422`**: `"si"` no es un booleano. El `admin` pasó la puerta y el chequeo de rol, y el cuerpo se pudo leer, pero no se puede cumplir: es la política `400`/`422` de la Lección 3. Culpa y arreglo: del cliente.

Solo dos de las seis son errores del servidor, y son de dos servidores distintos. Si fallaste la tercera, repasa el orden: el permiso del rol se pregunta en la puerta, y el límite, dentro del manejador.

### Solución 2

Solo `"120"` es un `delay-seconds` válido (`1*DIGIT`). `"1.5"`, `"-1"` y `"12 30"` no son ni segundos ni una fecha HTTP. `"Xyz, …"` tiene la forma de la fecha preferida, pero `Xyz` no es un día: el RFC enumera los siete. `"Wed, 32 Oct …"` tiene la forma correcta, pero el 32 de octubre no existe. Las tres últimas son válidas: la preferida y las dos obsoletas que quien lee **debe** aceptar (sección 5.6.7). Una función correcta devuelve `120`, cinco `null` y unos `60` segundos tres veces. Este programa compara las dos:

```ts
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
```

```text
$ node ejercicios/ej2.ts
valor                                Date.parse  revisor
"120"                                       120      120
"1.5"                                         0     null
"-1"                                          0     null
"12 30"                                       0     null
"Xyz, 21 Oct 2026 10:00:00 GMT"               0     null
"Wed, 32 Oct 2026 10:00:00 GMT"            null     null
"Wed, 21 Oct 2026 13:20:57 GMT"              61       61
"Wednesday, 21-Oct-26 13:20:57 GMT"          61       61
"Wed Oct 21 13:20:57 2026"                21661       61
```

(Las tres fechas válidas dan `61` y no `60` porque el programa redondea «dentro de un minuto» al segundo siguiente, y `segundosDeEspera` redondea hacia arriba.)

La columna del `revisor` es la correcta en los nueve renglones. La de `Date.parse` tiene dos clases de errores.

**Acepta lo que no es una fecha.** Con `"1.5"`, `"-1"`, `"12 30"` y `"Xyz, …"`, la versión ingenua devuelve **`0`**, «puedes intentar ya». No son dígitos, así que los intenta leer como fecha, y `Date.parse` de V8 es tan permisivo que los acepta: `"1.5"` lo lee como una fecha de 2001, y en `"Xyz, …"` ni siquiera mira el nombre del día. Como esas fechas ya pasaron, el resultado es `0`. Un servidor que manda un `Retry-After` mal escrito obtiene lo contrario de lo que quería: un cliente que insiste de inmediato. La versión del `revisor` devuelve `null`, que es lo honesto: «no me dijeron cuánto esperar». (Con `"Wed, 32 Oct …"`, en cambio, `Date.parse` sí se negó; `Date.UTC`, que usa `fechaHttp`, lo habría aceptado, y por eso `fechaHttp` comprueba la fecha al final.)

**Lee `asctime` en la hora local.** Con la fecha `asctime`, la versión ingenua devuelve **`21661`**, unas seis horas, y la del `revisor`, `61`. El formato `asctime` no escribe la zona horaria, y el RFC dice que es GMT; `Date.parse` la lee como hora **local**. Esta corrida se hizo en una máquina en UTC−6, así que la fecha quedó seis horas en el futuro. En una máquina en UTC, las dos columnas darían lo mismo: es una falla que depende de dónde corre el programa, el peor tipo de falla, porque no se ve en la máquina de quien la escribió.

La lección para tu propio código: **lee una cabecera con su gramática, no con la función más cercana que «parece funcionar»**. `Date.parse` sirve para leer una fecha que ya sabes que es una fecha, y en la zona que ya sabes que tiene.

### Solución 3

Con el `revisor` de `fig04_01/`:

```text
$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
HTTP/1.1 202 Accepted
Location: /revisiones/5
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:19:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":5,"servicio":2,"estado":"pendiente","resultado":null}
```

El enumerador recibe `404 404 202` y después `429` siete veces: las tres primeras peticiones llenaron su ventana, aunque dos fueran `404`, porque el límite se pregunta antes de buscar el servicio y cuenta por credencial. Y `admin` recibe `202`: lo que gastó `escritura-a` no lo paga otra credencial.

Con la copia, en la que el límite cuenta por servicio y se pregunta después de `encontrar` (el archivo completo está en `ejercicios/ej3/servicios.ts`):

```ts
export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // Ejercicio 3: el límite como estaba antes, por servicio y después de encontrar. NO es el del revisor.
  const decision = permitir(`revisiones:${servicio.id}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones de este servicio en el último minuto`, {
      "Retry-After": String(decision.esperaS),
    });
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}
```

```text
$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 404 404 404 404 404 404 404 

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 62
Date: Wed, 21 Oct 2026 13:19:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones de este servicio en el último minuto
```

Los dos resultados se invierten. El enumerador recorre los diez ids sin un solo `429`: cada `404` sale de `encontrar` antes de tocar el limitador, y el único que lo toca es el 3, una vez. Con cien mil ids sería igual. Y `admin` recibe `429` con `Retry-After: 60`, por tres revisiones que pidió otra persona: el código lo acusa de un ritmo que no fue suyo. La versión «natural» tiene los dos defectos a la vez, y por eso el `revisor` no la usa. Detén la copia cuando termines.

### Solución 4

```text
$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no se pudo conectar con el servicio 1

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no se pudo conectar con el servicio 5
tardó 0.001450 s

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
202

$ sleep 2
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":1,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":null,"ms":null,"detalle":"sin conexión"}}
```

Los dos son `502`, «no se pudo conectar»: con el laboratorio detenido, nadie escucha en el puerto 18081, la conexión se rechaza (`ECONNREFUSED`) y `consultar` lo clasifica como `sin-conexion`. **El servicio 5 ya no da `504`**: da `502`, y en menos de 2 milisegundos (`0.001450 s`), no en 1000. El `504` necesita que alguien acepte la conexión y no conteste; aquí nadie la aceptó, y el intento terminó al instante. El mismo servicio, con el mismo límite, puede producir dos códigos distintos según **cómo** falla lo que está detrás. Y la revisión pedida con el laboratorio caído quedó `CAIDO` con `"detalle":"sin conexión"`, sin código y sin milisegundos: no hubo respuesta, y el resultado no inventa una. Vuelve a arrancar el laboratorio cuando termines.

## Cómo sé que lo logré

- [ ] Para cada uno de los cinco códigos de la lección, dices de memoria quién tiene la culpa, quién puede arreglarlo y qué hace el cliente.
- [ ] `curl -i` a `/servicios/1/informe`, recién arrancado el `revisor`, da `500` con `error interno; referencia <uuid>`, y encuentras esa referencia en la terminal, con la pila que empieza en `servicios.ts`.
- [ ] `/servicios/2/salud` da `200` con `"codigo":503`, y explicas por qué no es un `503`.
- [ ] `/servicios/5/salud` da `504` en un poco más de un segundo, y `/servicios/6/salud` da `502` casi al instante.
- [ ] Con el modo mantenimiento encendido por `admin`, cualquier petición, incluso a una ruta que no existe y sin credencial, da `503` con `Retry-After: 120`; y `PUT /mantenimiento` con `escritura-a` da `403`.
- [ ] La cuarta revisión pedida con la misma credencial en un minuto da `429` con `Retry-After: 60`, y veinte segundos después, con un `Retry-After` menor; una revisión con otra credencial sigue dando `202`.
- [ ] `escritura-b` pidiendo revisiones de los ids 1 a 10 recibe `404 404 202` y después `429`, y explicas por qué un límite por servicio no lo frenaría.
- [ ] Explicas, con la corrida de `fig04_02.ts`, por qué una ventana fija de 3 por segundo deja pasar 5 en menos de 70 ms.
- [ ] Explicas qué revela una pila en el cuerpo de un `500`, con la corrida de `defectos/pila/`.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/` y `curl -i http://127.0.0.1:18081/codigo/200` dan los dos el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Qué dos preguntas hay que contestar ante cualquier falla, y qué contestan el `429`, el `500`, el `502`, el `503` y el `504`?
2. ¿Por qué el `429` es un `4xx`, si habla de capacidad? ¿Y por qué el `503` es un `5xx`, si el servidor funciona?
3. ¿Qué condición comparten el `502` y el `504` en el RFC 9110, y qué los separa?
4. ¿Por qué la consulta de salud de un servicio que responde `503` es un `200`?
5. ¿Cuáles son las dos formas de `Retry-After`, y por qué `1.5` no es un valor válido?
6. ¿Qué va en el cuerpo de un `500`, qué va en la terminal, y qué los une?
7. ¿Por qué el límite de revisiones cuenta por credencial y se pregunta antes de `encontrar`? ¿Qué pasaría con un límite por servicio?
8. ¿Qué defecto tiene la ventana fija, y qué algoritmos lo evitan?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [RFC 9110, *HTTP Semantics*, sección 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6): la familia `5xx`, «el servidor sabe que se equivocó o no es capaz», y la explicación de si la condición es temporal o permanente.
2. [RFC 9110, sección 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1): el `500`, una condición inesperada que impidió cumplir la petición.
3. [RFC 9110, sección 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3): el `502`, una respuesta inválida recibida mientras se actuaba como pasarela o proxy; y la [sección 3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.7): qué es una pasarela y qué es un proxy, y los términos *inbound* y *upstream*.
4. [RFC 9110, sección 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4): el `503`, sobrecarga temporal o mantenimiento programado, `Retry-After` opcional, y la nota de que un servidor saturado puede simplemente rechazar la conexión.
5. [RFC 9110, sección 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5): el `504`, una respuesta que no llegó a tiempo mientras se actuaba como pasarela o proxy.
6. [RFC 9110, sección 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): `Retry-After = HTTP-date / delay-seconds`, `delay-seconds = 1*DIGIT`, y su sentido con un `503`; y la [sección 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7): los tres formatos de la fecha HTTP, que quien lee debe aceptar.
7. [RFC 6585, *Additional HTTP Status Codes*, sección 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4): el `429`, «demasiadas peticiones en un tiempo dado», `Retry-After` opcional, la libertad para identificar al usuario y contar, y la prohibición de guardarlo en una caché; y la [sección 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2): contestar `429` bajo ataque también gasta recursos, y no es obligatorio.
8. [MITRE, CWE-209, *Generation of Error Message Containing Sensitive Information*](https://cwe.mitre.org/data/definitions/209.html): las pilas, las rutas y la estructura de las consultas en un mensaje de error como debilidad.
9. [OWASP, *Error Handling Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html): el detalle del error se registra del lado del servidor y al usuario se le responde un mensaje genérico; y la [*Logging Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): los tokens de acceso y los datos sensibles no se registran tal cual.
10. [OWASP API Security Top 10, API4:2023 *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption): limitar cuántas veces interactúa un cliente con la API en un tiempo dado, y fijar límites de tiempo de ejecución.
11. [OWASP, *Authentication Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), sección *Protect Against Automated Attacks*: el límite de intentos contra la fuerza bruta, contado por cuenta y no solo por dirección de origen.
12. [IETF, *RateLimit header fields for HTTP*, `draft-ietf-httpapi-ratelimit-headers-11`](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) (23 de mayo de 2026): define `RateLimit-Policy` y `RateLimit`; es un borrador, no un RFC.
13. [Documentación de la API REST de GitHub, *Rate limits for the REST API*](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api): `403` o `429` al exceder un límite, `retry-after`, `x-ratelimit-remaining` y `x-ratelimit-reset`.
14. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static): la señal aborta con un `DOMException` de nombre `TimeoutError`, distinto del `AbortError`; y [Node.js 24: `crypto.randomUUID()`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandomuuidoptions): un UUID de versión 4 generado con un generador criptográfico.
15. [Manual de `curl`](https://curl.se/docs/manpage.html): `-m` (`--max-time`), `--http0.9` y los códigos de salida 1 (protocolo no soportado), 7 (no se pudo conectar), 18 (transferencia incompleta), 28 (se acabó el tiempo) y 52 (el servidor no contestó nada).

### Términos de esta lección

| | |
|---|---|
| **pasarela** (*gateway*) | un servidor que, para contestar, le pide algo a otro servidor y responde con lo que obtuvo; si el otro falla, responde `502` o `504` |
| **dependencia** | un servicio del que otro necesita una respuesta para hacer su trabajo |
| **referencia** | un identificador al azar que viaja en el `500` y queda en la bitácora junto a la pila, para encontrar un error sin revelar nada |
| **pila de llamadas** (*stack trace*) | la lista de funciones que se estaban ejecutando cuando ocurrió un error, de la más reciente a la más antigua |
| **bitácora** | lo que el servidor escribe para quien lo opera; en el `revisor`, su terminal |
| **límite de peticiones** (*rate limiting*) | cuántas peticiones se aceptan en un tiempo dado; al pasarse, `429` |
| **ventana fija** | un límite que cuenta desde el inicio de una ventana y vuelve a cero cuando la ventana termina |
| **modo mantenimiento** | un estado en el que el servidor decide no atender y responde `503` con `Retry-After` |
| **`Retry-After`** | la cabecera que dice cuánto esperar antes de volver a pedir: segundos o una fecha HTTP |

---

**Anterior:** [Lección 3 — El cliente se equivocó (II): 409, 410, 412, 422 y 428](03-errores-del-cliente-estado.md) · **Siguiente:** [Lección 5 — Problem Details (RFC 9457)](05-problem-details.md)

# Lección 3 — El cliente se equivocó (II): 409, 410, 412, 422 y 428

Son las 17:40 de un viernes y Ana, del equipo de pagos, acaba de mudar el servicio de cobros a su nueva dirección. La vieja se apaga a las 18:00. Abre la ficha del servicio en el `revisor`, cambia la URL, guarda y recibe `200 OK`. Se va tranquila. Lo que no sabe es que Beto, de su mismo equipo, abrió esa misma ficha a las 17:30 para subir el tiempo límite de 2 a 3 segundos, se levantó por un café y volvió a las 17:45. Beto cambia el límite, guarda y también recibe `200 OK`. Pero lo que Beto guardó fue **su copia completa**, la de las 17:30, que todavía traía la dirección vieja. A las 18:00 la dirección vieja se apaga, el `revisor` la consulta, recibe un error de conexión y marca el servicio de cobros como `CAIDO` toda la noche. El servicio nuevo funciona perfecto; nadie lo está vigilando. Y ninguna de las dos personas recibió un error: las dos vieron un `200`.

A eso se le llama **actualización perdida**, y esta lección la evita con una etiqueta y una cabecera. De paso le pone nombre a las otras cuatro formas en que una petición bien formada todavía no se puede cumplir.

**Tiempo:** 2 × 45 min (el corte está entre las secciones 3.4 y 3.5)

**Qué construyes:** el cambio de un servicio (`PUT /servicios/{id}`) que no pisa el cambio de otra persona; la validación que separa lo que no se puede leer de lo que no se puede cumplir; el recuerdo de los servicios retirados; y la versión anterior de la API, que avisa que se va antes de irse

**Qué aprendes:** a distinguir un **conflicto de estado** (`409`), una **regla de negocio** que los datos no cumplen (`422`) y una **precondición** que falló (`412`); qué es la actualización perdida y cómo `ETag` con `If-Match` la evita, también cuando dos peticiones llegan a la vez; `412` frente a `428`; `410` frente a `404`; la política escrita del curso para `400` frente a `422`; y cómo se anuncia el retiro de una versión de la API con `Deprecation` y `Sunset` antes de que llegue el `410`

**De dónde vienes.** De la [Lección 2](02-errores-del-cliente-peticion.md), con un `revisor` que tiene puerta: sabe quién le habla, qué puede hacer cada credencial, qué ruta y qué método existen, y en qué formato acepta el cuerpo. Ese `revisor` todavía no permite **cambiar** un servicio: solo darlo de alta, consultarlo, retirarlo y revisarlo. Responde `400` a todo lo que no le sirve del cuerpo, sea porque no se puede leer o porque se lee y no tiene sentido. Y cuando retiras un servicio, su identificador queda en `404`, como si nunca hubiera existido.

**Qué no hace esta lección.** No enseña `PATCH`: el `revisor` cambia un servicio entero con `PUT`, y un `PATCH` sigue respondiendo `405`. No enseña la cabecera `If-Unmodified-Since`, la hermana de `If-Match` que compara fechas en vez de etiquetas; el curso usa solo etiquetas, porque las fechas HTTP tienen una resolución de un segundo y dos cambios en el mismo segundo serían indistinguibles. Y los cuerpos de error siguen siendo una línea de texto; la [Lección 5](05-problem-details.md) los convierte en `application/problem+json`, y ahí la lista de fallas del `422` se vuelve un arreglo que un programa puede recorrer.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS con Node 24.14.1 y curl 8.7.1, y ninguna depende de algo propio de macOS. En tu corrida van a cambiar la fecha de la cabecera `Date` y **las ocho cifras finales de cada `ETag`** (`"1-1-c6e922ee"` en la corrida principal de la lección): el `revisor` las sortea cada vez que arranca, así que las tuyas serán otras y cambiarán cada vez que lo reinicies. Cuando un comando necesite una etiqueta, copia la que te salió a ti en la respuesta anterior, o guárdala en una variable como lo hace la lección con `ETAG=$(…)`. El `revisor` guarda todo en memoria, así que cada respuesta depende de lo que hicieron las peticiones anteriores. Por eso las corridas de la lección están agrupadas en **series**, y el texto marca dónde empieza cada una: la serie A es la principal, del `revisor` de `fig03_01/` recién arrancado, y va de la sección 3.2.3 al final de la 3.8 sin reiniciar; las otras (el programa de los dos editores, cada versión rota y los ejercicios) son cortas y empiezan cada una con un `revisor` recién arrancado. Para obtener lo mismo que la lección, arranca de nuevo el `revisor` donde empieza cada serie, y no lo reinicies a mitad de una. Los programas están en [`programas/03-errores-del-cliente-estado/`](../programas/03-errores-del-cliente-estado), en el repositorio del curso: el `revisor` en `fig03_01/`, los dos editores en `fig03_02.ts`, el lector de avisos en `fig03_03.ts`, las versiones rotas de «El error que vas a ver» en `defectos/`, y cada corrida en su archivo `.salida.txt`. Todos pasan `tsc` en modo estricto con el mismo comando de la sección 1.11 de la Lección 1.

## Al terminar vas a poder

- Clasificar una petición que falla como conflicto de estado, regla de negocio o precondición, y responder `409`, `422` o `412` según la pregunta que la decide.
- Provocar una actualización perdida con dos editores y demostrar con una corrida que `If-Match` la convierte en un `412`.
- Provocar la misma pérdida con dos peticiones simultáneas que sí mandan `If-Match`, y explicar por qué la versión se compara otra vez en el mismo paso en que se escribe, como un `UPDATE … WHERE version = N`.
- Explicar por qué `If-Match` se compara en fuerte, qué pasa con una etiqueta `W/`, con una lista y con `*`, y citar la sección del RFC 9110 que lo exige.
- Distinguir `412` de `428` y decir qué tiene que hacer el cliente en cada caso.
- Responder `410` a un recurso que se retiró a propósito y `404` a uno que nunca existió, sin delatarle a otro equipo qué existió.
- Anunciar el retiro de una versión de la API con `Deprecation`, `Sunset` y `Link`, y comprobar con un programa que la fecha de `Sunset` no es anterior a la de `Deprecation`.

## El porqué antes del cómo

En la Lección 2 todas las fallas se podían descubrir mirando **la petición sola**: la ruta, el método, la credencial, el tipo del cuerpo. Si estaban mal, estaban mal en cualquier momento y contra cualquier servidor. Las fallas de esta lección son distintas: la petición está bien escrita, se lee completa, y aun así no se puede cumplir. Para saberlo, el servidor tiene que mirar **algo más que la petición**: el estado actual del recurso, las reglas del negocio, o lo que el cliente creía cuando la escribió.

Por eso los cinco códigos de esta lección responden preguntas que en la Lección 2 no existían:

| Pregunta | Si la respuesta es «no»… | Código | Qué tiene que hacer quien pidió |
|---|---|---|---|
| ¿Los datos tienen sentido, cada uno por sí solo? | se leyó, pero algún valor es imposible | `422` | corregir esos valores |
| ¿Caben con lo que ya hay? | chocan con el estado actual del servidor (por ejemplo, otro servicio ya usa ese nombre) | `409` | resolver el choque y volver a mandar |
| ¿El recurso está como el cliente creía? | cambió desde que lo leyó | `412` | volver a leer, rehacer su cambio, mandar otra vez |
| ¿El cliente dijo qué versión creía tener? | no lo dijo, y el servidor lo exige | `428` | leer, y mandar la etiqueta |
| ¿El recurso sigue ahí? | se retiró a propósito y no va a volver | `410` | dejar de pedirlo y borrar el enlace |

Cada renglón es otra vez una acción distinta para quien recibe el error, y casi siempre ese alguien es un programa. Un `422` dice «tus datos están mal; arréglalos». Un `409` dice «tus datos están bien, pero chocan con algo que ya existe». Un `412` dice «tus datos pueden estar bien, pero los escribiste pensando en una versión que ya no existe». Si el `revisor` respondiera los tres con `400`, el programa de Beto no tendría cómo saber que lo que debía hacer era **volver a leer**, que es justo lo único que habría salvado el cambio de Ana.

La lección tiene cuatro partes:

1. **Tres preguntas que se confunden** (3.1): conflicto de estado, regla de negocio y precondición.
2. **La actualización perdida** (3.2 a 3.4): provocarla en rojo, evitarla en verde con `ETag` e `If-Match` (`412`), cerrar la carrera de dos peticiones a la vez comparando en el mismo paso en que se escribe, y exigir la condición (`428`).
3. **Conflicto, regla y recurso que se fue** (3.5 a 3.7): `409`, la política de `400` frente a `422`, y `410` frente a `404`.
4. **Versiones de la API y el `revisor` completo** (3.8 y 3.9): `Deprecation`, `Sunset` y el `410` anunciado; los archivos y la corrida.

## Los conceptos

### 3.1 Conflicto de estado, regla de negocio y precondición

#### 3.1.1 Tres fallas que parecen la misma

Imagina tres peticiones del equipo `a` que el `revisor` rechaza. Las tres son JSON válido, las tres llegan con una credencial de escritura y las tres van a una ruta que existe:

- Un alta con `{"nombre":"","url":"ftp://archivos","limite_ms":5}`.
- Un alta con `{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}`, cuando el equipo `a` ya tiene un servicio llamado `pagos`.
- Un cambio del servicio 1 hecho a partir de una copia que se leyó hace diez minutos, cuando alguien más ya lo cambió.

Si le preguntas a alguien que empieza qué tienen en común, va a decir «son errores de validación», y va a responder `400` a las tres. Pero mira qué tendría que hacer quien las mandó para que la siguiente funcione:

- En la primera, **corregir los datos**. No importa cuántas veces la repita, ni qué pase en el servidor mientras tanto: un nombre vacío nunca va a ser válido. La falla está **dentro** de la petición.
- En la segunda, **los datos están bien**. Un nombre `pagos` es perfectamente válido; el problema es que ya hay otro. Si mañana alguien retira el servicio `pagos` del equipo a, esta misma petición, sin cambiar un byte, va a funcionar. La falla está en el **choque** entre la petición y el estado actual del servidor.
- En la tercera, puede que los datos estén bien **y** que no choquen con nada. El problema es otro: quien la mandó escribió su cambio sobre una versión del servicio que ya no existe. Si el servidor la aceptara, borraría el cambio de otra persona sin que nadie se enterara. La falla está en una **suposición** del cliente que dejó de ser cierta.

Son tres fallas distintas, y HTTP tiene un código para cada una:

| Falla | Dónde está el problema | Código | Sección |
|---|---|---|---|
| **Regla de negocio**: los datos no se pueden cumplir | dentro de la petición | `422 Unprocessable Content` | RFC 9110, 15.5.21 |
| **Conflicto de estado**: los datos chocan con lo que ya hay | entre la petición y el estado actual | `409 Conflict` | RFC 9110, 15.5.10 |
| **Precondición**: el cliente suponía un estado que ya no es | en lo que el cliente creía | `412 Precondition Failed` | RFC 9110, 15.5.13 |

#### 3.1.2 Lo que dice la especificación de cada uno

Las definiciones del [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) son cortas, y vale la pena leerlas con cuidado porque cada una trae la pregunta que la decide.

El **`422`** ([sección 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21)) dice que el servidor **entiende el tipo de contenido** (por eso no es `415`), que **la sintaxis es correcta** (por eso no es `400`), pero que no pudo procesar las instrucciones que trae. El ejemplo de la especificación es un XML bien formado con instrucciones que no tienen sentido. La pregunta que lo decide es: **¿lo pude leer, pero lo que dice es imposible?**

El **`409`** ([sección 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10)) dice que la petición no se pudo completar por un **conflicto con el estado actual** del recurso, y que se usa cuando el usuario **podría resolver el conflicto y volver a mandar** la petición. Añade un **debería**: el servidor debería responder con información suficiente para que el usuario reconozca de dónde viene el conflicto. La pregunta que lo decide es: **¿esto sería válido si el servidor estuviera en otro estado?**

El **`412`** ([sección 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13)) dice que **una o más condiciones que venían en las cabeceras** de la petición resultaron falsas al evaluarlas en el servidor, y que existe para que el cliente pueda impedir que el método se aplique si el recurso está en un estado inesperado. La pregunta que lo decide es: **¿el cliente puso una condición, y no se cumplió?**

Fíjate en la última frase: el `412` solo existe si **el cliente** puso una condición. El servidor no inventa precondiciones; las evalúa. Esa es la diferencia más fina de la lección, y vuelve en la sección 3.5.

#### 3.1.3 En qué orden se preguntan

La puerta de la Lección 2 tenía siete preguntas: ruta, método, credencial, permiso, existencia, formato y lectura. Esta lección agrega preguntas entre ellas y **después** de ellas, y su orden también importa. Desde la existencia, un cambio (`PUT`) pregunta esto:

1. ¿Existe el recurso, para ti? Si se retiró y era tuyo, `410`; si no, `404`.
2. (Como en la Lección 2) ¿El cuerpo dice ser JSON? Si la cabecera `Content-Type` dice otra cosa, `415`. Esto se sabe sin leer el cuerpo.
3. Solo en un cambio: ¿mandaste la condición? Si no, `428`. ¿Se cumple? Si no, `412`.
4. (Como en la Lección 2) ¿El cuerpo se puede leer? Si no, `400`. Y si pasa de 16 KiB, el tope que el `revisor` acepta, `413` (sección 3.6.1).
5. ¿Los datos se pueden cumplir? Si no, `422`.
6. ¿Chocan con el estado del servidor? Si chocan, `409`.
7. Solo en un cambio, al escribir: ¿la versión sigue siendo la que coincidió en el paso 3? Si otra petición la cambió mientras tanto, `412`; si otra lo retiró, `410`. Este paso parece repetido, y no lo es: la sección 3.3.4 muestra qué pasa sin él.

¿Por qué el formato va antes de la condición, y la condición antes de leer el cuerpo? Porque así lo pide la especificación. La [sección 13.2.1 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1) dice que un servidor **debe** evaluar las precondiciones después de sus revisiones normales de la petición y **justo antes de procesar el contenido** o de ejecutar el método. Y agrega la otra mitad de la regla: el servidor **debe ignorar** las precondiciones si, sin ellas y **antes de procesar el contenido**, la respuesta habría sido algo distinto de un `2xx` o un `412`. Dicho de otro modo: los errores que se detectan antes de trabajar en serio ganan sobre la condición. Una ruta que no existe, una credencial que falta y un recurso retirado son de esos. También lo es un `Content-Type` que no se acepta: el `415` sale de una cabecera, sin leer un solo byte del cuerpo (la [sección 15.5.16](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) dice que el `415` puede deberse al `Content-Type` que la petición declara). Por eso un `PUT` con `text/plain` recibe `415` aunque su etiqueta esté vieja, y un `PUT` con `If-Match: *` a un servicio retirado recibe `410` y no `412`, como verás en 3.7. Lo que sí espera a la condición es **leer** el cuerpo: el `400` y el `422` solo se saben después de procesarlo.

El `428` no es una precondición que se evalúe; es la falta de una. Aun así, el `revisor` lo pregunta en el mismo lugar que el `412`, después del formato: así las dos respuestas que mandan al cliente a leer la etiqueta salen del mismo paso, y un cliente que manda el formato equivocado y ninguna condición se entera primero de lo que se sabe sin leer nada.

Y hay una razón práctica para que la condición vaya antes de la lectura: si la etiqueta es vieja, todo lo que diga el cuerpo está escrito sobre una versión que ya no existe. No tiene caso revisarlo campo por campo y decirle al cliente «tu nombre está mal» cuando lo que tiene que hacer primero es volver a leer. Los ejercicios lo comprueban con corridas: el 1, con un `text/plain` sin condición y otro con una etiqueta vieja; el 3, con una petición que trae una etiqueta vieja y datos imposibles a la vez.

### 3.2 La actualización perdida

#### 3.2.1 Dos editores y un `200` para cada uno

La escena del principio no necesita mala suerte ni un error de programación; basta con dos personas y un `PUT` que no pregunta nada. El problema tiene nombre en la especificación: el RFC 9110, en la [sección 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1), lo llama *lost update* y dice que `If-Match` existe sobre todo para evitarlo, cuando varios clientes actúan en paralelo sobre el mismo recurso.

Ocurre, en su forma más común, con una secuencia de cuatro pasos (con tres editores o con un proceso automático en medio es la misma idea, con más actores):

1. Ana lee el servicio. Tiene una copia.
2. Beto lee el servicio. Tiene una copia idéntica.
3. Ana cambia la dirección en su copia y la guarda. El servidor queda con la dirección nueva.
4. Beto cambia el límite en **su** copia, que todavía tiene la dirección vieja, y la guarda. El servidor queda con el límite nuevo **y la dirección vieja**.

El paso 4 es el que duele. `PUT` reemplaza el recurso entero con lo que trae el cuerpo: la [sección 9.3.4 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4) dice que pide que el estado del recurso sea **creado o reemplazado** con el que viene en la petición. Beto no quiso tocar la dirección; simplemente mandó la que tenía. Para el servidor no hay forma de distinguir «no la toqué» de «la quiero así».

El programa `fig03_02.ts` reproduce los cuatro pasos contra el `revisor`. Ana pone la dirección `…/codigo/204`; Beto, el límite de 3000 ms. Al final se lee el servicio y el programa dice si el cambio de Ana sobrevivió:

```ts
// fig03_02.ts
// Dos editores: Ana y Beto leen el mismo servicio, cada uno cambia algo distinto y lo guarda.
// Ana cambia la dirección; Beto, que leyó antes de que Ana guardara, cambia el límite.
// Al final se lee el servicio y se dice si el cambio de Ana sobrevivió.
// Uso: node fig03_02.ts
const BASE = "http://127.0.0.1:18080/servicios/1";
const AUTORIZACION = { Authorization: "Bearer escritura-a" };

type Copia = { etiqueta: string; datos: Record<string, unknown> };

async function leer(quien: string): Promise<Copia> {
  const respuesta = await fetch(BASE, { headers: AUTORIZACION });
  const datos = (await respuesta.json()) as Record<string, unknown>;
  const etiqueta = respuesta.headers.get("etag") ?? "";
  console.log(`${quien.padEnd(8)} lee:    ${respuesta.status} ${etiqueta} ${JSON.stringify(datos)}`);
  return { etiqueta, datos };
}

// Guarda la copia completa (PUT reemplaza el servicio entero), con la etiqueta que leyó.
async function guardar(quien: string, copia: Copia): Promise<number> {
  const { id: _id, ...cuerpo } = copia.datos;
  const respuesta = await fetch(BASE, {
    method: "PUT",
    headers: { ...AUTORIZACION, "Content-Type": "application/json", "If-Match": copia.etiqueta },
    body: JSON.stringify(cuerpo),
  });
  const texto = (await respuesta.text()).trim();
  const nueva = respuesta.headers.get("etag");
  console.log(`${quien.padEnd(8)} guarda: ${respuesta.status} ${nueva === null ? "" : `${nueva} `}${texto}`);
  return respuesta.status;
}

const DIRECCION_NUEVA = "http://127.0.0.1:18081/codigo/204";

const ana = await leer("Ana");
const beto = await leer("Beto");
ana.datos.url = DIRECCION_NUEVA;
beto.datos.limite_ms = 3000;
await guardar("Ana", ana);
if ((await guardar("Beto", beto)) === 412) {
  // El 412 le dice a Beto que su copia es vieja: vuelve a leer, repite SU cambio y guarda.
  const otraVez = await leer("Beto");
  otraVez.datos.limite_ms = 3000;
  await guardar("Beto", otraVez);
}

const final = await leer("Al final");
console.log(final.datos.url === DIRECCION_NUEVA ? "el cambio de Ana sigue ahí" : "SE PERDIÓ el cambio de Ana, y nadie recibió un error");
```

Si el servidor contesta `412` a Beto, el programa hace lo que un cliente bien escrito debe hacer: vuelve a leer, aplica **su** cambio (solo el límite) sobre la copia nueva y guarda otra vez. Pero eso solo pasa si el servidor contesta `412`. Primero, el rojo.

#### 3.2.2 En rojo: un `PUT` que no pregunta

Este es el `PUT` que casi todo el mundo escribe la primera vez: buscar el servicio, leer el cuerpo, validarlo y guardarlo. Funciona, pasa todas las pruebas de un solo usuario, y pierde datos en cuanto hay dos. Para verlo, copia la carpeta `fig03_01/` de la sección 3.9 como `rota/` y borra de `cambiar`, en `rota/servicios.ts`, todo el bloque que va de `const condicion = …` hasta el cálculo de `versionLeida`, y pásale `null` a `cambiarServicio`. Queda así (es un fragmento; la versión completa está en `defectos/sin-condicion/servicios.ts`):

```ts
export async function cambiar({ peticion, respuesta, parametros, credencial }: Contexto): Promise<void> {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // Primero el formato (415), después la condición (428 y 412), después la lectura (400).
  if (!esJson(peticion, respuesta)) return;
  const datos = await leerJson(peticion, respuesta);
  if (datos === undefined) return;
  // … validar, destino y nombre repetido, igual que antes
  const cambiado = cambiarServicio(servicio.id, null, validos);
```

**Serie C:** arranca el laboratorio y el `revisor` desde `rota/`. Primero, un `PUT` sin `If-Match`, que en el `revisor` de esta lección da `428`:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-dedb68a8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:25 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

`200`. Nada lo detiene. Y ahora los dos editores. Copia `fig03_02.ts` junto a `rota/` y córrelo:

```text
$ node fig03_02.ts
Ana      lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Beto     lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Ana      guarda: 200 "1-3-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":1500}
Beto     guarda: 200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
Al final lee:    200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
SE PERDIÓ el cambio de Ana, y nadie recibió un error
```

Ahí está la escena del principio, completa. Ana guardó la dirección nueva (`…/codigo/204`) y recibió `200`. Beto guardó su copia vieja con el límite nuevo y **también** recibió `200`, y al hacerlo devolvió la dirección a `…/codigo/200`. Fíjate en que Beto **sí mandó** `If-Match`, con la etiqueta `"1-2-…"` que leyó; el servidor simplemente no la miró. Una cabecera condicional que el servidor ignora no protege nada, y el cliente no tiene forma de saberlo: la especificación permite a un intermediario ignorar `If-Match`, pero el servidor de origen que la recibe **debe** evaluarla antes de ejecutar el método (sección 13.1.1).

Lo que está mal no se ve en ningún encabezado: es el `200` mismo. Un `200` a Beto le dijo «tu cambio se aplicó sobre lo que leíste», y era mentira: se aplicó sobre algo que Beto nunca vio. Detén los programas de `rota/`; vas a volver a usar esa carpeta en 3.3.4.

#### 3.2.3 En verde: la etiqueta como prueba de qué versión leíste

La solución tiene dos piezas que ya conoces de la Lección 1:

- **`ETag`**: cada vez que el `revisor` entrega un servicio, le pone una etiqueta que cambia cada vez que el servicio cambia. En el `revisor` es `"id-versión-arranque"`: el id del servicio, un número de versión que sube con cada cambio, y las ocho cifras que se sortean al arrancar.
- **Una cabecera condicional**: en la Lección 1, `If-None-Match` decía «mándamelo solo si cambió». Ahora `If-Match` dice lo contrario: «**haz esto solo si no ha cambiado**», o más exactamente, solo si la etiqueta vigente es la que yo leí.

Con eso, cada cliente manda, junto con su cambio, la etiqueta de la versión sobre la que lo escribió. Si alguien cambió el servicio entre la lectura y la escritura, la etiqueta ya no coincide y el servidor se niega: responde `412` y no aplica nada. El cliente no perdió datos; perdió una carrera, y lo sabe.

Primero, el mismo programa de los dos editores que en 3.2.2 perdió el cambio de Ana. **Serie B:** detén el `revisor` de `rota/`, arranca el laboratorio y el `revisor` desde `fig03_01/`, y corre `fig03_02.ts` en cuanto arranque:

```text
$ node fig03_02.ts
Ana      lee:    200 "1-1-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
Beto     lee:    200 "1-1-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
Ana      guarda: 200 "1-2-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":2000}
Beto     guarda: 412 tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
Beto     lee:    200 "1-2-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":2000}
Beto     guarda: 200 "1-3-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":3000}
Al final lee:    200 "1-3-c0466c5e" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":3000}
el cambio de Ana sigue ahí
```

Ana guardó (`200`, versión 2). Beto recibió `412`, releyó (ahora ve la dirección de Ana), aplicó solo su cambio y guardó (`200`, versión 3). Al final están los dos cambios. Nadie tuvo que coordinarse por chat ni bloquear el servicio mientras lo editaba: bastó con que el servidor se negara a escribir sobre una versión vieja. A esta técnica se le llama **concurrencia optimista**: se supone que casi nunca habrá choques, se deja trabajar a todos, y solo se detiene al que llega tarde.

Ahora lo mismo, paso a paso, con `curl`. **Aquí empieza la serie A, la principal de la lección:** detén el `revisor` y vuelve a arrancarlo desde `fig03_01/`, para que el servicio 1 esté como al principio. A partir de aquí y hasta el final de la sección 3.8, todas las peticiones del `revisor` bueno son de esta misma serie; no lo reinicies entre una y otra, porque cada una parte de lo que dejó la anterior. Primero se lee el servicio 1 y se guarda su etiqueta en la variable `ETAG`, con la opción `-w '%header{etag}'` de `curl`, que imprime solo esa cabecera. Esta lectura hace de «Ana y Beto leen»:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
ETag: "1-1-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-c4dd49c4"
```

Ana guarda primero, con `If-Match` y la etiqueta que leyó. Cambia el límite a 1500 ms:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

`200` y una etiqueta nueva: la versión pasó de 1 a 2. Ahora llega Beto con **la misma etiqueta de antes**, la de la versión 1, y un cambio distinto:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/500","limite_ms":2000}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
```

`412 Precondition Failed`. El cambio de Beto no se aplicó, y el de Ana sigue intacto. El cuerpo dice lo que pasó y qué hacer: su etiqueta ya no es la vigente, porque el servicio cambió (o porque el `revisor` se reinició, que también invalida las etiquetas), y tiene que volver a leerlo antes de cambiarlo. No repite la etiqueta que mandó Beto: Beto ya la tiene, y devolverle al cliente un texto que él mismo escribió solo agranda la respuesta sin decirle nada nuevo.

### 3.3 `If-Match` y el `412`

#### 3.3.1 Por qué `If-Match` se compara en fuerte

La Lección 1 enseñó que hay dos formas de comparar etiquetas, y la [sección 8.8.3.2 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) las define con una tabla:

| Etiqueta 1 | Etiqueta 2 | Comparación fuerte | Comparación débil |
|---|---|---|---|
| `W/"1"` | `W/"1"` | no coincide | coincide |
| `W/"1"` | `W/"2"` | no coincide | no coincide |
| `W/"1"` | `"1"` | no coincide | coincide |
| `"1"` | `"1"` | coincide | coincide |

Una etiqueta **débil** (`W/` delante) promete poco: que dos representaciones son «equivalentes», aunque los bytes no sean idénticos. Sirve para la caché, y por eso `If-None-Match` se compara en débil. Una etiqueta **fuerte** promete que los bytes son exactamente los mismos.

`If-Match` se compara **en fuerte**, y la [sección 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) lo exige con un **debe**: el servidor de origen debe usar la comparación fuerte porque el cliente quiere impedir que el método se aplique **si hubo cualquier cambio** en los datos de la representación. Una etiqueta débil no puede garantizar eso: dos versiones «equivalentes» pueden diferir en algo que al cliente sí le importa. Por eso, con comparación fuerte, una etiqueta `W/` **nunca** coincide con nada, ni siquiera con su gemela.

La especificación también dice qué trae la cabecera: `*` o una **lista** de etiquetas separadas por comas (`If-Match = "*" / #entity-tag`). Y da tres pasos para evaluarla:

1. Si es `*`, la condición se cumple si el recurso tiene una representación actual, es decir, si existe.
2. Si es una lista, se cumple si **alguna** de las etiquetas coincide con la vigente.
3. En cualquier otro caso, no se cumple.

`etiquetas.ts`, que viene sin cambios desde la Lección 1, ya hace todo esto: `interpretarLista` lee la lista respetando las comillas, `coincideFuerte` compara dos etiquetas como pide la tabla, y `hayCoincidencia` junta las dos cosas. Lo nuevo es quién la llama con `coincideFuerte`: el manejador `cambiar`, en `servicios.ts`.

#### 3.3.2 Las tres formas que coinciden y la que no

Para probarlo, en la misma serie A, se lee la etiqueta vigente (ahora la versión 2, después del cambio de Ana) y se guarda en `VIGENTE`. Después se manda un cambio con esa misma etiqueta, pero marcada como débil:

```text
$ VIGENTE=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "VIGENTE=$VIGENTE"
VIGENTE="1-2-c4dd49c4"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 109
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó
```

`412`, aunque el texto entre comillas es exactamente el vigente. Fíjate en el cuerpo: no dice que el servicio cambió, porque no cambió. Dice que una etiqueta débil no sirve para cambiar y que hay que mandarla tal como llegó. El `revisor` lo sabe porque, cuando la comparación fuerte falla, prueba también la débil: si esa sí coincide, el problema no es que el servicio haya cambiado, sino que el cliente le agregó `W/` a la etiqueta (puede pasar sin que el cliente lo haya escrito: desde la versión 1.7.3, de 2014, el servidor web nginx convierte en débil una etiqueta fuerte cuando modifica la respuesta, por ejemplo al comprimirla, según su [lista de cambios](https://nginx.org/en/CHANGES); ese caso tiene su propia complicación, que se explica dos párrafos abajo). Decirle que el servicio cambió sería falso, y mandaría al cliente a releer en un ciclo que nunca termina.

Hay un caso donde el consejo del cuerpo, «manda la `ETag` tal como llegó», no alcanza: el de nginx. Si fue un intermediario el que debilitó la etiqueta, al cliente le **llegó** débil, y mandarla tal como llegó repite el `412` en cada intento mientras el intermediario siga debilitando la etiqueta. Ese problema no lo puede arreglar el cliente: quien opera la API tiene que evitar que el intermediario modifique esas respuestas (por ejemplo, no comprimir las que llevan una etiqueta que se usará para escribir) o usar etiquetas que sobrevivan a la modificación. Por eso el cuerpo dice la causa exacta y no un «algo falló» genérico: la persona que lo lea sabe que el problema está en la etiqueta débil, y a quién avisarle. **El código manda y el cuerpo explica, y los dos dicen lo mismo**: los dos dicen «tu condición no se cumplió», y el cuerpo agrega por qué.

Ahora, una lista que trae la etiqueta vigente junto con otra que no existe, y después `*`:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-4-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

Las dos dan `200`. La lista coincide porque **alguna** etiqueta coincide. `*` coincide porque el servicio existe. Y cada cambio subió la versión: `"1-3-…"` y luego `"1-4-…"`.

¿Para qué sirve `If-Match: *` si no protege contra el cambio de otro? Para otra cosa: dice «hazlo solo si el recurso existe». En una API donde `PUT` puede **crear** un recurso, `If-Match: *` impide crear uno por accidente cuando la intención era cambiarlo; y su contrario, `If-None-Match: *`, impide pisar uno que ya existía cuando la intención era crearlo. En el `revisor`, `PUT` nunca crea (un servicio que no existe da `404`), así que `*` solo le ahorra al cliente leer la etiqueta. Por eso, **quien manda `*` renuncia a la protección contra la actualización perdida**. Es válido, la especificación lo permite, pero es una decisión del cliente, y conviene que la tome a sabiendas.

#### 3.3.3 El código de `cambiar`

Este es el manejador, completo en `servicios.ts` (sección 3.9). Lo que importa está en las primeras líneas:

```ts
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
  // …
```

Se lee en el orden de 3.1.3: primero `encontrar` (existe o no, para esta credencial), luego `esJson`, que solo mira la cabecera `Content-Type` (`415`), luego la condición, y solo después el cuerpo. Antes de leer el cuerpo, `cambiar` anota **qué versión coincidió**, en `versionLeida`; con `If-Match: *` anota `null`, porque `*` no habla de ninguna versión, solo pide que el servicio exista. Esa anotación parece de más, porque la comparación ya se hizo. La sección siguiente muestra por qué no lo es.

#### 3.3.4 Dos peticiones a la vez: comparar y escribir en un solo paso

Entre la comparación de la etiqueta y la escritura, `cambiar` espera dos veces: `await leerJson(…)`, mientras llega el cuerpo, y `await destinoPermitido(…)`, mientras el DNS resuelve el nombre de la URL. En cada `await`, Node deja de atender esta petición y atiende otras. Si en ese hueco llega otro `PUT` con la **misma** etiqueta, también pasa la comparación, porque nadie ha escrito todavía. Las dos peticiones siguen adelante convencidas de que el servicio está como lo leyeron, y la que escriba al último pisa a la otra. Es la actualización perdida otra vez, ahora con dos clientes que **sí** mandaron `If-Match` a un servidor que **sí** la comparó.

**Primero, en rojo.** Para verla sin depender de la suerte, una de las dos peticiones tiene que quedarse esperando en el hueco a propósito. `curl -T -` manda el cuerpo que lee de su entrada, conforme le llega; si la entrada tarda, la petición manda sus cabeceras enseguida y se queda esperando el cuerpo, justo en el `await leerJson`. La «lenta» quiere poner el límite en 1000 ms y su cuerpo llega un segundo después; a los 0.3 segundos, la «rápida» quiere ponerlo en 3000 ms, con la misma etiqueta. La versión rota es una serie aparte, la D, y corta la serie A. Si prefieres no cortarla, sáltate este rojo y córrelo al terminar la lección; si lo corres ahora, al volver tendrás que arrancar de nuevo el `revisor` de `fig03_01/` y repetir la serie A desde 3.2.3 hasta aquí para que tus respuestas coincidan con las de la lección.

Para la versión rota, crea la copia **desde cero**: `rm -r rota && cp -R fig03_01 rota`. El `rm` no sobra: si `rota/` ya existe, `cp -R` mete la carpeta adentro (`rota/fig03_01/`) y `rota/` se queda con la versión de 3.2.2. Después haz un solo cambio en `rota/servicios.ts`: en `cambiar`, pásale a `cambiarServicio` `null` en lugar de `versionLeida`. Con eso, la comparación del principio sigue en su lugar, pero al escribir ya no se compara nada (versión completa en `defectos/una-sola-comparacion/servicios.ts`).

**Serie D:** detén el `revisor` que tengas corriendo y arranca el laboratorio y el `revisor` desde `rota/`. Antes de la carrera, comprueba que estás corriendo la copia correcta, porque el resultado rojo de la carrera es igual con las dos versiones rotas y no te avisaría del error. Un `PUT` con una etiqueta inventada **tiene que** dar `412`, porque la comparación del principio sigue viva; si da `200`, estás corriendo la copia de 3.2.2:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-9-00000000"' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
```

`412`: la primera comparación funciona. Ahora sí, la carrera:

```text
$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-4ac4936c"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -sS -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -sS -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}
lenta: 200

$ curl -sS http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}
```

Las dos recibieron `200`; la lenta imprimió el servicio que le devolvieron. Y el valor que quedó es el de la **lenta**, 1000, aunque la rápida guardó primero y también recibió `200`. El cliente de la rápida cree que el límite es 3000; el servidor dice 1000; nadie recibió un error. La comparación del principio se hizo (el control de arriba lo prueba), y no sirvió, porque cuando la lenta escribió ya no era cierta.

Si tecleas la carrera en tu terminal, vas a ver además un renglón como `[1] 12345` al lanzar la lenta, y otro que avisa que terminó (`[1]+ Done …` en bash, `[1] + done …` en zsh): son de la shell, que te avisa de los trabajos en segundo plano, no del `revisor`.

**Luego, en verde.** El arreglo es comparar **otra vez, en el momento de escribir**, sin ningún `await` entre la comparación y la escritura. Es lo que hace `cambiarServicio` en `almacen.ts`:

```ts
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
```

Es una función **síncrona**: no tiene ningún `await`, así que JavaScript la ejecuta de principio a fin sin atender ninguna otra petición en medio. Nadie puede colarse entre el `if` que compara la versión y el `Object.assign` que escribe. Si la versión ya no es la que `cambiar` anotó, no escribe nada y devuelve `"conflicto"`, y `cambiar` responde `412`. Y si el servicio ya no está, porque otra petición lo retiró en el hueco, devuelve `"retirado"`, y `cambiar` responde `410`; la sección 3.7.3 lo provoca:

```ts
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
```

La misma carrera contra el `revisor` de esta lección, **en la serie A**, justo después de las peticiones de 3.3.2 (si corriste la serie D, arranca de nuevo `fig03_01/` y repite antes la serie A desde 3.2.3; si no la repites, tu etiqueta dirá `"1-1-…"` en lugar de `"1-4-…"` y lo que siga en 3.4 a 3.8 no coincidirá con la lección):

```text
$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-4-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -sS -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -sS -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo
lenta: 412

$ curl -sS http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
```

La rápida, `200`; la lenta, `412`, con un cuerpo distinto al de una etiqueta vieja: el servicio cambió **mientras** se atendía su petición. Y el valor que quedó es el de la rápida, 3000, el mismo que su cliente cree que quedó. Ninguna escritura se perdió: una se aplicó, la otra se rechazó y su cliente lo sabe.

¿Por qué no mover toda la comparación al final y comparar una sola vez? Cerraría el hueco igual, pero obligaría a esperar el cuerpo completo y a consultar el DNS para una etiqueta que ya se sabe vieja desde la primera línea. Por eso `cambiar` compara dos veces: al principio, para rechazar barato lo que ya llegó vencido; al escribir, para no aceptar lo que se venció en el camino.

**El equivalente en una base de datos.** Una API real no guarda sus datos en un `Map`, pero el problema y la solución son los mismos. Leer la versión con un `SELECT` y luego escribir con un `UPDATE` separado deja el mismo hueco entre las dos sentencias. La forma de siempre es poner la versión en la condición de la escritura: `UPDATE servicios SET … , version = version + 1 WHERE id = 1 AND version = 4`. La base de datos compara y escribe en una sola operación, y responde cuántos renglones tocó; si tocó cero, otro llegó antes, y la respuesta es `412`. `cambiarServicio` es exactamente eso, escrito en memoria. Y un límite honesto: la atomicidad de una función síncrona vale dentro de **un** proceso de Node. Si el `revisor` corriera en varias instancias (procesos, réplicas detrás de un balanceador), cada una con su propio `Map`, ya no hay un solo lugar donde comparar y escribir; esa comparación tiene que vivir donde los datos son compartidos, en la base de datos, con el `UPDATE … WHERE version = N`.

### 3.4 `412` frente a `428`

#### 3.4.1 Cuando el cliente no manda la condición

Todo lo anterior funciona si el cliente manda `If-Match`. ¿Y si no lo manda? Para el servidor, un `PUT` sin condición es exactamente el `PUT` de la escena del principio: escribir sin saber sobre qué versión. Podría aceptarlo, y entonces la protección depende de que todos los clientes se acuerden de mandar la cabecera. O puede **exigirla**.

Para eso existe el **`428 Precondition Required`**, que no está en el RFC 9110 sino en el [RFC 6585, sección 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3), de abril de 2012. Su definición es de una línea: el servidor de origen **exige que la petición sea condicional**. Y la siguiente frase dice para qué: su uso típico es evitar la actualización perdida, cuando un cliente lee el estado de un recurso, lo modifica y lo devuelve con `PUT` mientras un tercero ya lo cambió. El RFC agrega dos reglas: la respuesta **debería** explicar cómo volver a mandar la petición con éxito (su propio ejemplo dice «intenta con `If-Match`»), y **no debe** guardarse en una caché.

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 428 Precondition Required
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

para cambiar un servicio manda If-Match con su ETag
```

El cuerpo dice qué hacer, como pide el RFC: manda `If-Match` con la `ETag`. Para saber cuál, el cliente tiene que leer el servicio primero, que es justamente lo que le faltó hacer.

#### 3.4.2 La diferencia en una tabla

| | `412 Precondition Failed` | `428 Precondition Required` |
|---|---|---|
| ¿Vino la condición? | sí | no |
| ¿Qué pasó? | la condición se evaluó y resultó falsa | no hay nada que evaluar |
| ¿Qué dice? | «el recurso cambió desde que lo leíste» (o tu etiqueta no sirve) | «no escribo sin saber qué versión leíste» |
| ¿Qué hace el cliente? | vuelve a leer, rehace su cambio sobre la copia nueva, manda la etiqueta nueva | lee, y manda la etiqueta |
| ¿Puede repetir la misma petición tal cual? | no: va a recibir otra vez `412` | no: va a recibir otra vez `428` |
| Definido en | RFC 9110, sección 15.5.13 | RFC 6585, sección 3 |

Las dos respuestas mandan al cliente a **leer**, pero por razones distintas, y un programa las trata distinto: después de un `412`, el programa tiene que **fusionar** su cambio con lo que encontró, porque alguien más escribió; después de un `428`, solo le faltó un paso, y lo que encuentre al leer es lo mismo que ya tenía. Por eso no se juntan en un solo código.

¿Por qué el `revisor` exige la condición en lugar de solo recomendarla? Porque en una API que administra configuración compartida, como la lista de servicios que vigila un equipo, una actualización perdida no avisa: se descubre horas después, como en la escena. Exigir `If-Match` le cuesta al cliente una lectura; no exigirlo le puede costar una noche sin vigilancia. Es una decisión de diseño, no una obligación de HTTP: el RFC 6585 permite exigirla, no obliga a hacerlo. Hay APIs que deciden distinto, y lo verás en 3.5.3.

### 3.5 Conflicto de estado: `409`

#### 3.5.1 El nombre repetido

El `revisor` tiene una regla: dentro de un equipo, dos servicios no pueden llamarse igual. Es una regla razonable (el nombre es lo que se lee en los tableros y en las alertas, y dos «pagos» confundirían a cualquiera), y es una regla **de estado**: no depende del nombre en sí, sino de qué otros servicios existen. Así se ve cuando el equipo a intenta dar de alta un segundo `pagos`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2
```

`409 Conflict`. El cuerpo cumple el **debería** de la sección 15.5.10: dice con qué choca (`/servicios/2`), para que el cliente pueda reconocer el origen del conflicto y decidir: cambiar el nombre, o consultar el servicio que ya existe porque tal vez es el que buscaba. La Lección 5 pondrá esa dirección en un campo propio del cuerpo, `existente`, para que un programa la lea sin interpretar la frase.

Lo mismo pasa en un cambio que intenta ponerle a un servicio el nombre de otro. Aquí el cliente manda `If-Match: *`, así que la condición se cumple; lo que falla es lo de después:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2
```

Y la prueba de que es un conflicto de estado y no una regla sobre los datos: la **misma** petición de alta, byte por byte, con la credencial del equipo b, que no tiene ningún `pagos`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-c4dd49c4"
Content-Type: application/json
Content-Length: 85
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`201`. Los datos eran válidos; lo que cambió fue el estado contra el que se compararon. Esa es la prueba de fuego del `409`: **si la misma petición podría funcionar en otro momento o en otro contexto sin cambiar nada de ella, la falla es de estado, no de datos.**

#### 3.5.2 `409` y no `422`, `409` y no `412`

¿Por qué no `422`? Porque el `422` dice «lo que mandaste no se puede cumplir», y un cliente que lo recibe corrige sus datos. Aquí los datos no tienen nada que corregir. Hay APIs grandes que deciden distinto: la de GitHub responde `422` con el código `already_exists` cuando otro recurso ya usa el mismo valor único, como el nombre de una etiqueta ([documentación de su API REST](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api)). Es una decisión coherente dentro de su API, y está documentada; el curso prefiere `409` porque la especificación lo describe justamente para el conflicto que el usuario puede resolver y volver a mandar.

¿Por qué no `412`? Porque el cliente no puso ninguna condición. El `412` responde a una cabecera condicional que el cliente mandó y que resultó falsa. El cliente que da de alta `pagos` no dijo «créalo solo si no existe otro con ese nombre»; el servidor tiene esa regla por su cuenta. Cuando la regla es del servidor y el choque es con el estado, el código es `409`.

#### 3.5.3 Cuando la versión viaja en el cuerpo

Hay un caso donde la frontera entre `409` y `412` se mueve, y la propia sección 15.5.10 lo menciona: dice que los conflictos son más probables en un `PUT`, y da como ejemplo una API **con versiones** en la que la representación enviada trae cambios que chocan con los de una petición anterior de un tercero. Eso es la actualización perdida. ¿Entonces la actualización perdida es `409` o `412`?

Depende de **dónde viaja la condición**:

- Si la versión que el cliente leyó viaja en una **cabecera condicional** (`If-Match`), el servidor evalúa una precondición de HTTP, y si falla, la respuesta es `412`. Es lo que hace el `revisor`.
- Si la versión viaja **dentro del cuerpo** (un campo `"version": 7` en el JSON), para HTTP no hay ninguna precondición: es parte de los datos. El servidor descubre el choque al comparar el cuerpo con su estado, y la respuesta es `409`.

Las dos formas existen en APIs reales. Las guías de diseño de Google ([AIP-154](https://google.aip.dev/154)) ponen la etiqueta como un campo del recurso y piden responder `ABORTED` cuando no coincide, un error que su tabla de equivalencias traduce a `409 Conflict`; la misma tabla manda `INVALID_ARGUMENT` y `FAILED_PRECONDITION` a `400` ([`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto)). Y la AIP-154 no exige la etiqueta: deja que la petición sin ella pase, salvo en servicios que necesitan consistencia estricta. Las guías de diseño de APIs de Zalando, en cambio, contemplan `ETag` con `If-Match` como una opción (su regla 182 es un «puede», no un «debe»), y su tabla de códigos asigna el `412` a la condición que falla y el `428` a la condición que se exige ([*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/)). El curso sigue la segunda forma porque usa la maquinaria que HTTP ya trae para esto, y porque cualquier intermediario del camino entiende una cabecera estándar; un campo `version` en el cuerpo solo lo entiende tu cliente.

Una nota más sobre el `409`, para no confundirlo más adelante: en la [Lección 6](06-reintentos-idempotencia.md) aparece otro `409`, cuando llega una petición con una cabecera `Idempotency-Key` mientras la original con la misma llave todavía está en curso. Ese comportamiento viene de un borrador de la IETF, `draft-ietf-httpapi-idempotency-key-header-07`, que venció el 18 de abril de 2026 sin publicarse como RFC: **no es un estándar**, y la Lección 6 lo trata como lo que es. Es otro conflicto con el estado actual, y por eso el borrador eligió el mismo código.

### 3.6 Regla de negocio: `422`, y la política de `400` frente a `422`

#### 3.6.1 La política escrita

En la Lección 2, todo lo que no servía del cuerpo respondía `400`. Desde esta lección, el `revisor` separa dos casos, y lo hace con una regla escrita, porque es una de las dos decisiones que el curso toma como **política** y no como intuición:

- **`400 Bad Request`: no se puede leer.** El cuerpo no es JSON, o es JSON pero no es un objeto (`null`, un número, un texto, una lista). No hay forma de saber siquiera qué campos traía. (Un cuerpo de más de 16 KiB ni siquiera se termina de leer: el `revisor` deja de guardarlo en cuanto pasa ese tope y responde `413 Content Too Large`, para que nadie le llene la memoria con un cuerpo gigante.)
- **`422 Unprocessable Content`: se lee, pero no se puede cumplir.** El cuerpo es un objeto JSON, se entiende qué campos trae, pero alguno falta, tiene el tipo equivocado o un valor fuera de rango, o la dirección apunta a un destino prohibido.

Las reglas del `revisor` son cuatro: `nombre` es un texto de 1 a 40 caracteres; `url` es una dirección `http` o `https`; `limite_ms`, si viene, es un entero de 100 a 10 000 (si no viene, vale 2000); y el destino de `url` no puede ser una dirección privada o reservada (el SSRF de la Lección 1).

La regla del medio vale la pena: **se juntan todas las fallas, no solo la primera.** Un cliente que recibe «el nombre está mal», lo corrige, recibe «la dirección está mal», la corrige y recibe «el límite está mal» hizo tres viajes para algo que se podía decir en uno. Así se ven las tres fallas juntas, y el `400` de un cuerpo que no es un objeto:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https
limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '["inventario"]'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON
```

Un renglón por campo, cada uno con el nombre del campo delante. La Lección 5 convierte esos renglones en una lista `errors` con un `pointer` por campo (`"#/nombre"`), como el ejemplo de la [sección 3 del RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html#section-3), para que un formulario pueda marcar cada campo sin interpretar texto.

El tipo equivocado también es `422`, aunque se parezca a un problema de lectura. Aquí `limite_ms` llegó como texto (`"2000"`), no como número:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"2000"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 48
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms: debe ser un entero entre 100 y 10000
```

El JSON se leyó sin problema; lo que no cumple es la regla «entero de 100 a 10 000». Si el `revisor` convirtiera el texto en número por su cuenta, aceptaría también `"2000abc"` o `" 2000 "` según cómo lo convirtiera, y cada cliente aprendería una regla distinta. Es mejor decir con exactitud qué se esperaba.

#### 3.6.2 El destino prohibido también es `422`

La defensa contra SSRF de la Lección 1 sigue igual, pero cambia de código. Antes respondía `400`, porque el `422` todavía no existía; ahora la URL se lee perfectamente, es una dirección `http` válida, y lo que no se puede cumplir es la regla «el `revisor` no se conecta a direcciones privadas o reservadas»:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada
```

El texto es el mismo que en las lecciones anteriores. En el segundo caso, el mensaje dice solo que `localhost` resuelve a una dirección privada o reservada, sin enumerar cuáles: lo que resuelve un nombre cambia según el sistema, y la lista le revelaría al cliente la red interna del servidor sin servirle de nada.

#### 3.6.3 Otras guías deciden distinto

La política del curso no es la única razonable, y vale la pena que sepas qué hacen otros, porque te vas a encontrar con APIs de los dos lados:

- Las guías de **Zalando** dicen que el `400` también debe usarse cuando el cuerpo no pasa la validación de negocio o semántica, «en lugar de usar `422`», y marcan el `422` como «no usar»: según ellas, el `400` ya cubre casi todos los casos y no ven un beneficio claro en distinguirlos.
- Las de **Google** traducen sus errores de argumento inválido (`INVALID_ARGUMENT`) a `400`.
- La API de **GitHub**, como viste en 3.5.2, usa `422` para la validación, e incluso para los valores repetidos.

El curso se queda con la frontera «leer frente a cumplir» por una razón que tiene que ver con quien recibe el error: un `400` le dice al cliente que **algo en la forma** de su petición está roto, normalmente un error de programación que hay que arreglar en el código; un `422` le dice que la forma está bien y que **los valores** no se aceptan, normalmente algo que escribió una persona y que se le puede mostrar en un formulario. Son dos acciones distintas, y la especificación tiene un código para cada una. Lo que importa más que la frontera exacta es que la API la **escriba** y la aplique igual en todas sus rutas: un cliente puede adaptarse a cualquiera de las dos políticas; a una API que usa las dos al azar, no.

#### 3.6.4 Una URL con secretos también es `422`

La regla de la Lección 1 sigue: `url` no puede llevar usuario, clave, consulta ni fragmento, porque el `revisor` la repite en cada representación. Ahora vive en `validar()`, como un renglón más: si la URL ni siquiera es `http` o `https`, el renglón dice eso; si lo es, pero trae algo que el `revisor` tendría que callar, dice esto otro. Y como el `PUT` también pasa por `validar()`, un cambio no puede meter por la puerta de atrás lo que el alta rechaza. Es `422` y no `400` por la política de esta lección: el cuerpo se leyó, y es la URL la que no se puede cumplir.

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"fuga","url":"http://usuario:clave@127.0.0.1:1/estado?token=SECRETO#x"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 67
Date: Thu, 22 Oct 2026 18:36:50 GMT
Connection: keep-alive
Keep-Alive: timeout=5

url: no puede llevar usuario, clave, consulta (?) ni fragmento (#)
```

El renglón no repite la URL, por la misma razón que en la Lección 1: el error también es una respuesta, y lo que no debe salir en el `201` tampoco debe salir en el `422`.

### 3.7 El recurso que se fue: `410` frente a `404`

#### 3.7.1 Lo que el `404` no dice

En la Lección 2, retirar un servicio lo borraba del almacén, y después su identificador respondía `404`, igual que uno que nunca existió. Para el cliente, las dos situaciones son muy distintas. Si un servicio **nunca existió**, tal vez el cliente se equivocó de número y vale la pena revisar. Si **existió y se retiró a propósito**, no hay nada que revisar: hay que dejar de pedirlo, borrarlo de la configuración, quitar el enlace del tablero.

La [sección 15.5.5 del RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5) dice que un `404` **no indica** si la falta es temporal o permanente, y que se prefiere el `410` si el servidor sabe que la condición probablemente es permanente. La [sección 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11) define el **`410 Gone`**: el recurso ya no está disponible en el servidor de origen, y es probable que sea para siempre. Si el servidor no sabe, o no tiene cómo saber, si es permanente, debería usar `404`. Y explica la intención: avisar que el recurso **se retiró a propósito** y que sus dueños quieren que se quiten los enlaces que apuntan a él.

Para poder responder `410`, el `revisor` tiene que **recordar** lo que retiró. Por eso `almacen.ts` tiene ahora un segundo mapa, `retirados`, que guarda el id de cada servicio retirado junto con el equipo al que pertenecía. Así responde:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

El servicio 2 se retiró: `410`, y el cuerpo lo dice sin rodeos, «no va a volver». El 99 nunca existió: `404`. El cliente ya puede tratar distinto cada caso con solo mirar el código.

Dos detalles más de la especificación. Primero, el `410` es **cacheable por heurística**, igual que el `404`: una caché puede guardarlo aunque no traiga instrucciones de caché, y es correcto, porque el recurso no va a volver. Segundo, no es obligatorio marcar todo lo retirado como `410` ni recordarlo para siempre: la especificación lo deja a criterio de quien opera el servidor. El `revisor` lo recuerda mientras está encendido; como guarda todo en memoria, al reiniciarlo un servicio retirado vuelve a dar `404`. En una API con base de datos, el renglón se marcaría como retirado en lugar de borrarse.

#### 3.7.2 El `410` no se le dice a cualquiera

El `410` dice algo más que «no está»: dice «**estuvo**». Eso, para alguien que no debía saber que existió, es información. En la Lección 2 el `revisor` decidió que un servicio de otro equipo responde `404`, igual que uno que no existe, para que nadie pueda enumerar lo ajeno comparando respuestas. Si ahora el servicio 2 del equipo a respondiera `410` a cualquiera, el equipo b podría recorrer los identificadores y aprender cuáles existieron en el equipo a y cuándo se retiraron. Por eso `encontrar` solo responde `410` **al equipo dueño**; a los demás les responde el mismo `404` de siempre:

```text
$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 2
```

El mismo `404`, con el mismo texto que el del servicio 99. Para el equipo b, el servicio 2 nunca existió, que es lo que el equipo b tenía permitido saber. Esta es la función que decide, en `servicios.ts`:

```ts
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
```

Una sola función para consultar, cambiar, retirar y pedir revisión: así ningún manejador puede olvidar la comparación del equipo, y el `410` y el `404` salen siempre de las mismas dos líneas. «El error que vas a ver» muestra qué pasa si se quita `delEquipo` de la segunda condición.

#### 3.7.3 El `410` le gana a la condición

Un `PUT` con `If-Match: *` a un servicio retirado. `*` significa «si existe»; el servicio no existe, así que la condición sería falsa y podríamos esperar un `412`:

```text
$ curl -i -X PUT http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver
```

Es `410`, por la regla de 3.1.3: la sección 13.2.1 pide ignorar las precondiciones si, sin ellas, la respuesta no habría sido un `2xx` ni un `412`. Sin `If-Match`, este `PUT` habría recibido `410`; entonces la condición ni se evalúa. Y es la respuesta más útil: un `412` mandaría al cliente a releer, y al releer recibiría `410` de todos modos.

Lo mismo vale cuando el retiro ocurre **durante** el cambio, en el hueco de 3.3.4. Se da de alta un servicio, `efimero`, y se guardan su dirección y su etiqueta. Después, la misma carrera de antes, con otro rival: mientras un `PUT` lento espera su cuerpo, un `DELETE` retira el servicio:

```text
$ ID=$(curl -sS -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/5 ETAG="5-1-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}' ) | curl -sS -w 'lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -sS -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
el servicio 5 se retiró y no va a volver
lento: 410
```

El `DELETE` llegó en el hueco y respondió `204`. Cuando el `PUT` lento por fin escribió, `cambiarServicio` ya no encontró el servicio, devolvió `"retirado"`, y la respuesta fue `410`, con el mismo cuerpo que un `GET` a un servicio retirado: como si el `PUT` hubiera llegado después del retiro, que es lo que en realidad le pasó. Un `412` aquí mandaría al cliente a releer, para encontrarse con el `410` en la siguiente petición; con el `410` se entera a la primera.

### 3.8 Versiones de la API: el `410` anunciado

#### 3.8.1 Retirar una versión sin sorprender a nadie

Un servicio retirado es un caso pequeño del mismo problema que tiene toda API que crece: **retirar una versión vieja**. El `revisor` tiene tres generaciones de rutas:

- `/servicios`: la versión actual.
- `/v1/servicios`: la versión anterior. Sigue funcionando, pero está **desaprobada**: hablaba de `direccion` en lugar de `url`, y del límite en segundos (`"limite": 3` por 3000 ms) en lugar de milisegundos.
- `/v0/…`: la primera versión, ya **retirada**. Cualquier ruta suya responde `410`.

Si un día la `/v1` pasara de responder `200` a responder `410` sin aviso, cada cliente que todavía la usara se enteraría por un error en producción. Lo correcto es avisar **antes**, en cada respuesta de la `/v1`, para que quien la usa tenga tiempo de migrar. Para eso hay dos cabeceras, y no tienen el mismo peso:

- **`Deprecation`**, del [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html) (marzo de 2025, **estándar propuesto** de la IETF). Su valor es la fecha en que el recurso **quedó o quedará** desaprobado; puede estar en el pasado («quedó desaprobado en esa fecha») o en el futuro («lo estará»). La fecha va en el formato de los campos estructurados de HTTP: `@` seguido de los segundos desde el 1 de enero de 1970 (sección 2.1).
- **`Sunset`**, del [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html) (mayo de 2019, documento **informativo**, no de estándares). Su valor es la fecha en que el recurso **probablemente dejará de responder**, en el formato de fecha de HTTP de siempre (`Sun, 31 Jan 2027 00:00:00 GMT`). Se publicó como propuesta individual de su autor, revisada por la IETF pero sin pasar por un grupo de trabajo ([su ficha en el datatracker de la IETF](https://datatracker.ietf.org/doc/rfc8594/)).

Que una sea estándar propuesto y la otra informativa no cambia cómo se usan; cambia cuánto puedes esperar que los clientes y las herramientas las conozcan. Y ninguna de las dos obliga a nada: son **avisos**. El RFC 9745 dice en su sección 5 que desaprobar un recurso no cambia su comportamiento: quien lo usa puede seguir usándolo igual. El RFC 8594, en su sección 3, dice que los clientes **deberían** tratar `Sunset` como una pista: no hay garantía de que el recurso funcione hasta esa fecha, ni de que deje de funcionar después.

A las dos se suma un enlace: el RFC 9745 registra la relación `deprecation` para la cabecera `Link` (sección 3), que apunta a la documentación de la desaprobación, por ejemplo la guía para migrar. Así responde la `/v1` del `revisor`:

```text
$ curl -i http://127.0.0.1:18080/v1/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}

$ curl -i http://127.0.0.1:18080/v1/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 104
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}]}
```

Los datos son los del servicio 1, en el formato viejo: `direccion` en lugar de `url`, y `"limite":3`, los 3000 ms que dejó la petición «rápida» de la carrera de 3.3.4, ahora en segundos. Y las tres cabeceras van en todas las respuestas de la `/v1`, la consulta y la lista: la desaprobación es del recurso en el que aparece la cabecera (sección 2.2 del RFC 9745), así que cada ruta desaprobada la lleva.

#### 3.8.2 La regla del orden: `Sunset` nunca antes que `Deprecation`

Las dos fechas cuentan una historia en orden: primero la versión **deja de recomendarse** (desaprobación) y, más tarde, **deja de responder** (retiro). La [sección 4 del RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html#section-4) lo hace regla con un **no debe**: la fecha de `Sunset` no debe ser anterior a la de `Deprecation`. Si lo es (por un error de configuración, dice el RFC), quien desarrolla el cliente debería consultar a quien opera el recurso para aclararlo.

La regla tiene sentido aunque las dos sean avisos. Un retiro anterior a la desaprobación diría «esta versión deja de responder el lunes, y se desaprueba el viernes», que es una contradicción: nadie tendría tiempo de migrar entre un aviso y el otro, porque el segundo llega cuando ya no hay nada. El RFC 8594 lo explica desde el otro lado en su sección 1.4: la desaprobación suele ocurrir en dos etapas, primero «ya no es la versión recomendada» y después «se da de baja», y `Sunset` solo sirve para la segunda.

En el `revisor`, la `/v1` se desaprobó el 1 de julio de 2026 (`@1782864000`) y deja de responder el 31 de enero de 2027: siete meses de margen. El ejercicio 4 te pide comprobarlo con un programa, que es lo que debería hacer cualquier cliente que lea esos avisos.

#### 3.8.3 Y al final, el `410`

Cuando llega la fecha, la versión se retira y empieza a responder `410`. Es lo que ya le pasó a la `/v0`:

```text
$ curl -i http://127.0.0.1:18080/v0/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios
```

`410` con cualquier credencial y también sin ninguna, en cualquier ruta que empiece con `/v0`. Fíjate que la pregunta «¿es `/v0`?» va en la puerta **antes** que la credencial, junto a las redirecciones viejas: una versión retirada no tiene nada que proteger, y un cliente viejo que ni siquiera sabe autenticarse con el esquema actual merece saber que la versión se fue, no que le falta una credencial. El cuerpo dice cuándo se retiró y a dónde ir. Es el mismo razonamiento del `410` de un servicio, en grande: el cliente no debe revisar su código buscando un error de dirección; debe migrar.

El `410` es el final de la historia, no el principio. Una API que retira una versión respondiendo `410` el primer día que alguien se entera de su retiro hizo las cosas al revés: el `410` llega **después** de meses de `Deprecation` y `Sunset` en cada respuesta, y de un enlace con la guía para migrar. La Lección 8 documenta estos avisos en la descripción OpenAPI de la API, con `deprecated: true` en lo que se retira.

### 3.9 El `revisor` completo

#### 3.9.1 Los archivos que cambian

El `revisor` de esta lección vive en la carpeta `~/curso-http/fig03_01/`. Si tienes la carpeta de la Lección 2, cópiala con ese nombre y cambia cuatro archivos: uno nuevo, `versiones.ts`, y tres modificados, `almacen.ts`, `rutas.ts` y `servicios.ts`. Van completos aquí.

`versiones.ts` es nuevo. Tiene las dos versiones viejas: la `/v1`, con sus tres avisos en `AVISOS` y su forma vieja de representar un servicio, y la `/v0`, que responde `410` a todo:

```ts
// fig03_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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

En `almacen.ts` hay tres funciones nuevas y una cambiada: `retirarServicio` ya no solo borra, también **recuerda** el retiro en `retirados`, con el equipo; `equipoDeRetirado` lo consulta; `buscarPorNombre` busca un nombre dentro de un equipo, para el `409`; y `cambiarServicio(id, versionLeida, datos)` compara la versión y aplica el cambio en un solo paso, sin `await` (3.3.4): si la versión ya no es la que se leyó, devuelve `"conflicto"`; si lo es, escribe y **sube la versión**, que es lo que invalida la etiqueta vieja:

```ts
// fig03_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

En `rutas.ts` cambian tres cosas: la ruta `/servicios/{id}` admite ahora `PUT` (y por eso el `Allow` de un `405` en esa ruta pasa a ser `GET, HEAD, PUT, DELETE`); hay dos rutas nuevas para la `/v1`, de solo lectura; y antes de buscar la ruta, `versionRetirada` atiende la `/v0`:

```ts
// fig03_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  cambiar, consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
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
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: lee(consultarRevision) } },
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

Y `servicios.ts`, donde está casi todo lo de esta lección: `encontrar` (3.7.2), `validar` y `rechazarDatos` (3.6.1), el `409` en `darDeAlta` y `cambiar` (3.5.1), `esJson`, que separa del lector de JSON la pregunta por el formato para que el `PUT` la haga antes que la condición (3.1.3), y `cambiar` con su `415`, su `428`, su `412` por etiqueta vieja (3.3.3) y su segundo `412`, el de la carrera (3.3.4), o su `410` si lo retiraron en el hueco (3.7.3). `encontrar` se exporta ahora porque `versiones.ts` también la usa. `representar` también quedó exportada, aunque en esta lección ningún otro archivo la importa: la `/v1` tiene su propia `representarV1`:

```ts
// fig03_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarPorNombre, buscarRevision, buscarServicio, cambiarServicio, crearRevision, crearServicio,
  equipoDeRetirado, etiqueta, listarServicios, retirarServicio, terminarRevision,
  type Revision, type Servicio,
} from "./almacen.ts";
import type { Credencial } from "./autenticacion.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, coincideFuerte, hayCoincidencia, interpretarLista } from "./etiquetas.ts";
import { revisar } from "./cliente.ts";
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
  credencial: Credencial;
};

const ESPERA_EN_COLA_MS = 1000;

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
async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
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
```

Fíjate en el orden dentro de `darDeAlta` y de `cambiar`: primero `validar` (`422`), después el destino (`422` también), y al final el nombre repetido (`409`). Las reglas sobre los datos van antes que el choque con el estado: no tiene caso buscar si ya existe un servicio con un nombre que de todos modos no es válido.

#### 3.9.2 Los archivos que no cambian

Los demás archivos son los de la Lección 2, sin un solo cambio. Van completos para que el `revisor` se pueda armar desde esta lección. `etiquetas.ts` es el que hace la comparación fuerte que usa `cambiar`:

```ts
// fig03_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig03_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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
// fig03_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig03_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

```ts
// fig03_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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
// fig03_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig03_01/laboratorio.ts
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

```json fig03_01/package.json
{
  "type": "module"
}
```

#### 3.9.3 La corrida completa

Abre dos terminales en `~/curso-http/fig03_01/`. En la primera, el laboratorio; en la segunda, el `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

En una tercera terminal, estas son todas las peticiones de las secciones 3.2 a 3.8, en el orden en que aparecieron, con lo que respondieron. Están juntas para que las compares de corrido con las tuyas; recuerda que las etiquetas van a terminar distinto:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
ETag: "1-1-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-c4dd49c4"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/500","limite_ms":2000}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo

$ VIGENTE=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "VIGENTE=$VIGENTE"
VIGENTE="1-2-c4dd49c4"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 109
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $VIGENTE" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-4-c4dd49c4"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:28 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-4-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1000}' ) | curl -sS -w 'lenta: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTA=$!; sleep 0.3; curl -sS -o /dev/null -w 'rápida: %{http_code}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}'; wait $LENTA
rápida: 200
el servicio cambió mientras se atendía tu petición; vuelve a leerlo antes de cambiarlo
lenta: 412

$ curl -sS http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 428 Precondition Required
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

para cambiar un servicio manda If-Match con su ETag

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-c4dd49c4"
Content-Type: application/json
Content-Length: 85
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https
limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '["inventario"]'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"2000"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 48
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 2

$ curl -i -X PUT http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ ID=$(curl -sS -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/5 ETAG="5-1-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}' ) | curl -sS -w 'lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -sS -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
el servicio 5 se retiró y no va a volver
lento: 410

$ curl -i http://127.0.0.1:18080/v1/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}

$ curl -i http://127.0.0.1:18080/v1/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 104
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":3}]}

$ curl -i http://127.0.0.1:18080/v0/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios
```

Treinta y un renglones. Las veinticuatro respuestas completas, las de `curl -i`, dieron `[200 200 412 412 200 200 428 409 409 201 422 400 422 422 422 204 410 404 404 410 200 200 410 410]`; la carrera de 3.3.4 dio `rápida: 200` y `lenta: 412`; la de 3.7.3, `DELETE en el hueco: 204` y `lento: 410`; y los cinco renglones que guardan una etiqueta (`ETAG` dos veces, `VIGENTE`, y `ID` con `ETAG` en 3.7.3) o leen el servicio sin `-i` no imprimen el código. Cada error de esta lección llegó **después** de pasar las siete preguntas de la puerta de la Lección 2: todas traían ruta, método, credencial y permiso correctos, y aun así no se podían cumplir.

La terminal del `revisor` anotó cada petición, en el mismo orden:

```text
revisor en http://127.0.0.1:18080
GET /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
PUT /servicios/1
GET /servicios/1
PUT /servicios/1
POST /servicios
PUT /servicios/1
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
DELETE /servicios/2
GET /servicios/2
GET /servicios/99
GET /servicios/2
PUT /servicios/2
POST /servicios
GET /servicios/5
PUT /servicios/5
DELETE /servicios/5
GET /v1/servicios/1
GET /v1/servicios
GET /v0/servicios/1
GET /v0/servicios
```

## El error que vas a ver

### Los dos `200` que no debieron salir

Las dos versiones rotas más importantes de esta lección ya las provocaste en el cuerpo de la lección, porque son su corazón: el `PUT` que no pregunta (3.2.2) y el que pregunta una sola vez (3.3.4). Las dos fallan igual, y vale la pena decir exactamente qué está mal en la respuesta, porque no se ve en ningún encabezado: es un `200` que promete algo falso. Un `200` a un `PUT` le dice al cliente «tu cambio se aplicó sobre lo que leíste». En los dos defectos, el segundo `200` se aplicó sobre algo que su cliente nunca vio, y borró un cambio ajeno. El arreglo también es el mismo en los dos casos, en dos partes: exigir y comparar la condición antes de leer el cuerpo (`428` y `412`), y volver a comparar la versión en el mismo paso en que se escribe (`412` otra vez). Falta una de las dos, y vuelve la escena del principio.

### El `410` que delata

El segundo defecto es más sutil, porque nace de querer hacer las cosas bien. Alguien lee la sección 15.5.11, decide que todo servicio retirado merece su `410`, y simplifica la condición de `encontrar` quitándole la comparación del equipo (versión completa en `defectos/410-para-todos/servicios.ts`):

```ts
  if (servicio === undefined && equipo !== undefined) {
    fallar(respuesta, 410, `el servicio ${id} se retiró y no va a volver`);
```

**Serie E:** crea `rota/` desde cero (`rm -r rota && cp -R fig03_01 rota`), pon esa versión en `rota/servicios.ts` y arranca el laboratorio y el `revisor` desde `rota/`. El equipo a retira su servicio 2, y el equipo b pregunta por el 2 y por el 99:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/2 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 42
Date: Wed, 21 Oct 2026 13:18:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 2 se retiró y no va a volver

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99
```

El equipo b nunca tuvo acceso al servicio 2, pero ahora sabe que existió y que ya no existe; y sabe que el 99 nunca existió. Es la enumeración del recuadro de la Lección 2, por una puerta nueva: dos respuestas distintas para dos identificadores ajenos. Con un guion como el enumerador de la Lección 2, el equipo b podría recorrer los identificadores y saber cuántos servicios ha retirado cada equipo. El arreglo es devolverle a la condición su `delEquipo(equipo, credencial)`: el `410` es para quien podía ver el recurso cuando existía, y para los demás, el mismo `404` de siempre.

## Lo que se hace mal

**`400` para todo lo que no se puede cumplir.** El cliente no puede distinguir «tu JSON está roto» de «tu nombre está repetido» de «escribiste sobre una versión vieja», y cada una se arregla distinto. Si la API decide usar `400` también para la validación, como recomiendan algunas guías, que al menos el conflicto (`409`) y la precondición (`412`) tengan su código.

**Un `PUT` sin condición en un recurso compartido.** Es la actualización perdida esperando a ocurrir. No falla en las pruebas, porque las pruebas casi nunca tienen dos editores a la vez; falla en producción, en silencio, con un `200` para cada uno.

**Comparar la versión solo al principio.** Si entre la comparación y la escritura hay algo que espera (leer el cuerpo, consultar el DNS, llamar a otro servicio), otra petición con la misma etiqueta pasa también, y la última en escribir pisa a la otra con `200`. La versión se compara otra vez en el mismo paso en que se escribe, como un `UPDATE … WHERE version = N`.

**Comparar `If-Match` en débil, o como texto.** En débil, `W/"1-2-…"` pasaría por buena, y la especificación lo prohíbe con un **debe**. Como texto, una lista `"9-9", "1-2-…"` o un `*` darían `412` aunque la condición se cumpla.

**`409` cuando falla `If-Match`.** El cliente puso una condición en una cabecera y no se cumplió: eso es un `412`. El `409` es para el choque con el estado que el cliente no expresó como condición, o para cuando la versión viaja dentro del cuerpo.

**`412` cuando falta `If-Match`.** Sin condición no hay nada que haya fallado. El cliente que recibe `412` cree que alguien cambió el recurso y relee buscando el cambio ajeno; con `428` sabe que solo le faltó mandar la etiqueta.

**Un `409` que no dice con qué choca.** La sección 15.5.10 pide que el cuerpo permita reconocer el origen del conflicto. «Conflicto» a secas deja al cliente adivinando qué campo cambiar.

**Mandar solo la primera falla de validación.** Tres viajes para corregir tres campos, cuando un `422` con la lista completa lo resolvía en uno.

**`410` para todos, o `404` para siempre.** El primero delata lo que existió a quien no podía verlo; el segundo le hace buscar un error de dirección al dueño de un recurso que se retiró a propósito.

**Retirar una versión sin avisar, o con los avisos al revés.** Un `410` sin meses previos de `Deprecation` y `Sunset` se descubre en producción. Y un `Sunset` anterior a la `Deprecation` viola la sección 4 del RFC 9745 y no le da a nadie tiempo de migrar.

**Presentar `Deprecation` o `Sunset` como obligaciones.** Son avisos que el cliente puede leer; el recurso desaprobado se comporta igual que antes, y la fecha de `Sunset` es una pista. Un cliente bien hecho los registra y alerta a quien lo mantiene; no deja de funcionar por verlos.

## Ejercicios

Los cuatro se corrigen solos: cada uno termina con una corrida que te dice si acertaste. Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada. Son la **serie F**: para todos necesitas el laboratorio y el `revisor` de 3.9 corriendo, recién arrancados, y los cuatro se corren en orden, uno detrás de otro, sin reiniciar entre ellos salvo donde el ejercicio lo pide.

### Ejercicio 1 — ¿Conflicto, regla o precondición?

Sin correr nada, predice el código de cada una de estas nueve peticiones, y para cada error di si es un conflicto de estado, una regla de negocio, una precondición, o algo que la puerta de la Lección 2 o la sección 3.7 ya resolvía. El nombre de la segunda tiene 41 equis:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-1-00000000"' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -H 'If-Match: "1-0-0"' -d 'catalogo'
curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
curl -i http://127.0.0.1:18080/v0/servicios
curl -i -X DELETE http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
```

La cuarta y la quinta tienen trampa: cada una trae dos problemas. ¿Cuál se pregunta primero?

### Ejercicio 2 — La etiqueta que no sobrevivió al reinicio

Guarda la etiqueta del servicio 1 en una variable, **detén el `revisor` y vuelve a arrancarlo** (`Ctrl`+`C` y `node servidor.ts`), y manda un cambio con la etiqueta de antes:

```bash
ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ANTES=$ANTES"
# aquí detienes y vuelves a arrancar el revisor
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ANTES" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
```

Predice el código. Después contesta dos preguntas. Nadie cambió el servicio 1 entre la lectura y la escritura: ¿por qué es correcto que el `revisor` se niegue? Y ¿qué tendría de malo un cuerpo que dijera solo «alguien cambió el servicio»?

### Ejercicio 3 — Dos fallas en una petición

Sin reiniciar, guarda la etiqueta vigente del servicio 1 en `AHORA` y manda dos cambios con el mismo cuerpo inválido: uno con una etiqueta inventada y otro con la vigente. Al final, lee la etiqueta otra vez:

```bash
AHORA=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "AHORA=$AHORA"
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-7-00000000"' -d '{"nombre":"","url":"ftp://archivos"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $AHORA" -d '{"nombre":"","url":"ftp://archivos"}'
curl -sS -o /dev/null -w '%header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
```

Predice los dos códigos y si la etiqueta del final es igual a `AHORA`. ¿Por qué el primero no menciona el nombre vacío?

### Ejercicio 4 — Lee los avisos con un programa

Escribe un programa, `fig03_03.ts`, que pida una ruta del `revisor` con `lectura-a` y diga: desde cuándo está desaprobada, cuándo deja de responder, dónde leer más, y si las dos fechas están en el orden que exige la sección 4 del RFC 9745. Si la ruta no trae avisos, que lo diga. Pruébalo con `/v1/servicios` y con `/servicios`. Pista: el valor de `Deprecation` es `@` seguido de segundos, y `new Date(texto)` de JavaScript entiende el formato de `Sunset`.

## Soluciones

### Solución 1

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 53
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado catalogo: /servicios/1

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-1-00000000"' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -H 'If-Match: "1-0-0"' -d 'catalogo'
HTTP/1.1 415 Unsupported Media Type
Accept: application/json
Content-Type: text/plain; charset=utf-8
Content-Length: 51
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo debe ser application/json, no text/plain

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3
```

En orden:

1. **`409`, conflicto de estado.** `catalogo` es un nombre válido; ya existe uno en el equipo a.
2. **`422`, regla de negocio.** El nombre tiene 41 caracteres; la regla dice de 1 a 40. Ningún estado del servidor lo haría válido.
3. **`412`, precondición.** La condición no coincide con la etiqueta vigente (`"1-1-00000000"` no es la tuya; la tuya termina con las ocho cifras de este arranque).
4. **`415`, no `428`.** Faltan dos cosas, el formato y la condición. El formato se conoce por una cabecera, `Content-Type`, sin procesar el cuerpo, y la sección 13.2.1 pide que lo que se detecta antes de procesar el contenido gane sobre las precondiciones. Si el cliente corrige el `Content-Type`, la siguiente respuesta será `428`.
5. **`415`, no `412`.** Ahora la condición sí viene, y además está vieja (`"1-0-0"` no es ninguna versión del servicio). No importa: el formato equivocado se sabe primero, y con él el `revisor` ni siquiera evalúa `If-Match`. Si el cliente corrige el `Content-Type`, la siguiente respuesta será `412`.
6. **`404`, la puerta de la Lección 2.** El servicio 3 es del equipo b; para el equipo a no existe.
7. **`410`, versión retirada.** Sin credencial: la `/v0` se atiende antes de preguntar quién eres.
8. **`204`.** El equipo b retira su servicio 3.
9. **`404`, no `410`.** El servicio 3 se retiró, pero era del equipo b. Para el equipo a nunca existió, y sigue sin existir: el `410` es solo para el dueño.

### Solución 2

```text
$ ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ANTES=$ANTES"
ANTES="1-1-caba5fd2"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ANTES" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo
```

`412`, y es correcto: la etiqueta que manda el cliente no es la vigente. Tras el reinicio, el servicio 1 tiene la etiqueta `"1-1-…"` con otras ocho cifras, porque el `revisor` sortea un identificador nuevo en cada arranque. La especificación no le pide al servidor saber **por qué** la etiqueta no coincide; le pide no ejecutar el método si no coincide. Y la acción que el código le indica al cliente, volver a leer y rehacer su cambio sobre lo que encuentre, es la correcta: el `revisor` que atendió su lectura ya no existe, y lo que el cliente creía saber de él tampoco. En un servidor con base de datos el servicio habría sobrevivido al reinicio, pero en este, que guarda todo en memoria, nada garantiza que el servicio 1 de ahora sea el mismo que el de antes.

Un cuerpo que dijera solo «alguien cambió el servicio» sería **falso** en este caso: nadie lo tocó. Por eso el `revisor` dice las dos causas posibles, «el servicio cambió o el revisor se reinició», y la acción, «vuelve a leerlo antes de cambiarlo». El código decide qué hacer; el cuerpo, si lo lee una persona, no la manda a buscar un cambio que no existe. Para comprobar que la etiqueta nueva sí funciona, léela y úsala: es lo primero que hace el ejercicio 3.

### Solución 3

```text
$ AHORA=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "AHORA=$AHORA"
AHORA="1-1-e35ad556"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-7-00000000"' -d '{"nombre":"","url":"ftp://archivos"}'
HTTP/1.1 412 Precondition Failed
Content-Type: text/plain; charset=utf-8
Content-Length: 115
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $AHORA" -d '{"nombre":"","url":"ftp://archivos"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 89
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https

$ curl -sS -o /dev/null -w '%header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
"1-1-e35ad556"
```

El primero es **`412`**: la condición se evalúa antes de leer el cuerpo (sección 13.2.1), y como no se cumple, el cuerpo ni se revisa. Por eso no menciona el nombre vacío: decirle al cliente que su nombre está mal no le sirve de nada si lo que tiene que hacer primero es releer; cuando relea, tal vez el servicio ya tenga otro nombre y su cambio entero sea otro. El segundo es **`422`**: la condición se cumple, el cuerpo se lee, y las dos fallas aparecen juntas, como pide la política de 3.6.1. Y la etiqueta del final **es igual a `AHORA`**: ninguno de los dos `PUT` cambió nada, así que la versión no subió. Un cambio rechazado no gasta la etiqueta; el cliente puede corregir sus datos y volver a mandarla.

### Solución 4

```ts
// fig03_03.ts
// Lee los avisos de retiro de una ruta: Deprecation (RFC 9745) y Sunset (RFC 8594).
// Uso: node fig03_03.ts /v1/servicios
const ruta = process.argv[2] ?? "/v1/servicios";
const respuesta = await fetch(`http://127.0.0.1:18080${ruta}`, {
  headers: { Authorization: "Bearer lectura-a" },
});
await respuesta.body?.cancel();

const desaprobacion = respuesta.headers.get("deprecation"); // "@segundos": fecha de campo estructurado
const retiro = respuesta.headers.get("sunset"); // fecha HTTP: "Sun, 31 Jan 2027 00:00:00 GMT"
console.log(`${ruta}: ${respuesta.status}`);

if (desaprobacion === null && retiro === null) {
  console.log("sin avisos: la ruta no anuncia que se vaya a retirar");
} else {
  let desde: Date | undefined;
  if (desaprobacion !== null) {
    const segundos = /^@(-?\d+)$/.exec(desaprobacion);
    if (segundos === null) console.log(`Deprecation no es una fecha válida: ${desaprobacion}`);
    else desde = new Date(Number(segundos[1]) * 1000);
  }
  let hasta: Date | undefined;
  if (retiro !== null) {
    hasta = new Date(retiro);
    if (Number.isNaN(hasta.getTime())) {
      console.log(`Sunset no es una fecha válida: ${retiro}`);
      hasta = undefined;
    }
  }
  console.log(`desaprobada desde: ${desde?.toISOString() ?? "(no lo dice)"}`);
  console.log(`deja de responder: ${hasta?.toISOString() ?? "(no lo dice)"}`);
  const enlace = respuesta.headers.get("link");
  if (enlace !== null) console.log(`dónde leer más:   ${enlace}`);
  if (desde !== undefined && hasta !== undefined) {
    // RFC 9745, sección 4: la fecha de Sunset no puede ser anterior a la de Deprecation.
    console.log(hasta.getTime() >= desde.getTime() ? "orden correcto: primero se desaprueba, luego se retira" : "AVISO MAL ARMADO: el retiro es anterior a la desaprobación");
  }
}
```

```text
$ node fig03_03.ts /v1/servicios
/v1/servicios: 200
desaprobada desde: 2026-07-01T00:00:00.000Z
deja de responder: 2027-01-31T00:00:00.000Z
dónde leer más:   <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
orden correcto: primero se desaprueba, luego se retira

$ node fig03_03.ts /servicios
/servicios: 200
sin avisos: la ruta no anuncia que se vaya a retirar
```

`await respuesta.body?.cancel()` descarta el cuerpo sin leerlo, porque el programa solo necesita las cabeceras. La expresión regular `^@(-?\d+)$` acepta exactamente la forma de fecha de los campos estructurados; cualquier otra cosa se reporta como inválida, en lugar de convertirse en una fecha cualquiera. Con `Sunset` pasa lo mismo, y por una razón más sutil: `new Date("proximo-mes")` no lanza ningún error, produce una fecha inválida, y es `toISOString()` quien después lanza `RangeError: Invalid time value` y tumba el programa. Por eso el programa pregunta `Number.isNaN(hasta.getTime())` antes de usarla. Probado contra un servidor de juguete que respondía `Sunset: proximo-mes`, el programa no se cae: imprime `Sunset no es una fecha válida: proximo-mes`, luego `desaprobada desde: 2026-07-01T00:00:00.000Z` y `deja de responder: (no lo dice)`, y termina con código 0. Y la comparación final es la regla de la sección 4 del RFC 9745: si algún día la configuración de la `/v1` pone un `Sunset` anterior a la `Deprecation`, el programa lo dice en lugar de callar. Un cliente real haría con esto algo más útil que imprimirlo: registrarlo en su bitácora y avisarle a quien lo mantiene, una vez, no en cada petición.

## Cómo sé que lo logré

- [ ] Para una petición que falla, dices si es conflicto de estado, regla de negocio o precondición, y respondes `409`, `422` o `412` con la pregunta que lo decide.
- [ ] `node fig03_02.ts` contra el `revisor` de 3.9 termina con «el cambio de Ana sigue ahí», y contra `rota/` sin la condición, con «SE PERDIÓ el cambio de Ana».
- [ ] La carrera de 3.3.4 da `rápida: 200` y `lenta: 412` y deja `"limite_ms":3000` contra el `revisor` de 3.9, y `200` y `200` con `"limite_ms":1000` contra la copia que le pasa `null` a `cambiarServicio`.
- [ ] Un `PUT` a `/servicios/1` sin `If-Match` da `428` con un cuerpo que dice qué cabecera mandar; con una etiqueta vieja da `412`; con `W/` delante de la vigente da `412` con el aviso de que es débil; con una lista que la contiene, o con `*`, da `200` y una `ETag` nueva.
- [ ] Un `PUT` con `Content-Type: text/plain` da `415`, con una etiqueta vieja o sin ninguna.
- [ ] Un alta de `pagos` con `escritura-a` da `409` y dice con qué servicio choca; la misma petición con `escritura-b` da `201`.
- [ ] Un alta con `{"nombre":"","url":"ftp://archivos","limite_ms":5}` da `422` con tres renglones, y una con `["inventario"]` da `400`.
- [ ] Después de retirar el servicio 2, el equipo a recibe `410` y el equipo b recibe `404`, con el mismo cuerpo que el de un servicio que nunca existió.
- [ ] `/v1/servicios/1` trae `Deprecation`, `Sunset` y `Link`, y `node fig03_03.ts /v1/servicios` dice que el orden es correcto; `/v0/servicios` da `410` sin credencial.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/` da el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Qué pregunta decide entre `409`, `412` y `422`? Da un ejemplo del `revisor` para cada uno.
2. ¿Qué es la actualización perdida, y en qué paso de los cuatro ocurre?
3. Si el `revisor` ya comparó `If-Match` al principio, ¿por qué vuelve a comparar la versión al escribir? ¿Cuál es el equivalente en una base de datos?
4. ¿Por qué `If-Match` se compara en fuerte, y qué responde el `revisor` a una etiqueta `W/` que en débil sí coincidiría?
5. ¿Qué tiene que hacer un cliente después de un `412`, y qué después de un `428`? ¿Por qué no es lo mismo?
6. ¿Por qué la condición se evalúa antes de leer el cuerpo? ¿Qué sección del RFC 9110 lo dice?
7. ¿Cuándo una actualización perdida se responde con `409` y no con `412`?
8. ¿Cuál es la política del curso para `400` frente a `422`, y qué deciden otras guías?
9. ¿Qué dice un `410` que no dice un `404`? ¿Por qué el `revisor` no se lo dice a todos?
10. ¿Qué fecha da `Deprecation`, cuál da `Sunset`, qué peso tiene cada RFC, y qué regla relaciona las dos fechas?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [RFC 9110, *HTTP Semantics*, sección 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10): el `409`, el conflicto con el estado actual que el usuario puede resolver, el contenido que permite reconocer su origen y el ejemplo de versiones en un `PUT`.
2. [RFC 9110, sección 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11): el `410`, la condición probablemente permanente, el retiro intencional, la caché por heurística y la libertad de no marcarlo para siempre.
3. [RFC 9110, sección 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): el `404` no dice si la falta es temporal o permanente, y se prefiere el `410` cuando el servidor sabe que es permanente.
4. [RFC 9110, sección 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13): el `412`, una condición de las cabeceras que resultó falsa.
5. [RFC 9110, sección 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1): `If-Match`, su forma (`*` o una lista), la comparación fuerte obligatoria, los tres pasos de evaluación y la actualización perdida (*lost update*).
6. [RFC 9110, secciones 13.2.1 y 13.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1): cuándo se evalúan las precondiciones (antes de procesar el contenido, después de las revisiones normales) y en qué orden.
7. [RFC 9110, sección 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2): la comparación fuerte y la débil de etiquetas, con su tabla.
8. [RFC 9110, sección 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21): el `422`, contenido que se entiende y tiene sintaxis correcta pero no se puede procesar; y la [sección 9.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4), `PUT` como reemplazo del estado completo.
9. [RFC 6585, *Additional HTTP Status Codes*, sección 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3): el `428`, la petición condicional exigida contra la actualización perdida, la explicación de cómo reenviarla y la prohibición de guardarlo en caché.
10. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (marzo de 2025, estándar propuesto): la fecha de desaprobación como fecha de campo estructurado (2.1), su alcance (2.2), la relación `deprecation` para `Link` (3), la regla de que `Sunset` no sea anterior (4) y que desaprobar no cambia el comportamiento (5).
11. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (mayo de 2019, informativo): la fecha en que el recurso probablemente dejará de responder, como pista (3), y las dos etapas de la desaprobación (1.4); su [ficha en el datatracker de la IETF](https://datatracker.ietf.org/doc/rfc8594/), que la muestra como propuesta individual.
12. [RFC 9457, *Problem Details for HTTP APIs*, sección 3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3): el ejemplo con la extensión `errors` y un `pointer` por campo, que la Lección 5 adopta para el `422`.
13. [Registro de códigos de estado HTTP de la IANA](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml): los nombres oficiales de los cinco códigos, entre ellos `422 Unprocessable Content` y `428 Precondition Required`.
14. [*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/): `400` también para la validación de negocio y `422` como «no usar»; `412` para la concurrencia optimista con `If-Match` y `428` para exigirla.
15. [Google, AIP-154 *Resource freshness validation*](https://google.aip.dev/154) y [`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto): la etiqueta como campo del recurso, `ABORTED` (`409`) cuando no coincide e `INVALID_ARGUMENT` (`400`) para los argumentos inválidos; y la [documentación de la API REST de GitHub](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api), que responde `422` a la validación y a los valores repetidos (`already_exists`).

### Términos de esta lección

| | |
|---|---|
| **actualización perdida** (*lost update*) | cuando un cliente guarda su copia vieja de un recurso y borra, sin saberlo, el cambio que otro hizo después de que él leyó |
| **concurrencia optimista** | dejar que todos lean y editen sin bloquear, y rechazar solo la escritura que llega sobre una versión vieja |
| **conflicto de estado** | una petición válida que choca con lo que ya existe en el servidor; en otro estado funcionaría tal cual (`409`) |
| **desaprobado** (*deprecated*) | que ya no se recomienda usar, aunque todavía funcione |
| **precondición** | una condición que el cliente pone en una cabecera (`If-Match`) para que el método solo se ejecute si se cumple (`412` si no) |
| **regla de negocio** | una condición sobre los valores de los datos, que no depende del estado del servidor (`422` si no se cumple) |
| **retiro** (*sunset*) | el momento en que un recurso o una versión deja de responder |

---

**Anterior:** [Lección 2 — El cliente se equivocó (I): 400, 401, 403, 404, 405 y 415](02-errores-del-cliente-peticion.md) · **Siguiente:** [Lección 4 — Capacidad y fallas del servidor: 429, 500, 502, 503 y 504](04-capacidad-y-fallas-del-servidor.md)

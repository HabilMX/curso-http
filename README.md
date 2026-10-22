# Errores que enseñan: códigos HTTP y Problem Details — una API que dice la verdad cuando falla

**Por Dorian Chávez, fundador de Hábil y arquitecto de integración.**

**Cada respuesta que este curso documenta se produce de verdad con `curl` contra el programa de la lección y se compara automáticamente en cada cambio: código, cabeceras obligatorias, tipo de contenido y cuerpo.**

> El curso está en cinco idiomas: español (el original), inglés, francés, portugués de Brasil y búlgaro.

## En qué idiomas

El curso se escribe primero en español, que es el original, y se traduce después al inglés, al francés, al portugués de Brasil y al búlgaro.

## Para quién es

Quien ya escribió una API en cualquier lenguaje y alguna vez respondió `200` con un cuerpo que decía `{"error": …}`, usó `500` para todo lo que salió mal, o no supo explicar la diferencia entre `401` y `403`, entre `409` y `412`, entre `400` y `422`. Y quien consume APIs ajenas y quiere dejar de adivinar qué hacer cuando fallan. **Nivel intermedio:** se supone que sabes qué es una petición HTTP, qué es JSON y cómo levantar un servidor; no se supone que conozcas las especificaciones.

Los programas del curso están en TypeScript sobre Node 24 —que ejecuta archivos `.ts` directamente, quitándoles los tipos, siempre que usen solo sintaxis que se pueda borrar—, **sin una sola dependencia** y además revisados con `tsc` en modo estricto, porque es lo que más gente lee sin esfuerzo. Pero lo que se enseña es HTTP, no un lenguaje: el instrumento es `curl`, y cada decisión que el curso explica es la misma en Go, Java, Python o Rust. Si quieres el lenguaje, el [curso de TypeScript](https://github.com/HabilMX/curso-typescript) de esta casa es el camino.

## Por qué un curso sobre errores

El camino feliz de una API se escribe solo; lo que se nota, lo que se paga y lo que más tarda en arreglarse es lo que pasa cuando algo sale mal. Una respuesta de error es el único momento en que una API le dice algo a su cliente sin que este lo haya pedido, y casi siempre lo dice mal: con el código equivocado, con un cuerpo que cambia de forma en cada ruta, o con tanto detalle interno que ya es una fuga. **El código de estado es la parte del mensaje que lee cualquier máquina del camino —el navegador, la caché, el balanceador, el monitor, el cliente—, y por eso es una decisión de diseño que se documenta, no un adorno.**

El curso se organiza alrededor de esa idea: cada familia de errores se enseña **provocándola**, viendo qué responde el servidor, y luego eligiendo el código con una pregunta que se puede contestar, no con una intuición.

## El proyecto que crece

El **`revisor`**, el mismo de los cursos de Go, Rust y TypeScript: el programa que revisa el estado de una lista de servicios —nombre, estado y tiempo de respuesta—. Aquí tiene **dos caras**, y las dos enseñan errores:

- **El `revisor` como servidor:** una pequeña API para administrar la lista de servicios que observa (dar de alta, consultar, cambiar, retirar, pedir una revisión). Es la cara que *produce* errores, y tiene que producirlos bien: el código correcto, las cabeceras que cada código exige y un cuerpo que explica lo que pasó sin revelar de más.
- **El `revisor` como cliente:** el que consulta a los servicios y decide, según lo que le responden, si están disponibles, limitados, en mantenimiento o caídos, y si vale la pena reintentar. Es la cara que *lee* errores, y un `503` con `Retry-After` no significa lo mismo que un `404`.

Se repite el proyecto y no se inventa otro porque quien hizo Go o TypeScript ya conoce el problema, y de ver cómo una misma conversación HTTP se escribe de un lado y se lee del otro se aprende más que de empezar de nuevo. Lo que cambia es la pregunta: no «¿se pudo consultar?», sino «¿qué *dijo* el servicio y qué debo hacer con eso?».

Para que cada código se pueda provocar a voluntad, la lección 0 construye un **servidor de pruebas** que responde el código que se le pida (`GET /codigo/503`), con las cabeceras que ese código lleva. Es el banco de pruebas de todo el curso.

## Las lecciones

Numeración única y continua: «Lección N», de la 0 a la 8. **Son nueve y no diez, a propósito:** el catálogo es acotado —23 códigos— y una sola especificación gobierna el cuerpo del error (el RFC 9457); estirar el tema a diez lecciones habría sido relleno. Las respuestas de éxito y las redirecciones comparten lección porque, en una API, lo difícil de ellas son las mismas tres decisiones.

| # | Lección | Qué construyes | Qué aprendes |
|---|---|---|---|
| 0 | El contrato que viaja por HTTP | el servidor de pruebas y tu instrumento: `curl -i` | qué es una respuesta: línea de estado, cabeceras, cuerpo; las cinco familias; **el código manda y el cuerpo explica**; qué hace una máquina con un código que no conoce; los registros oficiales; por qué un `200` con `{"error": …}` rompe la caché, el monitor y al cliente |
| 1 | Éxitos y redirecciones: 200, 201, 202, 204, 301, 308 y 304 | las rutas que dan de alta, consultan y retiran servicios; la ruta heredada que se redirige | elegir entre devolver, crear, aceptar y no devolver nada; `Location`; **`202` y el recurso de seguimiento**; qué cambia entre `301` y `308` cuando hay un `POST`; peticiones condicionales con `ETag` e `If-None-Match`, y por qué un `304` no lleva cuerpo. **Recuadro de seguridad:** el **SSRF** (falsificación de peticiones del lado del servidor): como el `revisor` consulta servicios ajenos, rechaza las direcciones de loopback, de redes privadas, de enlace local y de metadatos de la nube, y las de ULA de IPv6, y lo valida **antes de cada conexión, después de resolver el DNS**; el laboratorio tiene una excepción por IP y puerto exactos; la defensa completa contra el *DNS rebinding* (conectar a la IP ya validada) llega en la lección 8 |
| 2 | El cliente se equivocó (I): 400, 401, 403, 404, 405 y 415 | la puerta de la API: ruta, método, credencial, permiso, existencia, formato y lectura | siete pasos en orden: ruta → método → credencial → permiso → existencia → formato → lectura; `WWW-Authenticate` y `Allow` obligatorios; el `413` del tope de 16 KiB del cuerpo (red de seguridad, fuera de los 23); cuándo un `404` esconde a propósito. **Recuadro de seguridad:** el `404` que esconde un recurso que sí existe y la **enumeración de recursos** (quien prueba identificadores uno tras otro y aprende cuáles existen porque el `403` y el `404` no se responden igual) |
| 3 | El cliente se equivocó (II): 409, 410, 412, 422 y 428 | el cambio de un servicio sin pisar el de otra persona | conflicto de estado frente a regla de negocio frente a precondición; **la actualización perdida** y cómo `ETag` con `If-Match` la evita; `412` frente a `428`; `410` frente a `404`; la política escrita para `400` frente a `422`; **versiones de API**: cómo se anuncia el retiro de una versión antes de que llegue el `410`, con `Deprecation` ([RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html), marzo de 2025, estándar propuesto: la fecha en que el recurso quedó o quedará desaprobado) y `Sunset` ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html), mayo de 2019, informativo: la fecha en que probablemente dejará de responder), y por qué la segunda nunca puede ser anterior a la primera |
| 4 | Capacidad y fallas del servidor: 429, 500, 502, 503 y 504 | límite de peticiones, mantenimiento y una dependencia lenta | quién tiene la culpa y quién puede arreglarlo; `Retry-After`; `500` frente a `502` frente a `504`; **qué se dice y qué jamás se dice** en un error del servidor (pilas, SQL, rutas, secretos). **Recuadro de seguridad:** lo que jamás se dice en un error, y el `429` como defensa: el `revisor` limita por credencial lo que sale a la red (las revisiones y la consulta en vivo), y cuenta también los `404` de quien prueba ids uno tras otro; la fuerza bruta sobre las credenciales se frena en otra capa (el proveedor de identidad o la pasarela), y el recuadro lo explica |
| 5 | Problem Details (RFC 9457) | el manejador central de errores del `revisor` | `application/problem+json`; `type`, `title`, `status`, `detail` e `instance` y para qué sirve cada uno; **`type` como identificador estable**; extensiones; varios problemas en una respuesta; lo que cambió respecto al RFC 7807; el registro oficial de tipos; con `about:blank`, el `title` va en inglés, porque la RFC 9457 (§4.2.1) pide que sea la frase del estado HTTP, mientras que `detail` sí puede ir en español |
| 6 | Reintentos e idempotencia | un `POST` que se puede repetir sin duplicar | métodos seguros e idempotentes según la especificación; cuándo reintentar y cuándo no; retroceso exponencial con *jitter*; `Idempotency-Key` y por qué todavía **no es un estándar**; qué hacer cuando un `502` no dice si la escritura ocurrió |
| 7 | Quien lee el error: el cliente del `revisor` y los agentes de IA | la clasificación de las respuestas de los servicios que el `revisor` consulta | una tabla de decisión por código y por `type`: corregir, reautenticar, esperar, reconciliar o rendirse; por qué un error bien diseñado ahorra llamadas; **cómo usa un agente de IA los mismos campos** y por qué no debe interpretar frases en lenguaje natural |
| 8 | El contrato verificable | la descripción OpenAPI de las respuestas y la matriz de 23 escenarios | documentar cada respuesta de error en OpenAPI 3.1; el catálogo de tipos de problema; la matriz `curl` que comprueba código, cabeceras, tipo y cuerpo de **cada** código del curso; **versiones de API en OpenAPI**: `deprecated: true` en lo que se retira, `Deprecation` y `Sunset` documentadas como cabeceras de respuesta, y por qué `info.version` es la versión del documento y no la de la API; qué sigue |

Lo que la tabla promete por lección es lo que la lección trae.

**Los 23 códigos del curso:** `200`, `201`, `202`, `204`, `301`, `304`, `308`, `400`, `401`, `403`, `404`, `405`, `409`, `410`, `412`, `415`, `422`, `428`, `429`, `500`, `502`, `503` y `504`. Otros aparecen de paso, para decir en qué se distinguen de los anteriores (`302`, `307`, `406`, `501`), pero no son protagonistas. El `413` tampoco cuenta entre los 23, pero el `revisor` sí lo responde: es la red de seguridad del tope de 16 KiB del cuerpo, que la lección 2 explica junto al `415`. Cada código se enseña con tres cosas: **cuándo sí, cuándo no (y cuál va en su lugar) y la respuesta mínima correcta.**

**Tres criterios atraviesan todo el curso.** El primero: **el código manda y el cuerpo explica, y los dos dicen lo mismo**; el cuerpo nunca contradice ni sustituye al código. El segundo: **un error bien diseñado dice qué hacer** —corregir la entrada, autenticarse, esperar, releer el estado, rendirse—, porque quien lo recibe es casi siempre un programa. El tercero: **lo que sale hacia fuera se diseña**; un error es una superficie pública, y lo que no se dice (pilas, consultas, rutas, nombres de máquinas, claves) importa tanto como lo que se dice.

**Dos decisiones se escriben como política, no como intuición:** `400` frente a `422` (el curso adopta `400` para lo que no se puede leer y `422` para lo que se lee pero no se puede cumplir, y explica que otras guías de diseño de APIs deciden distinto), y cuándo un `404` esconde a propósito un recurso que sí existe.

**La seguridad va en recuadros.** Donde un código de estado puede filtrar información o servir de defensa, la lección lo dice en un recuadro de seguridad aparte, para que se vea sin buscarlo: en la lección 1, el **SSRF** (el `revisor` consulta servicios ajenos y rechaza loopback, redes privadas, enlace local y metadatos, y ULA, validándolo antes de cada conexión, después de resolver el DNS; el laboratorio tiene una excepción por IP y puerto exactos, y la defensa completa contra el *DNS rebinding* llega en la lección 8); en la lección 2, el `404` que esconde a propósito y la enumeración de recursos; en la lección 4, lo que jamás se dice en un error y el `429` como defensa. El recuadro no sustituye al curso de seguridad de APIs: señala dónde un error mal diseñado abre una puerta.

**Las versiones de API se enseñan donde duelen, no en una lección aparte.** El retiro de una versión es un `410` anunciado con tiempo, y por eso entra en la lección 3 junto a ese código, con las cabeceras `Deprecation` (RFC 9745) y `Sunset` (RFC 8594); y su descripción verificable entra en la lección 8, con OpenAPI. Las dos cabeceras no tienen el mismo peso, y el curso lo dice: `Deprecation` es un estándar propuesto de la IETF, mientras que el RFC 8594 que define `Sunset` es un documento informativo, publicado fuera de un grupo de trabajo; ninguna obliga a nada, son avisos que el cliente puede leer. El número de lecciones y la lista de los 23 códigos no cambian.

**Lo que este curso NO enseña, a propósito:** autenticación y autorización a fondo (los tokens, las identidades y las pasarelas son de otro tema), los códigos de WebDAV, los detalles de HTTP/2 y HTTP/3, los errores de GraphQL y de gRPC (que no usan estos códigos del mismo modo), los errores de CORS (que no son una respuesta del servidor sino una decisión del navegador), ni inventar códigos propios. Quien entienda estas nueve lecciones los lee en una tarde cuando los necesite.

**Una advertencia que el curso repite donde hace falta:** hay dos cabeceras muy usadas que **todavía no son un estándar**. `Idempotency-Key` es un borrador de la IETF que expiró sin publicarse como RFC, y las cabeceras `RateLimit-*` también circulan como borrador. El curso las enseña como lo que son, un patrón que la API documenta y no un requisito de HTTP, y lo dice cada vez que aparecen.

## La plantilla de cada lección

Igual en todas:

1. **Encabezado:** «Lección N — título», tiempo (90 min o 2 × 45) y «Al terminar vas a poder…» (3 a 7 objetivos medibles).
2. **El porqué antes del cómo:** qué le pasa al cliente —y a quien opera la API— cuando el error se hace mal, con un caso del `revisor`.
3. **Los conceptos**, uno por sección, **máximo tres códigos o ideas nuevas por bloque**: explicación, la pregunta que decide el código, ejemplo mínimo con `curl -i` y ejemplo en el `revisor`.
4. **El error que vas a ver:** la respuesta real que produce el defecto, tal como la imprime `curl`, qué está mal en ella y cómo se arregla. Se provoca a propósito: primero se rompe, luego se ve, luego se arregla.
5. **Lo que se hace mal** (antipatrones), con su costo para quien consume la API.
6. **Ejercicios** (2 a 4), de menor a mayor, con sus **soluciones** aparte.
7. **Cómo sé que lo logré:** medible. Tal `curl` da tal código, tales cabeceras y tal cuerpo.
8. **Fuentes:** de 10 a 15, primarias (las especificaciones, el registro oficial, la documentación de quien opera APIs a gran escala), enlazadas y con la fecha en que se consultaron.

## Cómo cierras el curso

El curso no se acaba cuando leíste la lección 8, sino cuando tu API cumple estas cinco cosas. Son las mismas que la verificación comprueba en cada cambio:

1. **La matriz de 23 escenarios corre con un solo comando**, y cada fila comprueba código, cabeceras obligatorias, tipo de contenido y cuerpo; no basta con «que salga un error».
2. **Ninguna respuesta de error es `200` ni HTML.** Todas son `application/problem+json`, con un `type` estable que no cambia de una ocurrencia a otra.
3. **Ningún cuerpo de un `5xx` contiene pilas, consultas, rutas ni claves**, y una búsqueda automática lo comprueba.
4. **Un `POST` repetido con la misma llave no duplica nada.** Si la misma llave llega con OTRO cuerpo, responde `422`; si llega mientras la petición original todavía está en curso, responde `409`. Esto viene del borrador de la IETF «The Idempotency-Key HTTP Header Field» (`draft-ietf-httpapi-idempotency-key-header-07`, vencido el 18 de abril de 2026), que NO es un estándar.
5. **El `revisor` clasifica los 23 casos con una tabla** y no reintenta lo que no debe reintentar.

## Cómo se comprueba que los programas funcionan

Hace falta [Node.js](https://nodejs.org/en/download) 24 LTS y `curl` (en Linux Mint: `sudo apt install curl`). Cada lección tiene su programa y su guion de pruebas: se levanta el servidor de la lección, en otra terminal se ejecutan las peticiones de la lección con `curl -i`, y las respuestas se comparan con las documentadas.

**La comparación mira lo que importa y no lo que cambia en cada corrida:** el código, las cabeceras que la lección declara y el cuerpo. `Date`, los identificadores generados y los tiempos se omiten, y el guion dice cuáles. Los escenarios que a propósito prueban un defecto traen la respuesta mala que la lección enseña a reconocer.

**Las lecciones son la fuente; los programas se extraen de ellas**, de los bloques de código del texto, y una verificación comprueba que lo extraído sea idéntico a lo que dicen las lecciones. Así lo que lees y lo que ejecutas no pueden diferir.

## La profundidad se mide

Cada lección tiene al menos 3,000 palabras de explicación, como las del curso de Go. Se cuentan las **palabras de explicación** (lo que está fuera de los bloques de código) y se exigen dos varas absolutas: **piso de 3,000 palabras por lección y mediana del curso de 4,000**. Si no se cumplen, la verificación se pone roja.

Se cuentan palabras y no líneas porque las líneas se inflan: una frase por línea suma muchas líneas sin explicar más. Y las varas son absolutas y no «la mitad de la mediana del curso» porque ese criterio se muerde la cola: unas lecciones flacas bajan la mediana y entonces pasan. Un criterio relativo garantiza uniformidad, no profundidad. Las varas se calibraron con el curso de Go: lecciones de 3,269 a 5,097 palabras, mediana 4,321.

## Las fuentes se cuentan

Toda afirmación del curso sobre lo que un código «significa» o lo que una cabecera «exige» se apoya en la especificación que la define (el RFC 9110 para la semántica de HTTP, el RFC 9457 para los Problem Details, el RFC 6585 para `428` y `429`, el RFC 9111 para la caché) y se enlaza al final de la lección donde se usa, con el registro oficial de la IANA como árbitro de qué existe. Donde el curso toma una decisión que la especificación deja abierta, lo dice: es criterio de diseño, no norma. El curso en conjunto cita **al menos cien fuentes primarias**, y se cuentan.

## Qué es un programa y qué es un fragmento

**No todo bloque de código de este curso es un programa completo.** Un **programa** corre solo: su bloque empieza con un comentario `// figNN_NN.ts` y trae, justo después, las peticiones `curl` reales y la respuesta que producen. Cada uno se levanta, se prueba con `curl` y se compara en cada cambio. Un **fragmento** es una ilustración que no pretende correr por sí sola, y por eso no se verifica; se reconoce porque su bloque no empieza con ese comentario. Los ejemplos de respuesta HTTP que se muestran para explicar (`HTTP/1.1 409 Conflict …`) son fragmentos, salvo que la lección diga que salieron de una corrida.

## Reglas del curso

- **Licencia CC BY-SA 4.0:** el material es público y se puede reusar citando la fuente.
- **Multiidioma:** el español es el original; las demás ediciones son traducciones y se revisan cuando el original cambia.
- **El HTTP no se traduce.** Los métodos, los códigos, las cabeceras, los nombres de archivo y los identificadores del código quedan como están; se traducen las explicaciones, los ejercicios, los errores y el glosario. En las respuestas de ejemplo, el `title` y el `detail` de un Problem Details se traducen a cada idioma —y la lección 5 explica por qué esa es justo la parte que se puede traducir—, pero el `type` y los códigos de máquina son idénticos en las cinco ediciones.
- Los `type` de los ejemplos usan un dominio reservado para documentación (`.example`), nunca el de una empresa real.
- Antes de publicar se revisa que el material no contenga rutas internas ni claves.
- Sin emojis en los títulos de las lecciones.

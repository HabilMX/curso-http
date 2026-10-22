# Errores que enseñan: códigos HTTP y Problem Details — una API que dice la verdad cuando falla

**Por Dorian Chávez, fundador de Hábil y arquitecto de integración.**

**Para quién es:** quien ya escribió una API en cualquier lenguaje y alguna vez respondió `200` con un cuerpo que decía `{"error": …}`, usó `500` para todo lo que salió mal, o no supo explicar la diferencia entre `401` y `403`, entre `409` y `412`, entre `400` y `422`; y quien consume APIs ajenas y quiere dejar de adivinar qué hacer cuando fallan. Es un curso de nivel intermedio: se supone que sabes qué es una petición HTTP, qué es JSON y cómo levantar un servidor. No se supone que conozcas las especificaciones: cada código se explica cuando aparece, y se explica por qué existe, no solo cuál número usar.

**Qué vas a terminar sabiendo:** elegir el código correcto con una pregunta que se puede contestar, producir respuestas de error que una máquina sabe leer (el formato de los *Problem Details* del RFC 9457), decidir qué se reintenta y qué no, y demostrar con `curl` que tu API hace lo que dice. Y quedarte con el criterio para leer las especificaciones por tu cuenta.

**Lo que necesitas antes de empezar:** una computadora con Linux Mint, saber abrir una terminal y leer un programa corto en TypeScript. Los programas usan Node 24 sin una sola dependencia, y el instrumento de todo el curso es `curl`. La [Lección 0](00-el-contrato-que-viaja.md) deja el entorno listo.

**Dónde sigue:** si quieres ver el mismo cuidado aplicado a una API entera, los artículos de esta casa sobre [APIs listas para agentes de IA](https://www.habil.mx/es/blog/apis-listas-para-agentes-de-ia/), sobre [seguridad de APIs](https://www.habil.mx/es/blog/seguridad-apis-cto-identidad-gateway-tokens/) y sobre [REST o gRPC](https://www.habil.mx/es/blog/rest-o-grpc-cuando-conviene-cada-uno/) continúan donde este curso termina.

## El proyecto que vas a construir

El **`revisor`**, el programa que revisa el estado de una lista de servicios —nombre, estado y tiempo de respuesta—, con **dos caras**:

- Como **servidor**, una pequeña API para administrar la lista de servicios que observa: dar de alta, consultar, cambiar, retirar y pedir una revisión. Es la cara que *produce* errores, y tiene que producirlos bien.
- Como **cliente**, el que consulta a los servicios y decide, según lo que le responden, si están disponibles, limitados, en mantenimiento o caídos, y si vale la pena reintentar. Es la cara que *lee* errores.

Es el mismo problema de los cursos de Go, Rust y TypeScript de esta casa. Lo que cambia es la pregunta: no «¿se pudo consultar?», sino «¿qué *dijo* el servicio y qué debo hacer con eso?». Y para provocar cada código a voluntad, la lección 0 construye un servidor de pruebas que responde el código que le pidas.

## Las nueve lecciones

Son nueve y no diez porque el catálogo es acotado (23 códigos) y una sola especificación gobierna el cuerpo del error. Las respuestas de éxito y las redirecciones comparten la lección 1 porque, en una API, lo difícil de ellas son las mismas tres decisiones.

| Lección | | Qué construyes | Qué aprendes |
|---|---|---|---|
| 0 | [El contrato que viaja por HTTP](00-el-contrato-que-viaja.md) | el servidor de pruebas y tu instrumento: `curl -i` | línea de estado, cabeceras y cuerpo; las cinco familias; el código manda y el cuerpo explica; qué hace una máquina con un código que no conoce; los registros oficiales |
| 1 | [Éxitos y redirecciones: 200, 201, 202, 204, 301, 308 y 304](01-exitos-redirecciones.md) | las rutas que dan de alta, consultan y retiran servicios; la ruta heredada | devolver, crear, aceptar o no devolver nada; `Location`; `202` y su recurso de seguimiento; `301` frente a `308`; `ETag` e `If-None-Match`. **Recuadro de seguridad:** SSRF; el `revisor` rechaza loopback, redes privadas, enlace local o metadatos y ULA, lo valida antes de cada conexión (después de resolver el DNS) y el laboratorio solo admite una excepción por IP y puerto exactos; la defensa completa contra el *DNS rebinding* llega en la lección 8 |
| 2 | [El cliente se equivocó (I): 400, 401, 403, 404, 405 y 415](02-errores-del-cliente-peticion.md) | la puerta de la API | siete pasos en orden: ruta → método → credencial → permiso → existencia → formato → lectura; `WWW-Authenticate` y `Allow`; cuándo un `404` esconde a propósito; el `413` del tope de 16 KiB del cuerpo (red de seguridad, fuera de los 23). **Recuadro de seguridad:** el `404` que esconde a propósito y la enumeración de recursos |
| 3 | [El cliente se equivocó (II): 409, 410, 412, 422 y 428](03-errores-del-cliente-estado.md) | el cambio de un servicio sin pisar el de otra persona | conflicto, regla de negocio y precondición; la actualización perdida; `ETag` con `If-Match`; `410` frente a `404`; `400` frente a `422`; **versiones de API**: el retiro anunciado antes del `410`, con `Deprecation` (RFC 9745) y `Sunset` (RFC 8594) |
| 4 | [Capacidad y fallas del servidor: 429, 500, 502, 503 y 504](04-capacidad-y-fallas-del-servidor.md) | límite de peticiones, mantenimiento y una dependencia lenta | quién tiene la culpa; `Retry-After`; `500`, `502` y `504`; qué jamás se dice en un error del servidor. **Recuadro de seguridad:** lo que jamás se dice en un error y el `429` como defensa |
| 5 | [Problem Details (RFC 9457)](05-problem-details.md) | el manejador central de errores | `application/problem+json`; los cinco miembros; `type` estable; extensiones; varios problemas; del RFC 7807 al 9457; con `about:blank`, el `title` va en inglés, porque la RFC 9457 (§4.2.1) pide que sea la frase del estado HTTP, mientras que `detail` sí puede ir en español |
| 6 | [Reintentos e idempotencia](06-reintentos-idempotencia.md) | un `POST` que se puede repetir sin duplicar | métodos seguros e idempotentes; retroceso exponencial con *jitter*; `Idempotency-Key` y por qué aún no es un estándar |
| 7 | [Quien lee el error: el cliente del `revisor` y los agentes de IA](07-quien-lee-el-error.md) | la clasificación de las respuestas de los servicios revisados | tabla de decisión por código y por `type`; corregir, reautenticar, esperar, reconciliar o rendirse; cómo usa un agente de IA los mismos campos |
| 8 | [El contrato verificable](08-contrato-verificable.md) | la descripción OpenAPI y la matriz de 23 escenarios | documentar cada error en OpenAPI 3.1; el catálogo de tipos de problema; la matriz `curl` completa; las versiones de API en OpenAPI |

Al final de cada lección hay ejercicios con sus soluciones. Y la [bitácora](bitacora.md) es tuya: anota ahí lo que te costó.

## Los 23 códigos del curso

| Familia | Códigos | Lección |
|---|---|---|
| Éxito | `200`, `201`, `202`, `204` | 1 |
| Redirección y caché | `301`, `308`, `304` | 1 |
| El cliente se equivocó: la petición | `400`, `401`, `403`, `404`, `405`, `415` | 2 |
| El cliente se equivocó: el estado | `409`, `410`, `412`, `422`, `428` | 3 |
| Capacidad y fallas del servidor | `429`, `500`, `502`, `503`, `504` | 4 |

Otros aparecen de paso, para decir en qué se distinguen de los anteriores (`302`, `307`, `406`, `501`). El `413` tampoco cuenta entre los 23, pero el `revisor` sí lo responde: es la red de seguridad del tope de 16 KiB del cuerpo, que la lección 2 explica junto al `415`. De cada código el curso te enseña **cuándo sí, cuándo no (y cuál va en su lugar) y la respuesta mínima correcta**.

## Tres criterios que atraviesan todo el curso

**El código manda y el cuerpo explica, y los dos dicen lo mismo.** El código de estado es lo que lee cualquier máquina del camino —el navegador, la caché, el balanceador, el monitor—; el cuerpo es para quien necesita el detalle. Un cuerpo que contradice al código, o que lo sustituye, rompe a todos los que no lo leen.

**Un error bien diseñado dice qué hacer.** Corregir la entrada, autenticarse, esperar, releer el estado o rendirse: casi siempre quien recibe el error es un programa, y un programa no adivina. Por eso cada lección cierra con la pregunta «¿qué debe hacer quien recibe esto?».

**Lo que sale hacia fuera se diseña.** Un error es una superficie pública. Lo que no se dice —pilas, consultas, rutas, nombres de máquinas, claves— importa tanto como lo que se dice, y se enseña donde aparece, no en un módulo final de seguridad.

**Una advertencia de honestidad:** `Idempotency-Key` y las cabeceras `RateLimit-*` **todavía no son un estándar**; circulan como borradores de la IETF. El curso las enseña como un patrón que la API documenta y no como un requisito de HTTP, y lo dice cada vez que aparecen.

## Cómo sabes que terminaste

El curso no se acaba cuando leíste la lección 8, sino cuando tu API cumple estas cinco cosas. Son las mismas que la verificación comprueba en cada cambio:

1. **La matriz de 23 escenarios corre con un solo comando**, y cada fila comprueba código, cabeceras obligatorias, tipo de contenido y cuerpo.
2. **Ninguna respuesta de error es `200` ni HTML.** Todas son `application/problem+json` con un `type` estable.
3. **Ningún cuerpo de un `5xx` contiene pilas, consultas, rutas ni claves.**
4. **Un `POST` repetido con la misma llave no duplica nada.** Si la misma llave llega con OTRO cuerpo, responde `422`; si llega mientras la petición original todavía está en curso, responde `409`. Esto viene del borrador de la IETF «The Idempotency-Key HTTP Header Field» (`draft-ietf-httpapi-idempotency-key-header-07`, vencido el 18 de abril de 2026), que NO es un estándar.
5. **El `revisor` clasifica los 23 casos con una tabla** y no reintenta lo que no debe reintentar.

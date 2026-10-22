# Lección 8 — El contrato verificable

Son las 10:05 de un martes y entra el primer aviso del equipo de integraciones de otra empresa, la que lleva tres semanas construyendo su programa contra la API del `revisor`. Dicen que su cliente se volvió loco: reintenta cada cincuenta milisegundos, sin parar, contra el modo de mantenimiento. Alguien de tu equipo mira los registros y no encuentra nada raro. El modo de mantenimiento responde `503`, como siempre. Las pruebas del equipo pasaron anoche, todas en verde, y el tablero de disponibilidad está verde. A las 10:20 llega el segundo aviso: su programa ya no reconoce los errores. Esperaba un `application/problem+json` y recibe un `application/json`, así que la rama que lee el `type` no se ejecuta, y cae a la que reintenta a ciegas. A las 10:40, un tercero: el `503` ya no trae `Retry-After`, y su programa, sin ese número, usa el que tenía por omisión, que es casi nada.

La causa aparece a las 11:00, en una revisión de lo que se subió el lunes. Alguien hizo una «limpieza» del manejador central de errores: unificó el tipo de contenido de todas las respuestas y, de paso, quitó una cabecera que le pareció de más. Ninguno de los **códigos** cambió. Un `503` sigue siendo un `503`; un `404`, un `404`. Y como las pruebas del equipo solo preguntaban por el código, ninguna lo notó. Lo que cambió fue todo lo demás que la API prometía en sus respuestas: el tipo de contenido, la cabecera de espera, la forma en que una máquina decide qué hacer. Y esa promesa no estaba escrita en ningún lado donde un programa pudiera compararla con la realidad.

Esa promesa es lo que construye esta lección: una descripción de la API en un formato que las máquinas leen (OpenAPI), y una **matriz** que, con un solo comando, hace 23 peticiones, mira lo que la API realmente responde y lo compara con lo prometido, incluidas las cabeceras, el tipo de contenido y la forma del cuerpo. Si alguien vuelve a hacer una limpieza como la del lunes, la matriz se pone roja el mismo lunes, no el martes a las 10:05.

**Tiempo:** 2 × 45 min (el corte está entre las secciones 8.7 y 8.8)

**Qué construyes:** la descripción OpenAPI 3.1 del `revisor` (`openapi.json`), con cada ruta, cada error y cada cabecera; la matriz de 23 escenarios (`matriz23.ts`) que levanta el servidor, recorre un escenario por código y se apaga sola; la misma matriz escrita con `curl` (`fig08_03.sh`); un programa que cruza el catálogo de tipos de problema con el documento (`fig08_02.ts`); y el cierre de la defensa contra el *DNS rebinding* en `cliente.ts`, con una simulación que lo demuestra (`fig08_04.ts`) y una contraprueba del certificado (`fig08_07.ts`); y los programas con que se midió una comprobación que fallaba a veces (`fig08_05.ts` para una carrera de red, `fig08_06.ts` para el tiempo de arranque de un proceso y `fig08_08.sh` para repetir la matriz)

**Qué aprendes:** qué es una descripción OpenAPI y cómo se lee en cinco piezas (`info`, `servers`, `security`, `paths` y `components`); cómo documentar cada error con respuestas reutilizables, el esquema `Problema` y las cabeceras que cada código obliga; cómo comprobar que el catálogo de tipos y el documento dicen lo mismo; qué comprueba una matriz y qué no, y cómo se demuestra que una prueba «muerde» deshaciendo el arreglo y viéndola en rojo; la diferencia entre un documento **válido** y un documento **cierto**; el *DNS rebinding* y por qué conectarse a la dirección ya validada lo cierra; y cómo se documenta en OpenAPI la retirada anunciada de una versión

**De dónde vienes.** De la [Lección 7](07-quien-lee-el-error.md), con un `revisor` completo en sus dos caras: como servidor produce los 23 códigos con sus Problem Details, y como cliente decide, con una tabla, si seguir, corregir, reautenticar, esperar, reconciliar o rendirse. De la [Lección 5](05-problem-details.md) heredas el catálogo de tipos de problema (`problemas.ts`) y el programa de trece comprobaciones que anunció esta matriz; de la [Lección 6](06-reintentos-idempotencia.md), la cabecera `Idempotency-Key`, que aquí se documenta con la advertencia de que no es un estándar, y el comprobador de cinco pruebas, que la matriz repite; de la [Lección 3](03-errores-del-cliente-estado.md), los avisos `Deprecation` y `Sunset` de la versión 1; de la [Lección 2](02-errores-del-cliente-peticion.md), la decisión de que la forma de la API no es un secreto, porque va a estar en un documento que cualquiera puede leer; y de la [Lección 1](01-exitos-redirecciones.md), el límite que quedó declarado: el *DNS rebinding*, cuya defensa completa llega hoy.

**Qué no hace esta lección.** No genera clientes ni servidores a partir del documento: el documento se escribe a mano y se comprueba contra el servidor, que es una elección del curso y no la única posible. No compara el cuerpo de cada respuesta con su esquema JSON campo por campo: la matriz comprueba que el código, las cabeceras, el tipo de contenido y los miembros principales del cuerpo estén, y el ejercicio 2 la amplía un paso. No publica una página de documentación con el documento (existen visores que lo hacen, y el curso no los usa). No describe la autenticación de OAuth ni de otros esquemas: las credenciales del `revisor` son de práctica, y el documento las declara como `bearer`. Y no promete que una matriz verde signifique una API sin defectos: la sección 8.14 dice qué no ve.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS, con Node 24.14.1 (la versión 24 LTS con la que se corre todo el curso; existen versiones 24.x posteriores, y las salidas son de esa) y curl 8.7.1. El validador de OpenAPI de la sección 8.11 es Redocly CLI 2.57.0 (publicado el 30 de septiembre de 2026), instalado con `npm install` en una carpeta aparte, porque es una herramienta para revisar y no una dependencia de los programas, que siguen sin ninguna. Redocly escribe una parte de su salida en la salida de error y, si hay una versión nueva, imprime un recuadro de aviso; por eso sus corridas llevan `2>&1` y la variable `REDOCLY_SUPPRESS_UPDATE_NOTICE=true`, que ocultan solo ese recuadro. La revisión de tipos usó TypeScript 7.0.2, como en las lecciones anteriores. Mientras se escribía esta lección otras pruebas ocupaban los puertos del curso, así que las series se corrieron con una copia de los programas idéntica salvo por los puertos (cada serie con los suyos, comprobados libres antes de correr), y en las salidas pegadas aquí (y en sus archivos `.salida.txt`) se volvieron a escribir 18080, 18081 y 18082, que son los que vas a teclear tú. Son números con las mismas cifras, así que ningún `Content-Length` cambia. En tu corrida van a cambiar la fecha de `Date`, las ocho cifras finales de cada `ETag`, los milisegundos medidos (`ms`), el tiempo que mide Redocly y los `urn:uuid:` de los errores `500`. Las pruebas de la sección 8.12 que consultan `https://example.com`, `https://expired.badssl.com` y `https://wrong.host.badssl.com` necesitan internet; si tu máquina no tiene, salta esa serie y las demás siguen igual. La matriz completa tarda unos 16 segundos en una laptop. Corriendo la matriz decenas de veces seguidas se encontró una carrera entre el cierre de una conexión y el envío de un cuerpo; la sección 8.14 cuenta cómo se encontró, cómo se midió y cómo se cerró, con las cifras de antes y de después. Los programas están en [`programas/08-contrato-verificable/`](../programas/08-contrato-verificable), en el repositorio del curso: el `revisor` completo en `fig08_01/`, el cruce del catálogo en `fig08_02.ts`, la matriz con `curl` en `fig08_03.sh`, la simulación del *DNS rebinding* en `fig08_04.ts`, la contraprueba del certificado en `fig08_07.ts`, las mediciones de la sección 8.14.1 en `fig08_05.ts`, `fig08_06.ts` y `fig08_08.sh`, los defectos a propósito en `defectos/`, las soluciones de los ejercicios en `ejercicios/` y cada corrida en su archivo `.salida.txt`. Todos pasan `tsc` en modo estricto (sección 8.16).

## Al terminar vas a poder

- Leer un documento OpenAPI 3.1 e identificar sus cinco piezas principales, y explicar qué hace una referencia `$ref` y por qué las respuestas de error se escriben una vez y se reutilizan.
- Documentar una respuesta de error completa: su código, su tipo de contenido `application/problem+json`, el esquema `Problema` y la cabecera que ese código obliga (`Allow` en un `405`, `Retry-After` en un `429` y un `503`, `WWW-Authenticate` en un `401`).
- Correr un programa que cruza el catálogo de tipos de problema con el documento, y explicar por qué hoy encuentra un hueco y cómo se cierra.
- Correr la matriz de 23 escenarios con un solo comando, leerla renglón por renglón y decir qué se comprueba en cada escenario: código, cabeceras, tipo de contenido, cuerpo, fugas en los `5xx` y presencia en el documento.
- Provocar a propósito dos fallas, una en el servidor y otra en el documento, y leer la matriz en rojo; y explicar por qué un validador externo puede decir «válido» ante un documento que miente.
- Explicar qué es el *DNS rebinding*, por qué validar antes de cada conexión no lo cierra del todo, y mostrar con una corrida que el cliente de la lección llega al servidor correcto mientras uno que usa `fetch` llega al equivocado.
- Documentar en OpenAPI la retirada anunciada de una versión, con `deprecated: true` y las cabeceras `Deprecation`, `Sunset` y `Link`.
- Decir con ejemplos medidos qué no puede ver la matriz, y ampliarla un paso para que lo vea.

## El porqué antes del cómo

Una API es una promesa que se hace a gente que no está en la sala. Quien la escribió conoce lo que hace; quien la usa solo conoce lo que se le dijo. Entre las dos cosas hay un documento, y ese documento tiene un defecto de nacimiento: es de papel. Se escribe una vez, se lee con cuidado una vez, y desde ese momento el código cambia todos los días y el documento solo cambia cuando alguien se acuerda. Con el tiempo, el documento deja de describir la API y empieza a describir cómo era la API cuando alguien se acordó de actualizarlo.

Hay dos remedios, y esta lección junta los dos. El primero es que el documento sea **legible por máquinas**: si es un archivo con estructura, un programa puede leerlo, y lo que un programa puede leer, un programa puede comparar. El segundo es que esa comparación **corra sola**, en cada cambio, con un solo comando, y que falle con un mensaje que diga qué promesa se rompió. Un documento que se compara con la realidad a diario se parece mucho a una prueba; una prueba que se escribe a partir de un documento se parece mucho a una promesa. De ahí el nombre de la lección: un contrato *verificable* es uno que se puede verificar sin pedirle permiso a nadie.

Este orden tiene una consecuencia incómoda, y conviene decirla de entrada: hay tres lugares donde puede estar la mentira. Puede estar en el **servidor**, que cambió y el documento no (la escena del principio). Puede estar en el **documento**, que dice algo que el servidor nunca hizo. Y puede estar en la **prueba**, que verde o roja no mira lo que importa. Un validador de OpenAPI solo puede decir si el documento está bien escrito; no sabe nada del servidor. Una prueba de códigos solo mira los códigos. La matriz de esta lección mira los tres lugares a la vez, y aun así tiene puntos ciegos que la sección 8.14 enumera, porque una verificación que no dice lo que no ve tiene el mismo problema que el documento de papel.

La lección tiene cinco partes:

1. **El documento** (8.1 a 8.5): qué es OpenAPI, cómo se lee, cómo se documentan los errores y cómo se cruza el catálogo de tipos con lo escrito.
2. **La matriz** (8.6 a 8.9): cómo está hecha, qué comprueba en cada escenario, cómo se corre y su versión con `curl`.
3. **Que la prueba muerda** (8.10 y 8.11): cómo se demuestra que una verificación detecta lo que dice detectar, y por qué un documento válido no es lo mismo que un documento cierto.
4. **El hueco que queda de la Lección 1** (8.12): el *DNS rebinding* y su cierre.
5. **Versiones y límites** (8.13 a 8.16): la retirada anunciada de una versión en el documento, lo que la matriz no promete, el `revisor` completo y la revisión de tipos.

## Los conceptos

### 8.1 El `revisor` de esta lección

#### 8.1.1 Qué cambia

El `revisor` de la Lección 7 gana dos archivos nuevos, `matriz23.ts` y `openapi.json`, y cambia tres: `cliente.ts`, `destinos.ts` y `respuestas.ts`. Todo lo demás es el de las lecciones anteriores en su versión vigente, y las rutas, los códigos, las cabeceras y los nombres de los campos no cambian.

- **`openapi.json`** (nuevo) es la descripción de la API en OpenAPI 3.1.1: cada ruta, cada método, cada respuesta (éxitos y errores), los esquemas de los cuerpos y las cabeceras. Es el centro de las secciones 8.3 a 8.5.
- **`matriz23.ts`** (nuevo) levanta el laboratorio y el `revisor`, recorre 23 escenarios (uno por código del curso) y dieciocho comprobaciones adicionales, y los apaga. En lugar de esperar un tiempo fijo después de levantar cada proceso, espera a que el puerto acepte conexiones, y si algún puerto ya está ocupado no mide nada y lo dice. Sale con código `0` si todo pasó y con `1` si algo falló (`2` si no pudo empezar porque un puerto estaba ocupado). Es el centro de las secciones 8.6 a 8.10.
- **`cliente.ts`** cambia en `consultar` y gana dos funciones de apoyo, `soloA` y `pedir`: en lugar de `fetch`, usa `http.request` o `https.request` y se conecta a la dirección que `destinos.ts` ya validó. Es la sección 8.12.
- **`respuestas.ts`** cambia en una sola función: cuando el cuerpo pasa del tope, el `413` sale de inmediato y la conexión se cierra **por etapas** (primero solo la escritura; el servidor sigue leyendo y tirando lo que llegue, y destruye la conexión a los 2 segundos). Es la historia de la sección 8.14.1.
- **`destinos.ts`** cambia una cosa: `revisarDestino` ahora devuelve, junto con el «sí», las direcciones que validó (`{ permitido: true, direcciones }`), para que quien se conecte use una de esas y no vuelva a preguntarle al DNS.

Los desenlaces de `consultar` no cambian: sigue habiendo los mismos cinco tipos de resultado (respuesta, tiempo agotado, sin conexión, respuesta inválida y destino prohibido), la misma clasificación en `ARRIBA`, `LENTO` y `CAIDO`, y los mismos códigos en cada respuesta del servidor. Por eso `revisar.ts`, `tabla23.ts` y `por-type.ts`, los tres programas de la Lección 7, dan lo mismo que antes.

#### 8.1.2 Armar la carpeta y comprobar que corre

El `revisor` vive en `~/curso-http/fig08_01/`; la sección 8.15 trae todos sus archivos. Con Node 24 instalado, y desde esa carpeta, una sola línea comprueba que todo está en su lugar:

```text
$ cd ~/curso-http/fig08_01
$ node matriz23.ts
```

La matriz levanta ella sola el laboratorio y el `revisor`, así que no necesitas abrir terminales aparte. Lo que sí necesita es que los puertos 18080, 18081 y 18082 estén libres. Si alguno está ocupado, la matriz lo dice y sale con `2` sin medir nada; la causa más común es un `revisor` de una lección anterior que dejaste abierto: detén ese programa con `Ctrl+C` y vuelve a empezar. La sección 8.7 corre la matriz y lee su salida renglón por renglón.

### 8.2 Un contrato que se puede comprobar

#### 8.2.1 Qué se promete en una respuesta

Antes de abrir el documento conviene contar qué promete una respuesta, porque el documento tiene que decirlo todo y la prueba tiene que comprobarlo todo. Una respuesta HTTP promete cuatro cosas:

1. **El código de estado.** Es lo primero que lee cualquier máquina del camino. Es lo que la Lección 0 llamó «el código manda».
2. **Las cabeceras que ese código obliga o que el diseño decidió.** Un `405` obliga a mandar `Allow` (RFC 9110, sección 15.5.6: «The origin server MUST generate an Allow header field in a 405 response»). Un `401` lleva `WWW-Authenticate`. Un `201` lleva `Location` y, en esta API, `ETag`. Un `429` o un `503` llevan `Retry-After`, que la sección 15.6.4 del mismo RFC permite en el `503` con un «MAY». Esa diferencia importa: lo que el RFC deja opcional, esta API decidió mandarlo en cada respuesta que se lo permite, y lo promete en su documento.
3. **El tipo de contenido.** Un error es `application/problem+json`; un éxito con cuerpo es `application/json`; un `204` y un `304` no llevan cuerpo. El tipo de contenido es lo que le dice a un programa cómo leer lo que sigue.
4. **La forma del cuerpo.** En un Problem Details, los cinco miembros (`type`, `title`, `status`, `detail`, `instance`) y, según el tipo, extensiones como `errors` o `existente`.

La escena del principio rompió dos de las cuatro (la cabecera y el tipo de contenido) y dejó intacta la primera, que era la única que alguien comprobaba. Es un patrón común: se prueba lo que es fácil de probar, y el código de estado es lo más fácil. Una verificación completa tiene que subir de lo fácil a lo que importa.

#### 8.2.2 Los tres lugares donde puede estar la mentira

Si el documento, el servidor y la prueba son tres cosas distintas, hay tres maneras de que una promesa se rompa sin que nadie lo vea.

- **El servidor cambia y el documento no.** Es la escena del principio. La API hace algo distinto de lo que el documento dice. Quien leyó el documento y escribió su cliente a partir de él, queda con un programa que funciona contra una API que ya no existe.
- **El documento dice algo que el servidor nunca hizo.** Es el caso menos comentado y más común en documentos que se escriben a mano: se documenta lo que se pensaba hacer, o lo que se hizo en otra rama, o lo que se copió de otra API. El servidor nunca devuelve ese `429` o esa cabecera. Quien confía en el documento escribe código para un caso que no existe y no escribe el que sí.
- **La prueba no mira lo que importa.** Una prueba en verde dice que lo que miró está bien. No dice nada de lo que no miró, y la sección 8.14 (punto 2) y el ejercicio 2 provocan este caso con un ejemplo medido: la matriz que ya existe, con un servidor al que le falta uno de los cinco miembros de todos los errores, da 40 de 41 y casi no se entera.

Por eso esta lección no se queda en escribir el documento. Lo escribe, lo compara con el servidor, y después **deshace** el servidor y el documento a propósito, para ver que la comparación se pone en rojo. Una comprobación que nunca se vio fallar no demuestra nada: lo mismo daría verde si estuviera rota.

#### 8.2.3 Por qué OpenAPI

Para que un programa compare, el documento tiene que estar en un formato con estructura. El formato más extendido para describir APIs HTTP es **OpenAPI**, una especificación pública de la OpenAPI Initiative. La versión que usa el curso es la **3.1.1**, publicada el 24 de octubre de 2024 ([spec.openapis.org](https://spec.openapis.org/oas/v3.1.1.html)). Existen además el parche **3.1.2** y la línea **3.2** (3.2.0 y 3.2.1), que están en [la página de versiones](https://spec.openapis.org/oas/). El curso se queda en la 3.1.1 porque todas sus citas de sección y todas sus salidas se tomaron contra ella; no se comprobó qué herramientas ya entienden la 3.2, y mezclar versiones en una lección que cita números de sección sería una fuente de errores. Si empiezas un documento nuevo, mira primero cuál de las tres entiende tu herramienta. Un documento OpenAPI puede escribirse en JSON o en YAML, y el curso usa JSON porque Node lo lee sin ninguna dependencia.

La versión 3.1 trajo un cambio que se nota en el documento del `revisor`: alinea el esquema de datos con el **JSON Schema 2020-12**. La sección 4.8.24 de la especificación dice que el objeto de esquema de OpenAPI es un superconjunto de esa versión de JSON Schema. En la práctica, cuando un campo puede ser nulo, ya no se escribe `nullable: true` como en 3.0, sino que se escribe una lista de tipos: `"type": ["object", "null"]`. Lo vas a ver en el esquema `Resultado`, que es `null` mientras una revisión está pendiente ([la entrada del blog de OpenAPI sobre el paso de 3.0 a 3.1](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) cuenta ese y otros cambios).

### 8.3 OpenAPI en cinco piezas

Un documento OpenAPI de 1,191 líneas asusta, pero se lee como un libro con cinco capítulos. Lo que sigue los recorre con el `openapi.json` del `revisor` abierto al lado; las citas y los números de sección son de la especificación 3.1.1.

#### 8.3.1 Pieza 1: `openapi` e `info`

El documento empieza con cuatro campos que se leen de un vistazo (`openapi`, `info`, `servers` y `security`):

```json
  "openapi": "3.1.1",
  "info": {
    "title": "API del revisor",
    "version": "1.0.0",
    "summary": "Contrato verificable del curso de HTTP de Hábil.",
    "description": "info.version es la versión de ESTE documento, no la de la API. La API vigente vive en la raíz (/servicios); la v1 está desaprobada y la v0 retirada.",
    "license": {
      "name": "CC BY-SA 4.0",
      "identifier": "CC-BY-SA-4.0"
    }
  },
  "servers": [
    {
      "url": "http://127.0.0.1:18080"
    }
  ],
  "security": [
    {
      "credencial": []
    }
  ],
  "paths": {
```

Esa última línea abre la pieza 4, que vemos en 8.3.4. Lo anterior son las piezas 1, 2 y 3.

`openapi` dice **qué versión de la especificación** sigue el documento: `3.1.1`. Es lo primero que lee cualquier herramienta, porque de eso depende cómo interpretar el resto.

`info` describe **el documento**, y aquí hay una trampa que merece una línea propia. El campo `info.version` suena a «la versión de la API», y no lo es: la sección 4.8.2.1 de la especificación lo define como la versión *del documento OpenAPI* (que es distinta de la versión de la especificación), y la sección 4.8.1.1 aclara que no tiene relación con el campo `openapi`. El `revisor` tiene una API vigente (la de la raíz, `/servicios`), una versión 1 desaprobada y una versión 0 retirada; si `info.version` fuera «la versión de la API», ¿cuál de las tres sería? Por eso la `description` del documento lo dice con todas sus letras: `info.version` es la versión de *este documento*. Es el tipo de aclaración que ahorra una discusión de media hora con quien lo lee por primera vez.

`license` dice con qué licencia se publica el documento. La que usa el curso es CC BY-SA 4.0, y el campo `identifier` usa el identificador de SPDX, `CC-BY-SA-4.0`.

#### 8.3.2 Pieza 2: `servers`

```json
"servers": [{ "url": "http://127.0.0.1:18080" }]
```

Es la lista de direcciones donde vive la API. Si el campo no está, la especificación dice (sección 4.8.1.1) que el valor por omisión es un servidor con la `url` `/`, es decir, el mismo lugar desde donde se sirve el documento. El `revisor` lo escribe completo porque, en el curso, el documento viaja en un archivo y no se sirve desde ningún lado.

Fíjate en lo que **no** hay en esa lista: ninguna dirección interna de una empresa ni un nombre de máquina. Un documento OpenAPI casi siempre termina publicado; todo lo que escribas en `servers` lo va a leer cualquiera. Para el curso es `127.0.0.1:18080`, que no es una máquina de nadie.

#### 8.3.3 Pieza 3: `security` y `securitySchemes`

La lista de `security` de arriba dice que, salvo que una operación diga otra cosa, todas piden un esquema llamado `credencial`. Ese nombre se define más abajo, en `components`:

```json
    "securitySchemes": {
      "credencial": {
        "type": "http",
        "scheme": "bearer"
      }
    },
```

Son tres líneas con mucho contenido: el esquema es de tipo `http`, y su esquema (`scheme`) es `bearer`, el que usa el `revisor` con `Authorization: Bearer lectura-a`. ¿Por qué no se documenta `Authorization` como un parámetro de cabecera, como se hace con `Idempotency-Key`? Porque la especificación no lo toma en cuenta: en la sección 4.8.12.2.1 dice que, si un parámetro está en la cabecera y se llama `Accept`, `Content-Type` o `Authorization`, la definición se ignora. Las tres cabeceras tienen su propio mecanismo, y la de la credencial es este.

Hay rutas que no piden credencial: las redirecciones viejas (`/viejo/servicios`, `/api/servicios`) y la versión retirada (`/v0`). A esas se les escribe `"security": []` en la operación. Una lista vacía quiere decir «ninguna», y está escrito así en la especificación (sección 4.8.10.1): «To remove a top-level security declaration, an empty array can be used.» Es la manera de contar, en el documento, lo que la Lección 2 contó con una frase: la ruta y el método van antes que la credencial.

#### 8.3.4 Pieza 4: `paths`

Aquí está el cuerpo del documento. `paths` es un objeto con una entrada por **ruta**; cada ruta tiene una entrada por **método** (la especificación admite ocho: `get`, `put`, `post`, `delete`, `options`, `head`, `patch` y `trace`, en la sección 4.8.9.1), y cada método describe una **operación**. El `revisor` tiene doce rutas y diecisiete operaciones. Esta es una completa, la más corta de las que tienen errores, la que retira un servicio:

```json
      "delete": {
        "summary": "Retirar un servicio",
        "responses": {
          "204": {
            "description": "Retirado; sin cuerpo."
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "403": {
            "$ref": "#/components/responses/E403"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          }
        }
      }
```

Se lee de arriba abajo:

- `summary`: una frase para quien lee el documento. No la usa ninguna máquina para decidir nada.
- `responses`: el mapa de lo que esta operación puede responder, con el **código como llave**. Las llaves van entre comillas porque en JSON toda llave es un texto, y la especificación (sección 4.8.16.2) lo dice así: se puede usar cualquier código como nombre, y solo una propiedad por código. El objeto tiene que traer al menos una respuesta (sección 4.8.16: «MUST contain at least one response code»).
- `"204"`: la única respuesta de éxito. Una respuesta *tiene* que traer `description`; es el único campo obligatorio de una respuesta (sección 4.8.17.1), y por eso hasta el `204`, que no devuelve cuerpo, la lleva.
- El resto de las respuestas son `{ "$ref": "…" }`, que se explica en 8.4. Por ahora basta con saber que cada una apunta a un lugar de `components` donde está escrita una sola vez.

Esa operación no dice nada de su ruta. El parámetro `{id}` está en la entrada de la ruta, un nivel más arriba, porque lo comparten el `GET`, el `PUT` y el `DELETE`:

```json
    "/servicios/{id}": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "integer",
            "minimum": 1
          }
        }
      ],
      "get": {
```

El parámetro `id` está `in: path`, es obligatorio y es un entero mayor o igual a 1. La especificación admite cuatro lugares para un parámetro (`query`, `header`, `path` y `cookie`, en la sección 4.8.12.2.1); el `revisor` usa `path` para el `id` y `header` para `If-Match`, `If-None-Match` e `Idempotency-Key`.

#### 8.3.5 Pieza 5: `components`

Es el almacén de las piezas que se reutilizan. Tiene cinco cajones en este documento: `securitySchemes` (ya lo viste), `parameters` (la llave `Idempotency-Key`), `headers` (nueve cabeceras con su descripción), `responses` (dieciocho respuestas de error reutilizables) y `schemas` (los cuerpos). Una pieza se usa desde cualquier punto del documento con una **referencia**: un objeto `{ "$ref": "#/components/responses/E401" }`. El texto después de la almohadilla es la ruta dentro del mismo documento: `components`, luego `responses`, luego `E401`.

¿Por qué se guarda ahí y no se escribe donde se usa? Porque el documento del `revisor` tiene diecisiete operaciones y **79 referencias a las dieciocho respuestas de error**. Si cada una se escribiera completa, el `401` aparecería 12 veces con su cabecera `WWW-Authenticate`, y bastaría que alguien corrigiera 11 de las 12 para que el documento se contradijera a sí mismo. Con la referencia, el `401` se corrige una vez. Es el mismo argumento de la Lección 5: el catálogo de `problemas.ts` es una sola tabla y no veinticuatro frases repartidas.

> **Una sutileza de las referencias.** En la versión 3.1, un objeto de referencia puede traer también un `summary` y una `description` que **sustituyen**, por omisión, a los de la pieza referenciada (sección 4.8.23.1). El `revisor` no la usa: todas sus referencias son `$ref` a secas, así que lo que dice la respuesta reutilizable es lo que lee cualquiera.

### 8.4 Documentar cada error

#### 8.4.1 Una respuesta reutilizable completa

Esta es la respuesta del `401`, tal como vive en el documento:

```json
      "E401": {
        "description": "Falta una credencial válida (type credencial-invalida).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        },
        "headers": {
          "WWW-Authenticate": {
            "$ref": "#/components/headers/WWW-Authenticate"
          }
        }
      },
      "E403": {
```

Tiene tres partes, y las tres son promesas que la matriz va a comprobar.

La **`description`** cuenta cuándo ocurre y dice el `type` que lleva. Es texto para personas, y es la única parte donde el documento nombra el `type` (más sobre esto en 8.5).

El **`content`** es un mapa cuyas llaves son tipos de contenido. La llave es `application/problem+json`, no `application/json`, y esa es exactamente la promesa que rompió la «limpieza» de la escena del principio. Debajo, el `schema` apunta al esquema `Problema` (lo ves en 8.4.3).

Y las **`headers`** dicen qué cabeceras acompañan a esta respuesta. Hay una trampa clásica aquí, y la especificación la nombra: si una respuesta define una cabecera llamada `Content-Type`, esa definición se **ignora** (sección 4.8.17). El tipo de contenido no se documenta como cabecera, se documenta como la llave de `content`. Por eso en el `401` solo aparece `WWW-Authenticate`, que es la que obliga el código, y el tipo de contenido está en otra parte.

#### 8.4.2 Las cabeceras que cada código obliga o promete

El documento del `revisor` declara cabeceras en seis de las dieciocho respuestas. La tabla muestra cuáles y de dónde sale cada una:

| Respuesta | Cabecera | Quién la pide |
|---|---|---|
| `E401` (`401`) | `WWW-Authenticate` | el RFC 9110, sección 15.5.2 («MUST send a WWW-Authenticate header field»), y el esquema Bearer del RFC 6750; la Lección 2: el reto de la credencial |
| `E405` (`405`) | `Allow` | el RFC 9110, sección 15.5.6: «MUST generate an Allow header field» |
| `E415` (`415`) | `Accept` | la Lección 2: qué tipos sí se admiten |
| `E429` y `E429Salud` (`429`) | `Retry-After` | la Lección 4: cuánto esperar |
| `E503` (`503`) | `Retry-After` | el RFC 9110, sección 15.6.4: el servidor «MAY» mandarla, y esta API decidió mandarla |

Fíjate en la diferencia entre las dos últimas filas y las anteriores. El `405` **obliga** su cabecera: sin `Allow`, la respuesta incumple el RFC. El `503` solo la **permite**: otra API podría responder `503` sin `Retry-After` y seguir cumpliendo el RFC. Pero **esta** API, la del `revisor`, la manda en cada `503`, y eso es una promesa propia que el documento escribe, y que quien la integra va a usar para esperar bien. La escena del principio rompió precisamente una promesa propia, no una del RFC; por eso la matriz comprueba las dos clases con el mismo rigor.

#### 8.4.3 El esquema `Problema`

El cuerpo de todos los errores es un Problem Details (Lección 5), y se escribe una sola vez:

```json
      "Problema": {
        "type": "object",
        "description": "Problem Details (RFC 9457). type es el identificador estable; title y detail son para personas.",
        "required": [
          "type",
          "title",
          "status",
          "detail",
          "instance"
        ],
```

Esos son los cinco miembros que **esta API** promete en cada error (`required`). Conviene decirlo con cuidado: el RFC 9457 (sección 3.1) no exige los cinco, y `type` vale `about:blank` si falta. Pedirlos todos es una promesa más estricta que la del RFC, y por eso el documento la escribe y la matriz la comprueba. Sigue la lista de `properties`, que incluye los cinco más las dos extensiones que el catálogo usa: `errors` (los renglones del `422`, cada uno con su `pointer`) y `existente` (la ruta del servicio que ya existe, en el `409` de nombre repetido). Y cierra con una línea que parece un descuido y es una decisión: `"additionalProperties": true`. El RFC 9457 permite agregar miembros de extensión a un Problem Details; un esquema que los prohibiera diría algo falso de la API en cuanto un tipo de problema nuevo agregara uno. Dejarlos abiertos es honesto: el esquema lista los que hoy se usan sin cerrar la puerta a los de mañana.

El tipo de contenido `application/problem+json` está registrado ante la IANA con el RFC 9457 como referencia ([registro](https://www.iana.org/assignments/media-types/application/problem+json)); es la llave de `content` en cada respuesta de error.

#### 8.4.4 Dónde cabe lo que no es un error: éxitos, cuerpos vacíos y el 405 de PATCH

Los éxitos se documentan con el mismo cuidado que los errores, porque un cliente también construye cosas a partir de ellos. El `201` de `POST /servicios` declara sus dos cabeceras, `Location` y `ETag`, y el esquema `Servicio`. El `304` y el `204` declaran su `description` y ningún `content`, y esa ausencia es una promesa: no traen cuerpo, y la matriz lo comprueba preguntando si el cuerpo llegó vacío.

Queda un caso que la especificación no deja escribir como uno querría: el `405` de `PATCH`. Ninguna ruta del `revisor` admite `PATCH`, y OpenAPI describe **operaciones que existen**; declarar `patch` en una ruta para documentar que no se admite haría que el documento dijera lo contrario (que hay un `PATCH`). La salida del documento es poner el `405` en las operaciones que sí existen (`GET`, `PUT` y `DELETE` de `/servicios/{id}`) y decir ahí que cualquier otro método recibe esa respuesta, con su cabecera `Allow`. La matriz usa la operación `GET` de esa ruta para el escenario del `405` (así lo declara en el campo `operacion`, sección 8.6), y el ejercicio 3 te hace probarlo.

#### 8.4.5 La cabecera que no es un estándar

`Idempotency-Key` se documenta como un parámetro reutilizable:

```json
      "IdempotencyKey": {
        "name": "Idempotency-Key",
        "in": "header",
        "required": false,
        "description": "Patrón documentado por esta API, NO un estándar: draft-ietf-httpapi-idempotency-key-header-07 venció el 18 de abril de 2026 sin publicarse como RFC.",
        "schema": {
          "type": "string",
          "minLength": 1
        }
      }
```

La `description` hace lo que dijo la Lección 6 que haría esta lección: avisa que es un patrón de la API y **no un estándar**, y por qué. El borrador de la IETF en el que se basa, `draft-ietf-httpapi-idempotency-key-header-07`, venció el 18 de abril de 2026 sin publicarse como RFC. `required: false` es la otra mitad de la promesa: quien no la manda sigue siendo atendido, igual que antes de la Lección 6. Un documento que dijera simplemente `Idempotency-Key` sin la advertencia estaría prometiendo, sin querer, que cualquier otra API la entiende igual.

### 8.5 El catálogo de tipos de problema, cruzado con el documento

La Lección 5 prometió que el catálogo de tipos se podía «leer, revisar y documentar de una sola vez». Hay una forma barata de comprobar que el documento cumple: tomar el catálogo (`CATALOGO` en `problemas.ts`, con 24 tipos desde que la Lección 6 agregó dos) y, para cada uno, preguntarle al documento dos cosas: ¿alguna operación declara su código?, ¿el documento nombra su `type`? Eso hace `fig08_02.ts`. No necesita ningún servidor: lee dos archivos.

```ts
// fig08_02.ts — ¿el documento cuenta todo lo que el servidor puede decir? Cruza el catálogo de tipos de
// problema (problemas.ts) con openapi.json. No necesita ningún servidor: solo lee dos archivos.
// Uso: node fig08_02.ts          (desde la carpeta que contiene fig08_01/)
import { readFileSync } from "node:fs";
import { CATALOGO } from "./fig08_01/problemas.ts";

type Documento = { paths: Record<string, Record<string, { responses?: Record<string, unknown> }>> };

const texto = readFileSync(new URL("./fig08_01/openapi.json", import.meta.url), "utf8");
const documento = JSON.parse(texto) as Documento;

// Todos los códigos que alguna operación del documento declara.
const documentados = new Set<string>();
for (const ruta of Object.values(documento.paths)) {
  for (const operacion of Object.values(ruta)) {
    for (const codigo of Object.keys(operacion.responses ?? {})) documentados.add(codigo);
  }
}

console.log("clave                     código  type                  ¿código en el documento?  ¿type en el documento?");
let huecos = 0;
for (const [clave, { type, status }] of Object.entries(CATALOGO)) {
  // Con about:blank no hay nombre propio que buscar: el type es el mismo para todos esos errores.
  const nombre = type === "about:blank" ? null : type.split("/").at(-1) ?? "";
  const codigoDocumentado = documentados.has(String(status));
  const typeDocumentado = nombre === null ? null : texto.includes(nombre);
  if (!codigoDocumentado || typeDocumentado === false) huecos++;
  console.log(
    `${clave.padEnd(25)} ${String(status).padEnd(7)} ${(nombre ?? "about:blank").padEnd(21)} ` +
      `${(codigoDocumentado ? "sí" : "NO").padEnd(25)} ${typeDocumentado === null ? "(no aplica)" : typeDocumentado ? "sí" : "NO"}`,
  );
}
console.log();
console.log(`${Object.keys(CATALOGO).length} tipos en el catálogo; ${huecos} con un hueco en el documento`);
process.exitCode = huecos === 0 ? 0 : 1;
```

Léelo por bloques:

- **Las líneas de lectura.** `import { CATALOGO }` trae la tabla del servidor; `readFileSync` lee el documento *dos veces*, como texto (para buscar nombres) y ya convertido a objeto (para recorrer los códigos). Es la misma información vista desde dos ángulos, a propósito.
- **`documentados`** es el conjunto de todos los códigos que alguna operación declara. Los tres `for` anidados recorren rutas, operaciones y las llaves de cada `responses`.
- **El ciclo principal** recorre las 24 entradas del catálogo. Para cada una calcula `nombre`, que es la última parte del `type` (`servicio-inexistente`), salvo con `about:blank`, que no tiene nombre propio: es el mismo para todos esos errores.
- **El hueco** se cuenta si falta el código, o si hay nombre y el texto del documento no lo contiene.
- **Al final**, el código de salida es `0` solo si no hay huecos. Eso permite usarlo en un guion o en un paso de integración continua.

Córrelo desde la carpeta que contiene `fig08_01/`:

```text
$ node fig08_02.ts
clave                     código  type                  ¿código en el documento?  ¿type en el documento?
ruta-inexistente          404     about:blank           sí                        (no aplica)
metodo-no-admitido        405     about:blank           sí                        (no aplica)
tipo-no-admitido          415     about:blank           sí                        (no aplica)
cuerpo-demasiado-grande   413     about:blank           sí                        (no aplica)
cuerpo-ilegible           400     cuerpo-ilegible       sí                        sí
credencial-invalida       401     credencial-invalida   sí                        sí
permiso-insuficiente      403     permiso-insuficiente  sí                        sí
servicio-inexistente      404     servicio-inexistente  sí                        sí
revision-inexistente      404     revision-inexistente  sí                        NO
nombre-repetido           409     nombre-repetido       sí                        sí
servicio-retirado         410     servicio-retirado     sí                        sí
version-retirada          410     version-retirada      sí                        sí
etiqueta-vencida          412     etiqueta-vencida      sí                        sí
destino-prohibido         422     destino-prohibido     sí                        sí
datos-invalidos           422     datos-invalidos       sí                        sí
llave-en-curso            409     llave-en-curso        sí                        sí
llave-reutilizada         422     llave-reutilizada     sí                        sí
falta-condicion           428     falta-condicion       sí                        sí
demasiadas-revisiones     429     demasiadas-revisiones sí                        sí
demasiadas-consultas      429     demasiadas-consultas  sí                        sí
error-interno             500     error-interno         sí                        sí
respuesta-invalida        502     respuesta-invalida    sí                        sí
en-mantenimiento          503     en-mantenimiento      sí                        sí
servicio-lento            504     servicio-lento        sí                        sí

24 tipos en el catálogo; 1 con un hueco en el documento
(código de salida: 1)
```

En ninguna de las filas aparece un **NO** salvo en una: `revision-inexistente`, y no es una falla del programa: el hueco existe. Para verlo con tus ojos, pídele al servidor lo que el documento promete para esa ruta, y compáralo con lo que pasa de verdad en la ruta vecina:

```text
$ curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 22:36:23 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/revision-inexistente","title":"La revisión no existe","status":404,"detail":"no existe la revisión 99","instance":"/revisiones/99"}

$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 22:36:23 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}
```

Compara las dos respuestas. `GET /revisiones/99` responde un `404` cuyo `type` es `revision-inexistente`. `GET /servicios/99` responde otro `404`, con el `type` `servicio-inexistente`. Pero el documento tiene **una sola** respuesta de `404` para las dos rutas, `E404`, y su `description` dice «type servicio-inexistente o about:blank». Para la ruta de las revisiones, esa frase es falsa: quien lea el documento esperará un `type` que esa ruta nunca devuelve, y no sabrá que existe el que sí.

¿Por qué no lo vio la matriz? Porque el escenario del `404` pide un servicio que no existe (`/servicios/99`) y solo comprueba que el `404` esté declarado en esa operación. Nadie le preguntó a `/revisiones/{id}` por su `type`. Es una lección general: **una verificación que no mira un caso no sabe de ese caso**, y el cruce de esta sección encontró lo que la matriz, por diseño, no mira. Corregirlo es el ejercicio 1.

> **Los tres puntos ciegos de este cruce.** Primero, busca el nombre *en cualquier parte* del texto del documento: si `revision-inexistente` apareciera en la descripción de otra ruta, el cruce diría «sí» aunque `/revisiones/{id}` siguiera mal. Segundo, para los tipos con `about:blank` no comprueba nada sobre su nombre, porque no lo tienen. Tercero, no mira que el `status` del catálogo coincida con la ruta donde se documenta. Es una red de seguridad barata, no una prueba completa; la matriz de la sección 8.6 es la que mira las respuestas reales.

### 8.6 La matriz de 23 escenarios: cómo está hecha

`matriz23.ts` tiene unas 680 líneas (`wc -l` da 676), y una parte importante son datos, no lógica. Esa es la primera decisión de diseño y vale la pena verla antes que el código: los 23 escenarios no son 23 funciones, son 23 **filas de una tabla**, y una sola función las recorre. Agregar un escenario es agregar una fila; cambiar lo que se comprueba es cambiar una función, no 23.

#### 8.6.1 Un escenario es un dato

Cada fila tiene la forma de este tipo:

```ts
type Escenario = {
  codigo: number;
  nombre: string;
  operacion: [string, string]; // método y ruta tal como los documenta openapi.json
  antes?: Peticion[];
  peticion: Peticion;
  cabeceras: string[];
  tipo: "application/json" | "application/problem+json" | null; // null: sin cuerpo
  type?: string;
  revisarCuerpo?: (cuerpo: Record<string, unknown>) => string | null;
};
```

Campo por campo:

- **`codigo`** y **`nombre`**: el código que se espera y una frase para el renglón de la salida.
- **`operacion`**: el método y la ruta **tal como los escribe `openapi.json`**. No son los de la petición: la petición puede ser `GET /servicios/99` y la operación `["get", "/servicios/{id}"]`, porque en el documento la ruta lleva el parámetro entre llaves. Con este campo la matriz sabe dónde buscar en el documento si el código está declarado.
- **`antes`** (opcional): las peticiones que hay que hacer **antes** de la que se mide, para dejar el servidor en el estado donde el código ocurre. Para un `429` hacen falta tres revisiones previas; para un `503`, encender el mantenimiento.
- **`peticion`**: la que se mide. Un método, una ruta, cabeceras y un cuerpo.
- **`cabeceras`**: las que la respuesta **debe** traer. Es una lista de nombres, y la comparación no distingue mayúsculas (las cabeceras HTTP no las distinguen).
- **`tipo`**: el tipo de contenido esperado, o `null` si no debe haber cuerpo.
- **`type`**: para los errores, el `type` del Problem Details.
- **`revisarCuerpo`**: una función opcional para lo que es propio de ese escenario, como «la extensión `existente` apunta a `/servicios/2`».

Dos filas, para verlas funcionando. La del `429`:

```ts
  { codigo: 429, nombre: "demasiadas revisiones", operacion: ["post", "/servicios/{id}/revisiones"],
    antes: [1, 2, 3].map(() => ({ metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE })),
    peticion: { metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE },
    cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "demasiadas-revisiones" },
```

Tres revisiones previas, y la cuarta es la que se mide. Espera la cabecera `retry-after`, el tipo de contenido `application/problem+json`, y el `type` `demasiadas-revisiones`. Y la del mantenimiento:

```ts
  { codigo: 503, nombre: "mantenimiento", operacion: ["get", "/servicios"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":true}' }],
    peticion: { metodo: "GET", ruta: "/servicios", cabeceras: LEE }, cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "en-mantenimiento" },
```

Antes de pedir la lista, enciende el mantenimiento con un `PUT /mantenimiento` hecho por `admin`. Fíjate que la `operacion` de este escenario es `["get", "/servicios"]` y no `/mantenimiento`: el `503` se documenta en las operaciones que *pueden devolverlo*, y la matriz busca el código donde un cliente lo vería.

#### 8.6.2 El orden importa, y está escrito

Los escenarios comparten un solo servidor, que guarda su estado en memoria, así que el orden en que corren es parte de la prueba. La lista de la matriz respeta cuatro dependencias, y conviene saberlas porque son las que se rompen primero cuando alguien reordena:

- El **`201`** da de alta un servicio que recibe el id 7 (los de arranque son seis). El **`204`** lo retira, y después el **`410`** lo vuelve a pedir y encuentra que se retiró. Si el `410` corriera antes del `204`, daría `200`.
- El **`500`** usa el servicio 4, el que no tiene revisiones terminadas: es el defecto a propósito de la Lección 4, y vive hasta esta lección justo para tener un `500` que provocar.
- El **`503`** enciende el mantenimiento en su `antes`, y el **`504`** lo apaga en el suyo. Si nadie lo apagara, todo lo que sigue daría `503`.
- El **`304`** necesita la `ETag` vigente del servicio 1, que cambia en cada arranque. La matriz la lee **una vez al empezar**, antes del primer escenario, y la guarda en `SIN_CAMBIOS`.

#### 8.6.3 La función que comprueba

La función `comprobar` recibe un escenario y devuelve una **lista** de fallas; la lista vacía significa que pasó. Esta es completa:

```ts
async function comprobar(e: Escenario): Promise<string[]> {
  const fallas: string[] = [];
  for (const previa of e.antes ?? []) await (await enviar(previa)).text();
  const respuesta = await enviar(e.peticion);
  const texto = await respuesta.text();
  if (respuesta.status !== e.codigo) fallas.push(`código ${respuesta.status}, se esperaba ${e.codigo}`);
  for (const cabecera of e.cabeceras) if (!respuesta.headers.has(cabecera)) fallas.push(`falta ${cabecera}`);
  const tipo = respuesta.headers.get("content-type");
  if (e.tipo === null) {
    if (texto !== "") fallas.push("trae cuerpo y no debía");
  } else if (tipo !== e.tipo) {
    fallas.push(`tipo ${tipo}, se esperaba ${e.tipo}`);
  } else {
    const cuerpo = JSON.parse(texto) as Record<string, unknown>;
    if (e.tipo === "application/problem+json") {
      if (cuerpo.type !== e.type) fallas.push(`type ${String(cuerpo.type)}, se esperaba ${e.type}`);
      if (cuerpo.status !== e.codigo) fallas.push("status del cuerpo distinto del código");
      if (typeof cuerpo.title !== "string") fallas.push("falta title");
    }
    const otra = e.revisarCuerpo?.(cuerpo) ?? null;
    if (otra !== null) fallas.push(otra);
  }
  if (e.codigo >= 500) for (const fuga of FUGAS) if (fuga.test(texto)) fallas.push(`el cuerpo filtra ${fuga}`);
  const [metodo, ruta] = e.operacion;
  if (documento.paths[ruta]?.[metodo]?.responses?.[String(e.codigo)] === undefined) {
    fallas.push(`openapi.json no documenta ${e.codigo} en ${metodo.toUpperCase()} ${ruta}`);
  }
  return fallas;
}
```

Sigue las líneas en el orden en que se ejecutan:

1. **Las peticiones previas.** Se mandan y se descarta su cuerpo con `.text()`, porque una respuesta que no se lee deja la conexión ocupada.
2. **La petición medida.** Se manda con `enviar`, que usa `fetch` con `redirect: "manual"`. Esa opción importa: un `301` o un `308` tiene que verse como `301` o `308`, no como la respuesta de la ruta a la que `fetch` habría ido a parar sola. Para comprobar una redirección, no hay que seguirla.
3. **El código.** Si no es el esperado, se agrega una falla.
4. **Las cabeceras.** Cada nombre de la lista tiene que estar en la respuesta.
5. **El tipo de contenido y el cuerpo.** Si el escenario no espera cuerpo, el texto tiene que venir vacío. Si lo espera, el tipo tiene que coincidir; y solo si coincide se intenta leer el cuerpo como JSON. Si el escenario es un error, se comprueban tres miembros del Problem Details: `type`, `status` igual al código y `title` de tipo texto.
6. **La comprobación propia del escenario**, si la tiene.
7. **Las fugas**, solo en los `5xx`. Se explican abajo.
8. **La documentación.** Si el documento no declara ese código en esa operación, hay una falla. Es la línea que une la matriz con `openapi.json`.

Hay una decisión en la estructura que no se nota hasta que falla algo: la función **junta todas las fallas** y no se detiene en la primera. Con la «limpieza» de la escena, el `503` falla por dos razones (falta `retry-after` y el tipo es `application/json`); una prueba que se detuviera en la primera diría una, quien la corrija verá la otra en la corrida siguiente, y perderá otra vuelta. Es la misma política del `422` de la Lección 3, que junta todas las fallas del cuerpo.

#### 8.6.4 Las fugas

Los errores del servidor son los que más tienden a contar de más. Un `500` mal manejado puede devolver la pila de la excepción, y la pila lleva rutas de archivos, nombres de funciones y a veces datos. La Lección 4 enseñó a decir en un `5xx` solo una referencia; la matriz lo vigila con una lista de patrones que no deberían aparecer en el cuerpo de un `5xx`:

```ts
const FUGAS = [/\bat \S+ \(/, /file:\/\//, /\/(home|Users)\//, /node:internal/, /\bSELECT\b.+\bFROM\b/i, /Bearer \S+/, /TypeError|ReferenceError/];
```

Léelos uno por uno:

| Patrón | Qué caza |
|---|---|
| `\bat \S+ \(` | un renglón de pila de JavaScript: `at nombre (archivo:línea)` |
| `file://` | la dirección de un archivo, como las que imprime Node en las pilas |
| `\/(home\|Users)\/` | una carpeta de usuario de una máquina real |
| `node:internal` | un marco interno de Node |
| `\bSELECT\b.+\bFROM\b` | una consulta SQL |
| `Bearer \S+` | una credencial |
| `TypeError\|ReferenceError` | el nombre de una excepción de JavaScript |

La lista no es exhaustiva, y no puede serlo: es un conjunto de señales de lo que ya se vio, no una garantía de que no haya otras. Cubre las más comunes de esta clase de servidor. Se aplica **solo a los `5xx`** porque ahí es donde lo inesperado se cuela; un `404` o un `422` los escribe el manejador central con frases del catálogo.

#### 8.6.5 Arrancar, medir y apagar

Lo último que hace el programa es levantar lo que va a medir y apagarlo, pase lo que pase:

```ts
// Si algo ya escucha en los puertos del curso, la corrida mediría a otro programa (o esperaría para siempre a un
// hijo que no pudo arrancar): se detiene en seguida.
for (const puerto of [18080, 18081, 18082]) {
  if (await aceptaConexiones(puerto)) {
    console.error(`puerto ${puerto} ocupado; apaga lo que lo usa`);
    process.exit(2);
  }
}

const procesos: ChildProcess[] = [
  spawn(process.execPath, ["laboratorio.ts"], { cwd: import.meta.dirname, stdio: "ignore" }),
  spawn(process.execPath, ["servidor.ts"], { cwd: import.meta.dirname, stdio: "ignore" }),
];
let fallidos = 0;
let extra = 0;
let abortada = false;
try {
  await esperarPuerto(18081, procesos[0]);
  await esperarPuerto(18080, procesos[1]);
  SIN_CAMBIOS["If-None-Match"] = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE })).headers.get("etag") ?? "";
  for (const escenario of ESCENARIOS) {
    const fallas = await comprobar(escenario);
    if (fallas.length > 0) fallidos++;
    console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${escenario.codigo} ${escenario.nombre}${fallas.length > 0 ? ": " + fallas.join("; ") : ""}`);
  }
  const resultados = await adicionales();
  extra = resultados.length;
  for (const [nombre, fallas] of resultados) {
    if (fallas.length > 0) fallidos++;
    console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${nombre}${fallas.length > 0 ? ": " + fallas.join("; ") : ""}`);
  }
} catch (error) {
  // Un proceso no arrancó (o no contestó a tiempo): no hay resumen que dar, y se dice por qué.
  console.error(`no se pudo correr la matriz: ${error instanceof Error ? error.message : String(error)}`);
  abortada = true;
} finally {
  for (const proceso of procesos) proceso.kill();
}
if (abortada) process.exit(1);
const total = ESCENARIOS.length + extra;
console.log(`\n${total - fallidos} de ${total} comprobaciones pasaron (${ESCENARIOS.length} escenarios de código y ${extra} adicionales).`);
process.exitCode = fallidos === 0 ? 0 : 1;
```

Antes de arrancar nada, la matriz comprueba que los tres puertos estén libres: si alguno responde, dice cuál y sale con `2`, porque medir contra el programa de otro es medir lo que no es tuyo (el ejercicio de «El servidor que se quedó abierto» lo muestra). Los dos `spawn` arrancan el laboratorio y el `revisor` como procesos hijos, con la misma versión de Node que corre la matriz (`process.execPath`), y `esperarPuerto` (al principio del archivo, se explica en 8.14.1) espera a que cada uno acepte conexiones en lugar de contar un tiempo fijo. Si alguno no contesta en 10 segundos, el `catch` lo dice y la corrida termina con `1` sin resumen. El `try … finally` es la parte que hace honesta la matriz: pase lo que pase en las comprobaciones (una excepción, una falla, un proceso que no arrancó), el `finally` apaga a los dos hijos. Sin él, un error a medio camino dejaría dos procesos escuchando en los puertos 18080 y 18081, y la corrida siguiente fallaría por una razón que no tiene nada que ver con lo que se mide.

La última línea importa para quien use la matriz en un guion: el programa sale con `0` si no hubo fallas y con `1` si hubo alguna. Eso es lo que permite ponerlo en un paso de integración continua y que el paso se ponga rojo. Fíjate también en que usa `process.exitCode` y no `process.exit(…)`: asigna el código y deja que el programa termine solo, lo que permite que los hijos y las conexiones se cierren con calma.

### 8.7 Correrla y leerla

Desde la carpeta `fig08_01/`, con los puertos 18080, 18081 y 18082 libres (el tercero lo usa la pasarela de una de las comprobaciones adicionales):

```text
$ node matriz23.ts
ok    200 consultar un servicio
ok    304 consultar sin cambios
ok    201 dar de alta
ok    202 pedir revisión
ok    204 retirar
ok    301 ruta vieja con 301
ok    308 ruta vieja con 308
ok    400 cuerpo ilegible
ok    401 sin credencial
ok    403 lectura que intenta escribir
ok    404 servicio que no existe
ok    405 método no admitido
ok    409 nombre repetido
ok    410 servicio retirado
ok    412 etiqueta vencida
ok    415 formato no admitido
ok    422 datos imposibles
ok    428 cambio sin If-Match
ok    429 demasiadas revisiones
ok    500 el defecto a propósito
ok    502 el servicio responde basura
ok    503 mantenimiento
ok    504 el servicio no responde a tiempo
ok    misma Idempotency-Key: no duplica; con otro cuerpo, 422
ok    SSRF: http://169.254.169.254/latest/meta-data/ se rechaza con 422 destino-prohibido
ok    SSRF: http://localhost:18080/mantenimiento se rechaza con 422 destino-prohibido
ok    credencial heredada de Object.prototype (constructor, __proto__, toString): 401
ok    If-None-Match con lista, W/ y * (débil): 304; If-Match con W/: 412; con lista o *: 200
ok    actualización perdida: dos PUT a la vez con la misma If-Match: 200 y 412, gana la primera que escribe
ok    orden del PUT: text/plain da 415 con etiqueta vieja o sin ella; retirado en el hueco, 410
ok    esquema sin distinguir mayúsculas (bearer: 200); Basic: reto sin error="invalid_token"
ok    método heredado de Object.prototype (constructor, toString, __proto__): 405
ok    cuerpo JSON que no es objeto (null, 7, "texto", []): 400, y el revisor sigue vivo
ok    cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo
ok    429 por credencial: la cuarta consulta en vivo, 429; otra credencial no lo paga; enumerar ids llega al 429
ok    Retry-After: 1.5, -1 y «12 30» se ignoran; las tres formas de HTTP-date dan lo mismo (GMT)
ok    SSRF: 12 direcciones de uso especial (CGNAT, NAT64, 6to4, compatible, 64:ff9b:1::/48, 240/4, 198.18/15, TEST-NET, 2001:db8::, Teredo, multicast): 422; 6to4 con IPv4 pública: 201
ok    la pasarela reenvía Content-Length; sin revisor responde 502 y sigue viva; alta-segura termina al agotar los intentos, también sin conexión
ok    alta-segura decide: un 4xx sale con 1; obedece Retry-After si es razonable y no insiste si pide mucho; se corta por tiempo ante un servidor mudo; el 409 de llave en curso se reintenta y el de nombre repetido no
ok    el banco responde el 205 sin cuerpo, con Content-Length: 0 y sin Transfer-Encoding
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 0)
```

Léela por bloques.

**Los primeros siete renglones** (`200` a `308`) son los éxitos y las redirecciones. Cada uno pasó el mismo examen que los errores, pero con otra forma: el `200` y el `201` traen cuerpo `application/json` y las cabeceras `etag` (y `location` en el `201`); el `304`, el `204`, el `301` y el `308` no traen cuerpo, y la matriz comprueba que el texto venga vacío. El `301` y el `308` son `POST`: es el par de la Lección 1, con la misma petición y dos redirecciones que se comportan distinto en el cliente.

**Los dieciséis siguientes** (`400` a `504`) son los errores. Cada uno comprobó `application/problem+json`, el `type` del catálogo y, en cinco de ellos, una cabecera: `www-authenticate` en el `401`, `allow` en el `405`, `accept` en el `415`, `retry-after` en el `429` y el `503`. El `403` tiene una comprobación propia que ya apareció en la Lección 2: el cuerpo **no** repite la credencial `lectura-a`. Y el `500` comprueba que `instance` sea un `urn:uuid:…`, la referencia que el cliente puede dar a quien opera el servidor.

**Las dieciocho últimas** no son códigos. Son comprobaciones adicionales, y la sección 8.8 las explica.

**La penúltima línea** suma: «41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales)». Y la última línea, `(código de salida: 0)`, es la que lee un guion.

Dos detalles de lectura. El renglón del SSRF dice `http://localhost:18080/mantenimiento`: la matriz intenta registrar una URL con un nombre que resuelve a la propia máquina, y espera un `422` con el tipo `destino-prohibido`. Y el tiempo: la corrida tarda unos 16 segundos, y buena parte son esperas deliberadas: el arranque, la revisión lenta del `504`, los reintentos de `alta-segura.ts` y los reinicios del `revisor`.

### 8.8 Las otras dieciocho comprobaciones

Una vez que los 23 códigos están verdes, la matriz recorre dieciocho comprobaciones más. Cada una nació de un defecto concreto que las lecciones anteriores midieron en su momento, y existe para que ese defecto **no regrese sin que alguien se entere**. Se llaman **regresiones**: pruebas de algo que ya se arregló una vez.

| # | Qué comprueba | De qué lección viene |
|---|---|---|
| 1 | `Idempotency-Key`: la misma llave no duplica; con otro cuerpo, `422` | 6 |
| 2 y 3 | SSRF: dos URL (`169.254.169.254` y `localhost`) se rechazan con `422 destino-prohibido` | 1 |
| 4 | Una credencial que solo existe en `Object.prototype` (`constructor`, `__proto__`, `toString`) da `401` | 2 |
| 5 | Peticiones condicionales: `If-None-Match` con lista, `W/` y `*` da `304`; `If-Match` con `W/` da `412`; con lista o `*` da `200` | 1 y 3 |
| 6 | La actualización perdida: dos `PUT` a la vez con la misma `If-Match`, `200` y `412` | 3 |
| 7 | El orden del `PUT`: `text/plain` da `415` con etiqueta vieja o sin ella; si lo retiran en el hueco, `410` | 3 |
| 8 | El esquema `bearer` sin distinguir mayúsculas, y el reto de `Basic` sin `error="invalid_token"` | 2 |
| 9 | Un método heredado (`constructor`, `toString`, `__proto__`) da `405` | 1 y 2 |
| 10 | Un cuerpo JSON que no es un objeto (`null`, `7`, `"texto"`, `[]`) da `400`, y el `revisor` sigue vivo | 1 |
| 11 | El tope de 16 KiB: `413` con `Content-Length` y por partes; justo en el tope, `400` | 2 |
| 12 | El límite por credencial: la cuarta consulta en vivo, `429`; otra credencial no lo paga; enumerar ids llega al `429` | 4 |
| 13 | `Retry-After` estricto: `1.5`, `-1` y «12 30» se ignoran; las tres formas de fecha dan lo mismo | 4 |
| 14 | SSRF con doce direcciones de uso especial, rechazadas; una 6to4 con IPv4 pública, aceptada | 1 |
| 15 | La pasarela reenvía `Content-Length`; sin `revisor` responde `502` y sigue viva; `alta-segura.ts` termina al agotar los intentos, también sin conexión | 6 |
| 16 | `alta-segura.ts` decide: un `4xx` sale con `1`; obedece `Retry-After` si es razonable y no insiste si pide mucho; se corta por tiempo ante un servidor mudo; el `409` de llave en curso se reintenta y el de nombre repetido no | 6 |
| 17 | La `ETag` tras reiniciar el `revisor`: la vieja ya no coincide | 1 |
| 18 | El banco de pruebas responde el `205` sin cuerpo (RFC 9110, sección 15.3.6), con `Content-Length: 0` (sin él, el `205` no tiene longitud declarada y se leería hasta que se cierre la conexión: RFC 9112, sección 6.3) y sin `Transfer-Encoding` (decisión del banco: Node mandaría `chunked` con un cuerpo vacío; el RFC no lo prohíbe en el `205`) | 0 |

Tres de ellas tienen una técnica que vale la pena ver, porque muestran cómo se prueba algo que no se puede provocar con una petición normal.

#### 8.8.1 La actualización perdida: un cuerpo que llega a pedazos

Para probar que dos `PUT` simultáneos con la misma etiqueta no se pisan, hay que lograr que uno **esté esperando su cuerpo** mientras el otro escribe. Un `fetch` normal manda cabeceras y cuerpo juntos, así que no hay hueco. La solución es un cuerpo que se entrega en dos tiempos:

```ts
async function actualizacionPerdida(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const vigente = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: ESCRIBE })).headers.get("etag") ?? "";
  const cabeceras = { ...ESCRIBE, ...JSON_, "If-Match": vigente };
  let soltar = (): void => {};
  const suelto = new Promise<void>((listo) => { soltar = listo; });
  // El primer pedazo sale enseguida (fetch no manda las cabeceras hasta tener algo del cuerpo); el resto,
  // hasta que la rápida terminó.
  const texto = JSON.stringify({ nombre: "catalogo", url: `${LAB}/codigo/200`, limite_ms: 1000 });
  const codificar = (pedazo: string): Uint8Array => new TextEncoder().encode(pedazo);
  const cuerpo = new ReadableStream<Uint8Array>({
    async start(control) {
      control.enqueue(codificar(texto.slice(0, 10)));
      await suelto;
      control.enqueue(codificar(texto.slice(10)));
      control.close();
    },
  });
  const lenta = fetch(R + "/servicios/1", { method: "PUT", headers: cabeceras, body: cuerpo, duplex: "half" } as RequestInit);
  await esperar(300);
  const rapida = await enviar({ metodo: "PUT", ruta: "/servicios/1", cabeceras,
    cuerpo: JSON.stringify({ nombre: "catalogo", url: `${LAB}/codigo/200`, limite_ms: 3000 }) });
  await rapida.text();
  soltar();
  const respuestaLenta = await lenta;
  await respuestaLenta.text();
  const final = (await (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: ESCRIBE })).json()) as { limite_ms?: number };
  if (rapida.status !== 200) fallas.push(`la rápida dio ${rapida.status}, se esperaba 200`);
  if (respuestaLenta.status !== 412) fallas.push(`la lenta dio ${respuestaLenta.status}, se esperaba 412`);
  if (final.limite_ms !== 3000) fallas.push(`el servicio quedó con limite_ms ${final.limite_ms}, se esperaba 3000 (el de la rápida)`);
  return ["actualización perdida: dos PUT a la vez con la misma If-Match: 200 y 412, gana la primera que escribe", fallas];
}
```

El cuerpo de la petición lenta es un `ReadableStream`. Entrega **diez caracteres enseguida** (sin eso, `fetch` no manda ni las cabeceras) y el resto cuando la promesa `suelto` se cumple. La opción `duplex: "half"` es obligatoria cuando el cuerpo es un flujo: la especificación de `fetch` la pide y `"half"` es el valor que se usa en Node, y quiere decir que la petición se envía completa antes de leer la respuesta. Sin ella, `fetch` rechaza con `TypeError: RequestInit: duplex option is required when sending a body.` (medido con Node 24.14.1). Mientras tanto, la petición rápida cambia el servicio con la misma etiqueta. Cuando la rápida termina, se llama a `soltar()`, y la lenta termina de mandar su cuerpo. El servidor, que comparó la etiqueta al empezar, la compara otra vez al escribir (Lección 3), la encuentra vencida y responde `412`. Las tres comprobaciones finales cierran el caso: la rápida da `200`, la lenta da `412`, y el servicio queda con el valor de la rápida.

Esta prueba **casi no depende de la suerte**. Se podría intentar con dos `fetch` simultáneos y esperar que coincidan, y sería un caso que a veces falla y a veces no. Aquí la única espera por reloj son los 300 ms que se le dan al primer pedazo para llegar; a partir de ahí el orden lo fuerza el programa (`soltar()`), no el azar.

#### 8.8.2 El método heredado: llamar a la puerta sin servidor

`Object.prototype` tiene métodos con nombres como `constructor` o `toString`. Si la puerta del `revisor` buscara el método de una petición en un objeto común, `constructor` aparecería como si fuera un método de la ruta. El arreglo es buscarlo con `Object.hasOwn`. ¿Cómo se comprueba, si Node responde `400` a un método que no conoce antes de llamar al `revisor` (se puede ver con `curl -X constructor`)? Llamando a la puerta **directamente**, sin servidor:

```ts
async function metodoHeredado(): Promise<[string, string[]]> {
  const { atender } = await import("./rutas.ts");
  const fallas: string[] = [];
  // rutas.ts escribe cada petición en la terminal del revisor; aquí correría dentro de la matriz.
  const registrar = console.log;
  console.log = () => {};
  for (const method of ["constructor", "toString", "__proto__"]) {
    const peticion = { method, url: "/servicios/1", headers: { authorization: "Bearer escritura-a" } };
    const codigo = await new Promise<string>((listo) => {
      const respuesta = {
        req: peticion,
        statusCode: 0,
        writeHead(codigo: number) { this.statusCode = codigo; return this; },
        end() { listo(String(this.statusCode)); },
      };
      atender(peticion as unknown as IncomingMessage, respuesta as unknown as ServerResponse)
        .catch((error: unknown) => listo(`excepción ${String(error)}`));
    });
    if (codigo !== "405") fallas.push(`${method}: ${codigo}`);
  }
  console.log = registrar;
  return ["método heredado de Object.prototype (constructor, toString, __proto__): 405", fallas];
}
```

La función importa `atender` de `rutas.ts` y la llama con una petición y una respuesta **de mentira**: dos objetos con solo lo que la puerta lee. Si la puerta contesta con un `405` (el `statusCode` que `writeHead` recibió), todo bien; si lanza una excepción, la promesa de `listo` se resuelve con el texto «excepción …». Antes de llamar silencia `console.log`, porque la puerta escribe cada petición en la terminal y aquí correría dentro de la matriz; y lo restaura al terminar. Es una prueba de **unidad** metida en una matriz de integración, y está bien: lo importante es que se corra, no el nombre del tipo de prueba.

#### 8.8.3 La ETag tras reiniciar: matar y levantar

La última técnica es reiniciar el servidor desde la propia matriz:

```ts
async function etiquetaTrasReinicio(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const B = { Authorization: "Bearer escritura-b" };
  const antes = (await enviar({ metodo: "GET", ruta: "/servicios/3", cabeceras: B })).headers.get("etag") ?? "";
  const viejo = procesos[1];
  const salida = new Promise((listo) => viejo.once("exit", listo));
  viejo.kill();
  await salida;
  procesos[1] = await arrancar("servidor.ts", 18080);
  const r = await enviar({ metodo: "GET", ruta: "/servicios/3", cabeceras: { ...B, "If-None-Match": antes } });
  await r.text();
  const despues = r.headers.get("etag");
  if (r.status !== 200) fallas.push(`If-None-Match: ${antes} tras reiniciar dio ${r.status}, se esperaba 200`);
  if (despues === antes) fallas.push(`la etiqueta se repitió: ${antes}`);
  return ["ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)", fallas];
}
```

Lee la etiqueta del servicio 3, que nunca cambia, mata al `revisor` que ella misma levantó, lo vuelve a arrancar, y le pide el servicio 3 con la etiqueta de antes. Si el `revisor` repitiera la etiqueta (`"3-1"` antes y `"3-1"` después), respondería `304`, un `304` falso: el cliente se quedaría con una copia de antes del reinicio. Con el identificador de arranque en la etiqueta (`"3-1-86b39f38"` contra otra de ocho cifras), responde `200`. Es la regla del RFC 9110, sección 8.8.1, que pide que una etiqueta fuerte no se reutilice para otra representación.

### 8.9 Lo mismo, con `curl`

La matriz de TypeScript es la que se corre en cada cambio, pero la primera pregunta de quien la lee suele ser: *¿y eso, escrito a mano, cómo se vería?* `fig08_03.sh` contesta esa pregunta. Es la misma idea de 23 escenarios escrita como la teclearías en una terminal: peticiones con `curl`, un tipo de contenido y una cabecera que se esperan, un contador al final. Levanta el laboratorio y el `revisor` por su cuenta y los apaga por PID al terminar.

```bash
#!/usr/bin/env bash
# fig08_03.sh — los 23 códigos del curso con curl y nada más: la misma idea de matriz23.ts, escrita como la
# teclearías tú en una terminal. Levanta el laboratorio y el revisor, prueba, y los apaga por PID.
# Uso: bash fig08_03.sh            (desde la carpeta que contiene fig08_01/)
set -u
cd "$(dirname "$0")/fig08_01" || exit 2
R=http://127.0.0.1:18080
LAB=http://127.0.0.1:18081

# Si algo ya escucha en los puertos del curso, la corrida mediría a otro programa: se detiene.
for puerto in 18080 18081; do
  if (exec 3<>/dev/tcp/127.0.0.1/$puerto) 2>/dev/null; then echo "el puerto $puerto está ocupado; apaga lo que lo usa"; exit 1; fi
done

node laboratorio.ts > /dev/null 2>&1 &
PID_LAB=$!
node servidor.ts > /dev/null 2>&1 &
PID_REV=$!
CAB=$(mktemp)
trap 'kill $PID_LAB $PID_REV 2>/dev/null; rm -f "$CAB"' EXIT
sleep 1

total=0
bien=0

# probar CODIGO "nombre" TIPO CABECERA -- argumentos de curl
#   TIPO:     problema (application/problem+json) · json (application/json) · nada (sin cuerpo)
#   CABECERA: la cabecera obligatoria de esa respuesta, o «-» si no hay
probar() {
  local esperado=$1 nombre=$2 tipo=$3 cabecera=$4
  shift 4
  total=$((total + 1))
  local salida codigo bytes tipo_visto fallas=""
  salida=$(curl -sS -o /dev/null -D "$CAB" -w '%{http_code} %{size_download}' "$@")
  codigo=${salida% *}
  bytes=${salida#* }
  tipo_visto=$(grep -i '^content-type:' "$CAB" | tr -d '\r' | sed 's/^[^:]*: *//')
  [ "$codigo" = "$esperado" ] || fallas="$fallas código $codigo;"
  case "$tipo" in
    problema) [ "$tipo_visto" = "application/problem+json" ] || fallas="$fallas tipo «$tipo_visto»;" ;;
    json) [ "$tipo_visto" = "application/json" ] || fallas="$fallas tipo «$tipo_visto»;" ;;
    nada) [ "$bytes" = "0" ] || fallas="$fallas trae $bytes bytes de cuerpo;" ;;
  esac
  if [ "$cabecera" != "-" ]; then
    grep -qi "^$cabecera:" "$CAB" || fallas="$fallas falta $cabecera;"
  fi
  if [ -z "$fallas" ]; then
    bien=$((bien + 1))
    echo "ok    $esperado $nombre"
  else
    echo "FALLA $esperado $nombre:$fallas"
  fi
}

LEE='Authorization: Bearer lectura-a'
ESCRIBE='Authorization: Bearer escritura-a'
ADMIN='Authorization: Bearer admin'
JSON='Content-Type: application/json'

ETAG=$(curl -sS -o /dev/null -w '%header{etag}' "$R/servicios/1" -H "$LEE")

probar 200 "consultar un servicio"            json     etag     "$R/servicios/1" -H "$LEE"
probar 304 "consultar sin cambios"            nada     etag     "$R/servicios/1" -H "$LEE" -H "If-None-Match: $ETAG"
probar 201 "dar de alta"                      json     location -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d "{\"nombre\":\"curl\",\"url\":\"$LAB/codigo/200\"}"
probar 202 "pedir revisión"                   json     location -X POST "$R/servicios/1/revisiones" -H "$ESCRIBE"
probar 204 "retirar"                          nada     -        -X DELETE "$R/servicios/7" -H "$ESCRIBE"
probar 301 "ruta vieja con 301"               nada     location -X POST "$R/viejo/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":"viejo","url":"http://127.0.0.1:18081/codigo/200"}'
probar 308 "ruta vieja con 308"               nada     location -X POST "$R/api/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":"api","url":"http://127.0.0.1:18081/codigo/200"}'
probar 400 "cuerpo ilegible"                  problema -        -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":'
probar 401 "sin credencial"                   problema www-authenticate "$R/servicios"
probar 403 "lectura que intenta escribir"     problema -        -X DELETE "$R/servicios/1" -H "$LEE"
probar 404 "servicio que no existe"           problema -        "$R/servicios/99" -H "$LEE"
probar 405 "método no admitido"               problema allow    -X PATCH "$R/servicios/1" -H "$ESCRIBE"
probar 409 "nombre repetido"                  problema -        -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d "{\"nombre\":\"pagos\",\"url\":\"$LAB/codigo/200\"}"
probar 410 "servicio retirado"                problema -        "$R/servicios/7" -H "$LEE"
probar 412 "etiqueta vencida"                 problema -        -X PUT "$R/servicios/1" -H "$ESCRIBE" -H "$JSON" -H 'If-Match: "1-0"' -d "{\"nombre\":\"catalogo\",\"url\":\"$LAB/codigo/200\"}"
probar 415 "formato no admitido"              problema accept   -X POST "$R/servicios" -H "$ESCRIBE" -H 'Content-Type: text/plain' -d 'curl'
probar 422 "datos imposibles"                 problema -        -X POST "$R/servicios" -H "$ESCRIBE" -H "$JSON" -d '{"nombre":"","url":"ftp://x"}'
probar 428 "cambio sin If-Match"              problema -        -X PUT "$R/servicios/1" -H "$ESCRIBE" -H "$JSON" -d "{\"nombre\":\"catalogo\",\"url\":\"$LAB/codigo/200\"}"
for i in 1 2 3; do curl -sS -o /dev/null -X POST "$R/servicios/2/revisiones" -H "$ESCRIBE"; done
probar 429 "demasiadas revisiones"            problema retry-after -X POST "$R/servicios/2/revisiones" -H "$ESCRIBE"
probar 500 "el defecto a propósito"           problema -        "$R/servicios/4/informe" -H "$LEE"
probar 502 "el servicio responde basura"      problema -        "$R/servicios/6/salud" -H "$LEE"
curl -sS -o /dev/null -X PUT "$R/mantenimiento" -H "$ADMIN" -H "$JSON" -d '{"activo":true}'
probar 503 "mantenimiento"                    problema retry-after "$R/servicios" -H "$LEE"
curl -sS -o /dev/null -X PUT "$R/mantenimiento" -H "$ADMIN" -H "$JSON" -d '{"activo":false}'
probar 504 "el servicio no responde a tiempo" problema -        "$R/servicios/5/salud" -H "$LEE"

echo
echo "$bien de $total escenarios pasaron"
[ "$bien" = "$total" ]
```

Cinco ideas del guion:

- **La puerta de entrada.** Antes de levantar nada, intenta abrir una conexión a cada puerto con `/dev/tcp`, una facilidad de `bash`. Si alguien responde, el puerto está ocupado y el guion se niega a seguir: medir contra el programa de otro es una forma segura de ver resultados que no son tuyos.
- **`probar`.** Es la función que hace todo el trabajo. Recibe el código esperado, un nombre, el tipo de cuerpo (`problema`, `json` o `nada`), la cabecera obligatoria (o un guion si no hay) y los argumentos de `curl`. Pide a `curl` que guarde las cabeceras en un archivo (`-D`), que no imprima el cuerpo (`-o /dev/null`) y que escriba el código y el tamaño del cuerpo (`-w '%{http_code} %{size_download}'`). Después compara.
- **`size_download`.** Para saber que un `204` o un `304` no trae cuerpo, no hace falta ver el cuerpo: el tamaño de lo descargado tiene que ser cero.
- **`trap … EXIT`.** Es el `finally` del guion: apaga al laboratorio y al `revisor` por PID y borra el archivo temporal de cabeceras, aunque el guion termine por un error.
- **El `sleep 1`.** Es la misma espera fija que la sección 8.14.1 reemplaza en la matriz de TypeScript; aquí se conserva por sencillez, y es el primer sitio donde este guion fallaría en una máquina lenta.

Córrelo desde la carpeta que contiene `fig08_01/`:

```text
$ bash fig08_03.sh
ok    200 consultar un servicio
ok    304 consultar sin cambios
ok    201 dar de alta
ok    202 pedir revisión
ok    204 retirar
ok    301 ruta vieja con 301
ok    308 ruta vieja con 308
ok    400 cuerpo ilegible
ok    401 sin credencial
ok    403 lectura que intenta escribir
ok    404 servicio que no existe
ok    405 método no admitido
ok    409 nombre repetido
ok    410 servicio retirado
ok    412 etiqueta vencida
ok    415 formato no admitido
ok    422 datos imposibles
ok    428 cambio sin If-Match
ok    429 demasiadas revisiones
ok    500 el defecto a propósito
ok    502 el servicio responde basura
ok    503 mantenimiento
ok    504 el servicio no responde a tiempo

23 de 23 escenarios pasaron
(código de salida: 0)
```

Veintitrés de veintitrés, y el guion sale con `0`. La versión de `curl` es honesta sobre lo que comprueba menos: mira el código, el tipo de contenido, la cabecera y, para los éxitos sin cuerpo, el tamaño. **No** mira el `type` del cuerpo, ni el `status` del cuerpo, ni las fugas, ni que el código esté declarado en el documento. Tampoco corre las dieciocho adicionales. Sirve para ver el esqueleto de la idea y para comprobar un cambio rápido sin Node en la mano; la comprobación completa es la de TypeScript.

### 8.10 Que la prueba muerda

Una comprobación que nunca se vio fallar no demuestra nada: dará verde lo mismo si funciona que si está rota. Por eso varias comprobaciones de la matriz se probaron dos veces, una con el arreglo puesto y otra con el arreglo deshecho, y se anotó qué número daba la matriz en cada caso (las de esta sección, la del `405` del ejercicio 3, la del cuerpo por partes de 8.14.1 y la del arranque lento del ejercicio 6). Las demás no tienen un control negativo guardado, y es una de las cosas que la matriz no promete (sección 8.14). Aquí lo haces tú con dos defectos a propósito, uno en el servidor y otro en el documento. Los dos están en la carpeta `defectos/`, con un aviso en la primera línea del archivo.

#### 8.10.1 El servidor «limpiado»

El primer defecto es la escena del principio. Cambia un solo archivo, `problemas.ts`, el manejador central de errores. Lo que cambia es esto:

```ts
    // DEFECTO A PROPÓSITO: se quitó Retry-After (una «limpieza» de cabeceras) ...
    ...Object.fromEntries(Object.entries(opciones.cabeceras ?? {}).filter(([nombre]) => nombre.toLowerCase() !== "retry-after")),
    // ... y el tipo de contenido pasó a ser el genérico.
    "Content-Type": "application/json",
```

Son dos cambios, cada uno razonable visto solo. El primero quita una cabecera que a alguien le pareció de más. El segundo unifica el tipo de contenido de todos los errores con el de los éxitos. Ningún código de estado cambia. Para provocarlo, copia la carpeta, reemplaza el archivo y corre la matriz:

```text
$ cp -R fig08_01 rota
$ cp defectos/sin-problem-json/problemas.ts rota/problemas.ts
$ cd rota
```

```text
$ node matriz23.ts
ok    200 consultar un servicio
ok    304 consultar sin cambios
ok    201 dar de alta
ok    202 pedir revisión
ok    204 retirar
ok    301 ruta vieja con 301
ok    308 ruta vieja con 308
FALLA 400 cuerpo ilegible: tipo application/json, se esperaba application/problem+json
FALLA 401 sin credencial: tipo application/json, se esperaba application/problem+json
FALLA 403 lectura que intenta escribir: tipo application/json, se esperaba application/problem+json
FALLA 404 servicio que no existe: tipo application/json, se esperaba application/problem+json
FALLA 405 método no admitido: tipo application/json, se esperaba application/problem+json
FALLA 409 nombre repetido: tipo application/json, se esperaba application/problem+json
FALLA 410 servicio retirado: tipo application/json, se esperaba application/problem+json
FALLA 412 etiqueta vencida: tipo application/json, se esperaba application/problem+json
FALLA 415 formato no admitido: tipo application/json, se esperaba application/problem+json
FALLA 422 datos imposibles: tipo application/json, se esperaba application/problem+json
FALLA 428 cambio sin If-Match: tipo application/json, se esperaba application/problem+json
FALLA 429 demasiadas revisiones: falta retry-after; tipo application/json, se esperaba application/problem+json
FALLA 500 el defecto a propósito: tipo application/json, se esperaba application/problem+json
FALLA 502 el servicio responde basura: tipo application/json, se esperaba application/problem+json
FALLA 503 mantenimiento: falta retry-after; tipo application/json, se esperaba application/problem+json
FALLA 504 el servicio no responde a tiempo: tipo application/json, se esperaba application/problem+json
ok    misma Idempotency-Key: no duplica; con otro cuerpo, 422
ok    SSRF: http://169.254.169.254/latest/meta-data/ se rechaza con 422 destino-prohibido
ok    SSRF: http://localhost:18080/mantenimiento se rechaza con 422 destino-prohibido
ok    credencial heredada de Object.prototype (constructor, __proto__, toString): 401
ok    If-None-Match con lista, W/ y * (débil): 304; If-Match con W/: 412; con lista o *: 200
ok    actualización perdida: dos PUT a la vez con la misma If-Match: 200 y 412, gana la primera que escribe
ok    orden del PUT: text/plain da 415 con etiqueta vieja o sin ella; retirado en el hueco, 410
ok    esquema sin distinguir mayúsculas (bearer: 200); Basic: reto sin error="invalid_token"
ok    método heredado de Object.prototype (constructor, toString, __proto__): 405
ok    cuerpo JSON que no es objeto (null, 7, "texto", []): 400, y el revisor sigue vivo
ok    cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo
FALLA 429 por credencial: la cuarta consulta en vivo, 429; otra credencial no lo paga; enumerar ids llega al 429: el 429 no trae Retry-After
ok    Retry-After: 1.5, -1 y «12 30» se ignoran; las tres formas de HTTP-date dan lo mismo (GMT)
ok    SSRF: 12 direcciones de uso especial (CGNAT, NAT64, 6to4, compatible, 64:ff9b:1::/48, 240/4, 198.18/15, TEST-NET, 2001:db8::, Teredo, multicast): 422; 6to4 con IPv4 pública: 201
ok    la pasarela reenvía Content-Length; sin revisor responde 502 y sigue viva; alta-segura termina al agotar los intentos, también sin conexión
ok    alta-segura decide: un 4xx sale con 1; obedece Retry-After si es razonable y no insiste si pide mucho; se corta por tiempo ante un servidor mudo; el 409 de llave en curso se reintenta y el de nombre repetido no
ok    el banco responde el 205 sin cuerpo, con Content-Length: 0 y sin Transfer-Encoding
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

24 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 1)
```

Léela como lo haría quien la ve por primera vez a las 10:05. Lo primero que llama la atención es lo que **no** falla: los siete primeros renglones (los éxitos y las redirecciones) siguen en verde, y también todas las comprobaciones adicionales salvo una. Lo segundo es lo que falla: **todos** los errores, desde el `400` hasta el `504`, con el mismo mensaje: el tipo de contenido que llegó es `application/json` y se esperaba `application/problem+json`. En el `429` y en el `503` el mensaje trae una frase más, `falta retry-after`, y en la comprobación adicional de los `429` por credencial se repite. Y el `401`, el `405` y el `415` conservan sus cabeceras (`www-authenticate`, `allow`, `accept`), porque el defecto solo quitó `Retry-After`. Cada falla dice **qué promesa se rompió y en qué escenario**, y la lista completa tiene 17 renglones rojos de 41; el programa sale con `1`.

Hay un dato que importa más que el recuento: **ningún renglón dice «código»**. Si las pruebas de la escena del principio hubieran sido solo de código, esta corrida habría dado 41 de 41. La matriz no ve solo el código, y por eso se habría puesto roja el mismo lunes en que se subió el cambio.

#### 8.10.2 El documento que se quedó atrás

El segundo defecto vive en el documento. Es la otra mitad de la escena: alguien agregó el `429` al servidor y no lo escribió, o lo escribió y después lo quitó. Para provocarlo, el archivo `defectos/sin-429-documentado/openapi.json` es el documento de siempre sin el `429` de `POST /servicios/{id}/revisiones`:

```text
$ cp -R fig08_01 rota
$ cp defectos/sin-429-documentado/openapi.json rota/openapi.json
$ cd rota
```

```text
$ node matriz23.ts
ok    200 consultar un servicio
ok    304 consultar sin cambios
ok    201 dar de alta
ok    202 pedir revisión
ok    204 retirar
ok    301 ruta vieja con 301
ok    308 ruta vieja con 308
ok    400 cuerpo ilegible
ok    401 sin credencial
ok    403 lectura que intenta escribir
ok    404 servicio que no existe
ok    405 método no admitido
ok    409 nombre repetido
ok    410 servicio retirado
ok    412 etiqueta vencida
ok    415 formato no admitido
ok    422 datos imposibles
ok    428 cambio sin If-Match
FALLA 429 demasiadas revisiones: openapi.json no documenta 429 en POST /servicios/{id}/revisiones
ok    500 el defecto a propósito
ok    502 el servicio responde basura
ok    503 mantenimiento
ok    504 el servicio no responde a tiempo
ok    misma Idempotency-Key: no duplica; con otro cuerpo, 422
ok    SSRF: http://169.254.169.254/latest/meta-data/ se rechaza con 422 destino-prohibido
ok    SSRF: http://localhost:18080/mantenimiento se rechaza con 422 destino-prohibido
ok    credencial heredada de Object.prototype (constructor, __proto__, toString): 401
ok    If-None-Match con lista, W/ y * (débil): 304; If-Match con W/: 412; con lista o *: 200
ok    actualización perdida: dos PUT a la vez con la misma If-Match: 200 y 412, gana la primera que escribe
ok    orden del PUT: text/plain da 415 con etiqueta vieja o sin ella; retirado en el hueco, 410
ok    esquema sin distinguir mayúsculas (bearer: 200); Basic: reto sin error="invalid_token"
ok    método heredado de Object.prototype (constructor, toString, __proto__): 405
ok    cuerpo JSON que no es objeto (null, 7, "texto", []): 400, y el revisor sigue vivo
ok    cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo
ok    429 por credencial: la cuarta consulta en vivo, 429; otra credencial no lo paga; enumerar ids llega al 429
ok    Retry-After: 1.5, -1 y «12 30» se ignoran; las tres formas de HTTP-date dan lo mismo (GMT)
ok    SSRF: 12 direcciones de uso especial (CGNAT, NAT64, 6to4, compatible, 64:ff9b:1::/48, 240/4, 198.18/15, TEST-NET, 2001:db8::, Teredo, multicast): 422; 6to4 con IPv4 pública: 201
ok    la pasarela reenvía Content-Length; sin revisor responde 502 y sigue viva; alta-segura termina al agotar los intentos, también sin conexión
ok    alta-segura decide: un 4xx sale con 1; obedece Retry-After si es razonable y no insiste si pide mucho; se corta por tiempo ante un servidor mudo; el 409 de llave en curso se reintenta y el de nombre repetido no
ok    el banco responde el 205 sin cuerpo, con Content-Length: 0 y sin Transfer-Encoding
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

40 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 1)

$ cp ~/curso-http/rota/openapi.json ~/validador/openapi.json && cd ~/validador   # la carpeta se arma en 8.11
$ npx redocly lint openapi.json --format=stylish 2>&1 | grep -v operationId   # el mismo documento, sin el 429
No configurations were provided -- using built in recommended configuration by default.

validating openapi.json...
openapi.json:
  540:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  540:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  554:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  554:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  570:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  570:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  584:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  584:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  694:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  899:7  warning  no-unused-components    Component: "E429" is never used.

openapi.json: validated in 39ms

Woohoo! Your API description is valid. 🎉
You have 27 warnings.

(código de salida: 0)
```

Al final de esa salida está el mismo documento pasado por un validador (Redocly, que se instala en 8.11; los tres comandos copian cada documento a la carpeta del validador con el nombre `openapi.json`); se explica en 8.11.3. La matriz marca **una** falla, exactamente la que corresponde: `429 demasiadas revisiones: openapi.json no documenta 429 en POST /servicios/{id}/revisiones`. El servidor sigue haciendo lo que hacía; el documento dejó de decirlo, y la matriz lo notó porque el escenario del `429` pregunta, al final de `comprobar`, si el documento declara ese código en esa operación (sección 8.6.3). Es un resultado limpio: 40 de 41, un solo renglón rojo, un solo culpable.

> **Una línea de aviso dentro de un JSON.** JSON no admite comentarios, así que un aviso en la primera línea no se puede escribir como en TypeScript. El archivo usa la manera que la especificación de OpenAPI ofrece para esto (sección 4.9, «Specification Extensions»): un campo cuyo nombre empieza con `x-` puede llevar cualquier valor, y el documento sigue siendo válido. Por eso la primera línea del defecto es `{ "x-defecto": "DEFECTO A PROPÓSITO …",`.

### 8.11 Un documento válido no es un documento cierto

El mismo documento al que le quitaste el `429` hace una cosa interesante cuando se lo das a un validador de OpenAPI. Un **validador** (en inglés, *linter* cuando además opina sobre el estilo) lee el documento y dice si está bien escrito según la especificación. Hay varios; el curso usa **Redocly CLI**, una herramienta de línea de comandos con licencia MIT, y su comando `lint` ([documentación](https://redocly.com/docs/cli/commands/lint)). No es una dependencia del `revisor`: se instala aparte, en una carpeta de trabajo, y se tira cuando termines.

```text
$ mkdir ~/validador && cd ~/validador
$ npm init -y
$ npm install --no-save @redocly/cli@2.57.0
$ cp ~/curso-http/fig08_01/openapi.json .
```

#### 8.11.1 El documento del `revisor`, validado

```text
$ cp ~/curso-http/fig08_01/openapi.json ~/validador/openapi.json   # otra vez el documento bueno
$ npx redocly lint openapi.json --format=stylish
No configurations were provided -- using built in recommended configuration by default.

validating openapi.json...
openapi.json:
  25:7   warning  operation-operationId   Operation object should contain `operationId` field.
  49:7   warning  operation-operationId   Operation object should contain `operationId` field.
  127:7  warning  operation-operationId   Operation object should contain `operationId` field.
  180:7  warning  operation-operationId   Operation object should contain `operationId` field.
  260:7  warning  operation-operationId   Operation object should contain `operationId` field.
  299:7  warning  operation-operationId   Operation object should contain `operationId` field.
  356:7  warning  operation-operationId   Operation object should contain `operationId` field.
  411:7  warning  operation-operationId   Operation object should contain `operationId` field.
  457:7  warning  operation-operationId   Operation object should contain `operationId` field.
  491:7  warning  operation-operationId   Operation object should contain `operationId` field.
  540:7  warning  operation-operationId   Operation object should contain `operationId` field.
  543:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  543:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  554:7  warning  operation-operationId   Operation object should contain `operationId` field.
  557:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  557:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  570:7  warning  operation-operationId   Operation object should contain `operationId` field.
  573:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  573:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  584:7  warning  operation-operationId   Operation object should contain `operationId` field.
  587:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.
  587:9  warning  operation-4xx-response  Operation must have at least one `4XX` response.
  600:7  warning  operation-operationId   Operation object should contain `operationId` field.
  649:7  warning  operation-operationId   Operation object should contain `operationId` field.
  693:7  warning  operation-operationId   Operation object should contain `operationId` field.
  697:9  warning  operation-2xx-response  Operation must have at least one `2XX` response.

openapi.json: validated in 48ms

Woohoo! Your API description is valid. 🎉
You have 26 warnings.

(código de salida: 0)
```

Léela de arriba abajo. La línea del principio avisa que no se dio ninguna configuración y que se usa la **recomendada**, que es el valor por omisión del comando. Siguen 26 advertencias (*warnings*), y el veredicto: «Woohoo! Your API description is valid.» Es decir: cero errores. El documento está bien escrito según la especificación.

Las 26 advertencias no son errores, y se reparten en tres grupos que conviene entender:

- **17 de `operation-operationId`.** Cada operación puede llevar un `operationId`, un identificador único (la especificación, sección 4.8.10.1, dice que debe ser único entre todas las operaciones del documento). Sirve a las herramientas que **generan código** a partir del documento, para nombrar las funciones. El curso no genera código, así que el documento no lo trae. Es una decisión, y la advertencia es el validador preguntando si lo olvidaste.
- **5 de `operation-2xx-response`.** Cinco operaciones no declaran ninguna respuesta `2xx`: las dos redirecciones viejas (`GET` y `POST` de `/viejo/servicios` y de `/api/servicios`, cuatro) y `GET /v0/servicios` (la versión retirada, que solo responde `410`). Es verdad: esas rutas no tienen éxito. La advertencia es el validador preguntando si es a propósito, y lo es.
- **4 de `operation-4xx-response`.** Las cuatro redirecciones tampoco declaran ninguna respuesta `4xx`.

Ninguna de las 26 es una promesa rota, y por eso el documento se queda como está. Pero es la clase de decisión que se toma a la vista, no en silencio: se corre el validador, se lee cada grupo y se decide.

#### 8.11.2 El control positivo: un documento que sí está mal escrito

Un validador que siempre dice «válido» tampoco prueba nada. Para ver que el de arriba **muerde**, el defecto `documento-roto` tiene dos errores de escritura: una referencia a una respuesta que no existe (`E4O1`, con una letra O en lugar de un cero) y un `204` sin su `description`:

```text
$ cp ~/curso-http/defectos/documento-roto/openapi.json ~/validador/openapi.json
$ npx redocly lint openapi.json --format=stylish 2>&1 | grep -v operationId   # el documento roto a propósito
No configurations were provided -- using built in recommended configuration by default.

validating openapi.json...
openapi.json:
  38:18   error    no-unresolved-refs      Can't resolve $ref
  263:11  error    struct                  The field `description` must be present on this level.
  541:9   warning  operation-2xx-response  Operation must have at least one `2XX` response.
  541:9   warning  operation-4xx-response  Operation must have at least one `4XX` response.
  555:9   warning  operation-2xx-response  Operation must have at least one `2XX` response.
  555:9   warning  operation-4xx-response  Operation must have at least one `4XX` response.
  571:9   warning  operation-2xx-response  Operation must have at least one `2XX` response.
  571:9   warning  operation-4xx-response  Operation must have at least one `4XX` response.
  585:9   warning  operation-2xx-response  Operation must have at least one `2XX` response.
  585:9   warning  operation-4xx-response  Operation must have at least one `4XX` response.
  695:9   warning  operation-2xx-response  Operation must have at least one `2XX` response.

openapi.json: validated in 93ms

❌ Validation failed with 2 errors and 26 warnings.
run `redocly lint --generate-ignore-file` to add all problems to the ignore file.

(código de salida: 1)
```

Ahora sí: **dos errores**, y el validador se niega a darlo por bueno. El primero dice `no-unresolved-refs`, «Can't resolve $ref», en la línea 38, que es la referencia mal escrita. El segundo dice `struct`, «The field `description` must be present on this level», en la línea 263, que es el `204`: la especificación (sección 4.8.17.1) exige `description` en toda respuesta. Los dos son del tipo de error que se cuela en un documento de más de mil líneas escrito a mano, y el validador los atrapa sin que corras ningún servidor.

#### 8.11.3 La conclusión incómoda

Ahora la misma herramienta, contra el documento de la sección 8.10.2, el que no tiene el `429`:

```text
$ npx redocly lint openapi.json --format=stylish
```

Su veredicto: «Woohoo! Your API description is valid.», con 27 advertencias, una más que las 26 de antes. La nueva dice `no-unused-components`: «Component: "E429" is never used.» Es decir, el validador **sí notó** algo: la respuesta reutilizable `E429` quedó sin ninguna operación que la use. Pero lo dijo como una advertencia, no como un error, y no tenía forma de saber que el servidor sigue devolviendo ese `429`. El documento sigue siendo válido, y el validador **no** vio que mentía.

Eso no es una falla del validador. Un validador contesta a la pregunta *¿está bien escrito?*, y el documento sin el `429` está perfectamente bien escrito: simplemente no menciona un código que el servidor sí devuelve. Para contestar *¿es cierto?* hay que comparar el documento con el servidor, y eso es lo que hace la matriz. Las dos herramientas no se sustituyen, se complementan:

| Pregunta | La contesta | Ejemplo en esta lección |
|---|---|---|
| ¿Está bien escrito? | el validador (`redocly lint`) | la referencia `E4O1` y el `204` sin `description` |
| ¿Es cierto? | la matriz (`matriz23.ts`) | el `429` que el servidor devuelve y el documento calla |
| ¿Dice todo? | el cruce del catálogo (`fig08_02.ts`) | `revision-inexistente`, que el documento no menciona |

Una API con solo la primera fila tiene un documento elegante y desactualizado. Una API con solo la segunda tiene una verificación que depende de un documento que nadie sabe si se puede leer. Con las tres, cada tipo de error tiene quien lo cace.

### 8.12 DNS rebinding: el hueco de la Lección 1, cerrado

La Lección 1 dejó una deuda anotada en un comentario de `destinos.ts`: el `revisor` valida el destino antes de cada conexión, y aun así queda una ventana. Hoy se cierra. Antes de ver cómo, conviene contar por qué importa con dos casos de este mismo año.

#### 8.12.1 Dos avisos públicos

El 10 de julio de 2026 se publicó un aviso de seguridad sobre `mcp-atlassian`, un servidor MCP de código abierto y de terceros (no es un producto de Atlassian) para conectar agentes de IA con Jira y Confluence ([GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q)). Lo interesante es que **ya había tenido un arreglo** contra SSRF; el aviso trata de por qué ese arreglo no bastó. El arreglo resolvía el nombre una vez, para revisarlo, y la petición posterior volvía a usar el nombre tal cual, así que, dice el aviso, la petición «re-resuelve al conectar, sin fijar la IP» (traducción nuestra de: *re-resolves at connect time with no IP pinning*). Un nombre controlado por quien ataca puede contestar una dirección pública mientras se revisa y una interna (como `169.254.169.254`, donde las nubes publican los metadatos de la máquina) cuando se conecta. El aviso aclara que la prueba que acompaña al reporte no demuestra un ataque completo contra un servidor en marcha, y que explotarlo exige ganar esa carrera. Lo califica como una carrera entre la revisión y el uso (en inglés, *TOCTOU*, *time of check, time of use*) y la versión que lo corrige es la 0.22.0.

Casi un mes antes, el 15 de junio de 2026, se había publicado otro, con el mismo patrón y en otro producto: **CVE-2026-53708**, en una pasarela de servidores MCP ([aviso GHSA-9hgc-g3w5-67cm](https://github.com/advisories/GHSA-9hgc-g3w5-67cm)). Un punto de acceso de administración revisaba el nombre de una URL resolviéndolo, bloqueaba lo privado, y luego **entregaba el nombre original** al cliente HTTP, que lo resolvía otra vez. Un atacante que controla el DNS puede devolver una IP pública durante la validación y una privada durante la conexión. Se corrigió en la versión 1.0.3 (gravedad moderada, CVSS 6.6). El aviso lo dice así: el punto de acceso valida el nombre resolviéndolo, y que el cliente HTTP, por su cuenta, vuelve a resolver el nombre al conectar sin que nada una las dos operaciones (paráfrasis nuestra del aviso, que está en inglés). La recomendación es la misma que la del otro aviso: fijar la IP ya validada en la conexión.

Una aclaración de nombres: «DNS rebinding» designa, en su sentido clásico, un ataque desde el navegador contra la política de mismo origen; los avisos (y OWASP) llaman igual a esta carrera del lado del servidor, que es el sentido que tiene aquí. Los dos tienen algo en común con el `revisor` de la Lección 1: un programa cuyo trabajo es conectarse a direcciones que alguien más le dio. Y los dos tuvieron el defecto que la Lección 1 nombró y dejó abierto: validar y conectar son **dos resoluciones**, no una. La guía de OWASP sobre SSRF lo dice sin rodeos: «un segundo DNS lookup sin revisar entre la validación y la conexión puede saltarse estas defensas» (traducción nuestra); y recomienda conectarse solo a las direcciones validadas, conservando el nombre original para la cabecera `Host`, el SNI y la verificación del certificado ([guía de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)).

#### 8.12.2 El mecanismo, con tus propias manos

Antes de leer la defensa, haz que el ataque ocurra, en pequeño y sin atacar a nadie. `fig08_04.ts` simula un DNS que miente: la **primera** vez que le preguntan por `rebote.ejemplo`, contesta `127.0.0.1` (el laboratorio, que está permitido); desde la **segunda**, contesta `::1`, donde escucha otro servidor que responde `299` (un código que nadie más devuelve, para reconocerlo). Se reemplazan `dns.lookup` y `dns/promises.lookup` por funciones nuestras que cuentan cuántas veces las llaman. Nada de esto sale de tu máquina:

```ts
// fig08_04.ts — DNS rebinding simulado: ¿a qué servidor llega el cliente cuando el nombre cambia de dueño
// entre la validación y la conexión? No ataca nada: el «DNS malicioso» es una función nuestra que miente
// la segunda vez que le preguntan.
// Uso: node fig08_04.ts <carpeta con cliente.ts y destinos.ts>      (por ejemplo, fig08_01 o con-fetch)
import dns from "node:dns";
import dnsPromesas from "node:dns/promises";
import { createServer } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const carpeta = process.argv[2];
if (carpeta === undefined) {
  console.error("uso: node fig08_04.ts <carpeta>");
  process.exit(2);
}

const NOMBRE = "rebote.ejemplo";
const PUERTO = 18081; // el del laboratorio: es el único destino privado que destinos.ts permite

// Dos servidores: el laboratorio de siempre (127.0.0.1) y «otro», en ::1, que responde 299.
// Ningún nombre se resuelve de verdad: las dos direcciones se escriben a mano.
const laboratorio = createServer((_p, r) => { r.writeHead(200); r.end(); });
const otro = createServer((_p, r) => { r.writeHead(299); r.end(); });
await new Promise<void>((listo) => laboratorio.listen(PUERTO, "127.0.0.1", listo));
await new Promise<void>((listo) => otro.listen(PUERTO, "::1", listo));

// El DNS que miente: la primera pregunta recibe una dirección permitida; las demás, la del «otro».
let preguntas = 0;
function responder(nombre: string): { address: string; family: number } {
  preguntas++;
  const direccion = preguntas === 1 ? { address: "127.0.0.1", family: 4 } : { address: "::1", family: 6 };
  console.log(`  pregunta ${preguntas} al DNS: ${nombre} -> ${direccion.address}`);
  return direccion;
}
const lookupOriginal = dns.lookup;
dnsPromesas.lookup = (async (nombre: string) => [responder(nombre)]) as unknown as typeof dnsPromesas.lookup;
dns.lookup = ((nombre: string, opciones: unknown, listo?: (...args: unknown[]) => void) => {
  const cuando = typeof opciones === "function" ? (opciones as (...args: unknown[]) => void) : listo;
  const todas = typeof opciones === "object" && opciones !== null && (opciones as { all?: boolean }).all === true;
  if (nombre !== NOMBRE) return (lookupOriginal as (...args: unknown[]) => void)(nombre, opciones, listo);
  const { address, family } = responder(nombre);
  if (todas) cuando?.(null, [{ address, family }]);
  else cuando?.(null, address, family);
}) as typeof dns.lookup;
syncBuiltinESMExports(); // para que el «import { lookup }» de destinos.ts vea la función falsa

const { consultar } = (await import(pathToFileURL(join(resolve(carpeta), "cliente.ts")).href)) as {
  consultar: (url: string, limiteMs: number) => Promise<unknown>;
};

console.log(`$ consultar("http://${NOMBRE}:${PUERTO}/")   con el cliente de ${carpeta}`);
console.log(JSON.stringify(await consultar(`http://${NOMBRE}:${PUERTO}/`, 2000)));
console.log(`el DNS fue preguntado ${preguntas} ${preguntas === 1 ? "vez" : "veces"}`);

laboratorio.close();
otro.close();
process.exit(0);
```

Las partes que importan:

- **Dos servidores, dos direcciones.** El «laboratorio» escucha en `127.0.0.1:18081`, y «otro» en `[::1]:18081`. Es el mismo número de puerto en dos direcciones distintas, lo que es posible porque una dirección IPv4 y una IPv6 son lugares distintos.
- **`responder`.** Es el DNS que miente: cuenta cuántas veces lo llaman y contesta una dirección distinta según el número de pregunta.
- **Dos parches.** `dnsPromesas.lookup` lo usa `destinos.ts` para validar (la versión de promesas), y `dns.lookup` lo usa Node por dentro cuando una conexión le pide a un nombre su dirección (la versión de *callback*). Ese segundo parche tiene dos formas de contestar, porque `dns.lookup` puede pedirse con la opción `all` o sin ella (el manual de Node, en la página de `dns`: con `all` los argumentos del *callback* son `(err, addresses)`; sin ella, `(err, address, family)`).
- **`syncBuiltinESMExports()`.** Cuando importas `{ lookup }` de un módulo interno de Node, el nombre `lookup` queda fijo al valor que tenía en ese momento. Después de reemplazar la función hay que sincronizar los nombres exportados, o `destinos.ts` seguiría llamando a la original.
- **El `import()` dinámico al final** carga `cliente.ts` de la carpeta que se pasó como argumento. Primero se parchea, después se importa; al revés no funcionaría.

El programa recibe la carpeta del cliente que quiere probar. Para el primer experimento hace falta el cliente de la Lección 7, el que usa `fetch`. Está en `defectos/con-fetch/` (dos archivos: `cliente.ts` y `destinos.ts`, con aviso en la primera línea). Arma una carpeta con los archivos del `revisor` y reemplaza esos dos:

```text
$ cp -R fig08_01 con-fetch
$ cp defectos/con-fetch/cliente.ts defectos/con-fetch/destinos.ts con-fetch/
$ node fig08_04.ts con-fetch
$ node fig08_04.ts fig08_01
```

```text
$ node fig08_04.ts con-fetch
$ consultar("http://rebote.ejemplo:18081/")   con el cliente de con-fetch
  pregunta 1 al DNS: rebote.ejemplo -> 127.0.0.1
  pregunta 2 al DNS: rebote.ejemplo -> ::1
{"tipo":"respuesta","codigo":299,"ms":8,"reintentarEn":null}
el DNS fue preguntado 2 veces
(código de salida: 0)

$ node fig08_04.ts fig08_01
$ consultar("http://rebote.ejemplo:18081/")   con el cliente de fig08_01
  pregunta 1 al DNS: rebote.ejemplo -> 127.0.0.1
{"tipo":"respuesta","codigo":200,"ms":6,"reintentarEn":null}
el DNS fue preguntado 1 vez
(código de salida: 0)
```

El primer bloque es el ataque: el cliente de la Lección 7 preguntó **dos veces** al DNS. La primera (para validar) obtuvo `127.0.0.1`, que está en la lista de permitidos; la segunda (la que hizo `fetch` por dentro al conectarse) obtuvo `::1`, y el cliente llegó al servidor de `299` sin que ninguna regla de `destinos.ts` lo viera. El segundo bloque es la defensa: el cliente de esta lección preguntó **una sola vez**, se conectó a lo que le contestaron y llegó al laboratorio, con un `200`. La misma consulta, el mismo nombre, el mismo DNS que miente: dos clientes, dos destinos.

> **Es una simulación, y lo dice.** El DNS que miente es una función nuestra; el «otro servidor» es un servidor nuestro. Un atacante real, además, necesita una respuesta con vigencia (TTL) muy baja y que ninguna caché (del sistema operativo o del resolutor) repita la primera respuesta, cosa que la simulación se salta por construcción; y el parche de `dns.lookup` funciona porque `net.connect` consulta esa función al conectar, que es una suposición sobre cómo está hecho Node y no una garantía. Si tu sistema no tiene `::1`, cambia el segundo servidor a `127.0.0.2` (Linux lo admite como loopback). La prueba demuestra que el cliente de la Lección 7 **vuelve a preguntar** y que el de la Lección 8 **no**, que es lo que hace falta saber. No demuestra que un atacante real pueda explotar el `revisor`: eso depende de dónde corra, de qué red tenga a su alrededor y de la segunda capa que la Lección 1 pidió (una red que no deje llegar a los metadatos aunque el programa lo intente).

#### 8.12.3 La defensa: conectarse a la dirección ya validada

La defensa son tres cambios pequeños. El primero está en `destinos.ts`: `revisarDestino` ya no contesta solo «sí» o «no», contesta «sí, y estas son las direcciones que revisé»:

```ts
// Si se permite, trae las direcciones ya validadas: quien se conecte debe usar una de éstas.
export type Veredicto = { permitido: true; direcciones: string[] } | { permitido: false; motivo: string };
```

Y al final de la función, en lugar de `return { permitido: true };`, devuelve `return { permitido: true, direcciones };`. Quien se conecte tiene ahora a mano exactamente las direcciones que pasaron la revisión, y ninguna otra.

El segundo y el tercero están en `cliente.ts`. Primero, una función que **no resuelve nada**:

```ts
// Un lookup que no resuelve: devuelve siempre la dirección que destinos.ts ya validó. Node lo llama
// a veces con { all: true } (cuando prueba IPv4 e IPv6), y entonces espera una lista.
function soloA(direccion: string): LookupFunction {
  const family = isIP(direccion);
  return (_nombre, opciones, listo) => {
    if (opciones.all) listo(null, [{ address: direccion, family }]);
    else listo(null, direccion, family);
  };
}
```

`soloA` recibe una dirección y devuelve una función de búsqueda (*lookup*) que **siempre contesta esa dirección**, sin preguntarle a nadie. El tipo `LookupFunction` viene de `node:net`. La opción `lookup` de `http.request` y de `net.connect` existe para esto: según el manual de Node, su valor por omisión es `dns.lookup()`, y se puede reemplazar por cualquier función con la misma forma. Los dos caminos del `if` no son un adorno. Desde Node 20, `net.connect` tiene activada por omisión la opción `autoSelectFamily`, que prueba direcciones IPv4 e IPv6 en secuencia y, cuando está activa, le pasa a `lookup` la opción `all: true`; en ese caso la función espera una **lista** de direcciones, no una sola. Por eso `soloA` contesta de las dos maneras, según lo que le pidan.

Después, la función que hace la petición:

```ts
// GET a la URL, conectándose a la dirección indicada. El nombre sigue en la URL, así que Host y, en
// https, el SNI y la verificación del certificado siguen siendo los del nombre, no los de la IP.
// agent: false abre una conexión nueva y la cierra: ninguna conexión vieja se reutiliza.
function pedir(url: URL, direccion: string, senal: AbortSignal): Promise<IncomingMessage> {
  const pedirCon = url.protocol === "https:" ? pedirHttps : pedirHttp;
  return new Promise((listo, falla) => {
    const peticion = pedirCon(url, { lookup: soloA(direccion), signal: senal, agent: false }, listo);
    peticion.on("error", falla);
    peticion.end();
  });
}
```

Tres decisiones, en orden:

- **Se le pasa el objeto `URL`, no una dirección.** `pedirCon(url, opciones, …)` toma el nombre de la URL para la cabecera `Host` y, en `https`, para el **SNI** y la verificación del certificado, y toma de `lookup` **a dónde conectarse**. Por eso el servidor del laboratorio recibe `Host: rebote.ejemplo:18081` aunque la conexión haya ido a `127.0.0.1` (lo vas a comprobar en el ejercicio 4).
- **`agent: false`.** El manual de Node dice que con esta opción se usa un agente nuevo de un solo uso, y que sirve «to avoid connection reuse». Una conexión reutilizada de un agente compartido podría haberse abierto antes, a otra dirección; con `agent: false`, cada consulta abre la suya, a la dirección que acaba de validar.
- **`signal`.** Es el `AbortSignal` con el límite de tiempo. Aborta la petición completa, no solo la conexión: es lo que antes hacía `AbortSignal.timeout` con `fetch`.

Y el cuerpo de `consultar`, que cierra el círculo:

```ts
export async function consultar(url: string, limiteMs: number): Promise<Consulta> {
  // Antes de CADA conexión se vuelve a revisar el destino: el DNS pudo cambiar desde el alta.
  const veredicto = await revisarDestino(url);
  if (!veredicto.permitido) return { tipo: "destino-prohibido", motivo: veredicto.motivo };
  // Y la conexión va a una dirección que se acaba de validar. fetch volvería a resolver el nombre,
  // y entre esa resolución y la nuestra el nombre podría apuntar a otra parte (DNS rebinding).
  const tiempo = AbortSignal.timeout(limiteMs);
  const inicio = performance.now();
  try {
    const respuesta = await pedir(new URL(url), veredicto.direcciones[0], tiempo);
    respuesta.destroy(); // solo interesa el código y las cabeceras: el cuerpo no se lee
    return {
      tipo: "respuesta",
      codigo: respuesta.statusCode ?? 0,
      ms: Math.round(performance.now() - inicio),
      reintentarEn: segundosDeEspera(respuesta.headers["retry-after"] ?? null),
    };
  } catch (error) {
    if (tiempo.aborted) return { tipo: "tiempo-agotado" };
    const codigo = (error as { code?: string }).code;
    if (codigo === "ECONNREFUSED" || codigo === "ENOTFOUND") return { tipo: "sin-conexion" };
    return { tipo: "respuesta-invalida", motivo: error instanceof Error ? error.message : String(error) };
  }
}
```

La secuencia importa: **primero** se revisa el destino (`revisarDestino`, que resuelve una vez), **después** se arma el límite de tiempo, y **por último** se conecta a `veredicto.direcciones[0]`. No hay una tercera resolución. `respuesta.destroy()` corta la lectura después de las cabeceras: al `revisor` solo le interesan el código y las cabeceras, no el cuerpo. Y la clasificación de errores cambió de forma, no de fondo: antes miraba una excepción de `fetch` (`DOMException` con `TimeoutError`, o la `cause` con el `code`); ahora mira si la señal se abortó (`tiempo.aborted`) o el `code` de la excepción de Node. Los cinco desenlaces son los mismos.

#### 8.12.4 Lo que no cambió: el certificado, la redirección y los desenlaces

Tres preguntas razonables, con respuesta medida.

**¿Se sigue verificando el certificado contra el nombre?** Sí, y esta es la razón para pasar la `URL` y no la IP. Se comprobó contra un sitio público y dos de prueba de la comunidad de navegadores, uno con el certificado vencido y otro con un nombre que no coincide (necesita internet):

```text
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://example.com/
{"tipo":"respuesta","codigo":200,"ms":484,"reintentarEn":null}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://expired.badssl.com/
{"tipo":"respuesta-invalida","motivo":"certificate has expired"}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://wrong.host.badssl.com/
{"tipo":"respuesta-invalida","motivo":"Hostname/IP does not match certificate's altnames: Host: wrong.host.badssl.com. is not in the cert's altnames: DNS:*.badssl.com, DNS:badssl.com"}
```

El primero responde `200`. Los otros dos son `respuesta-invalida`, con el motivo que da Node: `certificate has expired` en uno, y en el otro que el nombre del servidor no está entre los del certificado. Lo que prueba esto es que el nombre **sigue** comparándose con el certificado: el cliente solo cambió a dónde se conecta el socket, no contra qué se verifica.

Para ver qué pasaría si en lugar de eso se sustituyera el nombre por la IP en la URL, `fig08_07.ts` hace exactamente eso (resuelve el nombre, arma `https://<IP>/` y pide la página):

```text
$ node fig08_07.ts example.com
{"nombre":"example.com","error":"EPROTO"}
$ node fig08_07.ts expired.badssl.com
{"nombre":"expired.badssl.com","error":"CERT_HAS_EXPIRED"}
$ node fig08_07.ts wrong.host.badssl.com
{"nombre":"wrong.host.badssl.com","error":"CERT_HAS_EXPIRED"}
```

Esa no es una alternativa: **ni siquiera el sitio bueno** funciona (`example.com` termina en `EPROTO`, un error del saludo TLS: sin el nombre, el servidor no sabe qué certificado mostrar), y los dos sitios malos tampoco dan `200` (ambos acaban en `CERT_HAS_EXPIRED`: la vigencia de un certificado se comprueba siempre, y sin el nombre el servidor ofrece el que tenga por omisión). Es decir, conectar «a la IP» no relaja la verificación, la rompe por otra parte y con otro mensaje. Por eso `consultar` pasa la `URL` con el nombre y cambia solo la dirección del socket: se conserva el nombre para la cabecera `Host`, para el SNI y para la verificación del certificado.

**¿Se siguen las redirecciones?** No. Una consulta a un destino que responde `301` devuelve `301`, no la respuesta del lugar al que apunta. `http.request` no sigue redirecciones por sí solo, y el `revisor` tampoco las sigue: la guía de OWASP las lista como una vía para saltarse la validación (una URL permitida que redirige a una prohibida), y la recomendación es desactivarlas. Antes se logró con `redirect: "manual"` en `fetch`; ahora con no seguirlas.

**¿Cambió algún desenlace?** No. Los cinco tipos de `Consulta` son los mismos, y los códigos que salen en la matriz son los mismos. Lo único que cambia es el texto interno del `motivo` en `respuesta-invalida`, que ninguna respuesta del servidor muestra.

#### 8.12.5 Lo que esta defensa no hace

Sería una mala costumbre cerrar una sección de seguridad diciendo «listo». Tres límites, a la vista.

- **Se conecta a una sola dirección.** `veredicto.direcciones[0]` es la primera de las que revisó el DNS. Si el nombre tiene varias y la primera no responde, el `revisor` no prueba la segunda: por lo que se lee en el código, un nombre cuya primera dirección rechaza la conexión se cuenta como `sin-conexion`, aunque la segunda funcione. Es el precio de fijar la dirección; una versión que probara las siguientes tendría que aplicar la misma revisión a cada una. La guía de OWASP lo pide así: aplicar la política de destino también a los reintentos y a las conexiones alternativas.
- **No sustituye a la red.** Un `revisor` expuesto a internet debería correr en una red que no tenga ruta hacia lo que no debe alcanzar. La Lección 1 lo dijo; sigue siendo cierto. Esta defensa reduce lo que depende de un archivo.
- **No cubre lo que no pasa por `consultar`.** Hoy el único lugar donde el `revisor` se conecta es `cliente.ts`. Si mañana alguien agrega otro (un aviso por correo, una descarga de un archivo), tiene que pasar por la misma puerta, y la matriz de la sección 8.6 **no lo sabe**: solo comprueba los destinos que le dices.

### 8.13 Versiones de la API en el documento

La Lección 3 mostró cómo se retira una versión sin sorprender a nadie: meses de avisos y, al final, un `410`. Faltaba un lugar donde esos avisos estuvieran escritos para las máquinas, y es el documento. Primero, lo que el servidor hace de verdad:

```text
$ curl -i http://127.0.0.1:18080/v1/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Deprecation: @1782864000
Sunset: Sun, 31 Jan 2027 00:00:00 GMT
Link: <https://revisor.example/docs/migrar-de-v1>; rel="deprecation"; type="text/html"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 22:36:23 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","direccion":"http://127.0.0.1:18081/codigo/200","limite":2}

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: application/problem+json
Content-Language: es
Content-Length: 231
Date: Wed, 21 Oct 2026 22:36:23 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/version-retirada","title":"Esa versión de la API se retiró","status":410,"detail":"la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios","instance":"/v0/servicios"}

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, DELETE
Content-Type: application/problem+json
Content-Language: es
Content-Length: 137
Date: Wed, 21 Oct 2026 22:36:23 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Method Not Allowed","status":405,"detail":"PATCH no se admite en /servicios/1","instance":"/servicios/1"}
```

Veamos lo que importa de las tres respuestas. `/v1/servicios/1` responde `200` con tres cabeceras: `Deprecation`, `Sunset` y `Link`. `/v0/servicios` responde `410`, con el tipo `version-retirada`. Y la ruta `PATCH` del último bloque ya la conoces de la sección 8.4.4.

#### 8.13.1 Qué dicen las tres cabeceras

`Deprecation` es el RFC 9745, publicado en marzo de 2025 en la vía de estándares (*Standards Track*). Su valor es una **fecha** en el formato de los campos estructurados de HTTP, un número de segundos desde 1970 precedido por una arroba: la sección 2.1 dice «Deprecation is an Item Structured Header Field; its value MUST be a Date». El valor que el `revisor` manda, `@1782864000`, es el 1 de julio de 2026 a las 00:00 en UTC. Quiere decir «esta versión se desaprobó en esa fecha», y la fecha puede estar en el pasado o en el futuro.

`Sunset` es el RFC 8594, de mayo de 2019, **informativo**. Su valor es una fecha HTTP común y corriente (`Sun, 31 Jan 2027 00:00:00 GMT`), y dice cuándo se espera que el recurso deje de responder. El propio RFC dice que quien lo recibe debe tomar las fechas como pistas (*hints*), no como garantías. La relación entre las dos viene en la sección 4 del RFC 9745: la fecha de `Sunset` no debe ser anterior a la de `Deprecation`, y la de la versión 1 del `revisor` (31 de enero de 2027) es siete meses posterior.

`Link` con `rel="deprecation"` apunta a la documentación humana de la desaprobación: la guía para migrar. El RFC 9745 registra esa relación y da un ejemplo con el mismo formato que usa el `revisor`.

#### 8.13.2 Cómo se dice eso en OpenAPI

El documento tiene tres lugares donde las versiones aparecen:

```json
    "/v1/servicios": {
      "get": {
        "summary": "Versión 1, desaprobada",
        "deprecated": true,
        "responses": {
          "200": {
            "description": "La lista en la forma de la v1.",
            "headers": {
              "Deprecation": {
                "$ref": "#/components/headers/Deprecation"
              },
              "Sunset": {
                "$ref": "#/components/headers/Sunset"
              },
              "Link": {
                "$ref": "#/components/headers/Link"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          }
        }
      }
    },
```

Es la operación `GET /v1/servicios`, y trae tres cosas:

- **`"deprecated": true`.** Es un campo de la operación. La especificación (sección 4.8.10.1) dice: «Declares this operation to be deprecated. Consumers SHOULD refrain from usage of the declared operation.» Es el aviso para máquinas: las herramientas de documentación suelen tachar la operación, y las que generan código pueden marcar la función como obsoleta.
- **Las tres cabeceras** (`Deprecation`, `Sunset` y `Link`) en la respuesta `200`, referenciadas desde `components/headers`, cada una con su descripción y el RFC que la define.
- **La retirada**, `/v0/servicios`, con `deprecated: true`, `"security": []` (no pide credencial, porque el `410` se responde antes de preguntar quién eres) y solo la respuesta `410`, la misma `E410` que usa el servicio retirado, porque el catálogo reutiliza el esquema `Problema` con el `type` propio `version-retirada`.

Y hay una tercera línea que cierra el círculo: en la `info` del documento, la descripción dice que `info.version` es la versión **del documento**, y que la API vigente vive en la raíz, con la v1 desaprobada y la v0 retirada. Sin esa frase, alguien que lea `"version": "1.0.0"` pensaría que `/v1` es la vigente.

Un detalle de diseño que vale la pena decir en voz alta: **las versiones viven en la ruta** (`/v1/…`, `/v0/…`), y la vigente no lleva prefijo. Hay otras maneras de versionar una API (por cabecera, por tipo de contenido) y OpenAPI las describe todas; la ruta es la más fácil de documentar, porque cada versión es una entrada de `paths` y cada una puede marcarse `deprecated` por separado.

### 8.14 Lo que la matriz no promete

Una verificación honesta dice qué no ve. Siete cosas, con su evidencia.

**1. No mira los casos que no escribió.** Es lo que enseñó el cruce de la sección 8.5: `GET /revisiones/{id}` devuelve un `type` que el documento no menciona, y la matriz estaba en verde porque su escenario del `404` pide un servicio, no una revisión. Cada ruta que no tiene su escenario es una ruta que la matriz no conoce.

**2. Mira que los miembros estén, no que su forma sea la correcta.** Comprueba `type`, `status` y `title` en todos los errores; no comprueba `detail` ni `instance`, salvo en el `500`. El ejercicio 2 lo mide: con un servidor al que le falta `instance` en todos sus errores, la matriz actual da **40 de 41**, y la única falla es la del `500`; la ampliación de dos líneas la pone en **25 de 41**.

**3. No compara los cuerpos con sus esquemas.** El esquema `Servicio` dice que un servicio tiene `id`, `nombre`, `url` y `limite_ms`; la matriz mira que el `id` sea 1 en una consulta y que el `nombre` sea `matriz` en un alta, no que los cuatro campos tengan el tipo que el esquema dice. Un servidor que devolviera `limite_ms` como texto pasaría. Para cerrar esto hace falta un validador de JSON Schema (ninguno en las dependencias del curso) y es la extensión natural de la matriz.

**4. No comprueba las cabeceras de los avisos de versión.** El documento promete `Deprecation`, `Sunset` y `Link` en `/v1`, y esa promesa se comprobó a mano en 8.13 y en la Lección 3; la matriz de 23 escenarios no tiene un escenario para `/v1`.

**5. Los escenarios comparten un servidor con estado.** El orden está escrito (sección 8.6.2), y un cambio que reordene los escenarios puede romperlos por razones que no son defectos de la API.

**6. El recuento de fugas es una lista de señales, no una prueba de ausencia.** Cubre pilas, rutas de archivos, SQL, credenciales y nombres de excepciones de JavaScript, y deja fuera todo lo que no se imaginó.

**7. Es una prueba, y las pruebas también fallan sin motivo.** Esta merece un lugar aparte, porque es lo que más desgasta la confianza en cualquier verificación automática. Durante esta lección una de las comprobaciones de la matriz falló a veces sin que hubiera ningún defecto, y la historia completa (cómo se encontró, cómo se midió y cómo se cerró) está en la sección siguiente.

#### 8.14.1 Una comprobación que falla a veces: así la encontramos, así la medimos y así la cerramos

**Cómo la encontramos.** Mientras se escribía esta lección, la matriz salió algunas veces con código `1` sin que nada estuviera roto. Eran corridas de trabajo, algunas contra copias con defectos a propósito, y no se guardó su recuento: por eso aquí no hay una cifra de cuántas veces fallaba, y todo lo que sigue es lo que se midió después, con programas y salidas que están en el repositorio. Una de las comprobaciones que falló fue la del cuerpo de más de 16 KiB (el renglón es de una de esas corridas de trabajo; no se guardó en un archivo):

```text
FALLA cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo: 20000 bytes por partes: error TypeError: fetch failed
```

Otra falla fue de otra familia: una petición a una pasarela que todavía no estaba escuchando (`pasarela sin revisor: 0 null`). Esa se retoma al final de esta sección.

**Cómo la medimos.** Una comprobación que falla de vez en cuando se mide mejor aislándola. `fig08_05.ts` repite 400 veces exactamente el cuerpo por partes que manda la matriz (20 pedazos de 1000 bytes, sin `Content-Length`) y cuenta qué pasó cada vez. Hace falta el `revisor` escuchando: `node servidor.ts` desde `fig08_01/`, en una terminal, y en otra. Esta es la corrida contra el `revisor` **como estaba antes de cerrar la carrera**, que es el contenido de `defectos/cierre-brusco/respuestas.ts` (se prueba copiando `fig08_01/` a otra carpeta y reemplazando ese archivo; la salida completa está en `defectos/cierre-brusco.salida.txt`):

```text
$ node fig08_05.ts   # contra el revisor con defectos/cierre-brusco/respuestas.ts
  382  respuesta 413
    4  sin respuesta: ECONNRESET
   14  sin respuesta: EPIPE
400 intentos

$ for i in 1 2 3 4 5; do printf "corrida $i:"; node fig08_05.ts | grep "respuesta 413"; done
corrida 1:  356  respuesta 413
corrida 2:  358  respuesta 413
corrida 3:  357  respuesta 413
corrida 4:  363  respuesta 413
corrida 5:  346  respuesta 413
```

De 400 intentos, el `revisor` respondió `413` en la mayoría; en los demás el cliente no recibió respuesta: `EPIPE` (la conexión se rompió mientras el cliente aún escribía) y algunas veces `ECONNRESET`. Con la primera corrida y sus cinco repeticiones, el `revisor` respondió entre 346 y 382 veces `413` de 400: entre 18 y 54 intentos sin respuesta, es decir, entre 4,5 y 13,5 de cada 100. La cifra cambia de una corrida a otra, y eso es parte de lo que la hacía difícil de ver: en la matriz, que hace *un* intento por corrida, se manifestaba como un fallo ocasional.

**La causa.** Es una carrera, y la describe el RFC 9112, sección 9.6. El `revisor` decide que el cuerpo es demasiado grande en cuanto cuenta más de 16 KiB, responde `413` con `Connection: close` y cierra. Pero el cliente seguía mandando pedazos. Cuando una conexión se cierra del todo y todavía llegan datos, el sistema operativo contesta con un *reset* (RST), y el reinicio puede borrar la respuesta que el cliente aún no había leído. El RFC lo dice así: si un servidor cierra de inmediato una conexión TCP, «hay un riesgo significativo de que el cliente no pueda leer la última respuesta HTTP» (traducción nuestra). Y describe lo que los servidores suelen hacer para evitarlo, que es **cerrar por etapas**: primero se cierra solo el lado de escritura (*half-close*), después se **sigue leyendo** hasta que el cliente cierre (o hasta tener razonable certeza de que el cliente recibió la última respuesta), y al final se cierra del todo. Fíjate en el orden: el RFC responde **primero** y sigue leyendo **después**.

**Cómo la cerramos, la primera vez.** Hay tres salidas posibles, y solo una es honesta con el servidor. **Reintentar la prueba** hasta que pase oculta un defecto que existe. **Aceptar los dos desenlaces** en la prueba (un `413` o un cierre) deja de depender de la carrera, pero le da por bueno a un servidor que pierde respuestas. **Arreglar el cierre en el servidor** corrige el problema donde está. El primer intento fue la versión más sencilla de escribir en Node: **leer y tirar lo que el cliente siga mandando, con un tope, y solo entonces responder**. Es el contenido de `defectos/drenar-antes/respuestas.ts` (la lección ya no lo usa, pero se conserva porque su límite se midió):

```ts
// Cuando el cuerpo ya pasó del tope, el cliente puede seguir mandando. Si el servidor responde el 413 y cierra
// en ese momento, el sistema operativo contesta con un RST a lo que todavía llega, y ese RST puede borrar el 413
// antes de que el cliente lo lea: el cliente ve EPIPE o ECONNRESET en vez de la respuesta. El RFC 9112, sección
// 9.6, aconseja un cierre gradual: seguir leyendo (y tirando) lo que llegue hasta que el cliente termine. El límite
// en bytes y en tiempo (no lo fija el RFC) es del curso, para que nadie retenga la conexión mandando sin parar.
const DRENAR_MAX_BYTES = 1024 * 1024;
const DRENAR_MAX_MS = 2000;
function drenar(peticion: IncomingMessage): Promise<void> {
  return new Promise((listo) => {
    if (peticion.readableEnded || peticion.destroyed) {
      listo();
      return;
    }
    let tirados = 0;
    const fin = (): void => {
      clearTimeout(reloj);
      peticion.off("data", alLlegar);
      peticion.off("end", fin);
      peticion.off("close", fin);
      peticion.off("error", fin);
      listo();
    };
    const alLlegar = (trozo: Buffer): void => {
      tirados += trozo.length;
      if (tirados > DRENAR_MAX_BYTES) fin();
    };
    const reloj = setTimeout(fin, DRENAR_MAX_MS);
    peticion.on("data", alLlegar);
    peticion.on("end", fin);
    peticion.on("close", fin);
    peticion.on("error", fin);
    peticion.resume();
  });
}
```

Léela con calma, porque cada línea tiene una razón:

- **El motivo está en el comentario**: seguir leyendo y tirando lo que llegue evita el RST. Pero ojo con el orden: esta versión lee **antes** de responder, y el RFC pide responder **primero**. Por eso el `413` tarda: sale cuando el cliente termina de mandar o cuando se pasan los topes.
- **`DRENAR_MAX_BYTES` (1 MiB) y `DRENAR_MAX_MS` (2 segundos)** son los topes. Sin ellos, el servidor leería para siempre un cuerpo que ya decidió rechazar, y regalaría la conexión a quien quiera retenerla mandando sin parar. Con los topes, lo peor que se paga es 1 MiB y 2 segundos por conexión.
- **`fin` es el único camino de salida**, y se llama desde cuatro lugares: que el cuerpo termine (`end`), que la conexión se cierre (`close`), que haya un error, o que se pasen los topes. Al salir quita todos los oyentes y apaga el reloj.
- **`peticion.resume()`** pone a la petición a leer. Los datos llegan al oyente `data`, que solo cuenta los bytes y los tira.

Con cuerpos como el de la matriz (20 KB) funcionó: 400 de 400. Pero tiene un límite que se midió, no se supuso. `fig08_05.ts` acepta un segundo argumento, el número de pedazos de 1000 bytes (por omisión 20), y se corrió contra esa copia con cuerpos de 1 MB, de 1,1 MB y de 3 MB, 100 intentos cada uno (`defectos/drenar-antes.salida.txt`):

```text
$ node fig08_05.ts 100 1000
  100  respuesta 413
100 intentos
$ node fig08_05.ts 100 1100
    8  respuesta 413
   19  sin respuesta: ECONNRESET
   73  sin respuesta: EPIPE
100 intentos
$ node fig08_05.ts 100 3000
   23  sin respuesta: ECONNRESET
   77  sin respuesta: EPIPE
100 intentos
```

Hasta 1 MB, los 100 intentos reciben su `413`. En cuanto el cuerpo pasa de 1 MiB (1 048 576 bytes) después del tope, el servidor deja de leer, responde y cierra, y el cliente, que sigue escribiendo, vuelve a recibir el RST: **la carrera reaparece** y con 3 MB ningún intento recibe respuesta. El primer arreglo no cerró la carrera: la movió más allá del tope. Un cliente que manda más de 1 MiB es, además, el que más probablemente se equivocó por mucho.

**Cómo la cerramos, la segunda vez: el cierre en etapas que pide el RFC.** Lo que hace falta es lo que el RFC describe: responder **de inmediato**, cerrar solo la escritura y seguir leyendo. Node no lo hace por sí solo: con `Connection: close`, al terminar de responder llama a `socket.destroySoon()`, que cierra y destruye el socket (se puede ver en `lib/_http_server.js`; el método está documentado en [`net`](https://nodejs.org/docs/latest-v24.x/api/net.html#socketdestroysoon)). Esta es la versión que trae la lección:

```ts
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
```

- **`socket.destroySoon = …`** cambia ese método **solo en esta conexión**, para que al terminar de responder haga únicamente `socket.end()`: cierra la escritura (*half-close*) y deja abierta la lectura.
- **`peticion.resume()`** sigue leyendo y tirando lo que el cliente mande. Ya no hay un tope de bytes: lo que se paga por una conexión así es, como máximo, **2 segundos** de lectura.
- **El reloj de 2 segundos** destruye la conexión aunque el cliente no cierre, para que nadie la retenga; `socket.once("close", …)` lo apaga si la conexión terminó antes.
- **El `413` sale de inmediato**, porque `leerCuerpo` llama a `cerrarConCalma` y rechaza enseguida, sin esperar nada.

Un límite que conviene decir: que `http` use `destroySoon` al cerrar es un detalle de cómo está hecho Node, no una promesa de su documentación. Si una versión posterior lo cambiara, `fig08_05.ts` lo vería (la medición de abajo bajaría de 400), y por eso la medición forma parte de la lección y no solo del texto.

**Cómo comprobamos que quedó cerrada.** El mismo `fig08_05.ts`, esta vez contra el `revisor` de `fig08_01/` tal como está en la lección (`fig08_05.salida.txt`), y después con los cuerpos grandes que rompieron el primer arreglo (`fig08_05.limite.salida.txt`):

```text
$ node fig08_05.ts
  400  respuesta 413
400 intentos

$ for i in 1 2 3 4 5; do printf "corrida $i:"; node fig08_05.ts | grep "respuesta 413"; done
corrida 1:  400  respuesta 413
corrida 2:  400  respuesta 413
corrida 3:  400  respuesta 413
corrida 4:  400  respuesta 413
corrida 5:  400  respuesta 413
```

```text
$ node fig08_05.ts 100 1000
  100  respuesta 413
100 intentos
$ node fig08_05.ts 100 3000
  100  respuesta 413
100 intentos
$ node fig08_05.ts 100 20000
  100  respuesta 413
100 intentos
```

Cuatrocientos de cuatrocientos en las seis corridas, contra entre 346 y 382 antes; y cien de cien con cuerpos de 1 MB, 3 MB y 20 MB, donde el primer arreglo daba cero de cien. Ese es el control: con el código viejo, la medición ve el defecto; con el nuevo, no. Lo que **no** se midió: qué pasa con un cliente lento que mande a cuentagotas durante más de 2 segundos (el servidor destruye la conexión; la respuesta ya salió al principio, y si el cliente la leyó antes del reset es cosa de su propio ritmo), ni cuánta carga acumulan muchas conexiones así a la vez.

**La otra familia: el arranque.** La otra falla, la de la pasarela, no tenía que ver con el cierre sino con el arranque. La matriz esperaba un tiempo fijo después de levantar cada proceso (un segundo el `revisor`, medio segundo la pasarela). Una espera fija es una apuesta sobre cuánto tarda el arranque, y esa duración no es constante. `fig08_06.ts` mide el margen: levanta la pasarela 100 veces y anota cuánto tarda en contestar; en las corridas guardadas (`ejercicios/ej6.salida.txt`) el máximo fue de 225 ms con la máquina libre y de 166 ms con 20 procesos girando, muy por debajo de los 500 ms de la espera. Es decir, casi siempre sobra margen, pero la espera fija solo es buena mientras el arranque sea más corto que ella, y eso es justo lo que no controlas. Para ver la falla a propósito, `ejercicios/ej6/arranque-lento.sh` hace una copia de una carpeta y retrasa 700 ms el arranque de `servidor.ts` y de `pasarela.ts`: con la matriz de esperas fijas (`defectos/espera-fija/matriz23.ts`) sale `40 de 41`, y la comprobación que falla es exactamente la que se vio, `pasarela sin revisor: 0 null`; con la matriz de la lección sale `41 de 41`.

El remedio es el que se había anunciado: esperar a que el puerto acepte conexiones en lugar de esperar un número de milisegundos. Es lo que hacen las dos funciones del principio de `matriz23.ts` (y de eso trata el ejercicio 6):

```ts
// Espera a que algo acepte conexiones en el puerto, hasta 10 s: en lugar de un tiempo fijo después de levantar un
// proceso, que con la máquina cargada se queda corto. Si el proceso que se levantó ya salió (por ejemplo, porque el
// puerto estaba ocupado), falla en seguida en vez de esperar a que conteste.
async function esperarPuerto(puerto: number, proceso?: ChildProcess): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (proceso !== undefined && proceso.exitCode !== null) throw new Error(`el proceso del puerto ${puerto} salió antes de escuchar`);
    if (await aceptaConexiones(puerto)) return;
    await esperar(100);
  }
  throw new Error(`el puerto ${puerto} no respondió en 10 s`);
}

// Levanta un programa del curso y espera a que escuche. Antes comprueba que el puerto esté libre: si ya lo ocupa
// un proceso viejo, esperarPuerto lo daría por bueno aunque el programa nuevo muriera con EADDRINUSE.
async function arrancar(archivo: string, puerto: number): Promise<ChildProcess> {
  if (await aceptaConexiones(puerto)) throw new Error(`puerto ${puerto} ocupado; apaga lo que lo usa`);
  const proceso = spawn(process.execPath, [archivo], { cwd: import.meta.dirname, stdio: "ignore" });
  await esperarPuerto(puerto, proceso);
  return proceso;
}
```

`esperarPuerto` pregunta cada 100 ms, hasta 10 segundos, y **lanza un error** si pasa el plazo o si el proceso que se levantó ya salió (por ejemplo, por un puerto ocupado); terminar en silencio dejaría a la matriz midiendo a nadie. `arrancar` comprueba **antes** que el puerto esté libre: sin eso, un `revisor` viejo que ya escucha haría que `esperarPuerto` diera por bueno un proceso nuevo que murió con `EADDRINUSE`. Con las dos, la matriz de la lección, corrida 30 veces seguidas con `fig08_08.sh` (`fig08_08.salida.txt`), salió con código `0` las 30 veces, en una máquina de uso normal. Eso no prueba que no pueda volver a fallar; prueba que el caso que se sabía fallar ya no falla, y que ahora, si un proceso no arranca, la matriz lo dice en lugar de medir otra cosa.

### 8.15 El `revisor` completo

Estos son todos los archivos de `fig08_01/`. Los que cambian o nacen en esta lección van primero; los demás son los de las lecciones anteriores en su versión vigente, y están aquí para que puedas armar la carpeta completa aunque no hayas hecho las lecciones anteriores. El nombre de la carpeta, `fig08_01`, aparece en la primera línea de cada archivo, igual que en las lecciones anteriores. El documento es el único que no la lleva, porque JSON no admite comentarios.

#### 8.15.1 Los archivos que cambian o nacen

```ts
// fig08_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
import { request as pedirHttp, type IncomingMessage } from "node:http";
import { request as pedirHttps } from "node:https";
import { isIP, type LookupFunction } from "node:net";
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

// Un lookup que no resuelve: devuelve siempre la dirección que destinos.ts ya validó. Node lo llama
// a veces con { all: true } (cuando prueba IPv4 e IPv6), y entonces espera una lista.
function soloA(direccion: string): LookupFunction {
  const family = isIP(direccion);
  return (_nombre, opciones, listo) => {
    if (opciones.all) listo(null, [{ address: direccion, family }]);
    else listo(null, direccion, family);
  };
}

// GET a la URL, conectándose a la dirección indicada. El nombre sigue en la URL, así que Host y, en
// https, el SNI y la verificación del certificado siguen siendo los del nombre, no los de la IP.
// agent: false abre una conexión nueva y la cierra: ninguna conexión vieja se reutiliza.
function pedir(url: URL, direccion: string, senal: AbortSignal): Promise<IncomingMessage> {
  const pedirCon = url.protocol === "https:" ? pedirHttps : pedirHttp;
  return new Promise((listo, falla) => {
    const peticion = pedirCon(url, { lookup: soloA(direccion), signal: senal, agent: false }, listo);
    peticion.on("error", falla);
    peticion.end();
  });
}

export async function consultar(url: string, limiteMs: number): Promise<Consulta> {
  // Antes de CADA conexión se vuelve a revisar el destino: el DNS pudo cambiar desde el alta.
  const veredicto = await revisarDestino(url);
  if (!veredicto.permitido) return { tipo: "destino-prohibido", motivo: veredicto.motivo };
  // Y la conexión va a una dirección que se acaba de validar. fetch volvería a resolver el nombre,
  // y entre esa resolución y la nuestra el nombre podría apuntar a otra parte (DNS rebinding).
  const tiempo = AbortSignal.timeout(limiteMs);
  const inicio = performance.now();
  try {
    const respuesta = await pedir(new URL(url), veredicto.direcciones[0], tiempo);
    respuesta.destroy(); // solo interesa el código y las cabeceras: el cuerpo no se lee
    return {
      tipo: "respuesta",
      codigo: respuesta.statusCode ?? 0,
      ms: Math.round(performance.now() - inicio),
      reintentarEn: segundosDeEspera(respuesta.headers["retry-after"] ?? null),
    };
  } catch (error) {
    if (tiempo.aborted) return { tipo: "tiempo-agotado" };
    const codigo = (error as { code?: string }).code;
    if (codigo === "ECONNREFUSED" || codigo === "ENOTFOUND") return { tipo: "sin-conexion" };
    return { tipo: "respuesta-invalida", motivo: error instanceof Error ? error.message : String(error) };
  }
}

export function clasificar(consulta: Consulta, limiteMs: number): Resultado {
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

export async function revisar(url: string, limiteMs: number): Promise<Resultado> {
  return clasificar(await consultar(url, limiteMs), limiteMs);
}

// ---------- Reintentos (lección 6) ----------

// Retroceso exponencial con jitter completo: espera un tiempo al azar entre 0 y base × 2^intento,
// sin pasar del tope. El azar evita que mil clientes reintenten en el mismo instante.
export function esperaConJitter(intento: number, baseMs: number, topeMs: number): number {
  return Math.round(Math.random() * Math.min(topeMs, baseMs * 2 ** intento));
}

const INTENTOS = 3;
const BASE_MS = 250;
const TOPE_MS = 2000;
// Si el servicio pide esperar más que esto, no se insiste: se informa lo que dijo.
const TOPE_RETRY_AFTER_S = 5;

// Solo se reintenta lo que puede mejorar solo: sin respuesta, 429, 502, 503 y 504.
// Revisar es un GET, seguro e idempotente: repetirlo no cambia nada del otro lado.
function vale(consulta: Consulta): boolean {
  if (consulta.tipo === "destino-prohibido") return false;
  return consulta.tipo !== "respuesta" || [429, 502, 503, 504].includes(consulta.codigo);
}

export async function revisarConReintentos(url: string, limiteMs: number): Promise<Resultado> {
  let consulta = await consultar(url, limiteMs);
  for (let intento = 1; intento < INTENTOS && vale(consulta); intento++) {
    const pedida = consulta.tipo === "respuesta" ? consulta.reintentarEn : null;
    if (pedida !== null && pedida > TOPE_RETRY_AFTER_S) break;
    const espera = pedida !== null ? pedida * 1000 : esperaConJitter(intento, BASE_MS, TOPE_MS);
    await new Promise((listo) => setTimeout(listo, espera));
    consulta = await consultar(url, limiteMs);
  }
  return clasificar(consulta, limiteMs);
}
```

```ts
// fig08_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// DNS rebinding: validar y luego dejar que fetch resuelva el nombre otra vez abre una ventana; entre
// las dos resoluciones el nombre puede pasar a apuntar a 127.0.0.1. Por eso revisarDestino devuelve
// las direcciones que validó, y cliente.ts se conecta a una de ellas sin volver a resolver.
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
IPV6_PROHIBIDAS.addSubnet("5f00::", 16, "ipv6"); // segment routing (SRv6). Ya queda fuera de 2000::/3, así que la lista blanca lo rechaza; se deja a la vista por si algún día se ensancha la lista blanca.

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

// Si se permite, trae las direcciones ya validadas: quien se conecte debe usar una de éstas.
export type Veredicto = { permitido: true; direcciones: string[] } | { permitido: false; motivo: string };

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
  return { permitido: true, direcciones };
}
```

```ts
// fig08_01/respuestas.ts — las respuestas de éxito del revisor y la lectura del cuerpo. Los errores, en problemas.ts.
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

```ts
// fig08_01/matriz23.ts — la API verificable: los 23 códigos del curso, uno por escenario, con un solo comando.
// Levanta el laboratorio y el revisor, comprueba en cada respuesta el código, las cabeceras obligatorias,
// el tipo de contenido y el cuerpo, revisa que cada respuesta esté documentada en openapi.json,
// y apaga todo. Sale con 0 si todo pasó y con 1 si algo falló.
// Uso: node matriz23.ts
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { connect } from "node:net";
import { setTimeout as esperar } from "node:timers/promises";

// Espera a que algo acepte conexiones en el puerto, hasta 10 s: en lugar de un tiempo fijo después de levantar un
// proceso, que con la máquina cargada se queda corto. Si el proceso que se levantó ya salió (por ejemplo, porque el
// puerto estaba ocupado), falla en seguida en vez de esperar a que conteste.
async function esperarPuerto(puerto: number, proceso?: ChildProcess): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (proceso !== undefined && proceso.exitCode !== null) throw new Error(`el proceso del puerto ${puerto} salió antes de escuchar`);
    if (await aceptaConexiones(puerto)) return;
    await esperar(100);
  }
  throw new Error(`el puerto ${puerto} no respondió en 10 s`);
}

// Levanta un programa del curso y espera a que escuche. Antes comprueba que el puerto esté libre: si ya lo ocupa
// un proceso viejo, esperarPuerto lo daría por bueno aunque el programa nuevo muriera con EADDRINUSE.
async function arrancar(archivo: string, puerto: number): Promise<ChildProcess> {
  if (await aceptaConexiones(puerto)) throw new Error(`puerto ${puerto} ocupado; apaga lo que lo usa`);
  const proceso = spawn(process.execPath, [archivo], { cwd: import.meta.dirname, stdio: "ignore" });
  await esperarPuerto(puerto, proceso);
  return proceso;
}

// ¿Hay algo que acepte conexiones TCP en el puerto?
function aceptaConexiones(puerto: number): Promise<boolean> {
  return new Promise((listo) => {
    const conexion = connect(puerto, "127.0.0.1");
    conexion.once("connect", () => { conexion.destroy(); listo(true); });
    conexion.once("error", () => listo(false));
  });
}

const R = "http://127.0.0.1:18080";
const LAB = "http://127.0.0.1:18081";
const PROBLEMA = "https://revisor.example/problemas/";
const LEE = { Authorization: "Bearer lectura-a" };
const ESCRIBE = { Authorization: "Bearer escritura-a" };
const JSON_ = { "Content-Type": "application/json" };

type Peticion = { metodo: string; ruta: string; cabeceras?: Record<string, string>; cuerpo?: string };
type Escenario = {
  codigo: number;
  nombre: string;
  operacion: [string, string]; // método y ruta tal como los documenta openapi.json
  antes?: Peticion[];
  peticion: Peticion;
  cabeceras: string[];
  tipo: "application/json" | "application/problem+json" | null; // null: sin cuerpo
  type?: string;
  revisarCuerpo?: (cuerpo: Record<string, unknown>) => string | null;
};

// La ETag cambia en cada arranque del revisor (almacen.ts): el 304 se pide con la que se lee al empezar.
const SIN_CAMBIOS: Record<string, string> = { ...LEE };

const alta = (nombre: string): string => JSON.stringify({ nombre, url: `${LAB}/codigo/200` });

const ESCENARIOS: Escenario[] = [
  { codigo: 200, nombre: "consultar un servicio", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/1", cabeceras: LEE }, cabeceras: ["etag"], tipo: "application/json",
    revisarCuerpo: (c) => (c.id === 1 ? null : "el id no es 1") },
  { codigo: 304, nombre: "consultar sin cambios", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/1", cabeceras: SIN_CAMBIOS }, cabeceras: ["etag"], tipo: null },
  { codigo: 201, nombre: "dar de alta", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("matriz") },
    cabeceras: ["location", "etag"], tipo: "application/json", revisarCuerpo: (c) => (c.nombre === "matriz" ? null : "no es matriz") },
  { codigo: 202, nombre: "pedir revisión", operacion: ["post", "/servicios/{id}/revisiones"],
    peticion: { metodo: "POST", ruta: "/servicios/1/revisiones", cabeceras: ESCRIBE }, cabeceras: ["location"], tipo: "application/json",
    revisarCuerpo: (c) => (c.estado === "pendiente" ? null : "no está pendiente") },
  { codigo: 204, nombre: "retirar", operacion: ["delete", "/servicios/{id}"],
    peticion: { metodo: "DELETE", ruta: "/servicios/7", cabeceras: ESCRIBE }, cabeceras: [], tipo: null },
  { codigo: 301, nombre: "ruta vieja con 301", operacion: ["post", "/viejo/servicios"],
    peticion: { metodo: "POST", ruta: "/viejo/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("viejo") }, cabeceras: ["location"], tipo: null },
  { codigo: 308, nombre: "ruta vieja con 308", operacion: ["post", "/api/servicios"],
    peticion: { metodo: "POST", ruta: "/api/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("api") }, cabeceras: ["location"], tipo: null },
  { codigo: 400, nombre: "cuerpo ilegible", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: '{"nombre":' },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "cuerpo-ilegible" },
  { codigo: 401, nombre: "sin credencial", operacion: ["get", "/servicios"],
    peticion: { metodo: "GET", ruta: "/servicios" }, cabeceras: ["www-authenticate"], tipo: "application/problem+json", type: PROBLEMA + "credencial-invalida" },
  { codigo: 403, nombre: "lectura que intenta escribir", operacion: ["delete", "/servicios/{id}"],
    peticion: { metodo: "DELETE", ruta: "/servicios/1", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "permiso-insuficiente",
    // La credencial es un secreto: el cuerpo no la repite (quedaría en cualquier bitácora que lo guarde).
    revisarCuerpo: (c) => (JSON.stringify(c).includes("lectura-a") ? "el cuerpo repite la credencial" : null) },
  { codigo: 404, nombre: "servicio que no existe", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/99", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "servicio-inexistente" },
  // OpenAPI no describe un método que no existe: el 405 se documenta en las operaciones que sí existen.
  { codigo: 405, nombre: "método no admitido", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "PATCH", ruta: "/servicios/1", cabeceras: ESCRIBE }, cabeceras: ["allow"], tipo: "application/problem+json", type: "about:blank" },
  { codigo: 409, nombre: "nombre repetido", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("pagos") },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "nombre-repetido",
    revisarCuerpo: (c) => (c.existente === "/servicios/2" ? null : "falta la extensión existente") },
  { codigo: 410, nombre: "servicio retirado", operacion: ["get", "/servicios/{id}"],
    peticion: { metodo: "GET", ruta: "/servicios/7", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "servicio-retirado" },
  { codigo: 412, nombre: "etiqueta vencida", operacion: ["put", "/servicios/{id}"],
    peticion: { metodo: "PUT", ruta: "/servicios/1", cabeceras: { ...ESCRIBE, ...JSON_, "If-Match": '"1-0"' }, cuerpo: alta("catalogo") },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "etiqueta-vencida" },
  { codigo: 415, nombre: "formato no admitido", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, "Content-Type": "text/plain" }, cuerpo: "matriz" },
    cabeceras: ["accept"], tipo: "application/problem+json", type: "about:blank" },
  { codigo: 422, nombre: "datos imposibles", operacion: ["post", "/servicios"],
    peticion: { metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: '{"nombre":"","url":"ftp://x"}' },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "datos-invalidos",
    revisarCuerpo: (c) => (Array.isArray(c.errors) && c.errors.length === 2 ? null : "errors no trae las 2 fallas") },
  { codigo: 428, nombre: "cambio sin If-Match", operacion: ["put", "/servicios/{id}"],
    peticion: { metodo: "PUT", ruta: "/servicios/1", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: alta("catalogo") },
    cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "falta-condicion" },
  { codigo: 429, nombre: "demasiadas revisiones", operacion: ["post", "/servicios/{id}/revisiones"],
    antes: [1, 2, 3].map(() => ({ metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE })),
    peticion: { metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE },
    cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "demasiadas-revisiones" },
  { codigo: 500, nombre: "el defecto a propósito", operacion: ["get", "/servicios/{id}/informe"],
    peticion: { metodo: "GET", ruta: "/servicios/4/informe", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "error-interno",
    revisarCuerpo: (c) => (typeof c.instance === "string" && c.instance.startsWith("urn:uuid:") ? null : "instance no es urn:uuid") },
  { codigo: 502, nombre: "el servicio responde basura", operacion: ["get", "/servicios/{id}/salud"],
    peticion: { metodo: "GET", ruta: "/servicios/6/salud", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "respuesta-invalida" },
  { codigo: 503, nombre: "mantenimiento", operacion: ["get", "/servicios"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":true}' }],
    peticion: { metodo: "GET", ruta: "/servicios", cabeceras: LEE }, cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "en-mantenimiento" },
  { codigo: 504, nombre: "el servicio no responde a tiempo", operacion: ["get", "/servicios/{id}/salud"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":false}' }],
    peticion: { metodo: "GET", ruta: "/servicios/5/salud", cabeceras: LEE }, cabeceras: [], tipo: "application/problem+json", type: PROBLEMA + "servicio-lento" },
];

// Lo que jamás debe salir en el cuerpo de un 5xx: pilas, rutas de archivos, SQL, secretos.
const FUGAS = [/\bat \S+ \(/, /file:\/\//, /\/(home|Users)\//, /node:internal/, /\bSELECT\b.+\bFROM\b/i, /Bearer \S+/, /TypeError|ReferenceError/];

function enviar(p: Peticion): Promise<Response> {
  return fetch(R + p.ruta, { method: p.metodo, headers: p.cabeceras, body: p.cuerpo, redirect: "manual" });
}

const documento = JSON.parse(readFileSync(new URL("./openapi.json", import.meta.url), "utf8")) as {
  paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
};

async function comprobar(e: Escenario): Promise<string[]> {
  const fallas: string[] = [];
  for (const previa of e.antes ?? []) await (await enviar(previa)).text();
  const respuesta = await enviar(e.peticion);
  const texto = await respuesta.text();
  if (respuesta.status !== e.codigo) fallas.push(`código ${respuesta.status}, se esperaba ${e.codigo}`);
  for (const cabecera of e.cabeceras) if (!respuesta.headers.has(cabecera)) fallas.push(`falta ${cabecera}`);
  const tipo = respuesta.headers.get("content-type");
  if (e.tipo === null) {
    if (texto !== "") fallas.push("trae cuerpo y no debía");
  } else if (tipo !== e.tipo) {
    fallas.push(`tipo ${tipo}, se esperaba ${e.tipo}`);
  } else {
    const cuerpo = JSON.parse(texto) as Record<string, unknown>;
    if (e.tipo === "application/problem+json") {
      if (cuerpo.type !== e.type) fallas.push(`type ${String(cuerpo.type)}, se esperaba ${e.type}`);
      if (cuerpo.status !== e.codigo) fallas.push("status del cuerpo distinto del código");
      if (typeof cuerpo.title !== "string") fallas.push("falta title");
    }
    const otra = e.revisarCuerpo?.(cuerpo) ?? null;
    if (otra !== null) fallas.push(otra);
  }
  if (e.codigo >= 500) for (const fuga of FUGAS) if (fuga.test(texto)) fallas.push(`el cuerpo filtra ${fuga}`);
  const [metodo, ruta] = e.operacion;
  if (documento.paths[ruta]?.[metodo]?.responses?.[String(e.codigo)] === undefined) {
    fallas.push(`openapi.json no documenta ${e.codigo} en ${metodo.toUpperCase()} ${ruta}`);
  }
  return fallas;
}

// Comprobaciones que el README pide además de los 23: idempotencia, SSRF y una credencial que solo
// existe en Object.prototype (regresión: con las credenciales en un objeto literal, pasaba con 200).
// Y cinco regresiones de la RFC: If-None-Match con lista, W/ y «*» (comparación débil); If-Match
// fuerte; el esquema «bearer» en minúsculas; el reto sin error con otro esquema; y un método con
// nombre de Object.prototype, que se prueba llamando a rutas.ts sin servidor (Node lo corta antes).
async function adicionales(): Promise<[string, string[]][]> {
  const resultados: [string, string[]][] = [];
  const llave = { ...ESCRIBE, ...JSON_, "Idempotency-Key": "matriz-1" };
  const a = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: llave, cuerpo: alta("idempotente") });
  const b = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: llave, cuerpo: alta("idempotente") });
  const c = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: llave, cuerpo: alta("otra-cosa") });
  const fallasLlave: string[] = [];
  if (a.status !== 201 || b.status !== 201) fallasLlave.push(`${a.status} y ${b.status}, se esperaba 201 y 201`);
  if (a.headers.get("location") !== b.headers.get("location")) fallasLlave.push("la repetición creó otro servicio");
  if (c.status !== 422) fallasLlave.push(`la misma llave con otro cuerpo dio ${c.status}, se esperaba 422`);
  resultados.push(["misma Idempotency-Key: no duplica; con otro cuerpo, 422", fallasLlave]);
  for (const url of ["http://169.254.169.254/latest/meta-data/", "http://localhost:18080/mantenimiento"]) {
    const r = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: JSON.stringify({ nombre: "ssrf", url }) });
    const cuerpo = (await r.json()) as { type?: string };
    const fallas = r.status === 422 && cuerpo.type === PROBLEMA + "destino-prohibido" ? [] : [`${r.status} ${cuerpo.type}`];
    resultados.push([`SSRF: ${url} se rechaza con 422 destino-prohibido`, fallas]);
  }
  const fallasPrototipo: string[] = [];
  for (const token of ["constructor", "__proto__", "toString"]) {
    const r = await enviar({ metodo: "GET", ruta: "/servicios", cabeceras: { Authorization: `Bearer ${token}` } });
    const cuerpo = (await r.json()) as { type?: string };
    if (r.status !== 401 || cuerpo.type !== PROBLEMA + "credencial-invalida") fallasPrototipo.push(`Bearer ${token}: ${r.status}`);
  }
  resultados.push(["credencial heredada de Object.prototype (constructor, __proto__, toString): 401", fallasPrototipo]);
  resultados.push(await condicionales());
  resultados.push(await actualizacionPerdida());
  resultados.push(await ordenDelPut());
  resultados.push(await esquemas());
  resultados.push(await metodoHeredado());
  resultados.push(await cuerpoNoObjeto());
  resultados.push(await cuerpoGrande());
  resultados.push(await consultasEnVivo());
  resultados.push(await esperaRetryAfter());
  resultados.push(await rangosSsrf());
  resultados.push(await sinRevisorNiPasarela());
  resultados.push(await altaSeguraDecide());
  resultados.push(await banco205());
  resultados.push(await etiquetaTrasReinicio());
  return resultados;
}

// Un cuerpo JSON que no es un objeto: 400 cuerpo-ilegible, y el revisor sigue respondiendo después.
async function cuerpoNoObjeto(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  for (const cuerpo of ["null", "7", '"texto"', "[]"]) {
    const r = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo });
    const problema = (await r.json()) as { type?: string };
    if (r.status !== 400 || problema.type !== PROBLEMA + "cuerpo-ilegible") fallas.push(`${cuerpo}: ${r.status} ${problema.type}`);
  }
  const vivo = await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE }).then((r) => r.status, () => 0);
  if (vivo !== 200) fallas.push(`después, GET /servicios/1 dio ${vivo}`);
  return ["cuerpo JSON que no es objeto (null, 7, \"texto\", []): 400, y el revisor sigue vivo", fallas];
}

// El tope del cuerpo (16 KiB): con Content-Length y por partes, 413 about:blank; justo en el tope, 400;
// y el revisor sigue vivo después.
async function cuerpoGrande(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const grande = "a".repeat(20000);
  const conLargo = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: grande });
  const problema = (await conLargo.json()) as { type?: string; status?: number };
  if (conLargo.status !== 413 || problema.type !== "about:blank" || problema.status !== 413) {
    fallas.push(`20000 bytes con Content-Length: ${conLargo.status} ${problema.type}`);
  }
  if (conLargo.headers.get("connection") !== "close") fallas.push("el 413 no cierra la conexión");
  const porPartes = new ReadableStream<Uint8Array>({
    start(control) {
      for (let i = 0; i < 20; i++) control.enqueue(new TextEncoder().encode("a".repeat(1000)));
      control.close();
    },
  });
  const sinLargo = await fetch(R + "/servicios", { method: "POST", headers: { ...ESCRIBE, ...JSON_ }, body: porPartes, duplex: "half" } as RequestInit)
    .then(async (r) => { await r.text(); return r.status; }, (error: unknown) => `error ${String(error)}`);
  if (sinLargo !== 413) fallas.push(`20000 bytes por partes: ${sinLargo}`);
  const enElTope = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: "a".repeat(16384) });
  await enElTope.text();
  if (enElTope.status !== 400) fallas.push(`16384 bytes: ${enElTope.status}, se esperaba 400`);
  const vivo = await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE }).then((r) => r.status, () => 0);
  if (vivo !== 200) fallas.push(`después, GET /servicios/1 dio ${vivo}`);
  return ["cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo", fallas];
}

// /salud sale a la red como una revisión: 3 por credencial cada minuto; la cuarta, 429 demasiadas-consultas.
// Usa admin, que ningún escenario usa para /salud; después, escritura-a no paga lo que gastó admin.
// Y el límite se consulta antes de buscar el servicio: quien enumera ids con escritura-b llega al 429.
async function consultasEnVivo(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const codigos: number[] = [];
  let ultima: Response | undefined;
  for (let i = 0; i < 4; i++) {
    ultima = await enviar({ metodo: "GET", ruta: "/servicios/1/salud", cabeceras: { Authorization: "Bearer admin" } });
    codigos.push(ultima.status);
    if (i < 3) await ultima.text();
  }
  const problema = ultima === undefined ? {} : ((await ultima.json()) as { type?: string });
  if (codigos.join(" ") !== "200 200 200 429") fallas.push(`códigos ${codigos.join(" ")}, se esperaba 200 200 200 429`);
  if (problema.type !== PROBLEMA + "demasiadas-consultas") fallas.push(`type ${problema.type}`);
  if (ultima?.headers.get("retry-after") === null) fallas.push("el 429 no trae Retry-After");
  const otra = await enviar({ metodo: "GET", ruta: "/servicios/1/salud", cabeceras: ESCRIBE });
  await otra.text();
  if (otra.status !== 200) fallas.push(`escritura-a dio ${otra.status} después del 429 de admin, se esperaba 200`);
  const enumeracion: number[] = [];
  // Ids del 11 al 20: no existen y nadie más los pidió, así que solo un límite por credencial los frena.
  for (let id = 11; id <= 20; id++) {
    const r = await enviar({ metodo: "POST", ruta: `/servicios/${id}/revisiones`, cabeceras: { Authorization: "Bearer escritura-b" } });
    await r.text();
    enumeracion.push(r.status);
  }
  if (!enumeracion.includes(429)) fallas.push(`enumerar los ids 11 a 20 con escritura-b dio ${enumeracion.join(" ")}, sin ningún 429`);
  return ["429 por credencial: la cuarta consulta en vivo, 429; otra credencial no lo paga; enumerar ids llega al 429", fallas];
}

// Retry-After estricto (RFC 9110, sección 10.2.3): segundos o HTTP-date en GMT; lo demás se ignora.
async function esperaRetryAfter(): Promise<[string, string[]]> {
  const { segundosDeEspera } = await import("./cliente.ts");
  const fallas: string[] = [];
  for (const valor of ["1.5", "-1", "12 30", "2100-01-01T00:00:00Z"]) {
    const s = segundosDeEspera(valor);
    if (s !== null) fallas.push(`${JSON.stringify(valor)} dio ${s}, se esperaba ignorarlo`);
  }
  if (segundosDeEspera("120") !== 120) fallas.push("120 no dio 120");
  // En una zona que no es GMT, para que una fecha leída como hora local se note (UTC−6: 21600 s de más).
  const zona = process.env.TZ;
  process.env.TZ = "America/Mexico_City";
  const imf = segundosDeEspera("Wed, 01 Jan 2070 00:00:00 GMT");
  const formas = [segundosDeEspera("Wednesday, 01-Jan-70 00:00:00 GMT"), segundosDeEspera("Wed Jan  1 00:00:00 2070")];
  if (zona === undefined) delete process.env.TZ;
  else process.env.TZ = zona;
  if (imf === null || formas.some((s) => s === null || Math.abs(s - imf) > 1)) {
    fallas.push(`la misma fecha en sus tres formas dio ${imf}, ${formas.join(", ")}`);
  }
  return ["Retry-After: 1.5, -1 y «12 30» se ignoran; las tres formas de HTTP-date dan lo mismo (GMT)", fallas];
}

// Rangos que faltaban: CGNAT, NAT64 con una IPv4 de enlace local adentro, multicast IPv4 e IPv6.
async function rangosSsrf(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const urls = [
    "http://100.100.100.200/latest/meta-data/", "http://[64:ff9b::a9fe:a9fe]/", "http://224.0.0.1/", "http://[ff02::1]/",
    "http://[2002:a9fe:a9fe::]/", "http://[::7f00:1]/", "http://[64:ff9b:1::a9fe:a9fe]/", "http://240.0.0.1/",
    "http://198.18.0.1/", "http://192.0.2.1/", "http://[2001:db8::1]/", "http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/",
  ];
  for (const [i, url] of urls.entries()) {
    const nombre = `rango-${i + 1}`; // un nombre por URL: si una pasa, la siguiente no choca con un 409
    const r = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ }, cuerpo: JSON.stringify({ nombre, url }) });
    const problema = (await r.json()) as { type?: string };
    if (r.status !== 422 || problema.type !== PROBLEMA + "destino-prohibido") fallas.push(`${url}: ${r.status}`);
  }
  // Y la otra dirección: 6to4 con una IPv4 pública adentro (8.8.8.8) sí se acepta. Sin esto, una lista que
  // rechazara todo pasaría la comprobación.
  const publica = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ },
    cuerpo: JSON.stringify({ nombre: "rango-publico", url: "http://[2002:808:808::1]/" }) });
  await publica.text();
  if (publica.status !== 201) fallas.push(`http://[2002:808:808::1]/: ${publica.status}, se esperaba 201`);
  return ["SSRF: 12 direcciones de uso especial (CGNAT, NAT64, 6to4, compatible, 64:ff9b:1::/48, 240/4, 198.18/15, TEST-NET, 2001:db8::, Teredo, multicast): 422; 6to4 con IPv4 pública: 201", fallas];
}

// Corre un programa del curso y devuelve su salida completa y su código de salida.
function correr(archivo: string, argumentos: string[], topeMs = 120000): Promise<{ salida: string; codigo: number | null }> {
  return new Promise((listo) => {
    const hijo = spawn(process.execPath, [archivo, ...argumentos], { cwd: import.meta.dirname });
    // Un programa que se queda esperando para siempre no cuelga la matriz: se corta y su código queda en null.
    const corte = setTimeout(() => hijo.kill(), topeMs);
    hijo.on("close", () => clearTimeout(corte));
    let salida = "";
    hijo.stdout.on("data", (trozo: Buffer) => { salida += trozo.toString(); });
    hijo.stderr.on("data", (trozo: Buffer) => { salida += trozo.toString(); });
    hijo.on("close", (codigo) => listo({ salida, codigo }));
  });
}

// La pasarela y alta-segura.ts cuando no hay quien responda (lección 6). Apaga el revisor que levantó
// esta matriz, prueba, y lo vuelve a levantar.
async function sinRevisorNiPasarela(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  // 0. Con el revisor vivo, la pasarela reenvía Content-Length (y los mismos bytes) en una respuesta que no pierde.
  const primera = await arrancar("pasarela.ts", 18082);
  const ok = await fetch("http://127.0.0.1:18082/servicios", { method: "POST", headers: { ...ESCRIBE, ...JSON_ }, body: alta("con-largo") });
  const cuerpoOk = await ok.text();
  if (ok.status !== 201 || ok.headers.get("content-length") !== String(Buffer.byteLength(cuerpoOk))) {
    fallas.push(`pasarela con revisor: ${ok.status}, Content-Length ${ok.headers.get("content-length")} de ${Buffer.byteLength(cuerpoOk)} bytes`);
  }
  const apagadaPrimera = new Promise((listo) => primera.once("exit", listo));
  primera.kill();
  await apagadaPrimera;
  const viejo = procesos[1];
  const salida = new Promise((listo) => viejo.once("exit", listo));
  viejo.kill();
  await salida;
  const pasarela = await arrancar("pasarela.ts", 18082);
  // 1. La pasarela no se cae: 502 Problem Details, y sigue escuchando.
  const r = await fetch("http://127.0.0.1:18082/servicios", { method: "POST", headers: { ...ESCRIBE, ...JSON_ }, body: alta("sin-revisor") })
    .then(async (x) => ({ status: x.status, tipo: x.headers.get("content-type") }), () => ({ status: 0, tipo: null }));
  if (r.status !== 502 || r.tipo !== "application/problem+json") fallas.push(`pasarela sin revisor: ${r.status} ${r.tipo}`);
  await esperar(200);
  const pasarelaViva = pasarela.exitCode === null && pasarela.signalCode === null;
  if (!pasarelaViva) fallas.push("la pasarela se cayó");
  // 2. Cuatro 502: termina con mensaje y sin esperar después del último intento.
  const con502 = await correr("alta-segura.ts", ["sin-revisor", `${LAB}/codigo/200`]);
  const despues = con502.salida.split("intento 4:")[1] ?? "";
  if (despues.includes("espero")) fallas.push("después del intento 4 todavía espera");
  if (!con502.salida.includes("se agotaron los 4 intentos") || con502.codigo !== 1) fallas.push(`con 502: salida ${con502.codigo}`);
  // Si se cayó, ya no hay a quién esperar.
  if (pasarela.exitCode === null && pasarela.signalCode === null) {
    const apagada = new Promise((listo) => pasarela.once("exit", listo));
    pasarela.kill();
    await apagada;
  }
  // 3. Sin pasarela: reintenta los cuatro intentos y termina sin la pila de Node.
  const rechazada = await correr("alta-segura.ts", ["sin-pasarela", `${LAB}/codigo/200`]);
  const sinRespuesta = rechazada.salida.match(/sin respuesta \(ECONNREFUSED\)/g)?.length ?? 0;
  if (sinRespuesta !== 4) fallas.push(`conexión rechazada: ${sinRespuesta} intentos sin respuesta, se esperaban 4`);
  if (/TypeError|node:internal|triggerUncaughtException/.test(rechazada.salida)) fallas.push("conexión rechazada: imprime la pila de Node");
  procesos[1] = await arrancar("servidor.ts", 18080);
  return ["la pasarela reenvía Content-Length; sin revisor responde 502 y sigue viva; alta-segura termina al agotar los intentos, también sin conexión", fallas];
}

// alta-segura.ts decide qué hacer con lo que recibe (lección 6). Un servidor de mentira en el 18082 (donde
// estaría la pasarela) responde lo que se le dice y cuenta las peticiones: un 4xx sale con 1 y no se repite,
// un Retry-After razonable se obedece y uno largo no se insiste, un servidor mudo se corta por tiempo y el 409
// de «llave en curso» no es final. Corre cuando la pasarela ya está apagada (sinRevisorNiPasarela la apagó).
type Respuesta = [number, Record<string, string>, string] | null; // null: el servidor no contesta
async function altaSeguraDecide(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const problema = (tipo: string, estado: number): string => JSON.stringify({ type: PROBLEMA + tipo, title: tipo, status: estado });
  async function caso(nombre: string, respuestas: Respuesta[], argumentos: string[], limiteMs?: number) {
    let peticiones = 0;
    const servidor = createServer((peticion, respuesta) => {
      peticion.resume();
      const que = respuestas[Math.min(peticiones++, respuestas.length - 1)];
      if (que === null) return; // se queda callado
      respuesta.writeHead(que[0], { "Content-Type": "application/problem+json", ...que[1] });
      respuesta.end(que[2] + "\n");
    });
    await new Promise<void>((listo) => servidor.listen(18082, "127.0.0.1", listo));
    if (limiteMs !== undefined) process.env.ALTA_LIMITE_MS = String(limiteMs);
    const inicio = Date.now();
    const corrida = await correr("alta-segura.ts", [nombre, `${LAB}/codigo/200`, ...argumentos], 20000);
    const ms = Date.now() - inicio;
    delete process.env.ALTA_LIMITE_MS;
    servidor.closeAllConnections();
    await new Promise((listo) => servidor.close(listo));
    return { ...corrida, ms, peticiones };
  }
  // 1. Un 4xx final: sale con 1, lo dice y no repite.
  const rechazo = await caso("rechazada", [[422, {}, problema("datos-invalidos", 422)]], []);
  if (rechazo.codigo !== 1 || rechazo.peticiones !== 1 || !rechazo.salida.includes("respondió 422")) {
    fallas.push(`4xx: salida ${rechazo.codigo}, ${rechazo.peticiones} peticiones`);
  }
  // 2. Retry-After largo: no insiste, y no espera.
  const largo = await caso("larga", [[503, { "Retry-After": "120" }, problema("en-mantenimiento", 503)]], []);
  if (largo.codigo !== 1 || largo.peticiones !== 1 || largo.ms > 3000 || !largo.salida.includes("no se reintenta")) {
    fallas.push(`Retry-After de 120 s: salida ${largo.codigo}, ${largo.peticiones} peticiones, ${largo.ms} ms`);
  }
  // 3. Retry-After razonable: espera lo que se pidió y el segundo intento pasa.
  const corto = await caso("corta", [[503, { "Retry-After": "1" }, problema("en-mantenimiento", 503)], [201, { "Content-Type": "application/json" }, "{}"]], []);
  if (corto.codigo !== 0 || corto.peticiones !== 2 || corto.ms < 1000) {
    fallas.push(`Retry-After de 1 s: salida ${corto.codigo}, ${corto.peticiones} peticiones, ${corto.ms} ms`);
  }
  // 4. Un servidor mudo: cada intento se corta por tiempo y el programa termina con 1.
  const mudo = await caso("muda", [null], [], 200);
  const cortes = mudo.salida.match(/tiempo agotado: 200 ms/g)?.length ?? 0;
  if (mudo.codigo !== 1 || cortes !== 4 || mudo.peticiones !== 4) {
    fallas.push(`servidor mudo: salida ${mudo.codigo}, ${cortes} cortes, ${mudo.peticiones} peticiones`);
  }
  // 5. El 409 de «llave en curso» se reintenta; el de «nombre repetido» no.
  const enCurso = await caso("encurso", [[409, {}, problema("llave-en-curso", 409)], [201, { "Content-Type": "application/json" }, "{}"]], []);
  if (enCurso.codigo !== 0 || enCurso.peticiones !== 2) fallas.push(`409 llave-en-curso: salida ${enCurso.codigo}, ${enCurso.peticiones} peticiones`);
  const repetido = await caso("repetida", [[409, {}, problema("nombre-repetido", 409)]], []);
  if (repetido.codigo !== 1 || repetido.peticiones !== 1) fallas.push(`409 nombre-repetido: salida ${repetido.codigo}, ${repetido.peticiones} peticiones`);
  return ["alta-segura decide: un 4xx sale con 1; obedece Retry-After si es razonable y no insiste si pide mucho; se corta por tiempo ante un servidor mudo; el 409 de llave en curso se reintenta y el de nombre repetido no", fallas];
}

// RFC 9110, sección 15.3.6: un servidor no genera contenido en un 205. El banco responde sin cuerpo, con
// «Content-Length: 0» (el 205 no se enmarca solo, RFC 9112 sección 6.3) y sin «Transfer-Encoding».
async function banco205(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const r = await fetch(`${LAB}/codigo/205`);
  const cuerpo = await r.text();
  if (r.status !== 205) fallas.push(`estado ${r.status}, se esperaba 205`);
  if (cuerpo !== "") fallas.push(`cuerpo de ${Buffer.byteLength(cuerpo)} bytes`);
  if (r.headers.get("transfer-encoding") !== null) fallas.push(`Transfer-Encoding: ${r.headers.get("transfer-encoding")}`);
  if (r.headers.get("content-length") !== "0") fallas.push(`Content-Length: ${r.headers.get("content-length")}`);
  return ["el banco responde el 205 sin cuerpo, con Content-Length: 0 y sin Transfer-Encoding", fallas];
}

// RFC 9110, sección 8.8.1: tras reiniciar el revisor, la etiqueta vieja no coincide aunque el id y la
// versión sean los mismos (el servicio 3 nunca cambia). Reinicia el revisor que levantó esta matriz.
async function etiquetaTrasReinicio(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const B = { Authorization: "Bearer escritura-b" };
  const antes = (await enviar({ metodo: "GET", ruta: "/servicios/3", cabeceras: B })).headers.get("etag") ?? "";
  const viejo = procesos[1];
  const salida = new Promise((listo) => viejo.once("exit", listo));
  viejo.kill();
  await salida;
  procesos[1] = await arrancar("servidor.ts", 18080);
  const r = await enviar({ metodo: "GET", ruta: "/servicios/3", cabeceras: { ...B, "If-None-Match": antes } });
  await r.text();
  const despues = r.headers.get("etag");
  if (r.status !== 200) fallas.push(`If-None-Match: ${antes} tras reiniciar dio ${r.status}, se esperaba 200`);
  if (despues === antes) fallas.push(`la etiqueta se repitió: ${antes}`);
  return ["ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)", fallas];
}

// RFC 9110, secciones 13.1.1, 13.1.2 y 8.8.3.2. Lee la etiqueta vigente del servicio 1 y la usa.
async function condicionales(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const vigente = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE })).headers.get("etag") ?? "";
  const otra = vigente.replace(/"$/, '9"');
  const leer = async (condicion: string, esperado: number): Promise<void> => {
    const r = await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: { ...LEE, "If-None-Match": condicion } });
    await r.text();
    if (r.status !== esperado) fallas.push(`If-None-Match: ${condicion} dio ${r.status}, se esperaba ${esperado}`);
  };
  await leer(`W/${vigente}`, 304);
  await leer(`"9-9", ${vigente}`, 304);
  await leer("*", 304);
  await leer(`"9-9", W/${otra}`, 200);
  const cambiar = async (condicion: string, esperado: number): Promise<void> => {
    const r = await enviar({ metodo: "PUT", ruta: "/servicios/1", cabeceras: { ...ESCRIBE, ...JSON_, "If-Match": condicion }, cuerpo: alta("catalogo") });
    await r.text();
    if (r.status !== esperado) fallas.push(`If-Match: ${condicion} dio ${r.status}, se esperaba ${esperado}`);
  };
  await cambiar(`W/${vigente}`, 412);
  await cambiar(`"9-9", ${vigente}`, 200);
  await cambiar("*", 200);
  return ["If-None-Match con lista, W/ y * (débil): 304; If-Match con W/: 412; con lista o *: 200", fallas];
}

// La actualización perdida con dos PUT a la vez y la misma If-Match. La lenta manda su cuerpo después
// de que la rápida ya cambió el servicio; el revisor compara la versión otra vez al escribir, así que la
// lenta recibe 412 y el servicio queda como lo dejó la rápida.
async function actualizacionPerdida(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const vigente = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: ESCRIBE })).headers.get("etag") ?? "";
  const cabeceras = { ...ESCRIBE, ...JSON_, "If-Match": vigente };
  let soltar = (): void => {};
  const suelto = new Promise<void>((listo) => { soltar = listo; });
  // El primer pedazo sale enseguida (fetch no manda las cabeceras hasta tener algo del cuerpo); el resto,
  // hasta que la rápida terminó.
  const texto = JSON.stringify({ nombre: "catalogo", url: `${LAB}/codigo/200`, limite_ms: 1000 });
  const codificar = (pedazo: string): Uint8Array => new TextEncoder().encode(pedazo);
  const cuerpo = new ReadableStream<Uint8Array>({
    async start(control) {
      control.enqueue(codificar(texto.slice(0, 10)));
      await suelto;
      control.enqueue(codificar(texto.slice(10)));
      control.close();
    },
  });
  const lenta = fetch(R + "/servicios/1", { method: "PUT", headers: cabeceras, body: cuerpo, duplex: "half" } as RequestInit);
  await esperar(300);
  const rapida = await enviar({ metodo: "PUT", ruta: "/servicios/1", cabeceras,
    cuerpo: JSON.stringify({ nombre: "catalogo", url: `${LAB}/codigo/200`, limite_ms: 3000 }) });
  await rapida.text();
  soltar();
  const respuestaLenta = await lenta;
  await respuestaLenta.text();
  const final = (await (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: ESCRIBE })).json()) as { limite_ms?: number };
  if (rapida.status !== 200) fallas.push(`la rápida dio ${rapida.status}, se esperaba 200`);
  if (respuestaLenta.status !== 412) fallas.push(`la lenta dio ${respuestaLenta.status}, se esperaba 412`);
  if (final.limite_ms !== 3000) fallas.push(`el servicio quedó con limite_ms ${final.limite_ms}, se esperaba 3000 (el de la rápida)`);
  return ["actualización perdida: dos PUT a la vez con la misma If-Match: 200 y 412, gana la primera que escribe", fallas];
}

// El orden del PUT (RFC 9110, sección 13.2.1): 415 antes que If-Match. Y si otro retira el servicio
// mientras el PUT espera su cuerpo, 410 y no 412.
async function ordenDelPut(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  const texto = { ...ESCRIBE, "Content-Type": "text/plain" };
  for (const condicion of ['"1-0-0"', undefined]) {
    const cabeceras: Record<string, string> = condicion === undefined ? texto : { ...texto, "If-Match": condicion };
    const r = await enviar({ metodo: "PUT", ruta: "/servicios/1", cabeceras, cuerpo: "catalogo" });
    await r.text();
    if (r.status !== 415) fallas.push(`text/plain ${condicion === undefined ? "sin If-Match" : "con etiqueta vieja"}: ${r.status}, se esperaba 415`);
  }
  const alta = await enviar({ metodo: "POST", ruta: "/servicios", cabeceras: { ...ESCRIBE, ...JSON_ },
    cuerpo: JSON.stringify({ nombre: "efimero", url: `${LAB}/codigo/200` }) });
  await alta.text();
  const ruta = alta.headers.get("location") ?? "/servicios/0";
  const etiquetaLeida = alta.headers.get("etag") ?? "";
  const datos = JSON.stringify({ nombre: "efimero", url: `${LAB}/codigo/200` });
  let soltar = (): void => {};
  const suelto = new Promise<void>((listo) => { soltar = listo; });
  const cuerpo = new ReadableStream<Uint8Array>({
    async start(control) {
      control.enqueue(new TextEncoder().encode(datos.slice(0, 10)));
      await suelto;
      control.enqueue(new TextEncoder().encode(datos.slice(10)));
      control.close();
    },
  });
  const lento = fetch(R + ruta, { method: "PUT", headers: { ...ESCRIBE, ...JSON_, "If-Match": etiquetaLeida }, body: cuerpo, duplex: "half" } as RequestInit);
  await esperar(300);
  const retiro = await enviar({ metodo: "DELETE", ruta, cabeceras: ESCRIBE });
  await retiro.text();
  soltar();
  const respuestaLenta = await lento;
  const problema = (await respuestaLenta.json()) as { type?: string };
  if (retiro.status !== 204) fallas.push(`el retiro dio ${retiro.status}`);
  if (respuestaLenta.status !== 410 || problema.type !== PROBLEMA + "servicio-retirado") {
    fallas.push(`el PUT lento dio ${respuestaLenta.status} ${problema.type}, se esperaba 410 servicio-retirado`);
  }
  return ["orden del PUT: text/plain da 415 con etiqueta vieja o sin ella; retirado en el hueco, 410", fallas];
}

// RFC 9110, sección 11.1, y RFC 6750, sección 3.1.
async function esquemas(): Promise<[string, string[]]> {
  const fallas: string[] = [];
  for (const valor of ["bearer lectura-a", "BEARER lectura-a"]) {
    const r = await enviar({ metodo: "GET", ruta: "/servicios", cabeceras: { Authorization: valor } });
    await r.text();
    if (r.status !== 200) fallas.push(`${valor}: ${r.status}, se esperaba 200`);
  }
  const retos: [string, string][] = [
    ["Basic bGVjdHVyYS1hOg==", 'Bearer realm="revisor"'],
    ["Bearer inventada", 'Bearer realm="revisor", error="invalid_token"'],
  ];
  for (const [valor, esperado] of retos) {
    const r = await enviar({ metodo: "GET", ruta: "/servicios", cabeceras: { Authorization: valor } });
    await r.text();
    const reto = r.headers.get("www-authenticate");
    if (r.status !== 401 || reto !== esperado) fallas.push(`${valor}: ${r.status} con ${reto}, se esperaba 401 con ${esperado}`);
  }
  return ["esquema sin distinguir mayúsculas (bearer: 200); Basic: reto sin error=\"invalid_token\"", fallas];
}

// Node responde 400 a un método que no conoce antes de llamar al revisor, así que esto no se puede
// provocar por la red: se llama a atender() directo, con una petición y una respuesta de mentira.
async function metodoHeredado(): Promise<[string, string[]]> {
  const { atender } = await import("./rutas.ts");
  const fallas: string[] = [];
  // rutas.ts escribe cada petición en la terminal del revisor; aquí correría dentro de la matriz.
  const registrar = console.log;
  console.log = () => {};
  for (const method of ["constructor", "toString", "__proto__"]) {
    const peticion = { method, url: "/servicios/1", headers: { authorization: "Bearer escritura-a" } };
    const codigo = await new Promise<string>((listo) => {
      const respuesta = {
        req: peticion,
        statusCode: 0,
        writeHead(codigo: number) { this.statusCode = codigo; return this; },
        end() { listo(String(this.statusCode)); },
      };
      atender(peticion as unknown as IncomingMessage, respuesta as unknown as ServerResponse)
        .catch((error: unknown) => listo(`excepción ${String(error)}`));
    });
    if (codigo !== "405") fallas.push(`${method}: ${codigo}`);
  }
  console.log = registrar;
  return ["método heredado de Object.prototype (constructor, toString, __proto__): 405", fallas];
}

// Si algo ya escucha en los puertos del curso, la corrida mediría a otro programa (o esperaría para siempre a un
// hijo que no pudo arrancar): se detiene en seguida.
for (const puerto of [18080, 18081, 18082]) {
  if (await aceptaConexiones(puerto)) {
    console.error(`puerto ${puerto} ocupado; apaga lo que lo usa`);
    process.exit(2);
  }
}

const procesos: ChildProcess[] = [
  spawn(process.execPath, ["laboratorio.ts"], { cwd: import.meta.dirname, stdio: "ignore" }),
  spawn(process.execPath, ["servidor.ts"], { cwd: import.meta.dirname, stdio: "ignore" }),
];
let fallidos = 0;
let extra = 0;
let abortada = false;
try {
  await esperarPuerto(18081, procesos[0]);
  await esperarPuerto(18080, procesos[1]);
  SIN_CAMBIOS["If-None-Match"] = (await enviar({ metodo: "GET", ruta: "/servicios/1", cabeceras: LEE })).headers.get("etag") ?? "";
  for (const escenario of ESCENARIOS) {
    const fallas = await comprobar(escenario);
    if (fallas.length > 0) fallidos++;
    console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${escenario.codigo} ${escenario.nombre}${fallas.length > 0 ? ": " + fallas.join("; ") : ""}`);
  }
  const resultados = await adicionales();
  extra = resultados.length;
  for (const [nombre, fallas] of resultados) {
    if (fallas.length > 0) fallidos++;
    console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${nombre}${fallas.length > 0 ? ": " + fallas.join("; ") : ""}`);
  }
} catch (error) {
  // Un proceso no arrancó (o no contestó a tiempo): no hay resumen que dar, y se dice por qué.
  console.error(`no se pudo correr la matriz: ${error instanceof Error ? error.message : String(error)}`);
  abortada = true;
} finally {
  for (const proceso of procesos) proceso.kill();
}
if (abortada) process.exit(1);
const total = ESCENARIOS.length + extra;
console.log(`\n${total - fallidos} de ${total} comprobaciones pasaron (${ESCENARIOS.length} escenarios de código y ${extra} adicionales).`);
process.exitCode = fallidos === 0 ? 0 : 1;
```

**`fig08_01/openapi.json`** (JSON no admite comentarios, así que este archivo no empieza con la línea de siempre):

```json
{
  "openapi": "3.1.1",
  "info": {
    "title": "API del revisor",
    "version": "1.0.0",
    "summary": "Contrato verificable del curso de HTTP de Hábil.",
    "description": "info.version es la versión de ESTE documento, no la de la API. La API vigente vive en la raíz (/servicios); la v1 está desaprobada y la v0 retirada.",
    "license": {
      "name": "CC BY-SA 4.0",
      "identifier": "CC-BY-SA-4.0"
    }
  },
  "servers": [
    {
      "url": "http://127.0.0.1:18080"
    }
  ],
  "security": [
    {
      "credencial": []
    }
  ],
  "paths": {
    "/servicios": {
      "get": {
        "summary": "Listar los servicios del equipo",
        "responses": {
          "200": {
            "description": "La lista.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Lista"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          }
        }
      },
      "post": {
        "summary": "Dar de alta un servicio",
        "parameters": [
          {
            "$ref": "#/components/parameters/IdempotencyKey"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DatosServicio"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Creado.",
            "headers": {
              "Location": {
                "$ref": "#/components/headers/Location"
              },
              "ETag": {
                "$ref": "#/components/headers/ETag"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Servicio"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "400": {
            "$ref": "#/components/responses/E400"
          },
          "403": {
            "$ref": "#/components/responses/E403"
          },
          "409": {
            "$ref": "#/components/responses/E409"
          },
          "415": {
            "$ref": "#/components/responses/E415"
          },
          "422": {
            "$ref": "#/components/responses/E422"
          },
          "413": {
            "$ref": "#/components/responses/E413"
          }
        }
      }
    },
    "/servicios/{id}": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "integer",
            "minimum": 1
          }
        }
      ],
      "get": {
        "summary": "Consultar un servicio",
        "parameters": [
          {
            "name": "If-None-Match",
            "in": "header",
            "schema": {
              "type": "string"
            },
            "description": "«*» o una lista de etiquetas separadas por comas. Se compara en débil (RFC 9110, secciones 13.1.2 y 8.8.3.2): W/\"1-1\" coincide con \"1-1\". Si alguna coincide, 304."
          }
        ],
        "responses": {
          "200": {
            "description": "El servicio.",
            "headers": {
              "ETag": {
                "$ref": "#/components/headers/ETag"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Servicio"
                }
              }
            }
          },
          "304": {
            "description": "No cambió; sin cuerpo.",
            "headers": {
              "ETag": {
                "$ref": "#/components/headers/ETag"
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          }
        }
      },
      "put": {
        "summary": "Cambiar un servicio sin pisar otro cambio",
        "parameters": [
          {
            "name": "If-Match",
            "in": "header",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "«*» o una lista de etiquetas separadas por comas. Se compara en fuerte (RFC 9110, secciones 13.1.1 y 8.8.3.2): una etiqueta W/ nunca coincide. «*» coincide si el servicio existe. Si ninguna coincide, 412."
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DatosServicio"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Cambiado.",
            "headers": {
              "ETag": {
                "$ref": "#/components/headers/ETag"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Servicio"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "400": {
            "$ref": "#/components/responses/E400"
          },
          "403": {
            "$ref": "#/components/responses/E403"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "409": {
            "$ref": "#/components/responses/E409"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          },
          "412": {
            "$ref": "#/components/responses/E412"
          },
          "415": {
            "$ref": "#/components/responses/E415"
          },
          "422": {
            "$ref": "#/components/responses/E422"
          },
          "428": {
            "$ref": "#/components/responses/E428"
          },
          "413": {
            "$ref": "#/components/responses/E413"
          }
        }
      },
      "delete": {
        "summary": "Retirar un servicio",
        "responses": {
          "204": {
            "description": "Retirado; sin cuerpo."
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "403": {
            "$ref": "#/components/responses/E403"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          }
        }
      }
    },
    "/servicios/{id}/revisiones": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "integer",
            "minimum": 1
          }
        }
      ],
      "post": {
        "summary": "Pedir una revisión",
        "responses": {
          "202": {
            "description": "Aceptada; el seguimiento está en Location.",
            "headers": {
              "Location": {
                "$ref": "#/components/headers/Location"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Revision"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "403": {
            "$ref": "#/components/responses/E403"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          },
          "422": {
            "$ref": "#/components/responses/E422"
          },
          "429": {
            "$ref": "#/components/responses/E429"
          }
        }
      }
    },
    "/servicios/{id}/salud": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "integer",
            "minimum": 1
          }
        }
      ],
      "get": {
        "summary": "Consultar el servicio en este momento (el revisor hace de pasarela)",
        "responses": {
          "200": {
            "description": "Lo que respondió el servicio, sea cual sea su código.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Salud"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          },
          "422": {
            "$ref": "#/components/responses/E422"
          },
          "502": {
            "$ref": "#/components/responses/E502"
          },
          "504": {
            "$ref": "#/components/responses/E504"
          },
          "429": {
            "$ref": "#/components/responses/E429Salud"
          }
        }
      }
    },
    "/servicios/{id}/informe": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "integer",
            "minimum": 1
          }
        }
      ],
      "get": {
        "summary": "Resumen de las revisiones (trae un defecto a propósito: sin revisiones responde 500)",
        "responses": {
          "200": {
            "description": "El resumen.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Informe"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          },
          "500": {
            "$ref": "#/components/responses/E500"
          }
        }
      }
    },
    "/revisiones/{id}": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "integer",
            "minimum": 1
          }
        }
      ],
      "get": {
        "summary": "Seguimiento de una revisión",
        "responses": {
          "200": {
            "description": "La revisión; mientras está pendiente trae Retry-After.",
            "headers": {
              "Retry-After": {
                "$ref": "#/components/headers/Retry-After"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Revision"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          }
        }
      }
    },
    "/mantenimiento": {
      "put": {
        "summary": "Encender o apagar el mantenimiento (solo admin)",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "activo"
                ],
                "properties": {
                  "activo": {
                    "type": "boolean"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "204": {
            "description": "Hecho."
          },
          "400": {
            "$ref": "#/components/responses/E400"
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "403": {
            "$ref": "#/components/responses/E403"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "415": {
            "$ref": "#/components/responses/E415"
          },
          "422": {
            "$ref": "#/components/responses/E422"
          },
          "413": {
            "$ref": "#/components/responses/E413"
          }
        }
      }
    },
    "/viejo/servicios": {
      "get": {
        "summary": "Ruta vieja",
        "security": [],
        "responses": {
          "301": {
            "description": "Se mudó a /servicios. Un POST seguido con 301 suele volverse GET.",
            "headers": {
              "Location": {
                "$ref": "#/components/headers/Location"
              }
            }
          }
        }
      },
      "post": {
        "summary": "Ruta vieja",
        "security": [],
        "responses": {
          "301": {
            "description": "Se mudó a /servicios. Un POST seguido con 301 suele volverse GET.",
            "headers": {
              "Location": {
                "$ref": "#/components/headers/Location"
              }
            }
          }
        }
      }
    },
    "/api/servicios": {
      "get": {
        "summary": "Ruta vieja",
        "security": [],
        "responses": {
          "308": {
            "description": "Se mudó a /servicios; el método y el cuerpo se conservan.",
            "headers": {
              "Location": {
                "$ref": "#/components/headers/Location"
              }
            }
          }
        }
      },
      "post": {
        "summary": "Ruta vieja",
        "security": [],
        "responses": {
          "308": {
            "description": "Se mudó a /servicios; el método y el cuerpo se conservan.",
            "headers": {
              "Location": {
                "$ref": "#/components/headers/Location"
              }
            }
          }
        }
      }
    },
    "/v1/servicios": {
      "get": {
        "summary": "Versión 1, desaprobada",
        "deprecated": true,
        "responses": {
          "200": {
            "description": "La lista en la forma de la v1.",
            "headers": {
              "Deprecation": {
                "$ref": "#/components/headers/Deprecation"
              },
              "Sunset": {
                "$ref": "#/components/headers/Sunset"
              },
              "Link": {
                "$ref": "#/components/headers/Link"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          }
        }
      }
    },
    "/v1/servicios/{id}": {
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "integer",
            "minimum": 1
          }
        }
      ],
      "get": {
        "summary": "Versión 1, desaprobada",
        "deprecated": true,
        "responses": {
          "200": {
            "description": "El servicio en la forma de la v1.",
            "headers": {
              "Deprecation": {
                "$ref": "#/components/headers/Deprecation"
              },
              "Sunset": {
                "$ref": "#/components/headers/Sunset"
              },
              "Link": {
                "$ref": "#/components/headers/Link"
              }
            },
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          },
          "401": {
            "$ref": "#/components/responses/E401"
          },
          "405": {
            "$ref": "#/components/responses/E405"
          },
          "503": {
            "$ref": "#/components/responses/E503"
          },
          "404": {
            "$ref": "#/components/responses/E404"
          },
          "410": {
            "$ref": "#/components/responses/E410"
          }
        }
      }
    },
    "/v0/servicios": {
      "get": {
        "summary": "Versión 0, retirada",
        "deprecated": true,
        "security": [],
        "responses": {
          "410": {
            "$ref": "#/components/responses/E410"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "credencial": {
        "type": "http",
        "scheme": "bearer"
      }
    },
    "parameters": {
      "IdempotencyKey": {
        "name": "Idempotency-Key",
        "in": "header",
        "required": false,
        "description": "Patrón documentado por esta API, NO un estándar: draft-ietf-httpapi-idempotency-key-header-07 venció el 18 de abril de 2026 sin publicarse como RFC.",
        "schema": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "headers": {
      "Location": {
        "schema": {
          "type": "string",
          "format": "uri-reference"
        }
      },
      "ETag": {
        "description": "Etiqueta fuerte \"id-versión-arranque\". Cambia con cada cambio del servicio y con cada arranque del revisor (RFC 9110, sección 8.8.1).",
        "schema": {
          "type": "string"
        }
      },
      "Retry-After": {
        "description": "Segundos o fecha HTTP (RFC 9110, sección 10.2.3).",
        "schema": {
          "type": "string"
        }
      },
      "WWW-Authenticate": {
        "schema": {
          "type": "string"
        }
      },
      "Allow": {
        "schema": {
          "type": "string"
        }
      },
      "Accept": {
        "schema": {
          "type": "string"
        }
      },
      "Deprecation": {
        "description": "RFC 9745: fecha de campo estructurado (@segundos).",
        "schema": {
          "type": "string"
        }
      },
      "Sunset": {
        "description": "RFC 8594 (informativo): fecha HTTP; nunca anterior a Deprecation.",
        "schema": {
          "type": "string"
        }
      },
      "Link": {
        "schema": {
          "type": "string"
        }
      }
    },
    "responses": {
      "E400": {
        "description": "El cuerpo no se puede leer (type cuerpo-ilegible).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E401": {
        "description": "Falta una credencial válida (type credencial-invalida).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        },
        "headers": {
          "WWW-Authenticate": {
            "$ref": "#/components/headers/WWW-Authenticate"
          }
        }
      },
      "E403": {
        "description": "La credencial no tiene permiso (type permiso-insuficiente).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E404": {
        "description": "No existe, o es de otro equipo y se esconde a propósito (type servicio-inexistente o about:blank).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E405": {
        "description": "El método no se admite en esta ruta (type about:blank).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        },
        "headers": {
          "Allow": {
            "$ref": "#/components/headers/Allow"
          }
        }
      },
      "E409": {
        "description": "Choca con el estado actual (type nombre-repetido o llave-en-curso).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E410": {
        "description": "Se retiró y no va a volver (type servicio-retirado o version-retirada).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E412": {
        "description": "Ninguna etiqueta de If-Match coincide con la vigente en comparación fuerte (type etiqueta-vencida).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E415": {
        "description": "El cuerpo no es application/json (type about:blank).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        },
        "headers": {
          "Accept": {
            "$ref": "#/components/headers/Accept"
          }
        }
      },
      "E422": {
        "description": "Se leyó, pero no se puede cumplir (type datos-invalidos, destino-prohibido o llave-reutilizada).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E428": {
        "description": "Falta If-Match (type falta-condicion).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E429": {
        "description": "Demasiadas revisiones de la misma credencial en el último minuto (type demasiadas-revisiones).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        },
        "headers": {
          "Retry-After": {
            "$ref": "#/components/headers/Retry-After"
          }
        }
      },
      "E500": {
        "description": "Error interno; instance es urn:uuid:… y sirve para encontrarlo en la bitácora (type error-interno).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E502": {
        "description": "El servicio consultado no dio una respuesta HTTP válida: cortó la conexión, respondió algo que no es HTTP o no se pudo conectar (type respuesta-invalida).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E503": {
        "description": "El revisor está en mantenimiento (type en-mantenimiento).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        },
        "headers": {
          "Retry-After": {
            "$ref": "#/components/headers/Retry-After"
          }
        }
      },
      "E504": {
        "description": "El servicio consultado no respondió a tiempo (type servicio-lento).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E413": {
        "description": "El cuerpo pasa de 16 KiB (type about:blank). La conexión se cierra al responder.",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
      "E429Salud": {
        "description": "Demasiadas consultas en vivo de la misma credencial en el último minuto (type demasiadas-consultas).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        },
        "headers": {
          "Retry-After": {
            "$ref": "#/components/headers/Retry-After"
          }
        }
      }
    },
    "schemas": {
      "DatosServicio": {
        "type": "object",
        "required": [
          "nombre",
          "url"
        ],
        "properties": {
          "nombre": {
            "type": "string",
            "minLength": 1,
            "maxLength": 40
          },
          "url": {
            "type": "string",
            "format": "uri",
            "description": "http o https, sin usuario, clave, consulta (?) ni fragmento (#): el revisor la repite en cada representación del servicio (422 datos-invalidos si los trae); no puede apuntar a direcciones privadas ni reservadas (SSRF)."
          },
          "limite_ms": {
            "type": "integer",
            "minimum": 100,
            "maximum": 10000,
            "default": 2000
          }
        }
      },
      "Servicio": {
        "type": "object",
        "required": [
          "id",
          "nombre",
          "url",
          "limite_ms"
        ],
        "properties": {
          "id": {
            "type": "integer"
          },
          "nombre": {
            "type": "string"
          },
          "url": {
            "type": "string"
          },
          "limite_ms": {
            "type": "integer"
          }
        }
      },
      "Lista": {
        "type": "object",
        "required": [
          "servicios"
        ],
        "properties": {
          "servicios": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Servicio"
            }
          }
        }
      },
      "Resultado": {
        "type": [
          "object",
          "null"
        ],
        "properties": {
          "estado": {
            "enum": [
              "ARRIBA",
              "LENTO",
              "CAIDO"
            ]
          },
          "codigo": {
            "type": [
              "integer",
              "null"
            ]
          },
          "ms": {
            "type": [
              "integer",
              "null"
            ]
          },
          "detalle": {
            "type": "string"
          }
        }
      },
      "Revision": {
        "type": "object",
        "required": [
          "id",
          "servicio",
          "estado",
          "resultado"
        ],
        "properties": {
          "id": {
            "type": "integer"
          },
          "servicio": {
            "type": "integer"
          },
          "estado": {
            "enum": [
              "pendiente",
              "terminada"
            ]
          },
          "resultado": {
            "$ref": "#/components/schemas/Resultado"
          }
        }
      },
      "Salud": {
        "type": "object",
        "properties": {
          "servicio": {
            "type": "integer"
          },
          "codigo": {
            "type": "integer"
          },
          "ms": {
            "type": "integer"
          }
        }
      },
      "Informe": {
        "type": "object",
        "properties": {
          "servicio": {
            "type": "integer"
          },
          "revisiones": {
            "type": "integer"
          },
          "ultimo_estado": {
            "type": "string"
          }
        }
      },
      "Problema": {
        "type": "object",
        "description": "Problem Details (RFC 9457). type es el identificador estable; title y detail son para personas.",
        "required": [
          "type",
          "title",
          "status",
          "detail",
          "instance"
        ],
        "properties": {
          "type": {
            "type": "string",
            "format": "uri-reference",
            "examples": [
              "https://revisor.example/problemas/servicio-inexistente",
              "about:blank"
            ]
          },
          "title": {
            "type": "string"
          },
          "status": {
            "type": "integer",
            "minimum": 400,
            "maximum": 599
          },
          "detail": {
            "type": "string"
          },
          "instance": {
            "type": "string",
            "format": "uri-reference"
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "detail": {
                  "type": "string"
                },
                "pointer": {
                  "type": "string"
                }
              }
            }
          },
          "existente": {
            "type": "string"
          }
        },
        "additionalProperties": true
      }
    }
  }
}
```

#### 8.15.2 Los archivos que no cambian

Son los de las lecciones anteriores en su versión vigente; solo cambia la primera línea, que ahora dice `fig08_01/`. `package.json` es el mismo de siempre:

```json
{
  "type": "module"
}
```

```ts
// fig08_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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
// fig08_01/alta-segura.ts — dar de alta un servicio a través de la pasarela y reintentar sin duplicar.
// Uso: node alta-segura.ts <nombre> <url> [--sin-llave]
// Código de salida: 0 si el alta se hizo (un 2xx); 1 si no se hizo o no se sabe: se agotaron los intentos,
// el servidor pidió esperar más de lo razonable, o respondió algo que repetir no arregla (un 4xx);
// 2 si faltan argumentos.
import { randomUUID } from "node:crypto";
import { esperaConJitter, segundosDeEspera } from "./cliente.ts";

const [nombre, url, opcion] = process.argv.slice(2);
if (nombre === undefined || url === undefined) {
  console.error("uso: node alta-segura.ts <nombre> <url> [--sin-llave]");
  process.exit(2);
}

// Una llave por intención, no por intento: todos los reintentos de esta alta llevan la misma.
const llave = opcion === "--sin-llave" ? undefined : randomUUID();
const INTENTOS = 4;
// Cuánto espera una respuesta antes de darla por perdida. ALTA_LIMITE_MS lo cambia (sirve para probar).
const LIMITE_MS = Number(process.env.ALTA_LIMITE_MS) > 0 ? Number(process.env.ALTA_LIMITE_MS) : 2000;
// Lo más que obedece de Retry-After: el mismo tope que cliente.ts. Si el servidor pide más, no insiste.
const TOPE_RETRY_AFTER_S = 5;
const LLAVE_EN_CURSO = "https://revisor.example/problemas/llave-en-curso";

const como = llave === undefined ? "sin llave (podría duplicar)" : "con la misma llave";

type Intento = { codigo: number; cuerpo: string; reintentarEn: number | null } | { sinRespuesta: string };

// Un intento: la respuesta (código, cuerpo y Retry-After) o, si no llegó ninguna, por qué. Sin respuesta
// (conexión rechazada, cortada o tiempo agotado) la petición pudo llegar o no: es el mismo caso que el 502,
// y con la misma llave repetirla es seguro.
async function intentar(): Promise<Intento> {
  const cabeceras: Record<string, string> = {
    "Authorization": "Bearer escritura-a",
    "Content-Type": "application/json",
    "X-Simular": "perder-primera",
  };
  if (llave !== undefined) cabeceras["Idempotency-Key"] = llave;
  try {
    const respuesta = await fetch("http://127.0.0.1:18082/servicios", {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify({ nombre, url }),
      signal: AbortSignal.timeout(LIMITE_MS),
    });
    const reintentarEn = segundosDeEspera(respuesta.headers.get("retry-after"));
    return { codigo: respuesta.status, cuerpo: (await respuesta.text()).trim(), reintentarEn };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { sinRespuesta: `tiempo agotado: ${LIMITE_MS} ms` };
    }
    const causa = (error as { cause?: { code?: string } }).cause?.code;
    return { sinRespuesta: causa ?? String(error) };
  }
}

// ¿Puede mejorar solo? Sin respuesta, 502, 503 y 504 sí. Un 409 también, pero solo el de «llave en curso»:
// la petición original sigue guardándose y esperar basta. El 409 de «nombre repetido» no mejora esperando.
function reintentable(intento: Intento): boolean {
  if ("sinRespuesta" in intento) return true;
  if ([502, 503, 504].includes(intento.codigo)) return true;
  if (intento.codigo !== 409) return false;
  try {
    return (JSON.parse(intento.cuerpo) as { type?: unknown }).type === LLAVE_EN_CURSO;
  } catch {
    return false;
  }
}

const pendiente = llave === undefined
  ? "no se sabe si el alta ocurrió"
  : `repetir más tarde con la llave ${llave} es seguro`;

let desenlace: "hecho" | "rechazado" | "agotado" | "sin-insistir" = "agotado";
let ultimo: Intento = { sinRespuesta: "ninguno" };
let huboDuda = false;
let pedidaLarga = 0;
for (let intento = 1; intento <= INTENTOS; intento++) {
  ultimo = await intentar();
  if ("sinRespuesta" in ultimo) {
    console.log(`intento ${intento}: sin respuesta (${ultimo.sinRespuesta})`);
  } else {
    console.log(`intento ${intento}: ${ultimo.codigo} ${ultimo.cuerpo}`);
    if (ultimo.codigo >= 200 && ultimo.codigo < 300) {
      desenlace = "hecho";
      break;
    }
  }
  // Se reintenta solo lo que puede mejorar solo. Un 4xx no mejora repitiéndolo.
  if (!reintentable(ultimo)) {
    desenlace = "rechazado";
    break;
  }
  huboDuda = true;
  // Después del último intento no se espera: no queda nada que reintentar.
  if (intento === INTENTOS) break;
  // Si el servidor dice cuánto esperar, se obedece; si pide más del tope, no se insiste.
  const pedida = "sinRespuesta" in ultimo ? null : ultimo.reintentarEn;
  if (pedida !== null && pedida > TOPE_RETRY_AFTER_S) {
    desenlace = "sin-insistir";
    pedidaLarga = pedida;
    break;
  }
  const espera = pedida !== null ? pedida * 1000 : esperaConJitter(intento, 250, 2000);
  console.log(
    pedida !== null
      ? `  el servidor pide esperar ${pedida} s (Retry-After); espero ${pedida} s y reintento ${como}`
      : `  espero entre 0 y ${Math.min(2000, 250 * 2 ** intento)} ms y reintento ${como}`,
  );
  await new Promise((listo) => setTimeout(listo, espera));
}

if (desenlace === "agotado") {
  console.log(`se agotaron los ${INTENTOS} intentos sin una respuesta definitiva; ${pendiente}`);
} else if (desenlace === "sin-insistir") {
  console.log(`el servidor pidió esperar ${pedidaLarga} s (Retry-After), más de los ${TOPE_RETRY_AFTER_S} s que este programa espera; no se reintenta; ${pendiente}`);
} else if (desenlace === "rechazado" && !("sinRespuesta" in ultimo)) {
  const duda = llave === undefined && huboDuda
    ? "; sin llave no se sabe si lo que ya existe lo creó un intento anterior"
    : "";
  console.log(`el servidor respondió ${ultimo.codigo}: repetir lo mismo no lo arregla${duda}`);
}
if (desenlace !== "hecho") process.exitCode = 1;
```

```ts
// fig08_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig08_01/decisiones.ts — qué hace quien recibe una respuesta: la tabla de decisión del cliente del revisor.
// Decide con el código y, si el cuerpo es un Problem Details con un type conocido, afina con el type.
// Nunca decide con el title ni con el detail: esos son para personas y pueden cambiar o traducirse.

export type Accion = "seguir" | "corregir" | "reautenticar" | "esperar" | "reconciliar" | "rendirse";

export type Decision = { accion: Accion; motivo: string; esperaS: number | null; reintenta: boolean };

// Por código. Lo que no está aquí se trata como el x00 de su familia (RFC 9110, sección 15).
const POR_CODIGO: Record<number, [Accion, string]> = {
  200: ["seguir", "salió bien"],
  201: ["seguir", "se creó; la dirección viene en Location"],
  202: ["seguir", "se aceptó; el seguimiento viene en Location"],
  204: ["seguir", "salió bien y no hay nada que leer"],
  300: ["corregir", "hay varias opciones: elige una dirección"],
  301: ["corregir", "la dirección cambió para siempre: actualiza la configuración"],
  302: ["corregir", "redirección temporal: el cliente no la sigue solo; revisa la dirección de Location"],
  303: ["corregir", "redirección a otro recurso: el cliente no la sigue solo; revisa la dirección de Location"],
  304: ["seguir", "no cambió: usa la copia que ya tienes"],
  307: ["corregir", "redirección temporal que conserva el método: el cliente no la sigue solo; revisa Location"],
  308: ["corregir", "la dirección cambió para siempre: actualiza la configuración"],
  400: ["corregir", "la petición no se puede leer"],
  401: ["reautenticar", "falta una credencial válida"],
  403: ["rendirse", "la credencial no tiene permiso: lo resuelve una persona"],
  404: ["rendirse", "no existe (o no te lo muestran)"],
  405: ["corregir", "ese método no se admite: mira Allow"],
  408: ["esperar", "el servidor no recibió la petición completa a tiempo: repítela tal cual, en una conexión nueva (RFC 9110, 15.5.9)"],
  409: ["reconciliar", "choca con el estado actual: relee y decide"],
  410: ["rendirse", "se retiró y no va a volver: dalo de baja"],
  412: ["reconciliar", "tu etiqueta ya no es la vigente: relee y vuelve a aplicar tu cambio"],
  415: ["corregir", "el formato no se admite: mira Accept"],
  422: ["corregir", "se entendió, pero los datos no se pueden cumplir"],
  425: ["esperar", "el servidor no quiso procesar datos tempranos: repite la petición, esta vez sin ellos (RFC 8470, 5.2)"],
  428: ["corregir", "falta la condición: manda If-Match"],
  429: ["esperar", "demasiadas peticiones: espera lo que diga Retry-After"],
  500: ["rendirse", "falla del servidor: repórtala con su instance"],
  502: ["esperar", "falló lo que está detrás: reintenta solo si la operación es idempotente"],
  503: ["esperar", "no está disponible: espera lo que diga Retry-After"],
  504: ["esperar", "lo de atrás no respondió a tiempo: reintenta solo si es idempotente"],
};

// Por type del revisor: el mismo código puede pedir cosas distintas.
const BASE = "https://revisor.example/problemas/";
const POR_TYPE: Record<string, [Accion, string]> = {
  [BASE + "llave-en-curso"]: ["esperar", "la petición original sigue en curso: espera y repite con la misma llave"],
  [BASE + "nombre-repetido"]: ["reconciliar", "ya existe: mira el miembro existente antes de crear otro"],
  [BASE + "llave-reutilizada"]: ["corregir", "usa una llave nueva para una petición nueva"],
  [BASE + "destino-prohibido"]: ["corregir", "el revisor no se conecta a esa dirección: usa otra"],
  [BASE + "servicio-retirado"]: ["rendirse", "el servicio se retiró: dalo de baja de tu lista"],
  [BASE + "en-mantenimiento"]: ["esperar", "el revisor está en mantenimiento: espera lo que diga Retry-After"],
};

// Sin respuesta HTTP también hay que decidir.
export function decidirSinRespuesta(tipo: "tiempo-agotado" | "sin-conexion" | "respuesta-invalida" | "destino-prohibido"): Decision {
  if (tipo === "destino-prohibido") return { accion: "corregir", motivo: "destino prohibido", esperaS: null, reintenta: false };
  return { accion: "esperar", motivo: tipo, esperaS: null, reintenta: true };
}

export function decidir(codigo: number, retryAfterS: number | null, type: string | null): Decision {
  const familia = codigo < 100 || codigo > 599 ? 500 : Math.floor(codigo / 100) * 100;
  // Object.hasOwn: el type llega del cuerpo ajeno, y POR_TYPE[type] a secas encontraría también lo que
  // hereda de Object.prototype (un type "constructor" devolvería una función, no una decisión).
  const propia = (type !== null && Object.hasOwn(POR_TYPE, type) ? POR_TYPE[type] : undefined) ?? POR_CODIGO[codigo];
  const [accion, motivo] = propia ?? motivoDeFamilia(codigo, familia);
  return { accion, motivo, esperaS: accion === "esperar" ? retryAfterS : null, reintenta: accion === "esperar" };
}

// Un código que la tabla no lista se trata como el x00 de su clase (RFC 9110, sección 15). El motivo lo
// dice, para que nadie lea la frase del x00 como si fuera la del código que llegó.
function motivoDeFamilia(codigo: number, familia: number): [Accion, string] {
  const [accion, motivo] = POR_CODIGO[familia] ?? ["rendirse", "código desconocido"];
  if (codigo < 100 || codigo > 599) {
    return ["rendirse", `${codigo} no es un código de HTTP (el RFC 9110 admite de 100 a 599): se procesa como un 5xx`];
  }
  if (POR_CODIGO[familia] === undefined) return [accion, motivo];
  return [accion, `el ${codigo} no está en la tabla: se trata como un ${familia} (${motivo})`];
}

// Lee el type si el cuerpo es un Problem Details; si no, null. No lee nada más del cuerpo.
export function typeDe(tipoContenido: string | null, cuerpo: string): string | null {
  // El tipo de medio no distingue mayúsculas y puede traer parámetros (RFC 9110, sección 8.3.1).
  if (tipoContenido === null || tipoContenido.split(";")[0]?.trim().toLowerCase() !== "application/problem+json") return null;
  try {
    const problema = JSON.parse(cuerpo) as { type?: unknown };
    return typeof problema.type === "string" ? problema.type : "about:blank";
  } catch {
    return null;
  }
}
```

```ts
// fig08_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig08_01/idempotencia.ts — Idempotency-Key: repetir un POST sin duplicar lo que creó.
// OJO: Idempotency-Key NO es un estándar. Es un borrador de la IETF
// (draft-ietf-httpapi-idempotency-key-header-07, que venció el 18 de abril de 2026 sin publicarse
// como RFC). El revisor lo usa como un patrón que su API documenta, con los códigos que propone
// el borrador: 422 si la llave se reutiliza con otra petición, 409 si la original sigue en curso.
import { createHash } from "node:crypto";

export type Grabada = { codigo: number; cabeceras: Record<string, string>; cuerpo: unknown };

type Registro = { huella: string; grabada: Grabada | null };

// Por credencial y llave. Una API real las guarda en su base y las borra tras un plazo (p. ej. 24 h).
const registros = new Map<string, Registro>();

export function huella(datos: unknown): string {
  return createHash("sha256").update(JSON.stringify(datos)).digest("hex");
}

export type Turno =
  | { tipo: "nueva" }
  | { tipo: "repetir"; grabada: Grabada }
  | { tipo: "otra-peticion" }
  | { tipo: "en-curso" };

// Decide qué hacer con una llave. Si es nueva, la aparta (en curso) hasta que se grabe la respuesta.
export function tomarTurno(credencial: string, llave: string, huellaPeticion: string): Turno {
  const id = `${credencial}:${llave}`;
  const registro = registros.get(id);
  if (registro === undefined) {
    registros.set(id, { huella: huellaPeticion, grabada: null });
    return { tipo: "nueva" };
  }
  if (registro.huella !== huellaPeticion) return { tipo: "otra-peticion" };
  if (registro.grabada === null) return { tipo: "en-curso" };
  return { tipo: "repetir", grabada: registro.grabada };
}

export function grabar(credencial: string, llave: string, grabada: Grabada): void {
  const registro = registros.get(`${credencial}:${llave}`);
  if (registro !== undefined) registro.grabada = grabada;
}

// Si la operación falla sin crear nada, la llave se libera para que el reintento pueda intentarlo.
export function soltar(credencial: string, llave: string): void {
  registros.delete(`${credencial}:${llave}`);
}
```

```ts
// fig08_01/laboratorio.ts
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
// fig08_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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

```ts
// fig08_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
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

```ts
// fig08_01/pasarela.ts — una pasarela delante del revisor (18082 → 18080) que puede perder respuestas.
// Con la cabecera «X-Simular: perder-primera», la primera vez que ve una petición (por su
// Idempotency-Key o, si no trae, por su cuerpo) la deja pasar,
// recibe la respuesta del revisor y la tira: al cliente le contesta 502.
// Así se ve el caso que la lección 6 enseña: la escritura ocurrió, pero el cliente no lo sabe.
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PUERTO = 18082;
const DESTINO = "http://127.0.0.1:18080";
const PASAN = ["authorization", "content-type", "idempotency-key", "if-match", "if-none-match"];
const VUELVEN = ["content-type", "content-length", "content-language", "location", "etag", "retry-after", "allow", "www-authenticate"];
const vistas = new Set<string>();

async function leer(peticion: IncomingMessage): Promise<Buffer> {
  const trozos: Buffer[] = [];
  for await (const trozo of peticion) trozos.push(trozo as Buffer);
  return Buffer.concat(trozos);
}

function malaPuerta(respuesta: ServerResponse, detail: string): void {
  const problema = JSON.stringify({ type: "about:blank", title: "Bad Gateway", status: 502, detail }) + "\n";
  respuesta.writeHead(502, { "Content-Type": "application/problem+json", "Content-Length": String(Buffer.byteLength(problema)) });
  respuesta.end(problema);
}

// Si el revisor no responde (apagado, conexión cortada), fetch rechaza la promesa. Sin este catch
// nadie la esperaba y Node tumbaba la pasarela; ahora responde 502 y sigue escuchando.
async function pasarSinCaerse(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await pasar(peticion, respuesta);
  } catch {
    console.log("pasarela: el revisor no respondió");
    if (!respuesta.headersSent) malaPuerta(respuesta, "la pasarela no recibió respuesta del revisor");
    else respuesta.destroy();
  }
}

async function pasar(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  const cabeceras: Record<string, string> = {};
  for (const nombre of PASAN) {
    const valor = peticion.headers[nombre];
    if (typeof valor === "string") cabeceras[nombre] = valor;
  }
  const cuerpo = await leer(peticion);
  const delRevisor = await fetch(DESTINO + (peticion.url ?? "/"), {
    method: peticion.method,
    headers: cabeceras,
    body: cuerpo.length > 0 ? new Uint8Array(cuerpo) : undefined,
    redirect: "manual",
  });
  const texto = await delRevisor.text();

  const llave = cabeceras["idempotency-key"] ?? createHash("sha256").update(cuerpo).digest("hex");
  if (peticion.headers["x-simular"] === "perder-primera" && !vistas.has(llave)) {
    vistas.add(llave);
    console.log(`pasarela: el revisor respondió ${delRevisor.status}, pero la respuesta se pierde`);
    malaPuerta(respuesta, "la pasarela no recibió una respuesta completa del revisor");
    return;
  }
  const vuelven: Record<string, string> = {};
  for (const nombre of VUELVEN) {
    const valor = delRevisor.headers.get(nombre);
    if (valor !== null) vuelven[nombre] = valor;
  }
  respuesta.writeHead(delRevisor.status, vuelven);
  respuesta.end(texto);
}

createServer((peticion, respuesta) => void pasarSinCaerse(peticion, respuesta)).listen(PUERTO, "127.0.0.1", () => {
  console.log(`pasarela en http://127.0.0.1:${PUERTO} → ${DESTINO}`);
});
```

```ts
// fig08_01/por-type.ts — el mismo código, dos decisiones: lo que agrega el type de un Problem Details.
// Uso: con laboratorio.ts y servidor.ts corriendo, node por-type.ts
import { decidir, typeDe } from "./decisiones.ts";

async function alta(nombre: string, url: string, llave: string): Promise<Response> {
  return fetch("http://127.0.0.1:18080/servicios", {
    method: "POST",
    headers: { "Authorization": "Bearer escritura-a", "Content-Type": "application/json", "Idempotency-Key": llave },
    body: JSON.stringify({ nombre, url }),
  });
}

// Dos altas con la misma llave al mismo tiempo (409 llave-en-curso), y un nombre repetido (409 nombre-repetido).
const [primera, segunda] = await Promise.all([
  alta("correo", "http://127.0.0.1:18081/codigo/200", "llave-1"),
  new Promise<Response>((listo) => setTimeout(() => listo(alta("correo", "http://127.0.0.1:18081/codigo/200", "llave-1")), 100)),
]);
await primera.text();
const repetido = await alta("pagos", "http://127.0.0.1:18081/codigo/200", "llave-2");

for (const respuesta of [segunda, repetido]) {
  const type = typeDe(respuesta.headers.get("content-type"), await respuesta.text());
  const soloCodigo = decidir(respuesta.status, null, null);
  const conType = decidir(respuesta.status, null, type);
  console.log(`${respuesta.status} ${type}`);
  console.log(`  solo con el código: ${soloCodigo.accion} (${soloCodigo.motivo})`);
  console.log(`  con el type:        ${conType.accion} (${conType.motivo})`);
}
```

```ts
// fig08_01/problemas.ts — el manejador central de errores: cada error sale como Problem Details (RFC 9457).
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
  "llave-en-curso": { type: BASE + "llave-en-curso", title: "Esa Idempotency-Key sigue en curso", status: 409 },
  "llave-reutilizada": { type: BASE + "llave-reutilizada", title: "Esa Idempotency-Key ya se usó con otra petición", status: 422 },
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

```ts
// fig08_01/revisar.ts — el revisor como cliente, de punta a punta: pide su lista a la API, consulta cada
// servicio y dice qué hacer con lo que respondió.
// Uso: con laboratorio.ts y servidor.ts corriendo, node revisar.ts [credencial]
import { consultar, segundosDeEspera } from "./cliente.ts";
import { decidir, decidirSinRespuesta, typeDe, type Decision } from "./decisiones.ts";

const credencial = process.argv[2] ?? "lectura-a";
const TOPE_ESPERA_S = 5;

type Servicio = { id: number; nombre: string; url: string; limite_ms: number };

// 1. La lista. Si la API responde un error, se decide por su type, no por su texto.
async function pedirLista(): Promise<Servicio[] | undefined> {
  for (let intento = 1; intento <= 2; intento++) {
    const respuesta = await fetch("http://127.0.0.1:18080/servicios", {
      headers: { Authorization: `Bearer ${credencial}` },
    });
    const cuerpo = await respuesta.text();
    if (respuesta.ok) return (JSON.parse(cuerpo) as { servicios: Servicio[] }).servicios;
    const type = typeDe(respuesta.headers.get("content-type"), cuerpo);
    const decision = decidir(respuesta.status, segundosDeEspera(respuesta.headers.get("retry-after")), type);
    console.log(`la API respondió ${respuesta.status} (${type}): ${decision.accion}, ${decision.motivo}`);
    if (decision.accion !== "esperar" || decision.esperaS === null) return undefined;
    if (decision.esperaS > TOPE_ESPERA_S) {
      console.log(`  pide esperar ${decision.esperaS} s, más que el tope de ${TOPE_ESPERA_S} s: lo intento más tarde`);
      return undefined;
    }
    console.log(`  espero ${decision.esperaS} s y vuelvo a pedir`);
    await new Promise((listo) => setTimeout(listo, (decision.esperaS ?? 0) * 1000));
  }
  return undefined;
}

const servicios = await pedirLista();
if (servicios === undefined) process.exit(1);

// 2. Cada servicio: qué respondió y qué toca hacer.
console.log("SERVICIO     RESPUESTA          ACCIÓN        MOTIVO");
for (const servicio of servicios) {
  const consulta = await consultar(servicio.url, servicio.limite_ms);
  let respuesta: string;
  let decision: Decision;
  if (consulta.tipo === "respuesta") {
    respuesta = `${consulta.codigo} en ${consulta.ms} ms`;
    decision = decidir(consulta.codigo, consulta.reintentarEn, null);
  } else {
    respuesta = consulta.tipo;
    decision = decidirSinRespuesta(consulta.tipo);
  }
  console.log(`${servicio.nombre.padEnd(13)}${respuesta.padEnd(19)}${decision.accion.padEnd(14)}${decision.motivo}`);
}
```

```ts
// fig08_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
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

```ts
// fig08_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarPorNombre, buscarRevision, buscarServicio, cambiarServicio, crearRevision, crearServicio,
  equipoDeRetirado, etiqueta, listarServicios, retirarServicio, terminarRevision,
  revisionesDe, type Revision, type Servicio,
} from "./almacen.ts";
import type { Credencial } from "./autenticacion.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, coincideFuerte, hayCoincidencia, interpretarLista } from "./etiquetas.ts";
import { consultar as consultarAhora, revisarConReintentos } from "./cliente.ts";
import { grabar, huella, soltar, tomarTurno } from "./idempotencia.ts";
import { setTimeout as esperar } from "node:timers/promises";
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
// Guardar un alta «tarda»: así se ve qué pasa si llega un reintento mientras la original sigue en curso.
const GUARDAR_MS = 500;
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
  else if (typeof url === "string" && urlConSecretos(url)) fallas.push({ campo: "url", detalle: "no puede llevar usuario, clave, consulta (?) ni fragmento (#)" });
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

  // Con Idempotency-Key, la misma petición repetida recibe la misma respuesta y no crea otro servicio.
  const cabecera = peticion.headers["idempotency-key"];
  const llave = typeof cabecera === "string" && cabecera !== "" ? cabecera : undefined;
  if (llave !== undefined) {
    const turno = tomarTurno(credencial.nombre, llave, huella(datos));
    if (turno.tipo === "repetir") {
      console.log(`idempotencia: la llave ${llave} ya se atendió; repito su respuesta`);
      enviarJson(respuesta, turno.grabada.codigo, turno.grabada.cuerpo, turno.grabada.cabeceras);
      return;
    }
    if (turno.tipo === "otra-peticion") {
      fallar(respuesta, "llave-reutilizada", `la llave ${llave} ya se usó con un cuerpo distinto`);
      return;
    }
    if (turno.tipo === "en-curso") {
      fallar(respuesta, "llave-en-curso", `la petición original con la llave ${llave} todavía no termina`);
      return;
    }
  }

  const validos = validar(datos);
  if (Array.isArray(validos)) {
    if (llave !== undefined) soltar(credencial.nombre, llave);
    rechazarDatos(respuesta, validos);
    return;
  }
  if (!(await destinoPermitido(validos.url, respuesta))) {
    if (llave !== undefined) soltar(credencial.nombre, llave);
    return;
  }
  await esperar(GUARDAR_MS);
  const existente = buscarPorNombre(credencial.equipo, validos.nombre);
  if (existente !== undefined) {
    if (llave !== undefined) soltar(credencial.nombre, llave);
    fallar(respuesta, "nombre-repetido", `ya existe un servicio llamado ${validos.nombre}`, {
      extensiones: { existente: `/servicios/${existente.id}` },
    });
    return;
  }
  const servicio = crearServicio({ ...validos, equipo: credencial.equipo });
  const grabada = {
    codigo: 201,
    cabeceras: { Location: `/servicios/${servicio.id}`, ETag: etiqueta(servicio) },
    cuerpo: representar(servicio),
  };
  if (llave !== undefined) grabar(credencial.nombre, llave, grabada);
  enviarJson(respuesta, grabada.codigo, grabada.cuerpo, grabada.cabeceras);
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
    terminarRevision(revision.id, await revisarConReintentos(servicio.url, servicio.limiteMs));
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

```ts
// fig08_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

```ts
// fig08_01/tabla23.ts — la tabla de decisión aplicada a los 23 códigos del curso, contra el laboratorio.
// Uso: con laboratorio.ts corriendo, node tabla23.ts
import { segundosDeEspera } from "./cliente.ts";
import { decidir, typeDe } from "./decisiones.ts";

const CODIGOS = [200, 201, 202, 204, 301, 304, 308, 400, 401, 403, 404, 405, 409, 410, 412, 415, 422, 428, 429, 500, 502, 503, 504];

console.log("CÓDIGO  ACCIÓN        REINTENTA  ESPERA  MOTIVO");
for (const codigo of CODIGOS) {
  const respuesta = await fetch(`http://127.0.0.1:18081/codigo/${codigo}`, { redirect: "manual" });
  const cuerpo = await respuesta.text();
  const decision = decidir(
    respuesta.status,
    segundosDeEspera(respuesta.headers.get("retry-after")),
    typeDe(respuesta.headers.get("content-type"), cuerpo),
  );
  const espera = decision.esperaS === null ? "—" : `${decision.esperaS} s`;
  console.log(
    `${String(respuesta.status).padEnd(8)}${decision.accion.padEnd(14)}${(decision.reintenta ? "sí" : "no").padEnd(11)}${espera.padEnd(8)}${decision.motivo}`,
  );
}
```

```ts
// fig08_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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


### 8.16 Revisar los tipos con `tsc` (opcional)

Desde la carpeta del `revisor`, con el comando de la sección 0.9 de la Lección 0 más `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Los programas sueltos de esta lección (`fig08_02.ts`, `fig08_04.ts`, `fig08_05.ts`, `fig08_06.ts` y `fig08_07.ts`, y las variantes de `ejercicios/`) se revisan igual desde la carpeta que los contiene, apuntando al `tsc` que instalaste en `fig08_01/`.

## El error que vas a ver

### La matriz que se ajustó al defecto

El error más tentador con una verificación que se pone roja es arreglarla en el lugar equivocado. Es martes, la matriz está roja en 17 renglones, hay prisa, y alguien abre `matriz23.ts` en lugar de `problemas.ts`: «ya no exigimos `Retry-After`», «aceptamos `application/json` donde se esperaba `application/problem+json`». Dos líneas, y la matriz vuelve a verde. Es una versión copiada de `matriz23.ts` con exactamente esos dos cambios (en tres lugares, porque la comprobación del `429` por credencial también pregunta por `Retry-After`) la que está en `defectos/matriz-bendice/`. Cópiala sobre la carpeta `rota/` de la sección 8.10.1 (la del servidor «limpiado») y córrela:

```text
$ node matriz23.ts   # la matriz «arreglada», contra el servidor con el defecto
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 0)
```

Verde. **41 de 41** y código de salida `0`, contra el mismo servidor que hace un momento puso la matriz en 17 renglones rojos. El servidor no cambió; cambió la vara. Es lo que el curso llama una prueba que **bendice el defecto**: pasa, y lo que pasa es el error.

Esto es peor que una prueba que falla, por una razón concreta: una prueba roja llama la atención de alguien, y una verde la quita. A partir de ese momento, el tablero dice «todo bien», y los integradores de la escena del principio vuelven a recibir `application/json`. El defecto ya no tiene quien lo vigile.

Tres hábitos lo evitan, y los tres son baratos:

- **Un cambio en lo que la prueba espera es un cambio de promesa.** Se revisa como se revisa un cambio en la API: ¿quién se enteró?, ¿el documento dice lo mismo? Aquí, el `openapi.json` sigue diciendo `application/problem+json`; la matriz ajustada ya no coincide con el documento, y esa discrepancia debería ser lo primero que alguien note.
- **Antes de aflojar una prueba, pregunta cuál de los tres miente.** El servidor, el documento o la prueba. En 17 renglones rojos con casi la misma frase, lo más probable es que haya cambiado una cosa en el servidor, no 17 cosas en la prueba.
- **Revierte y comprueba que se pone roja.** Es la regla de toda la lección: una prueba que no se vio fallar contra el defecto no demuestra nada. Aquí, correr la matriz **original** contra el servidor con el defecto da rojo; correr la ajustada, verde. La diferencia entre las dos es toda la información.

### El servidor que se quedó abierto

El segundo error no es de diseño, es de olvido, y tiene consecuencias sutiles. La matriz levanta su propio `revisor` en el puerto 18080. Pero si ya hay uno escuchando ahí (un `revisor` de una lección anterior, o la copia `rota/` de la sección 8.10 que no apagaste), el programa nuevo no puede ocupar el puerto, y no hay quien lo diga: los hijos se levantan con `stdio: "ignore"`. La versión de la matriz que no se defendía de esto seguía adelante midiendo al servidor viejo. La de la lección se defiende: antes de levantar nada, comprueba los tres puertos. Para verlo, deja corriendo en una terminal el servidor de la copia `rota/`, el «limpiado», y desde otra corre la matriz **de `fig08_01/`**, la buena; después, la versión anterior de la matriz (`defectos/espera-fija/matriz23.ts`, que no tiene la puerta):

```text
$ cd rota && node servidor.ts &      # un revisor con el defecto, que se te olvidó apagar
$ cd ../fig08_01 && node matriz23.ts
puerto 18080 ocupado; apaga lo que lo usa
(código de salida: 2)

$ cd ../espera-fija && node matriz23.ts | grep -v "^ok"   # la matriz anterior, sin la puerta
FALLA 400 cuerpo ilegible: tipo application/json, se esperaba application/problem+json
FALLA 401 sin credencial: tipo application/json, se esperaba application/problem+json
FALLA 403 lectura que intenta escribir: tipo application/json, se esperaba application/problem+json
FALLA 404 servicio que no existe: tipo application/json, se esperaba application/problem+json
FALLA 405 método no admitido: tipo application/json, se esperaba application/problem+json
FALLA 409 nombre repetido: tipo application/json, se esperaba application/problem+json
FALLA 410 servicio retirado: tipo application/json, se esperaba application/problem+json
FALLA 412 etiqueta vencida: tipo application/json, se esperaba application/problem+json
FALLA 415 formato no admitido: tipo application/json, se esperaba application/problem+json
FALLA 422 datos imposibles: tipo application/json, se esperaba application/problem+json
FALLA 428 cambio sin If-Match: tipo application/json, se esperaba application/problem+json
FALLA 429 demasiadas revisiones: falta retry-after; tipo application/json, se esperaba application/problem+json
FALLA 500 el defecto a propósito: tipo application/json, se esperaba application/problem+json
FALLA 502 el servicio responde basura: tipo application/json, se esperaba application/problem+json
FALLA 503 mantenimiento: falta retry-after; tipo application/json, se esperaba application/problem+json
FALLA 504 el servicio no responde a tiempo: tipo application/json, se esperaba application/problem+json
ESTADO: la matriz seguía esperando a los 60 s; se detuvo por su PID
```

Cuando termines, apaga el servidor de `rota/` por su PID (`kill %1` si lo lanzaste en esa misma terminal con `&`) y comprueba con el comando de abajo que los puertos quedaron libres. La primera matriz se niega a medir: dice qué puerto está ocupado y sale con `2`, que es un código distinto del `1` de «algo falló». La segunda muestra lo que pasaba antes. La carpeta `fig08_01` no tiene el defecto, pero la matriz anterior muestra los mismos dieciséis renglones rojos de los escenarios de la sección 8.10.1. Quien la leyera sin saber lo del servidor abierto iba a buscar el error en el código equivocado: la matriz no midió su propio `revisor`, midió el que ya estaba.

Y fíjate en cómo terminaba, porque era la segunda mitad del problema: **no imprimía el resumen**. La última línea de la salida de arriba («ESTADO: …») no la escribió la matriz sino el guion que la corrió para esta lección: la matriz se quedó esperando, sin decir nada, y a los 60 segundos se la detuvo por su PID. Se quedaba esperando porque una de sus comprobaciones adicionales apaga «su» `revisor` para probar la pasarela, y espera el aviso de que terminó; ese `revisor` nunca llegó a existir, así que el aviso no llegaba. Un programa que se queda mudo ante un puerto ocupado, en lugar de decir «el puerto 18080 está ocupado», es un defecto, y por eso la matriz de la lección trae la puerta que `fig08_03.sh` ya tenía (sección 8.9). Lo que no cambia es la regla de fondo, la que el curso viene repitiendo desde la Lección 0: `127.0.0.1:18080` no dice qué hay detrás, solo que algo contestó. Si escribes tu propio programa que levanta procesos, hazle la misma puerta, y si lo corres a mano, comprueba antes que los puertos estén libres:

```bash
for p in 18080 18081 18082; do (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null && echo "ocupado: $p"; done
```

Si el comando no imprime nada, los tres puertos están libres.

## Lo que se hace mal

**Documentar de memoria.** Un documento escrito de lo que uno cree que hace la API termina describiendo la API que uno imaginó. Se escribe mirando las respuestas reales, y después se comprueba con la matriz.

**Documentar solo el camino feliz.** Un documento con los éxitos y sin los errores le deja al cliente la mitad del trabajo: tiene que descubrir los `4xx` y los `5xx` por prueba y error. Los errores se documentan con la misma precisión que los éxitos, con su tipo de contenido y sus cabeceras.

**Escribir la misma respuesta de error en cada operación.** Se desincroniza en cuanto alguien corrige una y no las otras. Las respuestas de error se escriben una vez en `components` y se reutilizan con `$ref`.

**Poner el tipo de contenido como cabecera.** Un `Content-Type` en `headers` se ignora; el tipo va como llave de `content`.

**Confundir `info.version` con la versión de la API.** Es la versión del documento. Si hace falta decir cuál es la API vigente y cuáles están retiradas, se escribe en la descripción y se marca `deprecated` en las rutas.

**Dar por bueno un documento porque el validador dice «válido».** El validador contesta si está bien escrito, no si es cierto (sección 8.11).

**Probar solo los códigos.** Es la escena del principio. El código es lo más fácil de probar y lo único que comprobaban las pruebas de esa mañana.

**Aflojar una prueba para ponerla en verde.** Una prueba que se ajusta al defecto pasa, y lo que pasa es el defecto (sección «La matriz que se ajustó al defecto»).

**Medir al servidor equivocado.** Un puerto ocupado por un programa viejo deja a un programa midiendo lo que no es suyo; por eso la matriz comprueba los puertos antes de arrancar y sale con `2` si alguno responde (sección «El servidor que se quedó abierto»).

**Reintentar una prueba hasta que pase.** Una comprobación que falla a veces tiene una causa. Entenderla (sección 8.14.1) es más barato que desconfiar de todas las demás.

**Validar el destino y dejar que otro resuelva el nombre.** Son dos resoluciones y entre una y otra el nombre puede cambiar de dueño. La dirección que se valida es la dirección a la que se conecta.

**Confiar en que el documento ahuyenta a quien no debería leerlo.** Un documento OpenAPI casi siempre se publica. Lo que no puede estar en él (nombres de máquinas internas, direcciones privadas, ejemplos con datos reales) no se escribe, ni siquiera como ejemplo.

## Ejercicios

Los seis se corrigen solos: cada uno termina con una corrida que te dice si acertaste (en el 5 y el 6, con un control que falla a propósito). Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada. Para los ejercicios 1 a 3 necesitas la carpeta `fig08_01/` y los puertos 18080, 18081 y 18082 libres (el tercero lo usa la pasarela de una de las comprobaciones adicionales); para el 4, el 18081 y el `::1`.

### Ejercicio 1 — Cierra el hueco del catálogo

La sección 8.5 encontró que `fig08_02.ts` marca un hueco: el documento no menciona el `type` `revision-inexistente`, y la ruta `GET /revisiones/{id}` lo devuelve. Corrige una **copia** de `openapi.json`: agrega una respuesta reutilizable para el `404` de esa ruta, nómbrala como quieras, y haz que la operación apunte a ella. Para saber si acertaste, corre los tres comprobadores con tu copia: `fig08_02.ts` tiene que decir «0 con un hueco en el documento»; `matriz23.ts` tiene que seguir en 41 de 41; y `redocly lint` tiene que seguir diciendo «valid». Predice antes: ¿cuántas advertencias va a dar el validador, más, menos o las mismas?

### Ejercicio 2 — Haz que la matriz vea `detail` e `instance`

La sección 8.14 dijo que la matriz solo comprueba tres de los cinco miembros de un Problem Details. Agrega dos líneas a `comprobar` para que también pida `detail` e `instance` como texto, en todos los errores. Predice: con tu matriz ampliada, ¿cuántos renglones rojos da el `revisor` bueno? Después, copia `ejercicios/ej2/defecto-sin-instance/problemas.ts` sobre una copia de `fig08_01/` (es un servidor al que se le olvidó `instance`) y predice dos cosas: cuántos renglones rojos da la matriz **original** contra ese servidor, y cuántos da la tuya.

### Ejercicio 3 — Quita el `405` del documento

Esta fue la idea de la sección 8.4.4. En una copia de `openapi.json`, borra la respuesta `405` de `GET /servicios/{id}` y corre la matriz. Predice: ¿cuántos renglones rojos?, ¿cuál es el mensaje exacto? Después corre `redocly lint` sobre el mismo documento: ¿el validador lo detecta?

### Ejercicio 4 — ¿Qué `Host` recibe el servidor?

La sección 8.12.3 dijo que el cliente se conecta a la dirección ya validada, pero que la cabecera `Host` conserva el nombre. Modifica `fig08_04.ts` para que el «laboratorio» imprima el `Host` que recibió cada petición. Predice: cuando corras la versión con `fetch`, ¿el servidor que contesta imprime algo?, ¿y cuando corras la de la lección? ¿Qué valor tiene `Host` en ese caso?

### Ejercicio 5 — Reproduce la carrera y los dos cierres

La sección 8.14.1 contó una carrera, un primer arreglo con su límite y el cierre en etapas. Reprodúcelos tú. Copia `fig08_01/` a una carpeta `viejo/`, reemplaza `respuestas.ts` por `defectos/cierre-brusco/respuestas.ts`, arranca el `revisor` de `viejo/` y corre `fig08_05.ts` tres veces. Predice primero: ¿el número de respuestas `413` va a ser el mismo en las tres?, ¿cuál va a ser la causa de las que no reciben respuesta? Después detén ese `revisor`, repite con `defectos/drenar-antes/respuestas.ts` y corre `node fig08_05.ts 100 3000` (3 MB por intento): predice cuántos de los 100 reciben su `413`. Por último repite esos 3 MB contra el `revisor` de `fig08_01/` tal como está. Detén cada `revisor` por su PID antes de arrancar el siguiente. Contesta con argumentos: ¿por qué el primer arreglo falla por encima de 1 MiB y el segundo no? ¿Qué se sigue pagando en el segundo? ¿Qué pasaría si una versión de Node dejara de llamar a `socket.destroySoon()` al cerrar?
### Ejercicio 6 — Cierra la espera fija

La sección 8.14.1 terminó con una fragilidad que la matriz de la lección ya no tiene: esperar un tiempo fijo después de levantar cada proceso. Aquí la arreglas tú, partiendo de la versión que sí la tiene: `defectos/espera-fija/matriz23.ts`. Primero mide el margen con `fig08_06.ts`, que levanta la pasarela 100 veces y dice cuánto tarda en contestar. Después copia `fig08_01/` a una carpeta `mia/`, pon ahí `defectos/espera-fija/matriz23.ts` y cámbiala para que, en lugar de esperar un tiempo, espere a que el puerto acepte conexiones (y falle con un mensaje si no lo hace). Para saber si acertaste, corre `ejercicios/ej6/arranque-lento.sh` sobre una carpeta con esa matriz: retrasa 700 ms el arranque del `revisor` y de la pasarela. Predice antes: ¿cuántas comprobaciones pasan con la espera fija y cuántas con la tuya?, ¿cuánto crees que tarda la pasarela en contestar, en el peor de los 100 arranques? Por último, corre tu matriz ocho veces seguidas con la máquina saturada (por ejemplo, con el doble de programas `node -e 'while(true){}'` que núcleos tiene tu CPU, que detienes por su PID al terminar).

## Soluciones

### Solución 1

La solución está en `ejercicios/ej1/openapi.json`. Agrega una respuesta `E404Revision` junto a `E404`, con la descripción «La revisión no existe (type revision-inexistente).» y el mismo contenido, y hace que `GET /revisiones/{id}` apunte a ella:

```json
      "E404Revision": {
        "description": "La revisión no existe (type revision-inexistente).",
        "content": {
          "application/problem+json": {
            "schema": {
              "$ref": "#/components/schemas/Problema"
            }
          }
        }
      },
```

Las tres corridas, con ese documento:

```text
$ node fig08_02.ts   # con el openapi.json del ejercicio 1
servicio-lento            504     servicio-lento        sí                        sí

24 tipos en el catálogo; 0 con un hueco en el documento

$ node matriz23.ts   # con el mismo openapi.json
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).

$ npx redocly lint openapi.json --format=stylish   # con el mismo openapi.json
Woohoo! Your API description is valid. 🎉
You have 26 warnings.
```

`fig08_02.ts` pasa de un hueco a **cero huecos**; la matriz sigue en 41 de 41, porque el cambio no quita nada que la matriz busque; y el validador sigue diciendo «valid» con **las mismas 26 advertencias**: se agregó una respuesta que sí se usa, así que no hay componentes sin usar ni operaciones nuevas. Si predijiste más advertencias, probablemente pensaste que toda adición suma ruido; aquí no suma, porque el validador solo cuenta lo que no está completo.

### Solución 2

Las dos líneas están en `ejercicios/ej2/matriz23.ts`, justo debajo de la que pide `title`:

```ts
      if (typeof cuerpo.title !== "string") fallas.push("falta title");
      if (typeof cuerpo.detail !== "string") fallas.push("falta detail");
      if (typeof cuerpo.instance !== "string") fallas.push("falta instance");
```

Dos líneas que ahora piden `detail` e `instance` como texto. Las tres corridas:

```text
$ node matriz23.ts   # la matriz de siempre, contra el servidor al que le falta instance
FALLA 500 el defecto a propósito: instance no es urn:uuid

40 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 1)

$ node matriz23.ts   # la matriz ampliada, contra el servidor bueno

41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).

$ node matriz23.ts   # la matriz ampliada, contra el servidor al que le falta instance
FALLA 400 cuerpo ilegible: falta instance
FALLA 401 sin credencial: falta instance
FALLA 403 lectura que intenta escribir: falta instance
FALLA 404 servicio que no existe: falta instance
FALLA 405 método no admitido: falta instance
FALLA 409 nombre repetido: falta instance
FALLA 410 servicio retirado: falta instance
FALLA 412 etiqueta vencida: falta instance
FALLA 415 formato no admitido: falta instance
FALLA 422 datos imposibles: falta instance
FALLA 428 cambio sin If-Match: falta instance
FALLA 429 demasiadas revisiones: falta instance
FALLA 500 el defecto a propósito: falta instance; instance no es urn:uuid
FALLA 502 el servicio responde basura: falta instance
FALLA 503 mantenimiento: falta instance
FALLA 504 el servicio no responde a tiempo: falta instance

25 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
```

La primera corrida es la importante: **la matriz original, contra un servidor al que le falta `instance` en todos sus errores, da 40 de 41**. El único renglón rojo es el del `500`, porque ese escenario ya pedía que `instance` fuera un `urn:uuid`; los otros 15 errores con el defecto pasaron. Eso es lo que significa «la prueba no mira lo que no mira». La segunda corrida confirma que la matriz ampliada sigue en 41 de 41 con el servidor bueno (nada de lo que se agregó rompe lo que ya funcionaba). La tercera es el control positivo: contra el servidor con el defecto, la matriz ampliada marca los **16 escenarios de error**, uno por cada error, hasta quedar en 25 de 41. Es la lección de la sección 8.10 aplicada a una prueba tuya: ampliaste una vara y la viste morder.

Si tu predicción de la tercera fue distinta, cuenta los escenarios que son errores: dieciséis de los 23 códigos lo son (del `400` al `504`), y las comprobaciones adicionales no pasan por `comprobar`, así que no se contagian.

### Solución 3

El documento sin el `405` se construye con una línea de Node sobre una copia:

```bash
node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("openapi.json","utf8")); delete d.paths["/servicios/{id}"].get.responses["405"]; fs.writeFileSync("openapi.json", JSON.stringify(d,null,2)+"\n");'
```

Se corre dentro de la carpeta de la copia, y después la matriz y el validador:

```text
$ node matriz23.ts   # sin el 405 de GET /servicios/{id} en el documento
FALLA 405 método no admitido: openapi.json no documenta 405 en GET /servicios/{id}

40 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).

$ npx redocly lint openapi.json --format=stylish   # el mismo documento
Woohoo! Your API description is valid. 🎉
You have 26 warnings.
```

Un renglón rojo en la matriz, con el mensaje exacto de la sección 8.6.3: `openapi.json no documenta 405 en GET /servicios/{id}`. Y el validador, que mira el documento sin saber nada del servidor, lo da por válido: no hay ninguna regla que diga «una operación tiene que declarar un `405`». Es la tabla de 8.11.3 en una línea. Si en la corrida de la matriz aparece un segundo renglón rojo (la comprobación del cuerpo por partes), es la carrera de la sección 8.14.1 y no tiene que ver con tu cambio.

### Solución 4

La variante está en `ejercicios/ej4/fig08_04.ts`. Cambia una sola cosa, el «laboratorio»:

```ts
const laboratorio = createServer((p, r) => {
  console.log(`  el laboratorio recibió Host: ${p.headers.host ?? "(ninguno)"}`);
  r.writeHead(200);
  r.end();
});
```

Y la corrida, con la versión de la lección:

```text
$ node fig08_04.ts fig08_01   # la variante del ejercicio 4
$ consultar("http://rebote.ejemplo:18081/")   con el cliente de fig08_01
  pregunta 1 al DNS: rebote.ejemplo -> 127.0.0.1
  el laboratorio recibió Host: rebote.ejemplo:18081
{"tipo":"respuesta","codigo":200,"ms":4,"reintentarEn":null}
el DNS fue preguntado 1 vez
```

El laboratorio recibió `Host: rebote.ejemplo:18081`: el nombre de la URL, con su puerto, aunque la conexión haya ido a `127.0.0.1`. Es lo que hace la opción `lookup`: decide **a dónde** conectarse y no toca **qué se dice** una vez conectado. Con el cliente de `fetch` (`con-fetch`) el laboratorio no imprime nada, porque la conexión no llegó a él: llegó al servidor de `299`, que no imprime. Si predijiste que el `Host` sería `127.0.0.1:18081`, pensaste que quien se conecta a una IP la usa también como nombre; así funciona una petición escrita a mano con la IP en la URL, y por eso el cliente de la lección no escribe la IP en la URL.

### Solución 5

Las cifras están en cuatro archivos: `defectos/cierre-brusco.salida.txt` (el cierre brusco), `defectos/drenar-antes.salida.txt` (tirar el cuerpo antes de responder), `fig08_05.salida.txt` y `fig08_05.limite.salida.txt` (el cierre en etapas). El cierre brusco:

```text
$ node fig08_05.ts   # contra el revisor con defectos/cierre-brusco/respuestas.ts
  382  respuesta 413
    4  sin respuesta: ECONNRESET
   14  sin respuesta: EPIPE
400 intentos

$ for i in 1 2 3 4 5; do printf "corrida $i:"; node fig08_05.ts | grep "respuesta 413"; done
corrida 1:  356  respuesta 413
corrida 2:  358  respuesta 413
corrida 3:  357  respuesta 413
corrida 4:  363  respuesta 413
corrida 5:  346  respuesta 413
```

Con el código brusco, el número de `413` cambia de una corrida a otra (la carrera depende de cómo se reparte el tiempo entre el cierre del servidor y la escritura del cliente) y no llega a 400 en ninguna; las que faltan terminan en `EPIPE`, con algunos `ECONNRESET`. El primer arreglo, con 400 intentos de 20 KB y después con cuerpos más grandes:

```text
$ node fig08_05.ts   # contra el revisor con defectos/drenar-antes/respuestas.ts
  400  respuesta 413
400 intentos

$ for i in 1 2 3 4 5; do printf "corrida $i:"; node fig08_05.ts | grep "respuesta 413"; done
corrida 1:  400  respuesta 413
corrida 2:  400  respuesta 413
corrida 3:  400  respuesta 413
corrida 4:  400  respuesta 413
corrida 5:  400  respuesta 413
$ node fig08_05.ts 100 1000
  100  respuesta 413
100 intentos
$ node fig08_05.ts 100 1100
    8  respuesta 413
   19  sin respuesta: ECONNRESET
   73  sin respuesta: EPIPE
100 intentos
$ node fig08_05.ts 100 3000
   23  sin respuesta: ECONNRESET
   77  sin respuesta: EPIPE
100 intentos
```

Hasta 1 MB, 100 de 100; con 1,1 MB, 8 de 100; con 3 MB, 0 de 100. Y el cierre en etapas, con los cuerpos de siempre y con los grandes:

```text
$ node fig08_05.ts
  400  respuesta 413
400 intentos

$ for i in 1 2 3 4 5; do printf "corrida $i:"; node fig08_05.ts | grep "respuesta 413"; done
corrida 1:  400  respuesta 413
corrida 2:  400  respuesta 413
corrida 3:  400  respuesta 413
corrida 4:  400  respuesta 413
corrida 5:  400  respuesta 413
```

```text
$ node fig08_05.ts 100 1000
  100  respuesta 413
100 intentos
$ node fig08_05.ts 100 3000
  100  respuesta 413
100 intentos
$ node fig08_05.ts 100 20000
  100  respuesta 413
100 intentos
```

**400 de 400** en las seis corridas, y **100 de 100** con 1 MB, 3 MB y 20 MB.

Sobre las diferencias. El primer arreglo **lee antes de responder** y tiene un tope de 1 MiB: por encima del tope responde y cierra de golpe, así que el cliente que sigue escribiendo vuelve a recibir el RST y pierde el `413`; el tope movió la carrera, no la cerró. El segundo hace lo que el RFC 9112 describe: **responde de inmediato**, cierra solo la escritura (`socket.end()`) y sigue leyendo y tirando lo que llegue, de modo que el cliente puede leer el `413` aunque siga mandando, hasta los 2 segundos del reloj. Lo que se sigue pagando: durante esos 2 segundos el servidor lee lo que el cliente quiera mandar (ya no hay tope de bytes). Lo que depende de Node: que `http` llame a `socket.destroySoon()` al cerrar una respuesta con `Connection: close`; si dejara de hacerlo, el reemplazo no se ejecutaría y la medición bajaría de 400, que es la razón de tenerla.

### Solución 6

La solución está en la propia `fig08_01/matriz23.ts` (`ejercicios/ej6/matriz23.ts` es la misma): dos funciones al principio del archivo que reemplazan las cuatro esperas fijas que había después de levantar un proceso.

```ts
// Espera a que algo acepte conexiones en el puerto, hasta 10 s: en lugar de un tiempo fijo después de levantar un
// proceso, que con la máquina cargada se queda corto. Si el proceso que se levantó ya salió (por ejemplo, porque el
// puerto estaba ocupado), falla en seguida en vez de esperar a que conteste.
async function esperarPuerto(puerto: number, proceso?: ChildProcess): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (proceso !== undefined && proceso.exitCode !== null) throw new Error(`el proceso del puerto ${puerto} salió antes de escuchar`);
    if (await aceptaConexiones(puerto)) return;
    await esperar(100);
  }
  throw new Error(`el puerto ${puerto} no respondió en 10 s`);
}

// Levanta un programa del curso y espera a que escuche. Antes comprueba que el puerto esté libre: si ya lo ocupa
// un proceso viejo, esperarPuerto lo daría por bueno aunque el programa nuevo muriera con EADDRINUSE.
async function arrancar(archivo: string, puerto: number): Promise<ChildProcess> {
  if (await aceptaConexiones(puerto)) throw new Error(`puerto ${puerto} ocupado; apaga lo que lo usa`);
  const proceso = spawn(process.execPath, [archivo], { cwd: import.meta.dirname, stdio: "ignore" });
  await esperarPuerto(puerto, proceso);
  return proceso;
}


```

`await esperar(500)` (la pasarela) y los tres `await esperar(1000)` (el `revisor`, dos veces, y la matriz al arrancar) pasan a `arrancar("pasarela.ts", 18082)`, `arrancar("servidor.ts", 18080)` y a `esperarPuerto(18081, …)` y `esperarPuerto(18080, …)` con el puerto que corresponda; y al principio de la corrida, una puerta que sale con `2` si alguno de los tres puertos ya responde. Las mediciones, todas guardadas en `ejercicios/ej6.salida.txt` (ahí `espera-fija/` es una copia de `fig08_01/` con `defectos/espera-fija/matriz23.ts` encima, y los puertos se reescribieron como en el resto de la lección):

```text
$ node fig08_06.ts 100
n=100  mediana=60 ms  p95=95 ms  máximo=225 ms
arranques de más de 500 ms: 0   de más de 1000 ms: 0

$ # con 20 procesos que no hacen más que girar (dos por núcleo)
$ node fig08_06.ts 100
n=100  mediana=85 ms  p95=121 ms  máximo=166 ms
arranques de más de 500 ms: 0   de más de 1000 ms: 0

$ # la matriz 8 veces seguidas, con esos mismos procesos girando
$ ./fig08_08.sh 8 espera-fija
corrida 1: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 2: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 3: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 4: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 5: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 6: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 7: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 8: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
espera-fija/matriz23.ts: 0 de 8 corridas fallaron
$ ./fig08_08.sh 8 fig08_01
corrida 1: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 2: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 3: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 4: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 5: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 6: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 7: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
corrida 8: código 0; 41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
fig08_01/matriz23.ts: 0 de 8 corridas fallaron

# el control negativo: el arranque de servidor.ts y pasarela.ts retrasado 700 ms
$ ./arranque-lento.sh espera-fija   # la matriz con esperas fijas (defectos/espera-fija/)
--- espera-fija/matriz23.ts con un arranque lento de 700 ms (lo que importa de su salida):
FALLA la pasarela reenvía Content-Length; sin revisor responde 502 y sigue viva; alta-segura termina al agotar los intentos, también sin conexión: pasarela sin revisor: 0 null
40 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 1)

$ ./arranque-lento.sh fig08_01      # la matriz de la lección, con esperarPuerto
--- fig08_01/matriz23.ts con un arranque lento de 700 ms (lo que importa de su salida):
41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 0)

# y con un revisor de antes que se te olvidó apagar en el 18080
$ node -e 'require("http").createServer((q, r) => r.end("viejo")).listen(18080, "127.0.0.1")' &
$ cd ej6 && node matriz23.ts
puerto 18080 ocupado; apaga lo que lo usa
(código de salida: 2)
```

Léela con cuidado, porque lo que dice y lo que no dice importan por igual. La primera parte da el margen: cuánto tardó la pasarela en contestar en 100 arranques, y cuántos pasaron de los 500 ms que esperaba la matriz de esperas fijas (y de los 1000 que esperaba al `revisor`). La segunda repite la medición con la CPU saturada. La tercera corre las dos matrices ocho veces con esos procesos girando.

Lo que **sí** se midió: con la máquina saturada, ninguna de las dos matrices falló, y los arranques cupieron en la espera; saturar la CPU no bastó para provocar el fallo (el sistema operativo suele darle prioridad a un proceso recién creado), de modo que ese experimento no distingue las dos matrices. Lo que sí las distingue es el **control negativo**, y ese sí es reproducible: con el arranque retrasado 700 ms a propósito, la matriz de esperas fijas da `40 de 41`, con la falla `pasarela sin revisor: 0 null` que se vio durante la lección, y la matriz con `esperarPuerto` da `41 de 41`. Y si algo ya ocupa un puerto, la matriz lo dice y sale con `2` sin medir. Una salvedad: el retraso de 700 ms lo elegimos nosotros para quedar entre las dos esperas fijas (500 y 1000 ms). Que la espera por puerto aguante es razonamiento más medición; no prueba que ningún arranque, en ninguna máquina, tarde más de los 10 segundos que concede.

## Cierre del curso: cómo sabes que terminaste

El README del curso prometió cinco cosas que tu API tiene que cumplir al terminar. Con esta lección, las cinco son comprobables, y aquí está qué comprueba cada una:

| Promesa del curso | Qué la comprueba |
|---|---|
| La matriz de 23 escenarios corre con un solo comando, y cada fila comprueba código, cabeceras, tipo de contenido y cuerpo | `node matriz23.ts` (sección 8.7) |
| Ninguna respuesta de error es `200` ni HTML; todas son `application/problem+json` con un `type` estable | el tipo de contenido y el `type` de cada escenario (8.6.3) y el cruce del catálogo (8.5) |
| Ningún cuerpo de un `5xx` contiene pilas, consultas, rutas ni claves | la lista de fugas de los `5xx` (8.6.4), con las salvedades de 8.14 |
| Un `POST` repetido con la misma llave no duplica nada; con otro cuerpo, `422`; en curso, `409` | la comprobación adicional 1 (8.8) y `fig06_03.ts` de la Lección 6 |
| El `revisor` clasifica los 23 casos con una tabla y no reintenta lo que no debe | `tabla23.ts` de la Lección 7, que sigue dando lo mismo después de cambiar `cliente.ts` |

Dos advertencias de honestidad, porque este curso las ha repetido: `Idempotency-Key` y las cabeceras `RateLimit-*` siguen sin ser un estándar (el borrador de la primera venció el 18 de abril de 2026 sin publicarse como RFC; el de `RateLimit-*` sigue siendo un borrador activo de la IETF), y una matriz verde dice que **lo que la matriz mira** está bien. Lo que no mira (sección 8.14) sigue en tus manos.

## Cómo sé que lo logré

- [ ] Abres `openapi.json` y señalas sus cinco piezas: `info`, `servers`, `security`, `paths` y `components`; y explicas por qué `info.version` no es la versión de la API.
- [ ] Explicas por qué las respuestas de error se escriben una vez en `components` y se reutilizan con `$ref`, y dices cuántas referencias hay a cuántas respuestas (79 a 18).
- [ ] `node fig08_02.ts` marca un hueco (`revision-inexistente`) con el documento de la lección, y cero huecos con el del ejercicio 1.
- [ ] `node matriz23.ts` da `41 de 41` y sale con `0`; con `defectos/sin-problem-json/problemas.ts` da `24 de 41` y sale con `1`; con `defectos/sin-429-documentado/openapi.json` da `40 de 41`.
- [ ] `bash fig08_03.sh` da `23 de 23`, y explicas qué comprueba la versión con `curl` menos que la de TypeScript.
- [ ] Con Redocly CLI, el documento da «valid» con 26 advertencias, el documento roto da dos errores, y el documento sin el `429` también da «valid»; y explicas por qué.
- [ ] `node fig08_04.ts con-fetch` llega al servidor de `299` con dos preguntas al DNS, y `node fig08_04.ts fig08_01` llega al laboratorio con una; y dices por qué el certificado se sigue verificando contra el nombre.
- [ ] Explicas `Deprecation`, `Sunset` y `Link` con `rel="deprecation"`, y qué marca `deprecated: true` en el documento.
- [ ] Dices, con dos ejemplos medidos, qué no puede ver la matriz.
- [ ] `fig08_05.ts` da 400 de 400 contra `fig08_01/` y menos de 400 contra el `respuestas.ts` de `defectos/cierre-brusco/`; con 3 MB (`node fig08_05.ts 100 3000`) da 100 de 100 contra `fig08_01/` y 0 de 100 contra `defectos/drenar-antes/`; y explicas por qué lo cierra responder primero y cerrar solo la escritura.
- [ ] La matriz «ajustada» da verde contra el servidor con el defecto, y explicas por qué eso es peor que una matriz roja.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/` y `curl -i http://127.0.0.1:18081/` dan el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Cuáles son las cinco piezas de un documento OpenAPI y qué contiene cada una? ¿Qué es `info.version`?
2. ¿Para qué sirve `$ref`, y por qué las respuestas de error van en `components`?
3. ¿Qué cuatro cosas promete una respuesta, y cuáles de ellas rompió la «limpieza» del principio?
4. ¿Qué comprueba `comprobar` en cada escenario, en orden? ¿Por qué junta todas las fallas en lugar de detenerse en la primera?
5. ¿Qué es una regresión, y cuántas comprobaciones adicionales tiene la matriz?
6. ¿Qué dice un validador de OpenAPI y qué no dice? ¿Qué pregunta contesta la matriz?
7. ¿Qué es una prueba que «bendice el defecto»? ¿Cómo se evita?
8. ¿Qué es el *DNS rebinding*? ¿Por qué validar antes de cada conexión no lo cierra, y qué sí?
9. ¿Qué hace la opción `lookup` y qué no hace? ¿Por qué `soloA` contesta de dos maneras?
10. ¿Qué dicen `Deprecation`, `Sunset` y `Link` con `rel="deprecation"`, y qué marca `deprecated: true`?
11. Nombra tres cosas que la matriz no ve.
12. ¿Por qué fallaba a veces la comprobación del cuerpo por partes? ¿Cómo se midió y cómo se cerró? ¿Por qué el primer arreglo (tirar el cuerpo antes de responder) tenía un límite y el cierre en etapas no?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [OpenAPI Specification v3.1.1](https://spec.openapis.org/oas/v3.1.1.html) (24 de octubre de 2024): `info.version` como versión del documento (4.8.2.1), `servers` (4.8.1.1), el objeto de operación, `deprecated`, `security` y `operationId` (4.8.10.1), los objetos de ruta (4.8.9.1), de parámetro (4.8.12.2.1), de respuestas y de respuesta (4.8.16 y 4.8.17), de referencia (4.8.23.1), de esquema (4.8.24) y las extensiones con `x-` (4.9).
2. [Migrating from OpenAPI 3.0 to 3.1.0](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) (P. Sturgeon, 16 de febrero de 2021): la alineación con JSON Schema 2020-12 y el reemplazo de `nullable` por una lista de tipos.
3. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (julio de 2023, vía de estándares; reemplaza al RFC 7807): los miembros `type`, `title`, `status`, `detail` e `instance` (3.1), y los miembros de extensión, que quien consume debe ignorar si no los reconoce (3.2).
4. [IANA, registro de `application/problem+json`](https://www.iana.org/assignments/media-types/application/problem+json): el tipo de contenido y su referencia, el RFC 9457.
5. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html): `Allow` en el `405` (15.5.6), `Retry-After` en el `503` (15.6.4).
6. [RFC 9112, *HTTP/1.1*, sección 9.6 (*Tear-down*)](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6): el riesgo de cerrar una conexión de inmediato y el cierre por etapas.
7. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (marzo de 2025, vía de estándares): `Deprecation` como fecha de campo estructurado, la relación con `Sunset` y la relación `deprecation` de `Link`.
8. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (mayo de 2019, informativo): el formato y que las fechas son pistas.
9. [Node.js, `net.connect`](https://nodejs.org/docs/latest-v24.x/api/net.html): la opción `lookup` y `autoSelectFamily` (por omisión activada desde la versión 20).
10. [Node.js, `dns.lookup`](https://nodejs.org/docs/latest-v24.x/api/dns.html): la opción `all` y la forma del *callback* en cada caso.
11. [Node.js, `http.request`](https://nodejs.org/docs/latest-v24.x/api/http.html): las opciones `agent: false`, `lookup` y `signal`, y la mezcla de `url` y `options`.
12. [Node.js 24.14.1 «Krypton» (LTS)](https://nodejs.org/en/blog/release/v24.14.1) (24 de marzo de 2026): la versión con la que se corrieron las salidas.
13. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): *DNS rebinding* y fijar la conexión, redirecciones, listas de permitidos frente a listas de bloqueo.
14. [GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q) (10 de julio de 2026): *MCP Atlassian*, un arreglo de SSRF incompleto por no fijar la IP validada; corregido en la versión 0.22.0.
15. [GHSA-9hgc-g3w5-67cm, CVE-2026-53708](https://github.com/advisories/GHSA-9hgc-g3w5-67cm) (15 de junio de 2026): *ContextForge*, una carrera entre la validación y la conexión en un punto de acceso de administración; corregido en la versión 1.0.3. Es la fuente primaria que se consultó: la página del NVD (nvd.nist.gov) de este CVE no devolvió contenido legible al consultarla.
16. [Redocly CLI, comando `lint`](https://redocly.com/docs/cli/commands/lint): qué hace, el conjunto de reglas recomendado por omisión y los formatos de salida; la versión usada es la 2.57.0 (30 de septiembre de 2026), de licencia MIT.

### Términos de esta lección

| | |
|---|---|
| **OpenAPI** | la especificación para describir una API HTTP en un documento que las máquinas leen; el curso usa la 3.1.1 |
| **operación** | un método sobre una ruta (`GET /servicios/{id}`) y todo lo que se dice de él |
| **`$ref`** | la referencia a una pieza escrita en otro lugar del documento, normalmente en `components` |
| **validador (*linter*)** | el programa que dice si un documento está bien escrito según la especificación |
| **matriz** | la tabla de escenarios que se recorre con un solo comando, comparando cada respuesta con lo prometido |
| **regresión** | una prueba de algo que ya se arregló una vez, para que no vuelva sin que nadie se entere |
| **que la prueba muerda** | demostrar que una prueba detecta un defecto deshaciendo el arreglo y viéndola en rojo |
| **bendecir el defecto** | que una prueba pase porque se ajustó a lo roto en lugar de exigir lo prometido |
| **DNS rebinding** | que un nombre cambie de dirección entre la revisión y la conexión, por una respuesta de DNS que miente la segunda vez |
| **TOCTOU** | *time of check, time of use*: una carrera entre cuando se revisa algo y cuando se usa |
| **`deprecated`** | el campo de una operación que avisa que ya no conviene usarla |
| **`Deprecation`, `Sunset`** | las cabeceras que dicen desde cuándo se desaprueba algo y cuándo se espera que deje de responder |

---

Con esta lección termina el curso; sigue tu bitácora.

**Anterior:** [Lección 7 — Quien lee el error: el cliente del `revisor` y los agentes de IA](07-quien-lee-el-error.md)

# Lección 6 — Reintentos e idempotencia

Son las 23:50 del último día del mes y el equipo de operaciones está dando de alta, con un guion, los catorce servicios nuevos que el `revisor` tiene que vigilar desde la medianoche. El guion no habla con el `revisor` directamente: pasa por la pasarela de la empresa, como todo lo demás. A las 23:52 la pasarela tiene un mal minuto. El guion manda el alta de `agenda`, el `revisor` la recibe, la guarda y responde `201`, y esa respuesta se pierde en el camino de regreso. Al guion le llega un `502 Bad Gateway`. Quien lo escribió fue prudente: ante un `502`, reintenta. El segundo intento sí pasa, y el `revisor` contesta `409 Conflict`: «ya existe un servicio llamado agenda». El guion trata el `409` como un error, se detiene y deja trece servicios sin dar de alta. A las 00:00 empiezan las revisiones y la mitad del tablero está vacía. Nadie sabe si `agenda` la creó el guion o alguien más, porque el `409` no lo dice. Y la persona de guardia, para no arriesgarse, borra `agenda` y la vuelve a crear a mano, justo cuando otro compañero relanza el guion completo.

Ninguna de esas decisiones era tonta. Lo que faltaba era una forma de **repetir una petición sin miedo a que haga dos veces lo mismo**, y una regla clara de **cuándo** repetirla. Eso construye esta lección.

**Tiempo:** 2 × 45 min (el corte está entre las secciones 6.4 y 6.5)

**Qué construyes:** un `POST /servicios` que se puede repetir sin duplicar mientras el servidor recuerde la llave (la sección 6.7 dice hasta dónde llega eso), con la cabecera `Idempotency-Key`; una pasarela que pierde respuestas a propósito, para ver el `502` que no dice si la escritura ocurrió; un cliente que reintenta el alta con la misma llave; las revisiones del `revisor` con reintentos, retroceso exponencial y *jitter*; y un programa que comprueba la idempotencia del alta

**Qué aprendes:** qué son los métodos seguros y los idempotentes según el RFC 9110, y qué **no** promete la idempotencia; las dos preguntas que deciden un reintento; el retroceso exponencial con *jitter* completo y por qué el azar protege al servidor; cuándo obedecer `Retry-After` y cuándo no esperar; `Idempotency-Key` y por qué todavía **no es un estándar**; cuánto dura una llave, qué pasa si cambia el cuerpo y qué no cubre; y qué hacer con un `502` que no dice si la escritura ocurrió

**De dónde vienes.** De la [Lección 5](05-problem-details.md), con un `revisor` cuyos errores ya son Problem Details: un `type` estable, un `title` que no cambia, un `detail` para la persona que lee. En la [Lección 4](04-capacidad-y-fallas-del-servidor.md) aprendiste a leer `Retry-After` en sus dos formas, y viste que una revisión de `pagos` queda con `"detalle":"503 (reintentar en 120 s)"`, pero el `revisor` no hacía nada con ese número. En la [Lección 1](01-exitos-redirecciones.md) viste que un segundo `DELETE` no cambia nada, y que eso tenía nombre: idempotencia. Esta lección junta las tres cosas. Hasta aquí, repetir un alta crea otro servicio o choca con el `409` del nombre repetido sin que sepas si el servicio era tuyo, y las revisiones no reintentan nunca.

**Qué no hace esta lección.** No escribe la tabla que decide qué hacer con cada código desde el lado del cliente; eso es la [Lección 7](07-quien-lee-el-error.md), que también decide qué hacer con el `409` de una llave en curso. No documenta la cabecera en OpenAPI; eso es la [Lección 8](08-contrato-verificable.md). No guarda las llaves en una base de datos: el `revisor` las guarda en memoria, y la sección 6.7 dice qué cambia en una API real. Y no implementa un presupuesto de reintentos compartido ni un cortacircuitos: los menciona en 6.3.3 porque existen y conviene conocerlos, pero el `revisor` solo acota cuántas veces reintenta cada consulta.

**Sobre las corridas.** Linux Mint 22 es el sistema de referencia del curso. Las salidas de esta lección se obtuvieron el 21 de octubre de 2026 en macOS con Node 24.14.1 y curl 8.7.1, agregando `-sS` a cada `curl` porque la salida iba a un archivo (`-s` apaga el medidor de progreso, `-S` deja ver los errores, y ninguna de las dos cambia la respuesta). Todas las series se corrieron en los puertos 18080, 18081 y 18082, que son los que vas a teclear tú, sobre la versión final de los programas, y cada archivo `.salida.txt` es la captura tal como salió, salvo que en los renglones de órdenes se quitó el `-sS` (`fig06_02.salida.txt` no usa servidores: es un muestreo al azar). Las versiones rotas de «El error que vas a ver» y la solución del ejercicio 3 se corrieron desde copias en otras carpetas; en las salidas, el comprobador aparece como `node fig06_03.ts`, que es como lo vas a correr tú. En tu corrida van a cambiar la fecha de `Date`, las ocho cifras finales de cada `ETag` (el `revisor` las sortea al arrancar), los milisegundos medidos, las esperas que sortea el *jitter* (las de `fig06_02.ts` son distintas cada vez, a propósito), las llaves que inventa `alta-segura.ts` y los nombres que inventa `fig06_03.ts`. El `revisor` guarda todo en memoria, servicios y llaves: para obtener lo mismo que la lección, arranca de nuevo el laboratorio, el `revisor` y la pasarela antes de cada serie de peticiones. No se corrió en una instalación de escritorio de Mint, y nada de lo que se usa depende de macOS. Los programas están en [`programas/06-reintentos-idempotencia/`](../programas/06-reintentos-idempotencia), en el repositorio del curso: el `revisor` en `fig06_01/`, el retroceso visto de cerca en `fig06_02.ts`, el comprobador de idempotencia en `fig06_03.ts`, el servidor de mentira en `fig06_04.ts`, las versiones rotas en `defectos/`, la solución del ejercicio 3 en `ejercicios/ej3/` y cada corrida en su archivo `.salida.txt` (la de los intentos agotados, en `agotados.salida.txt`). Todos pasan `tsc` en modo estricto (sección 6.10).

## Al terminar vas a poder

- Decir, para cada método de HTTP, si es seguro, si es idempotente o ninguna de las dos cosas, citando el RFC 9110, y demostrarlo repitiendo una petición contra el `revisor` y comparando el estado antes y después.
- Explicar por qué un `DELETE` repetido que responde `204` y luego `410` sigue siendo idempotente, y por qué un `PUT` con `If-Match` repetido responde `412` aunque su cambio sí ocurrió.
- Decidir si una falla merece un reintento con dos preguntas, ¿puede mejorar sola? y ¿es seguro repetirla?, y justificar por qué el `revisor` reintenta un `502` y no un `404`.
- Calcular el techo de la espera de cada intento con retroceso exponencial y *jitter* completo, y mostrar con una corrida que el azar reparte los reintentos de mil clientes.
- Hacer que un `POST` repetido con la misma `Idempotency-Key` devuelva la misma respuesta sin crear otro recurso, y provocar los dos rechazos que propone el borrador: `422` si la llave llega con otro cuerpo y `409` si la original sigue en curso.
- Explicar los límites de una llave de idempotencia: cuánto dura, qué cuenta como «el mismo cuerpo» y qué no cubre, cada uno con una corrida que lo demuestra.
- Explicar qué hace un cliente cuando se le agotan los intentos o nadie le responde (sale con un mensaje y con código `1`, sin esperar de más), y provocar esos casos con el `revisor` o la pasarela apagados.
- Predecir qué hace `alta-segura.ts` con un `4xx`, con un `Retry-After` corto y con uno largo, con un servidor que no contesta y con los dos `409`, y comprobarlo con el servidor de mentira.
- Correr un programa que compruebe la idempotencia del alta y leer su falla contra una versión rota a propósito.

## El porqué antes del cómo

Un reintento es la respuesta más natural a una falla, y también la más peligrosa. Natural, porque muchas fallas son pasajeras: un servicio que se estaba reiniciando, una pasarela con un mal minuto, una conexión que se cortó. Peligrosa, por dos razones que esta lección separa con cuidado.

La primera es que **no siempre sabes si lo que pediste ocurrió**. Cuando una petición falla antes de llegar al servidor, repetirla es inofensivo: el servidor nunca la vio. Cuando falla *después* de que el servidor la atendió, pero antes de que te llegara la respuesta, repetirla es pedir lo mismo por segunda vez. Desde tu lado, los dos casos se ven igual: un `502`, un tiempo agotado, una conexión cortada. La escena del principio es justo eso: el `revisor` creó `agenda`, y el guion nunca se enteró. Si la operación es leer, da igual. Si la operación es crear, cobrar, enviar un correo o mover inventario, repetirla puede duplicar el efecto.

La segunda razón es que **un reintento le cuesta al servidor**. Si un servicio falla porque está saturado y mil clientes reintentan en el mismo instante, lo que recibe no es alivio sino otra ola de mil peticiones, y luego otra. Un reintento mal hecho convierte un tropiezo de dos segundos en una caída de veinte minutos.

HTTP ya resuelve parte del primer problema. El RFC 9110 clasifica los métodos: algunos son **idempotentes**, y repetirlos deja al servidor igual que hacerlos una vez. Con ellos el reintento es seguro por definición. Pero el método con el que se crean cosas, `POST`, no lo es, y es justo el que más falla duele. Para él, la industria inventó una cabecera, `Idempotency-Key`, que un borrador de la IETF intentó estandarizar sin llegar a publicarse como RFC. El segundo problema, el del servidor saturado, se resuelve en el cliente: esperar cada vez más entre intentos, sortear la espera y obedecer al servidor cuando dice cuánto esperar.

La lección tiene cuatro partes:

1. **Qué se puede repetir** (6.1 a 6.3): el `revisor` de esta lección, los métodos seguros e idempotentes, y las dos preguntas que deciden un reintento.
2. **Cómo se repite** (6.4): retroceso exponencial, *jitter* y `Retry-After`, con las revisiones del `revisor`.
3. **Lo que no se puede repetir… hasta que se puede** (6.5 a 6.7): el `502` que no dice si la escritura ocurrió, `Idempotency-Key` y sus límites.
4. **El `revisor` completo** (6.8 a 6.10): los archivos, la corrida y el programa que lo comprueba.

## Los conceptos

### 6.1 El `revisor` de esta lección

#### 6.1.1 Qué cambia

El `revisor` de la Lección 5 gana tres archivos y cambia cuatro:

- **`idempotencia.ts`** (nuevo) guarda, por credencial y por llave, la huella de la petición y la respuesta que recibió. Es la sección 6.6.
- **`pasarela.ts`** (nuevo) es un programa aparte que escucha en el puerto 18082 y reenvía todo al `revisor`. Con la cabecera `X-Simular: perder-primera`, la primera vez que ve una petición deja que el `revisor` la atienda y tira la respuesta: al cliente le contesta `502`. Si el `revisor` no contesta (porque está apagado), también responde `502` y sigue escuchando. Es la sección 6.5.
- **`alta-segura.ts`** (nuevo) es un cliente que da de alta un servicio a través de la pasarela y reintenta con la misma llave, hasta cuatro veces, y se detiene en cuanto se agotan. Obedece `Retry-After`, corta cada intento por tiempo y sale con 0 solo si el alta se hizo. También es de la sección 6.5.
- **`servicios.ts`** lee `Idempotency-Key` en el alta, y las revisiones usan `revisarConReintentos` en lugar de `revisar`.
- **`cliente.ts`** separa la clasificación (`clasificar`) de la consulta, y gana el retroceso con *jitter* y `revisarConReintentos`. Es la sección 6.4.
- **`problemas.ts`** agrega dos tipos al catálogo: `llave-en-curso` (`409`) y `llave-reutilizada` (`422`).
- **`respuestas.ts`** cambia la lectura del cuerpo: cuando pasa del tope de 16 KiB, el `revisor` termina de leer lo que el cliente todavía manda antes de contestar el `413`, para que la respuesta no se pierda. Es la sección 6.8.1.

Ninguna ruta, ningún código de la puerta y ninguna cabecera de las lecciones anteriores cambia. La cabecera nueva es opcional: un alta sin ella se comporta exactamente como en la Lección 5.

#### 6.1.2 Arrancar los tres

El `revisor` vive en `~/curso-http/fig06_01/`; la sección 6.8 trae todos sus archivos. Abre tres terminales en esa carpeta:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

```text
$ node pasarela.ts
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
```

Hasta la sección 6.5 no usas la pasarela, pero conviene tenerla arriba desde ahora. Y una advertencia que vale para toda la lección: el `revisor` guarda servicios, revisiones y llaves en memoria. Cada serie de peticiones de esta lección empieza con los tres programas recién arrancados; si la tuya sigue a otra, detenlos con `Ctrl+C` y arráncalos de nuevo, o los ids y las respuestas no van a coincidir.

### 6.2 Seguro e idempotente: lo que dice el RFC 9110

#### 6.2.1 Las dos propiedades

El RFC 9110 define dos propiedades de los métodos, y conviene leerlas con cuidado porque se confunden.

Un método es **seguro** si su semántica es esencialmente de solo lectura: quien lo usa no pide, ni espera, ningún cambio de estado en el servidor ([sección 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1)). Los métodos seguros del RFC son `GET`, `HEAD`, `OPTIONS` y `TRACE`. «Seguro» no quiere decir que el servidor no haga nada: el RFC mismo da el ejemplo de la bitácora de accesos, que crece con cada `GET` y hasta podría llenar el disco. Quiere decir que el cliente no pidió ese efecto y no es responsable de él.

Un método es **idempotente** si el efecto que se busca en el servidor con varias peticiones idénticas es el mismo que con una sola ([sección 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)). Los idempotentes del RFC son `PUT`, `DELETE` y todos los seguros. La palabra viene de las matemáticas: aplicar una operación dos veces da lo mismo que aplicarla una.

Y la sección 9.2.2 dice para qué sirve la distinción, con una claridad que vale la pena citar: los métodos idempotentes se distinguen porque **la petición se puede repetir automáticamente si la comunicación falla antes de que el cliente lea la respuesta**. Si se cerró la conexión de un `PUT` antes de recibir nada, el cliente puede abrir otra y repetirlo: sabe que repetirlo tendrá el mismo efecto buscado, aunque la petición original sí hubiera funcionado, «though the response might differ», aunque la respuesta pueda ser distinta.

| Método | Seguro | Idempotente | Fuente |
|---|---|---|---|
| `GET`, `HEAD`, `OPTIONS`, `TRACE` | sí | sí | RFC 9110, 9.2.1 y 9.2.2 |
| `PUT`, `DELETE` | no | sí | RFC 9110, 9.2.2 |
| `POST` | no | no | RFC 9110, 9.3.3 |
| `PATCH` | no | no | RFC 5789, sección 2 |

`POST` no es idempotente porque su semántica es «procesa esto según tus propias reglas» ([sección 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3)), y una de sus funciones típicas es crear un recurso que el servidor todavía no identificó. Dos `POST` iguales pueden crear dos recursos. `PATCH`, según el RFC 5789, no es ni seguro ni idempotente: un parche puede decir «suma uno», y sumar uno dos veces no es lo mismo que sumarlo una.

La consecuencia práctica está en un renglón del mismo RFC: **un cliente no debería reintentar automáticamente una petición con un método no idempotente**, a menos que tenga alguna forma de saber que esa petición en particular sí es idempotente, o alguna forma de detectar que la original nunca se aplicó. Esas dos salidas son exactamente lo que vas a construir: la primera es `Idempotency-Key`; la segunda, reconciliar (releer el estado y ver qué pasó). Y una línea más abajo, otra regla que importa para quien opera pasarelas: **un proxy no debe reintentar automáticamente peticiones no idempotentes**. Una pasarela que reintenta un `POST` por su cuenta puede duplicar lo que su cliente nunca pidió duplicar.

#### 6.2.2 Verlo en el `revisor`

Con los tres programas recién arrancados, repite cada operación dos veces y mira qué queda. Empieza por un `PUT` con su etiqueta, como lo enseñó la Lección 3:

```text
$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-1-a9fec589"

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-a9fec589"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json
Content-Language: es
Content-Length: 269
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"tu etiqueta ya no es la vigente: el servicio cambió o el revisor se reinició; vuelve a leerlo antes de cambiarlo","instance":"/servicios/1"}

$ curl http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
```

El primer `PUT` cambió el límite a 1500 y respondió `200` con una etiqueta nueva. El segundo, idéntico, respondió `412`. Y aun así el estado final es el que pediste: `"limite_ms":1500`. La idempotencia se cumplió, porque el efecto de dos `PUT` es el mismo que el de uno; lo que cambió fue la respuesta, que es justo lo que el RFC advierte. El `412` no dice «tu cambio no ocurrió»; dice «tu etiqueta ya no es la vigente». Quien reintenta un `PUT` condicional y recibe un `412` tiene que releer antes de concluir que perdió: puede ser que la versión vigente sea, precisamente, la suya.

Ahora un `DELETE` dos veces:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 410 Gone
Content-Type: application/problem+json
Content-Language: es
Content-Length: 188
Date: Wed, 21 Oct 2026 22:25:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-retirado","title":"El servicio se retiró","status":410,"detail":"el servicio 4 se retiró y no va a volver","instance":"/servicios/4"}
```

`204` y luego `410`. Respuestas distintas, efecto idéntico: después de uno o de dos `DELETE`, el servicio 4 está retirado. Este es el caso que la Lección 1 anticipó. Un cliente que reintenta un `DELETE` y recibe `410` (o `404`) no debería tratarlo como una falla: lo que quería ya es cierto.

Ahora un `POST` de alta dos veces, sin nada más:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-a9fec589"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:25:57 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 220
Date: Wed, 21 Oct 2026 22:25:57 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado avisos","instance":"/servicios","existente":"/servicios/7"}
```

El primero creó `avisos` con el id 7. El segundo no creó otro, pero no porque el `POST` sea idempotente: lo detuvo una regla de negocio, que el nombre sea único dentro del equipo. Esa red te salvó de un duplicado, y a cambio te dejó con la duda de la escena: el `409` dice que existe `/servicios/7`, no dice quién lo creó. Si tu primer intento se hubiera perdido en el camino, no sabrías si `/servicios/7` es tuyo o de un compañero que eligió el mismo nombre.

Y un `POST` que no tiene ninguna red:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 202 Accepted
Location: /revisiones/1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 22:25:58 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":1,"estado":"pendiente","resultado":null}

$ curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 202 Accepted
Location: /revisiones/2
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 22:25:58 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":2,"servicio":1,"estado":"pendiente","resultado":null}
```

Dos peticiones, dos revisiones: `/revisiones/1` y `/revisiones/2`. Pedir una revisión no es idempotente, y nada lo frena. Aquí el costo es pequeño (una consulta de más al servicio), pero mira el patrón: es la forma de cualquier `POST` que crea algo sin un dato que lo haga único. Una orden de compra, un pago, un mensaje.

#### 6.2.3 Lo que la idempotencia no promete

Tres cosas que se confunden con la idempotencia y no lo son.

**No promete la misma respuesta.** El RFC lo dice con todas sus letras, y lo acabas de ver: `204` y `410`, `200` y `412`. Un cliente que compara la segunda respuesta con la primera para decidir si algo salió mal está midiendo lo que no es.

**No promete que nada cambie.** Un `PUT` con `If-Match: *` repetido deja el mismo contenido, pero el `revisor` sube la versión en cada escritura, así que la `ETag` cambia de `"1-2-…"` a `"1-3-…"` (lo vas a ver en el ejercicio 1). El RFC deja espacio para eso: la idempotencia se refiere al efecto que pidió el usuario, y el servidor es libre de llevar historia, bitácoras o versiones aparte.

**No es una propiedad de la red, sino del método y del servidor.** Que el RFC diga que `PUT` es idempotente es una promesa que el servidor tiene que cumplir. Si tu servidor implementa un `PUT` que suma, o un `DELETE` que borra «el último», rompiste la promesa, y todos los clientes, proxies y bibliotecas que confían en ella van a duplicar efectos sin saberlo. El RFC lo dice para los métodos seguros, y vale igual aquí: si una URI hace algo inseguro con un método seguro, la responsabilidad es de quien la diseñó.

### 6.3 Cuándo reintentar y cuándo no

#### 6.3.1 Las dos preguntas

Cada vez que una petición falla, el `revisor` (y cualquier cliente que quieras escribir) se hace dos preguntas, en este orden:

1. **¿Puede mejorar sola?** Un servicio saturado, una pasarela que se reinicia, un tiempo agotado: esperar puede arreglarlo. Una credencial inválida, un servicio que no existe, un cuerpo mal formado: no. Repetir lo que no puede mejorar solo es gastar la paciencia del servidor y la tuya.
2. **¿Es seguro repetirla?** Si el método es idempotente, sí. Si no lo es, solo con una llave de idempotencia o si sabes que la original nunca llegó.

Solo si las dos respuestas son «sí», se reintenta. Es criterio de diseño, no norma: el RFC te dice cuándo es *seguro* repetir, y cada API decide cuándo *vale la pena*.

#### 6.3.2 Qué reintenta el `revisor`

Las revisiones del `revisor` son `GET` a los servicios que vigila: seguros e idempotentes, así que la segunda pregunta siempre es «sí». La primera la contesta la función `vale` de `cliente.ts`:

| Desenlace de la consulta | ¿Puede mejorar sola? | ¿Reintenta? |
|---|---|---|
| sin conexión, tiempo agotado, respuesta que no es HTTP | puede: lo de atrás quizá se está levantando | sí |
| `429 Too Many Requests` | sí: el límite se reinicia con el tiempo | sí, si `Retry-After` no pide más de 5 s |
| `502`, `503`, `504` | sí: la falla es de algo que está detrás o es temporal | sí (si la respuesta trae `Retry-After`, con la misma condición) |
| `500` | casi nunca: es un defecto del servidor | no |
| cualquier otro `4xx` | no: lo que hay que cambiar es la petición | no |
| destino prohibido (SSRF) | no: la regla no va a cambiar | no |

El `500` merece una línea aparte, porque muchos clientes sí lo reintentan. El RFC 9110 dice que un `500` es una condición inesperada que le impidió al servidor cumplir; la Lección 4 lo trató como un defecto del servidor, y repetir una petición contra un defecto casi siempre reproduce el defecto. El `revisor` decide no reintentarlo. Otras APIs deciden distinto, y es una decisión que se escribe, no una que se hereda de una biblioteca.

Cualquiera de esas respuestas puede traer `Retry-After` (lo normal es verla en un `429` o un `503`): el servidor dice cuánto esperar, y el `revisor` lo obedece si es razonable. Lo verás en 6.4.3.

#### 6.3.3 Cuántas veces, y en qué capa

El RFC 9110 trae otra frase, al final de la sección 9.2.2, que conviene conocer: **un cliente no debería reintentar automáticamente un reintento automático que falló**. Está escrita para el caso de la conexión cortada (el agente de usuario que reabre la conexión y repite una vez), y su espíritu es claro: los reintentos tienen que tener un final. El `revisor` hace hasta tres intentos por consulta y `alta-segura.ts` hasta cuatro, así que van más allá de esa letra, y es una decisión a la vista: son clientes de una aplicación que conocen la operación, esperan cada vez más y se detienen en un tope fijo. Si escribes un cliente genérico, que no sabe nada de la operación, la recomendación del RFC es la prudente: un reintento y ya.

El número de intentos importa más de lo que parece, por la **amplificación**. La guía de Amazon sobre tiempos de espera y reintentos lo explica con un ejemplo: cinco capas de servicios, cada una reintentando tres veces por su cuenta, multiplican por 243 la carga sobre la base de datos del fondo, justo cuando está más débil. El libro de SRE de Google cuenta el mismo fenómeno con tres capas: una sola acción de una persona termina en 64 intentos contra la base de datos. Las dos fuentes llegan a la misma recomendación: **reintentar en un solo lugar de la cadena**, limitar los reintentos por petición y tener un presupuesto de reintentos por proceso que deje de reintentar cuando se agota (el libro de SRE pone de ejemplo 60 por minuto; la guía de Amazon propone una cubeta de fichas).

En el `revisor`, quien reintenta las revisiones es el `revisor`, y nadie más. La pasarela de esta lección no reintenta nada: si lo hiciera con un `POST`, rompería la regla del RFC para los proxies.

### 6.4 Retroceso exponencial con *jitter*

#### 6.4.1 Por qué esperar más cada vez

Si una petición falló porque el servidor está saturado, reintentar enseguida empeora lo que querías arreglar. La idea del **retroceso exponencial** (*exponential backoff*) es esperar cada vez más: un poco después del primer fallo, el doble después del segundo, el doble otra vez después del tercero, hasta un tope. Si la falla era de un segundo, el primer reintento la libra. Si era de un minuto, los reintentos se van espaciando y le dejan al servidor espacio para recuperarse.

El `revisor` usa una base de 250 ms y un tope de 2,000 ms. El techo del intento `n` es `250 × 2^n`, sin pasar de 2,000: 500 ms antes del segundo intento, 1,000 antes del tercero, y después ya pegaría con el tope.

#### 6.4.2 Por qué al azar

El retroceso solo no basta. Si mil clientes fallan en el mismo instante (porque el servidor se cayó para todos a la vez), y todos esperan exactamente 500 ms, a los 500 ms el servidor recibe los mil reintentos juntos. Es la misma ola, un poco después. La solución que Marc Brooker analizó y popularizó en el blog de arquitectura de AWS en 2015, y que hoy es la práctica común, es sortear la espera: el ***jitter* completo** (*full jitter*) espera un tiempo al azar entre 0 y el techo. Brooker comparó tres formas de sortear (completo, «igual» y «descorrelacionado»): la «igual» salió perdiendo, y entre las otras dos la diferencia fue menos clara. El curso usa el completo porque es el más simple de escribir y de explicar.

Así se escribe en `cliente.ts` (fragmento):

```ts
export function esperaConJitter(intento: number, baseMs: number, topeMs: number): number {
  return Math.round(Math.random() * Math.min(topeMs, baseMs * 2 ** intento));
}
```

Para verlo, `fig06_02.ts` usa esa misma función, sin servidor. Guárdalo en `~/curso-http/fig06_02.ts`, junto a la carpeta `fig06_01/`, porque importa `./fig06_01/cliente.ts`. Primero sortea cinco esperas para cada intento; después simula mil clientes que fallan en el mismo instante y reintentan una vez, y cuenta cuántos reintentos caen en cada ventana de 100 ms:

```ts
// fig06_02.ts — el retroceso exponencial, con y sin jitter: cuánto espera cada intento y qué ve el servidor.
// Usa la misma función del revisor. No necesita ningún servidor: solo hace cuentas.
import { esperaConJitter } from "./fig06_01/cliente.ts";

const BASE_MS = 250;
const TOPE_MS = 2000;

// 1. El techo de cada intento: base × 2^intento, sin pasar del tope. El jitter completo sortea entre 0 y el techo.
console.log("intento  techo (ms)  cinco esperas sorteadas (ms)");
for (let intento = 1; intento <= 5; intento++) {
  const techo = Math.min(TOPE_MS, BASE_MS * 2 ** intento);
  const sorteadas = Array.from({ length: 5 }, () => esperaConJitter(intento, BASE_MS, TOPE_MS));
  console.log(`${String(intento).padStart(7)}  ${String(techo).padStart(10)}  ${sorteadas.join(", ")}`);
}

// 2. Mil clientes fallan en el mismo instante y reintentan una vez (intento 1, techo de 500 ms).
// Se cuentan sus reintentos en ventanas de 100 ms, que es lo que el servidor recibe.
const CLIENTES = 1000;
const VENTANA_MS = 100;
function contar(esperas: number[]): number[] {
  const cuentas = Array.from({ length: 6 }, () => 0);
  for (const espera of esperas) cuentas[Math.min(5, Math.floor(espera / VENTANA_MS))]++;
  return cuentas;
}
const sinJitter = contar(Array.from({ length: CLIENTES }, () => Math.min(TOPE_MS, BASE_MS * 2 ** 1)));
const conJitter = contar(Array.from({ length: CLIENTES }, () => esperaConJitter(1, BASE_MS, TOPE_MS)));

console.log();
console.log(`${CLIENTES} clientes reintentan a la vez; reintentos por cada ${VENTANA_MS} ms:`);
console.log("ventana (ms)   sin jitter  con jitter");
for (let i = 0; i < 6; i++) {
  const ventana = i < 5 ? `${i * VENTANA_MS}-${(i + 1) * VENTANA_MS - 1}` : `${i * VENTANA_MS} o más`;
  console.log(`${ventana.padEnd(12)}  ${String(sinJitter[i]).padStart(10)}  ${String(conJitter[i]).padStart(10)}`);
}
console.log(`la ventana más cargada: ${Math.max(...sinJitter)} sin jitter, ${Math.max(...conJitter)} con jitter`);
```

```text
$ node fig06_02.ts
intento  techo (ms)  cinco esperas sorteadas (ms)
      1         500  159, 181, 478, 282, 231
      2        1000  451, 774, 876, 523, 309
      3        2000  205, 575, 343, 1365, 1722
      4        2000  1966, 464, 1257, 575, 492
      5        2000  1555, 1327, 634, 75, 1138

1000 clientes reintentan a la vez; reintentos por cada 100 ms:
ventana (ms)   sin jitter  con jitter
0-99                   0         179
100-199                0         192
200-299                0         190
300-399                0         217
400-499                0         219
500 o más           1000           3
la ventana más cargada: 1000 sin jitter, 219 con jitter
```

La primera tabla muestra el techo de cada intento y cómo las esperas caen en cualquier lugar por debajo: en el intento 3 salió desde 205 hasta 1,722 ms. A partir del intento 3, el techo ya es el tope de 2,000. La segunda tabla es la que importa. Sin *jitter*, los mil reintentos caen en la misma ventana, la de 500 ms: el servidor que se estaba levantando recibe mil peticiones juntas. Con *jitter*, se reparten en cinco ventanas de unas doscientas cada una. Es la misma cantidad de trabajo, pero el pico es cinco veces más bajo. (Los tres que caen en «500 o más» son los que sortearon un número tan cerca de 500 que `Math.round` lo redondeó a 500.) Tus números serán distintos; la forma, la misma.

#### 6.4.3 `Retry-After` manda, con un tope

Cuando el servidor dice cuánto esperar, el cliente no adivina: obedece. `Retry-After` ([RFC 9110, sección 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)) indica cuánto debería esperar el agente de usuario antes de la siguiente petición, en segundos (`120`) o como una fecha HTTP. Con un `503`, indica cuánto se espera que el servicio siga sin estar disponible (la misma sección 10.2.3); la [sección 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4) agrega que el servidor puede mandarla para sugerir cuánto esperar antes de reintentar; con un `429`, el RFC 6585 permite usarlo para decir cuándo volver a intentar. La Lección 4 te enseñó a leerlo estricto: solo dígitos o una de las tres formas de fecha HTTP, siempre en GMT, y cualquier otra cosa se ignora.

¿Y si el servidor pide esperar dos minutos? Una revisión que se queda dormida dos minutos dentro de un `setTimeout` no le sirve a nadie: el resultado llega tarde y mientras tanto ocupa memoria. Por eso el `revisor` tiene un tope: **si `Retry-After` pide más de 5 segundos, no insiste** y anota en el resultado lo que el servicio dijo. Es la misma preocupación del sondeo de la Lección 1, que acotaba la espera entre 1 y 5 segundos para que un servidor equivocado no lo dejara dormido una hora, pero aquí la decisión es otra. El sondeo pregunta por el estado de un trabajo, una lectura barata, y puede volver a preguntar a los 5 s. Una revisión que reintenta a los 5 s cuando el servicio pidió 120 llega antes de lo que el servicio pidió: eso sería desobedecerlo. Lo honesto es no reintentar y decir por qué. Si `Retry-After` no viene, o no se puede leer, se usa el retroceso con *jitter*.

#### 6.4.4 Las revisiones con reintentos

`revisarConReintentos` junta todo (fragmento de `cliente.ts`; el archivo completo está en 6.8.1):

```ts
const INTENTOS = 3;
const BASE_MS = 250;
const TOPE_MS = 2000;
const TOPE_RETRY_AFTER_S = 5;

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

Léelo en voz alta: consulta una vez; mientras queden intentos y la falla valga la pena, mira si el servicio pidió una espera; si pidió más de 5 s, sale del ciclo; si pidió algo razonable, espera eso; si no pidió nada, sortea; y vuelve a consultar. Al final clasifica **la última** consulta, con la misma función de siempre, que la lección separó de `revisar` para poder usarla aquí. Fíjate en dónde está la espera: dentro del cuerpo del `for`, justo antes de la consulta siguiente. Cuando se agotan los intentos (`intento < INTENTOS` deja de cumplirse), el cuerpo ya no se ejecuta, así que nunca se espera después de la última consulta. El orden de las dos condiciones no cambia eso: solo evita llamar a `vale` cuando ya no quedan intentos.

Para verlo trabajar hacen falta servicios que fallen de distintas formas. Con los tres programas recién arrancados, da de alta tres servicios del laboratorio: uno que responde `502`, otro `429` (con `Retry-After: 30`) y otro `404`. Después pide una revisión de cada uno y otra de `pagos`, que responde `503` con `Retry-After: 120`. Las tres primeras con `escritura-a` y la cuarta con `admin`, porque cada credencial tiene tres revisiones por minuto (Lección 4):

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"puerta","url":"http://127.0.0.1:18081/codigo/502"}'
201 /servicios/7

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"cupo","url":"http://127.0.0.1:18081/codigo/429"}'
201 /servicios/8

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"ausente","url":"http://127.0.0.1:18081/codigo/404"}'
201 /servicios/9

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/7/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/8/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/9/revisiones -H 'Authorization: Bearer admin'
202

$ sleep 4

$ for i in 1 2 3 4; do curl http://127.0.0.1:18080/revisiones/$i -H 'Authorization: Bearer escritura-a'; done
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":12,"detalle":"503 (reintentar en 120 s)"}}
{"id":2,"servicio":7,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":502,"ms":1,"detalle":"502"}}
{"id":3,"servicio":8,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":429,"ms":1,"detalle":"429 (reintentar en 30 s)"}}
{"id":4,"servicio":9,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":404,"ms":2,"detalle":"404"}}
```

Los cuatro resultados dicen `CAIDO`, y en la Lección 4 habrían dicho lo mismo. La diferencia está en la terminal del laboratorio, que imprime cada petición que recibe:

```text
--- terminal del laboratorio:
laboratorio en http://127.0.0.1:18081/codigo/NNN
GET /codigo/503
GET /codigo/502
GET /codigo/429
GET /codigo/404
GET /codigo/502
GET /codigo/502
```

Cuenta las líneas. `/codigo/503` aparece **una vez**: pidió esperar 120 s, más que el tope, y el `revisor` no insistió; por eso el detalle conserva `(reintentar en 120 s)`. `/codigo/429` también aparece una vez, por la misma razón (30 s). `/codigo/404` aparece una vez: un `404` no mejora solo. Y `/codigo/502` aparece **tres veces**: la primera en orden con las demás y las otras dos después, separadas por las esperas sorteadas (hasta 500 ms y hasta 1,000 ms). El resultado es el del tercer intento, que también falló. Tres intentos, dos esperas, y ni uno más.

Si te preguntas por qué la revisión del `502` sigue diciendo `"ms":1` después de casi un segundo y medio de reintentos: `ms` mide la última consulta, no la revisión completa. Es lo que tardó el servicio en contestar, que es lo que el `revisor` vigila.

### 6.5 El `502` que no dice si la escritura ocurrió

#### 6.5.1 La pasarela que pierde respuestas

La segunda mitad de la lección es sobre la escena del principio. Para provocarla a voluntad, `pasarela.ts` se pone delante del `revisor` y, con la cabecera `X-Simular: perder-primera`, deja pasar la primera petición de cada alta, recibe la respuesta del `revisor` y la tira. Al cliente le responde lo que respondería una pasarela real que no recibió una respuesta completa de lo que está detrás: `502 Bad Gateway` ([RFC 9110, sección 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3)), como Problem Details con `about:blank`. Reconoce «la misma petición» por su `Idempotency-Key`, y si no trae llave, por la huella de su cuerpo:

```ts
// fig06_01/pasarela.ts — una pasarela delante del revisor (18082 → 18080) que puede perder respuestas.
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

Fíjate en lo que la pasarela registra en su terminal: «el revisor respondió 201, pero la respuesta se pierde». Esa línea es lo que el cliente nunca ve. Desde su lado, un `502` puede significar que la petición no llegó al `revisor`, o que llegó y algo falló, o que llegó, se cumplió y se perdió la respuesta. **El `502` no dice cuál**, y no puede decirlo: la pasarela tampoco lo sabe siempre. Lo mismo vale para un `504` y para una conexión cortada.

La pasarela tiene un segundo `502`, que no es simulado. Si el `revisor` está apagado o corta la conexión, el `fetch` de la pasarela falla, y una promesa que falla sin que nadie la espere hace que Node tumbe el proceso entero. Por eso `pasar` va envuelta en `pasarSinCaerse`: atrapa el fallo, anota «el revisor no respondió», contesta `502` con otro `detail` (la pasarela no recibió *respuesta*, no «una respuesta *completa*») y sigue escuchando. Lo ves en 6.5.3. Una pasarela que se cae junto con lo que protege deja a todos sus clientes sin siquiera un error que leer. Y en la respuesta que sí deja pasar, reenvía entre otras cabeceras `content-length`, para que el cliente reciba el mismo tamaño que dio el `revisor` (lo verás en el `201` de 6.8.4).

#### 6.5.2 El cliente que reintenta

`alta-segura.ts` es el guion de la escena, escrito con cuidado: da de alta un servicio a través de la pasarela y, si recibe `502`, `503` o `504`, o si no recibe ninguna respuesta, espera con *jitter* y reintenta, hasta cuatro intentos. Manda siempre `X-Simular: perder-primera`, para que la escena se reproduzca a voluntad; una pasarela real jamás obedece un interruptor así desde la petición de un cliente: es solo del laboratorio. Con la opción `--sin-llave` se porta como el guion de la escena; sin ella, manda una `Idempotency-Key` que inventa al arrancar:

```ts
// fig06_01/alta-segura.ts — dar de alta un servicio a través de la pasarela y reintentar sin duplicar.
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

La línea que importa es la del comentario: **una llave por intención, no por intento**. La llave se crea una vez, antes del ciclo, y todos los reintentos de esa alta la llevan. Si se creara dentro del ciclo, cada reintento sería una petición nueva para el `revisor`, que es exactamente el defecto de «El error que vas a ver».

El resto del programa sigue el orden de las dos preguntas de 6.3.1, y en cada paso toma una decisión que se ve en una corrida (6.5.3 y 6.5.4):

- **`intentar`** hace una petición y devuelve la respuesta (código, cuerpo y `Retry-After`) o, si no llegó ninguna, la causa: el código del error de red que reporta Node, como `ECONNREFUSED` (nadie escucha en ese puerto), o `tiempo agotado`. La petición lleva `signal: AbortSignal.timeout(LIMITE_MS)`: si el servidor acepta la conexión y no contesta, el intento se corta a los 2,000 ms (la variable `ALTA_LIMITE_MS` lo cambia, para probar). Sin ese límite, Node espera 300 s por intento. Una petición sin respuesta es, para quien la mandó, el mismo caso que el `502`: pudo llegar o no. Con la misma llave, repetirla no crea otro servicio, siempre que el `revisor` todavía recuerde esa llave (6.7).
- **`reintentable`** contesta la primera pregunta: ¿puede mejorar solo? Sin respuesta, `502`, `503` y `504`, sí. Un `409` también, pero solo el de `llave-en-curso`, que se reconoce por su `type` y no por su código: la petición original sigue guardándose y esperar basta. El `409` de `nombre-repetido`, un `422` y cualquier otro `4xx` no mejoran repitiéndolos.
- **Las esperas.** Si el servidor dijo cuánto esperar (`Retry-After`, leído con `segundosDeEspera` de `cliente.ts`, la misma función y el mismo tope de 5 s que usan las revisiones), se obedece; si pide más, no se insiste y se dice por qué. Si no dijo nada, se sortea con *jitter*. La línea `if (intento === INTENTOS) break;` va **antes** de la espera, para que después del último intento no se duerma a nadie.
- **El final.** Cuando el ciclo acaba, el programa dice por qué (una línea) y sale con el código que corresponde: `0` solo si el alta se hizo (un `2xx`); `1` si no se hizo o no se sabe, sea porque se agotaron los intentos, porque el servidor pidió esperar de más o porque respondió algo que repetir no arregla. Un guion que llama a `alta-segura.ts` para catorce servicios lee ese código y sabe cuáles tiene que revisar.

Empieza por la versión sin llave. Esta corrida es parte de la serie de 6.6.4, que antes dio de alta `avisos` (7), `correo` (8) y `agenda` (9); por eso el id que vas a ver es el 10:

```text
$ node alta-segura.ts nomina2 http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 409 {"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado nomina2","instance":"/servicios","existente":"/servicios/10"}
el servidor respondió 409: repetir lo mismo no lo arregla; sin llave no se sabe si lo que ya existe lo creó un intento anterior
(código de salida: 1)
```

El primer intento recibió `502`. El cliente esperó y reintentó, y el segundo intento recibió `409`, «ya existe un servicio llamado nomina2», con `"existente":"/servicios/10"`. El servicio 10 lo creó el primer intento: la escritura sí ocurrió, el cliente nunca se enteró, y ahora tiene en la mano un `409` que no le dice si ese servicio es suyo. Es la escena, completa. Sin la regla del nombre único, el segundo intento habría creado el servicio 11, idéntico, y nadie habría recibido ningún error. Las dos últimas líneas son del programa: no repite el `409` (no mejora esperando), dice que sin llave no sabe si lo que ya existe lo creó un intento anterior, y sale con código `1`.

¿Qué hace un cliente con esto, sin llave? **Reconciliar**: releer el estado y decidir. El `409` trae `existente`; el cliente puede pedir `/servicios/10` y comparar con lo que quería crear. Si coincide, asume que fue él. Funciona, a medias: si un compañero creó un servicio igual un segundo antes, el cliente se lo apropia sin saberlo. La Lección 7 vuelve sobre esta acción. La sección siguiente hace que el servidor conteste la pregunta por ti.

#### 6.5.3 Cuando nadie responde

Hasta aquí, cada falla trajo una respuesta, aunque fuera un `502`. Faltan dos casos más feos: la pasarela con el `revisor` apagado, y el cliente sin pasarela. Los dos son una forma de «no sé si pasó», y `alta-segura.ts` y `pasarela.ts` los tienen resueltos. Con los tres programas recién arrancados, detén el `revisor` con `Ctrl+C` en su terminal (en la corrida de la lección se detuvo por su PID, y por eso no se ve el comando) y vuelve a pedir un alta, ahora directo a la pasarela:

```text
$ curl -i -X POST http://127.0.0.1:18082/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Length: 115
Date: Wed, 21 Oct 2026 22:21:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
```

El `revisor` ya no existe. La pasarela contestó `502` con Problem Details, y en su `detail` dice lo que le pasó: «no recibió respuesta del revisor». Compara con el `detail` simulado de 6.5.1, «no recibió una respuesta **completa**»: aquel era un `revisor` que sí contestó y cuya respuesta se tiró; este es un `revisor` que no contestó. Para el cliente son el mismo `502`, y de nuevo no dice si el alta ocurrió. Lo importante es que la pasarela **sigue viva** para contestarlo: la petición siguiente la atiende igual.

Ahora el cliente. Con el `revisor` todavía apagado, `alta-segura.ts` recibe `502` en los cuatro intentos:

```text
$ node alta-segura.ts sin-revisor http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 9f1d5f3d-0c37-4587-b4fe-5a8056f35347 es seguro
(código de salida: 1)
```

Léelo renglón por renglón. Los primeros cuatro renglones que empiezan con `intento` son las cuatro respuestas, todas `502`. Entre ellos, tres esperas: hasta 500, hasta 1,000 y hasta 2,000 ms, que son los techos del retroceso para los intentos 1, 2 y 3 (`250 × 2^n`, con tope de 2,000). **No hay una cuarta espera**, porque después del intento 4 no queda nada que reintentar. El renglón siguiente dice por qué terminó: «se agotaron los 4 intentos sin una respuesta definitiva». Y como el alta llevaba llave, agrega la salida honesta: «repetir más tarde con la llave … es seguro». Quien lea esa línea (una persona o un guion) tiene la llave para reintentar cuando el `revisor` vuelva. Pero no basta con volver a correr `alta-segura.ts`, porque inventaría otra llave: hay que repetir la misma petición con esa llave y los mismos bytes (6.7.2), por ejemplo con `curl … -H 'Idempotency-Key: <la llave del mensaje>' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'`. Y el reintento solo está protegido si el servidor todavía recuerda la llave: dentro de su vigencia (6.7.1) y si no la perdió en un reinicio (6.7.4). Por último, `(código de salida: 1)`: el programa **no** terminó con éxito. El `0` queda reservado para un alta que se hizo, así que un guion que llama a `alta-segura.ts` en una lista de catorce servicios puede mirar ese código y saber cuáles tiene que revisar. En 6.5.4 ves que el `1` también cubre un `4xx`.

El peor caso de espera es la suma de los techos: 500 + 1,000 + 2,000 = 3,500 ms, más lo que tardan las peticiones. Aquí cada petición tiene un límite de 2,000 ms, así que el peor caso completo es de 4 × 2,000 + 3,500 = 11,500 ms; sin ese límite no habría peor caso, porque un servidor que no contesta dejaría al programa esperando 300 s por intento. Con la misma falla, un programa que además esperara después del cuarto intento habría sumado otros 2,000 ms para no hacer nada.

La variante sin llave termina en el mismo punto, pero con otro mensaje:

```text
$ node alta-segura.ts sin-revisor http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 1000 ms y reintento sin llave (podría duplicar)
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 2000 ms y reintento sin llave (podría duplicar)
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; no se sabe si el alta ocurrió
(código de salida: 1)
```

Los renglones de espera dicen «sin llave (podría duplicar)» en cada intento, y el final ya no promete nada: «no se sabe si el alta ocurrió». Es lo mismo que le pasó al guion de la escena, dicho a tiempo. Sin llave, el programa no tiene cómo ofrecer un reintento seguro, y no inventa uno.

El último caso es el del cliente sin pasarela. Detén también la pasarela con `Ctrl+C` en su terminal (en esta serie, igual que el `revisor`, se detuvo por su PID, y por eso la corrida no lo muestra) y da de alta otro servicio:

```text
$ node alta-segura.ts sin-pasarela http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (ECONNREFUSED)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (ECONNREFUSED)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (ECONNREFUSED)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (ECONNREFUSED)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave d58f84df-5556-41e5-a63c-5c217e14fb05 es seguro
(código de salida: 1)
```

Ahora los intentos no dicen `502`: dicen «sin respuesta (`ECONNREFUSED`)». Nadie escucha en el puerto 18082, así que el sistema operativo rechaza la conexión antes de que viaje un solo byte de la petición. Es el único caso de la lección donde sabrías con certeza que la petición no llegó, pero `alta-segura.ts` no se apoya en eso: trata cualquier error de red igual que un `502` (pudo llegar o no, y con la misma llave repetir es seguro) y reintenta con los mismos techos y el mismo final. Fíjate en lo que **no** aparece: la pila de errores de Node (`node:internal/modules/run_main…`) con la que termina un programa que no atrapó su `fetch`. El programa atrapa el error, lo traduce a una línea que una persona entiende y devuelve el código `1`.

Y la terminal de la pasarela cuenta lo que vio:

```text
--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
```

Nueve renglones de «el revisor no respondió»: uno por la petición de `curl`, cuatro por los intentos de `sin-revisor` con llave y cuatro por los de la variante sin llave. Los cuatro intentos de `sin-pasarela` no aparecen porque nunca llegaron a ella. Tres programas distintos, tres formas de fallar, y ninguno se cayó ni dejó al cliente sin una línea que decir.

#### 6.5.4 Qué hace con lo que recibe

Hasta aquí, `alta-segura.ts` decidió con el código: `502`, `503`, `504` o sin respuesta, se repite. Pero el servidor dice más que un código, y el programa lo escucha en cinco lugares. Para verlos hace falta un `revisor` que responda cosas que el verdadero no suele responder, así que esta sección usa dos herramientas: el modo mantenimiento del `revisor` (`PUT /mantenimiento`, que conociste en la Lección 4) y un servidor de mentira, `fig06_04.ts`, que escucha en el puerto 18082 donde estaría la pasarela y contesta lo que le digas.

**Un `4xx` no se repite, y sale con 1.** Una dirección que no es `http` ni `https` es un `422`; repetir la petición idéntica daría el mismo `422`. Con la pasarela y el `revisor` recién arrancados:

```text
$ node alta-segura.ts invalida ftp://archivos; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 422 {"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
el servidor respondió 422: repetir lo mismo no lo arregla
(código de salida: 1)
```

El primer intento recibió un `502` porque la pasarela perdió la respuesta (6.5.1); la segunda, con la misma llave, llegó entera: `422` `datos-invalidos`. El programa no espera ni reintenta una tercera vez. Dice en una línea qué pasó, «el servidor respondió 422: repetir lo mismo no lo arregla», y sale con `1`. Un `0` aquí le diría a un guion que el alta se hizo.

**`Retry-After` manda, con el mismo tope que las revisiones.** Con el `revisor` en mantenimiento, toda escritura recibe un `503` con `Retry-After: 120`:

```text
$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
204

$ node alta-segura.ts enmantenimiento http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 503 {"type":"https://revisor.example/problemas/en-mantenimiento","title":"El revisor está en mantenimiento","status":503,"detail":"el revisor está en mantenimiento","instance":"/servicios"}
el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta; repetir más tarde con la llave bf9d35dc-9d6d-4ca8-9a92-da8dcd058cd3 es seguro
(código de salida: 1)

$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
204
```

Léelo así: el primer `PUT` enciende el mantenimiento (`204`) y el último lo apaga. En medio, `alta-segura.ts` recibe el `502` simulado y luego el `503` del mantenimiento. Esta vez no sortea una espera: lee `Retry-After: 120`, ve que pasa del tope de 5 s y se detiene con el mensaje «el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta», más la llave por si alguien quiere repetir más tarde. Es la misma regla de 6.4.3, con la misma función (`segundosDeEspera`) y el mismo tope.

Para ver el otro lado hace falta un servidor que pida una espera corta. Aquí entra el servidor de mentira:

```ts
// fig06_04.ts — un servidor de mentira en el 18082 (donde estaría la pasarela) que contesta lo que le digas.
// Uso: node fig06_04.ts <respuesta>...    (una respuesta por petición; la última se repite)
//   201           responde 201 con un cuerpo de juguete
//   503:2         responde 503 con «Retry-After: 2» (el número después de los dos puntos son los segundos)
//   409:en-curso  responde el 409 de «llave en curso»; 409 a secas es otro 409
//   mudo          acepta la conexión y no contesta nunca
import { createServer } from "node:http";

const pedidas = process.argv.slice(2);
if (pedidas.length === 0) {
  console.error("uso: node fig06_04.ts <respuesta>...   (por ejemplo: 503:2 201)");
  process.exit(2);
}
let peticiones = 0;
createServer((peticion, respuesta) => {
  peticion.resume();
  const pedida = pedidas[Math.min(peticiones, pedidas.length - 1)];
  peticiones++;
  console.log(`petición ${peticiones}: ${pedida}`);
  if (pedida === "mudo") return;
  const [codigo, extra] = pedida.split(":");
  const estado = Number(codigo);
  const bien = estado < 300;
  const cabeceras: Record<string, string> = { "Content-Type": bien ? "application/json" : "application/problem+json" };
  if (!bien && extra !== undefined && extra !== "en-curso") cabeceras["Retry-After"] = extra;
  const tipo = estado === 409 && extra === "en-curso" ? "https://revisor.example/problemas/llave-en-curso" : "about:blank";
  const cuerpo = bien ? { id: 99 } : { type: tipo, title: "respuesta de mentira", status: estado };
  respuesta.writeHead(estado, cabeceras);
  respuesta.end(JSON.stringify(cuerpo) + "\n");
}).listen(18082, "127.0.0.1", () => console.log("servidor de mentira en http://127.0.0.1:18082"));
```

Una respuesta por petición, y la última se repite. `503:2` es un `503` con `Retry-After: 2`; `409:en-curso` es el `409` de la llave en curso (con su `type`, que es lo que mira `alta-segura.ts`); `mudo` acepta la conexión y no contesta. Detén la pasarela con `Ctrl+C` (en la corrida, por su PID) y arranca el servidor de mentira en su lugar, en otra terminal. Primero, un `503` que pide dos segundos y luego un `201`:

```text
$ node fig06_04.ts 503:2 201

$ node alta-segura.ts paciente http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 503 {"type":"about:blank","title":"respuesta de mentira","status":503}
  el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: 503:2
petición 2: 201
```

El renglón de espera cambió de forma: «el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave». Ya no es un sorteo entre 0 y un techo, es lo que pidió el servidor. El segundo intento recibe el `201` y el programa sale con `0`. La terminal del servidor de mentira confirma que recibió exactamente dos peticiones.

**El `409` de «llave en curso» no es final.** Es el `409` que viste en 6.6.4: la petición original sigue guardándose. Un cliente que recibe este `409` no tiene nada que corregir; espera y repite. `alta-segura.ts` lo reconoce por el `type` de Problem Details (no por el título ni por el detalle) y lo trata como cualquier falla pasajera:

```text
$ node fig06_04.ts 409:en-curso 201

$ node alta-segura.ts en-curso http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 409 {"type":"https://revisor.example/problemas/llave-en-curso","title":"respuesta de mentira","status":409}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: 409:en-curso
petición 2: 201
```

El mismo `409` con otro `type` (el que usa el `revisor` para un nombre repetido) no se reintenta: repetir no cambiaría el nombre.

```text
$ node fig06_04.ts 409

$ node alta-segura.ts repetida http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 409 {"type":"about:blank","title":"respuesta de mentira","status":409}
el servidor respondió 409: repetir lo mismo no lo arregla
(código de salida: 1)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: 409
```

Una sola petición en la terminal del servidor de mentira, `1` de salida. Dos `409`, dos decisiones, y lo que las separa es el `type`. Esa es la idea que la Lección 7 convierte en una tabla.

¿Cuándo se ve el `409` de «en curso» con el `revisor` de verdad? Con el límite de 2,000 ms por omisión, casi nunca: el `revisor` tarda 500 ms en guardar, así que cuando un intento se corta por tiempo, la original ya terminó y el reintento recibe el `201` grabado. Solo aparece si el límite es menor que el guardado. Se midió bajando el límite a 150 ms con `ALTA_LIMITE_MS=150` y repitiendo el alta hasta que el reintento llegó antes de que terminara la original, y hace falta repetirla varias veces porque depende de cuándo cae la espera sorteada. Por eso se prueba con el servidor de mentira, que contesta lo que se le dice.

**Un servidor que no contesta se corta por tiempo.** Cada intento lleva un límite (2,000 ms por omisión). Con `ALTA_LIMITE_MS=300`, para no esperar tanto en la corrida:

```text
$ node fig06_04.ts mudo

$ ALTA_LIMITE_MS=300 node alta-segura.ts muda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (tiempo agotado: 300 ms)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave f4e16950-99e9-4504-86b8-c95e2c52cc04 es seguro
(código de salida: 1)

--- terminal del servidor de mentira:
servidor de mentira en http://127.0.0.1:18082
petición 1: mudo
petición 2: mudo
petición 3: mudo
petición 4: mudo
```

Cada intento se corta a los 300 ms y el programa lo cuenta como «sin respuesta (tiempo agotado: 300 ms)»: es el mismo caso que el `502` o la conexión rechazada, y se reintenta igual. Cuatro intentos, cuatro peticiones en la terminal del servidor, y la salida honesta de siempre. Sin el límite, el primer intento tardaría unos 300 s en rendirse.

### 6.6 `Idempotency-Key`: un borrador, no un estándar

#### 6.6.1 Qué es y en qué estado está

La idea es vieja y la usan muchas APIs grandes: el cliente inventa un identificador único para cada operación que quiere hacer una sola vez, lo manda en una cabecera, y el servidor recuerda qué respondió a ese identificador. Si llega otra vez, en vez de procesar la petición de nuevo, repite la respuesta que ya dio. La documentación de Stripe lo explica así: si ocurre un error de conexión, puedes repetir la petición sin riesgo de crear un segundo objeto o de aplicar el cambio dos veces.

El grupo de trabajo `httpapi` de la IETF intentó estandarizar esa cabecera como `Idempotency-Key`. La última versión es [`draft-ietf-httpapi-idempotency-key-header-07`](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07), del 15 de octubre de 2025, de Jayadeba Jena y Sanjay Dalal, y **venció el 18 de abril de 2026 sin publicarse como RFC**. La página del documento en el Datatracker de la IETF lo marca como «Expired Internet-Draft»: su estado previsto era Standards Track, pero ningún RFC salió de él. Dicho sin rodeos: **`Idempotency-Key` no es un estándar**. Es un borrador vencido que describe un patrón que mucha gente ya usaba. El propio borrador lista en su sección de implementaciones a Stripe, Adyen y Yandex con una cabecera llamada así, y a otros que hacen lo mismo con otro nombre (PayPal usa `PayPal-Request-Id`).

¿Por qué usarlo entonces? Porque el patrón es bueno, porque el nombre es el que la mayoría reconoce, y porque el borrador escribe con cuidado los casos difíciles. Pero tu API tiene que **documentarlo como un comportamiento propio**, no como algo que HTTP garantiza. El borrador mismo lo pide: los recursos que lo usan deben publicar su especificación de idempotencia (sección 2.5.2), y un cliente genérico no puede suponer que un servidor la respeta (sección 2.5.1). Una cabecera que el servidor no conoce se ignora en silencio: si mandas `Idempotency-Key` a una API que no la implementa, tu reintento duplica igual.

#### 6.6.2 Lo que propone el borrador

Lo esencial del borrador, sección por sección, y lo que hace el `revisor` con cada cosa:

- **Sintaxis (2.1).** El valor es un *String* de los campos estructurados de HTTP, es decir, **va entre comillas**: `Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"`. El `revisor` simplifica: toma el valor tal como llega, sin quitar comillas. Para él, `alta-avisos-1` y `"alta-avisos-1"` son dos llaves distintas (lo verás en 6.7.4). Las peticiones de esta lección mandan la llave sin comillas, como hacen muchas APIs que nacieron antes del borrador; si implementas el patrón desde cero, acepta la forma del borrador.
- **Unicidad (2.2).** La llave debe ser única y no debe reutilizarse con otra petición de cuerpo distinto. El borrador recomienda un UUID u otro identificador aleatorio. `alta-segura.ts` usa `randomUUID()`; las peticiones de `curl` de la lección usan nombres legibles como `alta-avisos-1` para que puedas leer las corridas, y en un cliente real no lo harías (sección 6.7.5).
- **Vigencia (2.3).** El recurso puede hacer que las llaves caduquen, y debe publicar esa política. Es la sección 6.7.1.
- **Huella (2.4).** Junto con la llave, el servidor puede calcular una huella del cuerpo (una suma de verificación del cuerpo completo, de algunos campos, o una comparación campo por campo) para saber si la petición repetida es de verdad la misma. El `revisor` usa SHA-256 sobre el JSON ya leído.
- **Qué hacer (2.6).** Si la llave es nueva, se atiende normal. Si ya se atendió y la petición es la misma, se responde lo que se respondió la primera vez. Si llega mientras la original sigue en curso, se responde un conflicto.
- **Los errores (2.7).** `422 Unprocessable Content` si la llave se reutiliza con otro cuerpo; `409 Conflict` si llega mientras la original sigue en curso; `400` si una operación exige la llave y no viene. Los ejemplos del borrador responden con Problem Details. El borrador agrega una regla para el cliente: antes de reintentar después de uno de estos errores, el cliente tiene que corregir la petición, **salvo con el `409`**, que no pide corrección sino paciencia.

En el `revisor` la llave es **opcional**, así que no hay `400`. Los otros dos casos son los dos tipos nuevos del catálogo: `llave-reutilizada` (`422`) y `llave-en-curso` (`409`). El `409` de la llave es otro `409` distinto del de `nombre-repetido`, y la Lección 3 ya lo había anticipado: los dos son conflictos con el estado actual, pero el de la llave se resuelve esperando y el del nombre, releyendo. Por eso tienen `type` distinto, y por eso la Lección 7 decide con el `type`, no con el código.

#### 6.6.3 `idempotencia.ts`

```ts
// fig06_01/idempotencia.ts — Idempotency-Key: repetir un POST sin duplicar lo que creó.
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

Cuatro funciones y un registro. `huella` resume el cuerpo; `tomarTurno` es la que decide: busca la llave **dentro de la credencial** (`${credencial}:${llave}`), y si no existe la aparta con su huella y sin respuesta grabada (`grabada: null`), que es lo que significa «en curso». Si existe con otra huella, es `otra-peticion`; si existe sin respuesta grabada, `en-curso`; si existe con respuesta, `repetir`. `grabar` guarda la respuesta cuando el alta termina bien. `soltar` borra el registro cuando el alta falla sin crear nada, para que un reintento corregido pueda pasar.

Y el alta, en `servicios.ts`, la usa así (fragmento; el archivo completo está en 6.8.1):

```ts
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
```

Dónde está este bloque importa tanto como lo que hace. Va **después** de `leerJson`, así que un cuerpo que no es JSON, que pasa de 16 KiB o que no es un objeto se rechaza antes de mirar la llave, como en la Lección 5: no hay huella posible de algo que no se pudo leer. Y va **antes** de `validar`, del chequeo de destino y de la búsqueda del nombre, porque la llave tiene que apartarse antes de que empiece el trabajo que podría duplicarse. Si alguna de esas tres cosas falla, el alta llama a `soltar`. Si todo sale bien, el alta arma la respuesta, la graba y la envía.

Para que se pueda ver el `409` de «en curso», el alta espera 500 ms simulados antes de guardar (`GUARDAR_MS`). En una API real esa espera es la base de datos, otra API o una cola: el tiempo en que la llave está apartada y la respuesta todavía no existe.

#### 6.6.4 La misma llave, tres desenlaces

Con los tres programas recién arrancados, manda la misma alta dos veces con la misma llave:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-0cabc364"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-0cabc364"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Dos respuestas idénticas, byte por byte: el mismo `201`, el mismo `Location: /servicios/7`, la misma `ETag`. El segundo `POST` no creó nada: la terminal del `revisor` lo dice, `idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta`. El cliente que reintenta recibe lo que habría recibido la primera vez, y no tiene que interpretar ningún `409`.

Ahora la misma llave con otro cuerpo, otro nombre:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 228
Date: Wed, 21 Oct 2026 22:26:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}
```

`422`, `llave-reutilizada`. El `revisor` no repite la respuesta de `avisos` (eso le haría creer al cliente que `correo` se creó) ni crea `correo` (la llave ya tenía dueño). Responde que el cliente usó mal la llave, y el borrador le pide al cliente corregir antes de reintentar: una llave nueva para una operación nueva.

Y dos peticiones con la misma llave casi al mismo tiempo. La primera se manda en segundo plano y la segunda 100 ms después, mientras la primera todavía está en los 500 ms de guardar:

```text
$ ( curl -o /dev/null -w 'primera: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}' & sleep 0.1; curl -w '\nsegunda: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'; wait )
{"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409,"detail":"la petición original con la llave alta-correo-1 todavía no termina","instance":"/servicios"}

segunda: 409
primera: 201
```

La segunda recibió `409` `llave-en-curso` y terminó primero; la primera terminó después con `201`. Si el `revisor` no apartara la llave al empezar, la segunda no recibiría `llave-en-curso`: esperaría sus 500 ms, encontraría el `correo` que acaba de crear la primera y respondería `409 nombre-repetido`. (Se midió: dos altas sin llave con el mismo nombre, la segunda 100 ms después, dieron `201` y `409`, y quedó un solo `correo`; en el `revisor`, buscar el nombre y crear el servicio ocurren juntos, sin ningún `await` de por medio.) Es la duda de la escena: un `409` que no dice si el servicio es tuyo. Y en un `POST` sin un campo único, como pedir una revisión, las dos habrían creado algo. Apartar la llave sin ningún `await` de por medio (`tomarTurno`) convierte esa duda en una respuesta clara: «tu petición original sigue en curso». Un cliente que recibe este `409` no tiene nada que corregir: espera un poco y repite, y recibirá el `201` grabado. `alta-segura.ts` lo hace (6.5.4).

#### 6.6.5 El cliente que reintenta con la misma llave

Ahora sí, la escena con llave. En la misma serie:

```text
$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
(código de salida: 0)
```

El primer intento recibió `502`: el `revisor` creó `agenda` (id 9) y la pasarela tiró la respuesta. El segundo intento llevaba la misma llave, el `revisor` la reconoció y repitió su `201` con el cuerpo de `agenda`. Esta vez la pasarela lo dejó pasar porque ya había visto esa llave. **El cliente recibió la respuesta que se había perdido**, y no tuvo que adivinar nada.

La lista del equipo y las dos terminales confirman que nada se duplicó:

```text
$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":8,"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":10,"nombre":"nomina2","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
idempotencia: la llave bf0d47f7-f895-4945-8e27-2215869c5fc8 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
GET /servicios

--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor respondió 201, pero la respuesta se pierde
```

Un servicio por nombre: `avisos` (7), `correo` (8), `agenda` (9) y `nomina2` (10, el de la sección 6.5.2, que se corrió en esta misma serie). En la terminal del `revisor` hay dos renglones de idempotencia: el de `alta-avisos-1` y el de la llave que inventó `alta-segura.ts`. En la de la pasarela, dos respuestas perdidas, la de `agenda` y la de `nomina2`, las dos de un `201`. La escritura ocurrió en los dos casos; la diferencia es que con llave el cliente se enteró.

### 6.7 Los límites de la llave

Hasta aquí, la llave parece mágica. No lo es, y prometer «repite sin duplicar nada» sin decir dónde termina la promesa es una forma de mentir. Estas son sus fronteras, cada una con una corrida. Todas son de una serie nueva, con los tres programas recién arrancados.

#### 6.7.1 Cuánto dura

En el `revisor`, una llave dura **lo que dura el proceso**: el registro vive en un `Map` en memoria, sin vencimiento, y se pierde al reiniciar. Es lo mínimo para enseñar, y tiene dos problemas en una API real: la memoria crece con cada alta, y un reinicio olvida todas las llaves (al final de esta sección lo ves).

El borrador deja la duración a cada API, con una condición: que la publique (sección 2.3). Stripe, por ejemplo, documenta que puede borrar las llaves cuando tienen al menos 24 horas, y que si una llave se reutiliza después de borrada, la petición se trata como nueva. Esa es la frontera que hay que entender: **después de que la llave vence, el reintento ya no está protegido**. Si tu cliente reintenta durante horas (una cola que se atasca, un trabajo que se reanuda al día siguiente), tiene que reintentar dentro de la vigencia, o aceptar que puede duplicar. El ejercicio 3 te pide agregarle vigencia a `idempotencia.ts` y ver qué pasa cuando vence.

#### 6.7.2 Qué pasa si cambia el cuerpo

«El mismo cuerpo» depende de cómo se calcule la huella. El `revisor` la calcula sobre el JSON **ya leído**, con `JSON.stringify(datos)`. Eso tiene consecuencias que conviene ver:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{ "nombre" : "avisos" ,  "url" : "http://127.0.0.1:18081/codigo/200" }'
201 /servicios/7

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"url":"http://127.0.0.1:18081/codigo/200","nombre":"avisos"}'
{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}
 [422]

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}'
{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}
 [422]
```

El primer `POST` crea `avisos`. El segundo trae los mismos datos con espacios por todos lados, y el `revisor` repite el `201`: los espacios se pierden al leer el JSON, así que la huella es la misma. El tercero trae los mismos dos campos **en otro orden**, y el `revisor` responde `422`: `JSON.stringify` respeta el orden en que llegaron los campos, así que para la huella es otro cuerpo. Y el cuarto agrega `"limite_ms":2000`, que es justo el valor por omisión: el servicio que resultaría es idéntico, y aun así es `422`.

¿Está mal? Es una decisión, y es la conservadora. El borrador acepta varias formas de huella (2.4), y todas tienen el mismo dilema: una huella estricta rechaza peticiones que «significan» lo mismo, y una huella laxa acepta peticiones que no son la misma. El `revisor` prefiere rechazar: un `422` le dice al cliente que algo cambió, y el cliente lo puede arreglar; aceptar un cuerpo distinto como si fuera el mismo esconde el error (es el segundo defecto de «El error que vas a ver»). La consecuencia para el cliente es simple: **un reintento manda los mismos bytes que el original**, no «un cuerpo equivalente». `alta-segura.ts` lo cumple porque arma el cuerpo una vez por intento con los mismos datos y en el mismo orden.

#### 6.7.3 Qué pasa si el alta falla

```text
$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"ftp://agenda"}'
{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
 [422]

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/8
```

El primer `POST` con `alta-agenda-1` trae una dirección `ftp` y recibe `422` `datos-invalidos`. El segundo, con la misma llave y la dirección corregida, crea el servicio. Si el `revisor` hubiera grabado el `422`, el reintento corregido habría recibido otra vez el `422` (o un `422` de llave reutilizada, porque el cuerpo cambió): el cliente no habría podido corregir su error sin inventar otra llave.

Aquí el `revisor` se aparta a propósito de la letra del borrador. La sección 2.6 dice que, si la petición se reintenta cuando la original ya terminó, se responde el resultado de la operación anterior, «success or an error». El `revisor` **solo graba los éxitos**, y libera la llave cuando el alta falla sin crear nada: datos imposibles, destino prohibido o nombre repetido. La razón es que esos errores no tienen efecto que proteger; no hay nada que duplicar. Stripe va más lejos que el `revisor` en la otra dirección: en su API v1 guarda el código y el cuerpo de la primera petición en cuanto el endpoint empieza a ejecutarse, incluidos los errores `500`, y solo deja fuera dos casos: cuando los parámetros no pasan la validación y cuando la petición choca con otra que se está ejecutando; esas dos se pueden reintentar. La coincidencia con el `revisor` está en esos dos casos; la diferencia, en que el `revisor` tampoco graba los errores que ocurren después, y puede liberar la llave porque sus tres errores ocurren antes de crear nada. Si tu API tiene operaciones que fallan *a medias* (cobró, pero no guardó el recibo), esta política ya no basta: hay que grabar el error, o mejor, terminar el trabajo pendiente.

#### 6.7.4 Lo que la llave no cubre

**La respuesta grabada no es el estado actual.** En la misma serie, retira el servicio 7 y repite el alta original de `avisos` con su llave:

```text
$ curl -o /dev/null -w '%{http_code}\n' -X DELETE http://127.0.0.1:18080/servicios/7 -H 'Authorization: Bearer escritura-a'
204

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-5f8dc707"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:25:53 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/7 -H 'Authorization: Bearer escritura-a'
410
```

El `revisor` repitió fielmente su `201` con `Location: /servicios/7`, y `/servicios/7` responde `410`. No es un error: la llave promete la misma *respuesta*, no que el recurso siga ahí. Un cliente que reintenta y recibe la respuesta grabada sabe que su operación ocurrió una vez; lo que pasó después con el recurso es otra pregunta, y se contesta leyéndolo.

**La llave es de quien la manda.** `escritura-b` usa la misma llave `alta-agenda-1` con el mismo cuerpo:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/9
```

`201`, un servicio nuevo, el 9, del equipo b. Para el `revisor` no es la misma llave, porque el registro va por credencial (`${credencial}:${llave}`). Es lo que pide la sección de seguridad del borrador, y lo explica el recuadro 6.7.5.

**El texto exacto de la llave.** La misma llave entre comillas, como la escribe el borrador:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: "alta-agenda-1"' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
409 
```

Para el `revisor`, `"alta-agenda-1"` con comillas es otra llave, así que el alta se procesó como nueva y la detuvo la red del nombre repetido (`409`, sin `Location`). Un cliente que siguiera el borrador al pie de la letra y un servidor que no quita las comillas no se entienden; por eso el borrador pide publicar el formato de la llave y validarlo.

**Un reinicio.** Se detiene el `revisor` y se vuelve a arrancar, y se repite el alta de `agenda` con la llave que ya había funcionado:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
POST /servicios
POST /servicios
DELETE /servicios/7
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
GET /servicios/7
POST /servicios
POST /servicios
revisor en http://127.0.0.1:18080
POST /servicios
```

`201` con el id 7: un `revisor` recién arrancado no recuerda ni la llave ni el servicio. En este curso no hace daño, porque se perdió todo junto; en una API real que guarda los servicios en una base de datos y las llaves en memoria, el reinicio olvidaría las llaves y conservaría los servicios, y el reintento duplicaría. **Las llaves se guardan donde se guarda lo que protegen**, y si puede ser, en la misma transacción.

Y hay dos fronteras que no necesitan corrida. La llave **solo protege lo que hace el `revisor`**: si el alta mandara un correo de bienvenida o llamara a otra API, la llave del `revisor` no evita que ese correo o esa llamada se repitan, a menos que se los proteja también. Y la llave **solo existe en el `POST /servicios`**. Pedir una revisión, `POST /servicios/{id}/revisiones`, no tiene llave en este curso: dos peticiones crean dos revisiones, como viste en 6.2.2. Los `PUT` y `DELETE` no la necesitan, porque ya son idempotentes; Stripe dice lo mismo de sus `GET` y `DELETE`: mandar una llave ahí no tiene efecto.

#### 6.7.5 Recuadro de seguridad: la llave es de quien la manda

Una tabla de llaves es, en la práctica, una caché de respuestas: quien presenta la llave recibe la respuesta grabada. Si el `revisor` buscara la llave sola, sin la credencial, cualquiera que adivinara la llave de otro equipo recibiría el `201` de ese equipo, con el id, el nombre y la dirección del servicio. El borrador lo advierte en su sección de seguridad: una implementación que acepta llaves de poca entropía permite que un atacante adivine las de otros clientes y lea sus respuestas guardadas. Y propone dos defensas. El `revisor` tiene la primera: una llave compuesta, que combina la llave del cliente con algo que solo el servidor conoce del cliente (aquí, la credencial con la que se autenticó). La segunda, un formato fijo y publicado para la llave que se valida antes de procesar nada, la tiene a medias: solo exige que no esté vacía. Una API real pediría un UUID.

Dos cosas más. Las llaves legibles de las peticiones de esta lección, como `alta-avisos-1`, son para que puedas leer las corridas: un cliente real usa un UUID aleatorio, como `alta-segura.ts`. Y la llave no debe contener datos personales: la documentación de Stripe pide no usar correos ni identificadores de personas, porque la llave termina en bitácoras. En el `revisor` también: la terminal registra la llave (`idempotencia: la llave … ya se atendió`), nunca la credencial.

### 6.8 El `revisor` completo

#### 6.8.1 Los archivos que cambian

Si tienes la carpeta de la Lección 5, cópiala como `~/curso-http/fig06_01/`. Ya viste completos `idempotencia.ts` (6.6.3), `pasarela.ts` (6.5.1) y `alta-segura.ts` (6.5.2). Estos son los otros cuatro que cambian.

`problemas.ts`: dos tipos nuevos en el catálogo, `llave-en-curso` y `llave-reutilizada`.

```ts
// fig06_01/problemas.ts — el manejador central de errores: cada error sale como Problem Details (RFC 9457).
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

`cliente.ts`: `clasificar` sale de `revisar` para que `revisarConReintentos` la pueda usar con la última consulta, y al final llegan el retroceso con *jitter* y los reintentos.

```ts
// fig06_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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

`servicios.ts`: el alta lee `Idempotency-Key`, aparta la llave, la suelta si falla y graba la respuesta si sale bien; las revisiones usan `revisarConReintentos`.

```ts
// fig06_01/servicios.ts — lo que hace cada ruta de la API del revisor.
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

`respuestas.ts`: el `413` ya no pierde la carrera contra un cliente que sigue enviando. En las lecciones anteriores, cuando el cuerpo pasaba del tope el `revisor` contestaba `413` con `Connection: close` y Node destruía la conexión en cuanto terminaba de responder. Si el cliente todavía estaba mandando, lo que llegaba a una conexión ya cerrada se contestaba con un `RST` del sistema operativo, y ese `RST` puede borrar el `413` antes de que el cliente lo lea ([RFC 9112, sección 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6)). El cliente veía `EPIPE` o `ECONNRESET` en lugar de un `413`. La misma sección aconseja cerrar en etapas: responder, cerrar solo la escritura (media cerrada), seguir leyendo un tiempo y, solo entonces, cerrar del todo. Eso hace `cerrarConCalma`: Node, al terminar una respuesta con `Connection: close`, llama a `socket.destroySoon()`, que cierra y destruye; en esa conexión se cambia ese método por uno que solo cierra la escritura (`socket.end()`), se sigue leyendo y tirando lo que llegue (`peticion.resume()`), y un temporizador de 2 segundos destruye la conexión si el cliente no la cierra antes. El `413` sale de inmediato, sin esperar a que el cliente termine de mandar.

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

Se midió aislada, contra un `revisor` recién arrancado, con 400 peticiones seguidas de 20,000 bytes enviados por partes (20 trozos de 1,000 bytes, con `fetch` de Node): sin el cierre en etapas, 380 dieron `413` y 20 fallaron (17 con `EPIPE` y 3 con `ECONNRESET`); con él, 400 de 400. Con cuerpos grandes, de 3 MiB y de 20 MiB enviados por partes, 100 de 100 dieron `413`. Con `Content-Length` de 20,000 bytes y con `curl -T -` dieron 400 de 400 en todas las versiones: la carrera existía, pero aparece sobre todo cuando el cliente manda por trozos. Un cliente que no cierra su lado no retiene la conexión: el `revisor` la destruye a los 2 segundos (la conexión pasa por `FIN_WAIT_2` y a los 3.5 s ya no existe). El archivo completo está en 6.8.2.

#### 6.8.2 Los archivos que no cambian

Los demás archivos son los de la Lección 5, sin un solo cambio, salvo dos que van aquí completos: `respuestas.ts`, que cambió en la lectura del cuerpo (6.8.1), y `laboratorio.ts`, cuyo banco ya no manda cuerpo en un `205` (una respuesta `205` no lleva contenido, RFC 9110, sección 15.3.6; sale con `Content-Length: 0` y sin `Transfer-Encoding`, porque el `205` no se enmarca solo, RFC 9112, sección 6.3). Ninguna corrida de esta lección pide un `205`. Van completos para que el `revisor` se pueda armar desde esta lección:

```ts
// fig06_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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
// fig06_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig06_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig06_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig06_01/laboratorio.ts
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
// fig06_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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
// fig06_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
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
// fig06_01/respuestas.ts — las respuestas de éxito del revisor y la lectura del cuerpo. Los errores, en problemas.ts.
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
// fig06_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
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
// fig06_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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
// fig06_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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

```json fig06_01/package.json
{
  "type": "module"
}
```

#### 6.8.3 La corrida completa

Con los tres programas recién arrancados en `~/curso-http/fig06_01/`, estas son las peticiones de la lección en orden, juntas: la misma llave dos veces, la misma llave con otro cuerpo, las dos a la vez, el cliente con y sin llave a través de la pasarela, la lista, y una revisión de `pagos`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-68f9abf8"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 23:34:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-68f9abf8"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 23:34:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 228
Date: Wed, 21 Oct 2026 23:34:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/llave-reutilizada","title":"Esa Idempotency-Key ya se usó con otra petición","status":422,"detail":"la llave alta-avisos-1 ya se usó con un cuerpo distinto","instance":"/servicios"}

$ ( curl -o /dev/null -w 'primera: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}' & sleep 0.1; curl -w '\nsegunda: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'; wait )
{"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409,"detail":"la petición original con la llave alta-correo-1 todavía no termina","instance":"/servicios"}

segunda: 409
primera: 201

$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
(código de salida: 0)

$ node alta-segura.ts nomina2 http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 409 {"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado nomina2","instance":"/servicios","existente":"/servicios/10"}
el servidor respondió 409: repetir lo mismo no lo arregla; sin llave no se sabe si lo que ya existe lo creó un intento anterior
(código de salida: 1)

$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":8,"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":10,"nombre":"nomina2","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ sleep 2
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":17,"detalle":"503 (reintentar en 120 s)"}}
```

La revisión de `pagos` es la misma de la Lección 4, y ahora con un motivo: pasó por `revisarConReintentos`, el servicio pidió 120 s, y como pasa del tope de 5 s, el `revisor` no insistió y conservó el aviso en el detalle.

#### 6.8.4 Lo demás sigue funcionando

Los rechazos de SSRF, las peticiones condicionales, la actualización perdida con dos `PUT` a la vez, el orden del `PUT`, el esquema de la credencial, el método con nombre de `Object.prototype`, el tope del cuerpo, el cuerpo que no es un objeto, los rangos de SSRF, el límite de consultas en vivo por credencial, el `502` de un servicio que corta la conexión, la lectura estricta de `Retry-After` y la etiqueta tras reiniciar: nada de eso cambió. Esta es la misma corrida, a continuación. Casi al final se apaga el `revisor` y después la pasarela (`$REV` y `$PAS` son los PID que guardó el guion que arrancó los programas; tú los detendrías con `Ctrl+C`). `esperar_puerto` es una función de ese guion: espera hasta 10 s a que el puerto acepte conexiones, en lugar de dormir un tiempo fijo después de arrancar un programa, para repetir los casos de 6.5.3 (la pasarela que contesta `502` y `alta-segura.ts` con los intentos agotados, con y sin pasarela); se vuelven a arrancar los dos, y entre la penúltima y la última petición se reinicia el `revisor` otra vez:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 235
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: localhost resuelve a una dirección privada o reservada","instance":"/servicios"}

$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'); echo "ETAG=$ETAG"
ETAG="1-1-68f9abf8"

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: W/$ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-68f9abf8"
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5


$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: \"9-9\", $ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-68f9abf8"
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5


$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: *'
HTTP/1.1 304 Not Modified
ETag: "1-1-68f9abf8"
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5


$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: "9-9", W/"8-8"'
HTTP/1.1 200 OK
ETag: "1-1-68f9abf8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json
Content-Language: es
Content-Length: 263
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-68f9abf8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-68f9abf8"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 23:34:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-3-68f9abf8"

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
ID=/servicios/11 ETAG="11-1-68f9abf8"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}' ) | curl -w ' <- PUT lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
{"type":"https://revisor.example/problemas/servicio-retirado","title":"El servicio se retiró","status":410,"detail":"el servicio 11 se retiró y no va a volver","instance":"/servicios/11"}
 <- PUT lento: 410

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 800
Date: Wed, 21 Oct 2026 23:34:46 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":8,"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":10,"nombre":"nomina2","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Basic bGVjdHVyYS1hOg=='
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 185
Date: Wed, 21 Oct 2026 23:34:46 GMT
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
Date: Wed, 21 Oct 2026 23:34:46 GMT

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
Date: Wed, 21 Oct 2026 23:34:46 GMT
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
ID=/servicios/12

$ curl -i http://127.0.0.1:18080$ID/salud -H 'Authorization: Bearer admin'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Language: es
Content-Length: 280
Date: Wed, 21 Oct 2026 23:34:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/respuesta-invalida","title":"El servicio no dio una respuesta HTTP válida","status":502,"detail":"el servicio 12 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP","instance":"/servicios/12/salud"}

$ TZ=America/Mexico_City node --input-type=module -e 'import { segundosDeEspera } from "./cliente.ts"; for (const v of ["120", "1.5", "-1", "12 30"]) console.log(JSON.stringify(v), "->", segundosDeEspera(v)); const imf = segundosDeEspera("Fri, 01 Jan 2100 00:00:00 GMT"), asc = segundosDeEspera("Fri Jan  1 00:00:00 2100"); console.log("asctime menos IMF-fixdate (misma fecha):", asc - imf, "s")'
"120" -> 120
"1.5" -> null
"-1" -> null
"12 30" -> null
asctime menos IMF-fixdate (misma fecha): 0 s

$ kill $REV; wait $REV 2>/dev/null

$ curl -i -X POST http://127.0.0.1:18082/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Length: 115
Date: Wed, 21 Oct 2026 23:34:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}

$ node alta-segura.ts sin-revisor http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió respuesta del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 482212c7-c00e-499c-b66e-50f774613a5b es seguro
(código de salida: 1)

$ kill $PAS; wait $PAS 2>/dev/null

$ node alta-segura.ts sin-pasarela http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (ECONNREFUSED)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (ECONNREFUSED)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (ECONNREFUSED)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (ECONNREFUSED)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave bb5d6748-d1cc-4a88-b665-48721b90a18c es seguro
(código de salida: 1)

$ node -e 'require("node:net").createServer(() => {}).listen(18082, "127.0.0.1")' & MUDO=$!; esperar_puerto 18082

$ ALTA_LIMITE_MS=300 node alta-segura.ts mudo http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: sin respuesta (tiempo agotado: 300 ms)
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: sin respuesta (tiempo agotado: 300 ms)
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 2d5d719b-8c6b-49a0-b118-494720b1831c es seguro
(código de salida: 1)

$ kill $MUDO; wait $MUDO 2>/dev/null

$ node --input-type=module -e 'import { createServer } from "node:http"; let n = 0; createServer((q, r) => { q.resume(); if (++n === 1) { r.writeHead(503, { "Retry-After": "2", "Content-Type": "application/problem+json" }); r.end("{\"type\":\"about:blank\",\"title\":\"Service Unavailable\",\"status\":503}\n"); } else { r.writeHead(201, { "Content-Type": "application/json" }); r.end("{\"id\":99}\n"); } }).listen(18082, "127.0.0.1")' & PIDE=$!; esperar_puerto 18082

$ node alta-segura.ts paciente http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 503 {"type":"about:blank","title":"Service Unavailable","status":503}
  el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

$ kill $PIDE; wait $PIDE 2>/dev/null

$ node --input-type=module -e 'import { createServer } from "node:http"; let n = 0; createServer((q, r) => { q.resume(); if (++n === 1) { r.writeHead(409, { "Content-Type": "application/problem+json" }); r.end("{\"type\":\"https://revisor.example/problemas/llave-en-curso\",\"title\":\"Esa Idempotency-Key sigue en curso\",\"status\":409}\n"); } else { r.writeHead(201, { "Content-Type": "application/json" }); r.end("{\"id\":99}\n"); } }).listen(18082, "127.0.0.1")' & CURSO=$!; esperar_puerto 18082

$ node alta-segura.ts en-curso http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 409 {"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":99}
(código de salida: 0)

$ kill $CURSO; wait $CURSO 2>/dev/null

$ node pasarela.ts >> pasarela.log 2>&1 & PAS=$!; node servidor.ts >> servidor.log 2>&1 & REV=$!; esperar_puerto 18082; esperar_puerto 18080

$ curl -i -X POST http://127.0.0.1:18082/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"por-pasarela","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
content-type: application/json
content-length: 92
location: /servicios/7
etag: "7-1-7b8bb8f3"
Date: Wed, 21 Oct 2026 23:34:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"por-pasarela","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ node alta-segura.ts invalida ftp://archivos; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 422 {"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
el servidor respondió 422: repetir lo mismo no lo arregla
(código de salida: 1)

$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
204

$ node alta-segura.ts enmantenimiento http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 503 {"type":"https://revisor.example/problemas/en-mantenimiento","title":"El revisor está en mantenimiento","status":503,"detail":"el revisor está en mantenimiento","instance":"/servicios"}
el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta; repetir más tarde con la llave ffdfd2cf-5288-4266-8637-68d792db78f5 es seguro
(código de salida: 1)

$ curl -o /dev/null -w '%{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
204

$ ANTES=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'); echo "ANTES=$ANTES"
ANTES="3-1-7b8bb8f3"

$ kill $REV; wait $REV 2>/dev/null; node servidor.ts >> servidor.log 2>&1 & REV=$!; esperar_puerto 18080

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b' -H "If-None-Match: $ANTES"
HTTP/1.1 200 OK
ETag: "3-1-223a2357"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 23:34:57 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Y las dos terminales de la corrida completa. La del `revisor` registra método y ruta de cada petición, los dos renglones de idempotencia y los dos arranques que siguen al primero (uno por cada reinicio, que ves como un segundo y un tercer «revisor en…»); la de la pasarela, las dos respuestas que perdió, los cinco «el revisor no respondió» (el `curl` y los cuatro intentos de `sin-revisor`) y su segundo arranque:

```text
--- terminal del revisor (la carpeta de la máquina se escribe <carpeta>):
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
idempotencia: la llave 00baad42-25bb-4f27-adbd-fa28abaf50fb ya se atendió; repito su respuesta
POST /servicios
POST /servicios
GET /servicios
POST /servicios/2/revisiones
GET /revisiones/1
POST /servicios
POST /servicios
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
GET /servicios/11
PUT /servicios/11
DELETE /servicios/11
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
GET /servicios/12/salud
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
POST /servicios
PUT /mantenimiento
operación: mantenimiento encendido
POST /servicios
POST /servicios
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios/3
revisor en http://127.0.0.1:18080
GET /servicios/3
--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela: el revisor no respondió
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 422, pero la respuesta se pierde
pasarela: el revisor respondió 503, pero la respuesta se pierde
```

### 6.9 Comprobarlo con un programa

Como en la Lección 5, lo que se puede comprobar a mano se comprueba con un programa. `fig06_03.ts` hace cinco pruebas contra el alta, cada una con nombres y llaves nuevos, para que se pueda correr las veces que quieras sin reiniciar el `revisor`: la misma llave dos veces deja un solo servicio; la misma llave con otro cuerpo da `422` `llave-reutilizada` y no crea nada; la misma llave mientras la original sigue en curso da `409` `llave-en-curso`; un alta que falla libera la llave; y dos llaves distintas con el mismo cuerpo chocan con el nombre. Esa última no prueba la llave, prueba su frontera: la llave no convierte dos intenciones en una.

```ts
// fig06_03.ts — comprueba que el alta del revisor respete Idempotency-Key como propone el borrador de la IETF.
// Uso: node fig06_03.ts [base]     (por omisión, http://127.0.0.1:18080)
// Cada corrida usa nombres y llaves nuevos, así que se puede repetir sin reiniciar el revisor.
import { randomUUID } from "node:crypto";

const BASE = process.argv[2] ?? "http://127.0.0.1:18080";
const URL_LAB = "http://127.0.0.1:18081/codigo/200";
const PROBLEMAS = "https://revisor.example/problemas/";
const marca = randomUUID().slice(0, 8);

type Respuesta = { codigo: number; location: string | null; cuerpo: Record<string, unknown> };

async function alta(llave: string, datos: Record<string, unknown>): Promise<Respuesta> {
  const respuesta = await fetch(BASE + "/servicios", {
    method: "POST",
    headers: { Authorization: "Bearer escritura-a", "Content-Type": "application/json", "Idempotency-Key": llave },
    body: JSON.stringify(datos),
  });
  return { codigo: respuesta.status, location: respuesta.headers.get("location"), cuerpo: await respuesta.json() };
}

async function cuantos(nombre: string): Promise<number> {
  const respuesta = await fetch(BASE + "/servicios", { headers: { Authorization: "Bearer escritura-a" } });
  const { servicios } = (await respuesta.json()) as { servicios: { nombre: string }[] };
  return servicios.filter((s) => s.nombre === nombre).length;
}

type Caso = { nombre: string; probar: () => Promise<string | null> };

const CASOS: Caso[] = [
  {
    nombre: "misma llave y mismo cuerpo: la misma respuesta, un solo servicio",
    probar: async () => {
      const datos = { nombre: `uno-${marca}`, url: URL_LAB };
      const primera = await alta(`k1-${marca}`, datos);
      const segunda = await alta(`k1-${marca}`, datos);
      if (primera.codigo !== 201) return `la primera dio ${primera.codigo}, se esperaba 201`;
      if (segunda.codigo !== 201 || segunda.location !== primera.location) {
        return `la segunda dio ${segunda.codigo} ${segunda.location}, se esperaba 201 ${primera.location}`;
      }
      const n = await cuantos(datos.nombre);
      return n === 1 ? null : `hay ${n} servicios con ese nombre, se esperaba 1`;
    },
  },
  {
    nombre: "misma llave con otro cuerpo: 422 llave-reutilizada, y no crea nada",
    probar: async () => {
      await alta(`k2-${marca}`, { nombre: `dos-${marca}`, url: URL_LAB });
      const otra = await alta(`k2-${marca}`, { nombre: `otro-${marca}`, url: URL_LAB });
      if (otra.codigo !== 422 || otra.cuerpo.type !== PROBLEMAS + "llave-reutilizada") {
        return `dio ${otra.codigo} ${String(otra.cuerpo.type ?? "")}, se esperaba 422 llave-reutilizada`;
      }
      const n = await cuantos(`otro-${marca}`);
      return n === 0 ? null : `se creó el servicio del segundo cuerpo (${n})`;
    },
  },
  {
    nombre: "misma llave mientras la original sigue en curso: 409 llave-en-curso",
    probar: async () => {
      const datos = { nombre: `tres-${marca}`, url: URL_LAB };
      const original = alta(`k3-${marca}`, datos);
      await new Promise((listo) => setTimeout(listo, 100));
      const durante = await alta(`k3-${marca}`, datos);
      const primera = await original;
      if (durante.codigo !== 409 || durante.cuerpo.type !== PROBLEMAS + "llave-en-curso") {
        return `la de en medio dio ${durante.codigo} ${String(durante.cuerpo.type ?? "")}, se esperaba 409 llave-en-curso`;
      }
      return primera.codigo === 201 ? null : `la original dio ${primera.codigo}, se esperaba 201`;
    },
  },
  {
    nombre: "un alta que falla libera la llave: corregida, con la misma llave, 201",
    probar: async () => {
      const mala = await alta(`k4-${marca}`, { nombre: `cuatro-${marca}`, url: "ftp://archivos" });
      if (mala.codigo !== 422) return `el alta mala dio ${mala.codigo}, se esperaba 422`;
      const buena = await alta(`k4-${marca}`, { nombre: `cuatro-${marca}`, url: URL_LAB });
      return buena.codigo === 201 ? null : `el alta corregida dio ${buena.codigo}, se esperaba 201`;
    },
  },
  {
    nombre: "dos llaves distintas con el mismo cuerpo: la segunda choca con el nombre (409 nombre-repetido)",
    probar: async () => {
      const datos = { nombre: `cinco-${marca}`, url: URL_LAB };
      await alta(`k5a-${marca}`, datos);
      const otra = await alta(`k5b-${marca}`, datos);
      if (otra.codigo !== 409 || otra.cuerpo.type !== PROBLEMAS + "nombre-repetido") {
        return `dio ${otra.codigo} ${String(otra.cuerpo.type ?? "")}, se esperaba 409 nombre-repetido`;
      }
      const n = await cuantos(datos.nombre);
      return n === 1 ? null : `hay ${n} servicios con ese nombre, se esperaba 1`;
    },
  },
];

let bien = 0;
for (const caso of CASOS) {
  const falla = await caso.probar();
  if (falla === null) bien++;
  console.log(`${falla === null ? "ok   " : "FALLA"} ${caso.nombre}`);
  if (falla !== null) console.log(`      ${falla}`);
}
console.log();
console.log(`${bien} de ${CASOS.length} comprobaciones de idempotencia pasaron`);
process.exitCode = bien === CASOS.length ? 0 : 1;
```

```text
$ node fig06_03.ts
ok    misma llave y mismo cuerpo: la misma respuesta, un solo servicio
ok    misma llave con otro cuerpo: 422 llave-reutilizada, y no crea nada
ok    misma llave mientras la original sigue en curso: 409 llave-en-curso
ok    un alta que falla libera la llave: corregida, con la misma llave, 201
ok    dos llaves distintas con el mismo cuerpo: la segunda choca con el nombre (409 nombre-repetido)

5 de 5 comprobaciones de idempotencia pasaron
```

Cinco de cinco, y el programa sale con código 0 (o con 1 si algo falla), así que se puede usar en un guion. Es otra pieza de la matriz de la Lección 8, que comprueba lo mismo junto con los 23 códigos.

### 6.10 Revisar los tipos con `tsc` (opcional)

Desde la carpeta del `revisor`, con el comando de la sección 0.9 de la Lección 0 más `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

No imprime nada: no hay errores. `fig06_02.ts`, `fig06_03.ts` y `fig06_04.ts` pasan el mismo comando desde la carpeta de arriba, y también las dos versiones rotas de la sección siguiente y la solución del ejercicio 3, cada una puesta sobre una copia del `revisor`.

## El error que vas a ver

### La llave que cambia en cada intento

El error más común con `Idempotency-Key` es generar la llave en el lugar equivocado: dentro del ciclo de reintentos, junto a la petición, en vez de afuera, junto a la intención. Se ve natural, porque «cada petición lleva su llave». Para provocarlo, copia `fig06_01/` como `rota/` y haz que `rota/alta-segura.ts` invente la llave otra vez en cada vuelta del `for` (la versión completa está en `defectos/llave-por-intento/alta-segura.ts`). La llave pasa de `const` a `let`, y se reasigna al empezar cada intento:

```ts
// DEFECTO A PROPÓSITO (lección 6): la llave se vuelve a inventar en cada intento, no una por intención.
let llave = opcion === "--sin-llave" ? undefined : randomUUID();
```

```ts
for (let intento = 1; intento <= INTENTOS && !terminado; intento++) {
  llave = opcion === "--sin-llave" ? undefined : randomUUID();
  const resultado = await intentar();
```

Arranca el laboratorio, el `revisor` y la pasarela desde `rota/` y da de alta `agenda`:

```text
$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 1000 ms y reintento con la misma llave
intento 3: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 2000 ms y reintento con la misma llave
intento 4: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
se agotaron los 4 intentos sin una respuesta definitiva; repetir más tarde con la llave 27448039-e4ad-4701-8fd0-597a17c28f2a es seguro
(código de salida: 1)

$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
POST /servicios
POST /servicios
GET /servicios

--- terminal de la pasarela:
pasarela en http://127.0.0.1:18082 → http://127.0.0.1:18080
pasarela: el revisor respondió 201, pero la respuesta se pierde
pasarela: el revisor respondió 409, pero la respuesta se pierde
pasarela: el revisor respondió 409, pero la respuesta se pierde
pasarela: el revisor respondió 409, pero la respuesta se pierde
```

Cuatro `502` y el cliente se rinde convencido de que falló. La lista dice otra cosa: `agenda` existe, con el id 7. Y las terminales cuentan la historia: el `revisor` recibió cuatro altas; la primera creó `agenda` y las otras tres chocaron con el nombre (`409`); la pasarela tiró las cuatro respuestas. ¿Por qué las cuatro, si la pasarela solo pierde la primera respuesta de cada petición? Porque reconoce «la misma petición» por su llave, y cada intento llevaba una nueva: para ella fueron cuatro peticiones distintas, cada una en su primera vez. Para el `revisor` también: ninguna llave se repitió, así que nunca hubo nada que repetir. **Una llave por intento es lo mismo que no tener llave**, con un agravante: el código parece protegido.

Fíjate también en lo que el programa dice de sí mismo. Cada espera anuncia «reintento con la misma llave», y es falso: el texto se armó al principio, cuando todavía había una sola llave. Y el último renglón, «repetir más tarde con la llave … es seguro», nombra la llave del cuarto intento, que no es la que creó `agenda` (esa fue la del primero, y el `revisor` no la volvió a ver). Quien siga ese consejo no está protegido contra nada. Con una llave por intento, los mensajes verdaderos de la versión correcta se vuelven mentiras que nadie nota, porque la salida parece cuidadosa: la salida de un programa es tan confiable como la lógica que la produce, y aquí el código y el texto se contradicen.

Aquí la red del nombre salvó al `revisor` del duplicado. Un `POST` sin un campo único, como pedir una revisión, habría creado cuatro. Detén los programas de `rota/` cuando termines.

### La huella que nadie compara

El segundo error es del lado del servidor: guardar la llave y olvidar la huella. Es tentador, porque «si la llave es única, el cuerpo tiene que ser el mismo». Copia otra vez `fig06_01/` como `rota2/` y borra en `rota2/idempotencia.ts` la comparación de la huella (la versión completa está en `defectos/sin-huella/idempotencia.ts`):

```ts
  // DEFECTO A PROPÓSITO (lección 6): no se compara la huella; cualquier cuerpo con esa llave «es el mismo».
```

Arranca los tres desde `rota2/` y manda las dos altas de 6.6.4, la de `avisos` y la de `correo` con la misma llave:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-9d9d764a"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:02 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-avisos-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-9d9d764a"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 22:26:02 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000},{"id":7,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

El alta de `correo` recibió `201 Created` con el cuerpo de `avisos`. Un cliente que solo mira el código cree que `correo` existe, y la lista dice que no. Es peor que un error, porque no se ve: la falla aparece días después, cuando alguien busca `correo` en el tablero. El comprobador lo encuentra:

```text
$ node fig06_03.ts
ok    misma llave y mismo cuerpo: la misma respuesta, un solo servicio
FALLA misma llave con otro cuerpo: 422 llave-reutilizada, y no crea nada
      dio 201 , se esperaba 422 llave-reutilizada
ok    misma llave mientras la original sigue en curso: 409 llave-en-curso
ok    un alta que falla libera la llave: corregida, con la misma llave, 201
ok    dos llaves distintas con el mismo cuerpo: la segunda choca con el nombre (409 nombre-repetido)

4 de 5 comprobaciones de idempotencia pasaron
```

Cuatro de cinco: la única prueba que falla es la que manda otro cuerpo con la misma llave. El arreglo es el de `fig06_01/`: comparar la huella y responder `422` cuando no coincide. Detén los programas de `rota2/` cuando termines.

## Lo que se hace mal

**Reintentar todo.** Un `400`, un `401`, un `404` o un `422` no mejoran con el tiempo: repetirlos solo gasta. Las dos preguntas de 6.3.1 van antes de cualquier reintento.

**Reintentar sin esperar, o esperando siempre lo mismo.** Sin espera, el reintento llega cuando el servidor sigue caído. Con una espera fija y sin azar, todos los clientes llegan juntos. Retroceso exponencial con *jitter*, con un tope y un número máximo de intentos.

**Cerrar de golpe tras el `413`.** Si el servidor cierra la conexión mientras el cliente sigue enviando, el `RST` puede borrar el `413` y el cliente ve un error de red en vez de la respuesta. Se cierra en etapas: se responde, se cierra la escritura, se sigue leyendo un tiempo y luego se cierra del todo (RFC 9112, sección 9.6).

**Esperar sin límite.** Un `fetch` sin tiempo máximo deja a un cliente colgado minutos con un servidor que acepta la conexión y no contesta. Cada intento lleva un límite y, si se corta, se trata como «sin respuesta».

**Salir con éxito cuando no lo hubo.** Un programa que termina con `0` después de un `422` o de un `409` le dice a quien lo llama que el alta se hizo. El `0` es solo para un alta que se hizo.

**Esperar después del último intento.** El tiempo se gasta para nada, y el cliente tarda más en enterarse de que falló. Y terminar sin decir que se agotaron los intentos (o terminar con éxito) deja al guion que lo llama sin saber qué quedó pendiente: al agotarlos, un mensaje y un código de salida distinto de cero.

**Reintentar en cada capa.** Si el navegador, la pasarela, el servicio y la biblioteca de la base de datos reintentan tres veces cada uno, una falla se multiplica por decenas. Se reintenta en un solo lugar.

**Ignorar `Retry-After`, o tomarlo como sugerencia.** Si el servidor pide 120 s y el cliente reintenta a los 2, el `429` siguiente es merecido. Si la espera que pide es más larga de lo que el cliente puede esperar, lo honesto es no reintentar y decirlo, como hace el `revisor`.

**Reintentar un `POST` sin llave.** Es la escena del principio. Si el servidor no ofrece llave, el cliente reconcilia (relee el estado) antes de repetir.

**Generar la llave en cada intento.** Es «La llave que cambia en cada intento»: el código parece protegido y no lo está.

**Guardar la llave sin la huella.** Es «La huella que nadie compara»: un cuerpo distinto recibe un éxito que no es suyo.

**Guardar la llave sin la credencial.** La tabla de llaves se vuelve una caché que cualquiera puede leer adivinando llaves (6.7.5).

**Prometer «sin duplicados» sin decir hasta cuándo.** Una llave vence, se pierde en un reinicio si vive en otro lugar que lo que protege, no cubre los efectos externos y no cubre otras rutas. Si la documentación de tu API no dice eso, tus clientes van a suponer que la llave protege más de lo que protege.

**Presentar `Idempotency-Key` como un estándar.** Es un borrador vencido. Úsalo, y escríbelo en tu documentación como lo que es.

## Ejercicios

Los cuatro se corrigen solos: cada uno termina con una corrida que te dice si acertaste. Escribe tu predicción en la [bitácora](bitacora.md) **antes** de correr nada. Para el 1 y el 4 necesitas el laboratorio, el `revisor` y la pasarela de 6.8 recién arrancados.

### Ejercicio 1 — ¿Se puede repetir?

Para cada una de estas seis operaciones, predice si es idempotente y qué responde la segunda vez. Después corre cada una **dos veces**, y compara el estado con el que esperabas:

1. `GET /servicios/1`
2. `PUT /servicios/1` con `If-Match: *` y `{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}`
3. `PUT /mantenimiento` con `admin` y `{"activo":false}`
4. `POST /servicios/1/revisiones`
5. `DELETE /servicios/1`
6. `POST /servicios` con `Idempotency-Key: ejercicio-1` y `{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}`

Pista: para cada una, imprime el código y, si aplica, la `ETag` o el `Location` con `curl -o /dev/null -w '%{http_code} %header{etag}\n'`.

### Ejercicio 2 — Las esperas de `alta-segura.ts`

Sin correr nada, contesta: si los cuatro intentos de `alta-segura.ts` reciben `502`, ¿cuántas veces espera?, ¿cuál es el techo de cada espera?, ¿cuánto puede tardar, como máximo, en rendirse (sin contar lo que tardan las peticiones)?, ¿qué imprime al final y con qué código sale? Predice también qué cambia si el alta va con `--sin-llave`. Después compara con las corridas de 6.5.3. Por último, di en una frase por qué `if (intento === INTENTOS) break;` va **antes** de la espera y no después. Para cerrar, predice el código de salida y el número de peticiones que ve `fig06_04.ts` con cada una de estas tres respuestas y comprueba con 6.5.4: `422`, `503:1 201` y `409:en-curso 201`.

### Ejercicio 3 — La llave que vence

Copia `fig06_01/` como `ej3/` y agrega a `ej3/idempotencia.ts` una vigencia: guarda en cada registro cuándo se apartó la llave, y si pasaron más de `VIGENCIA_MS` milisegundos, trata la llave como nueva. Usa 5,000 ms por omisión, para poder verla vencer, y deja que se cambie al arrancar con la variable de entorno `REVISOR_VIGENCIA_MS`.

Para saber si acertaste, arranca los tres programas desde `ej3/` y haz dos experimentos. Primero, manda el alta de `avisos` con `Idempotency-Key: vence-1` dos veces seguidas, espera seis segundos y mándala una tercera vez: predice el código de cada una. Después, da de alta `agenda` con `Idempotency-Key: vence-2`, retírala, espera seis segundos y repite el alta con la misma llave: predice el código y el id.

### Ejercicio 4 — ¿Cuántas veces llama?

Da de alta tres servicios del laboratorio, `e-504` (`/codigo/504`), `e-cortar` (`/cortar`) y `e-500` (`/codigo/500`), y pide una revisión de cada uno con `escritura-a`, más una de `reportes` (el servicio 5, `/lento/3000` con un límite de 1,000 ms) con `admin`. Antes de mirar la terminal del laboratorio, predice cuántas veces aparece cada ruta y qué `detalle` tiene cada revisión. Espera ocho segundos antes de pedir los resultados: ¿por qué tanto?

## Soluciones

### Solución 1

```text
$ for i in 1 2; do curl -o /dev/null -w 'GET: %{http_code} %header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'; done
GET: 200 "1-1-7552bbf0"
GET: 200 "1-1-7552bbf0"

$ for i in 1 2; do curl -o /dev/null -w 'PUT con *: %{http_code} %header{etag}\n' -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'; done
PUT con *: 200 "1-2-7552bbf0"
PUT con *: 200 "1-3-7552bbf0"

$ curl http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ for i in 1 2; do curl -o /dev/null -w 'PUT /mantenimiento: %{http_code}\n' -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'; done
PUT /mantenimiento: 204
PUT /mantenimiento: 204

$ for i in 1 2; do curl -o /dev/null -w 'POST revisión: %{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'; done
POST revisión: 202 /revisiones/1
POST revisión: 202 /revisiones/2

$ for i in 1 2; do curl -o /dev/null -w 'DELETE: %{http_code}\n' -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'; done
DELETE: 204
DELETE: 410

$ for i in 1 2; do curl -o /dev/null -w 'POST con llave: %{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: ejercicio-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'; done
POST con llave: 201 /servicios/7
POST con llave: 201 /servicios/7
```

1. **`GET`**: seguro e idempotente. `200` las dos veces, la misma `ETag`: nada cambió.
2. **`PUT` con `*`**: idempotente. `200` las dos veces, y el contenido queda igual (`"limite_ms":1500`), pero la `ETag` pasó de `"1-2-…"` a `"1-3-…"`: el `revisor` sube la versión en cada escritura. Es lo que dice 6.2.3: el efecto pedido es el mismo, y el servidor puede llevar su propia historia.
3. **`PUT /mantenimiento`**: idempotente. `204` las dos veces; el modo queda apagado.
4. **`POST` de revisión**: **no** idempotente. Dos revisiones, `/revisiones/1` y `/revisiones/2`.
5. **`DELETE`**: idempotente. `204` y `410`; el servicio queda retirado en los dos casos.
6. **`POST` con llave**: el método no es idempotente, pero la llave hace que repetir esta petición tenga el mismo efecto que hacerla una vez, mientras la llave siga vigente. `201` las dos veces, el mismo `Location`.

Si te equivocaste en el 2, es la trampa más común: una respuesta igual no prueba nada, y una `ETag` distinta no rompe la idempotencia.

### Solución 2

Espera **tres veces**, no cuatro: entre un intento y el siguiente hay tres huecos, y después del cuarto no queda nada que esperar. Los techos son `250 × 2^n` con tope de 2,000, para `n` igual a 1, 2 y 3: 500, 1,000 y 2,000 ms. Como máximo, tarda 3.5 segundos en rendirse, sumando los techos; con el límite de 2,000 ms por petición, 11.5 segundos en total.

Al final imprime «se agotaron los 4 intentos sin una respuesta definitiva» y sale con código `1`. Con llave agrega «repetir más tarde con la llave … es seguro»; con `--sin-llave`, en cambio, «no se sabe si el alta ocurrió», porque sin llave no hay un reintento que se pueda ofrecer como seguro. Y las esperas cambian de texto, de «con la misma llave» a «sin llave (podría duplicar)», pero no de duración: el *jitter* no depende de la llave. Las dos salidas están en `agotados.salida.txt`, que es la que muestra 6.5.3.

La línea va antes de la espera porque quien decide si dormir tiene que saber si hay algo para lo que despertar. Si fuera después, el programa dormiría hasta 2,000 ms más para descubrir que ya no hay intentos, y un guion con catorce altas fallidas perdería hasta 28 segundos así. `revisarConReintentos` resuelve lo mismo de otra forma: su espera va dentro del cuerpo del `for`, antes de la consulta siguiente, y ese cuerpo no se ejecuta cuando `intento < INTENTOS` deja de cumplirse.

Las tres respuestas del final, con el servidor de mentira: un `422` es un `4xx` que repetir no arregla, así que **una** petición y código `1`. `503:1 201` pide esperar un segundo (menos que el tope de 5 s): **dos** peticiones, la segunda un segundo después, y código `0`. `409:en-curso 201` es un `409` que sí se reintenta, con espera sorteada: **dos** peticiones y código `0`. Si contestaste que el `422` se reintenta o que el `409:en-curso` es final, repasa la tabla de 6.3.2 y el `type` del `409`.

### Solución 3

La versión completa está en `ejercicios/ej3/idempotencia.ts`:

```ts
// ejercicios/ej3/idempotencia.ts — solución del ejercicio 3: Idempotency-Key con una vigencia publicada.
// OJO: Idempotency-Key NO es un estándar. Es un borrador de la IETF
// (draft-ietf-httpapi-idempotency-key-header-07, que venció el 18 de abril de 2026 sin publicarse
// como RFC). El revisor lo usa como un patrón que su API documenta, con los códigos que propone
// el borrador: 422 si la llave se reutiliza con otra petición, 409 si la original sigue en curso.
import { createHash } from "node:crypto";

export type Grabada = { codigo: number; cabeceras: Record<string, string>; cuerpo: unknown };

type Registro = { huella: string; grabada: Grabada | null; desde: number };

// Por credencial y llave. Una API real las guarda en su base y las borra tras un plazo (p. ej. 24 h).
const registros = new Map<string, Registro>();

// Cuánto vive una llave después de su primer uso. Corta a propósito, para verla vencer en el ejercicio;
// se puede cambiar al arrancar: REVISOR_VIGENCIA_MS=86400000 node servidor.ts (24 horas).
const VIGENCIA_MS = Number(process.env.REVISOR_VIGENCIA_MS ?? 5000);

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
  // Una llave vencida se olvida: la petición se atiende como nueva, sin repetir nada.
  if (registro === undefined || Date.now() - registro.desde > VIGENCIA_MS) {
    registros.set(id, { huella: huellaPeticion, grabada: null, desde: Date.now() });
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

Lo esencial son dos líneas: el registro guarda `desde: Date.now()`, y `tomarTurno` trata como nueva una llave cuyo registro tiene más de `VIGENCIA_MS`. La corrida:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/7

$ sleep 6

$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-1' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado avisos","instance":"/servicios","existente":"/servicios/7"}
 [409]

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-2' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/8

$ curl -o /dev/null -w '%{http_code}\n' -X DELETE http://127.0.0.1:18080/servicios/8 -H 'Authorization: Bearer escritura-a'
204

$ sleep 6

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: vence-2' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/9

--- terminal del revisor:
revisor en http://127.0.0.1:18080
POST /servicios
POST /servicios
idempotencia: la llave vence-1 ya se atendió; repito su respuesta
POST /servicios
POST /servicios
DELETE /servicios/8
POST /servicios
```

Primer experimento: `201`, `201` repetido (dentro de la vigencia) y, seis segundos después, `409` `nombre-repetido`. La llave venció, el `revisor` atendió el alta como nueva, y la detuvo la regla del nombre único. Sin esa regla, habría creado otro `avisos`.

Segundo experimento: `201` con el id 8, el retiro y, seis segundos después, `201` con el id **9**. La llave había vencido y el nombre ya estaba libre, así que el reintento creó un servicio nuevo. Es exactamente la frontera de 6.7.1: **pasada la vigencia, un reintento ya no está protegido**. Dentro de los cinco segundos, la misma petición habría recibido el `201` grabado del id 8. Si tu API publica una vigencia de 24 horas, tus clientes tienen que saber que un reintento del día siguiente puede duplicar.

### Solución 4

```text
$ for ruta in codigo/504 cortar codigo/500; do curl -o /dev/null -w "%{http_code} %header{location}\n" -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d "{\"nombre\":\"e-${ruta#*/}\",\"url\":\"http://127.0.0.1:18081/$ruta\"}"; done
201 /servicios/7
201 /servicios/8
201 /servicios/9

$ for id in 7 8 9; do curl -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-a'; done; curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer admin'
202 202 202 202

$ sleep 8

$ for i in 1 2 3 4; do curl http://127.0.0.1:18080/revisiones/$i -H 'Authorization: Bearer escritura-a'; done
{"id":1,"servicio":7,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":504,"ms":1,"detalle":"504"}}
{"id":2,"servicio":8,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":null,"ms":null,"detalle":"respuesta inválida"}}
{"id":3,"servicio":9,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":500,"ms":2,"detalle":"500"}}
{"id":4,"servicio":5,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":null,"ms":null,"detalle":"tiempo agotado"}}

--- terminal del laboratorio:
laboratorio en http://127.0.0.1:18081/codigo/NNN
GET /codigo/504
GET /cortar
GET /codigo/500
GET /lento/3000
GET /cortar
GET /codigo/504
GET /codigo/504
GET /cortar
GET /lento/3000
GET /lento/3000
```

`/codigo/504` aparece tres veces: un `504` puede mejorar solo y no trae `Retry-After`. `/cortar` aparece tres veces: el laboratorio cierra la conexión sin responder, la consulta termina como `respuesta-invalida`, y eso también se reintenta (a quien consulta no le consta que el servicio esté roto para siempre). `/codigo/500` aparece **una vez**: el `revisor` no reintenta un `500`. Y `/lento/3000` aparece tres veces: cada intento se agota a los 1,000 ms.

Los detalles son los del último intento: `504`, `respuesta inválida`, `500` y `tiempo agotado`. Los ocho segundos son por `reportes`: tres intentos de hasta 1,000 ms cada uno más dos esperas de hasta 500 y 1,000 ms, más el segundo que cada revisión espera en la cola, son hasta cinco segundos y medio. Con cuatro, el resultado de `reportes` todavía podría estar `pendiente`.

## Cómo sé que lo logré

- [ ] Dices de memoria qué métodos son seguros y cuáles idempotentes según el RFC 9110, y por qué `POST` y `PATCH` no lo son.
- [ ] Un `DELETE` repetido da `204` y luego `410`, y explicas por qué sigue siendo idempotente; un `PUT` repetido con la misma `If-Match` da `200` y luego `412`, y al releer encuentras tu cambio.
- [ ] `node fig06_02.ts` muestra los mil reintentos en una sola ventana sin *jitter* y repartidos en cinco con *jitter*.
- [ ] Una revisión de un servicio que responde `502` llama tres veces al laboratorio; una de `pagos` (`503` con `Retry-After: 120`) y una de un `404` llaman una sola vez.
- [ ] Dos `POST /servicios` con la misma `Idempotency-Key` dan el mismo `201` y el mismo `Location`, y la lista tiene un solo servicio; con otro cuerpo dan `422` `llave-reutilizada`; a la vez, `409` `llave-en-curso`.
- [ ] `node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200` da `502` y luego `201`; con `--sin-llave`, `502` y luego `409` con `existente`.
- [ ] Con un `422`, `alta-segura.ts` hace una sola petición y sale con `1`; con `503:2 201` en el servidor de mentira espera 2 s y sale con `0`; con `409:en-curso 201` reintenta y sale con `0`, y con `mudo` y `ALTA_LIMITE_MS=300` corta cuatro intentos por tiempo y sale con `1`.
- [ ] Con el `revisor` apagado, la pasarela responde `502` y sigue escuchando; `alta-segura.ts` espera tres veces (hasta 500, 1,000 y 2,000 ms), dice «se agotaron los 4 intentos» y sale con código `1`; sin pasarela, sus cuatro intentos dicen `sin respuesta (ECONNREFUSED)` y no hay pila de Node.
- [ ] Explicas, con una corrida para cada uno, cuánto dura una llave en el `revisor`, por qué los campos en otro orden dan `422` y por qué la respuesta grabada puede señalar un servicio retirado.
- [ ] Dices que `Idempotency-Key` es un borrador vencido de la IETF y no un estándar, y qué tiene que publicar una API que lo use.
- [ ] `node fig06_03.ts` da `5 de 5`, y contra `defectos/sin-huella/` da `4 de 5`.
- [ ] Al terminar, no queda ningún programa escuchando: `curl -i http://127.0.0.1:18080/`, `curl -i http://127.0.0.1:18081/` y `curl -i http://127.0.0.1:18082/` dan el error 7.

## Resumen

Responde sin mirar la lección:

1. ¿Qué es un método seguro y qué es uno idempotente? ¿Cuáles son, según el RFC 9110?
2. ¿Qué promete la idempotencia y qué no promete? Da un ejemplo de cada cosa con el `revisor`.
3. ¿Cuáles son las dos preguntas antes de reintentar? ¿Por qué el `revisor` no reintenta un `500`?
4. ¿Cuál es el techo de la espera del intento `n` con base 250 ms y tope 2,000? ¿Qué agrega el *jitter* completo y por qué?
5. ¿Qué hace el `revisor` cuando un servicio responde `Retry-After: 120`? ¿Por qué no espera 5 s y reintenta?
6. ¿Qué significa un `502` para quien hizo un `POST`? ¿Qué puede hacer sin llave y qué con llave?
7. ¿En qué estado está `Idempotency-Key` en la IETF? ¿Qué códigos propone el borrador y para qué caso cada uno?
8. ¿Por qué la llave se crea una vez por intención y no una por intento?
9. Nombra cuatro cosas que la llave del `revisor` no cubre.
10. Si los cuatro intentos de `alta-segura.ts` fallan, ¿cuántas esperas hace, qué dice al final y con qué código sale? ¿Por qué no espera después del último intento?
11. ¿Cuándo sale `alta-segura.ts` con `0`? ¿Qué hace con un `Retry-After` de 2 s y con uno de 120 s? ¿Qué distingue al `409` que reintenta del que no?

## Fuentes

Todas se consultaron el 21 de octubre de 2026.

1. [RFC 9110, *HTTP Semantics*, sección 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1) (junio de 2022, estándar de internet): los métodos seguros, el ejemplo de la bitácora de accesos y la responsabilidad de quien diseña la URI.
2. [RFC 9110, sección 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): los métodos idempotentes, la repetición automática tras una falla de comunicación, «though the response might differ», el cliente que no debe reintentar métodos no idempotentes, el proxy que no debe hacerlo y el reintento de un reintento.
3. [RFC 9110, secciones 9.3.3, 9.3.4 y 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3): `POST`, `PUT` y `DELETE`.
4. [RFC 9110, sección 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): `Retry-After`, sus dos formas y su significado con un `503`.
5. [RFC 9110, secciones 15.6.3, 15.6.4 y 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3): `502`, `503` y `504`.
6. [RFC 6585, *Additional HTTP Status Codes*, sección 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4): el `429` y su `Retry-After`.
7. [RFC 5789, *PATCH Method for HTTP*, sección 2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2): `PATCH` no es ni seguro ni idempotente.
8. [*The Idempotency-Key HTTP Header Field*, draft-ietf-httpapi-idempotency-key-header-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07) (J. Jena y S. Dalal, 15 de octubre de 2025, borrador de la IETF, vencido el 18 de abril de 2026): sintaxis (2.1), unicidad (2.2), vigencia (2.3), huella (2.4), responsabilidades (2.5), qué hacer (2.6), los errores `400`, `409` y `422` (2.7), implementaciones (4) y seguridad (5).
9. [Datatracker de la IETF, página del borrador](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/): estado «Expired Internet-Draft», grupo de trabajo `httpapi`, revisión 07.
10. [RFC 9651, *Structured Field Values for HTTP*, sección 3.3.3](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.3.3) (septiembre de 2024, reemplaza al RFC 8941 que cita el borrador): los *Strings*, delimitados con comillas dobles.
11. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html) (mayo de 2024, reemplaza al RFC 4122 que cita el borrador): el formato que el borrador recomienda para la llave.
12. [Marc Brooker, *Exponential Backoff And Jitter*, AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) (4 de marzo de 2015): el *jitter* completo, el «igual» y el «descorrelacionado», comparados.
13. [*Timeouts, retries, and backoff with jitter*, Amazon Builders' Library](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) (Marc Brooker, 2019): los reintentos como algo «egoísta», la amplificación de 243 veces con cinco capas, reintentar en un solo punto, la cubeta de fichas para limitar reintentos y la idempotencia con fichas del cliente.
14. [Google, *Site Reliability Engineering*, «Addressing Cascading Failures»](https://sre.google/sre-book/addressing-cascading-failures/): retroceso exponencial al azar, límite de reintentos por petición, presupuesto de reintentos y el ejemplo de 64 intentos con tres capas.
15. [Stripe, *Idempotent requests*](https://docs.stripe.com/api/idempotent_requests): una API que opera el patrón a gran escala: llaves de hasta 255 caracteres, UUID v4 recomendado, sin datos personales, borrado a partir de las 24 horas, comparación de parámetros y resultados que no se guardan cuando la validación falla.
16. [Node.js, *Command-line API*, `--unhandled-rejections=mode`](https://nodejs.org/docs/latest-v24.x/api/cli.html): en la versión 24, el modo por omisión es `throw`: una promesa rechazada que nadie atrapa se levanta como excepción no capturada y el proceso termina; es lo que le pasaría a una pasarela que no atrapa el fallo de su `fetch` (6.5.1).
17. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static): devuelve una señal que aborta sola al cumplirse el tiempo; el error es un `TimeoutError`. Es el límite por intento de `alta-segura.ts` (6.5.2).
18. [RFC 9112, *HTTP/1.1*, sección 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6): el cierre en etapas (media cerrada, seguir leyendo, cerrar del todo) y el `RST` que puede borrar la última respuesta; es lo que hace `cerrarConCalma` en `respuestas.ts`.

### Términos de esta lección

| | |
|---|---|
| **método seguro** | el que, por su semántica, no pide ningún cambio de estado en el servidor: `GET`, `HEAD`, `OPTIONS`, `TRACE` |
| **método idempotente** | el que, repetido, tiene el mismo efecto buscado que una sola vez: los seguros, `PUT` y `DELETE` |
| **reintento** | repetir una petición que falló, decidido por el cliente |
| **retroceso exponencial** | esperar el doble (hasta un tope) antes de cada reintento |
| ***jitter* completo** | sortear la espera entre 0 y el techo del retroceso, para que los clientes no reintenten juntos |
| **amplificación** | la multiplicación de la carga cuando varias capas reintentan por su cuenta |
| **llave de idempotencia** | el identificador que el cliente inventa una vez por operación para que el servidor reconozca sus reintentos |
| **huella** | el resumen del cuerpo que el servidor guarda con la llave para saber si un reintento es la misma petición |
| **reconciliar** | releer el estado del servidor para saber si una operación incierta ocurrió |

---

**Anterior:** [Lección 5 — Problem Details (RFC 9457)](05-problem-details.md) · **Siguiente:** [Lección 7 — Quien lee el error: el cliente del `revisor` y los agentes de IA](07-quien-lee-el-error.md)

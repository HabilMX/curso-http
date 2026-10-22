# Lesson 4 — Server capacity and failures: 429, 500, 502, 503, and 504

It is Friday, the last day of the month, and it is 7:05 PM. Team `a`'s billing service started answering strange things twenty minutes ago, and the dashboard fed by the `revisor` has turned red. Someone on the payments team, nervous, opened the dashboard and pressed "check now" over and over; their browser ended up repeating the request every half second, and each repetition makes the `revisor` go out onto the network to query a service it already knows is down. At 7:12, the on-call person asks for the catalog service's report and receives a `500` whose body is a stack trace with the server's full folder, the name of every file, and the version of Node that is running. Someone copies that body into the public support channel to ask for help. At 7:20 the question arrives that nobody can answer: **is it our fault or theirs?** The `revisor` answers `500` when its own code fails, `500` when the billing service answers garbage, and `500` when the reports service takes too long. With a single number for three different failures, nobody knows whom to wake up.

This lesson gives the `revisor` a different number for each of those situations, and teaches it to keep quiet about what must not go out.

**Time:** 2 × 45 min (the split is between sections 4.4 and 4.5)

**What you build:** the complete safety net for the unexpected error (a `500` with a reference, and the stack trace only in the operator's terminal), a live query, `GET /servicios/{id}/salud`, in which the `revisor` acts as a gateway and distinguishes between a slow dependency (`504`) and one that does not answer HTTP (`502`), a maintenance mode that answers `503` with `Retry-After`, and a per-credential limit for what makes the `revisor` go out to the network (the checks and the live query), which answers `429`

**What you learn:** to answer, for each failure, **who is at fault and who can fix it**; `Retry-After` in its two forms, seconds or a date; `500` versus `502` versus `504`; `503` versus `500`; why the `429` is a `4xx` even though it speaks of capacity; **what is said and what is never said** in a server error (stack traces, queries, paths, secrets); and, in the security callouts, what is never said in an error and the `429` as a defense against enumeration and resource exhaustion, and why brute force on credentials is stopped at another layer

**Where you are coming from.** From [Lesson 3](03-errores-del-cliente-estado.md), with a `revisor` that already distinguishes the client's state errors (not the whole IANA `4xx` registry, but the ones the course works with): the conflict, the business rule and the precondition, the lost update, the withdrawn version. That `revisor` no longer goes down when a handler throws an exception: since Lesson 1, `atenderSinCaerse` catches it and answers `500 error interno`. But it is a minimal net: the `500` carries nothing that lets you find the error in the terminal, and nobody has explained yet what that code means. Nor is there a way to put it into maintenance, to slow down whoever requests checks nonstop, or to ask it live how a service is doing.

**What this lesson does not do.** It does not change the shape of the error bodies: they are still a line of text, and [Lesson 5](05-problem-details.md) turns them into `application/problem+json`. It retries nothing: the `revisor` reads `Retry-After` and records it in a check's result, but exponential backoff and the decision to retry belong to [Lesson 6](06-reintentos-idempotencia.md), and the table that decides what to do with each code belongs to [Lesson 7](07-quien-lee-el-error.md). It does not teach the `RateLimit-*` headers, because they are still an IETF draft and not a standard (section 4.6.5). And it does not simulate a real load balancer: this lesson's gateway is the `revisor` itself, which queries a service and tells you what happened.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS with Node 24.14.1 and curl 8.7.1, on a machine with the central Mexico time zone (UTC−6); only one output depends on that zone, exercise 2's, and the solution says why. The machine had other programs on the course's ports, so the lab and the `revisor` were started on ports 18481 and 18480, and in the outputs they were rewritten as 18081 and 18080; the lengths do not change, because both numbers have five digits. In your run several things will change: the `Date` header's date, the reference of each `500` (a random identifier, different on every error), the measured milliseconds, the final eight digits of each `ETag`, and the `Retry-After` of a `429`, which depends on how much time has passed since the first request in the window. When the `revisor`'s terminal prints a stack trace, the machine's folder is written `<carpeta>`: a machine's paths are not published, and section 4.3.4 explains why. The `revisor` keeps everything in memory: start it again before each series of requests to get the same as the lesson. The programs are in [`programas/04-capacidad-y-fallas-del-servidor/`](../programas/04-capacidad-y-fallas-del-servidor), in the course repository: the `revisor` in `fig04_01/`, the fixed window seen up close in `fig04_02.ts`, the `Retry-After` reader in `fig04_03.ts`, the broken versions from "The error you will see" in `defectos/`, the solutions that carry code in `ejercicios/`, and each run in its `.salida.txt` file. All of them pass `tsc` in strict mode with the command from section 4.7.4.

## By the end you will be able to

- Say, for a given failure, who is at fault, who can fix it, and which code corresponds: `429`, `500`, `502`, `503`, or `504`.
- Trigger a `500` in the `revisor` and find its stack trace in the terminal from the reference the client received.
- Distinguish a `502` from a `504` with a run, and explain why a down service that answers `503` produces a `200` in the health query.
- Read a `Retry-After` in its two forms, seconds or HTTP date, and point out which values are not valid according to RFC 9110.
- Explain why a fixed window of 3 requests per second can let 5 requests through in under 70 milliseconds, with the run that shows it.
- List what is never said in a server error and demonstrate with a run what a stack trace that travels in the body reveals.
- Demonstrate with a run that a per-credential limit, asked before looking up the resource, stops whoever tries identifiers one after another, and that a per-resource one does not.

## The why before the how

In Lesson 0 you saw the question that separates the two families of errors: **who made the mistake?** If it was whoever requested, the code is a `4xx`; if it was whoever serves, a `5xx`. Lessons 2 and 3 were devoted to the first half. This lesson deals with the second, and adds a question that matters as much as the first: **who can fix it?** Because "the fault is the server's" tells nobody what to do. The client needs to know whether it pays to wait, how long, or give up. Whoever operates needs to know whether the problem is in their code, in their configuration, or in another team's service. Each code in this lesson answers the two questions in a different way:

| Code | What happened | Who is at fault | Who can fix it | What the client does |
|---|---|---|---|---|
| `429` | you asked for more than you are entitled to in a given time | the client, for its pace | the client, by slowing down | wait as long as `Retry-After` says |
| `500` | something unexpected happened in the server's code | the server | whoever operates the server, by fixing its code | not insist on the same thing; report the reference |
| `502` | the server acted as a gateway and what is behind it answered something invalid, or could not be reached | what is behind | whoever operates what is behind | wait, or try later |
| `503` | the server cannot serve right now: maintenance or overload | nobody made a mistake: it is a decision or a limit | time, or whoever operates | wait as long as `Retry-After` says |
| `504` | the server acted as a gateway and what is behind it did not answer in time | what is behind | whoever operates what is behind | wait, or try later |

The opening scene had three problems, and all three fit in this table. The browser that repeated the request every half second needed a `429`, telling it "slow down" and how long to wait. The report that blew up needed a `500` that told nothing about the inside, plus a reference so the on-call person could find the stack trace in their terminal. And the down billing service needed a `502` or a `504`, saying "the problem is behind me", so nobody would review the `revisor`'s code looking for an error that was not there. With a single `500` for everything, each of those people made the wrong decision: the browser kept insisting, the error body ended up in a public channel, and the on-call person searched in the wrong place.

Notice the first row: the `429` is a `4xx`, even though it speaks of capacity. It is the table's only apparent exception, and it is not an exception: the one who can fix it is the client, by slowing down, and that is exactly what the `4xx` family says. The server did not fail; the client asked for more than agreed. The `503`, by contrast, is a `5xx` even though the server "works": the server cannot serve right now, for a reason of its own, and no change to the request fixes it.

The table has another column that is not visible, but that runs through the whole lesson: **what is said**. A server error is the moment when an API is most tempted to tell too much, because whoever wrote the code wants to see what happened, and the quickest way is to send the complete exception in the response. What is useful to whoever operates (the stack trace, the query, the file path) is exactly what must not be seen by whoever requested. The course's third principle says it: **what goes out is designed**.

The lesson has five parts:

1. **The lab and the question** (4.1 and 4.2): the three ways in which a dependency fails without answering, and the question that decides the code.
2. **The `500`** (4.3): the reference, the stack trace in the terminal, and the security callout on what is never said.
3. **The `revisor` as a gateway** (4.4): `502` and `504`, and why someone else's `503` is a `200` of its own.
4. **Capacity** (4.5 and 4.6): `503` with `Retry-After` for maintenance and `429` for the request limit, with the security callout on the `429` as a defense.
5. **The complete `revisor`** (4.7): the files and the run of all the cases.

## The concepts

### 4.1 This lesson's `revisor`

#### 4.1.1 What changes

This lesson's `revisor` lives in `~/curso-http/fig04_01/`. If you have the folder from Lesson 3, copy it with that name. There are thirteen files: two new, six that change, and five that stay as they were. Section 4.7 brings them all in full; here is the map, so you know where everything is as you read:

| File | What changes | Section |
|---|---|---|
| `limitador.ts` | **new**: how many times something can be done in a time window | 4.6 |
| `operacion.ts` | **new**: maintenance mode and `PUT /mantenimiento` | 4.5 |
| `servidor.ts` | the minimal net becomes the complete one: reference and trimmed stack trace | 4.3 |
| `cliente.ts` | `consultar` distinguishes four outcomes plus one, and reads `Retry-After` | 4.4 and 4.5 |
| `servicios.ts` | the `salud` and `informe` routes, and the limits of `pedirRevision` and `salud` | 4.3, 4.4, and 4.6 |
| `rutas.ts` | the new routes and the stop for maintenance | 4.5 |
| `laboratorio.ts` | three routes for failing: `/lento/MS`, `/cortar`, and `/basura` | 4.1.2 |
| `almacen.ts` | three more startup services, and `revisionesDe` | 4.1.2 and 4.3 |

`autenticacion.ts`, `destinos.ts`, `etiquetas.ts`, `respuestas.ts`, and `versiones.ts` do not change. Error bodies still come out of `fallar`, in `respuestas.ts`, as a line of text.

#### 4.1.2 Three ways of failing without answering

To trigger a `502` and a `504` you need a service that fails **without** answering a code. A service that answers `503` is no use for that: it answered, and its response is valid HTTP. The lab, which is Lesson 0's bench on port 18081, gains three routes that fail in the three ways a real service fails when it does not answer properly:

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

- `/lento/MS` answers `200`, but after `MS` milliseconds. It is the service that works, but takes a while: a saturated database, a process left waiting for another.
- `/cortar` closes the connection without writing anything. It is the process that crashed midway through a request, or the load balancer that cuts.
- `/basura` writes a line that is not an HTTP response. It is the service that does not speak the protocol you expected: a wrong port, another program listening there.

Before seeing what the `revisor` does with them, see what `curl` does, which is a client without intermediaries. Start the lab in one terminal (`node laboratorio.ts`, from `fig04_01/`) and try the three in another:

```text
$ curl -i http://127.0.0.1:18081/basura
curl: (1) Received HTTP/0.9 when not allowed

$ curl -i -m 1 http://127.0.0.1:18081/lento/3000
curl: (28) Operation timed out after 1001 milliseconds with 0 bytes received

$ curl -i http://127.0.0.1:18081/cortar
curl: (52) Empty reply from server
```

None of the three carries a status line. None carries a code. `curl` ends with an error of **its own**, and each says something different. The 1 is, according to `curl`'s manual, "unsupported protocol", and the message explains why: what `/basura` wrote does not start with `HTTP/1.1`, so `curl` took it for an HTTP/0.9 response (with no status line or headers), and that version is turned off unless you ask for it with `--http0.9`. In practice: something arrived, but it is not HTTP. The 28 says time ran out: with `-m 1` you gave it one second, and `/lento/3000` was going to take three. The 52 says the server answered nothing: it accepted the connection and closed it. In Lesson 0 you saw code 7, "I could not connect": it is the fourth way, and you will see it in exercise 4.

When the `revisor` queries one of these services, it will be in `curl`'s place. The difference is that `curl` can end with an exit code, and the `revisor` cannot: someone made an HTTP request to it and it has to answer with an HTTP code. That is the problem that the `502` and the `504` solve.

The startup services in `almacen.ts` grow to use those routes. To the three from before (1 `catalogo`, 2 `pagos`, 3 `nomina`) three are added, all team a's:

| id | name | url | limit |
|---|---|---|---|
| 4 | inventario | `http://127.0.0.1:18081/lento/1500` | 2000 ms |
| 5 | reportes | `http://127.0.0.1:18081/lento/3000` | 1000 ms |
| 6 | facturacion | `http://127.0.0.1:18081/basura` | 2000 ms |

`inventario` takes 1.5 s with a limit of 2 s: it arrives in time, but slowly. `reportes` takes 3 s with a limit of 1 s: it does not arrive. `facturacion` answers garbage. Since there are now six startup services, the first registration in each run gets id 7, not 4.

#### 4.1.3 Starting both

As in the earlier lessons, two terminals in `~/curso-http/fig04_01/`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Leave both running. All the requests in sections 4.3 to 4.6 go against this pair, in the order in which they appear, and section 4.7.3 puts them together.

### 4.2 Who is at fault: the question of the `5xx`

RFC 9110 defines the `5xx` family in its [section 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6) with a sentence worth reading slowly: the server is aware that it has **erred or is incapable** of performing the requested method. Those are two different things. "Erred" is a mistake: something in the server did not do what it should. "Incapable" may be nobody's mistake: the server is in maintenance, or saturated, or depends on another that does not answer. The same section adds a strong recommendation (a *SHOULD*, not a *MUST*) that you already saw in Lesson 0: except when responding to a `HEAD` request, the server **should** send a representation containing an explanation of the error and **whether it is temporary or permanent**. That second half is the one almost everybody forgets, and the one most useful to the client, because it determines whether it is worth trying again.

To choose among this lesson's five codes, ask yourself these questions in order:

1. **Did the client ask for more than it is entitled to in a given time?** Then the server did not fail: the client has to slow down. It is a `429`, from the `4xx` family, with `Retry-After` if you know how long it has to wait.
2. **Did the server decide not to serve right now, for maintenance or because it is saturated?** It is a `503`. Nobody made a mistake; it is temporary by definition, and `Retry-After` says how long it is expected to last.
3. **Was the server acting as a gateway, and did what is behind it fail?** If what is behind did not answer in time, it is a `504`. If it answered something that is not a valid response, or could not be spoken to, it is a `502`.
4. **None of the above, and something unexpected happened in your own code?** It is a `500`.

The `500` goes last on purpose. It is the code used when no other describes what happened, and that is why it is the easiest to overuse: everything that goes wrong can be called "internal error". But a `500` tells whoever operates "look in your code", and if the failure was in a dependency or was a planned maintenance, it sends them to look where it is not. **A `500` is a confession: "we did not foresee this"**. Every time the `revisor` answers `500` for something it could have foreseen, it is saying something false about itself.

There are two questions the tree does not ask, and it is worth answering them before going on. The first: **what if the client sent something impossible?** Then it is not a `5xx`. An unreadable body is `400`, one over 16 KiB is `413`, an out-of-range value is `422`, and you saw this in Lessons 2 and 3. A `5xx` for a client error is as misleading as a `200` for an error: the client concludes the problem is not its own and repeats the same request, which will fail the same way. The second: **what about the `5xx` codes the course does not use?** The `501` was mentioned in Lesson 2: it is for a method the server does not implement on any resource. The `505` is for an HTTP version the server does not support. Neither is a capacity or dependency error, and the `revisor` does not need them.

### 4.3 `500`: what nobody expected

#### 4.3.1 The question that decides

RFC 9110 defines the `500 Internal Server Error` in [section 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1) in a single sentence: the server encountered **an unexpected condition** that prevented it from fulfilling the request. The word that matters is "unexpected". The question that decides the `500` is: **did we foresee this?** If the answer is yes, there is another code that describes it better. If it is no, it is a `500`, and the honest thing is to answer it as such, instead of disguising it as something else.

In practice, a `500` is almost always an exception nobody caught: an `undefined` where an object was expected, a division by zero, a database connection that broke in the middle of a query. What the server can do well with a `500` is not avoid it (if it could, it would not be unexpected), but **answer it well**: with the right code, without telling too much, and leaving somewhere the information that whoever operates needs to fix it.

#### 4.3.2 Triggering it

This lesson's `revisor` carries a `500` on purpose, so you can trigger it whenever you want. The route `GET /servicios/{id}/informe` summarizes a service's checks, and has a defect that anyone can miss:

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

It looks up the service's latest check and reads its result. It works as long as the service has at least one finished check. If it has none, `revisiones[revisiones.length - 1]` is `undefined`, and reading `.resultado` on `undefined` throws a `TypeError`. The two `as`es in the code tell TypeScript "trust me, there is always a check here", and TypeScript trusts: the defect passes `tsc` in strict mode without a single complaint. It is the kind of error that produces a `500` in a real API: the case nobody thought of, hidden behind an assumption. The comment says the defect stays like that until the end of the course, so there is always a `500` to trigger.

With the lab and the `revisor` freshly started, service 1 has no checks. Ask for its report twice:

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

Read the two responses with the why-table in hand. The code is `500`: the server confesses that something unexpected happened, and the client knows the problem is not its own. The body does not say what happened, or where, or in which file. It says only two things: that it was an internal error, and a **reference**. And the reference is different in each response: each error is a different event, even if the cause is the same.

Now look at the `revisor`'s terminal:

```text
GET /servicios/1/informe
error affc3b8a-5ab9-42f5-8b37-2face1f8eafd en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
```

There is everything the client did not see: the error message (`TypeError: Cannot read properties of undefined (reading 'resultado')`) and the stack frames, from most recent to oldest. The first says where the error was born: the function `informe`, in `servicios.ts`, line 304, column 28, which is exactly the `.resultado` on `ultima`, the check that does not exist. The other three say how it got there: `atender`, in `rutas.ts`, called the handler, `atenderSinFiltrar`, in `servidor.ts`, called `atender`, and Node's server called `atenderSinFiltrar`. And at the start of the line, the same reference the client received. If someone reports "I got an error with reference `affc3b8a-…`", whoever operates searches that text in their log and finds the exact stack trace of **that** request, among thousands.

#### 4.3.3 `servidor.ts`: the reference and the stack trace

In Lessons 1 to 3, `servidor.ts` had a minimal net, `atenderSinCaerse`, which answered `500 error interno` and wrote the message to the terminal. This lesson turns it into the complete net, `atenderSinFiltrar`:

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

Read `atenderSinFiltrar` first, the one that catches. Everything the `revisor` does passes through the `await atender(...)` inside the `try`. If anything throws, in any handler, at any depth, the exception rises to this `catch`. Three things happen there, in this order.

**First, a reference is drawn** with `randomUUID()`, from the `node:crypto` module, which according to Node's documentation generates a random version 4 UUID identifier, with a cryptographic generator. That it is random matters for two reasons. One: two errors practically never share a reference (a v4 UUID carries 122 random bits: a collision is possible in theory and negligible in practice), so the reference identifies a request and not a cause. The other: it reveals nothing. A consecutive number (`error 1043`) would tell whoever receives it how many errors your server has had, and at what rate; a random UUID says nothing more than "this event".

**Second, the stack trace is written to the terminal**, with the reference in front. The terminal is the operator's log: on a real server, that would go to a logging system, and the principle is the same.

**Third, the client is answered**, but only if it is still possible. `respuesta.headersSent` says whether the status line and headers have already gone out. If they have not, it answers `500` with the reference. If they have (a handler that started answering `200` and threw midway through the body), the code can no longer be changed: the status line is the first thing that travels, and it cannot be taken back. The only honest thing is to cut the connection with `respuesta.destroy()`, so the client sees an incomplete body and not a `200` that looks whole. On `curl`'s side it shows as error 18, "transfer incomplete": the code and headers arrived, but not the whole promised body. It was measured with a toy server that wrote `abc` and cut: with `Content-Length: 100` `curl` says `(18) transfer closed with 97 bytes remaining to read`, and without `Content-Length` (chunked transfer) it says `(18) transfer closed with outstanding read data remaining`; in both cases, error 18.

Now `pilaDelCurso`. `error.stack` is a text: the message on the first line, and then one line per frame, each with `at`. The function keeps the message and the frames that contain neither `node:` nor `node_modules`. The `node:` frames are Node's own (`node:events`, `node:_http_server`) and the `node_modules` ones would be those of dependencies, if the course had any. They are removed for two reasons. The first is practical: the line numbers of Node's internal frames change with each version, so an output that included them would change with every Node update, even if your code did not change. The second is about the craft: those frames cannot be fixed by the learner, nor almost ever by whoever operates. What you need to fix the `500` is in the frames of your code, and there they remain. The section "The error you will see" shows the complete stack trace, with Node's frames included, and why that version is a problem when it travels.

Notice the function's name, `atenderSinFiltrar`. It reads as "serve what nobody filtered before": it is the net for what escaped all the handlers. It does not mean it does not filter what goes out: it filters everything, and only the reference reaches the client. If every handler did its job well, this `catch` would never activate. That is why every time it activates it is news for whoever operates, and the reference is the thread to pull.

#### 4.3.4 Security callout: what is never said in an error

> **Security callout.** A server error is a public surface. Anything that travels in its body can be read by whoever made the request, can be stored by a proxy, can be copied by someone into a support channel, and can be indexed by a search engine if the response ends up on a page. What is never said:
>
> - **Stack traces.** They reveal the names of files, functions, and dependencies, and the program's internal structure.
> - **Machine paths.** `file:///home/despliegue/revisor/servicios.ts` tells the user that runs the process, how the server is organized, and where to look.
> - **SQL queries and table or column names.** A database error that repeats the query shows whoever is looking for an injection exactly what the server is building with their input.
> - **Secrets.** Connection strings, tokens, passwords, keys. They appear in errors more than it seems: an exception that prints the entire configuration object, or a URL with credentials inside.
> - **Versions and product names.** The web server, the language, the framework, and its version tell an attacker which known vulnerabilities to try.
> - **Machine names and internal addresses.** The same thing the `revisor` already avoids in the SSRF rejection since Lesson 1: the message says that a name resolves to a private address, but not which.
>
> MITRE's catalog of common weaknesses has a name for this: [CWE-209](https://cwe.mitre.org/data/definitions/209.html), "generation of error message containing sensitive information", and lists among its examples exposed stack traces, full file paths, and the structure of queries. The [OWASP error handling cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) sums it up in the same rule the `revisor` follows: the error's detail is logged **on the server side**, to investigate it, and is **not returned** to whoever requested, who receives a generic message.
>
> **The reference is the bridge.** Without it, silencing the stack trace would make the `500` useless to everyone: the client would not know what to report, and whoever operates would not know what to search for. With it, the client has an identifier that reveals nothing, and whoever operates has, in their log, everything the client did not see. It is the way to tell nothing without ceasing to help.
>
> **Silence the error's text too.** The most frequent mistake is not sending the complete stack trace, but sending just `error.message`, which seems harmless. It is not. An exception's message is written by whoever threw it, which may be a library you do not control, and you do not know what it will contain: a database driver's may carry the fragment of SQL that failed, and a network error's may carry the internal address it could not connect to. In the `revisor` you will see it in section 4.4.2: when a service answers garbage, `fetch` says `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, and that text is stored in `motivo` and does not travel. The `502` says, in the `revisor`'s words, "it did not give a valid HTTP response: it cut the connection or answered something that is not HTTP". **What goes out is written by your program, in its own words**; an exception's text is never forwarded.
>
> **The log is not a bottomless drawer either.** The `revisor` logs the requested path with its query (`peticion.url`, with everything after the `?`), and if an API received tokens in the URL, they would end up written there. The [OWASP logging cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) asks not to log access tokens or sensitive data: in a real API the path is logged without the query, or with the sensitive values struck out.

### 4.4 `502` and `504`: when the `revisor` acts as a gateway

#### 4.4.1 The question that decides

Both codes have a condition in common, which RFC 9110 writes in both definitions: the server answers this way **while acting as a gateway or proxy**. That is: to answer you, it had to ask something of another server, and that other one failed. [Section 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3) says that the `502 Bad Gateway` means the server received **an invalid response** from the server it went to ask (the RFC calls it the *inbound server*: the one toward the origin, on the side opposite the client). [Section 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5) says that the `504 Gateway Timeout` means it **did not receive a timely response** from the server it needed to access in order to complete the request.

The two deciding questions are, then:

1. **To answer, did I have to ask another?** If not, it is neither `502` nor `504`. A server that depends on nobody and fails from an unforeseen error in its own logic answers `500`. (If the cause is that it is overloaded or in maintenance on purpose, the code is `503`, which this lesson sees in 4.5; the `500` is for what nobody foresaw.)
2. **What did the other one answer?** Nothing in time → `504`. Something that is not a valid HTTP response → `502`.

There is a case the RFC does not name: **it could not even connect** (nobody was listening on that port). It is not an invalid response, because there was no response; nor is it a late response, because the attempt ended instantly. The `revisor` treats it as a `502`: what is behind did not answer anything valid, and the problem is its own. It is a design judgment, not a norm. What is not an option is a `500`: the `revisor` did foresee that the connection could fail, and its code is not at fault.

Notice what the `502` and the `504` do **not** say: they do not say the `revisor` is wrong. They tell the client "the problem is behind me", and they tell whoever operates the `revisor` not to look in its code. It is the answer to the 7:20 PM question in the opening scene.

#### 4.4.2 `cliente.consultar`: four outcomes plus one

The `revisor`'s client side had been querying services since Lesson 1, with `revisar`, which returned an already classified result: `ARRIBA`, `LENTO`, or `CAIDO`. To answer a gateway request, more detail is needed: it is not enough to know that something went wrong, you must know **what** went wrong. That is why `cliente.ts` gains a function, `consultar`, which returns the raw outcome:

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

`Consulta` is a **discriminated union**: a type that can be one of five forms, and the `tipo` field says which. Only the first, `"respuesta"`, carries a code; the other four are the ways of **not** having one. Notice that the type makes impossible a mistake that is made a lot: inventing a code for what was not a response (a `0`, a `-1`, a fake `500`). If there was no response, there is no `codigo` field to fill in. Lesson 0 put it in "Common mistakes": treating "could not connect" as a code loses the most useful information, whether the server answered or not.

`consultar` decides like this:

- **Forbidden destination.** Before each connection the destination is checked again against Lesson 1's SSRF list, because the DNS may have changed since registration. If it is not allowed, it is not even attempted.
- **Response.** If `fetch` returned a response, there was HTTP, with whatever code. The body is not read (`body?.cancel()`): to know how a service is doing, its code is enough, and reading someone else's body is spending memory on something that will not be used. `redirect: "manual"` makes a `301` from the service be reported as `301` and not followed: the `revisor` says what the service answered, not where it sent it.
- **Timeout.** `AbortSignal.timeout(limiteMs)` aborts the request if the service's limit passes, and `fetch` throws a `DOMException` named `TimeoutError`. MDN's documentation distinguishes that name from `AbortError`, which is the one that appears when the cancellation comes from elsewhere; that is why the code asks for the exact name.
- **No connection.** If the error's cause carries the code `ECONNREFUSED` (nobody is listening on that port), there was nobody to talk to. `ENOTFOUND` (the name stopped existing) is left for completeness, but it almost never gets here: `revisarDestino` already resolved the name an instant before, and if it could not, the query ends as a forbidden destination, with the reason `el nombre … no se pudo resolver`.
- **Invalid response.** Everything else: it connected, and what happened afterwards was not an HTTP response. `/basura` falls here, with the cause `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, and `/cortar` too, with the cause `other side closed`. The text is stored in `motivo`, for whoever wants to debug from the code, and, as the callout said, it appears in no response.

That "invalid response" is the default case is a decision: if a failure appears that the code does not know, it is treated as the most general of the failures of someone else's service, not as a `revisor` error. If the `revisor` treated the unknown as its own error, a type of network failure that nobody foresaw would end up in `servidor.ts`'s `catch` and come out as `500`, sending people to look in the wrong place.

And `revisar`, the earlier function, is now a translation of `consultar` into the result that a check stores:

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

The `switch` covers the five cases, and TypeScript checks that none is missing: if tomorrow someone adds a sixth type to `Consulta` and forgets this `switch`, the function would no longer return a `Resultado` on every path, and `tsc` would flag it. The classification did not change from Lesson 1, except in one detail: if the service answered an error and carried `Retry-After`, the detail records it, `503 (reintentar en 120 s)`. Section 4.5.3 explains how that value is read.

#### 4.4.3 The health query

Lesson 1's checks are asynchronous: you ask for one, you receive a `202`, and the result arrives later. To practice the `502` and the `504` you need the opposite, a **live** query, in which the `revisor` asks the service at that moment and answers you with what happened. It is the route `GET /servicios/{id}/salud`:

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

The first thing is a limit: each credential can ask for **3 live queries per minute**, because each one makes the `revisor` go out to the network. Section 4.6 explains it along with the checks' limit; here it is enough to know it exists, because it decides how the tests are distributed. Then the service is looked up with `encontrar`, the same function every route with `{id}` uses: another team's service answers `404`, just like one that does not exist, as in Lesson 2. Then it is queried, and each outcome has its code. Try it with team a's five services. That is five queries and each credential has three per minute, so the first three go with `lectura-a` and the last two with `escritura-a`:

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

One by one:

- **The 1 (`catalogo`) answers `200`** with `"codigo":200`. The service is fine, and so is the `revisor`.
- **The 2 (`pagos`) answers `200`** with `"codigo":503`. This is the line that confuses most, and the most important in the section. The payments service is down, yes, but it **answered**: it said `503`, with valid HTTP. The `revisor` did what it was asked, which was to find out how the service is doing, and it found out. Its response is a success that carries bad news inside. If the `revisor` answered `503` here, it would be telling the client "I, the `revisor`, cannot serve you", and every machine along the way (a load balancer, a monitor, a cache) would believe it: the monitor would mark the `revisor` as down because of someone else's service.
- **The 4 (`inventario`) answers `200`** with `"ms":1503`: it took a while, but less than its 2000 ms limit. That time is real: the lab waited 1500 ms and the rest is how long the connection took.
- **The 5 (`reportes`) answers `504`**, and `curl` measured **1.004 seconds**: the service's limit is 1000 ms, and the `revisor` stopped waiting right there. The lab was going to answer at 3000 ms, but the `revisor` was no longer listening. The body says how long it waited, which is what helps the client understand what happened.
- **The 6 (`facturacion`) answers `502`**, and it took **2 milliseconds**: the lab answered garbage immediately, and the `revisor` recognized it as such.

The fifth outcome is missing, forbidden destination, which answers `422`. It is the same SSRF rule from Lesson 1, applied again right before connecting: if the name of a service that was registered properly now resolves to a private address, or no longer resolves, the `revisor` does not connect. There is no run here because it cannot be triggered from the lab: any URL that falls under that rule was already rejected with `422` at registration. Why `422` and not `502`? Because the `revisor` never got to talk to what is behind: it is not a failure of another server, but a stored value (the service's URL) that cannot be fulfilled today. It is a design judgment, and it has a cost worth stating: whoever asked for the health sent nothing wrong, and the `422` speaks to them of a value that another person registered, perhaps months ago. The `detail` states the reason, so they know what to fix in the service.

Notice the two times. The `504` took what the limit says; the `502`, almost nothing. It is no coincidence: a `504`, in a simple gateway like this one, costs the time it waited before giving up, and a `502` can be instantaneous. (A gateway with a circuit breaker or with an already expired deadline can give a `504` almost instantly; what defines the `504` is that the deadline for the other one's response ran out, not how long the gateway took to say so.) That difference matters to whoever designs a client: a client that waits 30 seconds for a gateway with a 1-second limit is wasting 29.

The `/cortar` case is missing. No startup service uses it, so register one and ask for its health, again with `escritura-a`, which has two queries:

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

`502`, with the same body as service 6. From the `revisor`'s point of view, a service that accepts the connection and closes it without saying anything did not give a valid response: there was no status line. `consultar` does not tell the two cases apart (both are `respuesta-invalida`), and that is why the body says both things that could have happened, "it cut the connection or answered something that is not HTTP", instead of asserting one that may be false. Separating them would require looking at the error's cause, and would not change the code, which is what machines read.

#### 4.4.4 `500` versus `502` versus `504`

All three are server errors, and all three get confused. This table puts together what separates them:

| | `500` | `502` | `504` |
|---|---|---|---|
| Was there another server behind? | not necessarily | yes | yes |
| What happened? | something unexpected in your code | what is behind answered something invalid, or could not be reached | what is behind did not answer in time |
| Where does the operator look? | in the server's code | in the service behind, or in the connection | in the service behind: it is slow or down |
| How long does the response take? | however long it takes to fail | almost always short | at least the gateway's limit |
| In the `revisor` | `GET /servicios/1/informe` | `GET /servicios/6/salud` | `GET /servicios/5/salud` |

The short rule: **`500` is "I made the mistake"; `502` and `504` are "the one behind me made the mistake"**, and between the two, the difference is whether it answered badly or did not answer in time.

A consequence of that rule, which the section "The error you will see" shows with a run: if the `revisor` let `fetch`'s error reach `servidor.ts`, the `502` and the `504` would turn into `500`, reference and all. The response would be very polite (no stack trace, with a reference) and it would be wrong: it would say "I made the mistake" when the one who made it was someone else.

### 4.5 `503` and `Retry-After`: closed for maintenance

#### 4.5.1 The question that decides

RFC 9110 defines the `503 Service Unavailable` in [section 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4): the server is **currently unable to handle the request** due to a temporary overload or scheduled maintenance, which will **likely be alleviated after some delay**. The server **MAY** send `Retry-After` to suggest how long to wait. And it adds a note worth knowing: the existence of the `503` does not oblige an overloaded server to use it; some simply refuse the connection.

The deciding question is: **did the server decide, or does it know, that it cannot serve now, and that it is temporary?** Both conditions matter. "Decided or knows": a `503` is not an error that slipped out, it is a response the server chose to give. "Temporary": the `503` promises the client that, if it waits, the situation changes. A server that answers `503` forever is saying something false.

The difference from the `500` comes from there. Both belong to the server and both tell the client the problem is not its own. But the `500` says "something went wrong and I don't know when it will be fixed", and the `503` says "I can't right now, come back later", often with the exact time. For a client, the difference is deciding between reporting an error and waiting. For a cache too: in Lesson 0 you saw that `stale-if-error` lets a cache serve the earlier copy when faced with a `500`, `502`, `503`, or `504`, but a monitor that counts errors should count an announced maintenance differently from a failure. If maintenance is answered with `500`, nobody can tell them apart.

#### 4.5.2 Maintenance mode

The `revisor` gains a switch: `PUT /mantenimiento`, with `{"activo": true}` or `{"activo": false}`, which only the `admin` credential can use. While it is on, everything else answers `503` with `Retry-After: 120`. It lives in a new file, `operacion.ts`:

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

Two functions. `atajarPorMantenimiento` is called from the entry point, before everything, and answers `503` if the mode is on; it returns `true` so the entry point knows a response has already been sent. `cambiarMantenimiento` is the handler for `PUT /mantenimiento`: it checks the role, reads the body with the usual `leerJson` (so a body that is not JSON receives its `415` or `400`, as in Lesson 2), requires a boolean (otherwise `422`, with Lesson 3's same `rechazarDatos`), and changes the mode.

In `rutas.ts`, the stop is added at the entry point, next to the other stops that go before the seven questions:

```ts
  if (redirigir(url.pathname, url.search, respuesta)) return;
  if (atajarPorMantenimiento(url.pathname, respuesta)) return;
  if (versionRetirada(url.pathname, respuesta)) return;
```

Try it with the two credentials, and then ask for two things while it lasts:

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

Six responses, and each says something:

- **`escritura-a` receives `403`.** It is a writer, and the route is a write one, so it passed question 4 of the entry point; but the handler also checks that it is `admin`. Turning maintenance on changes every team's day, and it is not up to one alone.
- **`admin` receives `204`.** The mode was enabled; there is nothing to return. The `revisor`'s terminal logs it: `operación: mantenimiento encendido`.
- **`GET /servicios` receives `503` with `Retry-After: 120`.** The body says what is happening; the header says how long to wait; the code says it is not the client's fault and that it is temporary.
- **`/no-existe`, without a credential, also receives `503`.** This one deserves a pause. It is a route that does not exist, requested by someone who did not say who they are, and the response is neither `404` nor `401`. It is that maintenance goes **before** the seven questions. The reason is the same as Lesson 2's for redirects: while the `revisor` is in maintenance, no response that depends on its data is reliable, and answering `404` to a route that does exist because "today I'm not serving it" would be lying. A single response for everything is the most honest, and it also teaches nobody anything: a stranger does not learn which routes exist.
- **The `admin` disables the mode with another `204`.** `/mantenimiento` is the only route served during maintenance, because otherwise nobody could disable it. Notice that the exception is written in `atajarPorMantenimiento` itself and not in the entry point: the switch and its exception live together.
- **`GET /servicios` goes back to `200`.**

Why does maintenance go **after** the redirects? Because a redirect delivers no data: it says where the new route is, and that is still true during maintenance. A client that requests `/viejo/servicios` receives the `301`, goes to `/servicios`, and there it receives the `503`. Each response says something true.

#### 4.5.3 `Retry-After`, in its two forms

`Retry-After` is defined in [section 10.2.3 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3). It says how long the client **should** wait before requesting again; with a `503`, how long the unavailability is expected to last. Its value has two forms, and the RFC's grammar writes them like this:

```text
Retry-After = HTTP-date / delay-seconds
delay-seconds  = 1*DIGIT
```

Either an HTTP date (`Fri, 31 Dec 1999 23:59:59 GMT`, the RFC's example), or a number of seconds (`120`). `1*DIGIT` means "one or more digits": an unsigned integer, with no decimal point, with no spaces inside. `1.5` is not a valid value, nor is `-1`, nor `2m`.

The date in turn has three formats, for historical reasons: [section 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) defines the preferred one (`Sun, 06 Nov 1994 08:49:37 GMT`) and two obsolete ones that come from old versions of HTTP (`Sunday, 06-Nov-94 08:49:37 GMT` and `Sun Nov  6 08:49:37 1994`, the format of C's `asctime` function), and says that whoever reads a date in an HTTP field **must** accept all three. Whoever generates an HTTP date **must** use only the first.

When is each form convenient? Seconds are relative: "wait 120 seconds from when you received this". The date is absolute: "come back from 11:59 PM on". Seconds are more robust, because they do not depend on the client's and the server's clocks agreeing. The date makes sense when the server knows a concrete time, for example the end of an announced maintenance window. The `revisor` sends seconds in every case.

On the client side, `cliente.ts` reads both forms with `segundosDeEspera` and its helper, `fechaHttp`:

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

If the header does not come, `segundosDeEspera` returns `null`: there is no instruction. If it is only digits, they are the seconds. If not, it asks `fechaHttp` to read it as a date, and computes how many seconds remain, rounding up; a date that has already passed gives `0`, "you may try now". If it is not a date, it returns `null`: a value that is not understood is not an instruction, and the caller uses its own default wait.

`fechaHttp` is long because it does what the RFC asks and nothing more. It has a regular expression for each of the three formats, with the day and month names the RFC lists; it builds the date with `Date.UTC`, because an HTTP date is always in GMT, even though the `asctime` form does not write it; it applies the RFC 850 rule for the two-digit year (if it ends up more than 50 years in the future, it belongs to the previous century); and at the end it checks that the built date is the one that was asked for, because `Date.UTC` accepts October 32nd and silently turns it into November 1st. What it does **not** do is the most tempting thing: pass the text to `Date.parse`. The comment says why, and exercise 2 shows it with a run: `Date.parse` understands almost anything as a date, and reads the `asctime` form in the machine's local time.

This program tests `segundosDeEspera` with five values and with the header absent:

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

Seconds are read as they are; the date 90 seconds from now gives `90`; the 2015 one has already passed and gives `0`; and `mañana` and the absence give `null`. Exercise 2 puts it in front of a naive version, with values that are not valid.

The value that is read ends up in the check's detail. You will see it in 4.6.3: a check of service 2, which answers `503` with `Retry-After: 120` from the lab, ends up with `"detalle":"503 (reintentar en 120 s)"`. The `revisor` does nothing with that number yet, except record it; Lesson 6 decides when it is worth waiting and retrying, and when not.

#### 4.5.4 `503` versus `500`

A quick way not to confuse them is to ask yourself **who knew**. A `503` is answered by a server that knows it cannot serve: it was put in maintenance, or it measured itself that it is saturated (too many open connections, a full queue). A `500` is answered by a server that found out about its error at the same time as the client. If you knew, and it is temporary, it is `503`; if you did not know, it is `500`.

There is a borderline case worth thinking about: a database that does not answer. For the API server, is it a `500` or a `503`? If the code tries to connect, fails, and the exception rises to the net in `servidor.ts`, a `500` comes out, and that is not wrong: nobody foresaw the failure. If the code detects that the database is unavailable and says so on purpose, a `503` with `Retry-After` is more useful, because it tells the client it is temporary. And there are those who answer `502` or `504`, with the argument that the database is a server that is behind. The RFC does not settle this case: it is a design judgment, and what matters is to decide it, write it down, and apply it the same way on all routes. The `revisor` reserves the `502` and the `504` for the health query, where it acts as a gateway explicitly, because its job is to answer how another service is doing.

### 4.6 `429`: too many requests

#### 4.6.1 The question that decides

The `429 Too Many Requests` is not in RFC 9110. It was defined in 2012 by [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4), in its section 4, together with Lesson 3's `428`. The definition is short: the user has sent **too many requests in a given amount of time** ("*rate limiting*"). The response **SHOULD** explain the situation and **MAY** carry `Retry-After`. The RFC's example is a site that allows 50 requests per hour to each identified user, and answers with `Retry-After: 3600`.

The same section says two things worth underlining. The first: the RFC **does not define** how the server identifies the user or how it counts requests. It may count per resource, per whole server, or across several servers, and it may identify the user by their credential or by a cookie. That is: how much, how often, and by whom are your decisions, and that is why they must be documented. The second: a `429` response **MUST NOT** be stored by a cache. It makes sense: "you have made too many" is true for you and now, not for the next client or for a minute from now.

The deciding question is: **did the client ask for more than it is entitled to in a given time?** If the answer is yes, the problem is fixed with time and with a client that slows down; that is why it is `4xx`. If the server is saturated by the sum of all clients, and not by one in particular, it is not a `429` but a `503`: no client did anything wrong.

RFC 6585 also has a warning in its security considerations ([section 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2)): when a server is under attack, answering `429` to every request also consumes resources, so the server is **not required** to use the `429`; sometimes it is better to cut the connection. The `429` serves both for the client that goes over the line and for stopping whoever abuses; but under a volume attack, answering every request also costs, and the RFC lets the server cut the connection instead of answering.

#### 4.6.2 The fixed window

The `revisor`'s limit lives in a new file, `limitador.ts`. It is the simplest algorithm there is, the **fixed window**: it counts how many times a key was used since the window began, and when the window ends, another starts from zero:

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

Each key has its window: when it began and how many uses it has. `permitir(clave, maximo, ventanaMs)` asks three questions. Is there no window, or has it ended? A new one starts, with one use, and it is allowed. Is there a window and are uses left? One more is counted and it is allowed. Are they used up? It is rejected, and it says how many seconds remain until the window ends, rounding up. That number is the one that travels in `Retry-After`: the `revisor` does not make up a wait, it computes it. Rounding up matters: if 0.3 seconds remain, saying `0` would invite the client to try immediately, and it would receive `429` again.

`limitador.ts` knows nothing about HTTP: it receives no requests and answers nothing. It receives a key and returns a decision. That way it can be used from any handler, and it can be tested on its own, as you will see in 4.6.4.

#### 4.6.3 In the `revisor`: three per minute, per credential

What is limited? In the `revisor`, what costs most is what makes it go out to the network: requesting a check and requesting the live health (4.4.3). Without a limit, anyone with a credential can make it open thousands of connections per minute against a service, its own or someone else's, which is exactly what was happening in the opening scene. The limit is **3 checks per credential every 60 seconds**, in `pedirRevision`, and another 3 live queries per credential, in a separate window, in `salud`:

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

Two decisions, and both matter more than they seem.

**The key is the credential**: `revisiones:` plus the credential's name. That way, what one credential spends another does not pay. If the key were the service, a single credential could spend a service's three checks and leave everyone else a minute without being able to check it: the `429` would reach someone who did nothing, which is exactly what the code must not say. RFC 6585 lets you count per resource, per server, or per user; the `revisor` counts per whoever asks, because the `429` tells **that** client to slow **its** pace.

**The limit is asked before `encontrar`.** That way requests that end in `404` count too. It looks like a detail, and it is the difference between a limit that stops whoever tries identifiers one after another and one that does not see them: if the limit came afterwards, every `404` would leave before touching the limiter, and whoever enumerates would never spend any window. There is another benefit: the key comes from something the entry point already verified (the credential), not from an identifier the client writes, so nobody can create endless keys in `limitador.ts`'s `Map` by making up ids.

Try it: three checks of service 2 with `escritura-a`, a fourth, and one of service 4 with `admin`. Then, a fourth live query with `lectura-a`, which already made three in 4.4.3, and Lesson 2's enumerator with `escritura-b`, requesting checks of ids 1 to 10. Finally, wait 20 seconds and try `escritura-a`'s again:

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

Line by line:

- **The first three, `202`**, as in Lesson 1. **The fourth, `429`**, with `Retry-After: 60`: `escritura-a`'s window began an instant ago and it has 60 seconds left. The body says what happened in the `revisor`'s words, and the code and the header say what to do.
- **`admin`'s, `202`**: it has its own window. What `escritura-a` spent another credential does not pay.
- **`lectura-a`'s fourth live query, `429`**, with `Retry-After: 58`: its query window began with the first request in 4.4.3, a couple of seconds earlier. It is another window, separate from the checks': asking for health spends no checks, nor the reverse.
- **The enumerator, `404 404 202 429 429 429 429 429 429 429`.** `escritura-b` belongs to team b: for it, 1 and 2 do not exist (`404`), and 3 is its own (`202`). Those three requests filled its window, even though two were `404`, and from 4 to 10 it receives `429`. At that pace, walking through a hundred thousand identifiers would take more than three weeks.
- **Twenty seconds later, `429` again**, but now with `Retry-After: 40`. The number is not fixed: it says how much really remains. A client that obeys that header makes not a single request too many.

The three accepted checks of `escritura-a` and `admin`'s have already finished. Look at the first of each, and at service 2's report, which now does have checks:

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

The `pagos` check ended up `CAIDO`, with `"detalle":"503 (reintentar en 120 s)"`: the lab answered `503` with `Retry-After: 120`, and `segundosDeEspera` read it. The `inventario` one, `LENTO`, with 1501 ms against a limit of 2000: it took half the limit or more. And service 2's report answers `200`: the `informe` defect only bites when there are no finished checks, and here there are three.

#### 4.6.4 The fixed window, seen up close

The fixed window is easy to read, and has a defect worth seeing with your own eyes. This program uses the same `limitador.ts` as the `revisor`, with a limit of 3 every 1000 ms so as not to wait a minute, and makes seven requests at chosen moments:

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

The limit says "3 per second", and between millisecond 950 and 1016, **5** went through. The first request opened the window in the first milliseconds; those at 950 and 961 filled it; at millisecond 1000 the window ended and another began, which accepted three more. The seventh, at 1021, was rejected with `Retry-After: 1`. At the boundary between two windows, the fixed window lets through up to double the limit in very little time. The exact milliseconds change on every run (Node's timers are not exact to the millisecond), but the five does not.

Is it serious? It depends on what you protect. For the `revisor`, which wants to avoid thousands of queries per minute, it does not matter that a service receives six instead of three at the minute boundary. For a limit that protects something fragile, it can matter, and that is why other algorithms exist: the **sliding window**, which counts the requests of the last 60 seconds counted from now, and the **token bucket**, which replenishes permits little by little and allows a small burst but never double. Both distribute better and teach the same as the fixed window: there is a maximum, there is a time, and when it runs out, `429` with how long to wait. `limitador.ts`'s comment says it in one line.

#### 4.6.5 Security callout: the `429` as a defense

> **Security callout.** A request limit does not only protect capacity. It is also a defense, because many attacks need many requests:
>
> - **Enumeration.** In Lesson 2 you saw the enumerator that tries `/servicios/1`, `/servicios/2`, `/servicios/3`… The `revisor`'s entry point already answers the same to what belongs to others and to what does not exist, so there is nothing to learn from the responses. The limit adds another layer, in case a difference ever slips out: since it counts per credential and before looking up the service, `404`s also count, and in 4.6.3 you saw the enumerator stopped at the fourth request. What makes it work is **counting by whoever asks**; a per-resource limit would never see it, because whoever enumerates requests a different resource each time. Exercise 3 shows you both versions.
> - **Resource exhaustion.** OWASP puts it on its list of the ten most important API risks as [API4:2023, *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption), and recommends limiting how many times a client can interact with the API in a given time, with stricter limits on expensive operations, and setting execution time limits. The `revisor` does both: it limits what goes out to the network (the checks and the live query), and each query has its time limit (`limite_ms`, from 100 to 10,000), which is what produces the `504`.
> - **The `revisor` as a weapon against others.** It is the other face of Lesson 1's SSRF. The destination list decides **where** the `revisor` connects; the limit decides **how many times**. Without it, anyone with a credential could use the `revisor` to hit someone else's service, and the service would see the connections coming from the `revisor`, not from whoever requested them.
>
> **What this limit does not solve: brute force on credentials.** Guessing a credential by trying millions of values is an attack of many requests, but the `revisor` does not stop it with its limiter, and that is on purpose. A per-credential limit is no use against someone who does not have one yet, and one per source address, in this course, would also stop the matrices and the lessons' programs, which all run from `127.0.0.1`. Brute force is stopped at another layer: the identity provider or the gateway in front of the API, with long, random credentials that cannot be guessed. The [OWASP authentication cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) describes that layer: a maximum of failed attempts, counted **per account** and not just per address, because whoever attacks can change address. The `revisor`'s four credentials are practice words, written in the code so the course can be followed; in a real API they come from an identity provider, as Lesson 2 said.
>
> **The limit's key decides whom you protect.** Per credential, like the `revisor`, it spreads capacity among the clients and does not punish one for what another did. Per resource, it protects the resource, but anyone can spend everyone's window. Per source address, it stops whoever has no credential, but punishes everyone who shares one internet exit. RFC 6585 leaves it open on purpose. What is not optional is that the key come from something the server verified: a key made of free text from the client is a way of filling the limiter's memory.
>
> **What is not yet a standard.** Many APIs send, besides `Retry-After`, headers that say how many requests remain in the window. There is an IETF draft for that, *RateLimit header fields for HTTP*, which defines `RateLimit-Policy` and `RateLimit`; its most recent version is 11, from May 23, 2026, and [it is still a draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), not an RFC. And large APIs use their own names: the [GitHub REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), for example, answers `403` or `429` when a limit is exceeded, with its `x-ratelimit-remaining` and `x-ratelimit-reset` headers, and asks you to look first at `retry-after` if it comes. That is why the `revisor` only sends `Retry-After`, which is a standard, and why the course teaches the others as what they are: a pattern that each API documents, not an HTTP requirement.

### 4.7 The complete `revisor`

#### 4.7.1 The files that change

Copy your Lesson 3 folder as `~/curso-http/fig04_01/`. Eight files are new or change. First the two new ones:

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

`limitador.ts` is complete in section 4.6.2. The six that change, complete:

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

In `servicios.ts`, besides what you already saw (`salud`, `informe`, and the limits of `pedirRevision` and `salud`), `leerJson` is now exported, because `operacion.ts` uses it to read the body of `PUT /mantenimiento`. Everything else is Lesson 3.

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

In `almacen.ts` there are two changes: `revisionesDe`, which `informe` uses, and the three new startup services at the end of the file.

#### 4.7.2 The files that do not change

The rest are Lesson 3's, without a single change. They go in full so the `revisor` can be assembled from this lesson:

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

#### 4.7.3 The complete run

With the lab and the `revisor` freshly started (section 4.1.3), these are all the requests in the lesson, in order, with what they answered. They are here together so you can compare them straight through with yours:

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

And this is what the `revisor`'s terminal wrote during the whole run. Notice that the only stack traces are those of the two `500`s, and that each begins with the reference the client received:

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

#### 4.7.4 Checking the types with `tsc` (optional)

As in the earlier lessons, the programs run with `node archivo.ts` without compiling anything, and `tsc` is only for checking types. From the `fig04_01/` folder:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

It prints nothing if everything is fine. The thirteen files in `fig04_01/`, `fig04_02.ts`, `fig04_03.ts`, the two versions in `defectos/`, and the solutions in `ejercicios/` pass without errors. Notice what that means for the `informe` defect: it passes `tsc` in strict mode. Types say what shape the data has, not whether it exists; an `as` takes away TypeScript's chance to warn you.

## The error you will see

### The stack trace that travels

This is the `catch` almost everyone writes the first time, because it is the most useful while you are programming: if something fails, send me everything. To trigger it, copy the `fig04_01/` folder as `rota/` and in `rota/servidor.ts` replace the `atenderSinFiltrar` function with this one (it is a fragment; the full version is in `defectos/pila/servidor.ts`, which warns on its first line that it is not to be copied):

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

Start the lab and the `revisor` from `rota/` and request the report of service 1, which has no checks:

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

(The machine's folder is written `<carpeta>`, as in the `revisor`'s terminal; the `Content-Length: 865` counts the real folder, which is longer.)

The code is correct: `500`. Everything else is a gift to someone who should not receive it. Read it as someone who wants to attack your API would:

- **The paths.** Each frame carries the full folder where the program lives. On a real server, that says which user runs the process, what the project is called on disk, and where to look if they find another way to read files.
- **The internal names.** `servicios.ts`, `rutas.ts`, `servidor.ts`, the function `informe`, the field `resultado`. It is the map of your code, for free.
- **The technology and its version.** `node:events:508:28` and `node:_http_server:1210:12` are Node frames, and their line numbers change with each version: whoever knows Node can deduce which one you run, and look up its known vulnerabilities.
- **How to trigger it again.** The message says `resultado` was read on `undefined`. Together with the requested route, it tells whoever received it exactly which condition breaks the server, and lets them repeat it whenever they want.

And look at the `revisor`'s terminal in this version:

```text
revisor en http://127.0.0.1:18080
GET /servicios/1/informe
error en GET /servicios/1/informe
```

One line, with no reference and no stack trace. This `catch` gave everything to the client and almost nothing to whoever operates. If the client does not report the body it received, nobody on the server side knows what happened. It is the error in reverse, complete: the information is on the wrong side.

The fix is the `atenderSinFiltrar` from `fig04_01/`: the stack trace goes to the terminal, trimmed to the course's frames, and only the reference reaches the client. If you are thinking "but in development it helps me to see the stack trace in the response", the answer is that you have it in the terminal, right beside it, with the same information; and that a `catch` that behaves differently in development and in production is a `catch` whose production version you never tested. Stop the `rota/` programs when you finish.

### Everything is `500`

The second error is subtler, because the response is impeccable in form and false in substance. Copy `fig04_01/` again as `rota2/` and in `rota2/servicios.ts` replace the `salud` function with this one, which queries with `fetch` directly, without going through `consultar` (the full version is in `defectos/sin-pasarela/servicios.ts`, with the same warning on its first line):

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

It reads well, and does the right thing when the service answers. Start the lab and the `revisor` from `rota2/` and ask for the health of services 2, 5, and 6:

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

Service 2 comes out as before, `200` with its `503` inside. But the 5, which did not answer in time, and the 6, which answered garbage, both come out as `500`, with a reference and no stack trace. The net in `servidor.ts` did its job well: it caught an exception nobody expected, told nothing, and left the thread in the terminal:

```text
revisor en http://127.0.0.1:18080
GET /servicios/2/salud
GET /servicios/5/salud
error 53423d0e-11e2-4ce0-befe-6f701044a854 en GET /servicios/5/salud: TimeoutError: The operation was aborted due to timeout
GET /servicios/6/salud
error 3ec30ef1-4589-44c0-a95c-00c1195b86d9 en GET /servicios/6/salud: TypeError: fetch failed
```

The problem is that it **was** expected. That someone else's service does not answer in time, or answers garbage, is the most normal thing in the world for a program whose job is to query other people's services. Answering `500` tells whoever operates "your code has an error", and sends them to look in `servicios.ts` for a defect that does not exist, while the real problem is in the reports service and in the billing one. It is exactly the confusion of 7:20 PM in the opening scene. And notice the second error line: `TypeError: fetch failed`, without a single frame of the course. `fetch`'s stack trace lives entirely inside Node, and `pilaDelCurso` trimmed all of it. Not even the terminal says where it happened.

The fix is the `salud` from `fig04_01/`: ask `consultar`, which turns each way of failing into a named outcome, and choose a code for each one. **What can be foreseen is not left to reach the `500` net**: the net is for what truly nobody foresaw. Stop the `rota2/` programs when you finish.

## Common mistakes

**`500` for everything that goes wrong.** It is the mistake this lesson exists to avoid. A `500` for a slow dependency, for a maintenance, or for a request limit sends whoever operates to look in their own code, and tells the client "I don't know what happened" when it was known.

**The stack trace, the SQL, or the exception's message in the body.** The first is the error from "The stack trace that travels". The last is the one that slips out most, because it seems harmless: an exception's text is written by whoever threw it, and it may carry a query, a path, or an internal address.

**A `500` with nothing that allows finding it.** The opposite of the previous one: silencing everything, even on the side of whoever operates. A `500` without a reference, on a server that serves thousands of requests per minute, cannot be associated with any line of the log.

**A `503` without `Retry-After`, or with a made-up one.** The RFC does not oblige you to send it, but a `503` without it leaves the client guessing how long to wait, and each client guesses differently. And a `Retry-After: 1` set "just in case" on a two-hour maintenance makes all the clients come back every second, which is the opposite of what you wanted.

**A permanent `503`.** The `503` promises that it is temporary. For something that was withdrawn forever, the code is `410` (Lesson 3); for something that does not exist, `404`.

**Answering with the code of the service behind.** If the payments service answers `503` and your health query answers `503`, every machine along the way concludes that you are the one that is down. The query worked: it is a `200` with the `503` inside, as in 4.4.3. And the other way around, if your API uses another service to serve, a `404` from that service is not a `404` of yours: do not forward another's codes to the client.

**A `429` without `Retry-After`, or a limit nobody documented.** A client that receives a `429` without knowing how long to wait retries immediately, and receives `429` again. RFC 6585 leaves open how much, how often, and by whom; leaving them undocumented as well turns the limit into a mystery that each client discovers by trial and error.

**`429` for a saturation that this client did not cause.** If the server is saturated by everyone, the code is `503`. The `429` accuses a specific client of going over the line.

**A limit whose key comes from free text from the client.** Limiting by an identifier the client can invent at no cost (an id that does not exist, a header nobody verified) gives anyone a way of creating endless keys and filling the limiter's memory.

**Waiting for a dependency with no time limit.** Without `AbortSignal.timeout`, a query to a hung service waits forever, and each request that arrives in the meantime takes up one more connection. Without a time limit there is no `504`: there is a server that is running out of resources.

## Exercises

All four correct themselves: each ends with a run that tells you whether you got it right. Write your prediction in the [log](bitacora.md) **before** running anything. For 1, 3, and 4 you need the lab and the 4.7 `revisor` running, freshly started.

### Exercise 1 — Who is at fault?

Predict the code of each of these six requests and, for each, who is at fault and who can fix it. Careful: not all are server errors.

```bash
curl -i http://127.0.0.1:18080/servicios/3/salud -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/4/informe -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer escritura-a'
curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":"si"}'
```

Then run them and compare.

### Exercise 2 — A `Retry-After` that is not valid

In 4.5.3 you saw that `segundosDeEspera` does not use `Date.parse`. This exercise shows you why. Write a naive version, `segundosConDateParse`, that accepts digits and hands everything else to `Date.parse`, and compare it with the `revisor`'s in a program (`ejercicios/ej2.ts`) with these nine values:

- `"120"`, `"1.5"`, `"-1"`, and `"12 30"`
- `"Xyz, 21 Oct 2026 10:00:00 GMT"` and `"Wed, 32 Oct 2026 10:00:00 GMT"`
- the same date, one minute in the future, in the three HTTP-date forms: the preferred one, the RFC 850 one, and the `asctime` one

Before running anything, decide which are valid `Retry-After` values according to RFC 9110's grammar, and predict what each version returns for each. Hint: the RFC's grammar lists the days and months, and says an HTTP date is always in GMT; `Date.parse` knows nothing of that.

### Exercise 3 — The enumerator against the limit

With the lab and the 4.7 `revisor` freshly started, predict which codes `escritura-b` receives when requesting checks of ids 1 to 10, one after another. Then, `escritura-a` requests three checks of service 2, and right afterwards `admin` requests one of the same service: what does `admin` receive?

```bash
for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
```

Now make a copy of `fig04_01/` and in its `servicios.ts` change `pedirRevision`'s limit to the one that seems most natural: **per service** (the key `revisiones:` plus the service's id) and **after** `encontrar`. Do not touch your `fig04_01/`, which is the `revisor` that Lesson 5 receives. Start the copy, repeat the same requests, and predict again. Which of the two versions stops the enumerator? Which punishes `admin` for what `escritura-a` did?

### Exercise 4 — Without the lab

Stop the lab (`Ctrl+C` in its terminal) and leave the `revisor` running. Predict what these requests answer, and how long the second takes:

```bash
curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
sleep 2
curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
```

Service 5 gave `504` in 4.4.3. Does it still give `504`?

## Solutions

### Solution 1

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

In order:

- **`404`**: service 3 belongs to team b, and for `lectura-a` it does not exist. It is a client error, the same as in Lesson 2, and the health query never went out to the network. Fault and fix: the client's.
- **`500`**: service 4 (`inventario`) has no finished checks, and `informe` blows up, just like with 1. Fault: the `revisor`'s code. Fix: whoever operates it, correcting `informe` (the response's reference leads to the stack trace in the terminal).
- **`403`**: requesting a check is writing, and `lectura-a` only reads. It is not a `429`: question 4 of the entry point is answered before the limit, which lives inside the handler. Fault and fix: the client's, or whoever gave it that credential.
- **`504`**: `reportes` does not answer within 1000 ms. Fault: the reports service. Fix: whoever operates it. The `revisor` has nothing to correct.
- **`200`**: `pagos` answered `503`, and the `revisor` reported it successfully. Nobody made a mistake with this request; the bad news is the data it carries.
- **`422`**: `"si"` is not a boolean. The `admin` passed the entry point and the role check, and the body could be read, but it cannot be fulfilled: it is Lesson 3's `400`/`422` policy. Fault and fix: the client's.

Only two of the six are server errors, and they belong to two different servers. If you got the third wrong, review the order: the role's permission is asked at the entry point, and the limit inside the handler.

### Solution 2

Only `"120"` is a valid `delay-seconds` (`1*DIGIT`). `"1.5"`, `"-1"`, and `"12 30"` are neither seconds nor an HTTP date. `"Xyz, …"` has the shape of the preferred date, but `Xyz` is not a day: the RFC lists the seven. `"Wed, 32 Oct …"` has the right shape, but October 32nd does not exist. The last three are valid: the preferred one and the two obsolete ones that whoever reads **must** accept (section 5.6.7). A correct function returns `120`, five `null`s, and about `60` seconds three times. This program compares the two:

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

(The three valid dates give `61` and not `60` because the program rounds "in one minute" to the next second, and `segundosDeEspera` rounds up.)

The `revisor`'s column is correct on all nine lines. The `Date.parse` one has two kinds of errors.

**It accepts what is not a date.** With `"1.5"`, `"-1"`, `"12 30"`, and `"Xyz, …"`, the naive version returns **`0`**, "you may try now". They are not digits, so it tries to read them as a date, and V8's `Date.parse` is so permissive that it accepts them: `"1.5"` it reads as a date in 2001, and in `"Xyz, …"` it does not even look at the day's name. Since those dates have already passed, the result is `0`. A server that sends a misspelled `Retry-After` gets the opposite of what it wanted: a client that insists immediately. The `revisor`'s version returns `null`, which is the honest thing: "they didn't tell me how long to wait". (With `"Wed, 32 Oct …"`, by contrast, `Date.parse` did refuse; `Date.UTC`, which `fechaHttp` uses, would have accepted it, and that is why `fechaHttp` checks the date at the end.)

**It reads `asctime` in local time.** With the `asctime` date, the naive version returns **`21661`**, about six hours, and the `revisor`'s, `61`. The `asctime` format does not write the time zone, and the RFC says it is GMT; `Date.parse` reads it as **local** time. This run was done on a machine at UTC−6, so the date ended up six hours in the future. On a machine at UTC, the two columns would give the same: it is a failure that depends on where the program runs, the worst kind of failure, because it is not seen on the machine of whoever writes it.

The lesson for your own code: **read a header with its grammar, not with the closest function that "seems to work"**. `Date.parse` is good for reading a date you already know is a date, and in the zone you already know it has.

### Solution 3

With the `fig04_01/` `revisor`:

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

The enumerator receives `404 404 202` and then `429` seven times: the first three requests filled its window, even though two were `404`, because the limit is asked before looking up the service and counts per credential. And `admin` receives `202`: what `escritura-a` spent another credential does not pay.

With the copy, in which the limit counts per service and is asked after `encontrar` (the full file is in `ejercicios/ej3/servicios.ts`):

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

The two results are reversed. The enumerator walks through all ten ids without a single `429`: each `404` leaves `encontrar` before touching the limiter, and the only one that touches it is 3, once. With a hundred thousand ids it would be the same. And `admin` receives `429` with `Retry-After: 60`, for three checks that another person requested: the code accuses it of a pace that was not its own. The "natural" version has both defects at once, and that is why the `revisor` does not use it. Stop the copy when you finish.

### Solution 4

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

Both are `502`, "could not connect": with the lab stopped, nobody listens on port 18081, the connection is refused (`ECONNREFUSED`), and `consultar` classifies it as `sin-conexion`. **Service 5 no longer gives `504`**: it gives `502`, and in under 2 milliseconds (`0.001450 s`), not in 1000. The `504` needs someone to accept the connection and not answer; here nobody accepted it, and the attempt ended instantly. The same service, with the same limit, can produce two different codes depending on **how** what is behind fails. And the check requested with the lab down ended up `CAIDO` with `"detalle":"sin conexión"`, with no code and no milliseconds: there was no response, and the result does not invent one. Start the lab again when you finish.

## How I know I succeeded

- [ ] For each of the lesson's five codes, you say from memory who is at fault, who can fix it, and what the client does.
- [ ] `curl -i` to `/servicios/1/informe`, with the `revisor` freshly started, gives `500` with `error interno; referencia <uuid>`, and you find that reference in the terminal, with the stack trace that starts in `servicios.ts`.
- [ ] `/servicios/2/salud` gives `200` with `"codigo":503`, and you explain why it is not a `503`.
- [ ] `/servicios/5/salud` gives `504` in a little over a second, and `/servicios/6/salud` gives `502` almost instantly.
- [ ] With maintenance mode enabled by `admin`, any request, even to a route that does not exist and without a credential, gives `503` with `Retry-After: 120`; and `PUT /mantenimiento` with `escritura-a` gives `403`.
- [ ] The fourth check requested with the same credential in a minute gives `429` with `Retry-After: 60`, and twenty seconds later, with a smaller `Retry-After`; a check with another credential still gives `202`.
- [ ] `escritura-b` requesting checks of ids 1 to 10 receives `404 404 202` and then `429`, and you explain why a per-service limit would not stop it.
- [ ] You explain, with the run of `fig04_02.ts`, why a fixed window of 3 per second lets 5 through in under 70 ms.
- [ ] You explain what a stack trace in a `500`'s body reveals, with the run of `defectos/pila/`.
- [ ] When you finish, no program is left listening: `curl -i http://127.0.0.1:18080/` and `curl -i http://127.0.0.1:18081/codigo/200` both give error 7.

## Summary

Answer without looking at the lesson:

1. What two questions must be answered for any failure, and what do the `429`, `500`, `502`, `503`, and `504` answer?
2. Why is the `429` a `4xx`, if it speaks of capacity? And why is the `503` a `5xx`, if the server works?
3. What condition do the `502` and `504` share in RFC 9110, and what separates them?
4. Why is the health query of a service that answers `503` a `200`?
5. What are the two forms of `Retry-After`, and why is `1.5` not a valid value?
6. What goes in a `500`'s body, what goes in the terminal, and what joins them?
7. Why does the checks' limit count per credential and get asked before `encontrar`? What would happen with a per-service limit?
8. What defect does the fixed window have, and which algorithms avoid it?

## Sources

All consulted on October 21, 2026.

1. [RFC 9110, *HTTP Semantics*, section 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6): the `5xx` family, "the server is aware that it has erred or is incapable", and the explanation of whether the condition is temporary or permanent.
2. [RFC 9110, section 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1): the `500`, an unexpected condition that prevented fulfilling the request.
3. [RFC 9110, section 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3): the `502`, an invalid response received while acting as a gateway or proxy; and [section 3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.7): what a gateway is and what a proxy is, and the terms *inbound* and *upstream*.
4. [RFC 9110, section 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4): the `503`, temporary overload or scheduled maintenance, optional `Retry-After`, and the note that an overloaded server may simply refuse the connection.
5. [RFC 9110, section 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5): the `504`, a response that did not arrive in time while acting as a gateway or proxy.
6. [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): `Retry-After = HTTP-date / delay-seconds`, `delay-seconds = 1*DIGIT`, and its meaning with a `503`; and [section 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7): the three formats of the HTTP date, which whoever reads must accept.
7. [RFC 6585, *Additional HTTP Status Codes*, section 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4): the `429`, "too many requests in a given amount of time", optional `Retry-After`, the freedom to identify the user and count, and the prohibition on caching it; and [section 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2): answering `429` under attack also consumes resources, and is not mandatory.
8. [MITRE, CWE-209, *Generation of Error Message Containing Sensitive Information*](https://cwe.mitre.org/data/definitions/209.html): stack traces, paths, and the structure of queries in an error message as a weakness.
9. [OWASP, *Error Handling Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html): the error's detail is logged on the server side and the user is answered with a generic message; and the [*Logging Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): access tokens and sensitive data are not logged as they are.
10. [OWASP API Security Top 10, API4:2023 *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption): limiting how many times a client interacts with the API in a given time, and setting execution time limits.
11. [OWASP, *Authentication Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), section *Protect Against Automated Attacks*: the limit on attempts against brute force, counted per account and not just per source address.
12. [IETF, *RateLimit header fields for HTTP*, `draft-ietf-httpapi-ratelimit-headers-11`](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) (May 23, 2026): defines `RateLimit-Policy` and `RateLimit`; it is a draft, not an RFC.
13. [GitHub REST API documentation, *Rate limits for the REST API*](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api): `403` or `429` when a limit is exceeded, `retry-after`, `x-ratelimit-remaining`, and `x-ratelimit-reset`.
14. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static): the signal aborts with a `DOMException` named `TimeoutError`, distinct from `AbortError`; and [Node.js 24: `crypto.randomUUID()`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandomuuidoptions): a version 4 UUID generated with a cryptographic generator.
15. [`curl` manual](https://curl.se/docs/manpage.html): `-m` (`--max-time`), `--http0.9`, and the exit codes 1 (unsupported protocol), 7 (could not connect), 18 (incomplete transfer), 28 (timeout), and 52 (the server answered nothing).

### Terms in this lesson

| | |
|---|---|
| **gateway** | a server that, to answer, asks something of another server and responds with what it got; if the other fails, it answers `502` or `504` |
| **dependency** | a service from which another needs a response to do its job |
| **reference** | a random identifier that travels in the `500` and stays in the log next to the stack trace, to find an error without revealing anything |
| **stack trace** | the list of functions that were running when an error occurred, from most recent to oldest |
| **log** | what the server writes for whoever operates it; in the `revisor`, its terminal |
| **rate limiting** | how many requests are accepted in a given time; when exceeded, `429` |
| **fixed window** | a limit that counts from the start of a window and goes back to zero when the window ends |
| **maintenance mode** | a state in which the server decides not to serve and answers `503` with `Retry-After` |
| **`Retry-After`** | the header that says how long to wait before requesting again: seconds or an HTTP date |

---

**Previous:** [Lesson 3 — The client made a mistake (II): 409, 410, 412, 422, and 428](03-errores-del-cliente-estado.md) · **Next:** [Lesson 5 — Problem Details (RFC 9457)](05-problem-details.md)

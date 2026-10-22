# Lesson 6 — Retries and idempotency

It is 11:50 PM on the last day of the month, and the operations team is registering, with a script, the fourteen new services that the `revisor` has to watch from midnight on. The script does not talk to the `revisor` directly: it goes through the company's gateway, like everything else. At 11:52 the gateway has a bad minute. The script sends the registration of `agenda`, the `revisor` receives it, stores it, and answers `201`, and that response is lost on the way back. What reaches the script is a `502 Bad Gateway`. Whoever wrote it was prudent: faced with a `502`, it retries. The second attempt does get through, and the `revisor` answers `409 Conflict`: "a service called agenda already exists". The script treats the `409` as an error, stops, and leaves thirteen services unregistered. At 12:00 the checks begin and half the dashboard is empty. Nobody knows whether `agenda` was created by the script or by someone else, because the `409` does not say. And the on-call person, to avoid taking a risk, deletes `agenda` and creates it again by hand, just as another colleague relaunches the whole script.

None of those decisions was foolish. What was missing was a way to **repeat a request without fear that it does the same thing twice**, and a clear rule for **when** to repeat it. That is what this lesson builds.

**Time:** 2 × 45 min (the split is between sections 6.4 and 6.5)

**What you build:** a `POST /servicios` that can be repeated without duplicating as long as the server remembers the key (section 6.7 says how far that goes), using the `Idempotency-Key` header; a gateway that loses responses on purpose, so you can see the `502` that does not say whether the write happened; a client that retries the registration with the same key; the `revisor`'s checks with retries, exponential backoff, and *jitter*; and a program that verifies the idempotency of the registration

**What you learn:** what safe and idempotent methods are according to RFC 9110, and what idempotency does **not** promise; the two questions that decide a retry; exponential backoff with full *jitter* and why randomness protects the server; when to obey `Retry-After` and when not to wait at all; `Idempotency-Key` and why it is still **not a standard**; how long a key lasts, what happens if the body changes, and what it does not cover; and what to do with a `502` that does not say whether the write happened

**Where you are coming from.** From [Lesson 5](05-problem-details.md), with a `revisor` whose errors are already Problem Details: a stable `type`, a `title` that does not change, a `detail` for the person who reads. In [Lesson 4](04-capacidad-y-fallas-del-servidor.md) you learned to read `Retry-After` in its two forms, and you saw that a check of `pagos` ends up with `"detalle":"503 (reintentar en 120 s)"`, but the `revisor` did nothing with that number. In [Lesson 1](01-exitos-redirecciones.md) you saw that a second `DELETE` changes nothing, and that this had a name: idempotency. This lesson brings the three together. Up to here, repeating a registration creates another service or collides with the `409` for the repeated name without letting you know whether the service was yours, and the checks never retry.

**What this lesson does not do.** It does not write the table that decides what to do with each code on the client side; that is [Lesson 7](07-quien-lee-el-error.md), which also decides what to do with the `409` of a key still in progress. It does not document the header in OpenAPI; that is [Lesson 8](08-contrato-verificable.md). It does not store the keys in a database: the `revisor` keeps them in memory, and section 6.7 says what changes in a real API. And it does not implement a shared retry budget or a circuit breaker: it mentions them in 6.3.3 because they exist and are worth knowing, but the `revisor` only caps how many times it retries each query.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS with Node 24.14.1 and curl 8.7.1, adding `-sS` to each `curl` because the output went to a file (`-s` turns off the progress meter, `-S` lets errors show, and neither changes the response). All the series were run on ports 18080, 18081, and 18082, which are the ones you will type, on the final version of the programs, and each `.salida.txt` file is the capture exactly as it came out, except that the `-sS` was removed from the command lines (`fig06_02.salida.txt` uses no servers: it is a random sample). The broken versions in "The error you will see" and the solution to exercise 3 were run from copies in other folders; in the outputs, the checker appears as `node fig06_03.ts`, which is how you will run it. In your run, the `Date` date, the final eight digits of each `ETag` (the `revisor` draws them at startup), the measured milliseconds, the waits that the *jitter* draws (those of `fig06_02.ts` are different every time, on purpose), the keys that `alta-segura.ts` makes up, and the names that `fig06_03.ts` makes up will change. The `revisor` keeps everything in memory, services and keys: to get the same as the lesson, start the lab, the `revisor`, and the gateway again before each series of requests. It was not run on a desktop Mint installation, and nothing used depends on macOS. The programs are in [`programas/06-reintentos-idempotencia/`](../programas/06-reintentos-idempotencia), in the course repository: the `revisor` in `fig06_01/`, backoff seen up close in `fig06_02.ts`, the idempotency checker in `fig06_03.ts`, the mock server in `fig06_04.ts`, the broken versions in `defectos/`, the solution to exercise 3 in `ejercicios/ej3/`, and each run in its `.salida.txt` file (the one for exhausted attempts, in `agotados.salida.txt`). All of them pass `tsc` in strict mode (section 6.10).

## By the end you will be able to

- Say, for each HTTP method, whether it is safe, whether it is idempotent, or neither, citing RFC 9110, and demonstrate it by repeating a request against the `revisor` and comparing the state before and after.
- Explain why a repeated `DELETE` that answers `204` and then `410` is still idempotent, and why a repeated `PUT` with `If-Match` answers `412` even though its change did happen.
- Decide whether a failure deserves a retry with two questions, can it improve on its own? and is it safe to repeat?, and justify why the `revisor` retries a `502` and not a `404`.
- Calculate the ceiling of each attempt's wait with exponential backoff and full *jitter*, and show with a run that randomness spreads out the retries of a thousand clients.
- Make a repeated `POST` with the same `Idempotency-Key` return the same response without creating another resource, and trigger the two rejections the draft proposes: `422` if the key arrives with a different body and `409` if the original is still in progress.
- Explain the limits of an idempotency key: how long it lasts, what counts as "the same body", and what it does not cover, each with a run that demonstrates it.
- Explain what a client does when it runs out of attempts or nobody answers (it exits with a message and with code `1`, without waiting any longer than needed), and trigger those cases with the `revisor` or the gateway shut down.
- Predict what `alta-segura.ts` does with a `4xx`, with a short `Retry-After` and with a long one, with a server that does not answer, and with the two `409`s, and verify it with the mock server.
- Run a program that verifies the registration's idempotency and read its failure against a version broken on purpose.

## The why before the how

A retry is the most natural response to a failure, and also the most dangerous one. Natural, because many failures are passing: a service that was restarting, a gateway with a bad minute, a connection that dropped. Dangerous, for two reasons that this lesson separates carefully.

The first is that **you do not always know whether what you asked for happened**. When a request fails before reaching the server, repeating it is harmless: the server never saw it. When it fails *after* the server handled it, but before the response reached you, repeating it is asking for the same thing a second time. From your side, the two cases look the same: a `502`, a timeout, a dropped connection. The opening scene is exactly that: the `revisor` created `agenda`, and the script never found out. If the operation is a read, it makes no difference. If the operation is to create, charge, send an email, or move inventory, repeating it can duplicate the effect.

The second reason is that **a retry costs the server**. If a service fails because it is saturated and a thousand clients retry at the same instant, what it receives is not relief but another wave of a thousand requests, and then another. A badly done retry turns a two-second stumble into a twenty-minute outage.

HTTP already solves part of the first problem. RFC 9110 classifies the methods: some are **idempotent**, and repeating them leaves the server the same as doing them once. With those, a retry is safe by definition. But the method used to create things, `POST`, is not, and it is exactly the one where failure hurts most. For it, the industry invented a header, `Idempotency-Key`, which an IETF draft tried to standardize without ever being published as an RFC. The second problem, that of the saturated server, is solved in the client: wait longer each time between attempts, draw the wait at random, and obey the server when it says how long to wait.

The lesson has four parts:

1. **What can be repeated** (6.1 to 6.3): this lesson's `revisor`, safe and idempotent methods, and the two questions that decide a retry.
2. **How to repeat it** (6.4): exponential backoff, *jitter*, and `Retry-After`, with the `revisor`'s checks.
3. **What cannot be repeated… until it can** (6.5 to 6.7): the `502` that does not say whether the write happened, `Idempotency-Key`, and its limits.
4. **The complete `revisor`** (6.8 to 6.10): the files, the run, and the program that verifies it.

## The concepts

### 6.1 This lesson's `revisor`

#### 6.1.1 What changes

Lesson 5's `revisor` gains three files and changes four:

- **`idempotencia.ts`** (new) stores, per credential and per key, the fingerprint of the request and the response it received. It is section 6.6.
- **`pasarela.ts`** (new) is a separate program that listens on port 18082 and forwards everything to the `revisor`. With the header `X-Simular: perder-primera`, the first time it sees a request it lets the `revisor` handle it and throws away the response: it answers the client with `502`. If the `revisor` does not answer (because it is shut down), it also answers `502` and keeps listening. It is section 6.5.
- **`alta-segura.ts`** (new) is a client that registers a service through the gateway and retries with the same key, up to four times, and stops as soon as they run out. It obeys `Retry-After`, cuts each attempt off by time, and exits with 0 only if the registration was done. It also belongs to section 6.5.
- **`servicios.ts`** reads `Idempotency-Key` on the registration, and the checks use `revisarConReintentos` instead of `revisar`.
- **`cliente.ts`** separates the classification (`clasificar`) from the query, and gains backoff with *jitter* and `revisarConReintentos`. It is section 6.4.
- **`problemas.ts`** adds two types to the catalog: `llave-en-curso` (`409`) and `llave-reutilizada` (`422`).
- **`respuestas.ts`** changes how the body is read: when it exceeds the 16 KiB limit, the `revisor` finishes reading what the client is still sending before answering the `413`, so that the response is not lost. It is section 6.8.1.

No route, no entry-point code, and no header from the earlier lessons changes. The new header is optional: a registration without it behaves exactly as in Lesson 5.

#### 6.1.2 Starting the three

The `revisor` lives in `~/curso-http/fig06_01/`; section 6.8 brings all its files. Open three terminals in that folder:

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

You do not use the gateway until section 6.5, but it is best to have it up from now on. And a warning that holds for the whole lesson: the `revisor` keeps services, checks, and keys in memory. Each series of requests in this lesson begins with the three programs freshly started; if yours follows another, stop them with `Ctrl+C` and start them again, or the ids and the responses will not match.

### 6.2 Safe and idempotent: what RFC 9110 says

#### 6.2.1 The two properties

RFC 9110 defines two properties of methods, and they are worth reading carefully because they get confused.

A method is **safe** if its semantics are essentially read-only: whoever uses it neither requests nor expects any change of state on the server ([section 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1)). The RFC's safe methods are `GET`, `HEAD`, `OPTIONS`, and `TRACE`. "Safe" does not mean the server does nothing: the RFC itself gives the example of the access log, which grows with every `GET` and could even fill the disk. It means the client did not ask for that effect and is not responsible for it.

A method is **idempotent** if the intended effect on the server of several identical requests is the same as for a single one ([section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)). The RFC's idempotent methods are `PUT`, `DELETE`, and all the safe ones. The word comes from mathematics: applying an operation twice gives the same as applying it once.

And section 9.2.2 says what the distinction is for, with a clarity worth quoting: idempotent methods are distinguished because **the request can be repeated automatically if communication fails before the client reads the response**. If the connection of a `PUT` closed before anything was received, the client can open another and repeat it: it knows that repeating it will have the same intended effect, even if the original request did succeed, "though the response might differ".

| Method | Safe | Idempotent | Source |
|---|---|---|---|
| `GET`, `HEAD`, `OPTIONS`, `TRACE` | yes | yes | RFC 9110, 9.2.1 and 9.2.2 |
| `PUT`, `DELETE` | no | yes | RFC 9110, 9.2.2 |
| `POST` | no | no | RFC 9110, 9.3.3 |
| `PATCH` | no | no | RFC 5789, section 2 |

`POST` is not idempotent because its semantics are "process this according to your own rules" ([section 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3)), and one of its typical functions is to create a resource that the server has not yet identified. Two identical `POST`s can create two resources. `PATCH`, according to RFC 5789, is neither safe nor idempotent: a patch can say "add one", and adding one twice is not the same as adding it once.

The practical consequence is in a line of the same RFC: **a client should not automatically retry a request with a non-idempotent method**, unless it has some way to know that that particular request is in fact idempotent, or some way to detect that the original was never applied. Those two ways out are exactly what you are going to build: the first is `Idempotency-Key`; the second, reconciling (rereading the state and seeing what happened). And one line further down, another rule that matters to whoever operates gateways: **a proxy must not automatically retry non-idempotent requests**. A gateway that retries a `POST` on its own can duplicate what its client never asked to duplicate.

#### 6.2.2 Seeing it in the `revisor`

With the three programs freshly started, repeat each operation twice and look at what is left. Start with a `PUT` with its tag, as Lesson 3 taught:

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

The first `PUT` changed the limit to 1500 and answered `200` with a new tag. The second, identical, answered `412`. And even so, the final state is the one you asked for: `"limite_ms":1500`. Idempotency held, because the effect of two `PUT`s is the same as that of one; what changed was the response, which is exactly what the RFC warns about. The `412` does not say "your change did not happen"; it says "your tag is no longer the current one". Whoever retries a conditional `PUT` and receives a `412` has to reread before concluding that they lost: it may be that the current version is, precisely, theirs.

Now a `DELETE` twice:

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

`204` and then `410`. Different responses, identical effect: after one `DELETE` or two, service 4 is withdrawn. This is the case that Lesson 1 anticipated. A client that retries a `DELETE` and receives `410` (or `404`) should not treat it as a failure: what it wanted is already true.

Now a registration `POST` twice, with nothing else:

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

The first created `avisos` with id 7. The second did not create another, but not because `POST` is idempotent: it was stopped by a business rule, that the name be unique within the team. That net saved you from a duplicate, and in exchange left you with the doubt from the opening scene: the `409` says that `/servicios/7` exists, it does not say who created it. If your first attempt had been lost on the way, you would not know whether `/servicios/7` is yours or belongs to a colleague who picked the same name.

And a `POST` that has no net at all:

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

Two requests, two checks: `/revisiones/1` and `/revisiones/2`. Requesting a check is not idempotent, and nothing stops it. Here the cost is small (one extra query to the service), but notice the pattern: it is the shape of any `POST` that creates something without a value that makes it unique. A purchase order, a payment, a message.

#### 6.2.3 What idempotency does not promise

Three things get confused with idempotency and are not it.

**It does not promise the same response.** The RFC says so in so many words, and you have just seen it: `204` and `410`, `200` and `412`. A client that compares the second response with the first to decide whether something went wrong is measuring the wrong thing.

**It does not promise that nothing changes.** A repeated `PUT` with `If-Match: *` leaves the same content, but the `revisor` raises the version on every write, so the `ETag` changes from `"1-2-…"` to `"1-3-…"` (you will see it in exercise 1). The RFC leaves room for that: idempotency refers to the effect the user asked for, and the server is free to keep history, logs, or versions on the side.

**It is not a property of the network, but of the method and the server.** The RFC saying that `PUT` is idempotent is a promise that the server has to keep. If your server implements a `PUT` that adds, or a `DELETE` that deletes "the last one", you broke the promise, and every client, proxy, and library that relies on it will duplicate effects without knowing. The RFC says this about safe methods, and it holds just as well here: if a URI does something unsafe with a safe method, the responsibility lies with whoever designed it.

### 6.3 When to retry and when not to

#### 6.3.1 The two questions

Every time a request fails, the `revisor` (and any client you want to write) asks itself two questions, in this order:

1. **Can it improve on its own?** A saturated service, a gateway that is restarting, a timeout: waiting may fix it. An invalid credential, a service that does not exist, a malformed body: it cannot. Repeating what cannot improve on its own just wastes the server's patience and yours.
2. **Is it safe to repeat?** If the method is idempotent, yes. If it is not, only with an idempotency key or if you know the original never arrived.

Only if both answers are "yes" is a retry made. This is a design criterion, not a rule: the RFC tells you when it is *safe* to repeat, and each API decides when it is *worth it*.

#### 6.3.2 What the `revisor` retries

The `revisor`'s checks are `GET`s to the services it watches: safe and idempotent, so the second question is always "yes". The first is answered by the `vale` function in `cliente.ts`:

| Outcome of the query | Can it improve on its own? | Does it retry? |
|---|---|---|
| no connection, timeout, response that is not HTTP | it can: whatever is behind may be starting up | yes |
| `429 Too Many Requests` | yes: the limit resets over time | yes, if `Retry-After` does not ask for more than 5 s |
| `502`, `503`, `504` | yes: the failure is in something behind it or is temporary | yes (if the response carries `Retry-After`, with the same condition) |
| `500` | almost never: it is a defect in the server | no |
| any other `4xx` | no: what has to change is the request | no |
| forbidden destination (SSRF) | no: the rule is not going to change | no |

The `500` deserves a separate line, because many clients do retry it. RFC 9110 says that a `500` is an unexpected condition that prevented the server from fulfilling the request; Lesson 4 treated it as a defect in the server, and repeating a request against a defect almost always reproduces the defect. The `revisor` decides not to retry it. Other APIs decide differently, and it is a decision that gets written down, not one inherited from a library.

Any of those responses can carry `Retry-After` (it is normally seen on a `429` or a `503`): the server says how long to wait, and the `revisor` obeys it if it is reasonable. You will see it in 6.4.3.

#### 6.3.3 How many times, and in which layer

RFC 9110 has another sentence, at the end of section 9.2.2, that is worth knowing: **a client should not automatically retry an automatic retry that failed**. It is written for the case of the dropped connection (the user agent that reopens the connection and repeats once), and its spirit is clear: retries must have an end. The `revisor` makes up to three attempts per query and `alta-segura.ts` up to four, so they go beyond that letter, and it is a decision in plain view: they are application clients that know the operation, wait longer each time, and stop at a fixed cap. If you write a generic client, one that knows nothing about the operation, the RFC's recommendation is the prudent one: one retry and that is it.

The number of attempts matters more than it seems, because of **amplification**. Amazon's guide on timeouts and retries explains it with an example: five layers of services, each retrying three times on its own, multiply the load on the database at the bottom by 243, just when it is weakest. Google's SRE book describes the same phenomenon with three layers: a single action by one person ends up as 64 attempts against the database. Both sources reach the same recommendation: **retry in a single place in the chain**, limit retries per request, and have a retry budget per process that stops retrying when it runs out (the SRE book gives 60 per minute as an example; Amazon's guide proposes a token bucket).

In the `revisor`, whoever retries the checks is the `revisor`, and no one else. This lesson's gateway retries nothing: if it did so with a `POST`, it would break the RFC's rule for proxies.

### 6.4 Exponential backoff with *jitter*

#### 6.4.1 Why wait longer each time

If a request failed because the server is saturated, retrying right away makes worse what you wanted to fix. The idea of **exponential backoff** is to wait longer each time: a little after the first failure, double after the second, double again after the third, up to a cap. If the failure lasted a second, the first retry clears it. If it lasted a minute, the retries space themselves out and leave the server room to recover.

The `revisor` uses a base of 250 ms and a cap of 2,000 ms. The ceiling for attempt `n` is `250 × 2^n`, not exceeding 2,000: 500 ms before the second attempt, 1,000 before the third, and after that it would already hit the cap.

#### 6.4.2 Why at random

Backoff alone is not enough. If a thousand clients fail at the same instant (because the server went down for all of them at once), and all of them wait exactly 500 ms, at 500 ms the server receives the thousand retries together. It is the same wave, a little later. The solution that Marc Brooker analyzed and popularized on the AWS architecture blog in 2015, and which is common practice today, is to draw the wait at random: **full *jitter*** waits a random time between 0 and the ceiling. Brooker compared three ways of drawing (full, "equal", and "decorrelated"): "equal" came out worst, and between the other two the difference was less clear. The course uses full because it is the simplest to write and to explain.

This is how it is written in `cliente.ts` (fragment):

```ts
export function esperaConJitter(intento: number, baseMs: number, topeMs: number): number {
  return Math.round(Math.random() * Math.min(topeMs, baseMs * 2 ** intento));
}
```

To see it, `fig06_02.ts` uses that same function, with no server. Save it as `~/curso-http/fig06_02.ts`, next to the `fig06_01/` folder, because it imports `./fig06_01/cliente.ts`. First it draws five waits for each attempt; then it simulates a thousand clients that fail at the same instant and retry once, and counts how many retries fall in each 100 ms window:

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

The first table shows each attempt's ceiling and how the waits fall anywhere below it: on attempt 3 they ranged from 205 to 1,722 ms. From attempt 3 on, the ceiling is already the 2,000 cap. The second table is the one that matters. Without *jitter*, the thousand retries fall in the same window, the 500 ms one: the server that was starting up receives a thousand requests together. With *jitter*, they spread over five windows of about two hundred each. It is the same amount of work, but the peak is five times lower. (The three that fall in "500 or more" are those that drew a number so close to 500 that `Math.round` rounded it to 500.) Your numbers will differ; the shape, the same.

#### 6.4.3 `Retry-After` rules, with a cap

When the server says how long to wait, the client does not guess: it obeys. `Retry-After` ([RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)) indicates how long the user agent should wait before the next request, in seconds (`120`) or as an HTTP date. With a `503`, it indicates how long the service is expected to remain unavailable (the same section 10.2.3); [section 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4) adds that the server may send it to suggest how long to wait before retrying; with a `429`, RFC 6585 allows using it to say when to try again. Lesson 4 taught you to read it strictly: only digits or one of the three HTTP date forms, always in GMT, and anything else is ignored.

And what if the server asks to wait two minutes? A check that falls asleep for two minutes inside a `setTimeout` is of no use to anyone: the result arrives late and in the meantime it holds memory. That is why the `revisor` has a cap: **if `Retry-After` asks for more than 5 seconds, it does not insist** and records in the result what the service said. It is the same concern as Lesson 1's polling, which bounded the wait between 1 and 5 seconds so that a wrong server would not leave it asleep for an hour, but here the decision is different. Polling asks about the state of a job, a cheap read, and can ask again after 5 s. A check that retries after 5 s when the service asked for 120 arrives sooner than the service asked: that would be disobeying it. The honest thing is not to retry and to say why. If `Retry-After` does not come, or cannot be read, backoff with *jitter* is used.

#### 6.4.4 The checks with retries

`revisarConReintentos` brings it all together (fragment of `cliente.ts`; the complete file is in 6.8.1):

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

Read it aloud: it queries once; while attempts remain and the failure is worth retrying, it checks whether the service asked for a wait; if it asked for more than 5 s, it leaves the loop; if it asked for something reasonable, it waits that long; if it asked for nothing, it draws one; and it queries again. At the end it classifies **the last** query, with the same function as always, which the lesson separated from `revisar` so it could be used here. Notice where the wait is: inside the body of the `for`, right before the next query. When the attempts run out (`intento < INTENTOS` stops holding), the body no longer runs, so there is never a wait after the last query. The order of the two conditions does not change that: it only avoids calling `vale` when no attempts remain.

To see it work you need services that fail in different ways. With the three programs freshly started, register three lab services: one that answers `502`, another `429` (with `Retry-After: 30`), and another `404`. Then request a check of each and another of `pagos`, which answers `503` with `Retry-After: 120`. The first three with `escritura-a` and the fourth with `admin`, because each credential has three checks per minute (Lesson 4):

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

The four results say `CAIDO`, and in Lesson 4 they would have said the same. The difference is in the lab's terminal, which prints every request it receives:

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

Count the lines. `/codigo/503` appears **once**: it asked to wait 120 s, more than the cap, and the `revisor` did not insist; that is why the detail keeps `(reintentar en 120 s)`. `/codigo/429` also appears once, for the same reason (30 s). `/codigo/404` appears once: a `404` does not improve on its own. And `/codigo/502` appears **three times**: the first in order with the others and the other two afterwards, separated by the drawn waits (up to 500 ms and up to 1,000 ms). The result is that of the third attempt, which also failed. Three attempts, two waits, and not one more.

If you wonder why the `502` check still says `"ms":1` after almost a second and a half of retries: `ms` measures the last query, not the whole check. It is how long the service took to answer, which is what the `revisor` watches.

### 6.5 The `502` that does not say whether the write happened

#### 6.5.1 The gateway that loses responses

The second half of the lesson is about the opening scene. To trigger it at will, `pasarela.ts` sits in front of the `revisor` and, with the header `X-Simular: perder-primera`, lets the first request of each registration through, receives the `revisor`'s response, and throws it away. To the client it answers what a real gateway would answer if it had not received a complete response from what is behind it: `502 Bad Gateway` ([RFC 9110, section 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3)), as Problem Details with `about:blank`. It recognizes "the same request" by its `Idempotency-Key`, and if it carries no key, by the fingerprint of its body:

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

Notice what the gateway records in its terminal: "el revisor respondió 201, pero la respuesta se pierde". That line is what the client never sees. From its side, a `502` can mean that the request did not reach the `revisor`, or that it arrived and something failed, or that it arrived, was fulfilled, and the response was lost. **The `502` does not say which**, and it cannot say: the gateway does not always know either. The same holds for a `504` and for a dropped connection.

The gateway has a second `502`, which is not simulated. If the `revisor` is shut down or cuts the connection, the gateway's `fetch` fails, and a promise that fails with nobody waiting on it makes Node crash the whole process. That is why `pasar` is wrapped in `pasarSinCaerse`: it catches the failure, records "el revisor no respondió", answers `502` with a different `detail` (the gateway received no *response*, not "a *complete* response"), and keeps listening. You will see it in 6.5.3. A gateway that goes down along with what it protects leaves all its clients without even an error to read. And in the response it does let through, it forwards, among other headers, `content-length`, so that the client receives the same size the `revisor` gave (you will see it in the `201` of 6.8.4).

#### 6.5.2 The client that retries

`alta-segura.ts` is the opening scene's script, written with care: it registers a service through the gateway and, if it receives `502`, `503`, or `504`, or if it receives no response at all, it waits with *jitter* and retries, up to four attempts. It always sends `X-Simular: perder-primera`, so that the scene can be reproduced at will; a real gateway never obeys a switch like that from a client's request: it belongs only to the lab. With the `--sin-llave` option it behaves like the opening scene's script; without it, it sends an `Idempotency-Key` that it makes up at startup:

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

The line that matters is the one in the comment: **one key per intention, not per attempt**. The key is created once, before the loop, and all the retries of that registration carry it. If it were created inside the loop, each retry would be a new request for the `revisor`, which is exactly the defect in "The error you will see".

The rest of the program follows the order of the two questions in 6.3.1, and at each step makes a decision that can be seen in a run (6.5.3 and 6.5.4):

- **`intentar`** makes a request and returns the response (code, body, and `Retry-After`) or, if none arrived, the cause: the network error code that Node reports, such as `ECONNREFUSED` (nobody is listening on that port), or `tiempo agotado`. The request carries `signal: AbortSignal.timeout(LIMITE_MS)`: if the server accepts the connection and does not answer, the attempt is cut off at 2,000 ms (the variable `ALTA_LIMITE_MS` changes it, for testing). Without that limit, Node waits 300 s per attempt. A request with no response is, for whoever sent it, the same case as the `502`: it may or may not have arrived. With the same key, repeating it does not create another service, as long as the `revisor` still remembers that key (6.7).
- **`reintentable`** answers the first question: can it improve on its own? With no response, `502`, `503`, and `504`, yes. A `409` too, but only the `llave-en-curso` one, which is recognized by its `type` and not by its code: the original request is still being stored and waiting is enough. The `nombre-repetido` `409`, a `422`, and any other `4xx` do not improve by repeating them.
- **The waits.** If the server said how long to wait (`Retry-After`, read with `segundosDeEspera` from `cliente.ts`, the same function and the same 5 s cap that the checks use), it is obeyed; if it asks for more, it does not insist and says why. If it said nothing, a wait is drawn with *jitter*. The line `if (intento === INTENTOS) break;` goes **before** the wait, so that no one is put to sleep after the last attempt.
- **The ending.** When the loop ends, the program says why (one line) and exits with the corresponding code: `0` only if the registration was done (a `2xx`); `1` if it was not done or it is not known, whether because the attempts ran out, because the server asked to wait too long, or because it answered something that repeating does not fix. A script that calls `alta-segura.ts` for fourteen services reads that code and knows which ones it has to check.

Start with the version without a key. This run is part of the 6.6.4 series, which earlier registered `avisos` (7), `correo` (8), and `agenda` (9); that is why the id you will see is 10:

```text
$ node alta-segura.ts nomina2 http://127.0.0.1:18081/codigo/200 --sin-llave; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento sin llave (podría duplicar)
intento 2: 409 {"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado nomina2","instance":"/servicios","existente":"/servicios/10"}
el servidor respondió 409: repetir lo mismo no lo arregla; sin llave no se sabe si lo que ya existe lo creó un intento anterior
(código de salida: 1)
```

The first attempt received `502`. The client waited and retried, and the second attempt received `409`, "ya existe un servicio llamado nomina2", with `"existente":"/servicios/10"`. Service 10 was created by the first attempt: the write did happen, the client never found out, and now it holds a `409` that does not tell it whether that service is its own. It is the scene, complete. Without the unique-name rule, the second attempt would have created service 11, identical, and no one would have received any error. The last two lines are from the program: it does not repeat the `409` (waiting does not improve it), it says that without a key it does not know whether what already exists was created by an earlier attempt, and it exits with code `1`.

What does a client do about this, without a key? **Reconcile**: reread the state and decide. The `409` carries `existente`; the client can request `/servicios/10` and compare it with what it wanted to create. If it matches, it assumes it was itself. It works, partially: if a colleague created an identical service a second earlier, the client claims it without knowing. Lesson 7 returns to this action. The next section makes the server answer the question for you.

#### 6.5.3 When nobody answers

So far, every failure brought a response, even if it was a `502`. Two uglier cases remain: the gateway with the `revisor` shut down, and the client without a gateway. Both are a form of "I don't know if it happened", and `alta-segura.ts` and `pasarela.ts` have them covered. With the three programs freshly started, stop the `revisor` with `Ctrl+C` in its terminal (in the lesson's run it was stopped by its PID, which is why the command does not show) and request a registration again, now directly to the gateway:

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

The `revisor` no longer exists. The gateway answered `502` with Problem Details, and in its `detail` it says what happened to it: "no recibió respuesta del revisor". Compare with the simulated `detail` from 6.5.1, "no recibió una respuesta **completa**": that one was a `revisor` that did answer and whose response was thrown away; this one is a `revisor` that did not answer. To the client they are the same `502`, and again it does not say whether the registration happened. What matters is that the gateway **is still alive** to answer it: it handles the next request just the same.

Now the client. With the `revisor` still shut down, `alta-segura.ts` receives `502` on all four attempts:

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

Read it line by line. The first four lines that begin with `intento` are the four responses, all `502`. Between them, three waits: up to 500, up to 1,000, and up to 2,000 ms, which are the backoff ceilings for attempts 1, 2, and 3 (`250 × 2^n`, capped at 2,000). **There is no fourth wait**, because after attempt 4 there is nothing left to retry. The next line says why it ended: "se agotaron los 4 intentos sin una respuesta definitiva". And since the registration carried a key, it adds the honest way out: "repetir más tarde con la llave … es seguro". Whoever reads that line (a person or a script) has the key to retry when the `revisor` comes back. But simply running `alta-segura.ts` again is not enough, because it would make up another key: you have to repeat the same request with that key and the same bytes (6.7.2), for example with `curl … -H 'Idempotency-Key: <the key from the message>' -d '{"nombre":"sin-revisor","url":"http://127.0.0.1:18081/codigo/200"}'`. And the retry is only protected if the server still remembers the key: within its validity period (6.7.1) and if it did not lose it in a restart (6.7.4). Finally, `(código de salida: 1)`: the program did **not** finish successfully. `0` is reserved for a registration that was done, so a script that calls `alta-segura.ts` over a list of fourteen services can look at that code and know which ones it has to check. In 6.5.4 you will see that `1` also covers a `4xx`.

The worst-case wait is the sum of the ceilings: 500 + 1,000 + 2,000 = 3,500 ms, plus the time the requests take. Here each request has a limit of 2,000 ms, so the complete worst case is 4 × 2,000 + 3,500 = 11,500 ms; without that limit there would be no worst case, because a server that does not answer would leave the program waiting 300 s per attempt. With the same failure, a program that also waited after the fourth attempt would have added another 2,000 ms for no reason.

The variant without a key ends at the same point, but with a different message:

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

The wait lines say "sin llave (podría duplicar)" on every attempt, and the ending no longer promises anything: "no se sabe si el alta ocurrió". It is the same thing that happened to the opening scene's script, said in time. Without a key, the program has no way to offer a safe retry, and it does not make one up.

The last case is that of the client without a gateway. Also stop the gateway with `Ctrl+C` in its terminal (in this series, like the `revisor`, it was stopped by its PID, which is why the run does not show it) and register another service:

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

Now the attempts do not say `502`: they say "sin respuesta (`ECONNREFUSED`)". Nobody is listening on port 18082, so the operating system rejects the connection before a single byte of the request travels. It is the only case in the lesson where you would know for certain that the request did not arrive, but `alta-segura.ts` does not rely on that: it treats any network error like a `502` (it may or may not have arrived, and with the same key repeating is safe) and retries with the same ceilings and the same ending. Notice what does **not** appear: Node's stack trace (`node:internal/modules/run_main…`) with which a program ends when it did not catch its `fetch`. The program catches the error, translates it into one line that a person understands, and returns code `1`.

And the gateway's terminal tells what it saw:

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

Nine lines of "el revisor no respondió": one for the `curl` request, four for the attempts of `sin-revisor` with a key, and four for those of the variant without a key. The four attempts of `sin-pasarela` do not appear because they never reached it. Three different programs, three ways of failing, and none crashed or left the client without a line to say.

#### 6.5.4 What it does with what it receives

So far, `alta-segura.ts` has decided by the code: `502`, `503`, `504`, or no response, it repeats. But the server says more than a code, and the program listens in five places. To see them you need a `revisor` that answers things the real one does not usually answer, so this section uses two tools: the `revisor`'s maintenance mode (`PUT /mantenimiento`, which you met in Lesson 4) and a mock server, `fig06_04.ts`, which listens on port 18082 where the gateway would be and answers whatever you tell it.

**A `4xx` is not repeated, and exits with 1.** An address that is neither `http` nor `https` is a `422`; repeating the identical request would give the same `422`. With the gateway and the `revisor` freshly started:

```text
$ node alta-segura.ts invalida ftp://archivos; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 422 {"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
el servidor respondió 422: repetir lo mismo no lo arregla
(código de salida: 1)
```

The first attempt received a `502` because the gateway lost the response (6.5.1); the second, with the same key, arrived whole: `422` `datos-invalidos`. The program neither waits nor retries a third time. It says in one line what happened, "el servidor respondió 422: repetir lo mismo no lo arregla", and exits with `1`. A `0` here would tell a script that the registration was done.

**`Retry-After` rules, with the same cap as the checks.** With the `revisor` in maintenance, every write receives a `503` with `Retry-After: 120`:

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

Read it like this: the first `PUT` enables maintenance (`204`) and the last disables it. In between, `alta-segura.ts` receives the simulated `502` and then the maintenance `503`. This time it does not draw a wait: it reads `Retry-After: 120`, sees that it exceeds the 5 s cap, and stops with the message "el servidor pidió esperar 120 s (Retry-After), más de los 5 s que este programa espera; no se reintenta", plus the key in case someone wants to repeat later. It is the same rule as 6.4.3, with the same function (`segundosDeEspera`) and the same cap.

To see the other side you need a server that asks for a short wait. This is where the mock server comes in:

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

One response per request, and the last one repeats. `503:2` is a `503` with `Retry-After: 2`; `409:en-curso` is the `409` of the key in progress (with its `type`, which is what `alta-segura.ts` looks at); `mudo` accepts the connection and does not answer. Stop the gateway with `Ctrl+C` (in the run, by its PID) and start the mock server in its place, in another terminal. First, a `503` that asks for two seconds and then a `201`:

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

The wait line changed shape: "el servidor pide esperar 2 s (Retry-After); espero 2 s y reintento con la misma llave". It is no longer a draw between 0 and a ceiling, it is what the server asked for. The second attempt receives the `201` and the program exits with `0`. The mock server's terminal confirms that it received exactly two requests.

**The `409` of "key in progress" is not final.** It is the `409` you saw in 6.6.4: the original request is still being stored. A client that receives this `409` has nothing to correct; it waits and repeats. `alta-segura.ts` recognizes it by the Problem Details `type` (not by the title or the detail) and treats it like any passing failure:

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

The same `409` with a different `type` (the one the `revisor` uses for a repeated name) is not retried: repeating would not change the name.

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

A single request in the mock server's terminal, `1` as the exit code. Two `409`s, two decisions, and what separates them is the `type`. That is the idea that Lesson 7 turns into a table.

When is the "in progress" `409` seen with the real `revisor`? With the default limit of 2,000 ms, almost never: the `revisor` takes 500 ms to store, so by the time an attempt is cut off by timeout, the original has already finished and the retry receives the recorded `201`. It only appears if the limit is shorter than the storing time. It was measured by lowering the limit to 150 ms with `ALTA_LIMITE_MS=150` and repeating the registration until the retry arrived before the original finished, and it takes several repetitions because it depends on where the drawn wait falls. That is why it is tested with the mock server, which answers what it is told.

**A server that does not answer is cut off by timeout.** Each attempt carries a limit (2,000 ms by default). With `ALTA_LIMITE_MS=300`, so as not to wait so long in the run:

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

Each attempt is cut off at 300 ms and the program counts it as "sin respuesta (tiempo agotado: 300 ms)": it is the same case as the `502` or the refused connection, and it is retried just the same. Four attempts, four requests in the server's terminal, and the usual honest ending. Without the limit, the first attempt would take about 300 s to give up.

### 6.6 `Idempotency-Key`: a draft, not a standard

#### 6.6.1 What it is and what state it is in

The idea is old and many large APIs use it: the client makes up a unique identifier for each operation it wants done only once, sends it in a header, and the server remembers what it answered to that identifier. If it arrives again, instead of processing the request anew, it repeats the response it already gave. Stripe's documentation explains it like this: if a connection error occurs, you can repeat the request without the risk of creating a second object or applying the change twice.

The IETF's `httpapi` working group tried to standardize that header as `Idempotency-Key`. The latest version is [`draft-ietf-httpapi-idempotency-key-header-07`](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07), dated October 15, 2025, by Jayadeba Jena and Sanjay Dalal, and it **expired on April 18, 2026 without being published as an RFC**. The document's page on the IETF Datatracker marks it as an "Expired Internet-Draft": its intended status was Standards Track, but no RFC came out of it. Put plainly: **`Idempotency-Key` is not a standard**. It is an expired draft that describes a pattern many people were already using. The draft itself lists in its implementations section Stripe, Adyen, and Yandex with a header of that name, and others that do the same with a different name (PayPal uses `PayPal-Request-Id`).

Why use it, then? Because the pattern is good, because the name is the one most people recognize, and because the draft writes the hard cases down with care. But your API has to **document it as a behavior of its own**, not as something HTTP guarantees. The draft itself asks for this: resources that use it must publish their idempotency specification (section 2.5.2), and a generic client cannot assume that a server honors it (section 2.5.1). A header the server does not know is silently ignored: if you send `Idempotency-Key` to an API that does not implement it, your retry duplicates just the same.

#### 6.6.2 What the draft proposes

The essentials of the draft, section by section, and what the `revisor` does with each:

- **Syntax (2.1).** The value is an HTTP structured fields *String*, that is, it **goes in quotes**: `Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"`. The `revisor` simplifies: it takes the value as it arrives, without removing quotes. To it, `alta-avisos-1` and `"alta-avisos-1"` are two different keys (you will see it in 6.7.4). This lesson's requests send the key without quotes, as many APIs that were born before the draft do; if you implement the pattern from scratch, accept the draft's form.
- **Uniqueness (2.2).** The key must be unique and must not be reused with a request of a different body. The draft recommends a UUID or another random identifier. `alta-segura.ts` uses `randomUUID()`; the lesson's `curl` requests use readable names like `alta-avisos-1` so you can read the runs, and in a real client you would not do that (section 6.7.5).
- **Validity (2.3).** The resource may make keys expire, and must publish that policy. It is section 6.7.1.
- **Fingerprint (2.4).** Together with the key, the server may compute a fingerprint of the body (a checksum of the whole body, of some fields, or a field-by-field comparison) to know whether the repeated request really is the same. The `revisor` uses SHA-256 over the already-read JSON.
- **What to do (2.6).** If the key is new, it is handled normally. If it was already handled and the request is the same, it answers what was answered the first time. If it arrives while the original is still in progress, it answers a conflict.
- **The errors (2.7).** `422 Unprocessable Content` if the key is reused with a different body; `409 Conflict` if it arrives while the original is still in progress; `400` if an operation requires the key and it does not come. The draft's examples answer with Problem Details. The draft adds a rule for the client: before retrying after one of these errors, the client has to correct the request, **except with the `409`**, which asks not for correction but for patience.

In the `revisor` the key is **optional**, so there is no `400`. The other two cases are the two new types in the catalog: `llave-reutilizada` (`422`) and `llave-en-curso` (`409`). The key's `409` is a different `409` from `nombre-repetido`'s, and Lesson 3 had already anticipated it: both are conflicts with the current state, but the key's is resolved by waiting and the name's by rereading. That is why they have a different `type`, and why Lesson 7 decides by `type`, not by code.

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

Four functions and a registry. `huella` summarizes the body; `tomarTurno` is the one that decides: it looks up the key **within the credential** (`${credencial}:${llave}`), and if it does not exist it reserves it with its fingerprint and no recorded response (`grabada: null`), which is what "in progress" means. If it exists with a different fingerprint, it is `otra-peticion`; if it exists with no recorded response, `en-curso`; if it exists with a response, `repetir`. `grabar` stores the response when the registration ends well. `soltar` deletes the record when the registration fails without creating anything, so that a corrected retry can get through.

And the registration, in `servicios.ts`, uses it like this (fragment; the complete file is in 6.8.1):

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

Where this block sits matters as much as what it does. It goes **after** `leerJson`, so a body that is not JSON, that exceeds 16 KiB, or that is not an object is rejected before looking at the key, as in Lesson 5: there is no possible fingerprint of something that could not be read. And it goes **before** `validar`, the destination check, and the name lookup, because the key has to be reserved before the work that could be duplicated begins. If any of those three things fails, the registration calls `soltar`. If everything goes well, the registration builds the response, records it, and sends it.

So that the "in progress" `409` can be seen, the registration waits a simulated 500 ms before storing (`GUARDAR_MS`). In a real API that wait is the database, another API, or a queue: the time during which the key is reserved and the response does not yet exist.

#### 6.6.4 The same key, three outcomes

With the three programs freshly started, send the same registration twice with the same key:

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

Two identical responses, byte for byte: the same `201`, the same `Location: /servicios/7`, the same `ETag`. The second `POST` created nothing: the `revisor`'s terminal says so, `idempotencia: la llave alta-avisos-1 ya se atendió; repito su respuesta`. The client that retries receives what it would have received the first time, and does not have to interpret any `409`.

Now the same key with a different body, another name:

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

`422`, `llave-reutilizada`. The `revisor` neither repeats `avisos`'s response (that would make the client believe `correo` was created) nor creates `correo` (the key already had an owner). It answers that the client misused the key, and the draft asks the client to correct before retrying: a new key for a new operation.

And two requests with the same key almost at the same time. The first is sent in the background and the second 100 ms later, while the first is still within the 500 ms of storing:

```text
$ ( curl -o /dev/null -w 'primera: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}' & sleep 0.1; curl -w '\nsegunda: %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-correo-1' -d '{"nombre":"correo","url":"http://127.0.0.1:18081/codigo/200"}'; wait )
{"type":"https://revisor.example/problemas/llave-en-curso","title":"Esa Idempotency-Key sigue en curso","status":409,"detail":"la petición original con la llave alta-correo-1 todavía no termina","instance":"/servicios"}

segunda: 409
primera: 201
```

The second received `409` `llave-en-curso` and finished first; the first finished afterwards with `201`. If the `revisor` did not reserve the key at the start, the second would not receive `llave-en-curso`: it would wait its 500 ms, find the `correo` that the first had just created, and answer `409 nombre-repetido`. (This was measured: two registrations without a key and with the same name, the second 100 ms later, gave `201` and `409`, and a single `correo` remained; in the `revisor`, looking up the name and creating the service happen together, with no `await` in between.) It is the doubt from the opening scene: a `409` that does not say whether the service is yours. And in a `POST` without a unique field, like requesting a check, both would have created something. Reserving the key with no `await` in between (`tomarTurno`) turns that doubt into a clear answer: "your original request is still in progress". A client that receives this `409` has nothing to correct: it waits a little and repeats, and it will receive the recorded `201`. `alta-segura.ts` does that (6.5.4).

#### 6.6.5 The client that retries with the same key

Now the scene with a key. In the same series:

```text
$ node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200; echo "(código de salida: $?)"
intento 1: 502 {"type":"about:blank","title":"Bad Gateway","status":502,"detail":"la pasarela no recibió una respuesta completa del revisor"}
  espero entre 0 y 500 ms y reintento con la misma llave
intento 2: 201 {"id":9,"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
(código de salida: 0)
```

The first attempt received `502`: the `revisor` created `agenda` (id 9) and the gateway threw away the response. The second attempt carried the same key, the `revisor` recognized it and repeated its `201` with the body of `agenda`. This time the gateway let it through because it had already seen that key. **The client received the response that had been lost**, and did not have to guess anything.

The team's list and the two terminals confirm that nothing was duplicated:

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

One service per name: `avisos` (7), `correo` (8), `agenda` (9), and `nomina2` (10, the one from section 6.5.2, which was run in this same series). In the `revisor`'s terminal there are two idempotency lines: that of `alta-avisos-1` and that of the key `alta-segura.ts` made up. In the gateway's, two lost responses, that of `agenda` and that of `nomina2`, both of a `201`. The write happened in both cases; the difference is that with a key the client found out.

### 6.7 The key's limits

So far, the key seems magical. It is not, and promising "repeat without duplicating anything" without saying where the promise ends is a way of lying. These are its borders, each with a run. All of them are from a new series, with the three programs freshly started.

#### 6.7.1 How long it lasts

In the `revisor`, a key lasts **as long as the process lasts**: the record lives in an in-memory `Map`, without expiry, and is lost on restart. It is the minimum for teaching, and it has two problems in a real API: memory grows with every registration, and a restart forgets all the keys (you see it at the end of this section).

The draft leaves the duration to each API, with one condition: that it publish it (section 2.3). Stripe, for example, documents that it may delete keys once they are at least 24 hours old, and that if a key is reused after being deleted, the request is treated as new. That is the border to understand: **after the key expires, the retry is no longer protected**. If your client retries for hours (a queue that gets stuck, a job that resumes the next day), it has to retry within the validity period, or accept that it may duplicate. Exercise 3 asks you to add a validity period to `idempotencia.ts` and see what happens when it expires.

#### 6.7.2 What happens if the body changes

"The same body" depends on how the fingerprint is computed. The `revisor` computes it over the JSON **already read**, with `JSON.stringify(datos)`. That has consequences worth seeing:

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

The first `POST` creates `avisos`. The second carries the same data with spaces all over, and the `revisor` repeats the `201`: the spaces are lost when the JSON is read, so the fingerprint is the same. The third carries the same two fields **in another order**, and the `revisor` answers `422`: `JSON.stringify` respects the order in which the fields arrived, so for the fingerprint it is a different body. And the fourth adds `"limite_ms":2000`, which is exactly the default value: the resulting service would be identical, and even so it is `422`.

Is it wrong? It is a decision, and the conservative one. The draft accepts several forms of fingerprint (2.4), and all of them have the same dilemma: a strict fingerprint rejects requests that "mean" the same thing, and a lax fingerprint accepts requests that are not the same. The `revisor` prefers to reject: a `422` tells the client that something changed, and the client can fix it; accepting a different body as if it were the same hides the error (it is the second defect in "The error you will see"). The consequence for the client is simple: **a retry sends the same bytes as the original**, not "an equivalent body". `alta-segura.ts` complies because it builds the body once per attempt with the same data and in the same order.

#### 6.7.3 What happens if the registration fails

```text
$ curl -w ' [%{http_code}]\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"ftp://agenda"}'
{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}
 [422]

$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/8
```

The first `POST` with `alta-agenda-1` carries an `ftp` address and receives `422` `datos-invalidos`. The second, with the same key and the corrected address, creates the service. If the `revisor` had recorded the `422`, the corrected retry would have received the `422` again (or a `422` for a reused key, because the body changed): the client could not have fixed its mistake without making up another key.

Here the `revisor` departs on purpose from the letter of the draft. Section 2.6 says that, if the request is retried when the original has already finished, the result of the earlier operation is answered, "success or an error". The `revisor` **records only the successes**, and releases the key when the registration fails without creating anything: impossible data, forbidden destination, or repeated name. The reason is that those errors have no effect to protect; there is nothing to duplicate. Stripe goes further than the `revisor` in the other direction: in its v1 API it stores the code and body of the first request as soon as the endpoint begins executing, including `500` errors, and leaves out only two cases: when the parameters fail validation and when the request collides with another one that is running; those two can be retried. The match with the `revisor` is in those two cases; the difference is that the `revisor` also does not record the errors that happen afterwards, and it can release the key because its three errors happen before anything is created. If your API has operations that fail *halfway* (it charged, but did not save the receipt), this policy is no longer enough: you have to record the error, or better, finish the pending work.

#### 6.7.4 What the key does not cover

**The recorded response is not the current state.** In the same series, withdraw service 7 and repeat the original `avisos` registration with its key:

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

The `revisor` faithfully repeated its `201` with `Location: /servicios/7`, and `/servicios/7` answers `410`. It is not an error: the key promises the same *response*, not that the resource is still there. A client that retries and receives the recorded response knows that its operation happened once; what happened afterwards to the resource is another question, and it is answered by reading it.

**The key belongs to whoever sends it.** `escritura-b` uses the same key `alta-agenda-1` with the same body:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-b' -H 'Content-Type: application/json' -H 'Idempotency-Key: alta-agenda-1' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
201 /servicios/9
```

`201`, a new service, number 9, of team b. To the `revisor` it is not the same key, because the record goes by credential (`${credencial}:${llave}`). It is what the draft's security section asks for, and box 6.7.5 explains it.

**The exact text of the key.** The same key in quotes, as the draft writes it:

```text
$ curl -o /dev/null -w '%{http_code} %header{location}\n' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'Idempotency-Key: "alta-agenda-1"' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200"}'
409 
```

To the `revisor`, `"alta-agenda-1"` with quotes is another key, so the registration was processed as new and was stopped by the repeated-name net (`409`, without `Location`). A client that followed the draft to the letter and a server that does not strip the quotes do not understand each other; that is why the draft asks to publish the key's format and validate it.

**A restart.** The `revisor` is stopped and started again, and the registration of `agenda` is repeated with the key that had already worked:

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

`201` with id 7: a freshly started `revisor` remembers neither the key nor the service. In this course it does no harm, because everything was lost together; in a real API that stores services in a database and keys in memory, the restart would forget the keys and keep the services, and the retry would duplicate. **Keys are stored where what they protect is stored**, and if possible, in the same transaction.

And there are two borders that need no run. The key **only protects what the `revisor` does**: if the registration sent a welcome email or called another API, the `revisor`'s key does not prevent that email or that call from being repeated, unless those are protected too. And the key **exists only on `POST /servicios`**. Requesting a check, `POST /servicios/{id}/revisiones`, has no key in this course: two requests create two checks, as you saw in 6.2.2. `PUT` and `DELETE` do not need it, because they are already idempotent; Stripe says the same of its `GET` and `DELETE`: sending a key there has no effect.

#### 6.7.5 Security box: the key belongs to whoever sends it

A table of keys is, in practice, a cache of responses: whoever presents the key receives the recorded response. If the `revisor` looked up the key alone, without the credential, anyone who guessed another team's key would receive that team's `201`, with the id, the name, and the address of the service. The draft warns about it in its security section: an implementation that accepts low-entropy keys lets an attacker guess other clients' keys and read their stored responses. And it proposes two defenses. The `revisor` has the first: a compound key, which combines the client's key with something that only the server knows about the client (here, the credential it authenticated with). The second, a fixed, published format for the key that is validated before anything is processed, it has only halfway: it merely requires that it not be empty. A real API would require a UUID.

Two more things. The readable keys in this lesson's requests, such as `alta-avisos-1`, are so that you can read the runs: a real client uses a random UUID, like `alta-segura.ts`. And the key must not contain personal data: Stripe's documentation asks not to use emails or people's identifiers, because the key ends up in logs. In the `revisor` as well: the terminal records the key (`idempotencia: la llave … ya se atendió`), never the credential.

### 6.8 The complete `revisor`

#### 6.8.1 The files that change

If you have Lesson 5's folder, copy it as `~/curso-http/fig06_01/`. You have already seen `idempotencia.ts` (6.6.3), `pasarela.ts` (6.5.1), and `alta-segura.ts` (6.5.2) in full. These are the other four that change.

`problemas.ts`: two new types in the catalog, `llave-en-curso` and `llave-reutilizada`.

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

`cliente.ts`: `clasificar` comes out of `revisar` so that `revisarConReintentos` can use it with the last query, and at the end come the backoff with *jitter* and the retries.

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

`servicios.ts`: the registration reads `Idempotency-Key`, reserves the key, releases it if it fails, and records the response if it goes well; the checks use `revisarConReintentos`.

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

`respuestas.ts`: the `413` no longer loses the race against a client that keeps sending. In the earlier lessons, when the body exceeded the limit the `revisor` answered `413` with `Connection: close` and Node destroyed the connection as soon as it finished responding. If the client was still sending, whatever reached an already closed connection was answered with an operating-system `RST`, and that `RST` can erase the `413` before the client reads it ([RFC 9112, section 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6)). The client saw `EPIPE` or `ECONNRESET` instead of a `413`. The same section advises closing in stages: respond, close only the write side (half-closed), keep reading for a while, and only then close completely. That is what `cerrarConCalma` does: Node, when it finishes a response with `Connection: close`, calls `socket.destroySoon()`, which closes and destroys; on that connection that method is replaced with one that only closes the write side (`socket.end()`), reading continues and what arrives is discarded (`peticion.resume()`), and a 2-second timer destroys the connection if the client does not close it first. The `413` goes out immediately, without waiting for the client to finish sending.

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

It was measured in isolation, against a freshly started `revisor`, with 400 consecutive requests of 20,000 bytes sent in chunks (20 chunks of 1,000 bytes, with Node's `fetch`): without the staged close, 380 gave `413` and 20 failed (17 with `EPIPE` and 3 with `ECONNRESET`); with it, 400 of 400. With large bodies, of 3 MiB and 20 MiB sent in chunks, 100 of 100 gave `413`. With a `Content-Length` of 20,000 bytes and with `curl -T -` they gave 400 of 400 in all versions: the race existed, but it shows up mainly when the client sends in chunks. A client that does not close its side does not hold the connection: the `revisor` destroys it after 2 seconds (the connection goes through `FIN_WAIT_2` and at 3.5 s it no longer exists). The complete file is in 6.8.2.

#### 6.8.2 The files that do not change

The other files are Lesson 5's, without a single change, except for two that are included here in full: `respuestas.ts`, which changed in how the body is read (6.8.1), and `laboratorio.ts`, whose bench no longer sends a body on a `205` (a `205` response carries no content, RFC 9110, section 15.3.6; it goes out with `Content-Length: 0` and without `Transfer-Encoding`, because the `205` does not frame itself, RFC 9112, section 6.3). No run in this lesson requests a `205`. They are included in full so that the `revisor` can be assembled from this lesson:

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

#### 6.8.3 The complete run

With the three programs freshly started in `~/curso-http/fig06_01/`, these are the lesson's requests in order, all together: the same key twice, the same key with another body, both at once, the client with and without a key through the gateway, the list, and a check of `pagos`:

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

The `pagos` check is the same as in Lesson 4, and now with a reason: it went through `revisarConReintentos`, the service asked for 120 s, and since that exceeds the 5 s cap, the `revisor` did not insist and kept the notice in the detail.

#### 6.8.4 Everything else keeps working

The SSRF rejections, the conditional requests, the lost update with two simultaneous `PUT`s, the order of the `PUT`, the credential scheme, the method named after an `Object.prototype` property, the body limit, the body that is not an object, the SSRF ranges, the live-query limit per credential, the `502` of a service that cuts the connection, the strict reading of `Retry-After`, and the tag after restarting: none of that changed. This is the same run, below. Near the end the `revisor` is shut down and then the gateway (`$REV` and `$PAS` are the PIDs saved by the script that started the programs; you would stop them with `Ctrl+C`). `esperar_puerto` is a function from that script: it waits up to 10 s for the port to accept connections, instead of sleeping a fixed time after starting a program, to repeat the cases of 6.5.3 (the gateway that answers `502` and `alta-segura.ts` with exhausted attempts, with and without a gateway); both are started again, and between the second-to-last and the last request the `revisor` is restarted once more:

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

And the two terminals of the complete run. The `revisor`'s records the method and route of each request, the two idempotency lines, and the two startups that follow the first (one for each restart, which you see as a second and a third "revisor en…"); the gateway's, the two responses it lost, the five "el revisor no respondió" (the `curl` and the four attempts of `sin-revisor`), and its second startup:

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

### 6.9 Checking it with a program

As in Lesson 5, what can be checked by hand is checked with a program. `fig06_03.ts` runs five tests against the registration, each with new names and keys, so that it can be run as many times as you like without restarting the `revisor`: the same key twice leaves a single service; the same key with another body gives `422` `llave-reutilizada` and creates nothing; the same key while the original is still in progress gives `409` `llave-en-curso`; a registration that fails releases the key; and two different keys with the same body collide on the name. That last one does not test the key, it tests its border: the key does not turn two intentions into one.

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

Five out of five, and the program exits with code 0 (or 1 if anything fails), so it can be used in a script. It is another piece of Lesson 8's matrix, which checks the same thing together with the 23 codes.

### 6.10 Checking the types with `tsc` (optional)

From the `revisor`'s folder, with the command from section 0.9 of Lesson 0 plus `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

It prints nothing: there are no errors. `fig06_02.ts`, `fig06_03.ts`, and `fig06_04.ts` pass the same command from the folder above, and so do the two broken versions of the next section and the solution to exercise 3, each placed over a copy of the `revisor`.

## The error you will see

### The key that changes on every attempt

The most common error with `Idempotency-Key` is generating the key in the wrong place: inside the retry loop, next to the request, instead of outside, next to the intention. It looks natural, because "each request carries its key". To trigger it, copy `fig06_01/` as `rota/` and make `rota/alta-segura.ts` make up the key again on every turn of the `for` (the full version is in `defectos/llave-por-intento/alta-segura.ts`). The key goes from `const` to `let`, and is reassigned at the start of each attempt:

```ts
// DEFECTO A PROPÓSITO (lección 6): la llave se vuelve a inventar en cada intento, no una por intención.
let llave = opcion === "--sin-llave" ? undefined : randomUUID();
```

```ts
for (let intento = 1; intento <= INTENTOS && !terminado; intento++) {
  llave = opcion === "--sin-llave" ? undefined : randomUUID();
  const resultado = await intentar();
```

Start the lab, the `revisor`, and the gateway from `rota/` and register `agenda`:

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

Four `502`s and the client gives up, convinced that it failed. The list says otherwise: `agenda` exists, with id 7. And the terminals tell the story: the `revisor` received four registrations; the first created `agenda` and the other three collided on the name (`409`); the gateway threw away all four responses. Why all four, if the gateway only loses the first response of each request? Because it recognizes "the same request" by its key, and each attempt carried a new one: to it they were four different requests, each on its first time. To the `revisor` too: no key was repeated, so there was never anything to repeat. **One key per attempt is the same as having no key**, with an aggravating factor: the code looks protected.

Notice also what the program says about itself. Each wait announces "reintento con la misma llave", and that is false: the text was built at the start, when there was still a single key. And the last line, "repetir más tarde con la llave … es seguro", names the key of the fourth attempt, which is not the one that created `agenda` (that was the first's, and the `revisor` never saw it again). Whoever follows that advice is protected against nothing. With one key per attempt, the correct version's true messages turn into lies that nobody notices, because the output looks careful: a program's output is only as trustworthy as the logic that produces it, and here the code and the text contradict each other.

Here the name net saved the `revisor` from the duplicate. A `POST` without a unique field, like requesting a check, would have created four. Stop the `rota/` programs when you finish.

### The fingerprint nobody compares

The second error is on the server side: storing the key and forgetting the fingerprint. It is tempting, because "if the key is unique, the body has to be the same". Copy `fig06_01/` again as `rota2/` and delete from `rota2/idempotencia.ts` the fingerprint comparison (the full version is in `defectos/sin-huella/idempotencia.ts`):

```ts
  // DEFECTO A PROPÓSITO (lección 6): no se compara la huella; cualquier cuerpo con esa llave «es el mismo».
```

Start the three from `rota2/` and send the two registrations of 6.6.4, that of `avisos` and that of `correo` with the same key:

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

The registration of `correo` received `201 Created` with the body of `avisos`. A client that only looks at the code believes `correo` exists, and the list says it does not. It is worse than an error, because it is not seen: the failure shows up days later, when someone looks for `correo` on the dashboard. The checker finds it:

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

Four out of five: the only test that fails is the one that sends another body with the same key. The fix is the one in `fig06_01/`: compare the fingerprint and answer `422` when it does not match. Stop the `rota2/` programs when you finish.

## Common mistakes

**Retrying everything.** A `400`, a `401`, a `404`, or a `422` does not improve with time: repeating them only wastes effort. The two questions in 6.3.1 come before any retry.

**Retrying without waiting, or always waiting the same.** Without a wait, the retry arrives while the server is still down. With a fixed wait and no randomness, all the clients arrive together. Use exponential backoff with *jitter*, with a cap and a maximum number of attempts.

**Closing abruptly after the `413`.** If the server closes the connection while the client is still sending, the `RST` can erase the `413` and the client sees a network error instead of the response. Close in stages: respond, close the write side, keep reading for a while, and then close completely (RFC 9112, section 9.6).

**Waiting without a limit.** A `fetch` with no maximum time leaves a client hanging for minutes with a server that accepts the connection and does not answer. Each attempt carries a limit and, if it is cut off, it is treated as "no response".

**Exiting with success when there was none.** A program that finishes with `0` after a `422` or a `409` tells its caller that the registration was done. `0` is only for a registration that was done.

**Waiting after the last attempt.** The time is spent for nothing, and the client takes longer to find out that it failed. And finishing without saying that the attempts ran out (or finishing with success) leaves the script that calls it not knowing what remains pending: when they run out, a message and a non-zero exit code.

**Retrying in every layer.** If the browser, the gateway, the service, and the database library each retry three times, a failure is multiplied by dozens. Retry in a single place.

**Ignoring `Retry-After`, or taking it as a suggestion.** If the server asks for 120 s and the client retries after 2, the next `429` is deserved. If the wait it asks for is longer than the client can wait, the honest thing is not to retry and to say so, as the `revisor` does.

**Retrying a `POST` without a key.** It is the opening scene. If the server offers no key, the client reconciles (rereads the state) before repeating.

**Generating the key on every attempt.** It is "The key that changes on every attempt": the code looks protected and is not.

**Storing the key without the fingerprint.** It is "The fingerprint nobody compares": a different body receives a success that is not its own.

**Storing the key without the credential.** The table of keys becomes a cache that anyone can read by guessing keys (6.7.5).

**Promising "no duplicates" without saying until when.** A key expires, is lost in a restart if it lives somewhere other than what it protects, does not cover external effects, and does not cover other routes. If your API's documentation does not say that, your clients will assume the key protects more than it does.

**Presenting `Idempotency-Key` as a standard.** It is an expired draft. Use it, and write it in your documentation as what it is.

## Exercises

All four correct themselves: each ends with a run that tells you whether you got it right. Write your prediction in the [log](bitacora.md) **before** running anything. For 1 and 4 you need the lab, the `revisor`, and the gateway from 6.8 freshly started.

### Exercise 1 — Can it be repeated?

For each of these six operations, predict whether it is idempotent and what it answers the second time. Then run each one **twice**, and compare the state with what you expected:

1. `GET /servicios/1`
2. `PUT /servicios/1` with `If-Match: *` and `{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}`
3. `PUT /mantenimiento` with `admin` and `{"activo":false}`
4. `POST /servicios/1/revisiones`
5. `DELETE /servicios/1`
6. `POST /servicios` with `Idempotency-Key: ejercicio-1` and `{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}`

Hint: for each one, print the code and, if it applies, the `ETag` or the `Location` with `curl -o /dev/null -w '%{http_code} %header{etag}\n'`.

### Exercise 2 — The waits of `alta-segura.ts`

Without running anything, answer: if the four attempts of `alta-segura.ts` receive `502`, how many times does it wait? What is the ceiling of each wait? How long can it take, at most, to give up (not counting what the requests take)? What does it print at the end and with what code does it exit? Also predict what changes if the registration goes with `--sin-llave`. Then compare with the runs in 6.5.3. Finally, say in one sentence why `if (intento === INTENTOS) break;` goes **before** the wait and not after. To close, predict the exit code and the number of requests that `fig06_04.ts` sees with each of these three responses, and check with 6.5.4: `422`, `503:1 201`, and `409:en-curso 201`.

### Exercise 3 — The key that expires

Copy `fig06_01/` as `ej3/` and add a validity period to `ej3/idempotencia.ts`: store in each record when the key was reserved, and if more than `VIGENCIA_MS` milliseconds have passed, treat the key as new. Use 5,000 ms by default, so you can watch it expire, and let it be changed at startup with the environment variable `REVISOR_VIGENCIA_MS`.

To find out whether you got it right, start the three programs from `ej3/` and run two experiments. First, send the registration of `avisos` with `Idempotency-Key: vence-1` twice in a row, wait six seconds, and send it a third time: predict the code of each one. Then register `agenda` with `Idempotency-Key: vence-2`, withdraw it, wait six seconds, and repeat the registration with the same key: predict the code and the id.

### Exercise 4 — How many times does it call?

Register three lab services, `e-504` (`/codigo/504`), `e-cortar` (`/cortar`), and `e-500` (`/codigo/500`), and request a check of each with `escritura-a`, plus one of `reportes` (service 5, `/lento/3000` with a limit of 1,000 ms) with `admin`. Before looking at the lab's terminal, predict how many times each route appears and what `detalle` each check has. Wait eight seconds before requesting the results: why so long?

## Solutions

### Solution 1

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

1. **`GET`**: safe and idempotent. `200` both times, the same `ETag`: nothing changed.
2. **`PUT` with `*`**: idempotent. `200` both times, and the content stays the same (`"limite_ms":1500`), but the `ETag` went from `"1-2-…"` to `"1-3-…"`: the `revisor` raises the version on every write. It is what 6.2.3 says: the requested effect is the same, and the server may keep its own history.
3. **`PUT /mantenimiento`**: idempotent. `204` both times; the mode stays disabled.
4. **Check `POST`**: **not** idempotent. Two checks, `/revisiones/1` and `/revisiones/2`.
5. **`DELETE`**: idempotent. `204` and `410`; the service is withdrawn in both cases.
6. **`POST` with a key**: the method is not idempotent, but the key makes repeating this request have the same effect as making it once, as long as the key remains valid. `201` both times, the same `Location`.

If you got number 2 wrong, it is the most common trap: an identical response proves nothing, and a different `ETag` does not break idempotency.

### Solution 2

It waits **three times**, not four: between one attempt and the next there are three gaps, and after the fourth there is nothing left to wait for. The ceilings are `250 × 2^n` capped at 2,000, for `n` equal to 1, 2, and 3: 500, 1,000, and 2,000 ms. At most, it takes 3.5 seconds to give up, adding up the ceilings; with the 2,000 ms per-request limit, 11.5 seconds in total.

At the end it prints "se agotaron los 4 intentos sin una respuesta definitiva" and exits with code `1`. With a key it adds "repetir más tarde con la llave … es seguro"; with `--sin-llave`, instead, "no se sabe si el alta ocurrió", because without a key there is no retry that can be offered as safe. And the waits change their text, from "con la misma llave" to "sin llave (podría duplicar)", but not their duration: the *jitter* does not depend on the key. Both outputs are in `agotados.salida.txt`, which is the one 6.5.3 shows.

The line goes before the wait because whoever decides whether to sleep has to know whether there is anything to wake up for. If it came after, the program would sleep up to 2,000 ms more just to discover that there are no attempts left, and a script with fourteen failed registrations would lose up to 28 seconds that way. `revisarConReintentos` solves the same thing another way: its wait is inside the body of the `for`, before the next query, and that body does not run when `intento < INTENTOS` stops holding.

The three final responses, with the mock server: a `422` is a `4xx` that repeating does not fix, so **one** request and code `1`. `503:1 201` asks to wait one second (less than the 5 s cap): **two** requests, the second one second later, and code `0`. `409:en-curso 201` is a `409` that is retried, with a drawn wait: **two** requests and code `0`. If you answered that the `422` is retried or that `409:en-curso` is final, review the table in 6.3.2 and the `409`'s `type`.

### Solution 3

The full version is in `ejercicios/ej3/idempotencia.ts`:

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

The essentials are two lines: the record stores `desde: Date.now()`, and `tomarTurno` treats as new a key whose record is older than `VIGENCIA_MS`. The run:

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

First experiment: `201`, a repeated `201` (within the validity period) and, six seconds later, `409` `nombre-repetido`. The key expired, the `revisor` handled the registration as new, and the unique-name rule stopped it. Without that rule, it would have created another `avisos`.

Second experiment: `201` with id 8, the withdrawal and, six seconds later, `201` with id **9**. The key had expired and the name was already free, so the retry created a new service. It is exactly the border of 6.7.1: **once the validity period has passed, a retry is no longer protected**. Within the five seconds, the same request would have received the recorded `201` of id 8. If your API publishes a 24-hour validity, your clients have to know that a retry the next day may duplicate.

### Solution 4

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

`/codigo/504` appears three times: a `504` can improve on its own and carries no `Retry-After`. `/cortar` appears three times: the lab closes the connection without answering, the query ends as `respuesta-invalida`, and that is also retried (the one querying has no proof that the service is broken forever). `/codigo/500` appears **once**: the `revisor` does not retry a `500`. And `/lento/3000` appears three times: each attempt times out at 1,000 ms.

The details are those of the last attempt: `504`, `respuesta inválida`, `500`, and `tiempo agotado`. The eight seconds are because of `reportes`: three attempts of up to 1,000 ms each plus two waits of up to 500 and 1,000 ms, plus the second that each check waits in the queue, come to up to five and a half seconds. With four, the result for `reportes` could still be `pendiente`.

## How I know I succeeded

- [ ] You say from memory which methods are safe and which idempotent according to RFC 9110, and why `POST` and `PATCH` are not.
- [ ] A repeated `DELETE` gives `204` and then `410`, and you explain why it is still idempotent; a repeated `PUT` with the same `If-Match` gives `200` and then `412`, and when you reread you find your change.
- [ ] `node fig06_02.ts` shows the thousand retries in a single window without *jitter* and spread over five with *jitter*.
- [ ] A check of a service that answers `502` calls the lab three times; one of `pagos` (`503` with `Retry-After: 120`) and one of a `404` call it only once.
- [ ] Two `POST /servicios` with the same `Idempotency-Key` give the same `201` and the same `Location`, and the list has a single service; with another body they give `422` `llave-reutilizada`; at the same time, `409` `llave-en-curso`.
- [ ] `node alta-segura.ts agenda http://127.0.0.1:18081/codigo/200` gives `502` and then `201`; with `--sin-llave`, `502` and then `409` with `existente`.
- [ ] With a `422`, `alta-segura.ts` makes a single request and exits with `1`; with `503:2 201` on the mock server it waits 2 s and exits with `0`; with `409:en-curso 201` it retries and exits with `0`, and with `mudo` and `ALTA_LIMITE_MS=300` it cuts off four attempts by timeout and exits with `1`.
- [ ] With the `revisor` shut down, the gateway answers `502` and keeps listening; `alta-segura.ts` waits three times (up to 500, 1,000, and 2,000 ms), says "se agotaron los 4 intentos", and exits with code `1`; without a gateway, its four attempts say `sin respuesta (ECONNREFUSED)` and there is no Node stack trace.
- [ ] You explain, with a run for each, how long a key lasts in the `revisor`, why fields in another order give `422`, and why the recorded response can point to a withdrawn service.
- [ ] You say that `Idempotency-Key` is an expired IETF draft and not a standard, and what an API that uses it has to publish.
- [ ] `node fig06_03.ts` gives `5 de 5`, and against `defectos/sin-huella/` it gives `4 de 5`.
- [ ] When you finish, no program is left listening: `curl -i http://127.0.0.1:18080/`, `curl -i http://127.0.0.1:18081/`, and `curl -i http://127.0.0.1:18082/` give error 7.

## Summary

Answer without looking at the lesson:

1. What is a safe method and what is an idempotent one? Which are they, according to RFC 9110?
2. What does idempotency promise and what does it not promise? Give an example of each with the `revisor`.
3. What are the two questions before retrying? Why does the `revisor` not retry a `500`?
4. What is the ceiling of the wait for attempt `n` with a base of 250 ms and a cap of 2,000? What does full *jitter* add and why?
5. What does the `revisor` do when a service answers `Retry-After: 120`? Why does it not wait 5 s and retry?
6. What does a `502` mean for whoever made a `POST`? What can they do without a key and what with one?
7. What state is `Idempotency-Key` in at the IETF? Which codes does the draft propose and for which case each?
8. Why is the key created once per intention and not once per attempt?
9. Name four things that the `revisor`'s key does not cover.
10. If the four attempts of `alta-segura.ts` fail, how many waits does it make, what does it say at the end, and with what code does it exit? Why does it not wait after the last attempt?
11. When does `alta-segura.ts` exit with `0`? What does it do with a `Retry-After` of 2 s and with one of 120 s? What distinguishes the `409` it retries from the one it does not?

## Sources

All consulted on October 21, 2026.

1. [RFC 9110, *HTTP Semantics*, section 9.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1) (June 2022, internet standard): safe methods, the access-log example, and the responsibility of whoever designs the URI.
2. [RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): idempotent methods, automatic repetition after a communication failure, "though the response might differ", the client that must not retry non-idempotent methods, the proxy that must not do so, and the retry of a retry.
3. [RFC 9110, sections 9.3.3, 9.3.4, and 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3): `POST`, `PUT`, and `DELETE`.
4. [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3): `Retry-After`, its two forms, and its meaning with a `503`.
5. [RFC 9110, sections 15.6.3, 15.6.4, and 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3): `502`, `503`, and `504`.
6. [RFC 6585, *Additional HTTP Status Codes*, section 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4): the `429` and its `Retry-After`.
7. [RFC 5789, *PATCH Method for HTTP*, section 2](https://www.rfc-editor.org/rfc/rfc5789.html#section-2): `PATCH` is neither safe nor idempotent.
8. [*The Idempotency-Key HTTP Header Field*, draft-ietf-httpapi-idempotency-key-header-07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07) (J. Jena and S. Dalal, October 15, 2025, IETF draft, expired April 18, 2026): syntax (2.1), uniqueness (2.2), validity (2.3), fingerprint (2.4), responsibilities (2.5), what to do (2.6), the `400`, `409`, and `422` errors (2.7), implementations (4), and security (5).
9. [IETF Datatracker, the draft's page](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/): status "Expired Internet-Draft", working group `httpapi`, revision 07.
10. [RFC 9651, *Structured Field Values for HTTP*, section 3.3.3](https://www.rfc-editor.org/rfc/rfc9651.html#section-3.3.3) (September 2024, replaces RFC 8941, which the draft cites): *Strings*, delimited with double quotes.
11. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html) (May 2024, replaces RFC 4122, which the draft cites): the format the draft recommends for the key.
12. [Marc Brooker, *Exponential Backoff And Jitter*, AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) (March 4, 2015): full, "equal", and "decorrelated" *jitter*, compared.
13. [*Timeouts, retries, and backoff with jitter*, Amazon Builders' Library](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) (Marc Brooker, 2019): retries as "selfish", the 243-fold amplification with five layers, retrying in a single place, the token bucket to limit retries, and idempotency with client tokens.
14. [Google, *Site Reliability Engineering*, "Addressing Cascading Failures"](https://sre.google/sre-book/addressing-cascading-failures/): randomized exponential backoff, a per-request retry limit, a retry budget, and the example of 64 attempts with three layers.
15. [Stripe, *Idempotent requests*](https://docs.stripe.com/api/idempotent_requests): an API that operates the pattern at scale: keys of up to 255 characters, UUID v4 recommended, no personal data, deletion after 24 hours, parameter comparison, and results that are not stored when validation fails.
16. [Node.js, *Command-line API*, `--unhandled-rejections=mode`](https://nodejs.org/docs/latest-v24.x/api/cli.html): in version 24, the default mode is `throw`: a rejected promise that nobody catches is raised as an uncaught exception and the process ends; it is what would happen to a gateway that does not catch its `fetch` failure (6.5.1).
17. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static): returns a signal that aborts on its own when the time elapses; the error is a `TimeoutError`. It is `alta-segura.ts`'s per-attempt limit (6.5.2).
18. [RFC 9112, *HTTP/1.1*, section 9.6](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6): the staged close (half-closed, keep reading, close completely) and the `RST` that can erase the last response; it is what `cerrarConCalma` does in `respuestas.ts`.

### Terms in this lesson

| | |
|---|---|
| **safe method** | one that, by its semantics, requests no change of state on the server: `GET`, `HEAD`, `OPTIONS`, `TRACE` |
| **idempotent method** | one that, repeated, has the same intended effect as a single time: the safe ones, `PUT`, and `DELETE` |
| **retry** | repeating a request that failed, decided by the client |
| **exponential backoff** | waiting double (up to a cap) before each retry |
| ***jitter* (full)** | drawing the wait between 0 and the backoff ceiling, so that clients do not retry together |
| **amplification** | the multiplication of load when several layers retry on their own |
| **idempotency key** | the identifier the client makes up once per operation so the server recognizes its retries |
| **fingerprint** | the summary of the body that the server stores with the key to know whether a retry is the same request |
| **reconcile** | rereading the server's state to know whether an uncertain operation happened |

---

**Previous:** [Lesson 5 — Problem Details (RFC 9457)](05-problem-details.md) · **Next:** [Lesson 7 — Who reads the error: the `revisor`'s client and AI agents](07-quien-lee-el-error.md)

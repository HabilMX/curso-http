# Lesson 2 — The client made a mistake (I): 400, 401, 403, 404, 405, and 415

It is 02:10 on a Tuesday and the `revisor` has been in production for three weeks, open to anyone who reaches its port. Tonight someone on the payroll team wrote a script to register their services and left it running. The script sends the data as a form and not as JSON, and the `revisor` answers `400` to every attempt, with the same line as always. The script only looks at the code, and to it a `400` is a `400`: it cannot read the sentence in the body, so it sends the same thing again. Meanwhile, in another terminal, an intern discovers that with any `DELETE` they can withdraw another team's payments service, because the `revisor` does not ask anyone who they are. And in a third one, a script nobody recognizes walks through `/servicios/1`, `/servicios/2`, `/servicios/3`… and notes which one responds something different. By 02:40 it already has the complete list of what the company monitors. Three different problems, and the API handles all of them with two codes and an entry point that does not exist.

This lesson builds that entry point: seven questions, always in the same order, and a different code for each answer.

**Time:** 90 min, or 2 × 45 (the split is between sections 2.4 and 2.5)

**What you build:** the `revisor` API's entry point: route, method, credential, permission, existence, content type, and body reading, with a different code for each failure; and a small program that tries to guess which services exist, to verify that the entry point does not let it

**What you learn:** the entry point's seven questions and why they go in this order: route → method → credential → permission → existence → format → reading; `401` versus `403`; `404` versus `405`; `415` and `413` versus `400`; `WWW-Authenticate` and `Allow`, the two headers the specification makes mandatory; and when a `404` deliberately hides a resource that does exist, with the security callout on **resource enumeration**

**Where you are coming from.** From [Lesson 1](01-exitos-redirecciones.md), with the `revisor` that registers, queries, withdraws, and checks services, and that redirects its old routes with `301` and `308`. That `revisor` already responds with two errors, a `400` and a `404`, but Lesson 1 used them as a safety net and promised to explain them here. And it has three gaps this lesson closes: it does not know who is talking to it, it does not distinguish between a route that does not exist and a method it does not support, and it accepts any body that looks like JSON, whatever type it comes with.

**What this lesson does not do.** It does not teach real authentication: the credentials are four words written in the code, and in a real API they come from an identity provider, with tokens that expire and are signed (the [README](README.md) explains why the course leaves that topic out). It does not teach the `422`: here, everything in the body that cannot be used responds `400`, and [Lesson 3](03-errores-del-cliente-estado.md) separates what cannot be read from what is read but cannot be fulfilled. And error bodies are still a line of text; [Lesson 5](05-problem-details.md) replaces them with `application/problem+json`.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS with Node 24.14.1 and curl 8.7.1, and none depends on anything specific to macOS. In your run two things will change: the date in the `Date` header and the last eight digits of each `ETag` (`"3-1-80925024"` in the lesson's run), which the `revisor` draws at random every time it starts; section 2.7.4 explains why, and when a request needs the tag, copy the one you got in the previous response. The `revisor` keeps everything in memory: to get the same as the lesson, restart it before each series of requests, because an earlier registration or withdrawal changes the responses. The programs are in [`programas/02-errores-del-cliente-peticion/`](../programas/02-errores-del-cliente-peticion), in the course repository: the `revisor` in `fig02_01/`, the enumerator in `fig02_02.ts`, the broken versions from "The error you will see" in `defectos/`, and each run in its `.salida.txt` file. All of them pass `tsc` in strict mode, with the command from section 0.9 of Lesson 0 plus the `--allowImportingTsExtensions` option, which has been needed since the `revisor` has several files that import each other with their `.ts` extension.

## By the end you will be able to

- Recite the entry point's seven questions in order and predict, for a given request, at which one it stops and what code it responds with.
- Tell a `401` from a `403`, and a `404` from a `405`, with a run, and say which header each one requires.
- Write the `WWW-Authenticate` header of a `401` and the `Allow` header of a `405`, and cite the section of RFC 9110 that makes them mandatory.
- Reject a body with the wrong type with `415` and `Accept`, and one that cannot be read with `400`.
- Show with a program that the API does not reveal which services of another team exist, and explain what change in the code would be enough for it to reveal them.
- Explain why a credentials table written as a JavaScript object can accept a credential nobody registered.

## The why before the how

A client error is a `4xx` code, and Lesson 0 gave you the question that family answers: **who made the mistake? Whoever made the request.** But "whoever made the request made a mistake" is not of much use to whoever made the request. What they need to know is **what** they did wrong, because each mistake is fixed differently:

| If the problem is… | Whoever made the request has to… | Code |
|---|---|---|
| the route does not exist | check the address | `404` |
| the route exists, but not with that method | use another method, one of those listed in `Allow` | `405` |
| they did not say who they are, or said it wrong | authenticate | `401` |
| they said who they are, but it is not theirs to do | ask someone for permission, or give up | `403` |
| the resource does not exist (for them) | stop looking for it | `404` |
| they sent the body in a format that is not accepted | change the format to the one listed in `Accept` | `415` |
| the body cannot be read | fix the body | `400` |

Each row is a different action, and it is almost always carried out by a program, not a person. The script in the opening scene kept retrying because, for a program, a `400` is a `400`: the body said "el cuerpo no es JSON", but a program does not interpret sentences, and the code was the same as for any other invalid body. With a `415` and an `Accept: application/json`, the **code** would have told it that the problem was the format and which one to use. (And the script was badly written too: no well-built client repeats unchanged a request that received a `4xx`, because that family says the one who has to change something is whoever made the request.) **A well-chosen code tells the client what to do**, which is the course's second principle, and [Lesson 7](07-quien-lee-el-error.md) turns this table into the program that decides.

The table has another property, less visible and more important: **it is in order**. Asking "who are you?" first and then "does it exist?" is not the same as the reverse. If the `revisor` tells a stranger "that service does not exist" before asking who they are, it has already told them something. If it tells them "that service belongs to another team", it has told them it exists. The order of the questions decides what someone who should learn nothing learns from your API, and that is why this lesson devotes so much space to it.

The lesson has four parts:

1. **The entry point** (2.1): the seven questions and why they go in that order.
2. **The entry point's four questions** (2.2 to 2.4): route and method (`404`, `405`), credential (`401`), and permission (`403`).
3. **The handler's three** (2.5 and 2.6): existence (`404`, the one that hides) and format and reading (`415`, `400`), with the security callout.
4. **The complete `revisor`** (2.7): the files and the run of all the cases.

## The concepts

### 2.1 The entry point: seven questions in order

#### 2.1.1 The questions

Start with two requests you already know from the opening scene: one without a credential and another with a method the route does not support.

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

Two requests, two different codes: each stopped at a different question. These are the seven:

When a request reaches the `revisor`, before anything is done with it, it goes through a series of questions. Each has a yes-or-no answer, and a "no" stops the request at that point with its own code:

| # | Question | If the answer is "no" | Where it is answered |
|---|---|---|---|
| 1 | Does the route exist? | `404` | `rutas.ts` |
| 2 | Does the route support this method? | `405` + `Allow` | `rutas.ts` |
| 3 | Who are you? | `401` + `WWW-Authenticate` | `rutas.ts` |
| 4 | Are you allowed to do this? | `403` | `rutas.ts` |
| 5 | Does the resource exist, for you? | `404` | the handler, in `servicios.ts` |
| 6 | Does the body come in a format I accept? | `415` + `Accept` | the handler |
| 7 | Can I read it? | `400`, or `413` if it exceeds the size limit | the handler |

In one line: **route → method → credential → permission → existence → format → reading**. Seven questions and seven steps. The first four are answered by the entry point, in `rutas.ts`, the same for every route. The last three depend on what each route asks for, which is why the handler answers them: only a `POST` carries a body, and only a route with `{id}` points to a resource that may not exist. A request that passes all seven gets to do its work and responds with a success, of the kind you saw in Lesson 1.

Before the first question there is a step you already know: the legacy routes. `/viejo/servicios` and `/api/servicios` are redirected with `301` and `308` without asking anything else, because a redirect delivers no data: it only says where the new route is, and that is where the questions start. Lessons 3 and 4 add two more stops in that same place, before everything (the retired API version and maintenance mode), and neither changes the order of the seven.

#### 2.1.2 Why this order

The order is not arbitrary, and it is not the only possible one. It comes from three rules, which are worth keeping in mind because they are the ones you will use when you design your own entry point.

**First rule: a question cannot be answered without the previous ones.** You cannot say whether a method is supported without knowing which route you are talking about; you cannot say whether someone may do something without knowing who they are; you cannot read a body without knowing whether it is in a format you understand. That rule alone fixes a good part of the order: route before method, credential before permission, format before reading.

**Second rule: whoever has not identified themselves learns nothing about the data.** The credential goes before existence. If it were the other way around, a stranger could request `/servicios/1`, `/servicios/2`, and `/servicios/3` and know, from the difference between a `404` and whatever responds next, which ones exist. With the credential first, a stranger receives `401` on all of them, whether the service exists or not. The same goes for the body: if the `revisor` validated the body before asking for the credential, anyone could learn, through repeated `400`s, which fields the registration expects and which values it accepts, without ever having identified themselves. And on top of that the server would waste work reading bodies from someone who has no right to send them.

**Third rule: role-dependent permission goes before existence.** A reader cannot delete anything, whether it exists or not. That is why the `403` comes before the question about the resource, and the response to "a reader tries to delete service 99" is `403`, not `404`, even though 99 does not exist. That way the `403` says nothing about what exists: it depends only on the credential and the method, not on the identifier. You are going to see it with a run in section 2.4.

There remains one decision that does not come from any rule and that is worth calling by its name: **route and method go before the credential**. The `revisor` answers `404` to a route that does not exist and `405` to an unsupported method even to someone who has not said who they are. That tells a stranger which routes and which methods the API has. The `revisor` does this on purpose, because that information is already public: it is in its documentation, and in [Lesson 8](08-contrato-verificable.md) it is going to be in an OpenAPI description anyone can read. What the entry point hides is the **data**, not the shape of the API. Some APIs decide differently and respond `401` to everything that arrives without a credential, even to a route that does not exist; it is a defensible decision when the shape of the API is also secret. No specification requires one or the other: **it is a design criterion, not a rule**, and what is mandatory is to write it down and apply it the same way on every route.

#### 2.1.3 The entry point's code

The entry point lives in the `atender` function of `rutas.ts`, which in Lesson 1 was a six-line loop. Now it has the first four questions written one after another, numbered the same as in the table. The full file is in section 2.7; here is the function, to read with the table alongside:

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

It reads from top to bottom, and each block ends in a `return` if the answer is "no". The first question looks for the route by its pattern, **without looking at the method**: that is the difference from Lesson 1, where route and method were looked up together and a wrong method found nothing and fell into the `404`. Separating them is what makes it possible to answer `405`. The second question looks for the method within the route found, treating `HEAD` as `GET`, and it looks it up with `Object.hasOwn`, for a reason section 2.3.3 explains. The third and fourth use `autenticacion.ts`, which is new. And at the end, the entry point calls the handler and passes it the credential, so that the handler can answer the three questions that are its job.

Notice how the routing table is declared: each method says whether it **reads** or **writes**.

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

`lee` and `escribe` are two one-line functions that wrap the handler with that mark. The mark is what question 4 uses: a reader can use the methods that read and not those that write. It is a deliberately small permission model, with three roles, but it has the property that matters: **the permission is declared next to the route**, on the same line, and not hidden inside each handler, where it is easy to forget it in one of them.

### 2.2 Route and method: `404` and `405`

#### 2.2.1 A route that does not exist

The first question is the simplest. If nobody in the table recognizes the route, the response is `404 Not Found`. RFC 9110 defines it in [section 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): the server did not find a current representation for the target resource, **or is not willing to disclose that one exists**. Keep the second half of that sentence in mind; you are going to need it in section 2.5.

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

`/servicioss`, with an extra "s", is not in the table, and the entry point stops at question 1. Note that the request did carry a valid credential, and it did not matter: the entry point had not looked at it yet.

#### 2.2.2 A method the route does not support

The second question is the one Lesson 1's `revisor` could not answer. `/servicios/1` exists, but it only supports `GET` (to query) and `DELETE` (to withdraw). If you send it a `PATCH`:

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

`405 Method Not Allowed`. RFC 9110 defines it in [section 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6): the server knows the method, but the target resource does not support it. And in the same section it sets out the first of this lesson's two mandatory headers: the server **MUST** send in a `405` an `Allow` header with the list of methods the resource does support. [Section 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.1), which defines `Allow`, repeats it and adds that it may be sent in any other response, but in a `405` it is mandatory.

Why mandatory? Because without it the `405` does not say what to do. "Not that method" leaves the client trying methods blindly; "not that method, these yes" gives it the complete fix. `Allow: GET, HEAD, DELETE` says exactly what you can do with `/servicios/1`. The `permitidos` function in `rutas.ts` builds it from the methods in the table, and adds `HEAD` right after `GET`, because every route that supports `GET` also supports `HEAD` (Node does not send the body; you saw it in Lesson 0).

This is the mistake Lesson 1's `revisor` made on purpose: to that same `PATCH` it answered `404 no existe esa ruta`. It was a lie, and a costly one: a client that receives `404` concludes the address is wrong and starts looking for another, when the address was right and what had to change was the method.

#### 2.2.3 `405` versus `501`

There is a neighboring code worth distinguishing: `501 Not Implemented`. [Section 9.1 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1) draws the line: if the server **does not recognize or does not implement** the method anywhere, it should respond `501`; if it recognizes and implements it, but **not for this resource**, it should respond `405`. The `revisor` responds `405` to any method **that Node knows** and that the route does not support, such as `PATCH` or `PUT`. A made-up method, such as `BORRAR`, does not even reach it: Node's HTTP parser rejects it first with a `400 Bad Request` without a body (you are going to see it with `-X constructor` in section 2.3.3). According to the RFC, a `501` would apply there, but that decision is made by Node and not by the `revisor`. The `501` is not a protagonist of this course: the lab produces it at `/codigo/501` if you want to see it.

A subtlety worth checking with your own hands: the checks route, `/servicios/{id}/revisiones`, only supports `POST`. What happens if you send it a `HEAD`?

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

`405` with `Allow: POST`. `HEAD` is only supported where `GET` is supported, and this route has no `GET`. And the request carried no credential: the entry point stopped at question 2 without reaching question 3, as the order says.

### 2.3 Who are you?: `401` and `WWW-Authenticate`

#### 2.3.1 Missing credential, invalid credential

The third question needs the client to say who it is. In HTTP that is done with the `Authorization` header, and the `revisor` uses the most common scheme in APIs: **`Bearer`**, defined in [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html). The request sends `Authorization: Bearer <credential>`, and whoever has the credential (whoever "bears" it, hence the name) is who they say they are. For that very reason, in a real API a `Bearer` credential only travels encrypted, over `https`: RFC 6750, in its [section 5.3](https://www.rfc-editor.org/rfc/rfc6750.html#section-5.3), requires clients to always use TLS, because whoever reads it along the way can use it. The course uses `http` only because everything happens inside your machine, on `127.0.0.1`, and nothing goes out to the network. The course's credentials are four, written in `autenticacion.ts`:

| Credential | Team | Role |
|---|---|---|
| `lectura-a` | a | reader |
| `escritura-a` | a | writer |
| `escritura-b` | b | writer |
| `admin` | all | admin |

Without a credential:

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

With a credential that does not exist:

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

Both are `401 Unauthorized`, and both carry the lesson's second mandatory header. [Section 15.5.2 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2) defines the `401` this way: the request has not been applied because it lacks valid authentication credentials for the target resource. And in the next sentence: the server generating a `401` **MUST** send a `WWW-Authenticate` header containing at least one **challenge** applicable to the target resource. The challenge tells the client **how** to authenticate: with which scheme (`Bearer`) and in which realm (`realm="revisor"`, a name for the protected space). A `401` without `WWW-Authenticate` is like an "identify yourself" sign that does not say with what.

The difference between the two responses is in the challenge. When no credential came, the challenge is just `Bearer realm="revisor"`. When one came that does not work, it adds `error="invalid_token"`. That rule is not the `revisor`'s, it is RFC 6750's, in its [section 3.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-3.1): `invalid_token` is the code for a credential that is expired, revoked, malformed, or invalid for any other reason, and it goes with a `401`; but if the request **lacks any authentication information** (because the client did not know it was needed, or because it used **an authentication method the server does not support**), the server **SHOULD NOT** include an error code or other error information in the challenge (the `error`, `error_description`, and `error_uri` attributes). The response body is outside that rule, and the `revisor` uses it to explain in Spanish what happened. The distinction is useful to the client: "you sent nothing" is fixed by sending the credential; "you sent one that does not work" is fixed by getting another one.

That last sentence of the RFC has a case worth seeing: a client that sends its username and password with the `Basic` scheme, the one behind the little username-and-password window the browser opens (defined by [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html)). It did not send a bad `Bearer` credential: it did not send any `Bearer` at all. The `revisor` responds with the challenge **without** an error code, and says so in the body:

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

And one more detail, from [section 11.1 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1): the authentication scheme's name is **case-insensitive**. `Bearer`, `bearer`, and `BEARER` are the same scheme, and a server that only accepts the first rejects clients that comply with the specification:

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

The list already includes service 4, which was registered earlier in the same run (section 2.7 shows it in full). What is case-sensitive is the credential itself: `Bearer Lectura-a` is a credential that does not exist.

A note on the name, because it confuses everyone once: the `401` is called *Unauthorized*, but what it says is **unauthenticated**: I do not know who you are. "Unauthorized" in the sense of "I know who you are and it is not yours to do" is the `403`, the one in the next section. The name is a legacy of the first versions of HTTP and can no longer be changed; the meaning is in the specification, not in the phrase.

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

The file has four components. The credentials **table**, which would not exist in a real API: credentials are issued by an identity provider and the server verifies them, for example by checking a token's signature. The **`identificar`** function, which reads the `Authorization` header and returns one of four results: none came, one came with another scheme, an invalid `Bearer` came, or a valid one came, with its credential. First it separates the scheme name (what comes before the first space) and compares it in lowercase; if it is not `bearer`, it does not even look for the credential. The **`motivo`** function writes the sentence in the `401`'s body for each case, and the **`reto`** function builds the value of `WWW-Authenticate`: the `invalid_token` code only when a `Bearer` credential arrived that does not work. The `Identificacion` type is a union of four cases, and the entry point checks `tipo` before using `credencial`; TypeScript does not let it use it in the other three.

#### 2.3.3 Why the table is a `Map`

There is a detail in the credentials table that looks like a matter of style and is a matter of security: it is a `Map`, and it is queried with `CREDENCIALES.get(token)`. The form almost everyone thinks of first is an object, `{ "lectura-a": {…}, "admin": {…} }`, queried with `CREDENCIALES[token]`. It looks just as good, TypeScript does not complain, and the four credentials work the same. But it has a hole.

In JavaScript, an object written with braces **inherits** properties from another object, its **prototype**, `Object.prototype`. That is why every object responds to `toString`, `hasOwnProperty`, or `constructor`, even though nobody wrote them in it. And `CREDENCIALES[token]` does not distinguish what was written in the object from what it inherited: if the token is `constructor`, the lookup finds something, the `Object` function, and that something is not `undefined`. For `identificar`, which only asks whether it found something, **`Bearer constructor` would be a valid credential**. The section "The error you will see" triggers it with a run, and what the `revisor` responds in that case is not what you would expect.

`Map.get` does not have that problem: it returns only what was stored with `set` (or in the initial list), and for any other key, `undefined`. The other correct defense is a prototype-less object, created with `Object.create(null)`, queried with `Object.hasOwn(objeto, token)`, which only looks at own properties. Both close the hole; the `Map` also makes it clear, to whoever reads the code, that this is a lookup table and not an object with properties.

The case teaches something that goes beyond JavaScript: **the question "who are you?" is answered "yes" only when exactly what was being looked for was found**. Any path in the code that can return "I found something" by accident (an inherited property, a comparison that accepts an empty string, a lookup that is case-insensitive where it should not be) is a credential nobody issued. In a real API, that accident lives in the verification of a token's signature, in the comparison of a key, or in a database query, and the rule is the same.

The same care shows up in another place in the entry point. Each route's method table is also an object (`{ GET: …, DELETE: … }`), and the method is written by the client. That is why `atender` does not query it with plain `ruta.metodos[nombreMetodo]`, but with `Object.hasOwn(ruta.metodos, nombreMetodo)`, which only looks at the methods written in the table. Would a method called `constructor` get through? In practice, it does not even reach the entry point:

```text
$ curl -i -X constructor http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 400 Bad Request
Connection: close
```

Node's HTTP parser only accepts the methods it knows, and to any other it responds `400` on its own, without a body and closing the connection, before calling `atender`; that is why the `revisor`'s terminal does not log it. The entry point does not depend on that filter: a table that decides something with a value the client sends is written so that it only finds what was stored in it, even if another piece filters earlier, because the other piece may change tomorrow.

### 2.4 Are you allowed?: `403`

#### 2.4.1 A reader trying to write

With the credential verified, the fourth question is whether that credential may do what it asks. The `puede` function in `rutas.ts` settles it in one line: if the method reads, anyone may; if it writes, only a writer or an administrator.

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

`403 Forbidden`. [Section 15.5.4 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4) defines it this way: the server understood the request but refuses to fulfill it. And it adds what separates it from the `401`: if the request carried credentials, the server considers them **insufficient** to grant access, and the client **SHOULD NOT** automatically repeat the request with the same credentials; it may repeat it with different ones. The `403` requires no header, unlike the `401` and the `405`. (With OAuth tokens, RFC 6750 allows adding to the `403` a challenge with `error="insufficient_scope"` to say the token lacks permissions; the `revisor` does not use scopes and does not send it.) It can explain in the body why it refused, and the `revisor` does: `tu credencial solo puede leer; para escribir pide una con rol de escritor`.

Notice what that text does **not** say: it does not repeat the credential. It would be tempting to write "la credencial `lectura-a` solo puede leer", which sounds more precise. But in the `revisor`, a credential's name is the credential itself: `lectura-a` is at once who you are and the key to get in. Repeating it in the body means writing a secret into a response, and error responses end up in places nobody watches: a load balancer's log, an intermediary's cache, the client's error report, or the screenshot someone pastes into a chat to ask for help. In a real API the same happens with a token: the error message says what the client is missing (a writer role) and never returns what the client sent to identify itself. The client already knows it; the ones who must not are all the things in between.

The question that decides between the two codes is short, and worth knowing by heart: **would anything change if they identified themselves again?** If I do not know who you are, or what you gave me does not work, identifying yourself fixes the problem: `401`. If I know who you are and what you ask for is not yours to do, identifying yourself again with the same thing changes nothing: `403`. A client that receives `401` can request a new credential and retry; one that receives `403` must not retry with the same one, and the sensible thing is to give up or ask a person for permission.

#### 2.4.2 The `403` does not depend on the identifier

Here the third rule of the order appears. What happens if the reader tries to delete a service that does not exist?

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

`403`, the same as with service 1. The entry point answered question 4 before reaching question 5, so it does not know, nor care, whether service 99 exists. For a reader, **every** `DELETE` is a `403`, with any identifier. That is exactly what we want: this entry point's `403` speaks about the credential and the method, and reveals nothing about the data. If the order were the other way around, existence before permission, the reader would receive `403` on the services that exist and `404` on the ones that do not, and would have a complete map of what exists without having been able to delete anything. It is the same leak the security callout in section 2.5 describes for the `404`, by another path.

### 2.5 Does it exist, for you?: the `404` that hides

#### 2.5.1 Every service belongs to a team

From this lesson on, every service belongs to a team. The three initial ones already had it written in `almacen.ts`: `catalogo` and `pagos` belong to team a, `nomina` belongs to team b. Lesson 1 ignored it; now the `revisor` uses it in three places. When **listing**, each credential sees only its team's services:

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

`lectura-a` sees services 1 and 2, and does not see 3. When **registering**, the new service ends up in the team of whoever created it. And when **querying, withdrawing, or requesting a check** of a service, question 5 is not just "does it exist?", but **"does it exist for you?"**.

#### 2.5.2 The same `404` for what belongs to others and for what does not exist

What should the `revisor` respond when `lectura-a` requests service 3, which exists but belongs to team b? There are two possible responses, and both are allowed by the specification. The first is `403`: "it exists, and it is not yours". The second is `404`: "for you, it does not exist". RFC 9110 provides for both in a single paragraph of [section 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4): an origin server that wishes to **"hide"** the current existence of a forbidden target resource **MAY** instead respond with `404`. And the definition of `404`, which you saw in 2.2.1, already had it: it did not find the resource **or is not willing to disclose that one exists**.

The `revisor` chooses the second. Look at the two responses side by side, first service 3, which exists, and then 99, which does not:

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

Both are identical except for the service number, which is the one you asked for. The same code, the same headers, the same body, the same length minus one byte for the extra digit. With those two responses there is no way to know which of the two services exists. And the owner does see it:

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

The decision is in a four-line function in `servicios.ts`, which every handler uses instead of looking up the service directly:

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

`visible` returns the service only if it belongs to the credential's team (or if the credential is an administrator's, whose team is `*`), and `undefined` in any other case. For the handler, "does not exist" and "belongs to someone else" are the same `undefined`, which is why they produce the same `404`, with the same text, written in a single place: `noExiste`. **The content of the response cannot differ, because the code has no way to tell the two cases apart.** That is the safe way to write it: not two branches you try to keep identical, but a single branch. What this guarantees is that the response is identical (code, headers, and text), not the time it takes: in an in-memory store like this one the difference cannot be measured, but with a real database, looking up a record and checking whose it is can take a different amount of time than discarding one that does not exist, and someone measuring microseconds might notice. It is a side channel (*side channel*: information that leaks through something other than the content), and it is watched separately, for example by querying by identifier and team in a single lookup.

> **Security callout: the `404` that hides, and resource enumeration**
>
> **What enumeration is.** It is finding out which resources exist by trying identifiers one after another and comparing the responses. There is no need to read any data: it is enough for the API to respond **differently** to what exists and to what does not. If `/servicios/3` responds `403` and `/servicios/99` responds `404`, whoever tries from 1 to 1000 walks away with the list of services that exist, how many there are and, if the identifiers are sequential, how many are created per week. OWASP's security testing guide describes this technique in its test [WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md), and its example is exactly this one: `/account1` responds `403`, `/account2` responds `404`, and the tester concludes that the first account exists and the second does not.
>
> **Why it matters even if nothing is read.** Knowing what exists is the first step of almost any attack: with the list, one looks for the resources worth targeting, tries stolen credentials only where there is something, and discovers internal names that were not supposed to get out. And the difference does not have to be in the code: a different body ("does not exist" versus "belongs to another team"), a different length, or an extra header is enough.
>
> **The `revisor`'s defense.** What belongs to others and what does not exist respond **identically**: the same code, the same body, coming from the same function. RFC 9110 expressly allows it (section 15.5.4), and it is what APIs operating at large scale do: [GitHub's API documentation](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) explains that it responds `404` and not `403` to a private resource, so as not to confirm that it exists. And the entry point's order closes the other two paths: a stranger receives `401` on every identifier (question 3), and a reader trying to write receives `403` on every one (question 4), whether they exist or not.
>
> **What the `404` does not do.** Hiding existence is not the same as protecting the resource. What prevents team a from reading team b's service is not the `404`, it is that `visible` compares the team **on every access**. Forgetting that comparison in a handler is the number one risk in OWASP's API risk list, [API1:2023, *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization), and the defense it proposes is exactly that: check, in every function that receives an identifier from the client, that whoever is asking may do that with that record. The same guide also suggests using random, hard-to-guess identifiers instead of sequential ones; the `revisor` uses sequential ones so the course is readable, and that is why the uniform `404` is what protects it. With random identifiers, enumeration would be much more expensive, but the uniform response would still be needed.
>
> **When it is written as policy.** Hiding has a cost: the legitimate owner who uses the wrong credential receives "does not exist" and may waste a while looking for an address error. That is why the decision is written down and applied the same way across the whole API: in the `revisor`, **every resource belonging to another team responds `404`, on every route and every method**. What is not acceptable is hiding on some routes and not others; the first route that responds differently undoes what the others hide.

#### 2.5.3 Verifying it with a program

A security claim is verified by attacking, not by reading the code. This program does what someone trying to enumerate would do: it walks through identifiers 1 to 6 with a credential, records what the `revisor` responds to each one, and draws its conclusions. Save it as `~/curso-http/fig02_02.ts`:

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

The program knows nothing about the `revisor`'s internals: it sees only what anyone would see from outside. For each identifier it keeps a **fingerprint** of the response: the code and, if it is an error, the body with the requested number erased, so that "no existe el servicio 3" and "no existe el servicio 4" count as the same response. At the end it groups the identifiers by fingerprint. If what belongs to others and what does not exist receive the same response, there must be exactly two groups: yours, with data, and all the rest. A third group means something distinguishes what belongs to others from what does not exist, and the program flags it. It is the same reasoning a person would do with a spreadsheet, only in one second. Comparing the body, and not just the code, matters: a real enumerator looks at everything that changes, and a `404` with two different texts gives things away just as much as a `403` versus a `404`.

With the lab and the `revisor` from 2.7 running, freshly started:

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

Two groups. `lectura-a` knows that 1 and 2 exist, which are its own, and knows nothing about 3: for it, 3 is as nonexistent as 6, which really does not exist. In "The error you will see" you are going to change four lines of `servicios.ts` and watch the third group appear.

#### 2.5.4 Checks also belong to a team

The question "does it exist for you?" is not limited to services. A check belongs to the service it checked, and therefore to its team. `consultarRevision` responds `404` if the check does not exist **or** if its service is not visible to the credential:

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

It is the same pattern with another resource, and it is worth noticing because it is the place where it is most often forgotten: the main resource is carefully protected, and the "child" resource, reached through another identifier, is left open. If `consultarRevision` looked up the check without asking whose service it belongs to, anyone on team b could read the results of team a's checks by walking through `/revisiones/1`, `/revisiones/2`…, even though they could not see the services.

### 2.6 The body: `415` and `400`

#### 2.6.1 Format before reading

The last two questions are only asked when the request carries a body, and in the `revisor` that is the registration, `POST /servicios`. First, **does it come in a format I accept?** The client states its body's format with the `Content-Type` header, and the `revisor` only accepts `application/json`. Then, **can I read it?**: even if it says it is JSON, it may not be.

Both questions are answered by the `leerJson` function in `servicios.ts`, which is new:

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

The first part compares the `Content-Type` with `application/json`. Before comparing, it keeps what comes before the first `;` and lowercases it, because `application/json; charset=utf-8` and `Application/JSON` are the same type: [section 8.3.1 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1) says the type and subtype are case-insensitive, and that what comes after the `;` are parameters. If the type is not JSON, it responds `415`. The second part tries to read the JSON, and also requires it to be an **object**: a number, a string, or a list are valid JSON, but they are not a service. If either of the two fails, it responds `400`, with the same text for both: "el cuerpo no es un objeto JSON" covers both a truncated JSON and one that reads fine but is not an object. Before reading, moreover, `leerCuerpo` checks the size, and if the body is too large `leerJson` responds `413`; section 2.6.4 explains it.

#### 2.6.2 `415`: the format is not one I accept

`curl -d` is the shortest way to send a body, and it has a trap worth seeing once. If you do not tell it the type, it sends `application/x-www-form-urlencoded`, the format of web forms, as the [documentation for the `-d` option](https://curl.se/docs/manpage.html#-d) says:

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

`415 Unsupported Media Type`. [Section 15.5.16 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) defines it: the server refuses to accept the request because the content is in a format not supported by this method on the target resource. And it adds which header helps the client: if the problem is the media type, the `Accept` header **in the response** can indicate which types would have been accepted. Here the specification says **may**, not **must**: unlike `Allow` in the `405` and `WWW-Authenticate` in the `401`, `Accept` in a `415` is recommended, not mandatory. The `revisor` always sends it, because it turns the error into an instruction: "I do not accept forms; I accept `application/json`". And a reasonable question: what happens to the body the `revisor` did not read? It was measured: an 8 MiB `POST` with `Content-Type: text/plain` received the `415`, and the next request on the same connection received its normal `200`; Node discards on its own the body nobody read once the response ends, so here `Connection: close` is not needed, unlike the `413`, where the goal is to stop receiving.

`Accept` in a response is less common than in a request, and it is worth not confusing them. In a request, `Accept` says which formats the client wants to **receive**, and if the server cannot produce any of them, the code is a different one, `406 Not Acceptable`, which is not a protagonist of this course. In the response to a `415`, `Accept` says which formats the server accepts **receiving**. Same name, opposite direction.

With an explicit type that is not JSON either, the result is the same, and the body says which one arrived:

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

#### 2.6.3 `400`: it claims to be JSON and cannot be read

Now the type is right, but the JSON is cut off halfway:

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

`400 Bad Request`. It is the most general code in the family, and [section 15.5.1 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.1) defines it with that breadth: the server cannot or will not process the request due to something perceived to be a client error, and gives as examples malformed request syntax or invalid request message framing. A truncated JSON is malformed syntax.

Why does `415` come before `400`, and not the other way around? Because of the first rule of the order: you cannot say whether something can be read without knowing what format it is in. If the `revisor` tried to read as JSON a body that claims to be a form, the error it would see would be "not JSON", and it would respond `400`; the client would conclude that its JSON is wrong, when what is wrong is the header. The order gives each failure its own code.

#### 2.6.4 `413`: the body is too large

Format is not the only thing that can be rejected before a body is understood: so can **size**. To read a body, the `revisor` keeps it in memory, and a server that keeps in memory everything it is sent hands anyone the key to fill it up. First the red. In a copy of the `revisor` (the full version is in `defectos/sin-tope/respuestas.ts`), change the limit in `respuestas.ts` to infinity:

```ts
export const TOPE_CUERPO = Infinity;
```

Start the lab and the copy, and in another terminal save the `revisor`'s process number in a variable: `REV=$(pgrep -f 'node servidor.ts')`. With it, `ps -o rss= -p $REV` tells you how much memory the process occupies, in kilobytes. Measure it, send a registration of 50 MB of letter `a`, and measure again:

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

The process's memory went from about 93 MB to about 224 MB because of **one** request, and the `revisor` read all of it only to end up responding `400`, because 50 MB of letter `a` is not JSON. With ten such requests at once, or with a body of a few gigabytes, the process runs out of memory and goes down for everyone. And notice who can do it: anyone with a write credential, because the entry point's order does keep strangers out (the body is read only at question 7). That is a defense, but it is not enough: a write credential can also be stolen or misused.

Now the green, with the lesson's `revisor`. The same measurement:

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

`413`, in about three thousandths of a second, and the memory **did not grow**: it went from about 92 MB to about 84 MB, because Node's garbage collector took the opportunity to give memory back (in your run the figures will differ; what matters is that they do not go up). The `revisor` did not store the 50 MB: it answered `413` as soon as it saw they exceeded the limit, and what kept arriving afterwards it read and threw away without storing. This is what `leerCuerpo` does in `respuestas.ts` (it is the same one from Lesson 1, which already used it as a safety net):

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

It has two defenses, because there are two ways to send a body. If the request carries `Content-Length` and already announces more than 16 KiB (16,384 bytes), it rejects **without storing anything**. If it does not carry it, because the body comes **in chunks** (*chunked*, as you saw in Lesson 0), or if the number lies, it counts the bytes as they arrive and stops storing as soon as they pass the limit. In both cases it never keeps more than 16 KiB, and it responds `413` immediately with a **staged close**: it closes only the writing side (half-closed), keeps reading and discarding whatever the client manages to send, and destroys the connection after 2 seconds if the client has not closed it. If it responded and closed abruptly while the client was still sending, the operating system would answer with an RST that can wipe out the `413` before the client reads it (RFC 9112, section 9.6). Why 16 KiB? Because a service is a name of up to 40 characters, a URL, and a number: it fits many times over. The limit is chosen for what the route needs to receive, not for what the server can withstand.

And whoever reads the body, `leerJson`, turns that rejection into the response. The complete run in 2.7 includes the three limit tests:

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

`413 Content Too Large`, which [section 15.5.14 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.14) defines this way: the server refuses to process the request because its content is larger than the server is willing or able to process, and it **may** close the connection. The `revisor` does so with `Connection: close`: Node closes the connection once it finishes responding, and whatever the client kept sending has already been drained without being stored. It does not destroy the request beforehand, because then it could not respond at all. The second test sends the body in chunks (`-T -`), without `Content-Length`, and also receives `413`: there the byte count while reading did the work. The third sends **exactly** 16,384 bytes, right at the limit: they are read in full and, since they are not JSON, the response is `400`. And the query at the end shows that the `revisor` is still alive.

The `413` and the `415` are relatives: both say the body cannot be accepted **as it comes**, one because of its format and the other because of its size, and both are decided without understanding the content. That is why they go together in the body question, before the `400`, which does need to read it. A detail about the name, which you already saw in Lesson 0: Node calls this code "Payload Too Large", the old name; RFC 9110 changed it to "Content Too Large", and `respuestas.ts` uses the registry's.

#### 2.6.5 What is still `400`

In this lesson there are four other situations that also respond `400`, and it is worth seeing them together because Lesson 3 is going to move some of them to another code.

**JSON that is not an object.** `null`, `7`, `"pagos"`, and `[]` are valid JSON, but none of them is a service. `leerJson` checks this before letting the body through, and responds `400 el cuerpo no es un objeto JSON`. It is not a minor detail: if `darDeAlta` received `null` and read `datos.nombre`, JavaScript would throw an error, and an uncaught error in a Node server ends the process. Exercise 4 walks through it.

**Missing fields.** If the body is a JSON object, but does not carry `nombre` or `url` as strings, the `revisor` responds `400 faltan nombre y url`.

**An out-of-range limit.** `limite_ms` is optional and defaults to 2000, but if it is present, it has to be an integer between 100 and 10000:

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

The bound is not a whim. The `revisor` waits for each service's response for at most `limite_ms` milliseconds, and without a bound, a limit of hours would leave it waiting on a service that does not respond, with the connection tied up the whole time; and a limit of zero would declare it down without having queried it. A numeric field the client controls and the server uses to decide how much work it does is a field that is always bounded. The validation goes **before** checking the destination, because checking the destination resolves a name via DNS, and there is no point spending that lookup on a registration that is going to be rejected anyway.

**A forbidden destination.** Lesson 1's SSRF defense is still in place: a registration that points to the cloud metadata address or to a name that resolves to `127.0.0.1` is rejected with `400 destino prohibido: …`. The rule is Lesson 1's, and it covers much more than private networks. In IPv4 it is a **denylist** copied from IANA's special-purpose address registry: besides `10/8`, `172.16/12`, and `192.168/16`, it rejects the providers' shared address space (`100.64.0.0/10`, where one cloud publishes its metadata), the documentation and benchmarking networks, *multicast*, and the reserved block `240.0.0.0/4`. In IPv6 it is an **allowlist**: only global unicast, `2000::/3`, is accepted, minus some special blocks that fall inside it (documentation, Teredo). And before applying either of the two, it extracts the IPv4 address some IPv6 addresses carry hidden in their bits (`64:ff9b::…`, `2002:…`, `::…`) and checks it as IPv4: `[2002:a9fe:a9fe::]` is `169.254.169.254` inside. The complete run in 2.7 verifies it with twelve registrations, one per block, and all twelve are rejected:

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

The last three have something in common: the body **could be read**, and what fails is that what was read cannot be fulfilled. Lesson 3 adopts a written policy for that difference: `400` for what cannot be read and `422` for what is read but cannot be fulfilled. For now the `422` does not exist in the `revisor`, and everything in the body that cannot be used is `400`. That the code is the same does not mean the body should be: the text of each `400` says what failed, and that is the difference between a useful `400` and the one in the opening scene.

### 2.7 The complete `revisor`

#### 2.7.1 The files that change

This lesson's `revisor` lives in the `~/curso-http/fig02_01/` folder. If you have the folder from Lesson 1, copy it under that name and change three files: one new, `autenticacion.ts` (section 2.3.2), and two modified, `rutas.ts` and `servicios.ts`, in full here:

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

In `servicios.ts`, besides what you already saw (`visible`, `noExiste`, `leerJson`, and the bound on `limite_ms`), the `Contexto` changed: it now carries the credential the entry point verified, and every handler receives it. No handler reads the `Authorization` header again; the entry point did it once and passed on the result. That way there is a single place where who you are gets decided.

#### 2.7.2 The files that do not change

The other files are Lesson 1's, without a single change. They are included in full so the `revisor` can be assembled from this lesson:

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

#### 2.7.3 The complete run

Open two terminals in `~/curso-http/fig02_01/`. In the first, the lab, which is Lesson 0's test bench on port 18081; in the second, the `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

In a third terminal, these are the lesson's requests, in order, with what they responded. The main ones from the previous sections are here again, together, so you can compare them with yours in one go:

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

Seventeen requests and eight different codes: `[401 401 401 200 404 404 200 403 405 404 415 415 400 201 400 400 400]`. Each error is the "no" of one of the seven questions, and each success, a request that passed all of them.

#### 2.7.4 The tag still works behind the entry point

The entry point changed nothing of what Lesson 1 built: conditional requests with `If-None-Match` respond the same, now with a credential. The `revisor`'s `ETag` has three parts, `"id-version-startup"`: the last one is eight random digits the `revisor` draws every time it starts, so that a tag from before a restart does not, in practice, match one from after (they are 32 random bits: a one-in-4,295-million chance for each earlier startup, not a mathematical guarantee; Lesson 1 explains why: [RFC 9110, section 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), does not allow reusing a tag for another representation). That is why, to repeat these requests, you first have to read the current tag. The run stored it in a terminal variable, `ETAG`, with `curl`'s `-w '%header{etag}'` option, which prints only that header:

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

The first three are `304`: `If-None-Match` accepts the weak tag (`W/`), a list, and `*`, as Lesson 1 taught. The fourth, a list without the current tag, receives the full service. And the restart test: the tag of service 3 was read, the `revisor` was stopped and started again (in your terminal, with `Ctrl`+`C` and `node servidor.ts`), and service 3 was requested with the old tag:

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

`200`, with a new tag: service 3 has the same id and the same version as before the restart, but the last eight digits changed, and the client's old copy is no longer considered valid.

The `revisor`'s terminal logged every request that reached it during the run, in this order: the seventeen from 2.7.3; the one from 2.2.3 and the one from 2.4.2; the tag ones; the lowercase one from 2.3.1 and the `Basic` one (the `constructor` method from 2.3.3 does not appear, because Node rejected it first); the three large-body registrations from 2.6.4 and the query that verifies the `revisor` is still alive; a registration with `-d 'null'` followed by a query, to verify that the `revisor` is still alive (exercise 4 repeats it); the twelve range registrations from 2.6.5, and the two from the restart, one before and one after. Notice the second `revisor en …`, the one from the process's second life:

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

## The error you will see

### The `403` that gives it away

This is the code almost everyone writes the first time they separate services by team, because it reads very naturally: I look up the service; if it does not exist, `404`; if it exists and is not yours, `403`. To trigger it, copy the `fig02_01/` folder as `rota/` and change the beginning of `consultar` in `rota/servicios.ts` to this (it is a fragment; the full version is in `defectos/403/servicios.ts`):

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

Start the lab and the `revisor` from `rota/` and repeat the pair from 2.5.2:

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

Each response, on its own, looks impeccable: the `403` is an allowed code for a forbidden resource, it explains in the body why it refused, and the `404` tells the truth. The problem is in the **pair**. Run the enumerator against it:

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

Three groups, and the program flags it. Service 3 received a response that no nonexistent identifier receives, so `lectura-a` now knows that service 3 exists, and that it belongs to another team, without having seen a single piece of its data. With identifiers from 1 to 100,000, it would know how many services the company has and which belong to other teams. That is the enumeration from the callout in 2.5, produced by four lines nobody wrote with bad intentions.

The fix is to go back to `visible`: a single function that returns `undefined` for what belongs to others and for what does not exist, and a single branch that responds. It is not enough to change the `403` to a `404` while keeping the two branches: the day someone edits the text of one and not the other, the difference comes back, this time in the body. Stop the programs from `rota/` when you finish.

### The credential nobody issued

The second error is the one from section 2.3.3. Copy `fig02_01/` again as `rota2/` and change, in `rota2/autenticacion.ts`, the table and the lookup to the object-based form (the full version is in `defectos/prototipo/autenticacion.ts`):

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

TypeScript does not complain about either change: for it, `CREDENCIALES[token]` is a `Credencial`. Start the lab and the `revisor` from `rota2/` and try two words nobody registered:

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

`200 OK`. The entry point let `constructor` and `toString` through as if they were credentials. `CREDENCIALES["constructor"]` found the `Object` function, which every object inherits; `CREDENCIALES["toString"]`, the function of the same name. Neither is `undefined`, so `identificar` answered "valid". That the list comes out empty is pure luck: those "credentials" have no `equipo`, and `listar`'s filter does not find any service whose team is `undefined`. Look at what happens when trying to write and when querying:

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

The `403` says "tu credencial solo puede leer": the entry point believes it knows who you are, even though there is nobody behind it; it only refused to let it write because the `Object` function does not have a `rol`. And when querying, `404`: its `equipo` is `undefined`, so `visible` does not let it see even service 1, which belongs to team a. This time nothing broke, by luck. But the entry point's third question has already answered "yes" to someone who does not exist, and any rule that only asks "did they identify themselves?" would let it through: an audit log would record a user `undefined`, a per-credential rate limit would treat it as just another one, and a route that only requires being identified would respond to it. With the `Map` in `fig02_01/`, the same requests give `401` with `error="invalid_token"`, as the third request of the complete run in 2.7 shows. Stop the programs from `rota2/` when you finish.

## What gets done wrong

**A `401` without `WWW-Authenticate`.** It is the most common mistake with this code, and the specification forbids it with a **MUST**. Without the challenge, the client knows it needs to identify itself, but not how; some HTTP clients, moreover, do not attempt to authenticate if they do not see the challenge.

**A `405` without `Allow`, or with an `Allow` that lies.** The first leaves the client trying methods blindly. The second is worse: if `Allow` says `PUT` and the `PUT` responds `405`, the client can no longer trust anything the API says. In the `revisor`, `Allow` is computed from the same table that decides which method is handled, so it cannot drift; writing it by hand in each response is the way to make it drift.

**`404` for a method that is not supported.** It is what Lesson 1's `revisor` did, and it sends the client looking for an address that was right.

**`403` for someone who did not identify themselves.** If I do not know who you are, I cannot say it is not yours to do: the code is `401`, with its challenge. A `403` to a client without a credential tells it "do not insist", when what it needed to do was identify itself.

**`401` for someone who identified themselves correctly but has no permission.** The opposite mistake. The client retries with the same credential, or requests a new one, and receives the same thing forever.

**Validating the body before the credential.** It teaches a stranger, through repeated `400`s, what your API expects and which values it accepts, and it spends server work on requests that were going to be rejected anyway.

**Responding differently to what belongs to others and to what does not exist.** A `403` versus a `404`, or a `404` with "does not exist" versus a `404` with "belongs to another team", or the same text with a different length. Any of the three differences is enough to enumerate. The callout in 2.5 explains the cost.

**`400` for everything.** A client that receives the same `400` when the format is wrong, when the JSON is truncated, or when a field is missing cannot decide from the code what to fix; all it has left is to interpret the text, and a program must not decide based on sentences. Each of the entry point's questions has its own code so the client knows which one failed.

**Reading the body without a limit.** Anyone who reaches the route can fill the server's memory with a single `POST`, and section 2.6.4 measured how much: about 150 MB per request. The limit is set by what the route needs and is checked **while** reading, not afterwards.

**Repeating the credential in the error message.** The client already knows which credential it sent; the logs, caches, and screenshots the response passes through must not.

**Letting an exception from the JSON reader become a `500`.** `JSON.parse` throws an exception on malformed JSON. If nobody catches it, the server responds `500` (or, in Node, crashes): it blames the server for a client error. `leerJson` catches the exception and turns it into the `400` it is.

## Exercises

All four check themselves: each ends with a run that tells you whether you got it right. Write your prediction in your [logbook](bitacora.md) **before** running anything. For all of them you need the lab and the `revisor` from 2.7 running, freshly started (the `revisor` keeps everything in memory, and an earlier registration or withdrawal changes the responses).

### Exercise 1 — At which question does it stop?

Without running anything, predict the code of each of these seven requests, and at which of the entry point's questions each one stops:

```bash
curl -i -X PATCH http://127.0.0.1:18080/servicios/1
curl -i -X DELETE http://127.0.0.1:18080/servicios/99
curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-b'
curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/nada
```

Then run them and compare. If you missed any, the clue is in the order: look for the first question whose answer is "no".

### Exercise 2 — What `Allow` says

Predict the `Allow` header of these three responses, and whether they really are `405`:

```bash
curl -i -X DELETE http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
curl -I http://127.0.0.1:18080/servicios
curl -i -X PUT http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
```

`-I` sends a `HEAD`, and `-X` changes the method. Run all three and compare.

### Exercise 3 — The enumerator with other credentials

Predict what `fig02_02.ts` prints with `escritura-b`, with `admin`, and with a made-up credential, `nadie`. In which of the three does the program "discover" more services, and why is it not a leak? Run all three:

```bash
node fig02_02.ts escritura-b
node fig02_02.ts admin
node fig02_02.ts nadie
```

### Exercise 4 — JSON that is not a service

Predict the code and the body of each of these five registrations. All of them carry a write credential and claim to be `application/json`, and all of them fail, but not in the same place:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '7'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '[]'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json; charset=utf-8' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"rapido"}'
```

Look at the `Content-Type` of the last one: it carries a parameter, `charset=utf-8`. Does `leerJson` accept it? Run all five and compare. For each one, say which of the seven questions stopped it, or whether it passed all seven and was stopped by a registration rule.

## Solutions

### Solution 1

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

In order: `405` (question 2: the route exists and does not support `PATCH`, and it stopped before asking who you are); `401` (question 3: the route and the method exist, the credential is missing, and 99 was not even looked up); `403` (question 4: a reader does not delete, whether 99 exists or not); `415` (question 6: the writer may register, but the body is not JSON); `404` (question 5: service 1 belongs to team a, and for `escritura-b` it does not exist); `403` (question 4: requesting a check is writing, and `lectura-a` only reads); `404` (question 1: `/nada` is not in the table, and no credential was needed). If you missed the second or the third, go over 2.1.2 again: those are the two lines where the entry point's order hides whether 99 exists.

### Solution 2

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

The first is `405` with `Allow: GET, HEAD`: `/revisiones/1` can only be queried. The second **is not a `405`**: `HEAD` is supported wherever `GET` is supported, and `/servicios` supports `GET`, so the entry point moved on to question 3 and responded `401`, with its challenge, and without a body because it was a `HEAD` (the `Content-Length: 20` says how long a `GET`'s body would be, as in Lesson 0). The third is `405` with `Allow: GET, HEAD, POST`, the collection's methods. Notice that all three `Allow` headers came from the same table in `rutas.ts`, without writing any of them by hand.

### Solution 3

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

`escritura-b` sees only 3, and for it 1 and 2 are as nonexistent as 6. `admin` "discovers" three services, but it is not a leak: the administrator has team `*` and can see all of them, so seeing all three is its permission, not a deduction. And `nadie` learns nothing: all six identifiers receive the same `401`, because the credential is asked before existence. In all three cases there are at most two groups, and the program's warning does not appear.

### Solution 4

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

All five passed the first six questions: the route exists, it supports `POST`, the credential is valid and can write, a collection has no resource that might not exist, and the type is JSON. The last one too, even though its `Content-Type` carries `; charset=utf-8`: `leerJson` keeps what comes before the `;`, as we saw in 2.6.1. The first three stop at question 7: `null`, `7`, and `[]` are read as JSON, but they are not an object, and `leerJson` rejects them with `el cuerpo no es un objeto JSON`. The last two are objects and pass all seven questions; they are stopped by the registration rules: `{}` carries neither `nombre` nor `url`, and `"rapido"` is not an integer between 100 and 10000. Notice that the text of each `400` is different: with the same code, the body says what to fix. And notice what did not happen: none of the five brought the `revisor` down, and it keeps responding to the next request.

## How I know I got it

- [ ] You can say from memory the entry point's seven questions in order, and for each one, its code.
- [ ] `curl -i http://127.0.0.1:18080/servicios` without a credential gives `401` with `WWW-Authenticate: Bearer realm="revisor"`, and with `Authorization: Bearer inventada` gives `401` with `error="invalid_token"` in the challenge.
- [ ] With `Authorization: Basic …` the response is `401` with the challenge **without** `error`, and with `bearer lectura-a`, in lowercase, it is `200`.
- [ ] `curl -i -X PATCH` to `/servicios/1` gives `405` with `Allow: GET, HEAD, DELETE`, and `/servicioss` gives `404`.
- [ ] `curl -i -X DELETE` to `/servicios/1` and to `/servicios/99` with `lectura-a` both give `403`, and you can explain why the second is not `404`.
- [ ] `lectura-a` requests `/servicios/3` and `/servicios/99`, and the two responses are identical except for the number; `escritura-b` does see 3.
- [ ] `node fig02_02.ts lectura-a` concludes that only services 1 and 2 exist.
- [ ] A `POST` with `curl -d` without `Content-Type` gives `415` with `Accept: application/json`, and one with truncated JSON gives `400`.
- [ ] A `POST` of 20,000 bytes gives `413` with `Connection: close`, both with `Content-Length` and in chunks, and one of 16,384 bytes gives `400`.
- [ ] You can explain why the credentials table is a `Map` and not an object, with the `Bearer constructor` run.
- [ ] When you finish, no program is left listening: `curl -i http://127.0.0.1:18080/` gives error 7.

## Summary

Answer without looking at the lesson:

1. What are the entry point's seven questions, in order, and what code does each respond with when the answer is "no"?
2. Which header does a `401` require and which a `405`? Which section of RFC 9110 says so?
3. Which question decides between `401` and `403`?
4. Why does the credential go before existence? And why does role permission go before existence?
5. What does RFC 9110 allow you to do with a forbidden resource whose existence you want to hide?
6. What is resource enumeration, and which three paths does the `revisor` close to prevent it?
7. Why does `415` go before `400`? Which header helps the client in a `415`, and is it mandatory?
8. Why can `CREDENCIALES[token]` on a JavaScript object accept a credential nobody registered?
9. What do the `413` and the `415` have in common? Why does `leerCuerpo` need two defenses for size, and not one?

## Sources

All consulted on October 21, 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), section 15.5.1: the `400` and its broad definition, "something that is perceived to be a client error".
2. [RFC 9110, section 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2): the `401` and the mandatory `WWW-Authenticate` header, with at least one challenge; and [section 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), why the `ETag` is not reused for another representation.
3. [RFC 9110, section 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4): the `403`, the rule against repeating with the same credentials, and the `404` allowed to "hide" a forbidden resource.
4. [RFC 9110, section 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): the `404`, "did not find a current representation … or is not willing to disclose that one exists".
5. [RFC 9110, sections 15.5.6 and 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6): the `405` and the `Allow` header mandatory in it.
6. [RFC 9110, section 9.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1): the line between `405` (known method, not supported on the resource) and `501` (method the server does not implement).
7. [RFC 9110, sections 15.5.16 and 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16): the `415`, and `Accept` in the response to say which types would have been accepted; the `413`, and that the server may close the connection.
8. [RFC 9110, sections 11.1, 11.4, and 11.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1): the authentication scheme's name is case-insensitive, the shape of the credential (`scheme` and a space), and the shape of the challenge in `WWW-Authenticate`.
9. [RFC 9110, section 8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1): the type and subtype of a `Content-Type` are case-insensitive; what follows the `;` are parameters.
10. [RFC 6750, *The OAuth 2.0 Authorization Framework: Bearer Token Usage*](https://www.rfc-editor.org/rfc/rfc6750.html), sections 3 and 3.1: the `Bearer` scheme, the challenge with `realm`, the `invalid_token` code, and the rule against sending an error code when the request carries no authentication or uses an unsupported scheme.
11. [OWASP API Security Top 10, API1:2023 *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization): checking on every access that whoever is asking may use that record, and hard-to-guess identifiers.
12. [OWASP Web Security Testing Guide, WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md): enumeration through differences between `403` and `404`, and generic responses as a defense.
13. [GitHub REST API documentation, *Troubleshooting*](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api): it responds `404` and not `403` to a private resource, so as not to confirm that it exists.
14. [`curl` manual](https://curl.se/docs/manpage.html), options `-d`, `-H`, `-X`, `-I`, and `-w`: `-d` sends `application/x-www-form-urlencoded` if no other type is given, and `-w '%header{etag}'` prints a response header.
15. [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): `message.headers` with header names in lowercase, as `identificar` (`peticion.headers.authorization`) and `leerJson` (`peticion.headers["content-type"]`) read them.

### Terms in this lesson

| | |
|---|---|
| **authentication** | finding out who is making the request; if it fails, `401` |
| **authorization** | deciding whether whoever is making the request may do that; if not, `403` |
| **`Bearer`** | RFC 6750's authentication scheme: whoever bears the credential is who they say they are |
| **resource enumeration** | finding out which resources exist by trying identifiers and comparing the responses |
| **the entry point** | the questions a request goes through, in order, before reaching its handler |
| **challenge** | the value of `WWW-Authenticate`: the scheme to authenticate with and its parameters |
| **role** | what a credential can do: in the `revisor`, reader, writer, or admin |
| **body limit** | the maximum size a route agrees to read; if it is exceeded, `413` |
| **prototype** | the object a JavaScript object inherits properties from, such as `constructor` or `toString` |

---

**Previous:** [Lesson 1 — Successes and redirections: 200, 201, 202, 204, 301, 308, and 304](01-exitos-redirecciones.md) · **Next:** [Lesson 3 — The client made a mistake (II): 409, 410, 412, 422, and 428](03-errores-del-cliente-estado.md)

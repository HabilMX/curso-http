# Lesson 3 — The client made a mistake (II): 409, 410, 412, 422, and 428

It is 5:40 PM on a Friday and Ana, from the payments team, has just moved the billing service to its new address. The old one shuts down at 6:00. She opens the service's record in the `revisor`, changes the URL, saves, and gets `200 OK`. She leaves relieved. What she does not know is that Beto, from her same team, opened that same record at 5:30 to raise the time limit from 2 to 3 seconds, got up for a coffee, and came back at 5:45. Beto changes the limit, saves, and also gets `200 OK`. But what Beto saved was **his whole copy**, the one from 5:30, which still carried the old address. At 6:00 the old address shuts down, the `revisor` queries it, gets a connection error, and marks the billing service as `CAIDO` all night. The new service works perfectly; nobody is watching it. And neither of the two people received an error: both saw a `200`.

That is called a **lost update**, and this lesson prevents it with a tag and a header. Along the way it names the other four ways in which a well-formed request still cannot be fulfilled.

**Time:** 2 × 45 min (the split is between sections 3.4 and 3.5)

**What you build:** the change of a service (`PUT /servicios/{id}`) that does not overwrite someone else's change; the validation that separates what cannot be read from what cannot be fulfilled; the memory of withdrawn services; and the API's previous version, which announces that it is leaving before it goes

**What you learn:** to tell apart a **state conflict** (`409`), a **business rule** that the data does not meet (`422`), and a **precondition** that failed (`412`); what the lost update is and how `ETag` with `If-Match` prevents it, even when two requests arrive at the same time; `412` versus `428`; `410` versus `404`; the course's written policy for `400` versus `422`; and how the withdrawal of an API version is announced with `Deprecation` and `Sunset` before the `410` arrives

**Where you are coming from.** From [Lesson 2](02-errores-del-cliente-peticion.md), with a `revisor` that has an entry point: it knows who is talking to it, what each credential can do, which route and method exist, and in what format it accepts the body. That `revisor` does not yet allow **changing** a service: only registering it, querying it, withdrawing it, and checking it. It answers `400` to everything in the body that is of no use to it, whether because it cannot be read or because it reads fine and makes no sense. And when you withdraw a service, its identifier ends up at `404`, as if it had never existed.

**What this lesson does not do.** It does not teach `PATCH`: the `revisor` changes a whole service with `PUT`, and a `PATCH` still answers `405`. It does not teach the `If-Unmodified-Since` header, `If-Match`'s sister that compares dates instead of tags; the course uses only tags, because HTTP dates have a resolution of one second and two changes within the same second would be indistinguishable. And error bodies are still a line of text; [Lesson 5](05-problem-details.md) turns them into `application/problem+json`, and there the list of `422` failures becomes an array a program can walk through.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS with Node 24.14.1 and curl 8.7.1, and none depends on anything specific to macOS. In your run the date in the `Date` header and **the final eight digits of each `ETag`** will change (`"1-1-c6e922ee"` in the lesson's main run): the `revisor` draws them at random every time it starts, so yours will be different and will change every time you restart it. When a command needs a tag, copy the one you got in the previous response, or save it in a variable as the lesson does with `ETAG=$(…)`. The `revisor` keeps everything in memory, so each response depends on what the earlier requests did. That is why the lesson's runs are grouped into **series**, and the text marks where each one starts: series A is the main one, from a freshly started `revisor` from `fig03_01/`, and goes from section 3.2.3 to the end of 3.8 without restarting; the others (the two-editors program, each broken version, and the exercises) are short and each starts with a freshly started `revisor`. To get the same as the lesson, start the `revisor` again where each series begins, and do not restart it in the middle of one. The programs are in [`programas/03-errores-del-cliente-estado/`](../programas/03-errores-del-cliente-estado), in the course repository: the `revisor` in `fig03_01/`, the two editors in `fig03_02.ts`, the warnings reader in `fig03_03.ts`, the broken versions from "The error you will see" in `defectos/`, and each run in its `.salida.txt` file. All of them pass `tsc` in strict mode with the same command from section 1.11 of Lesson 1.

## By the end you will be able to

- Classify a failing request as a state conflict, a business rule, or a precondition, and answer `409`, `422`, or `412` according to the question that decides it.
- Trigger a lost update with two editors and demonstrate with a run that `If-Match` turns it into a `412`.
- Trigger the same loss with two simultaneous requests that do send `If-Match`, and explain why the version is compared again in the same step in which it is written, like an `UPDATE … WHERE version = N`.
- Explain why `If-Match` is compared strongly, what happens with a `W/` tag, with a list, and with `*`, and cite the section of RFC 9110 that requires it.
- Distinguish `412` from `428` and say what the client has to do in each case.
- Answer `410` to a resource that was withdrawn on purpose and `404` to one that never existed, without telling another team what used to exist.
- Announce the withdrawal of an API version with `Deprecation`, `Sunset`, and `Link`, and check with a program that the `Sunset` date is not earlier than the `Deprecation` one.

## The why before the how

In Lesson 2 every failure could be discovered by looking at **the request alone**: the route, the method, the credential, the body's type. If they were wrong, they were wrong at any time and against any server. This lesson's failures are different: the request is well written, it reads completely, and even so it cannot be fulfilled. To know it, the server has to look at **something more than the request**: the resource's current state, the business rules, or what the client believed when it wrote it.

That is why this lesson's five codes answer questions that did not exist in Lesson 2:

| Question | If the answer is "no"… | Code | What the requester has to do |
|---|---|---|---|
| Does the data make sense, each value on its own? | it was read, but some value is impossible | `422` | fix those values |
| Does it fit with what is already there? | it clashes with the server's current state (for example, another service already uses that name) | `409` | resolve the clash and send again |
| Is the resource as the client believed? | it changed since it read it | `412` | read again, redo its change, send again |
| Did the client say which version it believed it had? | it did not say, and the server requires it | `428` | read, and send the tag |
| Is the resource still there? | it was withdrawn on purpose and will not come back | `410` | stop requesting it and delete the link |

Each row is again a different action for whoever receives the error, and almost always that someone is a program. A `422` says "your data is wrong; fix it". A `409` says "your data is fine, but it clashes with something that already exists". A `412` says "your data may be fine, but you wrote it thinking of a version that no longer exists". If the `revisor` answered all three with `400`, Beto's program would have no way of knowing that what it should do was **read again**, which is exactly the only thing that would have saved Ana's change.

The lesson has four parts:

1. **Three questions that get confused** (3.1): state conflict, business rule, and precondition.
2. **The lost update** (3.2 to 3.4): provoking it in red, avoiding it in green with `ETag` and `If-Match` (`412`), closing the race between two simultaneous requests by comparing in the same step in which it writes, and requiring the condition (`428`).
3. **Conflict, rule, and the resource that left** (3.5 to 3.7): `409`, the policy of `400` versus `422`, and `410` versus `404`.
4. **API versions and the complete `revisor`** (3.8 and 3.9): `Deprecation`, `Sunset`, and the announced `410`; the files and the run.

## The concepts

### 3.1 State conflict, business rule, and precondition

#### 3.1.1 Three failures that look the same

Imagine three requests from team `a` that the `revisor` rejects. All three are valid JSON, all three arrive with a write credential, and all three go to a route that exists:

- A registration with `{"nombre":"","url":"ftp://archivos","limite_ms":5}`.
- A registration with `{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}`, when team `a` already has a service called `pagos`.
- A change to service 1 made from a copy that was read ten minutes ago, when someone else has already changed it.

If you ask someone who is starting out what they have in common, they will say "they are validation errors", and will answer `400` to all three. But look at what whoever sent them would have to do for the next one to work:

- In the first, **fix the data**. It does not matter how many times they repeat it, or what happens on the server in the meantime: an empty name will never be valid. The failure is **inside** the request.
- In the second, **the data is fine**. A name `pagos` is perfectly valid; the problem is that there is already another. If tomorrow someone withdraws team a's `pagos` service, this same request, without changing a byte, will work. The failure is in the **clash** between the request and the server's current state.
- In the third, the data may be fine **and** may clash with nothing. The problem is another: whoever sent it wrote their change on top of a version of the service that no longer exists. If the server accepted it, it would erase someone else's change without anyone finding out. The failure is in an **assumption** by the client that stopped being true.

They are three different failures, and HTTP has a code for each:

| Failure | Where the problem is | Code | Section |
|---|---|---|---|
| **Business rule**: the data cannot be fulfilled | inside the request | `422 Unprocessable Content` | RFC 9110, 15.5.21 |
| **State conflict**: the data clashes with what is already there | between the request and the current state | `409 Conflict` | RFC 9110, 15.5.10 |
| **Precondition**: the client assumed a state that no longer holds | in what the client believed | `412 Precondition Failed` | RFC 9110, 15.5.13 |

#### 3.1.2 What the specification says about each

The definitions in [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) are short, and worth reading carefully because each carries the question that decides it.

The **`422`** ([section 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21)) says that the server **understands the content type** (that is why it is not `415`), that **the syntax is correct** (that is why it is not `400`), but that it was unable to process the instructions it carries. The specification's example is well-formed XML with instructions that make no sense. The question that decides it is: **could I read it, but what it says is impossible?**

The **`409`** ([section 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10)) says the request could not be completed due to a **conflict with the current state** of the resource, and that it is used when the user **might be able to resolve the conflict and resubmit** the request. It adds a **should**: the server should generate content that includes enough information for the user to recognize the source of the conflict. The question that decides it is: **would this be valid if the server were in another state?**

The **`412`** ([section 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13)) says that **one or more conditions given in the request header fields** evaluated to false when tested on the server, and that it exists so the client can prevent the method from being applied if the resource is in an unexpected state. The question that decides it is: **did the client set a condition, and was it not met?**

Notice the last sentence: the `412` only exists if **the client** set a condition. The server does not invent preconditions; it evaluates them. That is the finest difference in the lesson, and it returns in section 3.5.

#### 3.1.3 In what order they are asked

Lesson 2's entry point had seven questions: route, method, credential, permission, existence, format, and reading. This lesson adds questions between them and **after** them, and their order matters too. From existence on, a change (`PUT`) asks this:

1. Does the resource exist, for you? If it was withdrawn and was yours, `410`; if not, `404`.
2. (As in Lesson 2) Does the body claim to be JSON? If the `Content-Type` header says anything else, `415`. This is known without reading the body.
3. Only in a change: did you send the condition? If not, `428`. Is it met? If not, `412`.
4. (As in Lesson 2) Can the body be read? If not, `400`. And if it exceeds 16 KiB, the limit the `revisor` accepts, `413` (section 3.6.1).
5. Can the data be fulfilled? If not, `422`.
6. Does it clash with the server's state? If it clashes, `409`.
7. Only in a change, when writing: is the version still the one that matched in step 3? If another request changed it in the meantime, `412`; if another withdrew it, `410`. This step looks repeated, and it is not: section 3.3.4 shows what happens without it.

Why does the format go before the condition, and the condition before reading the body? Because the specification asks for it. [Section 13.2.1 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1) says that a server **must** evaluate preconditions after its normal request checks and **just before it processes the request content** or performs the method. And it adds the other half of the rule: the server **must** ignore preconditions if, without them and **before processing the content**, the response would have been something other than a `2xx` or a `412`. In other words: errors detected before real work begins win over the condition. A route that does not exist, a missing credential, and a withdrawn resource are among those. So is a `Content-Type` that is not accepted: the `415` comes out of a header, without reading a single byte of the body ([section 15.5.16](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) says the `415` can be due to the `Content-Type` the request declares). That is why a `PUT` with `text/plain` receives `415` even though its tag is stale, and a `PUT` with `If-Match: *` to a withdrawn service receives `410` and not `412`, as you will see in 3.7. What does wait for the condition is **reading** the body: the `400` and the `422` are only known after processing it.

The `428` is not a precondition that gets evaluated; it is the lack of one. Even so, the `revisor` asks it in the same place as the `412`, after the format: that way the two responses that send the client to read the tag come out of the same step, and a client that sends the wrong format and no condition finds out first about what is known without reading anything.

And there is a practical reason for the condition to go before reading: if the tag is stale, everything the body says is written on top of a version that no longer exists. There is no point checking it field by field and telling the client "your name is wrong" when what it has to do first is read again. The exercises check it with runs: the 1st, with a `text/plain` without a condition and another with a stale tag; the 3rd, with a request that carries a stale tag and impossible data at the same time.

### 3.2 The lost update

#### 3.2.1 Two editors and a `200` for each

The opening scene needs neither bad luck nor a programming error; two people and a `PUT` that asks nothing are enough. The problem has a name in the specification: RFC 9110, in [section 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1), calls it the *lost update* and says that `If-Match` exists mainly to prevent it, when several clients act in parallel on the same resource.

It happens, in its most common form, with a sequence of four steps (with three editors or an automated process in between it is the same idea, with more actors):

1. Ana reads the service. She has a copy.
2. Beto reads the service. He has an identical copy.
3. Ana changes the address in her copy and saves it. The server is left with the new address.
4. Beto changes the limit in **his** copy, which still has the old address, and saves it. The server is left with the new limit **and the old address**.

Step 4 is the one that hurts. `PUT` replaces the whole resource with what the body carries: [section 9.3.4 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4) says it asks that the state of the resource be **created or replaced** with the state in the request. Beto did not mean to touch the address; he simply sent the one he had. For the server there is no way to tell "I didn't touch it" from "I want it this way".

The program `fig03_02.ts` reproduces the four steps against the `revisor`. Ana sets the address `…/codigo/204`; Beto, the limit of 3000 ms. At the end the service is read and the program says whether Ana's change survived:

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

If the server answers `412` to Beto, the program does what a well-written client must do: it reads again, applies **its** change (only the limit) on the new copy, and saves again. But that only happens if the server answers `412`. First, the red.

#### 3.2.2 In red: a `PUT` that asks nothing

This is the `PUT` almost everyone writes the first time: look up the service, read the body, validate it, and save it. It works, passes all the single-user tests, and loses data as soon as there are two. To see it, copy the `fig03_01/` folder from section 3.9 as `rota/` and delete from `cambiar`, in `rota/servicios.ts`, the whole block that goes from `const condicion = …` to the computation of `versionLeida`, and pass `null` to `cambiarServicio`. It looks like this (it is a fragment; the full version is in `defectos/sin-condicion/servicios.ts`):

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

**Series C:** start the lab and the `revisor` from `rota/`. First, a `PUT` without `If-Match`, which in this lesson's `revisor` gives `428`:

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

`200`. Nothing stops it. And now the two editors. Copy `fig03_02.ts` next to `rota/` and run it:

```text
$ node fig03_02.ts
Ana      lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Beto     lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Ana      guarda: 200 "1-3-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":1500}
Beto     guarda: 200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
Al final lee:    200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
SE PERDIÓ el cambio de Ana, y nadie recibió un error
```

There is the opening scene, complete. Ana saved the new address (`…/codigo/204`) and received `200`. Beto saved his old copy with the new limit and **also** received `200`, and in doing so put the address back to `…/codigo/200`. Notice that Beto **did send** `If-Match`, with the tag `"1-2-…"` that he read; the server simply did not look at it. A conditional header that the server ignores protects nothing, and the client has no way of knowing it: the specification allows an intermediary to ignore `If-Match`, but the origin server that receives it **must** evaluate it before performing the method (section 13.1.1).

What is wrong is not visible in any header: it is the `200` itself. A `200` told Beto "your change was applied on top of what you read", and it was a lie: it was applied on top of something Beto never saw. Stop the programs in `rota/`; you will use that folder again in 3.3.4.

#### 3.2.3 In green: the tag as proof of which version you read

The solution has two components you already know from Lesson 1:

- **`ETag`**: every time the `revisor` hands over a service, it attaches a tag that changes every time the service changes. In the `revisor` it is `"id-version-startup"`: the service's id, a version number that goes up with each change, and the eight digits drawn at startup.
- **A conditional header**: in Lesson 1, `If-None-Match` said "send it to me only if it changed". Now `If-Match` says the opposite: "**do this only if it has not changed**", or more exactly, only if the current tag is the one I read.

With that, each client sends, along with its change, the tag of the version on which it wrote it. If someone changed the service between the read and the write, the tag no longer matches and the server refuses: it answers `412` and applies nothing. The client did not lose data; it lost a race, and it knows it.

First, the same two-editors program that in 3.2.2 lost Ana's change. **Series B:** stop the `rota/` `revisor`, start the lab and the `revisor` from `fig03_01/`, and run `fig03_02.ts` as soon as it starts:

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

Ana saved (`200`, version 2). Beto received `412`, read again (now he sees Ana's address), applied only his change, and saved (`200`, version 3). At the end both changes are there. Nobody had to coordinate over chat or lock the service while editing it: it was enough for the server to refuse to write on top of an old version. This technique is called **optimistic concurrency**: it is assumed that clashes will almost never happen, everyone is allowed to work, and only the one who arrives late is stopped.

Now the same, step by step, with `curl`. **Here series A begins, the lesson's main one:** stop the `revisor` and start it again from `fig03_01/`, so service 1 is as it was at the beginning. From here until the end of section 3.8, all the requests to the good `revisor` belong to this same series; do not restart it between one and another, because each one starts from what the previous one left. First the service 1 is read and its tag is saved in the variable `ETAG`, with `curl`'s `-w '%header{etag}'` option, which prints only that header. This read stands in for "Ana and Beto read":

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

Ana saves first, with `If-Match` and the tag she read. She changes the limit to 1500 ms:

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

`200` and a new tag: the version went from 1 to 2. Now Beto arrives with **the same tag as before**, the one for version 1, and a different change:

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

`412 Precondition Failed`. Beto's change was not applied, and Ana's is intact. The body says what happened and what to do: his tag is no longer the current one, because the service changed (or because the `revisor` restarted, which also invalidates tags), and he has to read it again before changing it. It does not repeat the tag Beto sent: Beto already has it, and returning to the client a text it wrote itself only enlarges the response without telling it anything new.

### 3.3 `If-Match` and the `412`

#### 3.3.1 Why `If-Match` is compared strongly

Lesson 1 taught that there are two ways to compare tags, and [section 8.8.3.2 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) defines them with a table:

| Tag 1 | Tag 2 | Strong comparison | Weak comparison |
|---|---|---|---|
| `W/"1"` | `W/"1"` | no match | match |
| `W/"1"` | `W/"2"` | no match | no match |
| `W/"1"` | `"1"` | no match | match |
| `"1"` | `"1"` | match | match |

A **weak** tag (`W/` in front) promises little: that two representations are "equivalent", even though the bytes are not identical. It is good for caching, and that is why `If-None-Match` is compared weakly. A **strong** tag promises that the bytes are exactly the same.

`If-Match` is compared **strongly**, and [section 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) requires it with a **must**: the origin server must use the strong comparison because the client wants to prevent the method from being applied **if there has been any change** to the representation data. A weak tag cannot guarantee that: two "equivalent" versions may differ in something the client does care about. That is why, with strong comparison, a `W/` tag **never** matches anything, not even its twin.

The specification also says what the header carries: `*` or a **list** of tags separated by commas (`If-Match = "*" / #entity-tag`). And it gives three steps to evaluate it:

1. If it is `*`, the condition is met if the resource has a current representation, that is, if it exists.
2. If it is a list, it is met if **any** of the tags matches the current one.
3. In any other case, it is not met.

`etiquetas.ts`, which comes unchanged from Lesson 1, already does all this: `interpretarLista` reads the list respecting the quotes, `coincideFuerte` compares two tags as the table asks, and `hayCoincidencia` puts the two together. What is new is who calls it with `coincideFuerte`: the `cambiar` handler, in `servicios.ts`.

#### 3.3.2 The three forms that match and the one that does not

To test it, in the same series A, the current tag is read (now version 2, after Ana's change) and saved in `VIGENTE`. Then a change is sent with that same tag, but marked as weak:

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

`412`, even though the text between quotes is exactly the current one. Notice the body: it does not say the service changed, because it did not change. It says that a weak tag is no good for changing, and that it has to be sent as it arrived. The `revisor` knows this because, when the strong comparison fails, it also tries the weak one: if that one does match, the problem is not that the service changed, but that the client added `W/` to the tag (it can happen without the client having written it: since version 1.7.3, from 2014, the nginx web server turns a strong tag into a weak one when it modifies the response, for example by compressing it, according to its [changelog](https://nginx.org/en/CHANGES); that case has its own complication, explained two paragraphs below). Telling it the service changed would be false, and would send the client to reread in a loop that never ends.

There is a case where the body's advice, "send the `ETag` as it arrived", is not enough: nginx's. If an intermediary was the one that weakened the tag, it **arrived** weak at the client, and sending it as it arrived repeats the `412` on every attempt for as long as the intermediary keeps weakening the tag. That problem cannot be fixed by the client: whoever operates the API has to keep the intermediary from modifying those responses (for example, by not compressing those that carry a tag that will be used for writing) or use tags that survive the modification. That is why the body states the exact cause and not a generic "something failed": the person who reads it knows the problem is in the weak tag, and whom to tell. **The code commands and the body explains, and the two say the same thing**: both say "your condition was not met", and the body adds why.

Now, a list that carries the current tag along with another that does not exist, and then `*`:

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

Both give `200`. The list matches because **some** tag matches. `*` matches because the service exists. And each change raised the version: `"1-3-…"` and then `"1-4-…"`.

What is `If-Match: *` for if it does not protect against someone else's change? For something else: it says "do it only if the resource exists". In an API where `PUT` can **create** a resource, `If-Match: *` prevents creating one by accident when the intention was to change it; and its opposite, `If-None-Match: *`, prevents overwriting one that already existed when the intention was to create it. In the `revisor`, `PUT` never creates (a service that does not exist gives `404`), so `*` only saves the client from reading the tag. That is why **whoever sends `*` gives up the protection against the lost update**. It is valid, the specification allows it, but it is a decision of the client, and it should make it knowingly.

#### 3.3.3 The code of `cambiar`

This is the handler, complete in `servicios.ts` (section 3.9). What matters is in the first lines:

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

It reads in the order of 3.1.3: first `encontrar` (exists or not, for this credential), then `esJson`, which only looks at the `Content-Type` header (`415`), then the condition, and only after that the body. Before reading the body, `cambiar` records **which version matched**, in `versionLeida`; with `If-Match: *` it records `null`, because `*` speaks of no version, it only asks that the service exist. That record looks like too much, because the comparison was already done. The next section shows why it is not.

#### 3.3.4 Two requests at once: comparing and writing in a single step

Between the comparison of the tag and the write, `cambiar` waits twice: `await leerJson(…)`, while the body arrives, and `await destinoPermitido(…)`, while the DNS resolves the URL's name. At each `await`, Node stops serving this request and serves others. If in that gap another `PUT` arrives with the **same** tag, it also passes the comparison, because nobody has written yet. Both requests carry on convinced that the service is as they read it, and whichever writes last overwrites the other. It is the lost update again, now with two clients that **did** send `If-Match` to a server that **did** compare it.

**First, in red.** To see it without depending on luck, one of the two requests has to be left waiting in the gap on purpose. `curl -T -` sends the body it reads from its input, as it arrives; if the input is slow, the request sends its headers right away and waits for the body, precisely at the `await leerJson`. The "slow" one wants to set the limit to 1000 ms and its body arrives a second later; at 0.3 seconds, the "fast" one wants to set it to 3000 ms, with the same tag. The broken version is a separate series, D, and it interrupts series A. If you prefer not to interrupt it, skip this red and run it at the end of the lesson; if you run it now, when you come back you will have to start the `fig03_01/` `revisor` again and repeat series A from 3.2.3 up to here for your responses to match the lesson's.

For the broken version, create the copy **from scratch**: `rm -r rota && cp -R fig03_01 rota`. The `rm` is not superfluous: if `rota/` already exists, `cp -R` puts the folder inside it (`rota/fig03_01/`) and `rota/` stays with the 3.2.2 version. Then make a single change in `rota/servicios.ts`: in `cambiar`, pass `cambiarServicio` `null` instead of `versionLeida`. With that, the comparison at the start is still in place, but when writing nothing is compared any more (full version in `defectos/una-sola-comparacion/servicios.ts`).

**Series D:** stop the `revisor` you have running and start the lab and the `revisor` from `rota/`. Before the race, check that you are running the right copy, because the red result of the race is the same with both broken versions and would not warn you of the mistake. A `PUT` with an invented tag **has to** give `412`, because the comparison at the start is still alive; if it gives `200`, you are running the 3.2.2 copy:

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

`412`: the first comparison works. Now yes, the race:

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

Both received `200`; the slow one printed the service that was returned to it. And the value that ended up is the **slow** one's, 1000, even though the fast one saved first and also received `200`. The fast one's client believes the limit is 3000; the server says 1000; nobody received an error. The comparison at the start was done (the check above proves it), and it was of no use, because by the time the slow one wrote it was no longer true.

If you type the race in your terminal, you will also see a line like `[1] 12345` when launching the slow one, and another warning that it finished (`[1]+ Done …` in bash, `[1] + done …` in zsh): they belong to the shell, which tells you about background jobs, not to the `revisor`.

**Then, in green.** The fix is to compare **again, at the moment of writing**, with no `await` between the comparison and the write. It is what `cambiarServicio` does in `almacen.ts`:

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

It is a **synchronous** function: it has no `await`, so JavaScript runs it from start to finish without serving any other request in the middle. Nobody can sneak in between the `if` that compares the version and the `Object.assign` that writes. If the version is no longer the one `cambiar` recorded, it writes nothing and returns `"conflicto"`, and `cambiar` answers `412`. And if the service is no longer there, because another request withdrew it in the gap, it returns `"retirado"`, and `cambiar` answers `410`; section 3.7.3 provokes it:

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

The same race against this lesson's `revisor`, **in series A**, right after the requests in 3.3.2 (if you ran series D, start `fig03_01/` again and repeat series A from 3.2.3 first; if you do not repeat it, your tag will say `"1-1-…"` instead of `"1-4-…"` and what follows in 3.4 to 3.8 will not match the lesson):

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

The fast one, `200`; the slow one, `412`, with a body different from that of an old tag: the service changed **while** its request was being served. And the value that ended up is the fast one's, 3000, the same one its client believes was left. No write was lost: one was applied, the other was rejected and its client knows it.

Why not move the whole comparison to the end and compare only once? It would close the gap just the same, but it would force waiting for the complete body and querying the DNS for a tag that is already known to be stale from the first line. That is why `cambiar` compares twice: at the start, to cheaply reject what arrived already expired; when writing, so as not to accept what expired on the way.

**The equivalent in a database.** A real API does not store its data in a `Map`, but the problem and the solution are the same. Reading the version with a `SELECT` and then writing with a separate `UPDATE` leaves the same gap between the two statements. The usual way is to put the version in the write's condition: `UPDATE servicios SET … , version = version + 1 WHERE id = 1 AND version = 4`. The database compares and writes in a single operation, and reports how many rows it touched; if it touched zero, another got there first, and the response is `412`. `cambiarServicio` is exactly that, written in memory. And an honest limit: the atomicity of a synchronous function holds within **one** Node process. If the `revisor` ran in several instances (processes, replicas behind a load balancer), each with its own `Map`, there is no longer a single place to compare and write; that comparison has to live where the data is shared, in the database, with the `UPDATE … WHERE version = N`.

### 3.4 `412` versus `428`

#### 3.4.1 When the client does not send the condition

Everything above works if the client sends `If-Match`. And if it does not? For the server, a `PUT` without a condition is exactly the `PUT` of the opening scene: writing without knowing on top of which version. It could accept it, and then the protection depends on every client remembering to send the header. Or it can **require it**.

That is what the **`428 Precondition Required`** exists for, which is not in RFC 9110 but in [RFC 6585, section 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3), from April 2012. Its definition is one line: the origin server **requires the request to be conditional**. And the next sentence says what for: its typical use is to avoid the lost update problem, where a client GETs a resource's state, modifies it, and PUTs it back to the server, when meanwhile a third party has modified the state on the server. The RFC adds two rules: the response **SHOULD** explain how to resubmit the request successfully (its own example says "try `If-Match`"), and **MUST NOT** be stored by a cache.

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

The body says what to do, as the RFC asks: send `If-Match` with the `ETag`. To know which one, the client has to read the service first, which is precisely what it failed to do.

#### 3.4.2 The difference in a table

| | `412 Precondition Failed` | `428 Precondition Required` |
|---|---|---|
| Did the condition come? | yes | no |
| What happened? | the condition was evaluated and turned out false | there is nothing to evaluate |
| What does it say? | "the resource changed since you read it" (or your tag is no good) | "I do not write without knowing which version you read" |
| What does the client do? | reads again, redoes its change on the new copy, sends the new tag | reads, and sends the tag |
| Can it repeat the same request as is? | no: it will get `412` again | no: it will get `428` again |
| Defined in | RFC 9110, section 15.5.13 | RFC 6585, section 3 |

Both responses send the client to **read**, but for different reasons, and a program treats them differently: after a `412`, the program has to **merge** its change with what it found, because someone else wrote; after a `428`, it was only missing a step, and what it finds on reading is the same as what it already had. That is why they are not merged into a single code.

Why does the `revisor` require the condition instead of just recommending it? Because in an API that manages shared configuration, like the list of services a team watches, a lost update does not warn: it is discovered hours later, as in the scene. Requiring `If-Match` costs the client one read; not requiring it may cost a night without monitoring. It is a design decision, not an HTTP obligation: RFC 6585 allows requiring it, it does not oblige you to. There are APIs that decide otherwise, and you will see it in 3.5.3.

### 3.5 State conflict: `409`

#### 3.5.1 The repeated name

The `revisor` has a rule: within a team, two services cannot have the same name. It is a reasonable rule (the name is what is read on dashboards and in alerts, and two "pagos" would confuse anyone), and it is a rule **about state**: it does not depend on the name itself, but on which other services exist. This is what it looks like when team a tries to register a second `pagos`:

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

`409 Conflict`. The body fulfills the **should** of section 15.5.10: it says what it clashes with (`/servicios/2`), so the client can recognize the source of the conflict and decide: change the name, or query the service that already exists because maybe it is the one it was looking for. Lesson 5 will put that address in a field of its own in the body, `existente`, so a program can read it without interpreting the sentence.

The same happens in a change that tries to give a service another one's name. Here the client sends `If-Match: *`, so the condition is met; what fails is what comes after:

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

And the proof that it is a state conflict and not a rule about the data: the **same** registration request, byte for byte, with team b's credential, which has no `pagos`:

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

`201`. The data was valid; what changed was the state they were compared against. That is the `409`'s acid test: **if the same request could work at another time or in another context without changing anything about it, the failure is about state, not data.**

#### 3.5.2 `409` and not `422`, `409` and not `412`

Why not `422`? Because `422` says "what you sent cannot be fulfilled", and a client that receives it fixes its data. Here the data has nothing to fix. There are large APIs that decide otherwise: GitHub's answers `422` with the code `already_exists` when another resource already uses the same unique value, such as a label's name ([its REST API documentation](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api)). It is a coherent decision within their API, and it is documented; the course prefers `409` because the specification describes it precisely for the conflict that the user can resolve and resubmit.

Why not `412`? Because the client set no condition. The `412` answers a conditional header that the client sent and that turned out false. The client registering `pagos` did not say "create it only if there is no other with that name"; the server has that rule on its own. When the rule belongs to the server and the clash is with the state, the code is `409`.

#### 3.5.3 When the version travels in the body

There is a case where the boundary between `409` and `412` moves, and section 15.5.10 itself mentions it: it says conflicts are most likely to occur in response to a `PUT`, and gives as an example a **versioned** API in which the representation sent contains changes that conflict with those made by an earlier request from a third party. That is the lost update. So is the lost update `409` or `412`?

It depends on **where the condition travels**:

- If the version the client read travels in a **conditional header** (`If-Match`), the server evaluates an HTTP precondition, and if it fails, the response is `412`. It is what the `revisor` does.
- If the version travels **inside the body** (a field `"version": 7` in the JSON), for HTTP there is no precondition at all: it is part of the data. The server discovers the clash when comparing the body with its state, and the response is `409`.

Both forms exist in real APIs. Google's design guides ([AIP-154](https://google.aip.dev/154)) put the etag as a field of the resource and ask to answer `ABORTED` when it does not match, an error that their equivalence table translates to `409 Conflict`; the same table maps `INVALID_ARGUMENT` and `FAILED_PRECONDITION` to `400` ([`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto)). And AIP-154 does not require the etag: it lets a request without it through, except in services that need strict consistency. Zalando's API design guidelines, by contrast, consider `ETag` with `If-Match` as an option (their rule 182 is a "may", not a "must"), and their table of codes assigns `412` to the condition that fails and `428` to the condition that is required ([*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/)). The course follows the second form because it uses the machinery HTTP already provides for this, and because any intermediary on the way understands a standard header; a `version` field in the body is understood only by your client.

One more note about the `409`, so as not to confuse it later: in [Lesson 6](06-reintentos-idempotencia.md) another `409` appears, when a request arrives with an `Idempotency-Key` header while the original with the same key is still in progress. That behavior comes from an IETF draft, `draft-ietf-httpapi-idempotency-key-header-07`, which expired on April 18, 2026 without being published as an RFC: **it is not a standard**, and Lesson 6 treats it as what it is. It is another conflict with the current state, and that is why the draft chose the same code.

### 3.6 Business rule: `422`, and the policy of `400` versus `422`

#### 3.6.1 The written policy

In Lesson 2, everything in the body that was of no use answered `400`. From this lesson on, the `revisor` separates two cases, and it does so with a written rule, because it is one of the two decisions the course takes as **policy** and not as intuition:

- **`400 Bad Request`: it cannot be read.** The body is not JSON, or is JSON but is not an object (`null`, a number, a string, a list). There is no way of knowing even which fields it carried. (A body of more than 16 KiB is not even finished being read: the `revisor` stops storing it as soon as it passes that limit and answers `413 Content Too Large`, so that nobody fills its memory with a giant body.)
- **`422 Unprocessable Content`: it is read, but it cannot be fulfilled.** The body is a JSON object, it is understood which fields it carries, but one is missing, has the wrong type or an out-of-range value, or the address points to a forbidden destination.

The `revisor`'s rules are four: `nombre` is a string of 1 to 40 characters; `url` is an `http` or `https` address; `limite_ms`, if present, is an integer from 100 to 10,000 (if absent, it is 2000); and the destination of `url` cannot be a private or reserved address (Lesson 1's SSRF).

The middle rule is worth it: **all the failures are collected, not just the first.** A client that receives "the name is wrong", fixes it, receives "the address is wrong", fixes it, and receives "the limit is wrong" made three trips for something that could be said in one. This is what the three failures together look like, and the `400` of a body that is not an object:

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

One line per field, each with the field's name in front. Lesson 5 turns those lines into an `errors` list with a `pointer` per field (`"#/nombre"`), like the example in [section 3 of RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html#section-3), so that a form can mark each field without interpreting text.

The wrong type is also `422`, even though it resembles a reading problem. Here `limite_ms` arrived as text (`"2000"`), not as a number:

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

The JSON was read without problem; what it fails to meet is the rule "integer from 100 to 10,000". If the `revisor` converted the text to a number on its own, it would also accept `"2000abc"` or `" 2000 "` depending on how it converted it, and each client would learn a different rule. It is better to say exactly what was expected.

#### 3.6.2 The forbidden destination is also `422`

Lesson 1's defense against SSRF stays the same, but changes code. It used to answer `400`, because `422` did not exist yet; now the URL reads perfectly, it is a valid `http` address, and what cannot be fulfilled is the rule "the `revisor` does not connect to private or reserved addresses":

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

The text is the same as in the earlier lessons. In the second case, the message says only that `localhost` resolves to a private or reserved address, without listing which ones: what a name resolves to changes depending on the system, and the list would reveal the server's internal network to the client without being of any use to it.

#### 3.6.3 Other guides decide differently

The course's policy is not the only reasonable one, and it is worth knowing what others do, because you will run into APIs on both sides:

- **Zalando**'s guidelines say `400` should also be used when the body fails business or semantic validation, "instead of using `422`", and mark `422` as "do not use": according to them, `400` already covers almost all cases and they see no clear benefit in telling them apart.
- **Google**'s translate their invalid-argument errors (`INVALID_ARGUMENT`) to `400`.
- **GitHub**'s API, as you saw in 3.5.2, uses `422` for validation, and even for repeated values.

The course keeps the "read versus fulfill" boundary for a reason that has to do with whoever receives the error: a `400` tells the client that **something in the form** of its request is broken, normally a programming error that has to be fixed in code; a `422` tells it that the form is fine and that **the values** are not accepted, normally something a person typed and that can be shown to them in a form. They are two different actions, and the specification has a code for each. What matters more than the exact boundary is for the API to **write it down** and apply it the same way across all its routes: a client can adapt to either policy; to an API that uses both at random, it cannot.

### 3.7 The resource that left: `410` versus `404`

#### 3.7.1 What the `404` does not say

In Lesson 2, withdrawing a service deleted it from the store, and afterwards its identifier answered `404`, just like one that never existed. For the client, the two situations are very different. If a service **never existed**, perhaps the client got the number wrong and it is worth checking. If it **existed and was withdrawn on purpose**, there is nothing to check: you have to stop requesting it, delete it from the configuration, remove the link from the dashboard.

[Section 15.5.5 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5) says a `404` **does not indicate** whether the lack is temporary or permanent, and that `410` is preferred if the server knows the condition is likely permanent. [Section 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11) defines the **`410 Gone`**: the resource is no longer available at the origin server, and this condition is likely to be permanent. If the server does not know, or has no way of knowing, whether it is permanent, it should use `404`. And it explains the intent: to signal that the resource was **deliberately removed** and that its owners want links to it removed.

To be able to answer `410`, the `revisor` has to **remember** what it withdrew. That is why `almacen.ts` now has a second map, `retirados`, which stores the id of each withdrawn service together with the team it belonged to. This is how it answers:

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

Service 2 was withdrawn: `410`, and the body says it bluntly, "it will not come back". 99 never existed: `404`. The client can now treat each case differently just by looking at the code.

Two more details from the specification. First, the `410` is **cacheable by heuristic**, just like the `404`: a cache may store it even if it carries no cache instructions, and that is correct, because the resource will not come back. Second, it is not mandatory to mark everything withdrawn as `410` nor to remember it forever: the specification leaves it to the discretion of whoever operates the server. The `revisor` remembers it while it is on; since it keeps everything in memory, after restarting it a withdrawn service gives `404` again. In an API with a database, the row would be marked as withdrawn instead of being deleted.

#### 3.7.2 The `410` is not told to just anyone

The `410` says something more than "it isn't there": it says "it **was** there". That, for someone who was not supposed to know it existed, is information. In Lesson 2 the `revisor` decided that another team's service answers `404`, just like one that does not exist, so nobody can enumerate what belongs to others by comparing responses. If now team a's service 2 answered `410` to anyone, team b could walk through the identifiers and learn which ones existed in team a and when they were withdrawn. That is why `encontrar` answers `410` only **to the owning team**; to the others it answers the same `404` as always:

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

The same `404`, with the same text as for service 99. For team b, service 2 never existed, which is what team b was allowed to know. This is the function that decides, in `servicios.ts`:

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

A single function for querying, changing, withdrawing, and requesting a check: that way no handler can forget the team comparison, and the `410` and the `404` always come out of the same two lines. "The error you will see" shows what happens if `delEquipo` is removed from the second condition.

#### 3.7.3 The `410` beats the condition

A `PUT` with `If-Match: *` to a withdrawn service. `*` means "if it exists"; the service does not exist, so the condition would be false and we could expect a `412`:

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

It is `410`, because of the rule in 3.1.3: section 13.2.1 asks to ignore preconditions if, without them, the response would not have been a `2xx` or a `412`. Without `If-Match`, this `PUT` would have received `410`; so the condition is not even evaluated. And it is the most useful response: a `412` would send the client to reread, and on rereading it would receive `410` anyway.

The same holds when the withdrawal happens **during** the change, in the gap from 3.3.4. A service, `efimero`, is registered, and its address and tag are saved. Then, the same race as before, with another rival: while a slow `PUT` waits for its body, a `DELETE` withdraws the service:

```text
$ ID=$(curl -sS -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/5 ETAG="5-1-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}' ) | curl -sS -w 'lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -sS -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
el servicio 5 se retiró y no va a volver
lento: 410
```

The `DELETE` arrived in the gap and answered `204`. When the slow `PUT` finally wrote, `cambiarServicio` no longer found the service, returned `"retirado"`, and the response was `410`, with the same body as a `GET` to a withdrawn service: as if the `PUT` had arrived after the withdrawal, which is what really happened to it. A `412` here would send the client to reread, only to meet the `410` on the next request; with the `410` it finds out the first time.

### 3.8 API versions: the announced `410`

#### 3.8.1 Withdrawing a version without surprising anyone

A withdrawn service is a small case of the same problem that every growing API has: **retiring an old version**. The `revisor` has three generations of routes:

- `/servicios`: the current version.
- `/v1/servicios`: the previous version. It still works, but it is **deprecated**: it spoke of `direccion` instead of `url`, and of the limit in seconds (`"limite": 3` for 3000 ms) instead of milliseconds.
- `/v0/…`: the first version, already **withdrawn**. Any of its routes answers `410`.

If one day `/v1` went from answering `200` to answering `410` without notice, each client still using it would find out through an error in production. The right thing is to warn **beforehand**, in every `/v1` response, so whoever uses it has time to migrate. There are two headers for that, and they do not carry the same weight:

- **`Deprecation`**, from [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html) (March 2025, an IETF **proposed standard**). Its value is the date on which the resource **became or will become** deprecated; it may be in the past ("it became deprecated on that date") or in the future ("it will be"). The date goes in the format of HTTP structured fields: `@` followed by the seconds since January 1, 1970 (section 2.1).
- **`Sunset`**, from [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html) (May 2019, an **informational** document, not standards track). Its value is the date on which the resource **will likely stop responding**, in HTTP's usual date format (`Sun, 31 Jan 2027 00:00:00 GMT`). It was published as an individual submission by its author, reviewed by the IETF but without going through a working group ([its page in the IETF datatracker](https://datatracker.ietf.org/doc/rfc8594/)).

That one is a proposed standard and the other informational does not change how they are used; it changes how much you can expect clients and tools to know them. And neither obliges anything: they are **warnings**. RFC 9745 says in its section 5 that deprecating a resource does not change its behavior: whoever uses it can keep using it the same. RFC 8594, in its section 3, says clients **should** treat `Sunset` as a hint: there is no guarantee that the resource will work until that date, nor that it will stop working after it.

To the two is added a link: RFC 9745 registers the `deprecation` relation for the `Link` header (section 3), which points to the documentation of the deprecation, for example the migration guide. This is how the `revisor`'s `/v1` answers:

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

The data is service 1's, in the old format: `direccion` instead of `url`, and `"limite":3`, the 3000 ms left by the "fast" request of the 3.3.4 race, now in seconds. And the three headers go in all of `/v1`'s responses, the query and the list: the deprecation belongs to the resource in which the header appears (section 2.2 of RFC 9745), so every deprecated route carries it.

#### 3.8.2 The rule of order: `Sunset` never before `Deprecation`

The two dates tell a story in order: first the version **stops being recommended** (deprecation) and, later, **stops responding** (sunset). [Section 4 of RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html#section-4) makes it a rule with a **must not**: the `Sunset` date must not be earlier than the `Deprecation` one. If it is (through a configuration mistake, says the RFC), whoever develops the client should consult whoever operates the resource to clarify it.

The rule makes sense even though both are warnings. A sunset earlier than the deprecation would say "this version stops responding on Monday, and is deprecated on Friday", which is a contradiction: nobody would have time to migrate between one notice and the other, because the second arrives when there is nothing left. RFC 8594 explains it from the other side in its section 1.4: deprecation usually happens in two stages, first "it is no longer the recommended version" and then "it is taken down", and `Sunset` is only useful for the second.

In the `revisor`, `/v1` was deprecated on July 1, 2026 (`@1782864000`) and stops responding on January 31, 2027: seven months of margin. Exercise 4 asks you to check it with a program, which is what any client that reads those warnings should do.

#### 3.8.3 And at the end, the `410`

When the date arrives, the version is withdrawn and starts answering `410`. It is what has already happened to `/v0`:

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

`410` with any credential and also with none, on any route that starts with `/v0`. Notice that the question "is it `/v0`?" goes in the entry point **before** the credential, next to the old redirects: a withdrawn version has nothing to protect, and an old client that does not even know how to authenticate with the current scheme deserves to know the version is gone, not that it lacks a credential. The body says when it was withdrawn and where to go. It is the same reasoning as a service's `410`, on a large scale: the client must not review its code looking for an address error; it must migrate.

The `410` is the end of the story, not the beginning. An API that retires a version by answering `410` the first day anyone hears about its withdrawal did things backwards: the `410` arrives **after** months of `Deprecation` and `Sunset` in every response, and of a link with the migration guide. Lesson 8 documents these warnings in the API's OpenAPI description, with `deprecated: true` on what is being withdrawn.

### 3.9 The complete `revisor`

#### 3.9.1 The files that change

This lesson's `revisor` lives in the folder `~/curso-http/fig03_01/`. If you have the folder from Lesson 2, copy it with that name and change four files: one new, `versiones.ts`, and three modified, `almacen.ts`, `rutas.ts`, and `servicios.ts`. They go here in full.

`versiones.ts` is new. It has the two old versions: `/v1`, with its three warnings in `AVISOS` and its old way of representing a service, and `/v0`, which answers `410` to everything:

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

In `almacen.ts` there are three new functions and one changed: `retirarServicio` no longer just deletes, it also **remembers** the withdrawal in `retirados`, with the team; `equipoDeRetirado` queries it; `buscarPorNombre` looks up a name within a team, for the `409`; and `cambiarServicio(id, versionLeida, datos)` compares the version and applies the change in a single step, with no `await` (3.3.4): if the version is no longer the one that was read, it returns `"conflicto"`; if it is, it writes and **raises the version**, which is what invalidates the old tag:

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

In `rutas.ts` three things change: the route `/servicios/{id}` now admits `PUT` (and that is why the `Allow` of a `405` on that route becomes `GET, HEAD, PUT, DELETE`); there are two new routes for `/v1`, read-only; and before looking for the route, `versionRetirada` serves `/v0`:

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

And `servicios.ts`, where almost everything in this lesson is: `encontrar` (3.7.2), `validar` and `rechazarDatos` (3.6.1), the `409` in `darDeAlta` and `cambiar` (3.5.1), `esJson`, which separates the question about the format from the JSON reader so the `PUT` can ask it before the condition (3.1.3), and `cambiar` with its `415`, its `428`, its `412` for a stale tag (3.3.3), and its second `412`, the one for the race (3.3.4), or its `410` if it was withdrawn in the gap (3.7.3). `encontrar` is now exported because `versiones.ts` uses it too. `representar` was also left exported, although in this lesson no other file imports it: `/v1` has its own `representarV1`:

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

Notice the order inside `darDeAlta` and `cambiar`: first `validar` (`422`), then the destination (`422` too), and at the end the repeated name (`409`). The rules about the data go before the clash with the state: there is no point checking whether a service with that name already exists if the name is not valid anyway.

#### 3.9.2 The files that do not change

The other files are Lesson 2's, without a single change. They go in full so the `revisor` can be assembled from this lesson. `etiquetas.ts` is the one that does the strong comparison that `cambiar` uses:

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

#### 3.9.3 The complete run

Open two terminals in `~/curso-http/fig03_01/`. In the first, the lab; in the second, the `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

In a third terminal, these are all the requests from sections 3.2 to 3.8, in the order in which they appeared, with what they answered. They are together so you can compare them straight through with yours; remember that the tags will end up different:

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

Thirty-one lines. The twenty-four complete responses, those of `curl -i`, gave `[200 200 412 412 200 200 428 409 409 201 422 400 422 422 422 204 410 404 404 410 200 200 410 410]`; the 3.3.4 race gave `rápida: 200` and `lenta: 412`; the 3.7.3 one, `DELETE en el hueco: 204` and `lento: 410`; and the five lines that save a tag (`ETAG` twice, `VIGENTE`, and `ID` with `ETAG` in 3.7.3) or read the service without `-i` print no code. Every error in this lesson arrived **after** passing the seven questions of Lesson 2's entry point: all carried a correct route, method, credential, and permission, and still could not be fulfilled.

The `revisor`'s terminal logged each request, in the same order:

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

## The error you will see

### The two `200`s that should not have gone out

You already triggered the two most important broken versions of this lesson in the lesson's body, because they are its heart: the `PUT` that asks nothing (3.2.2) and the one that asks only once (3.3.4). Both fail the same way, and it is worth saying exactly what is wrong in the response, because it is not visible in any header: it is a `200` that promises something false. A `200` to a `PUT` tells the client "your change was applied on top of what you read". In both defects, the second `200` was applied on top of something its client never saw, and erased someone else's change. The fix is also the same in both cases, in two parts: require and compare the condition before reading the body (`428` and `412`), and compare the version again in the same step in which it is written (`412` again). One of the two is missing, and the opening scene returns.

### The `410` that gives away

The second defect is subtler, because it is born of wanting to do things right. Someone reads section 15.5.11, decides that every withdrawn service deserves its `410`, and simplifies `encontrar`'s condition by removing the team comparison from it (full version in `defectos/410-para-todos/servicios.ts`):

```ts
  if (servicio === undefined && equipo !== undefined) {
    fallar(respuesta, 410, `el servicio ${id} se retiró y no va a volver`);
```

**Series E:** create `rota/` from scratch (`rm -r rota && cp -R fig03_01 rota`), put that version in `rota/servicios.ts`, and start the lab and the `revisor` from `rota/`. Team a withdraws its service 2, and team b asks for 2 and for 99:

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

Team b never had access to service 2, but now it knows it existed and no longer exists; and it knows 99 never existed. It is the enumeration from Lesson 2's callout, through a new path: two different responses for two identifiers that belong to others. With a script like Lesson 2's enumerator, team b could walk through the identifiers and learn how many services each team has withdrawn. The fix is to give the condition back its `delEquipo(equipo, credencial)`: the `410` is for whoever could see the resource when it existed, and for everyone else, the same `404` as always.

## Common mistakes

**`400` for everything that cannot be fulfilled.** The client cannot tell "your JSON is broken" from "your name is repeated" from "you wrote on top of an old version", and each is fixed differently. If the API decides to use `400` for validation too, as some guides recommend, at least let the conflict (`409`) and the precondition (`412`) have their code.

**A `PUT` without a condition on a shared resource.** It is the lost update waiting to happen. It does not fail in tests, because tests almost never have two editors at once; it fails in production, silently, with a `200` for each.

**Comparing the version only at the start.** If between the comparison and the write something waits (reading the body, querying the DNS, calling another service), another request with the same tag passes too, and the last to write overwrites the other with a `200`. The version is compared again in the same step in which it is written, like an `UPDATE … WHERE version = N`.

**Comparing `If-Match` weakly, or as text.** Weakly, `W/"1-2-…"` would pass as good, and the specification forbids it with a **must**. As text, a list `"9-9", "1-2-…"` or a `*` would give `412` even though the condition is met.

**`409` when `If-Match` fails.** The client set a condition in a header and it was not met: that is a `412`. The `409` is for the clash with the state that the client did not express as a condition, or for when the version travels inside the body.

**`412` when `If-Match` is missing.** Without a condition there is nothing that failed. The client that receives `412` believes someone changed the resource and rereads looking for the other person's change; with `428` it knows it only failed to send the tag.

**A `409` that does not say what it clashes with.** Section 15.5.10 asks that the body let the source of the conflict be recognized. A bare "conflict" leaves the client guessing which field to change.

**Sending only the first validation failure.** Three trips to fix three fields, when a `422` with the complete list solved it in one.

**`410` for everyone, or `404` forever.** The first gives away what existed to someone who could not see it; the second makes the owner of a resource that was withdrawn on purpose look for an address error.

**Withdrawing a version without warning, or with the warnings reversed.** A `410` without months of earlier `Deprecation` and `Sunset` gets discovered in production. And a `Sunset` earlier than the `Deprecation` violates section 4 of RFC 9745 and gives nobody time to migrate.

**Presenting `Deprecation` or `Sunset` as obligations.** They are warnings the client can read; the deprecated resource behaves the same as before, and the `Sunset` date is a hint. A well-made client records them and alerts whoever maintains it; it does not stop working on seeing them.

## Exercises

All four correct themselves: each ends with a run that tells you whether you got it right. Write your prediction in the [log](bitacora.md) **before** running anything. They are **series F**: for all of them you need the lab and the 3.9 `revisor` running, freshly started, and the four are run in order, one after another, without restarting between them except where the exercise asks.

### Exercise 1 — Conflict, rule, or precondition?

Without running anything, predict the code of each of these nine requests, and for each error say whether it is a state conflict, a business rule, a precondition, or something that Lesson 2's entry point or section 3.7 already resolved. The second one's name has 41 x's:

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

The fourth and fifth have a trap: each carries two problems. Which one is asked first?

### Exercise 2 — The tag that did not survive the restart

Save service 1's tag in a variable, **stop the `revisor` and start it again** (`Ctrl`+`C` and `node servidor.ts`), and send a change with the earlier tag:

```bash
ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ANTES=$ANTES"
# aquí detienes y vuelves a arrancar el revisor
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ANTES" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
```

Predict the code. Then answer two questions. Nobody changed service 1 between the read and the write: why is it correct for the `revisor` to refuse? And what would be wrong with a body that said only "someone changed the service"?

### Exercise 3 — Two failures in one request

Without restarting, save service 1's current tag in `AHORA` and send two changes with the same invalid body: one with an invented tag and another with the current one. At the end, read the tag again:

```bash
AHORA=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "AHORA=$AHORA"
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-7-00000000"' -d '{"nombre":"","url":"ftp://archivos"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $AHORA" -d '{"nombre":"","url":"ftp://archivos"}'
curl -sS -o /dev/null -w '%header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
```

Predict the two codes and whether the tag at the end is equal to `AHORA`. Why does the first one not mention the empty name?

### Exercise 4 — Read the warnings with a program

Write a program, `fig03_03.ts`, that requests a route from the `revisor` with `lectura-a` and says: since when it has been deprecated, when it stops responding, where to read more, and whether the two dates are in the order that section 4 of RFC 9745 requires. If the route carries no warnings, have it say so. Test it with `/v1/servicios` and with `/servicios`. Hint: the value of `Deprecation` is `@` followed by seconds, and JavaScript's `new Date(text)` understands the format of `Sunset`.

## Solutions

### Solution 1

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

In order:

1. **`409`, state conflict.** `catalogo` is a valid name; one already exists in team a.
2. **`422`, business rule.** The name has 41 characters; the rule says 1 to 40. No server state would make it valid.
3. **`412`, precondition.** The condition does not match the current tag (`"1-1-00000000"` is not yours; yours ends with the eight digits of this startup).
4. **`415`, not `428`.** Two things are missing, the format and the condition. The format is known from a header, `Content-Type`, without processing the body, and section 13.2.1 asks that what is detected before processing the content win over preconditions. If the client fixes the `Content-Type`, the next response will be `428`.
5. **`415`, not `412`.** Now the condition does come, and in addition it is stale (`"1-0-0"` is no version of the service). It does not matter: the wrong format is known first, and with it the `revisor` does not even evaluate `If-Match`. If the client fixes the `Content-Type`, the next response will be `412`.
6. **`404`, Lesson 2's entry point.** Service 3 belongs to team b; for team a it does not exist.
7. **`410`, withdrawn version.** Without a credential: `/v0` is served before asking who you are.
8. **`204`.** Team b withdraws its service 3.
9. **`404`, not `410`.** Service 3 was withdrawn, but it belonged to team b. For team a it never existed, and still does not: the `410` is only for the owner.

### Solution 2

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

`412`, and it is correct: the tag the client sends is not the current one. After the restart, service 1 has the tag `"1-1-…"` with another eight digits, because the `revisor` draws a new identifier on each startup. The specification does not ask the server to know **why** the tag does not match; it asks it not to run the method if it does not match. And the action the code indicates to the client, read again and redo its change on what it finds, is the right one: the `revisor` that served its read no longer exists, and neither does what the client believed it knew about it. On a server with a database the service would have survived the restart, but on this one, which keeps everything in memory, nothing guarantees that today's service 1 is the same as the earlier one.

A body that said only "someone changed the service" would be **false** in this case: nobody touched it. That is why the `revisor` states both possible causes, "the service changed or the revisor restarted", and the action, "read it again before changing it". The code decides what to do; the body, if a person reads it, does not send them looking for a change that does not exist. To check that the new tag does work, read it and use it: it is the first thing exercise 3 does.

### Solution 3

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

The first is **`412`**: the condition is evaluated before reading the body (section 13.2.1), and since it is not met, the body is not even examined. That is why it does not mention the empty name: telling the client its name is wrong is of no use if what it has to do first is reread; when it rereads, perhaps the service already has another name and its whole change is a different one. The second is **`422`**: the condition is met, the body is read, and the two failures appear together, as the policy in 3.6.1 asks. And the tag at the end **is equal to `AHORA`**: neither of the two `PUT`s changed anything, so the version did not go up. A rejected change does not spend the tag; the client can fix its data and send it again.

### Solution 4

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

`await respuesta.body?.cancel()` discards the body without reading it, because the program only needs the headers. The regular expression `^@(-?\d+)$` accepts exactly the structured-field date form; anything else is reported as invalid, instead of being turned into some arbitrary date. The same goes for `Sunset`, and for a subtler reason: `new Date("proximo-mes")` throws no error, it produces an invalid date, and it is `toISOString()` that later throws `RangeError: Invalid time value` and brings the program down. That is why the program asks `Number.isNaN(hasta.getTime())` before using it. Tested against a toy server that answered `Sunset: proximo-mes`, the program does not crash: it prints `Sunset no es una fecha válida: proximo-mes`, then `desaprobada desde: 2026-07-01T00:00:00.000Z` and `deja de responder: (no lo dice)`, and ends with code 0. And the final comparison is the rule in section 4 of RFC 9745: if one day `/v1`'s configuration sets a `Sunset` earlier than the `Deprecation`, the program says so instead of staying silent. A real client would do something more useful with this than print it: record it in its log and warn whoever maintains it, once, not on every request.

## How I know I succeeded

- [ ] For a failing request, you say whether it is a state conflict, a business rule, or a precondition, and you answer `409`, `422`, or `412` with the question that decides it.
- [ ] `node fig03_02.ts` against the 3.9 `revisor` ends with "el cambio de Ana sigue ahí", and against `rota/` without the condition, with "SE PERDIÓ el cambio de Ana".
- [ ] The 3.3.4 race gives `rápida: 200` and `lenta: 412` and leaves `"limite_ms":3000` against the 3.9 `revisor`, and `200` and `200` with `"limite_ms":1000` against the copy that passes `null` to `cambiarServicio`.
- [ ] A `PUT` to `/servicios/1` without `If-Match` gives `428` with a body that says which header to send; with a stale tag it gives `412`; with `W/` in front of the current one it gives `412` with the notice that it is weak; with a list that contains it, or with `*`, it gives `200` and a new `ETag`.
- [ ] A `PUT` with `Content-Type: text/plain` gives `415`, with a stale tag or with none.
- [ ] A registration of `pagos` with `escritura-a` gives `409` and says which service it clashes with; the same request with `escritura-b` gives `201`.
- [ ] A registration with `{"nombre":"","url":"ftp://archivos","limite_ms":5}` gives `422` with three lines, and one with `["inventario"]` gives `400`.
- [ ] After withdrawing service 2, team a receives `410` and team b receives `404`, with the same body as that of a service that never existed.
- [ ] `/v1/servicios/1` carries `Deprecation`, `Sunset`, and `Link`, and `node fig03_03.ts /v1/servicios` says the order is correct; `/v0/servicios` gives `410` without a credential.
- [ ] When you finish, no program is left listening: `curl -i http://127.0.0.1:18080/` gives error 7.

## Summary

Answer without looking at the lesson:

1. What question decides between `409`, `412`, and `422`? Give a `revisor` example for each.
2. What is the lost update, and at which of the four steps does it occur?
3. If the `revisor` already compared `If-Match` at the start, why does it compare the version again when writing? What is the equivalent in a database?
4. Why is `If-Match` compared strongly, and what does the `revisor` answer to a `W/` tag that would match weakly?
5. What does a client have to do after a `412`, and what after a `428`? Why is it not the same?
6. Why is the condition evaluated before reading the body? Which section of RFC 9110 says so?
7. When is a lost update answered with `409` and not `412`?
8. What is the course's policy for `400` versus `422`, and what do other guides decide?
9. What does a `410` say that a `404` does not? Why does the `revisor` not say it to everyone?
10. Which date does `Deprecation` give, which does `Sunset` give, how much weight does each RFC carry, and what rule relates the two dates?

## Sources

All consulted on October 21, 2026.

1. [RFC 9110, *HTTP Semantics*, section 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10): the `409`, the conflict with the current state that the user can resolve, the content that lets its source be recognized, and the example of versions in a `PUT`.
2. [RFC 9110, section 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11): the `410`, the probably permanent condition, the deliberate removal, caching by heuristic, and the freedom not to mark it forever.
3. [RFC 9110, section 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5): the `404` does not say whether the lack is temporary or permanent, and `410` is preferred when the server knows it is permanent.
4. [RFC 9110, section 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13): the `412`, a condition from the headers that evaluated to false.
5. [RFC 9110, section 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1): `If-Match`, its form (`*` or a list), the mandatory strong comparison, the three evaluation steps, and the lost update.
6. [RFC 9110, sections 13.2.1 and 13.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1): when preconditions are evaluated (before processing the content, after the normal checks) and in what order.
7. [RFC 9110, section 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2): the strong and weak comparison of tags, with its table.
8. [RFC 9110, section 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21): the `422`, content that is understood and has correct syntax but cannot be processed; and [section 9.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4), `PUT` as replacement of the whole state.
9. [RFC 6585, *Additional HTTP Status Codes*, section 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3): the `428`, the conditional request required against the lost update, the explanation of how to resubmit, and the prohibition on caching it.
10. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (March 2025, proposed standard): the deprecation date as a structured-field date (2.1), its scope (2.2), the `deprecation` relation for `Link` (3), the rule that `Sunset` not be earlier (4), and that deprecating does not change behavior (5).
11. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (May 2019, informational): the date on which the resource will likely stop responding, as a hint (3), and the two stages of deprecation (1.4); its [page in the IETF datatracker](https://datatracker.ietf.org/doc/rfc8594/), which shows it as an individual submission.
12. [RFC 9457, *Problem Details for HTTP APIs*, section 3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3): the example with the `errors` extension and a `pointer` per field, which Lesson 5 adopts for the `422`.
13. [IANA HTTP Status Code Registry](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml): the official names of the five codes, among them `422 Unprocessable Content` and `428 Precondition Required`.
14. [*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/): `400` also for business validation and `422` as "do not use"; `412` for optimistic concurrency with `If-Match` and `428` for requiring it.
15. [Google, AIP-154 *Resource freshness validation*](https://google.aip.dev/154) and [`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto): the etag as a field of the resource, `ABORTED` (`409`) when it does not match and `INVALID_ARGUMENT` (`400`) for invalid arguments; and the [GitHub REST API documentation](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api), which answers `422` to validation and to repeated values (`already_exists`).

### Terms in this lesson

| | |
|---|---|
| **lost update** | when a client saves its old copy of a resource and, without knowing it, erases the change another made after it read |
| **optimistic concurrency** | letting everyone read and edit without locking, and rejecting only the write that arrives on top of an old version |
| **state conflict** | a valid request that clashes with what already exists on the server; in another state it would work as is (`409`) |
| **deprecated** | no longer recommended for use, even though it still works |
| **precondition** | a condition the client puts in a header (`If-Match`) so that the method only runs if it is met (`412` if not) |
| **business rule** | a condition on the data's values, which does not depend on the server's state (`422` if not met) |
| **sunset** | the moment when a resource or a version stops responding |

---

**Previous:** [Lesson 2 — The client made a mistake (I): 400, 401, 403, 404, 405, and 415](02-errores-del-cliente-peticion.md) · **Next:** [Lesson 4 — Server capacity and failures: 429, 500, 502, 503, and 504](04-capacidad-y-fallas-del-servidor.md)

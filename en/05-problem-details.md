# Lesson 5 — Problem Details (RFC 9457)

It is 3:20 AM on a Thursday and the integrations team's dashboard says that the `pagos` service has disappeared. It has not disappeared: it is still in the `revisor`, with its id 2 as always. What happened is sillier and more expensive. Two weeks ago someone wrote a script that synchronizes the list of services with the dashboard. When the `revisor` answers it with an error, the script reads the body, and if it finds the words "no existe", it deletes the service from the dashboard. Tonight someone else changed the script's base address and removed a letter from it. The `revisor` answered `404` with "no existe esa ruta", the script saw "no existe" and deleted all six services from the dashboard, one by one. Meanwhile, another script from the same team tries to register a service that already exists, receives `409` with "ya existe un servicio llamado pagos: /servicios/2", splits the text at the colon to extract the id… and yesterday someone fixed that message's wording and added a final period. Now the script looks for the service `/servicios/2.`, which does not exist, and retries every second. Nobody did anything wrong on purpose. Both scripts read sentences because the `revisor` gave them nothing else to read.

This lesson gives the `revisor` a single way of saying what went wrong, the one defined by RFC 9457, with a part for machines that never changes and another for people that can be worded however you like.

**Time:** 90 min, or 2 × 45 (the split is between sections 5.8 and 5.9)

**What you build:** the `revisor`'s central error handler, `problemas.ts`: a catalog with a stable `type` for each problem and a single function, `fallar`, through which all the API's errors pass; and a program that checks that every error is a well-formed Problem Details

**What you learn:** `application/problem+json`; the five members `type`, `title`, `status`, `detail`, and `instance`, and what each is for; **`type` as a stable identifier**; `about:blank` and why its `title` is in English; extensions and their rules; what to do when there are several problems in one response; the official IANA registry of types; and what changed from RFC 7807 to RFC 9457

**Where you are coming from.** From [Lesson 4](04-capacidad-y-fallas-del-servidor.md), with a `revisor` that already produces all of the course's error codes: those of Lesson 2's entry point, those of state from Lesson 3, and those of capacity and failures from Lesson 4. Each code is well chosen and carries its headers. But each error's body is a line of text written by hand at the place where it happens, and each place writes it its own way. This lesson changes no code and none of the headers each code requires (`Allow`, `WWW-Authenticate`, `Retry-After`, `Accept`): it changes the body of all errors at once, and with it their `Content-Type`.

**What this lesson does not do.** It does not teach how to decide what to do with an error on the client side: here what the `revisor` says is designed, and [Lesson 7](07-quien-lee-el-error.md) writes the program that reads it and decides. It does not document the types in OpenAPI or check them on every change; that is [Lesson 8](08-contrato-verificable.md). And it does not publish documentation pages at the `type` addresses: the course uses a domain reserved for examples, which cannot be visited, and section 5.4 explains what you would do in a real API.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS with Node 24.14.1 and curl 8.7.1, adding `-sS` to each `curl` because the output went to a file (`-s` turns off the progress meter, `-S` lets errors show, and neither changes the response). As in Lesson 1, while this lesson was being written other tests occupied 18080 and 18081, so the runs were done with a copy of the programs identical except for the ports, 18580 and 18581, and in the outputs pasted here they were rewritten as 18080 and 18081, which are the ones you will type. Both numbers have the same number of digits, so no `Content-Length` changes. In the `revisor`'s terminal, the machine's folder was replaced with `<carpeta>`. In your run the `Date`'s date, the final eight digits of each `ETag` (the `revisor` draws them at startup), and the `urn:uuid:` reference of each internal error will change, which is new on every occurrence, on purpose (section 5.8). The `revisor` keeps everything in memory: to get the same as the lesson, start it again before each series of requests. It was not run on a desktop Mint installation, and nothing used depends on macOS. The programs are in [`programas/05-problem-details/`](../programas/05-problem-details), in the course repository: the `revisor` in `fig05_01/`, the checker in `fig05_02.ts`, the broken versions from "The error you will see" in `defectos/`, the solution to exercise 4 in `ejercicio4/`, the run of Lesson 4's `revisor` in `antes.salida.txt`, and each run in its `.salida.txt` file. All of them pass `tsc` in strict mode (section 5.16).

## By the end you will be able to

- Recognize a Problem Details by its `Content-Type` and name, without looking, its five members and what each says.
- Decide for a new error whether it deserves a `type` of its own or `about:blank` is enough, and write its entry in the catalog with `type`, `title`, and `status`.
- Explain why the `type` never changes, neither between occurrences nor between languages, and why a client must not decide by reading `title` or `detail`.
- Add an extension to a problem type respecting RFC 9457's naming rules, and check with a run that the `revisor` rejects an extension with a reserved name.
- Answer several problems of the same type in a single body, with `errors` and `pointer`, and choose which to answer when the problems are of different types.
- Run a program that checks that all the API's errors are well-formed Problem Details, and read its failures in two versions broken on purpose.

## The why before the how

The four earlier lessons dealt with the status code, and rightly so: it is the part of the message that any machine along the way understands. But the code says little. A `404` says "I did not find what you asked for", and in the `revisor` that can mean that the route does not exist, that the service does not exist, that the service belongs to another team, or that the check does not exist. A `422` says "I understood, but I cannot fulfill it", and does not say which field failed. A `409` says "it clashes with the current state", and does not say with what. The code commands, and for many decisions it is enough. For the rest, **the body explains**, and this lesson's question is how it explains.

Until Lesson 4, the `revisor` explained with a line of text. That has three costs, and the opening scene shows them all:

1. **Each error has its own shape.** The `422` carries one line per field, separated by line breaks; the `409` carries the existing service's path stuck on the end of the sentence; the `500` carries the reference at the end of another sentence. A client that wants to make use of that information writes a different translator for each error.
2. **What a machine needs is mixed with what a person reads.** The repeated service's id is inside a sentence. To extract it you have to split the text, and the day someone improves the wording, the client breaks without the status code having changed.
3. **There is no stable name for the problem.** "No existe el servicio 99" and "no existe esa ruta" are two different problems with the same code, and the only way to tell them apart is to read the sentence. If tomorrow the `revisor` is translated into English, all the clients that read sentences break at once.

RFC 9457 solves the three things with a JSON object of five members. One of them, `type`, is a name for the problem that never changes, and it is the only thing a machine needs in order to decide. Two others, `title` and `detail`, are for people, and can be worded and translated however you like. What a machine needs besides the name —the repeated service's id, the list of fields that failed— goes in members of its own, the extensions, never inside a sentence. And everything travels with a content type of its own, `application/problem+json`, so anyone knows what they are reading before opening it.

The lesson has four parts:

1. **The format** (5.1 to 5.3): what changes in the response, the content type, and the five members.
2. **Each member in depth** (5.4 to 5.8): `type` and `about:blank`, `title` and `detail`, `status`, `instance`.
3. **Beyond the five** (5.9 to 5.12): extensions, several problems, the IANA registry, and the format's history.
4. **The complete `revisor`** (5.13 to 5.16): the central handler, the files, the run, and the program that checks it.

## The concepts

### 5.1 The same error, before and after

Start by seeing the problem. These four requests are to Lesson 4's `revisor`, as you left it:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 25
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 99

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, DELETE
Content-Type: text/plain; charset=utf-8
Content-Length: 35
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

PATCH no se admite en /servicios/1

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

nombre: debe ser un texto de 1 a 40 caracteres
url: debe ser una dirección http o https
limite_ms: debe ser un entero entre 100 y 10000

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 13:18:39 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya existe un servicio llamado pagos: /servicios/2
```

Each response is correct in what Lesson 4 asked for: good code, good headers, a clear sentence. But look at the bodies as a program would see them. The first is a sentence with a number inside. The second, another sentence with a method and a route inside. The third, three lines with a format of their own, `field: explanation`, that appears in no other error. The fourth puts a path at the end of the sentence, after a colon. Four errors, four shapes, and all `text/plain`: nothing in the response tells the client that there is structure it can make use of.

Now, the same first request to this lesson's `revisor`:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}
```

Three things changed. The `Content-Type` is no longer `text/plain` but `application/problem+json`. `Content-Language: es` appeared, which says in what language the parts for people are written. And the body is a JSON object with five members, always the same five, in all the errors the `revisor` answers. The code and its phrase, `404 Not Found`, did not change. **The code still commands; the body now explains with a structure that can be read without interpreting sentences.**

What did not change matters too. Lesson 4 made clear that a server error carries no stack traces, machine paths, or secrets, and the new format relaxes none of that: a Problem Details is a public surface just like the earlier text, and RFC 9457 itself says so in its section 5 (section 5.8 of this lesson).

### 5.2 `application/problem+json`: the content type

RFC 9457 defines the model of a problem as a JSON object and, when that object travels as a document, gives it a content type of its own: `application/problem+json` (section 3). It is registered in IANA's content type registry, which today points to RFC 9457: it has no mandatory parameters, nor optional ones, and for everything else it behaves like `application/json`. The `+json` suffix is a general convention: it says "this is JSON with a particular meaning". A program that does not know the meaning can read it as JSON; one that does know it knows, before opening the body, that inside there is a problem with `type`, `title`, and the others.

Why is `application/json` not enough? Because the content type is the first thing a client sees, and with `application/json` it cannot tell an error from a resource. Think of a generic client that receives a `404` from an API it does not know. If the type is `application/problem+json`, it knows it can look for `type` and `detail` and show them. If it is `application/json`, it could be a problem, it could be an empty results page with its own shape, it could be anything. The section "The error you will see" triggers exactly that: a perfect body with the wrong type, and the program that checks the errors rejects it in all thirteen cases.

There is an XML version, `application/problem+xml`, which the RFC defines in its appendix B for APIs that speak XML. The `revisor` speaks JSON, so it does not use it.

The RFC adds a detail worth knowing: its second example, the same `errors` and `pointer` one the `revisor` uses, sends `application/problem+json` even though the client only asked for `Accept: application/json`, and clarifies that HTTP allows it (section 3, with a reference to section 12.5.1 of RFC 9110). Content negotiation is a client preference, not an order: RFC 9110 says in its section 12.4.1 that, if no representation is acceptable according to a negotiation header, the server may answer `406` or ignore that header. For an error, ignoring it is almost always best: a `406` in place of the error's explanation leaves the client not knowing what failed. Exercise 3 checks it with the `revisor`.

### 5.3 The five members

This is the body of the previous response, on several lines to read it better (it is a fragment: the `revisor` sends it on one):

```json
{
  "type": "https://revisor.example/problemas/servicio-inexistente",
  "title": "El servicio no existe",
  "status": 404,
  "detail": "no existe el servicio 99",
  "instance": "/servicios/99"
}
```

RFC 9457 defines five members in section 3.1, and this table says whom each is for and what question it answers:

| Member | Type | For whom | What it answers | Does it change between occurrences? |
|---|---|---|---|---|
| `type` | text (a URI) | machines | what problem is it? | never |
| `title` | text | people | what is this problem called? | no, except for the language |
| `status` | number | machines that lost the status line | what code did the server answer? | not in the `revisor`, which uses a single code per `type` (the RFC lets a `type` admit several) |
| `detail` | text | people | what happened this time, and how do I fix it? | yes |
| `instance` | text (a URI) | whoever gives support | which occurrence was it? | yes |

All five are optional for the RFC: a problem without `type` counts as `about:blank` (section 3.1.1), and the others may be missing. **The `revisor` always sends all five**, in the same order, in all the errors it answers itself (the `400` for a method with an absurd name, such as `-X constructor`, is answered by Node's parser before the `revisor` sees it, and so it carries no body; section 5.14 shows it). It is a design decision, not a norm: a client that knows they are always there does not have to write the case where they are missing, and an automated check can require them (the program in section 5.15 does).

The RFC has a rule for the reader that is worth learning early: **if a member carries a type that is not its own, it is ignored**, as if it were not there (section 3.1). A `status` that arrives as text, `"404"`, is not a number, so a client that follows the RFC acts as if there were no `status`. It is a rule meant so that a client does not break with a careless server, and it is another reason for the server to be careful: a type mistake does not give an error message, it gives a member that silently disappears.

The five sections that follow take each member separately.

### 5.4 `type`: the stable identifier

Look at the first two responses of this lesson's run. The first asks for a service that does not exist; the second, service 3, which does exist but belongs to team b, and the one asking is from team a:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 172
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 3","instance":"/servicios/3"}
```

Both have the **same `type`** and the same `title`. Only `detail` and `instance` change, and in both cases only by the number. It is what Lesson 2 asked of you so as not to give away which services exist: the `404` that hides on purpose has to be indistinguishable from the `404` of something that does not exist, and now the rule reaches the `type` too. A different `type` for "it belongs to another team" would be the same leak as a `403`, written in another place.

**The `type` is the problem's name, and it is the only thing a machine should decide with.** The RFC says it with a **must**: whoever consumes a problem has to use the `type` as the primary identifier of the problem type (section 3.1.1). Not the `title`, which gets translated. Not the `detail`, which changes on every occurrence. The `type`.

From there comes the rule that gives this section its name: **a `type` never changes.** It does not change from one occurrence to another: service 99 and service 3 give the same one. It does not change between languages: if the `revisor` were translated into English, `title` and `detail` would change, and the `type` would still be `https://revisor.example/problemas/servicio-inexistente`, with its words in Spanish, because it is not a word but an identifier. And it does not change between API versions: changing a `type` is a change that breaks every client that decided with it, just like changing a route.

**A `type` is a URI.** The RFC allows any URI reference, but recommends it be absolute (section 3.1.1). A relative `type`, like `servicio-inexistente`, would be resolved against the request's address, and the same word would mean two different things depending on where it was requested: the RFC gives exactly that example. The `revisor` uses absolute addresses under `https://revisor.example/problemas/`, plus the problem's key.

**If a `type` is an `https` address, visiting it should bring documentation** for people explaining the problem and how to resolve it (section 3.1.1 and section 4: "A problem type URI SHOULD resolve to HTML documentation"). In a real API, `https://tuapi.example.com/problemas/servicio-inexistente` would be a page saying when it occurs, what each extension means, and what to do. The course uses `revisor.example` because `.example` is a domain reserved for documentation (RFC 6761), which points to no machine: that way no example in the course coincides with a real company's domain. In your API, the `type` goes under a domain you control.

Two more RFC rules about resolvable `type`s. The first: the client **should not** visit the `type` automatically, except to give information to a developer, for example with a debugging tool (section 3.1.1). The `type` is compared, not downloaded: a client that requested the page on every error would double the requests and depend on the documentation being up. The second: the RFC allows a `type` that cannot be visited, such as a `tag:` URI, but recommends resolvable ones, because if one day you want to publish the documentation and your `type` was not an address, you will have to change it, and changing it breaks everyone.

And this section's design question: **when does a problem deserve a `type` of its own?** The RFC gives the criterion in section 4: generic problems, those that could happen to any web resource, are better expressed with the bare code. Its example is a `403` to a `PUT`: a "you cannot write" type adds nothing the code does not say. A `type` of its own is worth it when the problem belongs to your domain and the client needs to tell it apart from others with the same code: "the service does not exist" versus "the check does not exist" versus "the route does not exist", or "the data cannot be fulfilled" versus "the revisor does not connect to that destination", which are the `revisor`'s two `422`s.

### 5.5 `about:blank`: the problem that is only its code

Four of the `revisor`'s errors have no `type` of their own. Here are two:

```text
$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 111
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Not Found","status":404,"detail":"no existe esa ruta","instance":"/servicioss"}

$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD, PUT, DELETE
Content-Type: application/problem+json
Content-Language: es
Content-Length: 137
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Method Not Allowed","status":405,"detail":"PATCH no se admite en /servicios/1","instance":"/servicios/1"}
```

A route that does not exist and a method the route does not support are HTTP problems, not the `revisor`'s: they can happen to any API, and the code already says everything there is to say (with `Allow`, in the case of the `405`). That is what `about:blank` exists for. The RFC registers it as the only type the registry carries from the start, and says that **an `about:blank` problem has no meaning other than that of its status code** (section 4.2.1). The other two are the `415`, a body that does not declare itself JSON, and the `413`, a body of more than 16 KiB, which you will see in the run in section 5.14.3: they can arrive at any API, and the code, with its headers, already says everything.

`about:blank` is also the default value: a problem without `type` counts as if it said `about:blank` (section 3.1.1 and 4.2.1). The `revisor` writes it anyway, because of the five-members rule.

**With `about:blank`, the `title` is the code's phrase.** The RFC says the `title` **should** be the recommended phrase for that code: `Not Found` for `404`, and so on for all (section 4.2.1). That is why the `revisor` says `Not Found`, `Method Not Allowed`, and `Unsupported Media Type`, in English, even though everything else is in Spanish. The reason is that with `about:blank` there is no type of its own to name the problem: the problem's name is the code, and the code has an official phrase, the one in IANA's status code registry, which everyone recognizes.

The same RFC line adds that this phrase **may** be translated according to what the client asks with `Accept-Language`. It is a permission, not an obligation, and the `revisor` does not use it: it leaves the registry's phrase as is. What does go in Spanish in those three errors is the `detail`, which explains the occurrence: "no existe esa ruta", "PATCH no se admite en /servicios/1". It is the same division as always: the name, stable; the explanation, for the reader.

And is it not odd to send `Content-Language: es` with a `title` in English? RFC 9110 foresees it: `Content-Language` describes the language of the audience the representation is intended for, and says that this "might not be equivalent to all the languages used within" it (section 8.5). The `revisor`'s audience reads Spanish; that an HTTP proper name appears in English does not change who it is addressed to.

A precision detail that the `revisor` resolves in `respuestas.ts`: Node carries the old names of two codes, `413` and `422`, and IANA's registry has the new ones, `Content Too Large` and `Unprocessable Content`. The status line uses the registry's. And the `revisor`'s `413` is `about:blank`, so its `title` also has to be the registry's, `Content Too Large`, not the `Payload Too Large` that Node carries: the catalog writes it by hand, and the program in section 5.15 checks it.

### 5.6 `title` and `detail`: what gets translated

`title` and `detail` are the two members for people, and they differ in a single thing: **`title` belongs to the type and `detail` belongs to the occurrence.**

The `title` is a short summary of the problem type. The RFC says it **should not** change from one occurrence to another, except for translating it (section 3.1.3). "The service does not exist" is the same for service 99, for 3, and for the one you ask for tomorrow. That is why in the `revisor` the `title` lives in the catalog, next to the `type`, and is not written by whoever answers: it is written by whoever designs the type, once. The RFC adds that the `title` is only advisory, meant for someone who does not know the `type`'s meaning and cannot find out, for example when reading a log offline.

The `detail` explains **this** occurrence: "no existe el servicio 99". The RFC asks two things of it (section 3.1.4). The first, that it focus on helping the client correct the problem, not on providing debugging information: "el servicio 5 no respondió en 1000 ms" tells it what happened and suggests what to change (the service's limit); a stack trace is of no use to it and teaches the world how the server is built. The second is a rule for the reader: **the client should not parse the `detail` to extract information**; that is what extensions are for, which are "more appropriate and less error-prone".

That second rule is the opening scene written as a norm. Lesson 4's `409` said "ya existe un servicio llamado pagos: /servicios/2", and the script split the sentence. Compare it with this lesson's:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 219
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado pagos","instance":"/servicios","existente":"/servicios/2"}
```

The path left the `detail` and moved to a member of its own, `existente`. The `detail` no longer needs it and is a clean sentence, which can be improved, shortened, or translated without breaking anyone. A client that needs the existing service reads `existente` and gets `/servicios/2`, without splitting text. That is the extension in section 5.9.

The division also lets you improve the texts without asking anyone's permission. Imagine the `title` of `etiqueta-vencida` said "El servicio cambió desde que lo leíste". It would be false in one case: after a restart, the old tag does not match either, even though nobody changed the service. Changing it to "Tu etiqueta ya no es la vigente", which is true in both cases and is the one the `revisor` uses, would break no client, because the `type`, `https://revisor.example/problemas/etiqueta-vencida`, would stay the same. A `title` gets corrected; a `type` is not touched.

**What gets translated and what does not**, in one line: `title` and `detail` are translated; `type`, `status`, `instance`, and the extensions' names and values are not. The course has editions in other languages, but the programs' code is copied untranslated: the `revisor` in every edition answers with the `title` and `detail` in Spanish, and the `type` is identical in all. If a `revisor` were translated, those two would change and the `type` would stay the same. A client written against the Spanish edition works the same against a `revisor` that answers in Bulgarian, because it never read a word.

### 5.7 `status`: the code, repeated on purpose

`status` is the status code, as a number, the same as the status line's. Why repeat it? The RFC gives two reasons (section 3.1.2). An intermediary, such as a cache or a proxy, may have changed the code along the way, and the client can see which was the original. And a problem can be stored without its HTTP response —in a log, in a queue, in an email—, and there there is no status line.

But it has a hard rule: whoever generates the problem **must** use in the HTTP response the same code it puts in `status`. And the member is only advisory: generic HTTP software —proxies, load balancers, firewalls, antivirus— does not know it or respect it, and keeps using the status line's code (sections 3.1.2 and 5). **If the two differ, the status line won for everyone who does not read the body**, which is almost all of the path. It is the course's first principle stated in a concrete case: the body never contradicts the code.

The RFC puts it in its security section, and it is worth citing the whole idea: since `status` duplicates what the status line already says, there is a possibility that the two do not match, and it is not clear which takes precedence. That is why in the `revisor` there is no way for them to differ: the `status` comes from the catalog together with the `type`, and the same function that writes the body writes the status line with that number. Whoever answers an error does not choose the code: it chooses the problem, and the problem brings its code.

### 5.8 `instance`: which occurrence it was

`instance` is a URI that identifies **this occurrence** of the problem (section 3.1.5). The RFC leaves open which URI to use, and the `revisor` makes two different decisions depending on the case.

**In client errors, `instance` is the path that was requested, without the query**: `/servicios/99`, `/servicioss`, `/servicios`. It tells whoever reads the problem in a log what resource the request was going to. The query (what comes after `?`) is removed because sometimes data travels in a query that must not be left copied in an error. Careful: the `revisor`'s terminal does log the complete request, with its query; in a real API, the log also trims or masks what must not be stored. And it is a design judgment worth stating plainly: it departs a little from the RFC. The RFC defines `instance` as the identifier of **this** occurrence, and says that, if the URI can be visited, the problem should be obtainable there (section 3.1.5). `/servicios/99` can be visited, but it returns the resource (or the same `404`), not this occurrence; and two requests to `/servicios/99` give the same `instance`. It is used because it tells whoever reads a log what resource the request was going to, and the RFC lets it pass in form: its own example uses a path (`/account/12345/msgs/abc`), and recommends that a relative URI carry the full path. Where identifying the occurrence does matter, in the `500`, the `revisor` uses a unique reference.

**In the internal error, `instance` is a unique reference**:

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer escritura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:d80e7ef5-6cf9-4099-83a4-53c6d6116787"}
```

`urn:uuid:` followed by a universally unique identifier (RFC 9562) is a URI that cannot be visited and whose probability of repeating is negligible (122 random bits: not impossible, absurdly improbable). Each `500` carries a new one, and the same identifier stays in the `revisor`'s terminal, together with the stack trace:

```text
GET /servicios/1/informe
error d80e7ef5-6cf9-4099-83a4-53c6d6116787 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
```

That is how support works with a server error: the client reports "I got the `urn:uuid:…`", and whoever operates searches that text in their log and finds the exact stack trace, the route, and the time. The client does not receive the stack trace nor need it. It is the same reference that Lesson 4 put in the `500`'s sentence, now in the member the RFC designed for it, and with a `detail` that no longer repeats it: "ocurrió un error inesperado; si se repite, reporta la referencia".

The RFC suggests that, if the `instance` can be visited, the complete problem can be obtained there (section 3.1.5), and in its security section it warns that whoever offers that information over HTTP should avoid exposing implementation details, such as a stack dump. The `revisor` offers no such page: the stack trace lives in the terminal, which only whoever operates sees.

**That is the first half.** If you work in two sessions, this is the split.

### 5.9 Extensions: what the type adds

A problem type **may** add members of its own to the object (section 3.2). They are called extensions, and they are the place for everything a machine needs besides the problem's name. The `revisor` has two: `existente` in the `409`, which you already saw, and `errors` in the `422`, which you will see in section 5.10.

**An extension belongs to the type, not to the occurrence.** It is defined by whoever designs the type, together with its `type`, its `title`, and its `status`, and is documented on the `type`'s page. `existente` is always in a `nombre-repetido`, and it is always the path of the service that already has that name. A client that knows the type knows it can count on it.

**The client must ignore extensions it does not know** (section 3.2). It is the rule that lets types grow: if tomorrow the `revisor` adds to `nombre-repetido` an extension `sugerencia` with a free name, today's clients keep working, because they do not look for it. For the same reason, removing an extension that clients use does break: it is like removing a field from a resource.

**An extension's name has rules.** The RFC says in section 4 that the name **should** begin with a letter, use only letters, digits, and underscore, and be three characters or more. The first two rules have a reason the RFC gives: that the name can also be written in formats other than JSON, such as XML. The three-letter one the RFC asks for without explaining it; it is a recommendation (*SHOULD*), not an obligation. `existente` and `errors` comply. `ex` would not (it has two letters) and `nombre-previo` would not either (it has a hyphen). Exercise 4 asks you to make `problemas.ts` check it.

**And the name cannot be that of a standard member.** Here there is a JavaScript trap. `fallar` builds the body with `{ type, title, status, detail, instance, ...extensiones }`: first the five and then the extensions. If someone passed an extension called `status`, the `...` would write it over the catalog's `status`, and the body would say a different code from the status line's: the disagreement that section 5.7 said could not happen. That is why `fallar` rejects the five reserved names before building the body, throwing an error. That error is caught by `servidor.ts` and turned into a `500` with its reference: it is a defect of the program, not of the client, and this way it shows in the terminal instead of coming out as a response that lies.

And the headers? `Retry-After` in the `503`, `Allow` in the `405`, `WWW-Authenticate` in the `401`, and `Accept` in the `415` are still headers, not extensions. The RFC foresees it: a type definition may require that the response carry `Retry-After` (section 4). Headers are read by generic HTTP software; an extension is read only by whoever understands the type. What HTTP already has as a header stays as a header, and that is why `fallar` receives the headers separately from the extensions.

### 5.10 Several problems in one response

A request can have more than one problem. The RFC distinguishes two cases, and the `revisor` has both.

**Several problems of the same type: an extension with the list.** A registration with three bad fields has the same problem three times, "the data cannot be fulfilled":

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 407
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"3 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"},{"detail":"debe ser un entero entre 100 y 10000","pointer":"#/limite_ms"}]}
```

A single `datos-invalidos` problem, with an `errors` extension that lists the three failures. Each failure is an object with its `detail`, which explains what is wrong, and a `pointer`, which says where. It is exactly the shape of the second example in section 3 of RFC 9457, which defines a validation type with the `errors` extension and says that, when the type is designed for it, extensions may carry more than one occurrence of the same problem. The `detail` above only counts how many failures there are: what the client needs is in the list.

The `pointer` is a **JSON Pointer** (RFC 6901): a standard way of pointing to a place inside a JSON document. `#/nombre` is the member `nombre` of the root object; `#/perfil/color` would be the member `color` inside `perfil`; `#/servicios/0` would be the first element of the list `servicios`. The `#` in front is the way of writing the pointer as a URI fragment (section 6 of RFC 6901), the same one the RFC 9457 example uses. With that, a form can put each message next to its field without interpreting sentences: the `pointer` says which, the `detail` says what.

Compare with Lesson 4's `422`: the same content, three `field: explanation` lines. There the client had to split the text by line breaks and colons, and a message that carried a colon broke it. Here each piece is in its member.

**Several problems of different types: the most relevant is answered.** Now a registration with a name that already exists and a forbidden address:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}
```

`pagos` already exists, so this registration has two problems: `nombre-repetido` (`409`) and `destino-prohibido` (`422`). The `revisor` answers only the second. The RFC says that, when an API finds several problems that do not share the type, it is **recommended** to answer the most relevant or urgent (section 3). And it explains why they are not merged: although a "batch" type that carried disparate problems could be invented, that does not fit with HTTP. It is right about the code: a response has a single status code, and a `409` and a `422` together cannot be expressed with just one.

Which is the most relevant? The RFC does not decide it; your API does, and in the `revisor` the order in which it asks decides. First the entry point, with Lesson 2's seven questions; then, inside the registration, `validar` collects all the data failures; then `destinoPermitido` checks the address; and at the end a repeated name is looked for. A forbidden address is more urgent than a repeated name for a practical reason: if the client only changed the name, it would clash again with the address; if it changes the address, the name may stop mattering to it. Exercise 2 asks you to predict three other ties.

### 5.11 The catalog and the IANA registry

The `revisor` has twenty-two problem types, each with its key, its `type`, its `title`, and its `status`. They are in a single place, the catalog in `problemas.ts` (section 5.13), and that is half the value of the format: instead of twenty-eight calls with their own phrase scattered across five files, a table that can be read, reviewed, and documented all at once. Lesson 8 turns it into the API's OpenAPI description.

RFC 9457 asks that the definition of a new type document three things: the type's URI, a short `title`, and the code it is used with (section 4). They are the catalog's three columns. It may also define extensions and require `Retry-After`, which in the `revisor` are `existente`, `errors`, and the maintenance `503`.

For types that many APIs could share, RFC 9457 created an official registry at IANA, "HTTP Problem Types" (section 4.2). Its policy is *Specification Required*: to register a type a stably and freely published specification is needed, although it does not have to be a standard. And it has an exclusion that matters here: values specific to a vendor, an application, or an installation **cannot** be registered. The `revisor`'s types belong to its application, so they live under its own domain and would never go to the registry.

As of October 21, 2026, the registry has six entries (last updated on June 26, 2026):

| `type` | Name | Recommended code | Defined in |
|---|---|---|---|
| `about:blank` | See HTTP Status Code | — | RFC 9457 |
| `…#date` | Date Not Acceptable | `400` | RFC 9458 |
| `…#ohttp-key` | Oblivious HTTP key configuration not acceptable | `400` | RFC 9458 |
| `…#digest-unsupported-algorithms` | Unsupported Hashing Algorithms | `400` | `draft-ietf-httpapi-digest-fields-problem-types`, already approved and awaiting its RFC number |
| `…#digest-invalid-values` | Invalid Digest Values | `400` | the same document |
| `…#digest-mismatched-values` | Mismatched Digest Values | `400` | the same document |

The ellipses are `https://iana.org/assignments/http-problem-types`, the prefix that the RFC allows registrations to use, and which warns may not resolve to a page (section 4.2). That the registry is so small says something: almost all problems belong to an application, and for the truly generic ones the status code with `about:blank` already exists. Before inventing a type, look at the registry: if there is one that works, reuse it: that is what the registry exists for ("to promote reuse", section 4.2), and it is what the example in section 4.1 suggests.

### 5.12 From RFC 7807 to RFC 9457

The format has more history than its number. It began as an individual draft by Mark Nottingham, dated July 4, 2012, *Indicating Details of Problems to Machines in HTTP*, with an unusual warning on the first page: that it was not clear whether defining the format would improve things enough to compensate for the harm it could cause, and that using it before it was an RFC "may expose you to ridicule". The risk he saw was coupling: that clients would depend too much on each API's details. He published it anyway because, he said, many people were already doing it their own way.

It was published as **RFC 7807** in March 2016, by Mark Nottingham and Erik Wilde, and for seven years it was the reference. In July 2023 it was replaced by **RFC 9457**, by the same two authors and Sanjay Dalal, also an IETF proposed standard, which declares 7807 obsolete. Its appendix D lists the changes, and there are three:

1. **The registry of types** (section 4.2): 7807 had no common place for shared types; 9457 created IANA's and registered `about:blank` in it.
2. **What to do with several problems** (section 3): the extension with the list for those of the same type, and the most relevant for those of different types, with the example of `errors` and `pointer` that the `revisor` uses.
3. **`type`s that cannot be visited** (section 3.1.1): when a URI such as `tag:` is acceptable and why resolvable ones are preferred.

What did not change is almost everything: the five members, their types, `application/problem+json`, and `application/problem+xml`. A problem written according to 7807 is valid according to 9457, and a 7807 client reads what the `revisor` sends without changes. Traces of the old name remain: the XML format's namespace is still `urn:ietf:rfc:7807`, and the JSON schema in appendix A is still titled "An RFC 7807 problem object". If you see a library that says "RFC 7807", it almost always produces the same as this lesson; what it lacks, if anything, is the registry and the guidance on several problems.

### 5.13 The central handler: `problemas.ts`

All of the above fits in a new file of sixty lines:

```ts
// fig05_01/problemas.ts — el manejador central de errores: cada error sale como Problem Details (RFC 9457).
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

Read it in three parts.

**The catalog.** `CATALOGO` is an object whose keys are the short names of the problems (`servicio-inexistente`, `datos-invalidos`…) and whose values carry the `type`, the `title`, and the `status`. The first four use `about:blank` with the registry's phrase; the others, the base `https://revisor.example/problemas/` plus the key. `satisfies Record<string, Tipo>` asks TypeScript to check that each entry has the three fields with the right type, without losing the exact names of the keys. That is why `Clave`, the type on the second line after the catalog, is the exact list of keys: if someone calls `fallar(respuesta, "servicio-inexsitente", …)` with a letter changed, `tsc` flags it before anything runs.

**`fallar`.** It receives the response, the problem's key, this occurrence's `detail`, and some options: headers, extensions, and `instance`. It takes the `type`, the `title`, and the `status` from the catalog, so the caller **cannot** write a `status` different from the code, or a `title` different from the type's. It rejects extensions with a reserved name (section 5.9). It computes `instance` as the requested path without the query, unless the caller sends another (the `500`). It builds the body with the five members first and the extensions after, and writes the status line with the same `status`, the caller's headers, the `application/problem+json` type, `Content-Language: es`, and the exact length in bytes. `Content-Length` is computed with `Buffer.byteLength` and not with `.length` because accented letters take two bytes in UTF-8: "revisión" has eight letters and nine bytes.

**What is not there.** `fallar` decides nothing about the problem: it does not choose the code, it does not choose the type, it does not translate. It only turns an already made decision (the key) into a response. That is the idea of a central handler: **each place in the program decides what problem there was, and a single place decides how it is said.** If tomorrow the `revisor` had to negotiate the language, or send `application/problem+xml`, this file would be changed and no other.

`respuestas.ts` loses its text `fallar` and exports `escribirCabecera`, which `problemas.ts` now also uses so that the status line's phrase is the registry's:

```ts
// fig05_01/respuestas.ts — las respuestas de éxito del revisor y la lectura del cuerpo. Los errores, en problemas.ts.
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

In the other files, each call changes from a code to a key, and what were headers becomes the `cabeceras` option. For example, the `405` in `rutas.ts` (fragment):

```ts
// Lección 4
fallar(respuesta, 405, `${peticion.method} no se admite en ${url.pathname}`, { Allow: permitidos(ruta) });
// Lección 5
fallar(respuesta, "metodo-no-admitido", `${peticion.method} no se admite en ${url.pathname}`, {
  cabeceras: { Allow: permitidos(ruta) },
});
```

Three calls change something more than the form, because the information a machine needs comes out of the sentence. The `409` moves the path to the `existente` extension; the `422` swaps the lines for the `errors` list; and the `500` moves the reference to `instance`. You will see them in full in section 5.14.

### 5.14 The complete `revisor`

#### 5.14.1 The files that change

This lesson's `revisor` lives in `~/curso-http/fig05_01/`. If you have the Lesson 4 folder, copy it with that name: besides `problemas.ts` and `respuestas.ts`, which you already saw in full, five files change. In all of them, the calls to `fallar` go from a code to a key and `fallar`'s `import` now comes from `problemas.ts`.

`servidor.ts`: the `500` carries the reference in `instance`.

```ts
// fig05_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

`rutas.ts`: the entry point, with `about:blank` for the route and the method, and the types of its own for the credential and the permission.

```ts
// fig05_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
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

`servicios.ts`: `rechazarDatos` builds the `errors` list, and the two `409`s carry `existente`.

```ts
// fig05_01/servicios.ts — lo que hace cada ruta de la API del revisor.
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
import { fallar } from "./problemas.ts";
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

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
    fallar(respuesta, "nombre-repetido", `ya existe un servicio llamado ${validos.nombre}`, {
      extensiones: { existente: `/servicios/${existente.id}` },
    });
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
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
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

`operacion.ts`: the `503` keeps its `Retry-After` as a header; the `403` for whoever is not admin uses the same type as the entry point's.

```ts
// fig05_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
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

`versiones.ts`: the withdrawn version has its own type, `version-retirada`, distinct from `servicio-retirado`, because the client has to do different things: in one, stop requesting that service; in the other, move to another version of the API.

```ts
// fig05_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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

#### 5.14.2 The files that do not change

The other files are Lesson 4's, without a single change. They go in full so the `revisor` can be assembled from this lesson:

```ts
// fig05_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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
// fig05_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig05_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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
// fig05_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig05_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig05_01/laboratorio.ts
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
// fig05_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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

```json fig05_01/package.json
{
  "type": "module"
}
```

#### 5.14.3 The complete run

Open two terminals in `~/curso-http/fig05_01/`. In the first, the lab; in the second, the `revisor`:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

In a third, these are the lesson's requests, in order. Those from the earlier sections are here again, together, and after them come those of the 401, the maintenance 503, a success, the two SSRF rejections, and a body that is too large:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 172
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/credencial-invalida","title":"Falta una credencial válida","status":401,"detail":"falta la credencial","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 409 Conflict
Content-Type: application/problem+json
Content-Language: es
Content-Length: 219
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/nombre-repetido","title":"Ya existe un servicio con ese nombre","status":409,"detail":"ya existe un servicio llamado pagos","instance":"/servicios","existente":"/servicios/2"}

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer escritura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:d80e7ef5-6cf9-4099-83a4-53c6d6116787"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"ftp://archivos","limite_ms":5}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 407
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"3 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"},{"detail":"debe ser un entero entre 100 y 10000","pointer":"#/limite_ms"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: application/problem+json
Content-Language: es
Content-Length: 188
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/en-mantenimiento","title":"El revisor está en mantenimiento","status":503,"detail":"el revisor está en mantenimiento","instance":"/servicios"}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
ETag: "1-1-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 230
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: 169.254.169.254:80: dirección privada o reservada","instance":"/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 235
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/destino-prohibido","title":"El revisor no se conecta a ese destino","status":422,"detail":"destino prohibido: localhost resuelve a una dirección privada o reservada","instance":"/servicios"}

$ printf '{"nombre":"%017000d"}' 0 | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: application/problem+json
Content-Language: es
Content-Length: 129
Date: Wed, 21 Oct 2026 23:42:15 GMT

{"type":"about:blank","title":"Content Too Large","status":413,"detail":"el cuerpo pasa de 16384 bytes","instance":"/servicios"}
```

Notice five things. The `401` keeps its `WWW-Authenticate` and the `503` its `Retry-After`: the headers each code requires did not move into the body. The `413` at the end, a registration with a name of 17,000 characters, is `about:blank` with the registry's phrase, and carries `Connection: close`: the `revisor` stops reading as soon as the body passes 16 KiB and closes the connection when answering, so as not to keep receiving what the client wanted to send. The `204`s still have no body. The success, `GET /servicios/1`, is still `application/json`, without `Content-Language`: the format is only for errors. And Lesson 1's two SSRF rejections now have their type, `destino-prohibido`, with the same `detail` as always, which does not list the addresses a name resolves to.

#### 5.14.4 Everything else keeps working

Conditional requests, the credential scheme, the method named after an `Object.prototype` member, the body that is not an object, the SSRF ranges, and the tag after a restart did not change behavior: only the body, when they are errors. This is the same run, below. It also carries the lost-update case with two simultaneous `PUT`s that Lesson 3 saw: a slow one, which sends its body a second later (`curl -T -` sends it in chunks), and a fast one with the same tag. Between the second-to-last and the last request the `revisor` was restarted:

```text
$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'); echo "ETAG=$ETAG"
ETAG="1-1-f5a91511"

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: W/$ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H "If-None-Match: \"9-9\", $ETAG"
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: *'
HTTP/1.1 304 Not Modified
ETag: "1-1-f5a91511"
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a' -H 'If-None-Match: "9-9", W/"8-8"'
HTTP/1.1 200 OK
ETag: "1-1-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: W/$ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 412 Precondition Failed
Content-Type: application/problem+json
Content-Language: es
Content-Length: 263
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/etiqueta-vencida","title":"Tu etiqueta ya no es la vigente","status":412,"detail":"If-Match se compara en fuerte: una etiqueta débil (W/) no sirve para cambiar; manda la ETag tal como llegó","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: \"9-9\", $ETAG" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-2-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: *' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
HTTP/1.1 200 OK
ETag: "1-3-f5a91511"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:18:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}

$ ETAG=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ETAG=$ETAG"
ETAG="1-3-f5a91511"

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
ID=/servicios/7 ETAG="7-1-f5a91511"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}' ) | curl -w ' <- PUT lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
{"type":"https://revisor.example/problemas/servicio-retirado","title":"El servicio se retiró","status":410,"detail":"el servicio 7 se retiró y no va a volver","instance":"/servicios/7"}
 <- PUT lento: 410

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 454
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/lento/1500","limite_ms":2000},{"id":5,"nombre":"reportes","url":"http://127.0.0.1:18081/lento/3000","limite_ms":1000},{"id":6,"nombre":"facturacion","url":"http://127.0.0.1:18081/basura","limite_ms":2000}]}

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Basic bGVjdHVyYS1hOg=='
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: application/problem+json
Content-Language: es
Content-Length: 185
Date: Wed, 21 Oct 2026 13:18:29 GMT
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
Date: Wed, 21 Oct 2026 23:42:15 GMT

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
Date: Wed, 21 Oct 2026 13:18:29 GMT
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
ID=/servicios/8

$ curl -i http://127.0.0.1:18080$ID/salud -H 'Authorization: Bearer admin'
HTTP/1.1 502 Bad Gateway
Content-Type: application/problem+json
Content-Language: es
Content-Length: 278
Date: Wed, 21 Oct 2026 13:18:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/respuesta-invalida","title":"El servicio no dio una respuesta HTTP válida","status":502,"detail":"el servicio 8 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP","instance":"/servicios/8/salud"}

$ TZ=America/Mexico_City node --input-type=module -e 'import { segundosDeEspera } from "./cliente.ts"; for (const v of ["120", "1.5", "-1", "12 30"]) console.log(JSON.stringify(v), "->", segundosDeEspera(v)); const imf = segundosDeEspera("Fri, 01 Jan 2100 00:00:00 GMT"), asc = segundosDeEspera("Fri Jan  1 00:00:00 2100"); console.log("asctime menos IMF-fixdate (misma fecha):", asc - imf, "s")'
"120" -> 120
"1.5" -> null
"-1" -> null
"12 30" -> null
asctime menos IMF-fixdate (misma fecha): 0 s

$ ANTES=$(curl -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b'); echo "ANTES=$ANTES"
ANTES="3-1-f5a91511"

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-b' -H "If-None-Match: $ANTES"
HTTP/1.1 200 OK
ETag: "3-1-b32db61c"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:18:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

The two `412`s —the weak tag's and the slow request's, which lost the race— carry the same `type` and the same `title`, "Tu etiqueta ya no es la vigente", and only their `detail` tells what happened in each case; the change that remained is the fast one's, `"limite_ms":3000`. The `401` for the `Basic` scheme already carries its type; the `400` for `null` is `cuerpo-ilegible`; the twelve ranges give `destino-prohibido` with `[422]`. The `400` for `-X constructor` still has no body because it is answered not by the `revisor` but by Node, before calling it, as Lesson 2 explained. The change with `text/plain` gives `415` even though it carries an old tag or none: the format is asked before the condition, because RFC 9110 says preconditions are not evaluated if without them the response would not have been `2xx` or `412` (section 13.2.1). A slow `PUT` to a service that another request withdraws in the meantime gives `410` `servicio-retirado`, as if it had arrived after the withdrawal. Bodies of 20,000 bytes give `413`, with `Content-Length` or in chunks, and one of exactly 16,384 is read (and gives `400`, because it is not JSON). The live query has its own limit, `demasiadas-consultas`, with `Retry-After: 60`, separate from the checks'. The `502` for a service that cuts the connection now says in its `title` what really happened: "El servicio no dio una respuesta HTTP válida", true whether it cut or answered something that is not HTTP. And the old tag, after restarting, gives `200` and not a false `304`.

The `revisor`'s terminal, at the end of the whole run, with the two internal-error references (the one from section 5.8 and the one from the program in 5.15):

```text
revisor en http://127.0.0.1:18080
GET /servicios/99
GET /servicios/3
GET /servicioss
PATCH /servicios/1
GET /servicios
POST /servicios
GET /servicios/1/informe
error d80e7ef5-6cf9-4099-83a4-53c6d6116787 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
POST /servicios
POST /servicios
PUT /mantenimiento
operación: mantenimiento encendido
GET /servicios
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios/1
POST /servicios
POST /servicios
POST /servicios
GET /servicios/99
GET /servicios/3
GET /revisiones/99
GET /servicioss
PATCH /servicios/1
GET /servicios
POST /servicios
POST /servicios
POST /servicios
POST /servicios
PUT /servicios/1
GET /v0/servicios
GET /servicios/1/informe
error 260fe541-4a99-4e15-a886-6907979f5e48 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:314:28)
    at atender (file://<carpeta>/rutas.ts:107:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:38:44)
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
GET /servicios/7
PUT /servicios/7
DELETE /servicios/7
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
GET /servicios/8/salud
GET /servicios/3
revisor en http://127.0.0.1:18080
GET /servicios/3
```

### 5.15 Checking it with a program

Looking at thirteen responses by eye to see whether they meet the format is boring and error-prone. This program does it for you: it requests thirteen different errors from the `revisor` and checks in each one what the earlier sections say.

```ts
// fig05_02.ts — comprueba que cada error del revisor sea un Problem Details bien formado (RFC 9457).
// Uso: node fig05_02.ts [base]     (por omisión, http://127.0.0.1:18080)
import { STATUS_CODES } from "node:http";

const BASE = process.argv[2] ?? "http://127.0.0.1:18080";
const MIEMBROS = ["type", "title", "status", "detail", "instance"];
// Node trae los nombres viejos de estos dos códigos; el registro de la IANA, los nuevos.
const FRASES: Record<number, string> = { 413: "Content Too Large", 422: "Unprocessable Content" };

type Caso = { nombre: string; metodo: string; ruta: string; cabeceras?: Record<string, string>; cuerpo?: string };

const escritor = { Authorization: "Bearer escritura-a" };
const json = { ...escritor, "Content-Type": "application/json" };

const CASOS: Caso[] = [
  { nombre: "servicio que no existe", metodo: "GET", ruta: "/servicios/99", cabeceras: escritor },
  { nombre: "servicio de otro equipo", metodo: "GET", ruta: "/servicios/3", cabeceras: escritor },
  { nombre: "revisión que no existe", metodo: "GET", ruta: "/revisiones/99", cabeceras: escritor },
  { nombre: "ruta que no existe", metodo: "GET", ruta: "/servicioss", cabeceras: escritor },
  { nombre: "método que la ruta no admite", metodo: "PATCH", ruta: "/servicios/1", cabeceras: escritor },
  { nombre: "sin credencial", metodo: "GET", ruta: "/servicios" },
  { nombre: "cuerpo en texto", metodo: "POST", ruta: "/servicios", cabeceras: { ...escritor, "Content-Type": "text/plain" }, cuerpo: "x" },
  { nombre: "cuerpo de más de 16 KiB", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: `{"nombre":"${"a".repeat(17_000)}"}` },
  { nombre: "datos imposibles", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: '{"nombre":"","url":"ftp://x"}' },
  { nombre: "nombre repetido", metodo: "POST", ruta: "/servicios", cabeceras: json, cuerpo: '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}' },
  { nombre: "cambio sin If-Match", metodo: "PUT", ruta: "/servicios/1", cabeceras: json, cuerpo: "{}" },
  { nombre: "versión retirada", metodo: "GET", ruta: "/v0/servicios", cabeceras: escritor },
  { nombre: "error interno", metodo: "GET", ruta: "/servicios/1/informe", cabeceras: escritor },
];

// Lo que el revisor ya respondió para cada type: el title y el status no deben cambiar entre ocurrencias.
const vistos = new Map<string, { title: unknown; status: unknown }>();

async function comprobar(caso: Caso): Promise<string[]> {
  const respuesta = await fetch(BASE + caso.ruta, { method: caso.metodo, headers: caso.cabeceras, body: caso.cuerpo });
  const fallas: string[] = [];
  const tipo = (respuesta.headers.get("content-type") ?? "").split(";")[0].trim();
  if (tipo !== "application/problem+json") fallas.push(`tipo ${tipo || "(ninguno)"}, se esperaba application/problem+json`);
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(await respuesta.text());
  } catch {
    return [...fallas, "el cuerpo no es JSON"];
  }
  if (typeof cuerpo !== "object" || cuerpo === null || Array.isArray(cuerpo)) return [...fallas, "el cuerpo no es un objeto"];
  const problema = cuerpo as Record<string, unknown>;
  for (const miembro of MIEMBROS) {
    if (!Object.hasOwn(problema, miembro)) fallas.push(`falta ${miembro}`);
  }
  // status: un número, y el mismo que la línea de estado (RFC 9457, sección 3.1.2).
  if (problema.status !== respuesta.status) fallas.push(`status ${JSON.stringify(problema.status)} en el cuerpo y ${respuesta.status} en la línea`);
  // type: about:blank o un URI absoluto (sección 3.1.1 recomienda absolutos).
  const type = problema.type;
  if (typeof type !== "string") {
    fallas.push("type no es un texto");
  } else if (type !== "about:blank" && !URL.canParse(type)) {
    fallas.push(`type ${type} no es un URI absoluto`);
  }
  // Con about:blank, el title es la frase del código (sección 4.2.1).
  const frase = FRASES[respuesta.status] ?? STATUS_CODES[respuesta.status];
  if (type === "about:blank" && problema.title !== frase) fallas.push(`title ${JSON.stringify(problema.title)} con about:blank; se esperaba ${frase}`);
  // El mismo type, el mismo title y el mismo status en cada ocurrencia (sección 3.1.3).
  if (typeof type === "string" && type !== "about:blank") {
    const antes = vistos.get(type);
    if (antes === undefined) vistos.set(type, { title: problema.title, status: problema.status });
    else if (antes.title !== problema.title || antes.status !== problema.status) fallas.push(`${type} cambió de title o de status entre ocurrencias`);
  }
  return fallas;
}

let bien = 0;
for (const caso of CASOS) {
  const fallas = await comprobar(caso);
  if (fallas.length === 0) bien++;
  console.log(`${fallas.length === 0 ? "ok   " : "FALLA"} ${caso.metodo} ${caso.ruta} (${caso.nombre})${fallas.map((f) => "\n      " + f).join("")}`);
}
console.log(`\n${bien} de ${CASOS.length} respuestas son Problem Details bien formados`);
process.exitCode = bien === CASOS.length ? 0 : 1;
```

For each case it checks six things: that the content type is `application/problem+json`; that the body is a JSON object; that the five members are there; that `status` equals the status line's code; that `type` is `about:blank` or an absolute URI (`URL.canParse` says whether a text can be read as a complete address); and that, with `about:blank`, the `title` is the code's phrase. It also keeps count of what it saw for each `type`: if the same `type` appears twice with a different `title` or a different `status`, it flags it. It ends with 0 if everything is fine and with 1 if something fails, so it can be used in an automated check.

With the `revisor` running, in another terminal (the program goes in the folder above, `~/curso-http/`):

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
ok    GET /servicios/3 (servicio de otro equipo)
ok    GET /revisiones/99 (revisión que no existe)
ok    GET /servicioss (ruta que no existe)
ok    PATCH /servicios/1 (método que la ruta no admite)
ok    GET /servicios (sin credencial)
ok    POST /servicios (cuerpo en texto)
ok    POST /servicios (cuerpo de más de 16 KiB)
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

13 de 13 respuestas son Problem Details bien formados
```

Thirteen out of thirteen. This program is the seed of Lesson 8's matrix, which does the same with the course's 23 codes and also checks the headers.

### 5.16 Checking the types with `tsc` (optional)

From the `revisor`'s folder, with the command from section 0.9 of Lesson 0 plus `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

It prints nothing: there are no errors. `fig05_02.ts` passes the same command together with the `revisor`'s files, and so do the two broken versions in the next section and the solution to exercise 4. If you change a letter of a key in a call to `fallar`, `tsc` flags it: it is the advantage of `Clave` being the exact list of the catalog's keys.

## The error you will see

### The `title` that tells the occurrence

The most common error with this format is using `title` as if it were `detail`: putting this occurrence's message in the title. It reads very naturally, because many libraries call the same thing "message" or "title". To trigger it, copy `fig05_01/` as `rota/` and in `rota/problemas.ts` change the start of `fallar` to this (it is a fragment; the full version is in `defectos/title-por-ocurrencia/problemas.ts`):

```ts
  // DEFECTO A PROPÓSITO (lección 5): el title lleva el mensaje de esta ocurrencia, como el detail.
  const { type, status } = CATALOGO[clave];
  const title = detail;
```

Start the lab and the `revisor` from `rota/` and request the two services from section 5.4:

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"no existe el servicio 99","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicios/3 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:31 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"no existe el servicio 3","status":404,"detail":"no existe el servicio 3","instance":"/servicios/3"}
```

Each response, on its own, looks fine: the five members are there, the `type` is the usual one, the code is correct. The problem appears when comparing them: the same `type` carries two different `title`s, and the RFC says the `title` should not change between occurrences. A client that grouped its errors by `title` on a dashboard would see one line for each service it did not find, instead of just one. And the `title` no longer serves what it exists for: telling whoever reads a log what *type* of problem it is. The program in 5.15 finds it:

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
FALLA GET /servicios/3 (servicio de otro equipo)
      https://revisor.example/problemas/servicio-inexistente cambió de title o de status entre ocurrencias
ok    GET /revisiones/99 (revisión que no existe)
FALLA GET /servicioss (ruta que no existe)
      title "no existe esa ruta" con about:blank; se esperaba Not Found
FALLA PATCH /servicios/1 (método que la ruta no admite)
      title "PATCH no se admite en /servicios/1" con about:blank; se esperaba Method Not Allowed
ok    GET /servicios (sin credencial)
FALLA POST /servicios (cuerpo en texto)
      title "el cuerpo debe ser application/json, no text/plain" con about:blank; se esperaba Unsupported Media Type
FALLA POST /servicios (cuerpo de más de 16 KiB)
      title "el cuerpo pasa de 16384 bytes" con about:blank; se esperaba Content Too Large
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

8 de 13 respuestas son Problem Details bien formados
```

Five failures, of two kinds. The first is the `title` that changed between service 99 and 3. The other four are the `about:blank`s, whose `title` is no longer the code's phrase. And look at what it did **not** find: eight cases passed, although all have the same defect. The program can only see that a `title` changes when the same `type` appears twice, and in its list only `servicio-inexistente` repeats. **A check only sees what it compares.** The fix is to go back to the catalog: the `title` belongs to the type and is written by whoever designs the type, once. Stop the `rota/` programs when you finish.

### The problem that claims to be plain JSON

The second error is smaller and more damaging. Copy `fig05_01/` again as `rota2/` and in `rota2/problemas.ts` change the content type (the full version is in `defectos/json-a-secas/problemas.ts`):

```ts
    // DEFECTO A PROPÓSITO (lección 5): el cuerpo es un Problem Details, pero el tipo dice JSON a secas.
    "Content-Type": "application/json",
```

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}
```

The body is identical, byte for byte, to the one in section 5.1. Only one header line changed. But a generic client that decides "is this a problem?" by looking at the content type —which is what section 5.2 said the type of its own allows— now does not recognize it: to it, it is just any JSON document, perhaps a resource's representation. The program rejects it in all cases:

```text
$ node fig05_02.ts
FALLA GET /servicios/99 (servicio que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios/3 (servicio de otro equipo)
      tipo application/json, se esperaba application/problem+json
FALLA GET /revisiones/99 (revisión que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicioss (ruta que no existe)
      tipo application/json, se esperaba application/problem+json
FALLA PATCH /servicios/1 (método que la ruta no admite)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios (sin credencial)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (cuerpo en texto)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (cuerpo de más de 16 KiB)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (datos imposibles)
      tipo application/json, se esperaba application/problem+json
FALLA POST /servicios (nombre repetido)
      tipo application/json, se esperaba application/problem+json
FALLA PUT /servicios/1 (cambio sin If-Match)
      tipo application/json, se esperaba application/problem+json
FALLA GET /v0/servicios (versión retirada)
      tipo application/json, se esperaba application/problem+json
FALLA GET /servicios/1/informe (error interno)
      tipo application/json, se esperaba application/problem+json

0 de 13 respuestas son Problem Details bien formados
```

Zero out of thirteen, from one line. It is a common defect, because many frameworks put `application/json` on everything they serialize. The fix is `fig05_01/`'s: the type is written by `fallar`, in a single place, for all errors. Stop the `rota2/` programs when you finish.

## Common mistakes

**Deciding with `detail` or with `title`.** It is what the two scripts in the scene did. Sentences get corrected, shortened, and translated, and each change breaks the client without the code or the `type` having changed. The RFC asks the client not to parse `detail`, and gives it the `type` to decide with.

**Putting in a sentence what a machine needs.** An id, a path, a quantity, a field: if a client may need it, it goes in an extension with a name of its own. The sentence is for people.

**A `type` per occurrence.** `…/servicio-inexistente/99`, or a `type` with the date. A `type` is the name of a class of problems; if it changes on every occurrence, the client cannot compare it with anything. What changes on every occurrence goes in `detail` and `instance`.

**Changing a published `type`.** Even if the word is misspelled, or you no longer like it. Changing it is changing the API: all the clients that decided with it stop recognizing the problem. If it is truly needed, it is treated like any version change, with notice.

**A `status` different from the code, or as text.** Different, it contradicts the status line, and almost all the path will believe the line. As text, `"404"`, a client that follows the RFC ignores it as if it were not there. In the `revisor` both things are impossible because the `status` comes from the catalog.

**`application/json` on errors.** The body may be perfect, and the generic client does not know it is a problem. It is the section "The error you will see".

**Using the format for debugging.** Stack traces, SQL queries, class names, machine paths in the `detail` or in an extension. The RFC says it in section 4: Problem Details are not a debugging tool for the implementation, but a way of better explaining the HTTP interface. For debugging there is the reference in `instance` and the operator's log.

**A type of its own for what the code already says.** A "method not allowed" or "unauthorized" `type` adds nothing to a `405` or a `401` with their headers. That is what `about:blank` is for.

**Merging problems of different types into a "batch".** A response has one code, and a `409` with a `422` inside has no code that represents them. The most relevant is answered; the client fixes it and tries again.

## Exercises

All four correct themselves: each ends with a run that tells you whether you got it right. Write your prediction in the [log](bitacora.md) **before** running anything. For the first three you need the lab and the 5.14 `revisor` freshly started.

### Exercise 1 — What problem is it?

Without running anything, predict the code, the `type`, and the `title` of these six responses, and whether any carries an extension:

```bash
curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer escritura-a'
curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
curl -i http://127.0.0.1:18080/v0/servicios
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
```

Hint: the keys of the catalog in `problemas.ts` are the map. Then run them and compare.

### Exercise 2 — Two problems at once

Each of these three requests has two problems of different types. Predict which of the two the `revisor` answers, and why that one:

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"ftp://pagos"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"http://169.254.169.254/"}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a' -H 'Content-Type: text/plain' -d 'pagos'
```

The first repeats a name and carries an `ftp` address; the second carries an empty name and a forbidden address; the third comes from a reader and in text. Run the three.

### Exercise 3 — What the client asks for

Predict what the `revisor` answers to these three requests. The first asks for HTML and says it prefers English; the second asks for English for a route that does not exist; the third uses `-I`, which sends a `HEAD`:

```bash
curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a' -H 'Accept: text/html' -H 'Accept-Language: en'
curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a' -H 'Accept-Language: en'
curl -I http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
```

Does it answer `406`? Does anything change language? What does the `HEAD` carry? Run the three and explain each response with the RFC section that permits it.

### Exercise 4 — The shape of an extension

Copy `fig05_01/` as `ejercicio4/` and add to `fallar`, in `ejercicio4/problemas.ts`, a check of the naming rule from section 5.9: an extension name begins with a letter, uses only letters, digits, and `_`, and has three characters or more. If it does not comply, `fallar` throws an error, as it already does for reserved names.

To know whether you got it right, do three things. First, start the lab and the `revisor` from `ejercicio4/` and run `node fig05_02.ts`: it must give thirteen out of thirteen, because `existente` and `errors` comply with the rule. Then, in `ejercicio4/servicios.ts` change the registration's `existente: ` extension to `ex: `, restart the `revisor`, and try to register `pagos` again. Predict which code it answers and what appears in the terminal. Finally, change `ex: ` to `status: `, restart, and repeat the registration: predict what it answers and what the terminal says.

## Solutions

### Solution 1

```text
$ curl -i http://127.0.0.1:18080/revisiones/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 177
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/revision-inexistente","title":"La revisión no existe","status":404,"detail":"no existe la revisión 99","instance":"/revisiones/99"}

$ curl -i -X DELETE http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json
Content-Language: es
Content-Length: 231
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/permiso-insuficiente","title":"La credencial no tiene permiso","status":403,"detail":"tu credencial solo puede leer; para escribir pide una con rol de escritor","instance":"/servicios/1"}

$ curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 428 Precondition Required
Content-Type: application/problem+json
Content-Language: es
Content-Length: 202
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/falta-condicion","title":"Falta la condición If-Match","status":428,"detail":"para cambiar un servicio manda If-Match con su ETag","instance":"/servicios/1"}

$ curl -i http://127.0.0.1:18080/v0/servicios
HTTP/1.1 410 Gone
Content-Type: application/problem+json
Content-Language: es
Content-Length: 231
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/version-retirada","title":"Esa versión de la API se retiró","status":410,"detail":"la versión 0 de la API se retiró el 31 de enero de 2026; usa /servicios","instance":"/v0/servicios"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 333
Date: Wed, 21 Oct 2026 13:18:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"2 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"},{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}

$ curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: application/problem+json
Content-Language: es
Content-Length: 200
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-lento","title":"El servicio no respondió a tiempo","status":504,"detail":"el servicio 5 no respondió en 1000 ms","instance":"/servicios/5/salud"}
```

All six are the `revisor`'s own types, and each says its key in the `type`. The check that does not exist has its type, `revision-inexistente`, distinct from the service's: the client looks for different things. The reader who tries to delete receives `permiso-insuficiente`, without extensions, and notice what its `detail` does **not** say: "tu credencial solo puede leer", without repeating which one. In the practice `revisor`, the credential's name is the same text as the *token* that travels in `Authorization`, and repeating it in the body would leave the secret copied in any log of the client or of an intermediary: it is what section 5 of the RFC asks to review in every `detail`. The change without `If-Match` is `falta-condicion` (`428`), and the `revisor` did not even read the body: after seeing that it declares itself JSON, the condition is asked before reading it. The withdrawn version asks for no credential and answers `version-retirada` (`410`). The empty registration is `datos-invalidos` with the `errors` extension and **two** failures, not three: `limite_ms` did not come, and its default value is valid. And service 5's health is `servicio-lento` (`504`), which took a second to arrive because the `revisor` waited out the service's limit before giving up.

### Solution 2

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"ftp://pagos"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 260
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser una dirección http o https","pointer":"#/url"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"","url":"http://169.254.169.254/"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json
Content-Language: es
Content-Length: 265
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/datos-invalidos","title":"Los datos no se pueden cumplir","status":422,"detail":"1 dato(s) no se pueden cumplir","instance":"/servicios","errors":[{"detail":"debe ser un texto de 1 a 40 caracteres","pointer":"#/nombre"}]}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a' -H 'Content-Type: text/plain' -d 'pagos'
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json
Content-Language: es
Content-Length: 229
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/permiso-insuficiente","title":"La credencial no tiene permiso","status":403,"detail":"tu credencial solo puede leer; para escribir pide una con rol de escritor","instance":"/servicios"}
```

None answers the `409` or the destination `422` that you perhaps expected. The first gives `datos-invalidos` with a single failure, `url`'s: `validar` runs before the search for the repeated name, and with an `ftp` address the registration does not even get to ask about the name. The second also gives `datos-invalidos`, with the `nombre` failure: `validar` runs before the destination check, and since the address `http://169.254.169.254/` is a valid `http` address, `validar` does not flag it; `destinoPermitido` would check it, and it does not get to run. The third gives `403` and not `415`: the permission is the entry point's fourth question, and the format is among the handler's. In all three cases, the most relevant is the one the `revisor` finds first, and what it finds first is decided by the order in which it asks. That is why that order is designed and documented.

### Solution 3

```text
$ curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a' -H 'Accept: text/html' -H 'Accept-Language: en'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/servicio-inexistente","title":"El servicio no existe","status":404,"detail":"no existe el servicio 99","instance":"/servicios/99"}

$ curl -i http://127.0.0.1:18080/servicioss -H 'Authorization: Bearer escritura-a' -H 'Accept-Language: en'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 111
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"about:blank","title":"Not Found","status":404,"detail":"no existe esa ruta","instance":"/servicioss"}

$ curl -I http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 404 Not Found
Content-Type: application/problem+json
Content-Language: es
Content-Length: 174
Date: Wed, 21 Oct 2026 13:18:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

None is `406`, and nothing changes language. The `revisor` does not negotiate its errors' content: it ignores `Accept` and `Accept-Language`, and sends `application/problem+json` in Spanish. RFC 9110 allows it: if no representation is acceptable according to a negotiation header, the server may answer `406` or treat the response as if there were no negotiation (section 12.4.1); and RFC 9457 sends its second example as `application/problem+json` to a client that only asked for `application/json` (section 3). For an error, it is best: the client receives the explanation instead of another error. The `about:blank` `title` stays in English because that is how it always is in the `revisor`, not because the client asked for it; the RFC would allow translating it with `Accept-Language`, and the `revisor` decides not to (section 5.5). And the `HEAD` carries the same headers as the `GET`, with `Content-Length: 174`, but no body: Node does not send it on a `HEAD`, and the length says how big it would be.

### Solution 4

The check, in `ejercicio4/problemas.ts` (fragment; the complete file is in the repository's `ejercicio4/problemas.ts`):

```ts
  for (const nombre of Object.keys(extensiones)) {
    if (RESERVADOS.has(nombre)) throw new Error(`la extensión ${nombre} usa un nombre reservado`);
    // RFC 9457, sección 4: empieza con letra, solo letras, dígitos y «_», y tres caracteres o más.
    if (!/^[A-Za-z][A-Za-z0-9_]{2,}$/.test(nombre)) throw new Error(`la extensión ${nombre} no cumple la forma del RFC 9457`);
  }
```

The expression says: a letter (`[A-Za-z]`), then two or more letters, digits, or underscores (`[A-Za-z0-9_]{2,}`), and nothing else (`^` and `$`). They are English-alphabet letters on purpose: it is what the RFC calls `ALPHA`, and an `ñ` is not. The run:

```text
$ node fig05_02.ts
ok    GET /servicios/99 (servicio que no existe)
ok    GET /servicios/3 (servicio de otro equipo)
ok    GET /revisiones/99 (revisión que no existe)
ok    GET /servicioss (ruta que no existe)
ok    PATCH /servicios/1 (método que la ruta no admite)
ok    GET /servicios (sin credencial)
ok    POST /servicios (cuerpo en texto)
ok    POST /servicios (cuerpo de más de 16 KiB)
ok    POST /servicios (datos imposibles)
ok    POST /servicios (nombre repetido)
ok    PUT /servicios/1 (cambio sin If-Match)
ok    GET /v0/servicios (versión retirada)
ok    GET /servicios/1/informe (error interno)

13 de 13 respuestas son Problem Details bien formados

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:c0160764-27de-42f7-866a-28ea3f622e08"}

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
Content-Language: es
Content-Length: 244
Date: Wed, 21 Oct 2026 13:18:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"type":"https://revisor.example/problemas/error-interno","title":"Error interno del revisor","status":500,"detail":"ocurrió un error inesperado; si se repite, reporta la referencia","instance":"urn:uuid:6e53e149-c257-402b-8ea7-2e74df849fb6"}
```

With the rule, the `revisor` still gives thirteen out of thirteen, because its two extensions comply with it. With `ex`, the repeated registration answers not `409` but `500`: the extension's name is a defect of the program, not of the client, and `fallar` refuses to send a body that does not meet the format. The terminal says it with the same reference the client received:

```text
POST /servicios
error c0160764-27de-42f7-866a-28ea3f622e08 en POST /servicios: Error: la extensión ex no cumple la forma del RFC 9457
    at fallar (file://<carpeta>/problemas.ts:54:59)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

With `status` the same happens, but through the other rule: the name's form is correct, and it is one of the five reserved. Without that check, the `...extensiones` would write over the catalog's `status` (section 5.9). The terminal, after the second restart:

```text
POST /servicios
error 6e53e149-c257-402b-8ea7-2e74df849fb6 en POST /servicios: Error: la extensión status usa un nombre reservado
    at fallar (file://<carpeta>/problemas.ts:52:39)
    at Object.darDeAlta [as manejador] (file://<carpeta>/servicios.ts:150:5)
    at async atender (file://<carpeta>/rutas.ts:107:3)
    at async atenderSinFiltrar (file://<carpeta>/servidor.ts:23:5)
```

That the defect comes out as a `500` and not as a malformed response is the point: an error that is noticed on the first test and not in someone else's client. Put `existente` back under its name when you finish.

## How I know I succeeded

- [ ] You say from memory the five members of a Problem Details, whom each is for, and which change between occurrences.
- [ ] `curl -i http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer escritura-a'` gives `404` with `Content-Type: application/problem+json`, `Content-Language: es`, and `"type":"https://revisor.example/problemas/servicio-inexistente"`; `/servicios/3` gives the same `type` and the same `title`.
- [ ] `/servicioss` gives `"type":"about:blank","title":"Not Found"`, and `PATCH /servicios/1` gives `about:blank`, `Method Not Allowed`, and `Allow: GET, HEAD, PUT, DELETE`.
- [ ] A registration with three bad fields gives `422` with `errors` and three `pointer`s (`#/nombre`, `#/url`, `#/limite_ms`); a registration with a repeated name gives `409` with `"existente":"/servicios/2"`.
- [ ] `GET /servicios/1/informe` gives `500` with `instance` `urn:uuid:…`, and you find that same reference in the `revisor`'s terminal, next to the stack trace.
- [ ] You explain why a client decides with `type` and not with `title` or `detail`, and why `about:blank`'s `title` is in English.
- [ ] An extension called `status` gives `500`, and the terminal says `usa un nombre reservado` with the same reference the client received.
- [ ] `node fig05_02.ts` gives `13 de 13`, and against `defectos/json-a-secas/` it gives `0 de 13`.
- [ ] When you finish, no program is left listening: `curl -i http://127.0.0.1:18080/` gives error 7.

## Summary

Answer without looking at the lesson:

1. What content type does a JSON Problem Details carry, and what does the client gain from it not being `application/json`?
2. What are the five members? Which is the problem's primary identifier, according to the RFC, and with what verb does it say so?
3. What does `about:blank` mean? What `title` does it carry and why?
4. What is translated and what is not translated in a Problem Details?
5. What rule ties `status` to the status line, and why can they not differ in the `revisor`?
6. What is `instance` in a `revisor` `404`, and what is it in a `500`? What is the second for?
7. What must a client do with an extension it does not know? What naming rules does an extension have?
8. How are several problems of the same type answered? And several of different types?
9. What three things changed from RFC 7807 to RFC 9457?

## Sources

All consulted on October 21, 2026.

1. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (July 2023, IETF proposed standard), section 3: the object, `application/problem+json`, the example of `errors` with `pointer`, and the rule for several problems.
2. [RFC 9457, section 3.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.1): the five members, the rule of ignoring a member with the wrong type, `type` as the primary identifier (3.1.1), `status` (3.1.2), `title` (3.1.3), `detail` (3.1.4), and `instance` (3.1.5).
3. [RFC 9457, section 3.2](https://www.rfc-editor.org/rfc/rfc9457.html#section-3.2): extensions and the obligation to ignore those that are not known.
4. [RFC 9457, section 4](https://www.rfc-editor.org/rfc/rfc9457.html#section-4): when to define a type, what to document, `Retry-After`, and the naming rules for extensions.
5. [RFC 9457, sections 4.2 and 4.2.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-4.2): the registry of types and `about:blank`, with the `title` equal to the code's phrase.
6. [RFC 9457, section 5 and appendix D](https://www.rfc-editor.org/rfc/rfc9457.html#section-5): the security considerations and the changes with respect to RFC 7807.
7. [IANA, *HTTP Problem Types*](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml): the official registry, with six entries and updated on June 26, 2026.
8. [IANA, registration of the content type `application/problem+json`](https://www.iana.org/assignments/media-types/application/problem+json): without parameters, referencing RFC 9457.
9. [RFC 7807, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc7807.html) (March 2016), the earlier version, now obsolete.
10. [*Indicating Details of Problems to Machines in HTTP*, draft-nottingham-http-problem-00](https://datatracker.ietf.org/doc/draft-nottingham-http-problem/00/) (July 4, 2012), the original draft and its warning.
11. [RFC 9110, *HTTP Semantics*, sections 8.5, 12.1, 12.4.1, 12.5.1, 13.2.1, and 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.5): `Content-Language` and the languages of a representation, the server's freedom not to negotiate, why the `415` goes before the precondition, and the `413`.
12. [RFC 6901, *JavaScript Object Notation (JSON) Pointer*](https://www.rfc-editor.org/rfc/rfc6901.html), sections 3 and 6: the syntax of `pointer` and its form as a URI fragment (`#/nombre`).
13. [RFC 9562, *Universally Unique IDentifiers (UUIDs)*](https://www.rfc-editor.org/rfc/rfc9562.html): the identifier of the `urn:uuid:` reference of internal errors.
14. [RFC 6761, *Special-Use Domain Names*](https://www.rfc-editor.org/rfc/rfc6761.html), section 6.5: `.example`, reserved for documentation.
15. [IANA, *HTTP Status Codes*](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml): the codes' official phrases, which are `about:blank`'s `title`.

### Terms in this lesson

| | |
|---|---|
| **Problem Details** | the RFC 9457 JSON object that explains an error from an HTTP API |
| **problem type** | a class of problems with a name of its own: the `type`, its `title`, its code, and its extensions |
| **occurrence** | one concrete time a problem happened; described by `detail` and `instance` |
| **`about:blank`** | the type that adds nothing to the status code; its `title` is the code's phrase |
| **extension** | a member of a problem type's own, besides the five standard ones |
| **JSON Pointer** | the standard way of pointing to a place inside a JSON, like `#/nombre` |
| **catalog** | the table of all of an API's problem types |
| **central handler** | the single function through which all error responses pass |

---

**Previous:** [Lesson 4 — Server capacity and failures: 429, 500, 502, 503, and 504](04-capacidad-y-fallas-del-servidor.md) · **Next:** [Lesson 6 — Retries and idempotency](06-reintentos-idempotencia.md)

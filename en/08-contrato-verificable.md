# Lesson 8 — The verifiable contract

It is 10:05 on a Tuesday and the first alert comes in from the integrations team at another company, the one that has spent three weeks building its program against the `revisor`'s API. They say their client has gone mad: it retries every fifty milliseconds, nonstop, against maintenance mode. Someone on your team looks at the logs and finds nothing odd. Maintenance mode answers `503`, as always. The team's tests passed last night, all green, and the availability dashboard is green. At 10:20 the second alert arrives: their program no longer recognizes the errors. It expected an `application/problem+json` and receives an `application/json`, so the branch that reads the `type` does not run, and it falls into the one that retries blindly. At 10:40, a third: the `503` no longer carries `Retry-After`, and their program, without that number, uses its default, which is almost nothing.

The cause shows up at 11:00, in a review of what was pushed on Monday. Someone did a "cleanup" of the central error handler: they unified the content type of all the responses and, while at it, removed a header that seemed superfluous to them. None of the **codes** changed. A `503` is still a `503`; a `404`, a `404`. And since the team's tests only asked about the code, none of them noticed. What changed was everything else the API promised in its responses: the content type, the wait header, the way a machine decides what to do. And that promise was not written anywhere a program could compare it with reality.

That promise is what this lesson builds: a description of the API in a format that machines read (OpenAPI), and a **matrix** that, with a single command, makes 23 requests, looks at what the API actually responds and compares it with what was promised, headers, content type and body shape included. If someone does another cleanup like Monday's, the matrix turns red on Monday itself, not on Tuesday at 10:05.

**Time:** 2 × 45 min (the break is between sections 8.7 and 8.8)

**What you build:** the OpenAPI 3.1 description of the `revisor` (`openapi.json`), with every route, every error and every header; the 23-scenario matrix (`matriz23.ts`) that starts the server, runs one scenario per code and shuts itself down; the same matrix written with `curl` (`fig08_03.sh`); a program that cross-checks the catalog of problem types against the document (`fig08_02.ts`); and the closing of the defense against *DNS rebinding* in `cliente.ts`, with a simulation that demonstrates it (`fig08_04.ts`) and a counter-test for the certificate (`fig08_07.ts`); and the programs used to measure a check that sometimes failed (`fig08_05.ts` for a network race, `fig08_06.ts` for a process's startup time and `fig08_08.sh` to repeat the matrix)

**What you learn:** what an OpenAPI description is and how it is read in five pieces (`info`, `servers`, `security`, `paths` and `components`); how to document each error with reusable responses, the `Problema` schema and the headers each code requires; how to check that the catalog of types and the document say the same thing; what a matrix checks and what it does not, and how to show that a test "bites" by undoing the fix and seeing it go red; the difference between a **valid** document and a **true** document; *DNS rebinding* and why connecting to the already validated address closes it; and how to document in OpenAPI the announced withdrawal of a version

**Where you are coming from.** From [Lesson 7](07-quien-lee-el-error.md), with a complete `revisor` on both its sides: as a server it produces the 23 codes with their Problem Details, and as a client it decides, with a table, whether to continue, correct, reauthenticate, wait, reconcile or give up. From [Lesson 5](05-problem-details.md) you inherit the catalog of problem types (`problemas.ts`) and the program of thirteen checks that announced this matrix; from [Lesson 6](06-reintentos-idempotencia.md), the `Idempotency-Key` header, which is documented here with the warning that it is not a standard, and the five-test checker, which the matrix repeats; from [Lesson 3](03-errores-del-cliente-estado.md), the `Deprecation` and `Sunset` notices of version 1; from [Lesson 2](02-errores-del-cliente-peticion.md), the decision that the shape of the API is not a secret, because it will be in a document anyone can read; and from [Lesson 1](01-exitos-redirecciones.md), the limit that was left declared: *DNS rebinding*, whose complete defense arrives today.

**What this lesson does not do.** It does not generate clients or servers from the document: the document is written by hand and checked against the server, which is a choice of the course and not the only possible one. It does not compare each response's body with its JSON schema field by field: the matrix checks that the code, the headers, the content type and the body's main members are present, and exercise 2 extends it one step. It does not publish a documentation page with the document (viewers exist that do so, and the course does not use them). It does not describe OAuth authentication or other schemes: the `revisor`'s credentials are practice ones, and the document declares them as `bearer`. And it does not promise that a green matrix means an API without defects: section 8.14 says what it does not see.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS, with Node 24.14.1 (the 24 LTS version the whole course runs on; later 24.x versions exist, and the outputs are from that one) and curl 8.7.1. The OpenAPI validator in section 8.11 is Redocly CLI 2.57.0 (published on September 30, 2026), installed with `npm install` in a separate folder, because it is a tool for reviewing and not a dependency of the programs, which still have none. Redocly writes part of its output to the error output and, if there is a newer version, prints an update notice box; that is why its runs carry `2>&1` and the variable `REDOCLY_SUPPRESS_UPDATE_NOTICE=true`, which hide only that box. The type check used TypeScript 7.0.2, as in the previous lessons. While this lesson was being written, other tests occupied the course's ports, so the series were run with a copy of the programs identical except for the ports (each series with its own, checked free before running), and in the outputs pasted here (and in their `.salida.txt` files) 18080, 18081 and 18082 were written back in, which are the ones you will type. They are numbers with the same digit count, so no `Content-Length` changes. In your run, the `Date` value, the last eight digits of each `ETag`, the measured milliseconds (`ms`), the time Redocly measures and the `urn:uuid:` values of the `500` errors will change. The tests in section 8.12 that query `https://example.com`, `https://expired.badssl.com` and `https://wrong.host.badssl.com` need internet; if your machine has none, skip that series and the others work the same. The complete matrix takes about 16 seconds on a laptop. Running the matrix dozens of times in a row, a race was found between closing a connection and sending a body; section 8.14 tells how it was found, how it was measured and how it was closed, with the before and after figures. The programs are in [`programas/08-contrato-verificable/`](../programas/08-contrato-verificable), in the course repository: the complete `revisor` in `fig08_01/`, the catalog cross-check in `fig08_02.ts`, the matrix with `curl` in `fig08_03.sh`, the *DNS rebinding* simulation in `fig08_04.ts`, the certificate counter-test in `fig08_07.ts`, the measurements of section 8.14.1 in `fig08_05.ts`, `fig08_06.ts` and `fig08_08.sh`, the deliberate defects in `defectos/`, the exercise solutions in `ejercicios/` and each run in its `.salida.txt` file. They all pass `tsc` in strict mode (section 8.16).

## By the end you will be able to

- Read an OpenAPI 3.1 document and identify its five main pieces, and explain what a `$ref` reference does and why error responses are written once and reused.
- Document a complete error response: its code, its `application/problem+json` content type, the `Problema` schema and the header that code requires (`Allow` on a `405`, `Retry-After` on a `429` and a `503`, `WWW-Authenticate` on a `401`).
- Run a program that cross-checks the catalog of problem types against the document, and explain why today it finds a gap and how it is closed.
- Run the 23-scenario matrix with a single command, read it line by line and say what is checked in each scenario: code, headers, content type, body, leaks in the `5xx` responses and presence in the document.
- Deliberately trigger two failures, one in the server and one in the document, and read the matrix in red; and explain why an external validator can say "valid" about a document that lies.
- Explain what *DNS rebinding* is, why validating before each connection does not fully close it, and show with a run that the lesson's client reaches the right server while one that uses `fetch` reaches the wrong one.
- Document in OpenAPI the announced withdrawal of a version, with `deprecated: true` and the `Deprecation`, `Sunset` and `Link` headers.
- Say, with measured examples, what the matrix cannot see, and extend it one step so that it does.

## The why before the how

An API is a promise made to people who are not in the room. Whoever wrote it knows what it does; whoever uses it only knows what they were told. Between the two there is a document, and that document has a birth defect: it is made of paper. It is written once, read carefully once, and from that moment the code changes every day and the document only changes when someone remembers. Over time, the document stops describing the API and starts describing what the API was like when someone remembered to update it.

There are two remedies, and this lesson brings them together. The first is that the document be **machine-readable**: if it is a file with structure, a program can read it, and what a program can read, a program can compare. The second is that this comparison **run by itself**, on every change, with a single command, and that it fail with a message that says which promise was broken. A document that is compared with reality every day looks a lot like a test; a test written from a document looks a lot like a promise. Hence the name of the lesson: a *verifiable* contract is one that can be verified without asking anyone's permission.

This order has an uncomfortable consequence, and it is worth saying up front: there are three places where the lie can be. It can be in the **server**, which changed and the document did not (the opening scene). It can be in the **document**, which says something the server never did. And it can be in the **test**, which, green or red, does not look at what matters. An OpenAPI validator can only say whether the document is well written; it knows nothing about the server. A test of codes only looks at codes. This lesson's matrix looks at all three places at once, and even so it has blind spots that section 8.14 lists, because a verification that does not say what it does not see has the same problem as the paper document.

The lesson has five parts:

1. **The document** (8.1 to 8.5): what OpenAPI is, how it is read, how errors are documented and how the catalog of types is cross-checked against what is written.
2. **The matrix** (8.6 to 8.9): how it is built, what it checks in each scenario, how it is run and its `curl` version.
3. **Making the test bite** (8.10 and 8.11): how to show that a verification detects what it says it detects, and why a valid document is not the same as a true document.
4. **The gap left from Lesson 1** (8.12): *DNS rebinding* and its closing.
5. **Versions and limits** (8.13 to 8.16): the announced withdrawal of a version in the document, what the matrix does not promise, the complete `revisor` and the type check.

## The concepts

### 8.1 This lesson's `revisor`

#### 8.1.1 What changes

The Lesson 7 `revisor` gains two new files, `matriz23.ts` and `openapi.json`, and changes three: `cliente.ts`, `destinos.ts` and `respuestas.ts`. Everything else is that of the previous lessons in its current version, and the routes, codes, headers and field names do not change.

- **`openapi.json`** (new) is the description of the API in OpenAPI 3.1.1: every route, every method, every response (successes and errors), the body schemas and the headers. It is the center of sections 8.3 to 8.5.
- **`matriz23.ts`** (new) starts the lab and the `revisor`, runs through 23 scenarios (one per course code) and eighteen additional checks, and shuts them down. Instead of waiting a fixed time after starting each process, it waits for the port to accept connections, and if any port is already in use it measures nothing and says so. It exits with code `0` if everything passed and with `1` if something failed (`2` if it could not start because a port was busy). It is the center of sections 8.6 to 8.10.
- **`cliente.ts`** changes in `consultar` and gains two support functions, `soloA` and `pedir`: instead of `fetch`, it uses `http.request` or `https.request` and connects to the address that `destinos.ts` already validated. It is section 8.12.
- **`respuestas.ts`** changes in a single function: when the body exceeds the cap, the `413` goes out immediately and the connection is closed **in stages** (first only the write side; the server keeps reading and discarding whatever arrives, and destroys the connection after 2 seconds). It is the story of section 8.14.1.
- **`destinos.ts`** changes one thing: `revisarDestino` now returns, along with the "yes", the addresses it validated (`{ permitido: true, direcciones }`), so that whoever connects uses one of those and does not ask the DNS again.

The outcomes of `consultar` do not change: there are still the same five kinds of result (response, timeout, no connection, invalid response and forbidden destination), the same classification into `ARRIBA`, `LENTO` and `CAIDO`, and the same codes in each server response. That is why `revisar.ts`, `tabla23.ts` and `por-type.ts`, the three programs from Lesson 7, give the same as before.

#### 8.1.2 Setting up the folder and checking that it runs

The `revisor` lives in `~/curso-http/fig08_01/`; section 8.15 brings all its files. With Node 24 installed, and from that folder, a single line checks that everything is in place:

```text
$ cd ~/curso-http/fig08_01
$ node matriz23.ts
```

The matrix starts the lab and the `revisor` by itself, so you do not need to open separate terminals. What it does need is for ports 18080, 18081 and 18082 to be free. If one is busy, the matrix says so and exits with `2` without measuring anything; the most common cause is a `revisor` from an earlier lesson that you left open: stop that program with `Ctrl+C` and start over. Section 8.7 runs the matrix and reads its output line by line.

### 8.2 A contract that can be checked

#### 8.2.1 What a response promises

Before opening the document it is worth counting what a response promises, because the document has to say everything and the test has to check everything. An HTTP response promises four things:

1. **The status code.** It is the first thing any machine along the way reads. It is what Lesson 0 called "the code rules".
2. **The headers that this code requires or that the design decided on.** A `405` requires sending `Allow` (RFC 9110, section 15.5.6: "The origin server MUST generate an Allow header field in a 405 response"). A `401` carries `WWW-Authenticate`. A `201` carries `Location` and, in this API, `ETag`. A `429` or a `503` carry `Retry-After`, which section 15.6.4 of the same RFC allows on the `503` with a "MAY". That difference matters: what the RFC leaves optional, this API decided to send in every response that allows it, and it promises it in its document.
3. **The content type.** An error is `application/problem+json`; a success with a body is `application/json`; a `204` and a `304` carry no body. The content type is what tells a program how to read what follows.
4. **The shape of the body.** In a Problem Details, the five members (`type`, `title`, `status`, `detail`, `instance`) and, depending on the type, extensions such as `errors` or `existente`.

The opening scene broke two of the four (the header and the content type) and left the first intact, which was the only one anyone checked. It is a common pattern: what is easy to test gets tested, and the status code is the easiest. A complete verification has to climb from what is easy to what matters.

#### 8.2.2 The three places where the lie can be

If the document, the server and the test are three different things, there are three ways for a promise to be broken without anyone seeing it.

- **The server changes and the document does not.** It is the opening scene. The API does something different from what the document says. Whoever read the document and wrote their client from it ends up with a program that works against an API that no longer exists.
- **The document says something the server never did.** It is the least discussed case and the most common in documents written by hand: what was meant to be done is documented, or what was done on another branch, or what was copied from another API. The server never returns that `429` or that header. Whoever trusts the document writes code for a case that does not exist and does not write the one that does.
- **The test does not look at what matters.** A green test says that what it looked at is fine. It says nothing about what it did not look at, and section 8.14 (point 2) and exercise 2 trigger this case with a measured example: the matrix that already exists, with a server that lacks one of the five members in all its errors, gives 40 of 41 and hardly notices.

That is why this lesson does not stop at writing the document. It writes it, compares it with the server, and then **undoes** the server and the document on purpose, to see that the comparison turns red. A check that was never seen failing proves nothing: it would give green just the same if it were broken.

#### 8.2.3 Why OpenAPI

For a program to compare, the document has to be in a format with structure. The most widespread format for describing HTTP APIs is **OpenAPI**, a public specification of the OpenAPI Initiative. The version the course uses is **3.1.1**, published on October 24, 2024 ([spec.openapis.org](https://spec.openapis.org/oas/v3.1.1.html)). There are also patch **3.1.2** and the **3.2** line (3.2.0 and 3.2.1), which are on [the versions page](https://spec.openapis.org/oas/). The course stays with 3.1.1 because all its section citations and all its outputs were taken against it; it was not checked which tools already understand 3.2, and mixing versions in a lesson that cites section numbers would be a source of errors. If you start a new document, first look at which of the three your tool understands. An OpenAPI document can be written in JSON or in YAML, and the course uses JSON because Node reads it without any dependency.

Version 3.1 brought a change that shows in the `revisor`'s document: it aligns the data schema with **JSON Schema 2020-12**. Section 4.8.24 of the specification says that OpenAPI's schema object is a superset of that version of JSON Schema. In practice, when a field can be null, you no longer write `nullable: true` as in 3.0, but a list of types: `"type": ["object", "null"]`. You will see it in the `Resultado` schema, which is `null` while a check is pending ([the OpenAPI blog post on the move from 3.0 to 3.1](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) tells about that and other changes).

### 8.3 OpenAPI in five pieces

A 1,191-line OpenAPI document is intimidating, but it reads like a book with five chapters. What follows walks through them with the `revisor`'s `openapi.json` open beside you; the quotes and section numbers are from specification 3.1.1.

#### 8.3.1 Piece 1: `openapi` and `info`

The document starts with four fields that are read at a glance (`openapi`, `info`, `servers` and `security`):

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

That last line opens piece 4, which we see in 8.3.4. The above are pieces 1, 2 and 3.

`openapi` says **which version of the specification** the document follows: `3.1.1`. It is the first thing any tool reads, because how to interpret the rest depends on it.

`info` describes **the document**, and here there is a trap worth a line of its own. The `info.version` field sounds like "the API's version", and it is not: section 4.8.2.1 of the specification defines it as the version *of the OpenAPI document* (which is different from the version of the specification), and section 4.8.1.1 clarifies that it has no relation to the `openapi` field. The `revisor` has a current API (the root one, `/servicios`), a deprecated version 1 and a withdrawn version 0; if `info.version` were "the API's version", which of the three would it be? That is why the document's `description` says it in so many words: `info.version` is the version of *this document*. It is the kind of clarification that saves a half-hour discussion with whoever reads it for the first time.

`license` says under what license the document is published. The one the course uses is CC BY-SA 4.0, and the `identifier` field uses the SPDX identifier, `CC-BY-SA-4.0`.

#### 8.3.2 Piece 2: `servers`

```json
"servers": [{ "url": "http://127.0.0.1:18080" }]
```

It is the list of addresses where the API lives. If the field is absent, the specification says (section 4.8.1.1) that the default value is a server with the `url` `/`, that is, the same place the document is served from. The `revisor` writes it out in full because, in the course, the document travels in a file and is not served from anywhere.

Notice what is **not** in that list: no company's internal address or machine name. An OpenAPI document almost always ends up published; everything you write in `servers` will be read by anyone. For the course it is `127.0.0.1:18080`, which is nobody's machine.

#### 8.3.3 Piece 3: `security` and `securitySchemes`

The `security` list above says that, unless an operation says otherwise, all of them ask for a scheme called `credencial`. That name is defined further down, in `components`:

```json
    "securitySchemes": {
      "credencial": {
        "type": "http",
        "scheme": "bearer"
      }
    },
```

They are three lines with a lot of content: the scheme is of type `http`, and its scheme (`scheme`) is `bearer`, the one the `revisor` uses with `Authorization: Bearer lectura-a`. Why isn't `Authorization` documented as a header parameter, as is done with `Idempotency-Key`? Because the specification does not take it into account: section 4.8.12.2.1 says that, if a parameter is in the header and is called `Accept`, `Content-Type` or `Authorization`, the definition is ignored. The three headers have their own mechanism, and the credential's is this one.

There are routes that do not ask for a credential: the old redirects (`/viejo/servicios`, `/api/servicios`) and the withdrawn version (`/v0`). For those, `"security": []` is written in the operation. An empty list means "none", and it is written that way in the specification (section 4.8.10.1): "To remove a top-level security declaration, an empty array can be used." It is the way to tell, in the document, what Lesson 2 told in one sentence: the route and the method come before the credential.

#### 8.3.4 Piece 4: `paths`

Here is the body of the document. `paths` is an object with one entry per **route**; each route has one entry per **method** (the specification allows eight: `get`, `put`, `post`, `delete`, `options`, `head`, `patch` and `trace`, in section 4.8.9.1), and each method describes an **operation**. The `revisor` has twelve routes and seventeen operations. This is a complete one, the shortest of those that have errors, the one that removes a service:

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

It is read from top to bottom:

- `summary`: a sentence for whoever reads the document. No machine uses it to decide anything.
- `responses`: the map of what this operation can respond, with the **code as key**. The keys go in quotes because in JSON every key is text, and the specification (section 4.8.16.2) says so: any code can be used as a name, and only one property per code. The object must contain at least one response (section 4.8.16: "MUST contain at least one response code").
- `"204"`: the only success response. A response *must* carry `description`; it is the only mandatory field of a response (section 4.8.17.1), and that is why even the `204`, which returns no body, carries it.
- The rest of the responses are `{ "$ref": "…" }`, which is explained in 8.4. For now it is enough to know that each one points to a place in `components` where it is written only once.

That operation says nothing about its route. The `{id}` parameter is in the route's entry, one level up, because the `GET`, the `PUT` and the `DELETE` share it:

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

The `id` parameter is `in: path`, is required and is an integer greater than or equal to 1. The specification allows four places for a parameter (`query`, `header`, `path` and `cookie`, in section 4.8.12.2.1); the `revisor` uses `path` for the `id` and `header` for `If-Match`, `If-None-Match` and `Idempotency-Key`.

#### 8.3.5 Piece 5: `components`

It is the store of the pieces that are reused. It has five drawers in this document: `securitySchemes` (you have already seen it), `parameters` (the `Idempotency-Key` key), `headers` (nine headers with their description), `responses` (eighteen reusable error responses) and `schemas` (the bodies). A piece is used from any point in the document with a **reference**: an object `{ "$ref": "#/components/responses/E401" }`. The text after the hash sign is the path inside the same document: `components`, then `responses`, then `E401`.

Why is it stored there and not written where it is used? Because the `revisor`'s document has seventeen operations and **79 references to the eighteen error responses**. If each were written out in full, the `401` would appear 12 times with its `WWW-Authenticate` header, and it would be enough for someone to correct 11 of the 12 for the document to contradict itself. With the reference, the `401` is corrected once. It is the same argument as in Lesson 5: the catalog in `problemas.ts` is a single table and not twenty-four sentences scattered around.

> **A subtlety of references.** In version 3.1, a reference object can also carry a `summary` and a `description` that **replace**, by default, those of the referenced piece (section 4.8.23.1). The `revisor` does not use it: all its references are plain `$ref`, so what the reusable response says is what anyone reads.

### 8.4 Documenting each error

#### 8.4.1 A complete reusable response

This is the `401` response, as it lives in the document:

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

It has three parts, and all three are promises that the matrix will check.

The **`description`** says when it happens and states the `type` it carries. It is text for people, and it is the only part where the document names the `type` (more on this in 8.5).

The **`content`** is a map whose keys are content types. The key is `application/problem+json`, not `application/json`, and that is exactly the promise that the "cleanup" in the opening scene broke. Below, the `schema` points to the `Problema` schema (you see it in 8.4.3).

And the **`headers`** say which headers accompany this response. There is a classic trap here, and the specification names it: if a response defines a header called `Content-Type`, that definition is **ignored** (section 4.8.17). The content type is not documented as a header, it is documented as the key of `content`. That is why in the `401` only `WWW-Authenticate` appears, which is the one the code requires, and the content type is somewhere else.

#### 8.4.2 The headers that each code requires or promises

The `revisor`'s document declares headers in six of the eighteen responses. The table shows which ones and where each comes from:

| Response | Header | Who asks for it |
|---|---|---|
| `E401` (`401`) | `WWW-Authenticate` | RFC 9110, section 15.5.2 ("MUST send a WWW-Authenticate header field"), and the Bearer scheme of RFC 6750; Lesson 2: the credential challenge |
| `E405` (`405`) | `Allow` | RFC 9110, section 15.5.6: "MUST generate an Allow header field" |
| `E415` (`415`) | `Accept` | Lesson 2: which types are accepted |
| `E429` and `E429Salud` (`429`) | `Retry-After` | Lesson 4: how long to wait |
| `E503` (`503`) | `Retry-After` | RFC 9110, section 15.6.4: the server "MAY" send it, and this API decided to send it |

Notice the difference between the last two rows and the earlier ones. The `405` **requires** its header: without `Allow`, the response violates the RFC. The `503` only **allows** it: another API could answer `503` without `Retry-After` and still comply with the RFC. But **this** API, the `revisor`'s, sends it on every `503`, and that is a promise of its own that the document writes down, and that whoever integrates it will use to wait properly. The opening scene broke precisely a promise of its own, not one from the RFC; that is why the matrix checks both kinds with the same rigor.

#### 8.4.3 The `Problema` schema

The body of every error is a Problem Details (Lesson 5), and it is written only once:

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

Those are the five members that **this API** promises in every error (`required`). It is worth saying carefully: RFC 9457 (section 3.1) does not require all five, and `type` defaults to `about:blank` if absent. Requiring them all is a stricter promise than the RFC's, and that is why the document writes it and the matrix checks it. The list of `properties` follows, which includes the five plus the two extensions the catalog uses: `errors` (the `422` rows, each with its `pointer`) and `existente` (the path of the service that already exists, in the `409` for a repeated name). And it closes with a line that looks like an oversight and is a decision: `"additionalProperties": true`. RFC 9457 allows adding extension members to a Problem Details; a schema that forbade them would say something false about the API as soon as a new problem type added one. Leaving them open is honest: the schema lists the ones in use today without closing the door to tomorrow's.

The `application/problem+json` content type is registered with IANA with RFC 9457 as its reference ([registry](https://www.iana.org/assignments/media-types/application/problem+json)); it is the key of `content` in every error response.

#### 8.4.4 Where what is not an error fits: successes, empty bodies and PATCH's 405

Successes are documented with the same care as errors, because a client also builds things from them. The `201` of `POST /servicios` declares its two headers, `Location` and `ETag`, and the `Servicio` schema. The `304` and the `204` declare their `description` and no `content`, and that absence is a promise: they carry no body, and the matrix checks it by asking whether the body arrived empty.

One case remains that the specification does not let you write the way you would like: the `405` of `PATCH`. No `revisor` route accepts `PATCH`, and OpenAPI describes **operations that exist**; declaring `patch` on a route to document that it is not accepted would make the document say the opposite (that there is a `PATCH`). The way out in the document is to put the `405` on the operations that do exist (`GET`, `PUT` and `DELETE` of `/servicios/{id}`) and say there that any other method gets that response, with its `Allow` header. The matrix uses that route's `GET` operation for the `405` scenario (it declares so in the `operacion` field, section 8.6), and exercise 3 has you test it.

#### 8.4.5 The header that is not a standard

`Idempotency-Key` is documented as a reusable parameter:

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

The `description` does what Lesson 6 said this lesson would do: it warns that it is a pattern of the API and **not a standard**, and why. The IETF draft it is based on, `draft-ietf-httpapi-idempotency-key-header-07`, expired on April 18, 2026 without being published as an RFC. `required: false` is the other half of the promise: whoever does not send it is still served, just as before Lesson 6. A document that simply said `Idempotency-Key` without the warning would be promising, unintentionally, that any other API understands it the same way.

### 8.5 The catalog of problem types, cross-checked against the document

Lesson 5 promised that the catalog of types could be "read, reviewed and documented all at once". There is a cheap way to check that the document keeps this promise: take the catalog (`CATALOGO` in `problemas.ts`, with 24 types since Lesson 6 added two) and, for each one, ask the document two things: does any operation declare its code? does the document name its `type`? That is what `fig08_02.ts` does. It needs no server: it reads two files.

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

Read it in blocks:

- **The reading lines.** `import { CATALOGO }` brings in the server's table; `readFileSync` reads the document *twice*, as text (to search for names) and already converted to an object (to walk the codes). It is the same information seen from two angles, on purpose.
- **`documentados`** is the set of all the codes that some operation declares. The three nested `for` loops walk routes, operations and the keys of each `responses`.
- **The main loop** walks the 24 catalog entries. For each one it computes `nombre`, which is the last part of the `type` (`servicio-inexistente`), except with `about:blank`, which has no name of its own: it is the same for all those errors.
- **The gap** is counted if the code is missing, or if there is a name and the document's text does not contain it.
- **At the end**, the exit code is `0` only if there are no gaps. That allows it to be used in a script or in a continuous integration step.

Run it from the folder that contains `fig08_01/`:

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

In none of the rows does a **NO** appear except in one: `revision-inexistente`, and it is not a failure of the program: the gap exists. To see it with your own eyes, ask the server for what the document promises for that route, and compare it with what really happens on the neighboring route:

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

Compare the two responses. `GET /revisiones/99` answers a `404` whose `type` is `revision-inexistente`. `GET /servicios/99` answers another `404`, with the `type` `servicio-inexistente`. But the document has **a single** `404` response for both routes, `E404`, and its `description` says "type servicio-inexistente or about:blank". For the revisions route, that sentence is false: whoever reads the document will expect a `type` that this route never returns, and will not know that the one it does return exists.

Why didn't the matrix see it? Because the `404` scenario asks for a service that does not exist (`/servicios/99`) and only checks that the `404` is declared on that operation. Nobody asked `/revisiones/{id}` for its `type`. It is a general lesson: **a verification that does not look at a case knows nothing about that case**, and this section's cross-check found what the matrix, by design, does not look at. Fixing it is exercise 1.

> **The three blind spots of this cross-check.** First, it searches for the name *anywhere* in the document's text: if `revision-inexistente` appeared in another route's description, the cross-check would say "yes" even though `/revisiones/{id}` were still wrong. Second, for the types with `about:blank` it checks nothing about their name, because they have none. Third, it does not check that the catalog's `status` matches the route where it is documented. It is a cheap safety net, not a complete test; the matrix in section 8.6 is the one that looks at the real responses.

### 8.6 The 23-scenario matrix: how it is built

`matriz23.ts` has about 680 lines (`wc -l` gives 676), and an important part is data, not logic. That is the first design decision and it is worth seeing before the code: the 23 scenarios are not 23 functions, they are 23 **rows of a table**, and a single function walks through them. Adding a scenario is adding a row; changing what is checked is changing one function, not 23.

#### 8.6.1 A scenario is data

Each row has the shape of this type:

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

Field by field:

- **`codigo`** and **`nombre`**: the code that is expected and a phrase for the output line.
- **`operacion`**: the method and the route **exactly as `openapi.json` writes them**. They are not those of the request: the request may be `GET /servicios/99` and the operation `["get", "/servicios/{id}"]`, because in the document the route carries the parameter in braces. With this field the matrix knows where to look in the document to see whether the code is declared.
- **`antes`** (optional): the requests that must be made **before** the one that is measured, to leave the server in the state where the code happens. For a `429`, three previous checks are needed; for a `503`, turning on maintenance.
- **`peticion`**: the one that is measured. A method, a route, headers and a body.
- **`cabeceras`**: the ones the response **must** carry. It is a list of names, and the comparison is case-insensitive (HTTP headers are).
- **`tipo`**: the expected content type, or `null` if there must be no body.
- **`type`**: for errors, the Problem Details `type`.
- **`revisarCuerpo`**: an optional function for what is specific to that scenario, such as "the `existente` extension points to `/servicios/2`".

Two rows, to see them at work. The `429` one:

```ts
  { codigo: 429, nombre: "demasiadas revisiones", operacion: ["post", "/servicios/{id}/revisiones"],
    antes: [1, 2, 3].map(() => ({ metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE })),
    peticion: { metodo: "POST", ruta: "/servicios/2/revisiones", cabeceras: ESCRIBE },
    cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "demasiadas-revisiones" },
```

Three previous checks, and the fourth is the one measured. It expects the `retry-after` header, the `application/problem+json` content type, and the `type` `demasiadas-revisiones`. And the maintenance one:

```ts
  { codigo: 503, nombre: "mantenimiento", operacion: ["get", "/servicios"],
    antes: [{ metodo: "PUT", ruta: "/mantenimiento", cabeceras: { Authorization: "Bearer admin", ...JSON_ }, cuerpo: '{"activo":true}' }],
    peticion: { metodo: "GET", ruta: "/servicios", cabeceras: LEE }, cabeceras: ["retry-after"], tipo: "application/problem+json", type: PROBLEMA + "en-mantenimiento" },
```

Before requesting the list, it turns on maintenance with a `PUT /mantenimiento` made by `admin`. Notice that this scenario's `operacion` is `["get", "/servicios"]` and not `/mantenimiento`: the `503` is documented on the operations that *can return it*, and the matrix looks for the code where a client would see it.

#### 8.6.2 Order matters, and it is written down

The scenarios share a single server, which keeps its state in memory, so the order in which they run is part of the test. The matrix's list respects four dependencies, and it is worth knowing them because they are the first to break when someone reorders:

- The **`201`** registers a service that gets id 7 (the startup ones are six). The **`204`** removes it, and then the **`410`** requests it again and finds that it was removed. If the `410` ran before the `204`, it would give `200`.
- The **`500`** uses service 4, the one that has no finished checks: it is the deliberate defect from Lesson 4, and it lives until this lesson precisely to have a `500` to trigger.
- The **`503`** turns maintenance on in its `antes`, and the **`504`** turns it off in its own. If nobody turned it off, everything that follows would give `503`.
- The **`304`** needs the current `ETag` of service 1, which changes on every startup. The matrix reads it **once at the start**, before the first scenario, and keeps it in `SIN_CAMBIOS`.

#### 8.6.3 The function that checks

The `comprobar` function receives a scenario and returns a **list** of failures; the empty list means it passed. This is the complete one:

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

Follow the lines in the order they run:

1. **The previous requests.** They are sent and their body is discarded with `.text()`, because a response that is not read leaves the connection busy.
2. **The measured request.** It is sent with `enviar`, which uses `fetch` with `redirect: "manual"`. That option matters: a `301` or a `308` has to be seen as a `301` or a `308`, not as the response of the route that `fetch` would have ended up on by itself. To check a redirect, you must not follow it.
3. **The code.** If it is not the expected one, a failure is added.
4. **The headers.** Each name in the list has to be in the response.
5. **The content type and the body.** If the scenario expects no body, the text has to come empty. If it expects one, the type has to match; and only if it matches is the body read as JSON. If the scenario is an error, three Problem Details members are checked: `type`, `status` equal to the code and `title` of type text.
6. **The scenario's own check**, if it has one.
7. **The leaks**, only on the `5xx`. They are explained below.
8. **The documentation.** If the document does not declare that code on that operation, there is a failure. It is the line that joins the matrix with `openapi.json`.

There is a decision in the structure that goes unnoticed until something fails: the function **gathers all the failures** and does not stop at the first. With the scene's "cleanup", the `503` fails for two reasons (`retry-after` is missing and the type is `application/json`); a test that stopped at the first would report one, whoever fixes it will see the other in the next run, and will lose another round. It is the same policy as Lesson 3's `422`, which gathers all the body's failures.

#### 8.6.4 The leaks

Server errors are the ones that most tend to tell too much. A badly handled `500` can return the exception's stack, and the stack carries file paths, function names and sometimes data. Lesson 4 taught to say only a reference in a `5xx`; the matrix watches for it with a list of patterns that should not appear in the body of a `5xx`:

```ts
const FUGAS = [/\bat \S+ \(/, /file:\/\//, /\/(home|Users)\//, /node:internal/, /\bSELECT\b.+\bFROM\b/i, /Bearer \S+/, /TypeError|ReferenceError/];
```

Read them one by one:

| Pattern | What it catches |
|---|---|
| `\bat \S+ \(` | a JavaScript stack line: `at name (file:line)` |
| `file://` | a file address, like those Node prints in stacks |
| `\/(home\|Users)\/` | a user folder of a real machine |
| `node:internal` | a Node internal frame |
| `\bSELECT\b.+\bFROM\b` | an SQL query |
| `Bearer \S+` | a credential |
| `TypeError\|ReferenceError` | the name of a JavaScript exception |

The list is not exhaustive, and cannot be: it is a set of signals for what has already been seen, not a guarantee that there are no others. It covers the most common ones for this kind of server. It is applied **only to the `5xx`** because that is where the unexpected leaks in; a `404` or a `422` is written by the central handler with phrases from the catalog.

#### 8.6.5 Start, measure and shut down

The last thing the program does is bring up what it is going to measure and shut it down, no matter what:

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

Before starting anything, the matrix checks that the three ports are free: if one responds, it says which and exits with `2`, because measuring against someone else's program is measuring what is not yours (the exercise "The server that stayed open" shows it). The two `spawn` calls start the lab and the `revisor` as child processes, with the same version of Node that runs the matrix (`process.execPath`), and `esperarPuerto` (at the beginning of the file, explained in 8.14.1) waits for each to accept connections instead of counting a fixed time. If one does not answer in 10 seconds, the `catch` says so and the run ends with `1` without a summary. The `try … finally` is the part that makes the matrix honest: whatever happens in the checks (an exception, a failure, a process that did not start), the `finally` shuts down both children. Without it, an error halfway would leave two processes listening on ports 18080 and 18081, and the next run would fail for a reason that has nothing to do with what is being measured.

The last line matters for whoever uses the matrix in a script: the program exits with `0` if there were no failures and with `1` if there was any. That is what allows putting it in a continuous integration step and having the step turn red. Notice also that it uses `process.exitCode` and not `process.exit(…)`: it sets the code and lets the program end on its own, which allows the children and the connections to close calmly.

### 8.7 Running it and reading it

From the `fig08_01/` folder, with ports 18080, 18081 and 18082 free (the third is used by the gateway for one of the additional checks):

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

Read it in blocks.

**The first seven lines** (`200` to `308`) are the successes and redirects. Each one passed the same exam as the errors, but in another form: the `200` and the `201` carry an `application/json` body and the `etag` headers (and `location` on the `201`); the `304`, the `204`, the `301` and the `308` carry no body, and the matrix checks that the text comes empty. The `301` and the `308` are `POST`: it is the pair from Lesson 1, with the same request and two redirects that behave differently in the client.

**The next sixteen** (`400` to `504`) are the errors. Each one checked `application/problem+json`, the catalog's `type` and, in five of them, a header: `www-authenticate` on the `401`, `allow` on the `405`, `accept` on the `415`, `retry-after` on the `429` and the `503`. The `403` has its own check that already appeared in Lesson 2: the body does **not** repeat the credential `lectura-a`. And the `500` checks that `instance` is a `urn:uuid:…`, the reference the client can give to whoever operates the server.

**The last eighteen** are not codes. They are additional checks, and section 8.8 explains them.

**The second-to-last line** adds up: "41 of 41 checks passed (23 code scenarios and 18 additional)". And the last line, `(código de salida: 0)`, is the one a script reads.

Two reading details. The SSRF line says `http://localhost:18080/mantenimiento`: the matrix tries to register a URL with a name that resolves to the machine itself, and expects a `422` with the type `destino-prohibido`. And the time: the run takes about 16 seconds, and a good part are deliberate waits: the startup, the `504`'s slow check, the retries of `alta-segura.ts` and the `revisor` restarts.

### 8.8 The other eighteen checks

Once the 23 codes are green, the matrix runs through eighteen more checks. Each one was born from a concrete defect that the earlier lessons measured at the time, and exists so that this defect **does not return without anyone noticing**. They are called **regressions**: tests of something that was already fixed once.

| # | What it checks | Which lesson it comes from |
|---|---|---|
| 1 | `Idempotency-Key`: the same key does not duplicate; with another body, `422` | 6 |
| 2 and 3 | SSRF: two URLs (`169.254.169.254` and `localhost`) are rejected with `422 destino-prohibido` | 1 |
| 4 | A credential that only exists in `Object.prototype` (`constructor`, `__proto__`, `toString`) gives `401` | 2 |
| 5 | Conditional requests: `If-None-Match` with a list, `W/` and `*` gives `304`; `If-Match` with `W/` gives `412`; with a list or `*` gives `200` | 1 and 3 |
| 6 | The lost update: two simultaneous `PUT`s with the same `If-Match`, `200` and `412` | 3 |
| 7 | The `PUT` order: `text/plain` gives `415` with an old tag or without one; if it is removed in the gap, `410` | 3 |
| 8 | The `bearer` scheme case-insensitive, and the `Basic` challenge without `error="invalid_token"` | 2 |
| 9 | An inherited method (`constructor`, `toString`, `__proto__`) gives `405` | 1 and 2 |
| 10 | A JSON body that is not an object (`null`, `7`, `"texto"`, `[]`) gives `400`, and the `revisor` stays alive | 1 |
| 11 | The 16 KiB cap: `413` with `Content-Length` and in chunks; right at the cap, `400` | 2 |
| 12 | The per-credential limit: the fourth live query, `429`; another credential does not pay for it; enumerating ids reaches `429` | 4 |
| 13 | Strict `Retry-After`: `1.5`, `-1` and "12 30" are ignored; the three date forms give the same | 4 |
| 14 | SSRF with twelve special-use addresses, rejected; a 6to4 with a public IPv4, accepted | 1 |
| 15 | The gateway forwards `Content-Length`; without a `revisor` it answers `502` and stays alive; `alta-segura.ts` ends when it runs out of attempts, also without a connection | 6 |
| 16 | `alta-segura.ts` decides: a `4xx` exits with `1`; it obeys `Retry-After` if reasonable and does not insist if it asks for too much; it cuts off by time against a mute server; the `409` of a key in progress is retried and the one for a repeated name is not | 6 |
| 17 | The `ETag` after restarting the `revisor`: the old one no longer matches | 1 |
| 18 | The test bench answers the `205` without a body (RFC 9110, section 15.3.6), with `Content-Length: 0` (without it, the `205` has no declared length and would be read until the connection closes: RFC 9112, section 6.3) and without `Transfer-Encoding` (the bench's decision: Node would send `chunked` with an empty body; the RFC does not forbid it on the `205`) | 0 |

Three of them have a technique worth seeing, because they show how to test something that cannot be triggered with a normal request.

#### 8.8.1 The lost update: a body that arrives in pieces

To test that two simultaneous `PUT`s with the same tag do not overwrite each other, you have to get one to **be waiting for its body** while the other writes. A normal `fetch` sends headers and body together, so there is no gap. The solution is a body delivered in two stages:

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

The slow request's body is a `ReadableStream`. It delivers **ten characters right away** (without that, `fetch` does not even send the headers) and the rest when the `suelto` promise is fulfilled. The `duplex: "half"` option is mandatory when the body is a stream: the `fetch` specification requires it and `"half"` is the value used in Node, and it means that the request is sent in full before reading the response. Without it, `fetch` rejects with `TypeError: RequestInit: duplex option is required when sending a body.` (measured with Node 24.14.1). Meanwhile, the fast request changes the service with the same tag. When the fast one finishes, `soltar()` is called, and the slow one finishes sending its body. The server, which compared the tag at the start, compares it again when writing (Lesson 3), finds it stale and answers `412`. The three final checks close the case: the fast one gives `200`, the slow one gives `412`, and the service ends up with the fast one's value.

This test **hardly depends on luck**. You could try with two simultaneous `fetch` calls and hope they coincide, and it would be a case that sometimes fails and sometimes does not. Here the only clock wait is the 300 ms given to the first chunk to arrive; from there on the order is forced by the program (`soltar()`), not by chance.

#### 8.8.2 The inherited method: knocking on the door with no server

`Object.prototype` has methods with names like `constructor` or `toString`. If the `revisor`'s entry point looked up a request's method in an ordinary object, `constructor` would appear as if it were a method of the route. The fix is to look it up with `Object.hasOwn`. How do you check it, if Node answers `400` to a method it does not know before calling the `revisor` (you can see it with `curl -X constructor`)? By calling the entry point **directly**, with no server:

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

The function imports `atender` from `rutas.ts` and calls it with a **fake** request and response: two objects with only what the entry point reads. If the entry point answers with a `405` (the `statusCode` that `writeHead` received), all is well; if it throws an exception, the `listo` promise resolves with the text "excepción …". Before calling, it silences `console.log`, because the entry point writes every request to the terminal and here it would run inside the matrix; and it restores it when finished. It is a **unit** test inserted in an integration matrix, and that is fine: what matters is that it runs, not the name of the kind of test.

#### 8.8.3 The ETag after restarting: kill and bring up

The last technique is to restart the server from the matrix itself:

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

It reads the tag of service 3, which never changes, kills the `revisor` that it started itself, starts it again, and requests service 3 with the earlier tag. If the `revisor` repeated the tag (`"3-1"` before and `"3-1"` after), it would answer `304`, a false `304`: the client would keep a copy from before the restart. With the startup identifier in the tag (`"3-1-86b39f38"` against another one of eight digits), it answers `200`. It is the rule of RFC 9110, section 8.8.1, which asks that a strong tag not be reused for another representation.

### 8.9 The same, with `curl`

The TypeScript matrix is the one that runs on every change, but the first question of whoever reads it is usually: *and how would that look written by hand?* `fig08_03.sh` answers that question. It is the same idea of 23 scenarios written as you would type it in a terminal: requests with `curl`, an expected content type and header, a counter at the end. It starts the lab and the `revisor` by itself and shuts them down by PID when it finishes.

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

Five ideas from the script:

- **The entry check.** Before starting anything, it tries to open a connection to each port with `/dev/tcp`, a `bash` feature. If someone answers, the port is busy and the script refuses to continue: measuring against someone else's program is a sure way to see results that are not yours.
- **`probar`.** It is the function that does all the work. It receives the expected code, a name, the body type (`problema`, `json` or `nada`), the mandatory header (or a hyphen if there is none) and the `curl` arguments. It asks `curl` to save the headers in a file (`-D`), not to print the body (`-o /dev/null`) and to write the code and the body size (`-w '%{http_code} %{size_download}'`). Then it compares.
- **`size_download`.** To know that a `204` or a `304` carries no body, there is no need to look at the body: the size of what was downloaded has to be zero.
- **`trap … EXIT`.** It is the script's `finally`: it shuts down the lab and the `revisor` by PID and deletes the temporary headers file, even if the script ends because of an error.
- **The `sleep 1`.** It is the same fixed wait that section 8.14.1 replaces in the TypeScript matrix; here it is kept for simplicity, and it is the first place where this script would fail on a slow machine.

Run it from the folder that contains `fig08_01/`:

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

Twenty-three out of twenty-three, and the script exits with `0`. The `curl` version is honest about what it checks less: it looks at the code, the content type, the header and, for the successes without a body, the size. It does **not** look at the body's `type`, nor the body's `status`, nor the leaks, nor whether the code is declared in the document. Nor does it run the eighteen additional ones. It is useful for seeing the skeleton of the idea and for checking a quick change without Node at hand; the complete check is the TypeScript one.

### 8.10 Making the test bite

A check that was never seen failing proves nothing: it will give green just the same whether it works or is broken. That is why several of the matrix's checks were tested twice, once with the fix in place and once with the fix undone, and the number the matrix gave in each case was noted (those in this section, the `405` one from exercise 3, the chunked body one from 8.14.1 and the slow startup one from exercise 6). The others have no stored negative control, and that is one of the things the matrix does not promise (section 8.14). Here you do it yourself with two deliberate defects, one in the server and one in the document. Both are in the `defectos/` folder, with a notice on the first line of the file.

#### 8.10.1 The "cleaned up" server

The first defect is the opening scene. It changes a single file, `problemas.ts`, the central error handler. What changes is this:

```ts
    // DEFECTO A PROPÓSITO: se quitó Retry-After (una «limpieza» de cabeceras) ...
    ...Object.fromEntries(Object.entries(opciones.cabeceras ?? {}).filter(([nombre]) => nombre.toLowerCase() !== "retry-after")),
    // ... y el tipo de contenido pasó a ser el genérico.
    "Content-Type": "application/json",
```

There are two changes, each reasonable on its own. The first removes a header that someone thought superfluous. The second unifies the content type of all errors with that of the successes. No status code changes. To trigger it, copy the folder, replace the file and run the matrix:

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

Read it as someone seeing it for the first time at 10:05 would. The first thing that stands out is what does **not** fail: the first seven lines (the successes and redirects) stay green, and so do all the additional checks but one. The second is what fails: **all** the errors, from `400` to `504`, with the same message: the content type that arrived is `application/json` and `application/problem+json` was expected. On the `429` and the `503` the message carries one more phrase, `falta retry-after`, and it repeats in the additional per-credential `429` check. And the `401`, the `405` and the `415` keep their headers (`www-authenticate`, `allow`, `accept`), because the defect only removed `Retry-After`. Each failure says **which promise was broken and in which scenario**, and the complete list has 17 red lines out of 41; the program exits with `1`.

There is a fact that matters more than the count: **no line says "code"**. If the opening scene's tests had been only about codes, this run would have given 41 of 41. The matrix does not look only at the code, and that is why it would have turned red on the very Monday the change was pushed.

#### 8.10.2 The document that fell behind

The second defect lives in the document. It is the other half of the scene: someone added the `429` to the server and did not write it down, or wrote it and then removed it. To trigger it, the file `defectos/sin-429-documentado/openapi.json` is the usual document without the `429` of `POST /servicios/{id}/revisiones`:

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

At the end of that output is the same document run through a validator (Redocly, which is installed in 8.11; the three commands copy each document to the validator's folder under the name `openapi.json`); it is explained in 8.11.3. The matrix flags **one** failure, exactly the corresponding one: `429 demasiadas revisiones: openapi.json no documenta 429 en POST /servicios/{id}/revisiones`. The server keeps doing what it did; the document stopped saying it, and the matrix noticed because the `429` scenario asks, at the end of `comprobar`, whether the document declares that code on that operation (section 8.6.3). It is a clean result: 40 of 41, a single red line, a single culprit.

> **A notice line inside a JSON.** JSON does not allow comments, so a notice on the first line cannot be written as in TypeScript. The file uses the way the OpenAPI specification offers for this (section 4.9, "Specification Extensions"): a field whose name starts with `x-` can carry any value, and the document remains valid. That is why the first line of the defect is `{ "x-defecto": "DEFECTO A PROPÓSITO …",`.

### 8.11 A valid document is not a true document

The same document from which you removed the `429` does something interesting when you give it to an OpenAPI validator. A **validator** (a *linter* when it also gives opinions about style) reads the document and says whether it is well written according to the specification. There are several; the course uses **Redocly CLI**, a command-line tool with an MIT license, and its `lint` command ([documentation](https://redocly.com/docs/cli/commands/lint)). It is not a dependency of the `revisor`: it is installed separately, in a working folder, and thrown away when you finish.

```text
$ mkdir ~/validador && cd ~/validador
$ npm init -y
$ npm install --no-save @redocly/cli@2.57.0
$ cp ~/curso-http/fig08_01/openapi.json .
```

#### 8.11.1 The `revisor`'s document, validated

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

Read it from top to bottom. The line at the beginning warns that no configuration was given and that the **recommended** one is used, which is the command's default. 26 warnings follow, and the verdict: "Woohoo! Your API description is valid." That is: zero errors. The document is well written according to the specification.

The 26 warnings are not errors, and they fall into three groups worth understanding:

- **17 of `operation-operationId`.** Each operation can carry an `operationId`, a unique identifier (the specification, section 4.8.10.1, says it must be unique among all the operations in the document). It serves the tools that **generate code** from the document, to name the functions. The course does not generate code, so the document does not carry it. It is a decision, and the warning is the validator asking whether you forgot.
- **5 of `operation-2xx-response`.** Five operations declare no `2xx` response: the two old redirects (`GET` and `POST` of `/viejo/servicios` and of `/api/servicios`, four) and `GET /v0/servicios` (the withdrawn version, which only answers `410`). It is true: those routes have no success. The warning is the validator asking whether that is on purpose, and it is.
- **4 of `operation-4xx-response`.** The four redirects declare no `4xx` response either.

None of the 26 is a broken promise, and that is why the document stays as it is. But it is the kind of decision that is made in plain sight, not in silence: the validator is run, each group is read and a decision is made.

#### 8.11.2 The positive control: a document that really is badly written

A validator that always says "valid" proves nothing either. To see that the one above **bites**, the `documento-roto` defect has two writing errors: a reference to a response that does not exist (`E4O1`, with a letter O instead of a zero) and a `204` without its `description`:

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

Now it does: **two errors**, and the validator refuses to accept it. The first says `no-unresolved-refs`, "Can't resolve $ref", on line 38, which is the misspelled reference. The second says `struct`, "The field `description` must be present on this level", on line 263, which is the `204`: the specification (section 4.8.17.1) requires `description` in every response. Both are the kind of error that slips into a hand-written document of more than a thousand lines, and the validator catches them without you running any server.

#### 8.11.3 The uncomfortable conclusion

Now the same tool, against the document from section 8.10.2, the one without the `429`:

```text
$ npx redocly lint openapi.json --format=stylish
```

Its verdict: "Woohoo! Your API description is valid.", with 27 warnings, one more than the earlier 26. The new one says `no-unused-components`: "Component: "E429" is never used." That is, the validator **did notice** something: the reusable `E429` response was left with no operation using it. But it said so as a warning, not as an error, and it had no way of knowing that the server still returns that `429`. The document is still valid, and the validator did **not** see that it lied.

That is not a failure of the validator. A validator answers the question *is it well written?*, and the document without the `429` is perfectly well written: it simply does not mention a code that the server does return. To answer *is it true?* you have to compare the document with the server, and that is what the matrix does. The two tools do not replace each other, they complement each other:

| Question | Answered by | Example in this lesson |
|---|---|---|
| Is it well written? | the validator (`redocly lint`) | the `E4O1` reference and the `204` without `description` |
| Is it true? | the matrix (`matriz23.ts`) | the `429` that the server returns and the document keeps quiet about |
| Does it say everything? | the catalog cross-check (`fig08_02.ts`) | `revision-inexistente`, which the document does not mention |

An API with only the first row has an elegant, outdated document. An API with only the second has a verification that depends on a document nobody knows whether it can be read. With all three, each kind of error has someone to catch it.

### 8.12 DNS rebinding: the gap from Lesson 1, closed

Lesson 1 left a debt noted in a comment in `destinos.ts`: the `revisor` validates the destination before each connection, and even so a window remains. Today it is closed. Before seeing how, it is worth telling why it matters with two cases from this very year.

#### 8.12.1 Two public advisories

On July 10, 2026 a security advisory was published about `mcp-atlassian`, an open-source, third-party MCP server (not an Atlassian product) for connecting AI agents with Jira and Confluence ([GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q)). The interesting part is that it **had already had a fix** against SSRF; the advisory is about why that fix was not enough. The fix resolved the name once, to check it, and the later request went back to using the name as it was, so, says the advisory, the request "re-resolves at connect time with no IP pinning". A name controlled by whoever attacks can answer a public address while it is checked and an internal one (such as `169.254.169.254`, where clouds publish the machine's metadata) when it connects. The advisory clarifies that the test accompanying the report does not demonstrate a complete attack against a running server, and that exploiting it requires winning that race. It classifies it as a race between the check and the use (*TOCTOU*, *time of check, time of use*) and the version that fixes it is 0.22.0.

Almost a month earlier, on June 15, 2026, another had been published, with the same pattern and in another product: **CVE-2026-53708**, in an MCP server gateway ([advisory GHSA-9hgc-g3w5-67cm](https://github.com/advisories/GHSA-9hgc-g3w5-67cm)). An administration entry point checked a URL's name by resolving it, blocked what was private, and then **handed the original name** to the HTTP client, which resolved it again. An attacker who controls the DNS can return a public IP during validation and a private one during connection. It was fixed in version 1.0.3 (moderate severity, CVSS 6.6). The advisory puts it like this: the entry point validates the name by resolving it, and the HTTP client, on its own, resolves the name again when connecting, with nothing tying the two operations together (our paraphrase of the advisory, which is in English). The recommendation is the same as the other advisory's: pin the already validated IP in the connection.

A clarification about names: "DNS rebinding" designates, in its classic sense, a browser-side attack against the same-origin policy; the advisories (and OWASP) call this server-side race by the same name, which is the sense it has here. Both have something in common with Lesson 1's `revisor`: a program whose job is to connect to addresses that someone else gave it. And both had the defect that Lesson 1 named and left open: validating and connecting are **two resolutions**, not one. OWASP's SSRF guide says it bluntly: "an unchecked second DNS lookup between validation and connection can bypass these defenses" (our translation); and it recommends connecting only to the validated addresses, keeping the original name for the `Host` header, the SNI and the certificate verification ([OWASP guide](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)).

#### 8.12.2 The mechanism, with your own hands

Before reading the defense, make the attack happen, in miniature and without attacking anyone. `fig08_04.ts` simulates a DNS that lies: the **first** time it is asked about `rebote.ejemplo`, it answers `127.0.0.1` (the lab, which is allowed); from the **second** on, it answers `::1`, where another server listens that responds `299` (a code nobody else returns, to recognize it). `dns.lookup` and `dns/promises.lookup` are replaced by functions of ours that count how many times they are called. None of this leaves your machine:

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

The parts that matter:

- **Two servers, two addresses.** The "lab" listens on `127.0.0.1:18081`, and "the other" on `[::1]:18081`. It is the same port number on two different addresses, which is possible because an IPv4 address and an IPv6 address are different places.
- **`responder`.** It is the DNS that lies: it counts how many times it is called and answers a different address depending on the question number.
- **Two patches.** `dnsPromesas.lookup` is used by `destinos.ts` to validate (the promises version), and `dns.lookup` is used by Node internally when a connection asks a name for its address (the *callback* version). That second patch has two ways of answering, because `dns.lookup` can be called with the `all` option or without it (Node's manual, on the `dns` page: with `all` the callback's arguments are `(err, addresses)`; without it, `(err, address, family)`).
- **`syncBuiltinESMExports()`.** When you import `{ lookup }` from a Node internal module, the name `lookup` is fixed to the value it had at that moment. After replacing the function you have to synchronize the exported names, or `destinos.ts` would keep calling the original.
- **The dynamic `import()` at the end** loads `cliente.ts` from the folder passed as an argument. First it is patched, then imported; the other way around would not work.

The program receives the folder of the client you want to test. For the first experiment you need the Lesson 7 client, the one that uses `fetch`. It is in `defectos/con-fetch/` (two files: `cliente.ts` and `destinos.ts`, with a notice on the first line). Build a folder with the `revisor`'s files and replace those two:

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

The first block is the attack: the Lesson 7 client asked the DNS **twice**. The first time (to validate) it got `127.0.0.1`, which is on the allowed list; the second (the one `fetch` made internally when connecting) it got `::1`, and the client reached the `299` server without any `destinos.ts` rule seeing it. The second block is the defense: this lesson's client asked **only once**, connected to what it was answered and reached the lab, with a `200`. The same query, the same name, the same lying DNS: two clients, two destinations.

> **It is a simulation, and says so.** The lying DNS is a function of ours; the "other server" is a server of ours. A real attacker, besides, needs a response with a very low lifetime (TTL) and that no cache (of the operating system or the resolver) repeat the first answer, which the simulation skips by construction; and the `dns.lookup` patch works because `net.connect` queries that function when connecting, which is an assumption about how Node is built and not a guarantee. If your system has no `::1`, change the second server to `127.0.0.2` (Linux accepts it as loopback). The test shows that the Lesson 7 client **asks again** and that the Lesson 8 one **does not**, which is what you need to know. It does not show that a real attacker can exploit the `revisor`: that depends on where it runs, on what network surrounds it and on the second layer that Lesson 1 asked for (a network that does not let metadata be reached even if the program tries).

#### 8.12.3 The defense: connect to the already validated address

The defense is three small changes. The first is in `destinos.ts`: `revisarDestino` no longer answers just "yes" or "no", it answers "yes, and these are the addresses I checked":

```ts
// Si se permite, trae las direcciones ya validadas: quien se conecte debe usar una de éstas.
export type Veredicto = { permitido: true; direcciones: string[] } | { permitido: false; motivo: string };
```

And at the end of the function, instead of `return { permitido: true };`, it returns `return { permitido: true, direcciones };`. Whoever connects now has at hand exactly the addresses that passed the check, and no others.

The second and third are in `cliente.ts`. First, a function that **resolves nothing**:

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

`soloA` receives an address and returns a lookup function that **always answers that address**, without asking anyone. The `LookupFunction` type comes from `node:net`. The `lookup` option of `http.request` and `net.connect` exists for this: according to Node's manual, its default value is `dns.lookup()`, and it can be replaced by any function of the same shape. The two paths of the `if` are not decoration. Since Node 20, `net.connect` has the `autoSelectFamily` option on by default, which tries IPv4 and IPv6 addresses in sequence and, when active, passes `lookup` the `all: true` option; in that case the function expects a **list** of addresses, not a single one. That is why `soloA` answers in both ways, depending on what it is asked.

Then, the function that makes the request:

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

Three decisions, in order:

- **The `URL` object is passed, not an address.** `pedirCon(url, opciones, …)` takes the URL's name for the `Host` header and, over `https`, for the **SNI** and the certificate verification, and takes **where to connect** from `lookup`. That is why the lab server receives `Host: rebote.ejemplo:18081` even though the connection went to `127.0.0.1` (you will check it in exercise 4).
- **`agent: false`.** Node's manual says that with this option a new single-use agent is used, and that it serves "to avoid connection reuse". A reused connection from a shared agent might have been opened earlier, to another address; with `agent: false`, each query opens its own, to the address it has just validated.
- **`signal`.** It is the `AbortSignal` with the time limit. It aborts the whole request, not just the connection: it is what `AbortSignal.timeout` used to do with `fetch`.

And the body of `consultar`, which closes the circle:

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

The sequence matters: **first** the destination is checked (`revisarDestino`, which resolves once), **then** the time limit is set up, and **lastly** it connects to `veredicto.direcciones[0]`. There is no third resolution. `respuesta.destroy()` cuts the reading after the headers: the `revisor` only cares about the code and the headers, not the body. And the error classification changed in form, not in substance: before it looked at a `fetch` exception (`DOMException` with `TimeoutError`, or the `cause` with the `code`); now it looks at whether the signal was aborted (`tiempo.aborted`) or the `code` of the Node exception. The five outcomes are the same.

#### 8.12.4 What did not change: the certificate, the redirect and the outcomes

Three reasonable questions, with a measured answer.

**Is the certificate still verified against the name?** Yes, and that is the reason for passing the `URL` and not the IP. It was checked against a public site and two test ones from the browser community, one with an expired certificate and another with a name that does not match (it needs internet):

```text
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://example.com/
{"tipo":"respuesta","codigo":200,"ms":484,"reintentarEn":null}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://expired.badssl.com/
{"tipo":"respuesta-invalida","motivo":"certificate has expired"}
$ node --input-type=module -e 'import { consultar } from "./cliente.ts"; console.log(JSON.stringify(await consultar(process.argv[1], 8000)))' https://wrong.host.badssl.com/
{"tipo":"respuesta-invalida","motivo":"Hostname/IP does not match certificate's altnames: Host: wrong.host.badssl.com. is not in the cert's altnames: DNS:*.badssl.com, DNS:badssl.com"}
```

The first answers `200`. The other two are `respuesta-invalida`, with the reason Node gives: `certificate has expired` in one, and in the other that the server's name is not among those in the certificate. What this proves is that the name **is still** compared with the certificate: the client only changed where the socket connects, not what it is verified against.

To see what would happen if, instead of that, the name were replaced by the IP in the URL, `fig08_07.ts` does exactly that (it resolves the name, builds `https://<IP>/` and requests the page):

```text
$ node fig08_07.ts example.com
{"nombre":"example.com","error":"EPROTO"}
$ node fig08_07.ts expired.badssl.com
{"nombre":"expired.badssl.com","error":"CERT_HAS_EXPIRED"}
$ node fig08_07.ts wrong.host.badssl.com
{"nombre":"wrong.host.badssl.com","error":"CERT_HAS_EXPIRED"}
```

That is not an alternative: **not even the good site** works (`example.com` ends in `EPROTO`, a TLS handshake error: without the name, the server does not know which certificate to show), and the two bad sites do not give `200` either (both end in `CERT_HAS_EXPIRED`: a certificate's validity is always checked, and without the name the server offers the one it has by default). That is, connecting "to the IP" does not relax the verification, it breaks it elsewhere and with another message. That is why `consultar` passes the `URL` with the name and changes only the socket's address: the name is kept for the `Host` header, for the SNI and for the certificate verification.

**Are redirects still followed?** No. A query to a destination that answers `301` returns `301`, not the response of the place it points to. `http.request` does not follow redirects by itself, and the `revisor` does not follow them either: the OWASP guide lists them as a way to skip validation (an allowed URL that redirects to a forbidden one), and the recommendation is to disable them. Before it was achieved with `redirect: "manual"` in `fetch`; now by not following them.

**Did any outcome change?** No. The five kinds of `Consulta` are the same, and the codes that come out in the matrix are the same. The only thing that changes is the internal text of the `motivo` in `respuesta-invalida`, which no server response shows.

#### 8.12.5 What this defense does not do

It would be a bad habit to close a security section by saying "done". Three limits, in plain sight.

- **It connects to a single address.** `veredicto.direcciones[0]` is the first of those the DNS checked. If the name has several and the first does not respond, the `revisor` does not try the second: from what is read in the code, a name whose first address refuses the connection counts as `sin-conexion`, even if the second works. It is the price of pinning the address; a version that tried the following ones would have to apply the same check to each. The OWASP guide asks for it this way: apply the destination policy also to retries and to alternate connections.
- **It does not replace the network.** A `revisor` exposed to the internet should run on a network that has no route to what it must not reach. Lesson 1 said so; it is still true. This defense reduces what depends on a single file.
- **It does not cover what does not go through `consultar`.** Today the only place where the `revisor` connects is `cliente.ts`. If tomorrow someone adds another (an email alert, a file download), it has to go through the same door, and the matrix in section 8.6 **does not know**: it only checks the destinations you tell it.

### 8.13 API versions in the document

Lesson 3 showed how to withdraw a version without surprising anyone: months of notices and, in the end, a `410`. A place was missing where those notices were written for machines, and it is the document. First, what the server really does:

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

Let us see what matters in the three responses. `/v1/servicios/1` answers `200` with three headers: `Deprecation`, `Sunset` and `Link`. `/v0/servicios` answers `410`, with the type `version-retirada`. And the `PATCH` route in the last block you already know from section 8.4.4.

#### 8.13.1 What the three headers say

`Deprecation` is RFC 9745, published in March 2025 on the Standards Track. Its value is a **date** in the format of HTTP structured fields, a number of seconds since 1970 preceded by an at sign: section 2.1 says "Deprecation is an Item Structured Header Field; its value MUST be a Date". The value the `revisor` sends, `@1782864000`, is July 1, 2026 at 00:00 UTC. It means "this version was deprecated on that date", and the date may be in the past or in the future.

`Sunset` is RFC 8594, from May 2019, **informational**. Its value is an ordinary HTTP date (`Sun, 31 Jan 2027 00:00:00 GMT`), and it says when the resource is expected to stop responding. The RFC itself says that whoever receives it should take the dates as hints, not as guarantees. The relationship between the two comes in section 4 of RFC 9745: the `Sunset` date must not be earlier than the `Deprecation` one, and the `revisor` version 1's (January 31, 2027) is seven months later.

`Link` with `rel="deprecation"` points to the human documentation of the deprecation: the migration guide. RFC 9745 registers that relation and gives an example in the same format the `revisor` uses.

#### 8.13.2 How that is said in OpenAPI

The document has three places where versions appear:

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

It is the `GET /v1/servicios` operation, and it carries three things:

- **`"deprecated": true`.** It is an operation field. The specification (section 4.8.10.1) says: "Declares this operation to be deprecated. Consumers SHOULD refrain from usage of the declared operation." It is the notice for machines: documentation tools usually strike through the operation, and those that generate code can mark the function as obsolete.
- **The three headers** (`Deprecation`, `Sunset` and `Link`) in the `200` response, referenced from `components/headers`, each with its description and the RFC that defines it.
- **The withdrawal**, `/v0/servicios`, with `deprecated: true`, `"security": []` (it asks for no credential, because the `410` is answered before asking who you are) and only the `410` response, the same `E410` used by the withdrawn service, because the catalog reuses the `Problema` schema with its own `type` `version-retirada`.

And there is a third line that closes the circle: in the document's `info`, the description says that `info.version` is the version **of the document**, and that the current API lives at the root, with v1 deprecated and v0 withdrawn. Without that sentence, someone who reads `"version": "1.0.0"` would think `/v1` is the current one.

A design detail worth saying out loud: **versions live in the route** (`/v1/…`, `/v0/…`), and the current one carries no prefix. There are other ways to version an API (by header, by content type) and OpenAPI describes them all; the route is the easiest to document, because each version is an entry in `paths` and each can be marked `deprecated` separately.

### 8.14 What the matrix does not promise

An honest verification says what it does not see. Seven things, with their evidence.

**1. It does not look at the cases it did not write.** It is what the cross-check in section 8.5 taught: `GET /revisiones/{id}` returns a `type` that the document does not mention, and the matrix was green because its `404` scenario asks for a service, not for a revision. Each route that has no scenario is a route the matrix does not know.

**2. It checks that the members are there, not that their form is correct.** It checks `type`, `status` and `title` in all errors; it does not check `detail` or `instance`, except on the `500`. Exercise 2 measures it: with a server that lacks `instance` in all its errors, the current matrix gives **40 of 41**, and the only failure is the `500` one; the two-line extension puts it at **25 of 41**.

**3. It does not compare bodies with their schemas.** The `Servicio` schema says a service has `id`, `nombre`, `url` and `limite_ms`; the matrix checks that the `id` is 1 in a query and that the `nombre` is `matriz` in a registration, not that all four fields have the type the schema says. A server that returned `limite_ms` as text would pass. Closing this takes a JSON Schema validator (none among the course's dependencies) and it is the matrix's natural extension.

**4. It does not check the version notice headers.** The document promises `Deprecation`, `Sunset` and `Link` on `/v1`, and that promise was checked by hand in 8.13 and in Lesson 3; the 23-scenario matrix has no scenario for `/v1`.

**5. The scenarios share a server with state.** The order is written down (section 8.6.2), and a change that reorders the scenarios can break them for reasons that are not defects of the API.

**6. The leak check is a list of signals, not a proof of absence.** It covers stacks, file paths, SQL, credentials and JavaScript exception names, and leaves out everything that was not imagined.

**7. It is a test, and tests also fail for no reason.** This one deserves a place of its own, because it is what most wears down trust in any automatic verification. During this lesson one of the matrix's checks failed sometimes without there being any defect, and the full story (how it was found, how it was measured and how it was closed) is in the next section.

#### 8.14.1 A check that sometimes fails: how we found it, how we measured it and how we closed it

**How we found it.** While this lesson was being written, the matrix sometimes exited with code `1` without anything being broken. They were working runs, some against copies with deliberate defects, and their count was not kept: that is why there is no figure here for how often it failed, and everything that follows is what was measured afterwards, with programs and outputs that are in the repository. One of the checks that failed was the one for the body of more than 16 KiB (the line is from one of those working runs; it was not saved to a file):

```text
FALLA cuerpo de más de 16 KiB: 413 (con Content-Length y por partes); en el tope, 400; el revisor sigue vivo: 20000 bytes por partes: error TypeError: fetch failed
```

Another failure was of another family: a request to a gateway that was not yet listening (`pasarela sin revisor: 0 null`). That one is picked up again at the end of this section.

**How we measured it.** A check that fails now and then is best measured by isolating it. `fig08_05.ts` repeats 400 times exactly the chunked body the matrix sends (20 chunks of 1000 bytes, no `Content-Length`) and counts what happened each time. It needs the `revisor` listening: `node servidor.ts` from `fig08_01/`, in one terminal, and in another. This is the run against the `revisor` **as it was before closing the race**, which is the content of `defectos/cierre-brusco/respuestas.ts` (it is tested by copying `fig08_01/` to another folder and replacing that file; the complete output is in `defectos/cierre-brusco.salida.txt`):

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

Out of 400 attempts, the `revisor` answered `413` in most; in the rest the client received no response: `EPIPE` (the connection broke while the client was still writing) and sometimes `ECONNRESET`. With the first run and its five repetitions, the `revisor` answered `413` between 346 and 382 times out of 400: between 18 and 54 attempts without a response, that is, between 4.5 and 13.5 out of every 100. The figure changes from one run to another, and that is part of what made it hard to see: in the matrix, which makes *one* attempt per run, it showed up as an occasional failure.

**The cause.** It is a race, and RFC 9112, section 9.6, describes it. The `revisor` decides that the body is too large as soon as it counts more than 16 KiB, answers `413` with `Connection: close` and closes. But the client kept sending chunks. When a connection is fully closed and data still arrives, the operating system answers with a *reset* (RST), and the reset can erase the response the client had not yet read. The RFC puts it like this: if a server immediately closes a TCP connection, "there is a significant risk that the client will be unable to read the last HTTP response". And it describes what servers usually do to avoid it, which is to **close in stages**: first only the write side is closed (*half-close*), then it **keeps reading** until the client closes (or until there is reasonable certainty that the client received the last response), and at the end it closes completely. Notice the order: the RFC responds **first** and keeps reading **afterwards**.

**How we closed it, the first time.** There are three possible ways out, and only one is honest with the server. **Retrying the test** until it passes hides a defect that exists. **Accepting both outcomes** in the test (a `413` or a close) stops depending on the race, but it passes a server that loses responses. **Fixing the close in the server** corrects the problem where it is. The first attempt was the version simplest to write in Node: **read and discard whatever the client keeps sending, with a cap, and only then respond**. It is the content of `defectos/drenar-antes/respuestas.ts` (the lesson no longer uses it, but it is kept because its limit was measured):

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

Read it calmly, because each line has a reason:

- **The reason is in the comment**: continuing to read and discard whatever arrives avoids the RST. But mind the order: this version reads **before** responding, and the RFC asks to respond **first**. That is why the `413` is slow: it goes out when the client finishes sending or when the caps are exceeded.
- **`DRENAR_MAX_BYTES` (1 MiB) and `DRENAR_MAX_MS` (2 seconds)** are the caps. Without them, the server would read forever a body it has already decided to reject, and would hand over the connection to anyone who wants to hold it by sending nonstop. With the caps, the worst that is paid is 1 MiB and 2 seconds per connection.
- **`fin` is the only way out**, and it is called from four places: the body ends (`end`), the connection closes (`close`), there is an error, or the caps are exceeded. On exit it removes all the listeners and stops the clock.
- **`peticion.resume()`** puts the request to read. The data reaches the `data` listener, which only counts the bytes and discards them.

With bodies like the matrix's (20 KB) it worked: 400 of 400. But it has a limit that was measured, not assumed. `fig08_05.ts` accepts a second argument, the number of 1000-byte chunks (20 by default), and it was run against that copy with bodies of 1 MB, 1.1 MB and 3 MB, 100 attempts each (`defectos/drenar-antes.salida.txt`):

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

Up to 1 MB, all 100 attempts get their `413`. As soon as the body goes past 1 MiB (1,048,576 bytes) after the cap, the server stops reading, responds and closes, and the client, which keeps writing, gets the RST again: **the race reappears** and with 3 MB no attempt receives a response. The first fix did not close the race: it moved it beyond the cap. A client that sends more than 1 MiB is, besides, the one most likely to have made a big mistake.

**How we closed it, the second time: the staged close that the RFC asks for.** What is needed is what the RFC describes: respond **immediately**, close only the write side and keep reading. Node does not do it by itself: with `Connection: close`, when it finishes responding it calls `socket.destroySoon()`, which closes and destroys the socket (you can see it in `lib/_http_server.js`; the method is documented in [`net`](https://nodejs.org/docs/latest-v24.x/api/net.html#socketdestroysoon)). This is the version the lesson includes:

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

- **`socket.destroySoon = …`** changes that method **only on this connection**, so that when it finishes responding it does only `socket.end()`: it closes the write side (*half-close*) and leaves reading open.
- **`peticion.resume()`** keeps reading and discarding whatever the client sends. There is no longer a byte cap: what is paid for such a connection is, at most, **2 seconds** of reading.
- **The 2-second clock** destroys the connection even if the client does not close, so that nobody holds it; `socket.once("close", …)` turns it off if the connection ended earlier.
- **The `413` goes out immediately**, because `leerCuerpo` calls `cerrarConCalma` and rejects right away, without waiting for anything.

A limit worth stating: that `http` uses `destroySoon` when closing is a detail of how Node is built, not a promise of its documentation. If a later version changed it, `fig08_05.ts` would see it (the measurement below would drop below 400), and that is why the measurement is part of the lesson and not just of the text.

**How we checked that it was closed.** The same `fig08_05.ts`, this time against the `revisor` in `fig08_01/` as it is in the lesson (`fig08_05.salida.txt`), and then with the large bodies that broke the first fix (`fig08_05.limite.salida.txt`):

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

Four hundred out of four hundred in all six runs, against between 346 and 382 before; and a hundred out of a hundred with bodies of 1 MB, 3 MB and 20 MB, where the first fix gave zero out of a hundred. That is the control: with the old code, the measurement sees the defect; with the new one, it does not. What was **not** measured: what happens with a slow client that sends a trickle for more than 2 seconds (the server destroys the connection; the response already went out at the beginning, and whether the client read it before the reset is a matter of its own pace), nor how much load many such connections accumulate at once.

**The other family: startup.** The other failure, the gateway's, had nothing to do with closing but with starting up. The matrix waited a fixed time after starting each process (one second for the `revisor`, half a second for the gateway). A fixed wait is a bet on how long startup takes, and that duration is not constant. `fig08_06.ts` measures the margin: it starts the gateway 100 times and notes how long it takes to answer; in the saved runs (`ejercicios/ej6.salida.txt`) the maximum was 225 ms with the machine idle and 166 ms with 20 processes spinning, well below the 500 ms wait. That is, there is almost always plenty of margin, but the fixed wait is only good as long as startup is shorter than it, and that is exactly what you do not control. To see the failure on purpose, `ejercicios/ej6/arranque-lento.sh` makes a copy of a folder and delays the startup of `servidor.ts` and `pasarela.ts` by 700 ms: with the fixed-wait matrix (`defectos/espera-fija/matriz23.ts`) the result is `40 de 41`, and the check that fails is exactly the one that was seen, `pasarela sin revisor: 0 null`; with the lesson's matrix the result is `41 de 41`.

The remedy is the one that had been announced: wait for the port to accept connections instead of waiting a number of milliseconds. It is what the two functions at the top of `matriz23.ts` do (and exercise 6 is about that):

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

`esperarPuerto` asks every 100 ms, up to 10 seconds, and **throws an error** if the deadline passes or if the process that was started has already exited (for example, because of a busy port); ending silently would leave the matrix measuring nobody. `arrancar` checks **beforehand** that the port is free: without that, an old `revisor` already listening would make `esperarPuerto` accept a new process that died with `EADDRINUSE`. With the two, the lesson's matrix, run 30 times in a row with `fig08_08.sh` (`fig08_08.salida.txt`), exited with code `0` all 30 times, on a machine in normal use. That does not prove it cannot fail again; it proves that the case known to fail no longer fails, and that now, if a process does not start, the matrix says so instead of measuring something else.

### 8.15 The complete `revisor`

These are all the files of `fig08_01/`. Those that change or are born in this lesson come first; the others are those of the earlier lessons in their current version, and are here so that you can build the complete folder even if you did not do the earlier lessons. The folder name, `fig08_01`, appears on the first line of each file, as in the earlier lessons. The document is the only one that does not carry it, because JSON does not allow comments.

#### 8.15.1 The files that change or are born

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

**`fig08_01/openapi.json`** (JSON does not allow comments, so this file does not start with the usual line):

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
            "description": "http o https; no puede apuntar a direcciones privadas ni reservadas (SSRF)."
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

#### 8.15.2 The files that do not change

They are those of the earlier lessons in their current version; only the first line changes, which now says `fig08_01/`. `package.json` is the same as always:

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


### 8.16 Checking the types with `tsc` (optional)

From the `revisor` folder, with the command from section 0.9 of Lesson 0 plus `--allowImportingTsExtensions`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

The lesson's standalone programs (`fig08_02.ts`, `fig08_04.ts`, `fig08_05.ts`, `fig08_06.ts` and `fig08_07.ts`, and the variants in `ejercicios/`) are checked the same way from the folder that contains them, pointing to the `tsc` you installed in `fig08_01/`.

## The error you will see

### The matrix that adjusted itself to the defect

The most tempting mistake with a verification that turns red is to fix it in the wrong place. It is Tuesday, the matrix is red on 17 lines, there is a rush, and someone opens `matriz23.ts` instead of `problemas.ts`: "we no longer require `Retry-After`", "we accept `application/json` where `application/problem+json` was expected". Two lines, and the matrix is green again. A copied version of `matriz23.ts` with exactly those two changes (in three places, because the per-credential `429` check also asks about `Retry-After`) is the one in `defectos/matriz-bendice/`. Copy it over the `rota/` folder from section 8.10.1 (the "cleaned up" server's) and run it:

```text
$ node matriz23.ts   # la matriz «arreglada», contra el servidor con el defecto
ok    ETag tras reiniciar el revisor: la vieja no coincide (200, no un 304 falso)

41 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).
(código de salida: 0)
```

Green. **41 of 41** and exit code `0`, against the same server that a moment ago put the matrix on 17 red lines. The server did not change; the yardstick did. It is what the course calls a test that **blesses the defect**: it passes, and what passes is the error.

This is worse than a test that fails, for a concrete reason: a red test draws someone's attention, and a green one takes it away. From that moment, the dashboard says "all good", and the integrators from the opening scene go back to receiving `application/json`. The defect no longer has anyone watching it.

Three habits prevent it, and all three are cheap:

- **A change in what the test expects is a change of promise.** It is reviewed as a change in the API is reviewed: who found out? does the document say the same? Here, `openapi.json` still says `application/problem+json`; the adjusted matrix no longer matches the document, and that discrepancy should be the first thing someone notices.
- **Before loosening a test, ask which of the three is lying.** The server, the document or the test. With 17 red lines with almost the same sentence, it is most likely that one thing changed in the server, not 17 things in the test.
- **Revert and check that it turns red.** It is the rule of the whole lesson: a test that was not seen failing against the defect proves nothing. Here, running the **original** matrix against the server with the defect gives red; running the adjusted one, green. The difference between the two is all the information.

### The server that stayed open

The second mistake is not one of design, it is one of forgetfulness, and it has subtle consequences. The matrix starts its own `revisor` on port 18080. But if one is already listening there (a `revisor` from an earlier lesson, or the `rota/` copy from section 8.10 that you did not shut down), the new program cannot take the port, and there is no one to say so: the children are started with `stdio: "ignore"`. The version of the matrix that did not defend against this went on measuring the old server. The lesson's version defends itself: before starting anything, it checks the three ports. To see it, leave running in one terminal the server from the `rota/` copy, the "cleaned up" one, and from another run the matrix **from `fig08_01/`**, the good one; then the earlier version of the matrix (`defectos/espera-fija/matriz23.ts`, which lacks the check):

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

When you finish, shut down the `rota/` server by its PID (`kill %1` if you launched it in that same terminal with `&`) and check with the command below that the ports are free. The first matrix refuses to measure: it says which port is busy and exits with `2`, which is a different code from the `1` of "something failed". The second shows what used to happen. The `fig08_01` folder does not have the defect, but the earlier matrix shows the same sixteen red lines of the scenarios from section 8.10.1. Whoever read it without knowing about the open server would go looking for the error in the wrong code: the matrix did not measure its own `revisor`, it measured the one that was already there.

And notice how it ended, because it was the second half of the problem: **it did not print the summary**. The last line of the output above ("ESTADO: …") was not written by the matrix but by the script that ran it for this lesson: the matrix stayed waiting, saying nothing, and after 60 seconds it was stopped by its PID. It stayed waiting because one of its additional checks shuts down "its" `revisor` to test the gateway, and waits for the notice that it ended; that `revisor` never came to exist, so the notice never arrived. A program that goes mute in front of a busy port, instead of saying "port 18080 is busy", is a defect, and that is why the lesson's matrix carries the check that `fig08_03.sh` already had (section 8.9). What does not change is the underlying rule, the one the course has been repeating since Lesson 0: `127.0.0.1:18080` does not say what is behind it, only that something answered. If you write your own program that starts processes, give it the same check, and if you run it by hand, check beforehand that the ports are free:

```bash
for p in 18080 18081 18082; do (exec 3<>/dev/tcp/127.0.0.1/$p) 2>/dev/null && echo "ocupado: $p"; done
```

If the command prints nothing, the three ports are free.

## Common mistakes

**Documenting from memory.** A document written from what one believes the API does ends up describing the API one imagined. It is written looking at the real responses, and then checked with the matrix.

**Documenting only the happy path.** A document with the successes and without the errors leaves the client half the work: they have to discover the `4xx` and the `5xx` by trial and error. Errors are documented with the same precision as successes, with their content type and their headers.

**Writing the same error response in every operation.** It falls out of sync as soon as someone fixes one and not the others. Error responses are written once in `components` and reused with `$ref`.

**Putting the content type as a header.** A `Content-Type` in `headers` is ignored; the type goes as the key of `content`.

**Confusing `info.version` with the API's version.** It is the version of the document. If you need to say which API is current and which are withdrawn, you write it in the description and mark the routes `deprecated`.

**Accepting a document because the validator says "valid".** The validator answers whether it is well written, not whether it is true (section 8.11).

**Testing only the codes.** It is the opening scene. The code is the easiest thing to test and the only thing that that morning's tests checked.

**Loosening a test to turn it green.** A test that adjusts itself to the defect passes, and what passes is the defect (section "The matrix that adjusted itself to the defect").

**Measuring the wrong server.** A port occupied by an old program leaves a program measuring what is not its own; that is why the matrix checks the ports before starting and exits with `2` if any responds (section "The server that stayed open").

**Retrying a test until it passes.** A check that sometimes fails has a cause. Understanding it (section 8.14.1) is cheaper than distrusting all the others.

**Validating the destination and letting someone else resolve the name.** They are two resolutions and between one and the other the name can change hands. The address that is validated is the address that is connected to.

**Trusting that the document scares away whoever should not read it.** An OpenAPI document is almost always published. What cannot be in it (internal machine names, private addresses, examples with real data) is not written, not even as an example.

## Exercises

The six check themselves: each ends with a run that tells you whether you got it right (in 5 and 6, with a control that fails on purpose). Write your prediction in the [logbook](bitacora.md) **before** running anything. For exercises 1 to 3 you need the `fig08_01/` folder and ports 18080, 18081 and 18082 free (the third is used by the gateway for one of the additional checks); for 4, 18081 and `::1`.

### Exercise 1 — Close the catalog gap

Section 8.5 found that `fig08_02.ts` flags a gap: the document does not mention the `type` `revision-inexistente`, and the route `GET /revisiones/{id}` returns it. Fix a **copy** of `openapi.json`: add a reusable response for that route's `404`, name it whatever you like, and make the operation point to it. To know whether you got it right, run the three checkers with your copy: `fig08_02.ts` has to say "0 con un hueco en el documento"; `matriz23.ts` has to stay at 41 of 41; and `redocly lint` has to keep saying "valid". Predict beforehand: how many warnings will the validator give, more, fewer or the same?

### Exercise 2 — Make the matrix see `detail` and `instance`

Section 8.14 said that the matrix only checks three of the five members of a Problem Details. Add two lines to `comprobar` so that it also requires `detail` and `instance` as text, in all errors. Predict: with your extended matrix, how many red lines does the good `revisor` give? Then copy `ejercicios/ej2/defecto-sin-instance/problemas.ts` over a copy of `fig08_01/` (it is a server that forgot `instance`) and predict two things: how many red lines the **original** matrix gives against that server, and how many yours gives.

### Exercise 3 — Remove the `405` from the document

This was the idea of section 8.4.4. In a copy of `openapi.json`, delete the `405` response of `GET /servicios/{id}` and run the matrix. Predict: how many red lines? what is the exact message? Then run `redocly lint` on the same document: does the validator detect it?

### Exercise 4 — What `Host` does the server receive?

Section 8.12.3 said that the client connects to the already validated address, but that the `Host` header keeps the name. Modify `fig08_04.ts` so that the "lab" prints the `Host` it received on each request. Predict: when you run the `fetch` version, does the server that answers print anything? and when you run the lesson's? What value does `Host` have in that case?

### Exercise 5 — Reproduce the race and the two closes

Section 8.14.1 told of a race, a first fix with its limit and the staged close. Reproduce them yourself. Copy `fig08_01/` to a `viejo/` folder, replace `respuestas.ts` with `defectos/cierre-brusco/respuestas.ts`, start the `revisor` from `viejo/` and run `fig08_05.ts` three times. Predict first: will the number of `413` responses be the same in all three? what will be the cause of those that receive no response? Then stop that `revisor`, repeat with `defectos/drenar-antes/respuestas.ts` and run `node fig08_05.ts 100 3000` (3 MB per attempt): predict how many of the 100 receive their `413`. Finally repeat those 3 MB against the `revisor` in `fig08_01/` as it is. Stop each `revisor` by its PID before starting the next one. Answer with arguments: why does the first fix fail above 1 MiB and the second does not? What is still paid in the second? What would happen if a version of Node stopped calling `socket.destroySoon()` when closing?
### Exercise 6 — Close the fixed wait

Section 8.14.1 ended with a fragility that the lesson's matrix no longer has: waiting a fixed time after starting each process. Here you fix it yourself, starting from the version that does have it: `defectos/espera-fija/matriz23.ts`. First measure the margin with `fig08_06.ts`, which starts the gateway 100 times and says how long it takes to answer. Then copy `fig08_01/` to a `mia/` folder, put `defectos/espera-fija/matriz23.ts` there and change it so that, instead of waiting a time, it waits for the port to accept connections (and fails with a message if it does not). To know whether you got it right, run `ejercicios/ej6/arranque-lento.sh` on a folder with that matrix: it delays the startup of the `revisor` and the gateway by 700 ms. Predict beforehand: how many checks pass with the fixed wait and how many with yours? how long do you think the gateway takes to answer, in the worst of the 100 startups? Finally, run your matrix eight times in a row with the machine saturated (for example, with twice as many `node -e 'while(true){}'` programs as your CPU has cores, which you stop by their PID when you finish).

## Solutions

### Solution 1

The solution is in `ejercicios/ej1/openapi.json`. It adds an `E404Revision` response next to `E404`, with the description "The revision does not exist (type revision-inexistente)." and the same content, and makes `GET /revisiones/{id}` point to it:

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

The three runs, with that document:

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

`fig08_02.ts` goes from one gap to **zero gaps**; the matrix stays at 41 of 41, because the change removes nothing the matrix looks for; and the validator still says "valid" with **the same 26 warnings**: a response that is used was added, so there are no unused components or new operations. If you predicted more warnings, you probably thought every addition adds noise; here it does not, because the validator only counts what is incomplete.

### Solution 2

The two lines are in `ejercicios/ej2/matriz23.ts`, right below the one that asks for `title`:

```ts
      if (typeof cuerpo.title !== "string") fallas.push("falta title");
      if (typeof cuerpo.detail !== "string") fallas.push("falta detail");
      if (typeof cuerpo.instance !== "string") fallas.push("falta instance");
```

Two lines that now ask for `detail` and `instance` as text. The three runs:

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

The first run is the important one: **the original matrix, against a server that lacks `instance` in all its errors, gives 40 of 41**. The only red line is the `500` one, because that scenario already asked for `instance` to be a `urn:uuid`; the other 15 errors with the defect passed. That is what "the test does not look at what it does not look at" means. The second run confirms that the extended matrix stays at 41 of 41 with the good server (nothing that was added breaks what already worked). The third is the positive control: against the server with the defect, the extended matrix flags the **16 error scenarios**, one for each error, ending at 25 of 41. It is the lesson of section 8.10 applied to a test of your own: you extended a yardstick and saw it bite.

If your prediction for the third was different, count the scenarios that are errors: sixteen of the 23 codes are (from `400` to `504`), and the additional checks do not go through `comprobar`, so they are not affected.

### Solution 3

The document without the `405` is built with a Node one-liner on a copy:

```bash
node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("openapi.json","utf8")); delete d.paths["/servicios/{id}"].get.responses["405"]; fs.writeFileSync("openapi.json", JSON.stringify(d,null,2)+"\n");'
```

It is run inside the copy's folder, and then the matrix and the validator:

```text
$ node matriz23.ts   # sin el 405 de GET /servicios/{id} en el documento
FALLA 405 método no admitido: openapi.json no documenta 405 en GET /servicios/{id}

40 de 41 comprobaciones pasaron (23 escenarios de código y 18 adicionales).

$ npx redocly lint openapi.json --format=stylish   # el mismo documento
Woohoo! Your API description is valid. 🎉
You have 26 warnings.
```

One red line in the matrix, with the exact message from section 8.6.3: `openapi.json no documenta 405 en GET /servicios/{id}`. And the validator, which looks at the document without knowing anything about the server, accepts it as valid: there is no rule that says "an operation has to declare a `405`". It is the table from 8.11.3 in one line. If a second red line appears in the matrix run (the chunked body check), it is the race from section 8.14.1 and has nothing to do with your change.

### Solution 4

The variant is in `ejercicios/ej4/fig08_04.ts`. It changes a single thing, the "lab":

```ts
const laboratorio = createServer((p, r) => {
  console.log(`  el laboratorio recibió Host: ${p.headers.host ?? "(ninguno)"}`);
  r.writeHead(200);
  r.end();
});
```

And the run, with the lesson's version:

```text
$ node fig08_04.ts fig08_01   # la variante del ejercicio 4
$ consultar("http://rebote.ejemplo:18081/")   con el cliente de fig08_01
  pregunta 1 al DNS: rebote.ejemplo -> 127.0.0.1
  el laboratorio recibió Host: rebote.ejemplo:18081
{"tipo":"respuesta","codigo":200,"ms":4,"reintentarEn":null}
el DNS fue preguntado 1 vez
```

The lab received `Host: rebote.ejemplo:18081`: the URL's name, with its port, even though the connection went to `127.0.0.1`. It is what the `lookup` option does: it decides **where** to connect and does not touch **what is said** once connected. With the `fetch` client (`con-fetch`) the lab prints nothing, because the connection did not reach it: it reached the `299` server, which prints nothing. If you predicted that the `Host` would be `127.0.0.1:18081`, you thought that whoever connects to an IP also uses it as the name; that is how a request written by hand with the IP in the URL works, and that is why the lesson's client does not write the IP in the URL.

### Solution 5

The figures are in four files: `defectos/cierre-brusco.salida.txt` (the abrupt close), `defectos/drenar-antes.salida.txt` (discarding the body before responding), `fig08_05.salida.txt` and `fig08_05.limite.salida.txt` (the staged close). The abrupt close:

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

With the abrupt code, the number of `413` responses changes from one run to another (the race depends on how time is divided between the server's close and the client's write) and does not reach 400 in any; the missing ones end in `EPIPE`, with some `ECONNRESET`. The first fix, with 400 attempts of 20 KB and then with larger bodies:

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

Up to 1 MB, 100 of 100; with 1.1 MB, 8 of 100; with 3 MB, 0 of 100. And the staged close, with the usual bodies and with the large ones:

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

**400 of 400** in all six runs, and **100 of 100** with 1 MB, 3 MB and 20 MB.

On the differences. The first fix **reads before responding** and has a cap of 1 MiB: above the cap it responds and closes abruptly, so the client that keeps writing gets the RST again and loses the `413`; the cap moved the race, it did not close it. The second does what RFC 9112 describes: it **responds immediately**, closes only the write side (`socket.end()`) and keeps reading and discarding whatever arrives, so that the client can read the `413` even if it keeps sending, up to the clock's 2 seconds. What is still paid: during those 2 seconds the server reads whatever the client wants to send (there is no longer a byte cap). What depends on Node: that `http` calls `socket.destroySoon()` when closing a response with `Connection: close`; if it stopped doing so, the replacement would not run and the measurement would drop below 400, which is the reason for having it.

### Solution 6

The solution is in `fig08_01/matriz23.ts` itself (`ejercicios/ej6/matriz23.ts` is the same): two functions at the top of the file that replace the four fixed waits that came after starting a process.

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

`await esperar(500)` (the gateway) and the three `await esperar(1000)` (the `revisor`, twice, and the matrix on startup) become `arrancar("pasarela.ts", 18082)`, `arrancar("servidor.ts", 18080)` and `esperarPuerto(18081, …)` and `esperarPuerto(18080, …)` with the corresponding port; and at the start of the run, a check that exits with `2` if any of the three ports already responds. The measurements, all saved in `ejercicios/ej6.salida.txt` (there `espera-fija/` is a copy of `fig08_01/` with `defectos/espera-fija/matriz23.ts` on top, and the ports were rewritten as in the rest of the lesson):

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

Read it carefully, because what it says and what it does not say matter equally. The first part gives the margin: how long the gateway took to answer in 100 startups, and how many exceeded the 500 ms that the fixed-wait matrix waited (and the 1000 it waited for the `revisor`). The second repeats the measurement with the CPU saturated. The third runs the two matrices eight times with those processes spinning.

What **was** measured: with the machine saturated, neither matrix failed, and the startups fit within the wait; saturating the CPU was not enough to trigger the failure (the operating system usually gives priority to a newly created process), so that experiment does not tell the two matrices apart. What does tell them apart is the **negative control**, and that one is reproducible: with the startup delayed 700 ms on purpose, the fixed-wait matrix gives `40 de 41`, with the failure `pasarela sin revisor: 0 null` that was seen during the lesson, and the matrix with `esperarPuerto` gives `41 de 41`. And if something already occupies a port, the matrix says so and exits with `2` without measuring. One caveat: we chose the 700 ms delay ourselves to fall between the two fixed waits (500 and 1000 ms). That the wait for the port holds up is reasoning plus measurement; it does not prove that no startup, on any machine, takes longer than the 10 seconds it grants.

## Closing the course: how you know you finished

The course README promised five things that your API has to meet at the end. With this lesson, all five are checkable, and here is what checks each one:

| Course promise | What checks it |
|---|---|
| The 23-scenario matrix runs with a single command, and each row checks code, headers, content type and body | `node matriz23.ts` (section 8.7) |
| No error response is `200` or HTML; all are `application/problem+json` with a stable `type` | the content type and `type` of each scenario (8.6.3) and the catalog cross-check (8.5) |
| No `5xx` body contains stacks, queries, paths or keys | the `5xx` leak list (8.6.4), with the caveats of 8.14 |
| A repeated `POST` with the same key duplicates nothing; with another body, `422`; in progress, `409` | additional check 1 (8.8) and `fig06_03.ts` from Lesson 6 |
| The `revisor` classifies the 23 cases with a table and does not retry what it must not | `tabla23.ts` from Lesson 7, which still gives the same after changing `cliente.ts` |

Two honesty warnings, because this course has repeated them: `Idempotency-Key` and the `RateLimit-*` headers are still not a standard (the draft for the first expired on April 18, 2026 without being published as an RFC; the `RateLimit-*` one is still an active IETF draft), and a green matrix says that **what the matrix looks at** is fine. What it does not look at (section 8.14) remains in your hands.

## How I know I made it

- [ ] You open `openapi.json` and point to its five pieces: `info`, `servers`, `security`, `paths` and `components`; and you explain why `info.version` is not the API's version.
- [ ] You explain why error responses are written once in `components` and reused with `$ref`, and say how many references there are to how many responses (79 to 18).
- [ ] `node fig08_02.ts` flags one gap (`revision-inexistente`) with the lesson's document, and zero gaps with exercise 1's.
- [ ] `node matriz23.ts` gives `41 de 41` and exits with `0`; with `defectos/sin-problem-json/problemas.ts` it gives `24 de 41` and exits with `1`; with `defectos/sin-429-documentado/openapi.json` it gives `40 de 41`.
- [ ] `bash fig08_03.sh` gives `23 de 23`, and you explain what the `curl` version checks less than the TypeScript one.
- [ ] With Redocly CLI, the document gives "valid" with 26 warnings, the broken document gives two errors, and the document without the `429` also gives "valid"; and you explain why.
- [ ] `node fig08_04.ts con-fetch` reaches the `299` server with two questions to the DNS, and `node fig08_04.ts fig08_01` reaches the lab with one; and you say why the certificate is still verified against the name.
- [ ] You explain `Deprecation`, `Sunset` and `Link` with `rel="deprecation"`, and what `deprecated: true` marks in the document.
- [ ] You say, with two measured examples, what the matrix cannot see.
- [ ] `fig08_05.ts` gives 400 of 400 against `fig08_01/` and fewer than 400 against the `respuestas.ts` in `defectos/cierre-brusco/`; with 3 MB (`node fig08_05.ts 100 3000`) it gives 100 of 100 against `fig08_01/` and 0 of 100 against `defectos/drenar-antes/`; and you explain why responding first and closing only the write side closes it.
- [ ] The "adjusted" matrix gives green against the server with the defect, and you explain why that is worse than a red matrix.
- [ ] When you finish, no program is left listening: `curl -i http://127.0.0.1:18080/` and `curl -i http://127.0.0.1:18081/` give error 7.

## Summary

Answer without looking at the lesson:

1. What are the five pieces of an OpenAPI document and what does each contain? What is `info.version`?
2. What is `$ref` for, and why do error responses go in `components`?
3. What four things does a response promise, and which of them did the opening "cleanup" break?
4. What does `comprobar` check in each scenario, in order? Why does it gather all the failures instead of stopping at the first?
5. What is a regression, and how many additional checks does the matrix have?
6. What does an OpenAPI validator say and what does it not say? What question does the matrix answer?
7. What is a test that "blesses the defect"? How is it avoided?
8. What is *DNS rebinding*? Why does validating before each connection not close it, and what does?
9. What does the `lookup` option do and what does it not do? Why does `soloA` answer in two ways?
10. What do `Deprecation`, `Sunset` and `Link` with `rel="deprecation"` say, and what does `deprecated: true` mark?
11. Name three things the matrix does not see.
12. Why did the chunked body check sometimes fail? How was it measured and how was it closed? Why did the first fix (discarding the body before responding) have a limit and the staged close does not?

## Sources

All consulted on October 21, 2026.

1. [OpenAPI Specification v3.1.1](https://spec.openapis.org/oas/v3.1.1.html) (October 24, 2024): `info.version` as the document's version (4.8.2.1), `servers` (4.8.1.1), the operation object, `deprecated`, `security` and `operationId` (4.8.10.1), the path objects (4.8.9.1), parameter objects (4.8.12.2.1), responses and response objects (4.8.16 and 4.8.17), reference objects (4.8.23.1), schema objects (4.8.24) and `x-` extensions (4.9).
2. [Migrating from OpenAPI 3.0 to 3.1.0](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0) (P. Sturgeon, February 16, 2021): the alignment with JSON Schema 2020-12 and the replacement of `nullable` by a list of types.
3. [RFC 9457, *Problem Details for HTTP APIs*](https://www.rfc-editor.org/rfc/rfc9457.html) (July 2023, Standards Track; replaces RFC 7807): the members `type`, `title`, `status`, `detail` and `instance` (3.1), and the extension members, which whoever consumes must ignore if it does not recognize them (3.2).
4. [IANA, `application/problem+json` registry](https://www.iana.org/assignments/media-types/application/problem+json): the content type and its reference, RFC 9457.
5. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html): `Allow` on the `405` (15.5.6), `Retry-After` on the `503` (15.6.4).
6. [RFC 9112, *HTTP/1.1*, section 9.6 (*Tear-down*)](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.6): the risk of closing a connection immediately and the staged close.
7. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (March 2025, Standards Track): `Deprecation` as a structured field date, the relationship with `Sunset` and the `deprecation` relation of `Link`.
8. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (May 2019, informational): the format and that the dates are hints.
9. [Node.js, `net.connect`](https://nodejs.org/docs/latest-v24.x/api/net.html): the `lookup` option and `autoSelectFamily` (on by default since version 20).
10. [Node.js, `dns.lookup`](https://nodejs.org/docs/latest-v24.x/api/dns.html): the `all` option and the form of the *callback* in each case.
11. [Node.js, `http.request`](https://nodejs.org/docs/latest-v24.x/api/http.html): the `agent: false`, `lookup` and `signal` options, and the mix of `url` and `options`.
12. [Node.js 24.14.1 "Krypton" (LTS)](https://nodejs.org/en/blog/release/v24.14.1) (March 24, 2026): the version the outputs were run with.
13. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): *DNS rebinding* and pinning the connection, redirects, allow lists versus deny lists.
14. [GHSA-489g-7rxv-6c8q](https://github.com/advisories/GHSA-489g-7rxv-6c8q) (July 10, 2026): *MCP Atlassian*, an incomplete SSRF fix for not pinning the validated IP; fixed in version 0.22.0.
15. [GHSA-9hgc-g3w5-67cm, CVE-2026-53708](https://github.com/advisories/GHSA-9hgc-g3w5-67cm) (June 15, 2026): *ContextForge*, a race between validation and connection in an administration entry point; fixed in version 1.0.3. It is the primary source that was consulted: this CVE's NVD page (nvd.nist.gov) returned no readable content when queried.
16. [Redocly CLI, `lint` command](https://redocly.com/docs/cli/commands/lint): what it does, the default recommended rule set and the output formats; the version used is 2.57.0 (September 30, 2026), MIT license.

### Terms in this lesson

| | |
|---|---|
| **OpenAPI** | the specification for describing an HTTP API in a document that machines read; the course uses 3.1.1 |
| **operation** | a method on a route (`GET /servicios/{id}`) and everything that is said about it |
| **`$ref`** | the reference to a piece written elsewhere in the document, normally in `components` |
| **validator (*linter*)** | the program that says whether a document is well written according to the specification |
| **matrix** | the table of scenarios that is walked through with a single command, comparing each response with what was promised |
| **regression** | a test of something that was already fixed once, so that it does not return without anyone noticing |
| **making the test bite** | showing that a test detects a defect by undoing the fix and seeing it go red |
| **blessing the defect** | a test passing because it adjusted to what is broken instead of demanding what was promised |
| **DNS rebinding** | a name changing address between the check and the connection, because of a DNS answer that lies the second time |
| **TOCTOU** | *time of check, time of use*: a race between when something is checked and when it is used |
| **`deprecated`** | the operation field that warns it is no longer advisable to use it |
| **`Deprecation`, `Sunset`** | the headers that say since when something is deprecated and when it is expected to stop responding |

---

The course ends with this lesson; your logbook comes next.

**Previous:** [Lesson 7 — Who reads the error: the `revisor`'s client and AI agents](07-quien-lee-el-error.md)

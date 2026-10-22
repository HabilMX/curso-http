# Errors that teach: HTTP codes and Problem Details — an API that tells the truth when it fails

**By Dorian Chávez, founder of Hábil and integration architect.**

**Who it is for:** anyone who has already written an API in any language and at some point returned `200` with a body that said `{"error": …}`, used `500` for everything that went wrong, or could not explain the difference between `401` and `403`, between `409` and `412`, between `400` and `422`; and anyone who consumes third-party APIs and wants to stop guessing what to do when they fail. It is an intermediate-level course: you are assumed to know what an HTTP request is, what JSON is, and how to start a server. You are not assumed to know the specifications: every code is explained as it comes up, along with why it exists, not just which number to use.

**What you will know by the end:** how to choose the right code with a question that can be answered, produce error responses that a machine knows how to read (the RFC 9457 *Problem Details* format), decide what gets retried and what does not, and prove with `curl` that your API does what it says. And you will be able to read the specifications on your own.

**What you need before you start:** a computer with Linux Mint, knowing how to open a terminal and how to read a short program in TypeScript. The programs use Node 24 with zero dependencies, and the tool for the entire course is `curl`. [Lesson 0](00-el-contrato-que-viaja.md) gets the environment ready.

**Where to go next:** if you want to see the same care applied to an entire API, our articles on [APIs ready for AI agents](https://www.habil.mx/en/blog/apis-ready-for-ai-agents-what-your-system-needs/), on [API security](https://www.habil.mx/en/blog/api-security-cto-identity-gateway-tokens/) and on [REST or gRPC](https://www.habil.mx/en/blog/rest-or-grpc-when-to-use-each-and-why/) continue where this course ends.

## The project you will build

The **`revisor`**, the program that checks the status of a list of services (name, status and response time), with **two sides**:

- As a **server**, a small API to manage the list of services it watches: register, query, modify, remove, and request a check. It is the side that *produces* errors, and it has to produce them well.
- As a **client**, the one that queries the services and decides, based on what they return, whether they are available, rate-limited, under maintenance or down, and whether it is worth retrying. It is the side that *reads* errors.

It is the same problem as in our Go, Rust and TypeScript courses. What changes is the question: not “could it be queried?”, but “what did the service *say* and what should I do with that?”. And to trigger each code at will, lesson 0 builds a test server that returns whichever code you ask for.

## The nine lessons

There are nine and not ten because the catalog is bounded (23 codes) and a single specification governs the error body. Success responses and redirects share lesson 1 because, in an API, what is hard about them comes down to the same three decisions.

| Lesson | | What you build | What you learn |
|---|---|---|---|
| 0 | [The contract that travels over HTTP](00-el-contrato-que-viaja.md) | the test server and your instrument: `curl -i` | status line, headers and body; the five families; the code decides and the body explains; what a machine does with a code it does not know; the official registries |
| 1 | [Successes and redirections: 200, 201, 202, 204, 301, 308, and 304](01-exitos-redirecciones.md) | the routes that register, query and remove services; the legacy route | returning, creating, accepting or returning nothing; `Location`; `202` and its tracking resource; `301` versus `308`; `ETag` and `If-None-Match`. **Security box:** SSRF; the `revisor` rejects loopback, private networks, link-local or metadata and ULA, checks this before every connection (after resolving DNS), and the lab allows only one exception for an exact IP and port; the complete protection against *DNS rebinding* comes in lesson 8 |
| 2 | [The client made a mistake (I): 400, 401, 403, 404, 405, and 415](02-errores-del-cliente-peticion.md) | the API's entry point | seven steps in order: route → method → credential → permission → existence → format → reading; `WWW-Authenticate` and `Allow`; when a `404` hides a resource on purpose; the `413` for the 16 KiB body limit (a safety net, outside the 23). **Security box:** the `404` that hides a resource on purpose and resource enumeration |
| 3 | [The client made a mistake (II): 409, 410, 412, 422, and 428](03-errores-del-cliente-estado.md) | changing a service without overwriting someone else's | conflict, business rule and precondition; the lost update; `ETag` with `If-Match`; `410` versus `404`; `400` versus `422`; **API versions**: the retirement announced before the `410`, with `Deprecation` (RFC 9745) and `Sunset` (RFC 8594) |
| 4 | [Server capacity and failures: 429, 500, 502, 503, and 504](04-capacidad-y-fallas-del-servidor.md) | rate limiting, maintenance and a slow dependency | who is at fault; `Retry-After`; `500`, `502` and `504`; what is never said in a server error. **Security box:** what is never said in an error, and the `429` as protection |
| 5 | [Problem Details (RFC 9457)](05-problem-details.md) | the central error handler | `application/problem+json`; the five members; stable `type`; extensions; multiple problems; from RFC 7807 to 9457; with `about:blank`, the `title` is in English, because RFC 9457 (§4.2.1) asks it to be the HTTP status phrase, while `detail` may be in Spanish |
| 6 | [Retries and idempotency](06-reintentos-idempotencia.md) | a `POST` that can be repeated without duplicating | safe and idempotent methods; exponential backoff with *jitter*; `Idempotency-Key` and why it is not yet a standard |
| 7 | [Who reads the error: the `revisor`'s client and AI agents](07-quien-lee-el-error.md) | classifying responses from checked services | decision table by code and by `type`; correct, reauthenticate, wait, reconcile or give up; how an AI agent uses the same fields |
| 8 | [The verifiable contract](08-contrato-verificable.md) | the OpenAPI description and the 23-scenario matrix | documenting every error in OpenAPI 3.1; the catalog of problem types; the complete `curl` matrix; API versions in OpenAPI |

At the end of each lesson there are exercises with their solutions. And the [logbook](bitacora.md) is yours: write down there what was hard for you.

## The course's 23 codes

| Family | Codes | Lesson |
|---|---|---|
| Success | `200`, `201`, `202`, `204` | 1 |
| Redirection and cache | `301`, `308`, `304` | 1 |
| The client made a mistake: the request | `400`, `401`, `403`, `404`, `405`, `415` | 2 |
| The client made a mistake: state | `409`, `410`, `412`, `422`, `428` | 3 |
| Server capacity and failures | `429`, `500`, `502`, `503`, `504` | 4 |

Others appear in passing, to explain how they differ from the previous ones (`302`, `307`, `406`, `501`). `413` isn't one of the 23 either, but the `revisor` does return it: it is the safety net for the 16 KiB body limit, which lesson 2 explains alongside `415`. For each code, the course teaches you **when to use it, when not to (and which one goes in its place), and the minimum correct response**.

## Three principles that run through the whole course

**The code decides and the body explains, and both say the same thing.** The status code is what any machine along the way reads (the browser, the cache, the load balancer, the monitor); the body is for whoever needs the detail. A body that contradicts the code, or replaces it, breaks everything that does not read it.

**A well-designed error says what to do.** Correct the input, authenticate, wait, reread the state or give up: almost always, whoever receives the error is a program, and a program does not guess. That is why each lesson closes with the question “what should whoever receives this do?”.

**What leaves the API is designed on purpose.** An error is a public surface. What is not said—stack traces, queries, paths, machine names, keys—matters as much as what is said, and it is taught as it comes up, not in a final security module.

**An honest caveat:** `Idempotency-Key` and the `RateLimit-*` headers **are not yet a standard**; they circulate as IETF drafts. The course teaches them as a pattern that the API documents and not as an HTTP requirement, and says so every time they appear.

## How you know you are done

The course does not end when you have read lesson 8, but when your API meets these five things. They are the same checks that run on every change:

1. **The 23-scenario matrix runs with a single command**, and each row checks code, required headers, content type and body.
2. **No error response is `200` or HTML.** All of them are `application/problem+json` with a stable `type`.
3. **No `5xx` body contains stack traces, queries, paths or keys.**
4. **A repeated `POST` with the same key does not duplicate anything.** If the same key arrives with a DIFFERENT body, it returns `422`; if it arrives while the original request is still in progress, it returns `409`. This comes from the IETF draft "The Idempotency-Key HTTP Header Field" (`draft-ietf-httpapi-idempotency-key-header-07`, expired on 18 April 2026), which is NOT a standard.
5. **The `revisor` classifies the 23 cases with a table** and does not retry what it should not retry.

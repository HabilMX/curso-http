# Lesson 0 — The contract that travels over HTTP

It is 11:40 PM on a Friday. The `revisor` dashboard says all four services are up: `catalogo`, `inventario`, `pagos`, and `reportes`, all four in green. The company's monitor is also green: zero errors in the last hour. And even so, the support chat is filling up with messages from people who cannot pay. Someone opens a terminal, asks `pagos` for its status, and reads the full response for the first time tonight. The first line reads `HTTP/1.1 200 OK`. The body, three lines below, reads `{"error": "la base de datos no está disponible"}`. Every program watching the service read the first line and was reassured. Not a single one read the body. The service had been down for forty minutes, claiming it was fine.

This lesson is about that first line: what it says, who reads it, and why it cannot lie.

**Time:** 90 min, or 2 × 45 (the break is between sections 0.4 and 0.5)

**What you build:** the course environment (Node 24 and `curl`), your first HTTP server, and the **test bench** you will use across all lessons: a server that responds with whichever status code you ask for (`GET /codigo/503`) along with the headers that code carries

**What you learn:** what an HTTP response is (status line, headers, body); the five code families; **the code rules and the body explains**; what a program does with a code it does not know; where the official registries of codes, headers, and problem types live; and why a `200` with `{"error": …}` tricks the cache, the monitor, and the client

**Where you are coming from.** You bring nothing from this course yet. You do bring what the [README](README.md) asks for: you have already written some API, in whatever language, you know what an HTTP request is and what JSON is, and you can read a short program in TypeScript. You do not need to know any specification: every time the lesson cites one, it tells you which section and what it says.

**What this lesson does not do.** It does not teach how to choose a code for a specific situation: that begins in [Lesson 1](01-exitos-redirecciones.md) with successes and continues through Lesson 4 with errors. It does not format error bodies: here the body is a single line of text, and [Lesson 5](05-problem-details.md) switches it to `application/problem+json`. And the cache that appears in section 0.8 is a **toy cache**, sixty lines long, which applies two real rules from the specifications; it lets you see the problem with your own eyes, not for use in production.

**About the runs.** Linux Mint 22 is the course's reference system. The outputs in this lesson were obtained on October 21, 2026 on macOS with Node 24.14.1 and curl 8.7.1, and were repeated in full in an Ubuntu 24.04.5 container (the base for Linux Mint 22) with Node 24.22.0 and curl 8.5.0, the `curl` installed by `apt`. Both runs produced the exact same output line by line except for three things, which are flagged where they appear: the date in the `Date` header (which will be your current date), the `curl` version seen in `curl -v`, and the error number for "address already in use" (`-48` on macOS, `-98` on Linux). It was not run on a Mint desktop installation. The programs are in [`programas/00-el-contrato-que-viaja/`](../programas/00-el-contrato-que-viaja), in the course repository, each with its run in a `fig00_NN.salida.txt` file. All pass `tsc` in strict mode (section 0.9 explains how to verify it).

## By the end you will be able to

- Start an HTTP server with Node 24 without dependencies and query it with `curl -i`, `curl -v`, and `curl -I`.
- Point out in a real response the status line, each header, the empty line, and the body, and state which part each program along the way reads.
- Identify the family of any three-digit code and explain what a client must do with a code it does not know, citing the rule from RFC 9110.
- Trigger any code at will using the test bench and check with `curl` which headers it carries.
- Find a code or header in the IANA registry and count how many codes are assigned in a family without falling into the trap of "Unassigned" lines.
- Demonstrate with a run that a `200` with an error in the body passes the `curl -f` health check, gets stored in a cache, and prevents the cache from serving the good copy.

## The why before the how

An API speaks with many programs you do not know. The one that called it, sure: you or someone on your team wrote it, and it knows how to read your JSON. But between that program and your server there are others that never read your documentation: a load balancer deciding which machine to send each request to, a cache storing responses to avoid repeating work, a monitor counting errors per minute, a health check restarting the service if it does not answer properly, and each language's own HTTP client, which comes with its built-in rules. **None of them needs to understand your body. All of them understand the number.** (Some gateways do inspect the content, and some clients do read it; but you cannot count on them, and the number is the only thing they all have in common.)

That is why the first line of a response is a contract. It is not a contract you sign with a person, but with all existing software that follows the same specifications. When your server responds `503`, each of those programs knows something without asking you: the monitor counts it as a failure, the health check flags it, the cache can serve an earlier copy, and the client knows the problem is not on its end. When it responds `200`, all of them conclude that everything went well, regardless of what the body says. The opening scene is not an exaggeration: it is what happens when the number and the body say different things, and the number wins because it is the only thing almost everyone reads.

In the `revisor`, this plays out on both sides. As a **client**, the `revisor` queries third-party services and decides whether they are up based on what they return; if a service lies with a `200`, the `revisor` lies along with it. As a **server**, the `revisor` is an API someone else will query, and its errors must tell the truth in the number so its own clients, monitors, and caches are not deceived.

The lesson has five parts, in this order:

1. **The environment and the first response** (0.1 and 0.2): you install Node 24, spin up a fifteen-line server, and see what actually travels.
2. **The families** (0.3): the code's first digit, and the question each family answers.
3. **The test bench** (0.4): the server that returns whichever code you ask for, which you will use throughout the course.
4. **Who reads what** (0.5 to 0.7): the code rules and the body explains; what a program does with a code it does not know; and where it is written which codes exist.
5. **The damage** (0.8): a cache, a monitor, and a client facing a server that lies versus one that tells the truth.

With that destination in mind, this is what you will see in section 0.8: the same downed service, seen through a cache, in two versions. In the first, the server responded `200` with its error, and the cache stored it and repeats it. In the second, the server responded `503`, and the cache served the last good copy:

```text
{"error":"la base de datos no está disponible"}
```

```text
{"servicios":["catalogo","pagos"]}
```

The only thing that changed between the two runs was the number.

## The concepts

### 0.1 The environment: Node 24, `curl` and a folder

#### 0.1.1 `curl`

`curl` is the course's instrument: a terminal program that makes an HTTP request and shows you what the server responded, without a pretty screen hiding anything. It comes first because you need it to install Node, and then for everything else. If `curl --version` does not answer, install it:

```bash
sudo apt install curl
```

#### 0.1.2 Node 24

The course programs are written in TypeScript and executed by **Node.js 24**. Node 24 has a feature this course leverages: it runs a `.ts` file directly, **stripping types** before running it, without compiling to JavaScript and without installing anything else. The [Node 24 documentation](https://nodejs.org/docs/latest-v24.x/api/typescript.html) describes it like this: Node replaces type annotations with whitespace and executes what remains; therefore it only accepts TypeScript that can be "erased" without changing the program. Whatever cannot be erased this way (an `enum`, a `namespace` with code, parameter properties declared in a constructor) produces an error, and the course programs do not use them. This feature has been enabled by default since Node 23.6, stopped printing the "experimental" warning in 24.3, and was declared stable in 24.12.

Why Node 24 and not another? Because it is an **LTS** (*long-term support*) release line. According to the [official Node release schedule](https://github.com/nodejs/Release), 24 entered LTS on October 28, 2025, moved to the maintenance phase on October 20, 2026, and receives fixes until April 30, 2028. Node 26 will be LTS starting October 28, 2026; the programs in this course do not use anything that changes between the two.

On Linux Mint 22, it is best not to install Node via `apt`: Mint 22 is based on Ubuntu 24.04, and the `nodejs` package from that base is version 18.19.1 (verified with `apt-cache policy nodejs` in an Ubuntu 24.04 container), a line that no longer receives fixes. It is installed using **nvm**, the Node version manager recommended by the [Node download page](https://nodejs.org/en/download), just as in Hábil's TypeScript course. The [nvm documentation](https://github.com/nvm-sh/nvm) publishes this installer for version 0.40.8, the current release:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

> **Security note.** The pipeline `| bash` executes on your machine, without you reading it, whatever is returned from that address. Here it is reasonable because it is the official `nvm` installer, over HTTPS and with a pinned version (`v0.40.8`), but never do this with an address you do not know. If you want to check it beforehand, download it to a file (`curl -o instalar-nvm.sh` with the same address), inspect it, and run it afterward with `bash instalar-nvm.sh`.

Close the terminal, open another one (the installer adds `nvm` to your startup file, and the terminal already open will not notice), and request the 24 line:

```bash
nvm install 24
nvm alias default 24
node -v
```

`node -v` should print a number starting with `v24`. The number that follows depends on the day you install; the runs in this lesson were done with 24.14.1 and 24.22.0, and yielded the same output.

#### 0.1.3 The course folder

The entire course lives in a folder, `~/curso-http/`. Create it and enter it, because all commands in this lesson are run from there:

```bash
mkdir -p ~/curso-http && cd ~/curso-http
```

Place inside a `package.json` file with a single instruction:

```json
{
  "type": "module"
}
```

That file does not install anything; the course has no dependencies. It only tells Node, and `tsc` if you use it, that the files in that folder are **ESM modules**, the modern form of JavaScript that uses `import`. Without it, Node would have to guess every time.

### 0.2 A response on the inside

#### 0.2.1 The first server

This is the smallest HTTP server worth writing. Save it as `~/curso-http/fig00_01.ts`:

```ts
// fig00_01.ts
import { createServer } from "node:http";

const servidor = createServer((peticion, respuesta) => {
  console.log(`${peticion.method} ${peticion.url}`);
  const cuerpo = "el revisor está escuchando\n";
  respuesta.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(cuerpo),
  });
  respuesta.end(cuerpo);
});

servidor.listen(18080, "127.0.0.1", () => {
  console.log("escuchando en http://127.0.0.1:18080");
});
```

Read it from top to bottom. `node:http` is the Node module that knows how to speak HTTP; the `node:` prefix indicates it comes with Node and not from an external package. `createServer` takes a function that Node calls **once per request**, with two objects: the `peticion` that arrived and the `respuesta` you are going to write. The function logs the method and the path (so you can see in the server's terminal what reached it), and then writes the response in two steps. `writeHead` writes the **status code** and the **headers**; `end` writes the **body** and closes the response.

Two headers, both for a reason. `Content-Type` states what the body is: plain text in UTF-8. `Content-Length` says how many **bytes** it measures, which is why it is calculated with `Buffer.byteLength` and not `cuerpo.length`: the "á" in "está" takes up two bytes in UTF-8, and the body measures 28 bytes even though it has 27 characters. Finally, `listen` opens port 18080 on `127.0.0.1`, which is the name for "this same computer": no one from outside your machine can reach this server, which is as it should be while practicing.

Run it in a terminal, which you will leave open:

```text
$ node fig00_01.ts
escuchando en http://127.0.0.1:18080
```

The program does not exit: it stays waiting for requests until you stop it with `Ctrl`+`C`.

#### 0.2.2 What travels: `curl -i`

In **another** terminal, request something from it. The `-i` option tells `curl` to show the full response, with its status line and headers, and not just the body:

```text
$ curl -i http://127.0.0.1:18080/
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 07:27:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está escuchando
```

This is an HTTP response, and it has three parts, always in the same order:

| Part | In the run | Who wrote it |
|---|---|---|
| **Status line** | `HTTP/1.1 200 OK` | you, with the `200` in `writeHead`; Node added the version and `OK` |
| **Headers** | from `Content-Type` to `Keep-Alive` | you wrote two; Node added `Date`, `Connection`, and `Keep-Alive` |
| **Body** | `el revisor está escuchando` | you, with `end` |

Between the headers and the body there is **an empty line**. It is not decoration: it is the only way whoever reads it knows where the headers end. And the body ends where `Content-Length` specifies: 28 bytes, not one more. The specification defining this exact structure, line by line, is [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html), which describes HTTP/1.1 as it travels over the wire. What status codes and headers **mean** is in another document, [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), *HTTP Semantics*, which is the one you will cite most in this course. The separation makes sense: HTTP/2 and HTTP/3 travel differently, with a different binary format, but codes and headers mean the same across all three versions.

Now look closely at the status line. It has three parts: the version (`HTTP/1.1`), the code (`200`), and a phrase (`OK`). The phrase is called the *reason phrase*, and RFC 9112, in [section 4](https://www.rfc-editor.org/rfc/rfc9112.html#section-4), states something worth remembering from day one: a client **should ignore it**, because it is not a reliable information channel; it can arrive translated, an intermediary can change it, or it can disappear when transitioning to another HTTP version. The phrase is for the person reading the terminal. For programs, the only thing that counts is the number. In section 0.5 you will see that even Node uses phrases different from the official ones for some codes.

> **Note on the option name.** In recent versions of `curl`, the long option for `-i` is called `--show-headers` (it was previously called `--include`, and the old name still works), according to the [`curl` manual](https://curl.se/docs/manpage.html). `-i` works identically in both.

#### 0.2.3 The request also has structure: `curl -v`

An HTTP conversation has two halves, and `-i` only shows you the second. With `-v` (*verbose*), `curl` also shows you what it **sent**:

```text
$ curl -v http://127.0.0.1:18080/servicios
*   Trying 127.0.0.1:18080...
* Connected to 127.0.0.1 (127.0.0.1) port 18080
> GET /servicios HTTP/1.1
> Host: 127.0.0.1:18080
> User-Agent: curl/8.7.1
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< Content-Type: text/plain; charset=utf-8
< Content-Length: 28
< Date: Wed, 21 Oct 2026 07:27:41 GMT
< Connection: keep-alive
< Keep-Alive: timeout=5
< 
el revisor está escuchando
* Connection #0 to host 127.0.0.1 left intact
```

Lines beginning with `*` are `curl`'s comments about the connection. Those starting with `>` are the **request**, exactly as it went out: a line with the **method** (`GET`), the **path** (`/servicios`), and the version, followed by its own headers. Those starting with `<` are the response, the same as before. (On Linux you will see `curl/8.5.0` in `User-Agent`, or whichever version you have; that is the only difference.)

Notice two things. First: the request has the same structure as the response: an initial line, headers, an empty line, and, if needed, a body. Second: you requested `/servicios` and the server responded `200` with the same text as always, because this server does not check the path; it only prints it. In its terminal, `GET /servicios` appeared. A server that responds `200` to a path that does not exist is already telling a small lie, and the test bench in section 0.4 does not commit it.

#### 0.2.4 Just the headers: `HEAD` and `curl -I`

There is a method that exists specifically to ask about a response without receiving it: `HEAD`. The server answers exactly what it would answer to a `GET`, headers included, but without a body. `curl -I` sends a `HEAD`:

```text
$ curl -I http://127.0.0.1:18080/
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 07:27:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

`Content-Length` still says 28, because it indicates what the body of a `GET` would measure, but no body arrived. Your program did nothing special for this: it wrote the body with `end`, and Node, knowing the request was a `HEAD`, did not transmit it. In the server's terminal, `HEAD /` appeared. Health checks and some monitors use `HEAD` precisely because they only care about the number, and the number arrives all the same.

You can now stop the server with `Ctrl`+`C`. The rest of the lesson uses port 18080 for other programs.

### 0.3 Five families and one question

The status code is a three-digit number, and **the first digit is the family**. RFC 9110 defines five in [section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), and each answers a different question:

| Family | What RFC 9110 says | The question it answers |
|---|---|---|
| `1xx` | request received, continuing process | Should I keep waiting? Yes: this is not the final response |
| `2xx` | the request was successfully received, understood, and accepted | Did it go well? Yes |
| `3xx` | further action needs to be taken in order to complete the request | Where is it? Somewhere else, and I'll tell you where |
| `4xx` | the request contains bad syntax or cannot be fulfilled | Who made a mistake? The client |
| `5xx` | the server failed to fulfill an apparently valid request | Who made a mistake? The server |

The `1xx` family is different from the other four, and it is worth knowing from today. A `1xx` response is **interim**: according to [section 15.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.2), a request may receive zero or more `1xx` responses followed by **exactly one** final response from the other families. A `1xx` cannot carry a body, and it is never the final word. That is why the test bench in the next section refuses to produce one as a final response.

The question in the last column is the most useful in the course, and Lessons 2 to 4 turn it into a method. When an error arrives, before reading anything else, look at the first digit. A `4` says whoever needs to change something is whoever made the request: the input, the identity, the permission. A `5` says the request was fine and the server failed, and whoever made it has nothing to fix, though that does not authorize repeating it blindly ([Lesson 6](06-reintentos-idempotencia.md) deals with when it does). If you want to see this same table applied to a contacts API, with a server that lies alongside one that does not, the first issue of the "HTTP and Problem Details" series from Hábil's newsletter, cited at the end, walks through it code by code.

### 0.4 The test bench

#### 0.4.1 What it is for

To learn what a program does with a `503`, you need a server that responds `503` when you want it to. Waiting for a real service to go down is not a method, and triggering it in someone else's service is not acceptable. The test bench solves this: it is a server that responds, on the path `/codigo/NNN`, with whichever status code `NNN` you ask for, along with the headers that code requires or typically carries. You will use it in every lesson of the course, which is why it is worth reading carefully once.

#### 0.4.2 The program

Save it as `~/curso-http/fig00_02.ts`:

```ts
// fig00_02.ts
// El banco de pruebas del curso: responde el código que le pidas en /codigo/NNN.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const PUERTO = 18080;

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
  console.log(`banco de pruebas en http://127.0.0.1:${PUERTO}/codigo/NNN`);
});
```

The program has three parts.

**Two tables.** `NOMBRES` holds the official reason phrases for the 28 codes the course uses (the 23 main codes and the five that appear in passing), copied from the IANA registry, which is the official list of codes (section 0.7). `CABECERAS` holds the headers each code carries. Not all carry the same weight, and it is worth stating them accurately: RFC 9110 states that a `401` **must** generate a `WWW-Authenticate` header field containing at least one challenge ([section 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2)) and that a `405` **must** generate an `Allow` header field listing the allowed methods ([section 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6)). For redirects (`301`, `302`, `307`, `308`), the server **should** send `Location`. For `201`, `Location` identifies the created resource, and if omitted, the created resource is the request URI itself ([section 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2)). And `Retry-After` on a `503` is **optional** according to RFC 9110, as it is on a `429` under [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html), which is where that code was defined. Lessons 1 through 4 explain each in depth; the test bench just lets you observe them.

**The `enviar` function.** It constructs the body—one line with the code and its name, another with the explanation—and writes the response. There are two details. First: for `204`, `205`, and `304` it writes neither a body nor `Content-Type`, because those three codes cannot carry one: RFC 9112 ([section 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)) says a `204` or `304` response ends at the first empty line after the headers, and RFC 9110 ([section 15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6)) forbids generating content in a `205`. The list is not the whole rule. A `1xx` cannot carry a body either, but the bench already refuses to produce one (you saw that in 0.3 and will see it again in 0.4.4); and a response to `HEAD` never carries a body, which Node takes care of (0.2.4). A `205` is rare (it asks the browser to clear the form that was submitted), but the bench can produce it if you ask for one, and that is why it is on the list. Second: if the code is in `NOMBRES`, it passes the official phrase to `writeHead`; if not, it lets Node supply its own. The [`writeHead` documentation](https://nodejs.org/docs/latest-v24.x/api/http.html) accepts all three arguments: the code, the phrase (optional), and the headers.

**The `atender` function.** It acts as the entry point, checking conditions in order. First, the method: the test bench only handles `GET` and `HEAD`, and answers any other method with `405` and its `Allow` header; that is, the test bench enforces the rule it teaches. Next, the path: it must be `/codigo/` followed by exactly three digits, or the test bench replies `404` explaining the only existing path. Finally, the number: under 100 does not exist, a `1xx` cannot be a final response, and over 599 is invalid per the specification, but the test bench produces it anyway on purpose, because in section 0.6 you will need to see what a client does with a code that should not exist.

#### 0.4.3 Testing it

Run it in one terminal and leave it open:

```text
$ node fig00_02.ts
banco de pruebas en http://127.0.0.1:18080/codigo/NNN
```

In another terminal, ask it for a downed service:

```text
$ curl -i http://127.0.0.1:18080/codigo/503
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 50
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

503 Service Unavailable
lo pediste en /codigo/503
```

The code, its phrase, the `Retry-After` header ("try again in 120 seconds"), and an explanatory body. A created resource:

```text
$ curl -i http://127.0.0.1:18080/codigo/201
HTTP/1.1 201 Created
Location: /servicios/demo
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

201 Created
lo pediste en /codigo/201
```

A response with no content, carrying neither body nor `Content-Type`, because there is nothing to describe:

```text
$ curl -i http://127.0.0.1:18080/codigo/204
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

The `205` is of the same kind: no body. Since the program does not write `Content-Length`, Node sends the response in chunks, with a single final chunk of size zero (the form explained in 0.8.2); there is no content:

```text
$ curl -i http://127.0.0.1:18080/codigo/205
HTTP/1.1 205 Reset Content
Date: Wed, 21 Oct 2026 22:00:20 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

```

A missing identity, with the challenge required by the specification:

```text
$ curl -i http://127.0.0.1:18080/codigo/401
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="revisor"
Content-Type: text/plain; charset=utf-8
Content-Length: 43
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

401 Unauthorized
lo pediste en /codigo/401
```

#### 0.4.4 The three gates of the test bench

Now the three validations in `atender`, so you can see that the test bench also tells the truth when the one making a mistake is you. An unsupported method (`-X DELETE` tells `curl` which method to use):

```text
$ curl -i -X DELETE http://127.0.0.1:18080/codigo/200
HTTP/1.1 405 Method Not Allowed
Allow: GET, HEAD
Content-Type: text/plain; charset=utf-8
Content-Length: 56
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

405 Method Not Allowed
el banco solo atiende GET y HEAD
```

A path that does not exist:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 68
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

404 Not Found
la única ruta es /codigo/NNN; prueba con /codigo/503
```

And a `1xx` requested as a final response:

```text
$ curl -i http://127.0.0.1:18080/codigo/103
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 76
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

400 Bad Request
un 1xx es una respuesta intermedia: no puede ser la última
```

Each request was logged in the test bench terminal (`GET /codigo/503`, `DELETE /codigo/200`…). Leave the test bench running: you will need it in the next two sections.

### 0.5 The code rules and the body explains

#### 0.5.1 Who reads the number

This is the first of the course's three principles, and it can be seen with a tool you probably already have in some script: `curl -f`. With `-f` (*fail*), `curl` stops being an instrument for observing and becomes an instrument for **deciding**: if the code is `400` or greater, it suppresses the body and exits with status code 22. The [`curl` manual](https://curl.se/docs/manpage.html) defines it like this: exit code 22 means the page was not retrieved because the server returned an HTTP response code of 400 or greater, and it only appears with `--fail`. Many health checks are exactly that: a `curl -f` whose exit code determines whether the service is healthy. `echo $?` displays the exit code of the last command:

```text
$ curl -f http://127.0.0.1:18080/codigo/200
200 OK
lo pediste en /codigo/200
$ echo $?
0
$ curl -f http://127.0.0.1:18080/codigo/503
curl: (22) The requested URL returned error: 503
$ echo $?
22
```

`curl -f` never read the body at any point. It could not know that "lo pediste en /codigo/503" is not a very helpful explanation; nor did it care. It decided based on the number, and nothing else.

JavaScript's HTTP client does the same thing. When you use `fetch`, the response has an `ok` property, and the [Fetch standard](https://fetch.spec.whatwg.org/) defines it in one sentence: an *ok status* is a status in the range 200 to 299, inclusive. Countless programs check `if (respuesta.ok)` and move on. If the server responded `200` with `{"error": …}` inside, that `if` takes the wrong branch, and no program along the way will ever notice. Section 0.6 runs `fetch` against the test bench, and section 0.8 tallies the full damage.

That is why the principle has two halves. **The code rules:** it is the part of the message that everyone reads, and the one that decides what they do. **The body explains:** it is for whoever needs the detail, a person or a program that understands your API's format. And the condition joining the two is the one broken in the opening scene: **both say the same thing**. A body can add information to the code, but never contradict it or substitute for it. RFC 9110 requires this for both error families: on a `4xx` and on a `5xx`, except when the request was `HEAD`, the server **should** send an explanation of the error in the body and state whether it is temporary or permanent ([sections 15.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5) and [15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6)). In other words: the number **and also** the explanation, not one instead of the other.

#### 0.5.2 The status line phrase is not the message

In 0.2.2 you saw that a client should ignore the phrase in the status line. Here is the proof of why. The test bench uses phrases from the official registry for its 28 codes, but for any other code it lets Node supply its own. Ask it for a `418`, which is not in its table, headers only:

```text
$ curl -I http://127.0.0.1:18080/codigo/418
HTTP/1.1 418 I'm a Teapot
Content-Type: text/plain; charset=utf-8
Content-Length: 57
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

Node calls it "I'm a Teapot", which comes from a joke: [RFC 2324](https://www.rfc-editor.org/rfc/rfc2324.html), published on April 1, 1998, parodying HTTP abuses. In the official registry, `418` appears as **(Unused)**, and [RFC 9110, section 15.5.19](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.19) explains why: it was used as an April Fools' joke so many times that it is not viable for serious use, so it was reserved. And it is not the only case: the phrase table bundled with Node calls `422` "Unprocessable Entity" and `413` "Payload Too Large", which were their former names; RFC 9110 renamed them to "Unprocessable Content" and "Content Too Large", and that is how they appear in the registry. That is why the test bench carries its own table.

None of those discrepancies break anything, and that is the lesson: **the phrase can say anything, and no program should decide based on it**. A client comparing the phrase against `"Not Found"` stops working with the first server that translates, abbreviates, or omits it. The number is the same everywhere.

### 0.6 A code the machine does not know

#### 0.6.1 The rule

There are more than sixty assigned codes (section 0.7), and new ones appear from time to time. No program knows all of them, and the specification recognizes this. RFC 9110, in the introduction to [section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), provides a brief rule worth memorizing: a client is not required to understand all registered status codes, but **must** understand the class of any status code from its first digit, and **must** treat an unrecognized status code as being equivalent to the `x00` status code of that class. The RFC itself provides the example: if a client receives `471`, which it does not recognize, the first digit says something was wrong with the request, and the client treats it as though it had received `400`.

The same section adds a second rule: values outside the 100 to 599 range are **invalid**. Some libraries use numbers like 600 or 999 to communicate non-HTTP internal errors, and if one of those reaches a client, the client **should** treat it as a `5xx`. It is a sensible choice: a number that should not exist indicates, above all, that something on the server side went wrong.

With those two rules, a program that only recognizes a handful of codes can react sensibly to any code. And that is why inventing custom codes is a bad idea (the course deliberately avoids teaching it): your `299 Almost Done` is understood by nobody else, and everyone will treat it as a standard `200`.

#### 0.6.2 The reader that only looks at the number

This program reads responses from the test bench just like a monitor would: it does not look at the body, only the number, and applies the two rules. Save it as `~/curso-http/fig00_03.ts`:

```ts
// fig00_03.ts
// Lee solo el número, como lo hace un monitor o un balanceador.

// Los códigos que este lector conoce por su nombre: los del curso.
const CONOCIDOS = new Set([
  200, 201, 202, 204, 301, 302, 304, 307, 308,
  400, 401, 403, 404, 405, 406, 409, 410, 412, 413, 415, 422, 428, 429,
  500, 501, 502, 503, 504,
]);

const FAMILIAS = ["", "informativa", "éxito", "redirección", "error del cliente", "error del servidor"];

// La regla de la sección 15 del RFC 9110.
function comoSiFuera(codigo: number): number {
  if (codigo < 100 || codigo > 599) return 500; // inválido: se trata como un 5xx
  if (CONOCIDOS.has(codigo)) return codigo; // conocido: se trata como lo que es
  return Math.floor(codigo / 100) * 100; // desconocido: el x00 de su familia
}

for (const pedido of [200, 204, 299, 308, 404, 471, 503, 600]) {
  const respuesta = await fetch(`http://127.0.0.1:18080/codigo/${pedido}`, { redirect: "manual" });
  await respuesta.text();
  const trato = comoSiFuera(respuesta.status);
  const familia = FAMILIAS[Math.floor(trato / 100)];
  console.log(`${respuesta.status}  ok=${String(respuesta.ok).padEnd(5)}  se trata como ${trato} (${familia})`);
}
```

The `comoSiFuera` function is the rule written in three lines, in the exact order it must be applied: first invalid codes, then recognized codes, and finally unrecognized codes, which round down to the `x00` of their family with `Math.floor(codigo / 100) * 100`. The loop asks the test bench for eight codes, including two no one ever registered (`299` and `471`) and one invalid code (`600`). Two details about `fetch`: `redirect: "manual"` tells it not to follow the `Location` header on `308` (by default it would follow it and you would receive the destination's `200`, not the `308`), and `await respuesta.text()` consumes the body and discards it so the connection is released. The top-level `await` works outside a function because the file is an ESM module, thanks to the `package.json` from 0.1.3.

With the test bench running, in the other terminal:

```text
$ node fig00_03.ts
200  ok=true   se trata como 200 (éxito)
204  ok=true   se trata como 204 (éxito)
299  ok=true   se trata como 200 (éxito)
308  ok=false  se trata como 308 (redirección)
404  ok=false  se trata como 404 (error del cliente)
471  ok=false  se trata como 400 (error del cliente)
503  ok=false  se trata como 503 (error del servidor)
600  ok=false  se trata como 500 (error del servidor)
```

Read the `ok` column and the right-hand column together. `299` is *ok* for `fetch` because it falls between 200 and 299, and the reader treats it as a `200`: an invented code in the success family is read as success, which is exactly what the rule specifies. `471` is read as a `400`, the RFC's own example. And `600`, which the test bench produced intentionally, is read as a server error. Notice also that `308` is not *ok*: `ok` only covers the `2xx` family, and a redirection is not yet a success. A program that does `if (!respuesta.ok) reportarFalla()` without further checks will report every redirection as a failure; that is the kind of detail [Lesson 7](07-quien-lee-el-error.md) turns into a decision table.

You can now stop the test bench with `Ctrl`+`C`.

### 0.7 The official registries

#### 0.7.1 Who decides which codes exist

Neither Node, nor `curl`, nor this course decides which status codes exist. A public process decides. RFC 9110, in [section 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1), establishes that codes are registered in the **HTTP Status Code Registry** maintained by **IANA** (*Internet Assigned Numbers Authority*, the body that manages official protocol numbers and names for the internet). Each registration contains three fields: the value, a short description, and a reference to the specification defining it. And adding a new code requires IETF review, the group that drafts internet standards; someone simply using it is not enough.

The [registry](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) can be downloaded as a CSV, and was counted on October 21, 2026, in its version updated on September 15, 2025: there are **62 assigned codes**. By family: 5 in `1xx`, 10 in `2xx`, 8 in `3xx`, 28 in `4xx`, and 11 in `5xx`. In addition, there are two reserved unassigned numbers, `306` and `418`, and entire unassigned ranges. One of the 62 is temporary: `104`, registered while the draft defining it is completed, with an expiration date in November 2026. The course uses 23 of the 62, and Exercise 3 asks you to repeat the count for the `4xx` family yourself, because it contains a trap.

#### 0.7.2 The other three registries you will use

Codes are not the only things registered. Throughout the course you will consult three other IANA registries, and it is helpful to know today that they exist:

| Registry | What it holds | Where it appears in the course |
|---|---|---|
| [Hypertext Transfer Protocol (HTTP) Field Name Registry](https://www.iana.org/assignments/http-fields/http-fields.xhtml) | each header field, with its status (permanent, provisional, obsolete) and the specification defining it | `Location`, `Allow`, `Retry-After`, or `WWW-Authenticate`, in every lesson |
| Media Types | valid `Content-Type` values, such as `application/json` or `application/problem+json` | Lesson 5 |
| [HTTP Problem Types](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml) | standard identifiers for the `type` field of a *Problem Details* object | Lesson 5 |

The field name registry was downloaded on the same date: it contains 260 names, and not all are active; 39 are marked obsolete and 8 deprecated, so "it is in the registry" does not mean "it should be used". The problem types registry is much smaller: it was created by [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), the *Problem Details* specification taught in full in Lesson 5, and currently holds six entries, the first being `about:blank`.

A note on authority: when a lesson says a code "means" something or that a header "requires" something, the authority is one of these specifications, linked in the lesson's sources section, and the IANA registry is the arbiter of what exists. When the course makes a design choice that the specification leaves open (such as `400` versus `422`), it will explicitly say so: that is design judgment, not a standard.

### 0.8 Why a `200` with `{"error": …}` breaks the cache, the monitor and the client

#### 0.8.1 The experiment

You have already seen separately that `curl -f` and `fetch` make decisions based on the status code number. Now comes the third reader along the path, the one that causes the most damage when it gets things wrong because it gets them wrong **for everyone**: the cache. A **shared cache** is a program positioned between clients and the server that stores responses and repeats them, so the server does not compute the same thing a thousand times. The rules governing when it is allowed to store something are in [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html), and two of them matter directly here.

The first rule comes from [section 3 of RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-3): a cache may store a response, among other conditions, if the response explicitly authorizes it, for example with `Cache-Control: max-age=N` ("reuse me for N seconds"). The second comes from an extension, [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html#section-4): with `stale-if-error=N`, the server authorizes the cache to continue serving a stale copy for N seconds **if upon requesting a fresh one it encounters an error**. And the RFC defines "error" using a closed list: any situation resulting in a `500`, `502`, `503`, or `504`. The cache recognizes the error by the status number. If the number says `200`, as far as the cache is concerned, no error occurred.

This program places both components side by side: an **origin** that can be healthy, lying, or telling the truth, and a toy cache in front that applies those two rules, and only those two. Save it as `~/curso-http/fig00_04.ts`:

```ts
// fig00_04.ts
// Un origen que puede estar sano, mentir o decir la verdad, y una caché de juguete delante.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type Modo = "sano" | "mentiroso" | "honesto";
let modo: Modo = "sano";

// ---------- El origen, en el puerto 18081 ----------

function origen(peticion: IncomingMessage, respuesta: ServerResponse): void {
  const cambio = /^\/modo\/(sano|mentiroso|honesto)$/.exec(peticion.url ?? "");
  if (peticion.method === "PUT" && cambio !== null) {
    modo = cambio[1] as Modo;
    console.log(`origen: ahora estoy ${modo}`);
    respuesta.writeHead(204).end();
    return;
  }
  if (modo === "honesto") {
    respuesta.writeHead(503, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "120",
    });
    respuesta.end("la base de datos no está disponible\n");
    return;
  }
  const cuerpo = modo === "sano"
    ? '{"servicios":["catalogo","pagos"]}\n'
    : '{"error":"la base de datos no está disponible"}\n';
  // Esta ruta declara que sus respuestas se pueden reutilizar 5 segundos.
  respuesta.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "max-age=5, stale-if-error=600",
  });
  respuesta.end(cuerpo);
}

// ---------- La caché, en el puerto 18080 ----------

type Copia = { cuerpo: string; tipo: string; guardadaEn: number; maxAge: number; staleIfError: number };
let copia: Copia | undefined;

// Los únicos códigos que stale-if-error considera un error (RFC 5861, sección 4).
const ERRORES = new Set([500, 502, 503, 504]);

function directiva(cacheControl: string, nombre: string): number | undefined {
  const encontrada = new RegExp(`${nombre}=(\\d+)`).exec(cacheControl);
  return encontrada === null ? undefined : Number(encontrada[1]);
}

function servirCopia(respuesta: ServerResponse, guardada: Copia, edad: number): void {
  respuesta.writeHead(200, { "Content-Type": guardada.tipo, Age: String(Math.floor(edad)) });
  respuesta.end(guardada.cuerpo);
}

async function cache(_peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  const edad = copia === undefined ? Infinity : (Date.now() - copia.guardadaEn) / 1000;
  if (copia !== undefined && edad < copia.maxAge) {
    console.log("caché: tengo una copia fresca; no le pregunto al origen");
    servirCopia(respuesta, copia, edad);
    return;
  }
  const delOrigen = await fetch("http://127.0.0.1:18081/servicios");
  const cuerpo = await delOrigen.text();
  const cacheControl = delOrigen.headers.get("cache-control") ?? "";
  if (ERRORES.has(delOrigen.status) && copia !== undefined && edad < copia.maxAge + copia.staleIfError) {
    console.log(`caché: el origen respondió ${delOrigen.status}; sirvo la copia anterior`);
    servirCopia(respuesta, copia, edad);
    return;
  }
  const maxAge = directiva(cacheControl, "max-age");
  if (delOrigen.status === 200 && maxAge !== undefined) {
    copia = {
      cuerpo,
      tipo: delOrigen.headers.get("content-type") ?? "application/octet-stream",
      guardadaEn: Date.now(),
      maxAge,
      staleIfError: directiva(cacheControl, "stale-if-error") ?? 0,
    };
    console.log(`caché: guardé la respuesta 200 por ${maxAge} s`);
  } else {
    console.log(`caché: el origen respondió ${delOrigen.status}; no la guardo`);
  }
  const cabeceras: Record<string, string> = {};
  for (const nombre of ["content-type", "cache-control", "retry-after"]) {
    const valor = delOrigen.headers.get(nombre);
    if (valor !== null) cabeceras[nombre] = valor;
  }
  respuesta.writeHead(delOrigen.status, cabeceras);
  respuesta.end(cuerpo);
}

createServer(origen).listen(18081, "127.0.0.1", () => {
  console.log("origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)");
});
createServer((peticion, respuesta) => void cache(peticion, respuesta)).listen(18080, "127.0.0.1", () => {
  console.log("caché en http://127.0.0.1:18080/servicios");
});
```

The **origin** includes a control entry point, `PUT /modo/...`, to toggle its behavior without restarting, and answers any other request, regardless of method or path, according to its active mode. This entry point is a lab switch: it does not authenticate, so anyone reaching that port could take down the service; here that is acceptable because it listens exclusively on `127.0.0.1`, but a path for injecting faults must never exist in a production service. When healthy (`sano`), it answers `200` with the list. When lying (`mentiroso`), it answers `200` with an error in the body, **with the same cache headers**: this is realistic, because such headers are usually configured for the entire route, not per response. When honest (`honesto`), it responds `503` with `Retry-After` and `Cache-Control: no-store` ("do not store this").

The **cache** performs four actions in sequence. If it has a cached copy that has not yet exceeded its `max-age` seconds, it serves it without contacting the origin. If it has expired, it queries the origin. If the origin responded with one of the four errors on the list and the stale copy is still within its `stale-if-error` window, it serves the stale copy. And if the origin responded `200` with `max-age`, it stores the new response **overwriting** the previous one. When serving a cached copy, it attaches the `Age` header showing how many seconds it has been stored, which is the standard header for that purpose per [section 5.1 of RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.1). A production cache applies many more rules; this one applies two, which is sufficient to demonstrate the issue. The 5-second `max-age` is intentionally short so the experiment does not drag on; in a real service, it would be minutes.

#### 0.8.2 First run: the origin lies

Run it in one terminal. In another, request the list through the cache, switch the origin to lying mode, wait for the copy to expire (`sleep 6`), and request twice more:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:26 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/mentiroso
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Age: 0
Date: Wed, 21 Oct 2026 07:28:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
```

And this is what the program logged in its terminal:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: guardé la respuesta 200 por 5 s
caché: tengo una copia fresca; no le pregunto al origen
```

Follow the story line by line. The first request found the cache empty, queried the healthy origin, and stored the list. After that copy expired, the cache queried again, the origin answered `200` with its error, and the cache did the proper thing according to what it saw: a `200` with `max-age` is a valid, reusable response, so **it stored it right over the good copy**. The third request did not even reach the origin: the cache served the error, with `Age: 0`, to whoever asked. With a five-minute `max-age`, the error would be served for five minutes to all clients, even if the service had already recovered. And the good copy, which `stale-if-error` was there to protect, was permanently lost.

The lowercase headers in responses that passed through the origin (`content-type`, `cache-control`) are not a defect: `fetch` exposes header names in lowercase and the cache forwarded them that way. Header field names are case-insensitive per [section 5.1 of RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1), and no program should compare them otherwise.

Nor is it a bug that `Content-Length` is missing and `Transfer-Encoding: chunked` appears. In 0.2.2, the body ended where `Content-Length` indicated, but `fig00_04.ts` does not compute the size before `writeHead`, so Node transmits the body **in chunks**: the [Node documentation](https://nodejs.org/docs/latest-v24.x/api/http.html) explains that providing `Content-Length` is what disables this default chunked transfer encoding. Under [section 7.1 of RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1), each chunk is preceded by its size in bytes, and a zero-length chunk signals the end. Both are valid ways of indicating where the body ends; `curl` understands both and displays the same body.

Now the monitor. Query the lying origin directly using the health check from 0.5:

```text
$ curl -f http://127.0.0.1:18081/servicios
{"error":"la base de datos no está disponible"}
$ echo $?
0
```

The check passed. The service is down, and the health check reports it is fine. That is the green monitor from the opening scene.

#### 0.8.3 Second run: the origin tells the truth

Stop the program with `Ctrl`+`C` and restart it to begin with an empty cache. Now switch the origin to honest mode:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 07:28:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/honesto
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Age: 6
Date: Wed, 21 Oct 2026 07:28:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -f http://127.0.0.1:18081/servicios
curl: (22) The requested URL returned error: 503
$ echo $?
22
```

And in the program's terminal:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy honesto
caché: el origen respondió 503; sirvo la copia anterior
```

Same service, same outage, different number. The cache received a `503`, recognized it as an error because it is on the RFC 5861 list, and served the last good copy, with `Age: 6` so anyone who cares knows it is six seconds old. Clients continue seeing the service list while the origin recovers. And the health check, querying the origin directly, failed with exit code 22: the monitor turns red, someone receives an alert, and people start working on the fix. **The `503` protected clients while simultaneously alerting operations.** The lying `200` did the opposite on both fronts.

That is the complete, measured damage: the **cache** stores the error and discards the good copy; the **monitor** stays green; and the **client**, which checks `if (respuesta.ok)`, assumes it received valid data. All three made the right decision based on what they read. The thing that was wrong was the number.

Stop the program with `Ctrl`+`C`. Nothing remains listening.

### 0.9 Checking types with `tsc` (optional)

Node strips types and runs; **it does not check them**. If you write `const x: number = "a"`, Node runs it without complaint. That is why the course checks its programs with `tsc`, the TypeScript compiler, in strict mode, and you can do the same whenever you wish. It is not part of the course and is not needed for any lesson. Inside `~/curso-http/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --types node fig00_01.ts fig00_02.ts fig00_03.ts fig00_04.ts
```

The first command fetches the compiler and Node type definitions into a `node_modules/` directory without registering them in `package.json` (that is what `--no-save` does). The second checks all four programs without producing output files (`--noEmit`); `--erasableSyntaxOnly` asks it to reject syntax Node would not know how to strip, and `--verbatimModuleSyntax` requires `import type` wherever only a type is imported, as in `fig00_02.ts`. These are the options recommended by the Node documentation for this workflow. If everything is correct, `tsc` prints nothing and exits with code 0, which is what occurred with the four programs in this lesson.

## The error you will see

**Port already in use.** This is the error you will encounter most frequently in this course, because all programs share port 18080. If you start a server while another is still listening on that port, Node halts like this:

```text
$ node fig00_01.ts
node:events:486
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use 127.0.0.1:18080
    at Server.setupListenHandle [as _listen2] (node:net:1948:16)
    at listenInCluster (node:net:2005:12)
    at node:net:2214:7
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
Emitted 'error' event on Server instance at:
    at emitErrorNT (node:net:1984:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -48,
  syscall: 'listen',
  address: '127.0.0.1',
  port: 18080
}

Node.js v24.14.1
```

Read it starting at the line beginning with `Error:`: `listen` failed with `EADDRINUSE`, address already in use, on `127.0.0.1:18080`. The lines starting with `at` are Node's internal call stack and tell you nothing useful here. On Linux, `errno` reads `-98` instead of `-48` (it is the exact same error under a different OS error code), and line numbers in `node:net` vary across Node versions. Almost always, the root cause is a previous course program still running in another terminal: find it and stop it with `Ctrl`+`C`. If you cannot find it, ask the operating system which process is listening on that port: on Linux, `ss -ltnp 'sport = :18080'` displays it with its process identifier as `pid=NNNN`; on macOS, `lsof -iTCP:18080 -sTCP:LISTEN` displays it under the `PID` column. With that number, terminate it: `kill NNNN`.

**Nobody listening.** The opposite error: requesting something from a port where no server is running. This is no longer a Node error, but a `curl` error:

```text
$ curl -i http://127.0.0.1:18080/
curl: (7) Failed to connect to 127.0.0.1 port 18080 after 0 ms: Couldn't connect to server
```

Notice what is **absent**: there is no status line, no headers, no status code. There was no HTTP response, because there was no conversation. That distinction matters greatly for the `revisor`: "the service responded `503`" and "could not connect" are distinct failures with distinct root causes, and the `revisor` will report them differently. Exit code 7 in `curl` means "could not connect"; code 22 from section 0.5 means "connected successfully, but the server returned an error response". A script that merely checks whether the exit code is non-zero fails to distinguish between the two.

## What gets done wrong

**Responding `200` with the error in the body.** You already measured the cost in 0.8: the cache stores it and discards the good copy, the health check passes, and any client relying on `ok` carries on blindly. The fix is not adding a more prominent `"success": false` field to the body: it is putting the truth in the number.

**Deciding based on the status line reason phrase.** `if (statusText === "Not Found")` breaks with the first server that translates or omits it, and RFC 9112 warns that the phrase may be dropped when transitioning to another HTTP version. You saw in 0.5.2 that Node and the official registry already use different phrases for three codes.

**Inventing custom codes.** A home-brewed `299` or `471` is understood by nobody else, and the rule in 0.6 causes everyone to treat them as generic `200` or `400` codes. If what you want to communicate does not fit into a registered code, it belongs in the body, and Lesson 5 provides the format.

**Writing a client that only recognizes its own codes.** A `switch` statement that handles `200`, `404`, and `500`, and treats everything else as an "unknown error", turns a `204` into a failure. The `x00` rule exists specifically to prevent that.

**Treating "could not connect" as a status code.** Some programs convert a rejected connection into a synthetic `500` or a fake `0`, so that "everything is a number". This destroys the most useful piece of information: whether the server answered or not.

**Testing with a server that ignores the path.** The server in 0.2.1 answers `200` to `/servicios`, to `/whatever`, and to everything else. It lets you observe the shape of a response and nothing more; such a server invalidates any test you run against it.

## Exercises

All four are self-checking: each ends with a run that tells you if your prediction was right. Write your prediction in the [logbook](bitacora.md) **before** running anything.

### Exercise 1 — Four codes the reader does not know

Without running anything, predict three things for each of these codes: what `respuesta.ok` evaluates to, how `comoSiFuera` handles it, and what exit code `curl -f` yields. The codes are `226`, `418`, `451`, and `799`. Then replace the array in the `fig00_03.ts` loop with `[226, 418, 451, 799]`, run the test bench and the reader, and compare. For `curl -f`, use `curl -s -o /dev/null -w '%{http_code}\n' -f` followed by the URL, then `echo $?`.

### Exercise 2 — Follow the redirect

With the test bench running, predict what `curl -i -L http://127.0.0.1:18080/codigo/308` prints. The `-L` option tells `curl` to follow the `Location` header. How many status lines will you see? What path appears in the final body? And what does the test bench log in its terminal? Run the command and compare.

### Exercise 3 — Counting the `4xx` family in the registry

Download the IANA status code registry as a CSV:

```bash
curl -s -o codigos.csv https://www.iana.org/assignments/http-status-codes/http-status-codes-1.csv
```

Count how many `4xx` codes are **assigned** using `grep`. Then look up which specifications define `429` and `451`, and what the registry says about `418`. Compare your count with section 0.7.1: if you did not get 28, the solution explains why.

### Exercise 4 — A liar that disallows caching

Someone proposes a fix for the problem in 0.8 that leaves the status number untouched: having the lying origin send `Cache-Control: no-store` on its errors, so the cache does not store them. Copy `fig00_04.ts` as `ej4.ts` and replace the header in the `200` response with this one, which only authorizes caching healthy responses:

```ts
    "Cache-Control": modo === "sano" ? "max-age=5, stale-if-error=600" : "no-store",
```

Before running it, predict what a client of the cache sees when the origin lies, and whether the cache serves the good copy. Then repeat the first run from 0.8.2 using `ej4.ts` and compare. Does the fix resolve the problem?

## Solutions

All four solutions were run with [`soluciones.sh`](../programas/00-el-contrato-que-viaja/soluciones.sh), which creates the copies `ej1.ts` and `ej4.ts` in a temporary folder and uses the course's ports; its full output is in `soluciones.salida.txt`. The dates in the headers change on every run; everything else should match.

### Solution 1

```text
$ node ej1.ts
226  ok=true   se trata como 200 (éxito)
418  ok=false  se trata como 400 (error del cliente)
451  ok=false  se trata como 400 (error del cliente)
799  ok=false  se trata como 500 (error del servidor)
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/226; echo $?
226
0
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/418; echo $?
418
22
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/451; echo $?
451
22
$ curl -s -o /dev/null -w '%{http_code}\n' -f http://127.0.0.1:18080/codigo/799; echo $?
799
22
```

(Here `ej1.ts` is your copy of `fig00_03.ts` with the modified list; if you edited `fig00_03.ts` directly, the command is `node fig00_03.ts`.) The `226` (*IM Used*) exists in the registry, but is not in the reader's lookup table, so it is treated as the `200` of its family, and `ok` is `true` because it is between 200 and 299. The `418` and `451` (*Unavailable For Legal Reasons*, which also exists) are treated as `400`. The `799` is invalid and treated as `500`. For `curl -f` there are no surprises: anything `400` or higher returns 22, and yes, that includes the invalid `799`. If you missed `451`, note the lesson of the exercise: that a code exists in the registry does not mean your program knows it, which is why the `x00` rule exists.

### Solution 2

```text
$ curl -i -L http://127.0.0.1:18080/codigo/308
HTTP/1.1 308 Permanent Redirect
Location: /codigo/200
Content-Type: text/plain; charset=utf-8
Content-Length: 49
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 33
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

200 OK
lo pediste en /codigo/200
```

Two status lines: with `-i`, `curl` displays the headers for **every** response along the path, but the body only for the last one. The body of the `308` did exist (49 bytes, as stated by its `Content-Length`), but `curl` does not display it because it followed through. The final path is `/codigo/200`, from the `Location` header, which is relative: `curl` completed it using the host and port of the original request. In the test bench terminal, two lines appeared, `GET /codigo/308` and `GET /codigo/200`: they were two requests, not one. What changes between `301` and `308` when the request is a `POST` is covered in Lesson 1.

### Solution 3

```text
$ grep -E '^4[0-9]{2},' codigos.csv | wc -l
31
$ grep -E '^4[0-9]{2},' codigos.csv | grep -vc -e Unassigned -e Unused
28
$ grep -E '^(418|429|451),' codigos.csv
418,(Unused),"[RFC 9110, Section 15.5.19]"
429,Too Many Requests,[RFC 6585]
451,Unavailable For Legal Reasons,[RFC 7725]
```

The trap lies in the first command: it gives 31, not 28. The registry records gaps in two ways. Large ranges appear on a single line (`432-450,Unassigned`), and the pattern `^4[0-9]{2},` does not count them because a hyphen follows the three digits rather than a comma. But single-number unassigned slots get their own line with their number (`427,Unassigned` and `430,Unassigned`), and the pattern does match those. Add `418`, which is not assigned but reserved unassigned, and you have the three extra lines. The second command filters them out and yields 28, the exact count obtained in 0.7.1 with a script reading the CSV column by column; when a count matters, you do it twice using two distinct methods. The `429` is defined by RFC 6585, `451` by RFC 7725, and `418` appears as `(Unused)` referencing section 15.5.19 of RFC 9110, which explains why it was reserved.

### Solution 4

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: max-age=5, stale-if-error=600
Date: Wed, 21 Oct 2026 08:05:43 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"servicios":["catalogo","pagos"]}
$ curl -X PUT http://127.0.0.1:18081/modo/mentiroso
$ sleep 6
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: no-store
Date: Wed, 21 Oct 2026 08:05:49 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
content-type: application/json
cache-control: no-store
Date: Wed, 21 Oct 2026 08:05:49 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"la base de datos no está disponible"}
$ curl -f http://127.0.0.1:18081/servicios
{"error":"la base de datos no está disponible"}
$ echo $?
0
```

And in the program's terminal:

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: el origen respondió 200; no la guardo
caché: el origen respondió 200; no la guardo
```

The fix limits the damage, but does not solve it. The cache no longer stores the error, so it does not repeat it to everyone for minutes: each request re-queries the origin. But it also fails to serve the good copy, which was still present, because `stale-if-error` is only triggered by a `500`, `502`, `503`, or `504`, and what arrived was a `200`. The client sees the error on every request, the health check continues to pass, and the good copy sits useless. Compare this with the second run in 0.8.3: the `503` got all three things right simultaneously. No header can compensate for a wrong status code number.

## How I know I got it

- [ ] `node -v` starts with `v24`, and `curl --version` responds.
- [ ] With `fig00_01.ts` running, you point out in `curl -i` output the status line, each header, the empty line, and the body, and explain why `Content-Length` says 28 and not 27.
- [ ] You explain what `curl -v` shows that `curl -i` does not, and what lines starting with `>` and `<` mean.
- [ ] `curl -i http://127.0.0.1:18080/codigo/503` against the test bench returns `503 Service Unavailable` with `Retry-After: 120`, and `curl -i -X DELETE` returns `405` with `Allow: GET, HEAD`, just like in 0.4.3.
- [ ] `node fig00_03.ts` prints the eight lines from 0.6.2, and you can explain without looking why `471` is treated as `400` and `600` as `500`.
- [ ] You can recite from memory the `x00` rule and state which section of RFC 9110 it comes from.
- [ ] You repeated both runs in 0.8 and your terminals show the same output as the lesson, except for the date: the cached error with `Age: 0` in the first run, and the good copy with `Age: 6` and exit code 22 in the second.
- [ ] Your count of assigned `4xx` codes in the IANA registry yielded 28, and you know why the naive count yields 31.
- [ ] Upon finishing, no program remains listening: `curl -i http://127.0.0.1:18080/` gives error 7.

## Summary

Answer without looking at the lesson:

1. What are the three parts of an HTTP response and what separates them?
2. Why should a client ignore the status line reason phrase? Give an example from this lesson.
3. What question does each of the five families answer, and why is `1xx` different from the other four?
4. What must a client do with a code it does not know? What about a code greater than 599?
5. Who decides which codes exist, and where can the list be consulted?
6. What does "the code rules and the body explains" mean? What happens when the two do not say the same thing?
7. In the cache from 0.8, why does the lying `200` lose the good copy while the `503` preserves it?
8. How do `curl` exit code 7 and exit code 22 differ, and why does this distinction matter to the `revisor`?

## Sources

All sources were consulted on October 21, 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), section 15: the five families, the `x00` rule for an unrecognized code, and the rule for values outside 100 to 599. It is the primary source for this lesson and for the course.
2. [RFC 9110, sections 15.5 and 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5): on `4xx` and `5xx`, the server should explain the error in the body, except in response to `HEAD`.
3. [RFC 9110, sections 15.3.2, 15.5.2 and 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2): `Location` on `201`, mandatory `WWW-Authenticate` on `401`, and mandatory `Allow` on `405`, the headers on the test bench.
4. [RFC 9110, section 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1): the IANA HTTP Status Code Registry and the IETF review required for a new code.
5. [RFC 9112, *HTTP/1.1*](https://www.rfc-editor.org/rfc/rfc9112.html), section 4: status line format and why a client should ignore the reason phrase.
6. [RFC 9111, *HTTP Caching*](https://www.rfc-editor.org/rfc/rfc9111.html), sections 3 and 5.1: when a cache may store a response and what the `Age` header indicates.
7. [RFC 5861, *HTTP Cache-Control Extensions for Stale Content*](https://www.rfc-editor.org/rfc/rfc5861.html), section 4: `stale-if-error` and the closed list of codes counting as errors (`500`, `502`, `503`, `504`).
8. [RFC 6585, *Additional HTTP Status Codes*](https://www.rfc-editor.org/rfc/rfc6585.html): defines `428` and `429`, and the optional `Retry-After` on `429`.
9. [HTTP Status Code Registry, IANA](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml), version updated September 15, 2025: the source of the 62 assigned codes, test bench phrases, and reserved unassigned `418`.
10. [Hypertext Transfer Protocol (HTTP) Field Name Registry, IANA](https://www.iana.org/assignments/http-fields/http-fields.xhtml): the 260 registered headers and their status.
11. [HTTP Problem Types Registry, IANA](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml), created by [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html): six entries, the first being `about:blank`. Used in Lesson 5.
12. [Fetch Standard, WHATWG](https://fetch.spec.whatwg.org/): definition of an *ok status* (200 to 299) used by `respuesta.ok`.
13. [`curl` manual](https://curl.se/docs/manpage.html): `-i` (`--show-headers`), `-v`, `-I`, `-f`, and exit code 22.
14. [Node.js 24: TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html) and [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): executing `.ts` by stripping types, disallowed syntax, recommended `tsc` options, and `writeHead` signature.
15. [Node.js Releases](https://github.com/nodejs/Release) and [nvm](https://github.com/nvm-sh/nvm): LTS dates for Node 24 and 26, and the nvm 0.40.8 installer.

### Further reading

- The **"HTTP y Problem Details"** series in [En construcción](https://enconstruccionmx.substack.com/), Hábil's newsletter, across four issues. The first, "El 200 que mentía", tells the same core idea of this lesson through a different narrative and explores thirteen codes using a contacts API with a lying server alongside an honest one; the second breaks down the *Problem Details* format taught in Lesson 5; the third and fourth implement it in Spring Boot, Quarkus, ASP.NET Core, FastAPI, and Go. This course does not repeat them: if you want to see the codes with a different scenario or see the format in your language, start there.

### Terms in this lesson

| | |
|---|---|
| **header field** | each `Name: value` line between the status line and the body; field names are case-insensitive |
| **shared cache** | a program between clients and server that stores responses and repeats them to any client |
| **health check** | an automated check deciding whether a service is healthy, almost always by status code |
| **status code** | the three-digit number in the status line; its first digit denotes the family |
| **family** | the class of a code by its first digit: `1xx` through `5xx` |
| **IANA** | the organization maintaining official registries of status codes, headers, and media types |
| **status line** | the initial line of a response: version, code, and phrase |
| ***reason phrase*** | the phrase following the code (`OK`, `Not Found`); decorative, a client should ignore it |
| **interim response** | a `1xx` response: arrives before the final response and never substitutes for it |
| **LTS** | *long-term support*: a release line receiving maintenance and security fixes for years |

---

**Next:** [Lesson 1 — Successes and redirections: 200, 201, 202, 204, 301, 308, and 304](01-exitos-redirecciones.md)

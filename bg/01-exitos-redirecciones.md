# Урок 1 — Успешни отговори и пренасочвания: 200, 201, 202, 204, 301, 308 и 304

11:20 ч. във вторник е, а в 12:00 има среща с екипа по експлоатация. Въпросът, който ще зададат, е прост: защо `revisor` не е наблюдавал услугата за плащания през уикенда, след като някой я е регистрирал в петък? Човекът, който я е регистрирал, се кълне, че го е направил. Има снимка на терминала си: изпратил е регистрацията и е получил `200 OK`. Отваряш списъка с услуги на `revisor`, а услугата за плащания я няма. Отваряш дневника на сървъра и там е заявката му, цялата, в 18:42 в петък. Само че дневникът не казва `POST /servicios`. Казва `POST /viejo/servicios`, а точно под него — `GET /servicios`. В четвъртък някой е преместил старите маршрути с пренасочване. Програмата му го е последвала, както трябва. И по пътя, без нито една грешка, регистрацията се е превърнала в справка. Остават четирийсет минути, за да обясниш защо един `200` не е означавал онова, което всички са си помислили.

Този урок е за отговорите, които казват „мина добре“, и за тези, които казват „намира се другаде“: какво обещава всеки от тях, какви заглавки го придружават и кой от тях може да загуби един `POST`, без да предупреди.

**Време:** 2 × 45 мин (разделянето е между раздели 1.5 и 1.6)

**Какво изграждаш:** първата версия на **`revisor`** като сървър: маршрутите, които регистрират, проверяват и премахват услуги, този, който иска инспекция, и този, който позволява тя да се следи, старите маршрути, които се пренасочват, и първата защита срещу това някой да използва `revisor`, за да стигне там, където не бива. Освен това **лабораторията**: тестовият стенд от Урок 0 на порт 18081, с услугите, които `revisor` проверява

**Какво научаваш:** да избираш между връщане (`200`), създаване (`201`), приемане (`202`) и невръщане на нищо (`204`); за какво служи `Location` в `201`, в `202` и в пренасочване; **`202` и неговия ресурс за проследяване**; какво се променя между `301` и `308`, когато заявката е `POST`; условните заявки с `ETag` и `If-None-Match` и защо `304` не носи тяло. А в каре за сигурност — какво е **SSRF** и защо програма като `revisor` е типичният случай

**Откъде идваш.** От [Урок 0](00-el-contrato-que-viaja.md) носиш Node 24 и папката `~/curso-http/`, инструмента (`curl -i`, `curl -v`, `curl -I`), петте семейства и правилото за `x00`, както и тестовия стенд `fig00_02.ts`, който отговаря с кода, който поискаш на `/codigo/NNN`. Носиш и първия принцип на курса: кодът командва, а тялото обяснява. Все още няма `revisor`: той се ражда в този урок.

**Какво не прави този урок.** Не иска идентификационни данни: всеки, който стигне до порта, може да регистрира и да премахва услуги, а [Урок 2](02-errores-del-cliente-peticion.md) поставя входната точка. Не позволява и промяна на вече регистрирана услуга; за това е нужен `If-Match` и това е тема на [Урок 3](03-errores-del-cliente-estado.md). Грешките, които ще видиш тук, `400`, `404` и `413`, са **предпазна мрежа**: те са там, за да не отговаря `revisor` с `200`, когато нещо се обърка, но се обясняват подробно в Урок 2, а тялото им е ред текст, докато [Урок 5](05-problem-details.md) не му даде формат. И има един нарочен дефект: метод, който маршрутът не поддържа, отговаря с `404` вместо с `405`; разделът „Грешката, която ще видиш“ го посочва, а Урок 2 го поправя.

**За изпълненията.** Linux Mint 22 е референтната система за курса. Изходите в този урок са получени на 21 октомври 2026 г. на macOS с Node 24.14.1 и curl 8.7.1, като към всеки `curl` е добавено `-sS`, защото изходът отиваше във файл (`-s` изключва индикатора за напредък, `-S` оставя грешките видими, и нито едната от двете не променя отговора). **Едно предупреждение за портовете:** докато се пишеше този урок, други тестове заемаха 18080 и 18081 на машината, затова изпълненията са направени с копие на програмите, идентично с изключение на портовете, 18180 и 18181, а в изходите, поставени тук, отново са изписани 18080 и 18081, които ще въвеждаш ти. Това е единственото заместено; двете числа имат еднакъв брой цифри, така че нито един `Content-Length` не се променя. При твоето изпълнение освен това се променят датата в `Date`, милисекундите (`"ms"`), които измерва една инспекция, и **етикетите `ETag`**: при стартиране `revisor` генерира на случаен принцип осем шестнайсетични цифри, които отиват в края на всеки етикет (`"4-1-7b2497d9"`), така че твоите ще завършват различно и се променят при всяко рестартиране; раздел 1.8 обяснява защо. Когато команда от урока съдържа етикет, копирай онзи, който ти е дал предишният ти отговор, а не този от урока. Изпълненията са направени, като урокът е следван от начало до край, по реда му, с рестартирането там, където урокът го изисква, така че номерата на услугите и на инспекциите, които виждаш, са тези, които ще получиш и ти. Не е изпълнявано на десктоп инсталация на Mint. Програмите са в [`programas/01-exitos-redirecciones/`](../programas/01-exitos-redirecciones), в хранилището на курса: `revisor` е в папката `fig01_01/`, а всяко изпълнение — във файл `.salida.txt`. Всички минават `tsc` в строг режим (раздел 1.11 казва как да се провери).

## След урока ще можеш да

- Стартираш `revisor` и неговата лаборатория и да минеш с `curl -i` през пълния цикъл на една услуга: регистрация, проверка, инспекция, премахване.
- Избираш между `200`, `201`, `202` и `204` за дадена операция с три въпроса и да обосноваваш избора с раздела от RFC 9110, който го дефинира.
- Казваш какво идентифицира `Location` в `201`, в `202` и в пренасочване и да го проверяваш в реален отговор.
- Следиш операция, приета с `202`, докато приключи, като спазваш `Retry-After`, без да бомбардираш сървъра.
- Предизвикваш `304` с `If-None-Match`, да обясняваш защо не носи тяло и какви заглавки трябва да носи.
- Доказваш с `curl -L`, че `301` може да превърне `POST` в `GET` без никаква грешка, а `308` — не.
- Обясняваш какво е SSRF, защо `revisor` го носи по рождение и какви защити има, включително тази, която идва в Урок 8.

## Защо, преди как

В Урок 0 видя, че кодът на състоянието е онова, което четат всички програми по пътя. При отговорите с грешка този контракт се нарушава по начин, който боли веднага: `200` с грешка вътре заблуждава кеша и мониторинга. При успешните отговори щетата е по-тиха, защото всички казват „мина добре“, и изкушението е да се отговаря с `200` винаги, когато нищо не се е провалило. Но четирите успешни отговора от този урок не казват едно и също, и онзи, който получава отговора, прави различни неща с всеки от тях:

- **`200`** казва „ето какво поиска“. Клиентът използва тялото.
- **`201`** казва „създадох нещо ново и то живее на този адрес“. Клиентът запазва адреса от `Location`, за да се върне към този ресурс.
- **`202`** казва „получих го, но още не съм го направил“. Клиентът **не** може да смята операцията за приключена: трябва да попита отново.
- **`204`** казва „готово, и нямам какво да ти кажа“. Клиентът не очаква тяло.

Разликата между `201` и `202` е най-скъпата за объркване. Ако `revisor` отговори с `200` или `201` на инспекция, която тепърва ще започне, клиентът ще повярва, че инспекцията вече е приключила, и ще прочете резултат, който не съществува. Ако отговори с `200` на регистрация, клиентът няма да има стандартен начин да разбере къде се намира новата услуга.

Пренасочванията имат свой капан и той е този от сцената в началото. Преместването на маршрут е нормално: API-тата растат и имената се променят. Но има два кода за „това се премести завинаги“, `301` и `308`, и по исторически причини само единият от тях обещава, че `POST` ще остане `POST` от другата страна. С другия клиентът има разрешение да го превърне в `GET` и почти всички го правят. Регистрацията се губи, крайният отговор е `200` със списъка и никой не вижда грешка, защото такава не е имало.

А `304` затваря урока с идеята, противоположна на `200`: понякога най-добрият отговор е **да не изпратиш нищо**, защото клиентът вече го има. За това съществуват етикетите (`ETag`) и условните заявки, които в Урок 3 ще послужат и за нещо много по-сериозно: двама души да не се презаписват взаимно, когато променят една и съща услуга.

Урокът има пет части:

1. **`revisor` придобива форма** (1.1 до 1.3): файловете, хранилището, трите начина за отговор и таблицата с маршрути.
2. **Връщане и създаване** (1.4 и 1.5): `200` и `201`, с `Location` и `ETag`.
3. **Приемане и невръщане на нищо** (1.6 и 1.7): `202` с неговия ресурс за проследяване и `204`.
4. **Да не изпращаш това, което вече имаш, и да се преместиш** (1.8 и 1.9): `304` с `If-None-Match` и `301` срещу `308`.
5. **Карето за сигурност** (1.10): SSRF, изключението за лабораторията и ограничението, което остава обявено.

В края на урока това изпълнение ще ти се струва очевидно. Това са две заявки, идентични с изключение на стария маршрут, който използват; `revisor` е записал следното в терминала си:

```text
POST /viejo/servicios
GET /servicios
POST /api/servicios
POST /servicios
```

Първата регистрация се загуби. Втората се случи. Единственото, което се промени, беше кодът на пренасочването.

## Понятията

### 1.1 `revisor` придобива форма

#### 1.1.1 Девет файла и една папка

От този урок нататък `revisor` престава да бъде програма от един файл. Става програма от няколко, всеки с една отговорност, и расте от урок на урок: Урок 2 му добавя входната точка, Урок 3 — промяната на услуги, Урок 4 — защитата срещу повреди, и така до Урок 8. Деветте файла днес са тези:

| Файл | Какво прави |
|---|---|
| `servidor.ts` | стартира сървъра на порт 18080 |
| `rutas.ts` | решава коя функция обслужва всеки маршрут и всеки метод; тук живеят пренасочванията |
| `servicios.ts` | това, което прави всеки маршрут: изброяване, регистриране, проверка, премахване, искане и следене на инспекция |
| `almacen.ts` | услугите и инспекциите, в паметта, и етикетът (`ETag`) на всяка услуга |
| `etiquetas.ts` | четене и сравняване на етикети, както изисква RFC 9110; използва се в раздел 1.8 |
| `respuestas.ts` | трите начина за отговор: с JSON, без тяло и с грешка |
| `cliente.ts` | клиентската страна: проверява услуга и класифицира отговора ѝ |
| `destinos.ts` | към кои адреси може да се свързва `revisor`; това е темата на карето за сигурност |
| `laboratorio.ts` | стендът от Урок 0 на порт 18081: услугите, които `revisor` проверява |

В хранилището те са в папката `fig01_01/`, а всеки блок с код в този урок започва с пътя на файла (`// fig01_01/servidor.ts`), както в курса по TypeScript на Hábil. Ти можеш да ги запазиш където искаш; тук се приема папка `~/curso-http/revisor/` със собствен `package.json`, същия като в Урок 0:

```bash
mkdir -p ~/curso-http/revisor && cd ~/curso-http/revisor
printf '{\n  "type": "module"\n}\n' > package.json
```

Файловете се импортират взаимно с изцяло изписано разширение `.ts` (`import { atender } from "./rutas.ts"`). Това изисква Node, когато изпълнява TypeScript, като премахва типовете: не отгатва разширения, както не ги отгатва и за JavaScript в ESM модул.

#### 1.1.2 Сървърът

```ts
// fig01_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
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

Това е почти сървърът от Урок 0, с една разлика: вече не решава нищо. Получава всяка заявка и я подава на `atender`, която живее в `rutas.ts`, чрез `atenderSinCaerse`. `void` пред извикването казва „знам, че тази функция връща promise, и нарочно не го чакам тук“: сървърът няма какво да прави, когато отговорът приключи.

Този `void` има цена и `atenderSinCaerse` съществува, за да я плати. Promise, който никой не чака и който се провали, е **отхвърлен promise без обработка** (unhandled rejection), а Node по подразбиране прекратява процеса, когато види такъв. Ако някой манипулатор имаше грешка, която хвърля изключение, една-единствена заявка щеше да спре `revisor` за всички. `atenderSinCaerse` обвива `atender` в `try`/`catch`: ако нещо се изплъзне, записва съобщението в терминала, отговаря с `500 error interno`, без да дава подробности, и процесът продължава да работи. Това е мрежа, а не дизайн: [Урок 4](04-capacidad-y-fallas-del-servidor.md) обяснява `500` подробно и какво се казва и какво не се казва в него. Днес е достатъчно да знаеш, че тя е там, а в 1.5.2 ще видиш заявката, която би сринала `revisor`, ако никой не я спре преди това.

#### 1.1.3 Лабораторията

`revisor` наблюдава услуги и за да се упражняваш, ти трябват услуги за наблюдение. Лабораторията е тестовият стенд от Урок 0 без съществени промени: същата таблица с имена, същите заглавки за всеки код, същите три входа. Променят се портът, 18081, за да съжителства с `revisor` на 18080, и съобщението при стартиране:

```ts
// fig01_01/laboratorio.ts
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

Трите услуги, с които стартира `revisor`, сочат тук: `catalogo` към `/codigo/200`, `pagos` към `/codigo/503` и `nomina` към `/codigo/200`. Ако искаш някоя услуга да „спре да работи“, не е нужно да пипаш нищо: регистрирай такава, която сочи към `/codigo/503`.

#### 1.1.4 Стартиране на двете

Всеки урок от курса, който използва `revisor`, се нуждае от два терминала със сървъри и трети за `curl`. В първия:

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

Във втория:

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Остави двата отворени. Терминалът на `revisor` ще записва всяка заявка, която получава (`GET /servicios`, `POST /servicios`…), и този списък е толкова важен, колкото и онова, което отпечатва `curl`: в раздела „Грешката, която ще видиш“ той е единственият, който казва цялата истина.

Преди да прочетеш файловете един по един, провери, че `revisor` вече отговаря. Ако още не си ги написал, копирай ги от `programas/01-exitos-redirecciones/fig01_01/` в хранилището на курса и ги стартирай; разделите по-нататък обясняват какво е произвело всеки отговор. В третия терминал:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 275
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

`200` със списъка на трите стартови услуги, техния `Content-Type` и техния `Content-Length`. Нищо, което да не познаваш от Урок 0, освен че сега списъкът е истински. Раздел 1.4 обяснява какво го е произвело.

### 1.2 Съхраняване и отговаряне

#### 1.2.1 Хранилището

```ts
// fig01_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

Хранилището пази две неща в паметта, в два `Map`: **услугите** и **инспекциите**. При спиране на `revisor` всичко се губи, нарочно: всяко изпълнение започва със същите три стартови услуги и така онова, което виждаш в терминала си, съвпада с това, което казва урокът. Една услуга има свое `id`, свое `nombre`, `url`, която се проверява, `limiteMs` (колко се чака отговорът, преди услугата да се счита за неработеща), `equipo`, към който принадлежи, който Урок 2 ще използва, за да реши кой какво вижда, и `version`.

`version` е частта, която кара раздел 1.8 да работи. Функцията `etiqueta` сглобява текст в кавички от три части, `"4-1-7b2497d9"`: `id`, `version` и **идентификатор на стартирането**. Този текст е **етикетът на обекта** (*entity tag*, `ETag`) на услугата. Днес никоя услуга не се променя, така че версията винаги е 1; в Урок 3 всяка промяна я увеличава и етикетът се променя заедно с нея. Кавичките не са украса: [RFC 9110, раздел 8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3), дефинира етикета като **непрозрачен текст в двойни кавички** и казва, че за клиента той е непрозрачен: клиентът не трябва да знае как е построен, а само да го сравнява. [Раздел 8.8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.1) дава за пример точно това, което прави `revisor` — използването на вътрешен номер на ревизия.

А идентификаторът на стартирането? Това са 4 случайни байта (`randomBytes(4)`, осем шестнайсетични цифри), които `almacen.ts` генерира веднъж, при стартиране. Те съществуват заради едно правило от [RFC 9110, раздел 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1): силният етикет е уникален сред всички версии на всички представяния на даден ресурс **във времето**. Хранилището живее в паметта и при рестартиране на `revisor` идентификаторите и версиите започват отначало. Без идентификатора услуга 4 отпреди рестартиране и услуга 4 след него, която може да е друга, биха имали един и същ етикет `"4-1"`, и клиент, който е запазил първата, би получил потвърждение, че старото му копие още е актуално. С идентификатора етикет от едно стартиране на практика не съвпада с етикетите от друго (това са 4 случайни байта: вероятност едно на 4 295 милиона за всяко предишно стартиране, никога математическа гаранция), без да се записва нищо на диска. Затова етикетите в твоето изпълнение завършват различно от тези в урока.

Инспекциите са по-прости: `id`, проверената услуга, `estado`, който започва като `"pendiente"` и става `"terminada"`, и `resultado`, който е `null`, докато инспекцията не приключи.

#### 1.2.2 Трите начина за отговор

```ts
// fig01_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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

`revisor` отговаря по три начина и всеки живее във функция, за да не се налага нито един маршрут да помни подробностите:

- **`enviarJson`** отговаря с JSON тяло. Изчислява `Content-Length` в байтове, както в Урок 0, и слага `Content-Type: application/json`. Нея използват `200`, `201` и `202`.
- **`enviarVacio`** отговаря без тяло: за `204`, `304` и пренасочванията. Има едно правило, което заслужава обяснение: на `204` и `304` не слага `Content-Length`, а на останалите слага `Content-Length: 0`. Причината е в [RFC 9110, раздел 8.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6): сървърът **не трябва** да изпраща `Content-Length` в `204`, а в `304` може да го изпрати само ако казва същото, което би казал `200`, тоест размера на тялото, което не се изпраща. Пренасочването може да носи тяло и затова изрично казва, че то е с размер нула.
- **`fallar`** отговаря с грешка в един ред текст. Тя е временна: Урок 5 я заменя с *Problem Details* от RFC 9457 и тази промяна е точно съдържанието на онзи урок.

И трите минават през `escribirCabecera`, която поправя един детайл, който вече видя в Урок 0: Node нарича два кода със старите им имена, затова за `413` и `422` `revisor` слага фразите от регистъра на IANA.

`leerCuerpo` събира парчетата от тялото на заявката и ги превръща в текст. Тялото пристига по мрежата на части, а заявката в Node е поток, който може да се обходи с `for await`; докато не пристигне последното парче, няма цяло тяло за четене. И чете **най-много 16 KiB** (`TOPE_CUERPO`, 16384 байта). Една услуга е кратко име (моделът на курса предвижда до 40 знака), URL и число и се побира с много запас. Внимавай с онова, което това изречение не обещава: в този урок `revisor` проверява само дали `nombre` и `url` са текст; дължината на името и останалите правила за съдържанието идват с валидацията от [Урок 3](03-errores-del-cliente-estado.md), а единственото, което днес ограничава размера, е ограничението на тялото. Без ограничение всеки, който достигне до `revisor`, би могъл да изпрати гигантско тяло или много едновременно, за да напълни паметта му. Затова `leerCuerpo` не събира парчета на сляпо: ако `Content-Length` вече обявява повече от ограничението, отхвърля, без да запазва нищо; ако тялото идва на части, без да обявява размера си, брои байтовете, докато пристигат, и спира да ги пази веднага щом го надхвърлят. И в двата случая сигнализира с `CuerpoDemasiadoGrande` и подготвя **затваряне на етапи** (RFC 9112, раздел 9.6): `413` излиза веднага, с `Connection: close`; връзката се затваря само за писане (полузатворена), `revisor` продължава да чете и изхвърля онова, което клиентът успее да изпрати, и ако клиентът не затвори своята страна до 2 секунди, я унищожава. Ако затвореше рязко, докато клиентът още изпраща, операционната система би отговорила с RST, който може да изтрие `413`, преди клиентът да го прочете. Онзи, който е чел, отговаря с `413 Content Too Large`. Урок 2 обяснява `413` подробно; тук е достатъчно да знаеш, че го има, и да го видиш веднъж, в 1.5.2.

### 1.3 Таблицата с маршрути

```ts
// fig01_01/rutas.ts — qué ruta y qué método atiende cada función.
import type { IncomingMessage, ServerResponse } from "node:http";
import { enviarVacio, fallar } from "./respuestas.ts";
import {
  consultar, consultarRevision, darDeAlta, listar, pedirRevision, retirar, type Contexto,
} from "./servicios.ts";

type Manejador = (contexto: Contexto) => void | Promise<void>;
type Ruta = { patron: RegExp; metodos: Record<string, Manejador> };

const RUTAS: Ruta[] = [
  { patron: /^\/servicios$/, metodos: { GET: listar, POST: darDeAlta } },
  { patron: /^\/servicios\/(\d+)$/, metodos: { GET: consultar, DELETE: retirar } },
  { patron: /^\/servicios\/(\d+)\/revisiones$/, metodos: { POST: pedirRevision } },
  { patron: /^\/revisiones\/(\d+)$/, metodos: { GET: consultarRevision } },
];

// Las rutas viejas: /viejo/... se mudó con 301 y /api/... con 308.
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

export async function atender(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  console.log(`${peticion.method} ${peticion.url}`);
  const url = new URL(peticion.url ?? "/", "http://revisor");
  if (redirigir(url.pathname, url.search, respuesta)) return;
  // HEAD se atiende como GET; Node no manda el cuerpo.
  const metodo = peticion.method === "HEAD" ? "GET" : (peticion.method ?? "GET");
  for (const ruta of RUTAS) {
    const encontrada = ruta.patron.exec(url.pathname);
    // Object.hasOwn y no ruta.metodos[metodo] a secas: el método lo escribe el cliente, y un objeto también
    // «tiene» lo que hereda de Object.prototype (constructor, toString…).
    const manejador = Object.hasOwn(ruta.metodos, metodo) ? ruta.metodos[metodo] : undefined;
    if (encontrada !== null && manejador !== undefined) {
      await manejador({ peticion, respuesta, parametros: encontrada.slice(1) });
      return;
    }
  }
  // Todavía no distingue «no existe la ruta» de «no se permite el método»: eso es la lección 2.
  fallar(respuesta, 404, "no existe esa ruta");
}
```

`rutas.ts` отговаря на един-единствен въпрос: коя функция обслужва тази заявка? Таблицата `RUTAS` има по един ред за всеки маршрут, с регулярен израз, който разпознава маршрута, и вътре — методите, които той поддържа. Скобите в израза (`(\d+)`) улавят номера на услугата или на инспекцията и той стига до функцията като `parametros`.

`atender` прави четири неща по ред. Записва в терминала метода и маршрута. Проверява дали това е стар маршрут, който се е преместил, с `redirigir`, която раздел 1.9 обяснява. Третира `HEAD` като `GET`: функцията, която обслужва, е същата, а Node, който знае, че заявката е била `HEAD`, не изпраща тялото; видя го в Урок 0 с `curl -I`. И обхожда таблицата, докато намери маршрут, който съвпада **и** има функция за този метод. Този последен въпрос се задава с `Object.hasOwn(ruta.metodos, metodo)`, а не директно с `ruta.metodos[metodo]`, и причината е свързана със сигурността: методът се изписва от клиента, а JavaScript обектът също „притежава“ онова, което наследява (`constructor`, `toString`…). При наивното търсене клиент, който изпрати метода `constructor`, би намерил функция, която никой не е писал, за да го обслужва; с `Object.hasOwn` се броят само методите, които таблицата обявява, и `constructor` получава същия `404` като всеки друг непознат метод.

Ако не намери нито един, отговаря с `404` и „no existe esa ruta“. Обърни внимание на коментара на този последен ред: `revisor` все още не различава „този маршрут не съществува“ от „този маршрут съществува, но не с този метод“. Това са два различни отговора, `404` и `405`, а вторият изисква заглавката `Allow`. Това е нарочният дефект на този урок и ще го видиш в „Грешката, която ще видиш“.

### 1.4 `200`: връщане на поисканото

#### 1.4.1 Въпросът, който решава

`200 OK` е най-познатият успешен отговор и RFC 9110 го дефинира в [раздел 15.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1) с идея, която си струва да се прочете бавно: съдържанието на `200` **зависи от метода**. На `GET` се връща представяне на ресурса; на `POST` — състоянието или резултатът от действието; на `PUT` или `DELETE` — състоянието на действието. С други думи, `200` не казва „всичко е наред“ абстрактно: казва „ето тялото, което отговаря на това, което поиска“.

Оттук идва въпросът, който решава: **има ли какво да се върне и това ли е поисканото?** Ако да, `200`. Ако операцията е създала нещо ново, има по-точен код (`201`). Ако още не е приключила — друг (`202`). Ако е приключила и няма какво да се каже — друг (`204`). `200` е онова, което остава, когато нито един от трите по-точни не е приложим.

Същият раздел добавя два детайла. `200` на `GET` или `HEAD` **би трябвало** да изпраща наличните валидатори, като `ETag`, и `revisor` го прави при проверката на услуга. А от `200` **се очаква да носи съдържание**, освен ако рамкирането на съобщението изрично не казва, че то е с размер нула (`Content-Length: 0`); ако нещо в заявката показва, че клиентът предпочита да не получава съдържание, RFC предлага вместо това `204`.

#### 1.4.2 В `revisor`

Двата маршрута, които връщат `200`, са `listar` и `consultar`, в `servicios.ts`. Това е целият файл, защото всички следващи раздели ще го използват:

```ts
// fig01_01/servicios.ts — lo que hace cada ruta de la API del revisor.
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  buscarRevision, buscarServicio, crearRevision, crearServicio, etiqueta, listarServicios,
  retirarServicio, terminarRevision, type Revision, type Servicio,
} from "./almacen.ts";
import { revisarDestino } from "./destinos.ts";
import { coincideDebil, hayCoincidencia } from "./etiquetas.ts";
import { revisar } from "./cliente.ts";
import {
  CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras,
} from "./respuestas.ts";

export type Contexto = {
  peticion: IncomingMessage;
  respuesta: ServerResponse;
  parametros: string[];
};

// Cuánto espera una revisión en la cola antes de empezar.
const ESPERA_EN_COLA_MS = 1000;

function representar(servicio: Servicio): object {
  return { id: servicio.id, nombre: servicio.nombre, url: servicio.url, limite_ms: servicio.limiteMs };
}

function representarRevision(revision: Revision): object {
  return { id: revision.id, servicio: revision.servicio, estado: revision.estado, resultado: revision.resultado };
}

// SSRF: el revisor se conecta a la URL que alguien escribió. Se revisa al registrarla y otra vez
// antes de cada conexión (en cliente.ts). Si no se permite, ya respondió y devuelve false.
async function destinoPermitido(url: string, respuesta: ServerResponse): Promise<boolean> {
  const veredicto = await revisarDestino(url);
  if (veredicto.permitido) return true;
  fallar(respuesta, 400, `destino prohibido: ${veredicto.motivo}`);
  return false;
}

export function listar({ respuesta }: Contexto): void {
  enviarJson(respuesta, 200, { servicios: listarServicios().map(representar) });
}

export async function darDeAlta({ peticion, respuesta }: Contexto): Promise<void> {
  let leido: unknown;
  try {
    leido = JSON.parse(await leerCuerpo(peticion));
  } catch (error) {
    if (error instanceof CuerpoDemasiadoGrande) {
      // 413: el cuerpo es más grande de lo que el revisor acepta. La lección 2 lo explica.
      fallar(respuesta, 413, `el cuerpo pasa de ${TOPE_CUERPO} bytes`, { Connection: "close" });
      return;
    }
    fallar(respuesta, 400, "el cuerpo no es JSON");
    return;
  }
  // `null`, un número o una lista también son JSON válido, pero no traen campos: leer datos.nombre
  // sobre null lanzaría un TypeError. Solo un objeto sigue adelante.
  if (typeof leido !== "object" || leido === null || Array.isArray(leido)) {
    fallar(respuesta, 400, "el cuerpo no es un objeto JSON");
    return;
  }
  const datos: { nombre?: unknown; url?: unknown; limite_ms?: unknown } = leido;
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
  const servicio = crearServicio({ nombre: datos.nombre, url: datos.url, limiteMs, equipo: "a" });
  enviarJson(respuesta, 201, representar(servicio), {
    Location: `/servicios/${servicio.id}`,
    ETag: etiqueta(servicio),
  });
}

export function consultar({ peticion, respuesta, parametros }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
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

export function retirar({ respuesta, parametros }: Contexto): void {
  if (!retirarServicio(Number(parametros[0]))) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
    return;
  }
  enviarVacio(respuesta, 204);
}

export function pedirRevision({ respuesta, parametros }: Contexto): void {
  const servicio = buscarServicio(Number(parametros[0]));
  if (servicio === undefined) {
    fallar(respuesta, 404, `no existe el servicio ${parametros[0]}`);
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}

export function consultarRevision({ respuesta, parametros }: Contexto): void {
  const revision = buscarRevision(Number(parametros[0]));
  if (revision === undefined) {
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
    return;
  }
  const cabeceras: Cabeceras = revision.estado === "pendiente" ? { "Retry-After": "1" } : {};
  enviarJson(respuesta, 200, representarRevision(revision), cabeceras);
}
```

`listar` е най-простият в цялото API: сглобява `{"servicios": […]}` с представянето на всяка услуга и отговаря с `200`. Обърни внимание на `representar`: хранилището пази `limiteMs`, но API-то го показва като `limite_ms` и не показва нито `equipo`, нито `version`. Представянето е дизайнерско решение, отделно от начина, по който се съхраняват данните: в деня, в който хранилището се промени, API-то може да продължи да казва същото. Полетата са в `snake_case`, защото така остават в целия курс, а важното е да не се променят от маршрут на маршрут.

Отговорът на `listar` е този, който видя в 1.1.4: `{"servicios": […]}` с трите стартови услуги и `200`. `consultar`, другият маршрут с `200`, се появява в 1.5.2 и се допълва в 1.8, защото той е този, който разбира етикетите.

### 1.5 `201`: създаване и казване къде се намира

#### 1.5.1 Въпросът, който решава

[RFC 9110, раздел 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2), дефинира `201 Created` така: заявката е изпълнена и **е създала един или повече нови ресурси**. И казва как се идентифицира основният ресурс: чрез заглавката `Location` в отговора или, ако я няма, чрез самия път на заявката. Втората възможност има малко значение при регистрация като тази в `revisor`, защото заявката е отишла до `/servicios`, а новата услуга не живее в `/servicios`, а в `/servicios/4`. Затова за `POST`, който създава нещо, [раздел 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3) е по-директен: сървърът **би трябвало** да отговори с `201` и `Location`, който идентифицира създадения ресурс.

Въпросът, който решава: **създаде ли тази заявка нещо, което преди не е съществувало и което има собствен адрес?** Ако да, `201` с `Location`. Ако `POST` е направил нещо друго (обработка, изчисление, изпращане), няма нов ресурс, който да се посочи, и `201` лъже.

Същият раздел 15.3.2 позволява `201` да носи валидатори и казва какво означават те: те са на току-що създадения ресурс. Затова `revisor` изпраща `ETag` на новата услуга заедно с `Location`. Който регистрира, вече има от първия отговор етикета, който би му трябвал за условна заявка като тези в раздел 1.8.

#### 1.5.2 В `revisor`

`darDeAlta` чете тялото, с ограничението от 16 KiB от 1.2.2, и задава пет въпроса по ред: JSON ли е?, JSON **обект** ли е?, носи ли `nombre` и `url` като текст?, ако има `limite_ms`, разумно цяло число ли е?, позволена дестинация ли е URL адресът? (раздел 1.10 казва защо). Ако всичко мине, създава услугата и отговаря с `201` с две заглавки: `Location`, с адреса на новата услуга, и `ETag`, с нейния етикет. Тялото е представянето на новата услуга, същото, което би върнал `GET` към този адрес; RFC казва, че тялото на `201` обикновено описва създадения ресурс и сочи към него.

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-7b2497d9"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`-X POST` казва на `curl` кой метод да използва, `-H` добавя заглавката `Content-Type`, а `-d` изпраща тялото. Услугата се казва `inventario`, сочи към лабораторията и няма `limite_ms`, затова `revisor` ѝ е сложил стойността по подразбиране, 2000. Тя е услуга 4, защото трите стартови заемат 1, 2 и 3, а етикетът ѝ е `"4-1-7b2497d9"`: услуга 4, версия 1 и идентификаторът на това стартиране (твоят ще е друг).

Сега последвай адреса от `Location`:

```text
$ curl -i http://127.0.0.1:18080/servicios/4
HTTP/1.1 200 OK
ETag: "4-1-7b2497d9"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Същото тяло, същият `ETag`. `Location` е **относителна препратка**, `/servicios/4`, без сървър и порт. [RFC 9110, раздел 10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2), го позволява: ако стойността е относителна, тя се допълва с адреса на оригиналната заявка. Същото прави `curl`, когато следва относително пренасочване, и същото прави `new URL(location, base)` в програма, както ще видиш в раздел 1.6.

`limite_ms` има диапазон, от 100 до 10000 милисекунди. Без него някой би могъл да регистрира услуга с ограничение от един час и всяка инспекция би оставила `revisor` да чака час услуга, която не отговаря; с ограничение нула би я обявил за неработеща, без да я е проверил. Извън диапазона регистрацията не се извършва:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"eterno","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3600000}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 47
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

limite_ms debe ser un entero entre 100 y 10000
```

Този `400` е част от предпазната мрежа, за която говори „Какво не прави този урок“: `revisor` не създава услуга с данни, които не може да изпълни, и не отговаря с `200`, когато не е направил нищо. Ако си мислиш, че „може да се прочете, но не може да се изпълни“ звучи повече като `422`, отколкото като `400`, прав си, и това е точно политиката, която пише Урок 3. Засега `revisor` няма `422`.

Остава вторият въпрос от списъка, който изглежда излишен: JSON **обект** ли е? `null` е валиден JSON, както и `7`, `"texto"` или `[]`, и `JSON.parse` ги приема, без да се оплаче. Но нито един от тях няма полета, а четенето на `datos.nombre` върху `null` хвърля `TypeError`. Без този въпрос и без мрежата от `servidor.ts` тази заявка би сринала `revisor` за всички, с един-единствен `curl` и без идентификационни данни. С въпроса:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d 'null'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 31
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es un objeto JSON
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios
200
```

`400` с причината, а следващата заявка отговаря с `200`: `revisor` продължава да работи. Въпросът и мрежата не са едно и също. Въпросът превръща неизползваемо тяло в `400`, който казва на клиента какво да поправи; мрежата хваща онова, което никой не е предвидил, и го превръща в `500`, който не казва на клиента нищо полезно. Въпросът е правилното; мрежата е застраховката за онова, което се изплъзне.

Преди тези пет въпроса е ограничението. Тяло от 20000 байта, повече от 16384-те, които приема `revisor`:

```text
$ head -c 20000 /dev/zero | curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' --data-binary @-
HTTP/1.1 413 Content Too Large
Connection: close
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 23:42:10 GMT

el cuerpo pasa de 16384 bytes
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios
200
```

`413`, с `Connection: close`, без `revisor` да запази нито един байт от тялото: `Content-Length` обявяваше 20000 и беше достатъчно да се прочете заглавката. Следващата заявка отговаря с `200`. `head -c 20000 /dev/zero` произвежда 20000 нулеви байта, а `--data-binary @-` казва на `curl` да изпрати като тяло, без промени, онова, което пристига по тръбата.

> **Разделяне на сесията.** Ако минаваш урока в две сесии по 45 минути, това е мястото. Спри `revisor` и лабораторията с `Ctrl`+`C`. Когато се върнеш, стартирай двете и регистрирай отново услугата `inventario` с `curl` от 1.5.2: тъй като хранилището живее в паметта, при рестартиране тя се губи, а раздел 1.7 премахва услуга 4. Ако минаваш урока наведнъж, направи същото: спри двете, стартирай ги и повтори регистрацията, за да съвпадат номерата ти с тези от урока. Отговорът е същият като в 1.5.2 с изключение на етикета, защото това е друго стартиране:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-b27b3d9a"
Content-Type: application/json
Content-Length: 90
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"inventario","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

### 1.6 `202`: прието, още не е направено

#### 1.6.1 Въпросът, който решава

Искането на инспекция не се решава на момента. `revisor` трябва да провери услугата, а една бавна услуга може да отговаря секунди; в реална система инспекциите чакат реда си в опашка. Да се държи връзката отворена междувременно би било лоша идея: клиентът остава да виси, а ако връзката прекъсне, не знае дали инспекцията е направена.

За това съществува `202 Accepted`. [RFC 9110, раздел 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3), го дефинира с необичайна откровеност: заявката е приета за обработка, но **обработката не е приключила** и може би никога няма да бъде извършена, защото може да бъде отхвърлена, когато дойде редът ѝ. Казва, че `202` е „умишлено уклончив“ (*intentionally noncommittal*). И добавя, че в HTTP няма начин сървърът да изпрати по-късно друг код на състоянието за същата заявка: отговорът вече е даден. Затова завършва с препоръка, която е половината от този раздел: представянето на `202` **би трябвало** да описва текущото състояние на заявката и да сочи към **монитор на състоянието** (*status monitor*), където клиентът може да види кога тя е изпълнена.

Въпросът, който решава: **ще приключи ли операцията, след като отговоря?** Ако да, `202`, и никога `200` или `201`, защото и двата казват на клиента, че вече е приключила.

#### 1.6.2 Ресурсът за проследяване

В `revisor` този монитор на състоянието е отделен ресурс: всяка инспекция живее в `/revisiones/{id}`. `pedirRevision` създава инспекцията в състояние `pendiente`, насрочва я за след една секунда със `setTimeout` (секундата „чакане в опашката“, която прави видимо чакащото състояние) и отговаря с `202` с две неща: тяло, което описва текущото състояние, и `Location`, който сочи към инспекцията. Това е същата заглавка като в `201`, с друго значение: в `201` тя посочва създаденото, а в `202` посочва къде да питаш.

`consultarRevision` отговаря с `200` и състоянието на инспекцията. Докато тя чака, добавя `Retry-After: 1`. [RFC 9110, раздел 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), дефинира `Retry-After` като времето, което клиентът би трябвало да изчака преди следващата си заявка, в секунди или с дата; RFC я описва за `503` и за пренасочванията, а в ресурс за проследяване тя изпълнява същата роля: „не се връщай преди една секунда“. Това, че `revisor` я използва тук, е дизайнерско решение, а не норма; нормата само дефинира какво означава заглавката.

Поискай инспекция на услуга 2, `pagos`, която сочи към `/codigo/503`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones
HTTP/1.1 202 Accepted
Location: /revisiones/1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"pendiente","resultado":null}
```

И веднага, без да чакаш, последвай `Location`:

```text
$ curl -i http://127.0.0.1:18080/revisiones/1
HTTP/1.1 200 OK
Retry-After: 1
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:17:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"pendiente","resultado":null}
```

`200`, защото справката за проследяването наистина мина добре: ето какво поиска, състоянието на инспекцията. Състоянието е `pendiente`, а `Retry-After: 1` казва кога да се върнеш. Това е момент, който в началото обърква: **`202` описва заявката за инспекция; `200` описва справката за проследяването**. Това са две различни заявки, всяка със своя код.

Две секунди по-късно:

```text
$ sleep 2
$ curl -i http://127.0.0.1:18080/revisiones/1
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 111
Date: Wed, 21 Oct 2026 13:17:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":11,"detalle":"503"}}
```

Приключила. Резултатът казва, че `pagos` е `CAIDO`, с кода `503`, с който е отговорила лабораторията, и милисекундите, които е отнело (при твоето изпълнение — друго число). Вече няма `Retry-After`, защото няма какво да се чака.

#### 1.6.3 Клиентската страна

Кой провери `pagos`? Клиентската страна на `revisor`:

```ts
// fig01_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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

`revisar` получава URL адреса и ограничението. Първото, което прави, е отново да провери дестинацията (раздел 1.10 казва защо преди **всяка** връзка). После измерва времето с `performance.now()`, проверява с `fetch` и класифицира. Ако кодът е `400` или повече — `CAIDO`. Ако не, `LENTO`, ако е отнело половината от ограничението или повече, и `ARRIBA`, ако е отнело по-малко. Ако `fetch` не е получил отговор — `CAIDO` с подробност, която различава „времето изтече“ от „нямаше връзка“; това е разликата между грешка 7 на `curl` и HTTP отговор, която видя в края на Урок 0.

Три детайла на `fetch`. `AbortSignal.timeout(limiteMs)` прекъсва проверката, ако надхвърли ограничението. `respuesta.body?.cancel()` изхвърля тялото, без да го чете, защото за класификацията има значение само числото: това е принципът „кодът командва“, приложен от страната на онзи, който чете. А `redirect: "manual"` казва на `fetch` да **не следва** пренасочванията: ако една услуга отговори с `301`, `revisor` записва `301` и не отива там, където казва `Location`. Това решение има причина, свързана със сигурността, и ще я видиш в карето.

#### 1.6.4 Клиент, който умее да чака

С `curl` проследи `202` ръчно. Една програма трябва да го прави сама, а изкушението е да проверява в цикъл без пауза, докато не каже `terminada`. Тази програма го прави както трябва. Запази я като `~/curso-http/revisor/fig01_02.ts`:

```ts
// fig01_02.ts
// Pide una revisión y la sigue como debe hacerlo quien recibe un 202: va a Location y respeta Retry-After.
import { setTimeout as esperar } from "node:timers/promises";

const BASE = "http://127.0.0.1:18080";
const servicio = process.argv[2] ?? "2";

const pedido = await fetch(`${BASE}/servicios/${servicio}/revisiones`, { method: "POST" });
await pedido.text();
const seguimiento = pedido.headers.get("location");
console.log(`${pedido.status} ${pedido.statusText}; seguimiento en ${seguimiento}`);
if (pedido.status !== 202 || seguimiento === null) process.exit(1);

type Revision = { estado: "pendiente" | "terminada"; resultado: unknown };

for (let consulta = 1; consulta <= 10; consulta++) {
  const respuesta = await fetch(new URL(seguimiento, BASE));
  const revision = (await respuesta.json()) as Revision;
  const pide = respuesta.headers.get("retry-after");
  console.log(`consulta ${consulta}: ${respuesta.status} ${revision.estado}${pide === null ? "" : `, Retry-After: ${pide}`}`);
  if (revision.estado === "terminada") {
    console.log(`resultado: ${JSON.stringify(revision.resultado)}`);
    break;
  }
  // Espera lo que pide el servidor, entre 1 y 5 segundos: ni martilla ni se queda dormido.
  const segundos = Math.min(Math.max(Number(pide) || 1, 1), 5);
  await esperar(segundos * 1000);
}
```

Прочита отговора на `202` и взема `Location`; ако кодът не е `202` или заглавката липсва, спира, защото не би знаела къде да пита. После проверява проследяването: `new URL(seguimiento, BASE)` допълва относителната препратка със сървъра и порта, както казва RFC. При всяко завъртане отпечатва състоянието и, ако го има, `Retry-After`. Когато инспекцията приключи, отпечатва резултата и излиза. Ако не, изчаква колкото е поискал сървърът, **ограничено между 1 и 5 секунди**, и пита отново. Двете граници са решения на клиента, а не на RFC: долната предпазва от бомбардиране на сървъра, ако `Retry-After` липсва или не е число, а горната пречи на сгрешил сървър да я приспи за час. [Урок 6](06-reintentos-idempotencia.md) се връща към тази втора граница, а [Урок 7](07-quien-lee-el-error.md) — към това какво да правиш, когато сървърът поиска да чакаш повече, отколкото си готов. Цикълът освен това има горна граница от десет проверки, за да не остави проследяване, което никога не приключва, програмата да работи вечно.

С работещи лаборатория и `revisor` поискай инспекция на услуга 1, `catalogo`:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/2
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"ARRIBA","codigo":200,"ms":1,"detalle":"200"}
```

Две проверки. Първата намери инспекцията чакаща и се подчини на `Retry-After`; втората, секунда по-късно, я намери приключила: `catalogo` е `ARRIBA`. В терминала на `revisor` останаха три реда, `POST` и двата `GET`. Преброй проверките, които е направила твоята програма: ако са пет хиляди, липсва паузата.

### 1.7 `204`: готово, и няма какво да се каже

#### 1.7.1 Въпросът, който решава

[RFC 9110, раздел 15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5), дефинира `204 No Content`: сървърът е изпълнил заявката и **няма допълнително съдържание** за изпращане. И е категоричен за формата: `204` завършва с последната заглавка и **не може** да носи тяло.

Въпросът, който решава: **приключи ли операцията и няма ли нищо полезно за казване?** Премахването е учебникарският случай. За успешен `DELETE` [раздел 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.5) дава точно три възможности: `202`, ако действието вероятно ще се случи, но още не се е случило, `204`, ако вече се е случило и няма повече информация, и `200`, ако вече се е случило и отговорът носи представяне на състоянието. `revisor` премахва на момента и няма какво да каже, затова отговаря с `204`.

А защо не `200` с празно тяло или с `{"ok": true}`? Защото `204` казва на всяка програма, без тя да чете нищо, че няма тяло, което да очаква. `200` с `{"ok": true}` задължава клиента да прочете тялото, за да научи нещо, което кодът вече е казал. А празен `200` е валиден, ако обявява `Content-Length: 0`, но задължава клиента да погледне дължината, за да разбере, че няма нищо, когато `204` вече го казва с кода.

#### 1.7.2 В `revisor`

`retirar` изтрива услугата от хранилището и отговаря с `enviarVacio`. Ако услугата не е съществувала, отговаря с `404`. Премахни услуга 4:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Нито `Content-Type`, нито `Content-Length`: няма тяло, което да се описва. Поискай я отново:

```text
$ curl -i http://127.0.0.1:18080/servicios/4
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 4
```

Услугата вече не съществува и `revisor` го казва с `404` и ред текст. (В Урок 3 премахната услуга ще отговаря с `410`, който казва „съществуваше и вече я няма“; днес `revisor` не помни какво е премахнал.) А ако повториш премахването:

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 4
```

Вторият `DELETE` отговаря различно от първия и въпреки това `DELETE` е **идемпотентен**. [RFC 9110, раздел 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2), дефинира идемпотентния метод чрез **ефекта му върху сървъра**, а не чрез отговора: повтарянето на заявката оставя сървъра в същото състояние, както ако е направена веднъж. След един или десет `DELETE` услуга 4 не съществува. Това свойство е основата на Урок 6, защото то позволява повторни опити без страх.

### 1.8 `304`: не ти изпращам онова, което вече имаш

#### 1.8.1 Въпросът, който решава

Представи си табло, което показва услугите и ги проверява на всеки десет секунди. В повечето случаи нищо не се е променило, а `revisor` изпраща едно и също тяло отново и отново. За това съществуват **условните заявки**: клиентът казва „вече имам версията с този етикет; изпрати ми я само ако се е променила“. Заглавката е `If-None-Match` („ако никой не съвпада“) и носи `ETag`, който клиентът е запазил.

[RFC 9110, раздел 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2), казва как се оценява: ако някой от етикетите, изпратени от клиента, съвпада с този на ресурса, условието е невярно и тогава сървърът **не трябва** да изпълнява метода: на `GET` или `HEAD` отговаря с `304`, а на всеки друг метод — с `412` (Урок 3 се занимава с `412`). Ако никой не съвпада, сървърът отговаря както винаги, със своя `200`.

[RFC 9110, раздел 15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5), дефинира `304 Not Modified`: условната заявка би довела до `200`, но не е нужно представянето да се изпраща, защото **клиентът вече го има**. Сървърът, казва RFC, „пренасочва“ клиента към неговото собствено запазено копие. Затова `304` живее в семейството `3xx`, макар да не носи `Location`: това е пренасочване към онова, което вече имаш. И подобно на `204`, завършва с последната заглавка: **не може** да носи тяло.

Онова, което трябва да носи, е частта, която най-често се забравя. RFC дава кратък списък: `Content-Location`, `Date`, `ETag` и `Vary`, както и `Cache-Control` и `Expires`; `Content-Length` може да ги придружава само ако казва същото, което би казал `200` (раздел 8.6), а `revisor` предпочита да не го изпраща. От тези заглавки `304` **трябва** да генерира онези, които би изпратил `200` на същата заявка. `ETag` е тази, която има значение тук: тя потвърждава на клиента коя е актуалната версия.

Въпросът, който решава, от страната на сървъра: **версията, която клиентът казва, че има, актуалната ли е?** Ако да, `304` и нищо повече. Ако не, `200` с новата версия и нейния етикет.

#### 1.8.2 Четене на списък с етикети

Раздел 13.1.2 има два детайла, които решават как се пише кодът. Първият: `If-None-Match` не носи **един** етикет, а `*` или **списък**, разделен със запетаи (`If-None-Match: "a", "b"`), защото един клиент може да има запазени няколко версии и да пита за всички наведнъж; а `*` означава „която и да е версия, която имаш“. Вторият: сравнението е **слабо**. [Раздел 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) дефинира два начина за сравняване на етикети. При **силното** два етикета съвпадат само ако нито един не носи `W/` (знакът за „слаб“) и текстът е идентичен. При **слабото** е достатъчно текстът в кавичките да е еднакъв, със или без `W/`. `If-None-Match` използва слабото, защото само пита дали копието на клиента все още става за показване. Урок 3 използва силното, с `If-Match`, за нещо по-деликатно.

Сравняването на цялата заглавка с етикета като текст се проваля и при двете неща и затова съществува `etiquetas.ts`:

```ts
// fig01_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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

`interpretarLista` обхожда заглавката, като спазва кавичките: запетая **вътре** в кавичките е част от етикета, а не разделител. Връща `"*"` или списъка с етикети така, както са пристигнали. Ако нещо няма форма на етикет, целият списък е невалиден и функцията връща празен списък, който не съвпада с нищо. Това е предпазливото решение: при счупена заглавка сървърът отговаря изцяло, което никога не е неправилно. `coincideDebil` и `coincideFuerte` сравняват два етикета. `hayCoincidencia` съединява двете части: `*` съвпада винаги (онзи, който я извиква, вече е намерил ресурса), а списък съвпада, ако **някой** от етикетите му съвпада с актуалния.

#### 1.8.3 В `revisor`

`consultar`, в `servicios.ts`, изчислява актуалния етикет и пита `hayCoincidencia`, със слабото сравнение, дали заглавката `If-None-Match` го съдържа. Ако да, `enviarVacio(respuesta, 304, { ETag: actual })`; ако не, обичайният `200`. Поискай услуга 1, `catalogo`, и обърни внимание на нейния `ETag`:

```text
$ curl -i http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-b27b3d9a"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Сега я поискай с този етикет. Копирай **твоя**, онзи, който ти е дал твоят отговор, с кавичките:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 304 Not Modified
ETag: "1-1-b27b3d9a"
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`304`, с `ETag` и без тяло, без `Content-Type` и без `Content-Length`: 88-те байта на тялото не пътуваха. При тази услуга играчка това е нищо; при списък от хиляди услуги, проверяван на всеки десет секунди от сто табла, това е разликата между изпращането на мегабайти в минута и почти нищо.

Сравни го с `HEAD`, който също пристига без тяло, но по друга причина:

```text
$ curl -I http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-b27b3d9a"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`200` с `Content-Length: 88`: `HEAD` казва колко би било тялото, както в Урок 0. `304` не казва нищо подобно, защото не е отговор на „какво представлява?“, а на „промени ли се?“.

Другите три форми, които RFC позволява, с `-w '%{http_code}\n'`, за да се види само кодът: етикетът, отбелязан като слаб, списък, който го съдържа, и звездичката.

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", "1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: *'
304
```

И трите дават `304`. `W/` не променя нищо при слабо сравнение; списъкът съвпада, защото един от етикетите му съвпада; а `*` съвпада, защото услугата съществува.

#### 1.8.4 Етикетът се променя при всяко стартиране

Спри `revisor` (остави лабораторията да работи) и го стартирай отново. После поискай услуга 1 с предишния етикет:

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 200 OK
ETag: "1-1-ed399d6d"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`200`, с цялото тяло и нов етикет. Услуга 1 е същата `catalogo` и в нея нищо не се е променило, но `revisor` няма как да го знае: загубил е всичко при рестартирането и я е създал отново. При съмнение изпраща цялото представяне и етикет, който не може да бъде объркан с нито един от предишните. Това е идентификаторът на стартирането от 1.2.1, който си върши работата. Без него старият и новият етикет щяха да бъдат и двата `"1-1"` и един `304` би потвърдил на клиента копие, което сървърът вече не може да гарантира. Сървър, който пази данните си в база данни, няма този проблем: версията му оцелява след рестартиране. `revisor` го решава с най-простото, което работи.

### 1.9 `301` и `308`: преместване, без да се загуби `POST`

#### 1.9.1 Въпросът, който решава

API-тата се преместват. `revisor` е имал два стари маршрута, `/viejo/servicios` и `/api/servicios`, които днес живеят в `/servicios`. За да се каже това, има два постоянни кода и разликата между тях е историческа.

[RFC 9110, раздел 15.4.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.2), дефинира `301 Moved Permanently`: ресурсът има нов и постоянен адрес и сървърът **би трябвало** да го изпрати в `Location`. И съдържа бележка, която е центърът на този раздел: **по исторически причини клиентът може да смени метода от `POST` на `GET`** в следващата заявка. Същата бележка дава изхода: ако тази смяна не е желана, се използва `308`.

Въведението на [раздел 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4) разказва цялата история. В HTTP/1.0 `301` и `302` запазваха метода. Но първите браузъри се разделиха: едни повтаряха `POST` на новия адрес, а други го превръщаха в `GET`, което беше по-предпазливо, ако пренасочването водеше към друг сайт. Практиката в крайна сметка го превърна в `GET` и спецификацията се приспособи, за да го позволи. За пренасочванията, които **запазват** метода, бяха създадени нови кодове: `307`, временен, и `308 Permanent Redirect`, който [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) дефинира през юни 2014 г. като експеримент, [RFC 7538](https://www.rfc-editor.org/rfc/rfc7538.html) превърна в стандарт през април 2015 г. и който днес е в [раздел 15.4.9](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.9) на RFC 9110.

Клиентите, които ще използваш, следват тази практика буквално. Ръководството на `curl` казва, че при следване на пренасочване с `-L`, ако заявката е била `POST` и отговорът е бил `301`, `302` или `303`, следващата заявка е `GET`; с всеки друг `3xx` повтаря същия метод. А [стандартът Fetch](https://fetch.spec.whatwg.org/#http-redirect-fetch), който следва `fetch` в Node и в браузърите, казва същото в своя алгоритъм за пренасочване: ако кодът е `301` или `302` и методът е `POST`, методът става `GET` и **тялото се изхвърля**.

Въпросът, който решава: **може ли някой да изпрати към този стар маршрут нещо различно от `GET` или `HEAD`?** Ако никога, `301` е достатъчен и го разбира и най-старият клиент. Ако може да пристигне `POST`, `PUT` или `DELETE` — `308`. RFC 7538, в раздел 4, добавя една предпазна мярка: много стар клиент, който не познава `308`, ще го третира като `300`, заради правилото за `x00` от Урок 0, и може да не последва пренасочването: сървърът не може да разчита, че ще го последва. Днес това е рядкост, но е причината `301` да остава вариантът за маршрутите, които само се четат.

Преместванията не са учебникарски пример. Страницата на OWASP, която цитира карето за сигурност в този урок, е сменила адреса си и ако я поискаш на стария адрес, с `-I` (само заглавките) и `-L` (следване), виждаш цялото преместване, в три скока:

```text
$ curl -sS -I -L https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/ | grep -i -E '^HTTP|^location'
HTTP/2 308 
location: /API-Security/editions/2023/en/0xa7-server-side-request-forgery
HTTP/2 308 
location: https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery
HTTP/2 301 
location: https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/
HTTP/2 200 
```

Два `308` и един `301` преди `200`: първият маха наклонената черта в края, вторият премества страницата на друг домейн, а третият отново я слага. Това изпълнение е от 21 октомври 2026 г. и е запазено, без промени, в `programas/01-exitos-redirecciones/owasp.salida.txt`, а чужд сайт може да промени преместванията си, когато пожелае, така че твоето може да изглежда различно. Редовете казват `HTTP/2` и нямат фраза, защото тази връзка използва HTTP/2, който не изпраща фразата в реда на състоянието: Урок 0 ти каза, че клиентът не трябва да решава въз основа на нея.

Има и трети код, за който се чува тук, `302 Found`, и е добре да знаеш къде се намира. Той има същата историческа бележка като `301` (`POST` може да стане `GET`), но е **временен**: клиентът трябва да продължи да използва оригиналния адрес. Двойката му, която запазва метода, е `307`. `revisor` не ги използва, защото преместванията му са постоянни; лабораторията ги произвежда на `/codigo/302` и `/codigo/307`, ако искаш да ги видиш.

#### 1.9.2 В `revisor`

`redirigir`, в `rutas.ts`, проверява маршрута **преди** таблицата, за да не стигне никога стар маршрут до манипулатор. На `/viejo/servicios` и всичко под него отговаря с `301`; на `/api/servicios` и всичко под него — с `308`. И в двата случая `Location` е новият маршрут: премахва се префиксът и се запазва заявката (query, онова, което идва след `?`), така че `GET /viejo/servicios?x=1` да стигне до `/servicios?x=1`.

Без `-L` `curl` само показва отговора, без да го следва. Изпрати регистрация към всеки стар маршрут:

```text
$ curl -i -X POST http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
$ curl -i -X POST http://127.0.0.1:18080/api/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 308 Permanent Redirect
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Двата отговора казват едно и също, с изключение на числото: „това се премести в `/servicios`“, с `Content-Length: 0`. Нито един от двата не създаде нищо. Какво става после, зависи от клиента, и точно това показва разделът „Грешката, която ще видиш“.

### 1.10 Каре за сигурност: SSRF

> **Каре за сигурност. Какво е SSRF и защо `revisor` го носи по рождение**
>
> **SSRF** (*server-side request forgery*, фалшифициране на заявки от страна на сървъра) е онова, което се случва, когато някой успее да накара **твоя сървър** да направи заявка, която **този човек** е избрал. Сървърът се свързва от собствената си мрежа, със собствения си достъп, към адрес, до който нападателят не би могъл да стигне отвън: самия сървър (`127.0.0.1`), вътрешната мрежа на компанията или услугата за метаданни на облака. [OWASP API Security Top 10 от 2023 г.](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/) го поставя на седмо място (API7:2023) и го дефинира така: API, което извлича отдалечен ресурс, **без да валидира URL адреса, даден от потребителя**. И обяснява защо е станало често срещано: *webhooks*, визуализациите на връзки и изтеглянето на файлове от URL са продуктови функции, които се състоят именно в свързване към чужд адрес.
>
> **`revisor` е типичният случай.** Работата му е да се свързва с URL адреса, който е написал онзи, който е регистрирал услугата. Това не е небрежност, която може да се премахне: това е продуктът. Без никаква защита всеки с разрешение да регистрира услуга би могъл да регистрира `http://127.0.0.1:18080/mantenimiento` и да накара `revisor` да провери сам себе си, или адрес от вътрешната мрежа, който вижда само сървърът, и после да прочете резултата от инспекцията: `ARRIBA`, `CAIDO`, кода и милисекундите. С това вече може да направи карта на това кои машини и кои портове съществуват във вътрешната мрежа. А ако `revisor` работи в облак, има адрес, който струва повече от всички: `169.254.169.254`, където няколко облака публикуват **метаданните** на машината. [Документацията на AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) използва този адрес във всичките си примери (и `[fd00:ec2::254]` за IPv6), тази на [Alibaba Cloud](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata) използва друг, `100.100.100.200`, а [ръководството на OWASP за предотвратяване на SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) го казва без заобикалки: в облака SSRF често се използва за кражба на идентификационни данни и токени от тези услуги за метаданни.
>
> **Защитата: да се пита DNS преди всяка връзка.** Проверката на текста на URL адреса не е достатъчна. `localhost` не изглежда като забранен адрес, а е такъв; `http://2130706433/` също не изглежда така, а анализаторът на URL го превръща в `127.0.0.1`, защото [стандартът URL](https://url.spec.whatwg.org/#concept-ipv4-parser) приема IPv4 адреси, изписани като едно число, в шестнайсетичен или осмичен вид. Важно е не как се изписва дестинацията, а **към кой адрес ще се свърже `revisor`**. Затова `destinos.ts` прави три неща: оставя `new URL` да нормализира адреса; разрешава името с `dns.lookup` и опцията `all: true`, която връща **всички** адреси на името, така както би го разрешила всяка друга програма на машината (включително с `/etc/hosts`); и отхвърля дестинацията, ако **дори един** от тях попада в частен или резервиран диапазон. Диапазоните се проверяват с `net.BlockList` на Node, а IPv4, записан вътре в IPv6 (`::ffff:127.0.0.1`), се извлича и се проверява като това, което е. И проверката се прави **два пъти**: при регистриране на URL адреса, за да се предупреди онзи, който регистрира, и отново в `cliente.ts`, **преди всяка връзка**, защото това, към което едно име се е разрешавало в петък, не е задължително да е онова, към което се разрешава в понеделник. Обърни внимание и на това, което отхвърлянето **не** казва: съобщението не съобщава към кой адрес се е разрешило името, за да не даде на нападателя карта на вътрешната мрежа, заявка по заявка. Конкретният адрес, ако е нужен, отива само в дневника на сървъра, където го чете онзи, който управлява `revisor`.
>
> **Изключението за лабораторията.** Лабораторията на този курс живее на `127.0.0.1:18081`, което е loopback, забранен диапазон. Без изключение курсът не би могъл да се упражнява на една-единствена машина. Затова съществува списък с позволени дестинации **по точен адрес и порт**: по подразбиране само `127.0.0.1:18081`, а се променя с променливата на средата `REVISOR_DESTINOS`. Той е точен нарочно: `127.0.0.1:18080`, самият `revisor`, остава забранен. А `localhost:18081` зависи от машината: ако `localhost` се разрешава и към `::1`, както в macOS и в много Linux системи, се отхвърля, защото `[::1]:18081` не е в списъка; ако се разрешава само към `127.0.0.1`, се приема, защото `127.0.0.1:18081` е точно изключението. Тази разлика е още една причина списъкът да е по адрес, а не по име: към какво се разрешава едно име не решава онзи, който пише правилото. В истински `revisor` списъкът би бил празен или би съдържал само най-необходимото, а общото правило (нищо частно) би свършило останалото. Списък с позволеното е по-сигурен от списък със забраненото и OWASP го препоръчва винаги, когато дестинациите са известни; тук не са известни, защото всеки регистрира каквато услуга си иска, и затова двете се комбинират.
>
> **Защо `fetch` не следва пренасочвания.** Ако `cliente.ts` следваше `3xx`, би било достатъчно да се регистрира публична услуга, която отговаря с `301` и `Location: http://169.254.169.254/…`: регистрираният URL би минал проверката, а пренасочването би отвело `revisor` там, където не бива, без да мине през `destinos.ts`. С `redirect: "manual"` `revisor` записва `301` и спира. OWASP и API Top 10 препоръчват същото: да се изключи следването на пренасочвания.
>
> **Ограничението, което остава обявено: DNS rebinding.** Дори с валидиране преди всеки `fetch` остава пролука и е добре тя да се назове. `destinos.ts` разрешава името и одобрява адресите му; после `fetch` **го разрешава отново**, за да се свърже. Между едното разрешаване и другото минават милисекунди и онзи, който контролира DNS на това име, може да отговори с публичен адрес на първия въпрос и с `127.0.0.1` на втория, с време на живот нула секунди, за да не запази никой първия отговор. Това се нарича **DNS rebinding** и е надпревара между проверката и използването. Ръководството на OWASP го казва изрично: второ разрешаване без проверка, между валидирането и свързването, заобикаля тези защити. Пълната защита е **да се свържеш към вече валидирания адрес** и да не разрешаваш името отново: с `http.request` на Node и неговата опция `lookup`, функция, която заменя `dns.lookup` и може да върне точно одобрения IP адрес, докато заглавката `Host` запазва оригиналното име. **Тук валидираме преди всяка връзка, а пълната защита идва в [Урок 8](08-contrato-verificable.md)**, където `cliente.ts` се свързва към вече валидирания IP адрес; дотогава ограничението остава записано в коментара на `destinos.ts`, за да не го смята никой за затворено. И дори с тази защита в продукция е нужен втори слой: мрежа, която не позволява на `revisor` да стигне до метаданните, дори ако опита. Защитата не може да зависи от един-единствен файл.

#### 1.10.1 Кодът

```ts
// fig01_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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

Чете се в реда на функцията `revisarDestino`. Първо се опитва да превърне текста в URL; ако не може, това не е дестинация. После изисква `http:` или `https:`: `file:` или `ftp:` нямат работа в инструмент за проверка на уеб услуги. Изчислява порта (този от URL адреса или подразбиращия се за протокола) и маха квадратните скоби на IPv6 (`[::1]` → `::1`). Функцията `privada` решава дали даден адрес е частен или резервиран и го прави различно за всеки протокол, по причина, която се обяснява по-долу: за IPv4 пита дали попада в `IPV4_PROHIBIDAS`; за IPv6 първо пита дали носи IPv4 вътре (четирите формата от `EMBEBIDAS`, с помощта на `grupos`, която разделя IPv6 на осемте ѝ групи от 16 бита), а ако не, дали е в `IPV6_GLOBAL` и извън `IPV6_PROHIBIDAS`. Ако името вече е адрес, го използва както е; ако не, го разрешава с `lookup(nombre, { all: true })`. Накрая сглобява всяка дестинация като `адрес:порт` и задържа онези, които **не** са в списъка с позволени **и** които `privada` обявява за частни или резервирани. Ако остане някоя, дестинацията се отхвърля. Причината зависи от това как е изписана дестинацията: ако е била адрес, я повтаря, защото това е, което е написал клиентът; ако е било име, казва само, че то се разрешава към частен или резервиран адрес, без да казва към кои.

**Едно дизайнерско решение: черен списък за IPv4, бял списък за IPv6.** Има два начина да се напише правилото. **Черният списък** назовава забраненото и приема всичко останало; **белият списък** назовава позволеното и отхвърля всичко останало. Белият списък е по-сигурен, защото онова, което си забравил да назовеш, остава отвън, а не вътре. Но може да се напише само ако позволеното се побира в няколко реда, а тук двата протокола са различни.

При **IPv6** се побира в един. Целият глобален unicast на интернет живее в един-единствен блок, `2000::/3`, който [регистърът на адресното пространство на IPv6 на IANA](https://www.iana.org/assignments/ipv6-address-space/) отбелязва като *Global Unicast*. Правилото се чете така, както се казва: „позволен е само интернет“. С него наведнъж остават отвън, без да бъдат назовавани, loopback адресът `::1`, неопределеният адрес `::`, уникалните локални `fc00::/7`, link-local `fe80::/10`, multicast `ff00::/8` и всеки специален блок, който бъде добавен утре извън `2000::/3`. Вътре в този блок има няколко, които не са от интернет, и те се назовават в `IPV6_PROHIBIDAS`: `2001::/23` (протоколи на IETF, сред тях Teredo), `2001:db8::/32` и `3fff::/20` (документация) и `5f00::/16` (*segment routing*).

При **IPv4** не се побира. Не съществува „глобален“ блок, който да може да се приеме изцяло: глобалното е „всичко без специалните“, а бял списък за IPv4 би бил същият черен списък, написан наобратно. Затова `IPV4_PROHIBIDAS` е черен списък, копиран ред по ред от [регистъра на IPv4 адресите със специално предназначение на IANA](https://www.iana.org/assignments/iana-ipv4-special-registry/), с името на всеки блок в коментара му, за да може да се одитира чрез сравнение с регистъра:

| IPv4 блок | Какво е | Къде е дефиниран |
|---|---|---|
| `0.0.0.0/8` | „тази мрежа“ | [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html), основа на регистъра със специално предназначение |
| `10/8`, `172.16/12`, `192.168/16` | частни мрежи | [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) |
| `100.64/10` | споделено пространство или *CGNAT* (*Carrier-Grade NAT*: транслирането на адреси, с което доставчик на интернет разпределя един и същ публичен адрес между много клиенти); на `100.100.100.200` Alibaba Cloud публикува своите метаданни | [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) |
| `127/8` | loopback, самата машина | RFC 6890 |
| `169.254/16` | link-local; на `169.254.169.254` AWS и други облаци публикуват своите метаданни | [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) |
| `192.0.0.0/24` | протоколни присвоявания на IETF | регистър на IANA |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | документация (TEST-NET-1, 2 и 3) | регистър на IANA |
| `192.88.99.0/24` | старото реле на 6to4, вече изведено от употреба | регистър на IANA |
| `198.18.0.0/15` | тестове за производителност | регистър на IANA |
| `224/4` | multicast, адрес, който стига до група машини | [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) |
| `240/4` | резервиран, включително broadcast адресът `255.255.255.255` | регистър на IANA |

Списъкът блокира малко повече, нарочно: `192.0.0.0/24` и `2001::/23` се отхвърлят изцяло, макар регистърът да отбелязва като глобални някои отделни адреси вътре в тях. Това са адреси на протоколи на самата мрежа, а не уеб услуги, които някой би искал да наблюдава, а правило от един ред се проверява по-лесно от изключение за всеки адрес.

**IPv4, който пътува вътре в IPv6.** Четири формата на IPv6 носят IPv4 вътре и при четирите важното е този IPv4, затова `destinos.ts` го извлича и го преценява със списъка за IPv4, **преди** белия списък:

| IPv6 формат | Къде е IPv4 | Пример |
|---|---|---|
| `::ffff:0:0/96`, **мапнат** IPv4 ([RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html)) | в последните 32 бита | `[::ffff:127.0.0.1]` е `127.0.0.1` |
| `::/96`, **съвместим** IPv4, остарял (RFC 4291) | в последните 32 бита | `[::7f00:1]` е `127.0.0.1`; `::1` и `::` дават `0.0.0.1` и `0.0.0.0` |
| `64:ff9b::/96`, **NAT64** ([RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html)) | в последните 32 бита | `[64:ff9b::a9fe:a9fe]` е `169.254.169.254` |
| `2002::/16`, **6to4** ([RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html)) | в битове от 16 до 47 | `[2002:a9fe:a9fe::]` е `169.254.169.254` |

Редът е важен. 6to4 живее вътре в `2000::/3`, а NAT64 — извън него, и двата имат легитимни публични адреси: `[64:ff9b::808:808]` и `[2002:808:808::1]` носят вътре `8.8.8.8`, публичен адрес, и трябва да минат; същите форми с частен IPv4 вътре трябва да бъдат отхвърлени. Нито белият списък сам по себе си, нито блокирането на целия префикс различават двата случая. Извличането на IPv4 и преценяването му — да.

Това не е изчерпателно правило за всичко, което не е публично, но покрива онова, което [ръководството на OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) поставя в минималния си списък, а частта, която расте най-бързо, тази за IPv6, се затваря сама. Това, че правилото се побира на един екран и се одитира спрямо публичен регистър, е част от защитата: правило, което никой не разбира, е правило, което никой не проверява. А това, че никога няма да е съвършено, е причината за втория слой, този на мрежата.

#### 1.10.2 Изпълненията с отхвърляне

Опитай да регистрираш адреса на метаданните на облака:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"metadatos","url":"http://169.254.169.254/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 169.254.169.254:80: dirección privada o reservada
```

`400`, с причината: `169.254.169.254:80` е частен или резервиран адрес. `revisor` не го регистрира и никога няма да се свърже с него. Сега име, което не изглежда опасно и сочи към самия `revisor`:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"yo-mismo","url":"http://localhost:18080/mantenimiento"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 75
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: localhost resuelve a una dirección privada o reservada
```

Същият `400`, с причина, която казва по-малко от предишната, нарочно. В първия случай адресът е написан от онзи, който е направил заявката, и повтарянето му не го учи на нищо ново. Във втория онзи, който го е написал, знае само **името**; адресите, към които то се е разрешило, са информация за мрежата на `revisor` и съобщението не ги съобщава. В macOS `localhost` се разрешава към два адреса, `::1` и `127.0.0.1`, и двата loopback; в Linux, в зависимост от това как е настроен `/etc/hosts`, може да се разрешава само към `127.0.0.1`. Отговорът, който получава клиентът, е идентичен в двете системи и това е още едно предимство на неизброяването: това, което казва API-то, не зависи от операционната система на сървъра.

И адресът на метаданните на друг облак, който попада в споделеното пространство:

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"metadatos-2","url":"http://100.100.100.200/latest/meta-data/"}'
HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 70
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5

destino prohibido: 100.100.100.200:80: dirección privada o reservada
```

Накрая двете страни на 6to4. `2002:a00:1::1` носи в битовете си от 16 до 47 групите `0a00` и `0001`, тоест `10.0.0.1`, частна мрежа; `2002:808:808::1` носи `0808` и `0808`, тоест `8.8.8.8`, публичен адрес:

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-1","url":"http://[2002:a00:1::1]/"}'
destino prohibido: [2002:a00:1::1]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-2","url":"http://[2002:808:808::1]/"}'
{"id":4,"nombre":"tunel-2","url":"http://[2002:808:808::1]/","limite_ms":2000}
 → 201
```

Първият се отхвърля заради онова, което носи вътре, макар да е в `2000::/3`; вторият се приема, макар правило, което блокира целия 6to4, да би го отхвърлило. Регистрацията на втория създаде услуга 4, но `revisor` не се свърза с нищо: първата връзка би се осъществила при първата инспекция, а преди нея дестинацията се проверява отново.

Ако онзи, който управлява `revisor`, се нуждае от конкретните адреси, за да разследва отхвърляне, мястото за тях е дневникът на сървъра, никога отговорът. `revisor` на курса не ги записва никъде: коментарът в `destinos.ts` казва къде биха отишли, а терминалът му не показва нищо повече от обичайния `POST /servicios`, за да бъде изпълнението еднакво във всяка система.

#### 1.10.3 Втората проверка, преди свързване

Първата проверка вече я видя. Втората е в първия ред на `revisar`, в `cliente.ts`, и се вижда, когато правилото се промени между регистрацията и инспекцията. Трите стартови услуги се записват директно в хранилището, без да минават през регистрацията, така че е достатъчно да стартираш `revisor` със списък с позволени, който **не** включва лабораторията. Спри `revisor` и го стартирай така (`9` е произволен порт, на който няма нищо):

```text
$ REVISOR_DESTINOS=127.0.0.1:9 node servidor.ts
revisor en http://127.0.0.1:18080
```

И поискай инспекция на `catalogo` с програмата от 1.6.4:

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"CAIDO","codigo":null,"ms":null,"detalle":"destino prohibido: 127.0.0.1:18081: dirección privada o reservada"}
```

Услугата беше регистрирана, инспекцията беше приета със своя `202` и проследяването ѝ работеше, но `revisor` **не се свърза**: преди да го направи, провери отново дестинацията, а `127.0.0.1:18081` вече не беше позволен. Резултатът е `CAIDO`, без код и без милисекунди, защото не е имало разговор, а подробността казва защо. В реална система между регистрацията и инспекцията се променя не списъкът с позволени, а онова, което DNS отговаря за дадено име; ефектът е същият и това е причината за двойната проверка. Спри `revisor` и го стартирай отново без променливата.

### 1.11 Проверка на типовете с `tsc` (по избор)

Както в Урок 0, Node изпълнява програмите, без да проверява типовете, а курсът ги проверява с `tsc` в строг режим. От този урок нататък е нужна още една опция, `--allowImportingTsExtensions`, защото файловете на `revisor` се импортират взаимно с разширението `.ts`; с `--noEmit` TypeScript го позволява. В `~/curso-http/revisor/`:

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Ако всичко е наред, `tsc` не отпечатва нищо и завършва с код 0, което се получи с десетте файла от този урок (деветте на `revisor` и `fig01_02.ts`).

## Грешката, която ще видиш

**Регистрацията, която се загуби без грешка.** Това е грешката от сцената в началото и сега ще я предизвикаш. Изпрати същата регистрация към двата стари маршрута, но този път с `-L`, за да може `curl` да последва пренасочването, както би го направила една програма. Без `-X POST`: `-d` вече предполага `POST` и така би постъпил всеки клиент. Ако идваш от 1.10.3, вече си стартирал `revisor` отново без променливата, така че той има трите си стартови услуги. Първо маршрутът, който се премести с `301`:

```text
$ curl -i -L http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 275
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

Два отговора. Първият е `301`. Вторият е `200` със списъка с услуги, а `avisos` го няма в него. Прочети терминала на `revisor`, който е единственият, разказващ какво се е случило:

```text
POST /viejo/servicios
GET /servicios
```

`curl` последва `301`, както позволява RFC 9110 и както казва ръководството му: превърна `POST` в `GET` и изхвърли тялото. `revisor` получи справка, отговори със списъка и честен `200`, и никой не излъга на нито една стъпка. За онзи, който е изпратил регистрацията, резултатът е `200` и услуга, която не съществува. Сега маршрутът, който се премести с `308`:

```text
$ curl -i -L http://127.0.0.1:18080/api/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 308 Permanent Redirect
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-aacab17b"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

`308`, а после `201` с `Location: /servicios/4`. Терминалът на `revisor`:

```text
POST /api/servicios
POST /servicios
```

`POST` пристигна като `POST`, с тялото си, и регистрацията се случи. За да го провериш по най-простия начин, поискай списъка:

```text
$ curl -i http://127.0.0.1:18080/servicios
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 361
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicios":[{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":2,"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/503","limite_ms":2000},{"id":3,"nombre":"nomina","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000},{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}]}
```

`avisos` е услуга 4. Тази от `301` не съществува никъде.

**Какво не е наред и как се поправя.** Не са виновни нито `curl`, нито `revisor`, нито човекът, който е регистрирал: всеки е направил онова, което спецификацията му позволява. Сгрешен е **изборът на код** за маршрут, който получава записи. Поправката е да се избере `308` (или `307`, ако преместването е временно) за всеки стар маршрут, който може да получи нещо различно от `GET` или `HEAD`. А от страната на клиента има също толкова полезен урок: програма, която пише, не би трябвало да следва пренасочвания на сляпо. Ако получи `301` на `POST`, правилното е да предупреди и да обнови конфигурирания адрес, а не да го последва; [Урок 7](07-quien-lee-el-error.md) поставя това решение в таблицата на клиента. `curl` има опция за запазване на `POST` след `301`, `--post301`, и упражнение 2 те кара да я изпробваш; тя съществува именно защото превръщането е поведението по подразбиране. Това е опция на `curl` и на още малко клиенти: `fetch`, например, няма еквивалентна и превръща `POST` в `GET` след `301` по спецификация, така че това не се поправя от страната на клиента. Истинската поправка е на сървъра: да избере кода, който не оставя място за съмнение.

**Капан при възпроизвеждането: `-X POST` с `-L`.** Ако по навик напишеш `-X POST` освен `-d`, резултатът е друг и не се разбира от пръв поглед:

```text
$ curl -i -X POST -L http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Content-Length: 21
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el cuerpo no es JSON
```

`-X` не казва на `curl` „първата заявка е `POST`“, а „използвай `POST` във **всички** заявки“, включително в тази след пренасочването. Ръководството на `curl` предупреждава за това: с `-L` методът от `-X` се използва във всяка заявка и може да има ефекти, които не си очаквал. `curl` последва `301` с `POST`, но приложи другата половина от правилото за пренасочванията и не изпрати тялото. `revisor` получи празен `POST /servicios` и отговори с `400 el cuerpo no es JSON`: нито дефектът се възпроизвежда, нито се създава нещо. (Без `-sS` `curl` освен това може да отпечата бележка, че `-X` е излишно.) За да видиш дефекта така, както би го видяла една програма, остави `-d` да реши метода.

**Методът, който не съществува, отговаря с `404`.** Другата грешка в този урок е нарочният дефект. Поискай метод, който маршрутът не поддържа:

```text
$ curl -i -X PATCH http://127.0.0.1:18080/servicios/1
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 19
Date: Wed, 21 Oct 2026 13:17:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe esa ruta
```

Маршрутът `/servicios/1` съществува: с `GET` отговаря. С `PATCH` `revisor` казва „no existe esa ruta“, което е невярно. Правилният код е `405 Method Not Allowed`, със заглавката `Allow`, която изброява методите, които се поддържат, а Урок 0 те научи, че `Allow` е задължителна в `405`. Клиент, който получи този `404`, заключава, че е сбъркал адреса, когато е сбъркал метода. Поправя се, като `atender` започне да различава двата случая, и това е първото, което прави Урок 2.

## Какво се прави погрешно

**Да се отговаря с `200` на всичко, което е минало добре.** Регистрация с `200` оставя клиента без `Location`; операция, която тепърва започва, с `200` го кара да повярва, че вече е приключила; премахване с `200` и `{"ok": true}` го задължава да прочете тяло, което не казва нищо, което кодът да не е казал. Четирите успешни отговора от този урок съществуват, за да знае клиентът какво да прави, без да чете тялото.

**`201` без `Location`.** RFC позволява да се пропусне и тогава създаденият ресурс е самият път на заявката. При регистрация към `/servicios` това е невярно: услугата не живее там. Клиентът трябва да отгатне `id` в тялото, с име на поле, което се променя от API на API.

**`202` без място, където да се пита.** Да отговориш с `202` и да не дадеш ресурс за проследяване оставя клиента с две лоши възможности: да повярва, че операцията се е случила, или да я повтори. Ако `202` не носи `Location`, нито тяло, което казва как да се проследи, липсва половината от отговора.

**Проверка на проследяването без пауза.** Клиентът, който пита пет хиляди пъти в секунда „приключи ли?“, превръща една асинхронна операция в атака срещу самия сървър. `Retry-After` съществува за това; ако липсва, клиентът слага минимална пауза.

**`301` на маршрут, който получава записи.** Това е грешката на този урок: `POST` става `GET` и тялото се изхвърля, без грешка. За маршрути, които получават записи — `308`.

**Тяло в `204` или `304`.** RFC казва, че не могат да го носят. Впрочем Node не изпраща тяло в тези два кода, дори да го напишеш, но други сървъри го правят и тогава клиентът чете това тяло като началото на следващия отговор: разговорът се разминава и отговорите стигат до онзи, който не ги е искал. Това е едно от малкото нарушения на спецификацията, което не просто е грозно, а поврежда връзката.

**`304` без `ETag`.** RFC задължава в `304` да се изпращат заглавките, които би изпратил `200`, сред тях `ETag`. Без нея клиентът няма как да потвърди, че копието му е актуалното.

**Свързване към дадения ти URL, без да провериш накъде води.** Това е входната точка на SSRF. Проверката на текста на URL адреса не е достатъчна: трябва да се проверят адресите, към които той се разрешава, преди всяка връзка, и да не се следват пренасочвания.

## Упражнения

И четирите се проверяват сами: всяко завършва с изпълнение, което ти казва дали си познал. Запиши своята прогноза в [дневника](bitacora.md) **преди** да изпълниш каквото и да е. Стартирай отново лабораторията и `revisor` **само веднъж**, преди упражнение 1, и направи четирите поред: номерата на услугите в решенията предполагат този ред.

### Упражнение 1 — Четири условия

Поискай `GET /servicios/1` с `curl -i` и запиши неговия `ETag`; в решението той е `"1-1-0e296858"`, а твоят завършва различно. Предвиди с какъв код ще отговори `revisor` на всяка от тези заявки:

1. `GET /servicios/1` с `If-None-Match: "1-1"`, етикетът, написан ръчно, без идентификатора на стартирането.
2. `GET /servicios/1` с `If-None-Match: W/`, последвано от твоя етикет.
3. `GET /servicios/1` с `If-None-Match: "9-9-00000000", W/"8-8-00000000"`.
4. `GET /servicios/99` с `If-None-Match: *`.

Изпълни четирите с `curl -s -o /dev/null -w '%{http_code}\n'`, последвано от адреса и от `-H 'If-None-Match: …'`, и сравни.

### Упражнение 2 — Запазване на `POST` след `301`

Разделът „Грешката, която ще видиш“ казва, че `curl` има опция, `--post301`, която запазва `POST` при следване на `301`. Предвиди с какво ще отговори тази заявка, колко реда на състоянието ще видиш и какво ще запише терминалът на `revisor`:

```bash
curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
```

Изпълни командата и сравни. После отговори: щом `curl` може да го направи, защо разделът казва, че поправката е да се смени кодът, а не да се иска от всеки клиент да използва тази опция?

### Упражнение 3 — Пет дестинации

Предвиди кои от тези URL адреси приема регистрацията на `revisor` и, за отхвърлените, какво казва причината (всички са изписани като адреси, освен последния, така че причината назовава адреса):

1. `http://2130706433:18081/codigo/200`
2. `http://2130706433:18080/servicios`
3. `http://[::ffff:127.0.0.1]:18081/codigo/200`
4. `http://[64:ff9b::a9fe:a9fe]/`
5. `http://example.com/`

За всеки изпрати регистрация с различно име (`d1` до `d5`) и гледай само тялото и кода, с `curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"…"}'`. Петият изисква машината ти да има достъп до интернет, за да разреши името.

### Упражнение 4 — Проследяването на инспекция, която не приключва

Копирай `fig01_02.ts` като `ej4.ts` и смени горната граница от десет проверки на две (`consulta <= 2`). Предвиди какво ще отпечата `node ej4.ts 2` и с какъв код ще завърши (`echo $?`). После изпълни. Различава ли програмата „инспекцията приключи“ от „омръзна ми да питам“? Ако не, какво ѝ липсва?

## Решения

### Решение 1

```text
$ curl -i http://127.0.0.1:18080/servicios/1
HTTP/1.1 200 OK
ETag: "1-1-0e296858"
Content-Type: application/json
Content-Length: 88
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1"'
200
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-0e296858"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", W/"8-8-00000000"'
200
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/99 -H 'If-None-Match: *'
404
```

`200`, `304`, `200` и `404`. Първият не съвпада, защото етикетът е непрозрачен: `"1-1"` не е част от `"1-1-0e296858"`, а друг етикет, и сравнението е на целия текст в кавичките. (Преди рестартиране това е точно етикетът, който би дал на клиента грешно копие; затова е идентификаторът на стартирането.) Вторият съвпада, защото `If-None-Match` сравнява слабо и `W/` не се брои. Третият е валиден списък, в който **нито един** етикет не съвпада, и сървърът отговаря изцяло. Четвъртият е капанът: `*` означава „която и да е версия, която имаш“, но услуга 99 не съществува, така че няма версия за потвърждаване; `revisor` я търси, преди да погледне условието, и отговаря с `404`. Един `304` там би потвърдил на клиента копие на нещо, което не съществува.

### Решение 2

```text
$ curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
HTTP/1.1 301 Moved Permanently
Location: /servicios
Content-Length: 0
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 201 Created
Location: /servicios/4
ETag: "4-1-0e296858"
Content-Type: application/json
Content-Length: 86
Date: Wed, 21 Oct 2026 13:17:42 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200","limite_ms":2000}
```

Два реда на състоянието: `301` и `201`. В терминала на `revisor` — `POST /viejo/servicios` и после `POST /servicios`: с `--post301` `curl` повтори `POST` с тялото му на новия адрес и регистрацията се случи, с id 4, защото е първата регистрация при това стартиране. Опцията съществува, но поправката остава кодът, по практическа причина: ти контролираш своя сървър, а не контролираш клиентите. Можеш да сложиш `--post301` в своите скриптове, но не и в програмата на онзи, който използва твоето API, нито в неговата HTTP библиотека, нито във `fetch` на неговия браузър, който според стандарта Fetch превръща `POST` в `GET` и няма опция, която да го предотврати. `308` работи еднакво с всички тях, без да иска нищо от никого.

### Решение 3

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"http://2130706433:18081/codigo/200"}'
{"id":5,"nombre":"d1","url":"http://2130706433:18081/codigo/200","limite_ms":2000}
 → 201
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d2","url":"http://2130706433:18080/servicios"}'
destino prohibido: 127.0.0.1:18080: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d3","url":"http://[::ffff:127.0.0.1]:18081/codigo/200"}'
destino prohibido: [::ffff:7f00:1]:18081: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d4","url":"http://[64:ff9b::a9fe:a9fe]/"}'
destino prohibido: [64:ff9b::a9fe:a9fe]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d5","url":"http://example.com/"}'
{"id":6,"nombre":"d5","url":"http://example.com/","limite_ms":2000}
 → 201
```

Два се приемат и три се отхвърлят, а първият е капанът. `http://2130706433:18081/` **се приема**: анализаторът на URL превръща `2130706433` в `127.0.0.1`, а `127.0.0.1:18081` е точно изключението за лабораторията. Защитата не се подведе от странната форма; напротив, видя накъде всъщност води, а тази дестинация е позволена. С порт 18080 се отхвърля и причината казва `127.0.0.1:18080`, а не `2130706433`: `revisor` преценява нормализирания адрес. Третият също е loopback, изписан като мапнат IPv4: анализаторът го нормализира до `::ffff:7f00:1`, който не е в списъка с позволени (списъкът сравнява точни текстове), а `destinos.ts` извлича `127.0.0.1` отвътре и го разпознава като loopback. Четвъртият е IPv4 адресът `169.254.169.254`, скрит в префикса на NAT64: в мрежа с NAT64 би водил към метаданните и се отхвърля заради онова, което носи вътре. Петият се разрешава към публични адреси и се приема (ако машината ти няма достъп до интернет, се отхвърля с „no se pudo resolver“, и това е правилното поведение: онова, което не може да се разреши, не може да се провери). Нито една регистрация не направи връзка: приемането на дестинацията само я записва; първата връзка се осъществява при първата инспекция, а преди нея се прави нова проверка.

### Решение 4

```text
$ node ej4.ts 2; echo $?
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 pendiente, Retry-After: 1
0
```

С две проверки програмата никога не видя `terminada`, отпечата двата реда с `pendiente`, излезе от цикъла, без да каже нищо, и завърши с код 0, същия като ако всичко беше минало добре. (Втората проверка пристига секунда след първата, а инспекцията чака една секунда в опашката: това е надпревара от милисекунди. Ако при твоето изпълнение втората проверка вече я е намерила приключила, надпреварата е спечелила инспекцията; сложи горната граница на една проверка и ще видиш същия дефект.) Това е дефектът от упражнението: програмата не различава „приключи“ от „спрях да питам“. Липсва ѝ ред след цикъла, който, ако тя никога не е видяла `terminada`, да го каже и да излезе с код, различен от нула, например `console.log("la revisión no terminó a tiempo"); process.exit(1);`, а за това трябва да се запомни в променлива дали е приключила. Това е същият принцип от Урок 0, от страната на клиента: кодът на излизане също е контракт, а `0`, който не означава успех, заблуждава скрипта, който го чете, точно както `200` с грешка вътре.

## Как разбирам, че съм успял

- [ ] С работещи лаборатория и `revisor` `curl -i http://127.0.0.1:18080/servicios` дава `200` с трите стартови услуги.
- [ ] Регистрацията от 1.5.2 дава `201` с `Location: /servicios/4` и `ETag` с формата `"4-1-`, последвано от осем шестнайсетични цифри, и обясняваш какво идентифицира всяка заглавка и всяка част от етикета.
- [ ] `-d 'null'` дава `400` с „el cuerpo no es un objeto JSON“, а следващата заявка отговаря с `200`.
- [ ] Искането на инспекция дава `202` с `Location: /revisiones/1`; проверката ѝ веднага след това дава `200` с `"pendiente"` и `Retry-After: 1`, а две секунди по-късно — `"terminada"`. Обясняваш защо първият код е `202`, а вторият `200`.
- [ ] `node fig01_02.ts 1` следи инспекцията до `ARRIBA`, като спазва `Retry-After`, в две или три проверки.
- [ ] Премахването на услуга 4 дава `204` без `Content-Type` и без `Content-Length`; искането ѝ след това дава `404` и обясняваш защо `DELETE` остава идемпотентен.
- [ ] `GET /servicios/1` с `If-None-Match` и етикета, който ти е дал `revisor`, дава `304` с `ETag` и без тяло; с `W/` отпред, в списък или с `*` — също. Знаеш какви заглавки трябва да носи `304` според RFC 9110.
- [ ] След рестартиране на `revisor` предишният етикет дава `200` с нов етикет и обясняваш защо това предотвратява фалшив `304`.
- [ ] С `curl -L` регистрацията към `/viejo/servicios` завършва с `200` със списъка, а терминалът на `revisor` казва `GET /servicios`; регистрацията към `/api/servicios` завършва с `201`, а терминалът казва `POST /servicios`.
- [ ] Регистрациите от карето дават `400` с „destino prohibido“ и обясняваш в кой случай `localhost:18081` се отхвърля и в кой се приема, макар `127.0.0.1:18081` винаги да се приема.
- [ ] Обясняваш какво е DNS rebinding, защо валидирането преди всяка връзка не го затваря напълно и какво прави пълната защита, която идва в Урок 8.
- [ ] При завършване не остава програма, която слуша: `curl -i http://127.0.0.1:18080/` и `curl -i http://127.0.0.1:18081/` дават грешка 7.

## Обобщение

Отговори, без да гледаш урока:

1. Кои три въпроса разделят `200`, `201`, `202` и `204`?
2. Какво идентифицира `Location` в `201`? А в `202`? А в `301`?
3. Защо `202` би трябвало да сочи към ресурс за проследяване според RFC 9110? С какъв код отговаря този ресурс, докато операцията чака?
4. Защо вторият `DELETE` на същата услуга отговаря с `404`, а методът остава идемпотентен?
5. Какво е `ETag`, за какво служи `If-None-Match` и защо `304` не носи тяло? Защо етикетът на `revisor` се променя при всяко стартиране?
6. Какво се случва с `POST`, който получи `301` и бъде последван от `curl -L`? А с такъв, който получи `308`? Защо съществува тази разлика?
7. Какво е SSRF, защо `revisor` го носи по рождение и защо проверява дестинацията два пъти?
8. Какво е DNS rebinding, какво прави `revisor` от този урок срещу него и как се затваря напълно?

## Източници

Всички бяха консултирани на 21 октомври 2026 г.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), раздели 15.3.1, 15.3.2, 15.3.3 и 15.3.5: `200`, `201`, `202` и `204`; съдържанието на `200` според метода, `Location` и валидаторите на `201`, „умишлено уклончивият“ `202` с неговия монитор на състоянието и `204`, който не може да носи тяло.
2. [RFC 9110, раздел 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4), и раздели 15.4.2, 15.4.5 и 15.4.9: историята на `POST`, превърнат в `GET`, `301`, `304` със заглавките, които трябва да генерира, и `308`.
3. [RFC 9110, раздели 9.2.2, 9.3.3 и 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2): идемпотентните методи, `201` с `Location` за `POST`, който създава, и трите възможни отговора на успешен `DELETE`.
4. [RFC 9110, раздели 8.6, 8.8.1, 8.8.3, 8.8.3.1 и 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3): `Content-Length` в `204` и `304`; силният етикет не се преизползва за друго представяне; `ETag` като непрозрачен текст в кавички и примерът му с номер на ревизия; силното и слабото сравнение.
5. [RFC 9110, раздели 10.2.2, 10.2.3 и 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2): `Location` като относителна препратка, `Retry-After` и оценяването на `If-None-Match` (`*` или списък, слабо сравнение, `304` за `GET` и `HEAD`, `412` за останалото).
6. [RFC 7538, *The Hypertext Transfer Protocol Status Code 308 (Permanent Redirect)*](https://www.rfc-editor.org/rfc/rfc7538.html), април 2015 г., който направи стандарт `308` от [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) (юни 2014 г., експериментален), и предпазната мярка по отношение на клиентите, които не го познават (раздел 4).
7. [Стандарт Fetch, WHATWG](https://fetch.spec.whatwg.org/#http-redirect-fetch), алгоритъм *HTTP-redirect fetch*: след `301` или `302` на `POST` методът става `GET`, а тялото се изхвърля.
8. [Ръководство за `curl`](https://curl.se/docs/manpage.html): `-L` и превръщането на `POST` в `GET` след `301`, `302` и `303`; `--post301`; `-d` и `-X`. Прочетено е и в `man curl` на версия 8.7.1.
9. [OWASP API Security Top 10, издание 2023: API7:2023 Server Side Request Forgery](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/): дефиницията на SSRF, защо *webhooks* и визуализациите на връзки го правят често срещано, и препоръката да се изключат пренасочванията и да се използват списъци с позволеното.
10. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): метаданните на облака като цел, минималният списък с диапазони (с multicast), алтернативните кодирания на IPv4, DNS rebinding и свързването към вече валидирания адрес.
11. [AWS, *Use the Instance Metadata Service to access instance metadata*](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) и [Alibaba Cloud, *View instance metadata*](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata): адресите `169.254.169.254` (и `[fd00:ec2::254]`) и `100.100.100.200` на техните услуги за метаданни.
12. [Стандарт URL, WHATWG](https://url.spec.whatwg.org/#concept-ipv4-parser), анализаторът на IPv4: приема адрес, изписан като едно число, в шестнайсетичен или осмичен вид, и го нормализира.
13. Блоковете в `destinos.ts`: регистрите на адресите със специално предназначение на IANA, [IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) и [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/), и [адресното пространство на IPv6](https://www.iana.org/assignments/ipv6-address-space/) (`2000::/3`, *Global Unicast*); [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) (частни мрежи), [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) (link-local `169.254/16`), [RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html) (link-local, multicast и IPv4, мапнат в IPv6), [RFC 4193](https://www.rfc-editor.org/rfc/rfc4193.html) (уникални локални адреси), [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) (IPv4 multicast), [RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html) (префиксът на NAT64), [RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html) (6to4, февруари 2001 г.), [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) (споделено пространство `100.64/10`) и [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html) (регистърът на адресите със специално предназначение).
14. [Node.js 24: DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), [Node.js 24: Net](https://nodejs.org/docs/latest-v24.x/api/net.html) и [Node.js 24: HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): `dns.lookup` с `all: true` и използването на системното разрешаване, `net.BlockList` и IPv4, изписани като IPv6, и опцията `lookup` на `http.request`.

### Термини от този урок

| | |
|---|---|
| **DNS rebinding** | промяна на това, към което се разрешава едно име, между проверката и свързването, така че сървърът да се свърже към адрес, който не е бил проверен |
| **слабо сравнение** | това, което използва `If-None-Match`: два етикета съвпадат, ако текстът им в кавичките е еднакъв, със или без `W/` |
| **`ETag`** (*entity tag*) | непрозрачен етикет в кавички, който идентифицира версия на ресурс |
| **идентификатор на стартирането** | осемте случайни цифри, които `revisor` генерира при стартиране и добавя към всеки етикет, за да не се повтарят етикетите след рестартиране |
| **идемпотентен** | метод, чийто ефект върху сървъра е същият, ако бъде повторен, както ако бъде изпълнен веднъж |
| **бял списък / черен списък** | правило, което назовава позволеното и отхвърля останалото, или което назовава забраненото и приема останалото |
| **loopback** | адресите на самата машина: `127.0.0.0/8` и `::1` |
| **метаданни на облака** | услугата на `169.254.169.254`, където облакът публикува данни за машината, понякога с идентификационни данни |
| **условна заявка** | заявка, която иска да бъде изпълнена само ако е изпълнено условие за версията на ресурса, като `If-None-Match` |
| **ресурс за проследяване** | ресурсът, към който сочи `202`, където клиентът пита как върви операцията |
| **относителна препратка** | адрес без сървър и порт, като `/servicios/4`, който се допълва с този на заявката |
| **SSRF** | постигане на това сървър да направи заявка, избрана от друг човек, от мрежата на сървъра |

---

**Следващ:** [Урок 2 — Клиентът сгреши (I): 400, 401, 403, 404, 405 и 415](02-errores-del-cliente-peticion.md)

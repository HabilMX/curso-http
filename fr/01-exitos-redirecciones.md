# Leçon 1 — Succès et redirections : 200, 201, 202, 204, 301, 308 et 304

Il est 11 h 20 un mardi et à 12 h 00 il y a un point avec l'équipe d'exploitation. La question qu'ils vont poser est simple : pourquoi le `revisor` n'a-t-il pas surveillé le service de facturation pendant le week-end, si vendredi quelqu'un l'a enregistré ? Celui qui l'a enregistré jure qu'il l'a fait. Il a la capture d'écran de son terminal : il a envoyé l'enregistrement et a reçu un `200 OK`. Tu ouvres la liste des services du `revisor` et celui de facturation n'y est pas. Tu ouvres le journal du serveur et sa requête est bien là, complète, à 18 h 42 le vendredi. Sauf que le journal ne dit pas `POST /servicios`. Il dit `POST /viejo/servicios` et, juste en dessous, `GET /servicios`. Jeudi, quelqu'un a migré les anciennes routes avec une redirection. Son programme l'a suivie, comme il se devait. Et en chemin, sans la moindre erreur, l'enregistrement s'est transformé en consultation. Il reste quarante minutes pour expliquer pourquoi un `200` ne signifiait pas ce que tout le monde croyait.

Cette leçon traite des réponses qui disent « tout s'est bien passé » et de celles qui disent « c'est ailleurs » : ce que chacune promet, quels en-têtes l'accompagnent et laquelle d'entre elles peut perdre un `POST` sans prévenir.

**Durée :** 2 × 45 min (la coupure se situe entre les sections 1.5 et 1.6)

**Ce que tu construis :** la première version du **`revisor`** en tant que serveur : les routes qui enregistrent, consultent et retirent des services, celle qui demande une vérification et celle qui permet de la suivre, les anciennes routes qui sont redirigées, et la première défense pour éviter que quelqu'un utilise le `revisor` pour atteindre un endroit où il ne devrait pas aller. De plus, le **laboratoire** : le banc d'essai de la Leçon 0 sur le port 18081, avec les services que le `revisor` consulte

**Ce que tu apprends :** choisir entre renvoyer (`200`), créer (`201`), accepter (`202`) et ne rien renvoyer (`204`) ; à quoi sert `Location` dans un `201`, dans un `202` et dans une redirection ; **le `202` et sa ressource de suivi** ; ce qui change entre `301` et `308` lorsque la requête est un `POST` ; les requêtes conditionnelles avec `ETag` et `If-None-Match`, et pourquoi un `304` ne porte pas de corps. Et dans un encadré de sécurité, ce qu'est le **SSRF** et pourquoi un programme comme le `revisor` en est le cas d'école

**D'où tu viens.** De la [Leçon 0](00-el-contrato-que-viaja.md) tu apportes Node 24 et le dossier `~/curso-http/`, l'instrument (`curl -i`, `curl -v`, `curl -I`), les cinq familles et la règle du `x00`, ainsi que le banc d'essai `fig00_02.ts`, qui renvoie le code que tu lui demandes sur `/codigo/NNN`. Tu apportes aussi le premier principe du cours : le code fait foi et le corps explique. Il n'y a pas encore de `revisor` : il naît dans cette leçon.

**Ce que cette leçon ne fait pas.** Elle ne demande pas d'identifiants : quiconque atteint le port peut enregistrer et retirer des services, et la [Leçon 2](02-errores-del-cliente-peticion.md) construit le point d'entrée. Elle ne permet pas non plus de modifier un service déjà enregistré ; cela nécessite `If-Match` et fait l'objet de la [Leçon 3](03-errores-del-cliente-estado.md). Les erreurs que tu vas voir ici, un `400`, un `404` et un `413`, constituent un **filet de sécurité** : elles sont là pour que le `revisor` ne réponde pas `200` lorsque quelque chose se passe mal, mais elles sont expliquées en détail dans la Leçon 2, et leur corps est une simple ligne de texte jusqu'à ce que la [Leçon 5](05-problem-details.md) lui donne un format. Et il y a un défaut délibéré : une méthode que la route n'admet pas répond `404` au lieu de `405` ; la section « L'erreur que tu vas voir » le signale et la Leçon 2 le corrige.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sous macOS avec Node 24.14.1 et curl 8.7.1, en ajoutant `-sS` à chaque `curl` parce que la sortie allait vers un fichier (`-s` désactive l'indicateur de progression, `-S` laisse voir les erreurs, et aucune des deux ne modifie la réponse). **Un avertissement sur les ports :** pendant la rédaction de cette leçon, d'autres tests occupaient les ports 18080 et 18081 de la machine, de sorte que les exécutions ont été réalisées avec une copie des programmes identique à l'exception des ports, 18180 et 18181, et dans les sorties reproduites ici, on a réécrit 18080 et 18081, qui sont ceux que tu vas saisir. C'est la seule chose qui a été substituée ; les deux numéros comportant le même nombre de chiffres, aucun `Content-Length` ne change. Dans ton exécution changent en outre la date de `Date`, les millisecondes (`"ms"`) que mesure une vérification et **les étiquettes `ETag`** : le `revisor` tire au sort au démarrage huit chiffres hexadécimaux qui vont à la fin de chaque étiquette (`"4-1-7b2497d9"`), de sorte que les tiennes se termineront différemment, et elles changent à chaque fois que tu le redémarres ; la section 1.8 explique pourquoi. Lorsqu'une commande de la leçon comporte une étiquette, copie celle que t'a donnée ta réponse précédente, pas celle de la leçon. Les exécutions ont été réalisées en suivant la leçon du début à la fin, dans l'ordre, avec les redémarrages là où la leçon les demande, de sorte que les numéros de service et de vérification que tu verras sont ceux que tu obtiendras. Elles n'ont pas été exécutées sur une installation de bureau de Mint. Les programmes se trouvent dans [`programas/01-exitos-redirecciones/`](../programas/01-exitos-redirecciones), dans le dépôt du cours : le `revisor` dans le dossier `fig01_01/` et chaque exécution dans un fichier `.salida.txt`. Tous passent `tsc` en mode strict (la section 1.11 explique comment le vérifier).

## À la fin, tu seras capable de

- Démarrer le `revisor` et son laboratoire, et parcourir avec `curl -i` le cycle complet d'un service : enregistrement, consultation, vérification, retrait.
- Choisir entre `200`, `201`, `202` et `204` pour une opération grâce à trois questions, et justifier ce choix avec la section de la RFC 9110 qui la définit.
- Dire ce qu'identifie `Location` dans un `201`, dans un `202` et dans une redirection, et le vérifier sur une vraie réponse.
- Suivre une opération acceptée avec `202` jusqu'à ce qu'elle se termine, en respectant `Retry-After`, sans marteler le serveur.
- Provoquer un `304` avec `If-None-Match`, expliquer pourquoi il ne porte pas de corps et quels en-têtes il doit obligatoirement porter.
- Démontrer avec `curl -L` qu'un `301` peut transformer un `POST` en un `GET` sans la moindre erreur, et qu'un `308` ne le fait pas.
- Expliquer ce qu'est le SSRF, pourquoi le `revisor` le porte dès sa naissance et quelles défenses il possède, y compris celle qui arrive dans la Leçon 8.

## Le pourquoi avant le comment

Dans la Leçon 0, tu as vu que le code d'état est ce que lisent tous les programmes sur le trajet. Dans les réponses d'erreur, ce contrat est rompu d'une manière qui fait immédiatement mal : un `200` contenant une erreur trompe le cache et le moniteur. Dans les réponses de succès, le dommage est plus sournois, car elles disent toutes « tout s'est bien passé », et la tentation est de répondre `200` tant que rien n'a échoué. Mais les quatre succès de cette leçon ne disent pas la même chose, et quiconque reçoit la réponse fait des choses différentes avec chacun :

- Un **`200`** dit « voici ce que tu as demandé ». Le client utilise le corps.
- Un **`201`** dit « j'ai créé quelque chose de nouveau, et cela vit à cette adresse ». Le client enregistre l'adresse de `Location` pour revenir à cette ressource.
- Un **`202`** dit « je l'ai reçu, mais je ne l'ai pas encore fait ». Le client ne **peut pas** considérer l'opération comme terminée : il doit redemander.
- Un **`204`** dit « c'est fait, et je n'ai rien à te dire ». Le client n'attend pas de corps.

La différence entre le `201` et le `202` est la plus coûteuse à confondre. Si le `revisor` répondait `200` ou `201` à une vérification qui commence à peine, le client croirait que la vérification est déjà terminée et lirait un résultat qui n'existe pas. S'il répondait `200` à un enregistrement, le client n'aurait pas de moyen standard de savoir où se trouve le nouveau service.

Les redirections ont leur propre piège, qui est celui de la scène du début. Déplacer une route est normal : les API grandissent et les noms changent. Mais il y a deux codes pour « ceci a déménagé pour toujours », le `301` et le `308`, et pour des raisons historiques un seul d'entre eux promet que le `POST` restera un `POST` de l'autre côté. Avec l'autre, le client a la permission de le convertir en `GET`, et presque tous le font. L'enregistrement est perdu, la réponse finale est un `200` avec la liste, et personne ne voit d'erreur car il n'y en a eu aucune.

Et le `304` clôt la leçon avec l'idée inverse du `200` : parfois, la meilleure réponse est de **ne rien envoyer**, car le client l'a déjà. C'est pour cela qu'existent les étiquettes (`ETag`) et les requêtes conditionnelles, qui dans la Leçon 3 serviront aussi à quelque chose de bien plus sérieux : éviter que deux personnes qui modifient le même service n'écrasent mutuellement leurs changements.

La leçon comporte cinq parties :

1. **Le `revisor` prend forme** (1.1 à 1.3) : les fichiers, le stockage, les trois façons de répondre et la table de routage.
2. **Renvoyer et créer** (1.4 et 1.5) : `200` et `201`, avec `Location` et `ETag`.
3. **Accepter et ne rien renvoyer** (1.6 et 1.7) : `202` avec sa ressource de suivi, et `204`.
4. **Ne pas envoyer ce que tu as déjà, et déménager** (1.8 et 1.9) : `304` avec `If-None-Match`, et `301` face à `308`.
5. **L'encadré de sécurité** (1.10) : SSRF, l'exception du laboratoire et la limite déclarée.

À la fin de la leçon, cette exécution va te paraître évidente. Ce sont deux requêtes identiques à l'exception de l'ancienne route qu'elles utilisent ; le `revisor` a consigné ceci dans son terminal :

```text
POST /viejo/servicios
GET /servicios
POST /api/servicios
POST /servicios
```

Le premier enregistrement a été perdu. Le second a eu lieu. La seule chose qui a changé est le code de la redirection.

## Les concepts

### 1.1 Le `revisor` prend forme

#### 1.1.1 Neuf fichiers et un dossier

Dès cette leçon, le `revisor` cesse d'être un programme d'un seul fichier. C'est un programme composé de plusieurs fichiers, chacun avec sa propre responsabilité, et il grandit de leçon en leçon : la Leçon 2 lui ajoute le point d'entrée, la 3 la modification de services, la 4 la défense contre les pannes, et ainsi de suite jusqu'à la 8. Les neuf fichiers d'aujourd'hui sont les suivants :

| Fichier | Ce qu'il fait |
|---|---|
| `servidor.ts` | démarre le serveur sur le port 18080 |
| `rutas.ts` | décide quelle fonction prend en charge chaque route et chaque méthode ; c'est ici que vivent les redirections |
| `servicios.ts` | ce que fait chaque route : lister, enregistrer, consulter, retirer, demander et suivre une vérification |
| `almacen.ts` | les services et les vérifications, en mémoire, et l'étiquette (`ETag`) de chaque service |
| `etiquetas.ts` | lire et comparer les étiquettes comme l'exige la RFC 9110 ; la section 1.8 l'utilise |
| `respuestas.ts` | les trois façons de répondre : avec du JSON, sans corps et avec une erreur |
| `cliente.ts` | la face cliente : consulte un service et classe ce qu'il a répondu |
| `destinos.ts` | où le `revisor` peut se connecter ; c'est le sujet de l'encadré de sécurité |
| `laboratorio.ts` | le banc de la Leçon 0 sur le port 18081 : les services que le `revisor` consulte |

Dans le dépôt, ils se trouvent dans le dossier `fig01_01/`, et chaque bloc de code de cette leçon commence par le chemin du fichier (`// fig01_01/servidor.ts`), tout comme dans le cours de TypeScript de Hábil. Tu peux les enregistrer où tu veux ; on suppose ici un dossier `~/curso-http/revisor/` avec son propre `package.json`, le même que celui de la Leçon 0 :

```bash
mkdir -p ~/curso-http/revisor && cd ~/curso-http/revisor
printf '{\n  "type": "module"\n}\n' > package.json
```

Les fichiers s'importent mutuellement avec l'extension `.ts` écrite au complet (`import { atender } from "./rutas.ts"`). C'est ce qu'exige Node lorsqu'il exécute TypeScript en effaçant les types : il ne devine pas les extensions, de la même manière qu'il ne les devine pas pour JavaScript dans un module ESM.

#### 1.1.2 Le serveur

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

C'est presque le serveur de la Leçon 0, avec une différence : il ne prend plus aucune décision. Il reçoit chaque requête et la passe à `atender`, qui vit dans `rutas.ts`, par l'intermédiaire de `atenderSinCaerse`. Le `void` devant l'appel signifie « je sais que cette fonction renvoie une promesse et je choisis délibérément de ne pas l'attendre ici » : le serveur n'a rien à faire lorsque la réponse se termine.

Ce `void` a un coût, et `atenderSinCaerse` existe pour le régler. Une promesse que personne n'attend et qui échoue est une **promesse rejetée non gérée**, et Node, par défaut, met fin au processus lorsqu'il en voit une. Si un gestionnaire contenait une erreur levant une exception, une seule requête ferait planter le `revisor` pour tout le monde. `atenderSinCaerse` enveloppe `atender` dans un `try`/`catch` : si quelque chose s'échappe, il écrit le message dans le terminal, répond `500 error interno` sans donner de détails et le processus reste en vie. C'est un filet, pas une architecture : la [Leçon 4](04-capacidad-y-fallas-del-servidor.md) explique le `500` en profondeur ainsi que ce qu'on y dit et ce qu'on n'y dit pas. Aujourd'hui, il suffit de savoir qu'il est là, et en 1.5.2 tu verras la requête qui aurait fait planter le `revisor` si personne ne l'avait arrêtée avant.

#### 1.1.3 Le laboratoire

Le `revisor` surveille des services, et pour pratiquer, il est nécessaire d'avoir des services à surveiller. Le laboratoire est le banc d'essai de la Leçon 0 sans modification de fond : la même table de noms, les mêmes en-têtes par code, les trois mêmes verrous. Seuls changent le port, 18081, pour cohabiter avec le `revisor` sur le 18080, et le message de démarrage :

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

Les trois services avec lesquels démarre le `revisor` pointent ici : `catalogo` vers `/codigo/200`, `pagos` vers `/codigo/503` et `nomina` vers `/codigo/200`. Si tu souhaites qu'un service soit « en panne », nul besoin de toucher à quoi que ce soit : enregistre simplement un service qui pointe vers `/codigo/503`.

#### 1.1.4 Démarrer les deux

Chaque leçon du cours utilisant le `revisor` nécessite deux terminaux avec des serveurs et un troisième pour `curl`. Dans le premier :

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

Dans le second :

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Laisse les deux ouverts. Le terminal du `revisor` va noter chaque requête qu'il reçoit (`GET /servicios`, `POST /servicios`…), et cette liste est tout aussi importante que ce qu'affiche `curl` : dans la section « L'erreur que tu vas voir », c'est la seule qui dit toute la vérité.

Avant de lire les fichiers un par un, vérifie que le `revisor` répond déjà. Si tu ne les as pas encore écrits, copie-les depuis `programas/01-exitos-redirecciones/fig01_01/`, dans le dépôt du cours, et démarre-les ; les sections qui suivent expliquent ce qui a produit chaque réponse. Dans le troisième terminal :

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

Un `200` avec la liste des trois services de départ, son `Content-Type` et son `Content-Length`. Rien que tu ne connaisses déjà depuis la Leçon 0, sauf que maintenant la liste est bien réelle. La section 1.4 explique ce qui l'a produite.

### 1.2 Enregistrer et répondre

#### 1.2.1 Le stockage

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

Le stockage conserve deux choses en mémoire, dans deux `Map` : les **services** et les **vérifications**. Quand on arrête le `revisor`, tout est perdu, volontairement : chaque exécution commence avec les trois mêmes services de départ, ainsi ce que tu vois dans ton terminal correspond à ce qu'énonce la leçon. Un service possède son `id`, son `nombre`, l'`url` consultée, la `limiteMs` (temps d'attente de la réponse avant de le considérer comme hors service), l'`equipo` auquel il appartient, que la Leçon 2 utilisera pour décider qui voit quoi, et une `version`.

La `version` est la pièce qui fait fonctionner la section 1.8. La fonction `etiqueta` assemble un texte entre guillemets comportant trois parties, `"4-1-7b2497d9"` : l'`id`, la `version` et un **identifiant de démarrage**. Ce texte constitue l'**étiquette d'entité** (*entity tag*, l'`ETag`) du service. Aujourd'hui, aucun service ne change, la version vaut donc toujours 1 ; dans la Leçon 3, chaque modification l'incrémente et l'étiquette change avec elle. Les guillemets ne sont pas de la décoration : la [RFC 9110, section 8.8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3), définit l'étiquette comme un texte **opaque entre guillemets doubles**, et précise que pour le client elle est opaque : il n'a pas besoin de savoir comment elle a été construite, seulement de la comparer. La [section 8.8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.1) donne justement pour exemple ce que fait le `revisor`, à savoir utiliser un numéro de révision interne.

Et l'identifiant de démarrage ? Ce sont 4 octets aléatoires (`randomBytes(4)`, huit chiffres hexadécimaux) que `almacen.ts` tire au sort une fois, au démarrage. Ils existent en vertu d'une règle de la [RFC 9110, section 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1) : une étiquette forte est unique parmi toutes les versions de toutes les représentations d'une ressource **au fil du temps**. Le stockage réside en mémoire, et au redémarrage du `revisor`, les `id` et les versions recommencent depuis le début. Sans cet identifiant, le service 4 d'avant un redémarrage et le service 4 d'après, qui pourrait être tout autre, auraient la même étiquette `"4-1"`, et un client ayant conservé le premier recevrait la confirmation que sa copie ancienne est toujours valide. Grâce à cet identifiant, une étiquette d'un démarrage ne coïncide pas, en pratique, avec celles d'un autre (ce sont 4 octets aléatoires : une chance sur 4 295 millions pour chaque démarrage antérieur, jamais une garantie mathématique), sans rien enregistrer sur disque. C'est pourquoi les étiquettes de ton exécution se terminent différemment de celles de la leçon.

Les vérifications sont plus simples : un `id`, le service vérifié, un `estado` qui commence à `"pendiente"` puis passe à `"terminada"`, et un `resultado` valant `null` tant que la vérification n'est pas terminée.

#### 1.2.2 Les trois façons de répondre

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

Le `revisor` répond de trois manières différentes, et chacune vit dans une fonction dédiée, afin qu'aucune route n'ait à se soucier des détails techniques :

- **`enviarJson`** répond avec un corps JSON. Elle calcule le `Content-Length` en octets, comme dans la Leçon 0, et applique `Content-Type: application/json`. C'est celle qu'utilisent `200`, `201` et `202`.
- **`enviarVacio`** répond sans corps : pour `204`, `304` et les redirections. Elle applique une règle qui mérite explication : elle n'attribue pas de `Content-Length` à `204` et `304`, alors qu'elle applique `Content-Length: 0` aux autres. La raison se trouve dans la [RFC 9110, section 8.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.6) : un serveur **ne doit pas** envoyer de `Content-Length` dans un `204`, et dans un `304` il ne peut l'envoyer que s'il indique exactement ce qu'aurait indiqué le `200`, c'est-à-dire la taille du corps qui n'est pas envoyé. Une redirection peut quant à elle porter un corps, et c'est pourquoi elle indique explicitement qu'il mesure zéro.
- **`fallar`** répond par une erreur sous la forme d'une ligne de texte. C'est provisoire : la Leçon 5 la remplace par les *Problem Details* de la RFC 9457, et ce changement constitue précisément le cœur de celle-ci.

Toutes les trois passent par `escribirCabecera`, qui corrige un détail que tu as déjà vu dans la Leçon 0 : Node appelle deux codes par leurs anciens noms, ainsi pour le `413` et le `422`, le `revisor` applique les libellés du registre de l'IANA.

`leerCuerpo` rassemble les morceaux du corps d'une requête et les convertit en texte. Un corps arrive sur le réseau par fragments, et la requête de Node est un flux qu'on peut parcourir avec `for await` ; tant que le dernier morceau n'est pas arrivé, il n'y a pas de corps complet à lire. Et elle lit **au maximum 16 Kio** (`TOPE_CUERPO`, 16384 octets). Un service, c'est un nom court (le modèle du cours prévoit jusqu'à 40 caractères), une URL et un nombre, et cela tient largement. Attention à ce que cette phrase ne promet pas : dans cette leçon, le `revisor` vérifie seulement que `nombre` et `url` sont du texte ; la longueur du nom et les autres règles de contenu arrivent avec la validation de la [Leçon 3](03-errores-del-cliente-estado.md), et la seule chose qui borne aujourd'hui la taille, c'est la limite du corps. Sans limite, quiconque atteint le `revisor` pourrait envoyer un corps gigantesque, ou beaucoup à la fois, pour saturer sa mémoire. C'est pourquoi `leerCuerpo` n'accumule pas les morceaux à l'aveugle : si `Content-Length` annonce déjà plus que la limite, elle refuse le corps sans rien conserver ; si le corps arrive par morceaux, sans annoncer sa taille, elle compte les octets au fur et à mesure de leur arrivée et cesse de les conserver dès que la limite est dépassée. Dans les deux cas, elle le signale avec `CuerpoDemasiadoGrande` et prépare une **fermeture en plusieurs étapes** (RFC 9112, section 9.6) : le `413` part immédiatement, avec `Connection: close` ; la connexion est fermée seulement en écriture (semi-fermeture), le `revisor` continue de lire et de jeter ce que le client parvient à envoyer et, si le client ne ferme pas son côté en 2 secondes, il la détruit. S'il fermait brutalement alors que le client envoie encore, le système d'exploitation répondrait par un RST qui peut effacer le `413` avant que le client ne le lise. La fonction qui lisait renvoie `413 Content Too Large`. La Leçon 2 explique le `413` en détail ; ici, il suffit de savoir qu'il existe et de le voir une fois, en 1.5.2.

### 1.3 La table de routage

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

`rutas.ts` répond à une seule question : quelle fonction prend en charge cette requête ? La table `RUTAS` comporte une ligne par route, avec une expression régulière qui reconnaît la route et, à l'intérieur, les méthodes qu'elle admet. Les parenthèses de l'expression (`(\d+)`) capturent le numéro du service ou de la vérification, et arrivent à la fonction sous forme de `parametros`.

`atender` fait quatre choses dans l'ordre. Elle note dans le terminal la méthode et la route. Elle vérifie s'il s'agit d'une ancienne route ayant déménagé, avec `redirigir`, que la section 1.9 explique. Elle traite `HEAD` comme s'il s'agissait de `GET` : la fonction qui prend en charge la requête est la même, et Node, sachant que la requête était un `HEAD`, n'envoie pas le corps ; tu l'as vu dans la Leçon 0 avec `curl -I`. Et elle parcourt la table jusqu'à trouver une route qui corresponde **et** dispose d'une fonction pour cette méthode. Cette dernière vérification est effectuée avec `Object.hasOwn(ruta.metodos, metodo)`, et non avec `ruta.metodos[metodo]` tout court, pour des raisons de sécurité : la méthode est écrite par le client, et un objet JavaScript « possède » aussi ce dont il hérite (`constructor`, `toString`…). Avec une recherche naïve, un client envoyant la méthode `constructor` trouverait une fonction que personne n'a écrite pour le servir ; avec `Object.hasOwn`, seules comptent les méthodes déclarées par la table, et `constructor` reçoit le même `404` que n'importe quelle méthode inconnue.

Si elle n'en trouve aucune, elle répond `404` avec « no existe esa ruta ». Remarque le commentaire de cette dernière ligne : le `revisor` ne distingue pas encore « cette route n'existe pas » de « cette route existe, mais pas avec cette méthode ». Ce sont deux réponses distinctes, `404` et `405`, et la seconde exige l'en-tête `Allow`. C'est le défaut délibéré de cette leçon, et tu vas le voir dans « L'erreur que tu vas voir ».

### 1.4 `200` : renvoyer ce qui a été demandé

#### 1.4.1 La question qui tranche

Le `200 OK` est le succès le plus connu, et la RFC 9110 le définit dans sa [section 15.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1) avec une idée qu'il convient de lire posément : le contenu d'un `200` **dépend de la méthode**. À un `GET`, on renvoie une représentation de la ressource ; à un `POST`, l'état ou le résultat de l'action ; à un `PUT` ou un `DELETE`, l'état de l'action. Autrement dit, le `200` ne dit pas « tout va bien » dans l'abstrait : il dit « voici le corps qui correspond à ce que tu as demandé ».

De là découle la question qui tranche : **y a-t-il quelque chose à renvoyer, et s'agit-il bien de ce qui a été demandé ?** Si oui, `200`. Si l'opération a créé quelque chose de nouveau, il existe un code plus précis (`201`). Si elle n'est pas encore terminée, un autre (`202`). Si elle est terminée et qu'il n'y a rien à dire, un autre (`204`). Le `200` est ce qui reste quand aucun des trois plus précis ne s'applique.

La même section ajoute deux détails. Un `200` à un `GET` ou un `HEAD` **devrait** envoyer les validateurs disponibles, tels que l'`ETag`, et le `revisor` le fait lors de la consultation d'un service. Et un `200` **est censé porter du contenu**, sauf si le cadrage du message indique explicitement qu'il mesure zéro (`Content-Length: 0`) ; si quelque chose dans la requête indique que le client préfère ne pas recevoir de contenu, la RFC suggère un `204` à la place.

#### 1.4.2 Dans le `revisor`

Les deux routes qui renvoient un `200` sont `listar` et `consultar`, dans `servicios.ts`. Voici le fichier complet, car toutes les sections suivantes vont l'utiliser :

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

`listar` est la plus simple de toute l'API : elle compose `{"servicios": […]}` avec la représentation de chaque service et répond `200`. Regarde `representar` : le stockage conserve `limiteMs`, mais l'API l'expose sous le nom `limite_ms`, et n'expose ni `equipo` ni `version`. La représentation est une décision de conception, découplée de la façon dont les données sont stockées : le jour où le stockage change, l'API peut continuer à énoncer la même chose. Les champs sont en `snake_case` car c'est ainsi qu'ils restent tout au long du cours, et l'important est qu'ils ne changent pas d'une route à l'autre.

La réponse de `listar` est celle que tu as vue en 1.1.4 : `{"servicios": […]}` avec les trois services de départ et un `200`. `consultar`, l'autre route du `200`, apparaît en 1.5.2 et se complète en 1.8, car c'est elle qui prend en charge les étiquettes.

### 1.5 `201` : créer, et dire où cela se trouve

#### 1.5.1 La question qui tranche

La [RFC 9110, section 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2), définit ainsi le `201 Created` : la requête a été satisfaite et **a créé une ou plusieurs nouvelles ressources**. Et elle précise comment la ressource principale est identifiée : par l'en-tête `Location` de la réponse ou, s'il est absent, par la route même de la requête. Cette seconde option importe peu lors d'un enregistrement comme celui du `revisor`, car la requête a été envoyée à `/servicios` et le nouveau service ne réside pas sur `/servicios`, mais sur `/servicios/4`. C'est pourquoi, pour un `POST` qui crée quelque chose, la [section 9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3) est plus directe : le serveur **devrait** répondre `201` avec un `Location` qui identifie la ressource créée.

La question qui tranche : **cette requête a-t-elle créé quelque chose qui n'existait pas auparavant et qui possède sa propre adresse ?** Si oui, `201` avec `Location`. Si le `POST` a fait autre chose (traiter, calculer, envoyer), il n'y a pas de nouvelle ressource à désigner et le `201` ment.

La même section 15.3.2 autorise le `201` à porter des validateurs, et précise ce qu'ils signifient : ce sont ceux de la ressource nouvellement créée. C'est pourquoi le `revisor` envoie l'`ETag` du nouveau service en même temps que `Location`. Quiconque enregistre un service dispose ainsi, dès la première réponse, de l'étiquette dont il aurait besoin pour une requête conditionnelle comme celles de la section 1.8.

#### 1.5.2 Dans le `revisor`

`darDeAlta` lit le corps, avec la limite de 16 Kio de 1.2.2, et pose cinq questions dans l'ordre : s'agit-il de JSON ? S'agit-il d'un **objet** JSON ? Contient-il `nombre` et `url` sous forme de chaînes de texte ? `limite_ms`, s'il est fourni, est-il un entier raisonnable ? L'URL est-elle une destination autorisée ? (la section 1.10 explique pourquoi). Si tout est valide, elle crée le service et répond `201` avec deux en-têtes : `Location`, contenant l'adresse du nouveau service, et `ETag`, avec son étiquette. Le corps est la représentation du nouveau service, la même que celle que renverrait un `GET` à cette adresse ; la RFC indique que le corps d'un `201` décrit normalement la ressource créée et pointe vers elle.

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

`-X POST` indique à `curl` quelle méthode utiliser, `-H` ajoute l'en-tête `Content-Type` et `-d` transmet le corps. Le service s'appelle `inventario`, pointe vers le laboratoire et n'apporte pas de `limite_ms`, le `revisor` lui a donc attribué la valeur par défaut, 2000. C'est le service 4 car les trois services de démarrage occupent le 1, le 2 et le 3, et son étiquette est `"4-1-7b2497d9"` : service 4, version 1, et l'identifiant de ce démarrage (le tien sera différent).

À présent, suis l'adresse de `Location` :

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

Même corps, même `ETag`. `Location` est une **référence relative**, `/servicios/4`, sans serveur ni port. La [RFC 9110, section 10.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2), l'autorise : si la valeur est relative, elle est complétée avec l'adresse de la requête d'origine. C'est exactement ce que fait `curl` lorsqu'il suit une redirection relative, et ce que fait `new URL(location, base)` dans un programme, comme tu vas le voir dans la section 1.6.

`limite_ms` possède une plage valide, de 100 à 10000 millisecondes. Sans elle, quelqu'un pourrait enregistrer un service avec une limite d'une heure, et chaque vérification laisserait le `revisor` en attente pendant une heure face à un service muet ; avec une limite de zéro, il le considérerait comme hors service sans même l'avoir consulté. En dehors de cette plage, l'enregistrement n'a pas lieu :

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

Ce `400` fait partie du filet de sécurité mentionné dans « Ce que cette leçon ne fait pas » : le `revisor` ne crée pas de service avec des données qu'il ne peut pas honorer, et il ne répond pas `200` quand il n'a rien fait. Si tu penses que « c'est lisible mais on ne peut pas l'honorer » ressemble davantage à un `422` qu'à un `400`, tu as parfaitement raison, et c'est exactement la règle qu'écrit la Leçon 3. Pour le moment, le `revisor` ne gère pas le `422`.

Reste la deuxième question de la liste, celle qui semble superflue : s'agit-il d'un **objet** JSON ? `null` est du JSON valide, tout comme `7`, `"texto"` ou `[]`, et `JSON.parse` les accepte sans sourciller. Mais aucun d'eux ne porte de champs, et tenter de lire `datos.nombre` sur `null` lève une `TypeError`. Sans cette vérification, et sans le filet de sécurité de `servidor.ts`, cette requête faisait planter le `revisor` pour tout le monde, en un seul `curl` et sans le moindre identifiant. Avec cette vérification :

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

`400` avec la raison, et la requête suivante répond `200` : le `revisor` tourne toujours. La vérification et le filet ne sont pas la même chose. La vérification transforme un corps inutilisable en un `400` qui indique au client ce qu'il doit corriger ; le filet rattrape ce que personne n'a prévu et le transforme en un `500`, qui ne dit rien d'utile au client. La vérification est la démarche correcte ; le filet est l'assurance pour ce qui s'échappe.

Avant ces cinq questions, il y a la limite de taille. Un corps de 20000 octets, plus que les 16384 qu'accepte le `revisor` :

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

`413`, avec `Connection: close`, sans que le `revisor` ait conservé un seul octet du corps : `Content-Length` annonçait 20000 et il a suffi de lire l'en-tête. La requête suivante répond `200`. `head -c 20000 /dev/zero` produit 20000 octets nuls, et `--data-binary @-` indique à `curl` d'envoyer comme corps, tel quel, ce qui lui arrive par le tube (*pipe*).

> **Pause de session.** Si tu suis la leçon en deux sessions de 45 minutes, c'est ici. Arrête le `revisor` et le laboratoire avec `Ctrl`+`C`. Au retour, redémarre les deux et enregistre à nouveau le service `inventario` avec le `curl` de 1.5.2 : comme le stockage vit en mémoire, au redémarrage tout est perdu, et la section 1.7 retire le service 4. Si tu suis la leçon d'une traite, fais de même : arrête les deux, redémarre-les et répète l'enregistrement, afin que tes numéros coïncident avec ceux de la leçon. La réponse est identique à celle de 1.5.2 à l'exception de l'étiquette, car il s'agit d'un autre démarrage :

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

### 1.6 `202` : accepté, pas encore fait

#### 1.6.1 La question qui tranche

Demander une vérification ne se résout pas sur-le-champ. Le `revisor` doit consulter le service, et un service lent peut mettre des secondes à répondre ; dans un système réel, les vérifications attendent leur tour dans une file. Maintenir la connexion ouverte pendant ce temps serait une mauvaise idée : le client reste bloqué, et si la connexion est coupée, il ne sait pas si la vérification a eu lieu.

C'est pour cela qu'existe le `202 Accepted`. La [RFC 9110, section 15.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.3), le définit avec une franchise peu commune : la requête a été acceptée pour traitement, mais **le traitement n'est pas terminé**, et pourrait même ne jamais être effectué, car il peut être rejeté quand viendra son tour. Elle précise que le `202` est « intentionnellement évasif » (*intentionally noncommittal*). Et elle ajoute qu'en HTTP, il n'existe aucun moyen pour le serveur d'envoyer ultérieurement un autre code d'état pour la même requête : la réponse a déjà été donnée. C'est pourquoi elle se termine par une recommandation qui constitue la moitié de cette section : la représentation du `202` **devrait** décrire l'état actuel de la requête et pointer vers un **moniteur d'état** (*status monitor*) où le client pourra voir quand elle sera satisfaite.

La question qui tranche : **l'opération va-t-elle se terminer après que j'aurai répondu ?** Si oui, `202`, et jamais `200` ni `201`, car tous deux disent au client qu'elle est déjà terminée.

#### 1.6.2 La ressource de suivi

Dans le `revisor`, ce moniteur d'état est une ressource à part entière : chaque vérification vit sous `/revisiones/{id}`. `pedirRevision` crée la vérification à l'état `pendiente`, la programme pour dans une seconde avec `setTimeout` (la seconde d'« attente dans la file », qui rend visible l'état en attente) et répond `202` avec deux éléments : un corps décrivant l'état actuel et un `Location` qui pointe vers la vérification. C'est le même en-tête que celui du `201`, avec une autre signification : dans un `201`, il désigne ce qui a été créé, et dans un `202`, il indique où demander.

`consultarRevision` répond `200` avec l'état de la vérification. Tant qu'elle est en attente, elle ajoute `Retry-After: 1`. La [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3), définit `Retry-After` comme le temps que le client devrait attendre avant sa prochaine requête, en secondes ou sous forme de date ; la RFC le décrit pour le `503` et les redirections, et sur une ressource de suivi il remplit le même rôle : « ne reviens pas avant une seconde ». Que le `revisor` l'utilise ici est une décision de conception, pas une norme ; la norme définit seulement ce que signifie l'en-tête.

Demande une vérification du service 2, `pagos`, qui pointe vers `/codigo/503` :

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

Et tout de suite, sans attendre, suis le `Location` :

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

`200`, parce que la consultation du suivi, elle, s'est bien passée : voici ce que tu as demandé, l'état de la vérification. L'état est `pendiente`, et `Retry-After: 1` indique quand revenir. C'est un point déroutant au début : **le `202` décrit la requête de vérification ; le `200` décrit la consultation du suivi**. Ce sont deux requêtes distinctes, chacune avec son code.

Deux secondes plus tard :

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

Terminée. Le résultat indique que `pagos` est `CAIDO`, avec le code `503` renvoyé par le laboratoire et les millisecondes que cela a pris (dans ton exécution, un autre chiffre). `Retry-After` n'est plus renvoyé, car il n'y a plus rien à attendre.

#### 1.6.3 La face cliente

Qui a consulté `pagos` ? La face cliente du `revisor` :

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

`revisar` reçoit l'URL et la limite. La première chose qu'elle fait est de vérifier à nouveau la destination (la section 1.10 explique pourquoi avant **chaque** connexion). Ensuite, elle mesure le temps avec `performance.now()`, consulte avec `fetch` et classe le résultat. Si le code est `400` ou plus, `CAIDO`. Sinon, `LENTO` s'il a fallu la moitié de la limite ou plus, et `ARRIBA` s'il a fallu moins. Si `fetch` n'a obtenu aucune réponse, `CAIDO` avec un détail qui distingue « temps écoulé » d'« absence de connexion » ; c'est la distinction entre l'erreur 7 de `curl` et une réponse HTTP, que tu as vue à la fin de la Leçon 0.

Trois détails sur le `fetch`. `AbortSignal.timeout(limiteMs)` interrompt la consultation si elle dépasse la limite. `respuesta.body?.cancel()` rejette le corps sans le lire, car pour classer, seul le numéro importe : c'est le principe « le code fait foi » appliqué du côté de celui qui lit. Et `redirect: "manual"` dit à `fetch` de **ne pas suivre** les redirections : si un service répond `301`, le `revisor` consigne le `301` et ne va pas là où indique `Location`. Cette décision a une raison de sécurité, et tu vas la voir dans l'encadré.

#### 1.6.4 Un client qui sait attendre

Avec `curl`, tu as suivi le `202` manuellement. Un programme doit le faire tout seul, et la tentation est de consulter dans une boucle sans pause jusqu'à ce qu'il dise `terminada`. Ce programme fait les choses comme il se doit. Enregistre-le sous `~/curso-http/revisor/fig01_02.ts` :

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

Il lit la réponse du `202` et extrait le `Location` ; si le code n'est pas `202` ou si l'en-tête manque, il s'arrête, car il ne saurait pas où se renseigner. Ensuite, il consulte le suivi : `new URL(seguimiento, BASE)` complète la référence relative avec le serveur et le port, comme le stipule la RFC. À chaque tour, il affiche l'état et, s'il est présent, `Retry-After`. Quand la vérification se termine, il affiche le résultat et quitte. Sinon, il attend ce qu'a demandé le serveur, **borné entre 1 et 5 secondes**, et redemande. Ces deux bornes sont des choix du client, non de la RFC : la borne basse évite de marteler le serveur si `Retry-After` manque ou n'est pas un nombre, et la borne haute évite qu'un serveur mal configuré ne l'endorme pendant une heure. La [Leçon 6](06-reintentos-idempotencia.md) reviendra sur cette seconde borne, et la [Leçon 7](07-quien-lee-el-error.md) sur la conduite à tenir quand le serveur demande d'attendre plus longtemps que ce que tu es prêt à tolérer. La boucle possède en outre un plafond de dix consultations, pour qu'un suivi qui ne se termine jamais ne laisse pas le programme tourner indéfiniment.

Avec le laboratoire et le `revisor` en marche, demande une vérification du service 1, `catalogo` :

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/2
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"ARRIBA","codigo":200,"ms":1,"detalle":"200"}
```

Deux consultations. La première a trouvé la vérification en attente et a obéi au `Retry-After` ; la seconde, une seconde plus tard, l'a trouvée terminée : `catalogo` est `ARRIBA`. Dans le terminal du `revisor`, trois lignes ont été consignées : le `POST` et les deux `GET`. Compte les consultations effectuées par ton programme : s'il y en a eu cinq mille, c'est qu'il manque la pause.

### 1.7 `204` : terminé, et rien à dire

#### 1.7.1 La question qui tranche

La [RFC 9110, section 15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5), définit le `204 No Content` : le serveur a satisfait la requête et **n'a pas de contenu supplémentaire** à envoyer. Et elle est catégorique sur la forme : un `204` se termine avec le dernier en-tête, et **ne peut pas** porter de corps.

La question qui tranche : **l'opération est-elle terminée et n'y a-t-il rien d'utile à dire ?** Le retrait est le cas d'école. Pour un `DELETE` réussi, la [section 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.5) offre exactement trois options : `202` si l'action va probablement se produire mais n'a pas encore eu lieu, `204` si elle a déjà eu lieu et qu'il n'y a pas d'autre information, et `200` si elle a déjà eu lieu et que la réponse apporte une représentation de l'état. Le `revisor` retire immédiatement et n'a rien à dire, il répond donc `204`.

Et pourquoi pas `200` avec un corps vide, ou avec `{"ok": true}` ? Parce que le `204` dit à n'importe quel programme, sans rien lire, qu'il n'y a aucun corps à attendre. Un `200` avec `{"ok": true}` force le client à lire le corps pour apprendre quelque chose que le code disait déjà. Et un `200` vide est valide s'il déclare `Content-Length: 0`, mais oblige le client à examiner la longueur pour savoir qu'il n'y a rien, alors que le `204` l'énonce d'emblée avec le code.

#### 1.7.2 Dans le `revisor`

`retirar` supprime le service du stockage et répond avec `enviarVacio`. Si le service n'existait pas, elle répond `404`. Retire le service 4 :

```text
$ curl -i -X DELETE http://127.0.0.1:18080/servicios/4
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

Ni `Content-Type` ni `Content-Length` : il n'y a pas de corps à décrire. Demande-le à nouveau :

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

Le service n'existe plus, et le `revisor` le dit avec un `404` et une ligne de texte. (Dans la Leçon 3, un service retiré répondra `410`, qui signifie « a existé et n'est plus là » ; aujourd'hui le `revisor` ne se souvient pas de ce qu'il a retiré.) Et si tu répètes le retrait :

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

Le second `DELETE` répond différemment du premier, et pourtant le `DELETE` est **idempotent**. La [RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2), définit une méthode idempotente par son **effet sur le serveur**, non par la réponse : répéter la requête laisse le serveur dans le même état que de la faire une seule fois. Après un ou dix `DELETE`, le service 4 n'existe pas. Cette propriété constitue la base de la Leçon 6, car c'est elle qui permet de réessayer sans crainte.

### 1.8 `304` : je ne t'envoie pas ce que tu as déjà

#### 1.8.1 La question qui tranche

Imagine un tableau de bord affichant les services et les consultant toutes les dix secondes. La plupart du temps, rien n'a changé, et le `revisor` envoie le même corps encore et encore. C'est pour cela qu'existent les **requêtes conditionnelles** : le client dit « j'ai déjà la version portant cette étiquette ; ne me l'envoie que si elle a changé ». L'en-tête est `If-None-Match` (« si aucune ne correspond »), et il porte l'`ETag` que le client a enregistré.

La [RFC 9110, section 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2), explique comment elle est évaluée : si l'une des étiquettes envoyées par le client correspond à celle de la ressource, la condition est fausse, et alors le serveur **ne doit pas** exécuter la méthode : à un `GET` ou un `HEAD` il répond `304`, et à toute autre méthode, `412` (la Leçon 3 traite du `412`). Si aucune ne correspond, le serveur répond comme toujours, avec son `200`.

La [RFC 9110, section 15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5), définit le `304 Not Modified` : la requête conditionnelle aurait abouti à un `200`, mais il est inutile d'envoyer la représentation car **le client l'a déjà**. Le serveur, dit la RFC, « redirige » le client vers sa propre copie enregistrée. C'est pourquoi le `304` vit dans la famille `3xx` même s'il ne porte pas de `Location` : c'est une redirection vers ce que tu as déjà. Et tout comme le `204`, il se termine avec le dernier en-tête : il **ne peut pas** porter de corps.

Ce qu'il doit en revanche porter est la partie la plus souvent oubliée. La RFC en donne une courte liste : `Content-Location`, `Date`, `ETag` et `Vary`, ainsi que `Cache-Control` et `Expires` ; `Content-Length` ne peut les accompagner que s'il indique la même chose que ce qu'aurait indiqué le `200` (section 8.6), et le `revisor` préfère ne pas l'envoyer. Parmi ces en-têtes, un `304` **doit** générer ceux qu'aurait envoyés le `200` pour la même requête. L'`ETag` est celui qui importe ici : il confirme au client quelle est la version en vigueur.

La question qui tranche, du côté serveur : **la version que le client prétend avoir est-elle celle en vigueur ?** Si oui, `304` et rien d'autre. Sinon, `200` avec la nouvelle version et son étiquette.

#### 1.8.2 Lire une liste d'étiquettes

La section 13.1.2 comporte deux détails qui déterminent la façon d'écrire le code. Le premier : `If-None-Match` n'apporte pas **une** étiquette, mais `*` ou **une liste** séparée par des virgules (`If-None-Match: "a", "b"`), parce qu'un client peut avoir enregistré plusieurs versions et poser la question pour toutes en même temps ; et `*` signifie « n'importe quelle version dont tu disposes ». Le second : la comparaison est **faible**. La [section 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) définit deux façons de comparer des étiquettes. Dans la comparaison **forte**, deux étiquettes ne correspondent que si aucune ne porte `W/` (la marque de « faible ») et que le texte est identique. Dans la comparaison **faible**, il suffit que le texte entre guillemets soit égal, avec `W/` ou sans lui. `If-None-Match` utilise la comparaison faible, car elle demande simplement si la copie du client peut encore être affichée. La Leçon 3 utilise la comparaison forte, avec `If-Match`, pour quelque chose de plus délicat.

Comparer l'en-tête complet avec l'étiquette, sous forme de texte brut, échoue sur les deux points, et c'est pour cela qu'existe `etiquetas.ts` :

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

`interpretarLista` parcourt l'en-tête en respectant les guillemets : une virgule **à l'intérieur** des guillemets fait partie de l'étiquette, ce n'est pas un séparateur. Elle renvoie `"*"` ou la liste des étiquettes telles qu'elles sont arrivées. Si un élément n'a pas la forme d'une étiquette, la liste entière n'est pas valable et elle renvoie une liste vide, qui ne correspond à rien. C'est la décision prudente : face à un en-tête corrompu, le serveur répond avec l'intégralité du contenu, ce qui n'est jamais incorrect. `coincideDebil` et `coincideFuerte` comparent deux étiquettes. `hayCoincidencia` rassemble les deux pièces : `*` correspond toujours (l'appelant a déjà trouvé la ressource), et une liste correspond si **l'une** de ses étiquettes correspond à celle en vigueur.

#### 1.8.3 Dans le `revisor`

`consultar`, dans `servicios.ts`, calcule l'étiquette en vigueur et demande à `hayCoincidencia`, avec la comparaison faible, si l'en-tête `If-None-Match` la contient. Si oui, `enviarVacio(respuesta, 304, { ETag: actual })` ; sinon, le `200` habituel. Demande le service 1, `catalogo`, et examine son `ETag` :

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

À présent, demande-le avec cette étiquette. Copie la **tienne**, celle que t'a donnée ta réponse, avec ses guillemets :

```text
$ curl -i http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "1-1-b27b3d9a"'
HTTP/1.1 304 Not Modified
ETag: "1-1-b27b3d9a"
Date: Wed, 21 Oct 2026 13:17:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

`304`, avec l'`ETag` et sans corps, sans `Content-Type` et sans `Content-Length` : les 88 octets du corps n'ont pas voyagé. Sur ce service d'exemple ce n'est rien ; sur une liste de milliers de services consultée toutes les dix secondes par une centaine de tableaux de bord, c'est la différence entre envoyer des mégaoctets par minute et n'envoyer presque rien.

Compare-le avec un `HEAD`, qui arrive également sans corps mais pour une autre raison :

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

`200` avec `Content-Length: 88` : le `HEAD` indique combien mesurerait le corps, comme dans la Leçon 0. Le `304` ne dit rien de tel, parce qu'il n'est pas la réponse à « comment est-ce ? », mais à « est-ce que cela a changé ? ».

Les trois autres formes admises par la RFC, avec `-w '%{http_code}\n'` pour n'afficher que le code : l'étiquette marquée comme faible, une liste qui la contient, et l'astérisque.

```text
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: W/"1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: "9-9-00000000", "1-1-b27b3d9a"'
304
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios/1 -H 'If-None-Match: *'
304
```

Toutes les trois donnent `304`. `W/` ne change rien dans une comparaison faible ; la liste correspond parce que l'une de ses étiquettes correspond ; et `*` correspond parce que le service existe.

#### 1.8.4 L'étiquette change à chaque démarrage

Arrête le `revisor` (laisse tourner le laboratoire) et démarre-le à nouveau. Ensuite, demande le service 1 avec l'étiquette précédente :

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

`200`, avec le corps complet et une nouvelle étiquette. Le service 1 est le même `catalogo` et rien n'a changé en lui, mais le `revisor` n'a aucun moyen de le savoir : il a tout perdu au redémarrage et l'a recréé. Dans le doute, il renvoie la représentation complète et une étiquette qui ne peut se confondre avec aucune étiquette antérieure. C'est l'identifiant de démarrage de 1.2.1 qui fait son travail. Sans lui, l'ancienne étiquette et la nouvelle seraient toutes deux `"1-1"`, et un `304` aurait confirmé au client une copie que le serveur ne peut plus garantir. Un serveur qui conserve ses données dans une base de données n'a pas ce problème : sa version survit à un redémarrage. Le `revisor` résout cela avec la solution la plus simple qui fonctionne.

### 1.9 `301` et `308` : déménager sans perdre le `POST`

#### 1.9.1 La question qui tranche

Les API déménagent. Le `revisor` a eu deux anciennes routes, `/viejo/servicios` et `/api/servicios`, qui résident aujourd'hui sur `/servicios`. Pour l'indiquer, il existe deux codes permanents, et la différence entre eux relève de l'histoire.

La [RFC 9110, section 15.4.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.2), définit le `301 Moved Permanently` : la ressource possède une adresse nouvelle et permanente, et le serveur **devrait** la communiquer dans `Location`. Et elle comporte une note qui est au cœur de cette section : **pour des raisons historiques, un client peut changer la méthode de `POST` en `GET`** lors de la requête suivante. La même note donne la solution : si ce changement n'est pas souhaité, on utilise le `308`.

L'introduction de la [section 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4) raconte toute l'histoire. Dans HTTP/1.0, le `301` et le `302` conservaient la méthode. Mais les premiers navigateurs se sont divisés : certains répétaient le `POST` à la nouvelle adresse et d'autres le convertissaient en `GET`, ce qui était le plus prudent si la redirection menait vers un autre site. La pratique a fini par le transformer en `GET`, et la spécification a été ajustée pour l'autoriser. Pour les redirections qui **conservent** bel et bien la méthode, de nouveaux codes ont été créés : le `307`, temporaire, et le `308 Permanent Redirect`, défini par la [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) en juin 2014 à titre expérimental, que la [RFC 7538](https://www.rfc-editor.org/rfc/rfc7538.html) a transformé en standard en avril 2015, et qui figure aujourd'hui dans la [section 15.4.9](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.9) de la RFC 9110.

Les clients que tu vas utiliser suivent cette pratique à la lettre. Le manuel de `curl` indique que, lors du suivi d'une redirection avec `-L`, si la requête était un `POST` et que la réponse a été `301`, `302` ou `303`, la requête suivante devient un `GET` ; avec tout autre `3xx`, il répète la même méthode. Et le [standard Fetch](https://fetch.spec.whatwg.org/#http-redirect-fetch), suivi par `fetch` dans Node et dans les navigateurs, énonce la même chose dans son algorithme de redirection : si le code est `301` ou `302` et que la méthode est `POST`, la méthode devient `GET` et **le corps est ignoré**.

La question qui tranche : **quelqu'un peut-il envoyer vers cette ancienne route autre chose qu'un `GET` ou un `HEAD` ?** Si ce n'est jamais le cas, le `301` suffit et est compris par le plus ancien des clients. Si un `POST`, un `PUT` ou un `DELETE` peut y parvenir, `308`. La RFC 7538, dans sa section 4, ajoute une précaution : un client très ancien ne connaissant pas le `308` le traitera comme un `300`, en vertu de la règle du `x00` de la Leçon 0, et peut ne pas suivre la redirection : le serveur ne peut pas compter sur le fait qu'il la suive. C'est rare aujourd'hui, mais c'est la raison pour laquelle le `301` reste l'option pour les routes exclusivement en lecture.

Les déménagements ne sont pas une hypothèse d'école. La page de l'OWASP citée par l'encadré de sécurité de cette leçon a changé d'adresse, et si tu la demandes à l'ancienne adresse avec `-I` (en-têtes seuls) et `-L` (suivre), tu observes le déménagement complet, en trois sauts :

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

Deux `308` et un `301` avant le `200` : le premier supprime la barre oblique finale, le deuxième déplace la page vers un autre domaine, et le troisième la lui remet. Cette exécution date du 21 octobre 2026 et elle est conservée, telle quelle, dans `programas/01-exitos-redirecciones/owasp.salida.txt` ; un site externe peut cependant modifier ses redirections quand il le souhaite, de sorte que la tienne peut se présenter différemment. Les lignes indiquent `HTTP/2` et ne portent pas de libellé car cette connexion a utilisé HTTP/2, qui n'envoie pas le libellé de la ligne d'état : la Leçon 0 t'a appris qu'un client ne doit pas prendre de décision à partir de lui.

Il existe un troisième code dont on entend parler ici, le `302 Found`, et il convient de savoir où il se situe. Il porte la même note historique que le `301` (un `POST` peut devenir un `GET`), mais il est **temporaire** : le client doit continuer à utiliser l'adresse d'origine. Son équivalent qui conserve la méthode est le `307`. Le `revisor` ne les utilise pas car ses déménagements sont permanents ; le laboratoire les produit sur `/codigo/302` et `/codigo/307` si tu veux les observer.

#### 1.9.2 Dans le `revisor`

`redirigir`, dans `rutas.ts`, vérifie la route **avant** la table, afin qu'une ancienne route n'atteigne jamais un gestionnaire. Pour `/viejo/servicios` et tout ce qui se trouve en dessous, elle répond `301` ; pour `/api/servicios` et ce qui se trouve en dessous, `308`. Dans les deux cas, `Location` est la nouvelle route : on retire le préfixe et on conserve la chaîne de requête (*query string*, ce qui suit `?`), afin qu'un `GET /viejo/servicios?x=1` parvienne à `/servicios?x=1`.

Sans `-L`, `curl` montre seulement la réponse, sans la suivre. Envoie un enregistrement vers chaque ancienne route :

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

Les deux réponses disent la même chose, sauf le numéro : « ceci a déménagé vers `/servicios` », avec `Content-Length: 0`. Aucune des deux n'a créé quoi que ce soit. Ce qui se passe ensuite dépend du client, et c'est précisément ce que montre la section « L'erreur que tu vas voir ».

### 1.10 Encadré de sécurité : SSRF

> **Encadré de sécurité. Qu'est-ce que le SSRF et pourquoi le `revisor` le porte-t-il dès sa naissance**
>
> **SSRF** (*server-side request forgery*, falsification de requête côté serveur) désigne ce qui se produit lorsque quelqu'un parvient à faire exécuter par **ton serveur** une requête que **cette personne** a choisie. Le serveur se connecte depuis son propre réseau, avec ses propres accès, à une adresse que l'attaquant ne pourrait pas atteindre depuis l'extérieur : le serveur lui-même (`127.0.0.1`), le réseau interne de l'entreprise ou le service de métadonnées du cloud. Le [Top 10 de sécurité des API de l'OWASP 2023](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/) le place au septième rang (API7:2023), et le définit ainsi : une API qui récupère une ressource distante **sans valider l'URL fournie par l'utilisateur**. Et il explique pourquoi cela est devenu courant : les *webhooks*, les prévisualisations de liens et le téléchargement de fichiers depuis une URL sont des fonctionnalités produit qui consistent, précisément, à se connecter à une adresse tierce.
>
> **Le `revisor` en est le cas d'école.** Son travail consiste à se connecter à l'URL saisie par la personne ayant enregistré le service. Ce n'est pas une négligence que l'on pourrait supprimer : c'est le produit lui-même. Sans aucune défense, quiconque ayant le droit d'enregistrer un service pourrait saisir `http://127.0.0.1:18080/mantenimiento` et forcer le `revisor` à s'interroger lui-même, ou bien une adresse du réseau interne visible uniquement par le serveur, puis lire le résultat de la vérification : `ARRIBA`, `CAIDO`, le code et les millisecondes. Grâce à cela, il peut déjà cartographier quelles machines et quels ports existent à l'intérieur du réseau. Et si le `revisor` s'exécute dans un cloud, il existe une adresse qui vaut plus que toutes les autres : `169.254.169.254`, où plusieurs fournisseurs de cloud publient les **métadonnées** de la machine. La [documentation d'AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) utilise cette adresse dans tous ses exemples (et `[fd00:ec2::254]` en IPv6), celle d'[Alibaba Cloud](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata) en utilise une autre, `100.100.100.200`, et le [guide de prévention du SSRF de l'OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) l'affirme sans détours : dans le cloud, le SSRF est souvent exploité pour dérober des identifiants et des jetons depuis ces services de métadonnées.
>
> **La défense : interroger le DNS avant chaque connexion.** Vérifier le texte de l'URL ne suffit pas. `localhost` ne ressemble pas à une adresse interdite, et pourtant elle l'est ; `http://2130706433/` n'en a pas l'air non plus, et l'analyseur d'URL la convertit en `127.0.0.1`, car le [standard URL](https://url.spec.whatwg.org/#concept-ipv4-parser) accepte les adresses IPv4 écrites sous la forme d'un seul nombre, en hexadécimal ou en octal. Ce qui compte n'est pas la façon dont la destination est écrite, mais **l'adresse à laquelle le `revisor` va réellement se connecter**. C'est pourquoi `destinos.ts` accomplit trois actions : il laisse `new URL` normaliser l'adresse ; il résout le nom avec `dns.lookup` et l'option `all: true`, qui renvoie **toutes** les adresses du nom, de la même manière que le résoudrait n'importe quel autre programme de la machine (y compris avec `/etc/hosts`) ; et il rejette la destination si **une seule** d'entre elles tombe dans une plage privée ou réservée. Les plages sont vérifiées avec `net.BlockList` de Node, et une IPv4 écrite à l'intérieur d'une IPv6 (`::ffff:127.0.0.1`) en est extraite et vérifiée pour ce qu'elle est. Et la vérification est effectuée **deux fois** : lors de l'enregistrement de l'URL, pour avertir la personne qui enregistre, et une nouvelle fois dans `cliente.ts`, **avant chaque connexion**, car ce qu'un nom résolvait le vendredi n'est pas nécessairement ce qu'il résout le lundi. Remarque également ce que le rejet **ne dit pas** : le message ne révèle pas vers quelle adresse le nom a résolu, afin de ne pas fournir à l'attaquant une carte du réseau interne requête par requête. L'adresse concrète, si nécessaire, va uniquement dans le journal du serveur, où l'exploitant du `revisor` peut la lire.
>
> **L'exception du laboratoire.** Le laboratoire de ce cours vit sur `127.0.0.1:18081`, qui relève du loopback, une plage interdite. Sans exception, le cours ne pourrait pas être mis en pratique sur une seule machine. C'est pourquoi il existe une liste de destinations autorisées **par adresse et port exacts** : par défaut uniquement `127.0.0.1:18081`, modifiable via la variable d'environnement `REVISOR_DESTINOS`. Elle est exacte à dessein : `127.0.0.1:18080`, le `revisor` lui-même, demeure interdit. Et `localhost:18081` dépend de la machine : si `localhost` résout aussi vers `::1`, comme sous macOS et sur de nombreux Linux, il est rejeté, car `[::1]:18081` ne figure pas dans la liste ; s'il résout uniquement vers `127.0.0.1`, il est accepté, car `127.0.0.1:18081` constitue précisément l'exception. Cette différence est une raison de plus pour que la liste soit définie par adresse et non par nom : ce qu'un nom résout ne relève pas de la décision de celui qui écrit la règle. Dans un vrai `revisor`, la liste serait vide ou ne contiendrait que le strict nécessaire, et la règle générale (rien de privé) ferait le reste. Une liste d'autorisations est plus sûre qu'une liste de rejets, et l'OWASP la recommande chaque fois que les destinations sont connues d'avance ; ici elles ne le sont pas, puisque n'importe qui enregistre n'importe quel service, et c'est pour cela que l'on combine les deux.
>
> **Pourquoi `fetch` ne suit pas les redirections.** Si `cliente.ts` suivait les `3xx`, il suffirait d'enregistrer un service public répondant `301` avec `Location: http://169.254.169.254/…` : l'URL enregistrée passerait le contrôle, et la redirection conduirait le `revisor` là où il ne doit pas aller, sans passer par `destinos.ts`. Avec `redirect: "manual"`, le `revisor` note le `301` et s'arrête. L'OWASP et l'API Top 10 recommandent la même chose : désactiver le suivi automatique des redirections.
>
> **La limite déclarée : le DNS rebinding.** Même en validant avant chaque `fetch`, une brèche subsiste, et il convient de la nommer. `destinos.ts` résout le nom et approuve ses adresses ; ensuite, `fetch` **résout à nouveau** ce nom pour s'y connecter. Entre les deux résolutions s'écoulent des millisecondes, et la personne qui contrôle le serveur DNS de ce nom peut renvoyer une adresse publique à la première question et `127.0.0.1` à la seconde, avec une durée de vie (TTL) de zéro seconde pour que personne ne mette en cache la première réponse. C'est ce qu'on appelle le **DNS rebinding**, et il s'agit d'une situation de concurrence (*race condition*) entre le contrôle et l'usage. Le guide de l'OWASP l'affirme explicitement : une seconde résolution non vérifiée, intercalée entre la validation et la connexion, contourne ces défenses. La défense complète consiste à **se connecter directement à l'adresse déjà validée** sans résoudre le nom une nouvelle fois : grâce à `http.request` de Node et à son option `lookup`, une fonction qui remplace `dns.lookup` et peut renvoyer précisément l'IP approuvée, tandis que l'en-tête `Host` conserve le nom d'origine. **Ici, nous validons avant chaque connexion, et la défense complète arrive dans la [Leçon 8](08-contrato-verificable.md)**, où `cliente.ts` se connecte à l'IP déjà validée ; en attendant, la limite reste explicitement déclarée dans les commentaires de `destinos.ts`, afin que nul ne la croie résolue. Et même avec cette défense, en production une seconde couche est indispensable : un réseau qui empêche physiquement le `revisor` d'atteindre les métadonnées même s'il essayait. La défense ne saurait reposer sur un unique fichier.

#### 1.10.1 Le code

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

Elle se lit dans l'ordre de la fonction `revisarDestino`. Elle tente d'abord de convertir le texte en une URL ; si c'est impossible, ce n'est pas une destination. Ensuite, elle exige `http:` ou `https:` : un `file:` ou un `ftp:` n'ont rien à faire dans un vérificateur de services web. Elle calcule le port (celui de l'URL ou celui par défaut du protocole) et retire les crochets d'une IPv6 (`[::1]` → `::1`). La fonction `privada` décide si une adresse est privée ou réservée, et le fait différemment pour chaque protocole, pour une raison expliquée plus bas : à une IPv4, elle demande si elle tombe dans `IPV4_PROHIBIDAS` ; à une IPv6, d'abord si elle contient une IPv4 à l'intérieur (les quatre formats d'`EMBEBIDAS`, avec l'aide de `grupos`, qui répartit une IPv6 en ses huit groupes de 16 bits), et sinon, si elle se trouve dans `IPV6_GLOBAL` et hors de `IPV6_PROHIBIDAS`. Si le nom est déjà une adresse IP, elle l'utilise telle quelle ; sinon, elle le résout avec `lookup(nombre, { all: true })`. Enfin, elle compose chaque destination sous la forme `adresse:port` et ne conserve que celles qui ne sont **pas** dans la liste des destinations autorisées **et** que `privada` déclare privées ou réservées. S'il en reste au moins une, la destination est rejetée. Le motif dépend de la manière dont la destination a été écrite : s'il s'agissait d'une adresse IP, elle la répète, car c'est celle saisie par le client ; s'il s'agissait d'un nom d'hôte, elle indique simplement qu'il résout vers une adresse privée ou réservée, sans préciser lesquelles.

**Une décision de conception : liste noire en IPv4, liste blanche en IPv6.** Il existe deux manières d'écrire la règle. Une **liste noire** nomme ce qui est interdit et accepte tout le reste ; une **liste blanche** nomme ce qui est autorisé et rejette tout le reste. La liste blanche est plus sûre, car ce que l'on oublie de nommer reste dehors, et non dedans. Mais on ne peut l'écrire que si ce qui est autorisé tient en peu de lignes, et sur ce point les deux protocoles diffèrent.

En **IPv6**, cela tient en une seule ligne. Tout l'unicast global d'internet vit dans un unique bloc, `2000::/3`, que le [registre d'espace d'adresses IPv6 de l'IANA](https://www.iana.org/assignments/ipv6-address-space/) marque comme *Global Unicast*. La règle se lit comme elle se dit : « seul internet est autorisé ». Avec elle sont exclus d'un coup, sans les nommer, le loopback `::1`, l'adresse non spécifiée `::`, les adresses locales uniques `fc00::/7`, le lien local `fe80::/10`, la multidiffusion `ff00::/8` et tout bloc spécial qui serait ajouté demain en dehors de `2000::/3`. Au sein de ce bloc, quelques-uns ne relèvent pas d'internet, et ceux-là sont explicitement nommés dans `IPV6_PROHIBIDAS` : `2001::/23` (protocoles de l'IETF, dont Teredo), `2001:db8::/32` et `3fff::/20` (documentation) ainsi que `5f00::/16` (*segment routing*).

En **IPv4**, cela ne tient pas en une ligne. Il n'existe pas de bloc « global » pouvant être accepté en bloc : le global, c'est « tout sauf les blocs spéciaux », et une liste blanche d'IPv4 serait la même liste noire écrite à l'envers. C'est pourquoi `IPV4_PROHIBIDAS` est une liste noire, copiée ligne par ligne depuis le [registre des adresses IPv4 à usage spécial de l'IANA](https://www.iana.org/assignments/iana-ipv4-special-registry/), avec le nom de chaque bloc en commentaire, afin qu'elle puisse être auditée par comparaison avec le registre :

| Bloc IPv4 | Ce que c'est | Où il est défini |
|---|---|---|
| `0.0.0.0/8` | « ce réseau » | [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html), base du registre d'usage spécial |
| `10/8`, `172.16/12`, `192.168/16` | réseaux privés | [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) |
| `100.64/10` | espace partagé ou *CGNAT* (*Carrier-Grade NAT* : la traduction d'adresses par laquelle un fournisseur d'accès à internet répartit une même adresse publique entre de nombreux clients) ; Alibaba Cloud y publie ses métadonnées sur `100.100.100.200` | [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) |
| `127/8` | loopback, la machine elle-même | RFC 6890 |
| `169.254/16` | lien local ; AWS et d'autres clouds y publient leurs métadonnées sur `169.254.169.254` | [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) |
| `192.0.0.0/24` | affectations de protocole de l'IETF | registre de l'IANA |
| `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | documentation (TEST-NET-1, 2 et 3) | registre de l'IANA |
| `192.88.99.0/24` | l'ancien relais 6to4, désormais retiré | registre de l'IANA |
| `198.18.0.0/15` | tests de performance | registre de l'IANA |
| `224/4` | multidiffusion (*multicast*), une adresse qui atteint un groupe de machines | [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) |
| `240/4` | réservé, y compris la diffusion `255.255.255.255` | registre de l'IANA |

La liste bloque un peu plus que le strict nécessaire, délibérément : `192.0.0.0/24` et `2001::/23` sont rejetés en totalité bien que le registre marque comme globales certaines adresses isolées à l'intérieur. Ce sont des adresses de protocoles du réseau lui-même, pas des services web que quiconque voudrait surveiller, et une règle d'une seule ligne se vérifie bien plus facilement qu'une exception par adresse.

**L'IPv4 qui voyage à l'intérieur d'une IPv6.** Quatre formats d'IPv6 embarquent une IPv4 à l'intérieur, et dans les quatre cas ce qui compte est cette IPv4, `destinos.ts` l'extrait donc et la juge avec la liste IPv4, **avant** la liste blanche :

| Format IPv6 | Où se trouve l'IPv4 | Exemple |
|---|---|---|
| `::ffff:0:0/96`, IPv4 **mappée** ([RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html)) | dans les 32 derniers bits | `[::ffff:127.0.0.1]` est `127.0.0.1` |
| `::/96`, IPv4 **compatible**, obsolète (RFC 4291) | dans les 32 derniers bits | `[::7f00:1]` est `127.0.0.1` ; `::1` et `::` donnent `0.0.0.1` et `0.0.0.0` |
| `64:ff9b::/96`, **NAT64** ([RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html)) | dans les 32 derniers bits | `[64:ff9b::a9fe:a9fe]` est `169.254.169.254` |
| `2002::/16`, **6to4** ([RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html)) | dans les bits 16 à 47 | `[2002:a9fe:a9fe::]` est `169.254.169.254` |

L'ordre compte. 6to4 vit à l'intérieur de `2000::/3` et NAT64 à l'extérieur, et les deux possèdent des adresses publiques légitimes : `[64:ff9b::808:808]` et `[2002:808:808::1]` portent en elles `8.8.8.8`, une adresse publique, et doivent passer ; les mêmes formes avec une IPv4 privée à l'intérieur doivent être rejetées. Ni la liste blanche seule ni un blocage du préfixe entier ne distinguent les deux cas. Extraire l'IPv4 et la juger, oui.

Ce n'est pas une règle exhaustive de tout ce qui n'est pas public, mais elle couvre ce que le [guide de l'OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) inscrit sur sa liste minimale, et la partie qui s'étend le plus, celle de l'IPv6, se verrouille d'elle-même. Qu'une règle tienne sur un écran et puisse être auditée contre un registre public fait partie de la défense : une règle que personne ne comprend est une règle que personne ne relit. Et qu'elle ne soit jamais parfaite est la raison d'être de la seconde couche, celle du réseau.

#### 1.10.2 Les exécutions de rejet

Tente d'enregistrer l'adresse des métadonnées du cloud :

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

`400`, avec le motif : `169.254.169.254:80` est une adresse privée ou réservée. Le `revisor` ne l'a pas enregistrée et ne s'y connectera jamais. À présent, un nom qui n'a pas l'air dangereux, pointant vers le `revisor` lui-même :

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

Même `400`, avec un motif qui en dit moins que le précédent, à dessein. Dans le premier cas, l'adresse a été écrite par l'auteur de la requête, et la lui répéter ne lui apprend rien de nouveau. Dans le second, l'auteur ne connaît que le **nom** ; les adresses vers lesquelles il a résolu relèvent de la structure interne du réseau du `revisor`, et le message ne les divulgue pas. Sous macOS, `localhost` résout vers deux adresses, `::1` et `127.0.0.1`, toutes deux en loopback ; sous Linux, selon la configuration de `/etc/hosts`, il peut ne résoudre que vers `127.0.0.1`. La réponse reçue par le client est identique sur les deux systèmes, et c'est là un autre avantage de ne pas énumérer : ce que formule l'API ne dépend pas du système d'exploitation du serveur.

Et voici l'adresse des métadonnées d'un autre cloud, qui tombe dans l'espace partagé :

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

Enfin, les deux facettes de 6to4. `2002:a00:1::1` porte dans ses bits 16 à 47 les groupes `0a00` et `0001`, c'est-à-dire `10.0.0.1`, un réseau privé ; `2002:808:808::1` porte `0808` et `0808`, c'est-à-dire `8.8.8.8`, une adresse publique :

```text
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-1","url":"http://[2002:a00:1::1]/"}'
destino prohibido: [2002:a00:1::1]:80: dirección privada o reservada
 → 400
$ curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"tunel-2","url":"http://[2002:808:808::1]/"}'
{"id":4,"nombre":"tunel-2","url":"http://[2002:808:808::1]/","limite_ms":2000}
 → 201
```

Le premier est rejeté pour ce qu'il transporte à l'intérieur, bien qu'il appartienne à `2000::/3` ; le second est accepté, alors qu'une règle bloquant 6to4 en totalité l'aurait rejeté. L'enregistrement du second a créé le service 4, mais le `revisor` ne s'est connecté à rien : la première connexion aura lieu lors de la première vérification, et avant celle-ci la destination sera à nouveau vérifiée.

Si l'exploitant du `revisor` a besoin des adresses concrètes pour enquêter sur un rejet, leur place est dans le journal du serveur, jamais dans la réponse. Le `revisor` du cours ne les écrit nulle part : le commentaire de `destinos.ts` précise où elles iraient, et son terminal n'affiche rien d'autre que le `POST /servicios` habituel, afin que l'exécution soit identique sur tout système.

#### 1.10.3 La seconde vérification, avant de se connecter

La première vérification, tu l'as déjà vue. La seconde se trouve sur la première ligne de `revisar`, dans `cliente.ts`, et se manifeste lorsque la règle change entre l'enregistrement et la vérification. Les trois services de démarrage sont enregistrés directement dans le stockage, sans passer par la route d'enregistrement, il suffit donc de démarrer le `revisor` avec une liste d'adresses autorisées qui **n'inclut pas** le laboratoire. Arrête le `revisor` et démarre-le ainsi (le `9` est un port quelconque où rien n'écoute) :

```text
$ REVISOR_DESTINOS=127.0.0.1:9 node servidor.ts
revisor en http://127.0.0.1:18080
```

Puis demande une vérification de `catalogo` avec le programme de 1.6.4 :

```text
$ node fig01_02.ts 1
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 terminada
resultado: {"estado":"CAIDO","codigo":null,"ms":null,"detalle":"destino prohibido: 127.0.0.1:18081: dirección privada o reservada"}
```

Le service était enregistré, la vérification a été acceptée avec son `202` et son suivi a fonctionné, mais le `revisor` **ne s'est pas connecté** : avant de le faire, il a contrôlé à nouveau la destination, et `127.0.0.1:18081` n'était plus autorisé. Le résultat est `CAIDO`, sans code ni millisecondes, car aucun échange n'a eu lieu, et le détail explique pourquoi. Dans un système réel, ce qui change entre l'enregistrement et la vérification n'est pas la liste d'autorisations, mais ce que le DNS répond pour un nom d'hôte donné ; l'effet est le même, et c'est la raison d'être de cette double vérification. Arrête le `revisor` et redémarre-le sans la variable d'environnement.

### 1.11 Vérifier les types avec `tsc` (optionnel)

Comme dans la Leçon 0, Node exécute les programmes sans vérifier les types, et le cours les vérifie avec `tsc` en mode strict. Dès cette leçon, une option supplémentaire est nécessaire, `--allowImportingTsExtensions`, car les fichiers du `revisor` s'importent mutuellement avec l'extension `.ts` ; avec `--noEmit`, TypeScript l'autorise. Dans `~/curso-http/revisor/` :

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Si tout est en ordre, `tsc` n'affiche rien et termine avec le code 0, ce qui a été obtenu avec les dix fichiers de cette leçon (les neuf du `revisor` et `fig01_02.ts`).

## L'erreur que tu vas voir

**L'enregistrement qui a disparu sans erreur.** C'est celui de la scène d'ouverture, et tu vas à présent le provoquer. Envoie le même enregistrement aux deux anciennes routes, mais cette fois avec `-L`, afin que `curl` suive la redirection comme le ferait un programme. Sans `-X POST` : `-d` implique déjà `POST`, et c'est ce que ferait n'importe quel client. Si tu viens de 1.10.3, tu as déjà redémarré le `revisor` sans la variable d'environnement, il dispose donc de ses trois services de démarrage. D'abord, la route qui a déménagé avec `301` :

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

Deux réponses. La première est le `301`. La seconde est un `200` avec la liste des services, et `avisos` n'y figure pas. Lis le terminal du `revisor`, qui est le seul à raconter ce qui s'est réellement passé :

```text
POST /viejo/servicios
GET /servicios
```

`curl` a suivi le `301`, comme l'autorise la RFC 9110 et comme l'indique son manuel : il a converti le `POST` en `GET` et a abandonné le corps. Le `revisor` a reçu une consultation, a répondu avec la liste dans un `200` honnête, et personne n'a menti à aucune étape. Pour l'auteur de l'enregistrement, le résultat est un `200` et un service qui n'existe nulle part. À présent, la route ayant déménagé avec `308` :

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

Le `308` puis un `201` avec `Location: /servicios/4`. Le terminal du `revisor` :

```text
POST /api/servicios
POST /servicios
```

Le `POST` est arrivé sous forme de `POST`, avec son corps, et l'enregistrement a eu lieu. Pour le vérifier de la façon la plus simple, demande la liste :

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

`avisos` est le service 4. Celui du `301` n'existe nulle part.

**Ce qui ne va pas et comment le corriger.** `curl` n'est pas en tort, le `revisor` non plus, ni la personne ayant procédé à l'enregistrement : chacun a fait ce que sa spécification lui permet. Ce qui ne va pas, c'est **le choix du code** pour une route recevant des écritures. La correction consiste à choisir `308` (ou `307`, si le déplacement est temporaire) pour toute ancienne route susceptible de recevoir autre chose qu'un `GET` ou un `HEAD`. Et du côté client, il y a une leçon tout aussi utile : un programme qui écrit ne devrait pas suivre aveuglément les redirections. S'il reçoit un `301` en réponse à un `POST`, la bonne conduite consiste à alerter et à mettre à jour l'adresse configurée, sans la suivre ; la [Leçon 7](07-quien-lee-el-error.md) inscrit cette décision dans la table de décision du client. `curl` dispose d'une option pour conserver le `POST` après un `301`, `--post301`, et l'exercice 2 t'invite à la tester ; elle existe précisément parce que cette conversion est le comportement par défaut. C'est une option de `curl` et de peu d'autres clients : `fetch`, par exemple, n'a pas d'équivalent et convertit le `POST` en `GET` après un `301` en vertu de sa spécification, si bien que le problème ne se règle pas du côté client. La vraie correction relève du serveur : choisir le code qui ne laisse aucune place au doute.

**Un piège lors de la reproduction : `-X POST` avec `-L`.** Si par habitude tu ajoutes `-X POST` en plus de `-d`, le résultat est tout autre et ne se comprend pas au premier abord :

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

`-X` ne dit pas à `curl` « la première requête est un `POST` », mais « utilise `POST` sur **toutes** les requêtes », y compris celle qui suit la redirection. Le manuel de `curl` met en garde : avec `-L`, la méthode définie par `-X` s'applique à chaque requête et peut produire des effets inattendus. `curl` a donc suivi le `301` avec un `POST`, mais a appliqué l'autre moitié de la règle des redirections et n'a pas transmis le corps. Le `revisor` a reçu un `POST /servicios` vide et a répondu `400 el cuerpo no es JSON` : le défaut n'est pas reproduit et rien n'est créé. (Sans `-sS`, `curl` peut en outre afficher une note signalant que le `-X` est superflu.) Pour observer le défaut tel que le verrait un programme, laisse `-d` déterminer la méthode.

**La méthode qui n'existe pas répond `404`.** L'autre erreur de cette leçon est le défaut délibéré. Demande une méthode que la route n'admet pas :

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

La route `/servicios/1` existe bel et bien : avec `GET`, elle répond. Avec `PATCH`, le `revisor` affirme « no existe esa ruta », ce qui est faux. Le code correct est `405 Method Not Allowed`, assorti de l'en-tête `Allow` listant les méthodes qui sont effectivement admises, et la Leçon 0 t'a enseigné que `Allow` est obligatoire dans un `405`. Un client recevant ce `404` en déduit qu'il s'est trompé d'adresse, alors qu'il s'est trompé de méthode. Cela se résout en faisant en sorte qu'`atender` distingue les deux cas, et c'est la toute première chose que fait la Leçon 2.

## Ce qui se fait de travers

**Répondre `200` à tout ce qui s'est bien passé.** Un enregistrement avec `200` laisse le client sans `Location` ; une opération à peine commencée à laquelle on répond `200` lui fait croire qu'elle est déjà finie ; un retrait avec `200` et `{"ok": true}` le force à analyser un corps qui ne dit rien de plus que ce que le code d'état exprimait déjà. Les quatre succès de cette leçon existent pour que le client sache quoi faire sans lire le corps.

**Un `201` sans `Location`.** La RFC autorise à l'omettre, et dans ce cas la ressource créée est considérée comme étant la route même de la requête. Lors d'un enregistrement sur `/servicios`, c'est faux : le service ne vit pas là. Le client est obligé de deviner l'`id` dans le corps, avec un nom de champ qui change d'une API à l'autre.

**Un `202` sans endroit où demander.** Répondre `202` sans fournir de ressource de suivi place le client face à deux mauvaises options : croire que l'opération a déjà eu lieu ou la répéter. Si le `202` n'apporte pas de `Location` ni de corps expliquant comment suivre l'état, il manque la moitié de la réponse.

**Consulter le suivi sans marquer de pause.** Le client qui demande cinq mille fois par seconde « est-ce fini ? » transforme une opération asynchrone en une attaque contre le serveur lui-même. `Retry-After` existe pour cela ; s'il manque, le client doit instaurer une pause minimale.

**Utiliser `301` sur une route recevant des écritures.** C'est l'erreur phare de cette leçon : le `POST` devient un `GET` et le corps est jeté, sans aucune erreur. Pour les routes recevant des écritures, `308`.

**Mettre un corps dans un `204` ou un `304`.** La RFC stipule qu'ils ne peuvent pas en porter. Node, d'ailleurs, n'envoie pas de corps pour ces deux codes même si tu l'écris, mais d'autres serveurs le font, et le client lit alors ce corps comme le début de la réponse suivante : le dialogue se désynchronise et les réponses parviennent à qui ne les a pas demandées. C'est l'une des rares violations de la spécification qui n'est pas seulement inélégante, mais qui corrompt directement la connexion.

**Un `304` sans `ETag`.** La RFC oblige à envoyer dans le `304` les en-têtes qu'aurait envoyés le `200`, parmi lesquels l'`ETag`. Sans lui, le client n'a aucun moyen de confirmer que sa copie est bien celle en vigueur.

**Se connecter à l'URL fournie sans vérifier où elle mène.** C'est la porte ouverte au SSRF. Vérifier le texte de l'URL ne suffit pas : il faut vérifier les adresses vers lesquelles elle résout, avant chaque connexion, et ne pas suivre les redirections.

## Exercices

Tous les quatre s'auto-corrigent : chacun se termine par une exécution qui t'indique si tu as vu juste. Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** de lancer quoi que ce soit. Redémarre le laboratoire et le `revisor` **une seule fois**, avant l'exercice 1, et enchaîne les quatre à la suite : les numéros de service des solutions supposent cet ordre.

### Exercice 1 — Quatre conditions

Demande `GET /servicios/1` avec `curl -i` et note son `ETag` ; dans la solution, il s'agit de `"1-1-0e296858"`, et la tienne se terminera différemment. Prédis quel code le `revisor` renvoie à chacune de ces requêtes :

1. `GET /servicios/1` avec `If-None-Match: "1-1"`, l'étiquette saisie manuellement, sans l'identifiant de démarrage.
2. `GET /servicios/1` avec `If-None-Match: W/` suivi de ton étiquette.
3. `GET /servicios/1` avec `If-None-Match: "9-9-00000000", W/"8-8-00000000"`.
4. `GET /servicios/99` avec `If-None-Match: *`.

Lance les quatre avec `curl -s -o /dev/null -w '%{http_code}\n'` suivi de l'adresse et de `-H 'If-None-Match: …'`, puis compare.

### Exercice 2 — Conserver le `POST` après un `301`

La section « L'erreur que tu vas voir » indique que `curl` dispose d'une option, `--post301`, qui conserve le `POST` lors du suivi d'un `301`. Prédis ce que répond cette requête, combien de lignes d'état tu vas observer et ce qu'affiche le terminal du `revisor` :

```bash
curl -i -L --post301 http://127.0.0.1:18080/viejo/servicios -H 'Content-Type: application/json' -d '{"nombre":"avisos","url":"http://127.0.0.1:18081/codigo/200"}'
```

Exécute la commande et compare. Ensuite, réponds : si `curl` peut le faire, pourquoi la section affirme-t-elle que la véritable solution est de changer le code HTTP et non de demander à chaque client d'utiliser cette option ?

### Exercice 3 — Cinq destinations

Prédis lesquelles de ces URL sont acceptées par l'enregistrement du `revisor` et, pour celles rejetées, ce qu'indique le motif (toutes sont écrites sous forme d'adresses, sauf la dernière, le motif nomme donc l'adresse) :

1. `http://2130706433:18081/codigo/200`
2. `http://2130706433:18080/servicios`
3. `http://[::ffff:127.0.0.1]:18081/codigo/200`
4. `http://[64:ff9b::a9fe:a9fe]/`
5. `http://example.com/`

Pour chacune, envoie un enregistrement avec un nom distinct (`d1` à `d5`) et regarde seulement le corps et le code, avec `curl -s -w ' → %{http_code}\n' -X POST http://127.0.0.1:18080/servicios -H 'Content-Type: application/json' -d '{"nombre":"d1","url":"…"}'`. La cinquième nécessite que ta machine ait un accès à internet pour résoudre le nom d'hôte.

### Exercice 4 — Le suivi d'une vérification qui ne se termine pas

Copie `fig01_02.ts` sous le nom `ej4.ts` et remplace le plafond de dix consultations par deux (`consulta <= 2`). Prédis ce qu'affiche `node ej4.ts 2` et avec quel code de sortie il se termine (`echo $?`). Ensuite, lance-le. Le programme fait-il la différence entre « la vérification est terminée » et « j'ai cessé de demander » ? Si non, que lui manque-t-il ?

## Solutions

### Solution 1

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

`200`, `304`, `200` et `404`. La première ne correspond pas car une étiquette est opaque : `"1-1"` n'est pas une sous-partie de `"1-1-0e296858"`, c'est une autre étiquette, et la comparaison porte sur l'intégralité du texte entre guillemets. (Avant un redémarrage, c'est précisément l'étiquette qui donnerait à un client une copie erronée ; d'où l'identifiant de démarrage.) La deuxième correspond parce qu'`If-None-Match` compare de façon faible, et `W/` ne compte pas. La troisième est une liste valide dans laquelle **aucune** étiquette ne correspond, le serveur répond donc avec le contenu complet. La quatrième est le piège : `*` signifie « n'importe quelle version dont tu disposes », mais le service 99 n'existe pas, il n'y a donc aucune version à confirmer ; le `revisor` le recherche avant d'examiner la condition et répond `404`. Un `304` confirmerait ici au client une copie de quelque chose qui n'existe pas.

### Solution 2

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

Deux lignes d'état : le `301` et un `201`. Dans le terminal du `revisor`, `POST /viejo/servicios` puis `POST /servicios` : avec `--post301`, `curl` a répété le `POST` avec son corps vers la nouvelle adresse et l'enregistrement a bien eu lieu, avec l'id 4 car c'est le premier enregistrement de ce démarrage. L'option existe, mais la solution demeure le code HTTP côté serveur, pour une raison pratique : tu as le contrôle sur ton serveur, mais pas sur les clients. Tu peux placer `--post301` dans tes scripts, mais pas dans le programme de celui qui consomme ton API, ni dans sa bibliothèque HTTP, ni dans le `fetch` de son navigateur, qui selon le standard Fetch convertit le `POST` en `GET` sans offrir d'option pour l'éviter. Un `308` fonctionne de manière identique pour tous ces clients, sans rien exiger de personne.

### Solution 3

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

Deux sont acceptées et trois sont rejetées, la première étant le piège. `http://2130706433:18081/` **est acceptée** : l'analyseur d'URL convertit `2130706433` en `127.0.0.1`, et `127.0.0.1:18081` constitue précisément l'exception du laboratoire. La défense ne s'est pas laissé abuser par la syntaxe inhabituelle ; au contraire, elle a déterminé où elle menait réellement, et cette destination est autorisée. Avec le port 18080, elle est rejetée, et le motif indique `127.0.0.1:18080`, et non `2130706433` : le `revisor` juge l'adresse normalisée. La troisième relève également du loopback, écrite sous forme d'IPv4 mappée : l'analyseur la normalise en `::ffff:7f00:1`, qui ne figure pas dans la liste d'autorisations (la liste comparant des chaînes exactes), et `destinos.ts` en extrait `127.0.0.1` qu'il identifie comme étant du loopback. La quatrième est l'IPv4 `169.254.169.254` dissimulée derrière le préfixe NAT64 : sur un réseau doté de NAT64, elle mènerait aux métadonnées, et elle est rejetée en raison de ce qu'elle transporte. La cinquième résout vers des adresses publiques et est acceptée (si ta machine n'a pas accès à internet, elle est rejetée avec « el nombre example.com no se pudo resolver », ce qui constitue le comportement attendu : ce qui ne peut être résolu ne peut être surveillé). Aucun enregistrement n'a établi de connexion : accepter la destination se limite à l'enregistrer ; la première connexion intervient lors de la première vérification, et la destination est revérifiée avant d'y procéder.

### Solution 4

```text
$ node ej4.ts 2; echo $?
202 Accepted; seguimiento en /revisiones/1
consulta 1: 200 pendiente, Retry-After: 1
consulta 2: 200 pendiente, Retry-After: 1
0
```

Avec deux consultations, le programme n'a jamais vu l'état `terminada`, a affiché les deux lignes `pendiente`, est sorti de la boucle sans rien signaler et s'est terminé avec le code 0, exactement comme si tout s'était bien déroulé. (La deuxième consultation arrive une seconde après la première, et la vérification attend une seconde dans la file : c'est une situation de concurrence (*race condition*) à la milliseconde près. Si dans ton exécution la deuxième consultation l'a déjà trouvée terminée, c'est la vérification qui l'a emporté ; règle le plafond à une seule consultation et tu observeras le même défaut.) C'est le défaut mis en évidence par l'exercice : le programme ne distingue pas « s'est terminé » d'« a abandonné les demandes ». Il lui manque une ligne après la boucle qui, s'il n'a jamais vu l'état `terminada`, le signale et quitte avec un code différent de zéro, par exemple `console.log("la revisión no terminó a tiempo"); process.exit(1);`, et pour cela il faut mémoriser dans une variable si elle s'est achevée. C'est le même principe que celui de la Leçon 0, appliqué côté client : le code de sortie constitue lui aussi un contrat, et un code `0` ne signifiant pas le succès trompe le script qui le lit tout autant qu'un `200` renfermant une erreur.

## Comment savoir que tu as réussi

- [ ] Avec le laboratoire et le `revisor` en fonctionnement, `curl -i http://127.0.0.1:18080/servicios` renvoie un `200` avec les trois services de démarrage.
- [ ] L'enregistrement de 1.5.2 renvoie un `201` avec `Location: /servicios/4` et un `ETag` de la forme `"4-1-` suivie de huit chiffres hexadécimaux, et tu sais expliquer ce qu'identifie chaque en-tête et chaque partie de l'étiquette.
- [ ] `-d 'null'` renvoie un `400` avec « el cuerpo no es un objeto JSON », et la requête suivante répond `200`.
- [ ] Demander une vérification renvoie un `202` avec `Location: /revisiones/1` ; la consulter immédiatement renvoie un `200` avec `"pendiente"` et `Retry-After: 1`, et deux secondes plus tard, `"terminada"`. Tu sais expliquer pourquoi le premier code est `202` et le second `200`.
- [ ] `node fig01_02.ts 1` suit la vérification jusqu'à `ARRIBA` en respectant `Retry-After`, en deux ou trois consultations.
- [ ] Retirer le service 4 renvoie un `204` sans `Content-Type` ni `Content-Length` ; le demander ensuite renvoie `404`, et tu sais expliquer pourquoi le `DELETE` demeure idempotent.
- [ ] `GET /servicios/1` avec `If-None-Match` et l'étiquette que t'a fournie le `revisor` renvoie un `304` avec `ETag` et sans corps ; avec `W/` devant, dans une liste ou avec `*`, également. Tu sais quels en-têtes doit obligatoirement porter un `304` selon la RFC 9110.
- [ ] Après avoir redémarré le `revisor`, l'étiquette précédente renvoie un `200` avec une nouvelle étiquette, et tu sais expliquer pourquoi cela évite un faux `304`.
- [ ] Avec `curl -L`, l'enregistrement vers `/viejo/servicios` aboutit à un `200` avec la liste et le terminal du `revisor` affiche `GET /servicios` ; l'enregistrement vers `/api/servicios` aboutit à un `201` et le terminal affiche `POST /servicios`.
- [ ] Les enregistrements de l'encadré renvoient un `400` avec « destino prohibido », et tu sais expliquer dans quel cas `localhost:18081` est rejeté et dans quel cas il est accepté, bien que `127.0.0.1:18081` soit toujours accepté.
- [ ] Tu sais expliquer ce qu'est le DNS rebinding, pourquoi valider avant chaque connexion ne le résout pas entièrement et ce que fait la défense complète qui arrive dans la Leçon 8.
- [ ] Au terme de la leçon, aucun programme ne reste en écoute : `curl -i http://127.0.0.1:18080/` et `curl -i http://127.0.0.1:18081/` renvoient l'erreur 7.

## Résumé

Réponds sans consulter la leçon :

1. Quelles sont les trois questions qui départagent `200`, `201`, `202` et `204` ?
2. Qu'identifie `Location` dans un `201` ? Et dans un `202` ? Et dans un `301` ?
3. Pourquoi un `202` devrait-il pointer vers une ressource de suivi, selon la RFC 9110 ? Quel code renvoie cette ressource tant que l'opération est en attente ?
4. Pourquoi le second `DELETE` du même service répond-il `404` tout en restant une méthode idempotente ?
5. Qu'est-ce qu'un `ETag`, à quoi sert `If-None-Match` et pourquoi un `304` ne porte-t-il pas de corps ? Pourquoi l'étiquette du `revisor` change-t-elle à chaque démarrage ?
6. Qu'arrive-t-il à un `POST` recevant un `301` lorsqu'il est suivi par `curl -L` ? Et à celui qui reçoit un `308` ? Pourquoi cette différence existe-t-elle ?
7. Qu'est-ce que le SSRF, pourquoi le `revisor` le porte-t-il dès sa naissance et pourquoi vérifie-t-il la destination à deux reprises ?
8. Qu'est-ce que le DNS rebinding, que fait le `revisor` de cette leçon pour s'en prémunir et comment s'en protège-t-on de manière absolue ?

## Sources

Toutes ont été consultées le 21 octobre 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), sections 15.3.1, 15.3.2, 15.3.3 et 15.3.5 : `200`, `201`, `202` et `204` ; le contenu du `200` selon la méthode, `Location` et les validateurs du `201`, le `202` « intentionnellement évasif » avec son moniteur d'état, et le `204` qui ne peut porter de corps.
2. [RFC 9110, section 15.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4), et sections 15.4.2, 15.4.5 et 15.4.9 : l'histoire du `POST` converti en `GET`, le `301`, le `304` avec les en-têtes qu'il doit générer, et le `308`.
3. [RFC 9110, sections 9.2.2, 9.3.3 et 9.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) : les méthodes idempotentes, le `201` avec `Location` pour un `POST` qui crée, et les trois réponses possibles à un `DELETE` réussi.
4. [RFC 9110, sections 8.6, 8.8.1, 8.8.3, 8.8.3.1 et 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3) : `Content-Length` dans `204` et `304` ; une étiquette forte n'est pas réutilisée pour une autre représentation ; l'`ETag` comme texte opaque entre guillemets et son exemple avec un numéro de révision ; les comparaisons forte et faible.
5. [RFC 9110, sections 10.2.2, 10.2.3 et 13.1.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2) : `Location` comme référence relative, `Retry-After`, et l'évaluation d'`If-None-Match` (`*` ou une liste, comparaison faible, `304` pour `GET` et `HEAD`, `412` pour le reste).
6. [RFC 7538, *The Hypertext Transfer Protocol Status Code 308 (Permanent Redirect)*](https://www.rfc-editor.org/rfc/rfc7538.html), avril 2015, qui a standardisé le `308` de la [RFC 7238](https://www.rfc-editor.org/rfc/rfc7238.html) (juin 2014, expérimental), et la précaution vis-à-vis des clients ne le connaissant pas (section 4).
7. [Standard Fetch, WHATWG](https://fetch.spec.whatwg.org/#http-redirect-fetch), algorithme *HTTP-redirect fetch* : après un `301` ou un `302` en réponse à un `POST`, la méthode devient `GET` et le corps est ignoré.
8. [Manuel de `curl`](https://curl.se/docs/manpage.html) : `-L` et la conversion de `POST` en `GET` après `301`, `302` et `303` ; `--post301` ; `-d` et `-X`. Consulté également dans `man curl` de la version 8.7.1.
9. [OWASP API Security Top 10, édition 2023 : API7:2023 Server Side Request Forgery](https://api-security.owasp.org/editions/2023/en/0xa7-server-side-request-forgery/) : la définition du SSRF, pourquoi les *webhooks* et les prévisualisations le rendent fréquent, et la recommandation de désactiver les redirections et d'utiliser des listes d'autorisations.
10. [OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) : les métadonnées du cloud comme cible, la liste minimale de plages (incluant la multidiffusion), les encodages alternatifs d'une IPv4, le DNS rebinding et la connexion à l'adresse déjà validée.
11. [AWS, *Use the Instance Metadata Service to access instance metadata*](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) et [Alibaba Cloud, *View instance metadata*](https://www.alibabacloud.com/help/en/ecs/user-guide/view-instance-metadata) : les adresses `169.254.169.254` (et `[fd00:ec2::254]`) et `100.100.100.200` de leurs services de métadonnées.
12. [Standard URL, WHATWG](https://url.spec.whatwg.org/#concept-ipv4-parser), l'analyseur IPv4 : accepte une adresse écrite sous forme d'un nombre unique, en hexadécimal ou en octal, et la normalise.
13. Les blocs de `destinos.ts` : les registres d'adresses à usage spécial de l'IANA, [IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) et [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/), et l'[espace d'adresses IPv6](https://www.iana.org/assignments/ipv6-address-space/) (`2000::/3`, *Global Unicast*) ; [RFC 1918](https://www.rfc-editor.org/rfc/rfc1918.html) (réseaux privés), [RFC 3927](https://www.rfc-editor.org/rfc/rfc3927.html) (lien local `169.254/16`), [RFC 4291](https://www.rfc-editor.org/rfc/rfc4291.html) (lien local, multidiffusion et IPv4 mappée en IPv6), [RFC 4193](https://www.rfc-editor.org/rfc/rfc4193.html) (adresses locales uniques), [RFC 5771](https://www.rfc-editor.org/rfc/rfc5771.html) (multidiffusion IPv4), [RFC 6052](https://www.rfc-editor.org/rfc/rfc6052.html) (le préfixe de NAT64), [RFC 3056](https://www.rfc-editor.org/rfc/rfc3056.html) (6to4, février 2001), [RFC 6598](https://www.rfc-editor.org/rfc/rfc6598.html) (espace partagé `100.64/10`) et [RFC 6890](https://www.rfc-editor.org/rfc/rfc6890.html) (le registre d'adresses à usage spécial).
14. [Node.js 24 : DNS](https://nodejs.org/docs/latest-v24.x/api/dns.html), [Node.js 24 : Net](https://nodejs.org/docs/latest-v24.x/api/net.html) et [Node.js 24 : HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html) : `dns.lookup` avec `all: true` et son utilisation de la résolution système, `net.BlockList` et les IPv4 écrites sous forme d'IPv6, ainsi que l'option `lookup` de `http.request`.

### Termes de cette leçon

| | |
|---|---|
| **DNS rebinding** | changer ce que résout un nom entre le contrôle et la connexion, afin que le serveur se connecte à une adresse qui n'a pas été vérifiée |
| **comparaison faible** | celle qu'utilise `If-None-Match` : deux étiquettes correspondent si leur texte entre guillemets est identique, qu'elles portent `W/` ou non |
| **`ETag`** (*entity tag*) | étiquette opaque entre guillemets identifiant une version d'une ressource |
| **identifiant de démarrage** | les huit chiffres aléatoires que le `revisor` tire au sort au démarrage et ajoute à chaque étiquette, afin que les étiquettes ne se répètent pas après un redémarrage |
| **idempotent** | une méthode dont l'effet sur le serveur est identique qu'elle soit répétée ou exécutée une seule fois |
| **liste blanche / liste noire** | une règle qui nomme ce qui est autorisé et rejette le reste, ou qui nomme ce qui est interdit et accepte le reste |
| **loopback** | les adresses de la machine elle-même : `127.0.0.0/8` et `::1` |
| **métadonnées du cloud** | le service sur `169.254.169.254` où un cloud publie des données relatives à la machine, parfois accompagnées d'identifiants |
| **requête conditionnelle** | une requête demandant à n'être exécutée que si une condition sur la version de la ressource est remplie, telle qu'`If-None-Match` |
| **ressource de suivi** | la ressource pointée par un `202`, auprès de laquelle le client se renseigne sur l'avancement de l'opération |
| **référence relative** | une adresse sans serveur ni port, telle que `/servicios/4`, qui est complétée avec celle de la requête d'origine |
| **SSRF** | parvenir à faire exécuter par un serveur une requête choisie par une tierce personne, depuis le réseau de ce serveur |

---

**Suivante :** [Leçon 2 — Le client s'est trompé (I) : 400, 401, 403, 404, 405 et 415](02-errores-del-cliente-peticion.md)

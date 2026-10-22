# Leçon 0 — Le contrat qui voyage par HTTP

Il est 23 h 40 un vendredi. Le tableau de bord du `revisor` indique que les quatre services sont opérationnels : `catalogo`, `inventario`, `pagos` et `reportes`, tous les quatre au vert. Le moniteur de l'entreprise est lui aussi au vert : zéro erreur au cours de la dernière heure. Et pourtant, le canal de support se remplit de messages d'utilisateurs qui ne parviennent pas à payer. Quelqu'un ouvre un terminal, demande à `pagos` son état et lit la réponse complète pour la première fois de la soirée. La première ligne indique `HTTP/1.1 200 OK`. Le corps, trois lignes plus bas, indique `{"error": "la base de datos no está disponible"}`. Tous les programmes qui surveillaient le service ont lu la première ligne et se sont rassurés. Aucun n'a lu le corps. Le service était en panne depuis quarante minutes, en affirmant que tout allait bien.

Cette leçon porte sur cette première ligne : ce qu'elle dit, qui la lit et pourquoi elle ne peut pas mentir.

**Durée :** 90 min, ou 2 × 45 (la coupure se situe entre les sections 0.4 et 0.5)

**Ce que tu construis :** l'environnement du cours (Node 24 et `curl`), ton premier serveur HTTP et le **banc d'essai** que tu vas utiliser dans toutes les leçons : un serveur qui renvoie le code d'état demandé (`GET /codigo/503`) avec les en-têtes que ce code comporte

**Ce que tu apprends :** ce qu'est une réponse HTTP (ligne d'état, en-têtes, corps) ; les cinq familles de codes ; **le code fait foi et le corps explique** ; ce que fait un programme face à un code qu'il ne connaît pas ; où se trouvent les registres officiels de codes, d'en-têtes et de types de problème ; et pourquoi un `200` avec `{"error": …}` trompe le cache, le moniteur et le client

**D'où tu viens.** Tu n'apportes rien de ce cours pour l'instant. Tu apportes, en revanche, ce que demande le [README](README.md) : tu as déjà écrit une API, dans n'importe quel langage, tu sais ce qu'est une requête HTTP et ce qu'est JSON, et tu lis un programme court en TypeScript. Il n'est pas nécessaire de connaître une quelconque spécification : chaque fois que la leçon en cite une, elle t'indique la section et ce qu'elle dit.

**Ce que cette leçon ne fait pas.** Elle n'enseigne pas à choisir un code pour une situation concrète : cela commence à la [Leçon 1](01-exitos-redirecciones.md) avec les succès et se poursuit jusqu'à la 4 avec les erreurs. Elle ne formate pas le corps des erreurs : ici le corps est une simple ligne de texte, et la [Leçon 5](05-problem-details.md) le remplace par `application/problem+json`. Et le cache qui apparaît à la section 0.8 est un cache **de laboratoire**, d'une soixantaine de lignes, qui applique deux règles réelles des spécifications ; il sert à observer le problème de tes propres yeux, pas à être utilisé en production.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sous macOS avec Node 24.14.1 et curl 8.7.1, et ont été reproduites intégralement dans un conteneur Ubuntu 24.04.5 (la base de Linux Mint 22) avec Node 24.22.0 et curl 8.5.0, le `curl` qu'installe `apt`. Les deux exécutions ont donné la même chose ligne par ligne sauf sur trois points, signalés là où ils apparaissent : la date de l'en-tête `Date` (ce sera celle de ton jour), la version de `curl` visible dans `curl -v`, et le numéro d'erreur « adresse déjà utilisée » (`-48` sous macOS, `-98` sous Linux). Rien n'a été exécuté sur une installation de bureau de Mint. Les programmes se trouvent dans [`programas/00-el-contrato-que-viaja/`](../programas/00-el-contrato-que-viaja), dans le dépôt du cours, chacun accompagné de son exécution dans un fichier `fig00_NN.salida.txt`. Tous passent `tsc` en mode strict (la section 0.9 indique comment le vérifier).

## À la fin, tu seras capable de

- Démarrer un serveur HTTP avec Node 24 sans dépendances et l'interroger avec `curl -i`, `curl -v` et `curl -I`.
- Identifier dans une réponse réelle la ligne d'état, chaque en-tête, la ligne vide et le corps, et préciser quelle partie lit chaque programme sur le trajet.
- Donner la famille de n'importe quel code à trois chiffres et ce que doit faire un client face à un code qu'il ne connaît pas, en citant la règle de la RFC 9110.
- Déclencher à volonté n'importe quel code avec le banc d'essai et vérifier avec `curl` les en-têtes qu'il comporte.
- Trouver un code ou un en-tête dans le registre de l'IANA et compter combien de codes sont assignés dans une famille sans tomber dans le piège des lignes « Unassigned ».
- Démontrer par une exécution qu'un `200` portant une erreur dans le corps passe le contrôle de santé (health check) de `curl -f`, est conservé dans un cache et empêche celui-ci de servir la copie valide.

## Le pourquoi avant le comment

Une API communique avec de nombreux programmes que tu ne connais pas. Celui qui l'a appelée, oui : tu l'as écrit toi-même ou quelqu'un de ton équipe l'a fait, et il sait lire ton JSON. Mais entre ce programme et ton serveur s'interposent d'autres logiciels qui n'ont jamais lu ta documentation : un équilibreur de charge qui décide vers quelle machine acheminer chaque requête, un cache qui conserve des réponses pour éviter de répéter le travail, un moniteur qui compte les erreurs par minute, un contrôle de santé qui redémarre le service s'il ne répond pas correctement, et le client HTTP propre à chaque langage, doté de ses règles intégrées. **Aucun d'entre eux n'a besoin de comprendre ton corps. Tous comprennent le numéro.** (Certaines passerelles inspectent le contenu, et certains clients le lisent ; mais tu ne peux pas compter sur eux, et le numéro est la seule chose que tous ont en commun.)

C'est pourquoi la première ligne d'une réponse constitue un contrat. Ce n'est pas un contrat signé avec une personne, mais avec l'ensemble des logiciels déjà existants qui respectent les mêmes spécifications. Lorsque ton serveur répond `503`, chacun de ces programmes apprend quelque chose sans te poser de questions : le moniteur le comptabilise comme une panne, le contrôle de santé le signale, le cache peut servir une copie précédente, le client sait que le problème ne vient pas de lui. Lorsqu'il répond `200`, tous concluent que tout s'est bien déroulé, quoi que dise le corps. La scène du début n'a rien d'exagéré : c'est exactement ce qui se produit lorsque le numéro et le corps affirment des choses différentes, et le numéro l'emporte car c'est la seule chose que presque tous lisent.

Dans le `revisor`, cette réalité se vit des deux côtés. En tant que **client**, le `revisor` interroge des services tiers et détermine s'ils sont opérationnels d'après ce qu'ils répondent ; si un service ment avec un `200`, le `revisor` ment avec lui. En tant que **serveur**, le `revisor` est une API que quelqu'un d'autre va consulter, et ses erreurs doivent dire la vérité dans leur numéro pour ne pas tromper ses propres clients, moniteurs et caches.

La leçon comporte cinq parties, dans cet ordre :

1. **L'environnement et la première réponse** (0.1 et 0.2) : tu installes Node 24, démarres un serveur d'une quinzaine de lignes et examines ce qui transite réellement.
2. **Les familles** (0.3) : le premier chiffre du code, et la question à laquelle chaque famille répond.
3. **Le banc d'essai** (0.4) : le serveur qui renvoie le code que tu lui demandes, et que tu vas utiliser tout au long du cours.
4. **Qui lit quoi** (0.5 à 0.7) : le code fait foi et le corps explique ; ce que fait un programme face à un code qu'il ne connaît pas ; et où sont consignés les codes existants.
5. **Les dommages** (0.8) : un cache, un moniteur et un client face à un serveur qui ment et un autre qui dit la vérité.

Avec cette destination à l'esprit, voici ce que tu verras à la section 0.8 : le même service en panne, à travers un cache, en deux versions. Dans la première, le serveur a répondu `200` avec son erreur, et le cache l'a enregistrée et la répète. Dans la seconde, le serveur a répondu `503`, et le cache a servi la dernière copie valide :

```text
{"error":"la base de datos no está disponible"}
```

```text
{"servicios":["catalogo","pagos"]}
```

La seule chose qui a changé entre les deux exécutions est le numéro.

## Les concepts

### 0.1 L'environnement : Node 24, `curl` et un dossier

#### 0.1.1 `curl`

`curl` est l'instrument du cours : un programme en ligne de commande qui effectue une requête HTTP et t'affiche ce que le serveur a répondu, sans interface séduisante pour dissimuler quoi que ce soit. Il vient en premier parce que tu en as besoin pour installer Node, puis pour tout le reste. Si `curl --version` ne répond pas, installe-le :

```bash
sudo apt install curl
```

#### 0.1.2 Node 24

Les programmes du cours sont en TypeScript et sont exécutés par **Node.js 24**. Node 24 possède une caractéristique dont ce cours tire parti : il exécute directement un fichier `.ts`, en en **retirant les types** avant de le lancer, sans le compiler en JavaScript et sans installer quoi que ce soit d'autre. La [documentation de Node 24](https://nodejs.org/docs/latest-v24.x/api/typescript.html) le décrit ainsi : Node remplace les annotations de type par des espaces et exécute ce qui reste ; c'est pourquoi il n'accepte que le TypeScript qui peut être « effacé » sans altérer le programme. Ce qui ne peut pas être effacé ainsi (un `enum`, un `namespace` contenant du code, les propriétés déclarées dans les paramètres d'un constructeur) produit une erreur, et les programmes du cours ne l'utilisent pas. Cette fonctionnalité est activée par défaut depuis Node 23.6, a cessé d'afficher l'avertissement « experimental » dans la 24.3 et a été déclarée stable dans la 24.12.

Pourquoi Node 24 et pas une autre version ? Parce qu'il s'agit d'une branche **LTS** (*long-term support*, support à long terme). Selon le [calendrier officiel des versions de Node](https://github.com/nodejs/Release), la version 24 est entrée en LTS le 28 octobre 2025, est passée en phase de maintenance le 20 octobre 2026 et reçoit des correctifs jusqu'au 30 avril 2028. La version 26 sera LTS à partir du 28 octobre 2026 ; les programmes de ce cours n'utilisent rien qui change entre les deux.

Sous Linux Mint 22, il ne convient pas d'installer Node avec `apt` : Mint 22 est basée sur Ubuntu 24.04, et le paquet `nodejs` de cette base correspond à la version 18.19.1 (cela a été vérifié avec `apt-cache policy nodejs` dans un conteneur Ubuntu 24.04), une branche qui ne reçoit plus de correctifs. On l'installe avec **nvm**, le gestionnaire de versions de Node recommandé par la [page de téléchargement de Node](https://nodejs.org/en/download), tout comme dans le cours de TypeScript de Hábil. La [documentation de nvm](https://github.com/nvm-sh/nvm) publie cet installateur pour sa version 0.40.8, la version actuelle :

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

> **Note de sécurité.** Le tube `| bash` exécute sur ta machine, sans que tu le lises, ce que renvoie cette adresse. Ici, c'est raisonnable parce qu'il s'agit de l'installateur officiel de `nvm`, par HTTPS et avec une version fixe (`v0.40.8`), mais ne le fais jamais avec une adresse que tu ne connais pas. Si tu souhaites l'examiner au préalable, télécharge-le dans un fichier (`curl -o installer-nvm.sh` avec la même adresse), lis-le, puis exécute-le avec `bash installer-nvm.sh`.

Ferme le terminal, ouvre-en un autre (l'installateur ajoute `nvm` à ton fichier de démarrage, et le terminal déjà ouvert n'en est pas informé) et demande la branche 24 :

```bash
nvm install 24
nvm alias default 24
node -v
```

`node -v` doit afficher un numéro commençant par `v24`. Le numéro suivant dépend du jour où tu réalises l'installation ; les exécutions de cette leçon ont été faites avec la 24.14.1 et la 24.22.0, et ont donné le même résultat.

#### 0.1.3 Le dossier du cours

Tout le cours se trouve dans un dossier, `~/curso-http/`. Crée-le et place-toi dedans, car toutes les commandes de la leçon s'exécutent depuis cet emplacement :

```bash
mkdir -p ~/curso-http && cd ~/curso-http
```

Place à l'intérieur un fichier `package.json` comportant une seule indication :

```json
{
  "type": "module"
}
```

Ce fichier n'installe rien ; le cours n'a aucune dépendance. Il indique simplement à Node, ainsi qu'à `tsc` si tu l'utilises, que les fichiers de ce dossier sont des **modules ESM**, le format moderne de JavaScript, celui qui utilise `import`. Sans lui, Node devrait le deviner à chaque fois.

### 0.2 Une réponse de l'intérieur

#### 0.2.1 Le premier serveur

Voici le plus petit serveur HTTP qui vaille la peine d'être écrit. Enregistre-le sous le nom `~/curso-http/fig00_01.ts` :

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

Il se lit de haut en bas. `node:http` est le module de Node qui sait parler HTTP ; le préfixe `node:` indique qu'il est fourni avec Node et ne provient pas d'un paquet externe. `createServer` reçoit une fonction que Node appelle **une fois pour chaque requête**, avec deux objets : la `peticion` reçue et la `respuesta` que tu vas écrire. La fonction affiche la méthode et l'URL (pour que tu voies dans le terminal du serveur ce qui lui est parvenu), puis écrit la réponse en deux étapes. `writeHead` écrit le **code d'état** et les **en-têtes** ; `end` écrit le **corps** et clôt la réponse.

Deux en-têtes, chacun avec sa raison d'être. `Content-Type` indique la nature du corps : du texte brut en UTF-8. `Content-Length` indique combien d'**octets** il mesure, et c'est pourquoi on le calcule avec `Buffer.byteLength` et non avec `cuerpo.length` : le « á » de « está » occupe deux octets en UTF-8, et le corps mesure 28 octets bien qu'il compte 27 caractères. Enfin, `listen` ouvre le port 18080 sur `127.0.0.1`, qui désigne « cet ordinateur même » : personne depuis l'extérieur de ta machine ne peut atteindre ce serveur, et c'est exactement ainsi que cela doit être pendant que tu t'exerces.

Lance-le dans un terminal, que tu laisseras ouvert :

```text
$ node fig00_01.ts
escuchando en http://127.0.0.1:18080
```

Le programme ne se termine pas : il reste en attente de requêtes jusqu'à ce que tu l'arrêtes avec `Ctrl`+`C`.

#### 0.2.2 Ce qui voyage : `curl -i`

Dans un **autre** terminal, envoie-lui une requête. L'option `-i` indique à `curl` d'afficher la réponse complète, avec sa ligne d'état et ses en-têtes, et pas seulement le corps :

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

Voilà une réponse HTTP, et elle comporte trois parties, toujours dans le même ordre :

| Partie | Dans l'exécution | Qui l'a écrite |
|---|---|---|
| **Ligne d'état** | `HTTP/1.1 200 OK` | toi, avec le `200` de `writeHead` ; Node a ajouté la version et le `OK` |
| **En-têtes** | de `Content-Type` à `Keep-Alive` | tu en as écrit deux ; Node a ajouté `Date`, `Connection` et `Keep-Alive` |
| **Corps** | `el revisor está escuchando` | toi, avec `end` |

Entre les en-têtes et le corps se trouve **une ligne vide**. Ce n'est pas une décoration : c'est l'unique moyen dont dispose le lecteur pour savoir où se terminent les en-têtes. Et le corps s'achève là où l'indique `Content-Length` : 28 octets, pas un de plus. La spécification qui définit ce format exact, ligne par ligne, est la [RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html), qui décrit HTTP/1.1 tel qu'il circule sur le réseau. Ce que **signifient** les codes et les en-têtes se trouve dans un autre document, la [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), *HTTP Semantics*, qui est celui que tu vas le plus souvent citer dans ce cours. Cette séparation se justifie : HTTP/2 et HTTP/3 circulent différemment, avec un autre format binaire, mais les codes et les en-têtes signifient la même chose dans les trois versions.

Observe maintenant la ligne d'état posément. Elle comporte trois éléments : la version (`HTTP/1.1`), le code (`200`) et un libellé (`OK`). Ce libellé s'appelle la *reason phrase* (libellé de statut), et la RFC 9112, dans sa [section 4](https://www.rfc-editor.org/rfc/rfc9112.html#section-4), énonce un point qu'il convient de retenir dès aujourd'hui : un client **devrait l'ignorer**, car elle ne constitue pas un canal d'information fiable ; elle peut être traduite, modifiée par un intermédiaire ou disparaître lors du passage à une autre version de HTTP. Le libellé est destiné à la personne qui lit le terminal. Pour les programmes, seul compte le numéro. À la section 0.5, tu verras que même Node emploie des libellés différents des libellés officiels pour certains codes.

> **Note sur le nom de l'option.** Dans les versions récentes de `curl`, l'option longue correspondant à `-i` s'appelle `--show-headers` (auparavant, elle s'appelait `--include`, et l'ancien nom fonctionne toujours), d'après le [manuel de `curl`](https://curl.se/docs/manpage.html). L'option `-i` fonctionne de la même manière dans les deux cas.

#### 0.2.3 La requête a elle aussi une forme : `curl -v`

Une conversation HTTP a deux moitiés, et `-i` ne te montre que la seconde. Avec `-v` (*verbose*, « en détail »), `curl` te montre également ce qu'il a **envoyé** :

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

Les lignes commençant par `*` sont des commentaires de `curl` sur la connexion. Celles commençant par `>` forment la **requête**, telle qu'elle est partie : une ligne avec la **méthode** (`GET`), le **chemin** (`/servicios`) et la version, puis ses propres en-têtes. Celles commençant par `<` forment la réponse, identique à celle de tout à l'heure. (Sous Linux, tu verras `curl/8.5.0` dans `User-Agent`, ou la version que tu as ; c'est la seule chose qui change.)

Remarque deux choses. La première : la requête a la même forme que la réponse, une ligne initiale, des en-têtes, une ligne vide et, si besoin, un corps. La seconde : tu lui as demandé `/servicios` et le serveur a répondu `200` avec le même texte habituel, parce que ce serveur n'examine pas le chemin ; il ne fait que l'afficher. Dans son terminal est apparu `GET /servicios`. Un serveur qui répond `200` pour un chemin qui n'existe pas profère déjà un petit mensonge, et le banc de la section 0.4 ne commet pas cette faute.

#### 0.2.4 Uniquement les en-têtes : `HEAD` et `curl -I`

Il existe une méthode conçue pour demander des informations sur une réponse sans recevoir son contenu : `HEAD`. Le serveur répond exactement ce qu'il répondrait à un `GET`, en-têtes compris, mais sans corps. `curl -I` envoie un `HEAD` :

```text
$ curl -I http://127.0.0.1:18080/
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 28
Date: Wed, 21 Oct 2026 07:27:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

`Content-Length` indique toujours 28, car il précise combien mesurerait le corps d'un `GET`, mais aucun corps n'est arrivé. Ton programme n'a rien fait de particulier pour cela : il a écrit le corps avec `end`, et Node, sachant que la requête était un `HEAD`, ne l'a pas envoyé. Dans le terminal du serveur est apparu `HEAD /`. Les contrôles de santé et certains moniteurs utilisent `HEAD` précisément parce que seul le numéro leur importe, et le numéro arrive de la même manière.

Tu peux maintenant arrêter le serveur avec `Ctrl`+`C`. Le reste de la leçon utilise le port 18080 pour d'autres programmes.

### 0.3 Cinq familles et une question

Le code d'état est un nombre à trois chiffres, et **le premier chiffre indique la famille**. La RFC 9110 en définit cinq dans sa [section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), et chacune répond à une question distincte :

| Famille | Ce que dit la RFC 9110 | La question à laquelle elle répond |
|---|---|---|
| `1xx` | la requête a été reçue et le traitement se poursuit | dois-je continuer d'attendre ? Oui : ceci n'est pas la réponse finale |
| `2xx` | la requête a été reçue, comprise et acceptée | cela s'est-il bien passé ? Oui |
| `3xx` | une autre action est requise pour la mener à bien | où est-ce ? Ailleurs, et je te dis où |
| `4xx` | la requête comporte une erreur ou ne peut pas être satisfaite | qui s'est trompé ? Celui qui a demandé |
| `5xx` | le serveur a échoué face à une requête apparemment valide | qui s'est trompé ? Celui qui répond |

La famille `1xx` est différente des quatre autres, et il est bon de le savoir dès aujourd'hui. Une réponse `1xx` est **intermédiaire** : d'après la [section 15.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.2), une requête peut recevoir zéro ou plusieurs réponses `1xx`, puis **exactement une** réponse finale issue des autres familles. Une réponse `1xx` ne peut pas comporter de corps, et ne constitue jamais le dernier mot. C'est pourquoi le banc d'essai de la section suivante refuse d'en produire une comme réponse finale.

La question de la dernière colonne est la plus utile du cours, et les leçons 2 à 4 la transforment en méthode. Lorsque tu reçois une erreur, avant de lire quoi que ce soit d'autre, regarde le premier chiffre. Un `4` indique que la personne ou le programme qui doit changer quelque chose est celui qui a formulé la requête : les paramètres, l'identité, les permissions. Un `5` indique que la requête était correcte et que le serveur a échoué, et que celui qui l'a émise n'a rien à corriger de son côté, même si cela ne l'autorise pas à la répéter aveuglément (la [Leçon 6](06-reintentos-idempotencia.md) traite des cas où cela est permis). Si tu souhaites voir ce même tableau appliqué à une API de contacts, avec un serveur qui ment et un autre honnête côte à côte, le premier volet de la série « HTTP et Problem Details » de la lettre d'information de Hábil, citée à la fin, la parcourt code par code.

### 0.4 Le banc d'essai

#### 0.4.1 À quoi il sert

Pour apprendre ce qu'un programme fait d'un `503`, tu as besoin d'un serveur qui réponde `503` quand tu le décides. Attendre qu'un vrai service tombe en panne n'est pas une méthode, et provoquer une panne sur un service tiers n'est pas convenable. Le banc d'essai résout ce problème : c'est un serveur qui renvoie, sur la route `/codigo/NNN`, le code `NNN` que tu lui demandes, avec les en-têtes que ce code exige ou porte habituellement. Tu vas l'utiliser dans toutes les leçons du cours, c'est pourquoi il vaut la peine de le lire attentivement une fois.

#### 0.4.2 Le programme

Enregistre-le sous le nom `~/curso-http/fig00_02.ts` :

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

Le programme comporte trois éléments.

**Deux tables.** `NOMBRES` conserve le libellé officiel des 28 codes utilisés par le cours (les 23 principaux et les cinq mentionnés au passage), copiée depuis le registre de l'IANA, qui est la liste officielle des codes (section 0.7). `CABECERAS` conserve les en-têtes que chaque code comporte. Tous n'ont pas le même poids, et il convient de le préciser : la RFC 9110 indique qu'un `401` **doit** porter `WWW-Authenticate` avec au moins un défi (*challenge*) ([section 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2)) et qu'un `405` **doit** porter `Allow` indiquant les méthodes autorisées ([section 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6)). Pour les redirections (`301`, `302`, `307`, `308`), le serveur **devrait** envoyer `Location`. Pour le `201`, `Location` identifie la ressource créée, et si cet en-tête est absent, la ressource créée est l'URL même de la requête ([section 15.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2)). Et `Retry-After` sur un `503` est **facultatif** selon la RFC 9110, tout comme sur un `429` selon la [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html), où ce code a été défini. Les leçons 1 à 4 expliquent chacun de ces aspects en profondeur ; le banc te permet simplement de les observer.

**La fonction `enviar`.** Elle prépare le corps, une ligne avec le code et son libellé et une autre avec l'explication, puis écrit la réponse. Deux détails méritent attention. Le premier : pour `204`, `205` et `304`, elle n'écrit ni corps ni `Content-Type`, car ces trois codes ne peuvent pas en porter : la RFC 9112 ([section 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#section-6.3)) dit qu'une réponse `204` ou `304` se termine à la première ligne vide après les en-têtes, et la RFC 9110 ([section 15.3.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.6)) interdit de générer du contenu dans un `205`. La liste ne résume pas toute la règle. Un `1xx` ne peut pas non plus porter de corps, mais le banc refuse déjà d'en produire un (tu l'as vu en 0.3 et tu le verras en 0.4.4) ; et une réponse à `HEAD` n'a jamais de corps, c'est Node qui s'en charge (0.2.4). Un `205` est rare (il demande au navigateur de vider le formulaire qu'il vient d'envoyer), mais le banc peut le produire si tu le lui demandes, et c'est pourquoi il figure dans la liste. Le second : si le code figure dans `NOMBRES`, elle transmet à `writeHead` le libellé officiel ; sinon, elle laisse Node utiliser le sien. La [documentation de `writeHead`](https://nodejs.org/docs/latest-v24.x/api/http.html) accepte les trois arguments : le code, le libellé (facultatif) et les en-têtes.

**La fonction `atender`.** C'est le point d'entrée, qui valide dans l'ordre. D'abord la méthode : le banc ne prend en charge que `GET` et `HEAD`, et répond à toute autre méthode par un `405` accompagné de son `Allow` ; en somme, le banc applique la règle qu'il enseigne. Ensuite le chemin : il doit s'agir de `/codigo/` suivi d'exactement trois chiffres, sans quoi le banc répond `404` en indiquant la seule route existante. Enfin le numéro : inférieur à 100 n'existe pas, un `1xx` ne peut pas être la réponse finale, et au-delà de 599 est invalide selon la spécification, mais le banc le génère quand même, délibérément, car à la section 0.6 tu auras besoin de voir ce que fait un client face à un code qui ne devrait pas exister.

#### 0.4.3 Le tester

Lance-le dans un terminal et laisse-le ouvert :

```text
$ node fig00_02.ts
banco de pruebas en http://127.0.0.1:18080/codigo/NNN
```

Dans un autre terminal, demande-lui un service en panne :

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

Le code, son libellé, l'en-tête `Retry-After` (« réessaie dans 120 secondes ») et un corps qui donne l'explication. Une ressource créée :

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

Une réponse sans contenu, qui n'apporte ni corps ni `Content-Type`, car il n'y a rien à décrire :

```text
$ curl -i http://127.0.0.1:18080/codigo/204
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

Le `205` est du même type : sans corps. Comme le programme n'écrit pas `Content-Length`, Node envoie la réponse par morceaux, avec un unique morceau final de taille zéro (la forme qu'explique 0.8.2) ; il n'y a aucun contenu :

```text
$ curl -i http://127.0.0.1:18080/codigo/205
HTTP/1.1 205 Reset Content
Date: Wed, 21 Oct 2026 22:00:20 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

```

Une absence d'identité, avec le défi exigé par la spécification :

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

#### 0.4.4 Les trois verrous du banc

Voyons maintenant les trois validations de `atender`, afin que tu constates que le banc dit lui aussi la vérité lorsque c'est toi qui te trompes. Une méthode non prise en charge (`-X DELETE` indique à `curl` quelle méthode employer) :

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

Une route inexistante :

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

Et un `1xx` demandé comme réponse finale :

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

Chaque requête a été consignée dans le terminal du banc (`GET /codigo/503`, `DELETE /codigo/200`…). Laisse le banc tourner : tu en as besoin dans les deux sections suivantes.

### 0.5 Le code fait foi et le corps explique

#### 0.5.1 Qui lit le numéro

C'est le premier des trois principes du cours, et on peut l'observer avec un outil que tu as sans doute déjà employé dans un script : `curl -f`. Avec `-f` (*fail*), `curl` cesse d'être un simple instrument d'observation et devient un instrument de **décision** : si le code est égal ou supérieur à `400`, il n'affiche pas le corps et se termine avec le code de sortie 22. Le [manuel de `curl`](https://curl.se/docs/manpage.html) le définit ainsi : le code 22 signifie que la page n'a pas été obtenue parce que le serveur a renvoyé un code égal ou supérieur à 400, et cela ne se produit qu'avec `--fail`. De nombreux contrôles de santé se résument exactement à cela : un `curl -f` dont le code de sortie détermine si le service va bien. `echo $?` affiche le code de sortie de la dernière commande :

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

`curl -f` n'a lu le corps à aucun moment. Il ne pouvait pas savoir que « lo pediste en /codigo/503 » n'est pas une explication très utile ; cela lui est égal. Il a pris sa décision d'après le numéro, et rien d'autre.

Le client HTTP de JavaScript fait exactement la même chose. Lorsque tu utilises `fetch`, la réponse possède une propriété `ok`, et le [standard Fetch](https://fetch.spec.whatwg.org/) la définit en une phrase : un statut *ok* est un statut compris entre 200 et 299 inclus. La moitié des développeurs écrivent `if (respuesta.ok)` et poursuivent. Si le serveur a répondu `200` avec `{"error": …}` à l'intérieur, ce `if` s'engage dans la mauvaise branche, et aucun programme sur le parcours ne s'en rendra compte. La section 0.6 emploie `fetch` face au banc, et la section 0.8 dresse le bilan complet des dommages.

C'est pourquoi ce principe comporte deux volets. **Le code fait foi :** c'est la partie du message que tous lisent, et celle qui dicte leur comportement. **Le corps explique :** il est destiné à quiconque a besoin du détail, une personne ou un programme comprenant le format de ton API. Et la condition qui unit les deux est précisément celle qui vole en éclats dans la scène d'ouverture : **les deux disent la même chose**. Un corps peut apporter des précisions au code, mais ne doit jamais le contredire ni s'y substituer. La RFC 9110 l'exige pour les deux familles d'erreurs : dans un `4xx` et dans un `5xx`, sauf si la requête est un `HEAD`, le serveur **devrait** fournir dans le corps une explication de l'erreur et indiquer si elle est temporaire ou permanente ([sections 15.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5) et [15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6)). C'est-à-dire : le numéro **et en plus** l'explication, et non l'un à la place de l'autre.

#### 0.5.2 Le libellé de la ligne d'état n'est pas le message

En 0.2.2, tu as vu qu'un client devrait ignorer le libellé de la ligne d'état. En voici la démonstration. Le banc utilise les libellés du registre officiel pour ses 28 codes, mais pour tout autre code, il laisse Node fournir le sien. Demande-lui un `418`, qui ne figure pas dans sa table, uniquement les en-têtes :

```text
$ curl -I http://127.0.0.1:18080/codigo/418
HTTP/1.1 418 I'm a Teapot
Content-Type: text/plain; charset=utf-8
Content-Length: 57
Date: Wed, 21 Oct 2026 08:05:05 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

Node l'appelle « I'm a Teapot », « je suis une théière », ce qui provient d'un canular : la [RFC 2324](https://www.rfc-editor.org/rfc/rfc2324.html), publiée le 1er avril 1998, qui tournait en dérision les abus de HTTP. Dans le registre officiel, le `418` figure comme **(Unused)**, et la [section 15.5.19 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.19) en explique la raison : il a été employé comme plaisanterie tant de fois qu'il ne peut plus servir à aucun usage sérieux, il est donc demeuré réservé. Et ce n'est pas un cas isolé : la table de libellés intégrée à Node nomme le `422` « Unprocessable Entity » et le `413` « Payload Too Large », qui étaient les anciens noms ; la RFC 9110 les a changés en « Unprocessable Content » et « Content Too Large », et c'est sous cette forme qu'ils figurent dans le registre. C'est pour cela que le banc intègre sa propre table.

Aucune de ces divergences ne casse quoi que ce soit, et c'est là l'enseignement : **le libellé peut contenir n'importe quoi, et aucun programme ne doit fonder sa décision dessus**. Un client qui compare le libellé avec `"Not Found"` cesse de fonctionner dès le premier serveur qui le traduit, l'abrège ou l'omet. Le numéro, lui, est identique partout.

### 0.6 Un code que la machine ne connaît pas

#### 0.6.1 La règle

Il y a plus d'une soixantaine de codes assignés (section 0.7), et de nouveaux font leur apparition de temps en temps. Aucun programme ne les connaît tous, et la spécification en a bien conscience. La RFC 9110, dans l'introduction de sa [section 15](https://www.rfc-editor.org/rfc/rfc9110.html#section-15), énonce une règle concise qu'il convient de connaître par cœur : un client n'est pas tenu de comprendre l'ensemble des codes enregistrés, mais il **doit** comprendre la famille de n'importe quel code d'après son premier chiffre, et il **doit** traiter un code qu'il ne reconnaît pas comme le `x00` de sa famille. La RFC donne elle-même l'exemple : s'il reçoit un `471`, qu'il ne connaît pas, le premier chiffre indique un problème dans la requête, et le client le traite comme s'il avait reçu un `400`.

La même section ajoute une seconde règle : les valeurs hors de l'intervalle 100 à 599 sont **invalides**. Certaines bibliothèques utilisent des nombres comme 600 ou 999 pour communiquer des erreurs internes qui ne relèvent pas de HTTP, et si l'un d'eux parvient à un client, celui-ci **devrait** le traiter comme un `5xx`. C'est une démarche judicieuse : un numéro qui ne devrait pas exister signifie, avant tout, que quelque chose ne va pas du côté du serveur.

Avec ces deux règles, un programme qui ne connaît qu'une poignée de codes peut réagir de façon cohérente à n'importe lequel d'entre eux. Et c'est pourquoi inventer ses propres codes est une mauvaise idée (le cours ne l'enseigne pas, délibérément) : ton `299 Presque prêt` ne sera compris par personne d'autre, et tous vont le traiter comme un `200` ordinaire.

#### 0.6.2 Le lecteur qui ne regarde que le numéro

Ce programme lit les réponses du banc comme le ferait un moniteur : il ne regarde pas le corps, uniquement le numéro, et applique les deux règles. Enregistre-le sous le nom `~/curso-http/fig00_03.ts` :

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

La fonction `comoSiFuera` est la règle écrite en trois lignes, dans l'ordre où il faut l'appliquer : d'abord ce qui est invalide, puis ce qui est connu, et enfin ce qui est inconnu, qui est ramené au `x00` de sa famille avec `Math.floor(codigo / 100) * 100`. La boucle demande au banc huit codes, parmi lesquels deux que personne n'a enregistrés (`299` et `471`) et un code invalide (`600`). Deux détails concernant `fetch` : `redirect: "manual"` lui demande de ne pas suivre l'en-tête `Location` du `308` (par défaut il le suivrait et tu recevrais le `200` de la destination, pas le `308`), et `await respuesta.text()` lit le corps et le jette, afin que la connexion soit libérée. Le `await` dans la boucle fonctionne en dehors de toute fonction car le fichier est un module, grâce au `package.json` de la section 0.1.3.

Avec le banc en cours d'exécution, dans l'autre terminal :

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

Lis ensemble la colonne `ok` et celle de droite. Le `299` est *ok* pour `fetch`, car il est compris entre 200 et 299, et le lecteur le traite comme un `200` : un code inventé dans la famille du succès est lu comme un succès, ce qui correspond exactement à ce qu'énonce la règle. Le `471` est lu comme un `400`, l'exemple même de la RFC. Et le `600`, que le banc a produit délibérément, est lu comme une erreur de serveur. Remarque aussi que le `308` n'est pas *ok* : `ok` ne couvre que la famille `2xx`, et une redirection n'est pas encore un succès. Un programme qui ferait `if (!respuesta.ok) reportarFalla()` sans regarder plus loin signalerait chaque redirection comme une défaillance ; c'est le genre de détail que la [Leçon 7](07-quien-lee-el-error.md) transforme en tableau de décision.

Tu peux maintenant arrêter le banc avec `Ctrl`+`C`.

### 0.7 Les registres officiels

#### 0.7.1 Qui décide quels codes existent

Ni Node, ni `curl`, ni ce cours ne décident des codes qui existent. Cela relève d'un processus public. La RFC 9110, dans sa [section 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1), établit que les codes sont consignés dans le **registre des codes d'état de HTTP** maintenu par l'**IANA** (*Internet Assigned Numbers Authority*, l'organisme qui administre les numéros et noms officiels des protocoles internet). Chaque entrée comporte trois données : le code, une courte description et la référence à la spécification qui le définit. Et l'ajout d'un nouveau code exige une révision de l'IETF, le groupe qui rédige les standards d'internet ; il ne suffit pas que quelqu'un l'utilise.

Le [registre](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) peut être téléchargé au format CSV, et a été dénombré le 21 octobre 2026, dans sa version mise à jour le 15 septembre 2025 : il y a **62 codes assignés**. Par famille : 5 en `1xx`, 10 en `2xx`, 8 en `3xx`, 28 en `4xx` et 11 en `5xx`. Il existe en outre deux numéros réservés sans usage, le `306` et le `418`, ainsi que des plages entières non assignées. L'un des 62 est temporaire : le `104`, enregistré pendant l'élaboration de l'Internet-Draft qui le définit, avec une date d'expiration en novembre 2026. Le cours utilise 23 des 62 codes, et l'exercice 3 te demande de reproduire le décompte de la famille `4xx` par toi-même, car il renferme un piège.

#### 0.7.2 Les trois autres registres que tu vas utiliser

Les codes ne sont pas les seuls éléments répertoriés. Tout au long du cours, tu vas consulter trois autres registres de l'IANA, et il est bon de savoir dès aujourd'hui qu'ils existent :

| Registre | Ce qu'il conserve | Où il apparaît dans le cours |
|---|---|---|
| [Noms de champs de HTTP](https://www.iana.org/assignments/http-fields/http-fields.xhtml) | chaque en-tête, avec son statut (permanent, provisoire, obsolète) et la spécification qui le définit | `Location`, `Allow`, `Retry-After` ou `WWW-Authenticate`, dans chaque leçon |
| Types de médias | les valeurs valides de `Content-Type`, comme `application/json` ou `application/problem+json` | Leçon 5 |
| [Types de problème de HTTP](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml) | identifiants standard pour le champ `type` d'un *Problem Details* | Leçon 5 |

Le registre des en-têtes a été téléchargé le même jour : il compte 260 noms, et tous ne sont pas en vigueur ; 39 sont marqués comme obsolètes et 8 comme déconseillés, de sorte qu'« être dans le registre » ne signifie pas « devoir être utilisé ». Celui des types de problème est beaucoup plus modeste : il a été créé par la [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), la spécification des *Problem Details* que la Leçon 5 enseigne en intégralité, et compte aujourd'hui six entrées, la première étant `about:blank`.

Une remarque sur la méthode : quand une leçon affirme qu'un code « signifie » quelque chose ou qu'un en-tête « exige » quelque chose, la source est l'une de ces spécifications, mise en lien dans la section des sources de la leçon, et le registre de l'IANA est l'arbitre de ce qui existe. Quand le cours effectue un choix que la spécification laisse ouvert (comme `400` face à `422`), il le signale : c'est un parti pris de conception, pas une norme.

### 0.8 Pourquoi un `200` avec `{"error": …}` casse le cache, le moniteur et le client

#### 0.8.1 L'expérience

Tu as déjà vu séparément que `curl -f` et `fetch` prennent leur décision d'après le numéro. Il reste le troisième lecteur sur le trajet, celui qui cause le plus de dégâts lorsqu'il se trompe car il se trompe **pour tout le monde** : le cache. Un **cache partagé** est un programme situé entre les clients et le serveur qui enregistre les réponses et les restitue, afin d'éviter au serveur de calculer mille fois la même chose. Les règles régissant le moment où il peut enregistrer quelque chose figurent dans la [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html), et deux d'entre elles importent ici.

La première règle provient de la [section 3 de la RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-3) : un cache peut enregistrer une réponse, entre autres conditions, si la réponse l'y autorise explicitement, par exemple avec `Cache-Control: max-age=N` (« réutilise-moi pendant N secondes »). La seconde provient d'une extension, la [RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html#section-4) : avec `stale-if-error=N`, le serveur autorise le cache à continuer de servir une copie périmée pendant N secondes **si, en en demandant une nouvelle, il rencontre une erreur**. Et la RFC définit « erreur » par une liste fermée : toute situation aboutissant à un `500`, `502`, `503` ou `504`. Le cache identifie l'erreur par le numéro. Si le numéro indique `200`, pour le cache, il n'y a pas eu d'erreur.

Ce programme place les deux éléments côte à côte : une **origine** qui peut être saine, menteuse ou honnête, et un cache de laboratoire placé devant qui applique ces deux règles, et uniquement celles-là. Enregistre-le sous le nom `~/curso-http/fig00_04.ts` :

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

L'**origine** possède un point d'accès de contrôle, `PUT /modo/...`, pour changer de comportement sans être redémarrée, et répond à toute autre requête, quel que soit le chemin ou la méthode, selon son mode actuel. Ce point d'accès est un interrupteur de laboratoire : il ne requiert pas d'authentification, de sorte que quiconque accède au port peut faire planter le service ; ici, cela n'a pas d'importance car il n'écoute que sur `127.0.0.1`, mais une route permettant d'injecter des défaillances ne doit jamais exister dans un service réel. Saine, elle répond `200` avec la liste. Menteuse, elle répond `200` avec une erreur dans le corps, **avec les mêmes en-têtes de cache** : c'est réaliste, car ces en-têtes sont généralement configurés pour la route entière et non pour chaque réponse individuelle. Honnête, elle répond `503` avec `Retry-After` et `Cache-Control: no-store` (« n'enregistre pas ceci »).

Le **cache** effectue quatre opérations, dans cet ordre. S'il dispose d'une copie n'ayant pas encore atteint ses `max-age` secondes, il la sert sans interroger l'origine. Sinon, il interroge l'origine. Si l'origine a renvoyé l'une des quatre erreurs de la liste et que la copie périmée se trouve toujours dans sa fenêtre de `stale-if-error`, il sert l'ancienne copie. Et si l'origine a renvoyé `200` avec `max-age`, il enregistre la nouvelle réponse **à la place** de la précédente. Lorsqu'il sert une copie, il ajoute l'en-tête `Age`, indiquant le nombre de secondes écoulées depuis sa mise en cache, qui est l'en-tête standard prévu à cet effet selon la [section 5.1 de la RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.1). Un véritable cache applique bien plus de règles ; celui-ci en applique deux, et cela suffit pour observer le problème. Les `max-age` de 5 secondes sont volontairement courts pour que l'expérience ne prenne pas de temps ; dans un service réel, il s'agirait de minutes.

#### 0.8.2 Première exécution : l'origine ment

Lance-le dans un terminal. Dans un autre, demande la liste à travers le cache, fais passer l'origine en mode menteur, attends que la copie expire (`sleep 6`), puis redemande deux fois :

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

Et voici ce que le programme a écrit dans son terminal :

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: guardé la respuesta 200 por 5 s
caché: tengo una copia fresca; no le pregunto al origen
```

Suis le déroulement ligne par ligne. La première requête a trouvé le cache vide, a interrogé l'origine saine et a enregistré la liste. Une fois la copie expirée, le cache a réinterrogé l'origine, celle-ci a répondu `200` avec son erreur, et le cache a fait ce qui convenait d'après ce qu'il a vu : un `200` avec `max-age` est une réponse valide et réutilisable, si bien qu'il **l'a enregistrée par-dessus la copie valide**. La troisième requête n'est même plus parvenue à l'origine : le cache a répété l'erreur, avec `Age: 0`, à quiconque la demandait. Avec un `max-age` de cinq minutes, l'erreur serait répétée pendant cinq minutes à tous les clients, même si le service s'était rétabli entre-temps. Et la copie valide, celle que `stale-if-error` était censé protéger, a été perdue.

Les en-têtes en minuscules dans les réponses ayant transité par l'origine (`content-type`, `cache-control`) ne constituent pas une erreur : `fetch` fournit les noms en minuscules et le cache les a renvoyés tels quels. Les noms des en-têtes sont insensibles à la casse selon la [section 5.1 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.1), et aucun programme ne doit les comparer autrement.

Ce n'est pas non plus une erreur que `Content-Length` soit absent et que `Transfer-Encoding: chunked` apparaisse. En 0.2.2, le corps se terminait là où l'indiquait `Content-Length`, mais `fig00_04.ts` ne calcule pas la taille avant `writeHead`, et Node envoie alors le corps **par morceaux** (*chunks*) : la [documentation de Node](https://nodejs.org/docs/latest-v24.x/api/http.html) indique que l'envoi de `Content-Length` est ce qui désactive ce mode, qui est le comportement par défaut. Selon la [section 7.1 de la RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html#section-7.1), chaque morceau est précédé de sa propre taille, et un morceau de taille zéro marque la fin. Ce sont deux façons d'indiquer où s'arrête le corps ; `curl` comprend les deux et t'affiche le même corps.

Reste le moniteur. Interroge directement l'origine menteuse avec le contrôle de santé de la section 0.5 :

```text
$ curl -f http://127.0.0.1:18081/servicios
{"error":"la base de datos no está disponible"}
$ echo $?
0
```

Le contrôle est passé. Le service est en panne et le contrôle de santé affirme qu'il va bien. C'est le voyant vert du moniteur dans la scène du début.

#### 0.8.3 Seconde exécution : l'origine dit la vérité

Arrête le programme avec `Ctrl`+`C` et relance-le, pour repartir avec un cache vide. Cette fois, l'origine passe en mode honnête :

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

Et dans le terminal du programme :

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy honesto
caché: el origen respondió 503; sirvo la copia anterior
```

Même service, même panne, un autre numéro. Le cache a reçu un `503`, l'a reconnu comme une erreur car il figure dans la liste de la RFC 5861, et a servi la dernière copie valide, avec `Age: 6` pour que quiconque le souhaite sache qu'elle a six secondes d'ancienneté. Les clients continuent de voir la liste des services pendant que l'origine se rétablit. Et le contrôle de santé, qui interroge directement l'origine, a échoué avec le code 22 : le voyant du moniteur passe au rouge, quelqu'un reçoit une alerte et se met au travail. **Le `503` a protégé les clients et alerté les équipes d'exploitation, en même temps.** Le `200` menteur a fait exactement le contraire sur les deux fronts.

Voilà l'ampleur des dégâts, mesurée : le **cache** enregistre l'erreur et perd la copie valide ; le **moniteur** reste au vert ; et le **client**, qui effectue un `if (respuesta.ok)`, croit avoir reçu des données. Tous les trois ont pris la bonne décision en fonction de ce qu'ils ont lu. C'est le numéro qui était en faute.

Arrête le programme avec `Ctrl`+`C`. Plus rien n'écoute sur les ports.

### 0.9 Vérifier les types avec `tsc` (facultatif)

Node retire les types et exécute ; **il ne les vérifie pas**. Si tu écris `const x: number = "a"`, Node l'exécute sans sourciller. C'est pourquoi le cours vérifie ses programmes avec `tsc`, le compilateur TypeScript, en mode strict, et tu peux faire de même quand tu le souhaites. Cela ne fait pas partie du cours et n'est requis pour aucune leçon. Dans `~/curso-http/` :

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --types node fig00_01.ts fig00_02.ts fig00_03.ts fig00_04.ts
```

La première commande télécharge le compilateur et les descriptions de types de Node dans un dossier `node_modules/`, sans les consigner dans `package.json` (c'est ce que fait `--no-save`). La seconde vérifie les quatre programmes sans générer de fichiers (`--noEmit`) ; `--erasableSyntaxOnly` lui demande de rejeter ce que Node ne saurait pas effacer, et `--verbatimModuleSyntax` d'exiger `import type` là où seul un type est importé, comme dans `fig00_02.ts`. Ce sont les options recommandées par la documentation de Node pour ce mode de fonctionnement. Si tout est correct, `tsc` n'affiche rien et se termine avec le code 0, ce qui a été le résultat obtenu avec les quatre programmes de cette leçon.

## L'erreur que tu vas voir

**Le port occupé.** C'est l'erreur que tu verras le plus souvent dans ce cours, car tous les programmes utilisent le port 18080. Si tu démarres un serveur alors qu'un autre écoute encore sur ce port, Node s'arrête ainsi :

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

Elle se lit à partir de la ligne commençant par `Error:` : `listen` a échoué avec `EADDRINUSE`, adresse déjà utilisée (*address already in use*), sur `127.0.0.1:18080`. Les lignes avec `at` représentent la pile interne de Node et ne t'apportent rien d'utile ici. Sous Linux, `errno` indique `-98` au lieu de `-48` (c'est la même erreur sous le code d'un autre système), et les numéros de ligne de `node:net` varient selon la version de Node. La cause est presque toujours un programme antérieur du cours qui tourne encore dans un autre terminal : cherche-le et arrête-le avec `Ctrl`+`C`. Si tu ne le trouves pas, demande au système quel processus écoute sur ce port : sous Linux, `ss -ltnp 'sport = :18080'` l'affiche avec son numéro sous la forme `pid=NNNN` ; sous macOS, `lsof -iTCP:18080 -sTCP:LISTEN` l'affiche dans la colonne `PID`. Tu peux ensuite l'arrêter avec ce numéro : `kill NNNN`.

**Personne n'écoute.** L'erreur opposée : tu demandes quelque chose sur un port où aucun serveur n'est présent. Ce n'est plus une erreur de Node, mais de `curl` :

```text
$ curl -i http://127.0.0.1:18080/
curl: (7) Failed to connect to 127.0.0.1 port 18080 after 0 ms: Couldn't connect to server
```

Remarque ce qu'il n'y a **pas** : il n'y a ni ligne d'état, ni en-têtes, ni code. Il n'y a eu aucune réponse HTTP, car il n'y a eu aucune conversation. Cette distinction est capitale pour le `revisor` : « le service a répondu `503` » et « impossible de se connecter » sont des pannes distinctes, ayant des causes différentes, et le `revisor` les signalera différemment. Le code 7 de `curl` signifie « je n'ai pas pu me connecter » ; le code 22 de la section 0.5 signifie « je me suis connecté et le serveur a renvoyé une erreur ». Un script qui vérifie seulement si le code de sortie est différent de zéro ne distingue pas les deux.

## Ce qui se fait de travers

**Répondre `200` avec l'erreur dans le corps.** Tu en as mesuré le coût en 0.8 : le cache l'enregistre et perd la copie valide, le contrôle de santé réussit et le client qui fait confiance à `ok` continue sa route. La solution ne consiste pas à ajouter au corps un champ `"exito": false` plus visible : elle consiste à mettre la vérité dans le numéro.

**Fonder une décision sur le libellé de la ligne d'état.** `if (statusText === "Not Found")` cesse de fonctionner dès le premier serveur qui le traduit ou l'omet, et la RFC 9112 prévient que le libellé peut disparaître lors du passage à une autre version de HTTP. Tu as vu en 0.5.2 que Node et le registre officiel emploient déjà des libellés différents pour trois codes.

**Inventer ses propres codes.** Un `299` ou un `471` maison n'est compris par personne d'autre, et la règle de la section 0.6 fait que tous le traiteront comme un `200` ou un `400`. Si ce que tu voulais exprimer n'entre pas dans un code enregistré, cela a sa place dans le corps, et la Leçon 5 t'en donne le format.

**Écrire un client qui ne connaît que ses propres codes.** Un `switch` qui reconnaît `200`, `404` et `500`, et traite tout le reste comme une « erreur inconnue », transforme un `204` en défaillance. La règle du `x00` existe précisément pour éviter cela.

**Traiter « impossible de se connecter » comme un code.** Certains programmes convertissent une connexion refusée en un `500` ou en un faux `0`, afin que « tout soit un numéro ». On perd ainsi l'information la plus utile : le serveur a-t-il répondu ou non ?

**Faire des mesures avec un serveur qui n'examine pas le chemin.** Le serveur de la section 0.2.1 répond `200` à `/servicios`, à `/n-importe-quoi` et à tout le reste. Il sert à observer la forme d'une réponse et à rien d'autre ; un tel serveur fausse n'importe quel test que tu lui ferais passer.

## Exercices

Les quatre exercices sont autocorrectifs : chacun se termine par une exécution qui t'indique si tu as vu juste. Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** de lancer quoi que ce soit.

### Exercice 1 — Quatre codes que le lecteur ne connaît pas

Sans rien exécuter, prédis pour chacun de ces codes trois choses : ce qu'indique `respuesta.ok`, comment `comoSiFuera` le traite et quel code de sortie donne `curl -f`. Les codes sont `226`, `418`, `451` et `799`. Remplace ensuite la liste de la boucle dans `fig00_03.ts` par `[226, 418, 451, 799]`, lance le banc et le lecteur, et compare. Pour `curl -f`, utilise `curl -s -o /dev/null -w '%{http_code}\n' -f` suivi de l'adresse, puis `echo $?`.

### Exercice 2 — Suivre la redirection

Avec le banc en cours d'exécution, prédis ce qu'affiche `curl -i -L http://127.0.0.1:18080/codigo/308`. L'option `-L` indique à `curl` de suivre l'en-tête `Location`. Combien de lignes d'état vas-tu voir ? Quel chemin apparaît dans le corps final ? Et qu'écrit le banc dans son terminal ? Exécute la commande et compare.

### Exercice 3 — Compter la famille `4xx` dans le registre

Télécharge le registre des codes de l'IANA au format CSV :

```bash
curl -s -o codigos.csv https://www.iana.org/assignments/http-status-codes/http-status-codes-1.csv
```

Compte combien de codes `4xx` sont **assignés** en utilisant `grep`. Recherche ensuite quelle spécification définit le `429` et le `451`, et ce que le registre indique pour le `418`. Compare ton décompte avec celui de la section 0.7.1 : si tu n'as pas obtenu 28, la solution en explique la raison.

### Exercice 4 — Un menteur qui empêche la mise en cache

Quelqu'un propose un correctif pour le problème de la section 0.8 qui ne touche pas au numéro : que l'origine menteuse envoie `Cache-Control: no-store` dans ses erreurs, afin que le cache ne les enregistre pas. Copie `fig00_04.ts` sous le nom `ej4.ts` et remplace l'en-tête de la réponse `200` par celui-ci, qui n'autorise la mise en cache que pour les réponses saines :

```ts
    "Cache-Control": modo === "sano" ? "max-age=5, stale-if-error=600" : "no-store",
```

Avant de l'exécuter, prédis ce que voit un client du cache lorsque l'origine ment, et si le cache sert la copie valide. Répète ensuite la première exécution de 0.8.2 avec `ej4.ts` et compare. Ce correctif résout-il le problème ?

## Solutions

Les quatre solutions ont été exécutées avec [`soluciones.sh`](../programas/00-el-contrato-que-viaja/soluciones.sh), qui crée les copies `ej1.ts` et `ej4.ts` dans un dossier temporaire et utilise les ports du cours ; sa sortie complète se trouve dans `soluciones.salida.txt`. Les dates des en-têtes changent à chaque exécution ; le reste doit coïncider.

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

(Ici, `ej1.ts` est ta copie de `fig00_03.ts` avec la liste modifiée ; si tu as modifié `fig00_03.ts` directement, la commande est `node fig00_03.ts`.) Le `226` (*IM Used*) existe dans le registre, mais ne figure pas dans la table du lecteur, il est donc traité comme le `200` de sa famille, et `ok` vaut `true` parce qu'il se situe entre 200 et 299. Le `418` et le `451` (*Unavailable For Legal Reasons*, qui existe également) sont traités comme `400`. Le `799` est invalide et traité comme `500`. Pour `curl -f`, aucune surprise : tout ce qui est supérieur ou égal à `400` donne 22, et oui, cela inclut le `799` invalide. Si tu t'es trompé sur le `451`, retiens l'enseignement de l'exercice : ce n'est pas parce qu'un code existe dans le registre que ton programme le connaît, et c'est précisément pour cela que la règle du `x00` existe.

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

Deux lignes d'état : `curl` affiche avec `-i` les en-têtes de **chaque** réponse sur le parcours, mais le corps uniquement de la dernière. Le corps du `308` a bien existé (49 octets, comme l'indique son `Content-Length`), mais `curl` ne l'affiche pas parce qu'il a continué sa route. Le chemin final est `/codigo/200`, celui du `Location`, qui est relatif : `curl` l'a complété avec le serveur et le port de la requête initiale. Dans le terminal du banc sont apparues deux lignes, `GET /codigo/308` et `GET /codigo/200` : il y a eu deux requêtes, pas une seule. Ce qui change entre `301` et `308` lorsque la requête est un `POST` fait l'objet de la Leçon 1.

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

Le piège réside dans la première commande : elle donne 31, et non 28. Le registre consigne les trous de deux manières. Les grands trous forment une plage sur une seule ligne (`432-450,Unassigned`), et le motif `^4[0-9]{2},` ne les compte pas car après les trois chiffres vient un tiret et non une virgule. Mais les trous d'un seul numéro figurent sur leur propre ligne, avec leur numéro (`427,Unassigned` et `430,Unassigned`), et le motif les compte bel et bien. Ajoute à cela le `418`, qui n'est pas assigné mais réservé sans usage, et tu obtiens les trois lignes excédentaires. La seconde commande les retire et donne 28, le même chiffre obtenu en 0.7.1 avec un programme qui lit le CSV colonne par colonne ; quand un comptage compte, on le fait deux fois de deux façons différentes. Le `429` est défini par la RFC 6585, le `451` par la RFC 7725, et le `418` apparaît comme `(Unused)` avec une référence à la section 15.5.19 de la RFC 9110, qui explique pourquoi il est resté réservé.

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

Et dans le terminal du programme :

```text
origen en http://127.0.0.1:18081 (PUT /modo/sano|mentiroso|honesto)
caché en http://127.0.0.1:18080/servicios
caché: guardé la respuesta 200 por 5 s
origen: ahora estoy mentiroso
caché: el origen respondió 200; no la guardo
caché: el origen respondió 200; no la guardo
```

Ce correctif limite les dégâts, mais ne résout pas le problème. Le cache n'enregistre plus l'erreur, il ne la répète donc plus à tout le monde pendant des minutes : chaque requête réinterroge l'origine. Mais il ne sert pas non plus la copie valide, qui était toujours là, car `stale-if-error` ne s'active qu'avec un `500`, `502`, `503` ou `504`, et ce qui est arrivé était un `200`. Le client voit l'erreur à chaque requête, le contrôle de santé continue de passer, et la copie valide ne sert strictement à rien. Compare cela avec la seconde exécution de 0.8.3 : le `503` a fait les trois choses correctement en même temps. Aucun en-tête ne compense un numéro erroné.

## Comment savoir que j'ai réussi

- [ ] `node -v` commence par `v24`, et `curl --version` répond.
- [ ] Avec `fig00_01.ts` en cours d'exécution, tu identifies dans la sortie de `curl -i` la ligne d'état, chaque en-tête, la ligne vide et le corps, et tu expliques pourquoi `Content-Length` indique 28 et non 27.
- [ ] Tu expliques ce qu'affiche `curl -v` que `curl -i` n'affiche pas, et ce que signifient les lignes avec `>` et avec `<`.
- [ ] `curl -i http://127.0.0.1:18080/codigo/503` face au banc donne `503 Service Unavailable` avec `Retry-After: 120`, et `curl -i -X DELETE` donne `405` avec `Allow: GET, HEAD`, exactement comme en 0.4.3.
- [ ] `node fig00_03.ts` affiche les huit lignes de 0.6.2, et tu expliques sans regarder pourquoi le `471` est traité comme `400` et le `600` comme `500`.
- [ ] Tu récites de mémoire la règle du `x00` et précises dans quelle section de la RFC 9110 elle se trouve.
- [ ] Tu as répété les deux exécutions de 0.8 et tes terminaux affichent la même chose que la leçon, à la date près : l'erreur enregistrée avec `Age: 0` dans la première, et la copie valide avec `Age: 6` et le code de sortie 22 dans la seconde.
- [ ] Ton décompte des codes `4xx` assignés dans le registre de l'IANA a donné 28, et tu sais pourquoi le décompte naïf donne 31.
- [ ] À la fin, aucun programme ne reste en écoute : `curl -i http://127.0.0.1:18080/` produit l'erreur 7.

## Résumé

Réponds sans regarder la leçon :

1. Quelles sont les trois parties d'une réponse HTTP et qu'est-ce qui les sépare ?
2. Pourquoi un client devrait-il ignorer le libellé de la ligne d'état ? Donne un exemple tiré de cette leçon.
3. À quelle question répond chacune des cinq familles, et pourquoi la `1xx` est-elle différente des quatre autres ?
4. Que doit faire un client face à un code qu'il ne connaît pas ? Et face à un code supérieur à 599 ?
5. Qui décide quels codes existent, et où consulte-t-on la liste ?
6. Que signifie « le code fait foi et le corps explique » ? Que se passe-t-il lorsque les deux ne disent pas la même chose ?
7. Dans le cache de 0.8, pourquoi le `200` menteur perd-il la copie valide tandis que le `503` la conserve ?
8. En quoi l'erreur 7 et l'erreur 22 de `curl` se distinguent-elles, et pourquoi cette différence importe-t-elle au `revisor` ?

## Sources

Toutes ont été consultées le 21 octobre 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), section 15 : les cinq familles, la règle du `x00` pour un code inconnu et celle des valeurs hors de 100 à 599. C'est la source principale de cette leçon et du cours.
2. [RFC 9110, sections 15.5 et 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5) : dans un `4xx` et dans un `5xx`, le serveur devrait expliquer l'erreur dans le corps, sauf dans une réponse à un `HEAD`.
3. [RFC 9110, sections 15.3.2, 15.5.2 et 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2) : `Location` dans le `201`, `WWW-Authenticate` obligatoire dans le `401` et `Allow` obligatoire dans le `405`, les en-têtes du banc.
4. [RFC 9110, section 16.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-16.2.1) : le registre des codes d'état de l'IANA et la révision de l'IETF qu'exige un nouveau code.
5. [RFC 9112, *HTTP/1.1*](https://www.rfc-editor.org/rfc/rfc9112.html), section 4 : la forme de la ligne d'état et pourquoi un client devrait ignorer le libellé.
6. [RFC 9111, *HTTP Caching*](https://www.rfc-editor.org/rfc/rfc9111.html), sections 3 et 5.1 : quand un cache peut enregistrer une réponse et ce qu'indique l'en-tête `Age`.
7. [RFC 5861, *HTTP Cache-Control Extensions for Stale Content*](https://www.rfc-editor.org/rfc/rfc5861.html), section 4 : `stale-if-error` et la liste fermée des codes comptant comme une erreur (`500`, `502`, `503`, `504`).
8. [RFC 6585, *Additional HTTP Status Codes*](https://www.rfc-editor.org/rfc/rfc6585.html) : définit le `428` et le `429`, ainsi que le `Retry-After` facultatif du `429`.
9. [Registre des codes d'état de HTTP, IANA](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml), version mise à jour le 15 septembre 2025 : d'où proviennent les 62 codes assignés, les libellés du banc et le `418` réservé sans usage.
10. [Registre des noms de champs de HTTP, IANA](https://www.iana.org/assignments/http-fields/http-fields.xhtml) : les 260 en-têtes enregistrés et leur statut.
11. [Registre des types de problème de HTTP, IANA](https://www.iana.org/assignments/http-problem-types/http-problem-types.xhtml), créé par la [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) : six entrées, la première étant `about:blank`. Utilisé dans la Leçon 5.
12. [Standard Fetch, WHATWG](https://fetch.spec.whatwg.org/) : la définition d'un statut *ok* (de 200 à 299) qu'utilise `respuesta.ok`.
13. [Manuel de `curl`](https://curl.se/docs/manpage.html) : `-i` (`--show-headers`), `-v`, `-I`, `-f` et le code de sortie 22.
14. [Node.js 24 : TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html) et [Node.js 24 : HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html) : l'exécution de `.ts` en effaçant les types, la syntaxe non admise, les options recommandées de `tsc` et la signature de `writeHead`.
15. [Calendrier des versions de Node.js](https://github.com/nodejs/Release) et [nvm](https://github.com/nvm-sh/nvm) : les dates de LTS de Node 24 et 26, et l'installateur de nvm 0.40.8.

### Lectures complémentaires

- La série **« HTTP et Problem Details »** de [En construcción](https://enconstruccionmx.substack.com/), la lettre d'information de Hábil, en quatre volets. Le premier, « Le 200 qui mentait », illustre par une autre histoire la même idée que cette leçon et parcourt treize codes avec une API de contacts, un serveur qui ment et un autre honnête ; le deuxième décortique le format des *Problem Details* que ce cours enseigne dans la Leçon 5 ; le troisième et le quatrième l'implémentent en Spring Boot, Quarkus, ASP.NET Core, FastAPI et Go. Ce cours ne les répète pas : si tu as envie de voir les codes avec un autre exemple, ou de voir le format dans ton langage, commence par là.

### Termes de cette leçon

| | |
|---|---|
| **en-tête** (*header field*) | chaque ligne `Nom: valeur` entre la ligne d'état et le corps ; les noms sont insensibles à la casse |
| **cache partagé** | programme situé entre les clients et le serveur qui enregistre des réponses et les répète à n'importe quel client |
| **contrôle de santé** (*health check*) | test automatique qui détermine si un service fonctionne correctement, presque toujours d'après le code d'état |
| **code d'état** | le nombre à trois chiffres de la ligne d'état ; son premier chiffre indique la famille |
| **famille** | la catégorie d'un code selon son premier chiffre : de `1xx` à `5xx` |
| **IANA** | l'organisme qui maintient les registres officiels des codes, des en-têtes et des types de médias |
| **ligne d'état** | la première ligne d'une réponse : version, code et libellé (*reason phrase*) |
| ***reason phrase*** | le libellé textuel après le code (`OK`, `Not Found`) ; décorative, un client devrait l'ignorer |
| **réponse intermédiaire** | une réponse `1xx` : arrive avant la réponse finale et ne la remplace jamais |
| **LTS** | *long-term support* : une branche de versions qui reçoit des correctifs pendant des années |

---

**Suivante :** [Leçon 1 — Succès et redirections : 200, 201, 202, 204, 301, 308 et 304](01-exitos-redirecciones.md)

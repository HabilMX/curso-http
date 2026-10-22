# Leçon 2 — Le client s'est trompé (I) : 400, 401, 403, 404, 405 et 415

Il est 2 h 10 un mardi et le `revisor` est en production depuis trois semaines, ouvert à quiconque atteint son port. Cette nuit, quelqu'un de l'équipe de la paie a écrit un script pour enregistrer ses services et l'a laissé tourner. Le script envoie les données sous forme de formulaire et non en JSON, et le `revisor` lui répond `400` à chaque tentative, avec la même ligne que d'habitude. Le script ne regarde que le code, et pour lui un `400` est un `400` : il ne sait pas lire la phrase du corps, alors il renvoie la même chose. Pendant ce temps, dans un autre terminal, un stagiaire découvre qu'avec un simple `DELETE` n'importe qui peut retirer le service de paiements d'une autre équipe, parce que le `revisor` ne demande à personne qui il est. Et dans un troisième, un script que personne ne reconnaît parcourt `/servicios/1`, `/servicios/2`, `/servicios/3`… et note ceux où la réponse diffère. À 2 h 40, il a déjà la liste complète de ce que surveille l'entreprise. Trois problèmes différents, et l'API les traite tous avec deux codes et un point d'entrée qui n'existe pas.

Cette leçon construit ce point d'entrée : sept questions, toujours dans le même ordre, et un code différent pour chaque réponse.

**Durée :** 90 min, ou 2 × 45 (la coupure se situe entre les sections 2.4 et 2.5)

**Ce que tu construis :** le point d'entrée de l'API du `revisor` : route, méthode, jeton, permission, existence, type de contenu et lecture du corps, avec un code différent pour chaque échec ; et un petit programme qui tente de deviner quels services existent, pour vérifier que le point d'entrée ne le laisse pas faire

**Ce que tu apprends :** les sept questions du point d'entrée et pourquoi elles vont dans cet ordre : route → méthode → jeton → permission → existence → format → lecture ; `401` face à `403` ; `404` face à `405` ; `415` et `413` face à `400` ; `WWW-Authenticate` et `Allow`, les deux en-têtes que la spécification rend obligatoires ; et quand un `404` dissimule délibérément une ressource qui existe bel et bien, avec l'encadré de sécurité sur l'**énumération de ressources**

**D'où tu viens.** De la [Leçon 1](01-exitos-redirecciones.md), avec le `revisor` qui enregistre, consulte, retire et vérifie des services, et qui redirige ses anciennes routes avec `301` et `308`. Ce `revisor` répond déjà deux erreurs, un `400` et un `404`, mais la Leçon 1 les a utilisées comme filet de sécurité et t'a promis de les expliquer ici. Et il a trois failles que cette leçon comble : il ne sait pas qui lui parle, il ne distingue pas une route qui n'existe pas d'une méthode qu'il n'admet pas, et il accepte n'importe quel corps qui ressemble à du JSON, quel que soit le type annoncé.

**Ce que cette leçon ne fait pas.** Elle n'enseigne pas une véritable authentification : les jetons sont quatre mots écrits dans le code, alors que dans une vraie API ils proviennent d'un fournisseur d'identité, avec des jetons qui expirent et qui sont signés (le [README](README.md) explique pourquoi le cours laisse ce sujet de côté). Elle n'enseigne pas le `422` : ici, tout ce qui n'est pas utilisable dans le corps répond `400`, et la [Leçon 3](03-errores-del-cliente-estado.md) sépare ce qui ne peut pas être lu de ce qui se lit mais ne peut pas être satisfait. Et les corps d'erreur restent une ligne de texte ; la [Leçon 5](05-problem-details.md) les remplace par `application/problem+json`.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sous macOS avec Node 24.14.1 et curl 8.7.1, et aucune ne dépend d'une particularité de macOS. Dans ton exécution, deux choses vont changer : la date de l'en-tête `Date` et les huit chiffres finaux de chaque `ETag` (`"3-1-80925024"` dans l'exécution de la leçon), que le `revisor` tire au sort à chaque démarrage ; la section 2.7.4 explique pourquoi, et lorsqu'une requête a besoin de l'étiquette, copie celle que tu as obtenue dans la réponse précédente. Le `revisor` garde tout en mémoire : pour obtenir la même chose que la leçon, redémarre-le avant chaque série de requêtes, car un enregistrement ou un retrait antérieur modifie les réponses. Les programmes se trouvent dans [`programas/02-errores-del-cliente-peticion/`](../programas/02-errores-del-cliente-peticion), dans le dépôt du cours : le `revisor` dans `fig02_01/`, l'énumérateur dans `fig02_02.ts`, les versions défectueuses de « L'erreur que tu vas voir » dans `defectos/`, et chaque exécution dans son fichier `.salida.txt`. Tous passent `tsc` en mode strict, avec la commande de la section 0.9 de la Leçon 0 plus l'option `--allowImportingTsExtensions`, nécessaire depuis que le `revisor` comporte plusieurs fichiers qui s'importent mutuellement avec leur extension `.ts`.

## À la fin, tu seras capable de

- Réciter dans l'ordre les sept questions du point d'entrée et prédire, pour une requête donnée, à laquelle elle s'arrête et quel code elle reçoit.
- Distinguer par une exécution un `401` d'un `403`, et un `404` d'un `405`, et dire quel en-tête chacun exige.
- Écrire l'en-tête `WWW-Authenticate` d'un `401` et l'en-tête `Allow` d'un `405`, et citer la section de la RFC 9110 qui les rend obligatoires.
- Rejeter un corps du mauvais type avec `415` et `Accept`, et un corps illisible avec `400`.
- Démontrer avec un programme que l'API ne révèle pas quels services d'une autre équipe existent, et expliquer quelle modification du code suffirait pour qu'elle le révèle.
- Expliquer pourquoi une table de jetons écrite sous forme d'objet JavaScript peut accepter un jeton que personne n'a enregistré.

## Le pourquoi avant le comment

Une erreur du client est un code `4xx`, et la Leçon 0 t'a donné la question à laquelle répond cette famille : **qui s'est trompé ? Celui qui a demandé.** Mais « celui qui a demandé s'est trompé » ne sert pas à grand-chose à celui qui a demandé. Ce qu'il a besoin de savoir, c'est **ce qu'il** a fait de travers, car chaque erreur se corrige différemment :

| Si le problème est… | Celui qui a demandé doit… | Code |
|---|---|---|
| la route n'existe pas | vérifier l'adresse | `404` |
| la route existe, mais pas avec cette méthode | utiliser une autre méthode, parmi celles qu'indique `Allow` | `405` |
| il n'a pas dit qui il est, ou il l'a mal dit | s'authentifier | `401` |
| il a dit qui il est, mais ce n'est pas de son ressort | demander la permission à quelqu'un, ou renoncer | `403` |
| la ressource n'existe pas (pour lui) | cesser de la chercher | `404` |
| il a envoyé le corps dans un format non accepté | changer de format, pour celui qu'indique `Accept` | `415` |
| le corps ne peut pas être lu | corriger le corps | `400` |

Chaque ligne est une action différente, et presque toujours, c'est un programme qui l'exécute, pas une personne. Le script de la scène d'ouverture réessayait parce que, pour un programme, un `400` est un `400` : le corps disait « el cuerpo no es JSON », mais un programme n'interprète pas les phrases, et le code était le même que pour n'importe quel autre corps invalide. Avec un `415` et un `Accept: application/json`, le **code** lui aurait dit que le problème venait du format, et lequel utiliser. (Et le script était lui aussi mal écrit : aucun client bien conçu ne répète sans modification une requête qui a reçu un `4xx`, car cette famille dit que celui qui doit changer quelque chose est celui qui a demandé.) **Un code bien choisi dit au client quoi faire**, c'est le deuxième principe du cours, et la [Leçon 7](07-quien-lee-el-error.md) transforme cette table en programme qui décide.

La table possède une autre propriété, moins visible et plus importante : **elle est ordonnée**. Demander d'abord « qui es-tu ? » puis « est-ce que ça existe ? » n'est pas la même chose que l'inverse. Si le `revisor` dit à un inconnu « ce service n'existe pas » avant de lui demander qui il est, il lui a déjà appris quelque chose. S'il lui dit « ce service appartient à une autre équipe », il lui a appris qu'il existe. L'ordre des questions décide de ce qu'apprend de ton API celui qui ne devrait rien apprendre, et c'est pourquoi cette leçon lui consacre autant de place.

La leçon comporte quatre parties :

1. **Le point d'entrée** (2.1) : les sept questions et pourquoi elles vont dans cet ordre.
2. **Les quatre questions du point d'entrée** (2.2 à 2.4) : route et méthode (`404`, `405`), jeton (`401`) et permission (`403`).
3. **Les trois du gestionnaire** (2.5 et 2.6) : existence (`404`, celui qui dissimule), format et lecture (`415`, `400`), avec l'encadré de sécurité.
4. **Le `revisor` complet** (2.7) : les fichiers et l'exécution de tous les cas.

## Les concepts

### 2.1 Le point d'entrée : sept questions dans l'ordre

#### 2.1.1 Les questions

Commence par deux requêtes que tu connais déjà depuis la scène d'ouverture : l'une sans jeton, l'autre avec une méthode que la route n'admet pas.

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

Deux requêtes, deux codes différents : chacune s'est arrêtée à une question différente. Voici les sept :

Lorsqu'une requête arrive au `revisor`, avant qu'il en fasse quoi que ce soit, elle passe par une série de questions. Chacune a une réponse par oui ou par non, et un « non » arrête la requête à cet endroit avec un code qui lui est propre :

| # | Question | Si la réponse est « non » | Où l'on y répond |
|---|---|---|---|
| 1 | La route existe-t-elle ? | `404` | `rutas.ts` |
| 2 | La route admet-elle cette méthode ? | `405` + `Allow` | `rutas.ts` |
| 3 | Qui es-tu ? | `401` + `WWW-Authenticate` | `rutas.ts` |
| 4 | As-tu le droit de faire cela ? | `403` | `rutas.ts` |
| 5 | La ressource existe-t-elle, pour toi ? | `404` | le gestionnaire, dans `servicios.ts` |
| 6 | Le corps arrive-t-il dans un format que j'accepte ? | `415` + `Accept` | le gestionnaire |
| 7 | Puis-je le lire ? | `400`, ou `413` si le corps dépasse le plafond de taille | le gestionnaire |

En une ligne : **route → méthode → jeton → permission → existence → format → lecture**. Sept questions, sept étapes. Les quatre premières sont traitées par le point d'entrée, dans `rutas.ts`, de la même façon pour toutes les routes. Les trois dernières dépendent de ce que demande chaque route, et c'est pourquoi le gestionnaire y répond : seul un `POST` porte un corps, et seule une route avec `{id}` désigne une ressource qui peut ne pas exister. Une requête qui franchit les sept parvient à faire son travail et reçoit un succès, parmi ceux que tu as vus dans la Leçon 1.

Avant la première question, il y a une étape que tu connais déjà : les routes héritées. `/viejo/servicios` et `/api/servicios` sont redirigées avec `301` et `308` sans autre question, car une redirection ne livre aucune donnée : elle dit seulement où se trouve la nouvelle route, et c'est là que commencent les questions. Les Leçons 3 et 4 ajoutent deux autres arrêts au même endroit, avant tout le reste (la version retirée de l'API et le mode maintenance), et aucun ne modifie l'ordre des sept.

#### 2.1.2 Pourquoi cet ordre

L'ordre n'est pas arbitraire, et ce n'est pas le seul possible. Il découle de trois règles, qu'il vaut mieux garder à l'esprit car ce sont celles que tu utiliseras lorsque tu concevras ton propre point d'entrée.

**Première règle : on ne peut pas répondre à une question sans les précédentes.** Tu ne peux pas dire si une méthode est admise sans savoir de quelle route il s'agit ; tu ne peux pas dire si quelqu'un a le droit de faire quelque chose sans savoir qui il est ; tu ne peux pas lire un corps sans savoir s'il est dans un format que tu comprends. Cette règle à elle seule fixe une bonne partie de l'ordre : la route avant la méthode, le jeton avant la permission, le format avant la lecture.

**Deuxième règle : celui qui ne s'est pas identifié n'apprend rien des données.** Le jeton passe avant l'existence. Si c'était l'inverse, un inconnu pourrait demander `/servicios/1`, `/servicios/2` et `/servicios/3` et savoir, par la différence entre un `404` et ce qui serait répondu ensuite, lesquels existent. Avec le jeton en premier, un inconnu reçoit `401` partout, que le service existe ou non. Il en va de même pour le corps : si le `revisor` validait le corps avant de demander le jeton, n'importe qui pourrait apprendre, à force de `400`, quels champs attend l'enregistrement et quelles valeurs il admet, sans jamais s'être identifié. Et en plus, le serveur dépenserait du travail à lire les corps de ceux qui n'ont pas le droit de les envoyer.

**Troisième règle : la permission qui dépend du rôle passe avant l'existence.** Un lecteur ne peut rien supprimer, que cela existe ou non. C'est pourquoi le `403` arrive avant la question sur la ressource, et la réponse à « un lecteur tente de supprimer le service 99 » est `403`, pas `404`, même si le 99 n'existe pas. Ainsi, le `403` ne dit rien sur ce qui existe : il dépend uniquement du jeton et de la méthode, pas de l'identifiant. Tu le verras avec une exécution dans la section 2.4.

Reste une décision qui ne découle d'aucune règle et qu'il vaut mieux appeler par son nom : **la route et la méthode passent avant le jeton**. Le `revisor` répond `404` à une route qui n'existe pas et `405` à une méthode non admise, même à celui qui n'a pas dit qui il est. Cela révèle à un inconnu quelles routes et quelles méthodes possède l'API. Le `revisor` le fait délibérément, car cette information est déjà publique : elle figure dans sa documentation, et dans la [Leçon 8](08-contrato-verificable.md) elle sera dans une description OpenAPI que n'importe qui peut lire. Ce que cache le point d'entrée, ce sont les **données**, pas la forme de l'API. Certaines API décident autrement et répondent `401` à tout ce qui arrive sans jeton, même à une route qui n'existe pas ; c'est une décision défendable lorsque la forme de l'API est elle aussi secrète. Aucune spécification n'impose l'une ou l'autre : **c'est un principe de conception, pas une norme**, et ce qui est obligatoire, en revanche, c'est de l'écrire et de l'appliquer de la même façon à toutes les routes.

#### 2.1.3 Le code du point d'entrée

Le point d'entrée vit dans la fonction `atender` de `rutas.ts`, qui dans la Leçon 1 était une boucle de six lignes. Elle contient désormais les quatre premières questions écrites l'une après l'autre, numérotées comme dans la table. Le fichier complet se trouve dans la section 2.7 ; voici la fonction, à lire avec la table à côté :

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

Elle se lit de haut en bas, et chaque bloc se termine par un `return` si la réponse est « non ». La première question cherche la route par son motif, **sans regarder la méthode** : c'est la différence avec la Leçon 1, où la route et la méthode étaient recherchées ensemble, et où une mauvaise méthode ne trouvait rien et tombait dans le `404`. Les séparer est ce qui permet de répondre `405`. La deuxième question cherche la méthode dans la route trouvée, en traitant `HEAD` comme `GET`, et la cherche avec `Object.hasOwn`, pour une raison qu'explique la section 2.3.3. La troisième et la quatrième utilisent `autenticacion.ts`, qui est nouveau. Et à la fin, le point d'entrée appelle le gestionnaire et lui transmet le jeton, pour que le gestionnaire puisse répondre aux trois questions qui lui reviennent.

Observe comment est déclarée la table de routage : chaque méthode indique si elle **lit** ou si elle **écrit**.

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

`lee` et `escribe` sont deux fonctions d'une ligne qui enveloppent le gestionnaire avec cette marque. Cette marque est ce qu'utilise la question 4 : un lecteur peut utiliser les méthodes qui lisent et pas celles qui écrivent. C'est un modèle de permissions délibérément réduit, à trois rôles, mais il possède la propriété qui compte : **la permission se déclare à côté de la route**, sur la même ligne, et non cachée dans chaque gestionnaire, où il est facile de l'oublier dans l'un d'eux.

### 2.2 Route et méthode : `404` et `405`

#### 2.2.1 Une route qui n'existe pas

La première question est la plus simple. Si aucune entrée de la table ne reconnaît la route, la réponse est `404 Not Found`. La RFC 9110 le définit dans la [section 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5) : le serveur n'a pas trouvé de représentation actuelle de la ressource demandée, **ou n'est pas disposé à révéler qu'elle existe**. Retiens la seconde moitié de cette phrase ; tu en auras besoin dans la section 2.5.

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

`/servicioss`, avec un « s » de trop, ne figure pas dans la table, et le point d'entrée s'arrête à la question 1. Remarque que la requête portait bien un jeton valide, et que cela n'a eu aucune importance : le point d'entrée n'en était pas encore à l'examiner.

#### 2.2.2 Une méthode que la route n'admet pas

La deuxième question est celle à laquelle le `revisor` de la Leçon 1 ne savait pas répondre. `/servicios/1` existe, mais n'admet que `GET` (pour consulter) et `DELETE` (pour retirer). Si tu lui envoies un `PATCH` :

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

`405 Method Not Allowed`. La RFC 9110 le définit dans la [section 15.5.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6) : le serveur connaît la méthode, mais la ressource ne l'admet pas. Et dans la même section figure le premier des deux en-têtes obligatoires de cette leçon : le serveur **doit** (*MUST*) envoyer dans un `405` un en-tête `Allow` avec la liste des méthodes que la ressource admet. La [section 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.1), qui définit `Allow`, le répète et ajoute qu'il peut être envoyé dans n'importe quelle autre réponse, mais que dans un `405` il est obligatoire.

Pourquoi obligatoire ? Parce que sans lui, le `405` ne dit pas quoi faire. « Pas cette méthode » laisse le client essayer des méthodes à l'aveugle ; « pas cette méthode, mais celles-ci » lui donne la correction complète. `Allow: GET, HEAD, DELETE` dit exactement ce que tu peux faire avec `/servicios/1`. La fonction `permitidos` de `rutas.ts` le construit à partir des méthodes de la table, et ajoute `HEAD` juste derrière `GET`, car toute route qui admet `GET` admet aussi `HEAD` (Node n'envoie pas le corps ; tu l'as vu dans la Leçon 0).

Voici l'erreur que le `revisor` de la Leçon 1 commettait délibérément : à ce même `PATCH`, il répondait `404 no existe esa ruta`. C'était un mensonge, et un mensonge qui coûte cher : un client qui reçoit `404` conclut que l'adresse est fausse et se met à en chercher une autre, alors que l'adresse était correcte et que c'était la méthode qu'il fallait changer.

#### 2.2.3 `405` face à `501`

Il existe un code voisin qu'il convient de distinguer : `501 Not Implemented`. La [section 9.1 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1) trace la frontière : si le serveur **ne reconnaît pas ou n'implémente pas** la méthode nulle part, il devrait répondre `501` ; s'il la reconnaît et l'implémente, mais **pas pour cette ressource**, il devrait répondre `405`. Le `revisor` répond `405` à toute méthode **que Node connaît** et que la route n'admet pas, comme `PATCH` ou `PUT`. Une méthode inventée, comme `BORRAR`, n'arrive même pas jusqu'à lui : l'analyseur HTTP de Node la rejette avant avec un `400 Bad Request` sans corps (tu le verras avec `-X constructor` dans la section 2.3.3). Selon la RFC, il faudrait là un `501`, mais cette décision est prise par Node et non par le `revisor`. Le `501` n'est pas un protagoniste de ce cours : le laboratoire le produit sur `/codigo/501` si tu veux le voir.

Une subtilité qui mérite d'être vérifiée de tes propres mains : la route des vérifications, `/servicios/{id}/revisiones`, n'admet que `POST`. Que se passe-t-il si tu lui fais un `HEAD` ?

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

`405` avec `Allow: POST`. `HEAD` n'est admis que là où `GET` l'est, et cette route n'a pas de `GET`. Et la requête ne portait pas de jeton : le point d'entrée s'est arrêté à la question 2 sans arriver à la 3, comme le veut l'ordre.

### 2.3 Qui es-tu ? : `401` et `WWW-Authenticate`

#### 2.3.1 Jeton absent, jeton invalide

La troisième question exige que le client dise qui il est. En HTTP, cela se fait avec l'en-tête `Authorization`, et le `revisor` utilise le schéma le plus courant dans les API : **`Bearer`**, défini dans la [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html). La requête envoie `Authorization: Bearer <jeton>`, et celui qui détient le jeton (celui qui le « porte », d'où le nom) est celui qu'il prétend être. C'est précisément pour cela que, dans une vraie API, un jeton `Bearer` ne circule que chiffré, par `https` : la RFC 6750, dans sa [section 5.3](https://www.rfc-editor.org/rfc/rfc6750.html#section-5.3), exige que les clients utilisent toujours TLS, car quiconque le lit en chemin peut l'utiliser. Le cours utilise `http` uniquement parce que tout se passe à l'intérieur de ta machine, sur `127.0.0.1`, et que rien ne sort sur le réseau. Les jetons du cours sont au nombre de quatre, écrits dans `autenticacion.ts` :

| Jeton | Équipe | Rôle |
|---|---|---|
| `lectura-a` | a | lecteur |
| `escritura-a` | a | rédacteur |
| `escritura-b` | b | rédacteur |
| `admin` | toutes | admin |

Sans jeton :

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

Avec un jeton qui n'existe pas :

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

Les deux sont des `401 Unauthorized`, et les deux portent le second en-tête obligatoire de la leçon. La [section 15.5.2 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2) définit le `401` ainsi : la requête n'a pas été appliquée parce qu'il lui manque des informations d'authentification valides pour la ressource. Et dans la phrase suivante : le serveur qui génère un `401` **doit** envoyer un en-tête `WWW-Authenticate` avec au moins un **challenge** (*défi*) applicable à la ressource. Le challenge indique au client **comment** s'authentifier : avec quel schéma (`Bearer`) et dans quel domaine de protection (`realm="revisor"`, un nom pour l'espace protégé). Un `401` sans `WWW-Authenticate`, c'est comme un panneau « identifiez-vous » qui ne dit pas avec quoi.

La différence entre les deux réponses réside dans le challenge. Quand aucun jeton n'est arrivé, le challenge est seulement `Bearer realm="revisor"`. Quand il en est arrivé un qui n'est pas valable, il ajoute `error="invalid_token"`. Cette règle ne vient pas du `revisor`, elle vient de la RFC 6750, dans sa [section 3.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-3.1) : `invalid_token` est le code pour un jeton expiré, révoqué, malformé ou invalide pour toute autre raison, et il accompagne un `401` ; mais si la requête **ne porte aucune information d'authentification** (parce que le client ne savait pas qu'il en fallait, ou parce qu'il a utilisé **une méthode d'authentification que le serveur n'admet pas**), le serveur **ne devrait pas** inclure dans le challenge de code d'erreur ni d'autre information d'erreur (les attributs `error`, `error_description` et `error_uri`). Le corps de la réponse échappe à cette règle, et le `revisor` l'utilise pour expliquer en espagnol ce qui s'est passé. La distinction est utile au client : « tu n'as rien envoyé » se corrige en envoyant le jeton ; « tu en as envoyé un qui n'est pas valable » se corrige en en obtenant un autre.

Cette dernière phrase de la RFC comporte un cas qu'il vaut la peine de voir : un client qui envoie son identifiant et son mot de passe avec le schéma `Basic`, celui de la petite fenêtre d'identifiant et de mot de passe qu'ouvre le navigateur (défini par la [RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html)). Il n'a pas envoyé un mauvais jeton `Bearer` : il n'a envoyé aucun `Bearer`. Le `revisor` répond avec le challenge **sans** code d'erreur, et le dit dans le corps :

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

Et un détail de plus, tiré de la [section 11.1 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1) : le nom du schéma d'authentification **n'est pas sensible à la casse**. `Bearer`, `bearer` et `BEARER` sont le même schéma, et un serveur qui n'accepte que le premier rejette des clients conformes à la spécification :

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

La liste contient déjà le service 4, enregistré plus tôt dans la même exécution (la section 2.7 la montre en entier). Ce qui est sensible à la casse, en revanche, c'est le jeton lui-même : `Bearer Lectura-a` est un jeton qui n'existe pas.

Une remarque sur le nom, car il déroute tout le monde au moins une fois : le `401` s'appelle *Unauthorized*, « non autorisé », mais ce qu'il dit, c'est **non authentifié** : je ne sais pas qui tu es. « Non autorisé » au sens de « je sais qui tu es et ce n'est pas de ton ressort », c'est le `403`, celui de la section suivante. Le nom est un héritage des premières versions de HTTP et ne peut plus être changé ; le sens est dans la spécification, pas dans la phrase.

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

Le fichier comporte quatre éléments. La **table** des jetons, qui n'existerait pas dans une vraie API : les jetons sont émis par un fournisseur d'identité et le serveur les vérifie, par exemple en contrôlant la signature d'un jeton. La fonction **`identificar`**, qui lit l'en-tête `Authorization` et renvoie l'un de quatre résultats : aucun n'est arrivé, il est arrivé avec un autre schéma, un `Bearer` invalide est arrivé, ou un valide est arrivé, avec son jeton. Elle sépare d'abord le nom du schéma (ce qui précède le premier espace) et le compare en minuscules ; si ce n'est pas `bearer`, elle ne cherche même pas le jeton. La fonction **`motivo`** écrit la phrase du corps du `401` pour chaque cas, et la fonction **`reto`** construit la valeur de `WWW-Authenticate` : le code `invalid_token` seulement quand un jeton `Bearer` non valable est arrivé. Le type `Identificacion` est une union de quatre cas, et le point d'entrée interroge `tipo` avant d'utiliser `credencial` ; TypeScript ne le laisse pas l'utiliser dans les trois autres.

#### 2.3.3 Pourquoi la table est une `Map`

Il y a dans la table des jetons un détail qui semble relever du style et qui relève de la sécurité : c'est une `Map`, et on la consulte avec `CREDENCIALES.get(token)`. La forme qui vient d'abord à l'esprit de presque tout le monde est un objet, `{ "lectura-a": {…}, "admin": {…} }`, consulté avec `CREDENCIALES[token]`. Cela paraît tout aussi correct, TypeScript ne se plaint pas, et les quatre jetons fonctionnent de la même manière. Mais il y a une faille.

En JavaScript, un objet écrit avec des accolades **hérite** des propriétés d'un autre objet, son **prototype**, `Object.prototype`. C'est pourquoi tout objet répond à `toString`, à `hasOwnProperty` ou à `constructor`, même si personne ne les y a écrits. Et `CREDENCIALES[token]` ne distingue pas ce qui a été écrit dans l'objet de ce qu'il a hérité : si le jeton est `constructor`, la recherche trouve quelque chose, la fonction `Object`, et ce quelque chose n'est pas `undefined`. Pour `identificar`, qui se demande seulement si elle a trouvé quelque chose, **`Bearer constructor` serait un jeton valide**. La section « L'erreur que tu vas voir » le provoque avec une exécution, et ce que répond le `revisor` dans ce cas n'est pas ce à quoi tu t'attendrais.

`Map.get` n'a pas ce problème : elle ne renvoie que ce qui a été enregistré avec `set` (ou dans la liste initiale), et pour toute autre clé, `undefined`. L'autre défense correcte est un objet sans prototype, créé avec `Object.create(null)` et consulté avec `Object.hasOwn(objeto, token)`, qui ne regarde que les propriétés propres. Les deux comblent la faille ; la `Map` indique en outre clairement, à qui lit le code, qu'il s'agit d'une table de recherche et non d'un objet avec des propriétés.

Le cas enseigne quelque chose qui dépasse JavaScript : **la question « qui es-tu ? » ne reçoit un « oui » que lorsqu'on a trouvé exactement ce qu'on cherchait**. Tout chemin du code qui peut renvoyer « j'ai trouvé quelque chose » par accident (une propriété héritée, une comparaison qui accepte une chaîne vide, une recherche insensible à la casse là où elle devrait y être sensible) est un jeton que personne n'a émis. Dans une vraie API, cet accident se loge dans la vérification de la signature d'un jeton, dans la comparaison d'une clé ou dans la requête à une base de données, et la règle est la même.

Le même soin apparaît à un autre endroit du point d'entrée. La table des méthodes de chaque route est aussi un objet (`{ GET: …, DELETE: … }`), et la méthode est écrite par le client. C'est pourquoi `atender` ne la consulte pas avec `ruta.metodos[nombreMetodo]` tout court, mais avec `Object.hasOwn(ruta.metodos, nombreMetodo)`, qui ne regarde que les méthodes écrites dans la table. Une méthode appelée `constructor` arriverait-elle ? En pratique, elle n'atteint même pas le point d'entrée :

```text
$ curl -i -X constructor http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
HTTP/1.1 400 Bad Request
Connection: close
```

L'analyseur HTTP de Node n'accepte que les méthodes qu'il connaît, et à toute autre il répond `400` de lui-même, sans corps et en fermant la connexion, avant d'appeler `atender` ; c'est pourquoi le terminal du `revisor` ne la note pas. Le point d'entrée ne dépend pas de ce filtre : une table qui décide de quelque chose à partir d'une valeur envoyée par le client s'écrit de façon à ne trouver que ce qui y a été enregistré, même si un autre élément filtre en amont, car cet autre élément peut changer demain.

### 2.4 En as-tu le droit ? : `403`

#### 2.4.1 Un lecteur qui tente d'écrire

Une fois le jeton vérifié, la quatrième question est de savoir si ce jeton peut faire ce qu'il demande. La fonction `puede` de `rutas.ts` le règle en une ligne : si la méthode lit, tout le monde le peut ; si elle écrit, seul un rédacteur ou un administrateur le peut.

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

`403 Forbidden`. La [section 15.5.4 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4) le définit ainsi : le serveur a compris la requête, mais refuse de la satisfaire. Et elle ajoute ce qui le sépare du `401` : si la requête portait des informations d'authentification, le serveur les considère comme **insuffisantes** pour donner accès, et le client **ne devrait pas** répéter la requête avec les mêmes informations d'authentification ; il peut la répéter avec d'autres. Le `403` n'exige aucun en-tête, contrairement au `401` et au `405`. (Avec des jetons OAuth, la RFC 6750 permet d'ajouter au `403` un challenge avec `error="insufficient_scope"` pour dire qu'il manque des permissions au jeton ; le `revisor` n'utilise pas de portées (*scopes*) et ne l'envoie pas.) Il peut expliquer dans le corps pourquoi il a refusé, et le `revisor` le fait : `tu credencial solo puede leer; para escribir pide una con rol de escritor`.

Remarque ce que ce texte ne dit **pas** : il ne répète pas le jeton. Il serait tentant d'écrire « la credencial `lectura-a` solo puede leer », qui paraît plus précis. Mais dans le `revisor`, le nom d'un jeton est le jeton lui-même : `lectura-a` est à la fois qui tu es et la clé pour entrer. Le répéter dans le corps, c'est écrire un secret dans une réponse, et les réponses d'erreur finissent dans des endroits que personne ne surveille : le journal d'un équilibreur de charge, le cache d'un intermédiaire, le rapport d'erreurs du client ou la capture d'écran que quelqu'un colle dans un chat pour demander de l'aide. Dans une API réelle, il en va de même avec un jeton : le message d'erreur dit ce qui manque au client (un rôle de rédacteur) et ne renvoie jamais ce que le client a envoyé pour s'identifier. Le client le sait déjà ; ceux qui ne doivent pas le savoir sont tous les maillons intermédiaires.

La question qui départage les deux codes est courte, et il vaut mieux la connaître par cœur : **est-ce que quelque chose changerait s'il s'identifiait à nouveau ?** Si je ne sais pas qui tu es, ou si ce que tu m'as donné n'est pas valable, t'identifier règle le problème : `401`. Si je sais qui tu es et que ce que tu demandes n'est pas de ton ressort, t'identifier à nouveau avec la même chose ne change rien : `403`. Un client qui reçoit `401` peut demander un nouveau jeton et réessayer ; celui qui reçoit `403` ne doit pas réessayer avec le même, et le plus sensé est de renoncer ou de demander la permission à une personne.

#### 2.4.2 Le `403` ne dépend pas de l'identifiant

C'est ici qu'apparaît la troisième règle de l'ordre. Que se passe-t-il si le lecteur tente de supprimer un service qui n'existe pas ?

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

`403`, comme avec le service 1. Le point d'entrée a répondu à la question 4 avant d'arriver à la 5 ; il ne sait donc pas, et peu lui importe, si le service 99 existe. Pour un lecteur, **tout** `DELETE` est un `403`, quel que soit l'identifiant. C'est exactement ce que nous voulons : le `403` de ce point d'entrée parle du jeton et de la méthode, et ne laisse rien voir des données. Si l'ordre était inverse, l'existence avant la permission, le lecteur recevrait `403` pour les services qui existent et `404` pour ceux qui n'existent pas, et il aurait une carte complète de ce qui existe sans avoir pu supprimer quoi que ce soit. C'est la même fuite que l'encadré de sécurité de la section 2.5 décrit pour le `404`, par un autre chemin.

### 2.5 Cela existe-t-il, pour toi ? : le `404` qui dissimule

#### 2.5.1 Chaque service appartient à une équipe

À partir de cette leçon, chaque service appartient à une équipe. Les trois services de démarrage l'avaient déjà inscrit dans `almacen.ts` : `catalogo` et `pagos` appartiennent à l'équipe a, `nomina` à l'équipe b. La Leçon 1 l'ignorait ; désormais le `revisor` l'utilise à trois endroits. Lors du **listage**, chaque jeton ne voit que les services de son équipe :

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

`lectura-a` voit les services 1 et 2, et ne voit pas le 3. Lors de l'**enregistrement**, le nouveau service est rattaché à l'équipe de celui qui l'a créé. Et lorsqu'on **consulte, retire ou demande une vérification** d'un service, la question 5 n'est pas seulement « existe-t-il ? », mais **« existe-t-il pour toi ? »**.

#### 2.5.2 Le même `404` pour ce qui appartient à d'autres et pour ce qui n'existe pas

Que doit répondre le `revisor` lorsque `lectura-a` demande le service 3, qui existe mais appartient à l'équipe b ? Il y a deux réponses possibles, et toutes deux sont permises par la spécification. La première est `403` : « il existe, et ce n'est pas de ton ressort ». La seconde est `404` : « pour toi, il n'existe pas ». La RFC 9110 envisage les deux dans un seul paragraphe de la [section 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4) : un serveur d'origine qui souhaite **« dissimuler »** l'existence d'une ressource interdite **peut**, au lieu du `403`, répondre `404`. Et la définition du `404`, que tu as vue en 2.2.1, le contenait déjà : il n'a pas trouvé la ressource **ou n'est pas disposé à révéler qu'elle existe**.

Le `revisor` choisit la seconde. Regarde les deux réponses côte à côte, d'abord le service 3, qui existe, puis le 99, qui n'existe pas :

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

Les deux sont identiques, au numéro du service près, qui est celui que tu as demandé. Le même code, les mêmes en-têtes, le même corps, la même longueur moins un octet pour le chiffre supplémentaire. Avec ces deux réponses, il n'y a aucun moyen de savoir lequel des deux services existe. Et le propriétaire, lui, le voit bien :

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

La décision tient dans une fonction de quatre lignes de `servicios.ts`, que tous les gestionnaires utilisent au lieu de chercher le service directement :

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

`visible` renvoie le service uniquement s'il appartient à l'équipe du jeton (ou si le jeton est celui d'un administrateur, dont l'équipe est `*`), et `undefined` dans tous les autres cas. Pour le gestionnaire, « n'existe pas » et « appartient à un autre » sont le même `undefined`, et c'est pourquoi ils produisent le même `404`, avec le même texte, écrit à un seul endroit : `noExiste`. **Le contenu de la réponse ne peut pas différer, car le code n'a aucun moyen de les distinguer.** C'est la manière sûre de l'écrire : non pas deux branches que l'on s'efforce de garder identiques, mais une seule branche. Ce que cela garantit, c'est l'égalité de la réponse (code, en-têtes et texte), pas celle du temps qu'elle met : dans un stockage en mémoire comme celui-ci, la différence ne peut pas se mesurer, mais avec une vraie base de données, chercher un enregistrement et vérifier à qui il appartient peut prendre un temps différent de celui nécessaire pour écarter un enregistrement inexistant, et celui qui mesure des microsecondes pourrait s'en apercevoir. C'est un canal auxiliaire (*side channel*, information qui fuit par autre chose que le contenu), qu'on surveille à part, par exemple en interrogeant par identifiant et équipe en une seule recherche.

> **Encadré de sécurité : le `404` qui dissimule et l'énumération de ressources**
>
> **Ce qu'est l'énumération.** C'est découvrir quelles ressources existent en essayant les identifiants l'un après l'autre et en comparant les réponses. Il n'est pas nécessaire de lire la moindre donnée : il suffit que l'API réponde **différemment** à ce qui existe et à ce qui n'existe pas. Si `/servicios/3` répond `403` et `/servicios/99` répond `404`, celui qui essaie de 1 à 1000 repart avec la liste des services qui existent, leur nombre et, si les identifiants sont consécutifs, combien sont créés par semaine. Le guide de tests de sécurité de l'OWASP décrit cette technique dans son test [WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md), et son exemple est exactement celui-ci : `/account1` répond `403`, `/account2` répond `404`, et celui qui teste conclut que le premier compte existe et que le second n'existe pas.
>
> **Pourquoi cela compte même si rien n'est lu.** Savoir ce qui existe est la première étape de presque toute attaque : avec la liste, on cherche les ressources qui en valent la peine, on essaie des identifiants volés uniquement là où il y a quelque chose, et on découvre des noms internes qui n'auraient pas dû sortir. Et la différence n'a pas besoin d'être dans le code : un corps différent (« n'existe pas » face à « appartient à une autre équipe »), une longueur différente ou un en-tête en trop suffisent.
>
> **La défense du `revisor`.** Ce qui appartient à d'autres et ce qui n'existe pas répondent de façon **identique** : le même code, le même corps, issus de la même fonction. La RFC 9110 le permet expressément (section 15.5.4), et c'est ce que font des API qui opèrent à grande échelle : la [documentation de l'API de GitHub](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) explique qu'elle répond `404` et non `403` à une ressource privée, pour ne pas confirmer qu'elle existe. Et l'ordre du point d'entrée ferme les deux autres chemins : un inconnu reçoit `401` pour tous les identifiants (question 3), et un lecteur qui tente d'écrire reçoit `403` pour tous (question 4), qu'ils existent ou non.
>
> **Ce que le `404` ne fait pas.** Dissimuler l'existence n'est pas la même chose que protéger la ressource. Ce qui empêche l'équipe a de lire le service de l'équipe b, ce n'est pas le `404`, c'est le fait que `visible` compare l'équipe **à chaque accès**. Oublier cette comparaison dans un gestionnaire est l'erreur numéro un de la liste des risques des API de l'OWASP, [API1:2023, *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization), et la défense qu'elle propose est justement celle-là : vérifier, dans chaque fonction qui reçoit un identifiant du client, que celui qui demande peut faire cela avec cet enregistrement. Le même guide suggère en outre d'utiliser des identifiants aléatoires, difficiles à deviner, plutôt que consécutifs ; le `revisor` utilise des identifiants consécutifs pour que le cours reste lisible, et c'est pourquoi le `404` uniforme est ce qui le protège. Avec des identifiants aléatoires, l'énumération coûterait beaucoup plus cher, mais la réponse uniforme resterait nécessaire.
>
> **Quand on l'écrit comme une politique.** Dissimuler a un coût : le propriétaire légitime qui se trompe de jeton reçoit « n'existe pas » et peut perdre un moment à chercher une erreur d'adresse. C'est pourquoi la décision s'écrit et s'applique de la même façon dans toute l'API : dans le `revisor`, **toute ressource d'une autre équipe répond `404`, sur toute route et pour toute méthode**. Ce qui n'est pas admissible, c'est de dissimuler sur certaines routes et pas sur d'autres ; la première route qui répond différemment défait ce que les autres dissimulent.

#### 2.5.3 Le vérifier avec un programme

Une affirmation de sécurité se vérifie en attaquant, pas en lisant le code. Ce programme fait ce que ferait quelqu'un qui veut énumérer : il parcourt les identifiants de 1 à 6 avec un jeton, note ce que le `revisor` répond pour chacun et en tire ses conclusions. Enregistre-le sous `~/curso-http/fig02_02.ts` :

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

Le programme ne sait rien de l'intérieur du `revisor` : il ne voit que ce que verrait n'importe qui depuis l'extérieur. Pour chaque identifiant, il garde une **empreinte** de la réponse : le code et, s'il s'agit d'une erreur, le corps dont on a effacé le numéro demandé, afin que « no existe el servicio 3 » et « no existe el servicio 4 » comptent comme la même réponse. À la fin, il regroupe les identifiants par empreinte. Si ce qui appartient à d'autres et ce qui n'existe pas reçoivent la même réponse, il doit y avoir exactement deux groupes : les tiens, avec des données, et tous les autres. Un troisième groupe signifie que quelque chose distingue ce qui appartient à d'autres de ce qui n'existe pas, et le programme le signale. C'est le même raisonnement que ferait une personne avec un tableur, sauf qu'il prend une seconde. Comparer le corps, et pas seulement le code, est important : un véritable énumérateur regarde tout ce qui change, et un `404` avec deux textes différents trahit tout autant qu'un `403` face à un `404`.

Avec le laboratoire et le `revisor` de 2.7 en cours d'exécution, fraîchement démarrés :

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

Deux groupes. `lectura-a` sait que le 1 et le 2 existent, puisqu'ils sont à lui, et ne sait rien du 3 : pour lui, le 3 est aussi inexistant que le 6, qui n'existe vraiment pas. Dans « L'erreur que tu vas voir », tu vas modifier quatre lignes de `servicios.ts` et voir apparaître le troisième groupe.

#### 2.5.4 Les vérifications appartiennent aussi à une équipe

La question « existe-t-il pour toi ? » ne se limite pas aux services. Une vérification appartient au service qu'elle a vérifié, et donc à son équipe. `consultarRevision` répond `404` si la vérification n'existe pas **ou** si son service n'est pas visible pour le jeton :

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

C'est le même schéma avec une autre ressource, et il vaut la peine de le remarquer car c'est l'endroit où on l'oublie le plus : on protège soigneusement la ressource principale, et la ressource « enfant », à laquelle on accède par un autre identifiant, reste ouverte. Si `consultarRevision` cherchait la vérification sans demander à qui appartient son service, n'importe qui de l'équipe b pourrait lire les résultats des vérifications de l'équipe a en parcourant `/revisiones/1`, `/revisiones/2`…, même sans pouvoir voir les services.

### 2.6 Le corps : `415` et `400`

#### 2.6.1 Le format avant la lecture

Les deux dernières questions ne se posent que lorsque la requête porte un corps, et dans le `revisor`, c'est l'enregistrement, `POST /servicios`. D'abord, **arrive-t-il dans un format que j'accepte ?** Le client indique le format de son corps avec l'en-tête `Content-Type`, et le `revisor` n'accepte que `application/json`. Ensuite, **puis-je le lire ?** : même s'il dit être du JSON, il peut ne pas l'être.

Les deux questions sont traitées par la fonction `leerJson` de `servicios.ts`, qui est nouvelle :

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

La première partie compare le `Content-Type` avec `application/json`. Avant de comparer, elle garde ce qui précède le premier `;` et le passe en minuscules, car `application/json; charset=utf-8` et `Application/JSON` sont le même type : la [section 8.3.1 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1) dit que le type et le sous-type ne sont pas sensibles à la casse, et que ce qui suit le `;` sont des paramètres. Si le type n'est pas JSON, elle répond `415`. La seconde partie tente de lire le JSON, et exige en outre que ce soit un **objet** : un nombre, un texte ou une liste sont du JSON valide, mais ne sont pas un service. Si l'une des deux choses échoue, elle répond `400`, avec le même texte pour les deux : « el cuerpo no es un objeto JSON » couvre aussi bien un JSON tronqué qu'un JSON qui se lit bien mais n'est pas un objet. Avant de lire, en outre, `leerCuerpo` vérifie la taille, et si le corps est trop grand, `leerJson` répond `413` ; la section 2.6.4 l'explique.

#### 2.6.2 `415` : le format n'est pas celui que j'accepte

`curl -d` est la façon la plus courte d'envoyer un corps, et elle comporte un piège qui mérite d'être vu une fois. Si tu ne lui indiques pas le type, elle envoie `application/x-www-form-urlencoded`, le format des formulaires web, comme l'indique la [documentation de l'option `-d`](https://curl.se/docs/manpage.html#-d) :

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

`415 Unsupported Media Type`. La [section 15.5.16 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) le définit : le serveur refuse de traiter la requête parce que le contenu arrive dans un format que cette méthode n'admet pas sur cette ressource. Et elle ajoute quel en-tête aide le client : si le problème est le type de média, l'en-tête `Accept` **dans la réponse** peut indiquer quels types auraient été acceptés. Ici, la spécification dit **peut**, et non **doit** : contrairement à `Allow` dans le `405` et à `WWW-Authenticate` dans le `401`, `Accept` dans un `415` est recommandé, pas obligatoire. Le `revisor` l'envoie toujours, car il transforme l'erreur en instruction : « je n'accepte pas les formulaires ; j'accepte `application/json` ». Et une question raisonnable : que devient le corps que le `revisor` n'a pas lu ? Cela a été mesuré : un `POST` de 8 Mio avec `Content-Type: text/plain` a reçu le `415`, et la requête suivante sur la même connexion a reçu son `200` normal ; Node écarte de lui-même le corps que personne n'a lu quand la réponse se termine, si bien qu'ici `Connection: close` n'est pas nécessaire, contrairement au `413`, où l'objectif est de cesser de recevoir.

`Accept` dans une réponse est moins courant que dans une requête, et il vaut mieux ne pas les confondre. Dans une requête, `Accept` indique quels formats le client veut **recevoir**, et si le serveur ne peut en produire aucun, le code est un autre, `406 Not Acceptable`, qui n'est pas un protagoniste de ce cours. Dans la réponse à un `415`, `Accept` indique quels formats le serveur accepte de **recevoir**. Même nom, sens contraire.

Avec un type explicite qui n'est pas non plus du JSON, le résultat est le même, et le corps indique lequel est arrivé :

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

#### 2.6.3 `400` : il dit être du JSON et ne peut pas être lu

Cette fois le type est correct, mais le JSON est coupé au milieu :

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

`400 Bad Request`. C'est le code le plus général de la famille, et la [section 15.5.1 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.1) le définit avec cette amplitude : le serveur ne peut pas ou ne veut pas traiter la requête à cause de quelque chose qu'il perçoit comme une erreur du client, et donne comme exemples une syntaxe malformée ou un message mal délimité. Un JSON tronqué est une syntaxe malformée.

Pourquoi `415` passe-t-il avant `400`, et pas l'inverse ? En vertu de la première règle de l'ordre : tu ne peux pas dire si quelque chose peut être lu sans savoir dans quel format il est. Si le `revisor` tentait de lire comme du JSON un corps qui se dit formulaire, l'erreur qu'il verrait serait « ce n'est pas du JSON », et il répondrait `400` ; le client conclurait que son JSON est mal formé, alors que c'est l'en-tête qui est en cause. L'ordre fait que chaque échec a son code.

#### 2.6.4 `413` : le corps est trop volumineux

Le format n'est pas la seule chose que l'on peut refuser avant de comprendre un corps : la **taille** aussi. Pour lire un corps, le `revisor` le garde en mémoire, et un serveur qui garde en mémoire tout ce qu'on lui envoie remet à n'importe qui la clé pour la lui remplir. D'abord le rouge. Dans une copie du `revisor` (la version complète se trouve dans `defectos/sin-tope/respuestas.ts`), remplace le plafond de `respuestas.ts` par l'infini :

```ts
export const TOPE_CUERPO = Infinity;
```

Démarre le laboratoire et la copie, puis, dans un autre terminal, enregistre le numéro de processus du `revisor` dans une variable : `REV=$(pgrep -f 'node servidor.ts')`. Avec lui, `ps -o rss= -p $REV` indique la mémoire que le processus occupe, en kilo-octets. Mesure-la, envoie un enregistrement de 50 Mo de lettres `a` et mesure à nouveau :

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

La mémoire du processus est passée d'environ 93 Mo à environ 224 Mo pour **une** seule requête, et le `revisor` l'a lue entièrement pour finir par répondre `400`, car 50 Mo de lettres `a` ne sont pas du JSON. Avec dix requêtes de ce type à la fois, ou avec un corps de quelques gigaoctets, le processus manque de mémoire et plante pour tout le monde. Et remarque qui peut le faire : n'importe qui possédant un jeton d'écriture, car l'ordre du point d'entrée écarte bien les inconnus (le corps n'est lu qu'à la question 7). C'est une défense, mais elle ne suffit pas : un jeton d'écriture peut aussi être volé ou mal utilisé.

Maintenant le vert, avec le `revisor` de la leçon. La même mesure :

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

`413`, en environ trois millièmes de seconde, et la mémoire **n'a pas augmenté** : elle est passée d'environ 92 Mo à environ 84 Mo, parce que le ramasse-miettes (*garbage collector*) de Node en a profité pour rendre de la mémoire (sur ton exécution, les chiffres seront autres ; ce qui compte, c'est qu'ils ne montent pas). Le `revisor` n'a pas gardé les 50 Mo : il a répondu le `413` dès qu'il a vu que le plafond était dépassé, et ce qui continuait d'arriver, il l'a lu et jeté sans le garder. C'est ce que fait `leerCuerpo` dans `respuestas.ts` (c'est le même qu'à la Leçon 1, qui l'utilisait déjà comme filet de sécurité) :

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

Il a deux défenses, car il existe deux manières d'envoyer un corps. Si la requête porte `Content-Length` et annonce déjà plus de 16 Kio (16 384 octets), il refuse **sans rien garder**. Si elle ne le porte pas, parce que le corps arrive **par morceaux** (*chunked*, comme tu l'as vu à la Leçon 0), ou si le nombre ment, il compte les octets au fur et à mesure de leur arrivée et cesse de les garder dès qu'ils dépassent le plafond. Dans les deux cas, il ne garde jamais plus de 16 Kio, et il répond le `413` immédiatement avec une **fermeture en plusieurs étapes** : il ferme seulement l'écriture (semi-fermeture), continue de lire et de jeter ce que le client parvient à envoyer, et détruit la connexion au bout de 2 secondes si le client ne l'a pas fermée. S'il répondait puis fermait brutalement alors que le client envoie encore, le système d'exploitation répondrait par un RST qui peut effacer le `413` avant que le client ne le lise (RFC 9112, section 9.6). Pourquoi 16 Kio ? Parce qu'un service, c'est un nom de 40 caractères au plus, une URL et un nombre : cela tient très largement. Le plafond se choisit d'après ce que la route a besoin de recevoir, pas d'après ce que le serveur supporte.

Et celui qui lit le corps, `leerJson`, convertit ce refus en réponse. L'exécution complète de 2.7 apporte les trois essais du plafond :

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

`413 Content Too Large`, que la [section 15.5.14 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.14) définit ainsi : le serveur refuse de traiter la requête parce que son contenu est plus grand que ce qu'il veut ou peut traiter, et il **peut** fermer la connexion. Le `revisor` le fait avec `Connection: close` : Node ferme la connexion une fois la réponse terminée, et ce que le client continuait d'envoyer a déjà été vidé sans être gardé. Il ne détruit pas la requête avant, car il ne pourrait alors rien répondre. Le deuxième essai envoie le corps par morceaux (`-T -`), sans `Content-Length`, et reçoit aussi `413` : c'est le comptage pendant la lecture qui a fonctionné. Le troisième envoie **exactement** 16 384 octets, tout juste au plafond : ils sont lus en entier et, comme ce n'est pas du JSON, la réponse est `400`. Et la requête finale indique que le `revisor` est toujours en vie.

Le `413` et le `415` sont cousins : tous deux disent que le corps ne peut pas être accepté **tel qu'il arrive**, l'un à cause du format et l'autre à cause de la taille, et tous deux se décident sans comprendre le contenu. C'est pourquoi ils vont ensemble dans la question du corps, avant le `400`, qui, lui, a besoin de le lire. Un détail de nom, que tu as déjà vu à la Leçon 0 : Node appelle ce code « Payload Too Large », l'ancien nom ; la RFC 9110 l'a changé en « Content Too Large », et `respuestas.ts` utilise celui du registre.

#### 2.6.5 Ce qui est encore `400`

Dans cette leçon, il existe quatre autres situations qui répondent aussi `400`, et il vaut mieux les voir ensemble car la Leçon 3 va en déplacer certaines vers un autre code.

**Du JSON qui n'est pas un objet.** `null`, `7`, `"pagos"` et `[]` sont du JSON valide, mais aucun n'est un service. `leerJson` le vérifie avant de laisser passer le corps, et répond `400 el cuerpo no es un objeto JSON`. Ce n'est pas un détail : si `darDeAlta` recevait `null` et lisait `datos.nombre`, JavaScript lèverait une erreur, et une erreur que personne n'intercepte dans un serveur Node met fin au processus. L'exercice 4 le parcourt.

**Des champs manquants.** Si le corps est un objet JSON, mais ne contient pas `nombre` ou `url` sous forme de textes, le `revisor` répond `400 faltan nombre y url`.

**Une limite hors plage.** `limite_ms` est facultatif et vaut 2000 par défaut, mais s'il est présent, il doit être un entier compris entre 100 et 10000 :

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

La borne n'est pas un caprice. Le `revisor` attend la réponse de chaque service au plus `limite_ms` millisecondes, et sans borne, une limite de plusieurs heures le laisserait attendre un service qui ne répond pas, avec la connexion occupée pendant tout ce temps ; et une limite de zéro le déclarerait en panne sans l'avoir consulté. Un champ numérique que contrôle le client et que le serveur utilise pour décider de la quantité de travail qu'il fournit est un champ que l'on borne toujours. La validation a lieu **avant** la vérification de la destination, car vérifier la destination résout un nom par DNS, et il n'y a aucune raison de dépenser cette requête pour un enregistrement qui sera de toute façon rejeté.

**Une destination interdite.** La défense contre le SSRF de la Leçon 1 reste en place : un enregistrement qui pointe vers l'adresse des métadonnées du cloud ou vers un nom qui résout en `127.0.0.1` est rejeté avec `400 destino prohibido: …`. La règle est celle de la Leçon 1, et elle couvre bien plus que les réseaux privés. En IPv4, c'est une **liste noire** copiée du registre des adresses à usage spécial de l'IANA : en plus de `10/8`, `172.16/12` et `192.168/16`, elle rejette l'espace partagé des fournisseurs (`100.64.0.0/10`, où un cloud publie ses métadonnées), les réseaux de documentation et de tests de performance, le *multicast* et le bloc réservé `240.0.0.0/4`. En IPv6, c'est une **liste blanche** : seul l'unicast global, `2000::/3`, est accepté, moins quelques blocs spéciaux qui y sont inclus (documentation, Teredo). Et avant d'appliquer l'une ou l'autre, elle extrait l'IPv4 que certaines adresses IPv6 cachent dans leurs bits (`64:ff9b::…`, `2002:…`, `::…`) et la vérifie comme une IPv4 : `[2002:a9fe:a9fe::]` est `169.254.169.254` à l'intérieur. L'exécution complète de 2.7 le vérifie avec douze enregistrements, un par bloc, et les douze sont rejetés :

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

Les trois derniers cas ont un point commun : le corps **a pu être lu**, et ce qui échoue, c'est que ce qui a été lu ne peut pas être satisfait. La Leçon 3 adopte une politique écrite pour cette différence : `400` pour ce qui ne peut pas être lu et `422` pour ce qui se lit mais ne peut pas être satisfait. Pour l'instant, le `422` n'existe pas dans le `revisor`, et tout ce qui n'est pas utilisable dans le corps est `400`. Que le code soit le même ne signifie pas que le corps doive l'être : le texte de chaque `400` dit ce qui a échoué, et c'est la différence entre un `400` utile et celui de la scène d'ouverture.

### 2.7 Le `revisor` complet

#### 2.7.1 Les fichiers qui changent

Le `revisor` de cette leçon vit dans le dossier `~/curso-http/fig02_01/`. Si tu as le dossier de la Leçon 1, copie-le sous ce nom et modifie trois fichiers : un nouveau, `autenticacion.ts` (section 2.3.2), et deux modifiés, `rutas.ts` et `servicios.ts`, donnés en entier ici :

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

Dans `servicios.ts`, en plus de ce que tu as déjà vu (`visible`, `noExiste`, `leerJson` et la borne de `limite_ms`), le `Contexto` a changé : il porte désormais le jeton que le point d'entrée a vérifié, et chaque gestionnaire le reçoit. Aucun gestionnaire ne relit l'en-tête `Authorization` ; le point d'entrée l'a fait une fois et lui a transmis le résultat. Ainsi, il n'y a qu'un seul endroit où l'on décide qui tu es.

#### 2.7.2 Les fichiers qui ne changent pas

Les autres fichiers sont ceux de la Leçon 1, sans la moindre modification. Ils sont donnés en entier pour que le `revisor` puisse être assemblé à partir de cette leçon :

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

#### 2.7.3 L'exécution complète

Ouvre deux terminaux dans `~/curso-http/fig02_01/`. Dans le premier, le laboratoire, qui est le banc d'essai de la Leçon 0 sur le port 18081 ; dans le second, le `revisor` :

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Dans un troisième terminal, voici les requêtes de la leçon, dans l'ordre, avec ce qu'elles ont reçu en réponse. Les principales des sections précédentes sont de nouveau ici, réunies, pour que tu les compares d'une traite avec les tiennes :

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

Dix-sept requêtes et huit codes différents : `[401 401 401 200 404 404 200 403 405 404 415 415 400 201 400 400 400]`. Chaque erreur est le « non » de l'une des sept questions, et chaque succès, une requête qui les a toutes franchies.

#### 2.7.4 L'étiquette fonctionne toujours derrière le point d'entrée

Le point d'entrée n'a rien changé de ce qu'a construit la Leçon 1 : les requêtes conditionnelles avec `If-None-Match` répondent de la même façon, désormais avec un jeton. L'`ETag` du `revisor` comporte trois parties, `"id-version-démarrage"` : la dernière est constituée de huit chiffres aléatoires que le `revisor` tire au sort à chaque démarrage, pour qu'une étiquette d'avant un redémarrage ne coïncide pas, en pratique, avec une d'après (ce sont 32 bits aléatoires : une probabilité de une sur 4 295 millions pour chaque démarrage précédent, pas une garantie mathématique ; la Leçon 1 explique pourquoi : la [RFC 9110, section 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), ne permet pas de réutiliser une étiquette pour une autre représentation). C'est pourquoi, pour répéter ces requêtes, il faut d'abord lire l'étiquette en vigueur. L'exécution l'a enregistrée dans une variable du terminal, `ETAG`, avec l'option `-w '%header{etag}'` de `curl`, qui n'affiche que cet en-tête :

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

Les trois premières sont des `304` : `If-None-Match` accepte l'étiquette faible (`W/`), une liste et `*`, comme l'a enseigné la Leçon 1. La quatrième, une liste sans l'étiquette en vigueur, reçoit le service complet. Et le test du redémarrage : on a lu l'étiquette du service 3, arrêté le `revisor` puis on l'a redémarré (dans ton terminal, avec `Ctrl`+`C` et `node servidor.ts`), et on a demandé le service 3 avec l'étiquette d'avant :

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

`200`, avec une nouvelle étiquette : le service 3 a le même id et la même version qu'avant le redémarrage, mais les huit chiffres de la fin ont changé, et l'ancienne copie du client n'est plus tenue pour bonne.

Le terminal du `revisor` a noté chaque requête reçue pendant l'exécution, dans cet ordre : les dix-sept de 2.7.3 ; celle de 2.2.3 et celle de 2.4.2 ; celles de l'étiquette ; celle de 2.3.1 en minuscules et celle de `Basic` (la méthode `constructor` de 2.3.3 n'apparaît pas, car Node l'a rejetée avant) ; les trois enregistrements de corps volumineux de 2.6.4 et la consultation qui vérifie que le `revisor` est toujours en vie ; un enregistrement avec `-d 'null'` suivi d'une consultation, pour vérifier que le `revisor` est toujours en vie (l'exercice 4 le répète) ; les douze enregistrements de plages de 2.6.5, et les deux du redémarrage, l'une avant et l'autre après. Remarque le second `revisor en …`, celui de la seconde vie du processus :

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

## L'erreur que tu vas voir

### Le `403` qui trahit

Voici le code que presque tout le monde écrit la première fois qu'il sépare les services par équipe, car il se lit très naturellement : je cherche le service ; s'il n'existe pas, `404` ; s'il existe et n'est pas à toi, `403`. Pour le provoquer, copie le dossier `fig02_01/` sous le nom `rota/` et remplace le début de `consultar` dans `rota/servicios.ts` par ceci (c'est un fragment ; la version complète se trouve dans `defectos/403/servicios.ts`) :

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

Démarre le laboratoire et le `revisor` depuis `rota/` et répète la paire de 2.5.2 :

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

Chaque réponse, prise séparément, semble impeccable : le `403` est un code permis pour une ressource interdite, il explique dans le corps pourquoi il a refusé, et le `404` dit la vérité. Le problème est dans la **paire**. Fais-lui passer l'énumérateur :

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

Trois groupes, et le programme le signale. Le 3 a reçu une réponse qu'aucun identifiant inexistant ne reçoit, si bien que `lectura-a` sait maintenant que le service 3 existe, et qu'il appartient à une autre équipe, sans avoir vu une seule de ses données. Avec des identifiants de 1 à 100 000, il saurait combien de services possède l'entreprise et lesquels appartiennent à d'autres équipes. C'est l'énumération de l'encadré de 2.5, produite par quatre lignes que personne n'a écrites avec de mauvaises intentions.

La correction consiste à revenir à `visible` : une seule fonction qui renvoie `undefined` pour ce qui appartient à d'autres et pour ce qui n'existe pas, et une seule branche qui répond. Il ne suffit pas de changer le `403` en `404` en gardant les deux branches : le jour où quelqu'un modifie le texte de l'une et pas celui de l'autre, la différence revient, cette fois dans le corps. Arrête les programmes de `rota/` quand tu as terminé.

### Le jeton que personne n'a émis

La seconde erreur est celle de la section 2.3.3. Copie de nouveau `fig02_01/` sous le nom `rota2/` et remplace dans `rota2/autenticacion.ts` la table et la recherche par la forme avec un objet (la version complète se trouve dans `defectos/prototipo/autenticacion.ts`) :

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

TypeScript ne se plaint d'aucune des deux modifications : pour lui, `CREDENCIALES[token]` est une `Credencial`. Démarre le laboratoire et le `revisor` depuis `rota2/` et essaie avec deux mots que personne n'a enregistrés :

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

`200 OK`. Le point d'entrée a laissé passer `constructor` et `toString` comme s'il s'agissait de jetons. `CREDENCIALES["constructor"]` a trouvé la fonction `Object`, dont tout objet hérite ; `CREDENCIALES["toString"]`, la fonction du même nom. Aucune n'est `undefined`, alors `identificar` a répondu « valide ». Que la liste soit vide est un pur hasard : ces « jetons » n'ont pas d'`equipo`, et le filtre de `listar` ne trouve aucun service dont l'équipe soit `undefined`. Regarde ce qui se passe quand on tente d'écrire et quand on consulte :

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

Le `403` dit « tu credencial solo puede leer » : le point d'entrée croit savoir qui tu es, alors que personne ne se tient derrière ; il ne lui a refusé l'écriture que parce que la fonction `Object` n'a pas de `rol`. Et à la consultation, `404` : son `equipo` est `undefined`, si bien que `visible` ne lui laisse même pas voir le service 1, qui appartient à l'équipe a. Cette fois rien ne s'est cassé, par chance. Mais la troisième question du point d'entrée a déjà répondu « oui » à quelqu'un qui n'existe pas, et toute règle qui demanderait seulement « s'est-il identifié ? » le laisserait passer : un journal d'audit enregistrerait un utilisateur `undefined`, une limite de requêtes par jeton le traiterait comme un jeton de plus, et une route qui exige seulement d'être identifié lui répondrait. Avec la `Map` de `fig02_01/`, les mêmes requêtes donnent `401` avec `error="invalid_token"`, comme le montre la troisième requête de l'exécution complète de 2.7. Arrête les programmes de `rota2/` quand tu as terminé.

## Ce qui se fait de travers

**Un `401` sans `WWW-Authenticate`.** C'est l'erreur la plus courante avec ce code, et la spécification l'interdit par un **doit**. Sans le challenge, le client sait qu'il doit s'identifier, mais pas comment ; certains clients HTTP, de plus, ne tentent pas de s'authentifier s'ils ne voient pas le challenge.

**Un `405` sans `Allow`, ou avec un `Allow` qui ment.** Le premier laisse le client essayer des méthodes à l'aveugle. Le second est pire : si `Allow` annonce `PUT` et que le `PUT` répond `405`, le client ne peut plus se fier à rien de ce que dit l'API. Dans le `revisor`, `Allow` est calculé à partir de la même table que celle qui décide quelle méthode est traitée, il ne peut donc pas diverger ; l'écrire manuellement dans chaque réponse est le moyen de le faire diverger.

**`404` pour une méthode non admise.** C'est ce que faisait le `revisor` de la Leçon 1, et cela envoie le client chercher une adresse qui était correcte.

**`403` pour celui qui ne s'est pas identifié.** Si je ne sais pas qui tu es, je ne peux pas dire que ce n'est pas de ton ressort : le code est `401`, avec son challenge. Un `403` adressé à un client sans jeton lui dit « n'insiste pas », alors que ce qu'il devait faire, c'était s'identifier.

**`401` pour celui qui s'est correctement identifié, mais n'a pas la permission.** L'erreur inverse. Le client réessaie avec le même jeton, ou en demande un nouveau, et reçoit la même chose indéfiniment.

**Valider le corps avant le jeton.** Cela apprend à un inconnu, à force de `400`, ce qu'attend ton API et quelles valeurs elle admet, et cela dépense du travail du serveur pour des requêtes qui allaient de toute façon être rejetées.

**Répondre différemment à ce qui appartient à d'autres et à ce qui n'existe pas.** Un `403` face à un `404`, ou un `404` avec « n'existe pas » face à un `404` avec « appartient à une autre équipe », ou le même texte avec une longueur différente. N'importe laquelle des trois différences suffit pour énumérer. L'encadré de 2.5 en explique le coût.

**`400` pour tout.** Un client qui reçoit le même `400` quand le format est mauvais, quand le JSON est tronqué ou quand il manque un champ ne peut pas décider par le code quoi corriger ; il ne lui reste qu'à interpréter le texte, et un programme ne doit pas décider à partir de phrases. Chaque question du point d'entrée a son code pour que le client sache laquelle a échoué.

**Lire le corps sans plafond.** N'importe qui atteignant la route peut remplir la mémoire du serveur avec un seul `POST`, et la section 2.6.4 a mesuré de combien : environ 150 Mo par requête. Le plafond se fixe d'après ce dont la route a besoin et se vérifie **pendant** la lecture, pas après.

**Répéter le jeton dans le message d'erreur.** Le client sait déjà quel jeton il a envoyé ; les journaux, caches et captures d'écran par lesquels passe la réponse ne doivent pas le savoir.

**Laisser une exception du lecteur JSON se transformer en `500`.** `JSON.parse` lève une exception face à un JSON malformé. Si personne ne l'intercepte, le serveur répond `500` (ou, avec Node, tombe en panne) : il rejette sur le serveur la faute d'une erreur du client. `leerJson` intercepte l'exception et la convertit en ce qu'elle est, un `400`.

## Exercices

Les quatre se corrigent tout seuls : chacun se termine par une exécution qui te dit si tu as vu juste. Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** d'exécuter quoi que ce soit. Pour tous, tu as besoin du laboratoire et du `revisor` de 2.7 en cours d'exécution, fraîchement démarrés (le `revisor` garde tout en mémoire, et un enregistrement ou un retrait antérieur modifie les réponses).

### Exercice 1 — À quelle question s'arrête-t-elle ?

Sans rien exécuter, prédis le code de chacune de ces sept requêtes, et à quelle question du point d'entrée chacune s'arrête :

```bash
curl -i -X PATCH http://127.0.0.1:18080/servicios/1
curl -i -X DELETE http://127.0.0.1:18080/servicios/99
curl -i -X DELETE http://127.0.0.1:18080/servicios/99 -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: text/plain' -d 'catalogo'
curl -i http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-b'
curl -i -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/nada
```

Ensuite, exécute-les et compare. Si tu t'es trompé sur l'une d'elles, l'indice est dans l'ordre : cherche la première question dont la réponse est « non ».

### Exercice 2 — Ce que dit `Allow`

Prédis l'en-tête `Allow` de ces trois réponses, et si ce sont vraiment des `405` :

```bash
curl -i -X DELETE http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
curl -I http://127.0.0.1:18080/servicios
curl -i -X PUT http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a'
```

`-I` envoie un `HEAD`, et `-X` change la méthode. Exécute les trois et compare.

### Exercice 3 — L'énumérateur avec d'autres jetons

Prédis ce qu'affiche `fig02_02.ts` avec `escritura-b`, avec `admin` et avec un jeton inventé, `nadie`. Dans lequel des trois cas le programme « découvre »-t-il le plus de services, et pourquoi n'est-ce pas une fuite ? Exécute les trois :

```bash
node fig02_02.ts escritura-b
node fig02_02.ts admin
node fig02_02.ts nadie
```

### Exercice 4 — Du JSON qui n'est pas un service

Prédis le code et le corps de chacun de ces cinq enregistrements. Tous portent un jeton d'écriture et se disent `application/json`, et tous échouent, mais pas au même endroit :

```bash
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d 'null'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '7'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '[]'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{}'
curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json; charset=utf-8' -d '{"nombre":"agenda","url":"http://127.0.0.1:18081/codigo/200","limite_ms":"rapido"}'
```

Observe le `Content-Type` du dernier : il porte un paramètre, `charset=utf-8`. `leerJson` l'accepte-t-il ? Exécute les cinq et compare. Pour chacun, dis laquelle des sept questions l'a arrêté, ou s'il a franchi les sept et qu'une règle de l'enregistrement l'a arrêté.

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

Dans l'ordre : `405` (question 2 : la route existe et n'admet pas `PATCH`, et elle s'est arrêtée avant de demander qui tu es) ; `401` (question 3 : la route et la méthode existent, le jeton manque, et le 99 n'a même pas été consulté) ; `403` (question 4 : un lecteur ne supprime pas, que le 99 existe ou non) ; `415` (question 6 : le rédacteur peut enregistrer, mais le corps n'est pas du JSON) ; `404` (question 5 : le service 1 appartient à l'équipe a, et pour `escritura-b` il n'existe pas) ; `403` (question 4 : demander une vérification, c'est écrire, et `lectura-a` ne fait que lire) ; `404` (question 1 : `/nada` ne figure pas dans la table, et aucun jeton n'a été nécessaire). Si tu t'es trompé sur la deuxième ou la troisième, relis 2.1.2 : ce sont les deux lignes où l'ordre du point d'entrée dissimule si le 99 existe.

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

La première est un `405` avec `Allow: GET, HEAD` : `/revisiones/1` ne peut qu'être consultée. La deuxième **n'est pas un `405`** : `HEAD` est admis là où `GET` l'est, et `/servicios` admet `GET`, si bien que le point d'entrée est passé à la question 3 et a répondu `401`, avec son challenge, et sans corps parce que c'était un `HEAD` (le `Content-Length: 20` indique la taille qu'aurait celui d'un `GET`, comme dans la Leçon 0). La troisième est un `405` avec `Allow: GET, HEAD, POST`, les méthodes de la collection. Remarque que les trois `Allow` sont issus de la même table de `rutas.ts`, sans qu'aucun ait été écrit manuellement.

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

`escritura-b` ne voit que le 3, et pour lui le 1 et le 2 sont aussi inexistants que le 6. `admin` « découvre » trois services, mais ce n'est pas une fuite : l'administrateur a l'équipe `*` et peut tous les voir, donc voir les trois relève de sa permission, pas d'une déduction. Et `nadie` n'apprend rien : les six identifiants reçoivent le même `401`, car le jeton est demandé avant l'existence. Dans les trois cas, il y a au plus deux groupes, et l'avertissement du programme n'apparaît pas.

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

Les cinq ont franchi les six premières questions : la route existe, elle admet `POST`, le jeton est valide et peut écrire, une collection n'a pas de ressource qui pourrait ne pas exister, et le type est JSON. Le dernier aussi, bien que son `Content-Type` porte `; charset=utf-8` : `leerJson` garde ce qui précède le `;`, comme nous l'avons vu en 2.6.1. Les trois premiers s'arrêtent à la question 7 : `null`, `7` et `[]` se lisent comme du JSON, mais ne sont pas un objet, et `leerJson` les rejette avec `el cuerpo no es un objeto JSON`. Les deux derniers sont bien des objets et franchissent les sept questions ; ce sont les règles de l'enregistrement qui les arrêtent : `{}` ne contient ni `nombre` ni `url`, et `"rapido"` n'est pas un entier compris entre 100 et 10000. Remarque que le texte de chaque `400` est différent : avec le même code, le corps dit quoi corriger. Et remarque ce qui ne s'est pas produit : aucun des cinq n'a fait planter le `revisor`, qui continue de répondre à la requête suivante.

## Comment savoir que tu as réussi

- [ ] Tu récites de mémoire les sept questions du point d'entrée dans l'ordre, et pour chacune, son code.
- [ ] `curl -i http://127.0.0.1:18080/servicios` sans jeton renvoie `401` avec `WWW-Authenticate: Bearer realm="revisor"`, et avec `Authorization: Bearer inventada` renvoie `401` avec `error="invalid_token"` dans le challenge.
- [ ] Avec `Authorization: Basic …`, la réponse est `401` avec le challenge **sans** `error`, et avec `bearer lectura-a`, en minuscules, c'est `200`.
- [ ] `curl -i -X PATCH` vers `/servicios/1` renvoie `405` avec `Allow: GET, HEAD, DELETE`, et `/servicioss` renvoie `404`.
- [ ] `curl -i -X DELETE` vers `/servicios/1` et vers `/servicios/99` avec `lectura-a` renvoient tous deux `403`, et tu expliques pourquoi le second n'est pas `404`.
- [ ] `lectura-a` demande `/servicios/3` et `/servicios/99`, et les deux réponses sont identiques au numéro près ; `escritura-b`, lui, voit le 3.
- [ ] `node fig02_02.ts lectura-a` conclut que seuls les services 1 et 2 existent.
- [ ] Un `POST` avec `curl -d` sans `Content-Type` renvoie `415` avec `Accept: application/json`, et un autre avec un JSON tronqué renvoie `400`.
- [ ] Un `POST` de 20 000 octets renvoie `413` avec `Connection: close`, avec `Content-Length` et par morceaux, et un de 16 384 octets renvoie `400`.
- [ ] Tu expliques pourquoi la table des jetons est une `Map` et non un objet, avec l'exécution de `Bearer constructor`.
- [ ] À la fin, aucun programme ne reste en écoute : `curl -i http://127.0.0.1:18080/` renvoie l'erreur 7.

## Résumé

Réponds sans consulter la leçon :

1. Quelles sont les sept questions du point d'entrée, dans l'ordre, et quel code répond chacune lorsque la réponse est « non » ?
2. Quel en-tête exige un `401` et lequel exige un `405` ? Quelle section de la RFC 9110 le dit ?
3. Quelle question départage `401` et `403` ?
4. Pourquoi le jeton passe-t-il avant l'existence ? Et pourquoi la permission liée au rôle passe-t-elle avant l'existence ?
5. Que permet la RFC 9110 de faire d'une ressource interdite dont on veut dissimuler l'existence ?
6. Qu'est-ce que l'énumération de ressources, et quels sont les trois chemins que ferme le `revisor` pour l'empêcher ?
7. Pourquoi `415` passe-t-il avant `400` ? Quel en-tête aide le client dans un `415`, et est-il obligatoire ?
8. Pourquoi `CREDENCIALES[token]` sur un objet JavaScript peut-il accepter un jeton que personne n'a enregistré ?
9. Qu'ont en commun le `413` et le `415` ? Pourquoi `leerCuerpo` a-t-il besoin de deux défenses pour la taille, et non d'une seule ?

## Sources

Toutes ont été consultées le 21 octobre 2026.

1. [RFC 9110, *HTTP Semantics*](https://www.rfc-editor.org/rfc/rfc9110.html), section 15.5.1 : le `400` et sa définition large, « quelque chose qui est perçu comme une erreur du client ».
2. [RFC 9110, section 15.5.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.2) : le `401` et l'en-tête `WWW-Authenticate` obligatoire, avec au moins un challenge ; et la [section 8.8.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.1), pourquoi l'`ETag` n'est pas réutilisé pour une autre représentation.
3. [RFC 9110, section 15.5.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.4) : le `403`, la règle de ne pas répéter avec les mêmes informations d'authentification, et le `404` permis pour « dissimuler » une ressource interdite.
4. [RFC 9110, section 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5) : le `404`, « n'a pas trouvé de représentation actuelle ou n'est pas disposé à révéler qu'elle existe ».
5. [RFC 9110, sections 15.5.6 et 10.2.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6) : le `405` et l'en-tête `Allow` qui y est obligatoire.
6. [RFC 9110, section 9.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.1) : la frontière entre `405` (méthode connue, non admise sur la ressource) et `501` (méthode que le serveur n'implémente pas).
7. [RFC 9110, sections 15.5.16 et 15.5.14](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) : le `415`, et `Accept` dans la réponse pour indiquer quels types auraient été acceptés ; le `413`, et le fait que le serveur peut fermer la connexion.
8. [RFC 9110, sections 11.1, 11.4 et 11.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1) : le nom du schéma d'authentification n'est pas sensible à la casse, la forme des informations d'authentification (`schéma` et un espace) et la forme du challenge dans `WWW-Authenticate`.
9. [RFC 9110, section 8.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1) : le type et le sous-type d'un `Content-Type` ne sont pas sensibles à la casse ; ce qui suit le `;` sont des paramètres.
10. [RFC 6750, *The OAuth 2.0 Authorization Framework: Bearer Token Usage*](https://www.rfc-editor.org/rfc/rfc6750.html), sections 3 et 3.1 : le schéma `Bearer`, le challenge avec `realm`, le code `invalid_token` et la règle de ne pas envoyer de code d'erreur lorsque la requête ne porte pas d'authentification ou utilise un schéma non admis.
11. [OWASP API Security Top 10, API1:2023 *Broken Object Level Authorization*](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization) : vérifier à chaque accès que celui qui demande peut utiliser cet enregistrement, et des identifiants difficiles à deviner.
12. [OWASP Web Security Testing Guide, WSTG-IDNT-04](https://github.com/OWASP/wstg/blob/master/document/4-Web_Application_Security_Testing/03-Identity_Management/04-Account_Enumeration_and_Guessable_User_Account.md) : l'énumération par les différences entre `403` et `404`, et les réponses génériques comme défense.
13. [Documentation de l'API REST de GitHub, *Troubleshooting*](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) : elle répond `404` et non `403` à une ressource privée, pour ne pas confirmer qu'elle existe.
14. [Manuel de `curl`](https://curl.se/docs/manpage.html), options `-d`, `-H`, `-X`, `-I` et `-w` : `-d` envoie `application/x-www-form-urlencoded` si aucun autre type n'est indiqué, et `-w '%header{etag}'` affiche un en-tête de la réponse.
15. [Node.js 24 : HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html) : `message.headers` avec les noms des en-têtes en minuscules, tels que les lisent `identificar` (`peticion.headers.authorization`) et `leerJson` (`peticion.headers["content-type"]`).

### Termes de cette leçon

| | |
|---|---|
| **authentification** | déterminer qui fait la requête ; en cas d'échec, `401` |
| **autorisation** | décider si celui qui fait la requête peut faire cela ; sinon, `403` |
| **`Bearer`** | schéma d'authentification de la RFC 6750 : celui qui porte le jeton est celui qu'il prétend être |
| **énumération de ressources** | découvrir quelles ressources existent en essayant des identifiants et en comparant les réponses |
| **le point d'entrée** | les questions qu'une requête franchit, dans l'ordre, avant d'atteindre son gestionnaire |
| **challenge** (*défi*) | la valeur de `WWW-Authenticate` : le schéma avec lequel il faut s'authentifier et ses paramètres |
| **rôle** | ce qu'un jeton peut faire : dans le `revisor`, lecteur, rédacteur ou admin |
| **plafond du corps** | la taille maximale qu'une route accepte de lire ; au-delà, `413` |
| **prototype** | l'objet dont un objet JavaScript hérite des propriétés, comme `constructor` ou `toString` |

---

**Précédent :** [Leçon 1 — Succès et redirections : 200, 201, 202, 204, 301, 308 et 304](01-exitos-redirecciones.md) · **Suivant :** [Leçon 3 — Le client s'est trompé (II) : 409, 410, 412, 422 et 428](03-errores-del-cliente-estado.md)

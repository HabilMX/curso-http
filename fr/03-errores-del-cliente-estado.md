# Leçon 3 — Le client s'est trompé (II) : 409, 410, 412, 422 et 428

Il est 17 h 40 un vendredi et Ana, de l'équipe des paiements, vient de déménager le service d'encaissement à sa nouvelle adresse. L'ancienne s'éteint à 18 h 00. Elle ouvre la fiche du service dans le `revisor`, change l'URL, enregistre et reçoit `200 OK`. Elle s'en va l'esprit tranquille. Ce qu'elle ignore, c'est que Beto, de la même équipe, a ouvert cette même fiche à 17 h 30 pour faire passer le délai maximal de 2 à 3 secondes, est parti chercher un café et est revenu à 17 h 45. Beto change la limite, enregistre et reçoit lui aussi `200 OK`. Mais ce que Beto a enregistré, c'est **sa copie complète**, celle de 17 h 30, qui contenait encore l'ancienne adresse. À 18 h 00, l'ancienne adresse s'éteint, le `revisor` l'interroge, reçoit une erreur de connexion et marque le service d'encaissement comme `CAIDO` toute la nuit. Le nouveau service fonctionne parfaitement ; personne ne le surveille. Et aucune des deux personnes n'a reçu d'erreur : toutes deux ont vu un `200`.

Cela s'appelle une **mise à jour perdue** (*lost update*), et cette leçon l'évite avec une étiquette et un en-tête. Au passage, elle met un nom sur les quatre autres façons dont une requête bien formée peut quand même ne pas être satisfaite.

**Durée :** 2 × 45 min (la coupure se situe entre les sections 3.4 et 3.5)

**Ce que tu construis :** la modification d'un service (`PUT /servicios/{id}`) qui n'écrase pas le changement d'une autre personne ; la validation qui sépare ce qui ne peut pas être lu de ce qui ne peut pas être satisfait ; la mémoire des services retirés ; et la version précédente de l'API, qui annonce son départ avant de partir

**Ce que tu apprends :** à distinguer un **conflit d'état** (`409`), une **règle métier** que les données ne respectent pas (`422`) et une **précondition** qui a échoué (`412`) ; ce qu'est la mise à jour perdue et comment `ETag` avec `If-Match` l'évite, y compris lorsque deux requêtes arrivent en même temps ; `412` face à `428` ; `410` face à `404` ; la politique écrite du cours pour `400` face à `422` ; et comment on annonce le retrait d'une version de l'API avec `Deprecation` et `Sunset` avant que n'arrive le `410`

**D'où tu viens.** De la [Leçon 2](02-errores-del-cliente-peticion.md), avec un `revisor` doté d'un point d'entrée : il sait qui lui parle, ce que peut faire chaque identifiant, quelles routes et quelles méthodes existent, et dans quel format il accepte le corps. Ce `revisor` ne permet pas encore de **modifier** un service : seulement de l'enregistrer, de le consulter, de le retirer et de le vérifier. Il répond `400` à tout ce qui ne lui convient pas dans le corps, que ce soit parce que celui-ci ne peut pas être lu ou parce qu'il se lit mais n'a aucun sens. Et lorsque tu retires un service, son identifiant reste en `404`, comme s'il n'avait jamais existé.

**Ce que cette leçon ne fait pas.** Elle n'enseigne pas `PATCH` : le `revisor` modifie un service entier avec `PUT`, et un `PATCH` répond toujours `405`. Elle n'enseigne pas l'en-tête `If-Unmodified-Since`, la sœur de `If-Match` qui compare des dates au lieu d'étiquettes ; le cours n'utilise que des étiquettes, parce que les dates HTTP ont une résolution d'une seconde et que deux modifications dans la même seconde seraient indiscernables. Et les corps d'erreur restent une ligne de texte ; la [Leçon 5](05-problem-details.md) les transforme en `application/problem+json`, et c'est là que la liste des échecs du `422` devient un tableau qu'un programme peut parcourir.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sous macOS avec Node 24.14.1 et curl 8.7.1, et aucune ne dépend d'une particularité de macOS. Dans ton exécution, la date de l'en-tête `Date` et **les huit chiffres finaux de chaque `ETag`** vont changer (`"1-1-c6e922ee"` dans l'exécution principale de la leçon) : le `revisor` les tire au sort à chaque démarrage, de sorte que les tiens seront différents et changeront chaque fois que tu le redémarreras. Lorsqu'une commande a besoin d'une étiquette, copie celle que tu as obtenue dans la réponse précédente, ou garde-la dans une variable comme le fait la leçon avec `ETAG=$(…)`. Le `revisor` garde tout en mémoire, de sorte que chaque réponse dépend de ce qu'ont fait les requêtes précédentes. C'est pourquoi les exécutions de la leçon sont regroupées en **séries**, et le texte indique où commence chacune : la série A est la principale, avec le `revisor` de `fig03_01/` tout juste démarré, et va de la section 3.2.3 à la fin de la 3.8 sans redémarrage ; les autres (le programme des deux éditeurs, chaque version défectueuse et les exercices) sont courtes et commencent chacune avec un `revisor` tout juste démarré. Pour obtenir la même chose que la leçon, redémarre le `revisor` là où commence chaque série, et ne le redémarre pas au milieu d'une série. Les programmes se trouvent dans [`programas/03-errores-del-cliente-estado/`](../programas/03-errores-del-cliente-estado), dans le dépôt du cours : le `revisor` dans `fig03_01/`, les deux éditeurs dans `fig03_02.ts`, le lecteur d'avis dans `fig03_03.ts`, les versions défectueuses de « L'erreur que tu vas voir » dans `defectos/`, et chaque exécution dans son fichier `.salida.txt`. Tous passent `tsc` en mode strict avec la même commande que la section 1.11 de la Leçon 1.

## À la fin, tu seras capable de

- Classer une requête qui échoue comme conflit d'état, règle métier ou précondition, et répondre `409`, `422` ou `412` selon la question qui la tranche.
- Provoquer une mise à jour perdue avec deux éditeurs et démontrer, par une exécution, qu'`If-Match` la transforme en `412`.
- Provoquer la même perte avec deux requêtes simultanées qui envoient bien `If-Match`, et expliquer pourquoi la version est comparée une seconde fois à l'instant même où l'on écrit, comme un `UPDATE … WHERE version = N`.
- Expliquer pourquoi `If-Match` se compare en comparaison forte, ce qui se passe avec une étiquette `W/`, avec une liste et avec `*`, et citer la section de la RFC 9110 qui l'exige.
- Distinguer `412` de `428` et dire ce que le client doit faire dans chaque cas.
- Répondre `410` à une ressource qui a été retirée volontairement et `404` à une qui n'a jamais existé, sans révéler à une autre équipe ce qui a existé.
- Annoncer le retrait d'une version de l'API avec `Deprecation`, `Sunset` et `Link`, et vérifier avec un programme que la date de `Sunset` n'est pas antérieure à celle de `Deprecation`.

## Le pourquoi avant le comment

Dans la Leçon 2, tous les échecs pouvaient se découvrir en regardant **la requête seule** : la route, la méthode, l'identifiant, le type du corps. S'ils étaient faux, ils l'étaient à tout moment et face à n'importe quel serveur. Les échecs de cette leçon sont différents : la requête est bien écrite, elle se lit en entier, et pourtant elle ne peut pas être satisfaite. Pour le savoir, le serveur doit regarder **autre chose que la requête** : l'état actuel de la ressource, les règles métier, ou ce que le client croyait au moment où il l'a écrite.

C'est pourquoi les cinq codes de cette leçon répondent à des questions qui n'existaient pas dans la Leçon 2 :

| Question | Si la réponse est « non »… | Code | Ce que doit faire celui qui a demandé |
|---|---|---|---|
| Les données ont-elles du sens, chacune prise isolément ? | elles ont été lues, mais une valeur est impossible | `422` | corriger ces valeurs |
| Sont-elles compatibles avec ce qui existe déjà ? | elles heurtent l'état actuel du serveur (par exemple, un autre service utilise déjà ce nom) | `409` | résoudre le heurt et renvoyer |
| La ressource est-elle comme le client le croyait ? | elle a changé depuis qu'il l'a lue | `412` | relire, refaire son changement, renvoyer |
| Le client a-t-il dit quelle version il croyait avoir ? | il ne l'a pas dit, et le serveur l'exige | `428` | lire, et envoyer l'étiquette |
| La ressource est-elle toujours là ? | elle a été retirée volontairement et ne reviendra pas | `410` | cesser de la demander et supprimer le lien |

Chaque ligne est, une fois de plus, une action différente pour celui qui reçoit l'erreur, et presque toujours cet interlocuteur est un programme. Un `422` dit « tes données sont fausses ; corrige-les ». Un `409` dit « tes données sont bonnes, mais elles heurtent quelque chose qui existe déjà ». Un `412` dit « tes données sont peut-être bonnes, mais tu les as écrites en pensant à une version qui n'existe plus ». Si le `revisor` répondait `400` aux trois, le programme de Beto n'aurait aucun moyen de savoir que ce qu'il devait faire était **relire**, ce qui est précisément la seule chose qui aurait sauvé le changement d'Ana.

La leçon comporte quatre parties :

1. **Trois questions que l'on confond** (3.1) : conflit d'état, règle métier et précondition.
2. **La mise à jour perdue** (3.2 à 3.4) : la provoquer au rouge, l'éviter au vert avec `ETag` et `If-Match` (`412`), fermer la concurrence entre deux requêtes simultanées (race condition) en comparant à l'instant même où l'on écrit, et exiger la condition (`428`).
3. **Conflit, règle et ressource disparue** (3.5 à 3.7) : `409`, la politique de `400` face à `422`, et `410` face à `404`.
4. **Versions de l'API et `revisor` complet** (3.8 et 3.9) : `Deprecation`, `Sunset` et le `410` annoncé ; les fichiers et l'exécution.

## Les concepts

### 3.1 Conflit d'état, règle métier et précondition

#### 3.1.1 Trois échecs qui semblent identiques

Imagine trois requêtes de l'équipe `a` que le `revisor` rejette. Toutes trois sont du JSON valide, toutes trois arrivent avec un identifiant d'écriture et toutes trois visent une route qui existe :

- Un enregistrement avec `{"nombre":"","url":"ftp://archivos","limite_ms":5}`.
- Un enregistrement avec `{"nombre":"pagos","url":"http://127.0.0.1:18081/codigo/200"}`, alors que l'équipe `a` possède déjà un service nommé `pagos`.
- Une modification du service 1 faite à partir d'une copie lue il y a dix minutes, alors que quelqu'un d'autre l'a déjà modifié.

Si tu demandes à un débutant ce qu'elles ont en commun, il répondra « ce sont des erreurs de validation », et il répondra `400` aux trois. Mais regarde ce que devrait faire celui qui les a envoyées pour que la suivante fonctionne :

- Dans la première, **corriger les données**. Peu importe combien de fois il la répète, ni ce qui se passe sur le serveur entre-temps : un nom vide ne sera jamais valide. L'échec est **à l'intérieur** de la requête.
- Dans la deuxième, **les données sont bonnes**. Un nom `pagos` est parfaitement valide ; le problème, c'est qu'il y en a déjà un autre. Si demain quelqu'un retire le service `pagos` de l'équipe a, cette même requête, sans changer un octet, fonctionnera. L'échec réside dans le **heurt** entre la requête et l'état actuel du serveur.
- Dans la troisième, il se peut que les données soient bonnes **et** qu'elles ne heurtent rien. Le problème est autre : celui qui l'a envoyée a écrit son changement sur une version du service qui n'existe plus. Si le serveur l'acceptait, il effacerait le changement d'une autre personne sans que personne s'en aperçoive. L'échec réside dans une **supposition** du client qui a cessé d'être vraie.

Ce sont trois échecs distincts, et HTTP a un code pour chacun :

| Échec | Où se trouve le problème | Code | Section |
|---|---|---|---|
| **Règle métier** : les données ne peuvent pas être satisfaites | à l'intérieur de la requête | `422 Unprocessable Content` | RFC 9110, 15.5.21 |
| **Conflit d'état** : les données heurtent ce qui existe déjà | entre la requête et l'état actuel | `409 Conflict` | RFC 9110, 15.5.10 |
| **Précondition** : le client supposait un état qui n'est plus | dans ce que le client croyait | `412 Precondition Failed` | RFC 9110, 15.5.13 |

#### 3.1.2 Ce que dit la spécification de chacun

Les définitions de la [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) sont courtes, et il vaut la peine de les lire attentivement parce que chacune apporte la question qui la tranche.

Le **`422`** ([section 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21)) dit que le serveur **comprend le type de contenu** (c'est pourquoi ce n'est pas un `415`), que **la syntaxe est correcte** (c'est pourquoi ce n'est pas un `400`), mais qu'il n'a pas pu traiter les instructions qu'elle contient. L'exemple de la spécification est un XML bien formé avec des instructions qui n'ont pas de sens. La question qui le tranche est : **ai-je pu le lire, mais ce qu'il dit est-il impossible ?**

Le **`409`** ([section 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10)) dit que la requête n'a pas pu être menée à terme à cause d'un **conflit avec l'état actuel** de la ressource, et qu'on l'emploie lorsque l'utilisateur **pourrait résoudre le conflit et renvoyer** la requête. Elle ajoute un **devrait** : le serveur devrait répondre avec assez d'informations pour que l'utilisateur reconnaisse l'origine du conflit. La question qui le tranche est : **est-ce que cela serait valide si le serveur était dans un autre état ?**

Le **`412`** ([section 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13)) dit qu'**une ou plusieurs conditions figurant dans les en-têtes** de la requête se sont révélées fausses lorsque le serveur les a évaluées, et qu'il existe pour que le client puisse empêcher l'application de la méthode si la ressource est dans un état inattendu. La question qui le tranche est : **le client a-t-il posé une condition, et n'a-t-elle pas été remplie ?**

Remarque la dernière phrase : le `412` n'existe que si **le client** a posé une condition. Le serveur n'invente pas de préconditions ; il les évalue. C'est la différence la plus fine de la leçon, et elle revient dans la section 3.5.

#### 3.1.3 Dans quel ordre on les pose

Le point d'entrée de la Leçon 2 comptait sept questions : route, méthode, identifiant, permission, existence, format et lecture. Cette leçon ajoute des questions entre elles et **après** elles, et leur ordre compte aussi. À partir de l'existence, un changement (`PUT`) demande ceci :

1. La ressource existe-t-elle, pour toi ? Si elle a été retirée et qu'elle était à toi, `410` ; sinon, `404`.
2. (Comme dans la Leçon 2) Le corps prétend-il être du JSON ? Si l'en-tête `Content-Type` dit autre chose, `415`. On le sait sans lire le corps.
3. Uniquement dans un changement : as-tu envoyé la condition ? Sinon, `428`. Est-elle remplie ? Sinon, `412`.
4. (Comme dans la Leçon 2) Le corps peut-il être lu ? Sinon, `400`. Et s'il dépasse 16 Kio, le plafond que le `revisor` accepte, `413` (section 3.6.1).
5. Les données peuvent-elles être satisfaites ? Sinon, `422`.
6. Heurtent-elles l'état du serveur ? Si oui, `409`.
7. Uniquement dans un changement, à l'écriture : la version est-elle toujours celle qui a coïncidé à l'étape 3 ? Si une autre requête l'a changée entre-temps, `412` ; si une autre l'a retirée, `410`. Cette étape paraît répétée, et elle ne l'est pas : la section 3.3.4 montre ce qui se passe sans elle.

Pourquoi le format passe-t-il avant la condition, et la condition avant la lecture du corps ? Parce que la spécification le demande. La [section 13.2.1 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1) dit qu'un serveur **doit** évaluer les préconditions après ses vérifications normales de la requête et **juste avant de traiter le contenu** ou d'exécuter la méthode. Et elle ajoute l'autre moitié de la règle : le serveur **doit ignorer** les préconditions si, sans elles et **avant de traiter le contenu**, la réponse aurait été autre chose qu'un `2xx` ou un `412`. Autrement dit : les erreurs détectées avant de travailler sérieusement l'emportent sur la condition. Une route qui n'existe pas, un identifiant manquant et une ressource retirée en font partie. Un `Content-Type` qui n'est pas accepté en fait aussi partie : le `415` sort d'un en-tête, sans lire un seul octet du corps (la [section 15.5.16](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.16) dit que le `415` peut tenir au `Content-Type` que déclare la requête). C'est pourquoi un `PUT` avec `text/plain` reçoit `415` même si son étiquette est périmée, et qu'un `PUT` avec `If-Match: *` vers un service retiré reçoit `410` et non `412`, comme tu le verras en 3.7. Ce qui attend la condition, en revanche, c'est la **lecture** du corps : le `400` et le `422` ne se savent qu'après l'avoir traité.

Le `428` n'est pas une précondition qu'on évalue ; c'est l'absence d'une précondition. Pourtant, le `revisor` pose la question au même endroit que le `412`, après le format : ainsi, les deux réponses qui renvoient le client lire l'étiquette sortent de la même étape, et un client qui envoie le mauvais format et aucune condition apprend d'abord ce qui se sait sans rien lire.

Et il y a une raison pratique pour que la condition passe avant la lecture : si l'étiquette est périmée, tout ce que dit le corps est écrit sur une version qui n'existe plus. Cela ne sert à rien de le passer en revue champ par champ pour dire au client « ton nom est faux » alors que ce qu'il doit faire d'abord, c'est relire. Les exercices le vérifient par des exécutions : le 1, avec un `text/plain` sans condition et un autre avec une étiquette périmée ; le 3, avec une requête qui apporte à la fois une étiquette périmée et des données impossibles.

### 3.2 La mise à jour perdue

#### 3.2.1 Deux éditeurs et un `200` pour chacun

La scène du début n'a besoin ni de malchance ni d'erreur de programmation ; il suffit de deux personnes et d'un `PUT` qui ne demande rien. Le problème a un nom dans la spécification : la RFC 9110, à la [section 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1), l'appelle *lost update* et dit qu'`If-Match` existe surtout pour l'éviter, lorsque plusieurs clients agissent en parallèle sur la même ressource.

Il survient, dans sa forme la plus courante, avec une séquence en quatre étapes (avec trois éditeurs ou un processus automatique au milieu, c'est la même idée, avec plus d'acteurs) :

1. Ana lit le service. Elle a une copie.
2. Beto lit le service. Il a une copie identique.
3. Ana change l'adresse dans sa copie et l'enregistre. Le serveur conserve la nouvelle adresse.
4. Beto change la limite dans **sa** copie, qui contient encore l'ancienne adresse, et l'enregistre. Le serveur conserve la nouvelle limite **et l'ancienne adresse**.

L'étape 4 est celle qui fait mal. `PUT` remplace la ressource entière par ce que contient le corps : la [section 9.3.4 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4) dit qu'il demande que l'état de la ressource soit **créé ou remplacé** par celui qui figure dans la requête. Beto n'a pas voulu toucher à l'adresse ; il a simplement envoyé celle qu'il avait. Pour le serveur, il n'y a aucun moyen de distinguer « je n'y ai pas touché » de « je la veux ainsi ».

Le programme `fig03_02.ts` reproduit les quatre étapes contre le `revisor`. Ana met l'adresse `…/codigo/204` ; Beto, la limite de 3000 ms. À la fin, on lit le service et le programme dit si le changement d'Ana a survécu :

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

Si le serveur répond `412` à Beto, le programme fait ce que doit faire un client bien écrit : il relit, applique **son** changement (uniquement la limite) sur la nouvelle copie et enregistre à nouveau. Mais cela n'arrive que si le serveur répond `412`. D'abord, le rouge.

#### 3.2.2 Au rouge : un `PUT` qui ne demande rien

Voici le `PUT` que presque tout le monde écrit la première fois : chercher le service, lire le corps, le valider et l'enregistrer. Il fonctionne, il passe tous les tests d'un seul utilisateur, et il perd des données dès qu'il y en a deux. Pour le voir, copie le dossier `fig03_01/` de la section 3.9 sous le nom `rota/` et supprime de `cambiar`, dans `rota/servicios.ts`, tout le bloc qui va de `const condicion = …` jusqu'au calcul de `versionLeida`, puis passe `null` à `cambiarServicio`. Cela donne ceci (c'est un extrait ; la version complète se trouve dans `defectos/sin-condicion/servicios.ts`) :

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

**Série C :** démarre le laboratoire et le `revisor` depuis `rota/`. D'abord, un `PUT` sans `If-Match`, qui dans le `revisor` de cette leçon donne `428` :

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

`200`. Rien ne l'arrête. Et maintenant les deux éditeurs. Copie `fig03_02.ts` à côté de `rota/` et lance-le :

```text
$ node fig03_02.ts
Ana      lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Beto     lee:    200 "1-2-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}
Ana      guarda: 200 "1-3-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/204","limite_ms":1500}
Beto     guarda: 200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
Al final lee:    200 "1-4-dedb68a8" {"id":1,"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}
SE PERDIÓ el cambio de Ana, y nadie recibió un error
```

Voilà la scène du début, au complet. Ana a enregistré la nouvelle adresse (`…/codigo/204`) et a reçu `200`. Beto a enregistré sa vieille copie avec la nouvelle limite et a **lui aussi** reçu `200`, et ce faisant il a remis l'adresse à `…/codigo/200`. Remarque que Beto **a bien envoyé** `If-Match`, avec l'étiquette `"1-2-…"` qu'il avait lue ; le serveur ne l'a tout simplement pas regardée. Un en-tête conditionnel que le serveur ignore ne protège rien, et le client n'a aucun moyen de le savoir : la spécification permet à un intermédiaire d'ignorer `If-Match`, mais le serveur d'origine qui la reçoit **doit** l'évaluer avant d'exécuter la méthode (section 13.1.1).

Ce qui ne va pas ne se voit dans aucun en-tête : c'est le `200` lui-même. Un `200` a dit à Beto « ton changement a été appliqué sur ce que tu as lu », et c'était un mensonge : il a été appliqué sur quelque chose que Beto n'a jamais vu. Arrête les programmes de `rota/` ; tu réutiliseras ce dossier en 3.3.4.

#### 3.2.3 Au vert : l'étiquette comme preuve de la version que tu as lue

La solution comporte deux éléments que tu connais déjà depuis la Leçon 1 :

- **`ETag`** : chaque fois que le `revisor` livre un service, il y appose une étiquette qui change chaque fois que le service change. Dans le `revisor`, c'est `"id-version-démarrage"` : l'id du service, un numéro de version qui monte à chaque changement, et les huit chiffres tirés au sort au démarrage.
- **Un en-tête conditionnel** : dans la Leçon 1, `If-None-Match` disait « envoie-le-moi seulement s'il a changé ». Désormais, `If-Match` dit le contraire : « **fais ceci seulement s'il n'a pas changé** », ou plus exactement, seulement si l'étiquette en vigueur est celle que j'ai lue.

Avec cela, chaque client envoie, avec son changement, l'étiquette de la version sur laquelle il l'a écrit. Si quelqu'un a modifié le service entre la lecture et l'écriture, l'étiquette ne coïncide plus et le serveur refuse : il répond `412` et n'applique rien. Le client n'a pas perdu de données ; il a perdu une course, et il le sait.

D'abord, le même programme des deux éditeurs qu'en 3.2.2, celui qui avait perdu le changement d'Ana. **Série B :** arrête le `revisor` de `rota/`, démarre le laboratoire et le `revisor` depuis `fig03_01/`, et lance `fig03_02.ts` dès qu'il démarre :

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

Ana a enregistré (`200`, version 2). Beto a reçu `412`, a relu (il voit maintenant l'adresse d'Ana), a appliqué uniquement son changement et a enregistré (`200`, version 3). À la fin, les deux changements sont là. Personne n'a eu à se coordonner par messagerie ni à bloquer le service pendant qu'il l'éditait : il a suffi que le serveur refuse d'écrire sur une version périmée. Cette technique s'appelle la **concurrence optimiste** : on suppose qu'il y aura rarement des collisions, on laisse tout le monde travailler, et on n'arrête que celui qui arrive en retard.

Maintenant la même chose, pas à pas, avec `curl`. **Ici commence la série A, la principale de la leçon :** arrête le `revisor` et redémarre-le depuis `fig03_01/`, pour que le service 1 soit comme au début. À partir d'ici et jusqu'à la fin de la section 3.8, toutes les requêtes du bon `revisor` appartiennent à cette même série ; ne le redémarre pas entre l'une et l'autre, car chacune part de ce qu'a laissé la précédente. D'abord, on lit le service 1 et on garde son étiquette dans la variable `ETAG`, avec l'option `-w '%header{etag}'` de `curl`, qui n'affiche que cet en-tête. Cette lecture fait office de « Ana et Beto lisent » :

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

Ana enregistre en premier, avec `If-Match` et l'étiquette qu'elle a lue. Elle fait passer la limite à 1500 ms :

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

`200` et une nouvelle étiquette : la version est passée de 1 à 2. Maintenant arrive Beto avec **la même étiquette qu'avant**, celle de la version 1, et un changement différent :

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

`412 Precondition Failed`. Le changement de Beto n'a pas été appliqué, et celui d'Ana est intact. Le corps dit ce qui s'est passé et ce qu'il faut faire : son étiquette n'est plus celle en vigueur, parce que le service a changé (ou parce que le `revisor` a redémarré, ce qui invalide aussi les étiquettes), et il doit le relire avant de le modifier. Il ne répète pas l'étiquette que Beto a envoyée : Beto l'a déjà, et renvoyer au client un texte qu'il a lui-même écrit ne fait qu'alourdir la réponse sans rien lui apprendre de nouveau.

### 3.3 `If-Match` et le `412`

#### 3.3.1 Pourquoi `If-Match` se compare en comparaison forte

La Leçon 1 a enseigné qu'il existe deux façons de comparer des étiquettes, et la [section 8.8.3.2 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) les définit avec un tableau :

| Étiquette 1 | Étiquette 2 | Comparaison forte | Comparaison faible |
|---|---|---|---|
| `W/"1"` | `W/"1"` | ne coïncide pas | coïncide |
| `W/"1"` | `W/"2"` | ne coïncide pas | ne coïncide pas |
| `W/"1"` | `"1"` | ne coïncide pas | coïncide |
| `"1"` | `"1"` | coïncide | coïncide |

Une étiquette **faible** (`W/` devant) promet peu : que deux représentations sont « équivalentes », même si les octets ne sont pas identiques. Elle sert au cache, et c'est pourquoi `If-None-Match` se compare en comparaison faible. Une étiquette **forte** promet que les octets sont exactement les mêmes.

`If-Match` se compare **en comparaison forte**, et la [section 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) l'exige avec un **doit** : le serveur d'origine doit utiliser la comparaison forte parce que le client veut empêcher la méthode de s'appliquer **s'il y a eu le moindre changement** dans les données de la représentation. Une étiquette faible ne peut pas garantir cela : deux versions « équivalentes » peuvent différer par quelque chose qui importe au client. C'est pourquoi, en comparaison forte, une étiquette `W/` ne coïncide **jamais** avec rien, pas même avec sa jumelle.

La spécification dit aussi ce que contient l'en-tête : `*` ou une **liste** d'étiquettes séparées par des virgules (`If-Match = "*" / #entity-tag`). Et elle donne trois étapes pour l'évaluer :

1. Si c'est `*`, la condition est remplie si la ressource possède une représentation actuelle, c'est-à-dire si elle existe.
2. Si c'est une liste, elle est remplie si **l'une quelconque** des étiquettes coïncide avec celle en vigueur.
3. Dans tous les autres cas, elle n'est pas remplie.

`etiquetas.ts`, qui vient sans changement depuis la Leçon 1, fait déjà tout cela : `interpretarLista` lit la liste en respectant les guillemets, `coincideFuerte` compare deux étiquettes comme l'exige le tableau, et `hayCoincidencia` réunit les deux. Ce qui est nouveau, c'est qui l'appelle avec `coincideFuerte` : le gestionnaire `cambiar`, dans `servicios.ts`.

#### 3.3.2 Les trois formes qui coïncident et celle qui ne coïncide pas

Pour le prouver, dans la même série A, on lit l'étiquette en vigueur (maintenant la version 2, après le changement d'Ana) et on la garde dans `VIGENTE`. Ensuite, on envoie un changement avec cette même étiquette, mais marquée comme faible :

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

`412`, alors que le texte entre guillemets est exactement celui en vigueur. Regarde le corps : il ne dit pas que le service a changé, parce qu'il n'a pas changé. Il dit qu'une étiquette faible ne sert pas à modifier et qu'il faut l'envoyer telle qu'elle est arrivée. Le `revisor` le sait parce que, lorsque la comparaison forte échoue, il essaie aussi la comparaison faible : si celle-ci coïncide, le problème n'est pas que le service ait changé, mais que le client a ajouté `W/` à l'étiquette (cela peut arriver sans que le client l'ait écrit : depuis la version 1.7.3, de 2014, le serveur web nginx transforme en faible une étiquette forte lorsqu'il modifie la réponse, par exemple en la compressant, d'après sa [liste des changements](https://nginx.org/en/CHANGES) ; ce cas a sa propre complication, expliquée deux paragraphes plus bas). Lui dire que le service a changé serait faux, et enverrait le client relire dans une boucle qui ne se termine jamais.

Il y a un cas où le conseil du corps, « envoie l'`ETag` telle qu'elle est arrivée », ne suffit pas : celui de nginx. Si c'est un intermédiaire qui a affaibli l'étiquette, elle est **arrivée** faible chez le client, et l'envoyer telle qu'elle est arrivée répète le `412` à chaque tentative tant que l'intermédiaire continue d'affaiblir l'étiquette. Ce problème, le client ne peut pas le résoudre : celui qui exploite l'API doit empêcher l'intermédiaire de modifier ces réponses (par exemple, ne pas compresser celles qui portent une étiquette destinée à servir pour écrire) ou utiliser des étiquettes qui survivent à la modification. C'est pourquoi le corps donne la cause exacte et non un « quelque chose a échoué » générique : la personne qui le lit sait que le problème vient de l'étiquette faible, et qui prévenir. **Le code commande et le corps explique, et les deux disent la même chose** : tous deux disent « ta condition n'a pas été remplie », et le corps ajoute pourquoi.

Maintenant, une liste qui contient l'étiquette en vigueur à côté d'une autre qui n'existe pas, puis `*` :

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

Les deux donnent `200`. La liste coïncide parce qu'**une** étiquette coïncide. `*` coïncide parce que le service existe. Et chaque changement a fait monter la version : `"1-3-…"` puis `"1-4-…"`.

À quoi sert `If-Match: *` s'il ne protège pas contre le changement d'un autre ? À autre chose : il dit « fais-le seulement si la ressource existe ». Dans une API où `PUT` peut **créer** une ressource, `If-Match: *` empêche d'en créer une par accident quand l'intention était de la modifier ; et son contraire, `If-None-Match: *`, empêche d'écraser une ressource qui existait déjà quand l'intention était de la créer. Dans le `revisor`, `PUT` ne crée jamais (un service qui n'existe pas donne `404`), de sorte que `*` épargne simplement au client de lire l'étiquette. C'est pourquoi **celui qui envoie `*` renonce à la protection contre la mise à jour perdue**. C'est valide, la spécification le permet, mais c'est une décision du client, et il convient qu'il la prenne en connaissance de cause.

#### 3.3.3 Le code de `cambiar`

Voici le gestionnaire, complet dans `servicios.ts` (section 3.9). Ce qui compte se trouve dans les premières lignes :

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

Cela se lit dans l'ordre de 3.1.3 : d'abord `encontrar` (existe ou non, pour cet identifiant), puis `esJson`, qui ne regarde que l'en-tête `Content-Type` (`415`), puis la condition, et seulement ensuite le corps. Avant de lire le corps, `cambiar` note **quelle version a coïncidé**, dans `versionLeida` ; avec `If-Match: *`, il note `null`, car `*` ne parle d'aucune version, il demande seulement que le service existe. Cette annotation paraît superflue, puisque la comparaison est déjà faite. La section suivante montre pourquoi elle ne l'est pas.

#### 3.3.4 Deux requêtes à la fois : comparer et écrire en une seule étape

Entre la comparaison de l'étiquette et l'écriture, `cambiar` attend deux fois : `await leerJson(…)`, pendant que le corps arrive, et `await destinoPermitido(…)`, pendant que le DNS résout le nom de l'URL. À chaque `await`, Node cesse de traiter cette requête et en traite d'autres. Si, dans cet intervalle, arrive un autre `PUT` avec la **même** étiquette, il passe lui aussi la comparaison, car personne n'a encore écrit. Les deux requêtes continuent, convaincues que le service est tel qu'elles l'ont lu, et celle qui écrit en dernier écrase l'autre. C'est de nouveau la mise à jour perdue, cette fois avec deux clients qui **ont bien** envoyé `If-Match` à un serveur qui **l'a bien** comparée.

**D'abord, au rouge.** Pour la voir sans dépendre de la chance, l'une des deux requêtes doit rester volontairement en attente dans cet intervalle. `curl -T -` envoie le corps qu'il lit sur son entrée, au fur et à mesure qu'il arrive ; si l'entrée tarde, la requête envoie ses en-têtes tout de suite et attend le corps, précisément dans le `await leerJson`. La « lente » veut fixer la limite à 1000 ms et son corps arrive une seconde plus tard ; à 0,3 seconde, la « rapide » veut la fixer à 3000 ms, avec la même étiquette. La version défectueuse est une série à part, la D, et elle coupe la série A. Si tu préfères ne pas la couper, saute ce rouge et lance-le à la fin de la leçon ; si tu le lances maintenant, en revenant tu devras redémarrer le `revisor` de `fig03_01/` et répéter la série A depuis 3.2.3 jusqu'ici pour que tes réponses coïncident avec celles de la leçon.

Pour la version défectueuse, crée la copie **à partir de zéro** : `rm -r rota && cp -R fig03_01 rota`. Le `rm` n'est pas superflu : si `rota/` existe déjà, `cp -R` met le dossier à l'intérieur (`rota/fig03_01/`) et `rota/` reste avec la version de 3.2.2. Ensuite, fais un seul changement dans `rota/servicios.ts` : dans `cambiar`, passe `null` à `cambiarServicio` à la place de `versionLeida`. Ainsi, la comparaison du début reste en place, mais à l'écriture on ne compare plus rien (version complète dans `defectos/una-sola-comparacion/servicios.ts`).

**Série D :** arrête le `revisor` que tu fais tourner et démarre le laboratoire et le `revisor` depuis `rota/`. Avant la course, vérifie que tu fais bien tourner la bonne copie, car le résultat rouge de la course est le même avec les deux versions défectueuses et ne te signalerait pas l'erreur. Un `PUT` avec une étiquette inventée **doit** donner `412`, parce que la comparaison du début est toujours active ; s'il donne `200`, tu fais tourner la copie de 3.2.2 :

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

`412` : la première comparaison fonctionne. Maintenant, la course pour de bon :

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

Les deux ont reçu `200` ; la lente a affiché le service qu'on lui a renvoyé. Et la valeur qui est restée est celle de la **lente**, 1000, alors que la rapide a enregistré en premier et a aussi reçu `200`. Le client de la rapide croit que la limite est 3000 ; le serveur dit 1000 ; personne n'a reçu d'erreur. La comparaison du début a bien été faite (le contrôle ci-dessus le prouve), et elle n'a servi à rien, car lorsque la lente a écrit, elle n'était plus vraie.

Si tu tapes la course dans ton terminal, tu verras en outre une ligne comme `[1] 12345` au lancement de la lente, et une autre qui annonce qu'elle s'est terminée (`[1]+ Done …` dans bash, `[1] + done …` dans zsh) : elles viennent du shell, qui t'informe des tâches en arrière-plan, pas du `revisor`.

**Ensuite, au vert.** Le correctif consiste à comparer **une seconde fois, au moment d'écrire**, sans aucun `await` entre la comparaison et l'écriture. C'est ce que fait `cambiarServicio` dans `almacen.ts` :

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

C'est une fonction **synchrone** : elle n'a aucun `await`, de sorte que JavaScript l'exécute du début à la fin sans traiter aucune autre requête entre-temps. Personne ne peut se glisser entre le `if` qui compare la version et l'`Object.assign` qui écrit. Si la version n'est plus celle que `cambiar` a notée, elle n'écrit rien et renvoie `"conflicto"`, et `cambiar` répond `412`. Et si le service n'est plus là, parce qu'une autre requête l'a retiré dans l'intervalle, elle renvoie `"retirado"`, et `cambiar` répond `410` ; la section 3.7.3 le provoque :

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

La même course contre le `revisor` de cette leçon, **dans la série A**, juste après les requêtes de 3.3.2 (si tu as lancé la série D, redémarre `fig03_01/` et répète d'abord la série A depuis 3.2.3 ; si tu ne la répètes pas, ton étiquette dira `"1-1-…"` au lieu de `"1-4-…"` et ce qui suit de 3.4 à 3.8 ne coïncidera pas avec la leçon) :

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

La rapide, `200` ; la lente, `412`, avec un corps différent de celui d'une étiquette périmée : le service a changé **pendant** le traitement de sa requête. Et la valeur qui est restée est celle de la rapide, 3000, la même que celle que son client croit avoir laissée. Aucune écriture ne s'est perdue : l'une a été appliquée, l'autre a été rejetée et son client le sait.

Pourquoi ne pas déplacer toute la comparaison à la fin et ne comparer qu'une seule fois ? Cela fermerait l'intervalle tout aussi bien, mais obligerait à attendre le corps complet et à interroger le DNS pour une étiquette que l'on sait périmée dès la première ligne. C'est pourquoi `cambiar` compare deux fois : au début, pour rejeter à bon compte ce qui est déjà arrivé périmé ; à l'écriture, pour ne pas accepter ce qui s'est périmé en chemin.

**L'équivalent dans une base de données.** Une vraie API ne garde pas ses données dans une `Map`, mais le problème et la solution sont les mêmes. Lire la version avec un `SELECT` puis écrire avec un `UPDATE` séparé laisse le même intervalle entre les deux instructions. La forme classique consiste à mettre la version dans la condition de l'écriture : `UPDATE servicios SET … , version = version + 1 WHERE id = 1 AND version = 4`. La base de données compare et écrit en une seule opération, et indique combien de lignes elle a touchées ; si elle en a touché zéro, un autre est arrivé avant, et la réponse est `412`. `cambiarServicio` est exactement cela, écrit en mémoire. Et une limite honnête : l'atomicité d'une fonction synchrone vaut au sein d'**un** processus Node. Si le `revisor` tournait en plusieurs instances (processus, réplicas derrière un répartiteur de charge), chacune avec sa propre `Map`, il n'y aurait plus un seul endroit où comparer et écrire ; cette comparaison doit vivre là où les données sont partagées, dans la base de données, avec l'`UPDATE … WHERE version = N`.

### 3.4 `412` face à `428`

#### 3.4.1 Quand le client n'envoie pas la condition

Tout ce qui précède fonctionne si le client envoie `If-Match`. Et s'il ne l'envoie pas ? Pour le serveur, un `PUT` sans condition est exactement le `PUT` de la scène du début : écrire sans savoir sur quelle version. Il pourrait l'accepter, et alors la protection dépend du fait que tous les clients pensent à envoyer l'en-tête. Ou bien il peut **l'exiger**.

Pour cela existe le **`428 Precondition Required`**, qui ne figure pas dans la RFC 9110 mais dans la [RFC 6585, section 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3), d'avril 2012. Sa définition tient en une ligne : le serveur d'origine **exige que la requête soit conditionnelle**. Et la phrase suivante dit pourquoi : son usage typique est d'éviter la mise à jour perdue, lorsqu'un client lit l'état d'une ressource, le modifie et le renvoie avec `PUT` alors qu'un tiers l'a déjà changé. La RFC ajoute deux règles : la réponse **devrait** expliquer comment renvoyer la requête avec succès (son propre exemple dit « essaie avec `If-Match` »), et elle **ne doit pas** être stockée dans un cache.

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

Le corps dit quoi faire, comme le demande la RFC : envoie `If-Match` avec l'`ETag`. Pour savoir laquelle, le client doit d'abord lire le service, ce qui est justement ce qu'il a omis de faire.

#### 3.4.2 La différence en un tableau

| | `412 Precondition Failed` | `428 Precondition Required` |
|---|---|---|
| La condition est-elle venue ? | oui | non |
| Que s'est-il passé ? | la condition a été évaluée et s'est révélée fausse | il n'y a rien à évaluer |
| Que dit-elle ? | « la ressource a changé depuis que tu l'as lue » (ou ton étiquette ne convient pas) | « je n'écris pas sans savoir quelle version tu as lue » |
| Que fait le client ? | il relit, refait son changement sur la nouvelle copie, envoie la nouvelle étiquette | il lit, et envoie l'étiquette |
| Peut-il répéter la même requête telle quelle ? | non : il recevra de nouveau `412` | non : il recevra de nouveau `428` |
| Défini dans | RFC 9110, section 15.5.13 | RFC 6585, section 3 |

Les deux réponses renvoient le client **lire**, mais pour des raisons différentes, et un programme les traite différemment : après un `412`, le programme doit **fusionner** son changement avec ce qu'il a trouvé, car quelqu'un d'autre a écrit ; après un `428`, il lui manquait seulement une étape, et ce qu'il trouve en lisant est ce qu'il avait déjà. C'est pourquoi on ne les réunit pas en un seul code.

Pourquoi le `revisor` exige-t-il la condition au lieu de simplement la recommander ? Parce que, dans une API qui administre une configuration partagée, comme la liste des services qu'une équipe surveille, une mise à jour perdue ne prévient pas : on la découvre des heures plus tard, comme dans la scène. Exiger `If-Match` coûte une lecture au client ; ne pas l'exiger peut lui coûter une nuit sans surveillance. C'est une décision de conception, pas une obligation de HTTP : la RFC 6585 permet de l'exiger, elle n'oblige pas à le faire. Certaines API décident autrement, et tu le verras en 3.5.3.

### 3.5 Conflit d'état : `409`

#### 3.5.1 Le nom en double

Le `revisor` a une règle : au sein d'une équipe, deux services ne peuvent pas porter le même nom. C'est une règle raisonnable (le nom est ce que l'on lit sur les tableaux de bord et dans les alertes, et deux « pagos » dérouteraient n'importe qui), et c'est une règle **d'état** : elle ne dépend pas du nom en lui-même, mais de quels autres services existent. Voici ce que cela donne lorsque l'équipe a essaie d'enregistrer un second `pagos` :

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

`409 Conflict`. Le corps remplit le **devrait** de la section 15.5.10 : il dit avec quoi il heurte (`/servicios/2`), pour que le client puisse reconnaître l'origine du conflit et décider : changer le nom, ou consulter le service qui existe déjà parce que c'est peut-être celui qu'il cherchait. La Leçon 5 placera cette adresse dans un champ propre du corps, `existente`, pour qu'un programme la lise sans interpréter la phrase.

Il en va de même pour une modification qui tente de donner à un service le nom d'un autre. Ici le client envoie `If-Match: *`, de sorte que la condition est remplie ; ce qui échoue, c'est la suite :

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

Et la preuve qu'il s'agit d'un conflit d'état et non d'une règle sur les données : la **même** requête d'enregistrement, octet pour octet, avec l'identifiant de l'équipe b, qui n'a aucun `pagos` :

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

`201`. Les données étaient valides ; ce qui a changé, c'est l'état contre lequel elles ont été comparées. Voilà l'épreuve du feu du `409` : **si la même requête pouvait fonctionner à un autre moment ou dans un autre contexte sans que rien en elle ne change, l'échec est d'état, pas de données.**

#### 3.5.2 `409` et non `422`, `409` et non `412`

Pourquoi pas `422` ? Parce que le `422` dit « ce que tu as envoyé ne peut pas être satisfait », et un client qui le reçoit corrige ses données. Ici, les données n'ont rien à corriger. Certaines grandes API décident autrement : celle de GitHub répond `422` avec le code `already_exists` lorsqu'une autre ressource utilise déjà la même valeur unique, comme le nom d'une étiquette ([documentation de son API REST](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api)). C'est une décision cohérente au sein de son API, et elle est documentée ; le cours préfère `409` parce que la spécification le décrit justement pour le conflit que l'utilisateur peut résoudre et renvoyer.

Pourquoi pas `412` ? Parce que le client n'a posé aucune condition. Le `412` répond à un en-tête conditionnel que le client a envoyé et qui s'est révélé faux. Le client qui enregistre `pagos` n'a pas dit « crée-le seulement s'il n'y en a pas déjà un autre avec ce nom » ; le serveur a cette règle de son propre chef. Lorsque la règle appartient au serveur et que le heurt se fait avec l'état, le code est `409`.

#### 3.5.3 Quand la version voyage dans le corps

Il y a un cas où la frontière entre `409` et `412` se déplace, et la section 15.5.10 elle-même le mentionne : elle dit que les conflits sont plus probables dans un `PUT`, et donne pour exemple une API **avec des versions** dans laquelle la représentation envoyée contient des changements qui heurtent ceux d'une requête antérieure d'un tiers. C'est la mise à jour perdue. Alors, la mise à jour perdue est-elle `409` ou `412` ?

Cela dépend de **l'endroit où voyage la condition** :

- Si la version que le client a lue voyage dans un **en-tête conditionnel** (`If-Match`), le serveur évalue une précondition HTTP, et si elle échoue, la réponse est `412`. C'est ce que fait le `revisor`.
- Si la version voyage **dans le corps** (un champ `"version": 7` dans le JSON), pour HTTP il n'y a aucune précondition : cela fait partie des données. Le serveur découvre le heurt en comparant le corps à son état, et la réponse est `409`.

Les deux formes existent dans des API réelles. Les guides de conception de Google ([AIP-154](https://google.aip.dev/154)) font de l'étiquette un champ de la ressource et demandent de répondre `ABORTED` lorsqu'elle ne coïncide pas, une erreur que leur table d'équivalences traduit en `409 Conflict` ; la même table envoie `INVALID_ARGUMENT` et `FAILED_PRECONDITION` vers `400` ([`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto)). Et l'AIP-154 n'exige pas l'étiquette : elle laisse passer la requête qui n'en a pas, sauf dans les services qui ont besoin d'une cohérence stricte. Les guides de conception d'API de Zalando, en revanche, envisagent `ETag` avec `If-Match` comme une option (leur règle 182 est un « peut », pas un « doit »), et leur table de codes attribue le `412` à la condition qui échoue et le `428` à la condition qui est exigée ([*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/)). Le cours suit la seconde forme parce qu'elle utilise la mécanique que HTTP fournit déjà pour cela, et parce que tout intermédiaire sur le trajet comprend un en-tête standard ; un champ `version` dans le corps, seul ton client le comprend.

Une note de plus sur le `409`, pour ne pas le confondre plus tard : dans la [Leçon 6](06-reintentos-idempotencia.md) apparaît un autre `409`, lorsqu'arrive une requête avec un en-tête `Idempotency-Key` alors que l'originale portant la même clé est encore en cours. Ce comportement provient d'un brouillon de l'IETF, `draft-ietf-httpapi-idempotency-key-header-07`, qui a expiré le 18 avril 2026 sans être publié comme RFC : **ce n'est pas un standard**, et la Leçon 6 le traite pour ce qu'il est. C'est un autre conflit avec l'état actuel, et c'est pourquoi le brouillon a choisi le même code.

### 3.6 Règle métier : `422`, et la politique de `400` face à `422`

#### 3.6.1 La politique écrite

Dans la Leçon 2, tout ce qui ne convenait pas dans le corps répondait `400`. Depuis cette leçon, le `revisor` sépare deux cas, et il le fait avec une règle écrite, parce que c'est l'une des deux décisions que le cours prend comme **politique** et non comme intuition :

- **`400 Bad Request` : on ne peut pas le lire.** Le corps n'est pas du JSON, ou c'est du JSON mais pas un objet (`null`, un nombre, un texte, une liste). Il n'y a aucun moyen de savoir ne serait-ce que quels champs il contenait. (Un corps de plus de 16 Kio n'est même pas lu jusqu'au bout : le `revisor` cesse de le conserver dès qu'il dépasse ce plafond et répond `413 Content Too Large`, pour que personne ne lui remplisse la mémoire avec un corps gigantesque.)
- **`422 Unprocessable Content` : on le lit, mais on ne peut pas le satisfaire.** Le corps est un objet JSON, on comprend quels champs il contient, mais l'un manque, a le mauvais type ou une valeur hors plage, ou l'adresse pointe vers une destination interdite.

Les règles du `revisor` sont au nombre de quatre : `nombre` est un texte de 1 à 40 caractères ; `url` est une adresse `http` ou `https` ; `limite_ms`, s'il est présent, est un entier de 100 à 10 000 (sinon, il vaut 2000) ; et la destination de `url` ne peut pas être une adresse privée ou réservée (le SSRF de la Leçon 1).

La règle du milieu mérite qu'on s'y arrête : **on rassemble tous les échecs, pas seulement le premier.** Un client qui reçoit « le nom est faux », le corrige, reçoit « l'adresse est fausse », la corrige et reçoit « la limite est fausse » a fait trois allers-retours pour quelque chose qui pouvait se dire en un. Voici les trois échecs réunis, et le `400` d'un corps qui n'est pas un objet :

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

Une ligne par champ, chacune avec le nom du champ devant. La Leçon 5 transforme ces lignes en une liste `errors` avec un `pointer` par champ (`"#/nombre"`), comme l'exemple de la [section 3 de la RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html#section-3), pour qu'un formulaire puisse marquer chaque champ sans interpréter du texte.

Le mauvais type est aussi un `422`, même s'il ressemble à un problème de lecture. Ici, `limite_ms` est arrivé sous forme de texte (`"2000"`), pas de nombre :

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

Le JSON a été lu sans problème ; ce qui n'est pas respecté, c'est la règle « entier de 100 à 10 000 ». Si le `revisor` convertissait le texte en nombre de son propre chef, il accepterait aussi `"2000abc"` ou `" 2000 "` selon la façon de convertir, et chaque client apprendrait une règle différente. Il vaut mieux dire avec exactitude ce qui était attendu.

#### 3.6.2 La destination interdite est aussi un `422`

La défense contre le SSRF de la Leçon 1 reste la même, mais elle change de code. Auparavant elle répondait `400`, parce que le `422` n'existait pas encore ; maintenant l'URL se lit parfaitement, c'est une adresse `http` valide, et ce qui ne peut pas être satisfait, c'est la règle « le `revisor` ne se connecte pas à des adresses privées ou réservées » :

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

Le texte est le même que dans les leçons précédentes. Dans le second cas, le message dit seulement que `localhost` se résout vers une adresse privée ou réservée, sans énumérer lesquelles : ce que résout un nom change selon le système, et la liste révélerait au client le réseau interne du serveur sans lui servir à rien.

#### 3.6.3 D'autres guides décident autrement

La politique du cours n'est pas la seule raisonnable, et il vaut la peine que tu saches ce que font les autres, car tu rencontreras des API des deux côtés :

- Les guides de **Zalando** disent que le `400` doit aussi être utilisé lorsque le corps ne passe pas la validation métier ou sémantique, « au lieu d'utiliser `422` », et marquent le `422` comme « à ne pas utiliser » : selon eux, le `400` couvre déjà presque tous les cas et ils ne voient pas de bénéfice net à les distinguer.
- Ceux de **Google** traduisent leurs erreurs d'argument invalide (`INVALID_ARGUMENT`) en `400`.
- L'API de **GitHub**, comme tu l'as vu en 3.5.2, utilise `422` pour la validation, et même pour les valeurs en double.

Le cours s'en tient à la frontière « lire face à satisfaire » pour une raison qui tient à celui qui reçoit l'erreur : un `400` dit au client que **quelque chose dans la forme** de sa requête est cassé, normalement une erreur de programmation à corriger dans le code ; un `422` lui dit que la forme est bonne et que **les valeurs** ne sont pas acceptées, normalement quelque chose qu'une personne a écrit et qu'on peut lui montrer dans un formulaire. Ce sont deux actions distinctes, et la spécification a un code pour chacune. Ce qui importe plus que la frontière exacte, c'est que l'API l'**écrive** et l'applique de la même façon sur toutes ses routes : un client peut s'adapter à l'une ou l'autre politique ; à une API qui emploie les deux au hasard, non.

### 3.7 La ressource qui est partie : `410` face à `404`

#### 3.7.1 Ce que le `404` ne dit pas

Dans la Leçon 2, retirer un service l'effaçait du magasin, et ensuite son identifiant répondait `404`, comme un identifiant qui n'avait jamais existé. Pour le client, les deux situations sont très différentes. Si un service **n'a jamais existé**, le client s'est peut-être trompé de numéro et cela vaut la peine de vérifier. S'il **a existé et a été retiré volontairement**, il n'y a rien à vérifier : il faut cesser de le demander, le supprimer de la configuration, retirer le lien du tableau de bord.

La [section 15.5.5 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5) dit qu'un `404` **n'indique pas** si l'absence est temporaire ou permanente, et que l'on préfère le `410` si le serveur sait que la condition est probablement permanente. La [section 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11) définit le **`410 Gone`** : la ressource n'est plus disponible sur le serveur d'origine, et c'est probablement pour toujours. Si le serveur ne sait pas, ou n'a aucun moyen de savoir, si c'est permanent, il devrait utiliser `404`. Et elle explique l'intention : signaler que la ressource **a été retirée volontairement** et que ses propriétaires souhaitent que l'on supprime les liens qui pointent vers elle.

Pour pouvoir répondre `410`, le `revisor` doit **se souvenir** de ce qu'il a retiré. C'est pourquoi `almacen.ts` possède désormais une seconde table, `retirados`, qui garde l'id de chaque service retiré avec l'équipe à laquelle il appartenait. Voici sa réponse :

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

Le service 2 a été retiré : `410`, et le corps le dit sans détour, « no va a volver ». Le 99 n'a jamais existé : `404`. Le client peut désormais traiter chaque cas différemment rien qu'en regardant le code.

Deux détails de plus de la spécification. Premièrement, le `410` est **cacheable par heuristique**, tout comme le `404` : un cache peut le stocker même s'il ne porte aucune instruction de cache, et c'est correct, car la ressource ne reviendra pas. Deuxièmement, il n'est pas obligatoire de marquer tout ce qui est retiré comme `410` ni de s'en souvenir pour toujours : la spécification le laisse à l'appréciation de celui qui exploite le serveur. Le `revisor` s'en souvient tant qu'il est démarré ; comme il garde tout en mémoire, lorsqu'on le redémarre, un service retiré redonne `404`. Dans une API avec base de données, la ligne serait marquée comme retirée au lieu d'être supprimée.

#### 3.7.2 Le `410` ne se dit pas à n'importe qui

Le `410` dit plus que « il n'est pas là » : il dit « il **a été** là ». Pour quelqu'un qui n'avait pas à savoir qu'il a existé, c'est une information. Dans la Leçon 2, le `revisor` a décidé qu'un service d'une autre équipe répond `404`, comme un service qui n'existe pas, afin que personne ne puisse énumérer ce qui appartient à autrui en comparant les réponses. Si maintenant le service 2 de l'équipe a répondait `410` à n'importe qui, l'équipe b pourrait parcourir les identifiants et apprendre lesquels ont existé dans l'équipe a et quand ils ont été retirés. C'est pourquoi `encontrar` ne répond `410` qu'**à l'équipe propriétaire** ; aux autres, il répond le même `404` que d'habitude :

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

Le même `404`, avec le même texte que celui du service 99. Pour l'équipe b, le service 2 n'a jamais existé, ce qui est ce que l'équipe b avait le droit de savoir. Voici la fonction qui décide, dans `servicios.ts` :

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

Une seule fonction pour consulter, modifier, retirer et demander une vérification : ainsi aucun gestionnaire ne peut oublier la comparaison de l'équipe, et le `410` et le `404` sortent toujours des deux mêmes lignes. « L'erreur que tu vas voir » montre ce qui se passe si l'on retire `delEquipo` de la seconde condition.

#### 3.7.3 Le `410` l'emporte sur la condition

Un `PUT` avec `If-Match: *` vers un service retiré. `*` signifie « s'il existe » ; le service n'existe pas, donc la condition serait fausse et nous pourrions nous attendre à un `412` :

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

C'est `410`, par la règle de 3.1.3 : la section 13.2.1 demande d'ignorer les préconditions si, sans elles, la réponse n'aurait été ni un `2xx` ni un `412`. Sans `If-Match`, ce `PUT` aurait reçu `410` ; la condition n'est donc même pas évaluée. Et c'est la réponse la plus utile : un `412` renverrait le client relire, et en relisant il recevrait `410` de toute façon.

Il en va de même lorsque le retrait survient **pendant** la modification, dans l'intervalle de 3.3.4. On enregistre un service, `efimero`, et on garde son adresse et son étiquette. Ensuite, la même course qu'avant, avec un autre rival : pendant qu'un `PUT` lent attend son corps, un `DELETE` retire le service :

```text
$ ID=$(curl -sS -o /dev/null -w '%header{location}' -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200"}'); ETAG=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'); echo "ID=$ID ETAG=$ETAG"
ID=/servicios/5 ETAG="5-1-c4dd49c4"

$ ( sleep 1; printf '%s' '{"nombre":"efimero","url":"http://127.0.0.1:18081/codigo/200","limite_ms":3000}' ) | curl -sS -w 'lento: %{http_code}\n' -X PUT -T - http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ETAG" & LENTO=$!; sleep 0.3; curl -sS -o /dev/null -w 'DELETE en el hueco: %{http_code}\n' -X DELETE http://127.0.0.1:18080$ID -H 'Authorization: Bearer escritura-a'; wait $LENTO
DELETE en el hueco: 204
el servicio 5 se retiró y no va a volver
lento: 410
```

Le `DELETE` est arrivé dans l'intervalle et a répondu `204`. Lorsque le `PUT` lent a enfin écrit, `cambiarServicio` n'a plus trouvé le service, a renvoyé `"retirado"`, et la réponse a été `410`, avec le même corps qu'un `GET` vers un service retiré : comme si le `PUT` était arrivé après le retrait, ce qui est exactement ce qui lui est arrivé. Un `412` ici renverrait le client relire, pour tomber sur le `410` à la requête suivante ; avec le `410`, il l'apprend du premier coup.

### 3.8 Versions de l'API : le `410` annoncé

#### 3.8.1 Retirer une version sans surprendre personne

Un service retiré est un petit cas du même problème que rencontre toute API qui grandit : **retirer une ancienne version**. Le `revisor` a trois générations de routes :

- `/servicios` : la version actuelle.
- `/v1/servicios` : la version précédente. Elle fonctionne toujours, mais elle est **dépréciée** : elle parlait de `direccion` au lieu de `url`, et de la limite en secondes (`"limite": 3` pour 3000 ms) au lieu de millisecondes.
- `/v0/…` : la première version, déjà **retirée**. Toute route qui en dépend répond `410`.

Si un jour la `/v1` passait de `200` à `410` sans avertissement, chaque client qui l'utiliserait encore l'apprendrait par une erreur en production. La bonne façon consiste à prévenir **avant**, dans chaque réponse de la `/v1`, pour que celui qui l'utilise ait le temps de migrer. Pour cela il y a deux en-têtes, qui n'ont pas le même poids :

- **`Deprecation`**, de la [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html) (mars 2025, **standard proposé** de l'IETF). Sa valeur est la date à laquelle la ressource **est devenue ou deviendra** dépréciée ; elle peut être dans le passé (« elle est devenue dépréciée à cette date ») ou dans le futur (« elle le sera »). La date est exprimée dans le format des champs structurés de HTTP : `@` suivi du nombre de secondes écoulées depuis le 1er janvier 1970 (section 2.1).
- **`Sunset`**, de la [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html) (mai 2019, document **informatif**, hors voie de normalisation). Sa valeur est la date à laquelle la ressource **cessera probablement de répondre**, dans le format de date HTTP habituel (`Sun, 31 Jan 2027 00:00:00 GMT`). Elle a été publiée comme proposition individuelle de son auteur, relue par l'IETF mais sans être passée par un groupe de travail ([sa fiche dans le datatracker de l'IETF](https://datatracker.ietf.org/doc/rfc8594/)).

Que l'une soit un standard proposé et l'autre informative ne change pas la manière de les utiliser ; cela change la mesure dans laquelle tu peux t'attendre à ce que les clients et les outils les connaissent. Et aucune des deux n'oblige à quoi que ce soit : ce sont des **avis**. La RFC 9745 dit dans sa section 5 que déprécier une ressource ne change pas son comportement : celui qui l'utilise peut continuer à l'utiliser de la même façon. La RFC 8594, dans sa section 3, dit que les clients **devraient** traiter `Sunset` comme une indication : rien ne garantit que la ressource fonctionne jusqu'à cette date, ni qu'elle cesse de fonctionner après.

À ces deux-là s'ajoute un lien : la RFC 9745 enregistre la relation `deprecation` pour l'en-tête `Link` (section 3), qui pointe vers la documentation de la dépréciation, par exemple le guide de migration. Voici comment répond la `/v1` du `revisor` :

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

Les données sont celles du service 1, dans l'ancien format : `direccion` au lieu de `url`, et `"limite":3`, les 3000 ms qu'a laissés la requête « rapide » de la course de 3.3.4, maintenant en secondes. Et les trois en-têtes figurent dans toutes les réponses de la `/v1`, la consultation et la liste : la dépréciation concerne la ressource dans laquelle apparaît l'en-tête (section 2.2 de la RFC 9745), de sorte que chaque route dépréciée le porte.

#### 3.8.2 La règle de l'ordre : `Sunset` jamais avant `Deprecation`

Les deux dates racontent une histoire dans l'ordre : d'abord la version **cesse d'être recommandée** (dépréciation) et, plus tard, **cesse de répondre** (retrait). La [section 4 de la RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html#section-4) en fait une règle avec un **ne doit pas** : la date de `Sunset` ne doit pas être antérieure à celle de `Deprecation`. Si elle l'est (à cause d'une erreur de configuration, dit la RFC), celui qui développe le client devrait consulter celui qui exploite la ressource pour clarifier la situation.

La règle a du sens même si les deux sont des avis. Un retrait antérieur à la dépréciation dirait « cette version cesse de répondre lundi, et elle est dépréciée vendredi », ce qui est une contradiction : personne n'aurait le temps de migrer entre un avis et l'autre, car le second arrive quand il n'y a plus rien. La RFC 8594 l'explique de l'autre côté dans sa section 1.4 : la dépréciation se produit généralement en deux étapes, d'abord « ce n'est plus la version recommandée », puis « elle est mise hors service », et `Sunset` ne sert que pour la seconde.

Dans le `revisor`, la `/v1` a été dépréciée le 1er juillet 2026 (`@1782864000`) et cesse de répondre le 31 janvier 2027 : sept mois de marge. L'exercice 4 te demande de le vérifier avec un programme, ce que devrait faire tout client qui lit ces avis.

#### 3.8.3 Et à la fin, le `410`

Lorsque la date arrive, la version est retirée et se met à répondre `410`. C'est ce qui est déjà arrivé à la `/v0` :

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

`410` avec n'importe quel identifiant et aussi sans aucun, sur toute route qui commence par `/v0`. Remarque que la question « est-ce `/v0` ? » se pose au point d'entrée **avant** l'identifiant, à côté des anciennes redirections : une version retirée n'a rien à protéger, et un vieux client qui ne sait même pas s'authentifier avec le schéma actuel mérite de savoir que la version est partie, pas qu'il lui manque un identifiant. Le corps dit quand elle a été retirée et où aller. C'est le même raisonnement que celui du `410` d'un service, en grand : le client ne doit pas fouiller son code à la recherche d'une erreur d'adresse ; il doit migrer.

Le `410` est la fin de l'histoire, pas le début. Une API qui retire une version en répondant `410` dès le premier jour où quelqu'un apprend son retrait a fait les choses à l'envers : le `410` arrive **après** des mois de `Deprecation` et de `Sunset` dans chaque réponse, et d'un lien vers le guide de migration. La Leçon 8 documente ces avis dans la description OpenAPI de l'API, avec `deprecated: true` sur ce qui est retiré.

### 3.9 Le `revisor` complet

#### 3.9.1 Les fichiers qui changent

Le `revisor` de cette leçon vit dans le dossier `~/curso-http/fig03_01/`. Si tu as le dossier de la Leçon 2, copie-le sous ce nom et modifie quatre fichiers : un nouveau, `versiones.ts`, et trois modifiés, `almacen.ts`, `rutas.ts` et `servicios.ts`. Ils figurent ici en entier.

`versiones.ts` est nouveau. Il contient les deux anciennes versions : la `/v1`, avec ses trois avis dans `AVISOS` et son ancienne façon de représenter un service, et la `/v0`, qui répond `410` à tout :

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

Dans `almacen.ts`, il y a trois nouvelles fonctions et une modifiée : `retirarServicio` ne se contente plus de supprimer, elle **se souvient** aussi du retrait dans `retirados`, avec l'équipe ; `equipoDeRetirado` le consulte ; `buscarPorNombre` cherche un nom au sein d'une équipe, pour le `409` ; et `cambiarServicio(id, versionLeida, datos)` compare la version et applique le changement en une seule étape, sans `await` (3.3.4) : si la version n'est plus celle qui a été lue, elle renvoie `"conflicto"` ; si c'est bien elle, elle écrit et **fait monter la version**, ce qui invalide l'ancienne étiquette :

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

Dans `rutas.ts`, trois choses changent : la route `/servicios/{id}` admet désormais `PUT` (et c'est pourquoi l'`Allow` d'un `405` sur cette route devient `GET, HEAD, PUT, DELETE`) ; il y a deux nouvelles routes pour la `/v1`, en lecture seule ; et avant de chercher la route, `versionRetirada` s'occupe de la `/v0` :

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

Et `servicios.ts`, où se trouve presque tout ce qui concerne cette leçon : `encontrar` (3.7.2), `validar` et `rechazarDatos` (3.6.1), le `409` dans `darDeAlta` et `cambiar` (3.5.1), `esJson`, qui sépare du lecteur de JSON la question du format pour que le `PUT` la pose avant la condition (3.1.3), et `cambiar` avec son `415`, son `428`, son `412` pour étiquette périmée (3.3.3) et son second `412`, celui de la course (3.3.4), ou son `410` si le service a été retiré dans l'intervalle (3.7.3). `encontrar` est désormais exportée parce que `versiones.ts` l'utilise aussi. `representar` est elle aussi exportée, même si dans cette leçon aucun autre fichier ne l'importe : la `/v1` a sa propre `representarV1` :

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

Remarque l'ordre à l'intérieur de `darDeAlta` et de `cambiar` : d'abord `validar` (`422`), puis la destination (`422` aussi), et enfin le nom en double (`409`). Les règles sur les données passent avant le heurt avec l'état : cela ne sert à rien de chercher s'il existe déjà un service portant un nom qui, de toute façon, n'est pas valide.

#### 3.9.2 Les fichiers qui ne changent pas

Les autres fichiers sont ceux de la Leçon 2, sans le moindre changement. Ils figurent en entier pour que le `revisor` puisse être monté à partir de cette leçon. `etiquetas.ts` est celui qui fait la comparaison forte qu'utilise `cambiar` :

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

#### 3.9.3 L'exécution complète

Ouvre deux terminaux dans `~/curso-http/fig03_01/`. Dans le premier, le laboratoire ; dans le second, le `revisor` :

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Dans un troisième terminal, voici toutes les requêtes des sections 3.2 à 3.8, dans l'ordre où elles sont apparues, avec ce qu'elles ont répondu. Elles sont réunies pour que tu puisses les comparer d'un trait avec les tiennes ; rappelle-toi que les étiquettes se termineront différemment :

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


Trente et une lignes. Les vingt-quatre réponses complètes, celles de `curl -i`, ont donné `[200 200 412 412 200 200 428 409 409 201 422 400 422 422 422 204 410 404 404 410 200 200 410 410]` ; la course de 3.3.4 a donné `rápida: 200` et `lenta: 412` ; celle de 3.7.3, `DELETE en el hueco: 204` et `lento: 410` ; et les cinq lignes qui gardent une étiquette (`ETAG` deux fois, `VIGENTE`, et `ID` avec `ETAG` en 3.7.3) ou qui lisent le service sans `-i` n'impriment pas le code. Chaque erreur de cette leçon est arrivée **après** avoir passé les sept questions du point d'entrée de la Leçon 2 : toutes avaient la bonne route, la bonne méthode, le bon identifiant et la bonne permission, et pourtant elles ne pouvaient pas être satisfaites.

Le terminal du `revisor` a noté chaque requête, dans le même ordre :

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

## L'erreur que tu vas voir

### Les deux `200` qui n'auraient pas dû sortir

Les deux versions défectueuses les plus importantes de cette leçon, tu les as déjà provoquées dans le corps de la leçon, parce qu'elles en sont le cœur : le `PUT` qui ne demande rien (3.2.2) et celui qui ne demande qu'une fois (3.3.4). Les deux échouent de la même façon, et il vaut la peine de dire exactement ce qui ne va pas dans la réponse, car cela ne se voit dans aucun en-tête : c'est un `200` qui promet quelque chose de faux. Un `200` à un `PUT` dit au client « ton changement a été appliqué sur ce que tu as lu ». Dans les deux défauts, le second `200` a été appliqué sur quelque chose que son client n'a jamais vu, et a effacé un changement d'autrui. Le correctif est lui aussi le même dans les deux cas, en deux parties : exiger et comparer la condition avant de lire le corps (`428` et `412`), et comparer à nouveau la version à l'instant même où l'on écrit (`412` de nouveau). Il en manque une des deux, et la scène du début revient.

### Le `410` qui trahit

Le second défaut est plus subtil, parce qu'il naît de la volonté de bien faire. Quelqu'un lit la section 15.5.11, décide que tout service retiré mérite son `410`, et simplifie la condition d'`encontrar` en lui retirant la comparaison de l'équipe (version complète dans `defectos/410-para-todos/servicios.ts`) :

```ts
  if (servicio === undefined && equipo !== undefined) {
    fallar(respuesta, 410, `el servicio ${id} se retiró y no va a volver`);
```

**Série E :** crée `rota/` à partir de zéro (`rm -r rota && cp -R fig03_01 rota`), place cette version dans `rota/servicios.ts` et démarre le laboratoire et le `revisor` depuis `rota/`. L'équipe a retire son service 2, et l'équipe b interroge le 2 et le 99 :

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

L'équipe b n'a jamais eu accès au service 2, mais elle sait maintenant qu'il a existé et qu'il n'existe plus ; et elle sait que le 99 n'a jamais existé. C'est l'énumération de l'encadré de la Leçon 2, par une nouvelle porte : deux réponses différentes pour deux identifiants appartenant à autrui. Avec un script comme l'énumérateur de la Leçon 2, l'équipe b pourrait parcourir les identifiants et savoir combien de services chaque équipe a retirés. Le correctif consiste à rendre à la condition son `delEquipo(equipo, credencial)` : le `410` est pour celui qui pouvait voir la ressource quand elle existait, et pour les autres, le même `404` que d'habitude.

## Ce qui se fait de travers

**`400` pour tout ce qui ne peut pas être satisfait.** Le client ne peut pas distinguer « ton JSON est cassé » de « ton nom est en double » de « tu as écrit sur une version périmée », et chacun se corrige différemment. Si l'API décide d'utiliser `400` aussi pour la validation, comme le recommandent certains guides, que le conflit (`409`) et la précondition (`412`) aient au moins leur propre code.

**Un `PUT` sans condition sur une ressource partagée.** C'est la mise à jour perdue qui attend de se produire. Elle n'échoue pas dans les tests, parce que les tests n'ont presque jamais deux éditeurs à la fois ; elle échoue en production, en silence, avec un `200` pour chacun.

**Comparer la version seulement au début.** Si entre la comparaison et l'écriture il y a quelque chose qui attend (lire le corps, interroger le DNS, appeler un autre service), une autre requête avec la même étiquette passe aussi, et la dernière à écrire écrase l'autre avec un `200`. La version se compare à nouveau à l'instant même où l'on écrit, comme un `UPDATE … WHERE version = N`.

**Comparer `If-Match` en comparaison faible, ou comme du texte.** En faible, `W/"1-2-…"` passerait pour bonne, et la spécification l'interdit avec un **doit**. Comme du texte, une liste `"9-9", "1-2-…"` ou un `*` donneraient `412` même si la condition est remplie.

**`409` quand `If-Match` échoue.** Le client a posé une condition dans un en-tête et elle n'a pas été remplie : c'est un `412`. Le `409` est pour le heurt avec l'état que le client n'a pas exprimé comme condition, ou pour le cas où la version voyage dans le corps.

**`412` quand `If-Match` manque.** Sans condition, rien n'a échoué. Le client qui reçoit `412` croit que quelqu'un a modifié la ressource et relit en cherchant le changement d'autrui ; avec `428`, il sait qu'il lui manquait seulement d'envoyer l'étiquette.

**Un `409` qui ne dit pas avec quoi il heurte.** La section 15.5.10 demande que le corps permette de reconnaître l'origine du conflit. « Conflit » tout court laisse le client deviner quel champ changer.

**N'envoyer que le premier échec de validation.** Trois allers-retours pour corriger trois champs, alors qu'un `422` avec la liste complète le réglait en un.

**`410` pour tous, ou `404` pour toujours.** Le premier révèle ce qui a existé à qui ne pouvait pas le voir ; le second oblige le propriétaire d'une ressource retirée volontairement à chercher une erreur d'adresse.

**Retirer une version sans prévenir, ou avec les avis à l'envers.** Un `410` sans des mois préalables de `Deprecation` et de `Sunset` se découvre en production. Et un `Sunset` antérieur à la `Deprecation` viole la section 4 de la RFC 9745 et ne laisse à personne le temps de migrer.

**Présenter `Deprecation` ou `Sunset` comme des obligations.** Ce sont des avis que le client peut lire ; la ressource dépréciée se comporte comme avant, et la date de `Sunset` est une indication. Un client bien conçu les enregistre et alerte celui qui le maintient ; il ne cesse pas de fonctionner parce qu'il les voit.

## Exercices

Les quatre se corrigent tout seuls : chacun se termine par une exécution qui te dit si tu as juste. Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** de lancer quoi que ce soit. Ils forment la **série F** : pour tous, tu as besoin du laboratoire et du `revisor` de 3.9 en cours d'exécution, tout juste démarrés, et les quatre se lancent dans l'ordre, l'un après l'autre, sans redémarrer entre eux sauf là où l'exercice le demande.

### Exercice 1 — Conflit, règle ou précondition ?

Sans rien lancer, prédis le code de chacune de ces neuf requêtes, et pour chaque erreur dis s'il s'agit d'un conflit d'état, d'une règle métier, d'une précondition, ou de quelque chose que le point d'entrée de la Leçon 2 ou la section 3.7 réglait déjà. Le nom de la deuxième compte 41 x :

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

La quatrième et la cinquième ont un piège : chacune comporte deux problèmes. Lequel est posé en premier ?

### Exercice 2 — L'étiquette qui n'a pas survécu au redémarrage

Garde l'étiquette du service 1 dans une variable, **arrête le `revisor` et redémarre-le** (`Ctrl`+`C` puis `node servidor.ts`), et envoie un changement avec l'étiquette d'avant :

```bash
ANTES=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "ANTES=$ANTES"
# aquí detienes y vuelves a arrancar el revisor
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $ANTES" -d '{"nombre":"catalogo","url":"http://127.0.0.1:18081/codigo/200","limite_ms":1500}'
```

Prédis le code. Ensuite réponds à deux questions. Personne n'a modifié le service 1 entre la lecture et l'écriture : pourquoi est-il correct que le `revisor` refuse ? Et qu'aurait de mal un corps qui dirait seulement « alguien cambió el servicio » ?

### Exercice 3 — Deux échecs dans une requête

Sans redémarrer, garde l'étiquette en vigueur du service 1 dans `AHORA` et envoie deux changements avec le même corps invalide : l'un avec une étiquette inventée et l'autre avec celle en vigueur. À la fin, relis l'étiquette :

```bash
AHORA=$(curl -sS -o /dev/null -w '%header{etag}' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'); echo "AHORA=$AHORA"
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H 'If-Match: "1-7-00000000"' -d '{"nombre":"","url":"ftp://archivos"}'
curl -i -X PUT http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -H "If-Match: $AHORA" -d '{"nombre":"","url":"ftp://archivos"}'
curl -sS -o /dev/null -w '%header{etag}\n' http://127.0.0.1:18080/servicios/1 -H 'Authorization: Bearer escritura-a'
```

Prédis les deux codes et si l'étiquette de la fin est identique à `AHORA`. Pourquoi le premier ne mentionne-t-il pas le nom vide ?

### Exercice 4 — Lis les avis avec un programme

Écris un programme, `fig03_03.ts`, qui demande une route du `revisor` avec `lectura-a` et dise : depuis quand elle est dépréciée, quand elle cesse de répondre, où lire plus, et si les deux dates sont dans l'ordre qu'exige la section 4 de la RFC 9745. Si la route ne porte aucun avis, qu'il le dise. Teste-le avec `/v1/servicios` et avec `/servicios`. Indice : la valeur de `Deprecation` est `@` suivi de secondes, et `new Date(texto)` de JavaScript comprend le format de `Sunset`.

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

Dans l'ordre :

1. **`409`, conflit d'état.** `catalogo` est un nom valide ; il en existe déjà un dans l'équipe a.
2. **`422`, règle métier.** Le nom compte 41 caractères ; la règle dit de 1 à 40. Aucun état du serveur ne le rendrait valide.
3. **`412`, précondition.** La condition ne coïncide pas avec l'étiquette en vigueur (`"1-1-00000000"` n'est pas la tienne ; la tienne se termine par les huit chiffres de ce démarrage).
4. **`415`, pas `428`.** Il manque deux choses, le format et la condition. Le format se connaît par un en-tête, `Content-Type`, sans traiter le corps, et la section 13.2.1 demande que ce qui est détecté avant de traiter le contenu l'emporte sur les préconditions. Si le client corrige le `Content-Type`, la réponse suivante sera `428`.
5. **`415`, pas `412`.** Cette fois la condition est bien là, et en plus elle est périmée (`"1-0-0"` n'est aucune version du service). Peu importe : le mauvais format se sait en premier, et avec lui le `revisor` n'évalue même pas `If-Match`. Si le client corrige le `Content-Type`, la réponse suivante sera `412`.
6. **`404`, le point d'entrée de la Leçon 2.** Le service 3 appartient à l'équipe b ; pour l'équipe a, il n'existe pas.
7. **`410`, version retirée.** Sans identifiant : la `/v0` est traitée avant de demander qui tu es.
8. **`204`.** L'équipe b retire son service 3.
9. **`404`, pas `410`.** Le service 3 a été retiré, mais il appartenait à l'équipe b. Pour l'équipe a, il n'a jamais existé, et n'existe toujours pas : le `410` est réservé au propriétaire.

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

`412`, et c'est correct : l'étiquette que le client envoie n'est pas celle en vigueur. Après le redémarrage, le service 1 a l'étiquette `"1-1-…"` avec huit autres chiffres, parce que le `revisor` tire au sort un nouvel identifiant à chaque démarrage. La spécification ne demande pas au serveur de savoir **pourquoi** l'étiquette ne coïncide pas ; elle lui demande de ne pas exécuter la méthode si elle ne coïncide pas. Et l'action que le code indique au client, relire et refaire son changement sur ce qu'il trouve, est la bonne : le `revisor` qui a servi sa lecture n'existe plus, et ce que le client croyait savoir de lui non plus. Sur un serveur avec base de données, le service aurait survécu au redémarrage, mais sur celui-ci, qui garde tout en mémoire, rien ne garantit que le service 1 d'aujourd'hui soit le même que celui d'avant.

Un corps qui dirait seulement « alguien cambió el servicio » serait **faux** dans ce cas : personne n'y a touché. C'est pourquoi le `revisor` donne les deux causes possibles, « el servicio cambió o el revisor se reinició », et l'action, « vuelve a leerlo antes de cambiarlo ». Le code décide quoi faire ; le corps, si une personne le lit, ne l'envoie pas chercher un changement qui n'existe pas. Pour vérifier que la nouvelle étiquette fonctionne bien, lis-la et utilise-la : c'est la première chose que fait l'exercice 3.

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

Le premier est un **`412`** : la condition est évaluée avant de lire le corps (section 13.2.1), et comme elle n'est pas remplie, le corps n'est même pas examiné. C'est pourquoi il ne mentionne pas le nom vide : dire au client que son nom est faux ne lui sert à rien si ce qu'il doit faire d'abord, c'est relire ; quand il relira, le service aura peut-être un autre nom et son changement tout entier sera autre. Le second est un **`422`** : la condition est remplie, le corps est lu, et les deux échecs apparaissent ensemble, comme le demande la politique de 3.6.1. Et l'étiquette de la fin **est identique à `AHORA`** : aucun des deux `PUT` n'a rien changé, donc la version n'a pas monté. Un changement rejeté n'use pas l'étiquette ; le client peut corriger ses données et la renvoyer.

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

`await respuesta.body?.cancel()` écarte le corps sans le lire, car le programme n'a besoin que des en-têtes. L'expression régulière `^@(-?\d+)$` accepte exactement la forme de date des champs structurés ; toute autre chose est signalée comme invalide, au lieu d'être convertie en une date quelconque. Avec `Sunset`, il se passe la même chose, pour une raison plus subtile : `new Date("proximo-mes")` ne lance aucune erreur, il produit une date invalide, et c'est `toISOString()` qui lance ensuite `RangeError: Invalid time value` et fait planter le programme. C'est pourquoi le programme demande `Number.isNaN(hasta.getTime())` avant de l'utiliser. Testé contre un serveur jouet qui répondait `Sunset: proximo-mes`, le programme ne plante pas : il imprime `Sunset no es una fecha válida: proximo-mes`, puis `desaprobada desde: 2026-07-01T00:00:00.000Z` et `deja de responder: (no lo dice)`, et se termine avec le code 0. Et la comparaison finale est la règle de la section 4 de la RFC 9745 : si un jour la configuration de la `/v1` place un `Sunset` antérieur à la `Deprecation`, le programme le dit au lieu de se taire. Un client réel ferait de cela quelque chose de plus utile que l'imprimer : l'enregistrer dans son journal et prévenir celui qui le maintient, une fois, pas à chaque requête.

## Comment savoir que tu as réussi

- [ ] Pour une requête qui échoue, tu dis s'il s'agit d'un conflit d'état, d'une règle métier ou d'une précondition, et tu réponds `409`, `422` ou `412` avec la question qui la tranche.
- [ ] `node fig03_02.ts` contre le `revisor` de 3.9 se termine par « el cambio de Ana sigue ahí », et contre `rota/` sans la condition, par « SE PERDIÓ el cambio de Ana ».
- [ ] La course de 3.3.4 donne `rápida: 200` et `lenta: 412` et laisse `"limite_ms":3000` contre le `revisor` de 3.9, et `200` et `200` avec `"limite_ms":1000` contre la copie qui passe `null` à `cambiarServicio`.
- [ ] Un `PUT` vers `/servicios/1` sans `If-Match` donne `428` avec un corps qui dit quel en-tête envoyer ; avec une étiquette périmée il donne `412` ; avec `W/` devant celle en vigueur il donne `412` avec l'avis qu'elle est faible ; avec une liste qui la contient, ou avec `*`, il donne `200` et une nouvelle `ETag`.
- [ ] Un `PUT` avec `Content-Type: text/plain` donne `415`, avec une étiquette périmée ou sans aucune.
- [ ] Un enregistrement de `pagos` avec `escritura-a` donne `409` et dit avec quel service il heurte ; la même requête avec `escritura-b` donne `201`.
- [ ] Un enregistrement avec `{"nombre":"","url":"ftp://archivos","limite_ms":5}` donne `422` avec trois lignes, et un avec `["inventario"]` donne `400`.
- [ ] Après avoir retiré le service 2, l'équipe a reçoit `410` et l'équipe b reçoit `404`, avec le même corps que celui d'un service qui n'a jamais existé.
- [ ] `/v1/servicios/1` porte `Deprecation`, `Sunset` et `Link`, et `node fig03_03.ts /v1/servicios` dit que l'ordre est correct ; `/v0/servicios` donne `410` sans identifiant.
- [ ] À la fin, aucun programme ne reste en écoute : `curl -i http://127.0.0.1:18080/` renvoie l'erreur 7.

## Résumé

Réponds sans consulter la leçon :

1. Quelle question départage `409`, `412` et `422` ? Donne un exemple du `revisor` pour chacun.
2. Qu'est-ce que la mise à jour perdue, et à laquelle des quatre étapes se produit-elle ?
3. Si le `revisor` a déjà comparé `If-Match` au début, pourquoi compare-t-il à nouveau la version à l'écriture ? Quel est l'équivalent dans une base de données ?
4. Pourquoi `If-Match` se compare-t-il en comparaison forte, et que répond le `revisor` à une étiquette `W/` qui, en comparaison faible, coïnciderait ?
5. Que doit faire un client après un `412`, et que doit-il faire après un `428` ? Pourquoi n'est-ce pas la même chose ?
6. Pourquoi la condition est-elle évaluée avant de lire le corps ? Quelle section de la RFC 9110 le dit ?
7. Quand une mise à jour perdue se répond-elle par `409` et non par `412` ?
8. Quelle est la politique du cours pour `400` face à `422`, et que décident les autres guides ?
9. Que dit un `410` que ne dit pas un `404` ? Pourquoi le `revisor` ne le dit-il pas à tout le monde ?
10. Quelle date donne `Deprecation`, laquelle donne `Sunset`, quel poids a chaque RFC, et quelle règle relie les deux dates ?

## Sources

Toutes ont été consultées le 21 octobre 2026.

1. [RFC 9110, *HTTP Semantics*, section 15.5.10](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10) : le `409`, le conflit avec l'état actuel que l'utilisateur peut résoudre, le contenu qui permet de reconnaître son origine et l'exemple des versions dans un `PUT`.
2. [RFC 9110, section 15.5.11](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.11) : le `410`, la condition probablement permanente, le retrait intentionnel, le cache par heuristique et la liberté de ne pas le marquer pour toujours.
3. [RFC 9110, section 15.5.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.5) : le `404` ne dit pas si l'absence est temporaire ou permanente, et l'on préfère le `410` quand le serveur sait qu'elle est permanente.
4. [RFC 9110, section 15.5.13](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.13) : le `412`, une condition des en-têtes qui s'est révélée fausse.
5. [RFC 9110, section 13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.1) : `If-Match`, sa forme (`*` ou une liste), la comparaison forte obligatoire, les trois étapes d'évaluation et la mise à jour perdue (*lost update*).
6. [RFC 9110, sections 13.2.1 et 13.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.2.1) : quand les préconditions sont évaluées (avant de traiter le contenu, après les vérifications normales) et dans quel ordre.
7. [RFC 9110, section 8.8.3.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.3.2) : la comparaison forte et la comparaison faible des étiquettes, avec son tableau.
8. [RFC 9110, section 15.5.21](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.21) : le `422`, contenu compris et à la syntaxe correcte mais qui ne peut pas être traité ; et la [section 9.3.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.4), `PUT` comme remplacement de l'état complet.
9. [RFC 6585, *Additional HTTP Status Codes*, section 3](https://www.rfc-editor.org/rfc/rfc6585.html#section-3) : le `428`, la requête conditionnelle exigée contre la mise à jour perdue, l'explication de la manière de la renvoyer et l'interdiction de le stocker dans un cache.
10. [RFC 9745, *The Deprecation HTTP Response Header Field*](https://www.rfc-editor.org/rfc/rfc9745.html) (mars 2025, standard proposé) : la date de dépréciation comme date de champ structuré (2.1), sa portée (2.2), la relation `deprecation` pour `Link` (3), la règle selon laquelle `Sunset` ne doit pas être antérieur (4) et le fait que déprécier ne change pas le comportement (5).
11. [RFC 8594, *The Sunset HTTP Header Field*](https://www.rfc-editor.org/rfc/rfc8594.html) (mai 2019, informatif) : la date à laquelle la ressource cessera probablement de répondre, comme indication (3), et les deux étapes de la dépréciation (1.4) ; sa [fiche dans le datatracker de l'IETF](https://datatracker.ietf.org/doc/rfc8594/), qui la présente comme une proposition individuelle.
12. [RFC 9457, *Problem Details for HTTP APIs*, section 3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3) : l'exemple avec l'extension `errors` et un `pointer` par champ, que la Leçon 5 adopte pour le `422`.
13. [Registre des codes d'état HTTP de l'IANA](https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml) : les noms officiels des cinq codes, dont `422 Unprocessable Content` et `428 Precondition Required`.
14. [*Zalando RESTful API Guidelines*](https://opensource.zalando.com/restful-api-guidelines/) : `400` aussi pour la validation métier et `422` comme « à ne pas utiliser » ; `412` pour la concurrence optimiste avec `If-Match` et `428` pour l'exiger.
15. [Google, AIP-154 *Resource freshness validation*](https://google.aip.dev/154) et [`google.rpc.Code`](https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto) : l'étiquette comme champ de la ressource, `ABORTED` (`409`) lorsqu'elle ne coïncide pas et `INVALID_ARGUMENT` (`400`) pour les arguments invalides ; et la [documentation de l'API REST de GitHub](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api), qui répond `422` à la validation et aux valeurs en double (`already_exists`).

### Termes de cette leçon

| | |
|---|---|
| **mise à jour perdue** (*lost update*) | lorsqu'un client enregistre sa vieille copie d'une ressource et efface, sans le savoir, le changement qu'un autre a fait après sa lecture |
| **concurrence optimiste** | laisser tout le monde lire et éditer sans verrou, et ne rejeter que l'écriture qui arrive sur une version périmée |
| **conflit d'état** | une requête valide qui heurte ce qui existe déjà sur le serveur ; dans un autre état, elle fonctionnerait telle quelle (`409`) |
| **déprécié** (*deprecated*) | dont l'usage n'est plus recommandé, même s'il fonctionne encore |
| **précondition** | une condition que le client pose dans un en-tête (`If-Match`) pour que la méthode ne s'exécute que si elle est remplie (`412` sinon) |
| **règle métier** | une condition sur les valeurs des données, qui ne dépend pas de l'état du serveur (`422` si elle n'est pas remplie) |
| **retrait** (*sunset*) | le moment où une ressource ou une version cesse de répondre |

---

**Précédent :** [Leçon 2 — Le client s'est trompé (I) : 400, 401, 403, 404, 405 et 415](02-errores-del-cliente-peticion.md) · **Suivant :** [Leçon 4 — Capacité et défaillances du serveur : 429, 500, 502, 503 et 504](04-capacidad-y-fallas-del-servidor.md)

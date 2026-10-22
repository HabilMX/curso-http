# Leçon 4 — Capacité et défaillances du serveur : 429, 500, 502, 503 et 504

Nous sommes vendredi, dernier jour du mois, et il est 19 h 05. Le service de facturation de l'équipe `a` s'est mis à répondre des choses étranges il y a vingt minutes, et le tableau de bord alimenté par le `revisor` est passé au rouge. Quelqu'un de l'équipe des paiements, nerveux, a ouvert le tableau de bord et a cliqué sur « vérifier maintenant » encore et encore ; son navigateur s'est mis à répéter la requête toutes les demi-secondes, et chaque répétition oblige le `revisor` à sortir sur le réseau pour interroger un service qu'il sait déjà en panne. À 19 h 12, la personne d'astreinte demande le rapport du service de catalogue et reçoit un `500` dont le corps est une trace de pile (stack trace) avec le dossier complet du serveur, le nom de chaque fichier et la version de Node utilisée. Quelqu'un copie ce corps dans le canal public de support pour demander de l'aide. À 19 h 20 arrive la question à laquelle personne ne peut répondre : **la faute est-elle à nous ou à eux ?** Le `revisor` répond `500` quand son propre code échoue, `500` quand le service de facturation renvoie n'importe quoi et `500` quand celui des rapports met trop de temps. Avec un seul numéro pour trois pannes différentes, personne ne sait qui réveiller.

Cette leçon donne au `revisor` un numéro distinct pour chacune de ces situations, et lui apprend à taire ce qui ne doit pas sortir.

**Durée :** 2 × 45 min (la coupure se situe entre les sections 4.4 et 4.5)

**Ce que tu construis :** le filet de sécurité complet pour l'erreur inattendue (un `500` avec une référence, et la trace de pile uniquement dans le terminal de la personne qui exploite le service), une consultation en direct, `GET /servicios/{id}/salud`, dans laquelle le `revisor` joue le rôle de passerelle et distingue une dépendance lente (`504`) d'une dépendance qui ne répond pas en HTTP (`502`), un mode maintenance qui répond `503` avec `Retry-After`, et une limite par identifiant pour tout ce qui fait sortir le `revisor` sur le réseau (les vérifications et la consultation en direct), qui répond `429`

**Ce que tu apprends :** à répondre, pour chaque panne, **qui est en tort et qui peut la corriger** ; `Retry-After` sous ses deux formes, en secondes ou en date ; `500` face à `502` face à `504` ; `503` face à `500` ; pourquoi le `429` est un `4xx` alors qu'il parle de capacité ; **ce que l'on dit et ce que l'on ne dit jamais** dans une erreur du serveur (traces de pile, requêtes, chemins, secrets) ; et, dans les encadrés de sécurité, ce qu'on ne dit jamais dans une erreur et le `429` comme défense contre l'énumération et l'épuisement des ressources, ainsi que la raison pour laquelle la force brute sur les identifiants se bloque à une autre couche

**D'où tu viens.** De la [Leçon 3](03-errores-del-cliente-estado.md), avec un `revisor` qui distingue déjà les erreurs d'état du client (pas tout le registre des `4xx` de l'IANA, mais ceux que le cours traite) : le conflit, la règle métier et la précondition, la mise à jour perdue, la version retirée. Ce `revisor` ne plante plus quand un gestionnaire lève une exception : depuis la Leçon 1, `atenderSinCaerse` l'attrape et répond `500 error interno`. Mais c'est un filet minimal : le `500` ne fournit rien qui permette de retrouver l'erreur dans le terminal, et personne ne t'a encore expliqué ce que signifie ce code. Il n'existe pas non plus de moyen de le mettre en maintenance, ni de freiner celui qui demande des vérifications sans arrêt, ni de lui demander en direct comment va un service.

**Ce que cette leçon ne fait pas.** Elle ne change pas la forme des corps d'erreur : ils restent une ligne de texte, et la [Leçon 5](05-problem-details.md) les convertit en `application/problem+json`. Elle ne réessaie rien : le `revisor` lit `Retry-After` et le consigne dans le résultat d'une vérification, mais le backoff exponentiel et la décision de réessayer relèvent de la [Leçon 6](06-reintentos-idempotencia.md), et la table qui décide quoi faire avec chaque code relève de la [Leçon 7](07-quien-lee-el-error.md). Elle n'enseigne pas les en-têtes `RateLimit-*`, parce qu'ils sont encore un brouillon de l'IETF et non un standard (section 4.6.5). Et elle ne simule pas un véritable répartiteur de charge : la passerelle de cette leçon est le `revisor` lui-même, qui interroge un service et te raconte ce qui s'est passé.

**À propos des exécutions.** Linux Mint 22 est le système de référence du cours. Les sorties de cette leçon ont été obtenues le 21 octobre 2026 sous macOS avec Node 24.14.1 et curl 8.7.1, sur une machine réglée sur le fuseau horaire du centre du Mexique (UTC−6) ; une seule sortie dépend de ce fuseau, celle de l'exercice 2, et la solution explique pourquoi. La machine avait d'autres programmes sur les ports du cours, si bien que le laboratoire et le `revisor` ont été démarrés sur les ports 18481 et 18480, et dans les sorties ils ont été réécrits en 18081 et 18080 ; les longueurs ne changent pas, car les deux nombres ont cinq chiffres. Dans ton exécution, plusieurs choses vont changer : la date de l'en-tête `Date`, la référence de chaque `500` (un identifiant aléatoire, différent à chaque erreur), les millisecondes mesurées, les huit derniers chiffres de chaque `ETag`, et le `Retry-After` d'un `429`, qui dépend du temps écoulé depuis la première requête de la fenêtre. Quand le terminal du `revisor` affiche une trace de pile, le dossier de la machine s'écrit `<carpeta>` : les chemins d'une machine ne se publient pas, et la section 4.3.4 explique pourquoi. Le `revisor` garde tout en mémoire : redémarre-le avant chaque série de requêtes pour obtenir la même chose que la leçon. Les programmes se trouvent dans [`programas/04-capacidad-y-fallas-del-servidor/`](../programas/04-capacidad-y-fallas-del-servidor), dans le dépôt du cours : le `revisor` dans `fig04_01/`, la fenêtre fixe observée de près dans `fig04_02.ts`, le lecteur de `Retry-After` dans `fig04_03.ts`, les versions défectueuses de « L'erreur que tu vas voir » dans `defectos/`, les solutions qui comportent du code dans `ejercicios/`, et chaque exécution dans son fichier `.salida.txt`. Tous passent `tsc` en mode strict avec la commande de la section 4.7.4.

## À la fin, tu seras capable de

- Dire, pour une panne donnée, qui est en tort, qui peut la corriger et quel code lui correspond : `429`, `500`, `502`, `503` ou `504`.
- Provoquer un `500` dans le `revisor` et retrouver sa trace de pile dans le terminal à partir de la référence reçue par le client.
- Distinguer par une exécution un `502` d'un `504`, et expliquer pourquoi un service en panne qui répond `503` produit un `200` dans la consultation de santé.
- Lire un `Retry-After` sous ses deux formes, en secondes ou en date HTTP, et indiquer quelles valeurs ne sont pas valides selon la RFC 9110.
- Expliquer pourquoi une fenêtre fixe de 3 requêtes par seconde peut laisser passer 5 requêtes en moins de 70 millisecondes, avec l'exécution qui le montre.
- Énumérer ce qu'on ne dit jamais dans une erreur du serveur et démontrer par une exécution ce que révèle une trace de pile qui voyage dans le corps.
- Démontrer par une exécution qu'une limite par identifiant, interrogée avant de chercher la ressource, freine celui qui essaie des identifiants les uns après les autres, et qu'une limite par ressource ne le freine pas.

## Le pourquoi avant le comment

Dans la Leçon 0, tu as vu la question qui sépare les deux familles d'erreurs : **qui s'est trompé ?** Si c'est celui qui a demandé, le code est un `4xx` ; si c'est celui qui répond, un `5xx`. Les Leçons 2 et 3 ont été consacrées à la première moitié. Cette leçon s'occupe de la seconde, et y ajoute une question qui compte autant que la première : **qui peut la corriger ?** Car « la faute est au serveur » ne dit à personne quoi faire. Le client a besoin de savoir s'il lui convient d'attendre, combien de temps, ou de renoncer. Celui qui exploite le service a besoin de savoir si le problème se trouve dans son code, dans sa configuration ou dans un service d'une autre équipe. Chaque code de cette leçon répond aux deux questions d'une manière différente :

| Code | Ce qui s'est passé | Qui est en tort | Qui peut le corriger | Ce que fait le client |
|---|---|---|---|---|
| `429` | tu as demandé plus que ce qui te revient dans un temps donné | le client, par son rythme | le client, en ralentissant | attendre ce que dit `Retry-After` |
| `500` | quelque chose d'inattendu s'est produit dans le code du serveur | le serveur | celui qui exploite le serveur, en corrigeant son code | ne pas insister sur la même chose ; signaler la référence |
| `502` | le serveur jouait le rôle de passerelle et ce qui se trouve derrière a répondu quelque chose d'invalide, ou la connexion n'a pas pu s'établir | ce qui se trouve derrière | celui qui exploite ce qui se trouve derrière | attendre, ou réessayer plus tard |
| `503` | le serveur ne peut pas répondre maintenant : maintenance ou surcharge | personne ne s'est trompé : c'est une décision ou une limite | le temps, ou celui qui exploite le service | attendre ce que dit `Retry-After` |
| `504` | le serveur jouait le rôle de passerelle et ce qui se trouve derrière n'a pas répondu à temps | ce qui se trouve derrière | celui qui exploite ce qui se trouve derrière | attendre, ou réessayer plus tard |

La scène d'ouverture comportait trois problèmes, et tous les trois tiennent dans cette table. Le navigateur qui répétait la requête toutes les demi-secondes avait besoin d'un `429`, qui lui dise « ralentis » et combien de temps attendre. Le rapport qui avait explosé avait besoin d'un `500` qui ne raconte rien de l'intérieur, plus une référence pour que la personne d'astreinte retrouve la trace de pile dans son terminal. Et la facturation en panne avait besoin d'un `502` ou d'un `504`, qui disent « le problème est derrière moi », pour que personne ne fouille le code du `revisor` à la recherche d'une erreur qui ne s'y trouvait pas. Avec un seul `500` pour tout, chacune de ces personnes a pris la mauvaise décision : le navigateur a continué d'insister, le corps de l'erreur a fini dans un canal public, et l'astreinte a cherché au mauvais endroit.

Remarque la première ligne : le `429` est un `4xx`, alors qu'il parle de capacité. C'est la seule exception apparente de la table, et ce n'en est pas une : celui qui peut le corriger, c'est le client, en réduisant son rythme, et c'est exactement ce que dit la famille `4xx`. Le serveur n'a pas échoué ; le client a demandé plus que ce qui était convenu. En revanche, le `503` est un `5xx` alors que le serveur « fonctionne » : le serveur ne peut pas répondre maintenant, pour une raison qui lui est propre, et aucune modification de la requête n'y change rien.

La table a une autre colonne qu'on ne voit pas, mais qui traverse toute la leçon : **ce que l'on dit**. Une erreur du serveur est le moment où une API est la plus tentée d'en dire trop, parce que celui qui a écrit le code veut voir ce qui s'est passé, et le plus rapide est d'envoyer l'exception complète dans la réponse. Ce qui sert à celui qui exploite le service (la trace de pile, la requête, le chemin du fichier) est précisément ce que ne doit pas voir celui qui a demandé. Le troisième principe du cours le dit : **ce qui sort vers l'extérieur se conçoit**.

La leçon comporte cinq parties :

1. **Le laboratoire et la question** (4.1 et 4.2) : les trois façons dont une dépendance tombe en panne sans répondre, et la question qui décide du code.
2. **Le `500`** (4.3) : la référence, la trace de pile dans le terminal et l'encadré de sécurité sur ce qu'on ne dit jamais.
3. **Le `revisor` comme passerelle** (4.4) : `502` et `504`, et pourquoi un `503` d'autrui est un `200` pour soi.
4. **La capacité** (4.5 et 4.6) : `503` avec `Retry-After` pour la maintenance et `429` pour la limite de requêtes, avec l'encadré de sécurité sur le `429` comme défense.
5. **Le `revisor` complet** (4.7) : les fichiers et l'exécution de tous les cas.

## Les concepts

### 4.1 Le `revisor` de cette leçon

#### 4.1.1 Ce qui change

Le `revisor` de cette leçon vit dans `~/curso-http/fig04_01/`. Si tu as le dossier de la Leçon 3, copie-le sous ce nom. Il y a treize fichiers : deux nouveaux, six qui changent et cinq qui restent comme ils étaient. La section 4.7 les présente tous en entier ; voici la carte, pour que tu saches où se trouve chaque chose pendant ta lecture :

| Fichier | Ce qui change | Section |
|---|---|---|
| `limitador.ts` | **nouveau** : combien de fois on peut faire quelque chose dans une fenêtre de temps | 4.6 |
| `operacion.ts` | **nouveau** : le mode maintenance et `PUT /mantenimiento` | 4.5 |
| `servidor.ts` | le filet minimal devient le filet complet : référence et trace de pile réduite | 4.3 |
| `cliente.ts` | `consultar` distingue quatre issues plus une, et lit `Retry-After` | 4.4 et 4.5 |
| `servicios.ts` | les routes `salud` et `informe`, et les limites de `pedirRevision` et `salud` | 4.3, 4.4 et 4.6 |
| `rutas.ts` | les nouvelles routes et l'arrêt pour maintenance | 4.5 |
| `laboratorio.ts` | trois routes pour échouer : `/lento/MS`, `/cortar` et `/basura` | 4.1.2 |
| `almacen.ts` | trois services de démarrage de plus, et `revisionesDe` | 4.1.2 et 4.3 |

`autenticacion.ts`, `destinos.ts`, `etiquetas.ts`, `respuestas.ts` et `versiones.ts` ne changent pas. Les corps d'erreur continuent de sortir de `fallar`, dans `respuestas.ts`, sous forme d'une ligne de texte.

#### 4.1.2 Trois façons d'échouer sans répondre

Pour provoquer un `502` et un `504`, il faut un service qui échoue **sans** répondre de code. Un service qui répond `503` ne convient pas : il a répondu, et sa réponse est du HTTP valide. Le laboratoire, qui est le banc d'essai de la Leçon 0 sur le port 18081, gagne trois routes qui échouent des trois façons dont échoue un vrai service quand il ne répond pas correctement :

```ts
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
```

- `/lento/MS` répond `200`, mais après `MS` millisecondes. C'est le service qui fonctionne, mais qui est lent : une base de données saturée, un processus resté à attendre un autre.
- `/cortar` ferme la connexion sans rien écrire. C'est le processus qui est tombé en panne en pleine requête, ou le répartiteur de charge qui coupe.
- `/basura` écrit une ligne qui n'est pas une réponse HTTP. C'est le service qui ne parle pas le protocole que tu attendais : un mauvais port, un autre programme qui écoute là.

Avant de voir ce que le `revisor` en fait, regarde ce que fait `curl`, qui est un client sans intermédiaire. Démarre le laboratoire dans un terminal (`node laboratorio.ts`, depuis `fig04_01/`) et essaie les trois dans un autre :

```text
$ curl -i http://127.0.0.1:18081/basura
curl: (1) Received HTTP/0.9 when not allowed

$ curl -i -m 1 http://127.0.0.1:18081/lento/3000
curl: (28) Operation timed out after 1001 milliseconds with 0 bytes received

$ curl -i http://127.0.0.1:18081/cortar
curl: (52) Empty reply from server
```

Aucune des trois ne comporte de ligne d'état. Aucune ne comporte de code. `curl` se termine par une erreur **à lui**, et chacune dit quelque chose de différent. Le 1 est, selon le manuel de `curl`, « protocole non pris en charge », et le message explique pourquoi : ce qu'a écrit `/basura` ne commence pas par `HTTP/1.1`, donc `curl` l'a pris pour une réponse HTTP/0.9 (sans ligne d'état ni en-têtes), et cette version est désactivée sauf si tu la demandes avec `--http0.9`. En pratique : quelque chose est arrivé, mais ce n'est pas du HTTP. Le 28 dit que le délai est écoulé : avec `-m 1` tu lui as donné une seconde, et `/lento/3000` allait en mettre trois. Le 52 dit que le serveur n'a rien répondu : il a accepté la connexion et l'a fermée. Dans la Leçon 0, tu as vu le code 7, « je n'ai pas pu me connecter » : c'est la quatrième façon, et tu la verras dans l'exercice 4.

Quand le `revisor` interrogera l'un de ces services, il sera à la place de `curl`. La différence, c'est que `curl` peut se terminer par un code de sortie, et pas le `revisor` : quelqu'un lui a envoyé une requête HTTP et il doit lui répondre par un code HTTP. C'est le problème que résolvent le `502` et le `504`.

Les services de démarrage de `almacen.ts` s'étoffent pour utiliser ces routes. Aux trois d'avant (1 `catalogo`, 2 `pagos`, 3 `nomina`) s'en ajoutent trois, tous de l'équipe a :

| id | nom | url | limite |
|---|---|---|---|
| 4 | inventario | `http://127.0.0.1:18081/lento/1500` | 2000 ms |
| 5 | reportes | `http://127.0.0.1:18081/lento/3000` | 1000 ms |
| 6 | facturacion | `http://127.0.0.1:18081/basura` | 2000 ms |

`inventario` met 1,5 s avec une limite de 2 s : il arrive à temps, mais lentement. `reportes` met 3 s avec une limite de 1 s : il n'arrive pas. `facturacion` répond n'importe quoi. Comme il y a désormais six services de démarrage, le premier enregistrement de chaque exécution reçoit l'id 7, et non le 4.

#### 4.1.3 Démarrer les deux

Comme dans les leçons précédentes, deux terminaux dans `~/curso-http/fig04_01/` :

```text
$ node laboratorio.ts
laboratorio en http://127.0.0.1:18081/codigo/NNN
```

```text
$ node servidor.ts
revisor en http://127.0.0.1:18080
```

Laisse les deux en marche. Toutes les requêtes des sections 4.3 à 4.6 vont contre cette paire, dans l'ordre où elles apparaissent, et la section 4.7.3 les rassemble.

### 4.2 Qui est en tort : la question des `5xx`

La RFC 9110 définit la famille `5xx` dans sa [section 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6) par une phrase qu'il convient de lire lentement : le serveur **sait qu'il s'est trompé, ou n'est pas capable** d'exécuter la méthode demandée. Ce sont deux choses distinctes. « S'est trompé » est une erreur : quelque chose dans le serveur n'a pas fait ce qu'il devait. « N'est pas capable » peut n'être l'erreur de personne : le serveur est en maintenance, ou saturé, ou dépend d'un autre qui ne répond pas. La même section ajoute une recommandation forte (un *SHOULD*, pas un *MUST*) que tu as déjà vue dans la Leçon 0 : sauf pour une réponse à `HEAD`, le serveur **devrait** envoyer une explication de l'erreur et dire **si elle est temporaire ou permanente**. Cette seconde moitié est celle que presque tout le monde oublie, et c'est celle qui sert le plus au client, car c'est d'elle que dépend le fait de savoir s'il vaut la peine de réessayer.

Pour choisir entre les cinq codes de cette leçon, pose-toi ces questions dans l'ordre :

1. **Le client a-t-il demandé plus que ce qui lui revient dans un temps donné ?** Alors le serveur n'a pas échoué : le client doit ralentir. C'est un `429`, de la famille `4xx`, avec `Retry-After` si tu sais combien de temps il doit attendre.
2. **Le serveur a-t-il décidé de ne pas répondre maintenant, pour cause de maintenance ou parce qu'il est saturé ?** C'est un `503`. Personne ne s'est trompé ; c'est temporaire par définition, et `Retry-After` dit combien de temps cela devrait durer.
3. **Le serveur jouait-il le rôle de passerelle, et ce qui se trouve derrière a-t-il échoué ?** Si ce qui est derrière n'a pas répondu à temps, c'est un `504`. S'il a répondu quelque chose qui n'est pas une réponse valide, ou si l'on n'a pas pu lui parler, c'est un `502`.
4. **Rien de ce qui précède, et quelque chose d'inattendu s'est produit dans ton propre code ?** C'est un `500`.

Le `500` vient en dernier à dessein. C'est le code que l'on utilise quand aucun autre ne décrit ce qui s'est passé, et c'est pourquoi il est le plus facile à utiliser à tort : tout ce qui tourne mal peut s'appeler « erreur interne ». Mais un `500` dit à celui qui exploite le service « cherche dans ton code », et si la panne se trouvait dans une dépendance ou s'il s'agissait d'une maintenance planifiée, il l'envoie chercher là où ce n'est pas. **Un `500` est un aveu : « nous n'avions pas prévu cela »**. Chaque fois que le `revisor` répond `500` pour quelque chose qu'il pouvait prévoir, il dit quelque chose de faux sur lui-même.

Il y a deux questions que l'arbre ne pose pas, et auxquelles il convient de répondre avant de continuer. La première : **et si c'est le client qui a envoyé quelque chose d'impossible ?** Alors ce n'est pas un `5xx`. Un corps illisible est un `400`, un corps de plus de 16 Kio un `413`, une valeur hors plage un `422`, et tu l'as vu dans les Leçons 2 et 3. Un `5xx` pour une erreur du client est aussi trompeur qu'un `200` pour une erreur : le client en conclut que le problème n'est pas le sien et répète la même requête, qui échouera de la même façon. La seconde : **qu'en est-il des `5xx` que le cours n'utilise pas ?** Le `501` a été mentionné dans la Leçon 2 : il est destiné à une méthode que le serveur n'implémente sur aucune ressource. Le `505` est destiné à une version de HTTP que le serveur n'admet pas. Aucun n'est une erreur de capacité ni d'une dépendance, et le `revisor` n'en a pas besoin.

### 4.3 `500` : ce que personne n'attendait

#### 4.3.1 La question qui décide

La RFC 9110 définit le `500 Internal Server Error` dans la [section 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1) en une seule phrase : le serveur a rencontré **une condition inattendue** qui l'a empêché de satisfaire la requête. Le mot qui compte est « inattendue ». La question qui décide du `500` est : **l'avions-nous prévu ?** Si la réponse est oui, un autre code le décrit mieux. Si c'est non, c'est un `500`, et le plus honnête est de le répondre ainsi, au lieu de le déguiser en autre chose.

En pratique, un `500` est presque toujours une exception que personne n'a attrapée : un `undefined` là où l'on attendait un objet, une division par zéro, une connexion à la base de données qui s'est rompue au milieu d'une requête. Ce que le serveur peut bien faire avec un `500`, ce n'est pas l'éviter (s'il le pouvait, il ne serait pas inattendu), mais **bien y répondre** : avec le bon code, sans en dire trop, et en laissant quelque part l'information dont celui qui exploite le service a besoin pour le corriger.

#### 4.3.2 Le provoquer

Le `revisor` de cette leçon apporte un `500` à dessein, pour que tu puisses le provoquer quand tu veux. La route `GET /servicios/{id}/informe` résume les vérifications d'un service, et elle a un défaut qui échappe à n'importe qui :

```ts
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

Elle cherche la dernière vérification du service et lit son résultat. Cela fonctionne tant que le service a au moins une vérification terminée. S'il n'en a aucune, `revisiones[revisiones.length - 1]` vaut `undefined`, et lire `.resultado` sur `undefined` lève une `TypeError`. Les deux `as` du code disent à TypeScript « fais-moi confiance, il y a toujours une vérification ici », et TypeScript fait confiance : le défaut passe `tsc` en mode strict sans la moindre plainte. C'est le type d'erreur qui produit un `500` dans une API réelle : le cas auquel personne n'a pensé, caché derrière une supposition. Le commentaire dit que le défaut reste tel quel jusqu'à la fin du cours, pour qu'il y ait toujours un `500` à provoquer.

Avec le laboratoire et le `revisor` tout juste démarrés, le service 1 n'a aucune vérification. Demande son rapport deux fois :

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia affc3b8a-5ab9-42f5-8b37-2face1f8eafd

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia bf0e3b0a-790f-4625-80e7-017b0bcfa403
```

Lis les deux réponses avec la table du pourquoi à la main. Le code est `500` : le serveur avoue que quelque chose d'inattendu s'est produit, et le client sait que le problème n'est pas le sien. Le corps ne dit pas ce qui s'est passé, ni où, ni dans quel fichier. Il ne dit que deux choses : qu'il s'agit d'une erreur interne, et une **référence**. Et la référence est différente dans chaque réponse : chaque erreur est un événement distinct, même si la cause est la même.

Regarde maintenant le terminal du `revisor` :

```text
GET /servicios/1/informe
error affc3b8a-5ab9-42f5-8b37-2face1f8eafd en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
```

Voilà tout ce que le client n'a pas vu : le message de l'erreur (`TypeError: Cannot read properties of undefined (reading 'resultado')`) et les cadres de la pile, du plus récent au plus ancien. Le premier dit où l'erreur est née : la fonction `informe`, dans `servicios.ts`, ligne 304, colonne 28, qui est exactement le `.resultado` sur `ultima`, la vérification qui n'existe pas. Les trois autres disent comment on en est arrivé là : `atender`, dans `rutas.ts`, a appelé le gestionnaire, `atenderSinFiltrar`, dans `servidor.ts`, a appelé `atender`, et le serveur de Node a appelé `atenderSinFiltrar`. Et au début de la ligne, la même référence que celle reçue par le client. Si quelqu'un signale « j'ai eu une erreur avec la référence `affc3b8a-…` », celui qui exploite le service cherche ce texte dans son journal et trouve la trace de pile exacte de **cette** requête, parmi des milliers.

#### 4.3.3 `servidor.ts` : la référence et la trace de pile

Dans les Leçons 1 à 3, `servidor.ts` avait un filet minimal, `atenderSinCaerse`, qui répondait `500 error interno` et écrivait le message dans le terminal. Cette leçon le convertit en filet complet, `atenderSinFiltrar` :

```ts
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
      fallar(respuesta, 500, `error interno; referencia ${referencia}`);
    } else {
      respuesta.destroy();
    }
  }
}
```

Lis d'abord `atenderSinFiltrar`, qui est celle qui attrape. Tout ce que fait le `revisor` passe par le `await atender(...)` à l'intérieur du `try`. Si quelque chose lève une exception, dans n'importe quel gestionnaire, à n'importe quelle profondeur, l'exception remonte jusqu'à ce `catch`. Trois choses s'y passent, dans cet ordre.

**Premièrement, on tire une référence au sort** avec `randomUUID()`, du module `node:crypto`, qui selon la documentation de Node génère un identifiant UUID de version 4 aléatoire, avec un générateur cryptographique. Qu'il soit aléatoire importe pour deux raisons. L'une : deux erreurs ne partagent pratiquement jamais la même référence (un UUID v4 comporte 122 bits aléatoires : une collision est possible en théorie et négligeable en pratique), si bien que la référence identifie une requête et non une cause. L'autre : elle ne révèle rien. Un numéro consécutif (`error 1043`) dirait à celui qui le reçoit combien d'erreurs ton serveur a connues, et à quel rythme ; un UUID aléatoire ne dit rien d'autre que « cet événement ».

**Deuxièmement, on écrit la trace de pile dans le terminal**, avec la référence devant. Le terminal est le journal de celui qui exploite le service : sur un serveur réel, cela irait dans un système de journalisation, et le principe est le même.

**Troisièmement, on répond au client**, mais seulement si c'est encore possible. `respuesta.headersSent` indique si la ligne d'état et les en-têtes sont déjà partis. S'ils ne sont pas partis, on répond `500` avec la référence. S'ils sont déjà partis (un gestionnaire qui avait commencé à répondre `200` et a levé une exception au milieu du corps), on ne peut plus changer le code : la ligne d'état est la première chose qui voyage, et elle ne peut pas être retirée. La seule chose honnête est de couper la connexion avec `respuesta.destroy()`, pour que le client voie un corps incomplet et non un `200` qui paraît entier. Du côté de `curl`, cela se voit comme une erreur 18, « transfert incomplet » : le code et les en-têtes sont arrivés, mais pas tout le corps promis. Cela a été mesuré avec un serveur jouet qui écrivait `abc` puis coupait : avec `Content-Length: 100`, `curl` dit `(18) transfer closed with 97 bytes remaining to read`, et sans `Content-Length` (transfert par morceaux), il dit `(18) transfer closed with outstanding read data remaining` ; dans les deux cas, erreur 18.

Voyons maintenant `pilaDelCurso`. `error.stack` est un texte : le message sur la première ligne, puis une ligne par cadre, chacune avec `at`. La fonction conserve le message et les cadres qui ne contiennent ni `node:` ni `node_modules`. Les cadres de `node:` sont ceux de Node lui-même (`node:events`, `node:_http_server`) et ceux de `node_modules` seraient ceux des dépendances, si le cours en avait. On les retire pour deux raisons. La première est pratique : les numéros de ligne des cadres internes de Node changent à chaque version, si bien qu'une sortie qui les inclurait changerait à chaque mise à jour de Node, même si ton code ne changeait pas. La seconde tient au métier : ces cadres, ni celui qui apprend ni, presque jamais, celui qui exploite le service ne peut les corriger. Ce dont tu as besoin pour réparer le `500` se trouve dans les cadres de ton code, et ils y sont toujours. La section « L'erreur que tu vas voir » montre la pile complète, avec les cadres de Node inclus, et pourquoi cette version pose problème quand elle voyage.

Remarque le nom de la fonction, `atenderSinFiltrar`. Il se lit comme « traiter ce que personne n'a filtré avant » : c'est le filet pour ce qui a échappé à tous les gestionnaires. Cela ne veut pas dire qu'elle ne filtre pas ce qui sort : elle filtre tout, et le client ne reçoit que la référence. Si chaque gestionnaire faisait bien son travail, ce `catch` ne s'activerait jamais. C'est pourquoi chaque fois qu'il s'active, c'est une nouvelle pour celui qui exploite le service, et la référence est le fil à tirer.

#### 4.3.4 Encadré de sécurité : ce qu'on ne dit jamais dans une erreur

> **Encadré de sécurité.** Une erreur du serveur est une surface publique. Tout ce qui voyage dans son corps peut être lu par celui qui a fait la requête, être conservé par un proxy, être copié par quelqu'un dans un canal de support, et être indexé par un moteur de recherche si la réponse arrive sur une page. Ce qu'on ne dit jamais :
>
> - **Les traces de pile.** Elles révèlent des noms de fichiers, de fonctions et de dépendances, ainsi que la structure interne du programme.
> - **Les chemins de la machine.** `file:///home/despliegue/revisor/servicios.ts` dit quel utilisateur fait tourner le processus, comment le serveur est organisé et où chercher.
> - **Les requêtes SQL et les noms de tables ou de colonnes.** Une erreur de base de données qui répète la requête montre à celui qui cherche une injection exactement ce que le serveur construit avec son entrée.
> - **Les secrets.** Chaînes de connexion, jetons, mots de passe, clés. Ils apparaissent dans les erreurs plus qu'on ne le croit : une exception qui affiche l'objet de configuration complet, ou une URL avec des identifiants à l'intérieur.
> - **Les versions et noms de produits.** Le serveur web, le langage, le framework et sa version disent à un attaquant quelles vulnérabilités connues essayer.
> - **Les noms de machines et adresses internes.** La même chose que ce que le `revisor` évite déjà dans le rejet du SSRF depuis la Leçon 1 : le message dit qu'un nom se résout vers une adresse privée, mais pas laquelle.
>
> Le catalogue des faiblesses courantes de MITRE a un nom pour cela : [CWE-209](https://cwe.mitre.org/data/definitions/209.html), « génération d'un message d'erreur contenant des informations sensibles », et il cite parmi ses exemples les traces de pile exposées, les chemins complets de fichiers et la structure des requêtes. La [fiche de recommandations de l'OWASP sur la gestion des erreurs](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) le résume dans la même règle que suit le `revisor` : le détail de l'erreur est consigné **côté serveur**, pour l'investiguer, et **n'est pas renvoyé** à celui qui a demandé, qui reçoit un message générique.
>
> **La référence est le pont.** Sans elle, taire la trace de pile rendrait le `500` inutile pour tout le monde : le client ne saurait pas quoi signaler, et celui qui exploite le service ne saurait pas quoi chercher. Avec elle, le client a un identifiant qui ne révèle rien, et celui qui exploite le service a, dans son journal, tout ce que le client n'a pas vu. C'est la façon de ne rien dire sans cesser d'aider.
>
> **Taire aussi le texte de l'erreur.** L'erreur la plus fréquente n'est pas d'envoyer la trace de pile complète, mais d'envoyer seulement `error.message`, qui paraît inoffensif. Il ne l'est pas. Le message d'une exception est écrit par celui qui l'a levée, qui peut être une bibliothèque que tu ne contrôles pas, et tu ne sais pas ce qu'il va contenir : celui d'un pilote de base de données peut inclure le fragment de SQL qui a échoué, et celui d'une erreur réseau peut inclure l'adresse interne à laquelle la connexion n'a pas pu se faire. Dans le `revisor`, tu le verras à la section 4.4.2 : quand un service répond n'importe quoi, `fetch` dit `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, et ce texte est conservé dans `motivo` et ne voyage pas. Le `502` dit, avec les mots du `revisor`, « n'a pas donné de réponse HTTP valide : a coupé la connexion ou a répondu quelque chose qui n'est pas du HTTP ». **Ce qui sort vers l'extérieur est écrit par ton programme, avec ses propres mots** ; on ne retransmet jamais le texte d'une exception.
>
> **Le journal n'est pas non plus un tiroir sans fond.** Le `revisor` consigne la route demandée avec sa requête (`peticion.url`, avec tout ce qui suit le `?`), et si une API recevait des jetons dans l'URL, ils y resteraient écrits. La [fiche de recommandations de l'OWASP sur la journalisation](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) demande de ne pas consigner les jetons d'accès ni les données sensibles : dans une API réelle, on consigne la route sans la requête, ou avec les valeurs sensibles biffées.

### 4.4 `502` et `504` : quand le `revisor` joue le rôle de passerelle

#### 4.4.1 La question qui décide

Les deux codes ont une condition en commun, que la RFC 9110 écrit dans les deux définitions : le serveur répond ainsi **tandis qu'il agit comme passerelle ou proxy** (*gateway or proxy*). Autrement dit : pour te répondre, il a dû demander quelque chose à un autre serveur, et cet autre a échoué. La [section 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3) dit que le `502 Bad Gateway` signifie que le serveur a reçu **une réponse invalide** du serveur qu'il est allé interroger (la RFC l'appelle *inbound server* : celui qui se trouve vers l'origine, du côté opposé au client). La [section 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5) dit que le `504 Gateway Timeout` signifie qu'il **n'a pas reçu de réponse à temps** du serveur dont il avait besoin pour mener la requête à bien.

Les deux questions qui décident sont donc :

1. **Pour répondre, ai-je dû demander à un autre ?** Sinon, ce n'est ni un `502` ni un `504`. Un serveur qui ne dépend de personne et échoue à cause d'une erreur imprévue dans sa propre logique répond `500`. (Si la cause est qu'il est surchargé ou en maintenance à dessein, le code est `503`, que cette leçon voit en 4.5 ; le `500` est réservé à ce que personne n'avait prévu.)
2. **Que m'a répondu l'autre ?** Rien à temps → `504`. Quelque chose qui n'est pas une réponse HTTP valide → `502`.

Il y a un cas que la RFC ne nomme pas : **on n'a même pas pu se connecter** (personne n'écoutait sur ce port). Ce n'est pas une réponse invalide, puisqu'il n'y a pas eu de réponse ; ce n'est pas non plus une réponse tardive, puisque la tentative s'est terminée aussitôt. Le `revisor` le traite comme un `502` : ce qui se trouve derrière n'a rien répondu de valide, et le problème est de son côté. C'est un choix de conception, non une norme. Ce qui n'est pas une option, c'est un `500` : le `revisor` a bien prévu que la connexion pouvait échouer, et son code n'est pas en cause.

Remarque ce que le `502` et le `504` **ne** disent **pas** : ils ne disent pas que le `revisor` va mal. Ils disent au client « le problème est derrière moi », et ils disent à celui qui exploite le `revisor` de ne pas chercher dans son code. C'est la réponse à la question de 19 h 20 de la scène d'ouverture.

#### 4.4.2 `cliente.consultar` : quatre issues plus une

La face cliente du `revisor` interrogeait déjà des services depuis la Leçon 1, avec `revisar`, qui renvoyait un résultat déjà classé : `ARRIBA`, `LENTO` ou `CAIDO`. Pour répondre en tant que passerelle, il faut plus de détail : il ne suffit pas de savoir que quelque chose a mal tourné, il faut savoir **quoi**. C'est pourquoi `cliente.ts` gagne une fonction, `consultar`, qui renvoie l'issue brute :

```ts
// Lo que puede pasar al consultar: o hubo una respuesta HTTP, o no la hubo por una de tres razones.
export type Consulta =
  | { tipo: "respuesta"; codigo: number; ms: number; reintentarEn: number | null }
  | { tipo: "tiempo-agotado" }
  | { tipo: "sin-conexion" }
  | { tipo: "respuesta-invalida"; motivo: string }
  | { tipo: "destino-prohibido"; motivo: string };

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
```

`Consulta` est une **union discriminée** : un type qui peut prendre l'une de cinq formes, et le champ `tipo` dit laquelle. Seule la première, `"respuesta"`, comporte un code ; les quatre autres sont les façons de **ne pas** en avoir. Remarque que le type rend impossible une erreur très fréquente : inventer un code pour ce qui n'était pas une réponse (un `0`, un `-1`, un faux `500`). S'il n'y a pas eu de réponse, il n'y a pas de champ `codigo` à remplir. La Leçon 0 l'a placé dans « Ce qui se fait de travers » : traiter « je n'ai pas pu me connecter » comme un code fait perdre l'information la plus utile, à savoir si le serveur a répondu ou non.

`consultar` décide ainsi :

- **Destination interdite.** Avant chaque connexion, on revérifie la destination contre la liste SSRF de la Leçon 1, parce que le DNS a pu changer depuis l'enregistrement. Si elle n'est pas autorisée, on ne tente même pas.
- **Réponse.** Si `fetch` a renvoyé une réponse, il y a eu du HTTP, avec le code quel qu'il soit. Le corps n'est pas lu (`body?.cancel()`) : pour savoir comment va un service, son code suffit, et lire un corps étranger revient à gaspiller de la mémoire pour quelque chose dont on ne se servira pas. `redirect: "manual"` fait qu'un `301` du service est rapporté comme `301` et n'est pas suivi : le `revisor` dit ce que le service a répondu, pas où il l'a envoyé.
- **Délai écoulé.** `AbortSignal.timeout(limiteMs)` annule la requête si la limite du service est dépassée, et `fetch` lève une `DOMException` de nom `TimeoutError`. La documentation de MDN distingue ce nom de `AbortError`, qui apparaît quand l'annulation vient d'ailleurs ; c'est pourquoi le code teste le nom exact.
- **Pas de connexion.** Si la cause de l'erreur porte le code `ECONNREFUSED` (personne n'écoute sur ce port), il n'y avait personne à qui parler. `ENOTFOUND` (le nom a cessé d'exister) est laissé par souci d'exhaustivité, mais il n'arrive presque jamais ici : `revisarDestino` a déjà résolu le nom un instant auparavant, et s'il n'y est pas parvenu, la consultation se termine en destination interdite, avec le motif `el nombre … no se pudo resolver`.
- **Réponse invalide.** Tout le reste : la connexion s'est faite, et ce qui s'est passé ensuite n'était pas une réponse HTTP. `/basura` tombe ici, avec la cause `Response does not match the HTTP/1.1 protocol (Expected HTTP/, RTSP/ or ICE/)`, et `/cortar` aussi, avec la cause `other side closed` (« l'autre côté a fermé »). Le texte est conservé dans `motivo`, pour qui voudrait déboguer depuis le code, et, comme l'a dit l'encadré, il ne sort dans aucune réponse.

Que « réponse invalide » soit le cas par défaut est une décision : si une panne que le code ne connaît pas apparaît, on la traite comme la plus générale des pannes d'un service étranger, et non comme une erreur du `revisor`. Si le `revisor` traitait l'inconnu comme une erreur qui lui est propre, un type de panne réseau que personne n'avait prévu finirait dans le `catch` de `servidor.ts` et sortirait en `500`, envoyant chercher au mauvais endroit.

Et `revisar`, la fonction d'avant, est désormais une traduction de `consultar` vers le résultat que conserve une vérification :

```ts
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

Le `switch` couvre les cinq cas, et TypeScript vérifie qu'aucun ne manque : si demain quelqu'un ajoute un sixième type à `Consulta` et oublie ce `switch`, la fonction ne renverrait plus un `Resultado` dans tous les chemins, et `tsc` le signalerait. La classification n'a pas changé par rapport à la Leçon 1, sauf sur un détail : si le service a répondu une erreur et a fourni `Retry-After`, le détail le consigne, `503 (reintentar en 120 s)`. La section 4.5.3 explique comment cette valeur est lue.

#### 4.4.3 La consultation de santé (health check)

Les vérifications de la Leçon 1 sont asynchrones : tu en demandes une, tu reçois un `202`, et le résultat arrive plus tard. Pour s'exercer au `502` et au `504`, il faut le contraire, une consultation **en direct**, dans laquelle le `revisor` interroge le service à cet instant et te répond avec ce qui s'est passé. C'est la route `GET /servicios/{id}/salud` :

```ts
// GET /servicios/{id}/salud: el revisor consulta el servicio en este momento y hace de pasarela.
// Si hubo respuesta HTTP, la informa con 200, sea cual sea su código. Si no la hubo, la culpa es de
// lo que está detrás: 504 si no contestó a tiempo, 502 si no contestó algo que sea HTTP.
export async function salud({ respuesta, parametros, credencial }: Contexto): Promise<void> {
  // La consulta en vivo también sale a la red, igual que una revisión: sin límite, el revisor serviría
  // para golpear un servicio ajeno a través de él. Cuenta por credencial, antes de buscar el servicio,
  // en una ventana aparte de la de las revisiones.
  const decision = permitir(`salud:${credencial.nombre}`, CONSULTAS_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
      fallar(respuesta, 504, `el servicio ${servicio.id} no respondió en ${servicio.limiteMs} ms`);
      return;
    case "sin-conexion":
      fallar(respuesta, 502, `no se pudo conectar con el servicio ${servicio.id}`);
      return;
    case "destino-prohibido":
      fallar(respuesta, 422, `destino prohibido: ${consulta.motivo}`);
      return;
    case "respuesta-invalida":
      fallar(respuesta, 502, `el servicio ${servicio.id} no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP`);
      return;
  }
}
```

La première chose est une limite : chaque identifiant peut demander **3 consultations en direct par minute**, parce que chacune fait sortir le `revisor` sur le réseau. La section 4.6 l'explique avec la limite des vérifications ; ici il suffit de savoir qu'elle existe, car elle décide de la façon dont les essais se répartissent. Ensuite on cherche le service avec `encontrar`, la même fonction que celle qu'utilisent toutes les routes avec `{id}` : un service d'une autre équipe répond `404`, comme un service qui n'existe pas, comme dans la Leçon 2. Ensuite on interroge, et chaque issue a son code. Essaie-la avec les cinq services de l'équipe a. Cela fait cinq consultations et chaque identifiant en a trois par minute, donc les trois premières se font avec `lectura-a` et les deux dernières avec `escritura-a` :

```text
$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":1,"codigo":200,"ms":8}

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":1}

$ curl -i http://127.0.0.1:18080/servicios/4/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:08 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":4,"codigo":200,"ms":1503}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms
tardó 1.004405 s

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 6 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
tardó 0.002184 s
```

Un par un :

- **Le 1 (`catalogo`) répond `200`** avec `"codigo":200`. Le service va bien, et le `revisor` aussi.
- **Le 2 (`pagos`) répond `200`** avec `"codigo":503`. C'est la ligne qui prête le plus à confusion, et la plus importante de la section. Le service de paiements est en panne, certes, mais il a **répondu** : il a dit `503`, en HTTP valide. Le `revisor` a fait ce qu'on lui demandait, c'est-à-dire découvrir comment va le service, et il l'a découvert. Sa réponse est un succès qui porte une mauvaise nouvelle à l'intérieur. Si le `revisor` répondait `503` ici, il dirait au client « moi, le `revisor`, je ne peux pas te répondre », et n'importe quelle machine sur le chemin (un répartiteur de charge, un moniteur, un cache) le croirait : le moniteur marquerait le `revisor` comme étant en panne à cause d'un service étranger.
- **Le 4 (`inventario`) répond `200`** avec `"ms":1503` : il a mis du temps, mais moins que sa limite de 2000 ms. Ce temps est réel : le laboratoire a attendu 1500 ms et le reste est le temps qu'a pris la connexion.
- **Le 5 (`reportes`) répond `504`**, et `curl` a mesuré **1,004 seconde** : la limite du service est de 1000 ms, et le `revisor` a cessé d'attendre précisément là. Le laboratoire allait répondre à 3000 ms, mais le `revisor` n'écoutait déjà plus. Le corps dit combien de temps il a attendu, ce qui aide le client à comprendre ce qui s'est passé.
- **Le 6 (`facturacion`) répond `502`**, et a mis **2 millisecondes** : le laboratoire a répondu n'importe quoi immédiatement, et le `revisor` l'a reconnu pour tel.

Il manque la cinquième issue, destination interdite, qui répond `422`. C'est la même règle SSRF que dans la Leçon 1, appliquée une fois de plus juste avant la connexion : si le nom d'un service enregistré correctement se résout maintenant vers une adresse privée, ou ne se résout plus, le `revisor` ne se connecte pas. Il n'y a pas d'exécution ici parce qu'on ne peut pas la provoquer depuis le laboratoire : toute URL qui tombe dans cette règle a déjà été rejetée par un `422` à l'enregistrement. Pourquoi `422` et non `502` ? Parce que le `revisor` n'est pas arrivé à parler à ce qui se trouve derrière : ce n'est pas la panne d'un autre serveur, mais une donnée conservée (l'URL du service) qui ne peut pas être satisfaite aujourd'hui. C'est un choix de conception, et il a un coût qu'il convient de dire : celui qui a demandé la santé n'a rien envoyé de travers, et le `422` lui parle d'une donnée enregistrée par quelqu'un d'autre, peut-être il y a des mois. Le `detail` donne le motif, pour qu'il sache quoi corriger dans le service.

Remarque les deux durées. Le `504` a mis ce que dit la limite ; le `502`, presque rien. Ce n'est pas un hasard : un `504`, dans une passerelle simple comme celle-ci, coûte le temps qu'elle a attendu avant de renoncer, et un `502` peut être instantané. (Une passerelle dotée d'un disjoncteur (circuit breaker) ou d'un délai déjà échu peut renvoyer un `504` presque instantanément ; ce qui définit le `504`, c'est que le délai prévu pour la réponse de l'autre est écoulé, et non le temps que la passerelle a mis à le dire.) Cette différence compte pour qui conçoit un client : un client qui attend 30 secondes une passerelle dont la limite est de 1 seconde en gaspille 29.

Reste le cas de `/cortar`. Aucun service de démarrage ne l'utilise, donc enregistre-en un et demande sa santé, de nouveau avec `escritura-a`, qui en est à deux consultations :

```text
$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"colgado","url":"http://127.0.0.1:18081/cortar"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-6db25d01"
Content-Type: application/json
Content-Length: 83
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"colgado","url":"http://127.0.0.1:18081/cortar","limite_ms":2000}

$ curl -i http://127.0.0.1:18080/servicios/7/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 7 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
```

`502`, avec le même corps que le service 6. Du point de vue du `revisor`, un service qui accepte la connexion et la ferme sans rien dire n'a pas donné de réponse valide : il n'y a pas eu de ligne d'état. `consultar` ne distingue pas les deux cas (les deux sont `respuesta-invalida`), et c'est pourquoi le corps dit les deux choses qui ont pu se produire, « a coupé la connexion ou a répondu quelque chose qui n'est pas du HTTP », au lieu d'en affirmer une qui peut être fausse. Les séparer exigerait d'examiner la cause de l'erreur, et cela ne changerait pas le code, qui est ce que lisent les machines.

#### 4.4.4 `500` face à `502` face à `504`

Les trois sont des erreurs du serveur, et les trois se confondent. Cette table rassemble ce qui les sépare :

| | `500` | `502` | `504` |
|---|---|---|---|
| Y avait-il un autre serveur derrière ? | pas nécessairement | oui | oui |
| Que s'est-il passé ? | quelque chose d'inattendu dans ton code | ce qui est derrière a répondu quelque chose d'invalide, ou la connexion n'a pas pu s'établir | ce qui est derrière n'a pas répondu à temps |
| Où cherche celui qui exploite le service ? | dans le code du serveur | dans le service de derrière, ou dans la connexion | dans le service de derrière : il est lent ou en panne |
| Combien de temps met la réponse ? | le temps qu'il met à échouer | presque toujours peu | au moins la limite de la passerelle |
| Dans le `revisor` | `GET /servicios/1/informe` | `GET /servicios/6/salud` | `GET /servicios/5/salud` |

La règle courte : **`500` veut dire « c'est moi qui me suis trompé » ; `502` et `504` veulent dire « c'est celui qui est derrière moi qui s'est trompé »**, et entre les deux, la différence est de savoir s'il a mal répondu ou n'a pas répondu à temps.

Une conséquence de cette règle, que la section « L'erreur que tu vas voir » montre par une exécution : si le `revisor` laissait l'erreur de `fetch` remonter jusqu'à `servidor.ts`, le `502` et le `504` se transformeraient en `500`, avec leur référence et tout. La réponse serait très polie (sans trace de pile, avec une référence) et elle serait fausse : elle dirait « c'est moi qui me suis trompé » alors que c'est un autre qui s'est trompé.

### 4.5 `503` et `Retry-After` : fermé pour maintenance

#### 4.5.1 La question qui décide

La RFC 9110 définit le `503 Service Unavailable` dans la [section 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4) : le serveur **ne peut pas traiter la requête pour le moment** à cause d'une surcharge temporaire ou d'une maintenance programmée, et cela **sera probablement résolu après un certain temps**. Le serveur **peut** envoyer `Retry-After` pour suggérer combien de temps attendre. Et elle ajoute une note qu'il vaut la peine de connaître : que le `503` existe n'oblige pas un serveur saturé à l'utiliser ; certains refusent simplement la connexion.

La question qui décide est : **le serveur a-t-il décidé, ou sait-il, que maintenant il ne peut pas répondre, et que c'est temporaire ?** Les deux conditions comptent. « A décidé ou sait » : un `503` n'est pas une erreur qui s'est échappée, c'est une réponse que le serveur a choisi de donner. « Temporaire » : le `503` promet au client que, s'il attend, la situation change. Un serveur qui répond `503` pour toujours dit quelque chose de faux.

La différence avec le `500` vient de là. Les deux sont du côté du serveur et les deux disent au client que le problème n'est pas le sien. Mais le `500` dit « quelque chose a mal tourné et je ne sais pas quand cela sera réparé », et le `503` dit « je ne peux pas maintenant, reviens plus tard », bien souvent avec l'heure exacte. Pour un client, la différence est de décider entre signaler une erreur et attendre. Pour un cache aussi : dans la Leçon 0, tu as vu que `stale-if-error` permet à un cache de servir la copie précédente face à un `500`, `502`, `503` ou `504`, mais un moniteur qui compte les erreurs devrait compter une maintenance annoncée autrement qu'une panne. Si la maintenance est répondue par un `500`, personne ne peut les distinguer.

#### 4.5.2 Le mode maintenance

Le `revisor` gagne un interrupteur : `PUT /mantenimiento`, avec `{"activo": true}` ou `{"activo": false}`, que seul l'identifiant `admin` peut utiliser. Tant qu'il est activé, tout le reste répond `503` avec `Retry-After: 120`. Il vit dans un nouveau fichier, `operacion.ts` :

```ts
let enMantenimiento = false;
const VUELVE_EN_S = 120;

// Si está en mantenimiento, responde 503 y devuelve true. /mantenimiento siempre se atiende.
export function atajarPorMantenimiento(ruta: string, respuesta: ServerResponse): boolean {
  if (!enMantenimiento || ruta === "/mantenimiento") return false;
  fallar(respuesta, 503, "el revisor está en mantenimiento", { "Retry-After": String(VUELVE_EN_S) });
  return true;
}

// PUT /mantenimiento con {"activo": true} o {"activo": false}. Solo la credencial admin.
export async function cambiarMantenimiento({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  if (credencial.rol !== "admin") {
    fallar(respuesta, 403, "solo quien opera el revisor puede cambiar el mantenimiento");
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

Deux fonctions. `atajarPorMantenimiento` est appelée depuis le point d'entrée, avant tout, et répond `503` si le mode est activé ; elle renvoie `true` pour que le point d'entrée sache qu'il a déjà été répondu. `cambiarMantenimiento` est le gestionnaire de `PUT /mantenimiento` : il vérifie le rôle, lit le corps avec le même `leerJson` que d'habitude (de sorte qu'un corps qui n'est pas du JSON reçoit son `415` ou son `400`, comme dans la Leçon 2), exige un booléen (sinon, `422`, avec la même `rechazarDatos` que la Leçon 3) et change le mode.

Dans `rutas.ts`, l'arrêt s'ajoute au point d'entrée, à côté des autres arrêts qui précèdent les sept questions :

```ts
  if (redirigir(url.pathname, url.search, respuesta)) return;
  if (atajarPorMantenimiento(url.pathname, respuesta)) return;
  if (versionRetirada(url.pathname, respuesta)) return;
```

Essaie-le avec les deux identifiants, puis demande deux choses pendant qu'il dure :

```text
$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 59
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo quien opera el revisor puede cambiar el mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i http://127.0.0.1:18080/no-existe
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
200
```

Six réponses, et chacune dit quelque chose :

- **`escritura-a` reçoit `403`.** C'est un écrivain, et la route est une route d'écriture, donc il a passé la question 4 du point d'entrée ; mais le gestionnaire vérifie en plus qu'il est `admin`. Activer la maintenance change la journée de toutes les équipes, et cela ne revient pas à une seule.
- **`admin` reçoit `204`.** Le mode s'est activé ; il n'y a rien à renvoyer. Le terminal du `revisor` l'enregistre : `operación: mantenimiento encendido`.
- **`GET /servicios` reçoit `503` avec `Retry-After: 120`.** Le corps dit ce qui se passe ; l'en-tête dit combien de temps attendre ; le code dit que ce n'est pas la faute du client et que c'est temporaire.
- **`/no-existe`, sans identifiant, reçoit aussi `503`.** Celle-ci mérite une pause. C'est une route qui n'existe pas, demandée par quelqu'un qui n'a pas dit qui il était, et la réponse n'est ni `404` ni `401`. C'est que la maintenance passe **avant** les sept questions. La raison est la même que dans la Leçon 2 pour les redirections : tant que le `revisor` est en maintenance, aucune réponse qui dépend de ses données n'est fiable, et répondre `404` à une route qui existe bel et bien parce qu'« aujourd'hui je ne la sers pas » serait mentir. Une seule réponse pour tout est ce qu'il y a de plus honnête, et en plus elle n'apprend rien à personne : un inconnu n'apprend pas quelles routes existent.
- **L'`admin` désactive le mode avec un autre `204`.** `/mantenimiento` est la seule route servie pendant la maintenance, parce que sinon, personne ne pourrait la désactiver. Remarque que l'exception est écrite dans `atajarPorMantenimiento` elle-même et non dans le point d'entrée : l'interrupteur et son exception vivent ensemble.
- **`GET /servicios` revient à `200`.**

Pourquoi la maintenance vient-elle **après** les redirections ? Parce qu'une redirection ne livre pas de données : elle dit où se trouve la nouvelle route, et cela reste vrai pendant la maintenance. Un client qui demande `/viejo/servicios` reçoit le `301`, va à `/servicios`, et y reçoit le `503`. Chaque réponse dit quelque chose de vrai.

#### 4.5.3 `Retry-After`, sous ses deux formes

`Retry-After` est définie dans la [section 10.2.3 de la RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3). Elle dit combien de temps le client **devrait** attendre avant de redemander ; avec un `503`, combien de temps l'indisponibilité devrait durer. Sa valeur a deux formes, et la grammaire de la RFC les écrit ainsi :

```text
Retry-After = HTTP-date / delay-seconds
delay-seconds  = 1*DIGIT
```

Soit une date HTTP (`Fri, 31 Dec 1999 23:59:59 GMT`, l'exemple de la RFC), soit un nombre de secondes (`120`). `1*DIGIT` signifie « un ou plusieurs chiffres » : un entier non signé, sans virgule décimale, sans espaces à l'intérieur. `1.5` n'est pas une valeur valide, ni `-1`, ni `2m`.

La date a elle-même trois formats, pour des raisons historiques : la [section 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) définit le format préféré (`Sun, 06 Nov 1994 08:49:37 GMT`) et deux formats obsolètes issus de vieilles versions de HTTP (`Sunday, 06-Nov-94 08:49:37 GMT` et `Sun Nov  6 08:49:37 1994`, le format de la fonction `asctime` du C), et elle dit que celui qui lit une date dans un champ HTTP **doit** accepter les trois. Celui qui génère une date HTTP **doit** n'utiliser que le premier.

Quand convient chaque forme ? Les secondes sont relatives : « attends 120 secondes à partir du moment où tu as reçu ceci ». La date est absolue : « reviens à partir de 23 h 59 ». Les secondes sont plus robustes, car elles ne dépendent pas de l'accord entre l'horloge du client et celle du serveur. La date a du sens quand le serveur connaît une heure précise, par exemple la fin d'une fenêtre de maintenance annoncée. Le `revisor` envoie des secondes dans tous les cas.

Du côté du client, `cliente.ts` lit les deux formes avec `segundosDeEspera` et son auxiliaire, `fechaHttp` :

```ts
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
```

Si l'en-tête ne vient pas, `segundosDeEspera` renvoie `null` : il n'y a pas d'instruction. S'il ne contient que des chiffres, ce sont les secondes. Sinon, elle demande à `fechaHttp` de la lire comme une date, et calcule combien de secondes il reste, en arrondissant vers le haut ; une date déjà passée donne `0`, « tu peux réessayer tout de suite ». Si ce n'est pas une date, elle renvoie `null` : une valeur qu'on ne comprend pas n'est pas une instruction, et l'appelant utilise sa propre attente par défaut.

`fechaHttp` est longue parce qu'elle fait ce que la RFC demande et rien de plus. Elle a une expression régulière pour chacun des trois formats, avec les noms de jours et de mois qu'énumère la RFC ; elle construit la date avec `Date.UTC`, parce qu'une date HTTP est toujours en GMT, même si la forme `asctime` ne l'écrit pas ; elle applique la règle de la RFC 850 pour l'année à deux chiffres (si elle tombe à plus de 50 ans dans le futur, elle est du siècle précédent) ; et à la fin elle vérifie que la date construite est bien celle qui était demandée, parce que `Date.UTC` accepte le 32 octobre et le transforme, sans se plaindre, en 1er novembre. Ce qu'elle **ne** fait **pas**, c'est le plus tentant : passer le texte à `Date.parse`. Le commentaire dit pourquoi, et l'exercice 2 te le montre par une exécution : `Date.parse` comprend comme une date presque n'importe quoi, et lit la forme `asctime` dans l'heure locale de la machine.

Ce programme teste `segundosDeEspera` avec cinq valeurs et avec l'en-tête absent :

```ts
// fig04_03.ts — leer Retry-After en sus dos formas: segundos o una fecha HTTP.
import { segundosDeEspera } from "./fig04_01/cliente.ts";

const dentroDe90 = new Date(Date.now() + 90_000).toUTCString();
const VALORES: (string | null)[] = ["120", "0", dentroDe90, "Wed, 21 Oct 2015 07:28:00 GMT", "mañana", null];

for (const valor of VALORES) {
  const texto = valor === null ? "(sin la cabecera)" : JSON.stringify(valor);
  console.log(`${texto.padEnd(34)} → ${segundosDeEspera(valor) ?? "null: no dice cuánto esperar"}`);
}
```

```text
$ node fig04_03.ts
"120"                              → 120
"0"                                → 0
"Wed, 21 Oct 2026 13:21:26 GMT"    → 90
"Wed, 21 Oct 2015 07:28:00 GMT"    → 0
"mañana"                           → null: no dice cuánto esperar
(sin la cabecera)                  → null: no dice cuánto esperar
```

Les secondes se lisent telles quelles ; la date dans 90 secondes donne `90` ; celle de 2015 est déjà passée et donne `0` ; et `mañana` et l'absence donnent `null`. L'exercice 2 la confronte à une version naïve, avec des valeurs qui ne sont pas valides.

La valeur lue finit dans le détail de la vérification. Tu le verras en 4.6.3 : une vérification du service 2, qui répond `503` avec `Retry-After: 120` depuis le laboratoire, reste avec `"detalle":"503 (reintentar en 120 s)"`. Le `revisor` ne fait encore rien de ce nombre, sinon le consigner ; la Leçon 6 décide quand il vaut la peine d'attendre et de réessayer, et quand non.

#### 4.5.4 `503` face à `500`

Une façon rapide de ne pas les confondre est de se demander **qui savait**. Un `503` est répondu par un serveur qui sait qu'il ne peut pas répondre : on l'a mis en maintenance, ou il a mesuré lui-même qu'il est saturé (trop de connexions ouvertes, une file pleine). Un `500` est répondu par un serveur qui a appris son erreur en même temps que le client. Si tu savais, et que c'est temporaire, c'est `503` ; si tu ne savais pas, c'est `500`.

Il y a un cas limite qui mérite réflexion : une base de données qui ne répond pas. Pour le serveur de l'API, est-ce un `500` ou un `503` ? Si le code essaie de se connecter, échoue, et que l'exception remonte jusqu'au filet de `servidor.ts`, un `500` sort, et ce n'est pas mal : personne n'avait prévu la panne. Si le code détecte que la base n'est pas disponible et le dit à dessein, un `503` avec `Retry-After` est plus utile, parce qu'il dit au client que c'est temporaire. Et certains répondent `502` ou `504`, en arguant que la base de données est un serveur qui se trouve derrière. La RFC ne tranche pas ce cas : c'est un choix de conception, et ce qui compte, c'est de le décider, de l'écrire et de l'appliquer de la même façon dans toutes les routes. Le `revisor` réserve le `502` et le `504` à la consultation de santé, où il joue explicitement le rôle de passerelle, parce que son travail est de répondre comment va un autre service.

### 4.6 `429` : trop de requêtes

#### 4.6.1 La question qui décide

Le `429 Too Many Requests` n'est pas dans la RFC 9110. Il a été défini en 2012 par la [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4), dans sa section 4, avec le `428` de la Leçon 3. La définition est courte : l'utilisateur a envoyé **trop de requêtes dans un temps donné** (« *rate limiting* », limitation du débit). La réponse **devrait** expliquer la situation et **peut** comporter `Retry-After`. L'exemple de la RFC est un site qui autorise 50 requêtes par heure à chaque utilisateur identifié, et répond avec `Retry-After: 3600`.

La même section dit deux choses qu'il vaut la peine de souligner. La première : la RFC **ne définit pas** comment le serveur identifie l'utilisateur ni comment il compte les requêtes. Il peut compter par ressource, pour tout le serveur ou entre plusieurs serveurs, et il peut identifier l'utilisateur par son identifiant ou par un cookie. Autrement dit : combien, à quelle fréquence et par qui sont des décisions qui t'appartiennent, et c'est pourquoi elles doivent être documentées. La seconde : une réponse `429` **ne doit pas** être conservée dans un cache. C'est logique : « tu en as trop fait » est vrai pour toi et maintenant, pas pour le client suivant ni dans une minute.

La question qui décide est : **le client a-t-il demandé plus que ce qui lui revient dans un temps donné ?** Si la réponse est oui, le problème se règle avec du temps et un client qui réduit son rythme ; c'est pourquoi c'est un `4xx`. Si le serveur est saturé par la somme de tous les clients, et non par un en particulier, ce n'est pas un `429` mais un `503` : aucun client n'a rien fait de mal.

La RFC 6585 comporte en outre un avertissement dans ses considérations de sécurité ([section 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2)) : quand un serveur est sous attaque, répondre `429` à chaque requête consomme aussi des ressources, si bien que le serveur **n'est pas obligé** d'utiliser le `429` ; parfois, il vaut mieux couper la connexion. Le `429` sert aussi bien pour le client qui dépasse la mesure que pour freiner celui qui abuse ; mais sous une attaque par le volume, répondre à chaque requête coûte aussi, et la RFC laisse au serveur la possibilité de couper la connexion plutôt que de répondre.

#### 4.6.2 La fenêtre fixe

La limite du `revisor` vit dans un nouveau fichier, `limitador.ts`. C'est l'algorithme le plus simple qui existe, la **fenêtre fixe** : il compte combien de fois une clé a été utilisée depuis le début de la fenêtre, et quand la fenêtre se termine, une autre commence à zéro :

```ts
// fig04_01/limitador.ts — cuántas veces se puede hacer algo en una ventana de tiempo.
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

Chaque clé a sa fenêtre : quand elle a commencé et combien d'utilisations elle compte. `permitir(clave, maximo, ventanaMs)` pose trois questions. N'y a-t-il pas de fenêtre, ou est-elle déjà terminée ? On en démarre une nouvelle, avec une utilisation, et on autorise. Y a-t-il une fenêtre et reste-t-il des utilisations ? On en compte une de plus et on autorise. Sont-elles épuisées ? On refuse, et on dit combien de secondes il reste avant la fin de la fenêtre, en arrondissant vers le haut. Ce nombre est celui qui voyage dans `Retry-After` : le `revisor` n'invente pas une attente, il la calcule. Arrondir vers le haut compte : s'il reste 0,3 seconde, dire `0` inviterait le client à réessayer aussitôt, et il recevrait de nouveau un `429`.

`limitador.ts` ne sait rien de HTTP : il ne reçoit pas de requêtes et ne répond rien. Il reçoit une clé et renvoie une décision. Ainsi on peut l'utiliser depuis n'importe quel gestionnaire, et on peut le tester seul, comme tu le verras en 4.6.4.

#### 4.6.3 Dans le `revisor` : trois par minute, par identifiant

Que limite-t-on ? Dans le `revisor`, ce qui coûte le plus est ce qui le fait sortir sur le réseau : demander une vérification et demander la santé en direct (4.4.3). Sans limite, n'importe qui disposant d'un identifiant peut le pousser à faire des milliers de connexions par minute contre un service, le sien ou celui d'un autre, ce qui est exactement ce qui se passait dans la scène d'ouverture. La limite est de **3 vérifications par identifiant toutes les 60 secondes**, dans `pedirRevision`, et de 3 autres consultations en direct par identifiant, dans une fenêtre à part, dans `salud` :

```ts
export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  // El límite cuenta por credencial y se consulta ANTES de buscar el servicio: así también cuentan los
  // 404 de quien prueba ids uno tras otro (enumeración), y lo que gasta una credencial no lo paga otra.
  const decision = permitir(`revisiones:${credencial.nombre}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
```

Deux décisions, et toutes deux comptent plus qu'il n'y paraît.

**La clé est l'identifiant** : `revisiones:` plus le nom de l'identifiant. Ainsi, ce que dépense un identifiant, un autre ne le paie pas. Si la clé était le service, un seul identifiant pourrait dépenser les trois vérifications d'un service et laisser tous les autres une minute sans pouvoir le vérifier : le `429` arriverait à qui n'a rien fait, ce qui est précisément ce que le code ne doit pas dire. La RFC 6585 laisse compter par ressource, par serveur ou par utilisateur ; le `revisor` compte par celui qui demande, parce que le `429` dit à **ce** client de réduire **son** rythme.

**La limite se demande avant `encontrar`.** Ainsi les requêtes qui finissent en `404` comptent aussi. Cela paraît un détail, et c'est la différence entre une limite qui freine celui qui essaie des identifiants les uns après les autres et une qui ne le voit pas : si la limite venait après, chaque `404` sortirait avant de toucher le limiteur, et celui qui énumère ne dépenserait jamais aucune fenêtre. Il y a un autre avantage : la clé provient de quelque chose que le point d'entrée a déjà vérifié (l'identifiant), non d'un identifiant que le client écrit, si bien que personne ne peut créer des clés sans fin dans le `Map` de `limitador.ts` en inventant des ids.

Essaie-le : trois vérifications du service 2 avec `escritura-a`, une quatrième, et une du service 4 avec `admin`. Ensuite, une quatrième consultation en direct avec `lectura-a`, qui en a déjà fait trois en 4.4.3, et l'énumérateur de la Leçon 2 avec `escritura-b`, qui demande des vérifications pour les ids 1 à 10. Enfin, attends 20 secondes et réessaie celle de `escritura-a` :

```text
$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/4/revisiones -H 'Authorization: Bearer admin'
202

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 58
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 consultas en vivo en el último minuto

$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ sleep 20
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 40
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto
```

Ligne par ligne :

- **Les trois premières, `202`**, comme dans la Leçon 1. **La quatrième, `429`**, avec `Retry-After: 60` : la fenêtre de `escritura-a` a commencé il y a un instant et il lui reste 60 secondes. Le corps dit ce qui s'est passé avec les mots du `revisor`, et le code et l'en-tête disent quoi faire.
- **Celle de `admin`, `202`** : il a sa propre fenêtre. Ce qu'a dépensé `escritura-a`, un autre identifiant ne le paie pas.
- **La quatrième consultation en direct de `lectura-a`, `429`**, avec `Retry-After: 58` : sa fenêtre de consultations a commencé avec la première requête de 4.4.3, quelques secondes auparavant. C'est une autre fenêtre, séparée de celle des vérifications : demander la santé ne dépense pas de vérifications, ni l'inverse.
- **L'énumérateur, `404 404 202 429 429 429 429 429 429 429`.** `escritura-b` est de l'équipe b : pour lui, le 1 et le 2 n'existent pas (`404`), et le 3 est à lui (`202`). Ces trois requêtes ont rempli sa fenêtre, même si deux étaient des `404`, et du 4 au 10 il reçoit `429`. À ce rythme, parcourir cent mille identifiants prendrait plus de trois semaines.
- **Vingt secondes plus tard, de nouveau `429`**, mais cette fois avec `Retry-After: 40`. Le nombre n'est pas fixe : il dit combien il reste réellement. Un client qui obéit à cet en-tête ne fait pas une seule requête de trop.

Les trois vérifications acceptées de `escritura-a` et celle de `admin` sont déjà terminées. Regarde la première de chacune, et le rapport du service 2, qui a maintenant des vérifications :

```text
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":1,"detalle":"503 (reintentar en 120 s)"}}

$ curl http://127.0.0.1:18080/revisiones/4 -H 'Authorization: Bearer lectura-a'
{"id":4,"servicio":4,"estado":"terminada","resultado":{"estado":"LENTO","codigo":200,"ms":1501,"detalle":"200"}}

$ curl -i http://127.0.0.1:18080/servicios/2/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 54
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"revisiones":3,"ultimo_estado":"CAIDO"}
```

La vérification de `pagos` est restée `CAIDO`, avec `"detalle":"503 (reintentar en 120 s)"` : le laboratoire a répondu `503` avec `Retry-After: 120`, et `segundosDeEspera` l'a lu. Celle d'`inventario`, `LENTO`, avec 1501 ms contre une limite de 2000 : il a mis la moitié de la limite ou plus. Et le rapport du service 2 répond `200` : le défaut de `informe` ne mord que lorsqu'il n'y a pas de vérifications terminées, et ici il y en a trois.

#### 4.6.4 La fenêtre fixe, vue de près

La fenêtre fixe est facile à lire, et elle a un défaut qu'il convient de voir de ses propres yeux. Ce programme utilise le même `limitador.ts` que le `revisor`, avec une limite de 3 toutes les 1000 ms pour ne pas attendre une minute, et fait sept requêtes à des moments choisis :

```ts
// fig04_02.ts — la ventana fija, vista de cerca: 3 permisos cada 1000 ms.
// Usa el mismo limitador del revisor, con una ventana corta para no esperar un minuto.
import { setTimeout as esperar } from "node:timers/promises";
import { permitir } from "./fig04_01/limitador.ts";

const MAXIMO = 3;
const VENTANA_MS = 1000;
// Cuándo pide cada petición, en milisegundos desde el arranque.
const PLAN = [0, 950, 960, 1005, 1010, 1015, 1020];

const inicio = performance.now();
const permitidas: number[] = [];
for (const cuando of PLAN) {
  await esperar(Math.max(0, cuando - (performance.now() - inicio)));
  const decision = permitir("demo", MAXIMO, VENTANA_MS);
  const ms = Math.round(performance.now() - inicio);
  if (decision.permitido) permitidas.push(ms);
  const texto = decision.permitido ? "permitida" : `rechazada: Retry-After ${decision.esperaS}`;
  console.log(`${String(ms).padStart(5)} ms  ${texto}`);
}
const rafaga = permitidas.filter((ms) => ms >= 900);
console.log();
console.log(`límite: ${MAXIMO} cada ${VENTANA_MS} ms`);
console.log(`permitidas entre ${rafaga[0]} y ${rafaga[rafaga.length - 1]} ms: ${rafaga.length}`);
```

```text
$ node fig04_02.ts
    2 ms  permitida
  950 ms  permitida
  961 ms  permitida
 1005 ms  permitida
 1011 ms  permitida
 1016 ms  permitida
 1021 ms  rechazada: Retry-After 1

límite: 3 cada 1000 ms
permitidas entre 950 y 1016 ms: 5
```

La limite dit « 3 par seconde », et entre la milliseconde 950 et la 1016 il en est passé **5**. La première requête a ouvert la fenêtre dans les premières millisecondes ; celles de 950 et 961 l'ont remplie ; à la milliseconde 1000 la fenêtre s'est terminée et une autre a commencé, qui en a accepté trois de plus. La septième, à 1021, a été refusée avec `Retry-After: 1`. À la frontière entre deux fenêtres, la fenêtre fixe laisse passer jusqu'au double de la limite en très peu de temps. Les millisecondes exactes changent à chaque exécution (les minuteurs de Node ne sont pas exacts à la milliseconde), mais pas le cinq.

Est-ce grave ? Cela dépend de ce que tu protèges. Pour le `revisor`, qui veut éviter des milliers de consultations par minute, qu'un service en reçoive six au lieu de trois au changement de minute n'a pas d'importance. Pour une limite qui protège quelque chose de fragile, cela peut compter, et c'est pourquoi d'autres algorithmes existent : la **fenêtre glissante**, qui compte les requêtes des 60 dernières secondes, comptées à partir de maintenant, et le **seau à jetons** (*token bucket*), qui reconstitue les autorisations peu à peu et permet une petite rafale mais jamais le double. Tous deux répartissent mieux et enseignent la même chose que la fenêtre fixe : il y a un maximum, il y a un temps, et quand il est écoulé, `429` avec le temps à attendre. Le commentaire de `limitador.ts` le dit en une ligne.

#### 4.6.5 Encadré de sécurité : le `429` comme défense

> **Encadré de sécurité.** Une limite de requêtes ne protège pas seulement la capacité. C'est aussi une défense, parce que beaucoup d'attaques ont besoin de beaucoup de requêtes :
>
> - **L'énumération.** Dans la Leçon 2, tu as vu l'énumérateur qui essaie `/servicios/1`, `/servicios/2`, `/servicios/3`… Le point d'entrée du `revisor` répond déjà de la même façon à ce qui est étranger et à ce qui n'existe pas, si bien qu'il n'y a rien à apprendre des réponses. La limite ajoute une autre couche, au cas où une différence s'échapperait un jour : comme elle compte par identifiant et avant de chercher le service, les `404` comptent aussi, et en 4.6.3 tu as vu l'énumérateur freiné à la quatrième requête. Ce qui la fait fonctionner, c'est de **compter par celui qui demande** ; une limite par ressource ne le verrait jamais, parce que celui qui énumère demande une ressource différente à chaque fois. L'exercice 3 te le montre avec les deux versions.
> - **L'épuisement des ressources.** L'OWASP le place dans sa liste des dix risques les plus importants des API sous le nom de [API4:2023, *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption), et recommande de limiter combien de fois un client peut interagir avec l'API dans un temps donné, avec des limites plus strictes sur les opérations coûteuses, et de fixer des limites de temps d'exécution. Le `revisor` fait les deux : il limite ce qui sort sur le réseau (les vérifications et la consultation en direct), et chaque consultation a sa limite de temps (`limite_ms`, de 100 à 10 000), qui est ce qui produit le `504`.
> - **Le `revisor` comme arme contre autrui.** C'est l'autre face du SSRF de la Leçon 1. La liste des destinations décide **vers où** le `revisor` se connecte ; la limite décide **combien de fois**. Sans elle, n'importe qui disposant d'un identifiant pourrait se servir du `revisor` pour frapper un service étranger, et le service verrait les connexions venir du `revisor`, non de celui qui les a demandées.
>
> **Ce que cette limite ne résout pas : la force brute sur les identifiants.** Deviner un identifiant en essayant des millions de valeurs est une attaque à beaucoup de requêtes, mais le `revisor` ne la freine pas avec son limiteur, et c'est voulu. Une limite par identifiant ne sert à rien contre celui qui n'en a pas encore, et une limite par adresse d'origine, dans ce cours, freinerait aussi les matrices de tests et les programmes des leçons, qui tournent tous depuis `127.0.0.1`. La force brute se freine à une autre couche : le fournisseur d'identité ou la passerelle placée devant l'API, avec des identifiants longs et aléatoires qu'on ne peut pas deviner. La [fiche de recommandations de l'OWASP sur l'authentification](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) décrit cette couche : un maximum de tentatives échouées, compté **par compte** et pas seulement par adresse, parce que l'attaquant peut changer d'adresse. Les quatre identifiants du `revisor` sont des mots d'exercice, écrits dans le code pour que le cours puisse être suivi ; dans une API réelle, ils proviennent d'un fournisseur d'identité, comme l'a dit la Leçon 2.
>
> **La clé de la limite décide qui tu protèges.** Par identifiant, comme le `revisor`, elle répartit la capacité entre les clients et ne punit pas l'un pour ce qu'a fait un autre. Par ressource, elle protège la ressource, mais n'importe qui peut dépenser la fenêtre de tous. Par adresse d'origine, elle freine celui qui n'a pas d'identifiant, mais elle punit tous ceux qui partagent une même sortie vers internet. La RFC 6585 le laisse ouvert à dessein. Ce qui n'est pas optionnel, c'est que la clé provienne de quelque chose que le serveur a vérifié : une clé faite avec du texte libre du client est une façon de remplir la mémoire du limiteur.
>
> **Ce qui n'est pas encore un standard.** Beaucoup d'API envoient, en plus de `Retry-After`, des en-têtes qui disent combien de requêtes il reste dans la fenêtre. Il existe un brouillon de l'IETF pour cela, *RateLimit header fields for HTTP*, qui définit `RateLimit-Policy` et `RateLimit` ; sa version la plus récente est la 11, du 23 mai 2026, et [c'est toujours un brouillon](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), non une RFC. Et les grandes API utilisent leurs propres noms : l'[API REST de GitHub](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), par exemple, répond `403` ou `429` quand une limite est dépassée, avec ses en-têtes `x-ratelimit-remaining` et `x-ratelimit-reset`, et demande de regarder d'abord `retry-after` s'il est présent. C'est pourquoi le `revisor` n'envoie que `Retry-After`, qui, lui, est un standard, et c'est pourquoi le cours enseigne les autres pour ce qu'elles sont : un patron que chaque API documente, non une exigence de HTTP.

### 4.7 Le `revisor` complet

#### 4.7.1 Les fichiers qui changent

Copie ton dossier de la Leçon 3 sous le nom `~/curso-http/fig04_01/`. Huit fichiers sont nouveaux ou changent. D'abord les deux nouveaux :

```ts
// fig04_01/operacion.ts — el modo mantenimiento: lo enciende y lo apaga quien opera el revisor.
import type { ServerResponse } from "node:http";
import { enviarVacio, fallar } from "./respuestas.ts";
import { leerJson, rechazarDatos, type Contexto } from "./servicios.ts";

let enMantenimiento = false;
const VUELVE_EN_S = 120;

// Si está en mantenimiento, responde 503 y devuelve true. /mantenimiento siempre se atiende.
export function atajarPorMantenimiento(ruta: string, respuesta: ServerResponse): boolean {
  if (!enMantenimiento || ruta === "/mantenimiento") return false;
  fallar(respuesta, 503, "el revisor está en mantenimiento", { "Retry-After": String(VUELVE_EN_S) });
  return true;
}

// PUT /mantenimiento con {"activo": true} o {"activo": false}. Solo la credencial admin.
export async function cambiarMantenimiento({ peticion, respuesta, credencial }: Contexto): Promise<void> {
  if (credencial.rol !== "admin") {
    fallar(respuesta, 403, "solo quien opera el revisor puede cambiar el mantenimiento");
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

`limitador.ts` est complet à la section 4.6.2. Les six qui changent, complets :

```ts
// fig04_01/servidor.ts — la cara servidor del revisor: la API que administra los servicios observados.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fallar } from "./respuestas.ts";
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
      fallar(respuesta, 500, `error interno; referencia ${referencia}`);
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
// fig04_01/cliente.ts — la cara cliente del revisor: consulta un servicio y clasifica lo que respondió.
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
// fig04_01/servicios.ts — lo que hace cada ruta de la API del revisor.
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
import { CuerpoDemasiadoGrande, enviarJson, enviarVacio, fallar, leerCuerpo, TOPE_CUERPO, type Cabeceras } from "./respuestas.ts";

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
export async function leerJson(peticion: IncomingMessage, respuesta: ServerResponse): Promise<Record<string, unknown> | undefined> {
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
  // El límite cuenta por credencial y se consulta ANTES de buscar el servicio: así también cuentan los
  // 404 de quien prueba ids uno tras otro (enumeración), y lo que gasta una credencial no lo paga otra.
  const decision = permitir(`revisiones:${credencial.nombre}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
    fallar(respuesta, 404, `no existe la revisión ${parametros[0]}`);
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
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
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
      fallar(respuesta, 504, `el servicio ${servicio.id} no respondió en ${servicio.limiteMs} ms`);
      return;
    case "sin-conexion":
      fallar(respuesta, 502, `no se pudo conectar con el servicio ${servicio.id}`);
      return;
    case "destino-prohibido":
      fallar(respuesta, 422, `destino prohibido: ${consulta.motivo}`);
      return;
    case "respuesta-invalida":
      fallar(respuesta, 502, `el servicio ${servicio.id} no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP`);
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

Dans `servicios.ts`, outre ce que tu as déjà vu (`salud`, `informe` et les limites de `pedirRevision` et `salud`), `leerJson` est désormais exportée, parce que `operacion.ts` l'utilise pour lire le corps de `PUT /mantenimiento`. Tout le reste, c'est la Leçon 3.

```ts
// fig04_01/rutas.ts — la puerta de la API: qué ruta existe, qué método admite y quién puede usarlo.
import type { IncomingMessage, ServerResponse } from "node:http";
import { identificar, motivo, reto, type Credencial } from "./autenticacion.ts";
import { enviarVacio, fallar } from "./respuestas.ts";
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

```ts
// fig04_01/laboratorio.ts
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
// fig04_01/almacen.ts — los servicios que observa el revisor y las revisiones pedidas, en memoria.
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

Dans `almacen.ts` il y a deux changements : `revisionesDe`, qu'utilise `informe`, et les trois nouveaux services de démarrage à la fin du fichier.

#### 4.7.2 Les fichiers qui ne changent pas

Les autres sont ceux de la Leçon 3, sans un seul changement. Ils sont donnés en entier pour que le `revisor` puisse être monté à partir de cette leçon :

```ts
// fig04_01/respuestas.ts — las tres formas de responder del revisor y la lectura del cuerpo.
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
// fig04_01/autenticacion.ts — quién eres (la credencial) y qué puedes hacer (el rol).
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
// fig04_01/destinos.ts — a dónde puede conectarse el revisor. Defensa contra SSRF.
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
// fig04_01/etiquetas.ts — leer y comparar etiquetas (ETag) como pide el RFC 9110.
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
// fig04_01/versiones.ts — las versiones viejas de la API: /v1 está desaprobada y /v0 ya se retiró.
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

```json fig04_01/package.json
{
  "type": "module"
}
```

#### 4.7.3 L'exécution complète

Avec le laboratoire et le `revisor` tout juste démarrés (section 4.1.3), voici toutes les requêtes de la leçon, dans l'ordre, avec ce qu'elles ont répondu. Elles sont rassemblées ici pour que tu les compares d'une traite avec les tiennes :

```text
$ curl -i http://127.0.0.1:18081/basura
curl: (1) Received HTTP/0.9 when not allowed

$ curl -i -m 1 http://127.0.0.1:18081/lento/3000
curl: (28) Operation timed out after 1001 milliseconds with 0 bytes received

$ curl -i http://127.0.0.1:18081/cortar
curl: (52) Empty reply from server

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia affc3b8a-5ab9-42f5-8b37-2face1f8eafd

$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia bf0e3b0a-790f-4625-80e7-017b0bcfa403

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":1,"codigo":200,"ms":8}

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:06 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":1}

$ curl -i http://127.0.0.1:18080/servicios/4/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:08 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":4,"codigo":200,"ms":1503}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms
tardó 1.004405 s

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 6 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP
tardó 0.002184 s

$ curl -i -X POST http://127.0.0.1:18080/servicios -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"nombre":"colgado","url":"http://127.0.0.1:18081/cortar"}'
HTTP/1.1 201 Created
Location: /servicios/7
ETag: "7-1-6db25d01"
Content-Type: application/json
Content-Length: 83
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":7,"nombre":"colgado","url":"http://127.0.0.1:18081/cortar","limite_ms":2000}

$ curl -i http://127.0.0.1:18080/servicios/7/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 102
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 7 no dio una respuesta HTTP válida: cortó la conexión o respondió algo que no es HTTP

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer escritura-a' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 59
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

solo quien opera el revisor puede cambiar el mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":true}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -i http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i http://127.0.0.1:18080/no-existe
HTTP/1.1 503 Service Unavailable
Retry-After: 120
Content-Type: text/plain; charset=utf-8
Content-Length: 34
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el revisor está en mantenimiento

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":false}'
HTTP/1.1 204 No Content
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

$ curl -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18080/servicios -H 'Authorization: Bearer lectura-a'
200

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/4/revisiones -H 'Authorization: Bearer admin'
202

$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 58
Content-Type: text/plain; charset=utf-8
Content-Length: 52
Date: Wed, 21 Oct 2026 13:19:09 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 consultas en vivo en el último minuto

$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ sleep 20
$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
HTTP/1.1 429 Too Many Requests
Retry-After: 40
Content-Type: text/plain; charset=utf-8
Content-Length: 45
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones en el último minuto

$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":2,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":503,"ms":1,"detalle":"503 (reintentar en 120 s)"}}

$ curl http://127.0.0.1:18080/revisiones/4 -H 'Authorization: Bearer lectura-a'
{"id":4,"servicio":4,"estado":"terminada","resultado":{"estado":"LENTO","codigo":200,"ms":1501,"detalle":"200"}}

$ curl -i http://127.0.0.1:18080/servicios/2/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 54
Date: Wed, 21 Oct 2026 13:19:29 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"revisiones":3,"ultimo_estado":"CAIDO"}
```

Et voici ce qu'a écrit le terminal du `revisor` pendant toute l'exécution. Remarque que les seules traces de pile sont celles des deux `500`, et que chacune commence par la référence reçue par le client :

```text
revisor en http://127.0.0.1:18080
GET /servicios/1/informe
error affc3b8a-5ab9-42f5-8b37-2face1f8eafd en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
GET /servicios/1/informe
error bf0e3b0a-790f-4625-80e7-017b0bcfa403 en GET /servicios/1/informe: TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:23:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:35:44)
GET /servicios/1/salud
GET /servicios/2/salud
GET /servicios/4/salud
GET /servicios/5/salud
GET /servicios/6/salud
POST /servicios
GET /servicios/7/salud
PUT /mantenimiento
PUT /mantenimiento
operación: mantenimiento encendido
GET /servicios
GET /no-existe
PUT /mantenimiento
operación: mantenimiento apagado
GET /servicios
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/2/revisiones
POST /servicios/4/revisiones
GET /servicios/1/salud
POST /servicios/1/revisiones
POST /servicios/2/revisiones
POST /servicios/3/revisiones
POST /servicios/4/revisiones
POST /servicios/5/revisiones
POST /servicios/6/revisiones
POST /servicios/7/revisiones
POST /servicios/8/revisiones
POST /servicios/9/revisiones
POST /servicios/10/revisiones
POST /servicios/2/revisiones
GET /revisiones/1
GET /revisiones/4
GET /servicios/2/informe
```

#### 4.7.4 Vérifier les types avec `tsc` (facultatif)

Comme dans les leçons précédentes, les programmes s'exécutent avec `node archivo.ts` sans rien compiler, et `tsc` ne sert qu'à vérifier les types. Depuis le dossier `fig04_01/` :

```bash
npm install --no-save typescript@7.0.2 @types/node@24
npx tsc --strict --noEmit --target esnext --module nodenext --erasableSyntaxOnly --verbatimModuleSyntax --allowImportingTsExtensions --types node *.ts
```

Il n'affiche rien si tout va bien. Les treize fichiers de `fig04_01/`, `fig04_02.ts`, `fig04_03.ts`, les deux versions de `defectos/` et les solutions de `ejercicios/` passent sans erreur. Remarque ce que cela signifie pour le défaut de `informe` : il passe `tsc` en mode strict. Les types disent quelle forme ont les données, non si elles existent ; un `as` retire à TypeScript l'occasion de t'avertir.

## L'erreur que tu vas voir

### La trace de pile qui voyage

Voici le `catch` que presque tout le monde écrit la première fois, parce que c'est le plus utile pendant que tu programmes : si quelque chose échoue, envoie-moi tout. Pour le provoquer, copie le dossier `fig04_01/` sous le nom `rota/` et remplace dans `rota/servidor.ts` la fonction `atenderSinFiltrar` par celle-ci (c'est un fragment ; la version complète se trouve dans `defectos/pila/servidor.ts`, qui indique dans sa première ligne qu'elle ne doit pas être copiée) :

```ts
async function atenderSinFiltrar(peticion: IncomingMessage, respuesta: ServerResponse): Promise<void> {
  try {
    await atender(peticion, respuesta);
  } catch (error) {
    const pila = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`error en ${peticion.method} ${peticion.url}`);
    if (!respuesta.headersSent) {
      fallar(respuesta, 500, pila);
    } else {
      respuesta.destroy();
    }
  }
}
```

Démarre le laboratoire et le `revisor` depuis `rota/` et demande le rapport du service 1, qui n'a pas de vérifications :

```text
$ curl -i http://127.0.0.1:18080/servicios/1/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 865
Date: Wed, 21 Oct 2026 13:19:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

TypeError: Cannot read properties of undefined (reading 'resultado')
    at Object.informe [as manejador] (file://<carpeta>/servicios.ts:304:28)
    at atender (file://<carpeta>/rutas.ts:104:16)
    at atenderSinFiltrar (file://<carpeta>/servidor.ts:11:11)
    at Server.<anonymous> (file://<carpeta>/servidor.ts:23:44)
    at Server.emit (node:events:508:28)
    at parserOnIncoming (node:_http_server:1210:12)
    at HTTPParser.parserOnHeadersComplete (node:_http_common:125:17)
```

(Le dossier de la machine s'écrit `<carpeta>`, comme dans le terminal du `revisor` ; le `Content-Length: 865` compte le dossier réel, qui est plus long.)

Le code est correct : `500`. Tout le reste est un cadeau pour qui ne devrait pas le recevoir. Lis-le comme le lirait quelqu'un qui veut attaquer ton API :

- **Les chemins.** Chaque cadre apporte le dossier complet où vit le programme. Sur un serveur réel, cela dit quel utilisateur fait tourner le processus, comment le projet s'appelle sur le disque et où chercher s'il trouve un autre moyen de lire des fichiers.
- **Les noms internes.** `servicios.ts`, `rutas.ts`, `servidor.ts`, la fonction `informe`, le champ `resultado`. C'est la carte de ton code, gratuite.
- **La technologie et sa version.** `node:events:508:28` et `node:_http_server:1210:12` sont des cadres de Node, et leurs numéros de ligne changent à chaque version : qui connaît Node peut en déduire laquelle tu utilises, et chercher ses vulnérabilités connues.
- **Comment le provoquer de nouveau.** Le message dit qu'on a lu `resultado` sur `undefined`. Avec la route demandée, il dit à celui qui l'a reçu exactement quelle condition fait planter le serveur, et lui permet de la répéter quand il veut.

Et regarde le terminal du `revisor` dans cette version :

```text
revisor en http://127.0.0.1:18080
GET /servicios/1/informe
error en GET /servicios/1/informe
```

Une ligne, sans référence et sans trace de pile. Ce `catch` a tout donné au client et presque rien à celui qui exploite le service. Si le client ne signale pas le corps qu'il a reçu, personne du côté du serveur ne sait ce qui s'est passé. C'est l'erreur à l'envers, complète : l'information est du mauvais côté.

La correction est l'`atenderSinFiltrar` de `fig04_01/` : la trace de pile va dans le terminal, réduite aux cadres du cours, et le client ne reçoit que la référence. Si tu penses « mais en développement, voir la trace de pile dans la réponse m'est utile », la réponse est que tu l'as dans le terminal, juste à côté, avec la même information ; et qu'un `catch` qui se comporte différemment en développement et en production est un `catch` dont tu n'as jamais testé la version de production. Arrête les programmes de `rota/` quand tu as fini.

### Tout est `500`

La seconde erreur est plus subtile, parce que la réponse est impeccable dans la forme et fausse sur le fond. Copie de nouveau `fig04_01/` sous le nom `rota2/` et remplace dans `rota2/servicios.ts` la fonction `salud` par celle-ci, qui interroge avec `fetch` directement, sans passer par `consultar` (la version complète se trouve dans `defectos/sin-pasarela/servicios.ts`, avec le même avertissement dans sa première ligne) :

```ts
export async function salud({ respuesta, parametros, credencial }: Contexto): Promise<void> {
  // La consulta en vivo también sale a la red, igual que una revisión: sin límite, el revisor serviría
  // para golpear un servicio ajeno a través de él. Cuenta por credencial, antes de buscar el servicio,
  // en una ventana aparte de la de las revisiones.
  const decision = permitir(`salud:${credencial.nombre}`, CONSULTAS_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${CONSULTAS_POR_VENTANA} consultas en vivo en el último minuto`, {
      "Retry-After": String(decision.esperaS),
    });
    return;
  }
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // DEFECTO A PROPÓSITO: llama a fetch directo y no clasifica lo que puede salir mal. Si el servicio
  // no responde a tiempo o no responde HTTP, fetch lanza, y la excepción llega a servidor.ts.
  const veredicto = await revisarDestino(servicio.url);
  if (!veredicto.permitido) {
    fallar(respuesta, 422, `destino prohibido: ${veredicto.motivo}`);
    return;
  }
  const inicio = performance.now();
  const contestacion = await fetch(servicio.url, { redirect: "manual", signal: AbortSignal.timeout(servicio.limiteMs) });
  await contestacion.body?.cancel();
  enviarJson(respuesta, 200, { servicio: servicio.id, codigo: contestacion.status, ms: Math.round(performance.now() - inicio) });
}
```

Elle se lit bien, et fait ce qu'il faut quand le service répond. Démarre le laboratoire et le `revisor` depuis `rota2/` et demande la santé des services 2, 5 et 6 :

```text
$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 36
Date: Wed, 21 Oct 2026 13:19:32 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":20}

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia 53423d0e-11e2-4ce0-befe-6f701044a854
tardó 1.002529 s

$ curl -i http://127.0.0.1:18080/servicios/6/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia 3ec30ef1-4589-44c0-a95c-00c1195b86d9
```

Le service 2 sort comme avant, `200` avec son `503` à l'intérieur. Mais le 5, qui n'a pas répondu à temps, et le 6, qui a répondu n'importe quoi, sortent tous les deux en `500`, avec une référence et sans trace de pile. Le filet de `servidor.ts` a bien fait son travail : il a attrapé une exception que personne n'attendait, n'a rien raconté et a laissé le fil dans le terminal :

```text
revisor en http://127.0.0.1:18080
GET /servicios/2/salud
GET /servicios/5/salud
error 53423d0e-11e2-4ce0-befe-6f701044a854 en GET /servicios/5/salud: TimeoutError: The operation was aborted due to timeout
GET /servicios/6/salud
error 3ec30ef1-4589-44c0-a95c-00c1195b86d9 en GET /servicios/6/salud: TypeError: fetch failed
```

Le problème est que **si, on l'attendait**. Qu'un service étranger ne réponde pas à temps, ou réponde n'importe quoi, est la chose la plus normale du monde pour un programme dont le travail est d'interroger des services étrangers. Répondre `500` dit à celui qui exploite le service « ton code a une erreur », et l'envoie chercher dans `servicios.ts` un défaut qui n'existe pas, alors que le vrai problème est dans le service de rapports et dans celui de facturation. C'est exactement la confusion de 19 h 20 de la scène d'ouverture. Et remarque la deuxième ligne d'erreur : `TypeError: fetch failed`, sans un seul cadre du cours. La pile de `fetch` vit entièrement à l'intérieur de Node, et `pilaDelCurso` l'a toute rognée. Même le terminal ne dit pas où cela s'est passé.

La correction est le `salud` de `fig04_01/` : demander à `consultar`, qui convertit chaque façon d'échouer en une issue nommée, et choisir un code pour chacune. **Ce qu'on peut prévoir, on ne le laisse pas arriver au filet du `500`** : le filet est pour ce que vraiment personne n'avait prévu. Arrête les programmes de `rota2/` quand tu as fini.

## Ce qui se fait de travers

**`500` pour tout ce qui tourne mal.** C'est l'erreur que cette leçon existe pour éviter. Un `500` pour une dépendance lente, une maintenance ou une limite de requêtes envoie celui qui exploite le service chercher dans son propre code, et dit au client « je ne sais pas ce qui s'est passé » alors qu'on le savait.

**La trace de pile, le SQL ou le message de l'exception dans le corps.** Le premier est l'erreur de « La trace de pile qui voyage ». Le dernier est celui qui s'échappe le plus, parce qu'il paraît inoffensif : le texte d'une exception est écrit par celui qui l'a levée, et peut contenir une requête, un chemin ou une adresse interne.

**Un `500` sans rien qui permette de le retrouver.** Le contraire du précédent : tout taire, même du côté de celui qui exploite le service. Un `500` sans référence, sur un serveur qui traite des milliers de requêtes par minute, ne peut être associé à aucune ligne du journal.

**Un `503` sans `Retry-After`, ou avec un `Retry-After` inventé.** La RFC n'oblige pas à l'envoyer, mais un `503` sans lui laisse le client deviner combien de temps attendre, et chaque client devine différemment. Et un `Retry-After: 1` mis « au cas où » dans une maintenance de deux heures fait que tous les clients reviennent chaque seconde, ce qui est le contraire de ce que tu voulais.

**Un `503` permanent.** Le `503` promet que c'est temporaire. Pour quelque chose qui a été retiré pour toujours, le code est `410` (Leçon 3) ; pour quelque chose qui n'existe pas, `404`.

**Répondre avec le code du service de derrière.** Si le service de paiements répond `503` et que ta consultation de santé répond `503`, n'importe quelle machine sur le chemin en conclut que c'est toi qui es en panne. La consultation a fonctionné : c'est un `200` avec le `503` à l'intérieur, comme en 4.4.3. Et à l'inverse, si ton API utilise un autre service pour répondre, un `404` de ce service n'est pas un `404` de ta part : ne retransmets pas au client les codes d'un autre.

**Un `429` sans `Retry-After`, ou une limite que personne n'a documentée.** Le client qui reçoit un `429` sans savoir combien de temps attendre réessaie aussitôt, et reçoit de nouveau `429`. La RFC 6585 laisse ouverts le combien, la fréquence et le par qui ; les laisser en plus non documentés fait de la limite un mystère que chaque client découvre à coups d'essais.

**`429` pour une saturation que ce client n'a pas causée.** Si le serveur est saturé par tout le monde, le code est `503`. Le `429` accuse un client précis de dépasser la mesure.

**Une limite dont la clé provient de texte libre du client.** Limiter par un identifiant que le client peut inventer sans coût (un id qui n'existe pas, un en-tête que personne n'a vérifié) donne à n'importe qui un moyen de créer des clés sans fin et de remplir la mémoire du limiteur.

**Attendre une dépendance sans limite de temps.** Sans `AbortSignal.timeout`, une consultation vers un service bloqué attend indéfiniment, et chaque requête qui arrive entre-temps occupe une connexion de plus. Sans limite de temps il n'y a pas de `504` : il y a un serveur qui se retrouve peu à peu sans ressources.

## Exercices

Les quatre se corrigent tout seuls : chacun se termine par une exécution qui te dit si tu as eu juste. Écris ta prédiction dans le [journal de bord](bitacora.md) **avant** de lancer quoi que ce soit. Pour les exercices 1, 3 et 4, tu as besoin du laboratoire et du `revisor` de 4.7 en marche, tout juste démarrés.

### Exercice 1 — Qui est en tort ?

Prédis le code de chacune de ces six requêtes et, pour chacune, qui est en tort et qui peut le corriger. Attention : toutes ne sont pas des erreurs du serveur.

```bash
curl -i http://127.0.0.1:18080/servicios/3/salud -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/4/informe -H 'Authorization: Bearer lectura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer lectura-a'
curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer escritura-a'
curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":"si"}'
```

Ensuite, exécute-les et compare.

### Exercice 2 — Un `Retry-After` qui n'est pas valide

En 4.5.3, tu as vu que `segundosDeEspera` n'utilise pas `Date.parse`. Cet exercice te montre pourquoi. Écris une version naïve, `segundosConDateParse`, qui accepte les chiffres et passe tout le reste à `Date.parse`, et compare-la à celle du `revisor` dans un programme (`ejercicios/ej2.ts`) avec ces neuf valeurs :

- `"120"`, `"1.5"`, `"-1"` et `"12 30"`
- `"Xyz, 21 Oct 2026 10:00:00 GMT"` et `"Wed, 32 Oct 2026 10:00:00 GMT"`
- la même date, une minute dans le futur, sous les trois formes de HTTP-date : la préférée, celle de la RFC 850 et celle d'`asctime`

Avant de lancer quoi que ce soit, décide quelles sont les valeurs valides de `Retry-After` selon la grammaire de la RFC 9110, et prédis ce que renvoie chaque version pour chacune. Indice : la grammaire de la RFC énumère les jours et les mois, et dit qu'une date HTTP est toujours en GMT ; `Date.parse` ne sait rien de tout cela.

### Exercice 3 — L'énumérateur face à la limite

Avec le laboratoire et le `revisor` de 4.7 tout juste démarrés, prédis quels codes reçoit `escritura-b` en demandant des vérifications pour les ids 1 à 10, l'un après l'autre. Ensuite, `escritura-a` demande trois vérifications du service 2, et aussitôt `admin` en demande une du même service : que reçoit `admin` ?

```bash
for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
```

Fais maintenant une copie de `fig04_01/` et remplace dans son `servicios.ts` la limite de `pedirRevision` par celle qui paraît la plus naturelle : **par service** (la clé `revisiones:` plus l'id du service) et **après** `encontrar`. Ne touche pas à ton `fig04_01/`, qui est le `revisor` que reçoit la Leçon 5. Démarre la copie, répète les mêmes requêtes et prédis de nouveau. Laquelle des deux versions freine l'énumérateur ? Laquelle punit `admin` pour ce qu'a fait `escritura-a` ?

### Exercice 4 — Sans laboratoire

Arrête le laboratoire (`Ctrl+C` dans son terminal) et laisse le `revisor` en marche. Prédis ce que répondent ces requêtes, et combien de temps met la seconde :

```bash
curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
sleep 2
curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
```

Le service 5 donnait `504` en 4.4.3. Donne-t-il encore `504` ?

## Solutions

### Solution 1

```text
$ curl -i http://127.0.0.1:18080/servicios/3/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 404 Not Found
Content-Type: text/plain; charset=utf-8
Content-Length: 24
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no existe el servicio 3

$ curl -i http://127.0.0.1:18080/servicios/4/informe -H 'Authorization: Bearer lectura-a'
HTTP/1.1 500 Internal Server Error
Content-Type: text/plain; charset=utf-8
Content-Length: 63
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

error interno; referencia d88e2544-137d-436f-b5d2-c206d50ca348

$ curl -i -X POST http://127.0.0.1:18080/servicios/5/revisiones -H 'Authorization: Bearer lectura-a'
HTTP/1.1 403 Forbidden
Content-Type: text/plain; charset=utf-8
Content-Length: 74
Date: Wed, 21 Oct 2026 13:19:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

tu credencial solo puede leer; para escribir pide una con rol de escritor

$ curl -i http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 504 Gateway Timeout
Content-Type: text/plain; charset=utf-8
Content-Length: 39
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

el servicio 5 no respondió en 1000 ms

$ curl -i http://127.0.0.1:18080/servicios/2/salud -H 'Authorization: Bearer escritura-a'
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 35
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"servicio":2,"codigo":503,"ms":5}

$ curl -i -X PUT http://127.0.0.1:18080/mantenimiento -H 'Authorization: Bearer admin' -H 'Content-Type: application/json' -d '{"activo":"si"}'
HTTP/1.1 422 Unprocessable Content
Content-Type: text/plain; charset=utf-8
Content-Length: 30
Date: Wed, 21 Oct 2026 13:19:35 GMT
Connection: keep-alive
Keep-Alive: timeout=5

activo: debe ser true o false
```

Dans l'ordre :

- **`404`** : le service 3 est de l'équipe b, et pour `lectura-a` il n'existe pas. C'est une erreur du client, la même que dans la Leçon 2, et la consultation de santé n'est jamais sortie sur le réseau. Faute et correction : du client.
- **`500`** : le service 4 (`inventario`) n'a pas de vérifications terminées, et `informe` plante, comme avec le 1. Faute : le code du `revisor`. Correction : celui qui l'exploite, en corrigeant `informe` (la référence de la réponse mène à la trace de pile dans le terminal).
- **`403`** : demander une vérification, c'est écrire, et `lectura-a` ne fait que lire. Ce n'est pas un `429` : la question 4 du point d'entrée est tranchée avant la limite, qui vit à l'intérieur du gestionnaire. Faute et correction : du client, ou de celui qui lui a donné cet identifiant.
- **`504`** : `reportes` ne répond pas en 1000 ms. Faute : le service de rapports. Correction : celui qui l'exploite. Le `revisor` n'a rien à corriger.
- **`200`** : `pagos` a répondu `503`, et le `revisor` l'a rapporté avec succès. Personne ne s'est trompé avec cette requête ; la mauvaise nouvelle est la donnée qu'elle apporte.
- **`422`** : `"si"` n'est pas un booléen. L'`admin` a passé le point d'entrée et le contrôle du rôle, et le corps a pu être lu, mais il ne peut pas être satisfait : c'est la politique `400`/`422` de la Leçon 3. Faute et correction : du client.

Seules deux des six sont des erreurs du serveur, et elles viennent de deux serveurs différents. Si tu t'es trompé sur la troisième, revois l'ordre : la permission du rôle se demande au point d'entrée, et la limite, à l'intérieur du gestionnaire.

### Solution 2

Seul `"120"` est un `delay-seconds` valide (`1*DIGIT`). `"1.5"`, `"-1"` et `"12 30"` ne sont ni des secondes ni une date HTTP. `"Xyz, …"` a la forme de la date préférée, mais `Xyz` n'est pas un jour : la RFC énumère les sept. `"Wed, 32 Oct …"` a la forme correcte, mais le 32 octobre n'existe pas. Les trois dernières sont valides : la préférée et les deux obsolètes que celui qui lit **doit** accepter (section 5.6.7). Une fonction correcte renvoie `120`, cinq `null` et environ `60` secondes trois fois. Ce programme compare les deux :

```ts
// ejercicios/ej2.ts — Retry-After: la lectura del revisor contra una ingenua que confía en Date.parse.
import { segundosDeEspera } from "../fig04_01/cliente.ts";

// La versión ingenua: dígitos, o lo que Date.parse quiera entender como fecha.
function segundosConDateParse(valor: string): number | null {
  if (/^\d+$/.test(valor)) return Number(valor);
  const fecha = Date.parse(valor);
  return Number.isNaN(fecha) ? null : Math.max(0, Math.ceil((fecha - Date.now()) / 1000));
}

// La misma fecha, un minuto adelante, en las tres formas de HTTP-date (RFC 9110, sección 5.6.7).
const enUnMinuto = new Date(Math.ceil((Date.now() + 60_000) / 1000) * 1000);
const imf = enUnMinuto.toUTCString();
const [, dia, num, mes, anio, hora] = /^(\w{3}), (\d{2}) (\w{3}) (\d{4}) (\S+) GMT$/.exec(imf) ?? [];
const DIAS_LARGOS: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};
const rfc850 = `${DIAS_LARGOS[dia]}, ${num}-${mes}-${anio.slice(2)} ${hora} GMT`;
const asctime = `${dia} ${mes} ${num.replace(/^0/, " ")} ${hora} ${anio}`;

const VALORES = ["120", "1.5", "-1", "12 30", "Xyz, 21 Oct 2026 10:00:00 GMT", "Wed, 32 Oct 2026 10:00:00 GMT", imf, rfc850, asctime];

console.log(`${"valor".padEnd(36)}${"Date.parse".padStart(11)}${"revisor".padStart(9)}`);
for (const valor of VALORES) {
  const ingenua = segundosConDateParse(valor);
  console.log(`${JSON.stringify(valor).padEnd(36)}${String(ingenua).padStart(11)}${String(segundosDeEspera(valor)).padStart(9)}`);
}
```

```text
$ node ejercicios/ej2.ts
valor                                Date.parse  revisor
"120"                                       120      120
"1.5"                                         0     null
"-1"                                          0     null
"12 30"                                       0     null
"Xyz, 21 Oct 2026 10:00:00 GMT"               0     null
"Wed, 32 Oct 2026 10:00:00 GMT"            null     null
"Wed, 21 Oct 2026 13:20:57 GMT"              61       61
"Wednesday, 21-Oct-26 13:20:57 GMT"          61       61
"Wed Oct 21 13:20:57 2026"                21661       61
```

(Les trois dates valides donnent `61` et non `60` parce que le programme arrondit « dans une minute » à la seconde suivante, et que `segundosDeEspera` arrondit vers le haut.)

La colonne du `revisor` est correcte sur les neuf lignes. Celle de `Date.parse` comporte deux sortes d'erreurs.

**Elle accepte ce qui n'est pas une date.** Avec `"1.5"`, `"-1"`, `"12 30"` et `"Xyz, …"`, la version naïve renvoie **`0`**, « tu peux réessayer maintenant ». Ce ne sont pas des chiffres, alors elle essaie de les lire comme une date, et le `Date.parse` de V8 est si permissif qu'il les accepte : `"1.5"` est lu comme une date de 2001, et dans `"Xyz, …"` il ne regarde même pas le nom du jour. Comme ces dates sont déjà passées, le résultat est `0`. Un serveur qui envoie un `Retry-After` mal écrit obtient le contraire de ce qu'il voulait : un client qui insiste aussitôt. La version du `revisor` renvoie `null`, ce qui est honnête : « on ne m'a pas dit combien attendre ». (Avec `"Wed, 32 Oct …"`, en revanche, `Date.parse` a bien refusé ; `Date.UTC`, qu'utilise `fechaHttp`, l'aurait accepté, et c'est pourquoi `fechaHttp` vérifie la date à la fin.)

**Elle lit `asctime` dans l'heure locale.** Avec la date `asctime`, la version naïve renvoie **`21661`**, environ six heures, et celle du `revisor`, `61`. Le format `asctime` n'écrit pas le fuseau horaire, et la RFC dit que c'est GMT ; `Date.parse` le lit comme une heure **locale**. Cette exécution a été faite sur une machine en UTC−6, si bien que la date s'est retrouvée six heures dans le futur. Sur une machine en UTC, les deux colonnes donneraient la même chose : c'est une panne qui dépend de l'endroit où le programme s'exécute, le pire type de panne, parce qu'elle ne se voit pas sur la machine de celui qui l'a écrit.

La leçon pour ton propre code : **lis un en-tête avec sa grammaire, pas avec la fonction la plus proche qui « semble fonctionner »**. `Date.parse` sert à lire une date dont tu sais déjà que c'est une date, et dans le fuseau dont tu sais déjà qu'il est le sien.

### Solution 3

Avec le `revisor` de `fig04_01/` :

```text
$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 429 429 429 429 429 429 429 

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
HTTP/1.1 202 Accepted
Location: /revisiones/5
Content-Type: application/json
Content-Length: 60
Date: Wed, 21 Oct 2026 13:19:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":5,"servicio":2,"estado":"pendiente","resultado":null}
```

L'énumérateur reçoit `404 404 202` puis `429` sept fois : les trois premières requêtes ont rempli sa fenêtre, même si deux étaient des `404`, parce que la limite se demande avant de chercher le service et compte par identifiant. Et `admin` reçoit `202` : ce qu'a dépensé `escritura-a`, un autre identifiant ne le paie pas.

Avec la copie, dans laquelle la limite compte par service et se demande après `encontrar` (le fichier complet se trouve dans `ejercicios/ej3/servicios.ts`) :

```ts
export function pedirRevision({ respuesta, parametros, credencial }: Contexto): void {
  const servicio = encontrar(parametros[0], credencial, respuesta);
  if (servicio === undefined) return;
  // Ejercicio 3: el límite como estaba antes, por servicio y después de encontrar. NO es el del revisor.
  const decision = permitir(`revisiones:${servicio.id}`, REVISIONES_POR_VENTANA, VENTANA_MS);
  if (!decision.permitido) {
    fallar(respuesta, 429, `ya pediste ${REVISIONES_POR_VENTANA} revisiones de este servicio en el último minuto`, {
      "Retry-After": String(decision.esperaS),
    });
    return;
  }
  const revision = crearRevision(servicio.id);
  setTimeout(async () => {
    terminarRevision(revision.id, await revisar(servicio.url, servicio.limiteMs));
  }, ESPERA_EN_COLA_MS);
  enviarJson(respuesta, 202, representarRevision(revision), { Location: `/revisiones/${revision.id}` });
}
```

```text
$ for id in 1 2 3 4 5 6 7 8 9 10; do curl -sS -o /dev/null -w '%{http_code} ' -X POST http://127.0.0.1:18080/servicios/$id/revisiones -H 'Authorization: Bearer escritura-b'; done; echo
404 404 202 404 404 404 404 404 404 404 

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer escritura-a'
202

$ curl -i -X POST http://127.0.0.1:18080/servicios/2/revisiones -H 'Authorization: Bearer admin'
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: text/plain; charset=utf-8
Content-Length: 62
Date: Wed, 21 Oct 2026 13:19:37 GMT
Connection: keep-alive
Keep-Alive: timeout=5

ya pediste 3 revisiones de este servicio en el último minuto
```

Les deux résultats s'inversent. L'énumérateur parcourt les dix ids sans un seul `429` : chaque `404` sort de `encontrar` avant de toucher le limiteur, et le seul qui le touche est le 3, une fois. Avec cent mille ids, ce serait pareil. Et `admin` reçoit `429` avec `Retry-After: 60`, pour trois vérifications qu'une autre personne a demandées : le code l'accuse d'un rythme qui n'était pas le sien. La version « naturelle » a les deux défauts à la fois, et c'est pourquoi le `revisor` ne l'utilise pas. Arrête la copie quand tu as fini.

### Solution 4

```text
$ curl -i http://127.0.0.1:18080/servicios/1/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no se pudo conectar con el servicio 1

$ curl -i -w 'tardó %{time_total} s\n' http://127.0.0.1:18080/servicios/5/salud -H 'Authorization: Bearer lectura-a'
HTTP/1.1 502 Bad Gateway
Content-Type: text/plain; charset=utf-8
Content-Length: 38
Date: Wed, 21 Oct 2026 13:19:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5

no se pudo conectar con el servicio 5
tardó 0.001450 s

$ curl -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:18080/servicios/1/revisiones -H 'Authorization: Bearer escritura-a'
202

$ sleep 2
$ curl http://127.0.0.1:18080/revisiones/1 -H 'Authorization: Bearer lectura-a'
{"id":1,"servicio":1,"estado":"terminada","resultado":{"estado":"CAIDO","codigo":null,"ms":null,"detalle":"sin conexión"}}
```

Les deux sont des `502`, « la connexion n'a pas pu s'établir » : avec le laboratoire arrêté, personne n'écoute sur le port 18081, la connexion est refusée (`ECONNREFUSED`) et `consultar` la classe comme `sin-conexion`. **Le service 5 ne donne plus `504`** : il donne `502`, et en moins de 2 millisecondes (`0.001450 s`), non en 1000. Le `504` exige que quelqu'un accepte la connexion et ne réponde pas ; ici, personne ne l'a acceptée, et la tentative s'est terminée aussitôt. Le même service, avec la même limite, peut produire deux codes différents selon **la façon** dont échoue ce qui se trouve derrière. Et la vérification demandée avec le laboratoire arrêté est restée `CAIDO` avec `"detalle":"sin conexión"`, sans code et sans millisecondes : il n'y a pas eu de réponse, et le résultat n'en invente pas. Redémarre le laboratoire quand tu as fini.

## Comment savoir que tu as réussi

- [ ] Pour chacun des cinq codes de la leçon, tu dis de mémoire qui est en tort, qui peut le corriger et ce que fait le client.
- [ ] `curl -i` sur `/servicios/1/informe`, juste après le démarrage du `revisor`, donne `500` avec `error interno; referencia <uuid>`, et tu retrouves cette référence dans le terminal, avec la trace de pile qui commence dans `servicios.ts`.
- [ ] `/servicios/2/salud` donne `200` avec `"codigo":503`, et tu expliques pourquoi ce n'est pas un `503`.
- [ ] `/servicios/5/salud` donne `504` en un peu plus d'une seconde, et `/servicios/6/salud` donne `502` presque instantanément.
- [ ] Avec le mode maintenance activé par `admin`, n'importe quelle requête, même vers une route qui n'existe pas et sans identifiant, donne `503` avec `Retry-After: 120` ; et `PUT /mantenimiento` avec `escritura-a` donne `403`.
- [ ] La quatrième vérification demandée avec le même identifiant en une minute donne `429` avec `Retry-After: 60`, et vingt secondes plus tard, avec un `Retry-After` plus petit ; une vérification avec un autre identifiant donne toujours `202`.
- [ ] `escritura-b` qui demande des vérifications pour les ids 1 à 10 reçoit `404 404 202` puis `429`, et tu expliques pourquoi une limite par service ne le freinerait pas.
- [ ] Tu expliques, avec l'exécution de `fig04_02.ts`, pourquoi une fenêtre fixe de 3 par seconde en laisse passer 5 en moins de 70 ms.
- [ ] Tu expliques ce que révèle une trace de pile dans le corps d'un `500`, avec l'exécution de `defectos/pila/`.
- [ ] En terminant, aucun programme n'écoute plus : `curl -i http://127.0.0.1:18080/` et `curl -i http://127.0.0.1:18081/codigo/200` donnent tous les deux l'erreur 7.

## Résumé

Réponds sans consulter la leçon :

1. Quelles deux questions faut-il poser devant n'importe quelle panne, et que répondent le `429`, le `500`, le `502`, le `503` et le `504` ?
2. Pourquoi le `429` est-il un `4xx`, alors qu'il parle de capacité ? Et pourquoi le `503` est-il un `5xx`, alors que le serveur fonctionne ?
3. Quelle condition le `502` et le `504` partagent-ils dans la RFC 9110, et qu'est-ce qui les sépare ?
4. Pourquoi la consultation de santé d'un service qui répond `503` est-elle un `200` ?
5. Quelles sont les deux formes de `Retry-After`, et pourquoi `1.5` n'est-il pas une valeur valide ?
6. Qu'est-ce qui va dans le corps d'un `500`, qu'est-ce qui va dans le terminal, et qu'est-ce qui les relie ?
7. Pourquoi la limite de vérifications compte-t-elle par identifiant et se demande-t-elle avant `encontrar` ? Que se passerait-il avec une limite par service ?
8. Quel défaut a la fenêtre fixe, et quels algorithmes l'évitent ?

## Sources

Toutes ont été consultées le 21 octobre 2026.

1. [RFC 9110, *HTTP Semantics*, section 15.6](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6) : la famille `5xx`, « le serveur sait qu'il s'est trompé ou n'est pas capable », et l'explication précisant si la condition est temporaire ou permanente.
2. [RFC 9110, section 15.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.1) : le `500`, une condition inattendue qui a empêché de satisfaire la requête.
3. [RFC 9110, section 15.6.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.3) : le `502`, une réponse invalide reçue alors qu'on agissait comme passerelle ou proxy ; et la [section 3.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.7) : ce qu'est une passerelle et ce qu'est un proxy, et les termes *inbound* et *upstream*.
4. [RFC 9110, section 15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4) : le `503`, surcharge temporaire ou maintenance programmée, `Retry-After` facultatif, et la note selon laquelle un serveur saturé peut simplement refuser la connexion.
5. [RFC 9110, section 15.6.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.5) : le `504`, une réponse qui n'est pas arrivée à temps alors qu'on agissait comme passerelle ou proxy.
6. [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3) : `Retry-After = HTTP-date / delay-seconds`, `delay-seconds = 1*DIGIT`, et son sens avec un `503` ; et la [section 5.6.7](https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.7) : les trois formats de la date HTTP, que celui qui lit doit accepter.
7. [RFC 6585, *Additional HTTP Status Codes*, section 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4) : le `429`, « trop de requêtes dans un temps donné », `Retry-After` facultatif, la liberté d'identifier l'utilisateur et de compter, et l'interdiction de le conserver dans un cache ; et la [section 7.2](https://www.rfc-editor.org/rfc/rfc6585.html#section-7.2) : répondre `429` sous attaque consomme aussi des ressources, et n'est pas obligatoire.
8. [MITRE, CWE-209, *Generation of Error Message Containing Sensitive Information*](https://cwe.mitre.org/data/definitions/209.html) : les traces de pile, les chemins et la structure des requêtes dans un message d'erreur comme faiblesse.
9. [OWASP, *Error Handling Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) : le détail de l'erreur se consigne côté serveur et l'on répond à l'utilisateur un message générique ; et la [*Logging Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) : les jetons d'accès et les données sensibles ne se consignent pas tels quels.
10. [OWASP API Security Top 10, API4:2023 *Unrestricted Resource Consumption*](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption) : limiter combien de fois un client interagit avec l'API dans un temps donné, et fixer des limites de temps d'exécution.
11. [OWASP, *Authentication Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), section *Protect Against Automated Attacks* : la limite de tentatives contre la force brute, comptée par compte et pas seulement par adresse d'origine.
12. [IETF, *RateLimit header fields for HTTP*, `draft-ietf-httpapi-ratelimit-headers-11`](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) (23 mai 2026) : définit `RateLimit-Policy` et `RateLimit` ; c'est un brouillon, non une RFC.
13. [Documentation de l'API REST de GitHub, *Rate limits for the REST API*](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) : `403` ou `429` en cas de dépassement d'une limite, `retry-after`, `x-ratelimit-remaining` et `x-ratelimit-reset`.
14. [MDN, `AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) : le signal annule avec une `DOMException` de nom `TimeoutError`, distincte de `AbortError` ; et [Node.js 24 : `crypto.randomUUID()`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandomuuidoptions) : un UUID de version 4 généré avec un générateur cryptographique.
15. [Manuel de `curl`](https://curl.se/docs/manpage.html) : `-m` (`--max-time`), `--http0.9` et les codes de sortie 1 (protocole non pris en charge), 7 (connexion impossible), 18 (transfert incomplet), 28 (délai écoulé) et 52 (le serveur n'a rien répondu).

### Termes de cette leçon

| | |
|---|---|
| **passerelle** (*gateway*) | un serveur qui, pour répondre, demande quelque chose à un autre serveur et répond avec ce qu'il a obtenu ; si l'autre échoue, il répond `502` ou `504` |
| **dépendance** | un service dont un autre a besoin d'une réponse pour faire son travail |
| **référence** | un identifiant aléatoire qui voyage dans le `500` et reste dans le journal à côté de la trace de pile, pour retrouver une erreur sans rien révéler |
| **trace de pile** (*stack trace*) | la liste des fonctions en cours d'exécution au moment où une erreur s'est produite, de la plus récente à la plus ancienne |
| **journal** | ce que le serveur écrit pour celui qui l'exploite ; dans le `revisor`, son terminal |
| **limite de requêtes** (*rate limiting*) | combien de requêtes sont acceptées dans un temps donné ; en cas de dépassement, `429` |
| **fenêtre fixe** | une limite qui compte depuis le début d'une fenêtre et revient à zéro quand la fenêtre se termine |
| **mode maintenance** | un état dans lequel le serveur décide de ne pas répondre et renvoie `503` avec `Retry-After` |
| **`Retry-After`** | l'en-tête qui dit combien de temps attendre avant de redemander : des secondes ou une date HTTP |

---

**Précédent :** [Leçon 3 — Le client s'est trompé (II) : 409, 410, 412, 422 et 428](03-errores-del-cliente-estado.md) · **Suivant :** [Leçon 5 — Problem Details (RFC 9457)](05-problem-details.md)

